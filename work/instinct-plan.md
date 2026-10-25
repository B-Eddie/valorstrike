# Valorstrike instinct-branch work plan (user bug list, ordered: crashes first)
1. [ ] Bot-kill "explosion" crash (character explodes, crashes game)
2. [ ] Ragdoll on kill looks boneless
3. [x] Spectate 3rd-person button broken
4. [x] Gun pickup off floor missing (+ needs indicator)
5. [x] Holes in map
6. [x] Stairs require jumping step-by-step
7. [x] Lag on dealing/taking damage
8. [ ] Default quality fuzzy -> sharp
9. [x] Character grip pose wrong
10. [x] Agent models ~40s load -> background preload+cache at site entry
11. [x] Remove character fallbacks, always use main
12. [ ] Ledger 13-row open checklist (long-term)

## Harness status (2026-10-24 late)
- work/browser-tests/lib.cjs: serve repo + headless Chrome (google-chrome + swiftshader) + boot + startDM helpers. Asset blocking: heavy=false blocks agent/weapon GLBs+textures but allows models/valorant/maps/**.
- kill-crash.cjs: repro for bot-kill explosion crash. Status: boots + opens DM in ~2.6s with light assets, but match start (native map load under SwiftShader) exceeds 115s sandbox budget. Native-scene boot needs a different strategy: either longer detached runs (setsid survived once), a smaller/collision-only mode, or cloud_browser.
- Sandbox saturates (load >20) when Chrome+SwiftShader loads full native scene; shell wedges. Keep full-scene runs strictly bounded, nice -19, one at a time.

## Static analysis notes
- Ragdoll: xrRagdoll/xrRagdollTick (index.html ~12695-12720) Verlet solver over all native bones; replaces xUbDead for native rigs. "Exploded" = likely solver divergence or NaN (zero-length bone dir normalize). xDie at 3795.
- Damage lag: shoot() (~2889) does solids.concat per shot + recursive intersectObjects; hurt() -> sbDmg (9488) + xKLog (2535); vmHit pooled. Investigate per-shot allocs, BVH use, DOM in xKLog/kfeed.
- Quality fuzzy: renderer.setPixelRatio(Math.min(devicePixelRatio||1, 1.5)) line 1988 caps at 1.5; line 3089/8714 cap 2 for other renderers. Likely fix: high preset -> full devicePixelRatio.
- Spectate 3P: V toggles (line 2471); xKL flow ~2530-2584. Button = SPECTATING label click?
- Pickup: F pick up (hint 7602), xdModel 9081 dropped-gun visuals; need indicator + verify F path.
- Stairs: XG_SPEC stair links for bots (7309); player step-up logic to find (groundAt / xStep).
- Agent 40s loads: xvAgentLoad 12396, no preload at lobby; user wants background preload+cache at site entry; remove fallbacks (XUB/Soldier fallback at 3543).

## Progress log
- [x] #8 fuzzy default quality: medium preset now res:"retina" prc:2 (native dpr); adaptive floor 0.7->0.85. commit e04e925.
- [x] #1+#2 ragdoll explosion/boneless: root cause shown - old Verlet solver diverges to 2.3e38 m under velocity spike (dt spikes from background tabs); added per-step velocity clamp (6 m/s), NaN point reset to captured pose, finite-floor guard, divergence reset, non-finite bone skip at capture. Regression test test_ragdoll.cjs with spike+NaN injection passes; old code fails. (uncommitted at first, then committed)
- [~] #3 spectate 3P: static wiring looks correct (span click -> xTPToggle -> xTP.on -> xTPCam at ~4161; .x-sp pointer-events:none overridden inline). Needs in-match repro. Suspects: pointer-lock hiding cursor (desktop), listener loss if xKLui rebuilds, or V-key gating (requires xKL.sp && hp<=0). Verify in DM/5v5 browser run: die, wait 2s, click label + press V, confirm xTP.on flips and camera switches.
- Next run priorities: get bounded in-match repro working (consider forcing custom/old map via FV.pick or a collision-only test page to avoid full native-scene boot), then #4 pickup indicator, #6 stairs, #7 damage lag, #10/#11 agent preload+fallback removal.
- [x] #10 agent 40s loads: xvPreload() walks all 12 agent rigs + locomotion + all weapon GLBs sequentially with idle yields from 1.2s after boot, chosen agent first, skipped on mobile/data-saver; xvLoad/xvJson now go through Cache Storage 'vs-assets-v1' (plain-fetch fallback). commit 7b392b2. test_preload.cjs.
- [x] #11 native-only characters: primitive rig hidden at birth (ring+gun kept as indicators), CC0/Soldier clone tier removed from third person (XUB download stays for FP arms + clip tables), native failure retries twice then one error toast per agent. commit 65e7d3b. test_native_only.cjs.
- [x] #9 grip pose: third-person weapon attach no longer cancels the hand's animated rotation; gun is rigidly seated in the R_Hand palm (offset measured on the shared rig convention) with a per-rig solved constant orientation aligning muzzle (-Z) to character forward in the authored aim stance. Rigid attach = gun tracks hand through run/aim. test_grip.cjs asserts muzzle-forward/upright/palm-seat/rigid tracking across jett/phoenix/raze.
- [x] #10/#11 hardening after review: match-start readiness gate wraps window.xMatchLoad (loading screen covers the wait; persistent kit failure aborts the start with the error toast instead of spawning invisible opponents; startDuel added to the gate list since duel bots are native agents). Background preload aborts at match start so it never competes with the map burst. Cache staleness escape hatch: xValorantAssets.purgeCache() + XV_STORE bump convention documented in the code.
- [x] #4 floor pickup: cherry-picked hark a4caf41 (author preserved, -x provenance) instead of duplicating: look-at [F] prompt under the crosshair, elevation-aware drops for raised native floors, aim-scored xdLook, server-authoritative online floor guns (server/src/floor.js + test-floor.js + test_floor_pickup.cjs). Applied cleanly; suites green.
- [x] splice hygiene: trailing content in valorant_runtime.js had escaped the BEGIN..END strip markers, stacking duplicate inserts on every regen (7 copies). Moved END marker to file end, rebuilt index.html, verified install idempotence. commit 0310eda.
- [x] #3 spectate 3P: cherry-picked hark 251e3ce (author preserved). Root cause matched my static suspicion: spectating kept the pointer locked, so the toggle span could never receive a click on desktop. Fix frees the cursor while spectating, makes the control a real button with state (aria-pressed/on), isolates its clicks from player switching, and stops canvas clicks while dead from re-locking/firing. test_spectate.cjs included. My earlier note about needing in-match repro is superseded by the identified mechanism.
- [x] #7 damage lag: cherry-picked hark 3778dea - per-hit full-screen box-shadow flash + animated masked arc forced layout/repaint every hit; replaced with compositor-friendly feedback. test_hit_perf.cjs.
- [x] #6 stairs: cherry-picked hark 191736f (walk up stairs in the shared client/server motor) + a6a0418 (step-up height clamped to nearby floor so walls can't be walked up).
- [x] #5 map holes: cherry-picked hark 614550e - backdrop skirt around native maps so no void shows past mesh edges + hole-evaluation tooling under server/tools. test_map_skirt.cjs.
All 12 user-list items now have shipped fixes on instinct. Remaining: ledger 13-row long-term checklist + bounded visual/in-match verification of the visual items (ragdoll shape, grip pose, spectate button, pickup prompt, skirt, stairs) once a sandbox-viable boot exists.
- [~] #5 acceptance evidence: ran the cherry-picked tooling. eval-visual-holes: raw below-horizon void rays 46-463/map drop to 0 with the skirt at both far distances; 0 nodes without render floor. eval-holes: 0 fall-throughs in ~1138-1184 random walks per map. eval-fall: breeze has 12/300 and bind 1/300 random walks ending GROUNDED outside nav coverage (no fall-through - collision exists there): players can walk out of the intended play area through boundary gaps; the game has no kill-floor/out-of-bounds mechanic, so they end up stuck out-of-bounds on the skirt backdrop. NEW DEFECT (boundary gaps, distinct from the visual void the skirt fixed): breeze around x -8..12, z 53..64 and bind near (-1.6, 74). Fix options: extend nav/boundary blockers at those edges, or add an out-of-bounds kill zone.
- [~] #10 gate cost measured: all 12 agent GLB+locomotion kits parse in ~0.65 s total (Node, desktop); the ~40 s the user saw is network (97 MB agents + 22 MB locomotion ≈ 38 s at 25 Mbps). Gate cost profile: cold first match = same ~40 s but on the loading screen with progress instead of mid-match fallback bodies; warm visits = sub-second (Cache Storage); desktop lobby dwell hides it via preload. Participant-scoped gating would save at most ~25% of the one-time cold cost for 5v5 (xAgSet hands out XAG keys in order, so ~9/12 kits are the real roster) at the price of mode-specific roster inference; kept the simple exact all-12 gate for now.

## Full-native headless crash investigation (2026-10-25, resolved as environment + gated)
- Repro: heavy profile + DM start crashes the tab ~21s in. JS heap only ~96MB at crash;
  the OOM is native-side. dmesg confirms the kernel OOM killer terminated chrome at
  ~1.05GB anon RSS inside the 2GB sandbox container.
- Quantified full-load demand: Ascent map = 169MB geometry buffers + 373 images ~295MB
  decoded RGBA (+mipmaps); all native kits/weapons/abilities = ~339MB decoded textures;
  SwiftShader framebuffers + Chrome overhead on top. Total comfortably >1.5GB.
- Quality presets (low/medium/high) scale render cost (resolution/shadows/AA/sky/LOD)
  but NOT asset memory: full-res textures decode and upload on every preset.
- Fix shipped (b6ded52): xvPreload background loading now also skips when
  navigator.deviceMemory <= 4 (alongside existing saveData/2g/touch gates). Match-start
  readiness gate (xvReadyAgents) intentionally unchanged - loading guarantees preserved.
- Residual: on-device acceptance on real low-RAM hardware stays on the long-term ledger
  (row 1, full-map startup). Headless full-native rendered runs remain impossible in the
  2GB sandbox; use mid profile + bounded rendered checks instead.
