// Headless load-path audit for index.html. Usage: node work/audit.js [nothree]
// Minimal fake DOM (parser + selector engine + events), fake timers, Proxy THREE.
"use strict";
const fs = require("fs"), vm = require("vm"), path = require("path");
// nothree: the THREE script failed to load. midthrow: THREE loads but the 3D init throws part way (CanvasTexture).
const REAL3 = !!process.env.REAL3, REAL3_DIR = process.env.REAL3_DIR || "/workspace/work/qa";
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
Object.defineProperty(win, "localStorage", { get() { if (win.__ls) return win.__ls; throw new Error("localStorage used"); } }); // win.__ls: a test-only store (obs minimap persistence)
Object.defineProperty(win, "sessionStorage", { get() { throw new Error("sessionStorage used"); } });
const context = vm.createContext(win);
vm.runInContext("Date.now = () => performance.now() + 1.7e12;", context);

// ---------- run the page's scripts in order ----------
const scripts = [...html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)];
for (const s of scripts) {
  const src = (s[1].match(/src="([^"]+)"/) || [])[1];
  if (src) { if (/three/.test(src)) {
      if (REAL3 && !NO3) { // REAL3=1: the real three.js r149 (+ GLTFLoader / SkeletonUtils) with only the WebGL renderers stubbed, so vector / matrix / scene-graph math is real
        const f = /three\.min/.test(src) ? "three.min.js" : /GLTFLoader/.test(src) ? "GLTFLoader.js" : "SkeletonUtils.js";
        try { vm.runInContext(fs.readFileSync(path.join(REAL3_DIR, f), "utf8"), context, { filename: f }); } catch (e) { rec("real three " + f, e); }
        if (f === "three.min.js" && win.THREE) { const T = win.THREE; win.THREE = Object.assign({}, T); win.THREE.WebGLRenderer = function () { return stub("new THREE.WebGLRenderer"); }; win.THREE.PMREMGenerator = function () { return stub("new THREE.PMREMGenerator"); }; }
      } else if (!NO3 || MID) win.THREE = stub("THREE"); } else rec("script", "unexpected external script " + src); continue; }
  // nav hook: the page lives in an IIFE, so expose the map boxes + graph builder to work/nav.js (audit-side only)
  const code = s[2].replace("function xgGet() {", "globalThis.__nav = { get FMAP() { return FMAP; }, get SITES() { return SITES; }, get HSITES() { return HSITES; }, get SSITES() { return SSITES; }, get LSITES() { return LSITES; }, get BZSITES() { return BZSITES; }, xgBuild, xgClear, setB: (b) => { boxes = b; }, getB: () => boxes }; function xgGet() {").replace("function srTick(dt) {", "globalThis.__xe = (s) => eval(s); globalThis.__st = () => ({ mode, FV, player, SR, running, srAll: typeof srAll === \"function\" ? srAll : null, fAtk: typeof fAtk === \"function\" ? fAtk : null, K: typeof K === \"function\" ? K : null, J: typeof J !== \"undefined\" ? J : null, wName: typeof wName === \"function\" ? wName : null, fRound: () => fRound() }); function srTick(dt) {");
  try { vm.runInContext(code, context, { filename: "index.html" }); } catch (e) { rec("top-level script", e); }
}
const xErr0 = win.xErr; if (xErr0) win.xErr = function (e) { xErrCalls.push({ phase, msg: String((e && e.message) || e) }); return xErr0.apply(this, arguments); };
advance(500);

// ---------- audit ----------
if (process.env.DBG) { const $ = (id) => doc.getElementById(id), xe = vm.runInContext("__xe", context); try { eval(fs.readFileSync(process.env.DBG, "utf8")); } catch (e) { console.log("DBG threw", e); } console.log("errors:", JSON.stringify(errors.slice(0, 5)), "xErr:", JSON.stringify(xErrCalls.slice(0, 5))); process.exit(0); }
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
      const r = xe(`(() => { try { J.pick = "Jett"; FV.buy = 0; player.hp = 100; J.c = 2; if (J.cd) J.cd.c = 0; xCaEnd(); jKey("KeyC"); let blk = true; try { const f0 = fcd; fcd = 0; const a0 = typeof ammo !== "undefined" ? ammo : null; shoot(); blk = (a0 == null || ammo === a0); fcd = f0; } catch (e) {} return XCA.on && XCA.ty === "throw" && blk ? true : "no cast state: " + JSON.stringify({ on: XCA.on, ty: XCA.ty, blk, jon: jOn() }); } catch (e) { return String(e.stack || e).slice(0, 300); } })()`);
      if (r !== true) err.push(r);
      else { advance(1000); const r2 = xe(`(() => !XCA.on && XCA.g === 0 && (!XCA.h || !XCA.h.visible) ? true : "still casting t=" + XCA.t + " g=" + XCA.g)()`); if (r2 !== true) err.push(r2); }
      errors.slice(e0).forEach((x) => err.push(x.msg)); ok = !err.length;
    } catch (e) { err.push(String(e).slice(0, 300)); }
    report.push({ label: "Ability cast animation: Jett C (Cloudburst) sets the viewmodel cast state (throw gesture, firing blocked) and returns to the gun within 1 s", el: true, handler: true, cond: ok, pass: ok, errs: err });
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
        const g0 = gFire, D = ray.ray.direction; D.x = 0; D.y = 0; D.z = -1; gFire = () => {}; try { camera.position.set(player.x, 1.6, player.z); camera.rotation.set(0, 0, 0, "YXZ"); camera.updateMatrixWorld(); spray = 0; rcl = 0; rclH = 0; } catch (e) {} // REAL3: aim the real camera at the wall // the stub raycaster: camera ray straight at the wall, no spread
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

// ---------- bots visible through round starts: every mode with rounds, real scene graph (parent chain, visible, scale, height) ----------
if (!NO3) {
  const xe = vm.runInContext("__xe", context);
  // a minimal real Object3D for THREE.Group / Mesh / Object3D / SkinnedMesh while this check runs; unknown members fall back to the stub
  const harness = `(() => {
    const ST = THREE.Group; /* a stub: its call result is a stub fallback */
    class V { constructor(x = 0, y = 0, z = 0) { this.x = x; this.y = y; this.z = z; const P = new Proxy(this, { get: (t, k) => (k in t || typeof k !== "string" ? t[k] : () => P) }); return P; }
      set(x, y, z) { this.x = +x || 0; this.y = +y || 0; this.z = +z || 0; return this; } setScalar(s) { s = +s || 0; return this.set(s, s, s); } copy(v) { return v ? this.set(v.x, v.y, v.z) : this; } clone() { return new V(this.x, this.y, this.z); }
      add(v) { this.x += +v.x || 0; this.y += +v.y || 0; this.z += +v.z || 0; return this; } sub(v) { this.x -= +v.x || 0; this.y -= +v.y || 0; this.z -= +v.z || 0; return this; }
      addScaledVector(v, s) { this.x += (+v.x || 0) * s; this.y += (+v.y || 0) * s; this.z += (+v.z || 0) * s; return this; } multiplyScalar(s) { this.x *= s; this.y *= s; this.z *= s; return this; }
      distanceTo(v) { return Math.hypot(this.x - (+v.x || 0), this.y - (+v.y || 0), this.z - (+v.z || 0)); } length() { return Math.hypot(this.x, this.y, this.z); } lengthSq() { return this.x * this.x + this.y * this.y + this.z * this.z; } }
    const mk = (kind) => function (geo, mat) {
      const fb = ST(), o = { isObject3D: true, type: kind, position: new V(), scale: new V(1, 1, 1), rotation: new V(), visible: true, parent: null, children: [], userData: {}, name: "", __real: true };
      if (kind === "Mesh" || kind === "SkinnedMesh") { o.isMesh = true; o.geometry = geo; o.material = mat; } if (kind === "SkinnedMesh") o.isSkinnedMesh = true; if (kind === "Group") o.isGroup = true;
      o.rotation.order = "XYZ";
      const P = new Proxy(o, { get: (t, k) => (k in t || typeof k === "symbol" ? t[k] : fb[k]), set: (t, k, v) => ((t[k] = v), true) });
      o.add = (...a) => { for (const c of a) { if (!c || c === P) continue; if (c.parent && typeof c.parent.remove === "function" && c.parent !== P) c.parent.remove(c); if (c.parent !== P) { c.parent = P; o.children.push(c); } } return P; };
      o.remove = (...a) => { for (const c of a) { const i = o.children.indexOf(c); if (i >= 0) { o.children.splice(i, 1); c.parent = null; } } return P; };
      o.clear = () => { o.children.slice().forEach((c) => o.remove(c)); return P; };
      o.traverse = (f) => { f(P); o.children.slice().forEach((c) => c && typeof c.traverse === "function" && c.traverse(f)); };
      o.getWorldPosition = (v) => { let x = 0, y = 0, z = 0; for (let n = P; n && n.__real; n = n.parent) { x += n.position.x; y += n.position.y; z += n.position.z; } return v && v.set ? v.set(x, y, z) : new V(x, y, z); };
      o.clone = () => { const c = new (mk(kind))(o.geometry, o.material); c.position.copy(o.position); c.scale.copy(o.scale); c.visible = o.visible; o.children.forEach((k) => k && k.clone && c.add(k.clone())); return c; };
      return P;
    };
    const keys = ["Group", "Object3D", "Mesh", "SkinnedMesh"], saved = {}; keys.forEach((k) => { saved[k] = THREE[k]; THREE[k] = mk(k); });
    const sa = scene.add, sr = scene.remove, sTr = scene.traverse, sCh = scene.children; const kids = [];
    scene.add = (...a) => { for (const c of a) { if (!c) continue; if (c.parent && c.parent !== scene && typeof c.parent.remove === "function") c.parent.remove(c); if (c.parent !== scene) { c.parent = scene; kids.push(c); } } return scene; };
    scene.remove = (...a) => { for (const c of a) { const i = kids.indexOf(c); if (i >= 0) { kids.splice(i, 1); c.parent = null; } } return scene; };
    scene.children = kids; scene.traverse = (f) => { kids.slice().forEach((c) => c && c.__real && c.traverse(f)); };
    globalThis.__bvUndo = () => { keys.forEach((k) => { THREE[k] = saved[k]; }); scene.add = sa; scene.remove = sr; scene.traverse = sTr; scene.children = sCh; };
    return true; })()`;
  // why each alive unit is not visibly standing in the scene ("" when it is)
  const probe = `(tag) => { const bad = []; const units = [].concat(bots || [], allies || []).filter((u) => u && u.g && u.alive !== false && u.hp > 0);
      if (!units.length) bad.push(tag + ": no alive bots");
      for (const u of units) { const why = [];
        let n = u.g, top = null, y = 0; for (; n; n = n.parent) { top = n; if (n === scene) break; if (n.visible === false) why.push("hidden " + (n === u.g ? "root" : n.type || "node")); const s = n.scale; if (s && n.__real && (s.x === 0 || s.y === 0 || s.z === 0)) why.push("scale 0"); if (n.__real) { const q = n.position; if (![q.x, q.y, q.z].every(Number.isFinite)) why.push("position not finite (" + [q.x, q.y, q.z].map(String).join(",") + ")"); y += q.y; } }
        if (top !== scene) why.push("not in scene" + (u.g.__real ? "" : " (stub group)"));
        if (y < -0.5) why.push("under floor y=" + y.toFixed(2));
        const M = u.xm; if (!M || !M.m) why.push("no agent model"); else { if (M.dead || u.xd) why.push("dead model");
          let a = M.m, ok = false; for (; a; a = a.parent) { if (a === u.g) { ok = true; break; } if (a.visible === false) why.push("model node hidden"); if (a.__real && a.scale && (a.scale.x === 0 || a.scale.y === 0 || a.scale.z === 0)) why.push("model scale 0"); }
          if (!ok) why.push("model not under its unit (" + (M.m.parent === scene ? "on scene" : M.m.parent ? "other parent" : "no parent") + ")");
          let vis = 0; const walk = (o, on) => { if (!o) return; const v = on && o.visible !== false; if (v && o.isMesh) { const ms = [].concat(o.material || []); if (ms.some((m) => !m || (m.visible !== false && !(typeof m.opacity === "number" && m.opacity <= 0.01)))) vis++; } (o.children || []).forEach((c) => walk(c, v)); }; walk(M.m, true);
          if (!vis) why.push("no visible mesh in model"); }
        if (why.length) bad.push(tag + " " + u.name + ": " + [...new Set(why)].join(", ")); }
      return bad; }`;
  const MODES = [["5v5", 'FV.srOn = 0; window.xSwift = false; startFive();', true], ["Swiftplay", 'FV.srOn = 0; window.xSwift = true; startFive();', true], ["Spike Rush", "startSR();", true], ["TDM", "startTDM();", false], ["DM", "startDM();", false]];
  for (const [name, start, rounds] of MODES) {
    phase = "botvis " + name; const err = []; let ok = false;
    try {
      toLobby(); if (!REAL3) xe(harness); /* REAL3: the scene graph is already real */
      xe(`(() => { FV.pick = "ascent"; FV.dm = false; FV.tdm = false; const go = () => { ${start} }; if (window.xMatchLoad) window.xMatchLoad(go, "ascent", ${JSON.stringify(name)}, true); else go(); clearTimeout(FV.to); return true; })()`);
      advance(1500); // loading screen hide timer
      const step = (secs) => xe(`(() => { const DT = 1 / 30; for (let i = 0; i < ${secs} * 30; i++) { if (!running) break; fiveTick(DT); xVis(DT); } return true; })()`);
      const look = (tag) => xe(`(${probe})(${JSON.stringify(tag)})`) || [];
      xe("player.hp = 1e6; player.armor = 0; true"); // the player soaks fire so the round does not end on its own
      if (xe("window.xLdOn === true")) err.push("loading screen still up");
      if (rounds) {
        step(1); err.push(...look("buy phase r1"));
        step(xe("Math.ceil(FV.buy) + 1")); if (xe("FV.buy > 0")) err.push("buy phase did not end");
        step(2); err.push(...look("live r1"));
        xe('(() => { player.hp = 1e6; fCheck(true, "audit round end"); return true; })()'); advance(7400); // FV.to fires the next round (7 s post-round)
        if (xe("FV.you + FV.them") !== 1) err.push("round 2 did not start (score " + xe("FV.you + ':' + FV.them") + ")");
        xe("player.hp = 1e6; true"); step(1); err.push(...look("buy phase r2"));
        step(xe("Math.ceil(FV.buy) + 1")); xe("player.hp = 1e6; true"); step(2); err.push(...look("live r2"));
      } else {
        step(2); err.push(...look("live"));
        xe('(() => { const b = bots.find((u) => u.alive); if (b) kill(b, false, "You", "Vandal"); return true; })()'); step(3); err.push(...look("after respawn"));
      }
      ok = !err.length;
    } catch (e) { err.push(String(e.stack || e).slice(0, 300)); }
    try { xe("(() => { try { clearTimeout(FV.to); running = false; FV.dm = false; FV.tdm = false; window.xSwift = false; } catch (e) {} if (globalThis.__bvUndo) globalThis.__bvUndo(); return true; })()"); } catch (e) {}
    report.push({ label: "Bot visibility (" + name + "): through loading, buy phase, live round" + (rounds ? " and round 2" : " and a respawn") + ", every alive bot is in the scene graph, visible up the chain, non-zero scale, above the floor, with a visible agent model", el: true, handler: true, cond: ok, pass: ok, errs: err.slice(0, 6) });
    lastErr = errors.length; lastX = xErrCalls.length;
    try { toLobby(); } catch (e) {}
  }
}

// ---------- aim trainer / duel HUD ammo: the visible bottom-right mag (#xMag) follows shots and reloads ----------
if (!NO3) {
  phase = "aim hud ammo"; let ok = false; const err = [];
  try {
    const xe = vm.runInContext("__xe", context), go = (ms) => advance(ms), mag = () => ($("xMag") ? String($("xMag").textContent).trim() : "missing");
    const shownMag = () => { for (let n = $("xMag"); n && n.nodeType === 1; n = n.parentNode) if (n.hidden || n.style.display === "none") return false; return true; };
    xe("globalThis.__xrs = [xResUp, xSetFull]; xResUp = () => false; xSetFull = () => false; true"); // the stub's getComputedStyle reads every screen as shown, which would cover the game
    if (!/#timer,#score,#hp,#ammo\{display:none!important\}/.test(html)) err.push("legacy #ammo is no longer hidden: re-check which ammo element is visible");
    toLobby(); xe('(() => { xGo(() => startAim()); aimKey("Digit1"); running = true; paused = false; window.xLdOn = false; AM.cd = 0; AM.rl = 0; AM.t = 60; return true; })()'); go(100);
    const w = xe("aimW()"), full = xe("AM.ammo");
    if (!shownMag()) err.push("#xMag hidden in aim trainer");
    if (w === "Knife" || !(full > 3)) err.push("aim gun " + w + " mag " + full);
    const m0 = mag(); if (m0 !== String(full)) err.push("aim start: HUD " + m0 + " vs mag " + full);
    for (let i = 0; i < 3; i++) { xe("AM.cd = 0; AM.fire = false; aimFire(); AM.fire = false; true"); go(20); }
    const m1 = mag(); if (m1 !== String(full - 3)) err.push("aim after 3 shots: HUD " + m1 + " want " + (full - 3) + " (AM.ammo " + xe("AM.ammo") + ")");
    xe('aimKey("KeyR"); true'); go(20); if (!(xe("AM.rl") > 0)) err.push("R did not start an aim reload");
    xe("(() => { for (let i = 0; i < 120 && AM.rl > 0; i++) aimTick(1 / 30); return true; })()"); go(50);
    const m2 = mag(); if (m2 !== String(full)) err.push("aim after reload: HUD " + m2 + " want " + full);
    // duel: the Operator mag on the same HUD element drops per shot
    toLobby(); xe('(() => { xGo(() => startDuel()); du.wait = 0; if (duelBot) duelBot.alive = true; du.w = "op"; du.bolt = 0; du.reload = 0; du.ammo = OP_MAG; running = true; paused = false; window.xLdOn = false; return true; })()'); go(100);
    const d0 = mag(), dn = xe("du.ammo"); if (d0 !== String(dn)) err.push("duel start: HUD " + d0 + " vs du.ammo " + dn);
    xe("(() => { du.bolt = 0; fireHeld = false; duelShoot(); return true; })()"); go(50);
    const d1 = mag(), dn1 = xe("du.ammo"); if (!(dn1 === dn - 1)) err.push("duel shot did not use ammo (" + dn + " -> " + dn1 + ")"); else if (d1 !== String(dn1) && d1 !== "…") err.push("duel after a shot: HUD " + d1 + " want " + dn1);
    ok = !err.length;
  } catch (e) { err.push(String(e.stack || e).slice(0, 300)); }
  report.push({ label: "Aim trainer HUD ammo: 3 shots drop the visible #xMag by 3 and R restores the full mag; Operator Duel's #xMag drops per shot", el: true, handler: true, cond: ok, pass: ok, errs: err });
  try { vm.runInContext("__xe", context)("(() => { running = false; if (globalThis.__xrs) { xResUp = __xrs[0]; xSetFull = __xrs[1]; } return true; })()"); toLobby(); } catch (e) {}
}

// >>> sweep
// ---------- broad QA sweep: nav, queue, every mode x map through rounds/results/lobby, buy+fire+reload+switch, abilities, plant/defuse, death, Tab, pause+settings, 60 s bot soak ----------
if (!NO3) {
  const xe = vm.runInContext("__xe", context);
  const cErr = []; const ce0 = win.console.error; win.console.error = (...a) => { cErr.push({ phase, msg: a.map((x) => String((x && x.message) || x)).join(" ").slice(0, 200) }); };
  let swN = 0;
  // one sweep step: f returns true or a failure string; window errors, xErr calls and console.error during the step all fail it
  const SW = (label, f) => {
    if (!SW.t) SW.t = Date.now(); phase = "sweep " + label; const e0 = errors.length, x0 = xErrCalls.length, c0 = cErr.length; let r;
    try { r = f(); } catch (e) { r = "threw: " + String((e && e.stack) || e).split("\n").slice(0, 2).join(" | ").slice(0, 300); }
    const errs = []; if (r !== true) errs.push(String(r).slice(0, 400));
    errors.slice(e0).forEach((e) => errs.push(e.where + ": " + e.msg.slice(0, 200)));
    xErrCalls.slice(x0).forEach((x) => errs.push("xErr: " + x.msg.slice(0, 200)));
    cErr.slice(c0).forEach((x) => errs.push("console.error: " + x.msg));
    const pass = !errs.length; swN++; if (process.env.SWT) process.stderr.write(((Date.now() - (SW.t || Date.now())) / 1000).toFixed(1) + "s " + label.slice(0, 60) + "\n"); SW.t = Date.now();
    report.push({ label: "Sweep: " + label, el: true, handler: true, cond: r === true, pass, errs: [...new Set(errs)] });
    lastErr = errors.length; lastX = xErrCalls.length; return pass;
  };
  const shown = (id) => { const e = $(id); return !!e && e.style.display !== "" && e.style.display !== "none"; };
  const lobbyBack = () => { for (let i = 0; i < 30 && xe("window.xLdOn === true"); i++) advance(50); try { if (shown("result")) $("lobbyBtn").click(); } catch (e) {} advance(30); toLobby(); xe("(() => { try { running = false; paused = false; clearTimeout(FV.to); clearTimeout(RF.to); FV.dm = false; FV.tdm = false; FV.esc = false; window.xSwift = false; document.getElementById('xPause').classList.remove('on'); } catch (e) {} return true; })()"); advance(30); lastErr = errors.length; lastX = xErrCalls.length; };
  // finite-state probe: player, camera, every bot/ally group position, HUD numbers
  const FIN = `(() => { const bad = []; const f = (v) => (typeof v === "number" ? Number.isFinite(v) : !${REAL3 ? 1 : 0}); /* stub THREE: vectors are proxies, only real numbers are judged */
    if (player) ["x", "z", "hp"].forEach((k) => { if (!f(player[k])) bad.push("player." + k + "=" + player[k]); });
    try { const c = camera.position; if (![c.x, c.y, c.z].every(f)) bad.push("camera " + [c.x, c.y, c.z].join(",")); } catch (e) {}
    [].concat(bots || [], allies || [], duelBot ? [duelBot] : []).forEach((u) => { if (!u || !u.g) return; const p = u.g.position; if (![p.x, p.y, p.z].every(f)) bad.push((u.name || "bot") + " pos " + [p.x, p.y, p.z].join(",")); });
    if (!f(timeLeft)) bad.push("timeLeft=" + timeLeft); if (!f(ammo)) bad.push("ammo=" + ammo); if (!f(rsv)) bad.push("rsv=" + rsv);
    if (mode === "five" && !FV.dm) { if (!f(FV.cr)) bad.push("credits=" + FV.cr); if (!f(FV.you) || !f(FV.them)) bad.push("score"); }
    const T = (id) => { const e = document.getElementById(id); return e ? String(e.textContent).trim() : null; };
    [["xHp", /^\\d+$/], ["xArm", /^\\d+$/], ["xTm", /^(\\d+:\\d\\d|0:\\d\\d(\\.\\d)?|—|)$/]].forEach(([id, re]) => { const t = T(id); if (t != null && /NaN|undefined|Infinity/.test(t)) bad.push(id + "=" + t); });
    ["xMag", "xRs", "xSA", "xSE", "xBC", "timer"].forEach((id) => { const t = T(id); if (t != null && /NaN|undefined|Infinity/.test(t)) bad.push(id + "=" + t); });
    return bad.length ? bad.slice(0, 6).join("; ") : true; })()`;
  const fin = () => xe(FIN);
  const step = (secs, keepAlive, dt) => xe(`(() => { const DT = ${dt || 1 / 30}; for (let i = 0; i < ${secs} * 30; i++) { if (!running) break; ${keepAlive ? "if (player && player.hp > 0) player.hp = Math.max(player.hp, 1e6);" : ""} if (mode === "five") fiveTick(DT); else if (mode === "duel") { du.t += DT; duelTick(DT); } else if (mode === "surf") surfTick(DT); else if (mode === "aim") aimTick(DT); else tick(DT); try { xBotYaw(DT); xVis(DT); xHud(); jTick(DT); vmTick(DT); } catch (e) { throw e; } } return true; })()`);

  // ---- A. lobby nav: open and close each item ----
  lobbyBack();
  const NAV = [["PLAY", "playBtn", () => !$("xQueue").hidden && disp("lobby") === "flex", () => { $("xqClose").click(); return $("xQueue").hidden; }],
    ["CAREER", "navCareer", () => modalOn("mProf"), () => { const c = doc.querySelector("#mProf .row [data-close]") || doc.querySelector("#mProf [data-close]"); if (c) c.click(); return !modalOn("mProf"); }],
    ["CAREER (header ×)", "navCareer", () => modalOn("mProf"), () => { const c = doc.querySelector("#mProf .x"); if (!c) return false; c.click(); return !modalOn("mProf"); }],
    ["COLLECTION", "navInv", () => modalOn("mInv"), () => { doc.querySelector("#mInv .row [data-close]").click(); return !modalOn("mInv"); }],
    ["AGENTS", "navAg", () => modalOn("mAg"), () => { doc.querySelector("#mAg .row [data-close]").click(); return !modalOn("mAg"); }],
    ["SETTINGS", "setBtn", () => modalOn("mSet"), () => { doc.querySelector("#mSet .row [data-close]").click(); return !modalOn("mSet"); }]];
  for (const [n, id, open, close] of NAV) SW("lobby nav " + n + " opens and closes", () => { lobbyBack(); $("xQueue").hidden = true; const b = $(id); if (!b) return "missing #" + id; b.click(); advance(50); if (!open()) return "did not open"; advance(20); if (!close()) return "did not close"; return disp("lobby") === "flex" ? true : "lobby hidden after close"; });
  // ---- A2. lobby 2D UI fixes (real-browser report): roster, profile layout + ×, collection list, community card ----
  SW("AGENTS opens a roster of every agent with a close control; a pick sets the saved lobby agent", () => { lobbyBack(); $("xQueue").hidden = true; $("navAg").click(); advance(20);
    if (!modalOn("mAg")) return "#mAg not open"; const B = Array.from(doc.querySelectorAll("#agList button[data-a]")); if (B.length < 12) return "roster has " + B.length;
    if (B.filter((b) => b.getAttribute("aria-pressed") === "true").length !== 1) return "not exactly one selected"; const sova = B.find((b) => b.dataset.a === "Sova"); sova.click(); advance(10);
    if (xe("S.lastAg") !== "Sova") return "S.lastAg " + xe("S.lastAg"); const s2 = doc.querySelector('#agList button[data-a="Sova"]'); if (!s2 || s2.getAttribute("aria-pressed") !== "true") return "Sova not marked";
    if (!/\S/.test(s2.textContent)) return "empty tile"; doc.querySelector("#mAg .x").click(); if (modalOn("mAg")) return "× did not close"; $("navAg").click(); doc.querySelector("#mAg .row [data-close]").click(); if (modalOn("mAg")) return "Close did not close";
    xe('S.lastAg = "Jett"; true'); return disp("lobby") === "flex" || "lobby hidden"; });
  SW("Career modal: × closes it; panes scroll inside the box above a fixed footer (not absolute under CLOSE); badges use their own grid", () => { lobbyBack(); $("navCareer").click(); advance(10);
    for (const t of doc.querySelectorAll("#mProf [data-pt]")) { t.click(); const pp = doc.querySelector('#mProf [data-pp="' + t.dataset.pt + '"]'); if (pp.hidden) return "pane " + t.dataset.pt + " hidden"; if (pp.parentNode !== doc.querySelector("#mProf .mbox")) return "pane not a direct child"; }
    doc.querySelector("#mProf .x").click(); if (modalOn("mProf")) return "× did not close";
    const need = [/#mProf \.mbox > \.x-pp\{position:static;[^}]*overflow-y:auto/, /#mProf \.mbox\{display:flex;flex-direction:column;[^}]*overflow:hidden/, /#mProf \.x-bg\{grid-template-columns:repeat\(auto-fill/, /#mProf \.x,[^{]*\{z-index:3/];
    const miss = need.filter((r) => !r.test(html)); return miss.length ? "missing CSS " + miss.join(" ") : true; });
  SW("Collection: list scrolls with a visible scrollbar, fade and bottom padding; tags ellipsis; selected swatch is ringed red with a check and aria-pressed", () => { lobbyBack(); $("navInv").click(); advance(10);
    const row = doc.querySelector("#invList .wrow"); if (!row) return "no rows"; const sw = Array.from(row.querySelectorAll(".sw button")); const on = sw.filter((b) => b.getAttribute("aria-pressed") === "true"); if (on.length !== 1) return "selected swatches " + on.length;
    const other = sw.find((b) => !b.classList.contains("on")); other.click(); const row2 = doc.querySelectorAll("#invList .wrow")[0], sw2 = Array.from(row2.querySelectorAll(".sw button")); const i = sw.indexOf(other);
    if (!sw2[i].classList.contains("on") || sw2[i].getAttribute("aria-pressed") !== "true") return "click did not move the selection"; sw2[0].click();
    doc.querySelector("#mInv .row [data-close]").click();
    const need = [/#invList\{padding-bottom:32px;scrollbar-width:thin;[^}]*mask-image/, /#invList \.wn\{[^}]*padding:0 12px;[^}]*text-overflow:ellipsis/, /#invList \.sw button\.on\{border-color:#ff4655/, /#invList \.sw button\.on::after\{content:/];
    const miss = need.filter((r) => !r.test(html)); return miss.length ? "missing CSS " + miss.join(" ") : true; });
  SW("Community card: no placeholder Discord stats beside the live online count; Join Discord stays on one line; ONLINE pill matches the 44 px Get app height", () => {
    const sp = $("discBtn").nextElementSibling; if (sp && !sp.hidden && /—/.test(sp.textContent)) return "placeholder stats visible";
    const need = [/#lobby #discBtn\{white-space:nowrap/, /#lobby \.x-row2 \.online\{min-height:44px/]; const miss = need.filter((r) => !r.test(html)); return miss.length ? "missing CSS " + miss.join(" ") : true; });
  SW("Esc closes an open lobby modal", () => { lobbyBack(); $("navCareer").click(); advance(20); dispatch(win, mkEvent("keydown", { key: "Escape", code: "Escape" })); advance(20); return !modalOn("mProf") || "Esc left #mProf open"; });

  // ---- B. queue: every tab + START, every map tile + START (Unrated) actually plays that map ----
  const tabOf = (q) => doc.querySelector('#xQueue .x-qtabs [data-q="' + q + '"]');
  const throughPre = () => { advance(5200); $("preGo").click(); advance(60); if (shown("xAg")) { const t = Array.from(doc.querySelectorAll("#xAg .x-ag")).find((b, i) => i > 0 && !b.disabled); if (t) t.click(); advance(20); $("xAgL").click(); advance(10); throughPre.ld = $("xLd").classList.contains("on"); advance(1500); } else { throughPre.ld = null; advance(1500); } };
  for (const q of ["unrated", "swift", "sr", "dm", "tdm", "esc", "custom"]) SW("queue tab " + q + " + START reaches a live match", () => {
    lobbyBack(); $("playBtn").click(); advance(20); const t = tabOf(q); if (!t) return "no tab"; t.click(); advance(20); $("xqPlay").click(); advance(60);
    let ld; if (q === "unrated" || q === "swift" || q === "custom") { if (!shown("pre")) return "pre-match not shown"; throughPre(); ld = throughPre.ld; } else { ld = $("xLd").classList.contains("on"); advance(1500); }
    if (!inGame()) return "not in game"; if (q !== "esc" && ld === false) return "no loading screen at match start"; if ($("xLd").classList.contains("on") || xe("window.xLdOn")) return "loading screen did not hide"; if (!xe("running")) return "not running"; const r = fin(); return r;
  });
  for (const m of ["ascent", "bind", "haven", "split", "lotus", "breeze"]) for (const q of ["unrated", "swift"]) SW("queue map tile " + m + " (" + q + ") + START plays " + m, () => {
    lobbyBack(); $("playBtn").click(); advance(20); tabOf(q).click(); const tile = doc.querySelector('#xQueue .x-qmap[data-map="' + m + '"]'); if (!tile) return "no tile"; tile.click(); advance(10);
    if (tile.getAttribute("aria-pressed") !== "true") return "tile not pressed"; $("xqPlay").click(); advance(60); if (!shown("pre")) return "no pre-match";
    if (!new RegExp(m, "i").test($("preMh").textContent)) return "pre-match card shows " + $("preMh").textContent; throughPre();
    if (!inGame()) return "not in game"; const got = xe("FV.map"); if (got !== m) return "match map " + got; if (q === "swift" && !xe("FV.sw")) return "not swiftplay"; return fin();
  });
  lobbyBack(); xe('FV.pick = "ascent"; true');

  // ---- C. every round-based / DM mode on every map: loading, buy, live, round 2, match end, results, lobby ----
  const MAPS6 = ["ascent", "bind", "haven", "split", "lotus", "breeze"];
  const RMODES = [["5v5", "FV.srOn = 0; window.xSwift = false; startFive();", "five"], ["Swiftplay", "FV.srOn = 0; window.xSwift = true; startFive();", "swift"], ["Spike Rush", "startSR();", "sr"], ["TDM", "startTDM();", "dm"], ["Deathmatch", "startDM();", "dm"], ["Escalation", "startESC();", "dm"]];
  for (const [name, start, kind] of RMODES) for (const m of MAPS6) SW(name + " on " + m + ": loading → buy → live → round 2 → match end → results → lobby", () => {
    lobbyBack(); xe(`(() => { FV.pick = ${JSON.stringify(m)}; FV.dm = false; FV.tdm = false; FV.esc = false; const go = () => { ${start} }; window.xMatchLoad(go, ${JSON.stringify(m)}, ${JSON.stringify(name)}, true); return true; })()`);
    if (!xe("window.xLdOn")) return "loading screen not up"; advance(1500); if (xe("window.xLdOn")) return "loading screen stuck";
    if (!inGame() || !xe("running")) return "not running"; if (xe("FV.map") !== m) return "map " + xe("FV.map"); let r = fin(); if (r !== true) return "start: " + r;
    if (kind !== "dm") {
      if (!(xe("FV.buy") > 0) && kind !== "sr") return "no buy phase"; step(0.5, true, 1 / 20); r = fin(); if (r !== true) return "buy: " + r;
      xe("FV.buy = Math.min(FV.buy, 0.5); true"); step(1, true); if (xe("FV.buy") > 0) return "buy phase did not end"; const t0 = xe("timeLeft"); step(2, true, 1 / 20); r = fin(); if (r !== true) return "live: " + r;
      if (!(xe("timeLeft") < t0)) return "round timer frozen " + t0 + " -> " + xe("timeLeft");
      xe('fCheck(true, "sweep round end"); true'); advance(7400); if (xe("FV.you + FV.them") !== 1 || !xe("running")) return "round 2 did not start"; step(0.5, true, 1 / 20); r = fin(); if (r !== true) return "round 2: " + r;
      const need = kind === "swift" ? 5 : kind === "sr" ? xe("FV.srWin || 4") : xe("FIVE_WIN");
      xe(`FV.you = ${need - 1}; FV.them = 0; FV.sp.st = "carry"; fCheck(true, "sweep match end"); true`); advance(2600);
      if (!shown("result")) return "results screen not shown (score " + xe("FV.you + ':' + FV.them") + ")"; if (!/Victory/.test($("resTitle").textContent)) return "result title " + $("resTitle").textContent;
    } else {
      step(2, true, 1 / 20); r = fin(); if (r !== true) return "live: " + r; const t0 = xe("timeLeft"); step(0.5, true, 1 / 20); if (!(xe("timeLeft") < t0)) return "match timer frozen";
      xe('timeLeft = 0.01; true'); step(1); if (!shown("result")) return "DM results not shown at time up";
    }
    if (xe("running")) return "still running behind results"; $("lobbyBtn").click(); advance(100);
    if (disp("lobby") !== "flex" || inGame() || shown("result")) return "Lobby button did not return to the lobby"; advance(3000); if (xe("running") || inGame()) return "match restarted itself after leaving"; return true;
  });
  // non-map modes
  SW("Retake: rounds to 4 → results → lobby", () => { lobbyBack(); xe("score.you = 0; score.bots = 0; matchOver = false; start(); true"); advance(50); if (!xe("running")) return "not running"; step(3, true); let r = fin(); if (r !== true) return r;
    for (let i = 0; i < 4; i++) { if (i) { $("againBtn").click(); advance(50); if (!xe("running")) return "next round did not start (" + i + ")"; step(1, true); } xe('end(true, "sweep"); true'); advance(50); }
    if (!shown("result") || !/Victory/.test($("resTitle").textContent)) return "no Victory: " + $("resTitle").textContent; $("lobbyBtn").click(); advance(50); return disp("lobby") === "flex" || "no lobby"; });
  SW("Rifle 2v2: pick, round 2, match end → results → lobby", () => { lobbyBack(); xe("startRifle(); true"); advance(3600); if (!xe("running")) return "not running"; step(3, true); let r = fin(); if (r !== true) return r;
    xe('rEnd(true, "sweep"); true'); advance(8000); if (!xe("running")) return "round 2 did not start (after the 3 s weapon pick)"; xe('RF.you = RIFLE_WIN - 1; rEnd(true, "sweep"); true'); advance(4000);
    if (!shown("result")) return "no results"; $("lobbyBtn").click(); advance(50); return disp("lobby") === "flex" || "no lobby"; });
  SW("Operator Duel: live, results, lobby", () => { lobbyBack(); xe("xGo(() => startDuel()); true"); advance(100); if (!xe("running")) return "not running"; step(4, true); const r = fin(); if (r !== true) return r; return true; });
  SW("Aim trainer (Range): 60 s round ends with results → lobby", () => { lobbyBack(); xe("startAim(); true"); advance(100); if (!xe("running")) return "not running"; step(2); let r = fin(); if (r !== true) return r; xe("AM.t = Math.min(AM.t, 1.5); true"); step(3, false, 1 / 20); if (xe("running")) return "range round never ended"; advance(500);
    if (!shown("result") && !xe("xResUp()")) return "no results"; $("lobbyBtn").click(); advance(50); return disp("lobby") === "flex" || "no lobby"; });
  for (const sm of ["boreas", "utopia"]) SW("Surf " + sm + ": runs, R restarts", () => { lobbyBack(); xe(`SM = ${JSON.stringify(sm)}; startSurf(); true`); advance(100); if (!xe("running")) return "not running"; step(3); const p = xe("[sv.p.x, sv.p.y, sv.p.z].every((v) => typeof v !== 'number' || Number.isFinite(v))"); if (!p) return "surf pos NaN"; dispatch(win, mkEvent("keydown", { key: "r", code: "KeyR" })); dispatch(win, mkEvent("keyup", { key: "r", code: "KeyR" })); advance(30); return xe("sv.t === 0") || "R did not reset"; });
  lobbyBack();

  // ---- D. buy every weapon, fire, reload, switch ----
  SW("5v5 buy menu: every weapon buys, fires (ammo drops), reloads (mag refills), slot keys switch the viewmodel", () => {
    lobbyBack(); xe('FV.pick = "ascent"; FV.srOn = 0; window.xSwift = false; startFive(); clearTimeout(FV.to); true'); advance(50);
    dispatch(win, mkEvent("keydown", { key: "b", code: "KeyB" })); dispatch(win, mkEvent("keyup", { key: "b", code: "KeyB" })); advance(30);
    if (!$("xBuy").classList.contains("on")) return "B did not open the buy menu";
    const names = Array.from(doc.querySelectorAll("#xBG button[data-n]")).map((b) => b.dataset.n).filter((n) => !/^ab:/.test(n) && xe(`!!WEAP[${JSON.stringify(n)}]`));
    const allG = xe('["Classic","Shorty","Frenzy","Ghost","Sheriff","Stinger","Spectre","Bucky","Judge","Bulldog","Guardian","Phantom","Vandal","Marshal","Outlaw","Operator","Ares","Odin"].filter((n) => !!WEAP[n])'); const miss = allG.filter((n) => !names.includes(n)); if (miss.length) return "buy menu is missing " + miss.join(", ");
    const bad = [];
    for (const n of names) {
      xe("FV.cr = 9000; FV.buy = 20; FV.menu = true; buyRender(); true"); const b = Array.from(doc.querySelectorAll("#xBG button[data-n]")).find((x) => x.dataset.n === n);
      if (!b || b.disabled) { if (!(b && b.classList.contains("on"))) bad.push(n + " button disabled"); continue; }
      b.click(); advance(10); const own = xe(`FV.pri === ${JSON.stringify(n)} || FV.sec === ${JSON.stringify(n)}`); if (!own && !b.classList.contains("on")) { bad.push(n + " not bought"); continue; }
      const side = /^(Classic|Shorty|Frenzy|Ghost|Sheriff)$/.test(n); if (side && xe("FV.sec") !== n) bad.push(n + " (sidearm) went to the primary slot");
      const r = xe(`(() => { FV.buy = 0; FV.menu = false; buyMenu(false); const sl = FV.sec === ${JSON.stringify(n)} ? "pis" : "pri"; swapW(sl); VM.sw = 0; if (wName() !== ${JSON.stringify(n)}) return "wName " + wName(); reloading = 0; fcd = 0; player.hp = 100;
        const a0 = ammo; shoot(); if (!(ammo < a0)) return "shot did not use ammo " + a0 + "->" + ammo; updHud(); xHud(); const hud = String(document.getElementById("xMag").textContent).trim(); if (hud !== String(ammo) && hud !== "…") return "HUD mag " + hud + " vs " + ammo;
        reloading = 0; const r0 = rsv; window.dispatchEvent(Object.assign(new Event("keydown"), { code: "KeyR", key: "r" })); window.dispatchEvent(Object.assign(new Event("keyup"), { code: "KeyR", key: "r" })); if (!(reloading > 0)) return "R did not reload";
        for (let i = 0; i < 300 && reloading > 0; i++) tick(1 / 30); if (ammo !== MAG()) return "after reload " + ammo + "/" + MAG(); if (!(rsv < r0)) return "reserve not used";
        swapW("knife"); if (rw !== "knife") return "knife switch"; swapW(sl); if (rw !== sl) return "switch back"; return true; })()`);
      if (r !== true) bad.push(n + ": " + r);
    }
    for (const sh of ["Light Shields", "Heavy Shields", "Regen Shield"]) { xe("FV.cr = 9000; FV.buy = 20; FV.menu = true; player.armor = 0; buyRender(); true"); const b = Array.from(doc.querySelectorAll("#xBG button[data-n]")).find((x) => x.dataset.n === sh); if (b) { b.click(); if (!(xe("player.armor") > 0)) bad.push(sh + " gave no armor"); } }
    const k = xe('(() => { FV.buy = 0; FV.menu = false; FV.pri = "Vandal"; slots.pri = { ammo: 25, rsv: 75 }; const out = []; [["Digit1", "pri"], ["Digit2", "pis"], ["Digit3", "knife"], ["Digit1", "pri"]].forEach(([c, w]) => { window.dispatchEvent(Object.assign(new Event("keydown"), { code: c })); window.dispatchEvent(Object.assign(new Event("keyup"), { code: c })); if (rw !== w) out.push(c + "->" + rw); }); return out.length ? out.join(",") : true; })()');
    if (k !== true) bad.push("slot keys: " + k);
    return bad.length ? bad.slice(0, 8).join(" | ") : true;
  });
  // ---- E. every agent: C/Q/E/X, cooldowns / charges update, HUD pips ----
  SW("every agent: C/Q/E/X cast without throwing; a charge or cooldown changes; HUD ability slots finite", () => {
    lobbyBack(); xe('FV.pick = "ascent"; FV.srOn = 0; window.xSwift = false; startFive(); clearTimeout(FV.to); FV.buy = 0; true'); advance(50);
    const ags = xe("Object.keys(KITS)"); const bad = [];
    for (const ag of ags) { const r = xe(`(() => { try { J.pick = ${JSON.stringify(ag)}; FV.buy = 0; running = true; player.hp = 100; const M = K().mx || {}; J.c = M.c != null ? M.c : 2; J.q = M.q != null ? M.q : 2; J.e = M.e != null ? M.e : 1; J.ult = K().u; if (J.cd) for (const k in J.cd) J.cd[k] = 0;
        const out = []; ["KeyC", "KeyQ", "KeyE", "KeyX"].forEach((c) => { try { player.hp = 100; if (J.cd) for (const k in J.cd) J.cd[k] = 0; jKey(c); for (let i = 0; i < 10; i++) { jTick(1 / 10); fiveTick(1 / 20); } if (J.dr) { try { drEnd(); } catch (e) {} J.dr = null; } } catch (e) { out.push(c + " threw " + e.message); } });
        ["jC", "jQ", "jE", "jX"].forEach((id) => { const t = String((document.getElementById(id) || {}).textContent || ""); if (/NaN|undefined/.test(t)) out.push(id + "=" + t); });
        [player.x, player.z].forEach((v) => { if (!Number.isFinite(v)) out.push("player pos NaN after casts"); });
        return out.length ? out.join(",") : true; } catch (e) { return e.message; } })()`); if (r !== true) bad.push(ag + ": " + r); xe("player.hp = 100; true"); }
    const r = fin(); if (r !== true) bad.push(r);
    return bad.length ? bad.join(" | ") : true;
  });
  // ---- F. spike plant + defuse by the player ----
  SW("spike: player plants on a site (hold 4) and a defender defuse ends the round", () => {
    lobbyBack(); xe('FV.pick = "ascent"; FV.srOn = 0; window.xSwift = false; startFive(); clearTimeout(FV.to); FV.buy = 0; true'); advance(50);
    const r = xe(`(() => { const s = FV.sp; s.st = "carry"; s.c = player; const site = SITES.A; player.x = site[0]; player.z = site[1]; player.hp = 1e6; keys.Digit4 = true; for (let i = 0; i < 150 && s.st === "carry"; i++) { player.x = site[0]; player.z = site[1]; fiveTick(1 / 30); } keys.Digit4 = false;
      if (s.st !== "plant") return "no plant (st " + s.st + ", in site " + inSite(player) + ")"; if (!(timeLeft > 40)) return "spike timer " + timeLeft;
      FV.atk = false; bots.forEach((b) => { b.alive = false; }); player.x = s.x + 0.5; player.z = s.z; keys.Digit4 = true; for (let i = 0; i < 260 && running; i++) { player.x = s.x + 0.5; player.z = s.z; fiveTick(1 / 30); } keys.Digit4 = false;
      if (running) return "defuse did not end the round (dt " + s.dt + ", st " + s.st + ")"; return s.st === "done" || "st " + s.st; })()`);
    advance(2400); return r;
  });
  // ---- G. player death, spectate, next round; DM respawn ----
  SW("player death: spectating, finite camera, round ends and next round respawns the player", () => {
    lobbyBack(); xe('FV.pick = "ascent"; FV.srOn = 0; window.xSwift = false; startFive(); clearTimeout(FV.to); FV.buy = 0; true'); advance(50);
    const d = xe('(() => { pDie("Sweep", "Vandal"); return player.hp <= 0; })()'); if (!d) return "pDie did not kill"; step(2); frames(10); let r = fin(); if (r !== true) return "dead: " + r;
    xe('fCheck(false, "sweep"); true'); advance(7400); if (!(xe("player.hp") > 0)) return "not respawned next round"; return fin();
  });
  SW("deathmatch: player respawns 1.5 s after death with full hp", () => { lobbyBack(); xe('FV.pick = "ascent"; startDM(); true'); advance(1500); if (xe("window.xLdOn")) return "loading screen stuck"; xe('pDie(bots[0].name, "Vandal"); true'); if (xe("player.hp") > 0) return "not dead"; step(2.2); return xe("player.hp") === 100 || "hp " + xe("player.hp"); });
  // ---- H. Tab scoreboard, Esc pause + every settings tab / toggle / slider ----
  SW("Tab shows the scoreboard, releasing Tab hides it", () => { lobbyBack(); xe('FV.pick = "ascent"; FV.srOn = 0; startFive(); clearTimeout(FV.to); FV.buy = 0; true'); advance(50); dispatch(win, mkEvent("keydown", { key: "Tab", code: "Tab" })); advance(30); const on = $("xBoard").classList.contains("on"); dispatch(win, mkEvent("keyup", { key: "Tab", code: "Tab" })); advance(30); return on && !$("xBoard").classList.contains("on") || "board on=" + on + " after=" + $("xBoard").classList.contains("on"); });
  SW("Esc pause → Settings: every tab, toggle, segment and slider changes without errors; Done + Resume return to play", () => {
    lobbyBack(); xe('FV.pick = "ascent"; FV.srOn = 0; startFive(); clearTimeout(FV.to); FV.buy = 0; true'); advance(50);
    dispatch(win, mkEvent("keydown", { key: "Escape", code: "Escape" })); advance(60); if (!$("xPause").classList.contains("on") || !xe("paused")) return "Esc did not pause";
    const g = $("xGear") || $("xSet"); g.click(); advance(30); if (!modalOn("mSet")) return "pause settings did not open mSet";
    const bad = [];
    for (const t of doc.querySelectorAll("#xSTab button[data-st]")) { t.click(); advance(5);
      const pane = doc.querySelector('#mSet [data-sp="' + t.dataset.st + '"]'); if (!pane || pane.hidden) { bad.push("pane " + t.dataset.st); continue; }
      for (const cb of pane.querySelectorAll("input[type=checkbox]")) { for (const v of [!cb.checked, cb.checked]) { cb.checked = v; dispatch(cb, mkEvent("change")); dispatch(cb, mkEvent("input")); } }
      for (const sl of pane.querySelectorAll("input[type=range]")) { for (const v of [sl.getAttribute("max") || "1", sl.getAttribute("min") || "0", sl.getAttribute("value") || sl.getAttribute("min") || "0"]) { sl.value = v; dispatch(sl, mkEvent("input")); dispatch(sl, mkEvent("change")); } }
      for (const b of pane.querySelectorAll(".seg button, [data-cb] button, #xhSw button, select")) { if (b.tagName === "SELECT") continue; b.click(); }
      for (const s of pane.querySelectorAll("select")) { dispatch(s, mkEvent("change")); }
    }
    ["xFpsL", "xRes", "xRsc", "xAA", "xShd"].forEach((id) => { const b = $(id) && $(id).querySelector("button"); if (b) b.click(); }); const fb = doc.querySelectorAll('#mSet [data-key="fps"] button')[0]; if (fb) fb.click(); const db = doc.querySelectorAll('#mSet [data-key="diff"] button')[1]; if (db) db.click();
    const cb = $("xAuR"); if (cb) { cb.checked = true; dispatch(cb, mkEvent("change")); }
    frames(5); doc.querySelector("#mSet .row [data-close]").click(); advance(30); if (modalOn("mSet")) bad.push("Done did not close");
    if (!$("xPause").classList.contains("on")) { dispatch(win, mkEvent("keydown", { key: "Escape", code: "Escape" })); advance(60); }
    $("xWatch").click(); advance(30); if (xe("paused")) bad.push("still paused after Resume");
    step(1, true); const r = fin(); if (r !== true) bad.push(r);
    return bad.length ? bad.join(" | ") : true;
  });
  SW("colourblind mode cycles every option without errors", () => { const sel = doc.querySelectorAll("#xCbH button, #xEnC button"); if (!sel.length) return "no colourblind control found"; sel.forEach((b) => b.click()); sel[0].click(); return true; });
  // ---- I. 60 simulated seconds: bots visible, finite, moving and shooting ----
  if (!REAL3) report.push({ label: "Sweep: 60 s bot soak skipped under the THREE stub (vectors are proxies, nothing can move); run REAL3=1 for it", el: true, handler: true, cond: true, pass: true, errs: [] });
  else for (const m of MAPS6) SW((m === "ascent" || process.env.SOAK_FULL ? 60 : 20) + " s bot soak on " + m + ": finite positions, bots move and fire, HUD updates", () => {
    lobbyBack(); vm.runInContext("globalThis.__MR = globalThis.__MR || Math.random; { let s = 4242; Math.random = () => { s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }", context);
    xe(`FV.pick = ${JSON.stringify(m)}; FV.srOn = 0; window.xSwift = false; startFive(); clearTimeout(FV.to); FV.buy = 0; true`); advance(50);
    xe(`(() => { globalThis.__sh = 0; const w0 = typeof botShoot === "function" ? botShoot : null; if (w0) { globalThis.__bs0 = w0; botShoot = function () { globalThis.__sh++; return w0.apply(this, arguments); }; } globalThis.__h0 = hurt; hurt = function (t) { if (t !== player) globalThis.__sh++; return __h0.apply(this, arguments); };
      globalThis.__p0 = [].concat(bots, allies).map((u) => [u.g.position.x, u.g.position.z]); return true; })()`);
    const seenT = new Set(); let worst = true;
    for (let s = 0; s < (m === "ascent" || process.env.SOAK_FULL ? 60 : 20); s += 5) { xe("(() => { if (!running) { clearTimeout(FV.to); FV.you = 0; FV.them = 0; fRound(); FV.buy = 0; } return true; })()"); step(5, true, 1 / 20); seenT.add($("xTm").textContent); const r = fin(); if (r !== true) { worst = "t=" + s + ": " + r; break; } }
    const mv = xe("(() => { const U = [].concat(bots, allies); let n = 0; U.forEach((u, i) => { const a = __p0[i]; if (a && Math.hypot(u.g.position.x - a[0], u.g.position.z - a[1]) > 3) n++; }); return n; })()");
    const sh = xe("__sh"); xe("(() => { hurt = __h0; if (globalThis.__bs0) botShoot = __bs0; return true; })()"); vm.runInContext("Math.random = __MR", context);
    if (worst !== true) return worst; if (mv < 5) return "only " + mv + "/9 bots moved > 3 m"; if (!(sh > 0)) return "no bot fired / dealt damage in 60 s"; if (seenT.size < 3) return "HUD timer barely changed: " + [...seenT].join(","); return true;
  });
  lobbyBack();
  win.console.error = ce0;
  report.push({ label: "Sweep: ran " + swN + " steps", el: true, handler: true, cond: true, pass: true, errs: [] });
}

// <<< sweep
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

// ---------- map scale + layout: size, spawn→site + site→site run times on the bot nav graph at rifle speed, spawns clear, sites reachable (1 unit = 1 m: eye 1.6, rifle run 5.4 m/s) ----------
if (!NO3) {
  let R = null, err = [];
  try { R = JSON.parse(vm.runInContext("__xe", context)(`(() => { const RUN = 5.4, out = [], keepS = Object.assign({}, SITES), keepB = boxes;
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
      const ks = Object.keys(P); for (let i = 0; i < ks.length; i++) for (let j = i + 1; j < ks.length; j++) { const [a, ad] = near(P[ks[i]][0], P[ks[i]][1]), [b, bd] = near(P[ks[j]][0], P[ks[j]][1]), d = dj(a)[b] + ad + bd; t["rot" + ks[i] + ks[j]] = d < 1e8 ? +(d / RUN).toFixed(1) : null; }
      out.push({ k, W: +W.toFixed(1), D: +D.toFixed(1), t, bad });
    } } finally { boxes = keepB; for (const s in SITES) delete SITES[s]; Object.assign(SITES, keepS); }
    return JSON.stringify(out); })()`)); } catch (e) { err.push(String(e).slice(0, 300)); }
  for (const m of R || []) {
    const big = Math.max(m.W, m.D), E = Object.entries(m.t), tA = E.filter(([q]) => q.startsWith("atk")), tD = E.filter(([q]) => q.startsWith("def")), tR = E.filter(([q]) => q.startsWith("rot"));
    const sizeOk = big <= 150 && Math.min(m.W, m.D) >= 60; // Valorant-like 90-150 m; Bind / Haven are narrower (61 m wide, ~90-97 m deep) and pass on run time
    // Valorant targets at rifle run 5.4 m/s (±0.5 s rounding slack): attacker spawn → each site 15-20 s, defender spawn → each site 5-10 s, longest defender rotation 10-15 s.
    // No per-site exceptions (sites2): Haven B (Mid Doors east + courtyard dogleg wall), Lotus B (offset spawn exit / B Main mouth / B Main foot) and Bind B (Market spur) were lengthened into the band
    const atkLo = () => 14.5, rotMax = tR.reduce((a, [, v]) => Math.max(a, v == null ? 1e9 : v), 0);
    const errs = []; tA.forEach(([q, v]) => { if (!(v != null && v >= atkLo(q) && v <= 20.5)) errs.push(q + " " + v + " s out of " + atkLo(q) + "-20.5"); });
    tD.forEach(([q, v]) => { if (!(v != null && v >= 4.5 && v <= 10.5)) errs.push(q + " " + v + " s out of 4.5-10.5"); });
    if (!(rotMax >= 9.5 && rotMax <= 15.5)) errs.push("longest rotation " + rotMax + " s out of 9.5-15.5");
    const ok = sizeOk && !errs.length && !m.bad.length;
    report.push({ label: `Map scale ${m.k}: ${m.W} x ${m.D} m; rifle run (5.4 m/s) ${E.map(([q, v]) => q + " " + (v == null ? "—" : v + "s")).join(", ")}; targets atk 15-20 s, def 5-10 s, rotation 10-15 s; spawns clear, sites reachable on the nav graph`, el: true, handler: true, cond: ok, pass: ok, errs: m.bad.concat(sizeOk ? [] : ["size out of 60-150 m"], errs) });
  }
  if (!R) report.push({ label: "Map scale audit", el: true, handler: true, pass: false, cond: false, errs: err });
}

// ---------- vA maps visual (Ascent + Bind): site letters + plant paint, mesh budget, crate-like collider heights, spawns clear of colliders, sites reachable, Bind bot routes clear ----------
if (!NO3) {
  let R = null, err = [];
  try { R = JSON.parse(vm.runInContext("__xe", context)(`(() => { const out = [], keepB = boxes, keepS = Object.assign({}, SITES);
    try { xBuildMap("bind");
      for (const k of ["ascent", "bind"]) {
        const V = ASC_VIS[k], bx = FMAP[k].boxes, sp = xSpawn(k), P = k === "ascent" ? ASC_SITES : { A: [-20, -21], B: [20, -21] }, bad = [];
        for (const s of ["A", "B"]) { if (!V.letters.some((l) => l.ch === s && l.at === "wall")) bad.push("no wall letter " + s); if (!V.letters.some((l) => l.ch === s && l.at === "floor")) bad.push("no floor letter " + s);
          const z = V.zones.find((q) => q.site === s); if (!z || Math.abs(z.x - P[s][0]) > 0.01 || Math.abs(z.z - P[s][1]) > 0.01) bad.push("plant paint " + s + " missing or off the plant rect"); }
        if (!(V.adds > 0 && V.adds <= 600)) bad.push("map meshes added " + V.adds + " (budget 600)");
        if (!(V.crates >= 10)) bad.push("only " + V.crates + " crate props");
        if (!(V.ceil >= 2)) bad.push("only " + V.ceil + " ceilings");
        const crateLike = bx.filter((b) => b.crate || (!b.step && b.h > 0.3 && BH(b) < 4 && Math.max(b.x2 - b.x1, b.z2 - b.z1) <= 3.5));
        crateLike.forEach((b) => { if (!(b.h >= 1 && b.h <= 3.2)) bad.push("crate-like collider " + b.h + " m tall at " + ((b.x1 + b.x2) / 2).toFixed(1) + "," + ((b.z1 + b.z2) / 2).toFixed(1)); });
        for (const z of [sp.atk, -sp.atk]) for (let x = -8; x <= 8; x += 2) bx.forEach((b) => { if (b.h > 0 && x > b.x1 - 0.4 && x < b.x2 + 0.4 && z > b.z1 - 0.4 && z < b.z2 + 0.4) bad.push("collider over spawn (" + x + "," + z + ")"); });
        let N, adj; boxes = bx;
        if (k === "ascent") { const ks = Object.keys(ASC_NODE); N = ks.map((q) => ASC_NODE[q]); adj = N.map(() => []);
          ASC_EDGE.forEach(([a, b]) => { const i = ks.indexOf(a), j = ks.indexOf(b); if (!ascClear(N[i][0], N[i][1], N[j][0], N[j][1])) bad.push("nav edge " + a + "-" + b + " blocked"); else { adj[i].push([j]); adj[j].push([i]); } }); }
        else { for (const s in SITES) delete SITES[s]; Object.assign(SITES, P); const G = xgBuild(k); N = G.N; adj = G.adj;
          boxes = bx.filter((b) => b.vA); for (const r of XA.bind.A.concat(XA.bind.B)) { const W = XR[r]; for (let i = 1; i < W.length; i++) if (!xgClear(W[i - 1][0], W[i - 1][1], W[i][0], W[i][1], 0.4)) bad.push("bot route " + r + " leg " + i + " blocked by a new prop"); } }
        boxes = keepB;
        const near = (x, z) => { let bi = -1, bd = 1e9; N.forEach((p, i) => { const d = Math.hypot(p[0] - x, p[1] - z); if (d < bd) { bd = d; bi = i; } }); return bi; };
        const reach = (s) => { const seen = new Set([s]), st = [s]; while (st.length) { const u = st.pop(); adj[u].forEach(([v]) => { if (!seen.has(v)) { seen.add(v); st.push(v); } }); } return seen; };
        for (const z of [sp.atk, -sp.atk]) { const S = reach(near(0, z)); for (const s in P) if (!S.has(near(P[s][0], P[s][1]))) bad.push("site " + s + " unreachable from spawn z " + z); }
        out.push({ k, adds: V.adds, crates: crateLike.length, letters: V.letters.length, ceil: V.ceil, bad });
      } } finally { boxes = keepB; for (const s in SITES) delete SITES[s]; Object.assign(SITES, keepS); }
    return JSON.stringify(out); })()`)); } catch (e) { err.push(String(e.stack || e).slice(0, 400)); }
  for (const m of R || []) report.push({ label: `vA maps visual ${m.k}: ${m.letters} site letters, plant paint on both sites, ${m.adds} meshes added (<= 600), ${m.crates} crate-like colliders all 1-3.2 m, ${m.ceil} ceilings, spawns clear, sites reachable` + (m.k === "bind" ? ", bot routes clear of new props" : ""), el: true, handler: true, cond: !m.bad.length, pass: !m.bad.length, errs: m.bad });
  if (!R || R.length !== 2) report.push({ label: "vA maps visual audit (Ascent + Bind)", el: true, handler: true, pass: false, cond: false, errs: err });
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

// ---------- vC maps visual (Breeze + Lotus): wall + floor site letters, visual-pass mesh budget, crate-like collider heights, spawns clear of colliders, sites reachable ----------
if (!NO3) {
  for (const k of ["breeze", "lotus"]) {
    let r = null, err = [];
    try { r = JSON.parse(vm.runInContext("__xe", context)(`(() => { try {
      xBuildMap("${k}"); const M = FMAP["${k}"], st = XBL_STAT["${k}"], bx = M.boxes, sp = xSpawn("${k}"), P = ${k === "lotus" ? "LSITES" : "BZSITES"}, bad = [];
      if (!st) return JSON.stringify({ bad: ["no visual-pass stats"] });
      for (const s in P) for (const kind of ["wall", "floor"]) if (!st.letters.some(([c, t]) => c === s && t === kind)) bad.push("site " + s + " missing " + kind + " letter");
      if (!(st.meshes > 20 && st.meshes <= 400)) bad.push("visual-pass meshes " + st.meshes + " (budget 20-400)");
      const crateLike = (b) => { const w = b.x2 - b.x1, d = b.z2 - b.z1, h = b.h; return h > 0.3 && h < 4 && Math.min(w, d) >= 0.8 && Math.max(w, d) <= 3.2 && Math.max(w, d) / Math.min(w, d) <= 2.5; };
      let nc = 0; bx.forEach((b) => { if (!crateLike(b)) return; nc++; if (b.h < 1 || b.h > 3.2) bad.push("crate-like collider h " + b.h + " at " + ((b.x1 + b.x2) / 2).toFixed(1) + "," + ((b.z1 + b.z2) / 2).toFixed(1)); });
      st.crates.forEach((b) => { if (bx.indexOf(b) < 0) bad.push("tracked prop collider missing from the collision list"); });
      if (st.crates.length < 10) bad.push("only " + st.crates.length + " visual-pass props collide");
      for (const z of [sp.atk, -sp.atk]) for (let x = -8; x <= 8; x += 2) bx.forEach((b) => { if (b.h > 0.3 && x > b.x1 - 0.4 && x < b.x2 + 0.4 && z > b.z1 - 0.4 && z < b.z2 + 0.4) bad.push("collider over spawn (" + x + "," + z + ")"); });
      const keep = Object.assign({}, SITES); for (const s in SITES) delete SITES[s]; Object.assign(SITES, P);
      const keepB = boxes; let G; boxes = bx; try { G = xgBuild("${k}"); } finally { boxes = keepB; for (const s in SITES) delete SITES[s]; Object.assign(SITES, keep); }
      const near = (x, z) => { let bi = -1, bd = 1e9; G.N.forEach((p, i) => { const d = Math.hypot(p[0] - x, p[1] - z); if (d < bd) { bd = d; bi = i; } }); return bd < 8 ? bi : -1; };
      const reach = (s) => { const seen = new Set([s]), q = [s]; while (q.length) { const u = q.pop(); G.adj[u].forEach(([v]) => { if (!seen.has(v)) { seen.add(v); q.push(v); } }); } return seen; };
      for (const side of [sp.atk, -sp.atk]) { const s0 = near(0, side); if (s0 < 0) { bad.push("no nav node near spawn z " + side); continue; } const R = reach(s0); for (const s in P) { const e = near(P[s][0], P[s][1]); if (e < 0 || !R.has(e)) bad.push("site " + s + " unreachable from spawn z " + side); } }
      return JSON.stringify({ bad, meshes: st.meshes, crates: nc, props: st.crates.length });
    } catch (e) { return JSON.stringify({ bad: [String(e.stack || e).slice(0, 300)] }); } })()`)); } catch (e) { err.push(String(e).slice(0, 300)); }
    const ok = !!r && !r.bad.length && !err.length;
    report.push({ label: `vC map visual ${k}: wall + floor site letters, visual pass ${r ? r.meshes : "?"} meshes (budget 400), ${r ? r.crates : "?"} crate-like colliders all 1-3.2 m tall (${r ? r.props : "?"} solid props), spawns clear of colliders, every site reachable on the nav graph`, el: true, handler: true, cond: ok, pass: ok, errs: (r ? r.bad : []).concat(err) });
  }
}

// ---------- fidelity pass 1: bot run speed (weapon table + near-stop to fire), DM placement / DRAW, round banners, loss-bonus economy ----------
if (!NO3) {
  const xe = vm.runInContext("__xe", context);
  const FIDP = (label, f) => { let errs = []; try { const r = f(); if (r !== true) errs.push(String(r)); } catch (e) { errs.push(String(e.stack || e).slice(0, 300)); } report.push({ label, el: true, handler: true, cond: !errs.length, pass: !errs.length, errs }); };
  const f5 = 'FV.pick = "ascent"; FV.srOn = 0; FV.dm = false; FV.tdm = false; FV.esc = false; window.xSwift = false; startFive(); clearTimeout(FV.to); FV.buy = 0; FV.menu = false; player.hp = 100; paused = false; running = true; ';
  phase = "fid bot speed";
  FIDP("fid bot speed: rifle bots run >= 5 m/s (5.4 table, not 2.6), knife 6.75 / pistol 5.73 / heavy 5.13 via the player VRUN table, walk x0.6, every bot shot fired near-stationary", () => {
    xe(f5 + "true"); advance(50);
    const R = JSON.parse(xe(`(() => { const out = { mx: 0, wk: 0, shots: 0, fast: 0, worst: 0, tab: [botRun({ w: "Knife" }), botRun({ w: "Classic" }), botRun({ w: "Vandal" }), botRun({ w: "Odin" }), botRun({ w: "Vandal" }, true)] };
      bots.concat(allies).forEach((b) => { b.w = "Vandal"; }); const at0 = SFX.at;
      SFX.at = function (p) { const b = bots.concat(allies).find((u) => u.g && u.g.position === p); if (b && b.alive) { out.shots++; if ((b.spd || 0) > BOT_STOP + 1e-6) { out.fast++; out.worst = Math.max(out.worst, b.spd); } } return at0.apply(this, arguments); };
      try { const DT = 1 / 30; for (let i = 0; i < 40 * 30 && running; i++) { player.hp = Math.max(player.hp, 1e6); fiveTick(DT); xBotYaw(DT);
        for (const b of bots) if (b.alive && !b.see && !b.wk && !(b.xk != null || b.xj != null)) out.mx = Math.max(out.mx, b.spd || 0); else if (b.alive && b.wk && !b.see) out.wk = Math.max(out.wk, b.spd || 0); }
        const l0 = los; los = () => true; try { for (let i = 0; i < 8 * 30 && running; i++) { player.hp = Math.max(player.hp, 1e6); fiveTick(DT); xBotYaw(DT); } } finally { los = l0; } } // forced sight lines: bots engage, every shot must come from a near-stop
      finally { SFX.at = at0; } return JSON.stringify(out); })()`));
    const t = R.tab.map((v) => +v.toFixed(2));
    if (t[0] !== 6.75 || t[1] !== 5.74 && t[1] !== 5.73 || t[2] !== 5.4 || t[3] !== 5.13 || t[4] !== 3.24) return "speed table " + t.join("/");
    if (!(R.mx >= 5 && R.mx <= 5.45)) return "max measured rifle run " + R.mx.toFixed(2) + " m/s";
    if (!R.shots) return "no bot shots in the forced-sight engagement"; if (R.fast) return R.fast + "/" + R.shots + " shots fired while moving (worst " + R.worst.toFixed(2) + " m/s)";
    console.log("fid bot speed: max rifle run " + R.mx.toFixed(2) + " m/s, max walk " + R.wk.toFixed(2) + " m/s, " + R.shots + " bot shots, " + R.fast + " while moving");
    return true;
  });
  try { toLobby(); } catch (e) {}
  phase = "fid dm results";
  FIDP("fid DM results: tie for 1st shows DRAW (shared placement), placement titles 1st / Shared 2nd, kills-to-win shown, no round score or MVP", () => {
    const run = (kYou, kOthers) => { xe('FV.pick = "ascent"; FV.esc = false; startDM(); true'); advance(100); if (!xe("running")) return "DM not running";
      xe(`(() => { const ns = ["You"].concat(bots.map((b) => b.name)); DM.k = {}; DM.d = {}; ns.forEach((n, i) => { DM.k[n] = n === "You" ? ${kYou} : (${JSON.stringify(kOthers)})[i - 1] || 0; DM.d[n] = 3; }); DM.over = null; dmEnd(); try { sbResult(); } catch (e) {} return true; })()`); advance(50);
      return { t: $("resTitle").textContent, x: $("resText").textContent, b: $("xResB").innerHTML || "" }; };
    let r = run(10, [10, 4, 3]); if (typeof r === "string") return r;
    if (r.t !== "DRAW") return "tie title " + r.t; if (/Victory/i.test(r.t) || r.b.trim()) return "round score / MVP shown on a DM tie"; if (!/first to \d+ kills/.test(r.x)) return "kills-to-win missing: " + r.x.slice(0, 80);
    if (!/1st[^]*You[^]*1st/.test(r.x) && !/1st[^]*1st/.test(r.x)) return "no shared 1st in list: " + r.x.slice(0, 120);
    r = run(12, [10, 4]); if (r.t !== "1st place") return "solo win title " + r.t; if (r.b.trim()) return "score bar on DM win";
    r = run(5, [9, 5]); if (r.t !== "Shared 2nd place") return "shared 2nd title " + r.t;
    $("lobbyBtn").click(); advance(50); return true;
  });
  try { toLobby(); } catch (e) {}
  phase = "fid banners";
  FIDP("fid round banners: FIRST BLOOD once per round, ACE / TEAM ACE / CLUTCH / FLAWLESS / THRIFTY each get their own centred banner queued after ROUND WIN", () => {
    xe(f5 + "true"); advance(50);
    const res = JSON.parse(xe(`(() => { const out = {}, T = () => sbTeams(), seen = () => (annc.log || []).concat(ANQ.map((q) => q[0]));
      const seed = (f) => { annClear(); annc.log = []; for (const n in SB) Object.assign(SB[n], { k: 0, k0: 0, d: 0, d0: 0, sp: 0, s0: 0 }); xRes.c = {}; f(T()[0], T()[1]); running = false; xRes(true, "Enemies eliminated", false, false); return seen(); };
      out.team = [T()[0].length, T()[1].length];
      out.ACE = seed((W) => { SB[W[0]].k = 5; SB[W[1]].d = 1; });
      out["TEAM ACE"] = seed((W) => { W.forEach((n) => SB[n].k = 1); SB[W[2]].d = 1; });
      out.CLUTCH = seed((W) => { SB[W[0]].k = 3; SB[W[1]].d = 1; SB[W[2]].d = 1; xRes.c = { a: W[0] }; });
      out.FLAWLESS = seed((W) => { SB[W[0]].k = 3; SB[W[1]].k = 2; });
      out.THRIFTY = seed((W, L) => { SB[W[0]].k = 3; SB[W[1]].k = 2; SB[W[2]].d = 1; W.forEach((n) => SB[n].sp = 200); L.forEach((n) => SB[n].sp = 3900); });
      out.NONE = seed((W, L) => { SB[W[0]].k = 3; SB[W[1]].k = 2; SB[W[2]].d = 1; W.forEach((n) => SB[n].sp = 3000); L.forEach((n) => SB[n].sp = 3000); });
      annClear(); annc.log = []; running = true; FV.you = 0; FV.them = 0; xFirstBlood.r = null; sbKill("You", F_EN[0], false); sbKill(F_EN[1], F_MATES[0], false); out.FB = seen();
      FV.you = 1; annClear(); annc.log = []; sbKill(F_EN[2], "You", false); out.FB2 = seen(); annClear(); return JSON.stringify(out); })()`));
    if (res.team[0] !== 5 || res.team[1] !== 5) return "teams " + res.team;
    for (const k of ["ACE", "TEAM ACE", "CLUTCH", "FLAWLESS", "THRIFTY"]) { const s = res[k]; if (s[0] !== "ROUND WIN" || s[1] !== k) return k + " banners: " + JSON.stringify(s); }
    if (res.NONE.length !== 1) return "plain win banners: " + JSON.stringify(res.NONE);
    if (res.FB.filter((t) => t === "FIRST BLOOD").length !== 1) return "first blood (round 1): " + JSON.stringify(res.FB);
    if (res.FB2.filter((t) => t === "FIRST BLOOD").length !== 1) return "first blood (round 2): " + JSON.stringify(res.FB2);
    return true;
  });
  try { xe("annClear(); true"); toLobby(); } catch (e) {}
  phase = "fid economy";
  FIDP("fid economy: loss bonus 1900 / 2400 / 2900 / 2900 by streak, reset on win, win 3000, enemy streak mirrors, getLossBonus(team) predicts next round", () => {
    xe(f5 + "true"); advance(50);
    const R = JSON.parse(xe(`(() => { const out = [], seq = [false, false, false, false, true, false, true, true]; FV.lsY = FV.lsT = 0;
      for (const w of seq) { const pre = getLossBonus("you"), preE = getLossBonus("enemy"), e0 = FV.bs[F_EN[0]]; FV.cr = 0; if (e0) e0.cr = 0; FV.sp.st = "carry"; running = true;
        fCheck(w, "eco test"); clearTimeout(FV.to); annClear(); out.push([w ? 1 : 0, FV.cr, pre, e0 ? e0.cr : -1, preE]); }
      running = false; return JSON.stringify(out); })()`));
    const want = [1900, 2400, 2900, 2900, 3000, 1900, 3000, 3000], wantE = [3000, 3000, 3000, 3000, 1900, 3000, 1900, 2400];
    for (let i = 0; i < R.length; i++) { const [w, cr, pre, ecr, preE] = R[i];
      if (cr !== want[i]) return "round " + (i + 1) + " (" + (w ? "win" : "loss") + "): +" + cr + " want +" + want[i];
      if (!w && pre !== cr) return "getLossBonus('you') said " + pre + ", paid " + cr;
      if (ecr !== -1 && ecr !== wantE[i]) return "enemy round " + (i + 1) + ": +" + ecr + " want +" + wantE[i];
      if (w && ecr !== -1 && preE !== ecr) return "getLossBonus('enemy') said " + preE + ", paid " + ecr; }
    return true;
  });
  try { toLobby(); } catch (e) {}
}

// ---------- buy menu rebuild: categories, cards + prices, buy / sell / unaffordable, shields, ability charges, request, loss bonus, Outlaw ----------
if (!NO3) {
  const xe = vm.runInContext("__xe", context), R = (label, f) => { phase = "buy " + label; const e0 = errors.length; let r; try { r = f(); } catch (e) { r = "threw: " + String((e && e.stack) || e).split("\n").slice(0, 2).join(" | ").slice(0, 300); }
    const errs = []; if (r !== true) errs.push(String(r).slice(0, 400)); errors.slice(e0).forEach((e) => errs.push(e.where + ": " + e.msg.slice(0, 200)));
    report.push({ label: "buy: " + label, el: true, handler: true, cond: r === true, pass: !errs.length, errs }); lastErr = errors.length; };
  const btn = (n) => Array.from(doc.querySelectorAll("#xBG button[data-n]")).find((b) => b.dataset.n === n);
  const open = (cr) => { xe(`(() => { running = true; paused = false; window.xLdOn = false; FV.dm = false; FV.buy = 20; player.hp = 100; ${cr != null ? "FV.cr = " + cr + ";" : ""} buyMenu(true); buyRender(); return true; })()`); };
  const rclick = (b) => dispatch(b, mkEvent("contextmenu", {}));
  let started = false;
  try { toLobby(); xe('(() => { FV.pick = "ascent"; FV.srOn = 0; window.xSwift = false; startFive(); clearTimeout(FV.to); return true; })()'); advance(60); started = xe("mode === 'five' && running"); } catch (e) {}
  const EXP = [["Sidearms", [["Classic", 0], ["Shorty", 150], ["Frenzy", 450], ["Ghost", 500], ["Sheriff", 800]]], ["SMGs", [["Stinger", 1100], ["Spectre", 1600]]], ["Shotguns", [["Bucky", 850], ["Judge", 1850]]],
    ["Rifles", [["Bulldog", 2050], ["Guardian", 2250], ["Phantom", 2900], ["Vandal", 2900]]], ["Sniper", [["Marshal", 950], ["Outlaw", 2400], ["Operator", 4700]]], ["Machine guns", [["Ares", 1600], ["Odin", 3200]]], ["Shields", [["Light Shields", 400], ["Heavy Shields", 1000]]]];
  R("menu opens in a 5v5 buy phase with all 7 category columns in Valorant order and every card at the right price", () => {
    if (!started) return "5v5 did not start"; xe("FV.pri = null; FV.sec = 'Classic'; player.armor = 0; FV.bt = []; true"); open(9000); if (!$("xBuy").classList.contains("on")) return "menu not open";
    const cols = Array.from(doc.querySelectorAll("#xBG .x-bc")).map((c) => String(c.querySelector("h4").textContent)), bad = [];
    EXP.forEach(([cat, its], i) => { if (!new RegExp(cat, "i").test(cols[i] || "")) bad.push("column " + (i + 1) + " is " + cols[i] + " (want " + cat + ")");
      its.forEach(([n, p]) => { const b = btn(n); if (!b) return bad.push("no card " + n); const t = b.querySelector(".x-tp"); if (!t || String(t.textContent).trim() !== String(p)) bad.push(n + " shows " + (t && t.textContent) + " want " + p);
        if (!b.querySelector("svg")) bad.push(n + " no silhouette"); if (!/Shields/.test(n) && !xe(`!!WEAP[${JSON.stringify(n)}]`)) bad.push(n + " missing from WEAP"); }); });
    if (!$("xBTm") || !/Team loadout/i.test($("xBTm").textContent)) bad.push("no team loadout panel");
    return bad.length ? bad.slice(0, 6).join(" | ") : true; });
  R("buying deducts credits and equips; right-click sells back for the full price; a sidearm sale restores the Classic", () => {
    xe("FV.pri = null; FV.sec = 'Classic'; FV.bt = []; true"); open(5000); btn("Vandal").click(); advance(10);
    if (xe("FV.cr") !== 2100 || xe("FV.pri") !== "Vandal" || xe("rw") !== "pri" || xe("wName()") !== "Vandal") return "buy: cr " + xe("FV.cr") + " pri " + xe("FV.pri") + " rw " + xe("rw");
    if (!btn("Vandal").classList.contains("on")) return "Vandal card not marked owned";
    btn("Phantom").click(); if (xe("FV.cr") !== 2100 || xe("FV.pri") !== "Phantom") return "same-round swap should refund the Vandal: cr " + xe("FV.cr");
    rclick(btn("Phantom")); if (xe("FV.cr") !== 5000 || xe("FV.pri") !== null) return "sell: cr " + xe("FV.cr") + " pri " + xe("FV.pri");
    btn("Sheriff").click(); if (xe("FV.sec") !== "Sheriff" || xe("FV.cr") !== 4200) return "sheriff buy"; rclick(btn("Sheriff")); if (xe("FV.sec") !== "Classic" || xe("FV.cr") !== 5000) return "sheriff sell: " + xe("FV.sec") + " " + xe("FV.cr"); return true; });
  R("unaffordable cards are dimmed and blocked", () => {
    xe("FV.pri = null; FV.bt = []; true"); open(500); const b = btn("Vandal"); if (!b || b.getAttribute("aria-disabled") !== "true" || !b.classList.contains("xb-no")) return "Vandal not marked unaffordable at 500";
    b.click(); xe('fBuy("Operator"); true'); if (xe("FV.cr") !== 500 || xe("FV.pri") !== null) return "bought anyway: cr " + xe("FV.cr") + " pri " + xe("FV.pri");
    if (btn("Ghost").getAttribute("aria-disabled") === "true") return "Ghost (500) dimmed at 500"; return true; });
  R("shields: light then heavy (light refunded), right-click sells heavy back", () => {
    xe("player.armor = 0; FV.bt = []; true"); open(2000); btn("Light Shields").click(); if (xe("player.armor") !== 25 || xe("FV.cr") !== 1600) return "light: " + xe("player.armor") + " / " + xe("FV.cr");
    btn("Heavy Shields").click(); if (xe("player.armor") !== 50 || xe("FV.cr") !== 1000) return "heavy: " + xe("player.armor") + " / " + xe("FV.cr");
    rclick(btn("Heavy Shields")); if (xe("player.armor") !== 0 || xe("FV.cr") !== 2000) return "sell: " + xe("player.armor") + " / " + xe("FV.cr"); return true; });
  R("ability charges: per-charge pips, buy fills a pip, right-click sells it back", () => {
    xe('(() => { J.on = true; J.pick = "Jett"; J.c = 0; J.q = 0; FV.bt = []; return true; })()'); open(1000); const b = btn("ab:c"); if (!b) return "no ability card";
    const pips = () => Array.from(btn("ab:c").querySelectorAll(".xb-pips i")); if (pips().length !== xe("K().mx.c")) return "pips " + pips().length;
    b.click(); if (xe("J.c") !== 1 || xe("FV.cr") !== 800) return "buy: J.c " + xe("J.c") + " cr " + xe("FV.cr"); if (pips().filter((i) => i.classList.contains("on")).length !== 1) return "pip not filled";
    btn("ab:q").click(); if (xe("J.q") !== 1 || xe("FV.cr") !== 650) return "Q buy";
    rclick(btn("ab:c")); if (xe("J.c") !== 0 || xe("FV.cr") !== 850) return "sell: J.c " + xe("J.c") + " cr " + xe("FV.cr"); return true; });
  R("next round minimum shows credits + loss bonus; round number shown", () => {
    xe("FV.lsY = 1; true"); open(1000); if (String($("xBLB").textContent).trim() !== "3400") return "lsY 1: " + $("xBLB").textContent;
    xe("FV.lsY = 0; buyRender(); true"); if (String($("xBLB").textContent).trim() !== "2900") return "lsY 0: " + $("xBLB").textContent;
    xe("FV.lsY = 5; buyRender(); true"); if (String($("xBLB").textContent).trim() !== "3900") return "cap: " + $("xBLB").textContent;
    return /Round \d+/.test($("xBRd").textContent) || "round " + $("xBRd").textContent; });
  R("team loadout lists teammates' credits; request: a teammate with spare credits buys it for you, selling refunds them", () => {
    xe('(() => { FV.pri = null; FV.bt = []; FV.lsY = 0; F_MATES.forEach((m, i) => { FV.bs[m] = { cr: i ? 100 : 9000, w: "Classic", arm: 0, alive: true }; }); return true; })()'); open(0);
    const m0 = xe("F_MATES[0]"), tm = String($("xBTm").textContent); if (!xe("F_MATES").every((m) => tm.includes(m))) return "team panel missing a mate"; if (!tm.includes("9000")) return "mate credits not shown";
    const rq = Array.from(doc.querySelectorAll("#xBG button[data-rq]")).find((b) => b.dataset.rq === "Vandal"); if (!rq) return "no request button on the unaffordable Vandal"; rq.click(); advance(20);
    if (xe("FV.req") !== "Vandal" || !/Requested Vandal/.test($("xBTm").textContent)) return "request not shown in team list";
    advance(1000); if (xe("FV.pri") !== "Vandal" || xe("FV.reqBy") !== m0 || xe(`FV.bs[${JSON.stringify(m0)}].cr`) !== 6100) return "not bought by teammate: pri " + xe("FV.pri") + " by " + xe("FV.reqBy");
    if (!/Bought your Vandal/.test($("xBTm").textContent)) return "team list does not show the gift";
    rclick(btn("Vandal")); if (xe("FV.pri") !== null || xe(`FV.bs[${JSON.stringify(m0)}].cr`) !== 9000 || xe("FV.cr") !== 0) return "sell of gift: pri " + xe("FV.pri") + " mate cr " + xe(`FV.bs[${JSON.stringify(m0)}].cr`);
    xe("F_MATES.forEach((m) => { FV.bs[m].cr = 0; }); true"); xe('fReq("Odin"); true'); advance(1000); if (xe("FV.pri") !== null || !xe("FV.reqNo") || !/Requested Odin/.test($("xBTm").textContent)) return "no-donor request";
    return true; });
  R("keyboard: 1-7 pick the column, Escape closes, B reopens", () => {
    open(9000); const key = (c, k) => { dispatch(win, mkEvent("keydown", { code: c, key: k || "" })); dispatch(win, mkEvent("keyup", { code: c, key: k || "" })); };
    key("Digit3"); if (xe("FV.cat") !== 5) return "3 -> cat " + xe("FV.cat"); const c3 = doc.querySelectorAll("#xBG .x-bc")[2]; if (!c3.classList.contains("on")) return "shotgun column not highlighted";
    key("Digit7"); if (xe("FV.cat") !== 4) return "7 -> cat " + xe("FV.cat");
    key("Escape", "Escape"); if (xe("FV.menu")) return "Escape did not close"; key("KeyB", "b"); return xe("FV.menu") || "B did not reopen"; });
  R("Outlaw: 2400, buys, fires 2 shots 0.75 s apart, empties, reloads to 2; scoped 3.5x", () => {
    xe("FV.pri = null; FV.bt = []; true"); open(2400); btn("Outlaw").click(); if (xe("FV.pri") !== "Outlaw" || xe("FV.cr") !== 0) return "buy: " + xe("FV.pri") + " cr " + xe("FV.cr");
    const r = xe(`(() => { FV.buy = 0; buyMenu(false); swapW("pri"); VM.sw = 0; if (wName() !== "Outlaw") return "wName " + wName(); if (MAG() !== 2 || ammo !== 2) return "mag " + ammo + "/" + MAG();
      if (!(XSZ.Outlaw && XSZ.Outlaw[0] === 3.5)) return "no 3.5x scope"; reloading = 0; fcd = 0; shoot(); if (ammo !== 1) return "shot 1 ammo " + ammo; if (!(fcd > 0.6 && fcd < 0.9)) return "fire delay " + fcd;
      fcd = 0; shoot(); if (ammo !== 0) return "shot 2 ammo " + ammo; const r0 = rsv;
      window.dispatchEvent(Object.assign(new Event("keydown"), { code: "KeyR", key: "r" })); window.dispatchEvent(Object.assign(new Event("keyup"), { code: "KeyR", key: "r" })); if (!(reloading > 0)) return "R did not reload";
      for (let i = 0; i < 300 && reloading > 0; i++) tick(1 / 30); return ammo === 2 && rsv < r0 ? true : "after reload " + ammo + " rsv " + rsv; })()`);
    return r; });
  try { xe("(() => { try { buyMenu(false); running = false; FV.bt = []; } catch (e) {} return true; })()"); toLobby(); } catch (e) {}
}

// ---------- mp: online multiplayer over an in-memory PeerJS stub (host = this game + scripted client; then client = this game + scripted host) ----------
if (!NO3) {
  const xe = vm.runInContext("__xe", context), ev = (s) => { try { return xe(s); } catch (e) { return "ERR " + String(e).slice(0, 200); } };
  const mpOk = (label, cond, info) => { if (process.env.MPDBG) process.stderr.write("mp " + label + " " + !!cond + "\n"); const e1 = errors.slice(lastErr), x1 = xErrCalls.slice(lastX); lastErr = errors.length; lastX = xErrCalls.length; const pass = !!cond && !e1.length && !x1.length;
    report.push({ label: "mp: " + label, el: true, handler: true, cond: !!cond, pass, errs: (cond ? [] : [String(info === undefined ? "" : info).slice(0, 300)]).concat(e1.map((e) => e.where + ": " + e.msg), x1.map((x) => "xErr: " + x.msg)) }); };
  const reg = new Map(); let pid = 0; const later = (f) => win.setTimeout(f, 1);
  class Em { constructor() { this._h = {}; } on(e, f) { (this._h[e] = this._h[e] || []).push(f); return this; } emit(e, ...a) { (this._h[e] || []).slice().forEach((f) => { try { f(...a); } catch (x) { rec("fakepeer " + e, x); } }); } }
  class FConn extends Em { constructor(other) { super(); this.peer = other; this.open = false; this.o = null; this.dead = false; }
    send(d) { if (!this.open || !this.o) return; const o = this.o, j = JSON.stringify(d); later(() => { if (o.open) o.emit("data", JSON.parse(j)); }); }
    close() { if (this.dead) return; this.dead = true; this.open = false; const o = this.o; later(() => this.emit("close")); if (o && !o.dead) { o.dead = true; o.open = false; later(() => o.emit("close")); } } }
  class FPeer extends Em { constructor(id) { super(); if (id && typeof id === "object") id = undefined; this.id = id || "rnd-" + ++pid; this.cs = [];
      later(() => { if (reg.has(this.id)) return this.emit("error", { type: "unavailable-id", message: "ID " + this.id + " is taken" }); reg.set(this.id, this); this.open = true; this.emit("open", this.id); }); }
    connect(id) { const c = new FConn(id); this.cs.push(c); later(() => { const t = reg.get(id); if (!t || t.destroyed) return this.emit("error", { type: "peer-unavailable", message: "Could not connect to peer " + id });
        const r = new FConn(this.id); t.cs.push(r); c.o = r; r.o = c; t.emit("connection", r); later(() => { if (c.dead || r.dead) return; c.open = r.open = true; r.emit("open"); c.emit("open"); }); }); return c; }
    destroy() { if (this.destroyed) return; this.destroyed = true; if (reg.get(this.id) === this) reg.delete(this.id); this.cs.forEach((c) => c.close()); } reconnect() {} }
  win.__mpPeer = FPeer;
  const S = () => vm.runInContext("xMP.S", context);
  try {
    // --- A: this game hosts a private TDM room, a scripted client joins by code ---
    toLobby(); phase = "mp host"; $("playBtn").click(); advance(30);
    vm.runInContext("xMP.create(false, 'tdm')", context); advance(60);
    const code = S().code;
    mpOk("Create private room: 6-char code without 0/O/1/I, copy button, player list", /^[A-HJ-NP-Z2-9]{6}$/.test(code) && $("xOnCodeT").textContent === code && !$("xOnRoom").hidden && !$("xOnCopy").hidden && hasHandler($("xOnCopy"), "click") && /\(you\)/.test($("xOnList").textContent), code + " / " + $("xOnCodeT").textContent);
    const cp = new FPeer(), inbox = []; advance(10);
    const cc = cp.connect("valorstrike-priv-" + code); cc.on("data", (m) => inbox.push(m)); cc.on("open", () => cc.send({ t: "hi", v: 1, n: "Tester", ag: "Sova" })); advance(120);
    mpOk("Join by code: host room lists both players (host sees the joiner, joiner gets the room)", inbox.some((m) => m.t === "room" && m.pl.length === 2 && m.pl.some((p) => p.n === "Tester")) && /Tester/.test($("xOnList").textContent), JSON.stringify(inbox.slice(-1)).slice(0, 200));
    $("xOnStart").click(); advance(200);
    const st = inbox.find((m) => m.t === "start");
    mpOk("Host START: online TDM running, joiner seated in a bot slot (10 units total)", !!st && st.mode === "tdm" && inGame() && ev("FV.dm && FV.tdm && running && bots.length + allies.length === 9 && [].concat(bots, allies).filter((u) => u.hum && u.nt && u.name === 'Tester').length === 1 && FV.dmN === 0") === true, st ? ev("[running, FV.tdm, bots.length, allies.length]") : "no start msg");
    if (st) {
      const me = st.u.find((e) => e[0] === st.you), sq = me[14];
      const dir = ev(`(() => { const x = ${me[4]}, z = ${me[6]}; for (const [dx, dz] of [[1,0],[-1,0],[0,1],[0,-1],[0.7,0.7],[-0.7,0.7],[0.7,-0.7],[-0.7,-0.7]]) { let ok = true; for (let k = 0; k <= 12; k++) if (blocked(x + dx * k * 0.1, z + dz * k * 0.1, 0.3, 0)) { ok = false; break; } if (ok) return [dx, dz]; } return [0, 0]; })()`);
      let x = me[4], z = me[6];
      for (let k = 1; k <= 10; k++) { x = me[4] + dir[0] * k * 0.1; z = me[6] + dir[1] * k * 0.1; cc.send({ t: "in", x, y: 0, z, r: 0.5, p: 0, w: "Phantom", sq }); advance(33); }
      advance(300);
      const hx = ev(`xMP.unit(${st.you}).g.position.x`), hz = ev(`xMP.unit(${st.you}).g.position.z`), snaps = inbox.filter((m) => m.t === "s"), lastS = snaps[snaps.length - 1], back = lastS && lastS.u.find((e) => e[0] === st.you);
      mpOk("Client movement replicates to the host unit and comes back in 20 Hz snapshots", Math.hypot(hx - x, hz - z) < 0.05 && !!back && Math.hypot(back[4] - x, back[6] - z) < 0.05 && back[11] === "Phantom" && snaps.length >= 5, JSON.stringify({ hx, hz, x, z, back, n: snaps.length }));
      ev("player.hp = 100; player.armor = 0; DM.pp = 0; true");
      cc.send({ t: "hit", i: 0, n: 30, hs: 0, w: "Phantom" }); advance(60);
      const hp1 = ev("player.hp");
      mpOk("Client hit claim damages the host's player (host-validated)", hp1 === 70, hp1);
      cc.send({ t: "hit", i: st.u.find((e) => e[1] === 1 && e[0] !== st.you)[0], n: 50, hs: 0, w: "Phantom" }); advance(60);
      mpOk("Friendly-fire claim on a teammate is rejected", ev(`(() => { const t = xMP.unit(${st.u.find((e) => e[1] === 1 && e[0] !== st.you)[0]}); return t.hp === 100 || !t.alive; })()`) === true);
      cc.send({ t: "hit", i: 0, n: 255, hs: 1, w: "Phantom" }); advance(200);
      const kfSeen = inbox.some((m) => m.t === "s" && (m.ev || []).some((v) => v[0] === "k" && v[1] === "Tester" && v[2] === S().name));
      mpOk("Kill by the client: host dies, kill feed event + K/D reach the client", ev("player.hp <= 0 && DM.k.Tester === 1") === true && kfSeen && inbox.filter((m) => m.t === "s").pop().k.Tester === 1, ev("[player.hp, JSON.stringify(DM.k)]"));
      const bh = ev("board(); document.getElementById('xBoard').innerHTML");
      mpOk("Tab scoreboard lists the host (You) and the remote player with ping, bots tagged", typeof bh === "string" && /class="nm">You /.test(bh) && /class="nm">Tester <small class="x-mpp">\d+ ms/.test(bh) && /BOT<\/small>/.test(bh), String(bh).slice(0, 300));
      cc.send({ t: "sh", w: "Phantom" }); advance(120);
      mpOk("Client gunshot is replayed on the host and relayed in snapshots", inbox.some((m) => m.t === "s" && (m.ev || []).some((v) => v[0] === "s" && v[1] === st.you)));
      cc.close(); advance(150);
      mpOk("Client disconnect: its slot returns to a bot, match keeps running", ev("running && [].concat(bots, allies).filter((u) => u.hum || u.nt).length === 0 && xMP.S.conns.size === 0") === true);
      advance(1000); frames(60);
      mpOk("Online TDM frames run clean after the disconnect", inGame());
    }
    phase = "mp host leave"; $("xPow").click(); advance(100);
    mpOk("Host leaving closes the room (peer id released)", !S().on && !reg.has("valorstrike-priv-" + code) && disp("lobby") === "flex");
    // --- B: this game joins a scripted host by code (DM) ---
    toLobby(); phase = "mp client";
    const hp = new FPeer("valorstrike-priv-ABCDEF"), hin = []; let hc = null; hp.on("connection", (c) => { hc = c; c.on("data", (m) => hin.push(m)); }); advance(10);
    $("xOnCode").value = "abcdef"; $("xOnJoin").click(); advance(120);
    const hi = hin.find((m) => m.t === "hi");
    mpOk("Join by code (typed lowercase): connects and says hello with the lobby name", !!hi && hi.n === S().name && hi.v === 1, JSON.stringify(hin));
    if (hc && hi) {
      hc.send({ t: "room", v: 1, code: "ABCDEF", pub: false, mode: "dm", map: "ascent", st: "room", cd: 0, pl: [{ n: "Hosty", p: 0, h: 1 }, { n: hi.n, p: 20, h: 0 }] }); advance(40);
      mpOk("Client room view: host listed, no START for the client", /Hosty/.test($("xOnList").textContent) && $("xOnStart").hidden && S().role === "client");
      const row = (i, tm, n, ag, x, z, a, h, hpv, sq) => [i, tm, n, ag, x, 0, z, 0, hpv == null ? 100 : hpv, 50, a == null ? 1 : a, "Vandal", h || 0, 30, sq || 0];
      const ros = (hx, mehp, sq) => [row(0, 0, "Hosty", "Phoenix", hx, 2, 1, 1), row(1, 1, "Jett", "Jett", 4, 4), row(2, 1, "Omen", "Omen", 6, 6), row(3, 1, hi.n, "Sova", 1, 1, 1, 0, mehp, sq)];
      hc.send({ t: "start", v: 1, mode: "dm", map: "ascent", you: 3, team: 1, tl: 500, len: 540, win: 40, u: ros(2), k: {}, d: {} }); advance(120);
      mpOk("Client builds the match from the host roster (all units network-driven, no local AI)", inGame() && ev("MP.cl && bots.length === 3 && allies.length === 0 && bots.every((b) => b.nt) && player.x === 1 && FV.dm && !FV.tdm") === true, ev("[MP.cl, bots.length, player.x]"));
      for (let k = 1; k <= 6; k++) { hc.send({ t: "s", tl: 499, u: ros(2 + k * 0.2), k: { Hosty: 1 }, d: { Jett: 1 }, ev: k === 1 ? [["k", "Hosty", "Jett", 1, "Vandal"]] : [] }); advance(50); }
      advance(250);
      const hx2 = ev("bots.find((b) => b.nid === 0).g.position.x");
      mpOk("Snapshots: remote host interpolates to its latest position, kill feed + K/D applied", Math.abs(hx2 - 3.2) < 0.05 && ev("DM.k.Hosty === 1 && SB.Hosty && SB.Hosty.k === 1") === true && /Hosty/.test($("feed").textContent), hx2);
      ev("player.x = 1.5; true"); advance(120);
      mpOk("Client sends its own (predicted) position at ~30 Hz", hin.some((m) => m.t === "in" && Math.abs(m.x - 1.5) < 0.01) && hin.filter((m) => m.t === "in").length >= 10);
      ev("hurt(bots.find((b) => b.nid === 0), 40); true"); advance(60);
      const hit = hin.find((m) => m.t === "hit");
      mpOk("Client shot becomes a hit claim to the host; no local damage applied", !!hit && hit.i === 0 && hit.n === 40 && ev("bots.find((b) => b.nid === 0).hp") === 100, JSON.stringify(hit));
      hc.send({ t: "s", tl: 498, u: ros(3.2, 60), k: { Hosty: 1 }, d: {}, ev: [] }); advance(60);
      mpOk("Host snapshot damage applies to the client's own health", ev("player.hp") === 60);
      hc.send({ t: "s", tl: 497, u: ros(3.2, 100, 1), k: { Hosty: 1 }, d: {}, ev: [] }); advance(60);
      mpOk("Host respawn (spawn seq) teleports the client to its new spawn", ev("player.hp === 100 && player.x === 1 && MP.sq === 1") === true);
      frames(60);
      hc.close(); advance(150);
      mpOk("Host leaving: client returns to the lobby with a clear message", disp("lobby") === "flex" && /host left/i.test($("xOnMsg").textContent) && !S().on && !$("xQueue").hidden, $("xOnMsg").textContent);
    }
    hp.destroy();
    // --- C: quick match with no public lobby: claim slot 1 and host, a joiner is seated, auto start after ~15 s ---
    toLobby(); phase = "mp quick host";
    doc.querySelector('#xOn [data-om="dm"]').click(); $("xOnQuick").click(); advance(400);
    mpOk("Quick Match with no public lobby: claims valorstrike-pub-dm-1 and hosts with bots", reg.has("valorstrike-pub-dm-1") && S().role === "host" && S().pub && S().mode === "dm" && /starts in \d+ s/.test($("xOnRoomM").textContent), [...reg.keys()].join(",") + " " + S().st);
    const qp = new FPeer(), qin = []; advance(10); const qc = qp.connect("valorstrike-pub-dm-1"); qc.on("data", (m) => qin.push(m)); qc.on("open", () => qc.send({ t: "hi", v: 1, n: "You", ag: "Jett" })); advance(80);
    ev("xMP.S.cdAt = performance.now() + 300; true"); advance(500);
    const qs = qin.find((m) => m.t === "start");
    mpOk("Public lobby auto-starts DM after the countdown, joiner seated (name de-duplicated)", inGame() && ev("FV.dm && !FV.tdm && running && bots.length === 9") === true && !!qs && qs.mode === "dm" && qs.u.find((e) => e[0] === qs.you)[2] !== "You", qs ? qs.u.find((e) => e[0] === qs.you)[2] : JSON.stringify(qin.map((m) => m.t)) + ev("[running, bots.length, xMP.S.conns.size, xMP.S.st]"));
    const lp = new FPeer(), lin = []; advance(10); const lc = lp.connect("valorstrike-pub-dm-1"); lc.on("data", (m) => lin.push(m)); lc.on("open", () => lc.send({ t: "hi", v: 1, n: "Late", ag: "Omen" })); advance(150);
    mpOk("Late join into a running DM gets a seat", lin.some((m) => m.t === "start") && ev("bots.filter((b) => b.hum).length") === 2);
    frames(60); phase = "mp quick leave"; $("xPow").click(); advance(150);
    mpOk("Leaving the public match closes it; joiners are told", !S().on && !reg.has("valorstrike-pub-dm-1"));
    qp.destroy(); lp.destroy();
    // --- D: quick match finds an open public lobby and joins it ---
    toLobby(); phase = "mp quick join";
    const ph = new FPeer("valorstrike-pub-tdm-1"), pin = []; ph.on("connection", (c) => c.on("data", (m) => { pin.push(m); if (m.t === "hi") c.send({ t: "room", v: 1, code: "", pub: true, mode: "tdm", map: "bind", st: "room", cd: 9, pl: [{ n: "PubHost", p: 0, h: 1 }, { n: m.n, p: 0, h: 0 }] }); })); advance(10);
    doc.querySelector('#xOn [data-om="tdm"]').click(); $("xOnQuick").click(); advance(200);
    mpOk("Quick Match joins an existing public lobby instead of hosting", S().role === "client" && S().pub && pin.some((m) => m.t === "hi") && !reg.has("valorstrike-pub-tdm-2") && /PubHost/.test($("xOnList").textContent), JSON.stringify([S().role, S().pub, S().st, pin.map((m) => m.t), [...reg.keys()], $("xOnList").textContent, $("xOnMsg").textContent]));
    $("xOnLeave").click(); advance(60); ph.destroy();
    // --- F: this game hosts online 5v5 Unrated; two scripted clients (one per team): buy, plant, round end credits, hidden enemy economy, late join, disconnect ---
    toLobby(); phase = "mp5 host"; $("playBtn").click(); advance(30);
    vm.runInContext("xMP.create(false, 'five')", context); advance(60);
    const code5 = S().code;
    mpOk("Room mode selector has Unrated (Spike) and the room shows it", !!doc.querySelector('#xOn [data-om="five"]') && /Unrated/.test($("xOnRoomM").textContent), $("xOnRoomM").textContent);
    const mk5 = (n, ag) => { const p = new FPeer(), box = []; const c = p.connect("valorstrike-priv-" + code5); c.on("data", (m) => { box.push(m); if (m.t === "pi") c.send({ t: "po", c: m.c }); }); c.on("open", () => c.send({ t: "hi", v: 1, n, ag })); return { p, c, box }; };
    const A5 = mk5("Five", "Sova"); advance(80); const B5 = mk5("Mate", "Omen"); advance(120);
    $("xOnStart").click(); advance(200);
    const sa = A5.box.find((m) => m.t === "start"), sb = B5.box.find((m) => m.t === "start");
    mpOk("Host START (Unrated): 5v5 rounds running, both joiners seated on opposite teams, bots fill the rest", !!sa && !!sb && sa.mode === "five" && sa.team !== sb.team && inGame() && ev("mode === 'five' && !FV.dm && running && FV.buy > 0 && bots.length === 5 && allies.length === 4 && [].concat(bots, allies).filter((u) => u.hum && u.nt).length === 2") === true && !!sa.rs && sa.u.length === 10, JSON.stringify([sa && sa.team, sb && sb.team, ev("[mode, FV.dm, running, FV.buy, bots.length, allies.length]")]));
    if (sa && sb) {
      const D = sa.team === 1 ? A5 : B5, At = sa.team === 1 ? B5 : A5, sd = D === A5 ? sa : sb, sat = D === A5 ? sb : sa; // team 0 (host's) attacks first
      const dN = D === A5 ? "Five" : "Mate", aN = D === A5 ? "Mate" : "Five";
      const t1 = sd.u.filter((e) => e[1] === 1).map((e) => e[2]), t0 = sd.u.filter((e) => e[1] === 0).map((e) => e[2]);
      D.c.send({ t: "buy", n: "Ghost" }); advance(80);
      const bo = D.box.filter((m) => m.t === "bo").pop();
      mpOk("Client buy request: host validates credits, equips the unit and answers with the new loadout", !!bo && bo.ok === 1 && bo.cr === 300 && bo.ld[1] === "Ghost" && ev(`FV.bs[${JSON.stringify(dN)}].cr === 300 && xMP.unit(${sd.you}).w === "Ghost"`) === true, JSON.stringify(bo));
      D.c.send({ t: "buy", n: "Vandal" }); advance(80);
      const bo2 = D.box.filter((m) => m.t === "bo").pop();
      mpOk("Client buy it cannot afford is refused (credits unchanged)", !!bo2 && bo2.ok === 0 && bo2.cr === 300 && ev(`FV.bs[${JSON.stringify(dN)}].cr`) === 300, JSON.stringify(bo2));
      const rsD = D.box.filter((m) => m.t === "rs"), rsA = At.box.filter((m) => m.t === "rs");
      const leakD = rsD.some((m) => Object.keys(m.cr || {}).some((n) => t0.includes(n))), leakA = rsA.some((m) => Object.keys(m.cr || {}).some((n) => t1.includes(n)));
      mpOk("Round state at ~5 Hz; each client gets only its own team's credits (no enemy economy)", rsD.length >= 2 && rsA.length >= 2 && !leakD && !leakA && Object.keys(rsD[rsD.length - 1].cr).length === 5 && rsD[rsD.length - 1].me === 300 && sd.u.every((e) => e.length === 15), JSON.stringify([rsD.length, rsA.length, leakD, leakA, rsD.length && rsD[rsD.length - 1].cr]));
      ev("FV.buy = 0.01; fiveTick(0.05); true"); advance(100);
      // freeze the bots (no AI) so the scripted plant is deterministic; the attacking client's unit carries the Spike to site A and holds 4
      const aid = sat.you;
      ev(`(() => { [].concat(bots, allies).forEach((u) => { if (!u.hum) { u.nt = 1; u.nb = []; } }); const u = xMP.unit(${aid}); FV.sp.st = "carry"; FV.sp.c = u; fsSet(); u.g.position.x = SITES.A[0]; u.g.position.z = SITES.A[1]; u.nb = []; return true; })()`);
      const crA0 = ev("FV.cr"), crM0 = ev(`FV.bs[${JSON.stringify(aN)}].cr`), crD0 = ev(`FV.bs[${JSON.stringify(dN)}].cr`), sqA = ev(`xMP.unit(${aid}).sq`);
      const sx = ev("SITES.A[0]"), sz = ev("SITES.A[1]");
      for (let k = 0; k < 150; k++) { if (k % 2 === 0) At.c.send({ t: "in", x: sx, y: 0, z: sz, r: 0, p: 0, w: "Classic", sq: sqA, h4: 1 }); advance(17); ev("fiveTick(1 / 30); true"); }
      const pl = ev("FV.sp.st"), rsP = At.box.filter((m) => m.t === "rs").pop(), spEv = At.box.some((m) => m.t === "s" && (m.ev || []).some((v) => v[0] === "sp" && v[2] === aN));
      mpOk("Client hold-4 plant: host plants for that unit, +300 to every attacker, plant event + spike state reach clients", pl === "plant" && ev("FV.cr") === crA0 + 300 && ev(`FV.bs[${JSON.stringify(aN)}].cr`) === crM0 + 300 && ev(`FV.bs[${JSON.stringify(dN)}].cr`) === crD0 && !!rsP && rsP.sp[0] === "plant" && rsP.sp[7] === "A" && spEv, JSON.stringify([pl, ev("FV.cr"), crA0, rsP && rsP.sp, spEv]));
      const L5 = mk5("Late", "Jett"); advance(150);
      mpOk("Late joiner mid-round waits for the next round (no seat yet)", !L5.box.some((m) => m.t === "start") && L5.box.some((m) => m.t === "room"));
      ev("FV.sp.t = 0.05; fiveTick(0.1); true"); advance(200);
      const reD = D.box.find((m) => m.t === "re"), reA = At.box.find((m) => m.t === "re");
      mpOk("Spike detonates: round end event to both clients (attackers win), scores 1-0", !!reD && !!reA && reD.w === 1 && reD.sc[0] === 1 && reD.sc[1] === 0 && /DETONATED/.test(reD.ti) && ev("FV.you === 1 && FV.them === 0 && !running") === true, JSON.stringify(reD));
      mpOk("Round-end credits: winners +3000, losers +1900 (loss bonus), each client told its own", reA.me === crM0 + 300 + 3000 && reD.me === crD0 + 1900 && ev("FV.cr") === crA0 + 300 + 3000, JSON.stringify([reA.me, crM0, reD.me, crD0, ev("FV.cr"), crA0]));
      advance(7300);
      const rdD = D.box.find((m) => m.t === "rd"), rdA = At.box.find((m) => m.t === "rd");
      mpOk("Next round: round-start event with credits + kept loadout (survivor keeps Ghost), units re-seated by name", !!rdD && !!rdA && rdD.cr === crD0 + 1900 && rdD.ld[1] === "Ghost" && rdA.cr === crM0 + 3300 && ev("running && FV.buy > 0 && [].concat(bots, allies).filter((u) => u.hum && u.nt).length === 3") === true, JSON.stringify([rdD, rdA, ev("[running, FV.buy, [].concat(bots, allies).filter((u) => u.hum).map((u) => u.name)]")]));
      const ls = L5.box.find((m) => m.t === "start");
      mpOk("Late joiner takes a bot slot at the next round start", !!ls && ls.mode === "five" && ev(`xMP.unit(${ls ? ls.you : -9}).name`) === "Late" && !!ls.rs, JSON.stringify(ls && [ls.you, ls.team]));
      const nD = D.box.filter((m) => m.t === "rs").length; advance(400);
      const leak2 = D.box.filter((m) => m.t === "rs").some((m) => Object.keys(m.cr || {}).some((n) => t0.includes(n)));
      mpOk("Enemy credits are never sent to the client (whole match so far)", !leak2 && D.box.filter((m) => m.t === "rs").length > nD);
      ev("FV.buy = 0.01; fiveTick(0.05); true"); advance(100);
      { // online abilities: client cast -> host spawns + relays; host cast relayed; cast without a charge refused
        phase = "mp5 abilities"; const om = sb.you, oxz = ev(`[xMP.unit(${om}).g.position.x, xMP.unit(${om}).g.position.z, xMP.unit(${om}).alive]`);
        const sm0 = ev("J.smokes.length"), nA = A5.box.length, nB = B5.box.length;
        B5.c.send({ t: "ab", k: "e", ag: "Omen", o: [oxz[0], 1.6, oxz[1]], d: [0, 0, -1], ts: 1 }); advance(20);
        const acA = A5.box.slice(nA).find((m) => m.t === "ac" && m.i === om);
        mpOk("Ability: client smoke cast (Omen Dark Cover) spawns the smoke in the host world and is relayed to the other client (not echoed to the caster)", ev("J.smokes.length") === sm0 + 1 && !!acA && acA.ag === "Omen" && acA.k === "e" && acA.o.length === 3 && !B5.box.slice(nB).some((m) => m.t === "ac" && m.i === om), JSON.stringify([oxz, sm0, ev("J.smokes.length"), acA]));
        const nA2 = A5.box.length, nB2 = B5.box.length; // Shrouded Step (C): never bought this match, so no charge (keep added sim time small: later timing-sensitive checks)
        B5.c.send({ t: "ab", k: "c", ag: "Omen", o: [oxz[0], 1.6, oxz[1]], d: [0, 0, -1], ts: 2 }); advance(20);
        mpOk("Ability: cast without a charge is refused (abn to the caster, no smoke, nothing relayed)", ev("J.smokes.length") === sm0 + 1 && B5.box.slice(nB2).some((m) => m.t === "abn" && m.k === "c") && !A5.box.slice(nA2).some((m) => m.t === "ac"), JSON.stringify(B5.box.slice(nB2).map((m) => m.t)));
        const nA3 = A5.box.length, nB3 = B5.box.length;
        const hf = ev(`(() => { const p0 = J.pick, o0 = J.on, h0 = player.hp; J.pick = "Phoenix"; J.on = true; player.hp = 100; J.e = 1; J.cd.e = 0; const n = J.orbs.length; jKey("KeyE"); const r = J.orbs.length - n; J.pick = p0; J.on = o0; player.hp = h0; return r; })()`); advance(20);
        const hA = A5.box.slice(nA3).find((m) => m.t === "ac" && m.i === 0), hB = B5.box.slice(nB3).find((m) => m.t === "ac" && m.i === 0);
        mpOk("Ability: host flash cast (Phoenix Curveball) is relayed to every client", hf === 1 && !!hA && !!hB && hA.ag === "Phoenix" && hA.k === "e" && hB.k === "e", JSON.stringify([hf, hA, hB]));
      }
      D.c.close(); advance(150);
      mpOk("Disconnect mid-round: that player's unit becomes a bot, round keeps running", ev(`(() => { const u = [].concat(bots, allies).find((x) => x.name === ${JSON.stringify(dN)}); return !!u && !u.hum && !u.nt && running && xMP.S.conns.size === 2; })()`) === true, ev("[running, xMP.S.conns.size]"));
      frames(60);
      mpOk("Online Unrated frames run clean after the disconnect", inGame());
    }
    phase = "mp5 host leave"; $("xPow").click(); advance(100);
    mpOk("Host leaving the Unrated room closes it", !S().on && !reg.has("valorstrike-priv-" + code5));
    // --- G: this game joins a scripted 5v5 host: buy menu sends requests, round state / spike HUD / banners applied ---
    toLobby(); phase = "mp5 client";
    const gp = new FPeer("valorstrike-priv-GHJKLM"), gin = []; let gc = null; gp.on("connection", (c) => { gc = c; c.on("data", (m) => gin.push(m)); }); advance(10);
    $("xOnCode").value = "GHJKLM"; $("xOnJoin").click(); advance(120);
    const ghi = gin.find((m) => m.t === "hi");
    if (gc && ghi) {
      gc.send({ t: "room", v: 1, code: "GHJKLM", pub: false, mode: "five", map: "ascent", st: "room", cd: 0, pl: [{ n: "Hosty", p: 0, h: 1 }, { n: ghi.n, p: 20, h: 0 }] }); advance(40);
      const row = (i, tm, n, ag, x, z, sq) => [i, tm, n, ag, x, 0, z, 0, 100, 0, 1, "Classic", i === 0 || i === 6 ? 1 : 0, 30, sq || 0];
      const AG = ["Phoenix", "Sage", "Jett", "Omen", "Viper", "Sova", "Reyna", "Cypher", "Killjoy", "Breach"];
      const ros = (sq) => AG.map((a, i) => i === 6 ? row(6, 1, ghi.n, "Reyna", 2, -40, sq) : row(i, i < 5 ? 0 : 1, i === 0 ? "Hosty" : "B" + i, a, i * 2 - 8, i < 5 ? 40 : -40));
      const crT1 = { B5: 800, B7: 800, B8: 800, B9: 800 }; crT1[ghi.n] = 800;
      const rs = (b, sp, me) => ({ t: "rs", b, tl: 100, sc: [0, 0], atk: 1, r: 1, sp, cr: Object.assign({}, crT1, { [ghi.n]: me }), me });
      gc.send({ t: "start", v: 1, mode: "five", map: "ascent", you: 6, team: 1, u: ros(0), k: {}, d: {}, rs: rs(30, ["carry", -1, 0, 0, 45, 0, 0, "", 0], 800), me: 800, ld: [null, "Classic"], atk: 1 }); advance(120);
      mpOk("Client builds the 5v5 from the host roster: own team as allies, defending, 800 credits, no local AI", inGame() && ev("MP.cl && MP.m5 && mode === 'five' && !FV.dm && allies.length === 4 && bots.length === 5 && [].concat(bots, allies).every((u) => u.nt) && !FV.atk && FV.cr === 800 && FV.buy > 0") === true, ev("[MP.cl, MP.m5, allies.length, bots.length, FV.atk, FV.cr, FV.buy]"));
      ev("buyMenu(true); true"); const gb = doc.querySelector('#xBG [data-n="Ghost"]'); if (gb) gb.click(); advance(60);
      const breq = gin.find((m) => m.t === "buy");
      mpOk("Client buy menu sends a buy request to the host (no local spend)", !!breq && breq.n === "Ghost" && ev("FV.cr === 800 && FV.sec === 'Classic'") === true, JSON.stringify(breq) + " " + !!gb);
      gc.send({ t: "bo", ok: 1, n: "Ghost", cr: 300, ld: [null, "Ghost"], a: 0, ab: { c: 0, q: 0, e: 1 } }); advance(60);
      mpOk("Host buy confirmation equips the gun and sets credits on the client", ev("FV.cr === 300 && FV.sec === 'Ghost' && rw === 'pis' && ammo === WEAP.Ghost.mag") === true, ev("[FV.cr, FV.sec, rw, ammo]"));
      gc.send(rs(0, ["plant", -1, -20, -21, 44, 0, 0, "A", 0], 300)); advance(60);
      gc.send({ t: "s", tl: 44, u: ros(0), k: {}, d: {}, ev: [["sp", "plant", "B1", "A"]] }); advance(60);
      mpOk("Spike state from the host: planted spike shown on the client (site A), plant event in the feed", ev("FV.sp.st === 'plant' && FV.sp.site === 'A' && fsM.visible && FV.buy === 0") === true && /planted the Spike/.test($("feed").textContent), ev("[FV.sp.st, FV.sp.site, fsM.visible, FV.buy]"));
      ev("player.x = -20; player.z = -21; keys.Digit4 = true; fiveTick(1 / 30); true"); advance(120); ev("fiveTick(1 / 30); true");
      const hin4 = gin.filter((m) => m.t === "in").pop();
      mpOk("Client defuse hold reaches the host (h4) and the defuse HUD shows", !!hin4 && hin4.h4 === 1 && /Defus/.test($("defuse").textContent), JSON.stringify(hin4) + " " + $("defuse").textContent);
      ev("keys.Digit4 = false; true");
      { const cs0 = ev("J.smokes.length"); gc.send({ t: "ac", i: 0, ag: "Omen", k: "e", o: [-8, 1.6, 40], d: [0, 0, -1], ts: 1 }); advance(40);
        mpOk("Ability: host-relayed smoke cast appears on the client (visual copy)", ev("J.smokes.length") === cs0 + 1, ev("J.smokes.length") + " vs " + cs0);
        const ng = gin.length; ev(`(() => { const p0 = J.pick, o0 = J.on; J.pick = "Jett"; J.on = true; J.c = 1; J.cd.c = 0; jKey("KeyC"); J.pick = p0; J.on = o0; return true; })()`); advance(40);
        const ab = gin.slice(ng).find((m) => m.t === "ab");
        mpOk("Ability: client cast sends agent, slot, eye, aim and time to the host", !!ab && ab.k === "c" && ab.ag === "Jett" && ab.o.length === 3 && ab.d.length === 3 && typeof ab.ts === "number", JSON.stringify(ab)); }
      gc.send({ t: "re", w: 0, tx: "Hosty... B6 defused the Spike", ti: "SPIKE DEFUSED", o: 0, sc: [0, 1], u: ros(0), k: {}, d: {}, me: 3000 }); advance(60);
      mpOk("Round end from the host: client scores the round for its team, credits updated, round frozen", ev("FV.you === 1 && FV.them === 0 && FV.cr === 3000 && !running") === true, ev("[FV.you, FV.them, FV.cr, running]"));
      gc.send({ t: "rd", ld: [null, "Ghost"], cr: 3000, b: 30, atk: 1 }); gc.send({ t: "s", tl: 100, u: ros(1), k: {}, d: {}, ev: [] }); advance(80);
      mpOk("Next round from the host: running again, buy phase, own unit back at spawn with its kept gun", ev("running && FV.buy > 0 && MP.sq === 1 && player.x === 2 && FV.sec === 'Ghost' && FV.pri === null && ammo === WEAP.Ghost.mag") === true, ev("[running, FV.buy, MP.sq, player.x, FV.sec, ammo]"));
      frames(60);
      gc.send({ t: "end", sc: [13, 5] }); advance(2500);
      mpOk("Match end from the host: result screen, Back to room", disp("result") === "flex" && S().st === "post", disp("result") + " " + S().st);
      $("lobbyBtn").onclick(); advance(60);
      gc.close(); advance(150);
    } else mpOk("5v5 client joined the scripted host", false, JSON.stringify(gin));
    gp.destroy();
    // --- E: PeerJS unavailable → clear message, nothing breaks; single player untouched ---
    win.__mpPeer = null; const oldPeer = win.Peer; win.Peer = undefined; toLobby(); phase = "mp no peerjs";
    $("xOnCreate").click(); advance(50); { const sc = doc.head.querySelectorAll("script").find((x) => /peerjs@1\.5\.4/.test(x.src)); if (sc && sc.onerror) sc.onerror(); } advance(50);
    mpOk("PeerJS blocked: Create shows a clear error and the lobby stays usable", /Couldn't load the online service/.test($("xOnMsg").textContent) && !S().on && !$("xOnCreate").disabled, $("xOnMsg").textContent);
    win.Peer = oldPeer;
    toLobby(); $("tdmBtn").click(); advance(1500); frames(60);
    mpOk("Single-player TDM after online play: no online state, 10 units with AI", inGame() && ev("!MP.on && !MP.cl && bots.length + allies.length === 9 && [].concat(bots, allies).every((u) => !u.nt && !u.hum)") === true);
    leave();
  } catch (e) { mpOk("online audit threw", false, String(e.stack || e)); }
  try { toLobby(); } catch (e) {}
}

// ---------- fid2: Valorant round timing, ult orbs, gunplay numbers ----------
if (!NO3) {
  const xe = vm.runInContext("__xe", context);
  const f2 = (label, code) => { let ok = false, err = []; try { const r = xe(`(() => { try { ${code} } catch (e) { return String(e.stack || e).slice(0, 300); } })()`); if (r === true) ok = true; else err.push(String(r)); } catch (e) { err.push(String(e).slice(0, 300)); } report.push({ label: "fid2: " + label, el: true, handler: true, cond: ok, pass: ok, errs: err }); return ok; };
  const go5 = 'window.xLdOn = false; FV.pick = "ascent"; FV.srOn = 0; FV.dm = false; FV.tdm = false; window.xSwift = false; startFive(); clearTimeout(FV.to); window.xLdOn = false;';
  const SRC_OK = ["s.pt >= 4", "prog = s.pt / 4", "s.t = 45", "s.dt >= 7", "s.dt = s.dt >= 3.5 ? 3.5 : 0", "over ? 2200 : 7000", "n >= 24", "s.cr = 5000", "? 45 : 30", "timeLeft = 100;"].every((t) => html.includes(t));
  f2("timing constants (buy 45 first round of each half / 30, round 100, plant 4, fuse 45 w/ beep 4/s <10 s 8/s <7 s, defuse 7 / half 3.5, post-round 7 s, 13 to win, OT 5000)", go5 + `
    const b0 = FV.buy, t0 = timeLeft; FV.you = 1; FV.them = 0; fRound(); clearTimeout(FV.to); const b1 = FV.buy; FV.you = 6; FV.them = 6; fRound(); clearTimeout(FV.to); const b12 = FV.buy;
    const ok = b0 === 45 && t0 === 100 && b1 === 30 && b12 === 45 && FIVE_WIN === 13 && ${SRC_OK} && xSpHz(5) === 8 && xSpHz(9) === 4 && xSpHz(30) < 2 && xSpHz(11) > xSpHz(40);
    return ok || JSON.stringify([b0, t0, b1, b12, FIVE_WIN]);`);
  f2("player plant progresses only while stationary; moving or firing resets it", go5 + `
    FV.buy = 0; player.hp = 100; running = true; paused = false; const s = FV.sp, k = Object.keys(SITES)[0]; s.st = "carry"; s.c = player; s.pt = 0; player.x = SITES[k][0]; player.z = SITES[k][1]; player.y = 0; player.vx = player.vz = 0; since = 1; keys.Digit4 = true;
    try { s.pt = 1; fiveTick(0.05); const a = s.pt; player.vx = 6; player.vz = 0; fiveTick(0.02); const b = s.pt; player.vx = player.vz = 0; fiveTick(0.05); s.pt = 1; since = 1; fiveTick(0.03); const c = s.pt; since = 0; fiveTick(0.02); const d = s.pt;
      return (a > 1 && b === 0 && c > 1 && d === 0) || JSON.stringify([a, b, c, d, s.st]); } finally { keys.Digit4 = false; }`);
  f2("half-defuse (3.5 s) persists after letting go; earlier progress resets", go5 + `
    FV.atk = false; fRound(); clearTimeout(FV.to); FV.buy = 0; player.hp = 100; running = true; paused = false; const s = FV.sp, k = Object.keys(SITES)[0]; player.x = SITES[k][0]; player.z = SITES[k][1]; player.vx = player.vz = 0;
    s.st = "plant"; s.t = 45; s.x = player.x; s.z = player.z; s.dt = 0; s.du = null; allies.forEach((a) => { a.alive = false; }); keys.Digit4 = true;
    try { fiveTick(0.05); const a = s.dt; keys.Digit4 = false; s.dt = 3.8; fiveTick(0.02); const b = s.dt; s.dt = 2; fiveTick(0.02); const c = s.dt;
      return (a > 0 && b === 3.5 && c === 0) || JSON.stringify([a, b, c, s.st]); } finally { keys.Digit4 = false; FV.atk = true; }`);
  // orb capture: stand on an orb and hold F for 3 s
  let orbOk = false, orbErr = [];
  try {
    const r0 = xe(`(() => { try { ${go5} FV.buy = 0; player.hp = 100; running = true; paused = false; J.on = true; J.ult = 0;
      const O = window.xOrbs; if (!O || O.length !== 2) return "no xOrbs"; const n = O.filter((o) => o.on).length; O[1].on = false; O[0].on = true; O[0].x = player.x; O[0].z = player.z; O[0].hold = 0;
      bots.forEach((b) => { b.xOrb = null; }); allies.forEach((b) => { b.xOrb = null; }); return n === 2 || "orbs on at round start: " + n; } catch (e) { return String(e.stack || e).slice(0, 300); } })()`);
    if (r0 !== true) orbErr.push(String(r0));
    advance(100); dispatch(win, mkEvent("keydown", { key: "f", code: "KeyF" }));
    xe("player.hp = 100; true"); advance(1600); xe("player.hp = 100; true"); advance(1700);
    dispatch(win, mkEvent("keyup", { key: "f", code: "KeyF" }));
    const r1 = xe("[J.ult, window.xOrbs[0].on, K().u]"); orbOk = r0 === true && r1[0] === 1 && r1[1] === false; if (!orbOk) orbErr.push(JSON.stringify(r1));
  } catch (e) { orbErr.push(String(e).slice(0, 300)); }
  report.push({ label: "fid2: 2 ult orbs spawn each round; holding F on one for 3 s grants +1 ult point and removes it", el: true, handler: true, cond: orbOk, pass: orbOk, errs: orbErr });
  f2("moving rifle spread >> standing (counter-strafe to 0 = accurate first shot)", `
    const s0 = { spray, ads, p: player }; try { player = { x: 0, z: 0, y: 0, hp: 100 }; spray = 0; ads = 0; xCU = 0; if (window.xAD) xAD.bs = 0;
      const st = gSpread("Vandal", WEAP.Vandal); Object.assign(player, { mv: true, sf: 1 }); const run = gSpread("Vandal", WEAP.Vandal); Object.assign(player, { mv: true, sf: 0.2 }); const cs = gSpread("Vandal", WEAP.Vandal);
      Object.assign(player, { mv: true, sf: 1 }); const smg = gSpread("Spectre", WEAP.Spectre);
      return (run > 10 * Math.max(st, 0.001) && run > 0.07 && cs <= st + 1e-9 && st > 0 && st < 0.006 && smg < run) || JSON.stringify([st, run, cs, smg]); } finally { spray = s0.spray; ads = s0.ads; player = s0.p; }`);
  f2("damage: Vandal head 160 at 40 m; Phantom head 156/140/124 by range; Sheriff 159 close; Guardian 195; Judge 12 pellets full-auto", `
    const d = [wDmg(WEAP.Vandal, "head", 40), wDmg(WEAP.Phantom, "head", 10), wDmg(WEAP.Phantom, "head", 20), wDmg(WEAP.Phantom, "head", 40), wDmg(WEAP.Sheriff, "head", 10), wDmg(WEAP.Guardian, "head", 30)];
    return (d.join() === "160,156,140,124,159,195" && WEAP.Judge.pel === 12 && !WEAP.Judge.semi && WEAP.Guardian.semi && XSZ.Operator[1] === 5) || JSON.stringify(d);`);
  f2("tagging: a rifle hit slows movement to 28% for 0.5 s", go5 + `
    FV.buy = 0; player.hp = 100; keys.KeyW = true; const sp = () => Math.hypot(player.vx || 0, player.vz || 0);
    try { player.vx = player.vz = 0; player.tagT = 0; for (let i = 0; i < 6; i++) moveP(0.05, 6.75, false); const v0 = sp(); player.x = 0; player.z = xSpawn(FV.map).atk;
      player.vx = player.vz = 0; xTag(player, 40); const tt = player.tagT, tk = player.tagK; for (let i = 0; i < 6; i++) moveP(0.05, 6.75, false); const v1 = sp(), left = player.tagT;
      return (tt === 0.5 && tk === 0.28 && v1 < v0 * 0.35 && v1 > 0 && left > 0) || JSON.stringify([v0, v1, tt, tk, left]); } finally { keys.KeyW = false; player.tagT = 0; }`);
  // Odin spin-up: the fire rate climbs over the first second of a spray
  let odOk = false, odErr = [];
  try { const a = xe("xSpL = -1e9; xRate(WEAP.Odin)"); let b = a; for (let i = 0; i < 12; i++) { advance(100); b = xe("xRate(WEAP.Odin)"); }
    odOk = typeof a === "number" && b > a + 2; if (!odOk) odErr.push(JSON.stringify([a, b])); } catch (e) { odErr.push(String(e).slice(0, 300)); }
  report.push({ label: "fid2: Odin spin-up raises the fire rate over a held spray", el: true, handler: true, cond: odOk, pass: odOk, errs: odErr });
  try { toLobby(); } catch (e) {}
}

// ---------- observer pass: death spectator, team side panels, kill emblem, round-end reasons, rotating minimap ----------
if (!NO3) {
  const xe = vm.runInContext("__xe", context);
  const OB = (label, f) => { phase = "obs " + label; const e0 = errors.length; let r; try { r = f(); } catch (e) { r = "threw: " + String((e && e.stack) || e).split("\n").slice(0, 2).join(" | ").slice(0, 300); }
    const errs = []; if (r !== true) errs.push(String(r).slice(0, 400)); errors.slice(e0).forEach((e) => errs.push(e.where + ": " + e.msg.slice(0, 200)));
    report.push({ label: "obs: " + label, el: true, handler: true, cond: r === true, pass: !errs.length, errs }); lastErr = errors.length; };
  const f5 = '(() => { FV.pick = "ascent"; FV.srOn = 0; FV.dm = false; FV.tdm = false; FV.esc = false; window.xSwift = false; startFive(); clearTimeout(FV.to); FV.buy = 0; FV.menu = false; player.hp = 100; paused = false; running = true; window.xLdOn = false; return true; })()';
  const start5 = () => { toLobby(); xe(f5); advance(60); return xe("mode === 'five' && running && allies.length === 4 && bots.length === 5"); };
  OB("spectator starts 2 s after death, follows a living teammate (first-person, their weapon / ammo / HP in the HUD) and cycles on left / right click and Space", () => {
    if (!start5()) return "5v5 did not start"; xe("xLob0 = false; xResOn = false; true"); frames(2); if (xe("xKL.p === player") !== true) return "death-flow state not bound to this round's player";
    xe('(() => { allies.forEach((a, i) => { a.hp = 100; a.alive = true; a.w = ["Phantom", "Vandal", "Spectre", "Sheriff"][i]; }); player.hp = 0; pDie(bots[0].name, "Vandal"); return true; })()');
    if (xe("player.hp") > 0) return "player not dead"; if (xe("xKL.on && !xKL.sp") !== true) return "killed-by card not up first";
    xe("xSpec(2.1); true"); if (xe("xKL.sp") !== true) return "spectator did not start after 2 s";
    const c0 = xe("xKL.cur && xKL.cur.name"); if (!c0) return "no teammate spectated"; if (!/^SPECTATING /.test(xe("xKL.sn.textContent"))) return "label: " + xe("xKL.sn.textContent");
    dispatch(win, mkEvent("mousedown", { button: 0 })); xe("xSpec(0.05); true"); const c1 = xe("xKL.cur.name"); if (c1 === c0) return "left click did not cycle";
    dispatch(win, mkEvent("mousedown", { button: 2 })); xe("xSpec(0.05); true"); if (xe("xKL.cur.name") !== c0) return "right click did not cycle back";
    dispatch(win, mkEvent("keydown", { code: "Space", key: " " })); dispatch(win, mkEvent("keyup", { code: "Space", key: " " })); xe("xSpec(0.05); true"); const c2 = xe("xKL.cur.name"); if (c2 === c0) return "Space did not cycle";
    if (!new RegExp(c2, "i").test(xe("xKL.sn.textContent"))) return "label not updated: " + xe("xKL.sn.textContent");
    xe("xHud(); true"); const w = xe("xKL.cur.w"); if ($("xWn").textContent !== w) return "HUD weapon " + $("xWn").textContent + " want " + w;
    if (String($("xMag").textContent) !== String(xe("WEAP[xKL.cur.w].mag"))) return "HUD ammo " + $("xMag").textContent; if ($("xHp").textContent !== "100") return "HUD hp " + $("xHp").textContent;
    xe("xLob0 = false; xResOn = false; true"); frames(3); if (xe("XOB.fp === xKL.cur && XOB.vy === XOB.fpY && XOB.orb === null") !== true) return "camera not on the teammate's eye / aim: " + xe("JSON.stringify([XOB.fp && XOB.fp.name, xKL.cur && xKL.cur.name, XOB.vy, XOB.fpY, XOB.orb])");
    xe("allies.forEach((a) => { a.alive = false; a.hp = 0; }); running = false; xLob0 = false; xResOn = false; xSpec(0.05); true"); /* round logic paused: the camera loop alone */ if (!/NO TEAMMATES ALIVE/.test(xe("xKL.sn.textContent"))) return "no-teammate label: " + xe("xKL.sn.textContent");
    frames(3); if (xe("!!XOB.orb && XOB.fp === null && Number.isFinite(XOB.orb.yw) && XOB.orb.y > 5") !== true) return "no orbit camera with every teammate dead: " + xe("JSON.stringify([xKL.sp, xResOn, xLob0, !!XOB.orb])");
    xe("running = false; fRound(); running = true; window.xLdOn = false; xLob0 = false; xResOn = false; true"); frames(3);
    if (xe("player.hp > 0 && !xKL.sp && XOB.fp === null && XOB.orb === null") !== true) return "next round did not return to own view: " + xe("JSON.stringify([player.hp, xKL.sp, xKL.on, xLob0, xResOn, paused, XNF])");
    return true; });
  OB("side panels: buy phase shows both teams, 5 rows each with agent square, name, weapon, HP + shield bar, ult pips; credits on own team only", () => {
    if (!start5()) return "5v5 did not start";
    xe("FV.buy = 20; running = true; player.hp = 100; player.armor = 50; xObsTick(true); true");
    if (!$("xObs").classList.contains("on")) return "panels not shown in buy phase";
    const cols = doc.querySelectorAll("#xObs .x-obc"); if (cols.length !== 2) return "columns " + cols.length; const bad = [];
    cols.forEach((c, ci) => { const rows = c.querySelectorAll(".x-obr").filter((r) => !r.hidden); if (rows.length !== 5) bad.push((ci ? "enemy" : "own") + " rows " + rows.length);
      rows.forEach((r) => { const hp = parseFloat(r.querySelector(".hp").style.width) || 0; if (ci === 0 && !(hp > 0)) bad.push("no hp bar " + r.querySelector(".x-obn").textContent); /* enemy bars / weapons are masked in the buy phase (obs2) */ if (!r.querySelector(".x-oba").textContent || !r.querySelector(".x-oba").style.background) bad.push("no agent square");
        if (ci === 0 && !r.querySelector(".x-obw").textContent) bad.push("no weapon"); if (!r.querySelectorAll(".x-obu i").length) bad.push("no ult pips");
        const cr = r.querySelector(".x-obcr").textContent; if (ci === 0 && !/^\d+$/.test(cr)) bad.push("own credits '" + cr + "'"); if (ci === 1 && cr) bad.push("enemy credits shown"); }); });
    const me = doc.querySelector("#xObs .x-obc.al .x-obr.me"); if (!me || !(parseFloat(me.querySelector(".sh").style.width) > 0)) bad.push("own shield segment missing");
    xe("FV.buy = 0; xObsTick(true); true"); if ($("xObs").classList.contains("on")) bad.push("panels still up after buy phase while alive");
    xe("player.hp = 0; pDie(bots[0].name, 'Vandal'); xSpec(2.1); xObsTick(true); true"); if (!$("xObs").classList.contains("on")) bad.push("panels not shown while spectating");
    return bad.length ? bad.slice(0, 5).join(" | ") : true; });
  OB("side panels: dead players' rows greyed with skull, ult-ready row flashes", () => {
    if (!start5()) return "5v5 did not start";
    xe("FV.buy = 20; running = true; const b = bots[1]; b.alive = false; b.hp = 0; allies[0].alive = false; allies[0].hp = 0; window.xBotUC[bots[2].name] = 99; xObsTick(true); true");
    const nb = xe("bots[1].name"), na = xe("allies[0].name"), nu = xe("bots[2].name"), row = (n) => doc.querySelectorAll("#xObs .x-obr").find((r) => r.querySelector(".x-obn").textContent === n);
    if (!row(nb) || !row(nb).classList.contains("dead")) return "dead enemy row not greyed"; if (!row(na) || !row(na).classList.contains("dead")) return "dead teammate row not greyed";
    if (row(nu).classList.contains("dead")) return "living row greyed"; if (!row(nu).querySelector(".x-obu").classList.contains("rdy")) return "ult-ready row not flashing";
    if (!/x-obr\.dead \.x-obk\{display:block/.test(html) || !/x-obr\.dead\{filter:grayscale/.test(html)) return "dead-row skull / greyscale CSS missing";
    return true; });
  OB("kill emblem: segment count builds per kill this round with a headshot marker, resets next round", () => {
    if (!start5()) return "5v5 did not start";
    xe("xKiReset(); kill(bots[0], false); true"); if (xe("XKI.n") !== 1 || xe("XKI.nb.textContent") !== "1") return "first kill: n " + xe("XKI.n");
    xe("kill(bots[1], true); true"); if (xe("XKI.n") !== 2 || xe("XKI.nb.textContent") !== "2") return "second kill: n " + xe("XKI.n");
    if (xe("XKI.sg.filter((g) => g.classList.contains('on')).length") !== 2) return "ring segments lit " + xe("XKI.sg.filter((g) => g.classList.contains('on')).length");
    if (xe("XKI.em.classList.contains('hs')") !== true) return "no headshot marker"; if (xe("XKI.el.classList.contains('on')") !== true) return "emblem not shown";
    xe("running = false; fRound(); running = true; true"); if (xe("XKI.n") !== 0 || xe("XKI.nb.textContent") !== "0" || xe("XKI.sg.some((g) => g.classList.contains('on'))")) return "not reset next round";
    return true; });
  OB("round end: ROUND WIN / ROUND LOSS, round number and team colour, reason line for each reason", () => {
    if (!start5()) return "5v5 did not start";
    const C = [[true, "Enemies eliminated", null, "ELIMINATION"], [false, "Attackers win", "SPIKE DETONATED", "SPIKE DETONATED"], [true, "Sage defused the Spike", "SPIKE DEFUSED", "SPIKE DEFUSED"], [false, "Time ran out before the plant", null, "TIME EXPIRED"], [false, "All defenders eliminated after the plant", null, "ELIMINATION"]], bad = [];
    C.forEach(([w, t, ti, want]) => { const r = JSON.parse(xe(`(() => { annClear(); annc.log = []; running = false; xRes(${w}, ${JSON.stringify(t)}, false, false, ${JSON.stringify(ti)}); const e = document.getElementById("xAnn"); return JSON.stringify({ t: annc.log[0], s: e.querySelector(".x-ans").textContent, c: e.className, n: xRes.h.length }); })()`));
      if (r.t !== (w ? "ROUND WIN" : "ROUND LOSS")) bad.push(want + " title " + r.t); if (r.s.indexOf(want) !== 0 && r.s.indexOf(" · " + want) < 0) bad.push(want + " reason '" + r.s + "'");
      if (r.s.indexOf("ROUND " + r.n) !== 0) bad.push("round number missing: " + r.s); if (!new RegExp("\\b" + (w ? "win" : "loss") + "\\b").test(r.c) || !/\brnd\b/.test(r.c)) bad.push("class " + r.c); });
    xe("annClear(); true"); return bad.length ? bad.slice(0, 5).join(" | ") : true; });
  OB("minimap: Rotate minimap in General (default on) rotates with the view yaw, off keeps it fixed, persisted in localStorage vs.minirot", () => {
    const cb = $("xMiniRot"); if (!cb || cb.closest("[data-sp]").dataset.sp !== "g") return "toggle missing from General"; if (!cb.checked || xe("XOB.mr") !== true) return "not on by default";
    const st = {}; win.__ls = { getItem: (k) => (k in st ? st[k] : null), setItem: (k, v) => { st[k] = String(v); }, removeItem: (k) => { delete st[k]; } };
    try { if (!start5()) return "5v5 did not start";
      const draw = (v) => xe(`(() => { XOB.vy = ${v}; minimap.d = 0; minimap(); return minimap.r; })()`); if (draw(1.25) !== 1.25) return "rotate on: minimap angle " + draw(1.25);
      cb.checked = false; dispatch(cb, mkEvent("change")); if (st["vs.minirot"] !== "0" || xe("XOB.mr") !== false) return "off not saved: " + st["vs.minirot"];
      if (draw(1.25) !== 0) return "rotate off: minimap still rotated";
      xe("XOB.mr = true; true"); if (xe("xMiniRotLoad()") !== false || cb.checked) return "reload did not restore off";
      cb.checked = true; dispatch(cb, mkEvent("change")); if (st["vs.minirot"] !== "1" || xe("xMiniRotLoad()") !== true) return "on not saved";
      return true; } finally { delete win.__ls; } });
  OB("ping: Z ping block runs inside the game scope (window.xPG exists) and a Z press in 5v5 places a marker", () => {
    const P = xe("window.xPG ? window.xPG.s.length : -1"); if (P !== 3) return "xPG pool missing: " + P;
    if (!start5()) return "5v5 did not start"; xe("FV.buy = 0; true");
    dispatch(win, mkEvent("keydown", { key: "z", code: "KeyZ" })); advance(30);
    const n = xe("window.xPG.s.filter((q) => q.on).length"); return n >= 1 || "no ping marker after Z: " + n; });
  OB("spectator hardening: first-person spectating hides the followed teammate's model (gun inside it), restores it on switch, third person and next round", () => {
    if (!start5()) return "5v5 did not start"; xe("xLob0 = false; xResOn = false; true"); frames(2);
    xe('(() => { window.__v0 = xVisB; window.__xr0 = [xResUp, xSetFull]; xResUp = () => false; xSetFull = () => false; /* the stub reads every screen as shown */ xVisB = function () {}; allies.forEach((a, i) => { a.hp = 100; a.alive = true; a.w = "Vandal"; a.xm = { m: { visible: true }, dead: 0, __fake: 1 }; }); player.hp = 0; pDie(bots[0].name, "Vandal"); xSpec(2.1); running = false; /* round logic paused: the camera loop alone */ return true; })()');
    try { const vis = () => JSON.parse(xe("JSON.stringify(allies.map((a) => a.xm ? a.xm.m.visible : null))"));
      xe("xLob0 = false; xResOn = false; xTP.on = false; true"); frames(2); const c0 = xe("allies.indexOf(xKL.cur)"); if (c0 < 0) return "no teammate spectated";
      let v = vis(); if (v[c0] !== false || v.filter((x) => x === false).length !== 1) return "followed model not the only hidden one: " + JSON.stringify(v) + " cur " + c0 + " fp " + xe("!!XOB.fp");
      dispatch(win, mkEvent("mousedown", { button: 0 })); xe("xLob0 = false; xResOn = false; true"); frames(2); const c1 = xe("allies.indexOf(xKL.cur)"); v = vis();
      if (c1 === c0 || v[c0] !== true || v[c1] !== false) return "switch did not move the hidden model: " + JSON.stringify([c0, c1, v]);
      xe("xTPToggle(); xLob0 = false; xResOn = false; true"); frames(2); v = vis(); if (v.some((x) => x === false) || xe("XOB.hm") !== null) return "third person still hides a model: " + JSON.stringify(v);
      xe("xTPToggle(); xLob0 = false; xResOn = false; true"); frames(2); v = vis(); if (v[c1] !== false) return "back to first person did not hide again: " + JSON.stringify(v);
      xe("allies[" + c1 + "].alive = false; allies[" + c1 + "].hp = 0; xLob0 = false; xResOn = false; true"); frames(2); v = vis(); if (v[c1] !== true) return "dead teammate's model (corpse) left hidden";
      xe("running = false; fRound(); running = true; window.xLdOn = false; xLob0 = false; xResOn = false; true"); frames(2);
      if (xe("XOB.hm === null && player.hp > 0") !== true) return "hidden model not cleared next round"; if (xe("[].concat(allies).every((a) => !a.xm || !a.xm.__fake || a.xm.m.visible !== false)") !== true) return "model left hidden after round end";
      return true; } finally { xe("xVisB = window.__v0; xResUp = window.__xr0[0]; xSetFull = window.__xr0[1]; allies.forEach((a) => { if (a.xm && a.xm.__fake) a.xm = null; }); xTP.on = false; true"); } });
  OB("spectator hardening: spike orbit camera is pulled in front of a wall between spike and camera, eases back out once clear, still faces the spike", () => {
    if (!start5()) return "5v5 did not start";
    const r = JSON.parse(xe(`(() => { const i0 = XLR.intersectObjects, b0 = xBoxHit, out = {}; try {
      xBoxHit = () => false; XLR.intersectObjects = () => []; XOBC.k = 1; let o = xObsOrbit(0.016); out.L = o.dist; out.free = Math.hypot(o.x - o.cx, o.y - 1, o.z - o.cz);
      XLR.intersectObjects = () => [{ distance: 6 }]; o = xObsOrbit(0.016); out.hit = o.dist; out.hd = Math.hypot(o.x - o.cx, o.y - 1, o.z - o.cz); out.yw = o.yw; out.want = Math.atan2(o.x - o.cx, o.z - o.cz); out.p = o.p;
      XLR.intersectObjects = () => []; xBoxHit = (a, b) => Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z) > 8; XOBC.k = 1; o = xObsOrbit(0.016); out.box = o.dist;
      xBoxHit = () => false; o = xObsOrbit(0.05); out.ease1 = o.dist; for (let i = 0; i < 40; i++) o = xObsOrbit(0.1); out.ease2 = o.dist; } finally { XLR.intersectObjects = i0; xBoxHit = b0; XOBC.k = 1; } return JSON.stringify(out); })()`));
    const bad = []; if (!(r.L > 15 && Math.abs(r.free - r.L) < 1e-6)) bad.push("free orbit distance " + r.L);
    if (!(Math.abs(r.hit - 5.5) < 1e-6 && Math.abs(r.hd - 5.5) < 1e-6)) bad.push("wall at 6 m: camera at " + r.hit + " (want 5.5, in front of the hit)");
    if (!(Math.abs(xe("xAng(" + r.yw + " - " + r.want + ")")) < 1e-6 && r.p < 0)) bad.push("not facing the spike after the pull-in");
    if (!(r.box > 7 && r.box < 8)) bad.push("box fallback: camera at " + r.box + " (box wall at 8 m)");
    if (!(r.ease1 > r.box && r.ease1 < r.L - 1)) bad.push("did not ease out gradually: " + r.ease1); if (!(Math.abs(r.ease2 - r.L) < 0.05)) bad.push("never returned to full orbit: " + r.ease2);
    return bad.length ? bad.join(" | ") : true; });
  OB("spectator hardening: enemy buys stay hidden in the buy phase (no weapon, shield, HP bar or credits), shown again once the round is live; own team credits only", () => {
    if (!start5()) return "5v5 did not start";
    xe("FV.buy = 20; running = true; player.hp = 100; bots.forEach((b) => { b.w = 'Vandal'; b.armor = 50; }); xObsTick(true); true"); const bad = [];
    const rows = (c) => doc.querySelectorAll("#xObs .x-obc." + c + " .x-obr").filter((r) => !r.hidden);
    rows("en").forEach((r) => { const n = r.querySelector(".x-obn").textContent; if (r.querySelector(".x-obw").textContent) bad.push("enemy weapon in buy " + n); if (parseFloat(r.querySelector(".sh").style.width) > 0) bad.push("enemy shield in buy " + n);
      if (parseFloat(r.querySelector(".hp").style.width) > 0 || !r.classList.contains("nohp")) bad.push("enemy HP bar in buy " + n); if (r.querySelector(".x-obcr").textContent) bad.push("enemy credits " + n); });
    rows("al").forEach((r) => { if (!/^\d+$/.test(r.querySelector(".x-obcr").textContent)) bad.push("ally credits missing " + r.querySelector(".x-obn").textContent); if (r.classList.contains("nohp")) bad.push("ally bar hidden"); });
    xe("FV.buy = 0; player.hp = 0; pDie(bots[0].name, 'Vandal'); xSpec(2.1); xObsTick(true); true");
    if (!$("xObs").classList.contains("on")) bad.push("panels not up while spectating");
    rows("en").forEach((r) => { if (r.classList.contains("dead")) return; if (!r.querySelector(".x-obw").textContent || r.classList.contains("nohp")) bad.push("enemy row still masked in the live round"); if (r.querySelector(".x-obcr").textContent) bad.push("enemy credits live"); });
    rows("al").forEach((r) => { if (r.querySelector(".x-obcr").textContent) bad.push("credits shown outside the buy phase"); });
    if (!/\.x-obr\.nohp \.x-obh\{visibility:hidden/.test(html)) bad.push("nohp CSS missing");
    return bad.length ? bad.slice(0, 5).join(" | ") : true; });
  OB("spectator hardening: leaving the match while dead clears the KILLED BY card, SPECTATING label and grey filter; location callout follows the spectated mate", () => {
    if (!start5()) return "5v5 did not start";
    xe("player.hp = 0; pDie(bots[0].name, 'Vandal'); true"); if (xe("xKL.on") !== true) return "death flow not started";
    xe("xSpec(2.1); true"); if (xe("xKL.sl.classList.contains('on')") !== true) return "SPECTATING label not shown";
    $("game").style.display = "none"; frames(2); const r = xe("JSON.stringify([xKL.on, xKL.sp, xKL.sl.classList.contains('on'), xKL.el.classList.contains('on'), XOB.hm])"); $("game").style.display = "block";
    if (r !== "[false,false,false,false,null]") return "stale spectator UI after leaving: " + r;
    if (!/xKL\.sp && xKL\.cur && xKL\.cur\.alive && xKL\.cur\.g \? xKL\.cur\.g\.position : player/.test(html)) return "callout still keyed to the third-person target only";
    return true; });
  OB("HUD layout: side panels clear minimap + callout (top-left) and 5-row kill feed + voice line (top-right) at 1920x1080 / 1366x768, compact under 820 px, hidden on short landscape; FPS readout clears the minimap; buy menu scrolls", () => {
    const bad = [], css = html, num = (re) => { const m = css.match(re); return m ? +m[1] : NaN; };
    const top = num(/\.x-obs\{position:fixed;left:0;right:0;top:max\((\d+)px,calc\(50% - 91px\)\)/); if (!(top > 0)) bad.push("panel top not max(px, centred)");
    const mmTop = num(/#xMap\{left:12px;top:(\d+)px/), mmH = num(/#xMap\{[^}]*height:(\d+)px/), callout = mmTop + mmH + 6 + 14; if (!(top >= callout + 8)) bad.push("panels " + top + " vs minimap + callout " + callout);
    const fwTop = num(/#game \.hud\.x-fw\{top:(\d+)px/), kfH = num(/#game #feed \.kf\{[^}]*height:(\d+)px/), feed = fwTop + 5 * kfH + 4 * 4 + 8 + 30; if (!(top >= feed)) bad.push("panels " + top + " vs kill feed + voice " + feed);
    [[1080, 1920], [768, 1366]].forEach(([h, w]) => { const t = Math.max(top, h / 2 - 91), b = t + 5 * 34 + 4 * 3; if (b > h - 16 - 64 - 8) bad.push(w + "x" + h + ": panels reach the bottom HUD"); if (2 * (w > 1366 ? 210 : 190) + 24 > w - 2 * 400) bad.push(w + ": panels too wide"); });
    if (!/@media \(max-width:1366px\)\{\.x-obc\{width:190px\}/.test(css)) bad.push("no 1366 width rule");
    const sm = css.match(/@media \(max-width:820px\)\{\.x-obs\{top:max\((\d+)px,calc\(50% - 70px\)\)[^\n]*\.x-obc\{width:(\d+)px/); if (!sm) bad.push("no compact <820 rule"); else { const ft = 48 + 5 * 24 + 16 + 8 + 30; if (+sm[1] < ft) bad.push("compact panels " + sm[1] + " vs mobile feed " + ft); }
    if (!/@media \(max-height:560px\)\{\.x-obs\.on\{display:none\}\}/.test(css)) bad.push("short-landscape hide missing");
    if (!/#game\.x-mm #fps\{left:184px\}/.test(css)) bad.push("FPS readout still under the minimap");
    if (!/@media \(max-width:700px\)\{#xMap\{left:8px;top:8px;width:112px;height:112px\}/.test(css)) bad.push("narrow minimap rule missing");
    if (!/#xBuy\{position:fixed;inset:0;[^}]*overflow:auto/.test(css)) bad.push("buy menu does not scroll");
    return bad.length ? bad.join(" | ") : true; });
  try { xe("annClear(); running = false; true"); toLobby(); } catch (e) {}
}

// ---------- bug sweep 2 ----------
if (!NO3) {
  const xe = vm.runInContext("__xe", context);
  const B2 = (label, f) => { phase = "bugs2 " + label; const e0 = errors.length; let r; try { r = f(); } catch (e) { r = "threw: " + String((e && e.stack) || e).split("\n").slice(0, 2).join(" | ").slice(0, 300); }
    const errs = []; if (r !== true) errs.push(String(r).slice(0, 400)); errors.slice(e0).forEach((e) => errs.push(e.where + ": " + e.msg.slice(0, 200)));
    report.push({ label: "bugs2: " + label, el: true, handler: true, cond: r === true, pass: !errs.length, errs }); lastErr = errors.length; lastX = xErrCalls.length; };
  const f5 = '(() => { FV.pick = "ascent"; FV.srOn = 0; FV.dm = false; FV.tdm = false; FV.esc = false; window.xSwift = false; startFive(); clearTimeout(FV.to); FV.buy = 0; FV.menu = false; player.hp = 100; paused = false; running = true; window.xLdOn = false; return true; })()';
  const start5 = () => { toLobby(); xe(f5); advance(60); xe("FV.buy = 0; FV.menu = false; player.hp = 100; running = true; paused = false; window.xLdOn = false; true"); return xe("mode === 'five' && running && allies.length === 4 && bots.length === 5"); };
  const key = (t, code, k, tr) => dispatch(win, mkEvent(t, { code, key: k || "", isTrusted: tr !== false }));
  B2("comms wheel runs in the game scope: holding Period in a live 5v5 opens the wheel, releasing closes it", () => {
    if (!start5()) return "5v5 did not start"; key("keydown", "Period", ".");
    if (!$("xCm").classList.contains("on")) return "wheel did not open (block could not see running / player)";
    key("keyup", "Period", "."); return !$("xCm").classList.contains("on") || "wheel did not close"; });
  B2("career record reads the game's scoreboard (kills / agent from SB and J, map from sbScore)", () => {
    const st = {}; win.__ls = { getItem: (k) => (k in st ? st[k] : null), setItem: (k, v) => { st[k] = String(v); }, removeItem: (k) => { delete st[k]; } };
    try { if (!start5()) return "5v5 did not start"; xe("SB.You.k = 7; SB.You.d = 3; SB.You.hs = 2; J.pick = 'Sova'; true");
      win.xCareerRec({ result: "win", mode: "five", score: "13 – 5" }); const H = JSON.parse(st["vs.career"] || "[]"), r = H[0] || {};
      if (r.k !== 7 || r.d !== 3) return "kills / deaths " + r.k + " / " + r.d; if (r.ag !== "Sova") return "agent " + r.ag; if (!r.mp || r.mp === "5v5") return "map " + r.mp; return true; }
    finally { delete win.__ls; xe("J.pick = 'Jett'; true"); } });
  B2("loading screen lists both rosters of the built match (window.xLdInfo bridge)", () => {
    if (!start5()) return "5v5 did not start"; const I = win.xLdInfo && win.xLdInfo(); if (!I || I.A.length !== 4 || I.B.length !== 5) return "xLdInfo " + JSON.stringify(I && [I.A.length, I.B.length]);
    win.xMatchLoad(() => {}, "ascent", "TEST", true); const nA = $("xLdA").querySelectorAll("li").length, nB = $("xLdB").querySelectorAll("li").length; advance(1500); xe("window.xLdOn = false; true");
    return (nA === 5 && nB === 5) || "tiles " + nA + " / " + nB; });
  B2("loading screen clears held keys and fire (bridge into the game scope)", () => {
    if (!start5()) return "5v5 did not start"; xe("keys.KeyW = true; fireHeld = true; true"); win.xMatchLoad(() => {}, "ascent", "TEST", true);
    const k = xe("JSON.stringify([!!keys.KeyW, fireHeld])"); advance(1500); xe("window.xLdOn = false; true"); return k === "[false,false]" || "still held " + k; });
  B2("Esc while a keybind row waits cancels the rebind and keeps the game paused", () => {
    if (!start5()) return "5v5 did not start"; xe("pause(); true"); advance(400); if (xe("paused") !== true) return "did not pause";
    const b = doc.querySelector('#xKb button[data-a="ping"]'); if (!b) return "no ping row"; b.click(); if (xe("xKbWait") !== "ping") return "row not waiting";
    key("keydown", "Escape", "Escape"); const r = xe("JSON.stringify([paused, xKbWait])"); xe("resume(); XS.keys = xKbDef(); xKbBuild(); true"); return r === "[true,null]" || "paused / wait " + r; });
  B2("a rebound action's old physical key is ignored by early capture handlers (buy moved B → N)", () => {
    if (!start5()) return "5v5 did not start"; xe("XS.keys.buy = 'KeyN'; xKbBuild(); FV.buy = 20; FV.menu = false; true");
    try { key("keydown", "KeyB", "b"); key("keyup", "KeyB", "b"); if (xe("FV.menu")) return "physical B still opened the buy menu";
      key("keydown", "KeyN", "n"); key("keyup", "KeyN", "n"); if (!xe("FV.menu")) return "N did not open the buy menu"; return true; }
    finally { xe("buyMenu(false); FV.buy = 0; XS.keys = xKbDef(); xKbBuild(); true"); } });
  B2("settings (sensitivity, difficulty) are saved to localStorage vs.set and loaded on start", () => {
    const st = {}; win.__ls = { getItem: (k) => (k in st ? st[k] : null), setItem: (k, v) => { st[k] = String(v); }, removeItem: (k) => { delete st[k]; } };
    try { const sl = $("sSens"); sl.value = "2.4"; dispatch(sl, mkEvent("input")); advance(20); const o = JSON.parse(st["vs.set"] || "{}"); if (o.sens !== 2.4) return "sens not saved: " + st["vs.set"];
      const hb = doc.querySelector('.seg[data-key="diff"] button[data-v="hard"]'); hb.click(); advance(20); if (JSON.parse(st["vs.set"]).diff !== "hard") return "difficulty not saved";
      doc.querySelector('.seg[data-key="diff"] button[data-v="normal"]').click(); sl.value = "1.6"; dispatch(sl, mkEvent("input"));
      return /localStorage\.getItem\(K\)/.test(html) || "no load path"; } finally { delete win.__ls; } });
  B2("leaving to the lobby with the buy menu open closes it (overlay is a child of body)", () => {
    if (!start5()) return "5v5 did not start"; xe("FV.buy = 20; buyMenu(true); pause(); true"); if (!$("xBuy").classList.contains("on")) return "menu not open";
    $("xHome").click(); advance(200); return (!$("xBuy").classList.contains("on") && xe("FV.menu") === false) || "buy overlay still up in the lobby"; });
  B2("leaving to the lobby while dead hides the KILLED BY card", () => {
    if (!start5()) return "5v5 did not start"; xe("player.hp = 0; pDie(bots[0].name, 'Vandal'); true"); advance(300); if (!xe("xKL.el.classList.contains('on')")) return "card not shown";
    xe("pause(); true"); $("xHome").click(); advance(500); return !xe("xKL.el.classList.contains('on')") || "kill card still up in the lobby"; });
  B2("touch FIRE in Aim Training fires the range gun (aimFire), not the bot-mode shoot()", () => {
    toLobby(); xe("startAim(); aimKey('Digit2'); running = true; paused = false; window.xLdOn = false; kSwing = 0; AM.cd = 0; AM.rl = 0; AM.ammo = 6; true"); advance(20); xe("running = true; paused = false; window.xLdOn = false; AM.cd = 0; AM.rl = 0; true"); if ($("xT").classList.contains("ed") && $("xTok")) $("xTok").click(); /* the earlier Arrange-buttons check leaves the layout editor open */ const sh0 = xe("AM.sh"), b = doc.querySelector('#xT .tb[data-k="fire"]'); if (!b) return "no touch fire button";
    dispatch(b, mkEvent("pointerdown", { pointerId: 7 })); dispatch(b, mkEvent("pointerup", { pointerId: 7 })); const sh1 = xe("AM.sh"); const st = xe("JSON.stringify([running, paused, !!window.xLdOn, mode, AM.cd, AM.rl, AM.ammo, aimW()])"); xe("AM.fire = false; true"); return sh1 > sh0 || "no shot (" + sh0 + " → " + sh1 + ") " + st; });
  B2("unit hitboxes share one capsule geometry (no per-round allocation), duel head material reused", () => {
    const r = xe("(() => { const n0 = XPGEO.size, a = mkGuy(0, 0, botMat, headMat), n1 = XPGEO.size, b = mkGuy(0, 0, botMat, headMat); scene.remove(a.g); scene.remove(b.g); return XPGEO.has('Capsule:0.4,1,4,10') && XPGEO.size === n1 && n1 - n0 <= 1; })()"); if (r !== true) return "capsule not from the shared geometry cache";
    if (/new THREE\.CapsuleGeometry\(0\.4, 1, 4, 10\)/.test(html)) return "a per-spawn CapsuleGeometry remains";
    toLobby(); xe("startDuel(); true"); const m1 = xe("duelSpawn.hm"); xe("duelSpawn(); true"); const m2 = xe("duelSpawn.hm"); xe("running = false; true");
    return (!!m1 && m1 === m2) || "duel head material re-allocated"; });
  B2("Team Deathmatch: the player's abilities work (J.on) and Q spends a charge", () => {
    toLobby(); xe("J.pick = 'Jett'; FV.pick = 'ascent'; startTDM(); window.xLdOn = false; true"); advance(100);
    if (xe("jOn()") !== true) return "abilities off in TDM"; const q0 = xe("J.q"); key("keydown", "KeyQ", "q"); key("keyup", "KeyQ", "q"); advance(50);
    const q1 = xe("J.q"); xe("running = false; true"); return q1 < q0 || "Q did nothing (" + q0 + " → " + q1 + ")"; });
  B2("picking up a gun / taking a free gun keeps the other slot's live mag", () => {
    if (!start5()) return "5v5 did not start"; xe("FV.pri = null; FV.sec = 'Classic'; rw = 'pis'; ammo = 3; rsv = 10; slots.pis = { ammo: 12, rsv: 36 }; xdArm('Vandal'); true");
    if (xe("slots.pis.ammo") !== 3 || xe("slots.pis.rsv") !== 10) return "pickup: sidearm mag " + xe("JSON.stringify(slots.pis)");
    xe("rw = 'pis'; ammo = slots.pis.ammo; rsv = slots.pis.rsv; ammo = 4; dmGive('Phantom'); true"); return xe("slots.pis.ammo") === 4 || "free gun: sidearm mag " + xe("JSON.stringify(slots.pis)"); });
  B2("resume with the buy menu still open keeps the cursor free (no pointer relock)", () => {
    if (!start5()) return "5v5 did not start"; xe("FV.buy = 20; buyMenu(true); pause(); true"); advance(400); doc.pointerLockElement = null;
    xe("resume(); true"); const ok = doc.pointerLockElement === null && xe("FV.menu") === true; xe("buyMenu(false); FV.buy = 0; true"); return ok || "pointer relocked under the open buy menu"; });
  B2("corpses / Lockdowns are cleared between 5v5 rounds (no Sage resurrection of a unit from an earlier round)", () => {
    if (!start5()) return "5v5 did not start"; xe("kill(bots[0], false); true"); if (!(xe("window.__xDead.length") > 0)) return "no corpse recorded";
    xe("running = false; fRound(); running = true; window.xLdOn = false; true"); return xe("window.__xDead.length") === 0 || "corpses carried into the next round: " + xe("window.__xDead.length"); });
  B2("floor guns from a 5v5 do not carry into the lobby / the next mode (DM, Surf, Aim, Duel)", () => {
    if (!start5()) return "5v5 did not start"; xe("xdDrop('Vandal', player.x + 3, player.z); true"); if (!(xe("window.__xd.L.length") > 0)) return "no floor gun dropped";
    $("lobbyBtn").onclick(); advance(50); if (xe("window.__xd.L.length") !== 0) return "floor gun left after lobby: " + xe("window.__xd.L.length");
    if (!start5()) return "5v5 did not restart"; xe("xdDrop('Vandal', player.x + 3, player.z); FV.pick = 'ascent'; startTDM(); window.xLdOn = false; true"); advance(50);
    const n = xe("window.__xd.L.length"); xe("running = false; true"); return n === 0 || "floor gun carried into TDM: " + n; });
  try { xe("annClear(); running = false; true"); toLobby(); } catch (e) {}
}

// ---------- feel3: Valorant reference tables (weapons, reload, equip, crosshair / hit-feedback defaults, audio cues, kits) ----------
{
  const FE = (label, f) => { phase = "feel3 " + label; const e0 = errors.length; let r; try { r = f(); } catch (e) { r = "threw: " + String((e && e.stack) || e).split("\n").slice(0, 2).join(" | ").slice(0, 300); }
    const ok = r === true && errors.length === e0; report.push({ label: "feel3: " + label, el: true, handler: true, cond: ok, pass: ok, errs: ok ? [] : [r === true ? "errors: " + errors.slice(e0).map((e) => e.msg).join(" ; ").slice(0, 300) : String(r)] }); };
  const xe = vm.runInContext("__xe", context);
  FE("weapon table: mags, body/head damage and reload times match Valorant", () => {
    const MAGS = { Vandal: 25, Phantom: 30, Spectre: 30, Classic: 12, Ghost: 13, Sheriff: 6, Operator: 5, Marshal: 5, Judge: 7, Bucky: 5, Ares: 50, Odin: 100, Guardian: 12, Bulldog: 24, Stinger: 20, Frenzy: 13, Shorty: 2, Outlaw: 2 };
    const DMG = { Vandal: [40, 160], Phantom: [39, 156], Sheriff: [55, 159], Classic: [26, 78], Ghost: [30, 105], Operator: [150, 255], Guardian: [65, 195], Spectre: [26, 78], Odin: [38, 95] };
    const RLD = { Vandal: 2.5, Phantom: 2.5, Spectre: 2.25, Sheriff: 2.25, Classic: 1.75, Operator: 3.7, Odin: 5 };
    const W = JSON.parse(xe("JSON.stringify(WEAP)")), bad = [];
    for (const n in MAGS) if (!W[n] || W[n].mag !== MAGS[n]) bad.push(n + " mag " + (W[n] && W[n].mag) + " want " + MAGS[n]);
    for (const n in DMG) if (!W[n] || W[n].body !== DMG[n][0] || W[n].head !== DMG[n][1]) bad.push(n + " dmg " + (W[n] && W[n].body + "/" + W[n].head) + " want " + DMG[n].join("/"));
    for (const n in DMG) if (W[n] && W[n].legs != null && Math.abs(W[n].legs / W[n].body - 0.85) > 0.1) bad.push(n + " legs " + W[n].legs + " not ~0.85x body");
    for (const n in RLD) if (!W[n] || W[n].rld !== RLD[n]) bad.push(n + " reload " + (W[n] && W[n].rld) + " want " + RLD[n]);
    if (W.Vandal.ff) bad.push("Vandal has falloff"); if (!(W.Phantom.ff && xe('wDmg(WEAP.Phantom, "body", 10)') === 39 && xe('wDmg(WEAP.Phantom, "body", 20)') < 39)) bad.push("Phantom falloff past 15 m");
    if (xe('wDmg(WEAP.Vandal, "head", 45)') !== 160) bad.push("Vandal head at 45 m " + xe('wDmg(WEAP.Vandal, "head", 45)'));
    if (xe("OP_RELOAD") !== 3.7) bad.push("duel Operator reload " + xe("OP_RELOAD"));
    return bad.length ? bad.slice(0, 6).join(" | ") : true; });
  FE("reload uses the held gun's time (Classic 1.75 s, Sheriff 2.25 s, Vandal 2.5 s); equip Vandal 1.0, Operator 1.25, Sheriff 0.75 s", () => {
    const r = xe(`(() => { const m0 = mode, rw0 = rw, w0 = S.weapon; try { mode = "x"; rw = "pis"; const c = xRT(); rw = "pri"; S.weapon = "Vandal"; const v = xRT(); S.weapon = "Operator"; const o = xRT(); return JSON.stringify([c, v, o, xEq("Vandal"), xEq("Operator"), xEq("Sheriff")]); } finally { mode = m0; rw = rw0; S.weapon = w0; } })()`);
    return r === JSON.stringify([1.75, 2.5, 3.7, 1, 1.25, 0.75]) || "xRT/xEq " + r; });
  FE("movement: knife 6.75 m/s run, walk x0.6 (silent), crouch x0.45, jump apex ~1 m, rifles 5.4 m/s", () => {
    if (Math.abs(xe("6.75 * vRunK('Vandal')") - 5.4) > 0.01) return "rifle run " + xe("6.75 * vRunK('Vandal')"); if (xe("vRunK('knife')") !== 1) return "knife not full speed";
    const src = html; if (!/sp = \(cr \? 0\.45 : wk \? 0\.6 : 1\)/.test(src)) return "walk / crouch multipliers changed"; if (!/if \(P\.mv && gr && !cr && !wk\)/.test(src)) return "footsteps not gated to running";
    const apex = 6.6 * 6.6 / (2 * 22); return apex > 0.9 && apex < 1.1 || "jump apex " + apex; });
  FE("feedback defaults: hit marker and damage numbers off (settings toggles exist), crosshair firing / movement error off", () => {
    if (!/weapon: "Vandal", hm: false, dn: false \}/.test(html)) return "hm/dn not off in the S defaults"; // earlier checks click every .seg button, so read the shipped default from source
    if (!/data-key="hm"><button data-v="0" class="on">/.test(html) || !/data-key="dn"><button data-v="0" class="on">/.test(html)) return "toggles not Off by default";
    xe("S.hm = false; S.dn = false; true");
    if (!doc.querySelector('.seg[data-key="hm"]') || !doc.querySelector('.seg[data-key="dn"]')) return "toggles missing";
    if (!/off: 10 \}, me: false, fe: false \}/.test(html)) return "error lines default on";
    const r = xe(`(() => { const hm = document.getElementById("xHm"); hm.classList.remove("on"); vmHit(new THREE.Vector3(0, 1, -5), 40, false, false); const off = hm.classList.contains("on"); S.hm = true; vmHit(new THREE.Vector3(0, 1, -5), 40, false, false); const on = hm.classList.contains("on"); S.hm = false; hm.classList.remove("on"); return JSON.stringify([off, on]); })()`);
    return r === "[false,true]" || "hit marker off/on " + r; });
  FE("audio: spike cadence speeds up (faster in last 10 s), low-time tick, round-start stinger, half-defuse chime exist", () => {
    const h = [45, 20, 9, 5].map((f) => xe("xSpHz(" + f + ")")); if (!(h[0] < h[1] && h[1] < h[2] && h[2] < h[3])) return "cadence " + h.join(",");
    for (const k of ["lowT", "roundStart", "defHalf", "plantBeep", "whir", "stinger"]) if (xe("typeof SFX." + k) !== "function") return "SFX." + k + " missing";
    if (!/SFX\.roundStart\(\)/.test(html) || !/SFX\.lowT\(/.test(html) || !/SFX\.defHalf\(\)/.test(html)) return "cue not wired"; return true; });
  FE("kits: 4 abilities each, Cypher Trapwire 2 charges / 200, Neural Theft 7 points", () => {
    const K = JSON.parse(xe("JSON.stringify(KITS)")), bad = [];
    for (const a in K) { if (!K[a].n || K[a].n.length !== 4) bad.push(a + " has " + (K[a].n && K[a].n.length) + " abilities"); if (!(K[a].u >= 6 && K[a].u <= 9)) bad.push(a + " ult " + K[a].u); }
    const C = K.Cypher; if (C.mx.c !== 2 || C.u !== 7 || !C.buy.some((b) => b[0] === "c" && b[2] === 200)) bad.push("Cypher " + JSON.stringify([C.mx, C.u]));
    return bad.length ? bad.join(" | ") : true; });
  FE("kits: names, max charges, credit cost per charge and ult points match current Valorant (valorant.fandom.com, Oct 2026); Ghost mag 13", () => {
    // [C, Q, E, X] names · max charges {c,q,e} · buy [[slot, cost]] · ult points. E (signature) = 1 free per round; listed E costs buy the extra charge.
    const V = {
      Jett: [["Cloudburst", "Updraft", "Tailwind", "Blade Storm"], { c: 2, q: 1 }, [["c", 200], ["q", 150]], 8],
      Phoenix: [["Blaze", "Hot Hands", "Curveball", "Run It Back"], { c: 1, q: 1, e: 2 }, [["c", 150], ["q", 200], ["e", 250]], 6],
      Sova: [["Owl Drone", "Shock Bolt", "Recon Bolt", "Hunter's Fury"], { c: 1, q: 2 }, [["c", 400], ["q", 150]], 8],
      Sage: [["Barrier Orb", "Slow Orb", "Healing Orb", "Resurrection"], { c: 1, q: 2 }, [["c", 300], ["q", 200]], 7],
      Reyna: [["Leer", "Devour", "Dismiss", "Empress"], { c: 2, q: 2 }, [["c", 250], ["q", 200]], 7],
      Omen: [["Shrouded Step", "Paranoia", "Dark Cover", "From the Shadows"], { c: 2, q: 1, e: 2 }, [["c", 100], ["q", 250], ["e", 150]], 7],
      Killjoy: [["Nanoswarm", "Alarmbot", "Turret", "Lockdown"], { c: 2, q: 1 }, [["c", 200], ["q", 200]], 9],
      Raze: [["Boom Bot", "Blast Pack", "Paint Shells", "Showstopper"], { c: 1, q: 2 }, [["c", 300], ["q", 200]], 8],
      Skye: [["Regrowth", "Trailblazer", "Guiding Light", "Seekers"], { c: 1, q: 1, e: 2 }, [["c", 150], ["q", 300], ["e", 250]], 8],
      Breach: [["Aftershock", "Flashpoint", "Fault Line", "Rolling Thunder"], { c: 1, q: 2 }, [["c", 200], ["q", 250]], 8],
      Cypher: [["Trapwire", "Cyber Cage", "Spycam", "Neural Theft"], { c: 2, q: 2 }, [["c", 200], ["q", 100]], 7],
      Chamber: [["Trademark", "Headhunter", "Rendezvous", "Tour De Force"], { c: 1, q: 8 }, [["c", 200], ["q", 100]], 8] };
    const K = JSON.parse(xe("JSON.stringify(KITS)")), bad = [];
    for (const a in V) { const k = K[a], [n, mx, buy, u] = V[a]; if (!k) { bad.push(a + " missing"); continue; }
      if (JSON.stringify(k.n) !== JSON.stringify(n)) bad.push(a + " names " + k.n.join("/"));
      for (const s of ["c", "q", "e"]) if ((k.mx[s] || 0) !== (mx[s] || 0)) bad.push(a + " max " + s + " " + k.mx[s]);
      if (JSON.stringify(k.buy.map((b) => [b[0], b[2]])) !== JSON.stringify(buy)) bad.push(a + " buy " + JSON.stringify(k.buy.map((b) => [b[0], b[2]])));
      if (k.u !== u) bad.push(a + " ult " + k.u + " (want " + u + ")");
      if (!k.r.includes("C " + n[0]) || !k.r.includes("Q " + n[1]) || !k.r.includes("E " + n[2]) || !k.r.includes("X " + n[3])) bad.push(a + " role line keys " + k.r); }
    if (xe("WEAP.Ghost.mag") !== 13) bad.push("Ghost mag " + xe("WEAP.Ghost.mag"));
    return bad.length ? bad.join(" | ") : true; });
  FE("kits: signature charges (1 free per round, bought extra carries), Reyna Dismiss blocks damage, Devour overheals, Phoenix Q = Hot Hands / E = Curveball", () => {
    const r = xe(`(() => { const out = [], m0 = mode, o0 = { pick: J.pick, on: J.on }; try {
      mode = "five"; J.on = true; FV.buy = 0; running = true; player.hp = 100;
      J.pick = "Omen"; J.e = 0; jRound(true); if (J.e !== 1) out.push("Omen match-start Dark Cover " + J.e);
      J.e = 2; jRound(false); if (J.e !== 2) out.push("Omen bought Dark Cover lost " + J.e);
      J.pick = "Reyna"; J.q = 0; jRound(false); if (J.q !== 1) out.push("Reyna free signature " + J.q);
      J.pick = "Killjoy"; J.q = 0; jRound(false); if (J.q !== 0) out.push("Killjoy Alarmbot free " + J.q);
      J.pick = "Reyna"; J.dis = 1.5; player.hp = 100; hurt(player, 40); if (player.hp !== 100) out.push("Dismiss took damage " + player.hp); J.dis = 0;
      J.so.push({ m: new THREE.Object3D(), p: { x: player.x, y: 0.5, z: player.z }, t: 3 }); J.q = 1; J.emp = 0; player.hp = 100; jKey("KeyQ"); for (let i = 0; i < 40; i++) sgTick(0.1); if (!(player.hp > 140)) out.push("Devour no overheal " + player.hp); if (J.q !== 0) out.push("Devour charge " + J.q);
      for (let i = 0; i < 80; i++) sgTick(0.1); if (player.hp > 100) out.push("overheal did not expire " + player.hp); player.hp = 100;
      J.pick = "Phoenix"; J.q = 1; J.e = 2; J.cd = { c: 0, q: 0, e: 0, x: 0 }; const z0 = J.zones.length, o1 = J.orbs.length; jKey("KeyQ"); jKey("KeyE");
      if (J.zones.length !== z0 + 1 || J.q !== 0) out.push("Phoenix Q not Hot Hands"); if (J.orbs.length !== o1 + 1 || J.e !== 1) out.push("Phoenix E not Curveball");
      J.e = 0; J.tk = 0; jKill(); jKill(); if (J.e !== 1) out.push("Curveball 2-kill recharge " + J.e);
      J.pick = "Jett"; J.c = 2; J.q = 1; J.cd = { c: 0, q: 0, e: 0, x: 0 }; const s0 = J.smokes.length; jKey("KeyC"); if (J.smokes.length !== s0 + 1) out.push("Jett C not Cloudburst"); jKey("KeyQ"); if (J.q !== 0) out.push("Jett Q not Updraft");
    } catch (e) { out.push(String(e.stack || e).slice(0, 200)); } finally { try { jClear(); } catch (e) {} mode = m0; J.pick = o0.pick; J.on = o0.on; player.hp = 100; }
    return out.length ? out.join(" | ") : true; })()`);
    return r; });
  try { xe("running = false; true"); toLobby(); } catch (e) {}
}

// ---------- spawn-to-spawn sightlines: no straight line at eye level from anywhere in attacker spawn to defender spawn, every 5v5 map ----------
if (!NO3) {
  let R = null, err = [];
  try { R = JSON.parse(vm.runInContext("__xe", context)(`(() => { const out = []; if (!FMAP.ascent || !FMAP.ascent.boxes.length) ensureMapBuilt("five");
    for (const k of ["ascent", "bind", "haven", "split", "lotus", "breeze"]) { if (k !== "ascent") xBuildMap(k);
      const bx = FMAP[k].boxes, sp = xSpawn(k), wall = bx.filter((b) => BH(b) >= 1.8), bad = []; /* anything 1.8 m+ hides a standing head */
      const hit = (ax, az, cx, cz, b) => { let t0 = 0, t1 = 1; for (const [o, d, l, h] of [[ax, cx - ax, b.x1, b.x2], [az, cz - az, b.z1, b.z2]]) { if (Math.abs(d) < 1e-9) { if (o < l || o > h) return false; continue; } let s = (l - o) / d, e = (h - o) / d; if (s > e) [s, e] = [e, s]; t0 = Math.max(t0, s); t1 = Math.min(t1, e); if (t0 > t1) return false; } return true; };
      const inC = (x, z) => bx.some((b) => BH(b) > 0.3 && x > b.x1 - 0.4 && x < b.x2 + 0.4 && z > b.z1 - 0.4 && z < b.z2 + 0.4);
      const real = []; for (let x = -8; x <= 8; x += 4) real.push([x, sp.atk], [x, -sp.atk], [x, sp.def != null ? sp.def : -sp.atk]); /* fSpawn / fRound points */
      real.forEach(([x, z]) => { if (inC(x, z)) bad.push("spawn point (" + x + "," + z + ") inside a collider"); });
      const A = [], D = []; for (let x = -10; x <= 10; x++) for (const dz of [-2, 0, 2]) { if (!inC(x, sp.atk + dz)) A.push([x, sp.atk + dz]); if (!inC(x, -sp.atk + dz)) D.push([x, -sp.atk + dz]); } /* the whole spawn pad, not just the 5 points */
      let open = 0; A.forEach((a) => D.forEach((d) => { if ([-0.3, 0, 0.3].some((p) => [-0.3, 0, 0.3].some((q) => !wall.some((b) => hit(a[0] + p, a[1], d[0] + q, d[1], b))))) { open++; if (open <= 3) bad.push("open line " + a.join(",") + " -> " + d.join(",")); } }));
      out.push({ k, n: A.length * D.length, open, bad }); }
    return JSON.stringify(out); })()`)); } catch (e) { err.push(String(e).slice(0, 300)); }
  for (const m of R || []) { const ok = !m.bad.length; report.push({ label: `Spawn sightlines ${m.k}: no attacker-spawn -> defender-spawn line of sight (${m.n} pad pairs, 0.3 m body offsets, ${m.open} open), spawn points clear of colliders`, el: true, handler: true, cond: ok, pass: ok, errs: m.bad.slice(0, 5) }); }
  if (!R) report.push({ label: "Spawn sightlines audit", el: true, handler: true, pass: false, cond: false, errs: err });
}

// ---------- Retake + Operator Duel arenas visual rebuild: themed materials, site letter + plant paint, cover at player scale, colliders match visuals, spawns clear, lanes walkable ----------
if (!NO3) {
  let R = null, err = [];
  try { R = JSON.parse(vm.runInContext("__xe", context)(`(() => { const out = [];
    const SP = { retake: [[0, 17], [-1.5, 16], [1.5, 16], [-12, -15], [0, -16], [12, -12]], duel: [[-3, 14], [0, 14], [3, 14], [-3, -14], [0, -14], [3, -14], [-1.5, 13.5], [1.5, 13.5], [-1.5, -13.5], [1.5, -13.5]] };
    for (const k of ["retake", "duel"]) { const M = MAPS[k], V = ASC_VIS[k], bx = M.boxes, bad = [];
      if (!(V.mats >= 3)) bad.push("only " + V.mats + " themed materials created");
      if (!(V.adds > 0 && V.adds <= 400)) bad.push("meshes added " + V.adds + " (budget 400)");
      if (M.solids.some((m) => m.material === XM.wall || m.material === XM.tile || m.material === XM.wood || m.material === XM.metal)) bad.push("untextured default material left on a solid");
      if (!M.g.children.some((m) => m.name === "xDeco" && m.onBeforeRender && m.onBeforeRender !== THREE.Object3D.prototype.onBeforeRender)) bad.push("no per-mode fog hook");
      if (k === "retake") { if (!V.letters.some((l) => l.ch === "B" && l.at === "wall")) bad.push("no wall site letter"); if (!V.letters.some((l) => l.ch === "B" && l.at === "floor")) bad.push("no floor site letter");
        if (!V.zones.some((z) => z.x === 0 && z.z === 0)) bad.push("no plant-zone paint around the spike"); if (!(V.ceil >= 2)) bad.push("ceilings " + V.ceil); }
      else if (V.letters.length < 2) bad.push("duel end-wall markers missing");
      if (!(V.crates >= 6)) bad.push("only " + V.crates + " crate props");
      const posOK = M.solids.some((m) => m.position && typeof m.position.x === "number"); // the THREE stub does not track positions; REAL3 runs check placement
      if (bx.filter((b) => b.vA || b.crate).length > M.solids.length) bad.push("more prop colliders than solid meshes");
      bx.forEach((b) => { const sz = Math.max(b.x2 - b.x1, b.z2 - b.z1), cx = (b.x1 + b.x2) / 2, cz = (b.z1 + b.z2) / 2;
        if (b.h < 4 && sz <= 3.5 && !(b.h >= 1 && b.h <= 3.2)) bad.push("cover " + b.h + " m tall at " + cx.toFixed(1) + "," + cz.toFixed(1));
        if (posOK && (b.vA || b.crate) && !M.solids.some((m) => m.position && m.position.x > b.x1 - 0.05 && m.position.x < b.x2 + 0.05 && m.position.z > b.z1 - 0.05 && m.position.z < b.z2 + 0.05 && m.position.y > 0)) bad.push("collider without a bullet-stopping mesh at " + cx.toFixed(1) + "," + cz.toFixed(1)); });
      const hit = (x, z, r) => bx.some((b) => b.h > 0.5 && x > b.x1 - r && x < b.x2 + r && z > b.z1 - r && z < b.z2 + r);
      SP[k].forEach(([x, z]) => { if (hit(x, z, 0.45)) bad.push("spawn (" + x + "," + z + ") inside a collider"); });
      const H = k === "retake" ? 19.5 : 9.5, D = k === "retake" ? 19.5 : 15.5, st = 0.5, key = (x, z) => x + "," + z, seen = new Set(), q = [[0, k === "retake" ? 17 : 14]];
      seen.add(key(q[0][0], q[0][1]));
      while (q.length) { const [x, z] = q.pop(); for (const [dx, dz] of [[st, 0], [-st, 0], [0, st], [0, -st]]) { const nx = x + dx, nz = z + dz, kk = key(nx, nz); if (seen.has(kk) || Math.abs(nx) > H - 0.45 || Math.abs(nz) > D - 0.45 || hit(nx, nz, 0.4)) continue; seen.add(kk); q.push([nx, nz]); } }
      SP[k].forEach(([x, z]) => { const gx = Math.round(x / st) * st, gz = Math.round(z / st) * st; if (!seen.has(key(gx, gz))) bad.push("spawn (" + x + "," + z + ") not walkable from the first spawn"); });
      if (k === "retake" && !seen.has(key(0, 2))) bad.push("spike not reachable");
      out.push({ k, mats: V.mats, adds: V.adds, crates: V.crates, n: bx.length, bad }); }
    return JSON.stringify(out); })()`)); } catch (e) { err.push(String(e.stack || e).slice(0, 400)); }
  for (const m of R || []) report.push({ label: `Retake/Duel visual ${m.k}: ${m.mats} themed materials, ${m.adds} meshes added (<= 400), ${m.crates} crate props, ${m.n} colliders, every prop collider with a bullet-stopping mesh, cover 1-3.2 m, fog hook, spawns clear and walkable`, el: true, handler: true, cond: !m.bad.length, pass: !m.bad.length, errs: m.bad });
  if (!R || R.length !== 2) report.push({ label: "Retake/Duel visual audit", el: true, handler: true, pass: false, cond: false, errs: err });
}

// ---------- lobby polish (real-browser QA of the lobby) ----------
{
  const LP = (label, fn) => { let r; try { r = fn(); } catch (e) { r = String((e && e.stack) || e).split("\n")[0]; } report.push({ label: "lobby polish: " + label, el: true, handler: true, pass: r === true, cond: r === true, errs: r === true ? [] : [String(r)] }); };
  const css = (sel) => { const m = html.match(new RegExp(sel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\{([^}]*)\\}")); return m ? m[1] : ""; };
  const xe = NO3 ? null : vm.runInContext("__xe", context);
  LP("engine error shows Retry + a WebGL diagnostic line, sentence-case body; Retry relaunches the same mode", () => {
    toLobby(); if (xe) xe("xReady = false; true");
    try { $("dmBtn").click(); advance(30);
      if (!failMsg()) return "error overlay not shown"; if ($("xRetry").hidden) return "no Retry button"; const d = $("xGlDiag");
      if (d.hidden || !/^WebGL2: (yes|no) · WebGL: (yes|no) · reason: \S/.test(d.textContent)) return "diagnostic line '" + d.textContent + "'";
      if (!$("result").classList.contains("x-glerr") || !/text-transform:none/.test(css("#result.x-glerr p"))) return "body text not sentence case";
    } finally { if (xe) xe("xReady = true; true"); }
    $("xRetry").click(); advance(60);
    if (disp("result") !== "none" || !$("xRetry").hidden || $("result").classList.contains("x-glerr")) return "overlay not cleared by Retry";
    if (xe && !inGame()) return "Retry did not start Deathmatch"; toLobby(); return true; });
  LP("renderer creation retries once with low settings before the error", () => /catch \(e\) \{ xGlErr[^\n]*\n\s*try \{ renderer = new THREE\.WebGLRenderer\(\{ antialias: false, powerPreference: "default", failIfMajorPerformanceCaveat: false, precision: "mediump"/.test(html) || "fallback renderer attempt missing");
  LP("Play panel mode description wraps to 2 lines (no single-line ellipsis)", () => { const c = css(".x-q .x-qcard p"); return (/white-space:normal/.test(c) && /line-clamp:2/.test(c) && !/text-overflow:ellipsis/.test(c)) || c; });
  LP("helper text (map caption, peer-to-peer line, NAME label, mode captions) uses #c9cdd2", () => { const bad = [".x-qmaps>p", ".x-qon__h small", ".x-qon__nm", ".x-q .x-qcard small"].filter((s) => !/color:#c9cdd2/.test(css(s)) || /opacity:\.[0-7]/.test(css(s))); return bad.length ? "low contrast: " + bad.join(", ") : true; });
  LP("room CODE / name placeholders readable; name input has 'Your name'", () => { const c = css(".x-qon input::placeholder"); if (!/color:#[a-f0-9]{6}/.test(c) || !/opacity:1/.test(c)) return "placeholder css '" + c + "'"; return $("xOnName").getAttribute("placeholder") === "Your name" || "name placeholder " + $("xOnName").getAttribute("placeholder"); });
  LP("RANGE button height matches START (64px)", () => /height:64px/.test(css(".x-qplay")) && /height:64px/.test(css(".x-qgo #xqRange")) || "heights differ");
  LP("Play panel: empty status line adds no extra bottom padding", () => /margin-top:-12px/.test(css(".x-qon__msg:empty")) && /min-height:0/.test(css(".x-qon__msg:empty")) || "no :empty rule");
  LP("every map named in the Unrated description has a tile and is in the 5v5 random pool", () => {
    const names = ($("xQueue").querySelector('.x-qp[data-q="unrated"] small').textContent.split("·")[1] || "").split(",").map((x) => x.trim().toLowerCase()).filter(Boolean);
    const tiles = doc.querySelectorAll("#xQueue .x-qmap").map((b) => b.dataset.map), pool = (html.match(/FV\.pick === "random" \? \[([^\]]+)\]/) || ["", ""])[1];
    const miss = names.filter((n) => tiles.indexOf(n) < 0 || pool.indexOf('"' + n + '"') < 0); return names.length >= 6 && !miss.length || "missing: " + miss.join(",") + " (names " + names.join(",") + ")"; });
  LP("online counter: one source, cards are shares of the lobby total, moves by at most 1 per step", () => {
    const tot = () => +$("totOn").textContent, cards = () => doc.querySelectorAll(".card .meta").map((m) => +m.dataset.on);
    const t0 = tot(), c0 = cards(); if (!(t0 > 0) || c0.reduce((a, b) => a + b, 0) > t0) return "cards " + c0 + " exceed total " + t0;
    if (!/setInterval\(\(\) => drift\(true\), 20000\)/.test(html)) return "drift not slow (20 s)";
    if (xe) { let p = t0; for (let i = 0; i < 20; i++) { xe("window.xOnDrift(true); true"); const t = tot(); if (Math.abs(t - p) > 1) return "jumped " + p + " -> " + t; if (xe("xOnN") !== t) return "lobby total not the shared value"; p = t; } }
    return true; });
  LP("sound toggle: clear aria-label/title and icon state for off and on", () => {
    toLobby(); const b = $("sndBtn"), off = () => b.getAttribute("aria-pressed") === "false";
    if (!off()) b.click();
    if (b.getAttribute("aria-label") !== "Sound off — click to enable" || b.getAttribute("title") !== "Sound off — click to enable") return "off label '" + b.getAttribute("aria-label") + "'";
    b.click(); advance(10); const on = b.getAttribute("aria-label"), d = $("sndWave").getAttribute("d"); b.click(); advance(10);
    if (on !== "Sound on — click to mute") return "on label '" + on + "'"; if (!/^M15\.5/.test(d)) return "on icon not waves";
    return /#sndBtn\[aria-pressed=false\] #sndWave\{stroke:#ff4655\}/.test(html) || "muted icon style missing"; });
  LP("closed modals (Settings sliders) carry the hidden attribute; open removes it", () => {
    toLobby(); $("setBtn").click(); advance(10); if ($("mSet").hidden || !modalOn("mSet")) return "settings did not open un-hidden";
    dispatch(win, mkEvent("keydown", { key: "Escape" })); advance(10); if (modalOn("mSet") || !$("mSet").hidden) return "settings not hidden after close";
    toLobby(); return /bind\("modal hidden sync"/.test(html) || "no load-time hidden sync for closed modals"; });
}

// ---------- bot kits: bots use the player's KITS charges / credit costs / ult points, buy in the buy phase, cast like players, effects match the player's ----------
if (!NO3) {
  let R = null, err = [];
  try { const xe = vm.runInContext("__xe", context); xe("J.pick = 'Jett'; startFive(); true"); advance(3000); R = JSON.parse(xe(fs.readFileSync(path.join(__dirname, "bk_game.js"), "utf8"))); } catch (e) { err.push(String((e && e.stack) || e).slice(0, 300)); }
  for (const k in R || {}) report.push({ label: "bot kits: " + k, el: true, handler: true, pass: R[k] === true, cond: R[k] === true, errs: R[k] === true ? [] : [String(R[k])] });
  if (!R) report.push({ label: "bot kits audit", el: true, handler: true, pass: false, cond: false, errs: err });
  const src = [/XU\.b\[u\.name\] = 1\.3; return 1; \} \/\/ Empress/, /delete XU\.b\[b\.name\]/, /PTS\[a\] = KITS\[a\]\.u/, /try \{ xBBuy\(n, s\); \}/, /\(UC\[b\.name\] \|\| 0\) < KITS\.Chamber\.u/, /const def = !xBAtk\(al\)/].filter((r) => !r.test(html));
  report.push({ label: "bot kits: source wiring (Empress until death, ult costs from KITS, bot ability buy, Chamber defence)", el: true, handler: true, pass: !src.length, cond: !src.length, errs: src.map(String) });
  try { vm.runInContext("__xe", context)("running = false; true"); toLobby(); } catch (e) {}
}

// ---------- dims pass: player scale (eye 1.6 m, crouch eye 1.15 m), crate / stack heights + wall heights on every 5v5 map, per-map mechanics (Ascent doors, Bind teleporters, Haven 3 sites, Split ropes, Lotus rotating doors, Breeze 2 big sites) ----------
{
  const err = [];
  if (!/cy = 1\.6 - \(player\.ch \|\| 0\)/.test(html)) err.push("camera eye is not 1.6 m");
  if (!/const pEye = \(\) => new THREE\.Vector3\(player\.x, 1\.6 - player\.ch/.test(html) || !/out\.set\(player\.x, 1\.6 - player\.ch/.test(html)) err.push("gameplay eye (pEye / pEyeTo) is not 1.6 m");
  if (/1\.5 - player\.ch/.test(html)) err.push("a 1.5 m eye is still used somewhere");
  if (!/const ct = cr \? 0\.45 : 0/.test(html)) err.push("crouch eye drop is not 0.45 m (crouch eye 1.15 m)");
  report.push({ label: "Player scale: eye 1.6 m on the camera and in gameplay line-of-sight, crouch eye 1.15 m (0.45 m drop)", el: true, handler: true, cond: !err.length, pass: !err.length, errs: err });
}
if (!NO3) {
  let R = null, err = [];
  try { R = JSON.parse(vm.runInContext("__xe", context)(`(() => { const out = {}, keepB = boxes;
    try { for (const k of ["ascent", "bind", "haven", "split", "lotus", "breeze"]) { if (k !== "ascent") xBuildMap(k); const bx = FMAP[k].boxes, bad = [], plat = bx.filter((q) => q.h < 4 && q.x2 - q.x1 > 6 && q.z2 - q.z1 > 6); let nc = 0, ns = 0, minW = 99;
      bx.forEach((b) => { const w = b.x2 - b.x1, d = b.z2 - b.z1; if (b.h >= 4) { if (Math.max(w, d) > 2) minW = Math.min(minW, b.h); return; } if (Math.min(w, d) < 1.1 || Math.max(w, d) > 1.6) return;
        const cx = (b.x1 + b.x2) / 2, cz = (b.z1 + b.z2) / 2, p = plat.find((q) => q !== b && cx > q.x1 && cx < q.x2 && cz > q.z1 && cz < q.z2 && q.h < b.h), e = b.h - (p ? p.h : 0); if (e < 0.9) return;
        if (e <= 1.2 + 1e-6) nc++; else if (e >= 2.2 - 1e-6 && e <= 2.4 + 1e-6) ns++; else bad.push("crate (" + cx.toFixed(1) + "," + cz.toFixed(1) + ") " + e.toFixed(2) + " m: not 1.0-1.2 (single) or 2.2-2.4 (stack)"); });
      if (minW < 4.4) bad.push("full wall only " + minW + " m tall"); if (nc < 5) bad.push("only " + nc + " single crates");
      const S = { ascent: ASC_SITES, bind: { A: 1, B: 1 }, haven: HSITES, split: SSITES, lotus: LSITES, breeze: BZSITES }[k], n = Object.keys(S).length;
      if (n !== ({ haven: 3, lotus: 3 }[k] || 2)) bad.push(n + " sites");
      if (k === "ascent" && !(AD.doors.length === 2 && AD.doors.every((d) => bx.includes(d.b) && d.b.h === 0 && FMAP.ascent.solids.includes(d.m)))) bad.push("Ascent closable site doors missing / not open at load");
      if (k === "bind" && (XG_SPEC.bind || []).filter((l) => l[2] === "tp").length !== 2) bad.push("Bind needs two one-way teleporters");
      if (k === "split" && !(SROPES && SROPES.length >= 2 && SROPES.every((r) => r.top >= 2))) bad.push("Split vertical ropes missing");
      if (k === "lotus" && !(LG.doors.length === 2 && LG.doors.every((d) => bx.includes(d.b)))) bad.push("Lotus rotating doors missing");
      if (k === "breeze") { const a = BZSITES.A, b = BZSITES.B; if (Math.hypot(a[0] - b[0], a[1] - b[1]) < 60) bad.push("Breeze sites too close for long sightlines"); }
      out[k] = { nc, ns, minW, n, bad };
    } } finally { boxes = keepB; }
    return JSON.stringify(out); })()`)); } catch (e) { err.push(String(e).slice(0, 300)); }
  for (const k in R || {}) { const m = R[k]; report.push({ label: `Map dims ${k}: ${m.nc} single crates 1.0-1.2 m, ${m.ns} stacks 2.2-2.4 m, walls >= ${m.minW} m, ${m.n} sites` + ({ ascent: ", 2 closable site doors", bind: ", 2 one-way teleporters", split: ", vertical ropes", lotus: ", rotating doors", breeze: ", long A-B sightline span" }[k] || ""), el: true, handler: true, cond: !m.bad.length, pass: !m.bad.length, errs: m.bad.slice(0, 6) }); }
  if (!R) report.push({ label: "Map dims audit", el: true, handler: true, pass: false, cond: false, errs: err });
}
// Ascent shutters: F toggles a door near the player, the collider closes then reopens, bots walking into a closed shutter raise it, a new round opens them
if (!NO3) {
  let ok = false, err = [];
  try { const xe = vm.runInContext("__xe", context); const r = JSON.parse(xe(`(() => { const d = AD.doors[0], o = []; d.cd = 0; d.tgt = 1; d.t = 1; d.b.h = 0; const kp = player; player = null; ascDoorUse(d); player = kp;
      for (let i = 0; i < 40; i++) { d.t = d.tgt > d.t ? Math.min(1, d.t + 0.05) : Math.max(0, d.t - 0.05); d.b.h = d.t < 0.5 ? 3.1 : 0; } o.push(d.b.h); d.cd = 0; ascDoorUse(d); for (let i = 0; i < 40; i++) { d.t = d.tgt > d.t ? Math.min(1, d.t + 0.05) : Math.max(0, d.t - 0.05); d.b.h = d.t < 0.5 ? 3.1 : 0; } o.push(d.b.h);
      return JSON.stringify(o); })()`));
    if (r[0] !== 3.1) err.push("closing did not raise the collider: " + r[0]); if (r[1] !== 0) err.push("opening did not clear the collider: " + r[1]);
    if (!/ascDoorTick\(\) \{ \/\/ no allocations per frame/.test(html) || !/xLBotNear\(typeof bots !== "undefined" \? bots : null, d\) \|\| xLBotNear\(typeof allies/.test(html.slice(html.indexOf("function ascDoorTick")))) err.push("bots do not raise closed shutters");
    ok = !err.length; } catch (e) { err.push(String(e).slice(0, 300)); }
  report.push({ label: "Ascent closable site doors: shutter collider closes (3.1 m) and reopens, bots raise a closed shutter, rounds start open", el: true, handler: true, cond: ok, pass: ok, errs: err });
}

// CC0 gun models: every weapon (WEAP + Knife) maps to a models/<name>.glb that exists on disk and is listed in LICENSES.txt; the footer credits Quaternius;
// with no GLTFLoader the lazy load is a safe no-op and xGun keeps the procedural model
{
  const err = []; let ok = false;
  try {
    const xe = vm.runInContext("__xe", context);
    const F = JSON.parse(xe("JSON.stringify(typeof XGM !== 'undefined' && XGM ? XGM.F : null)")), W = JSON.parse(xe("JSON.stringify(Object.keys(WEAP).concat(['Knife']))"));
    const lic = fs.readFileSync(path.join(__dirname, "..", "models", "LICENSES.txt"), "utf8");
    if (!F) err.push("XGM.F missing");
    else for (const w of W) { const f = F[w]; if (!f) { err.push(w + " has no model file"); continue; } const fp = path.join(__dirname, "..", "models", f + ".glb");
      if (!fs.existsSync(fp)) err.push(w + ": models/" + f + ".glb missing"); else if (fs.readFileSync(fp).slice(0, 4).toString() !== "glTF") err.push(f + ".glb is not a binary glTF");
      if (!lic.includes(f + ".glb")) err.push(f + ".glb not in LICENSES.txt"); }
    let tot = 0; for (const f of fs.readdirSync(path.join(__dirname, "..", "models"))) tot += fs.statSync(path.join(__dirname, "..", "models", f)).size; if (tot > 8e6) err.push("models/ is " + (tot / 1e6).toFixed(1) + " MB (> 8)");
    if (!/Gun models: Quaternius/.test(html) || !/CC0/.test(lic)) err.push("credits / license text missing");
    if (!/xGmLoad\(\)/.test(html.slice(html.indexOf("function xGo("), html.indexOf("function xGo(") + 600))) err.push("xGo does not start the lazy gun-model load");
    if (!NO3) {
      const r = xe(`(() => { const L0 = THREE.GLTFLoader, ld = XGM.ld, rdy = XGM.rdy, T0 = XGM.T; try { THREE.GLTFLoader = undefined; XGM.ld = false; XGM.rdy = false; XGM.T = {}; xGmLoad(); xGmLoad();
          const g = xGun("Vandal"), k = xGun("Knife"); const bad = [];
          if (XGM.rdy) bad.push("ready without a loader"); if (Object.keys(XGM.T).length) bad.push("templates without a loader"); if (!g || !k) bad.push("xGun returned nothing");
          if (!XGB.Vandal || !XGC.Vandal) bad.push("procedural template missing");
          return bad.length ? bad.join("; ") : true; } catch (e) { return "threw: " + e; } finally { THREE.GLTFLoader = L0; XGM.ld = ld; XGM.rdy = rdy; XGM.T = T0; } })()`);
      if (r !== true) err.push("loader-missing fallback: " + r);
    }
    ok = !err.length;
  } catch (e) { err.push(String(e).slice(0, 300)); }
  report.push({ label: "CC0 gun models: all weapons + knife map to existing models/*.glb listed in LICENSES.txt, credits present, procedural fallback with no GLTFLoader", el: true, handler: true, cond: ok, pass: ok, errs: err });
}

// CC0 agent rig (Quaternius Universal Base Characters + Universal Animation Library): files exist, are binary glTF and licensed, credits present,
// every animation state maps to a clip in agent_anims.glb, every agent's body / hair exists, hitbox sizes untouched, and with no GLTFLoader the load
// falls back (Soldier path, then primitives) while a broken rig still leaves xAgent a primitive agent
{
  const err = []; let ok = false;
  try {
    const xe = vm.runInContext("__xe", context), MD = path.join(__dirname, "..", "models");
    const lic = fs.readFileSync(path.join(MD, "LICENSES.txt"), "utf8");
    const glbJson = (f) => { const b = fs.readFileSync(path.join(MD, f)); if (b.slice(0, 4).toString() !== "glTF") throw new Error(f + " is not a binary glTF"); const n = b.readUInt32LE(12); return JSON.parse(b.slice(20, 20 + n).toString("utf8")); };
    const F = JSON.parse(xe("JSON.stringify(typeof XUB !== 'undefined' && XUB ? XUB.F : null)")), ST = JSON.parse(xe("JSON.stringify(typeof XUB_ST !== 'undefined' ? XUB_ST : null)")), AG = JSON.parse(xe("JSON.stringify(typeof XUB_AG !== 'undefined' ? XUB_AG : null)"));
    if (!F || !ST || !AG) err.push("XUB / XUB_ST / XUB_AG missing");
    let tot = 0; const J = {};
    for (const k in F || {}) { const u = F[k], f = u.replace(/^models\//, ""); if (!/^models\/[\w.-]+\.glb$/.test(u)) { err.push(k + ": not a relative models/ URL: " + u); continue; }
      if (!fs.existsSync(path.join(MD, f))) { err.push(u + " missing"); continue; } tot += fs.statSync(path.join(MD, f)).size;
      try { J[k] = glbJson(f); } catch (e) { err.push(String(e.message)); } if (!lic.includes(f)) err.push(f + " not in LICENSES.txt"); }
    if (tot > 10e6) err.push("agent files are " + (tot / 1e6).toFixed(1) + " MB (> 10)");
    if (!/Quaternius/.test(lic) || !/Universal Base Characters/.test(lic) || !/Universal Animation Library/.test(lic) || !/CC0/.test(lic.slice(lic.indexOf("agent_")))) err.push("agent license text missing");
    if (!/Agent models \+ animations: Quaternius/.test(html)) err.push("lobby footer credit missing");
    if (/valorant|riot/i.test(JSON.stringify((J.a && J.a.animations || []).map((a) => a.name)))) err.push("clip named after Riot content");
    const clips = new Set(((J.a && J.a.animations) || []).map((a) => a.name)), want = ["idle", "walk", "run", "strafeL", "strafeR", "back", "crouch", "crouchWalk", "jump", "fall", "land", "aim", "fire", "reload", "cast", "throw", "hit", "plant", "defuse", "knife", "death1", "death2"];
    for (const s of want) { if (!ST || !ST[s]) err.push("state " + s + " has no clip"); else if (!clips.has(ST[s])) err.push("state " + s + " -> " + ST[s] + " not in agent_anims.glb"); }
    for (const a in AG || {}) { const [b, h] = AG[a], j = J[b]; if (!j) { err.push(a + ": body " + b + " missing"); continue; } const nn = new Set(j.nodes.map((n) => n.name));
      for (const x of String(h).split(" ").filter(Boolean)) if (!nn.has(x)) err.push(a + ": hair " + x + " not in agent_" + b + ".glb"); if (!nn.has("hand_r") || !nn.has("Head")) err.push("agent_" + b + ".glb lacks hand_r / Head bones"); }
    for (const k of ["m", "f"]) if (J[k]) { const mats = new Set((J[k].materials || []).map((m) => m.name)); ["Skin", "Suit", "Pants", "Gloves", "Boots", "Hair"].forEach((m) => { if (!mats.has(m)) err.push("agent_" + k + ".glb lacks material " + m); }); }
    const mk = html.slice(html.indexOf("function mkGuy("), html.indexOf("function mkGuy(") + 600);
    if (!/xG\("Capsule", 0\.4, 1, 4, 10\)/.test(mk) || !/xG\("Sphere", 0\.25, 12, 10\)/.test(mk) || !/head\.position\.y = 1\.75/.test(mk)) err.push("bot hitbox sizes changed");
    if (!/xUbLoad\(/.test(html.slice(html.indexOf("function xSolLoad("), html.indexOf("function xSolLoad(") + 400)) || !/Soldier\.glb/.test(html)) err.push("Soldier.glb fallback chain missing");
    if (!NO3) {
      const r = xe(`(() => { const L0 = THREE.GLTFLoader, ld = XSOL.ld, ut = XSOL.ubT, g0 = XSOL.g, ok0 = XUB.ok, s0 = XUB.src; const bad = [];
        try { THREE.GLTFLoader = undefined; let f = 0; xUbLoad(() => f++); if (f !== 1) bad.push("no loader: fallback called " + f + "x"); if (XUB.ok) bad.push("rig ready without a loader");
          XSOL.ld = false; XSOL.ubT = 0; XSOL.g = null; xSolLoad(); if (XSOL.g) bad.push("model set without a loader");
          const R = xAgent("Jett", 0xff4655, "Vandal"); if (!R || !R.m || R.ub || R.sx) bad.push("primitive agent not kept");
          XSOL.g = { ub: true }; XUB.src = {}; const R2 = xAgent("Omen", 0x3d8bff, "Vandal"); if (!R2 || !R2.m || R2.ub) bad.push("broken rig did not leave a primitive agent");
          return bad.length ? bad.join("; ") : true; } catch (e) { return "threw: " + e; } finally { THREE.GLTFLoader = L0; XSOL.ld = ld; XSOL.ubT = ut; XSOL.g = g0; XUB.ok = ok0; XUB.src = s0; } })()`);
      if (r !== true) err.push("fallback: " + r);
    }
    ok = !err.length;
  } catch (e) { err.push(String(e).slice(0, 300)); }
  report.push({ label: "CC0 agent rig: agent_m / agent_f / agent_anims.glb exist, licensed + credited, every anim state maps to a clip, bodies + hair present, hitboxes unchanged, loader-missing / broken-rig fallback to Soldier + primitives", el: true, handler: true, cond: ok, pass: ok, errs: err });
}

// procedural boots replace the base bodies' bare-foot "Boots" mesh (toes were visible); Sage robe panels are tapered cloth with a real material.
// Runtime part (real three + models via work/boots_check.js): every Boots-mesh vertex (toes included) lies inside a boot part in idle + mid-run poses
{
  const err = []; let ok = false, info = "";
  try {
    const kit = html.slice(html.indexOf("function xUb(M)"), html.indexOf("// one-shot triggers"));
    if (!/function xUbBoot\(K, yw\)/.test(kit)) err.push("xUbBoot missing");
    if (!/o\.material\.name === "Boots"\) \|\| /.test(html) && !/o\.material && o\.material\.name === "Boots"/.test(kit)) err.push("Boots mesh not dropped");
    if (!/xUbBoot\(K, yw\)\.forEach/.test(kit)) err.push("boots not pinned in xUb");
    if (!/boot = XLM\(col\.Boots\)/.test(html)) err.push("per-agent boot material missing");
    const sg = html.slice(html.indexOf('if (ag === "Sage") { const r = L(0x2bb5a5'), html.indexOf('if (ag === "Sage") { const r = L(0x2bb5a5') + 900);
    if (!/add\(k, p, r,/.test(sg)) err.push("Sage robe panels have no material argument");
    const r = require("child_process").spawnSync(process.execPath, [path.join(__dirname, "boots_check.js")], { encoding: "utf8", timeout: 120000 });
    const line = String(r.stdout || "").trim().split("\n").pop(); let J = null; try { J = JSON.parse(line); } catch (e) { err.push("boots_check output: " + line.slice(0, 200) + " " + String(r.stderr || "").slice(0, 200)); }
    if (J) { info = J.pts + " foot vertices tested, " + J.out + " outside"; if (!J.ok) err.push(...J.err); if (!(J.pts > 3000)) err.push("too few foot vertices tested"); }
    ok = !err.length;
  } catch (e) { err.push(String(e).slice(0, 300)); }
  report.push({ label: "agent boots: bare-foot Boots mesh dropped, shared procedural boots (foot + toe cap, per-agent colour) cover every foot/toe vertex in idle + run; Sage robe panels tapered with material" + (info ? " (" + info + ")" : ""), el: true, handler: true, cond: ok, pass: ok, errs: err });
}

// ---------- map dressing: every map dressed densely (>= 400 decor objects per 5v5 map, 250 Retake, 150 Duel), decor adds no colliders (nav / timings / sightlines untouched), low decor hugs a wall, the rest is above head / on the floor / beyond the walls, <= 400 extra draw calls, CC0 prop files present + licensed ----------
if (!NO3) {
  const XD_MIN = { ascent: 400, bind: 400, haven: 400, split: 400, lotus: 400, breeze: 400, retake: 250, duel: 150 }, keys = ["ascent", "bind", "haven", "split", "lotus", "breeze", "retake", "duel"];
  let R = null, err = [];
  try { R = JSON.parse(vm.runInContext("__xe", context)(`(() => { const out = [], keepB = boxes, keepS = Object.assign({}, SITES);
    const pads = { ascent: ASC_SITES, bind: { A: [-20, -21], B: [20, -21] }, haven: HSITES, split: SSITES, lotus: LSITES, breeze: BZSITES, retake: { B: [0, 0] }, duel: {} };
    try { for (const k of ${JSON.stringify(keys)}) { const bad = []; try {
      const st = xDressMap(k), M = k === "retake" || k === "duel" ? MAPS[k] : FMAP[k]; if (!st) { out.push({ k, bad: ["no dressing stats"] }); continue; }
      const bx = M.boxes, P = pads[k], sites = Object.keys(P).map((s) => P[s]), five = k !== "retake" && k !== "duel", sp = five ? xSpawn(k) : null;
      const mn = ${JSON.stringify(XD_MIN)}[k]; if (st.n < mn) bad.push("only " + st.n + " decor objects (min " + mn + ")");
      if (st.draws + st.glbDraws > 400) bad.push("draw calls " + (st.draws + st.glbDraws) + " > 400");
      if (M.xd !== 1 || st.g !== M.g) bad.push("decor not attached to this map's group (would not be freed with it)");
      // colliders: dressing must not add any; any it ever adds may not touch spawns, site centres or nav nodes
      const cols = bx.slice(st.b0, st.b1); if (bx.length !== st.b1) bad.push("collider list changed after dressing");
      let nodes = []; if (cols.length) { if (k === "ascent") nodes = Object.values(ASC_NODE); else if (five) { for (const s in SITES) delete SITES[s]; Object.assign(SITES, P); boxes = bx.slice(0, st.b0); nodes = xgBuild(k).N; boxes = keepB; } }
      cols.forEach((b) => { const ov = (x, z, r) => x > b.x1 - r && x < b.x2 + r && z > b.z1 - r && z < b.z2 + r;
        if (sp) for (const z of [sp.atk, -sp.atk]) for (let x = -8; x <= 8; x += 2) if (ov(x, z, 0.4)) bad.push("decor collider on spawn " + x + "," + z);
        sites.forEach((s) => { if (ov(s[0], s[1], 2.5)) bad.push("decor collider on plant site " + s); }); nodes.forEach((n) => { if (ov(n[0], n[1], 0.45)) bad.push("decor collider on nav node " + n); }); });
      // placement rules per decor object
      const [X1, X2, Z1, Z2] = st.bounds, wl = bx.filter((b) => b.h >= 3), plat = (b) => b.h < 4 && Math.min(b.x2 - b.x1, b.z2 - b.z1) >= 4;
      const gnd = (x, z) => bx.reduce((m, b) => (plat(b) && x > b.x1 && x < b.x2 && z > b.z1 && z < b.z2 ? Math.max(m, b.h) : m), 0);
      const dW = (x, z) => wl.reduce((m, b) => Math.min(m, Math.hypot(Math.max(b.x1 - x, 0, x - b.x2), Math.max(b.z1 - z, 0, z - b.z2))), 1e9);
      const cnt = { wall: 0, high: 0, floor: 0, top: 0, oob: 0 }; let worst = 0;
      st.items.forEach((q) => { cnt[q.f] = (cnt[q.f] || 0) + 1; const g = gnd(q.x, q.z), tag = q.t + " @" + q.x.toFixed(1) + "," + q.z.toFixed(1);
        if (q.f === "wall") { if (q.y0 < g + 3.4) { const e = dW(q.x, q.z) + q.r; worst = Math.max(worst, e); if (e > 0.8) bad.push(tag + " sticks " + e.toFixed(2) + " m out of the wall (max 0.8)"); }
          if (q.y0 < g + 3.4 && q.r > 0.15 && sp) for (const z of [sp.atk, -sp.atk]) for (let x = -8; x <= 8; x += 2) if (Math.hypot(q.x - x, q.z - z) < q.r + 0.45) bad.push(tag + " on spawn point " + x + "," + z); }
        else if (q.f === "high") { if (q.y0 < g + 3.35) bad.push(tag + " hangs down to " + (q.y0 - g).toFixed(2) + " m (min 3.4)"); }
        else if (q.f === "floor") { if (q.y1 - q.y0 > 0.06) bad.push(tag + " floor decal " + (q.y1 - q.y0).toFixed(2) + " m tall"); if (/patch|debris|drain/.test(q.t) && sites.some((s) => Math.hypot(s[0] - q.x, s[1] - q.z) < 7)) bad.push(tag + " over the site paint"); }
        else if (q.f === "top") { if (!bx.some((b) => b.h >= 4 && q.x > b.x1 && q.x < b.x2 && q.z > b.z1 && q.z < b.z2 && q.y0 >= b.h - 0.6)) bad.push(tag + " roof piece not on top of a building mass"); }
        else if (q.f === "oob") { if (!(q.y1 <= 0 || q.x < X1 || q.x > X2 || q.z < Z1 || q.z > Z2)) bad.push(tag + " out-of-bounds piece inside the playable walls"); }
        else bad.push(tag + " unknown placement class " + q.f); });
      out.push({ k, n: st.n, draws: st.draws, glb: st.glbDraws, cols: cols.length, models: st.models, cnt, worst: +worst.toFixed(2), verts: st.verts, bad });
    } catch (e) { out.push({ k, bad: [String(e.stack || e).slice(0, 300)] }); } } } finally { boxes = keepB; for (const s in SITES) delete SITES[s]; Object.assign(SITES, keepS); }
    return JSON.stringify(out); })()`)); } catch (e) { err.push(String(e).slice(0, 300)); }
  const lic = (() => { try { return fs.readFileSync(path.join(__dirname, "..", "models", "LICENSES.txt"), "utf8"); } catch (e) { return ""; } })(), ddir = path.join(__dirname, "..", "models", "decor");
  let mb = 0; try { fs.readdirSync(ddir).forEach((f) => (mb += fs.statSync(path.join(ddir, f)).size)); } catch (e) {} mb /= 1048576;
  for (const m of R || []) { const bad = (m.bad || []).slice();
    for (const nm in m.models || {}) { if (!fs.existsSync(path.join(ddir, nm + ".glb"))) bad.push("missing models/decor/" + nm + ".glb"); if (!lic.includes("decor/" + nm + ".glb")) bad.push("decor/" + nm + ".glb not listed in models/LICENSES.txt"); }
    const ok = !bad.length;
    report.push({ label: `Map dressing ${m.k}: ${m.n} decor objects (min ${XD_MIN[m.k]}; ${m.cnt ? Object.entries(m.cnt).map(([a, b]) => b + " " + a).join(", ") : "?"}), ${m.cols} new colliders, ${m.draws}+${m.glb} draw calls (<= 400), low decor <= ${m.worst} m off a wall, CC0 props ${Object.keys(m.models || {}).length} licensed`, el: true, handler: true, cond: ok, pass: ok, errs: bad.slice(0, 5) }); }
  if (!R || R.length !== keys.length) report.push({ label: "Map dressing audit", el: true, handler: true, pass: false, cond: false, errs: err });
  { const ok = mb > 0 && mb < 8 && /CC0/.test(lic) && /decor\//.test(lic); report.push({ label: `Map dressing props: models/decor ${mb.toFixed(2)} MB (< 8 MB), CC0 licence block present in models/LICENSES.txt`, el: true, handler: true, cond: ok, pass: ok, errs: ok ? [] : ["decor models " + mb.toFixed(2) + " MB or licence block missing"] }); }
}

// ---------- map fill: in-play cover + set pieces with colliders on every 5v5 map + Retake: colliders match visuals (bullet-stopping mesh per collider), clear of spawns / plant sites / doors / teleporters / ropes / nav nodes, lanes >= 2.5 m, every site 4-8 cover pieces, largest empty floor area per map, flat ground variety, <= 4 draw calls ----------
if (!NO3) {
  const keys = ["ascent", "bind", "haven", "split", "lotus", "breeze", "retake"];
  let R = null, err = [];
  try { R = JSON.parse(vm.runInContext("__xe", context)(`(() => { const out = [], keepB = boxes, keepS = Object.assign({}, SITES);
    const pads = { ascent: ASC_SITES, bind: { A: [-20, -21], B: [20, -21] }, haven: HSITES, split: SSITES, lotus: LSITES, breeze: BZSITES, retake: { B: [0, 0] } };
    try { for (const k of ${JSON.stringify(keys)}) { const bad = []; try {
      const five = k !== "retake"; if (five) xBuildMap(k); const M = five ? FMAP[k] : MAPS.retake, st = XF_STAT[k], bx = M.boxes, P = pads[k], sites = Object.keys(P).map((s) => P[s]), sp = five ? xSpawn(k) : null;
      if (!st) { out.push({ k, bad: ["no fill stats"] }); continue; }
      const fc = bx.filter((b) => b.fill), base = bx.filter((b) => !b.fill), plat = (b) => b.h < 4 && Math.min(b.x2 - b.x1, b.z2 - b.z1) >= 4;
      const nMin = five ? 30 : 8; if (st.pieces.length < nMin) bad.push("only " + st.pieces.length + " fill pieces (min " + nMin + ")");
      if (st.flats.length < (five ? 20 : 8)) bad.push("only " + st.flats.length + " ground-variety patches");
      if (st.draws > 4) bad.push(st.draws + " fill draw calls (max 4)");
      if (st.g !== M.g || !M.g.children.some((o) => o.name === "xFill")) bad.push("fill meshes not in this map's group (would not be freed with it)");
      // colliders match visuals: every piece's collider union == its visual bounds (0.2 m), every collider in the collision list with one invisible bullet-stopping box mesh
      let nc = 0; st.pieces.forEach((p) => { const v = p.vis, U = { x1: Math.min(...p.cols.map((b) => b.x1)), x2: Math.max(...p.cols.map((b) => b.x2)), z1: Math.min(...p.cols.map((b) => b.z1)), z2: Math.max(...p.cols.map((b) => b.z2)), h: Math.max(...p.cols.map((b) => b.h)) };
        const e = [v[0] - U.x1, U.x2 - v[1], v[4] - U.z1, U.z2 - v[5], U.h - v[3]]; if (e.some((q) => Math.abs(q) > 0.2)) bad.push(p.t + " @" + p.x + "," + p.z + " visual off its collider by " + e.map((q) => q.toFixed(2)).join("/"));
        p.cols.forEach((b) => { nc++; if (!bx.includes(b)) bad.push(p.t + " @" + p.x + "," + p.z + " collider missing from the collision list"); }); });
      const hits = M.solids.filter((m) => m.name === "xFillHit").length; if (hits !== nc || fc.length !== nc) bad.push("fill colliders " + fc.length + " / pieces' colliders " + nc + " / hit meshes " + hits);
      // keep-clear: spawn points, plant site centres (3 m), doors / teleporters / ropes (2.5 m), nav nodes (0.8 m square, the nav build's clearance: no node gets nudged)
      const ov = (b, x, z, r) => x > b.x1 - r && x < b.x2 + r && z > b.z1 - r && z < b.z2 + r, keep = [];
      try { if (k === "bind") TPS.forEach((t) => keep.push([t.x, t.z], [t.tx, t.tz])); if (k === "split") SROPES.forEach((q) => keep.push([q.x, q.z])); if (k === "ascent") AD.doors.forEach((d) => keep.push([(d.b.x1 + d.b.x2) / 2, (d.b.z1 + d.b.z2) / 2])); if (k === "lotus") LG.doors.forEach((d) => keep.push([(d.b.x1 + d.b.x2) / 2, (d.b.z1 + d.b.z2) / 2])); (XG_SPEC[k] || []).forEach(([a, b2]) => keep.push(a, b2)); } catch (e) { bad.push("keep list: " + e); }
      let nodes = []; if (k === "ascent") nodes = Object.values(ASC_NODE); else if (five) { for (const s in SITES) delete SITES[s]; Object.assign(SITES, P); boxes = bx; nodes = xgBuild(k).N; boxes = keepB; }
      const SPP = five ? [] : [[0, 17], [-1.5, 16], [1.5, 16], [-12, -15], [0, -16], [12, -12]];
      fc.forEach((b) => { const c = ((b.x1 + b.x2) / 2).toFixed(1) + "," + ((b.z1 + b.z2) / 2).toFixed(1);
        if (sp) for (const z of [sp.atk, -sp.atk]) for (let x = -8; x <= 8; x += 2) if (ov(b, x, z, 2)) bad.push("fill collider " + c + " on spawn " + x + "," + z);
        SPP.forEach(([x, z]) => { if (ov(b, x, z, 1.5)) bad.push("fill collider " + c + " on spawn " + x + "," + z); });
        sites.forEach((s) => { if (ov(b, s[0], s[1], 3)) bad.push("fill collider " + c + " on plant site " + s); });
        keep.forEach((q) => { if (ov(b, q[0], q[1], 2)) bad.push("fill collider " + c + " blocks door / teleporter / rope " + q); });
        nodes.forEach((n) => { if (ov(b, n[0], n[1], 0.8)) bad.push("fill collider " + c + " on nav node " + n); }); });
      // routes stay >= 2.5 m wide: a piece is flush against a neighbour or >= 2.5 m from it
      const uni = (L) => ({ x1: Math.min(...L.map((q) => q.x1)), x2: Math.max(...L.map((q) => q.x2)), z1: Math.min(...L.map((q) => q.z1)), z2: Math.max(...L.map((q) => q.z2)), h: Math.max(...L.map((q) => q.h)) }); // a piece's colliders tile one footprint
      const PU = st.pieces.map((p) => Object.assign(uni(p.cols), { pp: p })), others = base.concat(PU);
      PU.forEach((b) => { others.forEach((o) => { if (o === b || o.h <= 0.3) return;
        const d = Math.hypot(Math.max(0, o.x1 - b.x2, b.x1 - o.x2), Math.max(0, o.z1 - b.z2, b.z1 - o.z2)); if (d > 0.03 && d < 2.5 && !(plat(o) && b.h > o.h - 0.01 && b.x1 >= o.x1 - 0.01 && b.x2 <= o.x2 + 0.01 && b.z1 >= o.z1 - 0.01 && b.z2 <= o.z2 + 0.01 && Math.min(b.x1 - o.x1, o.x2 - b.x2, b.z1 - o.z1, o.z2 - b.z2) >= 2.5 - 0.03))
          bad.push("gap " + d.toFixed(2) + " m between fill " + ((b.x1 + b.x2) / 2).toFixed(1) + "," + ((b.z1 + b.z2) / 2).toFixed(1) + " and a collider (min 2.5)"); }); });
      // cover per site: clusters of 0.9-3.3 m colliders (<= 4.2 m footprint) within 10 m of the plant centre, same floor level
      const gnd = (x, z) => base.reduce((m, b) => (plat(b) && x > b.x1 && x < b.x2 && z > b.z1 && z < b.z2 ? Math.max(m, b.h) : m), 0);
      const siteN = {}; for (const s in P) { const c = P[s], L = bx.filter((b) => !plat(b) && b.h >= 0.9 && b.h <= 3.3 + gnd(c[0], c[1]) && b.x2 - b.x1 <= 4.2 && b.z2 - b.z1 <= 4.2 && Math.hypot(Math.max(0, b.x1 - c[0], c[0] - b.x2), Math.max(0, b.z1 - c[1], c[1] - b.z2)) <= 10 && Math.abs(gnd((b.x1 + b.x2) / 2, (b.z1 + b.z2) / 2) - gnd(c[0], c[1])) < 0.5);
        const g = L.map((_, i) => i), f = (i) => (g[i] === i ? i : (g[i] = f(g[i]))); for (let i = 0; i < L.length; i++) for (let j = i + 1; j < L.length; j++) { const a = L[i], b = L[j]; if (Math.max(a.x1 - b.x2, b.x1 - a.x2, a.z1 - b.z2, b.z1 - a.z2) < 0.05) g[f(i)] = f(j); }
        siteN[s] = new Set(L.map((_, i) => f(i))).size; if (siteN[s] < 4 || siteN[s] > 8) bad.push("site " + s + " has " + siteN[s] + " cover pieces (4-8)"); }
      // largest empty floor cell: 0.5 m grid of reachable floor, minus spawn rooms and the 3.5 m plant discs; largest object-free square and rectangle (both sides >= 3 m)
      const walls = base.filter((b) => b.h >= 4); let X1 = 1e9, X2 = -1e9, Z1 = 1e9, Z2 = -1e9; walls.forEach((b) => { X1 = Math.min(X1, b.x1); X2 = Math.max(X2, b.x2); Z1 = Math.min(Z1, b.z1); Z2 = Math.max(Z2, b.z2); });
      if (!five) { X1 = -20; X2 = 20; Z1 = -20; Z2 = 20; }
      const G = 0.5, GX = Math.ceil((X2 - X1) / G), GZ = Math.ceil((Z2 - Z1) / G), obst = bx.filter((b) => b.h > 0.3 && !plat(b)), walk = new Uint8Array(GX * GZ), rc = new Uint8Array(GX * GZ);
      const cellOf = (x, z) => { const i = Math.floor((x - X1) / G), j = Math.floor((z - Z1) / G); return i < 0 || j < 0 || i >= GX || j >= GZ ? -1 : i * GZ + j; };
      obst.forEach((b) => { for (let i = Math.max(0, Math.floor((b.x1 - X1) / G)); i < Math.min(GX, Math.ceil((b.x2 - X1) / G)); i++) for (let j = Math.max(0, Math.floor((b.z1 - Z1) / G)); j < Math.min(GZ, Math.ceil((b.z2 - Z1) / G)); j++) walk[i * GZ + j] = 2; });
      const stk = []; const seed = (x, z) => { const c = cellOf(x, z); if (c >= 0 && walk[c] !== 2 && !rc[c]) { rc[c] = 1; stk.push(c); } }; nodes.forEach((n) => seed(n[0], n[1])); sites.forEach((s) => seed(s[0], s[1])); if (sp) { seed(0, sp.atk); seed(0, -sp.atk); } else seed(0, 17);
      while (stk.length) { const c = stk.pop(), i = (c / GZ) | 0, j = c % GZ; for (const [a, b2] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const ii = i + a, jj = j + b2; if (ii < 0 || jj < 0 || ii >= GX || jj >= GZ) continue; const q = ii * GZ + jj; if (walk[q] !== 2 && !rc[q]) { rc[q] = 1; stk.push(q); } } }
      const excl = (x, z) => (sp && Math.abs(x) < 16 && (Math.abs(z - sp.atk) < 7 || Math.abs(z + sp.atk) < 7 || z > sp.atk || z < -sp.atk)) || sites.some((s) => Math.hypot(s[0] - x, s[1] - z) < 3.5);
      const F = new Uint8Array(GX * GZ); for (let i = 0; i < GX; i++) for (let j = 0; j < GZ; j++) { const c = i * GZ + j; F[c] = rc[c] && !excl(X1 + (i + 0.5) * G, Z1 + (j + 0.5) * G) ? 1 : 0; }
      let sq = 0, sqAt = null; const D = new Uint16Array(GX * GZ); for (let i = 0; i < GX; i++) for (let j = 0; j < GZ; j++) { const c = i * GZ + j; D[c] = !F[c] ? 0 : i && j ? 1 + Math.min(D[c - GZ], D[c - 1], D[c - GZ - 1]) : 1; if (D[c] > sq) { sq = D[c]; sqAt = [X1 + (i + 1 - sq / 2) * G, Z1 + (j + 1 - sq / 2) * G]; } }
      let ra = 0, raW = null; const H = new Uint16Array(GZ), m = Math.round(3 / G);
      for (let i = 0; i < GX; i++) { for (let j = 0; j < GZ; j++) H[j] = F[i * GZ + j] ? H[j] + 1 : 0; const S = []; for (let j = 0; j <= GZ; j++) { const h = j < GZ ? H[j] : 0; let s0 = j; while (S.length && S[S.length - 1][1] >= h) { const [a, hh] = S.pop(); const w = j - a; if (hh >= m && w >= m && hh * w > ra) { ra = hh * w; raW = [hh * G, w * G, X1 + (i + 1 - hh / 2) * G, Z1 + ((a + j) / 2) * G]; } s0 = a; } S.push([s0, h]); } }
      const sqM = sq * G, raM = ra * G * G; if (sqM > 12.01) bad.push("empty floor square " + sqM + " m at " + sqAt.map((v) => v.toFixed(1)) + " (max 12 m)"); if (raM > 150) bad.push("empty floor rectangle " + raM + " m2 (max 150)");
      out.push({ k, n: st.pieces.length, cols: nc, flats: st.flats.length, draws: st.draws, siteN, sq: sqM, sqAt, ra: raM, raW, kinds: st.pieces.reduce((o, p) => ((o[p.t] = (o[p.t] || 0) + 1), o), {}), bad });
    } catch (e) { out.push({ k, bad: [String(e.stack || e).slice(0, 300)] }); } } } finally { boxes = keepB; for (const s in SITES) delete SITES[s]; Object.assign(SITES, keepS); }
    return JSON.stringify(out); })()`)); } catch (e) { err.push(String(e).slice(0, 300)); }
  for (const m of R || []) { const ok = !m.bad.length;
    report.push({ label: `Map fill ${m.k}: ${m.n} in-play pieces (${m.cols} box colliders, each with a bullet-stopping mesh; visuals match colliders), ${m.flats} ground-variety patches, ${m.draws} draw calls, cover per site ${JSON.stringify(m.siteN)} (4-8), largest empty floor square ${m.sq} m (<= 12) / rectangle ${m.ra} m2 (<= 150), spawns / plant sites / doors / teleporters / ropes / nav nodes clear, lanes >= 2.5 m`, el: true, handler: true, cond: ok, pass: ok, errs: m.bad.slice(0, 5) }); }
  if (!R || R.length !== keys.length) report.push({ label: "Map fill audit", el: true, handler: true, pass: false, cond: false, errs: err.concat(R ? R.filter((m) => !m.n).map((m) => m.k + ": " + m.bad[0]) : []) });
}

// first-person arms: the player's agent body (agent_m / agent_f.glb) cut to arm + hand triangles, posed per weapon by 2-bone IK + finger curls on the viewmodel camera.
// Static: block present, a grip table entry for every gun model, built only once the agent rig + gun models are in, primitive arms kept otherwise.
// Runtime (real three r149 + models via work/fp_check.js): every weapon + knife for a male and a female agent: arm/hand triangles only, wrists on their grip targets,
// no stretched triangles, fingers curled, agent Suit / Gloves colours, reload moves the left hand, the right arm follows the cast hand, primitive arms hidden while on.
{
  const err = []; let ok = false, info = "";
  try {
    const xe = vm.runInContext("__xe", context);
    const a = html.indexOf("// ---- FIRST-PERSON ARMS"), b = html.indexOf("// ---- end FIRST-PERSON ARMS"), blk = a >= 0 && b > a ? html.slice(a, b) : "";
    if (!blk) err.push("FIRST-PERSON ARMS block missing");
    if (!/XUB\.ok/.test(blk) || !/XGM\.rdy/.test(blk)) err.push("rig not gated on the agent rig + gun models being ready");
    if (!/vmTick = function \(dt\) \{ v1\(dt\); try \{ fpaTick\(\); \}/.test(blk)) err.push("fpaTick not chained after vmTick");
    if (!/\[VMA\.R, VMA\.L, KARM\]\.forEach\(\(o\) => o && \(o\.visible = !on\)\)/.test(blk)) err.push("primitive arms not swapped with the rig");
    const F = JSON.parse(xe("JSON.stringify(typeof XGM !== 'undefined' && XGM ? XGM.F : null)")), G = JSON.parse(xe("JSON.stringify(typeof FPG !== 'undefined' ? FPG : null)"));
    if (!G) err.push("FPG grip table missing");
    else for (const w in F || {}) { if (w === "Knife") continue; const g = G[w]; if (!g) { err.push("no grip entry for " + w); continue; }
      if (g.length < 7 || g.slice(0, 6).some((v) => typeof v !== "number" || Math.abs(v) > 0.6) || !/^[rpf]$/.test(g[6]) || (g[6] === "f" && g.length < 9)) err.push("bad grip entry for " + w);
      if (!(g[3] < g[1])) err.push(w + ": grip bottom above grip top"); if (g[6] !== "p" && !(g[4] < g[0] - 0.1)) err.push(w + ": support hand not ahead of the grip"); }
    if (!NO3) { // no loader in this harness: the rig never builds and the primitive arms stay on after a viewmodel tick
      const r = JSON.parse(xe(`(() => { try { const r0 = running; running = true; try { vmTick(0.016); } catch (e) {} running = r0; return JSON.stringify({ st: FPA.st, on: FPA.on, vr: VMA.R.visible, vl: VMA.L.visible, k: KARM.visible }); } catch (e) { return JSON.stringify({ e: String(e) }); } })()`));
      if (r.e) err.push("fallback probe threw: " + r.e); else { if (r.st === "ready" || r.on) err.push("rig built without a loader"); if (r.vr === false || r.vl === false || r.k === false) err.push("primitive arms hidden without the rig"); /* the THREE stub leaves .visible undefined until something sets it */ }
    }
    const rr = require("child_process").spawnSync(process.execPath, [path.join(__dirname, "fp_check.js")], { encoding: "utf8", timeout: 180000 });
    const line = String(rr.stdout || "").trim().split("\n").pop(); let J = null; try { J = JSON.parse(line); } catch (e) { err.push("fp_check output: " + line.slice(0, 200) + " " + String(rr.stderr || "").slice(0, 200)); }
    if (J) { const I = J.info || {}; info = (I.weapons || 0) + " weapon poses, " + Object.entries(I.tris || {}).map(([k, v]) => k + " " + v).join(" / ") + " arm tris, wrist err " + ((I.maxWrist || 0) * 1000).toFixed(2) + " mm, max edge " + (I.maxEdge || 0).toFixed(3) + " m";
      if (!J.ok) err.push(...(J.err || ["fp_check failed"])); if (!(I.weapons >= 30)) err.push("too few weapon poses tested"); }
    ok = !err.length;
  } catch (e) { err.push(String(e).slice(0, 300)); }
  report.push({ label: "first-person arms: agent GLB arm/hand mesh (Suit sleeve, Gloves, wrist skin) on the viewmodel, IK grip per weapon (right grip + trigger finger, left handguard / foregrip / two-hand pistol, knife fist), reload + cast hands, primitive-arm fallback" + (info ? " (" + info + ")" : ""), el: true, handler: true, cond: ok, pass: ok, errs: err });
}

// ---------- print ----------
const bad = report.filter((r) => !r.pass);
console.log(`\n=== audit (${MID ? "THREE loads, 3D init throws" : NO3 ? "THREE missing" : "THREE stub loaded"}) — ${report.length} checks, ${bad.length} failing ===`);
for (const r of report) console.log((r.pass ? "PASS " : "FAIL ") + r.label + (r.pass ? "" : `  [el:${r.el} handler:${r.handler} cond:${r.cond}] ` + r.errs.slice(0, 3).join(" || ")));
const loadErrs = errors.filter((e) => e.phase === "load");
if (loadErrs.length) { console.log("\nload errors:"); loadErrs.slice(0, 10).forEach((e) => console.log("  " + e.where + ": " + e.msg)); }
process.exitCode = bad.length || loadErrs.length ? 1 : 0;
