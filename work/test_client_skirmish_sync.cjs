// Online Skirmish 1v1: page in step with the server's rounds (user, live site: "can't move, stuck in place", "the round score at
// the top of the HUD is not updating", "movement is bugging out", "can't jump peek", "the buy also doesn't work"). The real page
// with its shared motor and native map (page_harness native) against the real game server in-process (local-cluster), page and
// server clocks in lockstep (the harness frame loop overshoots 50 ms steps, which reads as rubber-banding; it is pinned here).
// Server rules (server/src/modes.js SkirmishSimulation): walking is held in the buy phase only, jumping stays free; a gun change
// only in the buy phase; between rounds ('end', 3 s) the survivor walks; the match runs to the 20 min cap (SKM.cap).
//  1. top HUD round score boxes (#xSA / #xSE) and the subtitle (#xSub) follow the server's round score (they stayed 0 - 0 and
//     read 'Deathmatch · first to 5');
//  2. buy phase: no walking (page and server), but a jump goes up on the page as on the server (the page's hold also killed
//     the jump, so the server jumped while the page stayed down: a 0.8 m vertical snap each jump);
//  3. 'end' phase: the page walks as the server does (the page held walking in every phase but 'live' while the server
//     moved the player: the reconcile dragged the player around, ~1 m eases and snaps);
//  4. loadout: open in the buy phase, a pick reaches the server; the menu closes when the buy phase ends, and a pick outside
//     it is refused on the page too (the page kept the new gun until the server's refusal put the old one back);
//  5. live movement stays in step (no reconcile corrections above 0.25 m while running / strafe-jumping);
//  6. the server's clock is the Skirmish cap (start frame tl 1200), not Team Deathmatch's 9:30.
const assert=require('assert/strict');const {boot}=require('./page_harness.cjs');
function mulberry(seed){let a=seed>>>0;return ()=>{a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return ((t^t>>>14)>>>0)/4294967296;};}
Math.random=mulberry(7);const H=boot({real3:true,seed:31,native:true});
(async()=>{
 const xe=H.xe,$=id=>H.doc.getElementById(id),fails=[],out=[];const check=(ok,msg)=>{if(!ok)fails.push(msg);};
 const {localCluster}=await import('../server/tools/local-cluster.mjs');const cluster=await localCluster({env:{ALLOW_LOCAL_ORIGIN:'true'}});
 const codes=new Set(),starts=[];let pending=0;
 const settle=async()=>{const end=Date.now()+120000;const busy=()=>pending>0||[...codes].some(c=>{const r=cluster.room(c);return r&&[...r.sessions.values()].some(s=>s.authenticating&&!s.u);});while(busy()&&Date.now()<end)await new Promise(r=>setTimeout(r,2));};
 class WS{constructor(url){const q=Object.fromEntries(new URL(url.replace(/^ws/,'http')).searchParams);this.readyState=0;const api=cluster.connect(q);this.api=api;pending++;let settled=false;const done=()=>{if(!settled){settled=true;pending--;}};if(q.code)codes.add(q.code);
   api.on('open',()=>{done();this.readyState=1;this.onopen&&this.onopen({});});api.on('message',m=>{if(m&&m.t==='start')starts.push(m);if(this.readyState===1&&this.onmessage)this.onmessage({data:JSON.stringify(m)});});
   api.on('close',e=>{if(this.readyState===3)return;this.readyState=3;this.onclose&&this.onclose({code:e.code,reason:e.reason});});api.on('error',()=>{done();this.readyState=3;});}
  send(d){if(this.readyState!==1)throw Error('send on closed socket');this.api.send(d);}close(){if(this.readyState===3)return;this.readyState=3;this.api.close();}}
 WS.OPEN=1;H.win.WebSocket=WS;{const f0=H.win.fetch;H.win.fetch=function(u){u=String(u);if(/\/health$/.test(u))return cluster.fetch('/health');return f0(u);};}
 H.win.__ls=new Map();H.win.__ls.getItem=k=>H.win.__ls.has(k)?H.win.__ls.get(k):null;H.win.__ls.setItem=(k,v)=>H.win.__ls.set(k,String(v));H.win.__ls.removeItem=k=>H.win.__ls.delete(k);
 const errs0=H.errors.length,x0=H.xErrCalls.length;let tgt=null;
 // lockstep: one server tick, then the page brought to exactly the same elapsed time (H.advance(50) runs 4 frames = 66.7 ms)
 // in 25 ms slices (the 40 Hz room's step, net 3): 50 ms slices put the server a whole step ahead of the page, so a mid-slice
 // snapshot's input time + age lay past the page's clock and read as 0.135 m corrections (5.4 m/s x 25 ms)
 const step=async ms=>{for(let t=0;t<ms;t+=25){if(xe('MP.code'))codes.add(xe('MP.code'));await settle();await cluster.advance(25);if(tgt==null)tgt=xe('performance.now()');tgt+=25;const d=tgt-xe('performance.now()');if(d>1)H.advance(d);for(let i=0;i<3;i++)await new Promise(r=>setImmediate(r));}};
 const until=async(c,ms,w)=>{for(let t=0;t<ms;t+=50){if(c())return;await step(50);}throw Error('timed out: '+w+' (MP.st '+xe('MP.st')+' msg '+xe('MP.msg')+')');};
 const peer=(q,name)=>{codes.add(q.code);pending++;let settled=false;const done=()=>{if(!settled){settled=true;pending--;}};const s=cluster.connect(q);const h={room:null,send:m=>s.send(JSON.stringify(m))};s.on('message',m=>{if(m.t==='room')h.room=m;if(m.t==='start')h.send({t:'ready'});});s.on('open',()=>{done();h.send({t:'hi',n:name,ag:'Sova'});});s.on('error',done);return h;};
 xe("MP.name='PageLead';window.xQMap='ascent';MP.map='ascent';mpCreate(false,'skm');true");
 await until(()=>xe('MP.st')==='room'&&xe('NET.host')===true,10000,'room');const code=xe('MP.code');
 const M=peer({code},'Mate');await until(()=>M.room&&M.room.pl.length===2,8000,'second player');await step(300);xe('mpStart()');
 await until(()=>xe('MP.st')==='game'&&xe('NET.ready')&&xe('!!(MP.skm&&MP.skm.ph)'),90000,'Skirmish start');
 const S=cluster.room(code).sim,me=()=>S.units.find(u=>u.name===xe('MP.name')),foe=()=>S.units.find(u=>u.name==='Mate');
 // 6. match clock
 const st=starts.find(m=>m.mode==='skm');check(st&&st.tl===1200,'start frame clock is the Skirmish cap 1200 s (was '+(st&&st.tl)+')');check(S.remaining>1100,'server match clock '+S.remaining.toFixed(1)+' s (Skirmish cap 1200 s)');
 // reconcile log: the size of every correction the page applies to its own player
 xe("{const L=window.__fx=[];const s0=mpCliSelf;mpCliSelf=function(e){const r=s0.apply(this,arguments);L.push([NET.lastFix,NET.correction?Math.hypot(NET.correction.x,NET.correction.y,NET.correction.z):0]);return r;};}true");
 const hold=async(keys,ms)=>{xe('window.__fx.length=0;'+keys.map(k=>'keys.'+k+'=true;').join('')+'true');let peakY=-1e9,y0=xe('player.y'),sy0=me().y,speakY=-1e9;for(let t=0;t<ms;t+=50){await step(50);peakY=Math.max(peakY,xe('player.y'));speakY=Math.max(speakY,me().y);}xe(keys.map(k=>'keys.'+k+'=false;').join('')+'true');await step(300);
  const F=JSON.parse(xe('JSON.stringify(window.__fx)'));return {snaps:F.filter(f=>f[0]==='snap').length,maxC:Math.max(0,...F.map(f=>f[1])),rise:peakY-y0,srise:speakY-sy0};};
 const P=()=>xe('[player.x,player.z]'),dist=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
 // 2. buy phase: walking held, jump free (page = server)
 S.skm.t=Math.max(S.skm.t,6);await step(200);assert.equal(xe('MP.skm.ph'),'buy');
 {const p0=P(),s0=[me().x,me().z];const r=await hold(['KeyW'],600);check(dist(P(),p0)<.05&&dist([me().x,me().z],s0)<.05,'buy phase: no walking on the page or the server');}
 {const r=await hold(['Space'],500);check(r.srise>.5,'server jumps in the buy phase (rise '+r.srise.toFixed(2)+')');check(r.rise>.5,'buy phase: the page jumps as the server does (page rise '+r.rise.toFixed(2)+' m, server '+r.srise.toFixed(2)+' m)');check(r.snaps===0&&r.maxC<.25,'buy-phase jump without a reconcile snap (snaps '+r.snaps+', max correction '+r.maxC.toFixed(2)+' m)');}
 out.push('buy phase: walking held on page + server, jump free on both');
 // 4. loadout in the buy phase reaches the server; the menu closes when the buy phase ends; no pick after it
 H.dispatch(H.win,H.mkEvent('keydown',{code:'KeyB',key:'b'}));H.dispatch(H.win,H.mkEvent('keyup',{code:'KeyB',key:'b'}));await step(100);check(xe('!!DM.menu'),'B opens the loadout in the buy phase');
 {const b=H.doc.querySelector('.x-dmg [data-n="Phantom"]');check(!!b,'Phantom in the loadout');if(b)b.click();await step(400);check(me().weapon==='Phantom'&&me().kit.pri==='Phantom','buy-phase pick reaches the server (server holds '+me().weapon+')');}
 xe('dmMenu(true);true');check(xe('!!DM.menu'),'loadout reopens in the buy phase');
 S.skm.t=.05;await until(()=>xe('MP.skm.ph')==='live',3000,'live');await step(100);
 check(!xe('!!DM.menu'),'the loadout closes when the buy phase ends');
 {const r=xe('dmGive("Odin")');await step(400);check(xe('FV.pri')==='Phantom'&&xe('wName()')==='Phantom','a pick after the buy phase is refused on the page too (page FV.pri '+xe('FV.pri')+', in hand '+xe('wName()')+')');check(me().kit.pri==='Phantom','server kit unchanged');}
 out.push('loadout: buy-phase pick reaches the server, menu closes when the buy phase ends, no pick after it');
 // 5. live movement in step
 for(const [k,ms] of [[['KeyW'],1200],[['KeyD'],1200],[['KeyA','Space'],1000]]){const r=await hold(k,ms);check(r.snaps===0&&r.maxC<.25,'live '+k.join('+')+': page in step with the server (snaps '+r.snaps+', max correction '+r.maxC.toFixed(2)+' m)');}
 out.push('live: run / strafe / strafe-jump in step with the server');
 // 1. round score on the top HUD
 {const f=foe();f.hp=0;f.alive=false;f.deaths++;me().kills++;}
 await until(()=>xe('MP.skm.ph')==='end',4000,'round end');await step(100);
 check($('xSA').textContent==='1'&&$('xSE').textContent==='0','top HUD round score 1 - 0 (was '+$('xSA').textContent+' - '+$('xSE').textContent+')');
 check(/Skirmish 1v1/.test($('xSub').textContent)&&/first to 5/.test($('xSub').textContent),'top HUD subtitle names Skirmish 1v1 (was "'+$('xSub').textContent+'")');
 // 3. 'end' phase: the survivor walks on the server; the page walks with it
 {const p0=P(),s0=[me().x,me().z];const r=await hold(['KeyW'],900);const sd=dist([me().x,me().z],s0),pd=dist(P(),p0);check(sd>1,'server: the survivor walks between rounds ('+sd.toFixed(2)+' m)');check(pd>1&&r.snaps===0&&r.maxC<.25,'between rounds the page walks as the server (page '+pd.toFixed(2)+' m, server '+sd.toFixed(2)+' m, snaps '+r.snaps+', max correction '+r.maxC.toFixed(2)+' m)');}
 await until(()=>xe('MP.skm.ph')==='buy'&&xe('MP.skm.r')===2,8000,'round 2');
 check(/Round 2/.test($('xSub').textContent),'subtitle round 2');
 {const p0=P();const r=await hold(['KeyW'],400);check(dist(P(),p0)<.05,'round 2 buy phase: walking held again');}
 out.push('top HUD round score + subtitle, survivor walks between rounds on page + server, round 2 buy hold');
 xe("mpLeave('Left');true");await step(300);
 const errs=H.errors.slice(errs0),xerr=H.xErrCalls.slice(x0);check(errs.length===0,'page errors: '+JSON.stringify(errs.slice(0,3)));check(xerr.length===0,'xErr: '+JSON.stringify(xerr.slice(0,3)));
 if(fails.length){console.log('FAIL Skirmish sync ('+fails.length+'):\n - '+fails.join('\n - '));process.exit(1);}
 console.log('Skirmish 1v1 page/server sync: PASS\n  '+out.join('\n  '));process.exit(0);
})().catch(e=>{console.error(e);process.exit(1);});
