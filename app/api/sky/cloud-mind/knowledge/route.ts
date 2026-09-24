/**
 * RAG 知识库管理 API
 *
 * POST   /api/sky/cloud-mind/knowledge  — 上传文档
 * GET    /api/sky/cloud-mind/knowledge  — 查询知识库状态
 * DELETE /api/sky/cloud-mind/knowledge  — 清空/删除知识库
 */

import { NextRequest } from 'next/server';
import { chunkDocument } from '@/lib/agents/rag/document-chunker';
import { getVectorStore, resetVectorStore } from '@/lib/agents/rag/vector-store';
import { createLogger } from '@/lib/logger';
import type { KBSearchResult, KBStats, KBType } from '@/lib/knowledge-base/types';
import { requireAdmin } from '@/lib/server/auth/helpers';

const log = createLogger('API:CloudMindKnowledge');

export const maxDuration = 30;

const KB_TYPES: KBType[] = ['solve', 'slides', 'cards', 'classroom'];

const MATERIAL_TYPE_TO_KB_TYPE: Record<string, KBType> = {
  textbook: 'classroom',
  note: 'classroom',
  mistake: 'solve',
  memory: 'cards',
  writing: 'classroom',
  slides: 'slides',
  solve: 'solve',
  cards: 'cards',
  classroom: 'classroom',
};

function normalizeKbType(value: unknown): KBType {
  if (typeof value === 'string' && KB_TYPES.includes(value as KBType)) {
    return value as KBType;
  }
  if (typeof value === 'string' && MATERIAL_TYPE_TO_KB_TYPE[value]) {
    return MATERIAL_TYPE_TO_KB_TYPE[value];
  }
  return 'classroom';
}

function normalizeTags(value: unknown): string[] {
  if (Array.isArray(value))
    return value
      .map(String)
      .map((tag) => tag.trim())
      .filter(Boolean);
  if (typeof value === 'string') {
    return value
      .split(/[,，\s]+/)
      .map((tag) => tag.trim())
      .filter(Boolean);
  }
  return [];
}

async function persistentEnabled(): Promise<boolean> {
  return Boolean(process.env.MYSQL_DATABASE);
}

async function tryPersistentStats(): Promise<KBStats | null> {
  if (!(await persistentEnabled())) return null;
  try {
    const { stats } = await import('@/lib/knowledge-base/kb-manager');
    return await stats();
  } catch (err) {
    log.warn('Persistent KB stats unavailable:', err);
    return null;
  }
}

async function tryPersistentWrite(input: {
  kbType: KBType;
  title: string;
  content: string;
  tags: string[];
  sourceId: string;
}) {
  if (!(await persistentEnabled())) return null;
  try {
    const { write } = await import('@/lib/knowledge-base/kb-manager');
    return await write({
      kbType: input.kbType,
      title: input.title,
      content: input.content,
      tags: input.tags,
      sourceId: input.sourceId,
      verified: true,
    });
  } catch (err) {
    log.warn('Persistent KB write unavailable, falling back to memory:', err);
    return null;
  }
}

async function tryPersistentSearch(query: string, kbType?: KBType): Promise<KBSearchResult[]> {
  if (!(await persistentEnabled())) return [];
  try {
    const { search } = await import('@/lib/knowledge-base/kb-manager');
    const targetTypes = kbType ? [kbType] : KB_TYPES;
    const nested = await Promise.all(
      targetTypes.map((type) =>
        search({ kbType: type, query, topK: 5, threshold: 0.01 }).catch(() => []),
      ),
    );
    return nested
      .flat()
      .sort((a, b) => b.score - a.score)
      .slice(0, 8);
  } catch (err) {
    log.warn('Persistent KB search unavailable:', err);
    return [];
  }
}

async function tryPersistentDelete(docId?: string, kbType?: KBType): Promise<boolean> {
  if (!(await persistentEnabled())) return false;
  try {
    const manager = await import('@/lib/knowledge-base/kb-manager');
    if (docId) {
      await manager.removeDocument(docId);
    } else if (kbType) {
      await manager.clearType(kbType);
    } else {
      await Promise.all(KB_TYPES.map((type) => manager.clearType(type)));
    }
    return true;
  } catch (err) {
    log.warn('Persistent KB delete unavailable:', err);
    return false;
  }
}

/** 上传文档到知识库 */
export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;

  try {
    const body = await req.json();
    const { title, content } = body as { title: string; content: string };

    if (!title || typeof title !== 'string') {
      return Response.json({ error: '文档标题不能为空' }, { status: 400 });
    }
    if (!content || typeof content !== 'string') {
      return Response.json({ error: '文档内容不能为空' }, { status: 400 });
    }

    const docId = `doc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const trimmedContent = content.slice(0, 100000);
    const tags = normalizeTags(body.tags);
    const materialType = typeof body.materialType === 'string' ? body.materialType : 'classroom';
    const kbType = normalizeKbType(body.kbType ?? materialType);
    const chunks = chunkDocument(docId, title, trimmedContent);

    const store = getVectorStore();
    store.addChunks(chunks);
    const persistent = await tryPersistentWrite({
      kbType,
      title,
      content: trimmedContent,
      tags,
      sourceId: docId,
    });

    log.info(
      `Document "${title}" indexed: ${chunks.length} chunks, ${trimmedContent.length} chars, kbType=${kbType}`,
    );

    return Response.json({
      success: true,
      data: {
        docId: persistent?.docId ?? docId,
        volatileDocId: docId,
        title,
        kbType,
        materialType,
        tags,
        chunks: persistent?.chunks ?? chunks.length,
        volatileChunks: chunks.length,
        totalChars: trimmedContent.length,
        stats: store.stats(),
        mode: persistent ? 'persistent+memory-cache' : 'memory',
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log.error('Knowledge upload failed:', message);
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}

/** 查询知识库状态 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const query = url.searchParams.get('q')?.trim() ?? '';
  const typeParam = url.searchParams.get('kbType') || url.searchParams.get('type');
  const kbType = typeParam ? normalizeKbType(typeParam) : undefined;
  const store = getVectorStore();
  const persistentStats = await tryPersistentStats();
  const persistentResults = query ? await tryPersistentSearch(query, kbType) : [];
  const memoryResults = query ? store.search(query, 8) : [];

  return Response.json({
    success: true,
    data: {
      stats: persistentStats,
      volatileStats: store.stats(),
      mode: persistentStats ? 'persistent+memory-cache' : 'memory',
      results: persistentResults.map((result) => ({
        id: result.chunk.id,
        docId: result.chunk.docId,
        title: result.chunk.docTitle,
        content: result.chunk.content,
        kbType: result.chunk.kbType,
        tags: result.chunk.tags,
        score: result.score,
      })),
      volatileResults: memoryResults.map((result) => ({
        id: result.chunk.id,
        docId: result.chunk.metadata.docId,
        title: result.chunk.metadata.docTitle,
        content: result.chunk.content,
        tags: result.chunk.metadata.tags ?? [],
        score: result.score,
      })),
    },
  });
}

/** 清空知识库（或按 docId 删除） */
export async function DELETE(req: NextRequest) {
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;

  const { searchParams } = new URL(req.url);
  const docId = searchParams.get('docId');
  const kbTypeParam = searchParams.get('kbType') || searchParams.get('type');
  const kbType = kbTypeParam ? normalizeKbType(kbTypeParam) : undefined;

  const store = getVectorStore();
  const persistentDeleted = await tryPersistentDelete(docId ?? undefined, kbType);

  if (docId) {
    store.removeDocument(docId);
    return Response.json({
      success: true,
      message: `Document ${docId} removed`,
      persistentDeleted,
      stats: store.stats(),
    });
  }

  resetVectorStore();
  return Response.json({
    success: true,
    message: kbType ? `Knowledge base ${kbType} cleared` : 'Knowledge base cleared',
    persistentDeleted,
  });
}
