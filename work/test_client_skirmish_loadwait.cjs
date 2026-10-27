// Online Skirmish 1v1 round-1 load wait (user, live: "stuck in place"): the server held the round-1 buy clock for up to 90 s while
// the opponent was still loading, and the page's HUD read 'BUY 15s' the whole time, so whoever loaded first stood frozen ~105 s
// with a timer that did not move. Now (server/src/modes.js SKM.loadHold = 20, snapshot skm.ld = the wait left):
//  1. while the opponent loads, the page's HUD line says 'WAITING FOR OPPONENT' with the seconds left (counting down), never the
//     buy timer, and the centre message says so too;
//  2. the server caps the wait at 20 s from the round's start and then runs the buy phase regardless (opponent still loading);
//     the HUD switches to the buy timer, which counts down, and the round goes live 15 s later.
// The real page (page_harness native) against the real game server in-process (local-cluster), clocks in lockstep; the opponent
// is a socket client that never reports 'ready' (still loading).
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
 const peer=(q,name)=>{codes.add(q.code);pending++;let settled=false;const done=()=>{if(!settled){settled=true;pending--;}};const s=cluster.connect(q);const h={room:null,send:m=>s.send(JSON.stringify(m))};s.on('message',m=>{if(m.t==='room')h.room=m;if(m.t==='start'&&!q.noReady)h.send({t:'ready'});});s.on('open',()=>{done();h.send({t:'hi',n:name,ag:'Sova'});});s.on('error',done);return h;};

 xe("MP.name='PageLead';window.xQMap='ascent';MP.map='ascent';mpCreate(false,'skm');true");
 await until(()=>xe('MP.st')==='room'&&xe('NET.host')===true,10000,'room');const code=xe('MP.code');
 const M=peer({code,noReady:1},'Slow');await until(()=>M.room&&M.room.pl.length===2,8000,'second player');await step(300);xe('mpStart()');
 await until(()=>xe('MP.st')==='game'&&xe('NET.ready')&&xe('!!(MP.skm&&MP.skm.ph)'),90000,'Skirmish start');
 const S=cluster.room(code).sim,foe=()=>S.units.find(u=>u.name==='Slow'),hud=()=>{const e=$('xGmHud');return e?e.textContent:'';},toast=()=>{const e=$('toast');return e?e.textContent:'';};
 assert.equal(S.skm.r,1);assert.equal(S.skm.ph,'buy');check(foe()&&foe().loading,'opponent still loading');
 await step(1000);const h1=hud(),t1=S.skm.t;
 check(/WAITING FOR OPPONENT/i.test(h1),'HUD says waiting for the opponent while they load (was "'+h1+'")');check(!/BUY \d+s/.test(h1),'no buy timer while waiting (was "'+h1+'")');
 const sec=s=>{const m=/WAITING FOR OPPONENT\D*(\d+)s/i.exec(s);return m?+m[1]:NaN;};check(sec(h1)>=15&&sec(h1)<=20,'wait seconds left 15-20 at the start (was '+sec(h1)+')');
 check(/Waiting for opponent/i.test(toast()),'centre message says waiting for the opponent (was "'+toast()+'")');
 check(t1===15,'server buy clock held while the opponent loads ('+t1+')');
 await step(2000);const h2=hud();check(sec(h2)<sec(h1),'wait seconds count down ('+sec(h1)+' -> '+sec(h2)+')');
 out.push('waiting: HUD "'+h2+'", centre "'+toast()+'", server buy clock '+S.skm.t);
 // fast-forward the round's start (lockstep at 50 ms over 20 s is slow): 18.5 s into the round
 S.skm.at-=Math.max(0,18.5-(S.time-S.skm.at));await step(500);check(/WAITING FOR OPPONENT/i.test(hud()),'still waiting at ~19 s ("'+hud()+'")');
 await step(1500);const h3=hud();check(foe().loading,'opponent still loading past 20 s');
 check(S.skm.ph==='buy'&&S.skm.t<15,'server: buy clock runs after 20 s with the opponent still loading (t '+S.skm.t.toFixed(2)+')');
 check(/BUY \d+s/.test(h3)&&!/WAITING FOR OPPONENT/i.test(h3),'HUD switches to the buy timer after the 20 s wait (was "'+h3+'")');
 const b3=+(/BUY (\d+)s/.exec(h3)||[])[1];await step(2000);const b4=+(/BUY (\d+)s/.exec(hud())||[])[1];check(b4<b3,'buy timer counts down ('+b3+' -> '+b4+')');
 out.push('after 20 s: HUD "'+hud()+'", server t '+S.skm.t.toFixed(1));
 for(let t=0;t<16000&&S.skm.ph!=='live';t+=50)await step(50);check(S.skm.ph==='live','round 1 live with the opponent still loading (phase '+S.skm.ph+', t '+S.skm.t+')');check(S.time-S.skm.at<37,'round 1 live by ~35 s ('+(S.time-S.skm.at).toFixed(1)+' s)');
 out.push('round 1 live at '+(S.time-S.skm.at).toFixed(1)+' s with the opponent still loading');
 xe("mpLeave('Left');true");await step(300);
 const errs=H.errors.slice(errs0),xerr=H.xErrCalls.slice(x0);check(errs.length===0,'page errors: '+JSON.stringify(errs.slice(0,3)));check(xerr.length===0,'xErr: '+JSON.stringify(xerr.slice(0,3)));
 if(fails.length){console.log('FAIL Skirmish load wait ('+fails.length+'):\n - '+fails.join('\n - '));process.exit(1);}
 console.log('Skirmish 1v1 round-1 load wait: PASS\n  '+out.join('\n  '));process.exit(0);
})().catch(e=>{console.error(e);process.exit(1);});
