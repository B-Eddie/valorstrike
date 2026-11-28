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

1. Golden Gun model: CLOSED as an original tint (d34e57a): while the powerup is active the
   first-person Sheriff viewmodel renders gold-tinted (cloned existing materials; no imported
   asset, safe under the rights pause). The imported golden-gun.glb stays unwired pending rights.
   Third-person model not tinted (accepted v1 limit).
2. Veto FP ult binding: CLOSED (365574e, hardened 5a5da6a): while Evolution is active the FP rig
   builds from veto-fp-ult.glb (xvFPArmsOverride hook); offline + online transitions covered,
   race-tested (work/test_veto_fp_ult.cjs). Third-person model not swapped (accepted v1 limit).
3. Gekko globules: CLOSED (this branch): a18Glob(k, fxHandle) spawns the baby-wingman /
   baby-dizzy / small mosh-pit glb at the creature's end position until the reclaim timer
   returns the charge (game-dt via vtxPush). Covered by work/test_ka_globules.cjs.
   baby-thrash.glb remains unused: Thrash has no reclaim path in this codebase (mechanics
   parity question, out of scope here).
4. Mosh pit: CLOSED (this branch): gkxMoshThrow rides the arc as mosh-pit.glb; the landed pool
   keeps the procedural goo (zone readability) with the model in the middle.
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
