import { describe, it, expect, beforeEach, vi } from 'vitest';
import { KeyRotator } from '@/lib/ai/key-rotator';

describe('KeyRotator', () => {
  let rotator: KeyRotator;

  beforeEach(() => {
    rotator = new KeyRotator();
  });

  it('returns the only key when pool has one', () => {
    rotator.register('deepseek', ['sk-only']);
    expect(rotator.getNextKey('deepseek')).toBe('sk-only');
  });

  it('rotates keys using LRU order', () => {
    rotator.register('deepseek', ['sk-a', 'sk-b', 'sk-c']);
    const first = rotator.getNextKey('deepseek');
    const second = rotator.getNextKey('deepseek');
    const third = rotator.getNextKey('deepseek');
    expect(new Set([first, second, third])).toEqual(new Set(['sk-a', 'sk-b', 'sk-c']));
  });

  it('skips keys in cooldown', () => {
    rotator.register('deepseek', ['sk-a', 'sk-b']);
    rotator.markFailed('sk-a', 'deepseek');
    const key = rotator.getNextKey('deepseek');
    expect(key).toBe('sk-b');
  });

  it('returns null when all keys are in cooldown', () => {
    rotator.register('deepseek', ['sk-a', 'sk-b']);
    rotator.markFailed('sk-a', 'deepseek');
    rotator.markFailed('sk-b', 'deepseek');
    expect(rotator.getNextKey('deepseek')).toBeNull();
  });

  it('resets failure count on success', () => {
    rotator.register('deepseek', ['sk-a']);
    rotator.markFailed('sk-a', 'deepseek');
    rotator.markSuccess('sk-a', 'deepseek');
    expect(rotator.getNextKey('deepseek')).toBe('sk-a');
  });

  it('extends cooldown after 3 consecutive failures', () => {
    rotator.register('deepseek', ['sk-a']);
    rotator.markFailed('sk-a', 'deepseek');
    rotator.markFailed('sk-a', 'deepseek');
    rotator.markFailed('sk-a', 'deepseek');
    expect(rotator.getNextKey('deepseek')).toBeNull();
  });

  it('recovers keys after cooldown expires', () => {
    rotator.register('deepseek', ['sk-a']);
    rotator.markFailed('sk-a', 'deepseek');
    vi.useFakeTimers();
    vi.advanceTimersByTime(61_000);
    expect(rotator.getNextKey('deepseek')).toBe('sk-a');
    vi.useRealTimers();
  });

  it('returns null for unregistered provider', () => {
    expect(rotator.getNextKey('unknown')).toBeNull();
  });

  it('getState returns debug info', () => {
    rotator.register('deepseek', ['sk-a', 'sk-b']);
    const state = rotator.getState();
    expect(state).toHaveProperty('deepseek');
    expect(state.deepseek).toHaveLength(2);
  });
});
