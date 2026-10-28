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
// ---- Aimed placement + placement indicators (Valorant: "While equipped, his crosshair will be replaced with an indicator to place
// ... The crosshair will turn [colour] if it is placed on a viable position ... and will turn red for unviable positions").
// Before: Alarmbot / Turret went 1.5 m in front of Killjoy whatever she aimed at, Trademark and the Rendezvous anchor at Chamber's
// feet, Sage's Barrier 2.5 m ahead - and none of the placed abilities showed where they would land. Now they go where the
// crosshair meets the floor, up to each ability's wiki max (XPLACE), an indicator shows that spot while the ability is equipped
// (cyan / agent colour = viable, red = not), and a cast on an unviable spot is refused (the ability stays in hand). The trusted
// server places with the same rule (server/src/abilities.js aimFloor / PLACE_MAX).
const XPLACE = { // wiki max cast distance (m) and indicator radius (m) per agent+key
  Omen: { c: [15, 0.55, 0x8a6bff] }, Killjoy: { q: [10, 0.4, 0xf2c230], e: [4.5, 0.5, 0xf2c230] }, Sage: { c: [15, 0, 0x7fe0ff] },
  Chamber: { c: [12, 0.45, 0xd8b04a], e: [8.5, 0.7, 0xd8b04a] }, Cypher: { q: [15, 3.72, 0x3fd0c0] } };
// the floor point under the crosshair within max m (ray to the map, 0.5 m short of a hit, else max along the aim), pulled off walls;
// ok: on the nav mesh (native: a nav node within 1.5 m, playable) and not inside a wall
function xAimPlace(max) {
  const o = pEye(), d = jAim(); ray.set(o, d); ray.far = max; const h = ray.intersectObjects(solids)[0], t = h ? Math.max(0, h.distance - 0.5) : max;
  let x = o.x + d.x * t, z = o.z + d.z * t; const y0 = o.y + d.y * t; let y = xFy(x, z, Math.min(y0, o.y) + 0.1);
  for (let i = 0; i < 24 && blocked(x, z, 0.3, y); i++) { const vx = player.x - x, vz = player.z - z, l = Math.hypot(vx, vz) || 1; if (l < 0.3) break; x += (vx / l) * 0.25; z += (vz / l) * 0.25; y = xFy(x, z, Math.min(y0, o.y) + 0.1); }
  return { x, y, z, ok: xPlaceOk(x, z, y) };
}
function xPlaceOk(x, z, y) { if (!Number.isFinite(x) || !Number.isFinite(z) || !Number.isFinite(y)) return false; const C = typeof nmActive === "function" && nmActive();
  if (C) { const ni = nmNear(C, x, z); if (ni < 0 || Math.hypot(C.nav.nodes[ni][0] - x, C.nav.nodes[ni][2] - z) > 1.5 || (C.playable && !C.playable[ni]) || Math.abs(C.nav.nodes[ni][1] - y) > 2.5) return false; }
  return !blocked(x, z, 0.3, y); }
// Killjoy Alarmbot / Turret: at the crosshair (10 m / 4.5 m); Lockdown keeps its short plant in front of her (wiki 0.5 m)
{ const op0 = okPlace; okPlace = function (geo, c, dist) {
  const max = geo === kjBox ? XPLACE.Killjoy.q[0] : geo === kjTur ? XPLACE.Killjoy.e[0] : 0; if (!max) return op0.apply(this, arguments);
  const q = xAimPlace(max), m = new THREE.Mesh(geo, okMat(c)); m.position.set(q.x, q.y + geo.parameters.height / 2, q.z); m.rotation.y = yaw; scene.add(m); return m; }; }
// refuse a placed cast on an unviable spot before any charge is spent (Valorant keeps the ability in hand; the equip flow sees no cast)
function xPlaceRefuse(ag, k) { const P = XPLACE[ag] && XPLACE[ag][k]; if (!P) return false; let ok;
  if (ag === "Omen") { const g = okGround(P[0]); ok = !!okFtsValid(g.x, g.z); } else ok = xAimPlace(P[0]).ok;
  if (ok) return false; try { sgNo(); } catch (e) {} say("Can't place there", 700); return true; }
{ const ok1 = okKey; okKey = function (code) { const k = code && code[3] && code[3].toLowerCase();
  if (J.pick === "Killjoy" && (k === "q" && J.q >= 1 || k === "e" && J.e >= 1) && xPlaceRefuse("Killjoy", k)) return;
  if (J.pick === "Omen" && k === "c" && !J.om && J.c >= 1 && J.cd.c <= 0 && xPlaceRefuse("Omen", "c")) return;
  return ok1.apply(this, arguments); }; }
{ const sg1 = sgKey; sgKey = function (code) { if (code === "KeyC" && J.c >= 1 && J.cd.c <= 0 && xPlaceRefuse("Sage", "c")) return; return sg1.apply(this, arguments); }; }
{ const bc1 = bcKey; bcKey = function (code) { if (J.pick === "Chamber" && (code === "KeyC" && J.c >= 1 && J.cd.c <= 0 && xPlaceRefuse("Chamber", "c") || code === "KeyE" && !BC.an && !(J.cd.e > 0) && xPlaceRefuse("Chamber", "e"))) return; return bc1.apply(this, arguments); }; }
// the indicator: a floor ring (radius XPLACE[1]; Sage: the 10.4 m wall line across the aim) while the ability is equipped
const XPI = { ring: null, line: null, mat: null };
function xPlaceSpot(ag, k) { const P = XPLACE[ag] && XPLACE[ag][k]; if (!P) return null;
  if (ag === "Omen") { const g = okGround(P[0]), v = okFtsValid(g.x, g.z); return { x: g.x, z: g.z, y: v ? v.y : xFy(g.x, g.z, player.y + 0.1), ok: !!v, r: P[1], c: P[2] }; }
  if (ag === "Chamber" && k === "e" && BC.an) return null;
  const q = xAimPlace(P[0]); q.r = P[1]; q.c = P[2]; if (ag === "Sage") q.wall = 10.4; return q; }
function xPlaceTick() {
  const q = J.eq, show = q && (q.st === "draw" || q.st === "ready" || q.st === "hold") && running && player && player.hp > 0 && jOn(), s = show ? xPlaceSpot(J.pick, q.k) : null;
  if (!XPI.ring) { XPI.mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, depthWrite: false, side: THREE.DoubleSide }); XPI.ring = new THREE.Mesh(new THREE.RingGeometry(0.82, 1, 40), XPI.mat); XPI.ring.rotation.x = -Math.PI / 2; XPI.ring.name = "xPlaceRing"; XPI.ring.raycast = () => {}; XPI.line = new THREE.Mesh(new THREE.BoxGeometry(1, 0.06, 0.12), XPI.mat); XPI.line.name = "xPlaceLine"; XPI.line.raycast = () => {}; }
  if (!s) { if (XPI.ring.parent) scene.remove(XPI.ring); if (XPI.line.parent) scene.remove(XPI.line); XPI.s = null; return; }
  XPI.s = s; XPI.mat.color.setHex(s.ok ? s.c : 0xff4655);
  if (s.wall) { if (XPI.ring.parent) scene.remove(XPI.ring); if (!XPI.line.parent) scene.add(XPI.line); XPI.line.scale.set(s.wall, 1, 1); XPI.line.position.set(s.x, s.y + 0.05, s.z); XPI.line.rotation.set(0, yaw, 0); }
  else { if (XPI.line.parent) scene.remove(XPI.line); if (!XPI.ring.parent) scene.add(XPI.ring); XPI.ring.scale.setScalar(Math.max(0.3, s.r)); XPI.ring.position.set(s.x, s.y + 0.05, s.z); }
}
(window.XHK || (window.XHK = [])).push(function xPlaceHook() { try { xPlaceTick(); } catch (e) { xE(e); } });
window.xPlace = { aim: xAimPlace, ok: xPlaceOk, spot: xPlaceSpot, tick: xPlaceTick, st: XPI, max: XPLACE };
// ---- END ABILITY TARGETING ----
