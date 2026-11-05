// ---- FADE FX ----
// Fade ability visuals (work/fade_fx_runtime.js), reference-grounded in the wiki showcase clips
// (wiki.playvalorant.com/en-us/images/Prowler_Showcase.mp4, Seize_Showcase.mp4,
// Haunt_Showcase.mp4, Nightfall_Showcase.mp4; frame sheets reviewed 2026-11-04).
// Procedural approximation, not extracted game assets. Mechanics (nearsight, tether, reveal,
// deafen/decay) stay in the caller; this module draws only.
//   Prowler: low dark mist creature with red glint eyes darting along the ground.
//   Seize: inky violet knot in flight; pool = small near-black stain with long thin black ground tendrils.
//   Haunt: dark navy orb with a glowing red eye; burst = watcher flash + magenta reveal pulse.
//   Nightfall: tall sweeping wall of darkness carrying glowing cyan nightmare sigils.
// Contract: entries take world positions, return a handle with .end() (movers also .move(...)).
// Game-dt driven: fdxUseGameTick() once, then fdxTick(dt) per frame; otherwise a rAF pump runs
// while effects exist. Cloned per-effect materials disposed on end; shared geometry/programs persist.
// Globals used (read-only): THREE, scene, camera?, document?. fdxReset() ends every live effect.
var fdxU = { value: 0 }, fdxLive = [], fdxPumpOn = false, fdxGT = false, fdxGeo = null, fdxProg = {};
function fdxGeos() { if (fdxGeo) return fdxGeo; fdxGeo = {
  sph: new THREE.SphereGeometry(1, 20, 14),
  ring: new THREE.RingGeometry(0.86, 1, 48),
  cone: new THREE.ConeGeometry(0.5, 1, 6),
  plane: new THREE.PlaneGeometry(1, 1, 1, 4),
  bigplane: new THREE.PlaneGeometry(1, 1, 24, 6) }; return fdxGeo; }
function fdxShader(k, frag, opts) { if (fdxProg[k]) return fdxProg[k]; const m = new THREE.ShaderMaterial(Object.assign({
  uniforms: { uT: fdxU, uP: { value: 0 }, uSeed: { value: 0 }, uA: { value: 1 } },
  vertexShader: "uniform float uT;uniform float uP;uniform float uSeed;varying vec3 vN;varying vec3 vV;varying vec3 vP;varying vec2 vUv;void main(){vUv=uv;vP=position;vec4 mv=modelViewMatrix*vec4(position,1.0);vV=-mv.xyz;vN=normalMatrix*normal;gl_Position=projectionMatrix*mv;}",
  fragmentShader: frag, transparent: true, depthWrite: false, side: THREE.DoubleSide }, opts || {}));
  fdxProg[k] = m; return m; }
// red-black ink: near-black body, dark crimson sheen, churning (Seize/Prowler look)
const fdxINK = "uniform float uT;uniform float uP;uniform float uSeed;uniform float uA;varying vec3 vN;varying vec3 vV;varying vec3 vP;varying vec2 vUv;void main(){float f=pow(1.0-abs(dot(normalize(vN),normalize(vV))),1.5);float churn=0.5+0.5*sin(vP.x*8.0+uT*3.1+uSeed)*sin(vP.y*9.0-uT*2.3)*sin(vP.z*7.0+uT*1.7);vec3 c=mix(vec3(0.012,0.004,0.006),vec3(0.15,0.02,0.035),churn*0.5+f*0.4);c+=vec3(0.42,0.05,0.07)*f*f*0.35;float a=(0.6+0.38*f)*(0.78+0.22*churn)*uA*(1.0-uP);if(a<0.004)discard;gl_FragColor=vec4(c,a);}";
// ink tendril: black ribbon with crimson inner glow
const fdxINKS = "uniform float uT;uniform float uP;uniform float uSeed;uniform float uA;varying vec3 vN;varying vec3 vV;varying vec3 vP;varying vec2 vUv;void main(){float d=length(vUv-0.5)*2.0;float an=atan(vUv.y-0.5,vUv.x-0.5);float wob=0.18*sin(an*5.0+uSeed)+0.12*sin(an*9.0-uT*0.7);float body=1.0-smoothstep(0.45,0.85,d+wob);float churn=0.5+0.5*sin(vP.x*8.0+uT*3.1+uSeed)*sin(vP.y*9.0-uT*2.3);vec3 c=mix(vec3(0.008,0.004,0.008),vec3(0.06,0.02,0.04),churn*0.4);float a=body*(0.78+0.2*churn)*uA*(1.0-uP);if(a<0.004)discard;gl_FragColor=vec4(c,a);}";
const fdxINKB = "uniform float uT;uniform float uP;uniform float uSeed;uniform float uA;varying vec3 vN;varying vec3 vV;varying vec3 vP;varying vec2 vUv;void main(){float x=vUv.x,y=vUv.y;float sway=sin(x*9.0-uT*4.0+uSeed*8.0)*0.15;float across=smoothstep(0.0,0.25,y+sway)*(1.0-smoothstep(0.75+sway,1.0,y+sway));float tail=1.0-x;float flow=0.6+0.4*sin(x*21.0-uT*6.0+uSeed);vec3 c=mix(vec3(0.004,0.006,0.012),vec3(0.08,0.20,0.28),pow(tail,2.2)*0.7);float a=across*(0.5+0.5*tail)*flow*uA*(1.0-uP);if(a<0.004)discard;gl_FragColor=vec4(c,a);}";
const fdxINKT = "uniform float uT;uniform float uP;uniform float uSeed;uniform float uA;varying vec3 vN;varying vec3 vV;varying vec3 vP;varying vec2 vUv;void main(){float x=vUv.x,y=vUv.y;float sway=sin(x*9.0-uT*4.0+uSeed*8.0)*0.15;float across=smoothstep(0.0,0.25,y+sway)*(1.0-smoothstep(0.75+sway,1.0,y+sway));float tail=1.0-x;float flow=0.6+0.4*sin(x*21.0-uT*6.0+uSeed);vec3 c=mix(vec3(0.02,0.005,0.01),vec3(0.45,0.06,0.09),pow(tail,1.8));float a=across*(0.3+0.7*tail)*flow*uA*(1.0-uP);if(a<0.004)discard;gl_FragColor=vec4(c,a);}";
// nightmare smoke: near-black body, violet sheen on fresnel, churning surface
const fdxSMOKE = "uniform float uT;uniform float uP;uniform float uSeed;uniform float uA;varying vec3 vN;varying vec3 vV;varying vec3 vP;varying vec2 vUv;void main(){float f=pow(1.0-abs(dot(normalize(vN),normalize(vV))),1.4);float churn=0.5+0.5*sin(vP.x*8.0+uT*3.1+uSeed)*sin(vP.y*9.0-uT*2.3)*sin(vP.z*7.0+uT*1.7);vec3 c=mix(vec3(0.02,0.01,0.05),vec3(0.16,0.07,0.30),churn*0.6+f*0.5);c+=vec3(0.35,0.10,0.45)*f*f*0.6;float a=(0.55+0.4*f)*(0.75+0.25*churn)*uA*(1.0-uP);if(a<0.004)discard;gl_FragColor=vec4(c,a);}";
// inky tendril: dark ribbon with violet inner glow
const fdxTENDRIL = "uniform float uT;uniform float uP;uniform float uSeed;uniform float uA;varying vec3 vN;varying vec3 vV;varying vec3 vP;varying vec2 vUv;void main(){float x=vUv.x,y=vUv.y;float sway=sin(x*9.0-uT*4.0+uSeed*8.0)*0.15;float across=smoothstep(0.0,0.25,y+sway)*(1.0-smoothstep(0.75+sway,1.0,y+sway));float tail=1.0-x;float flow=0.6+0.4*sin(x*21.0-uT*6.0+uSeed);vec3 c=mix(vec3(0.03,0.01,0.07),vec3(0.38,0.14,0.52),pow(tail,1.8));float a=across*(0.25+0.75*tail)*flow*uA*(1.0-uP);if(a<0.004)discard;gl_FragColor=vec4(c,a);}";
// nightfall wall: darkness with glowing cyan nightmare sigil patterns scrolling across
const fdxSIGIL = "uniform float uT;uniform float uP;uniform float uSeed;uniform float uA;varying vec3 vN;varying vec3 vV;varying vec3 vP;varying vec2 vUv;void main(){float x=vUv.x,y=vUv.y;float wx=x+0.14*sin(y*13.0+uSeed)+0.07*sin(y*31.0-uT*0.4);float wy=y+0.14*sin(x*11.0-uSeed*2.0)+0.06*sin(x*27.0+uT*0.3);float curl1=abs(sin(wx*21.0+sin(wy*17.0)*3.0));float curl2=abs(sin(wy*19.0+sin(wx*15.0+uT*0.5)*3.0));float web=curl1*curl2;float sig=smoothstep(0.55,0.92,1.0-web);float knots=smoothstep(0.90,0.995,sin(wx*47.0+wy*43.0+uSeed)*sin(wx*39.0-wy*51.0));float pulse=0.5+0.5*sin(uT*1.8+x*6.0);vec3 base=mix(vec3(0.012,0.006,0.03),vec3(0.07,0.02,0.13),0.5+0.5*sin(y*5.0-uT*1.2+uSeed));vec3 c=base+vec3(0.12,0.75,0.8)*sig*(0.35+0.45*pulse)+vec3(0.3,0.95,1.0)*knots*0.7;float edge=smoothstep(0.0,0.06,x)*(1.0-smoothstep(0.94,1.0,x));float a=(0.88+sig*0.12)*edge*(1.0-abs(y-0.5)*0.15)*uA*(1.0-uP);if(a<0.004)discard;gl_FragColor=vec4(c,a);}";
// red eye glint
const fdxEYE = "uniform float uT;uniform float uP;uniform float uSeed;uniform float uA;varying vec3 vN;varying vec3 vV;varying vec3 vP;varying vec2 vUv;void main(){float d=length(vUv-0.5)*2.0;float core=1.0-smoothstep(0.0,0.5,d);float halo=1.0-smoothstep(0.2,1.0,d);vec3 c=vec3(1.0,0.10,0.14)*halo*0.8+vec3(1.0,0.55,0.5)*core;float a=(halo*0.75+core)*uA*(1.0-uP);if(a<0.004)discard;gl_FragColor=vec4(c,a);}";
var fdxGlowTex = null, fdxMoteTex = null;
function fdxTexGlow() { if (fdxGlowTex) return fdxGlowTex; const c = document.createElement("canvas"); c.width = c.height = 128; const g = c.getContext("2d");
  const r = g.createRadialGradient(64, 64, 2, 64, 64, 62); r.addColorStop(0, "rgba(255,255,255,1)"); r.addColorStop(0.35, "rgba(255,255,255,0.5)"); r.addColorStop(1, "rgba(255,255,255,0)"); g.fillStyle = r; g.fillRect(0, 0, 128, 128);
  fdxGlowTex = new THREE.CanvasTexture(c); return fdxGlowTex; }
function fdxTexMote() { if (fdxMoteTex) return fdxMoteTex; const c = document.createElement("canvas"); c.width = c.height = 64; const g = c.getContext("2d");
  const r = g.createRadialGradient(32, 32, 1, 32, 32, 30); r.addColorStop(0, "rgba(255,255,255,1)"); r.addColorStop(0.5, "rgba(255,255,255,0.55)"); r.addColorStop(1, "rgba(255,255,255,0)"); g.fillStyle = r; g.fillRect(0, 0, 64, 64);
  fdxMoteTex = new THREE.CanvasTexture(c); return fdxMoteTex; }
function fdxMat(k, shader, seed, opts) { const m = fdxShader(k, shader, opts).clone(); m.uniforms.uT = fdxU; if (seed !== undefined) m.uniforms.uSeed.value = seed; return m; }
function fdxBasic(c, o, add) { return new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: o, depthWrite: false, blending: add ? THREE.AdditiveBlending : THREE.NormalBlending, side: THREE.DoubleSide }); }
function fdxGlow(c, o, s, add) { const m = new THREE.SpriteMaterial({ map: fdxTexGlow(), color: c, transparent: true, opacity: o, depthWrite: false, blending: add === false ? THREE.NormalBlending : THREE.AdditiveBlending }); const sp = new THREE.Sprite(m); sp.scale.setScalar(s || 1); return sp; }
function fdxFree(objs) { objs.forEach((o) => { try { scene.remove(o); o.traverse((q) => { if (q.material && q.material.dispose) q.material.dispose(); if (q.geometry && q.geometry.userData && q.geometry.userData.own) q.geometry.dispose(); }); } catch (e) {} }); }
function fdxPush(fx) { if (fdxLive.length > 24) { const o = fdxLive.shift(); try { o.done(); } catch (e) {} } fdxLive.push(fx); if (!fdxGT && !fdxPumpOn) { fdxPumpOn = true; fdxPump.last = null; requestAnimationFrame(fdxPump); } return fx; }
function fdxStep(dt) { fdxU.value += dt; for (let i = fdxLive.length - 1; i >= 0; i--) { const fx = fdxLive[i]; fx.age += dt; try { fx.tick(dt, fx.age, Math.min(1, fx.age / fx.ttl)); } catch (e) { try { xE(e); } catch (e2) {} }
  if (fx.age >= fx.ttl) { try { fx.done(); } catch (e) {} fdxLive.splice(i, 1); } } }
function fdxPump() { if (fdxGT) { fdxPumpOn = false; return; } const now = (function () { try { return performance.now() / 1000; } catch (e) { return Date.now() / 1000; } })();
  const dt = Math.min(0.1, Math.max(0.0005, now - (fdxPump.last || now))); fdxPump.last = now; fdxStep(dt);
  if (fdxLive.length) requestAnimationFrame(fdxPump); else fdxPumpOn = false; }
function fdxUseGameTick() { fdxGT = true; fdxPumpOn = false; }
function fdxTick(dt) { fdxStep(dt); }
function fdxEnd(h) { if (!h || !h.fx) return; const i = fdxLive.indexOf(h.fx); if (i >= 0) fdxLive.splice(i, 1); try { h.fx.done(); } catch (e) {} }
function fdxReset() { while (fdxLive.length) fdxEnd({ fx: fdxLive[0] }); }
function fdxFx(ttl, objs, tick, done) { const fx = { age: 0, ttl, objs, tick: tick || function () {}, done: done || function () { fdxFree(objs); } }; objs.forEach((o) => scene.add(o)); fdxPush(fx); return { fx, end: function () { fdxEnd(this); } }; }
function fdxErr(e) { try { xE(e); } catch (e2) {} return null; }
// ---- entries ----
// Prowler (observer in-game frame, wiki Prowler Image): elongated low nightmare creature of layered
// dark navy ink ribbons with violet sheen, magenta head glow, long thin black tail with a red band.
// move(x, y, z, yaw) steers.
function fdxProwler(x, y, z, yaw) { try { const G = fdxGeos(), g = new THREE.Group();
  const skin = fdxMat("smk", fdxSMOKE, 1.9);
  const body = new THREE.Mesh(G.sph, skin); body.scale.set(0.40, 0.30, 1.0); body.position.y = 0.38; g.add(body);
  const rear = new THREE.Mesh(G.sph, skin); rear.scale.set(0.30, 0.25, 0.42); rear.position.set(0, 0.42, 0.6); g.add(rear);
  const head = new THREE.Mesh(G.sph, skin); head.scale.set(0.26, 0.22, 0.36); head.position.set(0, 0.40, -0.85); g.add(head);
  const snout = new THREE.Mesh(G.cone, skin); snout.scale.set(0.12, 0.34, 0.12); snout.rotation.x = -Math.PI / 2; snout.position.set(0, 0.36, -1.14); g.add(snout);
  const headGlow = fdxGlow(0xc04aff, 0.32, 0.5); headGlow.position.set(0, 0.42, -0.95); g.add(headGlow);
  [-1, 1].forEach((s) => { const e = fdxGlow(0xd06aff, 0.5, 0.16); e.position.set(s * 0.1, 0.47, -1.02); g.add(e); });
  const legs = []; [[-0.2, -0.4], [0.2, -0.4], [-0.2, 0.35], [0.2, 0.35]].forEach(([x, z]) => { const l = new THREE.Mesh(G.cone, skin); l.scale.set(0.08, 0.3, 0.08); l.rotation.x = Math.PI; l.position.set(x, 0.15, z); g.add(l); legs.push(l); });
  const shreds = []; for (let i = 0; i < 5; i++) { const w = new THREE.Mesh(G.plane, fdxMat("tnd", fdxTENDRIL, i * 2.2));
    w.scale.set(1.5 + (i % 3) * 0.5, 0.10 + (i % 2) * 0.08, 1); w.rotation.x = -Math.PI / 2; w.rotation.z = Math.PI / 2 + (i - 2) * 0.16;
    w.position.set((i - 2) * 0.13, 0.42 + (i % 3) * 0.1, 0.9 + (i % 2) * 0.3); g.add(w); shreds.push(w); }
  const tail = new THREE.Mesh(G.plane, fdxMat("inkT", fdxINKT, 5.1)); tail.scale.set(2.0, 0.09, 1); tail.rotation.x = -Math.PI / 2; tail.rotation.z = Math.PI / 2; tail.position.set(0, 0.3, 1.6); g.add(tail);
  const band = new THREE.Mesh(G.plane, fdxBasic(0xc01028, 0.85, false)); band.scale.set(0.2, 0.12, 1); band.rotation.x = -Math.PI / 2; band.position.set(0, 0.3, 0.86); g.add(band);
  const pad = fdxGlow(0x0a0610, 0.4, 1.2, false); pad.position.y = 0.08; g.add(pad);
  g.position.set(x, y, z); g.rotation.y = yaw || 0;
  let lx = x, lz = z, stride = 0;
  const h = fdxFx(1e9, [g], (dt) => { const dx = g.position.x - lx, dz = g.position.z - lz; lx = g.position.x; lz = g.position.z;
    stride += Math.hypot(dx, dz) * 10; const run = Math.min(1, Math.hypot(dx, dz) / Math.max(1e-5, dt) / 4);
    body.position.y = 0.38 + Math.abs(Math.sin(stride)) * 0.08 * run; headGlow.material.opacity = 0.26 + 0.1 * Math.sin(fdxU.value * 8);
    legs.forEach((l, i) => { l.rotation.x = Math.PI + Math.sin(stride + (i % 2 ? Math.PI : 0)) * 0.6 * run; });
    shreds.forEach((w, i) => { w.material.uniforms.uA.value = 0.55 + 0.3 * Math.sin(fdxU.value * 5 + i * 2); });
    tail.material.uniforms.uA.value = 0.7 + 0.2 * Math.sin(fdxU.value * 6); });
  h.move = function (nx, ny, nz, yw) { g.position.set(nx, ny, nz); if (yw !== undefined) g.rotation.y = yw; };
  return h; } catch (e) { return fdxErr(e); } }
function fdxProwlerBurst(p) { try { const G = fdxGeos(), grp = new THREE.Group(); grp.position.set(p.x, (p.y || 0) + 0.4, p.z);
  const puff = new THREE.Mesh(G.sph, fdxMat("smokeB", fdxSMOKE, 6.6)); puff.scale.setScalar(0.4); grp.add(puff);
  const flash = fdxGlow(0xff2a4a, 0.8, 1.6); grp.add(flash);
  const ring = new THREE.Mesh(G.ring, fdxBasic(0x8a2a5a, 0.7, true)); ring.rotation.x = -Math.PI / 2; ring.position.y = -0.25; grp.add(ring);
  return fdxFx(0.6, [grp], (dt, age, k) => { puff.scale.setScalar(0.4 + k * 1.6); puff.material.uniforms.uP.value = k * 0.9;
    flash.material.opacity = 0.8 * (1 - k); ring.scale.setScalar(0.3 + k * 2.6); ring.material.opacity = 0.7 * (1 - k); });
 } catch (e) { return fdxErr(e); } }
// Seize knot in flight: inky violet orb, churning, red vein pulses. move() follows the arc.
function fdxSeizeOrb(x, y, z) { try { const G = fdxGeos(), grp = new THREE.Group();
  const core = new THREE.Mesh(G.sph, fdxMat("inkO", fdxINK, 4.4)); core.scale.setScalar(0.34); grp.add(core);
  const knot = new THREE.Mesh(G.sph, fdxMat("inkO2", fdxINK, 8.1)); knot.scale.set(0.24, 0.3, 0.24); grp.add(knot);
  const eye = new THREE.Mesh(G.plane, fdxMat("eyeO", fdxEYE, 2.2)); eye.scale.setScalar(0.2); grp.add(eye);
  const veins = []; for (let i = 0; i < 3; i++) { const v = new THREE.Mesh(G.plane, fdxMat("inkV", fdxINKT, i * 2.9)); v.scale.set(0.7, 0.1, 1); v.rotation.set(i * 1.05, i * 2.1, 0); grp.add(v); veins.push(v); }
  const vein = fdxGlow(0xff2a4a, 0.45, 0.75); grp.add(vein);
  const glow = fdxGlow(0x8a1020, 0.5, 1.3); grp.add(glow);
  grp.position.set(x, y, z);
  const h = fdxFx(1e9, [grp], (dt) => { core.rotation.y += dt * 2.4; core.material.uniforms.uSeed.value += dt * 0.8;
    eye.lookAt(camera ? camera.position : grp.position); eye.position.set(0, 0, -0.28).applyQuaternion(grp.quaternion);
    glow.material.opacity = 0.45 + 0.15 * Math.sin(fdxU.value * 6); vein.material.opacity = 0.3 + 0.2 * Math.sin(fdxU.value * 5.2); });
  h.move = function (nx, ny, nz) { grp.position.set(nx, ny, nz); };
  return h; } catch (e) { return fdxErr(e); } }
// Seize pool (observer frames 4.2-5.5s): small near-black ink stain where the knot lands +
// a few long thin black tendrils snaking outward along the ground with faint blue edge accents.
// seconds = tether duration.
function fdxSeizePool(p, r, seconds) { try { const G = fdxGeos(), grp = new THREE.Group(); grp.position.set(p.x, p.y || 0, p.z); const R = r || 3.5, TTL = seconds || 4.5;
  const stain = new THREE.Mesh(G.plane, fdxMat("inkP", fdxINKS, 8.8)); stain.rotation.x = -Math.PI / 2; stain.scale.setScalar(R * 0.62); stain.position.y = 0.045; grp.add(stain);
  const snakes = []; for (let i = 0; i < 5; i++) { const a = i / 5 * 6.28 + Math.random() * 0.7; const len = R * (0.75 + Math.random() * 0.5);
    const t = new THREE.Mesh(G.plane, fdxMat("inkB", fdxINKB, i * 2.4)); t.scale.set(len, 0.15 + Math.random() * 0.06, 1);
    t.rotation.x = -Math.PI / 2; t.rotation.z = -a; t.position.set(Math.cos(a) * len * 0.45, 0.03 + i * 0.004, Math.sin(a) * len * 0.45); grp.add(t); snakes.push(t); }
  const tendrils = []; for (let i = 0; i < 5; i++) { const a = i / 5 * 6.28 + Math.random() * 0.5, rr = R * (0.1 + Math.random() * 0.25);
    const t = new THREE.Mesh(G.plane, fdxMat("inkTP", fdxINKT, i * 1.37)); t.scale.set(0.9 + Math.random() * 0.4, 0.32, 1);
    t.position.set(Math.cos(a) * rr, 0.42, Math.sin(a) * rr); t.rotation.z = Math.PI / 2; t.rotation.y = -a + Math.PI / 2 + (Math.random() - 0.5);
    grp.add(t); tendrils.push(t); }
  const h = fdxFx(TTL, [grp], (dt, age) => { const gin = Math.min(1, age / 0.35), gout = Math.min(1, Math.max(0, (TTL - age) / 0.5)), gg = Math.min(gin, gout);
    stain.material.uniforms.uSeed.value += dt * 0.5; stain.material.uniforms.uA.value = gg;
    tendrils.forEach((t, i) => { t.material.uniforms.uA.value = gg * (0.55 + 0.4 * Math.sin(fdxU.value * 3 + i * 1.7)); t.rotation.z = Math.PI / 2 + Math.sin(fdxU.value * 2.2 + i) * 0.2; });
    snakes.forEach((t, i) => { t.material.uniforms.uA.value = gg * (0.8 + 0.2 * Math.sin(fdxU.value * 2.1 + i * 1.3)); }); });
  return h; } catch (e) { return fdxErr(e); } }
// Haunt orb in flight: dark navy orb with a visible red eye. move() follows the arc.
function fdxHauntOrb(x, y, z) { try { const G = fdxGeos(), grp = new THREE.Group();
  const core = new THREE.Mesh(G.sph, fdxMat("smokeH", fdxSMOKE, 9.1)); core.scale.setScalar(0.2); grp.add(core);
  const eye = new THREE.Mesh(G.plane, fdxMat("eyeH", fdxEYE, 5.5)); eye.scale.setScalar(0.22); grp.add(eye);
  const glow = fdxGlow(0x2a0a4a, 0.6, 0.9); grp.add(glow);
  grp.position.set(x, y, z);
  const h = fdxFx(1e9, [grp], (dt) => { core.material.uniforms.uSeed.value += dt;
    eye.lookAt(camera ? camera.position : grp.position); eye.position.set(0, 0, -0.18).applyQuaternion(grp.quaternion);
    eye.material.uniforms.uA.value = 0.8 + 0.2 * Math.sin(fdxU.value * 9); });
  h.move = function (nx, ny, nz) { grp.position.set(nx, ny, nz); };
  return h; } catch (e) { return fdxErr(e); } }
// Haunt burst: the watcher appears - dark entity flash, big red eye, magenta reveal pulse ring.
function fdxHauntBurst(p) { try { const G = fdxGeos(), grp = new THREE.Group(); grp.position.set(p.x, (p.y || 0) + 1.1, p.z);
  const body = new THREE.Mesh(G.sph, fdxMat("smokeW", fdxSMOKE, 3.3)); body.scale.set(0.4, 0.55, 0.4); grp.add(body);
  const eye = new THREE.Mesh(G.plane, fdxMat("eyeW", fdxEYE, 8.8)); eye.scale.setScalar(0.5); eye.position.z = -0.3; grp.add(eye);
  const flash = fdxGlow(0xd04a8a, 0.9, 3); grp.add(flash);
  const ring = new THREE.Mesh(G.ring, fdxBasic(0xd04a8a, 0.85, true)); grp.add(ring);
  const tendrils = []; for (let i = 0; i < 5; i++) { const t = new THREE.Mesh(G.plane, fdxMat("tendrilW", fdxTENDRIL, i * 1.9));
    t.scale.set(1.3, 0.22, 1); const a = i / 5 * 6.28; t.position.set(Math.cos(a) * 0.3, -0.4, Math.sin(a) * 0.3); t.rotation.z = Math.PI / 2 + 0.4; t.rotation.y = -a; grp.add(t); tendrils.push(t); }
  return fdxFx(1.4, [grp], (dt, age, k) => { const inK = Math.min(1, age / 0.18);
    body.material.uniforms.uP.value = k * 0.85; body.scale.set(0.4 * inK + k * 0.15, 0.55 * inK + k * 0.2, 0.4 * inK + k * 0.15);
    eye.material.uniforms.uP.value = Math.max(0, k - 0.35) / 0.65; eye.lookAt(camera ? camera.position : grp.position);
    flash.material.opacity = 0.9 * Math.max(0, 1 - k * 2.2);
    ring.scale.setScalar(0.4 + k * 7); ring.material.opacity = 0.85 * (1 - k); ring.lookAt(camera ? camera.position : grp.position);
    tendrils.forEach((t, i) => { t.material.uniforms.uP.value = Math.max(0, (age - 0.2) / 1.1); }); });
 } catch (e) { return fdxErr(e); } }
// Nightfall: the sweeping wall of darkness. p = start center, yaw = travel direction, dist/w/seconds
// follow the game's wave. Self-cleans at the end. Returns handle (no move needed - it advances itself).
function fdxNightfall(p, yaw, dist, w, seconds) { try { const G = fdxGeos(), grp = new THREE.Group();
  const W = w || 9, D = dist || 14, TTL = seconds || 2.5, dir = new THREE.Vector3(Math.sin(yaw || 0), 0, Math.cos(yaw || 0));
  grp.position.set(p.x, 0, p.z); grp.rotation.y = yaw || 0;
  const wall = new THREE.Mesh(G.bigplane, fdxMat("sigil", fdxSIGIL, 1.4)); wall.scale.set(W, 4.2, 1); wall.position.y = 2.1; grp.add(wall);
  const wall2 = new THREE.Mesh(G.bigplane, wall.material); wall2.scale.set(W, 4.2, 1); wall2.position.y = 2.1; wall2.rotation.y = Math.PI; grp.add(wall2);
  const base = new THREE.Mesh(G.plane, fdxBasic(0x12041f, 0.75, false)); base.rotation.x = -Math.PI / 2; base.scale.set(W, 2.2, 1); base.position.y = 0.05; grp.add(base);
  const crest = new THREE.Mesh(G.plane, fdxMat("tendrilN", fdxTENDRIL, 6.1)); crest.scale.set(W, 0.7, 1); crest.position.y = 4.1; grp.add(crest);
  const h = fdxFx(TTL, [grp], (dt, age, k) => { const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
    grp.position.set(p.x + dir.x * D * e, 0, p.z + dir.z * D * e);
    const fade = Math.min(1, age / 0.25) * Math.min(1, (TTL - age) / 0.4);
    wall.material.uniforms.uA.value = fade; base.material.opacity = 0.75 * fade; crest.material.uniforms.uA.value = 0.7 * fade;
    wall.material.uniforms.uSeed.value += dt * 0.35; });
  return h; } catch (e) { return fdxErr(e); } }
// ---- END FADE FX ----
