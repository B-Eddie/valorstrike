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
  if (!dmPackOnline()) try { const C=typeof nmActive==='function'&&nmActive(); const floor=C?nmHeight(C,x,z,y):groundAt(x,z,0.2,y); if(Number.isFinite(floor)&&floor<=y+0.32)y=floor; } catch(e) {}
  const k = { id: id != null ? id : ++DMPK.seq, x, y, z, t: dmPackRule().life, g: null };
  try { k.g = dmPackMesh(); k.g.position.set(x, y + 0.11, z); scene.add(k.g); } catch (e) { k.g = null; }
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
// TDM Ultimate Orbs (wiki Team_Deathmatch / Orbs, fetched 2026-10-28) = server/src/tdmorbs.js TDM_UO: all spawn together periodically
// at fixed spots; contact (no channel) = 10 points and a zone that gives each ally the same 10 once. Inferred (unpublished): waves at
// 30 s then every 60 s, spots = the Unrated orb callouts (XUO_SPOTS = server ORB_SPOTS), zone 3 m / 6 s. Offline the player's points
// (tdmAbPts); a bot or ally taking one only removes it (page bots have no TDM points). Online: the snapshot's tuo / tuz rows.
var TDMUO = { pts: 10, first: 30, every: 60, r: 0.9, dy: 1.8, zone: 3, zoneLife: 6, L: [], Z: [], key: null, t: 0, wave: 0, geo: null, mat: null, zg: null, zm: null };
window.xTdmUo = TDMUO;
function tdmUoMesh() { if (!TDMUO.geo) { TDMUO.geo = new THREE.IcosahedronGeometry(0.28, 0); TDMUO.mat = new THREE.MeshBasicMaterial({ color: 0xffd34d, transparent: true, opacity: 0.95 }); TDMUO.zg = new THREE.RingGeometry(TDMUO.zone - 0.12, TDMUO.zone, 40); TDMUO.zm = new THREE.MeshBasicMaterial({ color: 0xffd34d, transparent: true, opacity: 0.3, side: THREE.DoubleSide, depthWrite: false }); }
  const g = new THREE.Group(), c = new THREE.Mesh(TDMUO.geo, TDMUO.mat); c.position.y = 1; c.raycast = () => {}; g.add(c); g.name = 'xTdmUo'; return g; }
function tdmUoClear() { for (const o of TDMUO.L) if (o.g && o.g.parent) o.g.parent.remove(o.g); for (const z of TDMUO.Z) if (z.g && z.g.parent) z.g.parent.remove(z.g); TDMUO.L.length = 0; TDMUO.Z.length = 0; TDMUO.key = null; TDMUO.wave = 0; TDMUO.t = 0; }
function tdmUoAdd(id, x, y, z) { const o = { id, x, y, z, up: false, g: null }; try { o.g = tdmUoMesh(); o.g.position.set(x, y, z); o.g.visible = false; scene.add(o.g); } catch (e) { o.g = null; } TDMUO.L.push(o); return o; }
function tdmUoZone(x, y, z, team, until) { const Z = { x, y, z, team, until, got: new Set(), g: null }; try { tdmUoMesh(); Z.g = new THREE.Mesh(TDMUO.zg, TDMUO.zm); Z.g.rotation.x = -Math.PI / 2; Z.g.position.set(x, y + 0.05, z); Z.g.raycast = () => {}; scene.add(Z.g); } catch (e) { Z.g = null; } TDMUO.Z.push(Z); return Z; }
function tdmUoReset(C) { tdmUoClear(); TDMUO.key = C; const map = typeof FV !== 'undefined' ? FV.map : '', calls = C && C.meta && Array.isArray(C.meta.callouts) ? C.meta.callouts : [], S = window.XUO_SPOTS || {};
  (S[map] || []).forEach((name, id) => { const c = calls.find((q) => q.name === name); if (!c || !c.position) return; let q = c.position; try { const k = nmNear(C, q[0], q[2], q[1]); if (k >= 0 && C.nav.nodes[k]) q = C.nav.nodes[k]; } catch (e) {} tdmUoAdd(id, q[0], q[1], q[2]); }); }
function tdmUoTick(dt) { // offline
  let C = null; try { C = typeof nmActive === 'function' ? nmActive() : null; } catch (e) {} if (!C) { if (TDMUO.L.length) tdmUoClear(); return; } if (TDMUO.key !== C) tdmUoReset(C);
  const T = (TDMUO.t += dt), w = T < TDMUO.first - 1e-9 ? 0 : 1 + Math.floor((T - TDMUO.first + 1e-9) / TDMUO.every);
  if (w > TDMUO.wave) { TDMUO.wave = w; for (const o of TDMUO.L) o.up = true; try { feed('Ultimate orbs are up'); } catch (e) {} }
  const U = tdmRecUnits();
  for (const o of TDMUO.L) { if (o.g) { o.g.visible = o.up; o.g.children[0].rotation.y += dt * 2; } if (!o.up) continue;
    for (const e of U) { if (Math.hypot(e.x - o.x, e.z - o.z) > TDMUO.r || Math.abs(e.y - o.y) > TDMUO.dy) continue; o.up = false; if (o.g) o.g.visible = false; const Z = tdmUoZone(o.x, o.y, o.z, e.team, T + TDMUO.zoneLife); Z.got.add(e.u); if (e.u === player) { tdmAbPts(TDMUO.pts); try { say('Ult orb · +' + TDMUO.pts + ' points', 900); } catch (er) {} } break; } }
  for (let i = TDMUO.Z.length - 1; i >= 0; i--) { const z = TDMUO.Z[i]; if (z.until <= T) { if (z.g && z.g.parent) z.g.parent.remove(z.g); TDMUO.Z.splice(i, 1); continue; }
    if (z.team === 0 && !z.got.has(player) && player && player.hp > 0 && Math.hypot(player.x - z.x, player.z - z.z) <= TDMUO.zone && Math.abs((player.y || 0) - z.y) <= TDMUO.dy) { z.got.add(player); tdmAbPts(TDMUO.pts); try { say('Ult orb zone · +' + TDMUO.pts + ' points', 900); } catch (er) {} } } }
function tdmUoSync(tuo, tuz) { // online: tuo [[id, x, y, z, up]], tuz [[x, y, z, s left, team]]
  const seen = new Set(); for (const r of tuo) { if (!Array.isArray(r) || ![1, 2, 3].every((i) => Number.isFinite(r[i]))) continue; seen.add(r[0]); let o = TDMUO.L.find((q) => q.id === r[0]); if (!o) o = tdmUoAdd(r[0], +r[1], +r[2], +r[3]); o.up = r[4] === 1; if (o.g) { o.g.visible = o.up; o.g.children[0].rotation.y += 0.08; } }
  for (const o of TDMUO.L.slice()) if (!seen.has(o.id)) { if (o.g && o.g.parent) o.g.parent.remove(o.g); TDMUO.L.splice(TDMUO.L.indexOf(o), 1); }
  for (const z of TDMUO.Z) if (z.g && z.g.parent) z.g.parent.remove(z.g); TDMUO.Z.length = 0; for (const r of (Array.isArray(tuz) ? tuz : [])) if (Array.isArray(r) && [0, 1, 2].every((i) => Number.isFinite(r[i]))) tdmUoZone(+r[0], +r[1], +r[2], r[4], +r[3]); }
if (typeof tdmTick === 'function') { const t4 = tdmTick; tdmTick = function (dt) { const r = t4.apply(this, arguments); try { if (tdmAbOn() && running) tdmUoTick(window.xLdOn ? 0 : dt); } catch (e) {} return r; }; }
if (typeof dmGo === 'function') { const g3 = dmGo; dmGo = function () { tdmUoClear(); return g3.apply(this, arguments); }; }
if (typeof dmEnd === 'function') { const e3 = dmEnd; dmEnd = function () { tdmUoClear(); return e3.apply(this, arguments); }; }
if (typeof startFive === 'function') { const f3 = startFive; startFive = function () { tdmUoClear(); return f3.apply(this, arguments); }; }
if (typeof mpCliSnap === 'function') { const c3 = mpCliSnap; mpCliSnap = function (m) { const r = c3.apply(this, arguments);
  try { if (m && Array.isArray(m.tuo)) tdmUoSync(m.tuo, m.tuz); else if (m && Array.isArray(m.u) && TDMUO.L.length && tdmAbNet()) tdmUoClear(); } catch (e) {}
  return r; }; }
// Spike Rush Powerup Orbs (wiki.playvalorant.com/en-us/Spike_Rush "Powerup Orbs", fetched 2026-10-28) = server/src/srpowerups.js
// (SR_PW / srPickSet / srOrbTypes, pinned by work/test_sr_powerups_page.cjs): five effects chosen at the start (Ultimate always, one
// of Crippling Decay / Paranoia - at most once a round - and three of the built ones); each orb a type from that set; a capture =
// +1 ult point (the Ultimate orb: full) plus its effect. Offline the player captures (page bots / allies do not): Damage Amp (+30 %
// of the player's gun damage for the round), Health Regen (player and allies 10 HP/s for 20 s out of combat: no damage taken, no shot
// for 3 s), Crippling Decay (after 3 s every enemy bot -50 HP, never below 1, given back 8 s later), Paranoia (after 3 s, 8 s; page
// bots have no vision model: only the feed line), Combat Stim (a 6 m beacon for 12 s at the capture point: stim x1.1 inside, xStimK),
// Weapon Upgrade (next round's set; round 3 / Endgame Operator or Odin; with an Operator: a sidearm). Golden Gun and Twin Hunters are implemented below; Tracer Rounds remain outside the draw. Online the server runs them: orb rows carry the type (o[5]) and the round state's pw the
// player's active ones (HUD line, stim; work/server_runtime.js nmOrbs / nmVarHud).
// Inferred (unpublished, in the audit): out of combat = 3 s, decay never kills and is given back, the Stim beacon 6 m / 12 s at x1.1.
var SRPW = { amp: { k: 1.3 }, regen: { rate: 10, life: 20, calm: 3 }, decay: { delay: 3, life: 8, hp: 50 }, paranoia: { delay: 3, life: 8 }, stim: { radius: 6, life: 12 },
  pool: ['stim', 'amp', 'regen', 'upgrade', 'golden', 'hunters'], names: { ult: 'Ultimate', amp: 'Damage Amp', regen: 'Health Regen', decay: 'Crippling Decay', paranoia: 'Paranoia', stim: 'Combat Stim', upgrade: 'Weapon Upgrade', golden: 'Golden Gun', hunters: 'Twin Hunters' },
  col: { ult: 0xffd34d, amp: 0xff5a4e, regen: 0x5dff9a, decay: 0x9b59ff, paranoia: 0x6a5acd, stim: 0x47c8ff, upgrade: 0xf2f2f2, golden: 0xffcc42, hunters: 0x71c9d8 },
  set: null, t: 0, ampOn: false, regenUntil: 0, hitAt: -1e9, shotAt: -1e9, lastHp: 100, beacons: [], pend: [], dec: [], stimOn: false, mine: 0, net: [] };
window.xSrPw = SRPW;
function srPwPickSet(rnd) { const pool = SRPW.pool.slice(), set = ['ult', rnd() < 0.5 ? 'decay' : 'paranoia']; while (set.length < 5 && pool.length) set.push(pool.splice(Math.floor(rnd() * pool.length), 1)[0]); return set; }
function srPwTypes(set, n, rnd) { const out = []; for (let i = 0; i < n; i++) { const ok = set.filter((t) => !((t === 'decay' || t === 'paranoia') && out.includes(t))); out.push(ok[Math.floor(rnd() * ok.length)]); } return out; }
function srPwRound() { SRPW.ampOn = false; SRPW.regenUntil = 0; SRPW.beacons.length = 0; SRPW.pend.length = 0; SRPW.stimOn = false; for (const d of SRPW.dec) if (d.b && d.b.alive) d.b.hp = Math.min(100, d.b.hp + d.amt); SRPW.dec.length = 0; }
function srPwGive() { const L = srLoad(), li = Math.max(0, SR_LOAD.indexOf(L)); let w, slot = 'pri';
  if (li >= 2) { if (FV.pri === 'Operator') { const S = SR_SIDE.filter((x) => x !== 'Classic' && x !== FV.sec); w = S[Math.floor(Math.random() * S.length)] || 'Sheriff'; slot = 'pis'; } else w = Math.random() < 0.5 ? 'Operator' : 'Odin'; }
  else { const N = SR_LOAD[li + 1].w; w = N[Math.floor(Math.random() * N.length)]; }
  try { bEquip(w, slot); swapW(slot); } catch (e) {} return w; }
function srPwTake(o) { const ty = o.type || 'ult';
  if (ty === 'ult') { const was = J.ult; J.ult = K().u; if (was < K().u) try { SFX.ult(); } catch (e) {} } else { try { jUlt(); } catch (e) {} }
  if (ty === 'amp') SRPW.ampOn = true;
  else if (ty === 'regen') SRPW.regenUntil = SRPW.t + SRPW.regen.life;
  else if (ty === 'decay' || ty === 'paranoia') SRPW.pend.push({ ty, at: SRPW.t + SRPW[ty].delay });
  else if (ty === 'stim') SRPW.beacons.push({ x: o.x, z: o.z, until: SRPW.t + SRPW.stim.life });
  let extra = ''; if (ty === 'upgrade') extra = ' · ' + srPwGive();
  try { feed('You took a power orb · ' + (SRPW.names[ty] || ty) + extra); say((SRPW.names[ty] || ty) + extra, 1200); } catch (e) {} }
function srPwTick(dt) { const T = (SRPW.t += dt);
  if (player.hp < SRPW.lastHp - 1e-9) SRPW.hitAt = T; /* a shot: the shoot wrapper below */
  if (player.hp > 0) for (let i = SR.orbs.length - 1; i >= 0; i--) { const o = SR.orbs[i]; if (Math.hypot(player.x - o.x, player.z - o.z) < 1.6) { try { if (o.m) scene.remove(o.m); } catch (e) {} SR.orbs.splice(i, 1); srPwTake(o); } }
  for (const e of SRPW.pend.splice(0)) { if (e.at > T) { SRPW.pend.push(e); continue; } if (e.ty === 'decay') { for (const b of bots) if (b && b.alive) { const d = Math.max(0, Math.min(SRPW.decay.hp, b.hp - 1)); b.hp -= d; SRPW.dec.push({ b, amt: d, until: T + SRPW.decay.life }); } try { feed('Crippling Decay hits the enemy team'); } catch (er) {} } else { try { feed('Paranoia hits the enemy team'); } catch (er) {} } }
  for (let i = SRPW.dec.length - 1; i >= 0; i--) { const d = SRPW.dec[i]; if (d.until > T) continue; if (d.b && d.b.alive) d.b.hp = Math.min(100, d.b.hp + d.amt); SRPW.dec.splice(i, 1); }
  if (SRPW.regenUntil > T) { if (player.hp > 0 && player.hp < 100 && T - SRPW.hitAt >= SRPW.regen.calm && T - SRPW.shotAt >= SRPW.regen.calm) { player.hp = Math.min(100, player.hp + SRPW.regen.rate * dt); try { updHud(); } catch (e) {} } for (const a of allies) if (a && a.alive && a.hp < 100) a.hp = Math.min(100, a.hp + SRPW.regen.rate * dt); }
  SRPW.beacons = SRPW.beacons.filter((b) => b.until > T); SRPW.stimOn = player.hp > 0 && SRPW.beacons.some((b) => Math.hypot(player.x - b.x, player.z - b.z) <= SRPW.stim.radius);
  SRPW.lastHp = player.hp; }
if (typeof startSR === 'function') { const s4 = startSR; startSR = function () { SRPW.set = srPwPickSet(Math.random); SRPW.t = 0; srPwRound(); return s4.apply(this, arguments); }; }
if (typeof srOrbs === 'function') { const o4 = srOrbs; srOrbs = function (on) { const r = o4.apply(this, arguments); try { srPwRound(); if (on) { if (!SRPW.set) SRPW.set = srPwPickSet(Math.random); const T = srPwTypes(SRPW.set, SR.orbs.length, Math.random); SR.orbs.forEach((o, i) => { o.type = T[i]; try { if (o.m) o.m.material = new THREE.MeshBasicMaterial({ color: SRPW.col[o.type] || 0xb48cff }); } catch (e) {} }); } } catch (e) {} return r; }; }
if (typeof srTick === 'function') { const k4 = srTick; srTick = function (dt) { try { if (!(typeof NET !== 'undefined' && NET && NET.socket)) srPwTick(window.xLdOn ? 0 : dt); } catch (e) {} return k4.apply(this, arguments); }; }
if (typeof shoot === 'function') { const h4 = shoot; shoot = function () { SRPW.mine++; SRPW.shotAt = SRPW.t; try { return h4.apply(this, arguments); } finally { SRPW.mine--; } }; }
if (typeof wDmg === 'function') { const w4 = wDmg; wDmg = function () { const n = w4.apply(this, arguments); try { if (SRPW.mine > 0 && SRPW.ampOn && srOn() && !(typeof NET !== 'undefined' && NET && NET.socket)) return Math.floor(n * SRPW.amp.k + 1e-9); } catch (e) {} return n; }; }
if (typeof xStimK === 'function') { const x4 = xStimK; xStimK = function () { try { const on = typeof NET !== 'undefined' && NET && NET.socket; if (on ? SRPW.net.includes('stim') : SRPW.stimOn && srOn()) return 1.1; } catch (e) {} return x4.apply(this, arguments); }; }
if (typeof mpCliRS === 'function') { const r4 = mpCliRS; mpCliRS = function (r) { try { if (r && typeof NET !== 'undefined' && NET.socket) SRPW.net = Array.isArray(r.pw) ? r.pw.filter((x) => typeof x === 'string') : []; } catch (e) {} return r4.apply(this, arguments); }; }
window.xDmPacks = DMPK; window.xEscPacks = ESCPK;
// parity6: Golden Gun uses the native Sheriff (one chambered round, two reserves,
// lethal hits, accurate while moving); this flag never changes the wire weapon names.
function srGoldenOn(){return !!(SRPW.golden&&wName()==='Sheriff'&&player&&player.hp>0);}
function srGoldenSet(on){on=!!on;if(on===!!SRPW.golden)return;SRPW.golden=on;const W=WEAP.Sheriff;if(on){SRPW.sheriff={mag:W.mag,rate:W.rate,rld:W.rld};W.mag=1;W.rate=1;W.rld=1;}else if(SRPW.sheriff){Object.assign(W,SRPW.sheriff);SRPW.sheriff=null;}}
if(typeof vfProfile==='function'){const p0=vfProfile;vfProfile=function(w){const p=p0.apply(this,arguments);return w==='Sheriff'&&srGoldenOn()?{...p,magazineSize:1,fireRate:1,reloadTimeSeconds:1,firstBulletAccuracy:0,ignoreMovementSpread:true,adsStats:null}:p;};}
if(typeof wDmg==='function'){const d0=wDmg;wDmg=function(){if(SRPW.mine>0&&srGoldenOn())return 800;return d0.apply(this,arguments);};}
if(typeof gSpread==='function'&&typeof gFire==='function'){const s0=gSpread;gSpread=function(w,W,B){if(!B&&srGoldenOn())return 0;return s0.apply(this,arguments);};const f0=gFire;gFire=function(d){if(srGoldenOn())return d;return f0.apply(this,arguments);};}
if(typeof jKill==='function'){const k0=jKill;jKill=function(){const r=k0.apply(this,arguments);if(srGoldenOn()&&!tdmAbNet()){rsv++;if(slots.pis)slots.pis.rsv=rsv;}return r;};}
if(typeof srPwRound==='function'){const r0=srPwRound;srPwRound=function(){srGoldenSet(false);srHuntersClear();return r0.apply(this,arguments);};}
if(typeof srPwTake==='function'){const t0=srPwTake;srPwTake=function(o){const r=t0.apply(this,arguments);if(o.type==='golden'){srGoldenSet(true);bEquip('Sheriff','pis');swapW('pis');ammo=1;rsv=2;slots.pis={ammo:1,rsv:2};onSkin();updHud();}if(o.type==='hunters')srHuntersSpawn();return r;};}
if(typeof mpCliRS==='function'){const r0=mpCliRS;mpCliRS=function(r){if(r&&tdmAbNet()){srGoldenSet(r.gg===1);tdmRoomHint(r);}return r0.apply(this,arguments);};}
if(typeof mpReset==='function'){const r0=mpReset;mpReset=function(){srGoldenSet(false);srHuntersClear();tdmRoomsClear();return r0.apply(this,arguments);};}
// Distinct wolf silhouettes, built locally; no external model download is required.
function srHunterMesh(col){const g=new THREE.Group();g.userData.hunter=true;const part=(geo,x,y,z)=>{const m=new THREE.Mesh(geo,new THREE.MeshBasicMaterial({color:col||0x71c9d8}));m.position.set(x,y,z);m.raycast=()=>{};g.add(m);return m;};part(new THREE.BoxGeometry(.42,.36,.8),0,.4,0);part(new THREE.BoxGeometry(.34,.32,.4),0,.65,.45);for(const x of [-.13,.13]){part(new THREE.ConeGeometry(.09,.24,4),x,.91,.42);for(const z of [-.25,.25])part(new THREE.BoxGeometry(.1,.28,.1),x,.17,z);}part(new THREE.ConeGeometry(.12,.48,6),0,.45,-.55).rotation.x=-.8;g.name='Twin Hunter';scene.add(g);return g;}
var SRH={L:[],seq:0};
function srHuntersClear(){for(const h of SRH.L){if(h.m){scene.remove(h.m);h.m.traverse(o=>{if(o.isMesh){o.geometry.dispose();o.material.dispose();}});}}SRH.L=[];}
function srHuntersSpawn(){const T=bots.filter(b=>b.alive&&b.g).sort((a,b)=>a.g.position.distanceTo(new THREE.Vector3(player.x,player.y||0,player.z))-b.g.position.distanceTo(new THREE.Vector3(player.x,player.y||0,player.z)));for(const b of T.slice(0,2)){const h={id:++SRH.seq,b,hp:150,t:15,m:srHunterMesh(),route:[],next:0};h.m.position.set(player.x,player.y||0,player.z);SRH.L.push(h);}}
function srHuntersTick(dt){let C=null;try{C=nmActive();}catch(e){}for(const h of SRH.L){h.t-=dt;if(h.hp<=0||h.t<=0)continue;if(!h.b?.alive)h.b=bots.find(b=>b.alive&&!SRH.L.some(o=>o!==h&&o.b===b));if(!h.b){h.t=0;continue;}const p=h.m.position,v=h.b.g.position,eye=new THREE.Vector3(p.x,p.y+.5,p.z),dest=new THREE.Vector3(v.x,v.y+.5,v.z),clear=los(eye,dest);
 if(p.distanceTo(v)<1&&clear){h.b.blind=Math.max(h.b.blind||0,4);h.b.srHunterSlow=4;h.t=0;continue;}let q=v;
 if(!clear&&C){if(h.next<=0){const a=nmNear(C,p.x,p.z,p.y),b=nmNear(C,v.x,v.z,v.y);h.route=a>=0&&b>=0?nmPath(C,a,b).slice():[];h.next=.5;}h.next-=dt;while(h.route.length&&Math.hypot(C.nav.nodes[h.route[0]][0]-p.x,C.nav.nodes[h.route[0]][2]-p.z)<.45)h.route.shift();if(!h.route.length)continue;const a=C.nav.nodes[h.route[0]];q={x:a[0],y:a[1],z:a[2]};}
 const dx=q.x-p.x,dz=q.z-p.z,l=Math.hypot(dx,dz)||1,k=Math.min(l,7*dt)/l,x=p.x+dx*k,z=p.z+dz*k,y=C?nmHeight(C,x,z,p.y):groundAt(x,z,.2,p.y);if(Math.abs(y-p.y)<1.2&&!blocked(x,z,.2,y)){p.set(x,y,z);h.m.rotation.y=Math.atan2(dx,dz);}}
 const dead=SRH.L.filter(h=>h.t<=0||h.hp<=0),alive=SRH.L.filter(h=>h.t>0&&h.hp>0);SRH.L=dead;srHuntersClear();SRH.L=alive;for(const b of bots)if(b.srHunterSlow>0)b.srHunterSlow=Math.max(0,b.srHunterSlow-dt);}
if(typeof srPwTick==='function'){const t0=srPwTick;srPwTick=function(dt){const r=t0.apply(this,arguments);srHuntersTick(dt);return r;};}
if(typeof xUtilCands==='function'){const c0=xUtilCands;xUtilCands=function(en){const L=c0.apply(this,arguments);if(en&&!tdmAbNet())for(const h of SRH.L)if(h.hp>0&&h.t>0){const p=h.m.position;L.push({kind:'hunter',o:h,x:p.x,y:p.y+.4,z:p.z,hit:n=>h.hp-=n,d:0,los:false,blocking:false});}return L;};}
if(typeof sgSlow==='function'){const s0=sgSlow;sgSlow=function(p){const b=bots.find(b=>b.g?.position===p);return s0.apply(this,arguments)*(b?.srHunterSlow>0?.5:1);};}
// Gold tint follows the active native weapon and restores the model's own colours.
if(typeof vmTick==='function'){const v0=vmTick;vmTick=function(){const r=v0.apply(this,arguments);const F=XV.fp;if(F&&F.ws){const gold=srGoldenOn()&&F.w==='Sheriff';if(F.gold!==gold){F.gold=gold;F.ws.traverse(o=>{if(o.isMesh)for(const m of [].concat(o.material||[])){if(!m.color)continue;m.userData=m.userData||{};if(m.userData.srBase==null)m.userData.srBase=m.color.getHex();m.color.setHex(gold?0xffcc42:m.userData.srBase);}});}}return r;};}
// Adapted TDM spawn-room zones, shared dimensions with server/src/tdmrooms.js.
var TDMROOM={defs:[],M:[],t:0,last:null};
function tdmRoomsOn(){return !!(FV.dm&&FV.tdm&&!FV.esc);}
function tdmRoomDefs(){if(!tdmRoomsOn())return [];if(tdmAbNet())return TDMROOM.defs;const C=typeof nmActive==='function'&&nmActive();return C?[C.meta.attacker.concat([5,0]),C.meta.defender.concat([5,1])]:[];}
function tdmRoomTeam(u){return u===player?tdmAbNet()?MP.team:0:allies.includes(u)?0:1;}
function tdmRoomInside(p,d){return Math.hypot(p.x-d[0],p.z-d[2])<d[3]&&Math.abs((p.y||0)-d[1])<3;}
function tdmRoomBlock(u,x,z,r,y){const team=tdmRoomTeam(u);if(u===player&&tdmAbNet()){const h=tdmRoomDefs().find(d=>d[4]===team);if(h&&!tdmRoomInside(player,h))player.tdmRoomLeft=true;}/* online: 'left' from the page's own predicted player, as the server's roomTick does from its unit (outside its room = left) */return tdmRoomDefs().some(d=>{const own=d[4]===team;return (!own||u.tdmRoomLeft)&&Math.hypot(x-d[0],z-d[2])<d[3]+(own?0:r)&&Math.abs(y-d[1])<3;});}/* own room once left: re-entry only (server tdmrooms.js roomBlocked) */
function tdmRoomsClear(){for(const m of TDMROOM.M){scene.remove(m);m.geometry.dispose();m.material.dispose();}TDMROOM.M=[];TDMROOM.defs=[];TDMROOM.last=null;const h=document.getElementById('xTdmSpawnHint');if(h)h.style.display='none';}
function tdmRoomsDraw(defs){const key=JSON.stringify(defs);if(TDMROOM.last===key)return;for(const m of TDMROOM.M){scene.remove(m);m.geometry.dispose();m.material.dispose();}TDMROOM.M=[];TDMROOM.last=key;for(const d of defs){const m=new THREE.Mesh(new THREE.RingGeometry(d[3]-.08,d[3],48),new THREE.MeshBasicMaterial({color:d[4]===tdmRoomTeam(player)?0x55cfff:0xff4655,side:THREE.DoubleSide,transparent:true,opacity:.65,depthWrite:false}));m.rotation.x=-Math.PI/2;m.position.set(d[0],d[1]+.05,d[2]);m.raycast=()=>{};scene.add(m);TDMROOM.M.push(m);}}
function tdmRoomState(u,dt){const p=u===player?u:u.g.position,home=tdmRoomDefs().find(d=>d[4]===tdmRoomTeam(u));if(!home)return false;if(!tdmRoomInside(p,home)){u.tdmRoomLeft=true;u.tdmSafe=false;return false;}if(u.tdmRoomLeft)return false;u.tdmSafe=true;if(u.tdmRoomAt==null)u.tdmRoomAt=TDMROOM.t;if(TDMROOM.t-u.tdmRoomAt<=15){u.hp=Math.min(100,u.hp+100*dt);const cap=tdmRecCap(u);u.armor=Math.min(cap,(u.armor||0)+100*dt);if(u===player)updHud();}else{u.hp=Math.max(0,u.hp-10*dt);if(u.hp<=0&&u===player)pDie('Spawn room','Ability');else if(u.hp<=0&&u.alive){u.alive=false;dmScore('Spawn room',u.name);}}return true;}
if(typeof tdmTick==='function'){const t0=tdmTick;tdmTick=function(dt){const r=t0.apply(this,arguments);if(!tdmRoomsOn()){if(TDMROOM.M.length)tdmRoomsClear();return r;}tdmRoomsDraw(tdmRoomDefs());if(!tdmAbNet()){TDMROOM.t+=dt;for(const u of [player,...allies,...bots])if(u===player?u.hp>0:u.alive)tdmRoomState(u,dt);}return r;};}
function tdmRoomPlace(u){if(tdmAbNet()||!tdmRoomsOn())return;const C=typeof nmActive==='function'&&nmActive(),d=tdmRoomDefs().find(d=>d[4]===tdmRoomTeam(u));if(!C||!d)return;const nodes=C.nav.nodes.filter(p=>Math.hypot(p[0]-d[0],p[2]-d[2])<d[3]-.5&&Math.abs(p[1]-d[1])<1&&!nmBlocked(C,p[0],p[2],.43,p[1],1.92));const p=nodes[Math.floor(Math.random()*nodes.length)]||d;if(u===player){u.x=p[0];u.y=p[1];u.z=p[2];}else u.g.position.set(p[0],p[1],p[2]);}
function tdmRoomHint(r){let el=document.getElementById('xTdmSpawnHint');const on=r.tab===1&&Number.isFinite(r.room);if(!el&&on){el=document.createElement('div');el.id='xTdmSpawnHint';el.style.cssText='position:fixed;top:130px;left:50%;transform:translateX(-50%);color:#c9f4ff;background:#0f1923cc;padding:6px 12px;z-index:60;pointer-events:none;font:12px sans-serif';document.body.appendChild(el);}if(el){el.style.display=on?'block':'none';if(on)el.textContent=r.room>0?'Spawn room · '+Math.ceil(r.room)+' s · Leave to fight':'Spawn room · Taking damage · leave now';}if(r.tab===1&&player&&on)player.tdmRoomLeft=false;}/* the server's room timer clears 'left' (a respawn in the room); 'left' itself comes from the page's own prediction (tdmRoomBlock): taken from the server it arrived while the predicted player could still be inside the ring and held it there (mpsweep) */
function tdmRoomReset(u){u.tdmRoomAt=null;u.tdmRoomLeft=false;u.tdmSafe=false;}
if(typeof dmSpawnP==='function'){const p0=dmSpawnP;dmSpawnP=function(){tdmRoomReset(player);const r=p0.apply(this,arguments);tdmRoomPlace(player);return r;};const b0=dmSpawnB;dmSpawnB=function(b){tdmRoomReset(b);const r=b0.apply(this,arguments);tdmRoomPlace(b);return r;};}
if(typeof shoot==='function'){const s0=shoot;shoot=function(){if(tdmRoomsOn()&&tdmRoomDefs().some(d=>tdmRoomInside(player,d)))return;return s0.apply(this,arguments);};}
if(typeof botCanShoot==='function'){const s0=botCanShoot;botCanShoot=function(b){if(tdmRoomsOn()&&tdmRoomDefs().some(d=>tdmRoomInside(b.g.position,d)))return false;return s0.apply(this,arguments);};}
if(typeof hurt==='function'){const h0=hurt;hurt=function(b){if(tdmRoomsOn()&&b?.tdmSafe)return;return h0.apply(this,arguments);};}
if(typeof mpCliSnap==='function'){const m0=mpCliSnap;mpCliSnap=function(m){if(m&&Array.isArray(m.trm))TDMROOM.defs=m.trm.filter(d=>Array.isArray(d)&&d.length===5&&d.every(Number.isFinite)&&d[3]>0&&d[3]<=10);return m0.apply(this,arguments);};}

// ---- END GAME RULES ----
