// ---- ABILITY TARGETING ----
// Tactical-map targeting (work/ability_target_runtime.js, installed last by work/install_valorant.py).
// Valorant (wiki From_the_Shadows: "While equipped, a display of the entire map will appear. Omen can select a location to
// place and instantly cast the ability"): map-targeted abilities open a big map overlay over the game, a reticle moves on it,
// the spot under it is checked live (cyan = Omen can go there, red = he cannot), FIRE / a tap + CONFIRM casts there, ALT FIRE /
// Esc / the ability key again cancels. Before this, From the Shadows asked the player to click the 160 px corner minimap, which
// is hidden in Deathmatch / TDM / Escalation / Skirmish (#game.x-mm only in 5v5 / Retake) and 96 px on a phone, and the click
// needed a free mouse pointer: in most modes the map never showed (user 2026-10-27 23:00 "one of the ultimates says to pick
// point on map but map doesn't show up").
//   xTac.open(o): o = { name, color, range (m, 0 = whole map), from: [x, z] (range centre), valid(x, z) -> {x, y, z} | null,
//                       confirm(x, z) -> true when cast (false keeps the map open), cancel() }
//   Desktop: with pointer lock the reticle follows the mouse's movement (the OS cursor is hidden); without it, the cursor.
//   Touch (iPhone): tap / drag on the map moves the reticle; CONFIRM casts, CANCEL closes. Movement keys still work (Valorant).
// The map image and its world projection are the minimap's own (nmMapProjection + Riot's apiProjection), north-up.
const XTAC = { on: false, o: null, cx: 512, cy: 512, W: 1024, el: null, cv: null, ctx: null, ok: null, no: null, msg: null, hint: null, v: null, drawT: 0, sens: 1024 / 650 };
function xTacEl() {
  if (XTAC.el) return XTAC.el;
  const d = document.createElement("div"); d.id = "xTac"; d.setAttribute("role", "dialog"); d.setAttribute("aria-label", "Tactical map");
  d.style.cssText = "position:fixed;left:0;top:0;right:0;bottom:0;display:none;z-index:9500;background:rgba(6,11,16,.78);align-items:center;justify-content:center;flex-direction:column;touch-action:none;user-select:none;-webkit-user-select:none;font:600 13px Arial,sans-serif;color:#ece8e1";
  const t = document.createElement("div"); t.id = "xTacT"; t.style.cssText = "letter-spacing:.12em;text-transform:uppercase;margin:4px 0;font-size:15px"; d.appendChild(t);
  const cv = document.createElement("canvas"); cv.id = "xTacC"; cv.width = cv.height = XTAC.W; cv.style.cssText = "width:min(86vh,86vw);height:min(86vh,86vw);max-width:900px;max-height:900px;border:1px solid rgba(236,232,225,.25);background:#101c26;cursor:none;touch-action:none"; d.appendChild(cv);
  const row = document.createElement("div"); row.style.cssText = "display:flex;gap:10px;align-items:center;margin:6px 0";
  const h = document.createElement("span"); h.id = "xTacH"; h.style.cssText = "opacity:.8";
  const ok = document.createElement("button"); ok.id = "xTacOk"; ok.type = "button"; ok.textContent = "Confirm";
  const no = document.createElement("button"); no.id = "xTacNo"; no.type = "button"; no.textContent = "Cancel";
  for (const b of [ok, no]) b.style.cssText = "font:700 13px Arial,sans-serif;letter-spacing:.08em;text-transform:uppercase;padding:9px 16px;border:1px solid rgba(236,232,225,.4);background:rgba(20,30,38,.9);color:#ece8e1;border-radius:2px;min-width:96px;min-height:40px";
  ok.style.background = "rgba(95,228,223,.22)"; row.append(ok, no, h); d.appendChild(row);
  const m = document.createElement("div"); m.id = "xTacM"; m.style.cssText = "min-height:16px;color:#ff6b75"; d.appendChild(m);
  (document.body || document.documentElement).appendChild(d);
  Object.assign(XTAC, { el: d, cv, ctx: cv.getContext("2d"), ok, no, msg: m, hint: h, title: t });
  // touch / free pointer: the reticle goes where the finger / cursor is on the map
  const at = (x, y) => { const r = cv.getBoundingClientRect(); if (!(r.width > 0)) return; XTAC.cx = Math.max(0, Math.min(XTAC.W, (x - r.left) * XTAC.W / r.width)); XTAC.cy = Math.max(0, Math.min(XTAC.W, (y - r.top) * XTAC.W / r.height)); xTacEval(); };
  const tch = (e) => { if (!XTAC.on) return; const t0 = (e.touches && e.touches[0]) || (e.changedTouches && e.changedTouches[0]); if (t0) at(t0.clientX, t0.clientY); e.preventDefault(); e.stopPropagation(); XTAC.touch = true; };
  cv.addEventListener("touchstart", tch, { passive: false }); cv.addEventListener("touchmove", tch, { passive: false });
  d.addEventListener("touchstart", (e) => { if (XTAC.on && e.target !== ok && e.target !== no) e.stopPropagation(); }, { passive: true });
  XTAC.at = at;
  const press = (f) => (e) => { if (!XTAC.on) return; e.preventDefault(); e.stopPropagation(); if (e.stopImmediatePropagation) e.stopImmediatePropagation(); f(); };
  ok.addEventListener("click", press(() => xTacConfirm())); no.addEventListener("click", press(() => xTacCancel(true)));
  ok.addEventListener("touchend", press(() => xTacConfirm()), { passive: false }); no.addEventListener("touchend", press(() => xTacCancel(true)), { passive: false });
  return d;
}
function xTacProj() { const C = typeof nmActive === "function" && nmActive(); return C ? { C, P: nmMapProjection(C, XTAC.W, XTAC.W) } : null; }
// world [x, z] of the reticle / canvas point; page px (clientX/Y) of a world spot (tests, touch)
function xTacWorld(cx, cy) { const p = xTacProj(); return p ? p.P.world(cx, cy) : null; }
function xTacCanvas(x, z) { const p = xTacProj(); return p ? [p.P.X(x), p.P.Z(z)] : null; }
function xTacClient(x, z) { const q = xTacCanvas(x, z), r = XTAC.cv && XTAC.cv.getBoundingClientRect(); return q && r ? [r.left + q[0] * r.width / XTAC.W, r.top + q[1] * r.height / XTAC.W] : null; }
function xTacEval() { // the live check of the spot under the reticle (range, then the ability's own valid())
  const o = XTAC.o; if (!o) return null; const w = xTacWorld(XTAC.cx, XTAC.cy); let v = null, why = "";
  if (w) { if (o.range > 0 && o.from && Math.hypot(w[0] - o.from[0], w[1] - o.from[1]) > o.range) why = "Out of range"; else { try { v = o.valid ? o.valid(w[0], w[1]) : { x: w[0], y: 0, z: w[1] }; } catch (e) { v = null; } if (!v) why = "Can't go there"; } }
  XTAC.v = v; XTAC.w = w; XTAC.why = why; if (XTAC.msg) XTAC.msg.textContent = why; return v;
}
function xTacOpen(o) {
  const p = xTacProj(); if (!p) return false; xTacEl(); XTAC.o = o; XTAC.on = true; XTAC.touch = false;
  const c = p.P, fx = o.from ? o.from[0] : player.x, fz = o.from ? o.from[1] : player.z; XTAC.cx = c.X(fx); XTAC.cy = c.Z(fz);
  XTAC.title.textContent = o.name || "Select a location"; XTAC.title.style.color = o.color || "#b9a7ff";
  XTAC.hint.textContent = xTouch ? "Tap the map, then Confirm" : "Click to confirm · Right-click / Esc / " + (o.key || "X") + " to cancel";
  XTAC.el.style.display = "flex"; try { if (typeof fireHeld !== "undefined") fireHeld = false; } catch (e) {}
  xTacEval(); xTacDraw(true); return true;
}
function xTacClose() { XTAC.on = false; XTAC.o = null; if (XTAC.el) XTAC.el.style.display = "none"; }
function xTacConfirm() { const o = XTAC.o; if (!XTAC.on || !o) return false; const v = xTacEval(); if (!v) { try { sgNo(); } catch (e) {} return false; }
  let ok = false; try { ok = !!o.confirm(v.x, v.z, v.y); } catch (e) { xE(e); } if (ok) xTacClose(); return ok; }
function xTacCancel(say1) { const o = XTAC.o; if (!XTAC.on) return; xTacClose(); try { o && o.cancel && o.cancel(say1); } catch (e) { xE(e); } }
// input while the map is open: it owns FIRE / ALT FIRE / Esc (capture, so the gun never fires and the pause menu stays shut)
addEventListener("mousemove", (e) => { if (!XTAC.on) return; if (document.pointerLockElement) { XTAC.cx = Math.max(0, Math.min(XTAC.W, XTAC.cx + (e.movementX || 0) * XTAC.sens)); XTAC.cy = Math.max(0, Math.min(XTAC.W, XTAC.cy + (e.movementY || 0) * XTAC.sens)); xTacEval(); } else if (e.target === XTAC.cv) XTAC.at(e.clientX, e.clientY); e.stopImmediatePropagation(); }, true); // no camera turn while the map is up
addEventListener("mousedown", (e) => { if (!XTAC.on) return; if (e.target === XTAC.ok || e.target === XTAC.no) return; e.preventDefault(); e.stopImmediatePropagation();
  if (e.button === 2) xTacCancel(true); else if (e.button === 0 && (document.pointerLockElement || e.target === XTAC.cv)) { if (!document.pointerLockElement) XTAC.at(e.clientX, e.clientY); XTAC.eat = true; xTacConfirm(); } }, true);
addEventListener("mouseup", (e) => { if (XTAC.on || XTAC.eat) { if (!XTAC.on) XTAC.eat = false; if (e.target !== XTAC.ok && e.target !== XTAC.no) e.stopImmediatePropagation(); } }, true);
addEventListener("contextmenu", (e) => { if (XTAC.on) e.preventDefault(); }, true);
addEventListener("keydown", (e) => { if (XTAC.on && (e.key === "Escape" || e.code === "Escape")) { e.preventDefault(); e.stopImmediatePropagation(); xTacCancel(true); } }, true);
document.addEventListener("pointerlockchange", () => { if (XTAC.on && !document.pointerLockElement && !xTouch && !XTAC.free) xTacCancel(true); }); // Esc with the mouse locked: the browser drops the lock (and eats the key)
function xTacDraw(force) {
  if (!XTAC.on) return; const now = performance.now(); if (!force && now - XTAC.drawT < 33) return; XTAC.drawT = now;
  const p = xTacProj(); if (!p) return; const { C, P } = p, ctx = XTAC.ctx, W = XTAC.W, s = P.s, X = P.X, Z = P.Z;
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, W, W); ctx.fillStyle = "#101c26"; ctx.fillRect(0, 0, W, W);
  if (C.image && C.image.complete && C.image.naturalWidth) { const t = C.meta.transform, a0 = C.meta.apiProjection, ca = Math.cos(t.angle), sa = Math.sin(t.angle), pt = (u, v) => { const x = (u / 1024 - a0.xScalarToAdd) / (a0.xMultiplier * 100) - t.cx, z = -(v / 1024 - a0.yScalarToAdd) / (a0.yMultiplier * 100) - t.cz; return [ca * x + sa * z, -sa * x + ca * z]; }, o = pt(0, 0), a = pt(1, 0), d = pt(0, 1);
    ctx.save(); ctx.setTransform((a[0] - o[0]) * s, (a[1] - o[1]) * s, (d[0] - o[0]) * s, (d[1] - o[1]) * s, X(o[0]), Z(o[1])); ctx.drawImage(C.image, 0, 0, 1024, 1024); ctx.restore(); }
  ctx.font = "bold 30px Arial"; ctx.textAlign = "center"; for (const [k, q] of Object.entries(C.meta.sites || {})) { ctx.fillStyle = "#18242e"; ctx.beginPath(); ctx.arc(X(q[0]), Z(q[2]), 22, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = "#f3efcf"; ctx.fillText(k, X(q[0]), Z(q[2]) + 10); }
  const o = XTAC.o, col = o.color || "#b9a7ff";
  if (o.range > 0 && o.from) { ctx.beginPath(); ctx.arc(X(o.from[0]), Z(o.from[1]), o.range * s, 0, Math.PI * 2); ctx.strokeStyle = col; ctx.globalAlpha = 0.7; ctx.lineWidth = 3; ctx.setLineDash([12, 8]); ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1; }
  const ac = (typeof XAC !== "undefined" && XAC.on && XAC.hex) || "#5fe4df", agOf = (u) => (typeof xAg === "function" ? xAg(u) : u.agent), face = (u) => { const ry = u.g.rotation ? u.g.rotation.y || 0 : 0; return Math.atan2(Math.cos(ry), Math.sin(ry)); };
  try { for (const u of allies) if (u && u.alive && u.g) nmIcon(ctx, X(u.g.position.x), Z(u.g.position.z), 16, agOf(u), ac, face(u)); } catch (e) {}
  try { const vis = typeof mmVis !== "undefined" ? mmVis : null, ec = (typeof XEC !== "undefined" && XEC.hex) || "#ff4655"; if (vis) for (const u of bots) if (u.alive && !u.fog && vis.has(u)) nmIcon(ctx, X(u.g.position.x), Z(u.g.position.z), 16, agOf(u), ec, face(u)); } catch (e) {}
  if (player && player.hp > 0) nmIcon(ctx, X(player.x), Z(player.z), 19, (typeof J !== "undefined" && J.pick) || "Jett", "#ffffff", Math.atan2(-Math.cos(yaw), -Math.sin(yaw)));
  // the reticle: the destination ring (Omen ~0.45 m body drawn at least 18 px), cross hairs, a line from the player
  const ok = !!XTAC.v, rc = ok ? col : "#ff4655", cx = XTAC.cx, cy = XTAC.cy;
  if (player && player.hp > 0) { ctx.beginPath(); ctx.moveTo(X(player.x), Z(player.z)); ctx.lineTo(cx, cy); ctx.strokeStyle = rc; ctx.globalAlpha = 0.45; ctx.lineWidth = 2; ctx.setLineDash([6, 6]); ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1; }
  ctx.lineWidth = 4; ctx.strokeStyle = rc; ctx.beginPath(); ctx.arc(cx, cy, Math.max(18, 1.2 * s), 0, Math.PI * 2); ctx.stroke(); ctx.fillStyle = ok ? "rgba(185,167,255,.25)" : "rgba(255,70,85,.25)"; ctx.fill();
  ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(cx - 34, cy); ctx.lineTo(cx - 10, cy); ctx.moveTo(cx + 10, cy); ctx.lineTo(cx + 34, cy); ctx.moveTo(cx, cy - 34); ctx.lineTo(cx, cy - 10); ctx.moveTo(cx, cy + 10); ctx.lineTo(cx, cy + 34); ctx.stroke();
  if (!ok) { ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(cx - 9, cy - 9); ctx.lineTo(cx + 9, cy + 9); ctx.moveTo(cx + 9, cy - 9); ctx.lineTo(cx - 9, cy + 9); ctx.stroke(); }
  if (XTAC.ok) { XTAC.ok.disabled = !ok; XTAC.ok.style.opacity = ok ? "1" : ".45"; }
}
(window.XHK || (window.XHK = [])).push(function xTacTick() { if (!XTAC.on) return; const o = XTAC.o; if (!running || paused || !player || player.hp <= 0 || (o && o.alive && !o.alive())) return xTacCancel(false); xTacEval(); xTacDraw(false); });
window.xTac = { open: xTacOpen, close: xTacClose, confirm: xTacConfirm, cancel: xTacCancel, world: xTacWorld, canvas: xTacCanvas, client: xTacClient, eval: xTacEval, draw: xTacDraw, st: XTAC, on: () => XTAC.on };
// Omen From the Shadows (X): the tactical map instead of the corner-minimap click (old non-native maps keep the minimap pick).
// J.ftp stays the "map is up" flag the rest of the page reads (pause guard, ability FP / TP pose, okClear / round reset).
{ const ok0 = okKey; okKey = function (code) {
  if (J.pick === "Omen" && code === "KeyX" && typeof nmActive === "function" && nmActive()) {
    if (XTAC.on) { xTacCancel(true); return; }
    if (J.fts) return ok0.apply(this, arguments);
    if (J.ult < K().u) return ok0.apply(this, arguments);
    if (mode === "five" && FV.buy > 0) return sgNo(), say("From the Shadows · not in the buy phase", 900);
    J.ftp = true; MM.style.pointerEvents = "";
    xTacOpen({ name: "From the Shadows · select a location", color: "#b9a7ff", range: 0, from: [player.x, player.z], key: (typeof xKbName === "function" && XS && XS.keys && XS.keys.abX ? xKbName(XS.keys.abX) : "X"),
      valid: (x, z) => okFtsValid(x, z), confirm: (x, z) => okFtsAt(x, z), alive: () => J.ftp,
      cancel: (loud) => { J.ftp = false; if (loud) say("From the Shadows cancelled", 700); } });
    return;
  }
  return ok0.apply(this, arguments);
}; }
// ---- END ABILITY TARGETING ----
