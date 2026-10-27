// Live probe (lane-esc): the real page (audit.js fake DOM, built from ROOT/index.html) plays ONLINE Escalation on the LIVE
// worker with a scripted second human; measures page frame cost, gun-slot churn, reconcile outcomes, seat-check triggers,
// input ack lag and snapshot arrival jitter while the page player strafes and fires.
// The page runs on work/page_harness.cjs native:true (real native-map collision; no render meshes / agent models, so a viewmodel
// rebuild is far cheaper than in a browser) paced to the wall clock (60 Hz frames, catch-up), so prediction runs in real time.
// A tool (talks to the live worker), not in test_all.
//   [ROOT=<checkout>] [BASE=https://...workers.dev] MODE=esc SECS=30 [CPUPROF=/tmp/x.cpuprofile] node work/live_esc_probe.cjs
const fs=require('fs'),path=require('path');const ROOT=process.env.ROOT||path.join(__dirname,'..'),WD=path.join(ROOT,'work');
const {boot}=require(path.join(WD,'page_harness.cjs'));const H=boot({real3:true,seed:5,native:true,fastGlobal:true});const SV=process.env.SERVER_DIR||path.join(__dirname,'..','server');
(async()=>{
 const xe=H.xe;
 const {ScriptedHuman}=await import(SV+'/tools/scripted-human.mjs');const {loadWorld}=await import(SV+'/src/world.js');
 const assets={async fetch(r){try{return new Response(fs.readFileSync(SV+'/public'+new URL(r.url).pathname));}catch(e){return new Response('',{status:404});}}};
 const world=await loadWorld(assets,'ascent');const WSN=require(path.join(SV,'node_modules','ws'));
 const BASE=process.env.BASE||'https://valorstrike-game.itsmybirthdayim7.workers.dev',ORIGIN='https://valorstrike.vercel.app';
 const sent={};let rx=[];
 class WS{constructor(url){const u=new URL(url.replace(/^ws/,'http'));const real=BASE.replace(/^http/,'ws')+'/connect'+u.search;this.readyState=0;const w=this.w=new WSN(real,{headers:{Origin:ORIGIN}});
   w.on('open',()=>{this.readyState=1;this.onopen&&this.onopen({});});w.on('message',d=>{const s=String(d);if(s.startsWith('{"t":"s"'))rx.push(Date.now());if(this.readyState===1&&this.onmessage)this.onmessage({data:s});});
   w.on('close',(c,r)=>{if(this.readyState===3)return;this.readyState=3;this.onclose&&this.onclose({code:c,reason:String(r)});});w.on('error',e=>{});}
  send(d){if(this.readyState!==1)throw Error('send on closed socket');const t=JSON.parse(d).t;sent[t]=(sent[t]||0)+1;this.w.send(d);}close(){if(this.readyState===3)return;this.readyState=3;try{this.w.close();}catch(e){}}}
 WS.OPEN=1;H.win.WebSocket=WS;{const f0=H.win.fetch;H.win.fetch=function(u){if(/\/health$/.test(String(u)))return fetch(BASE+'/health');return f0.apply(this,arguments);};}
 xe('xGQApply&&xGQApply("medium");true');
 let advMs=[],vt=0,wt0=null;const step=async ms=>{const end=vt+ms;while(vt<end){await new Promise(r=>setImmediate(r));if(wt0===null)wt0=performance.now()-vt;const wall=performance.now()-wt0;if(wall<vt){await new Promise(r=>setTimeout(r,Math.min(10,vt-wall)));continue;}const a=performance.now();H.frameMs(1000/60);advMs.push(performance.now()-a);vt+=1000/60;if(wall-vt>250)wt0+=wall-vt-250;}};
 const until=async(cond,ms,what)=>{for(let t=0;t<ms;t+=50){if(cond())return true;await step(50);}console.log('TIMEOUT '+what);return false;};
 const MODE=process.env.MODE||'esc',SECS=+(process.env.SECS||30);const code='QZ'+Array.from({length:4},()=>'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random()*32)]).join('');
 xe(`NET.url=${JSON.stringify(BASE)};J.pick='Jett';MP.name='PageQA';window.xQMap='ascent';MP.map='ascent';MP.mode='${MODE}';netConnect(true,'${code}',false)`);
 await until(()=>xe('MP.st')==='room',15000,'room');
 const B=new ScriptedHuman({name:'EnemyB',agent:'Sova',world,target:null});{const w=new WSN(BASE.replace(/^http/,'ws')+'/connect?code='+code,{headers:{Origin:ORIGIN}});B.attach({send:m=>w.readyState===1&&w.send(m),close:()=>w.close()});w.on('open',()=>B.hello());w.on('message',d=>B.receive(JSON.parse(d)));}
 await until(()=>xe('(MP.room&&MP.room.pl||[]).length')===2,15000,'B joined');
 if(xe('MP.room&&MP.room.mode')!==MODE){xe(`netSend({t:'mode',mode:'${MODE}'});true`);await until(()=>xe('MP.room&&MP.room.mode')===MODE,5000,'mode');}
 xe('mpStart()');
 await until(()=>xe('MP.st')==='game'&&xe('NET.ready'),90000,'match start');console.error('native',xe('!!(typeof nmActive==="function"&&nmActive())'));
 xe(`(()=>{const C=window.__C={sw:0,eq:0,sk:0,fix:{},uns:[],ackLag:[],snaps:0};
  const s0=swapW;swapW=function(){C.sw++;return s0.apply(this,arguments);};const b0=bEquip;bEquip=function(){C.eq++;return b0.apply(this,arguments);};const k0=onSkin;onSkin=function(){C.sk++;return k0.apply(this,arguments);};
  const r0=netReconcile;netReconcile=function(e,ref){(C.mag||(C.mag=[])).push(Math.hypot(e[4]-ref.x,e[6]-ref.z));(C.magY||(C.magY=[])).push(Math.abs(e[5]-ref.y));const r=r0.apply(this,arguments);C.fix[r]=(C.fix[r]||0)+1;return r;};
  const u0=netUnsynced;netUnsynced=function(G,why){C.uns.push([Math.round(performance.now()),why]);return u0.apply(this,arguments);};
  const m0=mpCliSelf;mpCliSelf=function(e){C.snaps++;C.lf=C.lf||{};C.sq=C.sq||{};const k=(MP.sq===e[14])?"same":"diff";C.sq[k]=(C.sq[k]||0)+1;if(e&&Number.isSafeInteger(e[19]))C.ackLag.push((NET.seq||0)-e[19]);const rr=m0.apply(this,arguments);C.lf[NET.lastFix]=(C.lf[NET.lastFix]||0)+1;return rr;};return true;})()`);
 xe('xResUp=function(){return false};xLob0=false;["lobby","xAg","pre"].forEach(i=>{const e=document.getElementById(i);if(e)e.style.display="none";});true');await step(1500);console.error('cov',xe('JSON.stringify({cov:xCov(),lob0:xLob0,res:xResUp(),set:xSetFull(),run:running,paused})'));advMs=[];rx=[];const t0=Date.now();
 const insp=require('inspector'),ses=new insp.Session();ses.connect();const post=(m,p)=>new Promise((ok,no)=>ses.post(m,p||{},(e,r)=>e?no(e):ok(r)));if(process.env.CPUPROF){await post('Profiler.enable');await post('Profiler.setSamplingInterval',{interval:250});await post('Profiler.start');}
 const info0=xe('JSON.stringify({gm:MP.gm,w:wName(),rw,pri:FV.pri,me:MP.me})');
 // strafe in a square, turn, fire bursts
 let i=0;while(Date.now()-t0<SECS*1000){i++;const ph=Math.floor(i/20)%4;xe(`keys.KeyW=${ph===0};keys.KeyD=${ph===1};keys.KeyS=${ph===2};keys.KeyA=${ph===3};yaw+=0.02;fireHeld=${i%30<10};true`);await step(50);}
 xe('for(const k in keys)keys[k]=false;fireHeld=false;true');
 if(process.env.CPUPROF){const {profile}=await post('Profiler.stop');fs.writeFileSync(process.env.CPUPROF,JSON.stringify(profile));}
 const C=JSON.parse(xe('JSON.stringify(window.__C)'));const st=a=>{const s=[...a].sort((x,y)=>x-y),n=s.length,q=p=>s[Math.min(n-1,Math.floor(p*n))];return n?{n,mean:+(s.reduce((x,y)=>x+y,0)/n).toFixed(2),p50:+q(.5).toFixed(2),p95:+q(.95).toFixed(2),max:+s[n-1].toFixed(2)}:{n:0};};
 const gaps=rx.slice(1).map((t,k)=>t-rx[k]);
 const out={root:ROOT,mode:MODE,secs:SECS,start:JSON.parse(info0),end:JSON.parse(xe('JSON.stringify({gm:MP.gm,st:MP.st,w:wName(),rw,pri:FV.pri,vmsw:VM.sw,ping:MP.ping,seatWhy:NET.seatWhy||null,seatTries:NET.seatTries||0,lastClose:NET.lastClose||null})')),
  pageFrameMs:st(advMs),swapW:C.sw,bEquip:C.eq,onSkin:C.sk,fix:C.fix,corrM:st(C.mag||[]),corrY:st(C.magY||[]),lastFix:C.lf,sqMatch:C.sq,lagBehindWallMs:Math.round(performance.now()-wt0-vt),pos:JSON.parse(xe("JSON.stringify([player.x,player.z])")),unsynced:C.uns,ackLagInputs:st(C.ackLag),snapsHandled:C.snaps,snapGapMs:st(gaps),sent,errors:H.errors.slice(1,4).map(e=>e.msg&&e.msg.slice(0,200))};
 console.log(JSON.stringify(out));
 xe('mpLeave&&mpLeave("bye");true');try{B.leave();}catch(e){}await step(500);process.exit(0);
})().catch(e=>{console.error('ERR',e&&e.stack||e);process.exit(1);});
