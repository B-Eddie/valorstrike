// boots / robe check (real three r149 + the game's own agent code via agent_rt.js): every vertex of the base bodies' bare-foot "Boots" mesh
// (toes included) must sit inside a procedural boot part, in idle and mid-run poses; the Boots mesh is dropped; boot geometry shared; Sage robe panels have a material
const { T, X, parse } = require('./agent_rt.js'), path = require('path');
(async () => {
  const D = path.join(__dirname, '../models') + '/', err = []; let pts = 0, out = 0;
  X.XUB.src = { m: await parse(D + 'agent_m.glb'), f: await parse(D + 'agent_f.glb'), a: await parse(D + 'agent_anims.glb') }; X.xUbReady();
  const bootIdx = {}; for (const k of ['m', 'f']) X.XUB.src[k].scene.traverse((o) => { if (o.isSkinnedMesh && o.material && o.material.name === 'Boots') { const s = new Set(), gi = o.geometry.index; for (let i = 0; i < gi.count; i++) s.add(gi.getX(i)); bootIdx[k] = [...s]; } });
  if (!bootIdx.m || !bootIdx.f) err.push('Boots mesh not found in source bodies');
  const geos = new Set();
  for (const nm of ['Jett', 'Phoenix', 'Sage', 'Breach']) {
    const m = new T.Group(), gun = new T.Group(); m.add(gun); const M = { m, gun, ring: null, mats: [], nm, rim: 0xff4655, w: 'Vandal' }; X.xSol(M);
    const b = { g: new T.Group(), hp: 100, head: { position: { y: 1.75 } }, cr: false, name: nm }; b.g.add(m); const sc = M.sx.sc, k = { Jett: 'f', Phoenix: 'm', Sage: 'f', Breach: 'm' }[nm];
    let carrier = null; sc.traverse((o) => { if (o.isMesh && o.visible && o.material && o.material.name === 'Boots') err.push(nm + ': bare-foot Boots mesh still shown'); if (o.isSkinnedMesh && o.material && o.material.name === 'Pants') carrier = o; });
    const parts = []; ['foot_l', 'foot_r', 'ball_l', 'ball_r'].forEach((n) => { const bn = sc.getObjectByName(n), ps = []; bn && bn.traverse((o) => { if (o.isMesh && o.material && o.material.color) { ps.push(o); if (o.geometry.type !== 'CylinderGeometry') geos.add(o.geometry.uuid); } }); if (ps.length < (n[0] === 'f' ? 3 : 2)) err.push(nm + ': ' + n + ' has ' + ps.length + ' boot parts'); parts.push(...ps); });
    M.xAt.forEach((g) => g.traverse((o) => { if (o.isMesh && (!o.material || (Array.isArray(o.material)))) err.push(nm + ': accessory mesh without a material'); }));
    if (nm === 'Sage') { let pn = 0; M.xAt.forEach((g) => g.traverse((o) => { if (o.isMesh && o.geometry.type === 'PlaneGeometry') { pn++; if (!o.material || !o.material.color || o.material.color.getHex() !== 0x2bb5a5) err.push('Sage robe panel colour'); } })); if (pn !== 4) err.push('Sage robe panels: ' + pn); }
    if (!carrier || !bootIdx[k]) { err.push(nm + ': no Pants carrier'); continue; }
    const test = (lbl) => { m.updateMatrixWorld(true); b.g.updateMatrixWorld(true); const v = new T.Vector3(), w = new T.Vector3(), inv = parts.map((p) => { p.geometry.computeBoundingBox(); return [new T.Matrix4().copy(p.matrixWorld).invert(), p.geometry.boundingBox.clone().expandByScalar(0.004)]; });
      let bad = 0; for (const i of bootIdx[k]) { v.fromBufferAttribute(carrier.geometry.attributes.position, i); carrier.boneTransform(i, v); v.applyMatrix4(carrier.matrixWorld); pts++;
        if (!inv.some(([mi, bb]) => bb.containsPoint(w.copy(v).applyMatrix4(mi)))) bad++; }
      out += bad; if (bad) err.push(nm + ' ' + lbl + ': ' + bad + '/' + bootIdx[k].length + ' foot vertices outside the boots'); };
    const run = (n, sp, mv) => { for (let i = 0; i < n; i++) { if (mv) b.g.position.z += sp / 30; X.xUbAnim(b, M, sp, 1 / 30); X.xUbPre(M); M.sx.mx.update(1 / 30); X.xUbPost(M); } };
    run(20, 0, false); test('idle'); run(17, 6, true); test('run');
  }
  if (geos.size !== 4) err.push('boot geometries not shared: ' + geos.size);
  console.log(JSON.stringify({ ok: !err.length, pts, out, err: err.slice(0, 12) }));
})().catch((e) => { console.log(JSON.stringify({ ok: false, err: ['threw: ' + String(e).slice(0, 200)] })); });
