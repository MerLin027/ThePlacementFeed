import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router';

/**
 * On every page change (pathname, not query string):
 * - scroll the main content area back to the top (it's the app's only
 *   scroll container, so the browser doesn't do this for us);
 * - move focus to <main> so keyboard and screen-reader users start at the
 *   new content — unless the new page already focused one of its own fields.
 * Compares against the previous pathname (not a "first render" flag) so it
 * stays a no-op on initial load even when effects run twice (StrictMode).
 */
const RouteEffects = () => {
  const { pathname } = useLocation();
  const previous = useRef(pathname);

  useEffect(() => {
    if (previous.current === pathname) return;
    previous.current = pathname;

    const main = document.getElementById('main-content');
    if (!main) return;
    main.scrollTo({ top: 0 });
    if (!main.contains(document.activeElement)) {
      main.focus({ preventScroll: true });
    }
  }, [pathname]);

  return null;
};

export default RouteEffects;
