// Gunplay ONLINE, two humans: the real page (index.html in audit.js's fake DOM) and a scripted human in a Spike match on
// the real game server (in-process local cluster). Checks what the page and the server must agree on:
//  - auto-reload after a finished reload reaches the server (the page timer was left a hair below 0);
//  - spray: the page's recoil climb (VF, gFire) and the server's per-shot climb (fire(), shared motor) are the same
//    sequence for a held Vandal spray (the server used to fire every bullet of a spray straight down the crosshair);
//  - swap mid-reload: R then 2 keeps the Classic on the page and the server (the server refused the equip, so the
//    page was snapped back to the reloading gun); R then knife then click does not fire the gun on the server;
//  - G mid-reload drops the gun on the server and the page; a dead enemy's Phantom walked over is picked up with its
//    magazine and reserve on both, and its reload draws from that reserve;
//  - next round: magazine and reserve refilled on both.
//   node work/test_client_online_gunplay.cjs     (in test_all)
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const audit=fs.readFileSync(path.join(__dirname,'audit.js'),'utf8'),boot=audit.slice(0,audit.indexOf('// ---------- audit ----------')).replace(/^"use strict";/,'');
// Keep the VALORANT FEEL block (the audit fixture strips it): the spray / recoil under test is the feel layer's gFire, which the
// shipped page runs.
const FEEL_STRIP='.replace(/\\/\\/ ---- VALORANT FEEL ----[\\s\\S]*?\\/\\/ ---- END VALORANT FEEL ----/, "")';if(!boot.includes(FEEL_STRIP))throw Error('audit boot no longer strips the feel block this way');const bootFeel=boot.replace(FEEL_STRIP,'');
const log=console.log;console.log=()=>{};// the boot prints its own knife check; keep test output to one line
const H=new Function('require','__dirname','process','module',bootFeel+'\nreturn {win,doc,context,errors,xErrCalls,advance,mkEvent,dispatch,setPhase:p=>{phase=p;}};')(require,__dirname,process,module);
console.log=log;
const VERBOSE=!!process.env.VERBOSE,SEED=+(process.env.SEED||7);
// Determinism: the fight used to be decided by unseeded Math.random (server spawns / spread / bot AI in this realm, the
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
 const key=(code,down)=>{const ev=()=>H.mkEvent(down?'keydown':'keyup',{code,key:code.replace(/^Key|^Digit/,'').toLowerCase()});H.dispatch(H.win,ev());H.dispatch(H.doc,ev());};
 const tap=async code=>{key(code,true);await step(50);key(code,false);await step(50);};
 // The harness page sits behind a cover overlay (no renderer), so its rAF loop never runs the match tick: the test drives
 // the page's own fiveTick / vmTick at 50 ms once the match is live (movement, reload timer, held fire -> shoot -> gFire, equip time).
 let drive=false;const step=async ms=>{for(let t=0;t<ms;t+=50){if(xe('MP.code'))codes.add(xe('MP.code'));await settle();await cluster.advance(50);H.advance(50);if(drive)xe('fiveTick(0.05);vmTick(0.05);true');}};
 const until=async(cond,ms,what)=>{for(let t=0;t<ms;t+=50){if(cond())return true;await step(50);}fail('timed out: '+what);return false;};
 const humans=[];const join=(code,name,agent)=>{const h=new ScriptedHuman({name,agent,world,target:null});codes.add(code);pending++;let settled=false;const done=()=>{if(!settled){settled=true;pending--;}};const s=cluster.connect({code});h.attach(s);s.on('message',m=>h.receive(m));s.on('open',()=>{done();h.hello();});s.on('error',done);humans.push(h);return h;};
 xe(`J.pick='Jett';MP.name='PageQA';window.xQMap='ascent';MP.map='ascent';mpCreate(false,'five')`);
 await until(()=>xe('MP.st')==='room',8000,'room');const code=xe('MP.code');
 join(code,'FoeB','Sova');await until(()=>xe('(MP.room&&MP.room.pl||[]).length')===2,8000,'human joined');xe('mpStart()');
 await until(()=>xe('MP.st')==='game'&&xe('NET.ready'),20000,'match start');
 const room=cluster.room(code),sim=room.sim,me=()=>sim.units.find(u=>u.human&&u.name==='PageQA'),foe=()=>sim.units.find(u=>u.human&&u.name==='FoeB');
 // keep the fight out of it: bots frozen far away, no round end, no buy phase
 const park=()=>{for(const u of sim.units)if(!u.human){u.x=200;u.z=200;u.y=0;u.input={};}};
 drive=true;if(xe('since')!==1)fail('the page ticks on its own in this harness: driving it too would double the game time');sim.bot=function(u){u.input={};u.inputAt=this.time;};sim.remaining=900;sim.buy=0;await step(400);park();
 if(foe().team===me().team)foe().team=1-me().team;
 const page=()=>xe('({w:rw==="knife"?"Knife":wName(),ammo,rsv,rl:reloading>0,pri:FV.pri,hp:Math.max(0,Math.ceil(player.hp))})');
 const arm=async(w,ammo,rsv)=>{const u=me();u.primary=w;u.weapon=w;u.ammo=ammo;u.reserve=rsv;u.inventory={[w]:ammo,Classic:12};u.reserves={[w]:rsv,Classic:36};u.secondary='Classic';u.reloadAt=0;u.equipAt=0;u.fireAt=0;
  xe(`FV.pri=${JSON.stringify(w)};slots.pri={ammo:${ammo},rsv:${rsv}};slots.pis={ammo:12,rsv:36};swapW("pis");swapW("pri");ammo=${ammo};rsv=${rsv};reloading=0;true`);await until(()=>page().w===w&&page().ammo===ammo,3000,'page armed with '+w);await step(1500);/* equip time */};
 // 1. spray parity: hold fire into the sky for ~1.3 s
 {await arm('Vandal',25,50);if(false)console.log('state',JSON.stringify(xe('({paused,running,menu:FV.menu,hp:player.hp,mode,dr:J.dr,buy:FV.buy,fcd,sw:VM.sw,locked:typeof xPL!=="undefined"})')));xe('pitch=0.6;true');const sv=[];const f0=sim.fire.bind(sim);sim.fire=function(u){const a=u.ammo,r=f0(u);if(u===me()&&r&&u.ammo<a)sv.push(u.spray?u.spray.recoilY:NaN);return r;};
  /* the harness page has no map floor (it free-falls, and an airborne Vandal climbs x1.8, patch 6.11): stand it on the server body's floor for the spray */xe(`globalThis.__g0=groundAt;groundAt=function(){return ${me().y}};true`);await step(400);if(xe('player.air'))fail('spray: page player not grounded');const pv=[];let sq=xe('xValorantFeel.state.sequence');xe('fireHeld=true;true');for(let t=0;t<1300;t+=50){await step(50);const q=xe('[xValorantFeel.state.sequence,xValorantFeel.state.recoilY]');if(q[0]!==sq){if(q[0]<sq||q[0]-sq>1)fail('spray: page sequence jumped '+sq+' -> '+q[0]);sq=q[0];pv.push(q[1]);}}if(false)console.log('after',JSON.stringify(page()),xe('fireHeld'));xe('fireHeld=false;groundAt=globalThis.__g0;true');await step(600);sim.fire=f0;
  if(sv.length<8||pv.length<8)fail(`spray: too few shots (server ${sv.length}, page ${pv.length})`);
  const n=Math.min(sv.length,pv.length);for(let i=0;i<n;i++)if(!(Math.abs(sv[i]-pv[i])<1e-12)){fail(`spray shot ${i}: server climb ${sv[i]}, page ${pv[i]} (server ${JSON.stringify(sv.slice(0,n))} page ${JSON.stringify(pv.slice(0,n))})`);break;}
  if(!(sv[Math.min(n,10)-1]>.03))fail('spray: the server climb did not build up: '+JSON.stringify(sv));
  if(Math.abs(sv.length-pv.length)>1)fail(`spray: shot count server ${sv.length} page ${pv.length}`);
  if(me().ammo!==25-sv.length||page().ammo!==me().ammo)fail(`spray ammo: server ${me().ammo} (${sv.length} shots), page ${page().ammo}`);
  xe('pitch=0;true');}
 // 2. swap mid-reload: R, then 2 -> Classic on both, Vandal magazine unchanged, no snap-back
 {await arm('Vandal',5,50);await tap('KeyR');await step(300);if(!me().reloadAt||!page().rl)fail(`reload did not start (server ${me().reloadAt}, page ${page().rl})`);
  await tap('Digit2');await step(1200);const p=page(),u=me();
  if(p.w!=='Classic'||u.weapon!=='Classic')fail(`swap mid-reload: page ${p.w}, server ${u.weapon} (want Classic on both)`);if(u.reloadAt)fail('swap mid-reload: server still reloading');
  if(u.inventory.Vandal!==5)fail('swap mid-reload: Vandal magazine '+u.inventory.Vandal+' (want 5)');
  await step(2500);if(page().w!=='Classic'||me().weapon!=='Classic')fail(`after the reload time: page ${page().w}, server ${me().weapon}`);
  await tap('Digit1');await step(1500);if(page().w!=='Vandal'||me().ammo!==5||page().ammo!==5)fail(`back to the Vandal: page ${JSON.stringify(page())}, server ${me().weapon} ${me().ammo}`);}
 // 2b. after a finished reload, emptying the magazine auto-reloads on the server too (a finished reload left the page's
 // timer a hair below 0, which the net loop read as still reloading: the auto-reload was never sent, the server stayed empty)
 {await arm('Vandal',3,50);await tap('KeyR');await step(3200);if(me().ammo!==25||page().ammo!==25)fail(`manual reload: server ${me().ammo}, page ${page().ammo}`);xe('pitch=0.6;fireHeld=true;true');await until(()=>page().ammo===0||page().rl,6000,'magazine emptied');xe('fireHeld=false;pitch=0;true');await step(3500);
  const u=me(),p=page();if(u.ammo!==25||u.reserve!==3||p.ammo!==25||p.rsv!==3)fail(`auto-reload after a finished reload: server ${u.ammo}/${u.reserve}, page ${p.ammo}/${p.rsv} (want 25/3)`);}
 // 3. knife swap mid-reload, then a click: the server swings the knife, the Vandal does not fire
 {await arm('Vandal',5,50);await tap('KeyR');await step(300);await tap('Digit3');await step(1000);const before=me().inventory.Vandal;xe('shoot();true');await step(400);
  if(me().weapon!=='Knife')fail('knife swap mid-reload: server holds '+me().weapon);if(me().inventory.Vandal!==before||before!==5)fail(`knife click fired the Vandal (magazine ${before} -> ${me().inventory.Vandal})`);
  await tap('Digit1');await step(1500);}
 // 4. G mid-reload, then a dead enemy's Phantom walked over: magazine and reserve on both; its reload uses that reserve
 {await arm('Vandal',5,50);await tap('KeyR');await step(300);await tap('KeyG');await step(600);
  if(me().primary||xe('FV.pri'))fail(`G mid-reload: server primary ${me().primary}, page ${xe('FV.pri')}`);if(!(sim.floor||[]).some(d=>d.w==='Vandal'&&d.ammo===5&&d.reserve===50))fail('G mid-reload: no Vandal 5 / 50 on the floor: '+JSON.stringify(sim.floor));
  sim.floor=sim.floor.filter(d=>d.w!=='Vandal');const f=foe(),u=me();Object.assign(f,{primary:'Phantom',weapon:'Phantom',ammo:7,reserve:13,inventory:{Phantom:7},reserves:{Phantom:13},x:u.x+3,z:u.z,y:u.y,floorDropped:false});f.hp=0;f.alive=false;f.respawnAt=1e9;await step(200);
  const g=(sim.floor||[]).find(d=>d.w==='Phantom');if(!g||g.ammo!==7||g.reserve!==13)fail('dead enemy Phantom on the floor: '+JSON.stringify(sim.floor));
  else{g.x=u.x;g.z=u.z;g.y=u.y;g.graceUntil=0;await step(1800);const p=page();if(me().primary!=='Phantom'||me().ammo!==7||me().reserve!==13)fail(`pickup: server ${me().primary} ${me().ammo}/${me().reserve}`);if(p.w!=='Phantom'||p.ammo!==7||p.rsv!==13)fail('pickup: page '+JSON.stringify(p));
   await tap('KeyR');await step(3800);const q=page();if(me().ammo!==20||me().reserve!==0||q.ammo!==20||q.rsv!==0)fail(`reload of the picked-up Phantom: server ${me().ammo}/${me().reserve}, page ${q.ammo}/${q.rsv} (want 20/0)`);}}
 // 5. HUD at an armor boundary: the scripted foe's Odin, three leg shots at 3 m into 100 hp / 50 armor (32 a shot, armor
 // absorbs 21.12, 21.12, then the last 7.76) leaves exactly 54 hp / 0 armor on the server, and the page HUD reads 54 / 0
 // (the float leftover 54.00000000000001 used to show 55). The foe is aimed from server state (look PI faces +z, toward the
 // page player; an earlier attempt aimed down -z and every shot missed), one shot per tick, 0.45 s apart so no spray climb.
 {await arm('Vandal',25,50);const m=me();m.hp=100;m.armor=50;await step(200);const shots=[];
  for(let i=0;i<3;i++){const g=foe(),u=me();Object.assign(g,{alive:true,hp:100,weapon:'Odin',primary:'Odin',ammo:100,inventory:{Odin:100},fireAt:0,equipAt:0,reloadAt:0,triggerHeld:false,x:u.x,z:u.z-3,y:u.y,look:Math.PI,pitch:Math.atan2(.45-1.6,3),input:{fire:true},inputAt:sim.time,ch:0});
   const h0=u.hp,f0=sim.fire.bind(sim);sim.fire=function(w){const r=f0(w);if(w===foe())w.input={};return r;};await step(50);sim.fire=f0;shots.push(+(h0-me().hp).toFixed(4));await step(450);}
  xe('xHud();true');const hud=xe('[document.getElementById("xHp").textContent,document.getElementById("xArm").textContent]');
  if(me().hp!==54||me().armor!==0)fail(`armor boundary: server ${me().hp} / ${me().armor} after leg shots ${JSON.stringify(shots)} (want 54 / 0)`);
  if(hud[0]!=='54'||hud[1]!=='0')fail(`armor boundary HUD: ${hud[0]} / ${hud[1]} (server ${me().hp} / ${me().armor}, want 54 / 0)`);
  Object.assign(foe(),{weapon:'Classic',primary:null,input:{}});me().hp=100;await step(300);}
 // 6. next round: magazine and reserve refilled on both
 {me().ammo=3;const r0=sim.round;sim.roundDelay=0;sim.finishRound(0,'QA');await until(()=>sim.round>r0&&sim.phase==='game',30000,'next round');sim.buy=0;await step(800);const p=page(),u=me(),W=xe('MAG()'),R=xe('xRsv(wName())');/* the wiki reserve (Vandal 50), not 3 magazines */
  if(u.ammo!==W||p.ammo!==W||p.rsv!==R||u.reserve!==R)fail(`next round: server ${u.weapon} ${u.ammo}/${u.reserve}, page ${p.w} ${p.ammo}/${p.rsv}`);}
 for(const h of humans.splice(0))try{h.leave();}catch(e){}xe('mpReset()');await step(300);
 const errors=H.errors.slice(errs0),xerr=H.xErrCalls.slice(x0);if(errors.length||xerr.length)fail('page exceptions '+JSON.stringify({errors:errors.slice(0,5),xerr:xerr.slice(0,5)}));
 if(fails.length){console.error(fails.slice(0,40).join('\n'));process.exit(1);}
 console.log('Online gunplay (page + scripted human <-> in-process server): spray climb identical page / server, swap mid-reload kept on both (no snap-back), knife swap mid-reload does not fire the gun, G mid-reload, dead enemy Phantom picked up with 7 / 13 and reloaded from it, HUD exact at an armor boundary (Odin legs x3 into 50 armor = 54 / 0), next-round refill; no page exceptions');
 process.exit(0);
})().catch(e=>{console.error(e);console.error(JSON.stringify(H.errors.slice(0,8)));process.exit(1);});
