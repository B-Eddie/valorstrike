# Valorstrike — active work and remaining validation plan

Work resumed on 25 October at the user's request. `hark` and `instinct` have been reviewed and integrated into `main`; see [BRANCH_INTEGRATION.md](BRANCH_INTEGRATION.md) for the current implementation, conflict decisions and verification. The full acceptance checklist below remains active. A GitHub push is not a game-server deployment.

## Historical checkpoint at `63176c0` (superseded implementations)

| Area | Implemented in this checkpoint | Verification still needed |
|---|---|---|
| Character gun grips | Baked native weapon-relative wrist and finger poses for 12 agents × 19 weapons; two-arm IK preserves arm lengths, constrains the rigid weapon to both hands' reach, restores offsets before animation updates and releases during knife/reload/cast states. | Actual game weapon templates, all guns/agents, crouch/run/aim/fire/reload transitions, torso clipping and close-up finger contact. The isolated preview was inspected for Jett/Vandal and Jett/Sheriff. Do not substitute wrist-coordinate tests for visual acceptance. |
| Character loading | Two background character preload jobs begin in the lobby; selected agent's first-person assets also warm. Versioned Cache Storage retains model/animation bytes across visits; failures fall back to network. Asset revisions regenerate with the page installer. | Cold versus warm download/decode/setup timings, throttled network, real-browser persistent-cache hits, storage limits/private browsing, selection changes and load contention. The reported ~40-second delay has not been measured after these changes. The manifest lists ~239 MB of eligible assets; it does not eagerly download all of them. Characters plus locomotion are ~117 MB. Maps remain lazy. |
| Fuzzy default | Medium now uses a fixed native/Retina render scale, capped at 2× device resolution; automatic scale reduction applies only to explicit Auto. Map anisotropic filtering increased to a capped 8×. | Actual gameplay pixels and frame times, existing saved Low/Auto/custom settings, high-DPI and touch devices, quality/AA switches and weapon retention. |
| Damage stutter | Removed forced layout reads from hit numbers/markers, directional damage arcs and kill-icon animation restarts; initialized pooled bullet effects before native match startup. | Measure frame times on actual dealt/received hits, headshots, first hit, bursts, kills and simultaneous combat; finish shader/action warm-up if profiling shows first-use stalls. |
| Ragdolls / exploding corpses | Restrict physics to major body joints; preserve limb lengths and brace the torso; bound motion, reuse scratch vectors, reduce terrain queries and freeze safely on invalid/divergent state. | Repeated actual kills, multiple bodies, slopes/stairs, all 12 rigs, death during cast/reload, corpse cleanup and frame/memory stability. Four rigs passed isolated terrain and injected-invalid-state tests; actual crash reproduction is not signed off. |
| Stairs without jumping | Correct capsule step-edge grounding and short step support; client/server motor copies match. Floor queries accept either triangle winding and use tightly bounded nearby navigation support where exact stair support is missing. | Traverse actual staircases on all six maps without jumping, up/down/diagonal/crouched; retain tall-box and ceiling restrictions. Check that navigation fallback does not cover genuine holes/drops or strand actors over edges. Three formerly blocked Lotus paths have regression tests. |
| Floor weapon pickup | Added authoritative gun drops and pickup validation, exact ammo/reserve transfer, slot swap and server acknowledgement; synchronized floor-gun meshes; added a nearby pickup prompt and touch button using the existing interaction key. | Integrate/test all modes, LOS-aware prompt, stale/concurrent pickup, same-weapon swap, primary/sidearm/knife cases, nearby Spike interaction, respawn/round cleanup, pool reuse and duplicate corpse-gun visuals. New pickup/stair tests must be added to the default server script on resume; they were run separately for this snapshot. |
| Third-person spectating | Whole spectator strip responds to click/tap and keyboard activation; camera height includes terrain elevation; pointer lock is released for spectating without auto-pausing; toggle text/pressed state reflects view. | Die in a running match, follow a living teammate, switch first/third person using button/V/touch, switch targets, wall clipping, elevated terrain and return to play on revive/respawn/next round. |
| Lotus hole below A | User initially withdrew the general hole report, then supplied a specific minimap screenshot locating a gap in the right wall below A. | **Not fixed yet.** Reproduce this exact spot; determine whether the gap is source minimap artwork, visible geometry, collision, or an intended doorway. Fix the actual defect and verify both sides/elevations. Do not fill unrelated map openings. |

## Remaining acceptance order

1. Complete integration verification and preserve one implementation per subsystem. The default server command now includes the original Lotus stair regressions; optimized asset, grip, floor-pickup and ragdoll regressions replace the earlier competing implementations. Keep client/server motor behavior identical.
2. Complete visual gun-grip acceptance in the actual game: all agents and weapon classes, idle/walk/run/crouch, aiming, fire recoil, reload/equip/cast transitions and weapon changes. Correct any finger/shoulder/stock clipping rather than accepting only mathematical wrist contact.
3. Measure and finish the loading/cache changes. Prioritize the selected agent and imminent roster/loadout; bound background work so it does not compete with match startup or combat; verify cache invalidation after asset changes and robust fallback under quota/storage failure.
4. Finish sharp rendering defaults and measured hit/kill performance together. Profile first-use animation binding, shader compilation, texture upload, raycasts, UI/layout and corpse setup. Keep crisp defaults without concealing stalls through automatic blur.
5. Reproduce the corpse explosion with real kills; validate stable, anatomical falls and bounded CPU/memory with several simultaneous corpses. Verify that the stability guard never sends invalid transforms to rendering.
6. Finish normal stair traversal, floor pickup and spectating acceptance, including touch controls and authoritative online behavior.
7. Investigate and repair the precise Lotus right-wall gap below A from the user's supplied screenshots.
8. Complete sustained two-rendered-client multiplayer and persistence acceptance; diagnose the earlier background disconnect using actual close reason/idle/frame evidence. Do not declare networking fixed from socket-only tests.
9. Work through the remaining map, terrain, combat and agent-ability requirements below.
10. Complete mobile, performance and release gates. Keep production Spike disabled until its complete browser/server acceptance passes. Deploy only the matching tested pair, without paid-plan/billing changes.

## Remaining original handoff, carried forward in full

### Original maps, startup and terrain

- Repeat cold start, cancel, error and retry on Ascent, Bind, Haven, Split, Lotus and Breeze; measure body download, texture decode, GLTF parsing, resource peaks and cleanup under constrained conditions.
- Retain original map geometry/fidelity. Startup success alone does not prove spawn placement or traversal.
- Inspect each map's distinct source assets, attacker/defender spawns, stairs, slopes, low cover, walls, doors/teleporters where applicable, navigation, first-round allies and later rounds.
- Validate visible buy walls against collision and phase-end removal.
- Verify feet/contact correction on actual terrain, slopes and stairs, including aim pitch, crouch, animation transitions and several agents together.
- Check bot traversal, varied reaction/timing, natural movement and combat, stuck recovery and navigation across every map.
- Inspect all minimap orientations, projections, friendly/enemy visibility, markers, mobile size and Omen target selection in a running match.

### Weapons, inventory and combat

- Inspect Sheriff/Split finger placement, first-person idle poses, crosshair alignment and all weapon/knife retention through quality and AA switches.
- Recheck reload/equip/fire timing, agent changes, viewmodel cache/cleanup and crowded combat.
- Finish TDM primary/sidearm equipped-slot accuracy, loadout opening/closing, tier unlocks and death/respawn behavior, including touch.
- Replace coarse fixed server hit spheres with validated native animated hit volumes. Reconcile crouch, head, torso and limbs with rendered poses and aim/hit feedback.
- Implement and validate matching wall penetration on client and server.
- Finish projectile, device interaction/destruction, LOS, smoke/flash and status behavior consistently across local and online modes.

### Agent kits and ultimates

Existing implementation is a mixture of project-specific behavior and prototypes, not completed full parity. Verify server ownership, targeting, charges, signature recharge, cooldowns, channels, cancellation, death/round reset, visuals and HUD for every supported kit:

| Agent | Remaining complete-kit acceptance |
|---|---|
| Jett | Cloudburst, Updraft, Tailwind and Blade Storm, including integrated knife visuals/throws, refill, exhaustion and reset. |
| Phoenix | Blaze, Hot Hands, Curveball and Run It Back, including return/death/reset behavior. |
| Sova | Owl Drone, Shock Bolt, Recon Bolt and Hunter's Fury, including projectile/device/reveal behavior. |
| Sage | Barrier Orb, Slow Orb, Healing Orb and Resurrection, including targeting, channel/visual and wall destruction behavior. |
| Reyna | Leer, owned soul-orb lifecycle, shared Devour/Dismiss charges, heal/overheal, no-attacks Dismiss, Empress and all death/reset/HUD transitions in real online play. |
| Omen | Shrouded Step, Paranoia, Dark Cover and From the Shadows, including valid targets, channel/cancel/return behavior and minimap/touch targeting. |
| Killjoy | Nanoswarm, Alarmbot, Turret and Lockdown, including deployment, activation, range/LOS, interaction/destruction and ultimate status behavior. |
| Raze | Boom Bot, Blast Pack, Paint Shells and Showstopper, including traversal/knockback, projectile/explosion and reset behavior. |
| Skye | Regrowth, Trailblazer, Guiding Light and Seekers, including pool/toggle, controlled-device, flash and targeting behavior. |
| Breach | Aftershock, Flashpoint, Fault Line and Rolling Thunder, including direction, charge/channel, LOS/status and cancellation. |
| Cypher | Trapwire, Cyber Cage, Spycam and Neural Theft, including device interaction/destruction, reveal and reset behavior. |
| Chamber | Trademark, Headhunter, Rendezvous and Tour de Force, including anchor/range, weapon ammo, cooldown and reset behavior. |

### Rendered multiplayer and saved records

- Two independent rendered clients: create/join, both players moving/aiming/firing, human-to-human hits/kills, death/respawn, late join, reconnect and leaving.
- Complete a natural DM and TDM match; verify completion UI and durable saved records/leaderboard on the same tested client/server version.
- Exercise interrupted loading, stale input, browser background/foreground, disconnect reasons, room closure and free-service failure messages.
- Verify rejoined-session aggregation, bot replacement, host transfer and no bot credit leaking into the human record.
- Keep anonymous identity/recovery and anti-cheat limitations accurately presented; do not accept browser-authored results.

### Spike release gate

- Exact round flow, win/OT/halftime transitions, economy/rewards, buy/sell/refunds, inventory/reserve/reload/equip and late joining.
- Plant/drop/pickup, stationary/interrupted planting, half-defuse and defuser changes, explosion/defuse/elimination/time wins and round-end cleanup.
- All ability/device/ultimate behavior plus browser regressions and matching authoritative presentation.
- Production Spike remains disabled until this gate passes; a Git push is not permission to label the prototype complete.

### Mobile, performance and final release

- Portrait and landscape touch movement/aiming, loadout, pickup prompt/button, HUD overlap, spectator controls, hold/release plant/defuse and minimap targeting.
- Profile normal startup, cache/memory lifetimes, repeated weapon/agent/map switches, crowded combat, hits/deaths/ragdolls and reconnects.
- Test concurrent rooms, Free-plan CPU/quota headroom and failure handling without adding a card, paid overages or new paid services.
- Rebuild the generated page; run source/integration suites; inspect real gameplay and mobile pixels; deploy the matching tested server/client pair and verify it live.
- Keep unfinished items explicitly marked until evidence closes them. Do not substitute source tests, isolated rigs, successful headers or socket-only checks for full rendered gameplay acceptance.

## Reproduction and validation tools

- `work/grip-preview.html`: isolated native-agent/native-weapon pose viewer. Useful for contact inspection; not a substitute for the game integration.
- `work/build_grips.cjs`: regenerates native weapon-relative pose data.
- `work/build_asset_cache.py`: regenerates per-asset content revisions; the page installer invokes it.
- `server/inspect-stairs.js`: diagnostic sampling of actual map navigation/collision edges. Some sampled edges are tall ledges/obstacles, not walkable stair steps; do not turn all failures into a higher universal step height.
- Default suites: from `server/`, `npm test` and `npm run test:client`.
- Additional new server cases: from `server/`, `node test-stairs.js` and `node test-pickups.js`.

No implementation should continue automatically while this pause is in effect.

## Checkpoint verification before branch integration

On 25 October 2026, the user resumed work and requested inspection/integration of `origin/hark` and `origin/instinct` before further independent implementation. The previous pause is lifted by that request. This document remains the scope record; implementation statuses above describe the pre-integration checkpoint.

The checkpoint passed all 28 client regression files, the 16 default server regression files, and the separately run original-Lotus stair and floor-pickup tests. These are source/isolated checks; the unverified browser and release gates above remain open.
