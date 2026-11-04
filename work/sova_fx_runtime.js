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
  up: null, v0: null, v1: null, v2: null, m4: null,
};
function svxGeo() {
  if (svxC.sph) return;
  svxC.sph = new THREE.SphereGeometry(1, 20, 14);
  svxC.sphHi = new THREE.SphereGeometry(1, 48, 32);
  svxC.ring = new THREE.RingGeometry(0.93, 1, 48);
  svxC.plane = new THREE.PlaneGeometry(1, 1);
  svxC.beam = new THREE.BoxGeometry(0.35, 0.35, 1);
  svxC.cone = new THREE.CylinderGeometry(3.2, 1.4, 1, 24, 1, true); svxC.cone.rotateX(Math.PI / 2); // +Z axis, widening downrange
  svxC.shard = new THREE.BoxGeometry(0.07, 0.16, 0.04);
  svxC.up = new THREE.Vector3(0, 1, 0);
  svxC.v0 = new THREE.Vector3();
  svxC.v1 = new THREE.Vector3();
  svxC.v2 = new THREE.Vector3();
  svxC.m4 = new THREE.Matrix4();
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
  for (let i = 0; i < 4; i++) { bolt(25 + i * 26, 5, 0.2); bolt(25 + i * 26, 2, 0.9); }
  svxC.texBolt = new THREE.CanvasTexture(c);
  if (THREE.SRGBColorSpace) svxC.texBolt.colorSpace = THREE.SRGBColorSpace;
  svxC.texBolt.wrapS = svxC.texBolt.wrapT = THREE.RepeatWrapping;
  return svxC.texBolt;
}
function svxTexWisp() { // radial curved wisps: flowing electric curl, not straight bolts or flat rings
  if (svxC.texWisp) return svxC.texWisp;
  const c = document.createElement("canvas"); c.width = 256; c.height = 256; const g = c.getContext("2d");
  g.clearRect(0, 0, 256, 256);
  const wisp = (a0, curl, len, w, a) => {
    g.strokeStyle = "rgba(255,255,255," + a + ")"; g.lineWidth = w; g.lineCap = "round"; g.beginPath();
    let r = 14, th = a0, x = 128 + Math.cos(th) * r, y = 128 + Math.sin(th) * r;
    g.moveTo(x, y);
    while (r < len) {
      r += 8 + Math.random() * 10; th += curl * (0.7 + Math.random() * 0.6);
      x = 128 + Math.cos(th) * r + (Math.random() - 0.5) * 7; y = 128 + Math.sin(th) * r + (Math.random() - 0.5) * 7;
      g.lineTo(x, y);
    }
    g.stroke();
  };
  for (let i = 0; i < 7; i++) {
    const a0 = i * 0.897 + Math.random() * 0.5, curl = 0.05 + Math.random() * 0.06, len = 92 + Math.random() * 26;
    wisp(a0, curl, len, 7, 0.16); wisp(a0, curl, len, 2.5, 0.85);
  }
  svxC.texWisp = new THREE.CanvasTexture(c);
  if (THREE.SRGBColorSpace) svxC.texWisp.colorSpace = THREE.SRGBColorSpace;
  return svxC.texWisp;
}
function svxTexBoltFat() { // one fat central jagged bolt: reads at beam scale, unlike the thin 4-bolt texture
  if (svxC.texBoltF) return svxC.texBoltF;
  const c = document.createElement("canvas"); c.width = 128; c.height = 512; const g = c.getContext("2d");
  g.clearRect(0, 0, 128, 512);
  const bolt = (w, a) => {
    g.strokeStyle = "rgba(255,255,255," + a + ")"; g.lineWidth = w; g.lineCap = "round"; g.beginPath();
    let x = 64, y = 0; g.moveTo(x, y);
    while (y < 512) { y += 20 + Math.random() * 26; x = Math.max(14, Math.min(114, x + (Math.random() - 0.5) * 70)); g.lineTo(x, y); }
    g.stroke();
  };
  bolt(26, 0.22); bolt(12, 0.5); bolt(5, 0.95);
  svxC.texBoltF = new THREE.CanvasTexture(c);
  if (THREE.SRGBColorSpace) svxC.texBoltF.colorSpace = THREE.SRGBColorSpace;
  svxC.texBoltF.wrapS = svxC.texBoltF.wrapT = THREE.RepeatWrapping;
  return svxC.texBoltF;
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
function svxMatTexN(key, tex, col, op, repY) {
  return jMat(key, () => {
    const t = tex.clone(); t.needsUpdate = true; if (repY) t.repeat.set(1, repY);
    return new THREE.MeshBasicMaterial({ map: t, color: col, transparent: true, opacity: op, depthWrite: false, side: THREE.DoubleSide, fog: false, toneMapped: false });
  });
}
function svxMatShell(key, col, op, front) {
  return jMat(key, () => new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: op, depthWrite: false, blending: THREE.AdditiveBlending, side: front ? THREE.FrontSide : THREE.DoubleSide, fog: false, toneMapped: false }));
}

// ---- procedural plasma shaders (soft flowing energy, no plane-ribbon or disc artifacts) ----
const svxGLSLnoise = "float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}\nfloat noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(hash(i),hash(i+vec2(1.0,0.0)),f.x),mix(hash(i+vec2(0.0,1.0)),hash(i+vec2(1.0,1.0)),f.x),f.y);}\n";
const svxVert = "varying vec2 vUv;\nvoid main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}";
function svxMatPlasmaBall(col, hot) { // soft swirling electric orb: wisps curl around a hot core
  return new THREE.ShaderMaterial({
    uniforms: { uT: { value: 0 }, uOp: { value: 1 }, uCol: { value: new THREE.Color(col) }, uHot: { value: new THREE.Color(hot) } },
    vertexShader: svxVert,
    fragmentShader: svxGLSLnoise + "uniform float uT,uOp;uniform vec3 uCol,uHot;varying vec2 vUv;\nvoid main(){\nvec2 p=vUv*2.0-1.0;float r=length(p);if(r>1.0)discard;\nfloat ang=atan(p.y,p.x);\nfloat sw=noise(vec2(ang*2.5+uT*0.7,r*3.0-uT*1.4))+0.5*noise(vec2(ang*5.0-uT*1.1,r*6.0+uT*0.9));\nfloat wisp=smoothstep(0.58,1.0,sw)*(1.0-r);\nfloat core=exp(-r*5.5)*1.6;\nfloat body=(1.0-r)*(1.0-r)*0.95;\nvec3 col=uCol*(body+wisp*2.2)+uHot*core;\nfloat a=clamp(body+wisp+core,0.0,1.0)*uOp*smoothstep(1.0,0.82,r);\ngl_FragColor=vec4(col*a,a);\n}",
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
  });
}
function svxMatPlasmaCone(col, hot, additive) { // flowing energy along the cone length, alpha-faded rims (no cap circles)
  return new THREE.ShaderMaterial({
    uniforms: { uT: { value: 0 }, uOp: { value: 1 }, uCol: { value: new THREE.Color(col) }, uHot: { value: new THREE.Color(hot) } },
    vertexShader: svxVert,
    fragmentShader: svxGLSLnoise + "uniform float uT,uOp;uniform vec3 uCol,uHot;varying vec2 vUv;\nvoid main(){\nfloat along=vUv.y,around=vUv.x;\nfloat n1=noise(vec2(around*9.0,along*22.0-uT*7.0));\nfloat n2=noise(vec2(around*3.0+7.0,along*8.0-uT*3.5));\nfloat e=pow(n1*0.65+n2*0.55,2.4)*2.2;\nfloat ends=smoothstep(0.0,0.14,along)*smoothstep(1.0,0.7,along);\nfloat a=(0.06+e*0.6)*ends*uOp;\nvec3 col=mix(uCol,uHot,clamp(e,0.0,1.0));\ngl_FragColor=vec4(col*a,a);\n}",
    transparent: true, depthWrite: false, blending: additive === false ? THREE.NormalBlending : THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
  });
}
function svxMatBolt(seed, additive, amp, sway) { // jagged animated lightning path down a strip (uv.y = along the bolt)
  return new THREE.ShaderMaterial({
    uniforms: { uT: { value: 0 }, uOp: { value: 1 }, uSeed: { value: seed }, uAdd: { value: additive ? 1 : 0 }, uAmp: { value: amp || 0.3 }, uSway: { value: sway || 0 } },
    vertexShader: "uniform float uT,uSeed,uSway;varying vec2 vUv;\nvoid main(){\nvUv=uv;\nvec3 p=position;\nfloat v=uv.y;\np.x+=(sin(v*7.0+uSeed*37.0)+0.6*sin(v*13.0+uSeed*11.0+uT*3.0))*uSway*(0.25+0.75*v);\ngl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.0);\n}",
    fragmentShader: "uniform float uT,uOp,uSeed,uAdd,uAmp;varying vec2 vUv;\nfloat h1(float n){return fract(sin(n*127.1+uSeed*311.7)*43758.5453);}\nvoid main(){\nfloat v=vUv.y,u=vUv.x;\nfloat seg=floor(v*13.0),f=fract(v*13.0);\nfloat drift=floor(uT*16.0);\nfloat xc=0.5+uAmp*(mix(h1(seg+drift),h1(seg+1.0+drift),f)-0.5)+uAmp*0.4*(h1(seg*3.7+drift*1.3)-0.5);\nfloat d=abs(u-xc);\nfloat core=smoothstep(0.05,0.0,d);\nfloat glow=exp(-d*7.5)*0.6;\nfloat ends=smoothstep(0.0,0.04,v)*smoothstep(1.0,0.88,v);\nfloat flick=0.72+0.28*sin(uT*60.0+uSeed*47.0+v*30.0);\nfloat a=(core+glow)*ends*flick;\nif(uAdd>0.5){vec3 col=mix(vec3(0.45,0.75,1.0),vec3(1.0),core*0.9);gl_FragColor=vec4(col*a*uOp*1.25,a*uOp);}else{gl_FragColor=vec4(vec3(0.10,0.34,0.85)*(0.45+0.55*core),a*uOp*0.9);}\n}",
    transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending, side: THREE.DoubleSide, fog: false,
  });
}
function svxOrient(m, axis) { // keep the strip's length (local Y) pinned to the beam axis; face the camera as well as that allows
  camera.getWorldPosition(svxC.v0).sub(m.position);
  if (svxC.v0.lengthSq() < 0.0001) return;
  const y = svxC.v2.copy(axis).normalize(); // length along the beam, always
  const x = svxC.v1.copy(y).cross(svxC.v0); // width perpendicular to beam and view
  if (x.lengthSq() < 0.001) x.copy(y).cross(svxC.up); // camera on the beam axis: any perpendicular
  if (x.lengthSq() < 0.001) x.set(1, 0, 0);
  x.normalize();
  const z = svxC.v0.copy(x).cross(y).normalize(); // plane normal: toward the camera as much as pinning allows
  svxC.m4.makeBasis(x, y, z);
  m.quaternion.setFromRotationMatrix(svxC.m4);
}
// Axial-billboard lightning strip from a along dir for len meters: dark base + additive glow pair,
// re-oriented around its axis each frame so it reads from any viewpoint at any distance.
function svxBoltStrip(a, dir, len, width, seed, life, amp, off, sway) {
  const geo = new THREE.PlaneGeometry(width, len, 1, 24);
  const center = a.clone().addScaledVector(dir, len / 2);
  if (off) { // sideways offset around the beam axis: end-on the strips read as spokes around the core
    const sd = new THREE.Vector3().crossVectors(dir, svxC.up);
    if (sd.lengthSq() < 0.1) sd.set(1, 0, 0); sd.normalize();
    const u2 = new THREE.Vector3().crossVectors(sd, dir).normalize();
    center.addScaledVector(sd, Math.cos(off.a) * off.r).addScaledVector(u2, Math.sin(off.a) * off.r);
  }
  for (let layer = 0; layer < 2; layer++) {
    const m = new THREE.Mesh(geo, svxMatBolt(seed, layer === 1, amp, sway));
    m.position.copy(center);
    m.raycast = () => {};
    m.renderOrder = layer === 1 ? 4 : 3;
    svxOrient(m, dir);
    svxFxShader(m, m.material, life, layer === 1 ? 1.0 : 0.95, { axis: dir });
  }
}
function svxFxShader(mesh, mat, life, op0, opts) { // register a shader/billboard fx on the anim lane
  opts = opts || {};
  if (svxC.anim.length > 48) { scene.remove(mesh); return; }
  scene.add(mesh);
  svxC.anim.push({ fx: 1, m: mesh, mat, t0: performance.now(), pt: performance.now(), life: life * 1000, op0, s: mesh.scale.x, grow: opts.grow || 0, bill: !!opts.bill, axis: opts.axis ? opts.axis.clone() : null });
  if (!svxC.raf) svxC.raf = requestAnimationFrame(svxAnimTick);
}
// ---- Shock Bolt: the blue-white electric sphere + rings + crackle (clip frames 7-10) ----
function svxShockBurst(p) {
  try {
    svxGeo();
    const ball = new THREE.Mesh(svxC.plane, svxMatPlasmaBall(0x3fb4ff, 0xd8f4ff)); // soft flowing electric orb
    ball.scale.setScalar(2.3); ball.position.copy(p); ball.raycast = () => {}; ball.renderOrder = 3;
    ball.lookAt(camera.position);
    svxFxShader(ball, ball.material, 0.7, 1.0, { grow: 0.5, bill: true });
    const core = new THREE.Mesh(svxC.plane, svxMatPlasmaBall(0x7fd4ff, 0xffffff)); // small hot center
    core.scale.setScalar(0.45); core.position.copy(p); core.raycast = () => {}; core.renderOrder = 4;
    core.lookAt(camera.position);
    svxFxShader(core, core.material, 0.35, 0.9, { grow: 0.4, bill: true });
    const rg = svxPart(svxC.ring, xAdd("svxShkRingG", 0x4fc3ff, 0.22), svxC.v0.set(p.x, p.y + 0.06, p.z), 0.4, 3.0);
    rg.rotation.x = -Math.PI / 2; // faint flat ground shockwave ring of the clip
    for (let i = 0; i < 3; i++) { // short crackle arcs curling off the burst
      const bd = new THREE.Vector3(Math.random() * 2 - 1, Math.random() * 2 - 0.6, Math.random() * 2 - 1).normalize();
      svxBoltStrip(p, bd, 1.1 + Math.random() * 0.6, 0.6 + Math.random() * 0.25, Math.random() * 90, 0.5, 0.62, null, 0.22);
    }
  } catch (e) { xE(e); }
}
// ---- Recon Bolt: expanding blue sonar sphere with a dotted grid (enemy bolt: red-orange) ----
function svxReconPulse(p, en) {
  try {
    svxGeo();
    const col = en ? 0xff5a2a : 0x3fb4ff, k = en ? "E" : "";
    const core = svxPart(svxC.sph, xAdd("svxRcnC" + k, en ? 0xffb08a : 0x9fdcff, 0.2), p, 0.35, 0);
    core.scale.setScalar(0.2);
    svxPart(svxC.sphHi, svxMatShell("svxRcnSh" + k, col, 0.05, true), p, 0.75, 29.5); // sonar shell to the 30 m reveal radius (XRCN.radius)
    let gy = NaN;
    try { gy = groundAt(p.x, p.z, 0.05, p.y); } catch (e) {}
    const hp = svxPart(svxC.plane, svxMatTex("svxRcnH" + k, svxTexDotsF(), col, 0.22), svxC.v0.set(p.x, (Number.isFinite(gy) ? gy : p.y) + 0.14, p.z), 0.75, 59.5);
    hp.rotation.x = -Math.PI / 2;
    for (let i = 0; i < 2; i++) { // crossed vertical grid planes through the bolt: the 3D lattice of the clip
      const vp = svxPart(svxC.plane, svxMatTex("svxRcnV" + i + k, svxTexDotsF(), col, 0.12), p, 0.75, 59.5);
      vp.rotation.y = i * Math.PI / 2 + 0.4;
    }
  } catch (e) { xE(e); }
}
// ---- Hunter's Fury: the huge wall-piercing lightning blast (66 m, XHFU.len; wiki/server) ----
function svxFuryBeam(o, d, hitPoint) {
  try {
    svxGeo();
    const L = 66, dir = svxC.v1.copy(d).normalize().clone();
    svxC.lastF = { o: [o.x, o.y, o.z], d: [d.x, d.y, d.z], dl: Math.sqrt(d.x * d.x + d.y * d.y + d.z * d.z) };
    const end = o.clone().addScaledVector(dir, L);
    const base = new THREE.Mesh(svxC.cone, svxMatPlasmaCone(0x2a7fe8, 0x7fd0ff, false)); // saturated normal-blend energy body: reads over bright sky
    base.scale.set(1, 1, L - 2.5);
    base.position.copy(o).addScaledVector(dir, 2.5 + (L - 2.5) / 2);
    base.lookAt(end);
    base.raycast = () => {}; base.renderOrder = 2;
    svxFxShader(base, base.material, 0.6, 0.38);
    const cone = new THREE.Mesh(svxC.cone, svxMatPlasmaCone(0x2f9df0, 0x9fe4ff)); // additive flowing plasma glow on top
    cone.scale.set(0.92, 0.92, L - 2.5);
    cone.position.copy(o).addScaledVector(dir, 2.5 + (L - 2.5) / 2);
    cone.lookAt(end);
    cone.raycast = () => {}; cone.renderOrder = 3;
    svxFxShader(cone, cone.material, 0.6, 0.55);
    const hot = svxPart(svxC.beam, xAdd("svxFuryHot", 0x9fdcff, 0.45), o, 0.5, 0); // hot thin core inside the cone
    hot.scale.set(0.3, 0.3, L - 4);
    hot.position.copy(o).addScaledVector(dir, 4 + (L - 4) / 2);
    hot.lookAt(end);
    const mz = svxPart(svxC.sphHi, xAdd("svxFuryMz", 0x4fb8f8, 0.2), svxC.v0.copy(o).addScaledVector(dir, 2.0), 0.3, 0);
    mz.scale.setScalar(0.12);
    for (let i = 0; i < 7; i++) { // serpentine lightning strips running the full blast length, spread around the core
      svxBoltStrip(svxC.v0.copy(o).addScaledVector(dir, 1.5), dir, 62, 2.2 + Math.random() * 1.4, Math.random() * 90, 0.62, 0.46, { a: i * 0.8976 + Math.random() * 0.4, r: 0.5 + Math.random() * 0.9 }, 1.15);
    }
    for (let i = 0; i < 3; i++) { // chaotic short arcs in the muzzle mass of the clip's first frames
      svxBoltStrip(svxC.v0.copy(o).addScaledVector(dir, 0.8), dir, 9 + Math.random() * 5, 2.6 + Math.random() * 1.2, Math.random() * 90, 0.5, 0.62, { a: Math.random() * 6.28, r: 0.3 + Math.random() * 0.5 }, 1.9);
    }
    svxShards(o, dir, 10, 0x66c8ff, 3.5, 0.9, 40);
  } catch (e) { window.__svxErr = "fury: " + String(e && e.stack || e).slice(0, 300); xE(e); }
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
    const col = kind === "shock" ? 0x4fc3ff : kind === "dart" ? 0x5fd0ff : 0x35c0f0;
    const gm = svxMatShell("svxBoltGlow" + kind, col, 0.5);
    const glow = new THREE.Mesh(svxC.sph, gm);
    glow.scale.setScalar(0.13); glow.raycast = () => {}; glow.renderOrder = 2;
    const ring = new THREE.Mesh(svxC.ring, svxMatShell("svxBoltRing" + kind, col, 0.5));
    ring.scale.setScalar(0.4); ring.raycast = () => {}; ring.renderOrder = 2;
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
  const mat = svxMatShell("svxShard" + col, col, 0.55);
  for (let i = 0; i < n; i++) {
    const m = new THREE.Mesh(svxC.shard, mat);
    m.raycast = () => {};
    const along = dir ? 4 + Math.random() * spread : 0;
    m.position.set(
      p.x + (dir ? dir.x * along : 0) + (Math.random() - 0.5) * (dir ? 2.4 : 0.4),
      Math.max(0.1, p.y + (dir ? dir.y * along : 0) + (Math.random() - 0.5) * 2.2),
      p.z + (dir ? dir.z * along : 0) + (Math.random() - 0.5) * (dir ? 2.4 : 0.4));
    const a = Math.random() * 6.2832, up = dir ? 1.1 : 0.5;
    scene.add(m);
    svxC.anim.push({ m, t0: performance.now(), pt: performance.now(), life: life * 1000, s: 0.5 + Math.random() * 0.5,
      v: new THREE.Vector3(Math.cos(a) * spd * (dir ? 0.25 : 1), up * (0.6 + Math.random()), Math.sin(a) * spd * (dir ? 0.25 : 1)),
      rx: (Math.random() - 0.5) * 2.4, ry: (Math.random() - 0.5) * 2.4 });
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
    if (s.fx) { // shader / fade lane: no velocity, no gravity
      if (s.mat.uniforms) { s.mat.uniforms.uT.value += dt; s.mat.uniforms.uOp.value = s.op0 * (1 - u * u); }
      else s.mat.opacity = s.op0 * (1 - u);
      if (s.bill) s.m.lookAt(camera.position);
      if (s.axis) svxOrient(s.m, s.axis);
      if (s.grow) s.m.scale.setScalar(s.s * (1 + s.grow * u));
      continue;
    }
    s.m.position.addScaledVector(s.v, dt);
    s.v.y -= 2.5 * dt; // sparks sink a little
    s.m.rotation.x += s.rx; s.m.rotation.y += s.ry;
    s.m.scale.setScalar(s.s * (1 - u * 0.7));
  }
}
// ---- END SOVA FX ----

function svxAnimN() { return svxC.anim.length + (window.__svxErr ? " ERR " + window.__svxErr : ""); }
function svxDumpEnds() {
  const out = [];
  for (const s of svxC.anim) {
    if (!s.axis) continue;
    s.m.updateMatrixWorld(true);
    const a = s.m.localToWorld(new THREE.Vector3(0, -31, 0));
    const b = s.m.localToWorld(new THREE.Vector3(0, 31, 0));
    out.push([a, b].map(v => v.toArray().map(n => +n.toFixed(1)).join(",")).join(" -> "));
  }
  return out.join(" ;; ");
}
function svxDump() {
  if (svxC.lastF) return JSON.stringify(svxC.lastF);
  return svxC.anim.map(s => {
    const m = s.m;
    return [m.geometry && m.geometry.type, m.position.toArray().map(v => +v.toFixed(1)).join(","), "s" + m.scale.x.toFixed(2), "op" + (m.material.uniforms ? m.material.uniforms.uOp.value : m.material.opacity).toFixed(2), "vis" + m.visible, "par" + (m.parent === scene)].join("|");
  }).join(" ;; ");
}
