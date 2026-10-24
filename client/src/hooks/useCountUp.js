import { useEffect, useRef, useState } from 'react';
import { usePrefersReducedMotion } from './usePrefersReducedMotion';

/**
 * Counts from the previously shown number up (or down) to `value` over `duration` ms, easing out.
 * Under reduced motion the number simply changes.
 */
export const useCountUp = (value, duration = 700) => {
  const reduced = usePrefersReducedMotion();
  const [shown, setShown] = useState(reduced ? value : 0);
  const shownRef = useRef(shown);

  useEffect(() => {
    if (reduced) return undefined; // the value is returned as is below
    const from = shownRef.current;
    if (from === value) return undefined;
    const start = performance.now();
    let frame = requestAnimationFrame(function tick(now) {
      const t = Math.min(1, (now - start) / duration);
      const next = Math.round(from + (value - from) * (1 - (1 - t) ** 3));
      shownRef.current = next;
      setShown(next);
      if (t < 1) frame = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(frame);
  }, [value, duration, reduced]);

  return reduced ? value : shown;
};
