// Run the existing PWA regression against this audit's current production build.
// The loopback fixture host has no SQL and never reaches real authentication/email endpoints.
const c=require('./common.cjs'),Module=require('module');
const preview=c.path.join(c.root,'tools/pwa/preview.cjs'),test=c.path.join(c.root,'tests/functional/scripts/pwa.cjs');
let source=c.fs.readFileSync(preview,'utf8');const marker='const root=path.resolve(__dirname,"../../Allport\'s League Scrambler/ClientApp/dist");';c.assert(source.includes(marker));
source=source.replace(marker,'const root=path.resolve(__dirname,"../../tests/functional/artifacts/scrambler-v2-audit/production-dist");');
const hostModule=new Module(preview,module);hostModule.filename=preview;hostModule.paths=module.paths;require.cache[preview]=hostModule;hostModule._compile(source,preview);
const testModule=new Module(test,module);testModule.filename=test;testModule.paths=module.paths;testModule._compile(c.fs.readFileSync(test,'utf8'),test);
