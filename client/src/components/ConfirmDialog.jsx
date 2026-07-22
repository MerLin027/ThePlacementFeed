const ConfirmDialog = ({ isOpen, onClose, onConfirm, title, message }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-sm">
      <div
        className="fixed inset-0 bg-on-surface/50 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative bg-surface-container-lowest rounded-xl shadow-2xl w-full max-w-md z-10 p-md">
        {/* Warning icon */}
        <div className="mx-auto w-12 h-12 rounded-full bg-error-container flex items-center justify-center mb-sm">
          <span className="material-symbols-outlined text-error text-[24px]">warning</span>
        </div>
        <h3 className="font-headline-sm text-headline-sm text-on-surface text-center mb-xs">
          {title || 'Confirm Delete'}
        </h3>
        <p className="font-body-sm text-body-sm text-on-surface-variant text-center mb-md">
          {message || 'Are you sure? This action cannot be undone.'}
        </p>
        <div className="flex gap-sm">
          <button
            onClick={onClose}
            className="btn-secondary flex-1"
          >
            Cancel
          </button>
          <button
            onClick={() => { onConfirm(); onClose(); }}
            className="btn-danger flex-1"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmDialog;
