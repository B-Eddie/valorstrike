// runtime test: real three r149 + GLTFLoader/SkeletonUtils (examples/js), the game's own agent code extracted from index.html
const fs = require('fs'), vm = require('vm');
const html = fs.readFileSync(require('path').join(__dirname, '../index.html'), 'utf8');
const ctx = { console, performance, TextDecoder, TextEncoder, setTimeout, clearTimeout, URL, Blob, createImageBitmap: undefined, requestAnimationFrame: () => 0, Math, JSON, window: {}, self: {} }; ctx.window = ctx; ctx.self = ctx; vm.createContext(ctx);
for (const f of ['three.min.js', 'GLTFLoader.js', 'SkeletonUtils.js']) vm.runInContext(fs.readFileSync('/workspace/work/qa/' + f, 'utf8'), ctx);
const cut = (a, b) => { const i = html.indexOf(a), j = html.indexOf(b, i); if (i < 0 || j < 0) throw new Error('marker ' + a); return html.slice(i, j); };
const rim = cut('function xRimM(', '\n', 0); const RK = 'm.customProgramCacheKey = () => "xrim2"; m.needsUpdate = true; }', rimEnd = html.indexOf(RK, html.indexOf('function xRimM(')) + RK.length;
const src = 'var XEC = { hex: 0xff4655 }, XAC = {}; const XNR = () => {}; const XLM = (c) => new THREE.MeshLambertMaterial({ color: c }); const XBA = {}; const xAgOf = (n) => XBA[n] || n;\n' +
  'var bots = [], allies = [], mode = "five", xFvOK = false, FV = {}, WEAP = { Vandal: { mag: 25, rld: 2.5 } }, xDbOK = false, duelBot = null, SFX = { at() {} };\nfunction groundAt() { return 0; }\n' +
  html.slice(html.indexOf('function xRimM('), rimEnd) + '\n' + cut('// agents: colors and extras per agent', '(function xSolTick() {') + '\nthis.__x = { XUB, XSOL, xUb, xUbReady, xUbAnim, xUbPost, xUbPre, xUbDead, xSol, XUB_ST };';
vm.runInContext(src, ctx, { filename: 'agent.js' });
const T = ctx.THREE, X = ctx.__x;
const parse = (f) => new Promise((res, rej) => { const b = fs.readFileSync(f), ab = vm.runInContext('new ArrayBuffer(' + b.length + ')', ctx); new (vm.runInContext('Uint8Array', ctx))(ab).set(b); new T.GLTFLoader().parse(ab, '', res, rej); });
module.exports = { ctx, T, X, parse };
if (require.main === module) (async () => {
  const D = require('path').join(__dirname, '../models/') + '/';
  X.XUB.src = { m: await parse(D + 'agent_m.glb'), f: await parse(D + 'agent_f.glb'), a: await parse(D + 'agent_anims.glb') };
  X.xUbReady(); console.log('ready', X.XUB.ok, Object.keys(X.XUB.C).length, 'clips; additive', Object.keys(X.XUB.A));
  const mkM = (nm) => { const m = new T.Group(), gun = new T.Group(); gun.add(new T.Mesh(new T.BoxGeometry(0.06, 0.1, 0.8), new T.MeshBasicMaterial())); gun.children[0].position.z = 0.25; m.add(gun); const ring = new T.Mesh(new T.RingGeometry(0.4, 0.5, 8), new T.MeshBasicMaterial()); m.add(ring); return { m, gun, ring, mats: [], nm, rim: 0xff4655, w: 'Vandal' }; };
  const out = [];
  for (const nm of ['Jett', 'Phoenix', 'Sova', 'Sage', 'Reyna', 'Raze', 'Killjoy', 'Omen', 'Skye', 'Chamber', 'Breach', 'Cypher', 'Bot7']) {
    const M = mkM(nm); X.xSol(M); const b = { g: new T.Group(), hp: 100, head: { position: { y: 1.75 } }, cr: false, name: nm }; b.g.add(M.m);
    let t = 0; const step = (dt, fn) => { fn && fn(); t += dt; X.xUbAnim(b, M, b.sp || 0, dt); M.sx.mx.update(dt); X.xUbPost(M); };
    b.sp = 4.5; for (let i = 0; i < 30; i++) step(1 / 30, () => { b.g.position.x += 4.5 / 30; }); // strafe left (+X while facing +Z)
    const yaw = M.sx.yaw; b.cr = true; b.sp = 0; for (let i = 0; i < 30; i++) step(1 / 30); const hd = b.head.position.y;
    b.xsh = 1; step(1 / 30); b.hp = 50; step(1 / 30); M.xCast = 'throw'; step(1 / 30); const up = M.sx.uo;
    M.dead = 1; let n = 0; while (X.xUbDead(M, 1 / 30) && n < 200) n++;
    out.push(`${nm}: ub=${!!M.ub} kids=${M.sx.sc.children.length} strafeYaw=${yaw.toFixed(2)} crouchHead=${hd.toFixed(2)} upperOneShot=${up} death=${M.sx.dn} frames=${n} gunParent=${M.gun.parent && M.gun.parent.parent && M.gun.parent.parent.name}`);
  }
  console.log(out.join('\n'));
})().catch((e) => { console.error('FAIL', e); process.exit(1); });
