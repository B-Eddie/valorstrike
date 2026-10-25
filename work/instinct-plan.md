# Valorstrike instinct-branch work plan (user bug list, ordered: crashes first)
1. [ ] Bot-kill "explosion" crash (character explodes, crashes game)
2. [ ] Ragdoll on kill looks boneless
3. [x] Spectate 3rd-person button broken
4. [x] Gun pickup off floor missing (+ needs indicator)
5. [ ] Holes in map
6. [ ] Stairs require jumping step-by-step
7. [ ] Lag on dealing/taking damage
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
