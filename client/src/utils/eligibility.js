/**
 * Human-readable academic requirement for a drive. Each rule is described on
 * its own: an unset backlog limit means "no limit" (not "no backlogs"), and a
 * backlog limit is shown even when there's no CGPA minimum.
 * Mirrors the server rules in services/applicationRules.js.
 */
export const describeAcademicRequirement = (eligibility = {}) => {
  const parts = [];
  const { cgpa, backlog } = eligibility || {};
  if (cgpa !== null && cgpa !== undefined) parts.push(`Min. CGPA ${cgpa}`);
  if (backlog === 0) parts.push('No active backlogs allowed');
  else if (backlog !== null && backlog !== undefined) {
    parts.push(`Up to ${backlog} active backlog${backlog === 1 ? '' : 's'}`);
  }
  return parts.length > 0 ? parts.join(' · ') : 'No CGPA or backlog cutoff';
};
