# Valorstrike acceptance ledger

Updated 25 October 2026 (branch `hark`) from the full [Instinct handoff](https://files.instinct.com/u6k7xnlbyeh0-valorstrike-shipped-and-still-open).

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
- All 17 default server regression files pass (`npm test`), including Reyna, Blade Storm, interaction, release-gate, reconnect-record and floor-weapon cases.
- All 35 client regression files pass (`npm run test:client`), including native contact/locomotion samples, loading/cancellation, renderer rebinding, identity/profile, maps, intents and new ability/HUD checks.
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
| 3 | Six original maps | Visually inspect every map, spawns, stairs, low cover, walls, doors/teleporters, allies, subsequent rounds and buy-wall release. Collision regression coverage is not a full traversal sign-off. |
| 4 | Third-person rifle pose | Procedural two-handed grip landed (3f5889a) and is regression-measured across weapon classes, stances and pitch. Still open: browser sign-off in motion (sprint/jump/strafe), online remote players, costume clipping. |
| 5 | First-person weapons | Native FP rig is the sole arm source with authored fingers/equip/fire/reload/inspect for every weapon and knife (8a409eb); primitive arms no longer flash during load. Still open: browser sign-off of quality switches, reload/equip/fire timing feel, agent changes and crowded combat. |
| 6 | Feet/terrain/AI | Complete live slopes/stairs/aim/transition and multiple-agent traversal checks. |
| 7 | TDM/mobile | Complete tier unlock and respawn transitions plus portrait/landscape touch movement, aiming, HUD and Spike hold/release. |
| 8 | Minimap/selection | Room-map selection and cancel defects fixed; still inspect running-match orientation/visibility/markers on all six maps, mobile and Omen targeting. |
| 9 | Remaining abilities | Reyna and Blade Storm implementation added against the project's existing rules; integrated Spike visual acceptance remains. Other generic ults/devices/projectiles/channels still lack full parity. |
| 10 | Combat consistency | Native animated authoritative hit volumes, wall penetration and comprehensive projectile/device/LOS/smoke/flash/status behavior remain open. |
| 11 | Spike release gate | Interaction and explicit configuration gates improved; full round/economy/inventory/late-join/ability/browser acceptance remains. Do not enable production Spike yet. |
| 12 | Reliability/performance | Loading lifetime and result-accounting defects fixed; still profile resource peaks, crowded combat, reconnects, concurrent rooms and Free-plan headroom. No billing changes authorized or made. |
| 13 | Final release | Source suites pass; full visual/mobile/performance gates and deployment verification remain. Work is pushed only to the `hark` branch; nothing merged to main and no production deployment performed. |

## Local commands

From `server/`: `npm ci`, `npm run build:worlds`, `npm test`, `npm run test:client`, then `npm run dev`.
From the repository root in a second terminal: `python3 -m http.server 8876 --bind 127.0.0.1`.
Open `http://127.0.0.1:8876/`; localhost clients use the local game service on port 8787. Local dev intentionally enables the Spike prototype for QA. These instructions do not change production mode availability.
