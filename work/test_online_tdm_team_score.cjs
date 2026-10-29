// Online TDM team score after a player leaves (mpsweep 2026-10-29). The server keeps the team score (sim.scores) when a human
// leaves and a bot takes the seat with 0 kills (a rejoin starts at 0 again), but the page summed the team score from the
// units still in the room (tdmTot over DM.k): the top HUD and the end screen dropped the leaver's kills - 7 team kills read 0,
// and a match the team led on the server could end as a Defeat on the page.
//  A. a server without team scores in the frame (the live worker before this lane): the page carries a departed unit's
//     kills in its team total;  B. the server's team score in the frame (ts) is the page's total.
const assert=require('assert/strict');const {boot}=require('./page_harness.cjs');
function mulberry(seed){let a=seed>>>0;return ()=>{a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return ((t^t>>>14)>>>0)/4294967296;};}
Math.random=mulberry(11);const H=boot({seed:5});
(async()=>{
 const xe=H.xe,$=id=>H.doc.getElementById(id),fails=[],out=[];const check=(ok,msg)=>{if(!ok)fails.push(msg);};
 const {localCluster}=await import('../server/tools/local-cluster.mjs');const cluster=await localCluster({env:{ALLOW_LOCAL_ORIGIN:'true'}});
 const codes=new Set();let pending=0;
 const settle=async()=>{const end=Date.now()+120000;const busy=()=>pending>0||[...codes].some(c=>{const r=cluster.room(c);return r&&[...r.sessions.values()].some(s=>s.authenticating&&!s.u);});while(busy()&&Date.now()<end)await new Promise(r=>setTimeout(r,2));};
 class WS{constructor(url){const q=Object.fromEntries(new URL(url.replace(/^ws/,'http')).searchParams);this.readyState=0;const api=cluster.connect(q);this.api=api;pending++;let settled=false;const done=()=>{if(!settled){settled=true;pending--;}};if(q.code)codes.add(q.code);
   api.on('open',()=>{done();this.readyState=1;this.onopen&&this.onopen({});});api.on('message',m=>{if(this.readyState===1&&this.onmessage)this.onmessage({data:JSON.stringify(m)});});
   api.on('close',e=>{if(this.readyState===3)return;this.readyState=3;this.onclose&&this.onclose({code:e.code,reason:e.reason});});api.on('error',()=>{done();this.readyState=3;});}
  send(d){if(this.readyState!==1)throw Error('send on closed socket');this.api.send(d);}close(){if(this.readyState===3)return;this.readyState=3;this.api.close();}}
 WS.OPEN=1;H.win.WebSocket=WS;{const f0=H.win.fetch;H.win.fetch=function(u){u=String(u);if(/\/health$/.test(u))return cluster.fetch('/health');return f0(u);};}
 H.win.__ls=new Map();H.win.__ls.getItem=k=>H.win.__ls.has(k)?H.win.__ls.get(k):null;H.win.__ls.setItem=(k,v)=>H.win.__ls.set(k,String(v));H.win.__ls.removeItem=k=>H.win.__ls.delete(k);
 xe('nmEnsure=function(){return Promise.resolve(null);};window.xvAgentsReady=xvAgentsReady=function(){return Promise.resolve([]);};xvPreloadAgents=function(){};true');
 const errs0=H.errors.length,x0=H.xErrCalls.length;
 const step=async ms=>{for(let t=0;t<ms;t+=50){if(xe('MP.code'))codes.add(xe('MP.code'));await settle();await cluster.advance(50);H.advance(50);}};
 const until=async(c,ms,w)=>{for(let t=0;t<ms;t+=50){if(c())return;await step(50);}throw Error('timed out: '+w+' (MP.st '+xe('MP.st')+' msg '+xe('MP.msg')+')');};
 const humans=[];const join=(code,name,token)=>{codes.add(code);pending++;let settled=false;const done=()=>{if(!settled){settled=true;pending--;}};const s=cluster.connect({code});const h={send:m=>s.send(JSON.stringify(m)),s};s.on('message',m=>{if(m.t==='start')h.send({t:'ready'});else if(m.t==='s')h.send({t:'in',seq:(h.q=(h.q||0)+1),r:0,p:0,f:0,s:0});});s.on('open',()=>{done();h.send({t:'hi',n:name,ag:'Sova',...(token?{token}:{})});});s.on('error',done);humans.push(h);return h;};
 for(const phase of ['A','B']){
  xe(`MP.name='PageQA';window.xQMap='ascent';MP.map='ascent';mpCreate(false,'tdm');true`);await until(()=>xe('MP.st')==='room'&&xe('NET.host')===true,15000,'room');const code=xe('MP.code');
  const tok=(await cluster.profile()).token;let B=join(code,'Bravo',tok);await until(()=>xe('(MP.room&&MP.room.pl||[]).length')===2,8000,'Bravo joined');await step(300);xe('mpStart()');
  await until(()=>xe('MP.st')==='game'&&xe('NET.ready'),60000,'start');await step(1000);const R=cluster.room(code),S=R.sim;
  if(phase==='A'){const s0=S.snapshot.bind(S);S.snapshot=function(){const f=s0();delete f.ts;return f;};}
  for(const u of S.units)u.kills=0;S.scores=[0,0];const me=S.units.find(u=>u.name==='PageQA');
  const allyBot=S.units.find(u=>!u.human&&u.team===me.team),b=S.units.find(u=>u.name==='Bravo');const mine=b.team===me.team?1:0;
  b.kills=7;S.scores[b.team]=7;allyBot.kills=2;S.scores[me.team]+=2;const enemyBot=S.units.find(u=>!u.human&&u.team!==me.team);enemyBot.kills+=3;S.scores[enemyBot.team]+=3;
  const want=()=>[S.scores[me.team],S.scores[1-me.team]],page=()=>JSON.parse(xe('JSON.stringify(tdmTot())'));
  await step(500);check(JSON.stringify(page())===JSON.stringify(want()),phase+': page team score '+JSON.stringify(page())+' = server '+JSON.stringify(want()));
  B.send({t:'bye'});B.s.close();await step(2500);check(!S.units.some(u=>u.name==='Bravo'),phase+': Bravo left, a bot holds the seat');
  check(JSON.stringify(page())===JSON.stringify(want()),phase+': after Bravo left the page team score is still the server\'s '+JSON.stringify(want())+' (page '+JSON.stringify(page())+')');
  B=join(code,'Bravo',tok);await step(3000);check(S.units.some(u=>u.name==='Bravo'),phase+': Bravo back');
  check(JSON.stringify(page())===JSON.stringify(want()),phase+': after Bravo rejoined the page team score is the server\'s '+JSON.stringify(want())+' (page '+JSON.stringify(page())+')');
  const w=want();S.remaining=.2;await until(()=>xe('MP.st')==='post',20000,'end');await step(300);
  const txt=$('resText').innerHTML.split('<ol')[0].replace(/<[^>]*>/g,''),title=$('resTitle').textContent;const exp=w[0]>w[1]?'Victory':w[0]<w[1]?'Defeat':'DRAW';
  check(txt.includes(w[0]+'–'+w[1])&&title===exp,phase+': end screen '+title+' "'+txt+'" (server '+w[0]+'–'+w[1]+', '+exp+')');out.push(phase+': '+title+' '+txt);
  for(const h of humans.splice(0))try{h.send({t:'bye'});h.s.close();}catch(e){}xe("mpReset();try{toLobby()}catch(e){}true");await step(300);}
 const errs=H.errors.slice(errs0),xerr=H.xErrCalls.slice(x0);check(errs.length===0,'page errors: '+JSON.stringify(errs.slice(0,3)));check(xerr.length===0,'xErr: '+JSON.stringify(xerr.slice(0,3)));
 if(fails.length){console.log('FAIL online TDM team score ('+fails.length+'):\n - '+fails.join('\n - '));process.exit(1);}
 console.log('Online TDM team score kept when a player leaves / rejoins (frame without and with ts): PASS\n  '+out.join('\n  '));process.exit(0);
})().catch(e=>{console.error(e);process.exit(1);});
