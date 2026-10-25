// Kill feed, scoreboard (Tab), round end, match end and the play-again / return-to-lobby flows, online and offline,
// on the real page (audit.js fake DOM). Online: a 5v5 room on the in-process server (page + a scripted human + 8 bots);
// kills are made on the server as its shot code makes them (unit state + the 'k' event); the page's kill feed shows each
// kill once with the right killer / victim / weapon / team colours, the scoreboard's K / D equal the server's for all ten
// players in two tables of five with no duplicate names, a round won by kills adds exactly one round, the match end shows
// the result, and leaving a finished server room returns to the lobby (the server refuses a second start in a finished
// room, so "Back to room" used to leave a dead Start button). Offline 5v5: the kill feed names the gun in hand (the
// bought Phantom / Sheriff, not the retake inventory pick or always the Classic), scoreboard counts, round / match end,
// Play again resets score, scoreboard and feed, Lobby leaves the match.
//   node work/test_client_results.cjs     (in test_all)
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
 const feedRows=()=>xe('[...document.getElementById("feed").children].map(d=>({c:d.className,a:d.xA.textContent,w:d.xW.title,b:d.xB.textContent,t:d.xT.textContent,ac:d.xA.className,bc:d.xB.className}))');
 const kills=()=>feedRows().filter(r=>!/kf--note/.test(r.c));
 const boardTables=()=>xe('(()=>{const b=document.getElementById("xBoard");board();return [...b.querySelectorAll("table")].map(t=>[...t.querySelectorAll("tbody tr")].map(r=>[...r.children].map(c=>c.textContent)))})()');
 // ---------- online ----------
 xe(`J.pick='Jett';MP.name='PageQA';window.xQMap='ascent';MP.map='ascent';mpCreate(false,'five')`);
 await until(()=>xe('MP.st')==='room',8000,'room');const code=xe('MP.code');
 join(code,'MateB','Sova');await until(()=>xe('(MP.room&&MP.room.pl||[]).length')===2,8000,'human joined');xe('mpStart()');
 await until(()=>xe('MP.st')==='game'&&xe('NET.ready'),20000,'match start');
 const room=cluster.room(code),sim=room.sim,me=()=>sim.units.find(u=>u.human&&u.name==='PageQA');
 sim.buy=0;await step(500);
 const srvKill=(u,t,hs)=>{t.hp=0;t.alive=false;t.deaths++;u.kills++;sim.events.push(['k',u.name,t.name,hs?1:0,u.weapon]);}; // as the server's shot code
 const nm=n=>n==='PageQA'?'You':n,mine=me().team,en=sim.units.filter(u=>u.team!==mine),fr=sim.units.filter(u=>u.team===mine&&u!==me());
 const k0=kills().length;
 srvKill(me(),en[0],true);srvKill(fr[0],en[1],false);srvKill(en[2],fr[1],false);await step(400);await step(1000);
 {const K=kills().slice(0,kills().length-k0).reverse(),want=[[me(),en[0],true],[fr[0],en[1]],[en[2],fr[1]]];
  if(K.length!==3)fail('online: '+K.length+' kill-feed rows for 3 kills '+JSON.stringify(K));
  want.forEach(([k,v,hs],i)=>{const r=K[i];if(!r)return;const vn=nm(v.name);
   if(r.a.split(' · ')[0]!==nm(k.name)||!r.b.startsWith(vn))fail(`online kill ${i}: feed shows ${r.a} > ${r.b}, want ${nm(k.name)} > ${vn}`);
   if(r.w!==k.weapon)fail(`online kill ${i}: weapon ${r.w}, want ${k.weapon}`);
   const blue=c=>/kf--blue/.test(c);if(blue(r.ac)!==(k.team===mine)||blue(r.bc)!==(v.team===mine))fail(`online kill ${i}: team colours wrong (${r.ac} / ${r.bc})`);
   if(k===me()&&!/kf--mine/.test(r.c))fail('online: own kill not marked kf--mine');});}
 const sbCheck=(tag)=>{const T=boardTables();if(T.length!==2){fail(tag+': scoreboard tables '+T.length);return;}
  const names=T.flat().map(r=>r[1]);if(new Set(names).size!==names.length)fail(tag+': duplicate scoreboard rows '+JSON.stringify(names));
  if(T[0].length!==5||T[1].length!==5)fail(tag+`: scoreboard rows ${T[0].length} / ${T[1].length}, want 5 / 5`);
  for(const u of sim.units){const n=nm(u.name),side=u.team===mine?0:1,row=T[side].find(r=>r[1]===n||r[1].startsWith(n+' '));if(!row){fail(`${tag}: ${n} missing from the ${side?'enemy':'own'} table`);continue;}
   const p=xe(`(()=>{const s=SB[${JSON.stringify(n)}];return s?[s.k,s.d]:null})()`);if(!p||p[0]!==u.kills||p[1]!==u.deaths)fail(`${tag}: ${n} K/D page ${p} server ${u.kills}/${u.deaths}`);if(+row[3]!==u.kills||+row[4]!==u.deaths)fail(`${tag}: ${n} scoreboard row K/D ${row[3]}/${row[4]} server ${u.kills}/${u.deaths}`);}};
 sbCheck('online after 3 kills');
 // a round won by kills: exactly one round to the page's team
 const r0=xe('[FV.you,FV.them]');for(const t of en)if(t.alive)srvKill(me(),t,false);await step(2500);
 {const r1=xe('[FV.you,FV.them]');if(r1[0]!==r0[0]+1||r1[1]!==r0[1])fail(`online round: score ${r0} -> ${r1}, want one more round won`);}
 sbCheck('online after the round');const fk=kills().length;await step(1500);if(kills().length>fk)fail('online: kill feed grew with no new kills (duplicate rows) '+JSON.stringify(kills()));
 await until(()=>sim.phase==='game'&&sim.buy>0,20000,'next round');await step(300);
 // match end
 sim.roundScores[mine]=12;sim.buy=0;await step(300);for(const t of sim.units.filter(u=>u.team!==mine))if(t.alive)srvKill(me(),t,false);
 await until(()=>xe('MP.st')==='post',30000,'match end');await step(3000);
 {const R=xe('({res:document.getElementById("result").style.display,t:document.getElementById("resTitle").textContent,x:document.getElementById("resText").textContent,ag:document.getElementById("againBtn").textContent})');
  if(R.res!=='flex'||R.t!=='Victory'||!/13 · 0/.test(R.x))fail('online match end: '+JSON.stringify(R));
  if(sim.phase!=='post')fail('server not in post');
  H.doc.getElementById('againBtn').click();await step(1500);
  const S2=xe('({st:MP.st,role:MP.role||null,res:document.getElementById("result").style.display,lobby:document.getElementById("lobby").style.display,sock:!!NET.socket,running})');
  if(S2.st==='room'||S2.st==='post'||S2.sock)fail(`online: after the match, "${R.ag}" left the page in a finished server room (Start is refused there): `+JSON.stringify(S2));
  if(S2.res!=='none'||S2.lobby!=='flex'||S2.running)fail('online: not back in the lobby after the match '+JSON.stringify(S2));}
 for(const h of humans.splice(0))try{h.leave();}catch(e){}
 // ---------- offline 5v5 ----------
 xe('mpReset();try{toLobby()}catch(e){}true');await step(200);
 xe('FV.pick="ascent";FV.srOn=0;window.xSwift=false;startFive();true');await step(300);xe('FV.buy=0;true');await step(200);
 const off0=kills().length;
 xe('FV.pri="Phantom";slots.pri={ammo:30,rsv:90};swapW("pri");kill(bots[0],true);FV.sec="Sheriff";slots.pis={ammo:6,rsv:24};swapW("pis");kill(bots[1],false);kill(bots[2],false,allies[0].name,allies[0].w);true');await step(100);
 {const K=kills().slice(0,kills().length-off0).reverse(),b=xe('bots.map(x=>x.name)'),a0=xe('allies[0].name'),aw=xe('allies[0].w');
  const want=[['You','Phantom',b[0]],['You','Sheriff',b[1]],[a0,aw,b[2]]];
  if(K.length!==3)fail('offline: '+K.length+' kill-feed rows for 3 kills');
  want.forEach(([k,w,v],i)=>{const r=K[i];if(!r)return;if(r.a.split(' · ')[0]!==k||!r.b.startsWith(v)||r.w!==w)fail(`offline kill ${i}: feed ${r.a} > ${r.b} with ${r.w}, want ${k} > ${v} with ${w}`);});
  const sb=xe('JSON.stringify([SB.You.k,SB[allies[0].name].k,SB[bots[0].name].d,SB[bots[1].name].d,SB[bots[2].name].d])');if(sb!=='[2,1,1,1,1]')fail('offline scoreboard counts '+sb);
  const T=boardTables(),names=T.flat().map(r=>r[1]);if(T.length!==2||T[0].length!==5||T[1].length!==5||new Set(names).size!==10)fail('offline scoreboard rows '+JSON.stringify(names));}
 {const r0=xe('[FV.you,FV.them]');xe('bots.forEach(b=>b.alive&&kill(b,false));true');await step(2500);const r1=xe('[FV.you,FV.them]');if(r1[0]!==r0[0]+1||r1[1]!==r0[1])fail(`offline round: ${r0} -> ${r1}`);}
 await step(9000);
 xe('FV.you=12;FV.buy=0;true');await step(100);xe('bots.forEach(b=>b.alive&&kill(b,false));true');await step(4000);
 {const R=xe('({res:document.getElementById("result").style.display,t:document.getElementById("resTitle").textContent,x:document.getElementById("resText").textContent,ag:document.getElementById("againBtn").textContent})');
  if(R.res!=='flex'||R.t!=='Victory'||!/13/.test(R.x)||R.ag!=='Play again')fail('offline match end: '+JSON.stringify(R));}
 H.doc.getElementById('againBtn').click();await step(800);
 {const A=xe('({res:document.getElementById("result").style.display,you:FV.you,them:FV.them,running,sb:Object.values(SB).reduce((a,v)=>a+v.k+v.d,0),n:Object.keys(SB).length,feed:[...document.getElementById("feed").children].filter(d=>!/note/.test(d.className)).length})');
  if(A.res!=='none'||A.you!==0||A.them!==0||!A.running||A.sb!==0||A.n!==10||A.feed!==0)fail('offline play again: '+JSON.stringify(A));}
 xe('running=false;true');H.doc.getElementById('lobbyBtn').click();await step(300);
 {const L=xe('({lobby:document.getElementById("lobby").style.display,game:document.getElementById("game").style.display,running})');if(L.lobby!=='flex'||L.game!=='none')fail('offline lobby: '+JSON.stringify(L));}
 const errors=H.errors.slice(errs0),xerr=H.xErrCalls.slice(x0);if(errors.length||xerr.length)fail('page exceptions '+JSON.stringify({errors:errors.slice(0,5),xerr:xerr.slice(0,5)}));
 if(fails.length){console.error(fails.slice(0,40).join('\n'));process.exit(1);}
 console.log('Results flows: online kill feed (one row per kill, names / weapon / team colours), scoreboard K/D = server for 10 players in 5 + 5 unique rows, one round per round won, match end + leaving the finished server room to the lobby; offline kill feed names the gun in hand, scoreboard, round / match end, Play again resets, Lobby leaves; no page exceptions');
 process.exit(0);
})().catch(e=>{console.error(e);console.error(JSON.stringify(H.errors.slice(0,8)));process.exit(1);});
