import { NextRequest } from 'next/server';
import { getTeachingEvents } from '@/lib/server/teaching-job-runner';
import { createLogger } from '@/lib/logger';

const log = createLogger('TeachingStreamSSE');

/**
 * GET /api/sky/teaching/[jobId]/stream
 *
 * SSE endpoint for streaming teaching job progress.
 * Emits events as each section completes.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> },
) {
  const { jobId } = await params;
  log.info(`SSE connection opened for job ${jobId}`);

  const events = getTeachingEvents();
  const eventName = `job:${jobId}`;

  // Create SSE stream
  const stream = new ReadableStream({
    start(controller) {
      // Send initial connection event
      controller.enqueue(`data: ${JSON.stringify({ type: 'connected', jobId })}\n\n`);

      // Heartbeat interval (every 15s)
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(':heartbeat\n\n');
        } catch {
          // Connection closed
          clearInterval(heartbeat);
        }
      }, 15000);

      // Listen for section completion events
      const onSectionDone = (data: Record<string, unknown>) => {
        try {
          controller.enqueue(`data: ${JSON.stringify(data)}\n\n`);
        } catch {
          // Connection closed, cleanup
          events.removeListener(eventName, onSectionDone);
          clearInterval(heartbeat);
        }
      };

      events.on(eventName, onSectionDone);

      // Cleanup on close
      request.signal.addEventListener('abort', () => {
        log.info(`SSE connection closed for job ${jobId}`);
        events.removeListener(eventName, onSectionDone);
        clearInterval(heartbeat);
        try {
          controller.close();
        } catch {
          // Already closed
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
