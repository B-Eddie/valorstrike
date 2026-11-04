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

## Closed 2026-11-04 (Armageddon per-segment chain)
Tejo Armageddon is now the wiki chain (wiki.playvalorant.com/en-us/Armageddon, fetched 2026-11-04): 3.08 s windup, 16 segments x 2 m (32 m) x 12 m wide, segment i starts 0.25 s after segment i-1 and detonates 4 times at 0.25 s for 60 each (overlapping segments stack). Server agents18.js (was one instant 40 m strip for 120) with test-agents18.js timing/width/behind assertions; offline mirror `armagchain` + online fx row rendered as 16 lit segment boxes (agents18_runtime.js, a18ArmagGroup), test work/test_armageddon_chain.cjs. Not modelled: friendly fire/self damage (wiki: affects allies) - enemies only.
Still simplified (generic shapes): see earlier list; this replaces the "sweeping rectangular fire front" item.
Update 2026-11-04: Armageddon now also damages allies (one third, the shared abilityDamage ally rule used project-wide; the wiki gives no separate ally figure) and self (full), server + offline; work/browser_tejo_armag.cjs captures the chain on the real page (age 2.0 s: segments 5-8 lit, rest dim; screenshot checked for orange pixels, full visual review pending).
Update 2026-11-04 (visuals): Armageddon's slab boxes replaced by a thin ground outline of the 12 m x 32 m path plus a fireball + shock ring (a18ArmagBoom, 2 per detonation) per segment tick, offline and from the online fx row's time left. Captured and viewed on the real page (light mode, so the scene is sparse); still stylized primitives, not Riot's VFX. Ally damage 1/3 is the general rule on wiki.playvalorant.com/en-us/Abilities ("abilities that damage allies deal 1/3 damage"); the Armageddon page only says it affects allies/self, and the self-damage multiplier is not sourced (we apply full).

## 2026-11-04 (Tejo Guided Salvo) - partial, ledger
Server + offline + online now follow wiki.playvalorant.com/en-us/Guided_Salvo: 1.25 s windup after landing, 3 pulses 0.8 s apart, 65 inside 2.5 m falling to 50 at 4.5 m, affects allies (1/3) and self (full). Online row (kind salvo) carries `w` (seconds to first pulse); client draws outer/inner ground rings and a fireball per pulse (tests: server test-agents18, work/test_agents18_net.cjs, test_astra_tejo_map.cjs, browser capture work/browser_tejo_armag.cjs).
OPEN gaps: missile flight speed not on the wiki (30 m/s placeholder) and no missile flight visual; fireball is a stylized primitive, not Riot's VFX; self-damage multiplier unsourced; FRAG/ment, and generic cloud/wall visuals for the other agents still generic.

## 2026-11-04 two-browser measurement (box: 2 GB RAM)
Measured with ps/free: one rendered page at the menu with full assets = renderer 1057 MB (88 MB of agent models + movement clips loaded); with agent models/movement/lobby art aborted (REDUCED=1 in work/two-browser/tb.cjs) = renderer ~335 MB. Solo match start (lotus, REDUCED) peaks renderer ~692 MB, min box avail 475 MB, game reached in ~9 s. Two pages, same settings: both reach the room, then free memory falls to 18-83 MB at match start and the page is closed (OOM) - also with NOTEX (map textures / geometry aborted on page B). So the stall is memory exhaustion, not a game/harness deadlock (a solo start completes). Two rendered pages need a host with more RAM or a lighter map build; any run here is reduced scope.
Update (SHARECTX): both pages in ONE browser context (one renderer process, per-page in-memory session token) got Clove vs Jett through match start on lotus with reduced assets (min box free 61 MB); `work/two-browser/tb.cjs` env: SHARECTX=1, REDUCED=1 (no agent models/movement/lobby art), NOTEX=A|B|AB (no map textures), SOLO=1 (one page), plus --no-zygote/NetworkServiceInProcess flags. It is marginal: the same setup with Tejo vs Jett and several flag variants was OOM-killed at match start (free memory 23-34 MB). Solo in-game page: JS heap 167 MB, light mode loads 0 map meshes (collision 8.8 MB only), renderer RSS ~700 MB with 35 shader programs / 92 geometries / 47 textures, i.e. most of it is not map data (suspect SwiftShader program JIT + render targets). Next lever: reduce shader programs / render targets for the harness (low-quality path), not the map.
Scenario: work/two-browser/scen_tejo_duel.cjs (A=Tejo, B=Jett, B placed 7 m ahead, Q thrown, both pages captured). Not yet passing end to end.
Footprint probe 2026-11-04: in game (solo, light, REDUCED) renderer 770 MB / gpu 289 MB. Three WebGL contexts exist (main, hidden lobby xAgent, hidden xAgCv); losing the two hidden ones saves nothing measurable, so they are not the cause. JS heap 167 MB. Next probes: CDP HeapProfiler/Memory counters for the ~260 MB non-JS part, shader program count (35), image/texture CPU copies.
Footprint probe 2 (2026-11-04 09:37): JS heap after GC only 37 MB; 106 textures ~89 MB RGBA but capping MAX_TEXTURE_SIZE to 256 (TEXCAP=256 in tb.cjs) did not change renderer RSS (769 MB); one web worker; audio buffers 0. So the ~430 MB renderer growth at match start is not JS, textures, map data or hidden WebGL contexts. Next: Chrome tracing / `--enable-memory-infra` or bisect by disabling game subsystems (effects pools, hit-impact vendor, valorant-feel) in the harness.

## 2026-11-04 KAY/O FRAG/ment (wiki FRAG/ment) - partial
Was: r5, flat 40, enemies only. Now server+offline+online: 0.5 s windup, 4 ticks 1 s apart, inner 1 m = 60, outer 4 m falls to 25 at the edge, allies (shared 1/3 rule) and self; online row carries `w`, client draws rings + a fireball per tick. Tests: server test-agents18 (windup, 60 / 42.5 / 25 / none, ally reduced, stops after 4), test_agents18_net, capture work/browser_kayo_frag.cjs (viewed: same stylized orb + rings as Salvo).
OPEN: projectile throw arc / sticking-to-terrain visual (fragment is not drawn in flight), underhand alt-fire, damage to non-player map objects/Fade Prowler, wiki 'Yes (damage reduced)' ally figure is the project 1/3 rule (self multiplier unsourced), VFX are primitives not Riot's.
