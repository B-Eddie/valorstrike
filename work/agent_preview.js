// flat software-rendered preview of the game's own agent code (rt.js context): lineup of all 12 agents + pose sheet
const { T, X, parse } = require('./agent_rt.js'); const fs = require('fs');
const W = +(process.env.PW || 2400), H = +(process.env.PH || 1100);
const img = new Float32Array(W * H * 3), zb = new Float32Array(W * H);
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const k = y / H; img.set([0.09 + 0.05 * k, 0.1 + 0.05 * k, 0.13 + 0.06 * k], (y * W + x) * 3); }
zb.fill(-1e9);
function tri(a, b, c, col) {
  const minx = Math.max(0, Math.floor(Math.min(a.x, b.x, c.x))), maxx = Math.min(W - 1, Math.ceil(Math.max(a.x, b.x, c.x)));
  const miny = Math.max(0, Math.floor(Math.min(a.y, b.y, c.y))), maxy = Math.min(H - 1, Math.ceil(Math.max(a.y, b.y, c.y)));
  const d = (b.x - a.x) * (c.y - a.y) - (c.x - a.x) * (b.y - a.y); if (Math.abs(d) < 1e-9) return;
  for (let y = miny; y <= maxy; y++) for (let x = minx; x <= maxx; x++) {
    const w1 = ((x - a.x) * (c.y - a.y) - (c.x - a.x) * (y - a.y)) / d, w2 = ((b.x - a.x) * (y - a.y) - (x - a.x) * (b.y - a.y)) / d, w0 = 1 - w1 - w2;
    if (w0 < -1e-6 || w1 < -1e-6 || w2 < -1e-6) continue; const z = w0 * a.z + w1 * b.z + w2 * c.z, i = y * W + x; if (z <= zb[i]) continue; zb[i] = z; img.set(col, i * 3);
  }
}
const L = new T.Vector3(0.45, 0.75, 0.5).normalize(), SKIN = [0.95, 0.78, 0.66];
function draw(root, ox, oy, sc, yaw) {
  root.updateMatrixWorld(true); const R = new T.Matrix4().makeRotationY(yaw), v = new T.Vector3();
  root.traverse((o) => {
    if (!o.isMesh) return; for (let p = o; p; p = p.parent) if (!p.visible) return;
    const g = o.geometry, pos = g.attributes.position, idx = g.index, m = o.material; if (!pos || (m && m.opacity === 0)) return;
    let col = m && m.color ? m.color.toArray() : [0.5, 0.5, 0.5]; if (m && m.map) col = col.map((c, i) => c * SKIN[i]);
    const e = m && m.emissive ? m.emissive.toArray() : [0, 0, 0], basic = m && m.isMeshBasicMaterial;
    const pts = new Array(pos.count);
    for (let i = 0; i < pos.count; i++) { v.fromBufferAttribute(pos, i); if (o.isSkinnedMesh) o.boneTransform(i, v); v.applyMatrix4(o.matrixWorld).applyMatrix4(R); pts[i] = { x: ox + v.x * sc, y: oy - v.y * sc, z: v.z, p: v.clone() }; }
    const n = idx ? idx.count : pos.count, A = new T.Vector3(), B = new T.Vector3();
    for (let t = 0; t < n; t += 3) {
      const a = pts[idx ? idx.getX(t) : t], b = pts[idx ? idx.getX(t + 1) : t + 1], c = pts[idx ? idx.getX(t + 2) : t + 2];
      const nn = A.subVectors(b.p, a.p).cross(B.subVectors(c.p, a.p)).normalize(); if (nn.z < 0) nn.negate();
      const rimk = Math.pow(1 - Math.abs(nn.z), 3) * 0.35, k = basic ? 1 : 0.38 + 0.62 * Math.max(0, nn.dot(L));
      tri(a, b, c, col.map((x, i) => Math.min(1, x * k + e[i] + (basic ? 0 : rimk * [1, 0.27, 0.33][i]))));
    }
  });
}
(async () => {
  const D = require('path').join(__dirname, '../models/') + '/';
  X.XUB.src = { m: await parse(D + 'agent_m.glb'), f: await parse(D + 'agent_f.glb'), a: await parse(D + 'agent_anims.glb') }; X.xUbReady();
  const gunG = await parse(D + 'rifle_ak.glb');
  const mkM = (nm) => { const m = new T.Group(), gun = new T.Group(), g = gunG.scene.clone(); g.rotation.y = -Math.PI / 2; g.scale.setScalar(0.8 / 5.5); g.position.z = 0.0; gun.add(g); gun.rotation.y = 0; m.add(gun); return { m, gun, ring: null, mats: [], nm, rim: 0xff4655, w: 'Vandal' }; };
  const unit = (nm) => { const M = mkM(nm); X.xSol(M); const b = { g: new T.Group(), hp: 100, head: { position: { y: 1.75 } }, cr: false, name: nm }; b.g.add(M.m); return { M, b }; };
  const run = (u, n, fn, sp) => { for (let i = 0; i < n; i++) { if (fn) fn(i); u.b.sp = sp || 0; X.xUbAnim(u.b, u.M, u.b.sp, 1 / 30); X.xUbPre(u.M); u.M.sx.mx.update(1 / 30); X.xUbPost(u.M); } };
  const mode = process.env.MODE || 'lineup';
  if (mode === 'lineup') {
    const names = ['Jett', 'Phoenix', 'Sova', 'Sage', 'Reyna', 'Raze', 'Killjoy', 'Omen', 'Skye', 'Chamber', 'Breach', 'Cypher'];
    names.forEach((nm, i) => { const u = unit(nm); run(u, 20); draw(u.b.g, (i + 0.5) * W / names.length, H - 60, 520, 0.45); });
  } else {
    const P = [['idle', (u) => run(u, 20)], ['walk', (u) => run(u, 25, () => (u.b.g.position.z += 2.5 / 30), 2.5)], ['run', (u) => run(u, 20, () => (u.b.g.position.z += 6 / 30), 6)],
      ['strafe L', (u) => run(u, 25, () => (u.b.g.position.x += 4 / 30), 4)], ['backpedal', (u) => run(u, 25, () => (u.b.g.position.z -= 3 / 30), 3)], ['crouch', (u) => { u.b.cr = true; run(u, 30); }],
      ['crouch walk', (u) => { u.b.cr = true; run(u, 30, () => (u.b.g.position.z += 2 / 30), 2); }], ['reload', (u) => { u.M.sx.shots = 99; run(u, 30); }], ['cast', (u) => { u.M.xCast = 'cast'; run(u, 8); }],
      ['throw', (u) => { u.M.xCast = 'throw'; run(u, 14); }], ['fire', (u) => { run(u, 10); u.b.xsh = 1; run(u, 3); }], ['hit', (u) => { run(u, 10); u.b.hp = 40; run(u, 4); }], ['knife', (u) => { u.M.w = 'Knife'; run(u, 20); }],
      ['aim up', (u) => { u.M.xap = 0.5; run(u, 20); }], ['death 1', (u) => { run(u, 5); u.M.dead = 1; u.M.nm = 'Ab'; let n = 0; while (X.xUbDead(u.M, 1 / 30) && n++ < 120); }], ['death 2', (u) => { run(u, 5); u.M.dead = 1; u.M.nm = 'Abc'; let n = 0; while (X.xUbDead(u.M, 1 / 30) && n++ < 120); }]];
    const cols = 8, cw = W / cols, rh = H / 2;
    P.forEach(([lbl, f], i) => { const u = unit(['Phoenix', 'Jett', 'Sova', 'Reyna', 'Breach', 'Killjoy', 'Chamber', 'Sage'][i % 8]); f(u); u.b.g.position.set(0, 0, 0); u.M.m.updateMatrixWorld(true); draw(u.b.g, (i % cols + 0.5) * cw, (Math.floor(i / cols) + 1) * rh - 30, 240, 0.7); console.log(i, lbl); });
  }
  const out = Buffer.alloc(W * H * 3); for (let i = 0; i < W * H * 3; i++) out[i] = Math.round(Math.pow(Math.min(1, img[i]), 1 / 1.25) * 255);
  fs.writeFileSync(process.env.OUTP || '/tmp/q/p2.ppm', Buffer.concat([Buffer.from(`P6\n${W} ${H}\n255\n`), out])); console.log('ok');
})().catch((e) => { console.error('FAIL', e); process.exit(1); });
