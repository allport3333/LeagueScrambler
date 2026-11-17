const { test, expect, available } = require('../helpers/fixtures.cjs');
const { envSettings, assertLocalUrl, BASE_URL } = require('../helpers/safety.cjs');
test('local configuration and URL guards reject production and recovery', async () => {
  expect(envSettings().database).toBe('LeagueScramblerDev');
  for (const url of ['https://allportsleaguehub.com', 'https://allportsleaguescrambler.com', BASE_URL + '//api/test', BASE_URL + '/api/Login/forgotpassword']) {
    expect(() => assertLocalUrl(url)).toThrow();
  }
});
test('installed Chromium launches without application access', async ({ page }) => {
  await page.setContent('<h1>Local test runner verification</h1>');
  await expect(page.getByRole('heading')).toHaveText('Local test runner verification');
});
test('anonymous authentication status is false without SQL access', async ({ api }, testInfo) => {
  if (!await available()) {
    testInfo.annotations.push({ type: 'blocked', description: 'Local HTTPS application is unavailable or certificate validation failed.' });
    test.skip(true, 'Local HTTPS application unavailable.');
  }
  const response = await api.get('/api/Login/isauthenticated');
  expect(response.status()).toBe(200);
  expect(await response.json()).toBe(false);
});
test('anonymous home page displays registration and login', async ({ page }, testInfo) => {
  if (!await available()) {
    testInfo.annotations.push({ type: 'blocked', description: 'Local HTTPS application is unavailable or certificate validation failed.' });
    test.skip(true, 'Local HTTPS application unavailable.');
  }
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Register', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Login', exact: true })).toBeVisible();
});
