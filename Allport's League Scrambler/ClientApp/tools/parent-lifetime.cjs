// A Windows npm/cmd intermediary can disappear without signaling its Node child.
// Probe only our own original parent. Never terminate any process by a discovered PID.
module.exports=()=>{
 const parent=process.ppid;
 const timer=setInterval(()=>{
  try{process.kill(parent,0);}catch(error){if(error.code==='ESRCH')process.exit(0);}
 },500);
 timer.unref();return timer;
};
