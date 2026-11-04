// Extended two-client protocol check: the remaining agents of the 18-agent roster, over a real local
// wrangler dev server. Same scope label as test-two-client-18.js: protocol/state evidence for online
// play (two real websocket clients, authoritative server snapshots) - NOT rendered two-human gameplay.
// For each agent: A plays the agent, B plays Jett (enemy), no bots. A casts each kit key; for casts that
// create a world effect, BOTH clients' snapshots must carry the expected fx row; for self-only status
// casts (no world effect by design) the server's ao response must confirm acceptance. Toggle/recast
// mechanics (Viper cloud/screen, Waylay Refract, Yoru Gatecrash, Veto Crosscut, Vyse Arc Rose) are
// exercised through their real second-cast flow, with teleport returns asserted on BOTH clients.
// Run: QA_TEST_HOOKS='true' QA_ULT='9' QA_BUY_SECONDS='1' QA_BOTS='0' npx wrangler dev --port 8787,
//   then AGENTS='Brimstone,Clove' node test-two-client-18b.js   (AGENTS unset = all)
import WebSocket from 'ws';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const ROOT = process.env.ROOT || 'ws://127.0.0.1:8787';
const MAP = process.env.MAP || 'ascent';
const CODE = () => 'TB' + [0,0,0,0].map(() => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random()*32)]).join('');

function client(name, query) {
  const c = { name, ws: new WebSocket(ROOT + '/connect?' + query), id: null, snap: null, seq: 0, ao: null };
  c.ws.on('message', (d) => { const m = JSON.parse(d);
    if (m.t === 'welcome') c.id = m.you;
    else if (m.t === 'ao') c.ao = m;
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
async function approach(A, B, stop) {
  const t0 = Date.now();
  while (Date.now() - t0 < 60000) {
    const a = rowPos(A.row(A.id)), b = rowPos(B.row(B.id));
    if (!a || !b) { await sleep(150); continue; }
    if (dist(a, b) <= stop) return { a, b };
    const pts = bfsPath(a, b);
    const wp = pts && pts.find((p) => dist(a, p) > 1.5) || b;
    A.input(Math.atan2(-(wp.x - a.x), -(wp.z - a.z)), 0, 1, false);
    await sleep(150);
  }
  throw new Error('approach timeout');
}

// send one cast and wait for the server's ability-outcome for that key
async function cast(A, k, extra = {}) {
  A.ao = null;
  A.send({ t: 'ab', k, ...extra });
  const t0 = Date.now();
  while (!A.ao || A.ao.k !== k) { if (Date.now() - t0 > 8000) throw new Error('no ao for ' + k); await sleep(100); }
  const m = A.ao; A.ao = null; return m;
}
const fxOn = (c, kind) => (c.snap && c.snap.fx || []).some((f) => f.kind === kind);
const fxBoth = (A, B, kind) => fxOn(A, kind) && fxOn(B, kind);
const posOnBothNear = (A, B, p, r) => [A, B].every((c) => { const row = c.row(A.id); return row && Math.hypot(row[4] - p.x, row[6] - p.z) < r; });

let firstCast = true;
async function step(A, B, label, s) {
  const tag = label + ' ' + s.k + (s.fx ? '->' + s.fx : ' (self/status)');
  if (s.approach) { await approach(A, B, s.approach); console.log(tag + ': approached to ' + s.approach + 'm'); }
  if (s.los) { await seekLos(A, B, s.near); console.log(tag + ': line of sight established (both unfogged' + (s.near ? ', within ' + s.near + 'm' : '') + ')'); }
  let m = await cast(A, s.k, s.extra || {});
  if (!m.ok && firstCast) { await sleep(2000); m = await cast(A, s.k, s.extra || {}); } // buy-phase race on the first cast
  firstCast = false;
  if (!m.ok) console.log('REJECT-DIAG', tag, 'phase', A.snap && A.snap.phase, 'tl', A.snap && A.snap.tl, 'rs', JSON.stringify(m.rs && m.rs.ab));
  assert.ok(m.ok, tag + ': cast rejected (ao ok=false, rs=' + JSON.stringify(m.rs && m.rs.ab) + ')');
  if (s.fx && s.ownOnly) { // enemy-hidden rows (Vyse Shear): live on the caster, never sent to the enemy team until triggered
    await until(() => fxOn(A, s.fx), tag + ': ' + s.fx + ' fx row on caster', 12000);
    await sleep(700);
    assert.ok(!fxOn(B, s.fx), tag + ': ' + s.fx + ' must NOT reach the enemy client (hidden trap)');
    console.log(tag + ': ' + s.fx + ' fx row on caster only (enemy-hidden by design)'); }
  else if (s.fx) { await until(() => fxBoth(A, B, s.fx), tag + ': ' + s.fx + ' fx row on both clients', 12000).catch((e) => {
    const dump = (c) => ({ meTeam: (c.row(c.id) || [])[1], meAlive: (c.row(c.id) || [])[3], other: ((c.snap.u.find((u) => u[0] !== c.id)) || []).slice(0, 8), fx: (c.snap.fx || []).map((f) => f.kind + '@' + (f.p || []).map((n) => Math.round(n)).join(',')), tl: c.snap.tl });
    console.log('FX-DUMP A:', JSON.stringify(dump(A)));
    console.log('FX-DUMP B:', JSON.stringify(dump(B)));
    throw e; });
    console.log(tag + ': ' + s.fx + ' fx row live on both clients'); }
  else console.log(tag + ': accepted (ao ok, no world fx row by design)');
  if (s.toggle) { await sleep(450); const m2 = await cast(A, s.k, s.extra || {}); // server per-key cool .3s assert.ok(m2.ok, tag + ': toggle recast rejected');
    await until(() => fxBoth(A, B, s.toggle), tag + ': toggle ' + s.toggle + ' fx row on both clients', 12000);
    console.log(tag + ': toggle on -> ' + s.toggle + ' fx row live on both clients'); }
  return m;
}
// marker/anchor casts whose SECOND cast teleports the caster: assert the jump on both clients.
// Fog of war masks an enemy's row when unseen/unheard, so A first walks to B (running footsteps reveal
// within FOG.step 30m) and stays running through the assertion; B's row of A must unmask and match A's own.
const hidden = (row) => !row || row[22] === 1 || (Math.abs(row[4]) + Math.abs(row[6])) === 0;
async function tpStep(A, B, label, s) {
  const tag = label + ' ' + s.k + ' teleport recast';
  await approach(A, B, 14); // inside hearing radius
  const bp = rowPos(B.row(B.id));
  if (!s.back) { // aim at B so the anchor lands in B's direction (stays audible after the jump)
    for (let i = 0; i < 5; i++) { const a = rowPos(A.row(A.id)); A.input(Math.atan2(-(bp.x - a.x), -(bp.z - a.z)), 0, 0, false); await sleep(120); }
  }
  const p0 = rowPos(A.row(A.id));
  let m = await cast(A, s.k, s.extra || {}); assert.ok(m.ok, tag + ': anchor cast rejected');
  if (s.anchorFx) { await until(() => fxBoth(A, B, s.anchorFx), tag + ': ' + s.anchorFx + ' anchor fx on both clients', 12000);
    console.log(tag + ': ' + s.anchorFx + ' anchor fx live on both clients'); }
  if (s.fake) { await sleep(450); const mf = await cast(A, s.k, { fk: 1 }); assert.ok(mf.ok, tag + ': fake recast rejected');
    await until(() => fxBoth(A, B, 'gatefake'), tag + ': gatefake fx on both clients', 12000);
    console.log(tag + ': Gatecrash fake (fk) -> gatefake fx row live on both clients'); }
  if (s.walk) { const away = Math.atan2(-(p0.x - bp.x), -(p0.z - bp.z));
    for (let i = 0; i < 16; i++) { A.input(away, 0, 1, false); await sleep(150); }
    console.log(tag + ': walked ' + dist(p0, rowPos(A.row(A.id))).toFixed(1) + 'm from the marker'); }
  const pre = rowPos(A.row(A.id));
  await sleep(450); // server per-key cool .3s
  m = await cast(A, s.k, s.extra || {}); assert.ok(m.ok, tag + ': teleport recast rejected');
  const t0 = Date.now(); let ok = false, jump = 0;
  while (Date.now() - t0 < 9000) {
    const a = rowPos(A.row(A.id)); const b2 = rowPos(B.row(B.id)) || bp;
    A.input(Math.atan2(-(b2.x - a.x), -(b2.z - a.z)), 0, 1, false); // run toward B: audible, fog lifts
    await sleep(150);
    const ra = rowPos(A.row(A.id)); if (!ra) continue;
    const ownOk = s.back ? Math.hypot(ra.x - p0.x, ra.z - p0.z) < 6 : dist(ra, pre) > 2.5;
    const rb = B.row(A.id);
    if (ownOk && !hidden(rb) && Math.hypot(rb[4] - ra.x, rb[6] - ra.z) < 2.5) { ok = true; jump = dist(pre, ra); break; }
  }
  A.input(0, 0, 0, false);
  assert.ok(ok, tag + ': teleported position not confirmed on both clients');
  await sleep(700); // the server's pendingTeleport window (gatecrash ~0.5 s) must close before the next cast - casting mid-teleport is legitimately rejected
  console.log(tag + ': teleport live on both clients (jump ' + jump.toFixed(1) + 'm' + (s.back ? ', back at the marker' : ' to the anchor') + ', B unfogged and matching)');
}
// walk A toward B until A's client sees B unfogged (pairSees is symmetric: then B also sees A)
async function seekLos(A, B, near) {
  const t0 = Date.now();
  while (Date.now() - t0 < 30000) {
    const rb = A.row(B.id); if (!hidden(rb) && (!near || dist(rowPos(A.row(A.id)), rowPos(rb)) <= near)) { await sleep(300); return; }
    const a = rowPos(A.row(A.id)), b = rowPos(B.row(B.id));
    const pts = bfsPath(a, b); const wp = pts && pts.find((p) => dist(a, p) > 1.5) || b;
    A.input(Math.atan2(-(wp.x - a.x), -(wp.z - a.z)), 0, 1, false);
    await sleep(150);
  }
  throw new Error('seekLos timeout');
}
const CASES = {
  Brimstone: [ {k:'c',fx:'stim'}, {k:'q',fx:'fire'}, {k:'e',fx:'smoke'}, {k:'x',fx:'orbital'} ],
  Clove:     [ {k:'q',fx:'blast'}, {k:'e',fx:'smoke'} ], // c Pick-me-up needs a kill in its window; x Not Dead Yet needs Clove dead - outside this suite's live-cast scope
  Harbor:    [ {k:'c',fx:'blast'}, {k:'q',fx:'tide'}, {k:'e',fx:'cove'}, {k:'x',fx:'reckon'} ],
  Miks:      [ {k:'c',fx:'mpulse'}, {k:'q'}, {k:'e',fx:'smoke'}, {k:'x',fx:'bassq'} ],
  Viper:     [ {k:'c',fx:'fire'}, {k:'q',toggle:'smoke'}, {k:'e',toggle:'tscreen'}, {k:'x',fx:'pit'} ],
  Hush:      [ {k:'c'}, {k:'q'}, {k:'e',fx:'pull'}, {k:'x',fx:'susp'} ],
  Iso:       [ {k:'c',fx:'conting'}, {k:'q',fx:'blast'} ], // x Kill Contract covered end-to-end in test-two-client-18.js
  Neon:      [ {k:'c',fx:'fastlane'}, {k:'q',fx:'blast'}, {k:'e'}, {k:'x'} ],
  Waylay:    [ {k:'c',fx:'blast'}, {k:'q'}, {k:'e',tp:'back'}, {k:'x',fx:'paths'} ],
  Yoru:      [ {k:'c',fx:'decoy'}, {k:'q'}, {k:'e',tp:'fwd',fake:true}, {k:'x'} ],
  Fade:      [ {k:'c',fx:'seeker'}, {k:'q',fx:'seize'}, {k:'e',fx:'haunt'}, {k:'x',fx:'nightfall'} ],
  Gekko:     [ {k:'c',fx:'mosh'}, {k:'q',fx:'seeker'}, {k:'e',fx:'dizzy'}, {k:'x',fx:'blast'} ],
  'KAY/O':   [ {k:'c',fx:'frag'}, {k:'q'}, {k:'e',fx:'blast'}, {k:'x',fx:'nullcmd'} ],
  Tejo:      [ {k:'c',fx:'sdrone'}, {k:'q',fx:'blast'}, {k:'e',fx:'salvo'}, {k:'x',fx:'armag'} ],
  Deadlock:  [ {k:'x',fx:'anni',los:true,near:12}, {k:'c',fx:'barrier',los:true}, {k:'q',fx:'sensor'}, {k:'e',fx:'gnet'} ],
  Veto:      [ {k:'c',tp:'fwd',anchorFx:'xcut'}, {k:'q',fx:'choke'}, {k:'e',fx:'ceptor'}, {k:'x'} ],
  Vyse:      [ {k:'c',fx:'vine'}, {k:'q',fx:'shear',ownOnly:true}, {k:'e',fx:'rose',recastConsumes:true}, {k:'x',fx:'garden'} ],
};

setTimeout(() => { console.error('GLOBAL TIMEOUT'); process.exit(1); }, Number(process.env.GTIMEOUT || 300000));

const only = (process.env.AGENTS || '').split(',').map((s) => s.trim()).filter(Boolean);
const names = Object.keys(CASES).filter((n) => !only.length || only.includes(n));
if (!names.length) { console.error('no matching agents'); process.exit(1); }
console.log('agents this run: ' + names.join(', '));
let pass = 0;
for (const ag of names) {
  const { A, B, ping } = await room(ag, 'Jett');
  A.send({ t: 'buy', n: 'ab:c' }); A.send({ t: 'buy', n: 'ab:q' }); // QA_BUY_SECONDS:4 window, QA_CREDITS funds
  await sleep(5500); // buy phase over (round clock tl starts at 100)
  firstCast = true;
  for (const s of CASES[ag]) {
    if (s.tp) { await tpStep(A, B, ag, { ...s, back: s.tp === 'back', walk: s.tp === 'back' }); firstCast = false; continue; }
    const m = await step(A, B, ag, s);
    if (s.recastConsumes) { await sleep(450); const m2 = await cast(A, s.k); // server per-key cool .3s assert.ok(m2.ok, ag + ' e rose recast rejected');
      await until(() => !fxOn(A, 'rose') && !fxOn(B, 'rose'), ag + ': rose consumed on both clients after the flash recast', 12000);
      console.log(ag + ' e recast: Arc Rose flashed, rose row consumed on both clients (flash itself is a server-side blind, no fx row by design)'); }
  }
  clearInterval(ping); A.ws.close(); B.ws.close();
  pass++; console.log(ag + ': room PASS (' + pass + '/' + names.length + ')');
  await sleep(800);
}
console.log('two-client 18b (' + names.length + ' agents: ' + names.join(', ') + '): PASS');
process.exit(0);
