# Browser performance capture: firing and taking damage (offline)

Date: 25 October 2026. Branch `hark` at 5d43ee9 (the "before" capture; no `hark-perf` commits existed yet).
Script: `work/browser_perf_capture.cjs` (summary helper `work/perf_profile_summary.cjs`). Raw data:
`perf-capture-before-rendered.json`, `perf-capture-before-norender.json`, `perf-capture-before-fire-summary.json`,
render `perf-capture-before-640x360.jpg`.

## Setup and limits (read first)

- Headless Chromium 131 (Playwright headless shell), **SwiftShader software GL**, 640x360, LOW preset, AA off.
  Offline Deathmatch on Ascent, launched through `xGo(startDM)`, Vandal.
- The sandbox has 2 CPU cores and other agents' test suites kept the load average at **10-13** during the runs.
  Absolute milliseconds are therefore inflated several times over and frame times are dominated by software
  rasterisation. **Rankings and ratios are the usable result, not the absolute numbers.** This is not a GPU or real
  device measurement.
- Two runs:
  1. **Rendered**: normal page. A world frame took ~100 s (rAF intervals 72-113 s), so this run measures what the
     scene costs to draw, not gameplay.
  2. **No-render** (`NORENDER=1`): after the first real frames the world `renderer.render(scene, camera)` call is
     skipped, so the game's own JS (shooting, bot AI, hit feedback, deaths) runs at a measurable rate. Firing phase:
     `fireHeld` held, three bots placed 6-10 m in front of the player, bots shooting back; player HP held at 500-1000
     so every hit still runs `hurt()` and the hurt feedback. 72 shots fired, 1489 damage dealt (about 9-10 kills),
     3380 damage taken, over 230 s of wall time.

## Scene and memory counters (renderer.info, performance.memory)

| Reading | Before firing | After 72 shots |
|---|---|---|
| Draw calls per world frame | 472 | 472 |
| Triangles per world frame | 3,331,172 | 3,331,172 |
| Geometries / textures | 465 / 454 | 465 / 454 |
| Shader programs | 29 | 27 |
| JS heap used | 275 MB | 281 MB (peak 284) |
| DOM elements | 1583 | 1594 |
| Scene objects | 3881 | 4020 (corpses, impact effects) |

- No leak signal in the firing window: heap +6 MB, geometries/textures flat, DOM flat.
- **3.3 million triangles and ~470 draw calls per frame on the LOW preset** (Ascent, rendered run: 477-492 calls,
  3.23-3.34 M triangles). This is the largest standing cost on any GPU and the main suspect for "general gameplay lag"
  on weaker hardware; LOW does not reduce map geometry.

## Rendered run: first frames are shader compiles

CPU profile of the 30 s idle window right after the match started: `getProgramInfoLog` 61.4 % and
`getShaderInfoLog` 17.4 % of all samples, i.e. 79 % of the main thread waiting on synchronous shader link/compile
status (three.js `renderer.debug.checkShaderErrors` is on by default, which reads the logs and forces each link to
finish; `xPrecompile()` then compiles every program in one go at match start). Long tasks: 9 in the window, longest
113 s (one frame). On a real GPU this is the first-seconds hitch of a match; any material or effect first drawn
later (first shot, first impact, first ability) pays the same synchronous link at that moment unless it is in the
precompiled set.

## No-render run: where the JS time goes while firing and taking damage

Main-thread profile of the firing window: 228 s sampled, 27.8 s active JS/GC (the rest is idle/compositor/GPU wait).
Long tasks: 82, total 52.9 s, longest 1.93 s; rAF interval median 633 ms, p95 25 s.

Top inclusive (ms of the 27.8 s active):

| Function | ms | What it is |
|---|---|---|
| `loop` → `xSimRun` → `fiveTick`/`dmTick` → `tick` | 16,403 / 12,877 | whole frame / simulation |
| `xSolTick` (soldier/corpse visual tick) | 6,667 | includes the ragdolls below |
| `xUbDead` → `xrRagdollTick` | 4,876 / 4,830 | **corpse ragdoll per frame** |
| `los` / `losRaw` → BVH `raycast` | 4,817 / 4,667 | bot line of sight |
| `(garbage collector)` | 3,805 | GC (13.7 % of active time) |
| `xPath` → `nmNext` / `nmSegment` / `nmHeight` | 3,718 | bot navigation |
| `xrRagdoll` (build at death) incl. `xrSupports` | 2,478 / 2,126 | **one-off per death** |
| `shoot` (player, all wrappers) | 1,453 | 72 shots, ~20 ms each here |
| `nmMinimap` | 1,215 | minimap canvas |
| `xKiAdd` (kill icon) | 929 self | **forced layout on every kill** |
| `fillText` | 852 self | canvas text (minimap / labels) |
| `updHud` | 269 | |
| `xDmgArc` / `hurt` | 147 / 142 | hurt feedback is cheap |

Top self time: GC 3,805; BVH `raycast` 1,795; `nmNear` 1,399; `intersectBox` 1,264; `xrSupports` 1,107;
`updateMatrixWorld` 1,097; `xrSolve` 1,027; `checkBufferGeometryIntersection` 990; `xKiAdd` 929; `fillText` 852.

### Findings, most likely causes of "lag when shooting / taking damage"

1. **Kills, not hits, are the expensive moment.** A death builds a ragdoll (`xrRagdoll`, ~250 ms per death in this
   contended sandbox), whose `xrSupports` CPU-skins up to 6000 vertices of the corpse (`boneTransform` per vertex) to
   find contact points, and every corpse then runs `xrRagdollTick` each frame (4.8 s total here, the single biggest
   gameplay cost). With several corpses on screen this is a continuous cost, and each kill adds a spike.
2. **`xKiAdd` forces two synchronous layouts per kill** (`void s.offsetWidth`, `void XKI.el.offsetWidth` to restart
   the kill-icon animations): 929 ms self for ~10 kills. Same pattern `test_hit_perf.cjs` forbids in the hit/hurt
   paths, but `xKiAdd` is not covered there. (The `hark-hitfx` checkpoint notes "kill animation restarts no longer
   force layout"; on `hark` at 5d43ee9 they still do.)
3. **GC is 13.7 % of active time** during combat: per-frame allocations in the ragdoll, LOS and nav paths are the
   likely sources (e.g. `xrSupports` allocates a `Matrix4` per joint and Vector3s per direction; BVH raycasts allocate
   hit arrays).
4. **Bot LOS raycasts (`los`, 4.8 s) and nav (`xPath`, 3.7 s)** run inside the same frames; firing makes bots react
   (more LOS checks), so they rise with combat.
5. The direct hit/hurt feedback (`hurt`, `xDmgArc`, `updHud`, damage overlay) is cheap: under 0.6 s together for
   3380 damage taken; the per-hit layout fixes of 3778dea hold.
6. GPU side (rendered run): 3.3 M triangles / ~470 draw calls per frame at LOW, plus synchronous shader-program
   checks at match start and at first use of new effects.

## Not established

- Real-GPU frame times, and the split of each frame between JS and GPU on real hardware.
- Per-shot cost on an uncontended CPU (here ~20 ms per `shoot`, inflated by load).
- Online combat (server snapshots, `mpNet`), and maps other than Ascent.

## After (hark-perf merge)

Pending: re-run `NORENDER=1 FIRE_MS=600000 node work/browser_perf_capture.cjs <out.json> after` and the rendered run
once `origin/hark-perf` is merged into `hark`.
