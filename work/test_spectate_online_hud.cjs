// Online spectator HUD + switching on the real server path (real page in audit.js's fake DOM on the real worker module,
// tools/local-cluster.mjs): the page's player dies with two teammates alive (server kill events -> mpCliSnap -> kfeed ->
// xKLDie). After the killed-by card the bottom HUD is the followed teammate's live server state - health / armour from
// its row, magazine row [15], reserve row [16], gun row [11], agent ability bar - not the player's own frozen at the death
// frame; left click / right click / Space switch between the two every time and the HUD follows; the followed one dies ->
// the other, HUD follows; the server's per-teammate reload clock shows '…'.
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

 xe(`MP.name='PageQA';window.xQMap='ascent';MP.map='ascent';mpCreate(false,'five')`);
 await until(()=>xe('MP.st')==='room',8000,'room');const code=xe('MP.code');xe('mpStart()');
 await until(()=>xe('MP.st')==='game'&&xe('NET.ready')&&xe('running'),30000,'match start');
 const sim=cluster.room(code).sim;sim.buy=0.2;await until(()=>xe('FV.buy')<=0,8000,'buy phase over');
 for(const u of sim.units)if(!u.human)u.frozen=true;
 const me=sim.units.find(u=>u.human),foes=sim.units.filter(u=>u.team!==me.team),mates=sim.units.filter(u=>u!==me&&u.team===me.team),killer=foes[0];
 if(me.team===sim.atk)Object.assign(sim.spike,{st:'plant',site:'A',x:me.x,y:me.y,z:me.z,t:45,carrier:null,dt:0,pt:0});
 const [A,Bm]=mates;const give=(u,w,am,rs,hp,ar)=>{u.weapon=w;u.inventory={[w]:am};u.ammo=am;u.reserve=rs;u.reserves={[w]:rs};u.hp=hp;u.armor=ar;};
 give(A,'Spectre',9,41,73,25);give(Bm,'Ghost',11,26,58,0);
 await step(200);for(const a of mates)if(a!==A&&a!==Bm)kill(sim,a,killer);await step(200);kill(sim,me,killer);
 for(let t=0;t<3000;t+=100)await step(100);
 const hud=()=>JSON.parse(xe('JSON.stringify({sp:!!xKL.sp,cur:xKL.cur?xKL.cur.name:null,hp:$("xHp").textContent,arm:$("xArm").textContent,wn:$("xWn").textContent,mag:$("xMag").textContent,rs:$("xRs").textContent,ab:$("xAb").getAttribute("aria-label")||""})'));
 const is=(tag,u)=>{const h=hud(),w={hp:String(Math.ceil(u.hp)),arm:String(Math.ceil(u.armor)),wn:u.weapon,mag:String(u.ammo),rs:String(u.reserve)};const good=h.sp&&h.cur===u.name&&h.hp===w.hp&&h.arm===w.arm&&h.wn===w.wn&&h.mag===w.mag&&h.rs===w.rs&&h.ab.indexOf(u.agent.charAt(0).toUpperCase()+u.agent.slice(1).toLowerCase())===0;
  if(!good)fails.push(tag+': HUD = '+u.name+' '+JSON.stringify({h,w}));return h;};
 const fails=[],byName=n=>sim.units.find(u=>u.name===n);
 const click=async b=>{xe(`(()=>{const cv=renderer.domElement;const e=new MouseEvent("mousedown",{button:${b},bubbles:true});cv.dispatchEvent(e);return 1})()`);await step(150);};
 let h=hud();const first=byName(h.cur);if(!first||(first!==A&&first!==Bm))fails.push('following a teammate '+JSON.stringify(h));
 else{const other=first===A?Bm:A;is('first',first);
  first.ammo-=3;await step(150);is('a shot later (row [15])',first);
  await click(0);is('left click -> next',other);await click(2);is('right click -> previous',first);
  xe('(()=>{const e=new KeyboardEvent("keydown",{code:"Space",bubbles:true});window.dispatchEvent(e);return 1})()');await step(150);is('Space -> next',other);
  other.reloadAt=sim.time+1.5;await step(250);{const g=hud();if(g.mag!=='…')fails.push('server reload clock: magazine "…" '+JSON.stringify(g));}other.reloadAt=0;await step(150);
  kill(sim,other,killer);for(let t=0;t<800;t+=100)await step(100);is('followed teammate died -> the other',first);}
 xe('try{mpLeave()}catch(e){}1');await step(300);
 const errs=H.errors.slice(errs0);if(errs.length)fails.push('page exceptions '+JSON.stringify(errs.slice(0,3)));
 if(fails.length){console.error('FAIL:\n - '+fails.join('\n - '));process.exit(1);}
 console.log('Online spectator HUD (real server): followed teammate health / armour / gun / magazine row [15] / reserve row [16] / ability bar; reload clock "…"; left / right click + Space switch and the HUD follows; followed teammate dies -> the other');process.exit(0);
})().catch(e=>{console.error(e);process.exit(1);});
