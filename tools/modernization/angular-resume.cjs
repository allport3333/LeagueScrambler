// Resume only reviewed, unfinished official migrations after package installation.
// Example: node angular-resume.cjs 14 @angular/cli @angular/cdk @angular/core @angular/material
const fs = require('fs'), path = require('path'), cp = require('child_process');
const root = path.resolve(__dirname, '../..'), front = path.join(root, "Allport's League Scrambler/ClientApp");
const major = Number(process.argv[2]), packages = process.argv.slice(3);
const allowed = new Set(['@angular/cli', '@angular/core', '@angular/cdk', '@angular/material', '@angular-eslint/schematics']);
if (!Number.isInteger(major) || major < 13 || major > 22 || !packages.length || packages.some(p => !allowed.has(p))) throw Error('Specify target major and explicit unfinished migration packages.');
if (cp.execFileSync('git', ['branch', '--show-current'], { cwd: root, encoding: 'utf8', windowsHide: true }).trim() !== 'feature/framework-modernization') throw Error('Modernization branch required.');
const out = path.join(root, 'tests/functional/artifacts/modernization');
const previous = JSON.parse(fs.readFileSync(path.join(out, `checkpoints/angular${major - 1}-passed/checkpoint.json`), 'utf8')).packages;
const runtime = major <= 15 ? '14.21.3' : major === 16 ? '16.20.2' : major <= 19 ? '18.20.8' : '22.23.5';
const nodeDir = path.join(root, 'tests/functional/.tools', `node-v${runtime}-win-x64`), node = path.join(nodeDir, 'node.exe');
const env = Object.assign({}, process.env, { PATH: nodeDir + path.delimiter + process.env.PATH,
 NG_CLI_ANALYTICS: 'false', NG_DISABLE_VERSION_CHECK: 'true', NODE_OPTIONS: '--max-old-space-size=4096',
 NG_BUILD_MAX_WORKERS: '2', NGCC_MAX_WORKERS: '2' });
const inheritedPath = process.env.PATH || process.env.Path || '';
for (const key of Object.keys(env)) if (key.toLowerCase() === 'path') delete env[key];
env[process.platform === 'win32' ? 'Path' : 'PATH'] = nodeDir + path.delimiter + inheritedPath;
const records = [];
for (const name of packages) {
 const from = ((previous.dependencies || {})[name] || (previous.devDependencies || {})[name] || '').match(/\d+\.\d+\.\d+/);
 const to = require(path.join(front, 'node_modules', name, 'package.json')).version;
 if (!from || Number(from[0].split('.')[0]) !== major - 1 || Number(to.split('.')[0]) !== major) throw Error('Unexpected from/to package versions: ' + name);
 const logPath = path.join(out, `angular${major}-resume-${name.replace(/[^a-z0-9-]/gi, '_')}.log`);
 const log = fs.openSync(logPath, 'w');
 const result = cp.spawnSync(node, [path.join(front, 'node_modules/@angular/cli/bin/ng'), 'update', name,
  '--migrate-only', '--from=' + from[0], '--to=' + to, '--allow-dirty'],
  { cwd: front, env, windowsHide: true, stdio: ['ignore', log, log] });
 fs.closeSync(log);
 const passed = result.status === 0 && !result.error && !/Migration failed:|Unable to resolve migrations for package|An unhandled exception occurred:/i.test(fs.readFileSync(logPath, 'utf8'));
 records.push({ name, from: from[0], to, passed, exitCode: result.status, log: logPath });
 fs.writeFileSync(path.join(out, `angular${major}-resume-result.json`), JSON.stringify(records, null, 2));
 console.log(JSON.stringify(records[records.length - 1]));
 if (!passed) process.exit(1);
}
const updatePath = path.join(out, `angular${major}-update-result.json`);
const update = fs.existsSync(updatePath) ? JSON.parse(fs.readFileSync(updatePath, 'utf8')) : { target: major };
update.resumedPassed = true; update.migrationComplete = true; update.resumedPackages = packages; update.buildPending = true;
fs.writeFileSync(updatePath, JSON.stringify(update, null, 2));
const build = cp.spawnSync(node, [path.join(__dirname, 'angular-checkpoint.cjs')], { cwd: root, env, windowsHide: true, stdio: 'inherit' });
process.exit(build.status === 0 && !build.error ? 0 : 1);
