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
- split:  ASCENT PASS (23 nodes, +4.02m; 4 stall samples) / DESCENT FAIL
PROBE-FINDING (candidate real bug): on split, walking DOWN from the top of the flight at
(19, 7.04, 21.25) the player cannot leave the top node: 2 runs x 2 attempts, 45s each, position
unchanged (end [19, 7.1, 21.3]). Ascent up the same flight works. Not yet root-caused: could be a
collision/railing mismatch at the stair mouth or a step-down bug. Needs targeted investigation
(teleport 2 nodes down and descend; inspect collision vs nav at the mouth).
Probe notes: bots are culled each poll (kill()) because DM respawns wanderers that body-block the
stair base (observed); one retry per leg guards residual interference. A fixed-yaw aim flaw in the
probe itself was found via bind (straight flight, diagonal first node) and fixed by per-poll re-aim.
