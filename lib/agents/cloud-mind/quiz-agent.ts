/**
 * 云端智囊 — 智能出题 Agent
 *
 * 根据学科、难度、知识点，使用 AI 生成高质量选择题。
 */

import { jsonrepair } from 'jsonrepair';
import { createLogger } from '@/lib/logger';
import { callLLM } from '@/lib/ai/llm';
import { getModel } from '@/lib/ai/providers';
import { resolveApiKey, resolveBaseUrl } from '@/lib/server/provider-config';
import { retrieveRelevantContext } from '@/lib/agents/rag/retriever';
import { buildProfileContextPrompt } from '@/lib/student/profile-prompts';
import type { StudentProfile } from '@/lib/student/profile-types';
import { getSubjectLabelOrSelf } from '@/lib/mistakes/subject-inference';
import {
  buildCloudMindCacheKey,
  getCloudMindCache,
  setCloudMindCache,
} from '@/lib/agents/cloud-mind/cache';
import {
  QUIZ_EXPLANATION_PROMPT_LIMIT_CHARS,
  sanitizeQuizExplanation,
} from '@/lib/quiz/explanation';

const log = createLogger('QuizAgent');

export const QUIZ_AGENT_PROMPT_VERSION = 'v3-concise-explanations';

// ── 输出结构 ───────────────────────────────────────────────────────

export interface QuizQuestion {
  id: number;
  question: string;
  options: string[];
  answer: number;
  explanation: string;
}

export interface QuizOutput {
  subject: string;
  topic: string;
  difficulty: string;
  questions: QuizQuestion[];
}

// ── System Prompt ──────────────────────────────────────────────────

const QUIZ_AGENT_SYSTEM_PROMPT = `你是一位资深的教育出题专家，擅长根据学科、难度和知识点设计高质量的选择题。

## 你的职责
1. **精准出题**：根据指定学科和知识点，设计有区分度的选择题
2. **难度把控**：严格控制题目难度符合要求
3. **选项设计**：干扰项要有合理性，不能太明显错误
4. **简明解析**：每道题提供短、准、能直接帮助订正的解析

## 难度标准
- 基础（easy）：考查基本概念和公式记忆，直接应用
- 进阶（medium）：需要理解和简单推理，涉及知识的综合运用
- 挑战（hard）：需要深入分析和多步推理，有思维陷阱

## 学情感知
- 如果调用方提供了学生学情上下文，请优先针对薄弱知识点出题
- 针对高频错误模式设计具有迷惑性的干扰项
- 已掌握知识点可降低权重或作为复习巩固题

## 输出格式要求
请严格按照以下 JSON 格式输出：

{
  "subject": "学科名称",
  "topic": "知识点",
  "difficulty": "难度等级",
  "questions": [
    {
      "id": 1,
      "question": "题目内容",
      "options": ["选项1", "选项2", "选项3", "选项4"],
      "answer": 0,
      "explanation": "一句到三句短解析，指出关键条件、核心步骤和正确答案依据"
    }
  ]
}

## 注意事项
- 只输出 JSON，不要输出 Markdown 代码块或额外说明
- answer 字段为正确选项的索引（0=A, 1=B, 2=C, 3=D）
- options 只写选项内容，不要添加 A/B/C/D 前缀
- questions 数组长度必须等于用户要求的题目数量
- 每道题必须有 4 个选项
- 解析必须简短：不超过 ${QUIZ_EXPLANATION_PROMPT_LIMIT_CHARS} 个汉字，最多 3 句
- 解析只写最终正确思路，不展示试错、自我纠错、反复验算或“可能/也许/我理解错了”等不确定表达
- 生成 JSON 前请私下核对：题目、正确选项和解析必须一致；若不一致，先改题目或选项，不要在解析中说明矛盾
- 确保 JSON 格式正确，可以被直接解析
- 字符串中禁止出现未转义的换行符，所有换行必须使用 \\n 表示
- 字符串中禁止出现未转义的双引号，必须使用 \\" 转义
- 数学公式必须使用 LaTeX 格式：行内公式用 $...$ 包裹，独立公式用 $$...$$ 包裹
  例如二次函数顶点写成 $y = a(x - h)^2 + k$
  分数写成 $\\frac{1}{2}$，积分写成 $\\int_{0}^{1} f(x) dx$
  禁止使用 Unicode 数学符号（如 × ÷ ² ³ α β），必须使用 LaTeX 命令（如 \\times \\div \\alpha \\beta）

<!-- prompt-version: ${QUIZ_AGENT_PROMPT_VERSION} -->`;

function stripOptionPrefix(option: string): string {
  return option.replace(/^\s*[A-DＡ-Ｄ][\.．、:]\s*/i, '').trim();
}

function normalizeAnswer(answer: unknown): number | null {
  if (typeof answer === 'number' && Number.isInteger(answer)) return answer;
  if (typeof answer !== 'string') return null;

  const normalized = answer.trim();
  if (/^[0-3]$/.test(normalized)) return Number(normalized);

  const letterMatch = normalized.match(/[A-DＡ-Ｄ]/i);
  if (!letterMatch) return null;

  const index = 'ABCD'.indexOf(letterMatch[0].toUpperCase());
  return index >= 0 ? index : null;
}

function normalizeQuizOutput(parsed: QuizOutput, count: number): QuizOutput {
  if (!parsed.questions || !Array.isArray(parsed.questions) || parsed.questions.length === 0) {
    throw new Error('Invalid response structure');
  }

  const questions = parsed.questions.slice(0, count).map((question, index) => {
    const options = Array.isArray(question.options)
      ? question.options.map((option) => stripOptionPrefix(String(option))).filter(Boolean)
      : [];
    const answer = normalizeAnswer(question.answer);

    if (!question.question || options.length !== 4 || answer === null || answer < 0 || answer > 3) {
      throw new Error(`Invalid question structure at index ${index + 1}`);
    }

    return {
      id: index + 1,
      question: String(question.question),
      options,
      answer,
      explanation: sanitizeQuizExplanation(question.explanation),
    };
  });

  if (questions.length !== count) {
    throw new Error(`Expected ${count} questions, got ${questions.length}`);
  }

  return {
    subject: parsed.subject,
    topic: parsed.topic,
    difficulty: parsed.difficulty,
    questions,
  };
}

// ── JSON 解析容错层 ────────────────────────────────────────────────

function extractJson(text: string): string {
  // Strategy 1: Extract from markdown code block
  const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) return codeBlockMatch[1].trim();

  // Strategy 2: Find first { and last }
  const firstBrace = text.indexOf('{');
  const lastBrace = text.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    return text.slice(firstBrace, lastBrace + 1).trim();
  }

  return text.trim();
}

function tryRepairJson(text: string): string {
  // Remove common LLM output artifacts
  const cleaned = text
    // Remove trailing commentary after the JSON object
    .replace(/}\s*(?:以上是|以上为|JSON|以上内容为|此致|敬礼|祝)[\s\S]*$/g, '}')
    // Remove BOM or zero-width chars
    .replace(/[﻿​‌‍]/g, '')
    .trim();

  try {
    return jsonrepair(cleaned);
  } catch {
    return cleaned;
  }
}

function parseQuizResponse(rawText: string): QuizOutput {
  // Phase 1: Extract JSON candidate
  const extracted = extractJson(rawText);

  // Phase 2: Try direct parse
  try {
    const parsed = JSON.parse(extracted) as QuizOutput;
    return parsed;
  } catch {
    log.warn('Direct JSON parse failed, attempting repair...');
  }

  // Phase 3: Try repair
  const repaired = tryRepairJson(extracted);
  try {
    const parsed = JSON.parse(repaired) as QuizOutput;
    log.info('JSON repaired successfully');
    return parsed;
  } catch {
    log.warn('jsonrepair failed, attempting manual fix...');
  }

  // Phase 4: Manual fixes for common LLM errors
  let manual = repaired;

  // Fix: Missing comma between array elements (e.g. "}\n  {" → "},\n  {")
  manual = manual.replace(/}(\s*){/g, '},$1{');
  // Fix: Trailing comma before closing bracket
  manual = manual.replace(/,(\s*\])/g, '$1');
  // Fix: Missing comma after closing brace before next property
  manual = manual.replace(/"}(\s*")/g, '"},$1');
  // Fix: Remove newlines inside string values (heuristic)
  // This is aggressive — only run if we know the JSON is broken
  manual = manual.replace(/(\n\s*)/g, ' ').replace(/\s+/g, ' ');

  try {
    const parsed = JSON.parse(manual) as QuizOutput;
    log.info('Manual JSON fix succeeded');
    return parsed;
  } catch (err) {
    log.error('All JSON parse strategies failed. Raw text length:', rawText.length);
    log.error('Raw text first 500 chars:', rawText.slice(0, 500));
    log.error('Last 200 chars:', rawText.slice(-200));
    throw new Error(`Failed to parse AI response: ${(err as Error).message}`);
  }
}

// ── Agent 核心函数 ─────────────────────────────────────────────────

export async function generateQuiz(
  subject: string,
  difficulty: string,
  topic: string,
  count: number,
  profile?: StudentProfile,
): Promise<QuizOutput> {
  const apiKey = resolveApiKey('deepseek');
  const baseUrl = resolveBaseUrl('deepseek') || 'https://api.deepseek.com/v1';

  if (!apiKey) {
    throw new Error('DeepSeek API key is not configured. Set DEEPSEEK_API_KEY in .env.local.');
  }

  const { model } = getModel({
    providerId: 'deepseek',
    modelId: 'deepseek-chat',
    apiKey,
    baseUrl,
  });

  // — RAG: 从知识库检索相关补充内容
  let ragContext = '';
  try {
    const ragResult = await retrieveRelevantContext(topic || `${subject} ${difficulty}`, {
      topK: 3,
      rerank: true,
      maxContextChars: 2000,
    });
    if (ragResult.contextText) {
      ragContext = `\n\n【参考资料（来自知识库）】\n${ragResult.contextText}`;
      log.info(`RAG retrieved ${ragResult.chunks.length} chunks for quiz generation`);
    }
  } catch (ragErr) {
    log.warn('RAG retrieval failed for quiz generation:', ragErr);
  }

  const difficultyLabels: Record<string, string> = {
    easy: '基础',
    medium: '进阶',
    hard: '挑战',
  };

  const subjectLabel = getSubjectLabelOrSelf(subject);
  const difficultyLabel = difficultyLabels[difficulty] || difficulty;

  const profileContext = profile
    ? `\n\n${buildProfileContextPrompt(profile, { maxWeakPoints: 5, maxErrorPatterns: 3 })}`
    : '';

  const cacheKey = buildCloudMindCacheKey('quiz', {
    version: QUIZ_AGENT_PROMPT_VERSION,
    subject,
    difficulty,
    topic,
    count,
    profileContext,
    ragContext,
  });
  const cached = getCloudMindCache<QuizOutput>(cacheKey);
  if (cached) {
    log.info(`[QuizAgent] Cache hit: ${subjectLabel} / ${difficultyLabel} / ${count}`);
    return cached;
  }

  let userPrompt: string;
  if (topic) {
    userPrompt = `请为"${subjectLabel}"学科，关于"${topic}"知识点，生成${count}道${difficultyLabel}难度的选择题。\n\n要求：\n- 学科：${subjectLabel}\n- 知识点：${topic}\n- 难度：${difficultyLabel}\n- 数量：${count}道\n- 每道题4个选项，只有1个正确答案\n- 提供简明解析：每题不超过 ${QUIZ_EXPLANATION_PROMPT_LIMIT_CHARS} 个汉字，最多 3 句${profileContext}${ragContext}`;
  } else {
    userPrompt = `请为"${subjectLabel}"学科，生成${count}道${difficultyLabel}难度的选择题。\n\n要求：\n- 学科：${subjectLabel}\n- 难度：${difficultyLabel}\n- 数量：${count}道\n- 每道题4个选项，只有1个正确答案\n- 提供简明解析：每题不超过 ${QUIZ_EXPLANATION_PROMPT_LIMIT_CHARS} 个汉字，最多 3 句${profileContext}${ragContext}`;
  }

  log.info(
    `[QuizAgent] Generating quiz: ${subjectLabel} / ${difficultyLabel} / ${count} questions, profile injected: ${Boolean(profile)}`,
  );

  const result = await callLLM(
    {
      model,
      system: QUIZ_AGENT_SYSTEM_PROMPT,
      prompt: userPrompt,
      temperature: 0.5,
      maxOutputTokens: Math.min(8192, Math.max(2048, count * 650)),
    },
    'cloud-mind-quiz',
    { retries: 1, timeoutMs: 60_000 },
  );

  const text = result.text || '';
  log.info(`Quiz generation complete, response length: ${text.length}`);

  // 解析 JSON 响应（多层容错策略）
  try {
    const parsed = parseQuizResponse(text);
    const normalized = normalizeQuizOutput(parsed, count);
    setCloudMindCache(cacheKey, normalized);
    return normalized;
  } catch (parseError) {
    log.error('Failed to parse quiz response:', parseError);
    throw new Error(`Failed to parse AI response: ${(parseError as Error).message}`);
  }
}
