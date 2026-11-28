// ---- TP ROCKLAN RELOAD ----
// Third-person weapon-part animations: the gun's OWN authored motion (revolver cylinder, pump, bolt, magazine),
// from the fan-extracted Rocklan GNTP_* set. The held guns bake to static meshes at load (xvStatic: one draw call
// per part, no skeleton), so an authored clip can only play on a rigged clone stood in for the held gun while the
// motion runs; the static gun returns after. The character's arms stay procedural (xgReload above does the
// support-hand magazine work; there are no authored character-arm reload clips in the pack) — this adds the
// WEAPON's motion only. Reload scrubs by the grip's own progress (G.rp, stashed in xgPose); equip is a one-shot
// on weapon swap; fire (pump / lever / bolt cycling) plays per shot for the slow action guns only — at SMG fire
// rates a per-shot rigged stand-in is wasted work for an invisible slide kick.
// Donor glbs are LOCAL-ONLY converted assets (work/build_rocklan_tp_reload.cjs, models/valorant/animations/
// tp-rocklan-reload-<gun>.glb); where a donor is absent the procedural gun carries on. 12 of 20 reloadable guns
// have GNTP data; Ares / Guardian / Odin / Shorty / Spectre (GN_* first-person clips only in the pack) and
// Bandit / Warden / Outlaw (not in the pack) stay procedural.
var XRWB = { don: {}, load: {}, state: typeof WeakMap !== 'undefined' ? new WeakMap() : new Map() };
var XRW_GUNS = {};
['Bucky', 'Bulldog', 'Classic', 'Frenzy', 'Ghost', 'Judge', 'Marshal', 'Operator', 'Phantom', 'Sheriff', 'Stinger', 'Vandal'].forEach((w) => { XRW_GUNS[w] = { donor: 'animations/tp-rocklan-reload-' + w.toLowerCase(), src: 'valorant/' + w.toLowerCase() }; });
var XRW_FIRE = { Bucky: 1, Marshal: 1, Operator: 1 }; // pump / lever / bolt: the action cycling is the visible part, one shot a second or slower
function xrwKick(w) { // start the donor + rigged source load once; undefined = in flight, null = unavailable
  if (XRWB.don[w] !== undefined || XRWB.load[w]) return;
  const D = XRW_GUNS[w];
  XRWB.load[w] = Promise.all([xvLoad(D.donor).catch(() => null), xvLoad(D.src).catch(() => null)]).then(([don, src]) => {
    const A = don && don.animations ? don.animations : [];
    const pick = (re, no) => A.find((c) => re.test(c.name) && !(no && no.test(c.name))) || null;
    const K = src && src.scene ? { src, reload: pick(/Reload/i), equip: pick(/Equip/i), fire: pick(/Fire/i, /Add|Zoomed/i) } : null;
    XRWB.don[w] = K && (K.reload || K.equip || K.fire) ? K : null;
  }, () => { XRWB.don[w] = null; });
}
function xrwDrop(M, S) { if (S.rig && S.rig.parent) S.rig.parent.remove(S.rig); S.rig = null; S.rigW = null; S.mode = null; if (S.hid && M.gun) M.gun.visible = true; S.hid = false; }
function xrwRig(M, S, K, w) { // (re)build the rigged stand-in for the gun w (mode survives the rebuild; only xrwPose's own transitions end a motion)
  const mode = S.mode; xrwDrop(M, S); S.mode = mode;
  const sc = THREE.SkeletonUtils.clone(K.src.scene);
  try { xvConstraints(sc, (typeof XV !== 'undefined' && XV.config && XV.config[w.toLowerCase()]) || null, false); } catch (e) {}
  S.mx = new THREE.AnimationMixer(sc); S.act = null; S.clip = null; S.rig = sc; S.rigW = w;
}
function xrwPlay(S, clip, t) { if (S.clip !== clip) { S.mx.stopAllAction(); S.act = S.mx.clipAction(clip); S.act.play(); S.clip = clip; } S.act.time = Math.max(0, Math.min(clip.duration - 0.001, t)); S.mx.update(0); }
function xrwShow(M, S) {
  if (S.rig.parent !== M.gun.parent) M.gun.parent.add(S.rig); // the held gun can be re-parented mid-motion (swap, holster)
  S.rig.position.copy(M.gun.position); S.rig.quaternion.copy(M.gun.quaternion); S.rig.scale.copy(M.gun.scale); // xgPose just solved this transform
  S.rig.visible = true; if (M.gun.visible) { M.gun.visible = false; S.hid = true; }
}
function xrwPose(M, dt) {
  if (!M || !M.sx) return;
  const X = M.sx, G = X.grip;
  // reload cancelled server-side (a shot interrupted it: the row's clock dropped to 0 with the gesture still
  // running): cut the reload override so the gun snaps back to the aim pose instead of playing out a lie.
  if (M && M.unit && M.unit.xAmCut) { M.unit.xAmCut = 0; if (X && X.uo === 'reload') { X.uo = null; X.ut = 0; } }
  let S = XRWB.state.get(M);
  const D = M && XRW_GUNS[M.w], K = D ? XRWB.don[M.w] : null;
  if (D && K === undefined) xrwKick(M.w);
  // shots: pump / lever / bolt guns cycle the action (the TP driver bumps X.shots on every server shot event)
  if (K && K.fire && XRW_FIRE[M.w] && X && X.shots !== S?.shots) { if (S) { S.shots = X.shots; if (S.mode !== 'reload') { S.mode = 'fire'; S.t = 0; } } }
  const rl = !!(D && K && K.reload && G && G.rl && G.rp >= 0 && !M.dead && M.gun && M.gun.parent);
  if (!S) { S = { rig: null, rigW: null, hid: false, mode: null, t: 0, shots: X ? X.shots : 0, clip: null, act: null, mx: null }; XRWB.state.set(M, S); }
  if (rl) {
    if (!S.rig || S.rigW !== M.w) xrwRig(M, S, K, M.w);
    S.mode = 'reload'; xrwPlay(S, K.reload, G.rp * K.reload.duration); xrwShow(M, S); return;
  }
  if (S.mode === 'reload') xrwDrop(M, S); // reload over (or cut): the static gun comes back
  if (!D || !K || M.dead || !M.gun || !M.gun.parent) { if (S.rig) xrwDrop(M, S); return; }
  if (S.mode === 'equip' || S.mode === 'fire') {
    const clip = S.mode === 'equip' ? K.equip : K.fire;
    if (!clip) { S.mode = null; return; }
    if (!S.rig || S.rigW !== M.w) xrwRig(M, S, K, M.w);
    S.t += Math.min(0.1, dt || 1 / 60);
    if (S.t >= clip.duration) { xrwDrop(M, S); return; }
    xrwPlay(S, clip, S.t); xrwShow(M, S);
  } else if (S.rig) xrwDrop(M, S);
}
{ const xgPoseTp = xgPose; xgPose = function (M, dt) { const r = xgPoseTp.apply(this, arguments); try { xrwPose(M, dt); } catch (e) {} return r; }; }
// weapon swap: the new gun rides in with its authored equip motion (xgHeldSync replaces the held gun on a change)
{ const xgHeldTp = typeof xgHeldSync === 'function' ? xgHeldSync : null; if (xgHeldTp) xgHeldSync = function (M) { const w0 = M && M.w; const r = xgHeldTp.apply(this, arguments); try { if (M && M.w !== w0 && XRW_GUNS[M.w] && !M.dead) { xrwKick(M.w); let S = XRWB.state.get(M); if (!S) { S = { rig: null, rigW: null, hid: false, mode: null, t: 0, shots: M.sx ? M.sx.shots : 0, clip: null, act: null, mx: null }; XRWB.state.set(M, S); } if (S.mode !== 'reload') { S.mode = 'equip'; S.t = 0; } /* donor still loading: xrwPose picks the pending equip up when it lands; a donor without an equip clip clears the mode */ } } catch (e) {} return r; }; }
// the grip skips dead units (xUbPost wrapper above), so a motion interrupted by death would leave the rigged stand-in frozen on the corpse: drop it here instead
{ const xUbPostTp = xUbPost; xUbPost = function (M) { const r = xUbPostTp.apply(this, arguments); try { if (M && M.dead) { const S = XRWB.state.get(M); if (S && S.rig) xrwDrop(M, S); } } catch (e) {} return r; }; }
// Online reload clock: server rows carry [27] = reload seconds remaining (server/src/simulation.js rows()). A 0 -> >0
// edge becomes the same xAmRn magazine-start counter offline BOT AMMO sets, so remote reloads play for the server's
// own remaining time; a mid-reload join starts the gesture at the ELAPSED offset (xAmEl, consumed by the grip as
// G.re), not from zero. A >0 -> 0 drop while the gesture still runs marks a cancel (xAmCut): the shot that
// interrupted the reload is already out, and the pose follows instead of playing the reload to its end.
// Without the field (an older server) the every-magazine's-worth-of-shots guess in xUbAnim stays.
if (typeof mpCliSnap === 'function') { const mpCliSnapRl = mpCliSnap; mpCliSnap = function (m) { const r = mpCliSnapRl.apply(this, arguments); try { if (m && Array.isArray(m.u)) { let by = null; for (const e of m.u) { if (!Array.isArray(e) || e[0] === MP.me) continue; if (!by) { by = new Map(); for (const u of bots.concat(allies)) if (u && u.nid != null) by.set(u.nid, u); } const u = by.get(e[0]); if (!u) continue; if (e[22] === 1 || !Number.isFinite(e[27])) { if (u.rlOn) { u.rlOn = 0; u.xAmCut = 1; } continue; } if (e[27] > 0) { if (!u.rlOn) { u.rlOn = 1; u.xAmRn = (u.xAmRn || 0) + 1; u.xAmRd = Math.min(5, e[27] + 0.05); try { const W = WEAP[e[11]]; if (W && W.rld > e[27]) u.xAmEl = W.rld - e[27]; } catch (e2) {} } } else if (u.rlOn) { u.rlOn = 0; u.xAmCut = 1; } } } } catch (e) {} return r; }; }
// ---- END TP ROCKLAN RELOAD ----
