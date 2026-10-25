// ---- WEAPON GRIP ----
// Third-person two-handed grip (#9, ledger row 4). The native locomotion set only has pistol upper-body clips, so
// after the mixer the arms are posed procedurally: the gun is placed from the aim (stock in the right shoulder
// pocket for long guns, arms-extended isosceles for sidearms), the right hand is solved onto the gun's grip and
// the left hand onto the weapon's own Left_Hand_Target socket with two-bone IK, hands are oriented to the gun,
// and fingers curl from their bind pose (index finger along the trigger). One-shots that move the arms
// (reload, cast, throw, plant), the knife and deaths fade the grip out to the authored clip.
var XGRIP = { side: { Classic: 1, Shorty: 1, Frenzy: 1, Ghost: 1, Sheriff: 1 }, err: 0,
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
// Template space (the xGun group: muzzle toward -Z): right-hand grip just behind/below the trigger, left-hand socket, stock end.
function xgTemplate(T, w) {
  let inner = null; T.traverse((o) => { if (!inner && o.userData && o.userData.sock) inner = o; }); T.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(inner ? inner.parent : T), v = new THREE.Vector3(), by = T.userData.my != null ? T.userData.my : (box.min.y + box.max.y) / 2, s = inner && inner.userData.sock;
  const tp = (p) => (p ? v.fromArray(p).applyMatrix4(inner.matrixWorld).toArray().map((n) => +n.toFixed(4)) : null);
  const len = box.max.z - box.min.z, tr = tp(s && s.tr) || [0, by - 0.03, box.min.z + len * (XGRIP.side[w] ? 0.62 : 0.6)];
  const rh = [tr[0], tr[1] - 0.035, tr[2] + 0.04], lh = tp(s && s.lh);
  T.userData.grip = { rh, lh: lh || (XGRIP.side[w] ? null : [0, by - 0.03, box.min.z + len * 0.3]), st: [0, by, box.max.z], side: !!XGRIP.side[w] };
}
{ const st = xvStatic; xvStatic = function (gl, config) { const out = st.apply(this, arguments); try { out.userData.sock = xgSockets(gl); } catch (e) {} return out; }; }
{ const tp = xGmTpl; xGmTpl = function (w) { const T = tp.apply(this, arguments); if (T && w !== 'Knife') try { xgTemplate(T, w); } catch (e) {} return T; }; }
{ const sw = xGmSwap; xGmSwap = function (g, k) { const r = sw.apply(this, arguments); try { const T = XGM.T[k]; if (g && T && T.userData.grip) g.userData.grip = T.userData.grip; } catch (e) {} return r; }; }
// --- per-agent setup: bones, bind-pose finger rotations and hand axes ---
function xgSetup(M) {
  const X = M.sx, sc = X.sc, b = (n) => sc.getObjectByName(n), G = { ok: false, w: 0 }; X.grip = G;
  const arm = (s) => ({ up: b(s + '_Shoulder'), lo: b(s + '_Elbow'), hand: b(s + '_Hand'), sh: b(s + '_Shoulder') });
  G.R = arm('R'); G.L = arm('L'); if (!G.R.hand || !G.L.hand || !G.R.up || !G.L.up || !G.R.lo || !G.L.lo || !M.gun) return G;
  let skin = null; sc.traverse((o) => { if (!skin && o.isSkinnedMesh && o.skeleton) skin = o.skeleton; });
  const bindW = new Map(); if (skin) skin.bones.forEach((bn, i) => bindW.set(bn, new THREE.Matrix4().copy(skin.boneInverses[i]).invert()));
  const bindLocal = (bn) => { const w = bindW.get(bn), pw = bindW.get(bn.parent); if (!w || !pw) return bn.quaternion.clone(); const m = new THREE.Matrix4().copy(pw).invert().multiply(w), p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3(); m.decompose(p, q, s); return q; };
  for (const [side, A] of [['R', G.R], ['L', G.L]]) {
    const H = A.hand, mid = b(side + '_Middle1'), ix = b(side + '_Index1'), pk = b(side + '_Pinky1'); if (!mid || !ix || !pk) return G;
    const k = mid.position.clone().normalize(), s = pk.position.clone().sub(ix.position).normalize(), n = side === 'R' ? new THREE.Vector3().crossVectors(k, s) : new THREE.Vector3().crossVectors(s, k);
    n.addScaledVector(k, -n.dot(k)).normalize(); A.basis = new THREE.Matrix4().makeBasis(k, n, new THREE.Vector3().crossVectors(k, n)); A.basisT = A.basis.clone().transpose();
    A.fingers = []; for (const f of XG_FINGERS) for (let j = 1; j <= 3; j++) { const bn = b(side + '_' + f + j); if (bn) A.fingers.push({ bn, f, j, rest: bindLocal(bn) }); }
    A.bones = [A.up, A.lo, A.hand].concat(A.fingers.map((x) => x.bn));
  }
  // Arm and finger bones join the restore-before-mixer set so procedural rotations never stack.
  let i = 0; for (const bn of G.R.bones.concat(G.L.bones)) { const key = 'grip' + i++; X.b[key] = bn; if (X.sv) { X.sv[key] = bn.quaternion.clone(); X.svOn[key] = 1; } }
  G.gp = M.gun.position.clone(); G.gq = M.gun.quaternion.clone(); G.gs = M.gun.scale.clone();
  G.v = Array.from({ length: 12 }, () => new THREE.Vector3()); G.ik = Array.from({ length: 9 }, () => new THREE.Vector3()); G.q = Array.from({ length: 6 }, () => new THREE.Quaternion()); G.m = Array.from({ length: 6 }, () => new THREE.Matrix4());
  G.saved = new Map(); G.ok = true; return G;
}
function xgWorldQ(o, q) { o.updateWorldMatrix(true, false); const p = XGRIP.p || (XGRIP.p = new THREE.Vector3()), s = XGRIP.s || (XGRIP.s = new THREE.Vector3()); o.matrixWorld.decompose(p, q, s); return q; }
// Set a bone's world rotation (parent's world rotation divided out).
function xgSetWorldQ(bn, qw) { const pq = xgWorldQ(bn.parent, XGRIP.pq || (XGRIP.pq = new THREE.Quaternion())); bn.quaternion.copy(pq.invert().multiply(qw)); bn.updateMatrixWorld(true); }
// Two-bone IK: upper/lower bones swing (minimal rotation) so the hand bone reaches target; pole bends the elbow.
function xgIK(A, target, pole, G) {
  const K = G.ik, [a, bb, c, d, e, t] = K, q = G.q[0], qw = G.q[1];
  A.up.getWorldPosition(a); A.lo.getWorldPosition(bb); A.hand.getWorldPosition(c);
  const L1 = a.distanceTo(bb), L2 = bb.distanceTo(c); d.subVectors(target, a); let dist = d.length(); if (dist < 1e-5) return; d.divideScalar(dist);
  dist = Math.max(Math.abs(L1 - L2) + 1e-3, Math.min((L1 + L2) * 0.999, dist));
  e.copy(pole).addScaledVector(d, -pole.dot(d)); if (e.lengthSq() < 1e-8) e.set(0, -1, 0); e.normalize();
  const cosA = Math.max(-1, Math.min(1, (L1 * L1 + dist * dist - L2 * L2) / (2 * L1 * dist))), sinA = Math.sqrt(1 - cosA * cosA);
  const elbow = K[6].copy(a).addScaledVector(d, L1 * cosA).addScaledVector(e, L1 * sinA); t.copy(a).addScaledVector(d, dist);
  q.setFromUnitVectors(K[7].subVectors(bb, a).normalize(), K[8].subVectors(elbow, a).normalize()); xgSetWorldQ(A.up, xgWorldQ(A.up, qw).premultiply(q));
  A.lo.getWorldPosition(bb); A.hand.getWorldPosition(c);
  q.setFromUnitVectors(K[7].subVectors(c, bb).normalize(), K[8].subVectors(t, bb).normalize()); xgSetWorldQ(A.lo, xgWorldQ(A.lo, qw).premultiply(q));
}
// Desired hand world rotation from knuckle direction k and palm normal n (world, orthonormalised here).
function xgHandQ(A, k, n, out) { const t = XGRIP.t || (XGRIP.t = new THREE.Vector3()), m = XGRIP.hm || (XGRIP.hm = new THREE.Matrix4()); n.addScaledVector(k, -n.dot(k)).normalize(); t.crossVectors(k, n); m.makeBasis(k, n, t).multiply(A.basisT); return out.setFromRotationMatrix(m); }
function xgCurl(A, set, k, n) { const axis = XGRIP.ax || (XGRIP.ax = new THREE.Vector3()), pq = XGRIP.cq || (XGRIP.cq = new THREE.Quaternion()), q = XGRIP.cq2 || (XGRIP.cq2 = new THREE.Quaternion()), la = XGRIP.la || (XGRIP.la = new THREE.Vector3());
  axis.crossVectors(k, n).normalize(); for (const F of A.fingers) { const ang = (set[F.f] || [0, 0, 0])[F.j - 1]; F.bn.quaternion.copy(F.rest); xgWorldQ(F.bn.parent, pq); la.copy(axis).applyQuaternion(pq.invert()); q.setFromAxisAngle(la, ang); F.bn.quaternion.premultiply(q); F.bn.updateMatrixWorld(true); } }
function xgTarget(M) { const X = M.sx; if (M.dead || X.dd || M.w === 'Knife' || X.uo === 'reload' || X.uo === 'cast' || X.uo === 'throw' || (X.w && X.w.plant > 0.05)) return 0; return 1; }
function xgGrip(M) { let g = null; M.gun.traverse((o) => { if (!g && o.userData && o.userData.grip) g = o.userData.grip; }); return g; }
function xgPose(M, dt) {
  const X = M.sx; if (!X || !X.sc || !M.gun || !M.valorant) return; const G = X.grip || xgSetup(M); if (!G.ok) return;
  const want = xgTarget(M), grip = want ? xgGrip(M) : null; G.w += ((grip ? 1 : 0) - G.w) * Math.min(1, (dt || 1 / 60) * 12); if (G.w < 0.01) { G.w = 0; M.gun.position.copy(G.gp); M.gun.quaternion.copy(G.gq); return; }
  const g = grip || G.last; if (!g) return; G.last = g;
  for (const bn of G.R.bones.concat(G.L.bones)) { let s = G.saved.get(bn); if (!s) G.saved.set(bn, (s = new THREE.Quaternion())); s.copy(bn.quaternion); }
  const V = G.v, root = M.m; root.updateWorldMatrix(true, false); const rq = xgWorldQ(root, G.q[2]);
  const axis = (x, y, z, out) => out.set(x, y, z).applyQuaternion(rq); // agent frame (+Z forward, +X the agent's left) to world
  const p = Math.max(-1.2, Math.min(1.2, X.pit || 0)), D = axis(0, Math.sin(p), Math.cos(p), V[9]).normalize(), up = axis(0, 1, 0, V[10]); up.addScaledVector(D, -up.dot(D)).normalize();
  // gun frame: local -Z along the aim, +Y up
  const zg = V[11].copy(D).negate(), xg = G.v[3].crossVectors(up, zg).normalize(), Rg = G.m[0].makeBasis(xg, up, zg), gq = G.q[3].setFromRotationMatrix(Rg);
  const gp = G.v[4], tmp = G.v[5];
  if (g.side) { // sidearm: arms extended, grip ahead of the shoulders' midpoint
    G.R.up.getWorldPosition(gp); G.L.up.getWorldPosition(tmp); gp.add(tmp).multiplyScalar(0.5).addScaledVector(D, 0.44).addScaledVector(axis(0, -1, 0, tmp), 0.06).addScaledVector(axis(-1, 0, 0, tmp), 0.03);
    gp.sub(tmp.fromArray(g.rh).applyQuaternion(gq));
  } else { // long gun: stock in the right shoulder pocket
    G.R.up.getWorldPosition(gp); gp.addScaledVector(axis(1, 0, 0, tmp), 0.06).addScaledVector(axis(0, -1, 0, tmp), 0.05).addScaledVector(axis(0, 0, 1, tmp), 0.1);
    gp.sub(tmp.fromArray(g.st).applyQuaternion(gq));
  }
  const toW = (a, out) => out.fromArray(a).applyQuaternion(gq).add(gp), gl = (x, y, z, out) => out.set(x, y, z).applyQuaternion(gq);
  // right hand: knuckles forward-down along the grip, palm facing the gun's left
  const kR = gl(0, -0.45, -1, G.v[0]).normalize(), nR = gl(-1, 0, 0, G.v[1]), hq = G.q[4]; xgHandQ(G.R, kR, nR, hq);
  const wt = toW(g.rh, G.v[2]).addScaledVector(kR, -0.06).addScaledVector(nR, -0.02);
  xgIK(G.R, wt.clone(), axis(g.side ? -0.5 : -0.7, -1, g.side ? 0 : -0.2, new THREE.Vector3()).normalize(), G); xgSetWorldQ(G.R.hand, hq); xgCurl(G.R, XGRIP.curl.rifleR, kR, nR);
  // the gun rides the solved right hand (unreachable targets keep the gun in the hand, not floating)
  const hw = XGRIP.hw || (XGRIP.hw = new THREE.Vector3()); G.R.hand.getWorldPosition(hw); gp.add(hw.sub(wt));
  M.gun.parent.updateWorldMatrix(true, false); const local = G.m[1].compose(gp, gq, XGRIP.one || (XGRIP.one = new THREE.Vector3(1, 1, 1))).premultiply(G.m[2].copy(M.gun.parent.matrixWorld).invert());
  local.decompose(M.gun.position, M.gun.quaternion, tmp); M.gun.scale.copy(G.gs); M.gun.updateMatrixWorld(true);
  // left hand: support under the handguard at the weapon's socket, or cupping the right hand on a sidearm
  let kL, nL, lt;
  if (g.side || !g.lh) { kL = gl(0, -0.6, -1, G.v[0]).normalize(); nL = gl(1, 0, 0, G.v[1]); lt = toW(g.rh, G.v[2]).addScaledVector(gl(-1, 0, 0, tmp), 0.035).addScaledVector(kL, -0.05); }
  else { kL = gl(0.55, 0, -1, G.v[0]).normalize(); nL = gl(0.5, 1, 0, G.v[1]).normalize(); lt = toW(g.lh, G.v[2]).addScaledVector(kL, -0.06).addScaledVector(nL, -0.03); }
  if (!g.side && g.lh) { // short arms / long guns: slide the support hand back along the handguard until the arm reaches
    const sh = G.L.up.getWorldPosition(G.v[6]), reach = (G.reach || (G.reach = G.L.up.getWorldPosition(G.v[7]).distanceTo(G.L.lo.getWorldPosition(G.v[8])) + G.L.lo.getWorldPosition(G.v[8]).distanceTo(G.L.hand.getWorldPosition(G.v[7])))) * 0.985;
    const ax = gl(0, 0, 1, G.v[7]), rel = G.v[8].subVectors(lt, sh), bq = rel.dot(ax), cq = rel.lengthSq() - reach * reach;
    if (cq > 0) { const disc = bq * bq - cq, lim = Math.max(0, (g.rh[2] - g.lh[2]) - 0.1); const sl = disc >= 0 ? Math.min(lim, -bq - Math.sqrt(disc) > 0 ? -bq - Math.sqrt(disc) : -bq + Math.sqrt(disc)) : Math.min(lim, Math.max(0, -bq)); if (sl > 0) lt.addScaledVector(ax, sl); G.slide = sl > 0 ? sl : 0; } else G.slide = 0;
  }
  xgHandQ(G.L, kL, nL, hq); xgIK(G.L, lt.clone(), axis(g.side ? 0.5 : 0.4, -1, 0, new THREE.Vector3()).normalize(), G); xgSetWorldQ(G.L.hand, hq); xgCurl(G.L, g.side || !g.lh ? XGRIP.curl.pistolL : XGRIP.curl.rifleL, kL, nL);
  if (G.w < 0.999) { for (const [bn, s] of G.saved) bn.quaternion.slerp(s, 1 - G.w); M.gun.position.lerp(G.gp, 1 - G.w); M.gun.quaternion.slerp(G.gq, 1 - G.w); }
}
{ const post = xUbPost; xUbPost = function (M) { post(M); if (M && M.valorant && M.sx && !M.dead) try { xgPose(M, 1 / 60); } catch (e) { if (!XGRIP.err++) console.warn('weapon grip disabled for a frame', e); } }; }
// ---- END WEAPON GRIP ----
