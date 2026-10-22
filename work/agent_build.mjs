// Build models/agent_m.glb, models/agent_f.glb (body + zone materials + rigid hair) and models/agent_anims.glb (selected UAL clips)
import { NodeIO } from '@gltf-transform/core';
import { prune, dedup, resample } from '@gltf-transform/functions';
import { mat4, vec3 } from 'gl-matrix';
const io = new NodeIO();
const OUT = process.argv[2] || '/tmp/q/out';

// ---------- bodies ----------
const ZONE = (n) => /^Head$|^neck_01$/.test(n) ? 'Skin' : /^(hand|thumb|index|middle|ring|pinky)_/.test(n) ? 'Gloves' : /^(foot|ball)_/.test(n) ? 'Boots'
  : /^(thigh|calf|pelvis|root)/.test(n) ? 'Pants' : 'Suit';
async function body(src, hairs, out) {
  const doc = await io.read(src), R = doc.getRoot();
  const nodes = R.listNodes(), byName = {}; nodes.forEach((n) => (byName[n.getName()] = n));
  const skin = R.listSkins()[0], joints = skin.listJoints();
  const mats = {};
  const mkMat = (name, col, tex) => { const m = doc.createMaterial(name).setBaseColorFactor(col).setRoughnessFactor(0.8).setMetallicFactor(0).setDoubleSided(false); if (tex) m.setBaseColorTexture(tex); return (mats[name] = m); };
  for (const mesh of R.listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      const om = prim.getMaterial(), on = om ? om.getName() : '';
      if (/Superhero/.test(on)) {
        const tex = om.getBaseColorTexture();
        const J = prim.getAttribute('JOINTS_0'), W = prim.getAttribute('WEIGHTS_0'), I = prim.getIndices().getArray();
        const zv = new Array(J.getCount()); const j4 = [], w4 = [];
        for (let v = 0; v < J.getCount(); v++) { J.getElement(v, j4); W.getElement(v, w4); let b = 0; for (let k = 1; k < 4; k++) if (w4[k] > w4[b]) b = k; zv[v] = ZONE(joints[j4[b]].getName()); }
        const tris = {};
        for (let t = 0; t < I.length; t += 3) { const c = {}; [I[t], I[t + 1], I[t + 2]].forEach((v) => (c[zv[v]] = (c[zv[v]] || 0) + 1)); let z = Object.keys(c).sort((a, b) => c[b] - c[a])[0];
          if (c.Skin) z = c.Skin >= 2 ? 'Skin' : z; (tris[z] = tris[z] || []).push(I[t], I[t + 1], I[t + 2]); }
        const defs = { Skin: [[1, 1, 1, 1], tex], Suit: [[0.8, 0.8, 0.8, 1]], Pants: [[0.3, 0.3, 0.32, 1]], Gloves: [[0.12, 0.12, 0.13, 1]], Boots: [[0.1, 0.1, 0.1, 1]] };
        let first = true;
        for (const z of Object.keys(tris)) {
          const m = mats[z] || mkMat(z, defs[z][0], defs[z][1]);
          const idx = doc.createAccessor().setType('SCALAR').setArray(new Uint32Array(tris[z])).setBuffer(prim.getIndices().getBuffer());
          if (first) { prim.setIndices(idx).setMaterial(m); first = false; }
          else { const p2 = prim.clone().setIndices(idx).setMaterial(m); mesh.addPrimitive(p2); }
        }
        console.log(src, 'zones', Object.fromEntries(Object.entries(tris).map(([k, v]) => [k, v.length / 3])));
      } else if (/Hair/.test(on)) prim.setMaterial(mats.Brow || mkMat('Brow', [0.15, 0.1, 0.07, 1]));
      else if (/Eye/.test(on)) { const t = om.getBaseColorTexture(); prim.setMaterial(mats.Eyes || mkMat('Eyes', [1, 1, 1, 1], t)); }
    }
  }
  // rigid hair: vertices into the hair file's Head-bone space (its inverse bind matrix), mesh child of our Head bone
  const head = byName.Head; const hairMat = mkMat('Hair', [0.2, 0.14, 0.1, 1]); hairMat.setDoubleSided(true);
  for (const h of hairs) {
    const hd = await io.read(`/tmp/q/hr/${h}_p.gltf`), hs = hd.getRoot().listSkins()[0], hj = hs.listJoints(), ibm = hs.getInverseBindMatrices();
    const hi = hj.findIndex((n) => n.getName() === 'Head'); const M = ibm.getElement(hi, []);
    const hm = hd.getRoot().listMeshes()[0], hp = hm.listPrimitives()[0];
    const P = hp.getAttribute('POSITION'), N = hp.getAttribute('NORMAL'), Jh = hp.getAttribute('JOINTS_0'), Wh = hp.getAttribute('WEIGHTS_0');
    const pos = new Float32Array(P.getCount() * 3), nor = new Float32Array(P.getCount() * 3), v = [0, 0, 0], nm = mat4.create(); mat4.invert(nm, M); mat4.transpose(nm, nm);
    let off = 0; const j4 = [], w4 = [];
    for (let i = 0; i < P.getCount(); i++) { P.getElement(i, v); const o = vec3.transformMat4([], v, M); pos.set(o, i * 3); N.getElement(i, v);
      const n = vec3.normalize([], [nm[0] * v[0] + nm[4] * v[1] + nm[8] * v[2], nm[1] * v[0] + nm[5] * v[1] + nm[9] * v[2], nm[2] * v[0] + nm[6] * v[1] + nm[10] * v[2]]); nor.set(n, i * 3);
      Jh.getElement(i, j4); Wh.getElement(i, w4); if (hj[j4[0]].getName() !== 'Head' || w4[0] < 0.99) off++; }
    if (off) console.log(h, 'verts not fully on Head:', off);
    const buf = R.listBuffers()[0];
    const prim = doc.createPrimitive()
      .setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(pos).setBuffer(buf))
      .setAttribute('NORMAL', doc.createAccessor().setType('VEC3').setArray(nor).setBuffer(buf))
      .setIndices(doc.createAccessor().setType('SCALAR').setArray(new Uint32Array(hp.getIndices().getArray())).setBuffer(buf)).setMaterial(hairMat);
    const mesh = doc.createMesh(h).addPrimitive(prim); const n = doc.createNode(h).setMesh(mesh); head.addChild(n);
  }
  // drop UVs from non-textured prims? keep (shared accessors)
  await doc.transform(dedup(), prune());
  await io.write(out, doc);
}
await body('/tmp/q/Superhero_Male_FullBody_p.gltf', ['Hair_SimpleParted', 'Hair_Buzzed', 'Hair_Beard'], OUT + '/agent_m.glb');
await body('/tmp/q/Superhero_Female_FullBody_p.gltf', ['Hair_Buns', 'Hair_Long', 'Hair_BuzzedFemale'], OUT + '/agent_f.glb');

// ---------- animations ----------
const KEEP1 = ['Idle_Loop', 'Walk_Loop', 'Jog_Fwd_Loop', 'Crouch_Idle_Loop', 'Crouch_Fwd_Loop', 'Jump_Start', 'Jump_Loop', 'Jump_Land', 'Death01', 'Hit_Chest', 'Hit_Head',
  'Pistol_Aim_Neutral', 'Pistol_Reload', 'Pistol_Shoot', 'Spell_Simple_Shoot', 'Fixing_Kneeling', 'Sword_Idle'];
const KEEP2 = { OverhandThrow: 'OverhandThrow', LayToIdle: 'Death02' };
const A = await io.read('/tmp/q/UAL1_Standard.glb'), AR = A.getRoot();
const B = await io.read('/tmp/q/UAL2_Standard.glb');
const nb = {}; AR.listNodes().forEach((n) => (nb[n.getName()] = n));
const buf = AR.listBuffers()[0];
const keepCh = (ch) => { const p = ch.getTargetPath(), n = ch.getTargetNode() && ch.getTargetNode().getName(); if (p === 'scale' || p === 'weights') return false; if (p === 'translation' && n !== 'pelvis') return false; return true; };
for (const a of AR.listAnimations()) {
  if (!KEEP1.includes(a.getName())) { a.dispose(); continue; }
  for (const ch of a.listChannels()) if (!keepCh(ch)) { const s = ch.getSampler(); ch.dispose(); s.dispose(); }
}
for (const a of B.getRoot().listAnimations()) {
  const nn = KEEP2[a.getName()]; if (!nn) continue;
  const na = A.createAnimation(nn); const rev = nn === 'Death02';
  for (const ch of a.listChannels()) {
    if (!keepCh(ch)) continue; const s = ch.getSampler(), tn = nb[ch.getTargetNode().getName()]; if (!tn) continue;
    let inp = Float32Array.from(s.getInput().getArray()), outp = Float32Array.from(s.getOutput().getArray());
    if (rev) { const T = inp[inp.length - 1], st = outp.length / inp.length, n = inp.length; const i2 = new Float32Array(n), o2 = new Float32Array(outp.length);
      for (let k = 0; k < n; k++) { i2[k] = T - inp[n - 1 - k]; o2.set(outp.subarray((n - 1 - k) * st, (n - k) * st), k * st); } inp = i2; outp = o2; }
    const ns = A.createAnimationSampler().setInterpolation(s.getInterpolation())
      .setInput(A.createAccessor().setType('SCALAR').setArray(inp).setBuffer(buf))
      .setOutput(A.createAccessor().setType(s.getOutput().getType()).setArray(outp).setBuffer(buf));
    na.addSampler(ns).addChannel(A.createAnimationChannel().setTargetNode(tn).setTargetPath(ch.getTargetPath()).setSampler(ns));
  }
}
// strip meshes: keep the skeleton nodes only
for (const n of AR.listNodes()) { if (n.getMesh()) n.setMesh(null); if (n.getSkin()) n.setSkin(null); }
for (const m of AR.listMeshes()) m.dispose();
for (const s of AR.listSkins()) s.dispose();
await A.transform(resample({ tolerance: 5e-4 }), dedup(), prune({ keepLeaves: true }));
// rotation outputs as normalized int16 (core glTF 2.0 allows it for rotation samplers); drop leaf-bone channels
for (const a of AR.listAnimations()) for (const ch of a.listChannels()) {
  const n = ch.getTargetNode().getName(), s = ch.getSampler(); if (/_leaf_/.test(n)) { ch.dispose(); s.dispose(); continue; }
  if (ch.getTargetPath() === 'rotation') { const o = s.getOutput(), f = o.getArray(), q = new Int16Array(f.length); for (let i = 0; i < f.length; i++) q[i] = Math.round(Math.max(-1, Math.min(1, f[i])) * 32767);
    s.setOutput(A.createAccessor().setType('VEC4').setArray(q).setNormalized(true).setBuffer(buf)); } }
await A.transform(dedup(), prune({ keepLeaves: true }));
for (const acc of AR.listAccessors()) if (acc.listParents().every((p) => p === AR)) acc.dispose();
console.log('clips', AR.listAnimations().map((a) => a.getName() + ':' + a.listChannels().length).join(' '));
await io.write(OUT + '/agent_anims.glb', A);
{ const d = await io.read(OUT + '/agent_anims.glb'), R2 = d.getRoot(); let n = 0; for (const a of R2.listAccessors()) if (a.listParents().every((p) => p === R2)) { a.dispose(); n++; } console.log('orphans', n); await io.write(OUT + '/agent_anims.glb', d); }
for (const f of ['agent_m', 'agent_f']) { const d = await io.read(OUT + '/' + f + '.glb'), R2 = d.getRoot(); let n = 0; for (const a of R2.listAccessors()) if (a.listParents().every((p) => p === R2)) { a.dispose(); n++; } console.log(f, 'orphans', n); await io.write(OUT + '/' + f + '.glb', d); }
