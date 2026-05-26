import { describe, expect, test } from 'vitest';
import {
  TEMPLATE_CAPACITIES,
  getTemplateCapacity,
  validateCapacityRegistry,
} from '@/lib/slides/content-sizing';
import { getAllTemplateDescriptorsV2 } from '@/lib/slides/slide-templates-v2';

describe('capacity-registry', () => {
  test('every registered template has a capacity definition', () => {
    const descriptors = getAllTemplateDescriptorsV2();
    const ids = descriptors.map((d) => d.id);
    const { complete, missing } = validateCapacityRegistry(ids);

    expect(complete).toBe(true);
    expect(missing).toEqual([]);
  });

  test('all capacities have positive limits', () => {
    Object.values(TEMPLATE_CAPACITIES).forEach((cap) => {
      expect(cap.maxChars).toBeGreaterThanOrEqual(0);
      expect(cap.maxLines).toBeGreaterThanOrEqual(0);
      expect(cap.maxBullets).toBeGreaterThanOrEqual(0);
      expect(cap.maxBulletChars).toBeGreaterThanOrEqual(0);
      expect(cap.maxItems).toBeGreaterThanOrEqual(0);
    });
  });

  test('cover templates have small char budgets', () => {
    expect(getTemplateCapacity('cover-classic')?.maxChars).toBeLessThan(150);
    expect(getTemplateCapacity('cover-bold')?.maxChars).toBeLessThan(150);
  });

  test('content templates have larger char budgets', () => {
    expect(getTemplateCapacity('content-title-body')?.maxChars).toBeGreaterThan(200);
    expect(getTemplateCapacity('content-bullets')?.maxChars).toBeGreaterThan(200);
  });

  test('bullet templates define bullet limits', () => {
    const bulletsCap = getTemplateCapacity('content-bullets');
    expect(bulletsCap?.maxBullets).toBeGreaterThan(0);
    expect(bulletsCap?.maxBulletChars).toBeGreaterThan(0);
  });
});
