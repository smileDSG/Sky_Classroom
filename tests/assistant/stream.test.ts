import { describe, it, expect } from 'vitest';
import { formatSSE, streamSSE, type SSEEvent } from '@/lib/assistant/stream';

// ── formatSSE ──────────────────────────────────────────────────────

describe('formatSSE', () => {
  it('formats text_delta event in SSE wire format', () => {
    const result = formatSSE({ type: 'text_delta', content: '你好' });
    expect(result).toBe('data: {"type":"text_delta","content":"你好"}\n\n');
  });

  it('formats done event', () => {
    const result = formatSSE({ type: 'done' });
    expect(result).toContain('"type":"done"');
    expect(result).toMatch(/^data: .+\n\n$/);
  });

  it('formats error event with message', () => {
    const result = formatSSE({ type: 'error', message: 'something broke' });
    expect(result).toContain('"type":"error"');
    expect(result).toContain('something broke');
  });

  it('output is valid JSON in the data field', () => {
    const event: SSEEvent = { type: 'text_delta', content: 'test' };
    const result = formatSSE(event);
    const jsonStr = result.slice(6, result.length - 2); // strip "data: " and "\n\n"
    const parsed = JSON.parse(jsonStr);
    expect(parsed.type).toBe('text_delta');
    expect(parsed.content).toBe('test');
  });
});

// ── streamSSE ──────────────────────────────────────────────────────

async function* makeChunks(items: string[]): AsyncIterable<string> {
  for (const item of items) {
    yield item;
  }
}

async function readSSEBody(response: Response): Promise<string[]> {
  const reader = response.body?.getReader();
  if (!reader) throw new Error('No body');
  const decoder = new TextDecoder();
  const lines: string[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    lines.push(decoder.decode(value));
  }
  return lines;
}

describe('streamSSE', () => {
  it('returns a Response with SSE content-type', () => {
    const response = streamSSE(makeChunks(['hello']));
    expect(response.headers.get('Content-Type')).toBe('text/event-stream');
    expect(response.headers.get('Cache-Control')).toBe('no-cache');
  });

  it('streams text_delta for each chunk', async () => {
    const response = streamSSE(makeChunks(['a', 'b', 'c']));
    const body = await readSSEBody(response);
    const full = body.join('');
    expect(full).toContain('"content":"a"');
    expect(full).toContain('"content":"b"');
    expect(full).toContain('"content":"c"');
  });

  it('emits done event after all chunks', async () => {
    const response = streamSSE(makeChunks(['x']));
    const body = await readSSEBody(response);
    const full = body.join('');
    expect(full).toContain('"type":"done"');
    // done should be after content
    const donePos = full.indexOf('"type":"done"');
    const contentPos = full.indexOf('"type":"text_delta"');
    expect(donePos).toBeGreaterThan(contentPos);
  });

  it('handles empty iterable', async () => {
    const response = streamSSE(makeChunks([]));
    const body = await readSSEBody(response);
    const full = body.join('');
    // Only done event, no text_delta
    expect(full).toContain('"type":"done"');
    expect(full).not.toContain('"type":"text_delta"');
  });

  it('each event line ends with double newline', async () => {
    const response = streamSSE(makeChunks(['hello']));
    const body = await readSSEBody(response);
    for (const chunk of body) {
      if (chunk.length > 0) {
        expect(chunk).toMatch(/\n\n$/);
      }
    }
  });
});
