// Two-client PROTOCOL check over a real local wrangler dev server (ws).
// Scope label: protocol evidence only - not rendered two-human gameplay acceptance.
// Flow: A creates a five-mode room, B joins; both ready; both receive snapshots with 2 humans.
// During buy both walk forward (clamped at spawn barrier). After buy, A walks at B and fires
// until B dies; assert BOTH clients see B dead and a floor drop appears (death drop).
// Then A walks to the dropped gun and picks it (online pickup path): expect bo ok and the
// floor entry gone from snapshots.
import WebSocket from 'ws';
import assert from 'node:assert/strict';

const ROOT = process.env.ROOT || 'ws://127.0.0.1:8787';
const MAP = process.env.MAP || 'lotus';
const CODE = 'TC' + [0,0,0,0].map(() => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random()*32)]).join('');

function client(name, query) {
  const c = { name, ws: new WebSocket(ROOT + '/connect?' + query), id: null, snap: null, rs: null, seq: 0, bo: [], started: false };
  c.ws.on('message', (d) => { const m = JSON.parse(d);
    if (m.t === 'welcome') c.id = m.you;
    else if (m.t === 's') c.snap = m;
    else if (m.t === 'rs') c.rs = m;
    else if (m.t === 'start') { c.started = true; c.ws.send(JSON.stringify({ t: 'ready' })); }
    else if (m.t === 'bo') c.bo.push(m);
  });
  c.ws.on('error', (e) => { console.error(name, 'ws error', e.message); process.exit(1); });
  c.ws.on('close', (code, reason) => console.error(name, 'WS CLOSED', code, String(reason)));
  c.send = (m) => c.ws.send(JSON.stringify(m));
  c.input = (r, p, f, fire) => c.send({ t: 'in', seq: ++c.seq, r, p, f, fire: fire ? 1 : 0 });
  c.row = (id) => c.snap && c.snap.u.find((u) => u[0] === id);
  return c;
}
const rowPos = (u) => ({ x: u[4], y: u[5], z: u[6] });
const aim = (from, to) => { const dx = to.x - from.x, dz = to.z - from.z;
  return { r: Math.atan2(-dx, -dz), p: Math.atan2((to.y + 1.2) - (from.y + 1.6), Math.hypot(dx, dz)), d: Math.hypot(dx, dz) }; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(fn, what, ms) { const t0 = Date.now();
  while (Date.now() - t0 < ms) { const v = fn(); if (v) return v; await sleep(120); }
  throw new Error('timeout: ' + what); }

// Nav-graph waypoint walking: straight-line inputs snag on geometry; the baked nav graph is walkable by construction.
import fs from 'node:fs';
const NAV = JSON.parse(fs.readFileSync(`public/worlds/${MAP}/navigation.json`, 'utf8'));
const nearNode = (p) => { let bi = -1, bd = 1e18;
  for (let i = 0; i < NAV.nodes.length; i++) { if (NAV.valid && !NAV.valid[i]) continue; const n = NAV.nodes[i];
    const d = (n[0]-p.x)**2 + (n[2]-p.z)**2 + (n[1]-p.y)**2 * 4; if (d < bd) { bd = d; bi = i; } }
  return bi; };
function bfsPath(from, to) { const s = nearNode(from), t = nearNode(to);
  if (s < 0 || t < 0) return null; if (s === t) return [to];
  const prev = new Map([[s, -1]]); const q = [s];
  while (q.length) { const i = q.shift(); if (i === t) break;
    for (const j of NAV.adj[i]) { if (NAV.valid && !NAV.valid[j]) continue; if (!prev.has(j)) { prev.set(j, i); q.push(j); } } }
  if (!prev.has(t)) return null;
  const idx = []; for (let i = t; i !== -1; i = prev.get(i)) idx.push(i); idx.reverse();
  const pts = idx.map((i) => ({ x: NAV.nodes[i][0], y: NAV.nodes[i][1], z: NAV.nodes[i][2] }));
  pts.push(to); return pts; }
class Walker { constructor() { this.pts = null; this.i = 0; this.replanAt = 0; }
  step(c, me, target) { const now = Date.now();
    if (!this.pts || now >= this.replanAt) { this.pts = bfsPath(me, target); this.i = 0; this.replanAt = now + 2500;
      if (!this.pts) return null; }
    let wp = this.pts[this.i];
    while (wp && Math.hypot(wp.x - me.x, wp.z - me.z) < 1.2 && this.i < this.pts.length - 1) wp = this.pts[++this.i];
    if (this.i >= this.pts.length - 1 && Math.hypot(wp.x - me.x, wp.z - me.z) < 1.2) return 'arrived';
    return wp; } }

const A = client('A', `create=1&code=${CODE}&mode=five&map=${MAP}`);
A.ws.on('open', () => A.send({ t: 'hi', n: 'AlphaQA' }));
const B = client('B', `code=${CODE}&mode=five&map=${MAP}`);
B.ws.on('open', () => B.send({ t: 'hi', n: 'BravoQA' }));

setTimeout(() => { console.error('GLOBAL TIMEOUT'); process.exit(1); }, 170000);

try {
  await until(() => A.id !== null && B.id !== null, 'both welcomes', 15000);
  const startInt = setInterval(() => { if (!A.started) A.send({ t: 'start' }); }, 500);
  await until(() => A.started && B.started, 'both clients started', 15000);
  clearInterval(startInt);
  // Keepalive: the server idle-closes ready sessions after 15s without a message; a dead B sends no inputs.
  const pingInt = setInterval(() => { A.send({ t: 'pi', c: 0 }); B.send({ t: 'pi', c: 0 }); }, 4000);

  // Phase 1: both clients receive snapshots with 2 humans among 10 units.
  await until(() => A.snap && B.snap && A.snap.u.length === 10 && B.snap.u.length === 10, '10-unit snapshots on both', 20000);
  for (const c of [A, B]) { const h = c.snap.u.filter((u) => u[12] === 1).map((u) => u[2]);
    assert.deepEqual(h.sort(), ['AlphaQA', 'BravoQA'], c.name + ' sees 2 humans'); }
  const aRow = A.row(A.id), bRow = A.row(B.id);
  assert.ok(aRow && bRow, 'both human rows visible to A');
  assert.notEqual(aRow[1], bRow[1], 'humans on opposite teams');
  console.log('phase1 ok: both clients receive 10-unit snapshots with AlphaQA/BravoQA human, opposite teams');

  // Buy phase: walk toward each other (spawn barrier clamps the approach).
  const walkInt = setInterval(() => { for (const [c, other] of [[A, B], [B, A]]) {
    const me = c.row(c.id), fo = c.row(other.id); if (!me || !fo) return;
    const a = aim(rowPos(me), rowPos(fo)); c.input(a.r, 0, 1, false); } }, 100);
  const walker = new Walker(); const walkerB = new Walker();
  await until(() => A.rs && A.rs.b <= 0, 'buy phase over', 40000);
  clearInterval(walkInt);

  // Phase 2: A closes in, then fires at B until B is dead on BOTH clients.
  // Classic is semi-auto: the server only refires after a trigger release (fire:0 between shots).
  let killSeenA = false, killSeenB = false, fireToggle = false, lastLog = 0; const t0 = Date.now();
  while (Date.now() - t0 < 80000) {
    const meA = A.row(A.id), bOnA = A.row(B.id), bOnB = B.row(B.id);
    if (!meA || !bOnA) { await sleep(300); continue; } // round transitions briefly reshuffle rows
    if (meA[10] === 0) throw new Error('A died to bots before killing B (positions A ' + JSON.stringify(rowPos(meA)) + ')');
    if (bOnA[10] === 0 && bOnB && bOnB[10] === 0) { killSeenA = killSeenB = true; break; }
    const a = aim(rowPos(meA), rowPos(bOnA));
    // B walks toward A; A holds and engages any enemy within 25u (head aim). A gets the kill
    // when B arrives unless an attacker bot intercepts B first (kill credit reported either way).
    const meB = B.row(B.id), aOnB = B.row(A.id);
    if (meB && aOnB && meB[10] === 1) { const wb = walkerB.step(B, rowPos(meB), rowPos(aOnB));
      if (wb && wb !== 'arrived') { const w2 = aim(rowPos(meB), wb); B.input(w2.r, 0, 1, false); } }
    let threat = null, td = 25;
    for (const u of A.snap.u) { if (u[1] === meA[1] || u[10] === 0) continue;
      const d = Math.hypot(u[4] - meA[4], u[6] - meA[6]); if (d < td) { td = d; threat = u; } }
    if (threat) { const t = aim(rowPos(meA), { x: threat[4], y: threat[5] + 0.35, z: threat[6] });
      fireToggle = !fireToggle; A.input(t.r, t.p, 0, fireToggle); }
    else fireToggle = false;
    if (Date.now() - lastLog > 5000) { lastLog = Date.now();
      console.log('  combat', Math.round((Date.now()-t0)/1000) + 's', 'dist', a.d.toFixed(1), 'Bhp', bOnA[8], 'tl', A.snap.tl && A.snap.tl.toFixed(1), 'phase', A.snap.phase, 'A', JSON.stringify(rowPos(meA)), 'B', JSON.stringify(rowPos(bOnA))); }
    await sleep(90);
  }
  assert.ok(killSeenA && killSeenB, 'B death visible on both clients');
  const credited = (A.snap.k || {}).AlphaQA > 0;
  console.log('phase2 ok: B dead in both clients\' snapshots; kill credit to AlphaQA:', credited);

  // Floor drop: B's best gun lands where B died; both clients' snapshots carry it in fw.
  const bDead = rowPos(B.row(B.id));
  console.log('  B died at', JSON.stringify(bDead), 'fw now:', JSON.stringify(A.snap.fw||[]), 'kills:', JSON.stringify(A.snap.k));
  const fwHas = (c) => (c.snap.fw || []).find((d) => Math.hypot(d[2] - bDead.x, d[4] - bDead.z) < 8); // fw rows: [id,w,x,y,z]
  const dropA = await until(() => fwHas(A), 'death drop in A snapshot', 8000);
  await until(() => fwHas(B), 'death drop in B snapshot', 8000);
  console.log('phase3 ok: death drop fw id', dropA[0], dropA[1], 'visible to both clients');

  // Phase 4 (online pickup path): A walks to the gun and picks it.
  let picked = false; const t1 = Date.now();
  while (Date.now() - t1 < 70000) {
    const meA = A.row(A.id); if (!meA || meA[10] === 0) throw new Error('A died before pickup');
    const d = (A.snap.fw || []).find((x) => x[0] === dropA[0]); if (!d) break;
    const dp = { x: d[2], y: d[3], z: d[4] };
    const a = aim(rowPos(meA), dp);
    let threat = null, td = 20, aliveEnemies = 0;
    for (const u of A.snap.u) { if (u[1] === meA[1] || u[10] === 0) continue; aliveEnemies++;
      const dd = Math.hypot(u[4] - meA[4], u[6] - meA[6]); if (dd < td) { td = dd; threat = u; } }
    // Camp until the bot war thins out (<=2 enemies left); the drop persists until round end.
    const camp = aliveEnemies > 2 && a.d > 2.0;
    if (threat && (camp || a.d > 2.0 && td < 12)) { const t = aim(rowPos(meA), { x: threat[4], y: threat[5] + 0.35, z: threat[6] });
      fireToggle = !fireToggle; A.input(t.r, t.p, 0, fireToggle); walker.pts = null; walker.replanAt = 0; }
    else if (camp) { fireToggle = false; A.input(0, 0, 0, false); }
    else if (a.d > 2.0) { fireToggle = false; const wp = walker.step(A, rowPos(meA), dp);
      if (wp && wp !== 'arrived') { const w = aim(rowPos(meA), wp); A.input(w.r, 0, 1, false); }
      else A.input(a.r, 0, 1, false); }
    else { A.input(a.r, -1.2, 0, false); A.send({ t: 'pick', id: d[0] }); }
    const bo = A.bo[A.bo.length - 1]; if (bo && bo.ok === true && A.bo.length > 0) { picked = true; break; }
    await sleep(100);
  }
  assert.ok(picked, 'A picked the dropped gun (bo ok)');
  await until(() => !(A.snap.fw || []).some((x) => x[0] === dropA[0]), 'fw entry consumed', 8000);
  console.log('phase4 ok: online pick accepted (bo ok), floor entry consumed; swap drop is server-owned');
  console.log('TWO-CLIENT PROTOCOL PASS (protocol evidence only, not rendered two-human acceptance)');
  process.exit(0);
} catch (e) { console.error('FAIL', e.message); process.exit(1); }
