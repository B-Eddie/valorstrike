// Buy menu + economy ONLINE: the real page (index.html in audit.js's fake DOM) in a Spike match on the real game server
// (in-process local cluster). Through the page's own buy entry points (fBuy / fSell, which the menu's click and
// right-click call; online they send buy / sell and apply the server's 'bo' reply): every weapon and both shields are
// bought and sold back; the page's credits, loadout, armor and the buy menu's credit display equal the server's after
// each reply; a buy over the credits is refused by the server and changes nothing on the page; ability charges buy and
// sell; selling after the buy phase is refused; G (drop) during the buy phase puts the gun on the server floor, a
// teammate picks it up, and the page's loadout follows; a round reset re-arms the page from the server's loadout.
//   node work/test_client_online_buy.cjs     (in test_all)
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
 const sellable=(n,p,a)=>xe(`/xb-sell/.test(bCard(${JSON.stringify(n)},${p|0},${a|0}))`),abSellable=k=>xe(`/data-n="ab:${k}" class="[^"]*xb-sell/.test(jBuyHtml())`);
 const BUY=xe('BUY');const items=BUY.flatMap(([cat,l])=>l.map(([n,p,a])=>({n,p,a})));
 xe(`J.pick='Jett';MP.name='PageQA';window.xQMap='ascent';MP.map='ascent';mpCreate(false,'five')`);
 await until(()=>xe('MP.st')==='room',8000,'room');const code=xe('MP.code');
 join(code,'MateB','Sova');await until(()=>xe('(MP.room&&MP.room.pl||[]).length')===2,8000,'human joined');xe('mpStart()');
 await until(()=>xe('MP.st')==='game'&&xe('NET.ready'),20000,'match start');
 const room=cluster.room(code),sim=room.sim,me=()=>sim.units.find(u=>u.human&&u.name==='PageQA'),mate=()=>sim.units.find(u=>u.human&&u.name==='MateB');
 sim.buy=99;await step(300);
 if(me().team!==mate().team){/* the test's drop/pick needs a teammate: move MateB over */mate().team=me().team;}
 const page=()=>xe('({cr:FV.cr,pri:FV.pri,sec:FV.sec,arm:Math.round(player.armor||0),c:J.c|0,q:J.q|0,disp:document.getElementById("xBC").textContent})');
 const server=()=>{const u=me();return {cr:u.credits,pri:u.primary||null,sec:u.secondary||'Classic',arm:Math.round(u.armor||0),c:u.ability.c|0,q:u.ability.q|0};};
 const same=(tag)=>{const p=page(),s=server();const bad=[];for(const k of ['cr','pri','sec','arm','c','q'])if(p[k]!==s[k])bad.push(`${k} page ${p[k]} server ${s[k]}`);if(xe('FV.menu')&&String(p.disp).trim()!==String(s.cr))bad.push(`menu credits "${p.disp}" server ${s.cr}`);if(bad.length)fail(`${tag}: ${bad.join(', ')}`);return !bad.length;};
 xe('buyMenu(true);true');await step(100);if(!xe('FV.menu'))fail('buy menu did not open in the online buy phase');
 let n=0;
 for(const it of items){if(it.n==='Classic')continue;n++;
  const u=me();u.credits=9000;u.primary=null;u.secondary='Classic';u.armor=0;u.weapon='Classic';await step(150);
  if(VERBOSE)console.log(' ',it.n,JSON.stringify(page()));
  xe(`fBuy(${JSON.stringify(it.n)});true`);await step(250);
  const s=server();const owns=it.a?s.arm===it.a:(s.pri===it.n||s.sec===it.n);
  if(!owns)fail(`buy ${it.n}: server did not equip it (${JSON.stringify(s)})`);if(s.cr!==9000-it.p)fail(`buy ${it.n}: server credits ${s.cr}, want ${9000-it.p}`);
  same('after buying '+it.n);if(owns&&!sellable(it.n,it.p,it.a))fail('buy '+it.n+': the menu card is not marked sellable (right-click to sell)');
  xe(`fSell(${JSON.stringify(it.n)});true`);await step(250);
  if(server().cr!==9000)fail(`sell ${it.n}: server credits ${server().cr}, want 9000 (full refund in the buy phase)`);
  same('after selling '+it.n);if(sellable(it.n,it.p,it.a))fail('sell '+it.n+': the card is still marked sellable');
 }
 // over the credits
 {const u=me();u.credits=500;u.primary=null;await step(150);xe('fBuy("Vandal");true');await step(250);if(me().primary)fail('bought a Vandal with 500 credits');same('after a refused buy');}
 // ability charges
 {const u=me();u.credits=1000;u.ability.c=0;u.ability.q=0;await step(150);xe('jBuy("c");true');await step(250);if(me().ability.c!==1)fail('ability C not bought: '+me().ability.c);same('after buying C');if(!abSellable('c'))fail('ability C card not marked sellable after buying a charge');
  xe('fSell("ab:c");true');await step(250);if(me().ability.c!==0||me().credits!==1000)fail('ability C not sold back: c '+me().ability.c+' cr '+me().credits);same('after selling C');if(abSellable('c'))fail('ability C card still sellable after selling the charge');}
 // a second primary in the same round stacks on the server (full price; selling it gives the first one back, as
 // test-spike-edges.js pins); the page follows, and online its menu prices the second gun at full price (no local log)
 {const u=me();u.credits=9000;u.primary=null;await step(150);xe('fBuy("Vandal");true');await step(250);xe('buyMenu(true);true');await step(50);
  const aff=xe('(()=>{FV.cr=2000;const h=bCard("Phantom",2900);FV.cr='+me().credits+';return /xb-no/.test(h);})()');if(!aff)fail('online menu shows a Phantom affordable with 2000 credits over a Vandal (server charges full price)');
  xe('fBuy("Phantom");true');await step(250);if(me().primary!=='Phantom'||me().credits!==3200)fail(`stacked buy: ${me().primary} ${me().credits}`);same('after the Vandal -> Phantom buy');if(!sellable('Phantom',2900))fail('stacked Phantom not marked sellable');
  xe('fSell("Phantom");true');await step(250);if(me().primary!=='Vandal'||me().credits!==6100)fail(`unstack: ${me().primary} ${me().credits}`);same('after selling the Phantom');if(!sellable('Vandal',2900))fail('Vandal not sellable again after selling the Phantom bought over it');}
 // drop for a teammate (G, buy phase): the gun goes to the floor, the mate picks it up, the page loses it
 {xe('buyMenu(false);true');await step(100);xe('if(FV.pri)swapW("pri");true');await step(150);const carrier=sim.spike&&sim.spike.st==='carry'&&sim.spike.carrier===me().id;if(!carrier){/* the bug this pins: a Spike carrier's G did nothing in the buy phase */sim.spike.carrier=me().id;sim.spike.st='carry';await step(200);}if(!xe('FV.sp.st=="carry"&&FV.sp.c===player'))fail('page does not show itself carrying the Spike');key('KeyG',true);await step(60);key('KeyG',false);await step(300);
  const fl=(sim.floor||[]).find(g=>[g.weapon,g.w,g.n].includes('Vandal'));
  if(me().primary)fail('G during the buy phase: server still holds '+me().primary);else{
   if(!fl)fail('dropped Vandal not on the server floor: '+JSON.stringify((sim.floor||[]).slice(0,3)));
   else{const m=mate();m.x=fl.x;m.z=fl.z;m.y=fl.y||m.y;sim.command(m,{t:'pick',id:fl.id});await step(300);if(mate().primary!=='Vandal')fail('teammate pick-up failed: '+mate().primary);}}
  same('after dropping the Vandal');if(xe('rw')==='pri'&&!xe('FV.pri'))fail('page holds an empty primary slot after the drop');}
 // sell after the buy phase is refused
 {const u=me();u.credits=5000;u.primary=null;await step(150);xe('fBuy("Spectre");true');await step(250);sim.buy=0;await step(300);const cr=me().credits;
  xe('fSell("Spectre");true');await step(250);if(me().primary!=='Spectre'||me().credits!==cr)fail('sold after the buy phase');same('after a refused late sell');if(sellable('Spectre',1600))fail('Spectre card still marked sellable after the buy phase');
  xe('buyMenu(true);true');await step(50);if(xe('FV.menu'))fail('buy menu opens after the buy phase');}
 // round reset: page re-armed from the server's loadout and credits
 {const r0=sim.round;sim.roundDelay=0;sim.finishRound(0,'QA');await until(()=>sim.round>r0&&sim.phase==='game',30000,'next round');await step(500);same('after the round reset');}
 // offline 5v5, same rule: a Spike carrier's G in the buy phase drops the held gun (the Spike can't be dropped then)
 {for(const h of humans.splice(0))try{h.leave();}catch(e){}xe('mpReset()');await step(300);xe('try{toLobby()}catch(e){}');await step(200);
  xe('FV.pick="ascent";FV.srOn=0;window.xSwift=false;startFive();true');await step(200);
  xe('FV.buy=20;FV.cr=5000;fBuy("Vandal");swapW("pri");FV.sp.st="carry";FV.sp.c=player;true');await step(100);
  if(xe('FV.pri')!=='Vandal')fail('offline: Vandal not bought ('+xe('FV.pri')+')');
  key('KeyG',true);await step(50);key('KeyG',false);await step(100);
  if(xe('FV.pri')!==null||!xe('XD.L.some(d=>d.w==="Vandal")'))fail('offline: Spike carrier G in the buy phase did not drop the Vandal (pri '+xe('FV.pri')+')');
  if(xe('FV.sp.st')!=='carry'||!xe('FV.sp.c===player'))fail('offline: G in the buy phase dropped the Spike');
  xe('running=false;clearTimeout(FV.to);try{toLobby()}catch(e){}true');}
 const errors=H.errors.slice(errs0),xerr=H.xErrCalls.slice(x0);if(errors.length||xerr.length)fail('page exceptions '+JSON.stringify({errors:errors.slice(0,5),xerr:xerr.slice(0,5)}));
 if(fails.length){console.error(fails.slice(0,40).join('\n'));process.exit(1);}
 console.log(`Online buy menu (page <-> in-process server): ${n} items bought and sold back (cards marked sellable while the server would refund them; credits / loadout / armor / menu credits equal the server's), over-credit buy refused, ability charge buy + sell, same-round second primary (server stack) and its sell-back, G drop picked up by a teammate, late sell refused, round reset re-armed; offline Spike carrier's buy-phase G drops the gun; no page exceptions`);
 process.exit(0);
})().catch(e=>{console.error(e);console.error(JSON.stringify(H.errors.slice(0,8)));process.exit(1);});
