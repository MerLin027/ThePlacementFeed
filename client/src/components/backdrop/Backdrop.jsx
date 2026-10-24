import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useLocation } from 'react-router';
import { createDotField } from './dotField';
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion';

// A mouse or trackpad (live, so plugging a mouse into a touch laptop switches it on)
const FINE_POINTER = '(hover: hover) and (pointer: fine)';
const subscribePointer = (onChange) => {
  const mq = window.matchMedia(FINE_POINTER);
  mq.addEventListener('change', onChange);
  return () => mq.removeEventListener('change', onChange);
};
const finePointerSnapshot = () => window.matchMedia(FINE_POINTER).matches;

// Home and the sign-in pages get the full effect, admin pages stay still, the rest is subtle
const intensityFor = (pathname) => {
  if (['/', '/login', '/signup', '/admin/login'].includes(pathname)) return 'hero';
  if (pathname.startsWith('/admin')) return 'static';
  return 'content';
};

// VITE_BACKDROP=static turns the moving dots off site-wide without a code change
const FORCE_STATIC = import.meta.env.VITE_BACKDROP === 'static';

/**
 * The site-wide dotted background, fixed behind everything (outside <main>, so no page wrapper ever
 * gets a transform). A CSS dot grid and two slowly drifting glows are always there; with a mouse
 * and motion allowed, a canvas (dotField.js) takes over the dots and makes them react to the cursor.
 * Touch screens, reduced motion and admin pages keep the still grid.
 */
const Backdrop = () => {
  const { pathname } = useLocation();
  const intensity = intensityFor(pathname);
  const reduced = usePrefersReducedMotion();
  const finePointer = useSyncExternalStore(subscribePointer, finePointerSnapshot, () => false);
  const [failed, setFailed] = useState(false);
  const canvasRef = useRef(null);

  const live = !FORCE_STATIC && !failed && !reduced && finePointer && intensity !== 'static';

  useEffect(() => {
    if (!live || !canvasRef.current) return undefined;
    const field = createDotField(canvasRef.current, {
      intensity,
      // Frame counter for the regression tests (dev builds only)
      onFrame: import.meta.env.DEV ? () => { window.__tpfBackdropFrames = (window.__tpfBackdropFrames || 0) + 1; } : undefined,
    });
    if (!field) {
      setFailed(true);
      return undefined;
    }
    return () => field.destroy();
    // A route change between hero and content rebuilds the field (about the cost of a resize)
  }, [live, intensity]);

  return (
    <div
      aria-hidden="true"
      data-backdrop={live ? 'live' : 'static'}
      data-intensity={intensity}
      className="backdrop fixed inset-0 -z-10 pointer-events-none overflow-hidden"
    >
      <div className="backdrop-glow" />
      <div className="backdrop-dots" />
      {live && <canvas ref={canvasRef} className="absolute inset-0" />}
    </div>
  );
};

export default Backdrop;
