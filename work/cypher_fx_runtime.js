// ---- CYPHER FX ----
// Cypher ability visuals (work/cypher_fx_runtime.js), reference-grounded in the wiki showcase
// clips (wiki.playvalorant.com/en-us/images/Trapwire_Showcase.mp4, Cyber_Cage_Showcase.mp4,
// Spycam_Showcase.mp4, Neural_Theft_Showcase.mp4), phase-timed from the clips 2026-11-04.
// Procedural approximation, not extracted game assets. Game mechanics stay in the caller.
//
// Reference look targets (clip-measured):
//   Trapwire: tossed blue device; deployed = two small anchor nodes with a faint shimmering
//     cyan wire; trigger = cyan zap at the crossing point + a ~1.25 s ORANGE REVEAL SILHOUETTE
//     of the crosser (server: reveal while within 4 m of the crossing, 1.25 s slow);
//     victim view = grey radial streak wash for the slow.
//   Cyber Cage: tossed blue orb; CLOSED frosted cylinder (r 3.72, half-height 5): milky
//     vertically-fluted wall, pale-blue glowing base ring, glowing cap disc seen from inside;
//     at end the wall SHATTERS into outward-flying fragments (~0.5 s, clip).
//   Spycam: deploy flash + slow-blinking blue cam light; dart = small fast blue bolt;
//     tagged enemy = pulsing RED player-locked silhouette (server: reveal 1 s every 2 s -
//     call cyxCamTag once per server reveal tick).
//   Neural Theft: cast = white-cyan burst + scan ring over the corpse; each reveal = an
//     AMBER-ORANGE player-locked SILHOUETTE of the living enemy, visible through walls,
//     1.6 s (clip: first reveal ~2.3 s after cast, pulse cadence ~2.5 s).
//
// Contract (integrator owns index.html wiring): entries take world positions ({x,y,z} or
// [x,y,z]) and return {fx, end()}; end() plays a short fade then disposes cloned materials
// recursively; shared geometries/programs persist. cyxUseGameTick() hands timing to the game
// loop (cyxTick(dt) per frame, client-capped dt); otherwise a bounded rAF pump runs while
// effects live. No loaders/textures at module load; everything procedural and lazy.
// Globals used (read-only): THREE, scene; camera/player/xE are optional and guarded.
//
// Player-locked effects: cyxTheftReveal(p, target, secs), cyxCamTag(p, target, secs) and
// cyxWireTrigger(p, target) draw the reveal silhouette ON the target's Object3D (skinned
// rigs share the skeleton), visible through walls; target null draws a humanoid totem at p.
//
// Server vs client: device bodies are server snapshot rows ('dev' rows incl. trapwire/spycam)
//   Trapwire: server DEV.trapwire (deploy 1.5, 0.7 windup, rearm 2, 1.25 s slow) - client
//     XTRAP. The wire spans the row's p<->q anchors; handle.setArmed(false) while rearming.
//   Cyber Cage: DEV.cage (life 7.25, half-height 5) + SMOKE.r.Cypher 3.72 - client CYCAGE.
//   Spycam: DEV.spycam (deploy 1.15, dart reveal 1 every 2 s) - client XSPY.
//   Neural Theft: ULT.theft (reveals at 2 s and 6 s after cast, 1.6 s each); cyxTheftCast at
//     the corpse, then cyxTheftReveal per revealed enemy per pulse.
var cyxU = { value: 0 }, cyxLive = [], cyxPumpOn = false, cyxGT = null, cyxGeo = null;
function cyxNow() { try { return performance.now() / 1000; } catch (e) { return Date.now() / 1000; } }
function cyxErr(e) { try { xE(e); } catch (e2) {} }
function cyxGeos() { if (cyxGeo) return cyxGeo; cyxGeo = {
  sph: new THREE.SphereGeometry(1, 18, 12),
  circle: new THREE.CircleGeometry(1, 48),
  ring: new THREE.RingGeometry(0.86, 1, 64),
  ringThin: new THREE.RingGeometry(0.955, 1, 64),
  cyl: new THREE.CylinderGeometry(1, 1, 1, 48, 1, true),
  plane: new THREE.PlaneGeometry(1, 1),
  beam: new THREE.CylinderGeometry(1, 1, 1, 6, 1, true),
  box: new THREE.BoxGeometry(1, 1, 1) }; return cyxGeo; }
function cyxV3(p) { return Array.isArray(p) ? new THREE.Vector3(p[0], p[1] || 0, p[2]) : new THREE.Vector3(p.x, p.y || 0, p.z); }
function cyxBasic(c, o, add) { return new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: o, depthWrite: false, blending: add ? THREE.AdditiveBlending : THREE.NormalBlending, side: THREE.DoubleSide, fog: false, toneMapped: false }); }
var cyxProg = {};
function cyxShader(k, frag, opts) { if (cyxProg[k]) return cyxProg[k]; const m = new THREE.ShaderMaterial({
  uniforms: { uT: cyxU, uP: { value: 0 }, uSeed: { value: 0 }, uOp: { value: 1 } },
  vertexShader: "uniform float uT;uniform float uSeed;varying vec3 vN;varying vec3 vV;varying vec2 vUv;void main(){vUv=uv;vec4 mv=modelViewMatrix*vec4(position,1.0);vV=-mv.xyz;vN=normalMatrix*normal;gl_Position=projectionMatrix*mv;}",
  fragmentShader: frag, transparent: true, depthWrite: false, side: THREE.DoubleSide,
  depthTest: !(opts && opts.through) });
  m.userData.cyx = k; cyxProg[k] = m; return m; }
function cyxMat(k, frag, seed, opts) { const m = cyxShader(k, frag, opts).clone(); m.uniforms.uT = cyxU; if (seed !== undefined) m.uniforms.uSeed.value = seed; return m; }
const cyxNOISE = "float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}\nfloat noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(hash(i),hash(i+vec2(1.0,0.0)),f.x),mix(hash(i+vec2(0.0,1.0)),hash(i+vec2(1.0,1.0)),f.x),f.y);}\n";
// shimmering cyan tripwire: dashes crawling along the line
const cyxWIRE = "uniform float uT;uniform float uOp;uniform float uSeed;varying vec2 vUv;\nvoid main(){float along=vUv.x;\nfloat dash=step(0.35,fract(along*36.0-uT*2.2+uSeed));\nfloat core=1.0-smoothstep(0.15,0.5,abs(vUv.y-0.5));\nvec3 col=mix(vec3(0.15,0.65,0.95),vec3(0.75,1.0,1.0),dash*0.6);\nfloat a=core*(0.18+0.5*dash)*uOp;gl_FragColor=vec4(col,a);}";
// Cyber Cage frost wall: milky body, faint diagonal tech stripes, pale-blue glow at the base
const cyxCAGE = cyxNOISE + "uniform float uT;uniform float uOp;varying vec3 vN;varying vec3 vV;varying vec2 vUv;\nvoid main(){float f=pow(1.0-abs(dot(normalize(vN),normalize(vV))),1.8);\nfloat stripes=0.5+0.5*sin(vUv.y*160.0);\nfloat n=noise(vUv*vec2(14.0,6.0)+uT*0.12);\nvec3 col=mix(vec3(0.88,0.91,0.95),vec3(0.55,0.68,0.82),n*0.3+stripes*0.55);\ncol+=vec3(0.45,0.8,1.0)*(1.0-smoothstep(0.0,0.22,vUv.y))*0.8;\ncol+=vec3(0.5,0.85,1.0)*f*0.5;\nfloat a=(0.82+0.13*n)*uOp;\nif(a<0.01)discard;gl_FragColor=vec4(col,a);}";
// cage ceiling cap: soft white-cyan glow with ring pattern, seen from inside
const cyxCAP = "uniform float uT;uniform float uOp;varying vec2 vUv;\nvoid main(){vec2 q=vUv*2.0-1.0;float r=length(q);if(r>1.0)discard;\nfloat rings=(1.0-smoothstep(0.0,0.02,abs(r-0.4)-0.01))+(1.0-smoothstep(0.0,0.02,abs(r-0.7)-0.012))+(1.0-smoothstep(0.0,0.03,abs(r-0.93)-0.015));\nfloat glow=(1.0-smoothstep(0.0,1.0,r))*0.5;\nvec3 col=mix(vec3(0.75,0.88,0.98),vec3(0.95,1.0,1.0),glow);\ncol+=vec3(0.4,0.75,1.0)*rings*0.8;\nfloat a=(0.32+glow*0.7+rings*0.5)*uOp;\nif(a<0.01)discard;gl_FragColor=vec4(col,a);}";
// Neural Theft reveal pillar: gold-white shaft, soft edges, gentle rise of inner light
const cyxPILLAR = "uniform float uT;uniform float uOp;uniform float uSeed;varying vec2 vUv;\nvoid main(){float x=abs(vUv.x-0.5)*2.0;float core=1.0-smoothstep(0.0,0.3,x);float glow=exp(-x*3.5)*0.45;\nfloat rise=0.5+0.5*sin(vUv.y*10.0-uT*5.0+uSeed);\nfloat ends=smoothstep(0.0,0.04,vUv.y)*(1.0-smoothstep(0.85,1.0,vUv.y));\nvec3 col=mix(vec3(0.9,0.75,0.3),vec3(1.0,0.98,0.85),core);\nfloat a=(core+glow)*(0.75+0.25*rise)*ends*uOp;gl_FragColor=vec4(col,a);}";
// blue holo scan ring (Neural Theft cast / Spycam deploy)
const cyxSCAN = "uniform float uT;uniform float uOp;varying vec2 vUv;\nvoid main(){vec2 q=vUv*2.0-1.0;float r=length(q);if(r>1.0)discard;float ang=atan(q.y,q.x);\nfloat dash=step(0.45,fract(ang*3.8197+uT*0.9));\nfloat band=smoothstep(0.78,0.9,r)*(1.0-smoothstep(0.96,1.0,r));\nvec3 col=mix(vec3(0.2,0.75,1.0),vec3(0.85,1.0,1.0),dash*0.5);\nfloat a=band*(0.3+0.7*dash)*uOp;gl_FragColor=vec4(col,a);}";
// ---- effect core (contract: handle + end, game-dt driven, cloned materials disposed) ----
function cyxPush(fx) { if (cyxLive.length > 32) { const o = cyxLive.shift(); try { o.done(); } catch (e) {} } cyxLive.push(fx); if (!cyxGT && !cyxPumpOn) { cyxPumpOn = true; cyxPump.last = cyxNow(); requestAnimationFrame(cyxPump); } return fx; }
function cyxPump() { if (cyxGT) { cyxPumpOn = false; return; } const now = cyxNow(), dt = Math.min(0.1, Math.max(0.0005, now - (cyxPump.last || now))); cyxPump.last = now; cyxStep(dt); if (cyxLive.length) requestAnimationFrame(cyxPump); else cyxPumpOn = false; }
function cyxStep(dt) { cyxU.value += dt; for (let i = cyxLive.length - 1; i >= 0; i--) { const fx = cyxLive[i]; fx.age += dt;
  if (fx.dying) { fx.fade -= dt / 0.3; if (fx.fade <= 0) { try { fx.done(); } catch (e) {} cyxLive.splice(i, 1); continue; } }
  const k = Math.min(1, fx.age / fx.ttl); try { fx.tick(dt, fx.age, k, fx); } catch (e) { cyxErr(e); }
  if (!fx.dying && fx.age >= fx.ttl) { try { fx.done(); } catch (e) {} cyxLive.splice(i, 1); } } }
function cyxUseGameTick() { cyxGT = true; cyxPumpOn = false; } // integrator then calls cyxTick(dt) per frame
function cyxTick(dt) { cyxStep(Math.min(0.1, Math.max(0.0005, dt || 0.016))); }
function cyxEnd(h) { const fx = h && h.fx; if (!fx) return; const i = cyxLive.indexOf(fx); if (i < 0) return; if (fx.grace === false) { cyxLive.splice(i, 1); try { fx.done(); } catch (e) {} } else fx.dying = true; }
function cyxReset() { while (cyxLive.length) { const fx = cyxLive.pop(); try { fx.done(); } catch (e) {} } document.querySelectorAll(".cyxV").forEach((d) => d.remove()); }
function cyxFx(ttl, objs, tick, done) { const fx = { age: 0, ttl, fade: 1, dying: false, objs, tick, done: done || function () { objs.forEach((o) => { try { scene.remove(o); o.traverse((m) => { if (m.material && m.material.dispose) m.material.dispose(); if (m.geometry && m.geometry.userData && m.geometry.userData.cyxOwn) m.geometry.dispose(); }); } catch (e) {} }); } }; objs.forEach((o) => scene.add(o)); cyxPush(fx); return { fx, end: function () { cyxEnd(this); } }; }
function cyxBill(m) { try { if (typeof camera !== "undefined" && camera) m.lookAt(camera.position); } catch (e) {} }
// player-locked reveal silhouette: translucent fill + bright backside shell of the target's
// own meshes (skinned rigs share the skeleton), visible through walls; humanoid totem fallback
function cyxOutline(target, p, col) { const grp = new THREE.Group(), added = [];
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
  if (!added.length) { const P = cyxV3(p || { x: 0, y: 0, z: 0 }); grp.position.copy(P);
    const bodyG = new THREE.CylinderGeometry(0.24, 0.3, 1.15, 10); bodyG.userData.cyxOwn = 1;
    const body = new THREE.Mesh(bodyG, fill); body.position.y = 0.95; grp.add(body);
    const bodyS = new THREE.Mesh(bodyG, shell); bodyS.position.copy(body.position); bodyS.scale.setScalar(1.05); grp.add(bodyS);
    const head = new THREE.Mesh(cyxGeos().sph, fill); head.scale.setScalar(0.17); head.position.y = 1.72; grp.add(head);
    const headS = new THREE.Mesh(cyxGeos().sph, shell); headS.scale.setScalar(0.18); headS.position.y = 1.72; grp.add(headS);
    grp.traverse((m) => { m.renderOrder = 998; m.raycast = function () {}; });
    scene.add(grp); added.push(grp); }
  return { set(o) { fill.opacity = 0.26 * o; shell.opacity = 0.8 * o; },
    dispose() { added.forEach((m) => { try { (m.parent || scene).remove(m); } catch (e) {} });
      try { fill.dispose(); shell.dispose(); } catch (e) {}
      grp.traverse((m) => { if (m.geometry && m.geometry.userData && m.geometry.userData.cyxOwn) m.geometry.dispose(); }); } }; }
// ---- full-screen victim veil (DOM, CSS injected once) ----
function cyxCss() { if (document.getElementById("cyxCss")) return; const s = document.createElement("style"); s.id = "cyxCss"; s.textContent =
  ".cyxV{position:fixed;inset:0;pointer-events:none;z-index:6;opacity:0;transition:opacity .15s}" +
  ".cyxVSlow{background:repeating-conic-gradient(from 0deg at 50% 50%,rgba(210,214,220,.34) 0deg 6deg,rgba(120,126,134,.34) 6deg 12deg),radial-gradient(60% 60% at 50% 50%,rgba(90,94,100,.25) 0%,rgba(40,42,48,.6) 100%);-webkit-mask-image:radial-gradient(closest-side,#000 40%,transparent 100%);mask-image:radial-gradient(closest-side,#000 40%,transparent 100%)}";
  (document.head || document.documentElement).appendChild(s); }
function cyxWireSlowVeil(secs) { try { cyxCss(); const d = document.createElement("div"); d.className = "cyxV cyxVSlow"; document.body.appendChild(d); d.style.opacity = "1";
  const life = secs || 1.5;
  return cyxFx(life, [], (dt, age) => { d.style.opacity = String(Math.min(1, Math.max(0, (life - age) / 0.35))); }, () => d.remove()); } catch (e) { cyxErr(e); return null; } }
// ---- shared arc toss (Trapwire device / Cyber Cage orb): blue glowing projectile ----
function cyxToss(o, p, col, secs) { try { const G = cyxGeos(), from = cyxV3(o), to = cyxV3(p), T = secs || 0.5, arc = 0.9 + from.distanceTo(to) * 0.07;
  const grp = new THREE.Group();
  const body = new THREE.Mesh(G.sph, cyxBasic(0x1a3c8f, 0.95, false)); body.scale.setScalar(0.08); grp.add(body);
  const glow = new THREE.Mesh(G.sph, cyxBasic(col || 0x35c0f0, 0.6, true)); glow.scale.setScalar(0.15); grp.add(glow);
  const trail = []; for (let i = 0; i < 4; i++) { const t = new THREE.Mesh(G.sph, cyxBasic(col || 0x35c0f0, 0.3, true)); t.scale.setScalar(0.045); trail.push(t); }
  const objs = [grp].concat(trail);
  return cyxFx(T + 0.2, objs, (dt, age) => { const u = Math.min(1, age / T);
    grp.position.lerpVectors(from, to, u); grp.position.y += Math.sin(u * Math.PI) * arc;
    glow.material.opacity = 0.6 * (0.7 + 0.3 * Math.sin(cyxU.value * 15));
    trail.forEach((t, i) => { const uu = Math.max(0, u - (i + 1) * 0.08); t.position.lerpVectors(from, to, uu); t.position.y += Math.sin(uu * Math.PI) * arc; t.material.opacity = 0.3 * (1 - i / 4) * (uu > 0 ? 1 : 0); }); }); } catch (e) { cyxErr(e); return null; } }
function cyxWireToss(o, p) { return cyxToss(o, p, 0x35c0f0, 0.45); }
function cyxCageToss(o, p) { return cyxToss(o, p, 0x4fd0ff, 0.5); }
// ---- Trapwire ----
function cyxTrapwire(a, b) { try { const A = cyxV3(a), B = cyxV3(b), grp = new THREE.Group();
  const nodes = []; [A, B].forEach((P) => { const n = new THREE.Mesh(cyxGeos().sph, cyxBasic(0x35c0f0, 0.75, true)); n.scale.setScalar(0.055); n.position.copy(P); grp.add(n); nodes.push(n); });
  const mid = A.clone().add(B).multiplyScalar(0.5), len = A.distanceTo(B), dir = B.clone().sub(A).normalize();
  const wire = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), cyxMat("wire", cyxWIRE, Math.random() * 7));
  wire.geometry.userData.cyxOwn = 1;
  wire.scale.set(len, 0.03, 1); wire.position.copy(mid);
  wire.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), dir); grp.add(wire);
  const wire2 = wire.clone(); wire2.material = cyxMat("wire", cyxWIRE, Math.random() * 7); wire2.rotateX(Math.PI / 2); grp.add(wire2); // crossed pair reads from above
  const state = { armed: true };
  const h = cyxFx(1e9, [grp], (dt, age, k, fx) => { const F = fx.fade, base = state.armed ? 1 : 0.25;
    wire.material.uniforms.uOp.value = F * base; wire2.material.uniforms.uOp.value = F * base;
    nodes.forEach((n) => { n.material.opacity = 0.75 * F * (state.armed ? 0.5 + 0.5 * Math.sin(cyxU.value * 4) : 0.3); }); });
  h.setArmed = function (on) { state.armed = !!on; };
  return h; } catch (e) { cyxErr(e); return null; } }
function cyxWireTrigger(p, target) { try { const G = cyxGeos(), P = cyxV3(p), T = target ? 1.3 : 0.5;
  const zap = new THREE.Mesh(G.sph, cyxBasic(0x9fe8ff, 0.9, true)); zap.scale.setScalar(0.16); zap.position.set(P.x, P.y + 0.5, P.z);
  const ring = new THREE.Mesh(G.ring, cyxBasic(0x35c0f0, 0.8, true)); ring.rotation.x = -Math.PI / 2; ring.position.set(P.x, P.y + 0.08, P.z); ring.scale.setScalar(0.3);
  const streaks = []; for (let i = 0; i < 4; i++) { const st = new THREE.Mesh(G.plane, cyxBasic(0x7fdcff, 0.7, true)); st.scale.set(0.05, 0.7, 1);
    st.position.set(P.x, P.y + 0.5, P.z); st.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3); streaks.push(st); }
  const out = target ? cyxOutline(target, P, 0xff8a3c) : null;
  const h = cyxFx(T, [zap, ring].concat(streaks), (dt, age, k, fx) => { const f = (1 - Math.min(1, age / 0.5)) * fx.fade;
    zap.material.opacity = 0.9 * (1 - Math.min(1, age / 0.5) ** 2) * fx.fade; zap.scale.setScalar(0.16 + Math.min(1, age / 0.5) * 0.3);
    ring.scale.setScalar(0.3 + Math.min(1, age / 0.5) * 1.8); ring.material.opacity = 0.8 * f;
    streaks.forEach((st) => { st.material.opacity = 0.7 * f; st.scale.y = 0.7 + Math.min(1, age / 0.5) * 0.8; });
    if (out) out.set(Math.min(1, age / 0.12) * (1 - Math.max(0, (age - (T - 0.3)) / 0.3)) * fx.fade); });
  if (out) { const d0 = h.fx.done; h.fx.done = function () { out.dispose(); d0(); }; }
  return h; } catch (e) { cyxErr(e); return null; } }
// ---- Cyber Cage ----
function cyxCage(p, r, halfH, secs) { try { const G = cyxGeos(), P = cyxV3(p), R = r || 3.72, H = halfH || 5, T = secs || 7.25, grp = new THREE.Group(); grp.position.copy(P);
  const wall = new THREE.Mesh(G.cyl, cyxMat("cage", cyxCAGE, 0)); wall.scale.set(R, 0.01, R); wall.renderOrder = 3; grp.add(wall);
  const cap = new THREE.Mesh(G.circle, cyxMat("cagecap", cyxCAP, 0)); cap.rotation.x = Math.PI / 2; cap.renderOrder = 3; grp.add(cap);
  const base = new THREE.Mesh(G.ringThin, cyxBasic(0x9fe0ff, 0.7, true)); base.rotation.x = -Math.PI / 2; base.position.y = 0.07; base.scale.setScalar(R); grp.add(base);
  const glow = new THREE.Mesh(G.cyl, cyxBasic(0x7fc8ff, 0.16, true)); glow.scale.set(R * 1.001, 0.5, R * 1.001); glow.position.y = 0.25; grp.add(glow);
  let shards = null;
  const spawnShards = () => { if (shards) return; shards = []; for (let i = 0; i < 16; i++) { const sh = new THREE.Mesh(G.plane, cyxBasic(0xdfeaf2, 0.85, false));
      const a = (i / 16) * 6.2832 + Math.random() * 0.3;
      sh.position.set(Math.cos(a) * R, 0.3 + Math.random() * H * 1.6, Math.sin(a) * R); sh.rotation.y = -a + Math.PI / 2; sh.rotation.z = (Math.random() - 0.5) * 0.8;
      sh.scale.set(0.9 + Math.random() * 0.9, 1.0 + Math.random() * 1.2, 1); sh.userData = { vx: Math.cos(a) * (1.5 + Math.random()), vz: Math.sin(a) * (1.5 + Math.random()), vy: 2.5 + Math.random() * 2, rs: (Math.random() - 0.5) * 6 };
      grp.add(sh); shards.push(sh); } };
  return cyxFx(T, [grp], (dt, age, k, fx) => { const grow = Math.min(1, age / 0.4), die = Math.max(0, (age - (T - 0.55)) / 0.55);
    if (die > 0 || fx.dying) spawnShards();
    if (shards) { const wf = Math.max(0, 1 - die * 1.7) * fx.fade;
      wall.visible = wf > 0.02; cap.visible = wf > 0.02; glow.visible = false;
      wall.material.uniforms.uOp.value = wf; cap.material.uniforms.uOp.value = wf;
      shards.forEach((sh) => { const u = sh.userData; sh.position.x += u.vx * dt; sh.position.z += u.vz * dt; sh.position.y += u.vy * dt; u.vy -= 6 * dt; sh.rotation.z += u.rs * dt;
        sh.material.opacity = 0.9 * Math.max(0, 1 - die * 1.2) * fx.fade; });
      base.material.opacity = 0.7 * Math.max(0, 1 - die * 2) * fx.fade; return; }
    wall.scale.set(R, Math.max(0.01, H * 2 * grow), R); wall.position.y = H * grow;
    cap.position.y = H * 2 * grow - 0.02; cap.scale.setScalar(Math.max(0.01, R * grow));
    wall.material.uniforms.uOp.value = fx.fade; cap.material.uniforms.uOp.value = fx.fade * grow;
    base.material.opacity = 0.7 * grow * fx.fade * (0.7 + 0.3 * Math.sin(cyxU.value * 3));
    glow.material.opacity = 0.16 * grow * fx.fade; }); } catch (e) { cyxErr(e); return null; } }
// ---- Spycam ----
function cyxCamPlace(p, yaw) { try { const G = cyxGeos(), P = cyxV3(p), grp = new THREE.Group(); grp.position.copy(P);
  const flash = new THREE.Mesh(G.sph, cyxBasic(0x7fdcff, 0.8, true)); flash.scale.setScalar(0.3); grp.add(flash);
  const ring = new THREE.Mesh(G.circle, cyxMat("scan", cyxSCAN, 0)); ring.rotation.x = -Math.PI / 2; ring.position.y = -0.2; ring.scale.setScalar(0.8); grp.add(ring);
  const light = new THREE.Mesh(G.sph, cyxBasic(0x35c0f0, 0.85, true)); light.scale.setScalar(0.045); light.position.y = 0.05; grp.add(light);
  return cyxFx(1e9, [grp], (dt, age, k, fx) => { const F = fx.fade;
    flash.material.opacity = Math.max(0, 0.8 * (1 - age / 0.35)) * F; flash.scale.setScalar(0.3 + age * 0.5);
    ring.material.uniforms.uOp.value = Math.max(0, 1 - age / 1.15) * F; ring.scale.setScalar(0.8 + age * 1.4);
    const blink = (cyxU.value % 2) < 0.18 ? 1 : 0.12; // slow blink while the cam is live
    light.material.opacity = 0.85 * blink * F; }); } catch (e) { cyxErr(e); return null; } }
function cyxCamDart(o, d, len) { try { const G = cyxGeos(), O = cyxV3(o), D = cyxV3(d).normalize(), L = len || 20, T = 0.28;
  const grp = new THREE.Group();
  const bolt = new THREE.Mesh(G.sph, cyxBasic(0x66d4ff, 0.9, true)); bolt.scale.set(0.08, 0.08, 0.2); grp.add(bolt);
  const glow = new THREE.Mesh(G.sph, cyxBasic(0x35c0f0, 0.45, true)); glow.scale.setScalar(0.22); grp.add(glow);
  const hit = new THREE.Mesh(G.sph, cyxBasic(0x9fe8ff, 0, true)); hit.scale.setScalar(0.1); hit.position.copy(O).addScaledVector(D, L);
  return cyxFx(T + 0.25, [grp, hit], (dt, age, k, fx) => { const u = Math.min(1, age / T);
    grp.position.copy(O).addScaledVector(D, L * u);
    bolt.material.opacity = 0.9 * (1 - Math.max(0, (age - T) / 0.2)) * fx.fade;
    glow.material.opacity = 0.45 * (1 - Math.max(0, (age - T) / 0.2)) * fx.fade;
    const ha = Math.max(0, age - T); hit.material.opacity = Math.max(0, 0.85 * (1 - ha / 0.2)) * fx.fade; hit.scale.setScalar(0.1 + ha * 0.6); }); } catch (e) { cyxErr(e); return null; } }
function cyxCamTag(p, target, secs) { try { const P = cyxV3(p), T = secs || 1, out = cyxOutline(target, P, 0xff3b30);
  const G = cyxGeos(), ping = new THREE.Mesh(G.ringThin, cyxBasic(0xff6a50, 0.8, true)); ping.material.depthTest = false; ping.position.set(P.x, P.y + 2.0, P.z); ping.scale.setScalar(0.3); ping.renderOrder = 9;
  const h = cyxFx(T, [ping], (dt, age, k, fx) => { const env = Math.min(1, age / 0.12) * (1 - Math.max(0, (age - (T - 0.25)) / 0.25)) * fx.fade;
    out.set(env * (0.7 + 0.3 * Math.sin(cyxU.value * 18))); ping.material.opacity = 0.8 * env; ping.scale.setScalar(0.3 + k * 0.25); cyxBill(ping); });
  const d0 = h.fx.done; h.fx.done = function () { out.dispose(); d0(); };
  return h; } catch (e) { cyxErr(e); return null; } }
// ---- Neural Theft ----
function cyxTheftCast(p) { try { const G = cyxGeos(), P = cyxV3(p), grp = new THREE.Group(); grp.position.copy(P);
  const flash = new THREE.Mesh(G.sph, cyxBasic(0xdff6ff, 0.9, true)); flash.scale.setScalar(0.35); flash.position.y = 0.4; grp.add(flash);
  const col = new THREE.Mesh(G.beam, cyxBasic(0xbfe9ff, 0.6, true)); col.scale.set(0.12, 3, 0.12); col.position.y = 1.5; grp.add(col);
  const ring = new THREE.Mesh(G.circle, cyxMat("scan", cyxSCAN, 1.7)); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.08; ring.scale.setScalar(0.6); grp.add(ring);
  return cyxFx(1.2, [grp], (dt, age, k, fx) => { const f = (1 - k * k) * fx.fade;
    flash.material.opacity = 0.9 * Math.max(0, 1 - age / 0.4) * fx.fade;
    col.material.opacity = 0.6 * f; col.scale.y = 3 + k * 2; col.position.y = col.scale.y / 2;
    ring.material.uniforms.uOp.value = f; ring.scale.setScalar(0.6 + k * 3.2); }); } catch (e) { cyxErr(e); return null; } }
function cyxTheftReveal(p, target, secs) { try { const P = cyxV3(p), T = secs || 1.6, out = cyxOutline(target, P, 0xffa03c);
  const G = cyxGeos(), mark = new THREE.Mesh(G.ringThin, cyxBasic(0xffb060, 0.85, true)); mark.material.depthTest = false; mark.position.set(P.x, P.y + 2.05, P.z); mark.scale.setScalar(0.35); mark.renderOrder = 9;
  const h = cyxFx(T, [mark], (dt, age, k, fx) => { const env = Math.min(1, age / 0.2) * (1 - Math.max(0, (age - (T - 0.4)) / 0.4)) * fx.fade;
    out.set(env * (0.75 + 0.25 * Math.sin(cyxU.value * 10))); mark.material.opacity = 0.85 * env; cyxBill(mark); });
  const d0 = h.fx.done; h.fx.done = function () { out.dispose(); d0(); };
  return h; } catch (e) { cyxErr(e); return null; } }
// ---- END CYPHER FX ----
