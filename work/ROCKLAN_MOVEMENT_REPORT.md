# Valorstrike movement-only Rocklan pass

MOVEMENT ONLY. The tree was restored to the exact `63f8fe64d749c6634273c92732f5f049712d0a79` archive before implementation: 99 inherited edits reverted, 108 inherited additions removed, and all 3,912 base files verified identical. This removed the previous broad weapon/ability/hit/death/device/plant work. No git commands, remotes, credentials or push were used.

The deliverable is a separate movement layer for the game's 12 native agent rigs. Original mixed locomotion assets and all original first/third-person weapon, ability, emote, hit, death, plant/defuse, device, skin, UI, VFX and camera data remain at base. Runtime movement hooks preserve original full-body and upper-body event actions and clocks. The scope verifier hashes every base file and checks that the page outside its single movement block, and generator outside its movement-install code, are byte-identical to base. Final evidence: `work/validation/movement-only/scope-proof.json`.

## Pack and game inventory

Reverified pack: 6,195 files; all 21 agent model folders, 98 agent `.blend` models, 32 weapon `.blend` models, and all 22 agent-animation folders including Shared. Shared contains 2,003 files total, of which 1,994 are PSA files; the original 2,003-PSA description counted its other files as well. The pack is complete and usable. Only specifically named Shared movement sources were opened for conversion. Maps remain deferred; per-agent ability and weapon animation libraries were not inventoried or converted.

The actual game movement inventory is normalized eight-direction ground motion; normal run, shift-walk, knife fast run/sprint posture, intermediate jog/power-walk, crouch and crouch-walk; crouch entry/exit and headroom; acceleration, braking, reversal/counter-strafe and stops; stationary heading changes; standing and crouched jumps, falls and landing; stairs, slopes, wall sliding, floor/ledge support, air steering and collision; and existing scripted fallback-map rope climbs/step-offs and jump/drop links. All eight directions are covered: `N, NE, E, SE, S, SW, W, NW`.

| Movement need | Available pack movement actions | Integration |
| --- | --- | --- |
| Ground idle/crouch idle | `TP_Core_Idle_LB`, `TP_Core_CrouchIdle_LB` | Copied lower-body poses; native sibling torso carry |
| Walk/run/intermediate jog/sprint/crouch-walk | `TP_Core_{Walk,Run,PowerWalk,Sprint,CrouchWalk}{N,NE,E,SE,S,SW,W,NW}_LB` | All 40 copied directional cycles; jog uses PowerWalk/Run transitions rather than inventing another donor |
| Movement lean | Corresponding eight-direction `*Add*_UB` movement sources | Spine-only deltas; crouch east is derived because its AddE source is absent |
| Crouch torso posture | Generic idle/crouch pose spines | Derived spine delta; no arm/weapon curves |
| Start/acceleration/gait changes | No generic authored start clip | Derived idle/gait crossfades responding to actual speed and estimated contact phase |
| Stops/deceleration | `TP_Core_StopAdd` (also test/subtract movement variants present) | Copied leg/pelvis and spine deltas; derived deceleration envelope |
| Turn in place | `TP_Core_{Turn,CrouchTurn}{E,W}{45,90,135,180}_LB` | All 16 copied replant/posture cycles; sampled from observed heading change without driving facing/camera |
| Jump | `TP_Core_Jump_LB`, `Jump{N,E,S,W}_LB`, `Crouch_Jump_LB` | Six copied sources; diagonal jumps blend adjacent cardinal poses |
| Air loop/fall | `TP_Core_Falling_LB`, `CrouchFalling_LB` | Copied in-place airborne curves, held after their duration on long drops |
| Land | `TP_Core_JumpLand_LB`, `JumpLandAdd_UB`, `Crouch_JumpLandAdd` | Copied lower/spine compression; derived short impact envelope |
| Jump torso | `TP_Core_JumpAdd_UB`, `Crouch_JumpAdd_UB` | Copied spines synchronized with selected lower takeoff phase |
| Rope traversal | Shared `Rope_{IdlePose,NavUp,NavDown}_LB`, `Rope_{Horizontal,NavForward,NavBack}Add_LB` | Only traversal lower channels copied; base weapon/aim handling excluded |
| Foot contact | Gait foot trajectories, no authored contact events | Estimated contact phase/cadence, existing vertical/terrain IK, and bounded support-foot XZ anchoring |
| Crouch entry/exit, direction changes, rope boundaries | No distinct generic sources | Explicit derived transitions below |

First-person movement-named sources were checked for channel ownership. Their animated channels are camera, clavicle/held-weapon or VFX channels rather than an additional lower-body movement set. Those uncertain/forbidden channels and every first-person handling animation remain untouched. Ability movement (dash, teleport, knockback, etc.) remains out of scope; the ordinary locomotion layer only reads resulting motion.

## Movement mechanics and evidence

No authoritative motor constants changed. The source ground cycles are in place: Root translation is static and net Splitter translation is approximately zero (sub-millimetre residuals). They prove cadence and pose differences, not world speeds, acceleration, friction, stop distances, gravity or rope speed. Source cycle durations are Walk 0.834568 s, Run 0.583784 s, PowerWalk 0.634921 s, Sprint 0.650407 s and CrouchWalk 0.901149 s.

| Implemented mechanic | Preserved base behavior |
| --- | --- |
| Speeds | Top speed `6.75 × existing held-item movement factor`; walking ×0.6; crouch factor blends to `2.5/6.75`. Existing rifle examples: run 5.4, walk 3.24, crouch 2.0 m/s; knife: 6.75, 4.05, 2.5 m/s |
| Acceleration | Top speed /0.288 s; crouched /0.472 s; directional input normalized |
| Release/braking/reversal | `ds/dt = −7.3625s − 46.5`; existing rifle release about 0.084 s and 0.203 m; existing reversal and speed-limit braking preserved |
| Crouch | 0.45 m height change, 0.276 s nominal transition, existing fatigue and headroom constraints |
| Jump/air/fall/land | Launch 6.902 m/s, gravity 20.45 m/s², existing 70 ms buffer, air acceleration 3.5 m/s², speed cap and momentum behavior; standing/crouched jumps retained |
| Locomotion collision | Radius 0.4 m, standing height 1.8 m minus crouch, 0.4 m step handling, existing wall slide/terrain/ceiling/ledge behavior |
| Scripted traversal | Existing fallback rope speed 3.5 m/s and step-off, existing scripted jump/drop behavior |
| Shared authority | `server/src/motor.cjs`, `vendor/valorant-feel.js`, `work/feel_runtime.js` remain byte-identical to base |

Animation mechanics changed: directional speed estimates replace a single rate for every direction; shared contact phase aligns gait/direction changes; actual speed determines cadence and acceleration/stop posture; crouch is retained while airborne; authored directional hips replace the former procedural strafe hip/counter-turn on this movement layer; source takeoff/compression windows avoid replaying the entire 3.2-second jump as another world arc; rope movement is distinguished from falling. Native limb lengths remain fixed. Only Pelvis owns absolute locomotion translation, and existing virtual Spine1 carry preserves the sibling hierarchy. Additive retargeting conjugates bone-axis corrections so neutral deltas remain identity.

The game currently implements scripted rope traversal only on fallback paths. Native maps disable these links, and the authoritative server has no zipline/ascender motor. The active player motor also supersedes the old legacy rope branch. This pass supplies the existing traversal poses; it does not invent a new player/server traversal mechanic without pack distance evidence. Ordinary stairs/wall/air motion keeps the shared motor. Sound cadence, accuracy and any ability/weapon modifiers remain unchanged.

[Riot's movement guide](https://support.riotgames.com/en-us/valorant/gameplay/walking-running-and-crouching) supports the walk/run/crouch state distinctions, and its [beginner guide](https://playvalorant.com/en-us/news/announcements/beginners-guide/) describes the gameplay importance of deliberate stopping. These are qualitative reference only. No source establishes the precise blend/envelope timings used here, and no gameplay footage was frame-matched.

## Per-animation provenance

Each row below is an output action on each of the 12 game rigs. **121 actions per rig: 119 COPIED, 2 EXTRAPOLATED** (1,452 per-agent outputs). COPIED means sampled pack bone curves with coordinate/bind-axis adaptation and preserved limb lengths; it does not mean byte-identical source files or exact final rendered parity. The separate transition/envelope ledger below labels runtime derivations even where the baked donor is COPIED. The binary header and provenance JSON retain exact source paths, SHA256 hashes, cadence and all per-agent directional contact estimates.

| Output movement action | Status | Source PSA action(s) / derivation |
| --- | --- | --- |
| `idle` | COPIED | `TP_Core_Idle_LB` |
| `crouch` | COPIED | `TP_Core_CrouchIdle_LB` |
| `crouchSpine` | EXTRAPOLATED | `TP_Core_CrouchPose_UB`, `TP_Core_IdlePose_UB` — Derive only the spine rotation difference between the generic pack IdlePose_UB and CrouchPose_UB to apply crouch torso posture over preserved weapon/arm actions. No weapon grip, aim, arm or hand channel is copied. |
| `walkN` | COPIED | `TP_Core_WalkN_LB` |
| `walkNE` | COPIED | `TP_Core_WalkNE_LB` |
| `walkE` | COPIED | `TP_Core_WalkE_LB` |
| `walkSE` | COPIED | `TP_Core_WalkSE_LB` |
| `walkS` | COPIED | `TP_Core_WalkS_LB` |
| `walkSW` | COPIED | `TP_Core_WalkSW_LB` |
| `walkW` | COPIED | `TP_Core_WalkW_LB` |
| `walkNW` | COPIED | `TP_Core_WalkNW_LB` |
| `lean_walkN` | COPIED | `TP_Core_WalkAddN_UB` |
| `lean_walkNE` | COPIED | `TP_Core_WalkAddNE_UB` |
| `lean_walkE` | COPIED | `TP_Core_WalkAddE_UB` |
| `lean_walkSE` | COPIED | `TP_Core_WalkAddSE_UB` |
| `lean_walkS` | COPIED | `TP_Core_WalkAddS_UB` |
| `lean_walkSW` | COPIED | `TP_Core_WalkAddSW_UB` |
| `lean_walkW` | COPIED | `TP_Core_WalkAddW_UB` |
| `lean_walkNW` | COPIED | `TP_Core_WalkAddNW_UB` |
| `runN` | COPIED | `TP_Core_RunN_LB` |
| `runNE` | COPIED | `TP_Core_RunNE_LB` |
| `runE` | COPIED | `TP_Core_RunE_LB` |
| `runSE` | COPIED | `TP_Core_RunSE_LB` |
| `runS` | COPIED | `TP_Core_RunS_LB` |
| `runSW` | COPIED | `TP_Core_RunSW_LB` |
| `runW` | COPIED | `TP_Core_RunW_LB` |
| `runNW` | COPIED | `TP_Core_RunNW_LB` |
| `lean_runN` | COPIED | `TP_Core_RunAddN_UB` |
| `lean_runNE` | COPIED | `TP_Core_RunAddNE_UB` |
| `lean_runE` | COPIED | `TP_Core_RunAddE_UB` |
| `lean_runSE` | COPIED | `TP_Core_RunAddSE_UB` |
| `lean_runS` | COPIED | `TP_Core_RunAddS_UB` |
| `lean_runSW` | COPIED | `TP_Core_RunAddSW_UB` |
| `lean_runW` | COPIED | `TP_Core_RunAddW_UB` |
| `lean_runNW` | COPIED | `TP_Core_RunAddNW_UB` |
| `powerWalkN` | COPIED | `TP_Core_PowerWalkN_LB` |
| `powerWalkNE` | COPIED | `TP_Core_PowerWalkNE_LB` |
| `powerWalkE` | COPIED | `TP_Core_PowerWalkE_LB` |
| `powerWalkSE` | COPIED | `TP_Core_PowerWalkSE_LB` |
| `powerWalkS` | COPIED | `TP_Core_PowerWalkS_LB` |
| `powerWalkSW` | COPIED | `TP_Core_PowerWalkSW_LB` |
| `powerWalkW` | COPIED | `TP_Core_PowerWalkW_LB` |
| `powerWalkNW` | COPIED | `TP_Core_PowerWalkNW_LB` |
| `lean_powerWalkN` | COPIED | `TP_Core_PowerWalkAddN_UB` |
| `lean_powerWalkNE` | COPIED | `TP_Core_PowerWalkAddNE_UB` |
| `lean_powerWalkE` | COPIED | `TP_Core_PowerWalkAddE_UB` |
| `lean_powerWalkSE` | COPIED | `TP_Core_PowerWalkAddSE_UB` |
| `lean_powerWalkS` | COPIED | `TP_Core_PowerWalkAddS_UB` |
| `lean_powerWalkSW` | COPIED | `TP_Core_PowerWalkAddSW_UB` |
| `lean_powerWalkW` | COPIED | `TP_Core_PowerWalkAddW_UB` |
| `lean_powerWalkNW` | COPIED | `TP_Core_PowerWalkAddNW_UB` |
| `sprintN` | COPIED | `TP_Core_SprintN_LB` |
| `sprintNE` | COPIED | `TP_Core_SprintNE_LB` |
| `sprintE` | COPIED | `TP_Core_SprintE_LB` |
| `sprintSE` | COPIED | `TP_Core_SprintSE_LB` |
| `sprintS` | COPIED | `TP_Core_SprintS_LB` |
| `sprintSW` | COPIED | `TP_Core_SprintSW_LB` |
| `sprintW` | COPIED | `TP_Core_SprintW_LB` |
| `sprintNW` | COPIED | `TP_Core_SprintNW_LB` |
| `lean_sprintN` | COPIED | `TP_Core_SprintAddN_UB` |
| `lean_sprintNE` | COPIED | `TP_Core_SprintAddNE_UB` |
| `lean_sprintE` | COPIED | `TP_Core_SprintAddE_UB` |
| `lean_sprintSE` | COPIED | `TP_Core_SprintAddSE_UB` |
| `lean_sprintS` | COPIED | `TP_Core_SprintAddS_UB` |
| `lean_sprintSW` | COPIED | `TP_Core_SprintAddSW_UB` |
| `lean_sprintW` | COPIED | `TP_Core_SprintAddW_UB` |
| `lean_sprintNW` | COPIED | `TP_Core_SprintAddNW_UB` |
| `crouchWalkN` | COPIED | `TP_Core_CrouchWalkN_LB` |
| `crouchWalkNE` | COPIED | `TP_Core_CrouchWalkNE_LB` |
| `crouchWalkE` | COPIED | `TP_Core_CrouchWalkE_LB` |
| `crouchWalkSE` | COPIED | `TP_Core_CrouchWalkSE_LB` |
| `crouchWalkS` | COPIED | `TP_Core_CrouchWalkS_LB` |
| `crouchWalkSW` | COPIED | `TP_Core_CrouchWalkSW_LB` |
| `crouchWalkW` | COPIED | `TP_Core_CrouchWalkW_LB` |
| `crouchWalkNW` | COPIED | `TP_Core_CrouchWalkNW_LB` |
| `lean_crouchWalkN` | COPIED | `TP_Core_CrouchWalkAddN_UB` |
| `lean_crouchWalkNE` | COPIED | `TP_Core_CrouchWalkAddNE_UB` |
| `lean_crouchWalkE` | EXTRAPOLATED | `TP_Core_CrouchWalkE_UB`, `TP_Core_CrouchWalk_Subtract_UB` — The pack lacks CrouchWalkAddE_UB. Subtract the pack CrouchWalk_Subtract_UB reference from its CrouchWalkE_UB spine rotations to derive the movement-only E additive; preserve all arm/weapon tracks. |
| `lean_crouchWalkSE` | COPIED | `TP_Core_CrouchWalkAddSE_UB` |
| `lean_crouchWalkS` | COPIED | `TP_Core_CrouchWalkAddS_UB` |
| `lean_crouchWalkSW` | COPIED | `TP_Core_CrouchWalkAddSW_UB` |
| `lean_crouchWalkW` | COPIED | `TP_Core_CrouchWalkAddW_UB` |
| `lean_crouchWalkNW` | COPIED | `TP_Core_CrouchWalkAddNW_UB` |
| `jump` | COPIED | `TP_Core_Jump_LB` |
| `jumpN` | COPIED | `TP_Core_JumpN_LB` |
| `jumpE` | COPIED | `TP_Core_JumpE_LB` |
| `jumpS` | COPIED | `TP_Core_JumpS_LB` |
| `jumpW` | COPIED | `TP_Core_JumpW_LB` |
| `crouchJump` | COPIED | `TP_Core_Crouch_Jump_LB` |
| `fall` | COPIED | `TP_Core_Falling_LB` |
| `crouchFall` | COPIED | `TP_Core_CrouchFalling_LB` |
| `land` | COPIED | `TP_Core_JumpLand_LB` |
| `turnE45` | COPIED | `TP_Core_TurnE45_LB` |
| `turnE90` | COPIED | `TP_Core_TurnE90_LB` |
| `turnE135` | COPIED | `TP_Core_TurnE135_LB` |
| `turnE180` | COPIED | `TP_Core_TurnE180_LB` |
| `turnW45` | COPIED | `TP_Core_TurnW45_LB` |
| `turnW90` | COPIED | `TP_Core_TurnW90_LB` |
| `turnW135` | COPIED | `TP_Core_TurnW135_LB` |
| `turnW180` | COPIED | `TP_Core_TurnW180_LB` |
| `crouchTurnE45` | COPIED | `TP_Core_CrouchTurnE45_LB` |
| `crouchTurnE90` | COPIED | `TP_Core_CrouchTurnE90_LB` |
| `crouchTurnE135` | COPIED | `TP_Core_CrouchTurnE135_LB` |
| `crouchTurnE180` | COPIED | `TP_Core_CrouchTurnE180_LB` |
| `crouchTurnW45` | COPIED | `TP_Core_CrouchTurnW45_LB` |
| `crouchTurnW90` | COPIED | `TP_Core_CrouchTurnW90_LB` |
| `crouchTurnW135` | COPIED | `TP_Core_CrouchTurnW135_LB` |
| `crouchTurnW180` | COPIED | `TP_Core_CrouchTurnW180_LB` |
| `ropeIdle` | COPIED | `TP_Core_BasePistol_S0_Rope_IdlePose_LB` |
| `ropeUp` | COPIED | `TP_Core_BasePistol_S0_Rope_NavUp_LB` |
| `ropeDown` | COPIED | `TP_Core_BasePistol_S0_Rope_NavDown_LB` |
| `ropeHorizontal` | COPIED | `TP_Core_BasePistol_S0_Rope_HorizontalAdd_LB` |
| `ropeForward` | COPIED | `TP_Core_BasePistol_S0_Rope_NavForwardAdd_LB` |
| `ropeBack` | COPIED | `TP_Core_BasePistol_S0_Rope_NavBackAdd_LB` |
| `stopLower` | COPIED | `TP_Core_StopAdd` |
| `stopSpine` | COPIED | `TP_Core_StopAdd` |
| `jumpSpine` | COPIED | `TP_Core_JumpAdd_UB` |
| `crouchJumpSpine` | COPIED | `TP_Core_Crouch_JumpAdd_UB` |
| `landSpine` | COPIED | `TP_Core_JumpLandAdd_UB` |
| `crouchLandLower` | COPIED | `TP_Core_Crouch_JumpLandAdd` |
| `crouchLandSpine` | COPIED | `TP_Core_Crouch_JumpLandAdd` |

## Extrapolated runtime movement, with derivation

| Movement/transition | Status | Derivation |
| --- | --- | --- |
| Start, acceleration and gait transitions | EXTRAPOLATED | Idle plus copied directional Walk/PowerWalk/Run/Sprint poses, weighted by actual velocity; no generic start donor |
| Crouch entry/exit and airborne crouch | EXTRAPOLATED | Copied idle/crouch and standing/crouched air sources interpolated from replicated crouch intent; ordinary native crouch correction retained |
| Diagonal/direction changes | EXTRAPOLATED | Adjacent copied 45° gait sources blend at an estimated shared left-foot contact phase |
| Jog alias | EXTRAPOLATED | Game's intermediate jog uses copied PowerWalk/Run donors; no separate generic Jog source claimed |
| Diagonal jump | EXTRAPOLATED | Adjacent copied N/E/S/W takeoff poses blend; neutral/crouch jump donors remain separate |
| Jump start to air / long fall | EXTRAPOLATED | Select a 0.16 s pose window around source extension, then copied falling curve; hold the final air sample for drops longer than the donor |
| Standing/crouched landing | EXTRAPOLATED | Source compression extrema aligned to a 0.30 s impact envelope; impact strength reads existing vertical motion; no gravity/physics changes |
| Deceleration/stop | EXTRAPOLATED | Copied StopAdd leg/spine deltas under a 0.22 s observed-deceleration envelope; source duration is not treated as motor stop time |
| Turn response | EXTRAPOLATED | Pick copied E/W angle variants from stationary heading changes; sample proportionally to observed rotation and smoothly release; no camera/facing changes |
| Rope attach/detach/step-off | EXTRAPOLATED | Copied rope poses and traversal deltas crossfade with ordinary ground/falling poses at existing scripted traversal boundaries |
| Ground foot planting | EXTRAPOLATED | Per-direction foot trajectory estimates synchronize cycles; bounded, reachable leg IK anchors the support ankle XZ during usable stances, retaining terrain Y and authored world foot rotation |

Missing sources were derived from present movement sources rather than silently omitted. No non-movement action was extrapolated.

## Files and verification

Changed existing files: `index.html` (one isolated movement block), `work/install_valorant.py` (movement block installation and asset hashes). Added: `work/build_rocklan_movement.cjs`, `work/rocklan_movement_runtime.js`, `work/rocklan_movement_harness.cjs`, the two movement test files, `work/verify_rocklan_movement_scope.py`, this report and movement-only validation evidence. New assets: `models/valorant/movement/movement.json`, `movement.bin`, `tp-movement-baked.glb`, `provenance.json`. All other original files are required to match base exactly; test-generated worlds are removed after validation.

TEST_RESULTS_PENDING_FINAL_VALIDATION

## What matches and what remains unproven

The baked movement poses, source sample cadence, all eight directional gaits, movement spine deltas, crouched air set, turns and rope poses originate in Rocklan's fan-extracted pack. They are not official Riot data. State selection and physics respond to Valorstrike's existing shared motor; extrapolated transitions and contact IK are implementation choices.

**No exact Riot parity is claimed. No rendered browser comparison was performed from this sandbox.** Numerical curve/skin/IK tests cannot establish visual parity, fully eliminate sliding at every contact transition, or prove every terrain/network/heading case. Directional foot-speed/contact markers are estimates rather than authored events. Landing/start/stop/turn envelopes, torso layering and rope handoff quality still need rendered review. Existing native-map/player/server traversal limitations are described above.

**Blender export remains an unmet requirement.** Blender was not installed, no usable local portable installation/package was found, and the portable download failed because the configured proxy was unreachable. Baked GLB keyframes were produced by direct ActorX PSA parsing and GLTF serialization, not Blender export. This workflow and the fan-extracted provenance are stated plainly in the generated assets.

No usage/rate limit was encountered during this pass.
