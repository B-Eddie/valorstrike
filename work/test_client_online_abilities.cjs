// Every agent x every ability (C / Q / E / X) cast ONLINE: the real page (index.html in audit.js's fake DOM, as
// test_client_online.cjs boots it) plays a Spike match against the real game server (server/src/worker.js in-process via
// server/tools/local-cluster.mjs). Per agent: the page joins as that agent, the buy phase is skipped, the server unit
// gets every charge and a full ult, and each key is pressed through the page's real keydown handler (plus follow-up
// clicks and a recast). Checked: no page exception / xErr; after each cast the page's charges (J.c / q / e / ult) equal
// the server's (u.ability) once the round state has arrived; HUD ability slots carry the agent's names, no NaN text, and
// charge pips equal the charges; no NaN in J / player; after a server round reset every local effect list is empty and
// the server's ability charges and the page's agree again.
//   node work/test_client_online_abilities.cjs        (in test_all)
//   AGENTS=Sova,Omen VERBOSE=1 node work/test_client_online_abilities.cjs
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const audit=fs.readFileSync(path.join(__dirname,'audit.js'),'utf8'),boot=audit.slice(0,audit.indexOf('// ---------- audit ----------')).replace(/^"use strict";/,'');
const log=console.log;console.log=()=>{};// the boot prints its own knife check; keep test output to one line
const H=new Function('require','__dirname','process','module',boot+'\nreturn {win,context,errors,xErrCalls,advance,mkEvent,dispatch,setPhase:p=>{phase=p;}};')(require,__dirname,process,module);
console.log=log;
const VERBOSE=!!process.env.VERBOSE,SEED=+(process.env.SEED||7),ONLY=process.env.AGENTS?process.env.AGENTS.split(','):null,MAP=process.env.MAP||'ascent';
// Determinism (as test_client_online.cjs): the fight used to be decided by unseeded Math.random (server spawns / spread / bot AI in this realm, the
// page's own in its vm realm) and by real async work (world loading on create, 'hi' crypto) racing the virtual clock,
// so under machine load the piloted TDM fight once ended 0 kills / 5 deaths. Both realms are seeded and the virtual
// clocks hold while a connection or an authentication is pending (as tools/soak.mjs does), so a seed replays.
function mulberry(seed){let a=seed>>>0;return ()=>{a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return ((t^t>>>14)>>>0)/4294967296;};}
Math.random=mulberry(SEED*104729+1);require('vm').runInContext(`Math.random=(${mulberry})(${SEED*7919+3});`,H.context);
(async()=>{
 const xe=code=>require('vm').runInContext('__xe',H.context)(code);
 const {localCluster}=await import('../server/tools/local-cluster.mjs');const {ScriptedHuman}=await import('../server/tools/scripted-human.mjs');const {loadWorld}=await import('../server/src/world.js');
 const cluster=await localCluster({env:{ALLOW_LOCAL_ORIGIN:'true',ENABLE_SPIKE:'true'}});const world=await loadWorld(cluster.env.ASSETS,'ascent');
 // WebSocket bridge: the page's socket is a local-cluster connection.
 const sockets=[],codes=new Set();let pending=0;
 // Hold both virtual clocks (real-time wait, up to 120 s) while a socket is connecting (create = real world file I/O)
 // or any known room has a session still authenticating its 'hi' (real async crypto).
 const settle=async()=>{const end=Date.now()+120000;const busy=()=>pending>0||[...codes].some(c=>{const r=cluster.room(c);return r&&[...r.sessions.values()].some(s=>s.authenticating&&!s.u);});while(busy()&&Date.now()<end)await new Promise(r=>setTimeout(r,2));};
 class WS{constructor(url){const q=Object.fromEntries(new URL(url.replace(/^ws/,'http')).searchParams);this.readyState=0;this.sent=0;sockets.push(this);const api=cluster.connect(q);this.api=api;pending++;let settled=false;const done=()=>{if(!settled){settled=true;pending--;}};if(q.code)codes.add(q.code);
   api.on('open',()=>{done();this.readyState=1;this.onopen&&this.onopen({});});api.on('message',m=>{if(this.readyState===1&&this.onmessage)this.onmessage({data:JSON.stringify(m)});});
   api.on('close',e=>{if(this.readyState===3)return;this.readyState=3;this.onclose&&this.onclose({code:e.code,reason:e.reason});});api.on('error',e=>{done();this.readyState=3;this.onerror&&this.onerror(e);this.onclose&&this.onclose({code:1006,reason:String(e.message)});});}
  send(d){if(this.readyState!==1)throw Error('send on closed socket');this.sent++;if(VERBOSE)(this.types||(this.types={}))[JSON.parse(d).t]=1;this.api.send(d);}close(){if(this.readyState===3)return;this.readyState=3;this.api.close();}}
 WS.OPEN=1;H.win.WebSocket=WS;/* No fetch, as in the audit boot: the page plays as a guest (profile fetch fails) and skips asset downloads. */ const fetches=[];H.win.fetch=function(u){fetches.push(String(u)+' @ '+new Error().stack.split('\n').slice(2,5).join(' / '));return Promise.reject(new TypeError('Failed to fetch'));};
 H.win.__ls=new Map();H.win.__ls.getItem=k=>H.win.__ls.has(k)?H.win.__ls.get(k):null;H.win.__ls.setItem=(k,v)=>H.win.__ls.set(k,String(v));H.win.__ls.removeItem=k=>H.win.__ls.delete(k);
 // The native map pipeline downloads the render scene and collision; the harness has no renderer or network, so the
 // page builds its legacy blockout instead (as the audit's fixtures do). Everything online stays server-driven.
 xe('nmEnsure=function(){return Promise.resolve(null);};window.xvAgentsReady=xvAgentsReady=function(){return Promise.resolve([]);};xvPreloadAgents=function(){};true');

 const errs0=H.errors.length,x0=H.xErrCalls.length;const fails=[];const fail=s=>{fails.push(s);if(VERBOSE)console.log('FAIL',s);};
 const key=(code,down)=>H.dispatch(H.win,H.mkEvent(down?'keydown':'keyup',{code,key:code.replace(/^Key|^Digit/,'').toLowerCase()}));
 const mouse=(b,down)=>{const cv=xe('renderer.domElement');H.dispatch(down?cv:H.win,H.mkEvent(down?'mousedown':'mouseup',{button:b}));};
 const step=async ms=>{for(let t=0;t<ms;t+=50){if(xe('MP.code'))codes.add(xe('MP.code'));await settle();await cluster.advance(50);H.advance(50);}};
 const until=async(cond,ms,what)=>{for(let t=0;t<ms;t+=50){if(cond())return true;await step(50);}fail('timed out: '+what);return false;};
 const tap=async(code,ms=100)=>{key(code,true);await step(ms);key(code,false);};
 const click=async(b=0)=>{mouse(b,true);await step(100);mouse(b,false);};
 const humans=[];const join=(code,name,agent)=>{const h=new ScriptedHuman({name,agent,world,target:null});codes.add(code);pending++;let settled=false;const done=()=>{if(!settled){settled=true;pending--;}};const s=cluster.connect({code});h.attach(s);s.on('message',m=>h.receive(m));s.on('open',()=>{done();h.hello();});s.on('error',done);humans.push(h);return h;};
 const kits=JSON.parse(fs.readFileSync(path.join(__dirname,'..','server','src','kits.json'),'utf8'));
 const AGENTS=Object.keys(kits).filter(a=>!ONLY||ONLY.includes(a));
 const HUD=`(()=>{const o={};for(const id of ["jC","jQ","jE","jX"]){const el=document.getElementById(id);if(!el){o[id]=null;continue;}const sp=el.querySelector("span"),em=el.querySelector("em"),pp=el.querySelector(".x-pp");
  o[id]={n:sp&&sp.textContent,t:em&&em.textContent,on:pp?[...pp.children].filter(c=>c.className==="on").length:null};}return o;})()`;
 const NANJ=`(()=>{const bad=[],f=Number.isFinite;const walk=(o,p,d)=>{if(d>2||!o)return;for(const k in o){let v;try{v=o[k];}catch(e){continue;}
  if(typeof v==="number"){if(!f(v))bad.push(p+k+"="+v);}else if(v&&typeof v==="object"&&!v.isObject3D&&!v.isMaterial&&!v.isBufferGeometry&&!v.nodeType&&!(v instanceof Map))walk(v,p+k+".",d+1);}};
  walk(J,"J.",0);for(const k of ["x","y","z","hp"])if(!f(player[k]))bad.push("player."+k+"="+player[k]);return bad;/* camera: the THREE stub has no real vectors */})()`;
 const t0=Date.now();let equips=0,casts=0,mismatch=0;
 for(const agent of AGENTS){H.setPhase('online '+agent);const tag=agent;
  xe(`J.pick=${JSON.stringify(agent)};MP.name='PageQA';window.xQMap=${JSON.stringify(MAP)};MP.map=${JSON.stringify(MAP)};mpCreate(false,'five')`);
  if(!await until(()=>xe('MP.st')==='room',8000,tag+' room'))break;const code=xe('MP.code');
  join(code,'FoeB','Sova');await until(()=>xe('(MP.room&&MP.room.pl||[]).length')===2,8000,tag+' human joined');xe('mpStart()');
  if(!await until(()=>xe('MP.st')==='game'&&xe('NET.ready'),20000,tag+' match start'))break;
  const room=cluster.room(code),sim=room.sim,me=()=>sim.units.find(u=>u.human&&u.name===xe('MP.name'));
  if(!me()||me().agent!==agent){fail(`${tag}: server unit agent ${me()&&me().agent}`);}
  sim.buy=0;await step(400);
  if(xe('J.pick')!==agent)fail(`${tag}: page J.pick ${xe('J.pick')}`);
  const names=kits[agent].n,hud0=xe(HUD);['jC','jQ','jE','jX'].forEach((id,i)=>{if(!hud0[id]||hud0[id].n!==names[i])fail(`${tag}: HUD ${id} label ${hud0[id]&&hud0[id].n} != ${names[i]}`);});
  for(const k of ['KeyC','KeyQ','KeyE','KeyX']){const ab=k[3].toLowerCase(),u=me();if(!u)break;
   // full charges + ult on the server; the page learns them from the next round state ('rs' rides on snapshots / 'ao')
   const A=u.ability,M=kits[agent].mx;A.c=Math.max(A.c|0,M.c||1);A.q=Math.max(A.q|0,M.q||1);A.e=Math.max(A.e|0,M.e||1);A.ult=kits[agent].u;A.cool={};u.hp=100;u.alive=true;
   if(sim.roundState){const rs=sim.roundState(u);room.send([...room.sessions].find(([w,s])=>s.u===u)[0],{t:'ao',k:'c',ok:true,rs});}
   await step(300);
   const pg=()=>xe('({c:J.c|0,q:J.q|0,e:J.e|0,ult:J.ult|0})'),sv=()=>({c:A.c|0,q:A.q|0,e:A.e|0,ult:A.ult|0});
   {const p=pg(),s=sv();if(JSON.stringify(p)!==JSON.stringify(s))fail(`${tag} before ${k}: page ${JSON.stringify(p)} server ${JSON.stringify(s)}`);}
   const before=sv();await tap(k,100);casts++;await step(400);
   // equip-then-fire abilities (work/ability_equip_runtime.js XAB_EQ): the press only draws the ability (nothing sent); FIRE throws it
   if(xe('!!(J.eq&&J.eq.st!=="rec")')){equips++;if(JSON.stringify(sv())!==JSON.stringify(before))fail(`${tag} ${k}: equipping spent a server charge`);await step(250);await click(0);await step(800);}
   // server-swapped guns: Headhunter's 1-round Sheriff (one charge per press) and Tour De Force's Operator must reach the
   // server and stay in hand (the page once never sent Headhunter, and re-applied the saved loadout over the Operator)
   if(agent==='Chamber'&&k==='KeyQ'&&(u.weapon!=='Sheriff'||!u.headhunter||A.q!==before.q-1))fail(`Chamber Q: server holds ${u.weapon} (headhunter ${!!u.headhunter}), charges ${before.q} -> ${A.q}`);
   if(agent==='Chamber'&&k==='KeyX'){if(u.weapon!=='Operator'||!u.ultWeapon)fail(`Chamber X: server holds ${u.weapon} (ultWeapon ${!!u.ultWeapon}) after the cast`);else if(xe('wName()')!=='Operator')fail(`Chamber X: page holds ${xe('wName()')}`);}await click(0);await step(250);await click(2);await step(250);await tap(k,80);await step(300);await click(0);await step(900);
   const s1=sv(),p1=pg();
   if(VERBOSE)console.log(`  ${tag} ${k}: server ${JSON.stringify(before)} -> ${JSON.stringify(s1)} page ${JSON.stringify(p1)}`);
   if(JSON.stringify(p1)!==JSON.stringify(s1)){mismatch++;fail(`${tag} ${k}: page charges ${JSON.stringify(p1)} != server ${JSON.stringify(s1)}`);}
   const hud=xe(HUD);for(const id in hud){const h=hud[id];if(h&&/NaN|undefined|null|Infinity/.test(String(h.t)+String(h.n)))fail(`${tag} ${k}: HUD ${id} "${h.n}" / "${h.t}"`);}
   for(const [id,kk] of [['jC','c'],['jQ','q'],['jE','e']]){const h=hud[id];if(h&&h.on!==null&&h.on!==Math.min(4,p1[kk]))fail(`${tag} ${k}: HUD ${id} pips ${h.on} for ${kk}=${p1[kk]}`);}
   const bad=xe(NANJ);if(bad.length)fail(`${tag} ${k}: non-finite ${bad.slice(0,5).join(', ')}`);
   await tap('Digit1',60);await step(200);
   if(H.errors.length>errs0||H.xErrCalls.length>x0)break;
  }
  await step(2000);
  // server round reset -> page round start
  const r0=sim.round;sim.roundDelay=0;sim.finishRound(0,'QA');await until(()=>sim.round>r0&&sim.phase==='game',30000,tag+' next round');await step(800);
  const lists=xe(`(()=>{const o={};for(const k of ["smokes","walls","zones","orbs","arrows","fx"])if(J[k]&&J[k].length)o[k]=J[k].length;if(J.dr)o.dr=1;if(J.bsOn)o.bsOn=1;if(J.om)o.om=1;if(J.ftp)o.ftp=1;return o;})()`);
  if(sim.buy>0&&Object.keys(lists).length)fail(`${tag}: local effects survived the round reset ${JSON.stringify(lists)}`);
  {const u=me();if(u){const A=u.ability,s={c:A.c|0,q:A.q|0,e:A.e|0,ult:A.ult|0},p=xe('({c:J.c|0,q:J.q|0,e:J.e|0,ult:J.ult|0})');if(JSON.stringify(s)!==JSON.stringify(p))fail(`${tag}: after the round reset page ${JSON.stringify(p)} != server ${JSON.stringify(s)}`);}}
  const hud1=xe(HUD);['jC','jQ','jE','jX'].forEach((id,i)=>{if(!hud1[id]||hud1[id].n!==names[i])fail(`${tag}: HUD ${id} label after reset ${hud1[id]&&hud1[id].n}`);});
  if(H.errors.length>errs0||H.xErrCalls.length>x0){fail(`${tag}: page exceptions ${JSON.stringify({e:H.errors.slice(errs0,errs0+4),x:H.xErrCalls.slice(x0,x0+4)})}`);break;}
  for(const h of humans.splice(0))try{h.leave();}catch(e){}
  xe('mpReset()');await step(500);xe('try{toLobby()}catch(e){}');await step(200);
 }
 // Cast pipeline online (ABILITY ANIM XABC + server castAnswer): the movement kit (two dash slots the server casts straight from the
 // press, picked by slot type) presses slot 2 then slot 3 50 ms apart - both are cast by the server and each plays exactly one
 // first-person cast animation (the second used to be dropped while the first gesture still played); an empty slot is refused
 // with its reason; every request is answered (nothing left pending).
 {const mover=xe('Object.keys(KITS).find(a=>ABI_M[a]&&ABI_M[a][1]==="dash"&&ABI_M[a][2]==="dash"&&(XAB_INST[a]||"").length>0)');
  if(!mover)fail('pipeline: no movement kit');else{H.setPhase('online pipeline');
  xe(`J.pick=${JSON.stringify(mover)};MP.name='PageQA';window.xQMap=${JSON.stringify(MAP)};MP.map=${JSON.stringify(MAP)};mpCreate(false,'five')`);
  if(await until(()=>xe('MP.st')==='room',8000,'pipeline room')){const code=xe('MP.code');join(code,'FoeB','Sova');await until(()=>xe('(MP.room&&MP.room.pl||[]).length')===2,8000,'pipeline joined');xe('mpStart()');
   if(await until(()=>xe('MP.st')==='game'&&xe('NET.ready'),20000,'pipeline start')){const room=cluster.room(code),sim=room.sim,u=sim.units.find(v=>v.human&&v.name===xe('MP.name'));sim.buy=0;await step(400);
    const A=u.ability;A.q=1;A.e=1;A.cool={};const rs=sim.roundState(u);room.send([...room.sessions].find(([w,s])=>s.u===u)[0],{t:'ao',k:'c',ok:true,rs});await step(300);
    xe('window.__pc=0;{const s=xCaStart;xCaStart=function(){__pc++;return s.apply(this,arguments);};}toast.textContent="";true');const n0=xe('XABC.n.press');
    await tap('KeyQ',50);await tap('KeyE',50);await step(600);
    if(!(A.q===0&&A.e===0))fail(`pipeline: server cast both slots (q ${A.q} e ${A.e})`);if(xe('__pc')!==2)fail(`pipeline: two server casts 50 ms apart -> two cast animations (got ${xe('__pc')})`);
    if(xe('XABC.n.press')-n0!==2)fail('pipeline: both presses tracked');if(xe('XABC.pend.length')!==0)fail('pipeline: every request answered ('+xe('XABC.pend.length')+' pending)');
    await step(1200);xe('toast.textContent="";__pc=0;true');await tap('KeyQ',50);await step(500);
    if(!/no charges left/.test(xe('toast.textContent')))fail('pipeline: empty slot refused with its reason: "'+xe('toast.textContent')+'"');if(xe('__pc')!==0)fail('pipeline: no animation for a refused cast (or it was cut) '+xe('__pc')+' '+xe('XCA.on'));
    if(xe('XABC.pend.length')!==0)fail('pipeline: refusal answered');}}
  for(const h of humans.splice(0))try{h.leave();}catch(e){}xe('mpReset()');await step(500);xe('try{toLobby()}catch(e){}');await step(200);}}
 if(!equips)fail('no ability press equipped (equip-then-fire flow missing)');
 if(fails.length){console.error(fails.slice(0,40).join('\n'));process.exit(1);}
 console.log(`Online client abilities (page <-> in-process server, ${MAP}): ${AGENTS.length} agents x C/Q/E/X (${casts} casts, ${equips} equip -> FIRE): page charges / ult equal the server's after every cast and after the round reset, HUD labels / pips consistent, no NaN, local effects cleared at round start, no page exceptions (${((Date.now()-t0)/1000).toFixed(0)} s)`);
 process.exit(0);
})().catch(e=>{console.error(e);console.error(JSON.stringify(H.errors.slice(0,8)));process.exit(1);});
