# Branch integration — 25 October 2026

User request: review both `hark` and `instinct` before continuing, and use their fixes to improve `main`.

## Integrated sources

- `hark` through `5cd5e0b`: optimized agent assets and shared locomotion; versioned, integrity-checked persistent agent cache; native-only readiness; socket-based two-handed weapon IK; first-person clip/cache/timing fixes; foot planting; bounded, skeleton-preserving ragdolls; sharp defaults and cheaper hit feedback; authoritative floor guns; spectator input/camera; shared movement fixes; map memory/resource cleanup; minimap visibility; TDM transitions, touch layouts; authoritative combat, statuses, devices and ultimates; reconnect/seat/ownership fixes; Spike/economy tests; planted-Spike and short-screen HUD fixes.
- `instinct` through `857f318`: offline bot personality and ally target-acquisition fixes; DM/TDM hunting and playable spawns; height-aware navigation, validated first hops, ledge descent, arrival thresholds, temporary failed-edge avoidance, spawn trap rejection; verified plant-zone goals; Split A Sewer navigation repair; roster-scoped match readiness adapted to the optimized loader; native Omen targeting bounds and intentional pointer-lock release; death-card placement; real-WebSocket pickup test and environment-only QA setup.
- Earlier `main` checkpoint `63176c0` remains recoverable in Git. Its tightly bounded stair-support fallback is retained and combined with the newer shared motor.

## Conflict decisions and integration corrections

- One optimized agent preload/cache and one two-handed grip solver run in production. Removed the earlier duplicate modules, baked pose payload and obsolete implementation-specific tests. The older palm-only attach, second preload and global texture-decode monkey patch were not activated.
- Instinct roster selection delegates to Hark's existing progress/cancellation gate. Online still prepares all agents for late joins; offline can prepare the actual drawn roster. A mirror of the player's agent on the enemy team no longer causes the gated roster to be redrawn at start.
- Kept Hark's shared motor, footprint support, wall-climb restrictions and movement-only Ascent pit clip. Did not merge dense nav-boundary fences into the shot/visibility BVH, or enable the competing out-of-bounds death watch. Hark's fall recovery remains active. Fence diagnostics remain available as investigation tools.
- A third Lotus stair seam still failed with the Hark motor alone: its exact vertical floor ray hits no triangle near the riser. Retained the earlier bounded nav support (within 0.65 m horizontally and a narrow vertical window) on client/server. Three concrete Lotus walks and all-map traversal pass together.
- Call `nmSiteGoals` after the native navigation grid is built; the competing loader merge had omitted this initialization.
- Restored the native DM/TDM spawn-source branch lost in the competing merge: sample the current map’s playable navigation nodes before considering legacy graph/callout fallbacks.
- A level-banded nearest-node search now preserves its band on fallback, rather than silently returning an overhead node.
- Restored a missing CSS media-query closing brace introduced by the competing short-screen HUD changes; spectator base rules apply at desktop heights again.
- The lifecycle and offline soak tests now wait until the duel respawn delay permits their forced final kill, rather than marking a rejected kill as executed. Gameplay timing was preserved.
- QA overrides require the exact server environment gate, are range-validated, cannot be set through messages/URLs, and are absent from production configuration. Added an actual simulation check including zero credits. Production Spike remains disabled by default.

## Combined-build verification

- `npm test` from `server/`: all **29 server regression files** passed on the final server code. Includes combat/devices/ults, release gates, reconnect/results, floor guns, background tabs, bundle integrity, soak/performance, 43 six-map traversal walks, three formerly blocked Lotus stair paths, and QA isolation.
- Client regression verification: **76 files** in the default runner, checked across the integration run and resumed runs after correcting failures. The initial default run exposed duel-test timing and the missing native DM spawn branch; those were repaired and rerun, then every remaining file passed. This is split-run verification, not a claim that the original uninterrupted command passed.
- The separate 24-match lifecycle run passed: every offline mode, all six maps, results/pause exits, stable listener count (72 → 72), no exceptions; orphan geometry 5 → 6 and textures 66 → 66 within the test bounds. The final client prefix also passed this lifecycle test again.
- `node server/test-two-client.js` against the real local Wrangler worker: all protocol phases passed, including authoritative pickup, swapped old gun appearing on the floor, matching death state, and synchronized death drop. In the combat phase a bot killed the target; the test does not prove human kill attribution or rendered acceptance.
- Normal browser UI: latest combined build launched native Lotus, ran multiple rounds, accepted walking input, and returned to lobby. Separate graphics-switch check retained map and native first-person hands after enabling anti-aliasing. [Saved render](validation/main-integrated-lotus-aa.png).
- Regenerated all six prebuilt worlds, including repaired Split navigation. Page generation is byte-identical; seven inline scripts parse; one canonical asset loader/grip/ragdoll/map/feet block; stylesheet braces balanced; `git diff --check` passed.

Branch screenshots and benchmark figures remain historical evidence, not measurements of this combined build.

## Still requires acceptance

- Measured first-hit/kill frame times and constrained-device cold/warm loading, memory and sustained FPS.
- Actual third-person grip/finger/stock contact in motion across every agent and weapon; crowded corpse visuals/crash soak.
- Two separately rendered online clients through human combat, pickup/swap, reconnect, natural finish and saved results. Protocol-only tests are complementary evidence.
- Real phone/touch acceptance; every map's complete stair/door/teleport/terrain pass; every ability's visuals and interactions.
- Exact Lotus right-wall gap below A from the supplied minimap screenshots (mapped near A Rubble, approximately world x 36–39, z 7–9): broader skirt/edge fixes do not establish that this particular opening is repaired.
- Final tested frontend/server deployment and the full Spike release gate. No paid-plan or billing changes.

The complete original handoff checklist is preserved in [NEXT_STEPS.md](NEXT_STEPS.md).
