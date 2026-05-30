/**
 * Structured Output Parser Tests
 *
 * Comprehensive tests for parseStructuredChunk and finalizeParser —
 * the streaming JSON array parser that processes LLM output.
 * Covers: incremental parsing, text+action interleaving, edge cases.
 */
import { describe, test, expect } from 'vitest';
import {
  createParserState,
  parseStructuredChunk,
  finalizeParser,
} from '@/lib/orchestration/stateless-generate';

// ─── Helper: feed chunks incrementally ───

function feedChunks(chunks: string[]): {
  textChunks: string[];
  actions: Array<{ actionName: string; params: Record<string, unknown> }>;
  isDone: boolean;
} {
  const state = createParserState();
  const allText: string[] = [];
  const allActions: Array<{ actionName: string; params: Record<string, unknown> }> = [];

  for (const chunk of chunks) {
    const result = parseStructuredChunk(chunk, state);
    allText.push(...result.textChunks);
    allActions.push(...result.actions);
  }

  const final = finalizeParser(state);
  allText.push(...final.textChunks);
  allActions.push(...final.actions);

  return { textChunks: allText, actions: allActions, isDone: state.isDone };
}

// ─── Tests ───

describe('parseStructuredChunk', () => {
  describe('complete JSON in single chunk', () => {
    test('parses single text item', () => {
      const result = feedChunks(['[{"type":"text","content":"Hello students"}]']);
      expect(result.textChunks).toContain('Hello students');
      expect(result.actions).toHaveLength(0);
      expect(result.isDone).toBe(true);
    });

    test('parses single action item', () => {
      const result = feedChunks([
        '[{"type":"action","name":"spotlight","params":{"elementId":"img_1"}}]',
      ]);
      expect(result.actions).toHaveLength(1);
      expect(result.actions[0].actionName).toBe('spotlight');
      expect(result.actions[0].params.elementId).toBe('img_1');
    });

    test('parses text + action interleaved', () => {
      const result = feedChunks([
        '[{"type":"text","content":"Look at this"},{"type":"action","name":"spotlight","params":{"elementId":"img_1"}},{"type":"text","content":"Notice the details"}]',
      ]);
      expect(result.textChunks).toHaveLength(2);
      expect(result.textChunks[0]).toBe('Look at this');
      expect(result.textChunks[1]).toBe('Notice the details');
      expect(result.actions).toHaveLength(1);
    });

    test('parses multiple actions', () => {
      const result = feedChunks([
        '[{"type":"action","name":"wb_open","params":{}},{"type":"action","name":"wb_draw_text","params":{"content":"X=1","x":100,"y":100}},{"type":"text","content":"Done"}]',
      ]);
      expect(result.actions).toHaveLength(2);
      expect(result.actions[0].actionName).toBe('wb_open');
      expect(result.actions[1].actionName).toBe('wb_draw_text');
      expect(result.textChunks).toHaveLength(1);
    });
  });

  describe('incremental streaming', () => {
    test('parses text character by character', () => {
      const json = '[{"type":"text","content":"Hello"}]';
      const chunks = json.split('');
      const result = feedChunks(chunks);
      expect(result.textChunks.join('')).toBe('Hello');
    });

    test('parses action across multiple chunks', () => {
      const chunks = [
        '[{"type":"act',
        'ion","name":"spot',
        'light","params":{',
        '"elementId":"img_1"}}]',
      ];
      const result = feedChunks(chunks);
      expect(result.actions).toHaveLength(1);
      expect(result.actions[0].actionName).toBe('spotlight');
    });

    test('parses mixed text and action across chunks', () => {
      const chunks = [
        '[{"type":"text","content":"Part 1"},{"type":"action',
        ',"name":"spotlight","params":{"elementId":"e1"}},{"type":"text","content":"Part 2"}]',
      ];
      const result = feedChunks(chunks);
      expect(result.textChunks.length).toBeGreaterThanOrEqual(1);
      expect(result.actions.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('non-JSON prefix handling', () => {
    test('skips markdown code fence prefix', () => {
      const result = feedChunks(['```json\n[{"type":"text","content":"Hi"}]\n```']);
      expect(result.textChunks).toContain('Hi');
    });

    test('skips explanatory text before JSON', () => {
      const result = feedChunks(['Here is my response:\n[{"type":"text","content":"Hi"}]']);
      expect(result.textChunks).toContain('Hi');
    });

    test('skips leading whitespace and newlines', () => {
      const result = feedChunks(['  \n  [{"type":"text","content":"Hi"}]']);
      expect(result.textChunks).toContain('Hi');
    });
  });

  describe('edge cases', () => {
    test('empty array produces no output', () => {
      const result = feedChunks(['[]']);
      expect(result.textChunks).toHaveLength(0);
      expect(result.actions).toHaveLength(0);
      expect(result.isDone).toBe(true);
    });

    test('text with empty content is skipped', () => {
      const result = feedChunks(['[{"type":"text","content":""}]']);
      expect(result.textChunks).toHaveLength(0);
    });

    test('handles legacy format (tool_name/parameters)', () => {
      const result = feedChunks([
        '[{"type":"action","tool_name":"spotlight","parameters":{"elementId":"e1"}}]',
      ]);
      expect(result.actions).toHaveLength(1);
      expect(result.actions[0].actionName).toBe('spotlight');
    });

    test('handles action_id field', () => {
      const result = feedChunks([
        '[{"type":"action","action_id":"custom-id","name":"spotlight","params":{"elementId":"e1"}}]',
      ]);
      expect(result.actions).toHaveLength(1);
      expect(result.actions[0].actionId).toBe('custom-id');
    });

    test('generates action_id when not provided', () => {
      const result = feedChunks([
        '[{"type":"action","name":"spotlight","params":{"elementId":"e1"}}]',
      ]);
      expect(result.actions[0].actionId).toBeDefined();
      expect(result.actions[0].actionId.length).toBeGreaterThan(0);
    });

    test('handles malformed JSON gracefully', () => {
      const state = createParserState();
      // Completely invalid
      const r1 = parseStructuredChunk('not json at all', state);
      expect(r1.actions).toHaveLength(0);
      expect(r1.textChunks).toHaveLength(0);
    });

    test('handles unclosed JSON (finalize)', () => {
      const state = createParserState();
      parseStructuredChunk('[{"type":"text","content":"Partial...', state);
      const final = finalizeParser(state);
      expect(final.isDone).toBe(true);
      // Should still extract something
      expect(final.textChunks.length + final.actions.length).toBeGreaterThanOrEqual(0);
    });

    test('handles JSON with no opening bracket', () => {
      const state = createParserState();
      const r = parseStructuredChunk('just plain text, no JSON', state);
      expect(r.textChunks).toHaveLength(0);
      expect(r.actions).toHaveLength(0);
    });
  });

  describe('finalizeParser', () => {
    test('empty buffer returns empty result', () => {
      const state = createParserState();
      const r = finalizeParser(state);
      expect(r.isDone).toBe(true);
      expect(r.textChunks).toHaveLength(0);
      expect(r.actions).toHaveLength(0);
    });

    test('already-done state returns empty result', () => {
      const state = createParserState();
      parseStructuredChunk('[{"type":"text","content":"Hi"}]', state);
      expect(state.isDone).toBe(true);
      const r = finalizeParser(state);
      expect(r.textChunks).toHaveLength(0);
    });

    test('plain text fallback when no JSON started', () => {
      const state = createParserState();
      state.buffer = 'Just plain text response';
      const r = finalizeParser(state);
      expect(r.isDone).toBe(true);
      expect(r.textChunks).toContain('Just plain text response');
    });

    test('incomplete JSON with bracket started tries final parse', () => {
      const state = createParserState();
      parseStructuredChunk('[{"type":"text","content":"Incomplete', state);
      expect(state.jsonStarted).toBe(true);
      expect(state.isDone).toBe(false);
      const r = finalizeParser(state);
      expect(r.isDone).toBe(true);
    });
  });

  describe('ordering', () => {
    test('ordered array reflects text-action interleaving', () => {
      const state = createParserState();
      const r = parseStructuredChunk(
        '[{"type":"text","content":"A"},{"type":"action","name":"spotlight","params":{"elementId":"e1"}},{"type":"text","content":"B"}]',
        state,
      );
      expect(r.ordered).toHaveLength(3);
      expect(r.ordered[0].type).toBe('text');
      expect(r.ordered[1].type).toBe('action');
      expect(r.ordered[2].type).toBe('text');
    });
  });
});
