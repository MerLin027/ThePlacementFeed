import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
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

// VITE_BACKDROP=static turns the moving dots off site-wide without a code change
const FORCE_STATIC = import.meta.env.VITE_BACKDROP === 'static';

// Every page uses the landing page's effect
const INTENSITY = 'hero';

/**
 * The site-wide dotted background: the same on every page, fixed behind everything (outside <main>,
 * so no page wrapper ever gets a transform). A CSS dot grid and a soft glow are always there; with a
 * mouse and motion allowed, a canvas (dotField.js) takes over the dots and makes them react to the
 * cursor. Touch screens and reduced motion keep the still grid. It is mounted once (App.jsx), so
 * moving between pages never rebuilds it.
 */
const Backdrop = () => {
  const reduced = usePrefersReducedMotion();
  const finePointer = useSyncExternalStore(subscribePointer, finePointerSnapshot, () => false);
  const [failed, setFailed] = useState(false);
  const canvasRef = useRef(null);

  const live = !FORCE_STATIC && !failed && !reduced && finePointer;

  useEffect(() => {
    if (!live || !canvasRef.current) return undefined;
    const field = createDotField(canvasRef.current, {
      intensity: INTENSITY,
      // Frame counter for the regression tests (dev builds only)
      onFrame: import.meta.env.DEV ? () => { window.__tpfBackdropFrames = (window.__tpfBackdropFrames || 0) + 1; } : undefined,
    });
    if (!field) {
      setFailed(true);
      return undefined;
    }
    return () => field.destroy();
  }, [live]);

  return (
    <div
      aria-hidden="true"
      data-backdrop={live ? 'live' : 'static'}
      data-intensity={INTENSITY}
      className="backdrop fixed inset-0 -z-10 pointer-events-none overflow-hidden"
    >
      <div className="backdrop-glow" />
      <div className="backdrop-dots" />
      {live && <canvas ref={canvasRef} className="absolute inset-0" />}
    </div>
  );
};

export default Backdrop;
