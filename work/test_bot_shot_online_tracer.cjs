// Online remote tracers follow the server's real shot (bot-gun, user 2026-10-29: "i dont think the bullet is coming out of
// the right place for bots and i think their shots aren't going to their crosshair"). Real page (audit.js fake DOM) on the
// real worker module (tools/local-cluster.mjs), page_harness real three.js, 5v5: a teammate bot fires real server shots (Simulation.fire: the 's'
// event carries [dx,dy,dz,len], the first bullet's direction from the eye and its reach) at several views. For every
// shot the page's tracer (bFx):
//  - starts at that unit's drawn gun (third-person muzzle, else its drawn eye) - never the hip / a random point;
//  - runs along the server's ray: its end is the drawn eye + direction x reach (within 5 cm), and the direction the
//    page draws points there - not a random level ray along the drawn facing (was: v[3..6] did not exist).
// Knife swings draw no tracer.
//   node work/test_bot_shot_online_tracer.cjs
const {boot}=require('./page_harness.cjs');
const H=boot({real3:true,seed:5});
(async()=>{
 const xe=H.xe;
 const {localCluster}=await import('../server/tools/local-cluster.mjs');
 const cluster=await localCluster({env:{ALLOW_LOCAL_ORIGIN:'true',ENABLE_SPIKE:'true'}});let pending=0;
 class WS{constructor(url){const q=Object.fromEntries(new URL(url.replace(/^ws/,'http')).searchParams);this.readyState=0;const api=cluster.connect(q);this.api=api;pending++;let d=false;const done=()=>{if(!d){d=true;pending--;}};
  api.on('open',()=>{done();this.readyState=1;this.onopen&&this.onopen({});});api.on('message',m=>{if(this.readyState===1&&this.onmessage)this.onmessage({data:JSON.stringify(m)});});
  api.on('close',e=>{if(this.readyState===3)return;this.readyState=3;this.onclose&&this.onclose({code:e.code,reason:e.reason});});api.on('error',e=>{done();this.readyState=3;this.onclose&&this.onclose({code:1006,reason:String(e.message)});});}
  send(d){this.api.send(d);}close(){if(this.readyState===3)return;this.readyState=3;this.api.close();}}
 H.win.getComputedStyle=el=>{const st=(el&&el.style)||{},d=el&&el.id==='timer'?'none':st.display||(el&&el.hidden?'none':(el&&el.id==='result'?'none':'block'));return new Proxy({},{get:(t,k)=>k==='display'?d:k==='visibility'?(st.visibility||'visible'):k==='getPropertyValue'?(n=>st[n]||''):(st[k]||'')});};
 WS.OPEN=1;H.win.WebSocket=WS;H.win.fetch=()=>Promise.reject(new TypeError('Failed to fetch'));
 xe('nmEnsure=function(){return Promise.resolve(null);};window.xvAgentsReady=xvAgentsReady=function(){return Promise.resolve([]);};xvPreloadAgents=function(){};true');
 xe('clock.getDelta=(()=>{let t=performance.now();return ()=>{const n=performance.now(),d=(n-t)/1000;t=n;return d;};})();true');
 const settle=async()=>{const end=Date.now()+60000;const busy=()=>{if(pending>0)return true;const c=xe('MP.code'),r=c&&cluster.room(c);return !!r&&[...r.sessions.values()].some(s=>s.authenticating&&!s.u);};while(busy()&&Date.now()<end)await new Promise(r=>setTimeout(r,2));};
 const step=async ms=>{for(let t=0;t<ms;t+=50){await settle();await cluster.advance(50);H.advance(50);}};
 const until=async(c,ms,w)=>{for(let t=0;t<ms;t+=50){if(c())return;await step(50);}throw Error('timed out: '+w+' st '+xe('MP.st')+' errors '+JSON.stringify(H.errors.slice(0,3)));};
 const errs0=H.errors.length,fails=[];
 xe(`MP.name='PageQA';window.xQMap='ascent';MP.map='ascent';mpCreate(false,'five')`);
 await until(()=>xe('MP.st')==='room',8000,'room');const code=xe('MP.code');xe('mpStart()');
 await until(()=>xe('MP.st')==='game'&&xe('NET.ready')&&xe('running'),30000,'match start');
 const sim=cluster.room(code).sim;sim.buy=0.2;await until(()=>xe('FV.buy')<=0,8000,'buy phase over');
 for(const u of sim.units)if(!u.human)u.frozen=true;
 const me=sim.units.find(u=>u.human),A=sim.units.find(u=>u!==me&&u.team===me.team);
 A.weapon='Vandal';A.inventory={Vandal:1e6};A.ammo=1e6;A.reserve=0;A.reserves={Vandal:0};
 await step(400);
 // capture the page's tracers
 xe(`window.__T=[];window.__AID=${A.id};const f0=bFx;bFx=function(from,dir,hit,far){if(from&&dir){const u=mpCliSnap.units.get(__AID),q=u&&u.g?u.g.position:null;/* the teammate's drawn eye when the tracer is drawn */__T.push({o:[from.x,from.y,from.z],d:[dir.x,dir.y,dir.z],far:far||0,hp:hit&&hit.point?[hit.point.x,hit.point.y,hit.point.z]:null,eye:q?[q.x,(q.y||0)+1.6-(u.cr?.45:0),q.z]:null});}return f0.apply(this,arguments);};true`);
 const views=[[0,0],[.6,.05],[-.9,-.08],[2.2,.12],[3.4,-.03],[-2.5,.2],[1.3,0],[-.3,-.15]];let shots=0;
 for(const [lk,pt] of views){A.look=lk;A.pitch=pt;await step(400);/* the drawn body turns to the new view first (snapshot interpolation) */A.look=lk;A.pitch=pt;A.fireAt=0;A.triggerHeld=false;A.reloadAt=0;A.ammo=1e6;
  const n0=sim.events.length;const fired=sim.fire(A);const ev=sim.events.slice(n0).find(e=>e[0]==='s'&&e[1]===A.id);if(!fired||!ev){fails.push('server shot did not fire at view '+lk);continue;}
  xe('__T.length=0;true');await step(150);A.triggerHeld=false;
  if(ev.length<7){fails.push('server shot event without the ray: '+JSON.stringify(ev));continue;}shots++;
  const R=JSON.parse(xe(`(()=>{const u=mpCliSnap.units.get(${A.id});if(!u||!u.g)return "null";return JSON.stringify({T:__T.slice()});})()`));
  if(!R){fails.push('no drawn unit for the teammate');continue;}
  if(R.T.length!==1){fails.push('view '+lk+': '+R.T.length+' tracers for one shot');continue;}
  const T=R.T[0],eye=T.eye;/* the unit's drawn eye at the shot (it may have moved since) */if(!eye){fails.push('view '+lk+': teammate not drawn');continue;}const d=ev.slice(3,6),len=ev[6],want=[eye[0]+d[0]*len,eye[1]+d[1]*len,eye[2]+d[2]*len];
  const end=T.hp||[T.o[0]+T.d[0]*T.far,T.o[1]+T.d[1]*T.far,T.o[2]+T.d[2]*T.far];
  const de=Math.hypot(end[0]-want[0],end[1]-want[1],end[2]-want[2]);if(de>.05)fails.push('view '+lk+': tracer ends '+de.toFixed(2)+' m from eye + server ray x reach');
  const dO=Math.hypot(T.o[0]-eye[0],T.o[1]-eye[1],T.o[2]-eye[2]);if(dO>.9)fails.push('view '+lk+': tracer starts '+dO.toFixed(2)+' m from the drawn eye (not the gun)');
  const hb=T.o[1]-(eye[1]-1.6);if(!(hb>.9&&hb<1.75))fails.push('view '+lk+': tracer start height '+hb.toFixed(2));}
 // a knife swing draws none
 A.weapon='Knife';A.inventory={Knife:0,Vandal:1e6};A.fireAt=0;A.triggerHeld=false;xe('__T.length=0;true');sim.fire(A);await step(150);
 if(xe('__T.length')!==0)fails.push('knife swing drew '+xe('__T.length')+' tracers');
 if(shots<views.length)fails.push('shots with the ray: '+shots+'/'+views.length);
 xe('try{mpLeave()}catch(e){}1');await step(300);
 const errs=H.errors.slice(errs0);if(errs.length)fails.push('page exceptions '+JSON.stringify(errs.slice(0,3)));
 if(fails.length){console.error('FAIL:\n - '+fails.join('\n - '));process.exit(1);}
 console.log('Online remote tracers (real server): '+shots+' teammate shots - each tracer leaves the drawn gun and ends at the drawn eye + the server ray x reach (within 5 cm); knife swings draw none');process.exit(0);
})().catch(e=>{console.error(e);process.exit(1);});
