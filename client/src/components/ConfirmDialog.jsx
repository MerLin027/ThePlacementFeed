import { useRef } from 'react';
import { createPortal } from 'react-dom';
import { useDialogFocus } from '../hooks/useDialogFocus';
import { AnimatePresence, m } from 'motion/react';
import { dialogOverlay, dialogBackdrop, dialogPanel } from '../utils/motion';
import PresenceGuard from './PresenceGuard';

/**
 * Confirmation dialog. Defaults to the destructive "Delete" variant used across
 * the admin dashboard; `tone="primary"` gives a non-destructive confirm.
 * Cancel gets initial focus so Enter never confirms by accident; Escape closes.
 */
const ConfirmDialog = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Delete',
  tone = 'danger',
  icon,
}) => {
  const cancelRef = useRef(null);
  const panelRef = useRef(null);
  useDialogFocus(isOpen, panelRef, onClose, cancelRef);

  const isDanger = tone === 'danger';

  // Rendered at the end of <body>: no page wrapper (fade-in layer, transforms) can sit above it.
  // AnimatePresence keeps it mounted for its short exit after closing.
  return createPortal(
    <AnimatePresence>
    {isOpen && (
    <m.div key="confirm" {...dialogOverlay} className="fixed inset-0 z-50 flex items-center justify-center px-sm">
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
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-message"
        className="relative bg-surface-container-lowest rounded-2xl shadow-pop w-full max-w-(--container-md) z-10 p-md"
      >
        <div
          className={`mx-auto w-12 h-12 rounded-full flex items-center justify-center mb-sm ${
            isDanger ? 'bg-error-container' : 'bg-primary-fixed'
          }`}
        >
          <span
            className={`material-symbols-outlined text-[24px] ${isDanger ? 'text-error' : 'text-on-primary-fixed'}`}
            aria-hidden="true"
          >
            {icon || (isDanger ? 'warning' : 'help')}
          </span>
        </div>
        <h3 id="confirm-dialog-title" className="font-headline-sm text-headline-sm text-on-surface text-center mb-xs">
          {title || 'Confirm Delete'}
        </h3>
        <p id="confirm-dialog-message" className="font-body-sm text-body-sm text-on-surface-variant text-center mb-md">
          {message || 'Are you sure? This action cannot be undone.'}
        </p>
        <div className="flex gap-sm">
          <button
            ref={cancelRef}
            type="button"
            onClick={onClose}
            className="btn-secondary flex-1 min-h-[44px]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => { onConfirm(); onClose(); }}
            className={`${isDanger ? 'btn-danger' : 'btn-primary'} flex-1 min-h-[44px]`}
          >
            {confirmLabel}
          </button>
        </div>
      </m.div>
      </PresenceGuard>
    </m.div>
    )}
    </AnimatePresence>,
    document.body
  );
};

export default ConfirmDialog;
