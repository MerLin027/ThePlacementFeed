import { useSyncExternalStore } from 'react';
import api from '../api/axios';
import { BRANCHES, BRANCH_LABELS } from '../constants/branches';

/**
 * Branches, institutes and the College/University name, managed by the admin and loaded once from
 * GET /api/catalog. Until it arrives (e.g. during a Render cold start) the built-in branch list is
 * used, so labels and branch pickers never come up empty.
 *
 * Plain functions (branchLabel, formatBranches) serve non-React code such as utils/applyState.js;
 * components call useCatalog() so they re-render when the catalog loads or changes.
 */
const FALLBACK = {
  university: null,
  branches: BRANCHES.map((code) => ({ code, name: BRANCH_LABELS[code] || code, active: true })),
  institutes: [],
  loaded: false,
};

let state = FALLBACK;
const listeners = new Set();

const setState = (next) => {
  state = next;
  listeners.forEach((listener) => listener());
};

const subscribe = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

let inFlight = null;
// Loads (or, after an admin change, reloads) the catalog; concurrent calls share one request
export const loadCatalog = () => {
  inFlight ??= api
    .get('/api/catalog')
    .then((res) => setState({ ...res.data.data, loaded: true }))
    .catch(() => {
      // Keep what we have; the next call tries again
    })
    .finally(() => {
      inFlight = null;
    });
  return inFlight;
};

// Full name for a stored branch code; unknown values (e.g. deleted branches on old drives) as-is
export const branchLabel = (code) => state.branches.find((b) => b.code === code)?.name || code;

export const formatBranches = (codes = []) => codes.map(branchLabel).join(', ');

const snapshot = () => state;

export const useCatalog = () => {
  const catalog = useSyncExternalStore(subscribe, snapshot);
  return {
    ...catalog,
    // Branches that can be chosen now (archived ones stay only where they're already used)
    activeBranches: catalog.branches.filter((b) => b.active),
    branchLabel,
    formatBranches,
  };
};
