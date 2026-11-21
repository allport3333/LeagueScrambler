// Reuse the existing real-worker regression with an explicitly selected build.
// Static loopback host and synthetic APIs only; no SQL or real authentication.
const fs = require('fs'), path = require('path'), Module = require('module'), assert = require('assert');
const root = path.resolve(__dirname, '../..');
const dist = path.resolve(process.argv[2] || '');
const out = path.resolve(process.argv[3] || '');
const artifacts = path.join(root, 'tests/functional/artifacts') + path.sep;
if (!process.argv[2] || !process.argv[3] || !dist.startsWith(artifacts) || !out.startsWith(artifacts)) {
 throw Error('Provide build and output directories inside this worktree artifacts folder.');
}
if (!fs.existsSync(path.join(dist, 'ngsw.json'))) throw Error('Selected production service worker build is missing.');
const preview = path.join(root, 'tools/pwa/preview.cjs');
const test = path.join(root, 'tests/functional/scripts/pwa.cjs');
let source = fs.readFileSync(preview, 'utf8');
const marker = 'const root=path.resolve(__dirname,"../../Allport\'s League Scrambler/ClientApp/dist");';
assert(source.includes(marker), 'Preview host changed; review the wrapper before running.');
source = source.replace(marker, 'const root=' + JSON.stringify(dist) + ';');
const host = new Module(preview, module); host.filename = preview; host.paths = Module._nodeModulePaths(path.dirname(preview));
require.cache[preview] = host; host._compile(source, preview);
let suite = fs.readFileSync(test, 'utf8');
const output = "const out=path.resolve(__dirname,'../artifacts/pwa');";
assert(suite.includes(output), 'PWA suite changed; review the output selection.');
suite = suite.replace(output, 'const out=' + JSON.stringify(out) + ';');
const run = new Module(test, module); run.filename = test; run.paths = Module._nodeModulePaths(path.dirname(test));
run._compile(suite, test);
