# Gate run 2026-11-27-pin: match gate (UU=1) with Jeff's harness pin 3065a55c, bot_feel, perf A/B

- Product tested: LANE = 13005d5e content (worktree /workspace/work/vs-lane-three detached at 13005d5e; `git diff --stat 13005d5e 3065a55c` touches only handoff/: gate-runs/2026-11-27-parity/* + handoff/qa/three/{h.cjs,js/agents_setup.js}). BASE = main e2c14eda (qa/three/base_wt).
- Harness: qa/three/h.cjs and js/agents_setup.js replaced by the 3065a55c copies for the match runs (diff vs the parity run = exactly Jeff's pin: `window.xBotSeed=4242;` before xGo(startFive); xgHeldSync + 8x xgPose(xm,1/12) per bot after the lineup). Every other harness file byte-identical to 3065a55c. UU patch kept (h.cjs UU=1 path unchanged). Local copies restored to the 13005d5e versions afterwards.
- Config: bind low 960x540, UU=1, VW=1, WEAP=vandal, PRE as runmatch.sh (Math.random s=777), SETTLE=3. Runs went through tools/runmatchQ.sh = runmatch.sh with STEPS=node:tools/loadout_probe.cjs, a read-only observer that calls the unmodified agents.cjs and logs xBotSeed / xbvSeed() / every bot's bought + held weapon before each shot (property reads with the loop frozen).
- Order: mbaseQ1, mlaneQ1, mbaseQ2, mlaneQ2, then bot_feel (lane), then perf base1, lane1, base2, lane2. One Chromium at a time (lock.cjs / cpu/lock.sh). Every match run complete on attempt 0 (12 shots + HUD, UU matched), 0 OOM-kill lines in dmesg.

## Files
- match/: raw harness JSON+log per run (match/harness/ = final copies from qa/three/shots, match/*.attempt0.* = driver copies), cmp-*.txt (verbatim cmp.py), calls_tris.txt (ref mbaseQ1), calls_tris_vs_parity.txt (ref parity mbaseU1), diff_bbox.txt, loadout.txt, dmesg per attempt.
- match/png/<A>-vs-<B>: base/lane PNGs, diff heatmaps, EMPTY_DIFF.txt for 0-px shots, HUD PNGs, two annotated crops.
- botfeel/: test_bot_feel_offline lane log + uu_hook log.  perf/: QA-README s7 raw JSON/logs/stdout, perf_table.txt, gates.txt; perf/diag_mdnoop/: one extra diagnostic pair (see below).
- tools/: drive5.sh, drive_perf5.sh, runmatchQ.sh, loadout_probe.cjs, calls_tris*.py, bbox.py, mkimg.py, perf_table.py.

## Loadout / seed (match/loadout.txt)
All 4 runs, all 12 shots: window.xBotSeed=4242, xbvSeed()=4242, XBV.seed=0 (the Math.random fallback never ran). Pistol-round buys identical in all 4 runs: Yoru, Sova, Miks bought Ghost; KAY/O, Reyna, Gekko, Brimstone, Chamber, Tejo Classic. After VW=1 + the pin every bot has u.w=Vandal, held model M.w=Vandal, gun meshes GN_AK+RedDot (no Luger/Ghost mesh in any shot of any run).

## Match results (attempt 0 everywhere, 0 OOM)
- mbaseQ2 vs mlaneQ2 vandal: 58/122/549/1012/93/122/0/1466 px (a0..a7), vandal_vm 0 px. Residue = specks on lineup bots' hands/held guns (crop-mbaseQ2-vs-mlaneQ2-vandal_a3.png).
- mlaneQ1 vs mlaneQ2 (and mbaseQ2 vs mlaneQ1, nearly identical numbers): equal calls/tris on all 12 shots, but lineup diffs 2.8k-45k px; vandal_a7 45045 px bbox x422-780 y34-539 = the whole of Sova (row 1 col 2, a Ghost buyer) and its held Vandal shifted (crop-mlaneQ1-vs-mlaneQ2-vandal_a7-Sova.png). So mlaneQ1 has a pose drift on lineup bots that the other three runs do not.
- mbaseQ1: an extra 11-call / 9624-tri object in the first-person viewmodel layer on all 12 shots (vandal_vm 25/36956 vs 14/27332 in the other 3 runs), drawing coincident with the Vandal rig: 24.7k px at maxdiff 1 in the viewmodel box x565-940 y302-539 on every shot (visually identical). vfDrop was empty, so it is not a top-level VF_VIEW.scene child; same signature as the earlier "second Vandal in the viewmodel layer" (+11 calls) noted in agents_setup.js. Base-side, not loadout.
- Pin shift vs the parity run (calls_tris_vs_parity.txt): base and lane move together, -3 calls / +28888 tris on most shots (lineup guns; vandal_vm unchanged). Lane-minus-base calls on abil stay -21/-32/-25 (WIP6 map-strip multi_draw); lane tris = base tris on every shot of the Q2 pair and of mbaseQ2 vs either lane run.

## bot_feel_offline (lane, UU=1, uu_hook): EXIT 0 in 206 s, last line "bots feel like players (reload, corner holds) ok"; uu_hook matched=yes (rev 170, Jeff exact).

## Perf A/B (QA-README s7), see perf/perf_table.txt
All four RC 0, fail None, 3 meas each. Lane ftMean ~2x base (41.4/42.6 ms vs 20.3/22.4 ms), loop +49 %, render:main +0.75 ms only; lane xSimRun 3.5-7.3 ms vs base 0.7-5.3 (xSimRun is fixed-step catch-up, so it grows with frame time). Inferred, not proven: the NOOP list in qa/cpu/lane.cjs stubs WebGL2RenderingContext.prototype draw/state calls only; WIP6 draws the map strips through the WEBGL_multi_draw extension (multiDrawElementsWEBGL), which is not stubbed, so on the lane those draws still go to swiftshader in-process and the measurement is no longer CPU-only for the lane. The 2026-11-26 run was on 06bce8a8 (before WIP6).
perf/diag_mdnoop: a copy of lane.cjs that also tries to stub WebGLMultiDraw.prototype.* - the stub did NOT attach (R.noop stayed 43, no window.WebGLMultiDraw), so that pair is effectively a third stock pair: base 23.307 ms, lane 69.21 ms. Not counted in the side means. The multi_draw hypothesis remains open; stubbing the object returned by gl.getExtension('WEBGL_multi_draw') would test it.

## Verdict on Jeff's expectations
- a. NOT MET. mbaseQ1 vs mbaseQ2 vandal 24.7k-28.9k px (24.7k of it = the mbaseQ1 viewmodel extra object, rest lineup), abil 118120/160798/184981 px (a0 above the ~154k floor), min SSIM 0.994807 (>= 0.991433 holds). No missing-object and no loadout-swap outlier, but a new extra-viewmodel-object outlier in mbaseQ1.
- b. NOT MET (strictly). mbaseQ2 vs mlaneQ2 vandal 0-1466 px (a6, vm = 0); mbaseQ1 vs mlaneQ1 24.7k-69.8k px (mbaseQ1 viewmodel object + mlaneQ1 lineup drift).
- c. NOT MET. mlaneQ1 vs mlaneQ2: calls/tris identical on all 12 shots, but lineup pixel diffs 2805-45045 px on vandal a0-a5/a7 (a6, vm 0 px).
- d. PARTLY. Lane tris = base tris (Q2 pair, and mbaseQ2 vs both lanes); lane-base abil call gap -21/-32/-25 = parity (WIP6 multi_draw only). Absolute numbers moved with the pin on both sides: lane 238/2718891, 224/1522364, 238/2681506; base 259/2718891, 256/1522364, 263/2681506 (parity: lane 241/2690003, 227/1493476, 241/2652618; base 262/2690003, 259/1493476, 266/2652618).
