import { NextRequest } from 'next/server';

import {
  loadAiIntroCourseIndex,
  searchAiIntroCourse,
} from '@/lib/course-knowledge/ai-intro-loader';

function parseLimit(value: string | null): number {
  const parsed = Number.parseInt(value || '8', 10);
  if (Number.isNaN(parsed)) return 8;
  return Math.min(Math.max(parsed, 1), 30);
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const query = url.searchParams.get('query') || url.searchParams.get('q') || '';
  const limit = parseLimit(url.searchParams.get('limit'));

  if (!query.trim()) {
    const index = await loadAiIntroCourseIndex();
    return Response.json({
      success: true,
      data: {
        courseId: index.courseId,
        title: index.title,
        stats: index.stats,
        results: [],
        message: 'Provide query or q to search the AI Intro course knowledge base.',
      },
    });
  }

  const [index, results] = await Promise.all([
    loadAiIntroCourseIndex(),
    searchAiIntroCourse(query, limit),
  ]);

  return Response.json({
    success: true,
    data: {
      courseId: index.courseId,
      title: index.title,
      query,
      results,
      total: results.length,
    },
  });
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { query?: string; limit?: number };
  const query = body.query || '';
  const limit = Math.min(Math.max(body.limit || 8, 1), 30);

  if (!query.trim()) {
    return Response.json({ success: false, error: 'query is required' }, { status: 400 });
  }

  const [index, results] = await Promise.all([
    loadAiIntroCourseIndex(),
    searchAiIntroCourse(query, limit),
  ]);

  return Response.json({
    success: true,
    data: {
      courseId: index.courseId,
      title: index.title,
      query,
      results,
      total: results.length,
    },
  });
}
