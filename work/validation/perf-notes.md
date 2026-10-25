# hark-perf: hit-path, per-frame and bot-variety notes

Branch `hark-perf` (pushes to origin/hark-perf only). Gate before every commit: `python3 work/install_valorant.py`
regenerates index.html byte-identically, `git diff --check` clean, `server/ npm test`, `server/ npm run test:client`.

## Item 1: hit path ("lag when I shoot / take damage")
- Native shader warmup also compiles hidden pooled hit effects (tracer lines, hit-impact meshes, spark/decal pools),
  then hides them again (first shot / first hit of a match no longer compiles programs mid-fight).
- vendor/hit-impact.js: pool goes idle once every burst expired (no per-slot matrix work per tick).
- bFx / xSurfHit / bfxBot / crosshair ray: no per-shot THREE allocations (scratch vectors, one synthesized hit,
  scalar slab test, shared screen-centre Vector2).
- Taking damage: one hurt-overlay timer per burst (`xDmgFlash`) instead of one timer + two style writes per hit.
- Brightness 100 %: no CSS filter on the WebGL canvas.
- Decal owner-visibility walk at 5 Hz instead of every frame.
- XSN (per-round sniper-spot cache) cleared once the match is over (fixed the pre-existing test_client_lifecycle failure).
- Tests: work/test_hit_path_perf.cjs. Bench (tool, not in test_all): work/bench_hit_path.cjs.

Bench (headless page harness, Ascent offline 5v5, 200 calls; ms timings are noisy on the shared loaded machine,
allocation / timer counts are the stable numbers):

| path | before THREE objs/call | after | before timers/200 calls | after | before KB alloc/call | after |
|---|---|---|---|---|---|---|
| fire-hit | 2 (Vector3+Vector2) | ~0 | 0 | 0 | 0.29 | 0.24 |
| fire-miss | 2 | 0 | 0 | 0 | 0.29 | 0.22 |
| bot-fire | 2 (Vector3 x2) | 0 | 0 | 0 | 0.09 | 0.12 |
| take-hit | 0 | 0 | 400 pending | 0 | 0.56 | 0.32 |
| frame (9 bots) | 0 | 0 | 0 | 0 | 0.89 | 0.87 (mean 6.53 -> 4.32 ms, p95 14.2 -> 10.9 ms) |

## Item 2: per-frame HUD / native map
- HUD portrait (alive pips): compared as a short "1/0" key, markup built only on change (was two arrays, a map/join
  of HTML strings every frame).
- `#jX em` cached (was a selector match every frame).
- Open scoreboard rebuilt at 5 Hz (was a full table string every frame).
- nmHeight: one scratch Ray (was a Ray + two Vector3 per call).
- Floor guns / dropped Spike: height cached per resting spot (was 1 + N BVH casts every frame).
- nmMinimap: CSS width cached, re-read at most once a second (was getBoundingClientRect every 80 ms draw).
- Floor-gun prompt: element cached; floor list only read while a match runs; ticked from the main loop's XHK hooks
  (was a second always-on requestAnimationFrame chain, also in the lobby).
- DPR cap left at 2 (deliberately unchanged).

## Kill cost A: ragdolls (browser profile: xrRagdollTick top per-frame cost after kills, ~250 ms build mostly xrSupports)
- Corpse re-solve throttled to <=30 Hz (15 Hz beyond 35 m from the camera); the skipped real time is passed to the
  solver, so bodies fall exactly as fast (xrRagdollTick already substeps large steps at 120 Hz).
- At most 4 bodies simulate at once: when a fifth drops, the oldest one that has fallen > 1 s freezes where it lies
  (settled bodies already stop on their own).
- xrSupports: sample list (vertex, dominant bone, 4 skin indices/weights) cached per geometry (corpses of one agent
  share it); each sample skinned by the same linear blend as three's boneTransform from per-bone matrices built once
  per mesh. Contact points are identical to the old per-vertex boneTransform (test compares them on jett/reyna).
- Tried fewer samples (3000/4000): sova's settled skin sinks under the floor (test_ragdoll fails), so the 6000-sample
  budget stays.
- Numbers (node rig harness, loaded machine, warm medians): xrSupports per corpse 38.2 -> 18.5 ms; corpse ticks per
  second at 120 fps 120 -> ~30 (near) / ~15 (far). Test: work/test_ragdoll_perf.cjs.
- Browser-verify: corpse fall smoothness at 30 Hz near the camera on a 120/144 Hz display; multi-kill (5+) freeze.

## Kill cost B: kill icon, shader checks, LOS keys, native re-plans
- xKiAdd: kill icons restart with DOM writes only (xRestart(.., nf): no getAnimations(), which flushes style, on the
  kill path; the class is re-added two frames on so a style pass without it always runs, also for online kill
  messages that arrive outside the rAF loop). The hit-marker path (vmHit) is unchanged. Audio blips untouched.
- Every WebGLRenderer (main, fallback, rebuild, agent preview, menu) goes through xShChk: three's
  renderer.debug.checkShaderErrors off (it read every program/shader info log after linking, forcing each compile to
  finish synchronously: 79 % of the first frames in the rendered profile). `?shaderdebug` turns it back on.
- Bot LOS cache keyed on numeric 0.25 m cells in a two-level Map (was a 6-number string per query), same 100 ms
  reuse, still clears past 800 entries. Bot sight checks were already staggered per bot at ~10 Hz (xTh think timer).
- Native-map bot re-plans: per-bot phase (0.35-0.45 s instead of everyone on 0.4 s) and at most 3 timed re-plans per
  frame (deferral happens before the wiggle-streak count so it never blacklists edges); a bot with no path, blocked,
  or starved > 0.25 s re-plans anyway.
- Numbers: LOS cache-hit workload (784k queries) 92 -> 24 young-gen GCs; all-miss workload 77 -> 67. Test:
  work/test_kill_perf.cjs.
- Browser-verify: kill banner pop on 2nd..5th kill in a round (offline and online); first frames of a match on a real
  GPU (no info-log stalls); `?shaderdebug` still reports a broken shader.

## Item 3: bot variety
Cause: on native maps every attacker pathed to one identical site point along the same shortest A* path; the shared
vendor/bot-routes.cjs existed but was not wired in.
- vendor/bot-routes.cjs: `steer` gains optional radius/out (old 5-arg calls unchanged), adds `rng` (seeded) and `spot`
  (spread standing spot near a goal). `route`, `hash`, `length` unchanged.
- Offline (work/bot_variety_runtime.js, inlined with bot-routes before xReady by install_valorant.py): per-round plans,
  own spot inside the site, <=1 lurker (most flank-minded non-carrier, rotates in late), staggered starts by
  personality, defender sites per-round shuffled, lane-varied routes seeded per bot+round and penalised along
  teammates' routes (<=2 re-routes per frame), 1.8 m teammate spacing while walking (not while fighting). Carrier,
  retake/defuse and dropped-Spike pickups keep exact goals.
- Server (server/src/bots.js, spike.js, simulation.js): same plans (per-round, own spot, <=1 lurker, staggered starts,
  defender sites shuffled), variedPath routes (also TDM/DM hunting), 1.8 m spacing.
- Tests: work/test_bot_variety_routes.cjs (offline, real Ascent/Bind nav), server/test-bot-variety.js (real worlds).
- Numbers (deterministic, 6 rounds x 22 s, sight lines off). Server, before -> after: Ascent distinct attacker routes
  14 -> 26 (per round 5/5/4/5/4/5 -> 5 every round), average moving teammate gap 4.52 -> 17.13 m, samples within
  1.8 m of a teammate 41.9 % -> 5.0 %; Bind 11 -> 26 routes, gap 3.68 -> 14.42 m, within 1.8 m 24.8 % -> 10.0 %.
  Offline native: Ascent 5 plain -> 27 varied routes, Bind 7 -> 30; site spots avg 5.3 / 5.6 m apart (min 3.35 m);
  one lurker every round; 24 distinct start delays; defender site order differs every round.
- work/test_client_online.cjs (fast Spike leg): on the default seed 7 the Vandal-armed pilot now goes 4/0 against pistol
  bots for the whole window (seeds 2/3 still die naturally), so after 30 s without a death a living enemy bot finishes it
  through the server's abilityDamage path and the page's death / round-reset handling still runs (reported as
  "death forced after 30 s").
- Browser-verify: attackers fan out (one lurker), hold distinct spots on site, defenders split across sites per
  round, no visible stacking/bumping in chokes; online (local server) bots do the same.


## Lag: GC in native bot nav hot paths
Cause: nmNear runs for every nmHeight sample (nmSegment probes every 0.18 m along each candidate hop, the ground
snap runs per bot per frame) and built a fresh 'gx,gz' string per probed cell; nmPath allocated three node-sized
typed arrays per uncached search and two [i,s] pairs per heap push; nmBlocked built two closures and a callback
object per call (also per nmSegment sample).
- nmNear: numeric cell keys (C.cn, built once from C.cells with the same per-cell order). nmPath: per-map scratch
  cost/prev/closed arrays (filled per search) and an index/score two-array heap. nmBlocked: one reused callback object.
- Test: work/test_nav_gc.cjs: the previous nmNear / nmPath / nmBlocked are embedded as the reference; real Ascent and
  Bind graphs give identical nodes (4500 queries each: plain, height-weighted, y-banded) and identical routes (with and
  without banned edges, unreachable ends); a 20000-query + 40-search workload runs with fewer young-gen GCs.
