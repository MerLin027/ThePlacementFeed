import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, m } from 'motion/react';
import { useDialogFocus } from '../hooks/useDialogFocus';
import { dialogOverlay, dialogBackdrop, dialogPanel } from '../utils/motion';
import PresenceGuard from './PresenceGuard';

/**
 * Shows a one-time password exactly once (after a reset or when a staff account is created). The
 * server never returns it again, so the dialog says so, offers a copy button and keeps the password
 * selectable; closing it is the only way out (no backdrop click), so it isn't dismissed by accident.
 */
const OneTimePasswordDialog = ({ isOpen, onClose, title, who, password }) => {
  const doneRef = useRef(null);
  const panelRef = useRef(null);
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(password);
      setCopied(true);
    } catch {
      // Clipboard blocked: the password stays selectable to copy by hand
      setCopied(false);
    }
  };

  const close = () => {
    setCopied(false);
    onClose();
  };
  useDialogFocus(isOpen, panelRef, close, doneRef);

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <m.div key="otp" {...dialogOverlay} className="fixed inset-0 z-50 flex items-center justify-center px-sm">
          <PresenceGuard>
            <m.div {...dialogBackdrop} className="fixed inset-0 bg-on-surface/50 backdrop-blur-xs" aria-hidden="true" />
            <m.div
              {...dialogPanel}
              ref={panelRef}
              role="alertdialog"
              aria-modal="true"
              aria-labelledby="otp-title"
              aria-describedby="otp-help"
              className="relative bg-surface-container-lowest rounded-2xl shadow-pop w-full max-w-(--container-md) z-10 p-md"
            >
              <div className="mx-auto w-12 h-12 rounded-full flex items-center justify-center mb-sm bg-primary-fixed">
                <span className="material-symbols-outlined text-[24px] text-on-primary-fixed" aria-hidden="true">key</span>
              </div>
              <h2 id="otp-title" className="text-center font-headline-sm text-headline-sm text-on-surface">{title}</h2>
              <p id="otp-help" className="mt-xs text-center font-body-md text-body-md text-on-surface-variant">
                Give this password to {who} in person. It works for 72 hours and only to set a new password.
                <strong className="block mt-1 text-on-surface">It won&apos;t be shown again.</strong>
              </p>

              <div className="mt-sm flex items-center gap-xs rounded-xl border border-outline-variant bg-surface-container-low px-sm py-xs">
                <code className="flex-1 select-all font-mono text-[1.35rem] tracking-wider text-on-surface text-center">
                  {password}
                </code>
                <button
                  type="button"
                  onClick={copy}
                  className="inline-flex items-center gap-1 min-h-[44px] px-sm rounded-full font-label-md text-label-md text-primary hover:bg-primary/8 transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <span className="material-symbols-outlined text-[18px]" aria-hidden="true">{copied ? 'check' : 'content_copy'}</span>
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
              <p className="sr-only" aria-live="polite">{copied ? 'Password copied' : ''}</p>

              <div className="mt-md flex justify-center">
                <button ref={doneRef} type="button" onClick={close} className="btn-primary min-w-[10rem]">
                  Done
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

export default OneTimePasswordDialog;
