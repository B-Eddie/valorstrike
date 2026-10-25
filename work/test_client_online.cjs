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
const VERBOSE=!!process.env.VERBOSE,LONG=!!process.env.QA_LONG,T=LONG?{fight:[40000,20000,30000],rounds:3,until:240000}:{fight:[9000,4000,5000],rounds:2,until:60000};
(async()=>{
 const xe=code=>require('vm').runInContext('__xe',H.context)(code);
 const {localCluster}=await import('../server/tools/local-cluster.mjs');const {ScriptedHuman}=await import('../server/tools/scripted-human.mjs');const {loadWorld}=await import('../server/src/world.js');
 const cluster=await localCluster({env:{ALLOW_LOCAL_ORIGIN:'true',ENABLE_SPIKE:'true'}});const world=await loadWorld(cluster.env.ASSETS,'ascent');
 // WebSocket bridge: the page's socket is a local-cluster connection.
 const sockets=[];
 class WS{constructor(url){const q=Object.fromEntries(new URL(url.replace(/^ws/,'http')).searchParams);this.readyState=0;this.sent=0;sockets.push(this);const api=cluster.connect(q);this.api=api;
   api.on('open',()=>{this.readyState=1;this.onopen&&this.onopen({});});api.on('message',m=>{if(this.readyState===1&&this.onmessage)this.onmessage({data:JSON.stringify(m)});});
   api.on('close',e=>{if(this.readyState===3)return;this.readyState=3;this.onclose&&this.onclose({code:e.code,reason:e.reason});});api.on('error',e=>{this.readyState=3;this.onerror&&this.onerror(e);this.onclose&&this.onclose({code:1006,reason:String(e.message)});});}
  send(d){if(this.readyState!==1)throw Error('send on closed socket');this.sent++;if(VERBOSE)(this.types||(this.types={}))[JSON.parse(d).t]=1;this.api.send(d);}close(){if(this.readyState===3)return;this.readyState=3;this.api.close();}}
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
 const step=async ms=>{for(let t=0;t<ms;t+=50){await cluster.advance(50);H.advance(50);if(pilotCode&&(pilotTick+=50)>=100){pilotTick=0;drive();}}};
 const until=async(cond,ms,what)=>{for(let t=0;t<ms;t+=50){if(cond())return;await step(50);}throw Error('timed out: '+what+' (MP.st '+xe('MP.st')+' host '+xe('NET.host')+' room '+xe('JSON.stringify(MP.room)')+' sent '+sockets.map(s=>s.sent+JSON.stringify(s.types))+' server '+(()=>{const r=cluster.room(xe('MP.code'));return r?JSON.stringify({ph:r.sim?.phase,host:r.host,ses:[...r.sessions.values()].map(s=>[s.id,s.u&&s.u.name,s.ready])}):'none';})()+' dbg '+xe('JSON.stringify({role:MP.role,cl:MP.cl,m5:MP.m5,pick:FV.pick,mode:typeof mode!=="undefined"?mode:null,last:NET.lastClose,latest:!!NET.latest})')+' fetches '+JSON.stringify(fetches.slice(0,5))+' running '+xe('running')+' ld '+xe('window.xLdOn')+' ready '+xe('NET.ready')+', errors '+JSON.stringify(H.errors.slice(errs0,errs0+3))+' xerr '+JSON.stringify(H.xErrCalls.slice(x0,x0+3))+')');};
 const humans=[];const join=(code,name,agent,target)=>{const p={};const h=new ScriptedHuman({name,agent,world,target});const s=cluster.connect({code});h.attach(s);s.on('message',m=>h.receive(m));s.on('open',()=>h.hello());humans.push(h);return h;};
 const report={};
 const tBoot=Date.now();let vt=0;for(const mode of ['tdm','dm','five']){H.setPhase('online '+mode);const tm=Date.now(),v0=cluster.clock.now();
  xe(`MP.name='PageQA';window.xQMap='ascent';MP.map='ascent';mpCreate(false,'${mode}')`);
  await until(()=>xe('MP.st')==='room',8000,mode+' room');const code=xe('MP.code');
  const B=join(code,'FuzzB','Sova','PageQA'),C=join(code,'FuzzC','Reyna','PageQA');
  await until(()=>xe('(MP.room&&MP.room.pl||[]).length')===3,8000,'humans joined');xe('mpStart()');
  await until(()=>xe('MP.st')==='game'&&xe('NET.ready'),20000,mode+' match start');
  let deaths=0,lastHp=100,swaps=0;const sample=()=>{const hp=xe('player.hp');if(lastHp>0&&hp<=0)deaths++;lastHp=hp;};pilotCode=code;if(mode==='five'&&!LONG)cluster.room(code).sim.buy=1.5;// fast: skip most of the first buy phase
  const pk=()=>{const u=cluster.room(code)?.sim?.units.find(u=>u.name===xe('MP.name'));return u?u.kills:0;};
  // Fight; B leaves and rejoins as another agent (a bot takes and gives back the seat), C drops by socket close.
  for(let t=0;t<T.fight[0];t+=500){await step(500);sample();}
  B.leave();await step(1500);const B2=join(code,'FuzzB','Omen','PageQA');swaps++;
  for(let t=0;t<T.fight[1];t+=500){await step(500);sample();}
  C.socket.close();await step(1500);join(code,'FuzzC','Killjoy','PageQA');swaps++;
  for(let t=0;t<T.fight[2];t+=500){await step(500);sample();}
  const units=xe('bots.length+allies.length');assert(units>=8,'page shows the other units: '+units);
  if(mode==='five'){const r=cluster.room(code).sim;if(!LONG&&r.round<2&&!(r.roundDelay>0))r.finishRound(0,'QA');await until(()=>r.round>=T.rounds,T.until,'Spike round resets');if(!LONG)r.buy=Math.min(r.buy,1.5);}
  // The piloted page player must have fought: fired, killed or died (deaths sampled from the page's own hp).
  for(let t=0;t<T.until&&!(deaths>=1&&pk()>=1)&&(mode!=='five'||!LONG||t<15000);t+=500){await step(500);sample();const r=cluster.room(code).sim,u=r.units.find(u=>u.name===xe('MP.name'));if(mode==='five'&&!LONG&&u&&!u.alive&&!(r.roundDelay>0)&&r.phase==='game'){r.finishRound(0,'QA');}else if(mode==='five'&&!LONG&&r.buy>1.5)r.buy=1.5;}
  const kills=pk();assert(stats.fired>0,'pilot fired');if(mode!=='five'||!LONG)assert(deaths>=1&&kills>=1,mode+': page player killed and died ('+kills+'/'+deaths+')');
  // Match end (DM/TDM by clock, Spike by forcing the score), then the result screen and leaving.
  const room=cluster.room(code);if(mode==='five'){room.sim.roundScores=[12,10];room.sim.roundDelay=0;room.sim.finishRound(0,'QA');}else room.sim.remaining=1;
  await until(()=>xe('MP.st')==='post',30000,mode+' match end');await step(1000);
  report[mode]={deaths,kills,swaps,units,round:room.sim.round,ms:Date.now()-tm,virt:cluster.clock.now()-v0};pilotCode=null;idle();
  for(const h of humans.splice(0))try{h.leave();}catch(e){}
  xe('mpReset()');await step(500);xe('try{toLobby()}catch(e){}');await step(200);}
 // Server-side disconnect mid-match: the page must leave the match cleanly.
 H.setPhase('online drop');xe(`mpCreate(false,'tdm')`);await until(()=>xe('MP.st')==='room',8000,'room');const code=xe('MP.code');join(code,'FuzzD','Jett','PageQA');await until(()=>xe('(MP.room&&MP.room.pl||[]).length')===2,8000,'joined');xe('mpStart()');
 await until(()=>xe('MP.st')==='game'&&xe('NET.ready'),20000,'start');await step(5000);const room=cluster.room(code);const ws=[...room.sessions].find(([w,s])=>s.u&&s.u.name==='PageQA')[0];ws.close(1001,'Connection idle');room.drop(ws);
 await step(2000);assert.notEqual(xe('MP.st'),'game','page left the match after the server closed the socket');
 const errors=H.errors.slice(errs0),xerr=H.xErrCalls.slice(x0);
 if(errors.length||xerr.length){console.error(JSON.stringify({errors:errors.slice(0,8),xerr:xerr.slice(0,8)},null,1));process.exit(1);}
 if(VERBOSE)console.log(JSON.stringify(report));
 console.log(`Online client soak (page <-> in-process server): ${LONG?'long':'fast'} TDM/DM/Spike, piloted page player kills/deaths ${Object.values(report).map(r=>r.kills+'/'+r.deaths).join(', ')}, respawns, kills, leave/rejoin agent swaps, Spike rounds (${report.five.round}), match end, server disconnect; no page exceptions`);
 process.exit(0);
})().catch(e=>{console.error(e);console.error(JSON.stringify(H.errors.slice(0,8)));process.exit(1);});
