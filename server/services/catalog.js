const Branch = require('../models/Branch');
const Institute = require('../models/Institute');
const Setting = require('../models/Setting');
const { BRANCHES, BRANCH_LABELS } = require('../constants/branches');

/**
 * Branches, institutes and the university name, cached in memory. Every request validates
 * against these, so they are read from the database once at boot and again after each admin
 * change (the API runs as a single instance). Accessors are synchronous.
 *
 * If the branches can't be read, the original built-in list is used so validation never
 * rejects every profile and drive.
 */
const FALLBACK_BRANCHES = BRANCHES.map((code, i) => ({
  id: null,
  code,
  name: BRANCH_LABELS[code] || code,
  active: true,
  sortOrder: i,
}));

let state = { branches: FALLBACK_BRANCHES, institutes: [], university: null, loaded: false };

// First boot: the branches that drives and students already use become the editable list
const seedBranches = async () => {
  if ((await Branch.estimatedDocumentCount()) > 0) return;
  await Branch.insertMany(FALLBACK_BRANCHES.map(({ code, name, sortOrder }) => ({ code, name, sortOrder })), {
    ordered: false,
  }).catch((error) => {
    // A concurrent boot may have seeded first
    if (error.code !== 11000 && !error.writeErrors) throw error;
  });
};

const reload = async () => {
  try {
    const [branches, institutes, university] = await Promise.all([
      Branch.find().sort({ sortOrder: 1, code: 1 }).lean(),
      Institute.find().sort({ name: 1 }).lean(),
      Setting.findOne({ key: 'university' }).lean(),
    ]);
    state = {
      branches: branches.length > 0
        ? branches.map((b) => ({ id: b._id.toString(), code: b.code, name: b.name, active: b.active, sortOrder: b.sortOrder }))
        : FALLBACK_BRANCHES,
      institutes: institutes.map((i) => ({ id: i._id.toString(), name: i.name, active: i.active })),
      university: university?.value?.name || null,
      loaded: true,
    };
  } catch (error) {
    console.error('[Catalog] Could not load the catalog:', error.message);
  }
  return state;
};

const init = async () => {
  try {
    await seedBranches();
  } catch (error) {
    console.error('[Catalog] Could not seed branches:', error.message);
  }
  await reload();
};

const getBranches = () => state.branches;
const findBranch = (code) => state.branches.find((b) => b.code === code) || null;
// activeOnly: may this code be chosen now (profiles, new drive branches)?
const isBranchCode = (code, { activeOnly = false } = {}) => {
  const branch = typeof code === 'string' ? findBranch(code) : null;
  return Boolean(branch && (!activeOnly || branch.active));
};
// Full name for a code; unknown codes (e.g. deleted branches on old drives) are shown as-is
const branchLabel = (code) => findBranch(code)?.name || code || '';

const getInstitutes = () => state.institutes;
const getInstitute = (id) => state.institutes.find((i) => i.id === String(id)) || null;
const activeInstituteCount = () => state.institutes.filter((i) => i.active).length;

const getUniversity = () => state.university;

// Public shape for GET /api/catalog: archived branches are included (flagged) so old drives keep
// their labels; institutes only appear while they can be chosen
const toPublicCatalog = () => ({
  university: state.university,
  branches: state.branches.map(({ code, name, active }) => ({ code, name, active })),
  institutes: state.institutes.filter((i) => i.active).map(({ id, name }) => ({ id, name })),
});

module.exports = {
  init,
  reload,
  getBranches,
  findBranch,
  isBranchCode,
  branchLabel,
  getInstitutes,
  getInstitute,
  activeInstituteCount,
  getUniversity,
  toPublicCatalog,
};
