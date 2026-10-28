# HUD parity with VALORANT (lane vs-lane-hud, 2026-10-28)

User (23:11 2026-10-27): "for HUD indicators, its in wrong place, eg the pickup and then jett e ability timer arent in right place.
They also dont look good, search how it looks in valorant and copy". User (23:05): "is the crosshair wrong for shotgun?"

Reference images saved locally in `/workspace/work/qa/hud/ref/` (not committed): `eg.png` (Evil Geniuses "Screen Studies:
VALORANT", annotated 1292x727 in-match HUD), `dig1.png` (Dignitas Jett guide, Jett ability bar close-up), `sg.png` (bo3.gg,
default shotgun crosshair on a Bucky). Colours below are sampled from those images.

## Sources

| # | Source | Used for |
|---|--------|----------|
| S1 | https://geniusguide.evilgeniuses.gg/p/screen-studies-valorant (annotated HUD, 2024-07) | whole layout, numbered elements |
| S2 | https://www.oneesports.gg/valorant/user-interface-valorant-hud (2023-07) | top-centre timer/score/agents, bottom-centre health + abilities, ult on the right of the bar |
| S3 | https://dignitas.gg/articles/everything-you-need-to-know-to-dominate-with-jett (image) | Jett bar: armour hex + health left, icons with teal trapezoid charge bars, ult diamonds |
| S4 | TikTok @kangaval 2023-07-12 "Riot removed Jett's dash timer from under her crosshair, and instead it now appears much smaller above the ability icon" (https://www.tiktok.com/@kangaval/video/7254830697083358465) | Tailwind timer position |
| S5 | https://wiki.playvalorant.com/en-us/Tailwind (v7.04: 1 s windup, 7.5 s empowered window) + Patch 4.08 notes ("a charge meter will show up once you activate the Tailwind window", oneesports 4.08 article) | Tailwind timer content |
| S6 | https://playvalorant.com/en-us/news/game-updates/valorant-patch-notes-8-07 ("Interaction prompts have received an accessibility update, adding contrast ... Prompt text has been simplified and weapon prompts no longer show skinline names") + wiki Phantom trivia ("Press F to pick up Phantom: Standard Phantom" before 8.07) | pickup prompt text + contrast |
| S7 | https://bo3.gg/valorant/articles/valorant-shotgun-crosshair-how-to-change-and-how-to-make (+ image), https://www.thespike.gg/valorant/beginner-guides/how-to-change-shotgun-crosshair (2026-02), Patch 3.03 notes ("Added a setting to use the primary crosshair with shotguns") | shotgun crosshair |
| S8 | https://playvalorant.com/en-us/news/game-updates/valorant-patch-notes-11-10 (top HUD health bar turns teal while healing) , 12.05 (assist banners at the bottom; killfeed assists) | top bar / killfeed details |
| S9 | Bucky / Judge wiki spread tables (vendor/valorant-feel.js SPREAD, already sourced there) | circle radius |

## Spec per element (VALORANT, current) vs ours

Positions are for a 16:9 screen; px values at 1280x720 unless noted.

| Element | VALORANT (spec) | Ours before this lane | This lane |
|---|---|---|---|
| Minimap | top-left, circular-ish map with view cone, allies teal, spotted enemies red, site letters (S1 #1) | top-left canvas, cone + portraits (lanes minimap/minimap-icons) | unchanged (matches) |
| Top bar | top-centre: ally portraits (left, teal underline = health), score, round clock in a hex, score, enemy portraits (red); yellow box = ult ready (S1 #2-3); healing turns the health bar teal (S8) | xHudV2/xHudNative: portraits w/ teal/red underline, ult glow, hex clock, BUY PHASE label | unchanged (matches; healing tint not implemented, noted) |
| Kill feed | top-right, kills only, killer/victim portraits, weapon icon, headshot/wallbang icons, own kills outlined (12.05 assist icons own team only) | done in hitfx-2 / xHudV2 | unchanged |
| Health / armour | bottom-centre left of the ability row: small hexagon with the armour number, large health number (S1 #7, S3) | `.x-bl` health + shield icon, Arial 38px | unchanged |
| Ability bar | bottom-centre: C Q E icons (white), each with a teal trapezoid charge bar under it (one segment per charge, grey when spent), key letter tiny under that; ult (X) right with diamond point pips that turn teal when ready (S1 #8, S3). Teal sampled `#5feeb8` (bars) / `#6ffdbf` | icons + pips, but **spent/on pips white (`#fff`)** from xHudNative | charge segments teal `#5feeb8` when available, grey when spent (desktop) |
| Ability duration / window timer (Jett Tailwind etc.) | **small bar directly above that ability's icon** (S4; since mid-2023, previously a bar under the crosshair). Tailwind: 1 s windup, then 7.5 s window; the meter drains over the window (S5) | Offline: tiny text "WINDUP" / "7 s" in the slot's top-right corner (`em`). Online: a **red banner at bottom 22% of the screen** "TAILWIND READY · E TO DASH 7s" (netStatusChips) — wrong place, wrong look | `<q class="x-tm">` bar above the icon of the slot whose window is open: white bar filling during the windup, teal bar draining over the window; slot corner text hidden while it shows. Same for Phoenix Run It Back (10 s) and Sova Owl Drone (7 s). Online Tailwind driven by `NET.tw`, red banner no longer carries Tailwind. Touch: same bar over the E touch button (`--tm`) |
| Weapon / ammo | bottom-right of the bar: large magazine number, small `iii` + reserve (S1 #9); credits ¤ far bottom-right (S1 #10) | `.x-br` mag / reserve, credits | unchanged |
| Pickup prompt | when looking at a dropped gun: interaction prompt **just below the crosshair, centred**: key cap (light box, dark letter) + short text "PICK UP <WEAPON>" with a contrast backing (8.07), no skin name (S6). Exact offset not documented; screenshots of the in-game prompt could not be retrieved (TikTok/Facebook only) — offset is our best estimate (≈ 9 % of screen height below centre) | inline-styled dark panel at `top:calc(50% + 46px)`, Arial, mixed case "Pick up Vandal", outlined key | `.x-int` prompt: key cap filled `#ece8e1` with dark letter, text uppercase in the HUD face with soft dark shadow + light contrast plate, `top:calc(50% + max(56px, 9vh))`; touch: no key cap (the USE button is the action) |
| Status chips (online Vulnerable / Trapwire / dart) | VALORANT shows debuff status icons + timers near the bottom centre above the ability bar | red bar at bottom 22% | restyled: dark plate with red left edge, sits above the ability row (bottom 128px desktop) |
| Spike / defuse progress | defuse bar under the crosshair with "DEFUSING"; half-defuse tick | `#defuse` (spike lane) | unchanged |
| Buy phase | "BUY PHASE" banner under the top bar, "PRESS B TO BUY" | done (xHudNative) | unchanged |
| Combat report | after death, panel lower-left listing damage dealt / taken | death lane (vs-lane-death) owns it | not touched |
| Fonts | DIN-like condensed caps for HUD numbers/labels | bundled "VS Hud" / "VS Title" fonts + Arial in xHudNative | new elements use `var(--hf)` / VS Hud like the rest |
| Colours | HUD teal `#5feeb8`–`#73ceab`, enemy red `#ff4655`, white `#ece8e1` text with soft shadow | `--ha:#75cbb2`, `--he:#e8848b` | timer + charge bars `#5feeb8` |

## Crosshair (shotguns)

VALORANT's **default** for Shorty, Bucky and Judge is not the primary crosshair: it is a dedicated shotgun crosshair, "large
circles with a single dot in the center and no cross" (S7, image `sg.png`: thin white ring with a dark outline, ~22 px radius at
720p on a standing Bucky = its first-shot pellet spread). The setting **Crosshair > Primary > "Override All Primary Crosshairs
With My Primary Crosshair"** (added in patch 3.03, default OFF) replaces it with the player's primary crosshair.

Check of the sample image: Bucky standing spread ≈ 2.6–3 deg (wiki), 103 deg horizontal FOV at 1280x720 → focal ≈ 509 px,
tan(2.6 deg) x 509 ≈ 23 px ≈ the 22 px ring measured. So ring radius = the current pellet cone projected to the screen.

Ours before: shotguns drew the primary crosshair; movement error = moving cone − standing cone (the pellet spread itself
never showed, so it did not widen from the pellet cone), firing error = bloom. That matches VALORANT only with the override ON.

This lane: shotguns draw the ring (radius = tan(current cone) projected with the camera's real vertical FOV and the
viewport height, so it grows with movement / air / landing exactly like the pellets) + centre dot, in the crosshair colour
with the outline settings; new setting "Override all primary crosshairs with my primary crosshair" (default off) restores the
lines. Rifles/pistols/snipers unchanged (VALORANT code-0 defaults: inner 0.8/6/2/3 movement off firing on, outer
0.35/2/2/10 both on — already tested by work/test_crosshair_error.cjs).

## Open / not done

- Exact pixel offset of the VALORANT pickup prompt is an estimate (no retrievable in-game screenshot).
- Healing teal tint on top-bar health bars (11.10) not implemented.
- No real-browser screenshot (Chromium not allowed on this box for this lane); geometry checked by static CSS tests and a
  PIL mock render of the computed boxes (`/workspace/work/qa/hud/mock-*.png`).

## Implemented (branch lane-hud, local only)

| Commit | What | Test (red before) |
|---|---|---|
| df3c375 | Ability timers above the icon (Tailwind windup/window, Run It Back, Owl Drone; online NET.tw; touch E button), teal charges, online debuff chip restyle, Tailwind out of the red banner | work/test_hud_ability_timer.cjs, work/test_net_status.cjs updated |
| ffcfcdd | Pickup prompt = VALORANT interaction prompt (centred below crosshair, key cap, uppercase, contrast plate; no key on touch) | work/test_hud_pickup_prompt.cjs |
| c086a41 | Shotgun ring crosshair (VALORANT default) + "Override all primary crosshairs with my primary crosshair" setting (off) | work/test_crosshair_shotgun.cjs |

Gates: regen byte-identical x2, git diff --check, motor==vendor; client HUD / touch / minimap / killfeed / spike / ability
equip / client_abilities (all 12 agents, in chunks) / online abilities (Jett, Phoenix, Sova) / online spike HUD / client
lifecycle green (/workspace/work/qa/hud/results.txt). No server change. No real-browser render (mock only).
