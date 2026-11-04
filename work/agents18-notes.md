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


## Closed 2026-11-03 (wiki pass 2)
- **Miks Bassquake**: now full wiki spec (Bassquake page, fetched 2026-11-03): 40m range, 46° cone, 5m knockback, 8s slow AND 8s deafen. Deafen is modeled as a full master-mix duck for the duration (server sends `deaf` in rs status; client shows a DEAFENED chip and ducks audio). No per-source muffling bus exists in the sound engine, so a full duck is the closest faithful model.
- **KAY/O NULL/cmd downed core**: the downed core is shootable per wiki (850 HP; destroyed => death with kill credit to the shooter). Revive is the wiki 2-step: 1.5s Stabilization + 1.55s reboot (v10.06) = 3.05s channel, and channeling pauses the 15s bleedout countdown (stabilize pauses the countdown per wiki).

## Closed 2026-11-03 (Gatecrash + online routing pass)
- **Online human casts for the 18 now reach the server**: the client's a18 key wrapper ran casts locally in every mode; in a netgame it now sends {t:'ab',k} like the other agents, so server-side kits (and the fx rows every client renders) drive the 18 online.
- **Recast/toggle charge-gate fix (systemic)**: the charge gate ran before the recast/toggle branches, so once Viper/Waylay/Yoru/Veto/Vyse spent their charge on the initial cast, the toggle/recast was unreachable. The no-spend recast branches now run before the gate (they do their own accounting).
- **Yoru Gatecrash (wiki)**: recast teleports on the 1.2 s timing (0.5 s windup + 0.7 s arrival, pendingTeleport), and USE (F, m.fk) triggers the fake teleport: same audio cue, no move, the anchor survives, and a 30 s decal (v4.04) marks the fake online (gatefake fx row) and offline.
- Still open (documented constraints): Iso duel cell-at-spot vs separate arena geometry; Astra ground-cast vs Astral Form view; Tejo crosshair vs tac-map UI; Yoru drift enemy-invisibility is client-render only (driftUntil is in the rs copy list, but remote-avatar hiding is not wired).

## Closed 2026-11-03 (Dimensional Drift pass)
- **Yoru Dimensional Drift is now unseen by enemies online via the fog of war** (server/src/fog.js): sight, 3 m proximity and reveals never mark a drifting unit to enemy groups; his running footsteps are heard within 15 m (wiki update history) instead of the usual 30; cast audio cues still carry; the drifter still sees out; teammates always see him (fog is per team). The existing fogRow mechanism ([22]=1) already parks hidden enemies off screen client-side, so no codec change was needed. Offline, bots get no player target while drifting (same exclusion as Reyna's Dismiss) and the hurt wrapper already blocked damage.
- **No weapons in drift** (wiki): server fire() gate and the offline shoot() gate both refuse while driftUntil / J.a18.drift is up.

## Genuine technical constraints (for a user decision, per the faithful-mechanics rule)
These three need UI/geometry the engine does not have. Each lists the constraint and the smallest faithful alternative; the current build keeps the ground-cast model until decided.
- **Iso Kill Contract arena**: real duel teleports both into a separate floating arena. Constraint: the maps have no arena geometry and the world loader ships one map's nav/collision; building a second pocket map is new content, not wiring. Smallest faithful alternative: keep the current walled 1v1 cell at the target's position (both locked in, outsiders locked out, both return after) - already implemented and tested.
- **Astra Astral Form**: real Astra enters a top-down astral view to place stars anywhere. Constraint: the renderer has no second camera mode or map-wide placement UI; a tactical top-down camera + click-to-place is a new UI system. Smallest faithful alternative: stars placed at the aim point within range (current), with the 2-star/round economy already faithful.
- **Tejo Guided Salvo tac-map**: real Tejo picks two points on a tactical map. Constraint: same missing tac-map UI as Astra. Smallest faithful alternative: crosshair-targeted salvo at the aim point (current), with the two-strike wiki timing/damage already faithful.

## Test environment note (2026-11-03)
The "missing world asset" test failures were unbuilt collision worlds, not missing repo sources: `npm run build:worlds` (server/build-all.cjs) generates server/public/worlds/<map>/ from the repo's map data for all six maps. After building, test-placement/test-fog/test-network/test-two-player/test-local-cluster-fog and the rest of the chain run. test-bot-brain's "bot buys vary" assertion fails on origin/main too (pre-existing, unrelated to the roster work).
