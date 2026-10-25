// Online Spike HUD: the real page (audit.js fake DOM) on the real worker module (tools/local-cluster.mjs, ENABLE_SPIKE
// locally only). After the server plants the Spike the round clock must hide and the planted-Spike icon #xSpk show
// (xSpOn), as offline; after the round it must come back. Regression for the online post-plant HUD.
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
 // getComputedStyle from inline styles, as page_harness.cjs does (the audit stub reads every screen as shown, so the
 // results-screen flag would cover the game and skip the frame's effects pass)
 H.win.getComputedStyle=el=>{const st=(el&&el.style)||{},d=el&&el.id==='timer'?'none':st.display||(el&&el.hidden?'none':(el&&el.id==='result'?'none':'block'));return new Proxy({},{get:(t,k)=>k==='display'?d:k==='visibility'?(st.visibility||'visible'):k==='getPropertyValue'?(n=>st[n]||''):(st[k]||'')});};
 WS.OPEN=1;H.win.WebSocket=WS;H.win.fetch=()=>Promise.reject(new TypeError('Failed to fetch'));
 xe('nmEnsure=function(){return Promise.resolve(null);};window.xvAgentsReady=xvAgentsReady=function(){return Promise.resolve([]);};xvPreloadAgents=function(){};true');
 const settle=async()=>{const end=Date.now()+60000;const busy=()=>{if(pending>0)return true;const c=xe('MP.code'),r=c&&cluster.room(c);return !!r&&[...r.sessions.values()].some(s=>s.authenticating&&!s.u);};while(busy()&&Date.now()<end)await new Promise(r=>setTimeout(r,2));};
 const step=async ms=>{for(let t=0;t<ms;t+=50){await settle();await cluster.advance(50);H.advance(50);}};
 const until=async(c,ms,w)=>{for(let t=0;t<ms;t+=50){if(c())return;await step(50);}throw Error('timed out: '+w+' st '+xe('MP.st')+' errors '+JSON.stringify(H.errors.slice(0,3)));};
 const errs0=H.errors.length;
 xe(`MP.name='PageQA';window.xQMap='ascent';MP.map='ascent';mpCreate(false,'five')`);
 await until(()=>xe('MP.st')==='room',8000,'room');const code=xe('MP.code');xe('mpStart()');
 await until(()=>xe('MP.st')==='game'&&xe('NET.ready'),30000,'match start');
 const sim=cluster.room(code).sim;sim.buy=0.2;await until(()=>xe('FV.buy')<=0&&xe('running'),8000,'buy phase over');
 for(const u of sim.units)if(!u.human){u.frozen=true;}
 const hud=()=>JSON.parse(xe('JSON.stringify({on:xSpOn,tm:$("xTm").classList.contains("x-spk"),spk:$("xSpk").style.display,vis:$("timer").style.visibility,st:FV.sp.st,running,mode,rects:0})'));
 assert.equal(hud().on,false,'no Spike icon before the plant');
 const c=sim.units.find(u=>u.team===sim.atk);Object.assign(sim.spike,{st:'plant',site:'A',x:c.x,z:c.z,t:45,carrier:null,dt:0,pt:0});
 await step(600);const h=hud();
 assert.equal(h.st,'plant','page sees the plant');
 assert.equal(h.on,true,'online post-plant: xSpOn '+JSON.stringify(h));assert.equal(h.tm,true,'the visible top-bar clock #xTm shows the Spike (.x-spk)');assert.equal(xe('getComputedStyle($("timer")).display'),'none','legacy #timer stays hidden');assert.equal(h.vis,'hidden','round clock hidden after plant');
 sim.finishRound(sim.atk,'QA');await step(400);const e=hud();
 assert.equal(e.on,false,'icon cleared after the round ends '+JSON.stringify(e));assert.equal(e.vis,'','round clock back');assert.equal(e.tm,false,'#xTm clock back');
 assert.deepEqual(H.errors.slice(errs0),[],'no page exceptions');
 console.log('Online Spike HUD: server plant swaps the visible top-bar clock #xTm for the pulsing Spike (.x-spk, xSpOn; the legacy #timer is display:none in this HUD), cleared at round end');process.exit(0);
})().catch(e=>{console.error(e);process.exit(1);});
