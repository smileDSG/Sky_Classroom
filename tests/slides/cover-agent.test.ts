/**
 * Tests for cover-agent.ts — salvageJson, schema validation, assembly, concurrency.
 */
import { describe, it, expect } from 'vitest';
import { salvageJson, coverSkeletonSchema, assembleDesignDNA, getMotifsForTopic, type CoverItem } from '@/lib/slides/agent/cover-agent';
import type { DesignDNA } from '@/lib/slides/agent/design-dna';

// ══════════════════════════════════════════════════════════════════════
// salvageJson tests
// ══════════════════════════════════════════════════════════════════════

describe('salvageJson', () => {
  it('passes through clean JSON', () => {
    const input = '{"styleName":"科技暗金","fontId":"georgia-calibri","density":"moderate","mood":"专业","bestFor":["数学"]}';
    const result = salvageJson(input);
    expect(result).not.toBeNull();
    expect(JSON.parse(result!)).toEqual({
      styleName: '科技暗金',
      fontId: 'georgia-calibri',
      density: 'moderate',
      mood: '专业',
      bestFor: ['数学'],
    });
  });

  it('strips markdown json fence', () => {
    const input = '```json\n{"styleName":"极简白","fontId":"noto-sans","density":"sparse","mood":"清爽","bestFor":["语文"]}\n```';
    const result = salvageJson(input);
    expect(result).not.toBeNull();
    const parsed = JSON.parse(result!);
    expect(parsed.styleName).toBe('极简白');
    expect(parsed.fontId).toBe('noto-sans');
  });

  it('strips markdown fence without language tag', () => {
    const input = '```\n{"styleName":"书香墨韵","fontId":"lora-inter","density":"moderate","mood":"典雅","bestFor":["历史"]}\n```';
    const result = salvageJson(input);
    expect(result).not.toBeNull();
    const parsed = JSON.parse(result!);
    expect(parsed.styleName).toBe('书香墨韵');
  });

  it('fixes trailing comma before }', () => {
    const input = '{"styleName":"测试","fontId":"impact-arial","density":"rich","mood":"科技","bestFor":["物理"],}';
    const result = salvageJson(input);
    expect(result).not.toBeNull();
    const parsed = JSON.parse(result!);
    expect(parsed.styleName).toBe('测试');
  });

  it('fixes trailing comma before ]', () => {
    const input = '{"styleName":"测试","fontId":"georgia-calibri","density":"moderate","mood":"测试","bestFor":["数学",]}';
    const result = salvageJson(input);
    expect(result).not.toBeNull();
    const parsed = JSON.parse(result!);
    expect(parsed.bestFor).toEqual(['数学']);
  });

  it('auto-closes truncated JSON (missing final })', () => {
    // Simulates LLM output being cut off before closing brace
    const input = '{"styleName":"深邃极简","fontId":"impact-arial","density":"sparse","mood":"理性","bestFor":["物理"]';
    const result = salvageJson(input);
    expect(result).not.toBeNull();
    const parsed = JSON.parse(result!);
    expect(parsed.styleName).toBe('深邃极简');
    expect(parsed.fontId).toBe('impact-arial');
  });

  it('auto-closes truncated JSON (missing }] at end)', () => {
    // Missing both closing bracket and brace
    const input = '{"styleName":"科技暗金","fontId":"georgia-calibri","density":"rich","mood":"专业","bestFor":["数学"';
    const result = salvageJson(input);
    expect(result).not.toBeNull();
    const parsed = JSON.parse(result!);
    expect(parsed.styleName).toBe('科技暗金');
    expect(parsed.bestFor).toEqual(['数学']);
  });

  it('returns null for garbage input', () => {
    expect(salvageJson('')).toBeNull();
    expect(salvageJson('not json at all')).toBeNull();
    expect(salvageJson('hello world this is not even close')).toBeNull();
  });

  it('handles control characters', () => {
    const input = '{\x00"styleName":"测试",\x01"fontId":"georgia-calibri","density":"moderate","mood":"测试","bestFor":["数学"]\x1f}';
    const result = salvageJson(input);
    expect(result).not.toBeNull();
    const parsed = JSON.parse(result!);
    expect(parsed.styleName).toBe('测试');
  });

  it('extracts JSON from text with surrounding content', () => {
    // LLM sometimes adds explanatory text
    const input = 'Here is the design:\n{"styleName":"极简白","fontId":"noto-sans","density":"sparse","mood":"清爽","bestFor":["英语"]}\nHope this works!';
    const result = salvageJson(input);
    expect(result).not.toBeNull();
    const parsed = JSON.parse(result!);
    expect(parsed.styleName).toBe('极简白');
  });

  it('handles nested braces in string values', () => {
    const input = '{"styleName":"测试{内容}","fontId":"georgia-calibri","density":"moderate","mood":"{专业}","bestFor":["数学"]}';
    const result = salvageJson(input);
    expect(result).not.toBeNull();
    const parsed = JSON.parse(result!);
    expect(parsed.styleName).toBe('测试{内容}');
  });
});

// ══════════════════════════════════════════════════════════════════════
// coverSkeletonSchema tests
// ══════════════════════════════════════════════════════════════════════

describe('coverSkeletonSchema', () => {
  it('accepts valid skeleton', () => {
    const input = {
      styleName: '科技暗金',
      fontId: 'georgia-calibri',
      density: 'moderate',
      mood: '专业学术',
      bestFor: ['数学', '物理'],
    };
    const result = coverSkeletonSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it('rejects missing styleName', () => {
    const input = { fontId: 'georgia-calibri', density: 'moderate', mood: '专业', bestFor: ['数学'] };
    const result = coverSkeletonSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('rejects styleName too long (>12)', () => {
    // 18 characters total
    const input = { styleName: '这是一个超过十二个字的风格名称', fontId: 'georgia-calibri', density: 'moderate', mood: '专业', bestFor: ['数学'] };
    const result = coverSkeletonSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('rejects invalid fontId', () => {
    const input = { styleName: '测试', fontId: 'nonexistent-font', density: 'moderate', mood: '专业', bestFor: ['数学'] };
    const result = coverSkeletonSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('rejects invalid density', () => {
    const input = { styleName: '测试', fontId: 'georgia-calibri', density: 'ultra-dense', mood: '专业', bestFor: ['数学'] };
    const result = coverSkeletonSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('accepts bestFor with up to 20 chars per item', () => {
    const input = {
      styleName: '测试',
      fontId: 'georgia-calibri',
      density: 'moderate',
      mood: '专业学术',
      bestFor: ['高等数学与微积分应用'], // 9 chars, within limit
    };
    const result = coverSkeletonSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it('rejects bestFor item >20 chars', () => {
    // 22 characters
    const input = {
      styleName: '测试',
      fontId: 'georgia-calibri',
      density: 'moderate',
      mood: '专业',
      bestFor: ['这是一个超过二十个字符的学科名称标签测试超长'],
    };
    const result = coverSkeletonSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('rejects empty bestFor array', () => {
    const input = { styleName: '测试', fontId: 'georgia-calibri', density: 'moderate', mood: '专业', bestFor: [] };
    const result = coverSkeletonSchema.safeParse(input);
    expect(result.success).toBe(false);
  });
});

// ══════════════════════════════════════════════════════════════════════
// assembleDesignDNA tests
// ══════════════════════════════════════════════════════════════════════

describe('assembleDesignDNA', () => {
  const validSkeleton = {
    styleName: '科技暗金',
    fontId: 'arial-black-arial' as const,
    density: 'moderate' as const,
    mood: '专业学术',
    bestFor: ['数学'],
  };

  it('produces valid DesignDNA', () => {
    const dna = assembleDesignDNA(validSkeleton, 'midnight-executive', 'geometric-lines', 'hero-centered');
    expect(dna.styleName).toBe('科技暗金');
    expect(dna.mood).toBe('专业学术');
    expect(dna.colors).toBeDefined();
    expect(dna.colors.coverBg).toBeDefined();
    expect(dna.fonts).toBeDefined();
    expect(dna.fonts.heading).toBeDefined();
    expect(dna.decoration.motif).toBe('geometric-lines');
    expect(dna.decoration.density).toBe('moderate');
    expect(dna.layoutType).toBe('hero-centered');
    expect(dna.bestFor).toEqual(['数学']);
  });

  it('falls back to midnight-executive palette for invalid paletteId', () => {
    const dna = assembleDesignDNA(validSkeleton, '__nonexistent__', 'geometric-lines', 'hero-centered');
    expect(dna.colors.coverBg).toBe('1E2761'); // midnight-executive default
  });

  it('falls back to arial-black-arial for invalid fontId', () => {
    const badSkeleton = { ...validSkeleton, fontId: 'bad-font' as never };
    const dna = assembleDesignDNA(badSkeleton, 'midnight-executive', 'geometric-lines', 'hero-centered');
    expect(dna.fonts.en).toBe('Arial Black'); // arial-black-arial default
  });

  it('derives card style from motif (chinese-seal → accent-left-bar)', () => {
    const dna = assembleDesignDNA(validSkeleton, 'midnight-executive', 'chinese-seal', 'vertical-poem');
    expect(dna.components.cardStyle).toBe('accent-left-bar');
  });

  it('derives bullet style from motif (chinese-seal → chinese-brush)', () => {
    const dna = assembleDesignDNA(validSkeleton, 'midnight-executive', 'chinese-seal', 'vertical-poem');
    expect(dna.components.bulletStyle).toBe('chinese-brush');
  });

  it('derives bullet style from motif (geometric-lines → dot)', () => {
    const dna = assembleDesignDNA(validSkeleton, 'midnight-executive', 'geometric-lines', 'hero-centered');
    expect(dna.components.bulletStyle).toBe('dot');
  });

  it('derives page number style from motif (chinese-seal → circle-number)', () => {
    const dna = assembleDesignDNA(validSkeleton, 'midnight-executive', 'chinese-seal', 'vertical-poem');
    expect(dna.components.pageNumberStyle).toBe('circle-number');
  });

  it('derives card style from motif (ink-wash → shadow-only)', () => {
    const dna = assembleDesignDNA(validSkeleton, 'midnight-executive', 'ink-wash', 'hero-centered');
    expect(dna.components.cardStyle).toBe('shadow-only');
  });
});

// ══════════════════════════════════════════════════════════════════════
// Integration: full flow simulation (salvage → schema → assemble)
// ══════════════════════════════════════════════════════════════════════

describe('full flow: salvage → schema → assemble', () => {
  it('handles realistic LLM output (markdown fence + valid content)', () => {
    const rawLLM = '```json\n{"styleName":"极简白","fontId":"noto-sans","density":"sparse","mood":"清爽干净","bestFor":["语文","英语"]}\n```';

    const repaired = salvageJson(rawLLM);
    expect(repaired).not.toBeNull();

    const parsed = JSON.parse(repaired!);
    const zodResult = coverSkeletonSchema.safeParse(parsed);
    expect(zodResult.success).toBe(true);

    if (zodResult.success) {
      const dna = assembleDesignDNA(zodResult.data, 'zen-minimal', 'minimal-type', 'minimal-type');
      expect(dna.styleName).toBe('极简白');
      expect(dna.colors).toBeDefined();
      expect(dna.fonts).toBeDefined();
    }
  });

  it('handles truncated LLM output (auto-close + valid content)', () => {
    const rawLLM = '{"styleName":"书香墨韵","fontId":"lora-inter","density":"moderate","mood":"典雅古朴","bestFor":["历史"';

    const repaired = salvageJson(rawLLM);
    expect(repaired).not.toBeNull();

    const parsed = JSON.parse(repaired!);
    const zodResult = coverSkeletonSchema.safeParse(parsed);
    expect(zodResult.success).toBe(true);

    if (zodResult.success) {
      expect(zodResult.data.styleName).toBe('书香墨韵');
      expect(zodResult.data.bestFor).toEqual(['历史']);
    }
  });

  it('handles LLM output with explanation text around JSON', () => {
    const rawLLM = '好的，这是为您设计的封面：\n{"styleName":"深邃极简","fontId":"impact-arial","density":"sparse","mood":"理性科技","bestFor":["物理"]}\n希望您满意！';

    const repaired = salvageJson(rawLLM);
    expect(repaired).not.toBeNull();

    const parsed = JSON.parse(repaired!);
    const zodResult = coverSkeletonSchema.safeParse(parsed);
    expect(zodResult.success).toBe(true);
  });

  it('handles trailing comma + truncated combo', () => {
    const rawLLM = '{"styleName":"科技暗金","fontId":"georgia-calibri","density":"rich","mood":"专业学术","bestFor":["数学","物理",';

    const repaired = salvageJson(rawLLM);
    expect(repaired).not.toBeNull();

    const parsed = JSON.parse(repaired!);
    expect(parsed.bestFor).toEqual(['数学', '物理']);
  });
});

// ══════════════════════════════════════════════════════════════════════
// getMotifsForTopic tests
// ══════════════════════════════════════════════════════════════════════

describe('getMotifsForTopic', () => {
  it('returns exactly 12 motifs', () => {
    const motifs = getMotifsForTopic('英语');
    expect(motifs).toHaveLength(12);
  });

  it('all returned motifs are valid', () => {
    const validMotifs = ['geometric-lines', 'ink-wash', 'neon-grid', 'organic-circles', 'chinese-seal'];
    for (const topic of ['英语', '量子力学', '生物学', '随便什么']) {
      const motifs = getMotifsForTopic(topic);
      for (const m of motifs) {
        expect(validMotifs).toContain(m);
      }
    }
  });

  // ── Humanities topics ──

  it('humanities: "英语" → top motifs are ink-wash/chinese-seal/organic-circles', () => {
    const motifs = getMotifsForTopic('英语');
    const top6 = motifs.slice(0, 6);
    // No geometric-lines or neon-grid in top half
    for (const m of top6) {
      expect(['ink-wash', 'chinese-seal', 'organic-circles']).toContain(m);
    }
  });

  it('humanities: "语文" → no geometric-lines in top 9', () => {
    const motifs = getMotifsForTopic('语文');
    // TIER_QUOTAS: first 3 tiers = 5+4+3 = 12 slots for humanities
    // humanities tiers: ink-wash, chinese-seal, organic-circles — no geometric-lines at all
    const unique = new Set(motifs);
    expect(unique.has('geometric-lines')).toBe(false);
    expect(unique.has('neon-grid')).toBe(false);
  });

  it('humanities: "历史文学" → dominated by ink-wash and chinese-seal', () => {
    const motifs = getMotifsForTopic('历史文学');
    const count = (m: string) => motifs.filter((x) => x === m).length;
    expect(count('ink-wash') + count('chinese-seal')).toBeGreaterThanOrEqual(9); // 5+4
  });

  // ── STEM topics ──

  it('stem: "量子力学" → top motifs are geometric-lines/neon-grid', () => {
    const motifs = getMotifsForTopic('量子力学');
    const top6 = motifs.slice(0, 6);
    for (const m of top6) {
      expect(['geometric-lines', 'neon-grid', 'organic-circles']).toContain(m);
    }
  });

  it('stem: "计算机编程" → no humanities motifs', () => {
    const motifs = getMotifsForTopic('计算机编程');
    const unique = new Set(motifs);
    expect(unique.has('ink-wash')).toBe(false);
    expect(unique.has('chinese-seal')).toBe(false);
  });

  it('stem: "微积分" → dominated by geometric-lines and neon-grid', () => {
    const motifs = getMotifsForTopic('微积分');
    const count = (m: string) => motifs.filter((x) => x === m).length;
    expect(count('geometric-lines') + count('neon-grid')).toBeGreaterThanOrEqual(9);
  });

  // ── Science topics ──

  it('science: "生物学" → organic-circles dominates', () => {
    const motifs = getMotifsForTopic('生物学');
    const top = motifs.filter((m) => m === 'organic-circles').length;
    expect(top).toBeGreaterThanOrEqual(5); // tier 1
  });

  it('science: "地理地质" → no humanities motifs', () => {
    const motifs = getMotifsForTopic('地理地质');
    const unique = new Set(motifs);
    expect(unique.has('ink-wash')).toBe(false);
    expect(unique.has('chinese-seal')).toBe(false);
  });

  // ── General topics (no match) ──

  it('general: unknown topic → includes all 5 motifs', () => {
    const motifs = getMotifsForTopic('随便一个没匹配的话题');
    const unique = new Set(motifs);
    expect(unique.size).toBeGreaterThanOrEqual(4);
  });

  // ── English keyword matching ──

  it('matches English keywords: "English literature" → humanities', () => {
    const motifs = getMotifsForTopic('English literature');
    const unique = new Set(motifs);
    expect(unique.has('geometric-lines')).toBe(false);
    expect(unique.has('neon-grid')).toBe(false);
  });

  it('matches English keywords: "quantum mechanics" → stem', () => {
    const motifs = getMotifsForTopic('quantum mechanics');
    const unique = new Set(motifs);
    expect(unique.has('ink-wash')).toBe(false);
    expect(unique.has('chinese-seal')).toBe(false);
  });

  // ── Edge cases ──

  it('empty string → returns general (all motifs)', () => {
    const motifs = getMotifsForTopic('');
    expect(motifs).toHaveLength(12);
    const unique = new Set(motifs);
    expect(unique.size).toBeGreaterThanOrEqual(4);
  });

  it('topic with special regex chars → no crash', () => {
    expect(() => getMotifsForTopic('C++编程 (进阶)')).not.toThrow();
    expect(() => getMotifsForTopic('数学[1]')).not.toThrow();
  });
});
