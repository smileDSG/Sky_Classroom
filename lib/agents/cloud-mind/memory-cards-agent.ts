/**
 * 云端智囊 — 记忆卡片 Agent
 *
 * 根据用户提供的知识点/学习内容，
 * 使用 AI 生成高效的记忆卡片（问答对 + 助记技巧）。
 */

import { createLogger } from '@/lib/logger';
import { callLLM, streamLLM } from '@/lib/ai/llm';
import { getModel } from '@/lib/ai/providers';
import { resolveApiKey, resolveBaseUrl } from '@/lib/server/provider-config';
import { retrieveRelevantContext } from '@/lib/agents/rag/retriever';
import { buildProfileContextPrompt } from '@/lib/student/profile-prompts';
import type { StudentProfile } from '@/lib/student/profile-types';
import {
  buildCloudMindCacheKey,
  getCloudMindCache,
  setCloudMindCache,
} from '@/lib/agents/cloud-mind/cache';

const log = createLogger('MemoryCardsAgent');

export const MEMORY_CARDS_AGENT_PROMPT_VERSION = 'v3-student-facing';

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
- **公式规范（高优先级）**：整条数学式子必须被一对美元符号包裹，例如 「(-1)^2 - 1 = 0 \neq 4」应写为「$(-1)^2 - 1 = 0 \neq 4$」。不得把 \neq、\frac 等命令裸写在外面。指数一律用 ^，下标用 _，不要使用 Unicode 上标/下标（如用 x^2 而非 x²）

## 内容可读性（面向学生）
- 卡片是给**学生复习时读懂**的，不是给 AI 看的诊断报告
- 答案（back）用第二人称向学生解释「应当记住什么、如何判断」，避免根因分析、错误模式这类内部口吻
- 纠错类卡片：正面清楚写出要避免的错误，背面用一句能看懂的话说明正确做法
- 步骤或结论要够具体，能脱离原输入独立读懂，不要让用户不知道卡片在干什么

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

## 学情感知
- 如果调用方提供了学生学情上下文，请优先为薄弱知识点生成卡片
- 针对高频错误模式设计纠错型卡片（正面写常见错误，背面写正确理解和避免方法）
- 根据薄弱知识点的掌握度分布调整卡片难度：掌握度越低，卡片越基础、助记技巧越丰富
- 复习间隔和卡片数量由学情上下文决定，不要自行套用固定值

## 卡片数量原则
- 确保每张卡片都有价值，不要为了凑数添加无用卡片
- 薄弱知识点较多时适当增加卡片，已掌握知识点可减少或跳过

<!-- prompt-version: ${MEMORY_CARDS_AGENT_PROMPT_VERSION} -->`;

// ── Agent 核心函数 ─────────────────────────────────────────────────

export async function generateMemoryCards(
  contentText: string,
  topic?: string,
  cardCount?: number,
  profileOrProjection?: StudentProfile | string,
): Promise<MemoryCardDeck> {
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
      const contextParts = kbResults.map((r) => `【${r.chunk.docTitle}】\n${r.chunk.content}`);
      ragContext = `\n\n【参考卡片（来自已有卡片库）】\n${contextParts.join('\n---\n')}`;
      log.info(`Cards KB retrieved ${kbResults.length} chunks`);
    } else {
      // 2) Fall back to general RAG
      const ragResult = await retrieveRelevantContext(query, {
        topK: 3,
        rerank: true,
        maxContextChars: 2000,
      });
      if (ragResult.contextText) {
        ragContext = `\n\n【补充参考资料（来自知识库）】\n${ragResult.contextText}`;
        log.info(`RAG retrieved ${ragResult.chunks.length} chunks for memory cards`);
      }
    }
  } catch (ragErr) {
    log.warn('RAG retrieval failed for memory cards:', ragErr);
  }

  const profileContext =
    typeof profileOrProjection === 'string'
      ? `\n\n${profileOrProjection}`
      : profileOrProjection
        ? `\n\n${buildProfileContextPrompt(profileOrProjection, { maxWeakPoints: 5, maxErrorPatterns: 3 })}`
        : '';

  const cacheKey = buildCloudMindCacheKey('memory-cards', {
    version: MEMORY_CARDS_AGENT_PROMPT_VERSION,
    contentText,
    topic,
    cardCount,
    profileContext,
    ragContext,
  });
  const cached = getCloudMindCache<MemoryCardDeck>(cacheKey);
  if (cached) {
    log.info(`Memory cards cache hit, topic: ${topic || 'auto-detect'}`);
    return cached;
  }

  let userPrompt: string;
  if (topic) {
    userPrompt = `请根据以下关于"${topic}"的内容，制作${cardCount ? `恰好${cardCount}张（不要多也不要少）` : ''}记忆卡片：\n\n${contentText}${profileContext}${ragContext}`;
  } else {
    userPrompt = `请根据以下内容，制作${cardCount ? `恰好${cardCount}张（不要多也不要少）` : ''}记忆卡片：\n\n${contentText}${profileContext}${ragContext}`;
  }

  log.info(
    `Generating memory cards, topic: ${topic || 'auto-detect'}, content length: ${contentText.length}, profile injected: ${Boolean(profileOrProjection)}`,
  );

  const result = await callLLM(
    {
      model,
      system: MEMORY_CARDS_AGENT_SYSTEM_PROMPT,
      prompt: userPrompt,
      temperature: 0.7,
      maxOutputTokens: cardCount ? Math.min(8192, Math.max(2048, cardCount * 520)) : 4096,
    },
    'cloud-mind-memory-cards',
    { retries: 1, timeoutMs: 60_000 },
  );

  const text = result.text || '';
  log.info(`Memory cards generation complete, response length: ${text.length}`);

  const parsed = parseMemoryCardsDeck(text);
  if (!parsed) {
    log.error('Failed to parse memory cards response');
    throw new Error('Failed to parse AI response');
  }

  const limited = limitDeckCards(parsed, cardCount);
  setCloudMindCache(cacheKey, limited);
  return limited;
}

/**
 * 无论 AI 生成多少张，都严格裁剪到用户期望的卡片数量。
 * 避免"选了 6 张却展示 21 张"的不一致体验。
 */
export function limitDeckCards(deck: MemoryCardDeck, cardCount?: number): MemoryCardDeck {
  if (!cardCount || cardCount <= 0 || deck.cards.length <= cardCount) return deck;
  return { ...deck, cards: deck.cards.slice(0, cardCount) };
}

// ── 流式生成 ─────────────────────────────────────────────────────────

export type MemoryCardsStreamEvent =
  | { type: 'cards'; cards: MemoryCardDeck['cards'] }
  | { type: 'done'; deck: MemoryCardDeck; partial?: boolean }
  | { type: 'error'; message: string };

export function parseMemoryCardsDeck(text: string): MemoryCardDeck | null {
  const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, text];
  const jsonStr = (jsonMatch[1] || text).trim();
  try {
    const parsed = JSON.parse(jsonStr) as MemoryCardDeck;
    if (!parsed.topic || !parsed.cards || !Array.isArray(parsed.cards)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function findBalancedObjectEnd(text: string, start: number): number {
  let depth = 0;
  let inString = false;
  for (let i = start; i < text.length; i += 1) {
    const ch = text[i];
    if (inString) {
      if (ch === '\\') {
        i += 1;
        continue;
      }
      if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === '{') depth += 1;
    else if (ch === '}') {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/**
 * 从增量文本中提取"已完成"的卡片对象（用于流式渲染）。
 * 只扫描 `"cards": [` 数组开头的完整对象，未闭合/半截对象留在缓冲区等待下一块。
 */
export function extractCompleteCardsFromBuffer(buffer: string): MemoryCardDeck['cards'] {
  const markerMatch = /"cards"\s*:/.exec(buffer);
  if (!markerMatch) return [];
  const arrayStart = buffer.indexOf('[', markerMatch.index);
  if (arrayStart === -1) return [];

  const cards: MemoryCardDeck['cards'] = [];
  let pos = arrayStart + 1;
  for (;;) {
    while (pos < buffer.length && /[\s,]/.test(buffer[pos])) pos += 1;
    if (pos >= buffer.length || buffer[pos] !== '{') break;
    const end = findBalancedObjectEnd(buffer, pos);
    if (end === -1) break;
    try {
      const card = JSON.parse(buffer.slice(pos, end + 1)) as MemoryCardDeck['cards'][number];
      if (
        card &&
        typeof card === 'object' &&
        typeof card.front === 'string' &&
        typeof card.back === 'string'
      ) {
        cards.push(card);
        pos = end + 1;
        continue;
      }
    } catch {
      /* 半截/畸形对象——停止扫描，等待后续分块 */
    }
    break;
  }
  return cards;
}

function buildPartialMemoryDeck(cards: MemoryCardDeck['cards'], topic?: string): MemoryCardDeck {
  return {
    topic: topic || '记忆卡片',
    description: '',
    cards,
    studyTips: '',
    reviewIntervals: [],
  };
}

export interface StreamMemoryCardsInput {
  contentText: string;
  topic?: string;
  cardCount?: number;
  profileOrProjection?: StudentProfile | string;
  abortSignal?: AbortSignal;
}

/**
 * 流式生成记忆卡片：边生成边产出已完成卡片，最后产出完整卡组。
 * 中断/解析失败时已产出的卡片不丢（partial deck），失败可重试而非整副失败。
 */
export async function* streamMemoryCardsDeck(
  input: StreamMemoryCardsInput,
): AsyncGenerator<MemoryCardsStreamEvent> {
  const { contentText, topic, cardCount, profileOrProjection, abortSignal } = input;

  const apiKey = resolveApiKey('deepseek');
  const baseUrl = resolveBaseUrl('deepseek') || 'https://api.deepseek.com/v1';

  if (!apiKey) {
    yield {
      type: 'error',
      message: 'DeepSeek API key is not configured. Set DEEPSEEK_API_KEY in .env.local.',
    };
    return;
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
    const query = topic || contentText.slice(0, 200);
    const { search } = await import('@/lib/knowledge-base/kb-manager');
    const kbResults = await search({
      kbType: 'cards',
      query,
      topK: 3,
      threshold: 0.05,
      verifiedOnly: true,
    });

    if (kbResults.length > 0) {
      const contextParts = kbResults.map((r) => `【${r.chunk.docTitle}】\n${r.chunk.content}`);
      ragContext = `\n\n【参考卡片（来自已有卡片库）】\n${contextParts.join('\n---\n')}`;
      log.info(`Cards KB retrieved ${kbResults.length} chunks`);
    } else {
      const ragResult = await retrieveRelevantContext(query, {
        topK: 3,
        rerank: true,
        maxContextChars: 2000,
      });
      if (ragResult.contextText) {
        ragContext = `\n\n【补充参考资料（来自知识库）】\n${ragResult.contextText}`;
        log.info(`RAG retrieved ${ragResult.chunks.length} chunks for memory cards`);
      }
    }
  } catch (ragErr) {
    log.warn('RAG retrieval failed for memory cards:', ragErr);
  }

  const profileContext =
    typeof profileOrProjection === 'string'
      ? `\n\n${profileOrProjection}`
      : profileOrProjection
        ? `\n\n${buildProfileContextPrompt(profileOrProjection, { maxWeakPoints: 5, maxErrorPatterns: 3 })}`
        : '';

  const cacheKey = buildCloudMindCacheKey('memory-cards', {
    version: MEMORY_CARDS_AGENT_PROMPT_VERSION,
    contentText,
    topic,
    cardCount,
    profileContext,
    ragContext,
  });
  const cached = getCloudMindCache<MemoryCardDeck>(cacheKey);
  if (cached) {
    log.info(`Memory cards stream cache hit, topic: ${topic || 'auto-detect'}`);
    yield { type: 'done', deck: limitDeckCards(cached, cardCount) };
    return;
  }

  const userPrompt = topic
    ? `请根据以下关于"${topic}"的内容，制作${cardCount ? `恰好${cardCount}张（不要多也不要少）` : ''}记忆卡片：\n\n${contentText}${profileContext}${ragContext}`
    : `请根据以下内容，制作${cardCount ? `恰好${cardCount}张（不要多也不要少）` : ''}记忆卡片：\n\n${contentText}${profileContext}${ragContext}`;

  log.info(
    `Streaming memory cards, topic: ${topic || 'auto-detect'}, content length: ${contentText.length}, profile injected: ${Boolean(profileOrProjection)}`,
  );

  const result = streamLLM(
    {
      model,
      system: MEMORY_CARDS_AGENT_SYSTEM_PROMPT,
      prompt: userPrompt,
      temperature: 0.7,
      maxOutputTokens: cardCount ? Math.min(8192, Math.max(2048, cardCount * 520)) : 4096,
      ...(abortSignal ? { abortSignal } : {}),
    },
    'cloud-mind-memory-cards-stream',
  );

  let buffer = '';
  let emittedCount = 0;
  const limit = cardCount && cardCount > 0 ? cardCount : undefined;
  try {
    for await (const delta of result.textStream) {
      buffer += delta;
      const extracted = extractCompleteCardsFromBuffer(buffer);
      const bounded = limit ? extracted.slice(0, limit) : extracted;
      if (bounded.length > emittedCount) {
        const newCards = bounded.slice(emittedCount);
        emittedCount = bounded.length;
        yield { type: 'cards', cards: newCards };
        if (limit && emittedCount >= limit) break;
      }
    }
  } catch (err) {
    log.warn('Memory cards stream interrupted:', err);
    const partialCards = extractCompleteCardsFromBuffer(buffer).slice(0, limit ?? Infinity);

    if (partialCards.length > 0) {
      yield { type: 'done', deck: buildPartialMemoryDeck(partialCards, topic), partial: true };
    } else {
      yield {
        type: 'error',
        message: err instanceof Error ? err.message : '生成中断，请重试',
      };
    }
    return;
  }

  const deck = parseMemoryCardsDeck(buffer);
  if (deck) {
    const limited = limitDeckCards(deck, cardCount);
    setCloudMindCache(cacheKey, limited);
    yield { type: 'done', deck: limited };
    return;
  }

  const partialCards = extractCompleteCardsFromBuffer(buffer).slice(0, limit ?? Infinity);
  if (partialCards.length > 0) {
    log.warn('Memory cards full parse failed, falling back to partial deck');
    yield { type: 'done', deck: buildPartialMemoryDeck(partialCards, topic), partial: true };
  } else {
    yield { type: 'error', message: 'Failed to parse AI response' };
  }
}
