// Serve an explicitly selected migration bundle through existing intercepted UI tests.
// API requests retain each suite's own fixtures/write guards. No backend is contacted.
const fs = require('node:fs'), path = require('node:path');
const root = path.resolve(__dirname, '../../..');
module.exports = async route => {
 if (!process.env.LEAGUE_TEST_DIST || route.request().method() !== 'GET') return false;
 const dist = path.resolve(process.env.LEAGUE_TEST_DIST);
 const artifacts = path.join(root, 'tests/functional/artifacts') + path.sep;
 if (!dist.startsWith(artifacts)) throw Error('Fixture bundle must be inside this worktree artifacts.');
 const url = new URL(route.request().url());
 let file;
 if (url.hostname === 'fonts.googleapis.com') file = path.join(root, 'tests/functional/artifacts/schedule-redesign/material-icons.css');
 else if (url.hostname === 'fonts.gstatic.com') file = path.join(root, 'tests/functional/artifacts/schedule-redesign/material-icons.woff2');
 else {
  if (url.origin !== 'https://localhost:5001' || url.pathname.toLowerCase().startsWith('/api/')) return false;
  file = path.resolve(dist, '.' + decodeURIComponent(url.pathname));
  if (file !== dist && !file.startsWith(dist + path.sep)) { await route.abort(); return true; }
  if (!path.extname(file)) file = path.join(dist, 'index.html');
 }
 if (!fs.existsSync(file) || !fs.statSync(file).isFile()) { await route.abort(); return true; }
 const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2' };
 await route.fulfill({ body: fs.readFileSync(file), contentType: types[path.extname(file)] || 'application/octet-stream' });
 return true;
};
