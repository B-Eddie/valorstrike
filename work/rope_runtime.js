// ---- ROPE ASCENDERS ----
// VALORANT Split's rope ascenders on the page (wiki.playvalorant.com/en-us/Split: two Sewer -> A Lobby, one B Hell -> B Tower,
// four in Vents; no other shipped map has ropes). The climb itself is the shared motor (vendor/valorant-feel.js = server
// src/motor.cjs ROPES / ropeStep): the player's moveP passes world.ropes (feel_runtime.js), Use (F) grabs, W / S climb
// look-relative, climbing past the top steps off, Jump pushes off, Use again lets go, guns fire with the rope spread. This block:
//  - nmRopes (called by nmEnsure before nmConnected, as server world.js before its playable set and leash grid): C.ropes (the
//    motor's ROPES[map]), the same nav links as the server (motor ropeLinks: lower <-> upper floor node of each rope, valid
//    nodes) in C.ropeLinks and nav.adj, and the rope meshes: a cable from the lower floor to ~2.3 m above the upper floor (under
//    the ceiling) hung 0.3 m toward the ledge from the climbing axis, with a housing at its top bracketed to the nearest wall;
//    the ropes are also marked on the minimap;
//  - offline bots on ropes: nmNext routes a bot to the rope when a rope link is in its next hops (xrBot), the xStep wrapper then
//    grabs and climbs it with the shared motor (as server ropes.js ropeBot) and hands the bot back at the far floor;
//  - online: snapshot row [25] (server simulation.js rows: 1-based rope index, 0 none; fog hides it; [24] = Blade Storm knives) -> u.rope; P2P host rows
//    carry [25] too (the host's player, its bots, and P2P clients, who send rp in their input message); a tapped F always reaches
//    the server (one input message carries it, as fire pulses); an eased reconcile correction keeps the player on the rope;
//  - the climb pose: a separate, last xUbPost wrapper (support hand on the rope, legs bent), undone in xUbPre; the
//    third-person gait code is not touched;
//  - "F  Grab rope" under the crosshair in reach of a rope ("F  Let go" while climbing); F there does not inspect the gun.
var XRO = { off: 0.3, top: 2.3, err: 0, ray: null, useP: 0, el: null, geo: null, v0: [0, 0] };
function xroVF() { return typeof window !== 'undefined' && window.ValorantFeel || null; }
function xroRay(C, o, d, max) {
  if (!C || !C.bvh || typeof THREE === 'undefined') return Infinity;
  const R = XRO.ray || (XRO.ray = new THREE.Ray(new THREE.Vector3(), new THREE.Vector3())); R.origin.set(o[0], o[1], o[2]); R.direction.set(d[0], d[1], d[2]).normalize();
  const h = C.bvh.raycastFirst(R, THREE.DoubleSide); return h && h.distance < max ? h.distance : Infinity;
}
// Where a rope's cable and housing go: cable 0.3 m from the climbing axis toward the ledge (between the climber and the wall),
// from the lower floor to 2.3 m above the upper floor or 0.14 m under the ceiling; housing bracketed to the nearest wall within 2.5 m.
function xroSpec(C, r) {
  let ux = r.ex - r.x, uz = r.ez - r.z; const l = Math.hypot(ux, uz) || 1; ux /= l; uz /= l;
  const cx = r.x + ux * XRO.off, cz = r.z + uz * XRO.off; let top = r.y1 + XRO.top;
  const up = xroRay(C, [cx, r.y1 + 0.5, cz], [0, 1, 0], XRO.top + 1); if (up < Infinity) top = Math.min(top, r.y1 + 0.5 + up - 0.14);
  let wall = null; for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2, dx = Math.sin(a), dz = Math.cos(a), d = xroRay(C, [cx, top, cz], [dx, 0, dz], 2.5); if (d < (wall ? wall.d : Infinity)) wall = { d, dx, dz }; }
  return { name: r.name, cx, cz, y0: r.y0, top, wall, ux, uz };
}
function xroMeshes(C, specs) {
  const g = new THREE.Group(); g.name = 'native-ropes';
  const G = XRO.geo || (XRO.geo = { cable: new THREE.MeshStandardMaterial({ color: 0xb59f74, roughness: 0.95, metalness: 0 }), metal: new THREE.MeshStandardMaterial({ color: 0x3b4148, roughness: 0.55, metalness: 0.45 }), stripe: new THREE.MeshStandardMaterial({ color: 0xe7b416, roughness: 0.6, metalness: 0.1 }), box: new THREE.BoxGeometry(1, 1, 1) });
  const box = (sx, sy, sz, m, x, y, z, ry) => { const o = new THREE.Mesh(G.box, m); o.scale.set(sx, sy, sz); o.position.set(x, y, z); if (ry) o.rotation.y = ry; o.matrixAutoUpdate = false; o.updateMatrix(); g.add(o); return o; };
  for (const s of specs) {
    const h = s.top - s.y0, cable = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, h, 6, 1), G.cable); cable.name = 'rope-cable'; cable.position.set(s.cx, s.y0 + h / 2, s.cz); cable.matrixAutoUpdate = false; cable.updateMatrix(); g.add(cable);
    const ry = Math.atan2(s.ux, s.uz); box(0.34, 0.3, 0.34, G.metal, s.cx, s.top + 0.15, s.cz, ry).name = 'rope-housing'; box(0.36, 0.06, 0.36, G.stripe, s.cx, s.top + 0.04, s.cz, ry);
    if (s.wall && s.wall.d > 0.2) { const w = s.wall, a = Math.atan2(w.dx, w.dz); box(0.09, 0.09, w.d, G.metal, s.cx + w.dx * w.d / 2, s.top + 0.2, s.cz + w.dz * w.d / 2, a).name = 'rope-bracket'; box(0.5, 0.6, 0.05, G.metal, s.cx + w.dx * (w.d - 0.025), s.top + 0.15, s.cz + w.dz * (w.d - 0.025), a).name = 'rope-plate'; }
  }
  return g;
}
function nmRopes(C, root) {
  const VM_ = xroVF(), R = VM_ && VM_.ROPES && VM_.ROPES[C.key] || null; C.ropes = R; C.ropeLinks = new Map(); C.ropeSpec = null; if (!R || !R.length) return C;
  const nav = C.nav; for (const l of VM_.ropeLinks(R, nav.nodes, (i) => !nav.valid || !!nav.valid[i])) { C.ropeLinks.set(l.a + '>' + l.b, l); if (!nav.adj[l.a].includes(l.b)) nav.adj[l.a].push(l.b); }
  C.ropeSpec = R.map((r) => xroSpec(C, r));
  if (root && typeof THREE !== 'undefined') try { root.add(C.ropeGroup = xroMeshes(C, C.ropeSpec)); } catch (e) { console.warn('rope meshes skipped', e); }
  return C;
}
// A rope link climbs by rope: the instinct climb rule (nmClimbOk) passes it, so the lane-varied routes (BOT VARIETY) keep it.
if (typeof nmClimbOk === 'function') { const c0 = nmClimbOk; nmClimbOk = function (C, a, b) { return !!(C && C.ropeLinks && C.ropeLinks.has(a + '>' + b)) || c0.apply(this, arguments); }; }
// ---- offline bots ----
// The first rope link in the bot's next hops, if the bot is on that link's floor within 6 m of where the climb starts (lower end:
// the climbing axis; upper end: the step-off point on the ledge).
function xroAhead(C, u, path) {
  if (!path || path.length < 2 || !C.ropes) return null; const p = u.g.position;
  for (let j = 0; j < Math.min(5, path.length - 1); j++) { const L = C.ropeLinks.get(path[j] + '>' + path[j + 1]); if (!L) continue; const r = C.ropes[L.k], sx = L.up ? r.x : r.ex, sz = L.up ? r.z : r.ez, sy = L.up ? r.y0 : r.y1;
    if (Math.abs((p.y || 0) - sy) > 0.9) return null; const d = Math.hypot(p.x - sx, p.z - sz); return d > 6 ? null : { L, r, sx, sz, sy, d }; }
  return null;
}
// nmNext's stall breakers must not ban a rope link: the chord to the far floor never validates (it is a climb), so the
// edge-ban counters would drop the rope after three re-plans at its foot.
function xroScrub(C, u) {
  if (u.xb) for (const k of [...u.xb.keys()]) if (C.ropeLinks.has(k)) u.xb.delete(k);
  if (u.xfE && C.ropeLinks.has(u.xfE)) { u.xf = 0; u.xfE = null; } if (u.xfK && C.ropeLinks.has(u.xfK)) { u.xfm = 0; u.xfK = null; }
}
if (typeof nmNext === 'function' && typeof nmPath === 'function') {
  const nn = nmNext, np = nmPath; let cur = null;
  nmPath = function (C, s, e, banned) { const r = np.apply(this, arguments); if (cur && C && C.ropeLinks && C.ropeLinks.size) cur.xroPath = r; return r; };
  nmNext = function (C, u, gx, gz) {
    if (!C || !C.ropeLinks || !C.ropeLinks.size || !u || !u.g || u === (typeof player !== 'undefined' ? player : null)) return nn.apply(this, arguments);
    xroScrub(C, u); const prev = cur; cur = u; u.xroPath = null; let out; try { out = nn.apply(this, arguments); } finally { cur = prev; } xroScrub(C, u);
    const a = xroAhead(C, u, u.xroPath); u.xroPath = null; if (a) { u.xrq = { k: a.L.k, up: a.L.up, b: a.L.b, at: performance.now() }; return [a.sx, a.sz]; }
    u.xrq = null; return out;
  };
}
function xroWorld(C) { return C.xroW || (C.xroW = { ground: (x, z, y) => groundAt(x, z, 0.3, y), blocked: (x, z, r, y, h) => nmBlocked(C, x, z, r, y, h), leash: null, ceiling: null, ropes: C.ropes }); }
function xroRun(u) { return typeof botRun === 'function' ? botRun(u, false) : 5.4; } // = server input.speed 6.75 x runSpeedMultiplier: the rope motor's sf (spread) matches
function xroDone(u, replan) { u.xrm = null; u.rope = 0; u.xroF = false; if (u.xk === -1) u.xk = null; u.xrq = null; if (replan) { u.np = null; u.npT = 0; } }
// One frame of a bot's rope: true while the rope moves the bot (the caller skips its walking for the frame). u.xk = -1 keeps the
// floor snaps (nmGroundUnits, the bot loop's groundAt) off the bot while it hangs; the climb is the shared motor's (a motor state
// u.xrm with the input a server bot gets from ropeBot: Use to grab, climb +1 / -1).
function xrBot(C, u, dt) {
  const VM_ = xroVF(); if (!VM_ || !VM_.step || !C.ropes || !u || !u.g) return false; const p = u.g.position, now = performance.now(); let M = u.xrm;
  if (M && M.rope) {
    if (!u.alive || Math.abs(p.x - M.x) + Math.abs((p.y || 0) - M.y) + Math.abs(p.z - M.z) > 1e-3) { xroDone(u, true); return false; } // moved from outside (a round reset, a knock-up): off the rope
    const r = C.ropes[M.rope - 1]; VM_.step(M, { x: 0, z: 0, jump: false, use: false, climb: M.up ? 1 : -1, f: 0, pitch: 0, speed: xroRun(u) }, dt, xroWorld(C));
    p.x = M.x; p.y = M.y; p.z = M.z; u.rope = M.rope || 0; u.xrmT = now; u.spd = Math.abs(M.vy || 0); u.mv = true; if (!u.xSe) u.g.rotation.y = Math.atan2(r.ex - r.x, r.ez - r.z);
    M.t = (M.t || 0) + dt; if (!M.rope || M.t > 8) xroDone(u, true); return true;
  }
  const q = u.xrq; if (!q || !u.alive || now - q.at > 1500) return false; const r = C.ropes[q.k]; if (!r) return false;
  const sx = q.up ? r.x : r.ex, sz = q.up ? r.z : r.ez, sy = q.up ? r.y0 : r.y1; if (Math.abs((p.y || 0) - sy) > 0.6 || Math.hypot(p.x - sx, p.z - sz) > VM_.ROPE.reach * 0.75) return false;
  M = { x: p.x, y: p.y || 0, z: p.z, vx: 0, vy: 0, vz: 0, air: false, ch: 0, up: q.up, t: 0 };
  VM_.step(M, { x: 0, z: 0, jump: false, use: true, climb: q.up ? 1 : -1, f: 0, pitch: 0, speed: xroRun(u) }, dt, xroWorld(C));
  if (!M.rope || M.rope - 1 !== q.k) { u.xrq = null; return false; }
  u.xrm = M; p.x = M.x; p.y = M.y; p.z = M.z; u.rope = M.rope; u.xk = -1; u.xrq = null; u.xrmT = now; if (!u.xSe) u.g.rotation.y = Math.atan2(r.ex - r.x, r.ez - r.z); return true;
}
// A climbing bot that has an enemy in sight fights from the rope like a server bot (ropeBot keeps the brain's fire; simulation.js
// fires while |horizontal v| <= 1.6, the motor's rope spread): the rope still moves it this frame, but xStep answers false with
// u.xroF set, so the bot loop runs its aim / fire block; xSmV (below) zeroes the walk for the frame (horizontal speed 0, as the
// server's rope: botStopped passes) and bSpread reads the rope motor's climb speed (sf / mv) with u.rope -> the rope spread.
if (typeof xStep === 'function') { const st = xStep; xStep = function (u, dt) { try { const C = typeof nmActive === 'function' && nmActive(); if (u) u.xroF = false; if (C && C.ropes && xrBot(C, u, dt)) { if (u.alive && u.rope > 0 && u.xrm && u.xrm.rope && u.xSe) { u.xroF = true; return false; } return true; } } catch (e) { if (!XRO.err++) console.warn('rope bots disabled for a frame', e); } return st.apply(this, arguments); }; }
if (typeof xSmV === 'function') { const sm0 = xSmV; xSmV = function (u, dt, vx, vz, speed) { if (u && u.xroF && u.rope > 0) { if (u.smMotor) u.smMotor.vx = u.smMotor.vz = 0; u.svx = u.svz = 0; XRO.v0[0] = XRO.v0[1] = 0; return XRO.v0; } return sm0.apply(this, arguments); }; }
if (typeof bSpread === 'function') { const bs0 = bSpread; bSpread = function (b) { const M = b && b.xroF && b.rope > 0 && b.xrm; if (!M) return bs0.apply(this, arguments); const sf = b.sf, mv = b.mv; b.sf = M.sf || 0; b.mv = !!M.mv; try { return bs0.apply(this, arguments); } finally { b.sf = sf; b.mv = mv; } }; }
// A hanging bot whose rope frames stopped (stunned: the bot loop skips xStep; dead; map gone) is let go after 20 frames.
(window.XHK || (window.XHK = [])).push(function xroStale() {
  if (typeof running === 'undefined' || !running || paused) return; const C = typeof nmActive === 'function' && nmActive();
  for (const u of bots.concat(allies)) { if (!u || u.xk !== -1 && !u.xrm) continue; if (u.nt) continue; u.xroS = u.xrmT === u.xroL ? (u.xroS || 0) + 1 : 0; u.xroL = u.xrmT; if (!C || !u.alive || u.xroS > 20) { u.xroS = 0; xroDone(u, true); } }
});
// ---- online / P2P ----
function xroRow(e, k) { while (e.length < 25) { const i = e.length; e.push(i === 21 ? -1 : i >= 22 ? 0 : null); } e[25] = k; return e; } // P2P rows are 15 long: neutral fill for the server-only fields
if (typeof mpCliSnap === 'function') { const s0 = mpCliSnap; mpCliSnap = function (m) { const r = s0.apply(this, arguments); try { if (m && Array.isArray(m.u)) { const by = new Map(); for (const u of bots.concat(allies)) if (u && u.nid != null) by.set(u.nid, u); for (const e of m.u) { if (!Array.isArray(e) || e[0] === MP.me) continue; const u = by.get(e[0]); if (u) u.rope = e[22] === 1 ? 0 : Number.isInteger(e[25]) && e[25] > 0 ? e[25] : 0; } } } catch (e) {} return r; }; }
if (typeof mpEnts === 'function') { const e0 = mpEnts; mpEnts = function () { const E = e0.apply(this, arguments); try { const by = new Map(); for (const u of allies.concat(bots)) if (u) by.set(u.nid, u); E.forEach((e, i) => { const u = i === 0 ? player : by.get(e[0]), k = u && u.alive !== false ? u.rope | 0 : 0; if (k > 0) xroRow(e, k); }); } catch (er) {} return E; }; }
if (typeof mpSend === 'function') { const ms0 = mpSend; mpSend = function (conn, m) { try { if (m && m.t === 'in' && typeof MP !== 'undefined' && MP.role === 'client' && player && player.rope > 0 && Number.isFinite(m.x)) m.rp = player.rope | 0; } catch (e) {} return ms0.apply(this, arguments); }; }
if (typeof mpHostMsg === 'function') { const hm0 = mpHostMsg; mpHostMsg = function (c, m) { try { if (m && m.t === 'in' && c && c.u) { const C = typeof nmActive === 'function' && nmActive(), n = C && C.ropes ? C.ropes.length : 0; c.u.rope = Number.isInteger(m.rp) && m.rp > 0 && m.rp <= n ? m.rp : 0; } } catch (e) {} return hm0.apply(this, arguments); }; }
// a tapped F (shorter than the 50 ms input tick) still rides one input message, so the server sees the Use edge the page predicted
addEventListener('keydown', (e) => { if (e.code === 'KeyF' && !e.repeat) XRO.useP = 1; });
if (typeof netInputMsg === 'function') { const ni0 = netInputMsg; netInputMsg = function () { const m = ni0.apply(this, arguments); if (m && XRO.useP) { m.u = 1; XRO.useP = 0; } return m; }; }
// an eased reconcile residual moves the player from outside the motor, which reads as "moved off the rope": re-anchor it
if (typeof netCorrect === 'function') { const nc0 = netCorrect; netCorrect = function () { const P = typeof player !== 'undefined' && player, on = P && P.rope > 0 && P.ropeAt; const r = nc0.apply(this, arguments); if (on && P.rope > 0 && P.ropeAt) P.ropeAt = [P.x, P.y, P.z]; return r; }; }
// ---- climb pose (third person) ----
// After every other layer (gait clips, aim, grip, feet): the support (left) hand IK'd onto the cable a hand above the shoulder,
// the knees bent with the feet tucked under the hips toward the wall. Restored before the next mixer evaluation (LIFO with the
// other procedural layers). Needs the grip block's two-bone IK (xgIK).
function xroPoseSetup(M) {
  const X = M.sx, b = (n) => X.sc.getObjectByName(n), P = { ok: false }; X.xro = P; if (!X.sc || typeof xgIK !== 'function') return P;
  P.L = { up: b('L_Shoulder'), lo: b('L_Elbow'), hand: b('L_Hand') }; P.legs = ['L', 'R'].map((s) => ({ up: b(s + '_Hip'), lo: b(s + '_Knee'), hand: b(s + '_Foot') }));
  if (!P.L.up || !P.L.lo || !P.L.hand || P.legs.some((L) => !L.up || !L.lo || !L.hand)) return P;
  P.bones = [P.L.up, P.L.lo, P.L.hand]; for (const L of P.legs) P.bones.push(L.up, L.lo, L.hand); P.save = P.bones.map(() => new THREE.Quaternion());
  P.G = { ik: Array.from({ length: 9 }, () => new THREE.Vector3()), q: [new THREE.Quaternion(), new THREE.Quaternion()] }; P.v = Array.from({ length: 4 }, () => new THREE.Vector3()); P.ok = true; return P;
}
function xroPose(M, u) {
  const X = M.sx, C = typeof nmActive === 'function' && nmActive(); if (!C || !C.ropeSpec || !X || !X.sc) return false; const s = C.ropeSpec[u.rope - 1]; if (!s) return false;
  const P = X.xro || xroPoseSetup(M); if (!P.ok) return false;
  for (let i = 0; i < P.bones.length; i++) P.save[i].copy(P.bones[i].quaternion); X.xroRestore = true;
  M.m.updateWorldMatrix(true, true); const V = P.v, ry = M.m.getWorldDirection(V[3]), fx = ry.x, fz = ry.z, fl = Math.hypot(fx, fz) || 1, f = [fx / fl, fz / fl], left = [f[1], -f[0]];
  const sh = P.L.up.getWorldPosition(V[0]), hand = V[1].set(s.cx, sh.y + 0.32, s.cz); xgIK(P.L, hand, V[2].set(left[0] * 0.6, -1, left[1] * 0.6).normalize(), P.G);
  P.legs.forEach((L, i) => { const hip = L.up.getWorldPosition(V[0]), t = V[1].set(hip.x + f[0] * 0.28, hip.y - (i ? 0.52 : 0.68), hip.z + f[1] * 0.28); xgIK(L, t, V[2].set(f[0], 0.35, f[1]).normalize(), P.G); });
  return true;
}
if (typeof xUbPre === 'function') { const pre = xUbPre; xUbPre = function (M) { const X = M && M.sx; if (X && X.xroRestore && X.xro && X.xro.ok) { const P = X.xro; for (let i = 0; i < P.bones.length; i++) P.bones[i].quaternion.copy(P.save[i]); X.xroRestore = false; } return pre.apply(this, arguments); }; }
if (typeof xUbPost === 'function') { const post = xUbPost; xUbPost = function (M) { post.apply(this, arguments); const u = M && M.unit; if (!u || !(u.rope > 0) || !M.valorant || !M.sx || M.dead || M.sx.dd) return; try { xroPose(M, u); } catch (e) { if (!XRO.err++) console.warn('rope climb pose disabled for a frame', e); } }; }
// ---- prompt, inspect, minimap ----
function xroNear() { const C = typeof nmActive === 'function' && nmActive(), VM_ = xroVF(); if (!C || !C.ropes || !VM_ || !player || !(player.hp > 0)) return 0; if (player.rope > 0) return 2; return !(player.ropeCd > 0) && VM_.ropeFind(C.ropes, player) >= 0 ? 1 : 0; }
(window.XHK || (window.XHK = [])).push(function xroPrompt() {
  let el = XRO.el; const st = running && !paused && !(typeof FV !== 'undefined' && FV && FV.menu) ? xroNear() : 0;
  if (!st) { if (el && el.style.display !== 'none') el.style.display = 'none'; return; }
  if (!el) { el = XRO.el = document.createElement('div'); el.id = 'xroPrompt'; el.setAttribute('role', 'status'); el.style.cssText = 'position:fixed;left:50%;top:calc(50% + 78px);transform:translateX(-50%);z-index:60;display:none;align-items:center;gap:8px;padding:6px 12px;background:rgba(15,25,35,.72);color:#ece8e1;font:600 14px/1 Arial,sans-serif;letter-spacing:.04em;pointer-events:none;white-space:nowrap'; el.innerHTML = '<b style="display:inline-grid;place-items:center;min-width:22px;height:22px;border:1px solid #ece8e1;font-size:12px">F</b><span></span>'; document.body.append(el); }
  const text = st === 2 ? 'Let go' : 'Grab rope'; if (el.lastChild.textContent !== text) el.lastChild.textContent = text; if (el.style.display !== 'flex') el.style.display = 'flex';
});
addEventListener('keydown', (e) => { if (e.code !== 'KeyF' || e.repeat) return; try { if (xroNear() && typeof VM !== 'undefined' && VM.ins > 0) VM.ins = 0; } catch (er) {} }); // F at a rope is Use, not the weapon inspect
if (typeof nmMinimap === 'function') { const mm0 = nmMinimap; nmMinimap = function (C) { const t0 = nmMinimap.last; const r = mm0.apply(this, arguments); try { if (C && C.ropes && nmMinimap.last !== t0 && typeof mmx !== 'undefined') { const ctx = mmx, { X, Z } = nmMapProjection(C, MM.width, MM.height), px = Math.max(1, (nmMinimap.cw ? MM.width / nmMinimap.cw : 1)); ctx.save(); ctx.fillStyle = '#e9dcae'; ctx.strokeStyle = '#18242e'; ctx.lineWidth = px; for (const q of C.ropes) { const x = X(q.x), z = Z(q.z); ctx.beginPath(); ctx.arc(x, z, 2.2 * px, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); } ctx.restore(); } } catch (e) {} return r; }; nmMinimap.last = 0; }
window.xRopes = XRO;
// ---- END ROPE ASCENDERS ----
