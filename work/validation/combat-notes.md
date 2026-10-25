# Combat branch notes (`hark-combat`)

Findings and evidence for the combat/reliability items worked on `hark-combat`. This file is separate from
`work/remaining-validation.md` (owned by the `hark` branch work) and does not sign anything off.

## 1. Online aim pitch sign (fixed)

- The online input loop sent `p:-pitch`. The camera (`camera.rotation.set(pitch + rcl, ...)`, YXZ), server shots
  (`Simulation.fire`), bots and abilities all treat positive pitch as up, so aiming down sent shots upward online.
- Fix: `netInputMsg()` in `work/server_runtime.js` sends `p:pitch`.
- Regression: `work/test_online_pitch.cjs` compares the three.js camera forward, the input message and the server
  shot direction, and hits targets 3 m below and above. With the old sign the test fails.

## 2. Combat consistency, ledger row 10

### Hit volumes
- Before: server spheres (head r .19 at 1.62 m, body r .42 at .95 m, legs r .32 at .35 m) centred on the root.
  The client's bone-following hitboxes (repair_runtime.js `xrHitboxes`) put the head sphere (r .195) 0.08 m above
  the Head bone, about 1.81 m on a standing agent and 0.14 m forward of the root, so the server head was about 0.19 m
  low and centred on the wrong point. Remote crouch was never sent (row index 13 is ping), so remote
  rigs rendered standing while the server lowered the head.
- Now: `server/src/hitboxes.js` + `server/src/hitboxes.json`. The table comes from the real agent rigs through
  `work/build_hitbox_poses.cjs`. It uses the same lower/upper track split as `xvaKit`, the crouch weight 0.62 from
  `xUbAnim`, the `Pistol_Aim_Neutral` upper layer, and 8 animation phases for each of the 12 agents. Mean poses stay within 6 cm of every agent.
  The server picks stand / walk-run blend / crouch / crouch-walk / air from Motor state (speed, `ch`, `air`).
  The head sphere and body capsule are oriented with facing, and legs are body hits below 0.9 m (scaled with crouch).
  Sizes equal the client's (`test_combat_consistency.cjs` asserts this against the source).
- Crouch lowers the head by `ch` (up to 0.45 m), the same as the first-person eye drop.
- Rows now carry `[17]` crouch fraction and `[18]` aim pitch. The online client sets `u.cr` from `[17]`, so remote
  rigs play the crouch layer, and stores `u.np` for future aim-pitch rendering.
- **Rendering defect for the animation owner (not changed here):** with native rigs (`nativeContact:true`) the
  repair crouch correction (`standHead - .45*cb`) is skipped. With the aim upper layer the rendered crouched head drops
  only about 4 cm (1.735 → 1.693 m) even though the pelvis drops 0.32 m. The comment in `xUbAnim` says the
  intended drop is about 0.45 m, matching the hitbox. Until the third-person crouch pose lowers the head, a crouched
  agent's rendered head sits above its authoritative head volume. The numbers come from
  `node work/build_hitbox_poses.cjs --one jett`.
  After animation changes (rifle pose, ledger row 4), re-run `node work/build_hitbox_poses.cjs` to refresh the table.
- Approximations: upper-body aim pitch (`X.pit`) and strafe hip yaw are not modelled, and neither is support-foot contact
  correction (a few cm). Additive fire/hit clips are also left out.

### Wall penetration
- The server had none: any wall stopped every bullet. The offline client wallbanged by name regexes that
  disagreed with the official data (Sheriff, Operator, Guardian, Outlaw, Ghost).
- Now: `Simulation.penetrate()` uses `weapons.json` `wallPenetration`, with the client's tier sizes: High 0.6 m at 75%,
  Medium 0.35 m at 50%, Low 0.15 m at 50%. It penetrates one wall at most and measures thickness with a reverse BVH ray (like `xThin`).
  The client's `xPen` now uses the same official tiers.
- Sage barriers stop bullets and cannot be wallbanged. `SpikeSimulation.traceShot` uses the base world plus barriers
  and flags `shotBlockedBy`, and `shotImpact` damages the barrier.

### Smoke, LOS, devices
- Server smokes were radius-3 spheres centred on the floor, and the rendered smoke is a radius-4 sphere 1.8 m up.
  Now `SMOKE={radius:4,lift:1.7}` (p[1] is floor+0.1). `smokeBlocks` is a proper segment test, so a viewer inside
  smoke cannot see out. The online client renders replayed smokes on the floor they landed on, not at an absolute 1.8 m.
- Bot sight: `Simulation.canSee()` is overridden in Spike by `sightClear` (geometry + barrier + smoke) on the bot's
  actual chosen target. The old Spike check tested the first listed enemy, not the nearest one the bot aimed at.
- Flash/leer and the turret use `sightClear` from the victim's eye. Flash facing is now 3D (yaw and pitch) with the client's
  `dot > 0.5` and within range. Blasts and fire zones keep geometry-only LOS.
- Bullets still pass through smoke, as in VALORANT. Smoke blocks sight, which stops bots aiming and firing.

### Status ownership (server vs client)
- Online, replayed enemy casts (`mpFx`) also applied local whiteout (`enPop`), Leer nearsight (`pNs`) and
  concussion (`mpStun` → `xConStart`) using the client's own range/facing guesses. These ran on top of the server's private
  status, so players got double or phantom effects. Now replay is visual only online, and blind, nearsight and concussion come only from
  `mpCliRS` status.

Tests: `server/test-combat.js` (in `npm test`), `work/test_combat_consistency.cjs` (in `test:client`).

## Bot personalities (user request, after row 10)

- Before: every bot ran the same code with the same constants (`reactionAt = .2 + (id%4)*.07`, same sine strafe,
  exact aim, straight A* routes). Under the same conditions they moved identically.
- Now: `server/src/bots.js`. Each bot gets a deterministic seed (`name|id|map`) and its own mulberry32 stream,
  separate from the shared weapon-spread RNG. Roles (entry, anchor, lurker, support) rotate per team, seeded by map, so each
  team mixes roles. Each bot also draws its own reaction time, aim error (smooth and settling during an engagement),
  head-vs-body aim choice, strafe style (sine weave, random switch, jiggle peek), crouch-spray and its range,
  engagement range band (entries close in, anchors hold), hold pauses, lurker flank waypoints, repath interval, node acceptance
  radius, lateral path jitter, walking near targets, and utility delay.
- Spike: each bot takes its own spot inside the site, and lurkers flank. Exact goals are kept for spike pickup and
  carrying. Utility is cast by role on each bot's timing through the normal `ab` command (charges and cooldowns apply).
- All of this runs on the server simulation, so online play is authoritative.
- Test: `server/test-bots.js`. The same seed replays exactly; four bots from identical starts diverge more than 1.5 m and
  act differently; engagement aim, strafe and first shot differ; filled matches mix roles; spike goal offsets work.
- Sanity: 60 s Ascent TDM with 9 bots, 18 kills, everyone moved (`/tmp` bench, not committed).

## Background-tab disconnect (task after bot personalities)

- Defect: the room drops a ready session after 15 s without any message. The client's only traffic was a 50 ms
  `setInterval` input loop, which browsers throttle in hidden tabs (about 1 Hz, then once a minute after ~5 min of
  Chrome intensive throttling), so switching tabs could drop a player.
- Client (`work/server_runtime.js`, "Background-tab liveness"): on `visibilitychange` it sends `{t:'vis',h}`. On hide it also releases
  held keys/fire and sends one idle input. A dedicated Worker timer (Blob worker, 2 s) sends `{t:'hb'}` while the tab is hidden; worker timers
  are not subject to the page timer throttling. The input loop also re-sends `vis` if the hidden state ever differs from what was last sent.
- Server (`server/src/worker.js`): `GameRoom.IDLE = {ready:15000, hidden:150000, loading:180000}`. `hb` only refreshes
  liveness (no input, no reply); `vis` sets `session.hidden` and clears the unit's input when hiding. A hidden client gets 150 s
  (covers once-a-minute throttled timers even if the Worker is unavailable); a client that goes truly silent is still dropped.
- Test: `server/test-background.js` (in `npm test`): visible silent drop at 16 s, hidden seat kept across 4 × 60 s throttled
  inputs and 200 s of heartbeats only, input released on hide, normal limit restored on show, hidden silent drop at 150 s, and the
  client block run in a VM (listener, key release, idle input + vis, one Worker, heartbeat only while hidden).
- Not verified in a real backgrounded browser tab (no Chromium in this sandbox).
