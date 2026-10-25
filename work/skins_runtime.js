// ---- WEAPON SKINS ----
var XSK_CAT = /*SKINS_JSON*/null; // replaced by work/install_valorant.py with server/src/skins.json
// Original Riot models, textures and native clips downloaded from Kingdom Archives. Loaded only on demand.
var XSK = { cat: XSK_CAT, coll: {}, weapons: [], cats: [], eq: {}, owned: new Set(), net: {}, mc: new Map(), botSkins: false, ver: 0, tab: 'col', w: null, pick: null, sendT: 0, last: 0 };
XSK.cats = XSK.cat.categories; XSK.weapons = XSK.cats.flatMap((c) => c[1]);
XSK.cat.collections.forEach((c) => { XSK.coll[c.id] = c; });
const xskHas = (o, k) => !!o && Object.prototype.hasOwnProperty.call(o, k);
// id: "<collection>" (Base) or "<collection>.N" (variant N of that weapon's skin); "standard" is the factory finish.
function xskParse(id) { if (typeof id !== 'string' || id.length > 24) return null; const m = /^([a-z0-9-]+)(?:\.([1-9]))?$/.exec(id); if (!m || !xskHas(XSK.coll, m[1])) return null; return { cid: m[1], i: m[2] ? +m[2] : 0, c: XSK.coll[m[1]] }; }
function xskValidFor(w, id) { const p = xskParse(id); return !!p && xskHas(p.c.skins, w) && p.i < p.c.skins[w].ch.length; }
function xskDef(w, id) { if (!xskValidFor(w, id)) id = 'standard'; const p = xskParse(id), s = p.c.skins[w], chn = s.ch[p.i], base = p.c.pal || {};
  const col = p.i ? Object.assign({}, base, (p.c.cc || {})[chn] || {}) : base; return { id, cid: p.cid, c: p.c, i: p.i, s, chn, col }; }
function xskName(w, id) { const d = xskDef(w, id); return d.cid === 'standard' ? 'Standard' : d.s.n + (d.i ? ' · ' + d.chn : ''); }
function xskGet(w) { const id = XSK.eq[w]; return xskValidFor(w, id) ? id : 'standard'; }
// Ownership is per weapon skin (collection x weapon, every variant included); Standard is always owned.
function xskOwns(w, cid) { return cid === 'standard' || XSK.owned.has(cid + ':' + w); }
function xskLoad() {
  let o = null; try { o = JSON.parse(localStorage.getItem('vs.skins') || 'null'); } catch (e) {}
  XSK.eq = {}; XSK.owned = new Set();
  if (o && typeof o === 'object') {
    if (Array.isArray(o.owned)) o.owned.forEach((k) => { const [c, w] = String(k).split(':'); if (xskHas(XSK.coll, c) && c !== 'standard' && xskHas(XSK.coll[c].skins, w)) XSK.owned.add(c + ':' + w); });
    if (o.eq && typeof o.eq === 'object') for (const w of XSK.weapons) { const id = o.eq[w]; if (xskValidFor(w, id) && xskOwns(w, xskParse(id).cid)) XSK.eq[w] = id; }

  }
}
function xskSave() { try { localStorage.setItem('vs.skins', JSON.stringify({ v: 3, eq: XSK.eq, owned: [...XSK.owned] })); } catch (e) {} }
function xskWire() { const out = {}; for (const w of XSK.weapons) { const id = xskGet(w); if (id !== 'standard') out[w] = id; } return out; }
function xskChanged() { try{for(const k in XV.failures)if(k.includes('|'))delete XV.failures[k];}catch(e){} XSK.ver++; xskSave(); try { xskApplyAll(true); } catch (e) {}
  try { if (typeof NET !== 'undefined' && NET.socket && typeof netSend === 'function') { clearTimeout(XSK.sendT); XSK.sendT = setTimeout(() => netSend({ t: 'sk', s: xskWire() }), 250); } } catch (e) {} }
function xskGive(w, cid) { if (!xskHas(XSK.coll, cid) || cid === 'standard' || !xskHas(XSK.coll[cid].skins, w)) return false; const k = cid + ':' + w; if (XSK.owned.has(k)) return false; XSK.owned.add(k); xskSave(); return true; }
function xskGiveBundle(cid) { let n = 0; if (xskHas(XSK.coll, cid)) for (const w of Object.keys(XSK.coll[cid].skins)) if (xskGive(w, cid)) n++; return n; }
function xskEquip(w, id) { if (!XSK.weapons.includes(w) || !xskValidFor(w, id)) return false; if (!xskOwns(w, xskParse(id).cid)) return false;
  if (id === 'standard') delete XSK.eq[w]; else XSK.eq[w] = id; xskChanged(); return true; }
// Online: other players' equipped skins by unit id. Ids are re-checked here (the server already rejects bad ones).
function xskClean(m) { const out = {}; if (!m || typeof m !== 'object' || Array.isArray(m)) return out; for (const w of XSK.weapons) if (xskHas(m, w) && xskValidFor(w, m[w])) out[w] = m[w]; return out; }
function xskNet(m) {
  if (m.t === 'sks') { XSK.net = {}; if (m.m && typeof m.m === 'object') for (const id in m.m) XSK.net[id] = xskClean(m.m[id]); }
  else if (m.t === 'sk') { if (m.id != null) XSK.net[m.id] = xskClean(m.s); }
  else if (m.t === 'skr') XSK.rejected = (XSK.rejected || 0) + 1;
  XSK.last = 0;
}
function xskNetGet(nid, w) { const s = XSK.net[nid]; return s && xskValidFor(w, s[w]) ? s[w] : 'standard'; }
// deterministic showcase skins for offline bots (off by default; QA / preview: XSK.botSkins = true)
function xskBot(name, w) { let h = 7; const s = String(name) + '|' + w; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  const ids = []; for (const c of XSK.cat.collections) if (xskHas(c.skins, w)) c.skins[w].ch.forEach((_, i) => ids.push(i ? c.id + '.' + i : c.id)); return ids[h % ids.length]; }

// Authentic geometry swaps. A late download cannot override a newer selection or Standard.
var XSK_DATA = new Map(), XSK_MODELS = new Map();
function xskAsset(w,id) { const d=xskDef(w,id); return d.s.assets && d.s.assets[d.i] || null; }
function xskModelData(a) {
  if (!XSK_DATA.has(a.config)) XSK_DATA.set(a.config,fetch(a.config).then(r=>{if(!r.ok)throw Error('Skin metadata '+r.status);return r.json();}).catch(e=>{XSK_DATA.delete(a.config);throw e;}));
  return XSK_DATA.get(a.config);
}
function xskTemplate(w,id) {
  const a=xskAsset(w,id);if(!a)return Promise.resolve(null);const key=w+'|'+id;
  if(!XSK_MODELS.has(key)) { while(XSK_MODELS.size>=12)XSK_MODELS.delete(XSK_MODELS.keys().next().value); XSK_MODELS.set(key,Promise.all([Promise.resolve().then(()=>xvLoad(a.model)),Promise.resolve().then(()=>xskModelData(a))]).then(([gl,meta])=>{
    const f=XGM.F[w],k='skin/'+key,old=XGM.sk[w];
    try { XGM.src[k]=xvStatic(gl,meta.descriptor);XGM.F[w]=k;return xGmTpl(w); }
    finally {XGM.F[w]=f;XGM.sk[w]=old;delete XGM.src[k];delete XV.cache[a.model];}
  }).catch(e=>{XSK_MODELS.delete(key);throw e;})); }
  return XSK_MODELS.get(key);
}
function xskApply(root,w,id) {
  if(!root||!root.userData||(typeof XGM!=='undefined'&&!XGM.rdy))return 0;id=xskDef(w,id).id;const u=root.userData;
  if(u.xskId===id&&(!u.xskError||performance.now()<(u.xskRetryAt||0)))return 0;u.xskId=id;
  if(!u.xskBase){u.xskBase=root.children.map(o=>[o,o.visible]);u.xskGrip={grip:u.grip,mz:u.mz,my:u.my};}
  if(u.xskModel){root.remove(u.xskModel);u.xskModel=null;}
  u.xskBase.forEach(([o,v])=>o.visible=v);u.xskError=null;
  if(id==='standard'){Object.assign(u,u.xskGrip);u.xskPending=false;return 1;}
  u.xskPending=true;
  xskTemplate(w,id).then(T=>{
    if(u.xskId!==id)return;u.xskPending=false;if(!T)throw Error('Skin model unavailable');
    u.xskBase.forEach(([o])=>o.visible=false);const c=T.clone(true);c.name='authentic-skin';root.add(c);u.xskModel=c;
    for(const k of ['grip','mz','my'])if(T.userData[k]!=null)u[k]=T.userData[k];
  }).catch(e=>{if(u.xskId===id){u.xskPending=false;u.xskError=String(e);u.xskRetryAt=performance.now()+10000;console.warn('Skin load failed',w,id,e);}});
  return 1;
}
// The old colour-only skins are retired: their recolour paths stay neutral (Default) and their swap uses this one.
try { if (typeof skinId !== 'undefined') for (const k in skinId) { skinId[k] = 'Default'; if (typeof skin !== 'undefined') skin[k] = SKINS[0]; } } catch (e) {}
try { skSwap = function (root, id) { /* legacy id ignored: weapon skins live in XSK */ }; } catch (e) {}
try { skGroups = function () { try { for (const n in VMS) xskApply(VMS[n], n, xskGet(n)); const kid = xskGet('Knife'); knife.children.forEach((c) => { if (c !== KARM && c.userData && c.userData.mz != null) xskApply(c, 'Knife', kid); }); } catch (e) {} }; } catch (e) {} // the knife group also holds the arm (KARM): never skin it
// Offline drops by the player carry the player's skin (online the server copies the dropper's skin into the floor row).
try { const d0 = xdDrop; xdDrop = function (w, x, z) { const d = d0.apply(this, arguments);
  try { if (d && running && player && typeof FV !== 'undefined' && (w === FV.pri || w === FV.sec) && Math.hypot(x - player.x, z - player.z) < 3) d.sk = xskGet(w); } catch (e) {} return d; }; } catch (e) {}
// First-person skins are selected in xvFPLoad: native geometry and matching FP/GN clips travel together.
function xskFP() {}
function xskTP() { // third-person guns of every rig (each owner's own skin), floor guns, the fallback viewmodel and the lobby agent's Vandal
  const online = typeof NET !== 'undefined' && NET.socket && typeof MP !== 'undefined' && MP.st === 'game';
  try { for (const L of [bots, allies]) for (const u of L || []) { const M = u && u.xm; if (!M || !M.gun) continue;
    let w = u.w; try { if (!online && typeof xWeapOf === 'function') w = xWeapOf(u) || w; } catch (e) {}
    xskApply(M.gun, w, online ? xskNetGet(u.nid, w) : XSK.botSkins ? xskBot(u.name, w) : 'standard'); } } catch (e) {}
  try { const list = online && typeof netFloor !== 'undefined' ? netFloor.values() : (typeof XD !== 'undefined' ? XD.L : []); for (const d of list) { const g = d.m && d.m.userData.xdg; if (g) xskApply(g, d.w, d.sk); } } catch (e) {}
  try { if (typeof AGV !== 'undefined') for (const a in AGV.c) { const M = AGV.c[a]; if (M && M.gun) xskApply(M.gun, 'Vandal', xskGet('Vandal')); } } catch (e) {}
  try { if (typeof running !== 'undefined' && running && typeof skGroups === 'function') skGroups(); } catch (e) {} // a native model swapped in late keeps its skin
}
function xskApplyAll(force) { try { if (typeof skGroups === 'function') skGroups(); } catch (e) {} xskFP(); xskTP(); }
function xskTick() { const t=performance.now();if(t-XSK.last<250)return;XSK.last=t;xskTP(); }
(window.XHK || (window.XHK = [])).push(xskTick);
xskLoad();

// ---- Collection / Store pages
const XSK_TIER = { Standard: '#8b978f', Select: '#5a9fe2', Deluxe: '#009587', Premium: '#d1548d', Exclusive: '#f5955b', Ultra: '#fad663' };
const xskEsc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
function xskSw(w,id) { const d=xskDef(w,id),a=xskAsset(w,id),icon=a&&a.icon||d.s.icon;return icon?'url('+icon+') center / contain no-repeat':'#263441'; }
function xskDay(now) { const d = new Date(now || Date.now()); return d.getFullYear() * 1000 + Math.floor((d - new Date(d.getFullYear(), 0, 0)) / 864e5); }
const xskLines = () => XSK.cat.collections.filter((c) => c.id !== 'standard');
// Daily offers: four weapon skins picked from the date (same for everyone that day); the featured bundle rotates weekly.
function xskOffers(now) { const day = xskDay(now), cols = xskLines(), out = []; let h = Math.imul(day, 2654435761) >>> 0;
  for (let g = 0; out.length < 4 && g < 400; g++) { h = (Math.imul(h, 1103515245) + 12345) >>> 0; const c = cols[h % cols.length], ws = Object.keys(c.skins), w = ws[(h >>> 8) % ws.length]; if (!out.some((o) => o.w === w || o.c === c.id)) out.push({ c: c.id, w }); } return out; }
function xskFeatured(now) { const cols = xskLines(); return cols[Math.floor(xskDay(now) / 7) % cols.length].id; }
function xskColHTML() {
  let h = '<div class="xsk-col">';
  for (const [cat, list] of XSK.cats) { h += '<section class="xsk-cat"><h3>' + xskEsc(cat) + '</h3><div class="xsk-grid">';
    for (const w of list) { const id = xskGet(w), nm = xskName(w, id); h += '<button class="xsk-wc" data-a="weapon" data-w="' + w + '" aria-label="' + w + ', ' + xskEsc(nm) + ' equipped"><i style="background:' + xskSw(w, id) + '"></i><b>' + w + '</b><small>' + xskEsc(nm) + '</small></button>'; }
    h += '</div></section>'; }
  return h + '</div>';
}
function xskWpnHTML(w) {
  const cur = xskGet(w), pick = xskValidFor(w, XSK.pick) ? XSK.pick : cur, d = xskDef(w, pick), c = d.c, own = xskOwns(w, c.id), curC = xskParse(cur).cid;
  let h = '<div class="xsk-wv"><div class="xsk-wl" role="listbox" aria-label="' + w + ' skins"><button class="xsk-back" data-a="back">‹ Collection</button><h3>' + w + '</h3>';
  for (const col of XSK.cat.collections) { if (!xskHas(col.skins, w)) continue; const on = col.id === c.id, o = xskOwns(w, col.id), eq = curC === col.id, nm = col.id === 'standard' ? 'Standard' : col.skins[w].n;
    h += '<button class="xsk-sk' + (on ? ' on' : '') + (o ? '' : ' lock') + '" role="option" aria-selected="' + on + '" data-a="pick" data-id="' + col.id + '"><i style="background:' + xskSw(w, col.id) + '"></i><span><b>' + xskEsc(nm) + '</b><small>' + (eq ? 'Equipped' : o ? 'Owned' : 'Free · not in inventory') + '</small></span></button>'; }
  h += '</div><div class="xsk-pv"><canvas id="xskCv" aria-label="' + xskEsc(xskName(w, pick)) + ' preview, drag to rotate"></canvas><span id="xskStatus" role="status"></span><p class="xsk-pn"><b>' + xskEsc(c.id === 'standard' ? 'Standard ' + w : d.s.n) + '</b> <span style="color:' + (XSK_TIER[c.tier] || '#fff') + '">' + xskEsc(c.tier) + (c.id === 'standard' ? '' : ' · ' + xskEsc(c.name) + ' Collection') + '</span><small>' + xskEsc(c.desc) + (d.i ? ' Variant: ' + xskEsc(d.chn) + '.' : '') + '</small></p>';
  if (d.s.ch.length > 1) h += '<div class="xsk-ch" role="radiogroup" aria-label="Variants">' + d.s.ch.map((n, i) => { const id = i ? c.id + '.' + i : c.id; return '<button data-a="pick" data-id="' + id + '" role="radio" aria-checked="' + (id === pick) + '" aria-label="' + xskEsc(n) + '" title="' + xskEsc(n) + '" class="' + (id === pick ? 'on' : '') + '" style="background:' + xskSw(w, id) + '"></button>'; }).join('') + '</div>';
  if(c.id!=='standard') h+='<p class="xsk-fine">Original model, textures and native weapon animations.</p>';
  h += '<div class="xsk-act">' + (!own ? '<button class="xsk-get" data-a="get" data-id="' + pick + '">Get · FREE</button>' : pick === cur ? '<button class="xsk-eq" disabled>Equipped</button>' : '<button class="xsk-eq" data-a="equip" data-id="' + pick + '">Equip</button>') + '</div></div></div>';
  return h;
}
function xskStoreHTML(now) {
  const f = XSK.coll[xskFeatured(now)], fw = Object.keys(f.skins), have = fw.filter((w) => xskOwns(w, f.id)).length, all = have === fw.length;
  const t = new Date(now || Date.now()), next = new Date(t.getFullYear(), t.getMonth(), t.getDate() + 1), left = Math.max(0, next - t), hh = Math.floor(left / 36e5), mm = Math.floor(left / 6e4) % 60;
  let h = '<div class="xsk-store"><section class="xsk-feat" style="--a:' + (f.pal.a || '#333') + ';--b:' + (f.pal.e || f.pal.b || '#555') + '"><p class="xsk-eb">Featured bundle</p><h2>' + xskEsc(f.name) + ' Collection</h2><p>' + xskEsc(f.desc) + ' ' + fw.map((w) => xskEsc(f.skins[w].n)).join(', ') + '.</p>';
  h += '<div class="xsk-fb"><span class="xsk-free">FREE</span>' + (all ? '<button class="xsk-eq" disabled>Owned</button>' : '<button class="xsk-get" data-a="bundle" data-id="' + f.id + '">Get bundle · FREE</button>') + '<small>' + have + ' / ' + fw.length + ' in inventory</small></div></section>';
  h += '<section class="xsk-daily"><h3>Daily offers <small>Refreshes in ' + hh + 'h ' + String(mm).padStart(2, '0') + 'm</small></h3><div class="xsk-offers">';
  for (const o of xskOffers(now)) { const c = XSK.coll[o.c], own = xskOwns(o.w, o.c);
    h += '<div class="xsk-of" style="--t:' + (XSK_TIER[c.tier] || '#fff') + '"><i style="background:' + xskSw(o.w, o.c) + '"></i><b>' + xskEsc(c.skins[o.w].n) + '</b><small>' + xskEsc(c.tier) + '</small><span class="xsk-free">FREE</span>' +
      (own ? '<button class="xsk-eq" data-a="weapon" data-w="' + o.w + '" data-id="' + o.c + '">Owned · View</button>' : '<button class="xsk-get" data-a="get" data-w="' + o.w + '" data-id="' + o.c + '">Get</button>') + '</div>'; }
  h += '</div></section><section class="xsk-daily"><h3>All collections</h3><div class="xsk-offers xsk-all">';
  for (const c of xskLines()) { const ws = Object.keys(c.skins), n = ws.filter((w) => xskOwns(w, c.id)).length;
    h += '<div class="xsk-of" style="--t:' + (XSK_TIER[c.tier] || '#fff') + '"><i style="background:' + xskSw(ws[0], c.id) + '"></i><b>' + xskEsc(c.name) + '</b><small>' + xskEsc(c.tier) + ' · ' + ws.length + ' skins</small><span class="xsk-free">FREE</span>' +
      (n === ws.length ? '<button class="xsk-eq" disabled>Owned</button>' : '<button class="xsk-get" data-a="bundle" data-id="' + c.id + '">Get bundle</button>') + '</div>'; }
  return h + '</div></section><p class="xsk-fine">Every skin is free: no currency, no payments. Fan project. VALORANT assets © Riot Games, sourced via Kingdom Archives.</p></div>';
}
function xskRender() {
  const root = document.getElementById('xSk'); if (!root) return; const body = root.querySelector('.xsk-body');
  root.querySelectorAll('[data-tab]').forEach((b) => { const on = b.dataset.tab === XSK.tab; b.classList.toggle('on', on); b.setAttribute('aria-selected', String(on)); });
  body.innerHTML = XSK.tab === 'store' ? xskStoreHTML() : XSK.w ? xskWpnHTML(XSK.w) : xskColHTML();
  if (XSK.tab === 'col' && XSK.w) xskPreview(); else xskPvStop();
}
// Actions (delegated clicks; also the test / QA entry point)
function xskAct(a, w, id, n) {
  if (a === 'tab') { XSK.tab = id === 'store' ? 'store' : 'col'; XSK.w = null; XSK.pick = null; }
  else if (a === 'weapon') { if (!XSK.weapons.includes(w)) return false; XSK.tab = 'col'; XSK.w = w; const cur = xskGet(w); XSK.pick = id && xskValidFor(w, id) ? (xskParse(cur).cid === xskParse(id).cid ? cur : id) : cur; }
  else if (a === 'back') { XSK.w = null; XSK.pick = null; }
  else if (a === 'pick') { if (!XSK.w || !xskValidFor(XSK.w, id)) return false; XSK.pick = id; }
  else if (a === 'equip') { if (!xskEquip(XSK.w, id)) return false; }
  else if (a === 'get') { const ww = w || XSK.w, p = xskParse(id); if (!p || !xskGive(ww, p.cid)) return false; if (!w) xskEquip(ww, xskValidFor(ww, id) ? id : p.cid); }
  else if (a === 'bundle') { if (!xskHas(XSK.coll, id) || !xskGiveBundle(id)) return false; }
  else return false;
  xskRender(); return true;
}
function xskOpen(tab) { const root = xskBuild(); if (!root) return; XSK.tab = tab === 'store' ? 'store' : 'col'; XSK.w = null; XSK.pick = null; root.hidden = false; try { $('xQueue').hidden = true; } catch (e) {} xskRender(); }
function xskClose() { const root = document.getElementById('xSk'); if (root) root.hidden = true; XSK.w = null; xskPvStop(); }
// 3D preview: its own small renderer, created on open and released on leave (one extra context only while visible).
function xskPreview() {
  const cv = document.getElementById('xskCv'); if (!cv || typeof THREE === 'undefined' || typeof xGun !== 'function') return; let P = XSK.pv;
  if (!P || P.cv !== cv) { if (P) xskPvStop(); try { P = XSK.pv = { cv, r: xShChk(new THREE.WebGLRenderer({ canvas: cv, alpha: true, antialias: true })), sc: new THREE.Scene(), cam: new THREE.PerspectiveCamera(30, 1, 0.01, 50), yaw: 1.05, pitch: 0.12, drag: null, w: 0, h: 0 }; } catch (e) { XSK.pv = null; return; }
    P.r.setPixelRatio(Math.min(devicePixelRatio || 1, 2)); P.r.setClearColor(0, 0); if (THREE.sRGBEncoding) P.r.outputEncoding = THREE.sRGBEncoding;
    P.sc.add(new THREE.HemisphereLight(0xeef3ff, 0x30343c, 1.1)); const k = new THREE.DirectionalLight(0xffffff, 1.2); k.position.set(2, 3, 4); P.sc.add(k); const rim = new THREE.DirectionalLight(0xff4655, 0.6); rim.position.set(-3, 1, -3); P.sc.add(rim);
    P.piv = new THREE.Group(); P.sc.add(P.piv);
    cv.onpointerdown = (e) => { P.drag = { x: e.clientX, y: e.clientY, yaw: P.yaw, pitch: P.pitch }; try { cv.setPointerCapture(e.pointerId); } catch (er) {} };
    cv.onpointermove = (e) => { if (!P.drag) return; P.yaw = P.drag.yaw + (e.clientX - P.drag.x) * 0.012; P.pitch = Math.max(-0.9, Math.min(0.9, P.drag.pitch + (e.clientY - P.drag.y) * 0.008)); };
    cv.onpointerup = cv.onpointercancel = () => { P.drag = null; P.t0 = performance.now(); };
    const tick = () => { if (XSK.pv !== P) return; P.raf = requestAnimationFrame(tick); const w = cv.clientWidth, h = cv.clientHeight; if (!w || !h) return;
      if (w !== P.w || h !== P.h) { P.w = w; P.h = h; P.r.setSize(w, h, false); P.cam.aspect = w / h; P.cam.updateProjectionMatrix(); }
      const status=document.getElementById('xskStatus'),u=P.gun&&P.gun.userData;if(status&&u)status.textContent=u.xskPending?'Loading original skin…':u.xskError?'Skin failed to load. Select it again to retry.':'';
      if (!P.drag && performance.now() - (P.t0 || 0) > 2500) P.yaw += 0.006; P.piv.rotation.set(P.pitch, P.yaw, 0); P.r.render(P.sc, P.cam); };
    P.raf = requestAnimationFrame(tick); }
  const w = XSK.w, id = xskValidFor(w, XSK.pick) ? XSK.pick : xskGet(w);
  if (P.key !== w) { if (P.obj) P.piv.remove(P.obj); const g = xGun(w), box = new THREE.Box3().setFromObject(g), c = box.getCenter(new THREE.Vector3()), s = box.getSize(new THREE.Vector3()), L = Math.max(s.x, s.y, s.z) || 1;
    const hold = new THREE.Group(); g.position.sub(c); hold.add(g); hold.scale.setScalar(1 / L); if (w === 'Knife') hold.rotation.z = 0.5; P.gun = g; P.obj = hold; P.piv.add(hold); P.key = w; P.cam.position.set(0, 0.05, 1.65); P.cam.lookAt(0, 0, 0); }
  xskApply(P.gun, w, id);
}
function xskPvStop() { const P = XSK.pv; if (!P) return; XSK.pv = null; try { cancelAnimationFrame(P.raf); } catch (e) {} try { P.r.dispose(); if (P.r.forceContextLoss) P.r.forceContextLoss(); } catch (e) {} }
function xskBuild() {
  let root = document.getElementById('xSk'); if (root) return root; if (!document.body) return null;
  const st = document.createElement('style'); st.id = 'xSkCss'; st.textContent = XSK_CSS; document.head.appendChild(st);
  root = document.createElement('div'); root.id = 'xSk'; root.hidden = true; root.setAttribute('role', 'dialog'); root.setAttribute('aria-label', 'Collection and Store');
  root.innerHTML = '<header class="xsk-top"><nav class="xsk-tabs" role="tablist"><button role="tab" data-tab="col" data-a="tab" data-id="col">Collection</button><button role="tab" data-tab="store" data-a="tab" data-id="store">Store</button></nav><button class="xsk-spr" data-a="sprays">Sprays</button><button class="xsk-x" data-a="close" aria-label="Close">×</button></header><div class="xsk-body"></div>';
  root.addEventListener('click', (e) => { const b = e.target && e.target.closest ? e.target.closest('[data-a]') : null; if (!b || b.disabled) return; const a = b.dataset.a;
    if (a === 'close') return xskClose(); if (a === 'sprays') { try { open('mInv'); } catch (er) {} return; }
    xskAct(a, b.dataset.w, b.dataset.id, b.dataset.n); });
  addEventListener('keydown', (e) => { if (e.code === 'Escape' && !root.hidden && !document.querySelector('.modal.on')) { e.stopImmediatePropagation(); xskClose(); } }, true);
  document.body.appendChild(root); return root;
}
const XSK_CSS = '#xSk{position:fixed;inset:0;z-index:38;display:flex;flex-direction:column;background:radial-gradient(120% 90% at 70% 30%,#1b2a38 0,#0f1923 60%);color:#ece8e1;font-family:Geist,"Segoe UI",system-ui,-apple-system,Roboto,Helvetica,Arial,sans-serif;overflow:hidden}#xSk[hidden]{display:none}' +
  '#xSk button{font:inherit;color:inherit;cursor:pointer}#xSk .xsk-top{display:flex;align-items:center;gap:12px;padding:12px 20px;border-bottom:1px solid rgba(236,232,225,.12);flex:none}' +
  '#xSk .xsk-tabs{display:flex;gap:4px;flex:1}#xSk .xsk-tabs button{background:none;border:0;border-bottom:3px solid transparent;padding:10px 14px;min-height:44px;font-weight:800;letter-spacing:.16em;text-transform:uppercase;font-size:14px;opacity:.6}#xSk .xsk-tabs button.on{opacity:1;border-color:#ff4655}' +
  '#xSk .xsk-spr,#xSk .xsk-x{background:rgba(236,232,225,.06);border:1px solid rgba(236,232,225,.16);min-height:44px;min-width:44px;padding:0 12px;letter-spacing:.12em;text-transform:uppercase;font-size:12px;font-weight:700}#xSk .xsk-x{font-size:24px;padding:0}' +
  '#xSk .xsk-body{flex:1;min-height:0;overflow:auto;overscroll-behavior:contain;padding:16px 20px 24px}' +
  '#xSk .xsk-cat h3{margin:14px 0 8px;font-size:12px;letter-spacing:.2em;text-transform:uppercase;color:rgba(236,232,225,.6)}#xSk .xsk-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px}' +
  '#xSk .xsk-wc{display:grid;grid-template-columns:44px 1fr;grid-template-rows:auto auto;column-gap:10px;text-align:left;align-items:center;background:rgba(236,232,225,.05);border:1px solid rgba(236,232,225,.12);padding:8px;min-height:56px}#xSk .xsk-wc:hover,#xSk .xsk-wc:focus-visible{border-color:#ff4655;background:rgba(255,70,85,.08)}' +
  '#xSk .xsk-wc i{grid-row:span 2;width:44px;height:36px;display:block;}#xSk .xsk-wc b{font-size:14px;letter-spacing:.06em;text-transform:uppercase}#xSk .xsk-wc small,#xSk .xsk-sk small{font-size:11px;color:rgba(236,232,225,.6)}' +
  '#xSk .xsk-wv{display:grid;grid-template-columns:minmax(200px,260px) 1fr;gap:16px;height:100%;min-height:0}#xSk .xsk-wl{display:flex;flex-direction:column;gap:6px;overflow:auto;min-height:0}#xSk .xsk-wl h3{margin:4px 0;font-size:22px;letter-spacing:.14em;text-transform:uppercase}' +
  '#xSk .xsk-back{align-self:flex-start;background:none;border:0;opacity:.7;min-height:44px;padding:0;letter-spacing:.1em;text-transform:uppercase;font-size:12px}' +
  '#xSk .xsk-sk{display:flex;gap:10px;align-items:center;text-align:left;background:rgba(236,232,225,.05);border:1px solid rgba(236,232,225,.12);padding:6px 8px;min-height:48px}#xSk .xsk-sk.on{border-color:#ff4655;background:rgba(255,70,85,.1)}#xSk .xsk-sk.lock{opacity:.75}#xSk .xsk-sk i{width:34px;height:34px;flex:none}#xSk .xsk-sk span{display:flex;flex-direction:column}' +
  '#xSk .xsk-pv{position:relative;display:flex;flex-direction:column;min-height:0}#xSk #xskCv{flex:1;min-height:160px;width:100%;touch-action:none;cursor:grab}#xSk .xsk-pn{margin:0;display:flex;gap:8px;align-items:baseline;flex-wrap:wrap}#xSk .xsk-pn b{font-size:18px;letter-spacing:.08em;text-transform:uppercase}#xSk .xsk-pn small{flex-basis:100%;color:rgba(236,232,225,.6)}' +
  '#xSk .xsk-ch{display:flex;gap:8px;margin:10px 0}#xSk .xsk-ch button{width:44px;height:44px;border:2px solid rgba(236,232,225,.2)}#xSk .xsk-ch button.on{border-color:#ece8e1;outline:2px solid #ff4655;outline-offset:2px}' +
  '#xSk .xsk-act{display:flex;gap:8px}#xSk .xsk-get,#xSk .xsk-eq{min-height:48px;padding:0 28px;border:0;font-weight:800;letter-spacing:.16em;text-transform:uppercase;font-size:13px}#xSk .xsk-get{background:#ff4655;color:#0f1923}#xSk .xsk-eq{background:#ece8e1;color:#0f1923}#xSk .xsk-eq[disabled]{opacity:.55;cursor:default}' +
  '#xSk .xsk-free{font-weight:800;letter-spacing:.14em;color:#5fffb0}' +
  '#xSk .xsk-feat{position:relative;padding:28px 24px;min-height:180px;background:linear-gradient(110deg,rgba(15,25,35,.95) 30%,rgba(15,25,35,.2)),linear-gradient(135deg,var(--a) 0 55%,var(--b) 55% 62%,var(--a) 62%);border:1px solid rgba(236,232,225,.14);display:flex;flex-direction:column;gap:8px;justify-content:flex-end}' +
  '#xSk .xsk-feat h2{margin:0;font-size:30px;letter-spacing:.1em;text-transform:uppercase}#xSk .xsk-feat p{margin:0;max-width:520px;color:rgba(236,232,225,.8)}#xSk .xsk-eb{font-size:12px;letter-spacing:.24em;text-transform:uppercase;color:#ff4655!important}#xSk .xsk-fb{display:flex;gap:12px;align-items:center;flex-wrap:wrap;margin-top:6px}#xSk .xsk-fb small{color:rgba(236,232,225,.6)}' +
  '#xSk .xsk-daily h3{margin:20px 0 10px;font-size:14px;letter-spacing:.18em;text-transform:uppercase;display:flex;gap:12px;align-items:baseline;flex-wrap:wrap}#xSk .xsk-daily h3 small{font-size:11px;color:rgba(236,232,225,.6);letter-spacing:.08em}' +
  '#xSk .xsk-offers{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}#xSk .xsk-of{display:flex;flex-direction:column;gap:6px;padding:12px;background:rgba(236,232,225,.05);border:1px solid rgba(236,232,225,.12);border-top:3px solid var(--t)}#xSk .xsk-of i{height:64px;display:block}#xSk .xsk-of small{color:var(--t);letter-spacing:.12em;text-transform:uppercase;font-size:11px}#xSk .xsk-of .xsk-get,#xSk .xsk-of .xsk-eq{padding:0 12px;min-height:44px}' +
  '#xSk .xsk-all .xsk-of i{height:40px}#xSk .xsk-fine{margin-top:16px;font-size:12px;color:rgba(236,232,225,.55)}' +
  '@media(max-width:820px){#xSk .xsk-offers{grid-template-columns:repeat(2,1fr)}}' +
  '@media(max-width:600px){#xSk .xsk-top{padding:6px 10px;gap:6px}#xSk .xsk-body{padding:10px 12px 18px}#xSk .xsk-wv{grid-template-columns:1fr;grid-template-rows:minmax(220px,42vh) auto;height:auto}#xSk .xsk-pv{grid-row:1}#xSk .xsk-wl{grid-row:2;overflow:visible}#xSk .xsk-grid{grid-template-columns:repeat(2,1fr)}#xSk .xsk-feat{padding:18px 14px;min-height:150px}#xSk .xsk-feat h2{font-size:22px}}' +
  '@media(max-height:480px){#xSk .xsk-top{padding:2px 10px}#xSk .xsk-tabs button{padding:6px 10px;font-size:12px}#xSk .xsk-body{padding:8px 12px 12px}#xSk .xsk-wv{grid-template-columns:200px 1fr;height:100%}#xSk .xsk-wl h3{font-size:16px}#xSk .xsk-sk{min-height:44px;padding:4px 6px}#xSk .xsk-sk i{width:28px;height:28px}#xSk #xskCv{min-height:120px}#xSk .xsk-ch{margin:4px 0}#xSk .xsk-lr small{display:none}#xSk .xsk-lr{padding:2px 6px}#xSk .xsk-tg{min-height:34px}#xSk .xsk-pn small{display:none}#xSk .xsk-feat{min-height:0;padding:12px 14px}#xSk .xsk-feat h2{font-size:20px}#xSk .xsk-daily h3{margin:10px 0 6px}#xSk .xsk-of i{height:36px}#xSk .xsk-cat h3{margin:8px 0 6px}}';
// Lobby wiring: Collection opens the Collection page (was the old swatch modal, which now holds Sprays only); a Store
// button joins the lobby nav. The old modal's skin list is hidden (its picks were colour-only and never persisted).
try { const inv = document.getElementById('navInv'); if (inv) inv.onclick = () => xskOpen('col');
  const nav = inv && inv.parentNode; if (nav && !document.getElementById('navStore')) { const b = document.createElement('button'); b.id = 'navStore'; b.dataset.nav = 'store'; b.setAttribute('aria-label', 'Store');
    b.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M4 9h16l-1.5 11h-13z"/><path d="M8 9V7a4 4 0 018 0v2"/></svg><span class="x-nl">Store</span>'; b.onclick = () => xskOpen('store'); nav.insertBefore(b, inv.nextSibling); }
  const il = document.getElementById('invList'); if (il) { il.hidden = true; il.style.display = 'none'; const p = il.previousElementSibling; if (p && p.tagName === 'P') p.hidden = true; }
  const hi = document.getElementById('hInv'); if (hi) hi.textContent = 'Sprays'; } catch (e) {}
try { xskApplyAll(true); } catch (e) {}
window.xValorantSkins={state:XSK,open:xskOpen,equip:xskEquip,give:xskGive,apply:xskApply,template:xskTemplate};
// ---- END WEAPON SKINS ----
