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
- [x] #5 acceptance evidence: ran the cherry-picked tooling. eval-visual-holes: raw below-horizon void rays 46-463/map drop to 0 with the skirt at both far distances; 0 nodes without render floor. eval-holes: 0 fall-throughs in ~1138-1184 random walks per map. eval-fall: breeze has 12/300 and bind 1/300 random walks ending GROUNDED outside nav coverage (no fall-through - collision exists there): players can walk out of the intended play area through boundary gaps; the game had no kill-floor/out-of-bounds mechanic, so they ended up stuck out-of-bounds on the skirt backdrop. Boundary gaps: breeze around x -8..12, z 53..64 and bind near (-1.6, 74).
- [x] #5 boundary gaps, kill-watch track (separate from the fence-v2/skirt track above):
  CLIENT nmOobWatch (XHK hook): a grounded actor with no playable nav node within 4 units hears
  "Outside the map - get back!" and dies after 2 s; airborne, in-coverage, paused, pre-match
  untouched; re-entry resets the clock. Coverage basis is the intended largest connected
  with the fence-v2 evidence (ff1893d): the watch covers EVERY VALID node (nmNearV,
  lazy valid-node cell index), not the largest connected component. The 01:44 island
  inventory stands: fragmentation (73-236 components) is a nav-DATA defect and islands
  hold named intended space - measured: bind B Fountain 118, Attacker Cave 60, B
  Teleporter 28, B Long 22, A Cubby 19 nodes >4u from the largest component; breeze
  Mid Hall 64 + A Pyramids 17; haven C Site 8; lotus C Bend 27; split B Tower 8. A
  largest-component watch WOULD have killed players there (confirmed live pre-fix:
  bind island node (-77.25,3.8,39.75) died at hp -9900); with valid coverage the same
  warp survives (oob-probe bind section, hp 100 after 12 s). Only ground past ALL
  valid coverage (skirt/vista landings like breeze (0,90), dv=28) stays lethal.
  Scripted destinations verified within 1.5 of playable on all six maps
  (test_oob_destinations.cjs) - teleporter entries/exits, sites, spawns can never be executed
  by the watch. Attribution: hurt/kill/allyDie with by='Out of bounds' - display-only;
  fKC credit is a no-op for unknown names (no score theft). Respawn: normal DM/five death paths.
  VM test test_oob_kill.cjs. INVALIDATED first oob-probe run: it set FV.map instead of FV.pick,
  so both sections silently ran Ascent (confirmed via map-state readout: key 'ascent', site
  node (46.75,10.07,-27.25) is Ascent's). Its 'on Breeze' claims are void. Corrected rerun
  (FV.pick + site-node map assertion): real breeze site control hp 100, breeze skirt (0,90)
  dies in 3 s, bind island node spared (hp 100 after 12 s). Audit of every other probe:
  bind-tp-probe used FV.pick from its first commit (bcbdb13); all remaining probes run the
  default map with no map-specific claim; Node-side map tooling (eval-*) never touches the
  browser harness. No other map-attributed claim is affected.
- [x] #5 boundary gaps, SERVER track (authoritative rooms): Simulation.oobKill mirrors the
  client criterion (nearValid-distance >4 over ALL valid nodes via world.nearValid, motor-grounded, 2 s) and is called from both step loops.
  dm/tdm: broadcast 'n' warning note, kill event ['k','Out of bounds',name,0,'Ability']
  (no kill credit, clean feed label), respawnAt = +1.5 s as usual. five: death without
  mid-round respawn, mirroring the existing void-fall rule (y<-20 unchanged as fall recovery).
  Guarded for legacy stub worlds without near(). test-oob.js wired into npm test.
- [x] Gameplay soak #1 (five-soak.cjs, natural round on bind, real-time rate after tiny-viewport
  fix): found ALLY TARGET ACQUISITION was hard-capped at 30u (index.html ally think block)
  while enemy bots acquire any LOS target at ANY range - defenders melted attackers who never
  targeted back (live pre-fix round: allies died 4-for-1 in a 6s crossfire). Fix: cap removed,
  LOS + nearest-sighted kept (index.html line ~4303). Regression: test_ally_acquire.cjs pins
  sighted acquisition at 45u/80u + unsighted fallback. Live post-fix rounds: allies traded
  2-for-4 then PLANTED and won via post-plant hold + detonation; third round enemies won 4-for-1
  - variance, not a one-sided program. 38 client suites green.
- Sandbox timing note: game dt clamps at 50ms (index.html:4158), so under SwiftShader at ~2fps
  the whole game runs ~10x slow-motion; five-soak uses a 320x180 viewport to hold 1.00x
  real-time (asserted via timeLeft rate). The 320x180 probe is logic/flow evidence only, NOT
  intended-resolution performance acceptance.
- Low-FPS timing coherence audit (parent-directed, code-level):
  SERVER is real-time: worker.js tick() runs setInterval 50ms with dt=Math.min(.2, real
  elapsed) and a catch-up loop stepping the sim in 0.05 substeps, so the sim clock tracks wall
  time through jitter up to 200ms; the 0.05 clamp in sim.step is a substep size, not dilation.
  Only DO starvation >200ms dilates, bounded and uniform across participants.
  ONLINE CLIENT clock is server-anchored: every snapshot sets timeLeft=m.tl (dm/tdm 11669,
  generic 11679) and five-mode roundState sets timeLeft=r.tl + FV.buy=r.b (11985) at 20Hz -
  a dilated client cannot drift the round clock.
  COOLDOWNS are server-enforced against the real-time sim clock (fireAt from this.time,
  simulation.js fire()), so a dilated client fires SLOWER than allowed (disadvantaged, never
  desynced, never exploitable); ability cooldowns likewise server-side this.time.
  PHYSICS: server Motor.step real-time substeps; offline client dilates uniformly (bots,
  timers, physics share the clamped dt) - internally coherent slow motion, quality issue only.
  VERDICT: authoritative-vs-client timing stays coherent at low client FPS; no code change.
- [x] Gameplay soak #2 (tdm-soak.cjs, TDM on ascent, real-time): THREE stranded-unit defects
  found and fixed. (a) TDM allies had no hunt goal: without a target they pathed back to
  (spawnX, hardcoded z=1.2) and idled stacked at spawn - now they hunt their nearest enemy
  like enemy bots do (origin z stored as a.oz for the fallback). (b) gNav parked units on
  unreachable goals: A* exhaustion returned the unit's OWN nearest node N[s], so any goal on
  another nav component froze the unit - now routes to the closest REACHABLE node
  (test_gnav_unreachable.cjs). (c) dmPts spawn candidates came from map CALLOUTs with no
  connectivity check - Ascent's "B Site" callout sits on a disconnected nav island and TDM
  allies spawned there stranded (4 parked at (46.7,-27.1) live); candidates must now sit
  within 2.5u of PLAYABLE nav, fallback keeps originals if <8 survive
  (test_dmpts_playable.cjs). Post-fix soak: the 4-ally park is gone, deaths/respawns flow
  10/8, real-time rate. 40 client suites green.
- [x] Spawn-candidate redesign (parent scope check): dmPts' callout fallback used the OLD
  ASCENT const CALLOUTS on EVERY native map (const, never reassigned) - on bind/haven/etc TDM
  spawns came from ascent-frame coordinates. Native path now samples PLAYABLE nav nodes
  directly (safe reachable sampling by construction; islands excluded). Measured all six
  maps: 7803-11676 playable nodes each, decimated to ~157-160 candidates; the <8 fallback
  can never trigger on native maps; legacy callout path (breeze 20/23, haven 19/21, lotus
  26/28 survive the playable filter) stays >=8 everywhere, so unsafe originals are never
  reintroduced. Live: bind TDM soak PASS (combat flowing, zero stalls).
- [x] Server authoritative nav/spawn parity check (parent ask): NO CHANGE NEEDED. Server
  spawns draw from W.playable near team anchors (simulation.js spawn()); bot path endpoints
  come from W.near which is playable-only (world.js:16), and W.allowed equals the playable
  set, so server A* endpoints always sit in the largest connected component - paths cannot
  fail from fragmentation, bots cannot spawn on islands. A human on an island is hunted to
  the closest playable approach (W.near(target)), which is the desired behavior.
- [x] Snag point (24,-26.7) root-caused and fixed: the spot is the BASE OF A 10m WALL FACE
  under a raised platform (server-world probe: ground jumps 0 -> 10.1 between z=-27.7/-26.7;
  platform nodes at y~10 playable/dense; node 8429 at the edge is isolated adj=[]). The wall
  base at y~0 has NO nav nodes within 6u - nav-dark ground. Client gNav's near() attach is 2D:
  a unit at the wall base attached to platform nodes 10m overhead and pushed the wall forever,
  re-planning to the same nodes (both the pre-fix Killjoy and post-fix Reyna stalls). Fix:
  y-aware attach - near() skips nodes whose ground differs from the unit's y by >2.5
  (groundAt, uniform old/native); start AND goal attach in the unit's floor band; no same-floor
  node -> direct steer (existing fallback). Threaded p.y through xPath -> fNav -> gNav (both
  callers). Regression: test_gnav_unreachable.cjs height cases (y=0 never attaches overhead;
  y=10 routes). Live: ascent TDM soak PASS, zero stalls (was flagged in 2 of 3 prior runs).
- Residual topology (kept OPEN, not reclassified): the wall base at y~0 under the platform is
  valid ground (OOB watch spares it via 2D valid coverage) but nav-dark - units that end up
  there direct-steer and may hug the wall until they reach covered ground; full repair needs
  the nav rebuild (fragmentation/islands track). Server W.near is already y-weighted.
- Watch item (superseded by the three fixes above unless it recurs): one bind soak round ended with the last ally
  (Chamber) stationary 16s at (-47,10.3) mid-round while spike was player-carried; could be a
  hold personality or pathing stall - needs another sample before treating as a defect.
- five-soak haven round (parameterized MAP): allies traded 3-for-1 then wiped, player-carried
  spike, no stuck attackers, no anomalies, zero page errors - PASS. Cumulative post-fix samples:
  4 rounds (bind x3, haven), allies won 1 via plant+detonation, defenders won 3 with an idle
  player; defenders SHOULD hold an edge and the probe player barely participates, so no
  imbalance claim is made - only flow evidence.
- Probe harness note: startFive reads FV.pick, NOT FV.map - oob-probe's first version silently
  ran Ascent in both sections until fixed (map selection now asserted via site-node coordinates).
- Per-mode acceptance limits: offline modes covered by the client watch; trusted-server rooms
  by oobKill; legacy P2P covered only on the HOST (guest avatars are host-side units) - a P2P
  GUEST's own out-of-bounds walk is still unwatched (host owns guest truth; a guest-local kill
  would fight snapshots). The gap EXIT points sit within ~2u of nav nodes, so the watch trips
  on beyond-bounds landings, not at the gap; per-edge blockers would be tighter.
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
- Demand reduction shipped (713d987): texture decode cap linked to the quality preset -
  low = 512px, plus navigator.deviceMemory <= 4 = 1024px at any preset. Intercepts only the
  (blob, options) createImageBitmap shape THREE r147 ImageBitmapLoader uses for GLTF
  textures; ~640MB decoded textures -> ~160MB at 512 cap. Models/geometry/animations/gameplay
  untouched; Safari/Firefox (TextureLoader path) unaffected. 33/33 client suites green.
- Residual: sandbox heavy+cap measurement attempted 4x (mem3-probe): boot succeeds, but the
  match-start GLB parse pegs both cores (page main thread never yields to evaluate) and RSS
  hits the 2GB ceiling before RUNNING. Sandbox saturation is CPU+memory, so full-native
  acceptance needs a larger container or real hardware; stays on the long-term ledger (row 1).
  Participant-scoped xvReadyAgents shipped (fa03ea3): gate loads the match roster
  (pick + Chamber + drawn teams via consumed-once xTmPreDrawn pre-draw; MP.on or unknown
  state still loads all 12 for late joins). Live-verified via real UI path (roster-probe):
  7 kits loaded for a 7-name DM roster, 5 non-participant kits skipped, 6s start, zero errors.
  texcap hook hardened + unit-tested (181e563): option/orientation/alpha preservation, probe
  closure, resize-failure fallback to full-size probe, Safari/Firefox no-cap path explicit.

## Ability matrix anomaly RESOLVED (2026-10-25 ~03:12)
- ability-matrix.cjs: 12-agent C/Q/E/X smoke in one 5v5. All 12 agents' abilities fire.
- ROOT CAUSE: index.html:9945 pointerlockchange handler pauses the game on any pointer-lock
  exit. Omen's X (From the Shadows) deliberately calls document.exitPointerLock() for minimap
  targeting (J.ftp=true) -> pause() fired -> keydown listener's `if (paused) return;` swallowed
  ALL keys, so no subsequent ability key did anything. Real-play impact: Omen ult would pop the
  pause menu over the targeting UI on desktop. Same mechanism blocked Cypher/Killjoy/etc. in the
  matrix because targeting left the game paused for the rest of the probe.
- FIX: pointerlockchange guard now skips pause while J.ftp targeting is active
  (`!J.ftp` added), mirroring the existing dead-spectating exemption.
- VERIFIED: omen-pause-probe.cjs (mid profile): paused=false before X; after X ftp=true,
  paused=false, lock released; ordinary unlock afterwards still pauses (regression guard).
  ability-matrix rerun: 12/12 fired, zero page errors. 35 client suites green.
- FOLLOW-UP FIX (same area): okMMClick validated clicks against the hardcoded legacy Ascent
  box (+/-55 x, +/-60 z) even on native maps, rejecting valid displayed minimap spots near
  map edges; mmBounds (native C.bounds) now wins whenever a native map is active.
- VERIFIED END-TO-END: omen-ult-probe.cjs (real key + real minimap mouse click): X enters
  targeting unpaused, click on B site (90u away) accepted, ult spent, 3s channel, player
  teleports to the clicked point. Zero page errors. Probe notes: the intro modal must be
  dismissed (real users do) or it eats clicks; minimap px are ~0.5-0.9 world units coarse,
  so click targets need ~1u of open space - matches the intended "pick an open spot" UX.

## DM kill-path + rig findings (2026-10-25 08:32)
- kill() sets alive=false unconditionally; DM respawns dead bots after 1.5s via dmSpawnB (hp 100, armor 50). Earlier "kill didn't stick" was a probe artifact (hurt bot A, killed bots[0], re-sampled A). No DM kill bug.
- Native rigs attach ASYNCHRONOUSLY ~12s after DM start (agent GLBs fetched 200 locally under mid profile + light(true) + agents(false)). rig:false at match start is normal.
- __vs.light(true) sets __vsNoAgents=true; must call __vs.agents(false) AFTER light(true) to keep rigs.
- diag-rag.cjs updated: waits for rig attach, kills rigged bot, measures Verlet drift + screenshots corpse at 1.2s/3.7s. NOT YET RUN to completion (run-limit cut; launch on next wake, keep bash alive ~110s for the probe to finish inside the call).

## Ragdoll live verification (2026-10-25 08:37) - items #1+#2 bounded in-match evidence
- diag-rag.cjs (DM ascent, mid profile, native rigs): 3 kills on valorant-rigged bots. Verlet stable: 146-272 sim points, max bone drift from captured pose 0.29-1.74u (bounded collapse), NaN count 0, zero page errors. No explosion/divergence (pre-fix bug diverged to 2.3e38).
- Visual: corpse screenshot 2.2s post-kill shows coherent crumpled body on floor + dropped gun (ragdoll-4.png). Not boneless/spaghettified at this sample size.
- Findings baked into probe: rigs attach asynchronously (agents load one at a time under SwiftShader; wait on xm.valorant, not xm); __vs.light(true) sets __vsNoAgents=true, so call agents(false) after; intro banner blocks center screen ~5s, screenshot after it fades; corpse removed at ragdoll 2.8s lifecycle + XDEAD age>4 splice.
- Caveat: SwiftShader 640x360 sampled kills, logic/flow evidence - not full visual acceptance.

## Split natural push/plant (post-repair) - 08:45 EDT
Split five-soak (one sampled run, MAP=split): AI attackers pushed B and planted NATURALLY
(sp carry -> plant at (-36.5,-21.5) site B, t~44s; round ended sp:done). No warp/teleport.
ISSUES: none, PASS. This is the owed post-bake natural plant evidence on split.
Ragdoll capture verdict (parent): ang0/ang1 stronger bounded evidence (connected limbs, no
catastrophic stretching in these samples); ang2 excluded (artificially extended sim);
floor contact retained as NUMERIC evidence only (flat bg has no ground reference).

## Live bounded verification batch (2026-10-25 08:52 EDT)
- #4 pickup prompt VERIFIED live (5v5 ascent): killed bot dropped Frenzy; aiming at the floor
  gun -> #xdPrompt display:flex "F Pick up Frenzy"; look-away -> display:none. xdOn is
  five-only (mode==="five" && !FV.dm && !NET.socket) - DM has no floor pickup by design.
  diag-pickup.cjs. Gotcha: xdPrompt runs on rAF; sample promptly after aiming.
- #3 spectate 3P VERIFIED live (5v5 ascent): died to bots (buy must be zeroed AFTER start -
  fRound resets FV.buy=45), button appeared, click flipped aria-pressed false->true,
  label 3RD->1ST PERSON, class .on; screenshot shows "SPECTATING BREACH" UI with toggle in
  on-state. The original bug (pointer locked -> unclickable) path is what the cherry-pick
  fixed; click now lands. diag-spectate.cjs.
- #9 grip pose bounded visual: gun visibly tracks the bot's hand region through run-anim
  frames (no detachment); fine aim-stance geometry not conclusively judgeable at this zoom -
  numeric test_grip.cjs (muzzle-forward/upright/palm-seat/rigid, 3 agents) remains the
  primary evidence. diag-grip.cjs.

## Spectate camera/target verification + pickup scope correction (08:55 EDT)
- #3 extended: after death, 1P view shows observer panel for the target (Phoenix card, hp 0 me);
  toggle click -> 3P on-state; spectate HUD tracks TARGET state (SPECTATING SOVA, hp 100,
  Sheriff 6/18); Space switches target (SOVA -> RAZE). Target body-in-frame still NOT readable
  in light profile (flat scene, target facing open ground; distant figures at horizon) - camera
  follow proven at state level, not pixels. diag-spectate.cjs.
- PICKUP SCOPE CORRECTION: xdOn gates only the OFFLINE 5v5 list; xdFloorList() returns the
  server-authoritative netFloor when NET.socket && MP.st==='game' && MP.m5 - online pickup UI
  goes through the same #xdPrompt. So pickup availability = offline 5v5 + online m5. DM has no
  pickup list (free-guns mode: HUD "FREE GUNS (WHEN SAFE)") - consistent with Valorant DM rules
  but asserted from code + game-rules reasoning, not user-approved scope. No DM change made.

## NEXT (queued 08:56 EDT)
1. Online two-client PROTOCOL check (label: protocol evidence, not rendered two-human
   acceptance): `npm run dev` (wrangler local :8787, ALLOW_LOCAL_ORIGIN) + a ws script in the
   test-spike-socket.js pattern: client A creates (/connect?create=1&code=X&mode=five&map=...),
   B joins same code; assert both receive rs snapshots with 2 human players; A kills B via
   inputs -> B sees own hp/death; B drops gun -> A sees netFloor entry (online pickup path,
   the corrected scope). Write as server/test-two-client.js standalone first; chain add later.
2. Stairs live walk (find a stairs spot, scripted W-key walk, verify y rises smoothly).
3. Skirt visual (numeric eval already green; light-profile screenshot at map edge).
4. Mobile items + performance remain open.
