/**
 * 云端智囊 — 幻灯片讲解 Agent
 *
 * 接收课件内容（PDF/PPT 提取文本）和主题，
 * 使用 DeepSeek 分析并生成教学讲解内容。
 */

import { generateText } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { createLogger } from '@/lib/logger';
import { resolveApiKey, resolveBaseUrl } from '@/lib/server/provider-config';
import { retrieveRelevantContext } from '@/lib/agents/rag/retriever';

const log = createLogger('SlidesAgent');

// ── 输出结构 ───────────────────────────────────────────────────────

export interface SlidesAnalysisOutput {
  /** 课件核心主题 */
  topic: string;
  /** 课件大纲（各章节标题） */
  outline: Array<{ title: string; keyPoints: string[] }>;
  /** 整体概要说明 */
  overview: string;
  /** 各页讲解脚本 */
  slides: Array<{
    pageIndex: number;
    title: string;
    /** 讲解文字（教师口播脚本） */
    script: string;
    /** 重点标注的知识点 */
    keyConcepts: string[];
    /** 提问互动建议 */
    interactionHints: string[];
    /** 板书要点 */
    boardNotes: string[];
  }>;
  /** 课后总结 */
  summary: string;
  /** 推荐课后练习 */
  practiceQuestions: Array<{ question: string; hint: string }>;
}

// ── System Prompt ──────────────────────────────────────────────────

const SLIDES_AGENT_SYSTEM_PROMPT = `你是一位资深的教学设计师和课件讲解专家。你的任务是根据课件内容，生成专业的课堂教学讲解。

## 你的职责
1. **分析课件结构**：识别课件的核心主题、章节划分、重点难点
2. **生成讲解脚本**：为每一页/每一章编写教师口播讲解词
3. **标注关键概念**：提取每部分的重要知识点
4. **设计互动环节**：为每个章节建议提问或讨论要点
5. **编写板书建议**：给出适合在黑板上书写的内容
6. **提供课后练习**：推荐巩固知识的练习题

## 讲解风格
- 语言亲切自然，适合课堂教学场景
- 循序渐进，由浅入深
- 重点内容适当重复强调
- 多使用"同学们"、"大家注意"等课堂用语
- 善用比喻和生活中的例子帮助理解

## 输出格式要求
请严格按照以下 JSON 格式输出：

{
  "topic": "课件主题",
  "outline": [
    { "title": "章节标题", "keyPoints": ["关键点1", "关键点2"] }
  ],
  "overview": "整体概要（2-3句话概括课件内容）",
  "slides": [
    {
      "pageIndex": 1,
      "title": "本页主题",
      "script": "教师讲解脚本（详细口播文字）",
      "keyConcepts": ["概念1", "概念2"],
      "interactionHints": ["互动建议1", "互动建议2"],
      "boardNotes": ["板书要点1", "板书要点2"]
    }
  ],
  "summary": "课堂总结（回顾重点，强调易错点）",
  "practiceQuestions": [
    { "question": "练习题", "hint": "提示" }
  ]
}

## 注意事项
- 每页讲解脚本约 200-400 字
- 如果课件内容较少，合理扩展但不要编造事实
- 数学公式使用 LaTeX 格式（$...$ 或 $$...$$）
- 确保 JSON 格式正确，可以被直接解析`;

// ── Agent 核心函数 ─────────────────────────────────────────────────

export async function analyzeSlides(
  contentText: string,
  topic?: string,
): Promise<SlidesAnalysisOutput> {
  const apiKey = resolveApiKey('deepseek');
  const baseUrl = resolveBaseUrl('deepseek') || 'https://api.deepseek.com/v1';

  if (!apiKey) {
    throw new Error('DeepSeek API key is not configured. Set DEEPSEEK_API_KEY in .env.local.');
  }

  const deepseek = createOpenAI({ apiKey, baseURL: baseUrl });

  // — RAG: 从知识库检索相关补充资料
  let ragContext = '';
  try {
    const ragResult = await retrieveRelevantContext(
      topic || contentText.slice(0, 200),
      { topK: 3, rerank: true, maxContextChars: 2000 },
    );
    if (ragResult.contextText) {
      ragContext = `\n\n【补充参考资料（来自知识库）】\n${ragResult.contextText}`;
      log.info(`RAG retrieved ${ragResult.chunks.length} chunks for slides analysis`);
    }
  } catch (ragErr) {
    log.warn('RAG retrieval failed for slides analysis:', ragErr);
  }

  const userPrompt = topic
    ? `请分析以下"${topic}"相关的课件内容，生成完整的教学讲解：\n\n${contentText}${ragContext}`
    : `请分析以下课件内容，生成完整的教学讲解：\n\n${contentText}${ragContext}`;

  log.info(`Analyzing slides, topic: ${topic || 'auto-detect'}, content length: ${contentText.length}`);

  const result = await generateText({
    model: deepseek('deepseek-chat'),
    system: SLIDES_AGENT_SYSTEM_PROMPT,
    prompt: userPrompt,
    temperature: 0.7,
    maxOutputTokens: 8192,
  });

  const text = result.text || '';
  log.info(`Slides analysis complete, response length: ${text.length}`);

  // 解析 JSON 响应
  try {
    // 尝试提取 JSON（可能包裹在 ```json ... ``` 中）
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, text];
    const jsonStr = jsonMatch[1] || text;
    const parsed = JSON.parse(jsonStr.trim()) as SlidesAnalysisOutput;

    // 验证必要字段
    if (!parsed.topic || !parsed.slides || !Array.isArray(parsed.slides)) {
      throw new Error('Invalid response structure');
    }

    return parsed;
  } catch (parseError) {
    log.error('Failed to parse slides analysis response:', parseError);
    throw new Error(`Failed to parse AI response: ${(parseError as Error).message}`);
  }
}

/**
 * 流式分析 — 返回 ReadableStream
 */
export async function streamSlidesAnalysis(
  contentText: string,
  topic?: string,
): Promise<ReadableStream> {
  const { streamText } = await import('ai');

  const apiKey = resolveApiKey('deepseek');
  const baseUrl = resolveBaseUrl('deepseek') || 'https://api.deepseek.com/v1';

  if (!apiKey) {
    throw new Error('DeepSeek API key is not configured.');
  }

  const deepseek = createOpenAI({ apiKey, baseURL: baseUrl });

  const userPrompt = topic
    ? `请分析以下"${topic}"相关的课件内容，生成完整的教学讲解：\n\n${contentText}`
    : `请分析以下课件内容，生成完整的教学讲解：\n\n${contentText}`;

  const result = streamText({
    model: deepseek('deepseek-chat'),
    system: SLIDES_AGENT_SYSTEM_PROMPT,
    prompt: userPrompt,
    temperature: 0.7,
    maxOutputTokens: 8192,
  });

  return result.toTextStreamResponse().body!;
}