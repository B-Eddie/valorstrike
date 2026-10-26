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
//    the mag running dry), idle otherwise; the rig is scaled to the authored 43.383 deg viewmodel FOV as xvFPTick does;
//  - their ADS: rifles / SMGs zoom the camera to the weapon's zoom, snipers show the scope (viewmodel hidden), as the
//    player's own setScope does (online: pov[id][0], the server's input.ads; offline bots never ADS);
//  - their flash: a white screen for the blind they are under (online pov[id][1], offline b.blind), as #netBlind does
//    for the player.
// The server sends pov only to a dead player and only for living teammates (spike.js roundState); enemies are never
// spectated (index.html xSpecPool), so no enemy view data exists to draw.
var XSPV = { F: null, key: null, u: null, w: null, am: null, fire: 0, rl: 0, rlT: 0, fail: {}, ov: null, zoom: 0, scope: false, bl: null, pov: {}, povAt: 0 };
function xspvTarget() { try { if (!running || !player || player.hp > 0 || !xKL.sp) return null; const a = XOB.fp; return a && a.alive && allies.indexOf(a) >= 0 ? a : null; } catch (e) { return null; } }
function xspvWeap(a) { let w = a && a.w; try { if (!(typeof MP !== 'undefined' && MP.on) && typeof xWeapOf === 'function') w = xWeapOf(a) || w; } catch (e) {} return w === 'Knife' || (w && WEAP[w]) ? w : 'Classic'; }
function xspvAgent(a) { let g = null; try { g = xAg(a); } catch (e) {} g = String(g || a.agent || 'Jett'); return g.charAt(0).toUpperCase() + g.slice(1).toLowerCase(); }
function xspvSkins(a) { try { const m = typeof XSK !== 'undefined' && XSK.net && a && a.nid != null ? XSK.net[a.nid] : null; return m && typeof m === 'object' ? m : {}; } catch (e) { return {}; } }
// the teammate's skin answers xskGet while their rig's key / load is made (xvFPKey / xvFPLoad read it synchronously)
if (typeof xskGet === 'function') { const g0 = xskGet; xskGet = function (w) { if (XSPV.ov) { const id = XSPV.ov[w]; try { return id && xskValidFor(w, id) ? id : 'standard'; } catch (e) { return 'standard'; } } return g0.apply(this, arguments); }; }
function xspvKey(ag, w, sk) { XSPV.ov = sk; try { return xvFPKey(ag, w); } finally { XSPV.ov = null; } }
// the player's own rig warm-up evicts other agents' rigs from the cache (xvFPGet): never dispose the one being shown
if (typeof xvFPClear === 'function') { const c0 = xvFPClear; xvFPClear = function (F) { if (F && F === XSPV.F) { F.xspvEvicted = 1; return; } return c0.apply(this, arguments); }; }
function xspvDrop() { const F = XSPV.F; XSPV.F = null; XSPV.key = null; XSPV.u = null; XSPV.am = null; XSPV.rl = 0; if (!F) return;
  if (F === (typeof XV !== 'undefined' && XV.fp)) return; /* the player's own rig: xvFPTick owns its visibility */ F.root.visible = false;
  if (F.xspvEvicted) { F.xspvEvicted = 0; try { xvFPClear(F); } catch (e) {} } }
// one shot of the followed teammate (bfxBot is called at the shooter's spot: offline mate shots, online 's' events)
if (typeof bfxBot === 'function') { const b0 = bfxBot; bfxBot = function (p) { try { const a = xspvTarget(); if (a && p && Math.hypot(a.g.position.x - p.x, a.g.position.z - p.z) < 0.6) XSPV.fire++; } catch (e) {} return b0.apply(this, arguments); }; }
// online: the server's per-teammate view state, and each teammate's ammo (row [15]) for the HUD / reload cue
if (typeof mpCliRS === 'function') { const r0 = mpCliRS; mpCliRS = function (m) { const r = r0.apply(this, arguments); try { XSPV.pov = m && m.pov && typeof m.pov === 'object' ? m.pov : {}; XSPV.povAt = performance.now(); } catch (e) {} return r; }; }
if (typeof mpCliSnap === 'function') { const s0 = mpCliSnap; mpCliSnap = function (m) { const r = s0.apply(this, arguments); try { if (m && Array.isArray(m.u)) for (const e of m.u) { if (!Array.isArray(e) || e[0] === MP.me || !Number.isFinite(e[15])) continue; const u = allies.find((x) => x.nid === e[0]); if (u) u.nam = e[15]; } } catch (e) {} return r; }; }
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
      if (P) P.then((F) => { if (XSPV.key !== key) return; XSPV.F = F; F.kind = null; F.age = 0; xvFPPlay(F, 'equip'); if (F.root.parent !== camera) camera.add(F.root); }).catch((e) => { XSPV.fail[key] = String(e); }); } }
  // ammo -> reload cue (offline: the mag ran dry; online: the server's reload clock when it is in, else the mag refilling)
  const am = online && Number.isFinite(a.nam) ? a.nam : a.xAmW === w && Number.isFinite(a.xAm) ? a.xAm : null, W = WEAP[w] || {}, rlT = W.rld || 2;
  if (pov && pov.rl > 0) { if (!(XSPV.rl > 0)) XSPV.rlT = Math.max(pov.rl, rlT); XSPV.rl = pov.rl; }
  else if (am != null && XSPV.am != null && w !== 'Knife' && ((am === 0 && XSPV.am > 0) || (am > XSPV.am && !online)) && !(XSPV.rl > 0)) { XSPV.rl = XSPV.rlT = rlT; }
  else if (XSPV.rl > 0) XSPV.rl = Math.max(0, XSPV.rl - dt);
  XSPV.am = am;
  xspvZoom(w, pov ? pov.ads : 0); xspvBlind(pov ? pov.blind : a.blind > 0 ? a.blind : 0);
  const F = XSPV.F; if (!F || XSPV.key !== key) return;
  F.root.visible = !XSPV.scope; if (F.root.parent !== camera) camera.add(F.root);
  if (XSPV.rl > 0) { XSPV.fire = 0; xvFPPlay(F, 'reload', 1 - XSPV.rl / Math.max(0.1, XSPV.rlT)); }
  else if (XSPV.fire > 0) { XSPV.fire = 0; F.kind = null; xvFPPlay(F, w === 'Knife' ? 'attack 1' : 'fire'); }
  else if (F.kind === 'reload' || (F.kind !== 'idle' && F.age > (F.duration || (F.action ? F.action.getClip().duration : 0.4)))) xvFPPlay(F, 'idle');
  F.am.update(dt); F.gm.update(dt); F.age += dt;
  const s = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) / Math.tan(THREE.MathUtils.degToRad(43.383 / 2)); F.root.scale.set(s, s, 1); F.root.position.set(F.origin.x * s, F.origin.y * s, F.origin.z);
}
{ const t0 = vmTick; vmTick = function (dt) { const r = t0.apply(this, arguments); try { xspvTick(Math.min(0.1, dt || 0.016)); } catch (e) { if (!XSPV.err) { XSPV.err = String(e); console.warn('spectate pov', e); } } return r; }; }
// the spectated teammate's ammo in the HUD online (index.html's xHud wrapper counts offline shots in a.xAm)
{ const h0 = xHud; xHud = function () { const r = h0.apply(this, arguments); try { const a = xspvTarget(); if (a && typeof MP !== 'undefined' && MP.on && Number.isFinite(a.nam)) setT('xMag', a.nam); } catch (e) {} return r; }; }
window.xSpectatePov = XSPV;
// ---- END SPECTATE POV ----
