import { NextRequest } from 'next/server';

import { buildSoftwareCupProgressEvents } from '@/lib/software-cup/demo-service';

export async function GET(_req: NextRequest, context: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await context.params;
  const encoder = new TextEncoder();
  const events = buildSoftwareCupProgressEvents();

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      events.forEach((event, index) => {
        const payload = {
          jobId,
          ...event,
          done: index === events.length - 1,
        };
        controller.enqueue(encoder.encode(`event: progress\ndata: ${JSON.stringify(payload)}\n\n`));
      });
      controller.enqueue(encoder.encode(`event: done\ndata: ${JSON.stringify({ jobId, done: true })}\n\n`));
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}
