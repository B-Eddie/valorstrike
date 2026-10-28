// Foot-planting floor probes (work/feet_runtime.js xfGround) must be cheap and must answer exactly as before.
// User (2026-10-27): make the floor checks cheaper WITHOUT changing how the animation looks. Each planted agent probes the
// collision BVH under both feet every frame (up to 8 casts per foot, passing through faces too steep to stand on); through
// MeshBVH.raycastFirst every cast allocated a hit object per candidate triangle plus three typed-array views and closures per
// root (~6 KB per agent per frame on Ascent, see work/bench_feet.cjs). On the real collision worlds:
//  1) equivalence: xfGround answers exactly (Object.is) what the shipped probe (the reference below, verbatim, on
//     C.bvh.raycastFirst) answers, for random foot positions over playable nav, steps / ledges (nav neighbours at another
//     height), and probes on triangle vertices (rays through box faces and triangle edges); every single cast too
//     (hit / miss, hit y, face normal y);
//  2) cost: bytes allocated per xfGround call (young generation big enough that no scavenge runs while measuring) and time
//     against the reference on the same probes.
//   MAPS=ascent,split,bind,haven,lotus,breeze N=20000 node work/test_feet_perf.cjs
const cp = require('child_process');
if (!process.execArgv.some((a) => /semi-space/.test(a))) { const r = cp.spawnSync(process.execPath, ['--max-semi-space-size=256', __filename], { stdio: 'inherit' }); process.exit(r.status == null ? 1 : r.status); }
const v8 = require('v8'), assert = require('assert/strict'), { performance } = require('perf_hooks');
const { boot } = require('./page_harness.cjs'), fs = require('fs'), path = require('path');
const tick = () => new Promise((r) => setImmediate(r));
const N = +(process.env.N || 20000);
console.warn = ((w) => (...a) => { if (!/boneTransform/.test(String(a[0]))) w(...a); })(console.warn);
// 0) pose: the whole pass (body drop, leg IK, smoothing) of the shipped block (work/feet_runtime_ref.js) and of the current
// one, on the same native rigs driven the same way over stairs, a slope, a ledge, bumps and airborne spans with idle / walk /
// run / crouch clips (stand-in floor bvh, the library-probe path of both): every leg and Splitter bone world matrix and both
// foot offsets equal bit for bit, every frame.
async function poseEquivalence() {
  const G = await import(path.join(__dirname, '..', 'server/tools/grip-view.mjs')), T = require('./rig_harness.cjs').T;
  let floor = () => 0; const C = { bvh: { raycastFirst: (r) => { const y = floor(r.origin.x, r.origin.z); return y < r.origin.y ? { point: { y }, face: { normal: { y: 1 } } } : null; } } };
  const ref = G.runtime({ feet: true, C, feetSrc: fs.readFileSync(path.join(__dirname, 'feet_runtime_ref.js'), 'utf8') }), cur = G.runtime({ feet: true, C });
  const floors = [['flat', () => 0], ['stairs', (x, z) => Math.floor((x + z * 0.3 + 0.37) / 0.3) * 0.15], ['slope', (x, z) => 0.22 * x - 0.1 * z], ['ledge', (x) => (x > 0.05 ? 1.5 : 0)], ['bumps', (x, z) => 0.08 * Math.sin(7 * x) * Math.cos(5 * z)], ['down-stairs', (x) => -Math.floor(Math.max(0, x + 0.4) / 0.28) * 0.17]];
  let frames = 0, planted = 0, air = 0;
  for (const [agent, weapon] of [['jett', 'vandal'], ['breach', 'classic'], ['sage', 'operator']]) {
    const A = await G.build(agent, weapon, ref), B = await G.build(agent, weapon, cur), bones = (R) => ['Splitter', 'L_Hip', 'L_Knee', 'L_Foot', 'R_Hip', 'R_Knee', 'R_Foot'].map((n) => R.bone(n)), BA = bones(A), BB = bones(B);
    for (const lo of ['idle', 'walk', 'run', 'crouch']) for (const [fn, f] of floors) {
      floor = f; A.play(lo, 'aim'); B.play(lo, 'aim'); for (const R of [A, B]) { R.M.m.position.set(-0.6, 0, -0.2); R.M.m.rotation.y = 0.3; if (R.X.ft) { R.X.ft.d[0] = R.X.ft.d[1] = 0; } R.X.air = false; }
      for (let i = 0; i < 90; i++) {
        const airNow = i >= 50 && i < 58, dt = [1 / 60, 1 / 30, 1 / 144][i % 3];
        for (const R of [A, B]) { R.X.air = airNow; R.M.m.position.x += (lo === 'run' ? 2.4 : lo === 'idle' ? 0.3 : 1.1) * dt; R.M.m.position.y = airNow ? 0.3 : 0; R.step(1, dt, dt); }
        frames++; if (airNow) air++; if (A.X.ftRestore) planted++;
        const wa = new T.Vector3(); for (let j = 0; j < 7; j++) { const ea = BA[j].matrixWorld.elements, eb = BB[j].matrixWorld.elements; for (let e = 0; e < 16; e++) if (!Object.is(ea[e], eb[e])) throw new Error(`pose differs: ${agent} ${lo} ${fn} frame ${i} bone ${j} element ${e}: ${ea[e]} vs ${eb[e]}`); }
        for (let s = 0; s < 2; s++) if (!Object.is(A.X.ft.d[s], B.X.ft.d[s]) || A.X.ftRestore !== B.X.ftRestore) throw new Error(`foot offsets differ: ${agent} ${lo} ${fn} frame ${i}`);
      }
    }
  }
  return `pose: ${frames} frames (${planted} with the body dropped, ${air} airborne) bit-identical to the shipped block`;
}
(async () => {
  const out = [await poseEquivalence()];
  console.log(out[0]);
  for (const MAP of (process.env.MAPS || 'ascent,split').split(',')) {
    const H = boot({ real3: true, seed: 3, native: true, fastGlobal: true }), xe = H.xe;
    xe(`J.pick="Jett";FV.pick=${JSON.stringify(MAP)};FV.srOn=0;FV.repOn=0;window.xSwift=0;xLob0=false;startFive();true`);
    for (let i = 0; i < 400 && !xe('!!(typeof nmActive==="function"&&nmActive()&&running)'); i++) { for (let t = 0; t < 200; t += 50) { H.advance(50 - 1e-6); await tick(); } }
    assert(xe('!!nmActive()'), 'native map loaded: ' + MAP);
    assert(xe('typeof xfGround==="function"&&typeof XFT==="object"'), 'foot planting block present');
    // the shipped probe, verbatim (feet_runtime.js before this change), as the reference
    xe(`window.__REF=function(C,x,z,y0){const R=__REF.R||(__REF.R=new THREE.Ray(new THREE.Vector3(),new THREE.Vector3(0,-1,0)));R.origin.set(x,y0+XFT.max+0.08,z);
      for(let k=0;k<8;k++){const hit=C.bvh.raycastFirst(R,THREE.DoubleSide);if(!hit)return null;if(hit.face&&hit.face.normal.y>0.45)return hit.point.y;R.origin.y=hit.point.y-0.005;if(R.origin.y<y0-XFT.max-0.1)return null;}return null;};true`);
    // probes: [x, z, y0] around playable nav nodes; a third on steps / ledges; a sixth exactly on triangle vertices
    xe(`(()=>{const C=nmActive(),N=C.nav.nodes,A=C.nav.adj,P=[],E=[];for(let i=0;i<N.length;i++){if(!C.playable[i])continue;P.push(i);for(const j of A[i]||[])if(Math.abs(N[j][1]-N[i][1])>0.12){E.push(i);break;}}
      let s=4242;const r=()=>(s=(s*1103515245+12345)>>>0)/4294967296;const pa=C.geometry.attributes.position.array,nv=pa.length/3,Q=new Float64Array(${N}*3);
      for(let k=0;k<${N};k++){let x,z,y;const m=k%6;
        if(m===5){const v=Math.floor(r()*nv)*3;x=pa[v];z=pa[v+2];y=pa[v+1]-0.3+r()*0.6;}
        else{const L=(m<2&&E.length)?E:P,p=N[L[Math.floor(r()*L.length)]];x=p[0]-0.7+r()*1.4;z=p[2]-0.7+r()*1.4;y=p[1]-0.5+r()*1.1;}
        Q[k*3]=x;Q[k*3+1]=z;Q[k*3+2]=y;}window.__Q=Q;return [P.length,E.length];})()`);
    // 1) equivalence
    const eq = xe(`(()=>{const C=nmActive(),Q=__Q;let hits=0,nul=0,multi=0;
      for(let k=0;k<Q.length/3;k++){const x=Q[k*3],z=Q[k*3+1],y=Q[k*3+2],a=__REF(C,x,z,y),b=xfGround(C,x,z,y);if(!Object.is(a,b))return 'probe '+k+' ('+x+', '+z+', '+y+'): reference '+a+' new '+b;if(a==null)nul++;else hits++;}
      // single casts (only when the port exposes them)
      if(typeof xfCast==='function'&&typeof xfViews==='function'){const v=xfViews(C.bvh),R=new THREE.Ray(new THREE.Vector3(),new THREE.Vector3(0,-1,0));if(!v.ok)return 'collision BVH not readable by the port';
        for(let k=0;k<Q.length/3;k++){const x=Q[k*3],z=Q[k*3+1],y=Q[k*3+2]+(k%3)*0.4;R.origin.set(x,y,z);const a=C.bvh.raycastFirst(R,THREE.DoubleSide);XFR.ox=x;XFR.oy=y;XFR.oz=z;const b=xfCast(C.bvh,v);
          if(!!a!==b)return 'cast '+k+': library '+(a?'hit':'miss')+' port '+(b?'hit':'miss');if(a){multi++;if(!Object.is(a.point.y,XFR.py)||!Object.is(a.face.normal.y,XFR.ny))return 'cast '+k+': library y '+a.point.y+' n '+a.face.normal.y+' port y '+XFR.py+' n '+XFR.ny;}}}
      return [hits,nul,multi];})()`);
    assert(Array.isArray(eq), MAP + ': ' + eq);
    // 2) cost: allocation and time per probe, new vs reference, interleaved
    xe(`window.__W=function(n,ref){const C=nmActive(),Q=__Q,m=Q.length/3,f=ref?__REF:xfGround;let acc=0;for(let k=0;k<n;k++){const j=k%m,g=f(C,Q[j*3],Q[j*3+1],Q[j*3+2]);if(g!=null)acc+=g;}return acc;};__W(20000,0);__W(20000,1);true`);
    const per = (ref) => { const n = 20000; let b = Infinity, t = Infinity; for (let rep = 0; rep < 4; rep++) { const h0 = v8.getHeapStatistics().used_heap_size, a = performance.now(); xe(`__W(${n},${ref})`); const dt = performance.now() - a, d = v8.getHeapStatistics().used_heap_size - h0; t = Math.min(t, dt / n); if (d >= 0) b = Math.min(b, d / n); } return [b, t * 1000]; };
    const nw = per(0), rf = per(1), nw2 = per(0);
    const B = Math.min(nw[0], nw2[0]), us = Math.min(nw[1], nw2[1]), speed = rf[1] / us;
    out.push(`${MAP}: ${eq[0] + eq[1]} probes identical (${eq[0]} floors, ${eq[1]} none), ${eq[2]} single-cast hits identical; xfGround ${B.toFixed(1)} B/probe (reference ${rf[0].toFixed(0)}), ${us.toFixed(2)} us/probe (reference ${rf[1].toFixed(2)}, x${speed.toFixed(1)})`);
    // what is left (~64 B) is this loop's own call: three float arguments and the float result of a call that is not inlined are boxed
    assert(B < 128, MAP + ': xfGround allocates ' + B.toFixed(1) + ' B per probe (bound 128; the MeshBVH.raycastFirst probe allocated ' + rf[0].toFixed(0) + ')');
    assert(speed > 1.5, MAP + ': xfGround only x' + speed.toFixed(2) + ' faster than the MeshBVH.raycastFirst probe (bound x1.5, wall clock, interleaved best of 4)');
  }
  console.log(out.join('\n'));
  console.log('foot planting floor probes ok');
  process.exit(0);
})().catch((e) => { console.error(e && e.stack || e); process.exit(1); });
