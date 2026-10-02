/**
 * Knowledge Base types
 */

export type KBType = 'solve' | 'slides' | 'cards' | 'classroom' | 'course';

export interface KBChunk {
  id: string;
  kbType: KBType;
  docId: string;
  docTitle: string;
  chunkIndex: number;
  totalChunks: number;
  content: string;
  tags: string[];
  sourceId: string | null;
  verified: boolean;
  usageCount: number;
  createdAt: number;
  updatedAt: number;
}

export interface KBWriteOptions {
  kbType: KBType;
  title: string;
  content: string;
  tags?: string[];
  sourceId?: string;
  verified?: boolean;
}

export interface KBSearchOptions {
  kbType: KBType;
  query: string;
  topK?: number;
  threshold?: number;
  verifiedOnly?: boolean;
}

export interface KBSearchResult {
  chunk: KBChunk;
  score: number;
}

export interface KBStats {
  totalChunks: number;
  totalDocuments: number;
  byType: Record<KBType, { chunks: number; documents: number }>;
}
