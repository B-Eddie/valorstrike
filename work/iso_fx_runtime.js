// ---- ISO FX ----
// Iso ability visuals, reference-grounded in the wiki showcase clips viewed 2026-11-04
// (wiki.playvalorant.com/en-us/images/Contingency_Showcase.mp4, Undercut_Showcase.mp4,
// Double_Tap_Showcase.mp4, Kill_Contract_Showcase.mp4; ability pages wiki.playvalorant.com/en-us/Contingency,
// /Undercut, /Double_Tap, /Kill_Contract). Procedural approximation, not extracted game assets.
//   Contingency: tall translucent violet wall of glowing hex cells, bright lavender hex edges, rises then advances.
//   Undercut: violet orb bolt with crackling trail -> dark violet jagged burst + lingering suppression wisp ring.
//   Double Tap: violet energy pillars rise around Iso; shield hold = orbiting hex plates + faint bubble; break = shard scatter.
//   Kill Contract: violet capture tendrils on the caught duelist; the pocket arena as dark platform + bright
//     hex-lattice energy walls + violet dome sky with flickering blue lightning arcs.
// Pure client fx: damage, timing and sound stay in the caller. Self-cleaning via the shared tick.
// Installed after ability_fp_runtime.js. Globals used (read-only): THREE, scene, camera, player, xE.
//
// Contract (integrator owns wiring):
//   Entries take world positions (THREE.Vector3 or {x,y,z}) and return a handle {fx, end()} or null on error.
//   h.end() stops the effect early (row dropped, round reset, shield consumed); per-effect materials and
//   geometries are disposed recursively. isoxEnd(h) does the same. isoxReset() ends everything (round reset).
//   isoxUseGameTick() then isoxTick(dt) drives all effects with the game dt; without it a rAF pump runs
//   while effects exist (client dt caps apply there, not wall time).
//   Movers: pass speed>0 to self-advance with game dt (offline mirror of the server tick), or speed:0 and
//   drive handle.setPos(x,y,z) from snapshot rows (online).
var isoxU = { value: 0 }, isoxLive = [], isoxPumpOn = false, isoxGT = null, isoxGeo = null, isoxProg = {};
function isoxNow() { try { return performance.now() / 1000; } catch (e) { return Date.now() / 1000; } }
function isoxGeos() { if (isoxGeo) return isoxGeo; isoxGeo = {
  sph: new THREE.SphereGeometry(1, 24, 16),
  ring: new THREE.RingGeometry(0.9, 1, 48),
  plane: new THREE.PlaneGeometry(1, 1),
  box: new THREE.BoxGeometry(1, 1, 1),
  cyl: new THREE.CylinderGeometry(1, 1, 1, 48, 1, true) }; return isoxGeo; }
function isoxShader(k, frag, opts) { if (isoxProg[k]) return isoxProg[k]; const m = new THREE.ShaderMaterial(Object.assign({
  uniforms: { uT: isoxU, uP: { value: 0 }, uSeed: { value: 0 }, uA: { value: 1 } },
  vertexShader: "uniform float uT;uniform float uP;uniform float uSeed;varying vec3 vN;varying vec3 vV;varying vec3 vP;varying vec2 vUv;void main(){vUv=uv;vP=position;vec4 mv=modelViewMatrix*vec4(position,1.0);vV=-mv.xyz;vN=normalMatrix*normal;gl_Position=projectionMatrix*mv;}",
  fragmentShader: frag, transparent: true, depthWrite: false, side: THREE.DoubleSide }, opts || {}));
  m.userData.isox = k; isoxProg[k] = m; return m; }
// hex-cell energy field: translucent violet fill, bright lavender-white hex edges, slow upward drift
const isoxHEX = "uniform float uT;uniform float uP;uniform float uSeed;uniform float uA;varying vec3 vN;varying vec3 vV;varying vec3 vP;varying vec2 vUv;\n" +
  "vec2 h22(vec2 p){vec3 q=fract(vec3(p.xyx)*vec3(0.1031,0.1030,0.0973));q+=dot(q,q.yzx+33.33);return fract((q.xx+q.yz)*q.zy);}\n" +
  "void main(){vec2 uv=vec2(vUv.x*6.5,vUv.y*3.4+uSeed);\n" +
  "uv+=0.38*vec2(sin(uv.y*1.9+uT*0.45+uSeed*3.0),sin(uv.x*2.2-uT*0.35+uSeed));\n" +
  "vec2 g=floor(uv),f=fract(uv);float f1=8.0,f2=8.0;\n" +
  "for(int j=-1;j<=1;j++){for(int i=-1;i<=1;i++){vec2 o=vec2(float(i),float(j));vec2 r=o+h22(g+o)-f;float d=dot(r,r);if(d<f1){f2=f1;f1=d;}else if(d<f2){f2=d;}}}\n" +
  "float e=sqrt(f2)-sqrt(f1);\n" +
  "float wall=1.0-smoothstep(0.015,0.09,e);\n" +
  "float inner=1.0-smoothstep(0.012,0.05,abs(e-0.30-0.06*sin(f1*25.0)));\n" +
  "float pulse=0.7+0.3*sin(uT*2.1+f1*16.0+uSeed*5.0);\n" +
  "vec3 fill=vec3(0.24,0.13,0.78)*(0.55+0.45*pulse);\n" +
  "vec3 c=fill+vec3(0.78,0.68,1.0)*(wall*0.95+inner*0.4*pulse);\n" +
  "float a=(0.52+0.43*wall+0.18*inner)*uA*(1.0-uP);\n" +
  "if(a<0.004)discard;gl_FragColor=vec4(c,a);}";
// bright arena lattice: white-lavender hex lattice, strong edges, deep violet fill, slow scroll + shimmer
const isoxLATTICE = "uniform float uT;uniform float uP;uniform float uSeed;uniform float uA;varying vec3 vN;varying vec3 vV;varying vec3 vP;varying vec2 vUv;\n" +
  "float hexDist(vec2 p){p=abs(p);return max(dot(p,normalize(vec2(1.0,1.73))),p.x);}\n" +
  "vec2 hexGv(vec2 uv){vec2 r=vec2(1.0,1.73);vec2 h=r*0.5;vec2 a=mod(uv,r)-h;vec2 b=mod(uv-h,r)-h;return dot(a,a)<dot(b,b)?a:b;}\n" +
  "void main(){vec2 uv=vec2(vUv.x*7.5,vUv.y*1.05+uT*0.10+uSeed);vec2 gv=hexGv(uv);float hd=hexDist(gv);\n" +
  "float edge=smoothstep(0.38,0.5,hd);float petal=0.5+0.5*sin(uT*1.4+uv.x*2.1+uv.y*4.0+uSeed*3.0);\n" +
  "vec3 fill=vec3(0.16,0.10,0.38)*(0.7+0.3*petal);vec3 edgeC=mix(vec3(0.72,0.64,1.0),vec3(0.95,0.93,1.0),petal);\n" +
  "vec3 c=mix(fill,edgeC,edge);\n" +
  "float a=(0.42+0.55*edge)*uA*(1.0-uP);\n" +
  "if(a<0.004)discard;gl_FragColor=vec4(c,a);}";
// arena floor: bright smooth violet-blue energy surface, soft irregular veins (reference: KC arena floor is bright and liquid, not a dark grid)
const isoxFLOOR = "uniform float uT;uniform float uP;uniform float uSeed;uniform float uA;varying vec3 vN;varying vec3 vV;varying vec3 vP;varying vec2 vUv;\n" +
  "vec2 h22(vec2 p){vec3 q=fract(vec3(p.xyx)*vec3(0.1031,0.1030,0.0973));q+=dot(q,q.yzx+33.33);return fract((q.xx+q.yz)*q.zy);}\n" +
  "void main(){vec2 uv=vec2(vUv.x*6.5,vUv.y*3.4+uSeed);\n" +
  "uv+=0.5*vec2(sin(uv.y*1.6+uT*0.4+uSeed*3.0),sin(uv.x*1.9-uT*0.3+uSeed));\n" +
  "vec2 g=floor(uv),f=fract(uv);float f1=8.0,f2=8.0;\n" +
  "for(int j=-1;j<=1;j++){for(int i=-1;i<=1;i++){vec2 o=vec2(float(i),float(j));vec2 r=o+h22(g+o)-f;float d=dot(r,r);if(d<f1){f2=f1;f1=d;}else if(d<f2){f2=d;}}}\n" +
  "float e=sqrt(f2)-sqrt(f1);\n" +
  "float wall=1.0-smoothstep(0.0,0.07,e);\n" +
  "float pulse=0.7+0.3*sin(uT*1.6+f1*14.0+uSeed*4.0);\n" +
  "vec3 c=vec3(0.42,0.36,1.0)*(0.68+0.32*pulse)+vec3(0.9,0.85,1.0)*wall*0.28;\n" +
  "float a=(0.80+0.15*wall)*uA*(1.0-uP);\n" +
  "if(a<0.004)discard;gl_FragColor=vec4(c,a);}";
// dome sky: deep violet night with slow cloud swirl and a faint fresnel horizon glow
const isoxDOME = "uniform float uT;uniform float uP;uniform float uSeed;uniform float uA;varying vec3 vN;varying vec3 vV;varying vec3 vP;varying vec2 vUv;\n" +
  "float hash(vec3 p){p=fract(p*.3183099+vec3(.11,.23,.37));p*=17.0;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}\n" +
  "float noise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);}\n" +
  "void main(){vec3 q=normalize(vP);float n=noise(q*4.0+vec3(uT*0.03,-uT*0.02,uT*0.025))*0.6+noise(q*9.0-vec3(0.0,uT*0.02,0.0))*0.4;\n" +
  "vec3 c=mix(vec3(0.030,0.020,0.075),vec3(0.10,0.06,0.22),n);\n" +
  "float hor=pow(1.0-abs(q.y),6.0);c+=vec3(0.30,0.20,0.62)*hor*0.55;\n" +
  "gl_FragColor=vec4(c,1.0-uP);}";
// jagged electric arc: bright violet-white core with dark violet body, vertical falloff (used for Undercut + dome lightning)
const isoxARC = "uniform float uT;uniform float uP;uniform float uSeed;uniform float uA;varying vec3 vN;varying vec3 vV;varying vec3 vP;varying vec2 vUv;\n" +
  "void main(){float x=vUv.x,y=vUv.y;\n" +
  "float wob=0.5+0.16*sin(y*21.0+uSeed*9.0)+0.09*sin(y*47.0-uT*13.0);\n" +
  "float d=abs(x-wob);float core=smoothstep(0.045,0.0,d);float body=smoothstep(0.16,0.02,d);\n" +
  "float ends=smoothstep(0.0,0.10,y)*(1.0-smoothstep(0.86,1.0,y));\n" +
  "vec3 c=vec3(0.42,0.24,0.95)*body+vec3(0.95,0.90,1.0)*core;\n" +
  "float a=(body*0.7+core)*ends*uA*(1.0-uP);\n" +
  "if(a<0.004)discard;gl_FragColor=vec4(c,a);}";
// violet tendril (Kill Contract capture): dark violet body, lavender fresnel edge, wispy vertical falloff
const isoxTENDRIL = "uniform float uT;uniform float uP;uniform float uSeed;uniform float uA;varying vec3 vN;varying vec3 vV;varying vec3 vP;varying vec2 vUv;\n" +
  "void main(){float f=pow(1.0-abs(dot(normalize(vN),normalize(vV))),1.6);\n" +
  "float w=sin(vUv.y*9.0+uT*3.0+uSeed*7.0)*sin(vUv.x*5.0-uT*2.0+uSeed*3.0);\n" +
  "vec3 c=mix(vec3(0.10,0.05,0.24),vec3(0.55,0.40,1.0),f)*(0.85+0.3*w);c+=vec3(0.72,0.60,1.0)*f*f*0.4;\n" +
  "float width=0.24*(1.0-vUv.y*0.65);float curve=0.5+0.10*sin(vUv.y*7.0+uT*2.0+uSeed);\n" +
  "float edge=1.0-smoothstep(width*0.35,width,abs(vUv.x-curve));\n" +
  "float a=edge*smoothstep(0.0,0.18,vUv.y)*(1.0-smoothstep(0.55,1.0,vUv.y))*(0.55+0.45*w)*(1.0-uP)*uA;\n" +
  "if(a<0.003)discard;gl_FragColor=vec4(c,a*0.9);}";
function isoxMat(k, shader, seed, opts) { const m = isoxShader(k, shader, opts).clone(); m.uniforms.uT = isoxU; if (seed !== undefined) m.uniforms.uSeed.value = seed; return m; }
function isoxBasic(c, o, add) { return new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: o, depthWrite: false, blending: add ? THREE.AdditiveBlending : THREE.NormalBlending, side: THREE.DoubleSide }); }
function isoxPush(fx) { if (isoxLive.length > 24) { const o = isoxLive.shift(); try { o.done(); } catch (e) {} } isoxLive.push(fx); if (!isoxGT && !isoxPumpOn) { isoxPumpOn = true; isoxPump.last = isoxNow(); requestAnimationFrame(isoxPump); } return fx; }
function isoxPump() { if (isoxGT) { isoxPumpOn = false; return; } const now = isoxNow(), dt = Math.min(0.1, Math.max(0.0005, now - (isoxPump.last || now))); isoxPump.last = now; isoxU.value += dt;
  for (let i = isoxLive.length - 1; i >= 0; i--) { const fx = isoxLive[i]; fx.age += dt; try { fx.tick(dt, fx.age, Math.min(1, fx.age / fx.ttl)); } catch (e) { try { xE(e); } catch (e2) {} }
    if (fx.age >= fx.ttl) { try { fx.done(); } catch (e) {} isoxLive.splice(i, 1); } }
  if (isoxLive.length) requestAnimationFrame(isoxPump); else isoxPumpOn = false; }
function isoxUseGameTick() { isoxGT = true; isoxPumpOn = false; }
function isoxTick(dt) { isoxU.value += dt; for (let i = isoxLive.length - 1; i >= 0; i--) { const fx = isoxLive[i]; fx.age += dt; try { fx.tick(dt, fx.age, Math.min(1, fx.age / fx.ttl)); } catch (e) { try { xE(e); } catch (e2) {} } if (fx.age >= fx.ttl) { try { fx.done(); } catch (e) {} isoxLive.splice(i, 1); } } }
function isoxEnd(h) { if (!h || !h.fx) return; const i = isoxLive.indexOf(h.fx); if (i >= 0) isoxLive.splice(i, 1); try { h.fx.done(); } catch (e) {} }
function isoxFx(ttl, objs, tick, done, geos) { const fx = { age: 0, ttl, objs, tick, done: done || function () { objs.forEach((o) => { try { scene.remove(o); o.traverse((m) => { if (m.material && m.material.dispose) m.material.dispose(); }); } catch (e) {} }); if (geos) geos.forEach((g) => { try { g.dispose(); } catch (e) {} }); } }; objs.forEach((o) => scene.add(o)); isoxPush(fx); return { fx, end: function () { isoxEnd(this); } }; }
function isoxV3(p) { return p && p.isVector3 ? p : new THREE.Vector3(p.x || 0, p.y || 0, p.z || 0); }
function isoxNearPlayer(p, d) { try { return player && Math.hypot(player.x - p.x, player.z - p.z) < d; } catch (e) { return false; } }
// ---- Contingency: the moving hex-cell vision wall ----
function isoxContingency(o, d, opts) { try { const G = isoxGeos(); opts = opts || {};
  const W = opts.width || 8, H = opts.height || 4.2, speed = opts.speed == null ? 6 : opts.speed;
  const ttl = opts.life || (speed > 0 ? 5 : 1e9);
  const dir = isoxV3(d); dir.y = 0; dir.normalize();
  const grp = new THREE.Group(); grp.position.copy(isoxV3(o)); grp.position.y = 0;
  grp.rotation.y = Math.atan2(-dir.x, -dir.z) + Math.PI; // plane +Z faces back along the cast direction
  const geo = new THREE.PlaneGeometry(W, H);
  const wall = new THREE.Mesh(geo, isoxMat("hex", isoxHEX, Math.random() * 10)); wall.position.y = H / 2; grp.add(wall);
  const base = new THREE.Mesh(G.plane, isoxBasic(0x9a86ff, 0.55, true)); base.rotation.x = -Math.PI / 2; base.scale.set(W, 0.5, 1); base.position.y = 0.05; grp.add(base);
  const rail = new THREE.Mesh(G.box, isoxBasic(0xc4b6ff, 0.8, true)); rail.scale.set(W, 0.07, 0.07); rail.position.y = H; grp.add(rail);
  const fx = isoxFx(ttl, [grp], (dt, age, k) => {
    const rise = Math.min(1, age / 0.45), die = Math.max(0, (age - (ttl - 0.4)) / 0.4);
    wall.scale.y = Math.max(0.02, rise); wall.position.y = H / 2 * rise;
    rail.position.y = H * rise; base.material.opacity = 0.55 * rise;
    wall.material.uniforms.uP.value = die; rail.material.opacity = 0.8 * (1 - die);
    if (speed > 0) { grp.position.x += dir.x * speed * dt; grp.position.z += dir.z * speed * dt; }
  }, undefined, [geo]);
  fx.setPos = function (x, y, z) { grp.position.set(x, 0, z); };
  return fx; } catch (e) { try { window.isoxErr = String(e && e.stack || e).slice(0, 300); xE(e); } catch (e2) {} return null; } }
// ---- Undercut: bolt flight + suppression burst ----
function isoxUndercut(o, p, opts) { try { const G = isoxGeos(); opts = opts || {};
  const from = isoxV3(o), to = isoxV3(p), flyT = opts.flyT || 0.22;
  const orb = new THREE.Group(); // drifting vertical energy wisp (reference: ghost-like violet wisp, not an orb)
  const core = new THREE.Mesh(G.sph, isoxBasic(0xd9c8ff, 0.9, true)); core.scale.setScalar(0.09); orb.add(core);
  const shell = new THREE.Mesh(G.sph, isoxBasic(0x5a2ee8, 0.5, true)); shell.scale.setScalar(0.2); orb.add(shell);
  const arcs = []; for (let i = 0; i < 2; i++) { const a = new THREE.Mesh(G.plane, isoxMat("uw" + i, isoxARC, i * 2.7)); a.scale.set(0.55, 1.5, 1); a.rotation.y = i * Math.PI / 2; orb.add(a); arcs.push(a); }
  const trail = [];
  const R = opts.radius || 5;
  const ring = new THREE.Mesh(G.ring, isoxBasic(0x9a7aff, 0.85, true)); ring.rotation.x = -Math.PI / 2; ring.position.set(to.x, (to.y || 0) + 0.06, to.z); ring.scale.setScalar(0.01); ring.visible = false;
  const wisps = []; for (let i = 0; i < 4; i++) { const w = new THREE.Mesh(G.plane, isoxMat("ten" + i % 2, isoxTENDRIL, 3 + i * 1.9)); w.scale.set(0.8, 1.6, 1); w.visible = false; wisps.push(w); }
  const flash = new THREE.Mesh(G.sph, isoxBasic(0xe8dcff, 0.9, true)); flash.scale.setScalar(0.01); flash.position.copy(to); flash.visible = false;
  const spokes = []; for (let i = 0; i < 6; i++) { const s = new THREE.Mesh(G.plane, isoxMat("arc2", isoxARC, 7 + i * 1.3)); s.visible = false; spokes.push(s); }
  const objs = [orb, ring, flash].concat(wisps, spokes);
  let lastTrail = 0;
  const fx = isoxFx(flyT + 1.9, objs, (dt, age) => {
    if (age < flyT) { const k = age / flyT;
      orb.position.lerpVectors(from, to, k); orb.position.y += Math.sin(k * Math.PI) * 0.5;
      orb.rotation.y += dt * 5; arcs.forEach((a, i) => { a.material.uniforms.uP.value = 0.15 + 0.25 * Math.sin(isoxU.value * 9 + i * 2.2); });
      if (age - lastTrail > 0.025) { lastTrail = age; const t = new THREE.Mesh(G.sph, isoxBasic(0x8a5aff, 0.32, true)); t.scale.setScalar(0.05); t.position.copy(orb.position); scene.add(t); trail.push({ m: t, a: 0 }); fx.fx.objs.push(t); }
    } else { const ba = age - flyT;
      if (orb.visible) { orb.visible = false; ring.visible = flash.visible = true; wisps.forEach((w) => w.visible = true); spokes.forEach((s) => s.visible = true);
        wisps.forEach((w, i) => { const a = i / 4 * Math.PI * 2; w.position.set(to.x + Math.cos(a) * R * 0.5, (to.y || 0) + 0.8, to.z + Math.sin(a) * R * 0.5); w.rotation.y = -a + Math.PI / 2; });
        spokes.forEach((s, i) => { const a = i / 6 * Math.PI * 2; s.position.set(to.x + Math.cos(a) * 0.7, (to.y || 0) + 0.9, to.z + Math.sin(a) * 0.7); s.rotation.y = -a + Math.PI / 2; s.scale.set(0.7, 1.8, 1); }); }
      const bs = Math.min(1, ba / 0.45);
      flash.scale.setScalar(0.15 + bs * 0.9); flash.material.opacity = 0.75 * Math.max(0, 1 - ba / 0.3);
      ring.scale.setScalar(0.01 + bs * R); ring.material.opacity = 0.85 * (1 - bs);
      spokes.forEach((s, i) => { s.material.uniforms.uP.value = Math.min(1, ba / 0.5); s.scale.y = 1.8 * (1 - bs * 0.4); });
      const li = Math.max(0, (ba - 0.5) / 1.3); // lingering suppression marker
      wisps.forEach((w, i) => { w.material.uniforms.uP.value = Math.min(1, ba / 1.8); w.position.y = (to.y || 0) + 0.8 + Math.sin(isoxU.value * 2 + i) * 0.08; });
      ring.material.opacity += 0; }
    for (let i = trail.length - 1; i >= 0; i--) { const t = trail[i]; t.a += dt; t.m.material.opacity = 0.5 * Math.max(0, 1 - t.a / 0.3); t.m.scale.setScalar(0.07 * (1 - t.a / 0.45)); if (t.a > 0.45) { scene.remove(t.m); t.m.material.dispose(); trail.splice(i, 1); } }
  });
  return fx; } catch (e) { try { window.isoxErr = String(e && e.stack || e).slice(0, 300); xE(e); } catch (e2) {} return null; } }
// ---- Double Tap ----
function isoxDoubleTap(p) { try { const G = isoxGeos(), at = isoxV3(p);
  const grp = new THREE.Group(); grp.position.copy(at);
  const pillars = []; for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2, pl = new THREE.Mesh(G.plane, isoxMat("hex", isoxHEX, i * 1.7)); pl.scale.set(0.5, 2.3, 1); pl.position.set(Math.cos(a) * 0.85, 1.15, Math.sin(a) * 0.85); pl.rotation.y = -a + Math.PI / 2; grp.add(pl); pillars.push(pl); }
  const flash = new THREE.Mesh(G.sph, isoxBasic(0xcab8ff, 0.8, true)); flash.scale.setScalar(0.3); flash.position.y = 1.1; grp.add(flash);
  const motes = []; for (let i = 0; i < 10; i++) { const m = new THREE.Mesh(G.sph, isoxBasic(0xb9a0ff, 0.8, true)); m.scale.setScalar(0.03 + Math.random() * 0.03); m.position.set((Math.random() - 0.5) * 1.4, 0.1, (Math.random() - 0.5) * 1.4); m.userData.v = 1.4 + Math.random() * 1.6; grp.add(m); motes.push(m); }
  return isoxFx(0.85, [grp], (dt, age, k) => {
    pillars.forEach((pl, i) => { pl.material.uniforms.uP.value = k; pl.scale.y = 2.3 * Math.min(1, age / 0.25); });
    flash.material.opacity = 0.8 * Math.max(0, 1 - age / 0.3); flash.scale.setScalar(0.3 + age * 1.2);
    motes.forEach((m) => { m.position.y += m.userData.v * dt; m.material.opacity = 0.8 * (1 - k); });
  }); } catch (e) { try { window.isoxErr = String(e && e.stack || e).slice(0, 300); xE(e); } catch (e2) {} return null; } }
// persistent shield hold: orbiting hex plates + faint bubble. getPos() -> Vector3-like each tick (or fixed point).
function isoxShieldHold(getPos) { try { const G = isoxGeos();
  const grp = new THREE.Group();
  // PROTECTIVE body shield only. The destructible energy orb is a SEPARATE visual (isoxFocusOrb):
  // per the wiki it spawns above a killed enemy's corpse, never above Iso. Do not merge the two.
  const bubble = new THREE.Mesh(G.sph, isoxBasic(0x7a4dff, 0.13, true)); bubble.scale.setScalar(0.82); bubble.position.y = 1.0; grp.add(bubble);
  const lat = new THREE.Mesh(G.sph, isoxMat("lat", isoxLATTICE, 4.7)); lat.scale.setScalar(0.84); lat.position.y = 1.0; lat.material.uniforms.uA.value = 0.3; grp.add(lat);
  const plates = []; for (let i = 0; i < 3; i++) { const pl = new THREE.Mesh(G.cyl, isoxMat("lat", isoxLATTICE, i * 2.1)); pl.scale.set(0.16, 0.02, 0.16); grp.add(pl); plates.push(pl); }
  const fx = isoxFx(1e9, [grp], (dt, age) => { let p = null; try { p = typeof getPos === "function" ? getPos() : getPos; } catch (e) {}
    if (p) grp.position.set(p.x, (p.y || 0) - 0.0, p.z);
    plates.forEach((pl, i) => { const a = isoxU.value * 1.6 + i * (Math.PI * 2 / 3); pl.position.set(Math.cos(a) * 0.62, 1.0 + Math.sin(isoxU.value * 2.2 + i * 2) * 0.28, Math.sin(a) * 0.62); pl.rotation.y = a; });
    lat.rotation.y = isoxU.value * 0.6;
    bubble.material.opacity = 0.13 + 0.03 * Math.sin(isoxU.value * 3.1);
  });
  fx.breakNow = function () { try { isoxShieldBreak(grp.position); } catch (e) {} fx.end(); };
  return fx; } catch (e) { try { window.isoxErr = String(e && e.stack || e).slice(0, 300); xE(e); } catch (e2) {} return null; } }
function isoxShieldBreak(p) { try { const G = isoxGeos(), at = isoxV3(p);
  const grp = new THREE.Group(); grp.position.copy(at);
  const shards = []; for (let i = 0; i < 8; i++) { const s = new THREE.Mesh(G.cyl, isoxMat("lat", isoxLATTICE, 11 + i)); s.scale.set(0.12, 0.015, 0.12); s.position.y = 1.0; s.userData = { a: i / 8 * Math.PI * 2, v: 2.5 + Math.random() * 2, vy: 1 + Math.random() * 2 }; grp.add(s); shards.push(s); }
  const flash = new THREE.Mesh(G.sph, isoxBasic(0xf0e8ff, 0.95, true)); flash.scale.setScalar(0.4); flash.position.y = 1.0; grp.add(flash);
  return isoxFx(0.6, [grp], (dt, age, k) => {
    shards.forEach((s) => { const u = s.userData; s.position.x += Math.cos(u.a) * u.v * dt; s.position.z += Math.sin(u.a) * u.v * dt; s.position.y += u.vy * dt - 6 * age * dt; s.rotation.x += dt * 7; s.rotation.z += dt * 5; s.material.uniforms.uP.value = k; });
    flash.scale.setScalar(0.4 + age * 2.2); flash.material.opacity = 0.95 * Math.max(0, 1 - age / 0.3);
  }); } catch (e) { try { window.isoxErr = String(e && e.stack || e).slice(0, 300); xE(e); } catch (e2) {} return null; } }
// Focus orb: DESTRUCTIBLE energy orb that spawns above a killed enemy's corpse (wiki.playvalorant.com/en-us/Double_Tap:
// "a destructible energy orb will immediately spawn above the location of the corpse that remains there for a brief
// period"). Iso shoots it to refresh Focus + gain the shield; enemies can destroy it to deny. Distinct from the
// protective body shield (isoxShieldHold) - never attach this orb to the player.
function isoxFocusOrb(p, opts) { try { const G = isoxGeos(); opts = opts || {};
  const grp = new THREE.Group(); grp.position.set(p.x || 0, (p.y || 0) + 1.5, p.z || 0);
  const core = new THREE.Mesh(G.sph, isoxBasic(0xc9b2ff, 0.95, true)); core.scale.setScalar(0.10); grp.add(core);
  const shell = new THREE.Mesh(G.sph, isoxBasic(0x5a2ee8, 0.55, true)); shell.scale.setScalar(0.19); grp.add(shell);
  const ring = new THREE.Mesh(G.ring, isoxBasic(0x9a7aff, 0.85, true)); ring.scale.setScalar(0.26); grp.add(ring);
  const sparks = []; for (let i = 0; i < 3; i++) { const sp = new THREE.Mesh(G.sph, isoxBasic(0xb9a0ff, 0.8, true)); sp.scale.setScalar(0.03); grp.add(sp); sparks.push(sp); }
  const ttl = opts.life || 3;
  return isoxFx(ttl, [grp], (dt, age, k) => {
    grp.position.y += Math.sin(isoxU.value * 2.2) * 0.15 * dt;
    ring.rotation.x = -Math.PI / 2 + 0.5 * Math.sin(isoxU.value * 1.8); ring.rotation.z = isoxU.value * 0.9;
    core.scale.setScalar(0.10 + 0.02 * Math.sin(isoxU.value * 6.5));
    sparks.forEach((sp, i) => { const a = isoxU.value * 2.4 + i * 2.1; sp.position.set(Math.cos(a) * 0.24, Math.sin(isoxU.value * 3 + i) * 0.12, Math.sin(a) * 0.24); sp.material.opacity = 0.8 * (1 - k); });
    const fade = Math.max(0, (age - (ttl - 0.4)) / 0.4);
    core.material.opacity = 0.95 * (1 - fade); shell.material.opacity = 0.55 * (1 - fade); ring.material.opacity = 0.85 * (1 - fade);
  }); } catch (e) { try { window.isoxErr = String(e && e.stack || e).slice(0, 300); xE(e); } catch (e2) {} return null; } }
// First-person shield indicator: violet hex-lattice vignette at the screen edges (reference: Double Tap active
// first-person view frames the screen borders in glowing hex panels). Attach only on the shielded player's client.
function isoxShieldVignette() { try {
  const grp = new THREE.Group();
  const panels = [];
  for (const sgn of [-1, 1]) { const pg = new THREE.PlaneGeometry(0.17, 1.7); const uv = pg.attributes.uv; for (let i = 0; i < uv.count; i++) { uv.setX(i, uv.getX(i) * 2); uv.setY(i, uv.getY(i) * 9); } const pl = new THREE.Mesh(pg, isoxMat("lat", isoxLATTICE, 8 + sgn));
    pl.position.set(sgn * 0.96, 0, -0.9); pl.rotation.y = -sgn * 0.22; pl.material.uniforms.uA.value = 0.45; grp.add(pl); panels.push(pl); }
  camera.add(grp); if (!camera.parent) scene.add(camera);
  const fx = { age: 0, ttl: 1e9, objs: [], tick: function (dt, age) { panels.forEach((pl, i) => { pl.material.uniforms.uP.value = 0; pl.position.y = Math.sin(isoxU.value * 1.3 + i * 2) * 0.03; }); },
    done: function () { try { camera.remove(grp); grp.traverse((m) => { if (m.material && m.material.dispose) m.material.dispose(); if (m.geometry && m.geometry.dispose) m.geometry.dispose(); }); } catch (e) {} } };
  isoxPush(fx);
  return { fx, end: function () { isoxEnd(this); } }; } catch (e) { try { window.isoxErr = String(e && e.stack || e).slice(0, 300); xE(e); } catch (e2) {} return null; } }
// ---- Kill Contract ----
function isoxKCCast(p) { try { const G = isoxGeos(), at = isoxV3(p);
  const grp = new THREE.Group(); grp.position.copy(at);
  const tendrils = []; for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2, t = new THREE.Mesh(G.plane, isoxMat("ten" + i % 2, isoxTENDRIL, i * 1.31)); t.scale.set(0.5, 2.2, 1); t.position.set(Math.cos(a) * 1.3, 1.1, Math.sin(a) * 1.3); t.rotation.y = -a + Math.PI / 2; t.userData.a = a; grp.add(t); tendrils.push(t); }
  const flash = new THREE.Mesh(G.sph, isoxBasic(0xd9c8ff, 0.9, true)); flash.scale.setScalar(0.2); flash.position.y = 1.1; grp.add(flash);
  return isoxFx(0.7, [grp], (dt, age, k) => {
    tendrils.forEach((t) => { const r = 1.3 * (1 - k * 0.85); t.position.x = Math.cos(t.userData.a) * r; t.position.z = Math.sin(t.userData.a) * r; t.material.uniforms.uP.value = k * 0.9; });
    flash.material.opacity = 0.9 * Math.max(0, 1 - age / 0.35); flash.scale.setScalar(0.2 + age * 1.4);
  }); } catch (e) { try { window.isoxErr = String(e && e.stack || e).slice(0, 300); xE(e); } catch (e2) {} return null; } }
function isoxKCCapture(p) { try { const G = isoxGeos(), at = isoxV3(p);
  const grp = new THREE.Group(); grp.position.copy(at);
  const tendrils = []; for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2, t = new THREE.Mesh(G.plane, isoxMat("ten" + i % 2, isoxTENDRIL, 5 + i * 1.31)); t.scale.set(1.0, 3.0, 1); t.position.set(Math.cos(a) * 0.7, 1.5, Math.sin(a) * 0.7); t.rotation.y = -a + Math.PI / 2; grp.add(t); tendrils.push(t); }
  const rings = []; for (let i = 0; i < 2; i++) { const r = new THREE.Mesh(G.ring, isoxBasic(0xb9a0ff, 0.8, true)); r.rotation.x = -Math.PI / 2; r.position.y = 0.1 + i * 0.5; grp.add(r); rings.push(r); }
  return isoxFx(1.1, [grp], (dt, age, k) => {
    grp.rotation.y += dt * 2.4;
    tendrils.forEach((t, i) => { t.material.uniforms.uP.value = Math.max(0, k - 0.15); t.scale.y = 3.0 * (0.5 + Math.min(1, age / 0.3) * 0.5); });
    rings.forEach((r, i) => { const u = (age * 1.4 + i * 0.5) % 1; r.position.y = 0.1 + u * 2.2; r.scale.setScalar(0.5 + u * 0.5); r.material.opacity = 0.8 * (1 - u) * (1 - k * k); });
  }); } catch (e) { try { window.isoxErr = String(e && e.stack || e).slice(0, 300); xE(e); } catch (e2) {} return null; } }
// The pocket arena shell. Mirrors work/agents18_runtime.js A18_ARENA_* placement (30x30 platform, 4 m walls,
// cover at [-6,-5] and [6,5]) so it can replace a18ArenaShell one-for-one: a18ArenaShell(ox) -> isoxDuelArena(ox),
// a18ArenaFree(g) -> h.end(). Persistent: the caller ends it when the duel row drops / the duel timer ends.
function isoxDuelArena(ox, opts) { try { const G = isoxGeos(); opts = opts || {};
  const HALF = 15, WALL_H = 4, COVER = [[-6, -5, 3, 2, 1.4], [6, 5, 3, 2, 1.4]];
  const grp = new THREE.Group(); grp.position.set(ox || 0, 0, 0);
  const geos = [];
  const floorGeo = new THREE.BoxGeometry(HALF * 2, 0.2, HALF * 2); geos.push(floorGeo);
  const floor = new THREE.Mesh(floorGeo, new THREE.MeshLambertMaterial({ color: 0x171426 })); floor.position.y = -0.1; grp.add(floor);
  const rimM = isoxBasic(0x9a86ff, 0.9, true);
  for (const [ex, ez, ew, ed] of [[0, -HALF + .1, HALF * 2, .18], [0, HALF - .1, HALF * 2, .18], [-HALF + .1, 0, .18, HALF * 2], [HALF - .1, 0, .18, HALF * 2]]) {
    const e = new THREE.Mesh(G.box, rimM); e.position.set(ex, .03, ez); e.scale.set(ew, .06, ed); grp.add(e); }
  const wallGeo = new THREE.PlaneGeometry(HALF * 2, WALL_H); geos.push(wallGeo);
  const walls = [];
  for (const [rx, rz, ry, sd] of [[0, -HALF, 0, 1], [0, HALF, 0, 2], [-HALF, 0, Math.PI / 2, 3], [HALF, 0, Math.PI / 2, 4]]) {
    const w = new THREE.Mesh(wallGeo, isoxMat("latw", isoxLATTICE, sd * 1.37)); w.position.set(rx, WALL_H / 2, rz); w.rotation.y = ry; w.material.uniforms.uA.value = 0.55; grp.add(w); walls.push(w);
    const rail = new THREE.Mesh(G.box, isoxBasic(0xd9cfff, 0.95, true)); rail.position.set(rx, WALL_H, rz); rail.rotation.y = ry; rail.scale.set(HALF * 2, .1, .1); grp.add(rail); }
  const flatGeo = new THREE.PlaneGeometry(HALF * 2, HALF * 2); geos.push(flatGeo);
  { const fuv = flatGeo.attributes.uv; for (let i = 0; i < fuv.count; i++) { fuv.setX(i, fuv.getX(i) * 4); fuv.setY(i, fuv.getY(i) * 4); } }
  const hexFloor = new THREE.Mesh(flatGeo, isoxMat("floor", isoxFLOOR, 9.1)); hexFloor.rotation.x = -Math.PI / 2; hexFloor.position.y = 0.02; hexFloor.material.uniforms.uA.value = 0.42; grp.add(hexFloor);
  const mist = new THREE.Mesh(G.cyl, isoxBasic(0x6a3ae0, 0.16, true)); mist.scale.set(HALF * 0.98, 1.4, HALF * 0.98); mist.position.y = 1.9; grp.add(mist);
  const domeGeo = new THREE.SphereGeometry(HALF * 1.55, 32, 18, 0, Math.PI * 2, 0, Math.PI / 2); geos.push(domeGeo);
  const dome = new THREE.Mesh(domeGeo, isoxMat("dome", isoxDOME, 0, { side: THREE.BackSide, transparent: false })); dome.position.y = 0; grp.add(dome);
  const arcs = []; for (let i = 0; i < 3; i++) { const a = new THREE.Mesh(G.plane, isoxMat("arc3", isoxARC, 20 + i * 3.3)); a.scale.set(2.2, 7, 1); a.position.set(Math.cos(i * 2.1) * 8, 9 + i * 1.5, Math.sin(i * 2.1) * 8); a.rotation.y = i * 2.1 + Math.PI / 2; a.material.uniforms.uA.value = 0; grp.add(a); arcs.push({ m: a, next: 1 + i * 0.8, on: 0 }); }
  const coverM = new THREE.MeshLambertMaterial({ color: 0x2a2440, emissive: 0x4a3a9a, emissiveIntensity: 0.5 });
  for (const [cx, cz, w, d, hh] of COVER) { const bg = new THREE.BoxGeometry(w, hh, d); geos.push(bg);
    const b = new THREE.Mesh(bg, coverM); b.position.set(cx, hh / 2, cz); grp.add(b);
    const eg = new THREE.EdgesGeometry(bg); geos.push(eg);
    const be = new THREE.LineSegments(eg, new THREE.LineBasicMaterial({ color: 0xb9a0ff, transparent: true, opacity: .7 })); be.position.copy(b.position); grp.add(be); }
  let arcT = 0;
  return isoxFx(1e9, [grp], (dt, age) => { arcT += dt;
    walls.forEach((w, i) => { w.material.uniforms.uP.value = 0; });
    arcs.forEach((a, i) => { a.next -= dt;
      if (a.next <= 0) { a.on = 0.14 + Math.random() * 0.1; a.next = 1.2 + Math.random() * 3.2; a.m.position.set(Math.cos(Math.random() * 6.28) * (6 + Math.random() * 6), 8 + Math.random() * 4, Math.sin(Math.random() * 6.28) * (6 + Math.random() * 6)); a.m.rotation.y = Math.random() * 6.28; }
      a.on -= dt; a.m.material.uniforms.uA.value = a.on > 0 ? 0.9 : 0; a.m.material.uniforms.uP.value = a.on > 0 ? 0 : 1; });
  }, undefined, geos); } catch (e) { try { window.isoxErr = String(e && e.stack || e).slice(0, 300); xE(e); } catch (e2) {} return null; } }
// ---- round reset / cancel hook: game logic calls this at its reset boundary ----
function isoxReset() { while (isoxLive.length) isoxEnd({ fx: isoxLive[0] }); }
// ---- END ISO FX ----
