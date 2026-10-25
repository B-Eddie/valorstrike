# VALORANT parity audit (hark-parity)

Branch `hark-parity` (from `origin/hark`, `origin/main` merged). Each row: the VALORANT rule, its source, what ValorStrike
does (offline page = `index.html` / `work/*_runtime.js`; online = `server/src`), and a verdict:
**matches**, **differs** (what), **missing**, **fixed** (on this branch, commit noted), or **owned** (another agent's area
right now; listed, not touched). Retrieved 2026-10-25.

Sources used (opened, not search excerpts):

- [W-Credits] https://wiki.playvalorant.com/en-us/Credits
- [W-Spike] https://wiki.playvalorant.com/en-us/Spike
- [W-Armor] https://wiki.playvalorant.com/en-us/Shields (Armor and Shield)
- [W-Unrated] https://wiki.playvalorant.com/en-us/Unrated?action=raw (rounds, buy/round/post-round phases, ult point sources, fall damage)
- [W-Comp] https://wiki.playvalorant.com/en-us/Competitive?action=raw (overtime)
- [W-Shorty] https://wiki.playvalorant.com/en-us/Shorty?action=raw (price 150 >>> 300 in 6.11)
- [W-Bandit] https://wiki.playvalorant.com/en-us/Bandit?action=raw
- [W-Weapons] https://wiki.playvalorant.com/en-us/Weapons (landing spread +7° for 0.225 s; movement penalties)
- [W-Classic] https://wiki.playvalorant.com/en-us/Classic (run 5.73 m/s)
- [Stark] "VALORANT Physics: Explained" (frame-by-frame measurements) https://docs.google.com/document/u/2/d/e/2PACX-1vTsGYzGYiO78fcr_frhhBmzDaMvEqgBRd3b5u7TNzXRAhKflvFOovleWmavebIfFywh3DHppT75xHAk/pub, summary https://www.reddit.com/r/VALORANT/comments/utc7qf/valorant_physics_derived
- [Riot-2020] Riot's 2020 weapon data (playvalorant contentstack export): Classic Run 5.73 / Walk 3.43 m/s https://gist.github.com/Manokii/694ff36fe4be01a700bd190f6b859275
- [P12.09] https://playvalorant.com/en-gb/news/game-updates/valorant-patch-notes-12-09 (air speed while sprinting matches melee speed)
- [P3.0] https://playvalorant.com/en-us/news/game-updates/valorant-patch-notes-3-0/ (27.5 % deadzone, 72.5 % tagging)
- [P13.06] https://wiki.playvalorant.com/en-us/Patch_Notes/13.06 (ACS replaced by Performance Score)

## 1. Movement (user priority, done first)

| Rule (VALORANT) | Source | ValorStrike before | Verdict |
|---|---|---|---|
| Run 6.75 m/s knife; guns scale (rifles 5.4, Classic 5.73) | W-Classic, Stark | same (weapon-calibration snapshot) | matches |
| Walk 0.6× run (Classic 5.73 → 3.43). Wiki text says "33 % slower" (0.67×) — conflicting; Riot's own data used | Riot-2020, W-Unrated | 0.6× | matches (conflict noted) |
| Crouch-walk 2.5 m/s with knife (0.37×) | Stark | 0.45× | **fixed** (movement commit) |
| Ground acceleration: top speed in 0.288 s for every stance, i.e. accel scales with the speed limit (rifle 18.75 m/s², knife 23.4); crouched 0.472 s | Stark | constant 56.25 m/s² (rifle 0.096 s, 3× too snappy) | **fixed** |
| Release stop: dv/dt = −(7.3625 v + 46.5) → rifle ≈ 84 ms / 0.20 m, knife ≈ 99 ms | Stark (updated constants) | linear 80 m/s² | **fixed** |
| Counter-strafe stops faster than releasing | Stark / common knowledge | braking 80 m/s² either way | **fixed** (friction + accel ≈ 66 ms) |
| Jump: 6.902 m/s launch, 20.45 m/s² gravity → 1.165 m apex, 0.675 s airtime | Stark (updated) | 7.25 / 22 → 1.195 m, 0.66 s | **fixed** |
| No landing slowdown (bunny hop keeps but never adds speed) | Stark, community guides | −15 % speed on every landing | **fixed** |
| Air speed never exceeds melee speed | P12.09 | capped at takeoff speed only | **fixed** (also ≤ 6.75 × tag) |
| Crouch-jump allowed | gameplay | jump blocked while crouched | **fixed** |
| Crouch transition 0.276 s | Stark | 0.12 s down / 0.18 s up | **fixed** |
| No camera bob while running; small landing view dip | Stark ("landing view bob") | level camera, no dip; viewmodel landing kick was a 1-frame step | **fixed** (≤ 2.5 cm spring dip, viewmodel kick/vy offset smoothed) |
| Online prediction stays reconciled (no rubber-banding on jumps) | — | snapshot compared with *current* position (ahead by RTT): −25 % pull each snapshot, y snapped when > 0.35 m → jumps snapped down online | **fixed** (server echoes last applied input + age; client compares with its predicted path at that moment) |
| Landing accuracy: +7° for 0.225 s | W-Weapons | +5° (snipers 7°) for 0.2 s (`landingLock`) | differs — **owned** (gunplay: valorstrike-qa-11) |
| Movement inaccuracy deadzone 27.5 %, tagging 72.5 % | P3.0 | same | matches |
| Ladders / ropes / ziplines | W-Unrated | not audited this pass (map-native, no rope objects found in motor) | not audited |
| Fall damage: 15 at ~8 m rising to 100 (fatal) at ~17 m, ignores armour | W-Unrated | none | **missing** → step 2 |

## 2. Economy

| Rule | Source | ValorStrike | Verdict |
|---|---|---|---|
| Start 800 each half; cap 9000 | W-Credits | 800 / 9000 (offline + server) | matches |
| Kill 200, plant 300 (attackers), win 3000 | W-Credits | same | matches |
| Loss 1900 / 2400 / 2900 by streak | W-Credits | same | matches |
| Survivors of a loss get only 1000 (attackers who lived without planting, or after a timed-out plant; defenders alive after detonation) | W-Credits (since 1.11) | full loss bonus | **missing** → step 2 |
| Reset at half; overtime/endgame 5000 | W-Credits, W-Comp | same (Spike acceptance test covers OT 5000) | matches |
| Overtime: ult points set to 3 short of the ult | W-Comp | not set | **missing** → step 2 if time |
| Prices: Shorty 300 (6.11), others per W-Credits | W-Credits, W-Shorty | Shorty 150 (offline + server), rest match | **differs** → step 2 |
| Bandit (600), Warden (2900) | W-Credits, W-Bandit | not in game (no models/stats) | missing (content; remains) |
| Armour: Light 25 / 400, Heavy 50 / 1000, absorb 66 %; Regen Shield 650 (25, 100 % absorb, 50 pool) | W-Armor | Light/Heavy 25 / 50 at 400 / 1000; no Regen Shield; absorption model is gunplay | Light/Heavy matches; Regen missing (remains); absorption **owned** (qa-11) |

## 3. Round structure

| Rule | Source | ValorStrike | Verdict |
|---|---|---|---|
| Buy phase 30 s; 45 s for the first buy of a half / endgame | W-Unrated | offline 45 / 30 (matches); **online 20 s** every round | **differs (online)** → step 2 |
| Round 100 s; spike fuse 45 s | W-Unrated, W-Spike | 100 / 45 | matches |
| Plant 4 s; defuse 7 s with 3.5 s checkpoint | W-Spike | 4 / 7 / 3.5 (offline + server) | matches |
| Post-round phase 7 s | W-Unrated | server `roundDelay=5` | **differs (online)** → step 2 |
| First to 13, sides swap after 12, overtime win by 2 | W-Unrated, W-Comp | same (server `>=13 && diff>=2`) | matches |

## 4. Spike

| Rule | Source | ValorStrike | Verdict |
|---|---|---|---|
| Carrier, drop on death, attackers-only pickup, hidden from defenders until seen/planted | W-Spike | implemented (server test "Defenders do not receive hidden Spike carrier…") | matches |
| Beeps speed up; double at 20 s, triple at 10 s, 7 s final sphere | W-Spike | cadence ~1/s → 2/s → 4/s (10 s) → 8/s (7 s), pulse synced to the light | close (single beeps instead of double/triple) — differs, low impact |
| Detonation kills within ~audio range | W-Spike | radius kill on detonation | matches (radius not re-measured) |
| Spike icon replaces the round clock after plant | W-Spike (0.50) | yes (commit 13cbb3e) | matches |

## 5. Ult points

| Rule | Source | ValorStrike | Verdict |
|---|---|---|---|
| +1 for a kill, a death (killed by an enemy), an orb, a plant, a defuse | W-Unrated | kits/ults implement kill, orb, plant/defuse points (server `ults.js`, `test-ults.js`); death point and spike deaths not re-checked | not fully audited |

## 6. HUD, feed, scoreboard, screens

| Rule | Source | ValorStrike | Verdict |
|---|---|---|---|
| Top bar: team portraits + score + timer; ammo bottom-right; HP/armour bottom-left; abilities bottom-centre | in-game layout | present (x-HUD) | matches (browser overlap checks **owned** by valorstrike-hark-16) |
| Kill feed: killer ▸ weapon icon ▸ victim, headshot / wallbang marks | in-game | killer ▸ victim with gun name | close; icons — not changed |
| Tab scoreboard: agent, name, ult, K/D/A, loadout/credits | Dignitas, ONE Esports guides | Agent, name, Ult, ACS, K, D, A, Econ | close |
| Post-match: ACS → Performance Score (0–500) since 13.06, K/D/A, econ rating, first bloods, plants, defuses | P13.06 | ACS, K/D/A, econ, first bloods, plants | differs (ACS kept; Performance Score is Riot-internal) |
| Round banners: ROUND WIN / LOSS, THRIFTY, FLAWLESS, CLUTCH, ACE (TEAM ACE) | in-game | all present (`X_TAGB`) | matches |
| Death cam / spectating | in-game | observer pass (kill-cam orbit, teammate spectate) | matches (not re-tested) |
| Hit feedback VFX / audio, combat report | — | — | **owned** (valorstrike-hitfx-1) |
| Gunplay damage, recoil, pellets, trades | — | — | **owned** (valorstrike-qa-11) |
| Bot routing / perf | — | — | **owned** (valorstrike-perf-1) |

## 7. Third-person locomotion (user add: "walking animation looks goofy")

What the rig has: the credited, retargeted Quaternius UAL1 *Standard* set (Idle, Walk, Jog_Fwd, Crouch_Idle, Crouch_Fwd,
Jump_Start / Jump_Loop / Jump_Land; aim/reload/cast upper-body clips). The free Standard library has **no strafe or
backpedal clips** (its locomotion list is Idle, Walk, Walk_Formal, Jog_Fwd, Sprint, Crouch_Idle, Crouch_Fwd —
https://godotassetlibrary.com/asset/5EskhM/quaterniusikrigged, https://quaternius.com/packs/universalanimationlibrary.html);
8-direction clips are in the paid Pro tier (no purchases allowed on this task) and the original source GLBs and the
retarget inputs are not in the sandbox. So true 8-way clip blending is **not possible on this branch**; directional
movement stays the procedural hip-yaw (±72°) + torso counter-turn on the forward clip, backpedal = stride played in reverse.

| Item | Before | Verdict |
|---|---|---|
| Playback rate vs ground speed | walk `sp/1.6` capped 1.8×, jog `sp/4.5`: at VALORANT speeds the planted foot moved at ~55–65 % of the ground speed (skating / moonwalking) | **fixed**: rate = speed ÷ clip's measured natural speed (walk 1.05, jog 2.9, crouch-walk 0.75 m/s; re-measured from the clip data by `work/test_tp_locomotion.cjs`) |
| Clip by speed | walk below 3.4 m/s, so shift-walking (3.2–4.1 m/s) used a slow walk sped up | **fixed**: walk ≤ 1.5 m/s, jog ≥ 2.4 m/s, blended between; crouch-walk when crouched |
| Quick stop → idle | raw per-frame speed (noisy) | **fixed**: ~0.1 s smoothing, idle below 0.35 m/s |
| Landing | land clip (knee buckle) on every landing, also mid-run | **fixed**: only from a standstill; moving landings return straight to the stride |
| Crossfades | exponential, k = 12 (≈ 0.25 s to 95 %) | matches the 0.15–0.25 s target (kept) |
| Upper body steady while legs move | separate upper-body layer (aim pose) + aim pitch through the spine + torso counter-turn | matches (kept) |
| 8-way directional clips | forward clip + hip yaw | **remains** (no clips available — see above) |
| Feet contact correction / TP grip IK | `xUbPost` native contact, grip_runtime | unchanged; `test_native_contact.cjs`, `test_grip*.cjs`, `test_feet.cjs` in the client suite |

### Visual check list for the browser agent (valorstrike-hark-16)

Run offline 5v5 (or a bot match) on Ascent, 1280×720, third-person spectate (die, then spectate a teammate) or watch bots
from a high spot. For each, record a 2–3 s clip or 6+ screenshots at 100 ms spacing:

1. **Rifle run (5.4 m/s)**: a bot running straight. The planted foot must stay fixed on the floor texture during contact
   (no sliding forward/back by more than a few cm); cadence fast but no skating. Fail if the foot visibly glides.
2. **Knife run (6.75 m/s)**: same check; slight slide (< ~10 cm per step) tolerated at the 2.35× cap.
3. **Shift-walk (3.2 m/s)**: uses the jog clip at ~1.1× — should read as a controlled jog, not a fast-forwarded slow walk.
4. **Crouch-walk (2.0 m/s)**: crouch-walk clip, head lowered ~0.45 m, feet planted.
5. **Strafe left/right**: hips turned toward the move (up to ~72°), chest and gun still facing the aim direction; legs must
   not cross or twist through each other.
6. **Backpedal**: stride plays in reverse, torso faces forward; no moonwalk (foot travels with the ground).
7. **Stop**: from a run, the body is in the idle pose within ~0.2 s of the unit stopping; no extra steps in place.
8. **Jump / fall / land**: Jump_Start on take-off, Jump_Loop while airborne, from a standstill a short land; a running
   landing goes straight back to the stride with no knee buckle.
9. **Upper body**: weapon held steady in both hands through 1–8 (no arm swing), aim pitch follows where the unit looks.
10. **Feet / grip IK**: on stairs and slopes feet rest on the steps (no floating / sinking > 3 cm); the support hand stays on
    the gun's foregrip while moving.
11. **Online**: a remote human on the other client — same checks 1, 5, 7 (remote units are interpolated at 20 Hz; their
    speed is smoothed over ~0.1 s, so no flicker between idle and walk while moving).

## Step 2 fixes on this branch

See the commit list in the final report; each row marked **fixed** above names its commit. Rows marked **missing/differs →
step 2** are worked in order of gameplay impact; anything not reached stays listed under "Remaining".

## Remaining

Filled in at the end of the pass.
