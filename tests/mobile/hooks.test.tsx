import { renderHook, act } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import { useIsMobile } from '@/components/mobile/hooks/use-is-mobile';
import { useMobileViewport } from '@/components/mobile/hooks/use-mobile-viewport';
import { useKeyboardInset } from '@/components/mobile/hooks/use-keyboard-inset';

function resizeTo(width: number, height: number) {
  Object.defineProperty(window, 'innerWidth', {
    configurable: true,
    value: width,
  });
  Object.defineProperty(window, 'innerHeight', {
    configurable: true,
    value: height,
  });
  window.dispatchEvent(new Event('resize'));
}

describe('mobile hooks', () => {
  test('useIsMobile returns true under the md breakpoint after mount', () => {
    resizeTo(390, 844);

    const { result } = renderHook(() => useIsMobile());

    expect(result.current).toBe(true);
  });

  test('useIsMobile returns false at desktop width', () => {
    resizeTo(1024, 768);

    const { result } = renderHook(() => useIsMobile());

    expect(result.current).toBe(false);
  });

  test('useMobileViewport tracks width height and orientation', () => {
    resizeTo(667, 375);

    const { result } = renderHook(() => useMobileViewport());

    expect(result.current.width).toBe(667);
    expect(result.current.height).toBe(375);
    expect(result.current.orientation).toBe('landscape');

    act(() => resizeTo(390, 844));

    expect(result.current.width).toBe(390);
    expect(result.current.height).toBe(844);
    expect(result.current.orientation).toBe('portrait');
  });

  test('useKeyboardInset returns 0 when visualViewport is unavailable', () => {
    const originalVisualViewport = window.visualViewport;
    // @ts-expect-error - simulating absence of visualViewport
    window.visualViewport = undefined;

    const { result } = renderHook(() => useKeyboardInset());

    expect(result.current).toBe(0);

    window.visualViewport = originalVisualViewport;
  });
});
