// ---- CHAMBER FX ----
// Chamber ability visuals (work/chamber_fx_runtime.js), reference-grounded in the wiki
// showcase clips (wiki.playvalorant.com/en-us/images/Trademark_Showcase.mp4,
// Headhunter_Showcase.mp4, Rendezvous_Showcase.mp4, Tour_De_Force_Showcase.mp4),
// phase-timed from the clips 2026-11-04. Procedural approximation, not extracted game
// assets. Game mechanics stay in the caller.
//
// Reference look targets (clip-measured):
//   Trademark: placed gold card trap with a small glint; trigger = an ornate golden circular
//     field (concentric rings + radial deco spokes, warm gold/amber) under the enemy, 4 s
//     (server DEV.trademark: 0.9 s windup, 6 m radius, 4 s field).
//   Headhunter: golden pistol shots = gold tracer, golden muzzle bloom, gold impact sparks;
//     optional viewmodel gild = gold shimmer + orbiting card shards while the gun is out.
//   Rendezvous: anchor = dark card with a golden mark + gold ring shimmer; while it is up
//     the caster's screen carries golden art-deco chevron side bars; teleport = gold
//     card-shard burst at both ends + a gold-magenta ribbon swirl veil (~0.7-1 s, clip).
//   Tour De Force: equip/idle gild as Headhunter (purple tint); ADS = gold chamfered
//     octagonal screen frame (chxTdfAim(true/false)); shots = purple-magenta heavy tracer
//     with a golden muzzle bloom; a kill bursts purple-gold shards over the victim, then
//     the server slow field reuses the golden Trademark field.
//
// Contract (integrator owns index.html wiring): entries take world positions ({x,y,z} or
// [x,y,z]) and return {fx, end()}; end() plays a short fade then disposes cloned materials
// recursively; shared geometries/programs persist. chxUseGameTick() hands timing to the game
// loop (chxTick(dt) per frame, client-capped dt); otherwise a bounded rAF pump runs while
// effects live. No loaders/textures at module load; everything procedural and lazy.
// Globals used (read-only): THREE, scene; camera/player/xE are optional and guarded.
//
// Server vs client: device bodies are server snapshot rows ('dev' rows) owned by the game:
//   Trademark DEV.trademark (life 120, arm .9, radius 6, field 4) - client XTMK.
//   Headhunter / Tour De Force are gun swaps; fx here are tracers, gild and the ADS frame.
//   Rendezvous: ULT? no - signature E: anchor device rows + 30 s recharge; chxAnchorPlace at
//     the anchor, chxAnchorAura(true/false) while the caster has a live anchor,
//     chxRendezvous(at, {caster}) on the 1.3 s server teleport (veil only for the caster).
var chxU = { value: 0 }, chxLive = [], chxPumpOn = false, chxGT = null, chxGeo = null;
function chxNow() { try { return performance.now() / 1000; } catch (e) { return Date.now() / 1000; } }
function chxErr(e) { try { xE(e); } catch (e2) {} }
function chxGeos() { if (chxGeo) return chxGeo; chxGeo = {
  sph: new THREE.SphereGeometry(1, 18, 12),
  circle: new THREE.CircleGeometry(1, 64),
  ring: new THREE.RingGeometry(0.86, 1, 64),
  ringThin: new THREE.RingGeometry(0.955, 1, 64),
  plane: new THREE.PlaneGeometry(1, 1),
  beam: new THREE.CylinderGeometry(1, 1, 1, 6, 1, true),
  card: new THREE.PlaneGeometry(0.22, 0.32) }; return chxGeo; }
function chxV3(p) { return Array.isArray(p) ? new THREE.Vector3(p[0], p[1] || 0, p[2]) : new THREE.Vector3(p.x, p.y || 0, p.z); }
function chxBasic(c, o, add) { return new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: o, depthWrite: false, blending: add ? THREE.AdditiveBlending : THREE.NormalBlending, side: THREE.DoubleSide, fog: false, toneMapped: false }); }
var chxProg = {};
function chxShader(k, frag) { if (chxProg[k]) return chxProg[k]; const m = new THREE.ShaderMaterial({
  uniforms: { uT: chxU, uP: { value: 0 }, uSeed: { value: 0 }, uOp: { value: 1 } },
  vertexShader: "uniform float uT;uniform float uSeed;varying vec3 vN;varying vec3 vV;varying vec2 vUv;void main(){vUv=uv;vec4 mv=modelViewMatrix*vec4(position,1.0);vV=-mv.xyz;vN=normalMatrix*normal;gl_Position=projectionMatrix*mv;}",
  fragmentShader: frag, transparent: true, depthWrite: false, side: THREE.DoubleSide });
  m.userData.chx = k; chxProg[k] = m; return m; }
function chxMat(k, frag, seed) { const m = chxShader(k, frag).clone(); m.uniforms.uT = chxU; if (seed !== undefined) m.uniforms.uSeed.value = seed; return m; }
// ornate golden slow field (Trademark / Tour De Force kills): concentric deco rings + spokes
const chxFIELD = "uniform float uT;uniform float uOp;varying vec2 vUv;\nvoid main(){vec2 q=vUv*2.0-1.0;float r=length(q);if(r>1.0)discard;float ang=atan(q.y,q.x);\nfloat rings=smoothstep(0.012,0.0,abs(r-0.33)-0.008)+smoothstep(0.012,0.0,abs(r-0.62)-0.008)+smoothstep(0.016,0.0,abs(r-0.88)-0.01);\nfloat spokes=step(0.93,sin(ang*12.0))*smoothstep(0.3,0.36,r)*(1.0-smoothstep(0.58,0.64,r));\nfloat arcs=step(0.55,sin(ang*24.0+r*6.0))*smoothstep(0.66,0.7,r)*(1.0-smoothstep(0.84,0.88,r));\nfloat centre=smoothstep(0.2,0.0,r)*0.7;\nfloat pat=clamp(rings+spokes+arcs+centre,0.0,1.0);\nfloat wash=(1.0-smoothstep(0.0,0.95,r))*0.22;\nvec3 col=mix(vec3(0.83,0.63,0.09),vec3(1.0,0.87,0.45),pat);\ncol=mix(col,vec3(0.45,0.12,0.10),(1.0-pat)*0.35*smoothstep(0.55,0.95,r));\nfloat a=(pat*0.75+wash)*uOp;\nif(a<0.006)discard;gl_FragColor=vec4(col,a);}";
// golden tracer beam: hot white-gold core
const chxGOLD = "uniform float uT;uniform float uOp;uniform float uSeed;varying vec2 vUv;\nvoid main(){float x=abs(vUv.x-0.5)*2.0;float core=smoothstep(0.3,0.0,x);float glow=exp(-x*4.5)*0.5;\nfloat fl=0.8+0.2*sin(uT*40.0+uSeed*17.0+vUv.y*24.0);\nvec3 col=mix(vec3(1.0,0.76,0.29),vec3(1.0,0.97,0.8),core);\nfloat a=(core+glow)*fl*uOp;gl_FragColor=vec4(col,a);}";
// Tour De Force tracer: violet-magenta core with gold shimmer
const chxTDF = "uniform float uT;uniform float uOp;uniform float uSeed;varying vec2 vUv;\nvoid main(){float x=abs(vUv.x-0.5)*2.0;float core=smoothstep(0.3,0.0,x);float glow=exp(-x*4.0)*0.5;\nfloat fl=0.8+0.2*sin(uT*34.0+uSeed*13.0+vUv.y*20.0);\nvec3 col=mix(vec3(0.69,0.25,0.91),vec3(1.0,0.85,1.0),core);\ncol+=vec3(1.0,0.76,0.29)*pow(core,3.0)*0.5;\nfloat a=(core+glow)*fl*uOp;gl_FragColor=vec4(col,a);}";
// ---- effect core (contract: handle + end, game-dt driven, cloned materials disposed) ----
function chxPush(fx) { if (chxLive.length > 32) { const o = chxLive.shift(); try { o.done(); } catch (e) {} } chxLive.push(fx); if (!chxGT && !chxPumpOn) { chxPumpOn = true; chxPump.last = chxNow(); requestAnimationFrame(chxPump); } return fx; }
function chxPump() { if (chxGT) { chxPumpOn = false; return; } const now = chxNow(), dt = Math.min(0.1, Math.max(0.0005, now - (chxPump.last || now))); chxPump.last = now; chxStep(dt); if (chxLive.length) requestAnimationFrame(chxPump); else chxPumpOn = false; }
function chxStep(dt) { chxU.value += dt; for (let i = chxLive.length - 1; i >= 0; i--) { const fx = chxLive[i]; fx.age += dt;
  if (fx.dying) { fx.fade -= dt / 0.3; if (fx.fade <= 0) { try { fx.done(); } catch (e) {} chxLive.splice(i, 1); continue; } }
  const k = Math.min(1, fx.age / fx.ttl); try { fx.tick(dt, fx.age, k, fx); } catch (e) { chxErr(e); }
  if (!fx.dying && fx.age >= fx.ttl) { try { fx.done(); } catch (e) {} chxLive.splice(i, 1); } } }
function chxUseGameTick() { chxGT = true; chxPumpOn = false; } // integrator then calls chxTick(dt) per frame
function chxTick(dt) { chxStep(Math.min(0.1, Math.max(0.0005, dt || 0.016))); }
function chxEnd(h) { const fx = h && h.fx; if (!fx) return; const i = chxLive.indexOf(fx); if (i < 0) return; if (fx.grace === false) { chxLive.splice(i, 1); try { fx.done(); } catch (e) {} } else fx.dying = true; }
function chxReset() { while (chxLive.length) { const fx = chxLive.pop(); try { fx.done(); } catch (e) {} } document.querySelectorAll(".chxV").forEach((d) => d.remove()); }
function chxFx(ttl, objs, tick, done) { const fx = { age: 0, ttl, fade: 1, dying: false, objs, tick, done: done || function () { objs.forEach((o) => { try { scene.remove(o); o.traverse((m) => { if (m.material && m.material.dispose) m.material.dispose(); if (m.geometry && m.geometry.userData && m.geometry.userData.chxOwn) m.geometry.dispose(); }); } catch (e) {} }); } }; objs.forEach((o) => scene.add(o)); chxPush(fx); return { fx, end: function () { chxEnd(this); } }; }
function chxBill(m) { try { if (typeof camera !== "undefined" && camera) m.lookAt(camera.position); } catch (e) {} }
// gold card shards bursting outward then gone (Rendezvous / TdF kill)
function chxShards(grp, n, col, r, up, scale) { const G = chxGeos(), out = [], mat = chxBasic(col, 0.9, true);
  for (let i = 0; i < n; i++) { const m = new THREE.Mesh(G.card, mat); m.scale.setScalar(scale || 1); const a = Math.random() * 6.2832;
    m.userData = { vx: Math.cos(a) * (0.6 + Math.random() * r), vz: Math.sin(a) * (0.6 + Math.random() * r), vy: (up || 2.2) * (0.5 + Math.random()), rx: (Math.random() - 0.5) * 9, ry: (Math.random() - 0.5) * 9 };
    m.position.set(0, 0.3 + Math.random() * 0.4, 0); m.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3); grp.add(m); out.push(m); }
  out.mat = mat;
  out.tick = function (dt, age, fade) { mat.opacity = 0.9 * fade; out.forEach((m) => { const u = m.userData; m.position.x += u.vx * dt; m.position.z += u.vz * dt; m.position.y += u.vy * dt; u.vy -= 4.5 * dt; m.rotation.x += u.rx * dt; m.rotation.y += u.ry * dt; }); };
  return out; }
// ---- full-screen caster effects (DOM, CSS injected once) ----
function chxCss() { if (document.getElementById("chxCss")) return; const s = document.createElement("style"); s.id = "chxCss"; s.textContent =
  ".chxV{position:fixed;inset:0;pointer-events:none;z-index:6;opacity:0;transition:opacity .3s}" +
  ".chxVAura{background:linear-gradient(90deg,rgba(255,196,64,.95) 0%,rgba(255,196,64,0) 2%,rgba(255,196,64,0) 98%,rgba(255,196,64,.95) 100%),repeating-linear-gradient(45deg,rgba(255,214,120,.5) 0 9px,rgba(255,214,120,0) 9px 24px),repeating-linear-gradient(-45deg,rgba(216,152,23,.45) 0 9px,rgba(216,152,23,0) 9px 24px);background-size:100% 100%,6.5vmin 100%,6.5vmin 100%;background-position:0 0,left 0,right 0;background-repeat:no-repeat,repeat-y,repeat-y;opacity:0}" +
  ".chxVAura.on{opacity:1}" +
  ".chxVAim{transition:opacity .18s}" +
  "@keyframes chxVeilFlow{from{transform:translateX(-7%) scaleY(1.12);opacity:.2}30%{opacity:1}to{transform:translateX(0) scaleY(1);opacity:1}}" +
  ".chxVTp{background:radial-gradient(75% 75% at 50% 50%,rgba(70,30,10,.18) 0%,rgba(40,18,6,.42) 100%)}";
  (document.head || document.documentElement).appendChild(s); }
var chxAuraEl = null;
function chxAnchorAura(on) { try { chxCss();
  if (on) { if (!chxAuraEl || !chxAuraEl.isConnected) { chxAuraEl = document.createElement("div"); chxAuraEl.className = "chxV chxVAura"; document.body.appendChild(chxAuraEl); requestAnimationFrame(() => { if (chxAuraEl) chxAuraEl.classList.add("on"); }); } return chxAuraEl; }
  if (chxAuraEl) { chxAuraEl.remove(); chxAuraEl = null; } return null; } catch (e) { chxErr(e); return null; } }
var chxAimEl = null;
function chxTdfAim(on) { try { chxCss();
  if (on) { if (!chxAimEl || !chxAimEl.isConnected) { chxAimEl = document.createElement("div"); chxAimEl.className = "chxV chxVAim";
      chxAimEl.innerHTML = "<svg viewBox='0 0 100 100' preserveAspectRatio='none' style='position:absolute;inset:0;width:100%;height:100%'><polygon points='20.5,10.7 79.8,10.7 84,23 84,30 86.8,33.5 86.8,65.5 84.1,68.5 84.1,77.5 77.3,88.1 23,88.1 16,77.5 16,68.5 13.2,65.5 13.2,33.5 16,30 16,23' fill='none' stroke='rgba(255,80,25,.45)' stroke-width='18' vector-effect='non-scaling-stroke' style='filter:drop-shadow(0 0 22px rgba(255,90,20,.95))'/><polygon points='20.5,10.7 79.8,10.7 84,23 84,30 86.8,33.5 86.8,65.5 84.1,68.5 84.1,77.5 77.3,88.1 23,88.1 16,77.5 16,68.5 13.2,65.5 13.2,33.5 16,30 16,23' fill='none' stroke='rgba(255,150,30,.9)' stroke-width='9' vector-effect='non-scaling-stroke' style='filter:drop-shadow(0 0 10px rgba(255,140,30,.9))'/><polygon points='20.5,10.7 79.8,10.7 84,23 84,30 86.8,33.5 86.8,65.5 84.1,68.5 84.1,77.5 77.3,88.1 23,88.1 16,77.5 16,68.5 13.2,65.5 13.2,33.5 16,30 16,23' fill='none' stroke='rgba(255,222,80,1)' stroke-width='4.2' vector-effect='non-scaling-stroke'/><polygon points='23.4,14.6 76.8,14.6 80.6,25.7 80.6,32.0 83.1,35.1 83.1,64.0 80.7,66.7 80.7,74.8 74.6,84.3 25.7,84.3 19.4,74.8 19.4,66.7 16.9,64.0 16.9,35.1 19.4,32.0 19.4,25.7' fill='none' stroke='rgba(216,152,23,.6)' stroke-width='1' vector-effect='non-scaling-stroke'/></svg>";
      document.body.appendChild(chxAimEl); } chxAimEl.style.opacity = "1"; return chxAimEl; }
  if (chxAimEl) chxAimEl.style.opacity = "0"; return null; } catch (e) { chxErr(e); return null; } }
// ---- Trademark ----
function chxTrademarkPlace(p) { try { const G = chxGeos(), P = chxV3(p), grp = new THREE.Group(); grp.position.copy(P);
  const ring = new THREE.Mesh(G.ringThin, chxBasic(0xffc24a, 0.7, true)); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.06; ring.scale.setScalar(0.3); grp.add(ring);
  const glint = new THREE.Mesh(G.sph, chxBasic(0xffd68a, 0.7, true)); glint.scale.setScalar(0.09); glint.position.y = 0.1; grp.add(glint);
  return chxFx(1e9, [grp], (dt, age, k, fx) => { ring.material.opacity = Math.max(0, 0.7 * (1 - age / 2)) * fx.fade * (0.7 + 0.3 * Math.sin(chxU.value * 3)); ring.scale.setScalar(0.3 + Math.min(1, age / 2) * 0.4);
    const blink = (chxU.value % 1.6) < 0.12 ? 1 : 0.15; glint.material.opacity = 0.7 * blink * fx.fade; }); } catch (e) { chxErr(e); return null; } }
function chxSlowField(p, r, secs) { try { const G = chxGeos(), P = chxV3(p), R = r || 6, T = secs || 4, grp = new THREE.Group(); grp.position.copy(P);
  const field = new THREE.Mesh(G.circle, chxMat("field", chxFIELD, 0)); field.rotation.x = -Math.PI / 2; field.position.y = 0.06; field.scale.setScalar(0.01); field.renderOrder = 2; grp.add(field);
  const rim = new THREE.Mesh(G.ringThin, chxBasic(0xffc24a, 0.65, true)); rim.rotation.x = -Math.PI / 2; rim.position.y = 0.07; rim.scale.setScalar(0.01); grp.add(rim);
  const flash = new THREE.Mesh(G.sph, chxBasic(0xffd68a, 0, true)); flash.scale.setScalar(R * 0.4); flash.position.y = 0.4; grp.add(flash);
  return chxFx(T, [grp], (dt, age, k, fx) => { const grow = Math.min(1, age / 0.25), die = Math.max(0, (age - (T - 0.5)) / 0.5), env = grow * (1 - die);
    field.scale.setScalar(Math.max(0.01, R * grow)); field.material.uniforms.uOp.value = env * fx.fade; field.rotation.z = age * 0.12;
    rim.scale.setScalar(Math.max(0.01, R * grow)); rim.material.opacity = 0.65 * env * fx.fade * (0.7 + 0.3 * Math.sin(chxU.value * 5));
    flash.material.opacity = Math.max(0, 0.6 * (1 - age / 0.35)) * fx.fade; }); } catch (e) { chxErr(e); return null; } }
// ---- Headhunter / Tour De Force shots ----
function chxShot(o, d, len, shader, muzzle, impact) { try { const G = chxGeos(), O = chxV3(o), D = chxV3(d).normalize(), L = len || 60;
  const mid = O.clone().addScaledVector(D, L / 2), up = new THREE.Vector3(0, 1, 0);
  const core = new THREE.Mesh(G.beam, chxMat(shader === "tdf" ? "tdf" : "gold", shader === "tdf" ? chxTDF : chxGOLD, Math.random() * 9));
  core.scale.set(shader === "tdf" ? 0.07 : 0.045, L, shader === "tdf" ? 0.07 : 0.045); core.position.copy(mid);
  core.quaternion.setFromUnitVectors(up, D);
  const mz = new THREE.Mesh(G.sph, chxBasic(muzzle, 0.85, true)); mz.scale.setScalar(shader === "tdf" ? 0.2 : 0.14); mz.position.copy(O);
  const end = O.clone().addScaledVector(D, L);
  const hit = new THREE.Mesh(G.sph, chxBasic(impact, 0.75, true)); hit.scale.setScalar(0.1); hit.position.copy(end);
  return chxFx(0.16, [core, mz, hit], (dt, age, k, fx) => { const f = (1 - k) * fx.fade;
    core.material.uniforms.uOp.value = f; mz.material.opacity = 0.85 * f; mz.scale.setScalar((shader === "tdf" ? 0.2 : 0.14) + k * 0.14);
    hit.material.opacity = 0.75 * f; hit.scale.setScalar(0.1 + k * 0.16); }); } catch (e) { chxErr(e); return null; } }
function chxHeadhunterShot(o, d, len) { return chxShot(o, d, len || 60, "gold", 0xffd68a, 0xffe0a0); }
function chxTdfShot(o, d, len) { return chxShot(o, d, len || 100, "tdf", 0xe0a0ff, 0xd84df0); }
// ---- viewmodel gild (Headhunter / Tour De Force out): gold shimmer + orbiting shards ----
function chxGunGild(viewmodelGroup, tdf) { try { const G = chxGeos(), grp = new THREE.Group(); grp.name = tdf ? "chx-tdf" : "chx-hh";
  const glow = new THREE.Mesh(G.sph, chxBasic(tdf ? 0xd84df0 : 0xffc24a, 0.22, true)); glow.scale.set(0.16, 0.1, 0.3); grp.add(glow);
  const shards = []; for (let i = 0; i < 3; i++) { const m = new THREE.Mesh(G.card, chxBasic(0xffd68a, 0.8, true)); m.scale.setScalar(0.4); grp.add(m); shards.push(m); }
  (viewmodelGroup || scene).add(grp);
  const fx = { age: 0, ttl: 1e9, fade: 1, dying: false, objs: [], tick: function () {}, done: function () { try { (viewmodelGroup || scene).remove(grp); grp.traverse((m) => { if (m.material && m.material.dispose) m.material.dispose(); }); } catch (e) {} } };
  fx.tick = function (dt, age, k, fxf) { glow.material.opacity = 0.22 * fxf.fade * (0.7 + 0.3 * Math.sin(chxU.value * 4));
    shards.forEach((m, i) => { const a = chxU.value * 1.8 + i * 2.094; m.position.set(Math.cos(a) * 0.12, Math.sin(chxU.value * 2.4 + i) * 0.03, Math.sin(a) * 0.12 - 0.05); m.rotation.y = a; m.material.opacity = 0.8 * fxf.fade; }); };
  chxPush(fx); return { fx, end: function () { chxEnd(this); } }; } catch (e) { chxErr(e); return null; } }
// ---- Rendezvous ----
function chxAnchorPlace(p) { try { const G = chxGeos(), P = chxV3(p), grp = new THREE.Group(); grp.position.copy(P);
  const card = new THREE.Mesh(G.card, chxBasic(0x14101e, 0.95, false)); card.rotation.x = -Math.PI / 2; card.position.y = 0.04; grp.add(card);
  const mark = new THREE.Mesh(G.ringThin, chxBasic(0xffc24a, 0.8, true)); mark.rotation.x = -Math.PI / 2; mark.position.y = 0.05; mark.scale.setScalar(0.16); grp.add(mark);
  const ring = new THREE.Mesh(G.ringThin, chxBasic(0xffc24a, 0.6, true)); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.06; ring.scale.setScalar(0.4); grp.add(ring);
  return chxFx(1e9, [grp], (dt, age, k, fx) => { mark.material.opacity = 0.8 * fx.fade * (0.6 + 0.4 * Math.sin(chxU.value * 4));
    ring.material.opacity = Math.max(0, 0.6 * (1 - age / 1.2)) * fx.fade; ring.scale.setScalar(0.4 + Math.min(1, age) * 0.6); }); } catch (e) { chxErr(e); return null; } }
function chxRendezvous(p, opts) { try { const G = chxGeos(), P = chxV3(p), own = opts && opts.caster, grp = new THREE.Group(); grp.position.copy(P);
  const shards = chxShards(grp, 14, 0xffd68a, 2.2, 2.6, 1.3);
  const flash = new THREE.Mesh(G.sph, chxBasic(0xffe0a0, 0.7, true)); flash.scale.setScalar(0.4); flash.position.y = 0.8; grp.add(flash);
  let veil = null;
  if (own) { chxCss(); veil = document.createElement("div"); veil.className = "chxV chxVTp"; veil.style.opacity = "1"; veil.innerHTML = "<svg viewBox=\'0 0 100 100\' preserveAspectRatio=\'none\' style=\'position:absolute;inset:-4% -8%;width:116%;height:108%;filter:drop-shadow(0 0 10px rgba(255,140,30,.75));animation:chxVeilFlow 0.9s ease-out forwards\'><path d=\'M-5,8 C 25,2 55,14 105,6\' fill=\'none\' stroke=\'#ff4d1e\' stroke-width=\'14\' stroke-linecap=\'round\' opacity=\'.92\' vector-effect=\'non-scaling-stroke\'/><path d=\'M-5,20 C 30,26 60,14 105,22\' fill=\'none\' stroke=\'#ffd83d\' stroke-width=\'34\' stroke-linecap=\'round\' opacity=\'.92\' vector-effect=\'non-scaling-stroke\'/><path d=\'M-5,33 C 25,27 65,40 105,31\' fill=\'none\' stroke=\'#ffd83d\' stroke-width=\'12\' stroke-linecap=\'round\' opacity=\'.92\' vector-effect=\'non-scaling-stroke\'/><path d=\'M-5,46 C 35,52 60,40 105,48\' fill=\'none\' stroke=\'#ffd83d\' stroke-width=\'38\' stroke-linecap=\'round\' opacity=\'.92\' vector-effect=\'non-scaling-stroke\'/><path d=\'M-5,58 C 30,51 70,65 105,56\' fill=\'none\' stroke=\'#ff4d1e\' stroke-width=\'12\' stroke-linecap=\'round\' opacity=\'.92\' vector-effect=\'non-scaling-stroke\'/><path d=\'M-5,70 C 28,76 62,64 105,72\' fill=\'none\' stroke=\'#ffd83d\' stroke-width=\'18\' stroke-linecap=\'round\' opacity=\'.92\' vector-effect=\'non-scaling-stroke\'/><path d=\'M-5,82 C 32,75 68,89 105,80\' fill=\'none\' stroke=\'#ff9a20\' stroke-width=\'14\' stroke-linecap=\'round\' opacity=\'.92\' vector-effect=\'non-scaling-stroke\'/><path d=\'M-5,93 C 25,88 60,98 105,91\' fill=\'none\' stroke=\'#ffd83d\' stroke-width=\'16\' stroke-linecap=\'round\' opacity=\'.92\' vector-effect=\'non-scaling-stroke\'/></svg>"; document.body.appendChild(veil); }
  const h = chxFx(0.9, [grp], (dt, age, k, fx) => { shards.tick(dt, age, fx.fade * (1 - k));
    flash.material.opacity = 0.7 * (1 - k * k) * fx.fade; flash.scale.setScalar(0.4 + k * 0.7);
    if (veil) veil.style.opacity = String(Math.min(1, Math.max(0, (0.9 - age) / 0.3))); });
  if (veil) { const done0 = h.fx.done; h.fx.done = function () { try { veil.remove(); } catch (e) {} done0(); }; }
  return h; } catch (e) { chxErr(e); return null; } }
// ---- Tour De Force kill: purple-gold shard dissolve over the victim ----
function chxTdfKill(p) { try { const G = chxGeos(), P = chxV3(p), grp = new THREE.Group(); grp.position.copy(P);
  const shards = chxShards(grp, 14, 0xd84df0, 1.8, 2.4, 1.5);
  const gshards = chxShards(grp, 8, 0xffd68a, 1.4, 2.0, 1.2);
  const flash = new THREE.Mesh(G.sph, chxBasic(0xd84df0, 0.55, true)); flash.scale.setScalar(0.32); flash.position.y = 1; grp.add(flash);
  return chxFx(0.9, [grp], (dt, age, k, fx) => { shards.tick(dt, age, fx.fade * (1 - k)); gshards.tick(dt, age, fx.fade * (1 - k));
    flash.material.opacity = 0.55 * (1 - k * k) * fx.fade; flash.scale.setScalar(0.32 + k * 0.7); }); } catch (e) { chxErr(e); return null; } }
// ---- END CHAMBER FX ----
