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

const log = createLogger('API:CloudMindKnowledge');

export const maxDuration = 30;

/** 上传文档到知识库 */
export async function POST(req: NextRequest) {
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
    const chunks = chunkDocument(docId, title, trimmedContent);

    const store = getVectorStore();
    store.addChunks(chunks);

    log.info(`Document "${title}" indexed: ${chunks.length} chunks, ${trimmedContent.length} chars`);

    return Response.json({
      success: true,
      data: {
        docId,
        title,
        chunks: chunks.length,
        totalChars: trimmedContent.length,
        stats: store.stats(),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log.error('Knowledge upload failed:', message);
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}

/** 查询知识库状态 */
export async function GET() {
  const store = getVectorStore();
  return Response.json({
    success: true,
    data: {
      stats: store.stats(),
    },
  });
}

/** 清空知识库（或按 docId 删除） */
export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const docId = searchParams.get('docId');

  const store = getVectorStore();

  if (docId) {
    store.removeDocument(docId);
    return Response.json({ success: true, message: `Document ${docId} removed`, stats: store.stats() });
  }

  resetVectorStore();
  return Response.json({ success: true, message: 'Knowledge base cleared' });
}