// Online Escalation: the level gun can be pulled out and stays in hand (user 2026-10-27 on e6a8b62: "In Escalation I can't
// pull out gun", "it's also really laggy"). Online Escalation runs the page's TDM path (FV.tdm), and 44b697f's reconcile drops
// "a TDM primary the current stage does not allow": the Escalation level guns (Odin, Ares, Judge, Marshal, Operator ...) are
// not TDM stage guns, so every snapshot (20 Hz) dropped the level gun to the sidearm and netAdoptWeapon put it back (bEquip +
// swapW + viewmodel rebuild): the draw never finished (no shot) and the page rebuilt the viewmodel 20 times a second.
// The real page (audit.js fake DOM) on the real game server (in-process local cluster):
//  - level 1 (Odin) in hand, synced with the server, and the weapon slot does not churn (swapW / bEquip calls) over 3 s;
//  - firing spends the server's ammo; a server level change to Operator / Sheriff / Knife is adopted in the right slot.
//   node work/test_client_online_esc.cjs
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const audit=fs.readFileSync(path.join(__dirname,'audit.js'),'utf8'),boot=audit.slice(0,audit.indexOf('// ---------- audit ----------')).replace(/^"use strict";/,'');
const log=console.log;console.log=()=>{};// the boot prints its own knife check; keep test output to one line
const H=new Function('require','__dirname','process','module',boot+'\nreturn {win,doc,context,errors,xErrCalls,advance,mkEvent,dispatch,setPhase:p=>{phase=p;}};')(require,__dirname,process,module);
console.log=log;
const SV=process.env.SERVER_DIR||path.join(__dirname,'..','server');const VERBOSE=!!process.env.VERBOSE,SEED=+(process.env.SEED||7);
// Determinism: the fight used to be decided by unseeded Math.random (server spawns / spread / bot AI in this realm, the
// page's own in its vm realm) and by real async work (world loading on create, 'hi' crypto) racing the virtual clock,
// so under machine load the piloted TDM fight once ended 0 kills / 5 deaths. Both realms are seeded and the virtual
// clocks hold while a connection or an authentication is pending (as tools/soak.mjs does), so a seed replays.
function mulberry(seed){let a=seed>>>0;return ()=>{a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return ((t^t>>>14)>>>0)/4294967296;};}
Math.random=mulberry(SEED*104729+1);require('vm').runInContext(`Math.random=(${mulberry})(${SEED*7919+3});`,H.context);
(async()=>{
 const xe=code=>require('vm').runInContext('__xe',H.context)(code);
 const {localCluster}=await import(SV+'/tools/local-cluster.mjs');const {ScriptedHuman}=await import(SV+'/tools/scripted-human.mjs');const {loadWorld}=await import(SV+'/src/world.js');
 const cluster=await localCluster({env:{ALLOW_LOCAL_ORIGIN:'true',ENABLE_SPIKE:'true'}});const world=await loadWorld(cluster.env.ASSETS,'ascent');
 // WebSocket bridge: the page's socket is a local-cluster connection.
 const sockets=[],codes=new Set(),hook={in:null,out:null};let pending=0;
 // Hold both virtual clocks (real-time wait, up to 120 s) while a socket is connecting (create = real world file I/O)
 // or any known room has a session still authenticating its 'hi' (real async crypto).
 const settle=async()=>{const end=Date.now()+120000;const busy=()=>pending>0||[...codes].some(c=>{const r=cluster.room(c);return r&&[...r.sessions.values()].some(s=>s.authenticating&&!s.u);});while(busy()&&Date.now()<end)await new Promise(r=>setTimeout(r,2));};
 class WS{constructor(url){const q=Object.fromEntries(new URL(url.replace(/^ws/,'http')).searchParams);this.readyState=0;this.sent=0;sockets.push(this);const api=cluster.connect(q);this.api=api;pending++;let settled=false;const done=()=>{if(!settled){settled=true;pending--;}};if(q.code)codes.add(q.code);
   api.on('open',()=>{done();this.readyState=1;this.onopen&&this.onopen({});});api.on('message',m=>{if(hook.in){m=hook.in(m,this);if(!m)return;}if(this.readyState===1&&this.onmessage)this.onmessage({data:JSON.stringify(m)});});
   api.on('close',e=>{if(this.readyState===3)return;this.readyState=3;this.onclose&&this.onclose({code:e.code,reason:e.reason});});api.on('error',e=>{done();this.readyState=3;this.onerror&&this.onerror(e);this.onclose&&this.onclose({code:1006,reason:String(e.message)});});}
  send(d){if(this.readyState!==1)throw Error('send on closed socket');this.sent++;if(hook.out&&!hook.out(JSON.parse(d),this))return;if(VERBOSE)(this.types||(this.types={}))[JSON.parse(d).t]=1;this.api.send(d);}close(){if(this.readyState===3)return;this.readyState=3;this.api.close();}}
 WS.OPEN=1;H.win.WebSocket=WS;/* No fetch, as in the audit boot: the page plays as a guest (profile fetch fails) and skips asset downloads. */ const fetches=[];H.win.fetch=function(u){if(/\/health$/.test(String(u)))return cluster.fetch('/health');fetches.push(String(u)+' @ '+new Error().stack.split('\n').slice(2,5).join(' / '));return Promise.reject(new TypeError('Failed to fetch'));};
 H.win.__ls=new Map();H.win.__ls.getItem=k=>H.win.__ls.has(k)?H.win.__ls.get(k):null;H.win.__ls.setItem=(k,v)=>H.win.__ls.set(k,String(v));H.win.__ls.removeItem=k=>H.win.__ls.delete(k);
 // The native map pipeline downloads the render scene and collision; the harness has no renderer or network, so the
 // page builds its legacy blockout instead (as the audit's fixtures do). Everything online stays server-driven.
 xe('nmEnsure=function(){return Promise.resolve(null);};window.xvAgentsReady=xvAgentsReady=function(){return Promise.resolve([]);};xvPreloadAgents=function(){};true');


 const errs0=H.errors.length,x0=H.xErrCalls.length;const fails=[];const fail=s=>{fails.push(s);if(VERBOSE)console.log('FAIL',s);};const notes=[];
 const step=async ms=>{for(let t=0;t<ms;t+=50){if(xe('MP.code'))codes.add(xe('MP.code'));await settle();await cluster.advance(50);H.advance(50);}};
 const until=async(cond,ms)=>{for(let t=0;t<ms;t+=50){if(cond())return true;await step(50);}return cond();};
 const humans=[];const join=(code,name,agent)=>{const h=new ScriptedHuman({name,agent,world,target:null});codes.add(code);pending++;let settled=false;const done=()=>{if(!settled){settled=true;pending--;}};const s=cluster.connect({code});h.attach(s);s.on('message',m=>h.receive(m));s.on('open',()=>{done();h.hello();});s.on('error',done);humans.push(h);return h;};
 // the page's gun as the player sees it: the gun it fires (wName), the HUD gun name, the visible viewmodel
 const pg=()=>xe('(()=>{const w=rw==="knife"?"Knife":wName();return {w,rw,pri:FV.pri,sec:FV.sec,hud:(xQ("ammo","small")||{}).textContent,vm:Object.keys(VMS).find(n=>VMS[n].visible)||null,vmWant:VMS[w]?w:"Vandal"};})()');
 const openMatch=async(mode,tag)=>{for(const h of humans.splice(0))try{h.leave();}catch(e){}xe('try{mpReset();toLobby()}catch(e){}');await step(300);
  xe(`J.pick='Jett';MP.name='PageQA';window.xQMap='ascent';MP.map='ascent';mpCreate(false,'${mode}')`);
  if(!await until(()=>xe('MP.st')==='room',8000)){fail(tag+': no room');return null;}const code=xe('MP.code');
  const B=join(code,'EnemyB','Sova');if(!await until(()=>xe('(MP.room&&MP.room.pl||[]).length')===2,8000)){fail(tag+': B did not join');return null;}xe('mpStart()');
  if(!await until(()=>xe('MP.st')==='game'&&xe('NET.ready'),20000)){fail(tag+': match did not start');return null;}
  const room=cluster.room(code),sim=room.sim;return {code,B,room,sim,me:()=>sim.units.find(u=>u.human&&u.name==='PageQA'),sess:()=>[...room.sessions.values()].find(s=>s.u&&s.u.name==='PageQA')};};
 const synced=(M,tag)=>{const p=pg(),u=M.me();const bad=[];if(p.w!==u.weapon)bad.push('page fires '+p.w+', server holds '+u.weapon);if(p.hud!==p.w)bad.push('HUD names '+p.hud+', gun in hand '+p.w);if(p.vm!==p.vmWant)bad.push('viewmodel '+p.vm+', gun in hand '+p.w);
  if(p.pri&&['Classic','Shorty','Frenzy','Ghost','Sheriff'].includes(p.pri))bad.push('sidearm '+p.pri+' in the primary slot');if(xe('!!(FV.tdm&&FV.pri&&!tdmOk(FV.pri,tdmTier()))'))bad.push('primary slot holds '+p.pri+', not allowed at TDM stage '+(xe('tdmTier()')+1)+' (1 equips a gun the server refuses)');if(bad.length)fail(tag+': '+bad.join('; ')+' '+JSON.stringify(p));return !bad.length;};
 // a clear line on the map: an eye spot and a spot 5-7 m away with nothing between (nav nodes)
 const clearPair=()=>{const N=world.nav.nodes;for(let i=0;i<N.length;i+=7){const a=N[i];for(let j=0;j<N.length;j++){const b=N[j],d=Math.hypot(b[0]-a[0],b[2]-a[2]);if(d<5||d>7||Math.abs(b[1]-a[1])>.3)continue;const o=[a[0],a[1]+1.6,a[2]],t=[b[0]-o[0],b[1]+1.2-o[1],b[2]-o[2]],l=Math.hypot(...t);if(world.ray(o,t.map(v=>v/l),l)===Infinity&&world.ray([a[0],a[1]+1,a[2]],[t[0]/l,(b[1]-a[1])/l,t[2]/l],l)===Infinity)return [a,b];}}return null;};
 const place=(sim,u,p,face)=>{u.x=p[0];u.y=p[1];u.z=p[2];u.vx=u.vy=u.vz=0;if(face){u.look=Math.atan2(-(face[0]-p[0]),-(face[2]-p[2]));}};
 const aimAt=(from,to)=>{const d=[to.x-from.x,to.y+1.15-(from.y+1.6),to.z-from.z];return [Math.atan2(-d[0],-d[2]),Math.atan2(d[1],Math.hypot(d[0],d[2]))];};

 const churn=()=>xe('window.__ch||0');
 xe('{const s0=swapW;swapW=function(){window.__ch=(window.__ch||0)+1;return s0.apply(this,arguments);};const b0=bEquip;bEquip=function(){window.__ch=(window.__ch||0)+1;return b0.apply(this,arguments);};}true');
 {const M=await openMatch('esc','esc');if(M){
  if(xe('MP.gm')!=='esc')fail('esc: page MP.gm '+xe('MP.gm'));
  await step(1500);const lv=M.me().weapon;if(lv!=='Odin')notes.push('server level gun '+lv);
  const c0=churn();await step(3000);const c1=churn()-c0;const p=pg();
  if(c1>2)fail('esc level 1: the gun slot churned '+c1+' swapW/bEquip calls in 3 s with no input (re-equipped every snapshot) '+JSON.stringify(p));
  if(p.w!==M.me().weapon||p.rw!=='pri')fail('esc level 1: page holds '+p.w+' ('+p.rw+'), server '+M.me().weapon);
  if(p.vm!==p.vmWant)fail('esc level 1: viewmodel '+p.vm+' for '+p.w);
  if(xe('VM.sw')>0)fail('esc level 1: the gun never finishes drawing (VM.sw '+xe('VM.sw')+' s after 3 s idle: every re-equip restarts the draw, no shot)');
  // fire: the server spends ammo of the level gun
  const me=M.me();for(const u of M.sim.units)if(!u.human){u.hp=0;u.alive=false;u.respawnAt=M.sim.time+60;}
  const a0=me.ammo;xe('fireHeld=true;true');await step(800);xe('fireHeld=false;true');await step(200);
  if(!(M.me().ammo<a0))fail('esc level 1: holding fire for 0.8 s spent no server ammo ('+a0+' -> '+M.me().ammo+'), page '+JSON.stringify(pg()));
  if(xe('ammo')>=xe('WEAP[wName()].mag'))fail('esc level 1: page ammo still full after firing');
  // the server moves us to later levels
  for(const [lvl,w,slot] of [[7,'Operator','pri'],[8,'Sheriff','pis'],[11,'Knife','knife']]){M.sim.esc.lv[me.team===1?1:0]=lvl;me.escLv=lvl;M.sim.arm(me);await step(1200);
   const c2=churn();await step(2000);const q=pg();
   if(M.me().weapon!==w)notes.push('server holds '+M.me().weapon+' at level '+(lvl+1));
   if(q.w!==w||q.rw!==slot)fail('esc level '+(lvl+1)+': page holds '+q.w+' ('+q.rw+'), want '+w+' ('+slot+')');
   if(churn()-c2>2)fail('esc level '+(lvl+1)+': gun slot churned '+(churn()-c2)+' calls in 2 s');}
 }}
 for(const h of humans.splice(0))try{h.leave();}catch(e){}
 const errs=H.errors.slice(errs0).filter(e=>!/unexpected external script/.test(e.msg||''));if(errs.length)fail('page errors: '+JSON.stringify(errs.slice(0,3)));if(H.xErrCalls.length>x0)fail('xErr: '+JSON.stringify(H.xErrCalls.slice(x0,x0+3)));
 if(fails.length){console.log('FAIL online escalation ('+fails.length+'):\n - '+fails.join('\n - '));process.exit(1);}
 console.log('Online Escalation: level gun in hand and steady (no per-snapshot re-equip), firing spends server ammo, Operator / Sheriff / Knife levels adopted'+(notes.length?' ('+notes.join('; ')+')':''));process.exit(0);
})().catch(e=>{console.error('ERR',e&&e.stack||e);process.exit(1);});
