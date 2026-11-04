# Per-ability fidelity ledger (durable). Status: R=reference-grounded (wiki clip viewed), N=numbers match wiki, V=visual state, O=online parity, G=open gaps.
Sources: wiki.playvalorant.com/en-us/<Ability> pages + images/<Ability>_Showcase.mp4 clips.

## Breach (R+N audited 2026-11-04) - NOT faithful, partial
- Aftershock: N ok. V: fireball+2 rings (a18AfterBoom); clip also has aim circle, arm-cannon effects. O: shares client fx. G: aim circle, viewmodel, fireball is flat additive sphere.
- Flashpoint: N ok. V: ray flare (a18Flare, chunky white rays), pink wash flash screen with rays and red border (.bfl) for offline enemy-bot Flashpoint and online (server status.bk). G: wall-placed orb + ring not built; online flash screen not captured in a two-page run; player-cast Flashpoint offline only flashes bots; rays harsher than clip.
- Fault Line: N ok. V: crack decals + few spikes (a18FaultVis), pale yellow, weak contrast. G: aim line, viewmodel, hold-extend visual.
- Rolling Thunder: N (EXPERIMENTAL, NOT SOURCE-VERIFIED: horizontal vs vertical force, 7 m per hit vs total, re-hit stacking, vy 7 height, 4 m slices. Server launches 14 m/s + vy 7 via motor; per-hit trace (scen_breach_rt) shows 3 re-hits, 14.3 m total. OFFLINE bcKnock still uses its own instant 7 m model, not in step): chain 8 x 0.255 s, concuss 4 s, knock 7 m per wiki. Slice geometry 32/8=4 m is a HYPOTHESIS. V: cracks/spikes/debris/smoke (a18QuakeBlast); spikes short. O: server chain + knock, client 'quake' fx row; offline knock for bots only. G: viewmodel lightning charge, player/ally knock offline, two-page visual capture.

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

## Viper Snake Bite
- V: a18AcidPool (jagged translucent fronds burst, then a ragged lime pool with bubble rings), reference = wiki Snake_Bite showcase clip frames (viewed). Offline and online ('snake' fx row). Captured offline only (browser_viper_snake.cjs, reduced assets). Gaps: no projectile/canister flight (instant at aim point), no viewmodel hand animation, online two-page capture not done, pool size r=4 from existing constants (not re-verified), pool bubbles are static texture.

## Phoenix Curveball
- Ref: wiki Curveball_Showcase clip (frames viewed): red-orange swirling flare orb with hot core, streak trail, thin white ring at the pop, orange-tinted flash wash.
- V now: red-orange orb (opaque core + 2 translucent shells, no sky wash-out), white ring pop (xCbRing), orange-tinted flash screen ('phoenix' style) offline player + bot (enPop bl). Captured offline reduced assets (cb_orb/cb_pop).
- Gaps: orb is flat concentric discs, no swirl or streak trail; no throw hand pose/viewmodel; the online flash path (server blind) does not use the phoenix tint or ring; two-page capture not done; flash screen peak is opaque at the first frame (clip shows translucent wash).
- Snake Bite online: server fire row now tagged sub:'snake' and sent as kind 'snake' (was the generic fire cloud, so the acid pool never rendered online). Two-page run (scen_snake.cjs, Viper vs Jett, reduced assets): caster page shows the acid pool; victim B page was facing away (not a victim-view capture); B was 4.4 m from centre (outside r 4), no damage test.
- Blaze online (scen_ab.cjs, Phoenix vs Jett, reduced assets): B's (enemy) own rendered page shows the flame sheet wall from the side, 'blaze' fx row. Confirmed victim-view. Wall height/shape is the sheet as built; gaps unchanged (see Phoenix entry).

## Raze Paint Shells / Blast Pack
- Ref: wiki Paint_Shells and Blast_Pack showcase clips (frames viewed). Paint Shells: lobed orange-red fireball with yellow core, ragged orange ground splat that stays as a scorch, teal sparks. Blast Pack: small flat pack that sticks, hard yellow-white flash burst.
- V now (rzFire, offline rsBoom for 'Paint Shells' and 'Blast Pack'): billboard-puff fireball (9 lobes), splat decal with streaks + teal flecks, sparks; pack = white-yellow flash + star blades + sparks. Captured offline reduced assets (browser_raze_boom.cjs, time-scaled 0.08).
- Gaps: online (server) detonation does not call rzFire (not checked/wired); blades barely visible in my pack frame; Paint Shells sub-munitions used pink 0xff4fa0 before, now orange (clip shows orange); no projectile/viewmodel work (pack thrown model, shell cluster flight); Showstopper and Boom Bot keep the generic sphere; no two-page capture.
