# VALORANT gameplay parity audit (vs-lane-parity, 2026-10-28)

User 23:05 2026-10-27: "Just go through every gameplay detail and compare with how Valorant does it. If Valorant does it
differently, change the game to do it like how Valorant does it."

Scope: weapons, armour, economy, round flow, movement constants, ult points / orbs, Spike, kill feed, audio cues, DM / TDM,
Swiftplay / Spike Rush. NOT re-audited here (own lanes): abilities (`abilities-audit-2026-10-27.md`), death
(`death-parity-2026-10-27.md`), HUD + shotgun crosshair (`hud-parity-2026-10-28.md`), bots, perf.

Base: `origin/main` f0674d7. Live VALORANT patch: **13.09** (2026-10-27). Earlier audits this builds on and re-checks:
`values-weapons.md` (qa-35, 267 weapon rows vs valorant-api 13.08), `values-game.md` (fog-spec-2/3, 13.08),
`valorant-parity.md` (hark-parity, 2026-10-25). Raw source copies: `/workspace/work/qa/parity/src/` (wiki `?action=raw`).

## Sources (opened 2026-10-28)

- [P1309] https://playvalorant.com/en-us/news/game-updates/valorant-patch-notes-1309/ (latest; Warden buff, Hush, Clove, Jett buy-menu passive)
- [W-Weapons] https://wiki.playvalorant.com/en-us/Weapons (deadzone 27.5 %, tagging 72.5 %, landing +7 deg binary 0.225 s, 6.11 uniform moving error)
- [W-Bandit] https://wiki.playvalorant.com/en-us/Bandit · [W-Warden] https://wiki.playvalorant.com/en-us/Warden
- [W-Swift] https://wiki.playvalorant.com/en-us/Swiftplay · [W-Credits] https://wiki.playvalorant.com/en-us/Credits (Swiftplay table)
- [P-YE22] https://playvalorant.com/en-us/news/game-updates/valorant-2022-year-end/ (Riot's Swiftplay rules: 800 / 2400 (+600 pistol win) / 4250 / 4250, 2 ult points each half, sudden death)
- [W-TDM] https://wiki.playvalorant.com/en-us/Team_Deathmatch (stage loadouts incl. armour, weapon spawners, ult 3 per kill / 10 per orb)
- [W-Orbs] https://wiki.playvalorant.com/en-us/Orbs (2 s capture channel, gone on plant / round end, Haven + Lotus orbs by A and C)
- [W-Spike] https://wiki.playvalorant.com/en-us/Spike · [W-Unrated] https://wiki.playvalorant.com/en-us/Unrated
- [API] https://valorant-api.com/v1/weapons (13.08 snapshot = `models/valorant/weapon-calibration.json`)
- plus every source listed in `values-weapons.md` / `values-game.md` (re-used, not re-fetched when 13.09 did not touch the value)

Status: **match**, **FIXED** (this lane, commit named), **gap** (differs, not fixed yet - action named), **missing** (VALORANT
has it, we don't), **note** (unpublished / approximation).

## 0. What changed in VALORANT since the last audit (13.08 -> 13.09)

| Item | 13.09 | Ours | Status |
|---|---|---|---|
| Warden: pitch recoil smoothed, 2nd-bullet error .25 -> .2, 3rd .6 -> .5 | [P1309] | Warden added (see 1.2); per-bullet error steps not modelled (our spray = bloom per shot) | **FIXED** (gun added) / note |
| Clove Pick-me-up 15 % -> 10 %, Not Dead Yet kill reward; Hush (new agent) | [P1309] | agents not in game | n/a |
| Jett passive removed from the buy menu | [P1309] | Drift not listed in our buy menu (`buyMenu` lists C/Q/E only) | match |
| Haste / Snapshot buff names + Haste timer bar | [P1309] | Jett/Raze have no Haste abilities; Neural Theft / Spycam reveal not renamed | note (UI wording; HUD lane) |
No 13.09 change touches any weapon, economy, round or movement value that exists in this game.

## 1. Weapons (gunplay)

### 1.1 Existing 18 guns + knife

Every row below was re-checked against `server/src/weapons.json` / `models/valorant/weapon-calibration.json` (one file, page +
server) and the shared motor `vendor/valorant-feel.js` (= `server/src/motor.cjs`, byte-identical).

| Area | VALORANT (source) | Ours (file:line) | Status |
|---|---|---|---|
| Price, mag, reserve, fire rate (hip + ADS), reload, equip normal/fast/instant, run multiplier, ADS zoom + move multiplier, pellets, wall-pen tier, damage per range band head/body/leg (floored) for all 18 guns | [API] 13.08 + wiki weapon pages (267 rows in `values-weapons.md`) | `server/src/weapons.json`, `server/src/spike.js:27` prices, `server/src/simulation.js:11-13` reserve / knife, `work/feel_runtime.js` page copy | match (13.09 changed none of them) |
| Spread table per gun: 1st shot standing/crouched, max standing/crouched, crouch-walk / walk / run / air penalties, ADS rows | wiki "Spread values" tables | `vendor/valorant-feel.js` SPREAD (`spreadRow` :255) | match |
| Movement-accuracy deadzone 27.5 % (Operator 15 %) | [W-Weapons] 3.0 | `vendor/valorant-feel.js:10` `deadzone:.275,operatorDeadzone:.15` | match |
| Penalty ramps with speed (accel / decel), no "walking" state when stopping from a run | [W-Weapons] text + 0.50 | `moveRamp` `vendor/valorant-feel.js:256` uses the current speed and the RUN row unless walk key held | match |
| Landing: +7 deg, binary, 0.225 s | [W-Weapons] 1.09 | `C.landSpread 7`, `landSpreadTime .225`, `:268` | match |
| Moving error almost uniformly random in the cone | [W-Weapons] 6.11 | `disk()` area-uniform | match |
| Standing error centre bias ("error power") | unpublished value | uniform disk | note |
| Recoil pattern (per-gun pitch climb / yaw drift) and recovery | Riot publishes only deltas (e.g. Bandit "pitch recoil at max down 4 -> 3", Warden 13.09 "smoothed"); no full patterns | `REC` weights + generic climb `vendor/valorant-feel.js:276-292`; recovery .375 Vandal / .35 Phantom-Bulldog-Guardian / .4 Stinger / .28 rest (wiki update histories) | note (approximation; recovery times sourced, patterns not) |
| Running / airborne recoil x1.8 Vandal/Phantom/Spectre, x1.5 Frenzy | patch 6.11 / 4.0 | `recoilMove` `:288` | match |
| Tagging: 72.5 % slow (x.275) for 0.5 s; shotgun > 10 m 30 % easing | [W-Weapons] 3.0, patch 1.07 | `server/src/simulation.js:52-54` `tagHit/tagMul`; page `tagT` (index.html ~3127) | match (0.5 s duration is ours, unpublished) |
| Bulldog/Stinger ADS bursts, Odin spin-up (ramp time assumed), Classic alt, Bucky air burst, Outlaw bloom hold | wiki pages | `CADENCE`, `CLASSIC_ALT`, `BLOOM_HOLD` in the motor | match (Odin ramp = assumption) |
| Melee 50/100 light, 75/150 heavy, no headshot bonus, 2 m reach, 6.75 m/s | wiki Melee | `server/src/simulation.js:11-13`, page | match |
| Wall penetration depth/damage per tier | tier only published | High .6 m x.75, Med .35 m x.5, Low .15 m x.5 | note |

### 1.2 Arsenal completeness

| Item | VALORANT | Ours | Status / action |
|---|---|---|---|
| **Bandit** (Sidearm, 600, Medium pen, semi 5.1/s, mag 8 / reserve 24, reload 1.5, equip .75/.45/.15, run 5.4, dmg 0-10 m 152/39/33, 10-30 m 128/39/33, 30-50 m 112/34/28, spread .275/.21 -> 1.97/1.48, +.5/1.2/2.7/7, recovery .4) | [W-Bandit] (12.00, buffed 13.00); TDM Stage 1 (no armour) + Spike Rush round 1 option | was not in the game | **FIXED** (parity-2): native model + FP/GN clips (Kingdom Archives), weapons.json / calibration (valorant-api), motor SPREAD + RECOVERY .4, prices, RESERVE, re-equip, sidearm slot (server floor/spike/modes, page bSide/XD/XGRIP/NET), buy menu (6 sidearms), bots (server bot-brain pistol/eco, page fBotBuy), TDM Stage 1, Spike Rush round 1, DM list. Tests `server/test-wiki-weapons.js`, `work/test_bandit_warden.cjs` (red before) |
| **Warden** (Rifle, 2900, Medium pen, auto 6.5/s, mag 18 / reserve 36, reload 2.5, equip 1/.6/.2, run 5.4, ADS 2x zoom x0.76 move, dmg 0-50 m 200/50/42 no falloff, spread .15/.13 -> 1/.85 (ADS .04/.034 -> 1.02/.87), +.8/3/6/10; 13.09: 2nd/3rd bullet error .2/.5) | [W-Warden], [P1309] | was not in the game | **FIXED** (parity-2): same pipeline; spray rifle, ADS 2x (XZ), Spike Rush round 3 (>= 2250 rule; the wiki list predates it), bots 10 % of rifle buys (inferred). Notes: recoil weights (REC Bandit .8 / Warden .9) and FP grip rows (= Sheriff / Vandal) are approximations; fire / reload audio uses the procedural fallback (no reviewed Bandit / Warden cuts in `audio/manifest.json` yet); no skins catalog entries |

## 2. Armour / health

| Item | VALORANT | Ours | Status |
|---|---|---|---|
| HP 100; Light 25 / 400 cr, Heavy 50 / 1000 cr, 66 % absorb; Regen Shield 25 (650 cr, 100 % absorb, 50 pool) | wiki Armor_and_Shield, patch 9.10 | `server/src/simulation.js:41-44` `RGN`, absorb in `applyHit :134`; page same | match |
| Regen refill timing | "after a brief delay" (no number) | 3 s delay, 12.5/s | note (unpublished) |
| Fall damage 15 at ~8 m -> 100 at ~17 m, health only | [W-Unrated] | motor apex->landing, linear | match (curve between points assumed) |

## 3. Economy

| Item | VALORANT | Ours | Status |
|---|---|---|---|
| Unrated: start 800 each half, cap 9000, kill 200, plant 300 (attackers), win 3000, loss 1900/2400/2900 (streak resets on win), survivor-of-loss 1000, Endgame 5000, sell-back 100 % in buy phase | [W-Credits] | server `spike.js:19,133`, page `fCheck` (index.html ~10325) | match |
| **Swiftplay credits** (offline page): R1 800, R2 +2400 (+600 to the team that won R1), R3 +4250, R4 +4250, kills / plant on top, no loss bonus, Endgame (4-4) 5000 | [W-Swift], [W-Credits], [P-YE22] | server `modes.js:71` correct; **page**: 4000 + win 3000 / loss 1900-2900 every round, no Endgame 5000 | **FIXED** (page; see commits) |
| **Swiftplay ult** (offline page): 2 points at the start of each half (3 for 9-point ults), no other bonus | [W-Swift], [P-YE22] | page: +1 point after every round, none at half start | **FIXED** (page) |
| Swiftplay Endgame ult (server): none listed (Unrated keeps ults) | [W-Swift] lists all differences from Unrated | server `modes.js:102` set swift ults to "3 short" at Endgame (Spike Rush rule copied) | **FIXED** (server; worker redeploy) |
| Swiftplay buy phase 45 s on the first round of each half | = Unrated rule (server `modes.js:71`) | page: 45 s only on round 1 (n=0/12/24), 30 s on Swiftplay round 5 | **FIXED** (page) |
| Spike Rush: no credits; round 1 any sidearm / no shields, round 2 primary <= 2050 / Light, round 3 + Endgame primary >= 2250 / Heavy; kill + death ult points x2; Endgame everyone 3 short; no starting ult | wiki Spike_Rush | server `modes.js:64-75, 105-110` match; **page**: any primary every round, Heavy always, ults started at half, kills/deaths +1 | **FIXED** (page `SR_LOAD` = server `SR_LOADOUT`, ult x2 player + bots, Endgame 3 short) |
| Spike Rush powerup orbs: 1-5 a round at fixed spots, 5 effect types | wiki Spike_Rush | server 1-5 random +1 ult (no effects); page 4 fixed orbs +1 ult | note (effects not implemented; spots unpublished) |
| Ult orbs in Unrated online | [W-Orbs] (2 orbs every round; Unrated / Competitive / Swiftplay / Replication, not Spike Rush) | server five-mode had no ult orbs (page offline only) | **FIXED** dcf2218 (`server/src/ultorbs.js`: 2 per round, 2 s interact channel standing / not firing, +1 ult, gone after capture / plant / end phase; bots 1 in 5 walk over; snapshot `uo` / `uoc` drawn by `work/server_runtime.js` nmUltOrbs; Spike Rush none) |

## 4. Round flow / Spike

| Item | VALORANT | Ours | Status |
|---|---|---|---|
| Buy 30 s (45 s first round of half / Endgame), round 100 s, plant 4 s, fuse 45 s, defuse 7 s + 3.5 s checkpoint, post-round 7 s, first to 13, swap after 12, Unrated Endgame sudden death at 12-12 | [W-Unrated], [W-Spike] | `server/src/spike.js:25-26,50,78`; page `fRound` index.html ~8100, `fCheck` ~10335 | match |
| Detonation 32.5 m kills both teams, no credit | valorant.gs rules | `spike.js:132` `detonate`, page `fDetonate` | match |
| Beep cadence 1 / .5 (<20 s) / .25 (<10) / .15 (<5) / .1 (<1) | valorant.gs rules | same (81a6514) | match ("double / triple beep" wording = the faster cadence; single tone per beep kept: note) |
| Plant/defuse rooted, can rotate; plant audio cue to players in range | [W-Spike] | rooted (input hold), cue sounds | match |
| Ult orb capture: 2 s channel, unequip + crouch, gone on plant / round end | [W-Orbs] | page offline: **3 s** hold, orbs stayed after the plant | **FIXED** (2 s, removed on plant) |
| Orb positions: outside A and B sites (Haven / Lotus: A and C) | [W-Orbs] | page SPOTS by legacy callout lists (other maps' coordinates on native maps: wrong place, y 0) | **FIXED** dcf2218 for native maps: server `ORB_SPOTS` = page `XUO_SPOTS` (pinned in `server/test-ult-orbs.js`), the passageway callout outside each site (Haven / Lotus A + C), on the nearest nav node at floor height; exact spots are a note (Riot publishes none) |

## 5. Movement constants (motor; locomotion animations are the user's and untouched)

| Item | VALORANT | Ours | Status |
|---|---|---|---|
| Knife 6.75; per-weapon multiplier (rifles .8 = 5.4, pistols/SMG .85 = 5.73, heavies .76 = 5.13); ADS multipliers; walk .6; crouch-walk 2.5 knife | [API], Stark physics doc, Riot 2020 data | `vendor/valorant-feel.js:10`, `simulation.js` step speed | match |
| Accel 0.288 s (crouch .472), stop dv/dt = -(7.3625 v + 46.5), jump 6.902 m/s, g 20.45, air <= melee speed, crouch .276 s | Stark measurements, patch 12.09 | `vendor/valorant-feel.js:10` | match |
| Tag slow 72.5 % | [W-Weapons] | see 1.1 | match |
| Motor changes in this lane | - | none (`server/src/motor.cjs` == `vendor/valorant-feel.js` re-checked) | - |

## 6. Ult points

| Item | VALORANT | Ours | Status |
|---|---|---|---|
| +1 kill, +1 death by enemy, +1 orb, +1 plant, +1 defuse; costs per agent (Jett 8, Phoenix 7, Sova 8, Sage 7, Reyna 7, Omen 7, Killjoy 9, Raze 8, Skye 8, Breach 8, Cypher 7, Chamber 8) | [W-Unrated], valorant.gs agents | `server/src/kits.json`, `ults.js`, `spike.js:127` | match |
| TDM: 3 points per kill, 10 per ult orb; abilities recharge over time | [W-TDM] | online TDM (`simulation.js`) has no abilities/ults at all; offline TDM ult +1 per kill | gap - TDM abilities online is a server feature, not a constant; listed |

## 7. DM / TDM

| Item | VALORANT | Ours | Status |
|---|---|---|---|
| DM 40 kills / 540 s, 1.5 s respawn, health pack 8 s +50 HP / +25 armour | [W-DM], valorant.gs | `simulation.js:24,36` | match |
| TDM 100 kills / 570 s, stages 75/75/75/345 with stage guns, 1.5 s respawn | [W-TDM] | `simulation.js:24-32` | match |
| **TDM armour per loadout**: S1 Classic Regen Shield, Frenzy/Ghost/Bandit none; S2 Sheriff Light, Stinger Heavy, Ares Light; S3 Spectre/Ares/Bulldog Heavy, Guardian Light; S4 Phantom/Vandal Heavy | [W-TDM] Loadout tables | everyone kept Heavy (50) in every stage | **FIXED** (server `TDM_ARMOR`/`tdmArmor` in `simulation.js` spawn + stage re-arm; page `TDM_ARM`/`tdmArmSet` in `dmSpawnB`/`dmSpawnP`/`tdmStageArm`; worker redeploy) |
| TDM kill heal | none in VALORANT (healing = Recovery Orbs) [W-TDM] | page offline topped the killer up to 100 HP / 50 armour (server never did) | **FIXED** (page: removed) |
| TDM Recovery Orbs: 6 s buff restoring health + loadout armour (not the Regen pool), respawn 30 s, ally zone | [W-TDM] Orbs | not in the game | **FIXED** 44dcb01 (server `server/src/tdmorbs.js` real TDM rooms, snapshot `tro` / `trz`; page offline + online draw in `work/game_rules_runtime.js` TDMREC). Note (unpublished, inferred): full bar over the 6 s, 0.9 m reach, hurt-only pickup, 3 m / 6 s zone, spots = 4 named callouts per map (Riot's TDM maps are not in the game) |
| TDM weapon spawners (stage guns with their own ammo), TDM ult orbs (10 points) | [W-TDM] | not in the game | missing - spawners: content + stage-swap rules; ult orbs wait for TDM ultimates online (6.) |

## 8. Kill feed / audio

| Item | VALORANT | Ours | Status |
|---|---|---|---|
| Kill feed: killer, weapon icon, headshot / wallbang marks, kills only | in-game; patch 12.05 | done by hitfx-2 (0086604) / HUD lane | match (owned) |
| Footstep audible range | unpublished | player steps every 1.85 m; bots 0.4 s timer | note (`notes-qa33-parity.md`) |

## Fix plan (priority gunplay > economy > round flow > movement > misc)

1. Gunplay: no value gaps in the 18 existing guns. Bandit + Warden added in vs-lane-parity2 (see 1.2).
2. Economy: offline Swiftplay credits + ult + buy phase (page), server Swiftplay Endgame ult.
3. Round flow: ult-orb 2 s capture + removal on plant (page).
4. TDM per-loadout armour (server + page) if budget remains.

Results of each fix: see "Commits" below (filled in as they land).

## Commits
- 1be75aa audit document (this file)
- db27fa6 Swiftplay economy + ult + buy phase (page), Swiftplay Endgame ult (server) - test `work/test_swiftplay_economy_offline.cjs` (red before), `server/test-modes.js`
- 6b8b106 ult orbs 2 s channel, gone on plant (page) - `work/test_ult_orb_rules.cjs` (red before)
- 125b772 TDM armour by loadout (server + page), no offline TDM kill heal - `work/test_tdm_armor_offline.cjs` (red before), `server/test-game-rules.js`
- e8a11a0 Spike Rush loadouts / shields / ult x2 / Endgame (page) - `work/test_spike_rush_offline_rules.cjs` (red before)
- 2e9ef95 TDM loadout armour only for real TDM rooms (createSim) - `server/test-gunplay.js`
- 058aedb Bandit + Warden (server + page + models) - `work/test_bandit_warden.cjs` (red before), server weapon tests
- dcf2218 ult orbs online (server `ultorbs.js`) + client draw + offline native-map orb spots - `server/test-ult-orbs.js`, `work/test_ult_orb_rules.cjs` (native part red before)
- 48b4471 bot benchmark fights keep the Vandal (`server/tools/bot-benchmarks.mjs` Stage 4; failing `test-bot-human` after Bandit joined TDM Stage 1)
- 44dcb01 TDM Recovery Orbs (server `tdmorbs.js` + page offline / online draw) - `server/test-tdm-orbs.js`, `work/test_tdm_recovery_orbs.cjs` (red before)

## Follow-up: Bandit + Warden weapon-add lane (not done here)

Touch points found (every file that names Guardian today): `models/valorant/{bandit,warden}.glb/.json` + `animations/<w>.json`
(`python work/import_valorant.py bandit warden`; FP clips via `jett-fp?held=<w>` in `work/import_valorant_animations.py`),
`models/valorant/manifest.js` (`work/build_valorant_manifest.py`), `models/valorant/weapon-calibration.json/.js`
(`work/build_weapon_calibration.py` currently keeps 18 guns: add the two API entries), `server/src/weapons.json`,
`server/src/spike.js` prices (Bandit 600, Warden 2900), `server/src/simulation.js` RESERVE (Bandit 24, Warden 36),
`server/src/windups.js` re-equip, `vendor/valorant-feel.js` (+ `server/src/motor.cjs`) SPREAD rows / REC / RECOVERY (Bandit .4,
Warden 13.09 2nd/3rd bullet error .2/.5), `server/src/modes.js` SIDEARMS / SR_LOADOUT (+ page `SR_LOAD`), TDM Stage 1 Bandit
(`TDM_STAGES`, page `TDM_C`, `TDM_ARMOR` Bandit none), bots buy tables (`vendor/bot-brain.cjs`, page `fBotBuy`), buy menu
slot (`BUY MENU FIT` block; VALORANT: 6 sidearms, 5 rifles), audio (`audio/manifest.json`, `work/import_game_audio.py`),
kill-feed icon, skins catalog (`server/src/skins.json`), tests pinning 18 guns (`server/test-weapons.js`,
`test-wiki-weapons.js`, `test-spread.js`, `work/test_weapon_values.cjs`, `test_loadout.cjs`, `test_buy_menu_fit.cjs`,
`work/audit.js`, `work/verify_valorant.js`). Worker redeploy needed (weapons.json / motor).
