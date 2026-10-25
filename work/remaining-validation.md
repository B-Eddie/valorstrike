# Valorstrike acceptance ledger

Updated 24 October 2026 from the full [Instinct handoff](https://files.instinct.com/u6k7xnlbyeh0-valorstrike-shipped-and-still-open).

This is an implementation and evidence ledger, not a release sign-off. Source and browser checks below must not be represented as completion of the entire handoff.

## Implemented in this working tree

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
- All 16 default server regression files pass, including the added Reyna, Blade Storm, interaction, release-gate and reconnect-record cases.
- All 23 client regression files pass, including native contact/locomotion samples, loading/cancellation, renderer rebinding, identity/profile, maps, intents and new ability/HUD checks.
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
| 4 | Third-person rifle pose | Still open: replace pistol-like upper body, validate two-handed grip/fingers and orientation through all movement/aim states. |
| 5 | First-person weapons | Complete Sheriff/Split fingers, all weapons/knife, quality switches, reload/equip/fire timing, agent changes and crowded combat. |
| 6 | Feet/terrain/AI | Complete live slopes/stairs/aim/transition and multiple-agent traversal checks. |
| 7 | TDM/mobile | Complete tier unlock and respawn transitions plus portrait/landscape touch movement, aiming, HUD and Spike hold/release. |
| 8 | Minimap/selection | Room-map selection and cancel defects fixed; still inspect running-match orientation/visibility/markers on all six maps, mobile and Omen targeting. |
| 9 | Remaining abilities | Reyna and Blade Storm implementation added against the project's existing rules; integrated Spike visual acceptance remains. Other generic ults/devices/projectiles/channels still lack full parity. |
| 10 | Combat consistency | Native animated authoritative hit volumes, wall penetration and comprehensive projectile/device/LOS/smoke/flash/status behavior remain open. |
| 11 | Spike release gate | Interaction and explicit configuration gates improved; full round/economy/inventory/late-join/ability/browser acceptance remains. Do not enable production Spike yet. |
| 12 | Reliability/performance | Loading lifetime and result-accounting defects fixed; still profile resource peaks, crowded combat, reconnects, concurrent rooms and Free-plan headroom. No billing changes authorized or made. |
| 13 | Final release | Source suites pass; full visual/mobile/performance gates and deployment verification remain. No Git push or production deployment performed. |

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
