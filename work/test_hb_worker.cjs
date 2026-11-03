// Online heartbeat worker (server_runtime netHbStart; WebKit audit 2026-11-03, iOS Safari / Arc online matches end on the menu):
// the page made the hidden-tab heartbeat worker from a blob URL and revoked the URL on the next line. That only works where
// the browser resolves the blob URL synchronously inside new Worker(); a browser that fetches the worker script afterwards
// (WebKit) finds the URL revoked, the worker never runs, and a hidden tab sends no heartbeat. This test runs netHbStart with a
// Worker that loads its script asynchronously (the WebKit behaviour): the worker must load, tick a heartbeat, and the blob
// URL must still be revoked afterwards (no leak); a worker that fails to load is reported to the crash report.
//   node work/test_hb_worker.cjs
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict');
const src=fs.readFileSync(path.join(__dirname,'server_runtime.js'),'utf8');
const line=n=>{const i=src.indexOf('function '+n+'(');assert(i>=0,n);return src.slice(i,src.indexOf('\n',i));};
const tick=ms=>new Promise(r=>setTimeout(r,ms));
function run({fail=false}={}){
 const live=new Set(),sent=[],logs=[];let n=0;
 const URL_={createObjectURL:()=>{const u='blob:x/'+(++n);live.add(u);return u;},revokeObjectURL:u=>live.delete(u)};
 class Worker{constructor(u){this.u=u;setTimeout(()=>{if(!live.has(u)||fail){if(this.onerror)this.onerror({message:'Script load failed: '+u});return;}this.ran=true;setTimeout(()=>this.onmessage&&this.onmessage({data:0}),3);},5);}}
 const c={URL:URL_,Blob,Worker,setTimeout,MP:{on:true},NET:{socket:{readyState:1}},netSend:m=>sent.push(m),window:{xCrash:{log:(...a)=>logs.push(a)}},console};
 c.window.window=c.window;c.xCrash=c.window.xCrash;vm.createContext(c);vm.runInContext('let netHbWorker=null;\n'+line('netHbTick')+'\n'+line('netHbStart')+'\nnetHbStart();this.W=()=>netHbWorker;',c);
 return {c,live,sent,logs};
}
(async()=>{
 { const r=run();await tick(40);const w=r.c.W();assert(w&&w.ran,'the worker ran although its script loads after new Worker() returned');
   assert(r.sent.some(m=>m.t==='hb'),'a heartbeat was sent');assert.equal(r.live.size,0,'blob URL revoked after the first tick'); }
 { const r=run({fail:true});await tick(40);assert(r.logs.some(a=>a[0]==='hb-worker'),'a worker that fails to load is reported');assert.equal(r.live.size,0,'and its URL revoked'); }
 console.log('Heartbeat worker: loads when the browser fetches the blob script asynchronously (WebKit), ticks, URL revoked after the first tick; a load failure is reported');
})().catch(e=>{console.error(e);process.exit(1);});
