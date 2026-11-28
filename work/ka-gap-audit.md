# Kingdom Archives integration - gap audit (content-ka branch, 2026-11-27)

Scope: what was downloaded from kingdomarchives.com (KA), what shipped into the game, and the
grounded list of gameplay gaps that remain. Assets (c) Riot Games, sourced via the KA fan site
(models/valorant/SOURCES.md); no rights are claimed or cleared beyond what those files state.

## Downloads (storage, separate from shipped payload)

| Category | Catalog | Stored | Where |
| --- | --- | --- | --- |
| Playercards | 1,039 catalog rows = 1,037 real cards + 2 misparsed size rows (VALORANTCard_small/wide) | 1,037 cards x 3 sizes + index.json | assets/playercards/ (shipped, lazy) |
| Kill banners | 94 sets | 999 files + sets.json (imgs/audios/swap maps) | assets/killbanners/ (shipped, lazy) |
| Voicelines (events) | 382 in-game event mp3s | all 382 + index.json | assets/voicelines/ (shipped, lazy) |
| Voicelines (full mirror) | 13,344 files | all 13,344 (~877MB) | GitHub Release asset ka-voicelines-full.tar.gz on B-Eddie/valorstrike (checksum-verified after upload); moved OFF the ka-voicelines-full orphan branch because it made every Vercel build clone ~4 min |
| Homescreen videos | 57 (YouTube embeds) | NOT downloaded: yt-dlp bot-blocked, KA serves YouTube embeds only, no cookieless download path within supported access | 57 thumbnail stills in assets/homescreens/ (shipped, used as stills) |
| Device/creature models | wingman, dizzy, thrash, mosh-pit, sonic-sensor, gravnet, razorvine, baby-* + 34 earlier models | .glb + .json sidecars | models/valorant/ (shipped, loaded on demand) |

## Shipped features (this branch)

1. Profile playercard picker (1,037 cards) + selected card art on the Profile tab.
2. Profile kill-banner picker (94 sets) with in-picker preview; in-match banner + audio on your kills.
3. Event voicelines (kill / triple / ace / headshot / death) through the GA audio runtime.
4. Lobby homescreen still rotation (57 stills; the videos themselves are the caveat above).
5. Real glb device/creature models replacing procedural placeholders for Gekko (wingman, dizzy,
   thrash), Deadlock (sonic-sensor, gravnet) and Vyse (razorvine), with run/idle clips driven by
   the fx game-dt tick; procedural visuals remain as instant placeholder and load fallback.

## Remaining gaps (grounded, not closed by this branch)

1. Golden Gun model: the Spike Rush Golden Gun powerup is fully implemented in mechanics
   (work/game_rules_runtime.js srGoldenSet/srGoldenOn: one-shot 800-damage Sheriff), but it
   renders the native Sheriff; the imported models/valorant/golden-gun.glb is not yet wired as
   the viewmodel/world model while the powerup is active. Asset available, swap not done.
2. Veto FP ult binding: Veto's Evolution ult has world fx (work/veto_fx_runtime.js) but no
   first-person binding/visual for the caster (no veto entry in work/ability_fp_runtime.js).
3. Gekko globules: creature death/reclaim globules (a18Glob state) still use procedural visuals;
   baby-wingman/baby-dizzy/baby-thrash models are imported but the globule spawn path has no
   clean fx handle to wrap (state-only a18Glob), needs a small spawn-side hook.
4. Mosh pit: gkxMoshThrow arcs a projectile then lands; the mosh-pit.glb is imported but not
   attached (the thrown glob needs the projectile, the pit needs a post-landing hook).
5. Homescreen videos: see Downloads table. Stills are shipped and presented as stills.
6. Remaining newer-agent device kinds without imported geometry (tejo sdrone/xcut, vyse mesh,
   waylay, etc.): audited in the KA models catalog; no matching glb was published by KA at
   download time, so procedural approximations remain the correct implementation there.

## Verification state

- install_valorant.py regen: idempotent; index.html parses (12 inline scripts, 0 bad).
- node tests: test_global_names, test_audio_valorant, test_fx_modules_real, test_agents18 pass.
- Vercel preview: see parent report for screenshot-verified checkpoint (playercard picker,
  banner picker + preview overlay, lobby bg, device models). Branch previews required widening
  the project's Ignored Build Step to include content-ka (restored to main-only after verify).
- Merge to main: NOT done; held for checkpoint review.
