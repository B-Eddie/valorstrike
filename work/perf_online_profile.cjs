// Online match profile (a tool, not in test_all): the real page (work/page_harness.cjs, real three scene graph, native
// map loader + collision BVH, WebGL stubbed) connected to the real game server (server/src/worker.js in-process through
// server/tools/local-cluster.mjs, prod: fog of war + skins as deployed) over a raw-string WebSocket bridge, plus one
// scripted second human (server/tools/scripted-human.mjs). Both clocks are virtual and stepped together at 60 Hz.
// Server -> page messages are queued and handed to the page's ws.onmessage at the start of each page frame, so the
// page's network work (JSON decode, netClean, snapshot apply, round state, effects) is measured on its own.
// Reports per page frame: wall ms of the frame (timers + rAF), ms and heap bytes of the message handling, heap bytes of
// the frame (frames without a GC), GC count / pause; per server tick: ms and heap bytes of GameRoom.tickBody split
// into sim.step / sim.snapshot / fog view / JSON send; bytes per second to the page and server-wide; and a game-state
// signature (every message the page received, the page's entity positions each frame) to check behaviour is identical.
//   MODE=five|tdm|dm MAP=ascent SECS=60 WARM=10 SEED=3 OUT=/path.json [CPUPROF=/p.cpuprofile] [HEAPPROF=/p.json]
//   [PROF=0] [SIGOUT=/path.sig.json] node work/perf_online_profile.cjs
// Absolute ms are a CPU proxy on a shared box (the harness's fake DOM is slower than a browser); compare before /
// after on the same box. Alloc / GC / bytes are reliable.
const fs = require('fs'), path = require('path'), v8 = require('v8'), crypto = require('crypto'), inspector = require('inspector'), { performance, PerformanceObserver } = require('perf_hooks');
const { boot, mulberry } = require('./page_harness.cjs');
const MODE = process.env.MODE || 'five', MAP = process.env.MAP || 'ascent', SECS = +(process.env.SECS || 60), WARM = +(process.env.WARM || 10), SEED = +(process.env.SEED || 3), OUT = process.env.OUT || '', PROF = process.env.PROF !== '0', NATIVE = process.env.NATIVE !== '0';
const DT = 1000 / 60;
const gcs = []; new PerformanceObserver((l) => { for (const e of l.getEntries()) gcs.push([e.startTime, e.duration, e.detail ? e.detail.kind : e.kind]); }).observe({ entryTypes: ['gc'] });
const sess = new inspector.Session(); sess.connect(); const post = (m, p) => new Promise((ok, no) => sess.post(m, p || {}, (e, r) => (e ? no(e) : ok(r))));
function stats(a) { const s = [...a].filter((x) => Number.isFinite(x)).sort((x, y) => x - y), n = s.length; if (!n) return { n: 0 }; const q = (p) => s[Math.min(n - 1, Math.floor(p * n))]; return { n, mean: +(s.reduce((x, y) => x + y, 0) / n).toFixed(3), p50: +q(0.5).toFixed(3), p95: +q(0.95).toFixed(3), p99: +q(0.99).toFixed(3), max: +s[n - 1].toFixed(3) }; }
const gcDuring = (a, b) => gcs.some((g) => g[0] <= b && g[0] + g[1] >= a);
Math.random = mulberry(SEED * 104729 + 1);
(async () => {
  const H = boot({ real3: true, seed: SEED, native: NATIVE, fastGlobal: process.env.FAST !== '0' }), xe = H.xe;
  xe(`{const g=document.getElementById.bind(document),C=new Map();document.getElementById=function(id){const e=C.get(id);if(e&&e.id===id)return e;const r=g(id);if(r)C.set(id,r);return r;};}true`);
  try { xe(fs.readFileSync(path.join(__dirname, '..', 'vendor', 'hit-impact.js'), 'utf8') + ';true'); } catch (e) {}
  if (process.env.EMU !== '0') xe(fs.readFileSync(path.join(__dirname, 'perf_render_emu.js'), 'utf8') + ';true');
  xe('try{xGQApply("medium")}catch(e){};true');
  // Harness only: three's GLTFLoader cannot decode the device models' textures in Node, so every xvDevice load failed and
  // xvDevicesTick retried it every frame (a file read per frame per device). A browser loads them once; here they stay pending.
  xe('xvLoad=function(n){return XV.cache[n]||(XV.cache[n]=new Promise(function(){}));};true');
  const { localCluster } = await import('../server/tools/local-cluster.mjs'), { ScriptedHuman } = await import('../server/tools/scripted-human.mjs'), { loadWorld } = await import('../server/src/world.js');
  const cluster = await localCluster({ prod: true, env: { ALLOW_LOCAL_ORIGIN: 'true', ENABLE_SPIKE: 'true' } }); const world = await loadWorld(cluster.env.ASSETS, MAP);
  // raw-string bridge
  const inbox = [], codes = new Set(); let pending = 0, bytesDown = 0, msgsDown = 0, snapsDown = 0, bytesUp = 0, msgsUp = 0; const sockets = [];
  const sigHash = crypto.createHash('sha1'); let sigMsgs = 0;
  class WS {
    constructor(url) { const q = Object.fromEntries(new URL(url.replace(/^ws/, 'http')).searchParams); this.readyState = 0; sockets.push(this); pending++; let done = false; const fin = () => { if (!done) { done = true; pending--; } }; if (q.code) codes.add(q.code);
      cluster.fetch('/connect?' + new URLSearchParams(q), { headers: { Upgrade: 'websocket' } }).then(async (r) => {
        if (!r.upgraded) { fin(); this.readyState = 3; const body = await r.text(); this.onclose && this.onclose({ code: 1006, reason: body }); return; }
        const s = (this.sock = r.webSocket); s.addEventListener('message', (e) => inbox.push([this, e.data])); s.addEventListener('close', (e) => { if (this.readyState === 3) return; this.readyState = 3; this.onclose && this.onclose({ code: e.code, reason: e.reason }); });
        fin(); this.readyState = 1; this.onopen && this.onopen({}); }, (e) => { fin(); this.readyState = 3; this.onclose && this.onclose({ code: 1006, reason: String(e) }); }); }
    send(d) { if (this.readyState !== 1) throw Error('send on closed socket'); bytesUp += d.length; msgsUp++; this.sock.send(d); }
    close() { if (this.readyState === 3) return; this.readyState = 3; try { this.sock && this.sock.close(1000, 'client'); } catch (e) {} }
  }
  WS.OPEN = 1; H.win.WebSocket = WS;
  let measuring = false; const netMs = [], netAlloc = [], snapApplyMs = [];
  const deliver = () => {
    if (!inbox.length) return 0; const q = inbox.splice(0); let n = 0;
    const h0 = v8.getHeapStatistics().used_heap_size, a = performance.now();
    for (const [ws, data] of q) { if (ws.readyState !== 1 || !ws.onmessage) continue; n++;
      if (measuring) { bytesDown += data.length; msgsDown++; if (data.charCodeAt(6) === 115 && data.startsWith('{"t":"s"')) snapsDown++; sigHash.update(data); sigMsgs++; }
      ws.onmessage({ data }); }
    const b = performance.now(), h1 = v8.getHeapStatistics().used_heap_size;
    if (measuring && n) { netMs.push(b - a); if (!gcDuring(a, b) && h1 >= h0) netAlloc.push((h1 - h0) / 1024); }
    return n;
  };
  const settle = async () => { const end = Date.now() + 120000; const busy = () => pending > 0 || [...codes].some((c) => { const r = cluster.room(c); return r && [...r.sessions.values()].some((s) => s.authenticating && !s.u); }); while (busy() && Date.now() < end) await new Promise((r) => setTimeout(r, 2)); };
  const humans = []; const join = (code, name, agent, target) => { const h = new ScriptedHuman({ name, agent, world, target }); pending++; let d = false; const fin = () => { if (!d) { d = true; pending--; } }; const s = cluster.connect({ code }); h.attach(s); s.on('message', (m) => h.receive(m)); s.on('open', () => { fin(); h.hello(); }); s.on('error', fin); humans.push(h); return h; };
  // pilot: the page player hunts the nearest enemy with ScriptedHuman's decisions, cannot die (server invulnerable), rifle
  let pilotCode = null, pilotTick = 0; const pilot = new ScriptedHuman({ name: 'PageQA', world, target: null }); let fired = 0;
  const drive = () => { const r = pilotCode && cluster.room(pilotCode), sim = r && r.sim; if (!sim || sim.phase !== 'game' || !xe('NET.ready')) return; const me = sim.units.find((u) => u.human && u.name === xe('MP.name')); if (!me) return;
    me.invulnerableUntil = 1e9; if (sim.mode === 'five' && me.alive && sim.buy > 0 && me.primary !== 'Vandal') { me.credits = 9000; xe("netSend({t:'buy',n:'Vandal'});true"); } // a rifle bought through the page (as test_client_online)
    pilot.id = me.id; pilot.rows = sim.rows(); pilot.time = sim.time * 1000; const foes = sim.units.filter((u) => u !== me && u.alive && !u.loading && (sim.mode === 'dm' || u.team !== me.team)).sort((a, b) => Math.hypot(a.x - me.x, a.z - me.z) - Math.hypot(b.x - me.x, b.z - me.z));
    pilot.target = foes[0] && foes[0].name; pilot.foe = () => pilot.rows.find((q) => q[2] === pilot.target && q[10] === 1) || null; const i = pilot.input(), fire = !!i.fire; if (fire) fired++;
    xe(`yaw=${i.r || 0};pitch=${i.p || 0};keys.KeyW=${(i.f || 0) > 0};keys.KeyS=false;keys.KeyD=${(i.s || 0) > 0};keys.KeyA=${(i.s || 0) < 0};keys.Space=${!!i.j};fireHeld=${fire};if(${fire})NET.firePulse=performance.now()+40;true`); };
  // server tick instrumentation (wrapped once the room exists)
  const tk = { ms: [], alloc: [], step: [], snap: [], view: [], send: [], sendBytes: 0 }; let cur = null;
  const instrument = (room) => {
    const tb = room.tickBody.bind(room); room.tickBody = function () { const h0 = v8.getHeapStatistics().used_heap_size, a = performance.now(); cur = { step: 0, snap: 0, view: 0, send: 0 }; try { return tb(); } finally { const b = performance.now(), h1 = v8.getHeapStatistics().used_heap_size; if (measuring) { tk.ms.push(b - a); if (!gcDuring(a, b) && h1 >= h0) tk.alloc.push((h1 - h0) / 1024); tk.step.push(cur.step); tk.snap.push(cur.snap); tk.view.push(cur.view); tk.send.push(cur.send); } cur = null; } };
    const wrap = (obj, k, slot) => { const f = obj[k]; obj[k] = function () { const a = performance.now(); try { return f.apply(this, arguments); } finally { if (cur) cur[slot] += performance.now() - a; } }; };
    const sim = room.sim; wrap(sim, 'step', 'step'); wrap(sim, 'snapshot', 'snap'); wrap(room, 'view', 'view');
    const send0 = room.send; room.send = function (ws, m) { const a = performance.now(), b0 = this.metrics.bytes; try { return send0.call(this, ws, m); } finally { if (cur) cur.send += performance.now() - a; if (measuring) tk.sendBytes += this.metrics.bytes - b0; } };
  };
  const step = async (frames, sample) => { for (let f = 0; f < frames; f++) { if (xe('MP.code')) codes.add(xe('MP.code')); await settle(); await cluster.advance(DT); deliver(); if (sample) sample(); else H.frameMs(DT); if (pilotCode && (pilotTick += DT) >= 100) { pilotTick = 0; drive(); } } };
  const until = async (cond, ms, what) => { for (let t = 0; t < ms; t += DT) { if (cond()) return; await step(1); } throw Error('timed out: ' + what + ' st ' + xe('MP.st') + ' ready ' + xe('NET.ready') + ' msg ' + xe('MP.msg') + ' errs ' + JSON.stringify(H.errors.slice(0, 3).map(String))); };
  xe(`MP.name='PageQA';J.pick='Jett';window.xQMap=${JSON.stringify(MAP)};MP.map=${JSON.stringify(MAP)};mpCreate(false,${JSON.stringify(MODE)})`);
  await until(() => xe('MP.st') === 'room', 8000, 'room'); const code = xe('MP.code');
  const B = join(code, 'FuzzB', 'Sova', 'PageQA'); await until(() => xe('(MP.room&&MP.room.pl||[]).length') === 2, 8000, 'human joined');
  const room = cluster.room(code); xe('mpStart()');
  // the page loads the native map for real (async file reads): hold the server clock (no ticks) while it loads so the
  // match starts at the same virtual time whatever the box load
  const tl = performance.now();
  for (let i = 0; i < 20000 && !(xe('MP.st') === 'game' && xe('NET.ready')); i++) { await settle(); deliver(); H.frameMs(DT); if (xe('NET.loadAt>0&&!NET.ready')) await new Promise((r) => setTimeout(r, 5)); else await cluster.advance(DT); }
  if (!(xe('MP.st') === 'game' && xe('NET.ready'))) throw Error('page never became ready: ' + xe('MP.msg'));
  const loadMs = performance.now() - tl; instrument(room); pilotCode = code; if (MODE === 'five') room.sim.buy = Math.min(room.sim.buy, 3);
  await step(Math.round(WARM * 60));
  // measured phase
  if (PROF) { await post('Profiler.enable'); await post('Profiler.setSamplingInterval', { interval: 250 }); await post('HeapProfiler.enable'); await post('HeapProfiler.startSampling', { samplingInterval: 16384, includeObjectsCollectedByMajorGC: true, includeObjectsCollectedByMinorGC: true }); await post('Profiler.start'); }
  measuring = true; const N = Math.round(SECS * 60), fms = new Float64Array(N), falloc = new Float64Array(N).fill(NaN), fgc = new Uint8Array(N), sigs = [], v0 = cluster.clock.now(), metrics0 = { ...room.metrics };
  const sigHash2 = crypto.createHash('sha1'), gc0 = gcs.length; let fi = 0;
  const sigOf = () => xe('(()=>{const r=v=>Math.round(v*1e4);const o=[r(player.x),r(player.y||0),r(player.z),player.hp|0];for(const b of bots.concat(allies)){const p=b.g&&b.g.position;o.push(b.alive?1:0,p?r(p.x):0,p?r(p.y):0,p?r(p.z):0,b.g?r(b.g.rotation.y):0);}return o.join(",");})()');
  await step(N, () => { const h0 = v8.getHeapStatistics().used_heap_size, a = performance.now(); H.frameMs(DT); const b = performance.now(), h1 = v8.getHeapStatistics().used_heap_size; fms[fi] = b - a; if (gcDuring(a, b)) fgc[fi] = 1; else if (h1 >= h0) falloc[fi] = (h1 - h0) / 1024; const s = sigOf(); sigHash2.update(s); if (fi % 60 === 0) sigs.push(crypto.createHash('sha1').update(s).digest('hex').slice(0, 12)); fi++; });
  measuring = false; const virtS = (cluster.clock.now() - v0) / 1000;
  const G = gcs.slice(gc0);
  const res = { mode: MODE, map: MAP, secs: SECS, seed: SEED, loadMs: Math.round(loadMs), virtS: +virtS.toFixed(2),
    page: { frameMs: stats(fms), long20: [...fms].filter((x) => x > 20).length, allocKBPerFrame: stats(falloc), framesWithGC: fgc.reduce((x, y) => x + y, 0) },
    net: { msgs: msgsDown, snaps: snapsDown, handleMsPerFrame: stats(netMs), handleMsPerSnap: +(netMs.reduce((x, y) => x + y, 0) / Math.max(1, snapsDown)).toFixed(4), handleAllocKB: stats(netAlloc), bytesDownPerS: Math.round(bytesDown / virtS), bytesUpPerS: Math.round(bytesUp / virtS), msgsUpPerS: +(msgsUp / virtS).toFixed(1), avgSnapBytes: Math.round(bytesDown / Math.max(1, msgsDown)) },
    server: { ticks: tk.ms.length, tickMs: stats(tk.ms), tickAllocKB: stats(tk.alloc), stepMs: stats(tk.step), snapshotMs: stats(tk.snap), viewMs: stats(tk.view), sendMs: stats(tk.send), bytesPerS: Math.round((room.metrics.bytes - metrics0.bytes) / virtS), sessions: room.sessions.size },
    gc: { count: G.length, pauseMsTotal: +G.reduce((x, g) => x + g[1], 0).toFixed(1), pauseMax: +Math.max(0, ...G.map((g) => g[1])).toFixed(2) },
    game: JSON.parse(xe('JSON.stringify({st:MP.st,ready:NET.ready,bots:bots.length,allies:allies.length,alive:bots.filter(b=>b.alive).length+allies.filter(a=>a.alive).length,dropped:NET.dropped||0,drops:NET.drops||[]})')), serverRound: room.sim.round, scores: room.sim.scores, fired,
    sig: { msgs: sigMsgs, msgHash: sigHash.digest('hex'), stateHash: sigHash2.digest('hex'), every60: sigs },
    errors: (H.errors || []).slice(0, 10).map((e) => { try { return JSON.stringify(e).slice(0, 300); } catch (x) { return String(e); } }), harnessErrN: (H.errors || []).length };
  if (PROF) {
    const { profile } = await post('Profiler.stop'); if (process.env.CPUPROF) fs.writeFileSync(process.env.CPUPROF, JSON.stringify(profile)); const { profile: hp } = await post('HeapProfiler.stopSampling'); if (process.env.HEAPPROF) fs.writeFileSync(process.env.HEAPPROF, JSON.stringify(hp));
    const N2 = new Map(profile.nodes.map((n) => [n.id, n])), self = new Map(); profile.samples.forEach((s, i) => self.set(s, (self.get(s) || 0) + (profile.timeDeltas[i + 1] || 0) / 1000));
    const fnSelf = new Map(), side = { page: 0, server: 0, other: 0 }; let tot = 0;
    for (const [id, t] of self) { const n = N2.get(id), f = n.callFrame.functionName || '(anon)', u = n.callFrame.url || ''; if (/^\((idle|program|root)\)$/.test(f)) continue; tot += t; side[/server\/src|evalmachine|worker/.test(u) ? 'server' : /index\.html|valorant-feel|three/.test(u) ? 'page' : 'other'] += t;
      const k = f + ' ' + u.split('/').pop().slice(0, 30) + ':' + (n.callFrame.lineNumber + 1); fnSelf.set(k, (fnSelf.get(k) || 0) + t); }
    res.cpu = { totalMs: Math.round(tot), perFrameMs: +(tot / N).toFixed(3), side: Object.fromEntries(Object.entries(side).map(([k, v]) => [k, +(v / N).toFixed(3)])), topSelf: [...fnSelf].sort((a, b) => b[1] - a[1]).slice(0, 50).map(([k, t]) => [k, +(t / N).toFixed(4)]) };
    const site = new Map(), psite = new Map(); let atot = 0; (function walk(n, pg) { const f = n.callFrame.functionName || '(anon)', u = n.callFrame.url || '', k = f + ' ' + u.split('/').pop().slice(0, 30) + ':' + (n.callFrame.lineNumber + 1); const pk = /index\.html|valorant-feel|server\/src|evalmachine/.test(u) && f !== '(anon)' ? k : pg; const sz = n.selfSize || 0; atot += sz; if (sz) { site.set(k, (site.get(k) || 0) + sz); const q = pk || k; psite.set(q, (psite.get(q) || 0) + sz); } for (const c of n.children || []) walk(c, pk); })(hp.head, null);
    res.heap = { sampledMB: +(atot / 1048576).toFixed(1), perFrameKB: +(atot / 1024 / N).toFixed(2), topSites: [...site].sort((a, b) => b[1] - a[1]).slice(0, 30).map(([k, b]) => [k, +(b / 1024 / N).toFixed(3)]), ownerSites: [...psite].sort((a, b) => b[1] - a[1]).slice(0, 40).map(([k, b]) => [k, +(b / 1024 / N).toFixed(3)]) };
  }
  const txt = JSON.stringify(res, null, 1); if (OUT) fs.writeFileSync(OUT, txt); else console.log(txt);
  console.log(`${MODE}/${MAP}: page frame ${res.page.frameMs.mean} p95 ${res.page.frameMs.p95} ms alloc ${res.page.allocKBPerFrame.mean} KB/f | net ${res.net.handleMsPerSnap} ms/snap alloc ${res.net.handleAllocKB.mean} KB, down ${res.net.bytesDownPerS} B/s up ${res.net.bytesUpPerS} B/s | server tick ${res.server.tickMs.mean} p95 ${res.server.tickMs.p95} ms alloc ${res.server.tickAllocKB.mean} KB (step ${res.server.stepMs.mean} snap ${res.server.snapshotMs.mean} view ${res.server.viewMs.mean} send ${res.server.sendMs.mean}) ${res.server.bytesPerS} B/s | gc ${res.gc.count} (${res.gc.pauseMsTotal} ms) | sig ${res.sig.msgHash.slice(0, 10)} ${res.sig.stateHash.slice(0, 10)} errs ${res.harnessErrN}`);
  for (const h of humans) try { h.leave(); } catch (e) {}
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
