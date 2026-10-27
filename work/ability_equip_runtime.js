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
// Press an ability key -> the ability is EQUIPPED (gun lowered, ability item drawn over its wiki equip time, XAB_EQT). FIRE (left click) throws /
// places it, ALT FIRE (right click) casts its alternate (underhand / curve right / heal self ...). The throw leaves the hand
// after XABT.rel s; the gun comes back over XABT.rec s. The gun cannot fire from equip until it is back up. A weapon key
// (1 / 2 / 3, wheel) or the same ability key again puts it away; another ability key switches to that ability. Abilities
// Valorant casts INSTANTLY (Jett Cloudburst / Updraft / Tailwind, Reyna Devour / Dismiss / Empress, Phoenix Run It Back ...)
// and recasts of an ability already out (detonate, trigger, return, drone / camera control, the ult guns) keep the
// immediate key press. A click during the draw is buffered; a cast the kit refuses (no target) stays in hand.
const XABT = { draw: 0.5, rel: XAB_REL, rec: 0.45 }; // rel: the hand release, shared with the wiki windups (XAB_WIND / xWf); draw: fallback equip time
// Equip times (seconds from the key press until the ability is in hand and FIRE works), from each ability's wiki page
// ("Equip time" row, wiki.playvalorant.com/en-us/<Ability>, fetched 2026-10-25). Not listed: Blast Pack, Cyber Cage,
// Neural Theft -> XABT.draw (0.5 s).
const XAB_EQT = {
  Phoenix: { c: 0.8, q: 0.8, e: 0.8 }, Sova: { c: 0.9, q: 0.8, e: 0.8, x: 0.8 }, Sage: { c: 0.8, q: 0.5, e: 0.5, x: 0.8 }, Reyna: { c: 0.77 },
  Omen: { c: 0.5, q: 1.1, e: 0.6 }, Killjoy: { c: 0.74, q: 0.85, e: 1.1, x: 0.8 }, Raze: { c: 1.1, e: 0.8 }, Skye: { e: 0.8, x: 0.8 },
  Breach: { c: 0.9, q: 1.1, e: 0.8, x: 1.1 }, Cypher: { c: 0.8, e: 0.8 }, Chamber: { c: 1.0, e: 0.8 } };
function xEqT(k) { const t = XAB_EQT[J.pick]; return (t && t[k]) || XABT.draw; }
// After the cast (qa-34; = server/src/windups.js UNEQUIP / REEQ_INSTANT / REEQUIP / recoverTime): the ability is put away over
// its wiki "Unequip time" (rec: the cast clip runs from the release frame to its end), then the last weapon is re-equipped at
// its FAST equip time (Instant for Curveball, Leer, Rendezvous; wiki weapon pages Normal / Fast / Instant) - the gun's native
// equip clip over VM.sw, firing blocked until it is up (Valorant: "After casting an ability, an agent will reequip the last
// weapon ... at its normal, fast, or instant equip time"). Was a flat 0.45 s, gun usable at once after it. Empress +10 %.
const XAB_UNEQ = { Jett: { c: 0.25, e: 0.2 }, Phoenix: { c: 0.5, q: 0.7, e: 0.48 }, Sova: { c: 0.7, q: 0.7, e: 0.7, x: 1 }, Sage: { c: 0.7, q: 0.4, e: 0.7, x: 1 }, Reyna: { c: 0.5, q: 0.5, e: 0.6 }, Omen: { c: 0.7, q: 0.7, e: 0.7 }, Killjoy: { c: 0.7, q: 0.75, e: 0.7, x: 0.15 }, Raze: { c: 0, q: 0.7, e: 0.7 }, Skye: { e: 0.85, x: 0.55 }, Breach: { c: 0.7, q: 0.7, e: 0.7, x: 0.4 }, Cypher: { c: 0.7, q: 0.7, e: 0.7, x: 1 }, Chamber: { c: 0.7, e: 0.6 } };
const XAB_REEQI = { Phoenix: "e", Reyna: "c", Chamber: "e" };
const XAB_REEQ = { Classic: [0.45, 0.15], Shorty: [0.45, 0.15], Frenzy: [0.45, 0.15], Ghost: [0.45, 0.15], Sheriff: [0.6, 0.2], Stinger: [0.45, 0.15], Spectre: [0.45, 0.15], Bucky: [0.6, 0.2], Judge: [0.6, 0.2], Bulldog: [0.6, 0.2], Guardian: [0.6, 0.2], Phantom: [0.6, 0.2], Vandal: [0.6, 0.2], Marshal: [0.6, 0.2], Outlaw: [0.6, 0.2], Operator: [0.9, 0.5], Ares: [0.75, 0.25], Odin: [0.75, 0.25], Knife: [0.3, 0] };
function xUneqT(k, ag = J.pick) { const t = XAB_UNEQ[ag]; return t && Number.isFinite(t[k]) ? t[k] : XABT.rec; }
function xReeqT(k, w, ag = J.pick) { const r = XAB_REEQ[w] || XAB_REEQ.Classic, i = (XAB_REEQI[ag] || "").includes(k); let s = 1; try { s = xStimK() || 1; } catch (e) {} return r[i ? 1 : 0] / s; }
function xEqWeap() { try { return vfWeapon(); } catch (e) { return typeof rw !== "undefined" && rw === "knife" ? "Knife" : "Classic"; } }
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
// Hold abilities: FIRE pressed with the ability out starts a HOLD (st "hold", q.h s held), releasing FIRE throws.
//  bow (Sova Shock Bolt / Recon Bolt): the hold charges the bolt (SovaBolt.power), ALT FIRE adds a bounce (0 -> 1 -> 2 -> 0).
//  fault (Breach Fault Line): the hold extends the quake, XFAULT.min -> max m over XFAULT.charge s (xEqHoldPw); ALT FIRE does nothing.
const XAB_HOLD = { Sova: { q: "bow", e: "bow" }, Breach: { e: "fault" } };
function xEqHoldPw(q) { const h = q && q.st === "hold" ? q.h : 0; return xEqHold(q) === "fault" ? Math.max(0, Math.min(1, h / XFAULT.charge)) : SovaBolt.power(h); }
function xEqHold(q) { const t = q && XAB_HOLD[J.pick]; return (t && t[q.k]) || ""; }
// J.eq: null | { k, code, st: "draw" | "ready" | "hold" | "rel" | "rec", t, alt, buf, h (held s), bn (bounces) }
function xEqMode(code) { const t = XAB_EQ[J.pick], k = code && code[3] && code[3].toLowerCase(), f = t && t[k]; try { return !!(f && f()); } catch (e) { return false; } }
function xEqFire(alt) { // FIRE / ALT FIRE while an ability is out: true when the click belonged to the ability
  const q = J.eq; if (!q) return false; const hk = xEqHold(q);
  if (hk === "fault" && alt) return true; // Fault Line has no alternate
  if (hk === "bow" && alt) { if (q.st !== "rel" && q.st !== "rec") { q.bn = ((q.bn | 0) + 1) % 3; try { blip(500 + q.bn * 180, 0.05, "triangle", 0.1); } catch (e) {} } return true; } // ALT FIRE: one more bounce
  if (hk && !alt) { if (q.st === "ready") { q.st = "hold"; q.h = 0; } else if (q.st === "draw") q.buf = 1; return true; } // FIRE down: start the hold
  if (q.st === "ready") { q.st = "rel"; q.t = XABT.rel; q.alt = !!alt; } else if (q.st === "draw") q.buf = alt ? 2 : 1; return true;
}
function xEqCast(q) { // the throw leaves the hand: the kit's own cast (offline / host relay / trusted server) with ALT FIRE held for an alternate
  const a0 = J.abAlt, m0 = typeof mpAltHeld !== "undefined" ? mpAltHeld : false, s0 = xCaSig(); J.abAlt = !!q.alt; try { if (q.alt) mpAltHeld = true; } catch (e) {}
  const hk = xEqHold(q); XABT.bolt = hk === "bow" ? { pw: SovaBolt.power(q.h), b: SovaBolt.bounces(q.bn) } : null; // read by jArrow and the cast message (mpCastSelf)
  XABT.hold = hk === "fault" ? { pw: Math.max(0, Math.min(1, q.h / XFAULT.charge)) } : null; // Fault Line charge: read by bcKey, mpCastSelf and the server intent
  XABT.casting = true; try { xEqKey0(q.code); } catch (e) { xE(e); } finally { XABT.casting = false; XABT.bolt = null; XABT.hold = null; J.abAlt = a0; try { mpAltHeld = m0; } catch (e) {} }
  try { xCaEnd(); } catch (e) {} // the equip viewmodel plays the release; the old one-shot cast gesture would replay it
  return xCaSig() !== s0 || !xEqMode(q.code); // false: the kit refused (no target / no room): Valorant keeps it in hand
}
function xEqTick(dt) {
  const q = J.eq; if (!q) return;
  if (!jOn() || !running || !player || player.hp <= 0 || (mode === "five" && FV.buy > 0)) { J.eq = null; return; }
  if (q.st === "hold") { q.h += dt; if (!fireHeld) { q.st = "rel"; q.t = XABT.rel; q.alt = false; } return; } // releasing FIRE throws
  q.t -= dt; if (q.t > 0) return;
  if (q.st === "draw") { q.st = "ready"; q.t = 0; if (q.buf) { const a = q.buf === 2; q.buf = 0; xEqFire(a); } }
  else if (q.st === "rel") { if (xEqCast(q)) { q.st = "rec"; q.t = q.rec = xUneqT(q.k); } else { q.st = "ready"; q.t = 0; } }
  else if (q.st === "rec") { J.eq = null; const w = xEqWeap(); VM.sw = VM.swT = xReeqT(q.k, w); VM.ins = 0; } // ability put away: the gun re-equips (fast / instant), no fire until it is up
}
const xEqKey0 = jKey;
jKey = function (code) {
  if (XABT.casting || !jOn() || typeof code !== "string" || !/^Key[CQEX]$/.test(code) || (mode === "five" && FV.buy > 0)) return xEqKey0.apply(this, arguments);
  if (J.eq && J.eq.code === code && J.eq.st !== "rec") { if (J.eq.st !== "rel" && J.eq.st !== "hold") J.eq = null; return true; } // same key again: put it away
  if (J.eq && J.eq.st === "rel") return true; // mid-throw
  if (J.eq && J.eq.st === "hold") return true; // drawing the bow / holding: finish it first
  if (player && player.hp > 0 && xEqMode(code)) { J.eq = { k: code[3].toLowerCase(), code, st: "draw", t: xEqT(code[3].toLowerCase()), d0: xEqT(code[3].toLowerCase()), alt: false, buf: 0, h: 0, bn: 0 }; fireHeld = false; try { setScope(false); } catch (e) {} return true; }
  if (J.eq) J.eq = null; // a quick-cast / recast puts away whatever was out
  const ik = code[3].toLowerCase(), inst = (XAB_INST[J.pick] || "").includes(ik) && player && player.hp > 0, s0 = inst ? xInstSig(ik) : null, ready = inst ? xInstOnline(ik) : null, r = xEqKey0.apply(this, arguments);
  if (inst && (ready === true || (ready === null && xInstCast(ik, s0, xInstSig(ik))))) xInstGo(ik);
  return r;
};
// Instant casts (qa-36 = server abilities.js INSTANT_UNEQUIP): Jett Cloudburst (C) / the Tailwind dash (E recast), Reyna Devour (Q) /
// Dismiss (E) have no equip, but the gun is put away over the wiki 'Unequip time' (XAB_UNEQ: 0.25 / 0.2 / 0.5 / 0.6 s) from the press
// and comes back at its Fast equip time (wiki 'Weapon Reequip Speed: Fast'): no fire meanwhile (was: the gun stayed up, a flat 0.72 s
// cast-gesture lock). The cast gesture (XCA) is rescaled to the unequip time, then the gun's equip clip plays over VM.sw.
const XAB_INST = { Jett: "ce", Reyna: "qe" };
function xInstSig(k) { if (J.pick === "Jett") return k === "c" ? J.c : !!J.dash; return [J.q, (J.so && J.so.length) || 0, J.dis > 0 ? 1 : 0, J.ohT > 0 ? 1 : 0].join(); }
function xInstCast(k, a, b) { return J.pick === "Jett" ? (k === "c" ? b < a : !a && b) : a !== b; }
function xInstOnline(k) { // online Reyna: the server consumes the orb (the page keeps no local orb state): cast = the orb was usable on the press
  try { if (J.pick !== "Reyna" || !(typeof NET !== "undefined" && NET.socket) || typeof netReyna === "undefined" || !netReyna) return null; const A = netReyna, n = (A.souls || []).filter((s) => Math.hypot(s.p[0] - player.x, s.p[2] - player.z) < 15).length; return n > 0 && (J.q > 0 || !!A.empress) && !(A.dismiss > 0); } catch (e) { return null; }
}
function xInstGo(k) {
  const t = xUneqT(k); XABT.inst = { k, t, w: xEqWeap() }; try { setScope(false); } catch (e) {}
  if (XCA.on) { const f = t / (XCA.D + XCA.G + XCA.U); XCA.D *= f; XCA.G *= f; XCA.U *= f; } // the cast gesture lasts the unequip time
}
function xInstTick(dt) {
  const q = XABT.inst; if (!q) return; if (!player || player.hp <= 0 || !running) { XABT.inst = null; return; }
  if ((q.t -= dt) > 1e-9) return; XABT.inst = null; try { xCaEnd(); } catch (e) {} VM.sw = VM.swT = xReeqT(q.k, q.w); VM.ins = 0; // put away: the gun re-equips at its fast time
}
{ const s0 = shoot; shoot = function (hv) { // the gun is down while an ability is out or coming back
  if (jOn() && XABT.inst) return; // an instant cast is putting the gun away (xInstGo)
  if (jOn() && J.eq) { if (hv || !xEqHold(J.eq)) fireHeld = false; xEqFire(!!hv); return; } // knife ALT FIRE / touch long-press = ability ALT FIRE; a hold ability keeps fireHeld to see the release
  if (jOn() && J.pick === "Sova" && J.hf > 0 && !hv) { fireHeld = false; return void xEqKey0("KeyX"); } // Hunter's Fury: FIRE shoots the next blast
  return s0.apply(this, arguments); }; }
{ const z0 = xScopeT; xScopeT = function () { if (jOn() && J.eq) return void xEqFire(true); return z0.apply(this, arguments); }; }
{ const w0 = swapW; swapW = function () { if (J.eq && !XABT.casting) J.eq = null; return w0.apply(this, arguments); }; }
{ const r0 = jRound; jRound = function () { J.eq = null; return r0.apply(this, arguments); }; }
// HUD: the equipped slot is outlined, as Valorant highlights the ability in hand
try { const st = document.createElement("style"); st.textContent = ".x-as.x-eq,#game .x-as.x-eq{box-shadow:inset 0 0 0 2px #fff;border-bottom-color:#fff!important}"; document.head.appendChild(st); } catch (e) {}
function xEqHud() { const k = J.eq && J.eq.st !== "rec" ? J.eq.k : ""; if (xEqHud.k === k) return; xEqHud.k = k; [["jC", "c"], ["jQ", "q"], ["jE", "e"], ["jX", "x"]].forEach(([id, a]) => { const el = $(id); if (el) el.classList.toggle("x-eq", a === k); }); }
// Hold HUD (#xBow) under the crosshair while a hold ability is out (Fault Line: its length charge, no pips). Sova bow: charge bar (fills over SovaBolt.BOLT.charge s of HOLD FIRE) and the
// two bounce pips ALT FIRE lights, as Valorant's bow reticle shows them.
try { const st = document.createElement("style"); st.textContent = "#xBow{position:fixed;left:50%;top:calc(50% + 34px);transform:translateX(-50%);display:none;align-items:center;gap:6px;pointer-events:none;z-index:6;font:600 10px/1 sans-serif;color:#fff;text-shadow:0 0 2px #000}#xBow.on{display:flex}#xBow i{display:block;width:64px;height:4px;background:rgba(255,255,255,.25);box-shadow:0 0 0 1px rgba(0,0,0,.5)}#xBow i b{display:block;height:100%;width:0;background:#7fd8ff}#xBow u{display:block;width:7px;height:7px;transform:rotate(45deg);border:1px solid #fff;background:transparent}#xBow u.on{background:#7fd8ff}"; document.head.appendChild(st);
  const d = document.createElement("div"); d.id = "xBow"; d.innerHTML = "<u></u><i><b></b></i><u></u>"; (document.getElementById("game") || document.body).appendChild(d); } catch (e) {}
function xBowHud() { const q = J.eq, hk = q && q.st !== "rec" ? xEqHold(q) : "", on = hk === "bow" || hk === "fault", el = $("xBow"); if (!el) return; const pw = on ? xEqHoldPw(q) : 0, k = on ? hk + Math.round(pw * 20) + "|" + (q.bn | 0) : "";
  if (xBowHud.k === k) return; xBowHud.k = k; el.classList.toggle("on", on); if (!on) return; el.querySelector("b").style.width = (pw * 100).toFixed(0) + "%"; el.querySelectorAll("u").forEach((u, i) => { u.classList.toggle("on", (q.bn | 0) > i); u.style.display = hk === "fault" ? "none" : ""; }); } // Fault Line: the charge bar only (no bounces)
// Curveball curve hint (user: "add a curve-direction indicator so the player knows left click curves left, right click curves right"):
// while Phoenix holds Curveball (J.eq e, drawing / ready) both paths the flare can take are drawn from the hand as dotted arcs -
// FIRE (left click) curves LEFT, ALT FIRE (right click) curves RIGHT (valorant.fandom.com/wiki/Curveball) - each the same path
// the cast flies (phCurve: 5 m ahead short of a wall, then 2.5 m aside) ending in a bright pop marker, plus a HUD tag under the
// crosshair. Hidden as soon as the throw leaves the hand (rel / rec) or the ability is put away.
var XCBH = { n: 10, u0: 0.18, g: null, d: [[], []] };
function xCbHintPts(o, fx, fz, side, n) { // pure (tests): n points along the cast's quadratic path, from u0 (clear of the camera) to the pop
  const c = phCurve(o, fx, fz, side), out = []; for (let i = 0; i < n; i++) { const u = XCBH.u0 + (1 - XCBH.u0) * (i / (n - 1)), w = 1 - u;
    out.push(new THREE.Vector3(w * w * o.x + 2 * w * u * c.mid.x + u * u * c.end.x, w * w * o.y + 2 * w * u * c.mid.y + u * u * c.end.y, w * w * o.z + 2 * w * u * c.mid.z + u * u * c.end.z)); }
  return out;
}
function xCbHintOn() { const q = J.eq; return !!(q && J.pick === "Phoenix" && q.k === "e" && (q.st === "draw" || q.st === "ready") && running && player && player.hp > 0); }
function xCbHintBuild() { // two arcs of small additive dots (index 0 = FIRE / left, 1 = ALT FIRE / right), the last dot of each a bigger pop marker
  if (XCBH.g) { scene.add(XCBH.g); return XCBH.g; } // built once (no new geometry per match); re-added after a scene clear
  const g = new THREE.Group(); g.name = "xcb-hint"; g.visible = false; const geo = new THREE.SphereGeometry(1, 8, 6);
  const mats = [0xffe7a0, 0xffb060].map((c) => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending }));
  for (let s = 0; s < 2; s++) for (let i = 0; i < XCBH.n; i++) { const m = new THREE.Mesh(geo, mats[s]); m.scale.setScalar(i === XCBH.n - 1 ? 0.12 : 0.03 + 0.012 * i / XCBH.n); m.raycast = () => {}; m.frustumCulled = false; m.renderOrder = 3; g.add(m); XCBH.d[s].push(m); }
  scene.add(g); return (XCBH.g = g);
}
function xCbHintTick() {
  const on = xCbHintOn(), el = $("xCbH"); if (el && el.classList.contains("on") !== on) el.classList.toggle("on", on);
  if (!on) { if (XCBH.g) { XCBH.g.visible = false; if (XCBH.g.parent) XCBH.g.parent.remove(XCBH.g); } return; } // out of the scene while unused (round reset leaves nothing behind); re-added on the next hold
  const g = XCBH.g && XCBH.g.parent ? XCBH.g : xCbHintBuild(), o = pEye(), fx = -Math.sin(yaw), fz = -Math.cos(yaw); g.visible = true;
  [-1, 1].forEach((side, s) => { const P = xCbHintPts(o, fx, fz, side, XCBH.n); XCBH.d[s].forEach((m, i) => m.position.copy(P[i]).setY(P[i].y - 0.22 * (1 - i / (XCBH.n - 1)))); }); // starts a little under the crosshair (the hand), meets the true pop point
}
try { const st = document.createElement("style"); st.textContent = "#xCbH{position:fixed;left:50%;top:calc(50% + 30px);transform:translateX(-50%);display:none;gap:46px;pointer-events:none;z-index:6;font:700 11px/1 sans-serif;letter-spacing:.08em;color:#fff;text-shadow:0 0 3px #000,0 0 2px #000}#xCbH.on{display:flex}#xCbH span:first-child{color:#ffe7a0}#xCbH span:last-child{color:#ffb060}";
  document.head.appendChild(st); const d = document.createElement("div"); d.id = "xCbH"; d.innerHTML = "<span>\u25C0 L-CLICK</span><span>R-CLICK \u25B6</span>"; (document.getElementById("game") || document.body).appendChild(d); } catch (e) {}
{ const t0 = jTick; jTick = function (dt) { const v = t0.apply(this, arguments); try { xEqTick(dt); xEqHud(); xBowHud(); } catch (e) { J.eq = null; } try { xInstTick(dt); } catch (e) { XABT.inst = null; } try { xCbHintTick(); } catch (e) { if (XCBH.g) XCBH.g.visible = false; } return v; }; }
// First person: the agent's native arms draw the ability (work/ability_fp_runtime.js, ABILITY FIRST PERSON).
// ---- Third person: others see the throw. A cast relayed for another unit (online relay / trusted-server replay, mpFx)
// plays the rig's throw / cast one-shot (upper-body rigs) or the right-arm swing (skinned rigs), typed like the first person.
var XEQT = [];
function xEqTpGo(u, ag, k) {
  const R = u && u.xm; if (!R || u === player || R.dead) return;
  xCaBotGo(R); if (R.ub) R.xCast = xEqType(k, ag) === "throw" ? "throw" : "cast"; R.xCpT = performance.now(); if (!XEQT.includes(R)) XEQT.push(R);
}
{ const f1 = mpFx; mpFx = function (u, ag, k) { try { if (typeof k === "string" && /^[cqex]$/.test(k)) xEqTpGo(u, ag, k); } catch (e) {} return f1.apply(this, arguments); }; }
(window.XHK = window.XHK || []).push(() => { if (!XEQT.length) return; const n = performance.now(); XEQT = XEQT.filter((R) => { R.xCp = Math.max(0, Math.min(R.xCp || 0, 0.4 - (n - R.xCpT) / 1000)); if (!R.sx && R.gun && R.xG0 != null) R.gun.rotation.x = R.xG0 - 0.9 * Math.sin(Math.PI * (1 - R.xCp / 0.4)); return R.xCp > 0; }); });
// ---- END ABILITY EQUIP ----
