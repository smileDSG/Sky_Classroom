import { useRef, useState, useEffect } from 'react';

interface UseAnimatedNumberOptions {
  duration?: number;
  decimals?: number;
  enabled?: boolean;
}

/**
 * Animates a number from 0 to target using ease-out-cubic easing.
 */
export function useAnimatedNumber(
  target: number,
  { duration = 1200, decimals = 0, enabled = true }: UseAnimatedNumberOptions = {},
) {
  const [value, setValue] = useState(0);
  const rafRef = useRef<number>(0);
  const startTimeRef = useRef<number>(0);

  useEffect(() => {
    if (!enabled) {
      setValue(target);
      return;
    }

    cancelAnimationFrame(rafRef.current);
    startTimeRef.current = performance.now();
    const startValue = 0;

    function animate(now: number) {
      const elapsed = now - startTimeRef.current;
      const progress = Math.min(elapsed / duration, 1);
      // ease-out-cubic: 1 - (1 - t)^3
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = startValue + (target - startValue) * eased;

      setValue(current);

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      }
    }

    rafRef.current = requestAnimationFrame(animate);

    return () => cancelAnimationFrame(rafRef.current);
  }, [target, duration, enabled]);

  return {
    value: decimals > 0 ? parseFloat(value.toFixed(decimals)) : Math.round(value),
    raw: value,
  };
}
