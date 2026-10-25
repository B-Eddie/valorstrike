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
// ---- Equip-then-fire (Valorant ability use flow) ----
// Press an ability key -> the ability is EQUIPPED (gun lowered, ability item drawn, XABT.draw s). FIRE (left click) throws /
// places it, ALT FIRE (right click) casts its alternate (underhand / curve right / heal self ...). The throw leaves the hand
// after XABT.rel s; the gun comes back over XABT.rec s. The gun cannot fire from equip until it is back up. A weapon key
// (1 / 2 / 3, wheel) or the same ability key again puts it away; another ability key switches to that ability. Abilities
// Valorant casts INSTANTLY (Jett Cloudburst / Updraft / Tailwind, Reyna Devour / Dismiss / Empress, Phoenix Run It Back ...)
// and recasts of an ability already out (detonate, trigger, return, drone / camera control, the ult guns) keep the
// immediate key press. A click during the draw is buffered; a cast the kit refuses (no target) stays in hand.
const XABT = { draw: 0.5, rel: 0.2, rec: 0.45 };
const XAB_EQ = { // agent -> key -> ready-to-equip test (a charge to spend and nothing of it out waiting for a recast); mirrors server ABILITY_EQUIP
  Phoenix: { c: () => J.c >= 1 && J.cd.c <= 0, q: () => J.q >= 1 && J.cd.q <= 0, e: () => J.e >= 1 && J.cd.e <= 0 },
  Sova: { c: () => J.c >= 1 && J.cd.c <= 0 && !J.dr, q: () => J.q >= 1 && J.cd.q <= 0 && !J.dr, e: () => J.e >= 1 && !J.dr, x: () => !(J.hf > 0) && J.ult >= K().u && !J.dr },
  Sage: { c: () => J.c >= 1 && J.cd.c <= 0, q: () => J.q >= 1 && J.cd.q <= 0, e: () => J.e >= 1, x: () => J.ult >= K().u },
  Reyna: { c: () => J.c >= 1 && J.cd.c <= 0 },
  Omen: { c: () => J.c >= 1 && J.cd.c <= 0 && !J.om, q: () => J.q >= 1 && J.cd.q <= 0, e: () => J.e >= 1 && J.cd.e <= 0 },
  Killjoy: { c: () => J.c >= 1 && J.cd.c <= 0 && !J.nano.some((n) => !n.on), q: () => J.q >= 1, e: () => J.e >= 1, x: () => !J.ld && J.ult >= K().u },
  Raze: { c: () => J.c >= 1 && J.cd.c <= 0 && !RS.bb.length, q: () => J.q >= 1 && J.cd.q <= 0 && !RS.pk.length, e: () => J.e >= 1 && J.cd.e <= 0 },
  Skye: { e: () => J.e >= 1 && J.cd.e <= 0 && !RS.hk, x: () => !RS.sk.length && J.ult >= K().u },
  Breach: { c: () => J.c >= 1 && J.cd.c <= 0, q: () => J.q >= 1 && J.cd.q <= 0, e: () => J.cd.e <= 0, x: () => J.ult >= K().u },
  Cypher: { c: () => J.c >= 1 && J.cd.c <= 0, q: () => J.q >= 1 && J.cd.q <= 0, e: () => !BC.cam && !BC.cv, x: () => J.ult >= K().u },
  Chamber: { c: () => J.c >= 1 && J.cd.c <= 0 && !BC.tm.length, e: () => !BC.an && J.cd.e <= 0 },
};
// J.eq: null | { k, code, st: "draw" | "ready" | "rel" | "rec", t, alt, buf }
function xEqMode(code) { const t = XAB_EQ[J.pick], k = code && code[3] && code[3].toLowerCase(), f = t && t[k]; try { return !!(f && f()); } catch (e) { return false; } }
function xEqFire(alt) { // FIRE / ALT FIRE while an ability is out: true when the click belonged to the ability
  const q = J.eq; if (!q) return false; if (q.st === "ready") { q.st = "rel"; q.t = XABT.rel; q.alt = !!alt; } else if (q.st === "draw") q.buf = alt ? 2 : 1; return true;
}
function xEqCast(q) { // the throw leaves the hand: the kit's own cast (offline / host relay / trusted server) with ALT FIRE held for an alternate
  const a0 = J.abAlt, m0 = typeof mpAltHeld !== "undefined" ? mpAltHeld : false, s0 = xCaSig(); J.abAlt = !!q.alt; try { if (q.alt) mpAltHeld = true; } catch (e) {}
  XABT.casting = true; try { xEqKey0(q.code); } catch (e) { xE(e); } finally { XABT.casting = false; J.abAlt = a0; try { mpAltHeld = m0; } catch (e) {} }
  try { xCaEnd(); } catch (e) {} // the equip viewmodel plays the release; the old one-shot cast gesture would replay it
  return xCaSig() !== s0 || !xEqMode(q.code); // false: the kit refused (no target / no room): Valorant keeps it in hand
}
function xEqTick(dt) {
  const q = J.eq; if (!q) return;
  if (!jOn() || !running || !player || player.hp <= 0 || (mode === "five" && FV.buy > 0)) { J.eq = null; return; }
  q.t -= dt; if (q.t > 0) return;
  if (q.st === "draw") { q.st = "ready"; q.t = 0; if (q.buf) { const a = q.buf === 2; q.buf = 0; xEqFire(a); } }
  else if (q.st === "rel") { if (xEqCast(q)) { q.st = "rec"; q.t = XABT.rec; } else { q.st = "ready"; q.t = 0; } }
  else if (q.st === "rec") J.eq = null;
}
const xEqKey0 = jKey;
jKey = function (code) {
  if (XABT.casting || !jOn() || typeof code !== "string" || !/^Key[CQEX]$/.test(code) || (mode === "five" && FV.buy > 0)) return xEqKey0.apply(this, arguments);
  if (J.eq && J.eq.code === code && J.eq.st !== "rec") { if (J.eq.st !== "rel") J.eq = null; return true; } // same key again: put it away
  if (J.eq && J.eq.st === "rel") return true; // mid-throw
  if (player && player.hp > 0 && xEqMode(code)) { J.eq = { k: code[3].toLowerCase(), code, st: "draw", t: XABT.draw, alt: false, buf: 0 }; fireHeld = false; try { setScope(false); } catch (e) {} return true; }
  if (J.eq) J.eq = null; // a quick-cast / recast puts away whatever was out
  return xEqKey0.apply(this, arguments);
};
{ const s0 = shoot; shoot = function (hv) { // the gun is down while an ability is out or coming back
  if (jOn() && J.eq) { fireHeld = false; xEqFire(!!hv); return; } // knife ALT FIRE / touch long-press = ability ALT FIRE
  if (jOn() && J.pick === "Sova" && J.hf > 0 && !hv) { fireHeld = false; return void xEqKey0("KeyX"); } // Hunter's Fury: FIRE shoots the next blast
  return s0.apply(this, arguments); }; }
{ const z0 = xScopeT; xScopeT = function () { if (jOn() && J.eq) return void xEqFire(true); return z0.apply(this, arguments); }; }
{ const w0 = swapW; swapW = function () { if (J.eq && !XABT.casting) J.eq = null; return w0.apply(this, arguments); }; }
{ const r0 = jRound; jRound = function () { J.eq = null; return r0.apply(this, arguments); }; }
// HUD: the equipped slot is outlined, as Valorant highlights the ability in hand
try { const st = document.createElement("style"); st.textContent = ".x-as.x-eq,#game .x-as.x-eq{box-shadow:inset 0 0 0 2px #fff;border-bottom-color:#fff!important}"; document.head.appendChild(st); } catch (e) {}
function xEqHud() { const k = J.eq && J.eq.st !== "rec" ? J.eq.k : ""; if (xEqHud.k === k) return; xEqHud.k = k; [["jC", "c"], ["jQ", "q"], ["jE", "e"], ["jX", "x"]].forEach(([id, a]) => { const el = $(id); if (el) el.classList.toggle("x-eq", a === k); }); }
{ const t0 = jTick; jTick = function (dt) { const v = t0.apply(this, arguments); try { xEqTick(dt); xEqHud(); } catch (e) { J.eq = null; } return v; }; }
// ---- END ABILITY EQUIP ----
