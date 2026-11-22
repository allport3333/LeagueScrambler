const fs=require('fs'),path=require('path'),cp=require('child_process');
const root=path.resolve(__dirname,'../..'),name=process.argv[2];if(!name||!/^[a-z0-9-]+$/i.test(name))throw Error('Use a simple checkpoint name.');
const checkpointRoot=path.join(root,'tests/functional/artifacts/modernization/checkpoints');
fs.mkdirSync(checkpointRoot,{recursive:true});
const out=path.join(checkpointRoot,name);
// Keep earlier successful source snapshots when a later checkpoint uses the same name.
const inside=(base,value)=>{const relative=path.relative(base,value);return relative!==''&&!relative.startsWith('..'+path.sep)&&relative!=='..'&&!path.isAbsolute(relative);};
const realRoot=fs.realpathSync(root),realCheckpoints=fs.realpathSync(checkpointRoot);
if(!inside(realRoot,realCheckpoints))throw Error('Checkpoint directory is outside this worktree.');
if(fs.existsSync(out)){
 const source=fs.realpathSync(out),archive=path.resolve(realCheckpoints,name+'-'+new Date().toISOString().replace(/[:.]/g,'-')+'-'+process.pid);
 if(!inside(realCheckpoints,source)||!inside(realCheckpoints,archive)||fs.existsSync(archive))throw Error('Unsafe checkpoint archive path.');
 fs.renameSync(source,archive);
}
fs.mkdirSync(out,{recursive:true});
const git=args=>cp.execFileSync('git',args,{cwd:root,encoding:'utf8',windowsHide:true});
git(['diff','--binary','--output='+path.join(out,'tracked.patch')]);
const changed=[...git(['diff','--name-only','-z']).split('\0'),...git(['ls-files','--others','--exclude-standard','-z']).split('\0')].filter(Boolean),deleted=[];
for(const file of new Set(changed)){if(path.isAbsolute(file)||file.split(/[\\/]/).includes('..'))throw Error('Unexpected path');const from=path.join(root,file);if(!fs.existsSync(from)){deleted.push(file);continue;}const to=path.join(out,'files',file);fs.mkdirSync(path.dirname(to),{recursive:true});fs.copyFileSync(from,to);}
const pkg=JSON.parse(fs.readFileSync(path.join(root,"Allport's League Scrambler/ClientApp/package.json"),'utf8').replace(/^\uFEFF/,''));fs.writeFileSync(path.join(out,'checkpoint.json'),JSON.stringify({name,base:git(['rev-parse','HEAD']).trim(),changed,deleted,packages:pkg,createdUtc:new Date().toISOString(),committed:false},null,2));
console.log('Recoverable checkpoint: '+out);
