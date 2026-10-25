// Logs out through the header the way a person would: students open their avatar menu, admins use
// "Log out" in the nav, and on phones both go through the menu button first. Waits for the header to
// show the signed-in user first (the session check may still be running after a page load), and
// resolves once it no longer does.
const { until } = require('./wait.cjs');

const logout = async (page) => {
  const account = page.getByRole('button', { name: 'Your account' });
  const phoneMenu = page.getByRole('button', { name: 'Open menu' });
  const logOut = page.locator('header').getByRole('button', { name: 'Log out' });
  await until(async () => (await account.isVisible()) || (await phoneMenu.isVisible()) || (await logOut.filter({ visible: true }).count()) > 0);
  if (await account.isVisible()) await account.click();
  else if (await phoneMenu.isVisible()) await phoneMenu.click();
  await logOut.filter({ visible: true }).first().click();
  await until(async () => !(await account.count()) && !(await logOut.count()));
};

module.exports = { logout };
