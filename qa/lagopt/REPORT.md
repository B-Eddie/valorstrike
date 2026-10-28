The tree now has lossless, negotiated snapshot deltas, staggered keyframes, cached TDM spawn candidates and motor collision views, allocation-free TDM room distance checks, reusable client snapshot lookups, and opt-in lag diagnostics. No git commands, push, server deployment, or worker deployment were performed.

The evidence supports avoidable bandwidth and allocation pressure, including respawn spikes. It does **not** establish the cause of the reported intermittent lag on a real connection. No browser, WebGL/FPS capture, real network, deployed Worker CPU measurement, or account CPU-limit inspection was available. The client frame numbers below are isolated JavaScript fixtures, not FPS.

Measurements were taken before editing production paths. `before.json`, `before-client.json`, and the original allocation-test log retain that first baseline. For the final comparison, three quiet alternating before/after runs used the same seeded workload and captured baseline sources in `fixtures/`. `summary.json` reports the median of the three per-run means/percentiles. Shared-sandbox scheduling still affects tails; the exploratory runs that overlapped suite execution are retained but excluded from this summary. The final client fixture installs the page's unchanged Math.hypot shim on both sides.

The server fixture runs actual simulation, bots, motor, fog, worker flow control, snapshots, and round-state serialization: 700 ticks per mode, five human recipients and five bots, discarding 100 warm-up ticks. It includes periodic simultaneous respawns and smoke-state bursts. Collision is synthetic flat/open geometry, with 961 navigation nodes; it cannot represent real BVH/physics cost. The spawn microbenchmark separately uses Ascent's actual 11,277 navigation nodes with synthetic collision. Repeated spawn measurements are warm-cache measurements; the cache is initially populated during seating/loading.

| Measurement | Before | After |
| --- | ---: | ---: |
| DM wire bytes/tick, five recipients | 8,051 | 2,911 (−64%) |
| TDM wire bytes/tick, five recipients | 10,705 | 3,164 (−70%) |
| Five wire bytes/tick, five recipients | 11,341 | 1,480 (−87%) |
| Peak wire bytes/tick, DM / TDM / Five | 9,035 / 11,645 / 11,889 | 5,175 / 5,183 / 3,800 |
| TDM spawn mean / p99 | 0.667 / 3.213 ms | 0.0167 / 0.0575 ms |
| TDM spawn allocation | 568,630 B/call | 21,842 B/call (−96%) |
| Spawn capsule queries across 200 warm calls | 23,000 | 0 |
| TDM room-block check allocation | 192.14 B/call | 0.12 B/call |
| TDM motor allocation / CPU | 1,113 B / 1.53 µs | 950 B / 1.13 µs |
| Client pose-fixture allocation per scripted frame | 2,782 B | 2,585 B (−7%) |
| Client snapshot mean / p99 CPU | 0.154 / 0.357 ms | 0.174 / 0.314 ms |

The wire savings have a CPU cost. Whole-tick means and p99s do not improve uniformly:

| Mode | Mean ms before → after | p99 ms before → after |
| --- | ---: | ---: |
| DM | 1.107 → 1.040 | 6.398 → 3.713 |
| TDM | 1.568 → 1.638 | 4.599 → 5.870 |
| Five | 0.449 → 0.464 | 2.412 → 1.641 |

All measured fixture ticks stayed below the 50 ms interval, with zero worker faults. That does not establish headroom on real collision worlds or hosted infrastructure. Client snapshot mean CPU also increased slightly despite lower allocation and a lower measured p99. There is no demonstrated general FPS improvement.

A separate parse/decode/validation benchmark includes the cost of the new client decoder, rather than hiding it inside the pose result. DM goes from 4,712 to 6,317 B/message and 23 to 37 µs; TDM from 5,820 to 6,475 B and 50 to 62 µs; Five from 6,097 to 6,377 B and 63 to 66 µs (`wire-bench.json`). This retains independent presentation rows and mutable round-state objects so handlers cannot corrupt delta baselines. An initial decoder allocated 7.7–8.9 KB/message; a measured follow-up removed redundant private row copies, with atomic patch validation before applying edits. The bandwidth improvement is being accepted with this small remaining decode cost, not presented as an unconditional client CPU/GC win.

The capacity-limited network model (`network-model.json`) replays the same recorded TDM frames through an eight-frame window, 40 ms each way, ACK on a 60 Hz input, and a 300 ms service pause. At 32 KiB/s, modeled median snapshot age falls from 434 to 58 ms, p95 from 717 to 80 ms, and coalesced ticks from 45 to 2 out of 200. This is a FIFO serialization/backpressure model, **not an Internet/TCP measurement**: it omits congestion control, retransmission, routing, and real RTT variance. It shows why the measured full-state bandwidth can create stale state on a constrained link; it does not prove the user's link has that constraint.

The existing interpolation already handled jitter/stalls well. A dependency-free replay of the existing remote-interpolation suite passes unchanged before and after: 50–150 ms simulated jitter produces 4.86–5.94 m/s render speed around a 5.4 m/s run. A simulated 150 ms jitter plus 5% loss case has 47 frozen frames and 277 ms median delay; the extrapolation limit still prevents a catch-up jump. Existing reconciliation/smoothing tests pass. Interpolation delay, extrapolation limits, prediction correction thresholds, the 60 Hz input rate, 20 Hz simulation/snapshot rate, and the 350 ms rewind cap were preserved.

The production changes are limited to these paths:

- `server/src/snapshot-codec.js`: compares serialized wire values and primitive unit fields after each viewer's fog filter, so it never caches aliases into live effects/abilities. Only `hi.delta=1` clients using the existing ACK protocol receive deltas. Full frames remain the fallback for first sends, roster/order changes, larger deltas, periodic keyframes, and resync. Keyframes are offset per seat to avoid synchronized fanout peaks. Events are never inherited from a baseline, and the existing pending-event cap/backpressure policy remains in force. A baseline commits only after a successful send.
- `server/src/worker.js` and `work/server_runtime.js` / `index.html`: negotiate and reconstruct deltas, reset on start/reconnect, reject bad bases/patches without partial application, and request bounded resync. Resync releases the existing ACK window so a rejected frame cannot prevent the full recovery frame. Old clients/workers retain full-state support. The existing validator still processes reconstructed frames.
- `server/src/tdm.js`: caches static base-map candidates while recalculating occupancy and consuming the same RNG draw each spawn. Replaced geometry/collision/anchors invalidate the cache; `baseWorld.dynamic` bypasses it. Per-unit collision views use a WeakMap and read current room/blocker state; exception restoration of `this.world` is retained.
- `server/src/tdmrooms.js`: uses the existing bit-identical numeric `hyp2` helper and a numeric team loop instead of allocating an array per query. No new approximate distance formula or gameplay threshold was introduced.
- `index.html`: reuses the snapshot seen-set and unit lookup map; roster identity/id changes and departed units update the map. Shot-event lookup uses that map. No animation logic was changed.
- `server/src/lag-metrics.js` and `work/lag_diagnostics.js`: opt-in, bounded diagnostics described below.

There are no intended gameplay, balance, or animation changes. The behavior-preserving implementation changes worth review are the longer lifetime of static spawn candidates/collision wrappers and the negotiated wire format/recovery path. Spawn occupancy/RNG parity, exact paired motor state, fog transitions, retained events, roster changes, baseline resets, failed sends, and malformed-patch atomicity have focused regressions. `ENABLE_SPIKE`, Skirmish geometry, movement animations, `work/validation/*.md`, and `qa/buglanes/*` were not edited. The hash audit checks 393 protected files and reports no changes (`protected-verification.json`).

Validation is recorded per suite, including failures:

- New dependency-free checks: all six pass with `node qa/lagopt/check.mjs`. They cover 3,000 exact codec reconstructions, 3,000 final decoded worker frames exactly matching the original full-state output, 1,000 spawn selections, 10,000 room-query parity cases, 3,000 exact motor steps, 300 client roster/event sequences, diagnostics lifecycle/bounds, and simulated jitter/loss. Trace parity includes all unit fields, clocks, fog, events, scores, and private round state in the recorded scenario.
- Release gate: passes after the changes. Spike/local-origin production gating remains intact.
- Broad existing suites: 164/341 pass (`all-test-results.json`, `all-tests/`). 177 cannot complete: 173 stop on missing `three` (including missing `three.cjs`), two on missing generated Ascent world assets, one on missing `esbuild`, and one on missing optional `sharp`. Several network suites pass their in-process assertions before reaching the missing real-world dependency.
- Final existing focused run: 18/31 pass (`test-results.json`, `tests/`). Twelve stop on unavailable dependencies; the unchanged Math.hypot allocation-threshold test also fails. That test failed on the original tree, passed during the broad run, and failed again in the final run. Its four million numeric comparisons pass; the allocation ratio fluctuates around its strict one-third bound under Node 24 (native roughly 48 B/call, patched roughly 16 B/call). The threshold was not weakened. A rest-argument experiment did not improve the shim and was not shipped.
- Dependency probes confirm absent `three`, `three-mesh-bvh`, `esbuild`, `ws`, and `sharp`. There is no node_modules installation. The supplied environment constraint says npm installation fails with EPERM; no installation or network workaround was attempted. Full collision-world, bundle, real-rig/renderer, model/texture loading, and browser online suites therefore remain blocked.

For later measurement, browser DevTools can run `VSLag.start()`, reproduce a slow interval, then save `VSLag.report()` and call `VSLag.stop()`. It records at most 600 recent samples per series plus lifetime count/mean/max: frame CPU and frame gaps, simulation, HUD, snapshot apply, interpolation, parse/decode/clean, effect/smoke synchronization, render submission, incoming-message sizes/gaps, uplink buffered bytes, RTT, interpolation delay, jitter, snapshot age, and Long Tasks where supported. Render submission is not GPU time; asset-request CPU is not download/decode completion. Starting/stopping restores the original functions and leaves no running timer or upload. It is off by default and has no telemetry endpoint.

For a local server with diagnostics enabled through `LAG_DIAGNOSTICS=true`, inspect the GameRoom instance's `room.lag.report()`. It records simulation, snapshot-build, fanout and total tick times, bot/motor/fire/round-state/spawn costs, timer lateness, catch-up steps, exact UTF-8 bytes, and message counts. Samples are bounded to 600 per series; sorting happens only when requesting a report. These are elapsed-time probes, not hosted CPU-quota measurements. No production configuration was changed to enable them.

The remaining verification should use real two-client sessions with cold/warm caches on native maps: capture browser p95/p99/max frame times and GPU/load hitches, heap/GC activity during joins/casts/deaths/round transitions, input-to-ACK age, RTT/jitter, bufferedAmount, reconciliation corrections, and server tick tails together. Include constrained bandwidth and loss, foreground/background resume, and hosted Worker CPU/throttling observations. Model/texture decode/upload and actual BVH/bot/collision spikes remain unmeasured; existing preload behavior was inspected/tested where possible but not redesigned without evidence.

Reproduction commands from the repository root (all local; no deployment):

```sh
node qa/lagopt/check.mjs
node --max-semi-space-size=64 qa/lagopt/bench.mjs review-before --baseline
node --max-semi-space-size=64 qa/lagopt/bench.mjs review-after
node --max-semi-space-size=64 qa/lagopt/client-bench.cjs review-before --baseline
node --max-semi-space-size=64 qa/lagopt/client-bench.cjs review-after
node --max-semi-space-size=64 qa/lagopt/microbench.mjs review-after
node --max-semi-space-size=64 qa/lagopt/bench-wire.mjs
node qa/lagopt/bench-network.mjs
python3 qa/lagopt/run-suites.py
python3 qa/lagopt/run-suites.py --all
```

`--baseline` builds an isolated temporary source copy using the saved pre-change files; it never replaces the working tree. `--capture` optionally saves compressed frame traces and their starting baselines. The checked-in before/final traces allow the focused suite to run without dependencies or re-running the benchmarks. The main agent should verify this finished tree and decide on push/deployment.
