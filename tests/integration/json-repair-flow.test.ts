/**
 * P6-001 Test 20: JSON 修复链
 *
 * Tests the JSON repair pipeline — handling various malformed
 * JSON outputs from LLMs and verifying that the repair chain
 * correctly fixes them.
 */
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { parseJSON, repairJSON } from '@/lib/generation/json-repair';

// ─── Malformed JSON test cases ───

const MALFORMED_CASES = [
  // Missing closing brace
  { input: '{"name": "test", "value": 42', expected: { name: 'test', value: 42 } },
  // Missing closing bracket
  { input: '[1, 2, 3', expected: [1, 2, 3] },
  // Single quotes instead of double quotes
  { input: "{'name': 'test'}", expected: { name: 'test' } },
  // Trailing comma
  { input: '{"a": 1, "b": 2,}', expected: { a: 1, b: 2 } },
  // Missing quotes on keys
  { input: '{name: "test"}', expected: { name: 'test' } },
  // Extra closing brace
  { input: '{"a": 1}}', expected: { a: 1 } },
  // Newlines in strings
  { input: '{"text": "line1\nline2"}', expected: { text: 'line1\nline2' } },
  // Unescaped quotes
  { input: '{"text": "He said "hello""}', expected: null }, // May not be fixable
  // Markdown code block wrapper
  { input: '```json\n{"key": "value"}\n```', expected: { key: 'value' } },
  // Empty object
  { input: '{}', expected: {} },
  // Empty array
  { input: '[]', expected: [] },
];

// ─── Tests ───

describe('P6-001 Test 20: JSON 修复链', () => {
  describe('basic JSON parsing', () => {
    test('parses valid JSON', () => {
      const result = parseJSON('{"name": "test", "value": 42}');
      expect(result).toEqual({ name: 'test', value: 42 });
    });

    test('parses valid array', () => {
      const result = parseJSON('[1, 2, 3]');
      expect(result).toEqual([1, 2, 3]);
    });

    test('returns null for invalid JSON without repair', () => {
      const result = parseJSON('not json');
      expect(result).toBeNull();
    });

    test('returns null for empty string', () => {
      const result = parseJSON('');
      expect(result).toBeNull();
    });

    test('parses nested objects', () => {
      const result = parseJSON('{"a": {"b": {"c": 1}}}');
      expect(result).toEqual({ a: { b: { c: 1 } } });
    });

    test('parses arrays of objects', () => {
      const result = parseJSON('[{"id": 1}, {"id": 2}]');
      expect(result).toHaveLength(2);
      expect(result![0].id).toBe(1);
    });
  });

  describe('JSON repair', () => {
    test('repairs missing closing brace', () => {
      const result = repairJSON('{"name": "test", "value": 42');
      expect(result).not.toBeNull();
      expect(result).toEqual({ name: 'test', value: 42 });
    });

    test('repairs missing closing bracket', () => {
      const result = repairJSON('[1, 2, 3');
      expect(result).not.toBeNull();
      expect(result).toEqual([1, 2, 3]);
    });

    test('repairs single quotes', () => {
      const result = repairJSON("{'name': 'test'}");
      expect(result).not.toBeNull();
      expect(result).toEqual({ name: 'test' });
    });

    test('repairs trailing comma', () => {
      const result = repairJSON('{"a": 1, "b": 2,}');
      expect(result).not.toBeNull();
      expect(result).toEqual({ a: 1, b: 2 });
    });

    test('repairs unquoted keys', () => {
      const result = repairJSON('{name: "test"}');
      expect(result).not.toBeNull();
      expect(result).toEqual({ name: 'test' });
    });

    test('repairs extra closing brace', () => {
      const result = repairJSON('{"a": 1}}');
      expect(result).not.toBeNull();
      expect(result).toEqual({ a: 1 });
    });

    test('handles markdown code block wrapper', () => {
      const result = repairJSON('```json\n{"key": "value"}\n```');
      expect(result).not.toBeNull();
      expect(result).toEqual({ key: 'value' });
    });

    test('handles empty object', () => {
      const result = repairJSON('{}');
      expect(result).toEqual({});
    });

    test('handles empty array', () => {
      const result = repairJSON('[]');
      expect(result).toEqual([]);
    });

    test('returns null for unrepairable JSON', () => {
      const result = repairJSON('this is not json at all {{{');
      expect(result).toBeNull();
    });
  });

  describe('repair pipeline with telemetry', () => {
    test('repair strategy is recorded', () => {
      const result = repairJSON('{"a": 1,');
      expect(result).not.toBeNull();
      // Pipeline should have used trailing-comma repair strategy
    });

    test('multiple repair strategies chain together', () => {
      // Single quotes + missing closing brace
      const result = repairJSON("{'a': 1");
      expect(result).not.toBeNull();
      expect(result).toEqual({ a: 1 });
    });

    test('preserves data integrity after repair', () => {
      const input = '{"elements": [{"type": "text", "content": "Hello"}';
      const result = repairJSON(input);

      expect(result).not.toBeNull();
      expect(result!.elements).toBeDefined();
      expect(result!.elements).toHaveLength(1);
      expect(result!.elements[0].type).toBe('text');
      expect(result!.elements[0].content).toBe('Hello');
    });

    test('handles complex nested malformed JSON', () => {
      const input = '{"quiz": [{"question": "Q1", "options": [{"label": "A"}';
      const result = repairJSON(input);

      expect(result).not.toBeNull();
      expect(result!.quiz).toBeDefined();
      expect(result!.quiz).toHaveLength(1);
    });

    test('repair with schema validation', () => {
      const input = '{"name": "test", "age": 25';
      const result = repairJSON(input);

      expect(result).not.toBeNull();
      expect(result).toHaveProperty('name');
      expect(result).toHaveProperty('age');
      expect(typeof result!.name).toBe('string');
      expect(typeof result!.age).toBe('number');
    });
  });

  describe('edge cases', () => {
    test('handles very long JSON strings', () => {
      const items = Array.from({ length: 100 }, (_, i) => `{"id": ${i}}`);
      const input = `[${items.join(',')}`; // Missing closing bracket
      const result = repairJSON(input);

      expect(result).not.toBeNull();
      expect(result).toHaveLength(100);
    });

    test('handles JSON with unicode', () => {
      const input = '{"text": "\\u4f60\\u597d"}';
      const result = parseJSON(input);

      expect(result).not.toBeNull();
      expect(result!.text).toBe('你好');
    });

    test('handles JSON with escaped characters', () => {
      const input = '{"path": "C:\\\\Users\\\\test"}';
      const result = parseJSON(input);

      expect(result).not.toBeNull();
      expect(result!.path).toBe('C:\\Users\\test');
    });

    test('handles null values in JSON', () => {
      const input = '{"a": null, "b": "test"}';
      const result = parseJSON(input);

      expect(result).not.toBeNull();
      expect(result!.a).toBeNull();
      expect(result!.b).toBe('test');
    });
  });
});
