import { describe, it, expect } from 'vitest';
import { estimateSpeechDurationMs } from '@/lib/animation/playback/duration';

describe('estimateSpeechDurationMs', () => {
  it('中文按 ~150ms/字', () => {
    expect(estimateSpeechDurationMs('一二三四五')).toBe(5 * 150);
  });

  it('英文按 ~240ms/词', () => {
    expect(estimateSpeechDurationMs('hello world foo')).toBe(3 * 240);
  });

  it('混合文本按 CJK 占比判定且为正', () => {
    const mixed = '这是混合文本 with english words';
    expect(estimateSpeechDurationMs(mixed)).toBeGreaterThan(0);
  });

  it('speed 倍速生效', () => {
    const base = estimateSpeechDurationMs('一二三');
    expect(estimateSpeechDurationMs('一二三', 2)).toBe(base / 2);
  });

  it('空文本返回最小停留时长', () => {
    expect(estimateSpeechDurationMs('')).toBe(800);
  });
});
