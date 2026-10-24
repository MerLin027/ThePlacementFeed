import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router';

/**
 * Filter values kept in the URL query, so a filtered list survives a reload and the Back button and
 * can be shared. `defaults` (a stable, module-level object) lists every key with its default (a
 * string; '' means "not set"). Values equal to their default are left out of the URL. Array defaults
 * mark multi-value filters, stored comma-joined (the API takes them the same way).
 */
export const useUrlFilters = (defaults) => {
  const [params, setParams] = useSearchParams();

  const values = useMemo(() => {
    const out = {};
    for (const [key, fallback] of Object.entries(defaults)) {
      const raw = params.get(key);
      if (Array.isArray(fallback)) out[key] = raw ? raw.split(',').filter(Boolean) : fallback;
      else out[key] = raw ?? fallback;
    }
    return out;
  }, [params, defaults]);

  // Changes only the given keys. It starts from the browser's current URL rather than the last
  // render's values: navigation updates the URL at once but re-renders later (in a transition), so
  // two quick changes would otherwise overwrite each other.
  const write = useCallback(
    (patch) => {
      const next = new URLSearchParams(window.location.search);
      for (const [key, value] of Object.entries(patch)) {
        const fallback = defaults[key];
        const v = Array.isArray(value) ? value.join(',') : value;
        const d = Array.isArray(fallback) ? fallback.join(',') : fallback;
        if (v === undefined || v === '' || v === d) next.delete(key);
        else next.set(key, v);
      }
      setParams(next, { replace: true });
    },
    [setParams, defaults]
  );

  const setValue = useCallback((key, value) => write({ [key]: value }), [write]);
  const reset = useCallback(() => write(defaults), [write, defaults]);

  return [values, setValue, reset];
};
