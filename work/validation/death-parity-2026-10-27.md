# Death parity spec (vs-lane-death, 2026-10-27)

User (23:01 2026-10-27): "Fix what happens when character dies. It looks really weird right now. Just copy Valorant."

## What VALORANT does (sources)

| # | Behaviour | Source | Confidence |
|---|---|---|---|
| V1 | On death the victim drops its **primary** (sidearm if no primary) to the floor; anyone can pick it up; a resurrected agent gets it back only if nobody took it. | wiki.playvalorant.com/en-us/Weapons ("Agents automatically drop their Primary weapon (Or Secondary weapon if they do not have a Primary) when they die") | verified |
| V2 | Corpses stay on the ground for the rest of the round in round modes: Cypher's Neural Theft targets "the corpse of any dead enemy agent in range", the corpse time restriction was removed in 5.10; Sage Resurrection / Clove target a corpse. | wiki.playvalorant.com/en-us/Neural_Theft (v5.10: "Time restriction to cast on enemy corpses removed") | verified (by implication) |
| V3 | Death is an animated collapse (not a floppy physics ragdoll): the body drops at once so nobody mistakes it for alive; there have been bugs where a corpse "remained upright" (8.07 Clove fix) — upright/T-pose corpses are bugs. | playvalorant.com patch notes 8.07; ResetEra launch thread ("immediately dropping to the floor … not … ragdoll physics flapping") | verified (bug note) / community |
| V4 | Victim's camera: a **death camera** detaches from the eyes, **pulls back out** of the body and **looks at the killer at head height**; it must not get stuck in walls (Riot dev oniram177, 2025: "the intent should be that you end up looking at the … head height portion of the player"; "the camera couldnt pull out far enough … if you were up against a wall"; "camera is always supposed to be above where its trying to look"). Patch 1.0: "Updated the death camera to avoid obscuring the screen immediately after death." | devtrackers.gg/valorant/p/b8f3a088-new-death-animation-disorienting ; patch 1.0 notes (millenium.gg mirror) | verified |
| V5 | After the death camera, the dead player spectates a **living teammate** (no enemy cam, no free cam); left/right click = next/previous. No separate replay killcam. | clip.dor.gg killcam article ("Valorant has no separate killcam … you naturally transition to spectating a living teammate"); ntgame spectating table | verified |
| V6 | A **Combat Report** pops up on death (toggle **N**): the killer and per-enemy damage dealt / received; utility statistics only after the round (9.10). | support.riotgames.com VALORANT UI Settings FAQ ("You can show or hide the combat report that pops up when you die by pressing N"); Patch 9.10 notes | verified |
| V7 | Deathmatch: respawn at a random spot after a short delay; Team Deathmatch: respawn every **1.5 s** in the spawn room; no spectating between lives. | wiki Deathmatch / Team Deathmatch; playvalorant TDM 101 ("Respawn frequency: 1.5s") | verified |
| V8 | Bodyfall / death audio plays at the corpse (13.08 fix "bodyfall audio events … at proper location"), agent death vocal. | patch notes 13.08 | verified (exists) |
| V9 | Death camera exact length (time before teammate spectate) | not found in an official source | **unverified** — kept our 2 s |
| V10 | Corpse fate in DM/TDM (respawn modes) | not found | **unverified** — we keep the body ~6 s then sink it out (no pop) |

## What ours did (origin/main 29c6e23) — why it "looks weird"

* Bot/ally corpses **popped out of existence 4 s after death** (repair wrapper `age>4` → `scene.remove`); the old 3 s fade only touched the team-ring material, so the rig vanished in one frame.
* The ragdoll always fell **backwards from the victim's facing** — `M.ragHit` (killing-shot direction) was never set in the game, only in tests.
* Gun: `xDie` **teleported** the corpse gun to a fixed spot at the victim's foot height (floats/clips on slopes, stairs and native-map floors), and in 5v5 a **second** pickup gun (`xdDrop`, online `netFloor`) appeared at the feet under the body → two guns, one inside the corpse.
* Victim's camera stayed frozen at its own eyes (grey filter) for 2 s, FP gun still drawn — no pull-out, no look at the killer, no own body.
* "KILLED BY" card: initials on a hashed colour instead of the agent portrait; hidden when spectating started, no N toggle.

## Target (implemented in work/death_runtime.js unless noted)

1. Corpse falls away from the killer (`ragHit` = killer→victim, headshot pushes a little harder), on the floor, finite, no T-pose.
2. Round modes (5v5 / Skirmish / Escalation-free rounds): corpses stay until the round resets (buy phase / new round / mpReset) or the agent is revived; respawn modes and the rest: kept 6 s then sink 0.6 m into the floor over 0.8 s and removed.
3. One gun per death: the gun leaves the hand with a short toss (along the fall, up 1.2 m/s, spin), stops at walls, lands **at the floor height under its landing spot** (groundAt / nav floor), lying on its side. 5v5 offline: that falling gun is the pickup (`xdDrop` entry moved to the landing spot); online: the server row is authoritative, the floor gun drops from the hand onto its server spot; the corpse copy is removed. Spike: unchanged (existing drop).
4. FP death camera (offline + online): own corpse spawned (agent rig, same ragdoll), camera eases 0.6 s from the eyes up/back away from the killer (2.4 m back, 0.9 m up, clamped 0.3 m short of walls, kept above the look target), turns toward the killer's head while keeping the own body in frame (look direction 70 % killer head / 30 % corpse — our framing choice; VALORANT's exact framing unverified), falls back to the own corpse with no killer, viewmodel + crosshair hidden; then the existing teammate spectate.
5. Combat report: killer agent portrait (fallback initials), killer name, agent · weapon, dealt / taken; stays up while spectating; **N** toggles.
6. DM/TDM: untouched respawn rules (1.5 s), no spectate, death cam only until respawn.

Out of scope / not touched: locomotion animations, the shared motor, server rules (no server change → no worker redeploy).
