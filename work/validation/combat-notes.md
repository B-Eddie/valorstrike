# Combat branch notes (`hark-combat`)

Findings and evidence for the combat/reliability items worked on `hark-combat`. This file is separate from
`work/remaining-validation.md` (owned by the `hark` branch work) and does not sign anything off.

## 1. Online aim pitch sign (fixed)

- The online input loop sent `p:-pitch`. The camera (`camera.rotation.set(pitch + rcl, ...)`, YXZ), server shots
  (`Simulation.fire`), bots and abilities all treat positive pitch as up, so aiming down sent shots upward online.
- Fix: `netInputMsg()` in `work/server_runtime.js` sends `p:pitch`.
- Regression: `work/test_online_pitch.cjs` compares the three.js camera forward, the input message and the server
  shot direction, and hits targets 3 m below and above. With the old sign the test fails.

## 2. Combat consistency, ledger row 10

### Hit volumes
- Before: server spheres (head r .19 at 1.62 m, body r .42 at .95 m, legs r .32 at .35 m) centred on the root.
  The client's bone-following hitboxes (repair_runtime.js `xrHitboxes`) put the head sphere (r .195) 0.08 m above
  the Head bone, about 1.81 m on a standing agent and 0.14 m forward of the root, so the server head was about 0.19 m
  low and centred on the wrong point. Remote crouch was never sent (row index 13 is ping), so remote
  rigs rendered standing while the server lowered the head.
- Now: `server/src/hitboxes.js` + `server/src/hitboxes.json`. The table comes from the real agent rigs through
  `work/build_hitbox_poses.cjs`. It uses the same lower/upper track split as `xvaKit`, the crouch weight 0.62 from
  `xUbAnim`, the `Pistol_Aim_Neutral` upper layer, and 8 animation phases for each of the 12 agents. Mean poses stay within 6 cm of every agent.
  The server picks stand / walk-run blend / crouch / crouch-walk / air from Motor state (speed, `ch`, `air`).
  The head sphere and body capsule are oriented with facing, and legs are body hits below 0.9 m (scaled with crouch).
  Sizes equal the client's (`test_combat_consistency.cjs` asserts this against the source).
- Crouch lowers the head by `ch` (up to 0.45 m), the same as the first-person eye drop.
- Rows now carry `[17]` crouch fraction and `[18]` aim pitch. The online client sets `u.cr` from `[17]`, so remote
  rigs play the crouch layer, and stores `u.np` for future aim-pitch rendering.
- **Rendering defect (fixed later on this branch, see "Native crouch render" below):** with native rigs (`nativeContact:true`) the
  repair crouch correction (`standHead - .45*cb`) is skipped. With the aim upper layer the rendered crouched head drops
  only about 4 cm (1.735 → 1.693 m) even though the pelvis drops 0.32 m. The comment in `xUbAnim` says the
  intended drop is about 0.45 m, matching the hitbox. Until the third-person crouch pose lowers the head, a crouched
  agent's rendered head sits above its authoritative head volume. The numbers come from
  `node work/build_hitbox_poses.cjs --one jett`.
  After animation changes (rifle pose, ledger row 4), re-run `node work/build_hitbox_poses.cjs` to refresh the table.
- Approximations: upper-body aim pitch (`X.pit`) and strafe hip yaw are not modelled, and neither is support-foot contact
  correction (a few cm). Additive fire/hit clips are also left out.

### Wall penetration
- The server had none: any wall stopped every bullet. The offline client wallbanged by name regexes that
  disagreed with the official data (Sheriff, Operator, Guardian, Outlaw, Ghost).
- Now: `Simulation.penetrate()` uses `weapons.json` `wallPenetration`, with the client's tier sizes: High 0.6 m at 75%,
  Medium 0.35 m at 50%, Low 0.15 m at 50%. It penetrates one wall at most and measures thickness with a reverse BVH ray (like `xThin`).
  The client's `xPen` now uses the same official tiers.
- Sage barriers stop bullets and cannot be wallbanged. `SpikeSimulation.traceShot` uses the base world plus barriers
  and flags `shotBlockedBy`, and `shotImpact` damages the barrier.

### Smoke, LOS, devices
- Server smokes were radius-3 spheres centred on the floor, and the rendered smoke is a radius-4 sphere 1.8 m up.
  Now `SMOKE={radius:4,lift:1.7}` (p[1] is floor+0.1). `smokeBlocks` is a proper segment test, so a viewer inside
  smoke cannot see out. The online client renders replayed smokes on the floor they landed on, not at an absolute 1.8 m.
- Bot sight: `Simulation.canSee()` is overridden in Spike by `sightClear` (geometry + barrier + smoke) on the bot's
  actual chosen target. The old Spike check tested the first listed enemy, not the nearest one the bot aimed at.
- Flash/leer and the turret use `sightClear` from the victim's eye. Flash facing is now 3D (yaw and pitch) with the client's
  `dot > 0.5` and within range. Blasts and fire zones keep geometry-only LOS.
- Bullets still pass through smoke, as in VALORANT. Smoke blocks sight, which stops bots aiming and firing.

### Status ownership (server vs client)
- Online, replayed enemy casts (`mpFx`) also applied local whiteout (`enPop`), Leer nearsight (`pNs`) and
  concussion (`mpStun` → `xConStart`) using the client's own range/facing guesses. These ran on top of the server's private
  status, so players got double or phantom effects. Now replay is visual only online, and blind, nearsight and concussion come only from
  `mpCliRS` status.

Tests: `server/test-combat.js` (in `npm test`), `work/test_combat_consistency.cjs` (in `test:client`).

## Bot personalities (user request, after row 10)

- Before: every bot ran the same code with the same constants (`reactionAt = .2 + (id%4)*.07`, same sine strafe,
  exact aim, straight A* routes). Under the same conditions they moved identically.
- Now: `server/src/bots.js`. Each bot gets a deterministic seed (`name|id|map`) and its own mulberry32 stream,
  separate from the shared weapon-spread RNG. Roles (entry, anchor, lurker, support) rotate per team, seeded by map, so each
  team mixes roles. Each bot also draws its own reaction time, aim error (smooth and settling during an engagement),
  head-vs-body aim choice, strafe style (sine weave, random switch, jiggle peek), crouch-spray and its range,
  engagement range band (entries close in, anchors hold), hold pauses, lurker flank waypoints, repath interval, node acceptance
  radius, lateral path jitter, walking near targets, and utility delay.
- Spike: each bot takes its own spot inside the site, and lurkers flank. Exact goals are kept for spike pickup and
  carrying. Utility is cast by role on each bot's timing through the normal `ab` command (charges and cooldowns apply).
- All of this runs on the server simulation, so online play is authoritative.
- Test: `server/test-bots.js`. The same seed replays exactly; four bots from identical starts diverge more than 1.5 m and
  act differently; engagement aim, strafe and first shot differ; filled matches mix roles; spike goal offsets work.
- Sanity: 60 s Ascent TDM with 9 bots, 18 kills, everyone moved (`/tmp` bench, not committed).

## Background-tab disconnect (task after bot personalities)

- Defect: the room drops a ready session after 15 s without any message. The client's only traffic was a 50 ms
  `setInterval` input loop, which browsers throttle in hidden tabs (about 1 Hz, then once a minute after ~5 min of
  Chrome intensive throttling), so switching tabs could drop a player.
- Client (`work/server_runtime.js`, "Background-tab liveness"): on `visibilitychange` it sends `{t:'vis',h}`. On hide it also releases
  held keys/fire and sends one idle input. A dedicated Worker timer (Blob worker, 2 s) sends `{t:'hb'}` while the tab is hidden; worker timers
  are not subject to the page timer throttling. The input loop also re-sends `vis` if the hidden state ever differs from what was last sent.
- Server (`server/src/worker.js`): `GameRoom.IDLE = {ready:15000, hidden:150000, loading:180000}`. `hb` only refreshes
  liveness (no input, no reply); `vis` sets `session.hidden` and clears the unit's input when hiding. A hidden client gets 150 s
  (covers once-a-minute throttled timers even if the Worker is unavailable); a client that goes truly silent is still dropped.
- Test: `server/test-background.js` (in `npm test`): visible silent drop at 16 s, hidden seat kept across 4 × 60 s throttled
  inputs and 200 s of heartbeats only, input released on hide, normal limit restored on show, hidden silent drop at 150 s, and the
  client block run in a VM (listener, key release, idle input + vis, one Worker, heartbeat only while hidden).
- Not verified in a real backgrounded browser tab (no Chromium in this sandbox).

## Two-player acceptance (ledger row 2, local)

- Harness: `server/tools/scripted-human.mjs` is a scripted human client speaking the browser's protocol (hi/start/ready/in/bye),
  reading only server snapshots, walking the nav graph to its opponent, aiming and tapping when it has a clear line.
  `twoPlayerScenario` runs: two QA profiles join one room → human-to-human hits and kills both ways, deaths and respawns →
  B leaves mid-match (a bot must take the seat) → B rejoins with the same profile and name → natural match end → both
  profiles' persisted `/stats` must equal the match totals (B's two stints aggregated once).
- Live local run: `npm run dev` + `node tools/two-player-local.mjs ascent dm` (real wrangler/workerd, real sockets, local
  Directory storage). PASS in 363 s: first human-to-human kills both ways at 25 s (A→B 9 damaging hits, B→A 12), leave → 10 units /
  1 human with a bot seat, rejoin as AcceptB, natural end at 360 s (Bot Sova 40 kills), records A 12/35, B 6/39 (1/3 + 5/36), 1 match each.
- Automated: `server/test-two-player.js` (in `npm test`, ~25 s) runs the same scenario against the real worker module
  (default fetch → GameRoom → Directory) in-process via `server/tools/local-cluster.mjs` (virtual clock, in-memory DO storage,
  WebSocket pairs), with the clock shortened to 60 s after rejoin. Also asserts a finished room refuses new joins (409) and DM spawn spread.
- Defects found and fixed:
  1. **Deathmatch spawn churn.** DM used the team anchors (team 0 → attacker spawn, every other DM "team" → defender spawn),
     so nine units respawned within 12 m of each other: 213 kills/min on Ascent, a bot hit the 40-kill limit in 59 s in the first
     live run. Now `Simulation.dmSpawnPoint()` samples 48 walkable nav nodes map-wide and takes the farthest from living units
     that no living unit can see (falls back to farthest). Ascent DM: 38 kills/min, spawn spread 126 × 133 m, 0/35 spawns in sight.
  2. **DM win credit for rejoined players** used only the last stint's kills vs a best computed from current units. `saveResults`
     now aggregates stints first and compares totals (bots included) for DM wins.
- Not covered: rendered browser clients (no Chromium here), TDM rejoin team assignment (a rejoiner takes the first bot's team,
  which can differ from their original team; records still aggregate by profile).
- Flaky (not ours, from hark's loading work): `work/test_agent_preload.cjs` line 27 (`locomotion.bin` cached) failed 1 of ~10 runs
  under load; passes on rerun. Looks like a flush-timing race in the test.

## Crowded-combat profiling (ledger row 12)

Bench: `Simulation` on Ascent TDM, 1 human seat + 9 bots, 1200 steps of 50 ms (60 s) plus a snapshot per step, Node 22 in this
sandbox, quiet machine, three runs each (bot RNG is `Math.random`, so runs differ slightly). Script kept out of the repo
(`/tmp`); the same loop as `server/bench-sim.js` with per-step timing.

| | avg tick | p99 | first tick | worst after 1 s |
|---|---|---|---|---|
| before (727807e) | 2.51–2.88 ms | 9.0–10.8 ms | 69–76 ms | 12–23 ms |
| after | 1.52–2.20 ms | 6.5–8.9 ms | 44–56 ms | 11–15 ms |
| Spike `five`, 40 s, before → after | 5.81 → 2.19 ms | 28.9 → 15.5 ms | | 92 → 58 ms |

Profile (before): Motor collision 51% (`world.blocked` capsule shapecast 38%, `ground` raycasts 15%), `world.near` 8% (full scan of
~9.5k playable nodes per call), A* 7% (three typed arrays allocated and filled per call), team spawn candidates 7.6% (full scan
+ capsule test of every nearby node on every respawn). The earlier 3.3 ms / 54 ms figure was measured under a different load;
the table above is the like-for-like comparison.

Changes:
- `world.near`: 4 m uniform grid with outward ring search and a provable lower bound; ties keep scan order, so results are identical
  (`nearScan` kept as the reference). ~45 µs → ~4.5 µs per call.
- `path.js`: CSR adjacency with precomputed edge costs (same evaluation order), typed binary heap with the reference sift order,
  generation-stamped buffers instead of per-call allocation, per-world LRU route cache (1024 entries, copies returned because bots
  `shift()` routes). Built at `Simulation` construction (`prepare`) so the first tick does not pay for it. ~1.0 → ~0.6 ms uncached;
  routes identical to the reference `search`.
- `world.blocked`: triangles whose bounds miss the capsule box are rejected before the exact segment–triangle distance.
- Team spawn candidates cached per anchor for static worlds (Spike's barrier-aware world view is not cached).
- Test: `server/test-perf.js` (in `npm test`): 8000 grid-vs-scan lookups + exact-node ties, 500 fast-vs-reference routes on
  Ascent and Split, cached-route copy safety, spawn cache.

Remaining hot path: the shared Motor's 128 Hz substeps call `blocked`/`ground` ~200 and ~150 times per tick; making those cheaper
means changing the shared motor or the BVH query and was left alone. The first tick is still ~45–55 ms (JIT/BVH cold start).

## Native crouch render (follow-up to row 10)

- Cause: in the native rigs `Spine1` is a sibling of `Pelvis` under `Splitter`; the retargeted crouch clips only translate
  `Pelvis`, so the torso stayed at standing height and stretched (head 1.724 → 1.679 m crouched with the aim layer, pelvis 1.079 → 0.759).
- Fix (`work/repair_runtime.js`, block "Native rigs (nativeContact)"): after the mixer and the foot-contact correction, and
  before the weapon grip IK and foot planting, `Spine1` is lowered so the Head bone sits at the upright head height (tracked on
  uncrouched frames) minus 0.45 × crouch blend, the same drop as the server head volume (`hitboxes.js`: upright head − ch).
  Legs and feet are untouched; the offset is undone in `xUbPre` (Spine1 has no position track); skipped when dead.
- Test: `work/test_native_crouch.cjs` (Jett, Breach, Sage real rigs): full-crouch head drop 0.04 → 0.45 m, half crouch 0.225,
  drop equals the server's within 1.5 cm, feet unchanged, undone, stands back up. Before/after render:
  `work/validation/native_crouch_before_after.png` (left: stretched torso before; right: corrected).
- `hitboxes.json` unchanged: the server's head height is upright pose − ch, which this correction now matches; the table was not re-sampled.

## Worker bundle carries hitboxes.json

- `npx wrangler deploy --dry-run --outdir <dir>` (no deploy) produced `worker.js` (1.09 MB) with the table inlined under
  `// src/hitboxes.json` (`headOffsetY: 0.08`, pose values present) and no runtime JSON import. `wrangler dev --local` also served it:
  the live two-player run registered human-to-human damage through `rayHit` → `hitVolumes`.
- Test: `server/test-bundle.cjs` (in `npm test`) bundles `src/worker.js` with esbuild like wrangler and asserts the table is embedded.

## Gameplay QA pass 2 (soak, client online, Spike loading, Lotus step)

Harness: `server/tools/soak.mjs` (in-process worker, bots + fuzzing humans, invariants every tick), `server/test-soak.js`.

- Soak 5 (all maps x DM/TDM/Spike, 600 s, 4 humans, seed 5): one violation, a Breeze DM bot stuck 8 s at
  (-30.5, 3.77, -68.4). Memory: 40-min Ascent Spike run (match ended 13-10 at 1696 s) heap 22.0 -> 24.8 MB, flattening;
  six back-to-back fresh-cluster runs on one map stay flat after GC (20.3 MB), so no leak. The cross-run heap growth in
  soak5's log is per-map world loading.
- **Breeze off-map pocket** (`c17bef7`): past the walkway edge near (-30, -68) there is collision
  4.3 m below the walkway with no nav node and void around it. Walking off landed there for good (old fall rescue only
  covers "no floor below"). `Simulation.guard` keeps an anchor (last grounded spot on the nav graph); a grounded unit
  more than 1.5 m below it with no playable node within 4 m at or below its height (`offMesh`) goes back to the anchor.
  0 false positives over ~15k legit-floor samples on all six maps and 90 s of bots-only DM per map. Test: test-soak 6c.
- **Bot progress check** (`c17bef7`): reset its 5 s window on any tick without forward input, so bots that paused a
  tick now and then never qualified. Now counts forward ticks (>= 60%). Test: test-soak 6b2.
- **Spike loading hold** (`e1fa9dd`): any loading human froze the round for everyone up to the 180 s load timeout,
  including mid-match rejoiners (who are out for the round anyway). Now a loader holds the buy phase only while alive in
  the round, at most 15 s per player and 15 s per round; still loading at round start = dead for that round (spike
  handed to a teammate), spectating once loaded, back next round. Test: test-spike-edges.js (last block).
- **Lotus step** (`99f92a4`): stairs near (-7, -5.5), floor 3.575 -> 3.948 -> 4.305 -> 4.616 m; the first riser is
  0.373 m, above the motor's 0.36 m lift and its riser test, so every walker stopped there. Step height 0.40 m in the
  shared motor (vendor/valorant-feel.js == server/src/motor.cjs); the wall-climb clamp scales with it (Bind wall test
  holds), 0.45 / 0.6 m ledges still block. eval-stairs: 99.1% -> 99.5% of 588 rising nav edges walked, 0 big drops.
  Test: work/test_stairs.cjs (0.375/0.39 risers, 0.45 ledge, real Lotus flight).
- **Spike seat churn** (`f57f875`): soak seed 8 Spike rounds ended "Defenders eliminated" with almost no kills. A
  mid-round leave put a seat bot in that sat the round out dead, and a rejoin into a full room removed the first bot on
  the team even when alive, so disconnects alone eliminated teams. The seat bot now takes over the leaver's living body
  (`SpikeSimulation.takeOver`: position, health, armor, loadout, credits, abilities) and `Simulation.add` gives up a dead
  bot (preferred team first) before a living one. Haven seed-8 160 s: round 1 went from churn elimination at 60 s to a
  played-out detonation. Test: test-spike-edges.js (last block).
- Soak 8 (all maps x modes, 600 s, 4 humans, seed 8, after the fixes above except seats): 18/18 runs clean, no
  violations or exceptions, heap per run +1 to 2 MB and flat.
- **Wedged high on a prop** (`0951a69`): soak 9 (400 s, seed 9, at f57f875), Ascent DM, a seat bot sat inside a
  prop at (-56, 6.53, -22.4), 2.5 m above the floor nodes (y 3.98) with no node at its height. `freeNode` only took nodes
  within 1.5 m of the unit's height, so unwedge and the escape found nothing all match. It now falls back to the nearest
  free node below (up to 4 m down). How the bot got up there was not determined (no nav node or spawn at that height).
  Test: test-soak.js 2b.
- **Online client test** (`f939f7b`): `work/test_client_online.cjs`, the real page in audit.js's fake DOM against the
  in-process server. The page's own player is piloted through its input globals by ScriptedHuman's nav hunter, so it
  kills and dies in TDM/DM/Spike (asserted), buys through the page in Spike, plus leave/rejoin swaps, round resets,
  match end, server disconnect. Fast variant ~21 s in test_all; `QA_LONG=1` is the long soak tool. No page exceptions
  found in either variant.
- Soak 9 (all maps x modes, 400 s, seed 9, at f57f875): 17/18 clean; the one violation is the wedged-high bot above.
- Merge of origin/hark (`7ce15da`, hark's ults/devices/layout work): conflicts in server/package.json (test list) and
  server/src/spike.js (fire() detain check kept beside takeOver/loadHold). Soak 10 on the merged tree plus `0951a69`
  (all maps x modes, 300 s, 4 humans, seed 10): 18/18 clean, no violations or exceptions.
- Suites at the end: server `npm test` 25 files, client `npm run test:client` 45 files (41 + test_client_online.cjs +
  hark's test_map_decals / test_short_layout / test_tp_cam_height), all passing.
- Not covered / left: rendered browser (no Chromium on this branch); how the Ascent bot got wedged 2.5 m up is unknown;
  the soak's Spike `kills` stat counts only snapshot kill events and reads low next to round outcomes. The room still
  drops a client that has not finished loading after 180 s (it no longer holds the round).

## Gameplay QA pass 3 (motor wall-climb, Spike ult ownership, slow loads, client frame checks, DM seats)

- **Motor wall-climb** (`1284d13`): the bot found wedged 2.5 m up an Ascent building in pass 2 got there by jumping into
  the corner at (-55.6, -22.1). The capsule crept to the wall at exactly `blocked()`'s .388 tolerance, the "descending
  beside a riser" clamp held it mid-air, contact counted as support, and each new jump rose with no collision test.
  Shared motor (server/src/motor.cjs == vendor/valorant-feel.js): rises stop at geometry, vertical probes use a 2 cm
  thinner capsule, support needs a floor under the footprint and the unit not inside geometry. Jump-into-wall scan:
  296 embedded samples -> 0. Test: test-soak.js 2c.
- **Spike ultimate / utility ownership** (`7cc455c`, found by the ults scenario soak):
  1. A leaver's live utility (Showstopper rocket, turret, Nanoswarm, Boom Bot, Lockdown windup ...) kept the removed
     unit's id as owner, so its kills had no kill event, score, credits or ult point. `takeOver` now hands it to the
     seat bot (alive or not) and carries Tour de Force / Headhunter / Run It Back and statuses (detain, slow, blind ...)
     with the body. A joiner on that team adopts any orphaned utility; a kill with no owner left still reaches the
     feed (`['k','',victim]`).
  2. Run It Back: dying inside the window dropped Phoenix's gun on the floor (he came back without it), and a round
     ending while he was down stripped his gear. Neither happens now.
  Tests: test-ults.js (new blocks after Run It Back).
- **Soak Spike invariants** (`bf6c3a0`): tools/soak-checks.mjs checks the economy at round end, carry-over at round
  start (halftime reset included), that detained units never fire, Run It Back windows, owned weapons, and a kill event
  or known cause for every death. New `abilities` / `ults` scenarios make bots and fuzzers spend utility and ults
  constantly, aimed at enemies. test-soak.js runs a Bind ults and a Lotus abilities soak.
- **Soak reproducibility / "room was not created" flake** (`bf6c3a0`, `648f270`): world loading (real file I/O) and
  `hi` authentication (real async crypto) ran while the virtual clock advanced, so under machine load a create could
  outlast the 5 virtual s wait, and a seed did not replay the same match (ability soak deaths varied 0 to 3 run to run).
  The harness now holds the virtual clock while a create loads (up to 120 s real) and while any `hi` is authenticating.
  Two parallel runs of the test-soak ability soaks now give identical stats.
- **Slow match loads** (`ce0a726`): a client still loading after 180 s was dropped as 'Connection idle' even while it was
  making progress. The page now reports progress (`lp`, every 5 s: agent-model and map-asset fractions) and the room
  keeps the seat while reports arrive (within 20 s) and the progress moves (within 120 s), never past 10 min. A load
  that does expire closes with 'Load timed out', and the page says so. The page's own start wait (`mpWaitStart`) uses the
  same rule instead of a flat 180 s. Tests: test-background.js 4b, test_client_online.cjs (slow-load phase).
- **Server frame checks on the client** (`ce0a726`): `netClean` in work/server_runtime.js shape-checks every server frame
  before the page stores or replays it (the frame loop re-reads `NET.latest` and round state, so one malformed snapshot
  threw on every frame). The handler has a last-resort try/catch that counts fallbacks. The long fuzz (seed 1) hit that
  guard twice:
  1. `end`: `ev` was a number; `mpCliMsg` replays `end` through `mpCliSnap` (`for (const v of m.ev)`). `end` and `re` now
     get the full snapshot cleaning (u, k, d, ev, fx, fw, tl), and `end.over` must be a string or null.
  2. `rs`: `reyna.souls` was not a list (or a soul had no `p`). `netReynaSync` maps the souls and spreads `p`. Round state
     (alone or inside `start` / `ao`) now checks `reyna.souls` (objects with an id and a 3-number `p`), `channel`,
     `ab.cool`, `ab.anchor`.
  `QA_LONG=1 SEED=1 node work/test_client_fuzz.cjs`: 400 sequences, 13.6k messages, 298 reach a live match, 0 guard
  fallbacks, no exceptions. The fast variant (70 sequences) runs in test_all.
- **DM seat-taker** (`648f270`, soak 13): a human joining a full DM room took the replaced bot's team id, and with it that
  bot's score row (points it never scored). Each DM unit now has its own side. The soak checks every DM unit's row
  equals its kills, and reports DM scores by name (the "scores array with nulls" was the sparse per-unit-id array, not a
  defect in itself). Test: test-soak.js 6d. The DM violations in the first soak-13 run were not kept (the log was
  overwritten by the rerun). The rerun after the motor fix (all maps x modes, 300 s, 4 humans) was clean 18/18, and so
  was DM on all maps after this fix.
- Soak 12 (all maps, Spike, ults and abilities scenarios, 400 s, run on the working tree with the ownership and Run It
  Back fixes): 12/12 clean.
- Flaky, not fixed: test_client_online.cjs fast TDM once failed "page player killed and died (0/5)" under heavy load
  (load average ~6 on 2 CPUs, another agent's suite running). It passed alone and on the retry. The piloted fight has a
  60 s virtual window and is not seeded end to end.
- Merge of origin/hark (`9cf33ce` up to bd76683, then `ad18b9e` for 8da7b53): conflicts in simulation.js (kept
  `safe:null` on spawn plus hark's knife heavy input `kh`), server_runtime.js (hark's knife pulse/heavy input plus the
  lp progress loop), native_maps_runtime.js (hark's `nmLoadScene`; the `NM.loaded` progress report moved into it),
  test-ults.js (both sets of blocks, one summary line), test_agent_preload.cjs (both sides fixed the same Cache Storage
  flake; hark's kept). index.html took hark's side in its two conflicted runtime blocks and was then regenerated
  (byte-identical on a second run). Suites on the merged tree: server 25 files, client 54 files, all passing.

## Gameplay QA pass 4 (deterministic online fight, offline soak, client lifecycle leaks)

- **Online client fight is seeded** (`7422bc0`): test_client_online.cjs seeds Math.random in both realms (SEED, default 7)
  and holds both virtual clocks while a socket is connecting or a session is still authenticating, so the pass-3 flake
  (TDM "0/5" under load) replays from its seed instead of depending on machine load.
- **Offline DM / TDM / Escalation spawned on Ascent's callouts on every legacy map** (`0179fd6`): `dmPts` read the nav
  graph from `nodes`, but `xgGet()` returns it as `N`, so it fell back to `CALLOUTS` (Ascent's): units spawned outside
  Bind's walls, several stacked on one spot. It now reads `N` and falls back to the current map's own callouts
  (`xgCallouts`). work/page_harness.cjs boots the real page in audit.js's fake DOM (optionally on real three.js);
  test_client_offline_soak.cjs plays the offline modes on it.
- **Map switch left GPU resources behind** (`2eaf3b6`): freeing a lazily built map (Split / Lotus / Breeze) disposed its
  geometry only. `xFreeMap` also disposes its textures and materials (not ones the rest of the scene still draws or that
  are flagged shared), the callout sprites (they live in XCALL, not the map group), and drops `XD_STAT[k]` / `XF_STAT[k]`,
  which kept the old group reachable. The team ring under each unit uses one shared geometry (`xG("Ring", ...)`).
- **Lotus breakable wall stayed in the gun raycast after leaving Lotus** (`822d7c6`): the wall mesh is pushed
  into `XLDH` (extra player-raycast hitboxes) and was only removed when destroyed. On later maps a player shot through
  the wall's old spot hit an invisible wall, and the list kept the whole freed Lotus map (and through a merged mesh's
  closure, every deco source geometry) alive. `xLdh()` prunes parented entries whose map is hidden or detached at each
  use; `xFreeMap("lotus")` also clears LG's doors / gates / wall / debris. Found with a heap snapshot retainer path
  (XLDH -> wall -> old map group).
- **Aim trainer bot targets** each built their own CapsuleGeometry, left on the GPU after `aimDrop` (the renderer uploads
  geometry even under an invisible material). Now shared via `xG("Capsule", ...)`.
- **test_client_lifecycle.cjs** (24 matches per run in one page session, every offline mode on all six maps) is in
  test_all. Its earlier "~620 geometries per cycle" was mostly its own measurement: `__qaGpu()` kept every live geometry
  in `window.__qaLiveG`, so the next `gc()` could never collect it (a self-perpetuating false leak); `measure()` now drops
  those lists before collecting. The harness's `Request` now resolves relative URLs against a base, as a browser does;
  Node's threw "Failed to parse URL" after three's FileLoader had marked the URL in flight, so every later
  `xvLoad('environment/cover')` queued forever (harness-only; in a browser the fetch settles). After the fixes, 3 cycles
  (36 matches): live geometries 2144 -> 2144 -> 2144, scene objects flat, listeners/timers flat, heap 64 -> 66 MB.
- Remaining, not fixed: drawn-then-orphaned geometries rise 4 -> 6 -> 7 over 3 cycles (6 were created at boot before
  stack tagging, 1 is Spike Rush's persistent orb geometry); within tolerance and not tied to a match type. Legacy Bind /
  Haven callout textures (~45) count as orphaned while another map is up; they are kept for reuse and do not grow.

## Gameplay QA pass 5 (online key rebinds, online buy sellable, settings persistence, results flows)

- **Online F / G / R after a rebind**: the keymap layer re-sends a rebound key on `window` only, so the online pick-up /
  drop / reload handlers registered on `document` never saw it. They now listen on `window`, honour `xKbSkip` / repeat,
  and R no longer sends a second `reload` when the page's own R handler already started the local reload.
  New: `test_client_online_rebind.cjs`; `test_floor_pickup.cjs` follows the window handler.
- **Online buy cards sellable**: the page's purchase log stayed empty online, so bought cards never showed as sellable.
  The server's `bo` reply carries the round's purchase list (`bl`) and the page rebuilds the log from it (`p: 0`, the
  server charges a stacked buy in full). Round state (`rs`) also carries `bl` during the buy phase, so a reconnect /
  page-log reset mid-buy gets the sellable cards back (rebuilt only when the list changes). Covered in
  `test_client_online_buy.cjs`.
- **Settings lost on reload**: aim assist, crosshair options, hit markers, damage numbers, dynamic/static crosshair and a
  custom graphics set's resolution / shadows / skyline were not saved or not restored. Now persisted and validated on
  load. `page_harness.cjs` gained `boot({ls})` / `lsStore()` (a localStorage present during the page's boot, i.e. a
  reload). New: `test_client_settings.cjs`.
- **Results flows**: the offline kill feed named "Classic" / the settings weapon instead of the gun in hand; it uses
  `wName()`. Online, a finished server room refuses Start and new joins, so "Back to room" left a dead room: the button
  reads "Leave room" and returns to the lobby. New: `test_client_results.cjs`.
- **Ownerless utility kills**: a kill by utility whose owner left the match showed a blank killer. Effects record their
  agent (`ag`) and the kill event credits it (e.g. "Raze" with the Ability icon); the page falls back to the weapon /
  "Utility" for an older server's blank name. `test-ults.js` checks the credited name.

## Gameplay QA pass 6 (two-human gunplay: armor boundaries, falloff, pellets, spray, swap / reload, ammo / pickup)

New: `server/test-gunplay.js` (in `npm test`) and `work/test_client_online_gunplay.cjs` (page + scripted human on the
in-process server; it keeps the VALORANT FEEL block the audit fixture strips, and drives the page's own `fiveTick` /
`vmTick`, since the harness page sits behind a cover overlay and its rAF loop never runs the match tick).

- **HP / armor float leftovers**: armor absorbs `damage * .66`, so e.g. Odin legs x3 at 50 armor left 54.00000000000001
  hp, which rows (`Math.ceil`) showed as 55 (30 of 306 weapon x band x part x armor cases were off by one; 1.000000000000007
  hp showed 2). Server `fire()` / `abilityDamage()` and the offline `hurt()` / `armAbs()` snap hp / armor to 1e-6. Shots
  to kill already matched the exact model in every case.
- **Falloff / headshots**: every weapon's head / body / leg damage per range band equals weapons.json (client
  `weapon-calibration.js` is byte-equal in content). Offline wallbang rounding: fixed in pass 7.
- **Spray recoil parity**: the server fired every bullet of a spray straight down the crosshair (first-shot spread only);
  the client's bullets climb and drift. The climb / drift / bloom / reset (.375 s pause or weapon change) now live in the
  shared motor (`sprayReset / sprayBloom / sprayStep`, `REC` weights = client `WEAP.rec`), used by both `gFire` and server
  `fire()`; the vertical climb is identical shot for shot (the drift side is random on each side).
- **Shotgun pellets**: the server spread pellets over `tan(firstBulletAccuracy)`; the client jittered the centre by that
  cone and then spread pellets over a separate `W.cone` (wider; Judge .075 vs .044), and in world axes (facing along X
  the horizontal spread was halved). Client pellets now use the shot's cone (incl. bloom) in the shot's own basis, centre
  not jittered, as the server. Online, the Bucky's client-only alt fire is off (the server has no alt-fire mode).
- **Swap mid-reload**: the server refused `equip` while reloading, so the page (whose swap cancels the reload) was snapped
  back to the reloading gun, and a knife swap mid-reload left the gun in the server's hands, so the knife click fired it.
  A swap now cancels the reload server-side, and is taken during the equip time too (the new gun's equip time gates its
  first shot; test-spike-edges updated). Client: a local swap sends `equip` at once and holds the snapshot weapon
  reconcile until the server names that gun (or 1 s): a snapshot landing before the 50 ms net loop used to revert the
  swap and reset `netWeapon`, so the equip was never sent. Ammo from snapshots applies only to the gun the server holds.
- **Reload timer left below 0**: a finished reload left `reloading` at e.g. -0.05; online code tested truthiness, so the
  page counted as reloading forever after its first reload: ammo sync stopped and the next auto-reload (empty magazine)
  was never sent, so the server stayed empty. Timer clamped to 0; online checks use `reloading > 0`.
- **G mid-reload** was refused server-side (offline allows it); the gun now drops with its magazine.
- Checked, no bug: enemy gun picked up off the floor keeps magazine / reserve and its reload draws from that reserve;
  next round refills magazine and reserve. Same-tick trades: changed in pass 7.

## Gameplay QA pass 7 (trade fairness, wallbang rounding, merges, shotguns, economy / ults / defuse edges)

- **Same-tick trades**: a tick resolved each unit's shot inside its movement loop, so the first unit in the list (the room
  creator) won every same-tick trade, and it shot at the others' previous-tick positions. Shots now resolve after every
  unit has moved (`fireTick`, both `Simulation` and `SpikeSimulation`), first shooter rotating each tick; a unit killed
  earlier in the tick still cannot fire back. `test-gunplay.js` §7: exactly one survivor, both sides win across ticks.
- **Wallbang rounding**: offline damage was `round(floor(raw) x k)` vs the server's `floor(raw x k)` (70 of 225
  weapon x band x part x k cases off by one, e.g. Odin head 77.5 x .75). The shot now calls `xWkDmg`; the feel layer
  floors the unfloored row value x k. `test_combat_consistency.cjs` §5 checks every case against the server formula.
- **Offline bot shotguns did one pellet**: the base `wDmg` returns a shotgun shot's expected pellets landing when called
  outside the player's pellet loop (`xPelOn` false: the bots' shots), but the feel layer's override always returned one
  pellet, so an offline bot Judge did 17 a shot instead of ~119. The override keeps the expected-pellet formula on the
  profile's floored rows, and a gun with no profile (the Bucky's alt fire) falls back to the base table with its falloff
  (it returned the flat near value). `test_combat_consistency.cjs` §6: 63 gun x range x part cases + Bucky alt.
- **Kill feed over the subtitle at 640x360**: in landscape <=820 px the kill feed (right:8px) and `#xSub` both started at
  top:48px; `#xSub` is bounded to the band between the minimap columns (136 / 184 px side margins, cdf12e3), so any
  feed row wider than that margin, i.e. most once kills stacked, ran across the subtitle. The feed now starts at 66 px
  (subtitle 48 + explicit 12 px line + 6 px); touch (top:100px) and portrait placements unchanged. Parse-rule test:
  `test_short_layout.cjs` (e) (feed top vs subtitle line box per band, cascade order, no later override). Not rendered
  in Chromium (owned by another agent): a browser check of the 640x360 feed with 4-5 stacked kills is still open.
- **Online HUD at an armor boundary** (step 4): the earlier attempt's server shots never hit the page player because the
  scripted foe was aimed with `look` 0, which faces -z, while the page player stood at +z (server `fire()` sends the shot
  along (-sin look, ., -cos look)). Aimed with look PI the foe's shots land; `test_client_online_gunplay.cjs` §5 now
  checks Odin legs x3 into 100 / 50 = exactly 54 / 0 on the server and "54" / "0" on the page HUD (`#xHp` / `#xArm`).
- **Ult points online**: the server granted ult points for kills only; VALORANT (and the offline page, `jUlt`) also give
  +1 for dying, for planting (the planter) and for defusing (the defuser). `SpikeSimulation` now counts deaths from the
  units' death counters every tick (guns, utility, falls; once each, before the half-time reset), and the plant / defuse
  credit their unit. New `server/test-economy.js` (in `npm test`): loss streak 1900 / 2400 / 2900 reset by a win and at
  the half, win 3000, 9000 cap, half-time 800 + ult reset, kill 200, plant 300 to every attacker (dead too), overtime
  5000 with a side swap each round, and the four ult sources. Open question, not changed: a Phoenix killed inside Run It
  Back also gets the death point (his deaths counter rises); unverified against VALORANT.
- Checked, no bug: loss bonus cap and streak reset, plant bonus to dead attackers, half-time / overtime credits, a defuse
  taken over by another defender drops to the 3.5 s checkpoint, a dead defuser's progress drops to the checkpoint.
- **Heals clamped a Reyna overheal**: Sage's heal (and Phoenix's Blaze / Hot Hands self-heal) set
  `hp = min(100, hp + rate x dt)`, so a heal still running on a Reyna who had Devoured past 100 dropped her back to 100.
  Heals now only act below 100. `test-reyna.js`: 130 hp overheal untouched by a heal, 60 hp still healed 20 hp/s.

## Gameplay QA pass 8 (spread / air inaccuracy, spray, crosshair) — user report "jump and the sniper is accurate"

- **Movement / airborne spread was not per weapon**: `Motor.spread` (shared server + page) had one airborne value per class
  (snipers 10, SMGs 7, everything else 12 deg) and, while moving, a rifle / heavy / SMG row with every other gun falling to
  the pistol row: a running or crouch-walking scoped Operator / Marshal / Outlaw was +2.3 / +0.5 deg, walking +1.1, and a
  jump-strafe shot right after landing (still moving fast) was near-accurate. Now the published table for all 18 guns
  (wiki.playvalorant.com/en-us/<Weapon>, "Spread values"): first shot standing / crouched (hip and ADS), crouch-walk / walk /
  run / airborne penalties (Operator 7.5 / 10 / 15 / 15, Marshal and Outlaw 7.5 / 10 / 15 / 20, rifles .8 / 3 / 6 / 10,
  SMGs .15 / 1 / 2.5 / 10, pistols ~.5 / 1.1 / 2.3 / 7, shotguns .5 / 1 / 2 / 4). Scoped snipers are 0 only while still. The
  .2 s landing lock uses the run penalty (inferred; no published landing value).
- **Spray error cap per weapon**: bloom capped at .024 rad for every gun; now at the published max spread over the first
  shot (Vandal 1.0, Phantom .9, Guardian 1.58 ...; crouched max when crouched; Ares shrinks to its .7 min). Gun recovery
  time per weapon from the update history (Vandal .375, Phantom / Bulldog / Guardian .35, Stinger .4; others keep .28).
- **Running recoil**: Vandal / Phantom / Spectre climb x1.8 running or airborne (patch 6.11), Frenzy x1.5 (patch 4.0).
- Server and page use the same `Motor.spread / bloomCap / recoveryTime / recoilMove`; the hip crosshair gap
  (`gSpread x 450`, 40 px cap) follows the new cone. Tests: `server/test-spread.js` (wiki table, online jumping scoped
  Operator over the 15 deg cone, still = centre, spray caps, recovery, running recoil), `work/test_air_spread.cjs` (page
  gSpread = server spread for 18 guns x 7 states x hip / ADS / scoped, offline jumping Operator, crosshair gap).
- Not done: per-weapon recoil *patterns* — the wiki publishes no shot-by-shot recoil data, so the climb stays the shared
  REC-weighted model.
- `work/test_client_online_gunplay.cjs`: the harness page has no map floor and free-falls; with the airborne recoil
  multiplier its Vandal spray climbed 1.8x the grounded server body. The spray check now stands the page on the server
  body's floor (stubbed `groundAt`, restored after).

## Gameplay QA pass 9 (room crash, crosshair, spectator, Run It Back, friendly fire, spread corrections)
- **Room halt on a sidearm-only round**: the empty primary slot is `null`, so an `equip {w:null}` (or no `w`) matched it and
  left the unit holding no weapon; every later tick threw and the room's simulation stopped. Equip now takes only a real
  weapon name the unit holds (primary / secondary / Knife). `test-spike-edges.js`: null / undefined / '' / 0 / prototype
  names / unheld guns refused on a pistol round, the simulation keeps ticking, Classic <-> Knife still swaps.
- **Crosshair = VALORANT's stock crosshair (profile code 0)**: white; outlines on .5 / 1; centre dot off (opacity 1, 2);
  inner lines .8 / 6 / 2 / 3 with movement error off and firing error on; outer lines .35 / 2 / 2 / 10 with both on
  (multipliers 1); fade with firing error on; sniper scope dot red .75 / 1 (senslab.pro/crosshair/valorant decoding code 0;
  tracker.gg builder defaults; r/VALORANT "Crosshaircode reverse-engineered"). Movement and firing error are separate
  (`xhErr`), each line set opens by the error it is set to show. Saved settings: a saved crosshair equal to one of the two
  old shipped defaults (never changed) takes the new defaults; any other saved crosshair keeps every value, the old global
  movement / firing toggles applying to both line sets. `work/test_crosshair_error.cjs`.
- **Spectator follow**: picking the spectated teammate by index jumped to another teammate whenever someone earlier in the
  list died; the cam now stays on the followed player until they die or the player cycles, then moves to the next living
  one after them.
- **Team wiped = camera under the map** (user report): with every teammate dead the spectate cam fell to the spike / body
  orbit, whose height was absolute (centre y 1, camera y 12), so on raised native floors (Lotus sites ~6 m) its origin sat
  under the floor and the wall pull-in left the camera below the map (offline 5v5 attackers wiped after a plant, the
  post-round, online 5v5). Now, as VALORANT: whole team dead -> follow the living enemies, killer first, Space / click
  cycles them (label "· ENEMY"; respawn modes excluded); nobody alive -> the orbit is floor-relative (nav floor under the
  spike / carrier / body). Repro on the old page (raised 6.4 m floor, online path): orbit camera y 5.7, under the floor. Floor guard: every spectate camera stays >= the followed player's nav floor + 1.2 m (a floor face
  just above a sunk target counts). `work/test_spectate_follow.cjs` (follow logic + the real page on a raised native floor,
  offline 5v5 after a plant and the online 5v5 path: killer / cycle / third person at eye height, sunk target, orbit).
