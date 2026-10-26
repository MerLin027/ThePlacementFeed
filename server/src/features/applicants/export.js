const writeExcelFile = require('write-excel-file/node');
const { branchLabel } = require('../catalog/cache');
const { applicantQuery } = require('./filters');

// At most this many rows per export (the file is built in memory before it is sent)
const EXPORT_ROW_CAP = 5000;

// Values starting with these characters can be interpreted as formulas by spreadsheet apps
// (CSV/formula injection), so they are prefixed with a quote.
const sanitizeCell = (value) => {
  if (typeof value !== 'string') return value;
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
};

// One spreadsheet cell, typed explicitly so text is never read as a number or a formula; empty
// values become empty cells
const toCell = (value, format) => {
  if (value === undefined || value === null || value === '') return null;
  if (value instanceof Date) return { value, type: Date, format };
  if (typeof value === 'number') return { value, type: Number };
  return { value: sanitizeCell(String(value)), type: String };
};

// Filename part built from safe characters only
const slugify = (text) =>
  String(text || 'drive')
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'drive';

/**
 * The xlsx file for one drive's (filtered) applicants, built in full before anything is sent, so a
 * failure while building still gets a JSON error instead of a truncated download.
 * Returns { file, filename } where file.toStream(res) writes it.
 */
const buildApplicantExport = async (drive, filter, sort) => {
  const prompts = (drive.customPrompts || []).map((p) => p.question);
  const columns = [
    { header: 'First Name', key: 'firstName', width: 16 },
    { header: 'Last Name', key: 'lastName', width: 16 },
    { header: 'Roll Number', key: 'rollNumber', width: 14 },
    { header: 'Institute', key: 'institute', width: 18 },
    { header: 'Email', key: 'email', width: 28 },
    { header: 'Phone', key: 'phone', width: 15 },
    { header: 'Branch', key: 'branch', width: 30 },
    { header: 'CGPA', key: 'cgpa', width: 8 },
    { header: 'Active Backlogs', key: 'activeBacklogs', width: 10 },
    { header: 'Graduation Year', key: 'graduationYear', width: 10 },
    { header: 'Resume Link', key: 'resumeUrl', width: 40 },
    { header: 'Status', key: 'status', width: 13 },
    { header: 'Applied At', key: 'submittedAt', width: 20, format: 'dd mmm yyyy hh:mm' },
    { header: 'Note from Student', key: 'coverNote', width: 40 },
    ...prompts.map((q, i) => ({ header: sanitizeCell(q), key: `prompt_${i}`, width: 30 })),
    { header: 'Admin Note', key: 'adminNote', width: 30 },
  ];
  const rows = [columns.map((c) => ({ value: c.header, type: String, fontWeight: 'bold' }))];

  for await (const app of applicantQuery(filter, sort, { limit: EXPORT_ROW_CAP }).cursor()) {
    const s = app.snapshot || {};
    const answers = new Map((app.customAnswers || []).map((a) => [a.question, a.answer]));
    const record = {
      firstName: s.firstName,
      lastName: s.lastName,
      rollNumber: s.rollNumber,
      institute: s.institute,
      email: s.email,
      phone: s.phone,
      branch: branchLabel(s.branch),
      cgpa: s.cgpa,
      activeBacklogs: s.activeBacklogs,
      graduationYear: s.graduationYear,
      resumeUrl: app.resumeUrl,
      status: app.status,
      submittedAt: app.createdAt,
      coverNote: app.coverNote,
      adminNote: app.adminNote,
    };
    prompts.forEach((q, i) => {
      record[`prompt_${i}`] = answers.get(q);
    });
    rows.push(columns.map((c) => toCell(record[c.key], c.format)));
  }

  const file = writeExcelFile(rows, { sheet: 'Applicants', columns: columns.map((c) => ({ width: c.width })) });
  const date = new Date().toISOString().slice(0, 10);
  return { file, filename: `applicants-${slugify(drive.company)}-${date}.xlsx` };
};

module.exports = { buildApplicantExport };
