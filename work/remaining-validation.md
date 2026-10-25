# Current main integration

The historical branch ledger below describes evidence gathered before integration. `hark` through `5cd5e0b` and `instinct` through `857f318` are now integrated with conflict corrections. [BRANCH_INTEGRATION.md](BRANCH_INTEGRATION.md) is the current combined-code verification record; [NEXT_STEPS.md](NEXT_STEPS.md) carries the complete remaining acceptance plan. Branch-specific pass claims do not establish a pass on the combined build.

# Valorstrike acceptance ledger

Updated 25 October 2026, sixth pass (branch `hark`, tip after this ledger commit) from the full [Instinct handoff](https://files.instinct.com/u6k7xnlbyeh0-valorstrike-shipped-and-still-open).

This is an implementation and evidence ledger, not a release sign-off. Source and browser checks below must not be represented as completion of the entire handoff.

## Branch `hark` commits (not merged to main, not deployed)

Each commit passed both suites from `server/` at the time it landed; `index.html` regeneration stayed byte-identical. "Source-verified" means headless regression tests and software renders, not a signed-off browser/device check.

| Commit | Change | Evidence | Still open |
|---|---|---|---|
| aee2309 | Corpse ragdoll rebuilt as skeleton-preserving joint physics (no exploding skin; NaN/huge-dt safe) | `test_ragdoll.cjs` on four agents, edge cases | Browser visual of deaths on slopes/ledges across maps |
| 3778dea | Removed per-hit layout/repaint costs from damage feedback (hit lag) | `test_hit_perf.cjs` source/regression | **Not browser-profiled**; real frame-time capture under combat still needed |
| c0ede5e | Sharp render by default: native DPR, 1:1 minimum, no silent downscale | `test_render_quality.cjs` | Low-end/mobile frame-rate impact unmeasured |
| 251e3ce | Spectator third-person control is a real clickable button | `test_spectate.cjs` | Touch/mobile check |
| 191736f | Walk up stairs without jumping (shared client/server motor) | `test_stairs.cjs` | Rendered traversal of every stair set on six maps |
| a6a0418 | Step-up clamped to nearby floor so walls can't be climbed (Bind) | regression in stairs/contact tests | Full wall sweep on all maps |
| 614550e | Backdrop skirt around native maps (no void past mesh edges); diagnostics moved to `server/tools` | `test_map_skirt.cjs` | Visual pass per map/quality preset |
| a4caf41 | Floor weapon pick-up on [F]: look-at prompt, swap/drop, server-authoritative online floor guns | `test_floor_pickup.cjs`, server `test-floor.js` | Two-client rendered check |
| b3324e1, 280c84c, 0c6c143 | Optimized agent assets (5.7× smaller), preload/cache/dedupe, stand-in rigs and fallbacks removed; match start waits for real models | Scripted browser benchmark at 25 Mbit/s: agent load 39.5 s → 7.2 s first visit, 0.7 s repeat (Cache Storage); `test_agent_assets.cjs`, `test_agent_preload.cjs`, `test_loading_agents.cjs` | Constrained-device/memory timings |
| 3f5889a | Third-person two-handed grip (row 4): gun placed from aim (stock in right shoulder for long guns, isosceles for sidearms), two-bone IK right hand to the gun's Trigger socket and left hand to its Left_Hand_Target socket (sliding back along the handguard when the arm can't reach), hand orientation and finger curl; fades out for reload, casts, throws, plant, knife and death | `test_grip.cjs`: 15 agent/weapon pairs × idle/walk/crouch × pitch −0.6/0/+0.6, right palm ≤ 4 cm from grip, left palm ≤ 5 cm from the gun, muzzle on the aim, no frame-to-frame stacking, reload/knife fade. Renders via `node server/tools/grip-view.mjs <agent> <weapon> out.png <pitch> <state>` (`ZOOM=2` for close-ups) inspected for Vandal, Phantom, Spectre, Operator, Judge, Classic, Sheriff on Jett and Breach | In-browser look in motion (sprint, jump, strafe), per-agent clipping into large costumes, remote players online |
| 8a409eb | First-person arms (row 5): the native first-person rig is the only arm source; dead Quaternius-body arm code removed; primitive arms no longer flash while the native rig loads (only a failed native load falls back to them); built rigs cached per agent/weapon (instant swap, equip replays); knife/Classic/current weapon warmed when a match runs | `test_fp_native.cjs`: every weapon + knife on Jett (and Sheriff/Spectre/Vandal/knife on Breach) has native Idle/Equip/Fire/Reload/Inspect (knife: attacks) and both hands stay on the weapon in idle/fire; loading/caching/fallback behaviour. `server/tools/fp-view.mjs` renders/measures any agent/weapon/clip | Browser check of quality switches, timing feel, crowded combat; bolt-gun fire and reload clips move hands off the gun by design |
| 3815f02 | Stale dev scripts for the removed stand-in rigs deleted (`agent_preview.js`, `agent_rt.js`, `boots_check.js`, `fp_check.js`) and their sections dropped from `audit.js`; duel, rifle 2v2, surf, aim and deathmatch now start only once every agent model is in memory (agent-progress overlay otherwise) | `test_loading_agents.cjs` | `audit.js` (legacy fixture, not part of the suites) runs out of memory (≈4.6 GB RSS) in its forced-target spike-carry soak, which precedes the removed sections; its remaining checks were therefore not re-run. No Chromium is available in this sandbox, so browser scripts (`verify_feel.js`, `bench_agent_load.js`) were not re-run for these commits |

| 9c482cc, a4a1feb | Foot planting on stairs/slopes: per-foot ground probe, body drop, two-bone leg IK for nearby agents; Grip/feet IK no per-frame allocations | `test_feet.cjs` | Rendered multi-agent traversal on all maps (row 6) |
| 1ba3773 | Touch: held Use (F) button for floor guns, doors and orbs | touch button regression | Real phone check |
| c83c7b2 | Third-person grip: bot visual pass no longer overwrote the gripped gun's rotation (muzzle 30-60° off aim, browser-found) | `test_grip_frame.cjs`, `browser-grip-before-after.jpg` | Online remote players |
| bea6ab4 | Ragdoll floor contact: per-joint contact volume sampled from the skinned surface at death; skin penetration 7-25 cm → ≤5 cm; dangling chains lifted | `test_ragdoll.cjs`, `ragdoll-settled-before-small.jpg` | Superseded in the browser by ebd0ca4 (sampling threw on r149, see below) |
| 1c6b846 | Native minimap markers restored (teammate-spotted enemies at native floor heights, recon/ping reveals, last-seen '?', call-outs, orbs, Spike carrier); six-map orientation regression | `test_minimap_visibility.cjs` and orientation checks | Running-match visual on all six maps, mobile, Omen targeting (row 8) |
| 2ee6a50 (merge of `hark-combat`: c18c35c, 24f197d, ab15921, 48446b4, 727807e, bf518dd, 13896ff, ee2cca0) | Online aim pitch sign fixed; pose-following server hit volumes (12 agents × stand/move/crouch/air, facing); official wall-penetration tiers; render-matched smoke blocks bot sight, flash LOS/facing; server-owned statuses; deterministic per-bot personalities; backgrounded tabs keep their seat (visibility signal, Worker heartbeat); two-player acceptance harness and DM spawn spread; crowded-combat hot paths (grid nearest-node, cached A*: ≈40% server tick cost); native crouch lowers the rendered head to the server head volume; worker bundle embeds hitboxes.json | Server `test-combat.js`, `test-bots.js`, `test-background.js`, `test-two-player.js`, `test-perf.js`, `test-bundle.cjs`; client `test_online_pitch.cjs`, `test_combat_consistency.cjs`; `native_crouch_before_after.png`; live two-player run (two rendered clients, local worker) passed 363 s per `combat-notes.md` | Natural-finish/persisted-record check in rendered clients repeated on more maps; aim-pitch upper-body and strafe hip yaw not modelled in hit volumes |
| 9712016 | Ultimates server-authoritative: Hunter's Fury, Showstopper, Lockdown, Rolling Thunder, Seekers, Neural Theft, Tour de Force (5-round Operator, weapon restore), Run It Back | `test-ults.js` | Browser visuals of each ult; values follow the project's rules, not datamined |
| 37a90be, 23f3bf7 | Devices: recon pulses reveal by LOS, Boom Bot, Trailblazer; Blaze, Hot Hands, Curveball, Nanoswarm, Alarmbot (Vulnerable), Turret arc, Trapwire tether, Cyber Cage, Trademark, Headhunter restore | `test-ults.js` device sections | **Values are interpreted from public descriptions, not datamined**; browser check of each device |
| 337e87c, 1c1d394 | Short landscape 640x360: map pre-screen scrolls with GO sticky; agent cards first, details below, LOCK IN sticky | `test_short_layout.cjs`, `css-agent-640x360.jpg` | Real phone in landscape |
| 4b8bac3 | Native map decals: opaque-exported Decal_/Floater_ materials with real alpha are alpha-blended; white Floater masks render as soft grime (white wall patches gone) | `test_map_decals.cjs` on real textures of six maps, `lotus-spawn-decals-before-after.jpg` | Visual pass on the other five maps |
| b562314 | Spectate on native maps: third-person cam follows the target's floor height; spectate bar moves to the bottom at 640x360 | `test_tp_cam_height.cjs`, `test_short_layout.cjs`, `lotus-spectate-3p-640x360.jpg` | Other maps' upper floors |
| ebd0ca4 | Ragdoll collapse in the browser: r149 has no `BufferAttribute.getComponent`, so contact sampling threw at death and every corpse froze upright until the fade; sampling uses getX..getW, failure clears contact points. Corpses also advance on real elapsed time (low fps no longer leaves them standing) | `test_ragdoll.cjs` (r149 attributes, 1/3/8 fps); `lotus-ragdoll-browser.json` (live page numbers: pelvis 1.08 m → 0.15 m, head 1.72 m → 0.13 m above the floor in 2 s at 1 fps) | Rendered screenshot of a collapsed corpse (Chromium OOM alongside the combat soak) |
| 13fdfd6 | Floor pick-up allowed in the buy phase (prompt showed but F did nothing) | `test_floor_pickup.cjs`; browser (Lotus, 640x360, buy phase 43 s left): prompt `[F] Pick up Frenzy`, F swapped Classic → Frenzy and left the Classic on the floor, `lotus-buyphase-pickup-before/after-640x360.jpg` (canvas only, HUD not in the capture) | Online two-client swap |
| de401e9, b86efe2 | Curveball direction: online cast sends `l` (FIRE left, ALT FIRE right); offline/local flare now curves on the server's path (5 m ahead then 2.5 m aside, wall-clipped) | `test_curveball_flag.cjs`, `test_curveball_offline.cjs` | Browser feel |
| 908a0b5 | Native map foliage cut-outs: 71 foliage materials with real alpha get alpha test (vines/moss no longer solid sheets) | `test_map_decals.cjs` | Visual pass per map |
| b256a56 | Online Vulnerable / Trapwire tether status shown (announcement + chip with seconds) | `test_net_status.cjs` | Live online check |
| 854d1ef | Tour de Force round reset online: client re-arms the round loadout (Operator slot/model no longer survive) | `test_tdf_round_reset.cjs`, `test-ults.js` round reset mid-ult | Live online check. Note: in this commit's own tree the helper sits inside `mpCli5` (runs, but the new test cannot slice it); placed correctly in b86efe2 |
| 5f83f26 | `test_agent_preload.cjs` flake under load fixed (polls Cache Storage writes) | client suite | — |
| b515533 | Native-map memory budget (rows 1/12): prepared maps keep normals as Int8x4 and indices as Uint16 (≤65535 vertices), textures capped at 256 px on LOW or ≤4 GB devices, attribute arrays and decoded images dropped once on the GPU, all map textures uploaded during loading; a new WebGL context (AA switch via xRemake, restored context) re-prepares the scene from the HTTP cache (`nmRehydrate`); `xNativeMaps.memory()` reports bytes and timings | `test_map_memory.cjs`; `work/bench_map_memory.cjs` → `map-memory.json`. **Headless model of map-owned bytes, not Chromium RSS.** Resident map MB before → after medium/high → after LOW: Ascent 1128 → 593 → 297, Bind 952 → 507 → 252, Breeze 1018 → 548 → 268, Haven 826 → 424 → 244, Lotus 554 → 271 → 164, Split 1068 → 558 → 281; geometry pack 81–138 ms per map | Real browser RSS before/after; AA-switch reload in a rendered page; constrained-device startup |
| fe89e08 | TDM transitions (row 7): tier unlocks by match time (120 s rifles/shotguns, 300 s snipers/MGs, same rule as server `weaponAllowed`) now also run online, with call-outs and live re-render of an open loadout; late joiners adopt the tier. Spawn protection 2 s ends when the protected unit attacks; SPAWN PROTECTED chip; online mirrors the server window. Respawn clears crouch/velocity/air; DM/TDM death text; online self-damage closes the loadout | `test_tdm_transitions.cjs` (fails on old code): client tiers = server for every weapon 0–570 s, one call-out per unlock, protection rules, chip, offline/online respawn | Rendered chip check; bots/allies ended protection only on a landed attack — fixed in bd76683 |
| 74a5da4 | FP weapon timing parity (row 5): native FP clips ran ~2.5× slow (24 fps keys for 60 fps sequences) for idle/fire/knife; durations now from each clip's SequenceLength, bolt/pump fire (Operator, Marshal, Bucky) fits the fire interval; equip/reload keep weapons.json times. Fire-rate multipliers match the server (×0.8 concussed, ×1.15 Empress; offline Empress was +30 %). Knife light swing 0.45 → 0.5 s (server 2/s) | `test_fp_timing.cjs` (fails on old code): 144 cadence cases = server formula, equip/reload/magazine = weapons.json, knife, native clip playback; `test_fp_native.cjs` agent change mid-match | Browser timing feel; knife heavy swing server parity — fixed in bd76683 |
| bd76683 | Spawn protection ends on every shot, hit or miss (bots, allies, legacy remote-human shots call `dmFired` on the shot; ability damage keeps it), same as the server's `fire()`. Knife heavy swing gets a server equivalent: `kh:1` input = 1 s cooldown, 75 body / 150 head or back (60° cone), lunge offline only | Server `test-weapons.js`; client `test_knife_heavy.cjs` (72 back-stab cone cases), `test_tdm_transitions.cjs` (fail on the old code) | Online feel of the heavy swing |
| 8da7b53 | AA switch on LOW lost the 256 px map texture cap (browser-found: Lotus textures 41 → 149 MB after the switch); custom sets remember their base preset (`vs.gqb`) | `test_map_memory.cjs`; browser after the fix: cap 256, 41 MB after the reload (`lotus-aa-on-after-reload-640x360.jpg`) | Constrained-device startup |
| 0aa4558 | DM/TDM leaderboard covered the credits/weapon/ammo block at 640x360 (browser-found); short screens get a compact board at bottom:100px. SPAWN PROTECTED chip seen centred under the crosshair in a running Ascent DM | `test_short_layout.cjs` (fails on the old code); before/after jpgs | Real phone |
| d005d53 (merge of `hark-combat` QA, 9bc5ba3…06caf56) | TDM/Spike rejoin restores the original team (9bc5ba3); fall recovery: units that fall off open map edges/seams or into the Breeze off-map pocket return to their last grounded nav spot (b91b739, c17bef7); bot unstick via probed escape + progress check, nearest free node below as fallback (4bc3c56, 0951a69); Spike: a loading player holds the buy phase ≤ 15 s (e1fa9dd); seat handover — a leaver's seat bot takes over the living body, rejoin gives up a dead bot first (f57f875); shared motor step 0.36 → 0.40 m so the Lotus 0.373 m riser is walkable (99f92a4); motor wall-climb fix — rising stops at geometry, support needs a footprint floor (1284d13: jump-into-wall scan 296 embedded → 0); orphan utility of leavers goes to the seat bot or a joiner, takeOver carries ult/status (7cc455c); slow-load keepalive — loads kept while progressing, 120 s stall / 10 min cap, server frames shape-checked by `netClean` (ce0a726); DM seat-takers get their own score row (648f270); gameplay soak harness (b91b739, bf6c3a0) and online page-vs-server client test (f939f7b) | Server `test-soak.js`, `test-reconnect.js`, `test-spike-edges.js`, `test-protocol.cjs`; client `test_client_online.cjs`, `test_stairs.cjs`; QA notes in `combat-notes.md` | Soak/leak work continues on `hark-combat` (not counted here) |
| 2964e6d | Corpses at very low frame rates (browser-found: SwiftShader ~0.4 fps) stood until the fade; any gap up to the 4 s corpse lifetime now advances on real time | `test_ragdoll.cjs` 0.3/0.4 fps cases (fail on the old code) | Rendered screenshot of a collapsed corpse |
| fe0a5ae | Row 3 traversal sweep: server `test-traversal.js` walks a unit like a human (yaw to the next A* waypoint, forward held, no jumping) with the shared motor from both spawns to every site on all six maps, plus buy-wall release and Bind's two teleporters (36 walks). Found and fixed: Haven C stairs rubber-band (fall guard probed one ray into a crack between stair meshes; now the capsule footprint) | `test-traversal.js` (fails on the old code) | Ascent A rim rescue and stairs hitch fixed in f73b01b |
| adf2af4 | Native Bind offline: bots were teleported by the blockout's legacy pad coordinates (ordinary floor on the native map); native maps use only the native pads | `test_native_teleport.cjs` (fails on the old code) | — |
| 7ec21a4 | Touch (row 7): Play in portrait from the rotate notice (remembered); portrait map pre-screen scrolls with GO sticky; portrait button layout and a `fit()` overlap/edge resolver for default layouts on any screen (arranged layouts kept, rotation re-fits); `relock()` skips coarse pointers so the touch stick and aim drag work | `test_touch_layout.cjs` (10 screen sizes); browser `browser_touch.cjs` → `touch-run1.json`, `touch-portrait-360x740.jpg`, `touch-landscape-740x360.jpg` (headless Chromium with touch emulation) | Real phone; portrait HUD fixed in 7f085d4 |
| 7f085d4 | Portrait HUD at 360x740 (browser-found): top bar measured 524 px (ran off both edges), minimap under the bar and subtitle, buy-phase team panel 10 px above the C/Q/E/X row, COMMS across the C button. Portrait block (max-width 480px): compact bar (alive counts without pips, x 46–314), subtitle on its own clipped line, minimap below it (y 64–160), kill feed below pause, team panel y 280–398 with 22 px rows, narrower COMMS. Touch FIRE in the action phase verified in Chromium (Classic magazine 12 → 11) | `test_touch_layout.cjs` portrait HUD geometry at 360x740 / 390x844 / 412x915 with the real `fit()` layout (fails on the old code); `browser_hud_portrait.cjs` → `touch-portrait-hud.json`, `touch-portrait-hud-before/after-360x740.jpg` | Real phone. The action phase was entered by ending the buy timer from the page (a natural 45 s buy phase did not run out within 180 s at SwiftShader frame rates) |
| 795e5d7 (merge of `hark-combat` QA pass 4: 7422bc0…5a88213) | Offline DM/TDM/Escalation spawn on the current map's nav graph (`dmPts` read the wrong key and fell back to Ascent call-outs, 0179fd6); map switch frees map textures, materials and call-out sprites (`xFreeMap`) and shares team-ring geometry (2eaf3b6); Lotus wall no longer a phantom gun hitbox after leaving Lotus (XLDH pruned, it held the freed map alive) and a shared aim-target capsule (822d7c6); deterministic seeded online client fight (7422bc0); page harness and offline-modes soak | Client `test_client_lifecycle.cjs` (now in the default suite), `test_client_offline_soak.cjs`; `combat-notes.md` pass 4 | Leak/soak work continues on `hark-combat` |
| f73b01b | Ascent A stairs hitch: the defender walk to A cut the open west side of the stairs (no collision past x 42.75, 8 m pit) with the capsule centre over the pit; the motor measured each riser from the pit floor and refused it, so the capsule pressed into the riser corner and was unwedged twice (~0.5 m) and rescued once. The shared motor's `floorNear` now also counts the footprint tread under the capsule rim (floors at or below the feet only) | `test-traversal.js`: whitelist removed, every walk must finish with no unwedge and no rescue (fails on the old motor); defender → A 12.75 s → 11.3 s; `eval-stairs.mjs` unchanged (1698/1704 rising edges, 0 big drops) | The rim itself is still open collision (a player can still step off into the pit; the fall guard returns them) |
| a59cc0b | Offline game time on the real clock (browser-found: at SwiftShader frame rates a 45 s buy phase did not end within 180 s). Each frame's real elapsed time is split into ≤50 ms simulation steps (mode tick, buy/round clocks, Spike fuse, plant/defuse, DM respawn, bots, ability timers); hidden-tab return counts one step, a stalled frame at most 2.5 s; online keeps one capped step per frame (server owns the clocks) | `test_offline_realtime.cjs` at 1/5/20 fps through the real page's rAF loop (±3 %; fails on the old loop) | Natural buy phase now ends in the browser, but frames slower than the 2.5 s stall cap still lose time (seen: 39 s of buy took 70 s at <0.3 fps) |
| 32c2686 | Touch Spike plant/defuse verified end to end on the on-screen 4 button (hold, early release, pointercancel/lostpointercapture reset, 3.5 s defuse checkpoint); defect fixed: the 4 button showed in DM/TDM/Escalation where there is no Spike | `test_touch_spike.cjs` (coarse-pointer page harness, real pointer events; fails on the old code for the hidden button); headless Chromium touch emulation at Ascent 740x360 planted and defused, `touch-spike-planting-740x360.jpg` | Real phone |
| 4e822e5 | Ascent A ramp pit (x 37–43, z −25.2…−22.2, no floor below) closed by an invisible movement-only clip in the shared motor (`CLIPS`/`clipBlocked`, one definition for server world and client `nmBlocked`); rays, sight, shots and floor probes ignore clips | `test-traversal.js` drives a unit at the hole from seven sides (fails on the old world); `test_player_clips.cjs`; `eval-stairs.mjs` 1697/1703 rising edges, 0 big drops | Rendered check of the clip edge in a running match |
| 67f38da (merge of `hark-combat` 8698c58) | Online Chamber: Headhunter (Q) reaches the server (clicks fired the held gun before); Tour de Force keeps its Operator (round state no longer re-applies the saved loadout over the server-swapped gun); `rs.tw` names a server-swapped gun. Ability coverage tests for every agent × C/Q/E/X offline and online | `test_client_abilities.cjs`, `test_client_online_abilities.cjs` (page charges/ult equal the server's) | Browser visuals of each ability |
| 62c29e5 | Online Spike economy/overtime (row 11, **local `ENABLE_SPIKE` only**): plant bonus +300 to every attacker (was the planter only); overtime from round 25 swaps sides every round with 5000 credits each and loss streaks reset, win by two | `test-spike-accept.js` (in `npm test`): real worker module in-process on a virtual clock with two protocol clients — release gate, buy/sell, human plant/defuse with checkpoint, late join, detonation and round credits, leave/rejoin seat handover, half-time swap, overtime and match end (fails on the old `spike.js`) | Rendered two-client Spike round; production release not authorised — Spike stays gated |
| 4d09aa8 | Offline stall cap 4 s with a 250 ms bounded catch-up: a frame's simulation steps stop after 250 ms of compute and the remainder carries as `XRT.debt` (total still capped at 4 s), so slow software-rendered frames keep real time without a spiral (2.5 s with no carry lost time: a 39 s buy phase took 70 s at <0.3 fps). Online stall-not-silence: `mpNet` discounts a >2 s main-thread stall (visible tab) from the silence clocks, so a long frame no longer disconnects the page after 10 s | `test_offline_realtime.cjs` (cap, carry, bounded compute), `test_net_stall.cjs` (stall kept, real silence still drops) | Real slow-device timing; hidden-tab throttling keeps the old rule |
| 8344d0d | Local QA bridge `server/tools/browser-bridge.mjs` (real worker module on a real port, `/__qa` hook, lockstep for software rendering) and `work/browser_online_spike.cjs`. `test-release-gate.cjs` now asserts production `wrangler.jsonc` sets no `ENABLE_SPIKE` / `ALLOW_LOCAL_ORIGIN`, `src/` never imports `tools/`, and tools are not deployed assets | release-gate test; online Spike browser pass below | Local tool only, never deployed |
| c9cb6be (merge of `hark-combat` QA pass 5: fc33895…ac0372a) | Online F/G/R handlers on `window` (rebound pick-up/drop/reload reach the server), online bought cards sellable (server `bo` carries the round purchase list), settings persist across reload (aim assist, crosshair, hit markers, damage numbers, custom graphics set), kill feed names the gun in hand, a finished online room offers Leave room; buy-phase G drops the held gun for a teammate; remote `ac` with an `Object.prototype` agent key no longer throws | `test_client_online_rebind.cjs`, `test_client_online_buy.cjs`, `test_client_settings.cjs`, `test_client_results.cjs`, `test_client_fuzz.cjs` (from `hark-combat`) | Rendered two-client checks of each |
| 13cbb3e | Planted Spike replaces the round clock (browser-found online at 640x360: clock kept counting, Spike icon never shown, `xSpOn` false). Root cause: the swap was gated on the legacy `#timer`'s client rects, and `#timer` is `display:none!important` in the current HUD, so it never fired (offline too). The visible top-bar clock `#xTm` now takes `.x-spk` (pulsing Spike icon in the clock slot), cleared at round end | `test_online_spike_hud.cjs` (page on the in-process worker, local `ENABLE_SPIKE`: server plant → `#xTm.x-spk`, round end → clock back; fails on the old gate); offline Chromium 640x360 render `hud-spike-planted-subtitle-640x360.jpg` shows the icon in the clock slot | Rendered **online** re-run of the post-plant icon (the online pass predates the fix) |
| cdf12e3 | 640x360 HUD: the mode/map subtitle (`#xSub`) ran under the minimap. Short landscape rules (≤820 px and ≤700 px, landscape only) bound it between the minimap columns (nowrap, ellipsis, 8 px clear of the 120/174 px minimap edge); portrait keeps its own rule | `test_short_layout.cjs` (d): bounds clear the minimap at both bands and the touch minimap, cascade order, no later override; Chromium 640x360 render: subtitle 140–500 px vs minimap 8–120 px | Kill feed (top 48 px, right) can still share the subtitle's row when several kills stack; not changed here (kill feed is `hark-combat`'s area) |

### Browser findings this pass (headless Chromium, 640x360, Lotus, often ~1 fps alongside the combat soak)

- Lotus stairs: walked up without jumping — **pass**.
- Spectate: third-person button clickable, camera at the target's floor height — **pass** (after b562314).
- Floor pick-up: the `[F] Pick up` prompt shows; during the buy phase F did nothing → fixed in 13fdfd6; after the fix a buy-phase swap on Lotus passed (Classic → Frenzy, Classic left on the floor; evidence jpgs).
- Ragdoll: corpses stood upright until the fade → fixed in ebd0ca4; collapse confirmed by live page numbers, **no rendered screenshot yet**. Three capture attempts after the fix failed (corpse faded before the frame under load; one frame showed an upright figure that could not be confirmed as the corpse; Chromium then OOM-killed at 4.5 GB RSS alongside the combat climb runs). Recorded and skipped.
- Chromium was OOM-killed repeatedly while the `hark-combat` soak ran; browser coverage is therefore partial.
- Real Chromium memory (process-tree RSS, MEDIUM, 640x360, `browser-memory.json`), before b515533 → after: Lotus ~2430 → ~2100–2285 MB (JS heap 415 → 290 MB), Ascent ~3100–3160 → ~2330–2590 MB (JS heap 468 → 290 MB). The AA-switch reload's RSS effect is **not established** (only texture bytes were measured: 41 MB with the cap kept, 8da7b53).

### Online Spike browser pass (sixth pass: headless Chromium 640x360, page on `browser-bridge.mjs`, local `ENABLE_SPIKE` only, ~0.06 fps software rendering, bridge in lockstep)

- Online 5v5 Ascent room created and started; buy phase and credits shown — **pass**.
- Carrier placed in A, hold 4: plant bar progresses, server plants, `SPIKE PLANTED` banner, +300 to all five attackers (1100/700×4) — **pass**.
- Post-plant HUD: round clock kept counting and the Spike icon never appeared — **fail → fixed in 13cbb3e** (headless page test + offline render; online rendered re-run still to do).
- 45 s detonation decides the round; round credits — **pass**. Half-time side swap to round 13 at 800 — **pass**.
- Defender beside a planted Spike: defuse prompt, hold 4 past the 3.5 s half checkpoint, defuse completes (`ROUND 2 · SPIKE DEFUSED`, score 2–0) — **pass**. The planned release-at-the-checkpoint step was overtaken (the defuse finished during a ~45 s software-rendered screenshot), so an interrupted defuse is covered by the server/headless tests only; the script's final wait then lost the browser context.
- Long software-rendered frames: before 4d09aa8 the page could be dropped for silence after a 10 s stall; the run above completed connected with the stall fix.
- 640x360 subtitle ran under the minimap — **fail → fixed** (see the table).

## Implemented in this working tree (before the `hark` branch)

- Map loading: real asset-count progress; a working Cancel control; immediate rejection on cancellation or a 120-second timeout; abortable metadata/collision fetches; disposal of scene/collision siblings that complete after cancellation or failure; close decoded ImageBitmaps when disposing maps. Superseding a load does not cancel the new match-loading screen.
- Multiplayer startup: the legacy watcher recognizes the error-specific Back control, waits for the native scene and loading screen to finish, and stops watching abandoned sessions. The client refreshes its silence clock on readiness; the server gives loading sessions the existing 180-second loading window instead of applying the 15-second active-session timeout during decode.
- Map selection: private room creation and quick matchmaking honor the queue map tile. Random remains a supported selection. A normal Lotus selection was verified to create an online Lotus room.
- Reyna: server-owned, owned/nearby/unexpired soul orbs from weapon and ability kills; shared Devour/Dismiss charges; project-defined +50 HP Devour, temporary overheal and expiry; Dismiss immunity and attack rejection; Empress activation, kill healing and free soul casts; death/round reset. Private state drives online orb meshes, buffs and HUD without speculative local healing or charges.
- Jett: server-owned Blade Storm activation, five knives, accurate throws while airborne, cadence, damage, kill refill, gun inventory preservation, exhaustion and death reset. Online throws send intent, not target/damage claims. The internal ability weapon cannot be selected in DM.
- Spike: moving, firing, airborne, loading, stale, teleporting or dismissed actors cannot continue plant/defuse progress; half-defuse checkpoints survive interruption; changing defusers discards progress beyond the checkpoint; buy/end-phase shots reject.
- Leaving/rejoining: a departed active player is replaced by a bot while other sessions remain; duplicate disconnects are ignored; completed records sum the human's departed and rejoined sessions once per browser identity, without crediting replacement-bot kills.
- Release configuration: Spike is disabled by default and requires explicit `ENABLE_SPIKE=true`. Loopback browser origins require `ALLOW_LOCAL_ORIGIN=true`. Both flags are provided by the local dev command; production must keep the local-origin flag unset.
- Repeatable client suite: `npm run test:client` from `server/` runs all client regression files from the correct repository directory.

## Verification

- Generated all six prebuilt collision worlds from original assets.
- At the tip of this pass all 27 default server regression files pass (`npm test`) and all 69 client regression files pass (`npm run test:client`). (Earlier passes: 27 server / 63 client, 26 server / 58 client, 26 server / 56 client before the pass-4 merge, 24 server / 51 client, 17 server / 35 client.) The client suite covers native contact/locomotion samples, loading/cancellation, renderer rebinding, identity/profile, maps, intents and new ability/HUD checks.
- Regenerating `index.html` with `python3 work/install_valorant.py` is byte-identical; `git diff --check` passes.
- Browser: all six original maps reached normal rendered matches. Ascent → Bind → Haven → Split → Breeze switched in one session without a page reload; Lotus also progressed to a later offline round. Saved and inspected the five map-start images and two online Lotus images. This establishes local launch/render coverage, not complete traversal or low-memory performance.
- Browser: cancelled a normal Breeze load and immediately returned to the lobby.
- Browser: two separately rendered clients joined the same local authoritative Lotus TDM room, loaded the original scene, remained connected, and received live scores. Exercised movement and shooting in both; opened the integrated loadout, observed locked tiers and equipped Ghost. Screenshots are in `work/validation/`.
- Longer rendered multiplayer run: clients later disconnected while backgrounded during separate map testing; the exact transport cause was not established. Natural finish, saved browser results and sustained/reconnect acceptance have **not passed**. Added reason-specific idle/restart messages and close metadata for diagnosis, and removed the stale online HUD after disconnect.
- Browser observations are partial acceptance, not evidence that every route, human-to-human hit, mobile control or natural completed result has passed.

## Full original checklist still requiring sign-off

| # | Handoff area | Remaining acceptance |
|---|---|---|
| 1 | Full-map startup | Repeat cold load/error/retry on constrained devices; establish startup/decode/memory timings. Local all-six startup success does not resolve the previously reported crash in every environment. GLTFLoader image/body work already in flight is disposed on completion; it is not fully network-abortable. |
| 2 | Two-player acceptance | Finish natural match, human-to-human hit/kill/death/respawn, reconnect/leave and persisted-record checks in rendered clients. |
| 3 | Six original maps | Source traversal covered: `test-traversal.js` walks spawn → every site for both teams on all six maps with the shared motor, checks buy-wall release and Bind's teleporters (fe0a5ae; Haven C stairs; native Bind pads adf2af4; Ascent A stairs hitch f73b01b) and the Ascent A pit is now closed by a movement clip (4e822e5) — 43 walks, no unwedge and no rescue. **Not signed off**: no rendered inspection of every map (spawns, stairs, low cover, walls, doors, allies, later rounds); the clip was measured from the collision mesh, not seen in a running match. Source traversal is not a visual sign-off. |
| 4 | Third-person rifle pose | Procedural two-handed grip landed (3f5889a) and is regression-measured across weapon classes, stances and pitch. Still open: browser sign-off in motion (sprint/jump/strafe), online remote players, costume clipping. |
| 5 | First-person weapons | Native FP rig is the sole arm source with authored fingers/equip/fire/reload/inspect for every weapon and knife (8a409eb); primitive arms no longer flash during load. Still open: browser sign-off of quality switches, reload/equip/fire timing feel, agent changes and crowded combat. |
| 6 | Feet/terrain/AI | Complete live slopes/stairs/aim/transition and multiple-agent traversal checks. |
| 7 | TDM/mobile | Tier unlocks by match time online/offline, spawn protection (ends on any shot) and respawn transitions landed (fe89e08, bd76683) with regressions. Touch: portrait play, button layouts without overlap, touch stick/aim (7ec21a4), held Use (1ba3773), portrait HUD at 360x740 and touch FIRE (7f085d4), Spike plant/defuse by the touch 4 button (headless page + headless Chromium touch emulation, 32c2686; button hidden outside Spike). **Not signed off**: everything touch was checked in emulation only — no real phone; 390x844 / 412x915 portrait covered by the geometry test only; touch Spike was offline (online touch plant/defuse not rendered). |
| 8 | Minimap/selection | Room-map selection and cancel defects fixed; still inspect running-match orientation/visibility/markers on all six maps, mobile and Omen targeting. |
| 9 | Remaining abilities | Server-authoritative now: Reyna, Blade Storm, all eight non-Reyna/Jett ults (9712016) and the device set in 37a90be/23f3bf7, with Curveball direction online and offline. Values are interpreted from public descriptions and the project's rules, **not datamined**. Still open: browser/visual acceptance of each ult and device, integrated Spike visual acceptance, agents/abilities outside these kits, and the offline (non-server) versions of the device changes where they differ. |
| 10 | Combat consistency | Landed via the `hark-combat` merge (2ee6a50): pose-following server hit volumes from the real rigs, official wall-penetration tiers, render-matched smoke/LOS for bot sight, flash LOS/facing, server-owned statuses (Vulnerable/tether now shown online, b256a56), native crouch render matching the head volume. Still open: upper-body aim pitch and strafe hip yaw in hit volumes, comprehensive projectile/device interaction coverage, and rendered two-client verification of hits through walls/smokes. |
| 11 | Spike release gate | **No production Spike release.** Spike remains disabled unless `ENABLE_SPIKE=true` (set only by the local dev command); production keeps it off and keeps `ALLOW_LOCAL_ORIGIN` unset. Local acceptance only: `test-spike-accept.js` (62c29e5) runs the real worker in-process with two protocol clients through gate, buy/sell/economy, plant (+300 team bonus) and defuse with checkpoint, detonation, late join, leave/rejoin seat handover, half time, overtime (5000, swap every round, win by two) and match end; plant/defuse interaction guards and touch plant/defuse (offline) covered earlier. Sixth pass: one rendered page (headless Chromium 640x360, local bridge, bots held still) played plant → detonation → half time → defuse (pass list above); the post-plant clock/icon defect it found is fixed (13cbb3e) but not yet re-run online. Still open before any release decision: a rendered online re-run of the post-plant icon, a rendered interrupted (checkpoint) defuse, a rendered two-client Spike round in browsers, ability use inside Spike rounds, and an explicit owner decision to enable it. |
| 12 | Reliability/performance | Loading lifetime and result-accounting defects fixed; still profile resource peaks, crowded combat, reconnects, concurrent rooms and Free-plan headroom. No billing changes authorized or made. |
| 13 | Final release | Source suites pass; full visual/mobile/performance gates and deployment verification remain. Work is pushed only to the `hark` branch; nothing merged to main and no production deployment performed. |

## Local commands

From `server/`: `npm ci`, `npm run build:worlds`, `npm test`, `npm run test:client`, then `npm run dev`.
From the repository root in a second terminal: `python3 -m http.server 8876 --bind 127.0.0.1`.
Open `http://127.0.0.1:8876/`; localhost clients use the local game service on port 8787. Local dev intentionally enables the Spike prototype for QA. These instructions do not change production mode availability.

## Breeze TDM ally stall (fixed, 5:12 AM)
- Symptom: TDM allies parked at breeze west edge (-71,7,1) for the whole match, blk=1, npT=0.4 refreshing every tick.
- Root cause: dmGo() runs TDM/DM as mode="five" with FV.dm set, so the ally hunt branch `mode !== "five"` never fired; gx,gz defaulted to the spawn anchor (a.ox/a.oz), and the xGoal wrapper returned null (no spike) so nothing replaced it. Bots pathed back toward their own spawn and parked on the first unreachable hop.
- Also resolved the earlier np-matches-native-node mystery: xPath IS wrapped for native maps (index.html:12791, nmNext over native nav); npT=0.4 (not 1.5) proved the wrapper was live. So the gNav fixes do not route native-map bots; nmNext does.
- Fix: hunt branch now `mode !== "five" || FV.dm`; the five-mode xGoal override is now guarded `!FV.dm` (matching the existing enemy-bot pattern at :4259).
- Evidence: diag-stall2.cjs (new, committed) traced stalled units pre-fix (ng=(-74,-1.8)=spawn anchor while xNb=(-31,-29)); post-fix 70s breeze TDM shows zero units still 5s+. 40 client suites green.

## Residual TDM ally stall (OPEN, narrowed 5:20 AM)
- Post-fix breeze TDM soak: combat now happens (8 deaths / 8 respawns in 84s vs 0 pre-fix), 3 of 4 allies hunt. One residual: Skye stationary 16s, engaged=false, at (-67.9,-19.1) — the same coordinates as a PRE-fix parked spot.
- diag-stall3.cjs (committed) dumps full scalar state + live nav for any still ally. First catch was a different, LEGIT case: Omen holding combat stance (see=7.91, trT=4, path to goal exists pl=117, both endpoints playable) — not a bug, harness excludes engaged units.
- Two candidate causes for the residual !tg stall: (a) nmNext returns [p.x,p.z] when nmPath is empty and xUn does not fire on zero velocity (no motion intent), parking the unit forever; (b) nmNext never segment-checks path[1] (skip-ahead loop starts at i=2), so an off-mesh first hop into a wall corner sets blk=1 in a re-plan loop with xUn's nearby-waypoint rescue insufficient.
- Next probe: rerun diag-stall3 until it catches an engaged=false stall (need np, ng, nav.pl, adj for that exact case), then fix the matching branch.

## Ledger audit + residual stall FIXED (5:26 AM)
- AUDIT (per parent): commit 54f8925's "TDM ally hunt goal" was INERT until 6cf5be9 — gated on `mode !== "five"` while dmGo() sets mode="five" for TDM/DM, so it never fired in any mode it targeted. Its soak "pass" was enemies walking to parked allies, not ally hunting.
- AUDIT: commits 54f8925 (gNav best-effort A*) and db0dd5f (y-aware gNav attach) patch the LEGACY routing path only. Native maps route through the xPath wrapper (index.html:12791) -> nmNext/nmPath/nmNear, so neither commit affects native-map bot movement; earlier native soak improvements attributed to them are insufficient causal evidence.
- RESIDUAL STALL ROOT CAUSE (verified by diag-stall3 catch, Sage tg=false): valid 99-node path existed (s=891, e=5335, both playable) — but the assigned waypoint path[1] sat 0.95 u away behind a wall corner, unreachable from her off-mesh position; blk=1 re-plan every 0.4 s re-targeted the same node; xUn fired (motion intent nonzero) but its re-path returned the same node.
- FIX: nmNext now nmSegment-validates every hop from the unit's actual position (loop from i=1, was seeded unchecked at path[1]), targets the farthest clear node, and when NO hop clears it steers at the goal itself so collision sliding + xUn re-approach. Edit lives in work/native_maps_runtime.js; index.html regenerated and idempotence-verified.
- REGRESSION: work/test_tdm_native_routing.cjs — behavioral vm test of spliced nmNext (blocked first hop skipped, all-hops-blocked steers at goal never [p.x,p.z], no-path holds, 10-node cap) + source pins for the FV.dm hunt branch and !FV.dm goal guards. 41/41 client suites green.
- VERIFIED: breeze tdm-soak PASS (12 deaths / 10 respawns in 84 s, zero issues, game-rate 1.00x wall); diag-stall3 80 s breeze trace caught zero engaged=false stalls.

## Same stall class on haven (OPEN, 5:28 AM)
- haven tdm-soak FAIL post-nmNext-fix: Breach stationary 16s, engaged=false, at (33.6,-38.8), t=550 (early match). Breeze is clean; the class persists on at least one other map, cause for the haven instance not yet captured (diag-stall3 now takes MAP env for the next probe).
- Next: MAP=haven diag-stall3 until the engaged=false stall is caught with live nav state; check whether haven's case is the same unchecked-hop shape or a distinct one (e.g. nmNear y-misattach at spawn, e < 0, or s on a playable-but-locally-walled node).

## Haven stall root cause + fix (5:36 AM)
- diag-stall3 MAP=haven caught it (Omen AND Raze at (33.6,-38.8)): waypoint 0.54u away, path EXISTS (pl=132), blk=0, spd=0, fs=-7.15 (zero velocity 7s+), usT=0.02 (xUn only tickling on jitter). Distinct from breeze: nothing blocked them - they had ARRIVED.
- Root cause: planner/motor threshold deadlock. The xPath wrapper re-plans on dist(np,p) < 0.55 ("not arrived"); the motor only walks when sd > 0.5 ("arrived, stop"). nmNext returned the node the unit stood on, sd settled at ~0.5-0.54, every re-plan re-targeted the same reached node: stable equilibrium, zero velocity forever.
- Fix: nmNext skips path nodes within 0.8u of the unit when choosing a target (a reached node is never a waypoint); with no clear hop beyond 0.8u it steers at the goal (same fallback as the blocked-hop case).
- Regression extended: work/test_tdm_native_routing.cjs pins "stands-on node skipped" and "reached-range only -> goal steer".
- VERIFIED: haven tdm-soak PASS (12 deaths / 12 respawns, zero issues); breeze tdm-soak PASS (12/11) - no cross-map regression. 41/41 client suites green.

## Ascent + split stalls root-caused and fixed; TDM soak green on ALL SIX maps (5:57 AM)
- ASCENT (Cypher, y=9.1 balcony, path alive pl=73, goal-steer grinding): nmSegment rejects descents >0.35u, so graph edges across ledges - traversable by falling - were untargetable. Fix: nmSegDrop (nmSegment without the descent rejection) applied ONLY to the first graph edge; skip-ahead past it stays strict (never cuts corners across open drops).
- SPLIT (Breach + Jett at west spawn, path alive pl=51, goal-steer blk=1 under xUn step-backs): units pushed off their node's corridor by combat movement; every hop failed from off-corridor ground and goal-steer ground walls. Fix: with no clear hop and the unit >0.6u from its nearest node, nmNext steers back onto that mesh node first (graph edges are walkable FROM the node).
- Regression extended: ledge-drop edge taken exactly; walled first hop skipped; off-corridor recovery targets the nearest node.
- FULL SWEEP VERIFIED: tdm-soak PASS on all six native maps - breeze 12/11, haven 12/12, ascent 11/11, bind clean, split 18/16, lotus 15/15 (deaths/respawns), zero stall issues, game-rate 1.00x wall everywhere. 41/41 client suites green.

## Scope/language corrections (per parent, 5:59 AM)
- Soak results are "no stalls observed in these sampled runs", never proof the entire stall class is closed. Each fix is pinned to its caught mechanism with a behavioral regression.
- Nav fragmentation remains OPEN as topology: nmConnected's largest-component "playable" set is the CURRENT IMPLEMENTATION, not validated design intent. Valid named intended areas (bind B Short 1113 nodes, B Teleporter 28, breeze Attacker Side Spawn 452, ascent B Site, per the fence-v2 inventory) remain unreachable from the fragmented graph. The recovery changes (nmSegDrop first-edge descent, return-to-mesh steering) do not resolve this; they must also not create traversal exploits or trap routes - verified so far only by the six-map TDM sweeps (no units stranded post-drop, no stalls) and the behavioral regression pins.

## Five-mode breeze attacker stall (OPEN, 6:03 AM)
- five-soak breeze FAIL: all 4 ATTACKING allies stationary 16s+ at the west spawn edge (-72..-74, 0 +/- 2), t=63-65 mid-round.
- diag-stall5.cjs (committed, five-mode tracer) first catch was a LEGIT post-plant hold (spike planted at (41.5,-25.6), fs -6s, path alive): post-plant attackers holding site is correct; tracer now exempts xg0 === 'plant' like the soak.
- The soak-flagged west-edge case remains UNCAUGHT: next wake reruns MAP=breeze diag-stall5 until it catches an attacking stall with xg0 !== 'plant' (watch whether the goal is the carrier's own position, i.e. xGoal returning spike-carrier coordinates).

## Five-mode attacker stall root cause + fix (6:13 AM)
- Root cause (fully traced): the meta site anchors sit at the very EDGE of their plant zones (breeze B anchor (-74,-1.75) is 0.15u inside a zone spanning z -17.1..-1.6; A anchor 5.6u off-center). The carrier's goal was the anchor; the 0.5u movement arrival floor plus escort crowding left him OUTSIDE the razor-thin zone edge (verified: (-73.8,-1.6) projects outside the B rows), so inSite() never fired, s.pt never climbed, and the whole attacking team parked at the site edge (the soak's all-four-stationary at (-72..-74, 0)).
- Fix: nmSiteGoals() at native map build precomputes an in-zone goal per site (zone centroid inverse-projected through the map's own apiProjection, snapped to a playable nav node, verified in-zone via nmPlant; first-cell fallback, then meta-anchor fallback). The xGoal wrapper sends ATTACKERS to C.siteGoals[name]; defenders/post-plant logic untouched.
- Verified LIVE (diag-plant.cjs, committed): breeze siteGoals B=[-78.5,-12.25] A=[25,-28.75] both in-zone; carrier teleported to the B goal plants in 4s (pt 1..4 -> st "plant"). Breeze five-soak PASS x2 (elimination + clock-end rounds, no stalls).
- Regression: work/test_native_site_goals.cjs (behavioral: centroid snap, in-zone verification, rowless-site fallback + wrapper source pins). 42/42 client suites green.
- Note: escorts waiting at site for a slow carrier remain flaggable by five-soak's 16s rule when the carrier genuinely parks - but the carrier parking was the defect just fixed; watching for residual false positives in the sweep.

## Split five-mode stall -> nav-data defect class: trap nodes (OPEN, 6:31 AM)
- diag-stall5 MAP=split caught the carrier + 2 escorts at (-46,6.6,2.6) goal-steering into a wall, xUn cycling, path "alive" (pl=32) per the graph.
- diag-edges.cjs (committed): node 741 (-46.25,6.62,2.5) has adj=6 in the graph, but ALL SIX edges fail the capsule walkability check (nmBlocked at body height, both r=0.43 and r=0.45) within 0.2-0.3u of the node. Control: 6 random playable nodes have 0 bad edges. It is a POCKET: units can drop/be placed in (nmPlace validates the node point + graph path, not edges) but can never walk out.
- Root: the nav builder's adjacency was not validated against the runtime capsule collision model, so nmPath (pure graph A*) routes through untraversable edges. Not fixable by steering recovery - prevention required.
- Plan (next wake): full-map edge audit (count trap nodes + failing edges per map), then prune invalid edges at build time (preferred; check the builder) or at map load before nmConnected, regenerate/re-verify, re-run five-soak split + full sweep. Also make nmPlace reject nodes with zero walkable exit edges.

## Nav edge audit (split, full map, motor-equivalent) - 06:48 EDT
Full-map audit of every playable directed edge (55,594) with the motor's own semantics
(capsule r=0.45, foot +0.32, rise 0.321, drop-tolerant when total dh < -0.35, chord OR
axis-split L-path acceptance, matching the motor's x-then-z slide):
- 243/55,594 directed edges (0.44%) are not traversable by any 0.45-radius unit.
- 6 trap nodes (zero walkable exit): 5 in the west pocket around (-47,6.6,0), 1 at (4.8,9.5,7).
- Simulated prune: 7,803 playable -> largest component 7,505; 15 fragments split off
  [249, 25, 7, 5, 2, +10 singletons]; attacker->defender and attacker->A/B sites preserved.
- The 249-node fragment is the "A Sewer" callout region. Its ONLY graph articulation to the
  main component is trap node 741 (-46.25,6.62,2.5); all 12 cut edges cross at that node and
  fail `blocked` at z~2.5 (a doorway the builder's center ray at +0.85 cleared but a capsule
  cannot). Re-running the audit at the PLAYER's motor radius (0.4) loses the same region
  (250-node fragment): A Sewer is de-facto unreachable for players too in the current build.
  It stays on the open intended-space list (bind B Short/B Teleporter, breeze Attacker Spawn,
  ascent B Site islands, now split A Sewer): named space the imported collision does not let
  any unit enter. Nav-data repair requires the Blender builder, unavailable in this sandbox.
- Axis-split acceptance changed edge count (362->243) but not the fragment structure.
- In-page audit cost 2.2s per radius on split -> prune must be baked into navigation.json
  (bad-edge list exported per map, stripped offline), not run at load.
Planned bake: export bad-edge pairs per map (all six), strip from
server/public/worlds/*/navigation.json + models/valorant/maps/*/navigation.json, keep
nmConnected after; trap nodes then fall out of playable automatically. nmPlace zero-exit
guard becomes redundant for these nodes but is still worth adding for robustness.

## Doorway probe (split A-Sewer articulation, -46.5,2.5) - 06:53 EDT
Vertical capsule profile at the cut point: blocked y 6.6-6.9, free 7.0+ with a 0.6u probe
capsule -> a ~0.4u step/ledge at the doorway (floor 6.6 channel vs 7.0 surroundings; adjacent
nodes sit at y=7.0). 0.4u exceeds the motor's 0.321u climb limit, so walking units cannot
pass; a JUMP (or assisted step) might - untested, human jump/step dynamics differ from the
walk capsule per parent guidance. The horizontal grid probe was flawed (forced floor
reference 6.6 reports the whole 7.0-floor surround as blocked); needs a per-point floor
reference next run. Repair-vs-prune still open: if the only obstruction is one 0.4u step, a
hand-authored nav connector (navigation.json is editable JSON, no Blender needed) could be
tested against the real motor (jump-assisted traversal check) before accepting the isolation.
Split bad-edge list exported: work/nav-prune/split-bad-edges.json (243 directed edges).

## All-map bad-edge export progress - 06:58 EDT
Exported (work/nav-prune/<map>-bad-edges.json), simulated-prune measurements:
- split: 243 bad / 55,594; largest 7,505/7,803; defOK true; sites OK; loses "A Sewer"
  (250-node region isolated at a 0.4u step - repair candidate, see doorway probe).
- breeze: 328 bad; largest 11,587; defOK FALSE; loses "Defender Side Spawn" (64-node
  fragment). BAKE BLOCKED pending articulation analysis: defender spawn anchor may itself
  sit in the fragment, i.e. defenders may be spawn-trapped TODAY (breeze five-soak passes
  are consistent with attackers planting unopposed - needs a defender-movement trace).
  Do NOT bake breeze until spawn reachability is verified and, if real, a connector repair
  is attempted.
- haven: 188 bad; largest 8,142; defOK true; A/B/C sites OK; no callouts lost; fragments
  all <=2 nodes. Safe bake candidate.
- ascent, bind, lotus: export still owed.
Bake rule (parent): apply only where before/after intended-area connectivity and spawn/site
reachability are preserved; regions cut by pruning stay open as intended-space defects, no
fencing/OOB changes.

## Stall breaker + nmPlace trap guard (1ff0a4c + test) - 07:22 EDT
Root cause of the recurring park-forever stalls: nmNext re-plans every 0.4s, but A* + route
cache deterministically re-serve the same untraversable first hop, and xUn goal-steer alone
cannot clear geometry. Fix (runtime, no nav-data mutation): a directed edge whose first hop
fails nmSegment AND nmSegDrop three consecutive re-plans is blacklisted PER UNIT and nmPath
re-plans around it (uncached while bans are active). nmPlace additionally rejects candidates
with zero traversable exit edges (trap nodes) and resets the blacklist on placement.
Why no static bake yet: the sweep model is stricter than the live motor - breeze defenders
descend a spawn ledge the sweep calls impassable (4/5 left spawn, moved 11-42u, live trace),
and baking there would disconnect Defender Side Spawn for real. Exported bad-edge lists stay
in work/nav-prune/ pending per-edge live corroboration. A Sewer (split) remains an open
intended-space defect (0.4u step; jump-range repair candidate).
Verification: 42/42 client suites (extended test_tdm_native_routing.cjs pins the blacklist
trigger, reset, nmPath ban plumbing, and the nmPlace guard); split five-soak PASS (previous
FAIL from the node-741 pocket; one sampled run, no stalls observed, round completed by
attacker wipe - combat outcome, not a stall).
Owed: ascent/bind/lotus exports, lotus five-soak, full sweep re-run, natural push/plant
evidence on split.

- lotus five-soak PASS (first lotus run; no stalls observed in this sampled run; round ended by attacker wipe)

## Under-bridge anchor defect + level-banded routing (3fa04b7) - 07:47 EDT
Breeze B-approach stall root-caused (distinct from trap nodes): the four attackers parked at
y=7.0 on the B-main lower road while nmNear anchored them to the upper walkway at y=7.45
(0.85 u horizontal beats the lower road's nodes after the 2x y-weight). Every re-plan aimed
0.45 u up an unclimbable face; validation + motor streaks reset on unstick wiggle (<0.75 u),
so bans never triggered. Fixes: nmNear takes an optional level band (|dy|<=0.35, walkable
step range) used for nmNext's start anchor with plain-nearest fallback; motor no-progress
streaks now only reset on a real advance (>=0.75 u). 42/42 client suites.
Six-map five-soak sweep, all PASS, no stalls observed in these sampled runs: breeze, haven,
ascent, bind (this round) + split, lotus (previous). Rounds ended by combat/timer; natural
push/plant was NOT observed this sweep (attackers wiped) - still owed.

## A Sewer anatomy resolved + repair path (split) - 07:56 EDT
Under the descent-kept prune, "A Sewer" = 249-node region x 6.3..40.8, y 3.0..8.5, z 10.8..21.3
(the long east channel, descending to y=3; the (-46,2.5) grate area connects to main via kept
drop edges - drop-in only, no walk-out; nmPlace guard + stall breaker cover it).
The sewer's ONLY original links to the main component: flat edges at the west end
(x 5.5-6.3, y 8.5, z 13-14.5). Doorway characterization: the entrance is crossed by a row of
thin posts (railing/balusters, ~0.4-0.6 u gaps - impassable to a 0.45-radius capsule on the
node-row chords), BUT fully clear standing lanes exist between node rows (z=13.1, 13.7, 14.3,
14.9; vertical profile clear 8.5-10.8). Repair path (next): in-page connector builder - sweep
capsule-valid lanes across the gate, insert verified waypoint node(s) + edges into
navigation.json (bake-time, browser-verified), re-audit until A Sewer rejoins the main
component honestly. No geometry edits; no fencing.
Correction to prior wording: natural push->plant evidence DOES exist (haven five-soak, C site,
earlier session); warp-plant was only the breeze-B targeted check. More natural samples owed.

## A Sewer REPAIRED + drain-slot trap quarantined (split nav bake) - 08:18 EDT
Bake to split navigation.json (both copies; original recoverable in git; valid[] mask must be
extended when appending nodes - that masked the first attempt):
1. A Sewer reconnected HONESTLY: 3 waypoint nodes (11726-8) with capsule-verified edges across
   the railed west gate (lanes found by in-page motor-equivalent sweep between the railing
   posts; each segment rise<=0.321, capsule-clear). Post-bake audit: calloutsLost [] at both
   0.45 and 0.40 radii, largest pruned component 7507->7759 (249 sewer nodes + 3 waypoints
   rejoin), defOK + A/B sites preserved. Route from attacker spawn to the deepest sewer node
   (y=3.02) now exists (128 hops; A* prefers a route with 2 sweep-flagged hops - model-strict
   edges, runtime breaker is the backstop).
2. Drain-slot trap quarantined: the z=2.5 and z=-5 slots (1.5 u recesses 0.37-0.4 u below
   street, no walk-out, no callouts) had their 6 nodes isolated (67 directed edges removed)
   plus 4 sweep-bad street edges crossing the slots stripped - flat A* routes no longer dip
   into them. Physical geometry untouched (jump-out for humans unaffected).
Post-bake: split five-soak PASS (no stalls observed in this sampled run; was FAIL x2 from the
slot); full audit: 0 trap nodes, no named area lost, spawns/sites preserved.
This is nav-DATA repair via verified connectors/quarantine, not the deferred blanket prune.

## Stairs live walk (diag-stairs.cjs, headless DM, bots culled, god-mode player, 2026-10-25)
Walks the longest rising nav-edge chain (>=5 nodes) per map with a held W key, re-aiming at the
next node each 100ms poll; asserts: reach the top (any sample within 1.6m XZ, 0.5m y), no stalls,
no falls, and a walk back down to the base.
- ascent: PASS (15 nodes, +1.91m; 0 stalls)
- bind:   PASS (17 nodes, +2.93m; 1 stall sample)
- breeze: PASS (19 nodes, +2.97m; 0 stalls)
- haven:  PASS (21 nodes, +5.97m; 1 stall sample)
- lotus:  PASS (11 nodes, +2.26m; 0 stalls)
- split:  PASS (23 nodes, +4.02m; up 0 stalls; down returns to base) - all six maps now pass.
ROOT CAUSE of the earlier split descent failures (probe artifacts, NO game bug):
1. Teleport wedge: setPos exactly onto a stair nav node can settle the capsule sunk ~2 cm into
   the step (nav y vs BVH surface differ slightly); the motor has no unstick, so it freezes.
   Real spawns are protected: nmPlace rejects candidates whose BVH height differs >.15 m from
   nav y or that are nmBlocked, and requires a traversable exit edge.
2. Match end from probe culling (the main one): the probe culls wandering bots with kill() each
   100 ms; those kills count toward the DM 40-kill win, so the match ended mid-walk
   (FREEZE-STATE dump: running=false, player reset to hp 100, frozen mid-fall air:true vy<0).
   Fixed by pinning DM.win=1e9/DM.len=9999 during the probe.
3. Fixed-yaw aim drifted off straight flights (bind); fixed by per-poll re-aim along the path.
NUMERIC DESCENT SWEEP (server motor, all rising edges walked b->a): split/haven 100%,
ascent 99.7%, bind/breeze 99.9% (isolated prop edges), lotus 97.1% with a CLUSTER of descent
failures around (-12, -7..-11, y ~5.0->5.3): the walker leaves the edge and lands ~3.5 m lower.
Either one-way drop ledges (legitimate) or nav edges overstating connectivity - OPEN, needs
geometry inspection; if the edges are wrong, bots routing down them could stall or fall.
Probe notes: bots are culled each poll (kill()) because DM respawns wanderers that body-block the
stair base (observed); one retry per leg guards residual interference. A fixed-yaw aim flaw in the
probe itself was found via bind (straight flight, diagonal first node) and fixed by per-poll re-aim.

## Lotus descent-edge cluster - root cause found (2026-10-25, second entry)
The failing edges (3628-3631 row, 3712, around x=-12/-11.3, z -7..-11) are NOT one-way ledges:
the nodes sit in a ~.37 m gap UNDER a slab overhang (ground at their (x,z) is ~4.93, the slab
above at ~5.3). blocked() at capsule height there is TRUE - a player cannot stand at these nodes,
yet they are valid[] with adjacency into the upper walk level (e.g. 3628<->3627). Bots pathed
through them will grind on the overhang until the runtime breaker bans the edge.
OPEN FIX (not yet applied): targeted invalidation of under-overhang nodes on lotus + a nav
connectivity re-check, through the verified-bake pipeline (build-world.cjs lotus + copies).
CAUTION: a naive "blocked at node" sweep is noisy - spawn-area round barriers make 2% of nodes
read blocked on every map (x=-78 on bind, x=-89 on breeze etc.). Any pruning must discriminate
mid-map low-clearance overhangs from barrier-sealed spawns (e.g. re-check with barriers open, or
filter to ceiling clearance < 1.35 m far from spawn volumes).

## Post-merge stairs re-run (Oct 25, commit c0cc5a6)
Harness repaired for main's async init (mid profile allows /models/valorant/ bins;
startDM via __vs hook; diag-stairs runs FV.dmN=0 - zero bots).
ASCENT: PROBE-FAIL. Up leg reached the top (goal y 8.00) but logged 11 stall samples
(>4 threshold) and ended at y 6.54 - a climb/slip yo-yo pattern with NO bots present.
Down leg (no teleport) did not return to base either run (7.05 -> 6.80).
Pre-merge the same probe passed this flight. Suspect a real stair-climb regression
from main's motor changes (clipBlocked / CLIPS / floorNear ring). NOT yet proven:
next step is A/B - same probe against pre-merge instinct (6facbc0~1 worktree, rebuild
ascent world artifacts) to confirm merge-introduced, then bisect the motor diff.
Caveat: one PROBE-FAIL earlier this run was a Chrome tab crash under sandbox load
(infra, not game).

## 2026-10-25 ~12:07 EDT - TEXCAP restore committed (2d61646), full client sweep green
- TEXCAP decode cap restored (valorant_runtime.js, before `var XV`); test_texcap.cjs green.
- Obsolete pins removed: test_native_only.cjs (main xvAttach native-only tier covers), test_preload.cjs (main XVA hash-verified manifest covers).
- FIX: __vsLightOn helper was defined outside the nmCancel..marker vm-slice region -> test_map_cancel + test_map_lifetime rejected with ReferenceError (loads=0). Moved helper inside region; both green.
- Full client slice sweep 0-80 (80 files incl. main's test_agent_preload + test_bot_variety equivalents) PASS post-restore. index.html regen idempotent (md5 ce0b4bab...).
- Restored dev tools agent_preview/agent_rt/boots_check/fp_check committed, NOT yet run.
- NEXT (queued): re-run six-map stairs probe WITH restored light path (matched-rate A/B vs pre-merge pass) before any motor-regression claim; then lotus re-ground, mobile/perf, responsive-HUD pass, lobby offline-mode reachability, A-kills-B duel, final acceptance sweep.

## 2026-10-25 ~12:21 EDT - Six-map stairs re-run WITH restored light path + breeze A/B
Post-merge (2d61646, light path restored), one selected flight per map, live DM, bots off:
- ascent: PASS (15n +1.91m; 0 stalls after 1 retry) / bind: PASS (17n +2.93m) / split: PASS (23n +4.02m)
- breeze: PROBE-FAIL 9 up-leg stall samples; reached top, clean descent, backHome
- haven:  PROBE-FAIL 12 up-leg stall samples; reached top, clean descent
- lotus:  PROBE-FAIL 15 up-leg stall samples; reached top, clean descent
Pre-merge ledger (same probe): all six PASS, <=1 stall sample.
MATCHED-RATE A/B (breeze): pre-merge 87fe8bf worktree via VS_ROOT, same machine/probe/world
(breeze nav/build inputs verified unchanged 87fe8bf..HEAD): PASS, 2 stall samples, up 40s down 40s.
=> Real tree-side delta on 3 heavy maps: up-leg wall-clock stalls 9-15 vs 0-2 pre-merge. NO motor
stuck: every flight completes up+down in both trees; ERRORS [] everywhere; descents all clean.
Pattern (stalls concentrated on UP leg = early match phase, down legs clean) is consistent with
main's XVA boot preload (80-file manifest decode) contending with the probe under SwiftShader, NOT
with a motor defect. Claim remains CONDITIONAL: not pinned to a commit. Next pin option: re-run
with XVA disabled or after preload settles; or per-sample trace for position-freeze vs slow-motion.
Har harness note: worktree lib.cjs has ROOT hardcoded - run A/B from MAIN checkout with
VS_ROOT=/tmp/vs-pre (worktree startDM clicks the legacy tab strip and fails on main's lobby).

## 2026-10-25 ~12:26 EDT - Lobby mode reachability (diag-lobby-modes.cjs, NEW probe)
Static: main's lobby Play button toggles #xQueue (tab strip: unrated/swift/sr/dm/tdm/esc/custom
with offline bot cards + START/Range) AND an #xOn online section (Quick Match/Create private/Join,
mode seg dm/tdm/five). The earlier "only online controls" observation was incomplete: the offline
tabs exist in the same panel.
LIVE (1280x800, light mode): tabs enumerate; per-tab cards visible (sr/dm/tdm/esc/custom "visible";
unrated/swift "no-card" = probe selector artifact - those panes use div.x-qcard not button).
REAL BUG FOUND: after activating the CUSTOM tab, its pane (.x-qp.on[data-q=custom], Retake 3v3
feature + countdown + GO) OVERLAPS the tab strip - playwright could not click the DM tab
("element intercepts pointer events"); .x-stage/.x-lb also intercepted on retry. CSS rule
.x-qp[hidden]{display:none} exists and outranks .x-qp{display:flex}, so hidden panes are fine;
the ACTIVE custom pane itself overflows over .x-qtabs. Needs visual confirmation (screenshots
/tmp/lobby_dm_tab.png, /tmp/lobby_fail.png - inspect next wake) and a viewport matrix
(1280x800, 640x360 landscape, portrait) before fixing. DM start not reached this run.

## 2026-10-25 ~12:41 EDT - Lobby tab-strip crush FIXED (flex:none on .x-qtabs)
ROOT CAUSE (measured live): when #xQueue hits max-height:calc(100%-88px), the column flex shrinks
children; .x-qtabs is a scroll container (overflow-x:auto) so its automatic min size is 0 and it
was squeezed 44px -> 1px. The 44px tab buttons overflowed the 1px strip, got paint-clipped by
overflow-y:hidden, and their hit area landed on .x-qmode's active pane ("custom pane intercepts
pointer events"). Any tall tab content triggered it; custom (1081px) was the worst.
FIX: flex:none on .x-qtabs (index.html; persists through install_valorant.py regen - md5 cdf754be).
VERIFIED LIVE (diag-lobby-modes.cjs, updated selector): 1280x800 + 640x360 tabs h=45px, all 7 tab
cards visible, DM tab clickable with custom previously active, full flow Play -> DEATHMATCH ->
#dmBtn -> DM match running (mode=five+FV.dm per design), 0 page errors, in-game HUD sane
(screenshots /tmp/lobby_custom_1280x800.png, _640x360.png, /tmp/lobby_dm_ingame.png).
390x844 portrait: #rot "rotate your device" gate intentionally covers the lobby - UNSUPPORTED
behavior per scope, labeled honestly, not a bug.
Known non-blocker: at 1280x800 the Online section's CODE/JOIN row sits below the fold; panel
scrolls (overflow:auto). Acceptable; flagged for the coordinated responsive-HUD pass.

## 2026-10-25 ~13:07 EDT - Rendered two-client online acceptance (WIP probe, findings)
Probe: work/browser-tests/rendered-two-client.cjs (one Chromium, two pages, real wrangler dev).
SANDBOX ARCHITECTURE FACTS (cost several runs):
- Detached node/wrangler processes SURVIVE between bash calls; google-chrome is REAPED when a
  bash call ends. All browser work must fit one ~115s call; server can be external (NO_WRANGLER=1
  + detached wrangler, or let the probe spawn its own).
- Probe-spawned wrangler child correlated with >100s blackouts at match start; external detached
  wrangler gave a clean 3s online start (ONE-client mode reached running=true, mode=five, 9 bots).
  Cause of the difference UNVERIFIED (CPU contention vs wrangler child stdio) - conditional.
- /profile?qa=1 now returns "Profile creation limit reached today" - daily cap; may affect fresh
  browser profiles creating rooms late in a testing day. Room creation observed working after the
  limit appeared, then failing later ("Creating server room..." stuck) - CORRELATION UNCONFIRMED.
SUSPECTED REAL ISSUES (both conditional, queued for the responsive-HUD/lobby pass):
- At 960x600 a Playwright coordinate click on #xOnStart started RETAKE (mode=retake observed),
  i.e. the click landed on another element - possible occlusion/shift under the scrolled queue
  panel. Probe now uses element.click() (DOM-level) since button hit-testing is covered by
  diag-lobby-modes at 1280x800/640x360. NEEDS a 960x600 visual check.
- The unintended retake start ignored __vsLight and sat at "Preparing the map..." 76s+ under
  SwiftShader - check whether retake/custom starts respect the light gate (probe-perf relevance).
NET MODEL NOTE: private rooms are client-HOSTED (host page runs bots/sim; "damage to you comes
only from the host"); match start blocks the host main thread >10s by design ("heartbeat can
black out").
STATUS: not yet passing end-to-end. Next: verify room-create blocker (profile limit vs other),
then A-host start with B parked at about:blank (WebGL-contention mitigation), then kill phase.

## Rendered two-client acceptance - stall root-cause WIP (13:18, commit 7d6a370)
- net() debug hook (localhost-gated, read-only, in work/debug_runtime.js): exposes ws readyState, mp st/on/role/host/code/mode/name, xReady, nmPending/nmLoaded. Test-only; no production behavior change.
- Create-phase is healthy: create-diag at 5s = {"msg":"Connected to game server","st":"room","on":true,"host":true,"ws":1,"drops":[],"mode":"dm","xReady":true,"nmPending":false}. Room create + join + ws all fine with the reused local QA token (no fresh profiles minted).
- Failure is AFTER mpStart: latest ONE-mode run logged "5s mpStart sent" then nothing for 100s+ - page evaluate calls never return = renderer main-thread hard freeze (case B). Case A (other runs): page responsive, load overlay stuck "Loading Ascent...", mode stays "retake" (init default) = no mode-start fn completed.
- Only success so far: 12:58 ONE run via real playwright click reached running=true in ~3s against the freshly started wrangler. All el.click() runs and all runs against the long-lived wrangler stall. Correlation unproven.
- Suspects (unverified): main-thread block inside xGo path (xGmLoad gun-model fetch/parse + nmEnsure + BVH build contention under SwiftShader); possible nmEnsure ticket/cancel interplay if a room-message prefetch and startDM load race; server tick/begin frame behavior on long-lived workerd instance.
- Labeling: host-client one-page success (12:58) != authoritative server-path acceptance; both stay open until the two-client rendered run completes.
- Next: pre-freeze console/pageerror capture; bisect xGo by starting via __vs.startDM-equivalent online path; check whether room message handler triggers a map prefetch racing startDM.

## Rendered two-client - stall root-caused to harness infra, not game code (13:22)
- FRESH-wrangler ONE-mode run (room 3UR9E4): mpStart -> running=true, mode=five in ~12s, 9 bots, match still healthy at 97s. Online DM start path works end-to-end against a fresh local server.
- Stall correlation: every stall/freeze run targeted the LONG-LIVED detached wrangler (started 12:55) that had accumulated rooms from many killed-browser probe runs. Server cleanup exists (drop() -> clearInterval when last session leaves; idle close 1001; load timeout 4002), but reaped Chrome leaves dead TCP sockets whose close events can linger, and tick() still builds a full snapshot every 50ms per open room even with zero ready sessions. Conditional attribution: accumulated rooms on the shared isolate degrade fetch/ws handling enough to stall client start. Not a production bug signal by itself (production Cloudflare DOs are per-room isolates), kept as harness-infra finding.
- Harness rule now: probe always spawns a FRESH wrangler per run (no NO_WRANGLER reuse of a long-lived server).
- Also confirmed live: /profile 429 still occurs on fresh wrangler and start works anyway (profile token is stats-only, fails soft) - cap theory stays dead.
- Probe now logs page console errors/warnings live (console.error 404 + 429 seen at boot are the known favicon/profile noise).
- Open: full TWO-client run (B joins mid-match, hunt/feed/death/respawn) against a fresh wrangler; then host-client vs authoritative labeling stays until that passes.

## Rendered two-client - case A re-diagnosed (13:25)
- nmEnsure is only reached via nmWrap/nmLaunch: the mode-start fn (dmGo, which sets mode='five') runs AFTER nmEnsure resolves. So mode='retake' + nmPending=true + 'Loading Ascent / Preparing the map…' during an online start is the NORMAL in-flight state, not proof no start ran. Earlier 'no mode-start ran' reading corrected.
- TWO-mode fresh-wrangler run (ZB4PNT): start frame path in flight at 35s, still in nmEnsure load phase ('Preparing the map…' = fetch/BVH phase). ONE-mode same server condition finished that phase in ~5s. Whether TWO-mode load is merely slower (CPU contention) or truly stuck is open; mpWaitStart tolerates slow loads by design (progress resets), the 119s sandbox window is the real limit.
- Added NET.loadAt / NET.ready / NM.ticket to the net() hook to distinguish start-frame-received from load-in-progress on the next run.

## Rendered two-client - harness engineering findings (14:12, uncommitted-run evidence)
Root causes found this session (all conditional on this 2-core/2GB/no-sandbox-swap sandbox):
1. TWO-client boot parse starves on RAM: box has 1982MB, no swap permitted (swapon EPERM); kswapd thrash (66% iowait) makes a second renderer's 3MB index.html parse take >60s. curl to the static server stays fast throughout - not a server or connection-pool issue.
2. Separate contexts = separate renderers = worst memory. ONE context: same-site pages share one renderer process (one V8, one THREE copy) - both pages boot in ~9s total.
3. Shared process = shared main thread: a running page's rAF loop starves DevTools evaluates. Fixes: __vs.pauseRender(v) (test-only, rebinds loop to an idle rAF re-armer) for the page that is waiting, __vs.slowRender(ms) (runs the real loop every N ms, leaves main-thread gaps) for the page under observation. Both localhost-gated debug hooks.
4. mid-asset route on probe pages: all png/jpg aborted (textures are the big memory+IO stream), bin/glb allowed only under /maps/, /worlds/, /models/valorant/ (XVA agent preload is on the online start path and retries forever when aborted - blocking it hangs the start at nmTicket=0).
5. Textures aborted + heap cap + pkill esbuild after wrangler ready = workable footprint.
Best run so far (twoH): both boot 9s, A in-match 14s, evaluates 3s. twoI (slowRender added): load in flight, evaluates fast; run killed by the 119s sandbox window before B join phase completed.
Open: complete B join mid-match + kill phase (60s window at 2.5fps); then label host-client vs authoritative-server acceptance separately.

## Rendered two-client - PRECISE BLOCKER recorded (14:22), moving to mobile/HUD/performance
- Detached runs work: chrome survives across bash calls when the probe is launched via `setsid -f` (contradicts the earlier "chrome is reaped" note - that applied to process-group children). Probe now runs with log polling, no 119s wall.
- Verified this session (fresh server each run, repeated): room create + host mpStart + server begin -> client in-match (running=true, mode=five, st=game, netReady=true, 9 server bots) in ~14s. This is HOST-CLIENT one-page success on the authoritative server path for the START phase only.
- NOT passed: B joining mid-match and the kill/feed/death/respawn phase. Precise blocker: after A's match starts, the first in-game frames under SwiftShader on the 2-core/2GB/no-swap box push load avg >20 with <15MB free (kswapd thrash); A's main thread never yields again, so every further CDP evaluate (state reads, pause, B's join flow) queues indefinitely. slowRender(400) cannot help because a SINGLE frame is the uninterruptible unit. Ended the run at 4+ minutes with zero post-start evaluates returning; killed and cleaned up (chrome/wrangler/esbuild all reaped, memory recovered).
- Identity caveat for the shared-context design: A and B share localStorage (same QA profile token, settings); room identity is distinct only via the explicitly filled names (RendA/RendB). Acceptable for harness reads, NOT representative two-device acceptance.
- Per parent: these altered conditions (paused/serialized rendering, aborted textures, shared process) are sandbox workarounds; results are not two-device acceptance and imply nothing about production performance isolation.
- Remaining online acceptance options if revisited: a bigger sandbox, persistent chrome profile (shader cache across runs), or server-side bot-free rooms to cut render load.

## #xOnStart occlusion at 960x600 - root-caused and FIXED (14:25)
- Measured (real room, fresh wrangler, probe work/browser-tests/lobby-start-hittest.cjs): at 960x600 the queue panel is y72..584 (max-height calc(100%-88px), overflow:auto) but #xOnStart laid out at y828 (stressed 10-player roster: y906) - fully clipped below the panel fold; elementFromPoint at the button center returned null; a coordinate click there hits page content behind the panel (explains the earlier "coordinate click started RETAKE").
- Fix (index.html, direct region): (1) room controls row (Map/Start/Leave) moved ABOVE the roster list in the DOM; (2) .x-qon__list capped (max-height:min(28vh,180px); overflow-y:auto) so roster growth scrolls internally and can never push the controls; (3) mpUI auto-scrolls the room block into view once, on the room-hidden->shown transition only (mpUI polls at 33ms, so transition-gated to never fight user scrolling).
- Verified rendered, hit-target level: 960x600 real room AND stressed 10-player roster: Start at y463-507, elementFromPoint = #xOnStart, inViewport, position IDENTICAL across roster sizes. 640x360 (y247-291) and 1280x800 (y663-707) pass the same way. Screenshot /tmp/hittest_960x600.png visually inspected: room code, map select, red Start, Leave and the internally-scrolling roster all visible.
- Closes the ledger's "NEEDS a 960x600 visual check" item. The sibling item (retake/custom start ignoring __vsLight, 76s+ "Preparing the map...") remains open for the perf pass.

## Mobile lobby reachability pass (14:38) - measurements + tab affordance fix
- Probe work/browser-tests/lobby-mobile-reach.cjs (offline lobby, no match): measures visibility + elementFromPoint hit targets per tab/START/online controls.
- 390x844 portrait: #rot gate shown (ROTATE YOUR PHONE TO LANDSCAPE / PLAY IN PORTRAIT) - current unsupported behavior, labeled, not waived.
- 844x390 landscape: rot gate correctly hidden. Tabs UNRATED..TEAM DEATHMATCH visible+hit-ok; ESCALATION clipped by the tab-strip scroll (rect pokes under the close-button zone) and CUSTOM off-strip - both reachable via strip scroll but with zero affordance (scrollbar-width:none). START card 377..441 below the 390 fold (page scrolls). Online section below fold (scrollable).
- 640x360: TEAM DEATHMATCH clipped, ESCALATION+CUSTOM off-strip, START below fold - same pattern.
- FIX: fade mask on .x-qtabs at <=1024px (linear-gradient 90%->99%) so an overflowing strip shows a fading right edge. Verified visually at 844x390 (ESCALATION edge fades before the close button).
- Left as accepted-scroll behavior (recorded, not fixed): START card + online section below the initial fold at <=390px-tall viewports; strip remains scroll-only (chosen over wrapping in the earlier crush fix to protect vertical space).

## Touch gameplay acceptance (offline DM, emulated touch, 844x390 landscape) - PASS (14:41)
- Probe work/browser-tests/touch-dm.cjs (hasTouch+isMobile emulation, CDP dispatchTouchEvent, mid asset profile):
  touch layer on (pointer:coarse true), floating joystick drag moved the player 5.9m in one drag (53m cumulative across directions), right-half drag aimed (camera dir delta 0.68), FIRE tap spent ammo (25->21), joystick visual appears during hold (hidden on release by design).
- Screenshot /tmp/touch_dm.png inspected: touch buttons (FIRE/JUMP/DUCK/ZOOM/R/INS/PING/F/COMMS/C-Q-E-X), minimap, score, standings, ammo 21|75, hp 100+50 all render at 844x390.
- Observed, deferred to the coordinated responsive-HUD pass (not chased piecemeal per plan): default ZOOM/FIRE button positions overlap the right-side standings list; the mode subtitle truncates under the top-right buttons.
- NOTE: emulated touch, not a real phone (standing caveat from the ledger's touch row).

## Tab-strip swipe + tab reach (844x390 touch) - PASS (14:42)
- Probe work/browser-tests/lobby-tab-swipe.cjs: touch drag on .x-qtabs moves scrollLeft 0->186 (fade-mask affordance backed by real scrolling); after the swipe, ESCALATION rect fully inside the clip with elementFromPoint on the tab; tap activates it (class .on) and the visible pane switches to the Escalation card; CUSTOM tap activates; X closes the queue.
- Note: the strip resets scrollLeft to 0 when a pane activates (reads after a tap are not the swipe measurement).

## TDM loadout/tier/respawn transitions (offline, 844x390 emulated touch) - PASS (14:59)
- Probe work/browser-tests/tdm-transitions.cjs, 12/12 checks:
  - Touch BUY opens the loadout (tap after the loading screen clears; elementFromPoint on the button).
  - Tier 0 locks correct: Shotguns/Rifles locked "2:00", Snipers/MGs "5:00", all disabled; Sidearms/SMGs free.
  - Loadout grid at 844x390 (351px dialog, overflow-y:auto): Spectre initially half-clipped; a touch drag on the grid scrolls it into reach (drag verified, not just programmatic), tap equips (pri=Spectre, ammo 30) and the menu auto-closes.
  - Tier 1 at 2:00 elapsed: toast "Rifles & shotguns unlocked · B"; the OPEN loadout re-renders live (Rifles unlocked); Vandal tap equips (ammo 25).
  - Tier 2 at 5:00: toast "Snipers & machine guns unlocked · B"; all weapons enabled (Operator tappable).
  - Death: "You died · respawning" toast, DM.prt 1.5s timer set, loadout closed, death counted. (An earlier probe run read "spectating your team" because hurt and die were split across two evaluates and dmTick set DM.prt in between, gating the wrapper - probe artifact, not a game bug; the real path is one synchronous frame.)
  - Respawn: hp 100, armor 50, vx/crouch/air reset, spawn protection armed (DM.pp ~1.7s remaining when polled).
- Harness notes: __vs.die hook added to debug_runtime.js (localhost-gated test hook) to drive the same pDie path bots use; Vandal grid scroll used scrollIntoView after two real touch drags (grid touch-scroll proven on Spectre), tap itself was real.

## Spike touch plant probe - IN PROGRESS (15:02)
- work/browser-tests/spike-touch.cjs written (hold -> progress, release -> cancel, re-hold -> complete, via touch "4" button). Current blocker: inSite() consults the navmesh plant bitmap (nmPlant over C.plants.rows), not the static SITES table; neither the generic SITES A (-20,-21) nor ASC_SITES A (-31.7,-19.4) is in-zone, so the plant prompt never shows. Fix for next run: expose nmSiteGoals output (verified in-zone world points, already computed at runtime) via a localhost test hook and teleport to siteGoals.A. Touch plant button itself verified present/usable in five (54px, hit-tested).

## Spike plant by touch "4" (offline five, 844x390 emulated touch) - PASS (15:04)
- Probe work/browser-tests/spike-touch.cjs, 5/5: teleported to the navmesh-verified in-zone point (new __vs.siteGoals test hook; Ascent A goal [45.25,-32.5] - the static SITES/ASC_SITES anchors are NOT in the plant bitmap, which is why the first probe run never saw the prompt), "Hold 4 to plant" prompt shows; touch hold -> "Planting" with pt rising (1.34 at 1.3s); release -> pt resets to 0 and prompt returns (cancel); re-hold -> plant completes (st "plant", pt 4.03). Touch plant button 54px, hit-tested.
- Screenshot /tmp/spike_planting.png inspected: PLANTING bar filling, "4" button lit while held, SPIKE drop hint, 5v5 HUD intact.
- Harness: spike assigned to the player (production carrier is a random attacker) and buy phase skipped; the plant/hold/cancel path itself is the production one. Emulated touch, not a real phone.

## Defuse hold/checkpoint/cancel + interrupted-touch safety (offline five, 844x390 emulated touch) - PASS (15:07)
- Probe work/browser-tests/spike-defuse-cancel.cjs, 6/6:
  - FIRE hold then CDP touchCancel: fireHeld true -> false (no stuck firing).
  - Joystick drag then touchCancel: player moved during drag, fully stopped after (no stuck keys).
  - Touch 4 plants (production path; harness: spike assigned, buy skipped, teleport to siteGoals A).
  - At the planted spike (harness: FV.atk flipped so the player is the defuser, defender bots moved away): "Hold 4 to defuse" shows; hold -> "Defusing · half" at dt 3.55; touchCancel mid-hold -> dt pinned at 3.5 (half checkpoint kept, no reset, no stuck Digit4); re-hold -> defuse completes (st "done").

## Coordinated short-screen HUD layout (ann/feed/toast/card) - FIX + PASS (15:24)
- Root cause of the reopened FIRST BLOOD x kill-feed collision: the short-screen .x-ann rules in the early max-height:560px block LOST the cascade to the later .x-ann base block (right:0, top:22%), so the ann band never actually moved; the ann title also renders as flex spans whose 24px gaps push glyphs wide.
- Coordinated fix (index.html, no single-offset chasing): at max-height:560px the ann owns a reserved top band below the scoreboard strip and right of the minimap (top:64px, left:128px, right:248px; rnd 70px) with banner fonts/gaps sized to the band (ant clamp(16px,3.3vw,28px) gap 8px; rnd clamp(20px,4.4vw,36px); big clamp(22px,4.5vw,36px)); the feed owns the right strip capped at 2 rows (max-height:56px, overflow hidden; kfPush prepends so the cropped row is the oldest); the toast shares the ann's reserved column above the KILLED BY card (bottom:142px, left:0, right:240px, margin auto); card unchanged (bottom:60px).
- Probe work/browser-tests/hud-coexist.cjs: FIRST BLOOD + feed rows + toast + KILLED BY card coexisting at 568x320 / 640x360 / 1280x720; region rect intersections [], glyph-range (Range.getBoundingClientRect) vs feed/minimap/scores clear (gaps 29/85/202px). __vs.resetFirstBlood test hook re-arms the once-per-round banner per size. Screenshots /tmp/hud_{568x320,640x360,1280x720}.png visually inspected.
- Known adjacent items, out of this pass's scope: at 568x320 the scoreboard strip (x 93-475) overlaps the minimap (x 8-120) - pre-existing; DM standings (x-dmlb) overlaps the default FIRE touch button at 844x390 coarse - deferred to a touch-default-layout item.
- Regression: test_short_layout.cjs passes (28 short-screen rules); full work/test_* sweep runs next wake (exceeds the foreground budget).

## Parent review 15:28 - HUD acceptance widened to whole-HUD pixels (next-wake plan)
- Chosen-element rect metric is not acceptance. Named defects, all in scope: (1) 568/640 contextual #hint visible behind toast/death card again; (2) ELIMINATED banner shows through the KILLED BY card (also 1280) - duplicate conflicting overlays to remove/merge; (3) touch defaults at coarse short screens: II pause on the scoreboard clock, ability pips on the subtitle, DUCK on credits/ammo, COMMS on F, DM standings/feed/button overlap.
- Plan for next wake: pixel-based verification (rendered screenshot region scanning, not selected rects) at 568x320/640x360/1280x720 + 844x390 coarse; merge ELIMINATED banner into the KILLED BY card; move #hint out of the toast/card stack; reposition touch DEF defaults clear of HUD panels; keep functional touch passes as functional evidence only, separate from visual readiness. Full test sweep results pending (detached runner).

## 15:44 - whole-HUD map probe (work/browser-tests/hud-map.cjs) + overlay dedup landed
- hud-map.cjs measures EVERY visible fixed HUD panel + touch button rect and reports all pairwise intersections. First map at 568x320 (non-coarse) exposed the full overlap set the parent's 15:28 review flagged: minimap x scores x tb:buy; scores x tb:pause + tb:c/q/e/x; subtitle x tb:c/q/e; credits x tb:fire/duck/reload; ammo x tb:duck.
- LANDED: (1) vmKill skips the ELIMINATED banner while xKL.on or player dead (streak counting kept); (2) xKLDie clears #xKbn.on + VM.kt so a pending banner cannot bleed through the KILLED BY card (both are .x-kb, co-located at <=560h by design); (3) #game #hint display:none at <=560h (confirmed absent in the probe map).
- IN PROGRESS: short-landscape touch default layout (DEFS). Constraint map at 568x320: minimap 8-104, scores 35-534/8-40, subtitle 136-432/48-59, credits 442-564/232-264, ammo 472-564/272-316, vitals 8-136/264-312; ann reserved 128-320/64-120; feed strip right side. Right cluster (fire/jump/duck/reload/zoom/swap/c/q/e/x) needs a measured rearrangement that stays clear at BOTH 568x320 and 844x390 coarse (feed top:100 there); pause needs scores-strip margins at <=560h. touch:true + 844x390 hung the renderer once - retry with care; non-touch 568x320 works (30s).

## 16:15 - short-landscape touch HUD: DEFS layout + panel coordination (hud-map-verified, zero overlaps 3/4 sizes)
- DEFS (<=480h landscape): measured grid vs real panel rects. c/q/e/pause row (pause stays off the death card), zoom/reload/jump/x row, fire right column, duck/swap under, buy/plant/use left column under minimap. ping/inspect/drills default OFF (re-enable via touch edit mode; comms wheel covers callouts).
- Feed: top:64 at <=560h (was 100, sat on the ability row); 1-row cap at <=480h (2-row kept 481-560h).
- COMMS (#xCmB): fixed dock left:110px top:124px at <=480h landscape (was left:12px top:62% = ON the F/use button).
- Toast at <=480h: body-child selector fix (#toast is NOT in #game - first override silently missed; caught by probe). Now bottom-center band top:260px, stacks under the death card, clear of the button grid.
- DM standings (.x-dmlb) at <=480h landscape: ticker under the feed - leader + you only (header hidden, li:first-child + li.me); full table needs taller screens.
- tb:buy in DM is FUNCTIONAL (KeyB -> dmMenu free-guns loadout :9777, hark's botfix241 intent) - kept.
- hud-map.cjs: added comms + toast to the grab list. Result: OVERLAPS [] at 844x390 five, 568x320 DM, 844x390 DM; 568x320 five has only minimap/scores (designed: translucent map under the no-background score strip; pixels verified legible). Pixel-inspected 568x320 five capture: clean.
- KNOWN TRADEOFFS (parent can veto): feed 1-row at <=480h; DM standings = ticker not table at <=480h; ping default-off at <=480h; 2s sliver overlaps none (pause fully off the card).
- Still open from 15:28 scope: pixel-check 844 captures + kill/death-scene captures (banner dedup verification), sweep rerun, performance A/B, Lotus.

## 16:30 - whole-HUD acceptance round 2: ALL SIZES ZERO OVERLAPS + death-scene dedup verified
- Scores strip at <=560h: right-docked + compacted (13px pips, 15px digits, 52px timer) and bpT() shortens to "BUY 0:43" (the nowrap "BUY PHASE 0:43" was the strip width driver). Rules placed after the max-width:820px block (cascade). 568x320: strip [135,8,560,40] clears the minimap markers fully (parent's 16:14 rejection fixed).
- Toast at <=480h: bone bg + ink text (low-contrast fix), max-width:260 (clears credits), top:260 (stacks under the death card, off the button grid). #toast is a body child - selector fixed.
- DM standings ticker: tap toggles .x-full (full table) - full standings access preserved on touch (no scoreboard button exists).
- hud-coexist.cjs: added banner (#xKbn.on) grab, r1 screenshots, SIZES env, r2-banner-is-gone assertion. PASS at 568x320/640x360/1280x720: kill -> FIRST BLOOD + ELIMINATED banner + feed + toast coexist clean; die -> KILLED BY card with banner GONE (no bleed-through; pixels verified 568 + 1280).
- 1280 coexist flake root-caused as PROBE artifact (waitForFunction TTL race: 900ms "Round start" toast vs ann poll under SwiftShader at 720p; card opacity transition delay > 300ms grab window). Fresh-state 1280 probe (/tmp/banner1280.cjs): banner:true ann:true feedRows:2 at +500ms - desktop banner confirmed working post-dedup.
- xKLReset coverage verified thorough (render tick :4003, round flow, DM respawn, revive) - dedup's xKL.on gate clears on every real respawn path.

## Lotus overhang re-ground (2026-10-25 ~16:50 EDT) - static source CONTRADICTS the slab reading
BVH clearance audit (/tmp/lotus-clearance2.cjs: upward rays from every valid lotus nav node
against collision.bin, floor-noise hits <0.12m ignored): ZERO nodes with ceiling clearance
< 1.35 m. Spot-check at the ledger cluster (nodes 3628-3631, 3712-3717, x=-12/-11.25,
z=-7..-11): first ceiling hit at +7.87 m; down-ray shows ONE surface (y 4.93) - no slab at
~5.3 anywhere in the static source. collision.bin (10-24 23:31) predates the latest world
bake (10-25 11:48), so build staleness cannot explain the live probe's blocked()=TRUE.
Lotus runs dynamic props excluded from static collision (X_DYN_RE): xLotusMech rebuilds
LG.doors / LG.wall / LG.deb (rotating doors, breakable wall, debris); doors open each round
start, bots sometimes close them. A closed dynamic prop at that spot reads as a "slab" to a
capsule blocked() probe but is NOT a permanent overhang, so static invalidation of the
3628-3631/3712 cluster would be WRONG (nodes are walkable when the prop is open/gone).
Revised hypothesis for the descent-edge failures: one-way drop ledges (terrain steps
5.34->4.95->4.6->4.29, exceeding the 0.321 climb limit for up-travel only) - the ORIGINAL
hypothesis in the descent-edge entry. NEXT: live probe at (-12,-9) lotus naming the prop +
its open/closed state (door/debris), then decide: if a closed-door reading, no nav change;
if a real static slab appears in the live world, capture its mesh name before any prune.

## Stairs settled-vs-active A/B (2026-10-25 ~16:58 EDT) - contention CONFIRMED on breeze
Same probe, same machine, same world, same flight (19 nodes +2.97m), live DM, dmN=0:
- active (12:21 run, walk immediately after match start): 9 up-leg stall samples.
- settled (new SETTLE=60 env: wait 60 s in-match before walking): 0 stall samples,
  up leg y 8.16 -> 11.00 goal reached, down leg backHome true, ERRORS [].
Pre-merge matched-rate baseline was 2 stall samples. Conclusion: the post-merge up-leg
stall pattern on heavy maps is early-match boot/XVA-settling contention under SwiftShader,
NOT a motor regression. Probe harness gained SETTLE env (/tmp/diag-stairs-settle.cjs;
upstream into work/browser-tests/diag-stairs.cjs next pass). Haven + lotus settled
confirmation runs queued behind it (one chrome at a time).

## Lotus overhang RETRACTED (2026-10-25 ~17:17 EDT) - one-way drop lip, no slab, no nav change
Live corroboration (lotus DM, doors open, /tmp/lotus-prop.cjs): nmBlocked (standing AND
crouch capsule) TRUE at all five cluster nodes (3628-3631, 3712). Live bundle raycast
(server/public/worlds/lotus position/index bins, /tmp/lotus-bundle-ray.cjs): UP rays from
the nodes hit NO ceiling at all (open sky, rules out any slab in the served world); ground
within capsule radius r=0.43 is 4.93 at the node but 5.32 on the -x/-z sides - a 0.39 m
floor lip inside the capsule radius. nmBlocked's shapecast catches that lip below its line
start (y+r), which reads blocked()=TRUE without any overhang. CLIPS has no lotus entry
(server/src/motor.cjs:31), ruling out an invisible-wall clip. Stand test: teleported
capsule settled at y=5.27 on the lip, consistent. CONCLUSION: the 2026-10-25 'slab
overhang root cause' was a misread of blocked()=TRUE; the cluster is a one-way drop at a
real terrain step (up impassable at 0.39 m > 0.321 climb limit, down fine). NO nav
invalidation (bake would remove legitimate standing space; one-way drops are plausibly
intentional; the runtime per-unit stall breaker covers bots attempting the up leg).

## Parent calibration on stairs A/B + sweep methodology (2026-10-25 ~17:18 EDT)
- A/B framing: settled-vs-unsettled SUPPORTS the startup-contention hypothesis, it is NOT
  definitive no-motor-regression proof. Recorded: breeze 9->0, haven 12->1, lotus 15->5
  stall samples (settled). Residual lotus stalls (5) stay an open bounded item.
- SETTLE=60 is DIAGNOSTIC ONLY, not a user-facing fix for early-match hitching. Open work
  item: reduce ACTUAL startup contention (bounded preload/decode scheduling or readiness
  changes), no invisible agents, preserve main's newer loader/cache behavior, check hark
  branch overlap FIRST.
- Lotus terrain-step directionality: unresolved routing-quality limit, not proven
  intentional. Open.
- Sweep: a run without a completion marker is INCOMPLETE, not green. Replaced the single
  long sweep with /tmp/sliced-sweep.sh: 9 deterministic slices, per-test RESULT lines with
  exit codes + durations, SLICE-DONE markers, resumable via recorded results.

## Startup-contention readiness fix (2026-10-25 ~17:22 EDT, commit pending tests)
Root cause found for early-match hitching: xGate() fires xPrecompile (full-scene
synchronous renderer.compile + ability/effect meshes) on the first rAF where
running && !xPC - under frame starvation (SwiftShader headless, weak devices) that
multi-second main-thread block lands INSIDE the playable window. Fix (readiness, no
loader/cache change): window.xWarmShaders bridge (same xPrecompile + one warm
renderer.render for texture uploads, hidden by the opaque overlay) called from
xMatchLoad's chain after the match build resolves and before fill()/ready(), with a
PREPARING status line. xGate fallback unchanged (direct-start/probe paths still compile
on demand). Measured on breeze, same probe/machine/world, ACTIVE protocol (no settle):
9 stall samples before -> 4 after (60 s settle diagnostic: 0; pre-merge baseline: 2).
Meaningful reduction, not elimination - residual early-match work not yet attributed.
Hark-overlap check: origin/hark-loading exists but has ZERO unique commits; hark-perf
owns agent cull + nav GC only. Loading/preload space clear. Test: work/test_warm_shaders.cjs.
