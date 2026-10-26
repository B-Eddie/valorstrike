Studied all seven supplied local gameplay references, including short video sequences sampled with ffmpeg. The observations and inspected timestamps are in ../reference/gameplay-study.md. They informed the restrained weapon motion and movement/stop rhythm; this is a closer match, not a verified exact reproduction of Riot's private animation system.

Implemented changes:

- Offline bot movement now integrates the player's shared ground acceleration and friction in actual m/s. Walking, crouching, tagging and ability slowdowns are applied before integration. Stops/reversals reach rest without the old exponential tail. Collision removes blocked-axis velocity, and respawns reset old motion.
- Bot shooting and spread use endpoint speed with the weapon's movement accuracy threshold; a frame-average can no longer hide a fast reversal. Existing tight, wide and jiggle peek patterns keep their distinct timing.
- First-person native weapons react to actual camera-local velocity, with restrained lateral lag, stop/reversal inertia, reduced bob, and quieter ADS. World-camera motion stays level. Authored equip, reload and firing timers are preserved. Respawns clear old drift.
- Remote bot/player pitch uses authoritative snapshot np, interpolated alongside yaw before animation sampling. Remote units bypass the extra AI yaw smoothing. Offline bots retain selected head/body/utility aim instead of reconstructing it from the local viewer. Gun grip consumes the explicit world direction, including vertical shots; off-fight guns return to level.

Validation:

- reference-client-tests.log: 25/25 focused client regression files passed, including the three new aim/movement/view-motion regressions, native grip/stride/crouch/locomotion, FP timing, movement sampling, accuracy, utility targeting and network reconciliation.
- Bot aim: 75 network yaw/pitch combinations on native agent/weapon rigs, maximum angular error 0.000892 degrees; additional actual offline head/body/device firing paths, raised floors, vertical aim, snapshot interpolation and current-frame animation ordering passed.
- Bot motor: identical 0.2034 m full-rifle stop distance at 20/30/60/120/240 Hz; walk/tag stop distance and duration, crouch acceleration, stop/reverse/jiggle holds, endpoint-speed shooting gate, collision and respawn reset passed.
- FP handling: mirrored strafes, no procedural idle/wall drift, stop settling, 30/144 Hz agreement, ADS damping/optic alignment and life resets passed. Existing FP timing checks cover 144 cadence cases and authored native clips.
- reference-online-gunplay.log: real page/server gunplay passed with no page exceptions.
- reference-client-online.log: TDM/DM/Spike client/server soak passed with no page exceptions.
- reference-client-lifecycle.log: 24 matches across every offline mode and all six maps passed; no page exceptions or per-match resource growth detected by the existing test.
- Generated runtime rebuild is idempotent.

Environment setup and limits:

npm ci was attempted in server/ before dependency-backed tests, then retried with a writable /tmp cache. Both attempts failed because the sandbox denied registry fetches with EPERM. Matching local packages (three 0.160.1, three-mesh-bvh 0.7.8, ws 8.22.0) were copied from ../valorstrike-prev/server/node_modules; the server lockfiles match. Missing server/public/worlds test assets were regenerated with server/build-all.cjs. These dependency/world directories are ignored generated files.

Chromium launch was attempted with both installed browser binaries; sandbox process/socket restrictions prevented a rendered browser comparison. Native rigs were loaded and world transforms exercised in Node for the aim and animation checks. The complete optional test_all suite was not run; the focused and integration checks above completed.

The extract has no Git metadata. No push, remote configuration or credential setup was attempted. Edited source/runtime blocks and regression tests remain in the workspace.
