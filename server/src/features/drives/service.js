const Placement = require('../../models/Placement');
const { MAX_RECENT_CHANGES } = require('../../models/Placement');
const { containsRegex } = require('../../lib/regex');
const { applyAutoStatus } = require('./status');

// --- Reading: the public drive list ---

const PUBLIC_SORTS = ['closing_soon', 'newest', 'oldest', 'date_asc', 'date_desc', 'ctc_asc', 'ctc_desc'];

const SORT_FIELDS = {
  newest: { createdAt: -1 },
  oldest: { createdAt: 1 },
  date_asc: { driveDate: 1 },
  date_desc: { driveDate: -1 },
  ctc_asc: { ctc: 1 },
  ctc_desc: { ctc: -1 },
};

// Far-future stand-in so drives without a date sort after dated ones
const NO_DATE = new Date('9999-12-31T00:00:00Z');

/**
 * "Closing soon": what a student should look at first.
 *   1. drives still taking applications (Upcoming, not postponed)
 *   2. drives whose applications have closed but haven't happened (Ongoing)
 *   3. postponed drives
 *   4. completed drives
 * Within a group: earliest deadline (or drive date if there's no deadline) first.
 */
const closingSoonPipeline = (match, skip, limit) => [
  { $match: match },
  {
    $addFields: {
      _rank: {
        $switch: {
          branches: [
            { case: { $eq: ['$isPostponed', true] }, then: 3 },
            { case: { $eq: ['$status', 'Upcoming'] }, then: 1 },
            { case: { $eq: ['$status', 'Ongoing'] }, then: 2 },
          ],
          default: 4,
        },
      },
      _closesAt: { $ifNull: ['$deadline', { $ifNull: ['$driveDate', NO_DATE] }] },
    },
  },
  { $sort: { _rank: 1, _closesAt: 1, createdAt: -1, _id: 1 } },
  { $skip: skip },
  { $limit: limit },
  { $project: { _rank: 0, _closesAt: 0 } },
];

// The Mongo filter for the drive list from already-checked inputs
const buildDriveFilter = ({ statuses, branches, ctcMin, ctcMax, search }) => {
  const filter = {};
  if (statuses.length === 1) filter.status = statuses[0];
  else if (statuses.length > 1) filter.status = { $in: statuses };

  if (branches.length > 0) filter['eligibility.branches'] = { $in: branches };

  if (ctcMin !== undefined || ctcMax !== undefined) {
    filter.ctc = {};
    if (ctcMin !== undefined) filter.ctc.$gte = ctcMin;
    if (ctcMax !== undefined) filter.ctc.$lte = ctcMax;
  }

  const text = search?.trim();
  if (text) filter.$or = [{ company: containsRegex(text) }, { role: containsRegex(text) }];
  return filter;
};

// One page of drives and the total that match
const listDrives = async (filter, { sort, page, limit }) => {
  const skip = (page - 1) * limit;
  const [drives, total] = await Promise.all([
    sort === 'closing_soon'
      ? Placement.aggregate(closingSoonPipeline(filter, skip, limit))
      : Placement.find(filter).sort(SORT_FIELDS[sort] || SORT_FIELDS.newest).skip(skip).limit(limit).lean(),
    Placement.countDocuments(filter),
  ]);
  return { drives, total };
};

// --- Reading: what changed (student notifications) ---

// Lookback cap: an old or forged `since` can't make the server scan the whole history
const CHANGES_MAX_LOOKBACK_MS = 7 * 24 * 60 * 60 * 1000;
// Overlap so a slow write committed after a poll, with a timestamp from before it, isn't missed
const CHANGES_OVERLAP_MS = 10 * 1000;
const CHANGES_MAX_ITEMS = 50;

const changesSince = async (since) => {
  const floor = new Date(Date.now() - CHANGES_MAX_LOOKBACK_MS);
  const from = new Date((since < floor ? floor : since).getTime() - CHANGES_OVERLAP_MS);

  const drives = await Placement.find({ 'recentChanges.changedAt': { $gt: from } }).lean();
  const changes = [];
  for (const drive of drives) {
    for (const change of drive.recentChanges) {
      // automationReset entries are admin bookkeeping from before statuses were logged
      if (change.changedAt > from && change.type !== 'automationReset') {
        changes.push({
          id: `${drive._id}-${change.type}-${change.changedAt.getTime()}`,
          placementId: drive._id,
          company: drive.company,
          role: drive.role,
          type: change.type,
          status: change.status,
          changedAt: change.changedAt,
        });
      }
    }
  }
  changes.sort((a, b) => b.changedAt - a.changedAt);
  return changes.slice(0, CHANGES_MAX_ITEMS);
};

// --- Writing (admin) ---

// Fields an admin may set through the drive form. Everything else (status automation flag, change
// log, timestamps) is server-managed.
const EDITABLE_FIELDS = [
  'company', 'role', 'type', 'ctc', 'eligibility', 'driveDate', 'deadline',
  'isPostponed', 'jdDescription', 'tags', 'formUrl', 'selectionRounds',
  'applicationMode', 'customPrompts',
];

const pickEditable = (body) => {
  const data = {};
  for (const field of EDITABLE_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(body, field)) data[field] = body[field];
  }
  return data;
};

/**
 * Status mode from the form: "auto" (or omitted on create) means the status follows the dates;
 * one of the real statuses pins it manually. Returns { manual, status }, or null to keep the
 * current mode (an edit without a status).
 */
const resolveStatusMode = (status, isCreate) => {
  if (status === undefined || status === null || status === '') {
    return isCreate ? { manual: false } : null;
  }
  if (status === 'auto') return { manual: false };
  return { manual: true, status };
};

// Applies the status mode, then recomputes the automatic status from the dates
const applyStatusMode = (doc, mode) => {
  if (mode?.manual) {
    doc.statusManuallySet = true;
    doc.status = mode.status;
  } else if (mode) {
    doc.statusManuallySet = false;
  }
  applyAutoStatus(doc);
};

// One entry in the drive's change log (the status after the change lets notifications say "now Ongoing")
const logChange = (doc, type) => {
  doc.recentChanges.push({ type, status: doc.status, changedAt: new Date() });
  if (doc.recentChanges.length > MAX_RECENT_CHANGES) {
    doc.recentChanges.splice(0, doc.recentChanges.length - MAX_RECENT_CHANGES);
  }
};

module.exports = {
  PUBLIC_SORTS,
  buildDriveFilter,
  listDrives,
  changesSince,
  pickEditable,
  resolveStatusMode,
  applyStatusMode,
  logChange,
};
