// Two-client protocol check for the added agents' networked mechanics, over a real local wrangler dev server.
// Scope label: protocol/state evidence for online play - not rendered two-human gameplay acceptance.
//   Room 1: A (Iso) vs B (Jett), no bots. A walks to B (nav graph), aims, Kill Contract: BOTH clients must see
//     both combatants at the pocket-arena cell (x ~= ARENA_X +/- 4) and a 'duel' fx row; A then kills B inside
//     the duel, the duel ends and A is returned to the map.
//   Room 2: A (Astra) vs B, no bots. A enters Astral Form (QA_ULT hook) and casts Gravity Well at B through the
//     map path (ab c with m.p): BOTH clients must see the 'gwell' fx row at B's position.
// Run: npm run dev with QA vars (work/test-two-client-18.sh or CI), then node test-two-client-18.js
import WebSocket from 'ws';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const ROOT = process.env.ROOT || 'ws://127.0.0.1:8787';
const MAP = process.env.MAP || 'ascent';
const ARENA_X = 10000;
const CODE = () => 'T8' + [0,0,0,0].map(() => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random()*32)]).join('');

function client(name, query) {
  const c = { name, ws: new WebSocket(ROOT + '/connect?' + query), id: null, snap: null, seq: 0 };
  c.ws.on('message', (d) => { const m = JSON.parse(d);
    if (m.t === 'welcome') c.id = m.you;
    else if (m.t === 'ao') { c.ao = m; console.log(name, 'ao', JSON.stringify(m)); }
    else if (m.t === 'rs') c.rs = m;
    else if (m.t === 's') c.snap = m;
    else if (m.t === 'start') c.ws.send(JSON.stringify({ t: 'ready' }));
  });
  c.ws.on('error', (e) => { console.error(name, 'ws error', e.message); process.exit(1); });
  c.send = (m) => c.ws.send(JSON.stringify(m));
  c.input = (r, p, f, fire) => c.send({ t: 'in', seq: ++c.seq, r, p, f, fire: fire ? 1 : 0 });
  c.row = (id) => c.snap && c.snap.u.find((u) => u[0] === id);
  return c;
}
const rowPos = (u) => ({ x: u[4], y: u[5], z: u[6] });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(fn, what, ms) { const t0 = Date.now();
  while (Date.now() - t0 < ms) { const v = fn(); if (v) return v; await sleep(120); }
  throw new Error('timeout: ' + what); }

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
  return idx.map((i) => ({ x: NAV.nodes[i][0], y: NAV.nodes[i][1], z: NAV.nodes[i][2] })).concat([to]); }

async function room(agA, agB) {
  const code = CODE();
  const A = client('A', `create=1&code=${code}&mode=five&map=${MAP}`);
  A.ws.on('open', () => A.send({ t: 'hi', n: 'AlphaQA', ag: agA }));
  await until(() => A.id !== null, 'A welcome', 15000);
  const B = client('B', `code=${code}&mode=five&map=${MAP}`);
  B.ws.on('open', () => B.send({ t: 'hi', n: 'BravoQA', ag: agB }));
  await until(() => B.id !== null, 'B welcome', 15000);
  const ping = setInterval(() => { A.send({ t: 'pi', c: 0 }); B.send({ t: 'pi', c: 0 }); }, 4000);
  const start = setInterval(() => A.send({ t: 'start' }), 500);
  await until(() => A.snap && B.snap && A.snap.phase === 'game', 'game snapshots on both', 20000);
  clearInterval(start);
  return { A, B, ping };
}
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

// walk `from`'s client toward the other player until within `stop` metres (post-buy)
async function approach(A, B, stop) {
  const t0 = Date.now();
  while (Date.now() - t0 < 60000) {
    const a = rowPos(A.row(A.id)), b = rowPos(B.row(B.id));
    if (!a || !b) { await sleep(150); continue; }
    if (dist(a, b) <= stop) return { a, b };
    const pts = bfsPath(a, b);
    const wp = pts && pts.find((p) => dist(a, p) > 1.5) || b;
    const r = Math.atan2(-(wp.x - a.x), -(wp.z - a.z));
    A.input(r, 0, 1, false);
    await sleep(150);
  }
  throw new Error('approach timeout');
}

setTimeout(() => { console.error('GLOBAL TIMEOUT'); process.exit(1); }, 240000);

// ---- Room 1: Iso Kill Contract, both clients see the pocket arena duel
{
  const { A, B, ping } = await room('Iso', 'Jett');
  await sleep(6000); // QA_BUY_SECONDS:1 - buy is over by now (snapshot carries no buy field; the round clock tl starts at 100)
  await approach(A, B, 18);
  const a0 = rowPos(A.row(A.id)), b0 = rowPos(B.row(B.id));
  const r0 = Math.atan2(-(b0.x - a0.x), -(b0.z - a0.z));
  for (let i = 0; i < 6; i++) { A.input(r0, 0, 0, false); await sleep(120); } // settle the aim
  console.log('pre-cast positions A', JSON.stringify(rowPos(A.row(A.id))), 'B(own)', JSON.stringify(rowPos(B.row(B.id))));
  A.send({ t: 'ab', k: 'x' });
  const seen = () => {
    const sa = A.snap, sb = B.snap; if (!sa || !sb) return false;
    const inA = (c) => { const ra = c.row(A.id), rb = c.row(B.id); return ra && rb && Math.abs(ra[4] - (ARENA_X - 4)) < 2 && Math.abs(rb[4] - (ARENA_X + 4)) < 2; };
    const fx = (c) => (c.snap.fx || []).some((f) => f.kind === 'duel' && Math.abs(f.p[0] - ARENA_X) < 2);
    return inA(A) && inA(B) && fx(A) && fx(B);
  };
  await until(seen, 'both clients see both combatants at the arena cell plus the duel fx row', 20000).catch((e) => {
    const dump = (c) => ({ me: c.row(c.id), other: c.row(c === A ? B.id : A.id), fx: (c.snap.fx || []).map((f) => f.kind + '@' + (f.p || []).map((n) => Math.round(n)).join(',')) });
    console.log('SEEN-FAIL A:', JSON.stringify(dump(A)));
    console.log('SEEN-FAIL B:', JSON.stringify(dump(B)));
    throw e;
  });
  console.log('iso duel online: both clients see A at x~' + (ARENA_X - 4) + ', B at x~' + (ARENA_X + 4) + ', duel fx row live');
  // finish the duel: B is suppressed on entry; A shoots B until the duel ends and A returns to the map
  const t0 = Date.now(); let ended = false;
  while (Date.now() - t0 < 60000) {
    const a = rowPos(A.row(A.id)), b = rowPos(B.row(B.id));
    if (a && Math.abs(a.x - ARENA_X) > 50) { ended = true; break; }
    if (a && b) { const r = Math.atan2(-(b.x - a.x), -(b.z - a.z)); A.input(r, 0, 0, true); }
    await sleep(150);
  }
  assert.ok(ended, 'duel ended with A returned to the map');
  const bRow = A.row(B.id);
  console.log('iso duel online: duel ended, A back on the map, B alive=' + (bRow ? bRow[3] : '?'));
  clearInterval(ping); A.ws.close(); B.ws.close();
}

// ---- Room 2: Astra Astral Form + map-placed Gravity Well, visible to both clients
{
  const { A, B, ping } = await room('Astra', 'Jett');
  await sleep(6000);
  const { a, b } = await approach(A, B, 18);
  A.send({ t: 'ab', k: 'x' }); // Astral Form (QA_ULT charged)
  await sleep(400);
  A.send({ t: 'ab', k: 'c', p: [b.x, b.z] }); // Gravity Well placed through the map
  const seen = () => ['A', 'B'].every((n) => false) || [A, B].every((c) => (c.snap.fx || []).some((f) => f.kind === 'gwell' && Math.hypot(f.p[0] - b.x, f.p[2] - b.z) < 3));
  await until(seen, 'both clients see the gwell fx row at B', 15000);
  console.log('astra star online: Astral Form opened, Gravity Well fx row at B visible to both clients');
  clearInterval(ping); A.ws.close(); B.ws.close();
}
console.log('two-client agents18: PASS');
process.exit(0);
