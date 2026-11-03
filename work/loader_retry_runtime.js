// ---- LOADER RETRY ----
// Map / agent / weapon asset fetches: a concurrency cap and retries (user 2026-10-28, Firefox on the live page: a map load
// logged ~75x "THREE.GLTFLoader: Couldn't load texture textures/<hash>.png" and 5x "Uncaught (in promise) TypeError: Error in
// input stream", Firefox's error for an interrupted HTTP body; the server answered 200 to every texture). A map is ~373
// textures / 55 MB, and three's ImageBitmapLoader fetched every one at once, so a body that broke off left that surface
// untextured (GLTFLoader turns a failed texture into null). three r149's FileLoader (the glTF / .bin / .glb fetch) re-wraps
// the body in a progress stream whose reader.read() has no rejection handler: an interrupted body is an unhandled
// rejection AND the wrapped stream never settles, so that asset's load hangs (no onLoad, no onError).
// Fix, without touching the CDN three files: this script runs right after GLTFLoader.js and replaces three's
// ImageBitmapLoader / ImageLoader / FileLoader .load with versions that queue through one fetch pool (LR.cap at a time;
// glTF / .bin / .glb ahead of textures) and retry a failed fetch + body read + decode up to LR.retries times with backoff
// (LR.backoff ms), keeping three's LoadingManager (itemStart / itemEnd / itemError), Cache and callback contract. HTTP 4xx
// other than 408 / 429 is not retried. data: / blob: URLs bypass the pool. A last-resort unhandledrejection filter
// swallows (with one warning) only fetch-interruption TypeErrors, so no stray loader promise reaches the page's error toast.
(function () {
  'use strict';
  const G = typeof window !== 'undefined' ? window : globalThis;
  const T = G.THREE;
  const LR = G.xLoaderRetry = { cap: 10, retries: 3, backoff: [400, 1200, 3000], active: 0, peak: 0, queued: 0, retried: 0, failed: 0, loaded: 0, swallowed: 0, installed: false };
  const NETERR = /input stream|NetworkError|Failed to fetch|Load failed|network error|network connection|ERR_|aborted|terminated/i;
  if (typeof G.addEventListener === 'function') G.addEventListener('unhandledrejection', (e) => {
    const r = e && e.reason;
    if (!r || (r.name !== 'TypeError' && r.name !== 'AbortError') || !NETERR.test(String(r.message || ''))) return;
    LR.swallowed++; if (LR.swallowed === 1) console.warn('asset fetch interrupted (retried by the loader):', String(r.message || r));
    if (typeof e.preventDefault === 'function') e.preventDefault();
  });
  if (!T || typeof T.Loader !== 'function' || typeof G.fetch !== 'function') return;
  // ---- the pool: hi = glTF / buffers (small, gate everything else), lo = images ----
  const hi = [], lo = [];
  function pump() {
    while (LR.active < LR.cap && (hi.length || lo.length)) {
      const job = hi.length ? hi.shift() : lo.shift(); LR.queued--; LR.active++; if (LR.active > LR.peak) LR.peak = LR.active;
      let done = false; const release = () => { if (done) return; done = true; LR.active--; pump(); };
      let p; try { p = Promise.resolve(job.run()); } catch (e) { p = Promise.reject(e); }
      p.then((v) => { release(); job.ok(v); }, (e) => { release(); job.no(e); });
    }
  }
  function slot(run, high) { return new Promise((ok, no) => { (high ? hi : lo).push({ run, ok, no }); LR.queued++; pump(); }); }
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  function retryable(e) { const s = e && e.status; return !(s >= 400 && s < 500 && s !== 408 && s !== 429); }
  function httpError(url, res) { const e = new Error('fetch for "' + url + '" responded with ' + res.status + ': ' + (res.statusText || '')); e.name = 'HttpError'; e.status = res.status; e.response = res; return e; }
  // One attempt = fetch + full body read (+ decode) inside a pool slot; the slot is free during the backoff wait.
  function attempt(url, init, read, high) {
    const direct = /^(data|blob):/i.test(url);
    const pre = !direct && PF.take(url); // map prefetch (below): the body already fetched / in flight during the room countdown
    if (pre) return pre.then((blob) => { PF.hits++; LR.loaded++; return read(new G.Response(blob, { status: 200 })); }, () => { PF.misses++; return attempt(url, init, read, high); });
    const once = () => G.fetch(url, init).then((res) => { if (res.status !== 200 && res.status !== 0 && !(res.ok)) throw httpError(url, res); return read(res); });
    if (direct) return once();
    let n = 0;
    const go = () => slot(once, high).catch((e) => {
      if (n >= LR.retries || !retryable(e)) { LR.failed++; throw e; }
      const ms = LR.backoff[Math.min(n, LR.backoff.length - 1)]; n++; LR.retried++;
      return wait(ms).then(go);
    });
    return go().then((v) => { LR.loaded++; return v; });
  }
  LR.fetch = attempt;
  const cacheGet = (url) => (T.Cache && T.Cache.get(url));
  const cacheAdd = (url, v) => { if (T.Cache) T.Cache.add(url, v); };
  function cached(scope, url, hit, onLoad) { scope.manager.itemStart(url); setTimeout(() => { if (onLoad) onLoad(hit); scope.manager.itemEnd(url); }, 0); return hit; }
  // ---- ImageBitmapLoader (Chrome / Edge / Firefox >= 98: GLTFLoader's texture path) ----
  if (T.ImageBitmapLoader) T.ImageBitmapLoader.prototype.load = function (url, onLoad, onProgress, onError) {
    if (url === undefined) url = ''; if (this.path !== undefined) url = this.path + url; url = this.manager.resolveURL(url);
    const scope = this, hit = cacheGet(url); if (hit !== undefined) return cached(scope, url, hit, onLoad);
    const init = { credentials: this.crossOrigin === 'anonymous' ? 'same-origin' : 'include', headers: this.requestHeader };
    scope.manager.itemStart(url);
    attempt(url, init, (res) => res.blob().then((blob) => G.createImageBitmap(blob, Object.assign(scope.options, { colorSpaceConversion: 'none' }))), false)
      .then((bmp) => { cacheAdd(url, bmp); try { if (onLoad) onLoad(bmp); } catch (e) { console.error(e); } scope.manager.itemEnd(url); },
        (e) => { try { if (onError) onError(e); } catch (x) { console.error(x); } scope.manager.itemError(url); scope.manager.itemEnd(url); });
  };
  // ---- ImageLoader (Safari / old Firefox: TextureLoader): one <img>, src re-set per attempt, same pool + retries ----
  if (T.ImageLoader && G.document && typeof G.document.createElementNS === 'function') T.ImageLoader.prototype.load = function (url, onLoad, onProgress, onError) {
    if (this.path !== undefined) url = this.path + url; url = this.manager.resolveURL(url);
    const scope = this, hit = cacheGet(url); if (hit !== undefined) return cached(scope, url, hit, onLoad);
    const direct = /^(data|blob):/i.test(url), cors = this.crossOrigin; let src = url, obj = null;
    const img = G.document.createElementNS('http://www.w3.org/1999/xhtml', 'img'); // one element, returned synchronously as three does; each attempt re-sets its src
    const one = () => new Promise((ok, no) => {
      const off = () => { img.removeEventListener('load', l, false); img.removeEventListener('error', er, false); };
      const l = function () { off(); ok(img); }, er = function (ev) { off(); const e = new Error('image failed: ' + url); e.event = ev; no(e); };
      img.addEventListener('load', l, false); img.addEventListener('error', er, false);
      if (!direct && !obj && cors !== undefined) img.crossOrigin = cors;
      img.src = src; // re-setting src (even to the same value) starts a new fetch
    });
    let n = 0;
    const go = () => (direct ? one() : slot(one, false)).catch((e) => { if (direct || n >= LR.retries) { LR.failed++; throw e; } const ms = LR.backoff[Math.min(n, LR.backoff.length - 1)]; n++; LR.retried++; return wait(ms).then(go); });
    scope.manager.itemStart(url);
    // map prefetch (Safari / WebKit: this <img> path): a prefetched body is shown from an object URL instead of fetched again
    const pre = !direct && PF.take(url), drop = () => { if (obj) { try { G.URL.revokeObjectURL(obj); } catch (e) {} obj = null; } };
    const run = pre ? pre.then((b) => { obj = G.URL.createObjectURL(b); src = obj; return one(); }).then(() => { PF.hits++; drop(); }, () => { PF.misses++; drop(); src = url; return go(); }) : go();
    run.then(() => { LR.loaded++; cacheAdd(url, img); try { if (onLoad) onLoad(img); } catch (e) { console.error(e); } scope.manager.itemEnd(url); },
      (e) => { try { if (onError) onError(e.event || e); } catch (x) { console.error(x); } scope.manager.itemError(url); scope.manager.itemEnd(url); });
    return img;
  };
  // ---- FileLoader (glTF json / .bin / .glb): body read whole inside the attempt, so an interrupted body rejects and retries ----
  if (T.FileLoader) {
    const loading = {};
    T.FileLoader.prototype.load = function (url, onLoad, onProgress, onError) {
      if (url === undefined) url = ''; if (this.path !== undefined) url = this.path + url; url = this.manager.resolveURL(url);
      const scope = this, hit = cacheGet(url); if (hit !== undefined) return cached(scope, url, hit, onLoad);
      if (loading[url] !== undefined) { loading[url].push({ onLoad, onProgress, onError }); return; }
      loading[url] = [{ onLoad, onProgress, onError }];
      const headers = typeof G.Headers === 'function' ? new G.Headers(this.requestHeader) : this.requestHeader;
      const init = { headers, credentials: this.withCredentials ? 'include' : 'same-origin' };
      const type = this.responseType, mime = this.mimeType;
      const read = (res) => {
        switch (type) {
          case 'arraybuffer': return res.arrayBuffer();
          case 'blob': return res.blob();
          case 'document': return res.text().then((t) => new G.DOMParser().parseFromString(t, mime));
          case 'json': return res.json();
          default:
            if (mime === undefined) return res.text();
            { const m = /charset="?([^;"\s]*)"?/i.exec(mime), label = m && m[1] ? m[1].toLowerCase() : undefined, dec = new G.TextDecoder(label); return res.arrayBuffer().then((ab) => dec.decode(ab)); }
        }
      };
      scope.manager.itemStart(url);
      attempt(url, init, read, true).then((data) => {
        cacheAdd(url, data);
        const cbs = loading[url] || []; delete loading[url];
        const size = data && (data.byteLength || data.size || data.length) || 0;
        let ev = null; try { ev = typeof G.ProgressEvent === 'function' ? new G.ProgressEvent('progress', { lengthComputable: size > 0, loaded: size, total: size }) : { type: 'progress', lengthComputable: size > 0, loaded: size, total: size }; } catch (e) {}
        for (const cb of cbs) { try { if (cb.onProgress && ev) cb.onProgress(ev); if (cb.onLoad) cb.onLoad(data); } catch (e) { console.error(e); scope.manager.itemError(url); } }
      }, (err) => {
        const cbs = loading[url] || []; delete loading[url];
        for (const cb of cbs) { try { if (cb.onError) cb.onError(err); } catch (e) { console.error(e); } }
        scope.manager.itemError(url);
      }).then(() => scope.manager.itemEnd(url));
    };
  }
  // ---- MAP PREFETCH (loadfast 1, user 2026-11-03 "loading into the game for multiplayer takes really long") ----
  // An online room knows its map from the moment the room is assigned, but every map byte (Ascent: scene.gltf + 10 geometry
  // .bin files 177 MB + 373 textures 13.6 MB) was fetched only after the 'start' message, i.e. after the 5 s countdown.
  // xMapPrefetch.start(key) (server_runtime: the 'room' message) fetches the map's scene.gltf, then its buffers and images,
  // PF.cap at a time, as Blobs (held by the browser's blob store, not as page ArrayBuffers). attempt() above hands a
  // prefetched or in-flight body to the glTF loaders (PF.take): each URL is downloaded once. A URL the loader asked for
  // before the prefetch reached it is claimed by the loader and never prefetched; a queued one is dropped from the queue.
  // A failed prefetch falls back to the loader's own fetch + retries. start(other map) / stop() abort the in-flight fetches
  // and drop every held body (room map changed, room left, map loaded: nmEnsure / nmLoadScene).
  const PF = G.xMapPrefetch = { cap: 6, key: null, base: null, ctl: null, entries: new Map(), claimed: new Set(), queue: [], active: 0,
    hits: 0, misses: 0, fetched: 0, bytes: 0, held: 0, aborted: 0, started: 0, gen: 0 };
  const norm = (u) => { try { return new G.URL(String(u), (G.location && G.location.href) || 'http://localhost/').href; } catch (e) { return String(u); } };
  function pfPump() {
    while (PF.active < PF.cap && PF.queue.length) {
      const e = PF.queue.shift(); if (e.state !== 'queued') continue; e.state = 'busy'; PF.active++;
      const gen = PF.gen, sig = PF.ctl && PF.ctl.signal;
      e.go(G.fetch(e.url, { signal: sig, credentials: 'same-origin' }).then((res) => { if (!res.ok && res.status !== 0) throw httpError(e.url, res); return res.blob(); })
        .then((b) => { e.size = b.size || 0; if (gen === PF.gen) { PF.fetched++; PF.bytes += e.size; if (PF.entries.get(e.key) === e) PF.held += e.size; } e.state = 'done'; return b; },
          (err) => { e.state = 'failed'; throw err; })
        .finally(() => { if (gen === PF.gen) { PF.active--; pfPump(); } }));
    }
  }
  function pfAdd(url, first) {
    const k = norm(url); if (PF.entries.has(k) || PF.claimed.has(k)) return null;
    let go; const p = new Promise((ok, no) => { go = (q) => q.then(ok, no); }); p.catch(() => {});
    const e = { url, key: k, state: 'queued', p, go, size: 0 }; PF.entries.set(k, e); if (first) PF.queue.unshift(e); else PF.queue.push(e); pfPump(); return e;
  }
  PF.start = function (key) {
    if (typeof key !== 'string' || !/^[a-z0-9_-]+$/i.test(key) || typeof G.fetch !== 'function') return false;
    if (PF.key === key) return true;
    PF.stop(); PF.key = key; PF.base = 'models/valorant/maps/' + key + '/'; PF.ctl = typeof G.AbortController === 'function' ? new G.AbortController() : null; PF.started++;
    const gen = PF.gen, root = pfAdd(PF.base + 'scene.gltf', true);
    if (root) root.p.then((b) => b.text()).then((t) => { if (gen !== PF.gen) return; const j = JSON.parse(t), ok = (u) => typeof u === 'string' && u && !/^(data|blob):/i.test(u);
      for (const b of j.buffers || []) if (ok(b.uri)) pfAdd(PF.base + b.uri); // geometry first: the glTF parser waits on it before any texture is bound
      for (const im of j.images || []) if (ok(im.uri)) pfAdd(PF.base + im.uri); }).catch(() => {});
    return true;
  };
  // Drop everything: abort in-flight fetches (a body the loader already took is unaffected once taken: its promise settled or
  // falls back to the loader's own fetch), release every held Blob.
  PF.stop = function () {
    PF.gen++; if (PF.ctl) { try { PF.ctl.abort(); } catch (e) {} }
    for (const e of PF.entries.values()) if (e.state === 'busy' || e.state === 'queued') PF.aborted++;
    PF.entries.clear(); PF.claimed.clear(); PF.queue.length = 0; PF.active = 0; PF.held = 0; PF.key = PF.base = PF.ctl = null;
  };
  // The loader's request for url: the prefetched / in-flight body (handed over once, then forgotten), or null (fetch it
  // yourself). Under the prefetched map's folder an unknown or still-queued URL is claimed so the prefetch never repeats it.
  PF.take = function (url) {
    if (!PF.key) return null; const k = norm(url), e = PF.entries.get(k);
    if (!e) { if (k.indexOf(norm(PF.base)) === 0) PF.claimed.add(k); return null; }
    PF.entries.delete(k); PF.claimed.add(k);
    if (e.state === 'queued') { e.state = 'taken'; const i = PF.queue.indexOf(e); if (i >= 0) PF.queue.splice(i, 1); return null; }
    if (e.state === 'done') PF.held -= e.size;
    return e.p;
  };
  PF.stats = function () { return { key: PF.key, hits: PF.hits, misses: PF.misses, fetched: PF.fetched, bytes: PF.bytes, held: PF.held, aborted: PF.aborted, started: PF.started, pending: PF.entries.size }; };
  LR.installed = true;
})();
// ---- END LOADER RETRY ----
