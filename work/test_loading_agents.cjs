// #11: the match loader waits for every agent's real model before starting the match, shows agent progress, releases
// the overlay on failure, and a newer load supersedes an older one still waiting on agents (its match never starts).
const fs=require('fs'),vm=require('vm'),assert=require('assert/strict'),html=fs.readFileSync('index.html','utf8');
const at=html.indexOf('var run = function (fn, map, mode, sync) {',html.indexOf('var PAL =')),end=html.indexOf('window.xMatchLoad = run;',at);
function make(){const events=[],labels=[];const rel=[],fl=[];const ctx={window:{xvAgentsReady:(ags,cb)=>{events.push('wait');cb({done:false,ready:3,total:12,frac:.4});return new Promise((r,j)=>{rel.push(()=>{cb({done:true,ready:12,total:12,frac:1});r([]);});fl.push(j);});}},Promise,
  show:(m)=>events.push('show:'+m),fill:()=>events.push('fill'),ready:()=>events.push('ready'),failed:()=>events.push('failed'),built:()=>true,requestAnimationFrame:f=>f(),xLdSet:(id,k,v)=>{if(id==='xLdAg')labels.push(v);}};
  vm.createContext(ctx);vm.runInContext('var loadId=0;'+html.slice(at,end)+'globalThis.run=run;',ctx);return {ctx,events,labels,release:()=>rel.forEach(f=>f()),fail:(e)=>fl.forEach(f=>f(e))};}
const tick=()=>new Promise(r=>setImmediate(r));
(async()=>{
  let T=make(),started=0;const p=T.ctx.run(()=>{started++;return 7;},'lotus','TDM',true);await tick();
  assert.equal(started,0,'match does not start before agents are ready');assert.deepEqual(T.events,['show:lotus','wait']);assert.match(T.labels[0],/^LOADING AGENTS 3\/12 . 40%$/);
  T.release();assert.equal(await p,7);assert.equal(started,1);assert.deepEqual(T.events,['show:lotus','wait','fill','ready']);assert.equal(T.labels[T.labels.length-1],'');
  T=make();const q=T.ctx.run(()=>{started++;},'bind','TDM',true);await tick();T.fail(new Error('offline'));await assert.rejects(q);assert.deepEqual(T.events,['show:bind','wait','failed']);assert.equal(started,1);
  T=make();let oldRan=0;const old=T.ctx.run(()=>{oldRan++;},'ascent','DM',true);await tick();const fresh=T.ctx.run(()=>'new','haven','DM',true);await tick();T.release();assert.equal(await old,undefined);assert.equal(await fresh,'new');assert.equal(oldRan,0,'superseded load never starts its match');
  globalThis.done=1;console.log('Match load waits for real agent models with progress; failure releases overlay; superseded wait never starts its match');
})().then(()=>{},e=>{console.error(e);process.exit(1)});process.on('exit',c=>{if(!c&&!globalThis.done)console.error('test did not finish'),process.exitCode=1;});
