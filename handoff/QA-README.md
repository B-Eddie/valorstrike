# QA gates: original harness files and exact commands

Everything under `handoff/qa/` is a **byte-for-byte copy** of `/workspace/work/qa/...` from the work box as of 2026-11-26 ~23:00 EST. Nothing was rewritten. The scripts hard-code `/workspace/work/...` paths, so the setup below recreates that layout with symlinks rather than editing the files.

## 0. Environment (what the numbers were produced on)
| Item | Work box |
|---|---|
| CPU / RAM | aarch64, 2 cores, ~7.8 GB, no GPU (SwiftShader software GL) |
| Node / Python | node v22.23.5; Python 3.12.16, venv `/workspace/work/venv` with numpy 2.5.4, scipy 1.18.1, Pillow 13.0.0 |
| Browser | Playwright **1.49.1** (`/workspace/work/pw/node_modules/playwright`), `chromium_headless_shell-1148` = Chromium 131.0.6778.33, launched with `--use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader --in-process-gpu` |
| Browser libs | `/workspace/work/pw/libs` (extracted .so files; this sandbox has no root). On a normal box use `npx playwright@1.49.1 install-deps chromium` instead |
| sharp (px2.cjs only) | 0.35.5, loaded from `/workspace/work/vs-lane-cpu/server/node_modules/sharp` |
| esbuild (three build) | 0.28.2 from `<worktree>/server/node_modules` |

**Not transferable.** The browser runtime `/workspace/work/pw` (1.2 GB, machine-specific ARM64 libs) and the 325 MB of raw `.rgba` shots from earlier runs. Install the pinned versions above. SwiftShader output can differ by CPU architecture, so compare base vs lane on the **same machine in the same session** and re-measure the base-vs-base noise floor yourself. On this box it was 103 px total, SSIM ≥ 0.99994, for the Bind match scenes, and 0 px for map-only views.

## 1. Setup (recreates the work-box layout)
```bash
REPO=/path/to/valorstrike                # clone, checked out at handoff-three-r170
sudo mkdir -p /workspace/work && sudo chown $USER /workspace/work
ln -s $REPO/handoff/qa /workspace/work/qa              # every script's /workspace/work/qa/...
mkdir -p /workspace/work/pw && (cd /workspace/work/pw && npm i playwright@1.49.1 && PLAYWRIGHT_BROWSERS_PATH=/workspace/work/pw/browsers npx playwright install chromium-headless-shell)
mkdir -p /workspace/work/pw/libs                       # empty is fine if install-deps was run
python3 -m venv /workspace/work/venv && /workspace/work/venv/bin/pip install numpy scipy pillow
# worktrees the scripts default to
git -C $REPO worktree add /workspace/work/vs-lane-three handoff-three-r170     # LANE (h.cjs default ROOT)
git -C $REPO worktree add /workspace/work/qa/three/base_wt e2c14eda          # BASE for pixel gates (runpair/runmatch)
git -C $REPO worktree add /workspace/work/qa/cpu/base_wt   e2c14eda          # BASE for known set
(cd /workspace/work/vs-lane-three/server && npm ci); (cd /workspace/work/qa/three/base_wt/server && npm ci)
ln -s /workspace/work/vs-lane-three /workspace/work/vs-lane-cpu                # px2.cjs loads sharp from vs-lane-cpu/server/node_modules
export LD_LIBRARY_PATH=/workspace/work/pw/libs PLAYWRIGHT_BROWSERS_PATH=/workspace/work/pw/browsers
```
- `handoff/qa/three.min.js`, `GLTFLoader.js`, `SkeletonUtils.js` are the **r149 / r147 CDN files** that main (e2c14eda) loads from unpkg/jsdelivr. The harnesses route those CDN URLs to these local copies, so BASE runs offline. sha256 of three.min.js: `8a5f7249…5a2271`.
- One Chromium at a time. Every harness takes `/workspace/work/qa/LOCK-chromium.txt`; empty it if a crashed run left a dead pid.
- Map assets: the base worktree must have the map packs. They're tracked in git, so a normal checkout works.

## 2. Static gates (run in the LANE worktree; ~1–2 min total)
```bash
cd /workspace/work/vs-lane-three
python3 work/install_valorant.py && cp index.html /tmp/i1.html && python3 work/install_valorant.py && cmp /tmp/i1.html index.html && echo REGEN_IDENTICAL
git diff --check && echo DIFF_CHECK_OK
cmp server/src/motor.cjs vendor/valorant-feel.js && echo MOTOR_EQ_VENDOR
node /workspace/work/qa/gpu/inline_parse.cjs index.html     # pass: "inline scripts N parse failures 0", exit 0
```
- **Pass:** all four lines print and every exit code is 0.
- `install_valorant.py` rewrites `index.html`. On the checkpoint the committed index.html has a stale `?v=` hash for three.min.js, so the first regen produces a diff. That's expected; commit the regenerated file before shipping.

## 3. Known-failure set (15 tests)
```bash
# base (already done; result committed as qa/cpu/known_base: produced on origin/main b016b657 on 2026-11-23)
/workspace/work/qa/cpu/known.sh /workspace/work/qa/cpu/base_wt /workspace/work/qa/cpu/known_base
# lane
/workspace/work/qa/cpu/known.sh /workspace/work/vs-lane-three /workspace/work/qa/assets/known_lane
/workspace/work/qa/assets/known_cmp.sh            # compares known_base vs qa/assets/known_lane
```
- **Runtime:** ~33 min per side on the box (the slowest tests: bot_feel_offline 616 s, ability_first_cast_warm 740 s, bot_ults_offline 208 s).
- `known.sh` is resumable: it skips tests already listed in `res.txt`. Delete the out dir to rerun.
- **Pass:** every line prints `SAME`. That means the same first failure line as base, with numbers in ms stripped. Any `DIFF` is a new or changed failure and blocks the push. All 15 are expected to fail (`rc=1`) on both sides.
- These tests run under node with `page_harness.cjs`, using the page's own `vendor/three`. Base has no vendor/three, so `test_map_prefetch` needs `REAL3_DIR=/workspace/work/qa`, which holds the r149 files.

## 4. Targeted tests
```bash
/workspace/work/qa/three/tgt/run.sh /workspace/work/vs-lane-three /workspace/work/qa/three/tgt/out \
  test_loader_retry test_map_load_memory test_crash_report test_map_prefetch test_asset_versions test_renderer_rebind test_render_quality test_frame_governor
```
- **Pass:** every `res.txt` line reads `rc=0`.
- **Runtime:** ~5–15 min. Each test has a 1200 s cap (`TTMO`).

## 5. Pixel gate A: map-only, 26 fixed views per map
- View files: `qa/map/views/{ascent,bind,breeze,haven,lotus,split}.json`, 26 views each (camera `p`, `yaw`, `pitch`). These are the exact files used.
- `h.cjs` MODE=map loads the map through the runtime's own `nmEnsure` in the lobby. It hides every non-map object, stops the loop and renders each view.
- Seed: `Math.random` is replaced by an LCG with seed 12345 in an init script.
- Output: raw RGBA via `readPixels`, at 1280×720 unless W/H are set.
```bash
cd /workspace/work/qa/three
./runpair.sh ascent medium 1      # writes shots/ascent-medium-base1-v*.rgba, then lane1 (ROOTs are hard-coded in runpair.sh)
./runpair.sh bind low 1; ./runpair.sh lotus low 1
/workspace/work/venv/bin/python cmp.py ascent medium base1 lane1     # same for bind/lotus
```
- **Runtime:** ~1.8 min per side for Ascent medium (base 106 s, lane 98 s on the box), so ~4 min per map pair.
- **Pass:** `total px differ 0` and `min SSIM 1.0`, with `calls`/`tris` per view equal in the two JSONs. The checkpoint's earlier result on Ascent medium was exactly that.
- `cmp.py` writes diff heatmaps (×8 amplified, red) to `shots/heat/` for any view that differs.

## 6. Pixel gate B: match mode (agents, viewmodel, abilities, HUD)
`runmatch.sh MAP GQ W H TAG ROOT [WEAP]` runs `h.cjs` MODE=match with `agents.cjs`. Everything is fixed:
- Agent roster: mates Sova, Chamber, Tejo, Miks; enemies KAY/O, Reyna, Yoru, Gekko, Brimstone.
- Skins: Vandal Prime and BlastX knife, given in `PRE`.
- `Math.random` seeds: 12345 at init, **777** in PRE, **4242** before the abilities.
- Lineup ground = spawn eye − 1.6. Viewmodel idle with no crossfade. Pending warm draws dropped.
- Views are computed in `js/agents_setup.js`, not read from a file: 8 lineup views, 1 viewmodel-only view, 3 ability views and a HUD page screenshot.
```bash
cd /workspace/work/qa/three
VW=1 ./runmatch.sh bind low 960 540 mbase /workspace/work/qa/three/base_wt
VW=1 ./runmatch.sh bind low 960 540 mbase2 /workspace/work/qa/three/base_wt     # noise floor
VW=1 ./runmatch.sh bind low 960 540 mlane /workspace/work/vs-lane-three
/workspace/work/venv/bin/python cmp.py bind low mbase mbase2     # noise floor
/workspace/work/venv/bin/python cmp.py bind low mbase mlane
```
- Optional env:
  - `WEAP=knife|classic` as the 7th argument.
  - `DRAWLIST=1|only`: per-object draw list.
  - `BONES=1|only`: bone world positions.
  - `VFMAT=1`: viewmodel material and texture dump.
- **Runtime:** ~3 min per run (157–182 s on the box). About 1 in 3 runs was OOM-killed at the first shot on 7.8 GB, so rerun those.
- **Pass:** per shot SSIM ≥ 0.995, `calls` equal, heatmaps showing no visible structure, and the lane-vs-base result inside the base-vs-base noise floor.
- The HUD is a compositor PNG (`shots/<map>-<gq>-<tag>-hud.png`) compared by eye or by image diff.
- **Menu renderers** (skin preview and agent-select viewer): `MODE=map STEPS=node:/workspace/work/qa/three/menu.cjs`. This has never been run.

## 7. Perf A/B (NOOP GL)
`cpu/lane.cjs` boots a real offline 5v5 (Jett, map MAP, preset GQ). The `noop` step replaces WebGL draw and state calls with no-ops, so the timing measures CPU work only. `meas` reports the mean frame time and per-function ms per frame (loop, xSimRun, render:main, umw, …).
```bash
# base vs lane (the upgrade gate): run each ROOT, then compare R.meas
TMO=1500 ROOT=/workspace/work/qa/three/base_wt MAP=ascent GQ=medium STEPS=noop,warm,meas MEAS_S=10 MEAS_N=3 HARN=/workspace/work/qa/cpu/lane.cjs /workspace/work/qa/cpu/run.sh /tmp/perf_base.json
TMO=1500 ROOT=/workspace/work/vs-lane-three    MAP=ascent GQ=medium STEPS=noop,warm,meas MEAS_S=10 MEAS_N=3 HARN=/workspace/work/qa/cpu/lane.cjs /workspace/work/qa/cpu/run.sh /tmp/perf_lane.json
# in-build flag A/B (how the CPU lane 6f1506c4 was measured: rotates XSGR flags in one page load)
ROOT=/workspace/work/vs-lane-three STEPS=noop,warm,node:/workspace/work/qa/cpu/ab.cjs AB_CFG=base:000,on:111 AB_REPS=4 AB_S=5 /workspace/work/qa/cpu/run.sh /tmp/ab.json
```
- **Runtime:** ~3–4 min per run (194 s for the AB run on the box).
- **Pass:** the lane's `ftMean` and `loop` are not higher than base beyond run-to-run spread. Alternate base, lane, base, lane at least twice, because the box drifts.
- For reference, the CPU lane AB on 2026-11-23 gave base ft 30.68 ms vs on 25.31 ms.
- `run.sh` prints `RC <exit code>`. The harness itself always exits 0 and writes `R.fail` on error.

## 8. Push gate (main only, after all of the above)
`git fetch && git rebase origin/main`, then `git push origin HEAD:main`, fast-forward only. Do not do this from this handoff branch without squashing out `handoff/` and the `vercel.json` guard.
