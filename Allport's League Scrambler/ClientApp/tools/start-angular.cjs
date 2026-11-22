// Keep SpaServices' development startup contract while Angular CLI uses modern logging.
// Never announce readiness based only on a changed console message.
const {spawn}=require('node:child_process');
const path=require('node:path'),net=require('node:net'),http=require('node:http'),https=require('node:https');
const args=process.argv.slice(2),front=path.resolve(__dirname,'..');
const parentWatch=require('./parent-lifetime.cjs')();
const portArgument=args.find(a=>a.startsWith('--port='));
const portIndex=args.indexOf('--port');
const port=Number(portArgument?portArgument.slice(7):portIndex>=0?args[portIndex+1]:4200);
if(!Number.isInteger(port)||port<1||port>65535)throw Error('Use a valid Angular development port.');
const ssl=args.includes('--ssl')||args.includes('--ssl=true'),protocol=ssl?https:http;
const origin=`${ssl?'https':'http'}://localhost:${port}`;
// Reject an occupied port rather than announcing somebody else's server as ready.
const available=net.createServer();
available.once('error',()=>{console.error('Angular development port is already in use. Choose another --port.');process.exitCode=1;});
available.listen(port,'localhost',()=>available.close(()=>{
 const cli=spawn(process.execPath,['--require',path.join(__dirname,'angular-lifetime.cjs'),path.join(front,'node_modules/@angular/cli/bin/ng.js'),'serve',...args],{
  cwd:front,stdio:['inherit','pipe','pipe','ipc'],windowsHide:true
 });
 cli.stdout.pipe(process.stdout);cli.stderr.pipe(process.stderr);
 let exited=false,announced=false,timer;
 const probe=()=>{
  if(exited||announced)return;
  const request=protocol.request(origin,{method:'HEAD',timeout:1500,...(ssl?{rejectUnauthorized:false}:{})},response=>{
   response.resume();
   if(!exited&&response.statusCode===200){
    announced=true;
    // This exact line is consumed by the installed .NET 10 SpaServices middleware.
    console.log(`open your browser on ${origin}`);
   }else timer=setTimeout(probe,250);
  });
  request.on('timeout',()=>request.destroy());
  request.on('error',()=>{if(!exited&&!announced)timer=setTimeout(probe,250);});
  request.end();
 };
 cli.on('error',()=>{exited=true;clearTimeout(timer);console.error('Unable to start the installed Angular CLI.');process.exitCode=1;});
 cli.on('exit',code=>{exited=true;clearTimeout(timer);process.exitCode=code===null?1:code;});
 for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>{exited=true;clearTimeout(timer);cli.kill(signal);});
 probe();
}));
