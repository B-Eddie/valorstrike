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
The 0.5 / 0.2 / 0.45 s timings are generic (the wiki lists windups only for some abilities); per-ability windups are a follow-up.

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

Not modelled: Breach Fault Line hold-to-extend (FIRE casts at the fixed length), Sova arrow bounce / charge selection.
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

Differences NOT changed here (individual effect durations / damage live in each agent's effect code and in the server's
devices.js / ults.js; each needs its own pass with both sides): e.g. Jett Cloudburst smoke 4.5 s in code vs 2.5 s on
the wiki; Phoenix Hot Hands zone 4 s vs 3.25 s; Sova Recon / Breach windups. Listed for follow-up rather than changed blind.

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
