# Weapon values audit (qa-35)

Sources fetched 2026-10-26: valorant-api.com/v1/weapons (game build **release-13.08**, 13.08.00.5715960, built 2026-10-15), wiki.playvalorant.com (Riot's official wiki, en-us weapon pages), valorant.fandom.com weapon pages. Liquipedia was rate-limited for scripted access (not used beyond search excerpts). Raw copies: /workspace/work/qa/qa35/ (weapons.json, pv/*.txt, fandom/*.txt).

**Ours** = the server (server/src/weapons.json = models/valorant/weapon-calibration.js, simulation.js RESERVE / KNIFE_*, spike.js prices, windups.js REEQUIP) and the production page (work/feel_runtime.js copies every profile value from the same calibration file onto WEAP / VRUN / FSA / XZ; damage via wRaw from damageRanges; spread from the shared motor vendor/valorant-feel.js SPREAD = server/src/motor.cjs). The page's base WEAP table in index.html is stale (Operator 0.75/s, Marshal 0.8/s, Bulldog 9.15/s, Shorty 3.33/s, Judge mag 7, Frenzy mag 13) but is overwritten in production; the offline page harness (work/audit.js) strips the VALORANT FEEL block, so harness tests still see it (open item).

Damage is floored as in Valorant (wiki Weapons: decimals round down); note the pv infobox lists Guardian legs 49 while the raw value is 48.75 (floor 48, Liquipedia/community 48).

Summary: 267 ok, 5 fixed in qa-35, 3 open, 6 notes, 0 unresolved mismatches.

| weapon | value | ours | source value | URL | status |
|---|---|---|---|---|---|
| Classic | cost | 0 | 0 | https://valorant-api.com/v1/weapons | ok |
| Classic | magazine | 12 | 12 | https://valorant-api.com/v1/weapons | ok |
| Classic | reserve | 36 | 36 (3 magazines) | https://wiki.playvalorant.com/en-us/Classic | ok |
| Classic | fire rate (hip, /s) | 6.75 | 6.75 | https://valorant-api.com/v1/weapons | ok |
| Classic | reload (s) | 1.75 | 1.75 sec | https://wiki.playvalorant.com/en-us/Classic | ok |
| Classic | equip normal / fast / instant (s) | 0.75 / 0.45 / 0.15 | 0.75 sec (Normal) 0.45 sec (Fast) 0.15 sec (Instant) | https://valorant-api.com/v1/weapons + https://wiki.playvalorant.com/en-us/Classic | ok |
| Classic | run speed (m/s) | 5.737 | 0.85 x 6.75 = 5.737 (pv 5.73 m/sec) | https://valorant-api.com/v1/weapons | ok |
| Classic | first-shot spread hip (deg) | 0.4 | 0.4 | https://valorant-api.com/v1/weapons | ok |
| Classic | spread row hip [1st st/cr, max st/cr, crouch-walk/walk/run/air] | [0.4, 0.3, 1.8, 1.35, 0.5, 1.1, 2.3, 7] | ['0.4', '0.3', '1.8', '1.35', '0.5', '1.1', '2.3', '7'] | https://wiki.playvalorant.com/en-us/Classic | ok |
| Classic | ALT FIRE spread [1st st/cr, max st/cr, cw/walk/run/air] | was primary cone + 0.045 rad; now feel_runtime XCLA 1.9/1.71 -> 5.78/5.21, +0/0.6/1.5/2.25 | ['1.9', '1.71', '5.78', '5.21', '0', '0.6', '1.5', '2.25'] | https://wiki.playvalorant.com/en-us/Classic | fixed (page; qa-35) |
| Classic | ALT FIRE mode | was 3 single shots 60 ms apart (0.45 s cycle); now 3 bullets at once, 2.22 bursts/s | 3-bullet shotgun blast, 2.22 bursts/s (altShotgunStats pellets 3, burstRate 2.22) | https://valorant-api.com/v1/weapons + https://wiki.playvalorant.com/en-us/Classic | fixed (page; online Classic alt still sends one pulse - open) |
| Classic | wall penetration | Low | Low | https://valorant-api.com/v1/weapons | ok |
| Classic | damage head/body/legs 0-30 m (floored) | 78 / 26 / 22 | 78 / 26 / 22 (raw 78/26/22.1) | https://valorant-api.com/v1/weapons | ok |
| Classic | damage head/body/legs 30-50 m (floored) | 66 / 22 / 18 | 66 / 22 / 18 (raw 66/22/18.7) | https://valorant-api.com/v1/weapons | ok |
| Shorty | cost | 300 | 300 | https://valorant-api.com/v1/weapons | ok |
| Shorty | magazine | 2 | 2 | https://valorant-api.com/v1/weapons | ok |
| Shorty | reserve | 6 | 6 (3 magazines) | https://wiki.playvalorant.com/en-us/Shorty | ok |
| Shorty | fire rate (hip, /s) | 3 | 3 | https://valorant-api.com/v1/weapons | ok |
| Shorty | reload (s) | 1.75 | 1.75 | https://wiki.playvalorant.com/en-us/Shorty | ok |
| Shorty | equip normal / fast / instant (s) | 0.75 / 0.45 / 0.15 | 0.75 sec (Normal) 0.45 sec (Fast) 0.15 sec (Instant) | https://valorant-api.com/v1/weapons + https://wiki.playvalorant.com/en-us/Shorty | ok |
| Shorty | run speed (m/s) | 5.4 | 0.8 x 6.75 = 5.4 (pv 5.4 m/sec) | https://valorant-api.com/v1/weapons | ok |
| Shorty | first-shot spread hip (deg) | 4 | 4 | https://valorant-api.com/v1/weapons | ok |
| Shorty | spread row hip [1st st/cr, max st/cr, crouch-walk/walk/run/air] | [4, 3.4, 4, 3.4, 0.5, 1, 2, 4] | ['4', '3.4', '4', '3.4', '0.5', '1', '2', '4'] | https://wiki.playvalorant.com/en-us/Shorty | ok |
| Shorty | pellets | 15 | 15 | https://valorant-api.com/v1/weapons | ok |
| Shorty | wall penetration | Low | Low | https://valorant-api.com/v1/weapons | ok |
| Shorty | damage head/body/legs 0-7 m (floored) | 22 / 11 / 9 | 22 / 11 / 9 (raw 22/11/9.35) | https://valorant-api.com/v1/weapons | ok |
| Shorty | damage head/body/legs 7-15 m (floored) | 12 / 6 / 5 | 12 / 6 / 5 (raw 12/6/5.1) | https://valorant-api.com/v1/weapons | ok |
| Shorty | damage head/body/legs 15-50 m (floored) | 6 / 3 / 2 | 6 / 3 / 2 (raw 6/3/2.5500002) | https://valorant-api.com/v1/weapons | ok |
| Frenzy | cost | 450 | 450 | https://valorant-api.com/v1/weapons | ok |
| Frenzy | magazine | 15 | 15 | https://valorant-api.com/v1/weapons | ok |
| Frenzy | reserve | 45 | 45 (3 magazines) | https://wiki.playvalorant.com/en-us/Frenzy | ok |
| Frenzy | fire rate (hip, /s) | 10 | 10 | https://valorant-api.com/v1/weapons | ok |
| Frenzy | reload (s) | 1.5 | 1.5 sec | https://wiki.playvalorant.com/en-us/Frenzy | ok |
| Frenzy | equip normal / fast / instant (s) | 1 / 0.45 / 0.15 | 1 sec (Normal) 0.45 sec (Fast) 0.15 sec (Instant) | https://valorant-api.com/v1/weapons + https://wiki.playvalorant.com/en-us/Frenzy | ok |
| Frenzy | run speed (m/s) | 5.737 | 0.85 x 6.75 = 5.737 (pv 5.73 m/sec) | https://valorant-api.com/v1/weapons | ok |
| Frenzy | first-shot spread hip (deg) | 0.65 | 0.65 | https://valorant-api.com/v1/weapons | ok |
| Frenzy | spread row hip [1st st/cr, max st/cr, crouch-walk/walk/run/air] | [0.65, 0.55, 1.7, 1.45, 0.5, 0.8, 2, 7] | ['0.65', '0.55', '1.7', '1.45', '0.5', '0.8', '2', '7'] | https://wiki.playvalorant.com/en-us/Frenzy | ok |
| Frenzy | wall penetration | Low | Low | https://valorant-api.com/v1/weapons | ok |
| Frenzy | damage head/body/legs 0-20 m (floored) | 78 / 26 / 22 | 78 / 26 / 22 (raw 78/26/22.1) | https://valorant-api.com/v1/weapons | ok |
| Frenzy | damage head/body/legs 20-50 m (floored) | 63 / 21 / 17 | 63 / 21 / 17 (raw 63/21/17.85) | https://valorant-api.com/v1/weapons | ok |
| Ghost | cost | 500 | 500 | https://valorant-api.com/v1/weapons | ok |
| Ghost | magazine | 13 | 13 | https://valorant-api.com/v1/weapons | ok |
| Ghost | reserve | 39 | 39 (3 magazines) | https://wiki.playvalorant.com/en-us/Ghost | ok |
| Ghost | fire rate (hip, /s) | 6.75 | 6.75 | https://valorant-api.com/v1/weapons | ok |
| Ghost | reload (s) | 1.5 | 1.5 sec | https://wiki.playvalorant.com/en-us/Ghost | ok |
| Ghost | equip normal / fast / instant (s) | 0.75 / 0.45 / 0.15 | 0.75 sec (Normal) 0.45 sec (Fast) 0.15 sec (Instant) | https://valorant-api.com/v1/weapons + https://wiki.playvalorant.com/en-us/Ghost | ok |
| Ghost | run speed (m/s) | 5.737 | 0.85 x 6.75 = 5.737 (pv 5.73 m/sec) | https://valorant-api.com/v1/weapons | ok |
| Ghost | first-shot spread hip (deg) | 0.3 | 0.3 | https://valorant-api.com/v1/weapons | ok |
| Ghost | spread row hip [1st st/cr, max st/cr, crouch-walk/walk/run/air] | [0.3, 0.23, 1.65, 1.24, 0.5, 1.1, 2.3, 7] | ['0.3', '0.23', '1.65', '1.24', '0.5', '1.1', '2.3', '7'] | https://wiki.playvalorant.com/en-us/Ghost | ok |
| Ghost | wall penetration | Medium | Medium | https://valorant-api.com/v1/weapons | ok |
| Ghost | damage head/body/legs 0-30 m (floored) | 105 / 30 / 25 | 105 / 30 / 25 (raw 105/30/25.5) | https://valorant-api.com/v1/weapons | ok |
| Ghost | damage head/body/legs 30-50 m (floored) | 87 / 25 / 21 | 87 / 25 / 21 (raw 87.5/25/21.25) | https://valorant-api.com/v1/weapons | ok |
| Sheriff | cost | 800 | 800 | https://valorant-api.com/v1/weapons | ok |
| Sheriff | magazine | 6 | 6 | https://valorant-api.com/v1/weapons | ok |
| Sheriff | reserve | 24 | 24 (4 magazines) | https://wiki.playvalorant.com/en-us/Sheriff | ok |
| Sheriff | fire rate (hip, /s) | 4 | 4 | https://valorant-api.com/v1/weapons | ok |
| Sheriff | reload (s) | 2.25 | 2.25 sec | https://wiki.playvalorant.com/en-us/Sheriff | ok |
| Sheriff | equip normal / fast / instant (s) | 1 / 0.6 / 0.2 | 1 sec (Normal) 0.6 sec (Fast) 0.2 sec (Instant) | https://valorant-api.com/v1/weapons + https://wiki.playvalorant.com/en-us/Sheriff | ok |
| Sheriff | run speed (m/s) | 5.4 | 0.8 x 6.75 = 5.4 (pv 5.4 m/sec) | https://valorant-api.com/v1/weapons | ok |
| Sheriff | first-shot spread hip (deg) | 0.25 | 0.25 | https://valorant-api.com/v1/weapons | ok |
| Sheriff | spread row hip [1st st/cr, max st/cr, crouch-walk/walk/run/air] | [0.25, 0.19, 2.75, 2.06, 0.5, 1.2, 3, 7] | ['0.25', '0.19', '2.75', '2.06', '0.5', '1.2', '3', '7'] | https://wiki.playvalorant.com/en-us/Sheriff | ok |
| Sheriff | wall penetration | High | High | https://valorant-api.com/v1/weapons | ok |
| Sheriff | damage head/body/legs 0-30 m (floored) | 159 / 55 / 46 | 159 / 55 / 46 (raw 159.5/55/46.75) | https://valorant-api.com/v1/weapons | ok |
| Sheriff | damage head/body/legs 30-50 m (floored) | 145 / 50 / 42 | 145 / 50 / 42 (raw 145/50/42.5) | https://valorant-api.com/v1/weapons | ok |
| Stinger | cost | 1100 | 1100 | https://valorant-api.com/v1/weapons | ok |
| Stinger | magazine | 20 | 20 | https://valorant-api.com/v1/weapons | ok |
| Stinger | reserve | 60 | 60 (3 magazines) | https://wiki.playvalorant.com/en-us/Stinger | ok |
| Stinger | fire rate (hip, /s) | 16 | 16 | https://valorant-api.com/v1/weapons | ok |
| Stinger | ADS fire rate (/s) | 8.470589 | 8.470589 | https://valorant-api.com/v1/weapons | ok |
| Stinger | ADS zoom | 1.15 | 1.15 | https://valorant-api.com/v1/weapons | ok |
| Stinger | ADS move multiplier | 0.76 | 0.76 | https://valorant-api.com/v1/weapons | ok |
| Stinger | ADS first-shot spread (deg) | 0.35 | 0.35 | https://valorant-api.com/v1/weapons + https://wiki.playvalorant.com/en-us/Stinger | ok |
| Stinger | ADS burst | none: full-auto at the 8.471/s average | 4-round burst, rounds at 18/s, 2.118 bursts/s | https://wiki.playvalorant.com/en-us/Stinger | open (burst cadence not modelled, server + page) |
| Stinger | reload (s) | 2.25 | 2.25 sec | https://wiki.playvalorant.com/en-us/Stinger | ok |
| Stinger | equip normal / fast / instant (s) | 0.75 / 0.45 / 0.15 | 0.75 sec (Normal) 0.45 sec (Fast) 0.15 sec (Instant) | https://valorant-api.com/v1/weapons + https://wiki.playvalorant.com/en-us/Stinger | ok |
| Stinger | run speed (m/s) | 5.737 | 0.85 x 6.75 = 5.737 (pv 5.73 m/sec) | https://valorant-api.com/v1/weapons | ok |
| Stinger | first-shot spread hip (deg) | 0.65 | 0.65 | https://valorant-api.com/v1/weapons | ok |
| Stinger | spread row hip [1st st/cr, max st/cr, crouch-walk/walk/run/air] | [0.65, 0.55, 1.5, 1.28, 0.15, 1, 2.5, 10] | ['0.65', '0.55', '1.5', '1.28', '0.15', '1', '2.5', '10'] | https://wiki.playvalorant.com/en-us/Stinger | ok |
| Stinger | wall penetration | Low | Low | https://valorant-api.com/v1/weapons | ok |
| Stinger | damage head/body/legs 0-15 m (floored) | 67 / 27 / 22 | 67 / 27 / 22 (raw 67.5/27/22.95) | https://valorant-api.com/v1/weapons | ok |
| Stinger | damage head/body/legs 15-50 m (floored) | 57 / 23 / 19 | 57 / 23 / 19 (raw 57/23/19) | https://valorant-api.com/v1/weapons | ok |
| Spectre | cost | 1600 | 1600 | https://valorant-api.com/v1/weapons | ok |
| Spectre | magazine | 30 | 30 | https://valorant-api.com/v1/weapons | ok |
| Spectre | reserve | 90 | 90 (3 magazines) | https://wiki.playvalorant.com/en-us/Spectre | ok |
| Spectre | fire rate (hip, /s) | 13.333 | 13.333 | https://valorant-api.com/v1/weapons | ok |
| Spectre | ADS fire rate (/s) | 11.9997 | 11.9997 | https://valorant-api.com/v1/weapons | ok |
| Spectre | ADS zoom | 1.15 | 1.15 | https://valorant-api.com/v1/weapons | ok |
| Spectre | ADS move multiplier | 0.76 | 0.76 | https://valorant-api.com/v1/weapons | ok |
| Spectre | ADS first-shot spread (deg) | 0.25 | 0.25 | https://valorant-api.com/v1/weapons + https://wiki.playvalorant.com/en-us/Spectre | ok |
| Spectre | reload (s) | 2.25 | 2.25 sec | https://wiki.playvalorant.com/en-us/Spectre | ok |
| Spectre | equip normal / fast / instant (s) | 0.75 / 0.45 / 0.15 | 0.75 sec (Normal) 0.45 sec (Fast) 0.15 sec (Instant) | https://valorant-api.com/v1/weapons + https://wiki.playvalorant.com/en-us/Spectre | ok |
| Spectre | run speed (m/s) | 5.737 | 0.85 x 6.75 = 5.737 (pv 5.73 m/sec) | https://valorant-api.com/v1/weapons | ok |
| Spectre | first-shot spread hip (deg) | 0.4 | 0.4 | https://valorant-api.com/v1/weapons | ok |
| Spectre | spread row hip [1st st/cr, max st/cr, crouch-walk/walk/run/air] | [0.4, 0.34, 1.4, 1.19, 0.15, 1, 2.5, 10] | ['0.4', '0.34', '1.4', '1.19', '0.15', '1', '2.5', '10'] | https://wiki.playvalorant.com/en-us/Spectre | ok |
| Spectre | wall penetration | Low | Low | https://valorant-api.com/v1/weapons | ok |
| Spectre | damage head/body/legs 0-15 m (floored) | 78 / 26 / 22 | 78 / 26 / 22 (raw 78/26/22.1) | https://valorant-api.com/v1/weapons | ok |
| Spectre | damage head/body/legs 15-30 m (floored) | 66 / 22 / 18 | 66 / 22 / 18 (raw 66/22/18.7) | https://valorant-api.com/v1/weapons | ok |
| Spectre | damage head/body/legs 30-50 m (floored) | 60 / 20 / 17 | 60 / 20 / 17 (raw 60/20/17) | https://valorant-api.com/v1/weapons | ok |
| Bucky | cost | 850 | 850 | https://valorant-api.com/v1/weapons | ok |
| Bucky | magazine | 5 | 5 | https://valorant-api.com/v1/weapons | ok |
| Bucky | reserve | 10 | 10 (2 magazines) | https://wiki.playvalorant.com/en-us/Bucky | ok |
| Bucky | fire rate (hip, /s) | 1.1 | 1.1 | https://valorant-api.com/v1/weapons | ok |
| Bucky | reload (s) | 0.5 per shell (2.5 full) | 2.5 sec (0.5 per shell) | https://wiki.playvalorant.com/en-us/Bucky | ok |
| Bucky | equip normal / fast / instant (s) | 1 / 0.6 / 0.2 | 1 sec (Normal) 0.6 sec (Fast) 0.2 sec (Instant) | https://valorant-api.com/v1/weapons + https://wiki.playvalorant.com/en-us/Bucky | ok |
| Bucky | run speed (m/s) | 5.062 | 0.75 x 6.75 = 5.062 (pv 5.06 m/sec) | https://valorant-api.com/v1/weapons | ok |
| Bucky | first-shot spread hip (deg) | 3 | 3 | https://valorant-api.com/v1/weapons | ok |
| Bucky | spread row hip [1st st/cr, max st/cr, crouch-walk/walk/run/air] | [3, 2.55, 3, 2.55, 0.5, 1, 2, 4] | ['3.0', '2.55', '3.0', '2.55', '0.5', '1', '2', '4'] | https://wiki.playvalorant.com/en-us/Bucky | ok |
| Bucky | ALT FIRE air burst | 5 pellets, cone x0.28 from the muzzle; damage was 22/44/19 to 15 m then 14/28/12 -> now the primary 17/34/14, 13/26/11 past 8 m, 9/18/7 past 12 m | canister detonates at 7.5 m into 5 pellets, same damage table; a direct canister hit before 7.5 m 40/20/15 | https://valorant-api.com/v1/weapons + https://wiki.playvalorant.com/en-us/Bucky | fixed (damage, page offline only); geometry approx + canister direct hit + server alt fire open |
| Bucky | pellets | 15 | 15 | https://valorant-api.com/v1/weapons | ok |
| Bucky | wall penetration | Low | Low | https://valorant-api.com/v1/weapons | ok |
| Bucky | damage head/body/legs 0-8 m (floored) | 34 / 17 / 14 | 34 / 17 / 14 (raw 34/17/14) | https://valorant-api.com/v1/weapons | ok |
| Bucky | damage head/body/legs 8-12 m (floored) | 26 / 13 / 11 | 26 / 13 / 11 (raw 26/13/11.05) | https://valorant-api.com/v1/weapons | ok |
| Bucky | damage head/body/legs 12-50 m (floored) | 18 / 9 / 7 | 18 / 9 / 7 (raw 18/9/7.65) | https://valorant-api.com/v1/weapons | ok |
| Judge | cost | 1850 | 1850 | https://valorant-api.com/v1/weapons | ok |
| Judge | magazine | 5 | 5 | https://valorant-api.com/v1/weapons | ok |
| Judge | reserve | 15 | 15 (3 magazines) | https://wiki.playvalorant.com/en-us/Judge | ok |
| Judge | fire rate (hip, /s) | 3.5 | 3.5 | https://valorant-api.com/v1/weapons | ok |
| Judge | reload (s) | 2.2 | 2.2 sec | https://wiki.playvalorant.com/en-us/Judge | ok |
| Judge | equip normal / fast / instant (s) | 1 / 0.6 / 0.2 | 1 sec (Normal) 0.6 sec (Fast) 0.2 sec (Instant) | https://valorant-api.com/v1/weapons + https://wiki.playvalorant.com/en-us/Judge | ok |
| Judge | run speed (m/s) | 5.062 | 0.75 x 6.75 = 5.062 (pv 5.06 m/sec) | https://valorant-api.com/v1/weapons | ok |
| Judge | first-shot spread hip (deg) | 2.5 | 2.5 | https://valorant-api.com/v1/weapons | ok |
| Judge | spread row hip [1st st/cr, max st/cr, crouch-walk/walk/run/air] | [2.5, 2.12, 4, 3.4, 0.5, 1, 2, 4] | ['2.5', '2.12', '4', '3.4', '0.5', '1', '2', '4'] | https://wiki.playvalorant.com/en-us/Judge | ok |
| Judge | pellets | 12 | 12 | https://valorant-api.com/v1/weapons | ok |
| Judge | wall penetration | Low | Low | https://valorant-api.com/v1/weapons | ok |
| Judge | damage head/body/legs 0-10 m (floored) | 34 / 17 / 14 | 34 / 17 / 14 (raw 34/17/14.450001) | https://valorant-api.com/v1/weapons | ok |
| Judge | damage head/body/legs 10-15 m (floored) | 20 / 10 / 8 | 20 / 10 / 8 (raw 20/10/8.5) | https://valorant-api.com/v1/weapons | ok |
| Judge | damage head/body/legs 15-50 m (floored) | 14 / 7 / 5 | 14 / 7 / 5 (raw 14/7/5.9500003) | https://valorant-api.com/v1/weapons | ok |
| Bulldog | cost | 2050 | 2050 | https://valorant-api.com/v1/weapons | ok |
| Bulldog | magazine | 24 | 24 | https://valorant-api.com/v1/weapons | ok |
| Bulldog | reserve | 72 | 72 (3 magazines) | https://wiki.playvalorant.com/en-us/Bulldog | ok |
| Bulldog | fire rate (hip, /s) | 10 | 10 | https://valorant-api.com/v1/weapons | ok |
| Bulldog | ADS fire rate (/s) | 6.315715 | 6.315715 | https://valorant-api.com/v1/weapons | ok |
| Bulldog | ADS zoom | 1.25 | 1.25 | https://valorant-api.com/v1/weapons | ok |
| Bulldog | ADS move multiplier | 0.76 | 0.76 | https://valorant-api.com/v1/weapons | ok |
| Bulldog | ADS first-shot spread (deg) | 0.1 | API adsStats 0.3; wiki Alt Fire row 0.1 (fandom same) | https://valorant-api.com/v1/weapons + https://wiki.playvalorant.com/en-us/Bulldog | note (sources disagree; ours = wiki 0.1) |
| Bulldog | ADS burst | none: full-auto at the 6.316/s average | 3-round burst, rounds at 13.333/s, 2.105 bursts/s | https://wiki.playvalorant.com/en-us/Bulldog | open (burst cadence not modelled, server + page) |
| Bulldog | reload (s) | 2.5 | 2.5 sec | https://wiki.playvalorant.com/en-us/Bulldog | ok |
| Bulldog | equip normal / fast / instant (s) | 1 / 0.6 / 0.2 | 1 sec (Normal) 0.6 sec (Fast) 0.2 sec (Instant) | https://valorant-api.com/v1/weapons + https://wiki.playvalorant.com/en-us/Bulldog | ok |
| Bulldog | run speed (m/s) | 5.4 | 0.8 x 6.75 = 5.4 (pv 5.4 m/sec) | https://valorant-api.com/v1/weapons | ok |
| Bulldog | first-shot spread hip (deg) | 0.3 | 0.3 | https://valorant-api.com/v1/weapons | ok |
| Bulldog | spread row hip [1st st/cr, max st/cr, crouch-walk/walk/run/air] | [0.3, 0.26, 1.25, 1.06, 0.8, 3, 6, 10] | ['0.3', '0.26', '1.25', '1.06', '0.8', '3', '6', '10'] | https://wiki.playvalorant.com/en-us/Bulldog | ok |
| Bulldog | wall penetration | Medium | Medium | https://valorant-api.com/v1/weapons | ok |
| Bulldog | damage head/body/legs 0-50 m (floored) | 115 / 35 / 29 | 115 / 35 / 29 (raw 115.5/35/29.75) | https://valorant-api.com/v1/weapons | ok |
| Guardian | cost | 2250 | 2250 | https://valorant-api.com/v1/weapons | ok |
| Guardian | magazine | 12 | 12 | https://valorant-api.com/v1/weapons | ok |
| Guardian | reserve | 36 | 36 (3 magazines) | https://wiki.playvalorant.com/en-us/Guardian | ok |
| Guardian | fire rate (hip, /s) | 5.25 | 5.25 | https://valorant-api.com/v1/weapons | ok |
| Guardian | ADS fire rate (/s) | 5.25 | 5.25 | https://valorant-api.com/v1/weapons | ok |
| Guardian | ADS zoom | 1.5 | 1.5 | https://valorant-api.com/v1/weapons | ok |
| Guardian | ADS move multiplier | 0.76 | 0.76 | https://valorant-api.com/v1/weapons | ok |
| Guardian | ADS first-shot spread (deg) | 0 | 0 | https://valorant-api.com/v1/weapons + https://wiki.playvalorant.com/en-us/Guardian | ok |
| Guardian | reload (s) | 2.5 | 2.5 sec | https://wiki.playvalorant.com/en-us/Guardian | ok |
| Guardian | equip normal / fast / instant (s) | 1 / 0.6 / 0.2 | 1 sec (Normal) 0.6 sec (Fast) 0.2 sec (Instant) | https://valorant-api.com/v1/weapons + https://wiki.playvalorant.com/en-us/Guardian | ok |
| Guardian | run speed (m/s) | 5.4 | 0.8 x 6.75 = 5.4 (pv 5.4 m/sec) | https://valorant-api.com/v1/weapons | ok |
| Guardian | first-shot spread hip (deg) | 0.1 | 0.1 | https://valorant-api.com/v1/weapons | ok |
| Guardian | spread row hip [1st st/cr, max st/cr, crouch-walk/walk/run/air] | [0.1, 0.09, 1.58, 1.34, 0.8, 3, 6, 10] | ['0.1', '0.09', '1.58', '1.34', '0.8', '3', '6', '10'] | https://wiki.playvalorant.com/en-us/Guardian | ok |
| Guardian | wall penetration | High | High | https://valorant-api.com/v1/weapons | ok |
| Guardian | damage head/body/legs 0-50 m (floored) | 195 / 65 / 48 | 195 / 65 / 48 (raw 195/65/48.75) | https://valorant-api.com/v1/weapons | ok |
| Phantom | cost | 2900 | 2900 | https://valorant-api.com/v1/weapons | ok |
| Phantom | magazine | 30 | 30 | https://valorant-api.com/v1/weapons | ok |
| Phantom | reserve | 60 | 60 (2 magazines) | https://wiki.playvalorant.com/en-us/Phantom | ok |
| Phantom | fire rate (hip, /s) | 11 | 11 | https://valorant-api.com/v1/weapons | ok |
| Phantom | ADS fire rate (/s) | 9.9 | 9.9 | https://valorant-api.com/v1/weapons | ok |
| Phantom | ADS zoom | 1.25 | 1.25 | https://valorant-api.com/v1/weapons | ok |
| Phantom | ADS move multiplier | 0.76 | 0.76 | https://valorant-api.com/v1/weapons | ok |
| Phantom | ADS first-shot spread (deg) | 0.11 | 0.11000001 | https://valorant-api.com/v1/weapons + https://wiki.playvalorant.com/en-us/Phantom | ok |
| Phantom | reload (s) | 2.5 | 2.5 sec | https://wiki.playvalorant.com/en-us/Phantom | ok |
| Phantom | equip normal / fast / instant (s) | 1 / 0.6 / 0.2 | 1 sec (Normal) 0.6 sec (Fast) 0.2 sec (Instant) | https://valorant-api.com/v1/weapons + https://wiki.playvalorant.com/en-us/Phantom | ok |
| Phantom | run speed (m/s) | 5.4 | 0.8 x 6.75 = 5.4 (pv 5.4 m/sec) | https://valorant-api.com/v1/weapons | ok |
| Phantom | first-shot spread hip (deg) | 0.2 | 0.2 | https://valorant-api.com/v1/weapons | ok |
| Phantom | spread row hip [1st st/cr, max st/cr, crouch-walk/walk/run/air] | [0.2, 0.17, 0.9, 0.76, 0.8, 3, 6, 10] | ['0.2', '0.17', '0.9', '0.76', '0.8', '3', '6', '10'] | https://wiki.playvalorant.com/en-us/Phantom | ok |
| Phantom | wall penetration | Medium | Medium | https://valorant-api.com/v1/weapons | ok |
| Phantom | damage head/body/legs 0-20 m (floored) | 156 / 39 / 33 | 156 / 39 / 33 (raw 156/39/33.15) | https://valorant-api.com/v1/weapons | ok |
| Phantom | damage head/body/legs 20-50 m (floored) | 140 / 35 / 29 | 140 / 35 / 29 (raw 140/35/29.75) | https://valorant-api.com/v1/weapons | ok |
| Vandal | cost | 2900 | 2900 | https://valorant-api.com/v1/weapons | ok |
| Vandal | magazine | 25 | 25 | https://valorant-api.com/v1/weapons | ok |
| Vandal | reserve | 50 | 50 (2 magazines) | https://wiki.playvalorant.com/en-us/Vandal | ok |
| Vandal | fire rate (hip, /s) | 9.75 | 9.75 | https://valorant-api.com/v1/weapons | ok |
| Vandal | ADS fire rate (/s) | 8.775 | 8.775 | https://valorant-api.com/v1/weapons | ok |
| Vandal | ADS zoom | 1.25 | 1.25 | https://valorant-api.com/v1/weapons | ok |
| Vandal | ADS move multiplier | 0.76 | 0.76 | https://valorant-api.com/v1/weapons | ok |
| Vandal | ADS first-shot spread (deg) | 0.157 | 0.1575 | https://valorant-api.com/v1/weapons + https://wiki.playvalorant.com/en-us/Vandal | ok |
| Vandal | reload (s) | 2.5 | 2.5 sec | https://wiki.playvalorant.com/en-us/Vandal | ok |
| Vandal | equip normal / fast / instant (s) | 1 / 0.6 / 0.2 | 1 sec (Normal) 0.6 sec (Fast) 0.2 sec (Instant) | https://valorant-api.com/v1/weapons + https://wiki.playvalorant.com/en-us/Vandal | ok |
| Vandal | run speed (m/s) | 5.4 | 0.8 x 6.75 = 5.4 (pv 5.4 m/sec) | https://valorant-api.com/v1/weapons | ok |
| Vandal | first-shot spread hip (deg) | 0.25 | 0.25 | https://valorant-api.com/v1/weapons | ok |
| Vandal | spread row hip [1st st/cr, max st/cr, crouch-walk/walk/run/air] | [0.25, 0.21, 1, 0.85, 0.8, 3, 6, 10] | ['0.25', '0.21', '1', '0.85', '0.8', '3', '6', '10'] | https://wiki.playvalorant.com/en-us/Vandal | ok |
| Vandal | wall penetration | Medium | Medium | https://valorant-api.com/v1/weapons | ok |
| Vandal | damage head/body/legs 0-50 m (floored) | 160 / 40 / 34 | 160 / 40 / 34 (raw 160/40/34) | https://valorant-api.com/v1/weapons | ok |
| Marshal | cost | 950 | 950 | https://valorant-api.com/v1/weapons | ok |
| Marshal | magazine | 5 | 5 | https://valorant-api.com/v1/weapons | ok |
| Marshal | reserve | 15 | 15 (3 magazines) | https://wiki.playvalorant.com/en-us/Marshal | ok |
| Marshal | fire rate (hip, /s) | 1.5 | 1.5 | https://valorant-api.com/v1/weapons | ok |
| Marshal | ADS fire rate (/s) | 1.2 | 1.2 | https://valorant-api.com/v1/weapons | ok |
| Marshal | ADS zoom | 3.5x | 3.5 | https://valorant-api.com/v1/weapons | ok |
| Marshal | ADS move multiplier | 0.9 | 0.9 | https://valorant-api.com/v1/weapons | ok |
| Marshal | ADS first-shot spread (deg) | 0 | 0 | https://valorant-api.com/v1/weapons + https://wiki.playvalorant.com/en-us/Marshal | ok |
| Marshal | reload (s) | 0.5 per round (2.5 full) | 2.5 sec (0.5 per bullet) | https://wiki.playvalorant.com/en-us/Marshal | ok |
| Marshal | equip normal / fast / instant (s) | 1.25 / 0.6 / 0.2 | 1.25 sec (Normal) 0.6 sec (Fast) 0.2 sec (Instant) | https://valorant-api.com/v1/weapons + https://wiki.playvalorant.com/en-us/Marshal | ok |
| Marshal | run speed (m/s) | 5.4 | 0.8 x 6.75 = 5.4 (pv 5.4 m/sec) | https://valorant-api.com/v1/weapons | ok |
| Marshal | first-shot spread hip (deg) | 1 | 1 | https://valorant-api.com/v1/weapons | ok |
| Marshal | spread row hip [1st st/cr, max st/cr, crouch-walk/walk/run/air] | [1, 0.9, 1, 0.9, 7.5, 10, 15, 20] | ['1', '0.9', '1', '0.9', '7.5', '10', '15', '20'] | https://wiki.playvalorant.com/en-us/Marshal | ok |
| Marshal | wall penetration | Medium | Medium | https://valorant-api.com/v1/weapons | ok |
| Marshal | damage head/body/legs 0-50 m (floored) | 202 / 101 / 85 | 202 / 101 / 85 (raw 202/101/85.850006) | https://valorant-api.com/v1/weapons | ok |
| Outlaw | cost | 2400 | 2400 | https://valorant-api.com/v1/weapons | ok |
| Outlaw | magazine | 2 | 2 | https://valorant-api.com/v1/weapons | ok |
| Outlaw | reserve | 10 | 10 (5 magazines) | https://wiki.playvalorant.com/en-us/Outlaw | ok |
| Outlaw | fire rate (hip, /s) | 2.75 | 2.75 | https://valorant-api.com/v1/weapons | ok |
| Outlaw | ADS fire rate (/s) | 2.75 | 2.75 | https://valorant-api.com/v1/weapons | ok |
| Outlaw | ADS zoom | 3.5x | 3.5 | https://valorant-api.com/v1/weapons | ok |
| Outlaw | ADS move multiplier | 0.8 | 0.8 | https://valorant-api.com/v1/weapons | ok |
| Outlaw | ADS first-shot spread (deg) | 0 | 0 | https://valorant-api.com/v1/weapons + https://wiki.playvalorant.com/en-us/Outlaw | ok |
| Outlaw | reload (s) | 2.3 one / 3.8 both | 2.3 sec (1 bullet)<br>3.8 sec (2 bullets) | https://wiki.playvalorant.com/en-us/Outlaw | ok |
| Outlaw | equip normal / fast / instant (s) | 1.25 / 0.6 / 0.2 | 1.25 sec (Normal) 0.6 sec (Fast) 0.2 sec (Instant) | https://valorant-api.com/v1/weapons + https://wiki.playvalorant.com/en-us/Outlaw | ok |
| Outlaw | run speed (m/s) | 5.4 | 0.8 x 6.75 = 5.4 (pv 5.4 m/sec) | https://valorant-api.com/v1/weapons | ok |
| Outlaw | first-shot spread hip (deg) | 3.5 | 3.5 | https://valorant-api.com/v1/weapons | ok |
| Outlaw | spread row hip [1st st/cr, max st/cr, crouch-walk/walk/run/air] | [3.5, 3.15, 3.5, 3.15, 7.5, 10, 15, 20] | ['3.5', '3.15', '3.5', '3.15', '7.5', '10', '15', '20'] | https://wiki.playvalorant.com/en-us/Outlaw | ok |
| Outlaw | wall penetration | High | High | https://valorant-api.com/v1/weapons | ok |
| Outlaw | damage head/body/legs 0-50 m (floored) | 238 / 140 / 119 | 238 / 140 / 119 (raw 238/140/119) | https://valorant-api.com/v1/weapons | ok |
| Operator | cost | 4700 | 4700 | https://valorant-api.com/v1/weapons | ok |
| Operator | magazine | 5 | 5 | https://valorant-api.com/v1/weapons | ok |
| Operator | reserve | 10 | 10 (2 magazines) | https://wiki.playvalorant.com/en-us/Operator | ok |
| Operator | fire rate (hip, /s) | 0.6 | 0.6 | https://valorant-api.com/v1/weapons | ok |
| Operator | ADS fire rate (/s) | 0.6 | 0.6 | https://valorant-api.com/v1/weapons | ok |
| Operator | ADS zoom | 2.5x / 5x | 2.5 / 5 (pv zoom) | https://valorant-api.com/v1/weapons | ok |
| Operator | ADS move multiplier | 0.72 | 0.72 | https://valorant-api.com/v1/weapons | ok |
| Operator | ADS first-shot spread (deg) | 0 | 0 | https://valorant-api.com/v1/weapons + https://wiki.playvalorant.com/en-us/Operator | ok |
| Operator | reload (s) | 3.7 | 3.7 sec | https://wiki.playvalorant.com/en-us/Operator | ok |
| Operator | equip normal / fast / instant (s) | 1.5 / 0.9 / 0.5 | 1.5 sec (Normal) 0.9 sec (Fast) 0.5 sec (Instant) | https://valorant-api.com/v1/weapons + https://wiki.playvalorant.com/en-us/Operator | ok |
| Operator | run speed (m/s) | 5.13 | 0.76 x 6.75 = 5.13 (pv 5.13 m/sec) | https://valorant-api.com/v1/weapons | ok |
| Operator | first-shot spread hip (deg) | 5 | 5 | https://valorant-api.com/v1/weapons | ok |
| Operator | spread row hip [1st st/cr, max st/cr, crouch-walk/walk/run/air] | [5, 4.5, 5, 4.5, 7.5, 10, 15, 15] | ['5', '4.5', '5', '4.5', '7.5', '10', '15', '15'] | https://wiki.playvalorant.com/en-us/Operator | ok |
| Operator | wall penetration | High | High | https://valorant-api.com/v1/weapons | ok |
| Operator | damage head/body/legs 0-50 m (floored) | 255 / 150 / 120 | 255 / 150 / 120 (raw 255/150/120) | https://valorant-api.com/v1/weapons | ok |
| Ares | cost | 1600 | 1600 | https://valorant-api.com/v1/weapons | ok |
| Ares | magazine | 50 | 50 | https://valorant-api.com/v1/weapons | ok |
| Ares | reserve | 100 | 100 (2 magazines) | https://wiki.playvalorant.com/en-us/Ares | ok |
| Ares | fire rate (hip, /s) | 13 | 13 | https://valorant-api.com/v1/weapons | ok |
| Ares | ADS fire rate (/s) | 13 | 13 | https://valorant-api.com/v1/weapons | ok |
| Ares | ADS zoom | 1.15 | 1.15 | https://valorant-api.com/v1/weapons | ok |
| Ares | ADS move multiplier | 0.76 | 0.76 | https://valorant-api.com/v1/weapons | ok |
| Ares | ADS first-shot spread (deg) | 0.9 | 0.9 | https://valorant-api.com/v1/weapons + https://wiki.playvalorant.com/en-us/Ares | ok |
| Ares | reload (s) | 3.25 | 3.25 sec | https://wiki.playvalorant.com/en-us/Ares | ok |
| Ares | equip normal / fast / instant (s) | 1.25 / 0.75 / 0.25 | 1.25 sec (Normal) 0.75 sec (Fast) 0.25 sec (Instant) | https://valorant-api.com/v1/weapons + https://wiki.playvalorant.com/en-us/Ares | ok |
| Ares | run speed (m/s) | 5.13 | 0.76 x 6.75 = 5.13 (pv 5.13 m/sec) | https://valorant-api.com/v1/weapons | ok |
| Ares | first-shot spread hip (deg) | 1 | 1 | https://valorant-api.com/v1/weapons | ok |
| Ares | spread row hip [1st st/cr, max st/cr, crouch-walk/walk/run/air] | [1, 0.6, 0.7, 0.42, 0.4, 3, 6.5, 10] | ['1', '0.6', '0.7', '0.42', '0.4', '3', '6.5', '10'] | https://wiki.playvalorant.com/en-us/Ares | ok |
| Ares | wall penetration | High | High | https://valorant-api.com/v1/weapons | ok |
| Ares | damage head/body/legs 0-30 m (floored) | 75 / 30 / 25 | 75 / 30 / 25 (raw 75/30/25.5) | https://valorant-api.com/v1/weapons | ok |
| Ares | damage head/body/legs 30-50 m (floored) | 70 / 28 / 23 | 70 / 28 / 23 (raw 70/28/23.800001) | https://valorant-api.com/v1/weapons | ok |
| Odin | cost | 3200 | 3200 | https://valorant-api.com/v1/weapons | ok |
| Odin | magazine | 100 | 100 | https://valorant-api.com/v1/weapons | ok |
| Odin | reserve | 200 | 200 (2 magazines) | https://wiki.playvalorant.com/en-us/Odin | ok |
| Odin | fire rate (hip, /s) | 12 | 12 | https://valorant-api.com/v1/weapons | ok |
| Odin | hip fire-rate ramp | flat 12/s (no spin-up) | 12 -> 15.6/s 'rate of fire increases over time' (feature ROFIncrease); ramp time not published | https://wiki.playvalorant.com/en-us/Odin | open (ramp duration unpublished) |
| Odin | ADS fire rate (/s) | 15.6 | 15.6 | https://valorant-api.com/v1/weapons | ok |
| Odin | ADS zoom | 1.15 | 1.15 | https://valorant-api.com/v1/weapons | ok |
| Odin | ADS move multiplier | 0.76 | 0.76 | https://valorant-api.com/v1/weapons | ok |
| Odin | ADS first-shot spread (deg) | 0.79 | 0.79 | https://valorant-api.com/v1/weapons + https://wiki.playvalorant.com/en-us/Odin | ok |
| Odin | reload (s) | 5 | 5 sec | https://wiki.playvalorant.com/en-us/Odin | ok |
| Odin | equip normal / fast / instant (s) | 1.25 / 0.75 / 0.25 | 1.25 sec (Normal) 0.75 sec (Fast) 0.25 sec (Instant) | https://valorant-api.com/v1/weapons + https://wiki.playvalorant.com/en-us/Odin | ok |
| Odin | run speed (m/s) | 5.13 | 0.76 x 6.75 = 5.13 (pv 5.13 m/sec) | https://valorant-api.com/v1/weapons | ok |
| Odin | first-shot spread hip (deg) | 0.8 | 0.8 | https://valorant-api.com/v1/weapons | ok |
| Odin | spread row hip [1st st/cr, max st/cr, crouch-walk/walk/run/air] | [0.8, 0.48, 1.3, 0.78, 0.4, 3, 6.5, 10] | ['0.8', '0.48', '1.3', '0.78', '0.4', '3', '6.5', '10'] | https://wiki.playvalorant.com/en-us/Odin | ok |
| Odin | wall penetration | High | High | https://valorant-api.com/v1/weapons | ok |
| Odin | damage head/body/legs 0-30 m (floored) | 95 / 38 / 32 | 95 / 38 / 32 (raw 95/38/32.3) | https://valorant-api.com/v1/weapons | ok |
| Odin | damage head/body/legs 30-50 m (floored) | 77 / 31 / 26 | 77 / 31 / 26 (raw 77.5/31/26.35) | https://valorant-api.com/v1/weapons | ok |
| Melee | light swing front / back | was 50 / 50; now 50 / 100 | Front 50, Back 100 (primary) | https://wiki.playvalorant.com/en-us/Melee | fixed (server + page; qa-35) |
| Melee | heavy swing front / back | 75 / 150 | Front 75, Back 150 (alt) | https://wiki.playvalorant.com/en-us/Melee | ok |
| Melee | headshot bonus | was heavy head = 150; now none (front value) | none (front/back only; Liquipedia Tactical Knife lists the same) | https://wiki.playvalorant.com/en-us/Melee | fixed (server + page; qa-35) |
| Melee | equip normal / fast / instant (s) | 0.6 / 0.3 / 0 | 0.6 / 0.3 / 0 | https://wiki.playvalorant.com/en-us/Melee | ok |
| Melee | run speed (m/s) | 6.75 | 6.75 | https://wiki.playvalorant.com/en-us/Melee | ok |
| Melee | reach (m) | 2 | "2m max" | https://valorant.fandom.com/wiki/Melee | ok |
| Melee | light swing cadence | 2 swings/s (0.5 s) | not published (3-swing looping combo); thespike.gg 2020 measured ~50 ms animation | https://wiki.playvalorant.com/en-us/Melee | note (unsourced) |
| Melee | heavy swing cooldown | 1 s | not published ("longer recovery") | https://wiki.playvalorant.com/en-us/Melee | note (unsourced) |
| all | equip clip | vfDuration equip = xEq(w) (weapon equip time /stim) | equip time Normal | https://valorant-api.com/v1/weapons | ok |
| all | reload clip | clip progress = 1 - reloading x stim / reloadTimeSeconds (ends with the timer; Outlaw one barrel / Bucky / Marshal per round play the clip tail) | reloadTimeSeconds | https://valorant-api.com/v1/weapons | ok |
| all | fire clip | authored SequenceLength; bolt/pump montage (cycle >= 0.5 s) capped at 1/fireRate | fire interval | https://valorant-api.com/v1/weapons | ok |
| all | inspect clip | VM.insT or 2.2 s | no per-weapon value published | - | note (unsourced) |
| all | wall penetration depth / damage | High 0.6 m x0.75, Medium 0.35 m x0.5, Low 0.15 m x0.5 | Riot publishes the tier only | https://valorant-api.com/v1/weapons | note (unsourced) |
| all | Bandit (600, Sidearm) and Warden (2900, Rifle) | not in the game | in valorant-api 13.08 / wiki | https://valorant-api.com/v1/weapons | note (new weapons, out of scope) |
