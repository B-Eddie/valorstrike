# Valorstrike handoff (written 6:55 AM ET Nov 5 2026; no secrets)

## Repo state
- Branch `instinct` of private repo B-Eddie/valorstrike. `main` untouched. Last pushed head before this file: a88acae; this commit adds the Skye regrowth fix, tests and this file.
- Git identity: Eddie <121364681+B-Eddie@users.noreply.github.com>. Always `git pull --rebase origin instinct` before push.
- Credential route (metadata only): vault login "valorstrike GitHub Contents write token" (sandbox_access true, github.com only). `tools vault write-file --key password --name "valorstrike GitHub Contents write token" --return-channel none` (tools box) then, in the workspace box, clone `https://x-access-token:$(cat <path>)@github.com/B-Eddie/valorstrike.git` and delete the file. It cannot push .github/workflows. Never print the value. Do not create a wider token.
- The workspace box was wiped once (memory exhaustion); re-clone and `cd server && npm ci` (about 5 s) before tests.

## CI blocker
- Run https://github.com/B-Eddie/valorstrike/actions/runs/41993191596 (10552c8): 6 jobs not started. Annotation: "The job was not started because recent account payments have failed or your spending limit needs to be increased. Please check the 'Billing & plans' section in your settings". No billing change allowed; decision is the user's (held for the 8:30 AM delivery). Do not rerun without new signal.
- Local full two-browser capture is not feasible here (2 cores, ~2 GB): a 640x360 run never reached the in-game frame and wedged the box. No more local capture or detached jobs.
- Latest real captures: ci27 (run 41989482572, 931260c). Nothing after is visually verified.

## Online wiring done this session (all code-only, visually UNVERIFIED)
- a18NetMesh binds module visuals and hides the legacy mesh for rows: mosh, gnet, seize, mpulse, ceptor, xcut, vine, rose, garden, shear, mesh, sensor2, nightfall, bassq (yaw sign unverified).
- Remote Yoru generic flash orb/pop suppressed (module row draws).
- Sage barrier rows also build sgxBarrierWall (segments from the row); the QA slot phx-curve now FIRE=1 (hypothesis: ci27's empty frames were no click).
- Skye Regrowth: 'regrowth' was NOT in server A18_NET_KINDS, so the row never reached clients; added it (server/src/agents18.js). 3600 is a sentinel (row ends on pool-empty, owner death or recast; e.p follows the owner each tick), not a duration. Client netSyncRegrowth draws skxRegrowth at e.p, skips own rows.

## Tests and their limits
- Pass: work/test_agents18_net.cjs, test_server_effects.cjs, test_net_drop.cjs, test_online_devices.cjs, work/test_skye_regrowth_client.cjs, server/test-skye-regrowth-row.js, server test-abilities, test-agents18, test-protocol.cjs.
- NEW work/test_fx_modules_real.cjs: real three.js (no GL) builds 17 module entry points (Sage barrier, Skye regrowth, Deadlock GravNet/Mesh/Sensor, Gekko Mosh, Fade Seize/Nightfall, Miks M-Pulse/Bassquake, Veto Interceptor/Crosscut, Vyse x4, Hush Displacement), pokes handle methods, ticks 10 s, ends, ticks 100 s more and asserts zero scene leftovers. Shader compile, look, yaw and occlusion are NOT covered (no GL).
- Limit: client tests run with the fx modules STUBBED (a recording stub or absent), so real module construction, yaw sign, height, look and occlusion are untested. Known pre-existing failures: test_tdf_round_reset, test-bot-brain "bot buys vary", work/test_iso_arena.cjs "arena shell renders".

## Remaining scope
- Online: server rows plus client handlers still missing for Skye Trailblazer/Guiding Light/Seekers and heal beam, Hush, Fade Haunt and seekers, Miks Harmonize/Waveform, Deadlock Annihilation, plus the older list (Cypher, Killjoy, Chamber, Iso, Neon, Waylay, Astra, Clove, Harbor, Phoenix, Reyna, online smoke kinds). A bounded real-module construction test (THREE shim) is not written.
- Open visuals: Jett inside view and look, Yoru cream disc (likely duplicate generic path, fix pushed, unverified), Omen exterior capture, Deadlock/Gekko look, Sage visibility, killcam grey head and "JETT - ABILITY" label bug, HUD overlap, 29-agent roster audit.
- After fidelity: main push (needs the user's decision given the Riot IP policy and no CI), then iPhone Safari load fix, the bug list, and the memory-crash work, all ON MAIN.

## Lost
- /downloads/postmain_medium_memory.patch (the unapplied memory hypothesis) was lost in the box wipe; not recreated. Main holds some ci24-27 sheets. Hypothesis: duplicate-map peak; eliminate it before reducing texture quality; verify after main.
