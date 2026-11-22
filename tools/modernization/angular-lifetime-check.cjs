// Bounded synthetic process test; no Angular compilation, API, database or global process search.
const {fork}=require('node:child_process'),path=require('node:path'),fs=require('node:fs');
const preload=path.resolve(__dirname,"../../Allport's League Scrambler/ClientApp/tools/angular-lifetime.cjs");
if(process.argv[2]==='--child'){
 setInterval(()=>{},1000);process.send({ready:true,pid:process.pid});
}else if(process.argv[2]==='--wrapper'){
 require(path.join(path.dirname(preload),'parent-lifetime.cjs'))();
 const child=fork(__filename,['--child'],{execArgv:['--require',preload],stdio:['ignore','ignore','ignore','ipc']});
 child.on('message',message=>process.send({...message,wrapper:process.pid}));
}else if(process.argv[2]==='--parent'){
 const wrapper=fork(__filename,['--wrapper'],{stdio:['ignore','ignore','ignore','ipc']});
 wrapper.on('message',message=>process.send(message));
}else{
 const parent=fork(__filename,['--parent'],{stdio:['ignore','ignore','ignore','ipc']});
 const timer=setTimeout(()=>{parent.kill();console.error('Process fixture did not initialize.');process.exitCode=1;},5000);
 parent.once('message',async message=>{
  clearTimeout(timer);if(!message.ready)throw Error('Unexpected synthetic process identity.');
  parent.kill();let alive=true;
  for(let tries=0;tries<40;tries++){
   await new Promise(resolve=>setTimeout(resolve,100));
   const running=[message.pid,message.wrapper].filter(pid=>{try{process.kill(pid,0);return true;}catch{return false;}});
   if(!running.length){alive=false;break;}
  }
  const result={pass:!alive,privateIpcDisconnect:true,forcedParentExit:true,databaseWrites:false};
  const output=path.resolve(__dirname,'../../tests/functional/artifacts/modernization/angular-lifetime-check.json');
  fs.writeFileSync(output,JSON.stringify(result,null,2));
  if(alive){process.kill(message.pid);process.exitCode=1;}
  console.log(JSON.stringify(result));
 });
}
