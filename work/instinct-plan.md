# Valorstrike instinct-branch work plan (user bug list, ordered: crashes first)
1. [ ] Bot-kill "explosion" crash (character explodes, crashes game)
2. [ ] Ragdoll on kill looks boneless
3. [ ] Spectate 3rd-person button broken
4. [ ] Gun pickup off floor missing (+ needs indicator)
5. [ ] Holes in map
6. [ ] Stairs require jumping step-by-step
7. [ ] Lag on dealing/taking damage
8. [ ] Default quality fuzzy -> sharp
9. [ ] Character grip pose wrong
10. [ ] Agent models ~40s load -> background preload+cache at site entry
11. [ ] Remove character fallbacks, always use main
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
