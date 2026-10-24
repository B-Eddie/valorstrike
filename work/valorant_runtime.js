// ---- VALORANT ASSET INTEGRATION ----
// Models and native clips: Riot Games via Kingdom Archives. Map props: public Ascent port.
var XV = { config: window.VALORANT_ASSETS || {}, cache: {}, agents: {}, guns: {}, fp: null, fpLoad: null, event: null, failures: {} };
function xvLoad(name) {
  if (!XV.cache[name]) XV.cache[name] = new Promise((resolve, reject) => {
    new THREE.GLTFLoader().load('models/valorant/' + name + '.glb', resolve, undefined, reject);
  }).catch((e) => { XV.failures[name] = String(e); delete XV.cache[name]; throw e; });
  return XV.cache[name];
}
function xvFind(root, name) { const clean = (s) => String(s).replace(/[^a-zA-Z0-9_]/g, ''); let found = null; root.traverse((o) => { if (!found && clean(o.name) === clean(name)) found = o; }); return found; }
function xvConstraints(root, config, fp) {
  for (const c of (config && config.Constraints) || []) {
    const target = xvFind(root, c.TargetObject), object = xvFind(root, c.SourceObject), bone = target && xvFind(target, c.Bone);
    if (!bone || !object || object === bone || c.Type !== 'ObjectToBone') continue;
    bone.add(object); object.position.set(c.Offset.X, c.Offset.Y, c.Offset.Z); object.rotation.set(c.Rotation.X * Math.PI / 180, c.Rotation.Y * Math.PI / 180, c.Rotation.Z * Math.PI / 180);
    if (c.Scale) object.scale.set(c.Scale.X, c.Scale.Y, c.Scale.Z);
  }
  if (!fp) for (const n of (config && config.FPExclusiveObjects) || []) { const o = xvFind(root, n); if (o) o.visible = false; }
  root.updateMatrixWorld(true);
}
function xvStatic(gl, config) {
  const sc = THREE.SkeletonUtils.clone(gl.scene); xvConstraints(sc, config, false);
  const mx = new THREE.AnimationMixer(sc), idle = gl.animations.find((c) => c.name === 'Idle'); if (idle) { mx.clipAction(idle).play(); mx.update(0); }
  sc.updateMatrixWorld(true); const out = new THREE.Group(), v = new THREE.Vector3();
  sc.traverse((o) => {
    if (!o.isMesh) return; for (let p = o; p; p = p.parent) if (!p.visible) return;
    const geo = o.geometry.clone(), ps = geo.attributes.position;
    if (o.isSkinnedMesh) { o.skeleton.update(); for (let i = 0; i < ps.count; i++) { v.fromBufferAttribute(ps, i); o.boneTransform(i, v); ps.setXYZ(i, v.x, v.y, v.z); } geo.deleteAttribute('skinIndex'); geo.deleteAttribute('skinWeight'); geo.computeVertexNormals(); }
    geo.applyMatrix4(o.matrixWorld); geo.userData.shared = true; const mesh = new THREE.Mesh(geo, o.material); mesh.name = o.name; out.add(mesh);
  }); mx.stopAllAction(); return out;
}
function xvAgentName(n) { const a = xAgOf(n); return XUB_AG[a] ? a : Object.keys(XUB_AG)[String(n || '').split('').reduce((s,c) => s + c.charCodeAt(0), 0) % 12]; }
function xvAgentLoad(ag) {
  if (XV.agents[ag]) return XV.agents[ag]; const slug = ag.toLowerCase();
  return XV.agents[ag] = Promise.all([xvLoad(slug), fetch('models/valorant/' + slug + '-locomotion.json').then((r) => { if (!r.ok) throw new Error('locomotion ' + r.status); return r.json(); })]).then(([gl, data]) => {
    const C = {}, L = {}, U = {}, A = {}, up = /^(Spine[234]|Neck|Head|[LR]_(Clavicle|Shoulder|Elbow|Hand|Thumb|Index|Middle|Ring|Pinky))/;
    data.forEach((j) => { const c = THREE.AnimationClip.parse(j); C[c.name] = c; L[c.name] = new THREE.AnimationClip(c.name + '_L', c.duration, c.tracks.filter((t) => !up.test(t.name))); U[c.name] = new THREE.AnimationClip(c.name + '_U', c.duration, c.tracks.filter((t) => up.test(t.name))); });
    ['Pistol_Shoot','Hit_Chest','Hit_Head'].forEach((n) => { A[n] = THREE.AnimationUtils.makeClipAdditive(U[n].clone()); });
    return { gl, C, L, U, A };
  }).catch((e) => { delete XV.agents[ag]; console.warn('Valorant agent unavailable: ' + ag, e); throw e; });
}
function xvAgent(M, kit) {
  if (M.dead || M.valorant) return;
  // Detach the held weapon before removing the previous rig.
  if (M.gun && M.gun.parent) { M.m.add(M.gun); M.gun.position.set(-.1, 1.22, .32); }
  if (M.sx && M.sx.sc && M.sx.sc.parent) M.m.remove(M.sx.sc.parent);
  const old = XSOL.mx.indexOf(M); if (old >= 0) XSOL.mx.splice(old, 1);
  const sc = THREE.SkeletonUtils.clone(kit.gl.scene), wr = new THREE.Group(); wr.name = 'valorant-agent'; wr.add(sc);
  sc.updateMatrixWorld(true); const bx = new THREE.Box3().setFromObject(sc), scale = 1.92 / (bx.max.y - bx.min.y); wr.scale.setScalar(scale); wr.position.y = -bx.min.y * scale;
  const inGun = (o) => { for (let p = o; p; p = p.parent) if (p === M.gun) return true; return false; };
  M.m.traverse((o) => { if (o.isMesh && o !== M.ring && !inGun(o)) o.visible = false; });
  const mats = new Map(); sc.traverse((o) => { if (!o.isMesh) return; o.castShadow = true; o.frustumCulled = false; o.raycast = XNR; o.geometry.userData.shared = true;
    const mat = (s) => { if (!mats.has(s)) { const m = new THREE.MeshLambertMaterial({ name:s.name, color:s.color, map:s.map, side:THREE.DoubleSide, transparent:s.transparent, alphaTest:s.alphaTest }); m.userData.agent = 1; xRimM(m, M.rim, null); mats.set(s,m); M.mats.push(m); } return mats.get(s); }; o.material = Array.isArray(o.material) ? o.material.map(mat) : mat(o.material);
  }); M.m.add(wr);
  const mx = new THREE.AnimationMixer(sc), bone = (n) => sc.getObjectByName(n), X = {mx,a:{},w:{},ub:1,sc,b:{pelvis:bone('Pelvis'),spine_01:bone('Spine1'),spine_02:bone('Spine2'),spine_03:bone('Spine3')},cb:0,yaw:0,pit:0,sn:0,shots:0,hp:null,uo:null,ut:0,lo:null,lt:0,air:false,py:null,px:null,pz:null,cur:'idle',ad:{}};
  const mk = (n,set,once) => { const c = kit[set][XUB_ST[n]], a = mx.clipAction(c); if (once) { a.setLoop(THREE.LoopOnce,1); a.clampWhenFinished = true; } X.a[n] = a; X.w[n] = 0; };
  XUB_LO.forEach((n) => mk(n,'L',n==='jump'||n==='land')); XUB_UPN.forEach((n) => mk(n,'U',n==='reload'||n==='cast'||n==='throw')); XUB_FU.forEach((n) => mk(n,'C',n!=='plant'));
  [['fire','Pistol_Shoot'],['hit','Hit_Chest'],['hitHead','Hit_Head']].forEach(([n,c]) => { const a=mx.clipAction(kit.A[c]); a.blendMode=THREE.AdditiveAnimationBlendMode; a.setLoop(THREE.LoopOnce,1); X.ad[n]=a; });
  X.a.idle.play(); X.a.aim.play(); X.w.idle = X.w.aim = 1; mx.update(.01); M.m.updateMatrixWorld(true);
  const hand = bone('R_Hand'); if (hand && M.gun) { const hold = new THREE.Group(), p=new THREE.Vector3(),q=new THREE.Quaternion(),s=new THREE.Vector3(); new THREE.Matrix4().copy(M.m.matrixWorld).invert().multiply(hand.matrixWorld).decompose(p,q,s); hold.quaternion.copy(q.invert()); hold.scale.set(1/s.x,1/s.y,1/s.z); hand.add(hold); hold.add(M.gun); M.gun.position.set(0,0,.03); M.gun.rotation.x=0; }
  X.acts=X.a; M.ub=1; M.sx=X; M.valorant=1; M.xAt=[]; M.solOwn=()=>{M.solOwn=null;}; XSOL.mx.push(M);
}
{ const base = xUb; xUb = function(M) { base(M); const ag=xvAgentName(M.nm); xvAgentLoad(ag).then((kit)=>xvAgent(M,kit)).catch(()=>{}); }; }
// Native first-person rigs and their matching weapon animation clips. The virtual source camera faces +X.
function xvFPPlay(F, kind, time) {
  const key = kind === 'idle' ? 'Idle' : kind.charAt(0).toUpperCase()+kind.slice(1), a = F.entries.find((e)=>e.Translatable === key) || F.entries.find((e)=>e.Translatable.startsWith(key));
  if (!a) return;
  if (F.kind !== kind) { F.am.stopAllAction(); F.gm.stopAllAction(); const ac=F.ac[a.Name],gc=F.gc[a.WeaponAnimName || 'Idle']; if(ac)ac.reset().play(); if(gc)gc.reset().play(); F.kind=kind; F.action=ac; F.gaction=gc; F.age=0; }
  if (time != null) { if(F.action) F.action.time = Math.min(F.action.getClip().duration-.001,Math.max(0,time)*F.action.getClip().duration); if(F.gaction) F.gaction.time = Math.min(F.gaction.getClip().duration-.001,Math.max(0,time)*F.gaction.getClip().duration); F.am.update(0); F.gm.update(0); }
}
function xvFPLoad(ag,w) {
  const slug=w==='Knife'?'melee':w.toLowerCase(), cfg=XV.config.weaponAnimations && XV.config.weaponAnimations[slug]; if(!cfg || !cfg.WEAPONS_ANIMS_JSON) return Promise.reject(new Error('No native animation set for '+w));
  const entries=cfg.WEAPONS_ANIMS_JSON.Animations, files=[...new Set(entries.concat(cfg.MODEL_HELD_JSON.Animations||[]).filter(a=>a.File).map(a=>a.File))];
  return Promise.all([xvLoad(ag.toLowerCase()+'-fp'),xvLoad(slug),...files.map(f=>xvLoad('animations/'+f))]).then(([arms,weapon,...anims])=>{
    const sc=THREE.SkeletonUtils.clone(arms.scene), ws=THREE.SkeletonUtils.clone(weapon.scene), holder=sc.getObjectByName((cfg.MODEL_HELD_JSON.Settings.FP||{}).Bone||'R_WeaponMaster'); if(!holder)throw new Error('weapon attachment missing');
    xvConstraints(ws,cfg.MODEL_HELD_JSON,true); holder.add(ws); const rot=(cfg.MODEL_HELD_JSON.Settings.FP||{}).Rotation||{X:0,Y:90,Z:0}; ws.rotation.set(rot.X*Math.PI/180,rot.Y*Math.PI/180,rot.Z*Math.PI/180);
    const root=new THREE.Group();root.name='valorant-viewmodel';root.add(sc);root.rotation.y=Math.PI/2;
    sc.traverse(o=>{if(o.isMesh){o.frustumCulled=false;o.castShadow=o.receiveShadow=false;o.raycast=XNR;o.renderOrder=10;const conv=m=>new THREE.MeshLambertMaterial({name:m.name,color:m.color,map:m.map,side:THREE.DoubleSide,depthTest:false,depthWrite:false});o.material=Array.isArray(o.material)?o.material.map(conv):conv(o.material);}});
    const am=new THREE.AnimationMixer(sc),gm=new THREE.AnimationMixer(ws),ac={},gc={};const fclips=anims.filter((g,i)=>/^FP_/.test(files[i])).flatMap(g=>g.animations),gclips=weapon.animations.concat(anims.filter((g,i)=>/^GN_/.test(files[i])).flatMap(g=>g.animations));
    fclips.forEach(c=>ac[c.name]=am.clipAction(c));gclips.forEach(c=>gc[c.name]=gm.clipAction(c));
    const F={root,sc,ws,am,gm,ac,gc,entries,ag,w,kind:null,age:0};xvFPPlay(F,'idle');am.update(0);gm.update(0);sc.updateMatrixWorld(true);
    const cam=sc.getObjectByName('Camera');const pos=cam?cam.getWorldPosition(new THREE.Vector3()):new THREE.Vector3(0,1.67,0);pos.applyAxisAngle(new THREE.Vector3(0,1,0),Math.PI/2);root.position.copy(pos).negate();F.origin=root.position.clone();xvFPPlay(F,'equip');return F;
  });
}
function xvFPClear(F){if(!F)return;camera.remove(F.root);F.am.stopAllAction();F.gm.stopAllAction();F.root.traverse(o=>{if(o.isMesh)[].concat(o.material||[]).forEach(m=>m.dispose());});}
function xvFPTick(dt) {
  const kn=knife.visible, active=running && player && player.hp>0 && (gun.visible||kn) && !(typeof BC!=='undefined'&&(BC.vm||BC.cv)) && !J.dr && !(XCA.h&&XCA.h.visible&&XCA.on);
  const ag=(J&&J.pick)||'Jett',w=kn?'Knife':fpaWeap(),key=ag+'|'+w;
  if(active && (!XV.fp||XV.fp.ag!==ag||XV.fp.w!==w) && XV.fpLoad!==key){XV.fpLoad=key;xvFPLoad(ag,w).then(F=>{if(XV.fpLoad!==key){xvFPClear(F);return;}xvFPClear(XV.fp);XV.fp=F;F.kind=null;camera.add(F.root);}).catch(e=>{XV.failures[key]=String(e);}).finally(()=>{if(XV.fpLoad===key)XV.fpLoad=null;});}
  const F=XV.fp,on=active&&F&&F.ag===ag&&F.w===w;if(F)F.root.visible=!!on;if(!on)return;
  const hide=o=>{if(!o)return;XV.hidden.push([o,o.visible]);o.visible=false;}; gun.children.forEach(c=>{if(c!==muzzle)hide(c);});knife.children.forEach(hide);hide(FPA.g);[VMA.R,VMA.L,KARM].forEach(hide);
  if(kn&&kSwing>(F.lastSwing||0)+.05)XV.event=kHv?'alt Attack':'attack 1';F.lastSwing=kSwing;
  const rp=mode==='duel'?(du.reload>0?1-du.reload/OP_RELOAD:-1):mode==='aim'?(AM.rl>0?1-AM.rl/WEAP[aimW()].rld:-1):reloading>0?1-reloading/xRT():-1;
  if(rp>=0){XV.event=null;xvFPPlay(F,'reload',rp);}else if(VM.ins>0&&F.kind!=='inspect')xvFPPlay(F,'inspect');else if(XV.event){F.kind=null;xvFPPlay(F,XV.event);XV.event=null;}else if(F.kind==='reload'||(F.kind!=='idle'&&F.age>(F.duration||(F.action?F.action.getClip().duration:.4))))xvFPPlay(F,'idle');
  F.am.update(dt);F.gm.update(dt);if(rp>=0)xvFPPlay(F,'reload',rp);F.age+=dt;
  // Match the source's narrower viewmodel FOV while keeping the game's world-camera FOV.
  const s=Math.tan(THREE.MathUtils.degToRad(camera.fov/2))/Math.tan(THREE.MathUtils.degToRad(43.383/2));F.root.scale.set(s,s,1);F.root.position.set(F.origin.x*s,F.origin.y*s,F.origin.z);F.root.position.y+=Math.sin(VM.bob||0)*.003;
}
{const fire=vmFire;vmFire=function(){const r=fire.apply(this,arguments);XV.event='fire';return r;};const tick=vmTick;vmTick=function(dt){(XV.hidden||[]).forEach(([o,v])=>o.visible=v);XV.hidden=[];tick(dt);try{xvFPTick(Math.min(.1,dt||.016));}catch(e){if(!XV.fpErr){XV.fpErr=String(e);console.warn('native viewmodel',e);}}};}
// Replace generic imported map props and box cover while retaining the existing collision/navigation layout.
function xvMapCover(g) {
  if(!g||g.userData.nativeMap||g.userData.xvCover)return;g.userData.xvCover=true;
  xvLoad('environment/cover').then(gl=>{
    const src=xvStatic(gl,null),b=new THREE.Box3().setFromObject(src),sz=b.getSize(new THREE.Vector3());
    const candidates=[];g.traverse(o=>{const p=o.geometry&&o.geometry.parameters;if(o.isMesh&&p&&p.width&&p.height&&p.depth&&p.height>=.8&&p.height<=3.3&&p.width>=.65&&p.depth>=.65&&p.width<=4&&p.depth<=4&&!xIsDyn(o,g))candidates.push(o);});
    candidates.forEach(o=>{const p=o.geometry.parameters,root=src.clone(true);root.position.set(-b.min.x,-b.min.y,-b.min.z);const fit=new THREE.Group();fit.name='valorant-cover';fit.add(root);fit.scale.set(p.width/sz.x,p.height/sz.y,p.depth/sz.z);fit.position.set(-p.width/2,-p.height/2,-p.depth/2);o.add(fit);o.material=new THREE.MeshBasicMaterial({visible:false});});if(renderer.shadowMap.enabled)renderer.shadowMap.needsUpdate=true;
  }).catch(e=>{XV.failures.cover=String(e);});
}
{const use=useMap;useMap=function(n){const r=use.apply(this,arguments);try{xvMapCover(MAPS[n]&&MAPS[n].g);}catch(e){}return r;};}
window.xValorantAssets={state:XV,load:xvLoad,loadAgent:xvAgentLoad,loadFP:xvFPLoad,scene,camera,renderer,agents:()=>XSOL.mx,probe:()=>({running,mode,agent:J.pick,weapon:fpaWeap(),nativeAgents:XSOL.mx.filter(m=>m.valorant).length,nativeFP:XV.fp&&XV.fp.ag+' '+XV.fp.w,failures:XV.failures})};
// Physical ability devices retain their gameplay roots, hit checks and timers.
var XV_DEVICE = {};
function xvDevice(m, slug, height, bottom) {
  if(!m || m.userData.xvDevice)return;const token={};m.userData.xvDevice=token;
  if(!XV_DEVICE[slug])XV_DEVICE[slug]=xvLoad(slug).then(gl=>xvStatic(gl,XV.config[slug])).catch(e=>{delete XV_DEVICE[slug];throw e;});
  XV_DEVICE[slug].then(src=>{if(m.userData.xvDevice!==token)return;const b=new THREE.Box3().setFromObject(src),size=b.getSize(new THREE.Vector3()),root=new THREE.Group(),obj=src.clone(true),s=height/Math.max(.001,size.y);root.name='valorant-device';root.userData.dynamic=true;
    obj.position.set(-(b.min.x+b.max.x)/2,-b.min.y,-(b.min.z+b.max.z)/2);root.add(obj);root.scale.setScalar(s);root.position.y=bottom?0:-height/2;
    token.children=m.children.slice().map(o=>[o,o.visible]);token.children.forEach(([o])=>o.visible=false);if(m.material){token.material=m.material;const mat=m.material.clone();mat.visible=false;m.material=mat;}root.traverse(o=>{if(o.isMesh){o.raycast=XNR;o.castShadow=true;}});m.add(root);token.root=root;
  }).catch(e=>{if(m.userData.xvDevice===token)delete m.userData.xvDevice;XV.failures[slug]=String(e);});
}
function xvDeviceReset(m){const t=m&&m.userData.xvDevice;if(!t)return;delete m.userData.xvDevice;if(t.root)m.remove(t.root);if(t.material){m.material.dispose();m.material=t.material;}if(t.children)t.children.forEach(([o,v])=>o.visible=v);}
{const drop=xDrop;xDrop=function(){if(XV.fp&&XV.fp.root.visible)return;return drop.apply(this,arguments);};}
{const rel=jRel;jRel=function(m){xvDeviceReset(m);return rel.apply(this,arguments);};}
function xvDevicesTick(){
  if(!running)return;
  [[spike,'spike',.8],[fsM,'spike',.8],[fsIcon,'spike',.8],[J.tur&&J.tur.m,'turret',.9],[J.ab&&J.ab.m,'alarmbot',.45],[J.ld&&J.ld.m,'lockdown',.9],[TB,'trailblazer',.8,true]].forEach(a=>xvDevice(...a));
  RS.bb.forEach(o=>xvDevice(o.m,'boom-bot',.5/Math.max(.01,o.m.scale.y)));RS.pk.forEach(o=>xvDevice(o.m,'blast-pack',.22/Math.max(.01,o.m.scale.y)));RS.pj.forEach(o=>xvDevice(o.m,o.kind==='rocket'?'showstopper':'paintshell',.24/Math.max(.01,o.m.scale.y)));if(RS.hk)xvDevice(RS.hk.m,'guiding-light',.35/Math.max(.01,RS.hk.m.scale.y));
  BC.tm.forEach(o=>xvDevice(o.m,'trademark',.3));if(BC.an)xvDevice(BC.an.m,'rendezvous',.35);if(BC.cam)xvDevice(BC.cam.m,'spycam',.25);(BC.cw||[]).forEach(w=>w.an.forEach(m=>xvDevice(m,'trapwire',.2)));J.arrows.forEach(o=>xvDevice(o.m,o.kind==='shock'?'shock-dart':'recon-bolt',.12));
}
(window.XHK || (window.XHK=[])).push(xvDevicesTick);

function xvSurfaces(){
  const loader=new THREE.TextureLoader();for(const key of ['wall','tile','cobble','wood','metal','roof'])loader.load('models/valorant/surfaces/'+key+'.jpg',texture=>{texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.encoding=THREE.sRGBEncoding;texture.anisotropy=Math.min(4,renderer.capabilities.getMaxAnisotropy());texture.userData.shared=true;
    for(const set of [XM,XMA])if(set[key]){set[key].map=texture;set[key].needsUpdate=true;}
  },undefined,e=>{XV.failures['surface/'+key]=String(e);});
}
{const go=xGo;xGo=function(){if(!XV.surfaces){XV.surfaces=true;xvSurfaces();}return go.apply(this,arguments);};}
// ---- END VALORANT ASSET INTEGRATION ----
