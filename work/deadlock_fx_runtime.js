// ---- DEADLOCK FX ----
// Deadlock ability visuals (work/deadlock_fx_runtime.js), reference-grounded in the wiki showcase clips
// (wiki.playvalorant.com/en-us/images/Barrier_Mesh_Showcase.mp4, Sonic_Sensor_Showcase.mp4,
// GravNet_Showcase.mp4, Annihilation_Showcase.mp4; frame sheets reviewed 2026-11-04).
// Procedural approximation, not extracted game assets. Main entries keep game mechanics.
// All positions are world-space. Every entry returns a handle accepted by dlxEnd (or use h.end()).
// dlxUseGameTick() then dlxTick(dt) hands timing to the game loop (game-dt driven, never wall clock);
// otherwise a single rAF pump runs while effects exist.
// Shared geometry/programs persist; cloned per-effect materials are disposed recursively.
var dlxU = { value: 0 }, dlxLive = [], dlxPumpOn = false, dlxGT = null, dlxGeo = null, dlxProg = {};
function dlxNow() { try { return performance.now() / 1000; } catch (e) { return Date.now() / 1000; } }
function dlxGeos() { if (dlxGeo) return dlxGeo; dlxGeo = {
  sph: new THREE.SphereGeometry(1, 24, 16),
  ring: new THREE.RingGeometry(0.82, 1, 48),
  cyl: new THREE.CylinderGeometry(1, 1, 1, 10, 1, true),
  cone: new THREE.ConeGeometry(0.5, 1, 10, 4),
  plane: new THREE.PlaneGeometry(1, 1, 1, 4),
  box: new THREE.BoxGeometry(1, 1, 1) }; return dlxGeo; }
// shared shaders. uT = module clock, uP = effect progress 0..1, uSeed = per-mesh variation.
function dlxShader(k, frag, opts) { if (dlxProg[k]) return dlxProg[k]; const m = new THREE.ShaderMaterial(Object.assign({
  uniforms: { uT: dlxU, uP: { value: 0 }, uSeed: { value: 0 }, uA: { value: 1 } },
  vertexShader: "uniform float uT;uniform float uP;uniform float uSeed;varying vec3 vN;varying vec3 vV;varying vec3 vP;varying vec2 vUv;void main(){vUv=uv;vec3 p=position;vP=p;vec4 mv=modelViewMatrix*vec4(p,1.0);vV=-mv.xyz;vN=normalMatrix*normal;gl_Position=projectionMatrix*mv;}",
  fragmentShader: frag, transparent: true, depthWrite: false, side: THREE.DoubleSide }, opts || {}));
  m.userData.dlx = k; dlxProg[k] = m; return m; }
function dlxMat(k, shader, seed, opts) { const m = dlxShader(k, shader, opts).clone(); m.uniforms.uT = dlxU; if (seed !== undefined) m.uniforms.uSeed.value = seed; return m; }
function dlxBasic(c, o, add) { return new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: o, depthWrite: false, blending: add ? THREE.AdditiveBlending : THREE.NormalBlending, side: THREE.DoubleSide }); }
function dlxPush(fx) { if (dlxLive.length > 24) { const o = dlxLive.shift(); try { o.done(); } catch (e) {} } dlxLive.push(fx); if (!dlxGT && !dlxPumpOn) { dlxPumpOn = true; dlxPump.last = dlxNow(); requestAnimationFrame(dlxPump); } return fx; }
function dlxStep(dt) { dlxU.value += dt; for (let i = dlxLive.length - 1; i >= 0; i--) { const fx = dlxLive[i]; fx.age += dt; try { fx.tick(dt, fx.age, Math.min(1, fx.age / fx.ttl)); } catch (e) { try { xE(e); } catch (e2) {} } if (fx.age >= fx.ttl) { try { fx.done(); } catch (e) {} dlxLive.splice(i, 1); } } }
function dlxPump() { if (dlxGT) { dlxPumpOn = false; return; } const now = dlxNow(), dt = Math.min(0.1, Math.max(0.0005, now - (dlxPump.last || now))); dlxPump.last = now; dlxStep(dt); if (dlxLive.length) requestAnimationFrame(dlxPump); else dlxPumpOn = false; }
function dlxUseGameTick() { dlxGT = true; dlxPumpOn = false; } // integrator then calls dlxTick(dt) per frame
function dlxTick(dt) { dlxStep(dt); }
function dlxEnd(h) { if (!h || !h.fx) return; const i = dlxLive.indexOf(h.fx); if (i >= 0) dlxLive.splice(i, 1); try { h.fx.done(); } catch (e) {} }
function dlxDispose(o) { o.traverse((m) => { if (m.material && m.material.dispose) m.material.dispose(); if (m.userData && m.userData.dlxOwnGeo && m.geometry && m.geometry.dispose) m.geometry.dispose(); }); }
function dlxFx(ttl, objs, tick, done) { const fx = { age: 0, ttl, objs, tick, done: done || function () { objs.forEach((o) => { try { scene.remove(o); dlxDispose(o); } catch (e) {} }); } }; objs.forEach((o) => scene.add(o)); dlxPush(fx); return { fx, end: function () { dlxEnd(this); } }; }
function dlxNearPlayer(p, d) { try { return player && Math.hypot(player.x - p.x, player.z - p.z) < d; } catch (e) { return false; } }
// nanowire strand: pale blue additive line with a soft pulse travelling along its length
const dlxSTRAND = "uniform float uT;uniform float uP;uniform float uSeed;varying vec2 vUv;void main(){float pulse=0.55+0.45*sin(vUv.x*9.0-uT*5.0+uSeed*6.0);vec3 c=mix(vec3(0.35,0.65,1.0),vec3(0.75,0.92,1.0),pulse);float a=(0.35+0.5*pulse)*(1.0-uP);gl_FragColor=vec4(c,a);}";
// glowing node orb: hot cyan core, blue fresnel shell
const dlxNODE = "uniform float uT;uniform float uP;uniform float uSeed;varying vec3 vN;varying vec3 vV;varying vec2 vUv;void main(){float f=pow(1.0-abs(dot(normalize(vN),normalize(vV))),1.4);float p=0.75+0.25*sin(uT*3.2+uSeed*9.0);vec3 c=mix(vec3(0.55,0.85,1.0),vec3(0.10,0.35,0.95),f)*p;c+=vec3(0.4,0.8,1.0)*(1.0-f)*0.6;float a=(0.95-0.55*f)*(1.0-uP);gl_FragColor=vec4(c,a);}";
// cocoon wire: dark translucent blue body, bright vertical+dagonal nanowire lines, slow swirl
const dlxWIRE = "uniform float uT;uniform float uP;uniform float uSeed;varying vec3 vN;varying vec3 vV;varying vec2 vUv;void main(){float f=pow(1.0-abs(dot(normalize(vN),normalize(vV))),1.6);float a1=vUv.x*28.0+uT*1.8+uSeed;float a2=vUv.x*28.0-uT*1.8+uSeed+vUv.y*10.0;float w1=smoothstep(0.92,1.0,abs(sin(a1)));float w2=smoothstep(0.94,1.0,abs(sin(a2)));float hor=smoothstep(0.96,1.0,abs(sin(vUv.y*22.0-uT*2.4)));float w=clamp(w1+w2+hor,0.0,1.0);vec3 c=mix(vec3(0.10,0.28,0.62),vec3(0.55,0.88,1.0),w);c+=vec3(0.3,0.7,1.0)*f*0.5;float al=(0.55+0.45*w)*(0.85+0.15*sin(uT*5.0))*(1.0-uP);gl_FragColor=vec4(c,al);}";
// gravnet ground lattice: dark blue field, cyan net lines, breathing rim
const dlxNET = "uniform float uT;uniform float uP;uniform float uSeed;varying vec2 vUv;void main(){vec2 q=(vUv-0.5)*2.0;float r=length(q);if(r>1.0)discard;float g1=abs(fract((q.x*3.5+q.y*2.0)*2.0)-0.5);float g2=abs(fract((q.x*3.5-q.y*2.0)*2.0)-0.5);float g3=abs(fract(q.y*7.0)-0.5);float line=smoothstep(0.10,0.02,min(min(g1,g2),g3));float breathe=0.6+0.4*sin(uT*2.6);float rim=smoothstep(0.86,1.0,r)*breathe;vec3 c=mix(vec3(0.05,0.14,0.42),vec3(0.35,0.80,1.0),line*0.9+rim);float a=(0.30+0.55*line+0.35*rim)*(1.0-smoothstep(0.92,1.0,r))*(1.0-uP);gl_FragColor=vec4(c,a);}";
// energy burst ring (sensor blast / net pop)
const dlxBURST = "uniform float uT;uniform float uP;uniform float uSeed;varying vec3 vN;varying vec3 vV;varying vec2 vUv;void main(){float f=pow(1.0-abs(dot(normalize(vN),normalize(vV))),1.2);vec3 c=mix(vec3(0.85,0.95,1.0),vec3(0.25,0.60,1.0),f);float a=(0.85-0.55*f)*(1.0-uP);gl_FragColor=vec4(c,a);}";
// annihilation spiral ribbon: translucent blue energy band with bright core edge
const dlxSPIRAL = "uniform float uT;uniform float uP;uniform float uSeed;varying vec2 vUv;void main(){float across=smoothstep(0.0,0.25,vUv.y)*(1.0-smoothstep(0.70,1.0,vUv.y));float flow=0.6+0.4*sin(vUv.x*14.0-uT*10.0+uSeed*5.0);vec3 c=mix(vec3(0.15,0.45,1.0),vec3(0.75,0.92,1.0),pow(1.0-abs(vUv.y-0.5)*2.0,2.0))*flow;float a=across*(0.55+0.35*flow)*(1.0-uP);gl_FragColor=vec4(c,a);}";
function dlxStrand(a, b, r, seed) { // pale blue energy wire between two Vector3-ish points
  const d = new THREE.Vector3(b.x - a.x, b.y - a.y, b.z - a.z), L = d.length();
  const m = new THREE.Mesh(dlxGeos().cyl, dlxMat("strand", dlxSTRAND, seed)); m.userData.dlxStrand = true;
  m.scale.set(r || 0.03, L, r || 0.03); m.position.set((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()); return m; }
// ---- entries ----
// Barrier Mesh: node orbs with vertical beams joined by crisscrossing nanowire strands (wiki clip)
function dlxBarrierMesh(p, yaw, len, seconds) { try { /* yaw: radians (Three.js rotation.y) */ const G = dlxGeos(), L = len || 7.5, ttl = Math.max(1, seconds || 30);
  const grp = new THREE.Group(); grp.position.set(p.x, (p.y || 0), p.z); grp.rotation.y = yaw || 0;
  const posts = [], xs = [-L / 2, -L / 6, L / 6, L / 2], strands = [];
  xs.forEach((x, i) => { const node = new THREE.Mesh(G.sph, dlxMat("node", dlxNODE, i * 1.7)); node.scale.setScalar(0.14); node.position.set(x, 0.10, 0);
    const beam = new THREE.Mesh(G.cyl, dlxMat("beam", dlxBURST, i)); beam.scale.set(0.035, 2.0, 0.035); beam.position.set(x, 1.0, 0);
    grp.add(node); grp.add(beam); posts.push({ x, y: 1.9, z: 0 }); });
  const A = [{ x: xs[0], y: 1.9 }, { x: xs[1], y: 0.25 }, { x: xs[2], y: 1.9 }, { x: xs[3], y: 0.25 }];
  const B = [{ x: xs[0], y: 0.25 }, { x: xs[1], y: 1.9 }, { x: xs[2], y: 0.25 }, { x: xs[3], y: 1.9 }];
  for (let i = 0; i < 3; i++) { strands.push(dlxStrand({ x: A[i].x, y: A[i].y, z: 0 }, { x: A[i + 1].x, y: A[i + 1].y, z: 0 }, 0.035, i));
    strands.push(dlxStrand({ x: B[i].x, y: B[i].y, z: 0 }, { x: B[i + 1].x, y: B[i + 1].y, z: 0 }, 0.035, i + 4)); }
  strands.push(dlxStrand({ x: xs[0], y: 1.95, z: 0 }, { x: xs[3], y: 1.95, z: 0 }, 0.028, 9));
  strands.forEach((s) => grp.add(s));
  const fx = dlxFx(ttl, [grp], (dt, age, k) => { const grow = Math.min(1, age / 0.4), die = Math.max(0, (age - (ttl - 0.5)) / 0.5);
    grp.children.forEach((m) => { if (m.userData.dlxStrand) { m.material.uniforms.uP.value = Math.min(1, die + (1 - grow)); } else { m.material.uniforms.uP.value = die; m.visible = age > 0.08; } });
    grp.scale.set(1, Math.max(0.05, grow * (1 - die)), 1); });
  return fx; } catch (e) { try { window.dlxErr = String(e && e.stack || e).slice(0, 300); xE(e); } catch (e2) {} return null; } }
// Sonic Sensor: small wall/ground device, dark body + pulsing blue lens + periodic faint scan ring
function dlxSonicSensor(p, seconds) { try { const G = dlxGeos(), ttl = Math.max(1, seconds || 30);
  const body = new THREE.Mesh(G.box, dlxBasic(0x1a2430, 0.95, false)); body.scale.set(0.34, 0.20, 0.22); body.position.set(p.x, (p.y || 0) + 0.12, p.z);
  const lens = new THREE.Mesh(G.sph, dlxMat("node", dlxNODE, 3.1)); lens.scale.setScalar(0.11); lens.position.set(p.x, (p.y || 0) + 0.16, p.z);
  const scan = new THREE.Mesh(G.ring, dlxBasic(0x5ab0ff, 0.0, true)); scan.rotation.x = -Math.PI / 2; scan.position.set(p.x, (p.y || 0) + 0.05, p.z);
  const fx = dlxFx(ttl, [body, lens, scan], (dt, age) => { const ph = age % 2.4;
    scan.scale.setScalar(0.2 + ph * 2.2); scan.material.opacity = Math.max(0, 0.45 * (1 - ph / 2.4));
    lens.material.uniforms.uP.value = 0; const die = Math.max(0, (age - (ttl - 0.4)) / 0.4); lens.material.uniforms.uP.value = die; scan.material.opacity *= (1 - die); body.material.opacity = 0.95 * (1 - die); });
  return fx; } catch (e) { try { window.dlxErr = String(e && e.stack || e).slice(0, 300); xE(e); } catch (e2) {} return null; } }
// Sonic Sensor trigger: white-blue concuss flash + expanding rings
function dlxSensorBlast(p) { try { const G = dlxGeos();
  const core = new THREE.Mesh(G.sph, dlxMat("burst", dlxBURST, 0)); core.scale.setScalar(0.3); core.position.set(p.x, (p.y || 0) + 0.4, p.z);
  const r1 = new THREE.Mesh(G.ring, dlxBasic(0x9fd4ff, 0.8, true)); r1.rotation.x = -Math.PI / 2; r1.position.set(p.x, (p.y || 0) + 0.08, p.z);
  const r2 = r1.clone(); r2.material = dlxBasic(0x4a9aff, 0.5, true); r2.position.y += 0.02;
  return dlxFx(0.85, [core, r1, r2], (dt, age, k) => { core.scale.setScalar(0.3 + age * 5); core.material.uniforms.uP.value = k * k;
    r1.scale.setScalar(0.4 + age * 9); r1.material.opacity = 0.8 * (1 - k); r2.scale.setScalar(0.3 + age * 6.5); r2.material.opacity = 0.5 * (1 - k * k); }); } catch (e) { try { window.dlxErr = String(e && e.stack || e).slice(0, 300); xE(e); } catch (e2) {} return null; } }
// GravNet: translucent blue net dome pops, then a persistent hex-lattice ground field
function dlxGravNet(p, r, seconds) { try { const G = dlxGeos(), R = r || 6, ttl = Math.max(1.2, seconds || 8);
  const dome = new THREE.Mesh(G.sph, dlxMat("burst", dlxBURST, 1.3)); dome.scale.setScalar(0.4); dome.position.set(p.x, (p.y || 0) + 0.4, p.z);
  const field = new THREE.Mesh(new THREE.CircleGeometry(R, 40), dlxMat("net", dlxNET, 0)); field.userData.dlxOwnGeo = true;
  field.rotation.x = -Math.PI / 2; field.position.set(p.x, (p.y || 0) + 0.06, p.z); field.scale.setScalar(0.05);
  const rim = new THREE.Mesh(G.ring, dlxBasic(0x66baff, 0.5, true)); rim.rotation.x = -Math.PI / 2; rim.position.set(p.x, (p.y || 0) + 0.07, p.z); rim.scale.setScalar(0.05);
  return dlxFx(ttl, [dome, field, rim], (dt, age, k) => { const dk = Math.min(1, age / 0.45);
    dome.scale.setScalar(0.4 + dk * R * 0.8); dome.material.uniforms.uP.value = age < 0.45 ? 0 : Math.min(1, (age - 0.45) / 0.3); dome.visible = age < 0.8;
    const g = Math.min(1, Math.max(0, (age - 0.12) / 0.35)), out = 1 - Math.pow(1 - g, 3);
    const die = Math.max(0, (age - (ttl - 0.6)) / 0.6);
    field.scale.setScalar(Math.max(0.05, out) * Math.max(0.05, 1 - die)); field.material.uniforms.uP.value = die;
    rim.scale.setScalar(Math.max(0.05, out) * R); rim.material.opacity = 0.5 * (0.6 + 0.4 * Math.sin(dlxU.value * 2.6)) * (1 - die); }); } catch (e) { try { window.dlxErr = String(e && e.stack || e).slice(0, 300); xE(e); } catch (e2) {} return null; } }
// Annihilation cast: blue nanowire energy spirals racing forward
function dlxAnnihilation(o, d, dist) { try { const G = dlxGeos(), dir = new THREE.Vector3(d.x, d.y || 0, d.z).normalize(), origin = new THREE.Vector3(o.x, o.y, o.z), D = dist || 20;
  const grp = new THREE.Group(); grp.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir);
  const strips = []; for (let i = 0; i < 4; i++) { const m = new THREE.Mesh(G.plane, dlxMat("spiral", dlxSPIRAL, i * 2.1)); m.scale.set(1.4, 0.55, 1); m.userData.a0 = i * Math.PI / 2; grp.add(m); strips.push(m); }
  const core = new THREE.Mesh(G.sph, dlxBasic(0x8fd0ff, 0.85, true)); core.scale.setScalar(0.22); grp.add(core);
  const SPEED = D / 0.7;
  const fx = dlxFx(1.0, [grp], (dt, age, k) => { const s = Math.min(D, age * SPEED); grp.position.copy(origin).addScaledVector(dir, s); grp.position.y = Math.max(0.6, origin.y);
    strips.forEach((m) => { const a = m.userData.a0 + age * 9; m.position.set(Math.cos(a) * 0.7, Math.sin(a) * 0.7, 0); m.rotation.z = a + Math.PI / 2; m.material.uniforms.uP.value = k; });
    core.material.opacity = 0.85 * (1 - k); core.scale.setScalar(0.22 + age * 0.4); });
  return fx; } catch (e) { try { window.dlxErr = String(e && e.stack || e).slice(0, 300); xE(e); } catch (e2) {} return null; } }
// Annihilation cocoon: pulsing nanowire capsule around the caught target; setPos follows the drag
function dlxAnniCocoon(p, seconds) { try { const G = dlxGeos(), ttl = Math.max(0.8, seconds || 7);
  const grp = new THREE.Group(); grp.position.set(p.x, (p.y || 0), p.z);
  const cage = new THREE.Mesh(G.cyl, dlxMat("wire", dlxWIRE, 0)); cage.scale.set(0.9, 2.1, 0.9); cage.position.y = 1.05; grp.add(cage);
  const glow = new THREE.Mesh(G.sph, dlxBasic(0x3f8aff, 0.30, true)); glow.scale.set(1.05, 1.35, 1.05); glow.position.y = 1.05; grp.add(glow);
  const wisps = []; for (let i = 0; i < 3; i++) { const w = new THREE.Mesh(G.plane, dlxMat("spiral", dlxSPIRAL, 7 + i)); w.scale.set(0.5, 0.3, 1); grp.add(w); wisps.push(w); }
  const fx = dlxFx(ttl, [grp], (dt, age, k) => { const grow = Math.min(1, age / 0.3), die = Math.max(0, (age - (ttl - 0.35)) / 0.35);
    cage.material.uniforms.uP.value = die; cage.scale.set(0.9 * grow * (1 - die * 0.5), 2.1 * grow * (1 - die), 0.9 * grow * (1 - die * 0.5));
    glow.material.opacity = 0.30 * (0.7 + 0.3 * Math.sin(dlxU.value * 4)) * grow * (1 - die);
    wisps.forEach((w, i) => { const a = dlxU.value * 2.4 + i * Math.PI * 2 / 3; w.position.set(Math.cos(a) * 1.0, 0.6 + i * 0.45 + Math.sin(dlxU.value * 3 + i) * 0.1, Math.sin(a) * 1.0); w.rotation.y = -a + Math.PI / 2; w.material.uniforms.uP.value = Math.min(1, die + (1 - grow)); }); });
  fx.setPos = function (np) { grp.position.set(np.x, (np.y || 0), np.z); };
  return fx; } catch (e) { try { window.dlxErr = String(e && e.stack || e).slice(0, 300); xE(e); } catch (e2) {} return null; } }
// round reset / cleanup hook (integrator calls from the same boundary as omxReset)
function dlxReset() { while (dlxLive.length) dlxEnd({ fx: dlxLive[0] }); }
// ---- END DEADLOCK FX ----
