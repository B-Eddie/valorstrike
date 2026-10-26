# Movement and weapon calibration

The game uses the native VALORANT first-person arm and weapon clips already recorded in [asset sources](models/valorant/SOURCES.md). Equip and reload playback follows gameplay timers; short crossfades join actions. A separate weapon camera preserves the model proportions during ADS. Look sway, distance-driven footsteps and weapon bob, landing motion, crouch transitions, and blended third-person walk/run playback provide movement feedback.

`vendor/valorant-feel.js` owns the deterministic character motor and accuracy cone. It substeps long frames, integrates acceleration/displacement analytically, normalizes diagonals, brakes on release/reversal, limits air steering, slides against walls, buffers jump presses, prevents held-jump repetition, checks ceilings, and gates uncrouching under cover. Native maps use their triangle collision BVH. Shift and crouch combine using the slower stance speed. Scoped movement applies each gun's multiplier once.

`models/valorant/weapon-calibration.json` is a local snapshot of [Valorant API weapon stats](https://valorant-api.com/v1/weapons), retrieved 2026-10-24. It supplies the 18 existing guns' magazines, damage ranges, fire rates, movement multipliers, ADS ratios, first-shot error, equip times and reload times. The game does not depend on that service at runtime. Regenerate with `python work/build_weapon_calibration.py` when intentionally updating the snapshot.

Public gunplay references:

- [Riot patch 3.0](https://playvalorant.com/en-us/news/game-updates/valorant-patch-notes-3-0/): 27.5% movement-accuracy deadzone and 72.5% tagging slowdown.
- [Riot patch 1.09](https://playvalorant.com/en-us/news/game-updates/valorant-patch-notes-1-09/): Operator 15% accuracy deadzone, 0.72 scoped movement ratio, 0.6 rounds/second and landing accuracy behavior.
- [Riot patch 9.10](https://playvalorant.com/en-us/news/game-updates/valorant-patch-notes-9-10/): revised walking/running error, Phantom damage falloff and pistol magazines. The local API snapshot supplies the current numeric weapon tables.

Mouse sensitivity uses 0.07 degrees per input count per sensitivity unit (default 0.4), with proportional scoped sensitivity. The reference world view is 103° horizontal at 16:9; the vertical field of view remains fixed when resizing.

Movement physics follow public frame-by-frame measurements of VALORANT ([VALORANT Physics: Explained](https://docs.google.com/document/u/2/d/e/2PACX-1vTsGYzGYiO78fcr_frhhBmzDaMvEqgBRd3b5u7TNzXRAhKflvFOovleWmavebIfFywh3DHppT75xHAk/pub), summarised in [r/VALORANT](https://www.reddit.com/r/VALORANT/comments/utc7qf/valorant_physics_derived)): every stance reaches its top speed in 0.288 s (acceleration scales with the speed limit; crouched 0.472 s); releasing all keys follows dv/dt = -(7.3625 v + 46.5) m/s² (rifle stop ≈ 84 ms / 0.20 m, knife ≈ 99 ms); counter-strafing brakes with friction plus acceleration (≈ 66 ms from rifle speed); jump launch 6.902 m/s under 20.45 m/s² gravity (1.165 m apex, 0.675 s airtime); crouch-walk 2.5 m/s with the knife (0.37×); a full crouch takes 0.276 s; crouch-jumping is allowed. Walking is 0.6× (Riot's 2020 weapon data: Classic run 5.73 / walk 3.43 m/s; the wiki's "33 % slower" differs and is noted in `work/validation/valorant-parity.md`). Landing keeps momentum (bunny hopping preserves but never adds speed) and air speed never exceeds melee speed ([patch 12.09](https://playvalorant.com/en-gb/news/game-updates/valorant-patch-notes-12-09)). The camera stays level while running; landing gives a small spring dip (≤ 2.5 cm, level again in ~0.3 s) instead of a step. Online, the page reconciles each snapshot against its own predicted path at the moment the server's position describes (last applied input + time applied, rows 19–20), so jumps and strafes are no longer pulled back toward the past.

Crouch fatigue, air control (3.5 m/s²), landing-accuracy duration, visual springs, spread recovery and recoil drift are this project's approximations. They are centralized for tuning rather than claimed to reproduce Riot's private controller or recoil implementation. Third-person locomotion remains the credited retargeted Quaternius animation set; it is not native VALORANT locomotion. The separate surf practice mode retains its own controller.

## Skipping diagnosis and correction

The skeleton mixer previously ran in its own requestAnimationFrame callback, before the main loop applied movement and animation weights. Visible rigs beyond half the animation LOD distance also held every other pose. Skeleton evaluation now runs after movement and locomotion weights, immediately before rendering, at every visible frame. Bone-following hitboxes refresh after that evaluation. Offscreen rigs remain culled.

The retargeted jog deliberately preserved a flight curve exceeding 8 cm, then played at up to 2.35× to match ground speed. Grounded stride lift now retains 15% of that curve, capped at 2 cm in rig space. The correction moves the whole rig wrapper, including helper-bone skin influences; moving Splitter alone left some agents' feet floating. Jump, landing, plant and death poses bypass this grounded correction. Distance-matched playback remains in place to avoid foot skating. Terrain foot correction uses the actual pose timestep and exponential smoothing instead of an assumed 60 Hz.

Online prediction previously advanced at most 50 ms per rendered frame, losing movement time below 20 FPS. It now substeps elapsed frames up to 250 ms, with a distinct historical timestamp for each predicted sample. Longer stalls remain bounded. The shared motor's calibrated speeds, braking, jump arc and collision behavior are unchanged. These fixes improve timing and presentation; they do not establish exact equivalence with Riot's private controller and animation assets.

## Verification

- `node work/test_feel.js`: 72 deterministic checks (incl. 0.288 s acceleration, 84 ms / 0.20 m stop, counter-strafe, 1.165 m apex, 0.675 s airtime, no landing slowdown, jump spam capped at melee speed, crouch-jump, 0.276 s crouch) for refresh-rate independence, weapon/stance/tag speeds, diagonal normalization, stopping, jumping, landing accuracy, wall sliding, ceiling clearance and accuracy thresholds.
- `node work/test_net_reconcile.cjs`: online reconciliation against the predicted path (no snaps or vertical pulls on a jump-spamming run at 40 ms each way; the legacy rule snaps it).
- `node work/test_movement_sampling.cjs`: visible pose sampling at 120 Hz across animation LOD distances, render ordering, pause/culling, and online motor distance/acceleration at 4–144 FPS with ordered prediction timestamps.
- `node work/test_native_stride.cjs`: actual packed clips and skinned support-foot vertices for all 12 agents stay within 2 cm of the floor at rifle speed; real airborne poses bypass correction.
- `node work/verify_feel.js`: real Chromium range checks for actual controller integration, fire/equip/reload timers, animation phase and blend weight, world/weapon lenses, mouse sensitivity and scoped speed.
- `node work/verify_valorant.js`: actual native assets, all 12 agent skeletons, 228 retargeted movement clips and 30 first-person combinations.
- `node work/verify_native_maps.js [map ...]`: native geometry, navigation, collision, jump/movement grounding and rendering.
- `node work/audit.js`: 518 legacy-fixture regression checks for menus, economy, abilities and input. This deterministic fixture excludes native maps and the new feel integration; the real-browser checks above exercise those replacements.

After editing integration sources, run `python work/install_valorant.py` to rebuild their inline blocks in `index.html`.
