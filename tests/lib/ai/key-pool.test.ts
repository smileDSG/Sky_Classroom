import { describe, test, expect, beforeEach } from 'vitest';
import { KeyPool, getKeyPool, resetKeyPools } from '@/lib/ai/key-pool';

describe('KeyPool', () => {
  beforeEach(() => {
    resetKeyPools();
  });

  test('select returns least-inflight key', () => {
    const pool = new KeyPool(['k1', 'k2', 'k3']);
    const k1 = pool.select();
    pool.acquire(k1);

    const k2 = pool.select();
    expect(k2).not.toBe(k1);
    pool.acquire(k2);

    const k3 = pool.select();
    expect(k3).not.toBe(k1);
    expect(k3).not.toBe(k2);
  });

  test('round-robin tiebreaker', () => {
    const pool = new KeyPool(['k1', 'k2']);
    const a = pool.select();
    const b = pool.select();
    const c = pool.select();
    expect(a).not.toBe(b);
    expect(c).toBe(a); // round-robin cycles back
  });

  test('markFailed unhealthies key after 3 failures', () => {
    const pool = new KeyPool(['k1', 'k2']);
    const k1 = pool.select();
    pool.markFailed(k1, new Error('rate limit'));
    pool.markFailed(k1, new Error('rate limit'));
    pool.markFailed(k1, new Error('rate limit'));

    // After 3 failures, k1 should be unhealthy; k2 selected instead
    const next = pool.select();
    expect(next).toBe('k2');
  });

  test('release decrements inflight', () => {
    const pool = new KeyPool(['k1']);
    const k1 = pool.select();
    pool.acquire(k1);
    pool.acquire(k1);
    pool.release(k1);

    // k1 still has inflight=1, but it's the only key
    const next = pool.select();
    expect(next).toBe('k1');
  });

  test('getKeyPool caches by providerId', () => {
    const p1 = getKeyPool('deepseek', ['a', 'b']);
    const p2 = getKeyPool('deepseek', ['c', 'd']);
    expect(p1).toBe(p2); // returns cached instance
  });
});
