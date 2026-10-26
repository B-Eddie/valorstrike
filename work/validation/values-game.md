# Game values vs VALORANT (fog-spec-2, 2026-10-26, live patch 13.08)

User 10:32: "search online for everything that you have, e.g. values for stuff, and verify it's right". Weapons (damage, fire
rate, mags, reload, equip) are qa-35's (`work/validation/combat-notes.md`, `server/test-wiki-weapons.js`); per-ability
unequip / re-equip times are qa-35's (`server/src/windups.js`). Everything else is here. Patch: 13.08 (2026-10-13, latest;
https://playvalorant.com/en-us/news/game-updates/valorant-patch-notes-13-08/ ; 13.09 due 2026-10-27/28).
Pinned by `server/test-values-game.js` (in `npm test`) unless a row names another test.

Sources (opened 2026-10-26):
- [CR] https://wiki.playvalorant.com/en-us/Credits · [UN] https://wiki.playvalorant.com/en-us/Unrated · [CO] https://wiki.playvalorant.com/en-us/Competitive
- [SP] https://valorant.fandom.com/wiki/Spike · [AR] https://wiki.playvalorant.com/en-us/Armor_and_Shield · [P910] https://playvalorant.com/en-us/news/game-updates/valorant-patch-notes-9-10/
- [DM] https://wiki.playvalorant.com/en-us/Deathmatch · [TDM] https://wiki.playvalorant.com/en-us/Team_Deathmatch · [TDM101] https://playvalorant.com/en-us/news/game-updates/valorant-team-deathmatch-101
- [VG] https://valorant.gs/rules/ (rules read from the 13.08 game files) · [VGA] https://valorant.gs/agents/<agent>/ (13.08 game files: ult points, costs, charges, cooldowns)
- [P1300] https://playvalorant.com/en-us/news/game-updates/valorant-patch-notes-13-00/ · [P1205] https://playvalorant.com/en-us/news/game-updates/valorant-patch-notes-12-05/
- [AB] wiki.playvalorant.com/en-us/<Ability> pages (stats tables + update history; raw copies in the project's work/values_src/)
- [ECO] https://dignitas.gg/articles/a-detailed-valorant-economy-guide , https://valohub.co/economy (loss streak reset on a win)
- [PACE] project notes `work/notes-pace.md` (bots-human-1 movement audit, 2026-10-26) and `work/validation/valorant-parity.md` §1

Status: **match**, **fixed** (this commit), **differs** (kept, reason given), **missing** (not in the game), **open**.

## Round / phase timers

| Value | Ours | Source | Status |
|---|---|---|---|
| Buy phase 30 s; 45 s on the first buy of each half and of endgame/overtime (rounds 1, 13, 25) | `buyPhaseSeconds` 45/30, offline same | [UN], [VG] Buy phase 30s | match |
| Round 100 s | `remaining=100` | [UN], [VG] | match |
| Plant 4 s | `sp.pt>=4` (offline same) | [SP] "exactly 4 seconds", [VG] | match |
| Spike fuse 45 s | `t:45`, offline `SPIKE.fuse` 45 | [SP], [VG] | match |
| Defuse 7 s, progress kept at 3.5 s | `sp.dt>=7`, checkpoint 3.5 (offline `SPIKE` 7 / 3.5) | [SP], [VG] | match |
| Defuse cancel window 0.2 s; defuse range 100 uu | none / 2.5 m disk | [VG] (file field names only; meaning of "range" unclear) | open (not changed) |
| Explosion: inner 5 m, outer 32.5 m | `SPIKE_RADIUS` 32.5 (kills inside) | [VG] 500 / 3250 uu | match (outer) |
| Beep cadence 1 / 0.5 (<20 s) / 0.25 (<10) / 0.15 (<5) / 0.1 (<1) | same (81a6514) | [VG] | match |
| Post-round 7 s | `POST_ROUND` 7 | [UN], [VG] | match |
| First to 13; sides swap after round 12; overtime from 12-12, win by 2, sides swap every OT round | same | [UN], [CO] | match |
| Unrated endgame = one sudden-death round 25, no side swap | ours plays Competitive overtime | [UN] vs [CO] | differs (we follow Competitive) |
| Pre-round barriers drop at round start | yes (buy-phase walls) | [UN] | match (not re-measured) |

## Economy

| Value | Ours | Source | Status |
|---|---|---|---|
| Start 800 each half; cap 9000 | 800 / 9000 | [CR], [VG] | match |
| Kill 200; plant 300 (attackers) | 200 / 300 | [CR], [VG] | match (VG pays both at round end; ours at once - only visible mid-round) |
| Win 3000; loss 1900 / 2400 / 2900 (+500 per loss, max streak 2); streak resets on a win | same | [CR], [VG], [ECO] | match |
| Survivor of a lost round: 1000, no loss bonus (attacker without plant, defender after detonation) | `survivorLoss` | [CR] (v1.11), [VG] Save Round Loss 1000 | match |
| Overtime: 5000 each round, ult points 3 short | same | [CR], [CO], [VG] OvertimeStart 5000 | match |
| Sell-back 100 % in buy phase | yes | [VG] Sellback 100% | match |
| Prices: Light 400, Regen 650, Heavy 1000 | same | [AR], [CR] | match |
| Credits page lists Barrier Orb 400 | ours 300 | [AB] Barrier_Orb v11.08 "Cost reduced 400 -> 300"; [VGA] sage 300 | match (Credits page is stale) |

## Health / shields / damage taken

| Value | Ours | Source | Status |
|---|---|---|---|
| HP 100 | 100 | wiki Health | match |
| Light Armor 25, absorbs 66 %; Heavy 50, 66 % | 25 / 50, `.66` | [AR] | match |
| Regen Shield 25, absorbs 100 %, pool 50 | `RGN` cap 25, pool 50, 100 % | [AR], [P910] | match |
| Regen Shield refill: "after a brief delay" | delay 3 s, 12.5/s (25 in 2 s) | [P910] (no numbers); esports.net/jp (secondary): 3 s delay, 25 in 3 s | open - official numbers not published; kept |
| Fall damage 15 at ~8 m -> 100 at ~17 m, health only | linear 15->100 | valorant-parity.md (W-Unrated) | match (curve between end points assumed linear) |

## Ult points

| Value | Ours | Source | Status |
|---|---|---|---|
| +1 kill, +1 killed by an enemy, +1 orb, +1 plant, +1 defuse | yes (no point for spike / fall / OOB deaths) | [UN], [VG] mode fields | match |
| Jett 8, Phoenix 7 (13.02: 6->7), Sova 8, Sage 7, Reyna 7 (12.02), Omen 7, Killjoy 9, Raze 8, Skye 8, Breach 8 (11.08), Cypher 7, Chamber 8 | `kits.json u` same | [VGA], [AB] | match |

## Abilities (costs / charges / cooldowns: all 12 agents vs game files)

All costs and max charges in `kits.json` equal [VGA] (13.08 files) and the wiki infoboxes; full per-ability stats in
`work/validation/abilities-parity.md` (re-checked today against the wiki stats tables: Barrier 600 HP / 2 s fortify / 40 s,
Slow Orb 7 s 50 %, Healing Orb 100 over 5 s (self 100 since 13.00), Shrouded Step 15 m / 1.2 s, From the Shadows 4 s,
Paranoia 20 m/s / 25 m / 4.3 m / 2 s, Dark Cover 4.1 m, Cyber Cage 3.72 m / 7.25 s, Cloudburst 3.35 m, Nanoswarm 5 s / 4.5 m /
45 per s (13.00), Alarmbot 22.5 m/s (13.00 +50 %), Turret 1.25 s cycle (13.00 +50 % rate), Trapwire 0.7 s windup (13.00),
Fault Line 8-56 m / 1 s / 8 m wide / 2.5 s, Rolling Thunder 32 x 18 m / 4 s, Flashpoint 2.25 s, Guiding Light 18 m/s /
1-2.25 s / 0.3 s, Trailblazer 3.5 m / 30 / 6 s, Seekers 3 / 15 s / 3 s nearsight / 5 s 60 % slow, Hunter's Fury 80 / 66 m /
2.125 s, Showstopper 150->30 4/7 m, Lockdown 32.5 m / 13 s / 8 s, Neural Theft 18 m / 2 + 4 s, Rendezvous 18 m / 1.3 s,
Tour De Force 150 / 0.9 per s, Devour 50 over 3 s + 10 s overheal, Dismiss 1.5 s / 12 m/s, Tailwind 1 s / 7.5 s / 0.45 s / 11 m).

| Value | Ours | Source | Status |
|---|---|---|---|
| Signature recharge: Sage 45, Omen 40, Chamber 30, Sova / Skye / Breach 50 | same | [VGA] Cooldown Seconds; [P1300] initiators 60 -> 50 | match |
| Skye Guiding Light: wiki ability page says 60 s ([P1205] added 60 s) | 50 | [P1300] (later) cut every initiator signature to 50; [VGA] skye "Cooldown Seconds 50" | match (wiki ability page stale) |
| Cypher Spycam recalled 15 s | yes | [VGA] cypher 15 | match |
| Phoenix Blaze length | straight 12 m (stops at walls) | [AB] Blaze "1-21 m" (marked estimate); valorant.gs: 0.67 s x 20 m/s ~ 13.4 m; passes through terrain since 9.10 | differs - sources disagree, no change (tests pin 12) |
| Jett passive Drift (hold jump to glide) | present | [AB] Drift | match (not re-measured) |

## Deathmatch / Team Deathmatch

| Value | Ours | Source | Status |
|---|---|---|---|
| DM: 40 kills or 9 min (540 s) | offline 540; **server 570** | [DM], [VG] DeathmatchGameMode Round 540s | **fixed**: server `matchSeconds('dm')` 540 (room + start), worker `len` per mode |
| DM respawn 1.5 s, heavy armour, random spawn | 1.5 s | [DM] (v4.03), [VG] | match |
| DM health pack on a kill: 8 s, +50 HP / +25 armour | none | [VG] Health Pack | missing |
| TDM: 100 kills or 9.5 min (570 s) | 570 / 100 | [TDM], [TDM101] | match |
| TDM respawn 1.5 s; 15 s spawn-room protection | 1.5 s | [TDM101] | match (protection not re-measured) |
| TDM stages 75 / 75 / 75 / 345 s (4 loadout stages) | 3 tiers: unlocks at 120 s and 300 s | [TDM], [VG] (stage 4 = 347.7 s in files) | differs - structural (client tiers + test_tdm_transitions); not changed here |
| TDM ult: kills 3 points, ult orbs 10 points | not audited | [TDM] | open |

## Movement / spike carrier

| Value | Ours | Source | Status |
|---|---|---|---|
| Knife 6.75, rifles 5.40, pistols/SMG 5.73, heavies 5.13 m/s; ADS x0.76; walk x0.6; crouch-walk 2.5 | same | [PACE] | match |
| Accel 0.288 s, release stop ~84 ms, jump 6.902 m/s / 20.45 m/s^2 (1.165 m, 0.675 s), air speed <= melee | same | [PACE] | match |
| Spike: carried like a weapon, drops on death, attackers only pick up | yes | [SP], [VG] | match |

## Clip lengths vs timers

| Item | Ours | Status |
|---|---|---|
| Plant / defuse | progress bars driven by the 4 s / 7 s timers; no third-person plant/defuse clip exists to compare | n/a |
| Ability cast / equip clips | owned by qa-35 (per-ability unequip / re-equip, `windups.js`) | not duplicated |
