// What anyone may see about a drive: the listing as students read it. Internal bookkeeping (the
// change log that feeds notifications, whether the status was pinned by hand, the version key) is
// left out.
const toPublicDrive = (d) => ({
  _id: d._id,
  company: d.company,
  role: d.role,
  type: d.type,
  ctc: d.ctc,
  eligibility: {
    branches: d.eligibility?.branches ?? [],
    cgpa: d.eligibility?.cgpa ?? null,
    backlog: d.eligibility?.backlog ?? null,
  },
  driveDate: d.driveDate ?? null,
  deadline: d.deadline ?? null,
  status: d.status,
  isPostponed: Boolean(d.isPostponed),
  jdDescription: d.jdDescription ?? '',
  selectionRounds: (d.selectionRounds || []).map((r) => ({ _id: r._id, roundName: r.roundName, roundDescription: r.roundDescription ?? '' })),
  tags: d.tags ?? [],
  formUrl: d.formUrl ?? '',
  applicationMode: d.applicationMode || 'external',
  // The apply form shows these; answers refer to them by _id
  customPrompts: (d.customPrompts || []).map((p) => ({ _id: p._id, question: p.question, required: Boolean(p.required) })),
  createdAt: d.createdAt,
  updatedAt: d.updatedAt,
});

// What staff see: the public view plus whether the status is pinned (the drive form and dashboard)
const toAdminDrive = (d) => ({
  ...toPublicDrive(d),
  statusManuallySet: Boolean(d.statusManuallySet),
});

module.exports = { toPublicDrive, toAdminDrive };
