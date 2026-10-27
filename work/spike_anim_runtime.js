// ---- SPIKE PLANT DEFUSE ANIM ----
// Spike plant / defuse poses (work/spike_anim_runtime.js, installed last by work/install_valorant.py).
// User: "The bomb animations are really bad" (planting and defusing, first person and third person). Before this block:
//  - first person: nothing happened at all - the gun stayed up and idled the whole 4 s plant / 7 s defuse, the camera stayed
//    at standing eye height, no hands, no Spike until it popped onto the floor at the end;
//  - third person: the kneel clip played, but with the gun still in the right hand, no Spike in the hands, and only for
//    offline units: online, an enemy planting (the spike row hides pt from the defenders) and anybody defusing (the spike row
//    has no defuser) stood upright; Retake allies defused standing; spectating a teammate showed their gun idling.
// Now (procedural, on the existing rigs: no new animation assets):
//  FIRST PERSON (own view, and the first-person spectate of a teammate): the gun is holstered and the agent's own native FP
//    arms (models/valorant/<agent>-fp.glb) are posed by two-bone IK: PLANT - both hands bring the Spike up, set it down low
//    in front and hold it pressed while the right hand types on its keypad; DEFUSE - both hands reach down to the Spike
//    (toward where it is on screen) and work on it (right hand twisting, left hand tapping) with a subtle bob. The view drops
//    to kneeling height (own view: vfCamDip; spectate: xObsEye). Letting go / finishing lowers the hands out of view and the
//    gun comes back with its native equip. A finished plant leaves the world Spike where the hands put it (in front).
//  THIRD PERSON (bots, allies, online remote players of either team, P2P): the unit kneels (Fixing_Kneeling full-body
//    layer, the existing plant layer) facing the Spike, the held gun is hidden, a planter has the Spike in its hands, set down
//    in front of it; online the server's snapshot row [26] (spike.js spikeAct: 1 planting, 2 defusing) drives it.
//  Locomotion is untouched: these layers only act while a unit / the player is planting or defusing and hand everything
//    back (gun visibility, rig yaw, camera) exactly when the action's blend reaches 0.
var XSPK = { rig: {}, fp: { w: 0, k: '', t: 0, kind: '', u: null, held: 0 }, off: null, prevSt: '', lastPl: null, err: null,
  PLANT: 4, DEFUSE: 7, IN: 0.22, OUT: 0.3, DROP: 0.55, SPEC_DROP: 0.5, FP_H: 0.26, TP_FWD: 0.17, last: null };
// ---- who is doing what -------------------------------------------------------------------------------------------------
function xsaClient() { try { return !!(MP.cl && MP.st === 'game' && mode === 'five' && MP.m5); } catch (e) { return false; } }
function xsaFvKind(u) { // offline / host Spike state: 'plant' while u holds the plant, 'defuse' while u is the defuser
  try { if (mode !== 'five' || !xFvOK || !FV.sp) return ''; const s = FV.sp; if (s.st === 'carry' && s.c === u && s.pt > 0) return 'plant'; if (s.st === 'plant' && s.du && s.du === u) return 'defuse'; } catch (e) {} return '';
}
function xsaPlayerKind() { // the local player
  try {
    if (!running || !player || !(player.hp > 0)) return '';
    if (mode === 'retake') { const near = Math.hypot(player.x - spike.position.x, player.z - spike.position.z) < 2.5; return near && alive4() ? 'defuse' : ''; }
    if (mode !== 'five' || !xFvOK || !FV.sp) return ''; const k = xsaFvKind(player); if (k) return k;
    if (xsaClient()) { const s = FV.sp; // online: the HUD's own rule (mpCliTick5), so the hands move on the key press, not a round trip later
      if (s.st === 'carry' && s.c === player && alive4() && inSite(player)) return 'plant';
      if (s.st === 'plant' && !FV.atk && alive4() && Math.hypot(player.x - s.x, player.z - s.z) < 2.5) return 'defuse'; }
  } catch (e) {} return '';
}
function xsaTpKind(b) { // any third-person unit: server row [26] online, the Spike state offline / on the host, Retake allies by their defuse clock
  if (!b) return ''; if (b.alive === false || b.hp <= 0) return '';
  if (b.xsa === 1) return 'plant'; if (b.xsa === 2) return 'defuse';
  const k = xsaFvKind(b); if (k) return k;
  try { if (mode === 'retake' && b.def > 0) { if (b.def !== b.xsaDef) { b.xsaDef = b.def; b.xsaDefAt = performance.now(); } return performance.now() - (b.xsaDefAt || 0) < 150 ? 'defuse' : ''; } } catch (e) {}
  return '';
}
function xsaTpAct(b) { return !!xsaTpKind(b); } // index.html xUbAnim: the kneel (plant) layer for these units too
function xsaEase(x) { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); }
// where the world Spike is drawn (fsM + the visual offset of a finished plant), or null
function xsaSpikeAt(out) {
  try { if (mode === 'retake') return out.set(spike.position.x, 0, spike.position.z);
    if (mode === 'five' && FV.sp && FV.sp.st === 'plant') { out.set(FV.sp.x, FV.sp.y || 0, FV.sp.z); if (XSPK.off) { out.x = XSPK.off.x; out.z = XSPK.off.z; } return out; } } catch (e) {}
  return null;
}
// ---- first-person rig (the agent's own native FP arms, posed by IK) -----------------------------------------------------
function xsaRig(ag) {
  const R = XSPK.rig[ag]; if (R) return R.sc ? R : null;
  XSPK.rig[ag] = { loading: 1 };
  xvLoad(ag.toLowerCase() + '-fp').then((arms) => {
    const sc = THREE.SkeletonUtils.clone(arms.scene), root = new THREE.Group(); root.name = 'valorant-spike-viewmodel'; root.add(sc); root.rotation.y = Math.PI / 2;
    sc.traverse((o) => { if (o.isMesh) { o.frustumCulled = false; o.castShadow = o.receiveShadow = false; if (typeof XNR !== 'undefined') o.raycast = XNR; o.renderOrder = 10;
      const conv = (m) => new THREE.MeshLambertMaterial({ name: m.name, color: m.color, map: m.map, side: THREE.DoubleSide }); o.material = Array.isArray(o.material) ? o.material.map(conv) : conv(o.material); } });
    sc.updateMatrixWorld(true); const cam = sc.getObjectByName('Camera'), pos = cam ? cam.getWorldPosition(new THREE.Vector3()) : new THREE.Vector3(0, 1.67, 0); root.position.copy(pos).negate();
    const bind = []; sc.traverse((o) => { if (o.isBone) bind.push([o, o.quaternion.clone(), o.position.clone()]); });
    const b = (n) => sc.getObjectByName(n), arm = (s) => ({ up: b(s + '_Shoulder'), lo: b(s + '_Elbow'), hand: b(s + '_Hand'), mid: b(s + '_Middle1') });
    const P = new THREE.Mesh(spike.geometry, spike.material.clone()); P.name = 'xsa-fp-spike'; P.scale.setScalar(XSPK.FP_H / 0.8); P.frustumCulled = false; P.renderOrder = 11; P.visible = false;
    root.visible = false; XSPK.rig[ag] = { ag, root, sc, bind, L: arm('L'), R: arm('R'), prop: P, v: [0, 1, 2, 3, 4, 5, 6, 7, 8].map(() => new THREE.Vector3()), q: new THREE.Quaternion() };
  }).catch((e) => { XSPK.err = String(e); XSPK.rig[ag] = { failed: String(e) }; });
  return null;
}
function xsaWorldQ(o, q) { o.updateWorldMatrix(true, false); const p = XSPK.wp || (XSPK.wp = new THREE.Vector3()), s = XSPK.ws || (XSPK.ws = new THREE.Vector3()); o.matrixWorld.decompose(p, q, s); return q; }
function xsaRotW(bone, q) { // premultiply a world-space rotation onto a bone
  const R = XSPK.tq || (XSPK.tq = [new THREE.Quaternion(), new THREE.Quaternion()]); xsaWorldQ(bone, R[0]).premultiply(q); xsaWorldQ(bone.parent, R[1]);
  bone.quaternion.copy(R[1].invert().multiply(R[0])); bone.updateMatrixWorld(true);
}
// two-bone IK (minimal swing), world-space target and pole
function xsaIK(R, A, target, pole) {
  const [a, b, c, d, e, el, u1, u2] = R.v, q = R.q; if (!A.up || !A.lo || !A.hand) return;
  A.up.getWorldPosition(a); A.lo.getWorldPosition(b); A.hand.getWorldPosition(c);
  const L1 = a.distanceTo(b), L2 = b.distanceTo(c); d.subVectors(target, a); let dist = d.length(); if (dist < 1e-5) return; d.divideScalar(dist);
  dist = Math.max(Math.abs(L1 - L2) + 1e-3, Math.min((L1 + L2) * 0.999, dist));
  e.copy(pole).addScaledVector(d, -pole.dot(d)); if (e.lengthSq() < 1e-8) e.set(0, -1, 0); e.normalize();
  const cosA = Math.max(-1, Math.min(1, (L1 * L1 + dist * dist - L2 * L2) / (2 * L1 * dist))), sinA = Math.sqrt(1 - cosA * cosA);
  el.copy(a).addScaledVector(d, L1 * cosA).addScaledVector(e, L1 * sinA);
  q.setFromUnitVectors(u1.subVectors(b, a).normalize(), u2.subVectors(el, a).normalize()); xsaRotW(A.up, q);
  A.lo.getWorldPosition(b); A.hand.getWorldPosition(c); const t = u1.copy(a).addScaledVector(d, dist);
  q.setFromUnitVectors(u2.subVectors(c, b).normalize(), t.sub(b).normalize()); xsaRotW(A.lo, q);
}
function xsaAim(R, A, k, roll) { // knuckles of the hand toward world direction k, then roll about it
  if (!A.hand || !A.mid) return; const u1 = R.v[6], a = R.v[8]; A.hand.getWorldPosition(a); A.mid.getWorldPosition(u1); u1.sub(a).normalize();
  R.q.setFromUnitVectors(u1, k); xsaRotW(A.hand, R.q); if (roll) { R.q.setFromAxisAngle(k, roll); xsaRotW(A.hand, R.q); }
}
// Pure pose plan (camera space, metres; -z forward, +y up): hand targets, knuckle directions, rolls and the Spike centre for
// action k at t seconds into it, w the in / out blend, bx the defuse bias toward the Spike on screen (camera-space x).
function xsaPlan(k, t, w, bx) {
  const e = xsaEase(w), down = (1 - e) * 0.38, back = (1 - e) * 0.1, P = { k, L: [0, 0, 0], R: [0, 0, 0], kL: [0, -0.55, -1], kR: [0, -0.55, -1], rL: 0, rR: 0, spike: null };
  if (k === 'plant') {
    const p = t / XSPK.PLANT, s = xsaEase((p - 0.06) / 0.2), bob = 0.004 * Math.sin(t * 6.8);
    const C = [0, -0.22 + (-0.3 + 0.22) * s + bob * s - down, -0.4 + (-0.5 + 0.4) * s + back], top = C[1] + XSPK.FP_H / 2;
    const g = xsaEase((p - 0.18) / 0.12); // hands move from gripping the sides to pressing on top
    const tap = Math.max(0, Math.sin(t * 2 * Math.PI * 4.5)), key = Math.sin(t * 2 * Math.PI * 1.1) > 0 ? 0.018 : -0.012;
    P.L = [C[0] - 0.085 + 0.015 * g, C[1] + 0.03 + (top - C[1] + 0.005 - 0.03) * g - 0.003 * Math.max(0, Math.sin(t * 8.2)) * g, C[2] + 0.005 + 0.045 * g];
    P.R = [C[0] + 0.085 + (0.04 + key - 0.085) * g, C[1] + 0.03 + (top - C[1]) * g - 0.022 * tap * g, C[2] + 0.03 * g];
    P.kL = [0.55 * (1 - g) + 0.2 * g, -0.4 - 0.5 * g, -1]; P.kR = [-0.55 * (1 - g) - 0.15 * g, -0.4 - 0.5 * g, -1];
    P.rL = 1.1 * (1 - g); P.rR = -1.1 * (1 - g); P.spike = C;
  } else if (k === 'defuse') {
    const bob = 0.006 * Math.sin(t * 2 * Math.PI * 1.1), x = Math.max(-0.12, Math.min(0.12, bx || 0));
    const B = [x, -0.25 + bob - down, -0.47 + back], tap = Math.max(0, Math.sin(t * 2 * Math.PI * 3.1 + 1));
    P.L = [B[0] - 0.095, B[1] - 0.012 * tap, B[2] + 0.01]; P.R = [B[0] + 0.085, B[1] + 0.004 * Math.sin(t * 9), B[2] - 0.015];
    P.kL = [0.25, -0.8, -1]; P.kR = [-0.2, -0.8, -1]; P.rL = 0.1 * Math.sin(t * 3.1); P.rR = 0.5 * Math.sin(t * 2 * Math.PI * 1.6);
  }
  return P;
}
function xsaPose(R, P) { // apply a plan to the rig (rig root under the camera; camera space = root.parent space)
  for (const [o, q, p] of R.bind) { o.quaternion.copy(q); o.position.copy(p); }
  R.root.updateMatrixWorld(true); const par = R.root.parent, K = R.v[4], pole = R.v[5], T = R.v[7];
  const W = (a, out) => { out.set(a[0], a[1], a[2]); return par ? par.localToWorld(out) : out; };
  const Dir = (a, out) => { out.set(a[0], a[1], a[2]).normalize(); if (par) { par.updateWorldMatrix(true, false); out.transformDirection(par.matrixWorld); } return out; };
  for (const s of ['L', 'R']) { const A = R[s], tg = W(P[s], new THREE.Vector3()); Dir([s === 'L' ? -0.6 : 0.6, -1, 0.2], pole); xsaIK(R, A, tg, pole); xsaAim(R, A, Dir(P['k' + s], K), P['r' + s]); void T; }
  if (P.spike) { if (par && R.prop.parent !== par) par.add(R.prop); R.prop.position.set(P.spike[0], P.spike[1], P.spike[2]); R.prop.visible = true;
    if (typeof xvDevice === 'function' && !R.prop.userData.xvDevice) { try { xvDevice(R.prop, 'spike', 0.8); } catch (e) {} } R.prop.traverse((o) => { o.frustumCulled = false; o.renderOrder = 11; o.castShadow = false; }); }
  else R.prop.visible = false;
}
// ---- first-person tick: own view, or the spectated teammate -------------------------------------------------------------
function xsaGunBack() { // the held weapon as the weapon-switch / ADS paths set it, then its native equip
  try { if (typeof xAfShowGun === 'function') xAfShowGun(); else { knife.visible = rw === 'knife'; gun.visible = rw !== 'knife' && !(typeof ads !== 'undefined' && ads === 2); } } catch (e) {}
  try { if (XV.fp) { XV.fp.kind = null; xvFPPlay(XV.fp, 'equip'); } } catch (e) {}
}
function xsaFpTick(dt) {
  const F = XSPK.fp; dt = Math.max(0, Math.min(0.1, dt || 0));
  let u = null, kind = '', spec = false;
  if (running && player && player.hp > 0) { u = player; kind = xsaPlayerKind(); }
  else { let a = null; try { a = typeof xspvTarget === 'function' ? xspvTarget() : null; } catch (e) {} if (a) { u = a; spec = true; kind = xsaTpKind(a); } }
  if (u !== F.u) { if (F.rig) { F.rig.root.visible = false; F.rig.prop.visible = false; } F.w = 0; F.t = 0; F.kind = ''; F.u = u; }
  if (kind) { if (F.kind !== kind) { F.t = 0; F.kind = kind; } F.t += dt; F.w = Math.min(1, F.w + dt / XSPK.IN); }
  else if (F.w > 0) { F.t += dt; F.w = Math.max(0, F.w - dt / XSPK.OUT); }
  F.spec = spec; F.on = F.w > 0;
  if (!F.on) { if (F.rig) { F.rig.root.visible = false; F.rig.prop.visible = false; } F.kind = '';
    if (F.held) { F.held = 0; if (u === player && player && player.hp > 0) xsaGunBack(); } XSPK.last = { on: false, kind: '', spec }; return; }
  // holster: own gun / knife / native weapon rig / ability rig; spectate: the teammate's weapon rig
  if (spec) { try { if (XSPV.F) XSPV.F.root.visible = false; } catch (e) {} }
  else { F.held = 1; gun.visible = false; knife.visible = false; try { if (XV.fp && XV.fp.root) XV.fp.root.visible = false; } catch (e) {} try { if (typeof XAF !== 'undefined' && XAF.cur && XAF.cur.root) XAF.cur.root.visible = false; } catch (e) {} }
  const ag = spec ? (typeof xspvAgent === 'function' ? xspvAgent(u) : 'Jett') : ((typeof J !== 'undefined' && J.pick) || 'Jett');
  const R = xsaRig(ag); if (F.rig && F.rig !== R) { F.rig.root.visible = false; F.rig.prop.visible = false; } F.rig = R;
  if (!R) { XSPK.last = { on: true, kind: F.kind, spec, rig: false }; return; }
  if (R.root.parent !== camera) camera.add(R.root); R.root.visible = true;
  let bx = 0; const S = xsaSpikeAt(R.v[6]); if (S && F.kind === 'defuse') { camera.updateMatrixWorld(); const c = camera.worldToLocal(S.clone().setY(S.y + 0.4)); if (c.z < -0.05) bx = (c.x / -c.z) * 0.45; }
  const P = xsaPlan(F.kind, F.t, F.w, bx); xsaPose(R, P);
  XSPK.last = { on: true, kind: F.kind, spec, rig: true, w: F.w, t: F.t, plan: P };
}
// ---- third-person layer (every unit with a native rig) ------------------------------------------------------------------
function xsaTpPre(b, M, dt) { // before the stock layer pass: rig yaw toward the Spike while defusing (blend in / out)
  const X = M.sx; if (!X || !X.ub) return; const kind = xsaTpKind(b), S = X.xsa || (X.xsa = { w: 0, t: 0, k: '', yaw: 0, yt: 0, gun0: null, r0: null });
  if (kind) { if (S.k !== kind) { S.k = kind; S.t = 0; } S.t += dt; S.w = Math.min(1, S.w + dt / XSPK.IN); } else if (S.w > 0) { S.t += dt; S.w = Math.max(0, S.w - dt / XSPK.OUT); if (!S.w) S.k = ''; }
  S.kind = kind; S.b = b;
  const wr = X.contactRoot; if (!wr) return;
  if (S.w > 0 || S.r0 != null) { if (S.r0 == null) S.r0 = wr.rotation.y;
    if (kind === 'defuse') { const P = xsaSpikeAt(XSPK.tv || (XSPK.tv = new THREE.Vector3())); S.yt = 0; if (P && M.m) { M.m.updateWorldMatrix(true, false); const l = M.m.worldToLocal(P.clone()); if (Math.hypot(l.x, l.z) > 0.05) S.yt = Math.atan2(l.x, l.z); } }
    else if (kind) S.yt = 0;
    S.yaw = S.yt * xsaEase(S.w); wr.rotation.y = S.r0 + S.yaw; if (!S.w) { wr.rotation.y = S.r0; S.r0 = null; S.yaw = 0; S.yt = 0; } }
}
function xsaTpPost(M) { // after the stock post pass: holster the gun, the Spike at a planter's hands, then set down in front of them
  const X = M.sx, S = X && X.xsa; if (!S) return;
  const on = S.w > 0;
  if (M.gun) { if (on) { if (S.gun0 == null) S.gun0 = M.gun.visible; M.gun.visible = false; } else if (S.gun0 != null) { M.gun.visible = S.gun0; S.gun0 = null; } }
  if (!(S.k === 'plant' && S.w > 0)) { if (S.prop) S.prop.visible = false; return; }
  if (!S.prop) { S.prop = new THREE.Mesh(spike.geometry, spike.material.clone()); S.prop.name = 'xsa-tp-spike'; S.prop.castShadow = true; if (typeof XNR !== 'undefined') S.prop.raycast = XNR; }
  if (S.prop.parent !== M.m) M.m.add(S.prop); if (typeof xvDevice === 'function' && !S.prop.userData.xvDevice) { try { xvDevice(S.prop, 'spike', 0.8); } catch (e) {} }
  M.m.updateMatrixWorld(true); const L = X.sc.getObjectByName('L_Hand'), Rh = X.sc.getObjectByName('R_Hand'); if (!L || !Rh) return;
  const m = L.getWorldPosition(new THREE.Vector3()).add(Rh.getWorldPosition(new THREE.Vector3())).multiplyScalar(0.5), loc = M.m.worldToLocal(m);
  const hold = 1 - xsaEase((S.t / XSPK.PLANT - 0.05) / 0.2); // first ~0.8 s carried in the hands, then on the floor between them
  S.prop.position.set(loc.x, 0.4 + Math.max(0, loc.y - 0.55) * hold, loc.z + XSPK.TP_FWD); S.prop.rotation.set(0, 0, 0); S.prop.visible = true; // its near face against the hands (the native Spike is ~0.53 x 0.81 x 0.51 m)
  S.pw = M.m.localToWorld(S.prop.position.clone()); XSPK.lastPl = { b: S.b, x: S.pw.x, z: S.pw.z, at: performance.now() };
}
// ---- the planted Spike stays where the hands put it ---------------------------------------------------------------------
function xsaWorldTick() {
  let st = ''; try { st = mode === 'five' && FV.sp ? FV.sp.st : ''; } catch (e) {}
  if (st === 'plant' && XSPK.prevSt === 'carry') { // the plant just finished: the hands' spot (third person) or XSPK.DROP in front of me
    XSPK.off = null; const s = FV.sp, L = XSPK.lastPl, now = performance.now();
    if (XSPK.fp.kind === 'plant' && XSPK.fp.u === player && XSPK.fp.w > 0) XSPK.off = { x: player.x - Math.sin(yaw) * XSPK.DROP, z: player.z - Math.cos(yaw) * XSPK.DROP };
    else if (L && now - L.at < 600) XSPK.off = { x: L.x, z: L.z };
    if (XSPK.off && !(Math.hypot(XSPK.off.x - s.x, XSPK.off.z - s.z) <= 0.9)) XSPK.off = null; if (XSPK.off) { XSPK.off.sx = s.x; XSPK.off.sz = s.z; }
  }
  if (st !== 'plant' || (XSPK.off && (FV.sp.x !== XSPK.off.sx || FV.sp.z !== XSPK.off.sz))) XSPK.off = null; /* a new plant (another round) starts clean */ XSPK.prevSt = st;
  try { if (typeof fsM !== 'undefined' && fsM) for (const c of fsM.children) { c.position.x = XSPK.off ? XSPK.off.x - fsM.position.x : 0; c.position.z = XSPK.off ? XSPK.off.z - fsM.position.z : 0; } } catch (e) {}
}
// ---- hooks --------------------------------------------------------------------------------------------------------------
{ const a0 = xUbAnim; xUbAnim = function (b, M, sp, dt) { try { if (dt) xsaTpPre(b, M, dt); } catch (e) { if (!XSPK.err) XSPK.err = String(e); } return a0.apply(this, arguments); }; }
{ const p0 = xUbPost; xUbPost = function (M) { const r = p0.apply(this, arguments); try { xsaTpPost(M); } catch (e) { if (!XSPK.err) XSPK.err = String(e); } return r; }; }
{ const v0 = vmTick; vmTick = function (dt) { const r = v0.apply(this, arguments); try { xsaWorldTick(); xsaFpTick(dt); } catch (e) { if (!XSPK.err) { XSPK.err = String(e); console.warn('spike anim', e); } } return r; }; }
if (typeof vfCamDip === 'function') { const c0 = vfCamDip; vfCamDip = function (dt) { const y = c0.apply(this, arguments); try { const F = XSPK.fp; if (F.on && !F.spec && F.u === player) return y - xsaEase(F.w) * Math.max(0, XSPK.DROP - (player.ch || 0)); } catch (e) {} return y; }; }
if (typeof xObsEye === 'function') { const o0 = xObsEye; xObsEye = function (a) { const e = o0.apply(this, arguments); try { const F = XSPK.fp; if (F.on && F.spec && F.u === a) e.y -= xsaEase(F.w) * XSPK.SPEC_DROP; } catch (er) {} return e; }; }
// online: snapshot row [26] -> u.xsa (a fogged row: 0); P2P host rows carry [26] (neutral fill for the server-only fields)
if (typeof mpCliSnap === 'function') { const s0 = mpCliSnap; mpCliSnap = function (m) { const r = s0.apply(this, arguments); try { if (m && Array.isArray(m.u)) { const by = new Map(); for (const u of bots.concat(allies)) if (u && u.nid != null) by.set(u.nid, u); for (const e of m.u) { if (!Array.isArray(e) || e[0] === MP.me) continue; const u = by.get(e[0]); if (u) u.xsa = e[22] === 1 ? 0 : e[26] === 1 || e[26] === 2 ? e[26] : 0; } } } catch (e) {} return r; }; }
function xsaRow(e, k) { while (e.length < 26) { const i = e.length; e.push(i === 21 ? -1 : i >= 22 ? 0 : null); } e[26] = k; return e; }
if (typeof mpEnts === 'function') { const e0 = mpEnts; mpEnts = function () { const E = e0.apply(this, arguments); try { const by = new Map(); for (const u of allies.concat(bots)) if (u) by.set(u.nid, u); E.forEach((e, i) => { const u = i === 0 ? player : by.get(e[0]), k = u ? xsaFvKind(u) : ''; if (k) xsaRow(e, k === 'plant' ? 1 : 2); }); } catch (er) {} return E; }; }
// ---- END SPIKE PLANT DEFUSE ANIM ----
