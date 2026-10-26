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
| `map-seethrough.mjs` | sample-based visual-gap survey from 250 seeded playable nodes at eye height (4 elevations x 24 headings): `seeThrough` (collision hit within 30 m with no render face within 0.75 m: invisible wall), sky `cracks` (a ray at/above the horizon escapes the render meshes while the 4 rays 2 deg around it hit solid, non-foliage geometry within 30 m), `floating` props (node < 6 m across within 12 m of an eye, base > 0.25 m clear below at 5 points, nothing within 0.3 m beside/above) |
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

Load cost, pass C2 (profiled with `node --cpu-prof` on `server/tools/.scratch/opt/realopt3.mjs` / `realopt4.mjs`):
`nmOptimizeScene` was one large function whose hot loops (triangle gather, attribute copy) ran mostly unoptimized - the
engine recompiled it 4-5 times per map (100-190 ms each, "wrong map" deopts) - so its own time was ~0.9 s of Lotus's
optimize. The loops are now small functions (`nmGather`, `nmOffset`, `nmCopy3/2/N`, `nmCentroids` for the plan's
centroids) that optimize in a few ms; output is unchanged (triangles out = source on all six, `work/test_map_optimizer.cjs`).
Optimize ms on the loaded sandbox (load ~15, same run, before -> after): Ascent 2050 -> 1327, Bind 1470 -> 1082, Haven
2163 -> 1385, Split 1964 -> 1463, Lotus ~1990 -> ~1475, Breeze 1923 -> 1114 (-25..-42%; the idle-sandbox column above was
measured before). Left: the plan's median split (~0.3 s Lotus, loaded) and GC.

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

## Visual gaps (see-through walls, sky cracks, floating props)

Every converted material is drawn double-sided (`nmPrepareScene`), so a missing backface cannot open a wall; below-horizon
void is covered by `eval-visual-holes.mjs` + the backdrop skirt. `server/tools/map-seethrough.mjs` (250 nodes, 24,000
sight rays per map; data `work/validation/map/visual-scan.json`):

| map | see-through (collision without render) | sky cracks | floating candidates |
|---|---|---|---|
| Ascent | 0 | 1 | 2 |
| Bind | 0 | 0 | 1 |
| Haven | 0 | 0 | 0 |
| Split | 0 | 0 | 1 |
| Lotus | 0 | 0 | 1 |
| Breeze | 0 | 0 | 1 |

Each candidate was rendered from the nearest playable node (`view-map.mjs`, raw meshes): the Ascent crack
(from (-23.75, 9.67, -25), 20 deg up, heading 334) is open sky between rooftops, not a hole. Floating candidates, verdicts
from the rendered view and the down-ray hits (inferred, not confirmed in a browser): Ascent attacker well inner plate
(-0.94, 8.25, 44.39; part of the well model), Ascent rowboat (-65.8, 7, -19.5; 0.4 m over the canal bed, on the water),
Split hanging bunny sign (3.55, 12.86, -41.0; 3.9 m up, its wires are skipped by the scan), Lotus ruined wall
(-54.4, 7.3, -6.6) and Breeze boat-shop storage (-58.4, 6.2, 43.3) outside the playable area with nothing under them;
Bind adobe wall section (-37.07, 11.81, -30.99; 4.4 x 5.9 x 0.6 m, 0.9 m over the floor, nothing found within 0.3 m
of its sides) looks like a lintel over an opening but is the one worth a browser look. Earlier passes of the scan with
foliage/palms counted as closing geometry gave 9 "cracks" (Breeze palms, Haven trees), all open sky in the rendered
views; foliage is excluded now. No data fix was needed: nothing in the survey is a real gap.

## Remaining sweep: stuck spots, invisible walls, spawns, plant sites, ladders/ropes

Tool `server/tools/map-sweep.mjs` (shared motor on the server collision world, all six maps): every playable node is
placed and walked 0.4 s in 8 directions (`stuck`, `embedded`); from nodes walked into a spot, 8 more 0.3 s walks must get
out (`trap`, a stuck spot a player can walk into); every cardinal nav edge between capsule-free playable nodes is walked
(run, jump with a 2-frame run-up when > 0.42 m up, drops land beyond), and a refused edge is classified by the motor
check that refused it (`leash`, `tall`, `riser`, `riserDip`, `base`) and by the collision triangles it met: `invisible`
only when none of them has a render surface within 5 cm (RENDER=1). Also the server's team spawn candidates
(`teamSpawnPoint`), site anchors vs plant zones (`plantAt`, `siteAt` height), and callouts. MOTOR=path runs another motor.

Before (merged tree a2ac169, stride 1, every playable node and edge; Breeze also with the walk-in trap test):

| map | nodes | edges walked | refused | of which crack (`riserDip`) | posts / pillar corners (`tall`, visible) | walk-in traps | stuck (walk + jump) |
|---|---|---|---|---|---|---|---|
| Ascent | 9,544 | 32,106 | 17 | 13 | 4 | - | 0 |
| Bind | 9,975 | 35,440 | 4 | 4 | 0 | - | 0 |
| Haven | 8,162 | 29,008 | 4 | 2 | 1 (+1 base) | - | 0 |
| Split | 7,803 | 26,782 | 2 (+5 drop-edge artefacts of the first edge test) | 1 | 0 (+1 base) | - | 0 |
| Lotus | 8,695 | 29,383 | 0 | 0 | 0 | - | 0 |
| Breeze | 11,676 | 37,373 | 35 | 22 | 12 (+1 riser) | 44 | 0 |

Two motor bugs (fixed in the shared motor, `server/src/motor.cjs` = `vendor/valorant-feel.js`, both sides):
- **Crack read as a riser (invisible wall on flat floor).** A capsule blocked by a 2-6 cm slab lip lifts and runs the riser
  look-ahead (10 cm samples, no rise > step height). A crack between two paving slabs dropped the reference into the
  crack and the next slab, level with the player, then counted as a 0.46-1.2 m riser: the player stopped dead on flat
  floor. Worst on Ascent's attacker-spawn back (x 1..7, z 59..67, 8 edges), also Ascent B link / market / A heaven,
  Bind (-3, -3.75), (21, 48), (48, 13.5), Haven (-1.5, 34.5), (8.3, -57.3), Split (-35.75, 17.5) and 22 edges across
  Breeze. Fix: a dip never lowers the reference (`prev=Math.max(prev,g)`); a box is still refused when the capsule
  reaches it. 42 of 42 crack edges now walk.
- **Pinned against a wall over uneven paving (walk-in trap).** The step-up required 1 cm clearance all round the lifted
  capsule; a capsule that walked into a wall over a bumpy floor (resting a few cm up on the paving) could then neither
  step (the wall it touches is within 0.41 m) nor stay grounded enough to move, so every direction was refused: stuck
  until a jump. 44 such spots on Breeze (sampled every 3rd node). Fix: the 1 cm margin is tested ahead of the move only,
  and where a wall leans in above the feet only a lift of at most 5 cm (a bump or seam) may pass, tested at that height.
  41 of 44 walked out after this fix; the other 3 (and one more the stride-5 re-sweep found) are fixed in the next pass:
- **Embedded a few mm in a leaning wall (C2).** Breeze (6.56, 8.04, -34.75), (17.0, 4.25, 36.0), (17.8, 9.19, 7.59): the
  capsule rests 1-3 mm inside a wall that leans in over the paving. A move's 0.5 mm sub-steps never clear it, so each
  sub-step was refused and velocity zeroed: pinned until a jump. Fix (shared motor `moveAxis`): when the capsule is
  already embedded (free radius 0.3-0.4 m, bisected to 0.1 mm), a move that strictly increases the free radius passes,
  so it backs out; sliding along or deeper into the wall is still refused. All three walk out in every open direction.
- **Ledge off the footprint (C2).** Breeze crate stack below the 12 m platform's south-east edge (x 7.3..10.45,
  z -24.45..-21.4; blocks at 10.95, 9.96, 9.0 m down to the 8 m floor, no nav on them): walking off the platform edge
  from (9.25, 12, -25) dropped 1 m onto the top block, where the leash only allowed moves back toward the platform (1 m
  up, jump only). Fix: a player clip (`CLIPS.breeze`, feet band 11..14.5 m) over the stack, so the platform edge stops
  the walk like a wall; capsules on the 8 m floor (even at a jump apex) are below the band and walk under it as before;
  no nav node is clip-blocked; the platform's east edge (x > 10.45) still drops to the 8 m floor.
  Fixtures: the 4 cases are appended to `map-walk-fixtures.json` Breeze traps (all 4 fail on the C1 motor).
- Still refused and correct: the `tall` edges are posts, a pillar corner, a hanging cable bundle at Ascent A
  (46.3, 10.07, -32.1, collision on visible `WiresDark` cables) - the nav node sits 0.3-0.4 m from thin visible geometry
  the 0.4 m capsule meets; all have visible render surfaces (none `invisible`). The `base` edges (Haven C (-48, 6.01, -8.5), a 4 cm floor plate
  against a wall; Split (1.75, 10.52, 6.25) drop) walk after the fix.
- Stuck (placed on a node, cannot walk or jump out): 0 on all six maps. Embedded nodes: Ascent 22 (17 inside the A ramp
  pit player clip, as intended), others 1-7; none is a spawn candidate (spawns test 0.43 m clearance) and the DM spawn
  test is the same.

Re-sweep after C1/C2 (stride 2 + walk-in trap test on every sampled node, RENDER=1; `.scratch/sweepA-<map>.json`):
<!--RESWEEP-->
- Ascent (C1 motor; 4,772 nodes, 16,018 edges): 0 stuck, 1 refused edge (the visible `WiresDark` cable bundle at A,
  `tall`, correct), 1 walk-in trap: walking -z from (30.25, 9.07, -9.25) wedged the capsule at (30.25, 9.2, -10.19) under
  a 1.66 m soffit over bumpy floor - lifting 5 cm to clear the bump put the head into the soffit while 5 mm cleared it.
  Fix (shared motor): the lean-wall step-up tries the lowest of 0.5 / 1.5 / 3 / 5 cm that clears ahead; it walks out in
  4 directions. Fixture added (Ascent traps).
- Bind (C2 motor; 4,988 nodes, 17,700 edges): 0 stuck, 0 refused edges, 1 walk-in trap: (-53.25, 7.56, 21) walking
  (-0.71, 0.71) wedges the capsule at (-53.49, 7.41, 21.32) in a rock pocket between a mound and a wall leaning over at
  head height; every standing move meets one of them within 2 mm at any lift, so it is not fixed in the motor. It walks
  out crouched (225-315 deg, 1.2-1.4 m in 0.6 s) or with a jump toward (0.71, -0.71). The node sits on a 0.65 m rock bump
  over the 6.9 m floor; the pocket is a crevice between the bump and the rock face west of it, and a local scan
  (`.scratch/rscan.mjs`, 71 starts within 4 m + a 1.5 m free grid) found a second one north of the bump, reached from the
  floor to the south-east ((-52.5, 6.9, 19.5) toward (-0.38, 0.92), wedged at (-53.23, 7.51, 21.2)). The capsule rests on
  the crevice rims 0.3 m above their floor and meets rock at every lift. Fix: player clip `CLIPS.bind` inside both
  crevices (x -53.9..-53.2, z 21.35..21.75, body band 6.9..8.4 m), never nearer than 0.42 m to the node, so the bump's
  rim stops the walk like a wall: local scan 0 traps (12 before), no playable node clip-blocked; the bump still walks off
  east / south / south-west (1.8-2.8 m in 0.6 s). Fixtures: the three walks off the bump (Bind traps; all fail before).
  Full gate on main 7add113 (this clip, on top of 4782a01): `npm run test:client` 128/128, server `npm test` EXIT 0.
- Haven (C2 motor; 4,081 nodes, 14,575 edges): 0 stuck, 0 traps, 1 refused edge (9, 8, -58) -> (9, 7.99, -57.25): a 5 mm
  paving bump under a low ceiling (1.8-2.2 m over the floor) - the step-up tested headroom for the full 40 cm step and
  refused it. Fix (shared motor): headroom is tested for the lift actually used (full step, or the few cm of the lean-wall
  lift). Fixture added (Haven edges).
- Split (3,902 nodes, 13,421 edges): 0 stuck, 0 refused edges, 1 walk-in trap: walking (-0.71, 0.71) from (-3.5, 9.02, -47)
  into a rounded prop by a wall (centre (-4.12, 9, -46.4), 0.5 m wide, 0.8 m tall, domed collision) stepped onto its lip
  and climbed the curved side a few cm per sub-step - each lift cleared by contact at the capsule's rim, no single riser
  over the step height - ending 0.8 m up, embedded 1.7 cm on its shoulder. A motor-wide slope rule (lift must end on
  floor within 0.2 m of the axis) was tried and dropped: it also refuses ordinary stairs, whose first riser is met by the
  rim 0.4 m ahead (`work/test_map_riser.cjs` failed). Fix: a player clip on the prop's footprint (`CLIPS.split`, octagon
  r 0.27, feet band 9..9.85 m) makes it a post; it now stops beside it and walks off in 5 directions, jumping on top
  still works. No playable node is clip-blocked (one non-playable node 0.64 m from the centre is). Fixture added (Split traps).
- Lotus (4,348 nodes, 14,676 edges): 0 stuck, 0 traps, 0 refused edges.
- Breeze (C2 motor + crate-stack clip; 5,838 nodes sampled, 18,683 edges): the first re-sweep (`sweepA-breeze.json`) ran
  while the motor-wide slope rule was being tried (see Split; inferred - it started before 79a9b48 and its findings do not
  reproduce on the committed motor) and is void: its 8 jump-only nodes (the ramp up to the 12 m
  platform at x 3..6, z -35..-31 among them) and 2 of its 3 traps walk out on the committed motor (replayed node by node).
  The third is real: from (-33.5, 8.05, -60.25) walking (-0.71, -0.71) (and from (-33.5, 8.08, -61.75) toward (-0.71, 0.71))
  the capsule left the 8 m floor's west edge - no railing, a 5.2 m drop that is off the footprint - because the leash's
  0.6 m core lets the centre 0.3 m past the edge; it settled 26 cm down on the edge lip at (-34.09, 7.79, -61.1), could
  not drop (leash) and met the edge at every lift back: 0.2 m of travel in 1 s in any of 16 directions, crouched too.
  The sweep's own trap test (0.1 m in 0.3 s) passes it, so the walk fixtures now require 0.3 m within 0.5 s.
  Fix: player clip `CLIPS.breeze` '8 m floor west edge' following the edge 0.3 m out from z -66 to -58.4 (where the
  floor turns west), body band 8.4..9.5 m; the edge now stops a walk like a railing. A clip on the trap spot alone left a
  corner pocket against the edge either side of it (found by `.scratch/rscan.mjs`, 16 directions x 0.2/0.4/0.8 s from
  every node within 5.5 m, trapped = no 1 s walk gets 0.5 m away); with the full-length clip: 0 traps, no playable node
  clip-blocked (the x -33.5 nav row stays 0.42 m clear). Fixtures: both walks added to Breeze traps (fail before).
  Full re-sweep on the committed motor before that clip (`sweepC-breeze.json`, 5,838 nodes, 18,683 edges): 0 stuck, 0
  jump-only, 3 embedded nodes (as before: (4, 4.01, 44), (10, 4.07, 47.75), (45.25, 7.01, -25.75)), 8 refused edges, all
  `tall` against visible collision (posts / pillar corners, as before), 1 walk-in trap: from (-10.25, 6.02, 0.5) toward
  (-0.71, -0.71) the capsule climbed the rim of a 0.55 m wide, 0.7 m tall prop against the low railing over the mid-west
  drop (centre (-11.24, -0.98); its collision reads as an open lattice) 0.6 m in three frames and perched at (-11.21, 6.61,
  -0.66), no floor under its axis, 0.06 m of travel in any direction. Fix: player clip (octagon r 0.3, feet band
  6.05..6.75 m), a post as on Split; local scan 0 traps from playable nodes, none clip-blocked (a non-playable node
  (-12.5, 6.14, -2.5) outside the railing is leash-held as before - unreachable on foot). Fixture added (Breeze traps).
  Post-clip full Breeze sweep (`sweepD-breeze.json`, committed motor + all three Breeze clips, 5,838 nodes, 18,683 edges):
  0 stuck, 0 walk-in traps, 0 jump-only, 3 embedded (the same three), 8 refused edges, all `tall` on visible posts.

Re-sweep E on main (motor e28fd747, i.e. every C1/C2 motor fix and all player clips incl. Bind's; stride 2 + walk-in trap
test + RENDER=1; `.scratch/sweepE-<map>.json`), the five non-Breeze maps (Breeze: sweepD above, same motor rules):

| map | nodes sampled | edges walked | stuck | walk-in traps | jump-only | refused edges | embedded nodes |
|---|---|---|---|---|---|---|---|
| Ascent | 4,772 | 16,018 | 0 | 0 | 0 | 1 `tall` (visible `WiresDark` cable bundle at A, as before) | 13 (10 inside the A ramp pit clip, intended; (-11.75, 9.02, -59.5), (-7.25, 7.4, 38), (42.25, 9.59, 21.5) walk out) |
| Bind | 4,988 | 17,700 | 0 | 0 (rock pocket fixed) | 0 | 0 | 1 ((19.5, 5.52, 43.5), walks out) |
| Haven | 4,081 | 14,575 | 0 | 0 | 0 | 0 | 0 |
| Split | 3,902 | 13,421 | 0 | 0 | 0 | 0 | 4 ((-50..-46.25, 6.62, -5..2.5), walk out) |
| Lotus | 4,348 | 14,676 | 0 | 0 | 0 | 0 | 2 ((-12, 4.95, -7), (-9, 3.59, -6.25), walk out) |

No `invisible` refusal on any map (every refused edge meets a visible render surface). Spawns, sites and callouts as
below (unchanged: Ascent B 6 / Lotus B 7 zone cells on another floor, refused by `siteAt`, correct). With sweepD this
closes the stuck-spot / invisible-wall sweep on all six maps: 0 stuck, 0 traps, 0 jump-only, no invisible walls.

Spawns and plant sites (all six maps): attacker / defender spawn candidates 246-660 / 103-634 per map, none embedded or
stuck, every candidate reaches every site on the navigation. Every site anchor lies in its own plant zone, its nearest
node too, and passes `siteAt`'s 2 m height test; plantable playable nodes per site 133-468. Zone cells at another floor
(refused by `siteAt`, correct): Ascent B 6 nodes on the 6.65 m ledge over B site (z -10..-11.5), Lotus B 7 nodes on the
7.35 m walkway above the 3.35 m site. Callouts: every one has reachable playable floor within 8 m (labels are API
points: Breeze's are all at one height and its A Lobby label sits 7.9 m off the minimap floor; overlaying the playable
nav on Breeze's minimap shows it covers the whole drawn floor).

Ladders / ropes: none is climbable in VALORANT on these maps and none is in the motor. The exports hold decorative
`Prop_18_M0_LadderA_MI` ladders (Bind (15.5, 7.2-10.6, 29.3), Haven (-23.4, 5.0, 26.4) lying flat, Breeze four on
rooftops at y 11-17 and (-0.6, 8-12, -65)) and rope props (Ascent, Breeze ship rigging); Split's ascender ropes are not
in the export (only the 1.2 m `Ascender_0_M0_CableADark_MI` head unit at (-4.5, 9, 22.7) by mid bottom), so the spots
they serve are reached on foot as everywhere else: every Split callout (A/B rafters, B tower, mid mail/vent) is
reachable from the attacker spawn on the navigation (traversal test walks spawn -> every site). No ladder or rope blocks a
path (the edge sweep found none of them among the refusals).

Regression: `server/test-map-bounds.js` (npm test) sections 4-5 - spawns / sites / callouts on all six maps, and
`server/map-walk-fixtures.json` (45 crack/step edges + 41 Breeze traps) walked with the current motor (the same cases
failed before). Client: `work/test_map_riser.cjs` (synthetic floors: crack + 5 cm lip crossed both ways; 0.6 m box
refused with/without a crack and after a step down; 0.2 m stairs up and down; it fails on the old motor). Stairs
(`test-stairs.js`), traversal (43 walks) and `work/test_feel.js` pass on the new motor.

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
6. Visual-gap candidates (Visual gaps section): Bind adobe wall section at (-37.07, 11.81, -30.99) should sit on/in its
   wall (no visible gap under or beside it); Ascent rowboat (-65.8, 7, -19.5) sits on the canal water; Split bunny sign
   (3.55, 12.86, -41.0) hangs from its wires.
7. Online: the client fetches collision from the deployed worker (`/worlds`), so the collision patches reach online
   play and the offline client only after the worker's worlds are rebuilt and deployed (`npm run build:worlds` +
   deploy, owner's call; not done here). The leash, optimizer and texture cap ship with the page.
8. Movement fixes (motor): walk across Ascent's attacker-spawn back paving (x 1..7, z 59..67) and Breeze's paved lanes
   without stopping on flat floor; run into walls over Breeze paving (e.g. (44.9, 8.06, -15.25), (-80, 7.1, 8.3)) and walk
   away without jumping; stairs and boxes still behave (0.6 m crates need a jump, stairs walk).
9. Breeze (C2): press into the leaning walls at (6.56, 8.04, -34.75), (17.0, 4.25, 36.0), (17.8, 9.19, 7.59) and walk away
   without a jump (no visible push-out pop); walk off the 12 m platform's south-east edge toward the crate stack
   (x 7.3..10.45, z -24.45): stops at the edge like a wall, no visible invisible-wall gap feel worse than a railing; the
   east edge (x > 10.45) still drops to the 8 m floor; walking on the 8 m floor under the stack is unaffected.
10. Breeze west edge of the 8 m floor (x -33.6..-33.9, z -66..-58.4, above the 5.2 m drop): walk and strafe along and
    diagonally off it - stops at the edge like a railing (no hang on the lip, no visible pop); the floor corner at
    z -58..-57.5 where it turns west still walks.
11. Breeze prop by the mid-west railing (-11.24, 6, -0.98): walking into it stops beside it like a post (no climb onto it);
    the railing line beside it is unchanged.
12. Bind rock bump at (-53.25, 7.55, 21) over the 6.9 m floor: walking off it
    north-west / north stops at the bump's rim like a wall (no wedge in the crevice behind it, no visible gap feel worse
    than touching the rock); walking up onto it from the floor to the south-east and off it east / south still works.
