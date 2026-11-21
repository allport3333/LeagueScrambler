// Build one installed intermediate Angular version; stop on errors and preserve evidence.
// Run with the Node version supported by that Angular checkpoint. Never updates packages.
const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const crypto = require('crypto');
const root = path.resolve(__dirname, '../..');
const front = path.join(root, "Allport's League Scrambler/ClientApp");
const pkg = require(path.join(front, 'node_modules/@angular/core/package.json'));
const major = Number(pkg.version.split('.')[0]);
if (!Number.isInteger(major) || major < 8 || major > 22) throw Error('Unexpected Angular checkpoint.');
const out = path.join(root, 'tests/functional/artifacts/modernization');
fs.mkdirSync(out, { recursive: true });
const sourceDigest = () => crypto.createHash('sha256').update(cp.execFileSync('git',
  ['diff', '--binary', '--', "Allport's League Scrambler/ClientApp"],
  { cwd: root, maxBuffer: 32 * 1024 * 1024, windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'] })).digest('hex');
const before = sourceDigest();
const env = Object.assign({}, process.env, {
  NODE_OPTIONS: '--max-old-space-size=4096', NGCC_MAX_WORKERS: '2',
  NG_BUILD_MAX_WORKERS: '2', NG_CLI_ANALYTICS: 'false'
});
const log = fs.openSync(path.join(out, `angular${major}-build.log`), 'w');
const started = Date.now();
const result = cp.spawnSync(process.execPath, [path.join(front, 'node_modules/@angular/cli/bin/ng'),
  'build', '--configuration=production', '--progress=false', '--output-path=' + path.join(out, `angular${major}-dist`)],
  { cwd: front, env, windowsHide: true, stdio: ['ignore', log, log] });
fs.closeSync(log);
const summary = { angular: pkg.version, node: process.version, elapsedMs: Date.now() - started,
  passed: result.status === 0 && !result.error, exitCode: result.status,
  error: result.error ? result.error.message : undefined, completedUtc: new Date().toISOString() };
summary.sourceStableDuringBuild = before === sourceDigest();
if (!summary.sourceStableDuringBuild) { summary.passed = false; summary.error = 'Frontend source changed during build; rerun after migrations finish.'; }
const updateResult = path.join(out, `angular${major}-update-result.json`);
if (fs.existsSync(updateResult)) {
 const update = JSON.parse(fs.readFileSync(updateResult, 'utf8'));
 if (!update.passed && !update.resumedPassed) { summary.passed = false; summary.error = 'Official migrations remain unfinished; a compiling checkpoint cannot override them.'; }
}
fs.writeFileSync(path.join(out, `angular${major}-checkpoint-result.json`), JSON.stringify(summary, null, 2));
const migrationResultPath = path.join(out, `angular${major}-update-result.json`);
if (fs.existsSync(migrationResultPath)) {
 const migrationResult = JSON.parse(fs.readFileSync(migrationResultPath, 'utf8'));
 migrationResult.buildPending = false;
 migrationResult.buildPassed = summary.passed;
 migrationResult.buildCompletedUtc = summary.completedUtc;
 fs.writeFileSync(migrationResultPath, JSON.stringify(migrationResult, null, 2));
}
console.log(JSON.stringify(summary));
if (!summary.passed) process.exit(1);
const statusPath = path.join(__dirname, 'STATUS.md');
let status = fs.readFileSync(statusPath, 'utf8');
status = status.replace(/## Current phase\r?\n\r?\n[\s\S]*?(?=\r?\n## )/,
  '## Current phase\n\nPhase 2: incremental Angular migration. Latest production checkpoint: Angular ' + pkg.version +
  ', Node ' + process.version + '. Official migrations and source-stable AOT production build passed. ' +
  'Continue with the next supported major and required compatibility work. Backend modernization, final browser integration, database parity, security audit and staging acceptance remain unfinished.\n');
status += '\n## Angular ' + major + ' production checkpoint\n\nCore ' + pkg.version + ', Node ' + process.version +
  '; official migration step completed, source-stable production build passed in ' + Math.round(summary.elapsedMs / 1000) +
  ' seconds. Detailed warnings and output: angular' + major + '-build.log. Completion: ' + summary.completedUtc + '.\n';
fs.writeFileSync(statusPath, status);
const checkpoint = cp.spawnSync(process.execPath, [path.join(__dirname, 'checkpoint.cjs'), `angular${major}-passed`],
  { cwd: root, windowsHide: true, encoding: 'utf8' });
fs.writeFileSync(path.join(out, `angular${major}-checkpoint.log`), (checkpoint.stdout || '') + (checkpoint.stderr || ''));
if (checkpoint.status !== 0) throw Error('Build passed but recoverable checkpoint failed.');
