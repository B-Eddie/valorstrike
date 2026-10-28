// End-to-end probe (a tool, not in test_all): the real page online against the real game server (local-cluster, as
// work/test_client_online.cjs) at RTT 2 x DELAY ms. Two scripted humans hunt and shoot the page player, which strafes
// A/D the whole time (kept alive server-side). Counts the server's hits on the page player and, page-side, every
// netReconcile verdict (snap > 1 m / eased / kept) with the authority error it saw. NOFIX=1 disables the page's
// netHitTagSelf (the client then runs untagged after a hit, as before the fix).
//   node work/probe_net_hit_tag.cjs [--json out.json]     env: DELAY (one-way ms, default 50), SECS (default 20), NOFIX, SEED
const fs=require('fs'),path=require('path');
const arg=k=>{const i=process.argv.indexOf(k);return i>0?process.argv[i+1]:null;},OUT=arg('--json'),DELAY=+(process.env.DELAY||50),SECS=+(process.env.SECS||20),SEED=+(process.env.SEED||7);
// page_harness native: the page keeps its VALORANT FEEL motor (the shared motor the server runs) and native Ascent collision
const H=require('./page_harness.cjs').boot({real3:true,seed:SEED,native:true,fastGlobal:true});
function mulberry(seed){let a=seed>>>0;return ()=>{a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return ((t^t>>>14)>>>0)/4294967296;};}
Math.random=mulberry(SEED*104729+1);
(async()=>{
 const xe=H.xe;
 const {localCluster}=await import('../server/tools/local-cluster.mjs');const {ScriptedHuman}=await import('../server/tools/scripted-human.mjs');const {loadWorld}=await import('../server/src/world.js');
 const cluster=await localCluster({env:{ALLOW_LOCAL_ORIGIN:'true'}});const world=await loadWorld(cluster.env.ASSETS,'ascent');
 const codes=new Set(),transit=[];let pending=0,linkDelay=0;
 const relay=(ws,fn)=>{if(linkDelay)transit.push({at:cluster.clock.now()+linkDelay,ws,fn});else fn();};
 const flush=()=>{for(let i=0;i<transit.length;)if(transit[i].at<=cluster.clock.now()){const q=transit.splice(i,1)[0];if(q.ws.readyState===1)q.fn();}else i++;};
 const settle=async()=>{const end=Date.now()+120000;const busy=()=>pending>0||[...codes].some(c=>{const r=cluster.room(c);return r&&[...r.sessions.values()].some(s=>s.authenticating&&!s.u);});while(busy()&&Date.now()<end)await new Promise(r=>setTimeout(r,2));};
 class WS{constructor(url){const q=Object.fromEntries(new URL(url.replace(/^ws/,'http')).searchParams);this.readyState=0;const api=cluster.connect(q);this.api=api;pending++;let s=false;const done=()=>{if(!s){s=true;pending--;}};if(q.code)codes.add(q.code);
   api.on('open',()=>{done();this.readyState=1;this.onopen&&this.onopen({});});api.on('message',m=>relay(this,()=>{if(this.readyState===1&&this.onmessage)this.onmessage({data:JSON.stringify(m)});}));
   api.on('close',e=>{if(this.readyState===3)return;this.readyState=3;this.onclose&&this.onclose({code:e.code,reason:e.reason});});api.on('error',e=>{done();this.readyState=3;this.onerror&&this.onerror(e);this.onclose&&this.onclose({code:1006,reason:String(e.message)});});}
  send(d){if(this.readyState!==1)throw Error('closed');relay(this,()=>{if(this.readyState===1)this.api.send(d);});}close(){if(this.readyState===3)return;this.readyState=3;this.api.close();}}
 WS.OPEN=1;H.win.WebSocket=WS;
 H.win.__ls=new Map();H.win.__ls.getItem=k=>H.win.__ls.has(k)?H.win.__ls.get(k):null;H.win.__ls.setItem=(k,v)=>H.win.__ls.set(k,String(v));H.win.__ls.removeItem=k=>H.win.__ls.delete(k);

 xe(`window.__TG={n:0,rem:[]};{const f=netHitTagSelf;netHitTagSelf=function(e,m){const r=f.apply(this,arguments);if(r){__TG.n++;__TG.rem.push(+player.tagT.toFixed(3));}return r;};}true`);
 if(process.env.NOFIX)xe('netHitTagSelf=function(){return false;};true');
 xe(`window.__RC={snap:0,eased:0,kept:0,other:0,err:[]};{const f=netReconcile;netReconcile=function(e,ref){const r=f.apply(this,arguments);const eh=Math.hypot(e[4]-ref.x,e[6]-ref.z);if(r in __RC)__RC[r]++;else __RC.other++;__RC.err.push(+eh.toFixed(3));return r;};}true`);
 const step=async ms=>{for(let t=0;t<ms;t+=50){if(xe('MP.code'))codes.add(xe('MP.code'));await settle();flush();await cluster.advance(50);flush();H.advance(50);}};
 const until=async(c,ms,w)=>{for(let t=0;t<ms;t+=50){if(c())return;await step(50);}throw Error('timed out: '+w);};
 const join=(code,name,agent,target)=>{const h=new ScriptedHuman({name,agent,world,target});codes.add(code);pending++;let s=false;const done=()=>{if(!s){s=true;pending--;}};const so=cluster.connect({code});h.attach(so);so.on('message',m=>h.receive(m));so.on('open',()=>{done();h.hello();});so.on('error',done);return h;};
 xe(`MP.name='PageQA';window.xQMap='ascent';MP.map='ascent';mpCreate(false,'dm')`);await until(()=>xe('MP.st')==='room',8000,'room');const code=xe('MP.code');
 join(code,'FuzzB','Sova','PageQA');join(code,'FuzzC','Reyna','PageQA');
 await until(()=>xe('(MP.room&&MP.room.pl||[]).length')===3,8000,'joined');xe('mpStart()');await until(()=>xe('MP.st')==='game'&&xe('NET.ready'),20000,'start');
 const room=cluster.room(code),sim=room.sim,me=()=>sim.units.find(u=>u.name==='PageQA');
 // only the two hunters shoot the page player: server bots leave it alone so the hit count is comparable run to run
 const hits={n:0,tagged:0};{const h0=sim.applyHit;sim.applyHit=function(u,t){const r=h0.apply(this,arguments);if(t&&t.name==='PageQA'){hits.n++;}return r;};}
 for(const u of sim.units)if(!u.human)u.bot=u.bot;await step(1500);
 linkDelay=DELAY;await step(1000);xe('__RC.snap=0;__RC.eased=0;__RC.kept=0;__RC.other=0;__RC.err=[];true');hits.n=0;
 const t0=Date.now();
 for(let t=0;t<SECS*1000;t+=50){const u=me();if(u){u.hp=100;u.armor=0;u.alive=true;if(process.env.NOHIT)u.invulnerableUntil=sim.time+60;}
  const ph=Math.floor(t/600)%2;xe(`keys.KeyW=false;keys.KeyS=false;keys.KeyA=${ph===0};keys.KeyD=${ph===1};fireHeld=false;if(player.hp<=0)player.hp=100;true`);await step(50);}
 if(process.env.DBG)console.log(xe('JSON.stringify({lf:NET.lastFix,log:(NET.inLog||[]).length,path:(NET.path||[]).length,sq:MP.sq,seq:NET.seq,x:player.x,z:player.z,ready:NET.ready,running,st:MP.st})'));
 const R=JSON.parse(xe('JSON.stringify(__RC)')),e=R.err.slice().sort((a,b)=>a-b),q=p=>e.length?e[Math.min(e.length-1,Math.floor(p*e.length))]:null;
 const res={fix:!process.env.NOFIX,nohit:!!process.env.NOHIT,delayMs:DELAY,secs:SECS,serverHitsOnPage:hits.n,reconciles:e.length,snap:R.snap,eased:R.eased,kept:R.kept,other:R.other,errP50:q(.5),errP95:q(.95),errMax:e[e.length-1]||0,tagged:xe('__TG.n'),tagRem:JSON.parse(xe('JSON.stringify(__TG.rem.slice(0,12))')),over05:e.filter(x=>x>.5).length,wallS:+((Date.now()-t0)/1000).toFixed(1),pageErrors:H.errors.length-0};
 console.log(JSON.stringify(res));if(OUT)fs.writeFileSync(OUT,JSON.stringify(res,null,1));process.exit(0);
})().catch(e=>{console.error(e);process.exit(1);});
