// ---- VYSE FX ----
// Vyse ability visuals (work/vyse_fx_runtime.js), reference-grounded in the wiki showcase clips
// (wiki.playvalorant.com/en-us/images/Arc_Rose_Showcase.mp4, Razorvine_Showcase.mp4,
// Shear_Showcase.mp4, Steel_Garden_Showcase.mp4; frame sheets reviewed 2026-11-04).
// Procedural approximation, not extracted game assets. Main entries keep game mechanics.
// All positions are world-space. Every entry returns a handle accepted by vyxEnd (or use h.end()).
// vyxUseGameTick() then vyxTick(dt) hands timing to the game loop (game-dt driven, never wall clock).
// Shared geometry/programs persist; cloned per-effect materials are disposed recursively.
var vyxU = { value: 0 }, vyxLive = [], vyxPumpOn = false, vyxGT = null, vyxGeo = null, vyxProg = {};
function vyxNow() { try { return performance.now() / 1000; } catch (e) { return Date.now() / 1000; } }
function vyxGeos() { if (vyxGeo) return vyxGeo; vyxGeo = {
  sph: new THREE.SphereGeometry(1, 24, 16),
  ring: new THREE.RingGeometry(0.82, 1, 48),
  cone: new THREE.ConeGeometry(0.5, 1, 9, 4),
  plane: new THREE.PlaneGeometry(1, 1, 1, 4) }; return vyxGeo; }
function vyxShader(k, frag, opts) { if (vyxProg[k]) return vyxProg[k]; const m = new THREE.ShaderMaterial(Object.assign({
  uniforms: { uT: vyxU, uP: { value: 0 }, uSeed: { value: 0 }, uA: { value: 1 } },
  vertexShader: "uniform float uT;uniform float uP;uniform float uSeed;varying vec3 vN;varying vec3 vV;varying vec3 vP;varying vec2 vUv;void main(){vUv=uv;vec3 p=position;vP=p;vec4 mv=modelViewMatrix*vec4(p,1.0);vV=-mv.xyz;vN=normalMatrix*normal;gl_Position=projectionMatrix*mv;}",
  fragmentShader: frag, transparent: true, depthWrite: false, side: THREE.DoubleSide }, opts || {}));
  m.userData.vyx = k; vyxProg[k] = m; return m; }
function vyxMat(k, shader, seed, opts) { const m = vyxShader(k, shader, opts).clone(); m.uniforms.uT = vyxU; if (seed !== undefined) m.uniforms.uSeed.value = seed; return m; }
function vyxBasic(c, o, add) { return new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: o, depthWrite: false, blending: add ? THREE.AdditiveBlending : THREE.NormalBlending, side: THREE.DoubleSide }); }
function vyxPush(fx) { if (vyxLive.length > 24) { const o = vyxLive.shift(); try { o.done(); } catch (e) {} } vyxLive.push(fx); if (!vyxGT && !vyxPumpOn) { vyxPumpOn = true; vyxPump.last = vyxNow(); requestAnimationFrame(vyxPump); } return fx; }
function vyxStep(dt) { vyxU.value += dt; for (let i = vyxLive.length - 1; i >= 0; i--) { const fx = vyxLive[i]; fx.age += dt; try { fx.tick(dt, fx.age, Math.min(1, fx.age / fx.ttl)); } catch (e) { try { xE(e); } catch (e2) {} } if (fx.age >= fx.ttl) { try { fx.done(); } catch (e) {} vyxLive.splice(i, 1); } } }
function vyxPump() { if (vyxGT) { vyxPumpOn = false; return; } const now = vyxNow(), dt = Math.min(0.1, Math.max(0.0005, now - (vyxPump.last || now))); vyxPump.last = now; vyxStep(dt); if (vyxLive.length) requestAnimationFrame(vyxPump); else vyxPumpOn = false; }
function vyxUseGameTick() { vyxGT = true; vyxPumpOn = false; }
function vyxTick(dt) { vyxStep(dt); }
function vyxEnd(h) { if (!h || !h.fx) return; const i = vyxLive.indexOf(h.fx); if (i >= 0) vyxLive.splice(i, 1); try { h.fx.done(); } catch (e) {} }
function vyxDispose(o) { o.traverse((m) => { if (m.material && m.material.dispose) m.material.dispose(); if (m.userData && m.userData.vyxOwnGeo && m.geometry && m.geometry.dispose) m.geometry.dispose(); }); }
function vyxFx(ttl, objs, tick, done) { const fx = { age: 0, ttl, objs, tick, done: done || function () { objs.forEach((o) => { try { scene.remove(o); vyxDispose(o); } catch (e) {} }); } }; objs.forEach((o) => scene.add(o)); vyxPush(fx); return { fx, end: function () { vyxEnd(this); } }; }
// metal thorn: dark violet body, magenta fresnel edge, faint gold glint
const vyxTHORN = "uniform float uT;uniform float uP;uniform float uSeed;varying vec3 vN;varying vec3 vV;varying vec2 vUv;void main(){float f=pow(1.0-abs(dot(normalize(vN),normalize(vV))),1.5);vec3 c=mix(vec3(0.13,0.07,0.20),vec3(0.65,0.25,0.75),f);c+=vec3(1.0,0.65,0.25)*smoothstep(0.86,1.0,sin(vUv.y*24.0-uT*2.0+uSeed*8.0))*0.5;float a=(0.95-0.35*f)*(1.0-uP);gl_FragColor=vec4(c,a);}";
// razorvine ground: deep violet bed with glowing orange-gold crack veins
const vyxVINE = "uniform float uT;uniform float uP;uniform float uSeed;varying vec2 vUv;\nfloat h2(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}\nvoid main(){vec2 q=(vUv-0.5)*2.0;float r=length(q);if(r>1.0)discard;vec2 g=q*7.0;vec2 i=floor(g),f=fract(g);float d=8.0;for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){vec2 o=vec2(float(x),float(y));d=min(d,length(o+vec2(h2(i+o),h2(i+o+7.0))-f));}float vein=smoothstep(0.30,0.06,d);float pulse=0.7+0.3*sin(uT*2.2+uSeed);vec3 c=mix(vec3(0.10,0.04,0.16),vec3(1.0,0.55,0.15),vein*pulse);c=mix(c,vec3(0.45,0.15,0.55),smoothstep(0.75,1.0,r)*0.5);float a=(0.75+0.25*vein)*(1.0-smoothstep(0.94,1.0,r))*(1.0-uP);gl_FragColor=vec4(c,a);}";
// liquid-metal wall: deep indigo with flowing violet-blue waves and bright sheen streaks
const vyxMETAL = "uniform float uT;uniform float uP;uniform float uSeed;varying vec3 vN;varying vec3 vV;varying vec3 vP;varying vec2 vUv;void main(){float f=pow(1.0-abs(dot(normalize(vN),normalize(vV))),1.3);float w1=sin(vUv.x*9.0+vUv.y*5.0-uT*2.6)*sin(vUv.x*4.0-vUv.y*7.0+uT*1.7);float w2=sin(vUv.y*16.0+uT*3.4+w1*3.0);vec3 c=mix(vec3(0.07,0.05,0.22),vec3(0.38,0.22,0.75),0.5+0.5*w1);c+=vec3(0.55,0.45,0.95)*smoothstep(0.55,0.95,w2)*0.6;c+=vec3(0.85,0.80,1.0)*f*0.55;c+=vec3(0.9,0.6,0.9)*smoothstep(0.92,1.0,vUv.y)*0.4;float a=(0.92)*(1.0-uP);gl_FragColor=vec4(c,a);}";
// arc rose petal: pale silver with magenta glowing rim
const vyxPETAL = "uniform float uT;uniform float uP;uniform float uSeed;varying vec3 vN;varying vec3 vV;varying vec2 vUv;void main(){float f=pow(1.0-abs(dot(normalize(vN),normalize(vV))),1.2);float glow=0.6+0.4*sin(uT*2.8+uSeed);vec3 c=mix(vec3(0.78,0.75,0.85),vec3(0.95,0.35,0.80),smoothstep(0.55,1.0,vUv.y)*glow);c+=vec3(0.9,0.4,0.8)*f*0.5;float a=(0.95)*(1.0-uP);gl_FragColor=vec4(c,a);}";
// steel garden vine: silver ribbon with a magenta pulse running along its length
const vyxVINE2 = "uniform float uT;uniform float uP;uniform float uSeed;varying vec2 vUv;void main(){float across=smoothstep(0.0,0.3,vUv.y)*(1.0-smoothstep(0.7,1.0,vUv.y));float trav=pow(0.5+0.5*sin(vUv.x*8.0-uT*4.5+uSeed),3.0);vec3 c=mix(vec3(0.62,0.60,0.70),vec3(0.95,0.35,0.85),trav);float a=across*(0.55+0.4*trav)*(1.0-uP);gl_FragColor=vec4(c,a);}";
// ---- entries ----
// Razorvine: dark thorn bramble over a glowing orange-vein bed (wiki clip)
function vyxRazorvine(p, r, seconds) { try { const G = vyxGeos(), R = r || 6, ttl = Math.max(1, seconds || 30);
  const bed = new THREE.Mesh(new THREE.CircleGeometry(R, 40), vyxMat("vine", vyxVINE, 0)); bed.userData.vyxOwnGeo = true;
  bed.rotation.x = -Math.PI / 2; bed.position.set(p.x, (p.y || 0) + 0.06, p.z); bed.scale.setScalar(0.05);
  const grp = new THREE.Group(); grp.position.set(p.x, (p.y || 0), p.z);
  const thorns = [];
  for (let i = 0; i < 22; i++) { const a = i * 2.399963, rr = R * (0.25 + 0.75 * ((i * 0.37) % 1));
    const t = new THREE.Mesh(G.cone, vyxMat("thorn", vyxTHORN, i * 1.3)); const h = 0.5 + ((i * 0.61) % 1) * 0.8;
    t.position.set(Math.cos(a) * rr, h * 0.32, Math.sin(a) * rr); t.scale.set(0.16, h, 0.16);
    t.rotation.set(Math.cos(a) * 0.5, 0, -Math.sin(a) * 0.5); t.userData.h = h; t.userData.d = i * 0.016; grp.add(t); thorns.push(t); }
  return vyxFx(ttl, [bed, grp], (dt, age) => { const g = Math.min(1, age / 0.4), out = 1 - Math.pow(1 - g, 3);
    const die = Math.max(0, (age - (ttl - 0.5)) / 0.5), keep = Math.max(0, 1 - die);
    bed.scale.setScalar(Math.max(0.05, out) * Math.max(0.05, keep)); bed.material.uniforms.uP.value = die;
    thorns.forEach((t) => { const tg = Math.min(1, Math.max(0, (age - t.userData.d) / 0.3)); t.scale.set(0.16 * tg * keep, t.userData.h * tg * keep, 0.16 * tg * keep); t.material.uniforms.uP.value = die; }); }); } catch (e) { try { window.vyxErr = String(e && e.stack || e).slice(0, 300); xE(e); } catch (e2) {} return null; } }
// Shear: jagged-top liquid-metal wall rising out of the ground (wiki clip)
function vyxShear(p, yaw, len, seconds) { try { const L = len || 5, H = 2.2, ttl = Math.max(1, seconds || 8);
  const pos = [], uv = [], ind = [], N = 22;
  for (let i = 0; i <= N; i++) { const u = i / N, x = (u - 0.5) * L, top = H * (0.82 + 0.18 * Math.sin(i * 2.7) * Math.sin(i * 1.3 + 2));
    pos.push(x, 0, 0, x, top, 0); uv.push(u, 0, u, 1);
    if (i < N) { const k = i * 2; ind.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); } }
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(ind); g.computeVertexNormals();
  const wall = new THREE.Mesh(g, vyxMat("metal", vyxMETAL, 0)); wall.userData.vyxOwnGeo = true;
  wall.position.set(p.x, (p.y || 0), p.z); wall.rotation.y = yaw || 0; wall.scale.set(1, 0.02, 1);
  return vyxFx(ttl, [wall], (dt, age) => { const g2 = Math.min(1, age / 0.45), die = Math.max(0, (age - (ttl - 0.4)) / 0.4);
    wall.scale.y = Math.max(0.02, (1 - Math.pow(1 - g2, 3)) * (1 - die * die)); wall.material.uniforms.uP.value = die; }); } catch (e) { try { window.vyxErr = String(e && e.stack || e).slice(0, 300); xE(e); } catch (e2) {} return null; } }
// Arc Rose: small silver metal rose with magenta glow tips, pulsing (wiki clip)
function vyxArcRose(p, seconds) { try { const G = vyxGeos(), ttl = Math.max(1, seconds || 30);
  const grp = new THREE.Group(); grp.position.set(p.x, (p.y || 0) + 0.26, p.z);
  const core = new THREE.Mesh(G.sph, vyxBasic(0xd8d4e8, 0.95, false)); core.scale.setScalar(0.13); grp.add(core);
  const petals = []; for (let i = 0; i < 6; i++) { const m = new THREE.Mesh(G.plane, vyxMat("petal", vyxPETAL, i)); m.scale.set(0.19, 0.34, 1);
    const a = i * Math.PI / 3; m.position.set(Math.cos(a) * 0.15, 0.1, Math.sin(a) * 0.15); m.rotation.y = -a + Math.PI / 2; m.rotation.x = -0.5; grp.add(m); petals.push(m); }
  const halo = new THREE.Mesh(G.sph, vyxBasic(0xe84ab0, 0.16, true)); halo.scale.setScalar(0.34); grp.add(halo);
  const fx = vyxFx(ttl, [grp], (dt, age) => { const s = Math.min(1, age / 0.3); grp.scale.setScalar(Math.max(0.05, s));
    const die = Math.max(0, (age - (ttl - 0.35)) / 0.35); grp.rotation.y += dt * 0.8; grp.position.y = (p.y || 0) + 0.26 + Math.sin(vyxU.value * 2.2) * 0.04;
    halo.material.opacity = 0.14 * (0.6 + 0.4 * Math.sin(vyxU.value * 2.8)) * (1 - die); petals.forEach((m) => { m.material.uniforms.uP.value = die; }); core.material.opacity = 0.95 * (1 - die); });
  return fx; } catch (e) { try { window.vyxErr = String(e && e.stack || e).slice(0, 300); xE(e); } catch (e2) {} return null; } }
// Arc Rose detonation: white-gold core with radiating pink rays on a violet glow (wiki clip)
function vyxArcRoseFlash(p) { try { const G = vyxGeos(), y = (p.y || 0) + 1.1;
  const core = new THREE.Mesh(G.sph, vyxBasic(0xfff2d8, 1, true)); core.scale.setScalar(0.2); core.position.set(p.x, y, p.z);
  const glow = new THREE.Mesh(G.sph, vyxBasic(0x8a5ae8, 0.4, true)); glow.scale.setScalar(0.6); glow.position.copy(core.position);
  const grp = new THREE.Group(); grp.position.copy(core.position);
  const rays = []; for (let i = 0; i < 14; i++) { const m = new THREE.Mesh(G.plane, vyxBasic(i % 2 ? 0xf04ac8 : 0xffd86a, 0.85, true));
    m.scale.set(0.12 + (i % 3) * 0.05, 2.4, 1); const a = i * Math.PI * 2 / 14; m.rotation.z = a; m.userData.a = a; grp.add(m); rays.push(m); }
  const ring = new THREE.Mesh(G.ring, vyxBasic(0xffffff, 0.7, true)); ring.position.copy(core.position);
  return vyxFx(0.75, [core, glow, grp, ring], (dt, age, k) => { core.scale.setScalar(0.2 + age * 1.6); core.material.opacity = 1 - k;
    glow.scale.setScalar(0.6 + age * 4.5); glow.material.opacity = 0.4 * (1 - k);
    grp.scale.setScalar(1 + age * 3.2); rays.forEach((m) => { m.material.opacity = 0.85 * (1 - k * k); });
    ring.scale.setScalar(0.4 + age * 8); ring.material.opacity = 0.7 * (1 - k); ring.lookAt(camera ? camera.position : core.position); }); } catch (e) { try { window.vyxErr = String(e && e.stack || e).slice(0, 300); xE(e); } catch (e2) {} return null; } }
// Steel Garden: branching glowing thorn vines race outward, big silver thorns erupt behind them (wiki clip)
function vyxSteelGarden(p, r, seconds) { try { const G = vyxGeos(), R = r || 20, ttl = Math.max(1.5, seconds || 8);
  const grp = new THREE.Group(); grp.position.set(p.x, (p.y || 0) + 0.05, p.z);
  const vines = [], thorns = [];
  for (let i = 0; i < 9; i++) { const a0 = i * Math.PI * 2 / 9 + (i % 3) * 0.2, pts = [], N2 = 12;
    for (let j = 0; j <= N2; j++) { const u = j / N2, rr = u * R, a = a0 + Math.sin(u * 6 + i) * 0.35; pts.push(new THREE.Vector3(Math.cos(a) * rr, 0.02, Math.sin(a) * rr)); }
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    const pos = [], uv = [], ind = [];
    for (let j = 0; j <= N2; j++) { const u = j / N2, pt = pts[j], tng = j < N2 ? pts[j + 1].clone().sub(pt) : pt.clone().sub(pts[j - 1]); tng.normalize();
      const px = -tng.z, pz = tng.x, w = 0.35 * (1 - u * 0.5);
      pos.push(pt.x - px * w, 0, pt.z - pz * w, pt.x + px * w, 0, pt.z + pz * w); uv.push(u, 0, u, 1);
      if (j < N2) { const k = j * 2; ind.push(k, k + 2, k + 1, k + 1, k + 2, k + 3); } }
    geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2)); geo.setIndex(ind); geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, vyxMat("vine2", vyxVINE2, i * 1.9)); m.userData.vyxOwnGeo = true; m.userData.d = i * 0.09; grp.add(m); vines.push(m);
    for (let j = 0; j < 2; j++) { const u = 0.45 + j * 0.4, pt = pts[Math.round(u * N2)];
      const t = new THREE.Mesh(G.cone, vyxMat("thorn2", vyxTHORN, i * 3 + j)); const h = 1.6 + ((i + j) % 3) * 0.7;
      t.position.set(pt.x, h * 0.35, pt.z); t.rotation.set(Math.sin(i * 2 + j) * 0.55, 0, Math.cos(i + j * 2) * 0.55); t.scale.set(0.3, h, 0.3);
      t.userData.h = h; t.userData.d = i * 0.09 + j * 0.12 + 0.15; grp.add(t); thorns.push(t); } }
  return vyxFx(ttl, [grp], (dt, age) => { const die = Math.max(0, (age - (ttl - 0.7)) / 0.7), keep = Math.max(0, 1 - die);
    vines.forEach((m) => { const g = Math.min(1, Math.max(0, (age - m.userData.d) / 0.5)); m.scale.set(Math.max(0.03, g) * keep, 1, Math.max(0.03, g) * keep); m.material.uniforms.uP.value = die; });
    thorns.forEach((t) => { const g = Math.min(1, Math.max(0, (age - t.userData.d) / 0.25)); const up = 1 - Math.pow(1 - g, 3); t.scale.set(0.3 * up * keep, t.userData.h * up * keep, 0.3 * up * keep); t.material.uniforms.uP.value = die; }); }); } catch (e) { try { window.vyxErr = String(e && e.stack || e).slice(0, 300); xE(e); } catch (e2) {} return null; } }
function vyxReset() { while (vyxLive.length) vyxEnd({ fx: vyxLive[0] }); }
// ---- END VYSE FX ----
