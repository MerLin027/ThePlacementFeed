import { isDeadlinePassed } from './dates';
import { branchLabel, formatBranches } from '../stores/catalog';

/**
 * Decides what the "Apply" control shows for a drive. UX only — the server
 * runs the same checks (services/applicationRules.js) and has the final say.
 *
 * kinds: applied | none | external | blocked | login | completeProfile | apply
 */
export const getApplyState = ({ drive, student, application }) => {
  if (application) {
    return { kind: 'applied', status: application.status };
  }
  if (drive.status === 'Completed') {
    return { kind: 'none' };
  }

  const mode = drive.applicationMode || 'external';
  const inApp = mode === 'in_app' || mode === 'both';
  if (!inApp && !drive.formUrl) {
    return { kind: 'none' };
  }

  // Closed states apply to the external form too, not just in-app applications
  if (drive.isPostponed) {
    return {
      kind: 'blocked',
      label: 'Drive postponed',
      reason: 'Applications are paused while this drive is postponed.',
    };
  }
  if (isDeadlinePassed(drive.deadline)) {
    return {
      kind: 'blocked',
      label: 'Deadline passed',
      reason: 'The application deadline for this drive has passed.',
    };
  }
  if (!inApp) {
    return { kind: 'external' };
  }
  if (!student) {
    return { kind: 'login' };
  }
  if (student.missingFields?.length > 0) {
    return { kind: 'completeProfile', missing: student.missingFields };
  }

  const { branches, cgpa, backlog } = drive.eligibility || {};
  if (branches?.length > 0 && !branches.includes(student.branch)) {
    return {
      kind: 'blocked',
      label: 'Not eligible',
      reason: `This drive is open to ${formatBranches(branches)}. Your branch is ${branchLabel(student.branch)}.`,
    };
  }
  if (cgpa != null && student.cgpa < cgpa) {
    return {
      kind: 'blocked',
      label: 'Not eligible',
      reason: `This drive needs a minimum CGPA of ${cgpa}. Yours is ${student.cgpa}.`,
    };
  }
  if (backlog != null && (student.activeBacklogs ?? 0) > backlog) {
    return {
      kind: 'blocked',
      label: 'Not eligible',
      reason: `This drive allows at most ${backlog} active backlog${backlog === 1 ? '' : 's'}. You have ${student.activeBacklogs}.`,
    };
  }

  return { kind: 'apply' };
};
