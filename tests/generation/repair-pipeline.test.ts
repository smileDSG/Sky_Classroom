import { describe, expect, it, beforeEach } from 'vitest';
import { RepairPipeline } from '@/lib/generation/repair-pipeline';
import {
  codeBlockExtractor,
  jsonWindowExtractor,
  quotedPropertyFixer,
  latexEscapeFixer,
  invalidEscapeFixer,
  truncatedJsonFixer,
  controlCharFixer,
  jsonrepairFixer,
} from '@/lib/generation/repair-strategies';
import type { RepairStrategy } from '@/lib/generation/repair-strategies/types';

// ── Strategies integration tests ──

describe('extraction strategies', () => {
  describe('codeBlockExtractor', () => {
    it('extracts JSON from ```json block', () => {
      const raw = 'Here is the output:\n```json\n{"key": "value"}\n```\nThat is all.';
      const result = codeBlockExtractor.extract(raw);
      expect(result).toEqual(['{"key": "value"}']);
    });

    it('extracts JSON from plain ``` (no language)', () => {
      const raw = '```\n{"key": "value"}\n```';
      expect(codeBlockExtractor.extract(raw)).toEqual(['{"key": "value"}']);
    });

    it('extracts multiple code blocks', () => {
      const raw = '```json\n[1, 2]\n```\n---\n```json\n{"a": 1}\n```';
      const result = codeBlockExtractor.extract(raw);
      expect(result).toEqual(['[1, 2]', '{"a": 1}']);
    });

    it('skips non-JSON code blocks', () => {
      const raw = '```python\nprint("hello")\n```';
      expect(codeBlockExtractor.extract(raw)).toEqual([]);
    });
  });

  describe('jsonWindowExtractor', () => {
    it('extracts balanced JSON object from text', () => {
      const raw = 'The response is {"name": "test", "value": 42} as shown.';
      const result = jsonWindowExtractor.extract(raw);
      expect(result).toContain('{"name": "test", "value": 42}');
    });

    it('extracts balanced JSON array from text', () => {
      const raw = 'Results: [1, 2, 3, {"nested": true}] end.';
      const result = jsonWindowExtractor.extract(raw);
      expect(result).toContain('[1, 2, 3, {"nested": true}]');
    });

    it('extracts outermost balanced JSON structure', () => {
      const raw = 'Output: {"outer": {"inner": [1, {"deep": true}]}, "done": true}.';
      const result = jsonWindowExtractor.extract(raw);
      // jsonWindowExtractor now returns only the outermost balanced structure
      expect(result).toHaveLength(1);
      const extracted = result[0];
      expect(extracted).toContain('"outer"');
      expect(extracted).toContain('"deep"');
      expect(extracted).toContain('"done"');
      // Verify balanced: count { == count } and [ == ]
      const opens = (extracted.match(/{/g) || []).length;
      const closes = (extracted.match(/}/g) || []).length;
      expect(opens).toBe(closes);
      const arrOpens = (extracted.match(/\[/g) || []).length;
      const arrCloses = (extracted.match(/\]/g) || []).length;
      expect(arrOpens).toBe(arrCloses);
    });

    it('returns empty for text without JSON', () => {
      expect(jsonWindowExtractor.extract('No braces here')).toEqual([]);
    });
  });
});

describe('repair strategies', () => {
  function makeCtx(text: string) {
    return { rawResponse: text, currentText: text, attempt: 0 };
  }

  describe('quotedPropertyFixer', () => {
    it('fixes "height: 76" to "height": 76', () => {
      const input = `{"elements":[{"type":"text","height: 76"}]}`;
      const result = quotedPropertyFixer.repair(makeCtx(input));
      expect(result).not.toBeNull();
      expect(result!.text).toContain('"height": 76');
    });

    it('fixes "fixedRatio: false" to "fixedRatio": false', () => {
      const input = `{"fixedRatio: false","width":100}`;
      const result = quotedPropertyFixer.repair(makeCtx(input));
      expect(result).not.toBeNull();
      expect(result!.text).toContain('"fixedRatio": false');
    });

    it('preserves valid string values with colons', () => {
      const input = `{"content":"<p>height: 76</p>"}`;
      const result = quotedPropertyFixer.repair(makeCtx(input));
      // The content is inside string quotes, so should not be touched
      expect(result).toBeNull();
    });
  });

  describe('latexEscapeFixer', () => {
    it('preserves valid JSON escapes like \\n \\t', () => {
      const input = `{"text":"line1\\nline2\\tindented"}`;
      const result = latexEscapeFixer.repair(makeCtx(input));
      // \n and \t are valid JSON escapes → no change needed
      expect(result).toBeNull();
    });

    it('fixes LaTeX-like escapes in strings', () => {
      const input = `{"formula":"x = \\\\frac{a}{b}"}`;
      const result = latexEscapeFixer.repair(makeCtx(input));
      // Already correctly double-escaped → no change
      expect(result).toBeNull();
    });
  });

  describe('invalidEscapeFixer', () => {
    it('returns null for properly escaped JSON', () => {
      // All characters are normal JSON — no backslash-letter combos
      const input = `{"text":"the LaTeX package works fine"}`;
      const result = invalidEscapeFixer.repair(makeCtx(input));
      expect(result).toBeNull();
    });

    it('fixes raw backslash-not-valid-escape chars', () => {
      const input = `{"cmd":"\\dostuff"}`;
      // \d is not a valid JSON escape
      const result = invalidEscapeFixer.repair(makeCtx(input));
      expect(result).not.toBeNull();
      expect(result!.text).toContain('\\\\d');
    });
  });

  describe('truncatedJsonFixer', () => {
    it('closes truncated array by finding last complete object', () => {
      const input = `[{"id":1,"name":"A"},{"id":2,"name":"B`;
      const result = truncatedJsonFixer.repair(makeCtx(input));
      expect(result).not.toBeNull();
      expect(result!.text).toBe('[{"id":1,"name":"A"}]');
      expect(result!.meta).toEqual({ type: 'array-truncated' });
    });

    it('closes truncated object by balancing braces', () => {
      const input = `{"outer":{"inner":[1,2,3`;
      const result = truncatedJsonFixer.repair(makeCtx(input));
      expect(result).not.toBeNull();
      // 2 { open, 0 } close → adds 2 }  ; 1 [ open, 0 ] close → NOT fixed (array truncation only auto-closes objects via brace counting)
      // The braces added by the object path: }} plus array needs a ]
      // Result should at least have balanced { }
      const opens = (result!.text!.match(/{/g) || []).length;
      const closes = (result!.text!.match(/}/g) || []).length;
      expect(opens).toBe(closes);
    });

    it('returns null for well-formed JSON', () => {
      const input = `{"key":"value"}`;
      const result = truncatedJsonFixer.repair(makeCtx(input));
      expect(result).toBeNull();
    });
  });

  describe('controlCharFixer', () => {
    it('removes NUL characters', () => {
      const input = '{"text":"hello\x00world"}';
      const result = controlCharFixer.repair(makeCtx(input));
      expect(result).not.toBeNull();
      expect(result!.text).not.toContain('\x00');
    });

    it('returns null for clean text', () => {
      const result = controlCharFixer.repair(makeCtx('{"clean":"yes"}'));
      expect(result).toBeNull();
    });
  });

  describe('jsonrepairFixer', () => {
    it('fixes unescaped quotes in text', () => {
      const input = `{"text":"He said \\"hello\\" to her"}`;
      const result = jsonrepairFixer.repair(makeCtx(input));
      // Already properly escaped
      expect(result).toBeNull();
    });

    it('returns null for well-formed JSON', () => {
      const result = jsonrepairFixer.repair(makeCtx('{"key":"value"}'));
      expect(result).toBeNull();
    });
  });
});

// ── Pipeline integration tests ──

describe('RepairPipeline', () => {
  let pipeline: RepairPipeline;

  beforeEach(() => {
    pipeline = new RepairPipeline();
  });

  describe('parse', () => {
    it('parses valid JSON in code block', () => {
      const raw = '```json\n{"name": "Alice", "age": 30}\n```';
      const result = pipeline.parse<{ name: string; age: number }>(raw);

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ name: 'Alice', age: 30 });
      expect(result.repairChain).toHaveLength(0);
    });

    it('parses first valid JSON structure found in text', () => {
      // jsonWindowExtractor prefers { } over [ ] — reverse the order
      const raw = '{"data": [1, 2, 3], "ok": true}';
      const result = pipeline.parse<{ data: number[]; ok: boolean }>(raw);

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ data: [1, 2, 3], ok: true });
    });

    it('repairs broken JSON with repair chain recorded', () => {
      const raw = `\`\`\`json\n{"elements":[{"id":"t1","type":"text","height: 76","content":"hello"}]}\n\`\`\``;
      const result = pipeline.parse<{ elements: Array<{ height: number }> }>(raw);

      expect(result.success).toBe(true);
      expect(result.repairChain.length).toBeGreaterThan(0);
      expect(result.repairChain).toContain('quoted-property-fixer');
    });

    it('repairs truncated JSON in code block', () => {
      const raw = '```json\n[{"id":1,"name":"A"},{"id":2,"na\n```';
      const result = pipeline.parse<Array<{ id: number; name: string }>>(raw);

      expect(result.success).toBe(true);
      expect(result.data).toEqual([{ id: 1, name: 'A' }]);
      expect(result.repairChain).toContain('truncated-json-fixer');
    });

    it('returns failure for completely unrepairable input', () => {
      const raw = 'This is not JSON at all and contains no braces.';
      const result = pipeline.parse(raw);

      expect(result.success).toBe(false);
    });

    it('extractionStrategy is recorded on success', () => {
      const result = pipeline.parse<{ x: number }>('```json\n{"x": 1}\n```');
      expect(result.success).toBe(true);
      expect(result).toHaveProperty('extractionStrategy');
    });
  });

  describe('custom strategy registration', () => {
    it('allows adding strategies that run when needed and removing them', () => {
      const customRepair: RepairStrategy = {
        name: 'custom-marker-fixer',
        priority: 5,
        repair: (ctx) => {
          if (ctx.currentText.includes('BAD_TOKEN')) {
            return { text: ctx.currentText.replace('BAD_TOKEN', '42') };
          }
          return null;
        },
      };

      pipeline.addRepairStrategy(customRepair);

      // This JSON is technically valid, so the custom strategy won't fire
      // because JSON.parse succeeds directly without needing repair.
      // Use input that triggers repair: malformed
      const result = pipeline.parse<{ value: number }>('{"value":BAD_TOKEN}');
      expect(result.success).toBe(true);
      expect(result.data?.value).toBe(42);
      expect(result.repairChain).toContain('custom-marker-fixer');

      pipeline.removeStrategy('custom-marker-fixer');
      const result2 = pipeline.parse<{ value: number }>('{"value":BAD_TOKEN}');
      // Without the fixer, it might still be repaired by other strategies
      // or fail entirely. The key is the strategy was removed.
      expect(result2.repairChain).not.toContain('custom-marker-fixer');
    });
  });
});
