# Valorstrike perf work — handoff (2026-11-26 ~21:00 EST)

Branch: `handoff-three-r170` (this branch). It does NOT deploy:
- Vercel's production branch is `main`. Other branches are already "Canceled by Ignored Build Step" (seen on the `instinct` and `dm-rig-leak` branches).
- As a second guard, this branch's `vercel.json` adds `git.deploymentEnabled: {"handoff-*": false}`. This only affects `handoff-*` branches, so it's harmless if merged.
- GitHub Actions `ci.yml` runs only on push/PR to `main`. `visual.yml` runs only on `instinct`.

## Live right now
- Site: https://valorstrike.vercel.app, served from `main` @ **e2c14eda**. Vercel status: "Deployment has completed" at 2026-11-26 00:04 EST.
- Game server: Cloudflare Worker `valorstrike-game` version `6f935a27-9f2a-44dd-b8dd-a69e98ced136` (rollback `4f14af3e-0792-476b-a58c-e902d1ec3805`). `/health` returns ok. It's deployed manually with wrangler; there is no git integration.

## Done, verified, live (on main)
| Commit | What | Verification |
|---|---|---|
| 51de05fe | Bot lag: ragdoll setup, route bans, nav arrays | Full suite |
| 6f1506c4 | CPU: scene-graph matrix skips, deferred Skeleton.update. Dynamic resolution OFF by default (opt-in `vs.gov=1`) | Ascent medium frame time 30.68→25.31 ms; 0 px diff on Ascent medium and Bind low (4 poses); 33 node + 14 browser tests; known-failure set unchanged |
| 1d4fe712 | Content-hashed `?v=` on every static asset, immutable cache | Worlds bit-exact |
| f90bf142 | Packed lossless map geometry | 0 px diff; brotli 390→234 MB across all maps; worker 6f935a27 |
| e2c14eda | Bot pathfinding in a Web Worker (off on iOS, touch, ≤2 GB; `vs.pw=1` forces it on) | Path p99 3.98→1.19 / 8.2→3.3 ms; routes bit-identical; 0 px |

Dropped, with notes in each lane's `PROGRESS.md`: KTX2, map re-chunk/PVS/lightmaps, bone/hitbox trims, death keep-warm (patch and test in `handoff/qa/death/`).

## In progress: three.js r149 → r170 (NOT shippable yet)
Commits on this branch, on top of e2c14eda:
- `843f1df9`: r170 vendored into `vendor/three/` (builder `work/three/build.cjs`); r149 behaviour patches in `work/three/patches.cjs`; shims in `work/three/compat.js`.
- `bbdd4790`: strip trailing blanks from GLSL.
- `3edb3714`: tests/harnesses load the repo's `vendor/three`; `test_loader_retry` and `test_crash_report` adapted.
- `acaa571b`: Box3 and skinned/instanced raycast patches (Gekko scale fix); rebuilt `three.min.js`. **Not re-measured.**
- Final commit: this handoff (the docs, the `vercel.json` guard, and `handoff/qa/` harness copies).

Verified:
- Ascent medium, 26 map-only views: 0 px, SSIM 1.0, identical draws and tris.
- 8 targeted tests pass (loader_retry, map_load_memory, crash_report, map_prefetch, asset_versions, renderer_rebind, render_quality, frame_governor).

The 216 vs 192 draw calls (the "24 extra draws"): **resolved, not caused by the upgrade.**
- It was a harness artifact: a stale second Vandal viewmodel rig left by a queued warm-up draw.
- Base r149 also showed it.
- After the harness fixes, base and lane draw counts match in every Vandal view.

Agent/viewmodel/HUD pixel checks: **failing, open.**
- The harness is now deterministic: base vs base 103 px, SSIM ≥0.99994.
- Lane vs base on Bind low Vandal views: SSIM 0.983–0.9996. The bar is 0.995.
- Cause 1, Gekko model scale (0.909 base vs 0.930 lane), comes from r170's precise skinned Box3. It's patched in acaa571b and needs re-measuring.
- Cause 2: viewmodel grip/magazine area, up to 74/255 over ~800 px.
  - The material dump (`handoff/qa/three/shots/*vfmat*`) shows the same textures and sizes.
  - Lead: on the lane the aoMap etc. have `channel 0`, and the geometry carries `uv1` + `uv2`. r149 always sampled `aoMap` from `uv2`. If the game's `uv2` ≠ `uv`, AO differs.
  - Fix idea: set `tex.channel` so aoMap/lightMap sample uv2 the way r149 did, or patch GLTFLoader.
- Ability views: 247 vs 257 calls, SSIM 0.991–0.995. Not investigated.
- `index.html`'s `?v=` hash for three.min.js is stale. Rerun `work/install_valorant.py` twice and check the output is byte-identical.

## Draw batching: not started
Plan:
- A small three patch so one mesh draws several index ranges via `WEBGL_multi_draw`, with a loop fallback.
- `nmRuns` issues one call per map strip instead of one per range.
- Same order and contiguous ranges, so pixels should be identical.
- Needs: a pixel check, an updated `test_map_strips`, and a NOOP-GL A/B (`qa/cpu/run.sh`, `ab.cjs`).

## Left after that
1. Re-measure Gekko; fix the viewmodel AO/UV channel; investigate abilities. Then check HUD, the menu/skin-preview renderers, Bind low plus 2 more maps, and re-confirm Ascent medium.
2. Targeted tests; the 15-test known-failure set vs main (`qa/cpu/known_base`); iOS memory; a NOOP-GL perf A/B (the upgrade must not be slower).
3. Gates:
   - `install_valorant.py` run twice, byte-identical
   - `git diff --check`
   - `server/src/motor.cjs` == `vendor/valorant-feel.js`
   - `qa/gpu/inline_parse.cjs`
4. Squash, rebase, fast-forward push to main. Then batching.
5. Other backlog: bot brain beyond pathing, bot ragdoll cold path, and the missing Valorant sound cues.

## QA gates
Exact harness files and commands: `handoff/QA-README.md` (originals in `handoff/qa/`).

## Where things live
- Repo: github.com/B-Eddie/valorstrike. Local clone `/workspace/work/valorstrike`, lane worktree `/workspace/work/vs-lane-three`.
- Notes: `handoff/qa/three/PROGRESS.md` (copied from `/workspace/work/qa/three/`). Full screenshots (3.7 GB) are only on the work box.
- Local-only branches, NOT pushed: `lane-three` (3edb3714), `lane-death` (b2d8083d, dropped), `lane-bots2` (bece962f, dropped), and lane-cpu/assets/pathw (already in main).
