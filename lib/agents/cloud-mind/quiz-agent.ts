/**
 * 云端智囊 — 智能出题 Agent
 *
 * 根据学科、难度、知识点，使用 AI 生成高质量选择题。
 */

import { generateText } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { createLogger } from '@/lib/logger';
import { resolveApiKey, resolveBaseUrl } from '@/lib/server/provider-config';
import { retrieveRelevantContext } from '@/lib/agents/rag/retriever';

const log = createLogger('QuizAgent');

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
4. **详细解析**：每道题提供清晰的解题思路和知识点说明

## 难度标准
- 基础（easy）：考查基本概念和公式记忆，直接应用
- 进阶（medium）：需要理解和简单推理，涉及知识的综合运用
- 挑战（hard）：需要深入分析和多步推理，有思维陷阱

## 学科特点
- 数学：注重计算过程和公式运用
- 物理：注重物理情景理解和公式选择
- 化学：注重反应原理和实验操作
- 生物：注重概念辨析和生理过程
- 语文：注重文学常识和阅读理解
- 英语：注重语法和词汇运用

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
      "options": ["A. 选项1", "B. 选项2", "C. 选项3", "D. 选项4"],
      "answer": 0,
      "explanation": "详细解析，包含解题思路和涉及的知识点"
    }
  ]
}

## 注意事项
- answer 字段为正确选项的索引（0=A, 1=B, 2=C, 3=D）
- 每道题必须有 4 个选项
- 解析要详细，帮助学生理解解题过程
- 确保 JSON 格式正确，可以被直接解析`;

// ── Agent 核心函数 ─────────────────────────────────────────────────

export async function generateQuiz(
  subject: string,
  difficulty: string,
  topic: string,
  count: number,
): Promise<QuizOutput> {
  const apiKey = resolveApiKey('deepseek');
  const baseUrl = resolveBaseUrl('deepseek') || 'https://api.deepseek.com/v1';

  if (!apiKey) {
    throw new Error('DeepSeek API key is not configured. Set DEEPSEEK_API_KEY in .env.local.');
  }

  const deepseek = createOpenAI({ apiKey, baseURL: baseUrl });

  // — RAG: 从知识库检索相关补充内容
  let ragContext = '';
  try {
    const ragResult = await retrieveRelevantContext(
      topic || `${subject} ${difficulty}`,
      { topK: 3, rerank: true, maxContextChars: 2000 },
    );
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

  const subjectLabels: Record<string, string> = {
    math: '数学',
    physics: '物理',
    chemistry: '化学',
    biology: '生物',
    chinese: '语文',
    english: '英语',
  };

  const subjectLabel = subjectLabels[subject] || subject;
  const difficultyLabel = difficultyLabels[difficulty] || difficulty;

  let userPrompt: string;
  if (topic) {
    userPrompt = `请为"${subjectLabel}"学科，关于"${topic}"知识点，生成${count}道${difficultyLabel}难度的选择题。\n\n要求：\n- 学科：${subjectLabel}\n- 知识点：${topic}\n- 难度：${difficultyLabel}\n- 数量：${count}道\n- 每道题4个选项，只有1个正确答案\n- 提供详细解析${ragContext}`;
  } else {
    userPrompt = `请为"${subjectLabel}"学科，生成${count}道${difficultyLabel}难度的选择题。\n\n要求：\n- 学科：${subjectLabel}\n- 难度：${difficultyLabel}\n- 数量：${count}道\n- 每道题4个选项，只有1个正确答案\n- 提供详细解析${ragContext}`;
  }

  log.info(`Generating quiz: ${subjectLabel} / ${difficultyLabel} / ${count} questions`);

  const result = await generateText({
    model: deepseek.chat('deepseek-chat'),
    system: QUIZ_AGENT_SYSTEM_PROMPT,
    prompt: userPrompt,
    temperature: 0.8,
    maxOutputTokens: 8192,
  });

  const text = result.text || '';
  log.info(`Quiz generation complete, response length: ${text.length}`);

  // 解析 JSON 响应
  try {
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, text];
    const jsonStr = jsonMatch[1] || text;
    const parsed = JSON.parse(jsonStr.trim()) as QuizOutput;

    if (!parsed.questions || !Array.isArray(parsed.questions) || parsed.questions.length === 0) {
      throw new Error('Invalid response structure');
    }

    return parsed;
  } catch (parseError) {
    log.error('Failed to parse quiz response:', parseError);
    throw new Error(`Failed to parse AI response: ${(parseError as Error).message}`);
  }
}
