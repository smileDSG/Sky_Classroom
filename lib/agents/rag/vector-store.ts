/**
 * RAG — 向量存储（内存版）
 *
 * 基于 BM25/TF-IDF + 余弦相似度的混合检索，
 * 不依赖外部嵌入 API，适合中小规模知识库。
 */

import type { DocumentChunk } from './document-chunker';

interface StoredChunk extends DocumentChunk {
  /** TF-IDF 向量（稀疏表示，term -> weight） */
  vector: Map<string, number>;
  /** 全局词频统计的引用 */
  idfScores: Map<string, number>;
}

interface SearchResult {
  chunk: DocumentChunk;
  score: number;
}

// ── TF-IDF ─────────────────────────────────────────────────────────

/** 分词（简单的中英文混合） */
function tokenize(text: string): string[] {
  // 移除标点，按空白和中文逐字分割
  const cleaned = text.toLowerCase().replace(/[^\w\u4e00-\u9fff]/g, ' ');
  const tokens: string[] = [];
  const parts = cleaned.split(/\s+/).filter(Boolean);

  for (const part of parts) {
    if (/^[\u4e00-\u9fff]+$/.test(part)) {
      // 中文：逐字 + 双字组合
      for (let i = 0; i < part.length; i++) {
        tokens.push(part[i]);
        if (i < part.length - 1) {
          tokens.push(part[i] + part[i + 1]);
        }
      }
    } else {
      // 英文/数字
      tokens.push(part);
    }
  }

  return tokens;
}

function computeTF(tokens: string[]): Map<string, number> {
  const tf = new Map<string, number>();
  for (const token of tokens) {
    tf.set(token, (tf.get(token) || 0) + 1);
  }
  // 归一化
  const maxFreq = Math.max(...tf.values());
  for (const [term, freq] of tf) {
    tf.set(term, freq / maxFreq);
  }
  return tf;
}

// ── 向量存储 ───────────────────────────────────────────────────────

export class VectorStore {
  private chunks: StoredChunk[] = [];
  private idfScores: Map<string, number> = new Map();
  private docCount = 0;

  /** 添加文档（分块 + 索引） */
  addChunks(chunks: DocumentChunk[]): void {
    // 先计算 IDF
    const newTokens: Map<string, Set<string>> = new Map();

    for (const chunk of chunks) {
      const tokens = tokenize(chunk.content);
      for (const t of tokens) {
        if (!newTokens.has(t)) newTokens.set(t, new Set());
        newTokens.get(t)!.add(chunk.id);
      }
    }

    this.docCount += chunks.length;

    // 更新 IDF
    for (const [term, docSet] of newTokens) {
      const existing = this.idfScores.get(term) || 0;
      this.idfScores.set(term, existing + docSet.size);
    }

    // 存储带向量的块
    for (const chunk of chunks) {
      const tokens = tokenize(chunk.content);
      const tf = computeTF(tokens);
      const vector = new Map<string, number>();

      for (const [term, freq] of tf) {
        const df = this.idfScores.get(term) || 1;
        const idf = Math.log((this.docCount + 1) / (df + 1)) + 1;
        vector.set(term, freq * idf);
      }

      this.chunks.push({
        ...chunk,
        vector,
        idfScores: this.idfScores,
      });
    }
  }

  /** 搜索 */
  search(query: string, topK: number = 5): SearchResult[] {
    const queryTokens = tokenize(query);
    const queryTF = computeTF(queryTokens);

    const queryVector = new Map<string, number>();
    for (const [term, freq] of queryTF) {
      const df = this.idfScores.get(term) || 1;
      const idf = Math.log((this.docCount + 1) / (df + 1)) + 1;
      queryVector.set(term, freq * idf);
    }

    // 计算余弦相似度
    const scores: SearchResult[] = this.chunks.map((chunk) => {
      const score = cosineSimilarity(queryVector, chunk.vector);
      return { chunk: stripVector(chunk), score };
    });

    // 带分数的排序
    scores.sort((a, b) => b.score - a.score);

    // 过滤低相关度结果
    return scores.slice(0, topK).filter((s) => s.score > 0.01);
  }

  /** 统计 */
  stats() {
    return {
      totalChunks: this.chunks.length,
      totalDocuments: new Set(this.chunks.map((c) => c.metadata.docId)).size,
      vocabularySize: this.idfScores.size,
    };
  }

  /** 清空 */
  clear(): void {
    this.chunks = [];
    this.idfScores.clear();
    this.docCount = 0;
  }

  /** 按 docId 删除 */
  removeDocument(docId: string): void {
    this.chunks = this.chunks.filter((c) => c.metadata.docId !== docId);
    // 重建 IDF（简化处理）
    this.rebuildIndex();
  }

  private rebuildIndex(): void {
    const allChunks = [...this.chunks];
    this.chunks = [];
    this.idfScores = new Map();
    this.docCount = 0;
    this.addChunks(allChunks);
  }
}

// ── 工具函数 ───────────────────────────────────────────────────────

function cosineSimilarity(a: Map<string, number>, b: Map<string, number>): number {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (const [term, weightA] of a) {
    const weightB = b.get(term) || 0;
    dotProduct += weightA * weightB;
    normA += weightA * weightA;
  }

  for (const weightB of b.values()) {
    normB += weightB * weightB;
  }

  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

function stripVector(chunk: StoredChunk): DocumentChunk {
  return {
    id: chunk.id,
    content: chunk.content,
    metadata: chunk.metadata,
  };
}

// ── 全局单例 ───────────────────────────────────────────────────────

let globalStore: VectorStore | null = null;

export function getVectorStore(): VectorStore {
  if (!globalStore) {
    globalStore = new VectorStore();
  }
  return globalStore;
}

export function resetVectorStore(): void {
  globalStore = new VectorStore();
}
