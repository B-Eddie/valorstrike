# Movement verification — 2026-10-26

All 14 targeted test files passed when run from the repository root:

- `node work/test_feel.js`: PASS
- `node work/test_tp_locomotion.cjs`: PASS
- `node work/test_net_reconcile.cjs`: PASS
- `node work/test_movement_sampling.cjs`: PASS
- `node work/test_native_stride.cjs`: PASS
- `node work/test_native_contact_runtime.cjs`: PASS
- `node work/test_native_crouch.cjs`: PASS
- `node work/test_tp_body_stretch.cjs`: PASS
- `node work/test_feet.cjs`: PASS
- `node work/test_tp_cam_height.cjs`: PASS
- `node work/test_offline_realtime.cjs`: PASS
- `node work/test_net_stall.cjs`: PASS
- `node work/test_client_lifecycle.cjs`: PASS
- `node work/test_client_online.cjs`: PASS

Evidence:

- 72 deterministic motor/accuracy assertions passed.
- Visible skeleton sampling: every frame at 120 Hz at 5, 35 and 55 m; culling and pause retained.
- Online prediction: equal acceleration and distance at 4, 10, 20, 60 and 144 FPS; bounded substeps and ordered historical timestamps.
- Reconciliation: 118 snapshots, zero snaps, zero vertical pull, maximum horizontal correction 0.017 m.
- Actual skinned stride support lift across all 12 agents: 1.75–1.85 cm at rifle speed; airborne correction bypass verified.
- All 12 agents pass crouch and body-integrity checks.
- Foot planting, leg lengths, grip preservation and terrain smoothing at 20/60/120 FPS pass.
- Generated runtime rebuild is idempotent.

```text
Offline real-time clocks (1/5/20 fps): buy phase, round clock, plant progress, Spike fuse and DM clock follow real time within 3 %; a 1 s frame = 20 physics steps; hidden tab / stalled frame (4 s cap) guarded, bounded catch-up carries over; DM respawn on real time at 1 fps
```

```text
Online client soak (page <-> in-process server): fast TDM/DM/Spike, piloted page player kills/deaths 1/1, 1/3, 1/2, respawns, kills, leave/rejoin agent swaps, Spike rounds (3), match end, server disconnect, slow load kept while progressing then closed with a clear message; no page exceptions
```

```text
Client lifecycle (three r160, seed 1): 24 back-to-back matches in one page session (every offline mode, all six maps, random agents, results or pause-menu exits); scene 2462 -> 2458, geometries 2145 -> 2146 (orphaned on the GPU 5 -> 5), textures 130 -> 118 (orphaned 66 -> 66), timers 31 -> 31, listeners 76 -> 76, heap 71 -> 73 MB; nothing grows per match, no exceptions (160 s)
```

`node work/verify_feel.js` could not run: Playwright is not installed; `/usr/bin/chromium` is also absent. No browser visual comparison was completed.

The optional full client suite (`node work/test_all.cjs`) was interrupted after its early tests; it has no complete-suite verdict. The targeted checks above completed separately.

The third-person source clips remain retargeted Quaternius assets. Exact visual and mechanical equivalence with Riot’s private implementation has not been established. No git push, remote configuration or credential setup was attempted.
