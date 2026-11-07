// ---- WAYLAY FX ----
// Waylay ability visuals, reference-grounded in the wiki showcase clips viewed 2026-11-04
// (wiki.playvalorant.com/en-us/images/Saturate_Showcase.mp4, Lightspeed_Showcase.mp4,
// Refract_Showcase.mp4, Convergent_Paths_Showcase.mp4; ability pages /Saturate, /Lightspeed,
// /Refract, /Convergent_Paths). Procedural approximation, not extracted game assets.
//   Saturate: a thrown light that swells into a translucent lavender iridescent dome with a cyan inner ring.
//   Lightspeed: chartreuse light streaks along the dash path, brief glow at both ends.
//   Refract: a small golden beacon mote; the return is a radial chromatic starburst + arrival flash.
//   Convergent Paths (wiki dims 36 x 13.5 m, near edge 3 m ahead, 1 s windup, beam expands from the middle
//     outward in 4 ticks 0.125 s apart): twin ground lanes, chartreuse and violet, flowing light, then fade.
// Pure client fx: damage, timing and sound stay in the caller. Self-cleaning via the shared tick.
// Globals used (read-only): THREE, scene, camera, player, xE.
//
// Contract (integrator owns wiring):
//   Entries take world positions (THREE.Vector3 or {x,y,z}) and return a handle {fx, end()} or null on error.
//   h.end() stops the effect early; per-effect materials and geometries are disposed recursively.
//   wayxEnd(h) same. wayxReset() ends everything (round reset).
//   wayxUseGameTick() then wayxTick(dt) drives all effects with the game dt; otherwise a rAF pump runs
//   while effects exist (client dt caps apply there, not wall time).
//   wayxConvergentPaths(o, yaw, opts): o is the NEAR EDGE of the lane area (the server row p, 3 m ahead of
//   the caster), yaw the cast yaw; opts {len=36, w=13.5, wind=1, life=7}. The 'paths' fx row carries yaw;
//   len/w fall back to the wiki constants when the row omits them.
var wayxU = { value: 0 }, wayxLive = [], wayxPumpOn = false, wayxGT = null, wayxGeo = null, wayxProg = {};
function wayxNow() { try { return performance.now() / 1000; } catch (e) { return Date.now() / 1000; } }
function wayxGeos() { if (wayxGeo) return wayxGeo; wayxGeo = {
  sph: new THREE.SphereGeometry(1, 24, 16),
  ring: new THREE.RingGeometry(0.9, 1, 48),
  plane: new THREE.PlaneGeometry(1, 1),
  box: new THREE.BoxGeometry(1, 1, 1),
  cyl: new THREE.CylinderGeometry(1, 1, 1, 24, 1, true) }; return wayxGeo; }
function wayxShader(k, frag, opts) { if (wayxProg[k]) return wayxProg[k]; const m = new THREE.ShaderMaterial(Object.assign({
  uniforms: { uT: wayxU, uP: { value: 0 }, uSeed: { value: 0 }, uA: { value: 1 } },
  vertexShader: "uniform float uT;uniform float uP;uniform float uSeed;varying vec3 vN;varying vec3 vV;varying vec3 vP;varying vec2 vUv;void main(){vUv=uv;vP=position;vec4 mv=modelViewMatrix*vec4(position,1.0);vV=-mv.xyz;vN=normalMatrix*normal;gl_Position=projectionMatrix*mv;}",
  fragmentShader: frag, transparent: true, depthWrite: false, side: THREE.DoubleSide }, opts || {}));
  m.userData.wayx = k; wayxProg[k] = m; return m; }
// Saturate dome: translucent lavender iridescence, fresnel sheen
const wayxDOME = "uniform float uT;uniform float uP;uniform float uSeed;uniform float uA;varying vec3 vN;varying vec3 vV;varying vec3 vP;varying vec2 vUv;\n" +
  "void main(){float f=pow(1.0-abs(dot(normalize(vN),normalize(vV))),1.8);\n" +
  "float w=sin(vP.x*3.0+uT*1.6+uSeed)*sin(vP.y*4.0-uT*1.2)*0.5+0.5;\n" +
  "vec3 c=mix(vec3(0.62,0.48,0.95),vec3(0.80,0.70,1.0),f);c+=vec3(0.45,0.9,1.0)*pow(f,3.0)*0.35;\n" +
  "float a=(0.28+0.45*f)*(0.85+0.15*w)*uA*(1.0-uP);\n" +
  "if(a<0.004)discard;gl_FragColor=vec4(c,a);}";
// Convergent Paths lane sheet: twin lanes (chartreuse + violet), light flowing forward, expansion mask uP 0->1
const wayxLANE = "uniform float uT;uniform float uP;uniform float uSeed;uniform float uA;varying vec3 vN;varying vec3 vV;varying vec3 vP;varying vec2 vUv;uniform vec3 uCol;\n" +
  "void main(){float x=vUv.y,y=vUv.x; // x along length 0..1 (near->far), y across one strip\n" +
  "float expand=abs(x-0.5)*2.0; // 0 at middle, 1 at both ends\n" +
  "float on=1.0-smoothstep(uP*1.15-0.25,uP*1.15,expand);\n" +
  "float rag=sin(y*37.0+uSeed*11.0)*0.5+sin(y*13.0-uT*3.0)*0.5;\n" +
  "float lane=smoothstep(0.0,0.10,y+rag*0.05)*(1.0-smoothstep(0.90,1.0,y+rag*0.05));\n" +
  "float flow=0.55+0.45*sin(x*24.0-uT*8.0+uSeed);\n" +
  "float core=1.0-smoothstep(0.0,0.30,abs(y-0.5));\n" +
  "vec3 c=uCol*(0.55+0.45*flow)+vec3(1.0,1.0,0.95)*core*0.35;\n" +
  "float a=(0.45+0.35*flow+0.25*core)*lane*on*uA;\n" +
  "if(a<0.004)discard;gl_FragColor=vec4(c,a);}";
function wayxMat(k, shader, seed, opts) { const m = wayxShader(k, shader, opts).clone(); m.uniforms.uT = wayxU; if (seed !== undefined) m.uniforms.uSeed.value = seed; return m; }
function wayxBasic(c, o, add) { return new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: o, depthWrite: false, blending: add ? THREE.AdditiveBlending : THREE.NormalBlending, side: THREE.DoubleSide }); }
function wayxPush(fx) { if (wayxLive.length > 24) { const o = wayxLive.shift(); try { o.done(); } catch (e) {} } wayxLive.push(fx); if (!wayxGT && !wayxPumpOn) { wayxPumpOn = true; wayxPump.last = wayxNow(); requestAnimationFrame(wayxPump); } return fx; }
function wayxPump() { if (wayxGT) { wayxPumpOn = false; return; } const now = wayxNow(), dt = Math.min(0.1, Math.max(0.0005, now - (wayxPump.last || now))); wayxPump.last = now; wayxU.value += dt;
  for (let i = wayxLive.length - 1; i >= 0; i--) { const fx = wayxLive[i]; fx.age += dt; try { fx.tick(dt, fx.age, Math.min(1, fx.age / fx.ttl)); } catch (e) { try { xE(e); } catch (e2) {} }
    if (fx.age >= fx.ttl) { try { fx.done(); } catch (e) {} wayxLive.splice(i, 1); } }
  if (wayxLive.length) requestAnimationFrame(wayxPump); else wayxPumpOn = false; }
function wayxUseGameTick() { wayxGT = true; wayxPumpOn = false; }
function wayxTick(dt) { wayxU.value += dt; for (let i = wayxLive.length - 1; i >= 0; i--) { const fx = wayxLive[i]; fx.age += dt; try { fx.tick(dt, fx.age, Math.min(1, fx.age / fx.ttl)); } catch (e) { try { xE(e); } catch (e2) {} } if (fx.age >= fx.ttl) { try { fx.done(); } catch (e) {} wayxLive.splice(i, 1); } } }
function wayxEnd(h) { if (!h || !h.fx) return; const i = wayxLive.indexOf(h.fx); if (i >= 0) wayxLive.splice(i, 1); try { h.fx.done(); } catch (e) {} }
function wayxFx(ttl, objs, tick, done, geos) { const fx = { age: 0, ttl, objs, tick, done: done || function () { objs.forEach((o) => { try { scene.remove(o); o.traverse((m) => { if (m.material && m.material.dispose) m.material.dispose(); }); } catch (e) {} }); if (geos) geos.forEach((g) => { try { g.dispose(); } catch (e) {} }); } }; objs.forEach((o) => scene.add(o)); wayxPush(fx); return { fx, end: function () { wayxEnd(this); } }; }
function wayxV3(p) { return p && p.isVector3 ? p : new THREE.Vector3(p.x || 0, p.y || 0, p.z || 0); }
function wayxNearPlayer(p, d) { try { return player && Math.hypot(player.x - p.x, player.z - p.z) < d; } catch (e) { return false; } }
// ---- Saturate: thrown light -> lavender iridescent dome with cyan inner ring ----
function wayxSaturate(o, p, opts) { try { const G = wayxGeos(); opts = opts || {};
  const to = wayxV3(p), from2 = wayxV3(o), flyT = opts.flyT || 0.3, R = opts.radius || 4.5;
  const orb = new THREE.Group();
  const core = new THREE.Mesh(G.sph, wayxBasic(0xf4ffd8, 0.95, true)); core.scale.setScalar(0.09); orb.add(core);
  const shell = new THREE.Mesh(G.sph, wayxBasic(0xb9d84a, 0.5, true)); shell.scale.setScalar(0.2); orb.add(shell);
  const domeGeo = new THREE.SphereGeometry(1, 28, 18, 0, Math.PI * 2, 0, Math.PI / 2);
  const dome = new THREE.Mesh(domeGeo, wayxMat("dome", wayxDOME, 0)); dome.scale.setScalar(0.01); dome.position.copy(to); dome.visible = false;
  const ring = new THREE.Mesh(G.ring, wayxBasic(0x7ae8ff, 0.9, true)); ring.rotation.x = -Math.PI / 2; ring.position.set(to.x, (to.y || 0) + 0.08, to.z); ring.scale.setScalar(0.01); ring.visible = false;
  const objs = [orb, dome, ring];
  const fx = wayxFx(flyT + 2.4, objs, (dt, age) => {
    if (age < flyT) { const k = age / flyT; orb.position.lerpVectors(from2, to, k); orb.position.y += Math.sin(k * Math.PI) * 0.6; orb.rotation.y += dt * 8; }
    else { const ba = age - flyT;
      if (orb.visible) { orb.visible = false; dome.visible = ring.visible = true; }
      const swell = Math.min(1, ba / 0.3), hold = ba < 1.6 ? 1 : Math.max(0, 1 - (ba - 1.6) / 0.7);
      const s = R * (0.15 + 0.85 * (1 - Math.pow(1 - swell, 3)));
      dome.scale.set(s, s * 0.82, s); dome.material.uniforms.uP.value = 1 - hold;
      const rp = 0.35 + 0.65 * Math.abs(Math.sin(wayxU.value * 2.4));
      ring.scale.setScalar(R * 0.55 * (0.6 + 0.4 * swell)); ring.material.opacity = 0.9 * swell * hold * rp; }
  }, undefined, [domeGeo]);
  return fx; } catch (e) { try { window.wayxErr = String(e && e.stack || e).slice(0, 300); xE(e); } catch (e2) {} return null; } }
// ---- Lightspeed: chartreuse streaks along the dash path ----
function wayxLightspeed(o, d, opts) { try { const G = wayxGeos(); opts = opts || {};
  const from = wayxV3(o), dir = wayxV3(d); dir.y = 0; dir.normalize();
  const LEN = opts.len || 9, ttl = 0.55;
  const grp = new THREE.Group();
  const streaks = []; for (let i = 0; i < 5; i++) { const s = new THREE.Mesh(G.plane, wayxBasic(i % 2 ? 0xd8ff5a : 0xf4ffd8, 0.75, true));
    const off = (i - 2) * 0.22, lag = i * 0.07;
    s.position.set(from.x + dir.x * (LEN * 0.5 - lag) - dir.z * off, (from.y || 0) + 0.6 + (i % 3) * 0.35, from.z + dir.z * (LEN * 0.5 - lag) + dir.x * off);
    s.rotation.y = Math.atan2(-dir.x, -dir.z) + Math.PI / 2; s.scale.set(LEN * (0.9 - lag), 0.06 + (i % 2) * 0.05, 1); grp.add(s); streaks.push(s); }
  const a0 = new THREE.Mesh(G.sph, wayxBasic(0xf4ffd8, 0.85, true)); a0.scale.setScalar(0.28); a0.position.copy(from); a0.position.y += 0.9; grp.add(a0);
  const a1 = new THREE.Mesh(G.sph, wayxBasic(0xd8ff5a, 0.8, true)); a1.scale.setScalar(0.2); a1.position.copy(from).addScaledVector(dir, LEN); a1.position.y += 0.9; grp.add(a1);
  return wayxFx(ttl, [grp], (dt, age, k) => {
    streaks.forEach((s, i) => { s.material.opacity = 0.75 * (1 - k) * (1 - i * 0.12); });
    a0.material.opacity = 0.85 * Math.max(0, 1 - age / 0.25); a1.material.opacity = 0.8 * Math.max(0, 1 - age / 0.4);
  }); } catch (e) { try { window.wayxErr = String(e && e.stack || e).slice(0, 300); xE(e); } catch (e2) {} return null; } }
// ---- Refract beacon + return starburst ----
function wayxRefractBeacon(p) { try { const G = wayxGeos(), at = wayxV3(p);
  const grp = new THREE.Group(); grp.position.copy(at);
  const mote = new THREE.Mesh(G.sph, wayxBasic(0xffe88a, 0.95, true)); mote.scale.setScalar(0.09); mote.position.y = 0.5; grp.add(mote);
  const halo = new THREE.Mesh(G.sph, wayxBasic(0xd8ff5a, 0.3, true)); halo.scale.setScalar(0.22); halo.position.y = 0.5; grp.add(halo);
  const pillar = new THREE.Mesh(G.cyl, wayxBasic(0xffe88a, 0.25, true)); pillar.scale.set(0.03, 1.6, 0.03); pillar.position.y = 0.8; grp.add(pillar);
  const motes = []; for (let i = 0; i < 5; i++) { const m = new THREE.Mesh(G.sph, wayxBasic(0xffe8a0, 0.8, true)); m.scale.setScalar(0.02); grp.add(m); motes.push(m); }
  return wayxFx(1e9, [grp], (dt, age) => {
    mote.position.y = 0.5 + Math.sin(wayxU.value * 2.6) * 0.08; halo.material.opacity = 0.3 + 0.12 * Math.sin(wayxU.value * 3.4);
    pillar.material.opacity = 0.25 + 0.1 * Math.sin(wayxU.value * 2.2);
    motes.forEach((m, i) => { const u = (wayxU.value * 0.45 + i / 5) % 1, a = i * 2.4 + u * 2; m.position.set(Math.cos(a) * 0.22, 0.15 + u * 1.1, Math.sin(a) * 0.22); m.material.opacity = 0.8 * (1 - u); });
  }); } catch (e) { try { window.wayxErr = String(e && e.stack || e).slice(0, 300); xE(e); } catch (e2) {} return null; } }
function wayxRefractReturn(p) { try { const G = wayxGeos(), at = wayxV3(p);
  const grp = new THREE.Group(); grp.position.copy(at);
  const rays = []; const cols = [0xd8ff5a, 0xa06bff, 0x7ae8ff];
  for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2, r = new THREE.Mesh(G.plane, wayxBasic(cols[i % 3], 0.85, true));
    r.position.set(Math.cos(a) * 1.1, 1.1, Math.sin(a) * 1.1); r.rotation.y = -a + Math.PI / 2; r.scale.set(1.6, 0.10, 1); grp.add(r); rays.push(r); }
  const core = new THREE.Mesh(G.sph, wayxBasic(0xffffff, 0.95, true)); core.scale.setScalar(0.3); core.position.y = 1.1; grp.add(core);
  const ring = new THREE.Mesh(G.ring, wayxBasic(0xd8ff5a, 0.85, true)); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.07; grp.add(ring);
  return wayxFx(0.7, [grp], (dt, age, k) => {
    rays.forEach((r, i) => { const u = Math.max(0, 1 - k * 1.3); r.scale.x = 1.6 * (0.3 + k * 1.4); r.material.opacity = 0.85 * u; r.position.y = 1.1 + k * 0.6; });
    core.material.opacity = 0.95 * Math.max(0, 1 - age / 0.3); core.scale.setScalar(0.3 + age * 1.1);
    ring.scale.setScalar(0.1 + k * 3); ring.material.opacity = 0.85 * (1 - k);
  }); } catch (e) { try { window.wayxErr = String(e && e.stack || e).slice(0, 300); xE(e); } catch (e2) {} return null; } }
// ---- Convergent Paths: twin light lanes (violet + chartreuse) expanding from the middle outward ----
// ANCHOR INTERPRETATION UNSETTLED: the wiki's "3 m ahead" may be the area's near edge or its centre.
// opts.anchor: "near" (default; o is the near edge, matching the current server row p) or "center"
// (o is the area centre). Do not treat the default as confirmation - integrator owns the final call.
function wayxConvergentPaths(o, yaw, opts) { try { const G = wayxGeos(); opts = opts || {};
  const LEN = opts.len || 36, W = opts.w || 13.5, WIND = opts.wind == null ? 1 : opts.wind, LIFE = Math.max(1.5, Math.min(opts.life || 2.4, 3));
  const dir = new THREE.Vector3(-Math.sin(yaw || 0), 0, -Math.cos(yaw || 0));
  const side = new THREE.Vector3(-dir.z, 0, dir.x);
  const near = wayxV3(o); near.y = 0;
  if (opts.anchor === "center") near.addScaledVector(dir, -LEN / 2);
  const grp = new THREE.Group();
  const STRIP = W / 2 - 1.2, GAP = 2.4; /* two separated strips per the showcase clip */
  const geo = new THREE.PlaneGeometry(STRIP, LEN);
  const strips = [];
  const cols = [new THREE.Color(0.55, 0.25, 1.0), new THREE.Color(0.68, 1.0, 0.14)]; /* violet left, chartreuse right (caster view) */
  for (let i = 0; i < 2; i++) {
    const m = new THREE.Mesh(geo, wayxMat("lane", wayxLANE, Math.random() * 10, { blending: THREE.NormalBlending }));
    m.material.uniforms.uCol = { value: cols[i] };
    m.rotation.x = -Math.PI / 2; m.rotation.order = "YXZ"; m.rotation.y = Math.atan2(-dir.x, -dir.z);
    const off = (i === 0 ? -1 : 1) * (STRIP / 2 + GAP / 2);
    m.position.copy(near).addScaledVector(dir, LEN / 2).addScaledVector(side, off); m.position.y = 0.07 + i * 0.005;
    m.visible = false; grp.add(m); strips.push(m); }
  const charge = new THREE.Mesh(G.sph, wayxBasic(0xf4ffd8, 0.85, true)); charge.scale.setScalar(0.12); charge.position.copy(near); charge.position.y = 1.2; grp.add(charge);
  const wisps = []; for (let i = 0; i < 6; i++) { const w = new THREE.Mesh(G.sph, wayxBasic(i % 2 ? 0xd8ff5a : 0xa06bff, 0.8, true)); w.scale.setScalar(0.05); grp.add(w); wisps.push(w); }
  const fx = wayxFx(WIND + LIFE, [grp], (dt, age) => {
    if (age < WIND) { const k = age / WIND;
      charge.scale.setScalar(0.12 + k * 0.3); charge.material.opacity = 0.85 * (0.5 + 0.5 * k);
      wisps.forEach((w, i) => { const a = wayxU.value * 3 + i * 1.05, r = (1 - k) * 1.6 + 0.15; w.position.set(near.x + Math.cos(a) * r, 0.5 + (1 - k) * 0.9, near.z + Math.sin(a) * r); w.material.opacity = 0.8 * k; });
      return; }
    if (!strips[0].visible) { strips.forEach((m) => m.visible = true); charge.visible = false; wisps.forEach((w) => w.visible = false); }
    const ba = age - WIND, expand = Math.min(1, ba / 0.5); /* wiki: 4 ticks 0.125 s apart from the middle outward */
    strips.forEach((m, i) => { m.material.uniforms.uP.value = expand;
      m.material.uniforms.uA.value = ba < LIFE - 0.6 ? 1 : Math.max(0, (LIFE - ba) / 0.6); });
  }, undefined, [geo]);
  return fx; } catch (e) { try { window.wayxErr = String(e && e.stack || e).slice(0, 300); xE(e); } catch (e2) {} return null; } }
// ---- round reset / cancel hook ----
function wayxReset() { while (wayxLive.length) wayxEnd({ fx: wayxLive[0] }); }
// ---- END WAYLAY FX ----
