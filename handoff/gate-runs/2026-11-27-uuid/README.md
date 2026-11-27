# Gate run 2026-11-27-uuid: UUID determinism (UU=1) on lane c6ed1efc vs main e2c14eda

All runs: one session, UU=1 (Jeff's __uu patch on every three.min.js served: lane vendor r170 `Et`, base CDN r149 `bt`, each
serve logged + asserted, see harness/*.json "uu" and *.log "UU serve"), bind low 960x540 VW=1. LANE worktree held at c6ed1efc
for every lane run (origin moved to d1a9c5fb mid-session; untested here).

## Match gate (cmp outputs verbatim in match/cmp-*.txt; calls/tris in match/calls_tris.txt)
- Noise floor base vs base (mbaseU1 vs mbaseU2): vandal_a0..a7 + vandal_vm 0 px differ (SSIM 1.0); abil_a0..a2 86k-154k px, min SSIM 0.991433.
- Lane vs base: every vandal shot 24.75k px, max delta 1 (all in the FP viewmodel box x565-940 y302-539; lane +0.55..0.61 LSB mean), SSIM 0.999927; calls/tris identical.
  abil SSIM vs base 0.99146-0.997 (inside the base noise band) BUT calls are 10 lower on all 3 ability shots (252/250/256 vs 262/259/266; tris -1200).
- Lane vs lane: vandal 0-830 px (max delta 134), not bit-exact like base; abil same band as base noise.
- The earlier ~25k-px vandal deltas are therefore NOT UUID stream noise: they persist with UU and are a +1 LSB viewmodel shading difference.

## Step 4 (run because vandal SSIM < 1.0 floor and abil calls differ): mlaneNoAO
Scratch worktree (c6ed1efc, gltf-ao-channel + gltf-ao-uvcopy removed, vendor/three rebuilt; only GLTFLoader.js changes; an unpatched rebuild was byte-identical first). Diff: noao/noao_scratch.diff. Never committed.
- NoAO vs base is worse (vandal up to 73.8k px, max delta 247, min SSIM 0.971847) -> the AO patches move the lane TOWARD base; they are not the cause of the residual 1-LSB delta.
- NoAO drops 1 call on 7 vandal shots (e.g. 196 vs 197, tris -1646) and still has the same -10 ability calls (251/249/255) -> the ability call delta is independent of the AO patches.

## bot_feel_offline under UU (botfeel/)
Hook uu_hook.cjs (NODE_OPTIONS --require; wraps fs.readFileSync for three.min.js; no product edits).
- LANE c6ed1efc: loaded vendor/three/three.min.js r170, patch matched (fn Et). EXIT 0, all checks pass ("bots feel like players (reload, corner holds) ok"); live reload backing-away 41.2 %.
- EXTRA, main e2c14eda: loaded /workspace/work/qa/three.min.js r149 (main's page_harness default REAL3_DIR), patch matched (fn bt); r160 cjs path not used, so the 0xffffffff variant in the hook was not exercised. EXIT 0 with output identical line-for-line to the lane.
- Verdict: the earlier lane failure ('a mate TRADE.range-2 m ... null') and base failure (23.5 % >= 30 %) were both Math.random stream divergence from generateUUID; under UU both trees pass identically. Not a lane regression.
