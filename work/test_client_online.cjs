// Headless online client soak: the real page (index.html in audit.js's fake DOM + THREE stub, booted exactly as the
// audit does) talks to the real game server (server/src/worker.js in-process via server/tools/local-cluster.mjs) through
// a WebSocket bridge. Scripted human clients join, fight, leave and rejoin with other agents, so the page sees deaths,
// respawns, kills, units removed and replaced (agent swaps), rejoins, Spike round resets, a server-side disconnect and
// the match end. Any exception in the page's timers / frames / message handlers, or an xErr report, fails the test.
// The page's own player is piloted through the page's input globals (keys / yaw / pitch / fireHeld / NET.firePulse),
// steered by ScriptedHuman's nav-graph hunter toward the nearest enemy, so it actually fights, kills and dies.
//   node work/test_client_online.cjs          fast variant (in test_all), < 30 s
//   QA_LONG=1 node work/test_client_online.cjs   long soak (90 s per mode, Spike to round 3), a tool
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const audit=fs.readFileSync(path.join(__dirname,'audit.js'),'utf8'),boot=audit.slice(0,audit.indexOf('// ---------- audit ----------')).replace(/^"use strict";/,'');
const log=console.log;console.log=()=>{};// the boot prints its own knife check; keep test output to one line
const H=new Function('require','__dirname','process','module',boot+'\nreturn {win,context,errors,xErrCalls,advance,setPhase:p=>{phase=p;}};')(require,__dirname,process,module);
console.log=log;
const VERBOSE=!!process.env.VERBOSE,SEED=+(process.env.SEED||7),LONG=!!process.env.QA_LONG,T=LONG?{fight:[40000,20000,30000],rounds:3,until:240000}:{fight:[9000,4000,5000],rounds:2,until:60000};
// Determinism: the fight used to be decided by unseeded Math.random (server spawns / spread / bot AI in this realm, the
// page's own in its vm realm) and by real async work (world loading on create, 'hi' crypto) racing the virtual clock,
// so under machine load the piloted TDM fight once ended 0 kills / 5 deaths. Both realms are seeded and the virtual
// clocks hold while a connection or an authentication is pending (as tools/soak.mjs does), so a seed replays.
function mulberry(seed){let a=seed>>>0;return ()=>{a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return ((t^t>>>14)>>>0)/4294967296;};}
Math.random=mulberry(SEED*104729+1);require('vm').runInContext(`Math.random=(${mulberry})(${SEED*7919+3});`,H.context);
(async()=>{
 const xe=code=>require('vm').runInContext('__xe',H.context)(code);
 const {localCluster}=await import('../server/tools/local-cluster.mjs');const {ScriptedHuman}=await import('../server/tools/scripted-human.mjs');const {loadWorld}=await import('../server/src/world.js');const {abilityDamage}=await import('../server/src/abilities.js');
 const cluster=await localCluster({env:{ALLOW_LOCAL_ORIGIN:'true',ENABLE_SPIKE:'true'}});const world=await loadWorld(cluster.env.ASSETS,'ascent');
 // WebSocket bridge: the page's socket is a local-cluster connection.
 const sockets=[],codes=new Set(),transit=[],blackholes=new Set();let pending=0,linkDelay=0;
 const relay=(ws,fn)=>{if(blackholes.has(ws))return;if(linkDelay)transit.push({at:cluster.clock.now()+linkDelay,ws,fn});else fn();};
 const flushTransit=()=>{for(let i=0;i<transit.length;)if(transit[i].at<=cluster.clock.now()){const q=transit.splice(i,1)[0];if(q.ws.readyState===1&&!blackholes.has(q.ws))q.fn();}else i++;};
 // Hold both virtual clocks (real-time wait, up to 120 s) while a socket is connecting (create = real world file I/O)
 // or any known room has a session still authenticating its 'hi' (real async crypto).
 const settle=async()=>{const end=Date.now()+120000;const busy=()=>pending>0||[...codes].some(c=>{const r=cluster.room(c);return r&&[...r.sessions.values()].some(s=>s.authenticating&&!s.u);});while(busy()&&Date.now()<end)await new Promise(r=>setTimeout(r,2));};
 class WS{constructor(url){const q=Object.fromEntries(new URL(url.replace(/^ws/,'http')).searchParams);this.readyState=0;this.sent=0;sockets.push(this);const api=cluster.connect(q);this.api=api;pending++;let settled=false;const done=()=>{if(!settled){settled=true;pending--;}};if(q.code)codes.add(q.code);
   api.on('open',()=>{done();this.readyState=1;this.onopen&&this.onopen({});});api.on('message',m=>{if(m.t==='s')this.snapshots=(this.snapshots||0)+1;relay(this,()=>{if(this.readyState===1&&this.onmessage)this.onmessage({data:JSON.stringify(m)});});});
   api.on('close',e=>{if(this.readyState===3)return;this.readyState=3;this.onclose&&this.onclose({code:e.code,reason:e.reason});});api.on('error',e=>{done();this.readyState=3;this.onerror&&this.onerror(e);this.onclose&&this.onclose({code:1006,reason:String(e.message)});});}
  send(d){if(this.readyState!==1)throw Error('send on closed socket');this.sent++;if(VERBOSE)(this.types||(this.types={}))[JSON.parse(d).t]=1;relay(this,()=>{if(this.readyState===1)this.api.send(d);});}close(){if(this.readyState===3)return;this.readyState=3;this.api.close();}}
 WS.OPEN=1;H.win.WebSocket=WS;/* No fetch, as in the audit boot: the page plays as a guest (profile fetch fails) and skips asset downloads. */ const fetches=[];H.win.fetch=function(u){fetches.push(String(u)+' @ '+new Error().stack.split('\n').slice(2,5).join(' / '));return Promise.reject(new TypeError('Failed to fetch'));};
 H.win.__ls=new Map();H.win.__ls.getItem=k=>H.win.__ls.has(k)?H.win.__ls.get(k):null;H.win.__ls.setItem=(k,v)=>H.win.__ls.set(k,String(v));H.win.__ls.removeItem=k=>H.win.__ls.delete(k);
 // The native map pipeline downloads the render scene and collision; the harness has no renderer or network, so the
 // page builds its legacy blockout instead (as the audit's fixtures do). Everything online stays server-driven.
 xe('nmEnsure=function(){return Promise.resolve(null);};window.xvAgentsReady=xvAgentsReady=function(){return Promise.resolve([]);};xvPreloadAgents=function(){};true');
 const errs0=H.errors.length,x0=H.xErrCalls.length;
 // Pilot: every 100 ms read the authoritative state (the page's own snapshots would do as well, this is simpler), pick
 // the nearest living enemy and feed ScriptedHuman's decision into the page's input globals.
 let pilotCode=null,pilotTick=0;const pilot=new ScriptedHuman({name:'PageQA',world,target:null}),stats={fired:0,pageKills:0};
 const drive=()=>{const r=pilotCode&&cluster.room(pilotCode),sim=r?.sim;if(!sim||sim.phase!=='game'||!xe('NET.ready'))return;const me=sim.units.find(u=>u.human&&u.name===xe('MP.name'));if(!me)return;
  if(!LONG&&sim.mode==='five'){if(me.alive&&sim.buy>0&&me.primary!=='Vandal'){me.credits=9000;xe("netSend({t:'buy',n:'Vandal'});true");}}// fast: buy a rifle through the page so kills come quickly
  else if(!LONG&&me.alive&&me.weapon!=='Vandal'){Object.assign(me,{weapon:'Vandal',ammo:25,reserve:75});me.inventory[me.weapon]=25;}// fast: a rifle so kills come quickly
  pilot.id=me.id;pilot.rows=sim.rows();pilot.time=sim.time*1000;const foes=sim.units.filter(u=>u!==me&&u.alive&&!u.loading&&(sim.mode==='dm'||u.team!==me.team)).sort((a,b)=>Math.hypot(a.x-me.x,a.z-me.z)-Math.hypot(b.x-me.x,b.z-me.z));
  pilot.target=foes[0]?.name;pilot.foe=()=>pilot.rows.find(q=>q[2]===pilot.target&&q[10]===1)||null;const i=pilot.input(),fire=!!i.fire;if(fire)stats.fired++;
  xe(`yaw=${i.r||0};pitch=${i.p||0};keys.KeyW=${(i.f||0)>0};keys.KeyS=false;keys.KeyD=${(i.s||0)>0};keys.KeyA=${(i.s||0)<0};keys.Space=${!!i.j};fireHeld=${fire};if(${fire})NET.firePulse=performance.now()+40;true`);};
 const idle=()=>xe('["KeyW","KeyS","KeyA","KeyD","Space"].forEach(k=>keys[k]=false);fireHeld=false;true');
 const step=async ms=>{for(let t=0;t<ms;t+=50){if(xe('MP.code'))codes.add(xe('MP.code'));await settle();flushTransit();await cluster.advance(50);flushTransit();H.advance(50);if(pilotCode&&(pilotTick+=50)>=100){pilotTick=0;drive();}}};
 const until=async(cond,ms,what)=>{for(let t=0;t<ms;t+=50){if(cond())return;await step(50);}throw Error('timed out: '+what+' (MP.st '+xe('MP.st')+' host '+xe('NET.host')+' room '+xe('JSON.stringify(MP.room)')+' sent '+sockets.map(s=>s.sent+JSON.stringify(s.types))+' server '+(()=>{const r=cluster.room(xe('MP.code'));return r?JSON.stringify({ph:r.sim?.phase,host:r.host,ses:[...r.sessions.values()].map(s=>[s.id,s.u&&s.u.name,s.ready])}):'none';})()+' dbg '+xe('JSON.stringify({role:MP.role,cl:MP.cl,m5:MP.m5,pick:FV.pick,mode:typeof mode!=="undefined"?mode:null,last:NET.lastClose,latest:!!NET.latest})')+' fetches '+JSON.stringify(fetches.slice(0,5))+' running '+xe('running')+' ld '+xe('window.xLdOn')+' ready '+xe('NET.ready')+', errors '+JSON.stringify(H.errors.slice(errs0,errs0+3))+' xerr '+JSON.stringify(H.xErrCalls.slice(x0,x0+3))+')');};
 const humans=[];const join=(code,name,agent,target)=>{const p={};const h=new ScriptedHuman({name,agent,world,target});codes.add(code);pending++;let settled=false;const done=()=>{if(!settled){settled=true;pending--;}};const s=cluster.connect({code});h.attach(s);s.on('message',m=>h.receive(m));s.on('open',()=>{done();h.hello();});s.on('error',done);humans.push(h);return h;};
 const report={};
 const tBoot=Date.now();let vt=0;for(const mode of ['tdm','dm','five']){H.setPhase('online '+mode);const tm=Date.now(),v0=cluster.clock.now();
  xe(`MP.name='PageQA';window.xQMap='ascent';MP.map='ascent';mpCreate(false,'${mode}')`);
  await until(()=>xe('MP.st')==='room',8000,mode+' room');const code=xe('MP.code');
  const B=join(code,'FuzzB','Sova','PageQA'),C=join(code,'FuzzC','Reyna','PageQA');
  await until(()=>xe('(MP.room&&MP.room.pl||[]).length')===3,8000,'humans joined');xe('mpStart()');
  await until(()=>xe('MP.st')==='game'&&xe('NET.ready'),20000,mode+' match start');
  let deaths=0,lastHp=100,swaps=0,forcedDeath=0;const sample=()=>{const hp=xe('player.hp');if(lastHp>0&&hp<=0)deaths++;lastHp=hp;};pilotCode=code;if(mode==='five'&&!LONG)cluster.room(code).sim.buy=1.5;// fast: skip most of the first buy phase
  const pk=()=>{const u=cluster.room(code)?.sim?.units.find(u=>u.name===xe('MP.name'));return u?u.kills:0;};
  // the pilot's shots that landed on the server (online hit registration), counted at the server's applyHit
  const hits={n:0,foe:0};{const sm=cluster.room(code).sim,h0=sm.applyHit;sm.applyHit=function(u,t){if(u&&u.human&&u.name==='PageQA'){hits.n++;if(t&&t!==u&&(this.mode==='dm'||t.team!==u.team))hits.foe++;}return h0.apply(this,arguments);};}
  // Fight; B leaves and rejoins as another agent (a bot takes and gives back the seat), C drops by socket close.
  for(let t=0;t<T.fight[0];t+=500){await step(500);sample();}
  B.leave();await step(1500);const B2=join(code,'FuzzB','Omen','PageQA');swaps++;
  for(let t=0;t<T.fight[1];t+=500){await step(500);sample();}
  C.socket.close();await step(1500);join(code,'FuzzC','Killjoy','PageQA');swaps++;
  for(let t=0;t<T.fight[2];t+=500){await step(500);sample();}
  const units=xe('bots.length+allies.length');assert(units>=8,'page shows the other units: '+units);
  if(mode==='five'){const r=cluster.room(code).sim;if(!LONG&&r.round<2&&!(r.roundDelay>0))r.finishRound(0,'QA');await until(()=>r.round>=T.rounds,T.until,'Spike round resets');if(!LONG)r.buy=Math.min(r.buy,1.5);}
  // The piloted page player must have fought: fired, killed or died (deaths sampled from the page's own hp).
  for(let t=0;t<T.until&&!(deaths>=1&&pk()>=1)&&(mode!=='five'||!LONG||t<15000);t+=500){await step(500);sample();const r=cluster.room(code).sim,u=r.units.find(u=>u.name===xe('MP.name'));if(mode==='five'&&!LONG&&u&&!u.alive&&!(r.roundDelay>0)&&r.phase==='game'){r.finishRound(0,'QA');}/* Bot variety (spread site spots, staggered starts) can leave a Vandal-armed pilot unbeaten by pistol bots for the whole fast window on a seed (seed 7: 4/0): after 30 s without a death a living enemy bot finishes it through the server's ability-damage path, so the page's death / round-reset handling still runs. */if(mode==='five'&&!LONG&&t>=30000&&!deaths&&u&&u.alive&&r.phase==='game'&&!(r.roundDelay>0)){const k=r.units.find(v=>v.alive&&!v.human&&v.team!==u.team);if(k){abilityDamage(r,k,u,999);forcedDeath++;}}else if(mode==='five'&&!LONG&&r.buy>1.5)r.buy=1.5;}
  const kills=pk();assert(stats.fired>0,'pilot fired');if(mode!=='five')assert(deaths>=1&&kills>=1,mode+': page player killed and died ('+kills+'/'+deaths+')');
  /* Spike 5v5 (bots7): the bots take corners like players since 662bf3e (jiggle / wide swing / hold, peeker's advantage), and the
     scripted pilot (no peeking, walks straight at the nearest enemy) now loses its duels on this seed (0 kills / 4 deaths, deterministic;
     1 / 1 on 10e1208). What this checks is the online 5v5 flow, not that a scripted player wins duels: the page player fires, its shots
     land on enemies on the server, it dies and the round resets, and the page's kill / death counts are the server's. */
  if(mode==='five'&&!LONG){const sm=cluster.room(code).sim,u=sm.units.find(u=>u.name==='PageQA'),lk=xe('NET.latest&&NET.latest.k?NET.latest.k.PageQA:null'),ld=xe('NET.latest&&NET.latest.d?NET.latest.d.PageQA:null');
   assert(hits.foe>=1,'five: none of the page player\'s shots hit an enemy on the server ('+hits.n+' hits, '+stats.fired+' fire inputs)');
   assert(deaths>=1,'five: page player never died ('+kills+'/'+deaths+')');
   assert(u&&u.deaths===deaths,'five: page saw '+deaths+' deaths, server counts '+(u&&u.deaths));
   assert(lk===u.kills&&ld===u.deaths,'five: page snapshot K/D '+lk+'/'+ld+' vs server '+u.kills+'/'+u.deaths);}
  // Match end (DM/TDM by clock, Spike by forcing the score), then the result screen and leaving.
  const room=cluster.room(code);if(mode==='five'){room.sim.roundScores=[12,10];room.sim.roundDelay=0;room.sim.finishRound(0,'QA');}else room.sim.remaining=1;
  await until(()=>xe('MP.st')==='post',30000,mode+' match end');await step(1000);
  report[mode]={deaths,kills,hits:hits.foe,swaps,forcedDeath,units,round:room.sim.round,ms:Date.now()-tm,virt:cluster.clock.now()-v0};pilotCode=null;idle();
  for(const h of humans.splice(0))try{h.leave();}catch(e){}
  xe('mpReset()');await step(500);xe('try{toLobby()}catch(e){}');await step(200);}
 // The real page recovers transient closes and half-open links in place. Delay both directions, then blackhole one
 // transport while leaving subsequent sockets healthy, as after a Wi-Fi/mobile handoff. Server snapshots must stay
 // bounded during the outage and the recovered page must retain its authoritative body, inventory and input sequence.
 H.setPhase('online recovery');xe(`mpCreate(false,'tdm')`);await until(()=>xe('MP.st')==='room',8000,'room');const code=xe('MP.code');join(code,'FuzzD','Jett','PageQA');await until(()=>xe('(MP.room&&MP.room.pl||[]).length')===2,8000,'joined');xe('mpStart()');
 await until(()=>xe('MP.st')==='game'&&xe('NET.ready'),20000,'start');await step(1000);const room=cluster.room(code),id=xe('MP.me'),unit=room.sim.units.find(u=>u.id===id);
 room.sim.spawnRooms=false;/* the TDM spawn room heals hp back to 100: this checks recovery keeps the body as set, so take the room out (as test-tdm-abilities does) */unit.invulnerableUntil=room.sim.time+200;unit.hp=73;unit.ammo=7;unit.credits=2222;
 const pageSocket=()=>[...room.sessions].find(([w,s])=>s.u?.id===id)?.[0];
 const recovered=()=>xe('MP.st==="game"&&NET.ready&&!NET.reconnecting');
 const preserved=()=>{assert.equal(xe('MP.me'),id);assert.equal(room.sim.units.find(u=>u.id===id),unit);assert.equal(unit.hp,73);assert.equal(unit.ammo,7);assert.equal(unit.credits,2222);assert(xe('running'),'match stays mounted');};
 {const ws=pageSocket();ws.close(1001,'Connection idle');room.drop(ws,true);}
 await until(recovered,8000,'same-seat recovery after close');preserved();
 linkDelay=80;await step(5000);assert(recovered(),'160 ms round-trip delay keeps the match connected');preserved();linkDelay=0;await step(500);
 {const stale=sockets.at(-1),received=stale.snapshots||0,before=room.metrics.coalesced;blackholes.add(stale);await step(33000);blackholes.delete(stale);
  await until(recovered,8000,'half-open socket recovery');preserved();assert.notEqual(sockets.at(-1),stale,'watchdog replaces a blackholed transport');
  assert((stale.snapshots||0)-received<=room.constructor.FLOW.window+2,'blackholed client cannot queue unbounded snapshots');assert(room.metrics.coalesced>before,'server coalesced stale state during the outage');}
 // Cancelling while a retry is pending must not reopen a socket or restart the match later.
 {const ws=pageSocket();ws.close(1001,'temporary link loss');room.drop(ws,true);await step(50);assert(xe('NET.reconnecting'));const count=sockets.length;xe('mpReset();try{toLobby()}catch(e){}');await step(5000);assert.equal(sockets.length,count,'reset cancels pending reconnect');assert.equal(xe('NET.socket'),null);}
 // Deliberate departure, protocol refusal and an expired resume capability remain terminal.
 for(const closeCode of [1000,1008,4003]){xe(`mpCreate(false,'tdm')`);await until(()=>xe('MP.st')==='room',8000,'terminal-close room');const r=cluster.room(xe('MP.code')),ws=[...r.sessions].find(([w,s])=>s.u?.name==='PageQA')[0];r.drop(ws);ws.close(closeCode,'terminal test');await step(1000);assert.equal(xe('NET.socket'),null,'close '+closeCode+' is terminal');assert.equal(xe('NET.reconnecting'),false);}
 // Slow match load: the page reports loading progress (lp) and keeps its seat past the server's load limit while the
 // progress moves; when it stalls the server closes the seat as 'Load timed out' and the page says so plainly.
 // (Limits shortened on the room class for the test; the real ones are 180 s / 120 s stall / 10 min.)
 H.setPhase('online slow load');xe('try{toLobby()}catch(e){}');await step(200);xe(`mpCreate(false,'tdm')`);await until(()=>xe('MP.st')==='room',8000,'slow-load room');const code2=xe('MP.code');join(code2,'FuzzE','Sova','PageQA');
 await until(()=>xe('(MP.room&&MP.room.pl||[]).length')===2,8000,'slow-load joined');const GR=cluster.room(code2).constructor,saved={I:GR.IDLE,L:GR.LOAD};GR.IDLE={...GR.IDLE,loading:20000};GR.LOAD={ping:20000,stall:15000,max:120000};
 try{
  xe('window.__hold=true;Object.defineProperty(window,"xLdOn",{get(){return window.__hold||window.__xLdOn;},set(v){window.__xLdOn=v;},configurable:true});window.xLdAgFrac=0;true');
  xe('mpStart()');await until(()=>xe('NET.loadAt>0'),20000,'slow-load start');await step(1000);assert.equal(xe('NET.ready'),false,'page is still loading');
  const sess=()=>[...cluster.room(code2).sessions.values()].find(s=>s.u&&s.u.name===xe('MP.name'));
  for(let t=0;t<40000;t+=1000){xe('window.xLdAgFrac=Math.min(1,window.xLdAgFrac+.02);true');await step(1000);}
  assert(sess(),'seat kept past the load limit while progress moves');assert(sess().loadPing>0&&sess().loadMoved>0,'progress reports reached the server');
  for(let t=0;t<25000&&sess();t+=1000)await step(1000);
  assert(!sess(),'stalled load closed');assert.notEqual(xe('MP.st'),'game','page left the match');assert.equal(xe('NET.loadAt'),0);assert(/Loading the match took too long/.test(xe('MP.msg')),'page explains the load timeout: '+xe('MP.msg'));
 }finally{GR.IDLE=saved.I;GR.LOAD=saved.L;xe('window.__hold=false;delete window.xLdOn;window.xLdOn=window.__xLdOn||false;true');for(const h of humans.splice(0))try{h.leave();}catch(e){}}
 // The page's own start wait (mpWaitStart) also gave up at 180 s however the load was going: it now waits while the
 // progress moves and gives up (with the load-timeout message) 120 s after it stalls.
 {xe('window.__hold=true;Object.defineProperty(window,"xLdOn",{get(){return window.__hold||window.__xLdOn;},set(v){window.__xLdOn=v;},configurable:true});MP.role="client";window.xLdAgFrac=0;window.__ok=0;window.__fail=null;mpWaitStart(()=>window.__ok++,l=>window.__fail=l);true');
  try{for(let t=0;t<300000;t+=5000){xe('window.xLdAgFrac=Math.min(1,window.xLdAgFrac+.015);true');H.advance(5000);}assert.equal(xe('window.__fail'),null,'a progressing load is not given up at 180 s');
   H.advance(100000);assert.equal(xe('window.__fail'),null,'not before 120 s of stall');H.advance(25000);assert.equal(xe('window.__fail'),true,'stalled load gives up as a load timeout');assert.equal(xe('window.__ok'),0);}
  finally{xe('window.__hold=false;delete window.xLdOn;window.xLdOn=window.__xLdOn||false;MP.role=null;true');}}
 const errors=H.errors.slice(errs0),xerr=H.xErrCalls.slice(x0);
 if(errors.length||xerr.length){console.error(JSON.stringify({errors:errors.slice(0,8),xerr:xerr.slice(0,8)},null,1));process.exit(1);}
 if(VERBOSE)console.log(JSON.stringify(report));
 console.log(`Online client soak (page <-> in-process server): ${LONG?'long':'fast'} TDM/DM/Spike, piloted page player kills/deaths ${Object.values(report).map(r=>r.kills+'/'+r.deaths+' ('+r.hits+' hits)'+(r.forcedDeath?' (death forced after 30 s)':'')).join(', ')}, respawns, kills, leave/rejoin agent swaps, Spike rounds (${report.five.round}), match end; same-seat reconnect, 160 ms RTT, bounded blackhole recovery, retry cancellation and terminal closes; slow load kept while progressing then closed with a clear message; no page exceptions`);
 process.exit(0);
})().catch(e=>{console.error(e);console.error(JSON.stringify(H.errors.slice(0,8)));process.exit(1);});
