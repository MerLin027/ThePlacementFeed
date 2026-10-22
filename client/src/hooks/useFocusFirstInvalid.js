import { useEffect } from 'react';

/**
 * After a failed submit, move keyboard focus to the first field marked
 * aria-invalid inside `formRef`, so the user lands on what needs fixing.
 * Runs whenever the errors object changes and contains at least one error.
 */
export const useFocusFirstInvalid = (formRef, fieldErrors) => {
  useEffect(() => {
    if (!fieldErrors || Object.keys(fieldErrors).length === 0) return;
    const first = formRef.current?.querySelector('[aria-invalid="true"]');
    first?.focus();
  }, [formRef, fieldErrors]);
};
