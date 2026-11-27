# 2026-11-27 perf-noop: NOOP-GL A/B rerun with the multi_draw stub (harness d405efb4)

QA-README s7 protocol. NOOP-GL frame-time A/B on Ascent, medium preset. One session, run in the order base1, lane1, base2, lane2. One attempt each, all RC 0, no errors.

- **Base:** e2c14eda (main).
- **Lane:** 13005d5e product content, which includes the WIP6 multi_draw map strip.
- **Harness:** `handoff/qa/cpu/lane.cjs` @ d405efb4, byte-identical. The NOOP stub also wraps `getExtension` so that `multiDraw*` on WEBGL_multi_draw are no-ops.

## Validity: did the multi_draw stub take effect?
On its own, no. It only took effect after one added diagnostic call.

- **Lane, `md_check_pre` (after noop, before the diag):** three's cached WEBGL_multi_draw (`renderer.extensions.get`) still had the native methods: `function multiDrawElementsWEBGL() { [native code] }`. The reason is that three fetched and cached the object at init, before noop. Nothing calls `gl.getExtension` again afterwards, so the wrap never fires.
- **DIAGNOSTIC ADDED:** `diag/md_attach.js` runs right after noop. It calls `renderer.getContext().getExtension('WEBGL_multi_draw')`, which returns the same cached object (`sameAsThreeCache:true`). That fires the wrap and patches the object.
- **Lane, `md_check_post` and `md_check_end` (after the 3 measurements):** `cached_mDE` and `cached_mDA` are `function(){}`, so the stub held for the whole measurement in lane1 and lane2.
- **Base:** `md_check_pre` already shows the stub as attached. This is inferred, not proven: base has no multi_draw use, so three likely had nothing cached, and the probe's own `extensions.get` cache miss called `gl.getExtension` after noop and fired the wrap. This does not matter for the timings, because base issues no multi-draw calls either way.
- **Steps used, identical on both sides:** `noop, js:md_check_pre, js:md_attach, js:md_check_post, warm, meas, js:md_check_end`.
- **R.noop:** 44 on every run (43 GL methods plus the getExtension wrap). The wrap's later patch count is not reflected in R.noop.
- **Side finding:** the earlier `2026-11-27-pin/perf/diag_mdnoop` run (lane_mdnoop.cjs) patched `window.WebGLMultiDraw.prototype`. That constructor is not exposed as a global here (`proto_mDE:"noWebGLMultiDraw"`), and R.noop was 43 with no +1000. So that diag stubbed nothing, and its lane 69 ms result was still contaminated.

## Result (ms per frame, mean of 3 x 10 s)
| run | ftMean | ftMean min/max, sd | loop | umw | render:main | RC | md stub during meas |
|---|---|---|---|---|---|---|---|
| base1 | 22.290 | 18.59 / 25.57, 3.509 | 12.788 | 1.683 | 8.358 | 0 | yes (pre already) |
| lane1 | 22.970 | 21.79 / 24.43, 1.342 | 12.252 | 1.592 | 7.539 | 0 | yes (after diag) |
| base2 | 25.213 | 20.15 / 28.06, 4.396 | 14.469 | 1.462 | 8.214 | 0 | yes (pre already) |
| lane2 | 19.790 | 18.97 / 21.03, 1.092 | 12.481 | 1.430 | 7.463 | 0 | yes (after diag) |

| side | ftMean | loop | umw | render:main |
|---|---|---|---|---|
| base | 23.752 | 13.628 | 1.573 | 8.286 |
| lane | 21.380 | 12.367 | 1.511 | 7.501 |
| lane minus base | -2.372 (-10.0%) | -1.262 (-9.3%) | -0.062 (-3.9%) | -0.785 (-9.5%) |

## Verdict
**PASS** under s7. With multi_draw confirmed stubbed, lane ftMean (19.8 to 23.0) sits in or below the base band (22.3 to 25.2), and lane loop is not above base.

The pin run's lane slowdown of about 2x (42 ms) came from the harness. The un-stubbed multi_draw map strip was still rasterising in SwiftShader on the lane only. It was not a CPU regression in the product.

Note: `lane.cjs` @ d405efb4 is still incomplete on its own. It needs a `getExtension` call after noop, as in `diag/md_attach.js`, or the stub must be installed before renderer init.

## Files
- `perf_{base1,lane1,base2,lane2}.json`: raw R. The `js` key holds the probe and attach outputs.
- `perf_{base1,lane1,base2,lane2}.json.log` and `.a0.stdout`: run logs.
- `perf_table.txt`: the results table.
- `gates.txt`: the tested SHAs, the harness SHA, the config and the exact commands.
- `diag/`: md_attach.js and md_check_{pre,post,end}.js (probes), drive_perf6.sh (driver) and perf_table6.py (table builder).
