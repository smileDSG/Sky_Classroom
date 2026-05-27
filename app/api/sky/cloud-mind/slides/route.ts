/**
 * POST /api/sky/cloud-mind/slides
 *
 * 幻灯片讲解 Agent API
 * 接收课件文本内容，调用 DeepSeek 分析并生成教学讲解。
 */

import { NextRequest } from 'next/server';
import { analyzeSlides, streamSlidesAnalysis } from '@/lib/agents/cloud-mind/slides-agent';
import { createLogger } from '@/lib/logger';

const log = createLogger('API:CloudMindSlides');

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { content, topic, stream } = body as {
      content: string;
      topic?: string;
      stream?: boolean;
    };

    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      return new Response(JSON.stringify({ error: '课件内容不能为空' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 限制内容长度
    const trimmedContent = content.slice(0, 50000);

    if (stream) {
      // 流式响应
      const readableStream = await streamSlidesAnalysis(trimmedContent, topic);
      return new Response(readableStream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      });
    }

    // 非流式响应
    const result = await analyzeSlides(trimmedContent, topic);
    return new Response(JSON.stringify({ success: true, data: result }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log.error('Slides analysis failed:', message);
    return new Response(JSON.stringify({ success: false, error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}