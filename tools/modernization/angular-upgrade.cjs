// One official major migration at a time, with an isolated compatible Node runtime.
// Stops on update/build failure. Never commits, deploys or changes master.
const fs = require('fs'), path = require('path'), cp = require('child_process');
const root = path.resolve(__dirname, '../..'), front = path.join(root, "Allport's League Scrambler/ClientApp");
const target = Number(process.argv[2]);
if (!Number.isInteger(target) || target < 13 || target > 22) throw Error('Specify one target major between 13 and 22.');
const branch = cp.execFileSync('git', ['branch', '--show-current'], { cwd: root, encoding: 'utf8', windowsHide: true }).trim();
if (branch !== 'feature/framework-modernization') throw Error('Refusing to update outside the modernization branch.');
const current = require(path.join(front, 'node_modules/@angular/core/package.json')).version;
if (Number(current.split('.')[0]) !== target - 1) throw Error('Installed Angular must be exactly one major before the target. Inspect pending migrations first.');
const out = path.join(root, 'tests/functional/artifacts/modernization');
const previous = JSON.parse(fs.readFileSync(path.join(out, `angular${target - 1}-checkpoint-result.json`), 'utf8'));
if (!previous.passed || previous.angular !== current) throw Error('The installed previous major needs a passing production checkpoint first.');
const runtime = target <= 15 ? '14.21.3' : target === 16 ? '16.20.2' : target <= 19 ? '18.20.8' : '22.23.5';
const nodeDir = path.join(root, 'tests/functional/.tools', `node-v${runtime}-win-x64`), node = path.join(nodeDir, 'node.exe');
if (!fs.existsSync(node)) throw Error('Verified isolated Node runtime is missing.');
const env = Object.assign({}, process.env, { PATH: nodeDir + path.delimiter + process.env.PATH,
 npm_config_ignore_scripts: 'true', npm_config_audit: 'false', npm_config_fund: 'false',
 NG_CLI_ANALYTICS: 'false', NG_DISABLE_VERSION_CHECK: 'true', NODE_OPTIONS: '--max-old-space-size=4096',
 NG_BUILD_MAX_WORKERS: '2', NGCC_MAX_WORKERS: '2' });
// Windows environment keys are case-insensitive, but a JS object can contain
// both Path and PATH. Avoid allowing npm/npx to pick the system Node 10 entry.
const inheritedPath = process.env.PATH || process.env.Path || '';
for (const key of Object.keys(env)) if (key.toLowerCase() === 'path') delete env[key];
env[process.platform === 'win32' ? 'Path' : 'PATH'] = nodeDir + path.delimiter + inheritedPath;
const logPath = path.join(out, `angular${target}-update.log`);
if (fs.existsSync(logPath)) {
 const archive = path.join(out, `angular${target}-attempts`, new Date().toISOString().replace(/[:.]/g, '-'));
 fs.mkdirSync(archive, { recursive: true });
 fs.copyFileSync(logPath, path.join(archive, 'update.log'));
 const resultPath = path.join(out, `angular${target}-update-result.json`);
 if (fs.existsSync(resultPath)) fs.copyFileSync(resultPath, path.join(archive, 'update-result.json'));
}
const log = fs.openSync(logPath, 'w'), started = Date.now();
const runningPath = path.join(out, 'running-angular-step.json');
fs.writeFileSync(runningPath, JSON.stringify({ target, from: current, node: runtime, branch,
 worktree: root, runnerPid: process.pid, startedUtc: new Date().toISOString(), status: 'updating', log: logPath }, null, 2));
console.log(`Official Angular ${target - 1} to ${target} migration; Node ${runtime}; detailed log: ${logPath}`);
// Run the target CLI up front: an old in-memory DevKit can otherwise execute new
// migration code against missing Tree APIs even after packages have been replaced.
const npmVersion = require(path.join(nodeDir, 'node_modules/npm/package.json')).version;
const npxArgs = Number(npmVersion.split('.')[0]) <= 6
 ? ['--ignore-existing', '-p', `@angular/cli@${target}`]
 : ['--yes', '--package', `@angular/cli@${target}`];
const result = cp.spawnSync(node, [path.join(nodeDir, 'node_modules/npm/bin/npx-cli.js'), ...npxArgs, 'ng', 'update',
 `@angular/core@${target}`, `@angular/cli@${target}`, `@angular/material@${target}`,
 `@angular-eslint/schematics@${target}`, '--allow-dirty'],
 { cwd: front, env, windowsHide: true, stdio: ['ignore', log, log] });
fs.closeSync(log);
const migrationFailed = /Migration failed:|Unable to resolve migrations for package|An unhandled exception occurred:/i.test(fs.readFileSync(logPath, 'utf8'));
const summary = { from: current, target, node: runtime, passed: result.status === 0 && !result.error,
 exitCode: result.status, error: result.error && result.error.message, elapsedMs: Date.now() - started,
 completedUtc: new Date().toISOString(), buildPending: true };
if (migrationFailed) { summary.passed = false; summary.error = 'Official migration reported failure; do not advance even if the old CLI returned zero.'; }
fs.writeFileSync(path.join(out, `angular${target}-update-result.json`), JSON.stringify(summary, null, 2));
fs.writeFileSync(runningPath, JSON.stringify({ ...summary, runnerPid: process.pid, status: summary.passed ? 'building' : 'update-failed' }, null, 2));
console.log(JSON.stringify(summary));
if (!summary.passed) process.exit(1);
const build = cp.spawnSync(node, [path.join(__dirname, 'angular-checkpoint.cjs')],
 { cwd: root, env, windowsHide: true, stdio: 'inherit' });
const passed = build.status === 0 && !build.error;
fs.writeFileSync(runningPath, JSON.stringify({ target, runnerPid: process.pid, status: passed ? 'checkpoint-passed' : 'build-failed',
 completedUtc: new Date().toISOString(), exitCode: build.status }, null, 2));
process.exit(passed ? 0 : 1);
