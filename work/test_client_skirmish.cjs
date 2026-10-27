// Skirmish 1v1 online, client side (user-approved queue item 9: "Online 1v1 Skirmish mode, Valorant-style"). The real page
// (page_harness fake DOM) against the real game server in-process (server/tools/local-cluster.mjs), as test_client_party_modes.cjs:
//  A. a server whose /health lacks 'skm' (the deployed worker until the owner deploys it): the Skirmish 1v1 button is disabled and
//     the Online panel says why (visible note + title).
//  B. the page leads: Skirmish 1v1 offered; a solo Start is refused with the reason; with a second player the leader selects it
//     (room mode follows, 1v1 note), Start runs it on the page's Deathmatch path with the server's rounds: HUD round score line
//     (YOU n - m ENEMY · FIRST TO 5 · ROUND r · phase), buy-phase hold (walking + shots held, loadout menu open only in the buy
//     phase), round banner, own death = out until the next round, no bots on the page, the 5th round win ends it with the
//     Skirmish result (Victory · 5 - 0 rounds).
const assert=require('assert/strict');
const {boot}=require('./page_harness.cjs');
const selFix=H=>{const s=H.doc.getElementById('xOnMap');Object.defineProperty(s,'value',{configurable:true,get(){return this._value!=null?this._value:'ascent';},set(v){this._value=String(v);}});};
function mulberry(seed){let a=seed>>>0;return ()=>{a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return ((t^t>>>14)>>>0)/4294967296;};}
Math.random=mulberry(7);const H=boot({real3:true,seed:31});selFix(H);
(async()=>{
 const xe=H.xe,$=id=>H.doc.getElementById(id),btn=m=>H.doc.querySelector('#xOn [data-om="'+m+'"]');
 const {localCluster}=await import('../server/tools/local-cluster.mjs');
 const cluster=await localCluster({env:{ALLOW_LOCAL_ORIGIN:'true'}});
 const sockets=[],codes=new Set(),sent=[];let pending=0;
 const settle=async()=>{const end=Date.now()+120000;const busy=()=>pending>0||[...codes].some(c=>{const r=cluster.room(c);return r&&[...r.sessions.values()].some(s=>s.authenticating&&!s.u);});while(busy()&&Date.now()<end)await new Promise(r=>setTimeout(r,2));};
 class WS{constructor(url){const q=Object.fromEntries(new URL(url.replace(/^ws/,'http')).searchParams);this.readyState=0;sockets.push(this);const api=cluster.connect(q);this.api=api;pending++;let settled=false;const done=()=>{if(!settled){settled=true;pending--;}};if(q.code)codes.add(q.code);
   api.on('open',()=>{done();this.readyState=1;this.onopen&&this.onopen({});});api.on('message',m=>{if(this.readyState===1&&this.onmessage)this.onmessage({data:JSON.stringify(m)});});
   api.on('close',e=>{if(this.readyState===3)return;this.readyState=3;this.onclose&&this.onclose({code:e.code,reason:e.reason});});api.on('error',e=>{done();this.readyState=3;this.onerror&&this.onerror(e);this.onclose&&this.onclose({code:1006,reason:String(e.message)});});}
  send(d){if(this.readyState!==1)throw Error('send on closed socket');const m=JSON.parse(d);if(!['in','hb','pi','lp'].includes(m.t))sent.push(m);this.api.send(d);}close(){if(this.readyState===3)return;this.readyState=3;this.api.close();}}
 WS.OPEN=1;H.win.WebSocket=WS;
 let health={ok:true,version:2,modes:['dm','tdm'],features:['party-mode','queue']};H.win.fetch=function(u){u=String(u);if(/\/health$/.test(u))return health?Promise.resolve({ok:true,json:async()=>health}):cluster.fetch('/health');return Promise.reject(new TypeError('Failed to fetch'));};
 H.win.__ls=new Map();H.win.__ls.getItem=k=>H.win.__ls.has(k)?H.win.__ls.get(k):null;H.win.__ls.setItem=(k,v)=>H.win.__ls.set(k,String(v));H.win.__ls.removeItem=k=>H.win.__ls.delete(k);
 xe('window.xvAgentsReady=xvAgentsReady=function(){return Promise.resolve([]);};xvPreloadAgents=function(){};true');
 const errs0=H.errors.length,x0=H.xErrCalls.length;
 const step=async ms=>{for(let t=0;t<ms;t+=50){if(xe('MP.code'))codes.add(xe('MP.code'));await settle();await cluster.advance(50);H.advance(50);for(let i=0;i<3;i++)await new Promise(r=>setImmediate(r));}};
 const until=async(cond,ms,what)=>{for(let t=0;t<ms;t+=50){if(cond())return;await step(50);}throw Error('timed out: '+what+' (MP.st '+xe('MP.st')+' mode '+xe('MP.mode')+' msg '+xe('MP.msg')+' hud '+(($('xGmHud')||{}).textContent)+' errors '+JSON.stringify(H.errors.slice(errs0,errs0+3))+')');};
 const peer=(q,name)=>{codes.add(q.code);pending++;let settled=false;const done=()=>{if(!settled){settled=true;pending--;}};const s=cluster.connect(q);const h={msgs:[],room:null,send:m=>s.send(JSON.stringify(m)),last:t=>h.msgs.filter(m=>m.t===t).at(-1),leave(){try{s.send(JSON.stringify({t:'bye'}));s.close();}catch(e){}}};s.on('message',m=>{h.msgs.push(m);if(m.t==='room')h.room=m;if(m.t==='start')h.send({t:'ready'});});s.on('open',()=>{done();h.send({t:'hi',n:name,ag:'Sova'});});s.on('error',done);return h;};
 const out=[],hud=()=>(($('xGmHud')||{}).textContent||'');
 // ---- A. old server ----
 xe("NET.health=null;NET.healthAt=0;mpUI();true");await until(()=>xe('!!NET.health'),3000,'old health');xe('mpUI();true');
 assert(btn('skm'),'Skirmish 1v1 button in the Online panel');assert.equal(btn('skm').textContent,'Skirmish 1v1');assert.equal(btn('skm').disabled,true,'disabled on a server without skm');
 assert.match(btn('skm').title,/updated game server/);assert($('xOnSkm')&&!$('xOnSkm').hidden,'visible note');assert.match($('xOnSkm').textContent,/Skirmish 1v1 needs the updated game server/);
 out.push('server without skm: button disabled, visible note + title say it needs the updated game server');
 // ---- B. the real server ----
 health=null;xe("NET.health=null;NET.healthAt=0;MP.name='PageLead';window.xQMap='ascent';MP.map='ascent';mpCreate(false,'tdm');true");
 await until(()=>xe('MP.st')==='room'&&xe('NET.host')===true&&xe('!!NET.health'),10000,'page room');const code=xe('MP.code');xe('mpUI();true');
 assert.equal(btn('skm').disabled,false,'offered by the leader');assert(!$('xOnSkm')||$('xOnSkm').hidden,'no note when offered and not selected');
 btn('skm').click();await until(()=>xe('MP.mode')==='skm'&&cluster.room(code).gm()==='skm',4000,'skm selected');assert.match($('xOnRoomM').textContent,/Skirmish 1v1/);assert.match($('xOnSkm').textContent,/two players, one per team · no bots · first to 5/);
 const n0=sent.length;$('xOnStart').click();await until(()=>/second player/.test(xe('MP.msg')||''),3000,'solo start refused');assert.equal(cluster.room(code).sim.phase,'room');assert(sent.slice(n0).some(m=>m.t==='queue'));
 const M=peer({code},'Mate');await until(()=>M.room&&M.room.pl.length===2&&xe('MP.room.pl.length')===2,8000,'member joined');
 $('xOnStart').click();await until(()=>xe('MP.st')==='game'&&xe('NET.ready'),40000,'Skirmish start');
 const R=cluster.room(code),S=R.sim;assert.equal(xe('MP.gm'),'skm');assert.equal(xe('FV.dm&&!FV.tdm'),true,'Deathmatch path (free loadout)');assert.equal(S.units.length,2);assert.equal(xe('bots.length+allies.length'),1,'one opponent, no bots');
 await until(()=>/^SKIRMISH 1V1 · YOU 0 – 0 ENEMY · FIRST TO 5 · ROUND 1 · BUY \d+s$/.test(hud()),5000,'HUD in the buy phase');
 assert.equal(xe('nmSkmHold()'),true,'held in the buy phase');xe("dmMenu(true);true");assert.equal(xe('!!DM.menu'),true,'loadout opens in the buy phase');assert.match(xe("DM.el.querySelector('.x-dmg__head h2').textContent"),/SKIRMISH 1V1/);xe("dmMenu(false);true");
 const p0=xe('JSON.stringify([player.x,player.z])');xe("keys.KeyW=true;true");await step(400);xe("keys.KeyW=false;true");assert.equal(xe('JSON.stringify([player.x,player.z])'),p0,'no walking in the buy phase');
 S.skm.t=.05;await until(()=>xe('MP.skm&&MP.skm.ph')==='live',3000,'live');assert.equal(xe('nmSkmHold()'),false);assert.match(hud(),/ROUND 1$/);xe("dmMenu(true);true");assert.equal(xe('!!DM.menu'),false,'no loadout change mid-round');
 const p1=xe('JSON.stringify([player.x,player.z])');xe("keys.KeyW=true;true");await step(400);xe("keys.KeyW=false;true");assert.notEqual(xe('JSON.stringify([player.x,player.z])'),p1,'walking once the round is live (control for the buy-phase hold)');
 const me=()=>S.units.find(u=>u.name===xe('MP.name')),foe=()=>S.units.find(u=>u.name==='Mate'),kill=(k,v)=>{v.hp=0;v.alive=false;v.deaths++;k.kills++;};
 kill(me(),foe());await until(()=>/YOU 1 – 0 ENEMY/.test(hud()),3000,'round score on the HUD');assert.match(hud(),/ROUND OVER/);assert.match(xe('toast.textContent'),/Round won · 1 – 0/);
 await until(()=>xe('MP.skm.ph')==='buy'&&xe('MP.skm.r')===2,6000,'round 2');assert.match(hud(),/ROUND 2 · BUY/);
 S.skm.t=.05;await until(()=>xe('MP.skm.ph')==='live',3000,'live 2');kill(foe(),me());await until(()=>xe('player.hp')<=0,3000,'page player out');await step(300);assert.match(hud(),/YOU 1 – 1 ENEMY/);
 await step(1500);assert.equal(xe('player.hp'),0,'no respawn inside the round');await until(()=>xe('MP.skm.r')===3&&xe('player.hp')>0,6000,'back next round');
 for(let r=0;r<4;r++){S.skm.t=.05;await until(()=>xe('MP.skm.ph')==='live',3000,'live '+r);kill(me(),foe());if(r<3)await until(()=>xe('MP.skm.ph')==='buy',6000,'next '+r);}
 await until(()=>xe('MP.st')==='post',5000,'match end');assert.equal($('resTitle').textContent,'Victory');assert.match($('resText').innerHTML,/^Skirmish 1v1 · 5 – 1 rounds · first to 5/);assert.equal(S.units.filter(u=>!u.human).length,0);
 out.push('leader: solo start refused with the reason, Skirmish selected live, starts on the Deathmatch path vs the one opponent, HUD round score / round / phase, buy-phase hold + loadout menu buy-only, round banner, own death out until next round, 5th round win -> Victory 5 - 1');
 xe("mpLeave('Left');true");await step(300);M.leave();await step(200);assert.equal(($('xGmHud')||{style:{}}).style.display,'none','HUD cleared');
 const errs=H.errors.slice(errs0),xerr=H.xErrCalls.slice(x0);assert.equal(errs.length,0,'page errors: '+JSON.stringify(errs.slice(0,3)));assert.equal(xerr.length,0,'xErr: '+JSON.stringify(xerr.slice(0,3)));
 console.log('Skirmish 1v1 (client): PASS\n  '+out.join('\n  '));process.exit(0);
})().catch(e=>{console.error(e);process.exit(1);});
