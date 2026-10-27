// Sustained-fire bench (a tool, not in test_all): "whenever I shoot at enemies, it starts lagging a lot".
// Boots the real page on the native Ascent map (page_harness native:true, real three.js scene graph, WebGL stubbed),
// starts an offline 5v5, freezes bot fire, then runs frames of 17 ms on the harness clock while the player holds fire:
//   hit  : the crosshair on a bot 8 m ahead (hp topped up each frame so it never dies)
//   miss : the same frames with the bot 1.4 m to the side (still on screen; the shots hit the map behind it)
//   wall : crosshair on the bot but the bot moved 30 m aside (shots fly over open map)
// Per scenario: shots fired, mean / p95 JS ms per frame (shot + loop), page-side THREE objects constructed per frame,
// sampled page allocation KB per frame, and (--prof hit|miss) a CPU profile of the scenario's frames.
//   node work/bench_shoot_enemy.cjs [--frames 240] [--prof hit] [--json out.json]
const fs=require('fs'),path=require('path');
const {boot}=require('./page_harness.cjs');
const arg=k=>{const i=process.argv.indexOf(k);return i>0?process.argv[i+1]:null;},F=+(arg('--frames')||240),PROF=arg('--prof'),OUT=arg('--json');
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const fnSrc=name=>{const a=html.indexOf('function '+name+'(');if(a<0)throw Error(name);let i=html.indexOf('{',a),d=0;for(;i<html.length;i++){if(html[i]==='{')d++;else if(html[i]==='}'&&!--d)break;}return html.slice(a,i+1);};
const H=boot({real3:true,seed:7,native:!process.env.LEGACY,fastGlobal:true}),xe=H.xe,adv=async ms=>{for(let t=0;t<ms;t+=50){H.advance(Math.min(50,ms-t));await new Promise(r=>setImmediate(r));}};
xe(`{const g=document.getElementById.bind(document),C=new Map();document.getElementById=function(id){const e=C.get(id);if(e&&e.id===id)return e;const r=g(id);if(r)C.set(id,r);return r;};}true`);
xe(fs.readFileSync(path.join(__dirname,'..','vendor','hit-impact.js'),'utf8')+';true');
const through=async()=>{for(let t=0;t<30000;t+=100){if(xe('running')&&!xe('!!window.xLdOn')&&!H.shown('pre')&&!H.shown('xAg'))return true;
 if(H.shown('pre'))H.$('preGo').click();else if(H.shown('xAg')){const tile=H.doc.querySelectorAll('#xAg .x-ag').find(b=>!b.disabled);if(tile)tile.click();await adv(20);H.$('xAgL').click();}
 await adv(100);}return false;};
// real agent rigs (AGENTS=0 keeps the harness's no-model stand-ins): the page's own loader on models/valorant/agents/*.glb,
// textures replaced by empty THREE.Textures (no image decode in Node; the renderer is stubbed anyway)
const AGENTS=process.env.AGENTS!=='0';
if(AGENTS)xe(`xvaParse=function(buf){return new Promise((res,rej)=>{const L=new THREE.GLTFLoader();L.register(p=>({name:'EXT_texture_webp',loadTexture:()=>Promise.resolve(new THREE.Texture())}));L.parse(buf,XVA.dir,res,rej);});};true`);
xe(`window.__qaC=0;(function(){for(const k of Object.keys(THREE)){const C=THREE[k];if(typeof C!=="function"||!C.prototype||!/^[A-Z]/.test(k))continue;
 const W=class extends C{constructor(...a){super(...a);__qaC++;}};Object.defineProperty(W,"name",{value:k});try{THREE[k]=W;}catch(e){}}})();true`);
// JS-side render model (work/perf_render_emu.js): counts draws / programs / uploads a real WebGLRenderer would issue
xe(fs.readFileSync(path.join(__dirname,'perf_render_emu.js'),'utf8')+';true');const emu0=()=>xe('JSON.stringify(__PS.endFrame())');
const {Session}=require('inspector'),HS=new Session();HS.connect();const post=(m,p)=>new Promise((ok,no)=>HS.post(m,p||{},(e,r)=>e?no(e):ok(r)));
const pageBytes=hp=>{let b=0;(function w(x){const u=x.callFrame.url;if(x.selfSize&&!/^node:|bench_shoot_enemy|page_harness/.test(u)&&x.callFrame.functionName!=='#onMessage')b+=x.selfSize;for(const c of x.children||[])w(c);})(hp.head);return b;};
const place=(kind)=>`(()=>{const b=window.__qaB&&window.__qaB.alive?window.__qaB:bots.find(x=>x.alive);if(!b)return 0;window.__qaB=b;b.alive=true;b.hp=100;b.armor=0;b.cd=1e9;
  b.g.position.set(player.x${kind==='wall'?'+30':kind==='miss'?'+1.4':''},player.y||0,player.z-8);b.g.updateMatrixWorld(true);player.hp=100;yaw=0;pitch=0;
  camera.position.set(player.x,(player.y||0)+1.6,player.z);camera.rotation.set(pitch,0,0,"YXZ");camera.updateMatrixWorld(true);
  ammo=30;reloading=0;VM.sw=0;try{spray=0;rcl=0;rclH=0;}catch(e){}return 1;})()`;
async function profStart(){await post('Profiler.enable');await post('Profiler.setSamplingInterval',{interval:100});await post('Profiler.start');}
async function profStop(label){const {profile:cp}=await post('Profiler.stop');const byId=new Map(cp.nodes.map(x=>[x.id,x])),cnt=new Map();for(const id of cp.samples)cnt.set(id,(cnt.get(id)||0)+1);
 const dt=new Map();cp.samples.forEach((id,i)=>dt.set(id,(dt.get(id)||0)+(cp.timeDeltas[i+1]||0)/1000));
 const incl=new Map(),self=new Map();const key=x=>x.callFrame.functionName+' '+x.callFrame.url.split('/').pop()+':'+(x.callFrame.lineNumber+1);
 (function walk(x,stack){const k=key(x),own=dt.get(x.id)||0;let sum=own;self.set(k,(self.get(k)||0)+own);for(const c of (x.children||[]).map(i=>byId.get(i)))sum+=walk(c,stack.concat(k));if(!stack.includes(k))incl.set(k,(incl.get(k)||0)+sum);return sum;})(cp.nodes[0],[]);
 console.log(`[${label}] inclusive ms top 40:`);[...incl].filter(([k])=>!/^\((root|program|idle)\)/.test(k)).sort((a,b)=>b[1]-a[1]).slice(0,40).forEach(([k,v])=>console.log('  ',v.toFixed(1),k));
 console.log(`[${label}] self ms top 25:`);[...self].sort((a,b)=>b[1]-a[1]).slice(0,25).forEach(([k,v])=>console.log('  ',v.toFixed(1),k));}
async function scenario(kind,prof){
 const P=place(kind),fire=`(${P})&&(fcd<=0?(window.__qaN=(window.__qaN||0)+1,shoot(false),1):1)`;
 for(let i=0;i<30;i++){xe(fire);H.advance(17);} // warm
 xe('window.__qaN=0;true');const c0=xe('__qaC'),ts=[];
 const E={calls:0,tris:0,prog:0,tex:0,geo:0,attr:0,attrBytes:0};emu0();
 for(let i=0;i<F;i++){const a=process.hrtime.bigint();xe(fire);H.advance(17);ts.push(Number(process.hrtime.bigint()-a)/1e6);const e=JSON.parse(emu0());for(const k in E)E[k]+=e[k]||0;}
 for(const k in E)E[k]=+(E[k]/F).toFixed(2);
 const shots=xe('__qaN'),objs=(xe('__qaC')-c0)/F;
 await post('HeapProfiler.enable');await post('HeapProfiler.startSampling',{samplingInterval:512});
 for(let i=0;i<F;i++){xe(fire);H.advance(17);}
 const {profile:hp}=await post('HeapProfiler.stopSampling');
 if(prof){await post('Profiler.enable');await post('Profiler.setSamplingInterval',{interval:100});await post('Profiler.start');
  for(let i=0;i<F;i++){xe(fire);H.advance(17);}
  const {profile:cp}=await post('Profiler.stop');const byId=new Map(cp.nodes.map(x=>[x.id,x])),cnt=new Map();for(const id of cp.samples)cnt.set(id,(cnt.get(id)||0)+1);
  const tot=cp.samples.length,incl=new Map(),self=new Map();const key=x=>x.callFrame.functionName+' '+x.callFrame.url.split('/').pop()+':'+(x.callFrame.lineNumber+1);
  (function walk(x,stack){const k=key(x),own=cnt.get(x.id)||0;let sum=own;self.set(k,(self.get(k)||0)+own);const st=new Set(stack);st.add(k);for(const c of (x.children||[]).map(i=>byId.get(i)))sum+=walk(c,[...st]);if(!stack.includes(k))incl.set(k,(incl.get(k)||0)+sum);return sum;})(cp.nodes[0],[]);
  console.log(`[${kind}] inclusive top 30:`);[...incl].sort((a,b)=>b[1]-a[1]).slice(0,30).forEach(([k,v])=>console.log('  ',(v/tot*100).toFixed(1)+'%',k));
  console.log(`[${kind}] self top 20:`);[...self].sort((a,b)=>b[1]-a[1]).slice(0,20).forEach(([k,v])=>console.log('  ',(v/tot*100).toFixed(1)+'%',k));}
 const s=[...ts].sort((a,b)=>a-b);
 const r={frames:F,shots,meanMs:+(ts.reduce((a,b)=>a+b,0)/F).toFixed(3),p95Ms:+s[Math.floor(F*.95)].toFixed(3),maxMs:+s[F-1].toFixed(3),threeObjPerFrame:+objs.toFixed(2),allocKBPerFrame:+(pageBytes(hp)/1024/F).toFixed(2),render:E,botHp:xe('__qaB.hp')};
 console.log(kind.padEnd(5),JSON.stringify(r));return r;}
(async()=>{
 xe('FV.pick="ascent";true');H.$('pm5v5').click();await adv(50);if(!(await through()))throw Error('match did not start');
 console.log('native map:',xe('!!(typeof nmActive==="function"&&nmActive())'));
 if(AGENTS){const t0=Date.now(); // models wait (hidden) for their kit and attach when it lands (xvAttach)
  for(let i=0;i<3000&&xe('bots.concat(allies).some(b=>b.xm&&!b.xm.valorant)');i++){H.advance(17);await new Promise(r=>setTimeout(r,10));}
  console.log('agent kits:',xe('Object.keys(XVA.kits).join(",")'),((Date.now()-t0)/1000).toFixed(1)+' s');}
 xe('FV.buy=0.05;true');await adv(1500);
 console.log('native rigs on units:',xe('bots.concat(allies).filter(b=>b.xm&&b.xm.valorant).length'),'/',xe('bots.length+allies.length'));xe('bots.forEach(b=>{b.cd=1e9});allies.forEach(a=>{a.cd=1e9});try{xHitInit()}catch(e){}true');
 // first contact per bot: the first hit on each bot, then a kill of each (hp 1), with the shot's own ms, the next 3 frames
 // and the render model's new programs / texture uploads / geometries over those frames
 if(process.env.FIRST!=='0'){xe('__PS.live=true;true');const who=()=>xe(`JSON.stringify({prog:__PS.progNew.map(p=>[p.f,p.obj,p.key.slice(0,90)]),up:__PS.up.filter(u=>u.live).map(u=>[u.f,u.w,u.h,u.who||u.name||'']),geo:(__PS.geoWho||[]),mat:(__PS.matWho||[])})`);
  const one=async(i,hp)=>{const ok=xe(`(()=>{const L=bots.filter(x=>x.alive);const b=L[${i}]||null;if(!b)return 0;window.__qaB=b;return 1;})()`);if(!ok)return null;
   xe(place('hit'));xe(`__qaB.hp=${hp};fcd=0;true`);emu0();const c0=xe('__qaC'),a=process.hrtime.bigint();xe('shoot(false)');const shot=Number(process.hrtime.bigint()-a)/1e6;const fr=[];const E={prog:0,tex:0,geo:0,calls:0};
   for(let k=0;k<3;k++){const t=process.hrtime.bigint();H.advance(17);fr.push(+(Number(process.hrtime.bigint()-t)/1e6).toFixed(2));const e=JSON.parse(emu0());E.prog+=e.prog;E.tex+=e.tex;E.geo+=e.geo;E.calls=e.calls;}
   return {name:xe('__qaB.name'),shot:+shot.toFixed(2),frames:fr,obj:xe('__qaC')-c0,hp:xe('__qaB.hp'),alive:xe('__qaB.alive'),...E};};
  if(PROF==='first')await profStart();
  const firsts=[];for(let i=0;i<5;i++){const r=await one(i,100);if(r)firsts.push(r);}console.log('first hit per bot',JSON.stringify(firsts));console.log('  new GPU work:',who());
  const kills=[];for(let i=0;i<3;i++){const r=await one(0,1);if(r)kills.push(r);}console.log('kills',JSON.stringify(kills));console.log('  new GPU work:',who());if(PROF==='first')await profStop('first hits + kills');
  xe('window.__qaB=null;true');}
 // corpse cost: per-frame JS before and after a kill (the kill builds a ragdoll that re-solves ~30 Hz for up to 4 s)
 if(process.env.CORPSE!=='0'){H.win.__hr=()=>Number(process.hrtime.bigint())/1e6;
  xe(`window.__RG={ms:0,n:0,first:0,comp:0};{const P=THREE.Matrix4.prototype,c0=P.compose;P.compose=function(){__RG.comp++;return c0.apply(this,arguments);};}
   {const t0=xrRagdollTick;xrRagdollTick=function(M){const a=__hr(),built=!!M.ragdoll,r=t0.apply(this,arguments),d=__hr()-a;if(!built&&M.ragdoll)__RG.first+=d;else{__RG.ms+=d;__RG.n++;}return r;};}true`);
  const win=async(label,n)=>{xe('__RG.ms=0;__RG.n=0;__RG.first=0;__RG.comp=0;true');const ts=[];for(let i=0;i<n;i++){const a=process.hrtime.bigint();H.advance(17);ts.push(Number(process.hrtime.bigint()-a)/1e6);}
   const r=JSON.parse(xe('JSON.stringify(__RG)'));const o={label,frames:n,frameMs:+(ts.reduce((x,y)=>x+y,0)/n).toFixed(2),ragdollBuildMs:+r.first.toFixed(2),ragdollTicks:r.n,ragdollMsPerTick:+(r.ms/Math.max(1,r.n)).toFixed(3),ragdollMsPerFrame:+(r.ms/n).toFixed(3),composePerFrame:+(r.comp/n).toFixed(1)};console.log('corpse',JSON.stringify(o));return o;};
  const live=xe('bots.filter(b=>b.alive).length');await win('no corpse',60);
  for(let k=0;k<Math.min(2,live-1);k++){xe('window.__qaB=bots.find(x=>x.alive);true');xe(place('hit'));xe('__qaB.hp=1;fcd=0;shoot(false);true');}
  console.log('killed',xe('bots.filter(b=>!b.alive).length'));await win('0-1 s after 2 kills',60);await win('1-2 s',60);await win('2-3 s',60);await win('3-4.5 s',90);
  xe('window.__qaB=null;true');}
 // live: bot AI runs untouched (no teleport); each frame the player stands 7 m from one enemy with a clear line and aims at
 // its chest; 'fire' holds the trigger, 'aim' does not. Bots never die (hp topped up) and never shoot back (cd), so the
 // difference is what being shot does to the AI and the hit path. Counted per frame: native A* (nmPath), uncached sight
 // rays (losRaw), Raycaster.intersectObjects calls, nmNext (re-plans).
 if(process.env.LIVE!=='0'){
  xe(`window.__LV={nmPath:0,losRaw:0,ray:0,nmNext:0};{const f=nmPath;nmPath=function(){__LV.nmPath++;return f.apply(this,arguments);};}{const f=losRaw;losRaw=function(){__LV.losRaw++;return f.apply(this,arguments);};}
   {const f=nmNext;nmNext=function(){__LV.nmNext++;return f.apply(this,arguments);};}{const P=Object.getPrototypeOf(new THREE.Raycaster()),f=P.intersectObjects;P.intersectObjects=function(){__LV.ray++;return f.apply(this,arguments);};}true`);
  const step=fire=>`(()=>{for(const b of bots){b.cd=1e9;if(b.alive)b.hp=100;}const t=window.__qaT&&window.__qaT.alive?window.__qaT:(window.__qaT=bots.find(x=>x.alive));if(!t)return 0;const q=t.g.position;
   let best=null;for(let k=0;k<8;k++){const a=k*Math.PI/4+(window.__qaA||0),x=q.x+Math.sin(a)*7,z=q.z+Math.cos(a)*7,y=q.y;if(los(new THREE.Vector3(x,y+1.6,z),new THREE.Vector3(q.x,q.y+1.3,q.z))){best=[x,y,z,a];break;}}
   if(!best)best=[q.x+7,q.y,q.z,0];window.__qaA=best[3];player.x=best[0];player.y=best[1];player.z=best[2];player.vx=player.vz=0;player.hp=100;
   const dx=q.x-best[0],dz=q.z-best[2],dy=q.y+1.2-(best[1]+1.6);yaw=Math.atan2(-dx,-dz);pitch=Math.atan2(dy,Math.hypot(dx,dz));
   ammo=30;reloading=0;VM.sw=0;fireHeld=${fire};${fire}&&fcd<=0&&(window.__qaN=(window.__qaN||0)+1,shoot(false));return 1;})()`;
  const live=async(kind,n)=>{const st=step(kind==='fire');for(let i=0;i<30;i++){xe(st);H.advance(17);}xe('window.__qaN=0;__LV.nmPath=0;__LV.losRaw=0;__LV.ray=0;__LV.nmNext=0;true');
   const hp0=xe('JSON.stringify(bots.map(b=>b.hp))'),ts=[];let hits=0;xe('window.__qaH=0;{const h=hurt;if(!window.__qaHW){window.__qaHW=1;hurt=function(t,n,by){if(bots.includes(t)&&by===undefined)__qaH++;return h.apply(this,arguments);};}}true');
   for(let i=0;i<n;i++){const a=process.hrtime.bigint();xe(st);H.advance(17);ts.push(Number(process.hrtime.bigint()-a)/1e6);}
   const L=JSON.parse(xe('JSON.stringify(__LV)')),r={kind,frames:n,shots:xe('window.__qaN'),hits:xe('__qaH'),frameMs:+(ts.reduce((x,y)=>x+y,0)/n).toFixed(2),p95:+[...ts].sort((x,y)=>x-y)[Math.floor(n*.95)].toFixed(2)};
   for(const k in L)r[k+'PerFrame']=+(L[k]/n).toFixed(2);console.log('live',JSON.stringify(r));return r;};
  for(const k of ['aim','fire','aim','fire'])await live(k,+(process.env.LIVEN||180));xe('fireHeld=false;window.__qaB=null;true');}
 // view: the cost of enemy agents being on screen (what aiming at / shooting enemies brings into view). Five bots stand
 // 6-10 m in front of the camera ('front') or behind it ('behind'); no shots. Per frame: ms in xSolTick (agent animation,
 // pose follow-ups, hit volumes) and in xrHitboxes alone, Object3D.updateMatrix calls (local matrix composes),
 // getObjectByName calls.
 if(process.env.VIEW!=='0'){H.win.__hr=()=>Number(process.hrtime.bigint())/1e6;
  xe(`window.__VW={sol:0,hb:0,um:0,gobn:0};{let p=scene;while(p&&!Object.prototype.hasOwnProperty.call(p,'updateMatrix'))p=Object.getPrototypeOf(p);const u=p.updateMatrix;p.updateMatrix=function(){__VW.um++;return u.call(this);};const g=p.getObjectByName;p.getObjectByName=function(n){__VW.gobn++;return g.call(this,n);};}
   {const f=xSolTick;xSolTick=function(){const a=__hr();try{return f.apply(this,arguments);}finally{__VW.sol+=__hr()-a;}};}{const f=xrHitboxes;xrHitboxes=function(){const a=__hr();try{return f.apply(this,arguments);}finally{__VW.hb+=__hr()-a;}};}true`);
  const put=front=>`(()=>{let i=0;for(const b of bots){if(!b.alive)continue;b.cd=1e9;b.hp=100;const x=player.x+(i-2)*1.6,z=player.z+(${front}?-1:1)*(6+i);b.g.position.set(x,player.y||0,z);b.g.updateMatrixWorld(true);i++;}
   yaw=0;pitch=0;camera.position.set(player.x,(player.y||0)+1.6,player.z);camera.rotation.set(0,0,0,"YXZ");camera.updateMatrixWorld(true);fireHeld=false;return i;})()`;
  const view=async(front,n)=>{const st=put(front);for(let i=0;i<20;i++){xe(st);H.advance(17);}xe('__VW.sol=0;__VW.hb=0;__VW.um=0;__VW.gobn=0;true');const ts=[];
   const pv=PROF==='view'&&front&&!view.done;if(pv){view.done=1;await profStart();}
   for(let i=0;i<n;i++){xe(st);const a=process.hrtime.bigint();H.advance(17);ts.push(Number(process.hrtime.bigint()-a)/1e6);}
   if(pv)await profStop('5 enemies in view');
   const V=JSON.parse(xe('JSON.stringify(__VW)')),r={where:front?'front':'behind',bots:xe(st),frames:n,frameMs:+(ts.reduce((x,y)=>x+y,0)/n).toFixed(2),xSolTickMs:+(V.sol/n).toFixed(3),xrHitboxesMs:+(V.hb/n).toFixed(3),updateMatrixPerFrame:Math.round(V.um/n),getObjectByNamePerFrame:+(V.gobn/n).toFixed(1)};
   console.log('view',JSON.stringify(r));return r;};
  for(const f of [false,true,false,true])await view(f,+(process.env.VIEWN||120));}
 const res={};const order=(process.env.ORDER||'miss,hit,wall,hit,miss').split(',');
 for(const k of order){const r=await scenario(k,PROF===k&&!res[k]);(res[k]=res[k]||[]).push(r);}
 if(OUT)fs.writeFileSync(OUT,JSON.stringify(res,null,1));
 console.log('errors',H.errors.length,JSON.stringify(H.errors.slice(0,3)));process.exit(0);
})().catch(e=>{console.error(e);process.exit(1);});
