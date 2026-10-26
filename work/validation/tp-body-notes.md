# Main native torso follow adaptation

Main was a tarball extract with an empty `.git` directory. No branch, remote, credential or push operations were performed.

Changes:

- `index.html`: `xUbFollow` derives the sibling Spine1/Pelvis bind relationship from the skin's inverse bind matrices. `xUbCarry` applies absolute position follow after live/death/lobby mixers, without changing torso rotation. `xUbPre` restores Spine1 to bind before every mixer evaluation.
- Strafe counter-turn spreads over Spine1–Spine4. A sibling Spine1 receives the pelvis yaw before the distributed counter-turn, keeping net chest yaw zero.
- `work/valorant_runtime.js`: native attachment includes Spine4 and applies follow before initial skin/culling setup. `work/repair_runtime.js`: crouch shifts Pelvis and Spine1 together by at most 0.3 m, restores both positions and leg rotations before the mixer, and uses shared two-bone IK to preserve foot position/orientation. Raw leg rotations restore after the shared quaternion restore, so late terrain-IK setup cannot reapply an already corrected leg pose. Only idle weight >90% updates the standing-head reference. Air/one-shot/full-body planting skips correction.
- Generated integration blocks in `index.html` match the source runtime files. Re-running `python3 work/install_valorant.py` is byte-identical.
- New `work/tp_body_harness.cjs` exercises the shipped packed runtime clips and native attachment. New `work/test_tp_body_stretch.cjs` samples all 12 agents and actual skinned waist edges. `work/test_native_crouch.cjs` now tests all 12 native agents including crouching after jogging and foot IK.

Measured:

- All 12 agents: waist follow error effectively 0 in idle/walk/jog/left and right strafe/backpedal/crouch/crouch-walk; death follow and chest counter-turn pass.
- Disabling carry reproduces a 39.7 cm Jett crouch gap, confirming the regression detects the original failure.
- Maximum sampled waist edge growth: 6.03 cm (Raze), under the 6.5 cm bound. Other large values: Reyna 5.72 cm, Phoenix 5.59 cm. This test includes the new strafe distribution and coat/waist skin influences, so its sample set differs from the hark report.
- All 12 agents: crouch head drop 0.45 m, including after jogging; foot replant error below test tolerance (reported <0.01 cm); idle reference unchanged during jogging; offsets undo and unchanged mixer poses do not stack, including late terrain-IK bone registration.
- Standing Head bones range 1.649 m (Sage) to 1.726 m (Cypher). The server/render head agreement check allows 9 cm. Shared server hitbox constants were preserved: `headOffsetY` is the physical 8 cm sphere offset, and changing it would affect every pose. A separate pose-table calibration remains a gameplay review item.
- The native source jog is still low; no animation data was modified.

Validation completed:

- `npm ci --ignore-scripts` in `server/` (locked dependencies).
- `npm run build:worlds` in `server/` built all six prebuilt worlds.
- `npm test` in `server/`: passed, including prebuilt-world tests.
- `node work/test_tp_body_stretch.cjs`: passed.
- `node work/test_native_crouch.cjs`: passed.
- `node work/test_grip.cjs`: passed (15 agent/weapon pairs × 3 states × 3 pitches).
- Syntax checks for both runtime sources and browser script passed.
- Rendered Chromium smoke: Jett/Sage/Breach, zero waist gap, 0.45 m crouch drop, no page errors. Evidence: `tp-body-browser/results.json` and PNGs.

Client validation used the default `work/test_all.cjs` file list. The initial `npm run test:client` invocation terminated with exit 143 before completing, so remaining files were run in three parallel workers with individual exit codes and logs; lifecycle and offline-soak checks were also run directly. The ability check was isolated with the page's r149 library for diagnostics (the default fixture otherwise falls back to r160). The isolated Jett-only ability check passes.

All 128 default client regression files completed across these runs: **124 passed, 4 failed**. The new body regression is included. Detailed exit results: `tp-body-client-results.json`; combined run log: `tp-body-client-tests.log`.

Broader client failures:

| File | Observed failure |
| --- | --- |
| `test_client_abilities.cjs` | Split cases load Ascent; full isolated r149 run exits 1 with six map mismatch assertions. |
| `test_client_lifecycle.cjs` | Requested non-Ascent maps load Ascent; scene objects grow 1278 → 1322 and meshes 1080 → 1115 between cycles. |
| `test_client_offline_soak.cjs` | DM spawn tests for Bind, Haven, Split, Lotus and Breeze report `map: ascent`; exit 1. |
| `test_combat_report_layout.cjs` | Existing CSS expectation fails: “short .x-kb rule changed; re-check this layout”. No combat-report CSS was edited in this change. |

The dedicated `test_map_select.cjs` and `test_map_select_online.cjs` pass. Unlike the older ability/lifecycle/soak callers, `test_map_select.cjs` explicitly repairs the fake DOM's `<select>.value` behavior (`selFix`). These results concern the broader fixtures; the new body tests, native contact, grip, ragdoll, skin and rendered-body checks pass. No unrelated map/layout implementation changes were made to obtain green tests.

The complete client result manifest and failure logs are saved next to this note. See `../BROWSER_CHECKLIST_TP_BODY.md` for remaining gameplay checks.
