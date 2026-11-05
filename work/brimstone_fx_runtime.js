// ---- BRIMSTONE FX ----
// Brimstone ability visuals (work/brimstone_fx_runtime.js), reference-grounded in the wiki showcase clips
// viewed 2026-11-04 (wiki.playvalorant.com/en-us/Stim_Beacon, /Incendiary, /Sky_Smoke, /Orbital_Strike;
// images/Stim_Beacon_Showcase.mp4, Incendiary_Showcase.mp4, Sky_Smoke_Showcase.mp4, Orbital_Strike_Showcase.mp4
// frame sheets). Procedural approximation, no extracted game assets.
// Reference look: orange military holograms, warm sandy smoke, yellow-white orbital beam.
//   Stim Beacon: small dark device with an orange top; orange hologram ring with rotating chevrons,
//     a floating chevron emblem and rising arrow markers at the edge; one teal pulse on landing.
//   Incendiary: pool of flickering orange flames (pink-magenta accents at the base) over a dark red
//     ember glow, embers rising.
//   Sky Smoke: warm orange-tan smoke sphere, soft billowing dome blooming from above.
//   Orbital Strike: 2 s targeting ring + laser dot, then a huge yellow-white core beam in an orange
//     fire column with a scorch glow, shock ring and flying sparks; orange screen edge inside.
// Mechanics (buffs, damage, timing, sound) stay in the caller; this file is pure client fx.
// Globals used (read-only): THREE, scene, player, camera, xE, and (only in brxSkySmokeAt) a18Smoke.
// All animation runs on game dt: call brxUseGameTick() once, then brxTick(dt) from the game loop
// (the same place omxTick is called in jFxTick). Without it a rAF pump runs while effects exist.
// Returns handles accepted by brxEnd; brxReset() ends everything (round reset / disconnect).
//
// Integration wiring (integrator owns index.html):
//   1. Stim Beacon (a18Key case "Brimstone" k "c"): replace the stimz a18Ring with
//      brxStimBeacon(p, A18C.stim.r, A18C.stim.life) (keep the fx row for mechanics, m: null).
//   2. Incendiary (k "q"): keep the J.zones damage record from a18Zone but hide its flat disc
//      (m.visible = false) and add brxIncendiary(p, A18C.incend.r, A18C.incend.life).
//   3. Sky Smoke (k "e"): replace `a18Smoke(p, C.skysmoke.life, C.skysmoke.r, 0x8a929a, 0xd0c8b8)` with
//      brxSkySmokeAt(p, C.skysmoke.life, C.skysmoke.r). Three charges each cast one sphere.
//   4. Orbital Strike (k "x"): replace the orbital a18Ring with
//      brxOrbitalStrike(p, A18C.orbital.r, { delay: A18C.orbital.delay, life: A18C.orbital.life }) (keep the fx row, m: null).
//   5. Online (a18NetSync): kinds stim/fire/orbital arrive as fx rows {id,o,p,r,tl}; swap their A18VIS
//      primitives for brxStimBeacon / brxIncendiary / brxOrbitalStrike and end handles when rows stop.
//      Fire rows also serve Viper's Snake Bite (sub "snake" -> kind "snake", already separate) and the
//      generic fire cloud, so gate the swap on the row owner's agent (resolve e.o via the roster).
//      Sky Smoke arrives as a plain kind "smoke" row (no ag): resolve the owner's agent from e.o first.
var brxU = { value: 0 }, brxLive = [], brxPumpOn = false, brxGT = null, brxGeo = null, brxProg = {}, brxTex = {};
function brxNow() { try { return performance.now() / 1000; } catch (e) { return Date.now() / 1000; } }
function brxGeos() { if (brxGeo) return brxGeo; brxGeo = {
  sph: new THREE.SphereGeometry(1, 28, 20),
  ring: new THREE.RingGeometry(0.72, 1, 56),
  circle: new THREE.CircleGeometry(1, 48),
  plane: new THREE.PlaneGeometry(1, 1),
  cyl: new THREE.CylinderGeometry(1, 1, 1, 28, 1, true),
  cylS: new THREE.CylinderGeometry(1, 1, 1, 12, 1, false),
  torus: new THREE.TorusGeometry(1, 0.045, 8, 48),
  box: new THREE.BoxGeometry(1, 1, 1) }; return brxGeo; }
function brxChevTex() { if (asxTexSafe("chev")) return brxTex.chev; // orange double-chevron "V" emblem
  const c = document.createElement("canvas"); c.width = c.height = 128; const g = c.getContext("2d"); g.clearRect(0, 0, 128, 128);
  g.strokeStyle = "rgba(255,190,90,0.98)"; g.lineWidth = 9; g.lineJoin = "miter"; g.lineCap = "square";
  for (const [y, w] of [[38, 1], [72, 0.72]]) { g.beginPath(); g.moveTo(64 - 44 * w, y - 14 * w); g.lineTo(64, y + 20 * w); g.lineTo(64 + 44 * w, y - 14 * w); g.stroke(); }
  brxTex.chev = new THREE.CanvasTexture(c); if (THREE.SRGBColorSpace) brxTex.chev.colorSpace = THREE.SRGBColorSpace; return brxTex.chev; }
function asxTexSafe(k) { return !!brxTex[k]; }
function brxGlowTex() { if (brxTex.glow) return brxTex.glow; // dark red ember glow with hot spots
  const c = document.createElement("canvas"); c.width = c.height = 256; const g = c.getContext("2d"); g.clearRect(0, 0, 256, 256);
  const gr = g.createRadialGradient(128, 128, 8, 128, 128, 128); gr.addColorStop(0, "rgba(120,20,8,0.95)"); gr.addColorStop(0.7, "rgba(70,10,6,0.85)"); gr.addColorStop(1, "rgba(40,6,4,0)");
  g.fillStyle = gr; g.beginPath(); g.arc(128, 128, 128, 0, 6.2832); g.fill();
  for (let i = 0; i < 34; i++) { const x = 24 + Math.random() * 208, y = 24 + Math.random() * 208, r = 3 + Math.random() * 9, h = g.createRadialGradient(x, y, 0, x, y, r); h.addColorStop(0, "rgba(255,120,40,0.85)"); h.addColorStop(1, "rgba(255,60,10,0)"); g.fillStyle = h; g.beginPath(); g.arc(x, y, r, 0, 6.2832); g.fill(); }
  brxTex.glow = new THREE.CanvasTexture(c); if (THREE.SRGBColorSpace) brxTex.glow.colorSpace = THREE.SRGBColorSpace; return brxTex.glow; }
function brxPuffTex() { if (brxTex.puff) return brxTex.puff; // soft round ember
  const c = document.createElement("canvas"); c.width = c.height = 64; const g = c.getContext("2d");
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(0.4, "rgba(255,255,255,0.5)"); gr.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  brxTex.puff = new THREE.CanvasTexture(c); return brxTex.puff; }
function brxShader(k, frag) { if (brxProg[k]) return brxProg[k]; const m = new THREE.ShaderMaterial({
  uniforms: { uT: { value: 0 }, uP: { value: 0 }, uSeed: { value: 0 }, uA: { value: 1 } },
  vertexShader: "uniform float uT;uniform float uP;uniform float uSeed;varying vec3 vN;varying vec3 vV;varying vec3 vP;varying vec2 vUv;void main(){vUv=uv;vec3 p=position;vP=p;vec4 mv=modelViewMatrix*vec4(p,1.0);vV=-mv.xyz;vN=normalMatrix*normal;gl_Position=projectionMatrix*mv;}",
  fragmentShader: frag, transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false });
  m.userData.brx = k; brxProg[k] = m; return m; }
// Stim ring (polar): orange hologram - rotating dashed chevrons, scanline flicker, hard edge lines
const brxHOLO = "uniform float uT;uniform float uP;uniform float uSeed;varying vec2 vUv;\nvoid main(){vec2 q=vUv*2.0-1.0;float r=length(q);if(r>1.0)discard;float a=atan(q.y,q.x);float seg=step(0.35,fract(a/6.2832*14.0+uT*0.35+uSeed));float band=smoothstep(.78,.82,r)*(1.0-smoothstep(.95,1.0,r));float inner=smoothstep(.30,.34,r)*(1.0-smoothstep(.62,.66,r))*step(0.5,fract(a/6.2832*8.0-uT*0.5));float scan=.78+.22*sin(vUv.y*260.0+uT*24.0);vec3 c=vec3(1.0,.62,.22);float al=(band*(.30+.45*seg)+inner*.4)*scan*(1.0-uP);gl_FragColor=vec4(c,al*.6);}";
// Incendiary flame sheet (uv.y up): orange body, yellow core, faint magenta tinge low, ragged tip
const brxFLAME = "uniform float uT;uniform float uP;uniform float uSeed;varying vec3 vN;varying vec3 vV;varying vec2 vUv;\nvoid main(){float y=vUv.y;float x=vUv.x;float n=sin(x*17.0+uT*9.0+uSeed)*sin(y*7.0-uT*12.0+uSeed*2.0)*.5+.5;float n2=sin(x*29.0-uT*6.0)*sin(y*15.0-uT*9.0)*.5+.5;vec3 c=mix(vec3(1.0,.42,.08),vec3(1.0,.78,.25),n);c=mix(c,vec3(1.0,.93,.6),pow(1.0-y,2.0)*(.4+.6*n2));c=mix(c,vec3(.95,.30,.62),(1.0-smoothstep(0.0,.30,y))*.30);float f=pow(1.0-abs(dot(normalize(vN),normalize(vV))),1.0);float side=smoothstep(0.0,.18,x)*(1.0-smoothstep(.82,1.0,x));float a=side*smoothstep(0.0,.05,y)*(1.0-smoothstep(.45,.95,y+.20*n2-.10))*(.6+.4*n)*(.8+.3*f)*(1.0-uP);gl_FragColor=vec4(c,a);}";
// Sky Smoke sphere: warm sandy-orange billows, soft light rim
const brxSMOKE = "uniform float uT;uniform float uP;uniform float uSeed;varying vec3 vN;varying vec3 vV;varying vec3 vP;\nfloat bh(vec3 p){p=fract(p*.3183099+vec3(.11,.23,.37));p*=17.0;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}\nfloat bn(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(mix(bh(i),bh(i+vec3(1,0,0)),f.x),mix(bh(i+vec3(0,1,0)),bh(i+vec3(1,1,0)),f.x),f.y),mix(mix(bh(i+vec3(0,0,1)),bh(i+vec3(1,0,1)),f.x),mix(bh(i+vec3(0,1,1)),bh(i+vec3(1,1,1)),f.x),f.y),f.z);}\nvoid main(){float facing=abs(dot(normalize(vN),normalize(vV)));float rim=pow(1.0-facing,1.8);vec3 q=vP*2.6+vec3(uT*.06,-uT*.045,uT*.05)+uSeed;float n=bn(q)*.55+bn(q*2.6)*.45;float diag=vP.x*.85+vP.y*1.5+vP.z*.55;float band=sin(diag*2.6-uT*.9+n*4.0)*.5+.5;vec3 c=mix(vec3(.62,.44,.28),vec3(.93,.76,.56),smoothstep(.1,.95,n)*.30+band*.70);c*=0.80+band*0.38;c+=vec3(.95,.82,.62)*smoothstep(.66,.95,n)*.5;c=mix(c,vec3(.96,.86,.70),rim*.8);gl_FragColor=vec4(c,(0.98)*(1.0-uP));}";
// Orbital beam (uv.y up): bright orange column, hot streaks, fade at both ends
const brxBEAM = "uniform float uT;uniform float uP;uniform float uSeed;varying vec3 vN;varying vec3 vV;varying vec2 vUv;\nvoid main(){float f=pow(1.0-abs(dot(normalize(vN),normalize(vV))),.9);float n=sin(vUv.x*23.0+uSeed)*sin(vUv.y*30.0-uT*16.0)*.5+.5;float n2=sin(vUv.x*47.0-uSeed*2.0)*sin(vUv.y*65.0-uT*27.0+n*4.0)*.5+.5;vec3 c=mix(vec3(1.0,.55,.12),vec3(1.0,.82,.45),n);c=mix(c,vec3(1.0,.96,.85),f*.85);c=mix(c,vec3(1.05,1.0,.95),pow(n2,2.0)*.8);float a=(.30+.65*f)*(.45+.75*n2)*smoothstep(0.0,.05,vUv.y)*(1.0-smoothstep(.92,1.0,vUv.y))*(1.0-uP);gl_FragColor=vec4(c,a);}";
function brxMat(k, shader, seed) { const m = brxShader(k, shader).clone(); delete m.userData.brx; m.uniforms.uT = brxU; if (seed !== undefined) m.uniforms.uSeed.value = seed; return m; } // clone is disposable; cached program keeps userData.brx
function brxBasic(c, o, add) { return new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: o, depthWrite: false, blending: add ? THREE.AdditiveBlending : THREE.NormalBlending, side: THREE.DoubleSide, fog: false, toneMapped: false }); }
function brxPush(fx) { if (brxLive.length > 24) { const o = brxLive.shift(); try { o.done(); } catch (e) {} } brxLive.push(fx); if (!brxGT && !brxPumpOn) { brxPumpOn = true; brxPump.last = brxNow(); requestAnimationFrame(brxPump); } return fx; }
function brxPump() { if (brxGT) { brxPumpOn = false; return; } const now = brxNow(), dt = Math.min(0.1, Math.max(0.0005, now - (brxPump.last || now))); brxPump.last = now; brxU.value += dt;
  for (let i = brxLive.length - 1; i >= 0; i--) { const fx = brxLive[i]; fx.age += dt; try { fx.tick(dt, fx.age, Math.min(1, fx.age / fx.ttl)); } catch (e) { try { xE(e); } catch (e2) {} }
    if (fx.age >= fx.ttl) { try { fx.done(); } catch (e) {} brxLive.splice(i, 1); } }
  if (brxLive.length) requestAnimationFrame(brxPump); else brxPumpOn = false; }
function brxUseGameTick() { brxGT = true; brxPumpOn = false; } // integrator then calls brxTick(dt) per frame
function brxTick(dt) { brxU.value += dt; for (let i = brxLive.length - 1; i >= 0; i--) { const fx = brxLive[i]; fx.age += dt; try { fx.tick(dt, fx.age, Math.min(1, fx.age / fx.ttl)); } catch (e) { try { xE(e); } catch (e2) {} } if (fx.age >= fx.ttl) { try { fx.done(); } catch (e) {} brxLive.splice(i, 1); } } }
function brxEnd(h) { if (!h || !h.fx) return; const i = brxLive.indexOf(h.fx); if (i >= 0) brxLive.splice(i, 1); try { h.fx.done(); } catch (e) {} }
function brxFx(ttl, objs, tick, done) { const fx = { age: 0, ttl, objs, tick, done: done || function () { objs.forEach((o) => { try { scene.remove(o); o.traverse((m) => { if (m.material && m.material.dispose && !m.material.userData.brx) m.material.dispose(); if (m.userData.og && m.geometry && m.geometry.dispose) m.geometry.dispose(); }); } catch (e) {} }); } }; objs.forEach((o) => { o.traverse ? o.traverse((m) => { m.raycast = () => {}; }) : 0; scene.add(o); }); brxPush(fx); return { fx, end: function () { brxEnd(this); } }; }
function brxReset() { while (brxLive.length) brxEnd({ fx: brxLive[0] }); const d = document.getElementById("brxOrbV"); if (d) d.remove(); }
function brxSprite(tex, col, op, scale) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: col, transparent: true, opacity: op, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, toneMapped: false })); s.scale.setScalar(scale); return s; }
function brxNearPlayer(p, d) { try { return player && Math.hypot(player.x - p.x, player.z - p.z) < d; } catch (e) { return false; } }
// ---- Stim Beacon: device + orange hologram ring + floating chevron + edge arrows + landing pulse ----
function brxStimBeacon(p, r, life) { try { const R = r || 4, ttl = Math.max(1, life || 12.5), G = brxGeos(), grp = new THREE.Group(); grp.position.set(p.x, (p.y || 0), p.z);
  const base = new THREE.Mesh(G.cylS, new THREE.MeshLambertMaterial({ color: 0x2a2d33 })); base.scale.set(0.22, 0.10, 0.22); base.position.y = 0.05; grp.add(base);
  const top = new THREE.Mesh(G.cylS, brxBasic(0xff8a2a, 0.95, true)); top.scale.set(0.16, 0.04, 0.16); top.position.y = 0.13; grp.add(top);
  const ring = new THREE.Mesh(G.circle, brxMat("holo", brxHOLO, Math.random() * 9)); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.07; ring.scale.setScalar(R); grp.add(ring);
  const edge = new THREE.Mesh(G.ring, brxBasic(0xffb04a, 0.45, true)); edge.rotation.x = -Math.PI / 2; edge.position.y = 0.08; edge.scale.setScalar(R); grp.add(edge);
  const emblem = new THREE.Mesh(G.plane, new THREE.MeshBasicMaterial({ map: brxChevTex(), color: 0xffc06a, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false, toneMapped: false })); emblem.scale.setScalar(0.9); emblem.position.y = 1.15; grp.add(emblem);
  const arrows = []; for (let i = 0; i < 4; i++) { const a = new THREE.Mesh(G.plane, emblem.material.clone()); a.scale.set(0.4, 0.55, 1); a.userData.a = i * Math.PI / 2; arrows.push(a); grp.add(a); }
  const pulse = new THREE.Mesh(G.ring, brxBasic(0x3fd0c0, 0.85, true)); pulse.rotation.x = -Math.PI / 2; pulse.position.y = 0.09; grp.add(pulse);
  return brxFx(ttl, [grp], (dt, age) => { const t = brxU.value, die = Math.max(0, (age - (ttl - 0.5)) / 0.5), vis = 1 - die;
    ring.material.uniforms.uP.value = die; edge.material.opacity = 0.45 * vis * (0.7 + 0.3 * Math.sin(t * 3.4));
    top.material.opacity = 0.7 + 0.3 * Math.sin(t * 6);
    emblem.position.y = 1.15 + Math.sin(t * 2) * 0.08; emblem.rotation.y = t * 0.8; emblem.material.opacity = 0.9 * vis * (0.75 + 0.25 * Math.sin(t * 22));
    arrows.forEach((a) => { const ph = (t * 0.9 + a.userData.a / Math.PI / 2) % 1; a.position.set(Math.cos(a.userData.a) * R * 0.92, 0.25 + ph * 1.0, Math.sin(a.userData.a) * R * 0.92); a.rotation.y = -a.userData.a + Math.PI / 2; a.material.opacity = 0.75 * vis * (1 - ph); });
    const pk = Math.min(1, age / 0.6); pulse.scale.setScalar(0.4 + pk * R * 1.05); pulse.material.opacity = 0.85 * (1 - pk); }); } catch (e) { try { window.brxErr = String(e && e.stack || e).slice(0, 300); xE(e); } catch (e2) {} return null; } }
// ---- Incendiary: flame pool over ember glow, rising embers ----
function brxIncendiary(p, r, life) { try { const R = r || 4.5, ttl = Math.max(1, life || 7), G = brxGeos(), grp = new THREE.Group(); grp.position.set(p.x, (p.y || 0) + 0.05, p.z);
  const glow = new THREE.Mesh(G.circle, new THREE.MeshBasicMaterial({ map: brxGlowTex(), color: 0xffffff, transparent: true, opacity: 0.95, depthWrite: false, fog: false })); glow.rotation.x = -Math.PI / 2; glow.scale.setScalar(R * 1.05); grp.add(glow);
  const flames = []; for (let i = 0; i < 7; i++) { const f = new THREE.Mesh(G.plane, brxMat("flame", brxFLAME, i * 1.37)); const a = i * 0.897; f.position.set(Math.cos(a) * R * 0.22 * (i % 3), 0, Math.sin(a) * R * 0.22 * (i % 3)); f.rotation.y = a + Math.PI / 2; const h = 1.5 + (i % 3) * 0.5; f.scale.set(R * 0.55, h, 1); f.position.y = h / 2; f.userData.h = h; f.userData.ph = i * 1.7; flames.push(f); grp.add(f); }
  for (let i = 0; i < 4; i++) { const f = new THREE.Mesh(G.plane, brxMat("flame", brxFLAME, 11 + i * 2.1)); const a = i * 1.57 + 0.4; f.position.set(Math.cos(a) * R * 0.72, 0, Math.sin(a) * R * 0.72); f.rotation.y = a + Math.PI; const h = 0.9 + (i % 2) * 0.4; f.scale.set(R * 0.34, h, 1); f.position.y = h / 2; f.userData.h = h; f.userData.ph = 9 + i * 1.3; flames.push(f); grp.add(f); }
  const embers = []; for (let i = 0; i < 8; i++) { const s = brxSprite(brxPuffTex(), 0xffa04a, 0.8, 0.16 + (i % 3) * 0.06); s.userData = { a: i * 0.785, r0: Math.sqrt((i * 37 % 100) / 100) * R * 0.8, sp: 1.1 + (i % 4) * 0.35, off: i * 0.31 }; embers.push(s); grp.add(s); }
  const flash = new THREE.Mesh(G.torus, brxBasic(0xffb04a, 0.9, true)); flash.rotation.x = Math.PI / 2; flash.position.y = 0.1; grp.add(flash);
  return brxFx(ttl, [grp], (dt, age) => { const t = brxU.value, die = Math.max(0, (age - (ttl - 0.6)) / 0.6), vis = 1 - die, grow = Math.min(1, age / 0.25);
    glow.material.opacity = 0.95 * vis * (0.85 + 0.15 * Math.sin(t * 7.3));
    flames.forEach((f) => { f.scale.y = f.userData.h * grow * vis * (0.82 + 0.30 * Math.sin(t * 9 + f.userData.ph)); f.position.y = f.scale.y / 2; f.material.uniforms.uP.value = die; });
    embers.forEach((s) => { const ph = (t * s.userData.sp * 0.4 + s.userData.off) % 1; s.position.set(Math.cos(s.userData.a + t * 0.3) * s.userData.r0, 0.2 + ph * 2.2, Math.sin(s.userData.a + t * 0.3) * s.userData.r0); s.material.opacity = 0.8 * vis * (1 - ph) * grow; });
    const pk = Math.min(1, age / 0.4); flash.scale.setScalar(0.5 + pk * R); flash.material.opacity = 0.9 * (1 - pk); }); } catch (e) { try { window.brxErr = String(e && e.stack || e).slice(0, 300); xE(e); } catch (e2) {} return null; } }
// ---- Sky Smoke sphere (visual only; brxSkySmokeAt keeps the J.smokes record) ----
function brxSkySmoke(p, r, life) { try { const R = r || 4.15, ttl = Math.max(1, life || 19) + 1, G = brxGeos();
  const dome = new THREE.Mesh(G.sph, brxMat("smoke", brxSMOKE, Math.random() * 9)); dome.position.set(p.x, (p.y || 0) + 1.7, p.z); dome.scale.setScalar(R * 0.2);
  return brxFx(ttl, [dome], (dt, age) => { const grow = Math.min(1, age / 0.7), g2 = 1 - (1 - grow) * (1 - grow) * (1 - grow), die = Math.max(0, (age - (ttl - 1)) / 1);
    dome.scale.setScalar(Math.max(0.01, R * (0.2 + 0.8 * g2))); dome.rotation.y += dt * 0.05; dome.material.uniforms.uP.value = die; }); } catch (e) { try { window.brxErr = String(e && e.stack || e).slice(0, 300); xE(e); } catch (e2) {} return null; } }
function brxSkySmokeAt(p, dur, r) { let m = null; try { m = a18Smoke(p, dur, r, 0x8a929a, 0xd0c8b8); m.visible = false; } catch (e) { try { xE(e); } catch (e2) {} }
  return brxSkySmoke({ x: p.x, y: p.y || 0, z: p.z }, r, dur); }
// ---- Orbital Strike: targeting ring + laser dot, then the beam column; orange veil inside ----
function brxOrbitalStrike(p, r, opts) { try { const R = r || 5, o = opts || {}, delay = o.delay != null ? o.delay : 2, life = o.life != null ? o.life : 4, G = brxGeos(), grp = new THREE.Group(); grp.position.set(p.x, (p.y || 0) + 0.06, p.z);
  const ring = new THREE.Mesh(G.ring, brxBasic(0xff7a2a, 0.85, true)); ring.rotation.x = -Math.PI / 2; ring.scale.setScalar(R); grp.add(ring);
  const dot = brxSprite(brxPuffTex(), 0xff8a2a, 0.9, 1.1); dot.position.y = 0.3; grp.add(dot);
  const guide = new THREE.Mesh(G.cyl, brxBasic(0xff9a3a, 0.22, true)); guide.scale.set(0.12, 60, 0.12); guide.position.y = 30; grp.add(guide);
  const core = new THREE.Mesh(G.cyl, brxBasic(0xfff2c8, 0.95, true)); core.scale.set(R * 0.42, 60, R * 0.42); core.position.y = 30; core.visible = false; grp.add(core);
  const outer = new THREE.Mesh(G.cyl, brxMat("beam", brxBEAM, Math.random() * 9)); outer.scale.set(R, 60, R); outer.position.y = 30; outer.visible = false; grp.add(outer);
  const scorch = new THREE.Mesh(G.circle, new THREE.MeshBasicMaterial({ map: brxGlowTex(), transparent: true, opacity: 0, depthWrite: false, fog: false })); scorch.rotation.x = -Math.PI / 2; scorch.scale.setScalar(R * 1.1); grp.add(scorch);
  const shock = new THREE.Mesh(G.torus, brxBasic(0xffc06a, 0, true)); shock.rotation.x = Math.PI / 2; shock.position.y = 0.12; grp.add(shock);
  const sparks = []; for (let i = 0; i < 10; i++) { const s = brxSprite(brxPuffTex(), i % 3 ? 0xffa04a : 0xfff0b0, 0, 0.22 + (i % 3) * 0.08); s.userData = { a: i * 0.63, v: 5 + (i % 5) * 2.2, out: 1.2 + (i % 4) * 0.8, off: i * 0.17 }; sparks.push(s); grp.add(s); }
  let veil = null;
  const ttl = delay + life + 2.2;
  return brxFx(ttl, [grp], (dt, age) => { const t = brxU.value;
    if (age < delay) { const k = age / delay; ring.material.opacity = 0.85 * (0.5 + 0.5 * Math.sin(t * (4 + 10 * k))); ring.scale.setScalar(R * (1.12 - 0.12 * k)); dot.material.opacity = 0.9 * (0.6 + 0.4 * Math.sin(t * 12)); guide.material.opacity = 0.10 + 0.14 * k; return; }
    const k = Math.min(1, (age - delay) / life), on = k < 1;
    core.visible = on; outer.visible = on;
    core.material.opacity = 0.95 * (on ? (0.7 + 0.3 * Math.sin(t * 31) * Math.sin(t * 47 + 1.3)) * (1 - Math.max(0, (k - 0.85) / 0.15)) : 0);
    core.scale.set(R * 0.42 * (1 + 0.05 * Math.sin(t * 17)), 60, R * 0.42 * (1 + 0.05 * Math.sin(t * 17)));
    outer.material.uniforms.uP.value = 1 - (on ? 1 - Math.max(0, (k - 0.8) / 0.2) : 0);
    ring.material.opacity = 0.85 * (1 - k); dot.material.opacity = 0; guide.material.opacity = 0;
    scorch.material.opacity = Math.min(0.95, (age - delay) / 0.2) * (on ? 1 : Math.max(0, 1 - (age - delay - life) / 2.2));
    const sk = Math.min(1, (age - delay) / 0.5); shock.scale.setScalar(0.5 + sk * R * 1.7); shock.material.opacity = 0.9 * (1 - sk);
    sparks.forEach((s) => { if (!on) { s.material.opacity = 0; return; } const ph = ((age - delay) * s.userData.v / 6 + s.userData.off) % 1; s.position.set(Math.cos(s.userData.a) * s.userData.out * (0.4 + ph * 2.4), 0.3 + ph * 7, Math.sin(s.userData.a) * s.userData.out * (0.4 + ph * 2.4)); s.material.opacity = 0.85 * (1 - ph) * (1 - k); });
    const inside = on && brxNearPlayer(p, R + 0.6);
    if (inside && !veil) { veil = document.createElement("div"); veil.id = "brxOrbV"; veil.style.cssText = "position:fixed;inset:0;pointer-events:none;z-index:6;background:radial-gradient(75% 75% at 50% 50%,rgba(255,90,10,0) 40%,rgba(255,90,10,.38) 100%);transition:opacity .12s"; document.body.appendChild(veil); }
    if (veil) veil.style.opacity = inside ? "1" : "0";
    if (!on && veil) { veil.remove(); veil = null; } }, function done() { if (veil) veil.remove(); try { scene.remove(grp); grp.traverse((mm) => { if (mm.material && mm.material.dispose && !mm.material.userData.brx) mm.material.dispose(); }); } catch (e) {} } ); } catch (e) { try { window.brxErr = String(e && e.stack || e).slice(0, 300); xE(e); } catch (e2) {} return null; } }
// ---- END BRIMSTONE FX ----
