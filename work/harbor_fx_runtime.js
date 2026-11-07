// ---- HARBOR FX ----
// Harbor ability visuals (work/harbor_fx_runtime.js), reference-grounded in the wiki showcase clips
// viewed 2026-11-04 (wiki.playvalorant.com/en-us/Storm_Surge, /High_Tide, /Cove, /Reckoning;
// images/Storm_Surge_Showcase.mp4, High_Tide_Showcase.mp4, Cove_Showcase_2.mp4, Reckoning_Showcase.mp4
// frame sheets). Kit verified against the CURRENT (reworked) wiki pages 2026-11-04: C Storm Surge,
// Q High Tide, E Cove (signature), X Reckoning. Procedural approximation, no extracted game assets.
// Reference look: deep teal water, white foam crests, gold shockwave accents.
//   Storm Surge: thrown water orb with a splash trail; on land a dark blue spiral whirlpool disc
//     with a golden horizontal shockwave ring.
//   High Tide: a traveling teal water wall with caustic veins and a white foam crest along the top
//     and leading edge (steerable - handle.setPos/setDir follow the caller's wall head).
//   Cove: teal water bubble dome with caustics and a foam rim; golden shimmer while shielded
//     (handle.setShielded(true/false) from the caller's shield state).
//   Reckoning: golden mandala swirl flash at the origin, then a wide moving water wavefront with a
//     foam crest that travels forward (nearsight/slow stay with the caller).
// Mechanics (nearsight, slow, shield, wall pathing, timing, sound) stay in the caller; pure client fx.
// Globals used (read-only): THREE, scene, player, xE, and (only in hbxCoveAt) a18Smoke.
// All animation runs on game dt: call hbxUseGameTick() once, then hbxTick(dt) from the game loop
// (the same place omxTick is called in jFxTick). Without it a rAF pump runs while effects exist.
// Returns handles accepted by hbxEnd; hbxReset() ends everything (round reset / disconnect).
//
// Integration wiring (integrator owns index.html):
//   1. Storm Surge (a18Key case "Harbor" k "c"): attach hbxSurgeOrb() to the projectile
//      (handle.setPos(p) per frame, .end() on land), then hbxSurge(p, A18C.surge.r) at the pool.
//      ONLINE: Storm Surge and Clove's Meddle both serialize as kind "blast" - resolve the row
//      owner's agent via e.o before choosing hbxSurge vs cvxMeddleBurst.
//   2. High Tide (k "q"): create hbxHighTide(p, yaw) and call handle.setPos(p)/setDir(yaw) as the
//      caller's wall head travels (A18C.tide.speed, .life, .dist); end the handle when the wall ends.
//   3. Cove (k "e"): replace the a18Smoke call with hbxCoveAt(p, C.cove.life, C.cove.r) - keeps the
//      J.smokes record (vision blocking) with the engine mesh hidden and adds this visual. Feed the
//      caller's shield state to handle.setShielded(on).
//   4. Reckoning (k "x"): hbxReckoning(p, yaw, A18C.reckon.dist) at cast; the wavefront advances at
//      A18C.reckon.speed inside this module (purely visual).
//   5. Online (a18NetSync): smoke rows have no ag - resolve the owner's agent from e.o first, then
//      swap A18VIS for Cove owners to hbxCove (keep the J.smokes hidden-mesh pattern from netSyncSmokes).
var hbxU = { value: 0 }, hbxLive = [], hbxPumpOn = false, hbxGT = null, hbxGeo = null, hbxProg = {}, hbxTex = {};
function hbxNow() { try { return performance.now() / 1000; } catch (e) { return Date.now() / 1000; } }
function hbxGeos() { if (hbxGeo) return hbxGeo; hbxGeo = {
  sph: new THREE.SphereGeometry(1, 30, 22),
  sphL: new THREE.SphereGeometry(1, 16, 12),
  ring: new THREE.RingGeometry(0.82, 1, 56),
  circle: new THREE.CircleGeometry(1, 56),
  torus: new THREE.TorusGeometry(1, 0.05, 8, 56),
  plane: new THREE.PlaneGeometry(1, 1, 32, 10) }; return hbxGeo; }
function hbxPuffTex() { if (hbxTex.puff) return hbxTex.puff; const c = document.createElement("canvas"); c.width = c.height = 64; const g = c.getContext("2d");
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(0.4, "rgba(255,255,255,0.5)"); gr.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64); hbxTex.puff = new THREE.CanvasTexture(c); return hbxTex.puff; }
function hbxFoamBlobTex() { if (hbxTex.blob) return hbxTex.blob; // chunky cauliflower foam blob, soft edges
  const c = document.createElement("canvas"); c.width = c.height = 128; const g = c.getContext("2d"); g.clearRect(0, 0, 128, 128);
  for (let i = 0; i < 16; i++) { const a = Math.random() * 6.2832, rr = Math.random() * 30, x = 64 + Math.cos(a) * rr, y = 64 + Math.sin(a) * rr * 0.72, rad = 9 + Math.random() * 15;
    const gr = g.createRadialGradient(x, y, 1, x, y, rad); gr.addColorStop(0, "rgba(255,255,255,0.85)"); gr.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = gr; g.beginPath(); g.arc(x, y, rad, 0, 6.2832); g.fill(); }
  hbxTex.blob = new THREE.CanvasTexture(c); if (THREE.SRGBColorSpace) hbxTex.blob.colorSpace = THREE.SRGBColorSpace; return hbxTex.blob; }
function hbxFoamTex() { if (hbxTex.foam) return hbxTex.foam; // ragged white foam strip (tiling horizontally)
  const c = document.createElement("canvas"); c.width = 256; c.height = 64; const g = c.getContext("2d"); g.clearRect(0, 0, 256, 64);
  for (let i = 0; i < 90; i++) { const x = Math.random() * 256, y = 18 + Math.random() * 34, r = 3 + Math.random() * 10, h = g.createRadialGradient(x, y, 0, x, y, r); h.addColorStop(0, "rgba(255,255,255,0.95)"); h.addColorStop(1, "rgba(255,255,255,0)"); g.fillStyle = h; g.beginPath(); g.arc(x, y, r, 0, 6.2832); g.fill(); }
  hbxTex.foam = new THREE.CanvasTexture(c); hbxTex.foam.wrapS = THREE.RepeatWrapping; return hbxTex.foam; }
function hbxShader(k, frag) { if (hbxProg[k]) return hbxProg[k]; const m = new THREE.ShaderMaterial({
  uniforms: { uT: { value: 0 }, uP: { value: 0 }, uSeed: { value: 0 }, uA: { value: 1 }, uQ: { value: 1 } },
  vertexShader: "uniform float uT;uniform float uP;uniform float uSeed;varying vec3 vN;varying vec3 vV;varying vec3 vP;varying vec2 vUv;void main(){vUv=uv;vec3 p=position;vP=p;vec4 mv=modelViewMatrix*vec4(p,1.0);vV=-mv.xyz;vN=normalMatrix*normal;gl_Position=projectionMatrix*mv;}",
  fragmentShader: frag, transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false });
  m.userData.hbx = k; hbxProg[k] = m; return m; }
// shared water helpers injected into each water shader
const hbxH2O = "float hh(vec3 p){p=fract(p*.3183099+vec3(.11,.23,.37));p*=17.0;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}\nfloat hn(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(mix(hh(i),hh(i+vec3(1,0,0)),f.x),mix(hh(i+vec3(0,1,0)),hh(i+vec3(1,1,0)),f.x),f.y),mix(mix(hh(i+vec3(0,0,1)),hh(i+vec3(1,0,1)),f.x),mix(hh(i+vec3(0,1,1)),hh(i+vec3(1,1,1)),f.x),f.y),f.z);}\nfloat causc(vec2 p,float t){float a=sin(p.x*3.1+t)*sin(p.y*2.7-t*.8);float b=sin(p.x*5.3-t*1.3)*sin(p.y*4.1+t);return pow(abs(a+b)*.5,3.0);}";
// whirlpool disc (polar): dark blue spiral arms churning inward
const hbxPOOL = "uniform float uT;uniform float uP;uniform float uSeed;varying vec2 vUv;\nvoid main(){vec2 q=vUv*2.0-1.0;float r=length(q);if(r>1.0)discard;float a=atan(q.y,q.x);float sw=a+r*5.0-uT*2.6+uSeed;float arms=sin(sw*3.0)*.5+.5;vec3 c=mix(vec3(.02,.14,.30),vec3(.10,.38,.55),arms*(1.0-smoothstep(.15,1.0,r)));c=mix(c,vec3(.55,.85,.9),pow(arms,4.0)*.5*(1.0-r));c+=vec3(.75,.95,1.0)*(1.0-smoothstep(.02,.16,r));float al=(.92)*(1.0-uP)*(1.0-smoothstep(.94,1.0,r));gl_FragColor=vec4(c,al);}";
// water body for wall/dome/orb: teal with caustic veins and soft rim
const hbxWALL = "uniform float uT;uniform float uP;uniform float uSeed;varying vec3 vN;varying vec3 vV;varying vec3 vP;varying vec2 vUv;\n" + hbxH2O + "\nvoid main(){float facing=abs(dot(normalize(vN),normalize(vV)));float rim=pow(1.0-facing,1.5);vec2 q=vUv*vec2(2.2,7.0)+vec2(uSeed);float ca=causc(q+vec2(uT*.9,0.0),uT*.7);vec3 c=mix(vec3(.02,.30,.38),vec3(.08,.52,.58),ca);float v1=1.0-abs(2.0*hn(vec3(vUv*vec2(10.0,16.0),uT*.4)+uSeed)-1.0);c+=vec3(.7,1.0,.95)*pow(v1,14.0)*.8;c=mix(c,vec3(.55,.85,.80),(1.0-smoothstep(.0,.45,vUv.y))*.5);c=mix(c,vec3(.62,.95,.92),rim*.7);float al=(.72)*(1.0-uP);gl_FragColor=vec4(c,al);}";
// cove dome: same water, plus golden shimmer band driven by uA (shielded)
const hbxCOVE = "uniform float uT;uniform float uP;uniform float uSeed;uniform float uA;varying vec3 vN;varying vec3 vV;varying vec3 vP;varying vec2 vUv;\n" + hbxH2O + "\nvoid main(){float facing=abs(dot(normalize(vN),normalize(vV)));float rim=pow(1.0-facing,1.5);vec2 q=vUv*vec2(5.0,2.5)+vec2(uSeed);float ca=causc(q,uT);float facets=pow(causc(q*1.9+3.7,uT*1.4),2.0);vec3 c=mix(vec3(.02,.32,.40),vec3(.10,.58,.62),ca);c+=vec3(.5,.95,.9)*ca*.5;c+=vec3(.75,1.0,.98)*facets*.5;float v2=1.0-abs(2.0*hn(vec3(vUv*vec2(3.0,5.0),uT*.35)+uSeed)-1.0);c+=vec3(.6,1.0,.95)*pow(v2,7.0)*.5;float foam=rim*(.45+.55*hn(vP*4.0+uT*.15+uSeed));c=mix(c,vec3(.97,1.0,1.0),smoothstep(.35,.9,foam));float sh=uA*(.5+.5*sin(vUv.x*20.0-uT*3.0));c=mix(c,vec3(1.0,.85,.45),sh*rim*.8);float al=(.84+.1*uA)*(1.0-uP);gl_FragColor=vec4(c,al);}";
// golden mandala swirl (polar), one flash
const hbxMANDALA = "uniform float uT;uniform float uP;uniform float uSeed;varying vec2 vUv;\nvoid main(){vec2 q=vUv*2.0-1.0;float r=length(q);if(r>1.0)discard;float a=atan(q.y,q.x);float petals=pow(abs(sin(a*6.0+r*9.0-uT*4.0)),6.0);float rings=pow(abs(sin(r*14.0-uT*6.0)),8.0);vec3 c=mix(vec3(1.0,.72,.25),vec3(1.0,.93,.62),petals);float al=(petals*.7+rings*.5)*(1.0-r)*(1.0-uP);gl_FragColor=vec4(c,al);}";
function hbxMat(k, shader, seed) { const m = hbxShader(k, shader).clone(); delete m.userData.hbx; m.uniforms.uT = hbxU; if (seed !== undefined) m.uniforms.uSeed.value = seed; return m; } // clone is disposable; cached program keeps userData.hbx
function hbxBasic(c, o, add) { return new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: o, depthWrite: false, blending: add ? THREE.AdditiveBlending : THREE.NormalBlending, side: THREE.DoubleSide, fog: false, toneMapped: false }); }
function hbxPush(fx) { if (hbxLive.length > 24) { const o = hbxLive.shift(); try { o.done(); } catch (e) {} } hbxLive.push(fx); if (!hbxGT && !hbxPumpOn) { hbxPumpOn = true; hbxPump.last = hbxNow(); requestAnimationFrame(hbxPump); } return fx; }
function hbxPump() { if (hbxGT) { hbxPumpOn = false; return; } const now = hbxNow(), dt = Math.min(0.1, Math.max(0.0005, now - (hbxPump.last || now))); hbxPump.last = now; hbxU.value += dt;
  for (let i = hbxLive.length - 1; i >= 0; i--) { const fx = hbxLive[i]; fx.age += dt; try { fx.tick(dt, fx.age, Math.min(1, fx.age / fx.ttl)); } catch (e) { try { xE(e); } catch (e2) {} }
    if (fx.age >= fx.ttl) { try { fx.done(); } catch (e) {} hbxLive.splice(i, 1); } }
  if (hbxLive.length) requestAnimationFrame(hbxPump); else hbxPumpOn = false; }
function hbxUseGameTick() { hbxGT = true; hbxPumpOn = false; } // integrator then calls hbxTick(dt) per frame
function hbxTick(dt) { hbxU.value += dt; for (let i = hbxLive.length - 1; i >= 0; i--) { const fx = hbxLive[i]; fx.age += dt; try { fx.tick(dt, fx.age, Math.min(1, fx.age / fx.ttl)); } catch (e) { try { xE(e); } catch (e2) {} } if (fx.age >= fx.ttl) { try { fx.done(); } catch (e) {} hbxLive.splice(i, 1); } } }
function hbxEnd(h) { if (!h || !h.fx) return; const i = hbxLive.indexOf(h.fx); if (i >= 0) hbxLive.splice(i, 1); try { h.fx.done(); } catch (e) {} }
function hbxFx(ttl, objs, tick, done) { const fx = { age: 0, ttl, objs, tick, done: done || function () { objs.forEach((o) => { try { scene.remove(o); o.traverse((m) => { if (m.material && m.material.dispose && !m.material.userData.hbx) m.material.dispose(); if (m.userData.og && m.geometry && m.geometry.dispose) m.geometry.dispose(); }); } catch (e) {} }); } }; objs.forEach((o) => { o.traverse ? o.traverse((m) => { m.raycast = () => {}; }) : 0; scene.add(o); }); hbxPush(fx); return { fx, end: function () { hbxEnd(this); } }; }
function hbxReset() { while (hbxLive.length) hbxEnd({ fx: hbxLive[0] }); }
function hbxSprite(tex, col, op, scale) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: col, transparent: true, opacity: op, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, toneMapped: false })); s.scale.setScalar(scale); return s; }
// reckoning ground sheet: shallow water area with branching gold cracks, front revealed via uQ
const hbxRECK = "uniform float uT;uniform float uP;uniform float uSeed;uniform float uQ;varying vec2 vUv;\n" + hbxH2O + "\nvoid main(){if(vUv.y>uQ)discard;float foamedge=1.0-smoothstep(uQ-.06,uQ,vUv.y);vec2 q=vUv*vec2(8.0,14.0)+vec2(uSeed);float v1=1.0-abs(2.0*hn(vec3(q,uT*.35))-1.0);float gold=pow(v1,9.0);vec3 c=mix(vec3(.03,.24,.30),vec3(.09,.42,.44),hn(vec3(q*.6,uT*.15))*.7);c+=vec3(1.0,.72,.28)*gold*.95;c=mix(c,vec3(.92,1.0,.98),foamedge*.4);gl_FragColor=vec4(c,(.85)*(1.0-uP));}";
// ---- Storm Surge: thrown orb (setPos/end), then whirlpool + golden shockwave ----
function hbxSurgeOrb(p0) { try { const G = hbxGeos(), grp = new THREE.Group(); if (p0) grp.position.set(p0.x, p0.y || 1, p0.z);
  const orb = new THREE.Mesh(G.sphL, hbxMat("wall", hbxWALL, Math.random() * 9)); orb.scale.setScalar(0.26); grp.add(orb);
  const trail = []; for (let i = 0; i < 4; i++) { const s = hbxSprite(hbxPuffTex(), 0x66d8e0, 0.5, 0.3 + i * 0.06); s.userData = { ph: i * 0.25 }; trail.push(s); grp.add(s); }
  const fx = hbxFx(600, [grp], (dt) => { const t = hbxU.value; orb.rotation.y += dt * 3;
    trail.forEach((s) => { const ph = (t * 2 + s.userData.ph) % 1; s.position.set(Math.sin(ph * 9) * 0.1, -ph * 0.5, Math.cos(ph * 7) * 0.1); s.material.opacity = 0.5 * (1 - ph); }); });
  return { fx: fx.fx, setPos: function (p) { try { grp.position.set(p.x, p.y, p.z); } catch (e) {} }, end: function () { fx.end(); } }; } catch (e) { try { window.hbxErr = String(e && e.stack || e).slice(0, 300); xE(e); } catch (e2) {} return null; } }
function hbxSurge(p, r, life) { try { const R = r || 4.5, ttl = Math.max(2, life || 6), G = hbxGeos(), grp = new THREE.Group(); grp.position.set(p.x, (p.y || 0) + 0.08, p.z);
  const pool = new THREE.Mesh(G.circle, hbxMat("pool", hbxPOOL, Math.random() * 9)); pool.rotation.x = -Math.PI / 2; pool.scale.setScalar(R * 0.2); grp.add(pool);
  const shock = new THREE.Mesh(G.torus, hbxBasic(0xffc860, 0.95, true)); shock.rotation.x = Math.PI / 2; shock.position.y = 0.15; grp.add(shock);
  const mist = []; for (let i = 0; i < 6; i++) { const s = hbxSprite(hbxPuffTex(), 0x9adfe8, 0.4, 0.5 + (i % 3) * 0.25); s.userData = { a: i * 1.047, off: i * 0.17 }; mist.push(s); grp.add(s); }
  return hbxFx(ttl, [grp], (dt, age) => { const t = hbxU.value, gk = Math.min(1, age / 0.4), die = Math.max(0, (age - (ttl - 0.8)) / 0.8);
    pool.scale.setScalar(R * (0.2 + 0.8 * gk)); pool.rotation.z = -t * 0.7; pool.material.uniforms.uP.value = die;
    const sk = Math.min(1, age / 0.6); shock.scale.setScalar(0.4 + sk * R * 1.25); shock.material.opacity = 0.95 * (1 - sk);
    mist.forEach((s) => { const ph = (t * 0.5 + s.userData.off) % 1; s.position.set(Math.cos(s.userData.a + t * 0.6) * R * (0.3 + ph * 0.5), 0.2 + ph * 1.0, Math.sin(s.userData.a + t * 0.6) * R * (0.3 + ph * 0.5)); s.material.opacity = 0.4 * (1 - die) * Math.sin(ph * Math.PI); }); }); } catch (e) { try { window.hbxErr = String(e && e.stack || e).slice(0, 300); xE(e); } catch (e2) {} return null; } }
// ---- High Tide: traveling water wall with foam crest; setPos/setDir follow the wall head ----
function hbxHighTide(p0, yaw0, opts) { try { const o = opts || {}, ttl = Math.max(2, o.life || 12) + 0.8, G = hbxGeos(), grp = new THREE.Group();
  const W = o.width || 10, H = o.height || 4.4;
  const RAD = W * 0.85, TH = W / RAD; // reference: thick curved shell, not a flat plane
  const wgeo = new THREE.CylinderGeometry(RAD, RAD, H, 24, 1, true, -TH / 2, TH);
  const wall = new THREE.Mesh(wgeo, hbxMat("wall", hbxWALL, Math.random() * 9)); wall.userData.og = true; wall.material.side = THREE.DoubleSide; wall.position.set(0, H / 2, -RAD); grp.add(wall);
  const lipGeo = new THREE.CylinderGeometry(RAD + 0.15, RAD + 0.4, 0.85, 24, 1, true, -TH / 2, TH);
  const lip = new THREE.Mesh(lipGeo, new THREE.MeshBasicMaterial({ map: hbxFoamTex(), color: 0xf2feff, transparent: true, opacity: 0.92, depthWrite: false, fog: false, side: THREE.DoubleSide })); lip.material.map = hbxFoamTex().clone(); lip.material.map.needsUpdate = true; lip.material.map.repeat.set(2, 1); lip.material.map.wrapS = THREE.RepeatWrapping; for (let li = 0; li < lipGeo.attributes.position.count; li++) { const ly = lipGeo.attributes.position.getY(li), lk = (ly + 0.425) / 0.85; lipGeo.attributes.position.setZ(li, lipGeo.attributes.position.getZ(li) + Math.max(0, lk) * Math.max(0, lk) * 1.3); }
  lipGeo.computeVertexNormals(); lip.userData.og = true; lip.position.set(0, H - 0.42, -RAD + 0.15); grp.add(lip);
  const crests = []; for (let ci = 0; ci < 7; ci++) { const cs = hbxSprite(hbxFoamBlobTex(), 0xffffff, 0.9, 1.2 + (ci % 3) * 0.35); cs.material.rotation = ci * 1.3; cs.userData = { a: -TH / 2 + (ci / 6) * TH, off: ci * 0.23 }; crests.push(cs); grp.add(cs); }
  const golds = []; for (let gi = 0; gi < 6; gi++) { const gs = hbxSprite(hbxPuffTex(), 0xffd070, 0.7, 0.7 + (gi % 2) * 0.3); gs.userData = { x0: (gi / 5 - 0.5) * W, off: gi * 0.37 }; golds.push(gs); grp.add(gs); }
  const base = []; for (let i = 0; i < 5; i++) { const s = hbxSprite(hbxPuffTex(), 0xbfeef2, 0.35, 0.9 + (i % 3) * 0.3); s.userData = { x0: (i / 4 - 0.5) * W, off: i * 0.19 }; base.push(s); grp.add(s); }
  if (p0) grp.position.set(p0.x, p0.y || 0, p0.z); grp.rotation.y = yaw0 || 0;
  const fx = hbxFx(ttl, [grp], (dt, age) => { const t = hbxU.value, die = Math.max(0, (age - (ttl - 0.8)) / 0.8), vis = 1 - die;
    wall.material.uniforms.uP.value = die; lip.material.map.offset.x = t * 0.3; lip.material.opacity = 0.78 * vis;
    crests.forEach((cs) => { const cp = (t * 0.7 + cs.userData.off) % 1; cs.position.set(RAD * Math.sin(cs.userData.a), H - 0.55 + Math.sin(t * 2.2 + cs.userData.off * 7) * 0.1 + cp * 0.2, RAD * Math.cos(cs.userData.a) - RAD + 0.35 + cp * 0.2); cs.material.opacity = 0.85 * vis * Math.sin(cp * Math.PI); });
    golds.forEach((gs) => { const gp = (t * 0.9 + gs.userData.off) % 1; const ga = Math.asin(Math.max(-1, Math.min(1, gs.userData.x0 / RAD))); gs.position.set(gs.userData.x0, H - 0.4 + Math.sin(t * 3 + gs.userData.off * 9) * 0.35, RAD * Math.cos(ga) - RAD + 0.5); gs.material.opacity = 0.7 * vis * Math.sin(gp * Math.PI); });
    base.forEach((s) => { const ph = (t * 0.6 + s.userData.off) % 1; s.position.set(s.userData.x0, 0.3 + ph * 0.9, 0.3 + Math.sin(t * 2 + s.userData.off * 8) * 0.2); s.material.opacity = 0.35 * vis * Math.sin(ph * Math.PI); }); });
  return { fx: fx.fx, obj: grp, setPos: function (p) { try { grp.position.set(p.x, p.y != null ? p.y : grp.position.y, p.z); } catch (e) {} }, setDir: function (yaw) { try { grp.rotation.y = yaw; } catch (e) {} }, end: function () { fx.end(); } }; } catch (e) { try { window.hbxErr = String(e && e.stack || e).slice(0, 300); xE(e); } catch (e2) {} return null; } }
// ---- Cove: water dome + foam rim + golden shield shimmer; hbxCoveAt keeps the J.smokes record ----
function hbxCove(p, r, life) { try { const R = r || 4.1, ttl = Math.max(1, life || 12) + 1, G = hbxGeos(), grp = new THREE.Group(); grp.position.set(p.x, (p.y || 0), p.z);
  const dome = new THREE.Mesh(G.sph, hbxMat("cove", hbxCOVE, Math.random() * 9)); dome.scale.setScalar(R * 0.2); dome.position.y = 0; grp.add(dome);
  const rim = new THREE.Mesh(G.ring, new THREE.MeshBasicMaterial({ map: hbxFoamTex(), transparent: true, opacity: 0.9, depthWrite: false, fog: false, side: THREE.DoubleSide })); rim.material.map = hbxFoamTex().clone(); rim.material.map.needsUpdate = true; rim.material.map.repeat.set(5, 1); rim.material.map.wrapS = THREE.RepeatWrapping; rim.rotation.x = -Math.PI / 2; rim.scale.setScalar(R * 1.02); rim.position.y = 0.1; grp.add(rim);
  const foams = []; for (let fi = 0; fi < 10; fi++) { const fs = hbxSprite(hbxFoamBlobTex(), 0xffffff, 0.9, 1.0 + (fi % 3) * 0.35); fs.material.rotation = fi * 1.7; fs.userData = { a: fi / 10 * Math.PI * 2, off: fi * 0.31 }; foams.push(fs); grp.add(fs); }
  const state = { shielded: false };
  const fx = hbxFx(ttl, [grp], (dt, age) => { const t = hbxU.value, grow = Math.min(1, age / 0.6), g2 = 1 - (1 - grow) * (1 - grow) * (1 - grow), die = Math.max(0, (age - (ttl - 1)) / 1);
    dome.scale.setScalar(Math.max(0.01, R * (0.2 + 0.8 * g2))); dome.rotation.y += dt * 0.08;
    dome.material.uniforms.uP.value = die; dome.material.uniforms.uA.value += ((state.shielded ? 1 : 0) - dome.material.uniforms.uA.value) * Math.min(1, dt * 6);
    rim.material.map.offset.x = t * 0.2; rim.material.opacity = 0.5 * (1 - die);
    const fr = R * (0.2 + 0.8 * g2) * 0.98; foams.forEach((fs) => { const fp = (t * 0.4 + fs.userData.off) % 1; fs.position.set(Math.cos(fs.userData.a + t * 0.15) * fr, 0.25 + Math.sin(t * 1.8 + fs.userData.off * 6) * 0.15, Math.sin(fs.userData.a + t * 0.15) * fr); fs.material.opacity = 0.75 * (1 - die) * (0.5 + 0.5 * Math.sin(fp * 6.2832)); }); });
  return { fx: fx.fx, setShielded: function (on) { state.shielded = !!on; }, end: function () { fx.end(); } }; } catch (e) { try { window.hbxErr = String(e && e.stack || e).slice(0, 300); xE(e); } catch (e2) {} return null; } }
function hbxCoveAt(p, dur, r) { let m = null; try { m = a18Smoke(p, dur, r, 0x2a7f8c, 0x9adfe8); m.visible = false; } catch (e) { try { xE(e); } catch (e2) {} }
  return hbxCove({ x: p.x, y: p.y || 0, z: p.z }, r, dur); }
// ---- Reckoning: golden mandala flash, then a wide moving water wavefront ----
function hbxReckoning(p, yaw, dist, opts) { try { const o = opts || {}, D = dist || 30, speed = o.speed || 7, ttl = D / speed + 5.5, G = hbxGeos(), grp = new THREE.Group(); grp.position.set(p.x, (p.y || 0), p.z); grp.rotation.y = yaw || 0;
  const mand = new THREE.Mesh(G.circle, hbxMat("mandala", hbxMANDALA, Math.random() * 9)); mand.rotation.x = -Math.PI / 2; mand.position.y = 0.1; mand.scale.setScalar(0.5); grp.add(mand);
  const W = o.width || 26;
  const area = new THREE.Mesh(G.plane, hbxMat("reck", hbxRECK, Math.random() * 9)); area.rotation.x = -Math.PI / 2; area.scale.set(W, D, 1); area.position.set(0, 0.12, -D / 2); area.material.uniforms.uQ.value = 0; grp.add(area);
  const geys = []; for (let gi = 0; gi < 5; gi++) { const gz = -((gi + 0.7) / 5.6) * D, gx = (gi % 2 ? -1 : 1) * (W * 0.16 + (gi % 3) * 2.2);
    const gm = new THREE.Mesh(G.sphL, hbxMat("wall", hbxWALL, Math.random() * 9)); gm.scale.set(1.1, 0.01, 1.1); gm.position.set(gx, 0, gz); grp.add(gm);
    const gf = hbxSprite(hbxPuffTex(), 0xffd070, 0, 2.2); gf.position.set(gx, 0.6, gz); grp.add(gf);
    geys.push({ m: gm, f: gf, z: gz }); }
  const spray = []; for (let i = 0; i < 6; i++) { const s2 = hbxSprite(hbxPuffTex(), i % 2 ? 0xbfeef2 : 0xffd98a, 0.4, 1.1 + (i % 3) * 0.4); s2.userData = { x0: (i / 5 - 0.5) * W, off: i * 0.16 }; spray.push(s2); grp.add(s2); }
  return hbxFx(ttl, [grp], (dt, age) => { const t = hbxU.value;
    const mk = Math.min(1, age / 0.7); mand.scale.setScalar(0.5 + mk * 7); mand.material.uniforms.uP.value = mk;
    const wk = Math.max(0, age - 0.4); const d = Math.min(D, wk * speed);
    const die = d >= D ? Math.min(1, (wk * speed - D) / 4.0) : 0;
    area.material.uniforms.uQ.value = Math.max(0.001, d / D); area.material.uniforms.uP.value = die;
    geys.forEach((g) => { const gph = Math.max(0, Math.min(1, (d - Math.abs(g.z)) / 2.5)); const h = Math.sin(gph * Math.PI) * 3.4; g.m.scale.set(0.7, Math.max(0.01, h * 0.55), 0.7); g.m.position.y = h * 0.55; g.m.material.uniforms.uP.value = die; g.f.material.opacity = 0.7 * Math.sin(gph * Math.PI) * (1 - die); });
    spray.forEach((s2) => { const ph = (t * 0.8 + s2.userData.off) % 1; s2.position.set(s2.userData.x0, 0.4 + ph * 1.4, -d + 0.4); s2.material.opacity = 0.4 * (1 - die) * Math.sin(ph * Math.PI); }); }); } catch (e) { try { window.hbxErr = String(e && e.stack || e).slice(0, 300); xE(e); } catch (e2) {} return null; } }
// ---- END HARBOR FX ----
