// ---- SAGE FX ----
// Sage ability visuals (work/sage_fx_runtime.js), reference-grounded in the wiki showcase clips
// (wiki.playvalorant.com/en-us/images/Barrier_Orb_Showcase.mp4, Slow_Orb_Showcase.mp4,
// Healing_Orb_Showcase.mp4, Resurrection_Showcase.mp4; frame sheets reviewed 2026-11-04).
// Procedural approximation, not extracted game assets. Mechanics (wall HP/fortify timing, slow
// factor, heal rate, rez channel) stay in the caller; this module draws only.
//   Barrier Orb: 4 jade ice segments rising from the ground, frost shimmer; fortify brightens;
//     break = shard burst per segment. Dimensions follow XBAR (2.6w x 3h x 0.4th x 4 segs).
//   Slow Orb: teal orb with icy shell in flight; field = faceted ice sheet + standing 3D crystal
//     shards that grow in and shrink away (the current game has a flat sheet only).
//   Healing Orb: restrained soft cyan aura + a few rising white sparkles (the current
//     game has sound only).
//   Resurrection: green-cyan veil column over the fallen agent, rising spirit form, light beams.
// Contract: entries take world positions, return a handle with .end() (some with .move/.segs).
// Game-dt driven: sgxUseGameTick() once, then sgxTick(dt) per frame; otherwise a rAF pump runs
// while effects exist. Cloned per-effect materials disposed on end; shared geometry/programs persist.
// Globals used (read-only): THREE, scene, camera?, document?. sgxReset() ends every live effect.
var sgxU = { value: 0 }, sgxLive = [], sgxPumpOn = false, sgxGT = false, sgxGeo = null, sgxProg = {};
function sgxRoundedBlock(w, h, t, r) { const s = new THREE.Shape(); const x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r); s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r); s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  const g = new THREE.ExtrudeGeometry(s, { depth: t - r * 2, bevelEnabled: true, bevelThickness: r, bevelSize: r * 0.9, bevelSegments: 3, curveSegments: 6 });
  g.translate(0, 0, -(t - r * 2) / 2); return g; }
function sgxGeos() { if (sgxGeo) return sgxGeo; sgxGeo = {
  sph: new THREE.SphereGeometry(1, 20, 14),
  box: new THREE.BoxGeometry(1, 1, 1),
  ring: new THREE.RingGeometry(0.86, 1, 48),
  cone: new THREE.ConeGeometry(0.5, 1, 5),
  tetra: new THREE.TetrahedronGeometry(1),
  cyl: new THREE.CylinderGeometry(1, 1, 1, 24, 1, true),
  plane: new THREE.PlaneGeometry(1, 1) }; return sgxGeo; }
function sgxShader(k, frag, opts) { if (sgxProg[k]) return sgxProg[k]; const m = new THREE.ShaderMaterial(Object.assign({
  uniforms: { uT: sgxU, uP: { value: 0 }, uSeed: { value: 0 }, uA: { value: 1 }, uD: { value: 0 } },
  vertexShader: "uniform float uT;uniform float uP;uniform float uSeed;varying vec3 vN;varying vec3 vV;varying vec3 vP;varying vec2 vUv;void main(){vUv=uv;vP=position;vec4 mv=modelViewMatrix*vec4(position,1.0);vV=-mv.xyz;vN=normalMatrix*normal;gl_Position=projectionMatrix*mv;}",
  fragmentShader: frag, transparent: true, depthWrite: false, side: THREE.DoubleSide }, opts || {}));
  sgxProg[k] = m; return m; }
// jade ice: translucent teal body, pale fresnel rim, internal facet shimmer, frost sparkle
const sgxICE = "uniform float uT;uniform float uP;uniform float uSeed;uniform float uA;varying vec3 vN;varying vec3 vV;varying vec3 vP;varying vec2 vUv;void main(){float f=pow(1.0-abs(dot(normalize(vN),normalize(vV))),1.35);float fac=sin(vP.x*9.0+uSeed*5.0)*sin(vP.y*12.0-uSeed*3.0)*sin(vP.z*8.0+2.0);float facet=smoothstep(-0.25,0.75,fac);float crack=smoothstep(0.88,0.98,abs(sin(vP.x*4.5+uSeed*9.0+sin(vP.y*3.5)*1.5)));float spark=step(0.982,0.5+0.5*sin(vP.x*53.0+uT*2.0+uSeed)*sin(vP.y*61.0-uT*1.6)*sin(vP.z*47.0+3.0));vec3 c=mix(vec3(0.10,0.52,0.55),vec3(0.72,0.97,1.0),facet);c=mix(c,vec3(0.92,1.0,1.0),crack*0.55);c+=vec3(1.0)*spark*0.9;c+=vec3(0.55,1.0,1.0)*pow(f,2.0)*0.9;float a=(0.62+0.38*f)*uA*(1.0-uP);if(a<0.004)discard;gl_FragColor=vec4(c,a);}";
// healing swirl ribbon: cyan stream, bright core, soft edges
const sgxSWIRL = "uniform float uT;uniform float uP;uniform float uSeed;uniform float uA;varying vec3 vN;varying vec3 vV;varying vec3 vP;varying vec2 vUv;void main(){float x=vUv.x,y=vUv.y;float across=smoothstep(0.0,0.2,y)*(1.0-smoothstep(0.8,1.0,y));float flow=0.6+0.4*sin(x*31.0-uT*9.0+uSeed*7.0);float tail=1.0-x;vec3 c=mix(vec3(0.10,0.55,0.60),vec3(0.75,1.0,1.0),pow(tail,1.6));float a=across*(0.2+0.8*tail)*flow*uA*(1.0-uP);if(a<0.004)discard;gl_FragColor=vec4(c,a);}";
// resurrection veil: rising green-cyan light, vertical energy stripes
const sgxVEIL = "uniform float uT;uniform float uP;uniform float uSeed;uniform float uA;varying vec3 vN;varying vec3 vV;varying vec3 vP;varying vec2 vUv;void main(){float x=vUv.x,y=vUv.y;float stripe=0.5+0.5*sin(x*43.0+uSeed);float rise=0.5+0.5*sin(y*9.0-uT*2.6+stripe*2.0);float f=pow(1.0-abs(dot(normalize(vN),normalize(vV))),1.2);vec3 c=mix(vec3(0.06,0.35,0.22),vec3(0.45,1.0,0.75),rise*0.6+f*0.5);c+=vec3(0.3,0.9,0.95)*pow(rise,4.0)*0.5;float a=(0.16+0.30*rise*f+0.10*stripe)*(1.0-y*0.55)*uA*(1.0-uP);if(a<0.004)discard;gl_FragColor=vec4(c,a);}";
var sgxGlowTex = null, sgxMoteTex = null, sgxSheetTex = null;
function sgxTexGlow() { if (sgxGlowTex) return sgxGlowTex; const c = document.createElement("canvas"); c.width = c.height = 128; const g = c.getContext("2d");
  const r = g.createRadialGradient(64, 64, 2, 64, 64, 62); r.addColorStop(0, "rgba(255,255,255,1)"); r.addColorStop(0.35, "rgba(255,255,255,0.5)"); r.addColorStop(1, "rgba(255,255,255,0)"); g.fillStyle = r; g.fillRect(0, 0, 128, 128);
  sgxGlowTex = new THREE.CanvasTexture(c); return sgxGlowTex; }
function sgxTexMote() { if (sgxMoteTex) return sgxMoteTex; const c = document.createElement("canvas"); c.width = c.height = 64; const g = c.getContext("2d");
  const r = g.createRadialGradient(32, 32, 1, 32, 32, 30); r.addColorStop(0, "rgba(255,255,255,1)"); r.addColorStop(0.5, "rgba(255,255,255,0.55)"); r.addColorStop(1, "rgba(255,255,255,0)"); g.fillStyle = r; g.fillRect(0, 0, 64, 64);
  sgxMoteTex = new THREE.CanvasTexture(c); return sgxMoteTex; }
// faceted ice sheet texture for the slow field (radial crystal cracks, teal tint)
function sgxTexSheet() { if (sgxSheetTex) return sgxSheetTex; const c = document.createElement("canvas"); c.width = c.height = 256; const g = c.getContext("2d");
  g.clearRect(0, 0, 256, 256);
  // dense continuous ice: filled frosty base, cell structure, brighter frost veins, opaque center fading at rim
  const rg = g.createRadialGradient(128, 128, 4, 128, 128, 126); rg.addColorStop(0, "rgba(190,240,255,0.95)"); rg.addColorStop(0.6, "rgba(120,215,240,0.85)"); rg.addColorStop(0.9, "rgba(60,170,205,0.55)"); rg.addColorStop(1, "rgba(40,150,190,0)"); g.fillStyle = rg; g.beginPath(); g.arc(128, 128, 126, 0, 7); g.fill();
  for (let i = 0; i < 120; i++) { const x = 14 + Math.random() * 228, y = 14 + Math.random() * 228, r = 5 + Math.random() * 13, n = 3 + Math.floor(Math.random() * 3), rot = Math.random() * 6.28;
    g.fillStyle = "rgba(" + (170 + Math.floor(Math.random() * 70)) + "," + (225 + Math.floor(Math.random() * 30)) + ",255," + (0.10 + Math.random() * 0.22) + ")";
    g.strokeStyle = "rgba(235,250,255," + (0.25 + Math.random() * 0.35) + ")"; g.lineWidth = 1.1;
    g.beginPath(); for (let k = 0; k <= n; k++) { const a = rot + k / n * 6.283, rr = r * (0.75 + Math.random() * 0.5); const px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr; if (k === 0) g.moveTo(px, py); else g.lineTo(px, py); } g.fill(); g.stroke(); }
  g.strokeStyle = "rgba(240,252,255,0.55)"; g.lineWidth = 1.4;
  for (let i = 0; i < 34; i++) { const a = Math.random() * 6.28, r0 = Math.random() * 24; g.beginPath(); let x = 128 + Math.cos(a) * r0, y = 128 + Math.sin(a) * r0; g.moveTo(x, y);
    for (let s = 0; s < 3; s++) { const rr = r0 + 18 + s * 26; x = 128 + Math.cos(a + (Math.random() - 0.5) * 0.45) * rr; y = 128 + Math.sin(a + (Math.random() - 0.5) * 0.45) * rr; g.lineTo(x, y); } g.stroke(); }
  sgxSheetTex = new THREE.CanvasTexture(c); return sgxSheetTex; }
function sgxMat(k, shader, seed, opts) { const m = sgxShader(k, shader, opts).clone(); m.uniforms.uT = sgxU; if (seed !== undefined) m.uniforms.uSeed.value = seed; return m; }
function sgxBasic(c, o, add) { return new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: o, depthWrite: false, blending: add ? THREE.AdditiveBlending : THREE.NormalBlending, side: THREE.DoubleSide }); }
function sgxGlow(c, o, s) { const m = new THREE.SpriteMaterial({ map: sgxTexGlow(), color: c, transparent: true, opacity: o, depthWrite: false, blending: THREE.AdditiveBlending }); const sp = new THREE.Sprite(m); sp.scale.setScalar(s || 1); return sp; }
function sgxFree(objs) { objs.forEach((o) => { try { scene.remove(o); o.traverse((q) => { if (q.material && q.material.dispose) q.material.dispose(); if (q.geometry && q.geometry.userData && q.geometry.userData.own) q.geometry.dispose(); }); } catch (e) {} }); }
function sgxPush(fx) { if (sgxLive.length > 24) { const o = sgxLive.shift(); try { o.done(); } catch (e) {} } sgxLive.push(fx); if (!sgxGT && !sgxPumpOn) { sgxPumpOn = true; sgxPump.last = null; requestAnimationFrame(sgxPump); } return fx; }
function sgxStep(dt) { sgxU.value += dt; for (let i = sgxLive.length - 1; i >= 0; i--) { const fx = sgxLive[i]; fx.age += dt; try { fx.tick(dt, fx.age, Math.min(1, fx.age / fx.ttl)); } catch (e) { try { xE(e); } catch (e2) {} }
  if (fx.age >= fx.ttl) { try { fx.done(); } catch (e) {} sgxLive.splice(i, 1); } } }
function sgxPump() { if (sgxGT) { sgxPumpOn = false; return; } const now = (function () { try { return performance.now() / 1000; } catch (e) { return Date.now() / 1000; } })();
  const dt = Math.min(0.1, Math.max(0.0005, now - (sgxPump.last || now))); sgxPump.last = now; sgxStep(dt);
  if (sgxLive.length) requestAnimationFrame(sgxPump); else sgxPumpOn = false; }
function sgxUseGameTick() { sgxGT = true; sgxPumpOn = false; }
function sgxTick(dt) { sgxStep(dt); }
function sgxEnd(h) { if (!h || !h.fx) return; const i = sgxLive.indexOf(h.fx); if (i >= 0) sgxLive.splice(i, 1); try { h.fx.done(); } catch (e) {} }
function sgxReset() { while (sgxLive.length) sgxEnd({ fx: sgxLive[0] }); }
function sgxFx(ttl, objs, tick, done) { const fx = { age: 0, ttl, objs, tick: tick || function () {}, done: done || function () { sgxFree(objs); } }; objs.forEach((o) => scene.add(o)); sgxPush(fx); return { fx, end: function () { sgxEnd(this); } }; }
function sgxErr(e) { try { xE(e); } catch (e2) {} return null; }
function sgxShardBurst(p, n, col, spread) { try { const G = sgxGeos(), grp = new THREE.Group(); grp.position.set(p.x, p.y, p.z);
  const shards = []; for (let i = 0; i < (n || 14); i++) { const s = new THREE.Mesh(G.tetra, sgxMat("ice", sgxICE, i * 1.7)); s.scale.setScalar(0.06 + Math.random() * 0.12);
    const a = Math.random() * 6.28; shards.push({ m: s, v: [Math.cos(a) * (1 + Math.random() * (spread || 3)), 2 + Math.random() * 3, Math.sin(a) * (1 + Math.random() * (spread || 3))], r: [Math.random() * 6, Math.random() * 6] }); grp.add(s); }
  return sgxFx(0.9, [grp], (dt, age, k) => { shards.forEach((s) => { s.v[1] -= 9 * dt; s.m.position.x += s.v[0] * dt; s.m.position.y += s.v[1] * dt; s.m.position.z += s.v[2] * dt;
    if (s.m.position.y < 0.03) { s.m.position.y = 0.03; s.v[1] *= -0.3; s.v[0] *= 0.7; s.v[2] *= 0.7; }
    s.m.rotation.x += s.r[0] * dt; s.m.rotation.y += s.r[1] * dt; s.m.material.uniforms.uP.value = Math.max(0, (age - 0.45) / 0.45); }); });
 } catch (e) { return sgxErr(e); } }
// ---- entries ----
// Barrier Orb: 4 ice segments rise in a staggered wave. p = wall center, yaw = wall facing.
// handle.segs[i].mesh is the solid mesh (integrator registers collision); handle.breakSeg(i)
// shatters and drops one; handle.fortify() is the 2s harden beat (brighter, frost pass).
// jade: smooth luminous translucent teal-green, soft internal swirl, gentle fresnel - the Barrier wall look
const sgxJADE = "uniform float uT;uniform float uP;uniform float uSeed;uniform float uA;uniform float uD;varying vec3 vN;varying vec3 vV;varying vec3 vP;varying vec2 vUv;float sgxH(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5);}void main(){float f=pow(1.0-abs(dot(normalize(vN),normalize(vV))),1.9);float sw=0.5+0.5*sin(vP.y*2.2+uT*0.5+uSeed*3.0+sin(vP.x*1.8+uSeed)*1.6);float d2=0.5+0.5*sin(vP.x*3.1-uSeed*2.0+sin(vP.y*2.6)*1.2);vec3 c=mix(vec3(0.015,0.42,0.46),vec3(0.20,0.94,0.78),sw*0.4+d2*0.2+f*0.4);vec2 gp=vP.xy*(1.15+0.8*fract(uSeed*0.731))+vec2(uSeed*7.3,uSeed*3.1);vec2 ip=floor(gp);vec2 fp=fract(gp);float f1=8.0;float f2=8.0;vec2 cid=vec2(0.0);for(int i=-1;i<=1;i++){for(int j=-1;j<=1;j++){vec2 g=vec2(float(i),float(j));vec2 o=vec2(sgxH(ip+g),fract(sin(dot(ip+g,vec2(269.5,183.3)))*28001.8));float dd=length(g+o-fp);if(dd<f1){f2=f1;f1=dd;cid=ip+g;}else if(dd<f2){f2=dd;}}}float h1=sgxH(cid*1.7);float rh=sgxH(floor(gp*0.31)+vec2(uSeed));float w=0.03+0.15*rh;float vein=1.0-smoothstep(0.0,w,f2-f1);vein*=smoothstep(0.30,0.62,fract(h1*9.0+rh*5.0));c*=0.90+0.16*h1+0.06*clamp(f1,0.0,1.0);c+=vec3(0.42,0.95,0.90)*vein*0.08;float damage=clamp(uD,0.0,1.0);float fracture=(1.0-smoothstep(0.006,0.018+damage*0.025,f2-f1))*smoothstep(1.0-damage,1.05-damage,h1);c=mix(c,vec3(0.025,0.14,0.17),fracture*0.88);c+=vec3(0.35,0.9,0.7)*pow(f,3.0)*0.4;float a=(0.82+0.18*f)*uA*(1.0-uP);if(a<0.004)discard;gl_FragColor=vec4(c,a);}";
function sgxBarrierWall(p, yaw, opts) { try { opts = opts || {}; const startAge = Number.isFinite(opts.age) ? Math.max(0, opts.age) : 0; const G = sgxGeos(), grp = new THREE.Group(); grp.position.set(p.x, p.y || 0, p.z); grp.rotation.y = yaw || 0;
  if (!sgxGeo.wall) sgxGeo.wall = [0, 1, 2, 3].map((i) => sgxRoundedBlock(2.55 + (i % 2) * 0.15, 2.9 + ((i * 7) % 3) * 0.12, 0.55 + (i % 2) * 0.08, 0.17));
  const jit = [[0, 0.04], [-0.05, -0.03], [0.03, 0.05], [-0.02, -0.04]];
  const segs = []; for (let i = 0; i < 4; i++) { const mat = sgxMat("jadeW", sgxJADE, i * 2.3); const m = new THREE.Mesh(sgxGeo.wall[i], mat);
    m.position.set((i - 1.5) * 2.56 + jit[i][0], -3, jit[i][1]); m.rotation.y = jit[i][0] * 0.6; m.visible = false;
    grp.add(m); segs.push({ mesh: m, mat, state: "rising", delay: i * 0.09 }); }
  const frost = sgxGlow(0xbfeaff, 0, 5); frost.position.y = 0.4; grp.add(frost);
  let fortified = false;
  const h = sgxFx(1e9, [grp], (dt, age) => { segs.forEach((s) => { if (s.state === "gone") return; const t = (age - s.delay) / 0.55; if (t < 0) return;
      if (t < 1) { s.mesh.visible = true; const e = 1 - Math.pow(1 - t, 3); s.mesh.position.y = -3 + e * 4.47; s.mat.uniforms.uA.value = e; }
      else if (s.state === "rising") { s.mesh.position.y = 1.47; s.mat.uniforms.uA.value = 1; s.state = "up"; sgxShardBurst(s.mesh.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, -1.2, 0)), 6, 0xbfeaff, 1.2); }
      });
    frost.material.opacity = Math.max(0, Math.min(age, 1) * 0.5 - age * 0.35); });
  if (startAge > 0) { h.fx.age = startAge; segs.forEach((s) => { const t = (startAge - s.delay) / 0.55; if (t >= 1) { s.state = "up"; s.mesh.visible = true; s.mesh.position.y = 1.47; s.mat.uniforms.uA.value = 1; } }); }
  h.segs = segs.map((s) => ({ mesh: s.mesh }));
  h.fortify = function () { if (fortified) return; fortified = true; segs.forEach((s, i) => { s.mat.uniforms.uSeed.value = 40 + i; });
    frost.material.opacity = 0.7; };
  h.breakSeg = function (i, opts) { const s = segs[i]; if (!s || s.state === "gone") return; s.state = "gone"; s.mesh.visible = false;
    if (!(opts && opts.silent)) sgxShardBurst(s.mesh.getWorldPosition(new THREE.Vector3()), 16, 0xbfeaff, 3.5); };
  h.setHp = function (i, frac) { const s = segs[i]; if (!s || s.state === "gone") return; const f = Math.max(0, Math.min(1, frac)); if (!Number.isFinite(f)) return; s.mat.uniforms.uD.value = 1 - f; };
  return h; } catch (e) { return sgxErr(e); } }
// Slow Orb in flight: teal orb with icy shell and sparkle trail. move() follows the bolt arc.
function sgxSlowOrb(x, y, z) { try { const G = sgxGeos(), grp = new THREE.Group();
  const core = new THREE.Mesh(G.sph, sgxBasic(0x7fe8ff, 0.95, true)); core.scale.setScalar(0.16); grp.add(core);
  const shell = new THREE.Mesh(G.sph, sgxMat("iceO", sgxICE, 3.7)); shell.scale.setScalar(0.26); grp.add(shell);
  const glow = sgxGlow(0x9fefff, 0.65, 1.1); grp.add(glow);
  const trailN = 12, tpos = new Float32Array(trailN * 3), hist = [];
  const tg = new THREE.BufferGeometry(); tg.userData.own = 1; tg.setAttribute("position", new THREE.BufferAttribute(tpos, 3));
  const trail = new THREE.Points(tg, new THREE.PointsMaterial({ map: sgxTexMote(), color: 0x9fefff, size: 0.3, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending }));
  scene.add(trail);
  grp.position.set(x, y, z);
  const h = sgxFx(1e9, [grp, trail], (dt) => { shell.rotation.y += dt * 3; shell.rotation.x += dt * 1.7; glow.material.opacity = 0.5 + 0.2 * Math.sin(sgxU.value * 8);
    hist.unshift([grp.position.x, grp.position.y, grp.position.z]); if (hist.length > trailN) hist.pop();
    const a3 = tg.attributes.position.array; for (let i = 0; i < hist.length; i++) { a3[i * 3] = hist[i][0]; a3[i * 3 + 1] = hist[i][1]; a3[i * 3 + 2] = hist[i][2]; } tg.attributes.position.needsUpdate = true; });
  h.move = function (nx, ny, nz) { grp.position.set(nx, ny, nz); };
  return h; } catch (e) { return sgxErr(e); } }
// Slow field: faceted sheet + standing crystal shards that grow in, shimmer, then shrink away.
// seconds should match the game's slow duration so the fade reads as the field expiring.
function sgxSlowField(p, r, seconds) { try { const G = sgxGeos(), grp = new THREE.Group(); grp.position.set(p.x, (p.y || 0), p.z); const R = r || 4, TTL = seconds || 7;
  const sheet = new THREE.Mesh(G.plane, new THREE.MeshBasicMaterial({ map: sgxTexSheet(), transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }));
  sheet.rotation.x = -Math.PI / 2; sheet.scale.setScalar(R * 2.15); sheet.position.y = 0.06; grp.add(sheet);
  const shards = []; const NS = 26;
  for (let i = 0; i < NS; i++) { const a = Math.random() * 6.28, rr = (0.15 + Math.sqrt(Math.random()) * 0.8) * R;
    const c = new THREE.Mesh(G.cone, sgxMat("iceS", sgxICE, i * 3.1)); const hh = 0.4 + Math.random() * Math.random() * 1.5;
    c.position.set(Math.cos(a) * rr, 0, Math.sin(a) * rr); c.userData.h = hh; c.scale.set(0.09 + Math.random() * 0.08, 0.001, 0.09 + Math.random() * 0.08);
    c.rotation.set((Math.random() - 0.5) * 0.5, Math.random() * 6.28, (Math.random() - 0.5) * 0.5); grp.add(c); shards.push(c); }
  const NSP = 18, spos = new Float32Array(NSP * 3), ssd = [];
  for (let i = 0; i < NSP; i++) { const a = Math.random() * 6.28, rr = Math.sqrt(Math.random()) * R; ssd.push([Math.cos(a) * rr, Math.sin(a) * rr, Math.random()]); }
  const sg = new THREE.BufferGeometry(); sg.userData.own = 1; sg.setAttribute("position", new THREE.BufferAttribute(spos, 3));
  const spark = new THREE.Points(sg, new THREE.PointsMaterial({ map: sgxTexMote(), color: 0xd6f6ff, size: 0.22, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending }));
  grp.add(spark);
  const h = sgxFx(TTL, [grp], (dt, age) => { const gin = Math.min(1, age / 0.9), gout = Math.min(1, Math.max(0, (TTL - age) / 0.7)), gg = Math.min(gin, gout);
    const e = 1 - Math.pow(1 - gg, 3);
    sheet.material.opacity = 0.95 * e;
    shards.forEach((c) => { const ee = Math.min(1, e * 1.3); c.scale.y = Math.max(0.001, c.userData.h * ee); c.position.y = c.scale.y / 2; c.material.uniforms.uSeed.value += dt * 0.5; });
    const a3 = sg.attributes.position.array; for (let i = 0; i < NSP; i++) { const s = ssd[i]; s[2] += dt * 0.35; if (s[2] > 1) s[2] -= 1; a3[i * 3] = s[0]; a3[i * 3 + 1] = 0.1 + s[2] * 1.1; a3[i * 3 + 2] = s[1]; }
    sg.attributes.position.needsUpdate = true; spark.material.opacity = 0.9 * gg; });
  return h; } catch (e) { return sgxErr(e); } }
// Healing Orb (observer frames 3.0-4.2s): restrained soft cyan aura hugging the target +
// a few small white sparkles rising slowly and winking out. move() follows the target.
function sgxHeal(x, y, z) { try { const G = sgxGeos(), grp = new THREE.Group(); grp.position.set(x, y, z);
  const aura = sgxGlow(0x9df2e8, 0.26, 1.7); aura.position.y = 1.0; aura.scale.set(1.4, 1.9, 1); grp.add(aura);
  const core = sgxGlow(0xdcfff5, 0.16, 0.9); core.position.y = 1.05; grp.add(core);
  const N = 10, pos = new Float32Array(N * 3), seed = [];
  for (let i = 0; i < N; i++) { seed.push([Math.random() * 6.28, 0.15 + Math.random() * 0.4, Math.random(), 0.22 + Math.random() * 0.4]); }
  const pg = new THREE.BufferGeometry(); pg.userData.own = 1; pg.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const pts = new THREE.Points(pg, new THREE.PointsMaterial({ map: sgxTexMote(), color: 0xf4fffc, size: 0.13, transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending }));
  grp.add(pts);
  const h = sgxFx(1e9, [grp], (dt) => { aura.material.opacity = 0.22 + 0.05 * Math.sin(sgxU.value * 2.4); core.material.opacity = 0.13 + 0.05 * Math.sin(sgxU.value * 3.1 + 1);
    const a3 = pg.attributes.position.array; for (let i = 0; i < N; i++) { const s = seed[i]; s[2] += dt * s[3]; if (s[2] > 1) { s[2] -= 1; s[0] = Math.random() * 6.28; s[1] = 0.15 + Math.random() * 0.4; }
      a3[i * 3] = Math.cos(s[0]) * s[1]; a3[i * 3 + 1] = 0.25 + s[2] * 1.7; a3[i * 3 + 2] = Math.sin(s[0]) * s[1]; }
    pg.attributes.position.needsUpdate = true; });
  h.move = function (nx, ny, nz) { grp.position.set(nx, ny, nz); };
  return h; } catch (e) { return sgxErr(e); } }
// Resurrection: veil column over the fallen agent, a spirit form rising inside, ground ring.
// Duration is caller-owned (w 2s channel + r 1.3s revive in XPAR2); end() finishes with a flash.
function sgxResurrection(p) { try { const G = sgxGeos(), grp = new THREE.Group(); grp.position.set(p.x, p.y || 0, p.z);
  const veil = new THREE.Mesh(G.cyl, sgxMat("veil", sgxVEIL, 1.1)); veil.scale.set(0.9, 2.6, 0.9); veil.position.y = 1.3; grp.add(veil);
  const spirit = new THREE.Mesh(G.sph, sgxMat("veilS", sgxVEIL, 4.2)); spirit.scale.set(0.34, 0.9, 0.34); spirit.position.y = 0.4; grp.add(spirit);
  const head = new THREE.Mesh(G.sph, spirit.material); head.scale.setScalar(0.2); head.position.y = 1.35; spirit.add(head);
  const ring = new THREE.Mesh(G.ring, sgxBasic(0x7dffc8, 0.5, true)); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.07; ring.scale.setScalar(1.4); grp.add(ring);
  const beams = []; for (let i = 0; i < 5; i++) { const b = new THREE.Mesh(G.plane, sgxBasic(0xa8ffd8, 0.0, true)); b.scale.set(0.08, 2.4, 1);
    const a = i / 5 * 6.28; b.position.set(Math.cos(a) * 0.7, 1.2, Math.sin(a) * 0.7); b.rotation.y = -a + Math.PI / 2; beams.push(b); grp.add(b); }
  const beam = new THREE.Mesh(G.plane, sgxBasic(0xc8ffe4, 0.55, true)); beam.scale.set(0.5, 3.4, 1); beam.position.y = 1.7; grp.add(beam);
  const beam2 = beam.clone(); beam2.material = beam.material; beam2.rotation.y = Math.PI / 2; grp.add(beam2);
  const glow = sgxGlow(0x9dffd0, 0.4, 2.6); glow.position.y = 1.2; grp.add(glow);
  const h = sgxFx(1e9, [grp], (dt, age) => { veil.rotation.y += dt * 0.8; beam.material.opacity = 0.4 + 0.18 * Math.sin(sgxU.value * 2.8);
    spirit.position.y = 0.4 + Math.min(1, age / 2.5) * 0.9 + Math.sin(sgxU.value * 2) * 0.05;
    ring.material.opacity = 0.4 + 0.15 * Math.sin(sgxU.value * 3);
    beams.forEach((b, i) => { b.material.opacity = 0.25 + 0.2 * Math.sin(sgxU.value * 2.2 + i * 1.4); });
    glow.material.opacity = 0.35 + 0.12 * Math.sin(sgxU.value * 3.3); });
  h.flash = function () { const fl = sgxGlow(0xd8ffe8, 0.9, 4); fl.position.copy(grp.position).add(new THREE.Vector3(0, 1.2, 0));
    return sgxFx(0.45, [fl], (dt, age, k) => { fl.material.opacity = 0.9 * (1 - k); fl.scale.setScalar(4 + k * 3); }); };
  return h; } catch (e) { return sgxErr(e); } }
// ---- END SAGE FX ----
