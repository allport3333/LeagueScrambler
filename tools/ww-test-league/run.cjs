// Seed controller: hard-coded development target, current process binding, no stale test-suite approval reuse.
const fs=require('fs'),path=require('path'),{spawnSync}=require('child_process');
const root=path.resolve(__dirname,'../..'),safety=require('../../tests/functional/helpers/safety.cjs'),isolation=require('../../tests/functional/helpers/isolation.cjs');
const args=process.argv.slice(2),mode=args.shift()||'inspect',authorize=args.includes('--authorize'),prepare=args.includes('--prepare-test-player');
const local=path.join(root,'tests/functional/.local/ww-test-league');fs.mkdirSync(local,{recursive:true});const authorityFile=path.join(local,'authority.json');
function run(exe,args,options={}){const r=spawnSync(exe,args,{cwd:root,windowsHide:true,encoding:'utf8',timeout:120000,...options});if(r.error||r.status!==0)throw Error((r.stderr||r.stdout||String(r.error)).trim());return r.stdout;}
function verifyRuntime(){safety.envSettings();const before=isolation.processIdentity();const result=JSON.parse(run('powershell.exe',['-NoProfile','-ExecutionPolicy','Bypass','-File','tests/functional/helpers/runtime-verification.ps1','-ReadOnly']).trim().replace(/^\uFEFF/,''));const after=isolation.processIdentity();for(const f of ['pid','processStartUtc','projectDll','dllSha256','envSha256','launchProfileSha256'])if(before[f]!==after[f])throw Error('App/configuration changed during runtime verification.');if(result.pid!==after.pid||!result.effectiveRuntimeEnvironmentVerified||result.database!=='LeagueScramblerDev')throw Error('Development runtime proof failed.');return after;}
try{
 if(!['inspect','create','reset','remove','verify','selftest'].includes(mode))throw Error('Use inspect/create/reset/remove/verify.');
 const identity=verifyRuntime(),write=['create','reset','remove'].includes(mode);
 if(write&&authorize){const now=new Date();const record={scope:'ww-test-league',server:'localhost',database:'LeagueScramblerDev',baseURL:safety.BASE_URL,authorizationSource:'Explicit user request to seed/reset/remove WW Test League in the independently verified development database',issuedAt:now.toISOString(),expiresAt:new Date(now.getTime()+2*60*60*1000).toISOString(),allowTestAccountRelink:prepare,identity:{...identity,envFile:path.join(root,"Allport's League Scrambler/.env"),launchProfile:path.join(root,"Allport's League Scrambler/Properties/launchSettings.json")}};fs.writeFileSync(authorityFile,JSON.stringify(record,null,2));}
 if(write){const auth=JSON.parse(fs.readFileSync(authorityFile,'utf8'));if(auth.scope!=='ww-test-league'||prepare&&!auth.allowTestAccountRelink)throw Error('Seed scope/account-setup authorization missing.');isolation.validateProcessBinding(auth,identity);}
 const content=fs.readFileSync(path.join(root,"Allport's League Scrambler/.env"),'utf8');const line=content.split(/\r?\n/).find(l=>/^\s*LEAGUESCRAMBLER_DB_CONNECTION\s*=/.test(l));if(!line)throw Error('Development SQL setting missing.');let connection=line.slice(line.indexOf('=')+1).trim();if((connection.startsWith('"')&&connection.endsWith('"'))||(connection.startsWith("'")&&connection.endsWith("'")))connection=connection.slice(1,-1);
 const env={...process.env,ASPNETCORE_ENVIRONMENT:'Development',LEAGUESCRAMBLER_DB_CONNECTION:connection};
 const project='tools/ww-test-league/WWTestLeagueSeeder.csproj',buildLog=path.join(local,'build.log');
 if(!fs.existsSync(path.join(__dirname,'obj/project.assets.json'))||fs.statSync(path.join(root,project)).mtimeMs>fs.statSync(path.join(__dirname,'obj/project.assets.json')).mtimeMs)run('dotnet',['restore',project,'--ignore-failed-sources'],{env});
 fs.writeFileSync(buildLog,run('dotnet',['build',project,'--configuration','Release','--no-restore'],{env}));
 // Rebuilding Release must not silently invalidate/rebind the existing Debug application.
 const current=verifyRuntime();for(const f of ['pid','processStartUtc','dllSha256','envSha256','launchProfileSha256'])if(identity[f]!==current[f])throw Error('Running development binding changed after build.');
 const output=path.join(local,mode+'-report.json');const command=['tools/ww-test-league/bin/Release/netcoreapp2.2/WWTestLeagueSeeder.dll','--mode',mode,'--report',output];
 if(write)command.push('--authority',authorityFile);if(prepare)command.push('--prepare-test-player','true');const date=args.indexOf('--date');if(date>=0){if(!/^\d{4}-\d{2}-\d{2}$/.test(args[date+1]||''))throw Error('Date must be yyyy-MM-dd');command.push('--date',args[date+1]);}
 console.log(run('dotnet',command,{env}));
}catch(error){console.error(error.message);process.exitCode=1;}
