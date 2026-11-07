// ---- OMEN FX ----
// Omen ability visuals (work/omen_fx_runtime.js), reference-grounded in the wiki showcase clips
// (wiki.playvalorant.com/en-us/images/Shrouded_Step_Showcase.mp4, Paranoia_Showcase.mp4,
// Dark_Cover_Showcase.mp4, From_the_Shadows_Showcase.mp4; frame sheets reviewed 2026-11-04).
// Procedural approximation, not extracted game assets. Main entries preserve game mechanics.
// p is world-space smoke centre for CoverDome/CoverAim; ground-space point for teleport.
// Paranoia t is elapsed seconds, optional. Returns handles accepted by omxEnd.
// Optional omxCoverAim(on,p,r) controls targeting. omxUseGameTick() then omxTick(dt)
// hands timing to game loop; otherwise a single rAF pump runs while effects exist.
// Shared geometry/programs persist; cloned per-effect materials are disposed recursively.
var omxU = { value: 0 }, omxLive = [], omxPumpOn = false, omxGT = null, omxGeo = null, omxProg = {};
function omxNow() { try { return performance.now() / 1000; } catch (e) { return Date.now() / 1000; } }
function omxGeos() { if (omxGeo) return omxGeo; omxGeo = {
  sph: new THREE.SphereGeometry(1, 26, 18),
  ring: new THREE.RingGeometry(0.74, 1, 48),
  torus: new THREE.TorusGeometry(1, 0.07, 10, 48),
  cone: new THREE.ConeGeometry(0.24, 1, 12, 6),
  plane: new THREE.PlaneGeometry(1, 1.6, 1, 6) }; return omxGeo; }
// shared shaders. uT = global clock, uP = effect progress 0..1, uSeed = per-mesh variation.
function omxShader(k, frag) { if (omxProg[k]) return omxProg[k]; const m = new THREE.ShaderMaterial({
  uniforms: { uT: omxU, uP: { value: 0 }, uSeed: { value: 0 }, uA: { value: 1 } },
  vertexShader: "uniform float uT;uniform float uP;uniform float uSeed;varying vec3 vN;varying vec3 vV;varying vec3 vP;varying vec2 vUv;void main(){vUv=uv;vec3 p=position;vP=p;vec4 mv=modelViewMatrix*vec4(p,1.0);vV=-mv.xyz;vN=normalMatrix*normal;gl_Position=projectionMatrix*mv;}",
  fragmentShader: frag, transparent: true, depthWrite: false, side: THREE.DoubleSide });
  m.userData.omx = k; omxProg[k] = m; return m; }
// dark shadow tendril: near-black navy body with a violet fresnel edge, wispy vertical falloff
const omxTENDRIL = "uniform float uT;uniform float uP;uniform float uSeed;uniform float uA;varying vec3 vN;varying vec3 vV;varying vec3 vP;varying vec2 vUv;void main(){float f=pow(1.0-abs(dot(normalize(vN),normalize(vV))),1.6);float w=sin(vUv.y*9.0+uT*3.0+uSeed*7.0)*sin(vUv.x*5.0-uT*2.0+uSeed*3.0);vec3 c=mix(vec3(0.030,0.033,0.086),vec3(0.36,0.31,1.0),f)*(0.85+0.3*w);c+=vec3(0.27,0.82,1.0)*f*f*0.35;float width=0.24*(1.0-vUv.y*0.65);float curve=0.5+0.10*sin(vUv.y*7.0+uT*2.0+uSeed);float edge=1.0-smoothstep(width*0.35,width,abs(vUv.x-curve));float a=edge*smoothstep(0.0,0.18,vUv.y)*(1.0-smoothstep(0.55,1.0,vUv.y))*(0.55+0.45*w)*(1.0-uP)*uA;if(a<0.003)discard;gl_FragColor=vec4(c,a*0.9);}";
// cyan-blue channel flame: bright core to transparent blue edge, flickering tip
const omxFLAME = "uniform float uT;uniform float uP;uniform float uSeed;varying vec3 vN;varying vec3 vV;varying vec3 vP;varying vec2 vUv;void main(){float w=sin(vUv.y*7.0-uT*9.0+uSeed)*0.5+0.5;float f=pow(1.0-abs(dot(normalize(vN),normalize(vV))),1.2);vec3 c=mix(vec3(0.62,0.91,1.0),vec3(0.16,0.45,0.85),vUv.y)+vec3(0.2,0.5,0.9)*f;float a=smoothstep(0.0,0.25,vUv.y)*(1.0-smoothstep(0.6,1.0,vUv.y))*(0.55+0.45*w)*(1.0-uP);gl_FragColor=vec4(c,a);}";
// paranoia wave body: deep violet, bright violet fresnel rim, faint cyan top edge, slow swirl
const omxWAVE = "uniform float uT;uniform float uP;uniform float uSeed;varying vec3 vN;varying vec3 vV;varying vec3 vP;varying vec2 vUv;void main(){float f=pow(1.0-abs(dot(normalize(vN),normalize(vV))),1.9);float w=sin(vP.x*2.1+uT*2.6)*sin(vP.y*2.7-uT*1.9)*sin(vP.z*1.7+uT*2.2);vec3 c=mix(vec3(0.10,0.05,0.22),vec3(0.42,0.26,0.95),f)*(0.88+0.24*w);c+=vec3(0.27,0.82,1.0)*pow(f,3.0)*0.5;float a=(0.62+0.3*f)*(1.0-uP);gl_FragColor=vec4(c,a);}";
// dark cover dome: opaque deep purple with slow swirl and a violet fresnel rim (transparent only while growing/dying)
const omxDOME = "uniform float uT;uniform float uP;uniform float uSeed;varying vec3 vN;varying vec3 vV;varying vec3 vP;varying vec2 vUv;\nfloat hash(vec3 p){p=fract(p*.3183099+vec3(.11,.23,.37));p*=17.0;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}\nfloat noise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);}\nfloat cloud(vec3 p){float n=0.0;float a=.54;for(int i=0;i<4;i++){n+=a*noise(p);p=p*2.03+vec3(5.1,1.7,9.2);a*=.48;}return n;}\nvoid main(){float facing=abs(dot(normalize(vN),normalize(vV)));float rim=pow(1.0-facing,7.0);vec3 q=vP*vec3(2.4,6.5,2.4)+vec3(uT*.055,-uT*.045,uT*.035);float warp=cloud(vP*3.2+vec3(0,uT*.045,0));q.y+=warp*2.8;float n=cloud(q);float sheets=cloud(q*vec3(.70,1.75,.70)+vec3(3.0,warp,7.0));float mist=smoothstep(.22,.76,n*.76+sheets*.24);vec3 c=mix(vec3(.072,.052,.133),vec3(.157,.134,.252),mist);c+=vec3(.020,.016,.030)*cloud(q*2.3);c=mix(c,vec3(.25,.27,.36),rim*.63);gl_FragColor=vec4(c,1.0-uP);}";
// ringed dome edge (Dark Cover targeting): transparent shell, bright blue fresnel rim
const omxEDGE = "uniform float uT;uniform float uP;uniform float uSeed;varying vec3 vN;varying vec3 vV;varying vec3 vP;varying vec2 vUv;void main(){float f=pow(1.0-abs(dot(normalize(vN),normalize(vV))),2.0);vec3 c=vec3(0.35,0.71,1.0)*(0.25+1.1*f);float a=0.08+0.75*f;gl_FragColor=vec4(c,a*(1.0-uP));}";
function omxMat(k, shader, seed) { const m = omxShader(k, shader).clone(); m.uniforms.uT = omxU; if (seed !== undefined) m.uniforms.uSeed.value = seed; return m; }
function omxBasic(c, o, add) { return new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: o, depthWrite: false, blending: add ? THREE.AdditiveBlending : THREE.NormalBlending, side: THREE.DoubleSide }); }
function omxPush(fx) { if (omxLive.length > 24) { const o = omxLive.shift(); try { o.done(); } catch (e) {} } omxLive.push(fx); if (!omxGT && !omxPumpOn) { omxPumpOn = true; omxPump.last = omxNow(); requestAnimationFrame(omxPump); } return fx; }
function omxPump() { if (omxGT) { omxPumpOn = false; return; } const now = omxNow(), dt = Math.min(0.1, Math.max(0.0005, now - (omxPump.last || now))); omxPump.last = now; omxU.value += dt;
  for (let i = omxLive.length - 1; i >= 0; i--) { const fx = omxLive[i]; fx.age += dt; const k = Math.min(1, fx.age / fx.ttl); try { fx.tick(dt, fx.age, k); } catch (e) { try { xE(e); } catch (e2) {} }
    if (fx.age >= fx.ttl) { try { fx.done(); } catch (e) {} omxLive.splice(i, 1); } }
  if (omxLive.length) requestAnimationFrame(omxPump); else omxPumpOn = false; }
function omxUseGameTick() { omxGT = true; omxPumpOn = false; } // integrator then calls omxTick(dt) per frame
function omxTick(dt) { omxU.value += dt; for (let i = omxLive.length - 1; i >= 0; i--) { const fx = omxLive[i]; fx.age += dt; try { fx.tick(dt, fx.age, Math.min(1, fx.age / fx.ttl)); } catch (e) { try { xE(e); } catch (e2) {} } if (fx.age >= fx.ttl) { try { fx.done(); } catch (e) {} omxLive.splice(i, 1); } } }
function omxEnd(h) { if (!h || !h.fx) return; const i = omxLive.indexOf(h.fx); if (i >= 0) omxLive.splice(i, 1); try { h.fx.done(); } catch (e) {} }
function omxFx(ttl, objs, tick, done) { const fx = { age: 0, ttl, objs, tick, done: done || function () { objs.forEach((o) => { try { scene.remove(o); o.traverse((m) => { if (m.material && m.material.dispose) m.material.dispose(); }); } catch (e) {} }); } }; objs.forEach((o) => scene.add(o)); omxPush(fx); return { fx, end: function () { omxEnd(this); } }; }
function omxNearPlayer(p, d) { try { return player && Math.hypot(player.x - p.x, player.z - p.z) < d; } catch (e) { return false; } }
// ---- full-screen veils (DOM, CSS injected once) ----
function omxCss() { if (document.getElementById("omxCss")) return; const s = document.createElement("style"); s.id = "omxCss"; s.textContent =
  ".omxV{position:fixed;inset:0;pointer-events:none;z-index:6;background-repeat:no-repeat;background-size:180% 180%;background-position:center;opacity:0;transition:opacity .18s}" +
  "@keyframes omxDriftA{0%{background-position:48% 48%,52% 52%,50% 50%}100%{background-position:52% 52%,48% 48%,51% 49%}}" +
  ".omxVStep{background:radial-gradient(60% 90% at 20% 30%,rgba(16,14,42,.96) 0%,rgba(16,14,42,0) 70%),radial-gradient(70% 80% at 80% 60%,rgba(8,7,22,.97) 0%,rgba(8,7,22,0) 72%),radial-gradient(90% 60% at 50% 90%,rgba(26,20,60,.9) 0%,rgba(26,20,60,0) 70%),rgba(7,6,18,.86);animation:omxDriftA 1.1s linear forwards}" +
  ".omxVShade{background:radial-gradient(70% 90% at 30% 40%,rgba(196,201,212,.9) 0%,rgba(196,201,212,0) 75%),radial-gradient(80% 80% at 75% 70%,rgba(176,182,196,.92) 0%,rgba(176,182,196,0) 70%),rgba(203,208,218,.72);animation:omxDriftA 2.3s linear forwards}" +
  ".omxVPhase{background:radial-gradient(120% 120% at 50% 50%,rgba(10,9,30,0) 30%,rgba(10,9,30,.66) 100%),radial-gradient(60% 90% at 20% 30%,rgba(24,20,64,.35) 0%,rgba(24,20,64,0) 70%),rgba(14,12,38,.52);transition:opacity .25s;animation:omxDriftA 9s linear infinite}" +
  ".omxVPhase.on{opacity:1}";
  (document.head || document.documentElement).appendChild(s); }
// Veil lifetime uses the same effect clock as meshes, so slowed game time stays aligned.
function omxVeil(kind,seconds) {try{omxCss();const d=document.createElement('div');d.className='omxV omxV'+kind;document.body.appendChild(d);d.style.opacity='1';
  const life=seconds|| (kind==='Shade'?2.5:1.15);
  return omxFx(life,[],(dt,age)=>{d.style.opacity=String(Math.min(1,Math.max(0,(life-age)/.25)));},()=>d.remove());
}catch(e){return null;}}
// ---- tendril burst, shared by Shrouded Step and From the Shadows ----
function omxTendrils(p, n, h, spread, converge, ttl) { const G = omxGeos(), grp = new THREE.Group(); grp.position.set(p.x, (p.y || 0), p.z);
  for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2 + i * 0.7, m = new THREE.Mesh(G.plane, omxMat("ten" + i % 3, omxTENDRIL, i * 1.31));
    m.position.set(Math.cos(a) * spread, h * 0.65, Math.sin(a) * spread); m.rotation.y = -a + Math.PI / 2; m.scale.set(0.5 + (i % 3) * 0.22, h, 1); m.userData.a = a; grp.add(m); }
  const flash = new THREE.Mesh(G.sph, omxBasic(0x45d0ff, 0.55, true)); flash.scale.setScalar(0.45); flash.position.y = 0.5; grp.add(flash);
  const fx = omxFx(ttl, [grp], (dt, age, k) => { grp.rotation.y += dt * (converge ? -2.6 : 2.2);
    grp.children.forEach((m) => { if (m === flash) return; const r = converge ? spread * (1 - k * 0.8) : spread * (0.4 + k); m.position.x = Math.cos(m.userData.a) * r; m.position.z = Math.sin(m.userData.a) * r; m.position.y = h * (0.65 + k * 0.35); m.material.uniforms.uP.value = k; m.rotation.z = (converge ? -1 : 1) * 0.35 * k; });
    flash.material.opacity = 0.55 * Math.max(0, 1 - age / 0.28); flash.scale.setScalar(0.45 + age * 1.1); });
  return fx; }
// ---- entries ----
function omxStepMark(p) { try { const G = omxGeos();
  const ring = new THREE.Mesh(G.ring, omxBasic(0x6a4cff, 0.85, true)); ring.rotation.x = -Math.PI / 2; ring.position.set(p.x, (p.y || 0) + 0.06, p.z); ring.scale.setScalar(0.9);
  const flame = new THREE.Mesh(G.cone, omxMat("flame", omxFLAME, 0.7)); flame.position.set(p.x, (p.y || 0) + 0.55, p.z);
  const core = new THREE.Mesh(G.sph, omxBasic(0x9fe8ff, 0.5, true)); core.scale.setScalar(0.16); core.position.set(p.x, (p.y || 0) + 0.3, p.z);
  return omxFx(1.5, [ring, flame, core], (dt, age, k) => { const fl = 1 + Math.sin(omxU.value * 11) * 0.1; flame.scale.set(fl, 1 + Math.sin(omxU.value * 7.3) * 0.14, fl); flame.rotation.y += dt * 3;
    ring.material.opacity = 0.85 * (0.6 + 0.4 * Math.sin(omxU.value * 6)) * (1 - k * k); ring.scale.setScalar(0.9 + 0.12 * Math.sin(omxU.value * 6));
    flame.material.uniforms.uP.value = k * k; core.material.opacity = 0.5 * (1 - k); }); } catch (e) { try { window.omxErr = String(e && e.stack || e).slice(0, 300); xE(e); } catch (e2) {} return null; } }
function omxStepVanish(p) { try { if (omxNearPlayer(p, 2.5)) omxVeil("Step"); return omxTendrils(p, 6, 2.1, 0.55, false, 0.9); } catch (e) { try { window.omxErr = String(e && e.stack || e).slice(0, 300); xE(e); } catch (e2) {} return null; } }
function omxStepArrive(p) { try { if (omxNearPlayer(p, 2.5)) omxVeil("Step"); return omxTendrils(p, 5, 1.7, 0.8, true, 0.7); } catch (e) { try { window.omxErr = String(e && e.stack || e).slice(0, 300); xE(e); } catch (e2) {} return null; } }
// Curved ribbon strips, not a filled ellipsoid. Shared parametric geometry has open gaps.
function omxRibbonGeo() { if (omxGeo.ribbon) return omxGeo.ribbon;
  const pos=[], uv=[], ind=[], N=48;
  for(let i=0;i<=N;i++) { const u=i/N, a=(-.55+u*1.05)*Math.PI;
    for(let j=0;j<2;j++) { const r=1+.045*Math.sin(u*11.0)+.025*Math.sin(u*29.0)+(j-.5)*.40*(.40+.60*Math.sin(u*Math.PI));
      pos.push(Math.cos(a)*r,Math.sin(a)*r,Math.sin(u*Math.PI)*.75+.13*Math.sin(u*23.0));uv.push(u,j); }
    if(i<N){const k=i*2;ind.push(k,k+1,k+2,k+1,k+3,k+2);} }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(ind);g.computeVertexNormals();omxGeo.ribbon=g;return g; }
const omxRIBBON="uniform float uT;uniform float uP;uniform float uSeed;varying vec2 vUv;void main(){float x=vUv.x,y=vUv.y;float edge=.075*sin(x*41.0+uSeed)+.04*sin(x*83.0-uT*2.0);float across=smoothstep(edge,edge+.12,y)*(1.0-smoothstep(.72+edge,1.0,y));float ends=smoothstep(0.0,.12,x)*(1.0-smoothstep(.73,1.0,x));vec2 hole=vec2((x-.38-.08*sin(uSeed*3.0))/.07,(y-.50)/.22);float tear=smoothstep(.75,1.12,length(hole));vec2 slit=vec2((x-.68)/.025,(y-.64)/.27);tear*=smoothstep(.7,1.05,length(slit));float ridge=pow(1.0-y,2.0);vec3 col=mix(vec3(.25,.14,.50),vec3(.10,.74,1.0),ridge);float a=across*ends*tear*(.80+.18*sin(x*13.0-uT*6.0+uSeed))*(1.0-uP);if(a<.003)discard;gl_FragColor=vec4(col,a);}";
function omxParanoiaBolt(o,d,t) { try { const G=omxGeos(), dir=new THREE.Vector3(d.x,d.y||0,d.z).normalize(),origin=new THREE.Vector3(o.x,o.y,o.z);
  const grp=new THREE.Group();grp.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),dir);
  const ribbons=[]; for(let i=0;i<3;i++){ const m=new THREE.Mesh(omxRibbonGeo(),omxMat('ribbon',omxRIBBON,i));m.scale.set(2.2-i*.22,1.35+i*.12,1);m.rotation.z=i*Math.PI*.67;m.position.z=-i*.40;grp.add(m);ribbons.push(m); }
  const core=new THREE.Mesh(G.sph,omxBasic(0x43d8ff,.9,true));core.scale.setScalar(.07);grp.add(core);
  const glow=new THREE.Mesh(G.sph,omxBasic(0x257de8,.10,true));glow.scale.setScalar(.20);grp.add(glow);
  const age0=Number.isFinite(t)&&t>0?t:0, SPEED=20,RANGE=25;
  const update=(dt,age)=>{const a=age+age0,dist=Math.min(RANGE,a*SPEED),fade=dist>=RANGE?Math.max(0,1-(a-RANGE/SPEED)/.20):1;
    grp.position.copy(origin).addScaledVector(dir,dist);
    // Fade in at the true projectile position, rather than advancing its clock or origin.
    const reveal=Math.min(1,dist/2.7);grp.visible=dist>.15;
    ribbons.forEach((m,i)=>{m.rotation.z=i*Math.PI*.67+Math.sin(a*4+i)*.14;m.material.uniforms.uP.value=1-fade*reveal;});
    core.material.opacity=.9*fade*reveal;glow.material.opacity=.10*fade*reveal;};
  const h=omxFx(Math.max(.01,1.45-age0),[grp],update);update(0,0);return h;
 } catch(e){try{window.omxErr=String(e&&e.stack||e).slice(0,300);xE(e);}catch(e2){}return null;} }
// Integration hook for a round reset/cancel. Game logic must call this at its reset boundary.
function omxReset(){omxCoverAim(false);while(omxLive.length)omxEnd({fx:omxLive[0]});document.querySelectorAll('.omxV').forEach(e=>e.remove());}
function omxCoverDome(p, r, seconds) { try { const G = omxGeos(), R = r || 4.1, ttl = Math.max(0.8, seconds || 15);
  const dome = new THREE.Mesh(G.sph, omxMat("dome", omxDOME, 0)); dome.material.side = THREE.FrontSide; dome.position.set(p.x, p.y, p.z); dome.scale.setScalar(0.2 * R);
  const ring = new THREE.Mesh(G.torus, omxBasic(0x64567f, 0.12, false)); ring.rotation.x = Math.PI / 2; ring.scale.setScalar(R); ring.position.set(p.x, p.y - R * 0.42 + 0.08, p.z); // near the ground contact
  const wisps = []; for (let i = 0; i < 3; i++) { const wm = omxMat("ten" + i, omxTENDRIL, 7 + i * 1.7); wm.uniforms.uA.value = 0.5; const w = new THREE.Mesh(G.plane, wm); w.scale.set(R * 0.35, R * 0.5, 1); wisps.push(w); }
  wisps.forEach((w) => { w.position.set(p.x, p.y - R * 0.3, p.z); });
  const objs = [dome, ring].concat(wisps);
  return omxFx(ttl, objs, (dt, age, k) => { const grow = Math.min(1, age / 0.35), die = Math.max(0, (age - (ttl - 0.6)) / 0.6), s = R * (0.2 + 0.8 * grow) * (1 - die * die);
    dome.scale.setScalar(Math.max(0.001, s)); dome.material.uniforms.uP.value = die; dome.rotation.y += dt * 0.05;
    ring.material.opacity = 0.12 * (1 - die) * grow; ring.scale.setScalar(Math.max(0.001, s));
    wisps.forEach((w, i) => { const a = omxU.value * 0.35 + (i / 3) * Math.PI * 2; w.position.set(p.x + Math.cos(a) * s * 0.85, p.y - R * 0.3 + Math.sin(omxU.value * 0.9 + i) * 0.15, p.z + Math.sin(a) * s * 0.85); w.rotation.y = -a + Math.PI / 2; w.material.uniforms.uP.value = die; }); }); } catch (e) { try { window.omxErr = String(e && e.stack || e).slice(0, 300); xE(e); } catch (e2) {} return null; } }
function omxShadowsTP(p, options) { try { const own = options && typeof options.caster === "boolean" ? options.caster : omxNearPlayer(p, 3.5); const veil = own ? omxVeil("Shade", options && options.seconds) : null;
  const fx = omxTendrils(p, 8, 2.6, 0.7, true, 1.1), G = omxGeos();
  if (own) { fx.veil = veil; return fx; } // caller can omxEnd(fx.veil) when Shade ends/cancels
  const rift = new THREE.Mesh(G.sph, omxBasic(0x6a4cff, 0.7, true)); rift.scale.set(0.3, 0.9, 0.3); rift.position.set(p.x, (p.y || 0) + 0.9, p.z); scene.add(rift); fx.fx.objs.push(rift);
  const core = new THREE.Mesh(G.sph, omxBasic(0x45d0ff, 0.9, true)); core.scale.set(0.09, 0.45, 0.09); core.position.copy(rift.position); scene.add(core); fx.fx.objs.push(core);
  const tick0 = fx.fx.tick; fx.fx.tick = (dt, age, k) => { tick0(dt, age, k); rift.material.opacity = 0.7 * Math.max(0, 1 - age / 0.35); rift.scale.y = 0.9 + age * 1.2; core.material.opacity = 0.9 * Math.max(0, 1 - age / 0.25); };
  return fx; } catch (e) { try { window.omxErr = String(e && e.stack || e).slice(0, 300); xE(e); } catch (e2) {} return null; } }
// optional Dark Cover targeting view: phased navy tint + ringed dome edge at p
var omxAimFx = null;
function omxCoverAim(on, p, r) { try { if (!on) { if (omxAimFx) { omxEnd(omxAimFx.h); if (omxAimFx.veil) omxAimFx.veil.remove(); omxAimFx = null; } return null; }
  const G = omxGeos(), R = r || 4.1;
  if (!omxAimFx) { omxCss(); const veil = document.createElement("div"); veil.className = "omxV omxVPhase on"; document.body.appendChild(veil);
    const shell = new THREE.Mesh(G.sph, omxMat("edge", omxEDGE, 0)); shell.scale.setScalar(R);
    const ring = new THREE.Mesh(G.torus, omxBasic(0x5ab4ff, 0.85, true)); ring.rotation.x = Math.PI / 2; ring.scale.setScalar(R);
    const h = omxFx(1e9, [shell, ring], () => {});
    omxAimFx = { h, veil, shell, ring }; }
  if (p) { omxAimFx.shell.position.set(p.x, p.y, p.z); omxAimFx.ring.position.set(p.x, p.y - R * 0.42 + 0.08, p.z); }
  return omxAimFx.h; } catch (e) { try { window.omxErr = String(e && e.stack || e).slice(0, 300); xE(e); } catch (e2) {} return null; } }
// ---- END OMEN FX ----
