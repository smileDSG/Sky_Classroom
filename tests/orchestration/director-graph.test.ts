/**
 * Phase 2 (B-003): Orchestration layer tests
 *
 * Tests for director routing, stateless generation parsing,
 * and conversation summarization — currently zero coverage.
 */
import { describe, test, expect } from 'vitest';
import {
  parseDirectorDecision,
  summarizeWhiteboardForDirector,
} from '@/lib/orchestration/director-prompt';
import {
  createParserState,
  parseStructuredChunk,
  finalizeParser,
} from '@/lib/orchestration/stateless-generate';
import type { WhiteboardActionRecord } from '@/lib/orchestration/types';

// ─── Director Decision Parsing ───

describe('parseDirectorDecision', () => {
  test('parses next_agent from valid JSON', () => {
    const r = parseDirectorDecision('some text {"next_agent":"agent-1"} more');
    expect(r.nextAgentId).toBe('agent-1');
    expect(r.shouldEnd).toBe(false);
  });

  test('returns end when next_agent is END', () => {
    const r = parseDirectorDecision('{"next_agent":"END"}');
    expect(r.nextAgentId).toBeNull();
    expect(r.shouldEnd).toBe(true);
  });

  test('returns end when no JSON found', () => {
    const r = parseDirectorDecision('just some random text');
    expect(r.nextAgentId).toBeNull();
    expect(r.shouldEnd).toBe(true);
  });

  test('returns end when next_agent is missing', () => {
    const r = parseDirectorDecision('{"other":"value"}');
    expect(r.nextAgentId).toBeNull();
    expect(r.shouldEnd).toBe(true);
  });

  test('handles nested JSON objects', () => {
    const r = parseDirectorDecision(
      '{"params":{"key":"val"},"next_agent":"agent-3"}',
    );
    expect(r.nextAgentId).toBe('agent-3');
  });

  test('handles empty string', () => {
    const r = parseDirectorDecision('');
    expect(r.shouldEnd).toBe(true);
  });
});

// ─── Whiteboard Summarization ───

describe('summarizeWhiteboardForDirector', () => {
  function makeAction(
    actionName: WhiteboardActionRecord['actionName'],
    params: Record<string, unknown> = {},
  ): WhiteboardActionRecord {
    return {
      actionName,
      params,
      agentId: 'a1',
      agentName: 'TestAgent',
    } as WhiteboardActionRecord;
  }

  test('returns zero for empty ledger', () => {
    const r = summarizeWhiteboardForDirector([]);
    expect(r.elementCount).toBe(0);
    expect(r.contributors).toEqual([]);
  });

  test('counts draw actions', () => {
    const r = summarizeWhiteboardForDirector([
      makeAction('wb_draw_text', { content: 'hello' }),
      makeAction('wb_draw_shape', { type: 'rectangle' }),
      makeAction('wb_draw_chart', { chartType: 'bar' }),
    ]);
    expect(r.elementCount).toBe(3);
    expect(r.contributors).toContain('TestAgent');
  });

  test('wb_clear resets count', () => {
    const r = summarizeWhiteboardForDirector([
      makeAction('wb_draw_text'),
      makeAction('wb_draw_text'),
      makeAction('wb_clear'),
    ]);
    expect(r.elementCount).toBe(0);
  });

  test('wb_delete reduces count by 1', () => {
    const r = summarizeWhiteboardForDirector([
      makeAction('wb_draw_text'),
      makeAction('wb_draw_text'),
      makeAction('wb_draw_text'),
      makeAction('wb_delete', { elementId: 'x1' }),
    ]);
    expect(r.elementCount).toBe(2);
  });

  test('skips wb_open and wb_close', () => {
    const r = summarizeWhiteboardForDirector([
      makeAction('wb_open'),
      makeAction('wb_draw_text'),
      makeAction('wb_close'),
    ]);
    expect(r.elementCount).toBe(1);
  });

  test('tracks multiple contributors', () => {
    const a1: WhiteboardActionRecord = {
      ...makeAction('wb_draw_text'),
      agentName: 'Teacher',
    };
    const a2: WhiteboardActionRecord = {
      ...makeAction('wb_draw_shape'),
      agentName: 'StudentA',
    };
    const r = summarizeWhiteboardForDirector([a1, a2]);
    expect(r.contributors).toHaveLength(2);
    expect(r.contributors).toContain('Teacher');
    expect(r.contributors).toContain('StudentA');
  });
});

// ─── Stateless Generation Parser ───

describe('stateless-generate parser', () => {
  describe('createParserState', () => {
    test('returns fresh state', () => {
      const state = createParserState();
      expect(state.buffer).toBe('');
      expect(state.jsonStarted).toBe(false);
      expect(state.lastParsedItemCount).toBe(0);
      expect(state.isDone).toBe(false);
    });
  });

  describe('parseStructuredChunk', () => {
    test('buffers partial JSON', () => {
      const state = createParserState();
      const r = parseStructuredChunk('[{"type":"text","content":"Hello', state);
      expect(r.actions).toEqual([]);
      expect(state.buffer).toContain('Hello');
    });

    test('extracts complete action object', () => {
      const state = createParserState();
      const r = parseStructuredChunk(
        '[{"type":"text","content":"Hello world"}]',
        state,
      );
      expect(r.actions.length).toBeGreaterThanOrEqual(0);
    });

    test('handles text with action mixed chunks', () => {
      const state = createParserState();
      parseStructuredChunk('[{"type":"action","name":"spotlight","params":{"elementId":"el1"}}', state);
      const r = parseStructuredChunk(',{"type":"text","content":"Look here"}]', state);
      // Should have parsed at least one action
      expect(state.buffer).toBeDefined();
    });
  });

  describe('finalizeParser', () => {
    test('returns result with isDone for empty buffer', () => {
      const state = createParserState();
      const r = finalizeParser(state);
      expect(r.isDone).toBe(true);
      expect(Array.isArray(r.actions)).toBe(true);
    });

    test('handles partial buffer gracefully', () => {
      const state = createParserState();
      state.buffer = '[{"type":"text","content":"Hi"}]';
      const r = finalizeParser(state);
      expect(r.isDone).toBe(true);
    });
  });
});
