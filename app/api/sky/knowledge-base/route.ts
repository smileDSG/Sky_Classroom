/**
 * Knowledge Base Management API
 *
 * GET    /api/sky/knowledge-base          — List/search KB entries
 * GET    /api/sky/knowledge-base?stats=1  — Get KB stats
 * DELETE /api/sky/knowledge-base?docId=x  — Delete a document
 * DELETE /api/sky/knowledge-base?type=x   — Clear all entries for a type
 */

import { NextRequest } from 'next/server';
import { createLogger } from '@/lib/logger';
import type { KBType } from '@/lib/knowledge-base/types';

const log = createLogger('API:KnowledgeBase');

const VALID_TYPES: KBType[] = ['solve', 'slides', 'cards', 'classroom'];

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    // Stats mode
    if (searchParams.get('stats') === '1') {
      const { stats } = await import('@/lib/knowledge-base/kb-manager');
      const s = await stats();
      return Response.json({ success: true, data: s });
    }

    // Search mode
    const kbType = searchParams.get('type') as KBType | null;
    const query = searchParams.get('query') || '';
    const topK = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '10')));

    if (kbType && !VALID_TYPES.includes(kbType)) {
      return Response.json({ success: false, error: `Invalid type: ${kbType}` }, { status: 400 });
    }

    const { search } = await import('@/lib/knowledge-base/kb-manager');

    if (kbType) {
      const results = await search({
        kbType,
        query: query || ' ',
        topK,
        threshold: 0,
      });
      return Response.json({
        success: true,
        data: {
          results: results.map((r) => ({
            chunk: {
              id: r.chunk.id,
              docTitle: r.chunk.docTitle,
              content: r.chunk.content.slice(0, 500),
              tags: r.chunk.tags,
              sourceId: r.chunk.sourceId,
              verified: r.chunk.verified,
              usageCount: r.chunk.usageCount,
              createdAt: r.chunk.createdAt,
            },
            score: r.score,
          })),
          total: results.length,
        },
      });
    }

    // No type specified — return stats overview
    const { stats } = await import('@/lib/knowledge-base/kb-manager');
    const s = await stats();
    return Response.json({ success: true, data: s });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log.error('KB GET failed:', message);
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const docId = searchParams.get('docId');
    const kbType = searchParams.get('type') as KBType | null;

    const { removeDocument, clearType } = await import('@/lib/knowledge-base/kb-manager');

    if (docId) {
      await removeDocument(docId);
      return Response.json({ success: true, message: `Document ${docId} removed` });
    }

    if (kbType) {
      if (!VALID_TYPES.includes(kbType)) {
        return Response.json({ success: false, error: `Invalid type: ${kbType}` }, { status: 400 });
      }
      await clearType(kbType);
      return Response.json({ success: true, message: `KB[${kbType}] cleared` });
    }

    return Response.json({ success: false, error: 'Provide docId or type parameter' }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log.error('KB DELETE failed:', message);
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}
