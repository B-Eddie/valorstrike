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
