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

- [TURBO] https://turbosmurfs.gg/article/how-to-improve-aim-in-valorant (quotes Riot_Classick's Phantom deceleration timings and
  patch 1.02 tagging figures; secondary)
- [UE-AIR] https://forums.unrealengine.com/t/how-does-valorant-handle-air-strafing/586555 (qualitative air steering; no value)
- [UE-STEP] https://bugnet.io/blog/fix-unreal-character-movement-stuck-on-step-up (UE MaxStepHeight default ~45 cm; engine default)
- [RVH] https://www.reddit.com/r/VALORANT/comments/1skgby1/eye_level_height (claims 1.96 m agent height, no method)

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
| Counter-strafe | friction + acceleration while reversing (rifle stop ~66 ms vs 84 ms released) | Riot_Classick (Riot dev, Phantom, as quoted by TURBO): counter-strafed 0.055 s to 61 % speed / 0.104 s to 25 % / 0.160 s full stop vs walk key, no counter-strafe 0.065 / 0.110 / 0.170 s | TURBO (secondary quote of a Riot post; the original post not found) | **no measurement found that fits our model**: the quoted times are about 2x STARK's release-stop (84 ms) and describe "walk key" releases, not a plain release, so they cannot be matched without breaking the STARK friction (a sourced match). Kept; noted as a conflicting source |
| Jump launch / gravity | 6.902 m/s, 20.45 m/s^2 -> apex 1.165 m, airtime 0.675 s | 690.2 u/s, 2045 u/s^2 | STARK update | match |
| Air speed cap | <= melee speed x tag, and <= max(takeoff, stance speed) | sprinting air speed = melee speed | P1209 | match |
| Air acceleration / air control | 12 m/s^2 (Jeff 9952f26, was 3.5) | not published; no frame-by-frame or Unreal-unit measurement found (STARK measures ground only; UE-AIR forum thread describes VALORANT air steering qualitatively: velocity keeps its magnitude while turning) | STARK, UE-AIR | **no measurement found** - kept |
| Landing slowdown | none (momentum kept) | none measured; RJ: landing on a box *edge* kills momentum (collision, not a rule) | STARK, RJ | match |
| Landing accuracy | +7 deg for 0.225 s (`landSpread`, `landSpreadTime`) | +7 deg for 0.225 s (wiki); files: "Landing penalty 0.7 -> 0 over 0.23 s" (multiplier units) | W-WPN, GS | match (wiki); file curve units unclear |
| `landingLock` 0.2 s | **removed** (2026-11-04): it was set on landing and read by nothing | VALORANT has no landing movement lock: STARK measures momentum kept on landing; landing only adds spread (+7 deg / 0.225 s, kept) | STARK, W-WPN | **changed: removed** (test: server/test-movement-measured.js 3, work/test_jump_feel.cjs) |
| Crouch transition | 0.276 s down and up | 0.276 s | STARK | match |
| Crouch eye drop | **0.40 m** (was 0.45; `crouchEye`, the crouched capsule 1.8 - ch = 1.40 m, the crouched head hitbox `server/src/hitboxes.js` CROUCH, the page camera via P.ch, the air tuck 0.20 m) | crosshair drops 40 u = 0.40 m (10 crouches over a 400 u square) | STARK | **changed to match** (Jeff OK 2026-11-03; test: server/test-movement-measured.js 1). Side effect: crouch-jump reach 1.165 + 0.20 = 1.365 m (was 1.39) |
| Standing eye / capsule | eye 1.6 m, capsule 1.8 m | STARK *assumes* a 200 u player ("given that a player's height is 200"), not measured; an r/VALORANT post says agents are 1.96 m with no method (RVH); Riot unpublished | STARK, RVH | **no measurement found** - kept |
| Crouch spam | `duckFatigue` +0.08 per press (cap 0.65), decays 0.55/s, slows the transition by (1+fatigue) | anti-spam slowing exists (secondary source), numbers unpublished; no measurement found | CS-PL | **no measurement found** - kept |
| Tagging slow | **x 0.275 at the hit, recovering linearly to full over 0.75 s, never under 15 %** (was a flat x 0.275 for 0.5 s; shared `Motor.tagK`, server `tagMul` = page `xTagK`; turret tag 0.5 -> 0.75 s); shotgun > 10 m 30 % eased over 0.5 s (patch 1.07) unchanged | game files: "Min tagging speed 15 %", Tagging curve "speed override while tagged, by time since the hit" 0 s -> 0, 0.75 s -> 4.5; wiki 72.5 % slow | GS Vandal, W-WPN | **changed to match** (Jeff OK 2026-11-03; test: server/test-movement-measured.js 2, 40 / 60 Hz server = prediction). Interpretation below |
| Step height | 0.40 m (`stepHeight`, raised from 0.36 for the Lotus 0.373 m riser) | not published; no measurement found (UE5 default MaxStepHeight 45 cm is an engine default, not VALORANT data) | UE-STEP | **no measurement found** - kept (also: lowering it would break the Lotus 0.373 m riser) |
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

## Changes after Jeff's OK (2026-11-03/04, "yes match" / "go through every value and change it so its valorant measured values")

Changed: crouch eye 0.45 -> 0.40 m (capsule, crouched hitbox, camera and air tuck follow), tagging -> the game-file curve, the dead
`landingLock` removed. Kept with "no measurement found": air acceleration 12, step height 0.40, standing eye 1.6 / capsule 1.8,
crouch-spam fatigue, counter-strafe extra (conflicting secondary source, see the table). Every other motor constant was already a
sourced match (table). Test: `server/test-movement-measured.js` (in `npm test`).

Tagging interpretation. The files give two numbers: "Min tagging speed 15 %" and a two-key curve "Tagging: 0 s -> 0, 0.75 s -> 4.5"
described as the speed override while tagged by time since the hit; the wiki gives the 72.5 % slow. The curve's y units are not
documented (4.5 is not a multiplier; it may be a speed in m/s or an internal scale), so its absolute values are not used. Read:
(1) the slow at the hit is the wiki's 72.5 % (x 0.275); (2) the tag lasts the curve's span, 0.75 s, and the slow lifts along it
linearly (two keys = linear); (3) the cap never drops below 15 % of base speed (only binds if a stronger slow is passed in).
Rejected readings: starting at 0 -> 15 % (ignores the wiki's 72.5 %, and Riot's patch 1.02 "70 % reduction"); 4.5 as m/s (would make
the cap gun-independent and exceed knife-relative caps for some guns). Riot's patch 1.02 also cut wall-penetration tags to 25 %;
not modelled here (unchanged).

## Constants awaiting Jeff's OK (superseded by the section above)

1. `crouchEye` 0.45 -> 0.40 m (STARK measured a 40 u crosshair drop). Also changes the crouched capsule height and every crouch
   head / hitbox height, so it touches combat parity; not done without approval.
2. Tag duration 0.5 s -> follow the file curve (min speed 15 %, 0.75 s ramp) - needs a decision on how to read the curve.
3. `airAcceleration` 12 (Jeff's value) has no source; leave unless a measurement turns up.
4. `stepHeight` 0.40, eye 1.6 / capsule 1.8, crouch-fatigue numbers, counter-strafe extra = unsourced approximations; informational.
5. `landingLock` 0.2 is dead (nothing reads `lp` for movement or spread) - remove or wire up?

## Shipped in lane-move (crouch-jump, additive)

- Motor `airCrouch()` (both copies): airborne crouch keeps the capsule centre; feet +0.225 m at a full tuck, eye -0.225 m
  (grounded crouch -0.45 m); standing up in the air lowers the feet, onto a box / floor below them if one is there (lands);
  blocked (ceiling / wall) = stays crouched. fallTop moves with the feet (no extra fall damage from a tuck).
- Reach: plain jump 1.16 m box, crouch-jump 1.38 m (synthetic box, rifle or knife speed). Real geometry: Breeze ledge at
  (-4.25, 4.02, 29.75) facing +45 deg, 1.38 m.
- Unchanged: grounded crouch (base kept), already-crouched jump (no tuck), counter-strafe, crouch fatigue, jump arc, air cap.
- Not modelled: Unreal's rounded capsule bottom (an "edge pop" when un-crouching with a box edge inside the bottom hemisphere);
  our collision capsule is flat-bottomed.

## Integration follow-ups (bugs-int, 2026-11-04)

The crouch drop now reaches every consumer of the old 0.45 m: the page's rendered crouch on native rigs (`work/repair_runtime.js`
`XRC.drop`, and the retargeted-rig `standHead - drop x cb`) is 0.40 m so the bone-following head hitbox matches the server's
`hitboxes.js` CROUCH (`work/test_native_crouch.cjs` reads `Motor.C.crouchEye`), and the server's wire crouch fraction (row [17])
is `ch / Motor.C.crouchEye` (was `ch / 0.45`, so a full crouch sent 0.89). Consequence of the tag curve on the server aim KPI: the
20 m median first hit moved one 0.05 s step, 0.95 -> 1.00 s, at the "<= 1.0 s" bound (`server/test-bot-aim-kpi.js` gets the 10 m
float margin). The legacy pre-motor movement fallback in index.html (`P.vy = 6.6`, `ct = cr ? 0.45 : 0`) is dead code under the
shared motor and was left alone. Locomotion clips untouched.
