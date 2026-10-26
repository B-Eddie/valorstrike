// Party mode switching and the new online modes, client side (modes-1; user 2026-10-26: "add more gamemodes for multiplayer and
// make it so you can change gamemode when in a team"). The real page (page_harness fake DOM) talks to the real game server
// (server/src/worker.js in-process via server/tools/local-cluster.mjs, as test_map_select_online.cjs does); /health is answered
// by the cluster, so the page sees the server's modes and lobby features.
//  A. page = party leader: the Online panel offers Escalation / Swiftplay / Spike Rush / Replication; a click on a mode changes
//     the room for the member live; START queues (member sees the countdown, the page shows Cancel); a mode change cancels the
//     queue (the page says why); the map select changes the room map; the queued start runs the selected mode: Escalation
//     plays with the server's levels on the page HUD.
//  B. page = member: every mode button and the map select are read-only (titled for the leader), no START; the leader's mode
//     change and queue reach the page live; a forced click sends nothing.
//  C. a server without the lobby features (old /health): new modes disabled, START sends the immediate 'start'.
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const {boot}=require('./page_harness.cjs');
const selFix=H=>{const s=H.doc.getElementById('xOnMap');Object.defineProperty(s,'value',{configurable:true,get(){return this._value!=null?this._value:'ascent';},set(v){this._value=String(v);}});};
function mulberry(seed){let a=seed>>>0;return ()=>{a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return ((t^t>>>14)>>>0)/4294967296;};}
Math.random=mulberry(5);const H=boot({real3:true,seed:29});selFix(H);
(async()=>{
 const xe=H.xe,$=id=>H.doc.getElementById(id),btn=m=>H.doc.querySelector('#xOn [data-om="'+m+'"]');
 const {localCluster}=await import('../server/tools/local-cluster.mjs');
 const cluster=await localCluster({env:{ALLOW_LOCAL_ORIGIN:'true',ENABLE_SPIKE:'true'}});
 const sockets=[],codes=new Set(),sent=[];let pending=0;
 const settle=async()=>{const end=Date.now()+120000;const busy=()=>pending>0||[...codes].some(c=>{const r=cluster.room(c);return r&&[...r.sessions.values()].some(s=>s.authenticating&&!s.u);});while(busy()&&Date.now()<end)await new Promise(r=>setTimeout(r,2));};
 class WS{constructor(url){const q=Object.fromEntries(new URL(url.replace(/^ws/,'http')).searchParams);this.readyState=0;sockets.push(this);const api=cluster.connect(q);this.api=api;pending++;let settled=false;const done=()=>{if(!settled){settled=true;pending--;}};if(q.code)codes.add(q.code);
   api.on('open',()=>{done();this.readyState=1;this.onopen&&this.onopen({});});api.on('message',m=>{if(this.readyState===1&&this.onmessage)this.onmessage({data:JSON.stringify(m)});});
   api.on('close',e=>{if(this.readyState===3)return;this.readyState=3;this.onclose&&this.onclose({code:e.code,reason:e.reason});});api.on('error',e=>{done();this.readyState=3;this.onerror&&this.onerror(e);this.onclose&&this.onclose({code:1006,reason:String(e.message)});});}
  send(d){if(this.readyState!==1)throw Error('send on closed socket');const m=JSON.parse(d);if(!['in','hb','pi','lp'].includes(m.t))sent.push(m);this.api.send(d);}close(){if(this.readyState===3)return;this.readyState=3;this.api.close();}}
 WS.OPEN=1;H.win.WebSocket=WS;
 let health=null;H.win.fetch=function(u){u=String(u);if(/\/health$/.test(u))return health?Promise.resolve({ok:true,json:async()=>health}):cluster.fetch('/health');return Promise.reject(new TypeError('Failed to fetch'));};
 H.win.__ls=new Map();H.win.__ls.getItem=k=>H.win.__ls.has(k)?H.win.__ls.get(k):null;H.win.__ls.setItem=(k,v)=>H.win.__ls.set(k,String(v));H.win.__ls.removeItem=k=>H.win.__ls.delete(k);
 xe('window.xvAgentsReady=xvAgentsReady=function(){return Promise.resolve([]);};xvPreloadAgents=function(){};true');
 const errs0=H.errors.length,x0=H.xErrCalls.length;
 const step=async ms=>{for(let t=0;t<ms;t+=50){if(xe('MP.code'))codes.add(xe('MP.code'));await settle();await cluster.advance(50);H.advance(50);for(let i=0;i<3;i++)await new Promise(r=>setImmediate(r));}};
 const until=async(cond,ms,what)=>{for(let t=0;t<ms;t+=50){if(cond())return;await step(50);}throw Error('timed out: '+what+' (MP.st '+xe('MP.st')+' mode '+xe('MP.mode')+' msg '+xe('MP.msg')+' room '+xe('JSON.stringify(MP.room)')+' errors '+JSON.stringify(H.errors.slice(errs0,errs0+3))+')');};
 const peer=(q,name)=>{codes.add(q.code);pending++;let settled=false;const done=()=>{if(!settled){settled=true;pending--;}};const s=cluster.connect(q);const h={msgs:[],room:null,send:m=>s.send(JSON.stringify(m)),last:t=>h.msgs.filter(m=>m.t===t).at(-1),leave(){try{s.send(JSON.stringify({t:'bye'}));s.close();}catch(e){}}};s.on('message',m=>{h.msgs.push(m);if(m.t==='room')h.room=m;if(m.t==='start')h.send({t:'ready'});});s.on('open',()=>{done();h.send({t:'hi',n:name,ag:'Sova'});});s.on('error',done);return h;};
 const out=[];const text=id=>$(id).textContent||'';
 // ---- A. page leads ----
 xe("MP.name='PageLead';window.xQMap='ascent';MP.map='ascent';NET.health=null;NET.healthAt=0;mpCreate(false,'tdm');true");
 await until(()=>xe('MP.st')==='room'&&xe('NET.host')===true,10000,'page room');await until(()=>xe('!!NET.health'),3000,'health');const code=xe('MP.code');
 for(const m of ['dm','tdm','esc','five','swift','sr','rep'])assert(btn(m),'Online mode button '+m);
 const M=peer({code},'Mate');await until(()=>M.room&&M.room.pl.length===2&&xe('MP.room.pl.length')===2,8000,'member joined');
 for(const m of ['esc','swift','sr','rep'])assert.equal(btn(m).disabled,false,m+' selectable by the leader in the room');assert.equal($('xOnMap').disabled,false,'leader can change the map');
 btn('esc').click();await until(()=>M.room.mode==='esc'&&xe('MP.mode')==='esc',4000,'esc reaches the member');assert.match(text('xOnRoomM'),/Escalation/);assert.equal(btn('esc').getAttribute('aria-pressed'),'true');assert.equal(cluster.room(code).gm(),'esc');
 $('xOnStart').click();await until(()=>M.room.q>0&&xe('MP.room.q')>0,3000,'queue');assert.match(text('xOnWait'),/Match starts in \d s/);assert.match(text('xOnStart'),/Cancel queue/);assert(sent.some(m=>m.t==='queue'&&m.on===1));
 btn('swift').click();await until(()=>M.room.mode==='swift'&&M.room.q===0&&xe('MP.room.q')===0&&M.last('qx'),4000,'mode change cancels the queue');await step(200);assert.match(xe('MP.msg'),/cancelled/i);assert.match(text('xOnStart'),/^Start/);
 $('xOnStart').click();await until(()=>M.room.q>0,3000,'requeue');$('xOnStart').click();await until(()=>M.room.q===0,3000,'leader cancels');assert(sent.some(m=>m.t==='queue'&&m.on===0));
 $('xOnMap').value='bind';$('xOnMap').dispatchEvent(new H.win.Event('change'));await until(()=>M.room.map==='bind'&&xe('MP.room.map')==='bind',60000,'map change');assert.equal(cluster.room(code).sim.map,'bind');
 btn('esc').click();await until(()=>M.room.mode==='esc',4000,'esc again');$('xOnStart').click();
 await until(()=>xe('MP.st')==='game'&&xe('NET.ready'),40000,'queued Escalation start');assert.equal(xe('MP.gm'),'esc');assert.equal(xe('FV.map'),'bind','plays the selected map');
 await until(()=>/ESCALATION · LV 1\/12 ODIN/.test(($('xGmHud')||{}).textContent||''),5000,'Escalation HUD');const R=cluster.room(code);const me=R.sim.units.find(u=>u.name===xe('MP.name'));assert.equal(me.weapon,'Odin');
 const foe=R.sim.units.find(u=>u.team!==me.team);for(let i=0;i<7;i++)R.sim.onGunKill(me,foe);await until(()=>/LV 2\/12 ARES/.test($('xGmHud').textContent),3000,'level 2 on the page');await until(()=>xe('wName()')==='Ares',3000,'page holds the level weapon');
 xe("dmMenu(true);true");assert.equal(xe('!!DM.menu'),false,'no buy menu in Escalation');
 out.push('leader: new modes offered, mode / map change live to the member, queue + cancel on change, queued Escalation start on the chosen map with the level HUD and weapon');
 xe("mpLeave('Left');true");await step(500);M.leave();await step(200);assert.equal(($('xGmHud')||{style:{}}).style.display,'none','HUD cleared on leave');
 // ---- B. page is a member ----
 const L=peer({create:1,code:'PARTYC',mode:'tdm',map:'ascent'},'Lead');await until(()=>L.room,10000,'leader room');xe("mpJoin('PARTYC');true");await until(()=>xe('MP.st')==='room'&&xe('(MP.room&&MP.room.pl||[]).length')===2,10000,'page joined');
 assert.equal(xe('NET.host'),false);for(const m of ['dm','tdm','esc','swift']){assert.equal(btn(m).disabled,true,m+' read-only for a member');}assert.match(btn('esc').title,/party leader/);assert.equal($('xOnMap').disabled,true);assert.equal($('xOnStart').hidden,true,'no START for a member');
 L.send({t:'mode',mode:'sr'});await until(()=>xe('MP.mode')==='sr'&&btn('sr').getAttribute('aria-pressed')==='true',4000,'leader change reaches the page');assert.match(text('xOnRoomM'),/Spike Rush/);
 L.send({t:'queue'});await until(()=>/Match starts in \d s/.test(text('xOnWait')),3000,'member sees the countdown');L.send({t:'mode',mode:'dm'});await until(()=>xe('MP.mode')==='dm'&&/cancelled/i.test(xe('MP.msg')),4000,'member told the queue was cancelled');
 const n0=sent.length;xe("mpEl('xOn').querySelector('[data-om=\"esc\"]').disabled=false;true");btn('esc').click();await step(300);assert(!sent.slice(n0).some(m=>m.t==='mode'),'a member click sends nothing');assert.equal(cluster.room('PARTYC').gm(),'dm');
 out.push('member: buttons / map read-only, no START, leader mode change + countdown + cancel reach the page live, forced click sends nothing');
 xe("mpLeave('Left');true");await step(300);L.leave();await step(200);
 // ---- D. Spike round variants start on the page (Unrated path + server rules) ----
 for(const gm of ['swift','sr','rep']){xe(`MP.name='PageV';window.xQMap='ascent';MP.map='ascent';J.pick='Jett';mpCreate(false,'${gm}');true`);await until(()=>xe('MP.st')==='room'&&xe('NET.host')===true,10000,gm+' room');const c=xe('MP.code');const F=peer({code:c},'Friend');await until(()=>F.room&&F.room.pl.length===2,8000,gm+' friend');
  if(gm==='rep'){const S0=cluster.room(c).sim;S0.replicate=function(){this.repAgent={0:'Sova',1:'Sova'};for(const u of this.units)u.agent='Sova';};}/* the vote lands on another agent than the page's own pick */
  $('xOnStart').click();await until(()=>xe('MP.st')==='game'&&xe('NET.ready')&&xe('MP.m5')===1,40000,gm+' start');const S=cluster.room(c).sim;assert.equal(S.gm,gm);
  const name={swift:'SWIFTPLAY · FIRST TO 5',sr:'SPIKE RUSH · FIRST TO 4',rep:'REPLICATION · FIRST TO 5'}[gm];await until(()=>(($('xGmHud')||{}).textContent||'').startsWith(name),5000,gm+' HUD');
  if(gm==='rep'){const u=S.units.find(u=>u.name===xe('MP.name'));assert.equal(u.agent,'Sova');assert.equal(xe('J.pick'),'Sova','page plays the team agent');assert.equal(S.repAgent[u.team],u.agent);}
  if(gm==='sr'){S.buy=Math.min(S.buy,.5);await until(()=>xe('NM_ORBS.size')>0,5000,'orbs drawn');assert.equal(xe('NM_ORBS.size'),S.orbs.length);assert.match($('xGmHud').textContent,/FOR EVERYONE/);}
  xe("mpLeave('Left');true");await step(300);F.leave();await step(200);if(gm==='rep')assert.equal(xe('J.pick'),'Jett','own pick back after Replication');}
 out.push('swiftplay / spike rush / replication start on the page with their HUD; Spike Rush orbs drawn from the server; Replication plays the team agent, own pick restored after');
 // ---- C. older server ----
 health={ok:true,version:2,modes:['dm','tdm']};xe("NET.health=null;NET.healthAt=0;mpUI();true");await step(200);await until(()=>xe('!!NET.health'),3000,'old health');
 for(const m of ['esc','swift','sr','rep','five'])assert.equal(btn(m).disabled,true,m+' disabled on an older server');assert.equal(btn('tdm').disabled,false);assert.match(btn('esc').title,/Not offered/);
 xe("MP.name='PageOld';mpCreate(false,'tdm');true");await until(()=>xe('MP.st')==='room'&&xe('NET.host')===true,10000,'old room');const n1=sent.length;$('xOnStart').click();await until(()=>xe('MP.st')==='game',40000,'immediate start');assert(sent.slice(n1).some(m=>m.t==='start')&&!sent.slice(n1).some(m=>m.t==='queue'),'old server: immediate start');
 out.push('older server: new modes disabled with a reason, START sends the immediate start');
 xe("mpLeave('Left');true");await step(300);
 const errs=H.errors.slice(errs0),xerr=H.xErrCalls.slice(x0);assert.equal(errs.length,0,'page errors: '+JSON.stringify(errs.slice(0,3)));assert.equal(xerr.length,0,'xErr: '+JSON.stringify(xerr.slice(0,3)));
 console.log('Party modes (client): PASS\n  '+out.join('\n  '));process.exit(0);
})().catch(e=>{console.error(e);process.exit(1);});
