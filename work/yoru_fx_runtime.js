// ---- YORU FX ----
// Yoru ability visuals (work/yoru_fx_runtime.js), reference-grounded in the wiki showcase clips
// (wiki.playvalorant.com/en-us/images/Fakeout_Showcase.mp4, Blindside_Showcase.mp4,
// Gatecrash_Showcase.mp4, Dimensional_Drift_Showcase.mp4; frame sheets reviewed 2026-11-04).
// Procedural approximation, not extracted game assets. Main entries preserve game mechanics.
// All positions are world-space [x,y,z] arrays or {x,y,z}. Returns handles {fx,end()}.
// yoxUseGameTick() then yoxTick(dt) hands timing to the game loop (jFxTick wires it);
// otherwise a single rAF pump runs while effects exist. Effect age is game dt only.
// Shared geometry/textures/shaders persist; cloned per-effect materials are disposed recursively.
// end() on long-lived handles (dieable) plays the dissipate phase, then cleanup runs.
var yoxU = { value: 0 }, yoxLive = [], yoxPumpOn = false, yoxGT = null, yoxGeo = null, yoxTex = {}, yoxProg = {};
function yoxNow() { try { return performance.now() / 1000; } catch (e) { return Date.now() / 1000; } }
function yoxGeos() { if (yoxGeo) return yoxGeo; yoxGeo = {
  sph: new THREE.SphereGeometry(1, 22, 15),
  ring: new THREE.RingGeometry(0.72, 1, 48),
  torus: new THREE.TorusGeometry(1, 0.06, 8, 40),
  cone: new THREE.ConeGeometry(0.5, 1, 6),
  cyl: new THREE.CylinderGeometry(1, 0.85, 1, 14),
  plane: new THREE.PlaneGeometry(1, 1.6, 1, 6) }; return yoxGeo; }
// blue rift tendril: deep indigo body, electric-blue fresnel edge, wispy vertical falloff
function yoxShader(k, frag) { if (yoxProg[k]) return yoxProg[k]; const m = new THREE.ShaderMaterial({
  uniforms: { uT: yoxU, uP: { value: 0 }, uSeed: { value: 0 }, uA: { value: 1 } },
  vertexShader: "uniform float uT;uniform float uP;uniform float uSeed;varying vec3 vN;varying vec3 vV;varying vec3 vP;varying vec2 vUv;void main(){vUv=uv;vP=position;vec4 mv=modelViewMatrix*vec4(position,1.0);vV=-mv.xyz;vN=normalMatrix*normal;gl_Position=projectionMatrix*mv;}",
  fragmentShader: frag, transparent: true, depthWrite: false, side: THREE.DoubleSide });
  m.userData.yox = k; yoxProg[k] = m; return m; }
const yoxTENDRIL = "uniform float uT;uniform float uP;uniform float uSeed;uniform float uA;varying vec3 vN;varying vec3 vV;varying vec2 vUv;void main(){float f=pow(1.0-abs(dot(normalize(vN),normalize(vV))),1.5);float w=sin(vUv.y*9.0+uT*3.4+uSeed*7.0)*sin(vUv.x*5.0-uT*2.2+uSeed*3.0);vec3 c=mix(vec3(0.045,0.05,0.16),vec3(0.24,0.34,1.0),f)*(0.85+0.3*w);c+=vec3(0.35,0.62,1.0)*f*f*0.5;float width=0.24*(1.0-vUv.y*0.6);float curve=0.5+0.11*sin(vUv.y*7.0+uT*2.2+uSeed);float edge=1.0-smoothstep(width*0.35,width,abs(vUv.x-curve));float a=edge*smoothstep(0.0,0.15,vUv.y)*(1.0-smoothstep(0.55,1.0,vUv.y))*(0.6+0.4*w)*(1.0-uP)*uA;if(a<0.003)discard;gl_FragColor=vec4(c,a*0.95);}";
function yoxTenMat(seed) { const m = yoxShader("ten" + (seed % 3), yoxTENDRIL).clone(); m.uniforms.uT = yoxU; m.uniforms.uSeed.value = seed; return m; }
function yoxCanvasTex(key, size, draw) { if (yoxTex[key]) return yoxTex[key];
  const c = document.createElement("canvas"); c.width = c.height = size; draw(c.getContext("2d"), size);
  yoxTex[key] = new THREE.CanvasTexture(c); return yoxTex[key]; }
function yoxGlowTex() { return yoxCanvasTex("glow", 64, (g, s) => { g.clearRect(0, 0, s, s);
  const r = g.createRadialGradient(s/2, s/2, 1, s/2, s/2, s/2); r.addColorStop(0, "rgba(255,255,255,1)"); r.addColorStop(0.3, "rgba(190,215,255,0.55)"); r.addColorStop(1, "rgba(120,160,255,0)");
  g.fillStyle = r; g.fillRect(0, 0, s, s); }); }
function yoxBasic(c, o, add) { return new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: o, depthWrite: false, blending: add ? THREE.AdditiveBlending : THREE.NormalBlending, side: THREE.DoubleSide, fog: false, toneMapped: false }); }
function yoxSprite(c, o) { const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: yoxGlowTex(), color: c, transparent: true, opacity: o, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, toneMapped: false })); m.userData.spr = 1; return m; }
function yoxGround(x, z, y) { try { if (typeof groundAt === "function") { const g = groundAt(x, z, 0.3, y == null ? 3 : y); if (Number.isFinite(g)) return g; } } catch (e) {} return y == null ? 0 : y; }
function yoxP(p) { if (!p) p = [0, 0, 0]; return Array.isArray(p) ? { x: p[0], y: p[1] || 0, z: p[2] } : p; }
function yoxPush(fx) { if (yoxLive.length > 24) { const o = yoxLive.shift(); try { o.done(); } catch (e) {} }
  yoxLive.push(fx); if (!yoxGT && !yoxPumpOn) { yoxPumpOn = true; yoxPump.last = yoxNow(); requestAnimationFrame(yoxPump); } return fx; }
function yoxPump() { if (yoxGT) { yoxPumpOn = false; return; } const now = yoxNow(), dt = Math.min(0.1, Math.max(0.0005, now - (yoxPump.last || now))); yoxPump.last = now;
  yoxStep(dt); if (yoxLive.length) requestAnimationFrame(yoxPump); else yoxPumpOn = false; }
function yoxStep(dt) { yoxU.value += dt;
  for (let i = yoxLive.length - 1; i >= 0; i--) { const fx = yoxLive[i]; fx.age += dt;
    try { fx.tick(dt, fx.age, Math.min(1, fx.age / fx.ttl)); } catch (e) { try { xE(e); } catch (e2) {} }
    if (fx.age >= fx.ttl) { try { fx.done(); } catch (e) {} yoxLive.splice(i, 1); } } }
function yoxUseGameTick() { yoxGT = true; yoxPumpOn = false; } // integrator then calls yoxTick(dt) per frame
function yoxTick(dt) { yoxStep(dt); }
function yoxEnd(h) { if (!h || !h.fx) return; const fx = h.fx, i = yoxLive.indexOf(fx); if (i < 0) return;
  if (fx.dieable) { fx.ttl = Math.min(fx.ttl, fx.age + (fx.die || 0.4)); return; }
  yoxLive.splice(i, 1); try { fx.done(); } catch (e) {} }
function yoxDefaultDone(objs, parts) { return function () { objs.forEach((o) => { try { scene.remove(o); o.traverse((m) => { if (m.material && m.material.dispose) m.material.dispose(); if (m.userData.ownGeo && m.geometry) m.geometry.dispose(); }); } catch (e) {} });
  if (parts) parts.forEach((pt) => { try { scene.remove(pt.m); if (pt.m.material) pt.m.material.dispose(); } catch (e) {} }); }; }
function yoxFx(ttl, objs, tick, opts) { opts = opts || {}; const parts = opts.parts || null;
  const fx = { age: 0, ttl, objs, tick, die: opts.die || 0, dieable: !!opts.die, parts, done: opts.done || yoxDefaultDone(objs, parts) };
  objs.forEach((o) => scene.add(o)); yoxPush(fx); return { fx, end: function () { yoxEnd(this); } }; }
function yoxLogErr(e) { try { window.yoxErr = String(e && e.stack || e).slice(0, 300); xE(e); } catch (e2) {} }
// Integration hook for a round reset/cancel. Game logic must call this at its reset boundary.
function yoxReset() { while (yoxLive.length) { const fx = yoxLive[0]; yoxLive.splice(0, 1); try { fx.done(); } catch (e) {} } try { document.querySelectorAll(".yoxV").forEach((d) => d.remove()); } catch (e) {} }
// jagged electric arcs radiating from a centre; re-jittered per tick for the crackle
function yoxArcs(grp, n, r, c) { const lines = []; for (let i = 0; i < n; i++) { const g = new THREE.BufferGeometry();
    const pos = new Float32Array(8 * 3); g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    const m = new THREE.Line(g, new THREE.LineBasicMaterial({ color: c || 0x7ab0ff, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, toneMapped: false }));
    m.userData.ownGeo = 1; m.userData.r = r; grp.add(m); lines.push(m); }
  const rejig = () => { lines.forEach((m) => { const pos = m.geometry.attributes.position.array, a = Math.random() * 6.3, b = (Math.random() - 0.5) * 2.4, R = m.userData.r;
      for (let k = 0; k < 8; k++) { const t = k / 7, rr = R * t, j = (k > 0 && k < 7 ? 0.18 : 0.02) * R;
        pos[k*3] = Math.cos(a) * rr + (Math.random() - 0.5) * j; pos[k*3+1] = (b * rr * 0.4) + (Math.random() - 0.5) * j; pos[k*3+2] = Math.sin(a) * rr + (Math.random() - 0.5) * j; }
      m.geometry.attributes.position.needsUpdate = true; }); };
  rejig(); return { lines, rejig }; }

// ---- Fakeout ----
// reference: spawn = crackling BLUE lightning flash + a small blue wisp seed; the decoy is a translucent
// BLUE humanoid clone that walks; pop = flat radial blue-purple flash + a blue ember glow spot that shrinks away.
function yoxFakeoutSpawn(p) { try { p = yoxP(p); const G = yoxGeos(), gy = yoxGround(p.x, p.z, p.y), grp = new THREE.Group(); grp.position.set(p.x, gy + 0.8, p.z);
  const arcs = yoxArcs(grp, 6, 0.9, 0x7ab0ff);
  const flash = yoxSprite(0x9fc4ff, 0.9); flash.scale.setScalar(0.4); grp.add(flash);
  return yoxFx(0.4, [grp], (dt, age, k) => { if (age % 0.06 < dt) arcs.rejig();
    arcs.lines.forEach((m) => { m.material.opacity = 0.9 * (1 - k); }); flash.material.opacity = 0.9 * (1 - k); flash.scale.setScalar(0.4 + k * 1.1); });
 } catch (e) { yoxLogErr(e); return null; } }
function yoxFakeoutFigure() { try { const G = yoxGeos(), grp = new THREE.Group();
  const mk = (geo, sx, sy, sz, y, o) => { const m = new THREE.Mesh(geo, yoxBasic(0x3a6aff, o, true)); m.scale.set(sx, sy, sz); m.position.y = y; return m; };
  const body = mk(G.cyl, 0.30, 1.05, 0.24, 0.95, 0.34), head = mk(G.sph, 0.17, 0.19, 0.17, 1.72, 0.38);
  const legs = mk(G.cyl, 0.22, 0.55, 0.18, 0.28, 0.30);
  const haloB = mk(G.cyl, 0.36, 1.10, 0.30, 0.95, 0.10), haloH = mk(G.sph, 0.22, 0.24, 0.22, 1.72, 0.10);
  grp.add(body, head, legs, haloB, haloH);
  const h = yoxFx(1e9, [grp], (dt, age) => { const fx = h.fx, left = fx.ttl - fx.age, dying = fx.ttl < 1e8 && left <= fx.die + 0.001;
    const sh = 0.9 + 0.1 * Math.sin(yoxU.value * 9); [body, head, legs].forEach((m) => { m.material.opacity = m === head ? 0.38 * sh : 0.32 * sh; });
    grp.position.y = Math.abs(Math.sin(age * 6)) * 0.04;
    if (dying) { const dk = Math.max(0, left / fx.die); grp.scale.set(dk, Math.max(0.01, dk), dk); grp.position.y += (1 - dk) * 0.4; } }, { die: 0.3 });
  return h; } catch (e) { yoxLogErr(e); return null; } }
function yoxFakeoutPop(p) { try { p = yoxP(p); const G = yoxGeos(), gy = yoxGround(p.x, p.z, p.y);
  const ring = new THREE.Mesh(G.ring, yoxBasic(0x5a6aff, 0.85, true)); ring.rotation.x = -Math.PI / 2; ring.position.set(p.x, gy + 0.07, p.z); ring.scale.setScalar(0.2);
  const flash = yoxSprite(0x8ab0ff, 0.85); flash.position.set(p.x, gy + 0.6, p.z); flash.scale.setScalar(0.5);
  const spot = yoxSprite(0x3a5aff, 0.5); spot.position.set(p.x, gy + 0.15, p.z); spot.scale.set(0.8, 0.25, 1);
  return yoxFx(0.65, [ring, flash, spot], (dt, age, k) => { ring.scale.setScalar(0.2 + k * 1.8); ring.material.opacity = 0.85 * (1 - k);
    flash.material.opacity = 0.85 * Math.max(0, 1 - k / 0.4); flash.scale.setScalar(0.5 + k * 1.0);
    spot.material.opacity = 0.5 * Math.max(0, 1 - Math.max(0, (k - 0.3) / 0.7)); spot.scale.set(0.8 * (1 - k * 0.8), 0.25, 1); });
 } catch (e) { yoxLogErr(e); return null; } }

// ---- Blindside ----
// reference: a small bright BLUE glowing spiky ball (dark blue-purple, blue cracks) with a slight trail
// that bounces off walls; pop = bright white-blue flash burst + blue fragments (subtle in the world).
function yoxBlindsideOrb() { try { const G = yoxGeos(), grp = new THREE.Group();
  const core = new THREE.Mesh(G.sph, yoxBasic(0x4a6aff, 0.95, true)); core.scale.setScalar(0.10);
  const shell = new THREE.Mesh(G.sph, yoxBasic(0x141a4a, 0.9, false)); shell.scale.setScalar(0.085);
  const spikes = []; for (let i = 0; i < 8; i++) { const m = new THREE.Mesh(G.cone, yoxBasic(0x5a8aff, 0.85, true));
    const v = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize();
    m.position.copy(v).multiplyScalar(0.10); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), v); m.scale.set(0.05, 0.10, 0.05); grp.add(m); spikes.push(m); }
  const glow = yoxSprite(0x6a9aff, 0.6); glow.scale.setScalar(0.34);
  grp.add(core, shell, glow);
  const parts = [], st = { nx: 0 };
  const h = yoxFx(1e9, [grp], (dt, age) => { const fx = h.fx, left = fx.ttl - fx.age, dying = fx.ttl < 1e8 && left <= fx.die + 0.001;
    grp.rotation.y += dt * 6; grp.rotation.x += dt * 4; glow.material.opacity = 0.45 + 0.2 * Math.sin(yoxU.value * 12);
    if (!dying && age >= st.nx) { st.nx = age + 0.04; const w = yoxSprite(0x5a8aff, 0.4); w.position.copy(grp.position); w.scale.setScalar(0.12); scene.add(w); parts.push({ m: w, age: 0, ttl: 0.3 }); }
    for (let i = parts.length - 1; i >= 0; i--) { const pt = parts[i]; pt.age += dt; const pk = pt.age / pt.ttl; if (pk >= 1) { scene.remove(pt.m); pt.m.material.dispose(); parts.splice(i, 1); continue; } pt.m.material.opacity = 0.4 * (1 - pk); }
    if (dying) grp.scale.setScalar(Math.max(0.01, left / fx.die)); }, { parts, die: 0.2 });
  return h; } catch (e) { yoxLogErr(e); return null; } }
function yoxBlindsidePop(p) { try { p = yoxP(p); const G = yoxGeos(), grp = new THREE.Group(); grp.position.set(p.x, p.y, p.z);
  const flash = yoxSprite(0xf2f8ff, 1); flash.scale.setScalar(0.4); grp.add(flash);
  const ring = new THREE.Mesh(G.ring, yoxBasic(0x9fc8ff, 0.7, true)); ring.scale.setScalar(0.15); grp.add(ring);
  const frags = []; for (let i = 0; i < 8; i++) { const m = yoxSprite(0x5a8aff, 0.8); m.scale.setScalar(0.09); grp.add(m);
    const v = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.3, Math.random() - 0.5).normalize().multiplyScalar(2.5 + Math.random() * 2); m.scale.setScalar(0.13); frags.push({ m, v }); }
  return yoxFx(0.5, [grp], (dt, age, k) => { flash.material.opacity = Math.max(0, 1 - k / 0.35); flash.scale.setScalar(0.4 + Math.min(1, k / 0.35) * 2.4);
    ring.material.opacity = 0.7 * Math.max(0, 1 - k / 0.55); ring.scale.setScalar(0.15 + Math.min(1, k / 0.55) * 1.0); ring.lookAt(ring.position.clone().add(new THREE.Vector3(0, 0, 1)));
    frags.forEach((f) => { f.m.position.addScaledVector(f.v, dt); f.v.y -= 6 * dt; f.m.material.opacity = 0.8 * (1 - k); }); });
 } catch (e) { yoxLogErr(e); return null; } }
// victim-side white-out veil (DOM); the game blind state decides when to call this
function yoxCss() { if (document.getElementById("yoxCss")) return; const s = document.createElement("style"); s.id = "yoxCss"; s.textContent =
  ".yoxV{position:fixed;inset:0;pointer-events:none;z-index:6;opacity:0;transition:opacity .15s}" +
  ".yoxVBlind{background:radial-gradient(90% 90% at 50% 45%,rgba(240,246,255,.98) 0%,rgba(214,228,255,.94) 60%,rgba(150,180,255,.9) 100%)}" +
  ".yoxVDrift{background:radial-gradient(120% 120% at 50% 50%,rgba(20,14,60,0) 34%,rgba(14,10,44,.7) 100%),radial-gradient(80% 90% at 30% 30%,rgba(58,74,220,.30) 0%,rgba(58,74,220,0) 70%),rgba(38,30,120,.34)}";
  (document.head || document.documentElement).appendChild(s); }
function yoxVeil(kind, seconds) { try { yoxCss(); const d = document.createElement("div"); d.className = "yoxV yoxV" + kind; document.body.appendChild(d); d.style.opacity = "1";
  const life = seconds || (kind === "Blind" ? 1.5 : 10);
  const h = yoxFx(life, [], (dt, age) => { d.style.opacity = String(Math.min(1, Math.max(0, (h.fx.ttl - age) / 0.3))); }, { done: () => d.remove(), die: 0.3 }); return h; } catch (e) { yoxLogErr(e); return null; } }
function yoxBlindVeil(seconds) { return yoxVeil("Blind", seconds || 1.5); }

// ---- Gatecrash ----
// reference: cast sends a crackling blue energy rift orb; the anchor sits as a small pulsing blue rift
// with dark tendril wisps; the teleport is a blue-black tendril vortex at both ends; the fake is a 30s decal.
function yoxRiftOrb(scale) { const G = yoxGeos(), grp = new THREE.Group(), S = scale || 1;
  const dk = new THREE.Sprite(new THREE.SpriteMaterial({ map: yoxGlowTex(), color: 0x0a0c2a, transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.NormalBlending, fog: false, toneMapped: false })); dk.userData.spr = 1; dk.scale.setScalar(0.36 * S);
  const core = new THREE.Mesh(G.sph, yoxBasic(0x3a5aff, 0.9, true)); core.scale.setScalar(0.10 * S);
  const glow = yoxSprite(0x5a8aff, 0.55); glow.scale.setScalar(0.5 * S);
  const tens = []; for (let i = 0; i < 5; i++) { const m = new THREE.Mesh(G.plane, yoxTenMat(i * 1.7)); m.scale.set(0.52 * S, 0.46 * S, 1); m.rotation.y = (i / 5) * Math.PI * 2; grp.add(m); tens.push(m); }
  grp.add(dk, core, glow); grp.userData = { core, glow, tens, S }; return grp; }
function yoxGatecrashOrb() { try { const grp = yoxRiftOrb(1), parts = [], st = { nx: 0 };
  const h = yoxFx(1e9, [grp], (dt, age) => { const fx = h.fx, left = fx.ttl - fx.age, dying = fx.ttl < 1e8 && left <= fx.die + 0.001, u = grp.userData;
    grp.rotation.y += dt * 5; u.tens.forEach((m, i) => { m.material.uniforms.uP.value = dying ? 1 - left / fx.die : 0; m.rotation.y += dt * (2 + i); });
    u.glow.material.opacity = 0.4 + 0.2 * Math.sin(yoxU.value * 10);
    if (!dying && age >= st.nx) { st.nx = age + 0.05; const w = yoxSprite(0x4a6aff, 0.35); w.position.copy(grp.position); w.scale.setScalar(0.14); scene.add(w); parts.push({ m: w, age: 0, ttl: 0.32 }); }
    for (let i = parts.length - 1; i >= 0; i--) { const pt = parts[i]; pt.age += dt; const pk = pt.age / pt.ttl; if (pk >= 1) { scene.remove(pt.m); pt.m.material.dispose(); parts.splice(i, 1); continue; } pt.m.material.opacity = 0.35 * (1 - pk); }
    if (dying) grp.scale.setScalar(Math.max(0.01, left / fx.die)); }, { parts, die: 0.25 });
  return h; } catch (e) { yoxLogErr(e); return null; } }
function yoxGatecrashAnchor(p, seconds) { try { p = yoxP(p); const G = yoxGeos(), gy = yoxGround(p.x, p.z, p.y), ttl = Math.max(1, seconds || 30);
  const grp = yoxRiftOrb(0.9); grp.position.set(p.x, gy + 0.35, p.z);
  const ring = new THREE.Mesh(G.torus, yoxBasic(0x3a5aff, 0.4, true)); ring.rotation.x = Math.PI / 2; ring.scale.setScalar(0.5); ring.position.set(p.x, gy + 0.06, p.z);
  const arcs = yoxArcs(grp, 3, 0.4, 0x6a9aff);
  const h = yoxFx(ttl, [grp, ring], (dt, age) => { const fx = h.fx, left = fx.ttl - fx.age, dying = left <= fx.die + 0.001, u = grp.userData, k = Math.min(1, age / ttl);
    const pulse = 0.85 + 0.15 * Math.sin(yoxU.value * 5); grp.scale.setScalar(pulse * (dying ? Math.max(0.01, left / fx.die) : Math.min(1, age / 0.3)));
    u.tens.forEach((m, i) => { m.rotation.y += dt * (1.5 + i); m.material.uniforms.uP.value = dying ? 1 - left / fx.die : 0; });
    if (age % 0.09 < dt) arcs.rejig(); arcs.lines.forEach((m) => { m.material.opacity = 0.55 * pulse; });
    ring.material.opacity = 0.4 * pulse * (dying ? Math.max(0, left / fx.die) : 1); ring.rotation.z += dt * 0.8; }, { die: 0.4 });
  return h; } catch (e) { yoxLogErr(e); return null; } }
function yoxGatecrashTP(p) { try { p = yoxP(p); const G = yoxGeos(), gy = yoxGround(p.x, p.z, p.y), grp = new THREE.Group(); grp.position.set(p.x, gy, p.z);
  const tens = []; for (let i = 0; i < 9; i++) { const m = new THREE.Mesh(G.plane, yoxTenMat(i * 1.3)); const a = (i / 9) * 6.3;
    m.position.set(Math.cos(a) * 0.55, 1.2, Math.sin(a) * 0.55); m.rotation.y = -a + Math.PI / 2; m.scale.set(0.7, 2.2, 1); m.userData.a = a; grp.add(m); tens.push(m); }
  const dcore = new THREE.Mesh(G.sph, yoxBasic(0x0a0c2a, 0.75, false)); dcore.scale.set(0.4, 0.9, 0.4); dcore.position.y = 1.0; grp.add(dcore);
  const flash = yoxSprite(0xbfd8ff, 1); flash.position.y = 0.9; flash.scale.setScalar(1.2); grp.add(flash);
  const ring = new THREE.Mesh(G.ring, yoxBasic(0x5a8aff, 0.8, true)); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.06; ring.scale.setScalar(0.3); grp.add(ring);
  const shards = []; for (let i = 0; i < 10; i++) { const m = yoxSprite(0x4a6aff, 0.9); const a = (i / 10) * 6.3 + Math.random() * 0.4;
    m.position.set(Math.cos(a) * 0.4, 0.3 + Math.random() * 1.6, Math.sin(a) * 0.4); m.scale.set(0.10, 0.65, 1); m.material.rotation = a;
    m.userData = { a, sp: 5 + Math.random() * 4, vy: 1 + Math.random() * 2 }; grp.add(m); shards.push(m); }
  return yoxFx(0.9, [grp], (dt, age, k) => { grp.rotation.y -= dt * 4.5;
    tens.forEach((m) => { const r = 0.55 * (1 - k * 0.75); m.position.x = Math.cos(m.userData.a) * r; m.position.z = Math.sin(m.userData.a) * r; m.material.uniforms.uP.value = k; });
    dcore.material.opacity = 0.75 * (1 - k); dcore.scale.set(0.4 * (1 - k * 0.5), 0.9 + k * 0.6, 0.4 * (1 - k * 0.5));
    flash.material.opacity = Math.max(0, 1 - k / 0.55); flash.scale.setScalar(1.2 + k * 2.0);
    ring.material.opacity = 0.8 * (1 - k); ring.scale.setScalar(0.3 + k * 2.2);
    shards.forEach((m) => { const u = m.userData, rr = 0.4 + age * u.sp; m.position.x = Math.cos(u.a) * rr; m.position.z = Math.sin(u.a) * rr; m.position.y += u.vy * dt; m.material.opacity = 0.9 * Math.max(0, 1 - k / 0.8); }); });
 } catch (e) { yoxLogErr(e); return null; } }
function yoxGatecrashFake(p, seconds) { try { p = yoxP(p); const G = yoxGeos(), gy = yoxGround(p.x, p.z, p.y), ttl = Math.max(1, seconds || 30);
  const ring = new THREE.Mesh(G.ring, yoxBasic(0x8a92ff, 0.55, true)); ring.rotation.x = -Math.PI / 2; ring.position.set(p.x, gy + 0.06, p.z); ring.scale.setScalar(0.5);
  const wisp = yoxSprite(0x6a8aff, 0.3); wisp.position.set(p.x, gy + 0.2, p.z); wisp.scale.setScalar(0.4);
  const h = yoxFx(ttl, [ring, wisp], (dt, age) => { const fx = h.fx, left = fx.ttl - fx.age, dying = left <= fx.die + 0.001, fade = dying ? Math.max(0, left / fx.die) : 1;
    ring.material.opacity = 0.55 * (0.7 + 0.3 * Math.sin(yoxU.value * 4)) * fade; wisp.material.opacity = 0.3 * fade; }, { die: 0.5 });
  return h; } catch (e) { yoxLogErr(e); return null; } }

// ---- Dimensional Drift ----
// reference: cast pulls on a glowing blue mask, blue energy wisps curl around the arms; the drifted world
// is a blue-violet monochrome grade with dark vignette edges and blue flame wisps on the hands; exit is a
// blue wisp burst at Yoru's position. Others see nothing while he drifts.
function yoxDriftEnter(p) { try { p = yoxP(p); const G = yoxGeos(), gy = yoxGround(p.x, p.z, p.y), grp = new THREE.Group(); grp.position.set(p.x, gy, p.z);
  const wisps = []; for (let i = 0; i < 8; i++) { const w = yoxSprite(0x5a8aff, 0.6); w.scale.set(0.2, 0.5, 1); grp.add(w); wisps.push({ m: w, a: (i / 8) * 6.3, rr: 0.5, y: 0.3 + Math.random() * 1.2, sp: 5 + Math.random() * 3 }); }
  return yoxFx(1.0, [grp], (dt, age, k) => { wisps.forEach((pt) => { pt.a += dt * pt.sp; pt.rr = Math.max(0.08, pt.rr - dt * 0.45);
    pt.m.position.set(Math.cos(pt.a) * pt.rr, pt.y + k * 0.5, Math.sin(pt.a) * pt.rr); pt.m.material.opacity = 0.6 * Math.sin(Math.min(1, k * 1.2) * Math.PI); }); });
 } catch (e) { yoxLogErr(e); return null; } }
function yoxDriftVeil(seconds) { return yoxVeil("Drift", seconds || 10); }
function yoxDriftExit(p) { try { p = yoxP(p); const G = yoxGeos(), gy = yoxGround(p.x, p.z, p.y), grp = new THREE.Group(); grp.position.set(p.x, gy, p.z);
  const tens = []; for (let i = 0; i < 4; i++) { const m = new THREE.Mesh(G.plane, yoxTenMat(5 + i)); const a = (i / 4) * 6.3 + 0.4;
    m.position.set(Math.cos(a) * 0.35, 0.9, Math.sin(a) * 0.35); m.rotation.y = -a + Math.PI / 2; m.scale.set(0.4, 1.2, 1); m.userData.a = a; grp.add(m); tens.push(m); }
  const flash = yoxSprite(0x7aaaff, 0.7); flash.position.y = 0.9; flash.scale.setScalar(0.4); grp.add(flash);
  return yoxFx(0.6, [grp], (dt, age, k) => { grp.rotation.y += dt * 3;
    tens.forEach((m) => { m.material.uniforms.uP.value = k; m.position.y = 0.9 + k * 0.4; }); flash.material.opacity = 0.7 * (1 - k); flash.scale.setScalar(0.4 + k * 0.9); });
 } catch (e) { yoxLogErr(e); return null; } }
// ---- END YORU FX ----

// drop all cached shared GPU resources (textures, geometries, shader materials); next use
// recreates them lazily. integrator: call on full reconnect/reset cycles to bound retention.
function yoxDisposeShared() { for (const k in yoxTex) { try { yoxTex[k].dispose(); } catch (e) {} delete yoxTex[k]; }
  if (yoxGeo) { for (const k in yoxGeo) { try { yoxGeo[k].dispose(); } catch (e) {} } yoxGeo = null; }
  for (const k in yoxProg) { try { yoxProg[k].dispose(); } catch (e) {} delete yoxProg[k]; } }
