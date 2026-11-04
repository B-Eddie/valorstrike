# The 18 added agents: mechanics fidelity and known gaps (2026-11-03)

Roster 12 -> 30, per patch 13.09 (2026-10-27). Sources:
- Roster (30/30 validated): https://playvalorant.com/en-us/agents/ (official listing) and every
  individual official page https://playvalorant.com/en-us/agents/<name>/ for all 18 additions;
  cross-checked against https://valorant-api.com/v1/agents?isPlayableCharacter=true and
  https://wiki.playvalorant.com/en-us/Agents ("total of 30 playable agents"), https://valoranthub.com/agents.
- Ability names/slots validated against official agent pages (spot-confirmed: Meddle, Refract,
  Lightspeed, Saturate, Convergent Paths, Stealth Drone) and wiki.playvalorant.com ability pages.
- Costs / charges / ult points: per-ability wiki pages (fetched 2026-11-03), cited per constant
  in server/src/agents18.js (A18 table) and server/src/kits.json.
- Models/portraits: Kingdom Archives (URLs recorded in models/valorant/SOURCES.md and the
  manifest sources list).

## Faithful core mechanics (implemented, smoke-verified)
- Iso Kill Contract: both combatants teleport into a walled cell; only the duel pair can damage
  each other; 13 s or a kill ends it; both return to pre-ult positions.
- Neon High Gear: ALT FIRE slide, 1 charge (wiki v9.11: 2 >>> 1), 2-kill reset; the slide ends High Gear and Neon can fire during it (v8.11: crouch-walking accuracy, no air accuracy).
- KAY/O NULL/cmd: lethal damage during the ult downs him; 15 s bleedout, ally USE channel (5 s)
  revives at 100 HP.
- Deadlock Annihilate: 600 HP cocoon teammates can shoot to free the captive; captive is pulled
  toward Deadlock; death at the end of the pull; the wire snaps if Deadlock dies or the link breaks.
- Astra star pool (2/round, 150 each, max 4), Viper/Neon fuel, Gekko globule reclaim (10 s),
  signature 2-kill resets (Iso Double Tap, Waylay Refract, Yoru Gatecrash), Viper cloud/screen/pit
  toggles, Vyse rose recast, Veto crosscut recast teleport, Waylay refract return, Yoru gatecrash
  recast, Clove Not Dead Yet cast-from-death revive channel, Viper's Pit decay+nearsight+self-heal.

## Known gaps (deviations from the live game - do not present as correct)
1. KAY/O's downed body is not shootable; the bleedout timer is the only enemy counterplay.
   (Corpse damage would need a targetable non-alive body in both fire loops.)
2. Yoru Gatecrash INTERACT fake-out teleport is not modelled (recast always teleports).
3. Hush Bassquake deafen is not modelled (the project has no per-status audio bus).
4. Iso's duel cell forms at his ground position instead of a separate arena volume.
5. Veto Interceptor removes enemy projectile effects in radius instead of physically swatting them.
6. Neon slide: a straight 0.3 s dash (wiki: 0.6 s / 7 m), no crouch-height hitbox change; firing during it works (faithful to v8.11+).
7. Astra casts from the ground with crosshair placement, not the Astral Form top-down view.
8. Miks Harmonize picks the nearest ally rather than a crosshair target.
9. Tejo Guided Salvo / Armageddon use crosshair placement, not the tactical map.
10. Yoru Dimensional Drift invisibility is a client-render concern; server-side he is invulnerable
    but still positionally visible to enemies (no fog hook yet).


## Online rendering (added 2026-11-03, second pass)

Server snapshot (spike.js) now serializes every A18_NET_KINDS effect row (id/kind/p/r/tl/yaw) plus Viper's
Toxic Screen as a wall row, and the client (AGENTS 18 ONLINE block, work/agents18_runtime.js) renders each
kind with its own shape/color following the offline casts: fields as clouds, zones/pulses as rings, walls
(divide/conting/fastlane/shear/tscreen) as boxes with server yaw, devices (emitter/ceptor/rose/sdrone/xcut/
mesh) and movers (decoy/seeker/dizzy/anni cocoon) following the server position each snapshot. The rs status
block drives HUD chips: SUPPRESSED / JAMMED / HINDERED (also client slow prediction) / HASTE / STIM /
DECAYING HP. Coverage: work/test_agents18_net.cjs. Remaining online limits: KAY/O's downed body uses the
normal prone render (no dedicated pose), Iso's duel arena is the four barrier walls at his position.
