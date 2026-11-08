// ---- GEKKO FX ----
// Gekko ability visuals (work/gekko_fx_runtime.js), reference-grounded in the wiki showcase clips
// (wiki.playvalorant.com/en-us/images/Mosh_Pit_Showcase.mp4, Wingman_Showcase.mp4,
// Dizzy_Showcase.mp4, Thrash_Showcase.mp4; frame sheets reviewed 2026-11-04).
// Procedural approximation, not extracted game assets. Mechanics (damage, stun, blind, detain,
// reclaim rules) stay in the caller; this module draws only.
//   Mosh Pit: green blob creature lobbed; pool = dark-green lobed goo with bubbling lumps; boom = goo geyser.
//   Wingman: yellow blob runner with little wings; boom = yellow-white star flash (plant/defuse cue).
//   Dizzy: blue winged blob flyer; bolt = blue energy streak; pop = blue splash (blind cue).
//   Thrash: big pink-red spectral shark, swishing tail; boom = pink splash + detain tendrils.
//   Globules: glowing blue-green reclaim orbs with a soft ring.
// Contract: entries take world positions, return a handle with .end() (movers also .move(...)).
// Game-dt driven: gkxUseGameTick() once, then gkxTick(dt) per frame; otherwise a rAF pump runs
// while effects exist. Cloned per-effect materials disposed on end; shared geometry/programs persist.
// Globals used (read-only): THREE, scene, camera?, document?. gkxReset() ends every live effect.
var gkxU = { value: 0 }, gkxLive = [], gkxPumpOn = false, gkxGT = false, gkxGeo = null, gkxProg = {};
function gkxGeos() { if (gkxGeo) return gkxGeo; gkxGeo = {
  sph: new THREE.SphereGeometry(1, 20, 14),
  ring: new THREE.RingGeometry(0.86, 1, 48),
  torus: new THREE.TorusGeometry(1, 0.06, 8, 40),
  cone: new THREE.ConeGeometry(0.5, 1, 6),
  plane: new THREE.PlaneGeometry(1, 1, 1, 4) }; for (const k in gkxGeo) gkxGeo[k].userData.shared = true; return gkxGeo; }
function gkxShader(k, frag, opts) { if (gkxProg[k]) return gkxProg[k]; const m = new THREE.ShaderMaterial(Object.assign({
  uniforms: { uT: gkxU, uP: { value: 0 }, uSeed: { value: 0 }, uA: { value: 1 } },
  vertexShader: "uniform float uT;uniform float uP;uniform float uSeed;varying vec3 vN;varying vec3 vV;varying vec3 vP;varying vec2 vUv;void main(){vUv=uv;vP=position;vec4 mv=modelViewMatrix*vec4(position,1.0);vV=-mv.xyz;vN=normalMatrix*normal;gl_Position=projectionMatrix*mv;}",
  fragmentShader: frag, transparent: true, depthWrite: false, side: THREE.DoubleSide }, opts || {}));
  gkxProg[k] = m; return m; }
// creature skin: glossy colored blob with lighter belly, subtle wobble sheen. uSeed picks palette slot via uCol uniforms baked per clone.
const gkxBLOB = "uniform float uT;uniform float uP;uniform float uSeed;uniform float uA;varying vec3 vN;varying vec3 vV;varying vec3 vP;varying vec2 vUv;uniform vec3 uColA;uniform vec3 uColB;void main(){float f=pow(1.0-abs(dot(normalize(vN),normalize(vV))),1.5);float belly=smoothstep(0.4,-0.5,vP.y);float sheen=0.5+0.5*sin(vP.x*6.0+uT*3.0+uSeed)*sin(vP.y*5.0-uT*2.0);vec3 c=mix(uColA,uColB,belly*0.7+sheen*0.15);c+=vec3(1.0)*f*f*0.35;float a=(0.92+0.08*f)*uA*(1.0-uP);if(a<0.004)discard;gl_FragColor=vec4(c,a);}";
// goo pool: dark lobed surface, bubbling sheen
const gkxGOO = "uniform float uT;uniform float uP;uniform float uSeed;uniform float uA;varying vec3 vN;varying vec3 vV;varying vec3 vP;varying vec2 vUv;void main(){float x=vUv.x-0.5,y=vUv.y-0.5;float r=length(vec2(x,y))*2.0;float lobe=0.82+0.10*sin(atan(y,x)*7.0+uSeed)+0.06*sin(atan(y,x)*13.0-uT*0.8);float edge=1.0-smoothstep(lobe-0.12,lobe,r);float bub=0.5+0.5*sin(x*31.0+uT*2.6+uSeed)*sin(y*27.0-uT*2.1);vec3 c=mix(vec3(0.07,0.30,0.04),vec3(0.30,0.70,0.10),bub*0.4+pow(1.0-r,2.0)*0.25);c+=vec3(0.45,0.95,0.25)*pow(bub,7.0)*0.45;float a=edge*0.94*uA*(1.0-uP);if(a<0.004)discard;gl_FragColor=vec4(c,a);}";
// spectral shark skin: hot pink-red energy, white-hot fresnel rim, flame stripes
const gkxSHARK = "uniform float uT;uniform float uP;uniform float uSeed;uniform float uA;varying vec3 vN;varying vec3 vV;varying vec3 vP;varying vec2 vUv;void main(){float f=pow(1.0-abs(dot(normalize(vN),normalize(vV))),1.4);float flame=0.5+0.5*sin(vUv.y*16.0+vP.x*5.0-uT*4.0+uSeed);vec3 c=mix(vec3(0.55,0.04,0.22),vec3(1.0,0.35,0.55),flame*0.45+f*0.5);c+=vec3(1.0,0.75,0.85)*f*f*0.5;float a=(0.5+0.45*f)*(0.85+0.15*flame)*uA*(1.0-uP);if(a<0.004)discard;gl_FragColor=vec4(c,a);}";
// detain tendril: pink-red ribbon
const gkxTETH = "uniform float uT;uniform float uP;uniform float uSeed;uniform float uA;varying vec3 vN;varying vec3 vV;varying vec3 vP;varying vec2 vUv;void main(){float x=vUv.x,y=vUv.y;float sway=sin(x*8.0-uT*5.0+uSeed*8.0)*0.14;float across=smoothstep(0.0,0.25,y+sway)*(1.0-smoothstep(0.75+sway,1.0,y+sway));float tail=1.0-x;float flow=0.6+0.4*sin(x*19.0-uT*7.0+uSeed);vec3 c=mix(vec3(0.45,0.05,0.20),vec3(1.0,0.45,0.60),pow(tail,1.7));float a=across*(0.25+0.75*tail)*flow*uA*(1.0-uP);if(a<0.004)discard;gl_FragColor=vec4(c,a);}";
var gkxGlowTex = null, gkxMoteTex = null;
function gkxTexGlow() { if (gkxGlowTex) return gkxGlowTex; const c = document.createElement("canvas"); c.width = c.height = 128; const g = c.getContext("2d");
  const r = g.createRadialGradient(64, 64, 2, 64, 64, 62); r.addColorStop(0, "rgba(255,255,255,1)"); r.addColorStop(0.35, "rgba(255,255,255,0.5)"); r.addColorStop(1, "rgba(255,255,255,0)"); g.fillStyle = r; g.fillRect(0, 0, 128, 128);
  gkxGlowTex = new THREE.CanvasTexture(c); return gkxGlowTex; }
function gkxTexMote() { if (gkxMoteTex) return gkxMoteTex; const c = document.createElement("canvas"); c.width = c.height = 64; const g = c.getContext("2d");
  const r = g.createRadialGradient(32, 32, 1, 32, 32, 30); r.addColorStop(0, "rgba(255,255,255,1)"); r.addColorStop(0.5, "rgba(255,255,255,0.55)"); r.addColorStop(1, "rgba(255,255,255,0)"); g.fillStyle = r; g.fillRect(0, 0, 64, 64);
  gkxMoteTex = new THREE.CanvasTexture(c); return gkxMoteTex; }
function gkxMat(k, shader, seed, colA, colB, opts) { const m = gkxShader(k, shader, opts).clone(); m.uniforms.uT = gkxU; if (seed !== undefined) m.uniforms.uSeed.value = seed;
  if (colA !== undefined) { m.uniforms.uColA = { value: new THREE.Vector3(...colA) }; m.uniforms.uColB = { value: new THREE.Vector3(...colB) }; } return m; }
// gkxBLOB needs palette uniforms on the shared program too (first creation)
function gkxBlobMat(seed, colA, colB) { const m = gkxShader("blob", gkxBLOB).clone(); m.uniforms.uT = gkxU; m.uniforms.uSeed.value = seed;
  m.uniforms.uColA = { value: new THREE.Vector3(...colA) }; m.uniforms.uColB = { value: new THREE.Vector3(...colB) }; return m; }
function gkxBasic(c, o, add) { return new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: o, depthWrite: false, blending: add ? THREE.AdditiveBlending : THREE.NormalBlending, side: THREE.DoubleSide }); }
function gkxGlow(c, o, s, add) { const m = new THREE.SpriteMaterial({ map: gkxTexGlow(), color: c, transparent: true, opacity: o, depthWrite: false, blending: add === false ? THREE.NormalBlending : THREE.AdditiveBlending }); const sp = new THREE.Sprite(m); sp.scale.setScalar(s || 1); return sp; }
function gkxFree(objs) { objs.forEach((o) => { try { scene.remove(o); o.traverse((q) => { if (q.material && q.material.dispose) q.material.dispose(); if (q.geometry && q.geometry.userData && q.geometry.userData.own) q.geometry.dispose(); }); } catch (e) {} }); }
function gkxPush(fx) { if (gkxLive.length > 24) { const o = gkxLive.shift(); try { o.done(); } catch (e) {} } gkxLive.push(fx); if (!gkxGT && !gkxPumpOn) { gkxPumpOn = true; gkxPump.last = null; requestAnimationFrame(gkxPump); } return fx; }
function gkxStep(dt) { gkxU.value += dt; for (let i = gkxLive.length - 1; i >= 0; i--) { const fx = gkxLive[i]; fx.age += dt; try { fx.tick(dt, fx.age, Math.min(1, fx.age / fx.ttl)); } catch (e) { try { xE(e); } catch (e2) {} }
  if (fx.age >= fx.ttl) { try { fx.done(); } catch (e) {} gkxLive.splice(i, 1); } } }
function gkxPump() { if (gkxGT) { gkxPumpOn = false; return; } const now = (function () { try { return performance.now() / 1000; } catch (e) { return Date.now() / 1000; } })();
  const dt = Math.min(0.1, Math.max(0.0005, now - (gkxPump.last || now))); gkxPump.last = now; gkxStep(dt);
  if (gkxLive.length) requestAnimationFrame(gkxPump); else gkxPumpOn = false; }
function gkxUseGameTick() { gkxGT = true; gkxPumpOn = false; }
function gkxTick(dt) { gkxStep(dt); }
function gkxEnd(h) { if (!h || !h.fx) return; const i = gkxLive.indexOf(h.fx); if (i >= 0) gkxLive.splice(i, 1); try { h.fx.done(); } catch (e) {} }
function gkxReset() { while (gkxLive.length) gkxEnd({ fx: gkxLive[0] }); try { document.querySelectorAll(".gkxV").forEach((e) => e.remove()); } catch (e) {} }
function gkxFx(ttl, objs, tick, done) { const fx = { age: 0, ttl, objs, tick: tick || function () {}, done: done || function () { gkxFree(objs); } }; objs.forEach((o) => scene.add(o)); gkxPush(fx); return { fx, end: function () { gkxEnd(this); } }; }
function gkxErr(e) { try { xE(e); } catch (e2) {} return null; }
function gkxSparks(p, n, col, speed, size) { try { const N = n || 18, pos = new Float32Array(N * 3), vel = [];
  for (let i = 0; i < N; i++) { const a = Math.random() * 6.28, b = Math.random() * 1.2, s = (speed || 4) * (0.5 + Math.random()); vel.push([Math.cos(a) * Math.sin(b) * s, Math.cos(b) * s, Math.sin(a) * Math.sin(b) * s]); }
  const pg = new THREE.BufferGeometry(); pg.userData.own = 1; pg.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const pts = new THREE.Points(pg, new THREE.PointsMaterial({ map: gkxTexMote(), color: col, size: size || 0.3, transparent: true, opacity: 1, depthWrite: false, blending: THREE.AdditiveBlending }));
  pts.position.set(p.x, p.y, p.z);
  return gkxFx(0.8, [pts], (dt, age, k) => { const a3 = pg.attributes.position.array; for (let i = 0; i < N; i++) { vel[i][1] -= 6 * dt; a3[i * 3] += vel[i][0] * dt; a3[i * 3 + 1] += vel[i][1] * dt; a3[i * 3 + 2] += vel[i][2] * dt; }
    pg.attributes.position.needsUpdate = true; pts.material.opacity = 1 - k; });
 } catch (e) { return gkxErr(e); } }
// ---- entries ----
// Mosh Pit: the lobbed green blob. move() follows the arc; on land the caller swaps to gkxMoshPool.
function gkxMoshThrow(x, y, z) { try { const G = gkxGeos(), g = new THREE.Group();
  const body = new THREE.Mesh(G.sph, gkxBlobMat(1.1, [0.14, 0.45, 0.06], [0.45, 0.88, 0.16])); body.scale.setScalar(0.26); g.add(body);
  for (let i = 0; i < 5; i++) { const bump = new THREE.Mesh(G.sph, body.material); const a = i / 5 * 6.28; bump.scale.setScalar(0.09);
    bump.position.set(Math.cos(a) * 0.2, Math.sin(i * 2.4) * 0.16, Math.sin(a) * 0.2); g.add(bump); }
  const glow = gkxGlow(0x5ad01a, 0.3, 0.9); g.add(glow);
  g.position.set(x, y, z);
  const h = gkxFx(1e9, [g], (dt) => { body.rotation.x += dt * 6; body.rotation.z += dt * 4; body.scale.setScalar(0.26 * (1 + 0.08 * Math.sin(gkxU.value * 10))); });
  h.move = function (nx, ny, nz) { g.position.set(nx, ny, nz); };
  return h; } catch (e) { return gkxErr(e); } }
// Mosh pool: lobed dark-green goo, bubbling lumps rising. seconds = pit duration; end shrinks it.
function gkxMoshPool(p, r, seconds) { try { const G = gkxGeos(), grp = new THREE.Group(); grp.position.set(p.x, p.y || 0, p.z); const R = r || 3.5, TTL = seconds || 3.6;
  const goo = new THREE.Mesh(G.plane, gkxMat("goo", gkxGOO, Math.random() * 10)); goo.rotation.x = -Math.PI / 2; goo.scale.setScalar(R * 2.4); goo.position.y = 0.07; grp.add(goo);
  const lumps = []; for (let i = 0; i < 10; i++) { const a = Math.random() * 6.28, rr = Math.sqrt(Math.random()) * R * 0.75;
    const l = new THREE.Mesh(G.sph, gkxBlobMat(3 + i, [0.12, 0.42, 0.05], [0.42, 0.85, 0.14])); l.position.set(Math.cos(a) * rr, -0.1, Math.sin(a) * rr);
    l.userData.s = 0.12 + Math.random() * 0.14; l.userData.ph = Math.random() * 6.28; grp.add(l); lumps.push(l); }
  const h = gkxFx(TTL, [grp], (dt, age) => { const gin = Math.min(1, age / 0.4), gout = Math.min(1, Math.max(0, (TTL - age) / 0.45)), gg = gin * gout;
    goo.material.uniforms.uA.value = gg; goo.scale.setScalar(R * 2.4 * (0.6 + 0.4 * gin));
    lumps.forEach((l) => { const b = 0.5 + 0.5 * Math.sin(gkxU.value * 2.4 + l.userData.ph); l.scale.setScalar(l.userData.s * (0.3 + 0.7 * b) * gg); l.position.y = -0.04 + b * 0.26; }); });
  return h; } catch (e) { return gkxErr(e); } }
// Mosh boom: the pit detonates - goo geyser + green shock ring.
function gkxMoshBoom(p, r) { try { const G = gkxGeos(), grp = new THREE.Group(); grp.position.set(p.x, p.y || 0, p.z); const R = r || 3.5;
  const gey = new THREE.Mesh(G.cone, gkxMat("gooB", gkxGOO, 7.7)); gey.scale.set(R * 0.8, 0.3, R * 0.8); gey.position.y = 0.2; grp.add(gey);
  const gey2 = new THREE.Mesh(G.cone, gey.material); gey2.scale.set(R * 0.35, 0.2, R * 0.35); gey2.position.set(R * 0.35, 0.15, -R * 0.2); grp.add(gey2);
  const gey3 = new THREE.Mesh(G.cone, gey.material); gey3.scale.set(R * 0.3, 0.2, R * 0.3); gey3.position.set(-R * 0.3, 0.15, R * 0.3); grp.add(gey3);
  const flash = gkxGlow(0x8aff4a, 0.9, 3); flash.position.y = 0.8; grp.add(flash);
  gkxSparks({ x: p.x, y: (p.y || 0) + 0.4, z: p.z }, 22, 0x7aff3a, 5, 0.34);
  return gkxFx(0.7, [grp], (dt, age, k) => { gey.scale.y = 0.3 + Math.sin(Math.min(1, k * 1.4) * Math.PI) * 3.2; gey.material.uniforms.uP.value = k * 0.8;
       gey2.scale.y = 0.2 + Math.sin(Math.min(1, Math.max(0, k * 1.4 - 0.15)) * Math.PI) * 2.2; gey3.scale.y = 0.2 + Math.sin(Math.min(1, Math.max(0, k * 1.4 - 0.3)) * Math.PI) * 1.8; flash.material.opacity = 0.9 * Math.max(0, 1 - k * 1.8); flash.scale.setScalar(3 + k * 2); });
 } catch (e) { return gkxErr(e); } }
// Wingman: yellow blob runner with little wings and feet nubs. move(x, y, z, yaw) steers.
function gkxWingman(x, y, z, yaw) { try { const G = gkxGeos(), g = new THREE.Group();
  const body = new THREE.Mesh(G.sph, gkxBlobMat(2.2, [0.55, 0.34, 0.02], [1.0, 0.78, 0.20])); body.scale.set(0.32, 0.36, 0.30); body.position.y = 0.36; g.add(body);
  const plate = new THREE.Mesh(G.sph, gkxBasic(0x2b2e35, 1, false)); plate.scale.set(0.27, 0.17, 0.26); plate.position.set(0, 0.58, -0.05); g.add(plate);
  const brow = new THREE.Mesh(G.sph, gkxBasic(0x23262c, 1, false)); brow.scale.set(0.28, 0.10, 0.15); brow.position.set(0, 0.53, -0.22); g.add(brow);
  [-1, 1].forEach((s) => { const eye = new THREE.Mesh(G.sph, gkxBasic(0xd8ffd0, 1, true)); eye.scale.set(0.05, 0.035, 0.03); eye.position.set(s * 0.09, 0.50, -0.33); g.add(eye); });
  [-1, 1].forEach((s) => { const horn = new THREE.Mesh(G.cone, gkxBasic(0xf5c832, 1, false)); horn.scale.set(0.06, 0.18, 0.06); horn.position.set(s * 0.16, 0.72, 0.03); horn.rotation.z = -s * 0.55; g.add(horn); });
  const wings = []; [-1, 1].forEach((s) => {
    const w1 = new THREE.Mesh(G.sph, gkxBasic(0x37335f, 1, false)); w1.scale.set(0.09, 0.20, 0.24); w1.position.set(s * 0.34, 0.42, 0.04); w1.rotation.z = s * 0.35; g.add(w1);
    const w2 = new THREE.Mesh(G.sph, gkxBasic(0x2a2848, 1, false)); w2.scale.set(0.08, 0.16, 0.20); w2.position.set(s * 0.40, 0.36, 0.12); w2.rotation.z = s * 0.5; g.add(w2);
    wings.push(w1, w2); });
  const feet = []; [-1, 1].forEach((s) => { const f = new THREE.Mesh(G.sph, body.material); f.scale.set(0.09, 0.08, 0.13); f.position.set(s * 0.13, 0.06, 0); g.add(f); feet.push(f); });
  const glow = gkxGlow(0xffd24a, 0.35, 0.9); glow.position.y = 0.3; g.add(glow);
  g.position.set(x, y, z); g.rotation.y = yaw || 0;
  let lx = x, lz = z, stride = 0;
  const h = gkxFx(1e9, [g], (dt) => { const dx = g.position.x - lx, dz = g.position.z - lz; lx = g.position.x; lz = g.position.z;
    stride += Math.hypot(dx, dz) * 11; const run = Math.min(1, Math.hypot(dx, dz) / Math.max(1e-5, dt) / 3.5);
    body.position.y = 0.36 + Math.abs(Math.sin(stride)) * 0.1 * run; body.rotation.z = Math.sin(stride) * 0.12 * run;
    wings.forEach((w, i) => { const s = i < 2 ? -1 : 1; w.rotation.z = s * (0.4 + Math.sin(gkxU.value * 12 + (i % 2)) * 0.18); });
    feet.forEach((f, i) => { f.position.y = 0.05 + Math.max(0, Math.sin(stride + i * Math.PI)) * 0.06 * run; }); });
  h.move = function (nx, ny, nz, yw) { g.position.set(nx, ny, nz); if (yw !== undefined) g.rotation.y = yw; };
  return h; } catch (e) { return gkxErr(e); } }
// Wingman boom: yellow-white star flash (plant/defuse complete cue).
function gkxWingmanBoom(p) { try { const G = gkxGeos(), grp = new THREE.Group(); grp.position.set(p.x, (p.y || 0) + 0.5, p.z);
  const flash = gkxGlow(0xfff2c8, 1, 2.6); grp.add(flash);
  const blades = []; for (let i = 0; i < 6; i++) { const b = new THREE.Mesh(G.plane, gkxBasic(0xffe27a, 0.95, true)); b.scale.set(1.5, 0.14, 1);
    b.rotation.y = i * 1.047; b.translateX(0.75); blades.push(b); grp.add(b); }
  const ring = new THREE.Mesh(G.ring, gkxBasic(0xffd24a, 0.8, true)); grp.add(ring);
  gkxSparks({ x: p.x, y: (p.y || 0) + 0.5, z: p.z }, 16, 0xffe27a, 4, 0.28);
  return gkxFx(0.55, [grp], (dt, age, k) => { flash.material.opacity = 1 - k; flash.scale.setScalar(2.6 + k * 2.4);
    blades.forEach((b) => { b.material.opacity = 0.95 * (1 - k); });
    ring.scale.setScalar(0.3 + k * 3.4); ring.material.opacity = 0.8 * (1 - k); ring.lookAt(camera ? camera.position : grp.position); });
 } catch (e) { return gkxErr(e); } }
// Dizzy: blue winged blob flyer. move(x, y, z, yaw) steers.
function gkxDizzy(x, y, z, yaw) { try { const G = gkxGeos(), g = new THREE.Group();
  const body = new THREE.Mesh(G.sph, gkxBlobMat(3.3, [0.04, 0.22, 0.5], [0.35, 0.72, 1.0])); body.scale.set(0.3, 0.3, 0.34); g.add(body);
  const face = new THREE.Mesh(G.sph, gkxBasic(0xbfe4ff, 0.9, false)); face.scale.set(0.18, 0.15, 0.09); face.position.set(0, 0.02, -0.3); g.add(face);
  [-1, 1].forEach((s) => { const eye = new THREE.Mesh(G.sph, gkxBasic(0x06283f, 1, false)); eye.scale.setScalar(0.055); eye.position.set(s * 0.1, 0.06, -0.4); g.add(eye); });
  const wings = []; [-1, 1].forEach((s) => { const w = new THREE.Mesh(G.sph, gkxBasic(0x3f8fd0, 0.95, false)); w.scale.set(0.36, 0.10, 0.18); w.position.set(s * 0.42, 0.12, 0.02); w.rotation.z = s * 0.5; g.add(w); wings.push(w); });
  const tail = new THREE.Mesh(G.cone, body.material); tail.scale.set(0.08, 0.3, 0.08); tail.rotation.x = 2.2; tail.position.set(0, 0, 0.32); g.add(tail);
  const glow = gkxGlow(0x5ab4ff, 0.5, 0.95); g.add(glow);
  g.position.set(x, y, z); g.rotation.y = yaw || 0;
  const h = gkxFx(1e9, [g], (dt) => { wings.forEach((w, i) => { const s = i ? 1 : -1; w.rotation.z = s * (0.5 + Math.sin(gkxU.value * 16) * 0.4); });
    body.rotation.z = Math.sin(gkxU.value * 3) * 0.1; glow.material.opacity = 0.4 + 0.15 * Math.sin(gkxU.value * 7); });
  h.move = function (nx, ny, nz, yw) { g.position.set(nx, ny, nz); if (yw !== undefined) g.rotation.y = yw; };
  return h; } catch (e) { return gkxErr(e); } }
// Dizzy bolt: blue energy streak from the creature to the victim.
function gkxDizzyBolt(from, to) { try { const G = gkxGeos(), d = new THREE.Vector3(to.x - from.x, to.y - from.y, to.z - from.z), len = d.length(), mid = new THREE.Vector3((from.x + to.x) / 2, (from.y + to.y) / 2, (from.z + to.z) / 2);
  const bolt = new THREE.Mesh(G.plane, gkxBasic(0x8fd8ff, 0.95, true)); bolt.scale.set(len, 0.1, 1);
  bolt.position.copy(mid); bolt.lookAt(to.x, to.y, to.z); bolt.rotateY(Math.PI / 2);
  const head = gkxGlow(0xbfe8ff, 0.95, 0.8); head.position.set(to.x, to.y, to.z);
  return gkxFx(0.35, [bolt, head], (dt, age, k) => { bolt.material.opacity = 0.95 * (1 - k); bolt.scale.y = 0.1 * (1 - k * 0.6);
    head.material.opacity = 0.95 * (1 - k); head.scale.setScalar(0.8 + k * 1.2); });
 } catch (e) { return gkxErr(e); } }
// Thrash: the big steered pink-red spectral shark. move(x, y, z, yaw) steers; gkxThrashBoom on detonate.
function gkxThrash(x, y, z, yaw) { try { const G = gkxGeos(), g = new THREE.Group();
  const skin = gkxMat("shark", gkxSHARK, 1.7);
  const body = new THREE.Mesh(G.sph, skin); body.scale.set(0.5, 0.5, 1.15); body.position.y = 0.55; g.add(body);
  const snout = new THREE.Mesh(G.cone, skin); snout.scale.set(0.34, 0.6, 0.34); snout.rotation.x = -Math.PI / 2; snout.position.set(0, 0.55, -1.3); g.add(snout);
  const jaw = new THREE.Mesh(G.cone, gkxBasic(0xffd8e8, 0.9, true)); jaw.scale.set(0.2, 0.35, 0.2); jaw.rotation.x = -Math.PI / 2 + 0.5; jaw.position.set(0, 0.34, -1.15); g.add(jaw);
  const fin = new THREE.Mesh(G.cone, skin); fin.scale.set(0.1, 0.5, 0.34); fin.position.set(0, 1.1, 0.1); g.add(fin);
  [-1, 1].forEach((s) => { const pf = new THREE.Mesh(G.plane, skin); pf.scale.set(0.5, 0.3, 1); pf.position.set(s * 0.55, 0.45, -0.3); pf.rotation.z = s * 0.8; g.add(pf); });
  const tail = new THREE.Mesh(G.plane, skin); tail.scale.set(0.55, 0.7, 1); tail.position.set(0, 0.6, 1.35); g.add(tail);
  const glow = gkxGlow(0xff5aa8, 0.5, 2.4); glow.position.y = 0.55; g.add(glow);
  g.position.set(x, y, z); g.rotation.y = yaw || 0;
  const h = gkxFx(1e9, [g], (dt) => { tail.rotation.y = Math.sin(gkxU.value * 5.5) * 0.55; body.rotation.z = Math.sin(gkxU.value * 5.5 - 0.6) * 0.08;
    jaw.rotation.x = -Math.PI / 2 + 0.5 + Math.sin(gkxU.value * 2.2) * 0.18; glow.material.opacity = 0.4 + 0.15 * Math.sin(gkxU.value * 6); });
  h.move = function (nx, ny, nz, yw) { g.position.set(nx, ny, nz); if (yw !== undefined) g.rotation.y = yw; };
  return h; } catch (e) { return gkxErr(e); } }
// Thrash boom: pink splash explosion + a ring of detain tendrils.
function gkxThrashBoom(p, r) { try { const G = gkxGeos(), grp = new THREE.Group(); grp.position.set(p.x, (p.y || 0) + 0.6, p.z); const R = r || 4;
  const flash = gkxGlow(0xff7ab8, 1, 3.4); grp.add(flash);
  const shell = new THREE.Mesh(G.sph, gkxMat("sharkB", gkxSHARK, 5.5)); shell.scale.setScalar(0.4); grp.add(shell);
  const ring = new THREE.Mesh(G.ring, gkxBasic(0xff5aa8, 0.85, true)); grp.add(ring);
  const teth = []; for (let i = 0; i < 8; i++) { const t = new THREE.Mesh(G.plane, gkxMat("teth", gkxTETH, i * 1.53));
    const a = i / 8 * 6.28; t.scale.set(1.8, 0.3, 1); t.position.set(Math.cos(a) * R * 0.5, 0.2, Math.sin(a) * R * 0.5); t.rotation.z = 0.9; t.rotation.y = -a + Math.PI / 2; grp.add(t); teth.push(t); }
  gkxSparks({ x: p.x, y: (p.y || 0) + 0.7, z: p.z }, 20, 0xff7ab8, 5, 0.3);
  return gkxFx(1.0, [grp], (dt, age, k) => { flash.material.opacity = Math.max(0, 1 - k * 1.7); flash.scale.setScalar(3.4 + k * 3);
    shell.scale.setScalar(0.4 + k * R * 0.55); shell.material.uniforms.uP.value = k;
    ring.scale.setScalar(0.4 + k * R * 1.2); ring.material.opacity = 0.85 * (1 - k); ring.lookAt(camera ? camera.position : grp.position);
    teth.forEach((t) => { t.material.uniforms.uP.value = Math.max(0, (age - 0.25) / 0.7); t.scale.x = 1.8 * (1 - k * 0.4); }); });
 } catch (e) { return gkxErr(e); } }
// Globule: the reclaim orb left after a creature ends. Glowing blue-green orb + soft ring, gentle pulse.
function gkxGlobule(p, seconds) { try { const G = gkxGeos(), grp = new THREE.Group(); grp.position.set(p.x, (p.y || 0), p.z);
  const orb = new THREE.Mesh(G.sph, gkxBasic(0x3fd0c0, 0.85, true)); orb.scale.setScalar(0.16); orb.position.y = 0.55; grp.add(orb);
  const shell = new THREE.Mesh(G.sph, gkxBasic(0xbffff2, 0.35, true)); shell.scale.setScalar(0.24); shell.position.y = 0.55; grp.add(shell);
  const ring = new THREE.Mesh(G.torus, gkxBasic(0x3fd0c0, 0.55, true)); ring.rotation.x = Math.PI / 2; ring.scale.setScalar(0.4); ring.position.y = 0.1; grp.add(ring);
  const glow = gkxGlow(0x5affe0, 0.5, 0.9); glow.position.y = 0.55; grp.add(glow);
  const h = gkxFx(seconds || 20, [grp], (dt, age, k) => { orb.position.y = 0.55 + Math.sin(gkxU.value * 2.2) * 0.07; shell.position.y = orb.position.y; glow.position.y = orb.position.y;
    const pl = 1 + 0.12 * Math.sin(gkxU.value * 3.4); orb.scale.setScalar(0.16 * pl); shell.scale.setScalar(0.24 * pl);
    ring.rotation.z += dt * 1.2; ring.material.opacity = 0.4 + 0.2 * Math.sin(gkxU.value * 2.8);
    orb.material.opacity = 0.85 * (1 - k * k); shell.material.opacity = 0.35 * (1 - k * k); glow.material.opacity = 0.5 * (1 - k); });
  return h; } catch (e) { return gkxErr(e); } }
// optional Thrash control tint (the reference's pink first-person filter). The game's own drone
// overlay (#xDr) may already cover this; call gkxVeil(true) only if it does not.
function gkxVeil(on) { try { if (!on) { document.querySelectorAll(".gkxV").forEach((e) => e.remove()); return; }
  if (!document.getElementById("gkxCss")) { const s = document.createElement("style"); s.id = "gkxCss";
    s.textContent = ".gkxV{position:fixed;inset:0;pointer-events:none;z-index:6;background:radial-gradient(120% 120% at 50% 50%,rgba(90,20,50,0) 55%,rgba(90,15,45,.5) 100%),rgba(255,80,150,.13)}";
    (document.head || document.documentElement).appendChild(s); }
  const d = document.createElement("div"); d.className = "gkxV"; document.body.appendChild(d); } catch (e) {} }
// ---- END GEKKO FX ----
