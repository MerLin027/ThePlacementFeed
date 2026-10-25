import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, m } from 'motion/react';
import PresenceGuard from './PresenceGuard';

const barSpring = { type: 'spring', stiffness: 460, damping: 36, mass: 0.9 };

/**
 * Floating action bar for a list selection (e.g. applicants): springs up at the bottom centre when
 * the first row is selected and slides away when the selection is cleared. It floats over the page,
 * so the table never shifts. While it is open, toasts are lifted above it (--selection-bar-lift, read
 * by the Toaster in App.jsx). On phones it spans the width and wraps its actions under the count.
 *
 * children: the actions (buttons, selects) styled for the dark bar.
 */
const SelectionBar = ({ count, onClear, label = 'Bulk actions', children }) => {
  const visible = count > 0;
  const barRef = useRef(null);

  useEffect(() => {
    if (!visible) return undefined;
    const root = document.documentElement;
    const bar = barRef.current;
    const lift = () => root.style.setProperty('--selection-bar-lift', `${(bar?.offsetHeight || 64) + 12}px`);
    lift();
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(lift) : null;
    if (bar) observer?.observe(bar);
    return () => {
      observer?.disconnect();
      root.style.removeProperty('--selection-bar-lift');
    };
  }, [visible]);

  return createPortal(
    <AnimatePresence>
      {visible && (
        <m.div
          key="selection-bar"
          ref={barRef}
          initial={{ y: 40, opacity: 0, scale: 0.96 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: 32, opacity: 0, scale: 0.97, transition: { duration: 0.16 } }}
          transition={barSpring}
          role="region"
          aria-label={label}
          className="fixed z-40 bottom-3 inset-x-2 sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 sm:bottom-5 sm:max-w-[calc(100vw-2rem)]"
        >
          <PresenceGuard>
            <div className="flex flex-wrap sm:flex-nowrap items-center gap-x-1.5 gap-y-1 pl-4 pr-1.5 py-1.5 rounded-2xl sm:rounded-full bg-brand-navy text-white shadow-pop ring-1 ring-white/10">
              <p className="flex-1 sm:flex-none font-label-md text-label-md whitespace-nowrap pr-1" aria-live="polite">
                {/* The number rolls in on every change */}
                <m.span
                  key={count}
                  initial={{ y: -6, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ duration: 0.18 }}
                  className="inline-block tabular-nums font-semibold"
                >
                  {count}
                </m.span>{' '}
                selected
              </p>
              <span className="hidden sm:block w-px h-6 bg-white/15 mx-1" aria-hidden="true" />
              <div className="order-last sm:order-none w-full sm:w-auto flex flex-wrap items-center gap-1.5">{children}</div>
              <button
                type="button"
                onClick={onClear}
                aria-label="Clear selection"
                title="Clear selection"
                className="inline-flex items-center justify-center w-[44px] h-[44px] rounded-full text-white/70 hover:text-white hover:bg-white/10 active:scale-95 transition-control focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-white/60"
              >
                <span className="material-symbols-outlined text-[20px]" aria-hidden="true">close</span>
              </button>
            </div>
          </PresenceGuard>
        </m.div>
      )}
    </AnimatePresence>,
    document.body
  );
};

export default SelectionBar;
