# Valorstrike bug-lane handoff

Reimplemented on the extracted tree identified by the user as main `7416f55`. No git commands, push, server restart, or worker deployment were performed. The old sandbox's commits and worktrees were not used.

## Lane status

| Lane | Implementation | Remaining validation |
| --- | --- | --- |
| Lobby | Server probes every connected player every 2 s with an unpredictable nonce; measured RTT appears in roster and snapshot/scoreboard rows. Stable unit IDs determine host. Name is locked while seated. Host remains reserved during the 90 s transport-resume window, resumes with the same unit/authority, and transfers only on intentional departure or expiry. Host-only Bots checkbox is checked again on the server; setting survives mode changes. Botless solo matches run, including Spike practice; Skirmish still requires two humans and never fills with bots. | Real sockets/browser reconnect sweep blocked; in-memory protocol and lifecycle checks pass. |
| Online weapons / effects / abilities | DM and Skirmish free menu includes all 20 guns, including Bucky, Judge, Ares, Odin. Replacing the currently held secondary refreshes its model. Disabled kits still expire smoke and stale visuals. DM/Escalation prohibit kit use and local online bot casting. TDM instant abilities, Blade Storm commands and Omen targeting use negotiated TDM ability authority. Opaque, depth-writing, double-sided smoke shells and authoritative smoke snapshot TTLs cover late join/reconnect. Server bot sight already uses smoke volumes and is checked in the focused regression. | Native rendered ADS, scope overlays, smoke interiors/edges and per-agent TDM casts need Chromium. |
| ADS | Restored the rifle ADS blend (it previously always targeted zero), kept data-driven zoom and sniper overlays, aligned native `ScopeTarget` sockets with the centre camera ray, and made interrupted ADS transitions continuous. Unsupported pistol ADS stays disabled; Bucky alt fire does not zoom. | Visual comparison against Valorant and every native/skin variant blocked by missing `three`/Chromium dependencies. Transition timing remains the project's 0.12 s in / 0.09 s out; no new external timing research was possible. |
| Lag compensation | Bounded history of target position, yaw, crouch and motion pose; interpolate past hit volumes using server-measured half RTT plus the client's bounded interpolation buffer (100–220 ms). Maximum rewind 350 ms, retention 500 ms / 16 frames. No client wall clock, no live-position mutation, no rewind across respawns or large teleports, no bot/knife rewind. Inputs 60 Hz, snapshots/simulation 20 Hz. Rising fire edges are latched across intervening input frames without duplicating semi-auto clicks. | Real network impairment and tick/FPS profiling need the map build/dependencies. This addresses hit registration; the user's lag category remains unknown. |
| Bots | Increased placement/tracking error and reduced spray control without changing reaction limits. Trigger waits for its planned aim and rejects a large remaining aim error. Wide peeks finish crossing the held edge before counter-strafing and firing. Shared offline/server aim model is regenerated into the page. Existing strategy, economy, site coverage, spacing and trade caps are retained. | Actual-map spread, buy-phase and trade-rate suites cannot load worlds. Pure tactical decisions, grid-world trades, 40 buy schedules, human aim and perception checks pass. See measured differences below. |
| Haven C pickups | Mid-air DM/Escalation drops query the floor on the server; offline packs also query floor height. Pack meshes rest at half their height. Spike Rush and online ultimate orbs rest at their geometric half-height rather than hovering 1–1.1 m up. | Haven C visual inspection still needs mode/colour/size confirmation from the original report and a rendered map. Map geometry was not edited. |
| Third-person grip | Persistent agent models rebuild only their held gun on a weapon change and retain their body, holder and bind transforms. Cached grip state resets; the existing per-native-weapon trigger/support sockets select the grip for sidearms, rifles, shotguns, heavies and snipers. | Transcript probe does not exist here. Equivalent `server/tools/grip-view.mjs` was attempted and fails to import `three`; native hand-gap and screenshot suites remain blocked. Dependency-free swap checks and real GLB socket checks for all 20 guns pass. No unmeasured hand offsets were invented. |
| parity6 | Golden Gun: native gold-tinted Sheriff, one chambered round, two reserves, lethal accurate moving shots, one-round reloads, extra reserve bullet per kill, round reset. Twin Hunters: two distinct-target, shootable, nav-routed seekers; contact nearsights/slows, retargeting, expiry and round cleanup; snapshot rendering and offline counterpart. TDM spawn zones: walkable spawns at team anchors, healing/protection, no firing/casting out, one-way entry restrictions, anti-camping damage and a player hint. | These are adapted gameplay zones on the existing maps, not Riot TDM map geometry. Radius 5 m, 15 s grace, heal 100/s and subsequent 10 HP/s drain are local defaults. Hunter HP 150, lifetime 15 s, speed 7 m/s, 4 s nearsight/slow are the implemented defaults. Exact prior parity6 code and its sources were unavailable; new external research was blocked/unavailable. Native visuals and map-boundary fit require review. |

## Files

Complete product/test list: [changed-files.json](changed-files.json).

- Lobby/network: `server/src/worker.js`, `server/src/simulation.js`, `server/src/rewind.js`, `work/server_runtime.js`, base and regenerated `index.html`.
- Online visuals/input: `work/valorant_runtime.js`, `work/grip_runtime.js`, `work/feel_runtime.js`, `work/game_rules_runtime.js`, `index.html`.
- Modes/powerups: `server/src/spike.js`, `server/src/modes.js`, `server/src/srpowerups.js`, `server/src/tdm.js`, `server/src/tdmrooms.js`, `server/src/devices.js`, `server/src/fog.js`.
- Bot model: `vendor/bot-brain.cjs`, `server/src/simulation.js`.
- New regressions: `server/test-bug-lanes.js`, `server/test-bot-tactics.js`, `work/test_bug_lanes.cjs`; both server regressions are in `server/package.json`'s test command. Existing device enumeration tests include Hunters; the TDM ability fixture disables spawn-room rules to isolate cooldown/authority assertions, while the new regression tests room restrictions.
- Test evidence and the direct Python suite runner live in `qa/buglanes/`.

## Measured bot tuning

The transcript's absolute 68→54 / 51→37 / 60→40 results are not reproducible from this tarball's baseline. Do not substitute those numbers for these observations.

`tools/bot-benchmarks.mjs`, 120 seeded fights per scenario, 20 Hz, stopped at kill:

| Measurement | Original shared brain | New shared brain |
| --- | ---: | ---: |
| 15 m accuracy | 45.5% | 35.0% |
| 15 m bullets 5–9 accuracy | 25% | 19% |
| 15 m side-flick accuracy | 43.7% | 32.8% |
| Aggregate headshot share | 15.8% | 15.1% |

Comparison uses the captured original `vendor/bot-brain.cjs` in the same flat-world benchmark; the baseline and final raw JSON are retained. Reaction-test means remain 251 ms pre-aimed, 301 ms cold, 501 ms side, 652 ms behind. The longer 60 Hz human fixture separately reports 37% at 15 m and 20% headshots to kill; it is a different harness. `bot-human-final.log`, `perception-final.log`, `tactics.log` and `peek-smart.json` record the passing checks. The new aim is deliberately weaker; review the actual feel before treating the transcript's target as achieved numerically.

## Validation and limitations

Suite attempts: **49/85 server test files pass**; **36 are blocked** by dependencies/world assets/process restrictions. **114/256 client test files pass**; **141 are blocked**, and the unchanged Math.hypot allocation test fails. Counts and individual outcomes are in `server-results.json`, `client-results.json` and the adjacent suite logs. Affected focused tests were rerun after the final small edits; these counts do not imply that native/browser checks passed. Every test file was invoked directly via Python `subprocess`, with real output and exit status retained. Node `spawnSync` is itself restricted here: even a trivial child can return EPERM with status zero, so its apparent PASS output was discarded and the Node wrapper removed.

- Server production release gate passes; `ENABLE_SPIKE` and the production Wrangler variables are unchanged.
- Focused server regression passes: rewind bounds/interpolation/life guards, click latching, grounded packs, smoke sight/TTL, Golden Gun, Hunters, TDM rooms, and real GameRoom + simulation protocol with two players across DM, TDM, Escalation, Skirmish, Unrated, Swiftplay, Spike Rush and Replication. It covers host resume and expiry, measured RTT, host-only bot controls and solo botless play. This is an in-memory sweep, not a browser/socket sweep.
- Focused client regression passes: full free-gun menu, expiry, smoke shader settings, ADS in/out/reversal, current-secondary refresh, held-gun replacement, all native gun sockets, stable host identity, ping echo, 60 Hz input and grounded orbs. Ten inline scripts parse.
- Server protocol, reconnect, background, abilities, cadence, combat, economy, human aim, perception, SR powerups, device bodies and pure tactics pass. Network/netdrop tests pass their dependency-free portions, then fail loading `three`; they are not counted as full passes. `test-two-player` also stops on missing `three`.
- `npm ci --ignore-scripts --cache /tmp/valorstrike-npm-cache --prefer-offline` failed with EPERM fetching `youch-core` from npm. No successful dependency install is claimed. World build, bundling, actual-map suites, local multiplayer browser suites and native grip/ADS renders cannot complete without dependencies/built worlds. Relevant errors are kept in the logs.
- The unchanged `work/test_hypot.cjs` allocation ceiling fails under this Node 24 environment. Running the same test against the captured original page also fails (16.42 bytes/call); see `hypot-baseline.log`. The math patch was not changed.
- The fast fake-DOM boot probe finds all new runtime functions and no caught runtime exceptions; its harness reports the pre-existing unsupported external `models/valorant/agents/manifest.js` script. It is not native rendering validation.
- No browser evidence or public tutorial research is fabricated. The sandbox's blocked package/network setup prevented the requested external/runtime validation.

`scope-proof.json` confirms the movement and foot-planting blocks, Skirmish implementation/pool and `supportedModes` release gate are unchanged. Movement assets and their source were not edited. `work/validation/*.md`, `server/wrangler.jsonc` and the lockfile were left alone.

## In-game verification for the main agent

1. Use two updated clients and the matching local worker. Create a room, wait at least 4 s, check both RTTs in roster and Tab scoreboard. Name must stay locked while seated. Disconnect/reconnect host within 90 s: same unit, settings and authority. Check only host can toggle Bots; turn them off and start a solo respawn match. Skirmish still needs a second human.
2. In DM and Skirmish open B, equip Bucky/Judge/Ares/Odin, then cycle every secondary and inspect both first- and third-person guns. Repeat after buying/replacing the secondary while already holding it, after TDM stage upgrades and Escalation weapon changes.
3. In DM/Escalation check neither side casts kit abilities and any previously present smoke disappears. In TDM leave the spawn zone and test C/Q/E/X for multiple agents, including Jett Blade Storm/Tailwind, Omen teleport and Chamber Headhunter. Spawn-zone restrictions should show the hint and not consume charges.
4. Smoke between two clients, enter it, look through both sides and inspect edges from different heights. Check bot fire does not track an unseen moving player through smoke. Join/reconnect while a smoke is already active and verify its remaining lifetime.
5. Inspect ADS on every rifle/SMG/heavy, reverse right-click partway through the transition, and check optic/crosshair alignment. Check Operator 2.5×/5×, Marshal/Outlaw 3.5×, overlay centring, reload/death/swap unscoping, and Bucky alt fire without zoom. Test available skins too.
6. Reproduce Haven C mid-air deaths in DM/Escalation and inspect health packs; inspect SR and ult orbs at C's floor height. Do not edit the map to compensate for a pickup.
7. Locally opt into Spike modes only through existing development/test configuration; do not change production ENABLE_SPIKE. Force or capture Golden Gun/Hunters, test misses/reloads/kills, destroy hunters, move behind walls, kill their target and end the round. TDM: verify safe-room spawn, healing, outgoing fire restriction, exit/re-entry rejection and the anti-camping timer on all six existing maps.
8. Run the full native browser/socket sweep with real network delay and collect FPS/tick/RTT measurements before deployment. Current checks do not establish a deployed lag improvement.

## Open questions / review items

- Haven C box: colour, size and exact mode remain unknown; all three diagnosed pickup candidates were addressed.
- Which mode originally blocked the player's abilities? TDM authority is fixed, but the original report did not identify it.
- Is remaining lag rubber-banding, low FPS or input/shot delay? Rewind does not establish a fix for every category.
- Exact transcript aim metrics and prior parity6 tuning/source details remain unavailable; inspect the recorded numbers and adapted defaults.
- Rendered ADS, per-gun hand placement, smoke appearance, native-map spawn boundaries and a full real multiplayer sweep remain environment-blocked, not passed.

The tree is left for the main agent to review, verify and push. Nothing here is live.
