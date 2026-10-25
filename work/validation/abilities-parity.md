# Abilities parity with Valorant (branch hark-abil)

Sources: playvalorant.com agent pages and wiki.playvalorant.com agent pages (cited per agent below).
Runtime: `work/ability_equip_runtime.js`, installed into `index.html` by `work/install_valorant.py`
(markers `// ---- ABILITY EQUIP ----` / `// ---- END ABILITY EQUIP ----`). Test: `work/test_ability_equip.cjs` (in test_all).

## 1. Ability keys and HUD

Finding: the keymap (`XKB` in index.html) already defaulted to Valorant's layout on every commit in history
(`git log -S'const XKB'`): Ability 1 **C**, Ability 2 **Q**, Signature **E**, Ultimate **X**, Crouch **Ctrl**,
Ping **Z**. No ability ever sat on Z/X/C in code, and every ability handler, the online relay and the touch layout
already use C/Q/E/X. Q/E/C have no other binding (Use is F, crouch Ctrl).

Changed:
- HUD slot key labels (`#jC/#jQ/#jE/#jX b`) now show the bound physical key (rebind Ability Q to V -> the slot reads V);
  before they were static letters. Updated whenever the keymap is saved/rendered (`xKbRender` wrapper).
- Migration: a stored `vs.keys` map with the legacy Z/X/C ability layout (abC=Z, abQ=X, abE=C) is moved to
  C/Q/E/X (ping back to Z, crouch C -> Ctrl) and saved; any other stored map is the player's choice and is kept.
  Players who never rebound have no stored map and already get the defaults.
- Rebinding still works offline (test) and online (unchanged keymap layer; `test_client_online_rebind.cjs`).

HUD already had: four slots bottom-centre with names, charge pips (`.x-pp`), counts, ult points as pips on X (`#xPips`),
conic cooldown/recharge wedge (`--p`) and signature recharge timers (e.g. Sova Recon `N s`, Omen Dark Cover `N s`).

## 2. Ability use flow (equip -> fire) and kit values

Runtime: second section of `work/ability_equip_runtime.js` (`XAB`, `XAB_EQ`, the `J.eq` state machine); server
`ABILITY_EQUIP` / `XAB_REC` in `server/src/abilities.js`. Tests: `work/test_ability_equip.cjs`, `server/test-ability-equip.js`.

Flow (Valorant): pressing an ability key EQUIPS it (gun lowered, item drawn, `XABT.draw` 0.5 s). FIRE (left click) throws /
places it; ALT FIRE (right click; knife ALT FIRE / touch long-press too) casts the alternate. The item leaves the hand after
`XABT.rel` 0.2 s, then the gun comes back over `XABT.rec` 0.45 s. A click during the draw is buffered. The gun cannot fire
from equip until it is back up (offline: `shoot` wrapper; online: no fire input is sent; server: `castAbility` sets
`u.fireAt = now + XAB_REC` after an equip-type cast, so a modified client cannot shoot through the throw either). A weapon
key / wheel (`swapW`) or the same ability key again puts it away with the charge kept; another ability key switches. If the
kit refuses the cast (no target, e.g. Sage heal at full HP) the ability stays in hand, as in Valorant.
The 0.5 s draw and 0.45 s recovery are generic (the wiki lists no per-ability equip times); the 0.2 s hand release is shared
with the per-ability wiki windups (section 5).

Equip vs quick-cast per agent (from each wiki description: "EQUIP ... FIRE" vs "INSTANTLY" / "ACTIVATE"):

| Agent | Equip-then-fire | Instant / own flow kept |
|---|---|---|
| Jett | — | C Cloudburst (INSTANTLY), Q Updraft (INSTANTLY), E Tailwind (ACTIVATE), X Blade Storm (knife flow) |
| Phoenix | C Blaze, Q Hot Hands, E Curveball (FIRE curve left / ALT FIRE right) | X Run It Back (INSTANTLY) |
| Sova | C Owl Drone, Q Shock Bolt, E Recon Bolt, X Hunter's Fury (FIRE shoots each blast) | drone flight / dart |
| Sage | C Barrier Orb, Q Slow Orb, E Healing Orb (FIRE ally / ALT FIRE self), X Resurrection | — |
| Reyna | C Leer | Q Devour / E Dismiss / X Empress (INSTANTLY) |
| Omen | C Shrouded Step, Q Paranoia, E Dark Cover | X From the Shadows (map) |
| Killjoy | C Nanoswarm, Q Alarmbot, E Turret, X Lockdown | Nanoswarm trigger (recast) |
| Raze | C Boom Bot, Q Blast Pack, E Paint Shells | Blast Pack detonate (recast), X Showstopper (existing click-to-fire) |
| Skye | E Guiding Light, X Seekers | C Regrowth (toggle), Q Trailblazer (existing click-to-leap), Guiding Light pop (recast) |
| Breach | C Aftershock, Q Flashpoint, E Fault Line, X Rolling Thunder | — |
| Cypher | C Trapwire, Q Cyber Cage, E Spycam (place), X Neural Theft | Spycam view / exit (recast) |
| Chamber | C Trademark, E Rendezvous (place) | Q Headhunter and X Tour De Force (gun swaps), Rendezvous return (recast) |

Not modelled at first: Breach Fault Line hold-to-extend (now section 7), Sova arrow bounce / charge selection (now section 6).
Buying charges per round is the existing buy-menu ability row (`jBuyHtml` / server `buyAbility`); costs are checked below.

### Values checked against wiki.playvalorant.com (fetched 2026-10-25)

Table: `work/validation/abilities-wiki.json` (charges, credits, ult points, signature recharge); stat dump
`work/validation/abilities-wiki.txt`. Sources (Abilities section of each page):
https://wiki.playvalorant.com/en-us/Jett, /Phoenix, /Sova, /Sage, /Reyna, /Omen, /Killjoy, /Raze, /Skye, /Breach,
/Cypher, /Chamber. Agents in the game: those twelve (`KITS`).

Fixed (client `KITS` / index.html and server `kits.json` + `abilities.js` agree):
- Phoenix ult points 6 -> **7** (wiki: Run it Back 7).
- Sova Recon Bolt recharge 60 s -> **50 s** (client cooldown, HUD wedge, server `rechargeAt`).
- Skye Guiding Light recharge 60 s -> **50 s** (client, HUD, server).
- Breach Fault Line recharge 60 s -> **50 s** (client, HUD, server).

Already matching (charges x cost, signature, ult points): Jett (2x200, 1x150, free E 2-kill recharge, 8), Sova (1x400,
2x150, 8), Sage (1x300, 2x200, heal 45 s, 7), Reyna (2x250, 2x200 shared, 7), Omen (2x100, 1x250, 2x150 Dark Cover 40 s,
7), Killjoy (2x200, 1x200, 9), Raze (1x300, 2x200, 2-kill Paint Shells, 8), Skye (1x150, 1x300, 2x250, 8), Breach
(1x200, 2x250, 8), Cypher (2x200, 2x100, 7), Chamber (1x200, 8x100 Headhunter, Rendezvous 30 s, 8), Phoenix (1x150,
1x200, 2x250 Curveball, 2-kill recharge).

Effect values: see section 4 (Cloudburst, Hot Hands, Nanoswarm fixed on both sides; the rest listed there).

## 3. First- and third-person ability animations

Runtime: third section of `work/ability_equip_runtime.js` (`xEqView`, `xEqItem`, `xEqTpGo`). No new assets.

- First person, while an ability is equipped: gun, knife and the native first-person rig (`XV.fp`) lower out of view
  over the 0.5 s draw (the native rig is hidden once fully down); the existing procedural hand (`xCaHand`: glove / cuff /
  sleeve) rises holding the ability item by type (`ABI_M` classification): throw -> grenade/orb with an agent-colour band,
  place -> device with an emitter, cast/buff -> glowing energy orb. Ready: cocked pose with a slow sway. Release:
  overhand swing (FIRE) or low underhand (ALT FIRE) for throws, reach-down for placed devices, push-forward for casts;
  the item leaves the hand at 75% of the swing. Recovery: the hand drops out while the gun comes back up (0.45 s).
  The older one-shot cast gesture (`XCA`) still plays for quick-casts and is cut when an equipped ability is thrown.
- Third person: casts relayed for another unit (`mpFx`: online relay and trusted-server replay) now play the rig's
  throw / cast one-shot (upper-body rigs) or the right-arm swing (skinned rigs), typed like the first person; bots keep
  their existing cast pose (`xCaBotGo` from the kill feed).
- Test: `work/test_ability_equip.cjs` (viewmodel section) checks that equipping drops the gun out of view (local y > 0.35
  lower), hides the native rig when loaded, shows the hand + item, and that the cast / weapon key restores gun position,
  visibility and rig, with the hand down. The headless harness does not load the native FP rig, so rig hiding is
  browser-verify; the third-person relay pose (`mpFx` -> `xEqTpGo`) is browser-verify too.

## 4. Effect values vs the wiki (cheap fixes)

Changed on both sides (client index.html, server abilities.js / devices.js), tests in `server/test-ability-equip.js` and
`work/test_ability_equip.cjs`:
- Jett Cloudburst smoke 4.5 s -> **2.5 s** (player cast, bot Jett, server smoke effect).
- Phoenix Hot Hands zone 30 dps (client) / 40 dps (server) -> **60 dps** both (wiki: 60/s).
- Killjoy Nanoswarm active time 4 s -> **5 s** (player, bot Killjoy, server `DEV.nanoswarm.active`).

Still different (not cheap; each needs a client + server mechanic change):
- Breach Fault Line hold-to-extend: done, section 7.
- Hot Hands growth: done, section 7.
- Per-ability windups: done, section 5.
- Sova arrow bounces / charge: done, section 6. Cloudburst hold-to-steer: done, section 7.

## 5. Per-ability windups (wiki)

Source: the "Windup" rows of the wiki.playvalorant.com agent pages (fetched 2026-10-25). One table on each side:
client `XAB_WIND` (index.html, next to `ABI_M`) and server `WINDUP` (`server/src/windups.js`), asserted equal by
`work/test_ability_equip.cjs`. The wiki's windup means three different things, applied as such:

| Ability | Wiki windup | Meaning | Client (offline / host) | Server |
|---|---|---|---|---|
| Breach Aftershock | 2.2 s | FIRE -> first burst | player fuse `xWf` 2.0 s after the 0.2 s release; bot 2.2 s | blast `at` +2.0 s |
| Breach Flashpoint | 0.5 s | FIRE -> pop | player 0.3 s after the release; bot orb 0.5 s | flash `at` +0.3 s |
| Breach Fault Line | 1.1 s | FIRE -> quake | `BC.fq` 0.9 s after the release; bot 1.1 s | `u.fault` -> `tickFault` +0.9 s (was instant) |
| Breach Rolling Thunder | 1.2 s | FIRE -> quake | `BC.fq` 1.0 s after the release (was instant) | `ULT.quake.delay` 1.0 s (was 0.9) |
| Phoenix Curveball | 0.6 s | FIRE -> pop | orb 0.4 s after the release; bot orb 0.6 s (was 0.5) | `DEV.curveball.windup` 0.4 s (was 0.5) |
| Reyna Leer | 0.4 s | FIRE -> nearsight | nearsight from 0.2 s after the release (was at once) | leer `at` +0.2 s (was 0.35) |
| Killjoy Lockdown | 13 s | deploy -> detain | 13 s (unchanged) | 13 s (unchanged) |
| Cypher Trapwire | 0.7 s | arm after placing | wire inert for 0.7 s | `armAt` 0.7 s |
| Chamber Trademark | 2 s | arm after placing | inert for 2 s | `armAt` 2 s, then the 0.5 s sight check |
| Raze Blast Pack | 1.5 s | damage arm | detonation deals 50 only after 1.5 s; knockback any time | server Blast Pack is a dash (no device) - not changed |
| Raze Showstopper | 1.4 s | launcher equip | clicks before 1.4 s do nothing (`RS.ssd`) | X equips `u.showstopper` (ready +1.4 s, 10 s window); FIRE before it does nothing, after it launches the rocket (section 7) |
| Chamber Tour De Force | 2.3 s | Operator equip | `BC.cd` 2.3 s | `u.fireAt` +2.3 s |

Equip times: each ability page's "Equip time" row (wiki.playvalorant.com/en-us/<Ability>, fetched 2026-10-25) is the
draw in `J.eq` (`XAB_EQT` / `xEqT`, the viewmodel's gun-down / hand-up follows it): Aftershock 0.9, Flashpoint 1.1,
Fault Line 0.8, Rolling Thunder 1.1, Blaze / Hot Hands / Curveball 0.8, Owl Drone 0.9, Shock / Recon Bolt / Hunter's Fury
0.8, Barrier Orb 0.8, Slow / Healing Orb 0.5, Resurrection 0.8, Leer 0.77, Shrouded Step 0.5, Paranoia 1.1, Dark Cover
0.6, Nanoswarm 0.74, Alarmbot 0.85, Turret 1.1, Lockdown 0.8, Boom Bot 1.1, Paint Shells 0.8, Guiding Light / Seekers 0.8,
Trapwire / Spycam 0.8, Trademark 1.0, Rendezvous 0.8 s (Blast Pack, Cyber Cage, Neural Theft list none: 0.5 s). The
pages also list unequip times (mostly 0.7 s); the gun recovery stays the generic 0.45 s (`XABT.rec`, server `XAB_REC`).

Thrown / cast abilities count the windup from the FIRE click: the equip flow's 0.2 s hand release (`XABT.rel` =
`XAB_REL`) happens first, so the effect fuse after the cast is `windup - 0.2` (`xWf` / `wf`). Bots cast without the hand
release and use the full windup. Not changed: Jett Tailwind 1 s (Tailwind keeps its instant dash), Sage Barrier 2 s
fortification (the wall is full HP at once), Neural Theft reveals: server now 2 s / 6 s (section 7); the offline client still pulses at 0 / 1.5 s.
Tests: `server/test-ability-equip.js`, `server/test-abilities.js` (Fault Line), `server/test-ults.js` (Trapwire /
Trademark arm), `work/test_ability_equip.cjs`.

## 6. Sova Shock Bolt / Recon Bolt: hold to charge, ALT FIRE bounces

Wiki (wiki.playvalorant.com/en-us/Sova): "HOLD FIRE to extend the range of the projectile. ALT FIRE to add up to two
bounces to this arrow." Both bolts now work that way on every path:

- Flight: one shared module, `vendor/sova-bolt.cjs` (UMD; inlined at the head of the ABILITY EQUIP block by
  `install_valorant.py` as `window.SovaBolt`, imported by `server/src/abilities.js`). Fixed-step (1/30 s) ballistic flight,
  speed from the charge, gravity, reflection off the hit surface's normal for each bounce (80 % speed kept), floor hits via
  the ground function, 5 s cap. Charge time (1 s to full), speeds (20 -> 50 m/s), gravity (12 m/s^2) and bounce loss are
  not on the wiki: they are this project's values (a tap carries ~10 m on flat ground, a full charge crosses a site).
- Client: with the bow out (`J.eq`, `XAB_HOLD.Sova` q / e = "bow"), FIRE down starts a HOLD (`st:"hold"`, `q.h` seconds),
  ALT FIRE adds a bounce (0 -> 1 -> 2 -> 0), releasing FIRE throws after the 0.2 s release. HUD `#xBow` under the
  crosshair: charge bar + two bounce pips. `jArrow` flies the traced path (`xBoltPath`: solids raycast with world face
  normals + `groundAt`), the bolt follows the arc and bounces nose-first.
- Online: the cast message carries `pw` (0..1) and `b` (0..2) (`mpCastSelf`); the host relay and the trusted server
  clamp both, a missing / junk value is a full-charge, no-bounce bolt (older clients). Server: the bolt is flown from the
  server's own eye / aim (`world.rayN` = BVH ray with the face normal); Shock Bolt detonates where and when it lands,
  Recon Bolt pulses start after its flight; the `ac` event carries `pw` / `b` so other clients draw the same arc ending
  at the server's landing point. `netClean` drops non-numeric `pw` / `b`.
- Tests: `server/test-ability-equip.js` (tap vs held range, 0/1 bounce off a wall, Recon pulse after the flight,
  clamping, legacy message), `server/test-ults.js` (recon device lands on the wall), `work/test_ability_equip.cjs`
  (hold state, ALT FIRE bounces + cycle, HUD, release throws a traced bolt, clamping of cast messages).
- Bots keep a full-charge, no-bounce bolt.

## 7. Wiki mechanics: Fault Line hold-to-extend, Hot Hands spread, Cloudburst flight

### Breach Fault Line (wiki.playvalorant.com/en-us/Fault_Line, fetched 2026-10-25)

Wiki stats: area 8 to 56 m long depending on charge time (estimated), 8 m wide (12.00), 8 m between Breach and the area
(1.11), 1 s to fully charge (3.0), 1.1 s windup, 2.5 s concuss. Reading used here: the strip starts 8 m in front of Breach
and runs `8 + 48 * charge` m from there (a tap covers 8..16 m ahead, a full charge 8..64 m), 4 m either side.

- Shared values: server `FAULT` / `faultLen` / `faultPw` (`server/src/abilities.js`), client `XFAULT` / `xFaultLen`
  (index.html, next to `BC`), asserted equal by `work/test_ability_equip.cjs`.
- Client: `XAB_HOLD.Breach.e = "fault"`: with Fault Line out, FIRE down starts the hold (`st:"hold"`), releasing FIRE
  casts after the 0.2 s release; ALT FIRE does nothing. Charge `min(1, held / 1 s)` (`XABT.hold.pw`) sets `L` of the
  queued quake (`BC.fq`); the quake (`bcLine`, now with the 8 m offset) fires after the windup. The `#xBow` bar under the
  crosshair shows the charge (no bounce pips).
- Online: the cast carries `pw` - P2P (`mpCastSelf`, host relay `mpBolt` clamps it and relays it) and the trusted server
  (`work/server_runtime.js` Breach E intent). Server: `u.fault.len = faultLen(m.pw)`, `tickFault` uses the strip; the `ac`
  event echoes `pw`. Relayed casts draw / apply the same strip after the windup (`BC.fq` `"mfl"` -> `mpFault`: local
  player concussed on every peer, units dazed on the host). Missing / junk charge = full (bots, older clients).
- Bot Breach (offline): charged to reach just past the site (`L = clamp(dist + 4 - 8, 8, 56)`), same strip and 2.5 s.
- Tests: `server/test-abilities.js` (tap / half / full lengths, width, the 8 m gap, clamping, junk = full, `pw` echoed),
  `work/test_ability_equip.cjs` (hold state, no cast while held, ALT FIRE ignored, HUD bar, ~32 m at 0.5 s held, bot
  dazed inside / not past the end, tap near 8 m, relayed strip from the message charge).

### Phoenix Hot Hands (wiki.playvalorant.com/en-us/Hot_Hands, fetched 2026-10-25)

Wiki: 4 s duration = 0.75 s spread time + 3.25 s at full size, radius 4.5 m (estimated), 60 ticks/s. Was a 4 s zone at
full size from the start, 2.5 m on the client and 4 m on the server.

- Server: `DEV.hotHands = {life:4, radius:4.5, grow:.75}`; the `fire` effect is pushed with radius 0 and `full` / `grow`
  / `born`, and `tickAbilities` sets `radius = full * min(1, age / grow)` before picking targets (burn and self-heal).
- Client: `XHOT` (index.html, next to `zoneGeo`); the player's zone and a relayed one (`mpFx` `fire`, not Raze's Paint
  Shells) carry `R` / `a`; `jFxTick` grows the damage / heal radius and scales the 2.5 m `zoneGeo` disc with it.
- Tests: `server/test-ability-equip.js` (radius 0 / 2.25 / 4.5 m at 0 / 0.375 / 0.75 s; a foe 4 m out burns only once
  reached; gone after 4 s), `work/test_ability_equip.cjs` (XHOT == server, disc ~1.8 m at 0.3 s, 4.5 m by 1 s, relayed
  Hot Hands grows, Paint Shells unchanged).

### Jett Cloudburst (wiki.playvalorant.com/en-us/Cloudburst, fetched 2026-10-25)

Wiki: cast INSTANTLY, throws a projectile forward; holding the key turns it into a missile that follows the crosshair; on
release it falls (gravity) and cannot be steered again; it smokes on hitting a surface or after 2 s in the air; smoke 2.5 s
(includes 0.6 s deployment), radius 3.35 m. Was an instant smoke at the aim point (14 m max).

- Shared flight: `vendor/cloudburst.cjs` (UMD; inlined after the Sova bolt by `install_valorant.py` as
  `window.Cloudburst`, imported by `server/src/abilities.js`). `start(o, d)`, `step(st, dt, aim | null, ray, ground)` ->
  landing point or null, `centreY(y, floor)` (smoke centre between floor + 1.5 and + 4 m). Throw 18 m/s with 9 m/s^2
  gravity (a flat tap lands ~10 m ahead), steered missile 14 m/s along the aim, 2 s cap: this project's values (not on
  the wiki).
- Client (offline / own cast online): C throws at once (`J.cbs`); `jCbTick` steers with `jAim()` while `keys.KeyC` is held
  (the keymap layer maps a rebound key to KeyC), a release ends steering for good (a second press throws the second
  charge); the landing makes the 2.5 s smoke (`jCbSmoke`). Round reset clears `J.cbs`.
- Trusted server: the C intent starts a `cloudburst` effect at the server eye / aim; the `in` message carries `cb: 1` while
  C is held (Jett only; `u.input.cb`, only fresh input steers); `tickCloudburst` flies it and turns the same effect into
  the `smoke` (`e.cb`, centre `e.c`) where it lands. No `ac` cast event for it: the snapshot `fx` carries `{kind:'cb', id,
  o: owner, p, s: 0}` while it flies and `{..., s: 1, tl}` for the smoke; other clients draw the projectile and add the
  smoke once per id (`netSyncCb`), the caster's own is skipped (flown locally).
- P2P (host relay): the caster flies it; the cast message goes out when it lands with `p` (the smoke centre); the host
  accepts `p` within 45 m of the eye and relays it; peers smoke there (`enSmoke` takes a centre height). Peers' Jett
  smoke duration in `MP_SMK` 4.5 -> 2.5 s.
- Not changed: smoke radius stays 4 m on every smoke (client `smokeGeo` / `jBlock`, server `SMOKE.radius`, shared with
  Omen / Cypher); offline bot Jett still places its smoke directly.
- Tests: `server/test-ability-equip.js` (tap arc lands ~10 m ahead at floor + 1.5, held + turned steers for the full 2 s,
  release ends steering, smoke at a wall, snapshot rows projectile -> smoke, no cast event at the throw, `cb` only from
  `1`), `work/test_ability_equip.cjs` (instant throw, smoke on landing, held C follows a 90 degree turn, release stops
  steering, second press throws the second charge, 2 s cap / 28 m held straight, smoke centre band, `netSyncEffects` cb
  rows: projectile, one smoke at the server point, dropped rows, own skipped, junk ignored).

### Raze Showstopper equip (wiki.playvalorant.com/en-us/Showstopper, fetched 2026-10-25)

Wiki: equip time 1.4 s, max duration 10 s including the equip, one rocket. The trusted server used to launch the rocket
the moment the X intent arrived (the client sends it when X spends the ult, i.e. at the equip), with the aim of that
moment. Now `startUlt` Raze only sets `u.showstopper = {ready: +1.4 s (WINDUP.showstopper), until: +10 s}`;
`spike.js fire()` hands the trigger to `showstopperFire` while it is set: before `ready` it does nothing (and never fires
the gun), after it the rocket leaves along the server eye / aim of the FIRE tick and the launcher is gone; `tickUlts`
drops an unfired launcher at 10 s or on death; round reset clears it; a second X while it is out is rejected; the seat
bot inherits it (`takeOver`). Client: the click that launches the local rocket (`RS.ss` 1 -> 0) is one fire pulse in the
`in` message (`NET.firePulse`), so a semi-auto sidearm (no held fire) still reaches the server's launcher.
Tests: `server/test-ults.js` (no rocket on equip, nothing at 1.3 s and no gun shot, rocket at 1.4 s on the FIRE aim, gun
again after, put away after 10 s, dropped on death; the rocket / seat-bot / joiner checks fire through the equip).

### Cypher Neural Theft reveals (wiki.playvalorant.com/en-us/Neural_Theft, fetched 2026-10-25)

Wiki: 1st reveal windup 2 s, 2nd reveal windup 4 s (v5.10: "4 s delay between reveals"), so the server reveals at 2 s and
6 s after the cast (`ULT.theft.reveals` [1, 3] -> [2, 6]; the 1.6 s reveal length unchanged). Not changed: the 5 m corpse
reach (wiki 18 m) and the offline client's 0 / 1.5 s pulses. Test: `server/test-ults.js` (nothing before 2 s, first
reveal at 2 s, gone, nothing before 6 s, second at 6 s).

### Smoke radius per ability (wiki.playvalorant.com/en-us/Cloudburst, /Dark_Cover, /Cyber_Cage, fetched 2026-10-25)

Wiki: Cloudburst radius 3.35 m, Dark Cover radius 4.1 m, Cyber Cage cylinder radius 3.72 m - each ability has its own, so
the shared 4 m is gone for these three. Server: `abilities.js SMOKE.r = {Jett: 3.35, Omen: 4.1, Cypher: 3.72}` (Dark Cover
push, Cloudburst landing `e.radius`, `devices.js` Cyber Cage); `smokeBlocks` already reads `e.radius`; any other smoke keeps
`SMOKE.radius` 4. Client: `XSMR` (same table, asserted equal), every `J.smokes` entry carries `r` and its 4 m sphere is
scaled to it (`xSmk`): the player's Dark Cover / Cyber Cage / Cloudburst, bot smokes and relayed casts (`enSmoke(..., r)`
from `mpFx` / the bot kit / `netSyncCb`); `jBlock` (bot sight) and the minimap circle use `s.r` (4 m when absent).
Cyber Cage stays a sphere (not a cylinder). Tests: `server/test-ults.js` (table, Dark Cover 4.1 / Cyber Cage 3.72 on the
cast, `smokeBlocks` blocks inside the radius only), `server/test-ability-equip.js` (Cloudburst 3.35), `work/test_ability_equip.cjs`
(XSMR == SMOKE.r, relayed radii and mesh scale, `jBlock` 3.6 m pass).
