// Rebinding Use / Drop / Reload ONLINE: the real page (audit.js fake DOM) in a Spike match on the in-process server.
// The keymap layer re-sends a rebound key as its default code on window only (a real dispatchEvent on window never
// reaches document listeners), so the online F (pick up) / G (drop gun) / R (reload) handlers must listen on window.
// Physical keys are dispatched as trusted events on document (the path a real keypress takes: window capture first).
// With Use <-> Ability E swapped (F <-> E), Drop moved to Z and Reload moved to V: E picks the floor gun up, F does
// not, Z drops the held gun, G does not, V reloads, R does not; with default binds each key sends exactly one message.
//   node work/test_client_online_rebind.cjs     (in test_all)
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const audit=fs.readFileSync(path.join(__dirname,'audit.js'),'utf8'),boot=audit.slice(0,audit.indexOf('// ---------- audit ----------')).replace(/^"use strict";/,'');
const log=console.log;console.log=()=>{};// the boot prints its own knife check; keep test output to one line
const H=new Function('require','__dirname','process','module',boot+'\nreturn {win,doc,context,errors,xErrCalls,advance,mkEvent,dispatch,setPhase:p=>{phase=p;}};')(require,__dirname,process,module);
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
 // a real key event reaches capture listeners on window, then document (the harness dispatches to one target at a time)
 const key=(code,down)=>{const ev=()=>H.mkEvent(down?'keydown':'keyup',{code,key:code.replace(/^Key|^Digit/,'').toLowerCase()});H.dispatch(H.win,ev());H.dispatch(H.doc,ev());};
 const step=async ms=>{for(let t=0;t<ms;t+=50){if(xe('MP.code'))codes.add(xe('MP.code'));await settle();await cluster.advance(50);H.advance(50);}};
 const until=async(cond,ms,what)=>{for(let t=0;t<ms;t+=50){if(cond())return true;await step(50);}fail('timed out: '+what);return false;};
 const humans=[];const join=(code,name,agent)=>{const h=new ScriptedHuman({name,agent,world,target:null});codes.add(code);pending++;let settled=false;const done=()=>{if(!settled){settled=true;pending--;}};const s=cluster.connect({code});h.attach(s);s.on('message',m=>h.receive(m));s.on('open',()=>{done();h.hello();});s.on('error',done);humans.push(h);return h;};
 xe(`J.pick='Jett';MP.name='PageQA';window.xQMap='ascent';MP.map='ascent';mpCreate(false,'five')`);
 await until(()=>xe('MP.st')==='room',8000,'room');const code=xe('MP.code');
 join(code,'MateB','Sova');await until(()=>xe('(MP.room&&MP.room.pl||[]).length')===2,8000,'human joined');xe('mpStart()');
 await until(()=>xe('MP.st')==='game'&&xe('NET.ready'),20000,'match start');
 const room=cluster.room(code),sim=room.sim,me=()=>sim.units.find(u=>u.human&&u.name==='PageQA');
 sim.buy=99;await step(300);
 xe('window.__ns=[];const ns0=netSend;netSend=function(m){__ns.push(m&&m.t);return ns0.apply(this,arguments);};true');
 const sent=()=>xe('__ns.splice(0)').filter(t=>t==='pick'||t==='dropw'||t==='reload'||t==='drop');
 const phys=async(code)=>{for(const t of ['keydown','keyup'])H.dispatch(H.doc,H.mkEvent(t,{code,key:code.replace(/^Key/,'').toLowerCase(),isTrusted:true}));await step(150);};
 // bots with an empty primary slot walk over a dropped gun and take it (Valorant rules); give them one so the dropped Vandal stays put
 const arm=async()=>{for(const b of sim.units)if(!b.human&&!b.primary){b.primary='Phantom';b.inventory=b.inventory||{};b.inventory.Phantom=25;b.reserves=b.reserves||{};b.reserves.Phantom=75;}const u=me();u.credits=9000;await step(100);if(!me().primary){xe('fBuy("Vandal");true');await step(250);}xe('buyMenu(false);true');await step(50);xe('if(FV.pri)swapW("pri");true');await step(200);
  if(sim.spike&&sim.spike.carrier===me().id){sim.spike.carrier=null;sim.spike.st='drop';sim.spike.x=0;sim.spike.z=0;await step(100);}};
 const floorV=()=>(sim.floor||[]).find(g=>[g.weapon,g.w,g.n].includes('Vandal'));
 const lookAt=async g=>{const u=me();u.x=g.x;u.z=g.z;await step(300);xe('player.x='+g.x+';player.z='+g.z+';player.y='+(g.y||0)+';true');};/* the harness page has no native map (legacy blockout, ground y 0) while the server stands the unit on Ascent's real floor (attacker spawn y ~7.05): put the page player where the server put it, so xdLook's 2 m / height window sees the gun as in a browser */
 // 1. default binds: G drops once, F picks up once, R reloads once
 await arm();if(me().primary!=='Vandal')fail('setup: no Vandal ('+me().primary+')');
 sent();await phys('KeyG');let s=sent();if(s.join()!=='dropw')fail('default G sent '+JSON.stringify(s)+' (want one dropw)');
 if(me().primary)fail('default G: server still holds '+me().primary);
 let g=floorV();if(!g)fail('default G: no Vandal on the floor');else{await lookAt(g);sent();await phys('KeyF');s=sent();if(s.join()!=='pick')fail('default F sent '+JSON.stringify(s)+' (want one pick)');if(me().primary!=='Vandal')fail('default F: not picked up ('+me().primary+')');}
 sim.buy=0;await step(200);xe('ammo=Math.min(ammo,5);true');sent();await phys('KeyR');s=sent();if(s.filter(t=>t==='reload').length!==1)fail('default R sent '+JSON.stringify(s)+' (want one reload)');
 sim.buy=99;await step(200);
 // 2. rebound: Use <-> Ability E, Drop -> Z, Reload -> V
 xe('XS.keys.use="KeyE";XS.keys.abE="KeyF";XS.keys.drop="KeyZ";XS.keys.ping="KeyG";XS.keys.reload="KeyV";xKbBuild();true');
 await arm();if(me().primary!=='Vandal')fail('rebound setup: no Vandal');
 sent();await phys('KeyG');s=sent();if(s.includes('dropw'))fail('rebound: G (now Ping) still dropped the gun');
 sent();await phys('KeyZ');s=sent();if(s.join()!=='dropw')fail('rebound Drop (Z) sent '+JSON.stringify(s)+' (want one dropw)');
 if(me().primary)fail('rebound Z: server still holds '+me().primary);
 g=floorV();if(!g)fail('rebound Z: no Vandal on the floor '+JSON.stringify(sim.floor)+' me '+me().primary+'/'+me().secondary+' mate '+sim.units.filter(u=>u.human).map(u=>u.name+':'+u.primary).join());else{await lookAt(g);
  sent();await phys('KeyF');s=sent();if(s.includes('pick'))fail('rebound: F (now Ability E) still picked up');
  sent();await phys('KeyE');s=sent();if(s.join()!=='pick')fail('rebound Use (E) sent '+JSON.stringify(s)+' (want one pick)');
  if(me().primary!=='Vandal')fail('rebound E: not picked up ('+me().primary+')');}
 sim.buy=0;await step(200);xe('ammo=Math.min(ammo,5);true');
 sent();await phys('KeyR');s=sent();if(s.includes('reload'))fail('rebound: R (unbound) still reloaded');
 sent();await phys('KeyV');s=sent();if(s.filter(t=>t==='reload').length!==1)fail('rebound Reload (V) sent '+JSON.stringify(s)+' (want one reload)');
 xe('XS.keys=xKbDef();xKbBuild();true');
 const errors=H.errors.slice(errs0),xerr=H.xErrCalls.slice(x0);if(errors.length||xerr.length)fail('page exceptions '+JSON.stringify({errors:errors.slice(0,5),xerr:xerr.slice(0,5)}));
 if(fails.length){console.error(fails.slice(0,40).join('\n'));process.exit(1);}
 console.log('Online rebinding (page <-> in-process server): default F/G/R send one pick/dropw/reload each; with Use<->Ability E, Drop->Z, Reload->V the rebound keys pick up / drop / reload and the old keys do not; no page exceptions');
 process.exit(0);
})().catch(e=>{console.error(e);console.error(JSON.stringify(H.errors.slice(0,8)));process.exit(1);});
