// ---- ASTRA FX ----
// Astra ability visuals (work/astra_fx_runtime.js), reference-grounded in the wiki showcase clips
// viewed 2026-11-04 (wiki.playvalorant.com/en-us/Gravity_Well, /Nova_Pulse, /Nebula_/_Dissipate,
// /Cosmic_Divide; images/Gravity_Well_Showcase.mp4, Nova_Pulse_Showcase.mp4, Nebula_-_Dissipate_Showcase.mp4,
// Cosmic_Divide_Showcase.mp4 frame sheets). Procedural approximation, no extracted game assets.
// Reference look: deep violet cosmic energy, gold 4-point star sparkles, starfield textures.
//   Gravity Well: purple spiral vortex on the ground, bright gold star core, arcs pulling inward.
//   Nova Pulse: ground swirl charge (1.25 s), then a tall violet-pink eruption column with a star flare.
//   Nebula: hollow purple sphere with a starfield/nebula texture and a warm orange core at its base.
//   Cosmic Divide: map-long purple curtain filled with stars and constellation lines, light pillars at the ends.
// Mechanics (pull, concuss, damage, timing, sound) stay in the caller; this file is pure client fx.
// Globals used (read-only): THREE, scene, player, camera, xE, and (only in the *Smoke wrappers) a18Smoke.
// All animation runs on game dt: call asxUseGameTick() once, then asxTick(dt) from the game loop
// (the same place omxTick is called in jFxTick). Without it a rAF pump runs while effects exist.
// Returns handles accepted by asxEnd; asxReset() ends everything (round reset / disconnect).
//
// Integration wiring (integrator owns index.html):
//   1. Place Star (offline a18TacLocal k "s" and a18Key case "Astra" bot branch): after the OctahedronGeometry
//      star mesh is created, hide it (m.visible = false) and store h = asxStar(m.position); keep h on the
//      starList entry ({x,y,z,fx,fxh:h}) and asxEnd(star.fxh) inside a18StarDrop.
//   2. Gravity Well: replace `a18Fx({ kind: "gwell", ..., m: a18Ring(q, ...) })` ring with
//      asxGravityWell(q, A18C.star.wellR, { delay: 0.75, life: A18C.star.wellPull }) (keep the fx row for mechanics, m: null).
//   3. Nova Pulse: same site, asxNovaPulse(q, A18C.star.novaR, { delay: A18C.star.novaDelay }).
//   4. Nebula: replace `a18Smoke(q, C.star.nebulaLife, C.star.nebulaR, 0x7a4fd0, 0xc9a8f2)` with
//      asxNebulaSmoke(q, C.star.nebulaLife, C.star.nebulaR); Dissipate: asxNebulaSmoke(p, C.star.fakeNebula, C.star.nebulaR, { fake: true }).
//   5. Cosmic Divide: replace the "div" a18Ring with asxCosmicDivide(centerVec3, yaw, half, C.star.divideLife)
//      (offline a18TacLocal k "x": yaw = Math.atan2(-(x2-x1), -(z2-z1)) like the server; a18Key case "Astra" x:
//      yaw = player look, half = 30). Wall spans local X, rotation.y = -yaw (the A18VIS "wall" convention).
//   6. Online (a18NetSync): kinds star/gwell/nova/divide come as fx rows {id,o,p,r,tl,yaw}; swap their A18VIS
//      primitives for asxStar / asxGravityWell / asxNovaPulse / asxCosmicDivide and end handles when rows stop.
//      Nebula arrives as a plain kind "smoke" row (no ag): resolve the owner's agent from e.o via the roster
//      before styling, or it stays the generic smoke. NOTE: server A18_NET_KINDS does not include "divide",
//      so Cosmic Divide never reaches online clients today (server change, integrator's lane).
var asxU = { value: 0 }, asxLive = [], asxPumpOn = false, asxGT = null, asxGeo = null, asxProg = {}, asxTex = {};
function asxNow() { try { return performance.now() / 1000; } catch (e) { return Date.now() / 1000; } }
function asxGeos() { if (asxGeo) return asxGeo; asxGeo = {
  sph: new THREE.SphereGeometry(1, 28, 20),
  ring: new THREE.RingGeometry(0.72, 1, 56),
  circle: new THREE.CircleGeometry(1, 48),
  plane: new THREE.PlaneGeometry(1, 1),
  cyl: new THREE.CylinderGeometry(1, 1, 1, 28, 6, true),
  torus: new THREE.TorusGeometry(1, 0.045, 8, 48),
  octa: new THREE.OctahedronGeometry(1) }; return asxGeo; }
function asxStarTex() { if (asxTex.star) return asxTex.star; // 4-point star sparkle, white on transparent (tint via material color)
  const c = document.createElement("canvas"); c.width = c.height = 128; const g = c.getContext("2d"); g.clearRect(0, 0, 128, 128);
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 26); gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = gr; g.beginPath(); g.arc(64, 64, 26, 0, 6.2832); g.fill();
  g.fillStyle = "rgba(255,255,255,0.95)"; g.beginPath(); g.moveTo(64, 2); g.quadraticCurveTo(68, 60, 126, 64); g.quadraticCurveTo(68, 68, 64, 126); g.quadraticCurveTo(60, 68, 2, 64); g.quadraticCurveTo(60, 60, 64, 2); g.fill();
  asxTex.star = new THREE.CanvasTexture(c); if (THREE.SRGBColorSpace) asxTex.star.colorSpace = THREE.SRGBColorSpace; return asxTex.star; }
function asxShader(k, frag) { if (asxProg[k]) return asxProg[k]; const m = new THREE.ShaderMaterial({
  uniforms: { uT: { value: 0 }, uP: { value: 0 }, uSeed: { value: 0 }, uA: { value: 1 } },
  vertexShader: "uniform float uT;uniform float uP;uniform float uSeed;varying vec3 vN;varying vec3 vV;varying vec3 vP;varying vec2 vUv;void main(){vUv=uv;vec3 p=position;vP=p;vec4 mv=modelViewMatrix*vec4(p,1.0);vV=-mv.xyz;vN=normalMatrix*normal;gl_Position=projectionMatrix*mv;}",
  fragmentShader: frag, transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false });
  m.userData.asx = k; asxProg[k] = m; return m; }
// Nebula sphere: deep violet nebula clouds, white star speckles, bright violet fresnel rim
const asxNEBULA = "uniform float uT;uniform float uP;uniform float uSeed;varying vec3 vN;varying vec3 vV;varying vec3 vP;varying vec2 vUv;\n" + "float ah(vec3 p){p=fract(p*.3183099+vec3(.11,.23,.37));p*=17.0;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}\nfloat an(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(mix(ah(i),ah(i+vec3(1,0,0)),f.x),mix(ah(i+vec3(0,1,0)),ah(i+vec3(1,1,0)),f.x),f.y),mix(mix(ah(i+vec3(0,0,1)),ah(i+vec3(1,0,1)),f.x),mix(ah(i+vec3(0,1,1)),ah(i+vec3(1,1,1)),f.x),f.y),f.z);}\nvoid main(){float facing=abs(dot(normalize(vN),normalize(vV)));float rim=pow(1.0-facing,2.0);vec3 q=vP*2.6+vec3(uT*.05,-uT*.03,uT*.04)+uSeed;float n=an(q)*.62+an(q*2.3)*.38;vec3 c=mix(vec3(.16,.07,.34),vec3(.38,.20,.68),smoothstep(.25,.85,n));c+=vec3(.45,.20,.75)*smoothstep(.68,.95,n)*.6;vec3 cg=floor(vP*26.0+uSeed);float sp=step(.993,ah(cg));float tw=.6+.4*sin(uT*3.0+ah(cg)*40.0);c+=vec3(1.0,1.0,1.0)*sp*tw*(.45+.75*rim)*1.25*smoothstep(.42,.1,length(fract(vP*26.0+uSeed)-.5));c=mix(c,vec3(.62,.44,1.0),rim*.75);float bg=smoothstep(-0.15,-0.95,vP.y);c=mix(c,vec3(.88,.48,.24),bg*.45*(1.0-rim));gl_FragColor=vec4(c,(0.97)*(1.0-uP));}";
// Gravity Well vortex disc (polar): violet spiral arms winding inward, dark core, edge fade
const asxVORTEX = "uniform float uT;uniform float uP;uniform float uSeed;varying vec2 vUv;\nvoid main(){vec2 q=vUv*2.0-1.0;float r=length(q);if(r>1.0)discard;float a=atan(q.y,q.x);float arms=sin(a*3.0-r*9.0+uT*5.5+uSeed)*.5+.5;float arms2=sin(a*5.0+r*7.0-uT*4.0)*.5+.5;float body=smoothstep(1.0,.82,r);float core=smoothstep(.30,.02,r);vec3 c=mix(vec3(.20,.08,.42),vec3(.55,.30,.95),arms*body);c+=vec3(.72,.50,1.0)*arms2*body*.35;c=mix(c,vec3(.05,.02,.12),core*.85);c+=vec3(1.0,.82,.35)*smoothstep(.10,.02,r)*(0.7+0.3*sin(uT*9.0));float al=(body*(.30+.55*arms)+core*.4)*uP;gl_FragColor=vec4(c,al);}";
// Nova Pulse eruption column (uv.y up): violet->pink flame rising, hot base, ragged top fade
const asxFLAME = "uniform float uT;uniform float uP;uniform float uSeed;varying vec3 vN;varying vec3 vV;varying vec2 vUv;\nvoid main(){float y=vUv.y;float f=pow(1.0-abs(dot(normalize(vN),normalize(vV))),1.1);float n=sin(vUv.x*19.0+uT*7.0+uSeed)*sin(y*9.0-uT*11.0)*.5+.5;float n2=sin(vUv.x*31.0-uT*5.0)*sin(y*17.0-uT*8.0)*.5+.5;vec3 c=mix(vec3(.42,.12,.80),vec3(.95,.45,.95),y);c=mix(c,vec3(1.0,.92,.98),pow(1.0-y,2.6)*(.5+.5*n));c+=vec3(.9,.5,1.0)*f*.6;float a=smoothstep(0.0,.10,y)*(1.0-smoothstep(.55,1.0,y- .15*n2*.3))*(.55+.45*n)*(.75+.35*f)*(1.0-uP);gl_FragColor=vec4(c,a);}";
// Cosmic Divide curtain (uv): deep purple starfield, constellation web, bright top edge
const asxDIVIDE = "uniform float uT;uniform float uP;uniform float uSeed;varying vec2 vUv;\nfloat ah2(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}\nvoid main(){vec2 q=vUv*vec2(14.0,3.0)+vec2(uT*.03,uT*.015)+uSeed;float n=sin(q.x*1.7)*sin(q.y*2.3)*sin(q.x*.7+uT*.2)*.5+.5;vec3 c=mix(vec3(.24,.06,.42),vec3(.48,.16,.70),n);c+=vec3(.65,.30,.80)*pow(n,3.0)*.8;vec2 g=vUv*vec2(46.0,10.0);vec2 gi=floor(g);float sp=step(.992,ah2(gi));float tw=.5+.5*sin(uT*2.5+ah2(gi+7.0)*40.0);c+=vec3(1.0,.98,1.0)*sp*tw*smoothstep(.38,.06,length(fract(g)-.5));vec2 gf=fract(g)-.5;float ln=smoothstep(.05,.0,abs(gf.x+gf.y*.6))*step(.93,ah2(gi+3.0));c+=vec3(.85,.7,1.0)*ln*.35;float top=smoothstep(.86,1.0,vUv.y);c+=vec3(.75,.45,1.0)*top*1.2;float base=smoothstep(.06,.0,vUv.y);c+=vec3(.65,.35,1.0)*base*.9;gl_FragColor=vec4(c,(.88)*(1.0-uP));}";
// soft violet mist tendril (uv plane)
const asxWISP = "uniform float uT;uniform float uP;uniform float uSeed;varying vec2 vUv;\nvoid main(){float w=sin(vUv.y*8.0+uT*3.0+uSeed*7.0)*sin(vUv.x*5.0-uT*2.0)*.5+.5;float curve=.5+.12*sin(vUv.y*6.0+uT*2.2+uSeed);float edge=1.0-smoothstep(.05,.30,abs(vUv.x-curve));float a=edge*smoothstep(0.0,.15,vUv.y)*(1.0-smoothstep(.5,1.0,vUv.y))*(.5+.5*w)*(1.0-uP);vec3 c=mix(vec3(.45,.20,.85),vec3(.85,.45,1.0),vUv.y);gl_FragColor=vec4(c,a*.8);}";
function asxMat(k, shader, seed) { const m = asxShader(k, shader).clone(); delete m.userData.asx; m.uniforms.uT = asxU; if (seed !== undefined) m.uniforms.uSeed.value = seed; return m; } // clone is disposable; cached program keeps userData.asx
function asxBasic(c, o, add) { return new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: o, depthWrite: false, blending: add ? THREE.AdditiveBlending : THREE.NormalBlending, side: THREE.DoubleSide, fog: false, toneMapped: false }); }
function asxPush(fx) { if (asxLive.length > 24) { const o = asxLive.shift(); try { o.done(); } catch (e) {} } asxLive.push(fx); if (!asxGT && !asxPumpOn) { asxPumpOn = true; asxPump.last = asxNow(); requestAnimationFrame(asxPump); } return fx; }
function asxPump() { if (asxGT) { asxPumpOn = false; return; } const now = asxNow(), dt = Math.min(0.1, Math.max(0.0005, now - (asxPump.last || now))); asxPump.last = now; asxU.value += dt;
  for (let i = asxLive.length - 1; i >= 0; i--) { const fx = asxLive[i]; fx.age += dt; try { fx.tick(dt, fx.age, Math.min(1, fx.age / fx.ttl)); } catch (e) { try { xE(e); } catch (e2) {} }
    if (fx.age >= fx.ttl) { try { fx.done(); } catch (e) {} asxLive.splice(i, 1); } }
  if (asxLive.length) requestAnimationFrame(asxPump); else asxPumpOn = false; }
function asxUseGameTick() { asxGT = true; asxPumpOn = false; } // integrator then calls asxTick(dt) per frame
function asxTick(dt) { asxU.value += dt; for (let i = asxLive.length - 1; i >= 0; i--) { const fx = asxLive[i]; fx.age += dt; try { fx.tick(dt, fx.age, Math.min(1, fx.age / fx.ttl)); } catch (e) { try { xE(e); } catch (e2) {} } if (fx.age >= fx.ttl) { try { fx.done(); } catch (e) {} asxLive.splice(i, 1); } } }
function asxEnd(h) { if (!h || !h.fx) return; const i = asxLive.indexOf(h.fx); if (i >= 0) asxLive.splice(i, 1); try { h.fx.done(); } catch (e) {} }
function asxFx(ttl, objs, tick, done) { const fx = { age: 0, ttl, objs, tick, done: done || function () { objs.forEach((o) => { try { scene.remove(o); o.traverse((m) => { if (m.material && m.material.dispose && !m.material.userData.asx) m.material.dispose(); if (m.userData.og && m.geometry && m.geometry.dispose) m.geometry.dispose(); }); } catch (e) {} }); } }; objs.forEach((o) => { o.traverse ? o.traverse((m) => { m.raycast = () => {}; }) : 0; scene.add(o); }); asxPush(fx); return { fx, end: function () { asxEnd(this); } }; }
function asxReset() { while (asxLive.length) asxEnd({ fx: asxLive[0] }); }
function asxSprite(tex, col, op, scale) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: col, transparent: true, opacity: op, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, toneMapped: false })); s.scale.setScalar(scale); return s; }
// ---- placed Star: floating violet octa-core, gold ring, orbiting sparkles (persistent until ended) ----
function asxStar(p) { try { const G = asxGeos(), grp = new THREE.Group(); grp.position.set(p.x, p.y, p.z);
  const core = new THREE.Mesh(G.octa, asxBasic(0xe4d8ff, 1, true)); core.scale.setScalar(0.26);
  const glow = new THREE.Mesh(G.sph, asxBasic(0x8a5ff0, 0.10, true)); glow.scale.setScalar(0.42);
  const band = new THREE.Mesh(G.torus, asxBasic(0xffd24a, 0.55, true)); band.scale.setScalar(0.55); band.rotation.x = Math.PI / 2.4;
  const ring = new THREE.Mesh(G.ring, asxBasic(0x8a6af0, 0.4, true)); ring.rotation.x = -Math.PI / 2; ring.position.y = -1.3; ring.scale.setScalar(0.9);
  const sparks = []; for (let i = 0; i < 3; i++) { const s = asxSprite(asxStarTex(), 0xffe9a8, 0.85, 0.5); s.userData.a = i * 2.1; sparks.push(s); grp.add(s); }
  grp.add(core, glow, band, ring);
  return asxFx(400, [grp], (dt, age) => { const t = asxU.value;
    core.rotation.y += dt * 1.6; core.rotation.x += dt * 0.5; core.position.y = Math.sin(t * 1.8) * 0.08;
    band.rotation.z += dt * 2.2; glow.material.opacity = 0.13 + 0.05 * Math.sin(t * 3.1);
    ring.material.opacity = 0.30 + 0.12 * Math.sin(t * 2.2);
    sparks.forEach((s) => { const a = s.userData.a + t * 1.1; s.position.set(Math.cos(a) * 0.55, 0.15 + Math.sin(t * 2.6 + s.userData.a) * 0.22, Math.sin(a) * 0.55); s.material.opacity = 0.55 + 0.4 * Math.sin(t * 5 + s.userData.a * 3); }); }); } catch (e) { try { window.asxErr = String(e && e.stack || e).slice(0, 300); xE(e); } catch (e2) {} return null; } }
// ---- Gravity Well: spiral vortex + gold star core + inflow wisps; pop at the end ----
function asxGravityWell(p, r, opts) { try { const R = r || 3.5, o = opts || {}, delay = o.delay != null ? o.delay : 0.75, life = o.life != null ? o.life : 2, G = asxGeos(), grp = new THREE.Group(); grp.position.set(p.x, (p.y || 0) + 0.06, p.z);
  const disc = new THREE.Mesh(G.circle, asxMat("vortex", asxVORTEX, Math.random() * 9)); disc.rotation.x = -Math.PI / 2; disc.scale.setScalar(R); grp.add(disc);
  const core = asxSprite(asxStarTex(), 0xffd24a, 0.95, 1.3); core.position.y = 0.5; grp.add(core);
  const wisps = []; for (let i = 0; i < 5; i++) { const w = new THREE.Mesh(G.plane, asxMat("wisp", asxWISP, i * 1.7)); w.scale.set(R * 0.30, 2.4, 1); w.userData.a = i * 1.256; wisps.push(w); grp.add(w); }
  const pop = new THREE.Mesh(G.torus, asxBasic(0xb08af0, 0, true)); pop.rotation.x = Math.PI / 2; pop.position.y = 0.15; grp.add(pop);
  return asxFx(delay + life + 0.45, [grp], (dt, age) => { const act = age < delay ? age / delay * 0.4 : age < delay + life ? 0.4 + 0.6 * Math.min(1, (age - delay) / 0.25) : 1;
    const dying = age > delay + life ? Math.max(0, 1 - (age - delay - life) / 0.4) : 1;
    disc.material.uniforms.uP.value = act * dying; disc.rotation.z -= dt * 2.4;
    core.material.opacity = 0.95 * act * dying; core.scale.setScalar(1.3 * (0.7 + 0.5 * act) * (1 + 0.12 * Math.sin(asxU.value * 9)));
    wisps.forEach((w) => { const a = w.userData.a - asxU.value * 3.2, rr = R * (0.95 - 0.45 * ((asxU.value * 1.1 + w.userData.a) % 1)); w.position.set(Math.cos(a) * rr, 1.2, Math.sin(a) * rr); w.rotation.y = -a + Math.PI / 2; w.material.uniforms.uP.value = (1 - act) + (1 - dying); });
    if (age >= delay + life) { const k = Math.min(1, (age - delay - life) / 0.4); pop.scale.setScalar(0.4 + k * R * 1.15); pop.material.opacity = 0.8 * (1 - k); } }); } catch (e) { try { window.asxErr = String(e && e.stack || e).slice(0, 300); xE(e); } catch (e2) {} return null; } }
// ---- Nova Pulse: ground swirl charge, then a tall violet-pink eruption with a star flare ----
function asxNovaPulse(p, r, opts) { try { const R = r || 4.5, o = opts || {}, delay = o.delay != null ? o.delay : 1.25, G = asxGeos(), grp = new THREE.Group(); grp.position.set(p.x, (p.y || 0) + 0.06, p.z);
  const disc = new THREE.Mesh(G.circle, asxMat("vortex", asxVORTEX, 4 + Math.random() * 9)); disc.rotation.x = -Math.PI / 2; disc.scale.setScalar(R * 0.8); grp.add(disc);
  const col = new THREE.Mesh(G.cyl, asxMat("flame", asxFLAME, Math.random() * 9)); col.scale.set(R * 0.45, 0.01, R * 0.45); col.position.y = 0; col.visible = false; grp.add(col);
  const flare = asxSprite(asxStarTex(), 0xf2b8ff, 0, 3.2); flare.position.y = 4.6; grp.add(flare);
  const shock = new THREE.Mesh(G.torus, asxBasic(0xd08af0, 0, true)); shock.rotation.x = Math.PI / 2; shock.position.y = 0.12; grp.add(shock);
  const scorch = new THREE.Mesh(G.circle, asxBasic(0x3a1470, 0, false)); scorch.rotation.x = -Math.PI / 2; scorch.position.y = 0.01; scorch.scale.setScalar(R * 0.55); grp.add(scorch);
  const H = 7;
  return asxFx(delay + 1.6, [grp], (dt, age) => {
    if (age < delay) { const k = age / delay; disc.material.uniforms.uP.value = 0.25 + 0.6 * k; disc.rotation.z -= dt * (2 + 6 * k); disc.scale.setScalar(R * (1.05 - 0.35 * k)); return; }
    const k = Math.min(1, (age - delay) / 1.2);
    disc.material.uniforms.uP.value = Math.max(0, 1 - k * 2.2);
    col.visible = k < 0.92; const grow = Math.min(1, (age - delay) / 0.14), fade = 1 - Math.max(0, (k - 0.55) / 0.4);
    col.scale.set(R * 0.45 * (1 - k * 0.35), Math.max(0.01, H * grow), R * 0.45 * (1 - k * 0.35)); col.position.y = H * grow / 2;
    col.material.uniforms.uP.value = 1 - fade;
    flare.material.opacity = Math.max(0, 0.95 - k * 1.6); flare.scale.setScalar(3.2 + k * 3.2);
    shock.scale.setScalar(0.5 + k * R * 1.3); shock.material.opacity = 0.85 * (1 - k);
    scorch.material.opacity = 0.55 * Math.max(0, 1 - k); }); } catch (e) { try { window.asxErr = String(e && e.stack || e).slice(0, 300); xE(e); } catch (e2) {} return null; } }
// ---- Nebula sphere (visual only; asxNebulaSmoke keeps the J.smokes record) ----
function asxNebula(p, r, life, opts) { try { const R = r || 4.1, o = opts || {}, G = asxGeos(), grp = new THREE.Group(); grp.position.set(p.x, (p.y || 0) + 1.7, p.z);
  const dome = new THREE.Mesh(G.sph, asxMat("nebula", asxNEBULA, Math.random() * 9)); dome.scale.setScalar(R * 0.25); grp.add(dome);
  const core = new THREE.Mesh(G.sph, asxBasic(0xff9a3a, 0.30, true)); core.scale.setScalar(R * 0.30); core.position.y = -1.0; grp.add(core);
  const star = asxSprite(asxStarTex(), 0xffc98a, 0.7, 1.4); star.position.y = -1.0; grp.add(star);
  const ttl = Math.max(0.4, life || 14) + 0.7;
  return asxFx(ttl, [grp], (dt, age) => { const grow = o.fake ? 1 : Math.min(1, age / 0.5), die = Math.max(0, (age - (ttl - 0.7)) / 0.7), s = R * (0.25 + 0.75 * grow) * (1 - die * die);
    dome.scale.setScalar(Math.max(0.01, s)); dome.rotation.y += dt * 0.06; dome.material.uniforms.uP.value = die;
    core.material.opacity = 0.30 * (1 - die) * (0.8 + 0.2 * Math.sin(asxU.value * 2.4)); core.scale.setScalar(Math.max(0.01, s * 0.30));
    star.material.opacity = 0.7 * (1 - die); star.scale.setScalar(1.4 * (1 + die * 1.5)); }); } catch (e) { try { window.asxErr = String(e && e.stack || e).slice(0, 300); xE(e); } catch (e2) {} return null; } }
// Keeps gameplay (vision blocking, SFX, online smoke-row matching) and swaps the look: engine smoke hidden, cosmic sphere drawn.
function asxNebulaSmoke(p, dur, r, opts) { let m = null; try { m = a18Smoke(p, dur, r, 0x7a4fd0, 0xc9a8f2); m.visible = false; } catch (e) { try { xE(e); } catch (e2) {} }
  return asxNebula({ x: p.x, y: p.y || 0, z: p.z }, r, dur, opts); }
// ---- Cosmic Divide: map-long purple starfield curtain; end pillars; rotation.y = -yaw, span local X ----
function asxCosmicDivide(p, yaw, halfLen, life) { try { const H2 = Math.max(4, halfLen || 30), ttl = Math.max(1, life || 21), G = asxGeos(), grp = new THREE.Group(); grp.position.set(p.x, 0, p.z); grp.rotation.y = -(yaw || 0);
  const wall = new THREE.Mesh(G.plane, asxMat("divide", asxDIVIDE, Math.random() * 9)); wall.scale.set(H2 * 2, 6.5, 1); wall.position.y = 3.25; wall.userData.og = false; grp.add(wall);
  const wall2 = new THREE.Mesh(G.plane, wall.material); wall2.scale.copy(wall.scale); wall2.position.y = 3.25; wall2.rotation.y = Math.PI; grp.add(wall2);
  const pillars = []; for (const sx of [-1, 1]) { [[1.5, 2.6], [3.6, 1.9], [6, 1.3]].forEach(([yy, ss]) => { const pl = asxSprite(asxStarTex(), 0x9a6ff0, 0.55, ss); pl.position.set(sx * H2, yy, 0); pillars.push(pl); grp.add(pl); }); }
  const seam = new THREE.Mesh(G.plane, asxBasic(0x9a6ff0, 0.5, true)); seam.scale.set(H2 * 2, 0.3, 1); seam.rotation.x = -Math.PI / 2; seam.position.y = 0.06; grp.add(seam);
  return asxFx(ttl, [grp], (dt, age) => { const grow = Math.min(1, age / 0.5), die = Math.max(0, (age - (ttl - 1)) / 1);
    wall.scale.y = 6.5 * (0.05 + 0.95 * grow); wall.position.y = wall.scale.y / 2; wall2.scale.y = wall.scale.y; wall2.position.y = wall.position.y;
    wall.material.uniforms.uP.value = die;
    pillars.forEach((pl) => { pl.material.opacity = 0.55 * grow * (1 - die); });
    seam.material.opacity = 0.5 * grow * (1 - die); }); } catch (e) { try { window.asxErr = String(e && e.stack || e).slice(0, 300); xE(e); } catch (e2) {} return null; } }
// ---- END ASTRA FX ----
