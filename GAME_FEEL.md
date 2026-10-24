# Movement and weapon calibration

The game uses the native VALORANT first-person arm and weapon clips already recorded in [asset sources](models/valorant/SOURCES.md). Equip and reload playback follows gameplay timers; short crossfades join actions. A separate weapon camera preserves the model proportions during ADS. Look sway, distance-driven footsteps and weapon bob, landing motion, crouch transitions, and blended third-person walk/run playback provide movement feedback.

`vendor/valorant-feel.js` owns the deterministic character motor and accuracy cone. It substeps long frames, integrates acceleration/displacement analytically, normalizes diagonals, brakes on release/reversal, limits air steering, slides against walls, buffers jump presses, prevents held-jump repetition, checks ceilings, and gates uncrouching under cover. Native maps use their triangle collision BVH. Shift and crouch combine using the slower stance speed. Scoped movement applies each gun's multiplier once.

`models/valorant/weapon-calibration.json` is a local snapshot of [Valorant API weapon stats](https://valorant-api.com/v1/weapons), retrieved 2026-10-24. It supplies the 18 existing guns' magazines, damage ranges, fire rates, movement multipliers, ADS ratios, first-shot error, equip times and reload times. The game does not depend on that service at runtime. Regenerate with `python work/build_weapon_calibration.py` when intentionally updating the snapshot.

Public gunplay references:

- [Riot patch 3.0](https://playvalorant.com/en-us/news/game-updates/valorant-patch-notes-3-0/): 27.5% movement-accuracy deadzone and 72.5% tagging slowdown.
- [Riot patch 1.09](https://playvalorant.com/en-us/news/game-updates/valorant-patch-notes-1-09/): Operator 15% accuracy deadzone, 0.72 scoped movement ratio, 0.6 rounds/second and landing accuracy behavior.
- [Riot patch 9.10](https://playvalorant.com/en-us/news/game-updates/valorant-patch-notes-9-10/): revised walking/running error, Phantom damage falloff and pistol magazines. The local API snapshot supplies the current numeric weapon tables.

Mouse sensitivity uses 0.07 degrees per input count per sensitivity unit (default 0.4), with proportional scoped sensitivity. The reference world view is 103° horizontal at 16:9; the vertical field of view remains fixed when resizing.

Acceleration, braking, crouch fatigue, jump impulse/gravity, landing duration, visual springs, spread recovery and recoil drift are this project's approximations. They are centralized for tuning rather than claimed to reproduce Riot's private controller or recoil implementation. Third-person locomotion remains the credited retargeted Quaternius animation set; it is not native VALORANT locomotion. The separate surf practice mode retains its own controller.

## Verification

- `node work/test_feel.js`: 57 deterministic checks for refresh-rate independence, weapon/stance/tag speeds, diagonal normalization, stopping, jumping, landing accuracy, wall sliding, ceiling clearance and accuracy thresholds.
- `node work/verify_feel.js`: real Chromium range checks for actual controller integration, fire/equip/reload timers, animation phase and blend weight, world/weapon lenses, mouse sensitivity and scoped speed.
- `node work/verify_valorant.js`: actual native assets, all 12 agent skeletons, 228 retargeted movement clips and 30 first-person combinations.
- `node work/verify_native_maps.js [map ...]`: native geometry, navigation, collision, jump/movement grounding and rendering.
- `node work/audit.js`: 518 legacy-fixture regression checks for menus, economy, abilities and input. This deterministic fixture excludes native maps and the new feel integration; the real-browser checks above exercise those replacements.

After editing integration sources, run `python work/install_valorant.py` to rebuild their inline blocks in `index.html`.
