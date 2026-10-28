// Audit 2026-10-28 (browser): regression tests for findings fixed during the audit.
// - NOTIF-1: a student's application notifications (company, role, outcome) don't stay in the
//   browser for the next person who signs in on the same computer.
const TEST = require('../lib/env.cjs');
const { until, settled } = require('../lib/wait.cjs');
const { chooseInstitute } = require('../lib/institute.cjs');
const path = require('path');
const { chromium } = require('playwright');
const SERVER = TEST.SERVER;
const mongoose = require(path.join(SERVER, 'node_modules/mongoose'));
const Student = require(path.join(SERVER, 'src/models/Student'));
const Placement = require(path.join(SERVER, 'src/models/Placement'));
const Application = require(path.join(SERVER, 'src/models/Application'));
const Session = require(path.join(SERVER, 'src/models/Session'));
const APP = TEST.APP;
const API = TEST.API;
const TAG = `aub${Date.now() % 100000}`;
let pass = 0, fail = 0;
const ok = (c, l, extra = '') => { c ? pass++ : fail++; console.log(c ? '  PASS' : '  FAIL', l, c ? '' : extra); };
const istDate = (n) => new Date(Date.now() + 5.5 * 3600e3 + n * 86400e3).toISOString().slice(0, 10);
const J = (c) => ({ 'Content-Type': 'application/json', Origin: APP, ...(c ? { Cookie: c } : {}) });
const cookieOf = (res) => (res.headers.getSetCookie().find((c) => c.startsWith('tpf_session=') && !c.startsWith('tpf_session=;')) || '').split(';')[0];

const signIn = async (page, identifier, password) => {
  await page.goto(APP + '/login');
  await page.fill('#identifier', identifier);
  await page.fill('#password', password);
  await page.click('button[type=submit]');
};

(async () => {
  await mongoose.connect(TEST.MONGODB_URI);
  const browser = await chromium.launch();
  let driveId;
  try {
    console.log('# NOTIF-1: application notifications stay with their student');
    const admin = cookieOf(await fetch(API + '/api/auth/login', { method: 'POST', headers: J(), body: JSON.stringify({ identifier: 'testadmin', password: 'testadminpass' }) }));
    const drive = (await (await fetch(API + '/api/admin/drives', {
      method: 'POST',
      headers: J(admin),
      body: JSON.stringify({ company: `${TAG} Private Corp`, role: 'Analyst', type: 'Full-Time', ctc: 6, applicationMode: 'in_app', deadline: istDate(3), driveDate: istDate(8) }),
    })).json()).data;
    driveId = drive._id;

    // Student A: a complete profile and one application
    const aRes = await fetch(API + '/api/auth/signup', { method: 'POST', headers: J(), body: JSON.stringify({ email: `${TAG}a@example.com`, rollNumber: `${TAG}A1`.toUpperCase(), password: 'student-a-pass' }) });
    const a = cookieOf(aRes);
    await chooseInstitute(a);
    await fetch(API + '/api/student/profile', { method: 'PATCH', headers: J(a), body: JSON.stringify({ firstName: 'Asha', lastName: 'Rao', branch: 'CE', cgpa: 8, activeBacklogs: 0, graduationYear: 2027, phone: '9876543210', resumeUrl: 'https://example.com/cv.pdf' }) });
    const applied = await fetch(API + '/api/student/applications', { method: 'POST', headers: J(a), body: JSON.stringify({ driveId, consentGiven: true }) });
    ok(applied.status === 201, 'student A applied', `${applied.status} ${await applied.text()}`);
    await fetch(API + '/api/auth/signup', { method: 'POST', headers: J(), body: JSON.stringify({ email: `${TAG}b@example.com`, rollNumber: `${TAG}B1`.toUpperCase(), password: 'student-b-pass' }) });

    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await ctx.newPage();
    await signIn(page, `${TAG}a@example.com`, 'student-a-pass');
    await page.waitForURL((url) => !url.pathname.startsWith('/login'));
    await settled(page);

    // The CDPC shortlists A; A's site picks it up on the next load
    const app = await Application.findOne({ driveId }).lean();
    const upd = await fetch(`${API}/api/admin/drives/${driveId}/applicants/${app._id}`, { method: 'PATCH', headers: J(admin), body: JSON.stringify({ status: 'Shortlisted' }) });
    ok(upd.ok, 'the CDPC shortlists student A', String(upd.status));
    await page.reload();
    await settled(page);
    const bell = page.getByRole('button', { name: /notifications/i });
    await bell.click();
    const aSees = await until(() => page.getByText(`${TAG} Private Corp`).first().isVisible());
    ok(aSees, 'student A sees their shortlisting in the bell');
    await page.keyboard.press('Escape');
    await page.reload();
    await settled(page);
    await bell.click();
    ok(await until(() => page.getByText(`${TAG} Private Corp`).first().isVisible()), 'a reload keeps their own notification (not wiped before the session check)');
    await page.keyboard.press('Escape');

    // A logs out; B signs in on the same computer
    await page.getByRole('button', { name: 'Your account' }).click();
    await page.getByRole('button', { name: 'Log out' }).click();
    await page.waitForURL(APP + '/');
    const storedClean = await until(async () => !(await page.evaluate(() => localStorage.getItem('tpf:notifications') || '')).includes('Shortlisted'));
    ok(storedClean, "logging out removes A's application notifications from the browser");
    await signIn(page, `${TAG}b@example.com`, 'student-b-pass');
    await page.waitForURL((url) => !url.pathname.startsWith('/login'));
    await settled(page);
    await bell.click();
    await page.waitForTimeout(400);
    const bSeesA = await page.getByText('Shortlisted').count();
    ok(bSeesA === 0, "student B does not see student A's application outcome", `${bSeesA} match(es)`);
    await ctx.close();
  } finally {
    await browser.close();
    const studs = await Student.find({ email: new RegExp(`^${TAG}`) }).select('_id').lean();
    await Session.deleteMany({ accountId: { $in: studs.map((x) => x._id) } });
    if (driveId) {
      await Application.deleteMany({ driveId });
      await Placement.deleteOne({ _id: driveId });
    }
    await Student.deleteMany({ email: new RegExp(`^${TAG}`) });
    await mongoose.disconnect();
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('CRASH', e); process.exit(2); });
