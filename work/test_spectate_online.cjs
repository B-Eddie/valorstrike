// Online spectate on the real server path: the real page (audit.js fake DOM) on the real worker module
// (tools/local-cluster.mjs; ENABLE_SPIKE locally only). The deaths come from the server's own snapshot kill events, so the
// page goes through mpCliSnap -> kfeed -> xKLDie exactly as online (test_spectate_follow.cjs calls xKLDie directly).
//  - online 5v5: the page's player and every teammate killed -> after the 2 s killed-by card the cam follows the killer, a
//    living enemy ("SPECTATING <NAME> · ENEMY"), as VALORANT; Space cycles to another living enemy.
//  - online Team Deathmatch and Deathmatch (respawn modes): the page's player and every teammate dead (respawns held back
//    on the server) -> never an enemy cam; the label is written when the view opens ("NO ONE ALIVE", no Spike cam): it
//    kept the previous death's text, here the 5v5 match's "SPECTATING <enemy> · ENEMY".
const fs=require('fs'),path=require('path'),assert=require('assert/strict'),vm=require('vm');
const audit=fs.readFileSync(path.join(__dirname,'audit.js'),'utf8'),boot=audit.slice(0,audit.indexOf('// ---------- audit ----------')).replace(/^"use strict";/,'');
const log=console.log;console.log=()=>{};
const H=new Function('require','__dirname','process','module',boot+'\nreturn {win,context,errors,xErrCalls,advance};')(require,__dirname,process,module);
console.log=log;
(async()=>{
 const xe=code=>vm.runInContext('__xe',H.context)(code);
 const {localCluster}=await import('../server/tools/local-cluster.mjs');
 const cluster=await localCluster({env:{ALLOW_LOCAL_ORIGIN:'true',ENABLE_SPIKE:'true'}});let pending=0;
 class WS{constructor(url){const q=Object.fromEntries(new URL(url.replace(/^ws/,'http')).searchParams);this.readyState=0;const api=cluster.connect(q);this.api=api;pending++;let d=false;const done=()=>{if(!d){d=true;pending--;}};
  api.on('open',()=>{done();this.readyState=1;this.onopen&&this.onopen({});});api.on('message',m=>{if(this.readyState===1&&this.onmessage)this.onmessage({data:JSON.stringify(m)});});
  api.on('close',e=>{if(this.readyState===3)return;this.readyState=3;this.onclose&&this.onclose({code:e.code,reason:e.reason});});api.on('error',e=>{done();this.readyState=3;this.onclose&&this.onclose({code:1006,reason:String(e.message)});});}
  send(d){this.api.send(d);}close(){if(this.readyState===3)return;this.readyState=3;this.api.close();}}
 H.win.getComputedStyle=el=>{const st=(el&&el.style)||{},d=el&&el.id==='timer'?'none':st.display||(el&&el.hidden?'none':(el&&el.id==='result'?'none':'block'));return new Proxy({},{get:(t,k)=>k==='display'?d:k==='visibility'?(st.visibility||'visible'):k==='getPropertyValue'?(n=>st[n]||''):(st[k]||'')});};
 WS.OPEN=1;H.win.WebSocket=WS;H.win.fetch=()=>Promise.reject(new TypeError('Failed to fetch'));
 xe('nmEnsure=function(){return Promise.resolve(null);};window.xvAgentsReady=xvAgentsReady=function(){return Promise.resolve([]);};xvPreloadAgents=function(){};true');
 // the audit THREE stub's clock never advances (getDelta 0), so the frame's game time (rt: the spectate card timer) would stay 0: real deltas from the page clock
 xe('clock.getDelta=(()=>{let t=performance.now();return ()=>{const n=performance.now(),d=(n-t)/1000;t=n;return d;};})();true');
 const settle=async()=>{const end=Date.now()+60000;const busy=()=>{if(pending>0)return true;const c=xe('MP.code'),r=c&&cluster.room(c);return !!r&&[...r.sessions.values()].some(s=>s.authenticating&&!s.u);};while(busy()&&Date.now()<end)await new Promise(r=>setTimeout(r,2));};
 const step=async ms=>{for(let t=0;t<ms;t+=50){await settle();await cluster.advance(50);H.advance(50);}};
 const until=async(c,ms,w)=>{for(let t=0;t<ms;t+=50){if(c())return;await step(50);}throw Error('timed out: '+w+' st '+xe('MP.st')+' errors '+JSON.stringify(H.errors.slice(0,3)));};
 const errs0=H.errors.length,out=[];
 const cam=()=>JSON.parse(xe('JSON.stringify({on:xKL.on,sp:xKL.sp,st:+(xKL.st||0).toFixed(2),cur:xKL.cur?xKL.cur.name:null,enemy:!!(xKL.cur&&bots.includes(xKL.cur)),label:xKL.sn?xKL.sn.textContent:"",hp:player.hp,al:allies.filter(a=>a.alive).length,en:bots.filter(b=>b.alive).length,dm:!!FV.dm,m5:!!MP.m5,mode})'));
 // server-side kill as the simulation records one (hp 0, a death, the 'k' event the snapshot carries); respawn held back
 const kill=(sim,v,k)=>{v.hp=0;v.alive=false;v.deaths++;v.respawnAt=1e9;if(k)k.kills++;sim.events.push(['k',k?k.name:'',v.name,0,'Vandal']);};
 const modes=(process.env.MODES||'five,tdm,dm').split(',');
 for(const mode of modes){
  xe(`MP.name='PageQA';window.xQMap='ascent';MP.map='ascent';mpCreate(false,'${mode}')`);
  await until(()=>xe('MP.st')==='room',8000,mode+' room');const code=xe('MP.code');xe('mpStart()');
  await until(()=>xe('MP.st')==='game'&&xe('NET.ready')&&xe('running'),30000,mode+' match start');
  const sim=cluster.room(code).sim;if(mode==='five'){sim.buy=0.2;await until(()=>xe('FV.buy')<=0,8000,'buy phase over');}
  for(const u of sim.units)if(!u.human)u.frozen=true;
  const me=sim.units.find(u=>u.human),foes=sim.units.filter(u=>u!==me&&(mode==='dm'||u.team!==me.team)),mates=mode==='dm'?[]:sim.units.filter(u=>u!==me&&u.team===me.team),killer=foes[1]||foes[0];
  if(mode==='five'&&me.team===sim.atk)Object.assign(sim.spike,{st:'plant',site:'A',x:me.x,y:me.y,z:me.z,t:45,carrier:null,dt:0,pt:0});/* attackers wiped after a plant: the round goes on */
  await step(200);for(const a of mates)kill(sim,a,killer);await step(200);kill(sim,me,killer);
  let enemySeen=null;for(let t=0;t<3000;t+=100){await step(100);const c=cam();if(c.enemy||(c.sp&&/ENEMY/.test(c.label)))enemySeen=enemySeen||c;}
  const c=cam();out.push(mode+' '+JSON.stringify(c));
  assert.equal(c.hp<=0,true,mode+': the page saw its own death '+JSON.stringify(c));assert.equal(c.al,0,mode+': every teammate dead on the page');assert.ok(c.on,mode+': spectate on (xKLDie from the server kill event)');
  if(mode==='five'){assert.ok(c.sp&&c.enemy&&c.cur===killer.name&&/SPECTATING .* · ENEMY/.test(c.label),'online 5v5 team wiped: the killer, a living enemy '+JSON.stringify(c));
   xe('xKL.si++');await step(200);const d=cam();out.push('five cycle '+JSON.stringify(d));assert.ok(d.enemy&&d.cur!==killer.name,'online 5v5: Space cycles the living enemies '+JSON.stringify(d));}
  else assert.equal(enemySeen,null,mode+': respawn mode never follows an enemy '+JSON.stringify(enemySeen));
  if(mode!=='five')assert.ok(c.sp&&c.label==='NO ONE ALIVE',mode+': label written when the view opens, no Spike cam in a respawn mode (was the previous match\'s "SPECTATING <enemy> · ENEMY") '+JSON.stringify(c));
  xe('try{mpLeave()}catch(e){}1');await step(300);
 }
 const errs=H.errors.slice(errs0);if(process.env.VERBOSE)console.log(out.join('\n'));assert.deepEqual(errs,[],'no page exceptions');
 console.log('Online spectate (real server kill events): 5v5 team wiped -> the killer then the other living enemies (· ENEMY); TDM / Deathmatch with the team dead -> never an enemy cam');process.exit(0);
})().catch(e=>{console.error(e);process.exit(1);});
