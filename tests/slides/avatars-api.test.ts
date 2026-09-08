/**
 * B-006: Avatar list API tests
 *
 * Tests GET /api/sky/slides/avatars via Next.js App Router test helpers.
 */
import { describe, it, expect } from 'vitest';
import { GET } from '@/app/api/sky/slides/avatars/route';

describe('GET /api/sky/slides/avatars', () => {
  it('returns 200 with success', async () => {
    const res = await GET();
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
  });

  it('returns exactly 7 avatars', async () => {
    const res = await GET();
    const data = await res.json();
    expect(data.avatars).toHaveLength(7);
  });

  it('each avatar has required fields', async () => {
    const res = await GET();
    const data = await res.json();
    for (const avatar of data.avatars) {
      expect(avatar.id).toBeTruthy();
      expect(avatar.name).toBeTruthy();
      expect(avatar.avatarUrl).toBeTruthy();
      expect(avatar.description).toBeTruthy();
      expect(avatar.style).toBeTruthy();
    }
  });

  it('includes expected avatar names', async () => {
    const res = await GET();
    const data = await res.json();
    const names = data.avatars.map((a: { name: string }) => a.name);
    expect(names).toContain('严肃教授');
    expect(names).toContain('温柔学姐');
    expect(names).toContain('幽默学渣');
    expect(names).toContain('好奇宝宝');
    expect(names).toContain('理性分析师');
    expect(names).toContain('创意梦想家');
    expect(names).toContain('勤奋笔记员');
  });

  it('all styles are valid enum values', async () => {
    const res = await GET();
    const data = await res.json();
    const validStyles = [
      'academic',
      'friendly',
      'humorous',
      'curious',
      'analytical',
      'creative',
      'organized',
    ];
    for (const avatar of data.avatars) {
      expect(validStyles).toContain(avatar.style);
    }
  });
});
