# Owner rendering audit, November 5, 2026

No full-game/two-browser acceptance. Tests below execute real source with scripted rows and stub world/DOM, plus real-module WebGL viewer pixels.

## Entry paths

- A18 online outer `a18KeyJ` wrapper sends `{t:'ab',k}` then returns. It does not call `a18Key`, the older `jKey` wrapper, or its local kit. Includes Fade, Deadlock and Miks.
- Legacy kits go through ability equip release -> older jKey -> local kit function -> charge-delta `mpCastSelf`. Server-intent-only overrides intercept Omen C and Chamber E/Q before that local kit.
- Verified old charge-delta wrapper reads charges BEFORE calling local kit, calls it, then sends intent AFTER charge change. It is not the A18 path.

## Audit and corrections

| Effect | Local path | Row/event handling |
| --- | --- | --- |
| Fade Haunt | A18 intent-only | Removed wrong owner skip. Own and remote orb/burst from row. |
| Deadlock Anni | A18 intent-only | Removed stale-offline-handle owner suppression. Own and remote cocoon from row. |
| Miks Harmonize | A18 intent-only | Removed stale J._mkH suppression. Owner gets row veil/pillar. |
| Miks Waveform | A18 intent-only | Removed wrong owner skip in netSyncWaveform. Legacy smoke body retained. |
| Meddle / Surge | A18 intent-only | Prior correction 3f80e03: owner splash from dn row, no offline double. |
| Skye Seekers | Legacy rsKey creates RS.sk with jx | Skip now requires actual RS.sk module handle, not identity alone. With no handle, owner renders row. |
| Phoenix RIB | Legacy phKey creates generic ring, not phxRibMarker. jRib has generic return/audio, no module return burst | Removed owner module marker skip and return/death-event skip. Offline behavior unchanged. |
| Omen Step | Online C intercepted by netAbilityKey, intent-only | Removed owner stepout/stepin skip. |
| Chamber Rendezvous | Online E intercepted, intent-only. Private status creates legacy anchor ring, not chxAnchorPlace | Removed owner event skip; rdvanchor excluded from netSyncDevices blanket own skip, owner gets module anchor. |
| Phoenix Hot Hands | Local phKey calls phxHotHands directly | Owner skip retained. No handle-level fallback yet; full-game missing-module failure recovery unverified. |
| Phoenix Blaze | Local phKey calls blazeWall; blazeWall calls phxBlaze | Owner skip retained; row-copy would duplicate. |
| Skye hawk / flash | rsKey creates RS.hk module, hkFlash calls skxHawkFlash | Owner skip retained; lifecycle owner-death/local failure fallback still needs real-game acceptance. |
| Jett Cloudburst | Local jKey pushes J.cbs, shared trajectory ticks local | Owner row skip retained. |
| Trailblazer | Legacy rsKey control creates local creature | Owner skip retained. |
| Turret/alarmbot/trademark/spycam/owl/trapwire/boombot/blastpack | Legacy local kit creates respective object before charge-delta intent | Own device skip retained, except intent-only Rendezvous anchor above. Own authoritative detonation/local timing mismatch remains a known gap. |
| Miks Regrowth/Skye heal beam | Intent-only Skye C / row state | No new blanket owner skip added here; beam remains unfinished. |

## New coverage

- `test_mixed_owner_rows.cjs`: FULL a18NetSync receives six mixed seeker/haunt/anni rows, own+remote, repeated snapshots, haunt dn and clear. Actual A18 key wrapper proves intent-only path. Tests actual local Skye handles and stale offline cocoon.
- Updated dedicated Fade/Anni/Harmonize/Waveform/Seekers/RIB/Step/Rendezvous tests to assert corrected behavior instead of preserving false skips. Added owner-anchor test.
- `gen_net2.cjs` scenarios 19-21: full real a18NetSync, real module implementations, six mixed rows own+remote. Real WebGL Swiftshader, errs=0, no leftovers after effect lifetimes. Crop shows green seekers, purple Haunt, cyan cocoon; dn transition and clear scenario inspected. Burst may remain after row drop until its animation ends, intentional. Stub ground, no humans/occlusion or real input UI.
- `seen` Set moved above all loops in prior 3f80e03. Mixed rows now actually exercise early loops; this is the regression coverage earlier generic tests lacked.

## Remaining coverage limits

This is source-composition plus scripted-snapshot evidence, not two real clients or full-map play. Legacy release/equip/authority-rejection races, reconnect local leftovers, actual input DOM, owner device destruction/detonation timing, human smoke occlusion and each visual's fidelity remain open. No broader acceptance inferred from these tests.
