// ---- WEAPON GRIP ----
// Third-person two-handed grip (#9, ledger row 4). The native locomotion set only has pistol upper-body clips, so
// after the mixer the arms are posed procedurally: the gun is placed from the aim (stock in the right shoulder
// pocket for long guns, arms-extended isosceles for sidearms), the right hand is solved onto the gun's grip and
// the left hand onto the weapon's own Left_Hand_Target socket with two-bone IK, hands are oriented to the gun,
// and fingers curl from their bind pose (index finger along the trigger). One-shots that move the arms
// (reload, cast, throw, plant), the knife and deaths fade the grip out to the authored clip.
// World size: the native template (xGmTpl) is shared with the first-person viewmodel and sized to the procedural stand-in's
// length (a viewmodel length: Sheriff 0.51 m, Classic 0.30, Guardian 1.42, Vandal 1.08). In third person each gun is drawn at
// its native model length x k instead (k = 0.95 m / native Vandal 1.281), so every gun keeps VALORANT's own proportions and
// the hands reach its sockets (gripped in a hand sized for a 1.92 m agent). k / rot.scale works for any native model or skin,
// including guns no table lists (Bandit, Warden). work/test_tp_gun_hold.cjs
var XGRIP = { side: { Classic: 1, Shorty: 1, Frenzy: 1, Ghost: 1, Bandit: 1, Sheriff: 1 }, err: 0, k: 0.95 / 1.281,
  // curl angles (rad) for joints 1..3 per finger
  curl: { rifleR: { Index: [0.25, 0.55, 0.35], Middle: [1.15, 1.25, 0.8], Ring: [1.2, 1.25, 0.8], Pinky: [1.25, 1.2, 0.8], Thumb: [0.15, 0.35, 0.3] },
    rifleL: { Index: [0.85, 0.95, 0.6], Middle: [0.9, 1.0, 0.7], Ring: [0.95, 1.0, 0.7], Pinky: [1.0, 1.0, 0.7], Thumb: [0.3, 0.35, 0.25] },
    pistolL: { Index: [1.0, 1.1, 0.7], Middle: [1.05, 1.15, 0.8], Ring: [1.1, 1.15, 0.8], Pinky: [1.15, 1.15, 0.8], Thumb: [0.2, 0.3, 0.3] } } };
const XG_FINGERS = ['Index', 'Middle', 'Ring', 'Pinky', 'Thumb'];
// --- weapon sockets: read once per gun from the posed native skeleton, carried into the third-person template ---
function xgSockets(gl) {
  const sc = THREE.SkeletonUtils.clone(gl.scene), mx = new THREE.AnimationMixer(sc), idle = gl.animations.find((c) => c.name === 'Idle'); if (idle) { mx.clipAction(idle).play(); mx.update(0); }
  sc.updateMatrixWorld(true); const at = (n) => { const o = xvFind(sc, n); return o ? o.getWorldPosition(new THREE.Vector3()).toArray() : null; };
  const s = { lh: at('Left_Hand_Target') || at('Left_Hand_TargetSocket'), tr: at('Trigger'), mz: at('MuzzlePoint') || at('Muzzle') }; mx.stopAllAction(); return s;
}
// Template space (the xGun group: muzzle toward -Z): right-hand grip just behind/below the trigger, left-hand socket, stock end. Authored support sockets, rather than a rifle offset, select each gun type's grip.
function xgTemplate(T, w) {
  let inner = null; T.traverse((o) => { if (!inner && o.userData && o.userData.sock) inner = o; }); T.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(inner ? inner.parent : T), v = new THREE.Vector3(), by = T.userData.my != null ? T.userData.my : (box.min.y + box.max.y) / 2, s = inner && inner.userData.sock;
  const tp = (p) => (p ? v.fromArray(p).applyMatrix4(inner.matrixWorld).toArray().map((n) => +n.toFixed(4)) : null);
  const len = box.max.z - box.min.z, tr = tp(s && s.tr) || [0, by - 0.03, box.min.z + len * (XGRIP.side[w] ? 0.62 : 0.6)];
  const rh = [tr[0], tr[1] - 0.035, tr[2] + 0.04], lh = tp(s && s.lh), rs = inner && inner.parent && inner.parent.scale.x;
  T.userData.grip = { rh, lh: lh || (XGRIP.side[w] ? null : [0, by - 0.03, box.min.z + len * 0.3]), st: [0, by, box.max.z], mz: box.min.z, side: !!XGRIP.side[w], s: rs > 1e-6 ? +(XGRIP.k / rs).toFixed(4) : 1 };
}
{ const st = xvStatic; xvStatic = function (gl, config) { const out = st.apply(this, arguments); try { out.userData.sock = xgSockets(gl); } catch (e) {} return out; }; }
{ const tp = xGmTpl; xGmTpl = function (w) { const T = tp.apply(this, arguments); if (T && w !== 'Knife') try { xgTemplate(T, w); } catch (e) {} return T; }; }
{ const sw = xGmSwap; xGmSwap = function (g, k) { const r = sw.apply(this, arguments); try { const T = XGM.T[k]; if (g && T && T.userData.grip) g.userData.grip = T.userData.grip; } catch (e) {} return r; }; }
// --- per-agent setup: bones, bind-pose finger rotations and hand axes ---
function xgSetup(M) {
  const X = M.sx, sc = X.sc, b = (n) => sc.getObjectByName(n), G = { ok: false, w: 0 }; X.grip = G;
  const arm = (s) => ({ up: b(s + '_Shoulder'), lo: b(s + '_Elbow'), hand: b(s + '_Hand'), sh: b(s + '_Shoulder'), cl: b(s + '_Clavicle') });
  G.R = arm('R'); G.L = arm('L'); if (!G.R.hand || !G.L.hand || !G.R.up || !G.L.up || !G.R.lo || !G.L.lo || !M.gun) return G;
  let skin = null; sc.traverse((o) => { if (!skin && o.isSkinnedMesh && o.skeleton) skin = o.skeleton; });
  const bindW = new Map(); if (skin) skin.bones.forEach((bn, i) => bindW.set(bn, new THREE.Matrix4().copy(skin.boneInverses[i]).invert()));
  const bindLocal = (bn) => { const w = bindW.get(bn), pw = bindW.get(bn.parent); if (!w || !pw) return bn.quaternion.clone(); const m = new THREE.Matrix4().copy(pw).invert().multiply(w), p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3(); m.decompose(p, q, s); return q; };
  for (const [side, A] of [['R', G.R], ['L', G.L]]) {
    const H = A.hand, mid = b(side + '_Middle1'), ix = b(side + '_Index1'), pk = b(side + '_Pinky1'); if (!mid || !ix || !pk) return G;
    const k = mid.position.clone().normalize(), s = pk.position.clone().sub(ix.position).normalize(), n = side === 'R' ? new THREE.Vector3().crossVectors(k, s) : new THREE.Vector3().crossVectors(s, k);
    n.addScaledVector(k, -n.dot(k)).normalize(); A.basis = new THREE.Matrix4().makeBasis(k, n, new THREE.Vector3().crossVectors(k, n)); A.basisT = A.basis.clone().transpose();
    A.fingers = []; for (const f of XG_FINGERS) for (let j = 1; j <= 3; j++) { const bn = b(side + '_' + f + j); if (bn) A.fingers.push({ bn, f, j, rest: bindLocal(bn) }); }
    A.bones = [A.up, A.lo, A.hand].concat(A.fingers.map((x) => x.bn)); if (side === 'L' && A.cl) A.bones.push(A.cl);
  }
  // Arm and finger bones join the restore-before-mixer set so procedural rotations never stack.
  let i = 0; for (const bn of G.R.bones.concat(G.L.bones)) { const key = 'grip' + i++; X.b[key] = bn; if (X.sv) { X.sv[key] = bn.quaternion.clone(); X.svOn[key] = 1; } }
  G.gp = M.gun.position.clone(); G.gq = M.gun.quaternion.clone(); G.gs = M.gun.scale.clone();
  G.v = Array.from({ length: 12 }, () => new THREE.Vector3()); G.ik = Array.from({ length: 9 }, () => new THREE.Vector3()); G.q = Array.from({ length: 6 }, () => new THREE.Quaternion()); G.m = Array.from({ length: 6 }, () => new THREE.Matrix4());
  G.t1 = new THREE.Vector3(); G.t2 = new THREE.Vector3(); G.p1 = new THREE.Vector3(); G.p2 = new THREE.Vector3(); G.saved = new Map(); G.ok = true; return G;
}
function xgWorldQ(o, q) { if (!XGRIP.cur) o.updateWorldMatrix(true, false); const p = XGRIP.p || (XGRIP.p = new THREE.Vector3()), s = XGRIP.s || (XGRIP.s = new THREE.Vector3()); o.matrixWorld.decompose(p, q, s); return q; }
// World position for the grip: XGRIP.cur (set by the xUbPost wrapper below when the native contact / crouch IK passes left the
// whole tree current and M.m's ancestors are fresh, xvFresh) means every matrixWorld already holds what the chain walk of
// getWorldPosition / updateWorldMatrix(true, false) would recompute; each grip step updates the subtree it moves.
function xgWP(o, v) { return XGRIP.cur ? v.setFromMatrixPosition(o.matrixWorld) : o.getWorldPosition(v); }
// Set a bone's world rotation (parent's world rotation divided out).
function xgSetWorldQ(bn, qw) { const pq = xgWorldQ(bn.parent, XGRIP.pq || (XGRIP.pq = new THREE.Quaternion())); bn.quaternion.copy(pq.invert().multiply(qw)); bn.updateMatrixWorld(true); }
// Two-bone IK: upper/lower bones swing (minimal rotation) so the hand bone reaches target; pole bends the elbow.
function xgIK(A, target, pole, G) {
  const K = G.ik, [a, bb, c, d, e, t] = K, q = G.q[0], qw = G.q[1];
  xgWP(A.up, a); xgWP(A.lo, bb); xgWP(A.hand, c);
  const L1 = a.distanceTo(bb), L2 = bb.distanceTo(c); d.subVectors(target, a); let dist = d.length(); if (dist < 1e-5) return; d.divideScalar(dist);
  dist = Math.max(Math.abs(L1 - L2) + 1e-3, Math.min((L1 + L2) * 0.999, dist));
  e.copy(pole).addScaledVector(d, -pole.dot(d)); if (e.lengthSq() < 1e-8) e.set(0, -1, 0); e.normalize();
  const cosA = Math.max(-1, Math.min(1, (L1 * L1 + dist * dist - L2 * L2) / (2 * L1 * dist))), sinA = Math.sqrt(1 - cosA * cosA);
  const elbow = K[6].copy(a).addScaledVector(d, L1 * cosA).addScaledVector(e, L1 * sinA); t.copy(a).addScaledVector(d, dist);
  q.setFromUnitVectors(K[7].subVectors(bb, a).normalize(), K[8].subVectors(elbow, a).normalize()); xgSetWorldQ(A.up, xgWorldQ(A.up, qw).premultiply(q));
  xgWP(A.lo, bb); xgWP(A.hand, c);
  q.setFromUnitVectors(K[7].subVectors(c, bb).normalize(), K[8].subVectors(t, bb).normalize()); xgSetWorldQ(A.lo, xgWorldQ(A.lo, qw).premultiply(q));
}
// Desired hand world rotation from knuckle direction k and palm normal n (world, orthonormalised here).
function xgHandQ(A, k, n, out) { const t = XGRIP.t || (XGRIP.t = new THREE.Vector3()), m = XGRIP.hm || (XGRIP.hm = new THREE.Matrix4()); n.addScaledVector(k, -n.dot(k)).normalize(); t.crossVectors(k, n); m.makeBasis(k, n, t).multiply(A.basisT); return out.setFromRotationMatrix(m); }
function xgCurl(A, set, k, n) { const axis = XGRIP.ax || (XGRIP.ax = new THREE.Vector3()), pq = XGRIP.cq || (XGRIP.cq = new THREE.Quaternion()), q = XGRIP.cq2 || (XGRIP.cq2 = new THREE.Quaternion()), la = XGRIP.la || (XGRIP.la = new THREE.Vector3());
  axis.crossVectors(k, n).normalize(); for (const F of A.fingers) { const ang = (set[F.f] || [0, 0, 0])[F.j - 1]; F.bn.quaternion.copy(F.rest); xgWorldQ(F.bn.parent, pq); la.copy(axis).applyQuaternion(pq.invert()); q.setFromAxisAngle(la, ang); F.bn.quaternion.premultiply(q); F.bn.updateMatrixWorld(true); } }
function xgTarget(M) { const X = M.sx; if (M.dead || X.dd || M.w === 'Knife' || X.uo === 'reload' || X.uo === 'cast' || X.uo === 'throw' || (X.w && X.w.plant > 0.05)) return 0; return 1; }
// Support-side shoulder reach: the run / crouch clips swing the left shoulder back, leaving a long gun's handguard socket out of
// the arm's reach (the hand then slid back onto the magazine). Turn the left clavicle toward the target, up to XGRIP.clMax rad,
// just enough for the arm (shoulder -> elbow -> hand) to reach; the clavicle is restored before every mixer pass like the arm.
XGRIP.clMax = 0.6;
function xgReach(G, lt) {
  const A = G.L, cl = A.cl; if (!cl || !cl.parent) return; const T = XGRIP.rv || (XGRIP.rv = Array.from({ length: 5 }, () => new THREE.Vector3())), c = xgWP(cl, T[0]), sh = xgWP(A.up, T[1]);
  const reach = (G.reach || (G.reach = sh.distanceTo(xgWP(A.lo, T[2])) + xgWP(A.lo, T[2]).distanceTo(xgWP(A.hand, T[3])))) * 0.985;
  if (sh.distanceTo(lt) <= reach) return; const r0 = T[2].subVectors(sh, c), q = XGRIP.rq0 || (XGRIP.rq0 = new THREE.Quaternion()), qf = XGRIP.rq || (XGRIP.rq = new THREE.Quaternion()), qi = XGRIP.rqi || (XGRIP.rqi = new THREE.Quaternion()), t = T[3];
  q.setFromUnitVectors(t.copy(r0).normalize(), T[4].copy(lt).sub(c).normalize()); const full = 2 * Math.acos(Math.min(1, Math.abs(q.w))); if (full < 1e-4) return;
  let lo = 0, hi = Math.min(1, XGRIP.clMax / full); for (let i = 0; i < 7; i++) { const m = (lo + hi) / 2; qf.identity().slerp(q, m); t.copy(r0).applyQuaternion(qf).add(c); if (t.distanceTo(lt) > reach) lo = m; else hi = m; }
  qf.identity().slerp(q, hi); const pq = xgWorldQ(cl.parent, qi), lq = XGRIP.rq2 || (XGRIP.rq2 = new THREE.Quaternion()); lq.copy(pq).invert().multiply(qf).multiply(pq); cl.quaternion.premultiply(lq);
  // only the chain the arm IK reads (clavicle -> shoulder -> elbow -> hand) is refreshed here; the IK's own shoulder update refreshes the rest
  for (const o of [cl, A.up, A.lo, A.hand]) { o.updateMatrix(); o.matrixWorld.multiplyMatrices(o.parent.matrixWorld, o.matrix); }
}
// the held gun's world size (also while the grip is faded out: a reload never pops the gun back to the viewmodel size)
function xgScale(M, G, g) { if (M.gun && G.gs) M.gun.scale.copy(G.gs).multiplyScalar((g && g.s) || 1); }
function xgGrip(M) { let g = null; M.gun.traverse((o) => { if (!g && o.userData && o.userData.grip) g = o.userData.grip; }); return g; }
// A model persists across purchases, secondary swaps and Escalation levels. Replace only
// the gun under its existing holder; keep the body's mixers and locomotion untouched.
function xgHeldSync(M) {
  const u=M.unit;if(!u||M.dead||u.bsW||!M.gun)return;
  const w=typeof xWeapOf==='function'?xWeapOf(u):u.w;if(!w||w===M.w)return;
  const old=M.gun,parent=old.parent;if(!parent)return;
  const next=xGun(w),G=M.sx&&M.sx.grip;
  next.position.copy(G?G.gp:old.position);next.quaternion.copy(G?G.gq:old.quaternion);next.scale.copy(G?G.gs:old.scale);next.visible=old.visible;
  parent.remove(old);parent.add(next);M.gun=next;M.w=w;
  if(G){G.last=null;G.w=0;G.gp.copy(next.position);G.gq.copy(next.quaternion);G.gs.copy(next.scale);G.slide=0;}
}
function xgPose(M, dt) {
  const held = M.gun; xgHeldSync(M); if (M.gun !== held) { XGRIP.cur = false; if (M.sx) M.sx.mwOk = false; } // a new gun is not placed yet
  const X = M.sx; if (!X || !X.sc || !M.gun || !M.valorant) return; const G = X.grip || xgSetup(M); if (!G.ok) return;
  const want = xgTarget(M), grip = want ? xgGrip(M) : null; G.w += ((grip ? 1 : 0) - G.w) * Math.min(1, (dt || 1 / 60) * 12); if (G.w < 0.01) { G.w = 0; M.gun.position.copy(G.gp); M.gun.quaternion.copy(G.gq); xgScale(M, G, grip || G.last || xgGrip(M)); X.mwOk = false; return; }
  const g = grip || G.last; if (!g) return; G.last = g; const gs = g.s || 1;
  for (const bn of G.R.bones.concat(G.L.bones)) { let s = G.saved.get(bn); if (!s) G.saved.set(bn, (s = new THREE.Quaternion())); s.copy(bn.quaternion); }
  const V = G.v, root = M.m; if (!XGRIP.cur) root.updateWorldMatrix(true, false); const rq = xgWorldQ(root, G.q[2]);
  const axis = (x, y, z, out) => out.set(x, y, z).applyQuaternion(rq); // agent frame (+Z forward, +X the agent's left) to world
  const p = Math.max(-1.5, Math.min(1.5, X.pit || 0)), D = X.aim ? V[9].set(X.aim.x, X.aim.y, X.aim.z).normalize() : axis(0, Math.sin(p), Math.cos(p), V[9]).normalize(), up = axis(0, 1, 0, V[10]); up.addScaledVector(D, -up.dot(D)).normalize();
  if (up.lengthSq() < 1e-8) axis(0, 0, -1, up).addScaledVector(D, -up.dot(D)).normalize(); // directly above/below: retain a stable gun frame
  // gun frame: local -Z along the aim, +Y up
  const zg = V[11].copy(D).negate(), xg = G.v[3].crossVectors(up, zg).normalize(), Rg = G.m[0].makeBasis(xg, up, zg), gq = G.q[3].setFromRotationMatrix(Rg);
  const gp = G.v[4], tmp = G.v[5];
  if (g.side) { // sidearm: arms extended, grip ahead of the shoulders' midpoint
    xgWP(G.R.up, gp); xgWP(G.L.up, tmp); gp.add(tmp).multiplyScalar(0.5).addScaledVector(D, 0.44).addScaledVector(axis(0, -1, 0, tmp), 0.06).addScaledVector(axis(-1, 0, 0, tmp), 0.03);
    gp.sub(tmp.fromArray(g.rh).multiplyScalar(gs).applyQuaternion(gq));
  } else { // long gun: stock in the right shoulder pocket
    xgWP(G.R.up, gp); gp.addScaledVector(axis(1, 0, 0, tmp), 0.06).addScaledVector(axis(0, -1, 0, tmp), 0.05).addScaledVector(axis(0, 0, 1, tmp), 0.1);
    gp.sub(tmp.fromArray(g.st).multiplyScalar(gs).applyQuaternion(gq));
  }
  const toW = (a, out) => out.fromArray(a).multiplyScalar(gs).applyQuaternion(gq).add(gp), gl = (x, y, z, out) => out.set(x, y, z).applyQuaternion(gq);
  // right hand: knuckles forward-down along the grip, palm facing the gun's left
  const kR = gl(0, -0.45, -1, G.v[0]).normalize(), nR = gl(-1, 0, 0, G.v[1]), hq = G.q[4]; xgHandQ(G.R, kR, nR, hq);
  const wt = toW(g.rh, G.v[2]).addScaledVector(kR, -0.06).addScaledVector(nR, -0.02);
  xgIK(G.R, G.t1.copy(wt), axis(g.side ? -0.5 : -0.7, -1, g.side ? 0 : -0.2, G.p1).normalize(), G); xgSetWorldQ(G.R.hand, hq); xgCurl(G.R, XGRIP.curl.rifleR, kR, nR);
  // the gun rides the solved right hand (unreachable targets keep the gun in the hand, not floating)
  const hw = XGRIP.hw || (XGRIP.hw = new THREE.Vector3()); xgWP(G.R.hand, hw); gp.add(hw.sub(wt));
  if (!XGRIP.cur) M.gun.parent.updateWorldMatrix(true, false); const local = G.m[1].compose(gp, gq, XGRIP.one || (XGRIP.one = new THREE.Vector3(1, 1, 1))).premultiply(G.m[2].copy(M.gun.parent.matrixWorld).invert());
  local.decompose(M.gun.position, M.gun.quaternion, tmp); M.gun.scale.copy(G.gs).multiplyScalar(gs); M.gun.updateMatrixWorld(true);
  // left hand: support under the handguard at the weapon's socket, or cupping the right hand on a sidearm
  let kL, nL, lt;
  if (g.side || !g.lh) { kL = gl(0, -0.6, -1, G.v[0]).normalize(); nL = gl(1, 0, 0, G.v[1]); lt = toW(g.rh, G.v[2]).addScaledVector(gl(-1, 0, 0, tmp), 0.035).addScaledVector(kL, -0.05); }
  else { kL = gl(0.55, 0, -1, G.v[0]).normalize(); nL = gl(0.5, 1, 0, G.v[1]).normalize(); lt = toW(g.lh, G.v[2]).addScaledVector(kL, -0.06).addScaledVector(nL, -0.03); }
  if (!g.side && g.lh) xgReach(G, lt); // the support shoulder comes forward (clavicle) when the handguard is out of reach
  if (!g.side && g.lh) { // short arms / long guns: slide the support hand back along the handguard until the arm reaches
    const sh = xgWP(G.L.up, G.v[6]), reach = (G.reach || (G.reach = xgWP(G.L.up, G.v[7]).distanceTo(xgWP(G.L.lo, G.v[8])) + xgWP(G.L.lo, G.v[8]).distanceTo(xgWP(G.L.hand, G.v[7])))) * 0.985;
    const ax = gl(0, 0, 1, G.v[7]), rel = G.v[8].subVectors(lt, sh), bq = rel.dot(ax), cq = rel.lengthSq() - reach * reach;
    if (cq > 0) { const disc = bq * bq - cq, lim = Math.max(0, (g.rh[2] - g.lh[2]) * gs - 0.1); const sl = disc >= 0 ? Math.min(lim, -bq - Math.sqrt(disc) > 0 ? -bq - Math.sqrt(disc) : -bq + Math.sqrt(disc)) : Math.min(lim, Math.max(0, -bq)); if (sl > 0) lt.addScaledVector(ax, sl); G.slide = sl > 0 ? sl : 0; } else G.slide = 0;
  }
  xgHandQ(G.L, kL, nL, hq); xgIK(G.L, G.t2.copy(lt), axis(g.side ? 0.5 : 0.4, -1, 0, G.p2).normalize(), G); xgSetWorldQ(G.L.hand, hq); xgCurl(G.L, g.side || !g.lh ? XGRIP.curl.pistolL : XGRIP.curl.rifleL, kL, nL);
  if (G.w < 0.999) { for (const [bn, s] of G.saved) bn.quaternion.slerp(s, 1 - G.w); M.gun.position.lerp(G.gp, 1 - G.w); M.gun.quaternion.slerp(G.gq, 1 - G.w); X.mwOk = false; } // blended bones: matrices not refreshed
}
{ const post = xUbPost; xUbPost = function (M) { post(M); if (M && M.valorant && M.sx && !M.dead) { const X = M.sx; XGRIP.cur = X.mwOk === true && typeof xvFresh === 'function' && xvFresh(M.m); try { xgPose(M, 1 / 60); } catch (e) { X.mwOk = false; if (!XGRIP.err++) console.warn('weapon grip disabled for a frame', e); } finally { XGRIP.cur = false; } } }; }
// ---- END WEAPON GRIP ----
