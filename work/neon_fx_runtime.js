// ---- NEON FX ----
// Neon ability visuals, reference-grounded in the wiki showcase clips viewed 2026-11-04
// (wiki.playvalorant.com/en-us/images/Fast_Lane_Showcase.mp4, Relay_Bolt_Showcase.mp4,
// High_Gear_Showcase.mp4, Overdrive_Showcase.mp4; ability pages /Fast_Lane, /Relay_Bolt,
// /High_Gear, /Overdrive). Procedural approximation, not extracted game assets.
//   Fast Lane: two parallel tall walls of blue flame with a yellow-gold base, running forward.
//   Relay Bolt: cyan electric bolt, yellow-green concussive dome burst with jagged blue arcs.
//   High Gear: blue lightning crackle around Neon + fading cyan trail streaks on the ground.
//   Overdrive: activation electric burst; per-shot jagged finger-lightning beam (white core, blue arcs).
// Pure client fx: damage, timing and sound stay in the caller. Self-cleaning via the shared tick.
// Globals used (read-only): THREE, scene, camera, player, xE.
//
// Contract (integrator owns wiring):
//   Entries take world positions (THREE.Vector3 or {x,y,z}) and return a handle {fx, end()} or null on error.
//   h.end() stops the effect early; per-effect materials and geometries are disposed recursively.
//   neoxEnd(h) same. neoxReset() ends everything (round reset).
//   neoxUseGameTick() then neoxTick(dt) drives all effects with the game dt; otherwise a rAF pump runs
//   while effects exist (client dt caps apply there, not wall time).
var neoxU = { value: 0 }, neoxLive = [], neoxPumpOn = false, neoxGT = null, neoxGeo = null, neoxProg = {};
function neoxNow() { try { return performance.now() / 1000; } catch (e) { return Date.now() / 1000; } }
function neoxGeos() { if (neoxGeo) return neoxGeo; neoxGeo = {
  sph: new THREE.SphereGeometry(1, 24, 16),
  ring: new THREE.RingGeometry(0.9, 1, 48),
  plane: new THREE.PlaneGeometry(1, 1),
  box: new THREE.BoxGeometry(1, 1, 1),
  cyl: new THREE.CylinderGeometry(1, 1, 1, 12, 1, true) }; return neoxGeo; }
function neoxShader(k, frag, opts) { if (neoxProg[k]) return neoxProg[k]; const m = new THREE.ShaderMaterial(Object.assign({
  uniforms: { uT: neoxU, uP: { value: 0 }, uSeed: { value: 0 }, uA: { value: 1 } },
  vertexShader: "uniform float uT;uniform float uP;uniform float uSeed;varying vec3 vN;varying vec3 vV;varying vec3 vP;varying vec2 vUv;void main(){vUv=uv;vP=position;vec4 mv=modelViewMatrix*vec4(position,1.0);vV=-mv.xyz;vN=normalMatrix*normal;gl_Position=projectionMatrix*mv;}",
  fragmentShader: frag, transparent: true, depthWrite: false, side: THREE.DoubleSide }, opts || {}));
  m.userData.neox = k; neoxProg[k] = m; return m; }
// Fast Lane flame sheet: yellow-gold base rising into cyan body with a ragged flickering top edge
const neoxFLAME = "uniform float uT;uniform float uP;uniform float uSeed;uniform float uA;varying vec3 vN;varying vec3 vV;varying vec3 vP;varying vec2 vUv;\n" +
  "float h21(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}\n" +
  "float vn(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(h21(i),h21(i+vec2(1,0)),f.x),mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x),f.y);}\n" +
  "float fbm(vec2 p){float s=0.0,a=0.5;for(int i=0;i<4;i++){s+=a*vn(p);p*=2.03;a*=0.5;}return s;}\n" +
  "void main(){float x=vUv.x,y=vUv.y;\n" +
  "float top=0.58+0.36*fbm(vec2(x*7.0+uSeed*3.0,uT*0.7));\n" +
  "float body=1.0-smoothstep(top-0.16,top+0.02,y);\n" +
  "float vein=fbm(vec2(x*9.0+uSeed*5.0,y*3.5-uT*1.9));\n" +
  "float veinM=smoothstep(0.46,0.60,vein);\n" +
  "float lick=fbm(vec2(x*12.0+uSeed,y*2.0-uT*2.6));\n" +
  "float lickM=smoothstep(0.45,0.62,lick);\n" +
  "float base=1.0-smoothstep(0.0,0.26+0.16*lick,y);\n" +
  "vec3 c=mix(vec3(0.02,0.16,0.70),vec3(0.55,0.95,1.0),veinM);\n" +
  "c=mix(c,mix(vec3(1.0,0.68,0.06),vec3(0.72,1.0,0.20),lickM),base*(0.72+0.28*lickM));\n" +
  "c+=vec3(0.5,0.9,1.0)*pow(1.0-y,2.0)*0.18;\n" +
  "float wisp=smoothstep(top-0.30,top,y)*fbm(vec2(x*16.0,y*6.0-uT*3.0));\n" +
  "c+=vec3(0.4,0.8,1.0)*wisp*0.5;\n" +
  "float a=(body*(0.82+0.14*veinM))*uA*(1.0-uP);\n" +
  "if(a<0.004)discard;gl_FragColor=vec4(c,a);}";
// jagged electric arc, cyan core (Relay burst, gear crackle, beam)
const neoxARC = "uniform float uT;uniform float uP;uniform float uSeed;uniform float uA;varying vec3 vN;varying vec3 vV;varying vec3 vP;varying vec2 vUv;\n" +
  "void main(){float x=vUv.x,y=vUv.y;\n" +
  "float wob=0.5+0.17*sin(y*19.0+uSeed*9.0)+0.10*sin(y*43.0-uT*15.0);\n" +
  "float d=abs(x-wob);float core=1.0-smoothstep(0.0,0.04,d);float body=1.0-smoothstep(0.02,0.15,d);\n" +
  "float ends=smoothstep(0.0,0.08,y)*(1.0-smoothstep(0.88,1.0,y));\n" +
  "vec3 c=vec3(0.15,0.65,1.0)*body+vec3(0.92,1.0,1.0)*core;\n" +
  "float a=(body*0.7+core)*ends*uA*(1.0-uP);\n" +
  "if(a<0.004)discard;gl_FragColor=vec4(c,a);}";
// concuss dome: yellow-green flash with soft edge
const neoxDOME = "uniform float uT;uniform float uP;uniform float uSeed;uniform float uA;varying vec3 vN;varying vec3 vV;varying vec3 vP;varying vec2 vUv;\n" +
  "void main(){float f=pow(1.0-abs(dot(normalize(vN),normalize(vV))),1.3);\n" +
  "vec3 c=mix(vec3(0.30,0.75,1.0),vec3(0.15,0.55,1.0),f);\n" +
  "float a=(0.55-0.35*f)*uA*(1.0-uP);\n" +
  "if(a<0.004)discard;gl_FragColor=vec4(c,a);}";
function neoxMat(k, shader, seed, opts) { const m = neoxShader(k, shader, opts).clone(); m.uniforms.uT = neoxU; if (seed !== undefined) m.uniforms.uSeed.value = seed; return m; }
function neoxBasic(c, o, add) { return new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: o, depthWrite: false, blending: add ? THREE.AdditiveBlending : THREE.NormalBlending, side: THREE.DoubleSide }); }
function neoxPush(fx) { if (neoxLive.length > 24) { const o = neoxLive.shift(); try { o.done(); } catch (e) {} } neoxLive.push(fx); if (!neoxGT && !neoxPumpOn) { neoxPumpOn = true; neoxPump.last = neoxNow(); requestAnimationFrame(neoxPump); } return fx; }
function neoxPump() { if (neoxGT) { neoxPumpOn = false; return; } const now = neoxNow(), dt = Math.min(0.1, Math.max(0.0005, now - (neoxPump.last || now))); neoxPump.last = now; neoxU.value += dt;
  for (let i = neoxLive.length - 1; i >= 0; i--) { const fx = neoxLive[i]; fx.age += dt; try { fx.tick(dt, fx.age, Math.min(1, fx.age / fx.ttl)); } catch (e) { try { xE(e); } catch (e2) {} }
    if (fx.age >= fx.ttl) { try { fx.done(); } catch (e) {} neoxLive.splice(i, 1); } }
  if (neoxLive.length) requestAnimationFrame(neoxPump); else neoxPumpOn = false; }
function neoxUseGameTick() { neoxGT = true; neoxPumpOn = false; }
function neoxTick(dt) { neoxU.value += dt; for (let i = neoxLive.length - 1; i >= 0; i--) { const fx = neoxLive[i]; fx.age += dt; try { fx.tick(dt, fx.age, Math.min(1, fx.age / fx.ttl)); } catch (e) { try { xE(e); } catch (e2) {} } if (fx.age >= fx.ttl) { try { fx.done(); } catch (e) {} neoxLive.splice(i, 1); } } }
function neoxEnd(h) { if (!h || !h.fx) return; const i = neoxLive.indexOf(h.fx); if (i >= 0) neoxLive.splice(i, 1); try { h.fx.done(); } catch (e) {} }
function neoxFx(ttl, objs, tick, done, geos) { const fx = { age: 0, ttl, objs, tick, done: done || function () { objs.forEach((o) => { try { scene.remove(o); o.traverse((m) => { if (m.material && m.material.dispose) m.material.dispose(); }); } catch (e) {} }); if (geos) geos.forEach((g) => { try { g.dispose(); } catch (e) {} }); } }; objs.forEach((o) => scene.add(o)); neoxPush(fx); return { fx, end: function () { neoxEnd(this); } }; }
function neoxV3(p) { return p && p.isVector3 ? p : new THREE.Vector3(p.x || 0, p.y || 0, p.z || 0); }
function neoxNearPlayer(p, d) { try { return player && Math.hypot(player.x - p.x, player.z - p.z) < d; } catch (e) { return false; } }
// ---- Fast Lane: twin blue flame walls. o = cast point, yaw = cast yaw (rad), seconds = wall life ----
function neoxFastLane(o, yaw, seconds) { try { const G = neoxGeos();
  const LEN = 30, GAP = 3, H = 4.2, ttl = Math.max(0.6, seconds || 6);
  const dir = new THREE.Vector3(-Math.sin(yaw || 0), 0, -Math.cos(yaw || 0));
  const side = new THREE.Vector3(-dir.z, 0, dir.x);
  const origin = neoxV3(o); origin.y = 0;
  const grp = new THREE.Group();
  const geo = new THREE.PlaneGeometry(LEN, H);
  const walls = [];
  for (const s of [-1, 1]) {
    const w = new THREE.Mesh(geo, neoxMat("flame", neoxFLAME, s * 3.1 + 5));
    w.position.copy(origin).addScaledVector(dir, LEN / 2).addScaledVector(side, s * (GAP / 2 + 0.3));
    w.position.y = H / 2; w.rotation.y = Math.atan2(-dir.z, dir.x);
    grp.add(w); walls.push(w);
    const glow = new THREE.Mesh(G.plane, neoxBasic(0xffb02a, 0.5, true));
    glow.rotation.x = -Math.PI / 2; glow.rotation.z = Math.atan2(-dir.x, -dir.z);
    glow.scale.set(0.9, LEN, 1);
    glow.position.copy(origin).addScaledVector(dir, LEN / 2).addScaledVector(side, s * (GAP / 2 + 0.3)); glow.position.y = 0.06;
    grp.add(glow); }
  return neoxFx(ttl, [grp], (dt, age) => {
    const rise = Math.min(1, age / 0.35), die = Math.max(0, (age - (ttl - 0.5)) / 0.5);
    walls.forEach((w) => { w.scale.y = Math.max(0.03, rise); w.material.uniforms.uP.value = die; w.material.uniforms.uT = neoxU; });
    grp.children.forEach((m) => { if (m.geometry === G.plane) m.material.opacity = 0.4 * rise * (1 - die); });
  }, undefined, [geo]); } catch (e) { try { window.neoxErr = String(e && e.stack || e).slice(0, 300); xE(e); } catch (e2) {} return null; } }
// ---- Relay Bolt: bolt flight + concussive burst ----
function neoxRelayBolt(o, p, opts) { try { const G = neoxGeos(); opts = opts || {};
  const from = neoxV3(o), to = neoxV3(p), flyT = opts.flyT || 0.28, R = opts.radius || 4.5;
  const orb = new THREE.Group();
  const core = new THREE.Mesh(G.sph, neoxBasic(0xd8f8ff, 0.95, true)); core.scale.setScalar(0.1); orb.add(core);
  const shell = new THREE.Mesh(G.sph, neoxBasic(0x2a9aff, 0.5, true)); shell.scale.setScalar(0.22); orb.add(shell);
  const oArc = new THREE.Mesh(G.plane, neoxMat("arc", neoxARC, 1.7)); oArc.scale.set(0.55, 0.8, 1); orb.add(oArc);
  const dome = new THREE.Mesh(G.sph, neoxMat("dome", neoxDOME, 0)); dome.scale.set(0.01, 0.005, 0.01); dome.position.copy(to); dome.visible = false;
  const ring = new THREE.Mesh(G.ring, neoxBasic(0x7ae8ff, 0.85, true)); ring.rotation.x = -Math.PI / 2; ring.position.set(to.x, (to.y || 0) + 0.06, to.z); ring.scale.setScalar(0.01); ring.visible = false;
  const arcs = []; for (let i = 0; i < 7; i++) { const a = new THREE.Mesh(G.plane, neoxMat("arc", neoxARC, 3 + i * 1.9)); a.visible = false; arcs.push(a); }
  const sparks = []; for (let i = 0; i < 10; i++) { const s = new THREE.Mesh(G.sph, neoxBasic(0xe8ff9a, 0.9, true)); s.scale.setScalar(0.03 + Math.random() * 0.03); s.visible = false; sparks.push(s); }
  const objs = [orb, dome, ring].concat(arcs, sparks);
  const fx = neoxFx(flyT + 1.0, objs, (dt, age) => {
    if (age < flyT) { const k = age / flyT;
      orb.position.lerpVectors(from, to, k); orb.position.y += Math.sin(k * Math.PI) * 0.4;
      oArc.rotation.z += dt * 14; oArc.material.uniforms.uP.value = 0.3 + 0.3 * Math.sin(neoxU.value * 23);
    } else { const ba = age - flyT;
      if (orb.visible) { orb.visible = false; dome.visible = ring.visible = true;
        arcs.forEach((a, i) => { const an = i / 7 * Math.PI * 2; a.visible = true; a.position.set(to.x + Math.cos(an) * R * 0.45, (to.y || 0) + 1.0, to.z + Math.sin(an) * R * 0.45); a.rotation.y = -an + Math.PI / 2; a.scale.set(0.9, 2.0, 1); });
        sparks.forEach((s) => { s.visible = true; s.position.set(to.x, (to.y || 0) + 0.8, to.z); s.userData.v = new THREE.Vector3((Math.random() - 0.5) * 7, 2 + Math.random() * 5, (Math.random() - 0.5) * 7); }); }
      const bs = Math.min(1, ba / 0.5);
      dome.scale.set(R * 0.75 * (0.3 + bs * 0.9), R * 1.1 * (0.3 + bs * 0.9), R * 0.75 * (0.3 + bs * 0.9)); dome.material.uniforms.uP.value = Math.min(1, ba / 0.7);
      ring.scale.setScalar(0.01 + bs * R); ring.material.opacity = 0.85 * (1 - bs);
      arcs.forEach((a) => { a.material.uniforms.uP.value = Math.min(1, ba / 0.55); });
      sparks.forEach((s) => { s.position.addScaledVector(s.userData.v, dt); s.userData.v.y -= 14 * dt; s.material.opacity = 0.9 * Math.max(0, 1 - ba / 0.6); }); }
  });
  return fx; } catch (e) { try { window.neoxErr = String(e && e.stack || e).slice(0, 300); xE(e); } catch (e2) {} return null; } }
// ---- High Gear: persistent crackle + ground trail. getPos() -> position each tick. ----
function neoxHighGear(getPos) { try { const G = neoxGeos();
  const grp = new THREE.Group();
  const arcs = []; for (let i = 0; i < 4; i++) { const a = new THREE.Mesh(G.plane, neoxMat("arc", neoxARC, 9 + i * 2.3)); a.scale.set(0.85, 1.7, 1); grp.add(a); arcs.push(a); }
  const glow = new THREE.Mesh(G.sph, neoxBasic(0x3aa8ff, 0.10, true)); glow.scale.set(0.55, 0.9, 0.55); glow.position.y = 1.0; grp.add(glow);
  const trail = [];
  let last = null;
  const fx = neoxFx(1e9, [grp], (dt, age) => {
    let p = null; try { p = typeof getPos === "function" ? getPos() : getPos; } catch (e) {}
    if (p) grp.position.set(p.x, p.y || 0, p.z);
    arcs.forEach((a, i) => { const an = neoxU.value * 2.4 + i * 2.1; a.position.set(Math.cos(an) * 0.45, 0.7 + i * 0.4 + Math.sin(neoxU.value * 5 + i) * 0.1, Math.sin(an) * 0.45); a.rotation.y = -an + Math.PI / 2; a.material.uniforms.uP.value = 0.12 + 0.3 * Math.sin(neoxU.value * 17 + i * 3.7); });
    if (p && last && Math.hypot(p.x - last.x, p.z - last.z) > 0.35) { const t = new THREE.Mesh(G.plane, neoxBasic(0x46c8ff, 0.55, true)); t.rotation.x = -Math.PI / 2; t.rotation.z = Math.atan2(-(p.x - last.x), -(p.z - last.z)) + Math.PI / 2; t.scale.set(0.28, Math.hypot(p.x - last.x, p.z - last.z) + 0.3, 1); t.position.set((p.x + last.x) / 2, 0.05, (p.z + last.z) / 2); scene.add(t); trail.push({ m: t, a: 0 }); fx.fx.objs.push(t); }
    if (p) last = { x: p.x, z: p.z };
    for (let i = trail.length - 1; i >= 0; i--) { const t = trail[i]; t.a += dt; t.m.material.opacity = 0.55 * Math.max(0, 1 - t.a / 0.7); if (t.a > 0.7) { scene.remove(t.m); t.m.material.dispose(); trail.splice(i, 1); } }
  });
  return fx; } catch (e) { try { window.neoxErr = String(e && e.stack || e).slice(0, 300); xE(e); } catch (e2) {} return null; } }
// ---- Overdrive ----
function neoxOverdrive(p, seconds) { try { const G = neoxGeos(), at = neoxV3(p), ttl = Math.max(0.5, seconds || 10);
  const grp = new THREE.Group(); grp.position.copy(at);
  const flash = new THREE.Mesh(G.sph, neoxBasic(0xbfe8ff, 0.9, true)); flash.scale.setScalar(0.4); flash.position.y = 1.2; grp.add(flash);
  const arcs = []; for (let i = 0; i < 4; i++) { const a = new THREE.Mesh(G.plane, neoxMat("arc", neoxARC, 15 + i * 2.9)); a.scale.set(0.8, 1.8, 1); const an = i / 4 * Math.PI * 2; a.position.set(Math.cos(an) * 0.6, 1.2, Math.sin(an) * 0.6); a.rotation.y = -an + Math.PI / 2; grp.add(a); arcs.push(a); }
  const warm = new THREE.Mesh(G.sph, neoxBasic(0xe8ff9a, 0.5, true)); warm.scale.setScalar(0.25); warm.position.y = 1.1; grp.add(warm);
  return neoxFx(ttl, [grp], (dt, age, k) => {
    flash.material.opacity = 0.9 * Math.max(0, 1 - age / 0.4); flash.scale.setScalar(0.4 + age * 2.0);
    warm.material.opacity = 0.5 * (1 - k);
    arcs.forEach((a, i) => { a.material.uniforms.uP.value = 0.25 + 0.35 * Math.sin(neoxU.value * 19 + i * 2.1); a.rotation.y += dt * 3; });
  }); } catch (e) { try { window.neoxErr = String(e && e.stack || e).slice(0, 300); xE(e); } catch (e2) {} return null; } }
// per-shot finger lightning: jagged beam from o along d for len metres
function neoxOverdriveBeam(o, d, len) { try { const G = neoxGeos();
  const from = neoxV3(o), dir = neoxV3(d).normalize(), L = len || 12;
  const grp = new THREE.Group(); grp.position.copy(from);
  grp.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, -1), dir);
  const core = new THREE.Mesh(G.cyl, neoxBasic(0xeafcff, 0.95, true)); core.scale.set(0.045, L, 0.045); core.rotation.x = Math.PI / 2; core.position.z = -L / 2; grp.add(core);
  const arcs = []; for (let i = 0; i < 4; i++) { const a = new THREE.Mesh(G.plane, neoxMat("arc", neoxARC, 21 + i * 4.1 + Math.random() * 3)); a.scale.set(0.9 + i * 0.35, L, 1); a.rotation.x = -Math.PI / 2; a.rotation.y = i * 1.05; a.position.z = -L / 2; grp.add(a); arcs.push(a); }
  const muzzle = new THREE.Mesh(G.sph, neoxBasic(0xd8f8ff, 0.7, true)); muzzle.scale.setScalar(0.15); grp.add(muzzle);
  const hit = new THREE.Mesh(G.sph, neoxBasic(0xe8ff9a, 0.85, true)); hit.scale.setScalar(0.3); hit.position.z = -L; grp.add(hit);
  return neoxFx(0.26, [grp], (dt, age, k) => {
    core.material.opacity = 0.95 * (1 - k);
    arcs.forEach((a) => { a.material.uniforms.uP.value = k; });
    muzzle.material.opacity = 0.7 * (1 - k); hit.material.opacity = 0.85 * (1 - k);
  }); } catch (e) { try { window.neoxErr = String(e && e.stack || e).slice(0, 300); xE(e); } catch (e2) {} return null; } }
// ---- round reset / cancel hook ----
function neoxReset() { while (neoxLive.length) neoxEnd({ fx: neoxLive[0] }); }
// ---- END NEON FX ----
