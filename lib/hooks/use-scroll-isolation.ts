'use client';

import { useEffect, type RefObject } from 'react';

/**
 * Prevents scroll chaining on a scrollable element.
 *
 * When the user scrolls (wheel or trackpad) inside the target element and hits
 * the top or bottom boundary, the event is cancelled so the parent scrollable
 * container does NOT take over.
 *
 * Must be paired with `overscroll-behavior: contain` on the same element for
 * scrollbar-drag protection — the JS handler only covers wheel events.
 */
export function useScrollIsolation(ref: RefObject<HTMLElement | null>, enabled: boolean) {
  useEffect(() => {
    const el = ref.current;
    if (!el || !enabled) return;

    const onWheel = (e: WheelEvent) => {
      const { scrollTop, scrollHeight, clientHeight } = el;
      const atTop = scrollTop <= 0;
      const atBottom = scrollTop + clientHeight >= scrollHeight - 1;
      if ((e.deltaY < 0 && atTop) || (e.deltaY > 0 && atBottom)) {
        e.preventDefault();
      }
    };

    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [ref, enabled]);
}
