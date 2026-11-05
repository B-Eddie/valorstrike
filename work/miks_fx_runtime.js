// ---- MIKS FX ----
// Miks ability visuals (work/miks_fx_runtime.js), reference-grounded in the wiki showcase clips
// (wiki.playvalorant.com/en-us/images/M-pulse_Showcase.mp4, Harmonize_Showcase.mp4,
// Waveform_Showcase.mp4, Bassquake_Showcase.mp4; frame sheets reviewed 2026-11-04).
// Procedural approximation, not extracted game assets. Main entries keep game mechanics.
// All positions are world-space. Every entry returns a handle accepted by mkxEnd (or use h.end()).
// mkxUseGameTick() then mkxTick(dt) hands timing to the game loop (game-dt driven, never wall clock).
// Shared geometry/programs persist; cloned per-effect materials are disposed recursively.
var mkxU = { value: 0 }, mkxLive = [], mkxPumpOn = false, mkxGT = null, mkxGeo = null, mkxProg = {};
function mkxNow() { try { return performance.now() / 1000; } catch (e) { return Date.now() / 1000; } }
function mkxGeos() { if (mkxGeo) return mkxGeo; mkxGeo = {
  sph: new THREE.SphereGeometry(1, 24, 16),
  ring: new THREE.RingGeometry(0.86, 1, 48),
  torus: new THREE.TorusGeometry(1, 0.05, 8, 48),
  cone: new THREE.ConeGeometry(0.5, 1, 10, 3),
  plane: new THREE.PlaneGeometry(1, 1, 1, 4),
  box: new THREE.BoxGeometry(1, 1, 1) }; return mkxGeo; }
function mkxShader(k, frag, opts) { if (mkxProg[k]) return mkxProg[k]; const m = new THREE.ShaderMaterial(Object.assign({
  uniforms: { uT: mkxU, uP: { value: 0 }, uSeed: { value: 0 }, uA: { value: 1 } },
  vertexShader: "uniform float uT;uniform float uP;uniform float uSeed;varying vec3 vN;varying vec3 vV;varying vec3 vP;varying vec2 vUv;void main(){vUv=uv;vec3 p=position;vP=p;vec4 mv=modelViewMatrix*vec4(p,1.0);vV=-mv.xyz;vN=normalMatrix*normal;gl_Position=projectionMatrix*mv;}",
  fragmentShader: frag, transparent: true, depthWrite: false, side: THREE.DoubleSide }, opts || {}));
  m.userData.mkx = k; mkxProg[k] = m; return m; }
function mkxMat(k, shader, seed, opts) { const m = mkxShader(k, shader, opts).clone(); m.uniforms.uT = mkxU; if (seed !== undefined) m.uniforms.uSeed.value = seed; return m; }
function mkxBasic(c, o, add) { return new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: o, depthWrite: false, blending: add ? THREE.AdditiveBlending : THREE.NormalBlending, side: THREE.DoubleSide }); }
function mkxPush(fx) { if (mkxLive.length > 24) { const o = mkxLive.shift(); try { o.done(); } catch (e) {} } mkxLive.push(fx); if (!mkxGT && !mkxPumpOn) { mkxPumpOn = true; mkxPump.last = mkxNow(); requestAnimationFrame(mkxPump); } return fx; }
function mkxStep(dt) { mkxU.value += dt; for (let i = mkxLive.length - 1; i >= 0; i--) { const fx = mkxLive[i]; fx.age += dt; try { fx.tick(dt, fx.age, Math.min(1, fx.age / fx.ttl)); } catch (e) { try { xE(e); } catch (e2) {} } if (fx.age >= fx.ttl) { try { fx.done(); } catch (e) {} mkxLive.splice(i, 1); } } }
function mkxPump() { if (mkxGT) { mkxPumpOn = false; return; } const now = mkxNow(), dt = Math.min(0.1, Math.max(0.0005, now - (mkxPump.last || now))); mkxPump.last = now; mkxStep(dt); if (mkxLive.length) requestAnimationFrame(mkxPump); else mkxPumpOn = false; }
function mkxUseGameTick() { mkxGT = true; mkxPumpOn = false; }
function mkxTick(dt) { mkxStep(dt); }
function mkxEnd(h) { if (!h || !h.fx) return; const i = mkxLive.indexOf(h.fx); if (i >= 0) mkxLive.splice(i, 1); try { h.fx.done(); } catch (e) {} }
function mkxDispose(o) { o.traverse((m) => { if (m.material && m.material.dispose) m.material.dispose(); if (m.userData && m.userData.mkxOwnGeo && m.geometry && m.geometry.dispose) m.geometry.dispose(); }); }
function mkxFx(ttl, objs, tick, done) { const fx = { age: 0, ttl, objs, tick, done: done || function () { objs.forEach((o) => { try { scene.remove(o); mkxDispose(o); } catch (e) {} }); } }; objs.forEach((o) => scene.add(o)); mkxPush(fx); return { fx, end: function () { mkxEnd(this); } }; }
// waveform smoke: swirling teal-green dome, aqua rim (wiki clip)
const mkxSMOKE = "uniform float uT;uniform float uP;uniform float uSeed;varying vec3 vN;varying vec3 vV;varying vec3 vP;varying vec2 vUv;\nfloat h3(vec3 p){p=fract(p*.3183+vec3(.13,.29,.41));p*=17.0;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}\nfloat nz(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(mix(h3(i),h3(i+vec3(1,0,0)),f.x),mix(h3(i+vec3(0,1,0)),h3(i+vec3(1,1,0)),f.x),f.y),mix(mix(h3(i+vec3(0,0,1)),h3(i+vec3(1,0,1)),f.x),mix(h3(i+vec3(0,1,1)),h3(i+vec3(1,1,1)),f.x),f.y),f.z);}\nvoid main(){float f=pow(1.0-abs(dot(normalize(vN),normalize(vV))),1.5);vec3 q=vP*2.6+vec3(uT*.12,-uT*.07,uT*.09);float n=nz(q)*.6+nz(q*2.1)*.4;vec3 c=mix(vec3(.05,.35,.28),vec3(.35,.85,.70),n);c+=vec3(.55,1.0,.85)*f*.8;float a=(.78+.2*n)*(1.0-uP);gl_FragColor=vec4(c,a);}";
// m-pulse ground grid: concentric rings + radial spokes, violet (concuss) or teal (heal)
const mkxGRID = "uniform float uT;uniform float uP;uniform float uSeed;uniform vec3 uCol;varying vec2 vUv;void main(){vec2 q=(vUv-0.5)*2.0;float r=length(q);if(r>1.0)discard;float a=atan(q.y,q.x);float rings=smoothstep(0.06,0.02,abs(fract(r*5.0-uT*0.35)-0.5)-0.32);float spokes=smoothstep(0.05,0.015,abs(fract(a/6.2831*16.0)-0.5)-0.30)*smoothstep(0.15,0.4,r);vec3 c=uCol*(0.35+0.65*(rings+spokes));float al=(0.10+0.30*(rings+spokes))*(1.0-smoothstep(0.92,1.0,r))*(1.0-uP);gl_FragColor=vec4(c,al);}";
// sound wavefront arc: warm amber band with a bright rim, soft radial falloff
const mkxWAVE = "uniform float uT;uniform float uP;uniform float uSeed;varying vec3 vN;varying vec3 vV;varying vec2 vUv;void main(){float f=pow(1.0-abs(dot(normalize(vN),normalize(vV))),1.1);float band=pow(1.0-abs(vUv.y-0.5)*2.0,1.6);vec3 c=mix(vec3(1.0,0.62,0.15),vec3(1.0,0.88,0.55),band);float a=band*(0.5+0.4*f)*(1.0-uP);gl_FragColor=vec4(c,a);}";
// harmonize beam: golden light pillar with rising energy
const mkxBEAM = "uniform float uT;uniform float uP;uniform float uSeed;varying vec2 vUv;void main(){float across=pow(1.0-abs(vUv.x-0.5)*2.0,2.0);float rise=0.6+0.4*sin(vUv.y*10.0-uT*6.0+uSeed);vec3 c=mix(vec3(1.0,0.75,0.25),vec3(1.0,0.95,0.7),across)*rise;float a=across*(0.4+0.35*rise)*(1.0-uP);gl_FragColor=vec4(c,a);}";
// ---- screen veil (DOM, CSS injected once): combat-stim edge pillars, purple like the reference ----
function mkxCss() { if (document.getElementById("mkxCss")) return; const s = document.createElement("style"); s.id = "mkxCss"; s.textContent =
  ".mkxV{position:fixed;inset:0;pointer-events:none;z-index:6;background-repeat:no-repeat;opacity:0;transition:opacity .2s}" +
  ".mkxVStim{background:linear-gradient(90deg,rgba(190,120,255,.55) 0%,rgba(190,120,255,0) 7%,rgba(190,120,255,0) 93%,rgba(190,120,255,.55) 100%),linear-gradient(90deg,rgba(255,200,90,.35) 2%,rgba(255,200,90,0) 5%,rgba(255,200,90,0) 95%,rgba(255,200,90,.35) 98%)}";
  (document.head || document.documentElement).appendChild(s); }
// ---- entries ----
// M-pulse: landed speaker device + radial grid field + periodic expanding sound-wave rings
// opts.heal = healing output (green), default concuss (orange over violet grid). Pulse cadence follows game dt.
function mkxMPulse(p, r, seconds, opts) { try { const G = mkxGeos(), R = r || 6, ttl = Math.max(1, seconds || 6);
  const heal = !!(opts && opts.heal), waveC = heal ? 0x4ae88a : 0xff9a2a, gridC = heal ? new THREE.Color(0x3ad0a0) : new THREE.Color(0x8a5ae8);
  const grp = new THREE.Group(); grp.position.set(p.x, (p.y || 0), p.z);
  const gridMat = mkxMat("grid", mkxGRID, 0); gridMat.uniforms.uCol = { value: gridC };
  const grid = new THREE.Mesh(new THREE.CircleGeometry(R, 40), gridMat); grid.userData.mkxOwnGeo = true; grid.rotation.x = -Math.PI / 2; grid.position.y = 0.05; grid.scale.setScalar(0.05); grp.add(grid);
  const body = new THREE.Mesh(G.sph, mkxBasic(0x22262e, 0.95, false)); body.scale.set(0.16, 0.12, 0.16); body.position.y = 0.10; grp.add(body);
  const horn = new THREE.Mesh(G.cone, mkxBasic(0x22262e, 0.95, false)); horn.scale.set(0.14, 0.16, 0.14); horn.rotation.x = Math.PI; horn.position.y = 0.24; grp.add(horn);
  const core = new THREE.Mesh(G.sph, mkxBasic(waveC, 0.9, true)); core.scale.setScalar(0.06); core.position.y = 0.17; grp.add(core);
  const waves = [];
  const fx = mkxFx(ttl, [grp], (dt, age) => { const g = Math.min(1, age / 0.3); grid.scale.setScalar(Math.max(0.05, g) * R);
    const die = Math.max(0, (age - (ttl - 0.5)) / 0.5), keep = 1 - die;
    grid.material.uniforms.uP.value = die; core.material.opacity = 0.9 * keep * (0.6 + 0.4 * Math.sin(mkxU.value * 6));
    body.material.opacity = 0.95 * keep; horn.material.opacity = 0.95 * keep;
    fx.fx.next = (fx.fx.next == null ? 0.4 : fx.fx.next) - dt;
    if (fx.fx.next <= 0 && die <= 0) { fx.fx.next = 0.9;
      const w = new THREE.Mesh(G.torus, mkxBasic(waveC, 0.8, true)); w.rotation.x = Math.PI / 2; w.position.y = 0.5; grp.add(w);
      const dm = new THREE.Mesh(G.sph, mkxBasic(waveC, 0.10, true)); dm.scale.setScalar(0.3); dm.position.y = 0.6; grp.add(dm);
      waves.push({ w, dm, t: 0 }); }
    for (let i = waves.length - 1; i >= 0; i--) { const o = waves[i]; o.t += dt; const k = Math.min(1, o.t / 0.8);
      o.w.scale.setScalar(Math.max(0.05, 0.3 + k * R)); o.w.material.opacity = 0.8 * (1 - k); o.w.position.y = 0.5 + k * 0.4;
      o.dm.scale.setScalar(0.3 + k * R * 0.7); o.dm.material.opacity = 0.10 * (1 - k);
      if (k >= 1) { grp.remove(o.w); grp.remove(o.dm); o.w.material.dispose(); o.dm.material.dispose(); waves.splice(i, 1); } } },
  function () { waves.forEach((o) => { try { grp.remove(o.w); grp.remove(o.dm); o.w.material.dispose(); o.dm.material.dispose(); } catch (e) {} });
    try { scene.remove(grp); mkxDispose(grp); } catch (e) {} });
  return fx; } catch (e) { try { window.mkxErr = String(e && e.stack || e).slice(0, 300); xE(e); } catch (e2) {} return null; } }
// Harmonize: golden beam pillars + rising motes on self and the linked ally; caster gets the stim edge veil.
// h.setTargets(selfP, allyP) tracks movement; allyP may be null for the self-only alt-fire.
function mkxHarmonize(selfP, allyP, seconds) { try { const G = mkxGeos(), ttl = Math.max(1, seconds || 8);
  mkxCss(); const veil = document.createElement("div"); veil.className = "mkxV mkxVStim"; document.body.appendChild(veil); veil.style.opacity = "1";
  const mkPillar = () => { const g2 = new THREE.Group();
    const b1 = new THREE.Mesh(G.plane, mkxMat("beam", mkxBEAM, Math.random() * 5)); b1.scale.set(0.5, 2.4, 1); b1.position.y = 1.2; g2.add(b1);
    const b2 = b1.clone(); b2.material = mkxMat("beam", mkxBEAM, Math.random() * 5); b2.rotation.y = Math.PI / 2; g2.add(b2);
    const motes = []; for (let i = 0; i < 4; i++) { const m = new THREE.Mesh(G.plane, mkxBasic(0xffd88a, 0.8, true)); m.scale.setScalar(0.05); m.userData.a = i * 1.7; g2.add(m); motes.push(m); }
    return { g: g2, motes }; };
  const sA = mkPillar(), sB = allyP ? mkPillar() : null; scene.add(sA.g); if (sB) scene.add(sB.g);
  const fx = mkxFx(ttl, [], (dt, age) => { const die = Math.max(0, (age - (ttl - 0.4)) / 0.4), keep = 1 - die;
    veil.style.opacity = String(keep);
    const place = (s, p) => { if (!p) return; s.g.position.set(p.x, (p.y || 0), p.z); s.g.children.forEach((m) => { if (m.material.uniforms) m.material.uniforms.uP.value = die; });
      s.motes.forEach((m) => { const u = (mkxU.value * 0.7 + m.userData.a) % 1.6; m.position.set(Math.cos(m.userData.a * 3) * 0.3, 0.3 + u * 1.4, Math.sin(m.userData.a * 3) * 0.3); m.material.opacity = 0.8 * (1 - u / 1.6) * keep; }); };
    place(sA, fx.fx.selfP); place(sB, fx.fx.allyP); },
  function () { [sA.g, sB && sB.g].forEach((g2) => { if (g2) { try { scene.remove(g2); mkxDispose(g2); } catch (e) {} } }); veil.remove(); });
  fx.fx.selfP = selfP; fx.fx.allyP = allyP || null;
  fx.setTargets = function (s, a) { fx.fx.selfP = s; fx.fx.allyP = a || null; };
  return fx; } catch (e) { try { window.mkxErr = String(e && e.stack || e).slice(0, 300); xE(e); } catch (e2) {} return null; } }
// Waveform smoke: iridescent teal-green swirling dome (wiki clip), grows in, holds, fades
function mkxWaveformSmoke(p, r, seconds) { try { const G = mkxGeos(), R = r || 4.15, ttl = Math.max(1, seconds || 14);
  const dome = new THREE.Mesh(G.sph, mkxMat("smoke", mkxSMOKE, Math.random() * 7)); dome.position.set(p.x, (p.y || 0) + R * 0.42, p.z); dome.scale.setScalar(0.2 * R);
  const ring = new THREE.Mesh(G.torus, mkxBasic(0x7fe8c8, 0.4, true)); ring.rotation.x = Math.PI / 2; ring.scale.setScalar(R); ring.position.set(p.x, (p.y || 0) + 0.1, p.z);
  return mkxFx(ttl, [dome, ring], (dt, age) => { const g = Math.min(1, age / 0.4), die = Math.max(0, (age - (ttl - 0.7)) / 0.7);
    const s = R * (0.2 + 0.8 * (1 - Math.pow(1 - g, 3))) * (1 - die * 0.4);
    dome.scale.setScalar(Math.max(0.01, s)); dome.material.uniforms.uP.value = die; dome.rotation.y += dt * 0.12;
    ring.material.opacity = 0.4 * g * (1 - die); ring.scale.setScalar(Math.max(0.01, s)); }); } catch (e) { try { window.mkxErr = String(e && e.stack || e).slice(0, 300); xE(e); } catch (e2) {} return null; } }
// Bassquake: golden ring builds at the caster, then huge amber sound-wave arcs sweep down the cone (wiki clip)
function mkxBassquake(o, d, dist) { try { const G = mkxGeos(), D = dist || 40, dir = new THREE.Vector3(d.x, d.y || 0, d.z).normalize(), origin = new THREE.Vector3(o.x, o.y, o.z);
  const WIND = 0.6, TRAVEL = 1.0, N = 6, yaw = Math.atan2(dir.x, dir.z);
  const build = new THREE.Mesh(G.torus, mkxBasic(0xffc85a, 0.9, true)); build.position.copy(origin); build.position.y = Math.max(1.0, origin.y); build.rotation.y = yaw; build.scale.setScalar(2.2);
  const grp = new THREE.Group(); scene.add(grp);
  const arcs = [];
  const fx = mkxFx(WIND + TRAVEL + 0.5, [build], (dt, age) => {
    if (age < WIND) { const g = age / WIND; build.scale.setScalar(2.2 - g * 1.7); build.material.opacity = 0.9 * (0.5 + 0.5 * g); build.rotation.z += dt * 6; return; }
    build.visible = false;
    const bt = age - WIND;
    for (let i = 0; i < N; i++) { if (!arcs[i] && bt >= i * (TRAVEL / N)) {
      const a = new THREE.Mesh(G.torus, mkxMat("wave", mkxWAVE, i)); a.scale.setScalar(0.5); a.rotation.y = yaw; grp.add(a);
      arcs[i] = { m: a, t: 0 }; } }
    arcs.forEach((o2) => { if (!o2) return; o2.t += dt; const k = Math.min(1, o2.t / TRAVEL), s = 0.5 + k * D * 0.5;
      o2.m.scale.setScalar(s); o2.m.position.copy(origin).addScaledVector(dir, k * D * 0.55); o2.m.position.y = Math.max(0.9, origin.y);
      o2.m.material.uniforms.uP.value = k; }); },
  function () { try { scene.remove(build); scene.remove(grp); mkxDispose(build); mkxDispose(grp); } catch (e) {} });
  fx.fx.objs.push(grp); return fx; } catch (e) { try { window.mkxErr = String(e && e.stack || e).slice(0, 300); xE(e); } catch (e2) {} return null; } }
function mkxReset() { while (mkxLive.length) mkxEnd({ fx: mkxLive[0] }); document.querySelectorAll(".mkxV").forEach((e) => e.remove()); }
// ---- END MIKS FX ----
