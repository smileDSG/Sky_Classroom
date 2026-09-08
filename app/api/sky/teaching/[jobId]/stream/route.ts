import { NextRequest } from 'next/server';
import { getTeachingEvents } from '@/lib/server/teaching-job-runner';
import { readTeachingJob } from '@/lib/server/teaching-job-store';
import { requireAuth } from '@/lib/server/auth/helpers';
import { apiError } from '@/lib/server/api-response';
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
  const auth = await requireAuth();
  if ('error' in auth) return auth.error;

  const { jobId } = await params;
  const job = await readTeachingJob(jobId);
  if (!job) return apiError('NOT_FOUND', 404, '教案任务不存在');
  if (job.userId !== auth.user.id) return apiError('UNAUTHORIZED', 403, '无权访问此任务');

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
      Connection: 'keep-alive',
    },
  });
}
