import { renderHook, act } from '@testing-library/react';
import { useAnimatedNumber } from '@/lib/hooks/use-animated-number';
import { vi } from 'vitest';

describe('useAnimatedNumber', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('animates from 0 to target value', () => {
    const { result } = renderHook(() => useAnimatedNumber(42, { duration: 1000 }));
    // At start, value should be 0
    expect(result.current.value).toBe(0);
    // Advance full duration
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    // Should reach target (rounded)
    expect(Math.round(result.current.value)).toBe(42);
  });

  it('animates when target changes', () => {
    const { result, rerender } = renderHook(
      ({ target }: { target: number }) => useAnimatedNumber(target, { duration: 1000 }),
      { initialProps: { target: 10 } },
    );
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(Math.round(result.current.value)).toBe(10);
    rerender({ target: 25 });
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(Math.round(result.current.value)).toBe(25);
  });

  it('returns decimals when specified', () => {
    const { result } = renderHook(() => useAnimatedNumber(78.5, { decimals: 1, duration: 500 }));
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(result.current.value.toFixed(1)).toBe('78.5');
  });
});
