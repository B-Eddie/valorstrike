# Map quality pass: holes, boundaries, optimization (branch hark-map)

Scope: the six original maps (Ascent, Bind, Haven, Split, Lotus, Breeze), server collision world and offline client
(both walk the same BVH with the same shared motor: `server/src/motor.cjs` = `vendor/valorant-feel.js`).
Areas owned by others were left alone (hit feedback, hit-path perf / bot routing, gunplay, rule parity).

## Tools (server/tools, memory-light, one map at a time)

| tool | what it does |
|---|---|
| `map-holes.mjs` | 0.25 m grid around every playable nav node, downward rays on the collision BVH: `void` (nothing below), `gap` (enclosed crack, width), `edge` (open ledge); `fallable` = the leash lets a capsule centre stand there and its footprint ring (0.34 m) finds no floor |
| `map-collision-patch.mjs` | render floor (opaque, n.y > 0.7, not foliage/decal/glass/water) within 0.45 m of a playable node's floor where the collision has nothing within 0.3 m -> writes `models/valorant/maps/<key>/collision-patch.bin`; `build-world.cjs` appends it |
| `map-boundary.mjs` | from every border cell (stride 3 in the sweeps): walk, crouch-jump, Jett dash (server: 32 x 0.25 m flat), updraft (vy = sqrt(2*18*6)), updraft + dash at the apex, Raze satchel (16 x 0.5 m) at a jump apex. `fall` = left the world, `out` = standing > 3 m from the footprint, `perch` = standing > 1.2 m up and > 1.5 m from the footprint, `ledge` = standing on a ledge/box beside the footprint (counted, not an escape) |
| `map-render.mjs` | typed-array loader for scene.gltf + geometry bins (optional BVH) |
| `map-perf.mjs` | headless render cost model: per view, objects whose bounding sphere meets the frustum (three's culling) = draw calls, their triangles; 48 nav nodes x 8 headings, 103 deg h-FOV 16:9, far 500; evaluates the runtime's own `nmChunkPlan`; texture MB per tier |

## Holes (collision, 0.25 m grid)

Before -> after (samples where nothing is below / enclosed cracks):

| map | samples | void before | void after | gaps | fallable after |
|---|---|---|---|---|---|
| Ascent | 85,608 | 56 | 40 | 8 | 0 |
| Bind | 88,497 | 0 | 0 | 4 | 0 |
| Haven | 72,900 | 0 | 0 | 0 | 0 |
| Split | 70,038 | 0 | 0 | 10 | 0 |
| Lotus | 77,679 | 140 | 45 | 0 | 0 |
| Breeze | 104,139 | 18 | 0 | 4 | 0 |

Fixed (collision floor patches, render floor copied into the collision):
- **Lotus** (40 triangles): Stone_M0_FloorBlendMoss floors with no collision under them at x -67..-63, z -2..3 (y 5.28);
  x -63, z 4..5.75 (y 5.06); x -60.25, z -9.75..-6.75 (y 6.28); x -59.5..-58.75, z -3..4.5 (y 6.28);
  x -52.75..-48.25, z -9..-5.75 (y 5.2/6.27); x -48, z -7.5..-6.25. Before, only the nav-node fallback in `ground()`
  held units up; 0.65 m from a node they fell into the void (boundary sweep: a plain walk from (-66.75, 5.28, -1) fell to y -0.4).
- **Ascent** (4 triangles): A site east edge x 52.5..55.75, z -26..-25.25 (render floor y 8.86, no collision; walking
  from (52, 9.14, -25) fell to y 0.6 at (50.3, -27.0)).
- **Breeze** (4 triangles): x 39.5..45.5, z -33.25..-29 (y 7.05).
Remaining voids are rim samples (0.25 m past a floor edge over the void) where a capsule cannot fall (footprint
ring holds it; the leash stops further moves) and the Ascent A ramp pit (inside the existing player clip). Remaining
gaps are narrow cracks (0.15-0.95 m) between meshes with floor on both sides, none deep enough to swallow the
capsule (0 fallable): Ascent (-22, -18.75) 1.3 m single sample, (11.25, 1.75..2.25) 0.75 m, (14.5, 20.5) 0.7 m,
(49, -39.75) 0.5 m; Split (-35.75, 18.5) 0.6 m, (15.75, -18 / -15.25) 0.7 m; Breeze (-18.25, -70.25) 0.85 m,
(7.75, -48) 0.95 m; Bind (61.25..61.75, 7) 0.2 m. They are on the browser list (visual seams).

## Boundary escapes

Root cause: the source collision has no player-blocking volumes, so only geometry stopped a unit. Fix: a **playable
leash** in the shared motor (`leashGrid`/`leashOk`; server world `leash`, client `nmLeash`): a horizontal move must end
within 0.6 m of a footprint node (node <= 1 m above the feet, <= 7.5 m below them, and no more than 1.6 m below the
surface under the capsule: railings/low boxes can be vaulted, wall tops and roof edges cannot be stood on unless the
nav sampled them) or within 1.5 m of one whose floor matches the floor under the capsule (rim). The footprint is the
playable nav component plus the other valid components no more than 4.6 m above the playable floor (box tops,
drop-only areas); roofs the nav sampled (Haven 8-11 m, Ascent 6-9 m, Breeze/Split 7-10 m) are excluded. Movement
only: rays, shots, sight and floor probes never see it. A unit already off the footprint (dropped straight down past
a ledge after an updraft, or spawned outside) may only move toward the nearest footprint node at its height (6 m
search, same height band): never trapped, never further out; more than 6 m from every node it is free. The first
leash let such a unit move anywhere, and the stride-3 sweep found two escapes through that: Bind updraft from
(6, 6.9, -84) landed beside a box at (8.5, 6.7, -88.2) and walked out, Split updraft + dash from (-29.75, 7, 35.5)
to (-29.75, 6.5, 44). Applied to the player motor (both sides), the server's Jett dash and Raze satchel loops, the offline knife
lunge and the page's global `blocked()` used by offline direct moves.

Sweep (stride 3 border cells, 6 probes, one outward direction): before -> after

| map | probes | fall before -> after | out before -> after | perch before -> after | ledge (after, not escapes) |
|---|---|---|---|---|---|
| Ascent | 4578 | 118 -> 0 | 34 -> 0 | 9 -> 0 | 313 |
| Bind | 4644 | 14 -> 0 | 31 -> 0 | 12 -> 0 | 287 |
| Haven | 4278 | 30 -> 0 | 2 -> 0 | 5 -> 0 | 292 |
| Split | 4158 | 47 -> 0 | 39 -> 0 | 33 -> 0 | 336 |
| Lotus | 3540 | 151 -> 0 | 43 -> 0 | 18 -> 0 | 240 |
| Breeze | 4338 | 33 -> 0 | 100 -> 0 | 29 -> 0 | 175 |
| all | 25536 | 393 -> 0 | 249 -> 0 | 106 -> 0 | |

After = the outside-unit rule above (stride 3, all six maps, 0 fall / 0 out / 0 perch is the target).

Before-escape locations (group centres, metres) are in `work/validation/map/boundary-summary.json`
(`fallAt`/`outAt`/`perchAt`); the raw sweeps are `boundary-before-<map>.json`. Examples:
- Ascent attacker spawn back: walking from (10, 8.42, 63.5) fell to (14.6, 0.1, 68.1); (2.5, 8.43, 67.25) to (2.5, 0.2, 76.6).
- Ascent defender side z -61..-63: dash/satchel from (-9.5, 8.06, -61) to y -0.2 at z -70.
- Ascent B main x -37: updraft/satchel from (-37.25, 6.05, 12.5) over the wall to (-47.8, 0, 12.5).
- Lotus west x -54..-45: walk from (-54, 6.29, -1.75) fell to (-48.9, -0.5, -1.75); Lotus A side (12.75, 8.6, -43.75) walk out to (19.3, 9.2, -43.75).
- Bind/Haven/Split/Breeze: updraft and updraft+dash over perimeter walls (see summary JSON).

Regression: `server/test-map-bounds.js` (in `npm test`): hole grid fallable = 0 on all six maps; 16 recorded escapes
per map, 17 on Bind and Split (`server/map-escapes.json`, mixed probes; the two post-leash sweep escapes above) replayed and contained, and replayed without the leash they must
still escape (fixture stays meaningful, fails on the old motor); sampled sweep (every 40th border cell, all 7 probes)
with no fall and no out. Client: `work/test_map_leash.cjs` (rule semantics incl. roof-component exclusion, motor
containment, never-trapped, client + server wiring). `test-traversal.js` (43 human-driven walks) passes with the leash.

## Optimization

Measured problem: scene.gltf ships one mesh per source material and nearly every one spans the whole map, so three's
frustum culling culled nothing: Ascent submitted ~300 draw calls and 2.85 M of its 3.32 M triangles on an average
view, 3.32 M looking down the long axis. Map meshes already cast/receive no shadows (the sun's 1024/512 px map only
draws characters; `shadowMap.autoUpdate=false`), and there was no per-frame map traversal.

Runtime optimizer (`work/native_maps_runtime.js`, `nmOptimizeScene`, after `nmPrepareScene` and the z-fight fix,
before `nmBudget`, also on rehydrate): identical converted materials share one instance (the key includes the z-fight
polygon offset, so layers stay apart); `nmChunkPlan` gives the scene a draw-object budget of `NM_OPT.ratio` x the source
mesh count (0.9) and spends it splitting the biggest material groups (pieces >= 8,000 triangles; decal/foliage groups
weighted x2) by triangle-centroid median along the longer axis, so frustum culling has pieces to cull; every other
group stays one object (a lone source mesh is reused as is, no copy). Decals get a 45 m and foliage cut-outs a 70 m
draw distance (past the piece's radius), re-tested only after the camera moves 2 m (`nmCull` from
`scene.onBeforeRender`; one compare per frame otherwise). Textures used only by decals or by materials under 300
triangles are capped at 256 px on every tier (tiny props, grime). Ratio 1 cut more triangles (-20..-32%) but put Haven's
worst view at 312 draw calls vs 310 source; 0.9 keeps every map at or under the source on both views.

`tools/map-perf.mjs` (six maps, the runtime's own plan and NM_OPT; average view = 48 random nav nodes at eye height,
8 yaws each; worst = the maximum over those 384 views; draw calls/triangles counted per object whose bounds intersect the
frustum, detail distance applied). Optimize ms = `nmOptimizeScene` on the real scene in node (idle sandbox,
`server/tools/.scratch/opt/realopt3.mjs`):

| map | draw calls avg view: source -> opt | worst view calls | triangles avg view | worst view triangles | objects | optimize ms |
|---|---|---|---|---|---|---|
| Ascent | 304 -> 279 | 476 -> 409 | 2.85 M -> 2.51 M (-12%) | 3.32 M -> 3.29 M (-1%) | 479 -> 431 | 974 |
| Bind | 237 -> 204 | 379 -> 323 | 2.34 M -> 1.83 M (-22%) | 2.83 M -> 2.52 M (-11%) | 392 -> 352 | 881 |
| Haven | 206 -> 188 | 310 -> 279 | 3.58 M -> 2.89 M (-19%) | 4.09 M -> 4.07 M (-1%) | 314 -> 282 | 1135 |
| Split | 312 -> 271 | 485 -> 432 | 2.70 M -> 2.12 M (-21%) | 3.20 M -> 3.15 M (-2%) | 507 -> 456 | 1185 |
| Lotus | 156 -> 140 | 243 -> 210 | 2.45 M -> 1.79 M (-27%) | 2.62 M -> 2.42 M (-7%) | 247 -> 222 | 1011 |
| Breeze | 268 -> 238 | 462 -> 392 | 2.28 M -> 1.75 M (-23%) | 2.69 M -> 2.47 M (-8%) | 476 -> 428 | 1116 |

Load cost: the build is one pass over each split group's triangles (vertex list recorded while indexing, then one
typed-array copy per attribute), precomputed per-level bins in the split, typed-array part bucketing and a direct
bounding-sphere pass: 1.8-2.0 s -> 0.9-1.2 s per map. Triangles are preserved exactly (`tris out` = source on all six;
`work/test_map_optimizer.cjs` checks every corner's position/normal/uv). Raw numbers: `work/validation/map/perf.json`.

Not done (measured or judged not worth it):
- PVS occlusion culling: built and measured (24 m columns, 8 m viewer cells, conservative ray marching): it removed
  only ~3% more triangles on Lotus (61% of columns visible from an average cell: open sightlines + vista), not worth
  the popping risk; removed.
- Instancing: the export has no repeated meshes (every node has its own mesh, 0 shared), so there is nothing to instance
  without re-deriving props from merged geometry.
- Collision simplification: collision is already cropped to the nav bounds +3 m, de-duplicated and BVH'd
  (Ascent 1.84 M tris, 50 MB world); boxes/convex hulls would need per-prop authoring. Not changed.
- Worst-case views (looking down a map's long axis) still submit most triangles (frustum culling cannot help there);
  LOD/decimation of the dense meshes is the next step.

## Z-fighting ("walls glitching, the texture")

Cause: the render export has many coplanar layers of different materials (plaster patches on brick, trims on concrete,
floor inlays, crates/scaffold planks flush with walls), and the runtime makes every converted map material
double-sided (`nmPrepareScene`), so two overlapping coplanar faces of different meshes flicker against each other in
either facing. A tiny near plane made it worse at range: the native maps draw to 500 m with the base 0.05 m near plane
(24-bit depth steps ~1.1 cm at 100 m, ~4.5 cm at 200 m).

Scan (`server/tools/map-zfight.mjs`, render meshes from scene.gltf, BVH): pairs of triangles of different primitives,
all three corners of one within 1 cm of the other's plane, normals parallel (|dot| > 0.9995, either facing), overlap
> 0.005 m2 (2D polygon clip). Classes: `dup` (same triangle twice), `overlay` (partial overlap of two layers), `decal`
(Decal/Floater materials, already pulled forward by `nmDecalApply`).

Fix (runtime, `NM_ZFIX` + `nmZFixApply` after `nmPrepareScene`, also on rehydrate; data `work/validation/map/zfight-fix.json`):
- exact duplicate faces are dropped from the mesh that carries the hidden copy (blended or smaller-area material);
- overlay layers get graded material `polygonOffset` (factor = units = -level, levels 1..4, plus a hand-set level 5
  on Haven and Split, below) from a weighted DSatur
  colouring of the material overlap graph (5 levels incl. 0; the reported seams weigh 1000x so they are separated
  first), so every overlapping pair sits on different depth levels and draws in a fixed order; decals keep their own
  -2/-2;
- native-map camera near plane 0.05 -> 0.1 m (`NM_NEAR`, restored to 0.05 on other maps; the capsule keeps the camera
  >= 0.4 m from walls and the weapon has its own camera). `logarithmicDepthBuffer` not used: it writes gl_FragDepth in
  every material (no early depth test), too costly on the software/low tiers.

Coplanar overlapping pairs left on one depth level (whole map, before -> after; `work/validation/map/zfight-summary.json`):

| map | triangles | coplanar pairs | open before (dup / overlay) | open after | area left |
|---|---|---|---|---|---|
| Ascent | 3,320,370 | 32,130 | 29,842 (57 / 29,785) | 59 | 4.1 m2 |
| Bind | 2,841,334 | 24,472 | 19,315 (14 / 19,301) | 0 | 0 |
| Haven | 4,094,074 | 142,830 | 129,897 (50 / 129,847) | 673 | 24.4 m2 |
| Split | 3,210,903 | 36,726 | 34,519 (46 / 34,473) | 168 | 6.7 m2 |
| Lotus | 2,622,530 | 16,864 | 12,968 (0 / 12,968) | 0 | 0 |
| Breeze | 2,703,733 | 20,227 | 16,001 (752 / 15,249) | 9 | 0.2 m2 |

(Ascent's "before" area is dominated by far vista cards beyond the 500 m far plane.) Reported seams, 6 m around each
(`server/test-map-zfight.js`, in npm test): Ascent (-22, -18.75), (11.25, 2), (14.5, 20.5), (49, -39.75) 1,350 -> 0;
Split (-35.75, 18.5), (15.75, -18) 970 -> 0; Breeze (-18.25, -70.25), (7.75, -48) 392 -> 0. Client:
`work/test_map_zfight.cjs` (data = file, apply semantics, decals untouched, shared geometry cut once, wiring, near plane).
Level 5 (hand-set, a level nothing else uses, so moving a material there can only separate pairs, never join
them): Haven `Puddle_2_M0_MI` (the puddle on the slate tiles at (8.4, 7, 15.5), 17.3 m2 that overlapped layers
on every one of levels 0..4) -> whole-map open 697 -> 673, 41.9 -> 24.4 m2; Split
`Metal_M5_KingdomMetalTrimConstruction_MI` (level 3 -> 5; the last 3 seam pairs against the seamed panel at
(11.3, 20.1, -14.2)) -> seams 3 -> 0, whole-map open 192 -> 168, 8.6 -> 6.7 m2. Re-scan with
`FIX=work/validation/map/zfight-fix.json JSON=... node tools/map-zfight.mjs haven split` (FIX takes the per-map file).
What is left is where the overlap graph needs more than 5 levels; largest residues: Haven window fill / wood trim
(4.5 m2), Meteor box / red beam (3.6 m2); Split floor tiles / slatted wood (1.1 m2) (`leftAfter` in the summary).

## Needs a real-browser look (for the browser agent)

1. Every map: load, check FPS / `renderer.info.render.calls` / `renderer.info.render.triangles` before vs after at
   attacker spawn, mid and each site; confirm no missing geometry (chunks), no z-order change on decals, foliage
   popping at ~70 m and decals at ~45 m acceptable, small-prop textures (256 px) acceptable up close.
2. Map load time on "Preparing the map…" (optimizer adds ~1 s per map on the sandbox CPU).
3. Leash feel: walk/strafe along Ascent attacker-spawn back edge (x 0..10, z 63..72), A site east edge (x 50..56,
   z -27..-25), Lotus west area (x -67..-45, z -10..6): stops at the edge without jitter; Jett updraft beside walls
   (Ascent B main x -37, z 12..25; Haven perimeter) cannot land on wall tops/roofs; crates/boxes the nav sampled are
   still reachable (Ascent A site boxes, mid boxes).
4. Lotus patched floors (list above): bullets/decals/ragdolls now hit the floor there.
5. Visual seams at the gap list above, and the z-fight seams (Ascent (-22,-18.75), (11.25,2), (14.5,20.5), (49,-39.75);
   Split (-35.75,18.5), (15.75,-18); Breeze (-18.25,-70.25), (7.75,-48)): walls/floors should no longer flicker when
   strafing or at range; check no layer now looks wrongly on top (a trim hidden by its wall), and no near-plane clipping
   when hugging walls / crouching at corners (near 0.1 m).
6. Online: the client fetches collision from the deployed worker (`/worlds`), so the collision patches reach online
   play and the offline client only after the worker's worlds are rebuilt and deployed (`npm run build:worlds` +
   deploy, owner's call; not done here). The leash, optimizer and texture cap ship with the page.
