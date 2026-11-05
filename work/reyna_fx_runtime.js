// ---- REYNA FX ----
// Reyna ability visuals (work/reyna_fx_runtime.js), reference-grounded in the wiki showcase clips
// (wiki.playvalorant.com/en-us/images/Leer_Showcase.mp4, Devour_Showcase.mp4, Dismiss_Showcase.mp4,
// Empress_Showcase.mp4; frame sheets reviewed 2026-11-04) and the wiki ability pages.
// Procedural approximation, no extracted game assets. Pure client fx: souls, nearsight, heals, speed
// and invisibility stay in the caller (offline ryKey/sgTick; online server reyna.js + netReynaSync).
//
// Reference look targets (from the clips):
//   Soul orb (Vitality): a bright pink-magenta orb with a hot core, dark violet energy swirling around
//     it and thin wisps rising; it hovers above the ground and pulses.
//   Leer: a small purple orb that streaks through terrain trailing dark wisps, then deploys as a
//     floating eye: an intense magenta-white iris wrapped in slowly turning dark violet smoke petals,
//     with a soft glow halo. It pulses during its 0.4 s windup, then burns while nearsighting.
//   Devour: a crackling magenta energy tether streams from the consumed orb to Reyna while she heals;
//     the orb shrinks as it drains; a burst of magenta cross-sparks marks the consume.
//   Dismiss: Reyna's body turns ethereal - a transparent body with bright purple outlines and violet
//     wisps. First person: purple energy wisps curl in at the screen edges. (Empress + Dismiss: fully
//     invisible - setVisible(false).)
//   Empress: a violet implosion on cast, then a dark violet frenzy aura on her body, purple-edged
//     vision for the caster, and enemies highlighted as solid red silhouettes.
//
// Contract (integrator): every function takes world positions / Object3Ds, returns a handle
// { fx, end() }. Effects self-end at their ttl; end() finishes one early; reyReset() ends them all
// (round reset / disconnect). Shared geometry/programs persist; cloned per-effect materials are
// disposed recursively. Game-dt driven: call reyUseGameTick() once, then reyTick(dt) from the game
// loop; without it a single rAF pump runs while effects exist (isolated harness only). No heavy
// textures or loaders at module load: all shaders are procedural, built lazily on first use.
// The Leer eye is intentionally small (the "Reyna blind causes lag" report): ~10 low-poly meshes,
// no full-screen transparent geometry; the nearsight screen itself stays the game's DOM overlay.
// Globals used (read-only): THREE, scene, camera, document. xE guarded.
//
// Wiring (integrator; line numbers = index.html on branch instinct @ 7d7cedd):
//   Tick: reyUseGameTick() once beside omxUseGameTick(); call reyTick(dt) in the frame loop where
//     omxTick is called (~L9056).
//   Soul orbs (rySoul ~L9143; online rows in netReynaSync ~L16622): reySoul(orbPos, ttlS) wherever a
//     soul orb appears (local kills and replicated ones).
//   Leer (cast in ryKey ~L9171; J.leer tick in sgTick ~L9204; mpFx "eye" branch ~L14120):
//     reyLeerCast(eyePos, deployPos, travelS, 0.4, XLEER). Nearsight application stays in
//     ryLeerLook/game code; the eye mesh this returns is visual only.
//   Devour (~L9178): reyDevour(orbPos, reynaModel, XDEV.t /* or XDEV.te under Empress */) when a
//     soul is consumed; pass the model Object3D so the tether tracks her.
//   Dismiss (~L9181): reyDismiss(reynaModel, 1.5); first person also reyVeil("Dis", 1.5). Under
//     Empress call the returned handle's setVisible(false) for full invisibility.
//   Empress (~L9184): reyEmpressCast(reynaPos) on activation; reyEmpressAura(reynaModel) for third
//     person; reyHighlight(enemyModel) per enemy while active (J.hl list); reyVeil("Emp") first
//     person; end all four handles when Empress ends (death/round end) - reyReset() covers resets.
var reyU = { value: 0 }, reyLive = [], reyPumpOn = false, reyGT = null, reyGeo = null, reyProg = {};
function reyNow() { try { return performance.now() / 1000; } catch (e) { return Date.now() / 1000; } }
function reyErr(e) { try { if (typeof xE === "function") xE(e); } catch (e2) {} }
function reyGeos() { if (reyGeo) return reyGeo; reyGeo = {
  sph: new THREE.SphereGeometry(1, 22, 14),
  plane: new THREE.PlaneGeometry(1, 1),
  petal: new THREE.PlaneGeometry(1, 1, 1, 3),
  ribbon: new THREE.PlaneGeometry(1, 1, 1, 10),
  ring: new THREE.RingGeometry(0.72, 1, 48),
  ray: new THREE.PlaneGeometry(0.14, 1),
  cyl: new THREE.CylinderGeometry(1, 1, 1, 14, 3, true) };
  reyGeo.cyl.translate(0, 0.5, 0); for (const k in reyGeo) reyGeo[k].userData.reyShared = 1; return reyGeo; }
function reyShader(k, frag, uniforms) { if (reyProg[k]) return reyProg[k]; const m = new THREE.ShaderMaterial({
  uniforms: Object.assign({ uT: reyU, uP: { value: 0 }, uSeed: { value: 0 }, uA: { value: 1 }, uInflate: { value: 0 } }, uniforms || {}),
  vertexShader: "uniform float uT;uniform float uP;uniform float uSeed;uniform float uInflate;varying vec3 vN;varying vec3 vV;varying vec3 vP;varying vec3 vW;varying vec2 vUv;\n#include <skinning_pars_vertex>\nvoid main(){vUv=uv;vP=position;vec3 objectNormal=vec3(normal);vec3 transformed=vec3(position);\n#ifdef USE_SKINNING\n#include <skinbase_vertex>\n#include <skinnormal_vertex>\n#include <skinning_vertex>\n#endif\ntransformed+=objectNormal*uInflate;vec4 w=modelMatrix*vec4(transformed,1.0);vW=w.xyz;vec4 mv=viewMatrix*w;vV=-mv.xyz;vN=normalMatrix*objectNormal;gl_Position=projectionMatrix*mv;}",
  fragmentShader: frag, transparent: true, depthWrite: false, side: THREE.DoubleSide });
  m.userData.rey = k; reyProg[k] = m; return m; }
function reyMat(k, shader, seed) { const m = reyShader(k, shader).clone(); m.uniforms.uT = reyU; if (seed !== undefined) m.uniforms.uSeed.value = seed; return m; }
function reyBasic(c, o, add) { return new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: o, depthWrite: false, fog: false, toneMapped: false, blending: add ? THREE.AdditiveBlending : THREE.NormalBlending, side: THREE.DoubleSide }); }
function reyPush(fx) { if (reyLive.length > 24) { const o = reyLive.shift(); try { o.done(); } catch (e) {} } reyLive.push(fx); if (!reyGT && !reyPumpOn) { reyPumpOn = true; reyPump.last = reyNow(); requestAnimationFrame(reyPump); } return fx; }
function reyPump() { if (reyGT) { reyPumpOn = false; return; } const now = reyNow(), dt = Math.min(0.1, Math.max(0.0005, now - (reyPump.last || now))); reyPump.last = now; reyU.value += dt;
  for (let i = reyLive.length - 1; i >= 0; i--) { const fx = reyLive[i]; fx.age += dt; try { fx.tick(dt, fx.age, Math.min(1, fx.age / fx.ttl)); } catch (e) { reyErr(e); }
    if (fx.age >= fx.ttl) { try { fx.done(); } catch (e) {} reyLive.splice(i, 1); } }
  if (reyLive.length) requestAnimationFrame(reyPump); else reyPumpOn = false; }
function reyUseGameTick() { reyGT = true; reyPumpOn = false; } // integrator then calls reyTick(dt) per frame
function reyTick(dt) { reyU.value += dt; for (let i = reyLive.length - 1; i >= 0; i--) { const fx = reyLive[i]; fx.age += dt; try { fx.tick(dt, fx.age, Math.min(1, fx.age / fx.ttl)); } catch (e) { reyErr(e); } if (fx.age >= fx.ttl) { try { fx.done(); } catch (e) {} reyLive.splice(i, 1); } } }
function reyEnd(h) { if (!h || !h.fx) return; const i = reyLive.indexOf(h.fx); if (i >= 0) reyLive.splice(i, 1); try { h.fx.done(); } catch (e) {} }
function reyReset() { for (let i = reyLive.length - 1; i >= 0; i--) { try { reyLive[i].done(); } catch (e) {} } reyLive.length = 0; }
function reyFx(ttl, objs, tick, done) { const fx = { age: 0, ttl, objs, tick, done: done || function () { objs.forEach((o) => { try { scene.remove(o); o.traverse((m) => { if (m.material && m.material.dispose && !m.material.userData.reyShared) m.material.dispose(); if (m.geometry && !m.geometry.userData.reyShared) m.geometry.dispose(); }); } catch (e) {} }); } }; objs.forEach((o) => scene.add(o)); reyPush(fx); return { fx, end: function () { reyEnd(this); } }; }
const reyNOISE = "float hash(vec3 p){p=fract(p*.3183099+vec3(.11,.23,.37));p*=17.0;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}float noise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);}float fbm(vec3 p){float n=0.0;float a=.55;for(int i=0;i<3;i++){n+=a*noise(p);p=p*2.11+vec3(5.1,1.7,9.2);a*=.5;}return n;}";
// soul energy: hot magenta core, violet swirl, additive rim glow (orbs / Leer core / bursts)
const reySOUL = "uniform float uT;uniform float uP;uniform float uSeed;uniform float uA;varying vec3 vN;varying vec3 vV;varying vec3 vP;varying vec3 vW;varying vec2 vUv;\n" + reyNOISE + "\nvoid main(){float f=pow(abs(dot(normalize(vN),normalize(vV))),1.4);float sw=fbm(vec3(vP*3.0+uSeed*7.0+vec3(0.0,-uT*1.6,0.0)));vec3 c=mix(vec3(0.42,0.05,0.62),vec3(1.0,0.38,0.9),f);c*=0.55+0.75*sw;c+=vec3(0.5,0.1,0.6)*sw*sw;c=mix(c,vec3(1.0,0.85,1.0),pow(f,3.0));float a=(0.16+0.62*f+0.3*sw)*uA;if(a<0.004)discard;gl_FragColor=vec4(c,min(a,1.0));}";
// dark violet smoke petals (Leer): near-black wispy body with a magenta rim, ragged falling edge
const reyPETAL = "uniform float uT;uniform float uP;uniform float uSeed;uniform float uA;varying vec3 vN;varying vec3 vV;varying vec3 vP;varying vec3 vW;varying vec2 vUv;\n" + reyNOISE + "\nvoid main(){float w=fbm(vec3(vUv*3.0+uSeed*9.0,0.0)+vec3(0.0,-uT*0.9,0.0));vec2 q=vUv-vec2(0.5,0.35);float r=length(q*vec2(1.4,1.0));float edge=1.0-smoothstep(0.28+w*0.25,0.62+w*0.2,r);vec3 c=mix(vec3(0.05,0.01,0.10),vec3(0.35,0.05,0.55),w*0.8);c+=vec3(0.9,0.15,0.9)*pow(1.0-edge,2.0)*0.4;float a=edge*(0.55+0.4*w)*uA;if(a<0.004)discard;gl_FragColor=vec4(c,a);}";
// soft radial halo (billboarded glow)
const reyHALO = "uniform float uT;uniform float uP;uniform float uSeed;uniform float uA;varying vec3 vN;varying vec3 vV;varying vec3 vP;varying vec3 vW;varying vec2 vUv;void main(){float r=length(vUv-0.5)*2.0;float a=pow(max(0.0,1.0-r),2.2)*uA;vec3 c=mix(vec3(0.75,0.15,0.85),vec3(1.0,0.55,0.95),max(0.0,1.0-r*1.6));if(a<0.004)discard;gl_FragColor=vec4(c,a);}";
// devour tether: streaming magenta energy bands along the ribbon
const reyTETHER = "uniform float uT;uniform float uP;uniform float uSeed;uniform float uA;varying vec3 vN;varying vec3 vV;varying vec3 vP;varying vec3 vW;varying vec2 vUv;\n" + reyNOISE + "\nvoid main(){float sway=0.20*sin(vUv.y*7.0-uT*5.0+uSeed)+0.08*sin(vUv.y*17.0-uT*9.0);float xc=vUv.x-0.5-sway;float band=0.5+0.5*sin(vUv.y*22.0+uT*13.0+uSeed*8.0);float n=noise(vec3(vUv.y*9.0-uT*3.0,vUv.x*3.0,uSeed));float edge=1.0-smoothstep(0.05,0.34,abs(xc));vec3 c=mix(vec3(0.20,0.03,0.36),vec3(0.55,0.12,0.68),band);c=mix(c,vec3(0.85,0.35,0.95),pow(band,5.0)*0.7);c+=vec3(1.0,0.7,1.0)*pow(band,9.0)*0.4;float a=edge*(0.16+0.30*band+0.22*n)*uA;if(a<0.004)discard;gl_FragColor=vec4(c,min(a,1.0));}";
// ghost shell (Dismiss / Empress aura): transparent body, bright purple fresnel outline, rising wisps
const reyGHOST = "uniform float uT;uniform float uP;uniform float uSeed;uniform float uA;varying vec3 vN;varying vec3 vV;varying vec3 vP;varying vec3 vW;varying vec2 vUv;\n" + reyNOISE + "\nvoid main(){float f=pow(1.0-abs(dot(normalize(vN),normalize(vV))),1.3);float n=fbm(vec3(vW.x*3.0,vW.y*2.4-uT*2.8,vW.z*3.0));vec3 c=mix(vec3(0.30,0.07,0.55),vec3(0.72,0.22,1.0),f)*(0.75+0.5*n);c+=vec3(0.95,0.40,1.0)*f*f;float a=(0.22+0.80*f+0.22*n*f)*uA;if(a<0.004)discard;gl_FragColor=vec4(c,min(a,1.0));}";
// frenzy aura (Empress body): darker violet flame with magenta licks, more energetic than the ghost
const reyFRENZY = "uniform float uT;uniform float uP;uniform float uSeed;uniform float uA;varying vec3 vN;varying vec3 vV;varying vec3 vP;varying vec3 vW;varying vec2 vUv;\n" + reyNOISE + "\nvoid main(){float f=pow(1.0-abs(dot(normalize(vN),normalize(vV))),1.4);float n=fbm(vec3(vW.x*3.6,vW.y*2.8-uT*4.2,vW.z*3.6));float lick=smoothstep(0.55,0.9,n);vec3 c=mix(vec3(0.24,0.05,0.45),vec3(0.62,0.16,1.0),f);c+=vec3(1.0,0.25,0.85)*lick*0.9;c+=vec3(0.9,0.5,1.0)*f*f*0.8;float a=(0.22+0.7*f+0.42*lick)*uA;if(a<0.004)discard;gl_FragColor=vec4(c,min(a,1.0));}";
const reyV0 = new THREE.Vector3(), reyV1 = new THREE.Vector3(), reyV2 = new THREE.Vector3(), reyQ = new THREE.Quaternion(), reyQ90 = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2), reyQ2 = new THREE.Quaternion();
// ---- Soul orb (Vitality): hot magenta core, violet swirl shell, rising wisps, hover bob ----
// p: ground point. ttl from the caller (3 s offline; the server row's remaining online).
function reySoul(p, ttl) { try {
  const G = reyGeos(), grp = new THREE.Group();
  const core = new THREE.Mesh(G.sph, reyMat("so", reySOUL, p.x * 0.31 + p.z)); core.scale.setScalar(0.28);
  const shell = new THREE.Mesh(G.sph, reyMat("so2", reySOUL, p.z * 0.17 + 3)); shell.scale.setScalar(0.46);
  const halo = new THREE.Mesh(G.plane, reyMat("soh", reyHALO)); halo.scale.setScalar(1.9);
  grp.add(core, shell, halo); grp.position.set(p.x, p.y + 1.2, p.z);
  const N = 5, pos = new Float32Array(N * 3), pts = new THREE.Points(new THREE.BufferGeometry(), reyBasic(0xd050ff, 0.85, true));
  pts.geometry.setAttribute("position", new THREE.BufferAttribute(pos, 3)); pts.material.size = 0.07; pts.frustumCulled = false; grp.add(pts);
  const life = ttl || 3;
  const h = reyFx(life, [grp], (dt, age) => { const f = Math.min(1, age / 0.25) * Math.min(1, (life - age) / 0.4);
    grp.position.y = p.y + 1.2 + 0.12 * Math.sin(age * 2.4);
    shell.rotation.y += dt * 2.2; shell.rotation.x += dt * 0.9;
    core.material.uniforms.uA.value = f * (0.85 + 0.15 * Math.sin(age * 5)); shell.material.uniforms.uA.value = 0.8 * f; halo.material.uniforms.uA.value = 0.55 * f;
    if (typeof camera !== "undefined") halo.lookAt(camera.position);
    for (let i = 0; i < N; i++) { const u = (age * 0.4 + i / N) % 1, a = i * 2.4 + age * 0.8;
      pos[i * 3] = Math.cos(a) * 0.36 * (1 - u * 0.5); pos[i * 3 + 1] = u * 1.1; pos[i * 3 + 2] = Math.sin(a) * 0.36 * (1 - u * 0.5); }
    pts.geometry.attributes.position.needsUpdate = true; pts.material.opacity = 0.85 * f; });
  return h; } catch (e) { reyErr(e); return null; } }
// ---- Leer: wispy orb flight through terrain, then the deployed eye ----
// a: cast eye point, b: deploy point (ryLeerSpot), travel: s of flight (wiki ~0.55 at max range),
// windup: s on arrival before it nearsights (0.4), active: s it then burns (XLEER 1.6).
function reyLeerCast(a, b, travel, windup, active) { try {
  const G = reyGeos(), grp = new THREE.Group();
  const core = new THREE.Mesh(G.sph, reyMat("le", reySOUL, a.x + b.z)); core.scale.setScalar(0.16);
  const iris = new THREE.Mesh(G.sph, reyMat("le2", reySOUL, 4.4)); iris.scale.set(0.19, 0.17, 0.11); iris.position.z = 0.05;
  const glint = new THREE.Group();
  for (let i = 0; i < 4; i++) { const long = i < 2; const gp = new THREE.Mesh(G.ray, reyBasic(0xfff0fa, 0.95, true)); gp.scale.set(long ? 0.07 : 0.04, long ? 0.40 : 0.24, 1); gp.rotation.z = i * Math.PI / 2 + (long ? 0 : Math.PI / 4); gp.position.z = 0.12; glint.add(gp); }
  const halo = new THREE.Mesh(G.plane, reyMat("leh", reyHALO)); halo.scale.setScalar(0.9);
  grp.add(core, iris, glint, halo);
  const petals = [];
  for (let i = 0; i < 8; i++) { const pt = new THREE.Mesh(G.petal, reyMat("lep", reyPETAL, i * 1.7)); const an = i / 8 * Math.PI * 2;
    pt.position.set(Math.cos(an) * 0.20, Math.sin(an) * 0.14, -0.02); pt.rotation.z = an + Math.PI / 2; pt.scale.set(0.26, 0.32, 1); grp.add(pt); petals.push(pt); }
  const N = 8, pos = new Float32Array(N * 3), pts = new THREE.Points(new THREE.BufferGeometry(), reyBasic(0xa030e0, 0.8, true));
  pts.geometry.setAttribute("position", new THREE.BufferAttribute(pos, 3)); pts.material.size = 0.05; pts.frustumCulled = false;
  for (let i = 0; i < N; i++) { pos[i * 3] = a.x; pos[i * 3 + 1] = a.y; pos[i * 3 + 2] = a.z; }
  const ttl = (travel || 0.55) + (windup || 0.4) + (active || 1.6) + 0.4;
  const h = reyFx(ttl, [grp, pts], (dt, age) => { const tr = travel || 0.55, wu = windup || 0.4;
    let u = Math.min(1, age / tr); reyV0.lerpVectors(a, b, u); grp.position.copy(reyV0);
    const deployed = age >= tr, winding = deployed && age < tr + wu, dying = age > ttl - 0.4;
    const s = (deployed ? Math.min(1, (age - tr) / wu) * 0.8 : 0.42 + 0.18 * u); // swells open during the windup
    grp.scale.setScalar(Math.max(0.05, s * (1 + (winding ? 0.10 * Math.sin(age * 25) : 0.04 * Math.sin(age * 9)))));
    const f = dying ? Math.max(0, (ttl - age) / 0.4) : 1;
    core.material.uniforms.uA.value = f; iris.material.uniforms.uA.value = f * (deployed ? 1 : 0.6); halo.material.uniforms.uA.value = 0.4 * f;
    glint.visible = deployed; for (const gp of glint.children) gp.material.opacity = 0.95 * f;
    for (let i = 0; i < petals.length; i++) { const pt = petals[i], an = i / 8 * Math.PI * 2 + age * (deployed ? 0.9 : 2.6);
      pt.position.set(Math.cos(an) * 0.19, Math.sin(an) * 0.13, -0.02); pt.rotation.z = an + Math.PI / 2; pt.material.uniforms.uA.value = f * (deployed ? 0.55 : 0.5); }
    if (typeof camera !== "undefined") { grp.lookAt(camera.position); halo.lookAt(camera.position); }
    for (let i = N - 1; i > 0; i--) { pos[i * 3] = pos[(i - 1) * 3]; pos[i * 3 + 1] = pos[(i - 1) * 3 + 1]; pos[i * 3 + 2] = pos[(i - 1) * 3 + 2]; }
    pos[0] = reyV0.x; pos[1] = reyV0.y; pos[2] = reyV0.z; pts.geometry.attributes.position.needsUpdate = true;
    pts.material.opacity = deployed ? Math.max(0, 0.8 - (age - tr) * 2) * f : 0.8; });
  h.fx.setLookAt = (v) => { try { grp.lookAt(v); } catch (e) {} };
  return h; } catch (e) { reyErr(e); return null; } }
// ---- Devour: crackling magenta tether from the consumed orb to Reyna + consume burst + orb drain ----
// a: orb point (Vector3 or Object3D with .position), b: Reyna (Object3D -> .position, or Vector3),
// dur: heal seconds (XDEV.t / XDEV.te). Track a moving Reyna by passing her Object3D (world position).
function reyDevour(a, b, dur) { try {
  const G = reyGeos(); dur = dur || 3;
  const pa = () => (a && a.isVector3 ? a : a && a.position ? a.position : reyV1.set(0, 0, 0));
  const pb = () => (b && b.isVector3 ? b : b && b.position ? b.position : reyV1.set(0, 0, 0));
  const A = pa().clone ? pa().clone() : new THREE.Vector3();
  const r1 = new THREE.Mesh(G.ribbon, reyMat("dv", reyTETHER, 1.1)), r2 = new THREE.Mesh(G.ribbon, reyMat("dv", reyTETHER, 4.9));
  const N = 8, pos = new Float32Array(N * 3), pts = new THREE.Points(new THREE.BufferGeometry(), reyBasic(0xff5ae0, 0.95, true));
  pts.geometry.setAttribute("position", new THREE.BufferAttribute(pos, 3)); pts.material.size = 0.09; pts.frustumCulled = false;
  // consume burst: cross sparks around the orb (clip: a magenta spark burst at the consume)
  const burst = new THREE.Group(), rays = [];
  for (let i = 0; i < 8; i++) { const r = new THREE.Mesh(G.ray, reyBasic(0xff7ae8, 0.95, true));
    reyV2.set(Math.cos(i / 8 * 6.283), Math.sin(i / 8 * 6.283), (i % 2) * 0.4 - 0.2).normalize();
    r.quaternion.setFromUnitVectors(reyV0.set(0, 1, 0), reyV2); r.position.copy(A).addScaledVector(reyV2, 0.25); burst.add(r); rays.push([r, reyV2.clone()]); }
  burst.position.set(0, 0, 0);
  const ttl = dur + 0.3;
  const h = reyFx(ttl, [r1, r2, pts, burst], (dt, age) => {
    const B = pb(); reyV0.copy(A).lerp(B, 0.5); reyV0.y += 0.4; const d = A.distanceTo(B);
    reyV2.copy(B).sub(A).normalize(); reyQ.setFromUnitVectors(reyV1.set(0, 1, 0), reyV2);
    reyQ2.setFromAxisAngle(reyV1.set(0, 1, 0), age * 1.7);
    r1.position.copy(reyV0); r1.quaternion.copy(reyQ).multiply(reyQ2); r1.scale.set(0.09, Math.max(0.1, d), 0.09);
    r2.position.copy(reyV0); r2.quaternion.copy(reyQ).multiply(reyQ90).multiply(reyQ2); r2.scale.set(0.09, Math.max(0.1, d), 0.09);
    r1.material.uniforms.uA.value = 1.0; r2.material.uniforms.uA.value = 0.8;
    for (let i = 0; i < N; i++) { const u = (age * 0.8 + i / N) % 1; reyV2.copy(A).lerp(B, u); reyV2.y += 0.4 * Math.sin(u * Math.PI);
      pos[i * 3] = reyV2.x; pos[i * 3 + 1] = reyV2.y; pos[i * 3 + 2] = reyV2.z; }
    pts.geometry.attributes.position.needsUpdate = true;
    const bu = Math.min(1, age / 0.4);
    for (const [r, dir] of rays) { const L = 0.4 + bu * 1.6; r.scale.y = L; r.position.copy(A).addScaledVector(dir, L * 0.5); r.material.opacity = 0.95 * Math.max(0, 1 - bu); }
    const end = age > dur ? Math.max(0, 1 - (age - dur) / 0.3) : 1;
    r1.material.uniforms.uA.value *= end; r2.material.uniforms.uA.value *= end; pts.material.opacity = 0.95 * end; });
  return h; } catch (e) { reyErr(e); return null; } }
// ---- Dismiss: ethereal ghost shell on the unit (purple-outlined transparent body, rising wisps) ----
// obj: the unit's Object3D. dur: 1.5 s. handle.setVisible(false) for Empress invisibility.
// overlay shell that follows animation: a SkinnedMesh riding the same skeleton for rigged parts
// (the game's agents are SkinnedMesh rigs - a static child Mesh would NOT follow bones)
function reyShell(s, mat, flag, infl) { let o;
  if (s.isSkinnedMesh) { o = new THREE.SkinnedMesh(s.geometry, mat); o.bind(s.skeleton, s.bindMatrix); o.frustumCulled = false; s.parent.add(o); }
  else { o = new THREE.Mesh(s.geometry, mat); s.add(o); }
  if (s.morphTargetInfluences && o.morphTargetInfluences) for (let i = 0; i < s.morphTargetInfluences.length; i++) o.morphTargetInfluences[i] = s.morphTargetInfluences[i];
  if (mat.uniforms && mat.uniforms.uInflate) mat.uniforms.uInflate.value = (infl - 1) * 0.35; mat.polygonOffset = true; mat.polygonOffsetFactor = -2; mat.polygonOffsetUnits = -2; o.renderOrder = 3; o.raycast = () => {}; o.userData[flag] = 1; return o; }
function reyDismiss(obj, dur) { try {
  reyGeos();
  // mesh-conforming ghost: an inflated overlay per source mesh (follows the real model and its poses)
  const mat = reyMat("dm", reyGHOST, obj.id % 9), ovs = [];
  obj.traverse((s) => { if (s.isMesh && !s.userData.reyOv && s.geometry) { const o = reyShell(s, mat, "reyOv", 1.07); ovs.push([s, o]); } });
  const N = 6, pos = new Float32Array(N * 3), pts = new THREE.Points(new THREE.BufferGeometry(), reyBasic(0xb040ff, 0.8, true));
  pts.geometry.setAttribute("position", new THREE.BufferAttribute(pos, 3)); pts.material.size = 0.08; pts.frustumCulled = false; obj.add(pts);
  const life = dur || 1.5; let vis = true;
  const fx = { age: 0, ttl: life + 0.3, objs: [], tick: (dt, age) => { const f = Math.min(1, age / 0.18) * Math.min(1, (life + 0.3 - age) / 0.3) * (vis ? 1 : 0);
      mat.uniforms.uA.value = f;
      for (let i = 0; i < N; i++) { const u = (age * 0.7 + i / N) % 1, an = i * 2.1 + age;
        pos[i * 3] = Math.cos(an) * 0.4; pos[i * 3 + 1] = u * 1.6; pos[i * 3 + 2] = Math.sin(an) * 0.4; }
      pts.geometry.attributes.position.needsUpdate = true; pts.material.opacity = 0.8 * f;
      if (!obj.parent) reyEnd(h); },
    done: () => { for (const [s, o] of ovs) { try { (o.isSkinnedMesh ? o.parent : s).remove(o); } catch (e) {} } try { obj.remove(pts); mat.dispose(); pts.material.dispose(); pts.geometry.dispose(); } catch (e) {} } };
  reyPush(fx);
  const h = { fx, end: function () { reyEnd(this); }, setVisible: (v) => { vis = !!v; } };
  return h; } catch (e) { reyErr(e); return null; } }
// ---- Empress: violet implosion burst on cast (world position of the caster) ----
function reyEmpressCast(p) { try {
  const G = reyGeos(), grp = new THREE.Group();
  const ball = new THREE.Mesh(G.sph, reyMat("em", reySOUL, 8.8)); ball.position.set(p.x, p.y + 1.2, p.z); ball.scale.setScalar(2.2); grp.add(ball);
  const ring = new THREE.Mesh(G.ring, reyBasic(0xc040ff, 0.9, true)); ring.rotation.x = -Math.PI / 2; ring.position.set(p.x, p.y + 0.08, p.z); ring.scale.setScalar(3.5); grp.add(ring);
  const N = 14, pos = new Float32Array(N * 3), pts = new THREE.Points(new THREE.BufferGeometry(), reyBasic(0xd050ff, 1, true));
  pts.geometry.setAttribute("position", new THREE.BufferAttribute(pos, 3)); pts.material.size = 0.1; pts.frustumCulled = false;
  const dir = [];
  for (let i = 0; i < N; i++) { const a = Math.random() * 6.28; dir.push([Math.cos(a) * 3, 0.5 + Math.random() * 2, Math.sin(a) * 3]); pos[i * 3] = p.x + dir[i][0]; pos[i * 3 + 1] = p.y + dir[i][1]; pos[i * 3 + 2] = p.z + dir[i][2]; }
  grp.add(pts);
  const ttl = 0.7; // implosion: everything converges on Reyna, then a bright settle
  const h = reyFx(ttl, [grp], (dt, age) => { const u = Math.min(1, age / ttl), k = 1 - u;
    ball.scale.setScalar(Math.max(0.05, 2.2 * k * k)); ball.material.uniforms.uA.value = 0.35 + 0.45 * u;
    ring.scale.setScalar(Math.max(0.05, 3.5 * k)); ring.material.opacity = 0.9 * u;
    for (let i = 0; i < N; i++) { pos[i * 3] = p.x + dir[i][0] * k * k; pos[i * 3 + 1] = p.y + 1.2 + (dir[i][1] - 1.2) * k; pos[i * 3 + 2] = p.z + dir[i][2] * k * k; }
    pts.geometry.attributes.position.needsUpdate = true; pts.material.opacity = u; });
  return h; } catch (e) { reyErr(e); return null; } }
// ---- Empress: the frenzy aura on the caster's body (third person / other players' Reynas) ----
function reyEmpressAura(obj) { try {
  reyGeos();
  // mesh-conforming frenzy aura: an inflated overlay per source mesh (follows the real model)
  const mat = reyMat("ema", reyFRENZY, obj.id % 5), ovs = [];
  obj.traverse((s) => { if (s.isMesh && !s.userData.reyOv && s.geometry) { const o = reyShell(s, mat, "reyOv", 1.09); ovs.push([s, o]); } });
  const fx = { age: 0, ttl: 60, objs: [], tick: (dt, age) => { mat.uniforms.uA.value = Math.min(1, age / 0.3) * (obj.parent ? 1 : 0); if (!obj.parent) reyEnd(h); },
    done: () => { for (const [s, o] of ovs) { try { (o.isSkinnedMesh ? o.parent : s).remove(o); } catch (e) {} } try { mat.dispose(); } catch (e) {} } };
  reyPush(fx);
  const h = { fx, end: function () { reyEnd(this); } };
  return h; } catch (e) { reyErr(e); return null; } }
// ---- Empress: enemy highlight - solid red silhouette shells (clip: enemies glow flat red) ----
// obj: the enemy unit's Object3D; overlays its meshes with BackSide red shells (the game's rvMat pattern).
let reyHlMat = null;
function reyHighlight(obj) { try {
  if (!reyHlMat) { reyHlMat = new THREE.MeshBasicMaterial({ color: 0xff2830, transparent: true, opacity: 0.55, depthTest: true, depthWrite: false, side: THREE.FrontSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, fog: false, toneMapped: false }); reyHlMat.userData.reyShared = 1; }
  const ovs = [];
  obj.traverse((s) => { if (s.isMesh && !s.userData.reyHl && !s.userData.reyOv && s.geometry) { const o = reyShell(s, reyHlMat, "reyHl", 1.12); o.renderOrder = 999; ovs.push([s, o]); } });
  const fx = { age: 0, ttl: 60, objs: [], tick: () => { if (!obj.parent) reyEnd(h); },
    done: () => { for (const [s, o] of ovs) { try { (o.isSkinnedMesh ? o.parent : s).remove(o); } catch (e) {} } } }; // reyHlMat is shared: not disposed
  reyPush(fx);
  const h = { fx, end: function () { reyEnd(this); } };
  return h; } catch (e) { reyErr(e); return null; } }
// ---- first-person veils (DOM, transform/opacity only; the lag report rules out heavy overlays) ----
function reyCss() { if (document.getElementById("reyCss")) return; const s = document.createElement("style"); s.id = "reyCss"; s.textContent =
  ".reyV{position:fixed;inset:0;pointer-events:none;z-index:6;background-repeat:no-repeat;opacity:0;transition:opacity .22s}" +
  "@keyframes reyDrift{0%{background-position:0% 0%,100% 100%,50% 50%}100%{background-position:3% 5%,97% 95%,50% 52%}}" +
  ".reyVDis{background:radial-gradient(55% 80% at 4% 50%,rgba(120,20,190,.5) 0%,rgba(120,20,190,0) 70%),radial-gradient(55% 80% at 96% 50%,rgba(150,30,220,.5) 0%,rgba(150,30,220,0) 70%),radial-gradient(120% 120% at 50% 50%,rgba(0,0,0,0) 55%,rgba(30,5,50,.55) 100%);animation:reyDrift 1.4s ease-in-out infinite alternate}" +
  ".reyVEmp{background:radial-gradient(70% 60% at 8% 96%,rgba(140,25,200,.45) 0%,rgba(140,25,200,0) 60%),radial-gradient(70% 60% at 92% 96%,rgba(170,30,220,.45) 0%,rgba(170,30,220,0) 60%),radial-gradient(120% 120% at 50% 50%,rgba(0,0,0,0) 50%,rgba(20,4,36,.6) 100%);animation:reyDrift 1.1s ease-in-out infinite alternate}" +
  ".reyV.on{opacity:1}";
  (document.head || document.documentElement).appendChild(s); }
// reyVeil("Dis"|"Emp"): first-person screen energy for Dismiss / Empress; end() or ttl removes it.
function reyVeil(kind, seconds) { try { reyCss(); const d = document.createElement("div"); d.className = "reyV reyV" + kind; document.body.appendChild(d);
  requestAnimationFrame(() => { d.classList.add("on"); });
  const life = seconds || 3600; // Empress lasts until death: the caller ends the handle
  const fx = { age: 0, ttl: life, objs: [], tick: () => {}, done: () => { d.classList.remove("on"); setTimeout(() => d.remove(), 300); } };
  reyPush(fx); const h = { fx, end: function () { reyEnd(this); } }; return h; } catch (e) { reyErr(e); return null; } }
