const fs = require('node:fs');
const { spawnSync } = require('node:child_process');
const { createRequire } = require('node:module');

const declared = require('../package.json');
const locked = require('../package-lock.json').packages;

function readManifest(file) {
    try {
        return JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (error) {
        if (error.code === 'ENOENT' || error.code === 'ENOTDIR' || error instanceof SyntaxError) return undefined;
        throw error;
    }
}

function sameDependencies(expected = {}, actual = {}) {
    return Object.keys(expected).length === Object.keys(actual).length &&
        Object.keys(expected).every(name => expected[name] === actual[name]);
}

function supports(platforms, current) {
    if (!platforms?.length) return true;
    return !platforms.includes('!' + current) &&
        (platforms.includes(current) || platforms.includes('any') || platforms.every(name => name.startsWith('!')));
}

function installationProblem() {
    for (const field of ['dependencies', 'devDependencies', 'optionalDependencies']) {
        if (!sameDependencies(declared[field], locked['']?.[field])) return 'package.json and package-lock.json differ';
    }
    const installed = readManifest('node_modules/.package-lock.json')?.packages;
    if (!installed) return 'npm installation metadata is missing or invalid';

    for (const [directory, entry] of Object.entries(locked)) {
        if (!directory || !supports(entry.os, process.platform) || !supports(entry.cpu, process.arch)) continue;
        const metadata = installed[directory];
        // A platform-neutral optional package may be omitted by npm.
        if (!metadata && entry.optional && !entry.os && !entry.cpu) continue;
        if (metadata?.version !== entry.version || metadata?.integrity !== entry.integrity ||
            readManifest(directory + '/package.json')?.version !== entry.version) {
            return directory + ' is missing or differs from the lockfile';
        }
    }

    if (!fs.existsSync('node_modules/@angular/cli/bin/ng.js')) return 'the Angular CLI entry point is missing';
    try {
        // Verify the installed native Sass runtime can start, including its executable and snapshot.
        const requireFromAngular = createRequire(require.resolve('@angular/build/package.json'));
        requireFromAngular('sass-embedded').compileString('a { color: red; }');
    } catch (error) {
        return 'the installed Sass runtime failed its check (' + error.message + ')';
    }
}

const problem = installationProblem();
if (problem) {
    console.log('Restoring frontend dependencies with npm ci because ' + problem + '.');
    const restore = spawnSync(process.execPath, [process.env.npm_execpath, 'ci', '--include=dev', '--include=optional'],
        { stdio: 'inherit' });
    if (restore.error) throw restore.error;
    if (restore.status !== 0) process.exit(restore.status ?? 1);

    const remaining = installationProblem();
    if (remaining) throw new Error('Frontend dependencies are still invalid after npm ci: ' + remaining + '.');
} else {
    console.log('Reusing the installed frontend dependencies.');
}
