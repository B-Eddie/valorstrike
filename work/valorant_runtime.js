// ---- VALORANT ASSET INTEGRATION ----
// Models and native clips: Riot Games via Kingdom Archives. Map props: public Ascent port.
// Texture memory cap (quality-linked): a full native load decodes ~640MB of RGBA textures
// (map ~295MB + kits/weapons ~339MB) regardless of the graphics preset, which OOMs
// memory-constrained devices (observed: chrome killed at ~1GB RSS in a 2GB container).
// The low preset (user-selected, or auto on touch devices) caps texture decode at 512px;
// devices reporting navigator.deviceMemory <= 4 cap at 1024px whatever the preset.
// Halving dimensions quarters decoded memory; models, geometry, animations and gameplay
// are untouched - this is a deliberate, preset-linked quality/memory tradeoff, not a
// fallback tier. Chrome/Edge decode GLTF textures via createImageBitmap; Safari/Firefox
// use TextureLoader and are unaffected (full res, as before).
const XV_TEXCAP = (() => {
  try {
    let gq = null; try { gq = localStorage.getItem('vs.gq'); } catch (e) {}
    if (!gq) gq = (typeof xLowDev !== 'undefined' && xLowDev) ? 'low' : 'medium';
    const lowMem = !!(navigator.deviceMemory && navigator.deviceMemory <= 4);
    if (gq === 'low') return 512;
    if (lowMem) return 1024;
  } catch (e) {}
  return 0; // 0 = no cap: high/medium on ordinary hardware keep full-resolution textures
})();
if (XV_TEXCAP && typeof createImageBitmap === 'function') {
  const xvCIB = createImageBitmap.bind(window);
  window.createImageBitmap = function (src, ...rest) {
    // Only intercept the (blob, options) shape THREE.ImageBitmapLoader uses; pass everything else through.
    if (rest.length !== 1 || !(src instanceof Blob) || !rest[0] || typeof rest[0] !== 'object') return xvCIB(src, ...rest);
    const opts = rest[0];
    return xvCIB(src, opts).then((probe) => {
      const m = Math.max(probe.width, probe.height);
      if (m <= XV_TEXCAP) return probe;
      const f = XV_TEXCAP / m, rw = Math.max(1, Math.round(probe.width * f)), rh = Math.max(1, Math.round(probe.height * f));
      // Resize decode failing must not break the texture: fall back to the full-size probe
      // (correct rendering, no memory saved). The probe is closed only on success.
      return xvCIB(src, Object.assign({}, opts, { resizeWidth: rw, resizeHeight: rh, resizeQuality: 'high' })).then((small) => { probe.close(); return small; }, () => probe);
    });
  };
}
var XV = { config: window.VALORANT_ASSETS || {}, cache: {}, agents: {}, guns: {}, fp: null, fpLoad: null, event: null, failures: {} };
function xvLoad(name) {
  if (!XV.cache[name]) XV.cache[name] = new Promise((resolve, reject) => {
    new THREE.GLTFLoader().load('models/valorant/' + name + '.glb', resolve, undefined, reject);
  }).catch((e) => { XV.failures[name] = String(e); delete XV.cache[name]; throw e; });
  return XV.cache[name];
}
function xvReadyAgents(list) {
  const one = (ag) => xvAgentLoad(ag).catch(() => xvAgentLoad(ag)); // one retry; a second failure rejects
  let names = null;
  try { if (Array.isArray(list) && list.length) names = [...new Set(list.map((n) => xvAgentName(n)))]; } catch (e) {}
  return Promise.all((names && names.length ? names : Object.keys(XUB_AG)).map(one));
}
// Participant-scoped readiness: a match spawns only its drawn roster (bot names ARE agent
// names from X_ALL_AG; anything else resolves through xvAgentName's deterministic hash), so
// the gate loads the roster's kits instead of all 12. Online (MP.on) loads all 12: a late
// join can bring any agent, and native opponents must never spawn invisible.
function xvRoster(mode) {
  try {
    if (typeof MP !== 'undefined' && MP && MP.on) return null; // online: a late join can bring any agent
    const me = (window.J && J.pick) || 'Jett';
    // Untagged starts come through agentSelect(go) and can be 5v5 OR retake: the roster
    // kind is unknowable at the gate, so load all 12 rather than risk invisible opponents.
    if (!mode) return null;
    if (mode === 'SURF' || mode === 'AIM PRACTICE' || mode === 'AIM TRAINING') return [me]; // no bots: player kit only
    if (mode === 'OPERATOR DUEL') return [me, 'Chamber']; // duel's fixed opponent
    if (mode === 'RETAKE' || mode === 'RIFLE 2V2') {
      if (typeof xRollSmall !== 'function' || typeof names === 'undefined' || typeof MATES === 'undefined') return null;
      xRollSmall(); // draws if needed; xSmPreDrawn makes the mode start keep this exact roster
      try { xSmPreDrawn = true; } catch (e) {}
      return [me].concat(names, MATES);
    }
    if (typeof xBuildTeams !== 'function' || typeof F_EN === 'undefined' || typeof F_MATES === 'undefined') return null;
    xBuildTeams(); // draws if needed; xTmPreDrawn makes the mode start keep this exact roster
    try { xTmPreDrawn = true; } catch (e) {}
    const set = new Set([me, 'Chamber']); // Chamber: Operator Duel's fixed opponent
    F_EN.forEach((n) => set.add(n)); F_MATES.forEach((n) => set.add(n));
    return [...set];
  } catch (e) { return null; }
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
// Agent assets (#10): optimized third-person models plus one shared locomotion file (work/build_agent_assets.cjs).
// Every file is fetched in parallel from the moment the page opens, kept in Cache Storage under its content hash so
// repeat visits skip the network, and integrity-checked before it is stored. Kits are built in pick order.
var XVA = { files: (window.VALORANT_AGENT_FILES || {}).files || {}, dir: 'models/valorant/agents/', buf: {}, got: {}, kits: {}, loco: null, cache: null, subs: [], tries: 4, wait: 800, started: false };
function xvaUrl(f) { const m = XVA.files[f]; return XVA.dir + f + (m && m.sha256 ? '?v=' + m.sha256.slice(0, 16) : ''); }
function xvaNotify() { XVA.subs.slice().forEach((f) => { try { f(); } catch (e) {} }); }
function xvaHex(b) { return Array.from(new Uint8Array(b), (x) => x.toString(16).padStart(2, '0')).join(''); }
function xvaCache() {
  if (XVA.cache) return XVA.cache;
  const C = typeof caches !== 'undefined' && caches && typeof caches.open === 'function' ? caches : null;
  return XVA.cache = !C ? Promise.resolve(null) : C.open('valorstrike-agents').then((c) => {
    const want = new Set(Object.keys(XVA.files).map((f) => new URL(xvaUrl(f), location.href).href)); // drop superseded versions
    Promise.resolve(c.keys()).then((ks) => ks.forEach((k) => { if (!want.has(k.url)) c.delete(k); })).catch(() => {});
    return c;
  }).catch(() => null);
}
function xvaVerify(f, b) {
  const m = XVA.files[f], S = typeof crypto !== 'undefined' && crypto && crypto.subtle;
  if (!m || !m.sha256 || !S) return Promise.resolve(!!m);
  return S.digest('SHA-256', b).then((h) => xvaHex(h) === m.sha256, () => false);
}
function xvaDownload(f, url) {
  return fetch(url).then((r) => {
    if (!r.ok) throw new Error(f + ' HTTP ' + r.status);
    const rd = r.body && r.body.getReader && r.body.getReader(); if (!rd) return r.arrayBuffer();
    const parts = []; let n = 0;
    const pump = () => rd.read().then(({ done, value }) => { if (done) return; parts.push(value); n += value.byteLength; XVA.got[f] = n; xvaNotify(); return pump(); });
    return pump().then(() => { const out = new Uint8Array(n); let o = 0; parts.forEach((p) => { out.set(p, o); o += p.byteLength; }); return out.buffer; });
  });
}
// Bytes of one agent asset: Cache Storage first, then the network (stored only when the hash matches the manifest).
function xvaFetch(f) {
  if (XVA.buf[f]) return XVA.buf[f];
  const url = xvaUrl(f);
  return XVA.buf[f] = xvaCache().then((c) => Promise.resolve(c && c.match(url)).catch(() => null).then((hit) => hit ? hit.arrayBuffer() : xvaDownload(f, url).then((b) => {
    if (c) xvaVerify(f, b).then((ok) => { if (ok) return c.put(url, new Response(b.slice(0), { headers: { 'content-type': 'application/octet-stream' } })); console.warn('agent asset hash mismatch, not cached: ' + f); }).catch(() => {});
    return b;
  }))).then((b) => { XVA.got[f] = b.byteLength; xvaNotify(); return b; }).catch((e) => { delete XVA.buf[f]; XVA.got[f] = 0; throw e; });
}
function xvaRetry(job, label) { let n = 0; const go = () => job().catch((e) => { if (++n >= XVA.tries) { XV.failures[label] = String(e); throw e; } return new Promise((r) => setTimeout(r, XVA.wait * n)).then(go); }); return go(); }
function xvaLoco() {
  if (XVA.loco) return XVA.loco;
  return XVA.loco = Promise.all([xvaFetch('locomotion.json'), xvaFetch('locomotion.bin')]).then(([j, b]) => ({ h: JSON.parse(new TextDecoder().decode(j)), f: new Float32Array(b) })).catch((e) => { XVA.loco = null; throw e; });
}
// Rebuild one agent's retargeted locomotion clips: local = inverse(parent world) * shared bone world * agent offset.
function xvaClips(L, slug, root) {
  const H = L.h, F = L.f, A = H.agents[slug]; if (!A) throw new Error('no locomotion for ' + slug);
  const Q = THREE.Quaternion, nodes = {}, idx = {}; root.traverse((o) => { if (!(o.name in nodes)) nodes[o.name] = o; });
  H.bones.forEach((b, k) => { idx[b] = k; if (!nodes[b]) throw new Error(slug + ' bone missing: ' + b); });
  const info = H.bones.map((b, k) => { const o = nodes[b], rest = new Q(); let p = o.parent; const chain = [];
    while (p && p !== root && !(p.name in idx && nodes[p.name] === p)) { chain.unshift(p); p = p.parent; }
    chain.forEach((c) => rest.multiply(c.quaternion));
    let depth = 0; for (let q = o.parent; q && q !== root; q = q.parent) depth++;
    return { k, anc: p && p !== root ? idx[p.name] : -1, rest, off: new Q().fromArray(A.offset[k]), depth };
  }).sort((x, y) => x.depth - y.depth);
  const W = H.bones.map(() => new Q()), pw = new Q(), loc = new Q(), I = new Q();
  return H.clips.map((c, i) => {
    const n = c.frames, times = F.slice(c.times, c.times + n), vals = H.bones.map(() => new Float32Array(n * 4));
    for (let f = 0; f < n; f++) for (const b of info) {
      const o = c.world + (b.k * n + f) * 4; W[b.k].set(F[o], F[o + 1], F[o + 2], F[o + 3]).multiply(b.off);
      pw.copy(b.anc >= 0 ? W[b.anc] : I).multiply(b.rest); loc.copy(pw).invert().multiply(W[b.k]).normalize(); loc.toArray(vals[b.k], f * 4);
    }
    const tracks = A.order.map((name) => { const bone = name.slice(0, name.lastIndexOf('.'));
      if (/\.position$/.test(name)) return new THREE.VectorKeyframeTrack(name, times, F.slice(A.pelvis[i], A.pelvis[i] + n * 3));
      return new THREE.QuaternionKeyframeTrack(name, times, vals[idx[bone]]); });
    return new THREE.AnimationClip(c.name, c.duration, tracks);
  });
}
function xvaKit(gl, L, slug) {
  const C = {}, Lo = {}, U = {}, A = {}, up = /^(Spine[234]|Neck|Head|[LR]_(Clavicle|Shoulder|Elbow|Hand|Thumb|Index|Middle|Ring|Pinky))/;
  xvaClips(L, slug, gl.scene).forEach((c) => { c.uuid=THREE.MathUtils.generateUUID(); C[c.name] = c; Lo[c.name] = new THREE.AnimationClip(c.name + '_L', c.duration, c.tracks.filter((t) => !up.test(t.name))); U[c.name] = new THREE.AnimationClip(c.name + '_U', c.duration, c.tracks.filter((t) => up.test(t.name))); });
  ['Pistol_Shoot','Hit_Chest','Hit_Head'].forEach((n) => { A[n] = THREE.AnimationUtils.makeClipAdditive(U[n].clone()); });
  const S = L.h.agents[slug];
  return { gl, C, L: Lo, U, A, contactProbes: S.contactProbes || [], contactLift: S.contactLift ? { times: S.contactLift.times, values: S.contactLift.values } : undefined };
}
function xvaParse(buf) { return new Promise((res, rej) => new THREE.GLTFLoader().parse(buf, XVA.dir, res, rej)); }
function xvAgentLoad(ag) {
  if (XV.agents[ag]) return XV.agents[ag]; const slug = ag.toLowerCase();
  return XV.agents[ag] = xvaRetry(() => Promise.all([xvaFetch(slug + '.glb').then(xvaParse), xvaLoco()]).then(([gl, L]) => xvaKit(gl, L, slug)), ag)
    .then((kit) => { XVA.kits[ag] = kit; xvaNotify(); return kit; })
    .catch((e) => { delete XV.agents[ag]; console.warn('Valorant agent unavailable: ' + ag, e); throw e; });
}
function xvaAll() { return Object.keys(XUB_AG); }
function xvaFilesOf(ags) { return ags.map((a) => a.toLowerCase() + '.glb').concat(['locomotion.json', 'locomotion.bin']); }
// Progress over a set of agents: kits built, and bytes in hand against the manifest sizes.
function xvAgentProgress(ags) {
  ags = ags || xvaAll(); const fs = xvaFilesOf(ags); let got = 0, total = 0;
  fs.forEach((f) => { const t = (XVA.files[f] || {}).bytes || 0; total += t; got += Math.min(t || Infinity, XVA.got[f] || 0); });
  const ready = ags.filter((a) => XVA.kits[a]).length;
  return { ready, total: ags.length, bytes: got, totalBytes: total, done: ready === ags.length, frac: ags.length ? (ready === ags.length ? 1 : Math.min(.99, total ? got / total : ready / ags.length)) : 1 };
}
// Resolves once every listed agent (default: all twelve) has its real model; onProgress gets xvAgentProgress().
function xvAgentsReady(ags, onProgress) {
  ags = (ags && ags.length ? ags : xvaAll()).map((a) => xvAgentName(a)).filter((a, i, l) => l.indexOf(a) === i);
  const tick = () => { if (onProgress) onProgress(xvAgentProgress(ags)); }; XVA.subs.push(tick); tick();
  return Promise.all(ags.map(xvAgentLoad)).then(() => { tick(); return ags.map((a) => XVA.kits[a]); }).finally(() => { const i = XVA.subs.indexOf(tick); if (i >= 0) XVA.subs.splice(i, 1); });
}
// Lobby boot: every agent file downloads in parallel right away; kits are then built one at a time, the last pick first.
function xvPreloadAgents(first) {
  if (XVA.started) return; XVA.started = true;
  const all = xvaAll(), lead = first && all.indexOf(first) >= 0 ? first : 'Jett', order = [lead].concat(all.filter((a) => a !== lead));
  try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {}); } catch (e) {}
  const head = xvaFilesOf([lead]), rest = xvaFilesOf(order.slice(1)).filter((f) => head.indexOf(f) < 0);
  // The lobby's agent gets the whole pipe first; the other eleven then download in parallel while it is built.
  Promise.all(head.map((f) => xvaFetch(f).catch(() => {}))).then(() => rest.forEach((f) => { xvaFetch(f).catch(() => {}); }));
  order.reduce((p, a) => p.then(() => xvAgentLoad(a).catch(() => {})), Promise.resolve());
}
// Progress label over a preview canvas while its agent's real model is still on the way.
function xvAgentWaitLabel(cv) {
  if (!cv || !cv.parentNode) return () => {};
  let el = cv.parentNode.querySelector(':scope > .xv-wait');
  if (!el) { el = document.createElement('div'); el.className = 'xv-wait'; el.setAttribute('role', 'status'); el.style.cssText = 'position:absolute;left:0;right:0;bottom:12%;text-align:center;pointer-events:none;font:600 12px/1.4 system-ui,sans-serif;letter-spacing:.14em;color:rgba(236,232,225,.85);text-shadow:0 1px 3px #000'; if (getComputedStyle(cv.parentNode).position === 'static') cv.parentNode.style.position = 'relative'; cv.parentNode.appendChild(el); }
  let sub = null;
  return (ag) => {
    if (sub) { const i = XVA.subs.indexOf(sub); if (i >= 0) XVA.subs.splice(i, 1); sub = null; }
    if (!ag || XVA.kits[ag]) { el.style.display = 'none'; return; }
    sub = () => { const p = xvAgentProgress([ag]); el.textContent = 'LOADING ' + String(ag).toUpperCase() + ' ' + Math.round(p.frac * 100) + '%'; if (p.done) el.style.display = 'none'; };
    XVA.subs.push(sub); el.style.display = 'block'; sub();
  };
}
// perf (character draw calls): agent meshes were frustumCulled=false, so every unit's 2-6 skinned meshes were drawn
// even behind the camera. Each skinned geometry gets one cull sphere, measured once from its skinned idle pose in the
// mesh's own space and padded to the full idle diagonal (covers crouch, aim, reach, a falling corpse); corpses turn
// culling back off in xDie. Same sphere on the geometry (three r149) and on the mesh (r151+ SkinnedMesh.boundingSphere).
function xvCull(list) { const v = new THREE.Vector3(), out = [];
  for (const o of list) { if (!o.isSkinnedMesh) continue; const g = o.geometry, pos = g && g.attributes.position, bt = o.applyBoneTransform || o.boneTransform; if (!pos || !bt) continue;
    let s = g.userData.xvCull; if (!s) { const b = new THREE.Box3(), n = pos.count, st = Math.max(1, Math.floor(n / 1500)); for (let i = 0; i < n; i += st) { v.fromBufferAttribute(pos, i); bt.call(o, i, v); if (Number.isFinite(v.x + v.y + v.z)) b.expandByPoint(v); }
      if (b.isEmpty()) continue; s = g.userData.xvCull = new THREE.Sphere(b.getCenter(new THREE.Vector3()), b.getSize(new THREE.Vector3()).length()); }
    g.boundingSphere = s.clone(); if ('boundingSphere' in o) o.boundingSphere = s.clone(); o.frustumCulled = true; out.push(o); }
  return out; }
function xvAgent(M, kit) {
  XUB.up ||= new THREE.Vector3(0,1,0); XUB.rt ||= new THREE.Vector3(1,0,0);
  if (M.dead || M.valorant) return;
  // Detach the held weapon before removing the previous rig.
  if (M.gun && M.gun.parent) { M.m.add(M.gun); M.gun.position.set(-.1, 1.22, .32); }
  if (M.sx && M.sx.sc && M.sx.sc.parent) M.m.remove(M.sx.sc.parent);
  const old = XSOL.mx.indexOf(M); if (old >= 0) XSOL.mx.splice(old, 1);
  const sc = THREE.SkeletonUtils.clone(kit.gl.scene), wr = new THREE.Group(); wr.name = 'valorant-agent'; wr.add(sc);
  sc.updateMatrixWorld(true); const bx = new THREE.Box3().setFromObject(sc), scale = 1.92 / (bx.max.y - bx.min.y); wr.scale.setScalar(scale); wr.position.y = -bx.min.y * scale;
  const inGun = (o) => { for (let p = o; p; p = p.parent) if (p === M.gun) return true; return false; };
  M.m.traverse((o) => { if (o.isMesh && o !== M.ring && !inGun(o)) o.visible = false; });
  const mats = new Map(), cull = []; sc.traverse((o) => { if (!o.isMesh) return; o.castShadow = true; o.frustumCulled = false; cull.push(o); o.raycast = XNR; o.geometry.userData.shared = true;
    const mat = (s) => { if (!mats.has(s)) { const m = new THREE.MeshLambertMaterial({ name:s.name, color:s.color, map:s.map, side:THREE.DoubleSide, transparent:s.transparent, alphaTest:s.alphaTest }); m.userData.agent = 1; xRimM(m, M.rim, null); mats.set(s,m); M.mats.push(m); } return mats.get(s); }; o.material = Array.isArray(o.material) ? o.material.map(mat) : mat(o.material);
  }); M.m.add(wr);
  const mx = new THREE.AnimationMixer(sc), bone = (n) => sc.getObjectByName(n), X = {mx,a:{},w:{},ub:1,nativeContact:true,sc,b:{pelvis:bone('Pelvis'),spine_01:bone('Spine1'),spine_02:bone('Spine2'),spine_03:bone('Spine3')},cs:bone('Splitter'),cb:0,yaw:0,pit:0,sn:0,shots:0,hp:null,uo:null,ut:0,lo:null,lt:0,air:false,py:null,px:null,pz:null,cur:'idle',ad:{}};
  const mk = (n,set,once) => { const c = kit[set][XUB_ST[n]], a = mx.clipAction(c); if (once) { a.setLoop(THREE.LoopOnce,1); a.clampWhenFinished = true; } X.a[n] = a; X.w[n] = 0; };
  XUB_LO.forEach((n) => mk(n,'L',n==='jump'||n==='land')); XUB_UPN.forEach((n) => mk(n,'U',n==='reload'||n==='cast'||n==='throw')); XUB_FU.forEach((n) => mk(n,'C',n!=='plant'));
  [['fire','Pistol_Shoot'],['hit','Hit_Chest'],['hitHead','Hit_Head']].forEach(([n,c]) => { const a=mx.clipAction(kit.A[c]); a.blendMode=THREE.AdditiveAnimationBlendMode; a.setLoop(THREE.LoopOnce,1); X.ad[n]=a; });
  X.a.idle.play(); X.a.aim.play(); X.w.idle = X.w.aim = 1; mx.update(.01); M.m.updateMatrixWorld(true); X.cull = xvCull(cull);
  const hand = bone('R_Hand'); if (hand && M.gun) { const hold = new THREE.Group(), p=new THREE.Vector3(),q=new THREE.Quaternion(),s=new THREE.Vector3(); new THREE.Matrix4().copy(M.m.matrixWorld).invert().multiply(hand.matrixWorld).decompose(p,q,s); hold.quaternion.copy(q.invert()); hold.scale.set(1/s.x,1/s.y,1/s.z); hand.add(hold); hold.add(M.gun); M.gun.position.set(0,0,.03); M.gun.rotation.set(0,Math.PI,0); M.weaponHolder=hold; } // gun models are authored muzzle -Z: PI faces the muzzle the way the character looks
  X.contactLift=kit.contactLift;X.contactProbes=kit.contactProbes.map(p=>({o:sc.getObjectByName(p.mesh),indices:p.indices})).filter(p=>p.o&&p.o.isSkinnedMesh);X.contactV=new THREE.Vector3();X.contactInv=new THREE.Matrix4();X.contactShift=new THREE.Vector3();X.contactScale=new THREE.Vector3();X.contactFloor=bx.min.y;X.acts=X.a; M.ub=1; M.sx=X; M.valorant=1; M.xAt=[]; M.solOwn=()=>{M.solOwn=null;}; XSOL.mx.push(M);
  if (M.xvWait) { M.xvWait = 0; if (M.gun) M.gun.visible = true; } // the weapon waited, hidden, for the body
}
// #11: no stand-in bodies. An agent whose kit is in memory gets its real rig immediately; otherwise it stays
// invisible (weapon hidden too) until the kit arrives. Match loading waits on xvAgentsReady, so this is rare.
function xvAttach(M) {
  if (!M || M.valorant) return M; const ag = xvAgentName(M.nm), kit = XVA.kits[ag];
  if (kit) { xvAgent(M, kit); return M; }
  M.xvWait = 1; if (M.gun) M.gun.visible = false; xvAgentLoad(ag).then((k) => xvAgent(M, k)).catch(() => {}); return M;
}
{const create=xAgent;xAgent=function(){return xvAttach(create.apply(this,arguments));};}
// Correct only the blended support-foot height after the mixer. Authored jog flight remains airborne. The shift moves
// Splitter (legs and torso together) so the waist never separates; stub rigs without it shift the pelvis.
{const pre=xUbPre,post=xUbPost;xUbPre=function(M){const X=M.sx;if(X&&X.contactRestore){(X.cs||X.b.pelvis).position.copy(X.contactRestore);X.contactRestore=null;}return pre(M);};xUbPost=function(M){post(M);const X=M.sx;if(!X||!X.nativeContact||X.dd||M.dead||X.air||X.lo||(X.w.plant||0)>.01||!X.contactProbes.length)return;M.m.updateMatrixWorld(true);const v=X.contactV,inv=X.contactInv.copy(X.sc.matrixWorld).invert();let low=Infinity;for(const {o,indices}of X.contactProbes){o.skeleton.update();for(const i of indices){v.fromBufferAttribute(o.geometry.attributes.position,i);o.boneTransform(i,v);v.applyMatrix4(o.matrixWorld).applyMatrix4(inv);low=Math.min(low,v.y);}}let lift=0;const c=X.contactLift,a=X.a.run;if(c&&a&&(X.w.run||0)>.001){const t=a.time%c.times[c.times.length-1];let i=0;while(i<c.times.length-2&&c.times[i+1]<t)i++;const f=(t-c.times[i])/Math.max(.00001,c.times[i+1]-c.times[i]);lift=(c.values[i]*(1-f)+c.values[i+1]*f)*(X.w.run||0);}const dy=X.contactFloor+lift-low;if(!Number.isFinite(dy)||Math.abs(dy)>.5)return;X.contactRestore=(X.cs||X.b.pelvis).position.clone();(X.cs||X.b.pelvis).getWorldPosition(v);const shift=X.contactShift.set(0,1,0).transformDirection(X.sc.matrixWorld).multiplyScalar(Math.abs(dy)*X.sc.getWorldScale(X.contactScale).y);if(dy<0)shift.negate();v.add(shift);(X.cs||X.b.pelvis).position.copy((X.cs||X.b.pelvis).parent.worldToLocal(v));M.m.updateMatrixWorld(true);};}
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
    sc.traverse(o=>{if(o.isMesh){o.frustumCulled=false;o.castShadow=o.receiveShadow=false;o.raycast=XNR;o.renderOrder=10;const conv=m=>new THREE.MeshLambertMaterial({name:m.name,color:m.color,map:m.map,side:THREE.DoubleSide});o.material=Array.isArray(o.material)?o.material.map(conv):conv(o.material);}});
    const am=new THREE.AnimationMixer(sc),gm=new THREE.AnimationMixer(ws),ac={},gc={};const fclips=anims.filter((g,i)=>/^FP_/.test(files[i])).flatMap(g=>g.animations),gclips=weapon.animations.concat(anims.filter((g,i)=>/^GN_/.test(files[i])).flatMap(g=>g.animations));
    fclips.forEach(c=>ac[c.name]=am.clipAction(c));gclips.forEach(c=>gc[c.name]=gm.clipAction(c));
    const F={root,sc,ws,am,gm,ac,gc,entries,ag,w,kind:null,age:0};xvFPPlay(F,'idle');am.update(0);gm.update(0);sc.updateMatrixWorld(true);
    const cam=sc.getObjectByName('Camera');const pos=cam?cam.getWorldPosition(new THREE.Vector3()):new THREE.Vector3(0,1.67,0);root.position.copy(pos).negate();F.origin=root.position.clone();xvFPPlay(F,'equip');return F;
  });
}
function xvFPClear(F){if(!F)return;if(F.root.parent)F.root.parent.remove(F.root);F.am.stopAllAction();F.gm.stopAllAction();F.root.traverse(o=>{if(o.isMesh)[].concat(o.material||[]).forEach(m=>m.dispose());});}
// Built viewmodels are kept per agent|weapon (a few, most recent last) so swapping back is instant and replays the
// authored equip; the agent's knife, Classic and current weapon are warmed as soon as a match is running.
var XVFP={max:6,c:new Map(),warm:''};
function xvFPGet(ag,w){const key=ag+'|'+w,F=XVFP.c.get(key);if(F){XVFP.c.delete(key);XVFP.c.set(key,F);return Promise.resolve(F);}
  if(XVFP.c.has(key+'#'))return XVFP.c.get(key+'#');
  const P=xvFPLoad(ag,w).then(F=>{XVFP.c.delete(key+'#');for(const k of XVFP.c.keys())if(!k.endsWith('#')&&k.split('|')[0]!==ag&&XVFP.c.get(k)!==XV.fp){xvFPClear(XVFP.c.get(k));XVFP.c.delete(k);}
    XVFP.c.set(key,F);const done=[...XVFP.c.keys()].filter(k=>!k.endsWith('#'));while(done.length>XVFP.max){const k=done.shift(),o=XVFP.c.get(k);if(o===XV.fp)continue;xvFPClear(o);XVFP.c.delete(k);}return F;},e=>{XVFP.c.delete(key+'#');throw e;});
  XVFP.c.set(key+'#',P);return P;}
function xvFPWarm(ag,w){const id=ag+'|'+w;if(XVFP.warm===id)return;XVFP.warm=id;for(const x of [w,'Knife','Classic'])if(!XV.failures[ag+'|'+x])xvFPGet(ag,x).catch(e=>{XV.failures[ag+'|'+x]=String(e);});}
function xvFPTick(dt) {
  const kn=knife.visible, active=running && player && player.hp>0 && (gun.visible||kn) && !(typeof BC!=='undefined'&&(BC.vm||BC.cv)) && !J.dr && !(XCA.h&&XCA.h.visible&&XCA.on);
  const ag=(J&&J.pick)||'Jett',w=kn?'Knife':fpaWeap(),key=ag+'|'+w;
  if(running)xvFPWarm(ag,kn?fpaWeap():w);
  if(active && (!XV.fp||XV.fp.ag!==ag||XV.fp.w!==w) && XV.fpLoad!==key && !XV.failures[key]){XV.fpLoad=key;xvFPGet(ag,w).then(F=>{if(XV.fpLoad!==key)return;if(XV.fp&&XV.fp.root.parent)XV.fp.root.parent.remove(XV.fp.root);XV.fp=F;F.kind=null;F.age=0;xvFPPlay(F,'equip');camera.add(F.root);}).catch(e=>{XV.failures[key]=String(e);}).finally(()=>{if(XV.fpLoad===key)XV.fpLoad=null;});}
  // Until the native rig for this agent|weapon is in, the primitive arms stay hidden (the native weapon model shows
  // alone); only a failed native load falls back to them.
  if(active&&!(XV.fp&&XV.fp.ag===ag&&XV.fp.w===w)&&!XV.failures[key]){XV.waitFP=key;[VMA.R,VMA.L,KARM].forEach(o=>{if(o){XV.hidden.push([o,o.visible]);o.visible=false;}});}else XV.waitFP=null;
  const F=XV.fp,on=active&&F&&F.ag===ag&&F.w===w;if(F)F.root.visible=!!on;if(!on)return;
  const hide=o=>{if(!o)return;XV.hidden.push([o,o.visible]);o.visible=false;}; gun.children.forEach(c=>{if(c!==muzzle)hide(c);});knife.children.forEach(hide);[VMA.R,VMA.L,KARM].forEach(hide);
  if(kn&&kSwing>(F.lastSwing||0)+.05)XV.event=kHv?'alt Attack':'attack 1';F.lastSwing=kSwing;
  const rp=mode==='duel'?(du.reload>0?1-du.reload/OP_RELOAD:-1):mode==='aim'?(AM.rl>0?1-AM.rl/WEAP[aimW()].rld:-1):reloading>0?1-reloading/xRT():-1;
  if(rp>=0){XV.event=null;xvFPPlay(F,'reload',rp);}else if(VM.ins>0&&F.kind!=='inspect')xvFPPlay(F,'inspect');else if(XV.event){F.kind=null;xvFPPlay(F,XV.event);XV.event=null;}else if(F.kind==='inspect'&&VM.ins<=0)xvFPPlay(F,'idle');else if(F.kind==='reload'||(F.kind!=='idle'&&F.age>(F.duration||(F.action?F.action.getClip().duration:.4))))xvFPPlay(F,'idle');
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
window.xValorantAssets={state:XV,agentAssets:XVA,agentsReady:xvAgentsReady,agentProgress:xvAgentProgress,load:xvLoad,loadAgent:xvAgentLoad,loadFP:xvFPLoad,fpCache:XVFP,scene,camera,renderer,agents:()=>XSOL.mx,probe:()=>({running,mode,agent:J.pick,weapon:fpaWeap(),nativeAgents:XSOL.mx.filter(m=>m.valorant).length,agentKits:Object.keys(XVA.kits).length,nativeFP:XV.fp&&XV.fp.ag+' '+XV.fp.w,failures:XV.failures})};
window.xvAgentsReady=xvAgentsReady;
window.xvRoster=xvRoster;
// Start downloading every agent as soon as the lobby is up (idle slot right after first paint), last pick first.
{const go=()=>{let a='Jett';try{a=(typeof S!=='undefined'&&S&&S.lastAg)||localStorage.getItem('vs.lastAg')||a;}catch(e){}try{xvPreloadAgents(xvAgentName(a));}catch(e){console.warn('agent preload',e);}};if(window.requestIdleCallback)requestIdleCallback(go,{timeout:300});else setTimeout(go,0);}
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
