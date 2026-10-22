/**
 * Splits an API error into per-field messages (from express-validator's
 * `errors: [{ field, message }]`) and a general message for everything else.
 */
export const parseApiError = (err, fallback = 'Something went wrong. Please try again.') => {
  const data = err.response?.data;
  const fieldErrors = {};

  if (Array.isArray(data?.errors)) {
    for (const item of data.errors) {
      if (item && typeof item === 'object' && item.field && !fieldErrors[item.field]) {
        fieldErrors[item.field] = item.message;
      }
    }
  }

  const hasFieldErrors = Object.keys(fieldErrors).length > 0;
  let message = '';
  if (!hasFieldErrors) {
    message = err.response ? data?.message || fallback : 'Could not reach the server. Please check your connection and try again.';
  }

  return { fieldErrors, message };
};
