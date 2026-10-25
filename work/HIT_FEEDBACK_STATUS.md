# Hit feedback — status (branch hark-hitfx, continuing d4d10ff)

Goal (user): "fix the doing-damage indicator — look up how Valorant does it and copy it."

## What Valorant does (sources)
- Riot, [The State of Hit Registration](https://playvalorant.com/en-us/news/dev/the-state-of-hit-registration/) and [Patch 1.07 — Hit impact VFX update](https://playvalorant.com/en-us/news/game-updates/valorant-patch-notes-1-07/):
  server-confirmed hit VFX spawn at the hit location **on the character and stay attached** (a chest hit moves down when the target crouches);
  an extra **client-predicted small spark** spawns instantly at the game-space contact point, stays put, and does **not** mean the shot registered;
  spark colouring/shape resembles blood; **headshot VFX scaled down** so you can keep tracking the head.
- No crosshair hit marker and no damage numbers by default; outgoing feedback is the blood/spark VFX plus audio (body tick, headshot "ding",
  shield-break crack, escalating kill sound). After death the **combat report** lists damage dealt/received per enemy with head/body/leg hits
  (Riot's example: 3 Vandal body shots = 117 dmg, i.e. the shot's damage, shield included).
- Tagging: hit targets are slowed briefly (existing: offline `xTag`, server `tagUntil` → motor `tag:.275`). Valorant has no whole-body tint.

## What the game now does (work/hit_feedback_runtime.js + vendor/hit-impact.js, installed by work/install_valorant.py)
- **No hit marker / damage numbers** by default (`S.hm` / `S.dn` stay opt-in, default `false`; no DOM is created on a hit).
- **Predicted spark** (kind 0): on every local shot that contacts an enemy, world-space, never attached, tiny, 70 ms.
- **Confirmed puff**: online only from the server `'h'` event; offline from the local sim result. Attached to the struck bone
  (cached per rig: `Spine2` body, `Head` head, `Pelvis` legs; primitive models use `hd`/`bd`/`lL`; fallback the unit group).
  Body (kind 1): blood-red 6-sided puff + 5 streaks. Head (kind 2): distinct pale core + thin red streaks, **smaller** than body.
  Normal blending (red reads on bright walls), fades by shrinking, depth-tested, no depth write. Fixed pool (24, 12 on low), 2 draw calls.
- **Audio** (pooled): body tick, headshot ding (every headshot, lethal too), shield-break crack (online: new `e[10]` flag from the server;
  offline: `armAbs` wrapper notes the hit that emptied armor), kill chime (escalates per kill, from `xKiAdd`). All synthesized once into
  AudioBuffers at first `audio()`; one persistent gain bus; per-sound voice cap (tick 4, head 3, shield 2, kill 2). The only per-play node is
  the one-shot AudioBufferSourceNode WebAudio requires. `vmHit`/`xKiAdd` no longer create oscillators.
- **Flinch**: 140 ms pitch-back of the struck agent's visual wrapper (`valorant-agent` group), 16 fixed slots, restores exactly; hitboxes are
  separate meshes so gameplay is unaffected. The whole-body red emissive flash stays disabled (user's d4d10ff decision: it hid the hit spot and
  cloned materials on first hit; Valorant has no tint either).
- **Combat report**: compact right-side panel on death, kept while spectating, hidden on respawn/reset. Per enemy: dealt and taken damage with
  head·body·legs hit counts; killer row highlighted; the KILLED BY card's DEALT/TAKEN lines use the same numbers.
  Damage = the shot's damage capped at the victim's remaining health+shield (previously health-only, which under-reported vs Valorant).
  Online it is filled from server `'h'` events (logged before the snapshot applies, so it is complete when the `'k'` death arrives);
  local predicted damage is never logged online. Legs are tracked for player single shots and bot shots; shotgun pellets count as head/body.
- **Spectate**: offline, teammate→bot and bot→teammate hits emit the confirmed VFX on the struck part (`xHitOther`), with sound only for the
  teammate being spectated; online, other shooters' server-confirmed hits emit VFX on the victim, sound only when spectating that shooter.

## Server protocol
`['h', shooter, target, head, killed, damage, dx, dy, dz, part(0 body,1 head,2 legs), shieldBroken(0/1)]` — `e[10]` appended (backward compatible;
clients validate the first ten fields). Needs a matching server deploy before online shield-break sound works; **not deployed** from this branch.

## Tests
`work/test_hit_impact.cjs` (in `npm run test:client`): pool/attachment/crouch-follow, predicted spark unattached and static, head variant smaller
and distinct, real `vmHit`/`hurt`/`xKLog` code from index.html in a VM: no damage-number DOM/hit marker, confirmed VFX only on server events
online, attached to chest/head/pelvis, sounds per case, flinch restore, combat report online+offline (capped damage, H/B/L), spectate sound rule,
400 hits allocate no new buffers/gain nodes/DOM/slots, voice cap.

## Pending / not verified
- Rendered look not visually accepted in a browser (no Chromium in this pass): sizes/colours are tuned by numbers only. `work/hit-impact-preview.html` shows all three kinds.
- Real online run (server event + bandwidth) and peer-host (MP.cl without NET socket) mode are not exercised; peer-host clients still treat their own hits as confirmed locally.
- ADR/scoreboard damage (`sbDmg`) is still health-only; only the combat report was changed.

## Bots following the same routes and bunching
Unchanged here. `vendor/bot-routes.cjs` is the user's unfinished routing utility, not wired into gameplay; bot route variety is owned by the hark-perf branch.
