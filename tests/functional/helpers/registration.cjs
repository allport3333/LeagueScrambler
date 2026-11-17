const { expect } = require('@playwright/test');
async function dismissNotices(page) {
  if(await page.getByRole('dialog').first().isVisible()) return;
  const close = page.locator('snack-bar-container').getByRole('button', { name: 'Close', exact: true });
  if (await close.isVisible()) {
    try { await close.click({timeout:2000}); }
    catch(error) { if(await close.isVisible()) throw error; }
  }
}
async function registerApi(api, identity) {
  const response = await api.post('/api/Login/register', {
    email: identity.email, password: identity.password,
    firstName: identity.firstName, lastName: identity.lastName
  });
  expect(response.status(), 'Synthetic registration HTTP status').toBe(200);
  return (await response.json()).userId;
}
async function createApi(api, identity) {
  const response = await api.post('/api/ScrambleData/AddPlayerWithoutLeague', {
    firstName: identity.firstName, lastName: identity.lastName, gender: 'Male', isSub: false
  });
  expect(response.status(), 'Synthetic player creation HTTP status').toBe(200);
  return (await response.json()).id;
}
async function registerUi(page, identity) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Register', exact: true }).click();
  await page.locator('#registerEmail').fill(identity.email);
  await page.locator('#registerPassword').fill(identity.password);
  await page.locator('#confirmPassword').fill(identity.password);
  await page.locator('#registerFirstName').fill(identity.firstName);
  await page.locator('#registerLastName').fill(identity.lastName);
  const [response] = await Promise.all([
    page.waitForResponse(r => new URL(r.url()).pathname === '/api/Login/register' && r.request().method() === 'POST'),
    page.getByRole('button', { name: 'Submit', exact: true }).click()
  ]);
  expect(response.status()).toBe(200);
  return (await response.json()).userId;
}
module.exports = { registerApi, createApi, registerUi, dismissNotices };
