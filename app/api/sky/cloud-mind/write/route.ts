/**
 * POST /api/sky/cloud-mind/write
 *
 * 智能写作 Agent API
 * 接收主题、类型、字数要求，调用 DeepSeek 流式生成文章。
 */

import { NextRequest } from 'next/server';
import { streamWriting } from '@/lib/agents/cloud-mind/write-agent';
import { createLogger } from '@/lib/logger';

const log = createLogger('API:CloudMindWrite');

export const maxDuration = 120;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { topic, genre, requirements, wordCount } = body as {
      topic: string;
      genre: string;
      requirements?: string;
      wordCount?: string;
    };

    if (!topic || typeof topic !== 'string' || topic.trim().length === 0) {
      return Response.json({ success: false, error: '请输入写作主题' }, { status: 400 });
    }

    if (!genre || typeof genre !== 'string') {
      return Response.json({ success: false, error: '请选择写作类型' }, { status: 400 });
    }

    log.info(`Streaming writing: topic="${topic}", genre=${genre}, wordCount=${wordCount}`);

    const stream = streamWriting(
      topic.trim(),
      genre,
      requirements?.trim() || '',
      wordCount || '800',
    );

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log.error('Writing generation failed:', message);
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}
