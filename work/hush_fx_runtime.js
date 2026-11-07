// ---- HUSH FX ----
// Hush ability visuals, reference-grounded in the wiki showcase clips viewed 2026-11-04
// (wiki.playvalorant.com/en-us/images/Flow_Showcase.mp4, Flashbulb_Showcase.mp4,
// Displacement_Showcase.mp4, Suspension_Showcase.mp4; ability pages /Flow, /Flashbulb,
// /Displacement, /Suspension). Procedural approximation, not extracted game assets.
//   Flow: purple launch pad ring + chevron + rising motes at the anchor, burst on propel.
//   Flashbulb: purple orb arcs out, pops into a bright magenta star flash + pink haze.
//   Displacement: a glowing purple dice tumbles through the air, lands, and a swirl of purple
//     motes spirals inward as the pull fires.
//   Suspension: a magenta X-star projectile with a trail; on impact a purple mist dome and a
//     crystalline ground web linger while the target is levitated.
// Pure client fx: damage, timing and sound stay in the caller. Self-cleaning via the shared tick.
// Globals used (read-only): THREE, scene, camera, player, xE.
//
// Contract (integrator owns wiring):
//   Entries take world positions (THREE.Vector3 or {x,y,z}) and return a handle {fx, end()} or null on error.
//   h.end() stops the effect early; per-effect materials and geometries are disposed recursively.
//   hushxEnd(h) same. hushxReset() ends everything (round reset).
//   hushxUseGameTick() then hushxTick(dt) drives all effects with the game dt; otherwise a rAF pump runs
//   while effects exist (client dt caps apply there, not wall time).
//   hushxSuspension(o, d, opts): o muzzle, d unit direction, opts {speed=12, travelT} - pass travelT when the
//   server already resolved the hit; otherwise end() triggers the burst where the projectile is.
var hushxU = { value: 0 }, hushxLive = [], hushxPumpOn = false, hushxGT = null, hushxGeo = null, hushxProg = {};
function hushxNow() { try { return performance.now() / 1000; } catch (e) { return Date.now() / 1000; } }
function hushxGeos() { if (hushxGeo) return hushxGeo; hushxGeo = {
  sph: new THREE.SphereGeometry(1, 20, 14),
  ring: new THREE.RingGeometry(0.85, 1, 40),
  plane: new THREE.PlaneGeometry(1, 1),
  box: new THREE.BoxGeometry(1, 1, 1) }; return hushxGeo; }
function hushxShader(k, frag, opts) { if (hushxProg[k]) return hushxProg[k]; const m = new THREE.ShaderMaterial(Object.assign({
  uniforms: { uT: hushxU, uP: { value: 0 }, uSeed: { value: 0 }, uA: { value: 1 } },
  vertexShader: "uniform float uT;uniform float uP;uniform float uSeed;varying vec3 vN;varying vec3 vV;varying vec3 vP;varying vec2 vUv;void main(){vUv=uv;vP=position;vec4 mv=modelViewMatrix*vec4(position,1.0);vV=-mv.xyz;vN=normalMatrix*normal;gl_Position=projectionMatrix*mv;}",
  fragmentShader: frag, transparent: true, depthWrite: false, side: THREE.DoubleSide }, opts || {}));
  m.userData.hushx = k; hushxProg[k] = m; return m; }
// purple mist dome (Suspension landing)
const hushxMIST = "uniform float uT;uniform float uP;uniform float uSeed;uniform float uA;varying vec3 vN;varying vec3 vV;varying vec3 vP;varying vec2 vUv;\n" +
  "void main(){float f=pow(1.0-abs(dot(normalize(vN),normalize(vV))),1.6);\n" +
  "float w=sin(vP.x*4.0+uT*2.0+uSeed)*sin(vP.z*3.0-uT*1.5)*0.5+0.5;\n" +
  "vec3 c=mix(vec3(0.62,0.10,0.62),vec3(0.95,0.35,0.95),f)+vec3(0.4,0.05,0.35)*w*0.3;\n" +
  "float a=(0.14+0.38*f)*(0.8+0.2*w)*uA;\n" +
  "if(a<0.004)discard;gl_FragColor=vec4(c,a);}";
// smooth transparent hemisphere (Suspension landing): glossy magenta dome, bright rim, subtle sheen
const hushxGLASS = "uniform float uT;uniform float uP;uniform float uSeed;uniform float uA;varying vec3 vN;varying vec3 vV;varying vec3 vP;varying vec2 vUv;\n" +
  "void main(){float f=pow(1.0-abs(dot(normalize(vN),normalize(vV))),2.2);\n" +
  "float ang=atan(vP.x,vP.z);\n" +
  "float seam=smoothstep(0.72,0.98,sin(ang*9.0+uSeed*6.0)*0.5+0.5);\n" +
  "float band=0.5+0.5*sin(vP.y*9.0-uT*2.2+sin(ang*5.0+uT*0.8)*2.2);\n" +
  "float band2=0.5+0.5*sin(vP.y*17.0+uT*3.1+ang*3.0);\n" +
  "vec3 c=mix(vec3(0.55,0.05,0.45),vec3(1.0,0.40,0.85),f);\n" +
  "c+=vec3(0.30,0.08,0.25)*band*band2;\n" +
  "c+=vec3(0.9,0.5,1.0)*seam*0.35;\n" +
  "float a=(0.22+0.55*f+0.06*band*band2+0.14*seam)*uA;\n" +
  "if(a<0.004)discard;gl_FragColor=vec4(c,a);}";
// fine enclosing arc field (Displacement burst): partial striated arc segments on ring uv
const hushxFIELD = "uniform float uT;uniform float uP;uniform float uSeed;uniform float uA;varying vec3 vN;varying vec3 vV;varying vec3 vP;varying vec2 vUv;\n" +
  "void main(){vec2 p=vUv*2.0-1.0;float ang=atan(p.y,p.x);\n" +
  "float win=smoothstep(0.05,0.45,sin(ang*2.0+uSeed*6.0+uT*0.9));\n" +
  "float striate=0.55+0.45*sin(ang*36.0-uT*2.6+uSeed*9.0);\n" +
  "vec3 c=mix(vec3(0.60,0.16,0.90),vec3(1.0,0.50,1.0),striate);\n" +
  "float a=win*striate*uA*(1.0-uP);\n" +
  "if(a<0.004)discard;gl_FragColor=vec4(c,a);}";
// radial ground core glow (Displacement burst center)
const hushxGLOW = "uniform float uT;uniform float uP;uniform float uSeed;uniform float uA;varying vec3 vN;varying vec3 vV;varying vec3 vP;varying vec2 vUv;\n" +
  "void main(){vec2 p=vUv*2.0-1.0;float r=length(p);\n" +
  "float g=1.0-smoothstep(0.0,1.0,r);\n" +
  "vec3 c=mix(vec3(0.55,0.10,0.70),vec3(1.0,0.55,0.95),g*g);\n" +
  "float a=g*g*uA*(1.0-uP);\n" +
  "if(a<0.004)discard;gl_FragColor=vec4(c,a);}";
// vertical curling energy stream (Displacement burst)
const hushxCURL = "uniform float uT;uniform float uP;uniform float uSeed;uniform float uA;varying vec3 vN;varying vec3 vV;varying vec3 vP;varying vec2 vUv;\n" +
  "void main(){float x=vUv.x,y=vUv.y;\n" +
  "float wob=0.5+0.28*sin(y*5.0+uT*2.6+uSeed*5.0)+0.12*sin(y*11.0-uT*4.0);\n" +
  "float d=abs(x-wob);float core=1.0-smoothstep(0.0,0.05,d);float band=1.0-smoothstep(0.03,0.22,d);\n" +
  "float ends=smoothstep(0.0,0.15,y)*(1.0-smoothstep(0.75,1.0,y));\n" +
  "vec3 c=vec3(0.75,0.15,0.85)*band+vec3(1.0,0.6,1.0)*core;\n" +
  "float a=(band*0.55+core)*ends*uA;\n" +
  "if(a<0.004)discard;gl_FragColor=vec4(c,a);}";
function hushxMat(k, shader, seed, opts) { const m = hushxShader(k, shader, opts).clone(); m.uniforms.uT = hushxU; if (seed !== undefined) m.uniforms.uSeed.value = seed; return m; }
function hushxBasic(c, o, add) { return new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: o, depthWrite: false, blending: add ? THREE.AdditiveBlending : THREE.NormalBlending, side: THREE.DoubleSide }); }
function hushxPush(fx) { if (hushxLive.length > 24) { const o = hushxLive.shift(); try { o.done(); } catch (e) {} } hushxLive.push(fx); if (!hushxGT && !hushxPumpOn) { hushxPumpOn = true; hushxPump.last = hushxNow(); requestAnimationFrame(hushxPump); } return fx; }
function hushxPump() { if (hushxGT) { hushxPumpOn = false; return; } const now = hushxNow(), dt = Math.min(0.1, Math.max(0.0005, now - (hushxPump.last || now))); hushxPump.last = now; hushxU.value += dt;
  for (let i = hushxLive.length - 1; i >= 0; i--) { const fx = hushxLive[i]; fx.age += dt; try { fx.tick(dt, fx.age, Math.min(1, fx.age / fx.ttl)); } catch (e) { try { xE(e); } catch (e2) {} }
    if (fx.age >= fx.ttl) { try { fx.done(); } catch (e) {} hushxLive.splice(i, 1); } }
  if (hushxLive.length) requestAnimationFrame(hushxPump); else hushxPumpOn = false; }
function hushxUseGameTick() { hushxGT = true; hushxPumpOn = false; }
function hushxTick(dt) { hushxU.value += dt; for (let i = hushxLive.length - 1; i >= 0; i--) { const fx = hushxLive[i]; fx.age += dt; try { fx.tick(dt, fx.age, Math.min(1, fx.age / fx.ttl)); } catch (e) { try { xE(e); } catch (e2) {} } if (fx.age >= fx.ttl) { try { fx.done(); } catch (e) {} hushxLive.splice(i, 1); } } }
function hushxEnd(h) { if (!h || !h.fx) return; const i = hushxLive.indexOf(h.fx); if (i >= 0) hushxLive.splice(i, 1); try { h.fx.done(); } catch (e) {} }
function hushxFx(ttl, objs, tick, done, geos) { const fx = { age: 0, ttl, objs, tick, done: done || function () { objs.forEach((o) => { try { scene.remove(o); o.traverse((m) => { if (m.material && m.material.dispose) m.material.dispose(); }); } catch (e) {} }); if (geos) geos.forEach((g) => { try { g.dispose(); } catch (e) {} }); } }; objs.forEach((o) => scene.add(o)); hushxPush(fx); return { fx, end: function () { hushxEnd(this); } }; }
function hushxV3(p) { return p && p.isVector3 ? p : new THREE.Vector3(p.x || 0, p.y || 0, p.z || 0); }
// ---- Flow: launch pad ring + chevron + rising motes, burst on propel ----
function hushxFlow(p, opts) { try { const G = hushxGeos(); opts = opts || {};
  const at = hushxV3(p); const delay = opts.delay == null ? 1.1 : opts.delay;
  const grp = new THREE.Group(); grp.position.set(at.x, 0, at.z);
  const ring = new THREE.Mesh(G.ring, hushxBasic(0xb04ae8, 0.8, true)); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.06; ring.scale.setScalar(0.01); grp.add(ring);
  const chevGeo = new THREE.PlaneGeometry(0.8, 0.8);
  const chev = new THREE.Mesh(chevGeo, hushxBasic(0xe8ff4a, 0.0, true)); chev.rotation.x = -Math.PI / 2; chev.position.y = 0.1; chev.scale.set(0.5, 0.5, 1); grp.add(chev);
  const motes = []; for (let i = 0; i < 8; i++) { const m = new THREE.Mesh(G.sph, hushxBasic(0xd08aff, 0.85, true)); m.scale.setScalar(0.03); grp.add(m); motes.push(m); }
  return hushxFx(delay + 0.9, [grp], (dt, age) => {
    const armed = age >= delay;
    const swell = Math.min(1, age / 0.25);
    ring.scale.setScalar(1.15 * (0.2 + 0.8 * (1 - Math.pow(1 - swell, 3))));
    ring.material.opacity = armed ? 0.8 * Math.max(0, 1 - (age - delay) / 0.5) : 0.55 + 0.25 * Math.sin(hushxU.value * 5);
    chev.material.opacity = armed ? Math.max(0, 0.9 - (age - delay) * 1.4) : 0.35 + 0.3 * Math.sin(hushxU.value * 4);
    chev.position.y = 0.1 + (armed ? (age - delay) * 2.2 : 0);
    motes.forEach((m, i) => { const u = (hushxU.value * (armed ? 1.1 : 0.4) + i / 8) % 1, a = i * 0.785 + u * 2.2;
      m.position.set(Math.cos(a) * (0.9 - u * 0.4), 0.1 + u * (armed ? 2.4 : 1.0), Math.sin(a) * (0.9 - u * 0.4));
      m.material.opacity = 0.85 * (1 - u) * (armed ? Math.max(0, 1 - (age - delay) / 0.7) : 1); });
  }, undefined, [chevGeo]); } catch (e) { try { window.hushxErr = String(e && e.stack || e).slice(0, 300); xE(e); } catch (e2) {} return null; } }
// ---- Flashbulb: orb arc -> magenta star flash + pink haze ----
function hushxFlashbulb(o, p, opts) { try { const G = hushxGeos(); opts = opts || {};
  const from = hushxV3(o), to = hushxV3(p), flyT = opts.flyT || 0.45, pop = 0.55;
  // dark mechanical flash pod (reference: dark armored shell segments caging a bright magenta core, dark smoke trail)
  const orb = new THREE.Group();
  const core = new THREE.Mesh(G.sph, hushxBasic(0xff2ad8, 1.0, true)); core.scale.setScalar(0.085); orb.add(core);
  const bodyGeo = new THREE.IcosahedronGeometry(0.145, 0);
  const body = new THREE.Mesh(bodyGeo, new THREE.MeshBasicMaterial({ color: 0x18101f })); body.scale.set(1.0, 1.4, 1.0); orb.add(body);
  const shell = new THREE.Mesh(G.sph, hushxBasic(0xe82ac8, 0.08, true)); shell.scale.setScalar(0.17); orb.add(shell);
  const spikes = []; for (let i = 0; i < 6; i++) { const sp = new THREE.Mesh(G.box, new THREE.MeshBasicMaterial({ color: 0x241430 }));
    sp.scale.set(0.06, 0.26, 0.02); const an = i * Math.PI / 3; sp.position.set(Math.cos(an) * 0.16, (i % 2 ? 0.05 : -0.04), Math.sin(an) * 0.16); sp.rotation.z = an + 0.5; sp.rotation.x = (i % 2 ? 0.35 : -0.35); orb.add(sp); spikes.push(sp); }
  const smoke = [];
  const star = new THREE.Group(); star.position.copy(to); star.visible = false;
  const starGeo = new THREE.PlaneGeometry(1, 1);
  const rays = []; for (let i = 0; i < 8; i++) { const r = new THREE.Mesh(starGeo, hushxBasic(i % 2 ? 0xff4ad8 : 0xff9af0, 0.9, true));
    r.scale.set(1.7 - (i % 4) * 0.22, 0.07 + (i % 4) * 0.015, 1); r.rotation.z = i * Math.PI / 8; star.add(r); rays.push(r); }
  const flash = new THREE.Mesh(G.sph, hushxBasic(0xff9ae0, 0.9, true)); flash.scale.setScalar(0.12); star.add(flash);
  const haze = new THREE.Mesh(G.sph, hushxBasic(0xd018b0, 0.24, true)); haze.scale.setScalar(0.4); star.add(haze);
  const fpoolGeo = new THREE.CircleGeometry(0.5, 24); const fpool = new THREE.Mesh(fpoolGeo, hushxBasic(0x7a1ac8, 0.6, false)); fpool.rotation.x = -Math.PI / 2; fpool.position.y = 0.06 - to.y; fpool.scale.setScalar(0.01); star.add(fpool); // pin pool to ground plane below the aerial pop
  const fx = hushxFx(flyT + 1.8, [orb, star], (dt, age) => {
    if (age < flyT) { const k = age / flyT; orb.position.lerpVectors(from, to, k); orb.position.y += Math.sin(k * Math.PI) * 0.8; orb.rotation.y += dt * 9; spikes.forEach((sp, i) => sp.rotation.x += dt * (5 + i));
      if (age - (orb.userData.lt || 0) > 0.03) { orb.userData.lt = age; const p = new THREE.Mesh(G.sph, hushxBasic(0x2a1040, 0.55, false)); p.scale.setScalar(0.06); p.position.copy(orb.position); scene.add(p); fx.fx.objs.push(p); smoke.push({ m: p, a: 0 }); }
      for (let i = smoke.length - 1; i >= 0; i--) { const p = smoke[i]; p.a += dt; p.m.material.opacity = 0.55 * Math.max(0, 1 - p.a / 0.4); p.m.scale.setScalar(0.06 + p.a * 0.12); if (p.a > 0.4) { scene.remove(p.m); p.m.material.dispose(); smoke.splice(i, 1); } }
      return; }
    if (orb.visible) { orb.visible = false; star.visible = true; }
    const ba = age - flyT, k = Math.min(1, ba / pop);
    star.quaternion.copy(camera.quaternion);
    rays.forEach((r, i) => { const s = (1.7 - (i % 4) * 0.22) * (0.4 + k * 2.4); r.scale.set(s, (0.07 + (i % 4) * 0.015) * (1 - k * 0.4), 1); r.material.opacity = Math.max(0, 1 - k * 1.05); });
    const k2 = Math.min(1, ba / 1.6); fpool.scale.setScalar(0.2 + Math.min(1, ba / 0.4) * 2.6); fpool.material.opacity = 0.6 * (1 - k2 * k2);
    flash.scale.setScalar(0.12 + k * 0.65); flash.material.opacity = 0.9 * Math.max(0, 1 - k * 1.5);
    haze.scale.setScalar(0.4 + k * 2.4); haze.material.opacity = 0.3 * (1 - k);
  }, undefined, [starGeo, bodyGeo, fpoolGeo]);
  return fx; } catch (e) { try { window.hushxErr = String(e && e.stack || e).slice(0, 300); xE(e); } catch (e2) {} return null; } }
// ---- Displacement: tumbling purple dice -> inward pull swirl ----
function hushxDisplacement(o, p, opts) { try { const G = hushxGeos(); opts = opts || {};
  const from = hushxV3(o), to = hushxV3(p), flyT = opts.flyT || 0.4, delay = opts.delay == null ? 1 : opts.delay;
  const dice = new THREE.Group();
  const bodyGeo = new THREE.BoxGeometry(0.38, 0.38, 0.38);
  const body = new THREE.Mesh(bodyGeo, new THREE.MeshBasicMaterial({ color: 0x1c0b2e })); dice.add(body);
  const edgeGeo = new THREE.EdgesGeometry(bodyGeo);
  const edges = new THREE.LineSegments(edgeGeo, new THREE.LineBasicMaterial({ color: 0xff4ad8, transparent: true, opacity: 0.95 })); dice.add(edges);
  // glowing rune marks on each face
  const runes = []; for (let i = 0; i < 6; i++) { const r = new THREE.Mesh(G.plane, hushxBasic(i % 2 ? 0xff4ad8 : 0xd06aff, 0.9, true)); r.scale.set(0.16, 0.045, 1);
    const f = i >> 1, sgn = i % 2 ? 1 : -1;
    if (f === 0) { r.position.set(sgn * 0.196, 0, 0); r.rotation.y = sgn * Math.PI / 2; }
    else if (f === 1) { r.position.set(0, sgn * 0.196, 0); r.rotation.x = -sgn * Math.PI / 2; }
    else { r.position.set(0, 0, sgn * 0.196); r.rotation.y = sgn < 0 ? Math.PI : 0; }
    r.rotation.z = (i * 1.3) % Math.PI; dice.add(r); runes.push(r); }
  const glowGeo = new THREE.SphereGeometry(0.42, 16, 12);
  const glow = new THREE.Mesh(glowGeo, hushxBasic(0xd04aff, 0.35, true)); dice.add(glow);
  const pip = new THREE.Mesh(G.sph, hushxBasic(0xff4ad8, 0.9, true)); pip.scale.setScalar(0.05); pip.position.set(0, 0.14, 0); dice.add(pip);
  const swirl = new THREE.Group(); swirl.position.copy(to); swirl.visible = false;
  const motes = []; for (let i = 0; i < 16; i++) { const m = new THREE.Mesh(G.sph, hushxBasic(i % 2 ? 0xd06aff : 0x9a3ae8, 0.95, true)); m.scale.setScalar(0.05); swirl.add(m); motes.push(m); }
  const arcGeo = new THREE.RingGeometry(0.94, 1, 64);
  const waves = []; for (let i = 0; i < 3; i++) { const w = new THREE.Mesh(arcGeo, hushxMat("field", hushxFIELD, i * 2.3)); w.rotation.x = -Math.PI / 2 + 1.15 + i * 0.12; w.rotation.y = i * 2.1; w.position.y = 0.4; swirl.add(w); waves.push(w); }
  const coreGlowGeo = new THREE.CircleGeometry(1, 28);
  const coreGlow = new THREE.Mesh(coreGlowGeo, hushxMat("glow", hushxGLOW, 3.1)); coreGlow.rotation.x = -Math.PI / 2; coreGlow.position.y = 0.08; swirl.add(coreGlow);
  // curling vertical energy streams rising around the pull point (reference: tall magenta curl streams)
  const curls = []; for (let i = 0; i < 6; i++) { const c = new THREE.Mesh(G.plane, hushxMat("curl", hushxCURL, i * 1.7)); c.scale.set(1.0, 3.4, 1);
    const a = i / 6 * Math.PI * 2; c.position.set(Math.cos(a) * 3.4, 1.7, Math.sin(a) * 3.4); c.rotation.y = -a + Math.PI / 2; swirl.add(c); curls.push(c); }
  const pool = new THREE.Mesh(G.ring, hushxBasic(0x8a2ad8, 0.5, true)); pool.rotation.x = -Math.PI / 2; pool.position.y = 0.06; pool.scale.setScalar(0.01); swirl.add(pool);
  return hushxFx(flyT + delay + 0.5, [dice, swirl], (dt, age) => {
    if (age < flyT) { const k = age / flyT; dice.position.lerpVectors(from, to, k); dice.position.y += Math.sin(k * Math.PI) * 1.1;
      dice.rotation.x += dt * 7; dice.rotation.z += dt * 5; return; }
    const ba = age - flyT;
    if (ba < delay) { if (swirl.visible) swirl.visible = false; dice.visible = true;
      dice.position.copy(to); dice.position.y = 0.12; dice.rotation.x += dt * 2.5; dice.rotation.y += dt * 1.8;
      glow.material.opacity = 0.35 + 0.2 * Math.sin(hushxU.value * 6); runes.forEach((r, i) => r.material.opacity = 0.7 + 0.3 * Math.sin(hushxU.value * 5 + i)); return; }
    if (dice.visible) { dice.visible = false; swirl.visible = true; }
    const k = Math.min(1, (ba - delay) / 0.5);
    pool.scale.setScalar(5 * (0.3 + 0.7 * k)); pool.material.opacity = 0.5 * (1 - k);
    motes.forEach((m, i) => { const u = (hushxU.value * 1.3 + i / 16) % 1, a = i * 0.39 + u * 7.0, r = 5.0 * (1 - u);
      m.position.set(Math.cos(a) * r, 0.15 + u * 1.6, Math.sin(a) * r); m.material.opacity = 0.95 * (1 - k) * (1 - u * 0.5); });
    waves.forEach((w, i) => { const u = ((ba - delay) * 1.1 + i * 0.33) % 1; w.scale.setScalar(0.5 + u * 7.5); w.material.opacity = 0.9 * (1 - u * 0.85) * (1 - k); w.rotation.z += dt * (0.6 + i * 0.25); });
    coreGlow.material.uniforms.uA.value = (1 - k) * 0.9; coreGlow.scale.setScalar(0.8 + k * 2.2);
    curls.forEach((c, i) => { c.material.uniforms.uP.value = 1 - (1 - k); c.material.uniforms.uA.value = (1 - k) * (0.6 + 0.4 * Math.sin(hushxU.value * 3 + i * 2)); c.rotation.y += dt * 0.7; c.position.y = 1.7 + 0.3 * Math.sin(hushxU.value * 2 + i); });
  }, undefined, [bodyGeo, edgeGeo, glowGeo, arcGeo, coreGlowGeo]); } catch (e) { try { window.hushxErr = String(e && e.stack || e).slice(0, 300); xE(e); } catch (e2) {} return null; } }
// ---- Suspension: X-star projectile -> mist dome + ground web ----
function hushxSuspension(o, d, opts) { try { const G = hushxGeos(); opts = opts || {};
  const from = hushxV3(o), dir = hushxV3(d).normalize(), speed = opts.speed || 12, maxT = opts.travelT == null ? 4 : opts.travelT;
  const star = new THREE.Group(); star.position.copy(from);
  const starGeo = new THREE.PlaneGeometry(1, 1);
  const r1 = new THREE.Mesh(starGeo, hushxBasic(0xe82ac8, 0.95, false)); r1.scale.set(0.55, 0.08, 1); r1.rotation.z = Math.PI / 4; star.add(r1);
  const r2 = new THREE.Mesh(starGeo, hushxBasic(0xe82ac8, 0.95, false)); r2.scale.set(0.55, 0.08, 1); r2.rotation.z = -Math.PI / 4; star.add(r2);
  const core = new THREE.Mesh(G.sph, hushxBasic(0xff9ae0, 0.95, true)); core.scale.setScalar(0.09); star.add(core);
  const corona = new THREE.Mesh(G.sph, hushxBasic(0xb04ae8, 0.5, true)); corona.scale.setScalar(0.17); star.add(corona);
  const trail = []; for (let i = 0; i < 6; i++) { const t = new THREE.Mesh(G.sph, hushxBasic(0xc04aff, 0.5, true)); t.scale.setScalar(0.045); scene.add(t); trail.push(t); }
  const field = new THREE.Group(); field.visible = false;
  const domeGeo = new THREE.SphereGeometry(1, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2);
  const dome = new THREE.Mesh(domeGeo, hushxMat("glass", hushxGLASS, Math.random() * 10)); dome.scale.setScalar(0.01); field.add(dome);
  const webGeo = new THREE.RingGeometry(0.2, 1, 6, 1);
  const web = new THREE.Mesh(webGeo, hushxBasic(0x8a2ad8, 0.35, false)); web.rotation.x = -Math.PI / 2; web.position.y = 0.06; web.scale.setScalar(0.01); field.add(web);
  const shards = []; for (let i = 0; i < 6; i++) { const s = new THREE.Mesh(G.box, hushxBasic(0xb04ae8, 0.8, true)); s.scale.set(0.05, 0.22, 0.05); field.add(s); shards.push(s); }
  let burstAt = -1, landed = null;
  const handle = hushxFx(maxT + 2.4, [star, field].concat(trail), (dt, age) => {
    if (burstAt < 0) { star.position.addScaledVector(dir, speed * dt); star.quaternion.copy(camera.quaternion);
      core.scale.setScalar(0.09 + 0.02 * Math.sin(hushxU.value * 14)); corona.material.opacity = 0.5 + 0.15 * Math.sin(hushxU.value * 9);
      trail.forEach((t, i) => { const k = (i + 1) / 7; t.position.copy(star.position).addScaledVector(dir, -k * 1.1); t.material.opacity = 0.5 * (1 - k); t.scale.setScalar(0.045 * (1 - k * 0.6)); });
      if (age >= maxT) handle.fx.endBurst(); return; }
    const ba = age - burstAt, k = Math.min(1, ba / 2.2);
    if (star.visible) { star.visible = false; trail.forEach((t) => t.visible = false); field.visible = true; field.position.copy(landed); }
    const swell = Math.min(1, ba / 0.3), hold = ba < 1.6 ? 1 : Math.max(0, 1 - (ba - 1.6) / 0.6);
    dome.scale.set(3.4 * (0.2 + 0.8 * swell), 2.7 * (0.2 + 0.8 * swell), 3.4 * (0.2 + 0.8 * swell));
    dome.material.uniforms.uA.value = hold;
    web.scale.setScalar(3 * (0.2 + 0.8 * swell)); web.material.opacity = 0.35 * hold;
    shards.forEach((s, i) => { const a = i * 1.05 + hushxU.value * 0.8, r = 1.6 + Math.sin(hushxU.value + i) * 0.3;
      s.position.set(Math.cos(a) * r, 0.6 + Math.sin(hushxU.value * 1.4 + i * 2) * 0.5, Math.sin(a) * r); s.rotation.y += dt * 2;
      s.material.opacity = 0.8 * hold; });
  }, undefined, [starGeo, domeGeo, webGeo]);
  handle.fx.endBurst = function () { if (burstAt < 0) { burstAt = handle.fx.age; landed = star.position.clone(); landed.y = 0; } };
  /* handle end() = the projectile hit something: detonate where it is and let the burst finish. */
  return { fx: handle.fx, end: function () { handle.fx.endBurst(); } };
  } catch (e) { try { window.hushxErr = String(e && e.stack || e).slice(0, 300); xE(e); } catch (e2) {} return null; } }
// First-person blind overlay: full-screen magenta starburst + white flash for a FLASHED VICTIM's client only.
// The server decides who is flashed; call this on that client (never as a world-space effect).
const hushxBLIND = "uniform float uT;uniform float uP;uniform float uSeed;uniform float uA;varying vec3 vN;varying vec3 vV;varying vec3 vP;varying vec2 vUv;\n" +
  "void main(){vec2 c=vUv-0.5;float r=length(c)*2.0;float a0=atan(c.y,c.x);\n" +
  "float rays=0.5+0.5*sin(a0*10.0+uSeed*7.0+uT*2.0);\n" +
  "float star=pow(rays,3.0)*(1.0-smoothstep(0.0,1.35,r));\n" +
  "float core=1.0-smoothstep(0.0,0.75,r);\n" +
  "vec3 col=vec3(0.30,0.015,0.27)+vec3(1.0,0.30,0.85)*star*1.1+vec3(1.0,0.85,1.0)*core*core;\n" +
  "float a=(0.95+0.05*core)*uA*(1.0-uP);\n" +
  "if(a<0.004)discard;gl_FragColor=vec4(col,a);}";
function hushxBlindOverlay(seconds) { try {
  const ttl = Math.max(0.3, seconds || 1.6);
  const geo = new THREE.PlaneGeometry(2.4, 2.4);
  const m = new THREE.Mesh(geo, hushxMat("blind", hushxBLIND, Math.random() * 10, { depthTest: false }));
  m.position.set(0, 0, -0.7); m.renderOrder = 999;
  camera.add(m); if (!camera.parent) scene.add(camera);
  const fx = { age: 0, ttl, objs: [], tick: function (dt, age) { m.material.uniforms.uP.value = Math.min(1, age / ttl); m.material.uniforms.uA.value = age < 0.08 ? age / 0.08 : 1; },
    done: function () { try { camera.remove(m); m.material.dispose(); geo.dispose(); } catch (e) {} } };
  hushxPush(fx);
  return { fx, end: function () { hushxEnd(this); } }; } catch (e) { try { window.hushxErr = String(e && e.stack || e).slice(0, 300); xE(e); } catch (e2) {} return null; } }
// ---- round reset / cancel hook ----
function hushxReset() { while (hushxLive.length) hushxEnd({ fx: hushxLive[0] }); }
// ---- END HUSH FX ----
