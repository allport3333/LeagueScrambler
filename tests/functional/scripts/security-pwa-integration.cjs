// Reuse the established PWA suite against this security review's fresh build,
// without changing the application's build output or the existing test fixture.
const fs=require('fs'),path=require('path'),Module=require('module'),assert=require('assert/strict');
const root=path.resolve(__dirname,'../../..'),preview=path.join(root,'tools/pwa/preview.cjs'),test=path.join(__dirname,'pwa.cjs');
let source=fs.readFileSync(preview,'utf8');const marker='const root=path.resolve(__dirname,"../../Allport\'s League Scrambler/ClientApp/dist");';assert(source.includes(marker));
source=source.replace(marker,'const root=path.resolve(__dirname,"../../tests/functional/artifacts/security-2026-11/production-dist");');
const host=new Module(preview,module);host.filename=preview;host.paths=module.paths;require.cache[preview]=host;host._compile(source,preview);
let suite=fs.readFileSync(test,'utf8');const output="const out=path.resolve(__dirname,'../artifacts/pwa');";assert(suite.includes(output));suite=suite.replace(output,"const out=path.resolve(__dirname,'../artifacts/security-2026-11/pwa');");
const run=new Module(test,module);run.filename=test;run.paths=module.paths;run._compile(suite,test);
