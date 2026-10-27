// Hit path on the real native map (work/page_harness.cjs native:true: the shipped Ascent collision BVH, real three.js
// scene graph, WebGL stubbed). Items 1b-perf and 1d (user 20:03 / 19:53 2026-10-26).
// 1b-perf "stutter is obvious when I'm shooting at an enemy":
//  * the first shot of a match took ~340 ms of JS in this harness: the hitbox ray pre-check (xHbOk) ran on every target
//    including the 1.5 M-vertex native-collision mesh (never rendered, so three never had its bounding sphere) and
//    computed that sphere inside the shot. The pre-check is for bot / aim hitboxes only; the map ray uses its BVH.
//  * no new materials, geometries or textures (= no new shader programs or GPU uploads) on hits and kills once the
//    map is up: the first hit, the first kill (the floor-gun pickup box is prewarmed), and every later one
//  * steady hits allocate no THREE objects in page code beyond gFire's / the BVH's own (bounded per shot)
// 1d wallbangs, player shooting a bot through walls measured along the shot ray (server test-wallbang-real.js uses the
// same spots on the server world): 0.10 m wall Spectre and Vandal pass at 50 %; 0.25 m wall Spectre stopped, Vandal 50 %,
// Odin 75 %; 1 m wall stops the Odin; a wallbang kill's feed row carries the wallbang mark, an open kill's does not.
const assert=require('assert/strict');
const {boot}=require('./page_harness.cjs');
const H=boot({real3:true,seed:7,native:true}),xe=H.xe,adv=async ms=>{for(let t=0;t<ms;t+=50){H.advance(Math.min(50,ms-t));await new Promise(r=>setImmediate(r));}};
const through=async()=>{for(let t=0;t<30000;t+=100){if(xe('running')&&!xe('!!window.xLdOn')&&!H.shown('pre')&&!H.shown('xAg'))return true;
 if(H.shown('pre'))H.$('preGo').click();else if(H.shown('xAg')){const tile=H.doc.querySelectorAll('#xAg .x-ag').find(b=>!b.disabled);if(tile)tile.click();await adv(20);H.$('xAgL').click();}
 await adv(100);}return false;};
// count page-side constructions of GPU-relevant THREE objects and every bounding-sphere / box computation on big geometry
xe(`window.__qaG={mat:0,geo:0,tex:0,big:[]};(function(){for(const k of Object.keys(THREE)){const C=THREE[k];if(typeof C!=="function"||!C.prototype)continue;
 const kind=C.prototype.isMaterial?"mat":C.prototype.isBufferGeometry?"geo":C.prototype.isTexture?"tex":null;if(!kind)continue;
 const W=class extends C{constructor(...a){super(...a);__qaG[kind]++;}};Object.defineProperty(W,"name",{value:k});try{THREE[k]=W;}catch(e){}}
 const P=THREE.BufferGeometry.prototype;for(const f of ["computeBoundingSphere","computeBoundingBox"]){const o=P[f];P[f]=function(){const n=this.attributes&&this.attributes.position?this.attributes.position.count:0;if(n>50000)__qaG.big.push(f+" "+n);return o.apply(this,arguments);};}})();true`);
const G=()=>JSON.parse(xe('JSON.stringify({mat:__qaG.mat,geo:__qaG.geo,tex:__qaG.tex,big:__qaG.big.length})'));
const place=`(()=>{const b=bots.find(x=>x.alive);if(!b)return 0;window.__qaB=b;b.armor=0;player.hp=100;yaw=0;pitch=0;
  b.g.position.set(player.x,player.y||0,player.z-8);b.g.updateMatrixWorld(true);camera.position.set(player.x,(player.y||0)+1.6,player.z);camera.rotation.set(0,0,0,"YXZ");camera.updateMatrixWorld(true);
  ammo=30;reloading=0;fcd=0;VM.sw=0;try{spray=0;}catch(e){}return 1;})()`;
(async()=>{
 xe('FV.pick="ascent";true');H.$('pm5v5').click();await adv(50);assert.ok(await through(),'offline 5v5 started');assert.equal(xe('nmActive()&&nmActive().key'),'ascent','native Ascent');
 xe('FV.buy=0.05;true');await adv(1500);xe('bots.forEach(b=>{b.cd=1e9});allies.forEach(a=>{a.cd=1e9});true');
 // --- 1b-perf: first hits and first kill after the map is up
 const g0=G();let first=0;const per=[];
 for(let k=0;k<10;k++){if(!xe(place))break;const a=process.hrtime.bigint();xe('shoot(false)');const ms=Number(process.hrtime.bigint()-a)/1e6;if(!k)first=ms;else per.push(ms);H.advance(17);await new Promise(r=>setImmediate(r));}
 const g1=G(),kills=xe('bots.filter(b=>!b.alive).length');
 console.log(`first shot into a bot ${first.toFixed(1)} ms, next ${per.length} shots mean ${(per.reduce((a,b)=>a+b,0)/per.length).toFixed(2)} ms (${kills} kills); new materials ${g1.mat-g0.mat}, geometries ${g1.geo-g0.geo}, textures ${g1.tex-g0.tex}, big-geometry bounds ${g1.big-g0.big}`);
 assert.ok(kills>=2,'the hits killed bots (kill path covered)');
 assert.equal(g1.big-g0.big,0,'no bounding sphere / box of the map collision mesh inside a shot');
 assert.deepEqual([g1.mat-g0.mat,g1.geo-g0.geo,g1.tex-g0.tex],[0,0,0],'hits and kills create no materials / geometries / textures (no shader compile or GPU upload mid-fight)');
 // --- 1d: wallbangs on real walls
 const S={L:{p:[28.75,9.0653,30.5],a:Math.PI/2},M:{p:[-27.5,6.0692,-40],a:Math.PI/2},X:{p:[-62,4.0686,-19.75],a:0}};
 const wb=(k,w,hp,open)=>JSON.parse(xe(`(()=>{const S=${JSON.stringify(S[k])},w=${JSON.stringify(w)},d=[Math.cos(S.a),0,Math.sin(S.a)];
   const b=bots.find(x=>x.alive);b.hp=${hp||100};b.armor=0;player.x=S.p[0];player.z=S.p[2];player.y=S.p[1];player.hp=100;player.ch=0;
   const rc=new THREE.Raycaster(new THREE.Vector3(S.p[0],S.p[1]+1.5,S.p[2]),new THREE.Vector3(d[0],d[1],d[2]),0,12),hs=rc.intersectObjects(solids,true),d1=hs[0].distance;
   const R=${open?'d1-2.5':'d1+(hs[1]?hs[1].distance-d1:0)+2.2'},tx=S.p[0]+d[0]*R,tz=S.p[2]+d[2]*R;b.g.position.set(tx,S.p[1],tz);b.g.updateMatrixWorld(true);
   const e=new THREE.Vector3(S.p[0],S.p[1]+1.6,S.p[2]),q=new THREE.Vector3(tx,S.p[1]+1.3,tz).sub(e);
   yaw=Math.atan2(-q.x,-q.z);pitch=Math.atan2(q.y,Math.hypot(q.x,q.z));camera.position.copy(e);camera.rotation.set(pitch,yaw,0,"YXZ");camera.updateMatrixWorld(true);
   const r2=new THREE.Raycaster(e.clone(),q.clone().normalize(),0,q.length()-.45),f=r2.intersectObjects(solids,true);
   FV.pri=w;rw="pri";ammo=30;reloading=0;fcd=0;VM.sw=0;try{spray=0;rcl=0;rclH=0;player.vx=player.vz=0;}catch(e){}
   const F=document.getElementById("feed"),c0=F.children[0],R0=Math.random;Math.random=()=>.5;try{shoot(false);}finally{Math.random=R0;} /* centred spread: the wall, not the cone, is under test */const row=F.children[0]&&F.children[0]!==c0?F.children[0]:null;
   return JSON.stringify({wn:wName(),th:f.length===2?+(f[1].distance-f[0].distance).toFixed(3):f.length?-f.length:0,hp:b.hp,alive:b.alive,row:row?row.xW.title:null});})()`));
 const r={};for(const [k,w] of [['L','Spectre'],['L','Vandal'],['M','Spectre'],['M','Vandal'],['M','Odin'],['X','Odin']])r[k+' '+w]=wb(k,w);
 console.log('offline wallbangs on Ascent (wall m along the shot / hp after one body shot):',Object.entries(r).map(([k,v])=>`${k} ${v.th}/${v.hp}`).join(', '));
 for(const k in r)assert.equal(r[k].wn,k.split(' ')[1],'weapon in hand '+k);
 assert.ok(r['L Vandal'].th>.05&&r['L Vandal'].th<.15&&r['M Vandal'].th>.15&&r['M Vandal'].th<.35&&r['X Odin'].th>.6,'walls measured along the shot: '+JSON.stringify(r));
 assert.equal(r['L Spectre'].hp,100-Math.floor(26*.5),'thin wall: Spectre (Low) 50 %');assert.equal(r['L Vandal'].hp,100-40*.5,'thin wall: Vandal (Medium) 50 %');
 assert.equal(r['M Spectre'].hp,100,'0.25 m wall stops the Spectre');assert.equal(r['M Vandal'].hp,80,'0.25 m wall: Vandal 50 %');assert.equal(r['M Odin'].hp,100-Math.floor(38*.75),'0.25 m wall: Odin (High) 75 %');
 assert.equal(r['X Odin'].hp,100,'1 m wall stops the Odin');
 const kw=wb('M','Vandal',1),ko=wb('M','Vandal',1,true);
 assert.ok(!kw.alive&&/wallbang/.test(kw.row||''),'wallbang kill: feed row marked '+JSON.stringify(kw));assert.ok(!ko.alive&&ko.row&&!/wallbang/.test(ko.row),'open kill: no wallbang mark '+JSON.stringify(ko));
 console.log('Native hit path: first shot / hits / kills build no materials, geometries, textures or map bounds; offline wallbangs on real Ascent walls by tier, wallbang kill marked in the feed');
 process.exit(0);
})().catch(e=>{console.error(e);process.exit(1);});
