/**
 * RAG — 检索器
 *
 * 从向量存储中检索相关内容，支持 LLM 重排序。
 */

import { createOpenAI } from '@ai-sdk/openai';
import { generateText } from 'ai';
import { getVectorStore } from './vector-store';
import { resolveApiKey, resolveBaseUrl } from '@/lib/server/provider-config';
import type { DocumentChunk } from './document-chunker';

export interface RetrievalResult {
  chunks: DocumentChunk[];
  /** 构建好的上下文文本 */
  contextText: string;
  /** 总分块数 */
  totalChunks: number;
  /** 检索耗时 */
  query: string;
}

interface RetrievalOptions {
  /** 返回的最大块数 */
  topK?: number;
  /** 是否使用 LLM 重排序 */
  rerank?: boolean;
  /** 上下文最大字符数 */
  maxContextChars?: number;
}

/**
 * 从知识库中检索相关内容
 */
export async function retrieveRelevantContext(
  query: string,
  options: RetrievalOptions = {},
): Promise<RetrievalResult> {
  const { topK = 5, rerank = true, maxContextChars = 4000 } = options;
  const store = getVectorStore();

  const startTime = Date.now();
  const results = store.search(query, topK);
  const searchTime = Date.now() - startTime;

  if (results.length === 0) {
    return {
      chunks: [],
      contextText: '',
      totalChunks: store.stats().totalChunks,
      query,
    };
  }

  let chunks = results.map((r) => r.chunk);

  // LLM 重排序
  if (rerank && chunks.length > 1) {
    chunks = await llmRerank(query, chunks);
  }

  // 构建上下文文本（限制长度）
  const contextText = buildContextText(chunks, maxContextChars);

  return {
    chunks,
    contextText,
    totalChunks: store.stats().totalChunks,
    query,
  };
}

/**
 * 使用 LLM 对检索结果重排序
 */
async function llmRerank(query: string, chunks: DocumentChunk[]): Promise<DocumentChunk[]> {
  const apiKey = resolveApiKey('deepseek');
  const baseUrl = resolveBaseUrl('deepseek') || 'https://api.deepseek.com/v1';

  if (!apiKey) return chunks; // 无 API key 时跳过重排序

  try {
    const deepseek = createOpenAI({ apiKey, baseURL: baseUrl });

    const numbered = chunks.map((c, i) => `[${i}] ${c.content.slice(0, 300)}`).join('\n---\n');

    const prompt = `请根据以下查询，对文档片段进行相关性排序。只输出排序后的编号（用逗号分隔）。

查询：${query}

文档片段：
${numbered}

请输出按相关性降序排列的编号列表（如：3, 0, 1, 2, 4）：`;

    const result = await generateText({
      model: deepseek.chat('deepseek-chat'),
      prompt,
      temperature: 0,
      maxOutputTokens: 100,
    });

    const text = result.text || '';
    const indices = text.match(/\d+/g)?.map(Number) ?? [];
    const filtered = indices.filter((i) => i >= 0 && i < chunks.length);

    if (filtered.length > 0) {
      // 保持顺序但只保留排序后的
      return filtered.map((i) => chunks[i]);
    }
  } catch {
    // 重排序失败，返回原始排序
  }

  return chunks;
}

/**
 * 从 chunks 构建上下文文本
 */
function buildContextText(chunks: DocumentChunk[], maxChars: number): string {
  const parts: string[] = [];
  let total = 0;

  for (const chunk of chunks) {
    const header = `【${chunk.metadata.docTitle} - 第${chunk.metadata.chunkIndex + 1}块】\n`;
    const body = chunk.content;
    const entry = header + body + '\n\n';

    if (total + entry.length > maxChars) {
      // 截断最后一个块
      const remaining = maxChars - total - header.length;
      if (remaining > 50) {
        parts.push(header + body.slice(0, remaining) + '…');
      }
      break;
    }

    parts.push(entry);
    total += entry.length;
  }

  return parts.join('');
}
