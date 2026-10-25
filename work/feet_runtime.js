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
  M.m.updateWorldMatrix(true, false); const V = F.v, root = M.m.getWorldPosition(V[0]), y0 = root.y, k = Math.min(1, (dt || 1 / 60) * XFT.rate);
  for (let i = 0; i < 2; i++) { let d = 0; if (!X.air) { const f = F.legs[i].hand.getWorldPosition(V[1]), g = xfGround(C, f.x, f.z, y0); if (g != null && Number.isFinite(g)) d = Math.max(-XFT.max, Math.min(XFT.max, g - y0)); } F.d[i] += (d - F.d[i]) * k; }
  const p = Math.min(0, F.d[0], F.d[1]); F.p = p; if (Math.abs(F.d[0]) < 0.004 && Math.abs(F.d[1]) < 0.004) return;
  // body down to the lower foot (vertical, in world), restored in xUbPre
  F.rest.copy(F.split.position); X.ftRestore = true; const s = F.split.getWorldPosition(V[2]); s.y += p; F.split.parent.updateWorldMatrix(true, false); F.split.position.copy(F.split.parent.worldToLocal(s)); F.split.updateMatrixWorld(true);
  for (let i = 0; i < 2; i++) { const L = F.legs[i], lift = F.d[i] - p; if (lift < 0.004) continue;
    const hip = L.up.getWorldPosition(V[3]), knee = L.lo.getWorldPosition(V[4]), foot = L.hand.getWorldPosition(V[5]), fq = xgWorldQ(L.hand, F.q).clone();
    const dir = V[2].subVectors(foot, hip).normalize(), pole = knee.sub(hip); pole.addScaledVector(dir, -pole.dot(dir)); if (pole.lengthSq() < 1e-8) pole.copy(M.m.getWorldDirection(V[2]));
    const target = foot.clone(); target.y += lift; xgIK(L, target, pole.normalize().clone(), F.G); xgSetWorldQ(L.hand, fq);
  }
}
{ const pre = xUbPre; xUbPre = function (M) { const X = M && M.sx; if (X && X.ftRestore && X.ft && X.ft.split) { X.ft.split.position.copy(X.ft.rest); X.ftRestore = false; } return pre.apply(this, arguments); }; }
{ const post = xUbPost; xUbPost = function (M) { post.apply(this, arguments); if (!M || !M.valorant || !M.sx || M.dead) return; try { const C = typeof nmActive === 'function' && nmActive(); if (!C || !C.bvh) return;
    let cam = null; try { cam = camera; } catch (e) {} if (cam) { const c = XFT.cam || (XFT.cam = new THREE.Vector3()); cam.getWorldPosition(c); M.m.getWorldPosition(XFT.p || (XFT.p = new THREE.Vector3())); if (XFT.p.distanceTo(c) > XFT.lod) { if (M.sx.ft) M.sx.ft.d[0] = M.sx.ft.d[1] = 0; return; } }
    xfPose(M, 1 / 60, C); } catch (e) { if (!XFT.err++) console.warn('foot planting disabled for a frame', e); } }; }
// ---- END FOOT PLANTING ----
