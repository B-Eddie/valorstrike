// ---- RAZE FX ----
// Raze ability visuals (work/raze_fx_runtime.js), reference-grounded in the wiki showcase clips
// (wiki.playvalorant.com/en-us/images/Boom_Bot_Showcase.mp4, Blast_Pack_Showcase.mp4,
// Paint_Shells_Showcase.mp4, Showstopper_Showcase.mp4; frame sheets reviewed 2026-11-04).
// Procedural approximation, not extracted game assets. Main entries preserve game mechanics.
// All positions are world-space [x,y,z] arrays or {x,y,z}. Returns handles {fx,end()}.
// rzxUseGameTick() then rzxTick(dt) hands timing to the game loop (jFxTick wires it);
// otherwise a single rAF pump runs while effects exist. Effect age is game dt only.
// Shared geometry/textures persist; cloned per-effect materials are disposed recursively.
// end() on long-lived handles (dieable) plays the dissipate phase, then cleanup runs.
var rzxU = { value: 0 }, rzxLive = [], rzxPumpOn = false, rzxGT = null, rzxGeo = null, rzxTex = {};
function rzxNow() { try { return performance.now() / 1000; } catch (e) { return Date.now() / 1000; } }
function rzxWedgeTex() { return rzxCanvasTex("wedge", 128, (g, s) => { g.clearRect(0, 0, s, s);
  const gr = g.createLinearGradient(0, s, 0, 0); gr.addColorStop(0, "rgba(255,255,255,0.95)"); gr.addColorStop(0.7, "rgba(255,255,255,0.55)"); gr.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = gr; g.beginPath(); g.moveTo(s * 0.46, s * 0.88); g.lineTo(s * 0.54, s * 0.88); g.lineTo(s * 0.82, s * 0.10); g.lineTo(s * 0.18, s * 0.10); g.closePath(); g.fill();
  g.globalCompositeOperation = "destination-out";
  for (let i = 0; i < 8; i++) { const y = s * (0.1 + Math.random() * 0.85), w = s * (0.06 + Math.random() * 0.10); const x = Math.random() < 0.5 ? s * 0.1 : s * 0.9;
    const rr = g.createRadialGradient(x, y, 1, x, y, w); rr.addColorStop(0, "rgba(0,0,0,0.7)"); rr.addColorStop(1, "rgba(0,0,0,0)"); g.fillStyle = rr; g.beginPath(); g.arc(x, y, w, 0, 6.3); g.fill(); }
  g.globalCompositeOperation = "destination-in";
  const e = g.createRadialGradient(s/2, s/2, s * 0.18, s/2, s/2, s * 0.52); e.addColorStop(0, "rgba(255,255,255,1)"); e.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = e; g.fillRect(0, 0, s, s); }); }
// irregular angular debris chunk (NOT a symmetric star): uneven vertex spacing, random radii,
// one darker facet for depth; alpha fades to 0 well inside the canvas edges.
// jagged lightning-like streak, tapered zigzag, alpha fades at both ends and inside margins.
function rzxJagTex() { return rzxCanvasTex("jag", 128, (g, s) => { g.clearRect(0, 0, s, s);
  let x = s * 0.5; g.strokeStyle = "rgba(255,255,255,0.95)"; g.lineCap = "round"; g.lineJoin = "round";
  g.beginPath(); g.moveTo(x, s * 0.92);
  const segs = 5; for (let i = 1; i <= segs; i++) { x += (i % 2 ? -1 : 1) * s * (0.05 + Math.random() * 0.10); g.lineTo(Math.max(s * 0.32, Math.min(s * 0.68, x)), s * (0.92 - i * (0.84 / segs))); }
  g.lineWidth = s * 0.045; g.stroke();
  g.globalCompositeOperation = "destination-in";
  const e = g.createLinearGradient(0, s, 0, 0); e.addColorStop(0, "rgba(255,255,255,0)"); e.addColorStop(0.25, "rgba(255,255,255,1)"); e.addColorStop(0.8, "rgba(255,255,255,1)"); e.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = e; g.fillRect(0, 0, s, s); }); }
// radiating jagged streaks: col, additive flag, length in world units, fan out from p.
function rzxStreaks(p, n, col, R, len, ttl, add) { const parts = []; try { p = rzxP(p);
  for (let i = 0; i < n; i++) { const m = rzxSprite(col, 0.95, rzxJagTex(), add); const a = (i / n) * 6.3 + Math.random() * 0.6;
    const up = Math.random() * 0.9 + 0.15, L = len * (0.7 + Math.random() * 0.6);
    m.position.set(p.x + Math.cos(a) * R * 0.45, p.y + R * 0.4, p.z + Math.sin(a) * R * 0.45);
    m.scale.set(R * 0.2, L, 1); m.material.rotation = Math.atan2(Math.cos(a), up) * -1; scene.add(m);
    parts.push({ m, age: 0, ttl: ttl * (0.8 + Math.random() * 0.4), vx: Math.cos(a) * 3.2, vy: up * 2.4, vz: Math.sin(a) * 3.2, o0: 0.95 }); } } catch (e) { rzxLogErr(e); } return parts; }
function rzxShardTex(v) { const key = "shard" + (v || 0); return rzxCanvasTex(key, 128, (g, s) => { g.clearRect(0, 0, s, s);
  const cx = s/2, cy = s/2, n = 5 + Math.floor(Math.random() * 3), angs = [], rads = [];
  let a0 = Math.random() * 6.3; for (let i = 0; i < n; i++) { angs.push(a0 + (i / n) * 6.3 + (Math.random() - 0.5) * 0.55); rads.push((0.20 + Math.random() * 0.26) * s); }
  g.fillStyle = "rgba(255,255,255,0.95)"; g.beginPath();
  for (let i = 0; i < n; i++) { const x = cx + Math.cos(angs[i]) * rads[i], y = cy + Math.sin(angs[i]) * rads[i]; i ? g.lineTo(x, y) : g.moveTo(x, y); }
  g.closePath(); g.fill();
  g.fillStyle = "rgba(0,0,0,0.35)"; g.beginPath(); g.moveTo(cx, cy);
  g.lineTo(cx + Math.cos(angs[0]) * rads[0], cy + Math.sin(angs[0]) * rads[0]);
  g.lineTo(cx + Math.cos(angs[1]) * rads[1], cy + Math.sin(angs[1]) * rads[1]); g.closePath(); g.fill();
  g.globalCompositeOperation = "destination-in";
  const e = g.createRadialGradient(cx, cy, s * 0.20, cx, cy, s * 0.47); e.addColorStop(0, "rgba(255,255,255,1)"); e.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = e; g.fillRect(0, 0, s, s); }); }
function rzxGeos() { if (rzxGeo) return rzxGeo; rzxGeo = {
  sph: new THREE.SphereGeometry(1, 20, 14),
  ring: new THREE.RingGeometry(0.7, 1, 48),
  disc: new THREE.CircleGeometry(1, 40),
  plane: new THREE.PlaneGeometry(1, 1),
  cone: new THREE.ConeGeometry(0.16, 1, 6),
  tetra: new THREE.TetrahedronGeometry(1),
  box: new THREE.BoxGeometry(1, 1, 1),
  torus: new THREE.TorusGeometry(1, 0.09, 8, 32) }; return rzxGeo; }
function rzxCanvasTex(key, size, draw) { if (rzxTex[key]) return rzxTex[key];
  const c = document.createElement("canvas"); c.width = c.height = size; draw(c.getContext("2d"), size);
  rzxTex[key] = new THREE.CanvasTexture(c); return rzxTex[key]; }
function rzxBlobTex() { return rzxCanvasTex("blob", 64, (g, s) => { g.clearRect(0, 0, s, s);
  const r = g.createRadialGradient(s/2, s/2, 1, s/2, s/2, s/2); r.addColorStop(0, "rgba(255,255,255,1)"); r.addColorStop(0.4, "rgba(255,255,255,0.5)"); r.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = r; g.fillRect(0, 0, s, s); }); }
function rzxSmokeTex() { return rzxCanvasTex("smoke", 64, (g, s) => { g.clearRect(0, 0, s, s);
  for (let i = 0; i < 5; i++) { const x = s/2 + (Math.random()-0.5)*s*0.3, y = s/2 + (Math.random()-0.5)*s*0.3, rr = s*(0.22+Math.random()*0.16);
    const r = g.createRadialGradient(x, y, 1, x, y, rr); r.addColorStop(0, "rgba(255,255,255,0.5)"); r.addColorStop(1, "rgba(255,255,255,0)"); g.fillStyle = r; g.beginPath(); g.arc(x, y, rr, 0, 6.3); g.fill(); } }); }
// ragged radial splat (flung-paint look): spikes of random length around the rim
function rzxSplatTex(key, c0, c1, edge) { return rzxCanvasTex(key, 256, (g, s) => { g.clearRect(0, 0, s, s);
  const N = 26, pts = []; for (let i = 0; i < N; i++) pts.push(0.55 + Math.random() * 0.45);
  g.beginPath(); for (let i = 0; i <= N; i++) { const a = (i % N) / N * Math.PI * 2, k = pts[i % N] * (i % 2 ? 0.9 : 1); const x = s/2 + Math.cos(a) * s * 0.48 * k, y = s/2 + Math.sin(a) * s * 0.48 * k; i ? g.lineTo(x, y) : g.moveTo(x, y); }
  g.closePath(); const r = g.createRadialGradient(s/2, s/2, s*0.05, s/2, s/2, s*0.5); r.addColorStop(0, c0); r.addColorStop(0.7, c1); r.addColorStop(1, edge);
  g.fillStyle = r; g.fill();
  for (let i = 0; i < 14; i++) { const a = Math.random() * 6.3, d0 = s * (0.28 + Math.random() * 0.18), d1 = d0 + s * (0.06 + Math.random() * 0.16);
    g.strokeStyle = c1; g.lineWidth = 2 + Math.random() * 5; g.lineCap = "round"; g.beginPath(); g.moveTo(s/2 + Math.cos(a) * d0, s/2 + Math.sin(a) * d0); g.lineTo(s/2 + Math.cos(a) * d1, s/2 + Math.sin(a) * d1); g.stroke(); } }); }
function rzxStarTex() { return rzxCanvasTex("star", 128, (g, s) => { g.clearRect(0, 0, s, s); g.translate(s/2, s/2);
  const r = g.createRadialGradient(0, 0, 1, 0, 0, s*0.2); r.addColorStop(0, "rgba(255,255,255,1)"); r.addColorStop(1, "rgba(255,255,255,0)"); g.fillStyle = r; g.fillRect(-s/2, -s/2, s, s);
  g.fillStyle = "rgba(255,255,255,0.95)"; for (let i = 0; i < 4; i++) { g.rotate(Math.PI / 2); g.beginPath(); g.moveTo(0, -s*0.5); g.lineTo(s*0.05, 0); g.lineTo(-s*0.05, 0); g.closePath(); g.fill(); } }); }
function rzxBasic(c, o, add) { return new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: o, depthWrite: false, blending: add ? THREE.AdditiveBlending : THREE.NormalBlending, side: THREE.DoubleSide, fog: false, toneMapped: false }); }
function rzxFireLobeTex() { return rzxCanvasTex("firelobe", 128, (g, s) => { g.clearRect(0, 0, s, s);
  for (let i = 0; i < 26; i++) { const a = Math.random() * 6.3, d = Math.random() * s * 0.22, x = s/2 + Math.cos(a) * d, y = s/2 + Math.sin(a) * d, rr = s * (0.10 + Math.random() * 0.14);
    const r = g.createRadialGradient(x, y, 1, x, y, rr); r.addColorStop(0, "rgba(255,255,255,0.55)"); r.addColorStop(1, "rgba(255,255,255,0)"); g.fillStyle = r; g.beginPath(); g.arc(x, y, rr, 0, 6.3); g.fill(); }
  g.globalCompositeOperation = "lighter";
  const rc = g.createRadialGradient(s/2, s/2, 1, s/2, s/2, s * 0.28); rc.addColorStop(0, "rgba(255,255,255,0.9)"); rc.addColorStop(1, "rgba(255,255,255,0)"); g.fillStyle = rc; g.fillRect(0, 0, s, s);
  g.globalCompositeOperation = "destination-in";
  const r2 = g.createRadialGradient(s/2, s/2, s * 0.05, s/2, s/2, s * 0.48); r2.addColorStop(0, "rgba(0,0,0,1)"); r2.addColorStop(0.7, "rgba(0,0,0,0.95)"); r2.addColorStop(1, "rgba(0,0,0,0)"); g.fillStyle = r2; g.fillRect(0, 0, s, s);
  g.globalCompositeOperation = "destination-out";
  for (let i = 0; i < 10; i++) { const a = Math.random() * 6.3, d = s * (0.30 + Math.random() * 0.18), x = s/2 + Math.cos(a) * d, y = s/2 + Math.sin(a) * d, rr = s * (0.08 + Math.random() * 0.10);
    const r = g.createRadialGradient(x, y, 1, x, y, rr); r.addColorStop(0, "rgba(0,0,0,0.8)"); r.addColorStop(1, "rgba(0,0,0,0)"); g.fillStyle = r; g.beginPath(); g.arc(x, y, rr, 0, 6.3); g.fill(); }
  g.globalCompositeOperation = "source-over"; }); }
function rzxSprite(c, o, tex, add) { const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex || rzxBlobTex(), color: c, transparent: true, opacity: o, depthWrite: false, blending: add === false ? THREE.NormalBlending : THREE.AdditiveBlending, fog: false, toneMapped: false })); m.userData.spr = 1; return m; }
function rzxGround(x, z, y) { try { if (typeof groundAt === "function") { const g = groundAt(x, z, 0.3, y == null ? 3 : y); if (Number.isFinite(g)) return g; } } catch (e) {} return y == null ? 0 : y; }
function rzxP(p) { return Array.isArray(p) ? { x: p[0], y: p[1] || 0, z: p[2] } : p; }
function rzxPush(fx) { if (rzxLive.length > 24) { const o = rzxLive.shift(); try { o.done(); } catch (e) {} }
  rzxLive.push(fx); if (!rzxGT && !rzxPumpOn) { rzxPumpOn = true; rzxPump.last = rzxNow(); requestAnimationFrame(rzxPump); } return fx; }
function rzxPump() { if (rzxGT) { rzxPumpOn = false; return; } const now = rzxNow(), dt = Math.min(0.1, Math.max(0.0005, now - (rzxPump.last || now))); rzxPump.last = now;
  rzxStep(dt); if (rzxLive.length) requestAnimationFrame(rzxPump); else rzxPumpOn = false; }
function rzxStep(dt) { rzxU.value += dt;
  for (let i = rzxLive.length - 1; i >= 0; i--) { const fx = rzxLive[i]; fx.age += dt;
    try { fx.tick(dt, fx.age, Math.min(1, fx.age / fx.ttl)); } catch (e) { try { xE(e); } catch (e2) {} }
    if (fx.age >= fx.ttl) { try { fx.done(); } catch (e) {} rzxLive.splice(i, 1); } } }
function rzxUseGameTick() { rzxGT = true; rzxPumpOn = false; } // integrator then calls rzxTick(dt) per frame
function rzxTick(dt) { rzxStep(dt); }
function rzxEnd(h) { if (!h || !h.fx) return; const fx = h.fx, i = rzxLive.indexOf(fx); if (i < 0) return;
  if (fx.dieable) { fx.ttl = Math.min(fx.ttl, fx.age + (fx.die || 0.4)); return; }
  rzxLive.splice(i, 1); try { fx.done(); } catch (e) {} }
function rzxDefaultDone(objs, parts) { return function () { objs.forEach((o) => { try { scene.remove(o); o.traverse((m) => { if (m.material && m.material.dispose) m.material.dispose(); if (m.userData.ownGeo && m.geometry) m.geometry.dispose(); }); } catch (e) {} });
  if (parts) parts.forEach((pt) => { try { scene.remove(pt.m); if (pt.m.material) pt.m.material.dispose(); } catch (e) {} }); }; }
function rzxFx(ttl, objs, tick, opts) { opts = opts || {}; const parts = opts.parts || null;
  const fx = { age: 0, ttl, objs, tick, die: opts.die || 0, dieable: !!opts.die, parts, done: opts.done || rzxDefaultDone(objs, parts) };
  objs.forEach((o) => scene.add(o)); rzxPush(fx); return { fx, end: function () { rzxEnd(this); } }; }
function rzxLogErr(e) { try { window.rzxErr = String(e && e.stack || e).slice(0, 300); xE(e); } catch (e2) {} }
// Integration hook for a round reset/cancel. Game logic must call this at its reset boundary.
function rzxReset() { while (rzxLive.length) { const fx = rzxLive[0]; rzxLive.splice(0, 1); try { fx.done(); } catch (e) {} } try { document.querySelectorAll(".rzxV").forEach((d) => d.remove()); } catch (e) {} }

// shared particle updater: parts carry {m,age,ttl,vx,vy,vz,g,gr,grow,o0,spin}
function rzxPartTick(parts, dt) { for (let i = parts.length - 1; i >= 0; i--) { const pt = parts[i]; pt.age += dt; const pk = pt.age / pt.ttl;
    if (pk >= 1) { scene.remove(pt.m); if (pt.m.material) pt.m.material.dispose(); parts.splice(i, 1); continue; }
    if (pt.vx !== undefined) { pt.vy -= (pt.g || 0) * dt; pt.m.position.x += pt.vx * dt; pt.m.position.y += pt.vy * dt; pt.m.position.z += pt.vz * dt; }
    if (pt.spin) pt.m.material.rotation += pt.spin * dt;
    pt.m.material.opacity = (pt.o0 == null ? 0.7 : pt.o0) * (1 - pk);
    if (pt.grow) { const s0 = pt.s0 || (pt.s0 = pt.m.scale.x); pt.m.scale.setScalar(s0 * (1 + pk * pt.grow)); } } }

// ---- shared explosion pieces ----
// lobed fireball: bright core flash, then overlapping colored lobes that billow out and dark-smoke off.
function rzxFireball(p, R, coreC, lobeC, smokeC, seconds, lobeTex) { try { const grp = new THREE.Group(); grp.position.set(p.x, p.y, p.z);
  const core = rzxSprite(0xfff6d8, 1); core.scale.setScalar(R * 0.9); core.position.y = R * 0.25; grp.add(core);
  const lobes = [], dark = new THREE.Color(0x2e2024);
  for (let i = 0; i < 20; i++) { const shell = i >= 6 && i < 14;
    const c = shell ? lobeC : (i < 6 ? coreC : (Math.random() < 0.4 ? 0xff8a2a : lobeC));
    const m = rzxSprite(c, shell ? 0.9 : 0.9, shell ? rzxBlobTex() : ((lobeTex && i % 2 === 0) ? lobeTex : rzxFireLobeTex()), shell ? false : true);
    const a = Math.random() * 6.3, d = shell ? R * (0.18 + Math.random() * 0.18) : R * (0.02 + Math.random() * 0.16);
    m.position.set(Math.cos(a) * d, R * (shell ? 0.15 + Math.random() * 0.5 : 0.15 + Math.random() * 0.45), Math.sin(a) * d); m.scale.setScalar(R * 0.2); m.material.rotation = Math.random() * 6.3;
    m.userData = { s: R * (shell ? 0.65 + Math.random() * 0.25 : 0.60 + Math.random() * 0.40), d: Math.random() * 0.10, vx: Math.cos(a) * (0.25 + Math.random() * 0.6), vz: Math.sin(a) * (0.25 + Math.random() * 0.6), vy: 1.3 + Math.random() * 1.2, spin: (Math.random() - 0.5) * 1.8, c0: new THREE.Color(c) };
    grp.add(m); lobes.push(m); }
  const parts = []; for (let i = 0; i < 6; i++) { const sm = rzxSprite(smokeC, 0.55, rzxSmokeTex(), false); sm.position.set(p.x + (Math.random()-0.5) * R, p.y + R * 0.5, p.z + (Math.random()-0.5) * R); sm.scale.setScalar(R * 0.5); scene.add(sm);
    parts.push({ m: sm, age: 0, ttl: seconds * (0.7 + Math.random() * 0.3), vx: (Math.random()-0.5) * 0.8, vy: 1.4 + Math.random(), vz: (Math.random()-0.5) * 0.8, grow: 2.2, o0: 0.55, spin: (Math.random()-0.5) * 1.5 }); }
  return { grp, core, lobes, parts, tick: (dt, age) => { const ck = Math.min(1, age / 0.1); core.material.opacity = Math.max(0, 1 - age / 0.38); core.scale.setScalar(R * (0.9 + ck * 0.8));
      lobes.forEach((m) => { const u = m.userData, lk = Math.min(1, Math.max(0, (age - u.d) / 0.5));
        m.scale.setScalar(Math.max(0.01, u.s * (0.15 + 0.85 * lk) * (1 + Math.max(0, age - 0.5) * 0.12)));
        m.position.x += u.vx * dt * (1 - lk * 0.6); m.position.y += u.vy * dt * (1 - lk * 0.5); m.position.z += u.vz * dt * (1 - lk * 0.6);
        m.material.rotation += u.spin * dt;
        m.material.opacity = Math.min(1, lk * 2.5) * Math.max(0, 1 - Math.max(0, (age - seconds * 0.55) / (seconds * 0.4)));
        if (age > seconds * 0.55) m.material.color.lerpColors(u.c0, dark, Math.min(1, (age - seconds * 0.55) / (seconds * 0.4))); });
      rzxPartTick(parts, dt); } };
 } catch (e) { rzxLogErr(e); return null; } }
function rzxSplat(p, r, tex, seconds) { try { const G = rzxGeos(), gy = rzxGround(p.x, p.z, p.y);
  const m = new THREE.Mesh(G.disc, new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.95, depthWrite: false, fog: false, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -2 }));
  m.rotation.x = -Math.PI / 2; m.rotation.z = Math.random() * 6.3; m.position.set(p.x, gy + 0.06, p.z); m.scale.setScalar(0.2);
  return { mesh: m, gy, tick: (dt, age) => { const gk = Math.min(1, age / 0.14); m.scale.setScalar(Math.max(0.01, r * (0.2 + 0.8 * gk)));
      m.material.opacity = 0.95 * Math.max(0, 1 - Math.max(0, (age - seconds * 0.55) / (seconds * 0.45))); } };
 } catch (e) { rzxLogErr(e); return null; } }
function rzxSparks(p, n, c, spd, g, ttl) { const parts = []; try { p = rzxP(p); for (let i = 0; i < n; i++) { const m = rzxSprite(c, 0.9); m.scale.setScalar(0.10 + Math.random() * 0.08); m.position.set(p.x, p.y + 0.15, p.z); scene.add(m);
    const a = Math.random() * 6.3, up = Math.random() * 0.9 + 0.25, v = spd * (0.5 + Math.random() * 0.8);
    parts.push({ m, age: 0, ttl: ttl * (0.6 + Math.random() * 0.7), vx: Math.cos(a) * v, vy: up * v * 0.8, vz: Math.sin(a) * v, g, o0: 0.9 }); } } catch (e) { rzxLogErr(e); } return parts; }

// ---- Boom Bot ----
// reference: deploy = purple-pink puff; dark rounded body with a glowing yellow-orange face, rolls on the
// ground; windup small purple flash; explosion = orange-yellow core into a LARGE magenta-pink lobed
// fireball with dark smoke, then pink smoke + purple embers.
function rzxBoomBot() { try { const G = rzxGeos(), grp = new THREE.Group();
  const under = new THREE.Mesh(G.box, new THREE.MeshBasicMaterial({ color: 0x181b22, fog: true })); under.scale.set(0.40, 0.22, 0.48); under.position.y = 0.20;
  const shell = new THREE.Mesh(G.sph, new THREE.MeshBasicMaterial({ color: 0xb86428, fog: true })); shell.scale.set(0.46, 0.30, 0.52); shell.position.y = 0.34;
  const trim = new THREE.Mesh(G.torus, rzxBasic(0x2fd8c8, 0.9, false)); trim.rotation.x = Math.PI / 2; trim.scale.setScalar(0.40); trim.position.y = 0.30;
  const pods = []; for (let sx = -1; sx <= 1; sx += 2) { const pod = new THREE.Mesh(G.sph, new THREE.MeshBasicMaterial({ color: 0x9a5220, fog: true })); pod.scale.set(0.14, 0.16, 0.30); pod.position.set(sx * 0.24, 0.22, 0); grp.add(pod); pods.push(pod); }
  const wheels = []; for (let sx = -1; sx <= 1; sx += 2) { const piv = new THREE.Group(); piv.position.set(sx * 0.20, 0.13, 0); piv.rotation.y = Math.PI / 2;
    const tire = new THREE.Mesh(G.torus, new THREE.MeshBasicMaterial({ color: 0x10131a, fog: true })); tire.scale.setScalar(0.13); piv.add(tire);
    const hub = new THREE.Mesh(G.disc, rzxBasic(0x3a4a4a, 1, false)); hub.scale.setScalar(0.07); piv.add(hub); grp.add(piv); wheels.push(tire); }
  const facePlate = new THREE.Mesh(G.box, new THREE.MeshBasicMaterial({ color: 0xffc03a, fog: false, toneMapped: false })); facePlate.scale.set(0.28, 0.20, 0.03); facePlate.position.set(0, 0.40, 0.47); facePlate.rotation.x = -0.15;
  const faceGlow = rzxSprite(0xff9820, 0.5); faceGlow.scale.set(0.55, 0.45, 1); faceGlow.position.set(0, 0.42, 0.52);
  const eye1 = new THREE.Mesh(G.box, new THREE.MeshBasicMaterial({ color: 0x14161e, fog: false })); eye1.scale.set(0.055, 0.075, 0.02); eye1.position.set(-0.075, 0.42, 0.49); eye1.rotation.z = 0.45;
  const eye2 = eye1.clone(); eye2.position.x = 0.075; eye2.rotation.z = -0.45;
  const ant = new THREE.Mesh(G.cone, rzxBasic(0x2fd8c8, 0.9, false)); ant.scale.set(0.05, 0.18, 0.05); ant.position.set(0.14, 0.66, -0.10);
  grp.add(under, shell, trim, facePlate, faceGlow, eye1, eye2, ant);
  const h = rzxFx(1e9, [grp], (dt, age) => { const fx = h.fx, left = fx.ttl - fx.age, dying = fx.ttl < 1e8 && left <= fx.die + 0.001;
    shell.rotation.z = Math.sin(age * 9) * 0.05; faceGlow.material.opacity = 0.35 + 0.15 * Math.sin(age * 7); grp.position.y = Math.abs(Math.sin(age * 8)) * 0.03;
    wheels.forEach((w) => { w.rotation.z -= dt * 7; });
    if (dying) grp.scale.setScalar(Math.max(0.01, left / fx.die)); }, { die: 0.25 });
  return h;
 } catch (e) { rzxLogErr(e); return null; } }
function rzxBbDeploy(p) { try { p = rzxP(p); const gy = rzxGround(p.x, p.z, p.y), parts = [];
  for (let i = 0; i < 8; i++) { const m = rzxSprite(i % 2 ? 0xd84af0 : 0xff5ad0, 0.55, rzxSmokeTex(), false); const a = Math.random() * 6.3; m.position.set(p.x + Math.cos(a) * 0.2, gy + 0.25, p.z + Math.sin(a) * 0.2); m.scale.setScalar(0.3); scene.add(m);
    parts.push({ m, age: 0, ttl: 0.4 + Math.random() * 0.2, vx: Math.cos(a) * 1.6, vy: 1.2 + Math.random(), vz: Math.sin(a) * 1.6, grow: 2.0, o0: 0.55 }); }
  return rzxFx(0.6, [], (dt) => rzxPartTick(parts, dt), { parts }); } catch (e) { rzxLogErr(e); return null; } }
function rzxBbLock(p) { try { p = rzxP(p); const G = rzxGeos();
  const flash = rzxSprite(0xc04af0, 0.9); flash.position.set(p.x, p.y + 0.3, p.z); flash.scale.setScalar(0.2);
  const ring = new THREE.Mesh(G.ring, rzxBasic(0xd84af0, 0.8, true)); ring.rotation.x = -Math.PI / 2; ring.position.set(p.x, rzxGround(p.x, p.z, p.y) + 0.06, p.z); ring.scale.setScalar(0.15);
  return rzxFx(0.35, [flash, ring], (dt, age, k) => { flash.material.opacity = 0.9 * (1 - k); flash.scale.setScalar(0.2 + k * 0.5);
    ring.material.opacity = 0.8 * (1 - k); ring.scale.setScalar(0.15 + k * 1.3); }); } catch (e) { rzxLogErr(e); return null; } }
function rzxBoomBotBlast(p, r) { try { p = rzxP(p); const R = (r || 4) * 0.55, ttl = 1.8, gy = rzxGround(p.x, p.z, p.y), fb = rzxFireball({ x: p.x, y: gy, z: p.z }, R, 0xff7a1a, 0xc22a7a, 0x3a3038, ttl);
  if (!fb) return null; const embers = rzxSparks({ x: p.x, y: fb.grp.position.y + R * 0.4, z: p.z }, 12, 0xc04af0, 5, 9, 1.1);
  const streaks = rzxStreaks({ x: p.x, y: gy, z: p.z }, 7, 0x2a0838, R, R * 1.25, 0.6, false);
  streaks.forEach((s) => { s.m.renderOrder = 5; s.m.scale.x = R * 0.38; });
  const scorch = rzxSplat(p, R * 0.8, rzxSplatTex("bbScorch", "rgba(150,60,200,0.9)", "rgba(90,30,140,0.8)", "rgba(60,15,100,0)"), ttl * 1.4);
  const parts = fb.parts.concat(embers, streaks);
  return rzxFx(ttl, [fb.grp, scorch.mesh], (dt, age) => { fb.tick(dt, age); rzxPartTick(parts, dt); scorch.tick(dt, age); }, { parts }); } catch (e) { rzxLogErr(e); return null; } }

// ---- Blast Pack ----
// reference: small dark satchel with teal-green glowing accents + red armed blink, sticks where it lands;
// detonation = red-orange flash into an orange lobed fireball with a yellow-white core, red-pink
// fragments + teal shards; aftermath = teal-green splat/scorch lingering on the ground.
function rzxBlastPack(p) { try { const G = rzxGeos(), grp = new THREE.Group();
  const pack = new THREE.Mesh(G.box, new THREE.MeshBasicMaterial({ color: 0x1e2026, fog: true })); pack.scale.set(0.36, 0.15, 0.27); pack.position.y = 0.08;
  const strap = new THREE.Mesh(G.box, rzxBasic(0x111216, 1, false)); strap.scale.set(0.38, 0.04, 0.07); strap.position.y = 0.16;
  const glowL = new THREE.Mesh(G.box, rzxBasic(0x2fe8b0, 0.95, true)); glowL.scale.set(0.06, 0.04, 0.22); glowL.position.set(0.14, 0.15, 0);
  const glowR = glowL.clone(); glowR.material = glowR.material.clone(); glowR.position.x = -0.14;
  const halo = rzxSprite(0x2fe8b0, 0.45); halo.scale.setScalar(0.30); halo.position.y = 0.18;
  const blink = rzxSprite(0xff4a3a, 0.9); blink.scale.setScalar(0.08); blink.position.set(0, 0.20, 0.10);
  grp.add(pack, strap, glowL, glowR, halo, blink);
  if (p) { p = rzxP(p); grp.position.set(p.x, p.y, p.z); }
  const h = rzxFx(1e9, [grp], (dt, age) => { const fx = h.fx, left = fx.ttl - fx.age, dying = fx.ttl < 1e8 && left <= fx.die + 0.001;
    const on = Math.sin(age * 9) > 0.2; blink.material.opacity = on ? 0.95 : 0.15; halo.material.opacity = 0.30 + 0.25 * Math.abs(Math.sin(age * 3));
    if (dying) grp.scale.setScalar(Math.max(0.01, left / fx.die)); }, { die: 0.2 });
  return h;
 } catch (e) { rzxLogErr(e); return null; } }
function rzxPackBlast(p, r) { try { p = rzxP(p); const R = (r || 3.5) * 1.0, gy = rzxGround(p.x, p.z, p.y), ttl = 2.2;
  const fb = rzxFireball({ x: p.x, y: gy, z: p.z }, R, 0xffd23a, 0xff5a1a, 0x3a2e28, ttl * 0.6); if (!fb) return null;
  const flash = rzxSprite(0xff4a20, 0.95); flash.scale.setScalar(R * 2.2); flash.position.set(p.x, gy + R * 0.3, p.z); scene.add(flash);
  const frags = rzxSparks({ x: p.x, y: gy + 0.3, z: p.z }, 8, 0xff4a6a, 7, 10, 0.7);
  const shards = rzxSparks({ x: p.x, y: gy + 0.3, z: p.z }, 9, 0x2fe8b0, 6.5, 10, 0.8);
  const spray = []; for (let i = 0; i < 14; i++) { const m = rzxSprite(i % 3 === 0 ? 0xff7a2a : 0xff2a3a, 0.6, rzxWedgeTex()); const a = (i / 14) * 6.3 + Math.random() * 0.3;
    m.position.set(p.x + Math.cos(a) * R * 0.35, gy + R * (0.15 + Math.random() * 0.45), p.z + Math.sin(a) * R * 0.35);
    m.scale.set(R * 0.5, R * (1.0 + Math.random() * 0.4), 1); m.material.rotation = a; scene.add(m); spray.push(m); }
  const splat = rzxSplat(p, R * 1.0, rzxSplatTex("packSplat", "rgba(64,240,190,0.95)", "rgba(30,180,140,0.8)", "rgba(20,120,95,0)"), 2.0);
  spray.forEach((m) => { const a = m.material.rotation; frags.push({ m, age: 0, ttl: 0.42, vx: Math.cos(a) * 2.8, vy: 1.0, vz: Math.sin(a) * 2.8, o0: 0.6 }); });
  const yellow = rzxSparks({ x: p.x, y: gy + 0.3, z: p.z }, 6, 0xffd23a, 8, 9, 0.6);
  frags.push.apply(frags, yellow);
  const spikes = []; { const G = rzxGeos(); for (let i = 0; i < 8; i++) { const sm = new THREE.Mesh(G.cone, new THREE.MeshBasicMaterial({ color: i % 2 ? 0x2fe8b0 : 0x17b184, transparent: true, opacity: 0.95, fog: true }));
    const sa = Math.random() * 6.3, sd = R * (0.10 + Math.random() * 0.45);
    sm.position.set(p.x + Math.cos(sa) * sd, gy, p.z + Math.sin(sa) * sd);
    sm.rotation.set((Math.random() - 0.5) * 0.5, Math.random() * 6.3, (Math.random() - 0.5) * 0.5);
    sm.userData.h = R * (0.45 + Math.random() * 0.55); sm.scale.set(1.4 + Math.random(), 0.01, 1.4 + Math.random()); scene.add(sm); spikes.push(sm); } }
  const parts = fb.parts.concat(frags, shards); parts.push({ m: flash, age: 0, ttl: 0.16, vy: 0, grow: 1.8, o0: 0.95 });
  return rzxFx(ttl, [fb.grp, splat.mesh].concat(spikes), (dt, age) => { fb.tick(dt, age); splat.tick(dt, age); rzxPartTick(parts, dt);
    spikes.forEach((sm) => { const k = Math.min(1, age / 0.14), fk = Math.max(0, 1 - Math.max(0, (age - 1.1) / 0.9));
      sm.scale.y = Math.max(0.01, sm.userData.h * k); sm.position.y = gy + sm.scale.y * 0.5; sm.material.opacity = 0.95 * fk; }); }, { parts });
 } catch (e) { rzxLogErr(e); return null; } }

// ---- Paint Shells ----
// reference: flight = orange fireball with a wavy orange flame trail; main burst = magenta-red lobed
// fireball with a yellow-white core + teal-green sparks; the ground keeps a wide ragged ORANGE radial
// splat with small flames, scorching for seconds; sub-munitions are the same burst smaller.
function rzxTrail(grp, scale, c1, c2, wavy) { try { const parts = [], S = scale || 1, st = { nx: 0 };
  const h = rzxFx(1e9, [], (dt, age) => { const fx = h.fx, emitting = fx.ttl > 1e8 || fx.ttl - fx.age > fx.die + 0.001;
    if (emitting && age >= st.nx) { st.nx = age + 0.016;
      const m = rzxSprite(Math.random() < 0.5 ? c1 : c2, 0.9); m.position.copy(grp.position); m.scale.setScalar(0.34 * S); scene.add(m);
      parts.push({ m, age: 0, ttl: 0.5, vy: 0.4, grow: 1.4, o0: 0.9, wv: Math.random() * 6.3, wavy }); }
    for (let i = parts.length - 1; i >= 0; i--) { const pt = parts[i]; pt.age += dt; const pk = pt.age / pt.ttl;
      if (pk >= 1) { scene.remove(pt.m); pt.m.material.dispose(); parts.splice(i, 1); continue; }
      if (wavy) { pt.m.position.x += Math.sin(pt.age * 18 + pt.wv) * dt * 1.4; pt.m.position.z += Math.cos(pt.age * 15 + pt.wv) * dt * 1.4; }
      pt.m.position.y += pt.vy * dt; pt.m.material.opacity = 0.9 * (1 - pk); pt.m.scale.setScalar(0.34 * S * (1 + pk * pt.grow)); } }, { parts, die: 0.45 });
  return h; } catch (e) { rzxLogErr(e); return null; } }
function rzxPaintTrail(grp) { return rzxTrail(grp, 0.8, 0xff8a1a, 0xffc03a, true); }
function rzxRocketTrail(grp) { return rzxTrail(grp, 1.5, 0xff6a10, 0xff3814, true); }
function rzxPaintBlast(p, sub) { try { p = rzxP(p); const S = sub ? 0.55 : 1, R = 3.0 * S, ttl = sub ? 1.8 : 3.2, gy = rzxGround(p.x, p.z, p.y);
  const fb = rzxFireball({ x: p.x, y: gy, z: p.z }, R, 0xffd23a, 0xd03810, 0x40343a, ttl * 0.6); if (!fb) return null;
  const sparks = rzxSparks({ x: p.x, y: gy + 0.3, z: p.z }, Math.round(10 * S) || 4, 0x2fe8b0, 7 * S, 10, 0.9);
  const streaks = rzxStreaks({ x: p.x, y: gy, z: p.z }, sub ? 5 : 8, 0xffe23a, R, R * 2.2, 0.38, true);
  const splat = rzxSplat(p, 2.6 * S, rzxSplatTex("paintSplat", "rgba(255,150,30,0.98)", "rgba(255,110,10,0.85)", "rgba(200,70,0,0)"), ttl);
  const flickers = []; for (let i = 0; i < (sub ? 2 : 5); i++) { const m = rzxSprite(0xffa02a, 0.8); const a = Math.random() * 6.3, d = Math.random() * 2.4 * S; m.position.set(p.x + Math.cos(a) * d, gy + 0.15, p.z + Math.sin(a) * d); m.scale.setScalar(0.2); scene.add(m); flickers.push({ m, ph: Math.random() * 6.3 }); }
  const parts = fb.parts.concat(sparks, streaks), objs = [fb.grp, splat.mesh].concat(flickers.map((f) => f.m));
  return rzxFx(ttl, objs, (dt, age) => { fb.tick(dt, age); rzxPartTick(parts, dt); splat.tick(dt, age);
    flickers.forEach((f) => { const fk = Math.max(0, 1 - age / (ttl * 0.7)); f.m.material.opacity = 0.8 * fk * (0.5 + 0.5 * Math.sin(rzxU.value * 22 + f.ph)); f.m.scale.setScalar(0.2 * (0.7 + 0.5 * Math.sin(rzxU.value * 17 + f.ph))); }); }, { parts });
 } catch (e) { rzxLogErr(e); return null; } }

// ---- Showstopper ----
// reference: muzzle = big yellow-white star flash; rocket = bright orange projectile with a wavy
// orange-red trail; impact = huge fireball (yellow-white core, red-orange lobes, slight blue-white
// center flash) + lingering PINK-magenta smoke and a wide PINK splat.
function rzxShowMuzzle(p, d) { try { p = rzxP(p); const G = rzxGeos();
  const star = rzxSprite(0xfff6d8, 1, rzxStarTex()); star.position.set(p.x, p.y, p.z); star.scale.setScalar(0.4);
  const glow = rzxSprite(0xffc03a, 0.7); glow.position.set(p.x, p.y, p.z); glow.scale.setScalar(0.3);
  return rzxFx(0.3, [star, glow], (dt, age, k) => { star.material.opacity = 1 - k; star.scale.setScalar(0.4 + k * 1.8); star.material.rotation = k * 0.6;
    glow.material.opacity = 0.7 * (1 - k); glow.scale.setScalar(0.3 + k * 2.6); }); } catch (e) { rzxLogErr(e); return null; } }
function rzxShowBlast(p, r) { try { p = rzxP(p); const R = (r || 6) * 0.75, ttl = 3.5, gy = rzxGround(p.x, p.z, p.y);
  const fb = rzxFireball({ x: p.x, y: gy, z: p.z }, R, 0xffd84a, 0xff5a1a, 0x4a3844, ttl * 0.55, rzxShardTex(1)); if (!fb) return null;
  const dark = []; for (let i = 0; i < 4; i++) { const m = rzxSprite(0x5a2438, 0.6, rzxShardTex(i % 3), false); const a = (i / 4) * 6.3 + Math.random() * 0.5;
    m.position.set(p.x + Math.cos(a) * R * 0.35, gy + R * (0.25 + Math.random() * 0.45), p.z + Math.sin(a) * R * 0.35);
    m.scale.setScalar(R * (0.26 + Math.random() * 0.16)); m.material.rotation = Math.random() * 6.3; scene.add(m);
    dark.push({ m, age: 0, ttl: 1.1 + Math.random() * 0.5, vx: Math.cos(a) * 1.6, vy: 1.2 + Math.random(), vz: Math.sin(a) * 1.6, spin: (Math.random() - 0.5) * 3, grow: 1.4, o0: 0.6 }); }
  const shardCols = [0xffd23a, 0xff3a5a, 0x3ae8e8, 0x3ae8e8];
  const ribbons0 = [];
  const shardsA = []; for (let i = 0; i < 14; i++) { const m = rzxSprite(shardCols[i % 4], 1, rzxShardTex(i % 3)); const a = Math.random() * 6.3;
    m.position.set(p.x, gy + R * 0.3, p.z); m.scale.setScalar(R * (0.20 + Math.random() * 0.16)); m.material.rotation = Math.random() * 6.3; scene.add(m);
    shardsA.push({ m, age: 0, ttl: 0.5 + Math.random() * 0.25, vx: Math.cos(a) * (7 + Math.random() * 5), vy: 2.5 + Math.random() * 3.5, vz: Math.sin(a) * (7 + Math.random() * 5), spin: (Math.random() - 0.5) * 12, o0: 0.95 }); }
  const col = rzxSprite(0xff8a1a, 0.55, rzxWedgeTex()); col.position.set(p.x, gy + R * 0.75, p.z); col.scale.set(R * 0.55, R * 1.7, 1); scene.add(col);
  ribbons0.push({ m: col, age: 0, ttl: 0.5, vy: 1.5, grow: 0, o0: 0.55 });
  const ribbons = []; for (let i = 0; i < 8; i++) { const cy = i % 2 === 0; const m = rzxSprite(cy ? 0x3ae8e8 : (i % 2 ? 0xe83a90 : 0xff5aa8), 0.9, rzxWedgeTex(), cy ? true : false); const a = (i / 8) * 6.3 + Math.random() * 0.5;
    m.position.set(p.x + Math.cos(a) * R * 0.3, gy + R * (0.2 + Math.random() * 0.3), p.z + Math.sin(a) * R * 0.3);
    m.scale.set(R * (0.14 + Math.random() * 0.05), R * (0.45 + Math.random() * 0.3), 1); scene.add(m);
    const vx = Math.cos(a) * (6 + Math.random() * 4), vy = 2 + Math.random() * 2.5, vz = Math.sin(a) * (6 + Math.random() * 4);
    m.material.rotation = Math.atan2(vx, vy) * -1;
    ribbons.push({ m, age: 0, ttl: 0.45 + Math.random() * 0.15, vx, vy, vz, g: 7, spin: (Math.random() - 0.5) * 4, o0: 0.9 }); }
  const center = rzxSprite(0xbfe0ff, 0.9); center.position.set(p.x, gy + R * 0.2, p.z); center.scale.setScalar(R * 0.5); scene.add(center);
  const pinkSmoke = []; for (let i = 0; i < 12; i++) { const m = rzxSprite(0xe86aa8, 0.55, rzxSmokeTex(), false); m.position.set(p.x + (Math.random()-0.5) * R * 1.4, gy + R * (0.3 + Math.random() * 0.5), p.z + (Math.random()-0.5) * R * 1.4); m.scale.setScalar(R * 0.55); scene.add(m);
    pinkSmoke.push({ m, age: 0, ttl: ttl * (0.6 + Math.random() * 0.35), vy: 0.9 + Math.random() * 0.6, grow: 2.4, o0: 0.55, spin: (Math.random()-0.5) }); }
  const splat = rzxSplat(p, R * 1.15, rzxSplatTex("showSplat", "rgba(255,120,55,0.95)", "rgba(230,60,140,0.85)", "rgba(160,20,90,0)"), ttl * 1.4);
  const parts = fb.parts.concat(pinkSmoke, shardsA, dark, ribbons, ribbons0); parts.push({ m: center, age: 0, ttl: 0.25, vy: 0, grow: 1.5, o0: 0.9 });
  return rzxFx(ttl, [fb.grp, splat.mesh], (dt, age) => { fb.tick(dt, age); splat.tick(dt, age); rzxPartTick(parts, dt); }, { parts });
 } catch (e) { rzxLogErr(e); return null; } }
// drop all cached shared GPU resources (textures, geometries); next use recreates them lazily.
// integrator: call on full reconnect/reset cycles so retained memory stays bounded.
function rzxDisposeShared() { for (const k in rzxTex) { try { rzxTex[k].dispose(); } catch (e) {} delete rzxTex[k]; }
  if (rzxGeo) { for (const k in rzxGeo) { try { rzxGeo[k].dispose(); } catch (e) {} } rzxGeo = null; } }
// ---- END RAZE FX ----
