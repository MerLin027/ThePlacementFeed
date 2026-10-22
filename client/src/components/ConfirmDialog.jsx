import { useEffect, useRef } from 'react';

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

  useEffect(() => {
    if (!isOpen) return undefined;
    cancelRef.current?.focus();
    const handleEscape = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const isDanger = tone === 'danger';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-sm">
      <div
        className="fixed inset-0 bg-on-surface/50 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-message"
        className="relative bg-surface-container-lowest rounded-xl shadow-2xl w-full max-w-md z-10 p-md"
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
      </div>
    </div>
  );
};

export default ConfirmDialog;
