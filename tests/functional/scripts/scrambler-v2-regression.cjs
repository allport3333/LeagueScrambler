// Run existing Scrambler browser fixture modes against V2's static build, without a backend.
const fs=require('fs'),path=require('path'),Module=require('module');
const fixture=path.resolve(__dirname,'scrambler-workspace.cjs');
const source=fs.readFileSync(fixture,'utf8').replace("else if(!p.startsWith('/api/')){await route.continue();return;}","else if(!p.startsWith('/api/')){await require('./scrambler-v2-browser.cjs').asset(route);return;}")
 .replace(/,out=mode===.*?;fs.mkdirSync\(out,\{recursive:true\}\);/,",out=path.resolve(__dirname,'../artifacts/scrambler-v2/regression-'+mode);fs.mkdirSync(out,{recursive:true});")
 .replace(/\.\.\/scrambler-workspace-evidence\/print-baseline\.json/g,'../artifacts/scrambler-v2/regression-before/print-baseline.json')
 .replace('await route.continue();return;','await route.abort();return;'); // Stable local fonts for baseline/new pixel comparison.
if(source===fs.readFileSync(fixture,'utf8'))throw Error('Fixture transport changed; refusing a live server fallback.');
const compiled=new Module(fixture,module);compiled.filename=fixture;compiled.paths=module.paths;compiled._compile(source,fixture);
