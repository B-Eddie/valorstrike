// ---- ABILITY EQUIP ----
// Valorant ability layer (work/ability_equip_runtime.js, installed by work/install_valorant.py).
// Keys: Valorant's defaults are C (ability 1), Q (ability 2), E (signature), X (ultimate); crouch is Ctrl. The game listens
// for those default codes and the keymap layer (XKB / xKbRev) translates a rebound physical key to them, so the HUD slot
// labels must show the PHYSICAL key the player bound, not the letter of the default.
const XAB_SLOTS = [["jC", "abC"], ["jQ", "abQ"], ["jE", "abE"], ["jX", "abX"]];
function xAbKeyLbl() {
  for (const [id, a] of XAB_SLOTS) { const s = $(id), b = s && s.querySelector("b"), t = xKbName(XS.keys[a] || XKB.find((r) => r[0] === a)[2]); if (b && b.textContent !== t) b.textContent = t; }
}
// Bind migration: a stored map from before the C/Q/E/X layout (abilities on Z/X/C with ping elsewhere) is a set of
// defaults the player never chose; move it to Valorant's defaults. A map the player edited (anything else) is kept.
function xAbMigrate(k) {
  const legacy = k.abC === "KeyZ" && k.abQ === "KeyX" && k.abE === "KeyC";
  if (!legacy) return false;
  k.abC = "KeyC"; k.abQ = "KeyQ"; k.abE = "KeyE"; k.abX = "KeyX"; if (k.ping === "KeyC" || k.ping === "KeyQ" || k.ping === "KeyE" || k.ping === "KeyX") k.ping = "KeyZ";
  if (k.crouch === "KeyC") k.crouch = "ControlLeft";
  return true;
}
try { if (xAbMigrate(XS.keys)) xKbSave(); } catch (e) {}
{ const r0 = xKbRender; xKbRender = function () { const v = r0.apply(this, arguments); try { xAbKeyLbl(); } catch (e) {} return v; }; }
try { xAbKeyLbl(); } catch (e) {}
// ---- END ABILITY EQUIP ----
