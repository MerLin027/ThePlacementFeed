import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useDialogFocus } from '../hooks/useDialogFocus';

const BUTTON_TONES = {
  danger: 'btn-danger',
  primary: 'btn-primary',
  secondary: 'btn-secondary',
};

/**
 * A destructive confirmation in two steps inside one dialog (one focus trap, no flicker between
 * prompts). Step 1 asks whether to go ahead; its confirm button moves to step 2, which spells out
 * the consequences and offers the final choices. Without `second`, step 1's confirm runs
 * `first.onConfirm` straight away (e.g. nothing to choose between).
 *
 *   first:  { title, message, icon, confirmLabel, onConfirm?, extraAction?: { label, onClick } }
 *   second: { title, message, icon, actions: [{ label, tone, onClick, disabled }] } | null
 *
 * The safe button (Cancel, then Back) gets focus on each step, so Enter never confirms by accident.
 */
const TwoStepConfirmDialog = ({ isOpen, onClose, first, second }) => {
  const panelRef = useRef(null);
  const safeRef = useRef(null);
  const [step, setStep] = useState(0);
  // Every opening starts at step 1 (reset during render rather than in an effect)
  const [wasOpen, setWasOpen] = useState(isOpen);
  if (isOpen !== wasOpen) {
    setWasOpen(isOpen);
    if (isOpen) setStep(0);
  }
  useDialogFocus(isOpen, panelRef, onClose, safeRef);

  // Moving to step 2 swaps the buttons under the keyboard focus; put it back on the safe one
  useEffect(() => {
    if (isOpen && step === 1) safeRef.current?.focus({ preventScroll: true });
  }, [isOpen, step]);

  if (!isOpen || !first) return null;

  const current = step === 0 ? first : second;
  const run = (fn) => () => {
    fn?.();
    onClose();
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center px-sm">
      <div className="fixed inset-0 bg-on-surface/50 backdrop-blur-xs animate-fade-in" onClick={onClose} aria-hidden="true" />
      <div
        ref={panelRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="two-step-title"
        aria-describedby="two-step-message"
        className="relative bg-surface-container-lowest rounded-2xl shadow-pop w-full max-w-(--container-md) z-10 p-md animate-dialog-in"
      >
        <div className="mx-auto w-12 h-12 rounded-full flex items-center justify-center mb-sm bg-error-container">
          <span className="material-symbols-outlined text-[24px] text-error" aria-hidden="true">
            {current.icon || 'warning'}
          </span>
        </div>
        {second && (
          <p className="text-center font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider mb-1">
            Step {step + 1} of 2
          </p>
        )}
        {/* key: the new title and message are announced when the step changes */}
        <div key={step} aria-live="polite">
          <h3 id="two-step-title" className="font-headline-sm text-headline-sm text-on-surface text-center mb-xs">
            {current.title}
          </h3>
          <div id="two-step-message" className="font-body-sm text-body-sm text-on-surface-variant text-center mb-md space-y-xs">
            {current.message}
          </div>
        </div>

        {step === 0 ? (
          <div className="flex flex-col-reverse sm:flex-row gap-xs sm:gap-sm">
            <button ref={safeRef} type="button" onClick={onClose} className="btn-secondary flex-1 min-h-[44px]">
              Cancel
            </button>
            {first.extraAction && (
              <button type="button" onClick={run(first.extraAction.onClick)} className="btn-primary flex-1 min-h-[44px]">
                {first.extraAction.label}
              </button>
            )}
            <button
              type="button"
              onClick={second ? () => setStep(1) : run(first.onConfirm)}
              className="btn-danger flex-1 min-h-[44px]"
            >
              {first.confirmLabel || 'Delete'}
            </button>
          </div>
        ) : (
          <div className="flex flex-col-reverse sm:flex-row sm:flex-wrap gap-xs sm:gap-sm">
            <button ref={safeRef} type="button" onClick={() => setStep(0)} className="btn-secondary flex-1 min-h-[44px]">
              Back
            </button>
            {second.actions.map((action) => (
              <button
                key={action.label}
                type="button"
                onClick={run(action.onClick)}
                disabled={action.disabled}
                className={`${BUTTON_TONES[action.tone] || BUTTON_TONES.danger} flex-1 min-h-[44px]`}
              >
                {action.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};

export default TwoStepConfirmDialog;
