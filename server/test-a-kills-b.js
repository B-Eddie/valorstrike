// A-kills-B duel over a real local wrangler dev server (ws) - the piece the two-client
// protocol check could not demonstrate (bots always intercepted B first).
// Deterministic via QA hooks (QA_TEST_HOOKS:true required, else the server ignores them):
//   QA_BOTS:0      -> no bot fill; the room is exactly A (team0) vs B (team1)
//   QA_CREDITS     -> A buys Spectre+shields round 1
//   QA_BUY_SECONDS -> short buy phase
// Asserts: 2-human snapshots, B's hp drops in B's OWN snapshot, B dies in both snapshots,
// kill credit AlphaQA in the server kills map, B's death drop (Classic) visible to both.
// Scope label: protocol evidence only - not rendered two-human gameplay acceptance.
import WebSocket from 'ws';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const ROOT = process.env.ROOT || 'ws://127.0.0.1:8788';
const MAP = process.env.MAP || 'lotus';
const CODE = 'DK' + [0,0,0,0].map(() => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random()*32)]).join('');
const NAV = JSON.parse(fs.readFileSync(`public/worlds/${MAP}/navigation.json`, 'utf8'));

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
  while (Date.now() - t0 < ms) { const v = fn(); if (v) return v; await sleep(100); }
  throw new Error('timeout: ' + what); }
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
  return [...idx.map((i) => ({ x: NAV.nodes[i][0], y: NAV.nodes[i][1], z: NAV.nodes[i][2] })), to]; }
class Walker { constructor() { this.pts = null; this.i = 0; this.replanAt = 0; }
  step(me, target) { const now = Date.now();
    if (!this.pts || now >= this.replanAt) { this.pts = bfsPath(me, target); this.i = 0; this.replanAt = now + 2500; if (!this.pts) return null; }
    let wp = this.pts[this.i];
    while (wp && Math.hypot(wp.x - me.x, wp.z - me.z) < 1.2 && this.i < this.pts.length - 1) wp = this.pts[++this.i];
    if (this.i >= this.pts.length - 1 && Math.hypot(wp.x - me.x, wp.z - me.z) < 1.2) return 'arrived';
    return wp; } }

const A = client('A', `create=1&code=${CODE}&mode=five&map=${MAP}`);
A.ws.on('open', () => A.send({ t: 'hi', n: 'AlphaQA' }));
let B;
setTimeout(() => { console.error('GLOBAL TIMEOUT'); process.exit(1); }, 240000);

try {
  await until(() => A.id !== null, 'A welcome (room created)', 15000);
  B = client('B', `code=${CODE}&mode=five&map=${MAP}`);
  B.ws.on('open', () => B.send({ t: 'hi', n: 'BravoQA' }));
  await until(() => B.id !== null, 'B welcome', 15000);
  const startInt = setInterval(() => { if (!A.started) A.send({ t: 'start' }); }, 500);
  await until(() => A.started && B.started, 'both started', 15000);
  clearInterval(startInt);
  const pingInt = setInterval(() => { A.send({ t: 'pi', c: 0 }); B.send({ t: 'pi', c: 0 }); }, 4000);

  // QA_BOTS:0 -> exactly the 2 humans, opposite teams, no bots
  await until(() => A.snap && B.snap && A.snap.u.length === 2 && B.snap.u.length === 2, '2-unit snapshots', 20000);
  for (const c of [A, B]) { const h = c.snap.u.filter((u) => u[12] === 1).map((u) => u[2]);
    assert.deepEqual(h.sort(), ['AlphaQA', 'BravoQA'], c.name + ' sees exactly 2 humans, no bots'); }
  assert.notEqual(A.row(A.id)[1], A.row(B.id)[1], 'A and B on opposite teams');
  console.log('setup ok: 1v1 room, no bots (QA_BOTS:0), teams', A.row(A.id)[1], 'vs', A.row(B.id)[1]);

  // Round-1 buy: A takes Spectre + Light Shields; B keeps the Classic.
  await until(() => A.rs && A.rs.b > 0, 'buy phase', 20000);
  A.send({ t: 'buy', n: 'Spectre' }); A.send({ t: 'buy', n: 'Light Shields' });
  await until(() => A.bo.some((b) => b.n === 'Spectre' && b.ok === true), 'A buys Spectre', 8000);
  console.log('buy ok: A Spectre+shields vs B Classic');
  await until(() => A.rs && A.rs.b <= 0, 'buy over', 30000);

  // Duel: A nav-walks to B, fires once close; B idle. No third party can interfere.
  const walker = new Walker(); let bHurtSeen = 0, bDead = null; const t0 = Date.now();
  while (Date.now() - t0 < 150000) {
    const meA = A.row(A.id), bOnA = A.row(B.id), bOnB = B.row(B.id);
    if (!meA || !bOnA || !bOnB) { await sleep(120); continue; }
    if (bOnB[8] < 100 && !bHurtSeen) bHurtSeen = bOnB[8];
    if (!bOnA[10]) { bDead = { pos: rowPos(bOnA), bSeesDead: !bOnB[10] }; break; }
    const a = aim(rowPos(meA), rowPos(bOnA));
    if (a.d > 11) { const wp = walker.step(rowPos(meA), rowPos(bOnA));
      if (wp && wp !== 'arrived') { const w = aim(rowPos(meA), wp); A.input(w.r, 0, 1, false); }
      else A.input(a.r, a.p, 1, false); }
    else A.input(a.r, a.p, 0, true); // in range: aim and hold fire (Spectre auto)
    if (Date.now() - t0 > 2000 && Math.round((Date.now()-t0)/5000) !== Math.round((Date.now()-t0-120)/5000))
      console.log('  duel', Math.round((Date.now()-t0)/1000) + 's', 'dist', a.d.toFixed(1), 'Bhp(A-view)', bOnA[8], 'Bhp(B-view)', bOnB[8]);
    await sleep(120); }
  assert.ok(bDead, 'B died within the duel window');
  assert.ok(bHurtSeen > 0, 'B saw own hp drop before death (hp ' + bHurtSeen + ' in B snapshot)');
  assert.ok(bDead.bSeesDead, 'B sees own death in B snapshot');
  console.log('duel ok: B hp', bHurtSeen, '-> dead in both snapshots at', JSON.stringify(bDead.pos));

  const kills = await until(() => A.snap.k && A.snap.k.AlphaQA === 1 && A.snap.k, 'kill credit AlphaQA=1', 10000);
  assert.equal(kills.BravoQA || 0, 0, 'B has no kills');
  console.log('credit ok: server kills map', JSON.stringify(kills));
  const drop = await until(() => (A.snap.fw || []).find((d) => d[1] === 'Classic' && Math.hypot(d[2] - bDead.pos.x, d[4] - bDead.pos.z) < 3) && (B.snap.fw || []).some((d) => d[1] === 'Classic'), 'death drop visible to both', 10000);
  assert.ok(drop, 'B Classic death drop in both snapshots');
  console.log('drop ok: Classic on the floor at B death position, visible to A and B');
  clearInterval(pingInt);
  console.log('A-KILLS-B DUEL PASS (protocol evidence only, not rendered two-human acceptance)');
  process.exit(0);
} catch (e) { console.error('FAIL', e.message); process.exit(1); }
