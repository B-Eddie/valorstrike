// ---- FOOT PLANTING ----
// Feet on terrain (ledger row 6). Native locomotion clips are authored on flat ground, so on stairs, slopes and
// ledges one foot floated or sank. After the mixer (and the grip), each foot of a nearby third-person agent probes
// the native collision mesh under it; the whole body (Splitter: legs and torso together) drops to the lower foot and
// the other leg is bent with two-bone IK onto its own floor, keeping the foot's authored rotation. Offsets are
// smoothed, clamped to a stair rise, skipped in the air, for the dead and beyond 22 m, and undone before the mixer.
var XFT = { max: 0.42, lod: 22, rate: 14, err: 0, ray: null, cam: null };
function xfGround(C, x, z, y0) {
  const R = XFT.ray || (XFT.ray = new THREE.Ray(new THREE.Vector3(), new THREE.Vector3(0, -1, 0))); R.origin.set(x, y0 + XFT.max + 0.08, z);
  for (let k = 0; k < 8; k++) { const hit = C.bvh.raycastFirst(R, THREE.DoubleSide); if (!hit) return null; if (hit.face && hit.face.normal.y > 0.45) return hit.point.y; R.origin.y = hit.point.y - 0.005; if (R.origin.y < y0 - XFT.max - 0.1) return null; }
  return null;
}
function xfSetup(M) {
  const X = M.sx, b = (n) => X.sc.getObjectByName(n), F = { ok: false, d: [0, 0], p: 0 }; X.ft = F;
  F.split = b('Splitter'); F.legs = ['L', 'R'].map((s) => ({ up: b(s + '_Hip'), lo: b(s + '_Knee'), hand: b(s + '_Foot') }));
  if (!F.split || F.legs.some((L) => !L.up || !L.lo || !L.hand)) return F;
  let i = 0; for (const L of F.legs) for (const bn of [L.up, L.lo, L.hand]) { const key = 'ft' + i++; X.b[key] = bn; if (X.sv) { X.sv[key] = bn.quaternion.clone(); X.svOn[key] = 1; } }
  F.rest = new THREE.Vector3(); F.v = Array.from({ length: 6 }, () => new THREE.Vector3()); F.q = new THREE.Quaternion();
  F.G = { ik: Array.from({ length: 9 }, () => new THREE.Vector3()), q: Array.from({ length: 2 }, () => new THREE.Quaternion()) }; F.ok = true; return F;
}
function xfPose(M, dt, C) {
  const X = M.sx; if (!X || !X.sc || !M.valorant || M.dead || X.dd) return; const F = X.ft || xfSetup(M); if (!F.ok) return;
  M.m.updateWorldMatrix(true, false); const V = F.v, root = M.m.getWorldPosition(V[0]), y0 = root.y, k = 1 - Math.exp(-Math.max(0, dt) * XFT.rate);
  for (let i = 0; i < 2; i++) { let d = 0; if (!X.air) { const f = F.legs[i].hand.getWorldPosition(V[1]), g = xfGround(C, f.x, f.z, y0); if (g != null && Number.isFinite(g)) d = Math.max(-XFT.max, Math.min(XFT.max, g - y0)); } F.d[i] += (d - F.d[i]) * k; }
  const p = Math.min(0, F.d[0], F.d[1]); F.p = p; if (Math.abs(F.d[0]) < 0.004 && Math.abs(F.d[1]) < 0.004) return;
  // body down to the lower foot (vertical, in world), restored in xUbPre
  F.rest.copy(F.split.position); X.ftRestore = true; const s = F.split.getWorldPosition(V[2]); s.y += p; F.split.parent.updateWorldMatrix(true, false); F.split.position.copy(F.split.parent.worldToLocal(s)); F.split.updateMatrixWorld(true);
  for (let i = 0; i < 2; i++) { const L = F.legs[i], lift = F.d[i] - p; if (lift < 0.004) continue;
    const hip = L.up.getWorldPosition(V[3]), knee = L.lo.getWorldPosition(V[4]), foot = L.hand.getWorldPosition(V[5]), fq = xgWorldQ(L.hand, F.q);
    const dir = V[2].subVectors(foot, hip).normalize(), pole = knee.sub(hip); pole.addScaledVector(dir, -pole.dot(dir)); if (pole.lengthSq() < 1e-8) pole.copy(M.m.getWorldDirection(V[2]));
    const target = (F.t || (F.t = new THREE.Vector3())).copy(foot); target.y += lift; xgIK(L, target, pole.normalize(), F.G); xgSetWorldQ(L.hand, fq);
  }
}
// ---- PROCEDURAL GAIT (XUG) ----
// Third-person stepping. The retargeted Quaternius jog is a bounding sprint (feet 1.3 m apart front to back, heel kicked to
// 0.54 m, pelvis 16 cm low) and has no strafe / backpedal clips: strafes twisted the hips up to 72 deg onto a forward jog, a
// backpedal ran the sprint in reverse, and at 5.4 m/s the clip had to play 1.86x (4 steps/s) with the planted foot still
// skating 15-30 cm per contact. VALORANT's agents move in any direction with the chest on the aim, compact grounded strides
// and quick plants. Here the legs step procedurally over the standing pose (idle / crouch-idle clips): each foot is planted
// in the world for its stance (zero slide by construction), swings to where the hip will be at mid-stance, alternating at
// a cadence set by speed (~3.2 steps/s at 5.4 m/s, ~2.9 at 3.24 m/s shift-walk, quick short steps crouched), with two-bone
// IK (knees toward the hips' facing), heel-off at the end of a stance, a small pelvis drop and bob in a run. Stops /
// counter-strafes plant at once and settle the feet with one or two short steps; turning in place steps when a planted
// foot twists past 35 deg. Airborne the jump / fall clips own the legs (the gait fades out and back in on landing).
var XUG = { stand: { b0: 0.6, b1: 0.26, s0: 1.5, s1: 5, c0: 1.6, ck: 0.3, D: 0.85, h0: 0.11, h1: 0.26, drop: 0.09, bob: 0.03, back: 0.2 },
  crouch: { b0: 0.55, b1: 0.45, s0: 1, s1: 3, c0: 1.5, ck: 1.0, D: 0.62, h0: 0.07, h1: 0.1, drop: 0, bob: 0.01, back: 0.02 },
  settle: { dur: 0.12, h: 0.05, d: 0.08, yaw: 0.6 }, minSp: 0.4, reach: 0.78, fade: 12 };
// Gait parameters at ground speed sp (m/s), crouch blend cw 0..1: duty (stance fraction of a foot's cycle), cadence (steps/s),
// stance travel (m), swing height (m), pelvis drop / bob (m). Cadence never lets the stance outgrow the leg (D cap).
function xUgGait(sp, cw) {
  const S = XUG.stand, C = XUG.crouch, mix = (k) => S[k] + (C[k] - S[k]) * cw;
  const r = Math.max(0, Math.min(1, (sp - mix('s0')) / (mix('s1') - mix('s0')))), duty = mix('b0') + (mix('b1') - mix('b0')) * r;
  const cad = Math.max(mix('c0') + mix('ck') * sp, 2 * duty * sp / mix('D')), stance = sp * duty * 2 / cad;
  return { duty, cad, stance, h: mix('h0') + (mix('h1') - mix('h0')) * r, drop: mix('drop') * r, bob: mix('bob') * r, back: mix('back') * r, r };
}
function xUgSetup(M) {
  const X = M.sx, b = (n) => X.sc.getObjectByName(n), G = { ok: false }; X.ug = G;
  G.split = b('Splitter'); G.legs = ['L', 'R'].map((s) => ({ up: b(s + '_Hip'), lo: b(s + '_Knee'), hand: b(s + '_Foot') }));
  if (!G.split || G.legs.some((L) => !L.up || !L.lo || !L.hand)) return G;
  let i = 0; for (const L of G.legs) for (const bn of [L.up, L.lo, L.hand]) { const key = 'ug' + i++; X.b[key] = bn; if (X.sv) { X.sv[key] = bn.quaternion.clone(); X.svOn[key] = 1; } }
  G.f = G.legs.map(() => ({ p: new THREE.Vector3(), from: new THREE.Vector3(), yaw: 0, fromYaw: 0, u: 0, sw: 0, set: false }));
  G.v = Array.from({ length: 12 }, () => new THREE.Vector3()); G.q = [new THREE.Quaternion(), new THREE.Quaternion(), new THREE.Quaternion()];
  G.IK = { ik: Array.from({ length: 9 }, () => new THREE.Vector3()), q: Array.from({ length: 2 }, () => new THREE.Quaternion()) };
  G.rest = new THREE.Vector3(); G.w = 0; G.moving = false; G.ok = true; return G;
}
function xUgReset(G) { if (G && G.f) for (const f of G.f) f.set = false; }
function xUgEase(u) { return u * u * (3 - 2 * u); }
function xUgPose(M, dt) {
  const X = M.sx; if (!X || !X.sc || !M.valorant || M.dead || X.dd) return; const G = X.ug || xUgSetup(M); if (!G.ok) return;
  dt = Math.max(0, Math.min(0.1, dt || 0)); const on = X.ugOn && !X.air && !(X.w.plant > 0.01) && !X.lo;
  G.w += ((on ? 1 : 0) - G.w) * (1 - Math.exp(-dt * XUG.fade)); if (!on && G.w < 0.01) { G.w = 0; xUgReset(G); return; }
  M.m.updateWorldMatrix(true, false); const V = G.v, root = M.m.getWorldPosition(V[0]);
  const yawB = Math.atan2(M.m.matrixWorld.elements[8], M.m.matrixWorld.elements[10]), yawH = yawB + (X.yaw || 0);
  const fwd = V[1].set(Math.sin(yawH), 0, Math.cos(yawH)), left = V[2].set(Math.cos(yawH), 0, -Math.sin(yawH));
  const vel = X.vel || { x: 0, z: 0 }, sp = Math.hypot(vel.x, vel.z), cw = Math.max(0, Math.min(1, (X.cb || 0))), P = xUgGait(sp, cw);
  // homes: the standing pose's feet (after the mixer, contact and crouch passes); moving, side by side under the hips
  const rest = [G.legs[0].hand.getWorldPosition(V[3]), G.legs[1].hand.getWorldPosition(V[4])], mv = sp > XUG.minSp;
  const fm = ((rest[0].x - root.x) * fwd.x + (rest[0].z - root.z) * fwd.z + (rest[1].x - root.x) * fwd.x + (rest[1].z - root.z) * fwd.z) / 2, al = Math.min(1, sp / 1.5);
  const home = (i, out) => { const r = rest[i], o = (r.x - root.x) * fwd.x + (r.z - root.z) * fwd.z; return out.copy(r).addScaledVector(fwd, (fm - o) * al).addScaledVector(V[10].set(vel.x, 0, vel.z), -P.back / Math.max(0.5, sp)); }; // stance centred a little behind the hip in a run (the foot lands under the body, pushes off behind)
  for (let i = 0; i < 2; i++) { const f = G.f[i]; if (!f.set || !f.sw && !f.settle && f.p.distanceTo(home(i, V[5])) > 2.5) { /* first frame / teleport: plant at home */ f.p.copy(home(i, V[5])); f.yaw = yawH; f.set = true; f.sw = 0; f.u = i ? 0.5 : 0; } }
  // phase: each foot runs its own cycle u (0..duty stance, duty..1 swing), the feet half a cycle apart
  if (mv) {
    if (!G.moving) { // start: the foot further behind (along the move) lifts first
      const d0 = (G.f[0].p.x - root.x) * vel.x + (G.f[0].p.z - root.z) * vel.z, d1 = (G.f[1].p.x - root.x) * vel.x + (G.f[1].p.z - root.z) * vel.z, first = d0 < d1 ? 0 : 1;
      for (const f of G.f) { if (f.settle && f.cur) f.p.copy(f.cur); f.settle = 0; f.sw = 0; } G.f[first].u = P.duty; G.f[1 - first].u = (P.duty + 0.5) % 1; G.moving = true; // a settle step in progress ends where it is
    }
    const du = P.cad / 2 * dt;
    for (let i = 0; i < 2; i++) { const f = G.f[i], u0 = f.u; f.u = (f.u + du) % 1; const wrap = f.u < u0;
      if (wrap && f.sw) { f.sw = 0; if (f.tgt) f.p.copy(f.tgt); f.yaw = yawH; } // landed
      if (!f.sw && f.u >= P.duty && (u0 < P.duty || wrap)) { f.sw = 1; f.from.copy(f.p); f.fromYaw = f.yaw; (f.tgt || (f.tgt = new THREE.Vector3())).copy(f.p); } // lift-off
    }
  } else if (G.moving) { G.moving = false; for (const f of G.f) if (f.sw) { f.sw = 0; f.settle = 1; f.st = 0; if (f.cur) f.from.copy(f.cur); f.fromYaw = f.yaw; } }
  const tsw = (1 - P.duty) * 2 / Math.max(0.5, P.cad);
  for (let i = 0; i < 2; i++) { const f = G.f[i], o = G.f[1 - i];
    if (mv && f.sw) { // swing toward where this foot lands: under the hip half a stance ahead, at landing time
      const s = Math.max(0, Math.min(1, (f.u - P.duty) / (1 - P.duty))), left = tsw * (1 - s), tgt = home(i, V[6]).addScaledVector(V[7].set(vel.x, 0, vel.z), left + P.stance / 2 / Math.max(0.01, sp));
      f.tgt = (f.tgt || new THREE.Vector3()).copy(tgt); f.s = s;
    } else if (!mv) { // settle: step a foot that is off its home (stop, counter-strafe, turning in place), one foot at a time
      if (f.settle) { f.st = (f.st || 0) + dt / (XUG.settle.dur + 0.1 * Math.min(1, f.from.distanceTo(f.tgt || f.from))); if (f.st >= 1) { f.settle = 0; f.p.copy(f.tgt); f.yaw = yawH; f.st = 0; } }
      else if (!o.settle) { const h = home(i, V[6]), off = Math.hypot(f.p.x - h.x, f.p.z - h.z), tw = Math.abs(Math.atan2(Math.sin(yawH - f.yaw), Math.cos(yawH - f.yaw)));
        const oo = Math.hypot(o.p.x - home(1 - i, V[8]).x, o.p.z - home(1 - i, V[8]).z);
        if ((off > XUG.settle.d || tw > XUG.settle.yaw) && off >= oo - 1e-6) { f.settle = 1; f.st = 0; f.from.copy(f.p); f.fromYaw = f.yaw; } }
      if (f.settle) { f.tgt = (f.tgt || new THREE.Vector3()).copy(home(i, V[6])); }
    }
    // a planted foot left far behind (a dash, a speed spike) lifts at once
    if (mv && !f.sw && Math.hypot(f.p.x - root.x, f.p.z - root.z) > XUG.reach * (1 - 0.35 * cw)) { f.sw = 1; f.from.copy(f.p); f.fromYaw = f.yaw; (f.tgt || (f.tgt = new THREE.Vector3())).copy(f.p); f.s = 0; f.u = Math.max(f.u, P.duty); }
  }
  // targets
  const T = [V[6], V[7]], yaws = [0, 0], lifts = [0, 0]; let bob = 0;
  for (let i = 0; i < 2; i++) { const f = G.f[i], r = rest[i], t = T[i];
    if (mv && f.sw) { const s = f.s || 0, e = xUgEase(s) + (s * (2 - s) - xUgEase(s)) * P.r; /* a run swings the foot forward from the start (no straight trailing leg) */ t.copy(f.from).lerp(f.tgt, e); t.y = r.y + P.h * Math.sin(Math.PI * Math.pow(s, 0.6 + 0.4 * (1 - P.r))); /* a run lifts the heel early behind the body */ yaws[i] = f.fromYaw + Math.atan2(Math.sin(yawH - f.fromYaw), Math.cos(yawH - f.fromYaw)) * e; }
    else if (f.settle) { const e = xUgEase(Math.min(1, f.st || 0)); t.copy(f.from).lerp(f.tgt, e); t.y = r.y + (XUG.settle.h + 0.06 * Math.min(1, f.from.distanceTo(f.tgt))) * Math.sin(Math.PI * Math.min(1, f.st || 0)); yaws[i] = f.fromYaw + Math.atan2(Math.sin(yawH - f.fromYaw), Math.cos(yawH - f.fromYaw)) * e; }
    else { t.copy(f.p); t.y = r.y; yaws[i] = f.yaw;
      if (mv) { const k = f.u / P.duty; bob = Math.max(bob, Math.sin(Math.PI * Math.min(1, k))); if (k > 0.55) lifts[i] = (k - 0.55) / 0.45; t.y += 0.1 * lifts[i] * P.r + 0.04 * lifts[i]; } }
    (f.cur || (f.cur = new THREE.Vector3())).copy(t);
  }
  // pelvis drop and bob (whole body via Splitter, restored in xUbPre)
  const drop = (P.drop + P.bob * (1 - bob)) * G.w * (mv ? 1 : 0);
  if (drop > 1e-4) { G.rest.copy(G.split.position); X.ugRestore = true; const s = G.split.getWorldPosition(V[8]); s.y -= drop; G.split.parent.updateWorldMatrix(true, false); G.split.position.copy(G.split.parent.worldToLocal(s)); G.split.updateMatrixWorld(true); }
  // legs: two-bone IK onto the targets, knees toward the hips' facing; feet keep their authored rotation turned by the plant yaw
  for (let i = 0; i < 2; i++) { const L = G.legs[i], r = rest[i], t = T[i];
    const fq = xgWorldQ(L.hand, G.q[0]).clone(), turn = G.q[1].setFromAxisAngle(XUB.up || V[9].set(0, 1, 0), Math.atan2(Math.sin(yaws[i] - yawH), Math.cos(yaws[i] - yawH)));
    const goal = V[9].copy(r).lerp(t, G.w), pole = V[8].copy(fwd).addScaledVector(left, i ? -0.15 : 0.15);
    xgIK(L, goal, pole.normalize(), G.IK); const q = G.q[2].copy(turn).multiply(fq);
    if (lifts[i] > 0) q.premultiply(G.q[1].setFromAxisAngle(V[8].copy(left).multiplyScalar(-1).normalize(), (0.3 + 0.35 * P.r) * lifts[i] * G.w)); // heel-off
    xgSetWorldQ(L.hand, q);
  }
  M.m.updateMatrixWorld(true);
}
{ const pre = xUbPre; xUbPre = function (M) { const X = M && M.sx; if (X && X.ugRestore && X.ug && X.ug.split) { X.ug.split.position.copy(X.ug.rest); X.ugRestore = false; } return pre.apply(this, arguments); }; }
{ const post = xUbPost; xUbPost = function (M) { post.apply(this, arguments); if (!M || !M.valorant || !M.sx || M.dead) return; try { xUgPose(M, M.sx.poseDt || 0); } catch (e) { if (!XUG.err) { XUG.err = 1; console.warn('procedural gait disabled for a frame', e); } } }; }
function xUgOn(M) { const X = M && M.sx; if (!X || !M.valorant) return false; const G = X.ug || xUgSetup(M); return !!G.ok; }
// ---- END XUG ----
{ const pre = xUbPre; xUbPre = function (M) { const X = M && M.sx; if (X && X.ftRestore && X.ft && X.ft.split) { X.ft.split.position.copy(X.ft.rest); X.ftRestore = false; } return pre.apply(this, arguments); }; }
{ const post = xUbPost; xUbPost = function (M) { post.apply(this, arguments); if (!M || !M.valorant || !M.sx || M.dead) return; try { const C = typeof nmActive === 'function' && nmActive(); if (!C || !C.bvh) return;
    let cam = null; try { cam = camera; } catch (e) {} if (cam) { const c = XFT.cam || (XFT.cam = new THREE.Vector3()); cam.getWorldPosition(c); M.m.getWorldPosition(XFT.p || (XFT.p = new THREE.Vector3())); if (XFT.p.distanceTo(c) > XFT.lod) { if (M.sx.ft) M.sx.ft.d[0] = M.sx.ft.d[1] = 0; return; } }
    xfPose(M, M.sx.poseDt || 0, C); } catch (e) { if (!XFT.err++) console.warn('foot planting disabled for a frame', e); } }; }
// Breach's shoe vertices are skinned to L_/R_IK_FootTarget (children of Root, not of the leg), which no locomotion clip
// moves: whenever a foot left its bind spot the shoe stretched back to it in a long flat plate (every stride, crouch and
// jump). After every leg pass (clips, crouch IK, gait, foot planting, deaths) such a target takes its foot's world transform
// times their bind offset, so the shoe rides the foot. Other agents skin the shoe to the foot itself (no target: skipped).
function xFtTargets(M) {
  const X = M && M.sx; if (!X || !X.sc) return null; if (X.ikT !== undefined) return X.ikT; X.ikT = null; const out = [];
  X.sc.traverse((o) => { if (!o.isSkinnedMesh) return; const sk = o.skeleton; for (const s of ['L', 'R']) { const ti = sk.bones.findIndex((b) => b.name === s + '_IK_FootTarget'), fi = sk.bones.findIndex((b) => b.name === s + '_Foot');
    if (ti < 0 || fi < 0 || out.some((e) => e.t === sk.bones[ti])) continue;
    const rel = sk.boneInverses[fi].clone().multiply(sk.boneInverses[ti].clone().invert()); out.push({ t: sk.bones[ti], f: sk.bones[fi], rel }); } });
  if (out.length) X.ikT = { list: out, m: new THREE.Matrix4(), p: new THREE.Matrix4() }; return X.ikT;
}
function xFtFollow(M) { const I = xFtTargets(M); if (!I) return; for (const e of I.list) { e.f.updateWorldMatrix(true, false); I.m.multiplyMatrices(e.f.matrixWorld, e.rel); e.t.parent.updateWorldMatrix(true, false); I.p.copy(e.t.parent.matrixWorld).invert().multiply(I.m); I.p.decompose(e.t.position, e.t.quaternion, e.t.scale); e.t.updateMatrixWorld(true); } }
{ const post = xUbPost; xUbPost = function (M) { post.apply(this, arguments); try { xFtFollow(M); } catch (e) {} }; }
{ const dead = xUbDead; xUbDead = function (M) { const r = dead.apply(this, arguments); try { xFtFollow(M); } catch (e) {} return r; }; }
// ---- END FOOT PLANTING ----
