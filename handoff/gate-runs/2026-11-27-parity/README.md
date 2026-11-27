# Gate run 2026-11-27-parity: lane 13005d5e (WIP7 Color.getHex trunc + WIP8 ShaderMaterial two-pass) vs main e2c14eda, UU=1

Setup as 2026-11-27-uuid: harness h.cjs with UU=1 (Jeff's __uu generateUUID patch; every served three.min.js patched and asserted,
harness JSON "uu"), bind low 960x540, VW=1, one Chromium at a time. Runs: mbaseP1 (base, new), mbaseU1 (base, reused from the uuid
run; base unchanged), mlaneP1 + mlaneP2 (lane). All attempt 0, 12 shots + HUD each, 0 OOM-kill lines. Note the lane tip also
carries WIP6 (d38aa2d9 + d1a9c5fb: one WEBGL_multi_draw call per map strip), which lands between c6ed1efc and 13005d5e.

## Vendor rebuild check
build.cjs + patches.cjs + compat.js of 13005d5e run in a scratch copy (THREE_SRC = three-0.170.0.tgz unpacked):
three.min.js, GLTFLoader.js and SkeletonUtils.js are byte-identical to the committed vendor/three (vendor/).

## Match gate (cmp outputs verbatim in match/cmp-*.txt; calls/tris table in match/calls_tris.txt; diff boxes in match/diff_bbox.txt)
- Base vs base noise (mbaseU1 vs mbaseP1): NOT 0 this time. vandal 0-47,771 px (min SSIM 0.975926); abil 104.8k-162.3k px
  (min SSIM 0.986569). mbaseP1 is missing one 1-call / 1646-tri object on 10 of 12 shots, and on vandal_a7 also shows the
  Ghost-for-Vandal loadout swap (-3550 tris).
- Lane vs base: FP viewmodel 1-LSB delta is gone (vandal_vm 0 px in every pair; no diff in the old box x565-940 y302-539).
  mbaseU1 vs mlaneP1 vandal 0-686 px (max delta 134, SSIM >= 0.999949), all in the bot lineup (held guns). Not 0 px.
- abil tris: lane = base exactly (2690003 / 1493476 / 2652618) in both lane runs. abil calls 241 / 227 / 241 vs 262 / 259 / 266.
  The drawlist probe (drawlist/: DL=1 lane run mlaneDL4 vs the uuid-era mbaseDL dump) puts all of it in the map strips:
  native-bind per-run proxies (#0, #1, ...) -> one #multi draw = -21 / -32 / -25 calls, 0 tris; everything else 0 calls / 0 tris.
  The -10 ShaderMaterial FX pass merge is gone.
- Lane vs lane: vandal 0-8,196 px; vandal_a6 +14 calls / +134,344 tris and vandal_a7 +4 / +43,331 in mlaneP2 (0 px on a6).
- No loadout swap on any lane shot vs mbaseU1 (tris equal on all vandal_a0..a5 / vm / abil shots).

## bot_feel_offline (botfeel/)
Lane 13005d5e, UU=1, NODE_OPTIONS=--require handoff/qa/botfeel/uu_hook.cjs: hook matched r170 (fn Et). EXIT 0 in 209 s,
"bots feel like players (reload, corner holds) ok".

## Loadout nondeterminism (loadout_notes.md)
This is a read-only hunch. Nothing was fixed.

## Files
match/ (raw harness JSON + logs per attempt, harness/ copies, cmp, dmesg, runmatch stdout, calls_tris.txt, diff_bbox.txt, png/
base/lane/diff PNGs + HUD, EMPTY_DIFF.txt), botfeel/, vendor/, drawlist/, drive4.sh, gates.txt, loadout_notes.md.
