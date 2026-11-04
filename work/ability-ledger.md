# Per-ability fidelity ledger (durable). Status: R=reference-grounded (wiki clip viewed), N=numbers match wiki, V=visual state, O=online parity, G=open gaps.
Sources: wiki.playvalorant.com/en-us/<Ability> pages + images/<Ability>_Showcase.mp4 clips.

## Breach (R+N audited 2026-11-04) - NOT faithful, partial
- Aftershock: N ok. V: fireball+2 rings (a18AfterBoom); clip also has aim circle, arm-cannon effects. O: shares client fx. G: aim circle, viewmodel, fireball is flat additive sphere.
- Flashpoint: N ok. V: ray flare (a18Flare, chunky white rays), pink wash flash screen with rays and red border (.bfl) for offline enemy-bot Flashpoint and online (server status.bk). G: wall-placed orb + ring not built; online flash screen not captured in a two-page run; player-cast Flashpoint offline only flashes bots; rays harsher than clip.
- Fault Line: N ok. V: crack decals + few spikes (a18FaultVis), pale yellow, weak contrast. G: aim line, viewmodel, hold-extend visual.
- Rolling Thunder: N (GAP: total displacement 17.9 m in two-page run = 3 stacked 7 m hits, stacking unsourced; wiki gives 7 m per displacement only): chain 8 x 0.255 s, concuss 4 s, knock 7 m per wiki. Slice geometry 32/8=4 m is a HYPOTHESIS. V: cracks/spikes/debris/smoke (a18QuakeBlast); spikes short. O: server chain + knock, client 'quake' fx row; offline knock for bots only. G: viewmodel lightning charge, player/ally knock offline, two-page visual capture.

## Tejo / KAY/O - see agents18-notes.md (Salvo missile speed unsourced, FRAG arc not drawn, VFX primitives, self multiplier unsourced).

## Not yet audited vs wiki clips (base abilities): Jett, Phoenix, Sova, Sage, Reyna, Omen, Killjoy, Raze, Skye, Cypher, (then the rest).

## Phoenix - Blaze (R 2026-11-04, Blaze_Showcase.mp4 viewed)
- V: coral flame sheet with orange swirls, jagged top, bright base, scrolling texture (blzMat/blzPlane; shared material, fog/tonemap off). Used by player, bot and online walls (all call blazeWall). Captured side-on (work/browser_phoenix_blaze.cjs), viewed.
- G: no arm/viewmodel flame effect, no growth animation as the wall rises (clip shows it shooting up), no heat distortion, damage-visual on hit not checked; numbers (XBLZ) previously audited. Hot Hands, Curveball, Run It Back not audited.

## Phoenix - Hot Hands (R, Hot_Hands_Showcase.mp4 viewed)
- V: molten pool with bright vein cracks, slowly flowing (hhMat), used by player, bot and online 'fire' zones (Paint Shells and the pink rz variant unchanged). Captured, viewed (work/browser_phoenix_hh.cjs).
- G: the thrown fireball projectile with trail/sparks is not drawn (clip shows a glowing ball arcing out of the hand); no hand fire viewmodel; on-hit burning visuals unchecked; online not captured in two pages.

## Jett - Cloudburst: existing lumpy smoke body (xCbCloud) left as is; clip shows pale translucent bubble-like cloud, not re-compared pixel to pixel. Blade Storm (Blade_Storm_Showcase.mp4 viewed): mechanics exist; GAP: viewmodel shows the generic knife, clip shows silver kunai in both hands with cyan glow, blue-white wind arcs on throw, thin cyan tracer. Updraft/Tailwind not audited.

## Sage - Slow Orb (R, Slow_Orb_Showcase.mp4 viewed)
- V: faceted cyan ice-shard sheet that spreads over 0.9 s then shrinks away (slowMat, sgOrbLand + bot Slow Orb). Captured, viewed (work/browser_sage_slow.cjs).
- G: 3D crystal shards standing up from the field are not built (flat texture only); orb in hand/flight (glowing teal sphere) not compared; online fx path shares sgOrbLand but not captured two-page. Barrier Orb, Healing Orb, Resurrection not audited.
## Killjoy - Nanoswarm (Nanoswarm_Showcase.mp4 viewed): V: resting zone now magenta ring with teal rim and motes (nanoMat; captured, viewed, work/browser_killjoy_nano.cjs). GAP: the activation burst of magenta crystal spikes is not built; the zone is dull compared with the clip; the thrown canister look unchecked. Snake_Bite clip downloaded, not reviewed (flat 0x7fd84a disc suspected).
