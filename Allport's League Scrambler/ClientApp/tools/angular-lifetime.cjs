// Private Node IPC closes even if Windows kills an npm/cmd ancestor without a signal.
// This preload is used only by our development CLI child, never browser/production code.
if(typeof process.send==='function')process.once('disconnect',()=>{
 if(process.listenerCount('SIGINT')){
  process.emit('SIGINT');
  setTimeout(()=>process.exit(0),2000).unref();
 }else process.exit(0);
});
