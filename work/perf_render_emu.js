// JS-side WebGLRenderer model for the headless page harness (perf profiling and guard tests; a tool, not loaded by the page).
// Evaluated inside the page context (the harness's real three.js scene graph, WebGL stubbed). It replaces the stubbed
// renderer's render / compile / initTexture / info with a model of what three r147 / r149 does on the CPU each frame:
// scene.updateMatrixWorld, frustum culling, skeleton.update, one draw per visible mesh / material group, and it COUNTS
// the GPU work a real renderer would issue: draw calls, triangles, shader programs (new program cache keys, i.e. compiles),
// texture uploads (texStorage2D allocation + texSubImage2D per texture source, the same rules as three's WebGLTextures,
// so a sub-image bigger than the allocated storage - Firefox's "texSubImage: Offset+size must be <= the size of the existing
// specified image" - is detected), new geometries (buffer creation) and attribute re-uploads (bufferSubData).
// window.__PS holds the counters; __PS.live marks the measured phase (anything created while live is "mid-match").
(function () {
  const R = renderer, T = THREE;
  if (!R || window.__PS) return;
  const S = window.__PS = { frame: 0, live: false, calls: 0, tris: 0, shadowCalls: 0, shadowBakes: 0,
    progs: new Map(), progNew: [], tex: new Map(), gltex: new Map(), up: [], upBytes: 0, grow: [], realloc: [], nullData: [],
    geo: new WeakSet(), geoNew: 0, geoNewLive: [], attr: new WeakMap(), attrUp: 0, attrBytes: 0, matSeen: new WeakMap(), matNewLive: 0, matVerLive: 0,
    fr: { calls: 0, tris: 0, prog: 0, tex: 0, texBytes: 0, geo: 0, attr: 0, attrBytes: 0, shadow: 0 } };
  const PK = new WeakMap(), fr = new T.Frustum(), m4 = new T.Matrix4(), SLOTS = ["map", "normalMap", "roughnessMap", "metalnessMap", "emissiveMap", "aoMap", "alphaMap", "envMap", "lightMap", "bumpMap", "specularMap", "displacementMap", "gradientMap", "matcap", "clearcoatMap", "clearcoatNormalMap", "clearcoatRoughnessMap", "sheenColorMap", "transmissionMap", "thicknessMap"];
  const info = { render: { calls: 0, triangles: 0, points: 0, lines: 0, frame: 0 }, memory: { geometries: 0, textures: 0 }, programs: [], autoReset: true, reset() { this.render.calls = 0; this.render.triangles = 0; this.render.points = 0; this.render.lines = 0; } };
  function dims(img) { if (!img) return null; if (typeof img.close === "function" && img.__closed) return { w: 0, h: 0, closed: true }; return { w: img.width || img.videoWidth || 0, h: img.height || img.videoHeight || 0 }; }
  function cacheKey(t) { return [t.wrapS, t.wrapT, t.magFilter, t.minFilter, t.anisotropy, t.format, t.type, t.generateMipmaps, t.premultiplyAlpha, t.flipY, t.unpackAlignment, t.encoding, t.colorSpace].join(); }
  // three r147 / r149 WebGLTextures.setTexture2D -> uploadTexture (WebGL2, texStorage path):
  //  - one GL texture per (source, cacheKey); a new one is "forceUpload" (allocate + upload)
  //  - allocateMemory = this Texture's __version is undefined, or forceUpload
  //  - the source is uploaded when source.version differs from the GL texture's source version
  function texUse(t) {
    if (!t || !t.isTexture || t.isRenderTargetTexture || t.isFramebufferTexture) return;
    if (!(t.version > 0)) return;
    let tp = S.tex.get(t); if (!tp) { tp = { v: undefined, key: undefined, gl: null }; S.tex.set(t, tp); }
    if (tp.v === t.version) return;
    const src = t.source || { data: t.image, version: t.version }, img = src.data;
    if (img == null) { S.nullData.push({ f: S.frame, live: S.live, n: t.name || "" }); return; }
    const key = cacheKey(t); let force = false, per = S.gltex.get(src); if (!per) { per = new Map(); S.gltex.set(src, per); }
    if (tp.key !== key) { let g = per.get(key); if (!g) { g = { w: -1, h: -1, sv: undefined, alloc: false }; per.set(key, g); force = true; } tp.gl = g; tp.key = key; }
    const g = tp.gl, alloc = tp.v === undefined || force;
    if (src.version !== g.sv || force) {
      const d = img.isDataTexture ? { w: img.width, h: img.height } : (img.data && img.width != null ? { w: img.width, h: img.height } : dims(img));
      if (alloc) { if (g.alloc && !force) S.realloc.push({ f: S.frame, live: S.live, w: d.w, h: d.h, w0: g.w, h0: g.h, n: t.name || "" }); else { g.alloc = true; g.w = d.w; g.h = d.h; } }
      const bytes = Math.max(0, d.w * d.h * 4);
      if (d.w > g.w || d.h > g.h) S.grow.push({ f: S.frame, live: S.live, w: d.w, h: d.h, w0: g.w, h0: g.h, n: t.name || "", cls: img.constructor && img.constructor.name });
      S.up.push({ who: CUR ? who(CUR) : '', k: alloc ? "texStorage+texSubImage" : "texSubImage", w: d.w, h: d.h, f: S.frame, live: S.live, n: t.name || (img.constructor && img.constructor.name) || "", site: t.__site });
      S.upBytes += bytes; S.fr.tex++; S.fr.texBytes += bytes; g.sv = src.version;
      if (typeof t.onUpdate === "function") try { t.onUpdate(t); } catch (e) {}
    }
    tp.v = t.version;
  }
  function who(o) { let s = [], x = o; for (let i = 0; i < 4 && x; i++, x = x.parent) s.push((x.name || x.type) + (x.userData && Object.keys(x.userData).length ? '{' + Object.keys(x.userData).slice(0, 3).join(',') + '}' : '')); return s.join('<'); }
  let CUR = null;
  function geoUse(g) {
    if (!g) return;
    if (!S.geo.has(g)) { S.geo.add(g); S.geoNew++; S.fr.geo++; if (S.live) { S.geoNewLive.push(g.type || "BufferGeometry"); (S.geoWho || (S.geoWho = [])).push([S.frame, g.type, CUR ? who(CUR) : '']); } }
    const as = g.attributes; for (const k in as) attrUse(as[k]); if (g.index) attrUse(g.index);
  }
  function attrUse(a) {
    if (!a) return; const v = S.attr.get(a); if (v === undefined) { S.attr.set(a, a.version); return; }
    if (v !== a.version) { S.attr.set(a, a.version); const n = a.updateRange && a.updateRange.count > 0 ? a.updateRange.count : (a.array ? a.array.length : 0); S.attrUp++; S.fr.attr++; const b = n * (a.array ? a.array.BYTES_PER_ELEMENT : 4); S.attrBytes += b; S.fr.attrBytes += b; }
  }
  function progKey(m, o) {
    const k = [m.type, m.customProgramCacheKey ? m.customProgramCacheKey() : "", m.onBeforeCompile ? String(m.onBeforeCompile).length : 0, !!m.map, !!m.normalMap, !!m.emissiveMap, !!m.alphaMap, !!m.aoMap, !!m.envMap, !!m.roughnessMap, !!m.metalnessMap,
      !!m.vertexColors, !!m.transparent, m.alphaTest > 0, m.side, !!m.fog, !!m.flatShading, !!o.isSkinnedMesh, !!o.isInstancedMesh, !!(o.isInstancedMesh && o.instanceColor), !!(o.morphTargetInfluences), m.defines ? JSON.stringify(m.defines) : "",
      !!(o.receiveShadow && R.shadowMap && R.shadowMap.enabled === true), m.toneMapped !== false, !!o.isPoints && m.sizeAttenuation, m.isShaderMaterial ? (m.vertexShader || "").length + ":" + (m.fragmentShader || "").length : "", m.depthPacking || 0, m.wireframe ? 1 : 0];
    return k.join("|");
  }
  function matUse(m, o) {
    if (!m) return;
    const mv = S.matSeen.get(m);
    if (mv === undefined) { S.matSeen.set(m, m.version); if (S.live) { S.matNewLive++; (S.matWho || (S.matWho = [])).push([S.frame, m.type, who(o)]); } }
    else if (mv !== m.version) { S.matSeen.set(m, m.version); if (S.live) S.matVerLive++; }
    const of = (o.isSkinnedMesh ? 1 : 0) | (o.isInstancedMesh ? 2 : 0) | (o.isInstancedMesh && o.instanceColor ? 4 : 0) | (o.receiveShadow && R.shadowMap && R.shadowMap.enabled === true ? 8 : 0) | (o.morphTargetInfluences ? 16 : 0) | (o.isPoints ? 32 : 0);
    let pc = PK.get(m); if (!pc || pc.v !== m.version || pc.o !== of || pc.map !== m.map || pc.env !== m.envMap) { pc = { v: m.version, o: of, map: m.map, env: m.envMap, key: progKey(m, o) }; PK.set(m, pc); } // tool overhead: a key string per draw only when the material changed
    const key = pc.key; if (!S.progs.has(key)) { S.progs.set(key, S.frame); S.fr.prog++; if (S.live) S.progNew.push({ f: S.frame, key: key.slice(0, 160), obj: who(o), vs: m.vertexShader ? m.vertexShader.slice(0, 200) : "", site: m.__site }); }
    for (let i = 0; i < SLOTS.length; i++) { const t = m[SLOTS[i]]; if (t) texUse(t); }
    if (m.uniforms) for (const k in m.uniforms) { const u = m.uniforms[k]; const v = u && u.value; if (v && v.isTexture) texUse(v); }
  }
  function draw(o, m, count) { S.fr.calls++; info.render.calls++; const t = Math.max(0, Math.floor(count / 3)) * (o.isInstancedMesh ? Math.max(1, o.count) : 1); S.fr.tris += t; info.render.triangles += t; }
  function drawObj(o, cam) {
    const g = o.geometry, mat = o.material; if (!g || !mat) return; CUR = o;
    if (o.isSkinnedMesh && o.skeleton && o.skeleton.__pf !== S.frame) { o.skeleton.__pf = S.frame; o.skeleton.update(); }
    if (o.isInstancedMesh && o.count === 0) return;
    geoUse(g);
    const n = g.index ? g.index.count : g.attributes.position ? g.attributes.position.count : 0;
    if (Array.isArray(mat)) { const gr = g.groups; for (let i = 0; i < gr.length; i++) { const m = mat[gr[i].materialIndex]; if (m && m.visible) { matUse(m, o); draw(o, m, Math.min(gr[i].count, n - gr[i].start)); } } }
    else if (mat.visible) { matUse(mat, o); draw(o, mat, g.drawRange && g.drawRange.count !== Infinity ? Math.min(g.drawRange.count, n) : n); }
  }
  function project(o, cam) {
    if (o.visible === false) return;
    if (o.layers.test(cam.layers)) {
      if (o.isSprite) { if (!o.frustumCulled || fr.intersectsSprite(o)) drawObj(o, cam); }
      else if (o.isMesh || o.isLine || o.isPoints) { if (!o.frustumCulled || fr.intersectsObject(o)) drawObj(o, cam); }
    }
    const c = o.children; for (let i = 0; i < c.length; i++) project(c[i], cam);
  }
  function shadowPass(scene) { let n = 0; scene.traverseVisible((o) => { if ((o.isMesh || o.isPoints || o.isLine) && o.castShadow && o.geometry) { n++; geoUse(o.geometry); } }); S.shadowCalls += n; S.fr.shadow += n; S.shadowBakes++; }
  function render(scene, cam) {
    if (info.autoReset) info.reset();
    if (scene.matrixWorldAutoUpdate !== false && scene.autoUpdate !== false) scene.updateMatrixWorld();
    if (cam.parent === null && cam.matrixWorldAutoUpdate !== false) cam.updateMatrixWorld();
    const sm = R.shadowMap; if (sm && sm.enabled === true && (sm.autoUpdate === true || sm.needsUpdate === true) && scene === window.scene) { shadowPass(scene); sm.needsUpdate = false; }
    m4.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse); fr.setFromProjectionMatrix(m4);
    if (scene.background && scene.background.isTexture) texUse(scene.background);
    project(scene, cam);
  }
  function compile(scene, cam) { scene.traverseVisible((o) => { const m = o.material; if (!m) return; for (const x of [].concat(m)) { const key = progKey(x, o); if (!S.progs.has(key)) { S.progs.set(key, S.frame); if (S.live) S.progNew.push({ f: S.frame, key: key.slice(0, 160), obj: "compile" }); } } }); }
  R.render = render; R.compile = compile; R.initTexture = (t) => texUse(t); R.info = info;
  try { R.userData.vfBound = false; vfBindRenderer(R); } catch (e) {}
  S.endFrame = function () { const f = S.fr, o = { calls: f.calls, tris: f.tris, prog: f.prog, tex: f.tex, texBytes: f.texBytes, geo: f.geo, attr: f.attr, attrBytes: f.attrBytes, shadow: f.shadow }; for (const k in f) f[k] = 0; S.frame++; return o; };
})();
