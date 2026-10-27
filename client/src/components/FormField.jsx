import { useState } from 'react';

/**
 * Labelled form control with helper text and an inline error, wired up with
 * aria-describedby / aria-invalid so screen readers announce both.
 * Pass `children` to render a custom control (e.g. a select) instead of an input.
 * Password inputs get a show/hide toggle. `icon`: a Material Symbols name shown inside the input, on
 * the left. `helper` may be text or a small block (e.g. the password rules).
 */
const FormField = ({ id, label, helper, error, icon, children, className = '', ...inputProps }) => {
  const [revealed, setRevealed] = useState(false);
  const helperId = helper ? `${id}-helper` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [errorId, helperId].filter(Boolean).join(' ') || undefined;
  const isPassword = inputProps.type === 'password';

  const controlProps = {
    id,
    'aria-describedby': describedBy,
    'aria-invalid': error ? true : undefined,
  };

  const inputClass = `input-field ${icon ? 'pl-11' : ''} ${error ? 'border-error focus:border-error focus:ring-error/20' : ''}`;
  const leadingIcon = icon && (
    <span
      className="material-symbols-outlined pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[20px] text-outline transition-colors duration-200 group-focus-within/field:text-primary"
      aria-hidden="true"
    >
      {icon}
    </span>
  );

  return (
    <div className={className}>
      <label htmlFor={id} className="label">{label}</label>
      {children ? (
        children(controlProps)
      ) : isPassword ? (
        <div className="group/field relative">
          {leadingIcon}
          <input
            {...controlProps}
            {...inputProps}
            type={revealed ? 'text' : 'password'}
            className={`${inputClass} pr-[52px]`}
          />
          <button
            type="button"
            onClick={() => setRevealed((v) => !v)}
            aria-label={revealed ? 'Hide password' : 'Show password'}
            aria-pressed={revealed}
            aria-controls={id}
            className="absolute right-0 top-0 w-[44px] h-[44px] flex items-center justify-center rounded-r-lg text-on-surface-variant hover:text-on-surface focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary"
          >
            <span className="material-symbols-outlined text-[20px]" aria-hidden="true">
              {revealed ? 'visibility_off' : 'visibility'}
            </span>
          </button>
        </div>
      ) : icon ? (
        <div className="group/field relative">
          {leadingIcon}
          <input {...controlProps} {...inputProps} className={inputClass} />
        </div>
      ) : (
        <input {...controlProps} {...inputProps} className={inputClass} />
      )}
      {error && (
        <p id={errorId} className="mt-1 font-body-sm text-body-sm text-error flex items-start gap-1">
          <span className="material-symbols-outlined text-[16px] mt-[2px]" aria-hidden="true">error</span>
          {error}
        </p>
      )}
      {helper && (
        <div id={helperId} className="mt-1 font-body-sm text-body-sm text-on-surface-variant">
          {helper}
        </div>
      )}
    </div>
  );
};

export default FormField;
