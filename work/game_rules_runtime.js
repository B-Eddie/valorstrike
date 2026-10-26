// ---- GAME RULES ----
// Deathmatch health packs (user 2026-10-26 10:32: "search online for everything that you have ... and verify it's right";
// work/validation/values-game.md). VALORANT Deathmatch: a kill "drops health kits on the victim's body that can be picked up"
// (wiki.playvalorant.com/en-us/Deathmatch); the game files (valorant.gs/rules DeathmatchGameMode "Health Pack") give Lifespan 8,
// Health To Restore 50, Armor To Restore 25 and a 50 uu (0.5 m) pickup sphere. Same numbers and rule as the server
// (server/src/simulation.js HEALTH_PACK / packTick): one pack at the victim's feet, gone after 8 s or when a HURT living unit
// touches it (sphere 0.5 m + capsule 0.35 m, within 1.8 m vertically): +50 HP (max 100), +25 armour (max 50). The old offline
// rule (the killer healed to 100 / 50 on every kill) stays for Team Deathmatch only. Online the server owns the packs; the page
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
window.xDmPacks = DMPK; window.xEscPacks = ESCPK;
// ---- END GAME RULES ----
