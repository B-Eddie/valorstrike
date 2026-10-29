# Jump feel — 2026-10-29

Implemented stronger air steering, repaired the movement-start jump speed cap, and made buffered hops wait for landing contact. The measured vertical arc already matched the project's Valorant reference, so launch velocity, gravity, height, flight time, fall speed and landing recovery were retained. This is a measured controller improvement; human confirmation of Valorant-like feel is still required.

**Actual runtime and scope.** `vendor/valorant-feel.js` is the motor loaded by `index.html:1913`; `work/feel_runtime.js:33` calls its `step()` from the active player controller. `server/src/motor.cjs` is the identical authoritative copy used by the simulations. The earlier legacy `moveP` in `index.html` is superseded and was not edited. The separate surf controller is outside this change.

Only three existing files changed: the two motor copies and `GAME_FEEL.md`. Added `work/bench_jump.cjs`, `work/test_jump_feel.cjs`, and this validation directory. SHA-256 comparison of all 4,986 original files confirmed that all 545 audio files, `index.html` (including every sound reference), animation code/assets, map pools and server configuration stayed unchanged. All exported motor constants were compared: **only `airAcceleration` changed**. See `scope.json`. No installer/rebuild was needed because the page already loads the external shared motor. No git commands, push, server/worker redeploy, or browser were used.

**Target and source confidence.** [GAME_FEEL.md](../../../GAME_FEEL.md) and the [project parity audit](../valorant-parity.md) attribute a 6.902 m/s launch and 20.45 m/s² gravity to updated Stark measurements: analytically 1.164734 m apex, 0.337506 s to apex and 0.675012 s flight. Keep those values, ballistic descent, no air drag on release, and no landing movement slowdown. At unchanged run speeds, analytic level-ground range is 3.645066 m with a rifle and 4.556333 m with a knife.

The requested search-service connector returned `isError: true` with no content. Fallback web search worked. Both the original and canonical published [Stark Google Doc URLs](https://docs.google.com/document/u/2/d/e/2PACX-1vTsGYzGYiO78fcr_frhhBmzDaMvEqgBRd3b5u7TNzXRAhKflvFOovleWmavebIfFywh3DHppT75xHAk/pub) were inaccessible. A search retrieved [Stark's original 2022 post](https://www.reddit.com/r/VALORANT/comments/utc7qf), which gives the older estimates 1.2 m / 21 m/s² / 7.098 m/s; it does not independently verify the project's updated values. [Riot patch 12.09](https://playvalorant.com/en-us/news/game-updates/valorant-patch-notes-12-09/) says Neon's High Gear airborne speed now matches melee speed; it supplies no general air-acceleration or jump-gravity constant. No exact Riot air-control value was obtained. **12 m/s² is a tuning choice, not a claimed Riot measurement**: weaker than rifle ground acceleration (18.75 m/s²), but able to redirect a rifle run by 45° around the apex and by 90° within one jump. The pre-existing 3.5 m/s² approximation could not accomplish either.

**Measurements.** Same dependency-free harness before and after, running the real shared motor over a flat, collision-free world. Run-up is one second at the stated speed. Primary measurements use 128 Hz; raw JSON includes 30, 60, 128, 144 and 240 Hz. Steering is isolated at 1,000 m above the floor to measure response beyond one jump without landing friction. This is a synthetic bench, not an in-game recording.

| Measurement | Before | After |
|---|---:|---:|
| Launch / gravity | 6.902 m/s / 20.45 m/s² | unchanged |
| Sampled apex above takeoff floor | 1.164708 m | 1.164708 m |
| Sampled time to apex | 335.938 ms | 335.938 ms |
| Flight through first landing sample | 679.688 ms | 679.688 ms |
| Rifle jump range, 5.4 m/s | 3.670313 m | 3.670313 m |
| Knife jump range, 6.75 m/s | 4.587891 m | 4.587891 m |
| Air-control acceleration | 3.5 m/s² | 12 m/s² |
| Perpendicular steer after 250 ms, `(vx,vz)` | `(4.7813, 0.6187)` m/s | `(3.2787, 2.1213)` m/s |
| Perpendicular steer angle after 250 ms | 7.373° | 32.903° |
| Time to turn velocity through 45° | 1,093.750 ms | 320.313 ms |
| Time to reach full perpendicular target velocity | 2,187.500 ms | 640.625 ms |
| Reverse input: time to cancel forward velocity | 1,546.875 ms | 453.125 ms |
| Reverse input: time to reach full reverse speed | 3,085.938 ms | 906.250 ms |
| Move+jump together from rest: speed after 250 ms in air | 0.146484 m/s | 3.146484 m/s |
| Jump first, then move: speed after 250 ms in air | 0.875 m/s | 3.000 m/s |
| Coast in air: speed after releasing keys for 500 ms | 5.4 m/s | 5.4 m/s |
| Last airborne downward speed before normal landing | 6.837844 m/s | 6.837844 m/s |
| 10 m fall: duration / last airborne speed | 992.188 ms / 20.130469 m/s | unchanged |
| 20 m fall: duration / last airborne speed | 1,406.250 ms / 28.598047 m/s | unchanged |
| Held-run speed at landing | 5.4 m/s | 5.4 m/s |
| Landing movement lock / forced speed penalty | none | none |
| `lp` landing timer, nominal / sampled expiry | 200 / 203.125 ms | unchanged |
| Landing spread timer, nominal / sampled expiry | 225 / 226.563 ms | unchanged |
| Re-jump after a release sample and new press | 15.625 ms | 15.625 ms |
| Camera landing dip / settling time | 1.561 cm / 414.063 ms | unchanged |
| 4 s of alternating jump presses at 128 Hz: launches / landings | 6 / 2 | 6 / 5 |
| Same test: relaunches above ground without a landing | 3 | 0 |

Flight/range include the entire sample that reports landing, so they slightly exceed analytic impact-time values. At 30 Hz the landing-report frame is 700 ms; at 60 Hz 683.333 ms. This is sample quantization, not a changed gravity or floatiness curve; every full-speed arc record is identical before/after at all five rates. Fall speed is the last sampled airborne velocity; analytic normal-jump impact is 6.902 m/s. The controller has no terminal-velocity cap, which was retained. `lp` does not gate movement or another jump. Camera settling means both displacement under 1 mm and camera velocity under 1 cm/s, measured using the existing `vfCamDip` function without editing it.

The last jump of the 4 s repeated-hop bench is still airborne, so 6 launches should have 5 landings. Before, buffered jumps reused the walking ground probe's 2.5 cm tolerance and relaunched before physical contact. Across 30/60/128/144/240 Hz the old motor emitted only 1/0/2/1/0 landing events; after it emits 5 at every rate, with zero mid-air relaunches. This corrects the motor event used by existing landing feedback; audio code and references were not changed.

**Changes, in both byte-identical motor copies.**

- `vendor/valorant-feel.js:10`–`13`, mirrored at `server/src/motor.cjs:10`–`13`: `C.airAcceleration` 3.5 → 12 m/s², with the approximation and response target documented. No other constant changed: notably jumpSpeed 6.902, gravity 20.45, knife/run/walk/crouch speeds, ground acceleration/friction, step height, landingLock .2 and landSpreadTime .225 remain exact.
- `vendor/valorant-feel.js:203`–`205`, mirrored at `server/src/motor.cjs:203`–`205`: air target cap now uses `Math.max(P.takeoffSpeed || 0, max, .1)` rather than `Math.max(P.takeoffSpeed || input.speed, .1)`. A tiny nonzero takeoff speed no longer caps the entire jump. `max` is the existing current weapon/stance/tag speed. The existing melee/tag ceiling remains.
- `vendor/valorant-feel.js:237`–`239`, mirrored at `server/src/motor.cjs:237`–`239`: a buffered jump while airborne requires actual ground contact (`!P.air || P.y <= gy + .00001`) as well as the existing support check. The 70 ms buffer and held-jump behavior remain. Ground walking support tolerance is unchanged.
- `GAME_FEEL.md:19` documents the tuning and links this report; its verification list includes the new bench and regressions. No movement animation timing was changed.

**Validation.** Node v24.22.1. Logs and individual results are in `tests/`.

| Command (from repository root, unless prefixed with `cd server`) | Result |
|---|---|
| `node work/test_jump_feel.cjs` | PASS: 53 checks, plus per-tick client/server state parity at five refresh rates; includes cap, steering, buffering/landing events, speed limits, stance/tag, arc, momentum and held-jump behavior |
| `node work/test_feel.js` | PASS: 74 existing movement/accuracy checks, including ground speeds, acceleration/braking, jump arc, crouch, ceilings, walls and landing |
| `node work/test_net_reconcile.cjs` | PASS: 118 snapshots, zero snaps or vertical pulls; existing dash/jitter cases pass |
| `node work/test_game_rules.cjs` | PASS |
| `cd server; node test-release-gate.cjs` | PASS; no production Spike/local-origin opt-in and no QA imports |
| `cd server; node test-parity-rules.js` | PASS; includes fall damage |
| `cd server; node test-game-rules.js` | PASS |
| `cd server; node test-spread.js` | PASS; airborne and landing accuracy retained |
| `cd server; node test-bodies.js` | PASS; character collision and prediction parity |
| `node work/test_movement_sampling.cjs` | BLOCKED: `Cannot find module 'three'` |
| `node work/test_tp_jump.cjs` | BLOCKED: `Cannot find module 'three'` |
| `cd server; node test-wall-slide.js` | BLOCKED at native-world import: package `three` missing |
| `cd server; node test-ropes.js` | BLOCKED: package `three` missing |
| `cd server; node test-stairs.js` | BLOCKED: package `three` missing |
| `cd server; node test-collision-parity.js` | BLOCKED: package `three` missing |
| `cd server; node test-traversal.js` | BLOCKED: package `three` missing |

There are no `node_modules` in this tarball. The task states `npm install` fails with sandbox EPERM; installation was not retried. The full npm suite and browser verification were not completed. No browser, real network gameplay, native-map clearance confirmation or human feel test occurred. Dependency-free collision/ceiling checks and motor parity passed; those do not substitute for native-map or human validation.

Reproduce the same before/after bench without packages:

```sh
node work/bench_jump.cjs work/validation/jump-feel/before/valorant-feel.js
node work/bench_jump.cjs
node work/test_jump_feel.cjs
node work/test_feel.js
```

`before/valorant-feel.js` is the original motor preserved before tuning; `before.json` and `after.json` contain raw results. The original whole-tree checksum manifest was kept outside the deliverable at `/tmp/valorstrike-jump-tree-before.json`; `scope.json` records the comparison result.

**Human verification and open questions.**

1. On flat ground, use a known 1 m marker/box and confirm feet rise about 1.165 m above the starting floor. A standing jump should clear a 1 m top with adequate headroom and fail a 1.3 m top; approach geometry and crouch clearance matter. The camera's standing eye offset is not jump height. Flight should be about 0.675 s; compare a stationary jump and full-speed rifle/knife jumps.
2. At a rifle run, jump, release forward and hold a perpendicular direction. The steering should be visible by 250 ms; a 45° velocity change takes about 320 ms. A jump back toward cover should cancel forward movement around 450 ms, rather than continue drifting forward for the whole jump. Release every movement key in midair to check momentum retention. Confirm this steering strength against real Valorant: 12 m/s² remains the main subjective tuning question.
3. Press movement and jump together from rest, then compare with jumping first and moving immediately afterward. Both should offer usable air movement. Test run-up jumps separately: they should retain their original distance and arc.
4. Tap jump repeatedly near landing at 30/60/144+ FPS. Each hop should contact the floor and produce the existing landing feedback. Hold jump to verify a single hop. Keep forward held through landing to check momentum, then release to check normal ground braking. Landing spread should recover in about 225 ms. Check crouch-jumps, low ceilings, stair edges, box tops and rope exits on native maps after dependencies are available.
5. Repeat offline and online with real latency. Confirm no vertical pulls, surprise speed boosts or delayed landings. Existing deterministic reconciliation passed, but actual network play was not available here.

If the complaint persists with the same ballistic height/time, obtain a short human A/B description distinguishing upward arc, downward snap, steering, landing feedback and presentation. The animation branch was not imported or rebuilt; any remaining presentation issue needs separate evidence and review. The main agent should review the tree, restore dependencies, complete the blocked checks and confirm feel before pushing. Nothing was pushed or redeployed.
