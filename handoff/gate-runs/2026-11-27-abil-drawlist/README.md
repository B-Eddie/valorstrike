# 2026-11-27 abil draw-list probe: why lane c6ed1efc draws 10 fewer calls / ~1200 fewer tris than main e2c14eda on ability shots

Same config as gates 2026-11-27-uuid mbaseU1 / mlaneU1: bind low 960x540, VW=1, UU=1, runmatch.sh PRE + agents.cjs, SETTLE=3.
BASE = qa/three/base_wt @ e2c14eda (three r149 CDN route), LANE = vs-lane-three @ c6ed1efc (vendor three r170). One Chromium at a time
(LOCK-chromium.txt via lock.cjs). Attempts: base 1, lane 1; OOMs 0 (gates.txt, dmesg clean). No product code changed.

## Instrumentation (debug-only, harness copy `h_drawlist.cjs` + `dl_inpage.js`, gated by DL=1)
Around each shot matching DLSHOTS (default `^(abil_a\d|vandal_a0)$`): wraps `renderer.renderBufferDirect` (one row per call:
object, type, parent chain, material type/name/side/transparent/opacity, geometry drawRange, index/vertex count, group, instance
counts, render target, pass), `renderer.info.update` (attributes the exact calls/tris three counts to the current row) and
`gl.drawElements/drawArrays(+Instanced)` + `WEBGL_multi_draw` (cross-check). Restored right after the shot; a visible-renderable
census is taken after the render. `run.sh` = the driver; `dldiff.py` / `dropped.py` = diff scripts.

Sanity check: every dumped shot sums exactly to renderer.info and to the GL draw count (harness/*.json `dl.*.match = true`):
base abil_a0 262/2690003, abil_a1 259/1493476, abil_a2 266/2652618 (identical to mbaseU1); lane abil_a0 252/2692353,
abil_a1 250/1495828, abil_a2 256/2654968.

## Result (`dropped.txt` verbatim per object, `diff.txt` grouped)
The -10 calls are not missing objects. They are 10 ability-FX meshes with a **transparent, DoubleSide ShaderMaterial** that r149
draws twice (BackSide pass then FrontSide pass, rows show side 1 then 0) and r170 draws once (side 2):

| shot | dropped draws | tris |
|---|---|---|
| abil_a0 | 1x mesh idx270/v96 (Group) 90 + 5x plane idx6/v4 (Group) 5x2 + 3x idx36/v14 (scene root) 3x12 + 1x sphere idx3192/v609 (scene root) 1064 | -10 calls / -1200 tris |
| abil_a1 | same, but 4 planes in view (one of the 5 is culled on both builds) | -9 calls / -1198 tris |
| abil_a2 | same as abil_a0 | -10 calls / -1200 tris |

These match the mbaseU1-vs-mlaneU1 deltas exactly (-1200 / -1198 / -1200; abil_a1 was always -9, not -10). Nothing is drawn only on
lane apart from the weapon note below. Non-transparent DoubleSide ShaderMaterials (xSmokeM smoke, opacity 0.6, transparent:false)
are drawn once on both builds.

Owners (inferred from geometry signatures + index.html, not tagged at runtime): idx3192/v609 = SphereGeometry(1,28,20) =
`brxGeos().sph` with `brxShader` (brxSkySmokeAt, index.html:17767-17793/17852); the Group (idx270 mesh + PlaneGeometry(1,1) quads)
is most likely `sgxBarrierWall`'s group (`sgxShader`, index.html:18827/18887); the 3 scene-root idx36/v14 strips are most likely
phxBlazePath ribbons from blazeWall -> phxBlaze (`phxShader`, index.html:15082/15127). All of phx/sgx/brx/omx (and the other
`*xShader` helpers) build `new THREE.ShaderMaterial({... transparent: true, depthWrite: false, side: THREE.DoubleSide })`.

## Cause (three r149 -> r170)
r170 `src/materials/ShaderMaterial.js:37`: `this.forceSinglePass = true;` (r149 ShaderMaterial has no such line; Material default
is `false`, r149 `src/materials/Material.js:67`, r170 `Material.js:84`). Both `WebGLRenderer.renderObject` versions do the two-pass
draw only when `material.transparent === true && material.side === DoubleSide && material.forceSinglePass === false`
(r149 `src/renderers/WebGLRenderer.js:1315`, r170 `src/renderers/WebGLRenderer.js:1615`). Minified builds agree: lane
vendor/three/three.min.js has `this.clipping=!1,this.forceSinglePass=!0` in ShaderMaterial; qa/three.min.js (r149) does not.
Visual effect: on lane these FX render back and front faces in a single pass in index order instead of all back faces first,
so blending order can differ slightly (consistent with abil SSIM sitting inside the base noise band). Parity with main, if wanted,
would be `forceSinglePass: false` in those ShaderMaterial helpers (not done here; product untouched).

## Side finding: lane run-to-run nondeterminism (not part of the -10)
This lane run drew one third-person bot weapon as AK (+Vandal mag/red-dot/7.62 bullet) where base drew Luger+Silencer (9mm)
(mlaneU1/U2 tris equal base, so presumably Luger there too): 0 calls net, +3550 tris on every vandal shot except a6, and on every abil shot. So lane totals here are
+3550 tris vs mlaneU1 (vandal_a0 197/2681935 vs 197/2678385). Ability totals reconcile: -10/-1200 + 0/+3550 = -10/+2350
(a1: -9/-1198 + 0/+3550 = -9/+2352). Consistent with the lane-vs-lane non-bit-exactness noted in 2026-11-27-uuid.
