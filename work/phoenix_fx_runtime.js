// ---- PHOENIX FX ----
// Phoenix ability visuals (work/phoenix_fx_runtime.js), reference-grounded in the wiki showcase clips
// (wiki.playvalorant.com/en-us/images/Blaze_Showcase.mp4, Hot_Hands_Showcase.mp4, Curveball_Showcase.mp4,
// Run_it_Back_Showcase.mp4; frame sheets reviewed 2026-11-04) and the wiki ability pages.
// Procedural approximation, no extracted game assets. Pure client fx: damage, blinds, timing and sound
// stay in the caller. Numbers the caller passes match the game tables (XBLZ / XHOT / XCBF), which match
// the server (devices.js DEV.blaze / DEV.hotHands / DEV.curveball).
//
// Reference look targets (from the clips):
//   Blaze:      a translucent coral-orange curtain of flame with lighter flowing swirls, a jagged torn
//               top edge and an intense yellow-white molten line along the base. A small fireball runs
//               the path first leaving a glowing ground trail; the wall RISES segment by segment from
//               Phoenix outward (wiki: deploy 0.125-0.75 s by distance), and the whole wall rapidly
//               falls at expiry.
//   Hot Hands:  a thrown glowing fireball with a flame trail, then a pool of molten orange: bright
//               yellow-white core glow, flowing vein cracks, ragged edge, rising embers.
//   Curveball:  a swirling red-orange ring orb with a hot core and a thin horizontal streak trail;
//               the pop is a wide radial starburst of long white-pink light rays + a thin white ring.
//   Run It Back: Phoenix's body turns to golden fire while the ult runs, a small flame marker burns at
//               the cast point, and the return is a vertical fire burst with sparks.
//
// Contract (integrator): every function takes world positions, returns a handle { fx, end() }.
// Effects self-end at their ttl; end() finishes one early; phxReset() ends them all (round reset /
// disconnect). Shared geometry/programs persist; cloned per-effect materials are disposed recursively.
// Game-dt driven: call phxUseGameTick() once, then phxTick(dt) from the game loop (client dt caps
// apply upstream); without it a single rAF pump runs while effects exist (isolated harness only).
// No heavy textures or loaders at module load: all shaders are procedural, built lazily on first use.
// Globals used (read-only): THREE, scene, camera. xE guarded.
//
// Wiring (integrator; line numbers = index.html on branch instinct @ 7d7cedd):
//   Tick: phxUseGameTick() once beside omxUseGameTick(); call phxTick(dt) in the frame loop where
//     omxTick is called (~L9056). All durations below come from the existing game tables, so client
//     fx stay in lockstep with damage/blind windows the game and server already own.
//   Blaze (KeyC handler in phKey ~L8990; online mpFx "wall" branch ~L14120): on cast
//     phxBlazeTrail(feet, dir, XBLZ.len, deployS) then phxBlaze(feet, dir, XBLZ.len,
//     { grow: deployS, life: XBLZ.life, height: XBLZ.height }). blazeWall/blzMat stay the
//     authoritative damage/blocking volume; these fx are visual only.
//   Hot Hands (KeyQ; mpFx "fire" branch): phxFireball(hand, landPos, flightS); at the landing
//     phxHotHands(landPos, XHOT.r, XHOT.life, XHOT.grow). hhMat zone and its damage stay as-is.
//   Curveball (KeyE; mpFx "flash" branch; jPop ~L8955, enPop ~L10249): phxCurveFlight(xCbOrb) at
//     throw (ends itself when the orb mesh leaves the scene); phxCurvePop(popPos) at the pop.
//   Run It Back (KeyX; ribStart ~L12821, jRib ~L3485): phxRibForm(playerModel) at ult start,
//     phxRibMarker(castPoint, ultDurS); on return phxRibReturn(markerPos); if the body is destroyed
//     during the ult, phxRibDeath(deathPos) instead.
var phxU = { value: 0 }, phxLive = [], phxPumpOn = false, phxGT = null, phxGeo = null, phxProg = {};
function phxNow() { try { return performance.now() / 1000; } catch (e) { return Date.now() / 1000; } }
function phxErr(e) { try { if (typeof xE === "function") xE(e); } catch (e2) {} }
function phxGeos() { if (phxGeo) return phxGeo; phxGeo = {
  sph: new THREE.SphereGeometry(1, 22, 14),
  plane: new THREE.PlaneGeometry(1, 1),
  wall: new THREE.PlaneGeometry(1, 1, 1, 4),
  disc: new THREE.CircleGeometry(1, 40),
  ring: new THREE.RingGeometry(0.72, 1, 48),
  ring2: new THREE.RingGeometry(0.9, 1, 48),
  ray: new THREE.PlaneGeometry(0.16, 1),
  cyl: new THREE.CylinderGeometry(1, 1, 1, 14, 3, true) };
  phxGeo.wall.translate(0, 0.5, 0); phxGeo.cyl.translate(0, 0.5, 0); for (const k in phxGeo) phxGeo[k].userData.phxShared = 1; return phxGeo; } // wall/cyl grow from y=0
function phxShader(k, frag, uniforms) { if (phxProg[k]) return phxProg[k]; const m = new THREE.ShaderMaterial({
  uniforms: Object.assign({ uT: phxU, uP: { value: 0 }, uSeed: { value: 0 }, uA: { value: 1 } }, uniforms || {}),
  vertexShader: "uniform float uT;uniform float uP;uniform float uSeed;varying vec3 vN;varying vec3 vV;varying vec3 vP;varying vec3 vW;varying vec2 vUv;void main(){vUv=uv;vP=position;vec4 w=modelMatrix*vec4(position,1.0);vW=w.xyz;vec4 mv=viewMatrix*w;vV=-mv.xyz;vN=normalMatrix*normal;gl_Position=projectionMatrix*mv;}",
  fragmentShader: frag, transparent: true, depthWrite: false, side: THREE.DoubleSide });
  m.userData.phx = k; phxProg[k] = m; return m; }
function phxMat(k, shader, seed) { const m = phxShader(k, shader).clone(); m.uniforms.uT = phxU; if (seed !== undefined) m.uniforms.uSeed.value = seed; return m; }
function phxBasic(c, o, add) { return new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: o, depthWrite: false, fog: false, toneMapped: false, blending: add ? THREE.AdditiveBlending : THREE.NormalBlending, side: THREE.DoubleSide }); }
function phxPush(fx) { if (phxLive.length > 24) { const o = phxLive.shift(); try { o.done(); } catch (e) {} } phxLive.push(fx); if (!phxGT && !phxPumpOn) { phxPumpOn = true; phxPump.last = phxNow(); requestAnimationFrame(phxPump); } return fx; }
function phxPump() { if (phxGT) { phxPumpOn = false; return; } const now = phxNow(), dt = Math.min(0.1, Math.max(0.0005, now - (phxPump.last || now))); phxPump.last = now; phxU.value += dt;
  for (let i = phxLive.length - 1; i >= 0; i--) { const fx = phxLive[i]; fx.age += dt; try { fx.tick(dt, fx.age, Math.min(1, fx.age / fx.ttl)); } catch (e) { phxErr(e); }
    if (fx.age >= fx.ttl) { try { fx.done(); } catch (e) {} phxLive.splice(i, 1); } }
  if (phxLive.length) requestAnimationFrame(phxPump); else phxPumpOn = false; }
function phxUseGameTick() { phxGT = true; phxPumpOn = false; } // integrator then calls phxTick(dt) per frame
function phxTick(dt) { phxU.value += dt; for (let i = phxLive.length - 1; i >= 0; i--) { const fx = phxLive[i]; fx.age += dt; try { fx.tick(dt, fx.age, Math.min(1, fx.age / fx.ttl)); } catch (e) { phxErr(e); } if (fx.age >= fx.ttl) { try { fx.done(); } catch (e) {} phxLive.splice(i, 1); } } }
function phxEnd(h) { if (!h || !h.fx) return; const i = phxLive.indexOf(h.fx); if (i >= 0) phxLive.splice(i, 1); try { h.fx.done(); } catch (e) {} }
function phxReset() { for (let i = phxLive.length - 1; i >= 0; i--) { try { phxLive[i].done(); } catch (e) {} } phxLive.length = 0; }
function phxFx(ttl, objs, tick, done) { const fx = { age: 0, ttl, objs, tick, done: done || function () { objs.forEach((o) => { try { scene.remove(o); o.traverse((m) => { if (m.material && m.material.dispose && !m.material.userData.phxShared) m.material.dispose(); if (m.geometry && !m.geometry.userData.phxShared) m.geometry.dispose(); }); } catch (e) {} }); } }; objs.forEach((o) => scene.add(o)); phxPush(fx); return { fx, end: function () { phxEnd(this); } }; }
// shared GLSL: cheap value noise + fbm (same construction as the Omen module's dome cloud)
const phxNOISE = "float hash(vec3 p){p=fract(p*.3183099+vec3(.11,.23,.37));p*=17.0;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}float noise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);}float fbm(vec3 p){float n=0.0;float a=.55;for(int i=0;i<3;i++){n+=a*noise(p);p=p*2.11+vec3(5.1,1.7,9.2);a*=.5;}return n;}";
// Blaze curtain: coral-orange flame body, lighter swirls, torn top, intense molten base seam (world-space noise: no stretch)
const phxWALL = "uniform float uT;uniform float uP;uniform float uSeed;uniform float uA;varying vec3 vN;varying vec3 vV;varying vec3 vP;varying vec3 vW;varying vec2 vUv;\n" + phxNOISE + "\nvoid main(){float y=vUv.y;float n=fbm(vec3(vW.x*1.4+uSeed*9.0,vW.y*1.0-uT*1.5,vW.z*1.4));float n2=noise(vec3(vW.x*3.1,vW.y*2.0-uT*2.7,vW.z*3.1+uSeed*5.0));float f=n*0.72+n2*0.28;float tongue=f+0.55-y*1.15;float body=smoothstep(0.0,0.22,tongue);float seam=smoothstep(0.10,0.0,y)*(0.75+0.25*sin(uT*9.0+vW.x*6.0));vec3 c=mix(vec3(0.90,0.27,0.30),vec3(0.99,0.47,0.16),smoothstep(0.85,0.30,y));c=mix(c,vec3(1.0,0.75,0.28),smoothstep(0.24,0.03,y));c+=vec3(0.45,0.18,0.02)*n2*(1.0-y);c=mix(c,vec3(1.0,0.95,0.66),seam);float a=(body*(0.60+0.32*f)+seam*0.55)*uA;if(a<0.004)discard;gl_FragColor=vec4(c,min(a,1.0));}";
// molten pool (Hot Hands): dark red lava bed, bright flowing vein cracks, hot core pulse, ragged edge
const phxPOOL = "uniform float uT;uniform float uP;uniform float uSeed;uniform float uA;varying vec3 vN;varying vec3 vV;varying vec3 vP;varying vec3 vW;varying vec2 vUv;\n" + phxNOISE + "\nvoid main(){vec2 q=(vUv-0.5)*2.0;float r=length(q);float wob=fbm(vec3(q*2.2+uSeed*7.0,uT*0.22));float rw=r+wob*0.42-0.21;float vein=1.0-abs(2.0*fbm(vec3(q*3.4,uT*0.35)+vec3(uSeed*3.0))-1.0);vein=pow(vein,5.0);float core=smoothstep(0.55,0.0,rw)*(0.72+0.28*sin(uT*3.2+uSeed));vec3 c=mix(vec3(0.45,0.08,0.05),vec3(0.95,0.30,0.08),smoothstep(0.9,0.25,rw));c+=vec3(1.0,0.72,0.20)*vein*1.6;c=mix(c,vec3(1.0,0.88,0.45),core*(0.35+vein));float a=(1.0-smoothstep(0.82,1.0,rw))*uA;if(a<0.004)discard;gl_FragColor=vec4(c,a*0.96);}";
// hot additive core (fireball / pop flash / embers): white-yellow centre to transparent orange rim
const phxHOT = "uniform float uT;uniform float uP;uniform float uSeed;uniform float uA;varying vec3 vN;varying vec3 vV;varying vec3 vP;varying vec3 vW;varying vec2 vUv;void main(){float f=pow(abs(dot(normalize(vN),normalize(vV))),1.5);vec3 c=mix(vec3(1.0,0.42,0.10),vec3(1.0,0.92,0.60),f);float a=(0.25+0.75*f)*uA;gl_FragColor=vec4(c,a);}";
// golden fire-form (Run It Back body): hot gold body with rising flame noise and a bright fresnel rim
const phxFORM = "uniform float uT;uniform float uP;uniform float uSeed;uniform float uA;varying vec3 vN;varying vec3 vV;varying vec3 vP;varying vec3 vW;varying vec2 vUv;\n" + phxNOISE + "\nvoid main(){float f=pow(1.0-abs(dot(normalize(vN),normalize(vV))),1.3);float n=fbm(vec3(vW.x*3.0,vW.y*2.2-uT*3.4,vW.z*3.0));vec3 c=mix(vec3(1.0,0.55,0.10),vec3(1.0,0.85,0.35),n)*(0.85+0.5*f);c+=vec3(1.0,0.95,0.7)*f*f;float a=(0.30+0.38*n+0.5*f)*uA;if(a<0.004)discard;gl_FragColor=vec4(c,min(a,1.0));}";
// flame marker column (Run It Back cast point): thin rising fire tongue
const phxMARK = "uniform float uT;uniform float uP;uniform float uSeed;uniform float uA;varying vec3 vN;varying vec3 vV;varying vec3 vP;varying vec3 vW;varying vec2 vUv;\n" + phxNOISE + "\nvoid main(){float n=fbm(vec3(vUv.x*3.0+uSeed*5.0,vUv.y*2.0-uT*2.6,uSeed));float f=n-vUv.y*1.1;float a=smoothstep(0.0,0.35,f)*smoothstep(0.0,0.10,vUv.y)*uA;vec3 c=mix(vec3(1.0,0.45,0.10),vec3(1.0,0.85,0.40),smoothstep(0.5,0.0,vUv.y));if(a<0.004)discard;gl_FragColor=vec4(c,a);}";
// swirl shell (Curveball orb): rotating red-orange swirl with a dark core window, additive rim
const phxSWIRL = "uniform float uT;uniform float uP;uniform float uSeed;uniform float uA;varying vec3 vN;varying vec3 vV;varying vec3 vP;varying vec3 vW;varying vec2 vUv;\n" + phxNOISE + "\nvoid main(){float ang=atan(vP.y,vP.x)+uT*6.0+uSeed;float sw=0.5+0.5*sin(ang*3.0+length(vP.xy)*9.0-uT*7.0);float f=pow(1.0-abs(dot(normalize(vN),normalize(vV))),1.4);vec3 c=mix(vec3(0.75,0.10,0.04),vec3(1.0,0.55,0.15),sw);c+=vec3(1.0,0.75,0.35)*f;float a=(0.30+0.55*sw+0.4*f)*uA;if(a<0.004)discard;gl_FragColor=vec4(c,min(a,1.0));}";
const phxV0 = new THREE.Vector3(), phxV1 = new THREE.Vector3(), phxV2 = new THREE.Vector3(), phxQ0 = new THREE.Quaternion();
// ---- Blaze: flame curtain that rises segment by segment from the caster outward, then rapidly falls ----
// o: ground point at the caster's feet, dir: normalized horizontal aim, len: wall length (XBLZ rule),
// o2: { grow (s to full length, wiki deploy 0.125-0.75), life (s at full size, XBLZ.life), height (XBLZ.height) }
function phxBlaze(o, dir, len, o2) { try {
  const G = phxGeos(), op = o2 || {}, grow = op.grow || 0.6, life = op.life || 8, H = op.height || 3;
  const n = Math.max(2, Math.min(10, Math.round(len / 1.4))), grp = new THREE.Group(), segs = [];
  const yaw = Math.atan2(dir.x, dir.z) + Math.PI / 2;
  for (let i = 0; i < n; i++) { const m = new THREE.Mesh(G.wall, phxMat("wall", phxWALL, i * 0.37 + o.x)); m.position.set(o.x + dir.x * (len * (i + 0.5) / n), o.y, o.z + dir.z * (len * (i + 0.5) / n)); m.rotation.y = yaw; m.scale.set(len / n + 0.05, 0.001, 1); grp.add(m); segs.push(m); }
  const seam = new THREE.Mesh(G.plane, phxMat("seam", phxHOT)); seam.rotation.x = -Math.PI / 2; seam.rotateOnWorldAxis(phxV0.set(0, 1, 0), Math.atan2(-dir.z, dir.x)); seam.position.set(o.x + dir.x * len / 2, o.y + 0.06, o.z + dir.z * len / 2); seam.scale.set(len, 0.55, 1); seam.material.opacity = 1; grp.add(seam);
  const per = grow / n, fall = 0.4, ttl = grow + life + fall;
  const h = phxFx(ttl, [grp], (dt, age) => {
    for (let i = 0; i < n; i++) { const m = segs[i], up = age - i * per;
      if (age >= grow + life) { const f = Math.max(0, 1 - (age - grow - life) / fall); m.scale.y = Math.max(0.001, H * f); m.material.uniforms.uA.value = f; }
      else m.scale.y = Math.max(0.001, H * Math.min(1, up / (per * 2.2))); }
    seam.material.uniforms.uA.value = age >= grow + life ? Math.max(0, 1 - (age - grow - life) / fall) : Math.min(1, age / grow); });
  return h; } catch (e) { phxErr(e); return null; } }
// ---- Blaze cast: the missile hugging the ground, leaving a glowing trail (clip: a fireball runs the path) ----
function phxBlazeTrail(o, dir, len, dur) { try {
  const G = phxGeos(), ttl = (dur || 0.5) + 0.9;
  const ball = new THREE.Mesh(G.sph, phxMat("ball", phxHOT)); ball.scale.setScalar(0.22); ball.position.copy(o).y += 0.35;
  const trail = new THREE.Mesh(G.plane, phxBasic(0xff8a30, 0.85, true)); trail.rotation.x = -Math.PI / 2; trail.rotateOnWorldAxis(phxV0.set(0, 1, 0), Math.atan2(-dir.z, dir.x)); trail.position.copy(o).y += 0.05;
  const h = phxFx(ttl, [ball, trail], (dt, age) => {
    const u = Math.min(1, age / (dur || 0.5)), d = u * len;
    ball.position.set(o.x + dir.x * d, o.y + 0.35, o.z + dir.z * d);
    trail.position.set(o.x + dir.x * d / 2, o.y + 0.05, o.z + dir.z * d / 2); trail.scale.set(Math.max(0.01, d), 0.35, 1);
    ball.material.uniforms.uA.value = u >= 1 ? Math.max(0, 1 - (age - (dur || 0.5)) / 0.3) : 1;
    trail.material.opacity = u >= 1 ? 0.85 * Math.max(0, 1 - (age - (dur || 0.5)) / 0.8) : 0.85; });
  return h; } catch (e) { phxErr(e); return null; } }
// ---- Hot Hands: molten pool with vein cracks, hot core, ragged edge, rising embers ----
// c: ground centre, R: final radius (XHOT.r), life: s at full size (XHOT.life), grow: spread time (XHOT.grow)
function phxHotHands(c, R, life, grow) { try {
  const G = phxGeos(); R = R || 4.5; life = life || 4; grow = grow || 0.75;
  const pool = new THREE.Mesh(G.disc, phxMat("pool", phxPOOL, c.x * 0.7 + c.z)); pool.rotation.x = -Math.PI / 2; pool.position.set(c.x, c.y + 0.04, c.z); pool.scale.setScalar(0.01);
  const N = 10, pos = new Float32Array(N * 3), pts = new THREE.Points(G ? new THREE.BufferGeometry() : null, phxBasic(0xffa040, 0.9, true));
  pts.geometry.setAttribute("position", new THREE.BufferAttribute(pos, 3)); pts.material.size = 0.06; pts.material.sizeAttenuation = true; pts.frustumCulled = false;
  const seed = []; for (let i = 0; i < N; i++) seed.push([Math.random() * 6.28, 0.3 + Math.random() * 0.7, Math.random()]);
  const ttl = life + 0.6;
  const h = phxFx(ttl, [pool, pts], (dt, age) => {
    const r = R * Math.min(1, age / grow), fade = age > life ? Math.max(0, 1 - (age - life) / 0.6) : 1;
    pool.scale.setScalar(Math.max(0.01, r)); pool.material.uniforms.uA.value = fade;
    const k = Math.min(1, age / grow);
    for (let i = 0; i < N; i++) { const s = seed[i], u = (s[2] + age * 0.5 * s[1]) % 1, rr = r * Math.sqrt((i + 0.5) / N) * 0.9;
      pos[i * 3] = c.x + Math.cos(s[0] + u * 2) * rr; pos[i * 3 + 1] = c.y + 0.1 + u * 1.1; pos[i * 3 + 2] = c.z + Math.sin(s[0] + u * 2) * rr; }
    pts.geometry.attributes.position.needsUpdate = true; pts.material.opacity = 0.9 * k * fade; });
  return h; } catch (e) { phxErr(e); return null; } }
// ---- thrown fireball (Hot Hands / Blaze missile): hot core + shell, spark trail, small landing flash ----
function phxFireball(a, b, dur) { try {
  const G = phxGeos(); dur = dur || 0.55; const ttl = dur + 0.5;
  const core = new THREE.Mesh(G.sph, phxMat("fbc", phxHOT)); core.scale.setScalar(0.2); core.position.copy(a);
  const shell = new THREE.Mesh(G.sph, phxMat("fbs", phxSWIRL)); shell.scale.setScalar(0.38); shell.position.copy(a);
  const N = 8, pos = new Float32Array(N * 3), pts = new THREE.Points(new THREE.BufferGeometry(), phxBasic(0xffb050, 0.9, true));
  pts.geometry.setAttribute("position", new THREE.BufferAttribute(pos, 3)); pts.material.size = 0.08; pts.frustumCulled = false;
  for (let i = 0; i < N; i++) { pos[i * 3] = a.x; pos[i * 3 + 1] = a.y; pos[i * 3 + 2] = a.z; }
  const h = phxFx(ttl, [core, shell, pts], (dt, age) => {
    const u = Math.min(1, age / dur);
    phxV0.lerpVectors(a, b, u); phxV0.y += Math.sin(u * Math.PI) * 0.8; // gentle lob
    core.position.copy(phxV0); shell.position.copy(phxV0); shell.rotation.y += dt * 9; shell.rotation.x += dt * 5;
    for (let i = N - 1; i > 0; i--) { pos[i * 3] = pos[(i - 1) * 3]; pos[i * 3 + 1] = pos[(i - 1) * 3 + 1]; pos[i * 3 + 2] = pos[(i - 1) * 3 + 2]; }
    pos[0] = phxV0.x; pos[1] = phxV0.y; pos[2] = phxV0.z; pts.geometry.attributes.position.needsUpdate = true;
    const f = u >= 1 ? Math.max(0, 1 - (age - dur) / 0.4) : 1;
    core.material.uniforms.uA.value = f; shell.material.uniforms.uA.value = f; pts.material.opacity = 0.9 * f; });
  return h; } catch (e) { phxErr(e); return null; } }
// ---- Curveball flight: upgrades the caller's orb mesh with a swirling shell + streak trail ----
// m: the mesh the game already moves (xCbOrb's). Ends when the mesh leaves the scene or on end().
function phxCurveFlight(m) { try {
  const G = phxGeos();
  const ring = new THREE.Mesh(G.ring, phxMat("cbr", phxSWIRL)); ring.scale.setScalar(0.55);
  const shell = new THREE.Mesh(G.sph, phxMat("cbs", phxSWIRL, 2.2)); shell.scale.setScalar(0.42);
  const grp = new THREE.Group(); grp.add(ring, shell); grp.position.copy(m.position);
  const ttl = 3; let dead = false;
  const h = phxFx(ttl, [grp], (dt, age) => { grp.position.copy(m.position); shell.rotation.y += dt * 10; ring.rotation.z += dt * 12;
    if (!m.parent && !dead) { dead = true; h.end(); } });
  return h; } catch (e) { phxErr(e); return null; } }
// ---- Curveball pop: radial starburst of long light rays + hot core flash + shock ring (clip) ----
function phxCurvePop(p) { try {
  const G = phxGeos(), grp = new THREE.Group(), rays = [];
  const core = new THREE.Mesh(G.sph, phxMat("cpp", phxHOT)); core.material.blending = THREE.AdditiveBlending; core.scale.setScalar(0.3); core.position.copy(p); grp.add(core);
  for (let i = 0; i < 18; i++) { const r = new THREE.Mesh(G.ray, phxBasic(i % 3 ? 0xffd9b0 : 0xfff4e6, 0.95, true));
    phxV0.set(Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1).normalize();
    r.quaternion.setFromUnitVectors(phxV1.set(0, 1, 0), phxV0); r.position.copy(p).addScaledVector(phxV0, 0.5); r.scale.set(0.4, 1, 1); grp.add(r); rays.push([r, phxV0.clone()]); }
  const ring = new THREE.Mesh(G.ring2, phxBasic(0xffe8d8, 0.8, true)); ring.position.copy(p); ring.scale.setScalar(0.4); grp.add(ring);
  const ttl = 0.55;
  const h = phxFx(ttl, [grp], (dt, age) => { const u = Math.min(1, age / ttl);
    for (const [r, d] of rays) { const L = 0.6 + u * 5.4; r.scale.y = L; r.position.copy(p).addScaledVector(d, L * 0.5); r.material.opacity = 0.95 * (1 - u * u); }
    core.scale.setScalar(0.3 + u * 1.1); core.material.uniforms.uA.value = 1 - u;
    ring.scale.setScalar(0.4 + u * 2.0); ring.material.opacity = 0.8 * (1 - u * u);
    if (typeof camera !== "undefined") ring.lookAt(camera.position); });
  return h; } catch (e) { phxErr(e); return null; } }
// ---- Run It Back: golden fire-form on the caster's body - mesh-conforming overlay shells ----
// obj: the unit's Object3D (bot/ally model group). Every mesh gets a slightly inflated overlay using
// the mesh's OWN geometry (so the fire silhouette follows the real model, animated poses included);
// overlays are children of their source meshes and are removed on end. Caller geometries are never disposed.
function phxRibForm(obj) { try {
  phxGeos();
  const mat = phxMat("rbf", phxFORM, obj.id % 7), ovs = [];
  obj.traverse((s) => { if (s.isMesh && !s.userData.phxOv && s.geometry) { const o = new THREE.Mesh(s.geometry, mat); o.scale.setScalar(1.08); o.renderOrder = 3; o.raycast = () => {}; o.userData.phxOv = 1; s.add(o); ovs.push([s, o]); } });
  const fx = { age: 0, ttl: 12, objs: [], tick: (dt, age) => { mat.uniforms.uA.value = Math.min(1, age / 0.3) * (obj.parent ? 1 : 0); if (!obj.parent) phxEnd(h); },
    done: () => { for (const [s, o] of ovs) { try { s.remove(o); } catch (e) {} } try { mat.dispose(); } catch (e) {} } };
  phxPush(fx); const h = { fx, end: function () { phxEnd(this); } }; return h; } catch (e) { phxErr(e); return null; } }
// ---- Run It Back: flame marker burning at the cast point (clip: a small fire mark on the ground) ----
function phxRibMarker(p, ttl) { try {
  const G = phxGeos();
  const ring = new THREE.Mesh(G.ring, phxBasic(0xff9a3a, 0.9, true)); ring.rotation.x = -Math.PI / 2; ring.position.set(p.x, p.y + 0.06, p.z); ring.scale.setScalar(0.55);
  const col = new THREE.Mesh(G.plane, phxMat("rbm", phxMARK, p.x)); col.position.set(p.x, p.y + 0.5, p.z); col.scale.set(0.5, 1.0, 1);
  const col2 = col.clone(); col2.material = phxMat("rbm", phxMARK, p.z + 2); col2.rotation.y = Math.PI / 2;
  const life = ttl || 10;
  const h = phxFx(life, [ring, col, col2], (dt, age) => { const f = Math.min(1, age / 0.25) * Math.min(1, (life - age) / 0.4);
    ring.material.opacity = 0.9 * f * (0.8 + 0.2 * Math.sin(age * 6)); col.material.uniforms.uA.value = f; col2.material.uniforms.uA.value = f;
    if (typeof camera !== "undefined") { col.lookAt(camera.position.x, col.position.y, camera.position.z); col2.rotation.y = col.rotation.y + Math.PI / 2; } });
  return h; } catch (e) { phxErr(e); return null; } }
// ---- Run It Back: the return burst at the marker - a vertical fire column, golden flash, sparks ----
function phxRibReturn(p) { try {
  const G = phxGeos(), grp = new THREE.Group();
  const col = new THREE.Mesh(G.cyl, phxMat("rbr", phxFORM, 3.3)); col.material.blending = THREE.AdditiveBlending; col.position.set(p.x, p.y, p.z); col.scale.set(0.5, 0.01, 0.5); grp.add(col);
  const flash = new THREE.Mesh(G.sph, phxMat("rbf2", phxHOT)); flash.material.blending = THREE.AdditiveBlending; flash.position.set(p.x, p.y + 1, p.z); flash.scale.setScalar(0.3); grp.add(flash);
  const N = 12, pos = new Float32Array(N * 3), vel = [], pts = new THREE.Points(new THREE.BufferGeometry(), phxBasic(0xffc060, 1, true));
  pts.geometry.setAttribute("position", new THREE.BufferAttribute(pos, 3)); pts.material.size = 0.11; pts.frustumCulled = false;
  for (let i = 0; i < N; i++) { const a = Math.random() * 6.28; vel.push([Math.cos(a) * (1 + Math.random() * 2), 2 + Math.random() * 3.5, Math.sin(a) * (1 + Math.random() * 2)]); pos[i * 3] = p.x; pos[i * 3 + 1] = p.y + 0.3; pos[i * 3 + 2] = p.z; }
  grp.add(pts);
  const ttl = 0.9;
  const h = phxFx(ttl, [grp], (dt, age) => { const u = Math.min(1, age / ttl);
    col.scale.y = 2.2 * Math.min(1, age / 0.15); col.scale.x = col.scale.z = 0.5 * (1 - u * 0.6); col.material.uniforms.uA.value = 1 - u;
    flash.scale.setScalar(0.3 + u * 1.6); flash.material.uniforms.uA.value = Math.max(0, 1 - u * 1.6);
    for (let i = 0; i < N; i++) { pos[i * 3] += vel[i][0] * dt; pos[i * 3 + 1] += vel[i][1] * dt; pos[i * 3 + 2] += vel[i][2] * dt; vel[i][1] -= 7 * dt; }
    pts.geometry.attributes.position.needsUpdate = true; pts.material.opacity = 1 - u; });
  return h; } catch (e) { phxErr(e); return null; } }
// ---- Run It Back: the death burst where the body was lost (clip: screen-filling yellow-white fire) ----
function phxRibDeath(p) { try {
  const G = phxGeos(), grp = new THREE.Group();
  const ball = new THREE.Mesh(G.sph, phxMat("rbd", phxFORM, 5.1)); ball.material.blending = THREE.AdditiveBlending; ball.position.set(p.x, p.y + 1, p.z); ball.scale.setScalar(0.4); grp.add(ball);
  const flash = new THREE.Mesh(G.sph, phxMat("rbd2", phxHOT)); flash.material.blending = THREE.AdditiveBlending; flash.position.copy(ball.position); flash.scale.setScalar(0.5); grp.add(flash);
  const ttl = 0.8;
  const h = phxFx(ttl, [grp], (dt, age) => { const u = Math.min(1, age / ttl);
    ball.scale.setScalar(0.4 + u * 1.8); ball.material.uniforms.uA.value = 1 - u;
    flash.scale.setScalar(0.5 + u * 3.0); flash.material.uniforms.uA.value = Math.max(0, 1 - u * 1.8); });
  return h; } catch (e) { phxErr(e); return null; } }
