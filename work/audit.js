// Headless load-path audit for index.html. Usage: node work/audit.js [nothree]
// Minimal fake DOM (parser + selector engine + events), fake timers, Proxy THREE.
"use strict";
const fs = require("fs"), vm = require("vm"), path = require("path");
// nothree: the THREE script failed to load. midthrow: THREE loads but the 3D init throws part way (CanvasTexture).
const MID = process.argv.includes("midthrow"), NO3 = process.argv.includes("nothree") || MID;
const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
// ---------- knife back-stab check: bot yaw set exactly as the bot AI does (atan2(dx, dz) toward its aim) ----------
{
  const src = (html.match(/function kBack\([^\n]*\n/) || [""])[0], kBack = src ? new Function(src + "; return kBack;")() : null;
  const pl = { x: 0, z: 0 }, bt = { x: 0, z: -2 }; // bot 2 m in front of the player
  const faceP = Math.atan2(pl.x - bt.x, pl.z - bt.z), away = Math.atan2(bt.x - pl.x, bt.z - pl.z);
  const okAway = !!kBack && kBack(away, pl.x, pl.z, bt.x, bt.z) === true, okFace = !!kBack && kBack(faceP, pl.x, pl.z, bt.x, bt.z) === false;
  console.log("knife back-stab: facing away -> " + (okAway ? "back-stab OK" : "FAIL") + "; facing player -> " + (okFace ? "no back-stab OK" : "FAIL"));
  if (!okAway || !okFace) process.exitCode = 1;
}

// ---------- errors ----------
const errors = []; let phase = "load";
const rec = (where, e) => errors.push({ phase, where, msg: String((e && e.stack) || e).split("\n").slice(0, 3).join(" | ") });

// ---------- fake DOM ----------
const VOID = new Set("area,base,br,col,embed,hr,img,input,link,meta,source,track,wbr".split(","));
class Node_ { constructor() { this.parentNode = null; this.childNodes = []; } }
class Text_ extends Node_ { constructor(t) { super(); this.nodeType = 3; this.data = t; } get textContent() { return this.data; } set textContent(v) { this.data = String(v); } }
const listeners = new WeakMap();
const ET = {
  addEventListener(t, f, o) { if (!f) return; let m = listeners.get(this); if (!m) listeners.set(this, (m = {})); (m[t] = m[t] || []).push({ f, cap: !!(o === true || (o && o.capture)) }); },
  removeEventListener(t, f) { const m = listeners.get(this); if (m && m[t]) m[t] = m[t].filter((l) => l.f !== f); },
  dispatchEvent(ev) { return dispatch(this, ev); },
};
function hasHandler(el, t) { const m = listeners.get(el); return typeof el["on" + t] === "function" || !!(m && m[t] && m[t].length); }
function dispatch(target, ev) {
  ev.target = target; const pathN = []; for (let n = target; n; n = n.parentNode || (n === docEl ? doc : n === doc ? win : null)) pathN.push(n);
  const call = (n, cap) => {
    if (ev._stop) return; ev.currentTarget = n; const m = listeners.get(n), ls = m && m[ev.type] ? m[ev.type].slice() : [];
    for (const l of ls) { if (l.cap !== cap && n !== target) continue; if (ev._stopI) return; try { l.f.call(n, ev); } catch (e) { rec(ev.type + " listener on " + desc(n), e); try { win.onerror && win.onerror(String(e), "", 0, 0, e); } catch (_) {} } }
    if (!cap && typeof n["on" + ev.type] === "function") { try { const r = n["on" + ev.type].call(n, ev); if (r && r.catch) r.catch((e) => rec("async on" + ev.type, e)); } catch (e) { rec("on" + ev.type + " on " + desc(n), e); try { win.onerror && win.onerror(String(e), "", 0, 0, e); } catch (_) {} } }
  };
  for (let i = pathN.length - 1; i > 0; i--) call(pathN[i], true);
  call(target, false);
  if (ev.bubbles !== false) for (let i = 1; i < pathN.length; i++) call(pathN[i], false);
  return !ev.defaultPrevented;
}
function mkEvent(type, o) { return Object.assign({ type, bubbles: true, defaultPrevented: false, preventDefault() { this.defaultPrevented = true; }, stopPropagation() { this._stop = true; }, stopImmediatePropagation() { this._stop = this._stopI = true; }, clientX: 100, clientY: 100, button: 0, buttons: 0, pointerId: 1, key: "", code: "", touches: [], changedTouches: [], movementX: 0, movementY: 0, deltaY: 0 }, o || {}); }
const desc = (n) => (n === win ? "window" : n === doc ? "document" : n.tagName ? n.tagName.toLowerCase() + (n.id ? "#" + n.id : "") + (n.className ? "." + String(n.className).split(" ")[0] : "") : "?");

function ctx2d(cv) {
  const store = {};
  const fn = () => undefined;
  return new Proxy(store, { get(t, k) {
    if (k in t) return t[k]; if (k === "canvas") return cv;
    if (k === "getImageData" || k === "createImageData") return (a, b, w, h) => { const W = w || a || 1, H = h || b || 1; return { width: W, height: H, data: new Uint8ClampedArray(Math.max(1, (W * H) | 0) * 4) }; };
    if (/^create(Linear|Radial|Conic)Gradient$|^createPattern$/.test(k)) return () => ({ addColorStop() {} });
    if (k === "measureText") return (s) => ({ width: String(s).length * 7, actualBoundingBoxAscent: 8, actualBoundingBoxDescent: 2 });
    if (k === "getTransform") return () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 });
    if (typeof k === "symbol") return undefined;
    return fn;
  }, set(t, k, v) { t[k] = v; return true; } });
}
class El extends Node_ {
  constructor(tag) {
    super(); this.nodeType = 1; this.tagName = tag.toUpperCase(); this.attrs = new Map(); this._style = null;
    if (this.tagName === "CANVAS") { this.width = 300; this.height = 150; }
    if (this.tagName === "INPUT") this._value = "";
  }
  get localName() { return this.tagName.toLowerCase(); }
  get nodeName() { return this.tagName; }
  getAttribute(k) { return this.attrs.has(k) ? this.attrs.get(k) : null; }
  setAttribute(k, v) { this.attrs.set(k, String(v)); if (k === "value" && this.tagName === "INPUT") this._value = String(v); }
  hasAttribute(k) { return this.attrs.has(k); }
  removeAttribute(k) { this.attrs.delete(k); }
  toggleAttribute(k, f) { const on = f === undefined ? !this.attrs.has(k) : !!f; on ? this.attrs.set(k, "") : this.attrs.delete(k); return on; }
  get id() { return this.getAttribute("id") || ""; } set id(v) { this.setAttribute("id", v); }
  get className() { return this.getAttribute("class") || ""; } set className(v) { this.setAttribute("class", v); }
  get hidden() { return this.attrs.has("hidden"); } set hidden(v) { this.toggleAttribute("hidden", !!v); }
  get disabled() { return this.attrs.has("disabled"); } set disabled(v) { this.toggleAttribute("disabled", !!v); }
  get value() { return this.tagName === "INPUT" ? this._value || this.getAttribute("value") || "" : this.getAttribute("value") || ""; } set value(v) { this._value = String(v); }
  get checked() { return this.attrs.has("checked"); } set checked(v) { this.toggleAttribute("checked", !!v); }
  get tabIndex() { return +(this.getAttribute("tabindex") || 0); } set tabIndex(v) { this.setAttribute("tabindex", v); }
  get title() { return this.getAttribute("title") || ""; } set title(v) { this.setAttribute("title", v); }
  get src() { return this.getAttribute("src") || ""; } set src(v) { this.setAttribute("src", v); }
  get classList() {
    const el = this, get = () => el.className.split(/\s+/).filter(Boolean), put = (a) => el.setAttribute("class", a.join(" "));
    return { add: (...c) => put([...new Set(get().concat(c))]), remove: (...c) => put(get().filter((x) => !c.includes(x))), contains: (c) => get().includes(c),
      toggle: (c, f) => { const has = get().includes(c), on = f === undefined ? !has : !!f; on ? put([...new Set(get().concat([c]))]) : put(get().filter((x) => x !== c)); return on; },
      get length() { return get().length; }, forEach: (f) => get().forEach(f), item: (i) => get()[i], replace: (a, b) => put(get().map((x) => (x === a ? b : x))) };
  }
  get dataset() {
    const el = this, k2a = (k) => "data-" + k.replace(/[A-Z]/g, (m) => "-" + m.toLowerCase());
    return new Proxy({}, { get: (t, k) => (typeof k === "string" && el.attrs.has(k2a(k)) ? el.attrs.get(k2a(k)) : undefined), set: (t, k, v) => (el.setAttribute(k2a(k), v), true),
      has: (t, k) => el.attrs.has(k2a(k)), deleteProperty: (t, k) => (el.attrs.delete(k2a(k)), true) });
  }
  get style() {
    if (!this._style) { const s = {}; Object.defineProperties(s, { setProperty: { value: (k, v) => (s[k] = String(v)) }, getPropertyValue: { value: (k) => s[k] || "" }, removeProperty: { value: (k) => { const o = s[k]; delete s[k]; return o || ""; } }, cssText: { get: () => "", set: () => {} } });
      const inl = this.getAttribute("style"); if (inl) inl.split(";").forEach((d) => { const i = d.indexOf(":"); if (i > 0) s[d.slice(0, i).trim()] = d.slice(i + 1).trim(); });
      this._style = s; }
    return this._style;
  }
  get children() { return this.childNodes.filter((n) => n.nodeType === 1); }
  get firstChild() { return this.childNodes[0] || null; } get lastChild() { return this.childNodes[this.childNodes.length - 1] || null; }
  get firstElementChild() { return this.children[0] || null; } get lastElementChild() { const c = this.children; return c[c.length - 1] || null; }
  get childElementCount() { return this.children.length; }
  get parentElement() { return this.parentNode && this.parentNode.nodeType === 1 ? this.parentNode : null; }
  get nextSibling() { const p = this.parentNode; if (!p) return null; const i = p.childNodes.indexOf(this); return p.childNodes[i + 1] || null; }
  get nextElementSibling() { const p = this.parentNode; if (!p) return null; const c = p.children; return c[c.indexOf(this) + 1] || null; }
  get previousElementSibling() { const p = this.parentNode; if (!p) return null; const c = p.children; return c[c.indexOf(this) - 1] || null; }
  get textContent() { return this.childNodes.map((n) => n.textContent).join(""); }
  set textContent(v) { this.childNodes.forEach((n) => (n.parentNode = null)); this.childNodes = []; const s = String(v == null ? "" : v); if (s) this._ins(new Text_(s)); }
  get innerText() { return this.textContent; } set innerText(v) { this.textContent = v; }
  get innerHTML() { return this.childNodes.map(ser).join(""); }
  set innerHTML(v) { this.childNodes.forEach((n) => (n.parentNode = null)); this.childNodes = []; parseInto(this, String(v == null ? "" : v)); }
  get outerHTML() { return ser(this); }
  insertAdjacentHTML(pos, h) { const tmp = new El("div"); parseInto(tmp, h); const ns = tmp.childNodes.slice(); ns.forEach((n) => (n.parentNode = null));
    if (pos === "beforeend") ns.forEach((n) => this._ins(n)); else if (pos === "afterbegin") ns.reverse().forEach((n) => this._ins(n, 0));
    else if (pos === "beforebegin") ns.forEach((n) => this.parentNode._ins(n, this.parentNode.childNodes.indexOf(this))); else ns.reverse().forEach((n) => this.parentNode._ins(n, this.parentNode.childNodes.indexOf(this) + 1)); }
  _ins(n, i) { if (typeof n === "string") n = new Text_(n); if (!(n instanceof Node_)) throw new TypeError("Failed to execute: parameter is not of type 'Node'."); if (n.parentNode) n.parentNode.removeChild(n); n.parentNode = this; i === undefined ? this.childNodes.push(n) : this.childNodes.splice(i, 0, n); return n; }
  appendChild(n) { return this._ins(n); } append(...ns) { ns.forEach((n) => this._ins(n)); } prepend(...ns) { ns.reverse().forEach((n) => this._ins(n, 0)); }
  insertBefore(n, ref) { return this._ins(n, ref ? this.childNodes.indexOf(ref) : undefined); }
  removeChild(n) { const i = this.childNodes.indexOf(n); if (i < 0) throw new Error("NotFoundError: not a child"); this.childNodes.splice(i, 1); n.parentNode = null; return n; }
  remove() { if (this.parentNode) this.parentNode.removeChild(this); }
  replaceWith(n) { const p = this.parentNode; if (!p) return; p._ins(n, p.childNodes.indexOf(this)); p.removeChild(this); }
  replaceChildren(...ns) { this.textContent = ""; this.append(...ns); }
  cloneNode(deep) { const c = new El(this.tagName); this.attrs.forEach((v, k) => c.attrs.set(k, v)); if (deep) parseInto(c, this.innerHTML); return c; }
  contains(n) { for (; n; n = n.parentNode) if (n === this) return true; return false; }
  matches(sel) { return matchSel(this, sel); }
  closest(sel) { for (let n = this; n && n.nodeType === 1; n = n.parentNode) if (matchSel(n, sel)) return n; return null; }
  querySelectorAll(sel) { const out = []; walk(this, (n) => { if (matchSel(n, sel, this)) out.push(n); }); return out; }
  querySelector(sel) { return this.querySelectorAll(sel)[0] || null; }
  getElementsByTagName(t) { return this.querySelectorAll(t); }
  click() { if (this.disabled) return; dispatch(this, mkEvent("click")); }
  focus() { doc.activeElement = this; } blur() { if (doc.activeElement === this) doc.activeElement = doc.body; }
  scrollIntoView() {} scrollTo() {} animate() { return { finished: Promise.resolve(), cancel() {}, onfinish: null }; }
  getBoundingClientRect() { return { x: 0, y: 0, left: 0, top: 0, right: 200, bottom: 100, width: 200, height: 100 }; }
  getClientRects() { return [this.getBoundingClientRect()]; }
  get clientWidth() { return this.tagName === "CANVAS" ? this.width : 200; } get clientHeight() { return this.tagName === "CANVAS" ? this.height : 100; }
  get offsetWidth() { return 200; } get offsetHeight() { return 100; } get offsetLeft() { return 0; } get offsetTop() { return 0; }
  get scrollHeight() { return 100; } get scrollWidth() { return 200; }
  getContext(t) { if (this.tagName !== "CANVAS") return undefined; if (t === "2d") return this._c2 || (this._c2 = ctx2d(this)); return null; }
  toDataURL() { return "data:image/png;base64,"; }
  requestPointerLock() { doc.pointerLockElement = this; return Promise.resolve(); }
  requestFullscreen() { return Promise.resolve(); }
  setPointerCapture() {} releasePointerCapture() {} hasPointerCapture() { return false; }
}
Object.assign(El.prototype, ET); Object.assign(Text_.prototype, ET);
function walk(root, f) { for (const c of root.childNodes) if (c.nodeType === 1) { f(c); walk(c, f); } }
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
function ser(n) { if (n.nodeType === 3) return esc(n.data); let a = ""; n.attrs.forEach((v, k) => (a += ` ${k}="${String(v).replace(/"/g, "&quot;")}"`)); const t = n.tagName.toLowerCase(); return VOID.has(t) ? `<${t}${a}>` : `<${t}${a}>${n.innerHTML}</${t}>`; }
const ent = (s) => s.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (m, e) => (e[0] === "#" ? String.fromCodePoint(e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : +e.slice(1)) : { amp: "&", lt: "<", gt: ">", quot: '"', nbsp: "\u00a0", apos: "'", middot: "·", times: "×" }[e] || m));
function parseInto(root, h) {
  let cur = root, i = 0; const re = /<!--[\s\S]*?-->|<\/([a-zA-Z0-9-]+)\s*>|<([a-zA-Z][a-zA-Z0-9-]*)((?:\s+[^\s=>\/]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?)*)\s*(\/?)>/g; let m;
  const RAW = new Set(["script", "style"]);
  while ((m = re.exec(h))) {
    if (m.index > i) { const t = h.slice(i, m.index); if (t) cur._ins(new Text_(ent(t))); }
    i = re.lastIndex;
    if (m[0].startsWith("<!--")) continue;
    if (m[1]) { const t = m[1].toUpperCase(); let n = cur; while (n !== root && n.tagName !== t) n = n.parentNode; if (n !== root) cur = n.parentNode; continue; }
    const el = new El(m[2]); const ar = /([^\s=>\/]+)(?:\s*=\s*("[^"]*"|'[^']*'|[^\s>]+))?/g; let a;
    while ((a = ar.exec(m[3]))) { let v = a[2] === undefined ? "" : a[2]; if (/^["']/.test(v)) v = v.slice(1, -1); el.attrs.set(a[1].toLowerCase(), ent(v)); }
    cur._ins(el);
    const tl = m[2].toLowerCase();
    if (RAW.has(tl)) { const end = h.toLowerCase().indexOf("</" + tl, i); const body = h.slice(i, end < 0 ? h.length : end); if (body) el._ins(new Text_(body)); i = end < 0 ? h.length : h.indexOf(">", end) + 1; re.lastIndex = i; continue; }
    if (!VOID.has(tl) && !m[4]) cur = el;
  }
  if (i < h.length) { const t = h.slice(i); if (t) cur._ins(new Text_(ent(t))); }
}
// selectors: compound (tag #id .cls [attr] [attr="v"] :not(x)) with descendant / child combinators, comma lists
function parseCompound(s) {
  const c = { tag: null, id: null, cls: [], attr: [], not: [] }; const re = /^(\*|[a-zA-Z][\w-]*)|#([\w-]+)|\.([\w-]+)|\[([\w-]+)(?:([~|^$*]?=)("[^"]*"|'[^']*'|[^\]]*))?\]|:not\(([^)]*)\)|:([\w-]+)/g; let m;
  while ((m = re.exec(s))) { if (m[1] && m[1] !== "*") c.tag = m[1].toUpperCase(); else if (m[2]) c.id = m[2]; else if (m[3]) c.cls.push(m[3]); else if (m[4]) { let v = m[6]; if (v && /^["']/.test(v)) v = v.slice(1, -1); c.attr.push([m[4], m[5], v]); } else if (m[7]) c.not.push(m[7]); else if (m[8]) c.pseudo = m[8]; }
  return c;
}
function matchCompound(el, c) {
  if (el.nodeType !== 1) return false; if (c.tag && el.tagName !== c.tag) return false; if (c.id && el.id !== c.id) return false;
  if (c.cls.length) { const k = el.className.split(/\s+/); if (!c.cls.every((x) => k.includes(x))) return false; }
  for (const [n, op, v] of c.attr) { if (!el.attrs.has(n)) return false; const a = el.attrs.get(n); if (op === "=" && a !== v) return false; if (op === "^=" && !a.startsWith(v)) return false; if (op === "*=" && !a.includes(v)) return false; if (op === "~=" && !a.split(/\s+/).includes(v)) return false; }
  for (const s of c.not) if (matchSel(el, s)) return false;
  if (c.pseudo === "disabled" && !el.disabled) return false; if (c.pseudo === "checked" && !el.checked) return false;
  if (c.pseudo === "first-child" && el.parentNode && el.parentNode.children[0] !== el) return false;
  return true;
}
const selCache = new Map();
function compile(sel) {
  if (selCache.has(sel)) return selCache.get(sel);
  const groups = sel.split(",").map((g) => { const toks = g.trim().replace(/\s*>\s*/g, " > ").split(/\s+/); const parts = []; let comb = " "; for (const t of toks) { if (t === ">") { comb = ">"; continue; } parts.push({ c: parseCompound(t), comb }); comb = " "; } return parts; });
  selCache.set(sel, groups); return groups;
}
function matchSel(el, sel, scope) {
  return compile(sel).some((parts) => {
    const m = (n, i) => { if (!matchCompound(n, parts[i].c)) return false; if (i === 0) return true; const comb = parts[i].comb;
      if (comb === ">") { const p = n.parentNode; return !!(p && p.nodeType === 1 && m(p, i - 1)); }
      for (let p = n.parentNode; p && p.nodeType === 1; p = p.parentNode) if (m(p, i - 1)) return true; return false; };
    return m(el, parts.length - 1);
  });
}

// ---------- document / window ----------
const docEl = new El("html");
const bodyStart = html.indexOf("<body"), headPart = html.slice(html.indexOf("<head"), bodyStart);
const headEl = new El("head"), bodyEl = new El("body"); docEl._ins(headEl); docEl._ins(bodyEl);
parseInto(headEl, headPart.replace(/^<head[^>]*>/, "").replace(/<\/head>[\s\S]*$/, ""));
const bodyHtml = html.slice(html.indexOf(">", bodyStart) + 1, html.lastIndexOf("</body>"));
parseInto(bodyEl, bodyHtml);
const doc = { nodeType: 9, documentElement: docEl, head: headEl, body: bodyEl, activeElement: bodyEl, pointerLockElement: null, fullscreenElement: null, hidden: false, visibilityState: "visible", readyState: "complete",
  getElementById: (id) => { let r = null; walk(docEl, (n) => { if (!r && n.id === id) r = n; }); return r; },
  querySelector: (s) => docEl.querySelector(s) || (matchSel(docEl, s) ? docEl : null), querySelectorAll: (s) => docEl.querySelectorAll(s),
  createElement: (t) => new El(t), createElementNS: (ns, t) => new El(t), createTextNode: (t) => new Text_(t), createDocumentFragment: () => new El("fragment"),
  exitPointerLock() { doc.pointerLockElement = null; }, exitFullscreen() { return Promise.resolve(); }, hasFocus: () => true, };
Object.assign(doc, ET);
docEl.parentNode = null;

// fake clock + timers
let now = 1000, tid = 1; const timers = new Map(); let rafQ = [];
const setT = (f, ms, rep, args) => { const id = tid++; timers.set(id, { f, at: now + Math.max(0, +ms || 0), ms: Math.max(1, +ms || 0), rep, args }); return id; };
function runTimers(until) {
  for (;;) { let best = null; for (const [id, t] of timers) if (t.at <= until && (!best || t.at < best[1].at)) best = [id, t]; if (!best) break;
    const [id, t] = best; now = Math.max(now, t.at); if (t.rep) t.at += t.ms; else timers.delete(id);
    try { typeof t.f === "function" ? t.f(...(t.args || [])) : null; } catch (e) { rec("timer", e); try { win.onerror && win.onerror(String(e), "", 0, 0, e); } catch (_) {} } }
  now = Math.max(now, until);
}
function frame() { runTimers(now + 1000 / 60); const q = rafQ; rafQ = []; for (const r of q) { try { r.f(now); } catch (e) { rec("rAF", e); try { win.onerror && win.onerror(String(e), "", 0, 0, e); } catch (_) {} } } }
const advance = (ms) => { const end = now + ms; while (now < end) frame(); };
const frames = (n) => { for (let i = 0; i < n; i++) frame(); };

// THREE stub: every property is a callable, constructible proxy; sets read back
function stub(name) {
  const store = new Map(), cache = new Map(); const tgt = function () {};
  const p = new Proxy(tgt, {
    get(t, k) {
      if (store.has(k)) return store.get(k);
      if (k === Symbol.toPrimitive) return (hint) => (hint === "string" ? "" : 0);
      if (k === Symbol.iterator) return function* () {};
      if (typeof k === "symbol") return undefined;
      if (k === "then" || k === "toJSON" || k === "nodeType") return undefined;
      if (k === "valueOf") return () => 0; if (k === "toString") return () => "";
            if (k === "REVISION") return "149";
      if (k === "domElement") { if (!cache.has(k)) cache.set(k, doc.createElement("canvas")); return cache.get(k); }
      if (k === "prototype") return tgt.prototype;
      if (!cache.has(k)) cache.set(k, stub(name + "." + String(k))); return cache.get(k);
    },
    set(t, k, v) { store.set(k, v); return true; },
    apply() { return stub(name + "()"); },
    construct() { if (MID && name === "THREE.CanvasTexture") throw new Error("simulated init failure"); return stub("new " + name); },
    has() { return true; },
  });
  return p;
}
const xErrCalls = [];
const win = {
  document: doc, navigator: { userAgent: "Mozilla/5.0 (headless audit)", maxTouchPoints: 0, platform: "Linux", language: "en", getGamepads: () => [], vibrate: () => false },
  location: { href: "file:///index.html", search: "", hash: "", reload() {} }, screen: { width: 1280, height: 720, orientation: { type: "landscape-primary", angle: 0, lock: () => Promise.resolve() } },
  innerWidth: 1280, innerHeight: 720, devicePixelRatio: 1, console: { log() {}, info() {}, warn() {}, debug() {}, error: (...a) => {} },
  setTimeout: (f, ms, ...a) => setT(f, ms, false, a), setInterval: (f, ms, ...a) => setT(f, ms, true, a), clearTimeout: (id) => timers.delete(id), clearInterval: (id) => timers.delete(id),
  requestAnimationFrame: (f) => { const id = tid++; rafQ.push({ id, f }); return id; }, cancelAnimationFrame: (id) => { rafQ = rafQ.filter((r) => r.id !== id); },
  performance: { now: () => now }, matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }),
  getComputedStyle: (el) => new Proxy({}, { get: (t, k) => (k === "getPropertyValue" ? () => "" : "") }),
  HTMLElement: El, Element: El, Node: Node_, HTMLCanvasElement: El, Event: function (t, o) { return mkEvent(t, o); }, CustomEvent: function (t, o) { return mkEvent(t, o); },
  KeyboardEvent: function (t, o) { return mkEvent(t, o); }, MouseEvent: function (t, o) { return mkEvent(t, o); }, PointerEvent: function (t, o) { return mkEvent(t, o); },
  Image: function () { return doc.createElement("img"); }, ResizeObserver: function () { return { observe() {}, disconnect() {}, unobserve() {} }; },
  IntersectionObserver: function () { return { observe() {}, disconnect() {}, unobserve() {} }; },
  AudioContext: function () { return stub("AudioContext"); }, visualViewport: null, scrollTo() {}, focus() {}, blur() {}, open() {},
  URL, URLSearchParams, TextEncoder, TextDecoder, structuredClone, queueMicrotask, atob, btoa,
};
for (const k in ET) win[k] = ET[k].bind(win); win.window = win; win.self = win; win.globalThis = win;
// no localStorage at all: any access throws, so a use shows up as an error
Object.defineProperty(win, "localStorage", { get() { throw new Error("localStorage used"); } });
Object.defineProperty(win, "sessionStorage", { get() { throw new Error("sessionStorage used"); } });
const context = vm.createContext(win);
vm.runInContext("Date.now = () => performance.now() + 1.7e12;", context);

// ---------- run the page's scripts in order ----------
const scripts = [...html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)];
for (const s of scripts) {
  const src = (s[1].match(/src="([^"]+)"/) || [])[1];
  if (src) { if (/three/.test(src)) { if (!NO3 || MID) win.THREE = stub("THREE"); } else rec("script", "unexpected external script " + src); continue; }
  // nav hook: the page lives in an IIFE, so expose the map boxes + graph builder to work/nav.js (audit-side only)
  const code = s[2].replace("function xgGet() {", "globalThis.__nav = { get FMAP() { return FMAP; }, get SITES() { return SITES; }, get HSITES() { return HSITES; }, get SSITES() { return SSITES; }, get LSITES() { return LSITES; }, get BZSITES() { return BZSITES; }, xgBuild, xgClear, setB: (b) => { boxes = b; }, getB: () => boxes }; function xgGet() {").replace("function srTick(dt) {", "globalThis.__xe = (s) => eval(s); globalThis.__st = () => ({ mode, FV, player, SR, running, srAll: typeof srAll === \"function\" ? srAll : null, fAtk: typeof fAtk === \"function\" ? fAtk : null, K: typeof K === \"function\" ? K : null, J: typeof J !== \"undefined\" ? J : null, wName: typeof wName === \"function\" ? wName : null, fRound: () => fRound() }); function srTick(dt) {");
  try { vm.runInContext(code, context, { filename: "index.html" }); } catch (e) { rec("top-level script", e); }
}
const xErr0 = win.xErr; if (xErr0) win.xErr = function (e) { xErrCalls.push({ phase, msg: String((e && e.message) || e) }); return xErr0.apply(this, arguments); };
advance(500);

// ---------- audit ----------
const $ = (id) => doc.getElementById(id);
const disp = (id) => { const e = $(id); return e ? e.style.display || "" : "missing"; };
const report = []; let lastErr = errors.length, lastX = xErrCalls.length;
function check(label, el, ok) {
  let has = false; for (let n = el; n && n.nodeType === 1 && n !== doc.body && !n.classList.contains("modal"); n = n.parentNode) if (hasHandler(n, "click")) { has = true; break; }
  const e1 = errors.slice(lastErr), x1 = xErrCalls.slice(lastX); lastErr = errors.length; lastX = xErrCalls.length;
  const pass = !!el && has && !e1.length && !x1.length && (ok === undefined || ok);
  report.push({ label, el: !!el, handler: !!has, pass, errs: e1.map((e) => e.where + ": " + e.msg).concat(x1.map((x) => "xErr: " + x.msg)), cond: ok });
}
function clickCheck(label, el, after) { phase = label; const had = el && hasHandler(el, "click"); if (el) el.click(); advance(50); check(label, el, after ? after() : undefined); return had; }
const modalOn = (id) => $(id).classList.contains("on");
const closeModals = () => doc.querySelectorAll(".modal.on").forEach((m) => m.classList.remove("on"));
const toLobby = () => { phase = "toLobby"; ["pre", "xAg", "result", "game"].forEach((i) => ($(i).style.display = "none")); $("lobby").style.display = "flex"; closeModals(); advance(50); lastErr = errors.length; lastX = xErrCalls.length; };

// intro modal close
clickCheck("Intro: Got it", doc.querySelector("#mIntro [data-close]"), () => !modalOn("mIntro"));
// top nav + lobby chrome
{ const want = ["PLAY", "CAREER", "COLLECTION", "AGENTS", "SETTINGS"], got = Array.from(doc.querySelectorAll("#lobby .x-bar .x-lnav [data-nav]")).map((b) => String(b.textContent || "").trim().toUpperCase());
  const ok = disp("lobby") !== "none" && want.every((w, i) => got[i] === w) && got.length === want.length;
  report.push({ label: "Lobby nav shows PLAY/CAREER/COLLECTION/AGENTS/SETTINGS", pass: ok, cond: ok, errs: ok ? [] : ["got: " + got.join(",")] }); }
clickCheck("Lobby nav: PLAY opens the queue panel", $("playBtn"), () => !$("xQueue").hidden && !modalOn("mPlay") && disp("lobby") !== "none" && ["xAg", "pre"].every((i) => ["", "none"].includes(disp(i)))); $("xQueue").hidden = true;
clickCheck("Nav: Career opens the profile", $("navCareer"), () => modalOn("mProf")); closeModals();
clickCheck("Nav: Agents", $("navAg"), () => $("xQueue").hidden);
{ const n = doc.querySelectorAll("#xLobMs li").length, ok = n === 2 && /\d+ \/ 5000 XP/.test($("xXpT").textContent); report.push({ label: "Lobby missions card + XP bar", pass: ok, cond: ok, errs: ok ? [] : ["missions " + n] }); }
clickCheck("Nav: Collection", $("navInv"), () => modalOn("mInv"));
const invBtns = doc.querySelectorAll("#invList button"); if (invBtns[0]) clickCheck("Inventory: weapon name", invBtns[0]); if (invBtns[2]) clickCheck("Inventory: skin swatch", doc.querySelectorAll("#invList button")[2]);
clickCheck("Inventory: Done", doc.querySelector("#mInv .row [data-close]"), () => !modalOn("mInv"));
const inCustom = (el) => { for (let n = el; n; n = n.parentNode) if (n.getAttribute && n.getAttribute("data-q") === "custom" && n.classList.contains("x-qp")) return true; return false; };
const toCustom = () => { if ($("xQueue").hidden) $("playBtn").click(); advance(30); const t = doc.querySelector('#xQueue .x-qtabs [data-q="custom"]'); if (t) t.click(); advance(30); return !!t && !$("xQueue").hidden && !$('xQueue').querySelector('.x-qp[data-q="custom"]').hidden; };
clickCheck("News card: See what's new", doc.querySelector('.x-news [data-open="mPatch"]'), () => modalOn("mPatch"));
clickCheck("News: close ×", doc.querySelector("#mPatch .x"), () => !modalOn("mPatch"));
clickCheck("Get app", doc.querySelector('.x-get[data-open="mApp"]'), () => modalOn("mApp")); closeModals();
clickCheck("Settings", $("setBtn"), () => modalOn("mSet"));
doc.querySelectorAll("#mSet .seg button").forEach((b, i) => clickCheck("Settings seg: " + (b.parentNode.id || b.parentNode.dataset.key) + "=" + b.dataset.v, b, () => b.classList.contains("on")));
// re-select defaults so later modes run with defaults
["xFpsL", "xRes", "xRsc", "xAA", "xShd"].forEach((id) => { const b = $(id).querySelector("button"); phase = "reset seg"; b.click(); });
doc.querySelectorAll('#mSet [data-key="fps"] button')[0].click(); doc.querySelectorAll('#mSet [data-key="diff"] button')[1].click(); advance(50); lastErr = errors.length; lastX = xErrCalls.length;
const sw = doc.querySelectorAll("#xhSw button"); if (sw[1]) clickCheck("Settings: crosshair swatch", sw[1]);
for (const id of ["sSens", "sTs", "sVol", "sBri"]) { phase = "input " + id; const el = $(id); el.value = el.getAttribute("min"); dispatch(el, mkEvent("input")); dispatch(el, mkEvent("change")); advance(20); const ok = hasHandler(el, "input") || hasHandler(el, "change"); const e1 = errors.slice(lastErr); lastErr = errors.length; report.push({ label: "Settings slider " + id, el: true, handler: ok, pass: ok && !e1.length, errs: e1.map((e) => e.msg) }); }
clickCheck("Settings: Arrange buttons", $("xArr")); toLobby();
clickCheck("Settings: Done", (open => { $("mSet").classList.add("on"); return doc.querySelector("#mSet .row [data-close]"); })(), () => !modalOn("mSet"));
clickCheck("Sound toggle (on)", $("sndBtn"), () => $("sndBtn").getAttribute("aria-pressed") === "true");
clickCheck("Sound toggle (off)", $("sndBtn"), () => $("sndBtn").getAttribute("aria-pressed") === "false");
clickCheck("Profile chip", $("meBtn"), () => modalOn("mProf"));
doc.querySelectorAll("#mProf [data-pt]").forEach((b) => clickCheck("Profile tab: " + b.dataset.pt, b, () => !doc.querySelector(`#mProf [data-pp="${b.dataset.pt}"]`).hidden));
closeModals();
clickCheck("Profile chip (Enter key)", $("meBtn"), () => modalOn("mProf")); closeModals();
clickCheck("What's new link", doc.querySelector('.panel [data-open="mPatch"]'), () => modalOn("mPatch")); closeModals();
clickCheck("Join Discord", $("discBtn"));
// PLAY modal
clickCheck("PLAY (hero) opens the play panel", $("playBtn"), () => !$("xQueue").hidden && !modalOn("mPlay") && disp("lobby") === "flex");
clickCheck("Play panel: close", $("xqClose"), () => $("xQueue").hidden);
{ const ok = toCustom(); report.push({ label: "Nav Play → CUSTOM tab shows the old popup's entries", pass: ok && ["pm5v5", "pmMini", "pmRetake"].every((id) => inCustom($(id))), cond: ok }); }
lastErr = errors.length; lastX = xErrCalls.length;
clickCheck("CUSTOM: Play Versus", $("pmMini"), () => !modalOn("mPlay"));

const failMsg = () => $("result").style.display === "flex" && /Couldn't load 3D engine/.test($("resTitle").textContent);
const preShown = () => disp("pre") === "flex";
const inGame = () => disp("game") === "block";
function runFrames(label, n) {
  phase = label + " · 300 frames"; frames(n || 300);
  const e1 = errors.slice(lastErr), x1 = xErrCalls.slice(lastX); lastErr = errors.length; lastX = xErrCalls.length;
  report.push({ label: label + " · 300 frames", el: true, handler: true, pass: !e1.length && !x1.length && inGame(), errs: e1.map((e) => e.where + ": " + e.msg).concat(x1.map((x) => "xErr: " + x.msg)), cond: inGame() });
}
function leave() { phase = "leave"; const h = $("xPow"); if (h && hasHandler(h, "click")) h.click(); else toLobby(); advance(100); toLobby(); }
function matchFlow(label, opener, viaAgent, extra) {
  toLobby(); const r = opener(); if (NO3) { report[report.length - 1].label += " → engine message"; report[report.length - 1].pass = report[report.length - 1].pass && failMsg(); report[report.length - 1].cond = failMsg(); clickCheck(label + ": result Lobby", $("lobbyBtn"), () => disp("result") === "none"); return; }
  advance(5200); // matchmaking clock
  clickCheck(label + ": pre-match GO", $("preGo"), () => (viaAgent ? disp("xAg") === "flex" : inGame() || $("xPick").classList.contains("on")));
  if (viaAgent) { const t = Array.from(doc.querySelectorAll("#xAg .x-ag")).find((b, i) => i > 0 && !b.disabled); clickCheck(label + ": agent tile", t); clickCheck(label + ": agent LOCK IN", $("xAgL"), inGame); }
  if (extra) extra();
  runFrames(label); leave();
}
// Retake banner GO
matchFlow("Retake (banner GO)", () => clickCheck("Retake banner GO", $("goBtn"), () => NO3 || preShown()), true);
// Pre-match Cancel
toLobby(); $("goBtn").click(); advance(100); lastErr = errors.length; lastX = xErrCalls.length;
if (!NO3) clickCheck("Pre-match Cancel", $("preCancel"), () => disp("lobby") === "flex" && disp("pre") === "none"); else { clickCheck("Pre-match Cancel", $("preCancel"), () => true); toLobby(); }
// PLAY modal Retake vs bots
matchFlow("Retake (CUSTOM tab)", () => { toCustom(); return clickCheck("CUSTOM: Retake vs bots", $("pmRetake"), () => NO3 || preShown()); }, true);
// 5v5
matchFlow("5v5", () => { toCustom(); return clickCheck("CUSTOM: 5v5 GO", $("pm5v5"), () => NO3 || preShown()); }, true, () => {
  const xe = vm.runInContext("__xe", context);
  for (const ag of ["Jett", "Phoenix", "Reyna", "Raze", "Sova", "Skye", "Breach", "Omen", "Sage", "Killjoy", "Cypher", "Chamber"]) {
    // each C/Q/E cast must drop its charge, start its cooldown, or place/flag something; X must reset ult or set its active flag.
    // Preconditions a player would meet: a soul orb for Reyna; Sage hurt for E, a fallen ally under the crosshair for X (stub can't do aim math, so sgLook picks the first).
    phase = "5v5 casts " + ag; const e0 = errors.length, err = []; let ok = false;
    try { const r = xe(`(() => { try { J.pick = ${JSON.stringify(ag)}; FV.buy = 0; player.hp = 100; const M = K().mx || {}; J.c = M.c != null ? M.c : 2; J.q = M.q != null ? M.q : 2; J.e = M.e != null ? M.e : 1; J.ult = K().u; if (J.cd) Object.keys(J.cd).forEach((k) => { J.cd[k] = 0; });
        const snap = () => { const s = {}; [["BC", typeof BC !== "undefined" ? BC : null], ["RS", typeof RS !== "undefined" ? RS : null]].forEach(([n, O]) => { if (O) for (const k in O) { const v = O[k]; if (typeof v === "number" || typeof v === "boolean" || typeof v === "string") s[n + "." + k] = v; else if (Array.isArray(v)) s[n + "." + k + "#"] = v.length; else s[n + "." + k + "?"] = v ? 1 : 0; } });
          for (const k in J) { const v = J[k]; if (k === "hs") continue; if (typeof v === "number" || typeof v === "boolean") s[k] = +v; else if (Array.isArray(v)) s[k + "#"] = v.length; else if (v && typeof v === "object" && k !== "cd" && !v.isObject3D) s[k + "?"] = 1; else if (v == null) s[k + "?"] = 0; } if (J.cd) for (const k in J.cd) s["cd." + k] = J.cd[k]; return s; };
        const dead = [];
        ["KeyC", "KeyQ", "KeyE", "KeyX"].forEach((c) => { player.hp = Math.max(player.hp, 100); if (J.cd) Object.keys(J.cd).forEach((k) => { J.cd[k] = 0; }); const k = c[3].toLowerCase(), fx = -Math.sin(yaw), fz = -Math.cos(yaw);
          if (J.pick === "Reyna" && (c === "KeyQ" || c === "KeyE")) J.so.push({ m: new THREE.Object3D(), p: { x: player.x, y: 0.5, z: player.z }, t: 3 });
          if (J.pick === "Sage" && c === "KeyE") player.hp = 60;
          let bw0 = null; if (J.pick === "Breach" && (c === "KeyC" || c === "KeyQ")) { // teleport next to a real map wall (collision map), face it, then cast; the THREE stub can't raycast, so the crosshair ray is stubbed to that wall
            const x0 = player.x, z0 = player.z; let W = null;
            for (let r = 0; r <= 40 && !W; r += 2) for (let gx = -r; gx <= r && !W; gx += 2) for (const gz of [-r, r]) { if (W) break; for (const [x, z] of [[x0 + gx, z0 + gz], [x0 + gz, z0 + gx]]) { if (W || blocked(x, z, 0.3, 0)) continue;
              for (const yw of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) { const dx = -Math.sin(yw), dz = -Math.cos(yw); let hd = 0;
                for (let s = 0.5; s <= 6; s += 0.25) if (blocked(x + dx * s, z + dz * s, 0.05, 0)) { hd = s; break; } if (!hd) continue;
                let ok = false; for (let s = hd; s <= hd + 9; s += 0.25) if (!blocked(x + dx * s, z + dz * s, 0.3, 0)) { ok = true; break; }
                if (ok) { W = { x, z, yw, hx: x + dx * (hd - 0.05), hz: z + dz * (hd - 0.05), dx, dz }; break; } } } }
            if (W) { player.x = W.x; player.z = W.z; player.y = 0; yaw = W.yw; if (typeof pitch !== "undefined") pitch = 0; bw0 = [ray.intersectObjects, THREE.Vector3];
              class V { constructor(x = 0, y = 0, z = 0) { this.x = x; this.y = y; this.z = z; const P = new Proxy(this, { get: (t, k) => (k in t || typeof k !== "string" ? t[k] : () => P) }); return P; } subVectors(a, b) { return this.set(a.x - b.x, a.y - b.y, a.z - b.z); } dot(v) { return this.x * v.x + this.y * v.y + this.z * v.z; } lengthSq() { return this.dot(this); } set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; } clone() { return new V(this.x, this.y, this.z); } copy(v) { return this.set(v.x, v.y, v.z); } add(v) { this.x += v.x; this.y += v.y; this.z += v.z; return this; } sub(v) { this.x -= v.x; this.y -= v.y; this.z -= v.z; return this; } addScaledVector(v, s) { this.x += v.x * s; this.y += v.y * s; this.z += v.z * s; return this; } multiplyScalar(s) { this.x *= s; this.y *= s; this.z *= s; return this; } length() { return Math.hypot(this.x, this.y, this.z); } normalize() { return this.multiplyScalar(1 / (this.length() || 1)); } distanceTo(v) { return Math.hypot(this.x - v.x, this.y - v.y, this.z - v.z); } }
              THREE.Vector3 = V; ray.intersectObjects = () => [{ point: new V(W.hx, 1.6, W.hz), distance: Math.hypot(W.hx - W.x, W.hz - W.z) }]; } }
          let lk0 = null; if (J.pick === "Sage" && c === "KeyX") { const al = allies[0]; if (al) { al.alive = false; lk0 = sgLook; sgLook = (l) => l[0]; } }
          if (J.pick === "Cypher" && c === "KeyX") { const bd = bots[0]; if (bd && bd.g) { bd.alive = false; bd.g.position.x = player.x + 2; bd.g.position.z = player.z; } } // Neural Theft needs a fallen enemy within 8 m
          const a = snap(); jKey(c); const b = snap(); if (bw0) { ray.intersectObjects = bw0[0]; THREE.Vector3 = bw0[1]; } if (J.dr) { try { drEnd(); } catch (e) {} J.dr = null; }
          const ch = Object.keys(Object.assign({}, a, b)).filter((x) => a[x] !== b[x] && x !== "ult");
          const did = k === "x" ? (b.ult === 0 && a.ult > 0) || ch.some((x) => !a[x] && b[x]) : (b[k] < a[k]) || b["cd." + k] > 0 || ch.some((x) => x.endsWith("#") && b[x] > a[x]) || ch.length > 0;
          if (lk0) sgLook = lk0;
          if (!did) dead.push(c[3] + (bw0 ? "(wall " + (() => { try { const d = jAim(); return [d.x, d.y, d.z].map((v) => (+v).toFixed(2)).join("/") + " yaw " + yaw.toFixed(2); } catch (e) { return e.message; } })() + ")" : "(no wall)")); });
        return dead.length ? "did nothing: " + dead.join(",") : true; } catch (e) { return String(e.stack || e).slice(0, 300); } })()`);
      if (r !== true) err.push("cast: " + r);
      advance(3000);
      const r2 = xe(`(() => { try { player.hp = 100; fRound(); return FV.buy > 0 || running ? true : "round did not start"; } catch (e) { return String(e.stack || e).slice(0, 300); } })()`);
      if (r2 !== true) err.push("round: " + r2);
      errors.slice(e0).forEach((x) => err.push(x.msg));
      ok = !err.length;
    } catch (e) { err.push(String(e).slice(0, 300)); }
    report.push({ label: "5v5: " + ag + " C/Q/E/X casts each take effect (charge/cooldown/placed/ult reset), 3 s tick, next round starts clean", el: true, handler: true, cond: ok, pass: ok, errs: err });
  }
  { phase = "5v5 cast anim"; const e0 = errors.length, err = []; let ok = false;
    try {
      const r = xe(`(() => { try { J.pick = "Jett"; FV.buy = 0; player.hp = 100; J.q = 2; if (J.cd) J.cd.q = 0; xCaEnd(); jKey("KeyQ"); let blk = true; try { const f0 = fcd; fcd = 0; const a0 = typeof ammo !== "undefined" ? ammo : null; shoot(); blk = (a0 == null || ammo === a0); fcd = f0; } catch (e) {} return XCA.on && XCA.ty === "throw" && blk ? true : "no cast state: " + JSON.stringify({ on: XCA.on, ty: XCA.ty, blk, jon: jOn() }); } catch (e) { return String(e.stack || e).slice(0, 300); } })()`);
      if (r !== true) err.push(r);
      else { advance(1000); const r2 = xe(`(() => !XCA.on && XCA.g === 0 && (!XCA.h || !XCA.h.visible) ? true : "still casting t=" + XCA.t + " g=" + XCA.g)()`); if (r2 !== true) err.push(r2); }
      errors.slice(e0).forEach((x) => err.push(x.msg)); ok = !err.length;
    } catch (e) { err.push(String(e).slice(0, 300)); }
    report.push({ label: "Ability cast animation: Jett Q sets the viewmodel cast state (throw gesture, firing blocked) and returns to the gun within 1 s", el: true, handler: true, cond: ok, pass: ok, errs: err });
  }
});
// Swiftplay tab: shared 5v5 flow, win target 5
matchFlow("Swiftplay", () => { toLobby(); $("xqSwift").click(); return clickCheck("Swiftplay tab PLAY", $("xqPlay"), () => NO3 || preShown()); }, true, () => { const d = $("game").dataset, ok = d.xMode === "swift" && d.xWin === "5"; report.push({ label: "Swiftplay starts 5v5 with win target 5", pass: ok, cond: ok }); });
// 5v5 map picker on pre
if (!NO3) { toLobby(); toCustom(); $("pm5v5").click(); advance(100); lastErr = errors.length; lastX = xErrCalls.length; doc.querySelectorAll("#xMp button").forEach((b) => clickCheck("5v5 map: " + b.dataset.m, b, () => b.classList.contains("on"))); clickCheck("Ranked toggle", $("xRkB")); $("preCancel").click(); }
// Duel (direct start)
toLobby(); { const ok = clickCheck("Operator Duel PLAY", $("duelBtn"), () => (NO3 ? failMsg() : inGame())); if (NO3) clickCheck("Duel: result Lobby", $("lobbyBtn"), () => disp("result") === "none"); else { runFrames("Operator Duel"); leave(); } }
// Rifle past the weapon pick
matchFlow("Rifle 2v2", () => clickCheck("Rifle 2v2 PLAY", $("rifleBtn"), () => NO3 || preShown()), false, () => {
  phase = "rifle pick"; const pk = $("xPick").classList.contains("on"); advance(3500); // auto pick in 3 s
  report.push({ label: "Rifle 2v2: weapon pick auto-advances", el: true, handler: true, pass: pk && !$("xPick").classList.contains("on") && inGame(), errs: errors.slice(lastErr).map((e) => e.msg), cond: pk }); lastErr = errors.length; lastX = xErrCalls.length;
});
// Rifle manual pick button
if (!NO3) { toLobby(); $("rifleBtn").click(); advance(5200); $("preGo").click(); advance(50); lastErr = errors.length; lastX = xErrCalls.length; clickCheck("Rifle 2v2: pick Phantom button", doc.querySelectorAll(".x-pw button")[1], () => !$("xPick").classList.contains("on")); leave(); }
// Versus chip (both branches)
for (const r of [0.2, 0.8]) { toLobby(); vm.runInContext(`globalThis.__MR = globalThis.__MR || Math.random; Math.random = () => ${r}`, context);
  clickCheck("Versus chip (" + (r < 0.5 ? "duel" : "rifle") + " branch)", $("vsQuick"), () => (NO3 ? failMsg() : inGame() || preShown())); vm.runInContext("Math.random = __MR", context); if (!NO3 && inGame()) leave(); toLobby(); }
// Surf
matchFlow("Surf Boreas", () => clickCheck("Surf: Boreas", $("surfBtn"), () => NO3 || preShown()), false);
// 5v5 pause menu + surrender vote
matchFlow("5v5 surrender", () => { toCustom(); return clickCheck("CUSTOM: 5v5 GO (surrender)", $("pm5v5"), () => NO3 || preShown()); }, true, () => {
  const xe = vm.runInContext("__xe", context);
  const sc = (label, f) => { let ok = false, err = []; try { ok = !!f(); } catch (e) { err = [String(e).slice(0, 200)]; } report.push({ label: "5v5 pause/surrender: " + label, el: true, handler: true, cond: ok, pass: ok && !err.length, errs: err }); };
  const esc = () => { phase = "esc"; dispatch(win, mkEvent("keydown", { key: "Escape", code: "Escape" })); advance(50); };
  const pOn = () => $("xPause").classList.contains("on");
  const reopen = () => { if (pOn()) { $("xWatch").click(); advance(50); } esc(); };
  const career = () => xe('(() => { try { return JSON.parse(localStorage.getItem("vs.career") || "[]"); } catch (e) { return []; } })()') || [];
  sc("Esc opens the pause menu", () => { esc(); return pOn(); });
  sc("menu shows RESUME / SETTINGS / SURRENDER / LEAVE MATCH", () => ["xWatch", "xGear", "xSurr", "xPow"].every((id) => $(id) && !$(id).hidden) && ["Resume", "Surrender"].every((t, i) => $(["xWatch", "xSurr"][i]).getAttribute("aria-label") === t));
  sc("RESUME closes it", () => { $("xWatch").click(); advance(50); return !pOn() && !xe("paused"); });
  sc("SURRENDER disabled before round 4", () => { xe("FV.you = 1; FV.them = 1; FV.svH = -1; FV.svOn = false; FV.surr = false"); reopen(); return pOn() && $("xSurr").disabled; });
  sc("score 3–4: vote fails, match continues", () => { xe("FV.you = 3; FV.them = 4; FV.svH = -1; FV.svOn = false; FV.surr = false"); reopen(); if ($("xSurr").disabled) return false; $("xSurr").click(); advance(6000); return !xe("FV.surr") && xe("running") && xe("FV.you") === 3 && xe("FV.them") === 4; });
  xe("(() => { globalThis.__cr = []; const f = window.xCareerRec; window.xCareerRec = globalThis.xCareerRec = (o) => { globalThis.__cr.push(o); return f && f(o); }; })()");
  sc("round 6, score 0–6: vote passes, match ends as a loss at 0–6", () => { xe("FV.you = 0; FV.them = 6; FV.svH = -1; FV.svOn = false; FV.surr = false"); reopen(); if ($("xSurr").disabled) return false; $("xSurr").click(); advance(8000); return xe("FV.surr") && !xe("running") && xe("FV.you") === 0 && xe("FV.them") === 6 && disp("result") === "flex"; });
  sc("career records the surrender as a 0 – 6 loss", () => { const c = xe("globalThis.__cr || []"), x = c[c.length - 1]; return c.length === 1 && x && x.result === "loss" && x.mode === "five" && /^0\s*–\s*6$/.test(x.score); });
  lastErr = errors.length; lastX = xErrCalls.length;
});
matchFlow("Surf Utopia", () => clickCheck("Surf: Utopia", $("utoBtn"), () => NO3 || (preShown() && /UTOPIA/.test($("preMh").textContent))), false);
// Aim
matchFlow("Aim Training", () => clickCheck("Aim Training PLAY", $("aimBtn"), () => NO3 || preShown()), false);
// result screen buttons + pause menu (with THREE)
if (!NO3) {
  toLobby(); $("duelBtn").click(); advance(100); lastErr = errors.length; lastX = xErrCalls.length;
  phase = "pause"; dispatch(win, mkEvent("keydown", { key: "Escape", code: "Escape" })); advance(400); const pz = $("xPause").classList.contains("on");
  report.push({ label: "Pause opens (Esc)", el: true, handler: true, pass: pz && !errors.slice(lastErr).length, errs: errors.slice(lastErr).map((e) => e.msg) }); lastErr = errors.length;
  doc.querySelectorAll("#xPause .x-tabs button").forEach((b) => clickCheck("Pause tab " + b.dataset.t, b));
  clickCheck("Pause: Open settings", $("xSet"), () => modalOn("mSet")); closeModals();
  clickCheck("Pause: Resume", $("xResume"), () => !$("xPause").classList.contains("on"));
  frames(30); lastErr = errors.length; lastX = xErrCalls.length;
  dispatch(win, mkEvent("keydown", { key: "Escape", code: "Escape" })); advance(400);
  clickCheck("Pause: Home", $("xHome"), () => disp("lobby") === "flex");
  $("duelBtn").click(); advance(100); $("result").style.display = "flex"; lastErr = errors.length; lastX = xErrCalls.length;
  clickCheck("Result: Play again", $("againBtn"), inGame); frames(60); lastErr = errors.length; lastX = xErrCalls.length;
  $("result").style.display = "flex"; clickCheck("Result: Lobby", $("lobbyBtn"), () => disp("lobby") === "flex");
}

// ---------- Deathmatch + Spike Rush cards ----------
if (!NO3) {
  const ev = (s) => { try { return vm.runInContext(s, context); } catch (e) { console.log("audit eval: " + String(e).slice(0, 200)); return false; } };
  toLobby(); clickCheck("Deathmatch card starts DM", $("dmBtn"), () => { advance(1500); return inGame() && ev('(({ mode, FV, running }) => mode === "five" && FV.dm === true && running)(__st())'); }); frames(60);
  toLobby(); clickCheck("Team Deathmatch card starts TDM with 10 players", $("tdmBtn"), () => { advance(1500); return inGame() && ev('(({ mode, FV, running, srAll }) => mode === "five" && FV.dm === true && FV.tdm === true && running && srAll().length === 9)(__st())'); }); frames(60);
  toLobby(); clickCheck("Spike Rush card starts SR", $("srBtn"), () => { advance(1500); return inGame() && ev('(({ mode, FV, player, SR, running }) => mode === "five" && FV.sr === true && !FV.dm && FV.buy === 0 && running && !!FV.srG && player.armor === 50 && SR.orbs.length === 4)(__st())'); }); frames(120);
  { toLobby(); $("srBtn").click(); advance(1500);
    const srC = (label, expr) => { let r = false, err = []; try { r = !!vm.runInContext(`(() => { const { mode, FV, player, SR, srAll, fAtk, K, J, wName, fRound } = __st(); const L = srAll().filter((u) => u && u.alive !== false && u.hp > 0); ${expr} })()`, context); } catch (e) { err = [String(e).slice(0, 200)]; } report.push({ label: "Spike Rush: " + label, el: true, handler: true, cond: r, pass: r, errs: err }); };
    srC("card starts SR state, not plain 5v5", 'return mode === "five" && FV.sr === true && !FV.dm && !!FV.srG;');
    srC("every living unit holds the same gun", 'return FV.pri === FV.srG && wName() === FV.srG && L.length > 0 && L.every((u) => u.w === FV.srG);');
    srC("abilities at full charges", 'const M = K().mx; return J.c === M.c && J.q === M.q && (M.e == null || J.e === M.e) && L.length > 0 && L.every((u) => !!u.ab && u.ab.cb === 2 && u.ab.smk === true && u.ab.rb === true);');
    { let r = false, err = []; try { r = !!vm.runInContext(`(() => { const { fRound, srAll } = __st(); const U = srAll().filter((u) => u && u.ab); if (!U.length) return false;
      U.forEach((u) => { const A = u.ab; A.hoU = 1; A.sq = 0; A.sp = 0; A.srg = 1; A.ct = 1; A.tm = null; A.bq = 0; A.be = 0; A.ps = 0; });
      fRound(); const V = srAll().filter((u) => u && u.ab); return V.length > 0 && V.every((u) => { const A = u.ab; return A.hoU == null && A.sq == null && A.sp == null && !A.srg && A.ct == null && A.bq == null && A.be == null && A.ps === undefined; }); })()`, context); } catch (e) { err = [String(e).slice(0, 200)]; }
      report.push({ label: "5v5: bot per-round abilities (charges, Sage heal, Skye pool, Chamber trap, Breach Fault Line, Raze Paint Shells) reset at round start", el: true, handler: true, cond: r, pass: r, errs: err }); }
    srC("heavy shields on", 'return player.armor === 50 && FV.arm === 50 && L.length > 0 && L.every((u) => typeof u.armor === "number" && u.armor === 50);');
    srC("spike plant pushes an agent callout line", 'const t = __xe("xVoT = -1e9; feed(\\"Jett planted the Spike on A\\"); document.getElementById(\\"xVo\\").textContent"); return /Spike down A!/.test(t);');
    srC("every attacker has a Spike", 'const A = fAtk(); return A.length > 0 && A.every((u) => u.spike === true) && srAll().filter((u) => u && !A.includes(u)).every((u) => !u.spike);');
    srC("4 power orbs", "return SR.orbs.length === 4;");
    // bot-owned Boom Bot / Aftershock deal damage, credited to the owner (5v5 match, 10 units)
    const xbD = (label, setup, tick, secs) => { let r = false, err = [];
      try { r = vm.runInContext("__xe", context)(`(() => { const AL = typeof allies !== "undefined" ? allies : (__st().srAll ? __st().srAll() : []).filter((u) => u && u !== player && bots.indexOf(u) < 0); const o = AL.find((a) => a.alive && a.g && a.name), t = bots.find((b) => b.alive && b.g); if (!o || !t) return "no units";
        const h0 = hurt, by = []; hurt = function (u, n, w) { if (u === t) by.push(w); return h0.apply(this, arguments); };
        const g0 = t.g, tS = Object.assign({}, t), oS = Object.assign({}, o), bS = Object.assign({}, BC), rS = Object.assign({}, RS); try { t.hp = 400; t.armor = 0; t.g = Object.create(g0); Object.defineProperty(t.g, "position", { value: { x: player.x, y: 0, z: player.z } }); const q = t.g.position, q0 = 0; ${setup}; for (let i = 0; i < ${secs} * 20; i++) ${tick}(0.05); const ok = t.hp < 400 && by.length > 0 && by.every((w) => w === o.name); return ok || JSON.stringify({ hp: t.hp, by, o: o.name, bb: RS.bb.length, p: RS.bb[0] && [RS.bb[0].m.position.x, RS.bb[0].m.position.z, typeof RS.bb[0].m.position], q: [q.x, q.z] }); } catch (e) { return String(e.stack).slice(0, 400); } finally { hurt = h0; Object.keys(t).forEach((k) => { if (!(k in tS)) delete t[k]; }); Object.assign(t, tS); Object.keys(o).forEach((k) => { if (!(k in oS)) delete o[k]; }); Object.assign(o, oS); Object.assign(BC, bS); Object.assign(RS, rS); t.g = g0; RS.bb.length = 0; BC.as.length = 0; } })()`);
        if (r !== true) { err = [String(r)]; r = false; } } catch (e) { err = [String(e).slice(0, 200)]; }
      report.push({ label, el: true, handler: true, cond: r, pass: r, errs: err }); };
    xbD("5v5: bot Boom Bot explodes on an enemy bot, damage credited to its owner", "RS.bb.push({ m: { position: { x: q.x + 0.5, y: 0.4, z: q.z }, rotation: { y: 0 } }, dx: -1, dz: 0, t: 10, own: o, en: false })", "rsTick", 3);
    xbD("5v5: bot Aftershock beside an enemy bot deals damage within 2 s, credited to its owner", "BC.as.push({ p: { x: q.x + 1, y: 0, z: q.z }, m: { position: { x: q.x + 1, y: 0.4, z: q.z } }, t: 1, n: 3, own: o, en: false })", "bcTick", 2);
    srC("ults start at half", "return J.ult === Math.ceil(K().u / 2);");
    srC("win target is 4", "return FV.srWin === 4;");
    srC("bot charges full at round 2 start", 'srAll().forEach((u) => { if (u && u.ab) { u.ab.cb = 0; u.ab.smk = false; u.ab.rb = false; if (u.ab.sq != null) u.ab.sq = 0; if (u.ab.bq != null) u.ab.bq = 0; } }); FV.you = 1; fRound(); const R = srAll().filter((u) => u); return FV.you + FV.them === 1 && R.length > 0 && R.every((u) => !!u.ab && u.ab.cb === 2 && u.ab.smk === true && u.ab.rb === true && (u.ab.sq == null || u.ab.sq === 2) && (u.ab.bq == null || u.ab.bq === 2));');
    { let ok = false, err = []; try { ok = !!vm.runInContext('(() => { const N = __nav, st = __st(), F = st.FV, m0 = F.map, y0 = F.you, t0 = F.them, S0 = N.SITES; let sw = false; try { F.map = "lotus"; if (N.SITES !== N.LSITES) { SITES = N.LSITES; sw = true; } const seen = new Set(); for (let i = 0; i < 12; i++) { F.you = i % 6; F.them = 0; st.fRound(); seen.add(F.sp && F.sp.site); } return seen.size >= 2 && [...seen].every((k) => !!N.LSITES[k]); } finally { F.map = m0; F.you = y0; F.them = t0; if (sw) SITES = S0; } })()', context); } catch (e) { err = [String(e).slice(0, 200)]; }
      report.push({ label: "Lotus: attacker target site re-rolls across 12 round starts (>= 2 sites)", el: true, handler: true, cond: ok, pass: ok, errs: err }); }
  }
  report.push({ label: "Spike Rush: frames run clean", el: true, handler: true, pass: !errors.slice(lastErr).length, errs: errors.slice(lastErr).map((e) => e.msg) });
  toLobby();
}

// ---------- lobby queue tabs + queue PLAY ----------
{
  const QT = [["UNRATED", "unrated"], ["SWIFTPLAY", "swift"], ["SPIKE RUSH", "sr"], ["DEATHMATCH", "dm"], ["TEAM DEATHMATCH", "tdm"], ["ESCALATION", "esc"], ["CUSTOM", "custom"]];
  const tabOf = (name) => [...doc.querySelectorAll("#xQueue [role=tab]")].find((b) => b.textContent.trim().toUpperCase() === name) || null;
  const sel = (b) => !!b && b.classList.contains("on") && b.getAttribute("aria-selected") === "true";
  for (const [name] of QT) { toLobby(); const t = tabOf(name); phase = "queue tab " + name; const had = !!t && hasHandler(t, "click"); if (t) t.click(); advance(30);
    const e1 = errors.slice(lastErr); lastErr = errors.length; const ok = sel(t) && QT.every(([n]) => n === name || !sel(tabOf(n)));
    report.push({ label: "Queue tab " + name + ": exists, has click handler, selects", el: !!t, handler: had, cond: ok, pass: !!t && had && ok && !e1.length, errs: e1.map((e) => e.where + ": " + e.msg) }); }
  const ev = (s) => { try { return vm.runInContext(s, context); } catch (e) { return false; } };
  const shown = (id) => { const e = $(id); return !!e && e.style.display !== "" && e.style.display !== "none"; };
  const want = { unrated: () => NO3 || shown("xAg") || shown("pre"), swift: () => NO3 || shown("xAg") || shown("pre"),
    sr: () => NO3 || ev('(({ mode, FV }) => mode === "five" && FV.sr === true && !FV.dm)(__st())'),
    dm: () => NO3 || ev('(({ mode, FV }) => mode === "five" && FV.dm === true && !FV.tdm)(__st())'),
    tdm: () => NO3 || ev('(({ mode, FV }) => mode === "five" && FV.dm === true && FV.tdm === true && !FV.esc)(__st())'),
    esc: () => NO3 || ev('(({ mode, FV }) => mode === "five" && FV.dm === true && FV.tdm === true && FV.esc === true)(__st())') };
  for (const [name, k] of QT) { if (k === "custom") continue; toLobby(); const t = tabOf(name); if (t) t.click(); advance(30);
    clickCheck("Queue PLAY with " + name + " starts its mode", $("xqPlay"), () => { advance(1500); return !!want[k](); });
    if (k === "esc" && !NO3) { const r = !!ev('(() => { const g = globalThis, E = g.xEsc, A = (g.allies || (typeof allies !== "undefined" ? allies : [])); const st = __st(); if (!E || E.lv[0] !== 0) return false; const B = (typeof bots !== "undefined" ? bots : []); const a = A[0] && A[0].name, v = B[0] && B[0].name; for (let i = 0; i < 7; i++) g.xEscKill(a, v); return E.lv[0] === 1 && E.lv[1] === 0 && E.k[0] === 0 && st.FV.pri === "Ares" && A.every((u) => u.w === "Ares"); })()');
      report.push({ label: "Escalation: tab starts the mode; 7 ally kills advance the ally level to Ares", el: true, handler: true, cond: r, pass: r }); }
    if (!NO3) frames(30); }
  // top PLAY, UNRATED (default): first click opens the panel, second starts the queue
  toLobby(); $("xQueue").hidden = true; { const t = tabOf("UNRATED"); if (t) t.click(); } advance(30); lastErr = errors.length; lastX = xErrCalls.length;
  clickCheck("Top PLAY (closed panel) opens queue tabs, no match", $("playBtn"), () => { advance(300); return !$("xQueue").hidden && !shown("xAg") && !shown("pre") && disp("game") === "none"; });
  { const q = $("xQueue"); const tabs = q ? q.querySelectorAll(".x-qtabs [role=tab]") : []; const tiles = q ? q.querySelectorAll(".x-qgrid .x-qmap") : []; const st = $("xqPlay");
    const ok = !!q && !q.hidden && tabs.length === 7 && tiles.length === 6 && !!st && st.textContent.trim().toUpperCase() === "START" && !st.closest("[hidden]");
    report.push({ label: "PLAY panel open shows 7 mode tabs, 6 map tiles and START", el: !!q, handler: true, cond: ok, pass: ok }); }
  clickCheck("Top PLAY (open panel) starts UNRATED", $("playBtn"), () => { advance(1500); return !!want.unrated(); }); if (!NO3) frames(30);
  toLobby(); const u = tabOf("UNRATED"); if (u) u.click(); advance(30); lastErr = errors.length; lastX = xErrCalls.length;
}

// ---------- soak: bots-only 5v5 on every map, fixed dt 1/30 s, up to 3 rounds / 6000 ticks per map ----------
if (!NO3) {
  const xe = vm.runInContext("__xe", context); var soakPlants = 0;
  const SM = process.env.SOAK_MAPS ? process.env.SOAK_MAPS.split(",") : ["ascent", "bind", "haven", "split", "lotus", "breeze"], SS = process.env.SOAK_SEEDS ? process.env.SOAK_SEEDS.split(",").map(Number) : [12345];
  for (const [m, seed] of SM.flatMap((m) => SS.map((s) => [m, s]))) {
    toLobby(); phase = "soak " + m; const e0 = errors.length, x0 = xErrCalls.length; let r;
    vm.runInContext("globalThis.__MR = globalThis.__MR || Math.random; { let s = " + seed + "; Math.random = () => { s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }", context);
    try { r = xe(`(() => { const out = { rounds: [], err: null, nan: null, stuck: [] }; const DT = 1 / 30, CAP = 6000, RMAX = 160 / DT;
      try { FV.pick = ${JSON.stringify(m)}; FV.srOn = 0; FV.dm = false; FV.tdm = false; window.xSwift = false; startFive(); if (FV.map !== ${JSON.stringify(m)}) return { err: "map not set: " + FV.map };
        let t = 0, rt = 0, n0 = FV.you + FV.them, U = [], L = null, begin = () => { clearTimeout(FV.to); player.hp = 0; FV.buy = 0; rt = 0; U = bots.concat(allies).filter((u) => u && u.g).map((u) => ({ u, x: u.g.position.x, z: u.g.position.z, d: 0 })); L = { site: FV.sp.site, reach: false, plant: null, k0: Object.values(SB || {}).reduce((a, b) => a + (b.k || 0), 0), dist: [] }; };
        begin();
        while (t < CAP && out.rounds.length < 3) { t++; rt++; fiveTick(DT);
          { const s = FV.sp, c = s.st === "carry" && s.c ? fPos(s.c) : s.st === "drop" ? s : null, T = SITES[s.site];
            if (L.plant == null && s.st !== "plant") L.site = s.site; // record the target after the round-start re-pick, not the previous round's
            if (c && T && inSite(c)) L.reach = true; if (s.st === "plant" && L.plant == null) { L.plant = +(rt * DT).toFixed(1); L.reach = true; }
            if (FV.map === "lotus" && out.rounds.length === 1 && rt % 300 === 0) { out.lg = out.lg || []; out.lg.push("t" + (rt * DT).toFixed(0) + " st:" + s.st + " route:" + s.xr + " site:" + s.site + " doors:" + LG.doors.map((d) => (d.x < 0 ? "C" : "A") + (d.t >= 0.5 ? "open" : "closed") + "(t" + d.t.toFixed(2) + ",tgt" + d.tgt + ")").join(",") + " wall:" + (LG.wall ? (LG.wall.dead ? "broken" : "intact hp" + LG.wall.hp) : "-") + " carrier:" + (c ? c.x.toFixed(1) + "," + c.z.toFixed(1) : "-") + (s.c && s.c.xr ? " wp" + JSON.stringify(s.c.xr[0]) + "/" + s.c.xr.length : "")); }
            if (rt % 900 === 0 && rt <= 2700) L.dist.push(s.st === "plant" ? 0 : c && T ? +Math.hypot(c.x - T[0], c.z - T[1]).toFixed(1) + " " + s.st + (s.c && s.c.xr ? " wp" + s.c.xr.length : "") : null); }
          for (const s of U) { const p = s.u.g.position; if (!Number.isFinite(p.x) || !Number.isFinite(p.z)) { out.nan = s.u.name + " @" + t; return out; } if (rt * DT <= 30) s.d = Math.max(s.d, Math.hypot(p.x - s.x, p.z - s.z)); else if (!s.ok) { s.ok = 1; if (s.u.alive && s.d <= 5 && !(s.u.np && Math.hypot(s.u.np[0] - p.x, s.u.np[1] - p.z) < 1.5)) out.stuck.push(s.u.name + " " + s.d.toFixed(1) + "m r" + (out.rounds.length + 1) + " @" + p.x.toFixed(1) + "," + p.z.toFixed(1) + " " + (bots.includes(s.u) ? "bot" : "ally") + " atk" + FV.atk + " sp:" + FV.sp.st + (FV.sp.c === s.u ? "*carrier" : "") + (FV.sp.ra === s.u ? "*retriever" : "") + " xr" + JSON.stringify(s.u.xr) + " np" + JSON.stringify(s.u.np)); } }
          if (rt % 150 === 0 && !out.rounds.length && FV.sp.st === "carry" && FV.sp.c) { const c = FV.sp.c, p = fPos(c), T = SITES[FV.sp.site], E = (FV.atk ? bots : allies.concat(player.hp > 0 ? [player] : [])).filter((e) => e && e.alive !== false && e.g);
            const ne = E.map((e) => [e, Math.hypot(e.g.position.x - p.x, e.g.position.z - p.z)]).sort((a, b) => a[1] - b[1])[0], tm = (FV.atk ? allies : bots).filter((t) => t !== c && t.alive);
            out.cl = out.cl || []; out.cl.push(["t" + (rt * DT).toFixed(0), c.name, "route:" + FV.sp.xr, "cw:" + JSON.stringify(FV.sp.cw && [FV.sp.cw.tl, FV.sp.cwx, timeLeft]) + " xr:" + JSON.stringify(c.xr), "wp:" + JSON.stringify(c.xr && c.xr[0]) + "/" + (c.xr && c.xr.length), "np:" + JSON.stringify(c.np && c.np.slice(0, 2).map((v) => +(+v).toFixed(1))), "pos:" + p.x.toFixed(1) + "," + p.z.toFixed(1), "d:" + (T ? Math.hypot(p.x - T[0], p.z - T[1]).toFixed(1) : "?"), "see:" + !!c.see, "mv:" + JSON.stringify([c.mv, c.blk, c.hp, c.tagT, c.pk, c.det, c.trT, c.xj, c.uw, allies.includes(c) ? "ally" : "bot", c.svx && +c.svx.toFixed(2), c.svz && +c.svz.toFixed(2)]), "tgt:" + (c.tgt ? c.tgt.name : "-"), "scp:" + c.scp, "wk:" + c.wk, "near:" + (ne ? ne[0].name + "@" + ne[1].toFixed(1) + (typeof los === "function" ? (los({ x: p.x, y: 1.5, z: p.z }, { x: ne[0].g.position.x, y: 1.5, z: ne[0].g.position.z }) ? " vis" : " hid") : "") : "-"), "nav:" + (T && FV.map !== "ascent" ? (() => { const G = xgGet(), N = G.N, nr = (x, z) => { const o = N.map((n, i) => [Math.hypot(n[0] - x, n[1] - z), i]).sort((a, b) => a[0] - b[0]); for (const [, i] of o) if (G.ok[i] && ascClear(x, z, N[i][0], N[i][1])) return i; return -1; }, a = nr(p.x, p.z), b = nr(T[0], T[1]); return JSON.stringify([fNav(p.x, p.z, T[0], T[1]), a, N[a], b, N[b], JSON.stringify(G.adj[a]), JSON.stringify(G.adj[b]), T, JSON.stringify(G.pc && G.pc.get(a * 65536 + b)), G.adj.reduce((m, l, i) => (l.some(([v]) => v === b) ? m.concat(i) : m), [])]); })() : "-"), "mates:" + tm.map((t) => Math.hypot(t.g.position.x - p.x, t.g.position.z - p.z).toFixed(0)).join("/")].join(" ")); }
          if (rt % 60 === 0 && !out.rounds.length && FV.map === "split" && FV.sp.st === "carry" && FV.sp.c) { const c = FV.sp.c, p = fPos(c), T = SITES[FV.sp.site], G = XG.split || null, N = G && G.N || [];
            const nn = N.map((q, i) => [i, q, Math.hypot(q[0] - T[0], q[1] - T[1])]).sort((a, b) => a[2] - b[2]).slice(0, 4);
            out.tr = out.tr || []; if (rt > 1500) out.tr.push([+(rt * DT).toFixed(0), +p.x.toFixed(1), +p.z.toFixed(1), +c.g.position.y.toFixed(2), c.np && c.np.slice(0, 2), c.xr && c.xr.length]);
            out.dbg = { tr: out.tr, pos: [+p.x.toFixed(1), +p.z.toFixed(1), +(c.g.position.y).toFixed(2)], st: { see: c.see, bn: c.bn, mv: c.mv, blk: c.blk, wk: c.wk, scp: c.scp, hp: c.hp, det: c.det, tagT: c.tagT, ally: allies.includes(c), tgt: c.tgt && c.tgt.name, pk: c.pk, pkP: c.pkP, nb: c.xNb && [c.xNb.name, +c.xNb.g.position.x.toFixed(1), +c.xNb.g.position.z.toFixed(1), +c.xNb.g.position.y.toFixed(1), c.xNb.alive], ox: c.ox }, probe: [-13, -13.5, -14, -14.5, -15, -16, -17, -18, -19, -20, -21].map((z) => z + ":" + (blocked(-35.9, z, 0.45, groundAt(-35.9, z, 0.3, 9)) ? "X" : "o") + groundAt(-35.9, z, 0.3, 9).toFixed(2)), boxesAt: xbgArea(xbgBox(), -36.5, -35.3, -15, -12, xbgL).map((b) => [b.x1, b.x2, b.z1, b.z2, BH(b)].map((v) => +(+v).toFixed(2))), np: c.np, xTg: c.xTg, xr: c.xr, path: c.path && c.path.slice(-3), keys: Object.keys(c).filter((k) => /pa|np|wp|xr|tg/i.test(k)), xg: G && Object.keys(G), near: nn.map(([i, q, d]) => [q, +d.toFixed(1), xgClear(q[0], q[1], T[0], T[1], 0.4)]), lastClr: c.np ? xgClear(c.np[0], c.np[1], T[0], T[1], 0.4) : null }; }
          if (!running) { const n = FV.you + FV.them; out.rounds.push({ s: +(rt * DT).toFixed(1), adv: n === n0 + 1, site: L.site, reach: L.reach, plant: L.plant, kills: Object.values(SB || {}).reduce((a, b) => a + (b.k || 0), 0) - L.k0, dist: L.dist }); n0 = n; if (out.rounds.length < 3) { fRound(); begin(); } }
          else if (rt > RMAX) { out.err = "round " + (out.rounds.length + 1) + " ran past " + RMAX * DT + " s"; return out; } }
        clearTimeout(FV.to);
      } catch (e) { out.err = String(e.stack || e).slice(0, 300); } return out; })()`); } catch (e) { r = { err: String(e).slice(0, 300) }; }
    vm.runInContext("Math.random = __MR", context);
    const errs = errors.slice(e0).map((e) => e.where + ": " + e.msg).concat(xErrCalls.slice(x0).map((x) => "xErr: " + x.msg));
    if (r.err) errs.unshift(r.err); if (r.nan) errs.unshift("NaN position: " + r.nan); if (r.stuck && r.stuck.length) errs.unshift("stuck: " + r.stuck.join(", "));
    const R = r.rounds || [], ok = !errs.length && R.length >= 1 && R.every((x) => x.adv);
    report.push({ label: `Soak ${m}: bots-only, ${R.length} round(s) ended [${R.map((x) => x.s + "s").join(", ")}], counter advances, no stuck bot, no NaN, no exceptions`, el: true, handler: true, cond: ok, pass: ok, errs });
    for (const [i, x] of R.entries()) console.log(`soak ${m} r${i + 1}: ${x.s}s site ${x.site} reached ${x.reach} planted ${x.plant == null ? "no" : x.plant + "s"} kills ${x.kills} carrier→site @30/60/90s ${JSON.stringify(x.dist)}`);
    if (process.env.SOAK_SEEDS) { console.log(`soak ${m} seed ${seed}: r1 planted ${R[0] && R[0].plant}`); for (const l of r.cl || []) console.log("  " + l); }
    if (r.dbg) { const d = r.dbg; console.log(`soak ${m} carrier dbg: pos ${JSON.stringify(d.pos)} lastNode ${JSON.stringify(d.np)} nearPlant ${JSON.stringify(d.near)} lastNode→plant clear ${d.lastClr} trace(last 6) ${JSON.stringify((d.tr || []).slice(-6))}`); }
    if (m === "lotus") { for (const l of r.lg || []) console.log("  lotus r2 " + l);
      const lp = [0, 1].map((i) => R[i] && R[i].plant), lok = lp.every((v) => v != null && v <= 75);
      report.push({ label: `Soak lotus: rounds 1 and 2 both plant within 75 s [${lp.map((v) => (v == null ? "no" : v + "s")).join(", ")}]`, el: true, handler: true, cond: lok, pass: lok, errs: [] }); }
    soakPlants += R.length && R[0].plant != null ? 1 : 0;
    lastErr = errors.length; lastX = xErrCalls.length;
  }
  // forced-target runs: one round per map × site, carrier must plant within 75 s
  if (!process.env.NO_FORCED) { const FT = [], t0f = Date.now();
    for (const m of SM) for (const site of (m === "haven" || m === "lotus" ? ["A", "B", "C"] : ["A", "B"])) {
      toLobby(); phase = "forced " + m + "/" + site; const e0 = errors.length, x0 = xErrCalls.length; let r;
      vm.runInContext("globalThis.__MR = globalThis.__MR || Math.random; { let s = 12345; Math.random = () => { s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }", context);
      try { r = xe(`(() => { const DT = 1 / 30; try { FV.pick = ${JSON.stringify(m)}; FV.srOn = 0; FV.dm = false; FV.tdm = false; window.xSwift = false; startFive(); if (FV.map !== ${JSON.stringify(m)}) return { err: "map not set: " + FV.map };
          clearTimeout(FV.to); player.hp = 0; FV.buy = 0; if (!SITES[${JSON.stringify(site)}]) return { err: "no site" }; FV.sp.site = ${JSON.stringify(site)}; FV.sp.xr = null;
          let rt = 0, plant = null, st = ""; while (rt < 75 / DT && running) { rt++; fiveTick(DT); if (FV.sp.site !== ${JSON.stringify(site)} && FV.sp.st === "carry") { FV.sp.site = ${JSON.stringify(site)}; FV.sp.xr = null; } if (FV.sp.st === "plant") { plant = +(rt * DT).toFixed(1); break; } }
          st = FV.sp.st; clearTimeout(FV.to); return { plant, st, site: FV.sp.site }; } catch (e) { return { err: String(e.stack || e).slice(0, 300) }; } })()`); } catch (e) { r = { err: String(e).slice(0, 300) }; }
      vm.runInContext("Math.random = __MR", context);
      const errs = errors.slice(e0).map((e) => e.where + ": " + e.msg).concat(xErrCalls.slice(x0).map((x) => "xErr: " + x.msg)); if (r.err) errs.unshift(r.err);
      FT.push({ m, site, plant: r.plant, st: r.st, errs }); lastErr = errors.length; lastX = xErrCalls.length;
    }
    console.log("forced-target plants (≤75 s):  " + FT.map((f) => `${f.m}/${f.site} ${f.plant == null ? "—(" + (f.st || "?") + ")" : f.plant + "s"}`).join("  ") + `  [${((Date.now() - t0f) / 1000).toFixed(1)}s]`);
    const fb = FT.filter((f) => f.plant == null || f.errs.length);
    report.push({ label: `Forced target: carrier plants within 75 s on ${FT.length - fb.length}/${FT.length} map/site runs${fb.length ? " (fail: " + fb.map((f) => f.m + "/" + f.site).join(", ") + ")" : ""}`, el: true, handler: true, cond: !fb.length, pass: !fb.length, errs: fb.flatMap((f) => f.errs).slice(0, 3) });
  }
  { let bad = "?"; try { bad = vm.runInContext('(({ XA, XR }) => Object.entries(XA).flatMap(([m, S]) => Object.entries(S).flatMap(([s, L]) => L.filter((k) => !(XR[k] && XR[k].length)).map((k) => m + "/" + s + "/" + k))).join(", "))(__xa())', context); } catch (e) { bad = "XA/XR unreadable: " + e.message; }
    report.push({ label: `Attacker routes: every scripted route has ≥1 waypoint${bad ? " (empty: " + bad + ")" : ""}`, el: true, handler: true, cond: !bad, pass: !bad, errs: [] }); }
  report.push({ label: `Soak: first-round plant on ${soakPlants}/5 maps (need ≥4)`, el: true, handler: true, cond: soakPlants >= 4, pass: soakPlants >= 4, errs: [] });
  try { vm.runInContext('__st().FV.pick = "ascent"', context); } catch (e) {} toLobby();
}

// ---------- location label: Bind Hookah ----------
if (!NO3) {
  toLobby(); phase = "loc label bind"; let r = {}, err = []; const xe = vm.runInContext("__xe", context);
  try { r = xe(`(() => { try { FV.pick = "bind"; FV.srOn = 0; FV.dm = false; FV.tdm = false; window.xSwift = false; startFive(); clearTimeout(FV.to);
      const c = BIND_CALLOUTS.find((q) => /hookah/i.test(q[0])); if (!c) return { err: "no Hookah callout" };
      const g = document.getElementById("game"); if (g) { g.hidden = false; g.classList.add("x-mm"); }
      player.hp = 100; player.x = c[1]; player.z = c[2]; return { want: String(c[0]).toUpperCase(), map: FV.map }; } catch (e) { return { err: String(e.stack || e).slice(0, 300) }; } })()`); } catch (e) { r = { err: String(e).slice(0, 300) }; }
  if (r.err) err.push(r.err);
  advance(600);
  let got = ""; try { got = xe('(() => { const e = document.querySelector(".x-loc"); return e ? e.textContent : ""; })()'); } catch (e) { err.push(String(e).slice(0, 200)); }
  if (!got) { advance(600); try { got = vm.runInContext('(document.querySelector(".x-loc") || {}).textContent || ""', context); } catch (e) {} }
  const ok = !err.length && r.map === "bind" && !!r.want && got === r.want;
  report.push({ label: `Location label: 5v5 on Bind at Hookah shows "${r.want || "HOOKAH"}" (got "${got}")`, el: true, handler: true, cond: ok, pass: ok, errs: err });
  try { vm.runInContext('FV.pick = "ascent"', context); } catch (e) {} toLobby();
}

// ---------- weapon drops ----------
if (!NO3) {
  const xd = (label, body) => { let r = false, err = []; try { r = vm.runInContext("__xe", context)(`(() => { try { ${body} } catch (e) { return String(e.stack || e).slice(0, 300); } })()`); } catch (e) { err.push(String(e).slice(0, 300)); } if (typeof r === "string") { err.push(r); r = false; } report.push({ label: "Drops: " + label, el: true, handler: true, cond: !!r, pass: !!r, errs: err }); };
  xd("killing a bot drops a gun entity", 'FV.pick = "ascent"; FV.srOn = 0; FV.dm = false; FV.tdm = false; window.xSwift = false; startFive(); clearTimeout(FV.to); FV.buy = 0; player.hp = 100; const b = bots.find((u) => u && u.alive && u.g); if (!b) return "no live bot"; FV.bs = FV.bs || {}; FV.bs[b.name] = Object.assign(FV.bs[b.name] || {}, { w: "Phantom" }); b.w = "Vandal"; const bx = b.g.position.x, bz = b.g.position.z, n = __xd.L.length; try { kill(b, false); } catch (e) {} const d = __xd.L[__xd.L.length - 1]; return __xd.L.length === n + 1 && d.w === "Phantom" && !!d.m && Math.abs(d.x - bx) < 0.01 && Math.abs(d.z - bz) < 0.01;');
  xd("F near it swaps guns", 'const d = __xd.L.find((g) => g.w === "Phantom"); if (!d) return "no dropped gun"; FV.pri = "Vandal"; slots.pri = { ammo: 25, rsv: 75 }; rw = "pri"; ammo = 25; rsv = 75; player.x = d.x; player.z = d.z + 1; yaw = 0; const ok = xdUse(); return ok === true && FV.pri === "Phantom" && rw === "pri" && __xd.L.indexOf(d) < 0 && __xd.L.some((g) => g.w === "Vandal");');
  xd("pool caps at 16 and round start clears", 'for (let i = 0; i < 20; i++) xdDrop("Spectre", i, 0); const cap = __xd.n <= 16 && __xd.L.length <= 16; fRound(); return cap && __xd.L.length === 0;');
  try { toLobby(); } catch (e) {}
}

// ---------- nav graphs (Bind, Haven) ----------
if (!NO3) {
  try { for (const m of require("./nav.js")(context)) report.push({ label: `Nav ${m.k}: ${m.nodes} nodes, ${m.nc} component(s); ${m.checked.join(", ")} ` + (m.miss.length ? "unreachable: " + m.miss.join(", ") : "reachable") + (m.split.length ? "; off main: " + m.split.join(" ") + "; suggested nav points: " + JSON.stringify(m.fix) : ""), el: true, handler: true, cond: m.nc === 1 && !m.miss.length, pass: m.nc === 1 && !m.miss.length, errs: [] }); }
  catch (e) { report.push({ label: "Nav audit", el: true, handler: true, pass: false, errs: [String(e).slice(0, 300)] }); }
}

// ---------- progression: XP, level, missions, resets ----------
if (!NO3) {
  const pc = (label, body) => { let r = false, err = []; try { r = vm.runInContext(`(() => { try { const H = window.__xLv; if (!H) return "no __xLv hook"; ${body} } catch (e) { return String(e.stack || e).slice(0, 300); } })()`, context); } catch (e) { err.push(String(e).slice(0, 300)); } if (typeof r === "string") { err.push(r); r = false; } report.push({ label: "Progression: " + label, el: true, handler: true, cond: !!r, pass: !!r, errs: err }); };
  pc("5v5 13-7 win adds 13*1000 + 20*200 XP and levels up", 'H.roll(); const L = H.LV; L.d = {}; L.dd = {}; L.w = {}; L.wd = {}; L.xp = 0; try { document.getElementById("game").dataset.xMode = ""; } catch (e) {} const l0 = H.lvl(); window.xCareerRec({ mode: "five", score: "13\u20137", result: "win", k: 0, d: 0 }); const want = 13 * 1000 + 20 * 200; return (H.LV.xp === want && H.lvl() === Math.floor(want / 5000) + 1 && H.lvl() > l0) || JSON.stringify({ xp: H.LV.xp, lv: H.lvl() });');
  { let ok = false, err = []; try { vm.runInContext("window.__xLv.roll(); window.__xLv.LV.d.k = 0; window.__xLv.LV.dd = {};", context); advance(600); const k0 = vm.runInContext("window.__xLv.LV.d.k || 0", context); vm.runInContext("__xe", context)("stats.k = (stats.k || 0) + 3"); advance(600); const k1 = vm.runInContext("window.__xLv.LV.d.k || 0", context); ok = k1 - k0 === 3; if (!ok) err.push("k " + k0 + " -> " + k1); } catch (e) { err.push(String(e).slice(0, 300)); }
    report.push({ label: "Progression: 3 kills add +3 to daily 'Get 30 kills'", el: true, handler: true, cond: ok, pass: ok, errs: err }); }
  pc("a plant adds +1 to weekly 'Plant or defuse 10 Spikes'", 'H.roll(); const s0 = H.LV.w.s || 0; H.hookUp(); __xe(\'feed("You planted the Spike")\'); return (H.LV.w.s || 0) === s0 + 1;');
  pc("mission completion grants bonus XP once only", 'H.roll(); const L = H.LV; L.d.k = 29; L.dd = {}; const x0 = L.xp; H.add("k", 1); const x1 = H.LV.xp; H.add("k", 5); const x2 = H.LV.xp; return (x1 - x0 === 1500 && x2 === x1 && H.LV.dd.k === 1) || JSON.stringify({ x0, x1, x2 });');
  pc("daily resets when the local date changes, reset date stored", 'const L = H.LV; L.dk = "1999-0-1"; L.d.k = 7; L.dd.k = 1; H.roll(); return H.LV.dk === H.day() && !H.LV.d.k && !H.LV.dd.k && (typeof localStorage === "undefined" || JSON.parse(localStorage.getItem("vs.lvl") || "{}").dk !== undefined);');
  pc("weekly resets on Monday, reset date stored", 'const L = H.LV; L.wk = "0"; L.w.s = 4; H.roll(); const m = new Date(+H.week()); return H.LV.wk === H.week() && !H.LV.w.s && m.getDay() === 1 && m.getHours() === 0;');
  try { toLobby(); } catch (e) {}
}

// ---------- lobby agent persists on lock in ----------
if (!NO3) {
  let ok = false, err = [];
  try { const r = vm.runInContext("__xe", context)(`(() => { try { J.pick = "Sova"; agentSelect(() => {}); document.getElementById("xAgL").onclick(); const st = (() => { try { return localStorage.getItem("vs.lastAg"); } catch (e) { return "Sova"; } })(); return (S.lastAg === "Sova" && (st == null || st === "Sova") && xAAMem.lastAg === "Sova") || JSON.stringify({ lastAg: S.lastAg, st }); } catch (e) { return String(e.stack || e).slice(0, 300); } })()`); if (r === true) ok = true; else err.push(String(r)); } catch (e) { err.push(String(e).slice(0, 300)); }
  report.push({ label: "Lobby agent: locking Sova sets and saves the lobby agent", el: true, handler: true, cond: ok, pass: ok, errs: err });
  try { toLobby(); } catch (e) {}
}

// ---------- spawn barriers: Bind / Haven / Split spawns on their own team's side ----------
if (!NO3) {
  for (const m of ["bind", "haven", "split"]) {
    let ok = false, err = [];
    try {
      const r = vm.runInContext("__xe", context)(`(() => { try {
        const S0 = xSpawn("${m}"), m0 = FV.map, a0 = FV.atk, bad = []; if (S0 === XMAP_SPAWN["${m}"] && S0.edge > 0 && S0.edge < S0.atk) {} else return "no per-map barrier for ${m}";
        for (const atk of [true, false]) { FV.map = "${m}"; FV.atk = atk; // spawn points as fSpawn / fRound place them: player at pz0, mates at mz = atk ? spawn.atk : -spawn.atk, enemies at -mz
          const e = xSpawn(FV.map).edge, sz = xSpawn(FV.map).atk, mz = atk ? sz : -sz, pz = atk ? S0.atk : S0.def, A = (z) => z >= e, D = (z) => z <= -e;
          if (!(atk ? A(pz) : D(pz))) bad.push("player " + pz);
          F_MATES.forEach((n) => { if (!(atk ? A(mz) : D(mz))) bad.push(n + " " + mz); });
          F_EN.forEach((n) => { if (!(atk ? D(-mz) : A(-mz))) bad.push(n + " " + -mz); }); }
        FV.map = m0; FV.atk = a0; return !bad.length || bad.join(", ");
      } catch (e) { return String(e.stack || e).slice(0, 300); } })()`);
      if (r === true) ok = true; else err.push(String(r));
    } catch (e) { err.push(String(e).slice(0, 300)); }
    report.push({ label: `Spawn barrier (${m}): every spawn point on its own team's side`, el: true, handler: true, cond: ok, pass: ok, errs: err });
  }
  for (const m of ["bind", "haven", "split", "ascent", "lotus", "breeze"]) {
    let ok = false, err = [];
    try {
      const r = vm.runInContext("__xe", context)(`(() => { try {
        const m0 = FV.map, a0 = FV.atk, bad = [], g0 = mkGuy; /* the THREE stub's position.set is a no-op: store x/z directly so the spawn points are real */
        mkGuy = function (x, z) { const r = g0.apply(this, arguments); r.g.position.x = x; r.g.position.z = z; return r; };
        try { for (const atk of [true, false]) { FV.map = "${m}"; FV.atk = atk; fSpawn(); /* the real (wrapped) spawn, incl. the xNudgeAll wrapper */
          const e = xSpawn("${m}").edge, own = (z) => (atk ? z >= e : z <= -e), opp = (z) => (atk ? z <= -e : z >= e);
          if (allies.length !== F_MATES.length || bots.length !== F_EN.length) bad.push((atk ? "atk" : "def") + " count " + allies.length + "/" + bots.length);
          allies.forEach((a) => { if (!own(a.g.position.z)) bad.push((atk ? "atk " : "def ") + a.name + " z=" + a.g.position.z.toFixed(1)); });
          bots.forEach((b) => { if (!opp(b.g.position.z)) bad.push((atk ? "atk " : "def ") + b.name + " z=" + b.g.position.z.toFixed(1)); }); } } finally { mkGuy = g0; }
        FV.map = m0; FV.atk = a0; return !bad.length || bad.join(", ");
      } catch (e) { return String(e.stack || e).slice(0, 300); } })()`);
      if (r === true) ok = true; else err.push(String(r));
    } catch (e) { err.push(String(e).slice(0, 300)); }
    report.push({ label: `Spawn barrier (${m}): real fSpawn keeps both teams on their own side (atk + def)`, el: true, handler: true, cond: ok, pass: ok, errs: err });
  }
  { let ok = false, err = [];
    try {
      const r = vm.runInContext("__xe", context)(`(() => { const e0 = SFX.empty, s = { rw, ammo, reloading, fcd, mode, sw: VM.sw, p: player }; let n = 0;
        try { SFX.empty = () => { n++; }; if (!player) player = { x: 0, z: 0, y: 0, hp: 100 }; if (player.hp <= 0) player.hp = 100;
          rw = "pri"; ammo = 0; reloading = 0; fcd = 0; VM.sw = 0; if (mode === "five") mode = "x"; shoot(); return n === 1 || "dry-fire calls " + n;
        } catch (e) { return String(e.stack || e).slice(0, 300); } finally { SFX.empty = e0; rw = s.rw; ammo = s.ammo; reloading = s.reloading; fcd = s.fcd; mode = s.mode; VM.sw = s.sw; player = s.p; } })()`);
      if (r === true) ok = true; else err.push(String(r));
    } catch (e) { err.push(String(e).slice(0, 300)); }
    report.push({ label: "Dry fire: shooting at 0 ammo calls SFX.empty", el: true, handler: true, cond: ok, pass: ok, errs: err });
  }
  try { toLobby(); } catch (e) {}
}

// ---------- bullet decals: a player shot at an Ascent wall writes a decal instance matrix with non-zero scale ----------
if (!NO3) {
  let ok = false, err = [];
  try {
    const r = vm.runInContext("__xe", context)(`(() => { const s0 = { rw, ammo, rsv, reloading, fcd, sw: VM.sw, yaw, pitch }; try {
      FV.pick = "ascent"; FV.srOn = 0; FV.dm = false; FV.tdm = false; window.xSwift = false; startFive(); clearTimeout(FV.to); FV.buy = 0; player.hp = 100;
      if (FV.map !== "ascent") return "map is " + FV.map;
      const W = boxes.filter((b) => b.h >= 4 && b.x2 - b.x1 >= 2); if (!W.length) return "no Ascent walls";
      for (const b of W) {
        player.x = (b.x1 + b.x2) / 2; player.z = b.z2 + 2.5; player.y = 0; player.ch = 0; yaw = 0; pitch = 0;
        if (boxes.some((o) => player.x >= o.x1 && player.x <= o.x2 && player.z >= o.z1 && player.z <= o.z2)) continue;
        rw = "pri"; ammo = 25; rsv = 75; reloading = 0; fcd = 0; VM.sw = 0; if (window.BC) BC.cv = 0;
        const i = BFX.ok ? BFX.di % BFX.d.length : 0; if (BFX.dmx) BFX.dmx[i] = null;
        const g0 = gFire, D = ray.ray.direction; D.x = 0; D.y = 0; D.z = -1; gFire = () => {}; // the stub raycaster: camera ray straight at the wall, no spread
        try { shoot(); } finally { gFire = g0; }
        const e = BFX.dmx && BFX.dmx[i]; if (!e) continue;
        const sc = Math.hypot(e[0], e[1], e[2]), hitZ = Math.abs(e[14] - b.z2) < 0.01, nz = e[10] > 0.99;
        if (!hitZ) continue; // something nearer in front of this wall: try the next one
        return (sc > 0.5 && hitZ && nz) || "decal scale " + sc + " z " + e[14] + " want " + b.z2 + " nz " + e[10];
      }
      return "no shot wrote a decal matrix";
    } catch (e) { return String(e.stack || e).slice(0, 300); } finally { rw = s0.rw; ammo = s0.ammo; rsv = s0.rsv; reloading = s0.reloading; fcd = s0.fcd; VM.sw = s0.sw; yaw = s0.yaw; pitch = s0.pitch; } })()`);
    if (r === true) ok = true; else err.push(String(r));
  } catch (e) { err.push(String(e).slice(0, 300)); }
  report.push({ label: "Bullet decal: a player shot at an Ascent wall writes a decal matrix (non-zero scale, on the wall face, facing out)", el: true, handler: true, cond: ok, pass: ok, errs: err });
  try { toLobby(); } catch (e) {}
}

// ---------- aim trainer: switching to Sheriff shows only the Sheriff viewmodel ----------
if (!NO3) {
  let ok = false, err = [];
  try {
    const r = vm.runInContext("__xe", context)(`(() => { try {
      startAim(); aimKey("Digit2");
      if (aimW() !== "Sheriff") return "aimW " + aimW();
      if (wName() !== "Sheriff") return "wName " + wName();
      const vis = Object.keys(VMS).filter((n) => VMS[n].visible === true);
      if (!(vis.length === 1 && vis[0] === "Sheriff")) return "visible: " + vis.join(",");
      rgGun(3); const v2 = Object.keys(VMS).filter((n) => VMS[n].visible === true);
      return (v2.length === 1 && v2[0] === "Phantom") || "after rgGun(3) visible: " + v2.join(",");
    } catch (e) { return String(e.stack || e).slice(0, 300); } })()`);
    if (r === true) ok = true; else err.push(String(r));
  } catch (e) { err.push(String(e).slice(0, 300)); }
  report.push({ label: "Aim trainer: switching to Sheriff makes VMS.Sheriff the only visible gun (and wName() is Sheriff)", el: true, handler: true, cond: ok, pass: ok, errs: err });
  try { toLobby(); } catch (e) {}
}

// ---------- deathmatch: bots stay in the scene with a visible agent model after the loading screen ends ----------
if (!NO3) {
  let ok = false, err = [];
  try {
    const r = vm.runInContext("__xe", context)(`(() => { const sa = scene.add, sr = scene.remove, g0 = mkGuy, calls = [], w = {};
      const par = (p) => function () { for (const o of arguments) { if (!o) continue; if (o.parent && o.parent !== p && o.parent.__kids instanceof Set) o.parent.__kids.delete(o); o.parent = p; if (p.__kids instanceof Set) p.__kids.add(o); } return p; };
      const unp = (p) => function () { for (const o of arguments) if (o && o.parent === p) { o.parent = null; if (p.__kids instanceof Set) p.__kids.delete(o); } return p; };
      const real = (o) => { if (o.__kids instanceof Set) return o; /* stub props read back as truthy proxies */ o.__kids = new Set(); o.add = par(o); o.remove = unp(o); return o; };
      try {
        real(scene); scene.add = par(scene); scene.remove = unp(scene);
        mkGuy = function (x, z, bm) { const r = g0.apply(this, arguments); real(r.g); r.g.add(r.body, r.head); r.body.isMesh = r.head.isMesh = true; r.body.visible = r.head.visible = false; r.g.parent = scene; scene.__kids.add(r.g); return r; };
        ["fSpawn", "fRound", "fCheck"].forEach((n) => { w[n] = eval(n); eval(n + " = function () { calls.push(n); return w[n].apply(this, arguments); }"); });
        if (window.xMatchLoad) window.xMatchLoad(() => startDM(), "ascent", "DEATHMATCH", true); else startDM();
        for (let i = 0; i < 120; i++) { setTimeout(() => {}, 0); }
        window.xLdOn = false; /* loading screen ended */
        const vis = () => bots.map((b) => { const M = b.xm; const ok = b.g.parent === scene && M && !M.dead && !b.xd && M.m && M.m.parent === b.g && M.m.visible !== false; return ok ? null : b.name + (b.g.parent !== scene ? " not in scene" : !M ? " no agent model" : M.dead || b.xd ? " dead model" : " model detached (" + (M.m.parent === scene ? "on scene" : M.m.parent ? "other parent" : "no parent") + ")"); }).filter(Boolean);
        for (let i = 0; i < 180; i++) { dmTick(1 / 60); xVis(1 / 60); if (i === 60 && bots[0]) { const b = bots[0]; b.alive = false; b.hp = 0; scene.remove(b.g); b.drt = 1.5; /* kill() core, without the HUD */ } }
        const bad = vis();
        if (!bots.length) bad.push("no bots");
        if (!FV.dm || mode !== "five") bad.push("left deathmatch");
        if (calls.length) bad.push("round reset ran in DM: " + calls.join(","));
        return !bad.length || bad.join("; ");
      } catch (e) { return String(e.stack || e).slice(0, 300); }
      finally { scene.add = sa; scene.remove = sr; mkGuy = g0; for (const n in w) eval(n + " = w[n]"); try { running = false; FV.dm = false; } catch (e) {} } })()`);
    if (r === true) ok = true; else err.push(String(r));
  } catch (e) { err.push(String(e).slice(0, 300)); }
  report.push({ label: "Deathmatch: after start + loading screen + ~3 s, every bot is in the scene with a live agent model (incl. a respawned bot)", el: true, handler: true, cond: ok, pass: ok, errs: err });
  try { toLobby(); } catch (e) {}
}

// ---------- material clone sites: array materials and undefined never throw "m.clone is not a function" ----------
if (!NO3) {
  let ok = false, err = [];
  try {
    const r = vm.runInContext("__xe", context)(`(() => { const bad = [];
      const mk = () => new THREE.MeshLambertMaterial({ color: 0xffffff });
      const inputs = [["array", () => [mk(), mk(), undefined, {}]], ["undefined", () => undefined], ["plain object", () => ({})]];
      const sites = {
        "xSolKit mat": (m) => xSolKit("Jett", 0xff4655).mat(m, { name: "body" }),
        "solOwn clone (xSolOwnM)": (m) => xSolOwnM(m, []),
        "xTintM": (m) => xTintM(m, 0xd9b583, 0xe0bd86),
        "skMat": (m) => skMat(m, "Default"),
        "xDrop": (m) => { const g = new THREE.Group(); g.material = m; xDrop(g); xDrop(m); },
      };
      for (const s in sites) for (const [n, f] of inputs) { try { const out = sites[s](f()); if (n === "array" && s !== "xDrop" && !Array.isArray(out)) bad.push(s + "(" + n + ") did not return an array"); } catch (e) { bad.push(s + "(" + n + "): " + String(e).slice(0, 120)); } }
      return !bad.length || bad.join("; "); })()`);
    if (r === true) ok = true; else err.push(String(r));
  } catch (e) { err.push(String(e).slice(0, 300)); }
  report.push({ label: "Material clone sites (xSolKit mat, solOwn, xTintM, skMat, xDrop) accept array and undefined materials without throwing", el: true, handler: true, cond: ok, pass: ok, errs: err });
}

// ---------- null-ref sweep: lazily created / cached UI missing, unknown selectors return null; nothing may throw ----------
if (!NO3) {
  const err = []; let ok = false;
  try {
    toLobby(); phase = "null-ref sweep";
    const e0 = errors.length, xe = vm.runInContext("__xe", context);
    const qs0 = doc.querySelector, gi0 = doc.getElementById;
    const known = new Set(); walk(docEl, (n) => n.id && known.add(n.id));
    // stub: ids absent from the shipped markup and unknown selectors resolve to null, never throw
    doc.getElementById = function (id) { return known.has(id) ? gi0.call(this, id) : null; };
    doc.querySelector = function (s) { try { return qs0.call(this, s); } catch (e) { return null; } };
    const wreck = `(() => { try { if (typeof DM !== "undefined") { DM.lb = null; DM.ts = null; DM.lbS = "x"; DM.tsS = "x"; }
      if (typeof xKL !== "undefined" && xKL.el) { xKL.el.innerHTML = ""; xKL.t = xKL.nm = null; }
      const a = document.getElementById("xAnn"); if (a) a.innerHTML = "";
      ["ammo", "hp"].forEach((i) => { const e = document.getElementById(i); if (e) e.innerHTML = ""; });
      ["jC", "jQ", "jE", "jX"].forEach((i) => { const e = document.getElementById(i); if (e) e.innerHTML = ""; });
      if (typeof AGV !== "undefined" && AGV.li) document.getElementById("xAgTm").innerHTML = ""; } catch (e) { return "wreck: " + e; } return true; })()`;
    const run = (label, body) => {
      let r; try { r = xe(`(() => { try { ${body}; return true; } catch (e) { return String(e.stack || e).split("\\n").slice(0, 2).join(" | "); } })()`); } catch (e) { r = String(e); }
      if (r !== true) err.push(label + ": " + r);
      try { advance(400); } catch (e) { err.push(label + " (frames): " + e); }
      const w = xe(wreck); if (w !== true) err.push(String(w));
    };
    xe(wreck);
    run("lobby open", 'document.getElementById("lobbyBtn").onclick && document.getElementById("lobbyBtn").onclick()');
    run("lobby close (agent select)", 'document.getElementById("lobby").style.display = "none"; if (typeof agentSelect === "function") agentSelect(() => {})');
    run("startDM", 'FV.dm = true; FV.tdm = false; startDM(); clearTimeout(FV.to)');
    run("startTDM", 'FV.tdm = true; startTDM(); clearTimeout(FV.to)');
    run("startFive", 'FV.pick = "ascent"; FV.srOn = 0; FV.dm = false; FV.tdm = false; window.xSwift = false; startFive(); clearTimeout(FV.to); FV.buy = 0; player.hp = 100');
    run("simulated kill", 'const b = bots.find((u) => u && u.alive) || bots[0]; if (b) kill(b, true, "You", "Vandal"); feed("Jett killed Sova"); if (typeof kfeed === "function") kfeed("You", b ? b.name : "Bot", true, "Vandal")');
    run("player death (killed-by card)", 'if (typeof xKLDie === "function") xKLDie((bots[0] && bots[0].name) || "Bot", "Vandal")');
    run("round start", 'fRound()');
    run("Range (aim trainer)", 'startAim()');
    run("lobby again", 'document.getElementById("lobbyBtn").onclick && document.getElementById("lobbyBtn").onclick()');
    doc.getElementById = gi0; doc.querySelector = qs0;
    errors.slice(e0).filter((e) => /of null|of undefined|is not a function/.test(e.msg)).slice(0, 4).forEach((e) => err.push(e.where + ": " + e.msg));
    ok = !err.length;
  } catch (e) { err.push(String(e).slice(0, 300)); }
  report.push({ label: "Null-ref sweep: startDM/startTDM/startFive/Range, lobby open/close, a kill and a round start with lazy UI removed and unknown selectors null never throw", el: true, handler: true, cond: ok, pass: ok, errs: err });
  try { toLobby(); } catch (e) {}
}

// ---------- Tab scoreboard: 5v5 renders 10 rows with K/D/A cells ----------
{
  phase = "tab board 5v5"; let ok = false, err = [];
  try {
    const xe = vm.runInContext("__xe", context);
    xe('FV.pick = "ascent"; FV.srOn = 0; FV.dm = false; FV.tdm = false; window.xSwift = false; startFive(); clearTimeout(FV.to); FV.buy = 0; player.hp = 100; paused = false; running = true; true');
    advance(100);
    dispatch(win, mkEvent("keydown", { key: "Tab", code: "Tab" })); advance(50);
    const bd = $("xBoard"), on = bd && bd.classList.contains("on");
    if (!on) { xe('board(); document.getElementById("xBoard").classList.add("on"); true'); err.push("Tab keydown did not open the board"); }
    const rows = bd ? Array.from(bd.querySelectorAll(".x-sbt tbody tr")) : [];
    const kda = rows.filter((r) => ["k", "d", "a"].every((c) => { const td = r.querySelector("td." + c); return td && /^\d+$/.test(td.textContent.trim()); }));
    if (rows.length !== 10) err.push("rows: " + rows.length + " " + xe('JSON.stringify([F_MATES, F_EN])'));
    if (kda.length !== rows.length) err.push("rows with K/D/A: " + kda.length);
    if (bd && bd.querySelectorAll(".x-sbt.al, .x-sbt.en").length !== 2) err.push("team tables missing");
    dispatch(win, mkEvent("keyup", { key: "Tab", code: "Tab" })); advance(50);
    ok = !err.length;
  } catch (e) { err.push(String(e).slice(0, 300)); }
  report.push({ label: "Tab in 5v5 opens the scoreboard with 10 rows, each with K/D/A cells", el: true, handler: true, cond: ok, pass: ok, errs: err });
  try { toLobby(); } catch (e) {}
}

// ---------- scoreboard+duel fixes: bot ult pips, 5v5 credits column, duel/aim empty-click parity ----------
{
  phase = "sbfix board"; let ok = false, err = [];
  try {
    const r = vm.runInContext("__xe", context)(`(() => { try {
      FV.pick = "ascent"; FV.srOn = 0; FV.dm = false; FV.tdm = false; window.xSwift = false; startFive(); clearTimeout(FV.to); FV.buy = 0; player.hp = 100; paused = false; running = true;
      const UC = window.xBotUC; if (!UC) return "no xBotUC";
      const all = bots.concat(allies).filter((u) => u && u.name); if (!all.length) return "no bots";
      const b = all[0], n = b.name, a = xAg(b), m = (window.xBotUltCost && window.xBotUltCost(a)) || 7;
      UC[n] = 0; window.xBotUltGain(n); window.xBotUltGain(n); if (UC[n] !== 2) return "gain " + a + " -> " + UC[n];
      const ul = sbUlt(n); if (ul[0] !== 2 || ul[1] !== m) return "sbUlt " + JSON.stringify(ul);
      const rows = sbTable([n], "en", () => true); const on = (rows.match(/<i class="on">/g) || []).length; if (on !== 2) return "pips on " + on;
      const bad = [];
      FV.cr = 4321; if (String(sbCred("You", SB.You || {})) !== "4321") bad.push("You " + sbCred("You", SB.You || {}));
      Object.keys(FV.bs).forEach((k, i) => { FV.bs[k].cr = 1000 + i; const p = SB[k] || { k: 0, d: 0, a: 0, dmg: 999, sp: 1 }; if (sbCred(k, p) !== 1000 + i) bad.push(k + " " + sbCred(k, p)); });
      if (!Object.keys(FV.bs).length) bad.push("FV.bs empty");
      return bad.length ? "credits: " + bad.join(",") : true;
    } catch (e) { return String(e.stack || e).slice(0, 300); } })()`);
    if (r === true) ok = true; else err.push(String(r));
  } catch (e) { err.push(String(e).slice(0, 300)); }
  report.push({ label: "sbfix: bot ult charge (any agent) feeds Tab pips; 5v5 Econ column shows credits (FV.cr / FV.bs[n].cr) for every player", el: true, handler: true, cond: ok, pass: ok, errs: err });
  try { toLobby(); } catch (e) {}
}
{
  phase = "sbfix empty"; let ok = false, err = [];
  try {
    const r = vm.runInContext("__xe", context)(`(() => { const ar = S.autoReload; try {
      startDuel(); du.wait = 0; if (duelBot) duelBot.alive = true; du.w = "op"; du.bolt = 0; running = true; paused = false;
      S.autoReload = false; du.ammo = 0; du.rsv = 5; du.reload = 0; fireHeld = true; duelShoot();
      if (du.reload > 0) return "duel reloaded with autoReload off"; if (fireHeld) return "duel fireHeld not cleared";
      S.autoReload = true; duelShoot(); if (!(du.reload > 0)) return "duel no auto reload";
      du.reload = 0; du.rsv = 0; duelShoot(); if (du.reload > 0) return "duel reload with empty reserve";
      document.getElementById("lobbyBtn").onclick(); startAim(); aimKey("Digit2"); running = true; paused = false; AM.cd = 0; AM.rl = 0;
      S.autoReload = false; AM.ammo = 0; fireHeld = true; aimFire(); if (AM.rl > 0) return "aim reloaded with autoReload off"; if (fireHeld) return "aim fireHeld not cleared";
      S.autoReload = true; AM.cd = 0; aimFire(); if (!(AM.rl > 0)) return "aim no auto reload";
      return true;
    } catch (e) { return String(e.stack || e).slice(0, 300); } finally { S.autoReload = ar; } })()`);
    if (r === true) ok = true; else err.push(String(r));
  } catch (e) { err.push(String(e).slice(0, 300)); }
  report.push({ label: "sbfix: duel and aim trainer empty click match normal modes (SFX.empty, auto reload only if setting on and reserve left, fire hold cleared)", el: true, handler: true, cond: ok, pass: ok, errs: err });
  try { toLobby(); } catch (e) {}
}

// ---------- Settings overhaul: left category tabs switch panes; Auto-reload toggle gates the empty-mag reload ----------
{
  phase = "settings tabs + auto-reload"; let ok = false, err = [];
  try {
    const xe = vm.runInContext("__xe", context);
    $("setBtn").click(); advance(30);
    if (!modalOn("mSet")) err.push("settings did not open");
    const tabs = Array.from(doc.querySelectorAll("#xSTab button[data-st]")), names = tabs.map((b) => String(b.textContent).trim());
    if (names.join(",") !== "General,Controls,Crosshair,Video,Audio") err.push("tabs: " + names.join(","));
    for (const t of tabs) {
      t.click(); advance(10);
      const shown = Array.from(doc.querySelectorAll("#mSet .st-c > [data-sp]")).filter((p) => !p.hidden).map((p) => p.dataset.sp);
      if (shown.length !== 1 || shown[0] !== t.dataset.st) err.push(t.dataset.st + " shows " + shown.join(","));
      if (!t.classList.contains("on") || t.getAttribute("aria-selected") !== "true") err.push(t.dataset.st + " tab not marked on");
    }
    tabs[0].click(); advance(10);
    const cb = $("xAuR");
    if (!cb || cb.closest("[data-sp]").dataset.sp !== "g") err.push("Auto-reload toggle missing from General");
    if (cb && !cb.checked) err.push("Auto-reload not on by default");
    const fire = () => xe('rw = "pri"; ammo = 1; rsv = 10; reloading = 0; fcd = 0; VM.sw = 0; player.hp = 100; shoot(); const r1 = reloading; fcd = 0; shoot(); JSON.stringify([ammo, r1 > 0, reloading > 0])');
    xe('FV.pick = "ascent"; FV.srOn = 0; FV.dm = false; FV.tdm = false; window.xSwift = false; startFive(); clearTimeout(FV.to); FV.buy = 0; paused = false; running = true; true'); advance(50);
    cb.checked = false; dispatch(cb, mkEvent("change")); advance(10);
    if (xe("S.autoReload") !== false) err.push("toggle off did not set S.autoReload=false");
    const off = fire(); if (off !== "[0,false,false]") err.push("off: " + off);
    cb.checked = true; dispatch(cb, mkEvent("change")); advance(10);
    const on = fire(); if (on !== "[0,true,true]") err.push("on: " + on);
    ok = !err.length;
  } catch (e) { err.push(String(e).slice(0, 300)); }
  report.push({ label: "Settings: 5 left tabs (General/Controls/Crosshair/Video/Audio) switch panes; Auto-reload toggle (default on) stops the empty-mag reload when off", el: true, handler: true, cond: ok, pass: ok, errs: err });
  try { closeModals(); toLobby(); } catch (e) {}
}

// ---------- HUD overhaul: health / ammo / timer elements exist and update during a 5v5 match ----------
{
  phase = "hud overhaul live values"; let ok = false, err = [];
  try {
    const xe = vm.runInContext("__xe", context);
    const ids = ["xHp", "xArm", "xMag", "xRs", "xWn", "xTm", "xSA", "xSE", "xPA", "xPE", "feed", "jC", "jQ", "jE", "jX", "xHpB", "xArB"];
    const miss = ids.filter((i) => !$(i)); if (miss.length) err.push("missing: " + miss.join(","));
    xe('FV.pick = "ascent"; FV.srOn = 0; FV.dm = false; FV.tdm = false; window.xSwift = false; startFive(); clearTimeout(FV.to); FV.buy = 0; player.hp = 100; paused = false; running = true; true');
    advance(200);
    xe('if (typeof xResOn !== "undefined") xResOn = false; window.xLdOn = false; player.hp = 63; player.armor = 25; reloading = 0; if (rw === "knife") rw = "rifle"; ammo = 7; timeLeft = 42.4; true');
    advance(400);
    const t = (i) => ($(i) ? $(i).textContent.trim() : "");
    if (t("xHp") !== "63") err.push("xHp=" + t("xHp"));
    if (t("xArm") !== "25") err.push("xArm=" + t("xArm"));
    if (!/^(7|…)$/.test(t("xMag"))) err.push("xMag=" + t("xMag"));
    if (!/^0:4[0-3]$/.test(t("xTm"))) err.push("xTm=" + t("xTm"));
    const w = $("xHpB") ? $("xHpB").style.getPropertyValue("--w") : ""; if (w !== "63%") err.push("hp bar --w=" + w);
    const aw = $("xArB") ? $("xArB").style.getPropertyValue("--w") : ""; if (aw !== "50%") err.push("armor bar --w=" + aw);
    if (!/id="xHudV"/.test(html) || !/@media \(max-width:820px\)\{\s*#game \.hud\.x-top/.test(html)) err.push("HUD overhaul CSS block / 820px breakpoint missing");
    ok = !err.length;
  } catch (e) { err.push(String(e).slice(0, 300)); }
  report.push({ label: "HUD overhaul: health, armor, ammo and round timer elements exist and update live in a 5v5 round (incl. thin HP/armor bars)", el: true, handler: true, cond: ok, pass: ok, errs: err });
  try { toLobby(); } catch (e) {}
}

// ---------- valorant movement: knife run 6.75 m/s, stop on release within ~0.1 s, walk slower, diagonal not faster, no bhop gain ----------
{
  phase = "valorant movement"; let ok = false, err = [];
  try {
    const xe = vm.runInContext("__xe", context);
    xe('FV.pick = "ascent"; FV.srOn = 0; FV.dm = false; FV.tdm = false; window.xSwift = false; startFive(); clearTimeout(FV.to); FV.buy = 0; player.hp = 100; paused = false; running = true; true'); advance(50);
    const r = xe(`(() => { const b0 = blocked, g0 = groundAt, a0 = ads, rw0 = rw; try {
      blocked = () => false; groundAt = () => 0; ads = 0; yaw = 0; const dt = 1 / 120, ks = ["KeyW", "KeyA", "KeyS", "KeyD", "ShiftLeft", "ControlLeft", "Space"];
      const reset = () => { ks.forEach((k) => (keys[k] = false)); Object.assign(player, { x: 0, z: 0, y: 0, vy: 0, vx: 0, vz: 0, air: false, ch: 0, tagT: 0, lp: 0 }); };
      const sp = () => Math.hypot(player.vx, player.vz), run = (s, set) => { for (let i = 0; i < s * 120; i++) { if (set) set(i); moveP(dt, 6.75, false); } return sp(); };
      const o = {}; rw = "knife"; reset(); keys.KeyW = true; o.knife = run(0.6);
      keys.KeyW = false; let t = 0; while (sp() > 0.01 && t < 1) { moveP(dt, 6.75, false); t += dt; } o.stop = t;
      reset(); keys.KeyW = true; keys.ShiftLeft = true; o.walk = run(0.6);
      reset(); keys.KeyW = true; keys.KeyD = true; o.diag = run(0.6);
      reset(); keys.KeyW = true; run(0.6); keys.KeyD = true; let mx = 0; run(4, () => { keys.Space = true; mx = Math.max(mx, sp()); }); o.bhop = mx;
      rw = "pri"; reset(); keys.KeyW = true; o.gun = run(0.6); o.gunW = wName(); return JSON.stringify(o);
    } finally { blocked = b0; groundAt = g0; ads = a0; rw = rw0; ["KeyW", "KeyA", "KeyS", "KeyD", "ShiftLeft", "ControlLeft", "Space"].forEach((k) => (keys[k] = false)); } })()`);
    const o = JSON.parse(r);
    if (Math.abs(o.knife - 6.75) > 0.05) err.push("knife run " + o.knife.toFixed(3) + " m/s (want 6.75)");
    if (!(o.stop <= 0.11)) err.push("stop after release " + o.stop.toFixed(3) + " s (want <= 0.1)");
    if (!(o.walk < o.knife * 0.7 && o.walk > o.knife * 0.4)) err.push("walk " + o.walk.toFixed(3));
    if (o.diag > o.knife + 0.01) err.push("diagonal " + o.diag.toFixed(3) + " faster than " + o.knife.toFixed(3));
    if (o.bhop > o.knife + 0.01) err.push("repeated jumps reached " + o.bhop.toFixed(3) + " m/s");
    if (!(o.gun < o.knife)) err.push(o.gunW + " run " + o.gun.toFixed(3) + " not slower than knife");
    if (!err.length) console.log("valorant movement: " + r);
    ok = !err.length;
  } catch (e) { err.push(String(e).slice(0, 300)); }
  report.push({ label: "valmove: knife run 6.75 m/s, stops <= 0.1 s after release, Shift-walk slower, diagonal not faster, no speed gain from repeated jumps, guns slower than knife", el: true, handler: true, cond: ok, pass: ok, errs: err });
  try { toLobby(); } catch (e) {}
}

// ---------- SCOPE pass: Operator 2.5x/5x, sniper unscope on shot/reload/switch, lens only for snipers, FOV restored ----------
{
  phase = "scope pass"; let ok = false, err = [];
  try {
    const xe = vm.runInContext("__xe", context);
    xe('FV.pick = "ascent"; FV.srOn = 0; FV.dm = false; FV.tdm = false; window.xSwift = false; startFive(); clearTimeout(FV.to); FV.buy = 0; FV.menu = false; player.hp = 100; paused = false; running = true; true'); advance(100);
    const fz = (z) => +(2 * Math.atan(Math.tan(37.5 * Math.PI / 180) / z) * 180 / Math.PI).toFixed(2);
    const st = () => JSON.parse(xe('JSON.stringify({ ads, fov: +camera.fov.toFixed(2), sc: document.getElementById("scope").style.display, cr: document.getElementById("cross").style.display, gun: !!gun.visible, lv: xSC.lv })'));
    const arm = (w) => xe('xdArm("' + w + '"); player.hp = 100; reloading = 0; fcd = 0; VM.sw = 0; xCU = 0; running = true; paused = false; true');
    const settle = () => { xe("xADu(0.5); true"); }; // finish the eased FOV transition
    // Operator: right-click 2.5x, second right-click 5x, third off
    arm("Operator"); xe("xScopeT(); true"); settle(); let a = st();
    if (a.ads !== 2 || Math.abs(a.fov - fz(2.5)) > 0.05 || a.sc !== "block" || a.cr !== "none" || a.gun) err.push("op 2.5x: " + JSON.stringify(a));
    xe("xScopeT(); true"); settle(); a = st();
    if (a.ads !== 2 || a.lv !== 2 || Math.abs(a.fov - fz(5)) > 0.05) err.push("op 5x: " + JSON.stringify(a));
    xe("xScopeT(); true"); settle(); a = st();
    if (a.ads !== 0 || Math.abs(a.fov - 75) > 0.05 || a.sc !== "none" || a.cr === "none" || !a.gun) err.push("op off: " + JSON.stringify(a));
    // eased in: mid-transition FOV sits between hip and target
    xe("xScopeT(); xADu(0.04); true"); a = st(); if (!(a.fov < 74.9 && a.fov > fz(2.5) + 0.05)) err.push("no eased zoom: " + a.fov);
    // sniper shot unscopes and restores FOV
    settle(); xe("ammo = 5; fcd = 0; shoot(); true"); a = st(); if (a.ads !== 0 || Math.abs(a.fov - 75) > 0.05 || a.sc !== "none") err.push("shot did not unscope: " + JSON.stringify(a));
    // bolt cycling blocks re-scope
    xe("xScopeT(); true"); a = st(); if (a.ads !== 0) err.push("scoped during bolt");
    // reload unscopes (frame safety net), FOV back
    xe("fcd = 0; reloading = 0; xScopeT(); true"); settle(); xe("reloading = 2; for (const f of window.XHK) try { f(); } catch (e) {} true"); a = st();
    if (a.ads !== 0 || Math.abs(a.fov - 75) > 0.05) err.push("reload did not unscope: " + JSON.stringify(a));
    // weapon switch unscopes
    xe("reloading = 0; fcd = 0; xScopeT(); true"); settle(); arm("Vandal"); a = st(); if (a.ads !== 0 || Math.abs(a.fov - 75) > 0.05 || a.sc !== "none") err.push("switch did not unscope: " + JSON.stringify(a));
    // rifle ADS: light zoom, mini sight, no black lens; a rifle shot keeps ADS
    xe("xScopeT(); true"); settle(); a = st();
    if (a.ads !== 1 || Math.abs(a.fov - fz(1.25)) > 0.05 || a.sc !== "none" || !a.gun) err.push("vandal ads: " + JSON.stringify(a));
    if (xe('document.getElementById("xAdsT").style.opacity') !== "1.00") err.push("mini sight not shown");
    xe("ammo = 20; fcd = 0; shoot(); true"); if (st().ads !== 1) err.push("rifle shot dropped ADS");
    xe("xScopeT(); true"); settle(); a = st(); if (a.ads !== 0 || Math.abs(a.fov - 75) > 0.05) err.push("vandal off: " + JSON.stringify(a));
    // Marshal 3.5x lens; death snaps out; lobby leaves no scope
    arm("Marshal"); xe("xScopeT(); true"); settle(); a = st(); if (a.ads !== 2 || Math.abs(a.fov - fz(3.5)) > 0.05 || a.sc !== "block") err.push("marshal: " + JSON.stringify(a));
    xe("player.hp = 0; setScope(false); true"); a = st(); if (a.ads !== 0 || Math.abs(a.fov - 75) > 0.05 || a.sc !== "none") err.push("death: " + JSON.stringify(a));
    arm("Operator"); xe("xScopeT(); true"); settle(); xe('document.getElementById("lobbyBtn").onclick(); true'); a = st();
    if (a.ads !== 0 || Math.abs(a.fov - 75) > 0.05 || a.sc !== "none") err.push("lobby: " + JSON.stringify(a));
    ok = !err.length;
  } catch (e) { err.push(String(e.stack || e).slice(0, 300)); }
  report.push({ label: "Scope pass: Operator 2.5x then 5x, eased FOV, unscope on sniper shot / reload / switch / death / lobby, lens only for snipers (rifles get a mini sight), FOV restored to 75", el: true, handler: true, cond: ok, pass: ok, errs: err });
  try { toLobby(); } catch (e) {}
}

// ---------- map scale + layout: size, spawn→site run time on the bot nav graph, spawns clear, sites reachable (1 unit = 1 m: eye 1.5, run 6.75 m/s) ----------
if (!NO3) {
  let R = null, err = [];
  try { R = JSON.parse(vm.runInContext("__xe", context)(`(() => { const RUN = 6.75, out = [], keepS = Object.assign({}, SITES), keepB = boxes;
    const pads = { ascent: ASC_SITES, bind: { A: [-20, -21], B: [20, -21] }, haven: HSITES, split: SSITES, lotus: LSITES, breeze: BZSITES };
    try { for (const k of ["ascent", "bind", "haven", "split", "lotus", "breeze"]) {
      if (k !== "ascent") xBuildMap(k); const bx = FMAP[k].boxes, sp = xSpawn(k), P = pads[k], bad = [];
      let x1 = 1e9, x2 = -1e9, z1 = 1e9, z2 = -1e9; bx.forEach((b) => { if (BH(b) < 4) return; x1 = Math.min(x1, b.x1); x2 = Math.max(x2, b.x2); z1 = Math.min(z1, b.z1); z2 = Math.max(z2, b.z2); });
      const W = x2 - x1, D = z2 - z1, inBox = (x, z, r) => bx.some((b) => BH(b) > 0.5 && !(BH(b) < 4 && b.x2 - b.x1 > 6 && b.z2 - b.z1 > 6) /* raised walkable platforms (Split sites) are floor, not walls */ && x > b.x1 - r && x < b.x2 + r && z > b.z1 - r && z < b.z2 + r);
      for (const z of [sp.atk, -sp.atk]) for (let x = -8; x <= 8; x += 2) if (inBox(x, z, 0.4)) bad.push("spawn (" + x + "," + z + ") in geometry");
      for (const s in P) if (inBox(P[s][0], P[s][1], 0.3)) bad.push("site " + s + " centre in geometry");
      let N, adj; boxes = bx;
      if (k === "ascent") { const keys = Object.keys(ASC_NODE); N = keys.map((q) => ASC_NODE[q]); adj = N.map(() => []);
        ASC_EDGE.forEach(([a, b]) => { const i = keys.indexOf(a), j = keys.indexOf(b), d = Math.hypot(N[i][0] - N[j][0], N[i][1] - N[j][1]); adj[i].push([j, d]); adj[j].push([i, d]); if (!ascClear(N[i][0], N[i][1], N[j][0], N[j][1])) bad.push("edge " + a + "-" + b + " blocked"); });
        keys.forEach((q) => { if (blocked(ASC_NODE[q][0], ASC_NODE[q][1], 0.45)) bad.push("node " + q + " in geometry"); }); }
      else { for (const s in SITES) delete SITES[s]; Object.assign(SITES, P); const G = xgBuild(k); N = G.N; adj = G.adj; }
      boxes = keepB;
      const near = (x, z) => { let bi = -1, bd = 1e9; N.forEach((p, i) => { const d = Math.hypot(p[0] - x, p[1] - z); if (d < bd) { bd = d; bi = i; } }); return [bi, bd]; };
      const dj = (s) => { const Dd = N.map(() => 1e9), done = N.map(() => false); Dd[s] = 0; for (;;) { let u = -1; Dd.forEach((v, i) => { if (!done[i] && v < 1e9 && (u < 0 || v < Dd[u])) u = i; }); if (u < 0) break; done[u] = true; adj[u].forEach(([v, c]) => { if (Dd[u] + c < Dd[v]) Dd[v] = Dd[u] + c; }); } return Dd; };
      const t = {};
      for (const side of ["atk", "def"]) { const [s, sd] = near(0, side === "atk" ? sp.atk : -sp.atk), Dd = dj(s);
        for (const q in P) { const [e, ed] = near(P[q][0], P[q][1]), d = Dd[e] + sd + ed; if (sd > 8 || ed > 8 || !(d < 1e8)) { bad.push(side + "→" + q + " unreachable"); t[side + q] = null; } else t[side + q] = +(d / RUN).toFixed(1); } }
      out.push({ k, W: +W.toFixed(1), D: +D.toFixed(1), t, bad });
    } } finally { boxes = keepB; for (const s in SITES) delete SITES[s]; Object.assign(SITES, keepS); }
    return JSON.stringify(out); })()`)); } catch (e) { err.push(String(e).slice(0, 300)); }
  for (const m of R || []) {
    const big = Math.max(m.W, m.D), tA = Object.entries(m.t).filter(([q]) => q.startsWith("atk")), tD = Object.entries(m.t).filter(([q]) => q.startsWith("def"));
    const sizeOk = big <= 150 && Math.min(m.W, m.D) >= 60; // Valorant-like 90-150 m; Bind / Haven are compact by design (61 x 81 m) and pass on run time
    const runOk = tA.every(([, v]) => v != null && v >= 7.5 && v <= 16.5) && tD.every(([, v]) => v != null && v <= 16.5); // attacker spawn → each site ~8-16 s at 6.75 m/s; defenders no slower
    const ok = sizeOk && runOk && !m.bad.length;
    report.push({ label: `Map scale ${m.k}: ${m.W} x ${m.D} m; spawn→site run ${Object.entries(m.t).map(([q, v]) => q + " " + (v == null ? "—" : v + "s")).join(", ")}; spawns clear, sites reachable on the nav graph`, el: true, handler: true, cond: ok, pass: ok, errs: m.bad.concat(sizeOk ? [] : ["size out of 60-150 m"], runOk ? [] : ["run time out of 7.5-16.5 s"]) });
  }
  if (!R) report.push({ label: "Map scale audit", el: true, handler: true, pass: false, cond: false, errs: err });
}

// ---------- vB maps visual pass (Haven + Split): site letters on wall + floor, mesh budget, Valorant-scale crates, spawns clear, sites reachable ----------
if (!NO3) {
  let R = null, err = [];
  try { R = JSON.parse(vm.runInContext("__xe", context)(`(() => { const out = [], keepB = boxes, keepS = Object.assign({}, SITES);
    try { for (const k of ["haven", "split"]) {
      xBuildMap(k); const X = k === "haven" ? HAV_X : SPL_X, bx = FMAP[k].boxes, P = k === "haven" ? HSITES : SSITES, sp = xSpawn(k), bad = [], info = {};
      for (const s in P) { if (!X.mark.includes("wall" + s)) bad.push("no wall letter " + s); if (!X.mark.includes("floor" + s)) bad.push("no plant-zone floor marking " + s); }
      info.meshes = X.meshes; info.budget = X.base + 400; if (!(X.meshes > X.base && X.meshes <= X.base + 400)) bad.push("objects added " + X.meshes + " outside " + X.base + ".." + (X.base + 400));
      // crate-like = 0.9-3.2 m footprint, not a wall / pillar; height measured above whatever it stands on (Split raised sites are 2 m)
      const ctr = (b) => [(b.x1 + b.x2) / 2, (b.z1 + b.z2) / 2], area = (b) => (b.x2 - b.x1) * (b.z2 - b.z1);
      const sup = (b) => { const [cx, cz] = ctr(b); return bx.reduce((m, o) => (o !== b && o.h < 4 && o.h < b.h && area(o) > area(b) && cx > o.x1 && cx < o.x2 && cz > o.z1 && cz < o.z2 ? Math.max(m, o.h) : m), 0); };
      let nc = 0; bx.forEach((b) => { const w = b.x2 - b.x1, d = b.z2 - b.z1, e = b.h - sup(b); if (Math.min(w, d) < 0.9 || Math.max(w, d) > 3.2 || e >= 4) return; nc++;
        if (e < 1 - 1e-6 || e > 3.2 + 1e-6) bad.push("crate (" + ctr(b).map((v) => v.toFixed(1)) + ") " + e.toFixed(2) + " m tall"); });
      info.crates = nc; if (nc < 8) bad.push("only " + nc + " crate-like colliders");
      for (const z of [sp.atk, -sp.atk]) for (let x = -8; x <= 8; x += 2) bx.forEach((b) => { if (b.h > 0.3 && x > b.x1 - 0.4 && x < b.x2 + 0.4 && z > b.z1 - 0.4 && z < b.z2 + 0.4) bad.push("collider over spawn (" + x + "," + z + ")"); });
      for (const s in SITES) delete SITES[s]; Object.assign(SITES, P); boxes = bx; const G = xgBuild(k); boxes = keepB;
      if (G.nc !== 1) bad.push("nav graph has " + G.nc + " components");
      const near = (x, z) => { let bi = -1, bd = 1e9; G.N.forEach((q, i) => { const d = Math.hypot(q[0] - x, q[1] - z); if (d < bd) { bd = d; bi = i; } }); return [bi, bd]; };
      const D = G.N.map(() => 1e9), [s0] = near(0, sp.atk), done = G.N.map(() => false); D[s0] = 0;
      for (;;) { let u = -1; D.forEach((v, i) => { if (!done[i] && v < 1e9 && (u < 0 || v < D[u])) u = i; }); if (u < 0) break; done[u] = true; G.adj[u].forEach(([v, c]) => { if (D[u] + c < D[v]) D[v] = D[u] + c; }); }
      for (const q of [[0, -sp.atk, "def spawn"]].concat(Object.keys(P).map((s) => [P[s][0], P[s][1], "site " + s]))) { const [e, ed] = near(q[0], q[1]); if (ed > 8 || !(D[e] < 1e8)) bad.push(q[2] + " unreachable from atk spawn"); }
      out.push({ k, info, bad });
    } } finally { boxes = keepB; for (const s in SITES) delete SITES[s]; Object.assign(SITES, keepS); }
    return JSON.stringify(out); })()`)); } catch (e) { err.push(String(e).slice(0, 300)); }
  for (const m of R || []) report.push({ label: `vB map visuals ${m.k}: wall + floor site letters, ${m.info.meshes}/${m.info.budget} objects, ${m.info.crates} crate colliders 1-3.2 m, spawns clear, sites reachable on the nav graph`, el: true, handler: true, cond: !m.bad.length, pass: !m.bad.length, errs: m.bad.slice(0, 5) });
  if (!R) report.push({ label: "vB map visuals audit", el: true, handler: true, pass: false, cond: false, errs: err });
}

// ---------- print ----------
const bad = report.filter((r) => !r.pass);
console.log(`\n=== audit (${MID ? "THREE loads, 3D init throws" : NO3 ? "THREE missing" : "THREE stub loaded"}) — ${report.length} checks, ${bad.length} failing ===`);
for (const r of report) console.log((r.pass ? "PASS " : "FAIL ") + r.label + (r.pass ? "" : `  [el:${r.el} handler:${r.handler} cond:${r.cond}] ` + r.errs.slice(0, 3).join(" || ")));
const loadErrs = errors.filter((e) => e.phase === "load");
if (loadErrs.length) { console.log("\nload errors:"); loadErrs.slice(0, 10).forEach((e) => console.log("  " + e.where + ": " + e.msg)); }
process.exitCode = bad.length || loadErrs.length ? 1 : 0;
