// ---- CRASH REPORT ----
// loadfast / iOS (user 2026-11-03: on an iPhone, Safari and Arc - both WebKit - an online match shows a black screen or goes
// back to the menu; nothing reproduces in Chromium here). This script runs first (its own inline <script> right after the
// analytics stub) and keeps a small crash record in localStorage ('vs.crash') that survives a tab the OS killed and reloaded:
//  - window 'error' and 'unhandledrejection' events,
//  - webglcontextlost / webglcontextrestored on every WebGL canvas (getContext is wrapped to watch the canvas), with a
//    named error (WebGLContextLost) and, when the context is not restored within XCR.restoreMs, a clear on-screen message
//    with Reload instead of a silent black screen,
//  - shader compile / link failures (three's 'THREE.WebGLProgram: Shader Error' console.error, and getProgramParameter
//    LINK_STATUS false),
//  - online socket closes (code + reason, server_runtime calls xCrash.ws),
//  - the last load stage reached (xCrash.stage: match load, map download / prepare / upload, weapons, warm, playable),
//  - the device's GL renderer string and limits (first WebGL context).
// A match (xCrash.begin) that ends without xCrash.end (back to the menu cleanly), or that saw a context loss / fatal error,
// leaves a report; the next menu load shows a small dismissible "Last match ended: <reason>" note with a Copy button.
(function () {
  'use strict';
  var G = window, KEY = 'vs.crash', MAX = 40;
  var XCR = G.xCrash = { restoreMs: 4000, rec: null, shown: null, lostT: 0 };
  function now() { return Date.now(); }
  function load() { try { var s = G.localStorage && G.localStorage.getItem(KEY); return s ? JSON.parse(s) : null; } catch (e) { return null; } }
  function save() { try { if (G.localStorage) G.localStorage.setItem(KEY, JSON.stringify(XCR.rec)); } catch (e) {} }
  function str(x, n) { try { x = x == null ? '' : typeof x === 'string' ? x : x && x.message ? (x.name && x.name !== 'Error' ? x.name + ': ' : '') + x.message : JSON.stringify(x); } catch (e) { x = String(x); } return String(x).slice(0, n || 300); }
  var prev = load();
  XCR.prev = prev;
  XCR.rec = { v: 1, at: now(), ua: str(G.navigator && G.navigator.userAgent, 200), inMatch: false, clean: true, stage: 'page', stageAt: now(), ev: [], gl: null, mem: null };
  try { var dm = G.navigator && G.navigator.deviceMemory; if (dm) XCR.rec.mem = dm; } catch (e) {}
  XCR.log = function (type, detail, fatal) {
    var r = XCR.rec; r.ev.push({ t: now() - r.at, type: type, d: str(detail, 400), stage: r.stage, f: fatal ? 1 : 0 }); if (r.ev.length > MAX) r.ev.splice(0, r.ev.length - MAX);
    if (fatal && r.inMatch) r.fatal = { type: type, d: str(detail, 200), stage: r.stage }; save();
  };
  XCR.stage = function (s) { var r = XCR.rec; if (r.stage === s) return; r.stage = String(s).slice(0, 60); r.stageAt = now(); save(); };
  XCR.begin = function (what) { var r = XCR.rec; r.inMatch = true; r.clean = false; r.fatal = null; r.match = String(what || '').slice(0, 60); r.matchAt = now(); XCR.stage('match-load'); };
  XCR.end = function () { var r = XCR.rec; if (!r.inMatch) return; r.inMatch = false; r.clean = !r.fatal; XCR.stage('menu'); };
  XCR.ws = function (code, reason) { var abn = code !== 1000 && code !== 1001; XCR.log('ws-close', code + (reason ? ' ' + reason : ''), abn && code !== 4000); };
  // ---- the report for a page load: what the previous page left ----
  XCR.reason = function (p) {
    if (!p) return null;
    if (p.fatal) { var f = p.fatal; return f.type === 'webglcontextlost' ? 'graphics context lost (WebGLContextLost) during ' + f.stage : f.type + ': ' + f.d + ' (' + f.stage + ')'; }
    if (p.inMatch && !p.clean) return 'the page closed or reloaded during ' + (p.stage || 'the match') + ' (the browser may have run out of memory)';
    return null;
  };
  XCR.text = function (p) { p = p || XCR.prev; try { return JSON.stringify(p, null, 1); } catch (e) { return String(p); } };
  // ---- GL: watch every WebGL canvas, record the device limits once ----
  function glInfo(gl) {
    if (XCR.rec.gl || !gl || typeof gl.getParameter !== 'function') return;
    try { var x = gl.getExtension('WEBGL_debug_renderer_info'), P = function (k) { try { return gl.getParameter(k); } catch (e) { return null; } };
      XCR.rec.gl = { v2: typeof G.WebGL2RenderingContext !== 'undefined' && gl instanceof G.WebGL2RenderingContext, ver: P(gl.VERSION), vendor: x ? P(x.UNMASKED_VENDOR_WEBGL) : P(gl.VENDOR), renderer: x ? P(x.UNMASKED_RENDERER_WEBGL) : P(gl.RENDERER),
        maxTex: P(gl.MAX_TEXTURE_SIZE), units: P(gl.MAX_TEXTURE_IMAGE_UNITS), vunits: P(gl.MAX_VERTEX_TEXTURE_IMAGE_UNITS), layers: gl.MAX_ARRAY_TEXTURE_LAYERS ? P(gl.MAX_ARRAY_TEXTURE_LAYERS) : null,
        fvec: P(gl.MAX_FRAGMENT_UNIFORM_VECTORS), vvec: P(gl.MAX_VERTEX_UNIFORM_VECTORS), rb: P(gl.MAX_RENDERBUFFER_SIZE), dpr: G.devicePixelRatio || 1 }; save(); } catch (e) {}
  }
  function msgBox(on) {
    var d = G.document; if (!d || !d.body) return; var e = d.getElementById('xCtxLost');
    if (!on) { if (e) e.style.display = 'none'; return; }
    if (!e) { e = d.createElement('div'); e.id = 'xCtxLost'; e.setAttribute('role', 'alert');
      e.style.cssText = 'position:fixed;inset:0;z-index:9500;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;background:#0f1923;color:#ece8e1;font:600 18px Arial;text-align:center;padding:24px';
      e.innerHTML = '<span>The browser reset the graphics (WebGL context lost).</span><small style="font-weight:400;font-size:14px;max-width:460px">This usually means the device ran low on graphics memory. Reload to continue.</small>';
      var b = d.createElement('button'); b.textContent = 'Reload'; b.style.cssText = 'padding:12px 30px;background:#ff4655;color:#fff;border:0;cursor:pointer;font:700 15px Arial';
      b.onclick = function () { try { G.location.reload(); } catch (x) {} }; e.appendChild(b); d.body.appendChild(e); }
    e.style.display = 'flex';
  }
  XCR.watch = function (canvas, gl) {
    if (!canvas || canvas.xCrW) return; canvas.xCrW = 1; glInfo(gl);
    canvas.addEventListener('webglcontextlost', function () {
      var e = new Error('WebGL context lost during ' + XCR.rec.stage); e.name = 'WebGLContextLost'; XCR.lost = e; XCR.log('webglcontextlost', e, true);
      try { console.error(e); } catch (x) {}
      clearTimeout(XCR.lostT); XCR.lostT = setTimeout(function () { if (XCR.lost) msgBox(true); }, XCR.restoreMs); // not restored: say so, offer Reload (no silent black screen)
    }, false);
    canvas.addEventListener('webglcontextrestored', function () { XCR.lost = null; clearTimeout(XCR.lostT); msgBox(false); XCR.log('webglcontextrestored', XCR.rec.stage, false); }, false);
  };
  if (G.HTMLCanvasElement && HTMLCanvasElement.prototype.getContext) {
    var gc0 = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type) { var c = gc0.apply(this, arguments); if (c && /webgl/i.test(String(type))) { try { XCR.watch(this, c); } catch (e) {} } return c; };
  }
  ['WebGLRenderingContext', 'WebGL2RenderingContext'].forEach(function (n) { var C = G[n]; if (!C || !C.prototype.getProgramParameter) return; var p0 = C.prototype.getProgramParameter;
    C.prototype.getProgramParameter = function (prog, pname) { var v = p0.apply(this, arguments); if (pname === 0x8B82 && v === false && !(this.isContextLost && this.isContextLost())) { var info = ''; try { info = this.getProgramInfoLog(prog); } catch (e) {} XCR.log('shader-link', info || 'program link failed', true); } return v; }; });
  if (G.console && console.error) { var ce0 = console.error; console.error = function () { try { var a = arguments[0], s = typeof a === 'string' ? a : a && a.message; if (s && /WebGLProgram|Shader Error|shader/i.test(s)) XCR.log('shader', Array.prototype.slice.call(arguments).map(function (x) { return str(x, 150); }).join(' '), true); } catch (e) {} return ce0.apply(this, arguments); }; }
  // A script error: its message, and where it came from even when WebKit mutes the message to "Script error." (a cross-origin
  // script without CORS): file, line, column, and the stack's first frames when there is an Error object.
  G.addEventListener('error', function (e) {
    if (e && e.target && e.target !== G && !e.error && !e.message) return; // a resource (img / script) load error, not a script exception
    var er = e && e.error, m = str(er || (e && e.message) || 'error', 240), at = (e && e.filename ? e.filename : '?') + ':' + ((e && e.lineno) || 0) + ':' + ((e && e.colno) || 0);
    var st = er && er.stack ? String(er.stack).split('\n').slice(0, 4).join(' | ').slice(0, 300) : '';
    XCR.log('error', m + ' @ ' + at + (st ? ' :: ' + st : '') + (/^Script error\.?$/.test(String(e && e.message)) ? ' [muted cross-origin]' : ''), true);
  }, true);
  G.addEventListener('unhandledrejection', function (e) { var r = e && e.reason; if (r && (r.name === 'AbortError')) return; XCR.log('unhandledrejection', r, true); });
  G.addEventListener('pagehide', function () { XCR.log('pagehide', XCR.rec.stage, false); });
  // ---- the note on the next menu load ----
  XCR.note = function () {
    var p = XCR.prev, why = XCR.reason(p), d = G.document; if (!why || !d || !d.body || d.getElementById('xCrNote')) return null;
    var e = d.createElement('div'); e.id = 'xCrNote'; e.setAttribute('role', 'status');
    e.style.cssText = 'position:fixed;left:50%;bottom:24px;transform:translateX(-50%);max-width:min(92vw,560px);z-index:60;background:rgba(15,25,35,.94);color:#ece8e1;border-left:4px solid #ff4655;padding:10px 12px 10px 16px;font:700 13px Arial;line-height:1.4;display:flex;gap:10px;align-items:center';
    var t = d.createElement('span'); t.textContent = 'Last match ended: ' + why; t.style.flex = '1'; e.appendChild(t);
    var cp = d.createElement('button'); cp.type = 'button'; cp.textContent = 'Copy'; cp.dataset.copy = '1';
    var x = d.createElement('button'); x.type = 'button'; x.textContent = '\u00d7'; x.setAttribute('aria-label', 'Dismiss'); x.dataset.dismiss = '1';
    [cp, x].forEach(function (b) { b.style.cssText = 'background:transparent;color:#ece8e1;border:1px solid rgba(236,232,225,.35);padding:4px 10px;cursor:pointer;font:700 12px Arial'; e.appendChild(b); });
    cp.onclick = function () { var s = XCR.text(p); var ok = function () { cp.textContent = 'Copied'; };
      try { if (G.navigator.clipboard && G.navigator.clipboard.writeText) return G.navigator.clipboard.writeText(s).then(ok, function () { fallback(s); ok(); }); } catch (er) {} fallback(s); ok(); };
    function fallback(s) { try { var a = d.createElement('textarea'); a.value = s; a.style.cssText = 'position:fixed;left:-9999px'; d.body.appendChild(a); a.select(); d.execCommand && d.execCommand('copy'); a.remove(); } catch (er) {} }
    x.onclick = function () { e.remove(); XCR.prev = null; };
    d.body.appendChild(e); XCR.shown = why; return e;
  };
  // A match the player left normally: back on the menu after it was playable. A load that never became playable keeps its
  // record (a crash during the load is the case this is for); a lost match logged 'match-lost' (fatal) before it got here.
  XCR.poll = function () { var r = XCR.rec, d = G.document, l = d && d.getElementById('lobby'); if (r.inMatch && r.stage === 'playable' && l && l.style.display === 'flex') XCR.end(); };
  setInterval(XCR.poll, 2000);
  save();
  if (G.document) { if (G.document.readyState === 'loading') G.document.addEventListener('DOMContentLoaded', function () { XCR.note(); }); else XCR.note(); }
})();
// ---- END CRASH REPORT ----
