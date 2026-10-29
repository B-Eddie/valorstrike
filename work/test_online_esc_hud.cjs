// Online Escalation top HUD (mpsweep 2026-10-29): online Escalation plays the page's TDM path, so its team bar read Team
// Deathmatch's "<kills> FIRST TO 100 <kills>" and the subtitle "Team Deathmatch · Ascent · first to 100". Real page <-> real
// server: the bar shows each team's level (own team first), its gun and LEVEL / 12, the subtitle is Escalation's, and the
// kills leaderboard is titled ESCALATION.
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
 xe(`MP.name='PageQA';window.xQMap='ascent';MP.map='ascent';mpCreate(false,'esc');true`);await until(()=>xe('MP.st')==='room'&&xe('NET.host')===true,15000,'room');const code=xe('MP.code');xe('mpStart()');
 await until(()=>xe('MP.st')==='game'&&xe('NET.ready'),60000,'start');await step(1000);const S=cluster.room(code).sim,me=S.units.find(u=>u.name==='PageQA');
 S.esc.lv[me.team]=3;S.esc.lv[1-me.team]=1;S.esc.pt[me.team]=2;await step(800);
 const ts=xe('DM.ts?DM.ts.textContent:""'),disp=xe('DM.ts?DM.ts.style.display:"none"'),sub=$('xSub').textContent,lb=xe('DM.lb&&DM.lb.querySelector(".x-dmlb__h")?DM.lb.querySelector(".x-dmlb__h").textContent:""');
 check(!/FIRST TO 100/.test(ts),'team bar is not Team Deathmatch\'s ("'+ts+'")');check(/^4Judge.*LEVEL \/ 12.*2Ares/.test(ts),'team bar: own level 4 Judge, LEVEL / 12, enemy level 2 Ares ("'+ts+'")');check(disp!=='none','team bar shown');
 check(/^Escalation · Ascent/.test(sub)&&!/Team Deathmatch/.test(sub),'subtitle is Escalation\'s ("'+sub+'")');check(!lb||/ESCALATION/.test(lb),'leaderboard title ("'+lb+'")');out.push('bar "'+ts+'", subtitle "'+sub+'"');
 const errs=H.errors.slice(errs0),xerr=H.xErrCalls.slice(x0);check(errs.length===0,'page errors: '+JSON.stringify(errs.slice(0,3)));check(xerr.length===0,'xErr: '+JSON.stringify(xerr.slice(0,3)));
 if(fails.length){console.log('FAIL online Escalation HUD ('+fails.length+'):\n - '+fails.join('\n - '));process.exit(1);}
 console.log('Online Escalation top HUD (levels bar, subtitle): PASS\n  '+out.join('\n  '));process.exit(0);
})().catch(e=>{console.error(e);process.exit(1);});
