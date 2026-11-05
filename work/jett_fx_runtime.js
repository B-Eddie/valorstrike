// ---- JETT FX ----
// Jett ability visuals (work/jett_fx_runtime.js), reference-grounded in the wiki showcase clips
// (wiki.playvalorant.com/en-us/images/Cloudburst_Showcase.mp4, Updraft_Showcase.mp4,
// Tailwind_Showcase.mp4, Blade_Storm_Showcase.mp4; frame sheets reviewed 2026-11-04).
// Procedural approximation, not extracted game assets. Main entries preserve game mechanics.
// All positions are world-space [x,y,z] arrays or {x,y,z}. Returns handles {fx,end()}.
// jfxUseGameTick() then jfxTick(dt) hands timing to the game loop (jFxTick wires it);
// otherwise a single rAF pump runs while effects exist. Effect age is game dt only.
// Shared geometry/textures persist; cloned per-effect materials are disposed recursively.
// end() on long-lived handles (dieable) plays the dissipate phase, then cleanup runs.
var jfxU = { value: 0 }, jfxLive = [], jfxPumpOn = false, jfxGT = null, jfxGeo = null, jfxTex = {};
function jfxNow() { try { return performance.now() / 1000; } catch (e) { return Date.now() / 1000; } }
function jfxDomeTex() { return jfxCanvasTex("dome", 256, (g, s) => { g.clearRect(0, 0, s, s);
  g.fillStyle = "rgba(255,255,255,0.96)"; g.fillRect(0, 0, s, s);
  for (let i = 0; i < 90; i++) { const x = Math.random() * s, y = Math.random() * s, rr = s * (0.05 + Math.random() * 0.13);
    const r = g.createRadialGradient(x, y, 1, x, y, rr); const dk = Math.random() < 0.5;
    r.addColorStop(0, dk ? "rgba(178,204,228,0.5)" : "rgba(255,255,255,0.45)"); r.addColorStop(1, "rgba(255,255,255,0)"); g.fillStyle = r; g.beginPath(); g.arc(x, y, rr, 0, 6.3); g.fill(); }
  for (let i = 0; i < 10; i++) { const x = Math.random() * s, y = Math.random() * s, rr = s * (0.18 + Math.random() * 0.2);
    const r = g.createRadialGradient(x, y, 1, x, y, rr); r.addColorStop(0, "rgba(170,198,224,0.28)"); r.addColorStop(1, "rgba(170,198,224,0)"); g.fillStyle = r; g.beginPath(); g.arc(x, y, rr, 0, 6.3); g.fill(); }
  g.save(); g.translate(s / 2, s / 2); g.rotate(-0.55);
  for (let i = 0; i < 3; i++) { const yb = -s * 0.28 + i * s * 0.26, hh = s * 0.095;
    const rb = g.createLinearGradient(0, yb - hh, 0, yb + hh); rb.addColorStop(0, "rgba(165,198,232,0)"); rb.addColorStop(0.5, "rgba(165,198,232,0.8)"); rb.addColorStop(1, "rgba(165,198,232,0)");
    g.fillStyle = rb; g.beginPath(); for (let x = -s; x <= s; x += 8) { const yy = yb + Math.sin(x * 0.04 + i * 2.1) * s * 0.02; x === -s ? g.moveTo(x, yy - hh) : g.lineTo(x, yy - hh); }
    for (let x = s; x >= -s; x -= 8) { const yy = yb + Math.sin(x * 0.04 + i * 2.1) * s * 0.02; g.lineTo(x, yy + hh); } g.closePath(); g.fill(); }
  g.restore();
  g.globalCompositeOperation = "destination-in";
  const v = g.createLinearGradient(0, 0, 0, s); v.addColorStop(0, "rgba(255,255,255,0.25)"); v.addColorStop(0.18, "rgba(255,255,255,0.9)"); v.addColorStop(0.8, "rgba(255,255,255,0.95)"); v.addColorStop(1, "rgba(255,255,255,0.35)");
  g.fillStyle = v; g.fillRect(0, 0, s, s);
  for (let i = 0; i < 26; i++) { const a = Math.random() * 6.3, x = s/2 + Math.cos(a) * s * 0.5, y = s/2 + Math.sin(a) * s * 0.5, rr = s * (0.04 + Math.random() * 0.07);
    g.globalCompositeOperation = "destination-out"; const r2 = g.createRadialGradient(x, y, 1, x, y, rr); r2.addColorStop(0, "rgba(0,0,0,0.5)"); r2.addColorStop(1, "rgba(0,0,0,0)"); g.fillStyle = r2; g.beginPath(); g.arc(x, y, rr, 0, 6.3); g.fill(); g.globalCompositeOperation = "destination-in"; } }); }
function jfxGeos() { if (jfxGeo) return jfxGeo; jfxGeo = {
  sph: new THREE.SphereGeometry(1, 24, 16),
  ring: new THREE.RingGeometry(0.72, 1, 48),
  torus: new THREE.TorusGeometry(1, 0.05, 8, 40),
  plane: new THREE.PlaneGeometry(1, 1),
  cone: new THREE.ConeGeometry(0.5, 1, 8),
  blade: jfxKunaiGeo() }; return jfxGeo; }
// kunai: flat diamond blade + grip, unit length ~0.4 along +Y, tip at top
function jfxKunaiGeo() { const g = new THREE.BufferGeometry();
  const v = [ 0,0.22,0, 0.05,0.02,0.018, -0.05,0.02,0.018, 0,-0.06,0,
              0,0.22,0, -0.05,0.02,-0.018, 0.05,0.02,-0.018, 0,-0.06,0 ];
  const idx = [0,1,2, 0,2,3, 0,3,1, 1,3,2, 4,5,6, 4,7,5, 4,6,7, 5,7,6];
  g.setAttribute("position", new THREE.Float32BufferAttribute(v, 3)); g.setIndex(idx); g.computeVertexNormals(); return g; }
function jfxCanvasTex(key, size, draw) { if (jfxTex[key]) return jfxTex[key];
  const c = document.createElement("canvas"); c.width = c.height = size; draw(c.getContext("2d"), size);
  jfxTex[key] = new THREE.CanvasTexture(c); return jfxTex[key]; }
function jfxPuffTex() { return jfxCanvasTex("puff", 128, (g, s) => { g.clearRect(0, 0, s, s);
  for (let i = 0; i < 22; i++) { const a = Math.random() * 6.3, d = Math.random() * s * 0.20, x = s/2 + Math.cos(a) * d, y = s/2 + Math.sin(a) * d, rr = s * (0.12 + Math.random() * 0.16);
    const r = g.createRadialGradient(x, y, 1, x, y, rr); r.addColorStop(0, "rgba(255,255,255,0.5)"); r.addColorStop(1, "rgba(255,255,255,0)"); g.fillStyle = r; g.beginPath(); g.arc(x, y, rr, 0, 6.3); g.fill(); }
  g.globalCompositeOperation = "destination-in";
  const r2 = g.createRadialGradient(s/2, s/2, s * 0.05, s/2, s/2, s * 0.48); r2.addColorStop(0, "rgba(0,0,0,1)"); r2.addColorStop(0.7, "rgba(0,0,0,0.95)"); r2.addColorStop(1, "rgba(0,0,0,0)"); g.fillStyle = r2; g.fillRect(0, 0, s, s);
  g.globalCompositeOperation = "destination-out";
  for (let i = 0; i < 8; i++) { const a = Math.random() * 6.3, d = s * (0.30 + Math.random() * 0.16), x = s/2 + Math.cos(a) * d, y = s/2 + Math.sin(a) * d, rr = s * (0.08 + Math.random() * 0.09);
    const r = g.createRadialGradient(x, y, 1, x, y, rr); r.addColorStop(0, "rgba(0,0,0,0.6)"); r.addColorStop(1, "rgba(0,0,0,0)"); g.fillStyle = r; g.beginPath(); g.arc(x, y, rr, 0, 6.3); g.fill(); }
  g.globalCompositeOperation = "source-over"; }); }
function jfxWispTex() { return jfxCanvasTex("wisp", 64, (g, s) => { g.clearRect(0, 0, s, s);
  const r = g.createRadialGradient(s/2, s/2, 2, s/2, s/2, s/2); r.addColorStop(0, "rgba(255,255,255,0.95)"); r.addColorStop(0.35, "rgba(240,248,255,0.55)"); r.addColorStop(1, "rgba(230,244,255,0)");
  g.fillStyle = r; g.fillRect(0, 0, s, s);
  g.strokeStyle = "rgba(255,255,255,0.5)"; g.lineWidth = 3; g.beginPath(); g.arc(s/2, s/2, s*0.22, 0.6, 2.6); g.stroke(); }); }
function jfxGlowTex() { return jfxCanvasTex("glow", 64, (g, s) => { g.clearRect(0, 0, s, s);
  const r = g.createRadialGradient(s/2, s/2, 1, s/2, s/2, s/2); r.addColorStop(0, "rgba(255,255,255,1)"); r.addColorStop(0.25, "rgba(220,240,255,0.6)"); r.addColorStop(1, "rgba(190,225,255,0)");
  g.fillStyle = r; g.fillRect(0, 0, s, s); }); }
function jfxBasic(c, o, add) { return new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: o, depthWrite: false, blending: add ? THREE.AdditiveBlending : THREE.NormalBlending, side: THREE.DoubleSide, fog: false, toneMapped: false }); }
function jfxSprite(c, o, tex) { const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex || jfxWispTex(), color: c, transparent: true, opacity: o, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, toneMapped: false })); m.userData.spr = 1; return m; }
function jfxGround(x, z, y) { try { if (typeof groundAt === "function") { const g = groundAt(x, z, 0.3, y == null ? 3 : y); if (Number.isFinite(g)) return g; } } catch (e) {} return y == null ? 0 : y; }
function jfxP(p) { return Array.isArray(p) ? { x: p[0], y: p[1] || 0, z: p[2] } : p; }
function jfxPush(fx) { if (jfxLive.length > 24) { const o = jfxLive.shift(); try { o.done(); } catch (e) {} }
  jfxLive.push(fx); if (!jfxGT && !jfxPumpOn) { jfxPumpOn = true; jfxPump.last = jfxNow(); requestAnimationFrame(jfxPump); } return fx; }
function jfxPump() { if (jfxGT) { jfxPumpOn = false; return; } const now = jfxNow(), dt = Math.min(0.1, Math.max(0.0005, now - (jfxPump.last || now))); jfxPump.last = now;
  jfxStep(dt); if (jfxLive.length) requestAnimationFrame(jfxPump); else jfxPumpOn = false; }
function jfxStep(dt) { jfxU.value += dt;
  for (let i = jfxLive.length - 1; i >= 0; i--) { const fx = jfxLive[i]; fx.age += dt;
    try { fx.tick(dt, fx.age, Math.min(1, fx.age / fx.ttl)); } catch (e) { try { xE(e); } catch (e2) {} }
    if (fx.age >= fx.ttl) { try { fx.done(); } catch (e) {} jfxLive.splice(i, 1); } } }
function jfxUseGameTick() { jfxGT = true; jfxPumpOn = false; } // integrator then calls jfxTick(dt) per frame
function jfxTick(dt) { jfxStep(dt); }
function jfxEnd(h) { if (!h || !h.fx) return; const fx = h.fx, i = jfxLive.indexOf(fx); if (i < 0) return;
  if (fx.dieable) { fx.ttl = Math.min(fx.ttl, fx.age + (fx.die || 0.4)); return; } // graceful: play die phase, cleanup on ttl
  jfxLive.splice(i, 1); try { fx.done(); } catch (e) {} }
function jfxDefaultDone(objs, parts) { return function () { objs.forEach((o) => { try { scene.remove(o); o.traverse((m) => { if (m.material && m.material.dispose) m.material.dispose(); if (m.userData.ownGeo && m.geometry) m.geometry.dispose(); }); } catch (e) {} });
  if (parts) parts.forEach((pt) => { try { scene.remove(pt.m); if (pt.m.material) pt.m.material.dispose(); } catch (e) {} }); }; }
function jfxFx(ttl, objs, tick, opts) { opts = opts || {}; const parts = opts.parts || null;
  const fx = { age: 0, ttl, objs, tick, die: opts.die || 0, dieable: !!opts.die, parts, done: opts.done || jfxDefaultDone(objs, parts) };
  objs.forEach((o) => scene.add(o)); jfxPush(fx); return { fx, end: function () { jfxEnd(this); } }; }
function jfxLogErr(e) { try { window.jfxErr = String(e && e.stack || e).slice(0, 300); xE(e); } catch (e2) {} }
// Integration hook for a round reset/cancel. Game logic must call this at its reset boundary.
function jfxReset() { while (jfxLive.length) { const fx = jfxLive[0]; jfxLive.splice(0, 1); try { fx.done(); } catch (e) {} } try { document.querySelectorAll(".jfxV").forEach((d) => d.remove()); } catch (e) {} }

// ---- Cloudburst ----
// reference: small bright white wind-orb, wispy curly trail; pop = soft burst; cloud = pale blue-white
// translucent lumpy sphere, slow internal swirl, bottom near ground, fast ~0.4s shrink cleanup.
function jfxCbProj() { try { const G = jfxGeos(), grp = new THREE.Group();
  const core = new THREE.Mesh(G.sph, jfxBasic(0xffffff, 0.95, true)); core.scale.setScalar(0.13);
  const halo = new THREE.Mesh(G.sph, jfxBasic(0xcfeaff, 0.35, true)); halo.scale.setScalar(0.30);
  const bands = []; for (let i = 0; i < 2; i++) { const b = new THREE.Mesh(G.torus, jfxBasic(0xe8f6ff, 0.6, true)); b.scale.setScalar(0.24 + i * 0.06); b.rotation.x = 1.2 + i; grp.add(b); bands.push(b); }
  grp.add(core, halo);
  const parts = [], fx = jfxFx(1e9, [grp], (dt, age, k) => { bands[0].rotation.x += dt * 9; bands[0].rotation.y += dt * 7; bands[1].rotation.y -= dt * 8; bands[1].rotation.z += dt * 6;
    halo.scale.setScalar(0.30 + Math.sin(jfxU.value * 14) * 0.03);
    if (!fx.fx.nextW || fx.age >= fx.fx.nextW) { fx.fx.nextW = fx.age + 0.028; const w = jfxSprite(0xeaf6ff, 0.5); w.position.copy(grp.position); w.scale.setScalar(0.16); scene.add(w); parts.push({ m: w, age: 0, ttl: 0.38, a0: Math.random() * 6.3 }); }
    for (let i = parts.length - 1; i >= 0; i--) { const pt = parts[i]; pt.age += dt; const pk = pt.age / pt.ttl; if (pk >= 1) { scene.remove(pt.m); pt.m.material.dispose(); parts.splice(i, 1); continue; }
      pt.m.material.opacity = 0.5 * (1 - pk); pt.m.scale.setScalar(0.16 + pk * 0.35); pt.m.material.rotation = pt.a0 + pk * 2.4; }
    if (fx.fx.rel) parts.forEach((pt) => { pt.ttl = Math.min(pt.ttl, pt.age + 0.1); });
  }, { parts, die: 0.3 });
  return fx; } catch (e) { jfxLogErr(e); return null; } }
function jfxCbPop(p) { try { p = jfxP(p); const G = jfxGeos();
  const flash = new THREE.Mesh(G.sph, jfxBasic(0xeaf8ff, 0.8, true)); flash.position.set(p.x, p.y, p.z); flash.scale.setScalar(0.25);
  const parts = []; for (let i = 0; i < 7; i++) { const w = jfxSprite(0xdff2ff, 0.6); const a = Math.random() * 6.3; w.position.set(p.x + Math.cos(a) * 0.2, p.y + (Math.random() - 0.3) * 0.3, p.z + Math.sin(a) * 0.2); w.scale.setScalar(0.3); scene.add(w); parts.push({ m: w, age: 0, ttl: 0.3 + Math.random() * 0.15, vx: Math.cos(a) * 2.4, vy: (Math.random() - 0.2) * 1.6, vz: Math.sin(a) * 2.4, grow: 2.6 }); }
  return jfxFx(0.45, [flash], (dt, age, k) => { flash.material.opacity = 0.8 * (1 - k); flash.scale.setScalar(0.25 + k * 1.1);
    parts.forEach((pt) => { pt.age += dt; const pk = Math.min(1, pt.age / pt.ttl); pt.m.position.x += pt.vx * dt; pt.m.position.y += pt.vy * dt; pt.m.position.z += pt.vz * dt; pt.m.material.opacity = 0.6 * (1 - pk); pt.m.scale.setScalar(0.3 + pk * pt.grow * 0.4); }); }, { parts });
 } catch (e) { jfxLogErr(e); return null; } }
function jfxCbCloud(p, r, seconds) { try { p = jfxP(p); const R = r || 3.35, ttl = Math.max(0.8, seconds || 4.25);
  const grp = new THREE.Group(); grp.position.set(p.x, p.y, p.z);
  const dome = new THREE.Mesh(jfxGeos().sph, new THREE.MeshBasicMaterial({ map: jfxDomeTex(), color: 0xdceeff, transparent: true, opacity: 0.5, depthWrite: false, side: THREE.FrontSide, blending: THREE.NormalBlending, fog: false, toneMapped: false })); dome.userData.spr = 1;
  dome.scale.set(R, R * 0.60, R); dome.position.y = R * 0.28; grp.add(dome);
  const puffs = []; for (let i = 0; i < 16; i++) { const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: jfxPuffTex(), color: i % 3 === 0 ? 0xc8e0f5 : 0xdfeefc, transparent: true, opacity: 0.4, depthWrite: false, blending: THREE.NormalBlending, fog: false, toneMapped: false })); m.userData.spr = 1;
    const a = Math.random() * 6.3, b = (Math.random() - 0.5) * 2.4, d = R * (0.40 + Math.random() * 0.65);
    const sc = R * (0.5 + Math.random() * 0.4); m.scale.setScalar(sc); m.material.rotation = Math.random() * 6.3;
    m.userData = { a, b, d, s: sc, ph: Math.random() * 6.3, spin: (Math.random() - 0.5) * 0.5, spr: 1 };
    grp.add(m); puffs.push(m); }
  const glows = []; for (let i = 0; i < 3; i++) { const gm = jfxSprite(0xeaf6ff, 0.12, jfxPuffTex()); gm.scale.setScalar(R * 0.7); gm.position.set((Math.random()-0.5) * R * 0.4, R * 0.4 + (Math.random()-0.5) * R * 0.25, (Math.random()-0.5) * R * 0.4); grp.add(gm); glows.push(gm); }
  const h = jfxFx(ttl, [grp], (dt, age, k) => { const T = h.fx.ttl, grow = Math.min(1, age / 0.4), die = Math.max(0, (age - (T - h.fx.die)) / h.fx.die), s = (0.3 + 0.7 * grow) * (1 - die * die);
    grp.scale.setScalar(Math.max(0.001, s)); grp.rotation.y += dt * 0.12;
    dome.material.opacity = 0.5 * grow * (1 - die); dome.rotation.y += dt * 0.25;
    puffs.forEach((pm) => { const u = pm.userData; u.a += dt * 0.10;
      pm.position.set(Math.cos(u.a) * Math.cos(u.b) * u.d, R * 0.38 + Math.sin(u.b) * u.d * 0.45 + Math.sin(jfxU.value * 0.5 + u.ph) * R * 0.05, Math.sin(u.a) * Math.cos(u.b) * u.d);
      pm.material.rotation += u.spin * dt; pm.material.opacity = 0.4 * grow * (1 - die); pm.scale.setScalar(u.s * (0.92 + 0.10 * Math.sin(jfxU.value * 0.7 + u.ph))); });
    glows.forEach((gm) => { gm.material.opacity = 0.12 * grow * (1 - die); }); }, { die: 0.45 });
  return h; } catch (e) { jfxLogErr(e); return null; } }

// ---- Updraft ----
// reference: instant flat radial white wispy wind ring at the feet + short vertical white streak column, gone <1s.
function jfxUpdraft(p) { try { p = jfxP(p); const G = jfxGeos(), gy = jfxGround(p.x, p.z, p.y);
  const ring = new THREE.Mesh(G.ring, jfxBasic(0xeaf6ff, 0.85, true)); ring.rotation.x = -Math.PI / 2; ring.position.set(p.x, gy + 0.07, p.z); ring.scale.setScalar(0.3);
  const parts = []; for (let i = 0; i < 8; i++) { const w = jfxSprite(0xf4fbff, 0.85); const a = (i / 8) * 6.3 + Math.random() * 0.5; w.position.set(p.x + Math.cos(a) * 0.35, gy + 0.2, p.z + Math.sin(a) * 0.35); w.scale.set(0.4, 1.5, 1); scene.add(w);
    parts.push({ m: w, age: 0, ttl: 0.45 + Math.random() * 0.15, vy: 3.2 + Math.random() * 1.6, a, rr: 0.35, spin: 3 + Math.random() * 3 }); }
  return jfxFx(0.6, [ring], (dt, age, k) => { ring.scale.setScalar(0.3 + k * 2.1); ring.material.opacity = 0.85 * (1 - k * k);
    parts.forEach((pt) => { pt.age += dt; const pk = Math.min(1, pt.age / pt.ttl); pt.rr += dt * 1.1; pt.m.position.set(p.x + Math.cos(pt.a + pt.age * pt.spin) * pt.rr, pt.m.position.y + pt.vy * dt, p.z + Math.sin(pt.a + pt.age * pt.spin) * pt.rr);
      pt.m.material.opacity = 0.85 * (1 - pk); pt.m.scale.set(0.4 + pk * 0.35, 1.5 + pk * 1.4, 1); }); }, { parts });
 } catch (e) { jfxLogErr(e); return null; } }

// ---- Tailwind ----
// reference: ~1s windup of white wisps curling around the hands; the dash is radial white speed-line
// streaks along the travel direction, world trail fading in ~0.3-0.5s.
function jfxTailwindWindup(p, seconds) { try { p = jfxP(p); const ttl = Math.max(0.3, seconds || 0.8), grp = new THREE.Group(); grp.position.set(p.x, p.y, p.z);
  const parts = []; for (let i = 0; i < 10; i++) { const w = jfxSprite(0xf0f9ff, 0.75); w.scale.set(0.3, 0.55, 1); grp.add(w); parts.push({ m: w, a: (i / 10) * 6.3, rr: 0.8, y: 0.4 + Math.random() * 1.1, sp: 4 + Math.random() * 3 }); }
  return jfxFx(ttl, [grp], (dt, age, k) => { parts.forEach((pt) => { pt.a += dt * pt.sp; pt.rr = Math.max(0.12, pt.rr - dt * 0.5);
    pt.m.position.set(Math.cos(pt.a) * pt.rr, pt.y + Math.sin(jfxU.value * 6 + pt.a) * 0.15, Math.sin(pt.a) * pt.rr); pt.m.material.opacity = 0.75 * Math.sin(Math.min(1, k * 1.15) * Math.PI); pt.m.material.rotation = pt.a; }); }, { die: 0.25 });
 } catch (e) { jfxLogErr(e); return null; } }
function jfxTailwindDash(a, b) { try { a = jfxP(a); b = jfxP(b); const G = jfxGeos();
  const dx = b.x - a.x, dy = (b.y || 0) - (a.y || 0), dz = b.z - a.z, len = Math.max(0.5, Math.hypot(dx, dy, dz));
  const dir = new THREE.Vector3(dx / len, dy / len, dz / len), grp = new THREE.Group(), streaks = [];
  for (let i = 0; i < 10; i++) { const m = new THREE.Mesh(G.plane, jfxBasic(0xf0f9ff, 0.0, true)); m.userData.ownGeo = 0;
    const t = 0.15 + Math.random() * 0.8, off = new THREE.Vector3(Math.random() - 0.5, (Math.random() - 0.5) * 0.8, Math.random() - 0.5).multiplyScalar(0.7);
    m.position.set(a.x + dx * t + off.x, (a.y || 0) + dy * t + 0.7 + off.y, a.z + dz * t + off.z);
    m.scale.set(0.05 + Math.random() * 0.05, 1.1 + Math.random() * 1.3, 1);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir); m.rotateY(Math.random() * 6.3);
    grp.add(m); streaks.push({ m, d: Math.random() * 0.08 }); }
  const wisps = []; for (let i = 0; i < 6; i++) { const w = jfxSprite(0xe6f4ff, 0.5); const t = Math.random(); w.position.set(a.x + dx * t, (a.y || 0) + dy * t + 0.6, a.z + dz * t); w.scale.setScalar(0.4); grp.add(w); wisps.push(w); }
  const gusts = []; for (let i = 0; i < 5; i++) { const gz = jfxSprite(0xeaf6ff, 0.3, jfxPuffTex()); const t = 0.08 + i * 0.2; gz.position.set(a.x + dx * t, (a.y || 0) + dy * t + 0.7, a.z + dz * t); gz.scale.set(1.5, 0.8, 1); gz.material.rotation = Math.random() * 6.3; grp.add(gz); gusts.push(gz); }
  return jfxFx(0.55, [grp], (dt, age, k) => { streaks.forEach((s) => { const sk = Math.min(1, Math.max(0, (age - s.d) / 0.35)); s.m.material.opacity = 0.75 * Math.sin(sk * Math.PI); s.m.scale.y *= 1 + dt * 2.2; });
    wisps.forEach((w, i) => { w.material.opacity = 0.5 * (1 - k); w.scale.setScalar(0.4 + k * 0.7); });
    gusts.forEach((gz) => { gz.position.x += dir.x * dt * 2.5; gz.position.y += dir.y * dt * 2.5; gz.position.z += dir.z * dt * 2.5;
      gz.material.opacity = 0.3 * Math.sin(Math.min(1, k * 1.15) * Math.PI); gz.scale.set(1.5 + k * 1.4, 0.8 + k * 0.6, 1); gz.material.rotation += dt * 1.5; }); });
 } catch (e) { jfxLogErr(e); return null; } }

// ---- Blade Storm ----
// reference: white-silver kunai with a blue-white glow materialize one-by-one into a hovering fan;
// the throw is a kunai with a thin bright white-blue streak; impact is a small bright flash + brief ring.
function jfxKunai() { const G = jfxGeos(), grp = new THREE.Group();
  const blade = new THREE.Mesh(G.blade, jfxBasic(0xdcecff, 1, false)); blade.position.y = 0.08;
  const grip = new THREE.Mesh(G.plane, jfxBasic(0x22303c, 1, false)); grip.scale.set(0.035, 0.12, 1); grip.position.y = -0.13; grip.userData.ownGeo = 0;
  const glow = jfxSprite(0x9fd4ff, 0.55, jfxGlowTex()); glow.scale.setScalar(0.4); glow.position.y = 0.08;
  grp.add(blade, grip, glow); return grp; }
function jfxBladeFan(p, n, seconds) { try { p = jfxP(p); const N = Math.max(1, n || 5), ttl = Math.max(1, seconds || 1e9), grp = new THREE.Group(); grp.position.set(p.x, p.y, p.z);
  const ks = []; for (let i = 0; i < N; i++) { const k = jfxKunai(); const t = N === 1 ? 0.5 : i / (N - 1), a = (t - 0.5) * 1.5;
    k.position.set(Math.sin(a) * 0.55, Math.cos(a * 0.8) * 0.28, 0); k.rotation.z = -a * 0.9; k.visible = false; k.userData.born = i * 0.12; grp.add(k); ks.push(k); }
  const h = jfxFx(ttl, [grp], (dt, age, k) => { ks.forEach((kk) => { const born = kk.userData.born;
      if (!kk.visible && age >= born) { kk.visible = true; kk.scale.setScalar(0.01); }
      if (!kk.visible) return;
      const g2 = Math.min(1, (age - born) / 0.18); kk.scale.setScalar(0.01 + 0.99 * g2);
      kk.position.y = Math.cos((kk.rotation.z) * 0.8) * 0.28 + Math.sin(jfxU.value * 2.2 + born * 8) * 0.05;
      kk.children.forEach((c) => { if (c.material && c.material.opacity !== undefined && fxRel(h)) c.material.opacity = Math.max(0, c.material.opacity - dt / 0.3); });
      if (fxRel(h)) kk.scale.multiplyScalar(Math.max(0, 1 - dt / 0.3)); }); }, { die: 0.3 });
  h.setCount = function (left) { ks.forEach((kk, i) => { if (i >= left && kk.visible) { kk.visible = false; } }); };
  h.kunai = ks; return h; } catch (e) { jfxLogErr(e); return null; } }
function fxRel(h) { return h && h.fx && h.fx.ttl - h.fx.age <= (h.fx.die || 0.4) + 0.001 && h.fx.ttl < 1e8; }
function jfxBladeThrow(o, t) { try { o = jfxP(o); t = jfxP(t); const G = jfxGeos();
  const dx = t.x - o.x, dy = (t.y || 0) - (o.y || 0), dz = t.z - o.z, len = Math.max(0.3, Math.hypot(dx, dy, dz));
  const dir = new THREE.Vector3(dx / len, dy / len, dz / len), fly = Math.min(0.16, len / 90), ttl = fly + 0.5;
  const kunai = jfxKunai(); kunai.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir); kunai.position.set(o.x, o.y, o.z);
  const streak = new THREE.Mesh(G.plane, jfxBasic(0xbfe6ff, 0.0, true)); streak.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
  const flash = jfxSprite(0xdff4ff, 0, jfxGlowTex()); flash.position.set(t.x, t.y, t.z); flash.scale.setScalar(0.1);
  const ring = new THREE.Mesh(G.ring, jfxBasic(0xaee2ff, 0, true)); ring.position.set(t.x, t.y + 0.02, t.z); ring.scale.setScalar(0.12);
  ring.lookAt(t.x + dir.x, t.y + dir.y, t.z + dir.z);
  return jfxFx(ttl, [kunai, streak, flash, ring], (dt, age, k) => {
    if (age <= fly) { const fk = age / fly; kunai.position.set(o.x + dx * fk, o.y + dy * fk, o.z + dz * fk); kunai.rotateY(dt * 30); streak.material.opacity = 0; }
    else { const dk = (age - fly) / 0.5; kunai.visible = false;
      streak.position.set((o.x + t.x) / 2, (o.y + (t.y || 0)) / 2, (o.z + t.z) / 2); streak.scale.set(0.045, len, 1);
      streak.material.opacity = 0.85 * Math.max(0, 1 - dk / 0.6);
      flash.material.opacity = 0.95 * Math.max(0, 1 - dk / 0.25); flash.scale.setScalar(0.1 + Math.min(1, dk / 0.25) * 0.7);
      ring.material.opacity = 0.7 * Math.max(0, 1 - dk / 0.4); ring.scale.setScalar(0.12 + Math.min(1, dk / 0.4) * 0.55); } });
 } catch (e) { jfxLogErr(e); return null; } }
// ---- END JETT FX ----

// drop all cached shared GPU resources (textures, geometries); next use recreates them lazily.
// integrator: call on full reconnect/reset cycles so retained memory stays bounded.
function jfxDisposeShared() { for (const k in jfxTex) { try { jfxTex[k].dispose(); } catch (e) {} delete jfxTex[k]; }
  if (jfxGeo) { for (const k in jfxGeo) { try { jfxGeo[k].dispose(); } catch (e) {} } jfxGeo = null; } }
