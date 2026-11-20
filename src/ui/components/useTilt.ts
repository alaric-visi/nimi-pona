import type { RefObject } from 'preact';

const MAX_DEG = 3.5;

const enabled = () =>
  typeof matchMedia !== 'undefined' &&
  matchMedia('(hover: hover) and (pointer: fine)').matches &&
  !matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * A gentle paper-card tilt that follows the mouse. Writes CSS variables directly
 * (no re-render); does nothing on touch devices or with reduced motion.
 */
export function useTilt(ref: RefObject<HTMLElement | null>) {
  return {
    onPointerMove(e: PointerEvent) {
      const el = ref.current;
      if (!el || e.pointerType !== 'mouse' || !enabled()) return;
      const r = el.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5;
      const y = (e.clientY - r.top) / r.height - 0.5;
      el.style.setProperty('--tilt-x', `${(x * MAX_DEG * 2).toFixed(2)}deg`);
      el.style.setProperty('--tilt-y', `${(-y * MAX_DEG * 2).toFixed(2)}deg`);
    },
    onPointerLeave() {
      const el = ref.current;
      el?.style.setProperty('--tilt-x', '0deg');
      el?.style.setProperty('--tilt-y', '0deg');
    },
  };
}
