import { useEffect } from 'react';

const SITE = 'The Placement Feed';

// Sets the browser tab title (also what screen readers announce on navigation)
export const usePageTitle = (title) => {
  useEffect(() => {
    document.title = title ? `${title} · ${SITE}` : `${SITE} — CHARUSAT CDPC Placements`;
  }, [title]);
};
