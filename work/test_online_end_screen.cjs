// Online end-of-match screen says why the match ended, in the mode that was played (mpsweep 2026-10-29).
// The server's 'end' frame names the leader in `over` whatever ended the match (worker.js: TDM/Esc by team score, DM the top
// killer), and the page read any `over` as "reached the kill target": a TDM match that ran out of time 5-6 read
// "Enemy team reached 100 kills · 5–6", a Deathmatch "Bot Omen reached 40 kills" with 3 kills. Online Escalation played the
// TDM path, so its end screen read "Team Deathmatch · ... reached 100 kills" instead of Escalation's levels.
// Real page (page_harness) <-> real server (local-cluster), per mode: match clock run out -> "Time up"; kill target / knife
// level reached -> "... reached N kills" / "... finished the knife level"; Escalation shows its levels, never Team Deathmatch.
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
 const play=async(mode,finish)=>{xe(`MP.name='PageQA';window.xQMap='ascent';MP.map='ascent';mpCreate(false,'${mode}');true`);
  await until(()=>xe('MP.st')==='room'&&xe('NET.host')===true,15000,mode+' room');const code=xe('MP.code');xe('mpStart()');
  await until(()=>xe('MP.st')==='game'&&xe('NET.ready'),60000,mode+' start');await step(1500);const S=cluster.room(code).sim,me=S.units.find(u=>u.name==='PageQA');
  finish(S,me);await until(()=>xe('MP.st')==='post',20000,mode+' end');await step(300);
  const r={title:$('resTitle').textContent,text:$('resText').innerHTML.split('<ol')[0].replace(/<[^>]*>/g,'')};xe("mpReset();try{toLobby()}catch(e){}true");await step(300);return r;};
 // TDM, clock out with the enemy team ahead
 {const r=await play('tdm',(S,me)=>{const f=S.units.find(u=>u.team!==me.team);me.kills=5;f.kills=6;S.scores[me.team]=5;S.scores[1-me.team]=6;S.remaining=.2;});
  check(/Time up · 5–6/.test(r.text)&&!/reached/.test(r.text),'TDM clock out 5-6 says "Time up · 5–6" (was "'+r.text+'")');check(r.title==='Defeat','TDM 5-6 is a Defeat ('+r.title+')');out.push('TDM time up: '+r.text);}
 // TDM, kill target reached by the page's team
 {const r=await play('tdm',(S,me)=>{const f=S.units.find(u=>u.team!==me.team);me.kills=S.maxKills;f.kills=40;S.scores[me.team]=S.maxKills;S.scores[1-me.team]=40;});
  check(/Your team reached 100 kills/.test(r.text),'TDM kill target says "Your team reached 100 kills" (was "'+r.text+'")');check(r.title==='Victory','TDM win title ('+r.title+')');out.push('TDM target: '+r.text);}
 // Deathmatch, clock out (a bot leads with 3 kills)
 {const r=await play('dm',(S,me)=>{const b=S.units.find(u=>!u.human);b.kills=3;S.remaining=.2;});
  check(/Time up/.test(r.text)&&!/reached/.test(r.text),'DM clock out says "Time up" (was "'+r.text+'")');out.push('DM time up: '+r.text);}
 // Deathmatch, kill target reached by a bot
 {const r=await play('dm',(S,me)=>{const b=S.units.find(u=>!u.human);b.kills=S.maxKills;});
  check(/reached 40 kills/.test(r.text)&&!/Time up/.test(r.text),'DM kill target says "<name> reached 40 kills" (was "'+r.text+'")');out.push('DM target: '+r.text);}
 // Escalation, clock out with the page's team a level ahead
 {const r=await play('esc',(S,me)=>{S.esc.lv[me.team]=4;S.esc.lv[1-me.team]=2;S.remaining=.2;});
  check(/^Escalation/.test(r.text)&&!/Team Deathmatch|100 kills/.test(r.text),'Escalation end screen is Escalation\'s (was "'+r.text+'")');check(/Time up · level 5 vs 3/.test(r.text),'Escalation clock out says "Time up · level 5 vs 3" (was "'+r.text+'")');check(r.title==='Victory','Escalation level ahead is a Victory ('+r.title+')');out.push('Esc time up: '+r.text);}
 // Escalation, enemy team finishes the knife level
 {const r=await play('esc',(S,me)=>{S.esc.lv[1-me.team]=12;});
  check(/^Escalation · Enemy team finished the knife level/.test(r.text),'Escalation knife level says "Enemy team finished the knife level" (was "'+r.text+'")');check(r.title==='Defeat','Escalation loss title ('+r.title+')');check($('againBtn').textContent==='Leave room','online result button leaves the room ('+$('againBtn').textContent+')');out.push('Esc knife: '+r.text);}
 const errs=H.errors.slice(errs0),xerr=H.xErrCalls.slice(x0);check(errs.length===0,'page errors: '+JSON.stringify(errs.slice(0,3)));check(xerr.length===0,'xErr: '+JSON.stringify(xerr.slice(0,3)));
 if(fails.length){console.log('FAIL online end screen ('+fails.length+'):\n - '+fails.join('\n - '));process.exit(1);}
 console.log('Online end screen (TDM / DM / Escalation, time up vs target): PASS\n  '+out.join('\n  '));process.exit(0);
})().catch(e=>{console.error(e);process.exit(1);});
