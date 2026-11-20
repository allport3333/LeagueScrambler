const { defineConfig } = require('@playwright/test');
const { BASE_URL } = require('./helpers/safety.cjs');
const reportLabel=process.env.LS_TEST_REPORT_LABEL;
if(reportLabel&&!/^[a-z0-9-]+$/.test(reportLabel))throw new Error('Invalid local report label.');
const reportRoot=reportLabel?'artifacts/runs/'+reportLabel:'artifacts';
module.exports = defineConfig({
  testDir: './specs',
  timeout: 180000,
  expect: { timeout: 10000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: true,
  outputDir: reportRoot+'/results',
  reporter: [
    ['list'],
    ['html', { outputFolder: reportRoot+'/html', open: 'never' }],
    ['json', { outputFile: reportRoot+'/results.json' }],
    ['./helpers/summary-reporter.cjs',{reportRoot}]
  ],
  use: {
    baseURL: BASE_URL,
    viewport: { width: 1440, height: 1000 },
    ignoreHTTPSErrors: false,
    serviceWorkers: 'block',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    video: 'off'
  },
  projects: [
    { name: 'readonly', testMatch: /(?:readonly|manual-guard|standings-math)\.spec\.cjs/ },
    { name: 'mutating', testMatch: /(?:registration|league-regression|session-preview|integrity-regression|legacy-session|csrf|team-scores|scrambler-v2-persistence)\.spec\.cjs/ }
  ]
});
