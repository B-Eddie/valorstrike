// Online 'ghost' (user 2026-10-27: viewmodel stayed on the pistol while the gun HUD named a primary; the other player and the
// bots could not see them; their shots did no damage). The real page (index.html in audit.js's fake DOM) on the real game server
// (in-process local cluster) in TDM and DM:
//  1. the gun in hand is the server's gun: the gun the page fires (wName), the HUD gun name and the visible viewmodel agree
//     with the server's unit from the match start, after loadout picks (dmGive), slot swaps and a server-side gun change, and
//     no sidearm sits in the primary slot (the reconcile used to write every server gun into the primary slot without
//     rebuilding the viewmodel; dmAmmo's onSkin() sat inside a comment; a pick's equip lost the race with the next snapshot);
//  2. the other human sees the page player in plain sight, the page player's shots hit them on the server, a bot in plain
//     sight shoots the page player and the page shows the server's health;
//  3. no unsynced local match: a seat whose 'ready' was lost (the server sends it no snapshots) is brought live, and a server
//     whose snapshots never carry the page's player (unknown id / mismatched server) ends the match with a message instead
//     of letting the page play alone (netSeatCheck / netUnsynced in work/server_runtime.js).
//   node work/test_client_online_ghost.cjs     (in test_all)   SERVER_DIR=<other server dir> to run it against another build
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
 WS.OPEN=1;H.win.WebSocket=WS;/* No fetch, as in the audit boot: the page plays as a guest (profile fetch fails) and skips asset downloads. */ const fetches=[];H.win.fetch=function(u){fetches.push(String(u)+' @ '+new Error().stack.split('\n').slice(2,5).join(' / '));return Promise.reject(new TypeError('Failed to fetch'));};
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

 // ---- 1. TDM: the gun in hand (fired, HUD, viewmodel) is the server's, from the start and through loadout picks ----
 {const M=await openMatch('tdm','tdm');if(M){await step(1000);synced(M,'tdm start');
  xe('dmGive("Ghost");true');await step(600);if(M.me().weapon!=='Ghost')fail('tdm stage 1 pick Ghost: server holds '+M.me().weapon+' (the pick was lost)');synced(M,'tdm after picking Ghost');
  M.sim.remaining-=80;await step(1500);xe('dmGive("Stinger");true');await step(600);if(M.me().weapon!=='Stinger')fail('tdm stage 2 pick Stinger: server holds '+M.me().weapon);synced(M,'tdm after picking Stinger');
  xe('swapW("pis");true');await step(600);synced(M,'tdm after swapping to the sidearm');xe('swapW("pri");true');await step(600);if(M.me().weapon!=='Stinger')fail('tdm swap back: server holds '+M.me().weapon);synced(M,'tdm after swapping back');
  M.sim.giveWeapon(M.me(),'Classic');await step(1500);synced(M,'tdm after the server put a Classic in hand');
  // ---- 2. presence + hits both ways: the other human sees us, our shots hurt them, a bot's shots hurt us ----
  const pair=clearPair();if(!pair)fail('no clear line found on Ascent');else{
   const me=M.me(),b=M.sim.units.find(u=>u.name==='EnemyB');if(b.team===me.team)b.team=1-me.team;M.sim.giveWeapon(me,'Stinger');
   for(const u of M.sim.units)if(!u.human&&u.alive){u.hp=0;u.alive=false;u.respawnAt=M.sim.time+60;}/* bots out of the way for the duel */
   place(M.sim,me,pair[0],pair[1]);place(M.sim,b,pair[1],pair[0]);me.protectedUntil=b.protectedUntil=0;b.hp=100;b.alive=true;
   const hits={pb:0,bp:0};const h0=M.sim.applyHit;M.sim.applyHit=function(u,t){if(u&&t&&u.name==='PageQA'&&t.name==='EnemyB')hits.pb++;if(u&&t&&!u.human&&t.name==='PageQA')hits.bp++;return h0.apply(this,arguments);};
   await step(300);const row=(M.B.rows||[]).find(r=>r[0]===me.id);if(!row||row[22]===1||Math.hypot(row[4]-me.x,row[6]-me.z)>1)fail('the other human does not see the page player in plain sight: '+JSON.stringify(row));
   for(let t=0;t<2000&&!hits.pb;t+=100){const [r,p]=aimAt(M.me(),b);xe(`yaw=${r};pitch=${p};fireHeld=true;NET.firePulse=performance.now()+60;true`);b.input={};await step(100);}
   xe('fireHeld=false;true');if(!hits.pb)fail('the page player\'s shots never hit the other human on the server');
   // a bot in plain sight shoots the page player; the page shows the server's health
   b.x+=200;b.alive=false;b.respawnAt=M.sim.time+60;const bot=M.sim.units.find(u=>!u.human&&u.team!==me.team);bot.alive=true;bot.hp=100;bot.respawnAt=0;place(M.sim,bot,pair[1],pair[0]);me.hp=100;me.armor=0;
   for(let t=0;t<6000&&!hits.bp;t+=100)await step(100);if(!hits.bp)fail('no bot shot the page player standing in plain sight for 6 s');
   await step(200);if(Math.abs(xe('player.hp')-Math.ceil(M.me().hp))>.5)fail('page health '+xe('player.hp')+' vs server '+M.me().hp);
   M.sim.applyHit=h0;notes.push('tdm hits page->B '+hits.pb+', bot->page '+hits.bp);}}}
 // ---- 3. DM: the server's Vandal in hand from the start, a pick reaches the server ----
 {const M=await openMatch('dm','dm');if(M){await step(1000);synced(M,'dm start');xe('dmGive("Phantom");true');await step(600);if(M.me().weapon!=='Phantom')fail('dm pick Phantom: server holds '+M.me().weapon);synced(M,'dm after picking Phantom');
  xe('dmGive("Sheriff");true');await step(600);if(M.me().weapon!=='Sheriff')fail('dm pick Sheriff: server holds '+M.me().weapon);synced(M,'dm after picking Sheriff');}}
 // ---- 4. no ghost: a seat that never went live (lost 'ready') is brought live ----
 {let dropped=0;hook.out=m=>!(m.t==='ready'&&!dropped++);const M=await openMatch('tdm','lost ready');hook.out=null;if(M){
  const live=await until(()=>M.sess()?.ready&&!M.me().loading,8000);if(!live)fail('lost ready: the page kept playing for 8 s on a seat the server never put in the match (session ready '+M.sess()?.ready+', unit loading '+M.me().loading+')');
  else if(xe('MP.st')!=='game')fail('lost ready: page left the match instead of fixing the seat');}}
 // ---- 5. no ghost: snapshots without our row (unknown id / mismatched server) end the match with a message ----
 {const M=await openMatch('tdm','no row');if(M){const id=M.me().id;hook.in=m=>{if(m.t==='s'&&Array.isArray(m.u))m={...m,u:m.u.filter(r=>r[0]!==id)};else if(m.t==='start'&&Array.isArray(m.u)&&m.resumed)m={...m,u:m.u.filter(r=>r[0]!==id)};return m;};
  const left=await until(()=>xe('MP.st')!=='game',30000);hook.in=null;
  if(!left)fail('no row: the page played 30 s of a match whose server snapshots never had its player');
  else{const msg=xe('(document.getElementById("xOnMsg")||{}).textContent||""')+' '+xe('typeof MP.msg!=="undefined"?String(MP.msg):""');notes.push('no-row exit message: '+msg.trim().slice(0,160));}}}
 for(const h of humans.splice(0))try{h.leave();}catch(e){}
 const errs=H.errors.slice(errs0).filter(e=>!/unexpected external script/.test(e.msg||''));if(errs.length)fail('page errors: '+JSON.stringify(errs.slice(0,3)));if(H.xErrCalls.length>x0)fail('xErr: '+JSON.stringify(H.xErrCalls.slice(x0,x0+3)));
 if(fails.length){console.log('FAIL online ghost ('+fails.length+'):\n - '+fails.join('\n - '));process.exit(1);}
 console.log('Online ghost: TDM / DM gun in hand = server gun (start, picks, swaps, server change; HUD + viewmodel), the other human sees the page player, page shots hit, a bot hits the page player, lost ready repaired, no-row match ended ('+notes.join('; ')+')');process.exit(0);
})().catch(e=>{console.error('ERR',e&&e.stack||e);process.exit(1);});
