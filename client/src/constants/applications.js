// Admin-managed pipeline — mirrors APPLICATION_STATUSES in server/models/Application.js
export const APPLICATION_STATUSES = ['Applied', 'Shortlisted', 'Interviewing', 'Offered', 'Rejected'];

// How each status looks everywhere (pills, filters, charts, the stepper). "Offered" is shown as
// "Selected"; the stored value stays "Offered" (renaming it would need a data migration and would
// look like a status change to students). `color` is the solid accent for charts and bars.
export const STATUS_META = {
  Applied: { label: 'Applied', icon: 'send', pill: 'bg-st-applied-soft text-st-applied-ink', dot: 'bg-st-applied', color: '#2563eb' },
  Shortlisted: { label: 'Shortlisted', icon: 'star', pill: 'bg-st-shortlisted-soft text-st-shortlisted-ink', dot: 'bg-st-shortlisted', color: '#a21caf' },
  Interviewing: { label: 'Interviewing', icon: 'forum', pill: 'bg-st-interviewing-soft text-st-interviewing-ink', dot: 'bg-st-interviewing', color: '#ca8a04' },
  Offered: { label: 'Selected', icon: 'celebration', pill: 'bg-st-selected-soft text-st-selected-ink', dot: 'bg-st-selected', color: '#059669' },
  Rejected: { label: 'Rejected', icon: 'block', pill: 'bg-st-rejected-soft text-st-rejected-ink', dot: 'bg-st-rejected', color: '#dc2626' },
};
export const statusLabel = (status) => STATUS_META[status]?.label || status;

// Drive types, same idea
export const TYPE_META = {
  'Full-Time': { short: 'Full-time', pill: 'bg-type-fulltime-soft text-type-fulltime-ink', bar: 'bg-type-fulltime' },
  Internship: { short: 'Internship', pill: 'bg-type-intern-soft text-type-intern-ink', bar: 'bg-type-intern' },
  '6M Intern + FTE': { short: 'Intern + FTE', pill: 'bg-type-hybrid-soft text-type-hybrid-ink', bar: 'bg-type-hybrid' },
};

export const APPLICANT_SORTS = [
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'status', label: 'Status (pipeline order)' },
  { value: 'updated', label: 'Recently updated' },
  { value: 'cgpa_desc', label: 'CGPA: high to low' },
  { value: 'cgpa_asc', label: 'CGPA: low to high' },
  { value: 'name', label: 'Name (A–Z)' },
  { value: 'roll', label: 'Roll number' },
  { value: 'branch', label: 'Branch' },
  { value: 'grad_asc', label: 'Graduation year (earliest)' },
  { value: 'grad_desc', label: 'Graduation year (latest)' },
];

export const STUDENT_SORTS = [
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'name', label: 'Name (A–Z)' },
  { value: 'roll', label: 'Roll number' },
  { value: 'branch', label: 'Branch' },
  { value: 'grad_asc', label: 'Graduation year (earliest)' },
  { value: 'grad_desc', label: 'Graduation year (latest)' },
  { value: 'cgpa_desc', label: 'CGPA: high to low' },
  { value: 'cgpa_asc', label: 'CGPA: low to high' },
];
