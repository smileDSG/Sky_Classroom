import { describe, expect, test } from 'vitest';
import { fixSlotOverflow } from '@/lib/slides/content-sizing';
import { getTemplateCapacity } from '@/lib/slides/content-sizing';
import type { TemplateSlotV2 } from '@/lib/slides/types';

describe('overflow-handler', () => {
  test('truncate strategy shortens overflowing bodyText', () => {
    const slot: TemplateSlotV2 = {
      template: 'content-title-body',
      params: {
        title: '标题',
        bodyText: '这是正文内容，长度适中，不应该溢出。'.repeat(20),
      },
    };
    const capacity = getTemplateCapacity('content-title-body')!;
    const result = fixSlotOverflow(slot, capacity, 'truncate');

    expect(result.wasFixed).toBe(true);
    expect(result.fixes.some((f) => f.includes('bodyText'))).toBe(true);
    expect(result.slot.params.bodyText).not.toEqual(slot.params.bodyText);
    expect(result.slot.params.bodyText?.length).toBeLessThanOrEqual(capacity.maxChars + 1); // +1 for ellipsis
  });

  test('truncate strategy caps bullet count', () => {
    const slot: TemplateSlotV2 = {
      template: 'content-bullets',
      params: {
        title: '要点',
        bullets: Array.from({ length: 10 }, (_, i) => `要点 ${i + 1}`),
      },
    };
    const capacity = getTemplateCapacity('content-bullets')!;
    const result = fixSlotOverflow(slot, capacity, 'truncate');

    expect(result.wasFixed).toBe(true);
    expect(result.fixes.some((f) => f.includes('bullets'))).toBe(true);
    expect((result.slot.params.bullets as string[]).length).toBe(capacity.maxBullets);
  });

  test('truncate strategy caps bullet char length', () => {
    const longBullet = '这是一个超长的要点内容，' + '啊'.repeat(100);
    const slot: TemplateSlotV2 = {
      template: 'content-bullets',
      params: {
        title: '要点',
        bullets: [longBullet, '短要点'],
      },
    };
    const capacity = getTemplateCapacity('content-bullets')!;
    const result = fixSlotOverflow(slot, capacity, 'truncate');

    expect(result.wasFixed).toBe(true);
    const bullets = result.slot.params.bullets as string[];
    expect(bullets[0].length).toBeLessThanOrEqual(capacity.maxBulletChars + 1);
  });

  test('truncate strategy caps step count', () => {
    const slot: TemplateSlotV2 = {
      template: 'content-steps',
      params: {
        title: '步骤',
        steps: Array.from({ length: 6 }, (_, i) => ({ title: `步骤${i + 1}`, text: '描述' })),
      },
    };
    const capacity = getTemplateCapacity('content-steps')!;
    const result = fixSlotOverflow(slot, capacity, 'truncate');

    expect(result.wasFixed).toBe(true);
    expect((result.slot.params.steps as Array<unknown>).length).toBe(capacity.maxItems);
  });

  test('truncate strategy caps grid item count', () => {
    const slot: TemplateSlotV2 = {
      template: 'content-grid2x2',
      params: {
        title: '网格',
        gridItems: Array.from({ length: 8 }, (_, i) => ({ title: `项${i}`, text: '描述' })),
      },
    };
    const capacity = getTemplateCapacity('content-grid2x2')!;
    const result = fixSlotOverflow(slot, capacity, 'truncate');

    expect(result.wasFixed).toBe(true);
    expect((result.slot.params.gridItems as Array<unknown>).length).toBe(capacity.maxItems);
  });

  test('warn strategy does not modify slot', () => {
    const slot: TemplateSlotV2 = {
      template: 'content-title-body',
      params: {
        title: '标题',
        bodyText: '溢'.repeat(500),
      },
    };
    const capacity = getTemplateCapacity('content-title-body')!;
    const result = fixSlotOverflow(slot, capacity, 'warn');

    expect(result.wasFixed).toBe(false);
    expect(result.fixes.length).toBeGreaterThan(0);
    expect(result.slot.params.bodyText).toEqual(slot.params.bodyText);
  });

  test('scale strategy returns not-yet-implemented', () => {
    const slot: TemplateSlotV2 = {
      template: 'content-title-body',
      params: { title: '标题', bodyText: '短文本' },
    };
    const capacity = getTemplateCapacity('content-title-body')!;
    const result = fixSlotOverflow(slot, capacity, 'scale');

    expect(result.wasFixed).toBe(false);
    expect(result.fixes[0]).toContain('not yet implemented');
  });

  test('no fix needed for content within capacity', () => {
    const slot: TemplateSlotV2 = {
      template: 'content-title-body',
      params: {
        title: '简短标题',
        bodyText: '这是正文内容，长度适中，不应该溢出。',
      },
    };
    const capacity = getTemplateCapacity('content-title-body')!;
    const result = fixSlotOverflow(slot, capacity, 'truncate');

    expect(result.wasFixed).toBe(false);
    expect(result.fixes).toHaveLength(0);
    expect(result.slot.params.bodyText).toEqual(slot.params.bodyText);
  });
});
