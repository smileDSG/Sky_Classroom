/**
 * Agent Loop Tests
 *
 * Tests for runAgentLoop — the frontend-driven multi-agent loop
 * that orchestrates director → agent → buffer drain → next turn.
 * Uses mocked fetch and SSE streams to test without real LLM calls.
 */
import { describe, test, expect, vi } from 'vitest';
import {
  runAgentLoop,
  type AgentLoopCallbacks,
  type AgentLoopRequest,
} from '@/lib/chat/agent-loop';
import type { StatelessEvent } from '@/lib/types/chat';

// ─── Helpers ───

function makeSSEStream(events: StatelessEvent[]): ReadableStream {
  const encoder = new TextEncoder();
  const chunks = events.map((e) => encoder.encode(`data: ${JSON.stringify(e)}\n\n`));
  chunks.push(encoder.encode('')); // end of stream

  let idx = 0;
  return new ReadableStream({
    pull(controller) {
      if (idx < chunks.length) {
        controller.enqueue(chunks[idx++]);
      } else {
        controller.close();
      }
    },
  });
}

function makeRequest(): AgentLoopRequest {
  return {
    config: {
      agentIds: ['default-1'],
      sessionType: 'qa',
    },
    apiKey: 'test-key',
    model: 'test-model',
  };
}

function makeCallbacks(overrides?: Partial<AgentLoopCallbacks>): AgentLoopCallbacks {
  const events: StatelessEvent[] = [];
  return {
    getStoreState: () => ({
      stage: { id: 's1', name: 'Test' },
      scenes: [],
      currentSceneId: null,
      mode: 'playback',
      whiteboardOpen: false,
    }),
    getMessages: () => [{ role: 'user', content: 'test' }],
    fetchChat: vi.fn().mockResolvedValue(
      new Response(makeSSEStream([]), {
        headers: { 'Content-Type': 'text/event-stream' },
      }),
    ),
    onEvent: vi.fn((event: StatelessEvent) => {
      events.push(event);
    }),
    onIterationEnd: vi.fn().mockResolvedValue({
      directorState: { turnCount: 0, agentResponses: [], whiteboardLedger: [] },
      totalAgents: 0,
      agentHadContent: false,
      cueUserReceived: false,
    }),
    ...overrides,
    _events: events,
  } as AgentLoopCallbacks & { _events: StatelessEvent[] };
}

function makeAgentResponse(agentId: string, text: string): StatelessEvent[] {
  return [
    {
      type: 'agent_start',
      data: { messageId: 'msg-1', agentId, agentName: 'Teacher', agentAvatar: '', agentColor: '' },
    },
    { type: 'text_delta', data: { content: text, messageId: 'msg-1' } },
    { type: 'agent_end', data: { messageId: 'msg-1', agentId } },
  ];
}

// ─── Tests ───

describe('runAgentLoop', () => {
  test('single agent: agent speaks then cues user', async () => {
    const agentEvents = makeAgentResponse('default-1', '光合作用是...');
    const cb = makeCallbacks({
      fetchChat: vi.fn().mockResolvedValue(
        new Response(
          makeSSEStream([
            ...agentEvents,
            { type: 'done', data: { totalActions: 0, totalAgents: 1, agentHadContent: true } },
          ]),
          {
            headers: { 'Content-Type': 'text/event-stream' },
          },
        ),
      ),
      onIterationEnd: vi.fn().mockResolvedValueOnce({
        directorState: { turnCount: 1, agentResponses: [], whiteboardLedger: [] },
        totalAgents: 1,
        agentHadContent: true,
        cueUserReceived: true,
      }),
    });

    const outcome = await runAgentLoop(makeRequest(), cb, new AbortController().signal, 10);

    expect(outcome.reason).toBe('cue_user');
    expect(outcome.turnCount).toBe(1);
  });

  test('multi-agent: two agents speak then end', async () => {
    const cb = makeCallbacks({
      fetchChat: vi
        .fn()
        .mockResolvedValueOnce(
          new Response(
            makeSSEStream([
              ...makeAgentResponse('teacher-1', '好的'),
              { type: 'done', data: { totalActions: 0, totalAgents: 1, agentHadContent: true } },
            ]),
            {
              headers: { 'Content-Type': 'text/event-stream' },
            },
          ),
        )
        .mockResolvedValueOnce(
          new Response(
            makeSSEStream([
              ...makeAgentResponse('student-1', '明白了'),
              { type: 'done', data: { totalActions: 0, totalAgents: 1, agentHadContent: true } },
            ]),
            {
              headers: { 'Content-Type': 'text/event-stream' },
            },
          ),
        ),
      onIterationEnd: vi
        .fn()
        .mockResolvedValueOnce({
          directorState: { turnCount: 1, agentResponses: [], whiteboardLedger: [] },
          totalAgents: 1,
          agentHadContent: true,
          cueUserReceived: false,
        })
        .mockResolvedValueOnce({
          directorState: { turnCount: 2, agentResponses: [], whiteboardLedger: [] },
          totalAgents: 0,
          agentHadContent: false,
          cueUserReceived: false,
        }),
    });

    const req = makeRequest();
    req.config.agentIds = ['teacher-1', 'student-1'];
    const outcome = await runAgentLoop(req, cb, new AbortController().signal, 10);

    expect(outcome.reason).toBe('end');
    expect(outcome.turnCount).toBe(2);
  });

  test('aborts when signal is aborted', async () => {
    const controller = new AbortController();
    const cb = makeCallbacks({
      fetchChat: vi.fn().mockImplementation(async () => {
        controller.abort();
        return new Response(makeSSEStream([]), {
          headers: { 'Content-Type': 'text/event-stream' },
        });
      }),
    });

    const outcome = await runAgentLoop(makeRequest(), cb, controller.signal, 10);
    expect(outcome.reason).toBe('aborted');
  });

  test('respects maxTurns limit', async () => {
    const cb = makeCallbacks({
      fetchChat: vi.fn().mockResolvedValue(
        new Response(
          makeSSEStream([
            ...makeAgentResponse('default-1', 'Hi'),
            { type: 'done', data: { totalActions: 0, totalAgents: 1, agentHadContent: true } },
          ]),
          {
            headers: { 'Content-Type': 'text/event-stream' },
          },
        ),
      ),
      onIterationEnd: vi.fn().mockResolvedValue({
        directorState: { turnCount: 1, agentResponses: [], whiteboardLedger: [] },
        totalAgents: 1,
        agentHadContent: true,
        cueUserReceived: false,
      }),
    });

    const outcome = await runAgentLoop(makeRequest(), cb, new AbortController().signal, 1);
    expect(outcome.reason).toBe('max_turns');
  });

  test('only sends triggerAgentId on the first loop iteration', async () => {
    const fetchChat = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          makeSSEStream([
            ...makeAgentResponse('default-2', '我来补充'),
            { type: 'done', data: { totalActions: 0, totalAgents: 1, agentHadContent: true } },
          ]),
          {
            headers: { 'Content-Type': 'text/event-stream' },
          },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          makeSSEStream([
            { type: 'done', data: { totalActions: 0, totalAgents: 0, agentHadContent: false } },
          ]),
          {
            headers: { 'Content-Type': 'text/event-stream' },
          },
        ),
      );
    const cb = makeCallbacks({
      fetchChat,
      onIterationEnd: vi
        .fn()
        .mockResolvedValueOnce({
          directorState: { turnCount: 1, agentResponses: [], whiteboardLedger: [] },
          totalAgents: 1,
          agentHadContent: true,
          cueUserReceived: false,
        })
        .mockResolvedValueOnce({
          directorState: { turnCount: 1, agentResponses: [], whiteboardLedger: [] },
          totalAgents: 0,
          agentHadContent: false,
          cueUserReceived: false,
        }),
    });

    const req = makeRequest();
    req.config.agentIds = ['default-1', 'default-2'];
    req.config.triggerAgentId = 'default-2';

    const outcome = await runAgentLoop(req, cb, new AbortController().signal, 5);

    expect(outcome.reason).toBe('end');
    expect(fetchChat).toHaveBeenCalledTimes(2);
    const firstBody = fetchChat.mock.calls[0][0] as Record<string, { triggerAgentId?: string }>;
    const secondBody = fetchChat.mock.calls[1][0] as Record<string, { triggerAgentId?: string }>;
    expect(firstBody.config.triggerAgentId).toBe('default-2');
    expect(secondBody.config.triggerAgentId).toBeUndefined();
    expect(req.config.triggerAgentId).toBe('default-2');
  });

  test('stops after consecutive empty turns', async () => {
    const cb = makeCallbacks({
      fetchChat: vi.fn().mockResolvedValue(
        new Response(
          makeSSEStream([
            { type: 'done', data: { totalActions: 0, totalAgents: 1, agentHadContent: false } },
          ]),
          {
            headers: { 'Content-Type': 'text/event-stream' },
          },
        ),
      ),
      onIterationEnd: vi
        .fn()
        .mockResolvedValueOnce({
          directorState: { turnCount: 1, agentResponses: [], whiteboardLedger: [] },
          totalAgents: 1,
          agentHadContent: false,
          cueUserReceived: false,
        })
        .mockResolvedValueOnce({
          directorState: { turnCount: 2, agentResponses: [], whiteboardLedger: [] },
          totalAgents: 1,
          agentHadContent: false,
          cueUserReceived: false,
        }),
    });

    const outcome = await runAgentLoop(makeRequest(), cb, new AbortController().signal, 10);
    expect(outcome.reason).toBe('empty_turns');
  });

  test('handles fetch error', async () => {
    const cb = makeCallbacks({
      fetchChat: vi.fn().mockRejectedValue(new Error('Network error')),
    });

    await expect(runAgentLoop(makeRequest(), cb, new AbortController().signal, 10)).rejects.toThrow(
      'Network error',
    );
  });

  test('handles HTTP error response', async () => {
    const cb = makeCallbacks({
      fetchChat: vi.fn().mockResolvedValue(new Response('Internal Server Error', { status: 500 })),
    });

    await expect(runAgentLoop(makeRequest(), cb, new AbortController().signal, 10)).rejects.toThrow(
      '500',
    );
  });

  test('handles null onIterationEnd result', async () => {
    const cb = makeCallbacks({
      fetchChat: vi.fn().mockResolvedValue(
        new Response(makeSSEStream([]), {
          headers: { 'Content-Type': 'text/event-stream' },
        }),
      ),
      onIterationEnd: vi.fn().mockResolvedValue(null),
    });

    const outcome = await runAgentLoop(makeRequest(), cb, new AbortController().signal, 10);
    expect(outcome.reason).toBe('no_done');
  });

  test('passes store state and messages to fetchChat', async () => {
    const fetchChat = vi.fn().mockResolvedValue(
      new Response(makeSSEStream([{ type: 'done', data: { totalActions: 0, totalAgents: 0 } }]), {
        headers: { 'Content-Type': 'text/event-stream' },
      }),
    );
    const cb = makeCallbacks({
      fetchChat,
      onIterationEnd: vi.fn().mockResolvedValue(null),
    });

    await runAgentLoop(makeRequest(), cb, new AbortController().signal, 1);

    expect(fetchChat).toHaveBeenCalledTimes(1);
    const body = (fetchChat as ReturnType<typeof vi.fn>).mock.calls[0][0] as Record<
      string,
      unknown
    >;
    expect(body.messages).toBeDefined();
    expect(body.storeState).toBeDefined();
    expect(body.config).toBeDefined();
  });
});
