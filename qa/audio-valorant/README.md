# VALORANT audio replacement handoff

**Partial completion: the requirement that every sound slot be genuine VALORANT audio is not met.**

Installed 35 source-backed VALORANT MP3s: 5 existing entries replaced and 30 new entries used by existing triggers. Retained 195 existing files with consistent Riot/Wiki provenance and expected profiles, plus 4 genuine Killjoy showcase cuts needing event-isolation review and 1 standard-knife inspect clip sourced from a Prime preview. **304 generic files remain explicitly unresolved**: 38 have playback references in the audited routes; 266 have no reference in those routes. No generic sound was newly substituted or described as VALORANT. A downloaded planted-spike beep candidate was rejected during the final audit because this game calls `plantBeep` while planting; that generic slot remains unresolved.

The input was the user-described main tarball at `6d905e4f`. No git commands, push, server/worker redeploy, movement-animation edits, map-pool edits, or `ENABLE_SPIKE` changes were performed. The failed dependency installation's partial `server/node_modules` was removed.

## Per-category result

Counts below describe the 539 final MP3 files, not the larger number of logical playback slots. One clip can serve multiple slots. Missing assets without files, inherited skin routes, and synthesized-only sounds are enumerated separately in [slots.csv](slots.csv).

| Category | Already VALORANT/source-backed, retained | Installed (replaced + new) | Not found / retained for review | Source or remaining lead |
|---|---:|---:|---:|---|
| Standard weapon clips | 53 | 3 (2 + 1) | 1 inspect mismatch | Existing Riot previews retained; [VallyBoard knife clips](https://github.com/Jai-R-Mehta/VallyBoard/tree/e8630a8940f0840ef584062abe1f54e1a34696d2/app/src/main/res/raw). Missing gun slots below. |
| Prime | 17 | 0 | 0 bundled files | Existing Riot previews and [Wiki Prime media](https://wiki.playvalorant.com/en-us/Prime_Collection); inherited equip/inspect/heavy slots still require review. |
| BlastX | 25 | 0 | 0 bundled files | Existing Riot previews and [Wiki BlastX media](https://wiki.playvalorant.com/en-us/BlastX_Collection); inherited slots still require review. |
| Black Market knife | 3 | 0 | 0 bundled files | Existing Riot preview retained; separate heavy-stab cue missing. |
| Abilities | 0 | 24 (2 + 22) | 4 genuine showcase cuts needing review | [SpikeMedia agent sound archive](https://github.com/Dartsgame974/SpikeMedia/tree/0d0505fc199f3915c6db2d51864b091dd6e4f7b5/Characters). |
| Announcer / voice | 61 | 0 | 0 bundled files | Existing [Wiki Announcer](https://wiki.playvalorant.com/en-us/Announcer) sources retained. |
| Agent death variants | 36 | 0 | 0 bundled files | Existing per-agent Wiki media retained: Jett, Phoenix, Sova, Sage, Reyna, Raze, Killjoy, Omen, Skye, Chamber, Breach, Cypher; 3 variants each. |
| Footsteps / impacts library | 0 | 0 | 130 generic | [Surface-footstep community port](https://gamebanana.com/sounds/77804) and [ValorantPorting extraction](https://github.com/barboncino2901/ValorantPorting/blob/master/README.md). |
| Sci-fi library | 0 | 0 | 73 generic | Distinct ability triggers now route to native cues; generic shared smoke/flash/teleport/etc. and unused library entries remain. |
| UI library | 0 | 1 (1 + 0) | 99 generic | Native click from [SpikeMedia UI archive](https://github.com/Dartsgame974/SpikeMedia/tree/0d0505fc199f3915c6db2d51864b091dd6e4f7b5/Valorantek/SFX/SFX); per-file leads in assets.csv. |
| Ambient loops | 0 | 0 | 2 generic | [ValorantPorting](https://github.com/barboncino2901/ValorantPorting/blob/master/README.md): export map wind/water/industrial ambience. Map theme music is not a matching ambience substitute. |
| Spike / round / match events | 0 | 4 (0 + 4) | 0 new files; other triggers remain unresolved | Spike detonation, round loss, match victory, match defeat from SpikeMedia. |
| Hit / kill feedback | 0 | 3 (0 + 3) | 0 new files; headshot/armor cues remain unresolved | Native target flesh hit, victim damage, default kill confirmation from SpikeMedia. |
| **Total files** | **195** | **35 (5 + 30)** | **309 (304 generic + 5 review)** | **539 final MP3s** |

“Already VALORANT/source-backed” means the existing import script's source selection and metadata are consistent with Riot skin previews or Wiki game media, the local content hashes match, and decoding succeeds. It is not an independent re-download or a human listening certification of every cut. Filenames alone were not used as proof. The four retained Killjoy cuts have genuine provenance but have not been certified as isolated, event-correct cues.

## Inventory and reference contract

The actual input directory contained **509 MP3s plus 6 supporting files** (manifest, 3 license texts, 2 kill-banner PNGs): 515 regular files, 7,456,088 bytes. The final directory contains 539 MP3s plus those 6 supporting files. Asset inventory: [assets.csv](assets.csv), all 539 final entries with original URL/hash where present, status, references, exact source URL, and unresolved-source lead. Every original one of the 509 logical asset entries is represented. [replacements.csv](replacements.csv) lists all 35 installed sources. [baseline-hashes.json](baseline-hashes.json) preserves the original audio-directory hashes.

There are **645 logical rows** in [slots.csv](slots.csv), including all 20 guns, knife actions, every weapon in all 18 non-standard skin collections, inherited routes, 28 named ability cues, footsteps, reload keyframes, hits, voices/deaths, ambient beds, round/match/spike events, and the remaining procedural-audio families. These are expanded routes rather than 645 distinct files or triggers.

`index.html` embeds both `GA_MANIFEST` and the contents of `work/audio_runtime.js`. The page does not fetch `audio/manifest.json` at runtime. Updating only the on-disk manifest would therefore leave the actual game stale. `gaPump` also verifies the MP3's complete SHA-256 and caches by URL in `valorstrike-audio-v1`. Each new/replaced content file uses its correct 12-character SHA-256 filename suffix, and URL/hash/bytes/duration/source metadata is synchronized in both manifests. Old hashed files were removed only for the five replaced entries. All retained native files remain byte-for-byte unchanged.

No trigger sites, gain values, playback-rate values, timing constants, voice caps, groups, panners, unlock behavior, or cache version were changed. Runtime edits are the explicit audio-reference substitutions in `work/apply_valorant_audio.py`, including prewarm references. Round-loss and match fanfare reference choices are now distinct; the existing playback groups and gain remain unchanged. Native knife skins retain their previous swing-as-heavy references at the existing 0.78 playback rate; the standard knife receives a separate native stab clip at that same unchanged rate.

## Installed sounds

- Jett: dash, Updraft, Blade Storm draw/throw, Cloudburst throw/pop.
- Sova: bow cast, Shock Bolt explosion, recon ping, drone deployment.
- Omen: Shrouded Step, Paranoia cast, From the Shadows activation.
- Phoenix: Blaze formation, Run it Back activation and return.
- Reyna: Leer cast, Devour cast, Dismiss cast, Empress activation.
- Sage: Slow Orb explosion and Resurrection.
- Killjoy: native turret shot and Nanoswarm activation. Previously `ability/turret` and `ability/tShot` were identical bytes; likewise `ability/nanoSet` and `ability/nano`. Distinct deployment/activation triggers cannot both be isolated correctly by those duplicate 2-second preview cuts. The deployment cuts are retained; only the two mismatched action cues were replaced.
- Standard knife swing/equip/stab, UI button click, spike detonation, round loss, match victory/defeat, body-hit/victim-damage/default-kill confirmation.

The source archive exposes some Wwise sound layers rather than complete mixed gameplay events. The selected named cues are original audio, but multilayer abilities may still need an in-game listening comparison for the full mix. No extra layers, fabricated effects, gain normalization, time stretching, or synthesized replacements were generated.

## Unresolved slots and open questions

These remain unresolved even though the integrity tests pass:

- **Bandit and Warden:** all four fire/equip/reload/inspect routes are inventoried, but neither has a downloaded weapon profile. Their fire behavior still falls back to existing synthesis. [ValorantPorting](https://github.com/barboncino2901/ValorantPorting/blob/master/README.md) can search the local game's Compact/BattleRifle events; [Warden showcase lead](https://www.youtube.com/watch?v=YOV2JJ8XyXk), [Bandit showcase lead](https://www.youtube.com/watch?v=LwQP5lMsu6I). A SpikeMedia folder called Bandit contains `Wp_DMR_Fire` outputs; that label alone was insufficient to establish that they are Bandit, so they were not installed.
- **Judge equip:** explicitly mapped to `impact/impactMetal_light_001`, a Kenney clip. All **20 gun inspect routes** lack standard inspect clips and fall back to a Kenney metal impact. The standard knife inspect uses a Prime Knife preview because `import_game_audio.py` explicitly selects `row('Knife','prime')`; matching standard inspect was not obtained.
- **Skin variants:** all inherited gun/knife routes are listed. Many cosmetic skins legitimately share standard audio, but their per-skin equip/inspect matching was not independently verified. Prime, BlastX and Black Market heavy attacks still reuse their swing, with no dedicated skin stab. Other knife shapes also inherit standard audio.
- **Footsteps:** concrete/grass/wood are generic; carpet/snow are unused generic library assets. Metal is requested by the runtime but no `impact/footstep_metal_*` files exist, so the unchanged code falls back to synthesis. The [community port](https://gamebanana.com/sounds/77804) could not be fetched here. The [vlr-guessr footsteps collection](https://github.com/Dyrudis/vlr-guessr/tree/c010400f214ec20025aa7aa21b08ba223b08ee49/public/footsteps/sounds) labels shoe types, not surfaces, so it was not falsely mapped to concrete/wood/grass. SpikeMedia's available `FS_*` material clips are Neon slides, not ordinary running footsteps.
- **Impacts:** headshot ding, shield break, landing, magazine-out/in/bolt keyframes remain generic. The same metal-impact logical key previously served headshots, reload-out and inspect, so replacing that one file with a single genuine event would still make other slots wrong. Native body-hit and victim-damage cues now use separate keys.
- **Shared effects:** generic `SFX.smoke`, `flash`, `tp`, `wall`, `heal`, and `ult` cannot identify every specific originating agent/event from their current arguments. Named `SFX.ab(n)` cues were replaced where identifiable. Should these shared triggers receive per-agent context in a later audio-routing task? This handoff preserves their signatures and call sites.
- **UI/spike/round:** low-ammo tick, empty click, last-seconds tick, defuse whir, half-defuse checkpoint, buy-phase cue, round victory and unmapped UI-library entries remain generic. The existing first two default kills attempt missing `voice/Announcer` and then fall back; that fallback now uses the native kill cue, with control flow preserved. Triple/quadra/ace voice routes are retained.
- **Procedural audio:** `xSting` buy/win/loss/half/match-point/victory/defeat/ace cues, lobby/agent/buy music, clutch heartbeat, Lotus door grinding, shared `whoosh`, barrier hum, and procedural map one-shots remain synthesized. Some are bespoke cues without a confirmed one-to-one VALORANT counterpart. Removing them or changing their triggers was outside this content-only change.
- **Ambient:** wind/water are still OpenGameArt; Split still uses the generic sci-fi engine bed. Genuine map loops were not obtained. No map theme or ability loop was passed off as environmental ambience.
- The four retained genuine Killjoy showcase cuts (`turret`, `alarm`, `nanoSet`, `lockdown`) need comparison against the corresponding named extraction events before declaring their timing/content exact.

All 304 remaining generic files are marked `not-found` in assets.csv, including the unused library entries. No unsupported file was silently marked successful. Exact-match review of the remaining source-backed cuts, and interactive listening to the new named cues, remain necessary before claiming full completion.

## Sources and network results

Primary installed collections:

1. [Dartsgame974/SpikeMedia, pinned commit](https://github.com/Dartsgame974/SpikeMedia/tree/0d0505fc199f3915c6db2d51864b091dd6e4f7b5): 32 original MP3s. Its [README](https://github.com/Dartsgame974/SpikeMedia/blob/0d0505fc199f3915c6db2d51864b091dd6e4f7b5/README.md) describes a VALORANT sound archive and credits Riot. The extraction paths name game agents, abilities and Wwise cues.
2. [Jai-R-Mehta/VallyBoard, pinned commit](https://github.com/Jai-R-Mehta/VallyBoard/tree/e8630a8940f0840ef584062abe1f54e1a34696d2): 3 standard knife MP3s. Its README identifies it as a VALORANT soundboard; the files are explicitly named `knifeswing`, `knifepullout`, and `knifestab`.

The working alternate download route was the connected **GitHub file API with base64 output**, not sandbox curl. All installed source lengths and Git blob SHA-1s were verified against the pinned repository tree; all delivered SHA-256s and hashed filenames were verified afterward. Full raw commit download URLs are stored in each manifest entry and replacements.csv. A network-enabled parent can fetch those exact URLs and rerun `python3 work/apply_valorant_audio.py --source-dir DIR`, with sources named `<blob_sha>.mp3` as the pinned plan specifies.

[ValorantPorting's current community fork](https://github.com/barboncino2901/ValorantPorting/blob/master/README.md) documents a searchable Sounds tab and WAV export for about 21,000 local-game effects/voice lines. It requires Windows and an installed game; its repository is an extractor, not a downloadable dump of those sound bytes. Neither a local installation nor those source banks were available here. The older Ka1serM/djhaled repositories did not expose a sound collection in their trees.

[vlr-guessr](https://github.com/Dyrudis/vlr-guessr) was also inspected as a source lead. Its Sage Resurrection WAV at `public/abilities/569fdd95-4d10-43ab-ca70-79becc718b46/06682487-2a0f-4f9c-92bc-0ff9fc42c78a.wav` returned empty base64 content; it was rejected and not installed. A genuine named Resurrection MP3 was obtained from SpikeMedia instead. Generic Kenney footsteps found inside another VALORANT trainer were also rejected as replacement sources.

Every sandbox curl attempt failed with **exit 7**, exactly:

```text
curl: (7) Failed to connect to hatch-egress-proxy port 3128 after 0 ms: Couldn't connect to server
```

| Attempted URL | Result |
|---|---|
| https://valorant-api.com/v1/weapons | curl 7; attempted initially and again during the final network probe |
| https://valorant.dyn.riotcdn.net/x/videos/release-13.08/197511ac-4d5a-97fc-78f8-feb5d090dd20_default_universal.mp4 | curl 7; current Vandal preview could not be independently downloaded |
| https://wiki.playvalorant.com/en-us/Warden | curl 7; source-discovery page fetch, not an audio download |
| https://gamebanana.com/sounds/77804 | curl 7; surface-footstep port page could not be fetched to resolve its archive |

Structured results are in [network-results.json](network-results.json). Web search continued to return text. Web opening `https://valorantporting.com/` was also unavailable; the usable extractor lead is the GitHub fork above. This did not justify replacing unresolved assets with unrelated sounds.

## Formats, changed files, and checks

**No format conversion was necessary.** All 35 installed files were already MP3 and were copied byte-for-byte. Source rates/channels were preserved (44.1/48 kHz; mono/stereo). ffprobe measured durations/codecs; ffmpeg decoded the inputs to a null sink only. All 509 initial MP3s decoded successfully and none had a peak below -55 dB; all 35 installed originals decoded successfully. Together these checks cover every one of the 539 final files because the other 504 original files stayed unchanged.

Modified baseline text files: `audio/manifest.json`, the audio block in `index.html`, and `work/audio_runtime.js`. Added: 35 MP3s, `work/valorant_audio_replacements.json`, `work/apply_valorant_audio.py`, and this audio-only QA handoff. Removed: only the 5 superseded MP3 URLs listed in [changes.json](changes.json). No license or PNG was modified. Runtime inverse-substitution verification reproduces the baseline runtime hash, demonstrating that the runtime diff consists exactly of the reviewed reference changes. Full original-tree hash comparison found no changes outside these audio/reference/report files.

| Check | Result |
|---|---|
| `node work/test_game_audio.cjs` | PASS: all 539 file lengths/hashes, playback caps, shared master, mute/background/cancel, cold-request behavior |
| `node work/test_audio_unlock.cjs` | PASS: existing iOS/Chrome harness unlock/interruption/visibility recovery |
| `node work/test_audio_autoplay.cjs` | PASS: no AudioContext before activation, one running context after gesture |
| `(cd server && node test-release-gate.cjs)` | PASS: production config still gates Spike/local origins and excludes QA tools |
| Content SHA-256 / filename hash / new source Git blob SHA-1 | PASS for all applicable entries |
| Embedded manifest and embedded runtime synchronization | PASS |
| `npm ci --ignore-scripts --no-audit --no-fund --cache /tmp/valorstrike-npm-cache` | Registry requests repeatedly failed with EPERM; remaining retries interrupted (exit 130) |
| `(cd server && npm test)` | First five test files passed; stopped at `test-placement.js` with `ERR_MODULE_NOT_FOUND` for `server/node_modules/three/index.js` from `server/src/world.js` |
| Full client suite / dependency-based tests | Not run to completion; dependencies could not be installed |
| Interactive browser/in-game listening | Not performed; requires parent verification |

The npm error was a download-permission failure, e.g. `GET https://registry.npmjs.org/three/-/three-0.160.1.tgz ... failed with EPERM`, not a failing audio assertion. Logs/results: [tests.json](tests.json), [integrity.json](integrity.json), [dependency-results.json](dependency-results.json), [npm-ci-errors.log](npm-ci-errors.log), [baseline-decode.json](baseline-decode.json).

## In-game verification for the parent

Use the finished tree with a fresh page load so the embedded manifest and in-memory audio buffers update. Enable sound through a real user gesture and wait for the loadout prewarm. Keep the existing server configuration; this task does not require enabling Spike or deploying anything.

1. In an existing local/practice session, fire/reload/equip/inspect each of the 20 guns and the knife. Verify the 18 previously supported gun profiles remain unchanged. Explicitly record the unresolved Bandit/Warden, Judge equip and inspect slots rather than signing them off.
2. Use default knife light/heavy attack and equip; compare against the VallyBoard source. Test Prime/BlastX/Black Market knives and firearm fire/reload/inspect, then first-through-fifth kills and finishers. Heavy native skin stabs remain unresolved as documented.
3. Trigger every listed named ability, especially separate Cloudburst throw/pop, Blade Storm draw/throw, Phoenix activation/return, turret deploy versus shot, and Nanoswarm placement versus activation. Compare source clips; the new samples may be only one native layer of a larger event.
4. Click UI buttons; score body hits, take damage, obtain standard kills; finish a round with a loss and finish matches with victory/defeat. Check retained gain settings, panning, voice limits, mute/unmute, hidden-tab stopping and iPhone interruption recovery.
5. Where Spike is already authorized/enabled in the parent's test setup, trigger existing detonation path. The unchanged `SFX.plantBeep` route is used during planting; a planted-spike countdown beep is not the same event, so its candidate was not installed. Planting-beep/defuse-whir/checkpoint remain unresolved.
6. Walk over concrete/grass/wood/metal, and listen on default/Lotus/Split maps. These remain unresolved and should still expose the listed generic/synthesized audio; do not interpret an integrity-test pass as authenticity.

For targeted asset listening in a test browser after unlock: `await xGameAudio.warm('ability/dash')` does not return a loading promise, so warm the key and wait until `xGameAudio.state.buffers.has(key)` before `xGameAudio.play(key, 'ability')`. Inspect `xGameAudio.state.errors` for integrity/decode errors. The first cold request intentionally schedules loading without delayed playback.

**No push or redeploy was performed. The parent should verify this partial audio change and resolve the remaining entries before declaring the original request complete.**
