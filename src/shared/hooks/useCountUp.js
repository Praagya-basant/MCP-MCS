import { useEffect, useRef, useState } from 'react';

/**
 * Animates 0 -> target over `duration` ms (ease-out cubic). Used by
 * StatCard so dashboard numbers count up on mount instead of just
 * appearing — restarts whenever `target` changes.
 */
export function useCountUp(target, duration = 600) {
  const [display, setDisplay] = useState(0);
  const frameRef = useRef(null);

  useEffect(() => {
    const to = Number(target) || 0;
    const startTime = performance.now();

    function tick(now) {
      const progress = Math.min((now - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(to * eased));
      if (progress < 1) {
        frameRef.current = requestAnimationFrame(tick);
      }
    }

    frameRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameRef.current);
  }, [target, duration]);

  return display;
}
