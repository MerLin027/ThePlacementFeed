import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useDialogFocus } from '../hooks/useDialogFocus';
import { AnimatePresence, m } from 'motion/react';
import { dialogOverlay, dialogBackdrop, dialogPanel } from '../utils/motion';
import PresenceGuard from './PresenceGuard';

/**
 * Modal dialog: labelled, focus kept inside while open (Escape closes and
 * focus returns to the opener), page behind it locked from scrolling.
 */
const Modal = ({ isOpen, onClose, title, children, maxWidth = 'max-w-2xl' }) => {
  const titleId = useId();
  const panelRef = useRef(null);
  useDialogFocus(isOpen, panelRef, onClose);

  useEffect(() => {
    if (!isOpen) return undefined;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Rendered at the end of <body>: no page wrapper (fade-in layer, transforms) can sit above it.
  // AnimatePresence keeps it mounted for its short exit after closing.
  return createPortal(
    <AnimatePresence>
    {isOpen && (
    <m.div key="modal" {...dialogOverlay} className="fixed inset-0 z-50 flex items-start justify-center pt-8 sm:pt-16 px-sm">
      <PresenceGuard>
      <m.div
        {...dialogBackdrop}
        className="fixed inset-0 bg-on-surface/50 backdrop-blur-xs"
        onClick={onClose}
        aria-hidden="true"
      />
      <m.div
        {...dialogPanel}
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={`relative bg-surface-container-lowest rounded-xl shadow-2xl w-full ${maxWidth} max-h-[85vh] flex flex-col z-10 focus:outline-hidden`}
      >
        <div className="shrink-0 bg-surface-container-lowest border-b border-outline-variant px-md py-xs rounded-t-2xl flex items-center justify-between gap-sm z-20">
          <h2 id={titleId} className="font-headline-sm text-headline-sm text-on-surface">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="w-[44px] h-[44px] flex items-center justify-center rounded-full text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low transition-colors duration-200 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary"
          >
            <span className="material-symbols-outlined text-[20px]" aria-hidden="true">close</span>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-md py-md content-scrollbar">
          {children}
        </div>
      </m.div>
      </PresenceGuard>
    </m.div>
    )}
    </AnimatePresence>,
    document.body
  );
};

export default Modal;
