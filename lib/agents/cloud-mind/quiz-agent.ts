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
import { retrieveCourseStudioContext } from '@/lib/server/resource-generation-kb';
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
import { quizOutputSchema, type QuizQuestionType, type RawQuizOutput } from './quiz-schema';

const log = createLogger('QuizAgent');

export const QUIZ_AGENT_PROMPT_VERSION = 'v5-multi-type';

export type { QuizQuestionType };

// ── 输出结构 ───────────────────────────────────────────────────────

export interface QuizQuestion {
  id: number;
  questionType: QuizQuestionType;
  question: string;
  /** choice: 4 个选项；judge: ['正确','错误']；fill: [] */
  options: string[];
  /** choice: 正确选项索引；judge: 0=正确 1=错误；fill: 恒 0（由用户自评对错） */
  answer: number;
  /** choice: 正确选项文本；judge: '正确'/'错误'；fill: 标准答案文本 */
  answerText: string;
  explanation: string;
}

export interface QuizOutput {
  subject: string;
  topic: string;
  difficulty: string;
  questions: QuizQuestion[];
}

const QUESTION_TYPE_LABELS: Record<QuizQuestionType, string> = {
  choice: '选择题',
  fill: '填空题',
  judge: '判断题',
};

// ── System Prompt ──────────────────────────────────────────────────

function buildQuizSystemPrompt(questionType: QuizQuestionType): string {
  const typeName = QUESTION_TYPE_LABELS[questionType];
  const typeRules =
    questionType === 'choice'
      ? `## 题型：选择题
- 每道题提供恰好 4 个选项，只有 1 个正确答案
- "options": ["选项1", "选项2", "选项3", "选项4"]，只写选项内容，不要加 A/B/C/D 前缀
- "answer": 正确选项的索引（0=A, 1=B, 2=C, 3=D）`
      : questionType === 'fill'
        ? `## 题型：填空题
- 题干中留空的位置使用 ____ 或 ( ) 表示
- "options": 不输出（省略该字段）
- "answer": 标准答案文本（可包含多个可接受答案，用“或”连接，如 "光合作用"）
- 答案必须是确定的短文本，不要使用选择题索引`
        : `## 题型：判断题
- "options": 不输出（省略该字段）
- "answer": 只能是 "正确" 或 "错误" 两个值之一
- 判断必须有明确依据，避免模棱两可的表述`;

  return `你是一位资深的教育出题专家，擅长根据学科、难度和知识点设计高质量的${typeName}。

## 你的职责
1. **精准出题**：根据指定学科和知识点，设计有区分度的${typeName}
2. **难度把控**：严格控制题目难度符合要求
3. **简明解析**：每道题提供短、准、能直接帮助订正的解析

## 主题约束
- 如果用户提供了“知识点/主题”，每一道题都必须直接考查该主题，不要泛化成同学科随机题
- 题干、选项或解析中至少有一处能清楚看出与指定主题相关
- 参考资料和学情上下文只能用于补充，不得替换或偏离用户指定主题

## 难度标准
- 基础（easy）：考查基本概念和公式记忆，直接应用
- 进阶（medium）：需要理解和简单推理，涉及知识的综合运用
- 挑战（hard）：需要深入分析和多步推理，有思维陷阱

## 学情感知
- 如果调用方提供了学生学情上下文，请优先针对薄弱知识点出题
- 已掌握知识点可降低权重或作为复习巩固题

${typeRules}

## 输出格式要求
请严格按照以下 JSON 格式输出（每道题的 "type" 必须为 "${questionType}"）：

{
  "subject": "学科名称",
  "topic": "知识点",
  "difficulty": "难度等级",
  "questions": [
    {
      "id": 1,
      "type": "${questionType}",
      "question": "题目内容",
      "options": ${questionType === 'choice' ? '["选项1", "选项2", "选项3", "选项4"]' : '省略'},
      "answer": ${questionType === 'choice' ? '0' : questionType === 'judge' ? '"正确"' : '"标准答案"'},
      "explanation": "一句到三句短解析，指出关键条件、核心步骤和正确答案依据"
    }
  ]
}

## 注意事项
- 只输出 JSON，不要输出 Markdown 代码块或额外说明
- questions 数组长度必须等于用户要求的题目数量
- 解析必须简短：不超过 ${QUIZ_EXPLANATION_PROMPT_LIMIT_CHARS} 个汉字，最多 3 句
- 解析只写最终正确思路，不展示试错、自我纠错、反复验算或“可能/也许/我理解错了”等不确定表达
- 生成 JSON 前请私下核对：题目、答案和解析必须一致；若不一致，先改题目或答案，不要在解析中说明矛盾
- 确保 JSON 格式正确，可以被直接解析
- 字符串中禁止出现未转义的换行符，所有换行必须使用 \\n 表示
- 字符串中禁止出现未转义的双引号，必须使用 \\" 转义
- 数学公式必须使用 LaTeX 格式：行内公式用 $...$ 包裹，独立公式用 $$...$$ 包裹
  例如二次函数顶点写成 $y = a(x - h)^2 + k$
  分数写成 $\\frac{1}{2}$，积分写成 $\\int_{0}^{1} f(x) dx$
  在 JSON 字符串中，LaTeX 命令的反斜杠必须写成双反斜杠，例如：
  "question": "在 $\\\\triangle ABC$ 中，$\\\\angle A=50^\\\\circ$，$\\\\angle B=60^\\\\circ$，求 $\\\\angle C$。"
  禁止写成 "\\triangle"、"\\angle"、"\\circ"，否则 JSON 会把反斜杠当成转义字符导致显示为 riangle/angle/circ
  禁止使用 Unicode 数学符号（如 × ÷ ² ³ α β），必须使用 LaTeX 命令（如 \\times \\div \\alpha \\beta）

<!-- prompt-version: ${QUIZ_AGENT_PROMPT_VERSION} -->`;
}

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

export function restoreConsumedLatexEscapes(text: string): string {
  return text
    .replace(/\triangle\b/g, '\\triangle')
    .replace(/\t\s*riangle/g, '\\triangle')
    .replace(/(?<!\\)\briangle\s*([A-Z]{2,3})\b/g, '\\triangle $1')
    .replace(/(?<!\\)\btriangle\s*([A-Z]{2,3})\b/g, '\\triangle $1')
    .replace(/(?<!\\)\bangle\s*([A-Z])\b/g, '\\angle $1')
    .replace(/(?<!\\)\^?\s*circ\b/g, '^\\circ')
    .replace(/(?<!\\)\bfrac\s*\{/g, '\\frac{')
    .replace(/(?<!\\)\bsqrt\s*\{/g, '\\sqrt{');
}

function normalizeJudgeAnswer(answer: string): 0 | 1 {
  const normalized = answer.trim().toLowerCase();
  if (/^(正确|对|是|yes|true|1|√|t)$/i.test(normalized) || normalized === '正确') return 0;
  if (/^(错误|错|否|no|false|0|×|f)$/i.test(normalized)) return 1;
  throw new Error(`Invalid judge answer: ${answer}`);
}

export function normalizeQuizOutput(parsed: RawQuizOutput, count: number): QuizOutput {
  if (!parsed.questions || parsed.questions.length === 0) {
    throw new Error('Invalid response structure');
  }

  const questions = parsed.questions.slice(0, count).map((question, index) => {
    const questionText = String(question.question ?? '').trim();
    const explanation = sanitizeQuizExplanation(restoreConsumedLatexEscapes(question.explanation));

    if (question.type === 'fill') {
      const answerText = String(question.answer ?? '').trim();
      if (!questionText || !answerText) {
        throw new Error(`Invalid fill question at index ${index + 1}`);
      }
      return {
        id: index + 1,
        questionType: 'fill' as const,
        question: restoreConsumedLatexEscapes(questionText),
        options: [],
        answer: 0,
        answerText: restoreConsumedLatexEscapes(answerText),
        explanation,
      };
    }

    if (question.type === 'judge') {
      if (!questionText) {
        throw new Error(`Invalid judge question at index ${index + 1}`);
      }
      const answer = normalizeJudgeAnswer(String(question.answer ?? ''));
      return {
        id: index + 1,
        questionType: 'judge' as const,
        question: restoreConsumedLatexEscapes(questionText),
        options: ['正确', '错误'],
        answer,
        answerText: answer === 0 ? '正确' : '错误',
        explanation,
      };
    }

    const options = Array.isArray(question.options)
      ? question.options.map((option) => stripOptionPrefix(String(option))).filter(Boolean)
      : [];
    const answer = normalizeAnswer(question.answer);

    if (!questionText || options.length !== 4 || answer === null || answer < 0 || answer > 3) {
      throw new Error(`Invalid question structure at index ${index + 1}`);
    }

    return {
      id: index + 1,
      questionType: 'choice' as const,
      question: restoreConsumedLatexEscapes(questionText),
      options: options.map(restoreConsumedLatexEscapes),
      answer,
      answerText: restoreConsumedLatexEscapes(options[answer]),
      explanation,
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

export function buildQuizUserPrompt(input: {
  subjectLabel: string;
  difficultyLabel: string;
  topic: string;
  count: number;
  questionType?: QuizQuestionType;
  profileContext?: string;
  ragContext?: string;
}): string {
  const topic = input.topic.trim();
  const profileContext = input.profileContext ?? '';
  const ragContext = input.ragContext ?? '';
  const questionType = input.questionType ?? 'choice';
  const typeName = QUESTION_TYPE_LABELS[questionType];

  const typeRequirements =
    questionType === 'choice'
      ? '- 每道题4个选项，只有1个正确答案，answer 为正确选项的索引（0=A, 1=B, 2=C, 3=D）'
      : questionType === 'fill'
        ? '- 填空题：题干中留空的位置使用 ____ 或 ( ) 表示；answer 为标准答案文本'
        : '- 判断题：answer 只能是 "正确" 或 "错误" 两个值之一';

  const commonRequirements = [
    `- 学科：${input.subjectLabel}`,
    topic ? `- 指定主题/知识点：${topic}` : '',
    `- 难度：${input.difficultyLabel}`,
    `- 数量：${input.count}道`,
    `- 每道题的 "type" 字段必须为 "${questionType}"`,
    typeRequirements,
    `- 提供简明解析：每题不超过 ${QUIZ_EXPLANATION_PROMPT_LIMIT_CHARS} 个汉字，最多 3 句`,
    '- JSON 字符串里的 LaTeX 反斜杠必须写成双反斜杠，例如 $\\\\triangle ABC$、$\\\\angle A=50^\\\\circ$，不要写成 $\\triangle ABC$',
  ]
    .filter(Boolean)
    .join('\n');

  const topicRequirements = topic
    ? `\n\n主题命中要求：\n- questions 中的每一道题都必须围绕“${topic}”出题\n- 不要生成与“${topic}”无关的泛化题、随机题或其他章节题\n- JSON 顶层 topic 字段必须写为“${topic}”`
    : '\n\n主题命中要求：\n- 请先为本次测验选定一个清晰的核心考点，并让所有题目围绕该考点展开\n- JSON 顶层 topic 字段必须写出该核心考点';

  const opening = topic
    ? `请为“${input.subjectLabel}”学科，围绕“${topic}”知识点，生成${input.count}道${input.difficultyLabel}难度的${typeName}。`
    : `请为“${input.subjectLabel}”学科，生成${input.count}道${input.difficultyLabel}难度的${typeName}。`;

  return `${opening}\n\n要求：\n${commonRequirements}${topicRequirements}${profileContext}${ragContext}`;
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

function parseQuizResponse(rawText: string): RawQuizOutput {
  // Phase 1: Extract JSON candidate
  const extracted = extractJson(rawText);

  // Phase 2: Try direct parse
  try {
    return JSON.parse(extracted) as RawQuizOutput;
  } catch {
    log.warn('Direct JSON parse failed, attempting repair...');
  }

  // Phase 3: Try repair
  const repaired = tryRepairJson(extracted);
  try {
    const parsed = JSON.parse(repaired) as RawQuizOutput;
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
    const parsed = JSON.parse(manual) as RawQuizOutput;
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

const MAX_QUIZ_PARSE_ATTEMPTS = 2;

export async function generateQuiz(
  subject: string,
  difficulty: string,
  topic: string,
  count: number,
  profile?: StudentProfile,
  questionType: QuizQuestionType = 'choice',
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

  // 补充：合并学习包工坊生成并已入库的个性化讲义/导图等，作为出题素材。
  try {
    const courseContext = await retrieveCourseStudioContext(topic || `${subject} ${difficulty}`, {
      topK: 2,
      maxChars: 1200,
    });
    if (courseContext) {
      ragContext += `\n\n【个性化学习资料（课程资源工坊）】\n${courseContext}`;
    }
  } catch (courseErr) {
    log.warn('Course-studio KB retrieval failed for quiz generation:', courseErr);
  }

  const difficultyLabels: Record<string, string> = {
    easy: '基础',
    medium: '进阶',
    hard: '挑战',
  };

  const subjectLabel = getSubjectLabelOrSelf(subject);
  const difficultyLabel = difficultyLabels[difficulty] || difficulty;
  const typeLabel = QUESTION_TYPE_LABELS[questionType];

  const profileContext = profile
    ? `\n\n${buildProfileContextPrompt(profile, { maxWeakPoints: 5, maxErrorPatterns: 3 })}`
    : '';

  const trimmedTopic = topic.trim();
  const cacheKey = buildCloudMindCacheKey('quiz', {
    version: QUIZ_AGENT_PROMPT_VERSION,
    subject,
    difficulty,
    topic: trimmedTopic,
    count,
    questionType,
    profileContext,
    ragContext,
  });
  const cached = getCloudMindCache<QuizOutput>(cacheKey);
  if (cached) {
    log.info(
      `[QuizAgent] Cache hit: ${subjectLabel} / ${difficultyLabel} / ${typeLabel} / ${count}`,
    );
    return cached;
  }

  const systemPrompt = buildQuizSystemPrompt(questionType);
  const userPrompt = buildQuizUserPrompt({
    subjectLabel,
    difficultyLabel,
    topic: trimmedTopic,
    count,
    questionType,
    profileContext,
    ragContext,
  });

  log.info(
    `[QuizAgent] Generating ${typeLabel}: ${subjectLabel} / ${difficultyLabel} / ${count} questions, profile injected: ${Boolean(profile)}`,
  );

  for (let attempt = 1; attempt <= MAX_QUIZ_PARSE_ATTEMPTS; attempt += 1) {
    const result = await callLLM(
      {
        model,
        system: systemPrompt,
        prompt: userPrompt,
        temperature: 0.5,
        maxOutputTokens: Math.min(8192, Math.max(2048, count * 650)),
      },
      'cloud-mind-quiz',
      { retries: 1, timeoutMs: 60_000 },
    );

    const text = result.text || '';
    log.info(
      `Quiz generation complete (attempt ${attempt}/${MAX_QUIZ_PARSE_ATTEMPTS}), response length: ${text.length}`,
    );

    // 解析 JSON 响应（多层容错）+ Zod schema 校验，结构错误则重试
    try {
      const parsed = parseQuizResponse(text);
      const validated = quizOutputSchema.parse(parsed);
      const normalized = normalizeQuizOutput(validated, count);
      setCloudMindCache(cacheKey, normalized);
      return normalized;
    } catch (parseError) {
      log.warn(
        `Quiz parse/schema validation failed (attempt ${attempt}/${MAX_QUIZ_PARSE_ATTEMPTS}):`,
        parseError,
      );
      if (attempt === MAX_QUIZ_PARSE_ATTEMPTS) {
        throw new Error(`Failed to parse AI response: ${(parseError as Error).message}`);
      }
    }
  }

  throw new Error('Quiz generation failed after all attempts');
}
