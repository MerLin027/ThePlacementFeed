// What a student sees about their own application — never the admin's note
const toStudentApplicationDTO = (app, drive) => ({
  id: app._id.toString(),
  driveId: app.driveId ? app.driveId.toString() : null,
  company: drive?.company ?? null,
  role: drive?.role ?? null,
  type: drive?.type ?? null,
  ctc: drive?.ctc ?? null,
  driveDate: drive?.driveDate ?? null,
  driveStatus: drive?.status ?? null,
  isPostponed: Boolean(drive?.isPostponed),
  status: app.status,
  submittedAt: app.createdAt,
  updatedAt: app.updatedAt,
});

module.exports = { toStudentApplicationDTO };
