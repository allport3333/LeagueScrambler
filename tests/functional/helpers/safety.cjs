const fs = require('node:fs');
const path = require('node:path');
const BASE_URL = 'https://localhost:5001';
const ROOT = path.resolve(__dirname, '../../..');
function assertLocalUrl(value) {
  const url = new URL(value);
  if (url.origin !== BASE_URL || url.username || url.password || url.pathname.startsWith('//')) {
    throw new Error('Blocked URL outside the exact localhost test origin or malformed API path.');
  }
  if (/\/api\/Login\/(forgotpassword|resetpassword)/i.test(url.pathname)) {
    throw new Error('Password recovery is disabled in this suite.');
  }
  return url;
}
function envSettings() {
  const file = path.join(ROOT, "Allport's League Scrambler", '.env');
  const content = fs.readFileSync(file, 'utf8');
  const settings = {};
  for (const line of content.split(/\r?\n/)) {
    const match = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (match) settings[match[1]] = match[2].replace(/^(['"])(.*)\1$/, '$2');
  }
  const parts = Object.fromEntries((settings.LEAGUESCRAMBLER_DB_CONNECTION || '').split(';').filter(Boolean).map(part => {
    const index = part.indexOf('=');
    return [part.slice(0, index).trim().toLowerCase(), part.slice(index + 1).trim()];
  }));
  if ((parts.server || parts['data source']) !== 'localhost' ||
      (parts.database || parts['initial catalog']) !== 'LeagueScramblerDev' ||
      !/^(true|sspi)$/i.test(parts.trusted_connection || parts['integrated security'] || '') ||
      parts['user id'] || parts.password || parts.attachdbfilename) {
    throw new Error('Project SQL configuration is not the approved localhost Windows-authenticated development target.');
  }
  return { server: 'localhost', database: 'LeagueScramblerDev', windowsAuthentication: true };
}
function mutationApproval() {
  const file = path.join(__dirname, '../.local/mutation-approval.json');
  if (!fs.existsSync(file)) return false;
  const approval = JSON.parse(fs.readFileSync(file, 'utf8'));
  return approval.approved === true && approval.baseURL === BASE_URL &&
    approval.database === 'LeagueScramblerDev';
}
module.exports = { BASE_URL, ROOT, assertLocalUrl, envSettings, mutationApproval };
