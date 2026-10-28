// ---- DEATH PARITY ----
// What happens when an agent dies, as VALORANT (user 2026-10-27: "Fix what happens when character dies. It looks really weird right now.
// Just copy Valorant."; spec + sources: work/validation/death-parity-2026-10-27.md).
//  - The corpse falls AWAY FROM THE KILLER: the killing shot's direction (killer -> victim) is handed to the corpse physics (M.ragHit, which
//    repair_runtime's xrRagdoll already honours but the game never set: every body fell backwards from its own facing).
//  - Corpses stay on the floor for the rest of the round in round modes (VALORANT: Cypher's Neural Theft / Sage's Resurrection target any
//    corpse; 5.10 removed the corpse time limit). They were removed 4 s after death in one frame. Respawn modes (Deathmatch, Team
//    Deathmatch, Escalation) and the practice modes keep a body XDP.keep s, then sink it XDP.sinkD m into the floor over XDP.sink s (no pop).
//    A corpse goes when its unit lives again (revive, online respawn / next round), on a new round (fSpawn) and on a mode change.
//  - One gun per death, thrown from the hand: it arcs off along the fall, stops short of walls and lands lying on its side on the floor
//    under its landing spot (was teleported to foot height beside the body - floating / sunk on slopes and stairs - and in 5v5 a second,
//    pickable copy sat at the feet inside the corpse). Offline 5v5 the thrown gun IS the pickup (its xdDrop entry moves to the landing
//    spot); online the server's floor row is authoritative: its mesh is thrown from the hand onto the server spot, the corpse copy hidden.
//  - First-person death camera (VALORANT: the camera pulls out of the body and looks at the killer at head height, never stuck in a wall,
//    always above what it looks at): the player's own corpse is spawned (same rig and corpse physics), the camera eases XDP.T s from the
//    eyes to XDP.back m behind / XDP.up m above the body (away from the killer, clamped XDP.pad m short of geometry) and turns toward the
//    killer's head while keeping the own body in the frame (70 / 30 blend); the viewmodel and crosshair hide. Then the existing teammate spectate takes over (the KILLED BY card's 2 s); with no
//    teammate to follow (Deathmatch, last alive) the death camera holds until the respawn / round end.
//  - Combat report: the KILLED BY card shows the killer's agent portrait; N hides / shows it and the combat report while dead.
const XDP = { keep: 6, sink: 0.8, sinkD: 0.6, T: 0.6, back: 2.4, up: 0.9, pad: 0.3, toss: 0.5, arc: 0.22, drops: [], dc: null, pc: null, crOff: false, mode: null, buy: false, fr: null, v: null };
function xdpRoundMode() {
  try { if (typeof NET !== "undefined" && NET.socket && typeof MP !== "undefined" && MP.st === "game") return !!MP.m5 && !FV.dm && !FV.esc; } catch (e) {}
  try { return mode === "five" && !FV.dm && !FV.esc; } catch (e) { return false; }
}
function xdpHash(s) { s = String(s || ""); let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function xdpUnit(n) { if (!n || typeof n !== "string") return null; try { for (const L of [bots, allies]) for (const u of L || []) if (u && u.name === n && u.g) return u; } catch (e) {} return null; }
function xdpMe(by) { if (by === undefined || by === "You") return true; try { return typeof MP !== "undefined" && MP.name && by === MP.name; } catch (e) { return false; } }
function xdpPos(by) { // where the killer named by stood (undefined / "You" = the player); null for the Spike, a fall, an unknown name
  if (xdpMe(by)) return player ? { x: player.x, y: player.y || 0, z: player.z } : null;
  const u = xdpUnit(by); return u ? { x: u.g.position.x, y: u.g.position.y || 0, z: u.g.position.z } : null;
}
function xdpFoe(v) { // fallback killer (online remote deaths carry no killer here): the nearest living enemy of the victim within 80 m
  const p = v.g ? v.g.position : v; let best = null, bd = 80; const add = (q) => { const d = Math.hypot(q.x - p.x, q.z - p.z); if (d < bd) { bd = d; best = { x: q.x, y: q.y || 0, z: q.z }; } };
  try { const isBot = bots.includes(v); if (isBot) { for (const a of allies) if (a && a.alive && a.g) add(a.g.position); if (player && player.hp > 0) add(player); } else for (const b of bots) if (b && b.alive && b.g) add(b.g.position); } catch (e) {}
  return best;
}
function xdpFloor(x, z, y) { // floor under (x, z) near height y: native nav floor, else the map's groundAt, else y
  try { const C = typeof nmActive === "function" ? nmActive() : null; if (C && typeof nmHeight === "function") { const f = nmHeight(C, x, z, y + 0.6); if (Number.isFinite(f) && Math.abs(f - y) < 1.6) return f; } } catch (e) {}
  try { if (typeof groundAt === "function") { const f = groundAt(x, z, 0.1, y + 0.6); if (Number.isFinite(f) && Math.abs(f - y) < 1.6) return f; } } catch (e) {}
  return y;
}
function xdpBlocked(x, z, y) { try { return typeof blocked === "function" && !!blocked(x, z, 0.12, y); } catch (e) { return false; } }
function xdpLand(p, dx, dz, nm) { // where a dropped gun comes to rest: 0.55-0.85 m along the fall (+-34 deg, seeded by name), short of walls, on the floor
  const h = xdpHash(nm), a = ((h % 100) / 100 - 0.5) * 1.2, cs = Math.cos(a), sn = Math.sin(a), ux = dx * cs - dz * sn, uz = dx * sn + dz * cs, y0 = Number.isFinite(p.y) ? p.y : 0;
  for (let d = 0.55 + ((h >>> 8) % 31) / 100; d > 0.05; d -= 0.15) { const x = p.x + ux * d, z = p.z + uz * d; if (!xdpBlocked(x, z, y0) && !xdpBlocked(p.x + ux * d * 0.5, p.z + uz * d * 0.5, y0)) return { x, y: xdpFloor(x, z, y0), z }; }
  return { x: p.x, y: xdpFloor(p.x, p.z, y0), z: p.z };
}
function xdpToss(m, from, q0, to, q1, dur) { // arc a mesh from the hand to its resting transform (positions world = scene)
  if (!m || !from || !to) return null; for (let i = XDP.drops.length - 1; i >= 0; i--) if (XDP.drops[i].m === m) XDP.drops.splice(i, 1);
  const T = { m, f: new THREE.Vector3(from.x, from.y, from.z), to: new THREE.Vector3(to.x, to.y, to.z), q0: (q0 || m.quaternion).clone(), q1: (q1 || m.quaternion).clone(), t: 0, d: dur || XDP.toss };
  m.position.copy(T.f); m.quaternion.copy(T.q0); XDP.drops.push(T); return T;
}
function xdpTossTick(dt) {
  for (let i = XDP.drops.length - 1; i >= 0; i--) { const T = XDP.drops[i]; if (!T.m.parent) { XDP.drops.splice(i, 1); continue; }
    T.t += dt; const k = Math.min(1, T.t / T.d), e = 1 - (1 - k) * (1 - k); // x/z ease out, y: straight line + a gravity arc
    T.m.position.set(T.f.x + (T.to.x - T.f.x) * e, T.f.y + (T.to.y - T.f.y) * k * k + 4 * XDP.arc * k * (1 - k), T.f.z + (T.to.z - T.f.z) * e);
    T.m.quaternion.slerpQuaternions(T.q0, T.q1, Math.min(1, k * 1.15)); if (k >= 1) { T.m.position.copy(T.to); T.m.quaternion.copy(T.q1); XDP.drops.splice(i, 1); } }
}
function xdpOnline() { try { return typeof NET !== "undefined" && !!NET.socket && typeof MP !== "undefined" && MP.st === "game" && !!MP.m5 && typeof netFloor !== "undefined"; } catch (e) { return false; } }
function xdpFloorGun(p, used) { // the pickup gun this death made: offline the xdDrop entry at the body, online the server row nearest the body
  try {
    if (xdpOnline()) { let best = null, bd = 2.5; for (const d of netFloor.values()) { if (d.xdpC || !d.m) continue; const h = Math.hypot(d.x - p.x, d.z - p.z); if (h < bd && Math.abs((d.y || 0) - (p.y || 0)) < 1.6) { bd = h; best = d; } } return best; }
    if (typeof XD !== "undefined" && XD.L) for (let i = XD.L.length - 1; i >= 0; i--) { const d = XD.L[i]; if (!d.xdpC && Math.abs(d.x - p.x) < 0.05 && Math.abs(d.z - p.z) < 0.05) return d; }
  } catch (e) {} return null;
}
function xdpThrowPickup(d, from, hq, land, online) { // a floor (pickup) gun leaves the hand: offline it moves to the landing spot, online it lands on the server's spot
  d.xdpC = 1; if (!online) { d.x = land.x; d.z = land.z; d.y = land.y; }
  const g = d.m.userData && d.m.userData.xdg, q1 = d.m.quaternion.clone(); let q0 = null;
  if (hq && g) q0 = hq.clone().multiply(g.quaternion.clone().invert()); // the gun model starts as it was held
  return xdpToss(d.m, from, q0, { x: online ? d.x : land.x, y: (online ? d.y || 0 : land.y) + 0.08, z: online ? d.z : land.z }, q1);
}
function xdpDied(b, c, hand, hq) {
  const p = b.g.position, e = XDEAD.find((x) => x.c === c); if (e) { e.u = b; e.pl = b.xdpPl || null; }
  let K = b.xdpK || (b.xdpPl ? null : xdpFoe(b)); b.xdpK = null; let dx = 0, dz = 0, have = false;
  if (K) { dx = p.x - K.x; dz = p.z - K.z; const l = Math.hypot(dx, dz); if (l > 1e-3) { dx /= l; dz /= l; have = true; } }
  if (have) c.ragHit = { x: dx, z: dz }; else { const ry = b.g.rotation.y || 0; dx = -Math.sin(ry); dz = -Math.cos(ry); } // no killer: the corpse physics' own default (falls back from its facing)
  const gn = c.gun; if (!gn) return;
  const from = hand && Number.isFinite(hand.x + hand.y + hand.z) && Math.hypot(hand.x - p.x, hand.z - p.z) < 2 ? hand : new THREE.Vector3(p.x, (p.y || 0) + 1.1, p.z);
  const land = xdpLand(p, dx, dz, b.name), online = xdpOnline(), d = xdpFloorGun(p);
  if (d) { gn.visible = false; xdpThrowPickup(d, from, hq, land, online); return; }
  const ry = b.g.rotation.y || 0, q1 = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ry + 2, Math.PI / 2));
  xdpToss(gn, from, hq, { x: land.x, y: land.y + 0.05, z: land.z }, q1);
  let pick = online; try { pick = pick || (typeof xdOn === "function" && xdOn()); } catch (er) {}
  if (pick && e) { e.xdpW = performance.now(); e.xdpP = { x: p.x, y: p.y || 0, z: p.z }; e.xdpL = land; e.xdpHq = hq ? hq.clone() : null; } // its floor (pickup) gun may be made after the death: online the server row, offline the player's own drop (pDie's xdDrop runs after the card)
}
function xdpRemove(i) { const e = XDEAD[i]; if (!e) return; try { scene.remove(e.c.m); if (e.gn) { scene.remove(e.gn); xDisp(e.gn); } const j = XSOL.mx.indexOf(e.c); if (j >= 0) XSOL.mx.splice(j, 1); } catch (er) {} if (e.c === (XDP.pc && XDP.pc.xm)) XDP.pc = null; XDEAD.splice(i, 1); }
function xdpClear() { for (let i = XDEAD.length - 1; i >= 0; i--) xdpRemove(i); XDP.drops.length = 0; }
// repair_runtime's corpse lifetime asks this each frame: true = remove the corpse now
function xdpGone(e, age) {
  if (e.pl) return !player || player !== e.pl || player.hp > 0; // the player's own corpse: gone once alive again (revive / next round)
  const u = e.u; if (u && u.alive !== false && u.hp > 0) return true; // its unit lives again (Sage / Phoenix / online respawn, next round)
  if (u && u.xm && u.xm !== e.c) return true; // the unit already has a fresh model
  if (xdpRoundMode()) return false; // round modes: the body stays until the round resets
  return age > XDP.keep + XDP.sink;
}
function xdpKept(e) { return !!e && !xdpGone(e, 0); }
function xdpCorpseTick(dt) {
  const now = performance.now(), rm = xdpRoundMode();
  if (XDP.mode !== mode) { if (XDP.mode != null) xdpClear(); XDP.mode = mode; } // a mode change: the old mode's bodies go
  let buy = false; try { buy = rm && FV.buy > 0; } catch (e) {} if (buy && !XDP.buy) for (let i = XDEAD.length - 1; i >= 0; i--) if (now - (XDEAD[i].c.diedAt || now) > 500) xdpRemove(i); XDP.buy = buy; // a new buy phase: last round's bodies go
  let F = null; try { if (camera) { const X = XDP.fr || (XDP.fr = { f: new THREE.Frustum(), m: new THREE.Matrix4(), s: new THREE.Sphere(new THREE.Vector3(), 1.4) }); X.m.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse); X.f.setFromProjectionMatrix(X.m); F = X; } } catch (e) {}
  for (const e of XDEAD) { const c = e.c, age = (now - (c.diedAt || now)) / 1000;
    if (!rm && age > XDP.keep && !e.pl) { const k = Math.min(1, (age - XDP.keep) / XDP.sink); if (e.y0 == null) e.y0 = c.m.position.y; c.m.position.y = e.y0 - XDP.sinkD * k * k; if (e.gn) e.gn.visible = e.gn.visible && k < 0.7; }
    if (e.xdpW && now - e.xdpW < 1500) { const d = xdpFloorGun(e.xdpP); if (d) { e.xdpW = 0; const from = e.gn ? e.gn.position.clone() : null; if (e.gn) { e.gn.visible = false; for (let j = XDP.drops.length - 1; j >= 0; j--) if (XDP.drops[j].m === e.gn) XDP.drops.splice(j, 1); } xdpThrowPickup(d, from, e.gn ? e.gn.quaternion : e.xdpHq, e.xdpL, xdpOnline()); } }
    // a settled body left the corpse physics: frustum-cull it ourselves (the skinned meshes stay frustumCulled=false: their bind-pose sphere is not where a lying body is)
    if (F && age > 4 && c.m) { if (!e.cs) { const s = new THREE.Vector3(); try { const pel = c.sx && c.sx.sc && (c.sx.sc.getObjectByName("Pelvis") || c.sx.sc.getObjectByName("Splitter")); if (pel) pel.getWorldPosition(s); else c.m.getWorldPosition(s); } catch (er) { c.m.getWorldPosition(s); } e.cs = s; }
      F.s.center.copy(e.cs); F.s.center.y += (c.m.position.y - (e.y0 == null ? c.m.position.y : e.y0)); c.m.visible = F.f.intersectsSphere(F.s); }
  }
}
// ---- the player's own corpse + first-person death camera ----
function xdpPlayerCorpse(K) {
  if (XDP.pc && XDEAD.some((e) => e.c === XDP.pc.xm)) return; XDP.pc = null; if (!player || typeof xAgent !== "function") return;
  try { let ag = "Jett"; try { ag = (J && J.pick) || ag; } catch (e) {} let w = "Vandal"; try { w = typeof wName === "function" ? wName() : w; if (w === "Knife" || w === "knife") w = (FV && (FV.pri || FV.sec)) || "Classic"; } catch (e) {}
    const u = { name: ag, agent: ag, alive: false, hp: 0, g: new THREE.Group(), xdpPl: player, xdpK: K || null };
    u.g.position.set(player.x, player.y || 0, player.z); u.g.rotation.y = (typeof yaw === "number" ? yaw : 0) + Math.PI;
    u.xm = xAgent(ag, 0x4fd1c5, w); u.g.add(u.xm.m); XDP.pc = u; xDie(u);
  } catch (e) { XDP.pc = null; try { xE(e); } catch (er) {} }
}
function xdpKiller(by) { // the killer unit for the death camera: the card's bot, the named unit, else the nearest living enemy
  try { if (typeof xKL !== "undefined" && xKL.kb && xKL.kb.g) return xKL.kb; } catch (e) {}
  const u = xdpUnit(by); if (u) return u; if (by === "Spike" || by === "Fall" || by === "Out of bounds") return null;
  let best = null, bd = 80; try { for (const b of bots) if (b && b.alive && b.g) { const d = Math.hypot(b.g.position.x - player.x, b.g.position.z - player.z); if (d < bd) { bd = d; best = b; } } } catch (e) {} return best;
}
function xdpRayFree(E, dir, max) { // free distance from E along unit dir (native collision BVH, else the box map's blocked() sampled every 0.2 m)
  try { const C = typeof nmActive === "function" ? nmActive() : null; if (C && C.bvh) { const r = XDP.ray || (XDP.ray = new THREE.Ray(new THREE.Vector3(), new THREE.Vector3())); r.origin.copy(E); r.direction.copy(dir); const h = nmRayFirst(C.bvh, r, THREE.DoubleSide); /* perf2 allocation-free port of MeshBVH.raycastFirst (shared hit: read at once) */ return h && Number.isFinite(h.distance) ? Math.min(max, h.distance) : max; } } catch (e) {}
  for (let s = 0.2; s <= max; s += 0.2) if (xdpBlocked(E.x + dir.x * s, E.z + dir.z * s, E.y - 1.4)) return Math.max(0, s - 0.2); return max;
}
function xdpCamStart(by) {
  if (!player || XDP.dc) return; let dm = false; try { dm = mode === "duel"; } catch (e) {} if (dm) return;
  const E = new THREE.Vector3(player.x, 1.6 - (player.ch || 0) + (player.y || 0), player.z), k = xdpKiller(by);
  const K = k && k.g ? { x: k.g.position.x, y: k.g.position.y || 0, z: k.g.position.z } : null;
  let ax, az; if (K) { ax = E.x - K.x; az = E.z - K.z; const l = Math.hypot(ax, az); if (l > 1e-3) { ax /= l; az /= l; } else { ax = Math.sin(yaw); az = Math.cos(yaw); } } else { ax = Math.sin(yaw); az = Math.cos(yaw); }
  const dir = new THREE.Vector3(ax * XDP.back, XDP.up, az * XDP.back), len = dir.length(); dir.multiplyScalar(1 / len);
  const free = xdpRayFree(E, dir, len), d = Math.max(0, Math.min(len, free - XDP.pad)), C = E.clone().addScaledVector(dir, d);
  XDP.dc = { t: 0, by, k, E, C, q0: camera.quaternion.clone(), q: new THREE.Quaternion(), m: new THREE.Matrix4(), L: new THREE.Vector3(), P: new THREE.Vector3(), K };
  xdpPlayerCorpse(K); try { document.body.classList.add("x-dcam"); } catch (e) {}
}
function xdpCamEnd() { XDP.dc = null; try { document.body.classList.remove("x-dcam"); } catch (e) {} }
// called by the frame (index.html, after the normal camera transform): true = the death camera set the camera this frame
function xDcCam(dt) {
  const D = XDP.dc; if (!D) return false; if (!player || player.hp > 0) { xdpCamEnd(); return false; }
  if (XOB.fp || XOB.orb) { xdpCamEnd(); return false; } // the teammate spectate took over
  D.t += Math.max(0, Math.min(0.1, Number.isFinite(dt) ? dt : 0)); const k0 = Math.min(1, D.t / XDP.T), k = k0 * k0 * (3 - 2 * k0);
  const L = D.L; if (D.k && D.k.g && D.k.alive !== false) L.set(D.k.g.position.x, (D.k.g.position.y || 0) + 1.5, D.k.g.position.z); else if (D.K) L.set(D.K.x, D.K.y + 1.5, D.K.z); else L.set(D.E.x, D.E.y - 1.3, D.E.z); // the killer's head, else the own body
  const P = D.P.copy(D.E).lerp(D.C, k); if (P.y < L.y + 0.1 && D.K) P.y = Math.min(L.y + 0.1, P.y + 1.2 * k); // above what it looks at (VALORANT dev note)
  if (D.K) { // frame the killer AND the own body: look 70 % at the killer's head, 30 % at the corpse (looking straight at the killer left the body under the frame)
    const B = D.B || (D.B = new THREE.Vector3()), a = (D.A || (D.A = new THREE.Vector3())).subVectors(L, P).normalize(); B.set(D.E.x, D.E.y - 1.35, D.E.z).sub(P).normalize(); L.copy(P).addScaledVector(a.multiplyScalar(0.7).addScaledVector(B, 0.3).normalize(), 5); }
  camera.position.copy(P); D.m.lookAt(P, L, camera.up); D.q.setFromRotationMatrix(D.m); camera.quaternion.slerpQuaternions(D.q0, D.q, k);
  try { gun.visible = false; knife.visible = false; if (typeof XV !== "undefined" && XV.fp && XV.fp.root) XV.fp.root.visible = false; } catch (e) {}
  return true;
}
{ const k0 = kill; kill = function (b, hs, by, w) { try { if (b && b.alive && b.g) { b.xdpK = xdpPos(by); b.xdpHs = !!hs; } } catch (e) {} return k0.apply(this, arguments); }; }
{ const a0 = allyDie; allyDie = function (a, by, w) { try { if (a && a.alive && a.g) a.xdpK = xdpPos(by); } catch (e) {} return a0.apply(this, arguments); }; }
{ const d0 = xDie; xDie = function (b) {
  if (!b || !b.xm || b.xd) return d0.apply(this, arguments);
  const gn = b.xm.gun; let hand = null, hq = null;
  try { if (gn && gn.parent && gn.visible !== false) { gn.updateWorldMatrix(true, false); hand = new THREE.Vector3(); hq = new THREE.Quaternion(); gn.matrixWorld.decompose(hand, hq, new THREE.Vector3()); } } catch (e) { hand = hq = null; }
  const r = d0.apply(this, arguments); try { xdpDied(b, b.xm, hand, hq); } catch (e) { try { xE(e); } catch (er) {} } return r; }; }
{ const s0 = fSpawn; fSpawn = function () { xdpClear(); return s0.apply(this, arguments); }; }
{ const v0 = xVis; xVis = function (dt) { const r = v0.apply(this, arguments); try { const d = Math.max(0, Math.min(0.1, Number.isFinite(dt) ? dt : 0)); xdpTossTick(d); xdpCorpseTick(d); } catch (e) { try { xE(e); } catch (er) {} } return r; }; }
{ const k0 = xKLDie; xKLDie = function (by, w) { const r = k0.apply(this, arguments);
  try { const k = xKL.kb || xdpUnit(by), ag = String((k && ((typeof xAg === "function" && xAg(k)) || k.agent)) || ""), src = typeof hudPortrait === "function" ? hudPortrait(ag) : "";
    if (xKL.t) { if (src) { xKL.t.textContent = ""; xKL.t.style.backgroundImage = "url(" + src + ")"; xKL.t.classList.add("x-kb__pt"); } else { xKL.t.style.backgroundImage = ""; xKL.t.classList.remove("x-kb__pt"); } } } catch (e) {}
  try { xdpCamStart(by); } catch (e) { try { xE(e); } catch (er) {} } return r; }; }
{ const r0 = xKLReset; xKLReset = function () { xdpCamEnd(); return r0.apply(this, arguments); }; }
addEventListener("keydown", (e) => { if (e.code !== "KeyN" || e.repeat) return; try { if (!(player && player.hp <= 0 && xKL.on)) return; } catch (er) { return; } XDP.crOff = !XDP.crOff; try { document.body.classList.toggle("x-cr-off", XDP.crOff); } catch (er) {} });
try { const st = document.createElement("style"); st.id = "xDpCss"; st.textContent = "body.x-dcam #cross{visibility:hidden}body.x-cr-off .x-kbc,body.x-cr-off .x-cbt{display:none!important}.x-kbc i.x-kb__pt{background-size:cover!important;background-position:center!important}"; document.head.appendChild(st); } catch (e) {}
// ---- END DEATH PARITY ----
