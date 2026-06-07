/**
 * Knowledge Base Manager
 *
 * Unified interface for writing to and searching from feature-specific knowledge bases.
 * Uses TF-IDF in-memory indexing backed by MySQL persistence.
 */

import { createLogger } from '@/lib/logger';
import { chunkDocument } from '@/lib/agents/rag/document-chunker';
import type { KBType, KBChunk, KBWriteOptions, KBSearchOptions, KBSearchResult, KBStats } from './types';

let _dao: any = null;
async function getDao() {
  if (!_dao) _dao = await import('./kb-dao');
  return _dao as typeof import('./kb-dao');
}

const log = createLogger('KB:Manager');

// ── In-memory TF-IDF index ─────────────────────────────────────────

interface IndexedChunk extends KBChunk {
  tokens: string[];
  tf: Map<string, number>;
}

let _index: Map<KBType, IndexedChunk[]> = new Map();
let _idf: Map<KBType, Map<string, number>> = new Map();
let _loaded = false;
let _loading: Promise<void> | null = null;

/** Ensure the index is loaded from MySQL */
async function ensureLoaded(): Promise<void> {
  if (_loaded) return;
  if (_loading) {
    await _loading;
    return;
  }
  _loading = loadIndex();
  await _loading;
  _loading = null;
}

async function loadIndex(): Promise<void> {
  try {
    const dao = await getDao();
    await dao.ensureTable();
    const types: KBType[] = ['solve', 'slides', 'cards', 'classroom'];
    for (const kbType of types) {
      const chunks = await dao.getChunksByType(kbType);
      if (chunks.length > 0) {
        indexChunks(kbType, chunks);
      }
    }
    _loaded = true;
    log.info(`KB index loaded: ${[..._index.values()].reduce((s, c) => s + c.length, 0)} total chunks`);
  } catch (err) {
    log.error('Failed to load KB index:', err);
    _loaded = true; // don't retry endlessly
  }
}

// ── Tokenization (shared with vector-store) ────────────────────────

function tokenize(text: string): string[] {
  const cleaned = text.toLowerCase().replace(/[^\w一-鿿]/g, ' ');
  const tokens: string[] = [];
  const parts = cleaned.split(/\s+/).filter(Boolean);
  for (const part of parts) {
    if (/^[一-鿿]+$/.test(part)) {
      for (let i = 0; i < part.length; i++) {
        tokens.push(part[i]);
        if (i < part.length - 1) tokens.push(part[i] + part[i + 1]);
      }
    } else {
      tokens.push(part);
    }
  }
  return tokens;
}

function computeTF(tokens: string[]): Map<string, number> {
  const tf = new Map<string, number>();
  for (const t of tokens) tf.set(t, (tf.get(t) || 0) + 1);
  const maxFreq = Math.max(...tf.values(), 1);
  for (const [term, freq] of tf) tf.set(term, freq / maxFreq);
  return tf;
}

function cosineSimilarity(a: Map<string, number>, b: Map<string, number>): number {
  let dot = 0, normA = 0, normB = 0;
  for (const [term, wA] of a) {
    const wB = b.get(term) || 0;
    dot += wA * wB;
    normA += wA * wA;
  }
  for (const wB of b.values()) normB += wB * wB;
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

// ── Index operations ───────────────────────────────────────────────

function indexChunks(kbType: KBType, chunks: KBChunk[]): void {
  const indexed: IndexedChunk[] = chunks.map((c) => {
    const tokens = tokenize(c.content);
    return { ...c, tokens, tf: computeTF(tokens) };
  });

  // Build IDF for this type
  const docCount = indexed.length;
  const df = new Map<string, number>();
  for (const chunk of indexed) {
    const uniqueTerms = new Set(chunk.tokens);
    for (const t of uniqueTerms) df.set(t, (df.get(t) || 0) + 1);
  }

  const idf = new Map<string, number>();
  for (const [term, freq] of df) {
    idf.set(term, Math.log((docCount + 1) / (freq + 1)) + 1);
  }

  // Compute TF-IDF vectors
  for (const chunk of indexed) {
    const vector = new Map<string, number>();
    for (const [term, tfVal] of chunk.tf) {
      const idfVal = idf.get(term) || 1;
      vector.set(term, tfVal * idfVal);
    }
    (chunk as any).vector = vector;
  }

  _index.set(kbType, indexed);
  _idf.set(kbType, idf);
}

function addToIndex(kbType: KBType, chunks: KBChunk[]): void {
  const existing = _index.get(kbType) || [];
  const allChunks = [...existing.map((c) => ({
    ...c,
    tokens: tokenize(c.content),
    tf: computeTF(tokenize(c.content)),
  })), ...chunks.map((c) => ({
    ...c,
    tokens: tokenize(c.content),
    tf: computeTF(tokenize(c.content)),
  }))];

  // Rebuild IDF
  const docCount = allChunks.length;
  const df = new Map<string, number>();
  for (const chunk of allChunks) {
    for (const t of new Set(chunk.tokens)) df.set(t, (df.get(t) || 0) + 1);
  }
  const idf = new Map<string, number>();
  for (const [term, freq] of df) idf.set(term, Math.log((docCount + 1) / (freq + 1)) + 1);

  for (const chunk of allChunks) {
    const vector = new Map<string, number>();
    for (const [term, tfVal] of chunk.tf) vector.set(term, tfVal * (idf.get(term) || 1));
    (chunk as any).vector = vector;
  }

  _index.set(kbType, allChunks as IndexedChunk[]);
  _idf.set(kbType, idf);
}

// ── Public API ─────────────────────────────────────────────────────

/**
 * Write content to a knowledge base.
 * Splits content into chunks, persists to MySQL, and updates the in-memory index.
 */
export async function write(opts: KBWriteOptions): Promise<{ docId: string; chunks: number }> {
  const dao = await getDao();
  await ensureLoaded();

  const docId = `kb-${opts.kbType}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const trimmed = opts.content.slice(0, 100000);
  const rawChunks = chunkDocument(docId, opts.title, trimmed);

  const kbChunks: KBChunk[] = rawChunks.map((c) => ({
    id: c.id,
    kbType: opts.kbType,
    docId,
    docTitle: opts.title,
    chunkIndex: c.metadata.chunkIndex,
    totalChunks: c.metadata.totalChunks,
    content: c.content,
    tags: opts.tags || [],
    sourceId: opts.sourceId || null,
    verified: opts.verified ?? false,
    usageCount: 0,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }));

  await dao.upsertChunks(kbChunks);
  addToIndex(opts.kbType, kbChunks);

  log.info(`KB[${opts.kbType}] wrote "${opts.title}": ${kbChunks.length} chunks`);
  return { docId, chunks: kbChunks.length };
}

/**
 * Search the knowledge base for relevant content.
 */
export async function search(opts: KBSearchOptions): Promise<KBSearchResult[]> {
  const dao = await getDao();
  await ensureLoaded();

  const { kbType, query, topK = 5, threshold = 0.01, verifiedOnly = false } = opts;
  const chunks = _index.get(kbType) || [];

  if (chunks.length === 0) return [];

  const queryTokens = tokenize(query);
  const queryTF = computeTF(queryTokens);
  const idf = _idf.get(kbType) || new Map();

  const queryVector = new Map<string, number>();
  for (const [term, tfVal] of queryTF) {
    queryVector.set(term, tfVal * (idf.get(term) || 1));
  }

  const results: KBSearchResult[] = [];
  for (const chunk of chunks) {
    if (verifiedOnly && !chunk.verified) continue;
    const vector = (chunk as any).vector as Map<string, number>;
    if (!vector) continue;
    const score = cosineSimilarity(queryVector, vector);
    if (score >= threshold) {
      results.push({ chunk: toPublicChunk(chunk), score });
    }
  }

  results.sort((a, b) => b.score - a.score);
  const top = results.slice(0, topK);

  // Increment usage count for matched chunks (fire and forget)
  for (const r of top) {
    dao.incrementUsage(r.chunk.id).catch(() => {});
  }

  return top;
}

/**
 * Verify all chunks from a source (mark as trusted).
 */
export async function verifySource(sourceId: string): Promise<void> {
  const dao = await getDao();
  await dao.verifyBySource(sourceId);
  // Update in-memory index
  for (const [kbType, chunks] of _index) {
    for (const chunk of chunks) {
      if (chunk.sourceId === sourceId) chunk.verified = true;
    }
    _index.set(kbType, chunks);
  }
  log.info(`KB verified source: ${sourceId}`);
}

/**
 * Delete a document from the knowledge base.
 */
export async function removeDocument(docId: string): Promise<void> {
  const dao = await getDao();
  await dao.deleteDocument(docId);
  // Remove from in-memory index
  for (const [kbType, chunks] of _index) {
    _index.set(kbType, chunks.filter((c) => c.docId !== docId));
  }
}

/**
 * Clear all data for a kb_type.
 */
export async function clearType(kbType: KBType): Promise<void> {
  const dao = await getDao();
  await dao.deleteByType(kbType);
  _index.set(kbType, []);
  log.info(`KB[${kbType}] cleared`);
}

/**
 * Get stats for the knowledge base.
 */
export async function stats(): Promise<KBStats> {
  const dao = await getDao();
  await ensureLoaded();
  return dao.getStats();
}

/**
 * Check if a source already exists in the KB.
 */
export async function hasSource(sourceId: string): Promise<boolean> {
  const dao = await getDao();
  return dao.sourceExists(sourceId);
}

// ── Helpers ────────────────────────────────────────────────────────

function toPublicChunk(chunk: IndexedChunk): KBChunk {
  const { tokens, tf, ...rest } = chunk as any;
  return rest;
}
