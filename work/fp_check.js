// first-person arms check (real three r149 + the game's own agent + FIRST-PERSON ARMS code via agent_rt.js, models/agent_m|f.glb):
// for every weapon + the knife, for a male and a female agent: the rig is arm/hand triangles only, each wrist lands on its grip target,
// no on-screen skinned triangle is stretched (max edge vs bind), every vertex stays near the camera, fingers curl, materials take the agent's Suit / Gloves colours,
// the right arm follows a cast pose, reload moves the left hand, and the primitive arms are hidden while the rig is on.
const { T, X, ctx, parse } = require('./agent_rt.js'), path = require('path'), fs = require('fs'), vm = require('vm');
const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
(async () => {
  const D = path.join(__dirname, '../models') + '/', err = []; const info = { weapons: 0, tris: {}, maxEdge: 0, maxWrist: 0 };
  X.XUB.src = { m: await parse(D + 'agent_m.glb'), f: await parse(D + 'agent_f.glb'), a: await parse(D + 'agent_anims.glb') }; X.xUbReady();
  const a = html.indexOf('// ---- FIRST-PERSON ARMS'), b = html.indexOf('// ---- end FIRST-PERSON ARMS'); if (a < 0 || b < 0) throw new Error('FIRST-PERSON ARMS block markers missing');
  const stub = 'var VMP = ' + (html.match(/var VMP = (\{[^}]*\})/) || [0, '{ x: 0.25, y: -0.235, z: -0.47 }'])[1] + '; var camera = new THREE.PerspectiveCamera(75, 16 / 9, 0.05, 200), scene = new THREE.Scene(); scene.add(camera);\n' +
    'var gun = new THREE.Group(); gun.position.set(VMP.x, VMP.y, VMP.z); gun.rotation.y = VMP.ry || 0; gun.scale.setScalar(VMP.s || 0.85); camera.add(gun); var knife = new THREE.Group(); knife.position.set(0.23, -0.2, -0.38); knife.rotation.set(0.15, 0.25, 0); knife.visible = false; camera.add(knife);\n' +
    'var VMA = { R: new THREE.Group(), L: new THREE.Group() }, KARM = new THREE.Group(), XCA = { h: null, gl: null, on: false }, running = true, player = { hp: 100 }, reloading = 0, du = {}, OP_RELOAD = 3, XRP = undefined, BC = { vm: "" }, W_ = "Vandal", J = { pick: "Jett" };\n' +
    ' function wName() { return W_; } function xRT() { return 2.5; } var XGM = { rdy: true }; var vmTick = function () {};\n';
  vm.runInContext(stub + html.slice(a, b) + '\nthis.__f = { VMP, FPA, FPG, fpaTick, fpaReady, setW: (w) => { W_ = w; }, setR: (r) => { reloading = r; }, cam: camera, XSA, gun, knife, VMA, KARM, XCA, J, set kn(v) { knife.visible = v; gun.visible = !v; } };', ctx, { filename: 'fpa.js' });
  const F = ctx.__f;
  if (!F.fpaReady()) throw new Error('rig did not build: ' + F.FPA.err);
  const V = new T.Vector3(), V2 = new T.Vector3();
  const meshes = (k) => { const o = []; F.FPA.R[k].sc.traverse((m) => { if (m.isMesh) o.push(m); }); return o; };
  for (const k of ['m', 'f']) { const ms = meshes(k), names = ms.map((m) => (m.material === F.FPA.M.suit ? 'Suit' : m.material === F.FPA.M.glove ? 'Gloves' : '?')).sort().join(',');
    if (names !== 'Gloves,Suit') err.push(k + ': rig meshes ' + names + ' (want Suit + Gloves only)'); info.tris[k] = F.FPA.R[k].tris; if (!(F.FPA.R[k].tris > 800 && F.FPA.R[k].tris < 8000)) err.push(k + ': ' + F.FPA.R[k].tris + ' arm triangles');
    ms.forEach((m) => { const s = new Set(); const bn = m.skeleton.bones, W = m.geometry.attributes.skinWeight, I = m.geometry.attributes.skinIndex; const ix = m.geometry.index, us = new Set(); for (let i = 0; i < ix.count; i++) us.add(ix.getX(i)); for (const i of us) for (let j = 0; j < 4; j++) if (ctx.FPA_GC(W, i, j) > 0) { const q = bn[ctx.FPA_GC(I, i, j)]; s.add(q ? q.name : 'bad index'); }
      [...s].forEach((n) => { if (!/^(upperarm|lowerarm|hand|thumb|index|middle|ring|pinky)_/.test(n)) err.push(k + ': vertex weighted to ' + n); }); }); }
  const check = (lbl, k, wantL) => {
    F.cam.updateMatrixWorld(true); const R = F.FPA.R[k]; R.sc.updateMatrixWorld(true);
    let me = 0, far = 0, be = 0; for (const m of meshes(k)) { { const P = m.geometry.attributes.position, ix = m.geometry.index, A = new T.Vector3(), B2 = new T.Vector3(); for (let t = 0; t < ix.count; t += 3) for (let q = 0; q < 3; q++) { A.fromBufferAttribute(P, ix.getX(t + q)); B2.fromBufferAttribute(P, ix.getX(t + (q + 1) % 3)); be = Math.max(be, A.distanceTo(B2) * F.gun.scale.x); } } const P = m.geometry.attributes.position, ix = m.geometry.index, sk = new Array(P.count); const used = new Set(); for (let i = 0; i < ix.count; i++) used.add(ix.getX(i));
      for (const i of used) { V.fromBufferAttribute(P, i); m.boneTransform(i, V); V.applyMatrix4(m.matrixWorld); sk[i] = V.clone(); if (V.length() > 1.3) far++; }
      for (let t = 0; t < ix.count; t += 3) { const p = [ix.getX(t), ix.getX(t + 1), ix.getX(t + 2)].map((i) => sk[i]), c = p[0].clone().add(p[1]).add(p[2]).multiplyScalar(1 / 3).project(F.cam); if (c.z > 1 || Math.abs(c.x) > 1.05 || Math.abs(c.y) > 1.05) continue; for (let q = 0; q < 3; q++) me = Math.max(me, p[q].distanceTo(p[(q + 1) % 3])); } } // on-screen triangles only (the bent elbow sits below the frame)
    info.maxEdge = Math.max(info.maxEdge, me); if (me > be * 1.35) err.push(lbl + ': stretched triangle, edge ' + me.toFixed(3) + ' m (bind max ' + be.toFixed(3) + ')'); info.bindEdge = +be.toFixed(3); if (far) err.push(lbl + ': ' + far + ' vertices > 1.3 m from the camera');
    const sides = wantL ? ['r', 'l'] : ['r'];
    for (const s of sides) { const h = R[s].h; h.getWorldPosition(V); const c = R[s].fn[2][0].b.quaternion.angleTo(R[s].fn[2][0].q0); if (c < 0.3) err.push(lbl + ' ' + s + ': middle finger not curled'); if (V.length() > 0.9) err.push(lbl + ' ' + s + ': hand ' + V.length().toFixed(2) + ' m from the camera'); }
    if (!wantL && R.l.u.scale.x > 0.01) err.push(lbl + ': left arm not folded away for the knife');
  };
  const wrist = (lbl, k, s, tgt) => { F.cam.updateMatrixWorld(true); F.FPA.R[k].sc.updateMatrixWorld(true); F.FPA.R[k][s].h.getWorldPosition(V); const d = V.distanceTo(tgt); info.maxWrist = Math.max(info.maxWrist, d); if (d > 0.002) err.push(lbl + ' ' + s + ': wrist ' + (d * 1000).toFixed(1) + ' mm off its grip target'); };
  for (const [ag, k] of [['Jett', 'f'], ['Phoenix', 'm']]) {
    F.J.pick = ag;
    for (const w of Object.keys(F.FPG)) { F.setW(w); F.kn = false; F.fpaTick(); info.weapons++;
      if (!F.FPA.on || !F.FPA.g.visible || F.FPA.k !== k) { err.push(ag + ' ' + w + ': rig not on / wrong body'); continue; }
      if (F.VMA.R.visible || F.VMA.L.visible) err.push(w + ': primitive arms still visible');
      // targets recomputed independently from the table: gun-local grip -> camera -> world
      F.cam.updateMatrixWorld(true);
      const g = F.FPG[w], gr = ctx.fpaGrip(w, 'r', null), gl = ctx.fpaGrip(w, 'l', null);
      wrist(ag + ' ' + w, k, 'r', gr.W.clone().applyMatrix4(F.gun.matrixWorld)); wrist(ag + ' ' + w, k, 'l', gl.W.clone().applyMatrix4(F.gun.matrixWorld));
      const Rg = new T.Vector3(0, g[1], g[0]).applyMatrix4(F.gun.matrixWorld); F.FPA.R[k].r.h.getWorldPosition(V); if (V.distanceTo(Rg) > 0.16) err.push(w + ': right wrist ' + V.distanceTo(Rg).toFixed(2) + ' m from the grip');
      check(ag + ' ' + w, k, true);
    }
    F.kn = true; F.fpaTick(); check(ag + ' knife', k, false); F.kn = false;
    if (k === 'f') { const M = F.FPA.M, S = F.XSA[ag]; const GL = ctx.FPA_GL, gs = new T.Color(S.b).multiplyScalar(GL[2]), gg = new T.Color(S.d).lerp(new T.Color(GL[0]), GL[1]); if (M.U.fpSuit.value.getHex() !== gs.getHex() || M.U.fpGlove.value.getHex() !== gg.getHex()) err.push(ag + ': sleeve / glove not the agent Suit / Gloves colours (toned)'); if (gg.r + gg.g + gg.b > 0.9) err.push(ag + ': glove too light'); if (!(M.suit.isMeshStandardMaterial && M.glove.isMeshStandardMaterial)) err.push('arm materials not PBR'); }
  }
  { // reload: left hand leaves the handguard mid-reload and is back at the end
    F.setW('Vandal'); F.setR(0); F.fpaTick(); F.FPA.R.m.l.h.getWorldPosition(V); const v0 = V.clone(); F.setR(2.5 * (1 - 0.35)); F.fpaTick(); F.FPA.R.m.l.h.getWorldPosition(V2);
    if (V2.distanceTo(v0) < 0.08) err.push('reload: left hand stays on the handguard (' + V2.distanceTo(v0).toFixed(3) + ' m)'); F.setR(0); F.fpaTick(); }
  { // reload in frame: gun posed like vmTick (VMP + per-class vmOff + the game's own XTR reload track), the left wrist stays inside the frame through the mag swap
    const a2 = html.indexOf('const XEase'), b2 = html.indexOf('// named sub-meshes'); if (a2 < 0 || b2 < a2) throw new Error('XTR reload tracks not found');
    vm.runInContext(html.slice(a2, b2) + '\nthis.__t = { XTR, xKf, vmOff };', ctx, { filename: 'xtr.js' }); const { XTR, xKf, vmOff } = ctx.__t, k0 = F.FPA.k;
    ctx.XRP = { Classic: { cls: 'pistol' }, Sheriff: { cls: 'sheriff' }, Vandal: { cls: 'rifle' } }; info.rld = {};
    const po = vmOff('Classic'), ro = vmOff('Vandal'); info.pisOff = [po.x, po.y]; if (!(po.x - ro.x >= 0.03 && po.y - ro.y <= -0.02)) err.push('sidearm rest not lower-right of the rifle rest');
    for (const w of ['Vandal', 'Classic']) { F.setW(w); const cls = ctx.XRP[w].cls, vo = vmOff(w); let lo = 9, xm = 0;
      for (let rp = 0.1; rp <= 0.9001; rp += 0.05) { const q = xKf(XTR[cls].gun, rp);
        F.gun.position.set(F.VMP.x + vo.x + q.pos[0], F.VMP.y + vo.y + q.pos[1], F.VMP.z + vo.z + q.pos[2]); F.gun.rotation.set(q.rot[0], (F.VMP.ry || 0) + vo.ry + q.rot[1], q.rot[2]);
        F.setR(2.5 * (1 - rp)); F.fpaTick(); F.cam.updateMatrixWorld(true); F.FPA.R[k0].sc.updateMatrixWorld(true); F.FPA.R[k0].l.h.getWorldPosition(V); V.project(F.cam); lo = Math.min(lo, V.y); xm = Math.max(xm, Math.abs(V.x)); }
      info.rld[w] = [+lo.toFixed(3), +xm.toFixed(3)]; if (lo < -0.9 || xm > 0.95) err.push('reload ' + w + ': left wrist leaves the frame (min ndc y ' + lo.toFixed(2) + ', max |x| ' + xm.toFixed(2) + ')'); }
    F.gun.position.set(F.VMP.x, F.VMP.y, F.VMP.z); F.gun.rotation.set(0, F.VMP.ry || 0, 0); F.setR(0); ctx.XRP = undefined; F.setW('Vandal'); F.fpaTick(); }
  { // cast: right hand follows the XCA hand pose
    const h = new T.Group(); h.position.set(0.2, -0.12, -0.62); h.rotation.set(-1.4, 0, 0.3); h.add(new T.Mesh(new T.BoxGeometry(0.08, 0.07, 0.1))); F.cam.add(h); F.XCA.h = h; F.XCA.on = true; h.visible = true; F.fpaTick();
    F.cam.updateMatrixWorld(true); const t = new T.Vector3(0, -0.05, 0).applyQuaternion(h.quaternion).add(h.position).applyMatrix4(F.cam.matrixWorld); wrist('cast', 'm', 'r', t); if (h.children[0].visible) err.push('cast: primitive hand still visible'); F.XCA.on = false; h.visible = false; F.fpaTick(); }
  console.log(JSON.stringify({ ok: !err.length, info, err: err.slice(0, 12) }));
})().catch((e) => { console.log(JSON.stringify({ ok: false, err: ['threw: ' + String(e && e.stack || e).slice(0, 300)] })); });
