// Focused regressions for the patched dependencies; never opens the application or database.
const fs=require('fs'),path=require('path'),assert=require('assert/strict'),{spawnSync}=require('child_process');
const root=path.resolve(__dirname,'../../..'),front=path.join(root,"Allport's League Scrambler/ClientApp");
const out=path.resolve(__dirname,'../artifacts/security');fs.mkdirSync(out,{recursive:true});
const pkg=JSON.parse(fs.readFileSync(path.join(front,'package.json'))),lock=JSON.parse(fs.readFileSync(path.join(front,'package-lock.json')));
const proxy=require(path.join(front,'node_modules/proxy-addr'));
assert.equal(require(path.join(front,'node_modules/proxy-addr/package.json')).version,'2.0.8');
assert.equal(require(path.join(front,'node_modules/brace-expansion/package.json')).version,'1.1.22');
assert.equal(require('@playwright/test/package.json').version,'1.55.1');
for(const subnet of ['::ffff:10.0.0.0/8','::/1']){
 const trust=proxy.compile(subnet);assert.equal(trust('203.0.113.1',0),false);assert.equal(trust('::ffff:203.0.113.1',0),false);
}
assert.equal(proxy.compile('10.0.0.0/8')('10.1.2.3',0),true);
assert.equal(proxy.compile('::ffff:10.0.0.0/104')('10.1.2.3',0),true);
const expand=require(path.join(front,'node_modules/brace-expansion'));
assert.deepEqual(expand('round-{1..5}'),['round-1','round-2','round-3','round-4','round-5']);
assert.deepEqual(expand('{Gold,Silver}/{1,2}'),['Gold/1','Gold/2','Silver/1','Silver/2']);
// Run malformed/large patterns in a bounded child: no memory-exhaustion payload in the test runner.
const child=spawnSync(process.execPath,['--max-old-space-size=128','-e',
 'const e=require('+JSON.stringify(path.join(front,'node_modules/brace-expansion'))+');'+
 'for(const p of ["{".repeat(4000)+"a,b"+"}".repeat(4000),"{a},b}".repeat(20000),"{1..1000000000}","{1..3..0}"]){const r=e(p);if(!Array.isArray(r)||r.length>100000)process.exit(2)}'
],{timeout:10000,windowsHide:true,encoding:'utf8'});
assert.equal(child.status,0,child.stderr||String(child.error));
const occurrences=[];
function walk(deps,base=''){
 for(const [name,value]of Object.entries(deps||{})){
  const at=base?base+' > '+name:name;
  if(['proxy-addr','brace-expansion','node-forge','@angular/router','webpack-dev-middleware'].includes(name))occurrences.push({name,version:value.version,path:at});
  if(name==='proxy-addr')assert.equal(value.version,'2.0.8');
  if(name==='brace-expansion')assert.equal(value.version,'1.1.22');
  walk(value.dependencies,at);
 }
}
walk(lock.dependencies);
for(const unused of ['@angular/platform-server','@nguniversal/module-map-ngfactory-loader','aspnet-prerendering']){
 assert(!pkg.dependencies[unused]);assert(!lock.dependencies[unused]);assert(!fs.existsSync(path.join(front,'node_modules',unused)));
}
const bin=path.resolve(__dirname,'../node_modules/playwright-core/bin');
for(const file of fs.readdirSync(bin).filter(n=>/^reinstall_.*_mac\.sh$/.test(n)))assert(!/curl[^\n]*(?:\s-k\b|--insecure)/.test(fs.readFileSync(path.join(bin,file),'utf8')),file+' bypasses TLS');
const angular=JSON.parse(fs.readFileSync(path.join(front,'angular.json'))).projects.Allport_s_League_Scrambler.architect.serve.options;
assert.equal(angular.host,'localhost');assert.equal(angular.disableHostCheck,false);assert.equal(angular.servePath,'/');
assert(/<BuildServerSideRenderer>false<\/BuildServerSideRenderer>/.test(fs.readFileSync(path.join(root,"Allport's League Scrambler/Allport's League Scrambler.csproj"),'utf8')));
const result={passed:true,checks:['installed and locked patched versions','IPv4-mapped spoofing rejected; valid IPv4/mapped subnets retained','normal brace globs unchanged; hostile patterns bounded in timeout/memory-limited child','Playwright macOS installer curl flags no longer disable TLS','unused SSR packages removed; SSR disabled','loopback development host, host checks and slash-terminated serve path'],occurrences};
fs.writeFileSync(path.join(out,'dependency-regression.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
