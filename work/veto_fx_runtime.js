// ---- VETO FX ----
// Veto ability visuals (work/veto_fx_runtime.js), reference-grounded in the wiki showcase clips
// (wiki.playvalorant.com/en-us/images/Crosscut_Showcase.mp4, Chokehold_Showcase.mp4,
// Interceptor_Showcase.mp4, Evolution_Showcase.mp4; frame sheets reviewed 2026-11-04).
// Procedural approximation, not extracted game assets. Main entries keep game mechanics.
// All positions are world-space. Every entry returns a handle accepted by vtxEnd (or use h.end()).
// vtxUseGameTick() then vtxTick(dt) hands timing to the game loop (game-dt driven, never wall clock).
// Shared geometry/programs persist; cloned per-effect materials are disposed recursively.
var vtxU = { value: 0 }, vtxLive = [], vtxPumpOn = false, vtxGT = null, vtxGeo = null, vtxProg = {};
function vtxNow() { try { return performance.now() / 1000; } catch (e) { return Date.now() / 1000; } }
function vtxGeos() { if (vtxGeo) return vtxGeo; vtxGeo = {
  sph: new THREE.SphereGeometry(1, 24, 16),
  ring: new THREE.RingGeometry(0.82, 1, 48),
  cone: new THREE.ConeGeometry(0.5, 1, 9, 4),
  plane: new THREE.PlaneGeometry(1, 1, 1, 4),
  box: new THREE.BoxGeometry(1, 1, 1) }; return vtxGeo; }
function vtxShader(k, frag, opts) { if (vtxProg[k]) return vtxProg[k]; const m = new THREE.ShaderMaterial(Object.assign({
  uniforms: { uT: vtxU, uP: { value: 0 }, uSeed: { value: 0 }, uA: { value: 1 } },
  vertexShader: "uniform float uT;uniform float uP;uniform float uSeed;varying vec3 vN;varying vec3 vV;varying vec3 vP;varying vec2 vUv;void main(){vUv=uv;vec3 p=position;vP=p;vec4 mv=modelViewMatrix*vec4(p,1.0);vV=-mv.xyz;vN=normalMatrix*normal;gl_Position=projectionMatrix*mv;}",
  fragmentShader: frag, transparent: true, depthWrite: false, side: THREE.DoubleSide }, opts || {}));
  m.userData.vtx = k; vtxProg[k] = m; return m; }
function vtxMat(k, shader, seed, opts) { const m = vtxShader(k, shader, opts).clone(); m.uniforms.uT = vtxU; if (seed !== undefined) m.uniforms.uSeed.value = seed; return m; }
function vtxBasic(c, o, add) { return new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: o, depthWrite: false, blending: add ? THREE.AdditiveBlending : THREE.NormalBlending, side: THREE.DoubleSide }); }
function vtxPush(fx) { if (vtxLive.length > 24) { const o = vtxLive.shift(); try { o.done(); } catch (e) {} } vtxLive.push(fx); if (!vtxGT && !vtxPumpOn) { vtxPumpOn = true; vtxPump.last = vtxNow(); requestAnimationFrame(vtxPump); } return fx; }
function vtxStep(dt) { vtxU.value += dt; for (let i = vtxLive.length - 1; i >= 0; i--) { const fx = vtxLive[i]; fx.age += dt; try { fx.tick(dt, fx.age, Math.min(1, fx.age / fx.ttl)); } catch (e) { try { xE(e); } catch (e2) {} } if (fx.age >= fx.ttl) { try { fx.done(); } catch (e) {} vtxLive.splice(i, 1); } } }
function vtxPump() { if (vtxGT) { vtxPumpOn = false; return; } const now = vtxNow(), dt = Math.min(0.1, Math.max(0.0005, now - (vtxPump.last || now))); vtxPump.last = now; vtxStep(dt); if (vtxLive.length) requestAnimationFrame(vtxPump); else vtxPumpOn = false; }
function vtxUseGameTick() { vtxGT = true; vtxPumpOn = false; }
function vtxTick(dt) { vtxStep(dt); }
function vtxEnd(h) { if (!h || !h.fx) return; const i = vtxLive.indexOf(h.fx); if (i >= 0) vtxLive.splice(i, 1); try { h.fx.done(); } catch (e) {} }
function vtxDispose(o) { o.traverse((m) => { if (m.material && m.material.dispose) m.material.dispose(); if (m.userData && m.userData.vtxOwnGeo && m.geometry && m.geometry.dispose) m.geometry.dispose(); }); }
function vtxFx(ttl, objs, tick, done) { const fx = { age: 0, ttl, objs, tick, done: done || function () { objs.forEach((o) => { try { scene.remove(o); vtxDispose(o); } catch (e) {} }); } }; objs.forEach((o) => scene.add(o)); vtxPush(fx); return { fx, end: function () { vtxEnd(this); } }; }
function vtxNearPlayer(p, d) { try { return player && Math.hypot(player.x - p.x, player.z - p.z) < d; } catch (e) { return false; } }
// crosscut vortex: swirling cyan-blue liquid spiral (wiki clip)
const vtxVORTEX = "uniform float uT;uniform float uP;uniform float uSeed;varying vec2 vUv;void main(){vec2 q=(vUv-0.5)*2.0;float r=length(q);if(r>1.0)discard;float a=atan(q.y,q.x);float sw=sin(a*3.0-r*9.0+uT*4.0);vec3 c=mix(vec3(0.02,0.15,0.45),vec3(0.30,0.80,1.0),0.5+0.5*sw);c+=vec3(0.6,0.95,1.0)*smoothstep(0.9,1.0,sw)*0.7;c=mix(c,vec3(0.75,0.97,1.0),smoothstep(0.25,0.0,r));float a2=(0.35+0.6*(0.5+0.5*sw))*(1.0-smoothstep(0.9,1.0,r))*(1.0-uP);gl_FragColor=vec4(c,a2);}";
// chokehold tendril: near-black viscous strand, violet-blue sheen, viscous drip falloff
const vtxGOO = "uniform float uT;uniform float uP;uniform float uSeed;varying vec3 vN;varying vec3 vV;varying vec2 vUv;void main(){float f=pow(1.0-abs(dot(normalize(vN),normalize(vV))),1.4);float w=sin(vUv.y*8.0+uT*2.6+uSeed*7.0)*sin(vUv.x*6.0-uT*1.9);vec3 c=mix(vec3(0.03,0.03,0.09),vec3(0.25,0.20,0.65),f)*(0.85+0.3*w);c+=vec3(0.20,0.60,1.0)*f*f*0.4;float width=0.30*(1.0-vUv.y*0.55);float edge=1.0-smoothstep(width*0.4,width,abs(vUv.x-0.5));float a=edge*smoothstep(0.0,0.15,vUv.y)*(1.0-smoothstep(0.6,1.0,vUv.y))*(0.6+0.4*w)*(1.0-uP);if(a<0.003)discard;gl_FragColor=vec4(c,a);}";
// interceptor lens: teal-green glowing core
const vtxLENS = "uniform float uT;uniform float uP;uniform float uSeed;varying vec3 vN;varying vec3 vV;varying vec2 vUv;void main(){float f=pow(1.0-abs(dot(normalize(vN),normalize(vV))),1.4);float p=0.7+0.3*sin(uT*4.0+uSeed);vec3 c=mix(vec3(0.55,1.0,0.75),vec3(0.05,0.55,0.35),f)*p;float a=(0.95-0.5*f)*(1.0-uP);gl_FragColor=vec4(c,a);}";
// evolution shard: dark red crystal with glowing crimson veins
const vtxVEIN = "uniform float uT;uniform float uP;uniform float uSeed;varying vec3 vN;varying vec3 vV;varying vec2 vUv;void main(){float f=pow(1.0-abs(dot(normalize(vN),normalize(vV))),1.2);float vein=smoothstep(0.75,0.95,abs(sin(vUv.y*14.0+vUv.x*9.0+uSeed*5.0)));float pulse=0.6+0.4*sin(uT*5.0+uSeed*3.0);vec3 c=mix(vec3(0.10,0.02,0.03),vec3(1.0,0.15,0.08),vein*pulse);c+=vec3(1.0,0.3,0.15)*f*0.35;float a=(0.9-0.3*f)*(1.0-uP);gl_FragColor=vec4(c,a);}";
// ---- screen veils (DOM, CSS injected once) ----
function vtxCss() { if (document.getElementById("vtxCss")) return; const s = document.createElement("style"); s.id = "vtxCss"; s.textContent =
  ".vtxV{position:fixed;inset:0;pointer-events:none;z-index:6;background-repeat:no-repeat;opacity:0;transition:opacity .15s}" +
  "@keyframes vtxPulse{0%,100%{opacity:.75}50%{opacity:1}}" +
  ".vtxVTp{background:radial-gradient(80% 80% at 50% 50%,rgba(40,140,255,.55) 0%,rgba(10,60,180,.75) 55%,rgba(4,20,70,.92) 100%)}" +
  ".vtxVEvo{background:radial-gradient(130% 130% at 50% 50%,rgba(120,0,0,0) 42%,rgba(160,10,5,.45) 78%,rgba(220,30,10,.6) 100%),repeating-conic-gradient(from 20deg at 50% 50%,rgba(255,40,15,0) 0deg 14deg,rgba(255,45,18,.28) 15deg 16deg,rgba(255,40,15,0) 17deg 33deg);animation:vtxPulse 0.9s ease-in-out infinite}";
  (document.head || document.documentElement).appendChild(s); }
function vtxVeil(kind, seconds) { try { vtxCss(); const d = document.createElement("div"); d.className = "vtxV vtxV" + kind; document.body.appendChild(d); d.style.opacity = "1";
  const life = seconds || (kind === "Evo" ? 12 : 0.7);
  return vtxFx(life, [], (dt, age) => { d.style.opacity = String(Math.min(1, Math.max(0, (life - age) / 0.3))); }, () => d.remove()); } catch (e) { return null; } }
// ---- entries ----
// Crosscut vortex marker: swirling blue liquid disc + orbiting wisps; handle lives until end()
function vtxCrosscut(p) { try { const G = vtxGeos();
  const grp = new THREE.Group(); grp.position.set(p.x, (p.y || 0), p.z);
  const disc = new THREE.Mesh(new THREE.CircleGeometry(0.7, 36), vtxMat("vortex", vtxVORTEX, 0)); disc.userData.vtxOwnGeo = true; disc.rotation.x = -Math.PI / 2; disc.position.y = 0.06; grp.add(disc);
  const core = new THREE.Mesh(G.sph, vtxBasic(0x9fe0ff, 0.8, true)); core.scale.setScalar(0.09); core.position.y = 0.22; grp.add(core);
  const wisps = []; for (let i = 0; i < 3; i++) { const w = new THREE.Mesh(G.plane, vtxBasic(0x55b8ff, 0.5, true)); w.scale.set(0.16, 0.3, 1); grp.add(w); wisps.push(w); }
  return vtxFx(1e9, [grp], (dt, age) => { wisps.forEach((w, i) => { const a = vtxU.value * 1.8 + i * Math.PI * 2 / 3; w.position.set(Math.cos(a) * 0.5, 0.3 + Math.sin(vtxU.value * 3 + i) * 0.12, Math.sin(a) * 0.5); w.rotation.y = -a + Math.PI / 2; });
    core.material.opacity = 0.8 * (0.7 + 0.3 * Math.sin(vtxU.value * 5)); }); } catch (e) { try { window.vtxErr = String(e && e.stack || e).slice(0, 300); xE(e); } catch (e2) {} return null; } }
// Crosscut teleport: blue liquid-energy swirl column at both ends + cyan veil for the caster
function vtxCrosscutTP(from, to, opts) { try { const G = vtxGeos();
  const own = opts && typeof opts.caster === "boolean" ? opts.caster : (vtxNearPlayer(from, 2.5) || vtxNearPlayer(to, 2.5));
  if (own) vtxVeil("Tp");
  const mk = (p, converge) => { const grp = new THREE.Group(); grp.position.set(p.x, (p.y || 0), p.z);
    const strips = []; for (let i = 0; i < 5; i++) { const m = new THREE.Mesh(G.plane, vtxBasic(i % 2 ? 0x2f8fff : 0x7fd4ff, 0.75, true)); m.scale.set(0.35, 1.9, 1); m.userData.a = i * Math.PI * 2 / 5; grp.add(m); strips.push(m); }
    const flash = new THREE.Mesh(G.sph, vtxBasic(0x9fe0ff, 0.7, true)); flash.scale.setScalar(0.4); flash.position.y = 0.7; grp.add(flash);
    const ring = new THREE.Mesh(G.ring, vtxBasic(0x55b8ff, 0.6, true)); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.06; grp.add(ring);
    vtxFx(1.0, [grp], (dt, age, k) => { strips.forEach((m) => { const a = m.userData.a + age * (converge ? -7 : 7); const r = (converge ? 0.9 * (1 - k * 0.7) : 0.4 + k * 0.6); m.position.set(Math.cos(a) * r, 1.0, Math.sin(a) * r); m.rotation.y = -a + Math.PI / 2; m.material.opacity = 0.75 * (1 - k); });
      flash.material.opacity = 0.7 * Math.max(0, 1 - age / 0.3); flash.scale.setScalar(0.4 + age * 1.2); ring.scale.setScalar(0.3 + age * 3); ring.material.opacity = 0.6 * (1 - k); }); };
  mk(from, false); mk(to, true); return null; } catch (e) { try { window.vtxErr = String(e && e.stack || e).slice(0, 300); xE(e); } catch (e2) {} return null; } }
// Chokehold: stealthed viscous fragment, faint dark shimmer + tiny blue glint; handle lives until end()/trigger
function vtxChokehold(p, seconds) { try { const G = vtxGeos(), ttl = Math.max(1, seconds || 30);
  const blob = new THREE.Mesh(G.sph, vtxMat("goo", vtxGOO, 2.2)); blob.scale.set(0.22, 0.10, 0.22); blob.position.set(p.x, (p.y || 0) + 0.05, p.z);
  const glint = new THREE.Mesh(G.sph, vtxBasic(0x55b8ff, 0.35, true)); glint.scale.setScalar(0.03); glint.position.set(p.x, (p.y || 0) + 0.10, p.z);
  const fx = vtxFx(ttl, [blob, glint], (dt, age) => { const die = Math.max(0, (age - (ttl - 0.3)) / 0.3);
    blob.material.uniforms.uA.value = 0.10 + 0.05 * Math.sin(vtxU.value * 2); blob.material.uniforms.uP.value = die;
    glint.material.opacity = (0.18 + 0.17 * Math.sin(vtxU.value * 3.4)) * (1 - die); });
  return fx; } catch (e) { try { window.vtxErr = String(e && e.stack || e).slice(0, 300); xE(e); } catch (e2) {} return null; } }
// Chokehold trigger: dark viscous tendrils lash up over a glossy goo pool
function vtxChokeSnare(p, seconds) { try { const G = vtxGeos(), ttl = Math.max(1, seconds || 4.5);
  const grp = new THREE.Group(); grp.position.set(p.x, (p.y || 0), p.z);
  const pool = new THREE.Mesh(new THREE.CircleGeometry(1.6, 28), vtxBasic(0x0a0a1e, 0.85, false)); pool.userData.vtxOwnGeo = true; pool.rotation.x = -Math.PI / 2; pool.position.y = 0.04; grp.add(pool);
  const tens = []; for (let i = 0; i < 7; i++) { const m = new THREE.Mesh(G.plane, vtxMat("goo", vtxGOO, i * 1.9)); const a = i * Math.PI * 2 / 7;
    m.scale.set(0.5, 1.7, 1); m.position.set(Math.cos(a) * 0.7, 0.9, Math.sin(a) * 0.7); m.rotation.y = -a + Math.PI / 2; m.userData.a = a; grp.add(m); tens.push(m); }
  const vein = new THREE.Mesh(G.ring, vtxBasic(0x3f8fff, 0.5, true)); vein.rotation.x = -Math.PI / 2; vein.position.y = 0.06; vein.scale.setScalar(1.6); grp.add(vein);
  return vtxFx(ttl, [grp], (dt, age) => { const g = Math.min(1, age / 0.3), die = Math.max(0, (age - (ttl - 0.5)) / 0.5);
    pool.scale.setScalar(Math.max(0.05, g) * (1 - die * 0.5)); pool.material.opacity = 0.85 * (1 - die);
    tens.forEach((m) => { const r = 0.7 * (1 - g * 0.4); m.position.x = Math.cos(m.userData.a) * r; m.position.z = Math.sin(m.userData.a) * r; m.material.uniforms.uP.value = die; m.scale.y = 1.7 * g * (1 - die); });
    vein.material.opacity = 0.5 * (0.5 + 0.5 * Math.sin(vtxU.value * 6)) * (1 - die); }); } catch (e) { try { window.vtxErr = String(e && e.stack || e).slice(0, 300); xE(e); } catch (e2) {} return null; } }
// Interceptor: angular device with a teal-green lens; scan ring pulses over its radius while active
function vtxInterceptor(p, r, seconds) { try { const G = vtxGeos(), ttl = Math.max(1, seconds || 30), R = r || 10;
  const body = new THREE.Mesh(G.box, vtxBasic(0x141a22, 0.95, false)); body.scale.set(0.18, 0.14, 0.18); body.position.set(p.x, (p.y || 0) + 0.09, p.z); body.rotation.y = 0.7;
  const lens = new THREE.Mesh(G.sph, vtxMat("lens", vtxLENS, 0)); lens.scale.setScalar(0.055); lens.position.set(p.x, (p.y || 0) + 0.19, p.z);
  const scan = new THREE.Mesh(G.ring, vtxBasic(0x4ae8a0, 0.0, true)); scan.rotation.x = -Math.PI / 2; scan.position.set(p.x, (p.y || 0) + 0.06, p.z);
  const fx = vtxFx(ttl, [body, lens, scan], (dt, age) => { const ph = age % 1.6; const die = Math.max(0, (age - (ttl - 0.4)) / 0.4);
    scan.scale.setScalar(Math.max(0.2, ph / 1.6 * R)); scan.material.opacity = Math.max(0, 0.28 * (1 - ph / 1.6)) * (1 - die);
    lens.material.uniforms.uP.value = die; body.material.opacity = 0.95 * (1 - die); });
  return fx; } catch (e) { try { window.vtxErr = String(e && e.stack || e).slice(0, 300); xE(e); } catch (e2) {} return null; } }
// Interceptor zap: bright green beam from the device to the destroyed utility + spark burst
function vtxInterceptorZap(from, to) { try { const G = vtxGeos();
  const d = new THREE.Vector3(to.x - from.x, (to.y || 0.5) - (from.y || 0.2), to.z - from.z), L = d.length();
  const beam = new THREE.Mesh(G.plane, vtxBasic(0x6affb0, 0.9, true)); beam.scale.set(L, 0.06, 1);
  beam.position.set((from.x + to.x) / 2, ((from.y || 0.2) + (to.y || 0.5)) / 2, (from.z + to.z) / 2);
  beam.lookAt(to.x, to.y || 0.5, to.z); beam.rotateY(Math.PI / 2);
  const spark = new THREE.Mesh(G.sph, vtxBasic(0xaaffd0, 0.9, true)); spark.scale.setScalar(0.15); spark.position.set(to.x, to.y || 0.5, to.z);
  const shards = []; for (let i = 0; i < 5; i++) { const s = new THREE.Mesh(G.plane, vtxBasic(0x4ae8a0, 0.8, true)); s.scale.set(0.05, 0.3, 1); s.position.copy(spark.position); s.userData.v = new THREE.Vector3(Math.sin(i * 2.4) * 3, 2.5 + (i % 3), Math.cos(i * 2.4) * 3); scene.add(s); shards.push(s); }
  const fx = vtxFx(0.4, [beam, spark], (dt, age, k) => { beam.material.opacity = 0.9 * (1 - k); spark.scale.setScalar(0.15 + age * 1.4); spark.material.opacity = 0.9 * (1 - k);
    shards.forEach((s) => { s.position.addScaledVector(s.userData.v, dt); s.userData.v.y -= 14 * dt; s.material.opacity = 0.8 * (1 - k); s.rotation.z += dt * 9; }); },
  function () { [beam, spark].concat(shards).forEach((o) => { try { scene.remove(o); vtxDispose(o); } catch (e) {} }); });
  fx.fx.objs = fx.fx.objs.concat(shards); return fx; } catch (e) { try { window.vtxErr = String(e && e.stack || e).slice(0, 300); xE(e); } catch (e2) {} return null; } }
// Evolution: red vein-crack screen edge veil for the duration + crimson crystal shard burst at cast
function vtxEvolution(p, seconds) { try { const G = vtxGeos(), ttl = Math.max(1, seconds || 12);
  const veil = vtxVeil("Evo", ttl);
  const grp = new THREE.Group(); grp.position.set(p.x, (p.y || 0), p.z);
  const shards = []; for (let i = 0; i < 9; i++) { const m = new THREE.Mesh(G.cone, vtxMat("vein", vtxVEIN, i * 1.4)); const a = i * Math.PI * 2 / 9;
    const h = 0.7 + (i % 3) * 0.5; m.scale.set(0.14, h, 0.14); m.position.set(Math.cos(a) * 0.9, h * 0.3, Math.sin(a) * 0.9);
    m.rotation.set(Math.cos(a) * 0.7, 0, -Math.sin(a) * 0.7); m.userData.h = h; m.userData.d = i * 0.03; grp.add(m); shards.push(m); }
  vtxFx(1.1, [grp], (dt, age, k) => { shards.forEach((m) => { const g = Math.min(1, Math.max(0, (age - m.userData.d) / 0.2)); const up = 1 - Math.pow(1 - g, 3); m.scale.set(0.14 * up, m.userData.h * up * (1 - k * 0.6), 0.14 * up); m.material.uniforms.uP.value = k * k; }); });
  return veil; } catch (e) { try { window.vtxErr = String(e && e.stack || e).slice(0, 300); xE(e); } catch (e2) {} return null; } }
function vtxReset() { while (vtxLive.length) vtxEnd({ fx: vtxLive[0] }); document.querySelectorAll(".vtxV").forEach((e) => e.remove()); }
// ---- END VETO FX ----
