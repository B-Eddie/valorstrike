// Online TDM spawn room, page prediction = server (mpsweep 2026-10-29). Server (tdmrooms.js): a unit's own room, once left,
// refuses re-entry (roomBlocked) from the tick after it stepped out, and a respawn clears that (roomSpawn). The page took
// "left" only from the server's roundState (rs room timer, a round trip later) and never cleared it on a respawn, so a walk
// back into the ring just after leaving went in on the page and was refused on the server (a ~1 m reconcile snap at the ring,
// 3-5 per 75 s TDM in the mpsweep probe), and after a respawn the page could hold the player out of its own room.
// Real page (native map, shared motor) <-> real server, clocks in lockstep:
//  1. walk out of the own room, turn round, walk back in: the page is held at the ring as the server is (no snap);
//  2. die and respawn in the room: the page walks inside its room again in step with the server.
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
 const step=async ms=>{for(let t=0;t<ms;t+=50){if(xe('MP.code'))codes.add(xe('MP.code'));await settle();await cluster.advance(50);if(tgt==null)tgt=xe('performance.now()');tgt+=50;const d=tgt-xe('performance.now()');if(d>1)H.advance(d);for(let i=0;i<3;i++)await new Promise(r=>setImmediate(r));}};
 const until=async(c,ms,w)=>{for(let t=0;t<ms;t+=50){if(c())return;await step(50);}throw Error('timed out: '+w+' (MP.st '+xe('MP.st')+' msg '+xe('MP.msg')+')');};
 const peer=(q,name)=>{codes.add(q.code);pending++;let settled=false;const done=()=>{if(!settled){settled=true;pending--;}};const s=cluster.connect(q);const h={room:null,send:m=>s.send(JSON.stringify(m))};s.on('message',m=>{if(m.t==='room')h.room=m;if(m.t==='start')h.send({t:'ready'});});s.on('open',()=>{done();h.send({t:'hi',n:name,ag:'Sova'});});s.on('error',done);return h;};
 xe("MP.name='PageLead';window.xQMap='ascent';MP.map='ascent';mpCreate(false,'tdm');true");
 await until(()=>xe('MP.st')==='room'&&xe('NET.host')===true,10000,'room');const code=xe('MP.code');xe('mpStart()');
 await until(()=>xe('MP.st')==='game'&&xe('NET.ready'),90000,'TDM start');await step(1500);
 const R=cluster.room(code),S=R.sim,me=()=>S.units.find(u=>u.name===xe('MP.name'));for(const u of S.units)if(u!==me()){u.hp=0;u.alive=false;u.respawnAt=1e9;}/* nobody else: the room rule alone */
 const home=()=>{const d=JSON.parse(xe('JSON.stringify(TDMROOM.defs)')).find(d=>d[4]===xe('MP.team'));return d;};
 xe("{const L=window.__fx=[];const s0=mpCliSelf;mpCliSelf=function(e){const r=s0.apply(this,arguments);L.push([NET.lastFix,NET.correction?Math.hypot(NET.correction.x,NET.correction.y,NET.correction.z):0]);return r;};}true");
 const face=(x,z)=>{const p=xe('[player.x,player.z]');xe('yaw='+Math.atan2(-(x-p[0]),-(z-p[1]))+';pitch=0;true');};
 const hold=async ms=>{xe('window.__fx.length=0;keys.KeyW=true;true');for(let t=0;t<ms;t+=50)await step(50);xe('keys.KeyW=false;true');await step(400);const F=JSON.parse(xe('JSON.stringify(window.__fx)'));return {snaps:F.filter(f=>f[0]==='snap').length,maxC:Math.max(0,...F.map(f=>f[1]))};};
 const d=home();check(!!d,'page has the TDM room defs');const dist=()=>Math.hypot(me().x-d[0],me().z-d[2]);check(dist()<d[3],'spawned inside the own room ('+dist().toFixed(2)+' m)');
 // 1. out, then back in
 {const p=xe('[player.x,player.z]');const ax=p[0]-d[0],az=p[1]-d[2],n=Math.hypot(ax,az)||1;face(d[0]+ax/n*30,d[2]+az/n*30);let t=0;xe('keys.KeyW=true;true');while(Math.hypot(xe('player.x')-d[0],xe('player.z')-d[2])<d[3]+.45&&t<8000){await step(50);t+=50;const q=xe('[player.x,player.z]');face(d[0]+(q[0]-d[0])*30,d[2]+(q[1]-d[2])*30);}
  check(Math.hypot(xe('player.x')-d[0],xe('player.z')-d[2])>=d[3]+.4,'walked out of the own room ('+dist().toFixed(2)+' m)');face(d[0],d[2]);/* straight back in, no pause: before the server's rs room timer says 'left' */const r=await hold(1500);
  const pd=Math.hypot(xe('player.x')-d[0],xe('player.z')-d[2]);check(dist()>=d[3]-.05,'server refuses re-entry ('+dist().toFixed(2)+' m)');
  check(r.snaps===0&&r.maxC<.3&&pd>=d[3]-.05,'page held at the ring like the server (page '+pd.toFixed(2)+' m, server '+dist().toFixed(2)+' m, snaps '+r.snaps+', max correction '+r.maxC.toFixed(2)+' m)');out.push('re-entry: page '+pd.toFixed(2)+' m server '+dist().toFixed(2)+' m snaps '+r.snaps+' maxC '+r.maxC.toFixed(2));}
 // 2. respawn in the room, walk inside it
 {const u=me();u.hp=0;u.alive=false;u.deaths++;u.respawnAt=S.time+.5;await until(()=>me().alive&&xe('player.hp')>0,8000,'respawn');/* walk at once: the first second after a respawn */check(dist()<d[3],'respawned in the room ('+dist().toFixed(2)+' m)');
  const p0=xe('[player.x,player.z]'),s0=[me().x,me().z];face(d[0]+(p0[0]-d[0])*-1,d[2]+(p0[1]-d[2])*-1);const r=await hold(700);const pm=Math.hypot(xe('player.x')-p0[0],xe('player.z')-p0[1]),sm=Math.hypot(me().x-s0[0],me().z-s0[1]);
  check(sm>.8,'server walks inside the room after the respawn ('+sm.toFixed(2)+' m)');check(pm>.8&&r.snaps===0&&r.maxC<.3,'page walks inside its room after the respawn in step (page '+pm.toFixed(2)+' m, server '+sm.toFixed(2)+' m, snaps '+r.snaps+', max correction '+r.maxC.toFixed(2)+' m)');out.push('respawn walk: page '+pm.toFixed(2)+' server '+sm.toFixed(2)+' snaps '+r.snaps+' maxC '+r.maxC.toFixed(2));}
 // 3. leaving the room while the server is a little ahead (a push / a tick of lead): the server's "left" arrives while the
 //    page's predicted player is still inside the ring. The page used to take "left" from it at once and then held its own
 //    player inside its own room (every step inside refused) until a reconcile snap pulled it out.
 {const u=me();u.hp=0;u.alive=false;u.deaths++;u.respawnAt=S.time+.5;await until(()=>me().alive&&xe('player.hp')>0,8000,'respawn 2');await step(300);
  const p=xe('[player.x,player.z]'),ax=p[0]-d[0],az=p[1]-d[2],n=Math.hypot(ax,az)||1,ux=ax/n,uz=az/n;face(d[0]+ux*40,d[2]+uz*40);xe('window.__fx.length=0;keys.KeyW=true;true');let pushed=false;
  for(let t=0;t<2500;t+=50){await step(50);const q=xe('[player.x,player.z]');if(!pushed&&Math.hypot(q[0]-d[0],q[1]-d[2])>=d[3]-.9){const v=me();v.x+=ux*.75;v.z+=uz*.75;pushed=true;}}
  xe('keys.KeyW=false;true');await step(400);const F=JSON.parse(xe('JSON.stringify(window.__fx)')),snaps=F.filter(f=>f[0]==='snap').length,pd=Math.hypot(xe('player.x')-d[0],xe('player.z')-d[2]);
  check(pushed,'server unit pushed ahead at the ring');check(snaps===0&&pd>d[3]+3,'page leaves its room with the server ahead without being held inside (page '+pd.toFixed(2)+' m, server '+dist().toFixed(2)+' m, snaps '+snaps+')');out.push('leave with server ahead: page '+pd.toFixed(2)+' server '+dist().toFixed(2)+' snaps '+snaps);}
 const errs=H.errors.slice(errs0),xerr=H.xErrCalls.slice(x0);check(errs.length===0,'page errors: '+JSON.stringify(errs.slice(0,3)));check(xerr.length===0,'xErr: '+JSON.stringify(xerr.slice(0,3)));
 if(fails.length){console.log('FAIL online TDM spawn room prediction ('+fails.length+'):\n - '+fails.join('\n - ')+'\n  '+out.join('\n  '));process.exit(1);}
 console.log('Online TDM spawn room: page prediction = server (re-entry refused, respawn clears it): PASS\n  '+out.join('\n  '));process.exit(0);
})().catch(e=>{console.error(e);process.exit(1);});
