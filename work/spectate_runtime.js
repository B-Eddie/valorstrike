// ---- SPECTATE POV ----
// Spectating after death = the followed teammate's own first-person view, as VALORANT (user 2026-10-26: "There isn't
// supposed to be a 3rd person when spectating when dead"; VALORANT's post-death spectate is a living teammate's POV only -
// their camera, their gun with their skin, their crosshair and HUD - cycled with next / previous; third person and free cam
// exist only in Replays and custom-game observers). index.html's render path already puts the camera at the teammate's
// eye with their yaw and pitch (xObsEye / xObsPitch; online both come from the interpolated snapshot pose). This block draws
// what they hold:
//  - their native first-person rig (the teammate's agent arms + weapon, their equipped skin online - XSK.net, the skin map
//    the server sends per human seat; bots and offline mates: Standard), loaded through the same xvFPGet cache as the
//    player's own viewmodel (xskGet answers for the teammate while the key / load is made);
//  - equip on a new target or weapon, fire on each of their shots (bfxBot: every offline mate shot and every online 's'
//    event reaches it at the shooter's spot), reload (online: the server's reload clock, roundState pov[id][2]; offline:
//    the mag running dry), idle otherwise; the rig is scaled to the authored 43.383 deg viewmodel FOV across and up in camera space (as xAfFov);
//  - their ADS: rifles / SMGs zoom the camera to the weapon's zoom, snipers show the scope (viewmodel hidden), as the
//    player's own setScope does (online: pov[id][0], the server's input.ads; offline bots never ADS);
//  - their flash: a white screen for the blind they are under (online pov[id][1], offline b.blind), as #netBlind does
//    for the player.
// The server sends pov only to a dead player and only for living teammates (spike.js roundState); enemies are never
// spectated (index.html xSpecPool), so no enemy view data exists to draw.
var XSPV = { F: null, key: null, u: null, w: null, am: null, fire: 0, rl: 0, rlT: 0, fail: {}, ov: null, zoom: 0, scope: false, bl: null, pov: {}, povAt: 0, k: 0 };
function xspvTarget() { try { if (!running || !player || player.hp > 0 || !xKL.sp) return null; const a = XOB.fp; return a && a.alive && allies.indexOf(a) >= 0 ? a : null; } catch (e) { return null; } }
function xspvWeap(a) { let w = a && a.w; try { if (!(typeof MP !== 'undefined' && MP.on) && typeof xWeapOf === 'function') w = xWeapOf(a) || w; } catch (e) {} return w === 'Knife' || (w && WEAP[w]) ? w : 'Classic'; }
function xspvAgent(a) { let g = null; try { g = xAg(a); } catch (e) {} g = String(g || a.agent || 'Jett'); return g.charAt(0).toUpperCase() + g.slice(1).toLowerCase(); }
function xspvSkins(a) { try { const m = typeof XSK !== 'undefined' && XSK.net && a && a.nid != null ? XSK.net[a.nid] : null; return m && typeof m === 'object' ? m : {}; } catch (e) { return {}; } }
// the teammate's skin answers xskGet while their rig's key / load is made (xvFPKey / xvFPLoad read it synchronously)
if (typeof xskGet === 'function') { const g0 = xskGet; xskGet = function (w) { if (XSPV.ov) { const id = XSPV.ov[w]; try { return id && xskValidFor(w, id) ? id : 'standard'; } catch (e) { return 'standard'; } } return g0.apply(this, arguments); }; }
function xspvKey(ag, w, sk) { XSPV.ov = sk; try { return xvFPKey(ag, w); } finally { XSPV.ov = null; } }
// the player's own rig warm-up evicts other agents' rigs from the cache (xvFPGet): never dispose the one being shown
if (typeof xvFPClear === 'function') { const c0 = xvFPClear; xvFPClear = function (F) { if (F && F === XSPV.F) { F.xspvEvicted = 1; return; } return c0.apply(this, arguments); }; }
// Where the rig draws: the player's own viewmodel layer (feel_runtime VF_VIEW: its own 55 deg camera with a 1.5 cm near
// plane, its own lights, drawn after a depth clear - vfBindRenderer draws it while a spectate rig shows), so a spectated
// teammate's arms and hands frame and light exactly like the player's own (user: "first-person spectate shows a floating
// gun with no arms/hands"). Drawn in the world pass on the world camera instead, the rig had the world's 0.1 m near plane
// and depth (walls / props in front of the teammate's eye cover the hands) and the arms were framed off screen.
function xspvView() { return typeof VF_VIEW !== 'undefined' && VF_VIEW && VF_VIEW.scene ? VF_VIEW : null; }
function xspvLayer(F) { const V = xspvView(), L = V ? V.scene : camera; if (F.root.parent !== L) { if (F.root.parent) F.root.parent.remove(F.root); L.add(F.root); } }
function xspvDrop() { const F = XSPV.F; XSPV.F = null; XSPV.key = null; XSPV.u = null; XSPV.am = null; XSPV.rl = 0; XSPV.k = 0; if (!F) return;
  if (F === (typeof XV !== 'undefined' && XV.fp)) return; /* the player's own rig: xvFPTick owns its visibility */ F.root.visible = false;
  if (F.xspvEvicted) { F.xspvEvicted = 0; try { xvFPClear(F); } catch (e) {} } }
// one shot of the followed teammate (bfxBot is called at the shooter's spot: offline mate shots, online 's' events)
if (typeof bfxBot === 'function') { const b0 = bfxBot; bfxBot = function (p) { try { const a = xspvTarget(); if (a && p && Math.hypot(a.g.position.x - p.x, a.g.position.z - p.z) < 0.6) XSPV.fire++; } catch (e) {} return b0.apply(this, arguments); }; }
// online: the server's per-teammate view state, and each teammate's ammo (row [15]) and reserve (row [16]) for the HUD / reload cue
if (typeof mpCliRS === 'function') { const r0 = mpCliRS; mpCliRS = function (m) { const r = r0.apply(this, arguments); try { XSPV.pov = m && m.pov && typeof m.pov === 'object' ? m.pov : {}; XSPV.povAt = performance.now(); } catch (e) {} return r; }; }
if (typeof mpCliSnap === 'function') { const s0 = mpCliSnap; mpCliSnap = function (m) { const r = s0.apply(this, arguments); try { if (m && Array.isArray(m.u)) for (const e of m.u) { if (!Array.isArray(e) || e[0] === MP.me || !Number.isFinite(e[15])) continue; const u = allies.find((x) => x.nid === e[0]); if (u) { u.nam = e[15]; if (Number.isFinite(e[16])) u.nrs = e[16]; } } } catch (e) {} return r; }; }
function xspvPov(a) { const p = a && a.nid != null && XSPV.pov ? XSPV.pov[a.nid] : null; if (!Array.isArray(p)) return null; const age = (performance.now() - XSPV.povAt) / 1000; return { ads: p[0] === 2 ? 2 : p[0] ? 1 : 0, blind: Math.max(0, (+p[1] || 0) - age), rl: Math.max(0, (+p[2] || 0) - age) }; }
function xspvBlind(v) { let el = XSPV.bl; if (!el && !(v > 0)) return; if (!el) { el = XSPV.bl = document.createElement('div'); el.id = 'xSpvBlind'; el.style.cssText = 'pointer-events:none;position:fixed;inset:0;z-index:110;background:#fff;opacity:0'; document.body.appendChild(el); }
  const o = v > 0 ? Math.min(1, v / 1.5).toFixed(2) : '0'; if (el.style.opacity !== o) el.style.opacity = o; }
function xspvZoom(w, ads) { // the teammate's lens: 0 = hip, else the zoom the player's own setScope gives that weapon (2 = the Operator's second zoom, 5x)
  const sn = !!(typeof XSZ !== 'undefined' && XSZ[w]), z = !ads || w === 'Knife' || w === 'Classic' || w === 'Sheriff' || w === 'Frenzy' ? 1 : sn ? XSZ[w][Math.min(XSZ[w].length, ads) - 1] : (XZ[w] || 1.25), scope = !!ads && sn;
  const was = XSPV.zoom; XSPV.zoom = z; if (z !== 1 || (was && was !== 1)) { const f = xSCf(z !== 1 ? z : xSC.z); if (Math.abs(camera.fov - f) > 1e-4) { camera.fov = f; camera.updateProjectionMatrix(); } } // (xADu also re-heals the player's own lens every frame)
  if (scope !== XSPV.scope) { XSPV.scope = scope; hudS($('scope'), 'display', scope ? 'block' : 'none'); hudS($('cross'), 'display', scope ? 'none' : ''); } }
function xspvOff() { if (XSPV.zoom && XSPV.zoom !== 1) { XSPV.zoom = 0; try { const f = xSCf(xSC.z); camera.fov = f; camera.updateProjectionMatrix(); } catch (e) {} } XSPV.zoom = 0; if (XSPV.scope) { XSPV.scope = false; hudS($('scope'), 'display', 'none'); hudS($('cross'), 'display', ''); } xspvBlind(0); }
function xspvTick(dt) {
  const a = xspvTarget(); if (!a) { if (XSPV.F || XSPV.key) xspvDrop(); xspvOff(); return; }
  const ag = xspvAgent(a), w = xspvWeap(a), sk = xspvSkins(a), key = xspvKey(ag, w, sk), pov = xspvPov(a), online = typeof MP !== 'undefined' && MP.on;
  if (XSPV.key !== key || XSPV.u !== a) { const same = XSPV.u === a; xspvDrop(); XSPV.key = key; XSPV.u = a; XSPV.w = w; XSPV.fire = 0; XSPV.eq = 1; void same;
    if (!XSPV.fail[key] && !(XV.failures && XV.failures[key])) { XSPV.ov = sk; let P = null; try { P = xvFPGet(ag, w); } catch (e) { XSPV.fail[key] = String(e); } finally { XSPV.ov = null; }
      if (P) P.then((F) => { if (XSPV.key !== key) return; XSPV.F = F; F.kind = null; F.age = 0; xvFPPlay(F, 'equip'); xspvLayer(F); }).catch((e) => { XSPV.fail[key] = String(e); }); } }
  // ammo -> reload cue (offline: BOT AMMO's reload clock, else the mag running dry; online: the server's reload clock when it is in, else the mag refilling)
  const am = online && Number.isFinite(a.nam) ? a.nam : a.xAm && typeof a.xAm === 'object' && a.xAm.w === w ? a.xAm.mag : null, W = WEAP[w] || {}, rlT = W.rld || 2;
  const BA = !online && a.xAm && typeof a.xAm === 'object' && a.xAm.w === w ? a.xAm : null; // offline: BOT AMMO's own reload clock
  if (BA && BA.rl > 0) { XSPV.rl = BA.rl; XSPV.rlT = Math.max(BA.rl, BA.rd || rlT); }
  else if (BA && XSPV.rlBA) { XSPV.rl = 0; }
  else if (pov && pov.rl > 0) { if (!(XSPV.rl > 0)) XSPV.rlT = Math.max(pov.rl, rlT); XSPV.rl = pov.rl; }
  else if (am != null && XSPV.am != null && w !== 'Knife' && ((am === 0 && XSPV.am > 0) || (am > XSPV.am && !online)) && !(XSPV.rl > 0)) { XSPV.rl = XSPV.rlT = rlT; }
  else if (XSPV.rl > 0) XSPV.rl = Math.max(0, XSPV.rl - dt);
  XSPV.am = am; XSPV.rlBA = !!(BA && BA.rl > 0);
  xspvZoom(w, pov ? pov.ads : 0); xspvBlind(pov ? pov.blind : a.blind > 0 ? a.blind : 0);
  const F = XSPV.F; if (!F || XSPV.key !== key) return;
  F.root.visible = !XSPV.scope; xspvLayer(F);
  if (XSPV.rl > 0) { XSPV.fire = 0; xvFPPlay(F, 'reload', 1 - XSPV.rl / Math.max(0.1, XSPV.rlT)); }
  else if (XSPV.fire > 0) { XSPV.fire = 0; F.kind = null; xvFPPlay(F, w === 'Knife' ? 'attack 1' : 'fire'); }
  else if (F.kind === 'reload' || (F.kind !== 'idle' && F.age > (F.duration || (F.action ? F.action.getClip().duration : 0.4)))) xvFPPlay(F, 'idle');
  F.am.update(dt); F.gm.update(dt); F.age += dt;
  if (xspvView()) { // the player's own viewmodel framing (feel_runtime vfViewTick at rest): scale 1 through VF_VIEW's 55 deg lens, +4.5 cm right, -3.5 cm down; rifle ADS lines the optic up as the player's own ADS does
    XSPV.k += ((pov && pov.ads && !XSPV.scope ? 1 : 0) - XSPV.k) * Math.min(1, dt * 14); const k = XSPV.k < 1e-3 ? 0 : XSPV.k;
    F.root.scale.setScalar(1); F.root.rotation.set(0, Math.PI / 2, 0); F.root.position.set(F.origin.x + 0.045, F.origin.y - 0.035, F.origin.z);
    if (k > 0) { F.root.updateMatrixWorld(true); const o = F.ws && (F.ws.getObjectByName('Reflex') || F.ws.getObjectByName('Scope')); if (o) { const p = o.getWorldPosition(new THREE.Vector3()); F.root.position.x -= p.x * k; F.root.position.y -= (p.y + 0.025) * k; } else { F.root.position.x -= 0.12 * k; F.root.position.y += 0.045 * k; } F.root.position.z += 0.07 * k; }
    return; }
  // no feel layer (world camera): FOV match to the rig's authored 43.383 deg: across and up in CAMERA space, depth kept. The root is turned PI/2 about Y
  // (the native rig faces +X), so local x = camera depth and local z = camera width: scale (1, s, s), as xAfFov. (s, s, 1)
  // stretched depth and height but not width - the spectated gun / arms drew squished horizontally, pitched up, arms off screen.
  const s = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) / Math.tan(THREE.MathUtils.degToRad(43.383 / 2)); F.root.scale.set(1, s, s); F.root.position.set(F.origin.x * s, F.origin.y * s, F.origin.z);
}
{ const t0 = vmTick; vmTick = function (dt) { const r = t0.apply(this, arguments); try { xspvTick(Math.min(0.1, dt || 0.016)); } catch (e) { if (!XSPV.err) { XSPV.err = String(e); console.warn('spectate pov', e); } } return r; }; }
// The spectator HUD (user 2026-10-29: "after i die, it sometimes shows the HUD from right when i died when im spectating"):
// while the player is dead and spectating, the bottom HUD is the followed teammate's live state every frame - weapon,
// magazine ("…" while reloading, as the player's own), reserve, health, armour and their agent's abilities (charges,
// ult points) - and never the player's own values frozen at the death frame. Offline the magazine / reserve / reload are
// BOT AMMO's real state (xbAm); online rows [15] / [16] and the server's reload clock (pov[id][2]); offline ability
// charges from the bot kit (xBCh), online the kit's names only (the server sends no teammate charges), ult points
// from sbUlt. With nobody left to follow the weapon / ammo read "—" and the ability bar is hidden.
var XSPH = { on: false, ag: null, el: null };
// The player's own credits (#xCr) and Spike-carry tag (#xSpkC) are not the followed teammate's: hidden while spectating (#game.x-spec,
// user 2026-11-06 bug 10: "your own character's HUD stays visible while spectating"), back on revive / next round / match end (xsphOff).
function xsphCls(on) { try { const g = $('game'); if (g && g.classList.contains('x-spec') !== on) g.classList.toggle('x-spec', on); if (!XSPH.css) { XSPH.css = document.createElement('style'); XSPH.css.textContent = '#game.x-spec #xCr,#game.x-spec #xSpkC{visibility:hidden!important}'; document.head.appendChild(XSPH.css); } } catch (e) {} }
function xsphTarget() { try { if (!running || !player || player.hp > 0 || !xKL.sp || mode === 'duel') return null; const a = xKL.cur; return a && a.alive && allies.indexOf(a) >= 0 ? a : null; } catch (e) { return null; } }
function xsphSpec() { try { return !!(running && player && player.hp <= 0 && xKL.sp && mode !== 'duel'); } catch (e) { return false; } }
function xsphAmmo(a, w) { // [mag text, reserve text]
  if (w === 'Knife') return ['—', '—'];
  const online = typeof MP !== 'undefined' && MP.on;
  if (online) { const pv = xspvPov(a), rl = pv && pv.rl > 0; return [rl ? '…' : Number.isFinite(a.nam) ? a.nam : '—', Number.isFinite(a.nrs) ? a.nrs : '—']; }
  let A = null; try { A = typeof xbAm === 'function' ? xbAm(a) : null; } catch (e) {}
  if (!A || !A.w || A.w === 'Knife') return ['—', '—'];
  return [A.rl > 0 && !(typeof XRLP !== 'undefined' && XRLP[A.w]) ? '…' : A.mag, A.res]; }
function xsphKit(a) { // the followed teammate's abilities in the player's ability bar (#xAb)
  const ab = $('xAb'); if (!ab) return; let ag = 'Jett'; try { ag = xspvAgent(a); } catch (e) {} const K = (typeof KITS !== 'undefined' && KITS[ag]) || null;
  ab.classList.add('on'); ab.classList.add('x-spec'); if (XSPH.ag !== ag) { XSPH.ag = ag; ab.setAttribute('aria-label', ag + ' abilities (spectating)'); ['jC', 'jQ', 'jE', 'jX'].forEach((id, i) => { const el = $(id); if (!el) return; const sp = el.querySelector('span'); if (sp && K && K.n) sp.textContent = K.n[i]; let d = el.querySelector('.x-ai'); if (!d) { d = document.createElement('div'); d.className = 'x-ai'; el.insertBefore(d, sp); } try { d.innerHTML = abIco(ag, i); } catch (e) {} }); try { xAbIcons.a = null; } catch (e) {} }
  const online = typeof MP !== 'undefined' && MP.on; let C = null; if (!online) try { C = typeof xBCh === 'function' ? xBCh(a) : null; } catch (e) {}
  const mx = (K && K.mx) || {}; [['jC', 'c'], ['jQ', 'q'], ['jE', 'e']].forEach(([id, k]) => { const el = $(id); if (!el) return; const em = el.querySelector('em'), n = C ? Math.max(0, C[k] | 0) : null; if (em) em.textContent = n == null ? '' : String(n);
    el.classList.toggle('off', n === 0); el.classList.toggle('rdy', false); el.classList.toggle('x-empty', n === 0); el.classList.remove('x-tmon'); const ei = el.querySelector('i'); if (ei) ei.style.setProperty('--p', '0');
    const pp = el.querySelector('.x-pp'); if (pp) { const m = Math.min(4, Math.max(n || 0, mx[k] || 1)); if (pp.childElementCount !== m) pp.innerHTML = '<s></s>'.repeat(m); for (let i = 0; i < m; i++) pp.children[i].className = n != null && i < n ? 'on' : ''; } });
  const x = $('jX'); if (x) { let u = [0, 0]; try { u = sbUlt(a.name); } catch (e) {} const em = x.querySelector('em'), rdy = u[1] > 0 && u[0] >= u[1]; if (em) em.textContent = u[1] > 0 ? u[0] + '/' + u[1] : ''; x.classList.toggle('rdy', rdy); x.classList.toggle('off', !rdy); x.classList.remove('x-tmon'); const ei = x.querySelector('i'); if (ei) ei.style.setProperty('--p', u[1] > 0 ? (1 - u[0] / u[1]).toFixed(3) : '1'); x.setAttribute('data-pips', u[0] + '/' + u[1]); const pp = document.getElementById('xPips'); if (pp) pp.innerHTML = ''; } }
function xsphOff() { if (!XSPH.on) return; XSPH.on = false; XSPH.ag = null; xsphCls(false); try { const ab = $('xAb'); if (ab) { ab.classList.remove('x-spec'); ab.setAttribute('aria-label', (J.pick || 'Jett') + ' abilities'); } ['jC', 'jQ', 'jE', 'jX'].forEach((id, i) => { const sp = $(id) && $(id).querySelector('span'); if (sp) sp.textContent = K().n[i]; }); xAbIcons.a = null; xAbIcons(); J.hs = ''; xHud.ux = null; } catch (e) {} }
function xsphHud() {
  if (!xsphSpec()) { xsphOff(); return; }
  XSPH.on = true; xsphCls(true); const a = xsphTarget();
  if (!a) { setT('xWn', '—'); setT('xMag', '—'); setT('xRs', '—'); setT('xHp', 0); setT('xArm', 0); const ab = $('xAb'); if (ab) ab.classList.remove('on'); return; }
  const w = xspvWeap(a), am = xsphAmmo(a, w);
  setT('xWn', w); setT('xMag', am[0]); setT('xRs', am[1]); setT('xHp', Math.max(0, Math.ceil(a.hp || 0))); setT('xArm', Math.ceil(a.armor || 0)); try { $('xHp').classList.toggle('lo', a.hp <= 30); } catch (e) {}
  xsphKit(a); }
{ const h0 = xHud; xHud = function () { const r = h0.apply(this, arguments); try { xsphHud(); } catch (e) { if (!XSPH.err) { XSPH.err = String(e); console.warn('spectate hud', e); } } return r; }; }
// jTick re-shows the player's own kit every frame (#xAb .on): keep the spectated teammate's while spectating
if (typeof jTick === 'function') { const j0 = jTick; jTick = function () { const r = j0.apply(this, arguments); try { if (XSPH.on && xsphSpec()) { const ab = $('xAb'); if (ab) ab.classList.toggle('on', !!xsphTarget()); } } catch (e) {} return r; }; }
window.xSpectateHud = XSPH;
window.xSpectatePov = XSPV;
// ---- END SPECTATE POV ----
