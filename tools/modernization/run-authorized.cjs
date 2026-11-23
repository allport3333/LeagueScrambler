// Capture native stderr directly, so PowerShell's NativeCommandError cannot abort owned cleanup.
const fs=require('fs'),path=require('path'),cp=require('child_process');
const root=path.resolve(__dirname,'../..'),name=process.argv[2],mode=process.argv[3],cleanup=mode==='--cleanup'||mode==='--cleanup-recovery',recovery=mode==='--recovery'||mode==='--cleanup-recovery';
if(!/^authorized-[a-z0-9-]+$/.test(name||''))throw Error('Use a named authorized modernization artifact run.');
const output=path.join(root,'tests/functional/artifacts/modernization',name);
const log=path.join(root,'tests/functional/artifacts/modernization',name+(cleanup?'-cleanup':'')+'.log');
if(fs.existsSync(log))throw Error('Preserve the previous log; choose a new run name.');
const fd=fs.openSync(log,'wx');
const result=cp.spawnSync(path.join(root,'tests/functional/.tools/dotnet10/dotnet.exe'),[
 path.join(root,'tests/functional/artifacts/modernization/net10-integration-bin/IntegrationCheck.dll'),
 path.join(path.dirname(root),"Allport's League Scrambler/Allport's League Scrambler/.env"),output,
 mode==='--recovery-search'?'--recovery-search':recovery?(cleanup?'--cleanup-team-authorization':'--team-authorization'):(cleanup?'--cleanup-authorized':'--authorized-development')
],{cwd:root,windowsHide:true,stdio:['ignore',fd,fd]});
fs.closeSync(fd);console.log(JSON.stringify({run:name,cleanup,exitCode:result.status,log:path.relative(root,log)}));
process.exitCode=result.status===0?0:1;
