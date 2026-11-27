# Lane three (three.js upgrade + batching) — started 2026-11-26 10:30 EST
Worktree /workspace/work/vs-lane-three (branch lane-three) off origin/main e2c14eda. server/node_modules -> main clone.
Approved by Jeff 2026-11-26 ("yes"). Rules: no visual downgrade, pixel gate SSIM>=0.995/view, never push failing tests.

## Findings (step 1-3)
- Current three: NOT vendored. index.html loads CDN three r149 (unpkg build/three.min.js) + GLTFLoader/SkeletonUtils r147
  (jsdelivr examples/js). Test harnesses route those URLs by basename to /workspace/work/qa/{three.min.js,...} (= r149, cmp ok).
- Target chosen: r170.0 (BatchedMesh w/ addInstance/setCustomSort/perObjectFrustumCulled/optimize, WEBGL_multi_draw;
  shader chunks r166->r170 nearly identical; before r180 PCFSoft deprecation / r17x shadow rewrites).
  r160+ ships no UMD build -> vendored IIFE bundle built by work/three/build.cjs (esbuild, deterministic) -> vendor/three/
  {three.min.js,GLTFLoader.js,SkeletonUtils.js} same basenames; install_valorant.py swaps the CDN tags for them.
- Page already: ColorManagement.legacyMode=false, main renderer physicallyCorrectLights=true, outputEncoding sRGB, ACES 1.05.
  Preview renderers (xAgent, AGV, XSK.pv) leave physicallyCorrectLights off (legacy PI scale), hemi+directional only.
- Breaking changes found + handling (work/three/patches.cjs = source patches, work/three/compat.js = API shims):
  * render-list sort depth: r151+ bounding-sphere centre (r16x clip-space Vector4) vs r149 origin NDC -> PATCH back to r149
    (equal-depth / coplanar winners + transparent order depend on it).
  * Frustum.intersectsObject: r151+ SkinnedMesh/InstancedMesh own boundingSphere (skinned once in JS) -> PATCH geometry
    sphere (r149) except BatchedMesh.
  * physicallyCorrectLights removed (r155 physical default, r165 legacy removed) -> PATCH renderer.physicallyCorrectLights
    + WebGLLights PI scaleFactor exactly where r149 applied it. Legacy point/spot attenuation formula NOT restored (no
    point/spot lights in legacy-mode renderers). lightMapIntensity PI scale not restored (no lightmaps).
  * outputEncoding/texture.encoding/sRGBEncoding removed (r162) -> compat accessors (r152 mapping); renderer default
    outputColorSpace PATCHED to Linear (r149 default LinearEncoding).
  * SkinnedMesh.boneTransform removed -> alias to applyBoneTransform.
  * GLTFLoader r170 uses ImageBitmapLoader on Safari>=17 -> PATCH back to TextureLoader on Safari (XV_TEXCAP/iOS budget).
  * Skeleton.update: r170 calls it from WebGLObjects.update (only for frustum-passing meshes) vs r149 projectObject (all);
    XSGR defer/flush wraps still apply (renderBufferDirect is still public + used via _this.).
  * Object3D.updateMatrixWorld: matrixWorldAutoUpdate semantics changed (r1xx) but page never sets it false -> same.
  * uv refactor r151 (vMapUv): NM_GROUND_FS already switches on REVISION; nmArrShader uses vUv -> check compile.
  * shader chunk diffs r149->r170 (lights_physical_pars 351 lines, bsdfs, normal_fragment_begin, tonemapping saturate,
    shadow intensity mix) -> empirical pixel gate.
  * WebGL1 dropped r163 (page already needs WebGL2 for its texture arrays path; fallback path loses three r149 WebGL1).
  * test harness defaults REAL3_DIR '/workspace/work/qa' (r149) -> repo vendor/three, so node tests run the shipped three.

## Log
- 10:30 worktree created. 10:50 audit done. 11:05 build.cjs/patches/compat written, bundle deterministic (md5 x2).
  install_valorant.py: CDN->vendor tags, regen x2 byte-identical (b34d461e).
- 11:35 tests adapted: test_loader_retry (tag position; r170 FileLoader rejects interrupted .bin instead of hanging),
  test_crash_report (three is same-origin now). REAL3_DIR default -> vendor/three in 9 harness/test files.
- 11:45 PIXEL ascent medium 1280x720 map-only 26 views (qa/three/h.cjs MODE=map, readPixels): base r149 vs lane r170
  = 0 px differ in all 26 views, SSIM 1.0, same calls/tris per view (shots/ascent-medium-{base1,lane1}). Bundle globalThis fix.
- 11:52 match-scene harness (agents.cjs + js/agents_setup.js + js/abil_setup.js): frozen loop, 9 agents posed (bind pose +
  idle clip at fixed t) in a lineup, FP viewmodel fixed (Vandal Prime / knife BlastX / Classic), ability FX w/ reseeded RNG,
  HUD compositor screenshot. Queue q1: bind low base A, lane, base B (noise).
- (backfill, 2026-11-26) Confirmed state: Ascent medium map-only 26 views 0 px / SSIM 1.0 / identical draws+tris.
  Passing on lane: test_loader_retry, map_load_memory, crash_report, map_prefetch, asset_versions, renderer_rebind,
  render_quality, frame_governor.
- Open: (1) match harness nondeterministic (base vs base SSIM 0.58-0.85): lineup ground height from random teammate,
  viewmodel frozen mid-crossfade, OOM w/ several weapons. (2) Bind low match view lane 216 calls vs base 192.
- 2026-11-26 11:10 session resumed (Jeff approved ship 2026-11-26).
- 11:25 HARNESS determinism fixes (js/agents_setup.js): lineup ground gy = round(spawn eye y - 1.6) (const 4.223 on bind,
  was allies[0] y 4.19/4.21); VF_WARMQ drained + any non-current rig removed from VF_VIEW.scene (logged as vfDrop);
  viewmodel: stopAllAction on both mixers AND F.action=F.gaction=null before xvFPPlay('idle',0.3) - the page's xvFPPlay
  override crossFadeFrom(previous action) so the frozen frame sat at fade-in weight 0.00 (logged fpAct weights).
- 216 vs 192 EXPLAINED (draw-list diff dlbase vs dllane, shots/bind-low-dl*-drawlist-vandal.json): it is NOT the upgrade.
  The r149 BASE run drew 216 and the r170 lane 192 in that pair; earlier mbaseA=192, mbaseB=216 (both r149). The +24
  are all viewmodel-layer draws: a second Vandal Prime rig (FP_Wushu arms x1, GN_AK_Lv2_HypeBeast md/md_1..3 sk x1,
  RedDot sk, magazines, shell) + unskinned weapon glTF parts = a pending vfWarm queue entry flushed by the shot render
  (scissored to 1 px) and a stale rig left from the buy race. Same names, same materials; timing race in the page.
- 11:40 determinism now OK: base dC vs base dB (r149 x2) 103 px total, SSIM >= 0.99994 (a0-a5). draws per view equal
  base/lane for vandal views (192,193,191,187,192,196,82,114,14). OOM (kernel oom-kill headless_shell) still hits ~1 in 3
  match runs at the first shot -> CDP HeapProfiler.collectGarbage before shots added.
- LANE vs BASE bind low match (dC vs dL): FAIL. vandal views SSIM 0.983-0.9996: (a) Gekko's pose is shifted (edge outline
  diff, 3.6k px >20) - investigating with bone dumps (js/bones.js, BONES=only); (b) viewmodel weapon lower part (grip/mag
  stripes) differs up to 74/255 over ~800 px, rest of the weapon +-1 (23k px). abil views 0.991-0.995 and 247 vs 257 calls.
