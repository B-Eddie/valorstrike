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
