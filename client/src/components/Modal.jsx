import { useEffect } from 'react';

const Modal = ({ isOpen, onClose, title, children, maxWidth = 'max-w-2xl' }) => {
  // Close on Escape key
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-8 sm:pt-16 px-sm">
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-on-surface/50 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />
      {/* Modal */}
      <div
        className={`relative bg-surface-container-lowest rounded-xl shadow-2xl w-full ${maxWidth} max-h-[85vh] flex flex-col z-10 animate-in`}
      >
        {/* Header */}
        <div className="flex-shrink-0 bg-surface-container-lowest border-b border-outline-variant px-md py-sm rounded-t-xl flex items-center justify-between z-20">
          <h2 className="font-headline-sm text-headline-sm text-on-surface">{title}</h2>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-outline hover:text-on-surface hover:bg-surface-container-low transition-colors"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>
        {/* Body */}
        <div className="flex-1 overflow-y-auto px-md py-md content-scrollbar">
          {children}
        </div>
      </div>
    </div>
  );
};

export default Modal;
