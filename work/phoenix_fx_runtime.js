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
  uniforms: Object.assign({ uT: phxU, uP: { value: 0 }, uSeed: { value: 0 }, uA: { value: 1 }, uInflate: { value: 0 } }, uniforms || {}),
  vertexShader: "uniform float uT;uniform float uP;uniform float uSeed;uniform float uInflate;varying vec3 vN;varying vec3 vV;varying vec3 vP;varying vec3 vW;varying vec2 vUv;\n#include <skinning_pars_vertex>\nvoid main(){vUv=uv;vP=position;vec3 objectNormal=vec3(normal);vec3 transformed=vec3(position);\n#ifdef USE_SKINNING\n#include <skinbase_vertex>\n#include <skinnormal_vertex>\n#include <skinning_vertex>\n#endif\ntransformed+=objectNormal*uInflate;vec4 w=modelMatrix*vec4(transformed,1.0);vW=w.xyz;vec4 mv=viewMatrix*w;vV=-mv.xyz;vN=normalMatrix*objectNormal;gl_Position=projectionMatrix*mv;}",
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
const phxWALL = "uniform float uT;uniform float uP;uniform float uSeed;uniform float uA;uniform float uG;varying vec3 vN;varying vec3 vV;varying vec3 vP;varying vec3 vW;varying vec2 vUv;\n" + phxNOISE + "\nvoid main(){float y=vUv.y;float wx=vW.x+vW.z;float wz=vW.x-vW.z;float n=fbm(vec3(vW.x*0.7,y*0.6-uT*0.8,vW.z*0.7));float top=0.80+0.20*n;float body=smoothstep(0.0,0.10,top-y);float mb=(1.0-smoothstep(0.0,0.35,y));float lk=pow(noise(vec3(wx*2.2,y*1.5-uT*3.2,7.0)),2.0)*mb;float lk2=pow(noise(vec3(wz*1.4+31.0,y*0.9-uT*2.1,4.0)),3.0)*(1.0-smoothstep(0.25,1.0,y));float vein=1.0-abs(2.0*fbm(vec3(wx*1.6,y*2.6-uT*1.7,wz*1.6))-1.0);vein=pow(vein,4.0)*body;vec3 c=mix(vec3(0.66,0.11,0.11),vec3(0.93,0.30,0.16),clamp(y*0.55+mb*0.45,0.0,1.0));c=mix(c,vec3(1.0,0.62,0.22),clamp(lk*0.9+lk2*0.7,0.0,0.85));c=mix(c,vec3(1.0,0.72,0.30),vein*0.55);c=mix(c,vec3(0.55,0.08,0.08),(1.0-vein)*0.18*body);c+=vec3(0.08,0.02,0.01)*n;float seam=(1.0-smoothstep(0.0,0.06,y));c=mix(c,vec3(1.0,0.85,0.5),seam*0.8);float ef=smoothstep(0.0,0.04,vUv.x)*(1.0-smoothstep(0.96,1.0,vUv.x));float gf=(1.0-smoothstep(uG-0.08,uG,vUv.x));float a=(body*(0.66+0.34*clamp(lk+lk2*1.2+n*0.3,0.0,1.0))*ef*gf+seam*0.45*gf)*uA;if(a<0.004)discard;gl_FragColor=vec4(c,min(a,1.0));}";
// molten pool (Hot Hands): dark red lava bed, bright flowing vein cracks, hot core pulse, ragged edge
const phxPOOL = "uniform float uT;uniform float uP;uniform float uSeed;uniform float uA;varying vec3 vN;varying vec3 vV;varying vec3 vP;varying vec3 vW;varying vec2 vUv;\n" + phxNOISE + "\nvoid main(){vec2 q=(vUv-0.5)*2.0;float r=length(q);float wob=fbm(vec3(q*2.2+uSeed*7.0,uT*0.22));float rw=r+wob*0.42-0.21;float vein=1.0-abs(2.0*fbm(vec3(q*3.4,uT*0.35)+vec3(uSeed*3.0))-1.0);vein=pow(vein,3.0);float core=(1.0-smoothstep(0.0,0.55,rw))*(0.72+0.28*sin(uT*3.2+uSeed));vec3 c=mix(vec3(0.40,0.09,0.06),vec3(0.96,0.36,0.20),(1.0-smoothstep(0.25,0.9,rw)));c+=vec3(1.0,0.60,0.38)*vein*0.9;c=mix(c,vec3(1.0,0.62,0.40),core*(0.30+0.4*vein));float rim=smoothstep(0.72,0.92,rw)*(1.0-smoothstep(0.92,1.02,rw));c+=vec3(1.0,0.55,0.30)*rim*0.7;float a=(1.0-smoothstep(0.82,1.0,rw))*uA;if(a<0.004)discard;gl_FragColor=vec4(c,a*0.96);}";
// hot additive core (fireball / pop flash / embers): white-yellow centre to transparent orange rim
const phxHOT = "uniform float uT;uniform float uP;uniform float uSeed;uniform float uA;varying vec3 vN;varying vec3 vV;varying vec3 vP;varying vec3 vW;varying vec2 vUv;void main(){float f=pow(abs(dot(normalize(vN),normalize(vV))),1.5);vec3 c=mix(vec3(1.0,0.42,0.10),vec3(1.0,0.92,0.60),f);float a=(0.25+0.75*f)*uA;gl_FragColor=vec4(c,a);}";
// golden fire-form (Run It Back body): hot gold body with rising flame noise and a bright fresnel rim
const phxFORM = "uniform float uT;uniform float uP;uniform float uSeed;uniform float uA;varying vec3 vN;varying vec3 vV;varying vec3 vP;varying vec3 vW;varying vec2 vUv;\n" + phxNOISE + "\nvoid main(){float f=pow(1.0-abs(dot(normalize(vN),normalize(vV))),1.3);float n=fbm(vec3(vW.x*3.0,vW.y*2.2-uT*3.4,vW.z*3.0));vec3 c=mix(vec3(1.0,0.66,0.18),vec3(1.0,0.95,0.62),n)*(1.0+0.5*f);c+=vec3(1.0,0.98,0.85)*f*f;c=mix(c,vec3(1.0,0.98,0.9),smoothstep(0.5,0.85,n)*0.55);float a=(0.62+0.30*n+0.5*f)*uA;if(a<0.004)discard;gl_FragColor=vec4(c,min(a,1.0));}";
// flame marker column (Run It Back cast point): thin rising fire tongue
const phxPOPRING = "uniform float uT;uniform float uP;uniform float uSeed;uniform float uA;varying vec3 vN;varying vec3 vV;varying vec3 vP;varying vec3 vW;varying vec2 vUv;void main(){float r=length(vUv-0.5)*2.0;float g=exp(-pow((r-0.72)*9.0,2.0));vec3 c=mix(vec3(0.10,0.45,0.95),vec3(0.45,0.85,1.0),g);float a=g*uA;if(a<0.004)discard;gl_FragColor=vec4(c,a);}";
const phxPOPGLOW = "uniform float uT;uniform float uP;uniform float uSeed;uniform float uA;varying vec3 vN;varying vec3 vV;varying vec3 vP;varying vec3 vW;varying vec2 vUv;void main(){float r=length(vUv-0.5)*2.0;float a=pow(max(0.0,1.0-r),3.5)*0.18*uA;vec3 c=mix(vec3(0.40,0.75,1.0),vec3(0.80,0.92,1.0),max(0.0,1.0-r*1.5));if(a<0.004)discard;gl_FragColor=vec4(c,a);}";
// flame marker column (Run It Back cast point): thin rising fire tongue
const phxMARK = "uniform float uT;uniform float uP;uniform float uSeed;uniform float uA;varying vec3 vN;varying vec3 vV;varying vec3 vP;varying vec3 vW;varying vec2 vUv;\n" + phxNOISE + "\nvoid main(){float n=fbm(vec3(vUv.x*3.0+uSeed*5.0,vUv.y*2.0-uT*2.6,uSeed));float f=n-vUv.y*1.1;float a=smoothstep(0.0,0.35,f)*smoothstep(0.0,0.10,vUv.y)*uA;vec3 c=mix(vec3(1.0,0.45,0.10),vec3(1.0,0.85,0.40),(1.0-smoothstep(0.0,0.5,vUv.y)));if(a<0.004)discard;gl_FragColor=vec4(c,a);}";
// swirl shell (Curveball orb): rotating red-orange swirl with a dark core window, additive rim
const phxSWIRL = "uniform float uT;uniform float uP;uniform float uSeed;uniform float uA;varying vec3 vN;varying vec3 vV;varying vec3 vP;varying vec3 vW;varying vec2 vUv;\n" + phxNOISE + "\nvoid main(){float ang=atan(vP.y,vP.x)+uT*6.0+uSeed;float sw=0.5+0.5*sin(ang*3.0+length(vP.xy)*9.0-uT*7.0);float f=pow(1.0-abs(dot(normalize(vN),normalize(vV))),1.4);vec3 c=mix(vec3(0.75,0.10,0.04),vec3(1.0,0.55,0.15),sw);c+=vec3(1.0,0.75,0.35)*f;float a=(0.30+0.55*sw+0.4*f)*uA;if(a<0.004)discard;gl_FragColor=vec4(c,min(a,1.0));}";
const phxV0 = new THREE.Vector3(), phxV1 = new THREE.Vector3(), phxV2 = new THREE.Vector3(), phxQ0 = new THREE.Quaternion();
// ---- Blaze: flame curtain that rises segment by segment from the caster outward, then rapidly falls ----
// Straight cast (matches the game's current blazeWall): phxBlaze(o, dir, len, o2).
// Source-faithful steered cast (wiki Blaze: "hold Fire to bend the wall in the direction of your
// crosshair"): phxBlazePath(pts, o2) - pts = ordered ground points (Vector3-like) along the steered
// path; segments follow the polyline and rise in path order. CALLER CONTRACT (proposed to integrator):
// while fire is held, the caller samples the aim point each tick, appends to the path (clamped to
// XBLZ.length total and 0.3 m short of blocked() geometry like blazeWall), then calls phxBlazePath once
// at release with the recorded path. o2: { grow (deploy 0.125-0.75), life (XBLZ.life), height (XBLZ.height) }.
function phxBlaze(o, dir, len, o2) { try {
  return phxBlazePath([o, new THREE.Vector3(o.x + dir.x * len, o.y, o.z + dir.z * len)], o2); } catch (e) { phxErr(e); return null; } }
function phxBlazePath(pts, o2) { try {
  const G = phxGeos(), op = o2 || {}, grow = op.grow || 0.6, life = op.life || 8, H = op.height || 3;
  const cum = [0]; for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z));
  const L = cum[cum.length - 1] || 0.001;
  const at = (d) => { let i = 1; while (i < cum.length - 1 && cum[i] < d) i++;
    const t = Math.min(1, Math.max(0, (d - cum[i - 1]) / Math.max(0.001, cum[i] - cum[i - 1])));
    return { x: pts[i - 1].x + (pts[i].x - pts[i - 1].x) * t, y: pts[i - 1].y + (pts[i].y - pts[i - 1].y) * t, z: pts[i - 1].z + (pts[i].z - pts[i - 1].z) * t,
      dx: pts[i].x - pts[i - 1].x, dz: pts[i].z - pts[i - 1].z }; };
  // one continuous ribbon following the (possibly steered) path - no panel seams
  // open-top tube (two side sheets + top cap, ~0.56m thick) so the wall reads from every angle -
  // a single flat sheet projects to nothing when viewed edge-on (ci15 floor-strip-only finding)
  const M = Math.max(8, Math.min(48, Math.round(L / 0.45))), HW = 0.28;
  const posA = new Float32Array((M + 1) * 6 * 3), uvA = new Float32Array((M + 1) * 6 * 2), idxA = [];
  for (let j = 0; j <= M; j++) { const d = L * j / M, p = at(d), nl = Math.hypot(p.dx, p.dz) || 1, nx = -p.dz / nl * HW, nz = p.dx / nl * HW, u = d / L, b = j * 18, v = j * 12;
    const put = (k, x, y, z, vv) => { posA[b + k * 3] = x; posA[b + k * 3 + 1] = y; posA[b + k * 3 + 2] = z; uvA[v + k * 2] = u; uvA[v + k * 2 + 1] = vv; };
    put(0, p.x - nx, 0, p.z - nz, 0); put(1, p.x - nx, 1, p.z - nz, 1);
    put(2, p.x - nx, 1, p.z - nz, 1); put(3, p.x + nx, 1, p.z + nz, 1);
    put(4, p.x + nx, 0, p.z + nz, 0); put(5, p.x + nx, 1, p.z + nz, 1);
    if (j < M) { const a = j * 6, q = (j + 1) * 6;
      idxA.push(a, q, a + 1, q, q + 1, a + 1);
      idxA.push(a + 2, q + 2, a + 3, q + 2, q + 3, a + 3);
      idxA.push(a + 4, q + 4, a + 5, q + 4, q + 5, a + 5); } }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(posA, 3)); geo.setAttribute("uv", new THREE.BufferAttribute(uvA, 2)); geo.setIndex(idxA); geo.computeVertexNormals();
  const mat = phxMat("wall", phxWALL, pts[0].x + pts[0].z); mat.uniforms.uG = { value: 0 };
  const wall = new THREE.Mesh(geo, mat); wall.frustumCulled = false;
  const grp = new THREE.Group(); grp.add(wall);
  const seams = [];
  const ns = Math.max(2, Math.min(12, Math.round(L / 1.4)));
  for (let i = 0; i < ns; i++) { const p = at(L * (i + 0.5) / ns);
    const sm = new THREE.Mesh(G.plane, phxMat("seam", phxHOT)); sm.rotation.x = -Math.PI / 2; sm.rotateOnWorldAxis(phxV0.set(0, 1, 0), Math.atan2(-p.dz, p.dx)); sm.position.set(p.x, p.y + 0.06, p.z); sm.scale.set(L / ns + 0.1, 0.55, 1); grp.add(sm); seams.push(sm); }
  const y0 = pts[0].y;
  wall.position.y = y0;
  const fall = 0.4, ttl = grow + life + fall;
  const h = phxFx(ttl, [grp], (dt, age) => {
    if (age >= grow + life) { const f = Math.max(0, 1 - (age - grow - life) / fall); wall.scale.y = Math.max(0.001, H * f); mat.uniforms.uA.value = f; mat.uniforms.uG.value = 1;
      for (const sm of seams) sm.material.uniforms.uA.value = f; }
    else { wall.scale.y = H; mat.uniforms.uG.value = Math.min(1, age / grow);
      const se = Math.min(1, age / grow); for (const sm of seams) sm.material.uniforms.uA.value = se; } });
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
  const ring = new THREE.Mesh(G.ring, phxMat("cbr", phxSWIRL)); ring.scale.setScalar(0.13);
  const shell = new THREE.Mesh(G.sph, phxMat("cbs", phxSWIRL, 2.2)); shell.scale.setScalar(0.11);
  const grp = new THREE.Group(); grp.add(ring, shell); grp.position.copy(m.position);
  const streak = new THREE.Mesh(G.sph, phxBasic(0xff3020, 0.8, true)); streak.material.blending = THREE.AdditiveBlending; streak.frustumCulled = false;
  const N = 8, pos = new Float32Array(N * 3), pts = new THREE.Points(new THREE.BufferGeometry(), phxBasic(0xff2818, 1.0, true));
  pts.geometry.setAttribute("position", new THREE.BufferAttribute(pos, 3)); pts.material.size = 0.2; pts.material.sizeAttenuation = true; pts.frustumCulled = false;
  for (let i = 0; i < N; i++) { pos[i * 3] = m.position.x; pos[i * 3 + 1] = m.position.y; pos[i * 3 + 2] = m.position.z; }
  const px = m.position.x, py = m.position.y, pz = m.position.z; let lx = px, ly = py, lz = pz;
  const ttl = 3; let dead = false;
  const h = phxFx(ttl, [grp, streak, pts], (dt, age) => { grp.position.copy(m.position); shell.rotation.y += dt * 10; ring.rotation.z += dt * 12;
    phxV0.set(m.position.x - lx, m.position.y - ly, m.position.z - lz); const sp = phxV0.length();
    if (sp > 1e-4) { phxV0.normalize(); streak.quaternion.setFromUnitVectors(phxV1.set(1, 0, 0), phxV0);
      streak.position.set(m.position.x - phxV0.x * 0.5, m.position.y - phxV0.y * 0.5, m.position.z - phxV0.z * 0.5);
      streak.scale.set(0.55 + Math.min(0.6, sp * 6), 0.05, 0.05); }
    lx = m.position.x; ly = m.position.y; lz = m.position.z;
    for (let i = N - 1; i > 0; i--) { pos[i * 3] = pos[(i - 1) * 3]; pos[i * 3 + 1] = pos[(i - 1) * 3 + 1]; pos[i * 3 + 2] = pos[(i - 1) * 3 + 2]; }
    pos[0] = m.position.x; pos[1] = m.position.y; pos[2] = m.position.z; pts.geometry.attributes.position.needsUpdate = true;
    if (!m.parent && !dead) { dead = true; h.end(); } });
  return h; } catch (e) { phxErr(e); return null; } }
// ---- Curveball pop: radial starburst of long light rays + hot core flash + shock ring (clip) ----
function phxCurvePop(p) { try {
  const G = phxGeos(), grp = new THREE.Group();
  const ring = new THREE.Mesh(G.plane, phxMat("cpr", phxPOPRING)); ring.material.blending = THREE.AdditiveBlending; ring.material.side = THREE.DoubleSide; ring.position.copy(p); ring.scale.setScalar(0.5); grp.add(ring);
  const glow = new THREE.Mesh(G.plane, phxMat("cpg", phxPOPGLOW, 1.3)); glow.material.blending = THREE.AdditiveBlending; glow.material.side = THREE.DoubleSide; glow.position.copy(p); glow.scale.setScalar(0.3); grp.add(glow);
  const ttl = 0.4;
  const h = phxFx(ttl, [grp], (dt, age) => { const u = Math.min(1, age / ttl);
    ring.scale.setScalar(0.7 + u * 1.2); ring.material.uniforms.uA.value = 1 - u * u;
    glow.scale.setScalar(0.35 + u * 0.55); glow.material.uniforms.uA.value = 1 - u;
    if (typeof camera !== "undefined") { ring.lookAt(camera.position); glow.lookAt(camera.position); } });
  return h; } catch (e) { phxErr(e); return null; } }
// ---- Run It Back: golden fire-form on the caster's body - mesh-conforming overlay shells ----
// obj: the unit's Object3D (bot/ally model group). Every mesh gets a slightly inflated overlay using
// the mesh's OWN geometry (so the fire silhouette follows the real model, animated poses included);
// overlays are children of their source meshes and are removed on end. Caller geometries are never disposed.
// overlay shell that follows animation: a SkinnedMesh riding the same skeleton for rigged parts
// (the game's agents are SkinnedMesh rigs - a static child Mesh would NOT follow bones)
function phxShell(s, mat, flag) { let o;
  if (s.isSkinnedMesh) { o = new THREE.SkinnedMesh(s.geometry, mat); o.bind(s.skeleton, s.bindMatrix); o.frustumCulled = false; s.parent.add(o); }
  else { o = new THREE.Mesh(s.geometry, mat); s.add(o); }
  if (s.morphTargetInfluences && o.morphTargetInfluences) for (let i = 0; i < s.morphTargetInfluences.length; i++) o.morphTargetInfluences[i] = s.morphTargetInfluences[i];
  if (mat.uniforms && mat.uniforms.uInflate) mat.uniforms.uInflate.value = 0.028; mat.polygonOffset = true; mat.polygonOffsetFactor = -2; mat.polygonOffsetUnits = -2; o.renderOrder = 3; o.raycast = () => {}; o.userData[flag] = 1; return o; }
function phxRibForm(obj) { try {
  phxGeos();
  const mat = phxMat("rbf", phxFORM, obj.id % 7), ovs = [];
  obj.traverse((s) => { if (s.isMesh && !s.userData.phxOv && s.geometry) { const o = phxShell(s, mat, "phxOv"); ovs.push([s, o]); } });
  const fx = { age: 0, ttl: 12, objs: [], tick: (dt, age) => { mat.uniforms.uA.value = Math.min(1, age / 0.3) * (obj.parent ? 1 : 0); if (!obj.parent) phxEnd(h); },
    done: () => { for (const [s, o] of ovs) { try { (o.isSkinnedMesh ? o.parent : s).remove(o); } catch (e) {} } try { mat.dispose(); } catch (e) {} } };
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
