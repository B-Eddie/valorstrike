// #11: the match loader waits for every agent's real model before starting the match, shows agent progress, releases
// the overlay on failure, and a newer load supersedes an older one still waiting on agents (its match never starts).
const fs=require('fs'),vm=require('vm'),assert=require('assert/strict'),html=fs.readFileSync('index.html','utf8');
const at=html.indexOf('var run = function (fn, map, mode, sync, title) {',html.indexOf('var PAL =')),end=html.indexOf('window.xMatchLoad = run;',at);
function make(){const events=[],labels=[];const rel=[],fl=[];const ctx={window:{xvAgentsReady:(ags,cb)=>{events.push('wait');cb({done:false,ready:3,total:12,frac:.4});return new Promise((r,j)=>{rel.push(()=>{cb({done:true,ready:12,total:12,frac:1});r([]);});fl.push(j);});}},Promise,
  show:(m,mode,title)=>events.push('show:'+(title||m)),fill:()=>events.push('fill'),ready:()=>events.push('ready'),failed:()=>events.push('failed'),built:()=>true,requestAnimationFrame:f=>f(),xLdSet:(id,k,v)=>{if(id==='xLdAg')labels.push(v);}};
  vm.createContext(ctx);vm.runInContext('var loadId=0;'+html.slice(at,end)+'globalThis.run=run;',ctx);return {ctx,events,labels,release:()=>rel.forEach(f=>f()),fail:(e)=>fl.forEach(f=>f(e))};}
const tick=()=>new Promise(r=>setImmediate(r));
(async()=>{
  let T=make(),started=0;const p=T.ctx.run(()=>{started++;return 7;},'lotus','TDM',true);await tick();
  assert.equal(started,0,'match does not start before agents are ready');assert.deepEqual(T.events,['show:lotus','wait']);assert.match(T.labels[0],/^LOADING AGENTS 3\/12 . 40%$/);
  T.release();assert.equal(await p,7);assert.equal(started,1);assert.deepEqual(T.events,['show:lotus','wait','fill','ready']);assert.equal(T.labels[T.labels.length-1],'');
  T=make();const q=T.ctx.run(()=>{started++;},'bind','TDM',true);await tick();T.fail(new Error('offline'));await assert.rejects(q);assert.deepEqual(T.events,['show:bind','wait','failed']);assert.equal(started,1);
  T=make();let oldRan=0;const old=T.ctx.run(()=>{oldRan++;},'ascent','DM',true);await tick();const fresh=T.ctx.run(()=>'new','haven','DM',true);await tick();T.release();assert.equal(await old,undefined);assert.equal(await fresh,'new');assert.equal(oldRan,0,'superseded load never starts its match');
  // Titled loads (modes without agent select) keep their own title instead of the match roster.
  T=make();const tl=T.ctx.run(()=>1,'ascent','SURF',true,'AGENTS');await tick();T.release();await tl;assert.deepEqual(T.events,['show:AGENTS','wait','ready']);
  // Duel / rifle / surf / aim / deathmatch never start on hidden agents.
  const a2=html.indexOf('[["startDuel", "OPERATOR DUEL"]'),b2=html.indexOf('});',html.indexOf('return done ? call()',a2))+3;assert(a2>0&&b2>a2,'no-agent-select modes are gated');
  for(const ready of [true,false]){const calls=[],runs=[];const w={xValorantAssets:{agentProgress:()=>({done:ready})}};for(const n of ['startDuel','startRifle','startSurf','startAim','startDM'])w[n]=function(){calls.push(n);return n;};
   const c=vm.createContext({window:w,run:(fn,map,mode,sync,title)=>{runs.push([mode,sync,title]);return 'gated';},curMap:()=>'ascent'});vm.runInContext(html.slice(a2,b2),c);
   for(const n of ['startDuel','startRifle','startSurf','startAim','startDM']){const r=w[n]();if(ready){assert.equal(r,n,n+' starts at once when agents are in');}else assert.equal(r,'gated',n+' waits behind the agent overlay');}
   if(ready)assert.equal(runs.length,0);else{assert.equal(calls.length,0,'nothing started while agents load');assert.deepEqual(runs.map(r=>r[0]),['OPERATOR DUEL','RIFLE 2V2','SURF','AIM TRAINING','DEATHMATCH']);assert(runs.every(r=>r[1]===true&&r[2]==='AGENTS'));}}
  globalThis.done=1;console.log('Match load waits for real agent models with progress; failure releases overlay; superseded wait never starts its match');
})().then(()=>{},e=>{console.error(e);process.exit(1)});process.on('exit',c=>{if(!c&&!globalThis.done)console.error('test did not finish'),process.exitCode=1;});
