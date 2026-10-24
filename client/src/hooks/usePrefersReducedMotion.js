import { useSyncExternalStore } from 'react';

// The OS "reduce motion" setting, kept live (it can change while the page is open)
const QUERY = '(prefers-reduced-motion: reduce)';

const subscribe = (onChange) => {
  const mq = window.matchMedia(QUERY);
  mq.addEventListener('change', onChange);
  return () => mq.removeEventListener('change', onChange);
};

const snapshot = () => window.matchMedia(QUERY).matches;

export const usePrefersReducedMotion = () => useSyncExternalStore(subscribe, snapshot, () => false);
