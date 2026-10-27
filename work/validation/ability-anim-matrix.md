# Ability animation matrix (lane abilanim, 2026-10-27)

User: "some agents' abilities don't have animations" (no specific agents named yet). Every agent x C / Q / E / X audited headless
(no browser): `work/abil_anim_audit.cjs` (offline page) and `ONLINE=1 work/abil_anim_audit.cjs` (page <-> in-process server),
regression `work/test_ability_anim.cjs` (real Jett / Breach / Sage / Raze TP rigs, real FP rigs, offline page 12 x 4, online
server-cast keys). Fix: `work/ability_anim_runtime.js` (ABILITY ANIM block, installed last by `work/install_valorant.py`).

Legend. FP = own first-person view. TP = what other players / spectators / bots see.
FP: `eq` agent's ability arms, equip -> idle -> cast clip (own authored or borrowed archetype); `quick` quick-cast clip;
`gun` held ult/ability gun set; `--` NOTHING (gun viewmodel frozen / held).
TP BEFORE (all agents, all keys): one random generic one-shot (OverhandThrow or Spell_Simple_Shoot 50/50, untyped) on the
upper body with the gun still in the hand; the relay path (online / P2P observers) threw `ReferenceError: xEqType` (deleted in
f95aa9e) so the typed pick never ran; no held-ability pose at all (Blade Storm excepted).
TP AFTER: typed procedural cast pose (style below), gun holstered for the cast, exact hand-back, legs untouched.

| Agent | Key | Ability | FP offline before | FP online before | FP after | TP style after |
|---|---|---|---|---|---|---|
| Jett | C | Cloudburst | quick | quick | quick | throw (offline bots / relay; online: no server cast event, see limits) |
| Jett | Q | Updraft | quick | **--** | quick (online fixed) | buff |
| Jett | E | Tailwind | quick | **--** | quick (online fixed) | buff (offline bots; online: no cast event on first press) |
| Jett | X | Blade Storm | gun (Wushu set) | gun | unchanged | own Blade Storm pose (unchanged, ours) |
| Phoenix | C/Q/E | Blaze / Hot Hands / Curveball | eq | eq | eq | cast / throw / flick |
| Phoenix | X | Run It Back | quick | quick | quick | cast |
| Sova | C/Q/E/X | Owl Drone / Shock / Recon / Hunter's Fury | eq (bow) | eq | eq | gaunt / bow / bow / bow |
| Sage | C/Q/E/X | Barrier / Slow / Heal / Resurrection | eq | eq | eq | place / throw / cast / cast (Barrier online: client drops its cast event, see limits) |
| Reyna | C | Leer | eq | eq | eq | flick |
| Reyna | Q/E | Devour / Dismiss | quick (with a soul orb) | **--** | quick (online, orb in range) | buff |
| Reyna | X | Empress | quick | **--** | quick (online fixed) | buff |
| Omen | C/Q/E | Shrouded Step / Paranoia / Dark Cover | eq | eq | eq | cast |
| Omen | X | From the Shadows | **--** | **--** | orb drawn + held while picking, cast + hold through the channel | cast |
| Killjoy | C/Q/E/X | Nanoswarm / Alarmbot / Turret / Lockdown | eq | eq | eq | throw / place / place / place |
| Raze | C/Q/E | Boom Bot / Blast Pack / Paint Shells | eq | eq | eq | under / throw / throw |
| Raze | X | Showstopper | gun (own set) | gun | unchanged | cast |
| Skye | C | Regrowth | quick | **--** | quick (online fixed) | cast |
| Skye | Q/E/X | Trailblazer / Guiding Light / Seekers | quick / eq / eq | quick / eq / eq | unchanged | cast / flick / cast |
| Breach | C/Q/E/X | Aftershock / Flashpoint / Fault Line / Rolling Thunder | eq (Fault Line hold) | eq | eq | gaunt |
| Cypher | C/Q/E/X | Trapwire / Cyber Cage / Spycam / Neural Theft | eq | eq | eq | place / under / throw / throw |
| Chamber | C/E | Trademark / Rendezvous | eq (own clips) | eq | eq | place / place |
| Chamber | Q | Headhunter | gun (Destabilize set) | native Sheriff viewmodel (server swaps the gun) | unchanged | cast |
| Chamber | X | Tour De Force | gun | gun | unchanged | cast |

Offline bots: their ability casts (`xBUse` = a charge spent in the bot ability think) and ults (FEEL ult charge `XU.c` -> 0)
now trigger the typed TP pose; before, only bot casts that wrote a "Agent ▸ Ability" feed line got the random generic clip.

## Limits (open)
- No real browser / GPU check; poses judged on the node rigs + raster sheet `abilanim/tp-cast-styles-jett-after.jpg`.
- Online TP has no HELD-ability pose (remote player with an ability equipped but not yet thrown): the server does not know the
  client-side equip state. Needs a server change: client input field (equipped key + draw/ready/hold) -> unit -> snapshot row
  field (fog-hidden) -> page holds the cast style's wind-up pose with the gun holstered. Not done here (row [26] is taken by
  the spike-anim lane; would be [27] after it lands).
- Online TP with no server cast event: Jett Cloudburst (snapshot projectile only), Jett Tailwind first press, Sage Barrier Orb
  (server_runtime drops 'ac' Sage c). Offline / P2P get the pose.
- Chamber Headhunter online shows the native Sheriff viewmodel (offline: the authored Destabilize set).
- Quick casts reuse borrowed archetype clips (no authored Updraft / Tailwind / Empress FP clips ship).
