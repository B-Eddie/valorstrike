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


## Test environment note (2026-11-03)
The "missing world asset" test failures were unbuilt collision worlds, not missing repo sources: `npm run build:worlds` (server/build-all.cjs) generates server/public/worlds/<map>/ from the repo's map data for all six maps. After building, test-placement/test-fog/test-network/test-two-player/test-local-cluster-fog and the rest of the chain run. test-bot-brain's "bot buys vary" assertion fails on origin/main too (pre-existing, unrelated to the roster work).

## Closed 2026-11-03 (Astral Form + Tejo tactical-map targeting pass)
- **Astra Astral Form is the map-placement view** (wiki: stars are placed through the Astral Form map): X with the ult ready opens the shared xTac overlay (the Omen From the Shadows tactical map) as "Astral Form". C / Q / E arm Gravity Well / Nova Pulse / Nebula while it is up; each map click places the armed star AT THE CLICKED POINT (one star each, the map stays open); X inside the map arms Cosmic Divide: two clicks set both ends and spend the ult. Esc / the map's own cancel exits (ult kept), and firing is blocked while in the form. Server: human-only branches before the charge gate - x enters/exits Astral Form (exit without placing spends nothing), c/q/e with m.p place the star at the picked point (+/-200 clamp), x with four numbers builds the divide wall from both ends (midpoint/span/yaw). Offline mirrors the same casts locally.
- **Tejo Guided Salvo and Armageddon pick on the tactical map** (wiki): E opens the map - two clicks fire both salvos at the picked points for one charge, E again after one click launches a single salvo; X opens Armageddon and the click sets its origin with the stripe marching from Tejo through the pick. Server: e with m.p (2 or 4 numbers) drops up to two strikes on one charge; x with m.p sets the armag origin with the yaw from Tejo through the pick.
- Online the picked points ride the cast message as m.p; the client spends nothing itself (server-authoritative). On legacy (non-native) maps without the nav projection the casts keep the previous crosshair/self model.
- Removed Astra and Tejo from the constraints list below; Iso's separate duel arena remains under investigation.

## Closed 2026-11-03 (Iso Kill Contract pocket arena)
- **The duel now runs in a real pocket arena** (wiki Kill_Contract: both combatants are pulled into a separate arena for the 13 s duel). No map carries arena geometry and the world loader ships one map per room, so the arena is analytic (server/src/arena.js + the client mirror in work/agents18_runtime.js): a flat 30 x 30 platform with 4 m energy walls and two cover blocks at x = 10000, simultaneous duels stacking a cell every 100. arenaWrap routes the world queries a duel touches (ground / blocked / leash / ray / rayN / ceiling / plantAt) by position; everything inside the match maps reaches the match world untouched, so no map data changes.
- Both combatants teleport to the cell (Iso -4, the target +4), the caught duelist keeps the wiki reveal + suppress-on-entry, only the pair can trade damage (unchanged), and both return to their exact spots when it ends. Simultaneous duels get separate cells with per-cell effect cleanup. Out-of-bounds exempts duelists; a bot in a duel steers straight at its foe (the sealed cell has no nav).
- Online: the server sends a 'duel' fx row per cell and the client renders the arena shell (platform, glowing walls, cover) while the row lives; movement prediction and reconciliation work in the cell because the page's blocked / groundAt / los globals are wrapped with the same analytic dispatch (offline sim uses them too). Offline mirrors the same teleport + shell + return.
- Verified: server test-agents18.js (cell teleport, wall/floor/cover rays, plant gate, oobKill exemption, two simultaneous duels, return) and work/test_iso_arena.cjs on the real page (teleport, shell renders, walls stop movement, cover breaks sight, return after 13 s, online row renders/drops the shell). The Iso constraint entry above is retired - no mechanics from the faithful-mechanics list remain as documented constraints.
