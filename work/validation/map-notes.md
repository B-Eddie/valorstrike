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
only: rays, shots, sight and floor probes never see it; a unit already off the footprint may always move (never
trapped). Applied to the player motor (both sides), the server's Jett dash and Raze satchel loops, the offline knife
lunge and the page's global `blocked()` used by offline direct moves.

Sweep (stride 3 border cells, 6 probes, one outward direction): before -> after

BOUNDARY_TABLE

Before-escape locations (group centres, metres) are in `work/validation/map/boundary-summary.json`
(`fallAt`/`outAt`/`perchAt`); the raw sweeps are `boundary-before-<map>.json`. Examples:
- Ascent attacker spawn back: walking from (10, 8.42, 63.5) fell to (14.6, 0.1, 68.1); (2.5, 8.43, 67.25) to (2.5, 0.2, 76.6).
- Ascent defender side z -61..-63: dash/satchel from (-9.5, 8.06, -61) to y -0.2 at z -70.
- Ascent B main x -37: updraft/satchel from (-37.25, 6.05, 12.5) over the wall to (-47.8, 0, 12.5).
- Lotus west x -54..-45: walk from (-54, 6.29, -1.75) fell to (-48.9, -0.5, -1.75); Lotus A side (12.75, 8.6, -43.75) walk out to (19.3, 9.2, -43.75).
- Bind/Haven/Split/Breeze: updraft and updraft+dash over perimeter walls (see summary JSON).

Regression: `server/test-map-bounds.js` (in `npm test`): hole grid fallable = 0 on all six maps; 16 recorded escapes
per map (`server/map-escapes.json`, mixed probes) replayed and contained, and replayed without the leash they must
still escape (fixture stays meaningful, fails on the old motor); sampled sweep (every 40th border cell, all 7 probes)
with no fall and no out. Client: `work/test_map_leash.cjs` (rule semantics incl. roof-component exclusion, motor
containment, never-trapped, client + server wiring). `test-traversal.js` (43 human-driven walks) passes with the leash.

## Optimization

Measured problem: scene.gltf ships one mesh per source material and nearly every one spans the whole map, so three's
frustum culling culled nothing: Ascent submitted ~300 draw calls and 2.85 M of its 3.32 M triangles on an average
view, 3.32 M looking down the long axis. Map meshes already cast/receive no shadows (the sun's 1024/512 px map only
draws characters; `shadowMap.autoUpdate=false`), and there was no per-frame map traversal.

Runtime optimizer (`work/native_maps_runtime.js`, `nmOptimizeScene`, after `nmPrepareScene`, before `nmBudget`, also on
rehydrate): identical converted materials share one instance; each material group is cut into quadtree chunks on the
24 m ground grid (<= 12,000 triangles; foliage/decal groups <= 4,000 and <= 48 m squares); groups under 4,000 triangles
stay one object; decals get a 45 m and foliage cut-outs a 70 m draw distance (past the chunk radius), re-tested only
after the camera moves 2 m (`nmCull` from `scene.onBeforeRender`; one compare per frame otherwise). Textures used only
by decals or by materials under 300 triangles are capped at 256 px on every tier (tiny props, grime).

PERF_TABLE

Load cost: Lotus 247 meshes -> 629 chunks / 137 materials in 3.8 s on the shared (contended) sandbox CPU, +170 MB
transient (source arrays freed right after); triangles preserved exactly (node run on the real scene).

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

## Needs a real-browser look (for the browser agent)

1. Every map: load, check FPS / `renderer.info.render.calls` / `renderer.info.render.triangles` before vs after at
   attacker spawn, mid and each site; confirm no missing geometry (chunks), no z-order change on decals, foliage
   popping at ~70 m and decals at ~45 m acceptable, small-prop textures (256 px) acceptable up close.
2. Map load time on "Preparing the map…" (optimizer adds ~1.5-4 s).
3. Leash feel: walk/strafe along Ascent attacker-spawn back edge (x 0..10, z 63..72), A site east edge (x 50..56,
   z -27..-25), Lotus west area (x -67..-45, z -10..6): stops at the edge without jitter; Jett updraft beside walls
   (Ascent B main x -37, z 12..25; Haven perimeter) cannot land on wall tops/roofs; crates/boxes the nav sampled are
   still reachable (Ascent A site boxes, mid boxes).
4. Lotus patched floors (list above): bullets/decals/ragdolls now hit the floor there.
5. Visual seams at the gap list above.
6. Online: the client fetches collision from the deployed worker (`/worlds`), so the collision patches reach online
   play and the offline client only after the worker's worlds are rebuilt and deployed (`npm run build:worlds` +
   deploy, owner's call; not done here). The leash, optimizer and texture cap ship with the page.
