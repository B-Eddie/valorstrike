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
- Killjoy Nanoswarm active time 4 s -> **5 s** (player, bot Killjoy, server `DEV.nanoswarm.active`); radius and the 1 s windup: section 7.

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
fortification (the wall is full HP at once), Neural Theft reveals: 2 s / 6 s on the server and the offline client (section 7).
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
6 s after the cast (`ULT.theft.reveals` [1, 3] -> [2, 6]; the 1.6 s reveal length unchanged). Re-checked against the
official page (oldid 153225, edited 2026-09-13): the stats table lists "2nd reveal windup time 4 seconds" next to the 2 s
first windup, and the v5.10 note reads "4 s delay between reveals" - the 4 s is counted from the first reveal, so 2 s and
6 s stand. Corpse reach: wiki "Max cast distance 18 meters" (v5.10, 12 -> 18 m): server `ULT.theft.reach` 5 -> 18 m
(still a visible corpse in front, LOS). Offline client now matches (`CYNT {reach: 18, at: [2, 6], reveal: 1.6}`; was
8 m and pulses at 0 / 1.5 s of 1.2 s): the pulses carry a round token (`CYNT.g`, bumped by `cyClear` on every round
clear) so a cast pending at round end never reveals in the next round, and Cypher's own death does not cancel them
(wiki v7.07). The offline client still finds the corpse by 2D distance only (no aim cone / LOS) and keeps the 0.5 s equip
+ FIRE flow. Tests: `server/test-ults.js` (corpse at 18.5 m refused with the ult kept, 17 m cast; nothing before 2 s,
first reveal at 2 s, gone, nothing before 6 s, second at 6 s), `work/test_ability_equip.cjs` (CYNT table; 19 m refused,
17 m cast; page-clock 1.9 / 2.1 / 3.8 / 5.9 / 6.1 s checks; a round clear cancels pending reveals).

### Smoke radius per ability (wiki.playvalorant.com/en-us/Cloudburst, /Dark_Cover, /Cyber_Cage, fetched 2026-10-25)

Wiki: Cloudburst radius 3.35 m, Dark Cover radius 4.1 m, Cyber Cage cylinder radius 3.72 m - each ability has its own, so
the shared 4 m is gone for these three. Server: `abilities.js SMOKE.r = {Jett: 3.35, Omen: 4.1, Cypher: 3.72}` (Dark Cover
push, Cloudburst landing `e.radius`, `devices.js` Cyber Cage); `smokeBlocks` already reads `e.radius`; any other smoke keeps
`SMOKE.radius` 4. Client: `XSMR` (same table, asserted equal), every `J.smokes` entry carries `r` and its 4 m sphere is
scaled to it (`xSmk`): the player's Dark Cover / Cyber Cage / Cloudburst, bot smokes and relayed casts (`enSmoke(..., r)`
from `mpFx` / the bot kit / `netSyncCb`); `jBlock` (bot sight) and the minimap circle use `s.r` (4 m when absent).
Cyber Cage: cylinder since the next entry. Tests: `server/test-ults.js` (table, Dark Cover 4.1 / Cyber Cage 3.72 on the
cast, `smokeBlocks` blocks inside the radius only), `server/test-ability-equip.js` (Cloudburst 3.35), `work/test_ability_equip.cjs`
(XSMR == SMOKE.r, relayed radii and mesh scale, `jBlock` 3.6 m pass).

### Cyber Cage cylinder (wiki.playvalorant.com/en-us/Cyber_Cage, fetched 2026-10-25)

Wiki: "a white, hollow, open-ended cylinder", radius 3.72 m, "the cylinder's center is positioned at the location where the
cage was activated" (its walls reach above and below it), 7.25 s. No height is given: half-height 5 m (top 5 m above the
cage, as tall as the sphere smokes) on both sides (server `DEV.cage.h`, client `CYCAGE.h`, asserted equal). Server: the Cyber
Cage effect carries `cyl: 5`; `smokeBlocks` hands it to `cageBlocks`, which blocks a segment only where it crosses the side
wall inside the height band - inside-to-inside and straight down through the open top stay clear, inside-to-outside and
through are blocked. Client: `cageGeo` (open-ended `CylinderGeometry`, radius 4 scaled to 3.72 in x / z, 10 m tall)
centred on the floor under the cage for the player's cast (`groundAt`), relayed casts (`mpFx` -> `enSmoke(..., cyl)`, floor
from the caster's height; online `netFxPoint` floor) and the same `xCageHit` test in `jBlock` (bot sight). The smoke tick's
0.3 s bloom used to reset every smoke mesh to scale 1 (the 4 m sphere) after `xSmk` sized it; it now keeps the
per-ability radius (sphere: radius / 4 x bloom; cage: radius / 4 in x / z, bloom in height). Tests: `server/test-ults.js`
(cast carries `cyl` 5; through / 3.6 m / 3.8 m off / inside-inside / inside-out / over the top / down the top / ends
short of the wall / walls below the centre; wall at 16.28 m), `work/test_ability_equip.cjs` (CYCAGE.h == DEV.cage.h,
open-ended cylinder mesh, player cast scale 0.93 / 1 / 0.93 on the floor after the bloom, Dark Cover stays 1.025 after the
bloom, relayed cage is the cylinder, `jBlock` cases as the server).

### Sova Recon Bolt pulses (wiki.playvalorant.com/en-us/Recon_Bolt, fetched 2026-10-25)

Wiki stats: radius 30 m; sonar pulses 1 every 1.6 s, 2 pulses (v7.04); reveal duration 0.75 s; windup 0.667 s. Enemies are
revealed only in the bolt's line of sight. Was: server 20 m with a 1.6 s reveal per pulse (pulses 0.9 / 2.5 s after landing,
line of sight already checked); offline client one instant 3 s reveal of every bot within 15 m (no line of sight), bot Sova's
bolt on the player the same 15 m.

- Server: `DEV.reconBolt = {pulses: [.9, 2.5], radius: 30, reveal: .75}` for the bolt-flown Sova E (the effect carries
  `reveal`; `tickDevices` reads `e.reveal`). `DEV.recon` (20 m / 1.6 s) remains the generic recon / drone
  fallback; Owl Drone / Spycam are now darts (`DEV.owl` / `DEV.spycam`, see below).
- Client: `XRCN` (same table, asserted equal). `jReveal` (player / ally bot / relayed ally bolt) and `enRecon` (enemy bolt
  on the player) now schedule the two pulses from the landing; each pulse reveals what is within 30 m and in the bolt's sight
  (`los` from 0.5 m above the bolt to the chest / the player's eye) for 0.75 s and draws the sonar rings. Pulses carry a round
  token (`XRCN.g`, bumped by `jClear`) so a bolt from the previous round never pulses.
- Timing: the 1.6 s spacing is the wiki's; the first pulse stays 0.9 s after landing (the wiki's 0.667 s "windup" does not
  say what it counts from, so the existing value is kept).
- Tests: `server/test-ults.js` (table; 10 m and 28 m from the bolt revealed, 31 m not; 0.75 s reveal; gone after the last
  pulse), `work/test_ability_equip.cjs` (XRCN == DEV.reconBolt; nothing at 0.85 s, 28 m revealed / 33 m not at 0.95 s,
  over by 1.7 s, second pulse at 2.5 s, no reveal without line of sight, a round clear cancels pending pulses).

### Flash blind durations and Leer (wiki /Flashpoint, /Guiding_Light, /Curveball, /Paranoia, /Leer, fetched 2026-10-25)

Wiki: Flashpoint max blind 2.25 s, Guiding Light max blind 1 - 2.25 s (with its flight time), Curveball max blind 1.5 s,
Paranoia nearsight 2 s; Leer applies nearsight for 1.6 s once it arrives (0.4 s windup). The offline client already used
2.25 / 2.25 / 1.5 / 2 s; the trusted server blinded every generic flash for 1.5 s and Curveball for 1.1 s, and kept Leer
up for 2.5 s from the cast (2.3 s of nearsight after its 0.2 s fuse).

- Server: `abilities.js FLASH_BLIND = {Breach: 2.25, Skye: 2.25, Omen: 2}` on the flash effect (`e.blind`, the tick already
  read it; anyone else stays 1.5 s), `DEV.curveball.blind` 1.1 -> 1.5, Leer effect life `wf('leer') + LEER.active` (1.6 s
  of nearsight after its fuse).
- Client: the player's Leer now ends `xWf('leer') + XLEER` (1.6 s) after the release (was 2 s, i.e. 1.8 s of nearsight).
- Guiding Light: flight-time scaling now modelled, see "Skye Guiding Light" below.
- Paranoia: now the wiki orb, see "Omen Paranoia" below (was a point flash with a facing check on the server and a
  14 m/s strip on the client).
- Tests: `server/test-abilities.js` (Flashpoint 2.25, Guiding Light 2.25; Leer `until - at` = 1.6 s),
  `server/test-ults.js` (Curveball blind > 1.1 and <= 1.5 s).

### Killjoy Nanoswarm (wiki.playvalorant.com/en-us/Nanoswarm, fetched 2026-10-25)

Wiki stats: radius 4.5 m; detection radius 5.25 m; activation windup 1 s total (0.5 s windup + 0.5 s damage delay); 45 ticks
of 1 per second, 180 total; duration 5 s. Was: server 4 m, 45/s from the trigger for 5 s (225); offline client (player and
bot Killjoy) 2.5 m, 45/s from the trigger for 5 s, bot swarms triggering on an enemy within 2.5 m.

- Server: `DEV.nanoswarm = {life: 120, active: 5, delay: 1, radius: 4.5, damage: 45}`; the trigger (C again) sets
  `until = +5 s`, `dmgAt = +1 s` and the 4.5 m radius; `tickDevices` burns only from `dmgAt` (4 s x 45 = 180).
- Client: `XNANO = {r: 4.5, det: 5.25, active: 5, delay: 1, dps: 45}` (asserted equal to the server): the player's swarm and
  bot Killjoy's (`XKN`, 10 Hz) burn 4.5 m only after the 1 s windup; bot swarms trigger on an enemy within 5.25 m; the disc
  is drawn at 4.5 m (`zoneGeo` 2.5 m x 1.8).
- Tests: `server/test-ults.js` (4.3 m burns / 4.7 m does not; nothing in the first 0.95 s, 45 by 2 s, still burning at 4.8 s,
  gone at 5.2 s), `work/test_ability_equip.cjs` (XNANO == DEV.nanoswarm; C triggers; no damage before 1 s; 4.3 m burns,
  4.7 m not; disc scale 1.8), `work/test_friendly_fire_offline.cjs` (ally pass wiring reads `XNANO.dps * dt`).

### Omen Paranoia (wiki.playvalorant.com/en-us/Paranoia, fetched 2026-10-25)

Wiki stats: an orb (missile) along the aim, 25 m travel at 20 m/s, 4.3 m radius, nearsight 2 s (vision radius 7.5 m),
friendly fire Yes. Was: server a point flash 1.6 m up with a facing check that blinded enemies 2 s; offline client a 5 x
2.4 m box moving 14 m/s for 2.2 s (31 m) that blinded bots within 1.2 m along / 2.8 m beside it.

- Server: `abilities.js PARANOIA = {speed: 20, range: 25, radius: 4.3, nearsight: 2}`; Q pushes a `paranoia` effect from
  the eye along the aim, `tickParanoia` sweeps the segment travelled each tick (so no tunnelling at low tick rates) and
  nearsights every unit but Omen within 4.3 m once (`nearsightUntil`, the same status Leer uses), with no line-of-sight
  or facing check; the effect ends at 25 m. Server bots have no nearsight model, so a nearsighted bot is held like a
  blinded one (`spike.js`, as the offline client's `b.blind`; this also applies to Leer now).
- Client: `XPAR = {speed: 20, range: 25, r: 4.3, ns: 2}`; the player's orb moves 20 m/s for 1.25 s and puts every bot
  and ally bot within 4.3 m of its path on `b.blind = 2` once each (bots have no nearsight model, as for Leer / Seekers).
- Tests: `server/test-abilities.js` (PARANOIA table; ally hit at 0.2 s, 10 m enemy not yet; hit by 0.45 s through a
  wall while facing away, 2 s, not blind; 4 m off the line at 20 m hit; 4.6 m off, 5 m past the end and Omen not; orb gone),
  `work/test_ability_equip.cjs` (XPAR == PARANOIA; same geometry offline with `los` forced false).

### Raze Boom Bot (wiki.playvalorant.com/en-us/Boom_Bot, fetched 2026-10-25)

Wiki stats: duration 5 s (includes the 0.7 s deploy), max detection cone distance 15 m, explodes within 2.5 m of its
target, radii 2 m inner / 6 m outer, damage 30 - 80 (minimum at the outer radius, maximum inside the inner one), not on
allies. Was: server 10 m sight, 1.2 m trigger, flat 125 in 3 m; offline client 8 m sight, 1.2 m trigger, flat 80 in 1.5 m,
10 s life.

- Server: `DEV.boombot = {life: 5, speed: 6, sight: 15, trigger: 2.5, damage: 80, min: 30, inner: 2, radius: 6}`,
  `bbDamage(d)` = 80 inside 2 m, linear to 30 at 6 m, 0 beyond; each enemy in 6 m with line of sight takes it by distance.
- Client: `XBB` (same table) and `xBbDmg`; the player's and bot Raze's bot (`RS.bb`) lock within 15 m, explode within
  2.5 m (`xBbBlast`: the locked target always, anyone else of the owner's targets in 6 m with line of sight, by distance;
  never allies) and last 5 s.
- Not modelled: the 0.6 s windup between the trigger and the blast, the 60 HP bot that enemies can shoot, the cone shape of
  the detection (both sides use a 15 m circle with line of sight).
- Tests: `server/test-ults.js` (bbDamage table; 73.75 - 80 to the hunted foe; lock at 13.4 m; falloff to a second foe;
  none at ~10 m), `work/test_ability_equip.cjs` (XBB == DEV.boombot, xBbDmg table, the same lock / falloff offline).

### Skye Trailblazer (wiki.playvalorant.com/en-us/Trailblazer, fetched 2026-10-25)

Wiki stats: duration 6 s, explosion radius 3.5 m, concuss 4 s at the centre falling to 2.5 s at the edge, 30 damage when
the leap bites an enemy. Was: server 3 s, 4 m, flat 2.5 s; offline client 6 s, 3 m, flat 2 s.

- Server: `DEV.trail = {life: 6, speed: 9, trigger: 2, concuss: 4, minConcuss: 2.5, radius: 3.5}`, `tbConcuss(d)` linear
  from 4 s (centre) to 2.5 s (3.5 m); concuss and slow per enemy by its distance from the blast.
- Client: `XTB = {life: 6, r: 3.5, max: 4, min: 2.5}`, `xTbCnc(d)`; the player's leap (`tbLeap`) concusses / blinds each
  bot in 3.5 m by distance (bots have no concuss model beyond `b.cnc` / `b.blind`).
- Not modelled: the 30-damage bite, the 22.5 m vision radius.
- Tests: `server/test-ults.js` (tbConcuss table, 6 s; the closer foe concussed longer; 4 m from the blast untouched),
  `work/test_ability_equip.cjs` (XTB == DEV.trail; leap lands 4 m ahead: 4 s at the spot, 2.71 s at 3 m, none at 3.8 m).

### Breach Rolling Thunder (wiki.playvalorant.com/en-us/Rolling_Thunder, fetched 2026-10-25)

Wiki stats: area 32 m long x 18 m wide, 8 m between Breach and the area (patch: "Spawn location from Breach increased 0 >>>
8 meters", cone changed to a line), concuss 4 s, through walls. Was: server an 18 m cone (30 degree half-angle) from Breach
with a 6 s concuss; offline client a 32 m, 0.72 rad half-angle cone, 4 s.

- Server: `ULT.quake = {delay, near: 8, length: 32, width: 18, concuss: 4}`; the quake tick concusses / slows each enemy
  with `8 < ahead < 40` and `|aside| < 9` (height band 4 m unchanged).
- Client: `XRT2 = {near: 8, len: 32, w: 18, cnc: 4}` (asserted equal); `bcCone` uses the same strip and draws an 18 x 32 m
  box from 8 m ahead.
- Not changed: offline bot Breach's ult stays the generic 5 m burst at its target; the 0.6 s knock-up / ticks are not modelled.
- Tests: `server/test-ults.js` (strip table; 12 m ahead through a wall concussed <= 4 s, 38 m ahead / 8.5 m aside hit;
  5 m ahead, 9.6 m aside, 41 m ahead, behind, ally spared), `work/test_ability_equip.cjs` (XRT2 == ULT.quake, same cases offline).

### Sova Hunter's Fury (wiki.playvalorant.com/en-us/Hunter's_Fury, fetched 2026-10-25)

Wiki stats: 3 charges; fire rate 1 every 2.125 s (including the 1 s charge windup); max duration 6 s (not including the 0.8 s
equip); a 66 m long cylinder of 1.76 m radius through walls; 80 damage; reveal 1 s; allies take reduced damage, no reveal.
Was: server 0.9 m, 2 s reveal, 6.5 s window, an automatic blast every 2 s plus an early recast after 0.9 s; offline client
80 m x 0.9 m, a blast every 0.9 s, no reveal, charges never expired; bot Sova three parallel 60 m x 1.1 m beams at once.

- Server: `ULT.fury = {blasts: 3, cycle: 2.125, window: 6, range: 66, width: 1.76, damage: 80, reveal: 1}`. The first blast
  leaves on the cast, the others only on FIRE (the X recast), no sooner than 2.125 s after the previous one; no automatic
  blasts (wiki: "Sova can fire in a direction to expend a charge"); unfired charges are lost 6 s after the cast or on death.
- Client: `XHFU` (same table, asserted equal; `XHF` is taken by an unrelated hit-feedback block). `jBeam`: 66 m x 1.76 m,
  `J.cd.x` 2.125 s, enemies hit revealed 1 s (`xHfRv`, added to `J.rv`), `J.hfT` drops the charges 6 s after the cast or on
  death. Bot Sova (offline, both teams): three blasts 2.125 s apart within the 6 s, each re-aimed at the nearest enemy (66 m x
  1.76 m, 80); bots hit by an ally Sova are revealed to the player for 1 s, a player hit by an enemy Sova gets the enemy
  reveal warning (bots home in, as for an enemy Recon Bolt); pending blasts stop on the bot's death or a round clear (`XHFU.g`).
- Not modelled: the 1 s per-charge windup as a separate delay (the 2.125 s cycle includes it), the self-knockback / air hover.
- Tests: `server/test-ults.js` (table; blast 1 through a wall; reveal on at 0.95 s, off at 1.05 s; recast refused at 2.05 s,
  no auto blast, accepted at 2.25 s; the last charge waits for FIRE and follows the aim; 1.6 m off hit / 1.9 m missed;
  charges kept to 5.9 s and lost by 6.05 s), `work/test_ability_equip.cjs` (XHFU == ULT.fury; 1.4 m off hit + revealed 1 s,
  2 m missed, no blast before 2.125 s, reveal over by 1.1 s, second blast after 2.125 s, charge lost by 6 s; bot Sova 20 m /
  40 m 1.5 m off hit + revealed, 2 m missed, blasts at 0 / 2.125 / 4.25 s only; enemy bot hits the player; a round clear
  cancels pending blasts). Also fixes the Paranoia section's `los` restore (it left `los` undefined, freezing every later
  ability tick in that test run).

### Raze Showstopper splash (wiki.playvalorant.com/en-us/Showstopper, fetched 2026-10-25)

Wiki stats: radii 4 m inner / 7 m outer, damage 30 - 150 ("anything within the inner radius will take full damage", falling
to the minimum at the very edge). Was: server inner 3 m, linear to 0 at 7 m; offline client `150 x max(0.35, 1 - d / 7)`.

- Server: `ULT.rocket {inner: 4, outer: 7, damage: 150, min: 30}`, `ssDamage(r)` = 150 inside 4 m, linear to 30 at 7 m, 0 beyond.
- Client: `XSS` (same values, asserted equal) / `xSsDmg(d)` in `rsBoom` for the player's rocket and its ally pass.
- Not changed: offline bot Raze's ult stays the generic 5 m / 150 burst (`xAoe`).
- Tests: `server/test-ults.js` (table; ssDamage 150 / 150 / 150 / 90 / 0 at 0 / 3.5 / 4 / 5.5 / 7 m, ~30 at the edge),
  `work/test_ability_equip.cjs` (XSS == ULT.rocket, xSsDmg table, rsBoom 150 / 90 / 0 at 3.5 / 5.5 / 7.5 m).

### Killjoy Turret fire (wiki.playvalorant.com/en-us/Turret, fetched 2026-10-25)

Wiki stats: windup (lock) 0.75 s; bursts of three shots, 0.083 s between shots, 1 s between bursts, overall cycle 1.25 s;
damage per shot 8 within 20 m, 6 from 20 to 35 m, 4 beyond; 50 % tagging slow. Was: server 12 every 0.7 s, no windup;
offline client 10 every 0.35 s within 25 m, no windup.

- Server: `DEV.turret {windup: .75, shots: 3, gap: .083, cycle: 1.25, near: 20, mid: 35, dmg: [8, 6, 4]}`, `turretDamage(d)`;
  the turret effect locks on its nearest visible enemy in the 180 degree arc, waits the windup, then fires bursts starting
  every 1.25 s; losing the target re-arms the windup. Each hit still tags 0.5 s.
- Client: `XTUR` (same values, asserted equal) / `xTurDmg` in the `J.tur` tick (same state machine); sight range 25 -> 30 m
  to match the server's 30 m.
- Not changed: 180 degree arc (wiki detection cone 100 degrees), 2.7 s deploy, 40 m proximity deactivation, 20 s life on the
  server; range tiers past 30 m never apply on either side (30 m sight).
- Tests: `server/test-ults.js` (table; tiers; 10 m foe: 0 / 24 / 24 / 48 / 48 / 72 at 0.7 / 1.3 / 1.9 / 2.5 / 3.1 / 3.7 s;
  25 m: 6 a shot), `work/test_ability_equip.cjs` (XTUR == DEV.turret, tiers, 10 m bot 0 / 24 / 24 / 48 at 0.7 / 1.3 / 1.9 / 2.5 s).

### Skye Guiding Light (wiki.playvalorant.com/en-us/Guiding_Light, fetched 2026-10-25)

Wiki stats: hawk 18 m/s, duration 2 s, "flash max duration windup time" 0.75 s, max flash duration 1 - 2.25 s based on that
windup; the hawk flashes on reactivation or at the end of its duration. Was: 2.25 s on every pop on both sides; the offline
hawk flew 2.5 s and faded without a flash.

- Server: `GUIDING = {speed: 18, min: 1, max: 2.25, ramp: .75}`, `glBlind(t)` = 1 + 1.25 x min(1, t / 0.75). The trusted
  server has no hawk flight: its stand-in flash pops at the aim point (up to 14 m, short of a wall), so the blind is the one a
  hawk gets after flying there (`distance / 18` s): 14 m and beyond the full 2.25 s, 5 m ~1.46 s. Breach / Omen unchanged.
- Client: `XGL = {speed: 18, life: 2, min: 1, max: 2.25, ramp: 0.75}` (asserted equal to GUIDING), `xGlBlind`; `hkPop` blinds by
  the hawk's flight time; the hawk flies 2 s and then flashes (was 2.5 s and a silent fade).
- Not modelled: the 0.3 s activation windup before the flash, steering the hawk with held FIRE; offline bot Skye still throws
  the shared bot flash orb.
- Tests: `server/test-abilities.js` (table; glBlind ramp; a wall at 5.5 m -> blind glBlind(5/18) ~1.46; 14 m -> 2.25;
  Flashpoint still 2.25), `work/test_ability_equip.cjs` (XGL == GUIDING; ramp table; popped after 0.25 s -> 1.42 s; flashes at
  the end of the flight with ~2.25 s).

### Sova Owl Drone dart and Cypher Spycam dart (wiki.playvalorant.com/en-us/Owl_Drone, /Spycam, fetched 2026-10-25)

Wiki stats: Owl Drone dart reveals its target in 2 pings of 0.6 s, the first 1.6 s after impact and the second 1.2 s after the
first ends (3.4 s). Spycam: max deploy distance 20 m, 1.15 s deploy; its dart reveals the target 1 time every 2 s until it is
removed. Was: server Owl Drone and Spycam both the generic 20 m recon pulse (0.9 / 2.5 s); offline client Owl dart a flat 5 s
reveal at the tag, Spycam dart a flat 3 s reveal.

- Server: `DEV.owl = {pings: [1.6, 3.4], reveal: .6, radius: 20}`, `DEV.spycam = {deploy: 1.15, every: 2, pings: 5, reveal: 1,
  radius: 20}`. Stand-in (the trusted server has no flying drone / camera): a `dart` effect tags the nearest enemy in sight
  within 20 m of the aim point (Owl at once, Spycam once deployed after 1.15 s; Spycam placed at most 20 m away) and reveals
  it on each ping (a tag: no line of sight needed afterwards). It ends with its target's death, or misses when no enemy is in
  sight.
- Client: `XOWL = {pings: [1.6, 3.4], reveal: 0.6}`, `XSPY = {every: 2, pings: 5, reveal: 1}` (asserted equal to the server);
  `xDartPings(b, at, rv)` schedules the pings through `xHfRv` (adds to a running reveal), keyed to the round token `XRCN.g`
  and skipped once the target is dead. `drTag` (Owl dart) and `cyDart` (Spycam dart) use it.
- Not modelled: removing the Spycam dart (5 pings here, project value), the drone / camera flight itself on the server.
- Tests: `server/test-ults.js` (tables; Owl: not before 1.6 s, on at 1.7, off at 2.35, on at 3.5, off at 4.1, far foe not tagged;
  Spycam: off at 1.05, on at 1.25, off at 2.3, on at 3.25 and 9.25, done by 10.5; ends with its target; misses behind a wall),
  `work/test_ability_equip.cjs` (XOWL / XSPY == server; Owl timeline false / true / false / true / false at 1.5 / 1.7 / 2.35 / 3.5 /
  4.15 s; Spycam pings at 0.1 / 2.1 / 8.1 s, off at 1.15 / 9.3 s; a round clear cancels pending pings).
