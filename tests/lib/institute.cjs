// Applying needs an institute (site upgrade). The runner's cleanup step seeds one shared
// "Test Institute"; suites that complete a profile pick it through the real endpoint.
const env = require('./env.cjs');

const TEST_INSTITUTE = 'Test Institute';

let idPromise = null;
const testInstituteId = () => {
  idPromise ??= fetch(`${env.API}/api/catalog`)
    .then((r) => r.json())
    .then((j) => {
      const institute = j.data.institutes.find((i) => i.name === TEST_INSTITUTE);
      if (!institute) throw new Error(`"${TEST_INSTITUTE}" is missing: run the suites through tests/run.mjs`);
      return institute.id;
    });
  return idPromise;
};

// Picks the shared test institute for a student session cookie ("student_token=…")
const chooseInstitute = async (cookie) => {
  const instituteId = await testInstituteId();
  const res = await fetch(`${env.API}/api/students/me/institute`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Origin: env.APP, Cookie: cookie },
    body: JSON.stringify({ instituteId }),
  });
  // 409: already chosen, which is fine for a helper
  if (!res.ok && res.status !== 409) throw new Error(`chooseInstitute failed with ${res.status}`);
};

// The same choice made the way a student does it: the profile page's picker and its confirm dialog
const pickInstituteInUi = async (page) => {
  await page.waitForSelector('#instituteId');
  await page.selectOption('#instituteId', { label: TEST_INSTITUTE });
  await page.click('button:has-text("Confirm institute")');
  await page.click('[role=alertdialog] button:has-text("Yes, that\'s my institute")');
  await page.locator('#instituteId').waitFor({ state: 'detached' });
};

module.exports = { TEST_INSTITUTE, testInstituteId, chooseInstitute, pickInstituteInUi };
