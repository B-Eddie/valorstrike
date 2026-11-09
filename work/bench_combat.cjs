// Combat stress scenario (a tool + the engine of test_combat_stress_perf; combat lane 2026-11-03, user: "it lags in certain
// times, like when i do multiple abilities while using ult while shooting at enemy while getting shot at").
// Boots the real page (work/page_harness.cjs: native Ascent nav + collision, real agent rigs, WebGL stubbed,
// work/perf_render_emu.js modelling the renderer's CPU work and COUNTING GPU work: new shader programs, texture uploads,
// new geometry buffers) in an offline 5v5 at the MEDIUM preset with a fixed seed, and runs the worst-case moment:
//   the player casts C, Q, E, then the ult (with the follow-up clicks each one takes), firing full-auto at an enemy who is
//   shooting back the whole time, while two more enemies and two allies stand close with full utility charges and full
//   ult charge (they cast whatever their own logic picks: bot decisions are untouched).
// Per run: frame ms p50 / p95 / p99 / max (node wall time of one page frame = sim + emulated render), CPU ms, GC per frame,
// new programs / texture uploads / geometries, DOM churn (createElement, innerHTML, style writes, layout reads), and a
// sampling profile split into all frames and the worst frames (self ms per function).
//   node work/bench_combat.cjs [--agent Jett|all] [--json out.json] [--reps 2] [--frames 420] [--hash]
//   SEED=7 (default). PROF=0 turns the profiler off. --hash prints a hash of every bot action in the window (decisions).
// Frame ms are node wall times; compare runs on the same box / load only.
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const arg=k=>{const i=process.argv.indexOf(k);return i>0?process.argv[i+1]:null;};
const AGENTS=['Jett','Phoenix','Sova','Sage','Reyna','Omen','Killjoy','Raze','Skye','Breach','Cypher','Chamber'];
const A0=arg('--agent')||'Jett';
if(A0==='all'||A0.includes(',')){ // one process per agent (each boots its own page), sequentially: one heavy process at a time on this box
 const {spawnSync}=require('child_process'),out=arg('--json'),all={};
 for(const a of (A0==='all'?AGENTS:A0.split(','))){const j=out?out.replace(/\.json$/,'')+'_'+a+'.json':null;const args=[__filename,'--agent',a];for(const k of ['--reps','--frames','--inject'])if(arg(k))args.push(k,arg(k));if(process.argv.includes('--hash'))args.push('--hash');if(j)args.push('--json',j);
  const r=spawnSync(process.execPath,['--expose-gc',...args],{stdio:'inherit',env:process.env});if(j&&fs.existsSync(j))all[a]=JSON.parse(fs.readFileSync(j,'utf8'));if(r.status)console.log('agent',a,'exit',r.status);}
 if(out)fs.writeFileSync(out,JSON.stringify(all,null,1));process.exit(0);
}
module.exports=null;
// IDX=<file>: boot another index.html (A/B against a saved base page) - the harness reads <repo>/index.html through fs
if(process.env.IDX){const rf=fs.readFileSync,want=path.join(__dirname,'..','index.html');fs.readFileSync=function(f,...a){if(typeof f==='string'&&path.resolve(f)===want)return rf.call(fs,process.env.IDX,...a);return rf.call(fs,f,...a);};}
const {boot,lsStore}=require('./page_harness.cjs');
const AGENT=A0,OUT=arg('--json'),REPS=+(arg('--reps')||2),NF=+(arg('--frames')||420),SEED=+(process.env.SEED||7),PROF=process.env.PROF!=='0',HASH=process.argv.includes('--hash');
const H=boot({real3:true,seed:SEED,native:true,fastGlobal:true,ls:lsStore([['vs.gq','medium']])}),xe=H.xe;
const tick=()=>new Promise(r=>setImmediate(r));
const adv=async ms=>{for(let t=0;t<ms;t+=50){H.advance(Math.min(50,ms-t));await tick();}};
xe(`{const g=document.getElementById.bind(document),C=new Map();document.getElementById=function(id){const e=C.get(id);if(e&&e.id===id)return e;const r=g(id);if(r)C.set(id,r);return r;};}true`); // harness DOM lookups are O(n); a browser's are O(1)
xe(fs.readFileSync(path.join(__dirname,'..','vendor','hit-impact.js'),'utf8')+';true');
xe(`xvaParse=function(buf){return new Promise((res,rej)=>{const L=new THREE.GLTFLoader();L.register(p=>({name:'EXT_texture_webp',loadTexture:()=>Promise.resolve(new THREE.Texture())}));L.parse(buf,XVA.dir,res,rej);});};true`);
// DOM churn + THREE allocation counters (page side)
xe(`window.__REC={on:false,obj:0,dom:0,html:0,txt:0,sty:0,lay:0,cls:0};{
 const SITES=${!!process.env.SITES},PSITES=${!!process.env.PSITES};__REC.sites=new Map();const site=()=>String(new Error().stack).split('\\n').slice(3).filter(l=>!/bench_combat|page_harness|perf_render_emu/.test(l)).slice(0,${+(process.env.SDEPTH||4)}).map(l=>l.trim().replace(/^at /,'').replace(/ \\(eval at [^)]*\\)/,'').replace(/\\(?(?:file:\\/\\/)?[^()]*\\/([^\\/:()]+):(\\d+):\\d+\\)?/,'$1:$2')).join(' < ');
 const note=(k)=>{if(!__REC.on)return;__REC.obj++;if(SITES){const s=k+' @ '+site();__REC.sites.set(s,(__REC.sites.get(s)||0)+1);}};
 for(const k of Object.keys(THREE)){const C=THREE[k];if(typeof C!=="function"||!C.prototype||!/^[A-Z]/.test(k))continue;
  const W=class extends C{constructor(...a){super(...a);note('new '+k);if(PSITES&&this.isMaterial)this.__site=site();}};Object.defineProperty(W,"name",{value:k});try{THREE[k]=W;}catch(e){}}
 for(const [N,P] of [['Material',THREE.Material.prototype],['BufferGeometry',THREE.BufferGeometry.prototype],['Object3D',THREE.Object3D.prototype],['Texture',THREE.Texture.prototype]]){const c=P.clone;P.clone=function(){note(N+'.clone');return c.apply(this,arguments);};}
 const ce=document.createElement.bind(document);document.createElement=function(t){if(__REC.on)__REC.dom++;return ce(t);};
 const EP=Object.getPrototypeOf(ce('div'));const hook=(name,k,get)=>{let p=EP,d=null;while(p&&!(d=Object.getOwnPropertyDescriptor(p,name)))p=Object.getPrototypeOf(p);if(!d)return;
  if(get){if(d.get)Object.defineProperty(p,name,{get(){if(__REC.on)__REC[k]++;return d.get.call(this);},set:d.set,configurable:true});else if(typeof d.value==='function'){const f=d.value;p[name]=function(){if(__REC.on)__REC[k]++;return f.apply(this,arguments);};}}
  else if(d.set)Object.defineProperty(p,name,{get:d.get,set(v){if(__REC.on)__REC[k]++;d.set.call(this,v);},configurable:true});};
 hook('innerHTML','html');hook('textContent','txt');for(const n of ['getBoundingClientRect','offsetWidth','offsetHeight','offsetTop','offsetLeft','offsetParent','clientWidth','clientHeight','getClientRects'])hook(n,'lay',true);
 const st=ce('div').style,SP=Object.getPrototypeOf(st);if(SP&&SP.setProperty){const f=SP.setProperty;SP.setProperty=function(){if(__REC.on)__REC.sty++;return f.apply(this,arguments);};}
 }true`);
xe(fs.readFileSync(path.join(__dirname,'perf_render_emu.js'),'utf8')+';true');
const emu=()=>JSON.parse(xe('JSON.stringify(__PS.endFrame())'));
const INJ=arg('--inject');if(INJ){require('vm').runInContext('globalThis',H.context).__rnow=()=>Number(process.hrtime.bigint())/1e6;xe(fs.readFileSync(INJ,'utf8')+';true');} // --inject file.js: page code after the recorder; window.__INJ() (if defined) goes into each run row as 'inj'
// bot action log (decisions): what every bot does, sampled after each frame: alive, hp, position (cm), yaw (mrad), weapon,
// ammo, firing / reloading flags, the ability state the bot code keeps. Hashed per frame; identical hashes = identical decisions.
xe(`window.__bh=function(){let s="";for(const b of bots.concat(allies)){if(!b)continue;const p=b.g&&b.g.position;s+=b.name+":"+(b.alive?1:0)+","+(b.hp|0)+","+(p?Math.round(p.x*100)+","+Math.round(p.z*100)+","+Math.round((b.g.rotation.y||0)*1000):"")+","+(b.w||"")+","+(b.ammo|0)+","+(b.rl?1:0)+","+(b.cd>0?Math.round(b.cd*1000):0)+","+(b.tg&&b.tg.name||b.tg===player?"P":"")+";";}
 s+="|"+(player.hp|0)+","+Object.keys(window.xBotUC||{}).map(k=>k+"="+xBotUC[k]).join(",")+"|"+(J.smokes||[]).length+","+(J.walls||[]).length+","+(J.zones||[]).length;return s;};true`);
const {Session}=require('inspector'),HS=new Session();HS.connect();const post=(m,p)=>new Promise((ok,no)=>HS.post(m,p||{},(e,r)=>e?no(e):ok(r)));
const {PerformanceObserver,performance:PF}=require('perf_hooks');const GCE=[];new PerformanceObserver(l=>{for(const e of l.getEntries())GCE.push([e.startTime,e.duration]);}).observe({entryTypes:['gc']});
const pct=(s,q)=>s[Math.min(s.length-1,Math.floor(s.length*q))];
const through=async()=>{for(let t=0;t<30000;t+=100){if(xe('running')&&!xe('!!window.xLdOn')&&!H.shown('pre')&&!H.shown('xAg'))return true;
 if(H.shown('pre'))H.$('preGo').click();else if(H.shown('xAg')){const tiles=H.doc.querySelectorAll('#xAg .x-ag');const tile=tiles.find(b=>b.dataset.a===AGENT&&!b.disabled)||tiles.find(b=>!b.disabled);if(tile)tile.click();await adv(20);H.$('xAgL').click();}
 await adv(100);}return false;};
xe(`window.__qa={
 los:(a,b)=>{try{return los(a,b);}catch(e){return true;}},
 ring(p,r,a){for(let k=0;k<24;k++){const t=a+(k%2?1:-1)*Math.floor((k+1)/2)*0.22,x=p.x+Math.sin(t)*r,z=p.z+Math.cos(t)*r,y=p.y||0;const gy=(typeof groundAt==="function")?groundAt(x,z,0.5,y+1):y;if(Math.abs(gy-y)>1.2)continue;
  if(!(typeof blocked==="function"&&blocked(x,z,0.45,gy))&&__qa.los(new THREE.Vector3(x,gy+1.5,z),new THREE.Vector3(p.x,y+1.4,p.z)))return [x,gy,z];}return null;},
 face(b,p){const q=b.g.position;b.g.rotation.y=Math.atan2(p.x-q.x,p.z-q.z);},
 god(){if(player){player.hp=Math.max(player.hp,1000);player.armor=50;}},
 aimAt(b){const q=b.g.position,dx=q.x-player.x,dz=q.z-player.z,dy=(q.y||0)+1.2-((player.y||0)+1.6);yaw=Math.atan2(-dx,-dz);pitch=Math.atan2(dy,Math.hypot(dx,dz));},
};true`);
// the stress window: n frames of 17 ms. Player: full-auto at the target E0 (re-aimed every frame like a tracking player),
// C at frame 20, Q at 80, E at 140, X at 200; each key is held 4 frames, then a click 20 frames later if an ability is
// equipped (throw / place / fire), a second click 36 frames after that (follow-ups: Blade Storm knives, Showstopper rocket,
// Hunter's Fury blasts, recasts). The gun fires whenever nothing is equipped. E0 shoots back (god-mode player),
// E1 / E2 / two allies stand 6-14 m away with full charges and full ult points (their own logic decides what to cast).
const ABIL={20:'KeyC',80:'KeyQ',140:'KeyE',200:'KeyX'};
// KEEP_ROUND=1 (test_ability_first_cast_warm): enemies stay alive (hp >= 1000 every frame) so the round cannot end inside the window;
// on the integrated tree (2026-11-04) Breach's allies eliminated the last 3 enemies by frame 107 and the buy phase refused Q / E / X.
// Off by default: test_combat_stress_perf / --hash windows are unchanged.
const KEEP=process.env.KEEP_ROUND==='1';
async function stress(rep){
 // set the scene (not measured)
 xe(`(()=>{const M=K().mx;J.c=Math.max(J.c|0,M.c||1);J.q=Math.max(J.q|0,M.q||1);J.e=Math.max(J.e|0,M.e||1);J.ult=K().u;J.cd={c:0,q:0,e:0,x:0};__qa.god();
  const E=bots.filter(b=>b.alive),Al=allies.filter(a=>a.alive);window.__E0=E[0];
  for(let i=0;i<E.length&&i<3;i++){const b=E[i];b.hp=100;const s=__qa.ring(player,10+i*2.5,i*0.6-0.3);if(s){b.g.position.set(s[0],s[1],s[2]);b.g.updateMatrixWorld(true);}__qa.face(b,player);b.cd=0;}
  for(let i=0;i<Al.length&&i<2;i++){const a=Al[i];const s=__qa.ring(player,4+i*2,Math.PI+i*0.8);if(s){a.g.position.set(s[0],s[1],s[2]);a.g.updateMatrixWorld(true);}}
  const near=E.slice(0,3).concat(Al.slice(0,2));for(const u of near){try{const k=xBCh(u);if(k){k.c=Math.max(k.c,2);k.q=Math.max(k.q,2);k.e=Math.max(k.e,1);}}catch(e){}
   try{const a=xAg(u),m=window.xBotUltCost&&xBotUltCost(a);if(m&&window.xBotUC)xBotUC[u.name]=m;}catch(e){}}
  if(E[0])__qa.aimAt(E[0]);ammo=Math.max(ammo,30);reloading=0;fcd=0;return 1;})()`);
 await adv(100);
 emu();xe('__REC.obj=__REC.dom=__REC.html=__REC.txt=__REC.sty=__REC.lay=0;__REC.sites=new Map();__REC.on=true;true');
 if(PROF){await post('Profiler.enable');await post('Profiler.setSamplingInterval',{interval:100});await post('Profiler.start');}
 xe('__PS.live=true;__PS.progNew.length=0;__PS.up&&(__PS.up.length=0);__PS.geoWho=[];true');
 const casts=[],fr=[],cpu=[],T=[],TP=[],E={prog:0,tex:0,geo:0},per=[],hash=crypto.createHash('sha1'),dom=[];let mouse=false,eqT=-1,lastK=null;
 const setMouse=v=>{if(v!==mouse){H.mouse(0,v);mouse=v;}};
 for(let i=0;i<NF;i++){
  // input for this frame (not measured): ability keys + clicks, tracking aim at E0, full-auto otherwise
  const k=ABIL[i];if(k){setMouse(false);H.key(k,true);lastK=k;eqT=i;}
  if(eqT>=0&&i===eqT+4)H.key(lastK,false);
  const eq=xe('!!(J.eq&&J.eq.st!=="rec")||!!J.bsOn||(typeof rw!=="undefined"&&rw==="knife")');
  if(eqT>=0&&(i===eqT+24||i===eqT+60)){setMouse(true);}else if(eqT>=0&&(i===eqT+28||i===eqT+64)){setMouse(false);}
  else if(!(eqT>=0&&i>=eqT&&i<eqT+70&&eq)){xe('if(window.__E0&&__E0.alive){__qa.aimAt(__E0);__E0.hp=100;__E0.cd=Math.min(__E0.cd,0.05);}ammo=Math.max(ammo,5);true');setMouse(true);}
  xe(KEEP?'__qa.god();for(const b of bots)if(b&&b.alive&&b.hp<1000)b.hp=1000;true':'__qa.god();true');
  const pa=PF.now(),c0=process.threadCpuUsage(),a=process.hrtime.bigint();H.advance(17);const b=process.hrtime.bigint();const ms=Number(b-a)/1e6;const cu=process.threadCpuUsage(c0);
  fr.push(ms);cpu.push((cu.user+cu.system)/1000);T.push([pa,PF.now()]);TP.push([Number(a/1000n),Number(b/1000n)]);
  const e=emu();E.prog+=e.prog||0;E.tex+=e.tex||0;E.geo+=e.geo||0;per.push([e.prog||0,e.tex||0,e.geo||0]);
  dom.push(JSON.parse(xe('JSON.stringify([__REC.dom,__REC.html,__REC.txt,__REC.sty,__REC.lay,__REC.obj])')));
  if(HASH)hash.update(xe('__bh()'));
  if(i===19||i===79||i===139||i===199||i===NF-1)casts.push(xe('JSON.stringify([J.c,J.q,J.e,J.ult])'));
  if(i%10===9)await tick();
 }
 setMouse(false);
 let prof=null;if(PROF){const cp=(await post('Profiler.stop')).profile;prof=profSplit(cp,TP,cpu);}
 await new Promise(r=>setTimeout(r,5));const gcF=T.map(([a,b])=>GCE.filter(g=>g[0]<b&&g[0]+g[1]>a).reduce((t,g)=>t+g[1],0));
 xe('__REC.on=false;true');const PN=JSON.parse(xe('JSON.stringify(__PS.progNew.map(p=>p.obj+" | "+p.key.slice(0,140)+(p.site?" @ "+p.site:"")))'));xe('__PS.live=false;true');
 const s=[...fr].sort((x,y)=>x-y),cs=[...cpu].sort((x,y)=>x-y),imax=fr.indexOf(s[s.length-1]);
 const d1=dom[dom.length-1],dd=(i,j)=>dom[i][j]-(i?dom[i-1][j]:0),worst=[...cpu.keys()].sort((x,y)=>cpu[y]-cpu[x]).slice(0,8).map(i=>({i,cpu:+cpu[i].toFixed(1),ms:+fr[i].toFixed(1),gc:+gcF[i].toFixed(1),prog:per[i][0],tex:per[i][1],geo:per[i][2],obj:dd(i,5),txt:dd(i,2),lay:dd(i,4)}));
 const row={agent:AGENT,rep,frames:NF,cpuP50:+pct(cs,.5).toFixed(2),cpuP99:+pct(cs,.99).toFixed(2),p50:+pct(s,.5).toFixed(2),p95:+pct(s,.95).toFixed(2),p99:+pct(s,.99).toFixed(2),max:+s[s.length-1].toFixed(2),mean:+(fr.reduce((a,b)=>a+b,0)/NF).toFixed(2),
  cpuP95:+pct(cs,.95).toFixed(2),cpuMax:+cs[cs.length-1].toFixed(2),long25:fr.filter(x=>x>25).length,gcms:+gcF.reduce((a,b)=>a+b,0).toFixed(1),gcMax:+Math.max(...gcF).toFixed(1),gcAtMax:+gcF[imax].toFixed(1),
  casts:casts.map(x=>JSON.parse(x)),geoWho:JSON.parse(xe('JSON.stringify((__PS.geoWho||[]).slice(0,40))')),prog:E.prog,progs:PN.slice(0,12),tex:E.tex,texs:JSON.parse(xe('JSON.stringify((__PS.up||[]).filter(u=>u.live).slice(0,12).map(u=>u.who+" | "+u.n+" "+u.w+"x"+u.h))')),geo:E.geo,dom:{create:d1[0],html:d1[1],text:d1[2],style:d1[3],layoutReads:d1[4]},objs:d1[5],worst,
  J:JSON.parse(xe('JSON.stringify({c:J.c,q:J.q,e:J.e,ult:J.ult,bs:!!J.bsOn,sm:(J.smokes||[]).length,w:(J.walls||[]).length,z:(J.zones||[]).length,uc:Object.assign({},window.xBotUC||{})})')),
  hash:HASH?hash.digest('hex').slice(0,16):undefined,inj:INJ?JSON.parse(xe('JSON.stringify(typeof __INJ==="function"?__INJ():null)')):undefined,sites:process.env.SITES?JSON.parse(xe('JSON.stringify([...__REC.sites].sort((a,b)=>b[1]-a[1]).slice(0,40))')):undefined,prof};
 return row;
}
// profile: self ms per function over all frames and over the worst 5% frames (sample timestamps vs frame windows, both on
// the monotonic clock in us)
function profSplit(cp,TP,fr){const byId=new Map(cp.nodes.map(x=>[x.id,x])),key=x=>x.callFrame.functionName+' '+x.callFrame.url.split('/').pop()+':'+(x.callFrame.lineNumber+1);
 const thr=[...fr].sort((a,b)=>a-b)[Math.floor(fr.length*.95)],worstW=TP.filter((w,i)=>fr[i]>=thr);
 const parent=new Map();for(const x of cp.nodes)for(const c of x.children||[])parent.set(c,x.id);
 // owner: the first page (index.html) frame on the sample's stack, so harness DOM / emulated-render / three time is charged to the page function that asked for it
 const own=new Map(),owner=n=>{let c=own.get(n.id);if(c)return c;let x=n;while(x&&!/index\.html$/.test(x.callFrame.url))x=byId.get(parent.get(x.id));c=x?key(x):'(no page frame) '+key(n);own.set(n.id,c);return c;};
 const all=new Map(),wst=new Map(),oAll=new Map(),oW=new Map(),oc=new Map();let t=cp.startTime;
 for(let i=0;i<cp.samples.length;i++){t+=cp.timeDeltas[i]||0;const dt=(cp.timeDeltas[i+1]||0)/1000,n=byId.get(cp.samples[i]),k=key(n);if(/^\((idle|program|root)\)/.test(k))continue;
  const o=owner(n),w=worstW.some(([a,b])=>t>=a&&t<=b);{let x=n;while(x&&!/index\.html$/.test(x.callFrame.url))x=byId.get(parent.get(x.id));const ch=[];if(x){let y=byId.get(parent.get(x.id));while(y&&ch.length<3){if(/index\.html$/.test(y.callFrame.url))ch.push(y.callFrame.functionName||'(anon)');y=byId.get(parent.get(y.id));}}const kc=o+' <- '+ch.join(' <- ');oc.set(kc,(oc.get(kc)||0)+dt);}all.set(k,(all.get(k)||0)+dt);oAll.set(o,(oAll.get(o)||0)+dt);if(w){wst.set(k,(wst.get(k)||0)+dt);oW.set(o,(oW.get(o)||0)+dt);}}
 const top=(m,n)=>[...m].sort((a,b)=>b[1]-a[1]).slice(0,n).map(([k,v])=>[+v.toFixed(1),k]);
 const w3=[...fr.keys()].sort((a,b)=>fr[b]-fr[a]).slice(0,3).map(i=>{const m=new Map();let t2=cp.startTime;const [a,b]=TP[i];for(let j=0;j<cp.samples.length;j++){t2+=cp.timeDeltas[j]||0;if(t2<a||t2>b)continue;const dt=(cp.timeDeltas[j+1]||0)/1000,k=owner(byId.get(cp.samples[j]));m.set(k,(m.get(k)||0)+dt);}return {i,cpu:+fr[i].toFixed(1),top:top(m,8)};});
 return {self:top(all,30),worstSelf:top(wst,25),owner:top(oAll,30),chains:top(oc,25),worstOwner:top(oW,25),worstFrames:worstW.length,thr:+thr.toFixed(1),w3};}
(async()=>{
 const T0=Date.now();
 xe(`FV.pick="ascent";true`);H.$('pm5v5').click();await adv(50);if(!(await through()))throw Error('match did not start');
 for(let i=0;i<3000&&xe('bots.concat(allies).some(b=>b.xm&&!b.xm.valorant)');i++){H.advance(17);await new Promise(r=>setTimeout(r,10));}
 // the real loading gate builds the match then runs xWarmShaders behind the overlay; the harness stubs the agent wait, so run it here once the rigs are in
 xe('xPC=false;if(typeof window.xWarmShaders==="function")window.xWarmShaders();true');
 const info={agent:AGENT,pick:xe('J.pick'),seed:SEED,rigs:xe('bots.concat(allies).filter(b=>b.xm&&b.xm.valorant).length'),bots:xe('JSON.stringify(bots.concat(allies).map(b=>b.name+"="+(()=>{try{return xAg(b)}catch(e){return "?"}})()))')};
 console.log('agent',info.pick,'rigs',info.rigs,info.bots);
 await adv(1500);xe('FV.buy=0.02;true');await adv(800);
 const runs=[];
 for(let r=0;r<REPS;r++){const row=await stress(r);runs.push(row);const {prof,sites,...rest}=row;console.log('RUN',JSON.stringify(rest));if(sites)sites.slice(0,25).forEach(x=>console.log('  SITE',x[1],x[0].slice(0,260)));
  if(prof){console.log('  worst-frame self ms (>= p95 '+prof.thr+' ms, '+prof.worstFrames+' frames):');prof.worstSelf.slice(0,15).forEach(x=>console.log('    ',x[0],x[1]));console.log('  all-frame self ms:');prof.self.slice(0,15).forEach(x=>console.log('    ',x[0],x[1]));console.log('  worst-frame page owners:');prof.worstOwner.slice(0,15).forEach(x=>console.log('    ',x[0],x[1]));console.log('  owner chains:');prof.chains.slice(0,15).forEach(x=>console.log('    ',x[0],x[1]));console.log('  all-frame page owners:');prof.owner.slice(0,20).forEach(x=>console.log('    ',x[0],x[1]));prof.w3.forEach(w=>console.log('  frame',w.i,'cpu',w.cpu,JSON.stringify(w.top)));}
  xe('for(const b of bots.concat(allies))if(b&&!b.alive&&typeof fRespawn==="function"){}true');await adv(1500);}
 const res={...info,runs,errors:H.errors.slice(0,5),secs:Math.round((Date.now()-T0)/1000)};
 if(OUT)fs.writeFileSync(OUT,JSON.stringify(res,null,1));
 console.log('errors',H.errors.length,JSON.stringify(H.errors.slice(0,3)));console.log('secs',res.secs);process.exit(0);
})().catch(e=>{console.error(e);process.exit(1);});
