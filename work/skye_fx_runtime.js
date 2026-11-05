// ---- SKYE FX ----
// Skye ability visuals (work/skye_fx_runtime.js), reference-grounded in the wiki showcase clips
// (wiki.playvalorant.com/en-us/images/Trailblazer_Showcase.mp4, Guiding_Light_Showcase.mp4,
// Regrowth_Showcase.mp4, Seekers_Showcase.mp4; frame sheets reviewed 2026-11-04).
// Procedural approximation, not extracted game assets. Game mechanics (damage, blind, timing,
// sound) stay in the caller; this module draws only.
//   Trailblazer: translucent jade spectral tiger, amber spine glow; leap = amber-green shock burst + red slashes.
//   Guiding Light: spectral green hawk, flapping wings, wisp trails; pop = white-green blinding flash + ring.
//   Regrowth: rising green sparkle motes + amber glints around the healer while it channels.
//   Seekers: small green wisp creatures with trails; reach = green burst.
// Contract: entries take world positions, return a handle with .end() (movers also .move(...)).
// Game-dt driven: skxUseGameTick() once, then skxTick(dt) per frame; otherwise a rAF pump runs
// while effects exist (standalone harness). Cloned per-effect materials are disposed on end;
// shared geometry/programs persist. Globals used (read-only): THREE, scene, camera?, player?, document?.
// skxReset() ends every live effect (round reset / disconnect hook).
var skxU = { value: 0 }, skxLive = [], skxPumpOn = false, skxGT = false, skxGeo = null, skxProg = {};
function skxGeos() { if (skxGeo) return skxGeo; skxGeo = {
  sph: new THREE.SphereGeometry(1, 20, 14),
  ring: new THREE.RingGeometry(0.86, 1, 48),
  torus: new THREE.TorusGeometry(1, 0.05, 8, 48),
  cone: new THREE.ConeGeometry(0.5, 1, 6),
  cyl: new THREE.CylinderGeometry(0.5, 0.5, 1, 8),
  plane: new THREE.PlaneGeometry(1, 1, 1, 4) }; return skxGeo; }
// shared shader programs: uT = clock, uP = effect progress 0..1, uSeed = per-mesh variation, uA = master alpha
function skxShader(k, frag, opts) { if (skxProg[k]) return skxProg[k]; const m = new THREE.ShaderMaterial(Object.assign({
  uniforms: { uT: skxU, uP: { value: 0 }, uSeed: { value: 0 }, uA: { value: 1 } },
  vertexShader: "uniform float uT;uniform float uP;uniform float uSeed;varying vec3 vN;varying vec3 vV;varying vec3 vP;varying vec2 vUv;void main(){vUv=uv;vec3 p=position;vP=p;vec4 mv=modelViewMatrix*vec4(p,1.0);vV=-mv.xyz;vN=normalMatrix*normal;gl_Position=projectionMatrix*mv;}",
  fragmentShader: frag, transparent: true, depthWrite: false, side: THREE.DoubleSide }, opts || {}));
  skxProg[k] = m; return m; }
// spectral creature body: deep green interior, pale jade fresnel rim, faint amber energy veins
const skxSPIRIT = "uniform float uT;uniform float uP;uniform float uSeed;uniform float uA;varying vec3 vN;varying vec3 vV;varying vec3 vP;varying vec2 vUv;void main(){float f=pow(1.0-abs(dot(normalize(vN),normalize(vV))),1.5);float w=sin(vP.y*9.0+uT*2.2+uSeed*7.0)*sin(vP.x*7.0-uT*1.7);float vein=pow(0.5+0.5*sin(vUv.y*22.0+vP.x*6.0+uT*3.0+uSeed),6.0);vec3 c=mix(vec3(0.04,0.30,0.13),vec3(0.55,1.0,0.66),f);c+=vec3(1.0,0.82,0.30)*vein*0.55;c+=vec3(0.65,1.0,0.72)*f*f*0.4;float a=(0.42+0.55*f)*(0.9+0.1*w)*uA;if(a<0.004)discard;gl_FragColor=vec4(c,a);}";
// wisp trail ribbon: bright green core fading along length, ragged edges
const skxWISP = "uniform float uT;uniform float uP;uniform float uSeed;uniform float uA;varying vec3 vN;varying vec3 vV;varying vec3 vP;varying vec2 vUv;void main(){float x=vUv.x,y=vUv.y;float rag=0.09*sin(x*37.0+uSeed*9.0)+0.06*sin(x*61.0-uT*5.0);float across=smoothstep(0.0,0.18+rag,y)*(1.0-smoothstep(0.82+rag,1.0,y));float head=smoothstep(0.0,0.10,x);float tail=1.0-x;vec3 c=mix(vec3(0.10,0.55,0.24),vec3(0.75,1.0,0.72),pow(tail,2.0));float a=across*head*(0.15+0.85*tail)*(0.75+0.25*sin(x*23.0-uT*8.0+uSeed))*uA*(1.0-uP);if(a<0.004)discard;gl_FragColor=vec4(c,a);}";
// red claw slash (Trailblazer leap hit): solid red core, hot edge
const skxSLASHR = "uniform float uT;uniform float uP;uniform float uSeed;uniform float uA;varying vec3 vN;varying vec3 vV;varying vec3 vP;varying vec2 vUv;void main(){float x=vUv.x,y=vUv.y;float rag=0.08*sin(x*41.0+uSeed*9.0);float across=smoothstep(0.0,0.14+rag,y)*(1.0-smoothstep(0.86+rag,1.0,y));float head=smoothstep(0.0,0.08,x);float tail=1.0-x*0.75;vec3 c=mix(vec3(0.60,0.05,0.07),vec3(1.0,0.42,0.35),pow(1.0-x,2.0));float a=across*head*tail*uA*(1.0-uP);if(a<0.004)discard;gl_FragColor=vec4(c,a);}";
// hawk wing: green membrane with scalloped trailing edge and bright leading edge
const skxWING = "uniform float uT;uniform float uP;uniform float uSeed;uniform float uA;varying vec3 vN;varying vec3 vV;varying vec3 vP;varying vec2 vUv;void main(){float x=vUv.x,y=vUv.y;float scallop=0.5+0.5*sin(x*18.849);float edge=smoothstep(0.0,0.10,x)*(1.0-smoothstep(0.55+0.12*scallop,0.98,y));float f=pow(1.0-abs(dot(normalize(vN),normalize(vV))),1.3);vec3 c=mix(vec3(0.07,0.38,0.16),vec3(0.62,1.0,0.62),pow(x,1.6)*0.8+f*0.5);c+=vec3(1.0,0.85,0.35)*pow(1.0-y,3.0)*0.4;float a=edge*(0.35+0.5*f+0.3*x)*uA*(1.0-uP);if(a<0.004)discard;gl_FragColor=vec4(c,a);}";
// soft radial glow sprite texture (canvas, lazy)
var skxGlowTex = null, skxDotTex = null;
function skxTexGlow() { if (skxGlowTex) return skxGlowTex; const c = document.createElement("canvas"); c.width = c.height = 128; const g = c.getContext("2d");
  const r = g.createRadialGradient(64, 64, 2, 64, 64, 62); r.addColorStop(0, "rgba(255,255,255,1)"); r.addColorStop(0.35, "rgba(255,255,255,0.5)"); r.addColorStop(1, "rgba(255,255,255,0)"); g.fillStyle = r; g.fillRect(0, 0, 128, 128);
  skxGlowTex = new THREE.CanvasTexture(c); return skxGlowTex; }
function skxTexMote() { // leaf-ish mote: soft dot with a pointed tip (Regrowth / Seekers sparks)
  if (skxDotTex) return skxDotTex; const c = document.createElement("canvas"); c.width = c.height = 64; const g = c.getContext("2d");
  const r = g.createRadialGradient(32, 32, 1, 32, 32, 30); r.addColorStop(0, "rgba(255,255,255,1)"); r.addColorStop(0.5, "rgba(255,255,255,0.55)"); r.addColorStop(1, "rgba(255,255,255,0)"); g.fillStyle = r; g.fillRect(0, 0, 64, 64);
  g.fillStyle = "rgba(255,255,255,0.9)"; g.beginPath(); g.moveTo(32, 6); g.quadraticCurveTo(44, 26, 32, 40); g.quadraticCurveTo(20, 26, 32, 6); g.fill();
  skxDotTex = new THREE.CanvasTexture(c); return skxDotTex; }
function skxMat(k, shader, seed, opts) { const m = skxShader(k, shader, opts).clone(); m.uniforms.uT = skxU; if (seed !== undefined) m.uniforms.uSeed.value = seed; return m; }
function skxBasic(c, o, add) { return new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: o, depthWrite: false, blending: add ? THREE.AdditiveBlending : THREE.NormalBlending, side: THREE.DoubleSide }); }
function skxGlow(c, o, s) { const m = new THREE.SpriteMaterial({ map: skxTexGlow(), color: c, transparent: true, opacity: o, depthWrite: false, blending: THREE.AdditiveBlending }); const sp = new THREE.Sprite(m); sp.scale.setScalar(s || 1); return sp; }
function skxFree(objs) { objs.forEach((o) => { try { scene.remove(o); o.traverse((q) => { if (q.material && q.material.dispose) q.material.dispose(); if (q.geometry && q.geometry.userData && q.geometry.userData.own) q.geometry.dispose(); }); } catch (e) {} }); }
function skxPush(fx) { if (skxLive.length > 24) { const o = skxLive.shift(); try { o.done(); } catch (e) {} } skxLive.push(fx); if (!skxGT && !skxPumpOn) { skxPumpOn = true; skxPump.last = null; requestAnimationFrame(skxPump); } return fx; }
function skxStep(dt) { skxU.value += dt; for (let i = skxLive.length - 1; i >= 0; i--) { const fx = skxLive[i]; fx.age += dt; try { fx.tick(dt, fx.age, Math.min(1, fx.age / fx.ttl)); } catch (e) { try { xE(e); } catch (e2) {} }
  if (fx.age >= fx.ttl) { try { fx.done(); } catch (e) {} skxLive.splice(i, 1); } } }
function skxPump() { if (skxGT) { skxPumpOn = false; return; } const now = (function () { try { return performance.now() / 1000; } catch (e) { return Date.now() / 1000; } })();
  const dt = Math.min(0.1, Math.max(0.0005, now - (skxPump.last || now))); skxPump.last = now; skxStep(dt);
  if (skxLive.length) requestAnimationFrame(skxPump); else skxPumpOn = false; }
function skxUseGameTick() { skxGT = true; skxPumpOn = false; } // integrator then calls skxTick(dt) per frame
function skxTick(dt) { skxStep(dt); }
function skxEnd(h) { if (!h || !h.fx) return; const i = skxLive.indexOf(h.fx); if (i >= 0) skxLive.splice(i, 1); try { h.fx.done(); } catch (e) {} }
function skxReset() { while (skxLive.length) skxEnd({ fx: skxLive[0] }); try { document.querySelectorAll(".skxV").forEach((e) => e.remove()); } catch (e) {} }
function skxFx(ttl, objs, tick, done) { const fx = { age: 0, ttl, objs, tick: tick || function () {}, done: done || function () { skxFree(objs); } }; objs.forEach((o) => scene.add(o)); skxPush(fx); return { fx, end: function () { skxEnd(this); } }; }
function skxErr(e) { try { xE(e); } catch (e2) {} return null; }
// ---- creature builders (spectral: shared SPIRIT material, cloned per creature) ----
function skxTiger() { const G = skxGeos(), g = new THREE.Group(), body = skxMat("spirit", skxSPIRIT, 1.3);
  const torso = new THREE.Mesh(G.sph, body); torso.scale.set(0.34, 0.30, 0.62); torso.position.y = 0.52; g.add(torso);
  const chest = new THREE.Mesh(G.sph, body); chest.scale.set(0.30, 0.30, 0.30); chest.position.set(0, 0.55, -0.48); g.add(chest);
  const head = new THREE.Mesh(G.sph, body); head.scale.set(0.22, 0.20, 0.24); head.position.set(0, 0.72, -0.72); g.add(head);
  const snout = new THREE.Mesh(G.cone, body); snout.scale.set(0.22, 0.3, 0.22); snout.rotation.x = -Math.PI / 2; snout.position.set(0, 0.68, -0.94); g.add(snout);
  [-1, 1].forEach((s) => { const ear = new THREE.Mesh(G.cone, body); ear.scale.set(0.10, 0.16, 0.10); ear.position.set(s * 0.12, 0.88, -0.66); g.add(ear); });
  const legs = []; [[-0.16, -0.38], [0.16, -0.38], [-0.16, 0.36], [0.16, 0.36]].forEach(([x, z]) => { const l = new THREE.Mesh(G.cyl, body); l.scale.set(0.11, 0.5, 0.11); l.position.set(x, 0.25, z); g.add(l); legs.push(l); });
  const tail = new THREE.Mesh(G.cone, body); tail.scale.set(0.09, 0.55, 0.09); tail.rotation.x = 2.3; tail.position.set(0, 0.62, 0.66); g.add(tail);
  for (let i = 0; i < 4; i++) { const sp = new THREE.Mesh(G.cone, skxMat("spiritS", skxSPIRIT, 5 + i)); sp.scale.set(0.08, 0.22 - i * 0.03, 0.08); sp.position.set(0, 0.82 - i * 0.02, -0.3 + i * 0.26); sp.material.uniforms.uA.value = 0.9; g.add(sp); } // amber-veined dorsal spikes
  const glow = skxGlow(0x63ff9a, 0.5, 1.1); glow.position.y = 0.55; g.add(glow);
  return { g, legs, tail, body, glow }; }
function skxBird() { const G = skxGeos(), g = new THREE.Group(), body = skxMat("spiritB", skxSPIRIT, 3.1);
  const torso = new THREE.Mesh(G.sph, body); torso.scale.set(0.16, 0.15, 0.34); g.add(torso);
  const head = new THREE.Mesh(G.sph, body); head.scale.setScalar(0.11); head.position.set(0, 0.05, -0.34); g.add(head);
  const beak = new THREE.Mesh(G.cone, skxBasic(0xffd24a, 0.9, true)); beak.scale.set(0.06, 0.16, 0.06); beak.rotation.x = -Math.PI / 2; beak.position.set(0, 0.04, -0.48); g.add(beak);
  const wings = []; [-1, 1].forEach((s) => { const w = new THREE.Mesh(G.plane, skxMat("wing", skxWING, s)); w.scale.set(0.85, 0.42, 1); w.position.set(s * 0.45, 0.06, 0.02); w.rotation.z = s * 0.12; if (s < 0) w.scale.x *= -1; g.add(w); wings.push(w); });
  const tail = new THREE.Mesh(G.plane, skxMat("wingT", skxWING, 7)); tail.scale.set(0.3, 0.34, 1); tail.rotation.x = 0.35; tail.position.set(0, 0.02, 0.42); g.add(tail);
  const trails = []; [-1, 1].forEach((s) => { const tm = skxMat("wisp", skxWISP, s * 2.7); [Math.PI / 2, 0].forEach((rx, pi) => { const t = new THREE.Mesh(G.plane, pi ? tm : tm.clone()); t.material.uniforms.uT = skxU; t.scale.set(1.5, pi ? 0.16 : 0.22, 1); t.position.set(s * 0.55, 0.04, 0.85); t.rotation.x = rx; if (!pi) t.rotation.y = Math.PI / 2; g.add(t); trails.push(t); }); });
  const glow = skxGlow(0x63ff9a, 0.6, 0.9); g.add(glow);
  return { g, wings, trails, glow }; }
function skxWisp() { const G = skxGeos(), g = new THREE.Group();
  const core = new THREE.Mesh(G.sph, skxMat("spiritW", skxSPIRIT, 9.4)); core.scale.set(0.16, 0.14, 0.22); g.add(core);
  const nose = new THREE.Mesh(G.cone, core.material); nose.scale.set(0.08, 0.2, 0.08); nose.rotation.x = -Math.PI / 2; nose.position.set(0, 0, -0.22); g.add(nose);
  [-1, 1].forEach((s) => { const fin = new THREE.Mesh(G.plane, skxMat("wingF", skxWING, s * 1.9)); fin.scale.set(0.3, 0.16, 1); fin.position.set(s * 0.16, 0.04, 0.02); fin.rotation.z = s * 0.5; g.add(fin); });
  const tmm = skxMat("wispT", skxWISP, 4.4), trail = new THREE.Group(); [Math.PI / 2, 0].forEach((rx, pi) => { const t = new THREE.Mesh(G.plane, pi ? tmm : tmm.clone()); t.material.uniforms.uT = skxU; t.scale.set(1.2, pi ? 0.12 : 0.16, 1); t.position.set(0, 0, 0.7); t.rotation.x = rx; if (!pi) t.rotation.y = Math.PI / 2; trail.add(t); }); g.add(trail);
  const glow = skxGlow(0x63ff9a, 0.7, 0.65); g.add(glow);
  return { g, trail, glow }; }
// ---- entries ----
// Trailblazer: the steered tiger. move(x, y, z, yaw) each frame; end() dissolves it.
function skxTrailblazer(x, y, z, yaw) { try { const c = skxTiger(); c.g.position.set(x, y, z); c.g.rotation.y = yaw || 0;
  let stride = 0, lx = x, lz = z;
  const h = skxFx(1e9, [c.g], (dt, age) => { const dx = c.g.position.x - lx, dz = c.g.position.z - lz; lx = c.g.position.x; lz = c.g.position.z;
    stride += Math.hypot(dx, dz) * 9; const run = Math.min(1, Math.hypot(dx, dz) / Math.max(1e-5, dt) / 4);
    c.legs.forEach((l, i) => { l.rotation.x = Math.sin(stride + (i % 2 ? Math.PI : 0) + (i > 1 ? 0.6 : 0)) * 0.7 * run; });
    c.tail.rotation.z = Math.sin(skxU.value * 6) * 0.25; c.g.position.y += 0; c.glow.material.opacity = 0.4 + 0.2 * Math.sin(skxU.value * 5); });
  h.move = function (nx, ny, nz, yw) { c.g.position.set(nx, ny, nz); if (yw !== undefined) c.g.rotation.y = yw; };
  const done0 = h.fx.done; h.fx.done = function () { const p = c.g.position.clone(); done0(); skxDissolve(p, 0.7, 0x63ff9a); }; // dissolves into motes
  return h; } catch (e) { return skxErr(e); } }
// Trailblazer leap: amber-green shock ring + upburst + red claw slashes hanging a beat (the concuss).
function skxTrailLeap(p) { try { const G = skxGeos(), grp = new THREE.Group(); grp.position.set(p.x, (p.y || 0), p.z);
  const ring = new THREE.Mesh(G.ring, skxBasic(0xaaff7a, 0.9, true)); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.15; grp.add(ring);
  const ring2 = new THREE.Mesh(G.ring, skxBasic(0xffd24a, 0.7, true)); ring2.rotation.x = -Math.PI / 2; ring2.position.y = 0.35; grp.add(ring2);
  const burst = skxGlow(0xd6ffb0, 0.9, 2.2); burst.position.y = 0.7; grp.add(burst);
  const slashes = []; for (let i = 0; i < 3; i++) { const s = new THREE.Mesh(G.plane, skxMat("slashR", skxSLASHR, i * 3.3, { blending: THREE.NormalBlending }));
    s.scale.set(1.6, 0.3, 1); s.position.set(Math.cos(i * 2.1) * 0.5, 1 + i * 0.35, Math.sin(i * 2.1) * 0.5); s.rotation.set(0, i * 1.05, 0.5 - i * 0.4); slashes.push(s); grp.add(s); }
  return skxFx(0.7, [grp], (dt, age, k) => { ring.scale.setScalar(0.4 + k * 4.2); ring.material.opacity = 0.75 * (1 - k);
    ring2.scale.setScalar(0.3 + k * 3); ring2.material.opacity = 0.6 * (1 - k * k);
    burst.material.opacity = 0.9 * (1 - k); burst.scale.setScalar(2.2 + k * 2);
    slashes.forEach((s, i) => { s.material.uniforms.uP.value = Math.max(0, (age - 0.08) / 0.55); s.scale.x = 1.6 + k * 1.2; }); });
 } catch (e) { return skxErr(e); } }
// Guiding Light: the hawk. move(x, y, z, yaw) steers; the pop is skxHawkFlash.
function skxHawk(x, y, z, yaw) { try { const b = skxBird(); b.g.position.set(x, y, z); b.g.rotation.y = yaw || 0;
  let lx = x, ly = y, lz = z;
  const h = skxFx(1e9, [b.g], (dt, age) => { const dx = b.g.position.x - lx, dy = b.g.position.y - ly, dz = b.g.position.z - lz; lx = b.g.position.x; ly = b.g.position.y; lz = b.g.position.z;
    const sp = Math.hypot(dx, dy, dz) / Math.max(1e-5, dt), flap = Math.sin(skxU.value * (6 + Math.min(10, sp * 0.5)));
    b.wings.forEach((w, i) => { const s = i ? 1 : -1; w.rotation.z = s * (0.12 + flap * 0.55); });
    b.trails.forEach((t, i) => { t.material.uniforms.uA.value = Math.min(1, sp / 8) * 0.9; });
    b.glow.material.opacity = 0.5 + 0.15 * flap; });
  h.move = function (nx, ny, nz, yw) { b.g.position.set(nx, ny, nz); if (yw !== undefined) b.g.rotation.y = yw; };
  return h; } catch (e) { return skxErr(e); } }
// Guiding Light pop: white-green blinding flash, expanding ring, sparkle burst (the blind itself is the caller's).
function skxHawkFlash(p) { try { const G = skxGeos(), grp = new THREE.Group(); grp.position.set(p.x, p.y, p.z);
  const core = skxGlow(0xf2ffdf, 1, 3.2); grp.add(core);
  const shell = new THREE.Mesh(G.sph, skxBasic(0xbfff9a, 0.85, true)); shell.scale.setScalar(0.3); grp.add(shell);
  const ring = new THREE.Mesh(G.ring, skxBasic(0xd6ffb0, 0.9, true)); grp.add(ring);
  const N = 26, pos = new Float32Array(N * 3), vel = [];
  for (let i = 0; i < N; i++) { const a = Math.random() * 6.28, b2 = Math.random() * 3.14, s = 3 + Math.random() * 5; vel.push([Math.sin(b2) * Math.cos(a) * s, Math.cos(b2) * s * 0.7, Math.sin(b2) * Math.sin(a) * s]); }
  const pg = new THREE.BufferGeometry(); pg.userData.own = 1; pg.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const pts = new THREE.Points(pg, new THREE.PointsMaterial({ map: skxTexMote(), color: 0xd6ffb0, size: 0.35, transparent: true, opacity: 1, depthWrite: false, blending: THREE.AdditiveBlending }));
  grp.add(pts);
  return skxFx(0.55, [grp], (dt, age, k) => { core.material.opacity = 1 - k; core.scale.setScalar(3.2 + k * 3);
    shell.scale.setScalar(0.3 + k * 2.6); shell.material.opacity = 0.85 * (1 - k * k);
    ring.scale.setScalar(0.3 + k * 4.5); ring.material.opacity = 0.85 * (1 - k); ring.lookAt(camera ? camera.position : grp.position);
    const a3 = pg.attributes.position.array; for (let i = 0; i < N; i++) { a3[i * 3] += vel[i][0] * dt; a3[i * 3 + 1] += vel[i][1] * dt; a3[i * 3 + 2] += vel[i][2] * dt; } pg.attributes.position.needsUpdate = true;
    pts.material.opacity = 1 - k; });
 } catch (e) { return skxErr(e); } }
// shared dissolve: small mote burst (creature despawn)
function skxDissolve(p, s, col) { try { const N = 16, pos = new Float32Array(N * 3), vel = [];
  for (let i = 0; i < N; i++) { const a = Math.random() * 6.28; vel.push([Math.cos(a) * (1 + Math.random()), 1.5 + Math.random() * 2, Math.sin(a) * (1 + Math.random())]); }
  const pg = new THREE.BufferGeometry(); pg.userData.own = 1; pg.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const pts = new THREE.Points(pg, new THREE.PointsMaterial({ map: skxTexMote(), color: col || 0x9dffb0, size: 0.3 * (s || 1), transparent: true, opacity: 0.95, depthWrite: false, blending: THREE.AdditiveBlending }));
  pts.position.set(p.x, (p.y || 0) + 0.4, p.z);
  return skxFx(0.7, [pts], (dt, age, k) => { const a3 = pg.attributes.position.array; for (let i = 0; i < N; i++) { a3[i * 3] += vel[i][0] * dt; a3[i * 3 + 1] += vel[i][1] * dt; a3[i * 3 + 2] += vel[i][2] * dt; } pg.attributes.position.needsUpdate = true; pts.material.opacity = 0.95 * (1 - k); });
 } catch (e) { return skxErr(e); } }
// Regrowth: channel aura - rising green motes + amber glints around the caster, a soft ground ring. move() follows the caster.
function skxRegrowth(x, y, z, radius) { try { const G = skxGeos(), grp = new THREE.Group(), R = radius || 18;
  const N = 70, pos = new Float32Array(N * 3), seed = [];
  for (let i = 0; i < N; i++) { const a = Math.random() * 6.28, r = Math.sqrt(Math.random()) * Math.min(R, 5.5); seed.push([Math.cos(a) * r, Math.sin(a) * r, Math.random(), 0.5 + Math.random()]); }
  const pg = new THREE.BufferGeometry(); pg.userData.own = 1; pg.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const cols = new Float32Array(N * 3); for (let i = 0; i < N; i++) { const amber = i % 4 === 0; cols[i * 3] = amber ? 1 : 0.45; cols[i * 3 + 1] = amber ? 0.82 : 1; cols[i * 3 + 2] = amber ? 0.3 : 0.6; }
  pg.setAttribute("color", new THREE.BufferAttribute(cols, 3));
  const pts = new THREE.Points(pg, new THREE.PointsMaterial({ map: skxTexMote(), size: 0.55, transparent: true, vertexColors: true, opacity: 1, depthWrite: false, blending: THREE.AdditiveBlending }));
  grp.add(pts);
  const ring = new THREE.Mesh(G.ring, skxBasic(0x63ff9a, 0.22, true)); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.08; ring.scale.setScalar(Math.min(R, 5.5)); grp.add(ring);
  const glow = skxGlow(0x63ff9a, 0.3, 4.5); glow.position.y = 1.1; grp.add(glow);
  grp.position.set(x, y, z);
  const h = skxFx(1e9, [grp], (dt, age) => { const a3 = pg.attributes.position.array;
    for (let i = 0; i < N; i++) { const s = seed[i]; s[2] += dt * 0.24 * s[3]; if (s[2] > 1) s[2] -= 1;
      const sw = skxU.value * 0.7 + i; a3[i * 3] = s[0] + Math.sin(sw) * 0.4; a3[i * 3 + 1] = 0.15 + s[2] * 2.4; a3[i * 3 + 2] = s[1] + Math.cos(sw * 0.9) * 0.4; }
    pg.attributes.position.needsUpdate = true;
    ring.material.opacity = 0.2 + 0.07 * Math.sin(skxU.value * 2.4); glow.material.opacity = 0.26 + 0.1 * Math.sin(skxU.value * 3.1); });
  h.move = function (nx, ny, nz) { grp.position.set(nx, ny, nz); };
  return h; } catch (e) { return skxErr(e); } }
// Seekers: one wisp creature per seeker. move() steers it home; skxSeekerBurst on reach.
function skxSeeker(x, y, z) { try { const w = skxWisp(); w.g.position.set(x, y, z);
  let lx = x, ly = y, lz = z;
  const h = skxFx(1e9, [w.g], () => { const dx = w.g.position.x - lx, dy = w.g.position.y - ly, dz = w.g.position.z - lz; lx = w.g.position.x; ly = w.g.position.y; lz = w.g.position.z;
    if (Math.hypot(dx, dy, dz) > 1e-4) { const tgt = Math.atan2(dx, dz); let d = tgt - w.g.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d)); w.g.rotation.y += d * 0.35; }
    w.g.position.y = w.g.position.y; w.glow.material.opacity = 0.55 + 0.2 * Math.sin(skxU.value * 9); });
  h.move = function (nx, ny, nz) { w.g.position.set(nx, ny, nz); };
  const done0 = h.fx.done; h.fx.done = function () { const p = w.g.position.clone(); done0(); };
  return h; } catch (e) { return skxErr(e); } }
function skxSeekerBurst(p) { try { const G = skxGeos(), grp = new THREE.Group(); grp.position.set(p.x, (p.y || 0) + 0.6, p.z);
  const flash = skxGlow(0x9dffb0, 0.95, 2.4); grp.add(flash);
  const ring = new THREE.Mesh(G.ring, skxBasic(0x63ff9a, 0.8, true)); grp.add(ring);
  const h = skxFx(0.5, [grp], (dt, age, k) => { flash.material.opacity = 0.95 * (1 - k); flash.scale.setScalar(2.4 + k * 1.6);
    ring.scale.setScalar(0.3 + k * 2.6); ring.material.opacity = 0.8 * (1 - k); ring.lookAt(camera ? camera.position : grp.position); });
  skxDissolve(new THREE.Vector3(p.x, (p.y || 0) + 0.6, p.z), 1, 0x9dffb0); return h; } catch (e) { return skxErr(e); } }
// optional Trailblazer control tint (the reference's green first-person filter). The game's own drone
// overlay (#xDr) may already cover this; call skxVeil(true) only if it does not.
function skxVeil(on) { try { if (!on) { document.querySelectorAll(".skxV").forEach((e) => e.remove()); return; }
  if (!document.getElementById("skxCss")) { const s = document.createElement("style"); s.id = "skxCss";
    s.textContent = ".skxV{position:fixed;inset:0;pointer-events:none;z-index:6;background:radial-gradient(120% 120% at 50% 50%,rgba(30,90,40,0) 55%,rgba(20,80,35,.45) 100%),rgba(40,120,55,.14)}";
    (document.head || document.documentElement).appendChild(s); }
  const d = document.createElement("div"); d.className = "skxV"; document.body.appendChild(d); } catch (e) {} }
// ---- END SKYE FX ----
