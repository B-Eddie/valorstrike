// Deathmatch accumulation (user: "60 fps for the first minute, then 30 fps for good"): every respawn builds a fresh character
// model (a SkeletonUtils clone of the rig, its own materials, mixer and skeletons with their bone textures); the corpse was
// removed from the scene with only its dropped weapon disposed, so each death orphaned a whole rig. Checked on the real page
// (work/page_harness.cjs, native agent rigs) in an offline deathmatch with repeated kills and respawns:
//  1. every character model that has left play (not a live unit's, not a corpse still shown) is fully freed: its per-model
//     materials disposed, its skeletons disposed (bone textures), its animation mixer stopped and uncached, off the solver list;
//     the live rig count stays bounded (one per unit + the corpses still fading);
//  2. what a unit left placed with no lifetime of its own (its turret, its armed nanoswarms) goes when it respawns;
//  3. the leaderboard keeps its row elements and only rewrites their text (no innerHTML rebuild).
//   node work/test_dm_rig_leak.cjs          IDX=<old index.html> runs the same scenario on another page (before / after numbers)
const fs=require('fs'),path=require('path');
if(process.env.IDX){const rf=fs.readFileSync,want=path.join(__dirname,'..','index.html');fs.readFileSync=function(f,...a){if(typeof f==='string'&&path.resolve(f)===want)return rf.call(fs,process.env.IDX,...a);return rf.call(fs,f,...a);};}
const {boot}=require('./page_harness.cjs');
const H=boot({real3:true,seed:5}),xe=H.xe,e0=H.errors.length;/* boot-time harness notes (external scripts) are not page errors */const fails=[];const ok=(c,m)=>{if(!c)fails.push(m);};
const adv=async ms=>{for(let t=0;t<ms;t+=50){H.advance(Math.min(50,ms-t));await new Promise(r=>setImmediate(r));}};
(async()=>{
 // The harness has no glTF loader, so every character gets a small stand-in kit built here: a skinned rig of two meshes on one
 // skeleton (the bone names the model builder looks up) and an empty clip for every animation it asks for. The page's own model
 // builder (xvAgent: SkeletonUtils clone, per-model materials, mixer, shared skeleton) then runs exactly as with a real rig.
 xe(`(()=>{const mk=()=>{const root=new THREE.Group(),names=["Pelvis","Spine1","Spine2","Spine3","Spine4","Splitter","R_Hand"],bones=[];let par=null;
   for(const n of names){const b=new THREE.Bone();b.name=n;b.position.y=par?0.2:0.9;(par||root).add(b);bones.push(b);if(n!=="Splitter")par=b;}
   const sk=new THREE.Skeleton(bones),mk1=(nm)=>{const g=new THREE.BoxGeometry(0.4,1.8,0.3,1,4,1),n=g.attributes.position.count;g.setAttribute("skinIndex",new THREE.Uint16BufferAttribute(new Array(n*4).fill(0).map((v,i)=>i%4?0:Math.floor((i/4)%3)),4));g.setAttribute("skinWeight",new THREE.Float32BufferAttribute(new Array(n*4).fill(0).map((v,i)=>i%4?0:1),4));
     const m=new THREE.SkinnedMesh(g,new THREE.MeshStandardMaterial({name:nm}));m.name=nm;m.add(bones[0]);m.bind(sk);return m;};
   const a=mk1("Body"),b=mk1("Head");b.bind(sk,a.bindMatrix);root.add(a);root.add(b);
   const clips=()=>new Proxy({},{get:(t,k)=>typeof k==="string"?(t[k]||(t[k]=new THREE.AnimationClip(k,1,[]))):undefined});
   return {gl:{scene:root,animations:[]},L:clips(),U:clips(),C:clips(),A:clips(),contactLift:0,contactProbes:[]};};
  const kit=mk(),own=XVA.kits;XVA.kits=new Proxy(own,{get:(t,k)=>t[k]||(typeof k==="string"&&KITS[k]?kit:undefined)});return true;})()`);
 // every rig the page builds is recorded with what it owns; disposal is seen through the three.js objects themselves
 xe(`window.__RIG=[];{const S=THREE.Skeleton.prototype,d0=S.dispose;S.dispose=function(){this.__gone=1;return d0.apply(this,arguments);};const X=THREE.AnimationMixer.prototype,u0=X.uncacheRoot;X.uncacheRoot=function(){this.__gone=1;return u0.apply(this,arguments);};}
  {const a0=xvAgent;xvAgent=function(M){const r=a0.apply(this,arguments);try{if(M&&M.sx&&!__RIG.some(e=>e.M===M)){const sk=new Set();M.m.traverse(o=>{if(o.isSkinnedMesh&&o.skeleton)sk.add(o.skeleton);});const mats=M.mats.slice();for(const m of mats)m.addEventListener("dispose",function f(){m.__gone=1;});__RIG.push({M,sk:[...sk],mats,mx:M.sx.mx});}}catch(e){}return r;};}true`);
 xe('FV.pick="ascent";FV.srOn=0;window.xSwift=false;xLob0=false;dmStart0&&startDM();true');await adv(600);for(let i=0;i<150&&!xe('running&&FV.dm&&player.hp>0&&!window.xLdOn');i++)await adv(200);
 ok(xe('running&&FV.dm'),'deathmatch running');xe('FV.buy=0;DM.win=999;true');
 const stat=()=>xe(`(()=>{const live=new Set(bots.map(b=>b.xm).filter(Boolean));for(const e of XDEAD)live.add(e.c);let gone=0,leak=0,why=[];
  for(const R of __RIG){if(live.has(R.M))continue;gone++;const bad=[];if(R.mats.some(m=>!m.__gone))bad.push("materials");if(R.sk.some(s=>!s.__gone))bad.push("skeleton");if(!R.mx.__gone)bad.push("mixer");if(XSOL.mx.includes(R.M))bad.push("solver list");if(bad.length){leak++;if(why.length<3)why.push(bad.join("+"));}}
  return {built:__RIG.length,live:__RIG.length-gone,gone,leak,why,mats:__RIG.filter(R=>!live.has(R.M)).reduce((n,R)=>n+R.mats.filter(m=>!m.__gone).length,0)};})()`);
 await adv(1500);const nb=xe('bots.length');
 // kills and respawns: one bot down every 0.9 s for 30 s (respawn 1.5 s, corpses fade over 1.5 - 6.8 s)
 for(let i=0;i<34;i++){xe(`(()=>{const L=bots.filter(b=>b.alive&&b.xm&&b.xm.sx);if(!L.length)return;const b=L[${i}%L.length];kill(b,false,"You");})()`);await adv(900);}
 await adv(8000);const S=stat();
 console.log('rigs built '+S.built+', still in play '+S.live+', left play '+S.gone+', not fully freed '+S.leak+(S.why.length?' ('+S.why.join(', ')+')':'')+', orphaned rig materials '+S.mats);
 ok(S.built>=nb+20,`rigs rebuilt on respawn (${S.built} built for ${nb} bots)`);
 ok(S.leak===0,`every rig that left play is fully freed (${S.leak} of ${S.gone} not: ${S.why.join(', ')})`);
 ok(S.live<=nb*2+1,`live rigs bounded (${S.live} for ${nb} bots)`);
 // 2. a bot's placed turret and nanoswarms leave with it when it respawns
 {const r=xe(`(()=>{const b=bots.find(x=>x.alive&&x.g);if(!b)return null;const p=b.g.position;xBTurret(b,false,p,p.x+4,p.z);const ch=xBCh(b);ch.c=Math.max(2,ch.c|0);const n=xKnPlace(b,false,p.x,p.z,2,2,3);
   window.__fxB=b;return {tur:XBTU.filter(T=>T.own===b).length,kn:XKN.filter(o=>o.on&&o.own===b).length,n};})()`);
  ok(r&&r.tur>=1&&r.kn>=1,'placed a turret and nanoswarms '+JSON.stringify(r));xe('kill(__fxB,false,"You");true');await adv(2500);
  const a=xe('({alive:__fxB.alive,tur:XBTU.filter(T=>T.own===__fxB).length,kn:XKN.filter(o=>o.on&&o.own===__fxB).length})');
  ok(a.alive&&a.tur===0&&a.kn===0,'respawned unit: its turret / nanoswarms cleared '+JSON.stringify(a));}
 // 3. leaderboard: same row elements, text rewritten in place
 {xe('dmLB();window.__lbN=[...DM.lb.querySelectorAll("li")];window.__lbH=DM.lb.querySelector(".x-dmlb__h");true');const n0=xe('__lbN.length'),k0=xe('DM.k.You|0');
  for(let i=0;i<6;i++){xe(`(()=>{const b=bots.find(x=>x.alive&&x.xm);if(b)kill(b,false,"You");})()`);await adv(600);}xe('dmLB();true');
  const r=xe('({same:__lbH===DM.lb.querySelector(".x-dmlb__h")&&__lbN.every((li,i)=>li===DM.lb.querySelectorAll("li")[i]),n:DM.lb.querySelectorAll("li").length,me:[...DM.lb.querySelectorAll("li")].filter(li=>li.className==="me").map(li=>li.querySelector("em").textContent),k:DM.k.You|0})');
  ok(n0>=5&&r.same,'leaderboard keeps its row elements (no rebuild) '+JSON.stringify({n0,...r}));ok(r.k>k0&&r.me[0]===String(r.k),'leaderboard text follows the kills '+JSON.stringify(r));}
 ok(H.errors.length===e0,'no page errors '+JSON.stringify(H.errors.slice(e0,e0+3)));
 if(fails.length){console.error(fails.join('\n'));process.exit(1);}
 console.log('DM rig leak: every rig that left play fully freed (materials, skeletons, mixer, solver list), live rigs bounded, a respawned unit\'s turret / nanoswarms cleared, leaderboard rows updated in place');process.exit(0);
})().catch(e=>{console.error(e);process.exit(1);});
