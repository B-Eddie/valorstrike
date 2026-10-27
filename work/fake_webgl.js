// A do-nothing WebGL 1 context for the headless page harness (a tool, not loaded by the page). Evaluated inside the page
// context after three.js loads: window.__fakeGL() returns a context object that answers every call three r149's
// WebGLRenderer makes (capabilities, extensions, programs, buffers, textures, framebuffers) and counts the draw calls
// and buffer uploads, so the REAL WebGLRenderer can run render() / compile() / initTexture() without a GPU.
// window.__realRenderer(params) builds a real THREE.WebGLRenderer over a fresh fake context and canvas; every renderer
// it makes records render() exceptions in window.__GL.errors and counts draws per renderer in r.__draws.
(function () {
  const G = window.__GL = { errors: [], made: [], ctx: 0 };
  const names = {};let next = 0x8000;
  const K = (n) => (n in names ? names[n] : (names[n] = next++));
  function ext(name) { return new Proxy({ name }, { get(t, k) { if (k in t) return t[k]; if (typeof k !== 'string') return undefined; if (/^[A-Z0-9_]+$/.test(k)) return K(name + '.' + k); return function () { return /^create/.test(k) ? {} : /^is/.test(k) ? true : undefined; }; } }); }
  window.__fakeGL = function (canvas, owner) {
    const st = { draws: 0, uploads: 0, nullUploads: 0, foreign: 0, foreignCalls: {} }, cid = ++G.ctx;
    const impl = {
      canvas, drawingBufferWidth: 1, drawingBufferHeight: 1, __st: st,
      getContextAttributes() { return { alpha: false, antialias: !!(owner && owner.antialias), depth: true, stencil: false, premultipliedAlpha: true, preserveDrawingBuffer: false, powerPreference: 'high-performance' }; },
      isContextLost() { return false; },
      getExtension(n) { return ext(n); }, getSupportedExtensions() { return []; },
      getParameter(p) { switch (p) { case 7938: return 'WebGL 1.0'; case 35724: return 'WebGL GLSL ES 1.0'; case 7936: case 7937: return 'fake'; case 2978: case 3088: return new Int32Array([0, 0, 1, 1]); case 36183: return 4; case 34930: case 35660: case 35661: case 34921: return 16; case 36347: case 36348: case 36349: return 1024; default: return 4096; } },
      getShaderPrecisionFormat() { return { precision: 23, rangeMin: 127, rangeMax: 127 }; },
      getProgramParameter(pr, p) { return p === 35714 ? true : 0; }, getShaderParameter() { return true; },
      getProgramInfoLog() { return ''; }, getShaderInfoLog() { return ''; }, getShaderSource() { return ''; }, getError() { return 0; },
      getUniformLocation() { return { __ctx: cid }; }, getAttribLocation() { return -1; }, checkFramebufferStatus() { return 36053; },
      bufferData(t, a) { st.uploads++; if (a == null) st.nullUploads++; },
      drawElements() { st.draws++; }, drawArrays() { st.draws++; },
    };
    const chk = (k, args) => { for (const a of args) if (a && typeof a === 'object' && a.__ctx && a.__ctx !== cid) { st.foreign++; st.foreignCalls[k] = (st.foreignCalls[k] || 0) + 1; } };
    const wrap = (k, f) => function () { chk(k, arguments); const r = f.apply(impl, arguments); return r; };
    const cache = {};
    return new Proxy(impl, { get(t, k) { if (typeof k !== 'string') return t[k]; if (k in cache) return cache[k]; if (k in t) { const v = t[k]; return typeof v === 'function' ? (cache[k] = wrap(k, v)) : v; } if (/^[A-Z0-9_]+$/.test(k)) return K(k); return (cache[k] = wrap(k, function () { return /^create/.test(k) ? { __ctx: cid } : /^is/.test(k) ? true : undefined; })); } });
  };
  window.__realRenderer = function (params) {
    params = Object.assign({}, params || {});
    const canvas = document.createElement('canvas'), L = {};
    canvas.addEventListener = canvas.addEventListener || function (n, f) { (L[n] = L[n] || []).push(f); };
    canvas.removeEventListener = canvas.removeEventListener || function () {};
    canvas.style = canvas.style || {};
    const gl = window.__fakeGL(canvas, params); params.canvas = canvas; params.context = gl;
    const R = Object.getPrototypeOf(THREE.WebGL1Renderer); // the real WebGLRenderer (the harness stubs THREE.WebGLRenderer; WebGL1Renderer extends the real one)
    const r = new R(params);
    r.__gl = gl; r.__id = G.made.length + 1; r.__antialias = !!params.antialias; G.made.push(r);
    const draw = r.render;
    r.render = function () { try { return draw.apply(this, arguments); } catch (e) { G.errors.push({ id: r.__id, msg: String((e && e.message) || e) }); throw e; } };
    Object.defineProperty(r, '__draws', { get: () => gl.__st.draws });
    return r;
  };
})();
