/**
 * Module C — SSE streaming helpers.
 *
 * Reusable utilities for Server-Sent Events responses.
 */
import { createLogger } from '@/lib/logger';

const log = createLogger('SSE');

export interface SSEEvent {
  type: 'text_delta' | 'done' | 'error';
  content?: string;
  message?: string;
}

/** Create an SSE Response from an async iterable of string chunks */
export function streamSSE(chunks: AsyncIterable<string>): Response {
  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();
  const encoder = new TextEncoder();

  (async () => {
    try {
      for await (const chunk of chunks) {
        const event = formatSSE({ type: 'text_delta', content: chunk });
        await writer.write(encoder.encode(event));
      }
      await writer.write(encoder.encode(formatSSE({ type: 'done' })));
      await writer.close();
    } catch (error) {
      log.error('SSE stream error:', error);
      try {
        await writer.write(
          encoder.encode(
            formatSSE({
              type: 'error',
              message: error instanceof Error ? error.message : String(error),
            }),
          ),
        );
        await writer.close();
      } catch {
        /* already closed */
      }
    }
  })();

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}

/** Format an SSE event as a wire-format string */
export function formatSSE(event: SSEEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}
