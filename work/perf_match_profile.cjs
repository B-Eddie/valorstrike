// Full-match JS profile on the real page (a tool, not in test_all): work/page_harness.cjs native:true (the real native-map
// loader, nav, collision BVH and every gameplay block; the map's render meshes and agent models are not loaded offline, and
// WebGL is stubbed), MEDIUM graphics preset, 5v5 with the player alive (god mode) trailing an ally and firing bursts at the
// nearest visible enemy, 9 bots. The stubbed renderer is replaced by work/perf_render_emu.js (CPU-side three render model
// that counts draw calls / programs / texture uploads / buffer uploads).
// Per frame (fixed 60 Hz page clock): wall ms of the whole frame (timers + rAF), heap bytes allocated (frames without a
// GC), GC pauses; a V8 CPU profile grouped into game systems (self time) and a sampling heap profile (allocation sites).
//   MAP=ascent SECS=120 SEED=3 OUT=/path.json [START=startESC] node work/perf_match_profile.cjs
// The harness's fake DOM costs more than a browser's (getElementById is cached here as in bench_hit_path); absolute ms are
// a CPU proxy, compare before / after on the same box.
const fs = require('fs'), path = require('path'), v8 = require('v8'), inspector = require('inspector'), { performance, PerformanceObserver } = require('perf_hooks');
const { boot } = require('./page_harness.cjs');
const MAP = process.env.MAP || 'ascent', SECS = +(process.env.SECS || 120), SEED = +(process.env.SEED || 3), OUT = process.env.OUT || '', PROF = process.env.PROF !== '0', START = /^start[A-Za-z]+$/.test(process.env.START || '') ? process.env.START : 'startFive'; // START=startESC / startTDM / startDM profiles that mode
const gcs = []; new PerformanceObserver((l) => { for (const e of l.getEntries()) gcs.push([e.startTime, e.duration, e.detail ? e.detail.kind : e.kind]); }).observe({ entryTypes: ['gc'] });
const sess = new inspector.Session(); sess.connect(); const post = (m, p) => new Promise((ok, no) => sess.post(m, p || {}, (e, r) => (e ? no(e) : ok(r))));
const tick = () => new Promise((r) => setImmediate(r));
function stats(a) { const s = [...a].sort((x, y) => x - y), n = s.length, q = (p) => s[Math.min(n - 1, Math.floor(p * n))]; return { n, mean: +(s.reduce((x, y) => x + y, 0) / Math.max(1, n)).toFixed(3), p50: +q(0.5).toFixed(3), p95: +q(0.95).toFixed(3), p99: +q(0.99).toFixed(3), max: +s[n - 1].toFixed(3) }; }
// system groups for the CPU profile (self time); first match wins
const GROUPS = [
  ['render model (scene traversal, matrices, culling, skinning)', (f, u) => /perf_render_emu|three\.min/.test(u) && /render|project|drawObj|updateMatrixWorld|updateMatrix|intersects|compose|multiply|setFromProjection|update$|traverse|makeRotation|applyMatrix|copy|decompose|getInverse|invert|premultiply|matUse|texUse|geoUse|attrUse|progKey|draw$/.test(f)],
  ['raycasts / LOS (BVH)', (f, u) => /three-mesh-bvh/.test(u) || /^(los|xbLosNow|xLos|nmLos|xWall|xPen|raycast|intersectRay|raycastFirst|shapecast|intersectTri|bvhcast)/i.test(f)],
  ['three math (other)', (f, u) => /three\.min/.test(u)],
  ['physics / motor / collision', (f) => /^(moveP|blocked|xCol|nmCollide|nmHeight|nmGround|motor|vf[A-Z]|xSmV|pushOut|xFloor|xStep|capsule|slide|xUn$|xUnembed|xbUnembed)/.test(f) || /valorant-feel/.test(f)],
  ['bot AI / nav', (f) => /^(xb|xBot|xPeek|xPath|xGoal|xFight|xFace|xTrade|botRun|botWalk|botK|botStopped|botCanShoot|xbEngage|xHunt|fNav|nmPath|nmNear|nmRoute|astar|xNav|BotBrain|xUtilShoot|xTagK|botStep|xHP|xhp|cornerPick|fiveTick|tick$|xbNoFoe|xTpBots|xDget|xKnown)/.test(f)],
  ['abilities', (f) => /^(botAb|ab[A-Z]|j[A-Z]|xAb|xUlt|abil|bAb|xSol|xVis|xBs|xBS)/.test(f)],
  ['particles / decals / hit fx', (f, u) => /hit-impact/.test(u) || /^(bfx|BFX|xHit|XHIT|decal|xDec|spark|tracer|xTr|shoot|bSpread|xBotAim|hurt|xTag|kill|allyDie|wDmg|xHb|xdTick|xRag|fin)/i.test(f)],
  ['HUD / DOM (kill feed, xLog, scoreboard)', (f) => /^(xHud|updHud|hud|feed|kfeed|xLog|board|sb[A-Z]|xhDraw|xKF|kf|xDmg|setScope|xAssist|vmTick|xhErr|annc|say|fsSet|showStats|ph$|xLb|lb$)/.test(f)],
  ['audio', (f, u) => /audio/.test(u) || /^(SFX|aud|tone|noise|xSnd|play|beep|whir|plantBeep|step)/i.test(f)],
  ['minimap', (f) => /^(nmMinimap|mm|nmMapProjection|minimap)/i.test(f)],
  ['harness fake DOM / timers', (f, u) => /audit\.js|page_harness|perf_match_profile/.test(u)],
  ['GC', (f) => f === '(garbage collector)'],
];
(async () => {
  const H = boot({ real3: true, seed: SEED, native: true, fastGlobal: process.env.FAST !== '0' }), xe = H.xe;
  xe(`{const g=document.getElementById.bind(document),C=new Map();document.getElementById=function(id){const e=C.get(id);if(e&&e.id===id)return e;const r=g(id);if(r)C.set(id,r);return r;};}true`);
  try { xe(fs.readFileSync(path.join(__dirname, '..', 'vendor', 'hit-impact.js'), 'utf8') + ';true'); } catch (e) {}
  xe(fs.readFileSync(path.join(__dirname, 'perf_render_emu.js'), 'utf8') + ';true');
  // AGENTS=1: real agent rigs (the page's loader on models/valorant/agents/*.glb; textures replaced by empty Textures, no
  // image decode in Node). Units wait hidden for their kit and attach it when it lands (xvAttach); see the wait below.
  if (process.env.AGENTS === '1') xe(`xvaParse=function(buf){return new Promise((res,rej)=>{const L=new THREE.GLTFLoader();L.register(p=>({name:'EXT_texture_webp',loadTexture:()=>Promise.resolve(new THREE.Texture())}));L.parse(buf,XVA.dir,res,rej);});};true`);
  xe('try{xGQApply("medium")}catch(e){};true');
  const gq = xe('JSON.stringify({gq:localStorage.getItem("vs.gq"),shd:XS.shd,shm:XS.shm,lod:XS.lod,prc:XS.prc,aa:XS.aa})');
  const adv = async (ms) => { for (let t = 0; t < ms; t += 50) { H.advance(Math.min(50, ms - t) - 1e-6); await tick(); } };
  xe(`J.pick="Jett";FV.pick=${JSON.stringify(MAP)};FV.srOn=0;FV.repOn=0;window.xSwift=0;xLob0=false;${START}();true`);
  const tl = performance.now();
  for (let i = 0; i < 400 && !xe('!!(typeof nmActive==="function"&&nmActive()&&running)'); i++) await adv(200);
  if (!xe('!!nmActive()')) throw Error('native map did not load: ' + MAP);
  const loadMs = performance.now() - tl;
  if (process.env.AGENTS === '1') { for (let i = 0; i < 6000 && xe('!running||bots.concat(allies).some(b=>b.xm&&!b.xm.valorant)'); i++) { H.frameMs(1000 / 60); await new Promise((r) => setTimeout(r, 10)); }
    console.error('agent rigs:', xe('bots.concat(allies).filter(b=>b.xm&&b.xm.valorant).length'), '/', xe('bots.length+allies.length')); }
  // player pilot: god mode, trail the first living ally, aim at the nearest enemy in sight within 45 m, fire 0.5 s bursts
  xe(`(()=>{const P=window.__PILOT={t:0,fire:0,shots:0};(window.XHK||(window.XHK=[])).push(()=>{try{if(!running||!player)return;P.t++;if(player.hp<60)player.hp=100;
   const ex=player.x,ey=(player.y||0)+1.6,ez=player.z;let best=null,bd=45;
   if(P.t%6===0){P.tg=null;for(const b of bots){if(!b.alive||!b.g)continue;const p=b.g.position,d=Math.hypot(p.x-ex,p.z-ez);if(d<bd&&los(new THREE.Vector3(ex,ey,ez),new THREE.Vector3(p.x,p.y+1.4,p.z))){bd=d;best=b;}}P.tg=best;
    if(!best){const a=allies.find(a=>a.alive&&a.g);if(a){const q=a.g.position,d=Math.hypot(q.x-ex,q.z-ez);if(d>5){player.x=q.x-Math.sin(a.g.rotation.y)*1.5;player.z=q.z-Math.cos(a.g.rotation.y)*1.5;player.y=q.y;}}}}
   const t=P.tg;if(t&&t.alive&&!(FV.buy>0)){const p=t.g.position,dx=p.x-ex,dz=p.z-ez,dy=p.y+1.3-ey;yaw=Math.atan2(-dx,-dz);pitch=Math.atan2(dy,Math.hypot(dx,dz));const on=!window.__NOFIRE&&(P.t%45)<30;if(on&&!fireHeld)P.shots++;fireHeld=on;if(ammo<3){ammo=MAG();reloading=0;}}else fireHeld=false;}catch(e){}});return true;})()`);
  if (process.env.NOFIRE === '1') xe('window.__NOFIRE=1;true'); // NOFIRE=1: same pilot (aims at the same enemies), trigger never pulled
  // measured phase
  if (PROF) { await post('Profiler.enable'); await post('Profiler.setSamplingInterval', { interval: 250 }); await post('HeapProfiler.enable'); await post('HeapProfiler.startSampling', { samplingInterval: 16384, includeObjectsCollectedByMajorGC: true, includeObjectsCollectedByMinorGC: true }); await post('Profiler.start'); }
  xe('__PS.live=true;__PS.endFrame();true');
  const N = SECS * 60, ms = new Float64Array(N), alloc = new Float64Array(N).fill(NaN), t0s = new Float64Array(N), t1s = new Float64Array(N), emu = [];
  let longFr = 0, kills0 = xe('typeof XKF!=="undefined"?0:0');
  for (let i = 0; i < N; i++) {
    const h0 = v8.getHeapStatistics().used_heap_size, a = performance.now();
    H.frameMs(1000 / 60);
    const b = performance.now(), h1 = v8.getHeapStatistics().used_heap_size;
    ms[i] = b - a; t0s[i] = a; t1s[i] = b; alloc[i] = h1 - h0; // a negative delta = a GC ran; dropped below with the GC timeline
    emu.push(xe('JSON.stringify(__PS.endFrame())'));
    if ((i & 7) === 7) await tick();
  }
  await tick(); await tick();
  // GC overlap per frame
  const gcIn = new Uint8Array(N); let gi = 0; const G = gcs.slice().sort((x, y) => x[0] - y[0]);
  for (let i = 0; i < N; i++) { while (gi < G.length && G[gi][0] + G[gi][1] < t0s[i]) gi++; for (let j = gi; j < G.length && G[j][0] <= t1s[i]; j++) gcIn[i] = 1; }
  const al = []; for (let i = 0; i < N; i++) if (!gcIn[i] && alloc[i] >= 0) al.push(alloc[i] / 1024);
  const gcMeasured = G.filter((g) => g[0] >= t0s[0] && g[0] <= t1s[N - 1]);
  const E = emu.map((s) => JSON.parse(s)), sum = (k) => E.reduce((x, e) => x + e[k], 0);
  const PS = JSON.parse(xe(`JSON.stringify({progNew:__PS.progNew.slice(0,40),progNewN:__PS.progNew.length,progs:__PS.progs.size,up:__PS.up.filter(u=>u.live).slice(0,60),upLiveN:__PS.up.filter(u=>u.live).length,upAll:__PS.up.length,
    upSizes:Object.entries(__PS.up.reduce((m,u)=>{const k=u.w+'x'+u.h+(u.live?' live':' load');m[k]=(m[k]||0)+1;return m;},{})),grow:__PS.grow.slice(0,30),growN:__PS.grow.length,realloc:__PS.realloc.slice(0,20),reallocN:__PS.realloc.length,nullData:__PS.nullData.length,
    geoNewLive:__PS.geoNewLive.length,geoNewLiveTypes:Object.entries(__PS.geoNewLive.reduce((m,t)=>{m[t]=(m[t]||0)+1;return m;},{})).sort((a,b)=>b[1]-a[1]).slice(0,12),matNewLive:__PS.matNewLive,geoWho:(__PS.geoWho||[]).slice(0,40),matWho:(__PS.matWho||[]).slice(0,40),matVerLive:__PS.matVerLive,shadowBakes:__PS.shadowBakes,shadowCalls:__PS.shadowCalls})`));
  const game = JSON.parse(xe('JSON.stringify({running,mode,fvR:typeof FV!=="undefined"?(FV.r||FV.round||0):0,score:typeof FV!=="undefined"?[FV.sc&&FV.sc[0],FV.sc&&FV.sc[1]]:null,bots:bots.length,allies:allies.length,alive:bots.filter(b=>b.alive).length+allies.filter(a=>a.alive).length,shots:__PILOT.shots,scene:(()=>{let n=0;scene.traverse(()=>n++);return n;})(),errs:0})'));
  const res = { map: MAP, secs: SECS, seed: SEED, preset: JSON.parse(gq), loadMs: Math.round(loadMs), frameMs: stats(ms), long20: [...ms].filter((x) => x > 20).length, long33: [...ms].filter((x) => x > 33.4).length, long50: [...ms].filter((x) => x > 50).length,
    allocKBPerFrame: stats(al), gc: { count: gcMeasured.length, minor: gcMeasured.filter((g) => g[2] === 1 || g[2] === 'minor').length, pauseMsTotal: +gcMeasured.reduce((x, g) => x + g[1], 0).toFixed(1), pauseMax: +Math.max(0, ...gcMeasured.map((g) => g[1])).toFixed(2), framesWithGC: gcIn.reduce((x, y) => x + y, 0) },
    draw: { callsPerFrame: stats(E.map((e) => e.calls)), trisPerFrame: stats(E.map((e) => e.tris)), newProgramsLive: PS.progNewN, programsTotal: PS.progs, texUploadsLive: PS.upLiveN, texUploadsAll: PS.upAll, texUploadSizes: PS.upSizes, texGrow: PS.growN, texRealloc: PS.reallocN, texNullData: PS.nullData,
      geoNewLive: PS.geoNewLive, geoNewLiveTypes: PS.geoNewLiveTypes, matNewLive: PS.matNewLive, matNeedsUpdateLive: PS.matVerLive, attrUploadsPerFrame: stats(E.map((e) => e.attr)), attrKBPerFrame: stats(E.map((e) => e.attrBytes / 1024)), shadowBakes: PS.shadowBakes, shadowCalls: PS.shadowCalls },
    detail: { geoWho: PS.geoWho, matWho: PS.matWho, progNew: PS.progNew, uploadsLive: PS.up, grow: PS.grow, realloc: PS.realloc }, game, errors: (H.errors || []).slice(0, 10).map((e) => String(e && (e.message || e.e || e)).slice(0, 200)), harnessErrN: (H.errors || []).length };
  // spikes: frames > 20 ms with their emu counters
  res.spikes = [...ms].map((x, i) => [i, +x.toFixed(1), gcIn[i]]).filter((r) => r[1] > 20).sort((a, b) => b[1] - a[1]).slice(0, 25).map(([i, x, g]) => ({ i, ms: x, gc: g, ...E[i] }));
  if (PROF) {
    const { profile } = await post('Profiler.stop'); if (process.env.CPUPROF) fs.writeFileSync(process.env.CPUPROF, JSON.stringify(profile)); const { profile: hp } = await post('HeapProfiler.stopSampling');
    const N2 = new Map(profile.nodes.map((n) => [n.id, n])), self = new Map(); profile.samples.forEach((s, i) => self.set(s, (self.get(s) || 0) + (profile.timeDeltas[i + 1] || 0) / 1000));
    const fnSelf = new Map(), grp = new Map(); let tot = 0;
    for (const [id, t] of self) { const n = N2.get(id), f = n.callFrame.functionName || '(anon)', u = n.callFrame.url || ''; if (/^\((idle|program|root)\)$/.test(f)) continue; tot += t;
      const k = f + ' ' + u.split('/').pop().slice(0, 30) + ':' + (n.callFrame.lineNumber + 1); fnSelf.set(k, (fnSelf.get(k) || 0) + t);
      const g = (GROUPS.find(([, m]) => m(f, u)) || ['other page JS'])[0]; grp.set(g, (grp.get(g) || 0) + t); }
    res.cpu = { totalMs: Math.round(tot), perFrameMs: +(tot / N).toFixed(3), groups: [...grp].sort((a, b) => b[1] - a[1]).map(([g, t]) => [g, +(t / N).toFixed(3), +(t / tot * 100).toFixed(1)]), topSelf: [...fnSelf].sort((a, b) => b[1] - a[1]).slice(0, 40).map(([k, t]) => [k, +(t / N).toFixed(4)]) };
    const site = new Map(), psite = new Map(); let atot = 0; (function walk(n, pg) { const f = n.callFrame.functionName || '(anon)', u = n.callFrame.url || '', k = f + ' ' + u.split('/').pop().slice(0, 30) + ':' + (n.callFrame.lineNumber + 1); const pk = /index\.html|valorant-feel/.test(u) && f !== '(anon)' ? k : pg; const sz = (n.selfSize || 0); atot += sz; if (sz) { site.set(k, (site.get(k) || 0) + sz); const q = pk || k; psite.set(q, (psite.get(q) || 0) + sz); } for (const c of n.children || []) walk(c, pk); })(hp.head, null);
    res.heap = { sampledMB: +(atot / 1048576).toFixed(1), perFrameKB: +(atot / 1024 / N).toFixed(2), topSites: [...site].sort((a, b) => b[1] - a[1]).slice(0, 30).map(([k, b]) => [k, +(b / 1024 / N).toFixed(3)]), pageSites: [...psite].sort((a, b) => b[1] - a[1]).slice(0, 30).map(([k, b]) => [k, +(b / 1024 / N).toFixed(3)]) };
  }
  const txt = JSON.stringify(res, null, 1); if (OUT) fs.writeFileSync(OUT, txt); else console.log(txt);
  console.log(`${MAP}: frame mean ${res.frameMs.mean} p95 ${res.frameMs.p95} p99 ${res.frameMs.p99} ms, >20ms ${res.long20}, alloc ${res.allocKBPerFrame.mean} KB/f, gc ${res.gc.count} (${res.gc.pauseMsTotal} ms), calls ${res.draw.callsPerFrame.mean}, newProg ${res.draw.newProgramsLive}, texUp live ${res.draw.texUploadsLive}, grow ${res.draw.texGrow}`);
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
