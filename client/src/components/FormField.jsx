/**
 * Labelled form control with helper text and an inline error, wired up with
 * aria-describedby / aria-invalid so screen readers announce both.
 * Pass `children` to render a custom control (e.g. a select) instead of an input.
 */
const FormField = ({ id, label, helper, error, children, className = '', ...inputProps }) => {
  const helperId = helper ? `${id}-helper` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [errorId, helperId].filter(Boolean).join(' ') || undefined;

  const controlProps = {
    id,
    'aria-describedby': describedBy,
    'aria-invalid': error ? true : undefined,
  };

  return (
    <div className={className}>
      <label htmlFor={id} className="label">{label}</label>
      {children ? (
        children(controlProps)
      ) : (
        <input
          {...controlProps}
          {...inputProps}
          className={`input-field ${error ? 'border-error focus:border-error focus:ring-error/20' : ''}`}
        />
      )}
      {error && (
        <p id={errorId} className="mt-1 font-body-sm text-body-sm text-error flex items-start gap-1">
          <span className="material-symbols-outlined text-[16px] mt-[2px]" aria-hidden="true">error</span>
          {error}
        </p>
      )}
      {helper && (
        <p id={helperId} className="mt-1 font-body-sm text-body-sm text-on-surface-variant">
          {helper}
        </p>
      )}
    </div>
  );
};

export default FormField;
