// perf2 (user: "find other ways to get rid of lag"): the collision BVH queries on the hot path must not allocate.
// A 90 s Ascent 5v5 profile (work/perf_match_profile.cjs, sampling heap) put ~95 KB of the ~330 KB allocated per frame
// in three-mesh-bvh's raycastFirst / shapecast: every hit candidate is a fresh {distance, point.clone(), face:{normal}}
// object, and every call re-wraps each root in three new typed arrays (setBuffer) plus per-call closures. nmHeight (ground
// snap for every bot every frame, nmSegment probes every 0.18 m), nmBlocked (motor + bots), the motor ceiling and the
// spectator / foot / rope floor probes now go through nmRayFirst / nmShapeAny: allocation-free ports of the same
// traversal over the same buffers. Checked here on the real Ascent and Split collision worlds:
//  - identical answers to MeshBVH.raycastFirst (distance, point, face normal, faceIndex) and MeshBVH.shapecast (boolean)
//    for thousands of random rays / capsules;
//  - no page call site left on bvh.raycastFirst / bvh.shapecast;
//  - bytes allocated per nmHeight / nmBlocked call (young generation big enough that no scavenge runs while measuring).
const cp = require('child_process');
if (!process.execArgv.some((a) => /semi-space/.test(a))) { const r = cp.spawnSync(process.execPath, ['--max-semi-space-size=256', __filename], { stdio: 'inherit' }); process.exit(r.status == null ? 1 : r.status); }
const fs = require('fs'), path = require('path'), v8 = require('v8'), assert = require('assert/strict');
const { boot } = require('./page_harness.cjs');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
assert.doesNotMatch(html, /bvh\.raycastFirst\(/, 'a page call site still uses MeshBVH.raycastFirst (allocates a hit object per candidate triangle)');
assert.doesNotMatch(html, /bvh\.shapecast\(/, 'a page call site still uses MeshBVH.shapecast (typed-array views + closures per call)');
const tick = () => new Promise((r) => setImmediate(r));
(async () => {
  const out = [];
  for (const MAP of (process.env.MAPS || 'ascent,split').split(',')) {
    const H = boot({ real3: true, seed: 3, native: true, fastGlobal: true }), xe = H.xe;
    xe(`J.pick="Jett";FV.pick=${JSON.stringify(MAP)};FV.srOn=0;FV.repOn=0;window.xSwift=0;xLob0=false;startFive();true`);
    for (let i = 0; i < 400 && !xe('!!(typeof nmActive==="function"&&nmActive()&&running)'); i++) { for (let t = 0; t < 200; t += 50) { H.advance(50 - 1e-6); await tick(); } }
    assert(xe('!!nmActive()'), 'native map loaded: ' + MAP);
    // deterministic query set around playable nav nodes
    xe(`(()=>{const C=nmActive(),N=C.nav.nodes,P=[];for(let i=0;i<N.length;i++)if(C.playable[i])P.push(i);let s=12345;const r=()=>(s=(s*1103515245+12345)>>>0)/4294967296;const Q=[];
      for(let k=0;k<4000;k++){const p=N[P[Math.floor(r()*P.length)]];Q.push([p[0]-2+r()*4,p[1]-.4+r()*1.2,p[2]-2+r()*4,r(),r(),r()]);}window.__Q=Q;return true;})()`);
    // 1) equivalence with the library (only meaningful once the ports exist)
    const eq = xe(`(()=>{const C=nmActive(),Q=__Q,R=new THREE.Ray(new THREE.Vector3(),new THREE.Vector3()),V=new THREE.Vector3();let rays=0,hits=0,caps=0,blk=0;
      const BOX=new THREE.Box3(),L=new THREE.Line3(),pp=new THREE.Vector3(),qq=new THREE.Vector3();
      for(let k=0;k<Q.length;k++){const q=Q[k];R.origin.set(q[0],q[1]+1,q[2]);
        if(k%3===0)R.direction.set(0,-1,0);else if(k%3===1)R.direction.set(0,1,0);else R.direction.set(q[3]-.5,(q[4]-.5)*.6,q[5]-.5).normalize();
        for(const side of [THREE.DoubleSide,THREE.FrontSide]){const a=C.bvh.raycastFirst(R,side),aa=a&&{d:a.distance,p:a.point.toArray(),n:a.face.normal.toArray(),f:a.faceIndex,ia:[a.face.a,a.face.b,a.face.c]};
          const b=nmRayFirst(C.bvh,R,side);rays++;
          if(!aa){if(b)return 'ray '+k+' lib miss, port hit';continue;}hits++;
          if(!b)return 'ray '+k+' lib hit, port miss';
          if(b.distance!==aa.d||b.faceIndex!==aa.f||b.point.x!==aa.p[0]||b.point.y!==aa.p[1]||b.point.z!==aa.p[2]||b.face.normal.x!==aa.n[0]||b.face.normal.y!==aa.n[1]||b.face.normal.z!==aa.n[2]||b.face.a!==aa.ia[0]||b.face.b!==aa.ia[1]||b.face.c!==aa.ia[2])return 'ray '+k+' differs '+JSON.stringify([aa,b.distance,b.faceIndex,b.point.toArray(),b.face.normal.toArray()]);}
        // capsule (same shape test as nmBlocked)
        const r=.2+q[3]*.5,y=q[1]-.2,h=1+q[4],eps=.025;L.start.set(q[0],y+r+eps,q[2]);L.end.set(q[0],y+Math.max(r+eps,h-r),q[2]);BOX.min.set(q[0]-r,y+eps,q[2]-r);BOX.max.set(q[0]+r,y+h,q[2]+r);
        const tf=t=>{if(Math.max(t.a.y,t.b.y,t.c.y)<=y+eps)return false;return t.closestPointToSegment(L,pp,qq)<r-.012;};
        const A=C.bvh.shapecast({intersectsBounds:bb=>bb.intersectsBox(BOX),intersectsTriangle:tf}),B=nmShapeAny(C.bvh,BOX,tf);caps++;if(A)blk++;if(!!A!==!!B)return 'capsule '+k+' lib '+A+' port '+B;}
      return [rays,hits,caps,blk];})()`);
    assert(Array.isArray(eq), MAP + ': ' + eq);
    // 2) allocation per call (warm up first so the optimised code is measured)
    xe(`window.__W=function(n,which){const C=nmActive(),Q=__Q;let acc=0;for(let k=0;k<n;k++){const q=Q[k%Q.length];if(which===0)acc+=nmHeight(C,q[0],q[2],q[1]+.3);else acc+=nmBlocked(C,q[0],q[2],.35,q[1]-.1,1.8)?1:0;}return acc;};__W(8000,0);__W(8000,1);true`);
    const per = (which) => { const n = 20000; let best = Infinity; for (let rep = 0; rep < 3; rep++) { const h0 = v8.getHeapStatistics().used_heap_size; xe(`__W(${n},${which})`); const d = v8.getHeapStatistics().used_heap_size - h0; if (d >= 0) best = Math.min(best, d / n); } return best; };
    const hB = per(0), bB = per(1);
    out.push(`${MAP}: ${eq[0]} rays (${eq[1]} hits) + ${eq[2]} capsules (${eq[3]} blocked) identical to MeshBVH; nmHeight ${hB.toFixed(1)} B/call, nmBlocked ${bB.toFixed(1)} B/call`);
    assert(hB < 48, MAP + ': nmHeight allocates ' + hB.toFixed(1) + ' B/call (bound 48)');
    assert(bB < 48, MAP + ': nmBlocked allocates ' + bB.toFixed(1) + ' B/call (bound 48)');
  }
  console.log(out.join('\n'));
  process.exit(0);
})().catch((e) => { console.error(e && e.stack || e); process.exit(1); });
