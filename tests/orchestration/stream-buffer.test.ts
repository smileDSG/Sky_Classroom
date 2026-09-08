/**
 * StreamBuffer Tests
 *
 * Tests for the StreamBuffer pacing layer — the component that sits
 * between SSE data sources and React state, revealing text character
 * by character and firing callbacks at the right time.
 */
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { StreamBuffer, type StreamBufferCallbacks } from '@/lib/buffer/stream-buffer';

// ─── Helpers ───

function makeCallbacks(): StreamBufferCallbacks & {
  calls: Record<string, unknown[][]>;
} {
  const calls: Record<string, unknown[][]> = {
    onAgentStart: [],
    onAgentEnd: [],
    onTextReveal: [],
    onActionReady: [],
    onLiveSpeech: [],
    onSpeechProgress: [],
    onThinking: [],
    onCueUser: [],
    onDone: [],
    onError: [],
  };

  return {
    calls,
    onAgentStart: vi.fn((data) => { calls.onAgentStart.push([data]); }),
    onAgentEnd: vi.fn((data) => { calls.onAgentEnd.push([data]); }),
    onTextReveal: vi.fn((...args) => { calls.onTextReveal.push(args); }),
    onActionReady: vi.fn((...args) => { calls.onActionReady.push(args); }),
    onLiveSpeech: vi.fn((...args) => { calls.onLiveSpeech.push(args); }),
    onSpeechProgress: vi.fn((...args) => { calls.onSpeechProgress.push(args); }),
    onThinking: vi.fn((data) => { calls.onThinking.push([data]); }),
    onCueUser: vi.fn((...args) => { calls.onCueUser.push(args); }),
    onDone: vi.fn((data) => { calls.onDone.push([data]); }),
    onError: vi.fn((msg) => { calls.onError.push([msg]); }),
  };
}

// ─── Tests ───

describe('StreamBuffer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('construction', () => {
    test('starts in disposed=false, paused=false state', () => {
      const cb = makeCallbacks();
      const buf = new StreamBuffer(cb);
      expect(buf.disposed).toBe(false);
      expect(buf.paused).toBe(false);
    });
  });

  describe('push methods', () => {
    test('pushAgentStart adds item and seals previous text', () => {
      const cb = makeCallbacks();
      const buf = new StreamBuffer(cb);
      buf.pushText('msg-1', 'Hello', 'agent-1');
      buf.pushAgentStart({ messageId: 'msg-2', agentId: 'agent-2', agentName: 'Teacher' });

      buf.start();
      vi.advanceTimersByTime(200);

      expect(cb.onAgentStart).toHaveBeenCalled();
      buf.shutdown();
    });

    test('pushText appends delta to existing unsealed text', () => {
      const cb = makeCallbacks();
      const buf = new StreamBuffer(cb, { tickMs: 10, charsPerTick: 100 });

      buf.pushText('msg-1', 'Hello ', 'agent-1');
      buf.pushText('msg-1', 'world', 'agent-1');
      buf.sealText('msg-1');
      buf.pushDone({ totalActions: 0, totalAgents: 1 });

      buf.start();
      vi.advanceTimersByTime(200);

      // Should see the full text
      const revealCalls = cb.calls.onTextReveal;
      const lastReveal = revealCalls[revealCalls.length - 1];
      expect(lastReveal?.[2]).toContain('Hello world');
      buf.shutdown();
    });

    test('pushText creates new item for different messageId', () => {
      const cb = makeCallbacks();
      const buf = new StreamBuffer(cb, { tickMs: 10, charsPerTick: 100 });

      buf.pushText('msg-1', 'First', 'agent-1');
      buf.sealText('msg-1');
      buf.pushText('msg-2', 'Second', 'agent-2');
      buf.sealText('msg-2');
      buf.pushDone({ totalActions: 0, totalAgents: 2 });

      buf.start();
      vi.advanceTimersByTime(500);

      // Both texts should be revealed
      const revealCalls = cb.calls.onTextReveal;
      const revealedTexts = revealCalls.map((c) => c[2]);
      expect(revealedTexts.some((t) => String(t).includes('First'))).toBe(true);
      expect(revealedTexts.some((t) => String(t).includes('Second'))).toBe(true);
      buf.shutdown();
    });

    test('pushAction adds action item', () => {
      const cb = makeCallbacks();
      const buf = new StreamBuffer(cb, { tickMs: 10, charsPerTick: 100 });

      buf.pushAction({
        messageId: 'msg-1',
        actionId: 'act-1',
        actionName: 'spotlight',
        params: { elementId: 'img_1' },
        agentId: 'agent-1',
      });
      buf.pushDone({ totalActions: 1, totalAgents: 1 });

      buf.start();
      vi.advanceTimersByTime(200);

      expect(cb.onActionReady).toHaveBeenCalledWith(
        'msg-1',
        expect.objectContaining({ actionName: 'spotlight' }),
      );
      buf.shutdown();
    });

    test('pushThinking fires callback', () => {
      const cb = makeCallbacks();
      const buf = new StreamBuffer(cb, { tickMs: 10, charsPerTick: 100 });

      buf.pushThinking({ stage: 'director', agentId: 'agent-1' });
      buf.pushDone({ totalActions: 0, totalAgents: 0 });

      buf.start();
      vi.advanceTimersByTime(200);

      expect(cb.onThinking).toHaveBeenCalledWith(
        expect.objectContaining({ stage: 'director', agentId: 'agent-1' }),
      );
      buf.shutdown();
    });

    test('pushDone fires onDone and resolves drain', async () => {
      const cb = makeCallbacks();
      const buf = new StreamBuffer(cb, { tickMs: 10, charsPerTick: 100 });

      buf.pushDone({ totalActions: 2, totalAgents: 1, agentHadContent: true });
      buf.start();

      const drainPromise = buf.waitUntilDrained();
      vi.advanceTimersByTime(200);
      await drainPromise;

      expect(cb.onDone).toHaveBeenCalledWith(
        expect.objectContaining({ totalActions: 2, totalAgents: 1 }),
      );
    });

    test('waitUntilDrained resolves when done was consumed before waiting', async () => {
      const cb = makeCallbacks();
      const buf = new StreamBuffer(cb, { tickMs: 10, charsPerTick: 100 });

      buf.pushDone({ totalActions: 0, totalAgents: 1 });
      buf.start();
      vi.advanceTimersByTime(50);

      await expect(buf.waitUntilDrained()).resolves.toBeUndefined();
      expect(cb.onDone).toHaveBeenCalledOnce();
    });

    test('pushCueUser fires onCueUser callback', () => {
      const cb = makeCallbacks();
      const buf = new StreamBuffer(cb, { tickMs: 10, charsPerTick: 100 });

      buf.pushCueUser({ fromAgentId: 'agent-1', prompt: 'What do you think?' });
      buf.pushDone({ totalActions: 0, totalAgents: 0 });

      buf.start();
      vi.advanceTimersByTime(200);

      expect(cb.onCueUser).toHaveBeenCalledWith('agent-1', 'What do you think?');
      buf.shutdown();
    });

    test('pushError fires onError callback', () => {
      const cb = makeCallbacks();
      const buf = new StreamBuffer(cb, { tickMs: 10, charsPerTick: 100 });

      buf.pushError('Something went wrong');
      buf.pushDone({ totalActions: 0, totalAgents: 0 });

      buf.start();
      vi.advanceTimersByTime(200);

      expect(cb.onError).toHaveBeenCalledWith('Something went wrong');
      buf.shutdown();
    });
  });

  describe('pause/resume', () => {
    test('pause stops text reveal', () => {
      const cb = makeCallbacks();
      const buf = new StreamBuffer(cb, { tickMs: 10, charsPerTick: 1 });

      buf.pushText('msg-1', 'Hello world', 'agent-1');
      buf.sealText('msg-1');
      buf.pushDone({ totalActions: 0, totalAgents: 1 });

      buf.start();
      vi.advanceTimersByTime(50); // reveal some chars
      const countBeforePause = cb.calls.onTextReveal.length;

      buf.pause();
      vi.advanceTimersByTime(200); // should not reveal more
      expect(cb.calls.onTextReveal.length).toBe(countBeforePause);

      buf.shutdown();
    });

    test('resume continues text reveal from where it stopped', () => {
      const cb = makeCallbacks();
      const buf = new StreamBuffer(cb, { tickMs: 10, charsPerTick: 1 });

      buf.pushText('msg-1', 'Hello', 'agent-1');
      buf.sealText('msg-1');
      buf.pushDone({ totalActions: 0, totalAgents: 1 });

      buf.start();
      vi.advanceTimersByTime(30);
      const countBeforePause = cb.calls.onTextReveal.length;

      buf.pause();
      vi.advanceTimersByTime(100);
      expect(cb.calls.onTextReveal.length).toBe(countBeforePause);

      buf.resume();
      vi.advanceTimersByTime(200);

      // Should have continued revealing
      expect(cb.calls.onTextReveal.length).toBeGreaterThan(countBeforePause);
      buf.shutdown();
    });
  });

  describe('shutdown', () => {
    test('shutdown stops the tick loop', () => {
      const cb = makeCallbacks();
      const buf = new StreamBuffer(cb, { tickMs: 10, charsPerTick: 1 });

      buf.pushText('msg-1', 'Hello', 'agent-1');
      buf.sealText('msg-1');
      buf.start();

      vi.advanceTimersByTime(30);
      const countBefore = cb.calls.onTextReveal.length;

      buf.shutdown();
      vi.advanceTimersByTime(200);

      // No more reveals after shutdown
      expect(cb.calls.onTextReveal.length).toBe(countBefore);
    });

    test('shutdown rejects pending drain promise', async () => {
      const cb = makeCallbacks();
      const buf = new StreamBuffer(cb, { tickMs: 10 });

      buf.pushText('msg-1', 'Hello', 'agent-1');
      buf.start();

      const drainPromise = buf.waitUntilDrained();
      buf.shutdown();

      vi.advanceTimersByTime(50);
      await expect(drainPromise).rejects.toThrow('shutdown');
    });

    test('push methods are no-ops after shutdown', () => {
      const cb = makeCallbacks();
      const buf = new StreamBuffer(cb);

      buf.shutdown();

      buf.pushText('msg-1', 'Hello', 'agent-1');
      buf.pushAgentStart({ messageId: 'msg-1', agentId: 'a1', agentName: 'A' });
      buf.pushDone({ totalActions: 0, totalAgents: 0 });

      // No callbacks should fire
      expect(cb.onAgentStart).not.toHaveBeenCalled();
    });
  });

  describe('text reveal pacing', () => {
    test('reveals characters one by one with default settings', () => {
      const cb = makeCallbacks();
      const buf = new StreamBuffer(cb, { tickMs: 10, charsPerTick: 1 });

      buf.pushText('msg-1', 'ABC', 'agent-1');
      buf.sealText('msg-1');
      buf.pushDone({ totalActions: 0, totalAgents: 1 });

      buf.start();

      // After 1 tick: 'A'
      vi.advanceTimersByTime(10);
      expect(cb.onTextReveal).toHaveBeenCalledWith('msg-1', expect.any(String), 'A', false);

      // After 2 ticks: 'AB'
      vi.advanceTimersByTime(10);
      expect(cb.onTextReveal).toHaveBeenCalledWith('msg-1', expect.any(String), 'AB', false);

      // After 3 ticks: 'ABC' (complete)
      vi.advanceTimersByTime(10);
      expect(cb.onTextReveal).toHaveBeenCalledWith('msg-1', expect.any(String), 'ABC', true);

      buf.shutdown();
    });

    test('reveals multiple characters per tick when configured', () => {
      const cb = makeCallbacks();
      const buf = new StreamBuffer(cb, { tickMs: 10, charsPerTick: 3 });

      buf.pushText('msg-1', 'ABCDEF', 'agent-1');
      buf.sealText('msg-1');
      buf.pushDone({ totalActions: 0, totalAgents: 1 });

      buf.start();

      // After 1 tick: 'ABC'
      vi.advanceTimersByTime(10);
      expect(cb.onTextReveal).toHaveBeenCalledWith('msg-1', expect.any(String), 'ABC', false);

      // After 2 ticks: 'ABCDEF' (complete)
      vi.advanceTimersByTime(10);
      expect(cb.onTextReveal).toHaveBeenCalledWith('msg-1', expect.any(String), 'ABCDEF', true);

      buf.shutdown();
    });
  });

  describe('onLiveSpeech', () => {
    test('fires onLiveSpeech with current segment text', () => {
      const cb = makeCallbacks();
      const buf = new StreamBuffer(cb, { tickMs: 10, charsPerTick: 100 });

      buf.pushAgentStart({ messageId: 'msg-1', agentId: 'agent-1', agentName: 'Teacher' });
      buf.pushText('msg-1', 'Hello world', 'agent-1');
      buf.sealText('msg-1');
      buf.pushDone({ totalActions: 0, totalAgents: 1 });

      buf.start();
      vi.advanceTimersByTime(200);

      expect(cb.onLiveSpeech).toHaveBeenCalledWith('Hello world', 'agent-1');
      buf.shutdown();
    });

    test('keeps the final text visible until it is fully revealed before done fires', () => {
      const cb = makeCallbacks();
      const buf = new StreamBuffer(cb, { tickMs: 10, charsPerTick: 2 });

      buf.pushAgentStart({ messageId: 'msg-1', agentId: 'agent-1', agentName: 'Assistant' });
      buf.pushText('msg-1', 'Answer please', 'agent-1');
      buf.sealText('msg-1');
      buf.pushDone({ totalActions: 0, totalAgents: 1 });

      buf.start();
      vi.advanceTimersByTime(30);
      expect(cb.onDone).not.toHaveBeenCalled();

      vi.advanceTimersByTime(100);
      expect(cb.onLiveSpeech).toHaveBeenCalledWith('Answer please', 'agent-1');
      expect(cb.onDone).toHaveBeenCalled();
      buf.shutdown();
    });
  });
});
