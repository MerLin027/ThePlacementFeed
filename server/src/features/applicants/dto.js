// Accounts deleted by the admin leave a scrubbed, flagged application behind. Records scrubbed
// before the flag existed are recognised by the scrubbed name (the migration flags them too).
const isDeletedStudent = (app) =>
  app.studentDeleted === true ||
  (app.snapshot?.firstName === 'Deleted' && app.snapshot?.lastName === 'User' && !app.snapshot?.email);

// One applicant as the admin sees it: what the student submitted, the snapshot of their profile at
// submission time, and the admin's own status and note
const toApplicantDTO = (app) => ({
  id: app._id.toString(),
  status: app.status,
  adminNote: app.adminNote ?? '',
  submittedAt: app.createdAt,
  updatedAt: app.updatedAt,
  resumeUrl: app.resumeUrl ?? '',
  coverNote: app.coverNote ?? '',
  customAnswers: (app.customAnswers || []).map((a) => ({ question: a.question, answer: a.answer })),
  studentDeleted: isDeletedStudent(app),
  snapshot: {
    firstName: app.snapshot?.firstName ?? '',
    lastName: app.snapshot?.lastName ?? '',
    email: app.snapshot?.email ?? '',
    rollNumber: app.snapshot?.rollNumber ?? '',
    institute: app.snapshot?.institute ?? '',
    branch: app.snapshot?.branch ?? '',
    cgpa: app.snapshot?.cgpa ?? null,
    activeBacklogs: app.snapshot?.activeBacklogs ?? null,
    graduationYear: app.snapshot?.graduationYear ?? null,
    phone: app.snapshot?.phone ?? '',
  },
});

module.exports = { toApplicantDTO, isDeletedStudent };
