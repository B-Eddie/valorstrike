// ---- KILLJOY FX ----
// Killjoy ability visuals (work/killjoy_fx_runtime.js), reference-grounded in the wiki showcase
// clips (wiki.playvalorant.com/en-us/images/Nanoswarm_Showcase.mp4, Alarmbot_Showcase.mp4,
// Turret_Showcase.mp4, Lockdown_Showcase.mp4), phase-timed from the clips 2026-11-04.
// Procedural approximation, not extracted game assets. Game mechanics stay in the caller.
//
// Reference look targets (clip-measured):
//   Nanoswarm: manual trigger -> 1 s warn (pool grows in, pulsing magenta warning ring), then
//     5 s active: FLAT violet pool with hot ragged magenta rim, LOW jagged crystal shards
//     (0.15-0.4 m) near the rim and centre, a dense low swarm of buzzing magenta motes
//     (0.05-0.5 m) and occasional thin wisps; pool shrinks out over ~0.6 s.
//   Alarmbot: deploy = fast expanding teal sonar dome shell + magenta detect ring (r 5.5);
//     alert = ring pulse; boom = hard yellow-white starburst; victim = 4 s player-locked
//     MAGENTA SILHOUETTE (outline fill + shell through walls).
//   Turret: 2.7 s deploy = cyan holo wireframe + flashing warning triangle + converging
//     blue-white motes; shots are magenta tracer bolts (server: 3-shot bursts 0.083 s apart).
//   Lockdown: device construct (~1 s), then the teal dome WALL sweeps out to full radius in
//     ~0.4 s (clip); 13 s charge loop = bright cyan ground ring + rotating dashed ring + beam
//     column at the device, dome wall re-pulses every ~2.6 s (clip cadence), brightening with
//     charge; detonate() = teal pulse sweeping the full radius; detained enemies carry a teal
//     binding silhouette + rising holo rings (8 s).
//
// Contract (integrator owns index.html wiring): entries take world positions ({x,y,z} or
// [x,y,z]) and return {fx, end()}; end() plays a short fade then disposes cloned materials
// recursively; shared geometries/programs persist. kjxUseGameTick() hands timing to the game
// loop (kjxTick(dt) per frame, client-capped dt); otherwise a bounded rAF pump runs while
// effects live. No loaders/textures at module load; everything procedural and lazy.
// Globals used (read-only): THREE, scene; camera/player/xE are optional and guarded.
//
// Player-locked effects: kjxVulnerable(p, target, secs) and kjxDetain(p, target, secs) take
// the victim's Object3D as `target` and draw the reveal silhouette ON that mesh (skinned
// rigs share the skeleton), visible through walls. If target is null a humanoid totem is
// drawn at p instead (offline bots without a rig, tests).
//
// Server vs client: device bodies are server snapshot rows ('dev' rows) owned by the game:
//   Nanoswarm DEV.nanoswarm (1 s windup, 5 s active, r 4.5) - client XNANO.
//   Alarmbot DEV.alarmbot (deploy 1.85, detect 5.5, boom, 4 s vulnerable) - XALB.
//   Turret DEV.turret (deploy 2.7, 3-shot bursts) - XTUR; call kjxTurretFire per shot.
//   Lockdown ULT.lockdown (windup 13, radius 32.5, detain 8), 'lockdown' effect row; online
//     the cast arrives as an 'ac' ult row; call kjxLockdown at the device point,
//     handle.detonate() when the server effect fires, kjxEnd if destroyed first.
var kjxU = { value: 0 }, kjxLive = [], kjxPumpOn = false, kjxGT = null, kjxGeo = null;
function kjxNow() { try { return performance.now() / 1000; } catch (e) { return Date.now() / 1000; } }
function kjxErr(e) { try { xE(e); } catch (e2) {} }
function kjxGeos() { if (kjxGeo) return kjxGeo; kjxGeo = {
  sph: new THREE.SphereGeometry(1, 18, 12),
  sphHi: new THREE.SphereGeometry(1, 28, 20),
  dome: new THREE.SphereGeometry(1, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2),
  tri: (function () { const sh = new THREE.Shape(); sh.moveTo(0, 0.5); sh.lineTo(0.45, -0.35); sh.lineTo(-0.45, -0.35); sh.closePath(); return new THREE.ShapeGeometry(sh); })(),
  circle: new THREE.CircleGeometry(1, 48),
  ring: new THREE.RingGeometry(0.86, 1, 64),
  ringThin: new THREE.RingGeometry(0.955, 1, 64),
  cone: new THREE.ConeGeometry(0.5, 1, 5),
  cyl: new THREE.CylinderGeometry(1, 1, 1, 40, 1, true),
  plane: new THREE.PlaneGeometry(1, 1),
  box: new THREE.BoxGeometry(1, 1, 1),
  beam: new THREE.CylinderGeometry(1, 1, 1, 6, 1, true) }; return kjxGeo; }
function kjxV3(p) { return Array.isArray(p) ? new THREE.Vector3(p[0], p[1] || 0, p[2]) : new THREE.Vector3(p.x, p.y || 0, p.z); }
function kjxBasic(c, o, add) { return new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: o, depthWrite: false, blending: add ? THREE.AdditiveBlending : THREE.NormalBlending, side: THREE.DoubleSide, fog: false, toneMapped: false }); }
var kjxProg = {};
function kjxShader(k, frag) { if (kjxProg[k]) return kjxProg[k]; const m = new THREE.ShaderMaterial({
  uniforms: { uT: kjxU, uP: { value: 0 }, uSeed: { value: 0 }, uOp: { value: 1 } },
  vertexShader: "uniform float uT;uniform float uSeed;varying vec3 vN;varying vec3 vV;varying vec2 vUv;void main(){vUv=uv;vec4 mv=modelViewMatrix*vec4(position,1.0);vV=-mv.xyz;vN=normalMatrix*normal;gl_Position=projectionMatrix*mv;}",
  fragmentShader: frag, transparent: true, depthWrite: false, side: THREE.DoubleSide });
  m.userData.kjx = k; kjxProg[k] = m; return m; }
function kjxMat(k, frag, seed) { const m = kjxShader(k, frag).clone(); m.uniforms.uT = kjxU; if (seed !== undefined) m.uniforms.uSeed.value = seed; return m; }
const kjxNOISE = "float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}\nfloat noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(hash(i),hash(i+vec2(1.0,0.0)),f.x),mix(hash(i+vec2(0.0,1.0)),hash(i+vec2(1.0,1.0)),f.x),f.y);}\n";
// Nanoswarm resting pool: dark violet body, hot magenta ragged rim, slow swirl streaks
const kjxPOOL = kjxNOISE + "uniform float uT;uniform float uOp;varying vec2 vUv;\nvoid main(){vec2 q=vUv*2.0-1.0;float r=length(q);if(r>1.0)discard;float ang=atan(q.y,q.x);\nfloat n=noise(vec2(ang*2.5+uT*0.35,r*4.5-uT*0.6));\nfloat rag=0.05*sin(ang*9.0+uT*0.7)+0.04*(n-0.5);\nfloat edge=1.0-smoothstep(0.86+rag,1.0+rag,r);\nvec3 col=mix(vec3(0.16,0.03,0.24),vec3(0.42,0.07,0.52),smoothstep(0.15,0.9,r));\ncol+=vec3(1.0,0.22,0.82)*smoothstep(0.74,0.94,r)*(0.55+0.3*n);\ncol+=vec3(0.85,0.15,0.75)*pow(0.5+0.5*sin(ang*6.0-uT*1.6+r*9.0),4.0)*0.28*(1.0-r);\nfloat a=edge*(0.42+0.3*n)*uOp;gl_FragColor=vec4(col,a);}";
// magenta crystal spike: deep base, hot pink tip and fresnel edge
const kjxCRYSTAL = "uniform float uT;uniform float uOp;uniform float uSeed;varying vec3 vN;varying vec3 vV;varying vec2 vUv;\nvoid main(){float f=pow(1.0-abs(dot(normalize(vN),normalize(vV))),1.4);\nvec3 col=mix(vec3(0.42,0.02,0.36),vec3(1.0,0.30,0.88),clamp(vUv.y*0.75+f*0.9,0.0,1.0));\ncol+=vec3(1.0,0.75,1.0)*pow(f,3.0)*0.6;\nfloat fl=0.85+0.15*sin(uT*9.0+uSeed*21.0);\nfloat a=(0.5+0.5*f)*(0.3+0.7*vUv.y)*uOp*fl;\ngl_FragColor=vec4(col,a);}";
// teal light pillar (Lockdown beams): bright centre line, soft falloff, flicker
const kjxBEAM = "uniform float uT;uniform float uOp;uniform float uSeed;varying vec2 vUv;\nvoid main(){float x=abs(vUv.x-0.5)*2.0;float core=smoothstep(0.35,0.0,x);float glow=exp(-x*4.0)*0.5;\nfloat ends=smoothstep(0.0,0.06,vUv.y)*(1.0-smoothstep(0.75,1.0,vUv.y));\nfloat fl=0.7+0.3*sin(uT*13.0+uSeed*31.0+vUv.y*20.0);\nvec3 col=mix(vec3(0.10,0.75,0.70),vec3(0.75,1.0,0.98),core);\nfloat a=(core+glow)*ends*fl*uOp;gl_FragColor=vec4(col,a);}";
// teal dome wall: near-transparent body, bright fresnel rim
const kjxDOME = "uniform float uT;uniform float uOp;varying vec3 vN;varying vec3 vV;varying vec2 vUv;\nvoid main(){float f=pow(1.0-abs(dot(normalize(vN),normalize(vV))),2.2);\nfloat scan=0.5+0.5*sin(vUv.y*40.0-uT*3.0);\nvec3 col=mix(vec3(0.05,0.55,0.52),vec3(0.45,1.0,0.92),f);\nfloat a=(0.045+0.5*f+0.03*scan)*uOp;gl_FragColor=vec4(col,a);}";
// rotating dashed ground ring (Lockdown charge)
const kjxDASH = "uniform float uT;uniform float uOp;uniform float uSeed;varying vec2 vUv;\nvoid main(){vec2 q=vUv*2.0-1.0;float r=length(q);if(r>1.0)discard;float ang=atan(q.y,q.x);\nfloat dash=step(0.42,fract(ang*4.7746+uT*(0.35+uSeed*0.3)));\nfloat band=smoothstep(0.80,0.9,r)*(1.0-smoothstep(0.97,1.0,r));\nvec3 col=mix(vec3(0.10,0.85,0.75),vec3(0.7,1.0,0.95),dash*0.5);\nfloat a=band*(0.25+0.75*dash)*uOp;gl_FragColor=vec4(col,a);}";
// magenta detection ring (Alarmbot): solid soft band with a slow pulse
const kjxDET = "uniform float uT;uniform float uOp;varying vec2 vUv;\nvoid main(){vec2 q=vUv*2.0-1.0;float r=length(q);if(r>1.0)discard;\nfloat band=smoothstep(0.82,0.92,r)*(1.0-smoothstep(0.96,1.0,r));\nfloat pulse=0.6+0.4*sin(uT*2.6);\nvec3 col=vec3(1.0,0.25,0.8);\nfloat a=band*0.55*pulse*uOp;gl_FragColor=vec4(col,a);}";
// magenta debuff column (Vulnerable / detain): rising streaks, hot fresnel
const kjxDEBUFF = "uniform float uT;uniform float uOp;uniform float uSeed;varying vec3 vN;varying vec3 vV;varying vec2 vUv;\nvoid main(){float f=pow(1.0-abs(dot(normalize(vN),normalize(vV))),1.7);\nfloat rise=0.5+0.5*sin(vUv.y*14.0-uT*6.0+uSeed*9.0);\nvec3 col=mix(vec3(0.55,0.05,0.45),vec3(1.0,0.3,0.85),f+rise*0.25);\nfloat a=(0.10+0.5*f)*(0.4+0.6*rise)*uOp;\nif(a<0.004)discard;gl_FragColor=vec4(col,a);}";
// teal binding aura (detain): rising streaks, cool fresnel
const kjxBIND = "uniform float uT;uniform float uOp;uniform float uSeed;varying vec3 vN;varying vec3 vV;varying vec2 vUv;\nvoid main(){float f=pow(1.0-abs(dot(normalize(vN),normalize(vV))),1.7);\nfloat rise=0.5+0.5*sin(vUv.y*14.0-uT*6.0+uSeed*9.0);\nvec3 col=mix(vec3(0.05,0.5,0.45),vec3(0.55,1.0,0.9),clamp(f+rise*0.25,0.0,1.0));\nfloat a=(0.10+0.5*f)*(0.4+0.6*rise)*uOp;\nif(a<0.004)discard;gl_FragColor=vec4(col,a);}";
// ---- effect core (contract: handle + end, game-dt driven, cloned materials disposed) ----
function kjxPush(fx) { if (kjxLive.length > 32) { const o = kjxLive.shift(); try { o.done(); } catch (e) {} } kjxLive.push(fx); if (!kjxGT && !kjxPumpOn) { kjxPumpOn = true; kjxPump.last = kjxNow(); requestAnimationFrame(kjxPump); } return fx; }
function kjxPump() { if (kjxGT) { kjxPumpOn = false; return; } const now = kjxNow(), dt = Math.min(0.1, Math.max(0.0005, now - (kjxPump.last || now))); kjxPump.last = now; kjxStep(dt); if (kjxLive.length) requestAnimationFrame(kjxPump); else kjxPumpOn = false; }
function kjxStep(dt) { kjxU.value += dt; for (let i = kjxLive.length - 1; i >= 0; i--) { const fx = kjxLive[i]; fx.age += dt;
  if (fx.dying) { fx.fade -= dt / 0.3; if (fx.fade <= 0) { try { fx.done(); } catch (e) {} kjxLive.splice(i, 1); continue; } }
  const k = Math.min(1, fx.age / fx.ttl); try { fx.tick(dt, fx.age, k, fx); } catch (e) { kjxErr(e); }
  if (!fx.dying && fx.age >= fx.ttl) { try { fx.done(); } catch (e) {} kjxLive.splice(i, 1); } } }
function kjxUseGameTick() { kjxGT = true; kjxPumpOn = false; } // integrator then calls kjxTick(dt) per frame
function kjxTick(dt) { kjxStep(Math.min(0.1, Math.max(0.0005, dt || 0.016))); }
function kjxEnd(h) { const fx = h && h.fx; if (!fx) return; const i = kjxLive.indexOf(fx); if (i < 0) return; if (fx.grace === false) { kjxLive.splice(i, 1); try { fx.done(); } catch (e) {} } else fx.dying = true; }
function kjxReset() { while (kjxLive.length) { const fx = kjxLive.pop(); try { fx.done(); } catch (e) {} } }
function kjxFx(ttl, objs, tick, done) { const fx = { age: 0, ttl, fade: 1, dying: false, objs, tick, done: done || function () { objs.forEach((o) => { try { scene.remove(o); o.traverse((m) => { if (m.material && m.material.dispose) m.material.dispose(); if (m.geometry && m.geometry.userData && m.geometry.userData.kjxOwn) m.geometry.dispose(); }); } catch (e) {} }); } }; objs.forEach((o) => scene.add(o)); kjxPush(fx); return { fx, end: function () { kjxEnd(this); } }; }
function kjxBill(m) { try { if (typeof camera !== "undefined" && camera) m.lookAt(camera.position); } catch (e) {} }
// small drifting motes; one shared material per group, cleaned with the parent effect
function kjxMotes(grp, n, col, r, h, size, spd) { const G = kjxGeos(), out = [], mat = kjxBasic(col, 0.8, true);
  for (let i = 0; i < n; i++) { const m = new THREE.Mesh(G.sph, mat); const a = Math.random() * 6.2832;
    m.scale.setScalar(size * (0.6 + Math.random() * 0.8)); m.userData = { a, r: r * (0.3 + Math.random() * 0.7), h: h * Math.random(), s: spd * (0.5 + Math.random()), y0: 0.06 + Math.random() * 0.1 };
    m.position.set(Math.cos(a) * m.userData.r, m.userData.y0 + m.userData.h, Math.sin(a) * m.userData.r); m.raycast = function () {}; grp.add(m); out.push(m); }
  out.mat = mat;
  out.tick = function (t, fade) { mat.opacity = 0.8 * fade; out.forEach((m) => { const u = m.userData, b = u.a + t * u.s; m.position.x = Math.cos(b) * u.r; m.position.z = Math.sin(b) * u.r; m.position.y = u.y0 + u.h * (0.5 + 0.5 * Math.sin(t * 1.7 + u.a * 3.0)); }); };
  return out; }
// player-locked reveal silhouette: translucent fill + bright backside shell of the target's
// own meshes (skinned rigs share the skeleton), visible through walls; humanoid totem fallback
function kjxOutline(target, p, col) { const grp = new THREE.Group(), added = [];
  const fill = new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.26, depthTest: false, depthWrite: false, fog: false, toneMapped: false });
  const shell = new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.8, depthTest: false, depthWrite: false, side: THREE.BackSide, fog: false, toneMapped: false });
  function pair(src) { let a, b;
    if (src.isSkinnedMesh) { a = new THREE.SkinnedMesh(src.geometry, fill); a.bind(src.skeleton, src.bindMatrix); b = new THREE.SkinnedMesh(src.geometry, shell); b.bind(src.skeleton, src.bindMatrix); }
    else { a = new THREE.Mesh(src.geometry, fill); b = new THREE.Mesh(src.geometry, shell); }
    a.position.copy(src.position); a.quaternion.copy(src.quaternion); a.scale.copy(src.scale);
    b.position.copy(src.position); b.quaternion.copy(src.quaternion); b.scale.copy(src.scale).multiplyScalar(1.05);
    a.renderOrder = 998; b.renderOrder = 999; a.raycast = b.raycast = function () {};
    (src.parent || scene).add(a); (src.parent || scene).add(b); added.push(a, b); }
  if (target && target.isObject3D) { let n = 0; target.traverse((c) => { if (n < 24 && (c.isMesh || c.isSkinnedMesh) && c.geometry) { n++; pair(c); } }); }
  if (!added.length) { const P = kjxV3(p || { x: 0, y: 0, z: 0 }); grp.position.copy(P);
    const bodyG = new THREE.CylinderGeometry(0.24, 0.3, 1.15, 10); bodyG.userData.kjxOwn = 1;
    const body = new THREE.Mesh(bodyG, fill); body.position.y = 0.95; grp.add(body);
    const bodyS = new THREE.Mesh(bodyG, shell); bodyS.position.copy(body.position); bodyS.scale.setScalar(1.05); grp.add(bodyS);
    const head = new THREE.Mesh(kjxGeos().sph, fill); head.scale.setScalar(0.17); head.position.y = 1.72; grp.add(head);
    const headS = new THREE.Mesh(kjxGeos().sph, shell); headS.scale.setScalar(0.18); headS.position.y = 1.72; grp.add(headS);
    grp.traverse((m) => { m.renderOrder = 998; m.raycast = function () {}; });
    scene.add(grp); added.push(grp); }
  return { set(o) { fill.opacity = 0.26 * o; shell.opacity = 0.8 * o; },
    dispose() { added.forEach((m) => { try { (m.parent || scene).remove(m); } catch (e) {} });
      try { fill.dispose(); shell.dispose(); } catch (e) {}
      grp.traverse((m) => { if (m.geometry && m.geometry.userData && m.geometry.userData.kjxOwn) m.geometry.dispose(); }); } }; }
// ---- Nanoswarm ----
function kjxNanoToss(o, p, secs) { try { const G = kjxGeos(), from = kjxV3(o), to = kjxV3(p), T = secs || 0.55, arc = 1.1 + from.distanceTo(to) * 0.08;
  const grp = new THREE.Group();
  const body = new THREE.Mesh(G.sph, kjxBasic(0x7a2fd0, 0.95, false)); body.scale.set(0.09, 0.09, 0.13); grp.add(body);
  const glow = new THREE.Mesh(G.sph, kjxBasic(0xd84df0, 0.55, true)); glow.scale.setScalar(0.16); grp.add(glow);
  const trail = []; for (let i = 0; i < 5; i++) { const t = new THREE.Mesh(G.sph, kjxBasic(0xb44df0, 0.3, true)); t.scale.setScalar(0.05); trail.push(t); }
  const objs = [grp].concat(trail);
  return kjxFx(T + 0.25, objs, (dt, age) => { const u = Math.min(1, age / T);
    grp.position.lerpVectors(from, to, u); grp.position.y += Math.sin(u * Math.PI) * arc;
    glow.material.opacity = 0.55 * (0.7 + 0.3 * Math.sin(kjxU.value * 14));
    trail.forEach((t, i) => { const uu = Math.max(0, u - (i + 1) * 0.07); t.position.lerpVectors(from, to, uu); t.position.y += Math.sin(uu * Math.PI) * arc; t.material.opacity = 0.3 * (1 - i / 5) * (uu > 0 ? 1 : 0); }); }); } catch (e) { kjxErr(e); return null; } }
function kjxNanoZone(p, r) { try { const G = kjxGeos(), P = kjxV3(p), R = r || 4.5, grp = new THREE.Group(); grp.position.copy(P);
  const pool = new THREE.Mesh(G.circle, kjxMat("nanoPool", kjxPOOL, 0)); pool.rotation.x = -Math.PI / 2; pool.position.y = 0.05; pool.scale.setScalar(R); pool.renderOrder = 2; grp.add(pool);
  const rim = new THREE.Mesh(G.ringThin, kjxBasic(0xff2fd6, 0.5, true)); rim.rotation.x = -Math.PI / 2; rim.position.y = 0.06; rim.scale.setScalar(R); grp.add(rim);
  const spikes = []; for (let i = 0; i < 4; i++) { const s = new THREE.Mesh(G.cone, kjxMat("crys", kjxCRYSTAL, i * 1.7)); const a = i * 1.9 + 0.6; s.position.set(Math.cos(a) * 0.22, 0.12 + (i % 2) * 0.05, Math.sin(a) * 0.22); s.scale.set(0.16, 0.3 + (i % 2) * 0.14, 0.16); s.rotation.z = (Math.random() - 0.5) * 0.35; s.renderOrder = 3; grp.add(s); spikes.push(s); }
  const motes = kjxMotes(grp, 10, 0xe44df0, R * 0.8, 0.5, 0.035, 0.5);
  return kjxFx(1e9, [grp], (dt, age, k, fx) => { pool.material.uniforms.uOp.value = fx.fade; rim.material.opacity = 0.5 * fx.fade * (0.7 + 0.3 * Math.sin(kjxU.value * 2.2));
    spikes.forEach((s) => { s.material.uniforms.uOp.value = fx.fade; }); motes.tick(age, fx.fade); }); } catch (e) { kjxErr(e); return null; } }
function kjxNanoActivate(p, r, secs) { try { const G = kjxGeos(), P = kjxV3(p), R = r || 4.5, ACT = secs || 5, WARN = 1, ttl = WARN + ACT + 0.6, grp = new THREE.Group(); grp.position.copy(P);
  const pool = new THREE.Mesh(G.circle, kjxMat("nanoPool", kjxPOOL, 3)); pool.rotation.x = -Math.PI / 2; pool.position.y = 0.05; pool.scale.setScalar(0.01); pool.renderOrder = 2; grp.add(pool);
  const warn = new THREE.Mesh(G.ring, kjxBasic(0xff2fd6, 0, true)); warn.rotation.x = -Math.PI / 2; warn.position.y = 0.07; grp.add(warn);
  const shards = []; for (let i = 0; i < 16; i++) { const sh = new THREE.Mesh(G.cone, kjxMat("crys", kjxCRYSTAL, i * 1.31)); const a = Math.random() * 6.2832, nearRim = i % 5 < 3, rr = nearRim ? R * (0.66 + Math.random() * 0.26) : R * Math.sqrt(Math.random()) * 0.42;
    const hh = 0.16 + Math.random() * 0.26; sh.userData = { h: hh, w: 0.09 + Math.random() * 0.1 };
    sh.position.set(Math.cos(a) * rr, 0, Math.sin(a) * rr); sh.rotation.set((Math.random() - 0.5) * 0.55, Math.random() * 3, (Math.random() - 0.5) * 0.55);
    sh.scale.set(0.01, 0.01, 0.01); sh.renderOrder = 3; grp.add(sh); shards.push(sh); }
  const flash = new THREE.Mesh(G.sph, kjxBasic(0xff4fe0, 0, true)); flash.scale.setScalar(R * 0.45); flash.position.y = 0.35; grp.add(flash);
  const swarm = kjxMotes(grp, 46, 0xff5ae0, R * 0.92, 0.5, 0.028, 4.6);
  const wisps = []; for (let i = 0; i < 5; i++) { const w = new THREE.Mesh(G.beam, kjxMat("crys", kjxCRYSTAL, i * 2.9)); const a = Math.random() * 6.2832, rr = R * Math.sqrt(Math.random()) * 0.7;
    w.position.set(Math.cos(a) * rr, 0.45, Math.sin(a) * rr); w.scale.set(0.025, 0.9, 0.025); w.userData.ph = Math.random() * 6.2832; grp.add(w); wisps.push(w); }
  return kjxFx(ttl, [grp], (dt, age, k, fx) => { const F = fx.fade;
    if (age < WARN) { const w = age / WARN; pool.scale.setScalar(Math.max(0.01, R * w)); pool.material.uniforms.uOp.value = (0.42 + 0.5 * w) * F;
      warn.scale.setScalar(Math.max(0.01, R * (0.4 + 0.6 * w))); warn.material.opacity = 0.65 * F * (0.4 + 0.6 * Math.sin(kjxU.value * 10));
      flash.material.opacity = 0.08 * w * F; swarm.tick(age * 2, F * w * 0.4); return; }
    const a = age - WARN, grow = Math.min(1, a / 0.18), die = Math.max(0, (a - ACT) / 0.6);
    pool.scale.setScalar(Math.max(0.01, R * (1 - die * die))); pool.material.uniforms.uOp.value = Math.min(1, 0.95 - die) * F;
    warn.material.opacity = 0; flash.material.opacity = Math.max(0, 0.8 * (1 - a / 0.4)) * F;
    shards.forEach((sh, i) => { const sg = Math.max(0, Math.min(1, grow * 1.8 - (i % 4) * 0.12)) * (1 - die);
      sh.scale.set(sh.userData.w * sg + 0.001, sh.userData.h * sg + 0.001, sh.userData.w * sg + 0.001); sh.position.y = sh.userData.h * sg * 0.5; sh.material.uniforms.uOp.value = F * (0.75 + 0.25 * Math.sin(kjxU.value * 7 + i)); });
    wisps.forEach((w) => { const bl = Math.max(0, Math.sin(kjxU.value * 2.2 + w.userData.ph) - 0.55) / 0.45; w.material.uniforms.uOp.value = F * bl * (1 - die) * 0.9; });
    swarm.tick(age * (1 + grow), F * (1 - die)); }); } catch (e) { kjxErr(e); return null; } }
// ---- Alarmbot ----
function kjxAlarmbotPlace(p, yaw) { try { const G = kjxGeos(), P = kjxV3(p), grp = new THREE.Group(); grp.position.copy(P);
  const ring = new THREE.Mesh(G.circle, kjxMat("det", kjxDET, 0)); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.05; ring.scale.setScalar(0.01); grp.add(ring);
  const dome = new THREE.Mesh(G.dome, kjxMat("dome", kjxDOME, 1.3)); dome.scale.setScalar(0.01); dome.renderOrder = 2; grp.add(dome);
  const fins = []; for (let i = 0; i < 2; i++) { const f = new THREE.Mesh(G.plane, kjxBasic(0x2fe8c8, 0.7, true)); f.scale.set(0.5, 0.16, 1); const a = (yaw || 0) + Math.PI / 2 + i * Math.PI;
    f.position.set(Math.cos(a) * 0.45, 0.35, Math.sin(a) * 0.45); f.rotation.y = -a + Math.PI / 2; f.rotation.z = 0.5; grp.add(f); fins.push(f); }
  const beacon = new THREE.Mesh(G.sph, kjxBasic(0xff4fd8, 0.6, true)); beacon.scale.setScalar(0.07); beacon.position.y = 0.5; grp.add(beacon);
  return kjxFx(2.1, [grp], (dt, age, k, fx) => { const w = Math.min(1, age / 1.85), dw = Math.min(1, age / 0.7);
    dome.scale.setScalar(Math.max(0.01, 2.6 * dw)); dome.material.uniforms.uOp.value = 1.5 * fx.fade * (1 - dw);
    ring.scale.setScalar(Math.max(0.01, 5.5 * w)); ring.material.uniforms.uOp.value = fx.fade * (1 - 0.55 * w);
    fins.forEach((f) => { f.material.opacity = 0.7 * fx.fade * Math.max(0, 1 - age / 1.2); });
    beacon.material.opacity = 0.6 * fx.fade * (0.6 + 0.4 * Math.sin(kjxU.value * 6)); beacon.position.y = 0.5 - 0.25 * w; }); } catch (e) { kjxErr(e); return null; } }
function kjxAlarmbotAlert(p) { try { const G = kjxGeos(), P = kjxV3(p);
  const ring = new THREE.Mesh(G.ring, kjxBasic(0xff2fd6, 0.9, true)); ring.rotation.x = -Math.PI / 2; ring.position.set(P.x, P.y + 0.07, P.z); ring.scale.setScalar(0.4);
  const ping = new THREE.Mesh(G.sph, kjxBasic(0xff7ae4, 0.8, true)); ping.scale.setScalar(0.1); ping.position.set(P.x, P.y + 0.65, P.z);
  return kjxFx(0.55, [ring, ping], (dt, age, k, fx) => { ring.scale.setScalar(0.4 + k * 2.4); ring.material.opacity = 0.9 * (1 - k) * fx.fade;
    ping.material.opacity = 0.8 * (1 - k * k) * fx.fade; ping.position.y = P.y + 0.65 + k * 0.25; }); } catch (e) { kjxErr(e); return null; } }
function kjxAlarmbotBoom(p) { try { const G = kjxGeos(), P = kjxV3(p), grp = new THREE.Group(); grp.position.copy(P); grp.position.y += 0.25;
  const core = new THREE.Mesh(G.sph, kjxBasic(0xfff6c8, 0.95, true)); core.scale.setScalar(0.25); grp.add(core);
  const rays = []; for (let i = 0; i < 9; i++) { const ry = new THREE.Mesh(G.plane, kjxBasic(0xffe95a, 0.85, true));
    ry.scale.set(0.06, 0.9 + Math.random() * 0.7, 1); ry.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3); ry.userData.s = ry.scale.y; grp.add(ry); rays.push(ry); }
  const sparks = kjxMotes(grp, 10, 0xffd24a, 1.2, 0.8, 0.045, 5);
  return kjxFx(0.6, [grp], (dt, age, k, fx) => { core.scale.setScalar(0.25 + k * 0.9); core.material.opacity = 0.95 * (1 - k * k) * fx.fade;
    rays.forEach((ry) => { ry.scale.y = ry.userData.s * (1 + k * 2.2); ry.material.opacity = 0.85 * (1 - k) * fx.fade; });
    sparks.tick(age * 2, fx.fade * (1 - k)); }); } catch (e) { kjxErr(e); return null; } }
function kjxVulnerable(p, target, secs) { try { const P = kjxV3(p), T = secs || 4, out = kjxOutline(target, P, 0xff3fd0);
  const grp = new THREE.Group(); grp.position.set(P.x, P.y + 0.95, P.z);
  const motes = kjxMotes(grp, 8, 0xff3fd0, 0.5, 1.5, 0.035, 2.4);
  const h = kjxFx(T, [grp], (dt, age, k, fx) => { const env = Math.min(1, age / 0.25) * (1 - Math.max(0, (age - (T - 0.5)) / 0.5)) * fx.fade;
    out.set(env * (0.8 + 0.2 * Math.sin(kjxU.value * 9))); motes.tick(age, env); });
  const d0 = h.fx.done; h.fx.done = function () { out.dispose(); d0(); };
  return h; } catch (e) { kjxErr(e); return null; } }
// ---- Turret ----
function kjxTurretDeploy(p, yaw) { try { const G = kjxGeos(), P = kjxV3(p), grp = new THREE.Group(); grp.position.copy(P); grp.rotation.y = yaw || 0;
  const hb = new THREE.LineSegments(new THREE.EdgesGeometry(G.box), new THREE.LineBasicMaterial({ color: 0x5adfff, transparent: true, opacity: 0.7 }));
  hb.geometry.userData.kjxOwn = 1; hb.scale.set(0.5, 0.28, 0.5); hb.position.y = 0.2; grp.add(hb);
  const hc = new THREE.LineSegments(new THREE.EdgesGeometry(G.cyl), new THREE.LineBasicMaterial({ color: 0x5adfff, transparent: true, opacity: 0.7 }));
  hc.geometry.userData.kjxOwn = 1; hc.scale.set(0.2, 0.34, 0.2); hc.position.y = 0.5; grp.add(hc);
  const tri = new THREE.Mesh(G.tri, kjxBasic(0x9fe8ff, 0, true)); tri.scale.setScalar(0.5); tri.position.y = 1.05; grp.add(tri);
  const motes = kjxMotes(grp, 18, 0x9fdcff, 1.3, 0.8, 0.06, 0);
  motes.forEach((m) => { m.userData.tx = (Math.random() - 0.5) * 0.4; m.userData.tz = (Math.random() - 0.5) * 0.4; m.userData.ty = 0.1 + Math.random() * 0.6; });
  const flash = new THREE.Mesh(G.sph, kjxBasic(0x9fe8ff, 0, true)); flash.scale.setScalar(0.5); flash.position.y = 0.4; grp.add(flash);
  return kjxFx(2.9, [grp], (dt, age, k, fx) => { const w = Math.min(1, age / 2.7);
    hb.material.opacity = 0.7 * fx.fade * (1 - w * 0.85); hc.material.opacity = 0.7 * fx.fade * (1 - w * 0.85);
    tri.material.opacity = 0.85 * fx.fade * Math.max(0, 1 - age / 2.7) * (0.55 + 0.45 * Math.sin(kjxU.value * 6)); kjxBill(tri);
    motes.forEach((m) => { const u = m.userData, t = Math.min(1, age * 1.4); m.position.x += (u.tx - m.position.x) * t * 0.12; m.position.z += (u.tz - m.position.z) * t * 0.12; m.position.y += (u.ty - m.position.y) * t * 0.12; });
    motes.mat.opacity = 0.8 * fx.fade * (1 - w);
    flash.material.opacity = Math.max(0, (age - 2.55) / 0.2) * 0.5 * (1 - Math.max(0, (age - 2.75) / 0.15)) * fx.fade; }); } catch (e) { kjxErr(e); return null; } }
function kjxTurretFire(o, d, len) { try { const G = kjxGeos(), O = kjxV3(o), D = kjxV3(d).normalize(), L = len || 30;
  const mid = O.clone().addScaledVector(D, L / 2), up = new THREE.Vector3(0, 1, 0);
  const core = new THREE.Mesh(G.beam, kjxBasic(0xff4fd8, 0.95, true)); core.scale.set(0.035, L, 0.035); core.position.copy(mid);
  core.quaternion.setFromUnitVectors(up, D);
  const glow = new THREE.Mesh(G.beam, kjxBasic(0xd84df0, 0.4, true)); glow.scale.set(0.1, L, 0.1); glow.position.copy(mid); glow.quaternion.copy(core.quaternion);
  const mz = new THREE.Mesh(G.sph, kjxBasic(0xff8ae8, 0.85, true)); mz.scale.setScalar(0.12); mz.position.copy(O);
  const end = O.clone().addScaledVector(D, L);
  const hit = new THREE.Mesh(G.sph, kjxBasic(0xffb0f0, 0.7, true)); hit.scale.setScalar(0.09); hit.position.copy(end);
  return kjxFx(0.14, [core, glow, mz, hit], (dt, age, k, fx) => { const f = (1 - k) * fx.fade;
    core.material.opacity = 0.95 * f; glow.material.opacity = 0.4 * f; mz.material.opacity = 0.85 * f; hit.material.opacity = 0.7 * f;
    mz.scale.setScalar(0.12 + k * 0.1); hit.scale.setScalar(0.09 + k * 0.12); }); } catch (e) { kjxErr(e); return null; } }
// ---- Lockdown ----
function kjxLockdown(p, r, windup) { try { const G = kjxGeos(), P = kjxV3(p), R = r || 32.5, WU = windup || 13, DEPLOY = 1, SWEEP = 0.45, grp = new THREE.Group(); grp.position.copy(P);
  const dome = new THREE.Mesh(G.dome, kjxMat("dome", kjxDOME, 0)); dome.scale.setScalar(0.01); dome.renderOrder = 2; grp.add(dome);
  const edge = new THREE.Mesh(G.ringThin, kjxBasic(0x2fe8c8, 0.5, true)); edge.rotation.x = -Math.PI / 2; edge.position.y = 0.08; edge.scale.setScalar(0.01); grp.add(edge);
  const ring = new THREE.Mesh(G.circle, kjxMat("dash", kjxDASH, 0.4)); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.06; ring.scale.setScalar(1.6); grp.add(ring);
  const base = new THREE.Mesh(G.ring, kjxBasic(0x54f0d8, 0.55, true)); base.rotation.x = -Math.PI / 2; base.position.y = 0.07; base.scale.setScalar(1.1); grp.add(base);
  const beams = [], NB = 7, UP = new THREE.Vector3(0, 1, 0); for (let i = 0; i < NB; i++) { const b = new THREE.Mesh(G.beam, kjxBasic(0xe8f6ff, 0.45, true));
    const L = R * 0.92; b.scale.set(0.06 + (i % 2) * 0.03, L, 0.06 + (i % 2) * 0.03);
    if (i === 0) { b.position.y = L / 2; } else { const az = ((i - 1) / (NB - 1)) * Math.PI * 2, el = 0.6 + (i % 2) * 0.24;
      const d = new THREE.Vector3(Math.sin(el) * Math.cos(az), Math.cos(el), Math.sin(el) * Math.sin(az));
      b.quaternion.setFromUnitVectors(UP, d); b.position.copy(d).multiplyScalar(L / 2); }
    grp.add(b); beams.push(b); }
  const orb = new THREE.Mesh(G.sphHi, kjxBasic(0x9ffce8, 0.7, true)); orb.scale.setScalar(0.14); orb.position.y = 0.42; grp.add(orb);
  const pulse = new THREE.Mesh(G.ring, kjxBasic(0x8ffce8, 0, true)); pulse.rotation.x = -Math.PI / 2; pulse.position.y = 0.1; pulse.scale.setScalar(0.5); grp.add(pulse);
  const fx = { mode: "charge", pt: 0 };
  const h = kjxFx(1e9, [grp], (dt, age, k, fxf) => { const F = fxf.fade;
    if (fx.mode === "charge") { const dep = Math.min(1, age / DEPLOY), sw = Math.max(0, Math.min(1, (age - DEPLOY) / SWEEP)), charge = Math.min(1, age / WU);
      const dw = Math.max(0.01, R * Math.max(dep * 0.04, sw));
      dome.scale.set(dw, dw * 0.55, dw);
      let dop; if (sw < 1) dop = 1.25 * sw; else dop = 0.4 * (1 - 0.3 * charge) + 0.5 * Math.pow(Math.max(0, Math.sin((age % 2.6) / 2.6 * Math.PI)), 2) * (0.3 + 0.7 * charge);
      dome.material.uniforms.uOp.value = F * dop;
      edge.scale.setScalar(dw); edge.material.opacity = 0.5 * F * (1 - 0.3 * charge) * Math.min(1, sw * 2 + dep * 0.2);
      ring.material.uniforms.uOp.value = F * (0.45 + 0.55 * charge) * dep; ring.scale.setScalar(1.6 + charge * 0.5);
      base.material.opacity = 0.55 * F * (0.6 + 0.4 * Math.sin(kjxU.value * 3.5)) * dep;
      beams.forEach((b, i) => { b.material.opacity = F * (0.3 + 0.7 * charge) * (0.55 + 0.45 * Math.sin(kjxU.value * 5 + i * 2.1)) * dep; });
      orb.material.opacity = F * (0.5 + 0.5 * charge); orb.scale.setScalar(0.14 + charge * 0.08 + Math.sin(kjxU.value * (3 + charge * 9)) * 0.015);
      if (age >= WU) fx.mode = "pulse", fx.pt = age; }
    else { const a = age - fx.pt, pu = Math.min(1, a / 0.9);
      pulse.scale.setScalar(Math.max(0.5, R * pu)); pulse.material.opacity = 0.9 * (1 - pu) * F;
      dome.material.uniforms.uOp.value = F * 1.3 * (1 - pu); edge.material.opacity = 0.5 * F * (1 - pu);
      ring.material.uniforms.uOp.value = F * (1 - pu); base.material.opacity = 0.55 * F * (1 - pu);
      beams.forEach((b) => { b.material.opacity = F * Math.max(0, 1 - pu * 1.4); });
      orb.material.opacity = F * (1 - pu);
      if (pu >= 1) { fxf.age = fxf.ttl; } } });
  h.detonate = function () { fx.mode = "pulse"; fx.pt = h.fx.age; };
  return h; } catch (e) { kjxErr(e); return null; } }
function kjxDetain(p, target, secs) { try { const G = kjxGeos(), P = kjxV3(p), T = secs || 8, out = kjxOutline(target, P, 0x54f0d8);
  const grp = new THREE.Group(); grp.position.set(P.x, P.y, P.z);
  const col = new THREE.Mesh(G.cyl, kjxMat("bind", kjxBIND, 4.4)); col.scale.set(0.55, 1.9, 0.55); col.position.y = 0.95; col.renderOrder = 3; grp.add(col);
  const rings = []; for (let i = 0; i < 3; i++) { const b = new THREE.Mesh(G.ringThin, kjxBasic(0x8ffce8, 0.75, true)); b.rotation.x = -Math.PI / 2; b.scale.setScalar(0.45); grp.add(b); rings.push(b); }
  const h = kjxFx(T, [grp], (dt, age, k, fx) => { const env = Math.min(1, age / 0.25) * (1 - Math.max(0, (age - (T - 0.6)) / 0.6)) * fx.fade;
    out.set(env); col.material.uniforms.uOp.value = env;
    rings.forEach((b, i) => { const ph = (age * 0.7 + i / 3) % 1; b.position.y = 0.15 + ph * 1.75; b.material.opacity = 0.75 * env * (1 - ph); b.scale.setScalar(0.45 - ph * 0.1); }); });
  const d0 = h.fx.done; h.fx.done = function () { out.dispose(); d0(); };
  return h; } catch (e) { kjxErr(e); return null; } }
// ---- END KILLJOY FX ----
