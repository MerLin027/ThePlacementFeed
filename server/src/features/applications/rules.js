const { getStartOfTodayIST } = require('../../lib/time');
const catalog = require('../catalog/cache');

/**
 * Server-side rules for whether a student may apply to a drive in-app.
 * Checks run in a fixed order and the first failure wins. Returns null when
 * the application is allowed, otherwise `{ status, code, message, ...extra }`.
 *
 * The client mirrors some of these checks for button state, but only this
 * function decides.
 */
const checkApplicationRules = ({ drive, student, today = getStartOfTodayIST() }) => {
  if (drive.status === 'Completed') {
    return { status: 400, code: 'DRIVE_COMPLETED', message: 'This drive has concluded.' };
  }
  if (drive.isPostponed) {
    return { status: 400, code: 'DRIVE_POSTPONED', message: 'This drive is currently postponed.' };
  }
  // Deadlines are whole days in IST: open through the deadline date itself
  if (drive.deadline && drive.deadline < today) {
    return { status: 400, code: 'DEADLINE_PASSED', message: 'The application deadline has passed.' };
  }
  if (!drive.applicationMode || drive.applicationMode === 'external') {
    return {
      status: 400,
      code: 'EXTERNAL_ONLY',
      message: 'This drive takes applications through its external form only.',
    };
  }

  const missing = student.getMissingFields();
  if (missing.length > 0) {
    return {
      status: 422,
      code: 'INCOMPLETE_PROFILE',
      message: 'Please complete your profile before applying.',
      missing,
    };
  }

  const { branches, cgpa, backlog } = drive.eligibility || {};
  if (branches?.length > 0 && !branches.includes(student.branch)) {
    return {
      status: 400,
      code: 'INELIGIBLE_BRANCH',
      message: 'Your branch is not eligible for this drive.',
    };
  }
  if (cgpa != null && student.cgpa < cgpa) {
    return {
      status: 400,
      code: 'INELIGIBLE_CGPA',
      message: `This drive needs a minimum CGPA of ${cgpa}.`,
    };
  }
  if (backlog != null && (student.activeBacklogs ?? 0) > backlog) {
    return {
      status: 400,
      code: 'INELIGIBLE_BACKLOGS',
      message: `This drive allows at most ${backlog} active backlog${backlog === 1 ? '' : 's'}.`,
    };
  }

  return null;
};

/**
 * Matches submitted answers to the drive's own prompts by id. Question text
 * always comes from the drive, never from the request. Unknown ids are ignored.
 */
const buildCustomAnswers = (prompts = [], submitted = []) => {
  const answersById = new Map(
    submitted.map((a) => [String(a.promptId), typeof a.answer === 'string' ? a.answer.trim() : ''])
  );

  const answers = [];
  const missingPromptIds = [];
  for (const prompt of prompts) {
    const answer = answersById.get(prompt._id.toString()) || '';
    if (prompt.required && !answer) {
      missingPromptIds.push(prompt._id.toString());
    }
    if (answer) {
      answers.push({ question: prompt.question, answer });
    }
  }
  return { answers, missingPromptIds };
};

const buildSnapshot = (student) => ({
  firstName: student.firstName,
  lastName: student.lastName,
  email: student.email,
  rollNumber: student.rollNumber,
  // Names as they are today; later renames don't rewrite what the student applied with
  university: catalog.getUniversity() || undefined,
  institute: catalog.getInstitute(student.instituteId)?.name,
  branch: student.branch,
  cgpa: student.cgpa,
  activeBacklogs: student.activeBacklogs,
  graduationYear: student.graduationYear,
  phone: student.phone,
});

module.exports = { checkApplicationRules, buildCustomAnswers, buildSnapshot };
