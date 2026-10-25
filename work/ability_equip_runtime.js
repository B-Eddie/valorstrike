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
// ---- First-person ability viewmodel: the gun goes down and the hand holds the ability item ----
// While an ability is equipped (J.eq) this owns the viewmodel after every other vmTick layer: the gun / knife and the
// native first-person rig drop out of view (draw), the procedural hand (xCaHand: glove, cuff, sleeve) comes up holding
// the ability's item by type (throw: a grenade / orb with an agent-colour band, place: a device, cast / buff: a glowing
// orb in the palm), holds it cocked (ready, slow sway), swings it out (rel: overhand for FIRE, underhand for ALT FIRE;
// place reaches down; cast pushes forward) and drops out while the gun comes back up (rec). Types: ABI_M (HUD icons).
var XEQV = { item: null, kind: "", t: 0, on: false };
function xEqItem(kind) { // one cached item per type, kept on the (persistent) hand: no geometry made per equip or per match
  const h = xCaHand(), I = XEQV.items || (XEQV.items = {}); let g = I[kind];
  if (!g) {
    g = new THREE.Group(); const nr = typeof XNR === "function" ? XNR : () => {}, band = new THREE.MeshBasicMaterial({ color: 0xff4655 });
    if (kind === "place") { // device: body + emitter
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.045, 0.075), new THREE.MeshStandardMaterial({ color: 0x2b2f36, metalness: 0.6, roughness: 0.45 }));
      const l = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.012, 12), band); l.position.y = 0.028; g.add(b, l);
    } else if (kind === "throw") { // grenade / orb with a coloured band
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.038, 14, 10), new THREE.MeshStandardMaterial({ color: 0x3a3f47, metalness: 0.4, roughness: 0.5 }));
      const r = new THREE.Mesh(new THREE.TorusGeometry(0.039, 0.007, 6, 18), band); r.rotation.x = Math.PI / 2; g.add(b, r);
    } else { band.transparent = true; band.opacity = 0.9; band.blending = THREE.AdditiveBlending; band.depthWrite = false; band.fog = false; g.add(new THREE.Mesh(new THREE.SphereGeometry(0.035, 14, 10), band)); } // energy orb
    g.position.set(0, 0.075, -0.035); g.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; o.raycast = nr; } });
    g.userData.band = band; g.visible = false; I[kind] = g;
  }
  if (g.parent !== h) h.add(g);
  for (const k in I) if (I[k] !== g) I[k].visible = false;
  const ag = J.pick || "Jett"; if (g.userData.ag !== ag) { g.userData.ag = ag; try { g.userData.band.color.set(agCol(ag)); } catch (e) {} }
  XEQV.item = g; XEQV.kind = kind; return g;
}
function xEqType(k, ag) { return XCA_T[(ABI_M[ag || J.pick] || ABI_M.Jett)["cqex".indexOf(k)]] || "cast"; }
function xEqView(dt) {
  const q = J.eq; XEQV.t += dt;
  if (!q || !running || !player || player.hp <= 0) { if (XEQV.on) { XEQV.on = false; if (XEQV.item) XEQV.item.visible = false; if (!XCA.on && XCA.h) XCA.h.visible = false; if (XCA.gl && !XCA.on) XCA.gl.material.opacity = 0; } return; }
  const sm = (x) => { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); }, ty = xEqType(q.k);
  const g = sm(q.st === "draw" ? 1 - q.t / XABT.draw : q.st === "rec" ? q.t / XABT.rec : 1); // gun-down amount
  gun.position.y -= g * 0.42; gun.position.x += g * 0.06; gun.rotation.x -= g * 0.8; gun.rotation.z += g * 0.45; knife.position.y -= g * 0.42; // vmTick sets these absolutely each frame
  const F = typeof XV !== "undefined" && XV.fp; if (F && F.root) { F.root.position.y -= g * 0.4; if (g > 0.9) F.root.visible = false; }
  const h = xCaHand(), it = xEqItem(ty); XEQV.on = true;
  const up = sm(q.st === "draw" ? (1 - q.t / XABT.draw) * 1.4 - 0.4 : q.st === "rec" ? (q.t / XABT.rec) * 1.6 - 0.6 : 1); // hand rises behind the gun going down
  const p = q.st === "rel" ? sm(1 - q.t / XABT.rel) : q.st === "rec" ? 1 : 0, sway = Math.sin(XEQV.t * 1.6) * 0.004;
  let x = 0.2, y = -0.2 + sway, z = -0.4, rx = -1.0; const rz = 0.3;
  if (ty === "throw") { if (q.alt) { y += -0.08 + 0.1 * p; z -= 0.22 * p; rx += 0.6 - 0.9 * p; } else { y += 0.05 - 0.09 * p; z += 0.08 - 0.32 * p; rx += 0.5 - 1.0 * p; } } // cocked overhand / low underhand, then the swing
  else if (ty === "place") { y -= 0.03 + 0.14 * p; z -= 0.06 * p; rx += 0.25 + 0.5 * p; }
  else { x = 0.12; y += 0.02; z -= 0.22 * p; rx -= 0.25 * p; }
  h.visible = up > 0.01; h.position.set(x, y - (1 - up) * 0.45, z); h.rotation.set(rx, 0, rz);
  it.visible = q.st !== "rec" && !(q.st === "rel" && p > 0.75); // leaves the hand at the end of the swing
  if (XCA.gl) XCA.gl.material.opacity = ty === "cast" || ty === "buff" ? 0.5 * up * (0.8 + 0.2 * Math.sin(XEQV.t * 6)) : 0;
}
{ const v1 = vmTick; vmTick = function (dt) { v1.apply(this, arguments); try { xEqView(dt); } catch (e) { if (!XEQV.err) { XEQV.err = String(e); console.warn("ability viewmodel", e); } } }; }
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
