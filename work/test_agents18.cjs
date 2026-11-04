// The 18 added agents on the real page (page_harness, real three.js scene): the pick starts a match, the HUD shows the
// kit, a18 state resets with the round, and every C / Q / E / X cast spends its charge and spawns its client effect
// (or state) without page errors. Run: node work/test_agents18.cjs (in test_all).
const {boot}=require('./page_harness.cjs');
const VERBOSE=!!process.env.VERBOSE,SEED=+(process.env.SEED||3);
const AGENTS=['Astra','Brimstone','Clove','Harbor','Miks','Viper','Hush','Iso','Neon','Waylay','Yoru','Fade','Gekko','KAY/O','Tejo','Deadlock','Veto','Vyse'];
const fails=[];const fail=s=>{fails.push(s);console.log('FAIL',s);};
(async()=>{
 const H=boot({real3:true,seed:SEED}),xe=H.xe;
 const adv=async ms=>{for(let t=0;t<ms;t+=50){H.advance(Math.min(50,ms-t)-1e-6);await new Promise(r=>setImmediate(r));}};
 const tap=async(code,ms=80)=>{H.key(code,true);await adv(ms);H.key(code,false);};
 const errs0=H.errors.length;
 for(const a of AGENTS){
  const e0=H.errors.length;
  xe(`J.pick=${JSON.stringify(a)};FV.pick="ascent";FV.srOn=0;window.xSwift=false;xLob0=false;startFive();true`);await adv(400);
  xe('FV.buy=0;true');await adv(300);
  if(!xe('running&&mode==="five"')){fail(a+': match did not start');continue;}
  const kit=xe(`JSON.stringify([J.pick,K().n,J.c,J.q,J.e,K().u])`);
  if(!xe('A18SET.has(J.pick)'))fail(a+': not in A18SET');
  if(!xe('!!J.a18'))fail(a+': a18 state not initialised');
  // ult first: enough points, cast spends them
  xe('J.ult=K().u;J.cd={c:0,q:0,e:0,x:0};true');
  const fx0=xe('(J.a18fx||[]).length'),sm0=xe('J.smokes.length'),zn0=xe('J.zones.length');
  await tap('KeyX',120);await adv(200);
  const ux=xe('J.ult');
  const xUsed=ux===0||xe('J.pick==="Clove"')||xe('JSON.stringify([J.a18.pit||0,J.a18.od||0,J.a18.evo||0,J.a18.duel||0,J.a18.drift||0])')!=='[0,0,0,0,0]';
  if(!xUsed)fail(a+': X did not fire (ult '+ux+')');
  // basics: each spends its charge or records state
  for(const [code,slot] of [['KeyC','c'],['KeyQ','q'],['KeyE','e']]){
   xe(`J.${slot}=1;J.cd.${slot}=0;true`);if(a==='Clove'&&slot==='c')xe('J.lastKillT=performance.now()/1000;true');
   const before=xe(`JSON.stringify([J.${slot},(J.a18fx||[]).length,J.smokes.length,J.zones.length,J.a18.stars])`);
   await tap(code,120);await adv(150);
   const after=xe(`JSON.stringify([J.${slot},(J.a18fx||[]).length,J.smokes.length,J.zones.length,J.a18.stars])`);
   if(before===after)fail(a+': '+slot+' cast had no effect '+before);
  }
  if(H.errors.length>e0)fail(a+': '+(H.errors.length-e0)+' page errors: '+H.errors.slice(e0,e0+2).join(' | ').slice(0,200));
  if(VERBOSE)console.log('ok',a,kit);
 }
 if(H.errors.length>errs0)fail('total page errors: '+(H.errors.length-errs0));
 console.log(fails.length?fails.length+' FAILURES':'agents18 client: all 18 picks start a match and cast c/q/e/x with effects, no page errors');
 process.exit(fails.length?1:0);
})().catch(e=>{console.error(e);process.exit(1);});
