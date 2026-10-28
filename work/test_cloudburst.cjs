// Jett Cloudburst (C) against Valorant (user 2026-10-27: "Jett's smoke C ability isn't supposed to be like that").
// Spec: playvalorant.com Jett "INSTANTLY throw a projectile that expands into a brief vision-blocking cloud on impact with a
// surface. HOLD the ability key to curve the cloud in the direction of your crosshair"; valorant.fandom.com/wiki/Cloudburst:
// 200 credits, 2 uses, radius 3.35 m, duration 2.5 s incl. 0.6 s deployment (v7.04), max 2 s in the air, unequip 0.25 s; no
// steering if the key was not held at the cast; gravity again on release; on expiry the smoke dissipates instantly.
// Checked:
//  1. shared flight (vendor/cloudburst.cjs, used by the page and the trusted server): held steering CURVES - one 1/60 s step
//     turns the flight by at most CB.turn/60 rad toward a crosshair 90 deg off, it lines up after ~0.4 s, and the path bends
//     (no instant snap); release -> gravity; a wall ahead -> bursts there; 2 s cap; thrown from the hand (right / below the eye)
//  2. values: kit 200 credits / 2 charges (page KITS = server kits.json), radius 3.35, life 2.5, deploy 0.6
//  3. page, offline: the projectile mesh starts at the hand; the cloud is 2.5 s, r 3.35, every puff inside the radius, no ring
//     (torus) parts; it fades out in <= 0.15 s at the end
//  4. touch (iPhone): holding the C button keeps C held (steering) until the finger lifts
const assert=require('assert/strict'),fs=require('fs'),path=require('path');
const CBm=require('../vendor/cloudburst.cjs');const {CB}=CBm;const fails=[];const check=(c,m)=>{if(!c){fails.push(m);console.log('FAIL',m);}};
const dot=(a,b)=>(a[0]*b[0]+a[1]*b[1]+a[2]*b[2])/(Math.hypot(...a)*Math.hypot(...b));
// 1. flight
{const st=CBm.start([0,1.6,0],[0,0,-1]);const aim=[1,0,0];CBm.step(st,1/60,aim,null,()=>-Infinity);const a1=Math.acos(Math.min(1,dot(st.v,[0,0,-1])));
 check(a1<=CB.turn/60+1e-6&&a1>0,'one held step turns at most CB.turn*dt toward the crosshair (turned '+(a1*180/Math.PI).toFixed(1)+' deg)');
 const pts=[st.p.slice()];for(let i=0;i<30;i++){CBm.step(st,1/60,aim,null,()=>-Infinity);pts.push(st.p.slice());}
 check(dot(st.v,aim)>0.99,'held ~0.5 s: flying along the crosshair');const mid=pts[12];check(mid[0]>0.05&&mid[2]<pts[0][2]-0.5,'the path curves (forward and sideways mid-turn) '+mid.map(n=>n.toFixed(2)));
 const vy0=st.v[1];CBm.step(st,0.1,null,null,()=>-Infinity);check(st.v[1]<vy0-0.5&&!st.held,'released: gravity, steering over for good');CBm.step(st,0.1,aim,null,()=>-Infinity);check(!st.held,'cannot steer again after release');}
{const o=[0,1.6,0],d=[0,0,-1],h=CBm.hand(o,d);check(h[2]<-0.2&&h[0]>0.05&&h[1]<1.6,'thrown from the right hand, below and ahead of the eye '+h);const st=CBm.start(o,d);check(st.p.join()===h.join(),'start() begins at the hand');}
{const st=CBm.start([0,1.6,0],[0,0,-1]);let L=null,n=0;const wall=(o,u,max)=>{if(u[2]>=0)return Infinity;const t=(o[2]+8)/-u[2];return t>=0&&t<=max?t:Infinity;};while(!L&&n++<400)L=CBm.step(st,1/60,[0,0,-1],wall,()=>-Infinity);check(L&&L[2]>-8&&L[2]<-7.5,'bursts on the wall it hits (backed off '+CB.back+' m) '+L);}
{const st=CBm.start([0,1.6,0],[0,0.2,-1]);let L=null,n=0;while(!L&&n++<400)L=CBm.step(st,1/60,[0,0.2,-1],null,()=>-Infinity);check(Math.abs(st.t-2)<0.02,'2 s max air time, then the cloud');}
// 2. values
{const kits=JSON.parse(fs.readFileSync(path.join(__dirname,'..','server','src','kits.json'),'utf8'));const b=kits.Jett.buy.find(x=>x[0]==='c');check(b&&b[2]===200&&kits.Jett.mx.c===2,'server kit: Cloudburst 200 credits, 2 charges');
 check(CB.radius===3.35&&CB.life===2.5&&CB.maxT===2,'radius 3.35 m, 2.5 s, 2 s air');
 const ab=fs.readFileSync(path.join(__dirname,'..','server','src','abilities.js'),'utf8');check(ab.includes('{st:cloud,p:[...cloud.p]}'),'server effect starts at the hand too');}
(async()=>{
 const {boot}=require('./page_harness.cjs');
 const adv=async(H,ms)=>{for(let t=0;t<ms;t+=50){H.advance(Math.min(50,ms-t));await new Promise(r=>setImmediate(r));}};
 const through=async(H,agent)=>{for(let t=0;t<30000;t+=100){if(H.xe('running')&&!H.xe('!!window.xLdOn')&&!H.shown('pre')&&!H.shown('xAg'))return true;
  if(H.shown('pre'))H.$('preGo').click();else if(H.shown('xAg')){const tile=H.doc.querySelectorAll('#xAg .x-ag').find(b=>b.dataset.a===agent);if(tile&&!tile.disabled)tile.click();await adv(H,20);H.$('xAgL').click();}
  await adv(H,100);}return false;};
 // 3. page offline
 {const H=boot({real3:true,seed:4}),xe=H.xe;xe('FV.pick="ascent";true');H.$('pm5v5').click();await adv(H,50);assert.ok(await through(H,'Jett'),'5v5 started');
  check(JSON.stringify(xe('KITS.Jett.buy.find(x=>x[0]==="c")'))==='["c","Cloudburst",200]'&&xe('KITS.Jett.mx.c')===2,'page kit: Cloudburst 200 / 2 charges');
  xe('FV.buy=0.05;true');await adv(H,600);xe('bots.forEach(b=>{b.cd=1e9});allies.forEach(a=>{a.cd=1e9});player.hp=100;J.c=2;J.cd.c=0;J.cbs=[];pitch=0.05;true');
  H.key('KeyC',true);await adv(H,17);H.key('KeyC',false);
  const t0=xe('(()=>{const c=J.cbs[0];if(!c)return null;const e=pEye(),d=jAim(),h=Cloudburst.hand([e.x,e.y,e.z],[d.x,d.y,d.z]);return {start:c.st.o,hand:h,eye:[e.x,e.y,e.z]};})()');
  check(t0&&Math.hypot(t0.hand[0]-t0.eye[0],t0.hand[2]-t0.eye[2])>0.2,'page throw: projectile out of the hand, not the eye');
  const n0=xe('J.smokes.length');for(let i=0;i<60&&xe('J.cbs.length');i++)await adv(H,50);
  const c=xe(`(()=>{const s=J.smokes[J.smokes.length-1];if(!s||!s.cb)return null;s.m.updateMatrixWorld(true);const C=s.m.getWorldPosition(new THREE.Vector3());let far=0,tor=0;
   for(const k of s.m.userData.kids||[]){if(k.geometry&&k.geometry.type==="TorusGeometry")tor++;const p=k.getWorldPosition(new THREE.Vector3()),sc=k.getWorldScale(new THREE.Vector3()).x,R=(k.geometry.parameters&&k.geometry.parameters.radius)||1;far=Math.max(far,p.distanceTo(C)+sc*R);}
   return {t:s.t,r:s.r,dep:s.dep,fo:s.fo,far,tor,kids:(s.m.userData.kids||[]).length};})()`);
  check(c&&xe('J.smokes.length')===n0+1,'the Cloudburst bursts into a cloud');
  if(c){check(c.t<=2.5&&c.t>1.6&&Math.abs(c.r-3.35)<0.01&&c.dep===0.6,'cloud 2.5 s incl. 0.6 s deploy, radius 3.35 '+JSON.stringify(c));check(c.tor===0,'no ring (torus) parts around the cloud');check(c.far<=3.4,'every puff inside the 3.35 m sight radius (farthest '+c.far.toFixed(2)+' m)');check(c.fo>0&&c.fo<=0.15,'dissipates instantly at the end (fade '+c.fo+' s)');}
  check(H.xErrCalls.length===0,'no page xErr '+JSON.stringify(H.xErrCalls.slice(0,2)));}
 // 4. touch: holding the C button holds C
 {const H=boot({real3:true,seed:4,coarse:true}),xe=H.xe;xe('FV.pick="ascent";true');H.$('pm5v5').click();await adv(H,50);assert.ok(await through(H,'Jett'),'touch 5v5 started');
  xe('FV.buy=0.05;true');await adv(H,600);xe('bots.forEach(b=>{b.cd=1e9});player.hp=100;J.c=2;J.cd.c=0;J.cbs=[];true');
  const b=H.doc.querySelector('#xT .tb[data-k="c"]');check(!!b,'touch C button');
  if(b){const T=H.$('xT');H.dispatch(b,H.mkEvent('pointerdown',{pointerId:7,clientX:600,clientY:300}));await adv(H,300);const held=xe('[!!keys.KeyC,J.cbs.length,J.cbs[0]?J.cbs[0].st.held:null]');
   H.dispatch(T,H.mkEvent('pointerup',{pointerId:7,clientX:600,clientY:300}));await adv(H,50);const rel=xe('[!!keys.KeyC,J.cbs[0]?J.cbs[0].st.held:"landed"]');
   check(held[0]===true&&held[1]===1&&held[2]===true,'touch: finger on C -> thrown and still held (steering) '+JSON.stringify(held));check(rel[0]===false&&rel[1]!==true,'touch: finger lifted -> released '+JSON.stringify(rel));}}
 if(fails.length){console.log(fails.length+' FAILED');process.exit(1);}
 console.log('PASS Cloudburst: curved held steering (turn-rate limited), release -> gravity, bursts on impact, 2 s cap, hand origin (page + server), 200 cr / 2 charges, 3.35 m / 2.5 s cloud inside its radius without rings, instant dissipate, touch hold steers');process.exit(0);
})().catch(e=>{console.error(e);process.exit(1);});
