/**
 * GET /api/sky/resource-generation/jobs/[jobId]/stream
 *
 * 学习包工坊生成任务的流式（SSE）接口。边生成边推送进度，最后推送完成结果或错误：
 *   data: {"type":"progress","jobId":"...","step":"...","progress":42,"message":"..."}
 *   data: {"type":"done","jobId":"...","result":{...}}
 *   data: {"type":"error","jobId":"...","message":"..."}
 */
import { NextRequest } from 'next/server';

import { createLogger } from '@/lib/logger';
import { isValidResourceJobId } from '@/lib/server/resource-generation-job-store';
import { streamResourceGenerationJob } from '@/lib/server/resource-generation-stream';

const log = createLogger('API:ResourceGenerationStream');

export const dynamic = 'force-dynamic';
export const maxDuration = 360;

function formatSSEEvent(data: unknown): string {
  return `data: ${JSON.stringify(data)}\n\n`;
}

export async function GET(req: NextRequest, context: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await context.params;

  if (!isValidResourceJobId(jobId)) {
    return Response.json(
      { success: false, error: 'Invalid resource generation job id', jobId },
      { status: 400 },
    );
  }

  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();
  const encoder = new TextEncoder();
  const write = async (data: string) => {
    try {
      await writer.write(encoder.encode(data));
    } catch {
      /* stream closed */
    }
  };

  (async () => {
    try {
      for await (const event of streamResourceGenerationJob(jobId, {
        stageInitial: true,
        abortSignal: req.signal,
      })) {
        await write(formatSSEEvent(event));
        if (event.type === 'done' || event.type === 'error') break;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      log.error(`Resource generation stream failed [jobId=${jobId}]:`, error);
      await write(formatSSEEvent({ type: 'error', jobId, message: `生成中断：${message}` }));
    } finally {
      try {
        await writer.close();
      } catch {
        /* already closed */
      }
    }
  })();

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}
