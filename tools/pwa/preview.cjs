// Static production-build preview only: no SQL, credentials, or production host connections.
const http=require('http'),fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,"../../Allport's League Scrambler/ClientApp/dist");
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.json':'application/json','.webmanifest':'application/manifest+json','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml','.ico':'image/x-icon','.woff':'font/woff','.woff2':'font/woff2','.ttf':'font/ttf'};
function createPreview(options={}) {
 if(!fs.existsSync(path.join(root,'ngsw.json')))throw Error('Build the frontend with --prod before starting PWA preview.');
 return http.createServer(async(req,res)=>{
  try{
   const url=new URL(req.url,'http://127.0.0.1');
   if(url.pathname.toLowerCase().startsWith('/api/')){
    if(options.api)return options.api(req,res,url);
    res.writeHead(503,{'Content-Type':'application/json','Cache-Control':'no-store'});
    return res.end(JSON.stringify({message:'Static PWA preview has no application backend. Use the real development app for account/data workflows.'}));
   }
   if(req.method!=='GET'&&req.method!=='HEAD'){res.writeHead(405);return res.end();}
   let file=path.resolve(root,'.'+decodeURIComponent(url.pathname));
   if(file!==root&&!file.startsWith(root+path.sep)){res.writeHead(403);return res.end();}
   if(!path.extname(file))file=path.join(root,'index.html');
   if(!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);return res.end();}
   const name=path.basename(file),overridden=options.asset&&options.asset(name);
   const body=overridden===undefined?fs.readFileSync(file):Buffer.from(overridden);
   res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':['index.html','ngsw.json','ngsw-worker.js','safety-worker.js','worker-basic.min.js','manifest.webmanifest'].includes(name)?'no-cache':'public, max-age=3600'});
   res.end(req.method==='HEAD'?undefined:body);
  }catch(_){res.writeHead(500);res.end('Preview unavailable.');}
 });
}
module.exports={createPreview,root};
if(require.main===module){const server=createPreview();server.listen(5199,'127.0.0.1',()=>console.log('PWA static preview: http://127.0.0.1:5199/install-locally (no backend or real login). Ctrl+C stops it.'));}
