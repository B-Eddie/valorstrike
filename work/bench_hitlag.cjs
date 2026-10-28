// Hit-lag probe (a tool, not in test_all): user 2026-10-28 "there's still a lot of lag when I hit enemies / when bots'
// shots hit me". Boots the real page on native Ascent with real agent rigs (page_harness native + fastGlobal, WebGL
// stubbed, work/perf_render_emu.js counting GPU-side work) and measures the moments of contact:
//   first-hit : the first hit on each enemy (shot ms, next 3 frames, page THREE objects / material+geometry clones by
//               call site, new GPU programs / texture uploads)
//   kill      : a kill (same)
//   fire/aim  : live AI, the player holding fire on an enemy 7 m away vs only aiming (frame ms, p95, by-site allocations)
//   shot/calm : one enemy bot really shooting the player (hp topped up) vs the same bot holding fire
// Every scenario prints where page code constructed THREE objects or cloned materials/geometries (top call sites).
//   node work/bench_hitlag.cjs [--json out.json] [--prof fire|shot|first] [--frames 180]
const fs=require('fs'),path=require('path');
const {boot}=require('./page_harness.cjs');
const arg=k=>{const i=process.argv.indexOf(k);return i>0?process.argv[i+1]:null;},F=+(arg('--frames')||180),PROF=arg('--prof'),OUT=arg('--json');
const H=boot({real3:true,seed:7,native:true,fastGlobal:true}),xe=H.xe,adv=async ms=>{for(let t=0;t<ms;t+=50){H.advance(Math.min(50,ms-t));await new Promise(r=>setImmediate(r));}};
xe(`{const g=document.getElementById.bind(document),C=new Map();document.getElementById=function(id){const e=C.get(id);if(e&&e.id===id)return e;const r=g(id);if(r)C.set(id,r);return r;};}true`);
xe(fs.readFileSync(path.join(__dirname,'..','vendor','hit-impact.js'),'utf8')+';true');
const through=async()=>{for(let t=0;t<30000;t+=100){if(xe('running')&&!xe('!!window.xLdOn')&&!H.shown('pre')&&!H.shown('xAg'))return true;
 if(H.shown('pre'))H.$('preGo').click();else if(H.shown('xAg')){const tile=H.doc.querySelectorAll('#xAg .x-ag').find(b=>!b.disabled);if(tile)tile.click();await adv(20);H.$('xAgL').click();}
 await adv(100);}return false;};
xe(`xvaParse=function(buf){return new Promise((res,rej)=>{const L=new THREE.GLTFLoader();L.register(p=>({name:'EXT_texture_webp',loadTexture:()=>Promise.resolve(new THREE.Texture())}));L.parse(buf,XVA.dir,res,rej);});};true`);
// call-site recorder: page-side THREE constructors and Material/BufferGeometry/Object3D .clone() while __REC.on
xe(`window.__REC={on:false,n:0,sites:new Map()};{const site=()=>{const L=String(new Error().stack).split('\\n').slice(3).filter(l=>!/bench_hitlag|page_harness/.test(l)).slice(0,${+(process.env.DEPTH||4)}).map(l=>l.trim().replace(/^at /,'').replace(/\\(?(?:file:\\/\\/)?[^()]*\\/([^\\/:()]+):(\\d+):\\d+\\)?/,'$1:$2')).join(' < ');return L;};
 const note=k=>{if(!__REC.on||!${process.env.REC!=='0'})return;__REC.n++;const s=k+' @ '+site();__REC.sites.set(s,(__REC.sites.get(s)||0)+1);};window.__note=note;
 for(const k of Object.keys(THREE)){const C=THREE[k];if(typeof C!=="function"||!C.prototype||!/^[A-Z]/.test(k))continue;
  const W=class extends C{constructor(...a){super(...a);note('new '+k);}};Object.defineProperty(W,"name",{value:k});try{THREE[k]=W;}catch(e){}}
 for(const [N,P] of [['Material',THREE.Material.prototype],['BufferGeometry',THREE.BufferGeometry.prototype],['Object3D',THREE.Object3D.prototype],['Texture',THREE.Texture.prototype]]){const c=P.clone;P.clone=function(){note(N+'.clone');return c.apply(this,arguments);};}}
 window.__recTop=(n)=>{const a=[...__REC.sites].sort((x,y)=>y[1]-x[1]).slice(0,n||12);return {total:__REC.n,top:a};};window.__recReset=()=>{__REC.n=0;__REC.sites=new Map();};true`);
// RCLOG=1: every Raycaster call slower than 2 ms, with its call site and the objects it tested (type, name, triangles)
if(process.env.RCLOG){H.win.__hr=()=>Number(process.hrtime.bigint())/1e6;xe(`window.__RCL=[];{const P=THREE.Raycaster.prototype;for(const k of ['intersectObjects','intersectObject']){const f=P[k];P[k]=function(o){const a=__hr(),r=f.apply(this,arguments),d=__hr()-a;
 if(d>2){const L=Array.isArray(o)?o:[o],tri=x=>{let n=0;x.traverse?x.traverse(m=>{if(m.isMesh&&m.geometry){const g=m.geometry;n+=(g.index?g.index.count:(g.attributes.position?g.attributes.position.count:0))/3;}}):0;return n;};
  __RCL.push({k,ms:+d.toFixed(2),n:L.length,rec:arguments[1],far:this.far,objs:L.slice().sort((x,y)=>tri(y)-tri(x)).slice(0,4).map(x=>[x.type,x.name,x.isSkinnedMesh?1:0,Math.round(tri(x)),!!(x.geometry&&x.geometry.boundsTree),x.userData&&Object.keys(x.userData).join('/')]),
  site:String(new Error().stack).split('\\n').slice(2,9).map(l=>l.trim().replace(/^at /,'').replace(/\\(?[^()]*index\\.html:(\\d+):\\d+\\)?/,'@$1')).join(' < ')});}return r;};}}true`);}
xe(fs.readFileSync(path.join(__dirname,'perf_render_emu.js'),'utf8')+';true');const emu=()=>JSON.parse(xe('JSON.stringify(__PS.endFrame())'));
const {Session}=require('inspector'),HS=new Session();HS.connect();const post=(m,p)=>new Promise((ok,no)=>HS.post(m,p||{},(e,r)=>e?no(e):ok(r)));
async function profStart(){await post('Profiler.enable');await post('Profiler.setSamplingInterval',{interval:100});await post('Profiler.start');}
const SHOTP=[];async function profStop(label,merge){const cp0=merge===2?null:(await post('Profiler.stop')).profile;if(merge===1){SHOTP.push(cp0);return null;}const cps=merge===2?SHOTP:[cp0];
 const incl=new Map(),self=new Map(),key=x=>x.callFrame.functionName+' '+x.callFrame.url.split('/').pop()+':'+(x.callFrame.lineNumber+1);
 for(const cp of cps){const byId=new Map(cp.nodes.map(x=>[x.id,x]));const dt=new Map();cp.samples.forEach((id,i)=>dt.set(id,(dt.get(id)||0)+(cp.timeDeltas[i+1]||0)/1000));
 (function walk(x,stack){const k=key(x),own=dt.get(x.id)||0;let sum=own;self.set(k,(self.get(k)||0)+own);for(const c of (x.children||[]).map(i=>byId.get(i)))sum+=walk(c,stack.concat(k));if(!stack.includes(k))incl.set(k,(incl.get(k)||0)+sum);return sum;})(cp.nodes[0],[]);}
 const o={incl:[...incl].filter(([k])=>!/^\((root|program|idle)\)/.test(k)).sort((a,b)=>b[1]-a[1]).slice(0,40).map(([k,v])=>[+v.toFixed(1),k]),self:[...self].sort((a,b)=>b[1]-a[1]).slice(0,25).map(([k,v])=>[+v.toFixed(1),k])};
 console.log(`[${label}] inclusive ms:`);o.incl.forEach(r=>console.log('  ',r[0],r[1]));console.log(`[${label}] self ms:`);o.self.forEach(r=>console.log('  ',r[0],r[1]));return o;}
const place=`(()=>{const b=window.__qaB;b.alive=true;b.cd=1e9;b.g.position.set(player.x,player.y||0,player.z-8);b.g.updateMatrixWorld(true);player.hp=100;yaw=0;pitch=0;
  camera.position.set(player.x,(player.y||0)+1.6,player.z);camera.rotation.set(0,0,0,"YXZ");camera.updateMatrixWorld(true);ammo=30;reloading=0;VM.sw=0;try{spray=0;rcl=0;rclH=0;}catch(e){}return 1;})()`;
const stat=ts=>{const s=[...ts].sort((a,b)=>a-b);return {mean:+(ts.reduce((a,b)=>a+b,0)/ts.length).toFixed(2),p95:+s[Math.floor(s.length*.95)].toFixed(2),max:+s[s.length-1].toFixed(2)};};
const res={};
(async()=>{
 xe('FV.pick="ascent";true');H.$('pm5v5').click();await adv(50);if(!(await through()))throw Error('match did not start');
 for(let i=0;i<3000&&xe('bots.concat(allies).some(b=>b.xm&&!b.xm.valorant)');i++){H.advance(17);await new Promise(r=>setTimeout(r,10));}
 xe('FV.buy=0.05;true');await adv(1500);
 res.rigs=xe('bots.concat(allies).filter(b=>b.xm&&b.xm.valorant).length');console.log('native rigs',res.rigs);
 xe('bots.forEach(b=>{b.cd=1e9});allies.forEach(a=>{a.cd=1e9});try{xHitInit()}catch(e){}true');
 // contact moments
 const one=async(i,hp)=>{if(!xe(`(()=>{const L=bots.filter(x=>x.alive);const b=L[${i}]||null;if(!b)return 0;window.__qaB=b;return 1;})()`))return null;
  xe(place);xe(`__qaB.hp=${hp};fcd=0;__recReset();__REC.on=true;true`);emu();const pk=PROF==='killframe'&&hp<=1||PROF==='hitframe'&&hp>1;if(PROF==='shoot'||pk)await profStart();const a=process.hrtime.bigint();xe('shoot(false)');const shot=Number(process.hrtime.bigint()-a)/1e6;if(PROF==='shoot')await profStop('',1);const fr=[];const E={prog:0,tex:0};
  for(let k=0;k<3;k++){const t=process.hrtime.bigint();H.advance(17);fr.push(+(Number(process.hrtime.bigint()-t)/1e6).toFixed(2));const e=emu();E.prog+=e.prog;E.tex+=e.tex;}if(pk)await profStop('',1);
  xe('__REC.on=false;true');const R=JSON.parse(xe('JSON.stringify(__recTop(8))'));
  return {name:xe('__qaB.name'),shot:+shot.toFixed(2),frames:fr,hp:xe('__qaB.hp'),obj:R.total,...E,sites:R.top};};
 const SC=(process.env.SCEN||'first,live,shot').split(',');
 if(SC.includes('first')){if(PROF==='first')await profStart();
 res.first=[];for(let i=0;i<4;i++){const r=await one(i,100);if(r){res.first.push(r);console.log('first-hit',JSON.stringify(r));}}
 res.second=[];for(let i=0;i<2;i++){const r=await one(i,100);if(r){res.second.push(r);console.log('second-hit',JSON.stringify(r));}}
 res.kill=[];for(let i=0;i<2;i++){const r=await one(0,1);if(r){res.kill.push(r);console.log('kill',JSON.stringify(r));}}
 if(PROF==='first')res.profFirst=await profStop('first hits + kills');
 if(process.env.RCLOG){res.rcl=JSON.parse(xe('JSON.stringify(__RCL)'));console.log('slow raycasts',res.rcl.length);res.rcl.slice(0,30).forEach(r=>console.log(' ',JSON.stringify(r)));}
 if(PROF==='shoot')res.profShoot=await profStop('shoot() calls of first hits / second hits / kills',2);
 if(PROF==='killframe'||PROF==='hitframe')res.profFrames=await profStop(PROF+': the shot and the 3 frames after it',2);
 for(let i=0;i<300;i++)H.advance(17); // let corpses settle (ragdoll)
 xe('window.__qaB=null;true');}
 // live fire vs aim (bots never shoot back, hp topped up)
 const step=fire=>`(()=>{for(const b of bots){b.cd=1e9;if(b.alive)b.hp=100;}const t=window.__qaT&&window.__qaT.alive?window.__qaT:(window.__qaT=bots.find(x=>x.alive));if(!t)return 0;const q=t.g.position;
   let best=null;for(let k=0;k<8;k++){const a=k*Math.PI/4+(window.__qaA||0),x=q.x+Math.sin(a)*7,z=q.z+Math.cos(a)*7,y=q.y;if(los(new THREE.Vector3(x,y+1.6,z),new THREE.Vector3(q.x,q.y+1.3,q.z))){best=[x,y,z,a];break;}}
   if(!best)best=[q.x+7,q.y,q.z,0];window.__qaA=best[3];player.x=best[0];player.y=best[1];player.z=best[2];player.vx=player.vz=0;player.hp=100;
   const dx=q.x-best[0],dz=q.z-best[2],dy=q.y+1.2-(best[1]+1.6);yaw=Math.atan2(-dx,-dz);pitch=Math.atan2(dy,Math.hypot(dx,dz));
   ammo=30;reloading=0;VM.sw=0;fireHeld=${fire};${fire}&&fcd<=0&&(window.__qaN=(window.__qaN||0)+1,shoot(false));return 1;})()`;
 const live=async(kind,n)=>{const st=step(kind==='fire');for(let i=0;i<30;i++){xe(st);H.advance(17);}xe('window.__qaN=0;__recReset();__REC.on=true;true');const ts=[];
  const pv=PROF===kind&&!live[kind];if(pv){live[kind]=1;await profStart();}
  for(let i=0;i<n;i++){const a=process.hrtime.bigint();xe(st);H.advance(17);ts.push(Number(process.hrtime.bigint()-a)/1e6);}
  const prof=pv?await profStop(kind):null;xe('__REC.on=false;true');const R=JSON.parse(xe('JSON.stringify(__recTop(10))'));
  const r={kind,frames:n,shots:xe('window.__qaN'),...stat(ts),objPerFrame:+(R.total/n).toFixed(2),sites:R.top.map(([k,v])=>[+(v/n).toFixed(2),k])};console.log('live',JSON.stringify(r));if(prof)r.prof=prof;return r;};
 res.live=[];if(SC.includes('live'))for(const k of ['aim','fire','aim','fire'])res.live.push(await live(k,F));xe('fireHeld=false;window.__qaT=null;true');
 // being shot: the player stands 9 m in front of one enemy bot (re-placed each frame along its facing) with a clear line and really fires (AI aim/fire), the player stands
 // still with hp topped up; 'calm' is the same bot with its fire held (cd)
 xe(`window.__qaHit=0;{const h=hurt;hurt=function(t,n,by){if(t===player)__qaHit++;return h.apply(this,arguments);};}true`);
 const shotStep=fire=>`(()=>{const b=window.__qaS&&window.__qaS.alive?window.__qaS:(window.__qaS=bots.find(x=>x.alive));if(!b)return 0;for(const o of bots)if(o!==b)o.cd=1e9;
   if(!${fire})b.cd=1e9;else if(b.cd>1e8)b.cd=0;b.hp=100;const q=b.g.position;
   let best=null;const ry=b.g.rotation.y+Math.PI*${+(process.env.SHOTF||0)};for(let k=0;k<8;k++){const a=ry+(k%2?1:-1)*Math.floor((k+1)/2)*0.3,x=q.x+Math.sin(a)*9,z=q.z+Math.cos(a)*9,y=q.y;if(los(new THREE.Vector3(x,y+1.6,z),new THREE.Vector3(q.x,q.y+1.3,q.z))){best=[x,y,z,a];break;}}
   if(!best)best=[q.x+9,q.y,q.z,0];player.x=best[0];player.y=best[1];player.z=best[2];player.vx=player.vz=0;if(window.__qaPh!=null&&player.hp<__qaPh)__qaHit++;if(player.hp<500)player.hp=1000;window.__qaPh=player.hp;
   const dx=q.x-best[0],dz=q.z-best[2];yaw=Math.atan2(-dx,-dz);pitch=0;fireHeld=false;return 1;})()`;
 const shot=async(kind,n)=>{const st=shotStep(kind==='shot');for(let i=0;i<30;i++){xe(st);H.advance(17);}xe('__qaHit=0;__recReset();__REC.on=true;true');const ts=[];
  const pv=PROF===kind&&!shot[kind];if(pv){shot[kind]=1;await profStart();}
  for(let i=0;i<n;i++){xe(st);const a=process.hrtime.bigint();H.advance(17);ts.push(Number(process.hrtime.bigint()-a)/1e6);}
  const prof=pv?await profStop(kind):null;xe('__REC.on=false;true');const R=JSON.parse(xe('JSON.stringify(__recTop(10))'));
  const r={kind,frames:n,hitsOnPlayer:xe('__qaHit'),bot:JSON.parse(xe('JSON.stringify({n:__qaS.name,see:__qaS.see,cd:__qaS.cd,xs:__qaS.xs,xSe:__qaS.xSe,blind:__qaS.blind,d:Math.hypot(__qaS.g.position.x-player.x,__qaS.g.position.z-player.z),ry:__qaS.g.rotation.y,php:player.hp,run:running,buy:FV.buy})')),...stat(ts),objPerFrame:+(R.total/n).toFixed(2),sites:R.top.map(([k,v])=>[+(v/n).toFixed(2),k])};console.log('being-shot',JSON.stringify(r));if(prof)r.prof=prof;return r;};
 res.shot=[];if(SC.includes('shot'))for(const k of ['calm','shot','calm','shot'])res.shot.push(await shot(k,F));
 res.running=xe('running');
 if(OUT)fs.writeFileSync(OUT,JSON.stringify(res,null,1));
 console.log('errors',H.errors.length,JSON.stringify(H.errors.slice(0,3)));process.exit(0);
})().catch(e=>{console.error(e);process.exit(1);});
