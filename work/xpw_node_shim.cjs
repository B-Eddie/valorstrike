// Node stand-in for the browser Worker the PATH WORKER block (work/path_worker_runtime.js) starts: the page's own worker source
// (XPW.source(): vendor/bot-routes.cjs + xpwWorkerMain) runs in a worker_threads thread, messages pass by structured clone with
// the same transfer lists. The node page harness has no Worker, so the page runs every search synchronously unless a test or
// bench installs this:   require('./xpw_node_shim.cjs').install(H)   (H = page_harness boot result)
const {Worker}=require('worker_threads');
function install(H){
 const XPW=H.xe('typeof XPW==="object"?XPW:null');if(!XPW)throw Error('no XPW block in this page');
 XPW.mk=function(){const src=XPW.source(),pre="const {parentPort}=require('worker_threads');globalThis.self=globalThis;globalThis.postMessage=(m,t)=>parentPort.postMessage(m,t);parentPort.on('message',d=>{if(typeof self.onmessage==='function')self.onmessage({data:d});});\n";
  const w=new Worker(pre+src,{eval:true}),shim={onmessage:null,onerror:null,postMessage(m,t){w.postMessage(m,t);},terminate(){w.terminate();}};
  w.on('message',d=>{if(shim.onmessage)shim.onmessage({data:d});});w.on('error',e=>{if(shim.onerror)shim.onerror({message:String(e&&e.message||e)});});w.unref();shim.thread=w;return shim;};
 XPW.can=()=>true;XPW.lowMem=()=>false;XPW.on=null;return XPW;}
module.exports={install};
