// Foot-planting cost + output recorder (a tool, not in test_all). Real page (work/page_harness.cjs native:true, real agent
// rigs as perf_match_profile AGENTS=1), 5v5 offline match, the player kept alive. Foot planting normally runs for agents
// within XFT.lod (22 m) of the camera; LOD=all (default) plants every living agent so all nine are measured and recorded.
// Per frame: wall ms spent in xfPose (the foot-planting pass: floor probes + body drop + leg IK), the number of agents it
// ran for, xfGround calls and the BVH casts they made. REC=path writes, every frame, the world matrices of each agent's
// Splitter, hips, knees and feet plus the two smoothed foot offsets (computed from the local transforms up the parent
// chain, without touching any matrixWorld), so two trees can be compared bit for bit (work/feet_equiv_compare.cjs).
//   MAP=ascent WARM=20 SECS=40 SEED=3 [LOD=all|page] [REC=/path.bin] [OUT=/path.json] node work/bench_feet.cjs
const fs = require('fs'), path = require('path'), v8 = require('v8'), { performance } = require('perf_hooks');
const { boot } = require('./page_harness.cjs'), inspector = require('inspector');
const PROF = process.env.PROF || ''; // PROF=1: V8 CPU profile of the measured frames, self time inside the foot-planting pass by function
const MAP = process.env.MAP || 'ascent', SECS = +(process.env.SECS || 40), WARM = +(process.env.WARM || 20), SEED = +(process.env.SEED || 3), LOD = process.env.LOD || 'all';
const REC = process.env.REC || '', OUT = process.env.OUT || '';
const tick = () => new Promise((r) => setImmediate(r));
function stats(a) { if (!a.length) return { n: 0 }; const s = [...a].sort((x, y) => x - y), n = s.length, q = (p) => s[Math.min(n - 1, Math.floor(p * n))]; return { n, mean: +(s.reduce((x, y) => x + y, 0) / Math.max(1, n)).toFixed(4), p50: +q(0.5).toFixed(4), p95: +q(0.95).toFixed(4), max: +(s[n - 1] || 0).toFixed(4) }; }
(async () => {
  const H = boot({ real3: true, seed: SEED, native: true, fastGlobal: true }), xe = H.xe;
  H.win.__hr = () => performance.now();
  xe(`{const g=document.getElementById.bind(document),C=new Map();document.getElementById=function(id){const e=C.get(id);if(e&&e.id===id)return e;const r=g(id);if(r)C.set(id,r);return r;};}true`);
  xe(`xvaParse=function(buf){return new Promise((res,rej)=>{const L=new THREE.GLTFLoader();L.register(p=>({name:'EXT_texture_webp',loadTexture:()=>Promise.resolve(new THREE.Texture())}));L.parse(buf,XVA.dir,res,rej);});};true`);
  xe('try{xGQApply("medium")}catch(e){};true');
  const adv = async (ms) => { for (let t = 0; t < ms; t += 50) { H.advance(Math.min(50, ms - t) - 1e-6); await tick(); } };
  xe(`J.pick="Jett";FV.pick=${JSON.stringify(MAP)};FV.srOn=0;FV.repOn=0;window.xSwift=0;xLob0=false;startFive();true`);
  for (let i = 0; i < 400 && !xe('!!(typeof nmActive==="function"&&nmActive()&&running)'); i++) await adv(200);
  if (!xe('!!nmActive()')) throw Error('native map did not load: ' + MAP);
  for (let i = 0; i < 6000 && xe('!running||bots.concat(allies).some(b=>b.xm&&!b.xm.valorant)'); i++) { H.frameMs(1000 / 60); await new Promise((r) => setTimeout(r, 10)); }
  const rigs = xe('bots.concat(allies).filter(b=>b.xm&&b.xm.valorant).length');
  console.error('agent rigs', rigs, xe('JSON.stringify({running,b:bots.length,a:allies.length,xs:typeof xfPose,ft:bots.concat(allies).map(b=>!!(b.xm&&b.xm.sx)).join()})'));
  // LOD=all: every living agent is animated (no frustum / distance cull in xSolTick) and foot-planted (XFT.lod) each frame
  if (LOD === 'all') xe(`XFT.lod=1e9;XS.lod=1e9;xSolTick.F={f:new THREE.Frustum(),m:new THREE.Matrix4(),s:new THREE.Sphere(new THREE.Vector3(),1.3),n:0};xSolTick.F.f.intersectsSphere=()=>true;true`);
  // keep the player alive (god mode, no input) so the match and the camera keep going
  xe(`(window.XHK||(window.XHK=[])).push(()=>{try{if(running&&player&&player.hp<60)player.hp=100;}catch(e){}});true`);
  // instrumentation: wall time in xfPose, agents per frame, xfGround calls, BVH casts (C.bvh.raycastFirst or nmRayFirst / xfRay if present)
  xe(`(()=>{const S=window.__FS={ms:0,n:0,g:0,c:0,on:false,st:0,mx:0,post:0};const P0=xfPose,G0=xfGround,ST=xSolTick,UP=xUbPost;
    xSolTick=function(){if(S.on){S.st++;S.mx=XSOL.mx.length;}return ST.apply(this,arguments);};if(ST.F)xSolTick.F=ST.F;xUbPost=function(){if(S.on)S.post++;return UP.apply(this,arguments);};
    xfPose=function(){if(!S.on)return P0.apply(this,arguments);const a=__hr();try{return P0.apply(this,arguments);}finally{S.ms+=__hr()-a;S.n++;}};
    xfGround=function(){S.g++;S.inG=true;try{return G0.apply(this,arguments);}finally{S.inG=false;}};
    const C=nmActive(),B=C.bvh,rf=B.raycastFirst;B.raycastFirst=function(){if(S.inG)S.c++;return rf.apply(this,arguments);};
    for(const k of ['nmRayFirst','xfRay'])if(typeof window[k]==='function'){const f=window[k];window[k]=function(){if(S.inG)S.c++;return f.apply(this,arguments);};}
    return true;})()`);
  // recorder: 10 unit slots x (7 bones x 16 + 2) doubles per frame; NaN for a slot without a planted rig
  const PER = 7 * 16 + 2, SLOTS = 10;
  xe(`(()=>{const M4=new THREE.Matrix4(),W=new THREE.Matrix4(),chain=[];window.__REC=function(out,o){
    const U=bots.concat(allies);for(let s=0;s<${SLOTS};s++){const b=U[s],base=s*${PER},M=b&&b.xm,X=M&&M.sx,F=X&&X.ft;
      if(!F||!F.ok||!b.alive){for(let i=0;i<${PER};i++)out[o+base+i]=NaN;continue;}
      const bones=[F.split].concat(F.legs[0].up,F.legs[0].lo,F.legs[0].hand,F.legs[1].up,F.legs[1].lo,F.legs[1].hand);
      for(let j=0;j<7;j++){chain.length=0;for(let p=bones[j];p;p=p.parent)chain.push(p);W.identity();for(let k=chain.length-1;k>=0;k--){const p=chain[k];M4.compose(p.position,p.quaternion,p.scale);W.multiply(M4);}
        for(let i=0;i<16;i++)out[o+base+j*16+i]=W.elements[i];}
      out[o+base+112]=F.d[0];out[o+base+113]=F.d[1];}
  };return true;})()`);
  for (let i = 0; i < WARM * 60; i++) { H.frameMs(1000 / 60); if ((i & 7) === 7) await tick(); }
  const N = SECS * 60, rec = REC ? new Float64Array(N * SLOTS * PER) : null, fms = [], fn = [], fg = [], fc = [], frame = [];
  const diag = { st: 0, mx: 0, post: 0 }, cov = { air: 0, crouch: 0, moving: 0, planted: 0 };
  const sess = PROF ? new inspector.Session() : null, post = (m, p) => new Promise((ok, no) => sess.post(m, p || {}, (e, r) => (e ? no(e) : ok(r))));
  if (sess) { sess.connect(); await post('Profiler.enable'); await post('Profiler.setSamplingInterval', { interval: 100 }); await post('Profiler.start'); }
  xe('__FS.on=true;true');
  for (let i = 0; i < N; i++) {
    xe('__FS.ms=0;__FS.n=0;__FS.g=0;__FS.c=0;__FS.st=0;__FS.post=0;true');
    const a = performance.now(); H.frameMs(1000 / 60); frame.push(performance.now() - a);
    const s = xe('[__FS.ms,__FS.n,__FS.g,__FS.c,__FS.st,__FS.mx,__FS.post]'); diag.st += s[4]; diag.mx += s[5]; diag.post += s[6]; fms.push(s[0]); fn.push(s[1]); fg.push(s[2]); fc.push(s[3]);
    if (rec) xe('__REC')(rec, i * SLOTS * PER);
    const c = xe(`(()=>{let a=0,c=0,m=0,p=0;for(const b of bots.concat(allies)){const X=b.xm&&b.xm.sx;if(!X||!X.ft||!b.alive)continue;if(X.air)a++;if((X.cb||0)>.3)c++;if((X.spS||0)>.35)m++;if(X.ftRestore)p++;}return [a,c,m,p];})()`);
    cov.air += c[0]; cov.crouch += c[1]; cov.moving += c[2]; cov.planted += c[3];
    if ((i & 7) === 7) await tick();
  }
  let prof = null;
  if (sess) { const { profile } = await post('Profiler.stop'); const byId = new Map(profile.nodes.map((n) => [n.id, n])), parent = new Map(); for (const n of profile.nodes) for (const c of n.children || []) parent.set(c, n.id);
    const self = new Map(); profile.samples.forEach((s, i) => self.set(s, (self.get(s) || 0) + (profile.timeDeltas[i + 1] || 0) / 1000));
    const inFeet = (id) => { for (let p = id; p != null; p = parent.get(p)) if (byId.get(p).callFrame.functionName === 'xfPose') return true; return false; };
    const fn = new Map(); let tot = 0, all = 0; for (const [id, t] of self) { all += t; if (!inFeet(id)) continue; tot += t; const c = byId.get(id).callFrame, k = (c.functionName || '(anon)') + ' ' + (c.url || '').split('/').pop().slice(0, 24) + ':' + (c.lineNumber + 1); fn.set(k, (fn.get(k) || 0) + t); }
    prof = { feetMsPerFrame: +(tot / N).toFixed(4), allMsPerFrame: +(all / N).toFixed(3), top: [...fn].sort((a, b) => b[1] - a[1]).slice(0, 30).map(([k, t]) => [k, +(t / N).toFixed(4)]) }; }
  // per-agent-call figures, scaled to five visible agents
  const calls = fn.reduce((x, y) => x + y, 0), tms = fms.reduce((x, y) => x + y, 0);
  const per5 = fms.map((m, i) => (fn[i] ? (m / fn[i]) * 5 : NaN)).filter((x) => Number.isFinite(x));
  // isolated (run node with --max-semi-space-size=256 so no scavenge runs inside a batch and the heap delta is the allocation): xfPose only, the bookkeeping above excluded by timing the same loop without xfPose
  xe(`window.__AL2=function(n,on){const C=nmActive(),U=bots.concat(allies).filter(b=>b.alive&&b.xm&&b.xm.sx&&b.xm.sx.ft&&b.xm.sx.ft.ok).slice(0,5),S=[];for(const b of U){const X=b.xm.sx;S.push({M:b.xm,X,d:X.ft.d.slice(),sp:X.ft.split.position.clone(),q:X.ft.legs.map(L=>[L.up.quaternion.clone(),L.lo.quaternion.clone(),L.hand.quaternion.clone()])});}
    let k=0;for(let r=0;r<n;r++)for(const s of S){if(on){xfPose(s.M,1/60,C);k++;}const F=s.X.ft;F.d[0]=s.d[0];F.d[1]=s.d[1];F.split.position.copy(s.sp);s.X.ftRestore=false;for(let i=0;i<2;i++){const L=F.legs[i];L.up.quaternion.copy(s.q[i][0]);L.lo.quaternion.copy(s.q[i][1]);L.hand.quaternion.copy(s.q[i][2]);}}return [k,S.length];};true`);
  xe('__FS.on=false;true');
  xe('__AL2(300,1);__AL2(300,0);true');
  const meas = (on) => { let best = Infinity, bestB = Infinity, k = 0; for (let r = 0; r < 5; r++) { const h0 = v8.getHeapStatistics().used_heap_size, a = performance.now(); const res = xe(`__AL2(200,${on})`); const t = performance.now() - a, d = v8.getHeapStatistics().used_heap_size - h0; k = res[0] || res[1] * 200; best = Math.min(best, t / k); if (d >= 0) bestB = Math.min(bestB, d / k); } return [best, bestB]; };
  const on = meas(1), off = meas(0);
  const iso = { usPerAgentCall: +((on[0] - off[0]) * 1000).toFixed(2), msPer5: +((on[0] - off[0]) * 5).toFixed(4), bytesPerAgentCall: Number.isFinite(on[1]) ? +(on[1] - (Number.isFinite(off[1]) ? off[1] : 0)).toFixed(1) : null };
  const res = { map: MAP, seed: SEED, warm: WARM, secs: SECS, lod: LOD, rigs, frames: N, frameMs: stats(frame), feetMsPerFrame: stats(fms), agentsPerFrame: stats(fn), feetMsPer5Agents: stats(per5), usPerAgentCall: +((tms / Math.max(1, calls)) * 1000).toFixed(2),
    groundCallsPerAgent: +(fg.reduce((x, y) => x + y, 0) / Math.max(1, calls)).toFixed(3), castsPerAgent: +(fc.reduce((x, y) => x + y, 0) / Math.max(1, calls)).toFixed(3), isolated: iso, prof,
    diag: { solTicksPerFrame: diag.st / N, mixersPerFrame: diag.mx / N, ubPostPerFrame: diag.post / N }, coverage: { agentFrames: calls, air: cov.air, crouch: cov.crouch, moving: cov.moving, bodyDropped: cov.planted }, errors: (H.errors || []).slice(0, 5).map((e) => String(e && (e.message || e.e || e)).slice(0, 200)) };
  if (rec) { fs.writeFileSync(REC, Buffer.from(rec.buffer)); res.rec = { path: REC, slots: SLOTS, per: PER }; }
  const txt = JSON.stringify(res, null, 1); if (OUT) fs.writeFileSync(OUT, txt);
  console.log(`${MAP}: rigs ${rigs}, feet ${res.feetMsPerFrame.mean} ms/frame (${res.agentsPerFrame.mean} agents), per 5 agents mean ${res.feetMsPer5Agents.mean} p95 ${res.feetMsPer5Agents.p95} ms, ${res.usPerAgentCall} us/agent, ${res.groundCallsPerAgent} ground calls + ${res.castsPerAgent} casts per agent; isolated ${iso.usPerAgentCall} us/agent call, ${iso.msPer5} ms per 5, ${iso.bytesPerAgentCall} B/agent call; coverage ${JSON.stringify(res.coverage)}`);
  process.exit(0);
})().catch((e) => { console.error(e && e.stack || e); process.exit(1); });
