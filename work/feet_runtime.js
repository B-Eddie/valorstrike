// ---- FOOT PLANTING ----
// Feet on terrain (ledger row 6). Native locomotion clips are authored on flat ground, so on stairs, slopes and
// ledges one foot floated or sank. After the mixer (and the grip), each foot of a nearby third-person agent probes
// the native collision mesh under it; the whole body (Splitter: legs and torso together) drops to the lower foot and
// the other leg is bent with two-bone IK onto its own floor, keeping the foot's authored rotation. Offsets are
// smoothed, clamped to a stair rise, skipped in the air, for the dead and beyond 22 m, and undone before the mixer.
var XFT = { max: 0.42, lod: 22, rate: 14, err: 0, ray: null, cam: null };
// Floor probe: straight down from half a metre over the foot; a face too steep to stand on (wall, ledge lip) is passed through
// 5 mm under the hit and the cast repeated, up to 8 casts. The casts are an allocation-free port of
// MeshBVH.raycastFirst(ray, DoubleSide) (vendor/three-mesh-bvh.umd.js, three r149 Ray.intersectBox / intersectTriangle /
// Triangle.getNormal) for this one ray direction (0, -1, 0): the same traversal order and tie-breaks and the same float
// operations in the same order on the raw position / index arrays, so every probe answers exactly as the library did
// (work/test_feet_perf.cjs checks bit for bit on all six maps). The library built a hit object per candidate triangle plus
// three typed-array views and closures per root per cast (~6 KB per agent per frame). A bvh whose buffers the port cannot
// read (stand-in test bvhs, interleaved / normalised positions) takes the library's raycastFirst.
var XFR = { V: new WeakMap(), D: new Float64Array(32), T: new Int32Array(32), P: new Float64Array(96), n: 0, ox: 0, oy: 0, oz: 0, ia: null, pa: null, f: null, u16: null, u32: null, py: 0, ny: 0 };
function xfViews(bvh) {
  let v = XFR.V.get(bvh); if (v && v.r === bvh._roots) return v;
  const g = bvh.geometry, P = g && g.attributes && g.attributes.position, I = g && g.index, R = bvh._roots;
  v = { r: R, f: [], u16: [], u32: [], ok: !!(R && P && I && !P.isInterleavedBufferAttribute && !P.normalized && P.itemSize === 3 && I.itemSize === 1 && P.array && I.array && !g.attributes.uv && !bvh._indirectBuffer) };
  if (v.ok) for (let i = 0; i < R.length; i++) { v.f.push(new Float32Array(R[i])); v.u16.push(new Uint16Array(R[i])); v.u32.push(new Uint32Array(R[i])); }
  XFR.V.set(bvh, v); return v;
}
function xfSlot() { const n = XFR.n++; if (n >= XFR.D.length) { const k = XFR.D.length * 2, D = new Float64Array(k), T = new Int32Array(k), P = new Float64Array(k * 3); D.set(XFR.D); T.set(XFR.T); P.set(XFR.P); XFR.D = D; XFR.T = T; XFR.P = P; } return n; }
// intersectClosestTri: Ray.intersectTriangle(a, b, c, false, point) for each triangle of the leaf, distance = origin.distanceTo(point)
function xfLeaf(off, cnt) {
  const ia = XFR.ia, pa = XFR.pa, ox = XFR.ox, oy = XFR.oy, oz = XFR.oz, dx = 0, dy = -1, dz = 0; let best = -1, dist = Infinity;
  for (let i = off, e = off + cnt; i < e; i++) {
    const A = ia[i * 3] * 3, B = ia[i * 3 + 1] * 3, Cc = ia[i * 3 + 2] * 3, ax = pa[A], ay = pa[A + 1], az = pa[A + 2];
    const e1x = pa[B] - ax, e1y = pa[B + 1] - ay, e1z = pa[B + 2] - az, e2x = pa[Cc] - ax, e2y = pa[Cc + 1] - ay, e2z = pa[Cc + 2] - az;
    const nx = e1y * e2z - e1z * e2y, ny = e1z * e2x - e1x * e2z, nz = e1x * e2y - e1y * e2x;
    let DdN = dx * nx + dy * ny + dz * nz, sg; if (DdN > 0) sg = 1; else if (DdN < 0) { sg = -1; DdN = -DdN; } else continue;
    const qx = ox - ax, qy = oy - ay, qz = oz - az;
    const o1 = sg * (dx * (qy * e2z - qz * e2y) + dy * (qz * e2x - qx * e2z) + dz * (qx * e2y - qy * e2x)); if (o1 < 0) continue;
    const l1 = sg * (dx * (e1y * qz - e1z * qy) + dy * (e1z * qx - e1x * qz) + dz * (e1x * qy - e1y * qx)); if (l1 < 0) continue; if (o1 + l1 > DdN) continue;
    const QdN = -sg * (qx * nx + qy * ny + qz * nz); if (QdN < 0) continue;
    const t = QdN / DdN, px = dx * t + ox, py = dy * t + oy, pz = dz * t + oz, ex = ox - px, ey = oy - py, ez = oz - pz, d = Math.sqrt(ex * ex + ey * ey + ez * ez);
    if (d < dist) { if (best < 0) best = xfSlot(); dist = d; XFR.D[best] = d; XFR.T[best] = i; XFR.P[best * 3] = px; XFR.P[best * 3 + 1] = py; XFR.P[best * 3 + 2] = pz; }
  }
  return best;
}
// Ray.intersectBox(box) !== null for direction (0, -1, 0): 1 / direction = (+Infinity, -1, +Infinity), NaN handling as three's
function xfBox(n) {
  const f = XFR.f, ox = XFR.ox, oy = XFR.oy, oz = XFR.oz, l = Infinity, c = -1, h = Infinity; let i, m, r, s, a, o;
  i = (f[n] - ox) * l; m = (f[n + 3] - ox) * l;
  r = (f[n + 4] - oy) * c; s = (f[n + 1] - oy) * c;
  if (i > s || r > m) return false; if (r > i || isNaN(i)) i = r; if (s < m || isNaN(m)) m = s;
  a = (f[n + 2] - oz) * h; o = (f[n + 5] - oz) * h;
  if (i > o || a > m) return false; if (a > i || i != i) i = a; if (o < m || m != m) m = o; return !(m < 0);
}
// raycastFirst(node): nearer child first (split axis direction >= 0: x and z left to right, y right to left), skip the far child
// when the near hit is outside it, ties to the near child
function xfNode(n32) {
  const n16 = n32 * 2, u16 = XFR.u16, u32 = XFR.u32, f = XFR.f; if (u16[n16 + 15] === 0xFFFF) return xfLeaf(u32[n32 + 6], u16[n16 + 14]);
  const ax = u32[n32 + 7], l2r = ax !== 1, c1 = l2r ? n32 + 8 : u32[n32 + 6], c2 = l2r ? u32[n32 + 6] : n32 + 8;
  const r1 = xfBox(c1) ? xfNode(c1) : -1;
  if (r1 >= 0) { const p = XFR.P[r1 * 3 + ax]; if (l2r ? p <= f[c2 + ax] : p >= f[c2 + ax + 3]) return r1; }
  const r2 = xfBox(c2) ? xfNode(c2) : -1;
  if (r1 >= 0 && r2 >= 0) return XFR.D[r1] <= XFR.D[r2] ? r1 : r2; return r1 >= 0 ? r1 : r2;
}
// One cast from (XFR.ox, XFR.oy, XFR.oz) straight down (passed in XFR: float arguments and results of a call that is not
// inlined are boxed): true on a hit, with XFR.py = hit.point.y and XFR.ny = hit.face.normal.y
function xfCast(bvh, v) {
  const g = bvh.geometry, ia = g.index.array, pa = g.attributes.position.array; XFR.ia = ia; XFR.pa = pa;
  let bd = Infinity, bt = -1, by = 0;
  for (let r = 0; r < v.f.length; r++) { XFR.n = 0; XFR.f = v.f[r]; XFR.u16 = v.u16[r]; XFR.u32 = v.u32[r]; const s = xfNode(0); if (s >= 0 && (bt < 0 || XFR.D[s] < bd)) { bd = XFR.D[s]; bt = XFR.T[s]; by = XFR.P[s * 3 + 1]; } }
  XFR.ia = XFR.pa = XFR.f = XFR.u16 = XFR.u32 = null; if (bt < 0) return false;
  // Triangle.getNormal(a, b, c): (c - b) x (a - b), normalised; only y is read
  const a3 = ia[bt * 3] * 3, b3 = ia[bt * 3 + 1] * 3, c3 = ia[bt * 3 + 2] * 3, ux = pa[c3] - pa[b3], uy = pa[c3 + 1] - pa[b3 + 1], uz = pa[c3 + 2] - pa[b3 + 2], wx = pa[a3] - pa[b3], wy = pa[a3 + 1] - pa[b3 + 1], wz = pa[a3 + 2] - pa[b3 + 2];
  const nx = uy * wz - uz * wy, ny = uz * wx - ux * wz, nz = ux * wy - uy * wx, L = nx * nx + ny * ny + nz * nz;
  XFR.py = by; XFR.ny = L > 0 ? ny * (1 / Math.sqrt(L)) : 0; return true;
}
function xfGround(C, x, z, y0) {
  const v = C.bvh._roots ? xfViews(C.bvh) : null;
  if (!v || !v.ok) {
    const R = XFT.ray || (XFT.ray = new THREE.Ray(new THREE.Vector3(), new THREE.Vector3(0, -1, 0))); R.origin.set(x, y0 + XFT.max + 0.08, z);
    for (let k = 0; k < 8; k++) { const hit = C.bvh.raycastFirst(R, THREE.DoubleSide); if (!hit) return null; if (hit.face && hit.face.normal.y > 0.45) return hit.point.y; R.origin.y = hit.point.y - 0.005; if (R.origin.y < y0 - XFT.max - 0.1) return null; }
    return null;
  }
  XFR.ox = x; XFR.oz = z; XFR.oy = y0 + XFT.max + 0.08;
  for (let k = 0; k < 8; k++) { if (!xfCast(C.bvh, v)) return null; if (XFR.ny > 0.45) return XFR.py; XFR.oy = XFR.py - 0.005; if (XFR.oy < y0 - XFT.max - 0.1) return null; }
  return null;
}
function xfSetup(M) {
  const X = M.sx, b = (n) => X.sc.getObjectByName(n), F = { ok: false, d: [0, 0], p: 0 }; X.ft = F;
  F.split = b('Splitter'); F.legs = ['L', 'R'].map((s) => ({ up: b(s + '_Hip'), lo: b(s + '_Knee'), hand: b(s + '_Foot') }));
  if (!F.split || F.legs.some((L) => !L.up || !L.lo || !L.hand)) return F;
  let i = 0; for (const L of F.legs) for (const bn of [L.up, L.lo, L.hand]) { const key = 'ft' + i++; X.b[key] = bn; if (X.sv) { X.sv[key] = bn.quaternion.clone(); X.svOn[key] = 1; } }
  F.rest = new THREE.Vector3(); F.v = Array.from({ length: 6 }, () => new THREE.Vector3()); F.q = new THREE.Quaternion();
  F.G = { ik: Array.from({ length: 9 }, () => new THREE.Vector3()), q: Array.from({ length: 2 }, () => new THREE.Quaternion()) }; F.ch = []; F.up = []; F.chN = 0; F.ok = true; return F;
}
// World position of foot i for the floor probe. Foot 0: Object3D.getWorldPosition (refreshes its whole parent chain). Foot 1,
// probed right after with nothing moved in between: only the part of its chain foot 0's refresh did not cover is refreshed,
// node for node as updateWorldMatrix(true, false) does it (same matrices, same flags); recomputing the shared ancestors
// gave the same numbers again.
function xfFootPos(F, i, out) {
  // chains in reused arrays with their own counts (resetting .length dropped the backing store: ~300 B per call)
  const o = F.legs[i].hand, ch = F.ch || (F.ch = []), up = F.up || (F.up = []); let n = o, c = 0;
  if (i === 0) { ch[c++] = n; while (n.parent !== null && n.parent.matrixWorldAutoUpdate === true) { n = n.parent; ch[c++] = n; } F.chN = c; return o.getWorldPosition(out); }
  up[c++] = n; for (;;) { const p = n.parent; if (p === null || p.matrixWorldAutoUpdate !== true) break; let seen = false; for (let j = 0; j < F.chN; j++) if (ch[j] === p) { seen = true; break; } if (seen) break; n = p; up[c++] = n; }
  for (let j = c - 1; j >= 0; j--) { const b = up[j]; if (b.matrixAutoUpdate) b.updateMatrix(); if (b.parent === null) b.matrixWorld.copy(b.matrix); else b.matrixWorld.multiplyMatrices(b.parent.matrixWorld, b.matrix); }
  return out.setFromMatrixPosition(o.matrixWorld);
}
function xfPose(M, dt, C) {
  const X = M.sx; if (!X || !X.sc || !M.valorant || M.dead || X.dd) return; const F = X.ft || xfSetup(M); if (!F.ok) return;
  const V = F.v, root = M.m.getWorldPosition(V[0]), y0 = root.y, k = 1 - Math.exp(-Math.max(0, dt) * XFT.rate);
  for (let i = 0; i < 2; i++) { let d = 0; if (!X.air) { const f = xfFootPos(F, i, V[1]), g = xfGround(C, f.x, f.z, y0); if (g != null && Number.isFinite(g)) d = Math.max(-XFT.max, Math.min(XFT.max, g - y0)); } F.d[i] += (d - F.d[i]) * k; }
  const p = Math.min(0, F.d[0], F.d[1]); F.p = p; if (Math.abs(F.d[0]) < 0.004 && Math.abs(F.d[1]) < 0.004) return;
  // body down to the lower foot (vertical, in world), restored in xUbPre
  F.rest.copy(F.split.position); X.ftRestore = true; const s = F.split.getWorldPosition(V[2]); s.y += p; if (F.split.parent.matrixWorldAutoUpdate !== true) F.split.parent.updateWorldMatrix(true, false); /* else just refreshed by getWorldPosition */ F.split.position.copy(F.split.parent.worldToLocal(s)); F.split.updateMatrixWorld(true);
  for (let i = 0; i < 2; i++) { const L = F.legs[i], lift = F.d[i] - p; if (lift < 0.004) continue;
    // hip / knee / foot matrices are current: split.updateMatrixWorld(true) above, and the other leg's IK only moves its own bones
    const hip = V[3].setFromMatrixPosition(L.up.matrixWorld), knee = V[4].setFromMatrixPosition(L.lo.matrixWorld), foot = V[5].setFromMatrixPosition(L.hand.matrixWorld), fq = xgWorldQ(L.hand, F.q);
    const dir = V[2].subVectors(foot, hip).normalize(), pole = knee.sub(hip); pole.addScaledVector(dir, -pole.dot(dir)); if (pole.lengthSq() < 1e-8) pole.copy(M.m.getWorldDirection(V[2]));
    const target = (F.t || (F.t = new THREE.Vector3())).copy(foot); target.y += lift; xgIK(L, target, pole.normalize(), F.G); xgSetWorldQ(L.hand, fq);
  }
}
{ const pre = xUbPre; xUbPre = function (M) { const X = M && M.sx; if (X && X.ftRestore && X.ft && X.ft.split) { X.ft.split.position.copy(X.ft.rest); X.ftRestore = false; } return pre.apply(this, arguments); }; }
{ const post = xUbPost; xUbPost = function (M) { post.apply(this, arguments); if (!M || !M.valorant || !M.sx || M.dead) return; try { const C = typeof nmActive === 'function' && nmActive(); if (!C || !C.bvh) return;
    let cam = null; try { cam = camera; } catch (e) {} if (cam) { const c = XFT.cam || (XFT.cam = new THREE.Vector3()); cam.getWorldPosition(c); M.m.getWorldPosition(XFT.p || (XFT.p = new THREE.Vector3())); if (XFT.p.distanceTo(c) > XFT.lod) { if (M.sx.ft) M.sx.ft.d[0] = M.sx.ft.d[1] = 0; return; } }
    xfPose(M, M.sx.poseDt || 0, C); } catch (e) { if (!XFT.err++) console.warn('foot planting disabled for a frame', e); } }; }
// ---- END FOOT PLANTING ----
