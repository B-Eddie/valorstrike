// ---- CLOVE FX ----
// Clove ability visuals (work/clove_fx_runtime.js), reference-grounded in the wiki showcase clips
// viewed 2026-11-04 (wiki.playvalorant.com/en-us/Pick-me-up, /Meddle, /Ruse, /Not_Dead_Yet;
// images/Pick-me-up_Showcase.mp4, Meddle_Showcase.mp4, Ruse_Showcase.mp4, Not_Dead_Yet_Showcase.mp4
// frame sheets). Procedural approximation, no extracted game assets.
// Reference look: immortal-purple energy - magenta/violet with pale lavender highlights.
//   Pick-me-up: tall purple-pink light pillars at the screen edges and a pink glow on the hands,
//     brief surge, no world object.
//   Meddle: a spiky dark-purple orb with wing-like shards and an orbit ring; on break a purple
//     splash with flying fragments that decay over ~4.5 s (decay timing is the caller's zone).
//   Ruse: pale lavender-white smoke sphere with horizontal wavy purple bands.
//   Not Dead Yet: pale white ethereal wisps rising around the body, purple butterflies, soft vignette.
// Mechanics (heal/haste, decay, vision blocking, revive) stay in the caller; this file is pure client fx.
// Globals used (read-only): THREE, scene, player, xE, and (only in cvxRuseAt) a18Smoke.
// All animation runs on game dt: call cvxUseGameTick() once, then cvxTick(dt) from the game loop
// (the same place omxTick is called in jFxTick). Without it a rAF pump runs while effects exist.
// Returns handles accepted by cvxEnd; cvxReset() ends everything (round reset / disconnect).
//
// Integration wiring (integrator owns index.html):
//   1. Pick-me-up (a18Key case "Clove" k "c"): add cvxPickMeUp() at cast (self-only, no fx row is emitted;
//      online clients see nothing - matches the reference, the buff icon carries it).
//   2. Meddle (k "q"): attach cvxMeddleOrb() to the projectile (handle.setPos(p) per frame, .end() on
//      break), then cvxMeddleBurst(p, A18C.meddle.r) at the break point. The decay zone mechanics stay
//      with the caller's J.zones record. ONLINE: Meddle and Harbor's Storm Surge both serialize as kind
//      "blast" - resolve the row owner's agent via e.o before choosing cvxMeddleBurst vs hbxSurge.
//   3. Ruse (k "e"): replace the a18Smoke call with cvxRuseAt(p, C.ruse.life, C.ruse.r) - it keeps the
//      J.smokes record (vision blocking) with the engine mesh hidden and adds this visual.
//   4. Not Dead Yet (k "x"): add cvxNotDeadYet(p, A18C.ndy.channel + 2) at cast position; no fx row is
//      emitted today, so online clients need a new row (integrator/server lane) or stay self-only.
//   5. Online (a18NetSync): smoke rows have no ag - resolve the owner's agent from e.o first, then swap
//      A18VIS for Ruse owners to cvxRuse (keep the J.smokes record hidden-mesh pattern from netSyncSmokes).
var cvxU = { value: 0 }, cvxLive = [], cvxPumpOn = false, cvxGT = null, cvxGeo = null, cvxProg = {}, cvxTex = {};
function cvxNow() { try { return performance.now() / 1000; } catch (e) { return Date.now() / 1000; } }
function cvxGeos() { if (cvxGeo) return cvxGeo; cvxGeo = {
  sph: new THREE.SphereGeometry(1, 28, 20),
  sphL: new THREE.SphereGeometry(1, 14, 10),
  ring: new THREE.RingGeometry(0.8, 1, 48),
  torus: new THREE.TorusGeometry(1, 0.05, 8, 48),
  cone: new THREE.ConeGeometry(0.5, 1, 5),
  plane: new THREE.PlaneGeometry(1, 1) }; return cvxGeo; }
function cvxStarTex() { if (cvxTex.star) return cvxTex.star; // angular 4-point sparkle silhouette, soft glow inside
  const c = document.createElement("canvas"); c.width = c.height = 128; const g = c.getContext("2d"); g.clearRect(0, 0, 128, 128);
  const gr = g.createRadialGradient(64, 64, 2, 64, 64, 62); gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(0.3, "rgba(215,232,255,0.6)"); gr.addColorStop(1, "rgba(150,190,255,0)");
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  g.globalCompositeOperation = "destination-in"; g.beginPath(); g.moveTo(64, 0);
  g.quadraticCurveTo(70, 58, 128, 64); g.quadraticCurveTo(70, 70, 64, 128); g.quadraticCurveTo(58, 70, 0, 64); g.quadraticCurveTo(58, 58, 64, 0);
  g.closePath(); g.fill();
  cvxTex.star = new THREE.CanvasTexture(c); if (THREE.SRGBColorSpace) cvxTex.star.colorSpace = THREE.SRGBColorSpace; return cvxTex.star; }
function cvxWingTex() { if (cvxTex.wing) return cvxTex.wing; // jagged purple wing shard
  const c = document.createElement("canvas"); c.width = 128; c.height = 64; const g = c.getContext("2d"); g.clearRect(0, 0, 128, 64);
  g.fillStyle = "rgba(190,120,255,0.95)"; g.beginPath(); g.moveTo(0, 32);
  g.lineTo(30, 8); g.lineTo(52, 22); g.lineTo(76, 4); g.lineTo(96, 20); g.lineTo(124, 10); g.lineTo(110, 32); g.lineTo(124, 54); g.lineTo(92, 44); g.lineTo(70, 60); g.lineTo(48, 44); g.lineTo(24, 56); g.closePath(); g.fill();
  g.fillStyle = "rgba(255,200,255,0.5)"; g.beginPath(); g.moveTo(10, 32); g.lineTo(60, 20); g.lineTo(110, 30); g.lineTo(60, 42); g.closePath(); g.fill();
  cvxTex.wing = new THREE.CanvasTexture(c); if (THREE.SRGBColorSpace) cvxTex.wing.colorSpace = THREE.SRGBColorSpace; return cvxTex.wing; }
function cvxButterflyTex() { if (cvxTex.fly) return cvxTex.fly; // small purple butterfly silhouette
  const c = document.createElement("canvas"); c.width = c.height = 64; const g = c.getContext("2d"); g.clearRect(0, 0, 64, 64);
  g.fillStyle = "rgba(210,150,255,0.95)";
  g.beginPath(); g.ellipse(20, 24, 13, 17, -0.5, 0, 6.2832); g.fill();
  g.beginPath(); g.ellipse(44, 24, 13, 17, 0.5, 0, 6.2832); g.fill();
  g.beginPath(); g.ellipse(22, 44, 8, 10, 0.4, 0, 6.2832); g.fill();
  g.beginPath(); g.ellipse(42, 44, 8, 10, -0.4, 0, 6.2832); g.fill();
  cvxTex.fly = new THREE.CanvasTexture(c); if (THREE.SRGBColorSpace) cvxTex.fly.colorSpace = THREE.SRGBColorSpace; return cvxTex.fly; }
function cvxPuffTex() { if (cvxTex.puff) return cvxTex.puff; const c = document.createElement("canvas"); c.width = c.height = 64; const g = c.getContext("2d");
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(0.4, "rgba(255,255,255,0.5)"); gr.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64); cvxTex.puff = new THREE.CanvasTexture(c); return cvxTex.puff; }
function cvxShader(k, frag) { if (cvxProg[k]) return cvxProg[k]; const m = new THREE.ShaderMaterial({
  uniforms: { uT: { value: 0 }, uP: { value: 0 }, uSeed: { value: 0 }, uA: { value: 1 } },
  vertexShader: "uniform float uT;uniform float uP;uniform float uSeed;varying vec3 vN;varying vec3 vV;varying vec3 vP;varying vec2 vUv;void main(){vUv=uv;vec3 p=position;vP=p;vec4 mv=modelViewMatrix*vec4(p,1.0);vV=-mv.xyz;vN=normalMatrix*normal;gl_Position=projectionMatrix*mv;}",
  fragmentShader: frag, transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false });
  m.userData.cvx = k; cvxProg[k] = m; return m; }
// Meddle orb: dark core with crawling violet energy and bright rim
const cvxORB = "uniform float uT;uniform float uP;uniform float uSeed;varying vec3 vN;varying vec3 vV;varying vec3 vP;\nfloat ch(vec3 p){p=fract(p*.3183099+vec3(.11,.23,.37));p*=17.0;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}\nfloat cn(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(mix(ch(i),ch(i+vec3(1,0,0)),f.x),mix(ch(i+vec3(0,1,0)),ch(i+vec3(1,1,0)),f.x),f.y),mix(mix(ch(i+vec3(0,0,1)),ch(i+vec3(1,0,1)),f.x),mix(ch(i+vec3(0,1,1)),ch(i+vec3(1,1,1)),f.x),f.y),f.z);}\nvoid main(){float f=pow(1.0-abs(dot(normalize(vN),normalize(vV))),1.4);vec3 q=vP*3.2+vec3(0.0,-uT*.5,0.0)+uSeed;float n=cn(q)*.65+cn(q*2.6)*.35;vec3 c=mix(vec3(.16,.05,.26),vec3(.45,.16,.72),smoothstep(.3,.8,n));c+=vec3(.85,.5,1.0)*smoothstep(.72,.95,n)*.9;c=mix(c,vec3(.92,.62,1.0),f*.85);gl_FragColor=vec4(c,.96*(1.0-uP));}";
// Ruse smoke: pale lavender-white body, wavy horizontal purple bands
const cvxRUSE = "uniform float uT;uniform float uP;uniform float uSeed;varying vec3 vN;varying vec3 vV;varying vec3 vP;\nvoid main(){float facing=abs(dot(normalize(vN),normalize(vV)));float rim=pow(1.0-facing,1.6);float wave=sin(vP.y*6.0+sin(vP.x*2.5+uT*.5)*1.2+sin(vP.z*2.2-uT*.4)*1.2+uSeed);float band=smoothstep(.28,.72,wave);vec3 c=mix(vec3(.93,.90,.97),vec3(.66,.47,.92),band);c=mix(c,vec3(.99,.97,1.0),rim*.75);float al=(.96)*(1.0-uP);gl_FragColor=vec4(c,al);}";
// Pick-me-up pillar (uv.y up): violet-pink light column, brighter core, fade top
const cvxPILLAR = "uniform float uT;uniform float uP;uniform float uSeed;varying vec2 vUv;\nvoid main(){float x=abs(vUv.x*2.0-1.0);float core=pow(1.0-x,2.4);float streak=.7+.3*sin(vUv.x*40.0+uSeed+uT*3.0);vec3 c=mix(vec3(.80,.30,1.0),vec3(1.0,.55,.95),vUv.y*.5+core*.4);c=mix(c,vec3(1.0,.9,1.0),core*.5);float a=core*streak*(1.0-smoothstep(.75,1.0,vUv.y))*smoothstep(0.0,.04,vUv.y)*(1.0-uP);gl_FragColor=vec4(c,a*.9);}";
function cvxMat(k, shader, seed) { const m = cvxShader(k, shader).clone(); delete m.userData.cvx; m.uniforms.uT = cvxU; if (seed !== undefined) m.uniforms.uSeed.value = seed; return m; } // clone is disposable; cached program keeps userData.cvx
function cvxBasic(c, o, add) { return new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: o, depthWrite: false, blending: add ? THREE.AdditiveBlending : THREE.NormalBlending, side: THREE.DoubleSide, fog: false, toneMapped: false }); }
function cvxPush(fx) { if (cvxLive.length > 24) { const o = cvxLive.shift(); try { o.done(); } catch (e) {} } cvxLive.push(fx); if (!cvxGT && !cvxPumpOn) { cvxPumpOn = true; cvxPump.last = cvxNow(); requestAnimationFrame(cvxPump); } return fx; }
function cvxPump() { if (cvxGT) { cvxPumpOn = false; return; } const now = cvxNow(), dt = Math.min(0.1, Math.max(0.0005, now - (cvxPump.last || now))); cvxPump.last = now; cvxU.value += dt;
  for (let i = cvxLive.length - 1; i >= 0; i--) { const fx = cvxLive[i]; fx.age += dt; try { fx.tick(dt, fx.age, Math.min(1, fx.age / fx.ttl)); } catch (e) { try { xE(e); } catch (e2) {} }
    if (fx.age >= fx.ttl) { try { fx.done(); } catch (e) {} cvxLive.splice(i, 1); } }
  if (cvxLive.length) requestAnimationFrame(cvxPump); else cvxPumpOn = false; }
function cvxUseGameTick() { cvxGT = true; cvxPumpOn = false; } // integrator then calls cvxTick(dt) per frame
function cvxTick(dt) { cvxU.value += dt; for (let i = cvxLive.length - 1; i >= 0; i--) { const fx = cvxLive[i]; fx.age += dt; try { fx.tick(dt, fx.age, Math.min(1, fx.age / fx.ttl)); } catch (e) { try { xE(e); } catch (e2) {} } if (fx.age >= fx.ttl) { try { fx.done(); } catch (e) {} cvxLive.splice(i, 1); } } }
function cvxEnd(h) { if (!h || !h.fx) return; const i = cvxLive.indexOf(h.fx); if (i >= 0) cvxLive.splice(i, 1); try { h.fx.done(); } catch (e) {} }
function cvxFx(ttl, objs, tick, done) { const fx = { age: 0, ttl, objs, tick, done: done || function () { objs.forEach((o) => { try { scene.remove(o); o.traverse((m) => { if (m.material && m.material.dispose && !m.material.userData.cvx) m.material.dispose(); if (m.userData.og && m.geometry && m.geometry.dispose) m.geometry.dispose(); }); } catch (e) {} }); } }; objs.forEach((o) => { o.traverse ? o.traverse((m) => { m.raycast = () => {}; }) : 0; scene.add(o); }); cvxPush(fx); return { fx, end: function () { cvxEnd(this); } }; }
function cvxReset() { while (cvxLive.length) cvxEnd({ fx: cvxLive[0] }); const d = document.getElementById("cvxVeil"); if (d) d.remove(); const d2 = document.getElementById("cvxPmu"); if (d2) d2.remove(); }
function cvxSprite(tex, col, op, scale) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: col, transparent: true, opacity: op, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, toneMapped: false })); s.scale.setScalar(scale); return s; }
// ---- Pick-me-up: screen-edge pillars + pink flash (self-only, matches reference framing) ----
function cvxPickMeUp(dur) { try { const ttl = Math.max(0.8, dur || 1.8);
  const el = document.createElement("div"); el.id = "cvxPmu"; el.style.cssText = "position:fixed;inset:0;pointer-events:none;z-index:6;transition:opacity .18s;opacity:0";
  el.innerHTML = "<div style='position:absolute;left:0;top:0;bottom:0;width:16vw;background:linear-gradient(90deg,rgba(200,70,255,.55),rgba(255,110,220,.18) 55%,transparent)'></div>" +
    "<div style='position:absolute;right:0;top:0;bottom:0;width:16vw;background:linear-gradient(-90deg,rgba(200,70,255,.55),rgba(255,110,220,.18) 55%,transparent)'></div>" +
    "<div style='position:absolute;inset:0;background:radial-gradient(60% 60% at 50% 88%,rgba(255,120,220,.28),transparent 70%)'></div>";
  document.body.appendChild(el); requestAnimationFrame(() => { el.style.opacity = "1"; });
  return cvxFx(ttl, [], (dt, age) => { el.style.opacity = String(Math.max(0, 1 - Math.max(0, (age - (ttl - 0.45)) / 0.45))); }, function done() { try { el.remove(); } catch (e) {} }); } catch (e) { try { window.cvxErr = String(e && e.stack || e).slice(0, 300); xE(e); } catch (e2) {} return null; } }
// ---- Meddle: spiky orb while flying (setPos/end), purple splash + fragments on break ----
function cvxMeddleOrb(p0) { try { const G = cvxGeos(), grp = new THREE.Group(); if (p0) grp.position.set(p0.x, p0.y || 1, p0.z);
  const core = new THREE.Mesh(G.sphL, cvxMat("orb", cvxORB, Math.random() * 9)); core.scale.setScalar(0.34); grp.add(core);
  const oglow = cvxSprite(cvxPuffTex(), 0xb070ff, 0.7, 1.5); grp.add(oglow);
  const wings = []; for (let i = 0; i < 4; i++) { const w = new THREE.Mesh(G.plane, new THREE.MeshBasicMaterial({ map: cvxWingTex(), color: 0xffffff, transparent: true, opacity: 0.95, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false, toneMapped: false })); w.scale.set(0.85, 0.42, 1); w.userData.ph = i * 1.57; wings.push(w); grp.add(w); }
  const ring = new THREE.Mesh(G.torus, cvxBasic(0xc06aff, 0.8, true)); ring.scale.setScalar(0.5); grp.add(ring);
  const fx = cvxFx(600, [grp], (dt) => { const t = cvxU.value; core.rotation.y += dt * 4; core.rotation.x += dt * 1.7;
    wings.forEach((w) => { const a = t * 5 + w.userData.ph; w.position.set(Math.cos(a) * 0.4, Math.sin(t * 7 + w.userData.ph) * 0.1, Math.sin(a) * 0.4); w.rotation.y = -a; });
    ring.rotation.x = t * 2.4; ring.rotation.y = t * 1.1; });
  return { fx: fx.fx, setPos: function (p) { try { grp.position.set(p.x, p.y, p.z); } catch (e) {} }, end: function () { fx.end(); } }; } catch (e) { try { window.cvxErr = String(e && e.stack || e).slice(0, 300); xE(e); } catch (e2) {} return null; } }
function cvxMeddleBurst(p, r) { try { const R = r || 4.5, ttl = 4.8, G = cvxGeos(), grp = new THREE.Group(); grp.position.set(p.x, (p.y || 0) + 0.1, p.z);
  const pool = new THREE.Mesh(G.sph, cvxMat("orb", cvxORB, Math.random() * 9)); pool.scale.set(R * 0.15, R * 0.15, R * 0.15); pool.position.y = 0.05; grp.add(pool);
  const ring = new THREE.Mesh(G.ring, cvxBasic(0xb050ff, 0.9, true)); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.12; grp.add(ring);
  const frags = []; for (let i = 0; i < 9; i++) { const f = new THREE.Mesh(G.plane, new THREE.MeshBasicMaterial({ map: cvxWingTex(), color: 0xffffff, transparent: true, opacity: 1, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false, toneMapped: false })); f.scale.set(0.5, 0.25, 1); f.userData = { a: i * 0.7, v: 2.5 + (i % 4) * 1.4, vy: 3.5 + (i % 5), ph: i * 1.3 }; frags.push(f); grp.add(f); }
  const splash = cvxSprite(cvxPuffTex(), 0x9a78ff, 0.95, R * 0.5); splash.position.y = 0.5; grp.add(splash);
  const starf = cvxSprite(cvxStarTex(), 0xcfe4ff, 0, R * 0.6); starf.position.y = 0.7; grp.add(starf);
  const starc = cvxSprite(cvxPuffTex(), 0xeaf4ff, 0, R * 0.12); starc.position.y = 0.7; grp.add(starc);
  const streaks = []; for (let si = 0; si < 6; si++) { const st = new THREE.Mesh(G.plane, cvxBasic(0xa8ccff, 0, true)); st.scale.set(R * 0.8, 0.05, 1); st.rotation.x = -Math.PI / 2; st.rotation.z = si * 0.52; st.position.y = 0.14 + si * 0.012; streaks.push(st); grp.add(st); }
  return cvxFx(ttl, [grp], (dt, age) => { const t = cvxU.value;
    const gk = Math.min(1, age / 0.35), die = Math.max(0, (age - (ttl - 1.2)) / 1.2);
    pool.scale.set(R * (0.15 + 0.85 * gk), R * 0.28 * (0.15 + 0.85 * gk), R * (0.15 + 0.85 * gk));
    pool.material.uniforms.uP.value = Math.min(1, Math.max(die, 0.8 - gk * 0.45)); pool.rotation.y += dt * 0.8;
    const rk = Math.min(1, age / 0.5); ring.scale.setScalar(0.3 + rk * R); ring.material.opacity = 0.9 * (1 - rk) * (1 - die);
    splash.scale.setScalar(R * (0.5 + Math.min(1, age / 0.25) * 0.9)); splash.material.opacity = 0.95 * Math.max(0, 1 - age / 0.6);
    const fk = Math.min(1, age / 0.22); starf.material.rotation = t * 1.1; starf.scale.setScalar(R * (0.55 + fk * 0.85)); starf.material.opacity = Math.max(0, 1.05 - age * 1.8); starc.scale.setScalar(R * (0.2 + fk * 0.26)); starc.material.opacity = Math.max(0, 1.1 - age * 2.4);
    streaks.forEach((st) => { const sk = Math.min(1, age / 0.28); st.material.opacity = 0.9 * (1 - sk) * (1 - sk); });
    frags.forEach((f) => { const d = Math.min(age * f.userData.v, R * 0.9); f.position.set(Math.cos(f.userData.a) * d, Math.max(0.05, 0.4 + f.userData.vy * age - 4.9 * age * age), Math.sin(f.userData.a) * d); f.rotation.z = t * 3 + f.userData.ph; f.rotation.y = f.userData.a; f.material.opacity = (1 - die) * Math.max(0, 1 - age / 3.4); }); }); } catch (e) { try { window.cvxErr = String(e && e.stack || e).slice(0, 300); xE(e); } catch (e2) {} return null; } }
// ---- Ruse sphere (visual only; cvxRuseAt keeps the J.smokes record) ----
function cvxRuse(p, r, life) { try { const R = r || 4.15, ttl = Math.max(1, life || 12.75) + 1, G = cvxGeos();
  const dome = new THREE.Mesh(G.sph, cvxMat("ruse", cvxRUSE, Math.random() * 9)); dome.position.set(p.x, (p.y || 0) + 1.7, p.z); dome.scale.setScalar(R * 0.2);
  return cvxFx(ttl, [dome], (dt, age) => { const grow = Math.min(1, age / 0.7), g2 = 1 - (1 - grow) * (1 - grow) * (1 - grow), die = Math.max(0, (age - (ttl - 1)) / 1);
    dome.scale.setScalar(Math.max(0.01, R * (0.2 + 0.8 * g2))); dome.rotation.y += dt * 0.05; dome.material.uniforms.uP.value = die; }); } catch (e) { try { window.cvxErr = String(e && e.stack || e).slice(0, 300); xE(e); } catch (e2) {} return null; } }
function cvxRuseAt(p, dur, r) { let m = null; try { m = a18Smoke(p, dur, r, 0xb9a8d8, 0xe8e0f4); m.visible = false; } catch (e) { try { xE(e); } catch (e2) {} }
  return cvxRuse({ x: p.x, y: p.y || 0, z: p.z }, r, dur); }
// ---- Not Dead Yet: white wisps rising, purple butterflies, vignette ----
function cvxNotDeadYet(p, dur) { try { const ttl = Math.max(2, dur || 5.3), G = cvxGeos(), grp = new THREE.Group(); grp.position.set(p.x, (p.y || 0), p.z);
  const wisps = []; for (let i = 0; i < 10; i++) { const w = cvxSprite(cvxPuffTex(), i % 2 ? 0xf6c0fa : 0xd088ff, 0, 0.55 + (i % 3) * 0.25); w.userData = { a: i * 0.628, r0: 0.18 + (i % 3) * 0.14, sp: 0.6 + (i % 4) * 0.25, off: i * 0.1 }; wisps.push(w); grp.add(w); }
  const flies = []; for (let i = 0; i < 7; i++) { const f = new THREE.Mesh(G.plane, new THREE.MeshBasicMaterial({ map: cvxButterflyTex(), color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false, toneMapped: false })); f.scale.set(0.5, 0.5, 1); f.userData = { a: i * 0.9, r0: 0.5 + (i % 3) * 0.3, sp: 0.7 + (i % 3) * 0.3, off: i * 0.15 }; flies.push(f); grp.add(f); }
  const halo = new THREE.Mesh(G.ring, cvxBasic(0xe8d8ff, 0.8, true)); halo.rotation.x = -Math.PI / 2; halo.position.y = 0.1; grp.add(halo);
  let veil = null;
  if (player && Math.hypot(player.x - p.x, player.z - p.z) < 3.5) { veil = document.createElement("div"); veil.id = "cvxVeil"; veil.style.cssText = "position:fixed;inset:0;pointer-events:none;z-index:6;background:radial-gradient(70% 70% at 50% 50%,rgba(233,220,255,0) 45%,rgba(190,140,255,.30) 100%);transition:opacity .3s;opacity:0"; document.body.appendChild(veil); requestAnimationFrame(() => { veil.style.opacity = "1"; }); }
  return cvxFx(ttl, [grp], (dt, age) => { const t = cvxU.value, die = Math.max(0, (age - (ttl - 0.8)) / 0.8), vis = 1 - die, fin = Math.min(1, age / 0.5);
    wisps.forEach((w) => { const ph = (t * w.userData.sp * 0.35 + w.userData.off) % 1; const rr = w.userData.r0 * (1 + ph * 0.8); w.position.set(Math.cos(w.userData.a + ph * 3.6) * rr, 0.3 + ph * 2.4, Math.sin(w.userData.a + ph * 3.6) * rr); w.material.opacity = 0.9 * vis * fin * Math.sin(ph * Math.PI); });
    flies.forEach((f) => { const ph = (t * f.userData.sp * 0.2 + f.userData.off) % 1; const a = f.userData.a + t * f.userData.sp; f.position.set(Math.cos(a) * f.userData.r0, 0.8 + Math.sin(t * 1.7 + f.userData.off * 9) * 0.5 + ph * 1.2, Math.sin(a) * f.userData.r0); f.rotation.y = -a + Math.PI / 2; f.rotation.z = Math.sin(t * 14 + f.userData.off * 20) * 0.7; f.material.opacity = 0.9 * vis * fin * Math.sin(ph * Math.PI); });
    const hk = Math.min(1, age / 0.6); halo.scale.setScalar(0.4 + hk * 2.2); halo.material.opacity = 0.8 * (1 - hk) ;
    if (veil) veil.style.opacity = String(vis); }, function done() { if (veil) veil.remove(); try { scene.remove(grp); grp.traverse((mm) => { if (mm.material && mm.material.dispose && !mm.material.userData.cvx) mm.material.dispose(); }); } catch (e) {} }); } catch (e) { try { window.cvxErr = String(e && e.stack || e).slice(0, 300); xE(e); } catch (e2) {} return null; } }
// ---- END CLOVE FX ----
