/**
 * B-006: Avatar presets tests
 */
import { describe, it, expect } from 'vitest';
import { AVATAR_PRESETS, getAvatarPresetById } from '@/lib/slides/avatar-presets';

const VALID_STYLES = [
  'academic',
  'friendly',
  'humorous',
  'curious',
  'analytical',
  'creative',
  'organized',
];

describe('AVATAR_PRESETS', () => {
  it('has exactly 7 presets', () => {
    expect(AVATAR_PRESETS).toHaveLength(7);
  });

  it('every preset has non-empty id, name, avatarUrl, description, style', () => {
    for (const p of AVATAR_PRESETS) {
      expect(p.id.length).toBeGreaterThan(0);
      expect(p.name.length).toBeGreaterThan(0);
      expect(p.avatarUrl.length).toBeGreaterThan(0);
      expect(p.description.length).toBeGreaterThan(0);
      expect(p.style.length).toBeGreaterThan(0);
    }
  });

  it('every preset has a valid style value', () => {
    for (const p of AVATAR_PRESETS) {
      expect(VALID_STYLES).toContain(p.style);
    }
  });

  it('all ids are unique', () => {
    const ids = AVATAR_PRESETS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('all names are unique', () => {
    const names = AVATAR_PRESETS.map((p) => p.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('getAvatarPresetById returns correct preset', () => {
    const preset = getAvatarPresetById('curious-explorer');
    expect(preset).toBeDefined();
    expect(preset!.name).toBe('好奇宝宝');
    expect(preset!.style).toBe('curious');
  });

  it('getAvatarPresetById returns undefined for unknown id', () => {
    expect(getAvatarPresetById('non-existent')).toBeUndefined();
  });

  it('all preset avatarUrls are valid paths', () => {
    for (const p of AVATAR_PRESETS) {
      expect(p.avatarUrl).toMatch(/^\/avatars\//);
      expect(p.avatarUrl).toMatch(/\.(png|svg)$/);
    }
  });
});
