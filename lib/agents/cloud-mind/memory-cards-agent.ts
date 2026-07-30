/**
 * 云端智囊 — 记忆卡片 Agent
 *
 * 根据用户提供的知识点/学习内容，
 * 使用 AI 生成高效的记忆卡片（问答对 + 助记技巧）。
 */

import { generateText } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { createLogger } from '@/lib/logger';
import { resolveApiKey, resolveBaseUrl } from '@/lib/server/provider-config';
import { retrieveRelevantContext } from '@/lib/agents/rag/retriever';

const log = createLogger('MemoryCardsAgent');

// ── 输出结构 ───────────────────────────────────────────────────────

export interface MemoryCardDeck {
  /** 卡片集主题 */
  topic: string;
  /** 整体描述 */
  description: string;
  /** 记忆卡片列表 */
  cards: Array<{
    /** 卡片序号 */
    index: number;
    /** 正面：问题/概念 */
    front: string;
    /** 背面：答案/解释 */
    back: string;
    /** 助记技巧（可选） */
    mnemonic?: string;
    /** 关联知识点 */
    relatedConcepts: string[];
    /** 难度等级：easy / medium / hard */
    difficulty: 'easy' | 'medium' | 'hard';
    /** 卡片标签/分类 */
    tags: string[];
  }>;
  /** 学习建议 */
  studyTips: string;
  /** 推荐复习间隔（天数） */
  reviewIntervals: number[];
}

// ── System Prompt ──────────────────────────────────────────────────

const MEMORY_CARDS_AGENT_SYSTEM_PROMPT = `你是一位专业的记忆术专家和闪卡设计师。你擅长将复杂的知识点转化为高效的学习卡片。

## 你的职责
1. **提炼核心概念**：从输入内容中提取最重要的知识点
2. **设计问答卡片**：为每个知识点创建正面（问题）和背面（答案）
3. **提供助记技巧**：为较难的内容创造记忆口诀或联想方法
4. **分类标注难度**：标记每张卡片的难度等级
5. **规划复习节奏**：根据艾宾浩斯遗忘曲线建议复习间隔

## 卡片设计原则
- 正面：简洁的问题或概念名称，引导主动回忆
- 背面：清晰的解释，包含关键信息但不冗长
- 每张卡片聚焦一个知识点
- 使用中文为主，专有名词保留英文
- 数学公式使用 LaTeX 格式（$...$）

## 助记技巧类型
- 口诀/顺口溜
- 联想记忆（将抽象概念与具体形象关联）
- 分类归纳（将相似知识点分组对比）
- 故事串联（用故事将多个知识点串联）
- 图像记忆（描述如何用图像辅助记忆）

## 输出格式要求
请严格按照以下 JSON 格式输出：

{
  "topic": "卡片集主题",
  "description": "这个卡片集涵盖的内容简介",
  "cards": [
    {
      "index": 1,
      "front": "正面问题（引导主动回忆）",
      "back": "背面答案（关键信息 + 解释）",
      "mnemonic": "助记技巧（可选，较难知识点提供）",
      "relatedConcepts": ["关联概念1", "关联概念2"],
      "difficulty": "easy",
      "tags": ["标签1", "标签2"]
    }
  ],
  "studyTips": "学习这段内容的建议，如先理解再记忆、重点攻克哪些卡片等",
  "reviewIntervals": [1, 2, 4, 7, 15]
}

## 卡片数量建议
- 简单主题：5-8 张卡片
- 中等主题：8-15 张卡片
- 复杂主题：15-25 张卡片
- 确保每张卡片都有价值，不要为了凑数添加无用卡片`;

// ── Agent 核心函数 ─────────────────────────────────────────────────

export async function generateMemoryCards(
  contentText: string,
  topic?: string,
  cardCount?: number,
  teachingProjection?: string,
): Promise<MemoryCardDeck> {
  const apiKey = resolveApiKey('deepseek');
  const baseUrl = resolveBaseUrl('deepseek') || 'https://api.deepseek.com/v1';

  if (!apiKey) {
    throw new Error('DeepSeek API key is not configured. Set DEEPSEEK_API_KEY in .env.local.');
  }

  const deepseek = createOpenAI({ apiKey, baseURL: baseUrl });

  // — RAG: 从知识库检索相关补充内容
  let ragContext = '';
  try {
    const query = topic || contentText.slice(0, 200);
    // 1) Search cards-specific KB first
    const { search } = await import('@/lib/knowledge-base/kb-manager');
    const kbResults = await search({
      kbType: 'cards',
      query,
      topK: 3,
      threshold: 0.05,
      verifiedOnly: true,
    });

    if (kbResults.length > 0) {
      const contextParts = kbResults.map((r) =>
        `【${r.chunk.docTitle}】\n${r.chunk.content}`
      );
      ragContext = `\n\n【参考卡片（来自已有卡片库）】\n${contextParts.join('\n---\n')}`;
      log.info(`Cards KB retrieved ${kbResults.length} chunks`);
    } else {
      // 2) Fall back to general RAG
      const ragResult = await retrieveRelevantContext(
        query,
        { topK: 3, rerank: true, maxContextChars: 2000 },
      );
      if (ragResult.contextText) {
        ragContext = `\n\n【补充参考资料（来自知识库）】\n${ragResult.contextText}`;
        log.info(`RAG retrieved ${ragResult.chunks.length} chunks for memory cards`);
      }
    }
  } catch (ragErr) {
    log.warn('RAG retrieval failed for memory cards:', ragErr);
  }

  let userPrompt: string;
  if (topic) {
    userPrompt = `请根据以下关于"${topic}"的内容，制作${cardCount ? `约${cardCount}张` : ''}记忆卡片：\n\n${contentText}${ragContext}`;
  } else {
    userPrompt = `请根据以下内容，制作${cardCount ? `约${cardCount}张` : ''}记忆卡片：\n\n${contentText}${ragContext}`;
  }

  log.info(`Generating memory cards, topic: ${topic || 'auto-detect'}, content length: ${contentText.length}`);

  const systemPrompt = teachingProjection
    ? `${MEMORY_CARDS_AGENT_SYSTEM_PROMPT}\n\n# Learner Profile (authoritative)\n${teachingProjection}\n\n请严格按上述学习者画像调整卡片数量、解释深度、助记技巧和复习节奏。`
    : MEMORY_CARDS_AGENT_SYSTEM_PROMPT;

  const result = await generateText({
    model: deepseek.chat('deepseek-chat'),
    system: systemPrompt,
    prompt: userPrompt,
    temperature: 0.7,
    maxOutputTokens: 8192,
  });

  const text = result.text || '';
  log.info(`Memory cards generation complete, response length: ${text.length}`);

  // 解析 JSON 响应
  try {
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, text];
    const jsonStr = jsonMatch[1] || text;
    const parsed = JSON.parse(jsonStr.trim()) as MemoryCardDeck;

    if (!parsed.topic || !parsed.cards || !Array.isArray(parsed.cards)) {
      throw new Error('Invalid response structure');
    }

    return parsed;
  } catch (parseError) {
    log.error('Failed to parse memory cards response:', parseError);
    throw new Error(`Failed to parse AI response: ${(parseError as Error).message}`);
  }
}