import { useEffect, useEffectEvent } from 'react';

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Focus handling for modal dialogs: on open, focus moves inside (to
 * `initialFocusRef` if given, else the first focusable element); Tab and
 * Shift+Tab stay inside the dialog; Escape calls onClose; on close, focus
 * returns to whatever opened the dialog.
 */
export const useDialogFocus = (isOpen, containerRef, onClose, initialFocusRef) => {
  // Always calls the latest onClose without re-running the effect (and re-moving focus) when the
  // parent passes a new function on every render
  const close = useEffectEvent(() => onClose?.());

  useEffect(() => {
    if (!isOpen) return undefined;
    const opener = document.activeElement;
    const container = containerRef.current;

    const target = initialFocusRef?.current || container?.querySelector(FOCUSABLE) || container;
    target?.focus({ preventScroll: true });

    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        close();
        return;
      }
      if (e.key !== 'Tab' || !container) return;
      const items = [...container.querySelectorAll(FOCUSABLE)].filter((el) => el.offsetParent !== null);
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      if (opener && typeof opener.focus === 'function' && document.contains(opener)) {
        opener.focus({ preventScroll: true });
      }
    };
  }, [isOpen, containerRef, initialFocusRef]);
};
