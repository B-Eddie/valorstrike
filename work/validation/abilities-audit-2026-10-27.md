# Abilities audit vs Valorant (lane-abilfix, 2026-10-27/28)

User: "abilities not right" (one ult asked for a map pick and no map showed). Scope: how every roster ability is *used*
(equip / instant, hold, recast, targeting, indicator, flight, timing) against the official wiki
(wiki.playvalorant.com/en-us/<Ability>; raw pages in `/workspace/work/qa/abilfix/pwiki/*.txt`, digest
`/workspace/work/qa/abilfix/wiki_digest.txt`). Where the wiki ability page and the latest official patch notes disagree, the patch
notes win (e.g. Guiding Light restock 50 s from patch 13.00; the wiki page still says 60). Numbers (damage, radii, durations,
costs) were already checked in `work/validation/abilities-parity.md` and the parity tests (`server/test-wiki-weapons.js`,
`test-parity-rules.js`, `test-values-game.js`, `work/test_ability_parity.cjs`); this audit re-checks the mechanics. Every fix has a
test that was red before it.

Legend: **FIXED** (this lane, commit), **OK** (matches; test that pins it), **GAP** (known difference, not fixed here).

Note: a sandbox reboot at ~05:10 UTC 2026-10-28 rolled the workspace back ~45 min. The lost items (Killjoy Turret ALT FIRE rotate / E swap,
Sage Barrier Orb rotate, Trapwire / Spycam / Leer / Breach surface indicators, Breach through-wall reach, the page-side Slow Orb throw) were REDONE
in lane-abilredo (on top of lane-abilfix): 89d820b, 5ca299f, c1b6d2a — rows below updated.

## Fixed in this lane

| Agent | Ability | Valorant | Was | Now | Commit / tests |
|---|---|---|---|---|---|
| Omen | X From the Shadows (target) | tactical map opens, click a spot | "pick a point on the map" with no map on native maps | full-screen tactical map, hover / valid / red, click to cast | 5def61f · `work/test_tactical_map.cjs` |
| Omen | X From the Shadows (cast) | 1.5 s windup rooted at origin, then 2.5 s rooted Shade at the target; a bullet on the Shade or X again sends him back, ult spent | walked freely 4 s, then teleported | rooted windup + Shade, shot / X cancel back to origin (server + page + online) | ccea587 · `server/test-shadows.js`, `work/test_fts_shade.cjs` |
| Jett | C Cloudburst | instant throw from the hand; HOLD to steer (curve); smoke on contact / after 2 s; 3.35 m | straight placement | curved hold-to-steer from the hand, cloud inside 3.35 m, touch hold | a127a64 · `work/test_cloudburst.cjs` |
| Killjoy / Sage / Chamber | Alarmbot 10 m, Turret 4.5 m, Barrier Orb 15 m, Trademark 12 m, Rendezvous 8.5 m | placed at the crosshair floor point, indicator (red = not viable), unviable refused | fixed spots in front / at feet, no indicator | crosshair placement + floor ring / wall line, refused off the playable area (server aimFloor + page xAimPlace) | 3fb62ac · `server/test-placement.js`, `work/test_place_indicator.cjs` |
| Cypher | Q Cyber Cage | INSTANT toss; lands and waits inactive; Q at it activates (no charge); no charge left: Q activates the one nearest the crosshair | equip + FIRE placed an active cage 15 m ahead | toss / land / activate on server (cageCast / tickCage) and page (cyCageKey), bots activate on landing, cleared each round | 49bce6d · `server/test-cage.js`, `work/test_cyber_cage.cjs`, `work/test_ability_equip.cjs` |
| Omen | E Dark Cover | 4.1 m marker; HOLD FIRE farther, HOLD ALT FIRE closer, through walls, max 80 m; smoke sinks to the floor below | smoke at the first wall within 30 m (server 40 m), 1.5-4 m high | marker (outline through walls), FIRE / ALT FIRE move it at 20 m/s, E or a FIRE tap casts; offline okKey uses the marker, online sends `m.dist`, server DARK places + sinks; bots keep the wall rule | 49bce6d · `server/test-darkcover.js`, `work/test_dark_cover.cjs` |
| Sage | Q Slow Orb (server) | thrown Class 3 projectile, detonates on horizontal terrain | field at once at the first wall within 14 m | server: shared Class 3 arc (`vendor/sova-bolt.cjs` `orb()`), drops off walls, field from where / when it lands (effect `at`, cast event `fl`). Offline page throw on the same arc since c1b6d2a (lane-abilredo) | 49bce6d, c1b6d2a · `server/test-sloworb.js`, `server/test-abilities.js`, `work/test_slow_orb.cjs` |

## Every roster ability

| Agent | Ability | Mechanic check | Status |
|---|---|---|---|
| Jett | C Cloudburst | instant, hold-steer, 2 s, 3.35 m | FIXED a127a64 |
| Jett | Q Updraft | instant, 5 m up | OK (`test_client_abilities`) |
| Jett | E Tailwind | 1 s windup, 7.5 s window, recast dashes 11 m / 0.45 s | OK (`test_tailwind_dash`, `server/test-ability-equip.js`) |
| Jett | X Blade Storm | 5 blades, FIRE single / ALT FIRE burst, refresh on kill | OK (`server/test-blades.js`, `test_blade_storm_tp`) |
| Phoenix | C Blaze | HOLD FIRE curves the wall with the mouse | GAP: wall is straight |
| Phoenix | Q Hot Hands | lobbed fireball, 4.5 m zone, heals Phoenix | OK (`server/test-ability-equip.js`) |
| Phoenix | E Curveball | FIRE curves left, ALT FIRE right, 0.6 s windup | OK (`test_client_abilities`, server `m.l`) |
| Phoenix | X Run It Back | 10 s, back to the marker | OK (`server/test-ults.js`) |
| Sova | C Owl Drone | fly the drone, FIRE dart | OK (`server/test-device-bodies.js`) |
| Sova | Q Shock Bolt / E Recon Bolt | HOLD FIRE charge, ALT FIRE bounces 0-2 | OK (`vendor/sova-bolt.cjs`) |
| Sova | X Hunter's Fury | 3 blasts through walls | OK (`server/test-ults.js`) |
| Sage | C Barrier Orb | placement 15 m; recast rotates 90°, ALT FIRE any angle, kept between equips | FIXED placement 3fb62ac; rotation 89d820b (C again 90/0°, HOLD ALT FIRE any angle with the view held, kept between equips, reset each round; online `m.by`) · `work/test_turret_rotate.cjs`, `server/test-turret-rotate.js` |
| Sage | Q Slow Orb | thrown Class 3, field on landing, 7 s, 50 % | FIXED server 49bce6d; page throw c1b6d2a (same `SovaBolt.orb()` arc, field where / when it lands) · `server/test-sloworb.js`, `work/test_slow_orb.cjs` |
| Sage | E Healing Orb | FIRE ally / ALT FIRE self, 100 HP over 5 s | OK |
| Sage | X Resurrection | 12 m, 2 s + 1.3 s | OK (`server/test-ults.js`) |
| Reyna | C Leer | eye 10 m ahead through terrain, pulled back out of it, indicator | FIXED 5ca299f (page `ryLeerSpot` + server `leerSpot`, eye marker in hand); flight OK · `work/test_surface_indicators.cjs`, `server/test-breach-wall.js` |
| Reyna | Q Devour / E Dismiss / X Empress | soul-orb casts | OK (`server/test-reyna.js`) |
| Omen | C Shrouded Step | 15 m at the crosshair floor, 1.2 s | OK (`test_omen_intent`) |
| Omen | Q Paranoia | 25 m through walls, nearsight | OK (`server/test-abilities.js`) |
| Omen | E Dark Cover | marker, FIRE / ALT FIRE move, 80 m, sinks | FIXED 49bce6d; GAP: phased-world view (optional) |
| Omen | X From the Shadows | tactical map, windup + Shade, cancel | FIXED 5def61f + ccea587 |
| Killjoy | C Nanoswarm | thrown, dormant, ACTIVATE detonates | OK (`server/test-device-bodies.js`) |
| Killjoy | Q Alarmbot | placement 10 m | FIXED 3fb62ac |
| Killjoy | E Turret | placement 4.5 m; ALT FIRE rotate / ACTIVATE swap (patch 12.04) | FIXED placement 3fb62ac; rotation 89d820b (HOLD ALT FIRE turns the turret not the view, E again swaps 180°, facing arrow on the ring, server uses `m.fy`) · `work/test_turret_rotate.cjs`, `server/test-turret-rotate.js`; GAP: fire rate after patch 13.00 not re-checked |
| Killjoy | X Lockdown | 13 s windup, 32.5 m | OK (`server/test-ults.js`) |
| Raze | C Boom Bot / Q Blast Pack | crawl / sticky recast | OK (`server/test-raze-utility.js`) |
| Raze | E Paint Shells | FIRE throw / ALT FIRE underhand lob | GAP: no ALT FIRE lob |
| Raze | X Showstopper | one rocket | OK (`server/test-ults.js`) |
| Skye | C Regrowth | HOLD FIRE channels | GAP: toggle |
| Skye | Q Trailblazer | possess and steer the dog | GAP: click-to-leap |
| Skye | E Guiding Light / X Seekers | steer + recast flash / 3 seekers | OK |
| Breach | C Aftershock / Q Flashpoint | through the wall under the crosshair, 35 m deploy / 10 m penetration, indicator | FIXED 5ca299f (page `bcWall` / server `breachWall`: first wall ≤35 m, through ≤10 m at Breach's floor, far side; humans refused at open air / too far / too thick, bots keep the aim point; near-face + far-side rings) · `server/test-breach-wall.js`, `work/test_surface_indicators.cjs` |
| Breach | E Fault Line / X Rolling Thunder | HOLD extends 8→56 m / cone | OK |
| Cypher | C Trapwire | 20 m deploy, wire ≤15 m, indicator | FIXED 5ca299f (`cyWireSpot`: walls both sides, ≤15 m wire, ≤20 m; teal / red line, red refused; bot wires unchanged) · `work/test_surface_indicators.cjs` |
| Cypher | Q Cyber Cage | toss / land / activate | FIXED 49bce6d |
| Cypher | E Spycam | vertical terrain ≤20 m, ≤4.5 m up, indicator | FIXED 5ca299f (`cyCamSpot`: wall normal, refused on floors / sky; disc on the wall) · `work/test_surface_indicators.cjs` |
| Cypher | X Neural Theft | 18 m corpse | OK |
| Chamber | C Trademark / E Rendezvous | crosshair placement 12 m / 8.5 m | FIXED 3fb62ac |
| Chamber | Q Headhunter / X Tour De Force | gun swaps | OK (`server/test-ults.js`) |

## Remaining gaps

1. ~~Redo (lost in the rollback)~~ DONE in lane-abilredo: 89d820b (Turret rotate / swap `m.fy`, Barrier rotate `m.by`), 5ca299f (Breach
   through-wall + Trapwire / Spycam / Leer / Breach indicators; wall-less Breach casts in open fixtures use the bot rule), c1b6d2a (page Slow Orb throw).
2. Phoenix Blaze hold-to-curve; Skye Regrowth hold-to-channel, Trailblazer steering; Raze Paint Shells ALT FIRE lob.
3. Omen Dark Cover phased-world view (optional).
4. Killjoy Turret fire rate after patch 13.00 (+50 %) vs the server's 1.25 s burst interval.
