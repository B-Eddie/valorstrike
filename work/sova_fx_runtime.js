// ---- SOVA FX ----
// Faithful Sova ability visuals, reference-grounded in the wiki showcase clips viewed 2026-11-04
// (wiki.playvalorant.com/en-us/Owl_Drone, /Shock_Bolt, /Recon_Bolt, /Hunter's_Fury, images/<Name>_Showcase.mp4):
//   Shock Bolt: blue-white electric burst - bright core, expanding energy shell, flat + upright rings, crackle arcs, sparks.
//   Recon Bolt: expanding blue sonar sphere with a dotted grid (orange-red for an enemy bolt); enemies revealed in ORANGE.
//   Hunter's Fury: huge wall-piercing lightning blast - white-blue core beam, jagged arc planes, floating shards.
//   Owl Drone: blue hologram flash at the gauntlet on launch; bolts/darts fly as glowing orbs with a rune ring.
// Pure client fx: damage, reveal, timing and sound stay in the caller. Self-cleaning via jFx / bounded rAF shards.
// Installed after ability_fp_runtime.js. Globals used (read-only): THREE, scene, camera, jM, jMat, xAdd, jFx, groundAt, xE.
//
// Integration wiring (integrator owns index.html):
//   1. Shock Bolt land (arrow tick, kind "shock" branch, and the bot xBShock landing): replace the flat smoke puff
//      `const m = jM(smokeGeo, fireMat(0x7fd8ff, 0.4)); ... jFx(m, 0.35);` with `svxShockBurst(a.b);`
//   2. Recon pulse: in xRcnRings(p, en) replace the two flat rings with `svxReconPulse(p, en)` (or call it alongside).
//   3. Hunter's Fury: in jBeam replace the `jM(beamGeo, fireMat(0x45d0ff, 0.85))` block with `svxFuryBeam(o, d, null);`
//      and in the online mpCastFx "beam"/sovaBlast path call the same with the row's origin/dir.
//   4. Bolt/dart flight: after each jBolt(...) for Sova kinds in jArrow / drDart / xBShock / xBRecon call
//      `svxBoltFlight(m, kind)` (kind "shock" | "recon" | "dart") so the projectile reads as a glowing orb.
//   5. Owl Drone cast (svKey KeyC, after J.dr is set): `svxOwlLaunch(pEye(), jAim());`
//   6. Reveal outline: swap rvMat for svxRvMat (orange, as the clips) in jRcnPulse / xHfRv, or recolor rvMat.
//   7. Optional: svxBowAttach(viewmodelGroup) adds the nock glow + charge ring; drive handle.setCharge(0..1)
//      from the bow equip/charge flow (XABT.bolt.pw).
const svxC = {
  sph: null, ring: null, plane: null, beam: null, shard: null,
  texBolt: null, texDots: null,
  anim: [], raf: 0,
  up: null, v0: null, v1: null,
};
function svxGeo() {
  if (svxC.sph) return;
  svxC.sph = new THREE.SphereGeometry(1, 20, 14);
  svxC.ring = new THREE.RingGeometry(0.86, 1, 48);
  svxC.plane = new THREE.PlaneGeometry(1, 1);
  svxC.beam = new THREE.BoxGeometry(0.35, 0.35, 1);
  svxC.cone = new THREE.CylinderGeometry(3.2, 1.4, 1, 14, 1, true); svxC.cone.rotateX(Math.PI / 2); // +Z axis, widening downrange
  svxC.shard = new THREE.BoxGeometry(0.07, 0.16, 0.04);
  svxC.up = new THREE.Vector3(0, 1, 0);
  svxC.v0 = new THREE.Vector3();
  svxC.v1 = new THREE.Vector3();
}
function svxTexBoltF() { // jagged vertical lightning, white core on transparent blue (tints via material color)
  if (svxC.texBolt) return svxC.texBolt;
  const c = document.createElement("canvas"); c.width = 128; c.height = 512; const g = c.getContext("2d");
  g.clearRect(0, 0, 128, 512);
  const bolt = (x0, w, a) => {
    g.strokeStyle = "rgba(255,255,255," + a + ")"; g.lineWidth = w; g.lineCap = "round"; g.beginPath();
    let x = x0, y = 0; g.moveTo(x, y);
    while (y < 512) { y += 24 + Math.random() * 30; x = Math.max(8, Math.min(120, x + (Math.random() - 0.5) * 56)); g.lineTo(x, y); }
    g.stroke();
  };
  for (let i = 0; i < 3; i++) { bolt(34 + i * 30, 7, 0.22); bolt(34 + i * 30, 2.6, 0.95); }
  svxC.texBolt = new THREE.CanvasTexture(c);
  if (THREE.SRGBColorSpace) svxC.texBolt.colorSpace = THREE.SRGBColorSpace;
  svxC.texBolt.wrapS = svxC.texBolt.wrapT = THREE.RepeatWrapping;
  return svxC.texBolt;
}
function svxTexDotsF() { // concentric dashed sonar rings + radial dot grid
  if (svxC.texDots) return svxC.texDots;
  const c = document.createElement("canvas"); c.width = 512; c.height = 512; const g = c.getContext("2d");
  g.clearRect(0, 0, 512, 512);
  g.strokeStyle = "rgba(255,255,255,0.9)"; g.lineWidth = 3; g.setLineDash([10, 14]);
  for (let r = 60; r <= 250; r += 48) { g.beginPath(); g.arc(256, 256, r, 0, 6.2832); g.stroke(); }
  g.setLineDash([]);
  g.fillStyle = "rgba(255,255,255,0.85)";
  for (let i = 0; i < 24; i++) { const a = i / 24 * 6.2832; for (let r = 84; r <= 250; r += 96) { g.beginPath(); g.arc(256 + Math.cos(a) * r, 256 + Math.sin(a) * r, 3, 0, 6.2832); g.fill(); } }
  svxC.texDots = new THREE.CanvasTexture(c);
  if (THREE.SRGBColorSpace) svxC.texDots.colorSpace = THREE.SRGBColorSpace;
  return svxC.texDots;
}
// pooled one-shot part: grows 0.5 -> 0.5+g over t seconds while fading out (jFx semantics); self-cleaning
function svxPart(geo, mat, p, t, g) {
  const m = jM(geo, mat);
  m.position.copy(p);
  m.raycast = () => {};
  const f = jFx(m, t);
  if (g) f.g = g;
  return m;
}
function svxMatTex(key, tex, col, op, repY) {
  return jMat(key, () => {
    const t = tex.clone(); t.needsUpdate = true; if (repY) t.repeat.set(1, repY);
    return new THREE.MeshBasicMaterial({ map: t, color: col, transparent: true, opacity: op, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false, toneMapped: false });
  });
}
function svxMatShell(key, col, op, front) {
  return jMat(key, () => new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: op, depthWrite: false, blending: THREE.AdditiveBlending, side: front ? THREE.FrontSide : THREE.DoubleSide, fog: false, toneMapped: false }));
}
// ---- Shock Bolt: the blue-white electric sphere + rings + crackle (clip frames 7-10) ----
function svxShockBurst(p) {
  try {
    svxGeo();
    const core = svxPart(svxC.sph, xAdd("svxShkCore", 0xd8f2ff, 0.6), p, 0.5, 0);
    core.scale.setScalar(0.55);
    svxPart(svxC.sph, svxMatShell("svxShkShell", 0x4fc3ff, 0.35), p, 0.5, 2.1); // energy shell out to ~2.6 m
    const rg = svxPart(svxC.ring, xAdd("svxShkRingG", 0x7fd8ff, 0.85), svxC.v0.set(p.x, p.y + 0.06, p.z), 0.55, 4.2);
    rg.rotation.x = -Math.PI / 2;
    const rv = svxPart(svxC.ring, xAdd("svxShkRingV", 0x9fe4ff, 0.8), p, 0.42, 2.6); // the upright ring of the clip
    rv.lookAt(camera.position);
    for (let i = 0; i < 2; i++) { // crackle arcs, two rolled additive planes
      const a = svxPart(svxC.plane, svxMatTex("svxShkArc" + i, svxTexBoltF(), 0x8fd4ff, 0.5), p, 0.4 + i * 0.06, 0);
      a.scale.setScalar(2.6 + i * 0.8);
      a.lookAt(camera.position);
      a.rotateZ(Math.random() * 6.2832);
    }
    svxShards(p, null, 7, 0x9fdcff, 5.5, 0.45, 2.2); // electric sparks
  } catch (e) { xE(e); }
}
// ---- Recon Bolt: expanding blue sonar sphere with a dotted grid (enemy bolt: red-orange) ----
function svxReconPulse(p, en) {
  try {
    svxGeo();
    const col = en ? 0xff5a2a : 0x3fb4ff, k = en ? "E" : "";
    const core = svxPart(svxC.sph, xAdd("svxRcnC" + k, en ? 0xffb08a : 0xd8f2ff, 0.7), p, 0.35, 0);
    core.scale.setScalar(0.5);
    svxPart(svxC.sph, svxMatShell("svxRcnSh" + k, col, 0.09, true), p, 0.75, 29.5); // sonar shell to the 30 m reveal radius (XRCN.radius)
    let gy = NaN;
    try { gy = groundAt(p.x, p.z, 0.05, p.y); } catch (e) {}
    const hp = svxPart(svxC.plane, svxMatTex("svxRcnH" + k, svxTexDotsF(), col, 0.32), svxC.v0.set(p.x, (Number.isFinite(gy) ? gy : p.y) + 0.14, p.z), 0.75, 59.5);
    hp.rotation.x = -Math.PI / 2;
    for (let i = 0; i < 2; i++) { // crossed vertical grid planes through the bolt: the 3D lattice of the clip
      const vp = svxPart(svxC.plane, svxMatTex("svxRcnV" + i + k, svxTexDotsF(), col, 0.18), p, 0.75, 59.5);
      vp.rotation.y = i * Math.PI / 2 + 0.4;
    }
  } catch (e) { xE(e); }
}
// ---- Hunter's Fury: the huge wall-piercing lightning blast (66 m, XHFU.len; wiki/server) ----
function svxFuryBeam(o, d, hitPoint) {
  try {
    svxGeo();
    const L = 66, dir = svxC.v1.copy(d).normalize().clone();
    const end = o.clone().addScaledVector(dir, L);
    const mz = svxPart(svxC.sph, xAdd("svxFuryMz", 0xd8f2ff, 0.35), svxC.v0.copy(o).addScaledVector(dir, 2.0), 0.2, 0);
    mz.scale.setScalar(0.25);
    const core = svxPart(svxC.cone, xAdd("svxFuryCore", 0xbfe9ff, 0.14), o, 0.6, 0); // widening energy cone of the clip
    core.scale.set(1, 1, L - 2.5);
    core.position.copy(o).addScaledVector(dir, 2.5 + (L - 2.5) / 2);
    core.lookAt(end);
    const hot = svxPart(svxC.beam, xAdd("svxFuryHot", 0xe8f7ff, 0.7), o, 0.5, 0); // hot thin core inside the cone
    hot.scale.set(0.5, 0.5, L - 2.5);
    hot.position.copy(o).addScaledVector(dir, 2.5 + (L - 2.5) / 2);
    hot.lookAt(end);
    for (let i = 0; i < 3; i++) { // jagged arc planes, rolled around the blast axis
      const a = svxPart(svxC.plane, svxMatTex("svxFuryArc" + i, svxTexBoltF(), i ? 0x7fd4ff : 0xcfefff, 0.55, 8), o, 0.55, 0);
      a.scale.set(2.4, L - 5, 1);
      a.position.copy(o).addScaledVector(dir, 5 + (L - 5) / 2);
      a.quaternion.setFromUnitVectors(svxC.up, dir);
      a.rotateY(i * 2.1);
    }
    svxShards(o, dir, 9, 0x9fdcff, 2.5, 0.8, 40); // floating charge shards along the path
  } catch (e) { xE(e); }
}
// ---- Owl Drone: the blue hologram flash as it leaves the gauntlet ----
function svxOwlLaunch(p, d) {
  try {
    svxGeo();
    const fw = svxC.v1.copy(d).normalize();
    const rt = new THREE.Vector3().crossVectors(fw, svxC.up).normalize(); // screen-right of the aim
    const at = svxC.v0.copy(p).addScaledVector(fw, 1.6).addScaledVector(rt, 0.3);
    at.y -= 0.18;
    const core = svxPart(svxC.sph, xAdd("svxOwlCore", 0xbfe9ff, 0.45), at, 0.4, 0);
    core.scale.setScalar(0.12);
    const ring = svxPart(svxC.ring, xAdd("svxOwlRing", 0x4fc3ff, 0.7), at, 0.5, 0.5);
    ring.lookAt(camera.position);
    svxShards(at, null, 2, 0x7fd4ff, 0.9, 0.4, 0.5);
  } catch (e) { xE(e); }
}
// ---- bolt / dart in flight: a glowing orb with a rune ring, as the clips (kids of the caller's jBolt mesh) ----
function svxBoltFlight(m, kind) {
  try {
    svxGeo();
    const col = kind === "shock" ? 0x7fd8ff : kind === "dart" ? 0x8fe0ff : 0x45d0ff;
    const gm = svxMatShell("svxBoltGlow" + kind, col, 0.85);
    const glow = new THREE.Mesh(svxC.sph, gm);
    glow.scale.setScalar(0.17); glow.raycast = () => {}; glow.renderOrder = 2;
    const ring = new THREE.Mesh(svxC.ring, gm);
    ring.scale.setScalar(0.45); ring.raycast = () => {}; ring.renderOrder = 2;
    m.add(glow); m.add(ring); ring.lookAt(camera.position);
    m.userData.kids = (m.userData.kids || []).concat([glow, ring]); // jRel strips kids when the bolt lands
  } catch (e) { xE(e); }
}
// ---- bow viewmodel: nock glow + charge ring (integrator drives setCharge with XABT.bolt.pw) ----
function svxBowAttach(viewmodelGroup) {
  svxGeo();
  const grp = new THREE.Group(); grp.name = "svx-bow";
  const nock = new THREE.Mesh(svxC.sph, svxMatShell("svxBowNock", 0x7fd8ff, 0.9));
  nock.scale.setScalar(0.05); nock.raycast = () => {}; nock.renderOrder = 12;
  const ring = new THREE.Mesh(svxC.ring, svxMatShell("svxBowRing", 0x9fe4ff, 0.8));
  ring.scale.setScalar(0.1); ring.visible = false; ring.raycast = () => {}; ring.renderOrder = 12;
  grp.add(nock); grp.add(ring);
  (viewmodelGroup || scene).add(grp);
  return {
    g: grp,
    setCharge(p) { // 0..1 bow charge: the rune ring tightens and brightens as the clip's charge circles
      const on = p > 0.02;
      ring.visible = on;
      if (on) { ring.scale.setScalar(0.16 - 0.07 * p); ring.material.opacity = 0.35 + 0.55 * p; }
      nock.scale.setScalar(0.04 + 0.04 * p);
    },
  };
}
// ---- orange reveal outline of the clips (swap for the red rvMat; BackSide shell over body+head) ----
const svxRvMat = new THREE.MeshBasicMaterial({ color: 0xff7a1a, transparent: true, opacity: 0.55, depthTest: false, depthWrite: false, side: THREE.BackSide });
// ---- bounded rAF shards (sparks / floating charge shards); shared materials, scale-fade, hard cap ----
function svxShards(p, dir, n, col, spd, life, spread) {
  svxGeo();
  if (svxC.anim.length > 48) return; // bounded: never pile up across bursts
  const mat = svxMatShell("svxShard" + col, col, 0.85);
  for (let i = 0; i < n; i++) {
    const m = new THREE.Mesh(svxC.shard, mat);
    m.raycast = () => {};
    const along = dir ? Math.random() * spread : 0;
    m.position.set(
      p.x + (dir ? dir.x * along : 0) + (Math.random() - 0.5) * (dir ? 2.4 : 0.4),
      Math.max(0.1, p.y + (dir ? dir.y * along : 0) + (Math.random() - 0.5) * 2.2),
      p.z + (dir ? dir.z * along : 0) + (Math.random() - 0.5) * (dir ? 2.4 : 0.4));
    const a = Math.random() * 6.2832, up = dir ? 1.1 : 0.5;
    scene.add(m);
    svxC.anim.push({ m, t0: performance.now(), pt: performance.now(), life: life * 1000, s: 0.8 + Math.random() * 0.7,
      v: new THREE.Vector3(Math.cos(a) * spd * (dir ? 0.25 : 1), up * (0.6 + Math.random()), Math.sin(a) * spd * (dir ? 0.25 : 1)),
      rx: (Math.random() - 0.5) * 0.3, ry: (Math.random() - 0.5) * 0.3 });
  }
  if (!svxC.raf) svxC.raf = requestAnimationFrame(svxAnimTick);
}
function svxAnimTick() {
  const A = svxC.anim;
  if (!A.length) { svxC.raf = 0; return; }
  svxC.raf = requestAnimationFrame(svxAnimTick);
  const now = performance.now();
  for (let i = A.length - 1; i >= 0; i--) {
    const s = A[i], u = (now - s.t0) / s.life;
    if (u >= 1) { scene.remove(s.m); A.splice(i, 1); continue; }
    const dt = Math.min(0.1, (now - s.pt) / 1000); s.pt = now;
    s.m.position.addScaledVector(s.v, dt);
    s.v.y -= 2.5 * dt; // sparks sink a little
    s.m.rotation.x += s.rx; s.m.rotation.y += s.ry;
    s.m.scale.setScalar(s.s * (1 - u * 0.7));
  }
}
// ---- END SOVA FX ----
