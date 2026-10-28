// ---- GAME RULES ----
// Deathmatch health packs (user 2026-10-26 10:32: "search online for everything that you have ... and verify it's right";
// work/validation/values-game.md). VALORANT Deathmatch: a kill "drops health kits on the victim's body that can be picked up"
// (wiki.playvalorant.com/en-us/Deathmatch); the game files (valorant.gs/rules DeathmatchGameMode "Health Pack") give Lifespan 8,
// Health To Restore 50, Armor To Restore 25 and a 50 uu (0.5 m) pickup sphere. Same numbers and rule as the server
// (server/src/simulation.js HEALTH_PACK / packTick): one pack at the victim's feet, gone after 8 s or when a HURT living unit
// touches it (sphere 0.5 m + capsule 0.35 m, within 1.8 m vertically): +50 HP (max 100), +25 armour (max 50). Team Deathmatch has
// no kill heal (VALORANT heals there with Recovery Orbs: TDMREC below). Online the server owns the packs; the page
// draws the snapshot's hpk rows ([id, victim, killer, x, y, z, seconds left]).
var DMPK = { L: [], seq: 0, life: 8, hp: 50, armor: 25, r: 0.5 + 0.35, dy: 1.8, cap: 100, armorCap: 50, mat: null, geo: null };
// Escalation health packs (wiki.playvalorant.com/en-us/Escalation: a kill "drops a health pack on the victim's body that lasts for 10
// seconds and can be picked up to fully restore the user's health, shields, and ammo"; = server/src/modes.js ESC_PACK): same drop /
// pickup as Deathmatch, 10 s, health to 100 / armour to 50, both guns' magazine + reserve refilled (the player; bots carry no ammo);
// a unit at full health / armour still takes it when a gun is not full. Allies drop and pick up too (Escalation is 5v5).
var ESCPK = { life: 10, hp: 100, armor: 50, cap: 100, armorCap: 50, ammo: true };
function dmPackEsc() { return typeof FV !== 'undefined' && !!FV.dm && !!FV.tdm && !!FV.esc; }
function dmPackRule() { return dmPackEsc() ? ESCPK : DMPK; }
function dmPackOn() { return typeof FV !== 'undefined' && !!FV.dm && (!FV.tdm || !!FV.esc); }
function dmPackUnits() { return dmPackEsc() && typeof allies !== 'undefined' ? bots.concat(allies) : bots; }
function dmPackOnline() { return typeof MP !== 'undefined' && !!MP.on; }
function dmPackMesh() { // a small green kit with a white cross, slowly turning
  if (!DMPK.geo) { DMPK.geo = new THREE.BoxGeometry(0.36, 0.22, 0.36); DMPK.mat = new THREE.MeshBasicMaterial({ color: 0x3ad17a }); DMPK.xm = new THREE.MeshBasicMaterial({ color: 0xffffff }); DMPK.xa = new THREE.BoxGeometry(0.28, 0.025, 0.08); DMPK.xb = new THREE.BoxGeometry(0.08, 0.025, 0.28); }
  const g = new THREE.Group(), b = new THREE.Mesh(DMPK.geo, DMPK.mat), a = new THREE.Mesh(DMPK.xa, DMPK.xm), c = new THREE.Mesh(DMPK.xb, DMPK.xm); a.position.y = c.position.y = 0.12; g.add(b); g.add(a); g.add(c); g.name = 'xDmPack'; return g;
}
function dmPackDrop(x, y, z, id) {
  if (![x, y, z].every(Number.isFinite)) return null;
  const k = { id: id != null ? id : ++DMPK.seq, x, y, z, t: dmPackRule().life, g: null };
  try { k.g = dmPackMesh(); k.g.position.set(x, y + 0.2, z); scene.add(k.g); } catch (e) { k.g = null; }
  DMPK.L.push(k); return k;
}
function dmPackKill(k) { const i = DMPK.L.indexOf(k); if (i >= 0) DMPK.L.splice(i, 1); if (k && k.g && k.g.parent) k.g.parent.remove(k.g); }
function dmPackClear() { for (const k of DMPK.L.slice()) dmPackKill(k); }
// Restores a unit {hp, armor} from a pack; false when the unit is already full (the pack stays).
function dmPackLow() { try { return ['pri', 'pis'].some((s) => { const q = slots[s], w = s === 'pri' ? FV.pri : FV.sec; return !!(q && w && WEAP[w] && (rw === s ? ammo : q.ammo) < WEAP[w].mag || q && w && WEAP[w] && (rw === s ? rsv : q.rsv) < xRsv(w)); }); } catch (e) { return false; } }
function dmPackAmmo() { try { ['pri', 'pis'].forEach((s) => { const w = s === 'pri' ? FV.pri : FV.sec; if (w && WEAP[w] && slots[s]) { slots[s].ammo = WEAP[w].mag; slots[s].rsv = xRsv(w); } }); if (slots[rw] && rw !== 'knife') { ammo = slots[rw].ammo; rsv = slots[rw].rsv; } reloading = 0; } catch (e) {} }
function dmPackApply(u) { const R = dmPackRule(), low = R.ammo && u === player && dmPackLow(); if (!u || !(u.hp > 0) || (u.hp >= R.cap && (u.armor || 0) >= R.armorCap && !low)) return false; u.hp = Math.min(R.cap, u.hp + R.hp); u.armor = Math.max(u.armor || 0, Math.min(R.armorCap, (u.armor || 0) + R.armor)); if (low) dmPackAmmo(); return true; }
function dmPackNear(k, x, y, z) { return Math.hypot(x - k.x, z - k.z) <= DMPK.r && Math.abs((Number.isFinite(y) ? y : k.y) - k.y) <= DMPK.dy; }
function dmPackTick(dt) {
  if (!DMPK.L.length) return;
  for (const k of DMPK.L.slice()) {
    k.t -= dt; if (k.g) k.g.rotation.y += dt * 1.6;
    if (k.t <= 0) { dmPackKill(k); continue; }
    if (dmPackOnline()) continue; // online: the server picks up, the snapshot removes it
    if (player && player.hp > 0 && dmPackNear(k, player.x, player.y, player.z) && dmPackApply(player)) { dmPackKill(k); try { updHud(); blip(880, 0.06, 'triangle', 0.12); } catch (e) {} continue; }
    for (const b of dmPackUnits()) { if (!b || !b.alive || !b.g) continue; const p = b.g.position; if (dmPackNear(k, p.x, p.y, p.z) && dmPackApply(b)) { dmPackKill(k); break; } }
  }
}
if (typeof dmScore === 'function') { const s0 = dmScore; dmScore = function (by, victim) {
  const r = s0.apply(this, arguments);
  try { if (dmPackOn() && !dmPackOnline()) { if (victim === 'You') { if (player) dmPackDrop(player.x, player.y || 0, player.z); } else { const b = dmPackUnits().find((x) => x.name === victim); if (b && b.g) dmPackDrop(b.g.position.x, b.g.position.y, b.g.position.z); } } } catch (e) {}
  return r; }; }
if (typeof dmTick === 'function') { const t0 = dmTick; dmTick = function (dt) { const r = t0.apply(this, arguments); try { if (dmPackOn() && running) dmPackTick(window.xLdOn ? 0 : dt); else if (DMPK.L.length && !dmPackOnline()) dmPackClear(); } catch (e) {} return r; }; }
if (typeof dmGo === 'function') { const g0 = dmGo; dmGo = function () { dmPackClear(); return g0.apply(this, arguments); }; }
// Online Deathmatch: draw the server's packs (fog-filtered per player, server/src/fog.js) and spin / expire them between snapshots.
function dmPackSync(rows) {
  const seen = new Set();
  for (const r of rows) { if (!Array.isArray(r) || !Number.isFinite(r[0])) continue; seen.add(r[0]); let k = DMPK.L.find((q) => q.id === r[0]); if (!k) k = dmPackDrop(+r[3], +r[4], +r[5], r[0]); if (k) k.t = Math.max(0, +r[6] || 0); }
  for (const k of DMPK.L.slice()) if (!seen.has(k.id)) dmPackKill(k);
}
if (typeof mpCliSnap === 'function') { const c0 = mpCliSnap; let last = 0; mpCliSnap = function (m) { const r = c0.apply(this, arguments);
  try { const now = performance.now(), dt = last ? Math.min(0.25, (now - last) / 1000) : 0; last = now; for (const k of DMPK.L) if (k.g) k.g.rotation.y += dt * 1.6; // turned once per snapshot (~20 Hz)
    if (m && Array.isArray(m.hpk)) dmPackSync(m.hpk); else if (m && Array.isArray(m.u) && DMPK.L.length && dmPackOnline()) dmPackSync([]); } catch (e) {}
  return r; }; }
// Team Deathmatch Recovery Orbs (wiki.playvalorant.com/en-us/Team_Deathmatch "Orbs": "Grants a 6-second buff that restores Health and
// Armor or Shield (not including the regeneration pool from Regen Shield) depending on the player's loadout. Each Recovery Orb respawns
// every 30 seconds"; running over one also leaves "a zone that allies can enter to also receive its effects"). Same rule, numbers
// and spots as the server (server/src/tdmorbs.js TDM_REC / TDM_REC_SPOTS, pinned by server/test-tdm-orbs.js): the orb on the nav
// node nearest a named callout of the native map, taken by a hurt unit within 0.9 m, a full bar over the 6 s (100 HP and the
// loadout's armour cap, tdmArmOf), a 3 m / 6 s zone for that unit's team. Offline the page runs it; online it draws the server's
// tro / trz rows. Inferred (unpublished): rate, reach, hurt-only, zone size, spots (Riot's TDM maps are not in the game).
var TDMREC = { buff: 6, respawn: 30, r: 0.9, dy: 1.8, zone: 3, zoneLife: 6, hpRate: 100 / 6, L: [], Z: [], key: null, t: 0, geo: null, mat: null, rg: null, rm: null, zm: null,
  spots: { ascent: ['Mid Courtyard', 'Mid Market', 'A Main', 'B Main'], bind: ['A Short', 'B Long', 'A Lobby', 'B Hall'], haven: ['Mid Courtyard', 'A Long', 'C Long', 'B Site'], split: ['Mid Bottom', 'Mid Top', 'A Main', 'B Lobby'], lotus: ['B Main', 'A Main', 'C Main', 'B Site'], breeze: ['Mid Wood Doors', 'Mid Top', 'A Shop', 'B Elbow'] } };
window.XTDM_REC_SPOTS = TDMREC.spots; window.xTdmRec = TDMREC;
function tdmRecOn() { return typeof FV !== 'undefined' && !!FV.dm && !!FV.tdm && !FV.esc; }
function tdmRecMesh() { // a green cross in a turning ring
  if (!TDMREC.geo) { TDMREC.geo = new THREE.OctahedronGeometry(0.24, 0); TDMREC.mat = new THREE.MeshBasicMaterial({ color: 0x5dff9a, transparent: true, opacity: 0.95 }); TDMREC.rg = new THREE.RingGeometry(0.42, 0.5, 24); TDMREC.rm = new THREE.MeshBasicMaterial({ color: 0x5dff9a, transparent: true, opacity: 0.4, side: THREE.DoubleSide, depthWrite: false }); TDMREC.zg = new THREE.RingGeometry(TDMREC.zone - 0.12, TDMREC.zone, 40); TDMREC.zm = new THREE.MeshBasicMaterial({ color: 0x5dff9a, transparent: true, opacity: 0.3, side: THREE.DoubleSide, depthWrite: false }); }
  const g = new THREE.Group(), c = new THREE.Mesh(TDMREC.geo, TDMREC.mat), r = new THREE.Mesh(TDMREC.rg, TDMREC.rm); c.position.y = 1; c.scale.set(1, 1.4, 1); r.rotation.x = -Math.PI / 2; r.position.y = 0.04; c.raycast = r.raycast = () => {}; g.add(c, r); g.name = 'xTdmRec'; return g;
}
function tdmRecClear() { for (const o of TDMREC.L) if (o.g && o.g.parent) o.g.parent.remove(o.g); for (const z of TDMREC.Z) if (z.g && z.g.parent) z.g.parent.remove(z.g); TDMREC.L.length = 0; TDMREC.Z.length = 0; TDMREC.key = null; }
function tdmRecAdd(id, x, y, z) { const o = { id, x, y, z, readyAt: 0, g: null }; try { o.g = tdmRecMesh(); o.g.position.set(x, y, z); scene.add(o.g); } catch (e) { o.g = null; } TDMREC.L.push(o); return o; }
function tdmRecReset(C) { tdmRecClear(); TDMREC.key = C; TDMREC.t = 0; const map = typeof FV !== 'undefined' ? FV.map : '', calls = C && C.meta && Array.isArray(C.meta.callouts) ? C.meta.callouts : [];
  (TDMREC.spots[map] || []).forEach((name, id) => { const c = calls.find((q) => q.name === name); if (!c || !c.position) return; let q = c.position; try { const k = nmNear(C, q[0], q[2], q[1]); if (k >= 0 && C.nav.nodes[k]) q = C.nav.nodes[k]; } catch (e) {} tdmRecAdd(id, q[0], q[1], q[2]); }); }
function tdmRecCap(u) { try { const t = tdmTier(); return tdmArmOf(t, u === player ? (t && FV.pri && TDM_BW[t].includes(FV.pri) ? FV.pri : FV.sec) : u.w).a; } catch (e) { return 50; } }
function tdmRecUnits() { const a = []; try { if (player && player.hp > 0) a.push({ u: player, x: player.x, y: player.y || 0, z: player.z, team: 0 }); } catch (e) {} try { for (const b of allies) if (b && b.alive && b.g) a.push({ u: b, x: b.g.position.x, y: b.g.position.y, z: b.g.position.z, team: 0 }); } catch (e) {} try { for (const b of bots) if (b && b.alive && b.g) a.push({ u: b, x: b.g.position.x, y: b.g.position.y, z: b.g.position.z, team: 1 }); } catch (e) {} return a; }
function tdmRecTick(dt) { // offline
  let C = null; try { C = typeof nmActive === 'function' ? nmActive() : null; } catch (e) {} if (!C) { if (TDMREC.L.length) tdmRecClear(); return; } if (TDMREC.key !== C) tdmRecReset(C);
  const T = (TDMREC.t += dt), U = tdmRecUnits(), hurt = (e) => e.u.hp < 100 || (e.u.armor || 0) < tdmRecCap(e.u);
  for (const o of TDMREC.L) { const up = o.readyAt <= T; if (o.g) { o.g.visible = up; o.g.children[0].rotation.y += dt * 1.6; } if (!up) continue;
    for (const e of U) { if (Math.hypot(e.x - o.x, e.z - o.z) > TDMREC.r || Math.abs(e.y - o.y) > TDMREC.dy || !hurt(e)) continue; o.readyAt = T + TDMREC.respawn; if (o.g) o.g.visible = false; e.u.recT = T + TDMREC.buff; tdmRecZone(o.x, o.y, o.z, e.team, T + TDMREC.zoneLife, e.u); if (e.u === player) { try { blip(660, 0.08, 'triangle', 0.12); } catch (er) {} } break; } }
  for (let i = TDMREC.Z.length - 1; i >= 0; i--) { const z = TDMREC.Z[i]; if (z.until <= T) { if (z.g && z.g.parent) z.g.parent.remove(z.g); TDMREC.Z.splice(i, 1); continue; } for (const e of U) if (e.team === z.team && e.u !== z.by && Math.hypot(e.x - z.x, e.z - z.z) <= TDMREC.zone && Math.abs(e.y - z.y) <= TDMREC.dy) e.u.recT = Math.max(e.u.recT || 0, z.until); }
  let hud = false; for (const e of U) { const u = e.u; if (!(u.recT > T)) continue; const cap = tdmRecCap(u); u.hp = Math.min(100, u.hp + TDMREC.hpRate * dt); if ((u.armor || 0) < cap) u.armor = Math.min(cap, (u.armor || 0) + cap / TDMREC.buff * dt); if (u === player) hud = true; }
  if (hud) { try { updHud(); } catch (e) {} }
}
function tdmRecZone(x, y, z, team, until, by) { const Z = { x, y, z, team, until, by, g: null }; try { Z.g = new THREE.Mesh(TDMREC.zg, TDMREC.zm); Z.g.rotation.x = -Math.PI / 2; Z.g.position.set(x, y + 0.05, z); Z.g.raycast = () => {}; scene.add(Z.g); } catch (e) { Z.g = null; } TDMREC.Z.push(Z); return Z; }
// Online: the server's rows (tro [[id, x, y, z, s until back]], trz [[x, y, z, s left, team]]).
function tdmRecSync(tro, trz) {
  const seen = new Set(); for (const r of tro) { if (!Array.isArray(r) || ![1, 2, 3].every((i) => Number.isFinite(r[i]))) continue; seen.add(r[0]); let o = TDMREC.L.find((q) => q.id === r[0]); if (!o) o = tdmRecAdd(r[0], +r[1], +r[2], +r[3]); if (o.g) { o.g.visible = !(+r[4] > 0); o.g.children[0].rotation.y += 0.08; } }
  for (const o of TDMREC.L.slice()) if (!seen.has(o.id)) { if (o.g && o.g.parent) o.g.parent.remove(o.g); TDMREC.L.splice(TDMREC.L.indexOf(o), 1); }
  for (const z of TDMREC.Z) if (z.g && z.g.parent) z.g.parent.remove(z.g); TDMREC.Z.length = 0; for (const r of (Array.isArray(trz) ? trz : [])) if (Array.isArray(r) && [0, 1, 2].every((i) => Number.isFinite(r[i]))) tdmRecZone(+r[0], +r[1], +r[2], r[4], +r[3], null);
}
if (typeof tdmTick === 'function') { const t0 = tdmTick; tdmTick = function (dt) { const r = t0.apply(this, arguments); try { if (tdmRecOn() && running && !dmPackOnline()) tdmRecTick(window.xLdOn ? 0 : dt); } catch (e) {} return r; }; }
if (typeof dmGo === 'function') { const g1 = dmGo; dmGo = function () { tdmRecClear(); return g1.apply(this, arguments); }; }
if (typeof dmEnd === 'function') { const e1 = dmEnd; dmEnd = function () { tdmRecClear(); return e1.apply(this, arguments); }; }
if (typeof startFive === 'function') { const f1 = startFive; startFive = function () { tdmRecClear(); return f1.apply(this, arguments); }; }
if (typeof mpCliSnap === 'function') { const c1 = mpCliSnap; mpCliSnap = function (m) { const r = c1.apply(this, arguments);
  try { if (m && Array.isArray(m.tro)) tdmRecSync(m.tro, m.trz); else if (m && Array.isArray(m.u) && TDMREC.L.length && dmPackOnline()) tdmRecClear(); } catch (e) {}
  return r; }; }
// TDM abilities and ultimates (wiki.playvalorant.com/en-us/Team_Deathmatch "Abilities", fetched 2026-10-28) = server/src/tdmabil.js
// (TDM_CD / TDM_ULT, pinned by work/test_tdm_abilities_offline.cjs): charges recharge on the TDM cooldown table (seconds per use);
// the signature starts full (+50 % of the next when it holds two), basics at 50 %; no buying, no 2-kill signature refill; ult points
// from kills (3) and TDM Ultimate Orbs (10) up to the TDM cost, shown as the kit's pips (J.ult = floor(points / cost * pips), full at
// the cost); a death gives none. Offline: the player and the bots (tdmBot* below). Online (server tdm.js, rs tab 1):
// the server keeps the charges and points (rs ab / tp / uc); the page turns its abilities on for the match and sends its casts.
var TDMAB = { kill: 3, orb: 10, k: 0,
  cd: { Jett: { c: 29, q: 44, e: 44, sig: 'e' }, Phoenix: { c: 48, q: 54, e: 44, sig: 'q' }, Sova: { c: 51, q: 26, e: 48, sig: 'e' }, Sage: { c: 94, q: 51, e: 22, sig: 'e' }, Reyna: { c: 51, q: 44, sig: 'q' }, Omen: { c: 33, q: 73, e: 65, sig: 'e' }, Killjoy: { c: 54, q: 44, e: 36, sig: 'e' }, Raze: { c: 48, q: 26, e: 58, sig: 'e' }, Skye: { c: 65, q: 51, e: 44, sig: 'e' }, Breach: { c: 58, q: 44, e: 55, sig: 'e' }, Cypher: { c: 29, q: 58, e: 22, sig: 'e' }, Chamber: { c: 46, q: 9, e: 51, sig: 'e' } },
  ult: { Jett: 60, Phoenix: 70, Sova: 70, Sage: 50, Reyna: 80, Omen: 60, Killjoy: 90, Raze: 80, Skye: 70, Breach: 90, Cypher: 50, Chamber: 70 } };
window.xTdmAb = TDMAB;
function tdmAbNet() { return (typeof NET !== 'undefined' && NET && NET.socket) || (typeof MP !== 'undefined' && MP && MP.on); }
function tdmAbOn() { return typeof FV !== 'undefined' && !!FV.dm && !!FV.tdm && !FV.esc && typeof J !== 'undefined' && !!J.on && !tdmAbNet(); }
function tdmAbMax(k) { const M = K().mx || {}; return k === 'e' ? (M.e || 1) : (M[k] || 0); }
function tdmAbCost() { return TDMAB.ult[J.pick] || TDMAB.ult.Jett; }
function tdmAbPips() { const c = tdmAbCost(), n = K().u; return (J.tp || 0) >= c ? n : Math.floor((J.tp || 0) / c * n); }
function tdmAbInit() { const T = TDMAB.cd[J.pick] || TDMAB.cd.Jett; J.tdp = {}; for (const k of ['c', 'q', 'e']) { if (!(T[k] > 0)) continue; const mx = tdmAbMax(k); if (!(mx > 0)) continue; if (k === T.sig) { J[k] = 1; J.tdp[k] = mx > 1 ? 0.5 : 0; } else { J[k] = 0; J.tdp[k] = 0.5; } } J.tp = 0; J.ult = 0; J.tdU = 0; J.tk = 0; }
function tdmAbPts(n) { const was = J.ult; J.tp = Math.min(tdmAbCost(), (J.tp || 0) + n); J.ult = tdmAbPips(); J.tdU = J.ult; if (was < K().u && J.ult >= K().u) try { SFX.ult(); } catch (e) {} }
function tdmAbTick(dt) { if (!J.tdp) tdmAbInit(); const T = TDMAB.cd[J.pick] || TDMAB.cd.Jett;
  if ((J.ult || 0) < (J.tdU || 0)) J.tp = 0; /* the ult was cast */ J.ult = tdmAbPips(); J.tdU = J.ult;
  for (const k of ['c', 'q', 'e']) { const cd = T[k]; if (!(cd > 0)) continue; const mx = tdmAbMax(k); if (!((J[k] || 0) < mx)) { J.tdp[k] = 0; continue; } J.tdp[k] = (J.tdp[k] || 0) + dt / cd; if (J.tdp[k] >= 1) { J[k] = Math.min(mx, (J[k] || 0) + 1); J.tdp[k] = J[k] < mx ? J.tdp[k] - 1 : 0; try { xAbIcons(); } catch (e) {} } } }
if (typeof startTDM === 'function') { const s2 = startTDM; startTDM = function () { J.tdp = null; return s2.apply(this, arguments); }; }
if (typeof tdmAb === 'function') { const a2 = tdmAb; tdmAb = function () { const keep = J.tdp ? [J.c, J.q, J.e] : null; const r = a2.apply(this, arguments); try { if (tdmAbOn()) { if (keep) [J.c, J.q, J.e] = keep; else tdmAbInit(); } } catch (e) {} return r; }; }
if (typeof tdmTick === 'function') { const t2 = tdmTick; tdmTick = function (dt) { const r = t2.apply(this, arguments); try { if (tdmAbOn() && running) tdmAbTick(window.xLdOn ? 0 : dt); } catch (e) {} return r; }; }
if (typeof jKill === 'function') { const k2 = jKill; jKill = function () { if (!tdmAbOn()) return k2.apply(this, arguments); tdmAbPts(TDMAB.kill); if (J.pick === 'Jett' && J.bsOn) J.bs = 5; /* Blade Storm kill refresh; no 2-kill signature refill in TDM */ }; }
if (typeof jUlt === 'function') { const u2 = jUlt; jUlt = function () { if (tdmAbOn()) return; /* TDM: no ult point for a death (kills: jKill above, orbs: tdmAbPts) */ return u2.apply(this, arguments); }; }
if (typeof feed === 'function') { const f2 = feed; feed = function (s) { if (s === 'Ability charges refilled' && tdmAbOn()) return; return f2.apply(this, arguments); }; }
// Offline TDM bots and allies recharge on the same TDM table (their kit charges b.ab.kc): signature 1 (+50 %), basics 50 % at the
// start, 1 / cooldown per second after, no 40 s full refill (tdmAb keeps their charges) and no 2-kill signature refill (xBKill).
function tdmBotOn() { return typeof FV !== 'undefined' && !!FV.dm && !!FV.tdm && !FV.esc && !tdmAbNet(); }
function tdmBotInit(b) { const a = xBAg(b); if (!a) return; const T = TDMAB.cd[a] || TDMAB.cd.Jett, M = (KITS[a] || KITS.Jett).mx, A = b.ab || (b.ab = { t: 0, saw: false, rbT: 2 + Math.random() * 6 }), c = A.kc || (A.kc = xBFull(a)); A.tdp = {};
  for (const k of ['c', 'q', 'e']) { if (!(T[k] > 0)) continue; const mx = k === 'e' ? (M.e || 1) : (M[k] || 0); if (!(mx > 0)) continue; if (k === T.sig) { c[k] = 1; A.tdp[k] = mx > 1 ? 0.5 : 0; } else { c[k] = 0; A.tdp[k] = 0.5; } } c.tk = 0; }
function tdmBotTick(dt) { for (const b of srAll()) { if (!b) continue; if (!b.ab || !b.ab.tdp) { tdmBotInit(b); continue; } const a = xBAg(b); if (!a) continue; const T = TDMAB.cd[a] || TDMAB.cd.Jett, M = (KITS[a] || KITS.Jett).mx, A = b.ab, c = A.kc || (A.kc = xBFull(a));
  for (const k of ['c', 'q', 'e']) { const cd = T[k]; if (!(cd > 0)) continue; const mx = k === 'e' ? (M.e || 1) : (M[k] || 0); if (!((c[k] || 0) < mx)) { A.tdp[k] = 0; continue; } A.tdp[k] = (A.tdp[k] || 0) + dt / cd; if (A.tdp[k] >= 1) { c[k] = Math.min(mx, (c[k] || 0) + 1); A.tdp[k] = c[k] < mx ? A.tdp[k] - 1 : 0; } } } }
window.xTdmBotTick = tdmBotTick;
if (typeof tdmAb === 'function') { const a3 = tdmAb; tdmAb = function () { const on = tdmBotOn(), L = on ? srAll() : [], keep = L.map((b) => b && b.ab && b.ab.tdp && b.ab.kc ? { c: b.ab.kc.c, q: b.ab.kc.q, e: b.ab.kc.e, tk: 0 } : null); const r = a3.apply(this, arguments);
  if (on) try { L.forEach((b, i) => { if (!b) return; if (keep[i] && b.ab) Object.assign(b.ab.kc || (b.ab.kc = {}), keep[i]); else tdmBotInit(b); }); } catch (e) {} return r; }; }
if (typeof startTDM === 'function') { const s3 = startTDM; startTDM = function () { try { srAll().forEach((b) => { if (b && b.ab) b.ab.tdp = null; }); } catch (e) {} return s3.apply(this, arguments); }; }
if (typeof tdmTick === 'function') { const t3 = tdmTick; tdmTick = function (dt) { const r = t3.apply(this, arguments); try { if (tdmBotOn() && running) tdmBotTick(window.xLdOn ? 0 : dt); } catch (e) {} return r; }; }
if (typeof xBKill === 'function') { const b3 = xBKill; xBKill = function (by) { if (!tdmBotOn()) return b3.apply(this, arguments); if (!by || typeof by !== 'string' || !jOn()) return; let u = null; for (const x of bots) if (x.name === by) u = x; if (!u) for (const x of allies) if (x.name === by) u = x;
  if (u && u.ab && u.ab.tw) u.ab.tw.k = (u.ab.tw.k || 0) + 1; /* Tailwind entry bookkeeping only: no 2-kill signature refill in TDM */ }; }
if (typeof mpCliRS === 'function') { const r2 = mpCliRS; mpCliRS = function (r) { try { if (r && r.tab === 1 && typeof NET !== 'undefined' && NET.socket && MP.st === 'game' && FV.tdm && !FV.esc && !J.on && KITS[J.pick]) { J.on = true; J.bs = 0; J.bsOn = false; J.tk = 0; J.cd = { c: 0, q: 0, e: 0, x: 0 }; J.hs = ''; NET.tab = 1; try { xAbIcons(); } catch (e) {} } } catch (e) {} return r2.apply(this, arguments); }; }
window.xDmPacks = DMPK; window.xEscPacks = ESCPK;
// ---- END GAME RULES ----
