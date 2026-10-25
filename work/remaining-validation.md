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
