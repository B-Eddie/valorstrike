// repath lane (eventperf: GC in long sprays, bench_events plant_hold ~36 ms / decals_spray ~28 ms frames): the collision mesh's
// all-hits raycast (nmCollisionRaycast -> nmRaPush) built a hit object, a face object and two Vector3 for every wall
// triangle a shot crossed within far (~4 per 200 m shot). The player's shot list XWH and the wallbang exit ray's XWA are
// pooled (xRayPool, out.xPool): their hits are recycled objects with the same fields set to the same values. Checked on
// the real Ascent collision world:
//  - pooled results equal fresh ones and MeshBVHLib.acceleratedRaycast (distance, point, face a/b/c/normal/materialIndex,
//    faceIndex, object) for 1500 random rays x {all hits, firstHitOnly}, through Raycaster.intersectObjects too;
//  - a hit still in the array when the array is filled again without emptying is never overwritten; after emptying, the
//    same objects are reused;
//  - bytes allocated per pooled all-hits ray: only the array's own regrown backing store (young generation big enough that no
//    scavenge runs while measuring);
//  - shoot() / xThin empty their pooled arrays before each fill (the pool's contract).
const cp = require('child_process');
if (!process.execArgv.some((a) => /semi-space/.test(a))) { const r = cp.spawnSync(process.execPath, ['--max-semi-space-size=256', __filename], { stdio: 'inherit' }); process.exit(r.status == null ? 1 : r.status); }
const fs = require('fs'), path = require('path'), assert = require('assert/strict');
const { boot } = require('./page_harness.cjs');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const fnSrc = (name) => { const a = html.indexOf('function ' + name + '('); assert(a >= 0, name); let i = html.indexOf('{', a), d = 0; for (; i < html.length; i++) { if (html[i] === '{') d++; else if (html[i] === '}' && !--d) break; } return html.slice(a, i + 1); };
assert.match(fnSrc('shoot'), /XWH\.length = 0; ray\.intersectObjects\(xShotTgts\(targets\), true, XWH\)/, 'shoot() empties its pooled hit list before the fill');
assert.match(fnSrc('xThin'), /XWA\.length = 0;\s*XWR\.intersectObject\(o, false, XWA\)/, 'xThin empties its pooled hit list before the fill');
const tick = () => new Promise((r) => setImmediate(r));
(async () => {
  const MAP = process.env.MAP || 'ascent';
  const H = boot({ real3: true, seed: 3, native: true, fastGlobal: true }), xe = H.xe;
  xe(`J.pick="Jett";FV.pick=${JSON.stringify(MAP)};FV.srOn=0;FV.repOn=0;window.xSwift=0;xLob0=false;startFive();true`);
  for (let i = 0; i < 400 && !xe('!!(typeof nmActive==="function"&&nmActive()&&running)'); i++) { for (let t = 0; t < 200; t += 50) { H.advance(50 - 1e-6); await tick(); } }
  assert(xe('!!nmActive()'), 'native map loaded: ' + MAP);
  assert(xe('typeof xRayPool==="function"&&!!XWH.xPool&&!!XWA.xPool'), 'the shot hit list XWH and the wallbang exit list XWA are pooled (xRayPool)');
  xe(`(()=>{const C=nmActive(),N=C.nav.nodes,P=[];for(let i=0;i<N.length;i++)if(C.playable[i])P.push(i);let s=4242;const r=()=>(s=(s*1103515245+12345)>>>0)/4294967296;const Q=[];
    for(let k=0;k<3000;k++){const p=N[P[Math.floor(r()*P.length)]];Q.push([p[0]-2+r()*4,p[1]+.6+r()*1.2,p[2]-2+r()*4,r(),r(),r()]);}window.__Q=Q;return true;})()`);
  // 1) equivalence: pooled vs fresh vs the library
  const eq = xe(`(()=>{const C=nmActive(),M=C.M.solids[0],Q=__Q,RC=new THREE.Raycaster(),A=[],B=[],P=xRayPool([]);let n=0,h=0,multi=0;
    const key=a=>a.map(x=>[x.distance,x.point.x,x.point.y,x.point.z,x.faceIndex,x.face.a,x.face.b,x.face.c,x.face.normal.x,x.face.normal.y,x.face.normal.z,x.face.materialIndex,x.object===M,Object.keys(x).join('/'),Object.keys(x.face).join('/')].join(',')).join(';');
    for(let k=0;k<1500;k++){const q=Q[k];RC.ray.origin.set(q[0],q[1],q[2]);RC.ray.direction.set(q[3]-.5,(q[4]-.5)*.5,q[5]-.5).normalize();RC.near=k%7===0?.5:0;RC.far=[3,12,40,200][k%4];
      for(const fh of [false,true]){RC.firstHitOnly=fh;A.length=B.length=P.length=0;MeshBVHLib.acceleratedRaycast.call(M,RC,A);M.raycast(RC,B);M.raycast(RC,P);n++;h+=P.length;if(P.length>1)multi++;
        const ka=key(A),kb=key(B),kp=key(P);if(ka!==kp||kb!==kp)return 'raycast '+k+' firstHitOnly '+fh+' pooled differs: '+kp.slice(0,300)+' VS '+ka.slice(0,300);
        A.length=P.length=0;RC.intersectObjects(solids,true,A);RC.intersectObjects(solids,true,P);if(key(A)!==key(P))return 'intersectObjects '+k+' pooled differs';}}
    RC.firstHitOnly=false;return [n,h,multi];})()`);
  assert(Array.isArray(eq), MAP + ': ' + eq);
  assert(eq[2] > 100, 'enough multi-hit rays in the sample (' + eq[2] + ')');
  // 2) hits still in the array are kept; after emptying, the pool's objects come back
  const keep = xe(`(()=>{const C=nmActive(),M=C.M.solids[0],Q=__Q,RC=new THREE.Raycaster(),P=xRayPool([]);RC.far=200;let checked=0,reused=0;
    const snap=a=>a.map(x=>[x.distance,x.point.x,x.point.y,x.point.z,x.faceIndex,x.face.normal.x,x.face.normal.y,x.face.normal.z].join(','));
    for(let k=0;k<400;k++){const q=Q[k],q2=Q[k+1];P.length=0;RC.ray.origin.set(q[0],q[1],q[2]);RC.ray.direction.set(q[3]-.5,0,q[5]-.5).normalize();M.raycast(RC,P);if(!P.length)continue;
      const first=P.slice(),s1=snap(first);RC.ray.origin.set(q2[0],q2[1],q2[2]);RC.ray.direction.set(q2[3]-.5,0,q2[5]-.5).normalize();M.raycast(RC,P);
      if(snap(first).join(';')!==s1.join(';'))return 'ray '+k+': a hit still in the array was overwritten by the next fill';
      for(let i=first.length;i<P.length;i++)if(first.includes(P[i]))return 'ray '+k+': one object twice in the array';checked++;
      P.length=0;M.raycast(RC,P);if(P.length&&first.includes(P[0]))reused++;}
    return [checked,reused];})()`);
  assert(Array.isArray(keep), MAP + ': ' + keep);
  assert(keep[0] > 50 && keep[1] > keep[0] * 0.5, 'pooled hits are reused after the array is emptied (' + keep + ')');
  // 3) allocation per all-hits ray: pooled vs fresh array (same rays, warmed up)
  xe(`window.__W=function(n,pool){const C=nmActive(),M=C.M.solids[0],Q=__Q,RC=window.__RC||(window.__RC=new THREE.Raycaster()),A=pool?(window.__PA||(window.__PA=xRayPool([]))):(window.__FA||(window.__FA=[]));RC.far=200;RC.firstHitOnly=false;let h=0;
    for(let k=0;k<n;k++){const q=Q[k%Q.length];RC.ray.origin.set(q[0],q[1],q[2]);RC.ray.direction.set(q[3]-.5,(q[4]-.5)*.3,q[5]-.5).normalize();A.length=0;M.raycast(RC,A);h+=A.length;}return h;};__W(3000,true);__W(3000,false);__W(3000,true);__W(3000,false);true`);
  const v8 = require('v8'), heap = () => v8.getHeapStatistics().used_heap_size;
  const meas = (pool) => { const best = []; for (let r = 0; r < 6; r++) { const h0 = heap(); const hits = xe(`__W(3000,${pool})`); const d = heap() - h0; if (d >= 0) best.push([d / 3000, hits / 3000]); } assert(best.length, 'a scavenge ran during every measurement'); return best.sort((a, b) => a[0] - b[0])[0]; }; // a rep a scavenge ran in (negative delta) is skipped, as test_bvh_alloc
  const fresh = meas(false), pooled = meas(true);
  console.log(`bytes per 200 m all-hits ray (${fresh[1].toFixed(2)} hits each): fresh array ${fresh[0].toFixed(1)}, pooled ${pooled[0].toFixed(1)}`);
  assert(fresh[0] > 100, 'the measurement sees the fresh hits (' + fresh[0].toFixed(1) + ' B per ray)');
  // what is left is the array's own backing store: `length = 0` frees it and the next push regrows it (~150 B for ~6 hits, the
  // same with or without the pool); the hits themselves (a hit + face + two Vector3, ~360 B each with the library's boxed numbers) are gone
  assert(pooled[0] < 200 && pooled[0] * 8 < fresh[0], 'a pooled all-hits ray allocates nothing per hit (' + pooled[0].toFixed(1) + ' B per ray, fresh ' + fresh[0].toFixed(1) + ')');
  console.log(`Ray pool (${MAP}): ${eq[0]} raycasts (${eq[1]} hits, ${eq[2]} multi-hit) identical to fresh hits and the library, ${keep[0]} refills keep the hits in the array, ${keep[1]} reused after emptying; ${fresh[0].toFixed(0)} -> ${pooled[0].toFixed(1)} B per ray`);
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
