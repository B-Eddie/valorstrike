# Movement constant audit, 2026-11-03 (lane-move)

Scope: every movement constant in the shared motor (`server/src/motor.cjs` == `vendor/valorant-feel.js`, `C` at line 13),
the per-weapon speed table the client and server both read (`models/valorant/weapon-calibration.js`, valorant-api snapshot),
the tag slow (`server/src/simulation.js:62` `tagMul`, page `xTag` in `work/feel_runtime.js`) and the rope constants
(`ROPE`, motor). **No constant was changed in this audit.** Rows marked DIFF / UNSOURCED are listed for Jeff at the end.

## Sources (fetched 2026-11-03)

- [STARK] "VALORANT Physics: Explained" (frame-by-frame measurements, incl. the later update block):
  https://docs.google.com/document/u/2/d/e/2PACX-1vTsGYzGYiO78fcr_frhhBmzDaMvEqgBRd3b5u7TNzXRAhKflvFOovleWmavebIfFywh3DHppT75xHAk/pub
- [GS] valorant.gs game-file dump, build 13.09.00.5777412: weapons table https://valorant.gs/weapons/ and Vandal blueprint
  (walk / crouch error curves, landing penalty, tagging curve, "Min tagging speed 15%") https://valorant.gs/weapons/vandal/
- [W-MEL] https://wiki.playvalorant.com/en-us/Melee (run 6.75 m/s)
- [W-OP] https://wiki.playvalorant.com/en-us/Operator (run 5.13, scoped 72 % = 3.694 m/s; v1.09 76 % -> 72 %, deadzone 30 -> 15 %)
- [W-WPN] https://wiki.playvalorant.com/en-us/Weapons (tagging 72.5 % slow "for a brief period", shotgun pellets > 10 m 30 %;
  landing +7 deg for 0.225 s; deadzone 27.5 %)
- [W-UNR] https://wiki.playvalorant.com/en-us/Unrated (walk "33 % slower"; fall damage 8 m / 17 m)
- [WIKI-GUN] wiki pages Guardian / Odin / Stinger / Classic (ADS move 76 %; run 5.4 / 5.13 / 5.73 / 5.73)
- [P1209] https://playvalorant.com/en-gb/news/game-updates/valorant-patch-notes-12-09 (air speed while sprinting = melee speed)
- [TRK] https://tracker.gg/valorant/articles/how-to-jump-higher-in-valorant (crouch-jump: jump, hold crouch, release on contact)
- [RJ] https://www.reddit.com/r/VALORANT/comments/1u9h2co/valorant_movement_mechanics_jumps (crouch mid-air "tucks your legs";
  jumping crouched then uncrouching mid-air extends the legs down; landing on a box edge kills momentum)
- [ROPE] Pearl Hogbash (2020) via wiki Split: rope speed "about the same speed as when running with an Operator"
- [CS-PL] https://esportnow.pl/blog/2025/06/14/kucanie-w-valorant-mechanika-ktora-moze-uratowac-runde/ (crouch spam slows
  the crouch after a few rapid toggles; secondary source, no numbers)

## Table

| Constant | Ours | VALORANT | Source | Difference |
|---|---|---|---|---|
| Knife / ability / spike run speed | 6.75 m/s (`knifeSpeed`) | 6.75 m/s | W-MEL, STARK | match |
| Rifles (Vandal, Phantom, Bulldog, Guardian, Warden), Sheriff, Shorty, Marshal, Outlaw run | 0.80 x = 5.40 | 80 % / 5.4 m/s | GS table, WIKI-GUN, STARK | match |
| Classic, Frenzy, Ghost, Bandit, Stinger, Spectre run | 0.85 x = 5.7375 | 85 % / 5.73 m/s | GS table, WIKI-GUN | match (wiki rounds to 5.73) |
| Bucky, Judge run | 0.75 x = 5.0625 | 75 % | GS table | match |
| Operator, Odin, Ares run | 0.76 x = 5.13 | 76 % / 5.13 m/s | GS table, W-OP | match |
| ADS / scoped speed: rifles, SMGs, Odin, Ares | x 0.76 | 76 % | WIKI-GUN, GS (Vandal "ADS run speed 76 %") | match |
| ADS: Operator | x 0.72 (3.694 m/s) | 72 % (3.694 m/s) | W-OP | match |
| ADS: Marshal / Outlaw | x 0.90 / x 0.80 | valorant-api snapshot (same file) | weapon-calibration.js | match to snapshot (not re-fetched per gun) |
| Walk | x 0.60 | game files: walking error curve ends at x = 0.6 of run speed; wiki text "33 % slower" (x 0.67) | GS Vandal, W-UNR | match to game files; wiki text conflicts (already noted in valorant-parity.md) |
| Crouch-walk | 2.5 m/s with knife (x 0.370 of run, for every gun) | 250 u/s knife | STARK | match (GS crouch error curve switches on at x 0.29-0.3 of run speed: consistent with ~0.3-0.37, not a precise figure) |
| Ground acceleration | top speed in 0.288 s every stance (rifle 18.75, knife 23.44 m/s^2) | 0.288 s, accel scales with speed limit | STARK | match |
| Crouched acceleration | 0.472 s | 0.472 s | STARK | match |
| Release friction (stop) | dv/dt = -(7.3625 v + 46.5) -> rifle stop 84 ms / 0.203 m | S = 7.3625, F = 4650 u/s^2 (update block) | STARK | match |
| Counter-strafe | friction + acceleration while reversing (rifle stop ~66 ms) | faster than release (no published figure) | STARK (qualitative) | behaviour match, value is ours |
| Jump launch / gravity | 6.902 m/s, 20.45 m/s^2 -> apex 1.165 m, airtime 0.675 s | 690.2 u/s, 2045 u/s^2 | STARK update | match |
| Air speed cap | <= melee speed x tag, and <= max(takeoff, stance speed) | sprinting air speed = melee speed | P1209 | match |
| Air acceleration / air control | 12 m/s^2 (Jeff 9952f26, was 3.5) | not published / not measured | - | UNSOURCED (Jeff's tuning, kept) |
| Landing slowdown | none (momentum kept) | none measured; RJ: landing on a box *edge* kills momentum (collision, not a rule) | STARK, RJ | match |
| Landing accuracy | +7 deg for 0.225 s (`landSpread`, `landSpreadTime`) | +7 deg for 0.225 s (wiki); files: "Landing penalty 0.7 -> 0 over 0.23 s" (multiplier units) | W-WPN, GS | match (wiki); file curve units unclear |
| `landingLock` 0.2 s | set on landing, read by nothing that moves (spread uses `ls`) | - | - | dead value, no effect |
| Crouch transition | 0.276 s down and up | 0.276 s | STARK | match |
| Crouch eye drop | 0.45 m (`crouchEye`; also the capsule shrink) | crosshair drops 40 u = 0.40 m (10 crouches over a 400 u square) | STARK | **DIFF 0.05 m** (ours 12.5 % deeper) |
| Standing eye / capsule | eye 1.6 m, capsule 1.8 m | STARK assumes 2.0 m player height (not measured); Riot unpublished | STARK | UNSOURCED |
| Crouch spam | `duckFatigue` +0.08 per press (cap 0.65), decays 0.55/s, slows the transition by (1+fatigue) | anti-spam slowing exists (secondary source), numbers unpublished | CS-PL | behaviour present, values ours |
| Tagging slow | x 0.275 (72.5 % slow) for 0.5 s; shotgun > 10 m 30 % eased | 72.5 % slow "for a brief period"; files: "Min tagging speed 15 %", tagging curve 0 -> 4.5 over 0.75 s | W-WPN, GS Vandal | slow % match; **duration 0.5 s is ours; file curve (0.75 s) suggests a longer, ramped recovery** |
| Step height | 0.40 m (`stepHeight`, raised from 0.36 for the Lotus 0.373 m riser) | not published | - | UNSOURCED |
| Ropes (Split ascenders) | 6.75 x 0.76 = 5.13 m/s, top speed in 0.1 s; walk x 0.6 | "about Operator run speed" | ROPE | match (accel is ours) |
| Ladders | none | VALORANT has no ladders (files list a ladder recoil multiplier only) | GS Ares page | n/a |
| Movement deadzone | 27.5 % (Operator 15 %) | 27.5 % / Operator 15 % | W-WPN, W-OP | match |
| Fall damage | 15 at 8 m -> 100 at 17 m, linear | 8 m / 17 m end points | W-UNR | match (linear between is ours) |

## Crouch-jump: what VALORANT does (for Part 2)

- Crouching while airborne tucks the legs: the capsule shrinks from the feet (RJ "crouch midair and tuck our legs in similar to
  how you would do a box jump"; TRK). VALORANT runs on Unreal's character movement, whose `Crouch()` keeps the capsule *base* on
  the ground but keeps the capsule *centre* in the air (`bCrouchMaintainsBaseLocation` is only true while walking): the feet rise
  and the head drops by half the height change each, and the camera (eye relative to the centre) drops by
  `standing eye - crouched eye` only, i.e. half the grounded drop. INFERRED from the engine default; Riot has not published it.
- Jumping already crouched and standing up mid-air extends the legs downward (RJ: lower peak, lands on a box sooner).
- Releasing crouch over a box drops the feet onto it (TRK step 3; Unreal's un-crouch sweeps down and stands on what it finds).

## Constants awaiting Jeff's OK (not changed)

1. `crouchEye` 0.45 -> 0.40 m (STARK measured a 40 u crosshair drop). Also changes the crouched capsule height and every crouch
   head / hitbox height, so it touches combat parity; not done without approval.
2. Tag duration 0.5 s -> follow the file curve (min speed 15 %, 0.75 s ramp) - needs a decision on how to read the curve.
3. `airAcceleration` 12 (Jeff's value) has no source; leave unless a measurement turns up.
4. `stepHeight` 0.40, eye 1.6 / capsule 1.8, crouch-fatigue numbers, counter-strafe extra = unsourced approximations; informational.
5. `landingLock` 0.2 is dead (nothing reads `lp` for movement or spread) - remove or wire up?
