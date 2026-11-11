// ---- ABILITY ANIM ----
// Ability animations that were missing (user: "some agents' abilities don't have animations"; audit work/abil_anim_audit.cjs,
// matrix work/validation/ability-anim-matrix.md). Installed by work/install_valorant.py near the end, so its xUbPost /
// xgTarget / xAfTick / jKey / mpFx-side wrappers are the outermost ones and every layer below them is untouched.
// THIRD PERSON. Every unit cast was one random generic one-shot (xCaBotGo: OverhandThrow or Spell_Simple_Shoot, 50 / 50) with
// the gun kept in the hand, and the relay path (xEqTpGo) threw a ReferenceError (xEqType was deleted with the legacy
// viewmodel in f95aa9e, so the typed throw / cast never ran; mpFx's try swallowed it). Now a cast plays a procedural upper-body
// pose typed by how Valorant casts that ability (XABA_TY): the gun is holstered (hidden) for the cast, the arms are solved with
// the weapon grip's own two-bone IK (xgIK / xgHandQ, as the Blade Storm hands and the Spike plant do) through per-style key
// poses (wind-up -> release -> recover), the torso twists / leans with them, and everything hands back exactly to the gun pose
// (bones restored before each mixer pass by the grip's save set; the grip is off while the pose runs). Upper-body arm and
// spine bones only, after xUbPost: locomotion (legs, pelvis, gait, foot planting) is never written.
// Triggers: online / P2P relays (mpFx -> xEqTpGo, fixed), offline bot abilities (xBUse inside botAb = the bot's charge
// spent, typed by its agent and key), offline bot ults (the shared FEEL ult charge XU.c dropping to 0). Blade Storm (its
// own pose, ability_fp_runtime) and units planting / defusing / on a rope are left alone.
// FIRST PERSON. Two holes in the ability viewmodel (ABILITY FIRST PERSON) are filled: (1) ONLINE, the keys the trusted server
// casts straight from the press (server_runtime netAbilityKey: Jett Updraft / Tailwind, Reyna Devour / Dismiss / Empress,
// Skye Regrowth, ...) sent the intent and returned before the page's quick-cast gesture (XCA, started on a local kit change)
// could see a change, so the arms never moved; now a sent cast the kit could make starts the same quick cast. (2) Omen From
// the Shadows (offline and online): picking the spot on the map and the 4 s shadow channel showed the gun; now the ability arms
// draw and hold the shadow orb while picking, cast as the channel starts and hold it through the channel.
var XABA = { n: 0, err: null, sent: null, ftsT: 0, fp: { on: false, t: 0, ph: "", ch: 0, k: "" }, live: [] };
// how each ability is cast in Valorant (third person): throw (overhand), under (underhand roll / toss), cast (hand pushed out
// from the shoulder), flick (side flick from the chest), place (lean forward, set it down), buff (self: hands to the chest,
// then open), bow (bow arm out, draw to the cheek, release), gaunt (fist punched forward).
var XABA_TY = {
  Jett: { c: "throw", q: "buff", e: "buff" }, Phoenix: { c: "cast", q: "throw", e: "flick", x: "cast" }, Sova: { c: "gaunt", q: "bow", e: "bow", x: "bow" },
  Sage: { c: "place", q: "throw", e: "cast", x: "cast" }, Reyna: { c: "flick", q: "buff", e: "buff", x: "buff" }, Omen: { c: "cast", q: "cast", e: "cast", x: "cast" },
  Killjoy: { c: "throw", q: "place", e: "place", x: "place" }, Raze: { c: "under", q: "throw", e: "throw", x: "cast" }, Skye: { c: "cast", q: "cast", e: "flick", x: "cast" },
  Breach: { c: "gaunt", q: "gaunt", e: "gaunt", x: "gaunt" }, Cypher: { c: "place", q: "under", e: "throw", x: "throw" }, Chamber: { c: "place", q: "cast", e: "place", x: "cast" },
};
// Key poses per style: u (0..1 of T s) -> right / left hand offsets from that shoulder in the agent frame (+x the agent's left,
// +y up, +z forward; m at the 1.92 m rig), torso twist (rad about up, + turns the chest left) and lean (rad, + forward),
// right-elbow pole. Hands start / end low in front (the gun is away) so the blend in / out reads as the gun going down / up.
var XABA_REST = { R: [-0.05, -0.42, 0.2], L: [0.05, -0.42, 0.2] };
var XABA_ST = {
  throw: { T: 0.85, K: [[0, XABA_REST], [0.24, { R: [-0.12, 0.14, -0.2], L: [0.1, -0.08, 0.42], tw: -0.38, le: -0.05, pR: [-1, 0.25, -0.6] }], [0.44, { R: [0.04, 0.02, 0.56], L: [0.1, -0.36, 0.14], tw: 0.3, le: 0.12 }], [0.72, { R: [-0.03, -0.3, 0.36], L: [0.06, -0.4, 0.16], tw: 0.1 }], [1, XABA_REST]] },
  under: { T: 0.85, K: [[0, XABA_REST], [0.24, { R: [-0.16, -0.58, -0.16], L: [0.12, -0.3, 0.3], tw: -0.25, le: 0.16 }], [0.46, { R: [-0.02, -0.34, 0.52], L: [0.1, -0.4, 0.2], tw: 0.15, le: 0.22 }], [0.74, { R: [-0.04, -0.38, 0.3], tw: 0.05, le: 0.08 }], [1, XABA_REST]] },
  cast: { T: 0.75, K: [[0, XABA_REST], [0.26, { R: [-0.02, -0.06, 0.3], L: [0.06, -0.44, 0.14], tw: -0.12 }], [0.46, { R: [0.01, 0.03, 0.58], L: [0.06, -0.45, 0.12], tw: 0.08, le: 0.06 }], [0.74, { R: [-0.02, -0.12, 0.44] }], [1, XABA_REST]] },
  flick: { T: 0.7, K: [[0, XABA_REST], [0.26, { R: [0.12, -0.14, 0.3], L: [0.06, -0.42, 0.16], tw: 0.2 }], [0.46, { R: [-0.24, 0.0, 0.48], L: [0.06, -0.42, 0.16], tw: -0.22 }], [0.74, { R: [-0.12, -0.2, 0.36] }], [1, XABA_REST]] },
  place: { T: 1.0, K: [[0, XABA_REST], [0.3, { R: [-0.02, -0.68, 0.42], L: [0.08, -0.6, 0.26], le: 0.55 }], [0.62, { R: [-0.02, -0.72, 0.46], L: [0.08, -0.6, 0.26], le: 0.58 }], [0.85, { R: [-0.04, -0.5, 0.3], le: 0.2 }], [1, XABA_REST]] },
  buff: { T: 0.8, K: [[0, XABA_REST], [0.3, { R: [0.13, -0.2, 0.26], L: [-0.13, -0.2, 0.26], le: -0.05 }], [0.52, { R: [-0.26, -0.06, 0.36], L: [0.26, -0.06, 0.36], le: -0.1 }], [0.78, { R: [-0.1, -0.3, 0.26], L: [0.1, -0.3, 0.26] }], [1, XABA_REST]] },
  bow: { T: 1.0, K: [[0, XABA_REST], [0.2, { R: [0.18, -0.06, 0.48], L: [0.02, -0.02, 0.58], tw: -0.1 }], [0.55, { R: [0.12, 0.1, 0.1], L: [0.02, 0.0, 0.6], tw: -0.25, pR: [-1, 0.3, -0.5] }], [0.66, { R: [-0.1, 0.06, -0.02], L: [0.02, 0.0, 0.6], tw: -0.25, pR: [-1, 0.3, -0.5] }], [0.86, { R: [-0.06, -0.3, 0.2], L: [0.05, -0.3, 0.3] }], [1, XABA_REST]] },
  gaunt: { T: 0.8, K: [[0, XABA_REST], [0.26, { R: [-0.06, -0.2, 0.04], L: [0.08, -0.42, 0.16], tw: -0.2 }], [0.44, { R: [0.02, -0.05, 0.6], L: [0.08, -0.44, 0.14], tw: 0.16, le: 0.1 }], [0.72, { R: [-0.02, -0.14, 0.46] }], [1, XABA_REST]] },
};
var XABA_FADE = { in: 0.08, out: 0.16, gun: 0.25 };
function xAbaType(ag, k) { const t = XABA_TY[ag]; return (t && t[k]) || (k === "x" ? "cast" : "throw"); }
function xAbaEase(x) { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); }
// pure (tests): the pose of style ty at fraction u -> { R, L, tw, le, pR } (keys missing in a key pose carry over from the last one that set them)
function xAbaKey(ty, u) {
  const S = XABA_ST[ty] || XABA_ST.cast, K = S.K, full = [];
  let last = { R: XABA_REST.R, L: XABA_REST.L, tw: 0, le: 0, pR: null }; for (const [t, p] of K) { last = { R: p.R || last.R, L: p.L || last.L, tw: p.tw != null ? p.tw : 0, le: p.le != null ? p.le : 0, pR: p.pR || null }; full.push([t, last]); }
  u = Math.max(0, Math.min(1, u)); let i = 0; while (i < full.length - 2 && u > full[i + 1][0]) i++;
  const [t0, a] = full[i], [t1, b] = full[i + 1], f = xAbaEase((u - t0) / Math.max(1e-6, t1 - t0)), lv = (x, y) => x.map((v, j) => v + (y[j] - v) * f);
  return { R: lv(a.R, b.R), L: lv(a.L, b.L), tw: a.tw + (b.tw - a.tw) * f, le: a.le + (b.le - a.le) * f, pR: (f < 0.5 ? a.pR : b.pR) || null };
}
// pure (tests): blend weight of the pose at t s into a cast of T s
function xAbaEnv(t, T) { if (!(t >= 0) || t >= T) return 0; return Math.min(1, t / XABA_FADE.in) * Math.min(1, (T - t) / XABA_FADE.out); }
// a cast on unit u (agent ag, key k): third-person pose request (also the test hook)
function xAbaTp(u, ag, k) {
  const M = u && u.xm; if (!M || u === (typeof player !== "undefined" ? player : null) || M.dead || !/^[cqex]$/.test(k || "")) return null;
  if (ag === "Jett" && k === "x") return null; // Blade Storm: its own knife-hands pose (ability_fp_runtime xBtpHands)
  const ty = xAbaType(ag, k); M.xCast = 0; // no random generic one-shot on top (xCaBotGo)
  const A = M.xab || (M.xab = { on: false, hid: 0 }); A.on = true; A.k = k; A.ag = ag; A.ty = ty; A.t = 0; A.T = (XABA_ST[ty] || XABA_ST.cast).T; A.ph = "wind"; A.w = 0;
  if (XABA.live.indexOf(M) < 0) XABA.live.push(M); XABA.n++; return A;
}
function xAbaBusy(M) { const X = M.sx; return !!((M.btp && M.btp.on) || (X && X.w && X.w.plant > 0.05) || (X && X.xsa && X.xsa.on) || (M.unit && M.unit.rope > 0)); }
function xAbaEnd(M) { const A = M.xab; if (!A) return; if (A.hid && M.gun && !M.xvWait && !M.dead) M.gun.visible = true; A.hid = 0; A.on = false; A.w = 0; A.ph = ""; const i = XABA.live.indexOf(M); if (i >= 0) XABA.live.splice(i, 1); }
// after the stock pose + grip pass (xUbPost): the cast pose on the arms + upper spine, blended by its envelope
function xAbaPose(M, dt) {
  const A = M.xab; if (!A || !A.on) return; const X = M.sx;
  if (!X || !X.sc || X.dd || M.dead || !M.valorant) return xAbaEnd(M);
  A.t += dt > 0 ? dt : 1 / 60; if (A.t >= A.T) return xAbaEnd(M);
  const u = A.t / A.T, w = xAbaEnv(A.t, A.T), P = xAbaKey(A.ty, u); A.w = w; A.ph = u < 0.3 ? "wind" : u < 0.6 ? "release" : "recover";
  if (M.gun) { if (w > XABA_FADE.gun && M.gun.visible) { M.gun.visible = false; A.hid = 1; } else if (w <= XABA_FADE.gun && A.hid && !M.xvWait) { M.gun.visible = true; A.hid = 0; } }
  if (xAbaBusy(M)) return; // another full-body / two-hand layer owns the arms this frame (the gun stays holstered until the cast ends)
  const G = X.grip || (typeof xgSetup === "function" && M.gun ? xgSetup(M) : null); if (!G || !G.ok) return;
  const sv = A.sv || (A.sv = new Map()); for (const bn of G.R.bones.concat(G.L.bones)) { let q = sv.get(bn); if (!q) sv.set(bn, (q = new THREE.Quaternion())); q.copy(bn.quaternion); }
  const B = X.b, sp = [B.spine_02, B.spine_03, B.spine_04].filter(Boolean); // twist / lean on the upper spine (xUbPre restores these before the next mixer pass)
  if (sp.length && (Math.abs(P.tw) > 1e-4 || Math.abs(P.le) > 1e-4)) for (const s of sp) { if (P.tw) xUbRot(X, s, XUB.up, (P.tw * w) / sp.length); if (P.le) xUbRot(X, s, XUB.rt, (P.le * w) / sp.length); }
  const root = M.m; root.updateMatrixWorld(true); const rq = xgWorldQ(root, A.rq || (A.rq = new THREE.Quaternion())), V = A.v || (A.v = Array.from({ length: 6 }, () => new THREE.Vector3()));
  const ax = (x, y, z, o) => o.set(x, y, z).applyQuaternion(rq), hq = A.hq || (A.hq = new THREE.Quaternion()), curl = XABA.curl || (XABA.curl = { Index: [0.1, 0.15, 0.1], Middle: [0.15, 0.2, 0.12], Ring: [0.2, 0.22, 0.12], Pinky: [0.25, 0.22, 0.12], Thumb: [0.1, 0.12, 0.1] });
  const fist = XABA.fist || (XABA.fist = { Index: [1.2, 1.3, 0.9], Middle: [1.25, 1.3, 0.9], Ring: [1.3, 1.3, 0.9], Pinky: [1.3, 1.25, 0.9], Thumb: [0.6, 0.5, 0.4] });
  for (const [Ar, o, sd, pole] of [[G.R, P.R, -1, P.pR], [G.L, P.L, 1, null]]) {
    const t = Ar.up.getWorldPosition(V[0]).add(ax(o[0], o[1], o[2], V[1]));
    const k = ax(sd * 0.2, 0.15, 1, V[2]).normalize(), n = ax(-sd * 0.25, -1, 0.2, V[3]).normalize(); xgHandQ(Ar, k, n, hq);
    const pl = pole ? ax(pole[0] * -sd, pole[1], pole[2], V[4]).normalize() : ax(sd * 0.8, -1, -0.25, V[4]).normalize();
    xgIK(Ar, t, pl, G); xgSetWorldQ(Ar.hand, hq); xgCurl(Ar, A.ty === "gaunt" && sd < 0 ? fist : curl, k, n);
  }
  if (w < 0.999) for (const [bn, q] of sv) { bn.quaternion.slerp(q, 1 - w); bn.updateMatrixWorld(true); }
}
if (typeof xUbPost === "function") { const p0 = xUbPost; xUbPost = function (M) { p0.apply(this, arguments); try { if (M && M.xab && M.xab.on) xAbaPose(M, M.sx && M.sx.poseDt); } catch (e) { XABA.err = String(e && e.stack || e); } }; }
// the weapon grip lets go while the cast pose runs (it fades the arms to the clip pose and resets the gun's hold)
if (typeof xgTarget === "function") { const g0 = xgTarget; xgTarget = function (M) { if (M && M.xab && M.xab.on) return 0; return g0.apply(this, arguments); }; }
// the relay path (P2P host / client, trusted-server replay: mpFx -> xEqTpGo): the legacy right-arm swing for non-native rigs, then the typed pose
function xEqType(k, ag) { const t = xAbaType(ag, k); return t === "throw" || t === "under" ? "throw" : "cast"; } // kept for callers of the old name (removed in f95aa9e)
if (typeof xEqTpGo === "function") { xEqTpGo = function (u, ag, k) {
  const R = u && u.xm; if (!R || u === player || R.dead) return;
  try { xCaBotGo(R); } catch (e) {} R.xCpT = performance.now(); if (typeof XEQT !== "undefined" && !XEQT.includes(R)) XEQT.push(R);
  if (R.ub) xAbaTp(u, ag, k);
}; }
// offline bots: a spent ability charge inside the bot's ability think (botAb / bot variety) is a cast
if (typeof xBUse === "function") { const u0 = xBUse; xBUse = function (b, k) { const r = u0.apply(this, arguments); try { if (r && b && b.xm && b.xm.ub) xAbaTp(b, xBAg(b), k); } catch (e) { XABA.err = String(e); } return r; }; }
function xAbaUltPoll() { // offline bot ults: the shared FEEL ult charge (XU.c, window.xBotUC) drops to 0 when a bot casts its ult
  const C = window.xBotUC; if (!C || (typeof NET !== "undefined" && NET && NET.socket) || typeof bots === "undefined") return; const L = XABA.uc || (XABA.uc = {});
  for (const U of [bots, typeof allies !== "undefined" ? allies : []]) for (const b of U) { if (!b || !b.name) continue; const v = C[b.name] || 0, was = L[b.name] || 0; L[b.name] = v;
    if (was >= 7 && v === 0 && b.alive && b.xm && b.xm.ub) { try { xAbaTp(b, xBAg(b), "x"); } catch (e) {} } }
}
// ---- first person ----
function xAbaReady(k) { // could the kit make this cast right now (pre-press state)? (online: the server decides; this only picks the animation)
  try { if (J.pick === "Reyna" && (k === "q" || k === "e") && typeof xInstOnline === "function") { const r = xInstOnline(k); if (r !== null) return r; }
    if (k === "x") return J.ult >= K().u || (J.pick === "Jett" && J.bsOn); if (J.pick === "Jett" && k === "e" && (J.dash || (typeof NET !== "undefined" && NET.tw))) return true;
    return (J[k] | 0) > 0 || !!(J.pick === "Skye" && k === "c"); } catch (e) { return false; }
}
// ---- cast pipeline: every ability press either casts with its animation or tells the player why it did not ----
// Online the trusted server owns the cast. Each cast request ('ab') carries an id n that the server echoes in its answer ('ao',
// server worker castAnswer). A press of a key the server casts straight from the press starts the quick cast at once when the
// kit looks ready (prediction); otherwise the answer decides: ok and not yet animated -> the quick cast starts now (late, never
// skipped); refused but animated -> the gesture is cut. Exactly one quick cast per confirmed cast (the request's entry is
// consumed by its answer). Was: the quick cast started only if the page's pre-press guess said yes AND no earlier quick cast
// was still playing (XCA.on): a second cast inside the 0.72 s window (the movement ability right after another cast), or a
// press guessed wrong from a stale round state, was cast by the server with no animation.
// Refusals: a kit that refuses a press with only its 120 Hz no-blip (no text of its own), and every server refusal, now show
// the reason: on cooldown (s left), no charges left, ultimate not ready, buy phase, suppressed, busy, can't be used now.
var XABC = { seq: 0, pend: [], ttl: 3000, cur: 0, nb: 0, last: null, n: { press: 0, late: 0, cut: 0, fb: 0, lost: 0 } };
var XABC_TXT = { cooldown: "on cooldown", charges: "no charges left", ult: "ultimate not ready", buy: "not usable in the buy phase", suppressed: "suppressed", busy: "finish the current ability first", state: "can't be used right now" };
function xAbcName(k) { try { const n = K().n, i = "cqex".indexOf(k); return (n && n[i]) || ""; } catch (e) { return ""; } }
// pure (tests): the line shown for a refusal of slot k with reason r (cd: seconds of cooldown left)
function xAbcText(k, r, cd) { const t = XABC_TXT[r] || XABC_TXT.state, nm = xAbcName(k), s = r === "cooldown" && cd > 0 ? t + " · " + (+cd).toFixed(1) + " s" : t; return nm ? nm + " · " + s : s; }
// why the kit would refuse slot k now, from its own state ("" = nothing obvious: no room, no target, nothing to recast ...)
function xAbcWhy(k) { try { if (k === "x") return J.ult < K().u ? "ult" : ""; if (J.cd && J.cd[k] > 0) return "cooldown"; if (!((J[k] | 0) > 0)) return "charges"; } catch (e) {} return ""; }
function xAbcSay(k, r, cd) { const t = xAbcText(k, r, cd); XABC.last = { k, r, t }; XABC.n.fb++; try { sgNo(); } catch (e) {} try { say(t, 1200); } catch (e) {} return t; }
function xAbcToast() { try { return typeof toast !== "undefined" && toast ? toast.textContent : ""; } catch (e) { return ""; } }
// the first-person quick cast of slot k (a key the trusted server casts from the press); p: its pending request, marked animated
function xAbaQuick(k, p) {
  const i = "cqex".indexOf(k), ty = (ABI_M[J.pick] || ABI_M.Jett)[i]; XAF.qk = XAF.nk = k; xCaStart(XCA_T[ty] || "cast"); if ((XAB_INST[J.pick] || "").includes(k)) xInstGo(k); XABA.fpQ = (XABA.fpQ || 0) + 1;
  if (p) { p.a = 1; XABC.cur = p.n; }
}
// the server's answer to a cast request -> true when the player was told why it was refused
function xAbcAo(m) {
  const now = performance.now(); XABC.pend = XABC.pend.filter((p) => { if (now - p.t < XABC.ttl) return true; XABC.n.lost++; return false; });
  const i = m && Number.isSafeInteger(m.n) ? XABC.pend.findIndex((p) => p.n === m.n) : -1, p = i >= 0 ? XABC.pend.splice(i, 1)[0] : null;
  if (m && m.ok) { if (p && p.el && !p.a && running && player && player.hp > 0 && J.pick === p.ag) { xAbaQuick(p.k, p); XABC.n.late++; } return false; }
  if (p && p.a && XABC.cur === p.n && XCA.on) { xCaEnd(); XABC.n.cut++; } // predicted, refused: no gesture for a cast that did not happen
  xAbcSay(m && m.k, m && typeof m.r === "string" ? m.r : "state", m && Number(m.cd)); return true;
}
if (typeof blip === "function") { const b0 = blip; blip = function (f, d, ty) { if (f === 120 && ty === "square") XABC.nb++; return b0.apply(this, arguments); }; } // the kits' shared refusal sound (no() / sgNo)
if (typeof netSend === "function") { const n0 = netSend; netSend = function (m) { try { if (m && m.t === "ab") { XABA.sent = m;
      if (!Number.isSafeInteger(m.n)) { m.n = ++XABC.seq; XABC.pend.push({ n: m.n, k: m.k, ag: J.pick, a: 1, el: 0, t: performance.now() }); if (XABC.pend.length > 32) XABC.pend.shift(); } // a: 1 = animated by its own path (equip release ...) unless the press below says otherwise
      if (m.k === "x" && J.pick === "Omen" && Array.isArray(m.p)) XABA.ftsT = typeof XPAR2 !== "undefined" && XPAR2.shadows ? XPAR2.shadows : 4; } } catch (e) {} return n0.apply(this, arguments); }; }
if (typeof jKey === "function") { const k0 = jKey; jKey = function (code) {
  const ab = typeof code === "string" && /^Key[CQEX]$/.test(code), k = ab ? code[3].toLowerCase() : "";
  let pre = null, fb = null; try { pre = ab && typeof NET !== "undefined" && NET.socket && running && player && player.hp > 0 ? { k, ok: xAbaReady(k) } : null; } catch (e) {}
  try { if (ab && running && player && player.hp > 0) fb = { r: xAbcWhy(k), cd: J.cd && J.cd[k], nb: XABC.nb, tx: xAbcToast() }; } catch (e) {}
  XABA.sent = null; const r = k0.apply(this, arguments);
  try { const m = XABA.sent; if (pre && m && m.k === pre.k && !J.eq && !(J.pick === "Jett" && pre.k === "x")) { // the trusted server casts it from the press: same quick cast as offline
      const p = XABC.pend.find((x) => x.n === m.n); if (p) { p.el = 1; p.a = 0; } XABC.n.press++;
      if (pre.ok) xAbaQuick(pre.k, p); } } catch (e) { XABA.err = String(e); } // otherwise its answer starts it (xAbcAo)
  try { if (fb && !XABA.sent && XABC.nb > fb.nb && xAbcToast() === fb.tx) xAbcSay(k, fb.r || "state", fb.cd); } catch (e) {} // the kit refused with a bare blip: say why
  XABA.sent = null; return r; }; }
// Omen From the Shadows: the arms hold the shadow orb while the spot is picked (J.ftp), cast as the channel starts and hold it
// through the channel (J.fts offline; online the sent cast's 4 s). Fed to the ability viewmodel as an equip state of key x.
function xAbaFpSus(dt) {
  const F = XABA.fp; if (XABA.ftsT > 0) XABA.ftsT = Math.max(0, XABA.ftsT - (dt || 0));
  const live = running && player && player.hp > 0 && typeof jOn === "function" && jOn(), ch = !!(J.fts || XABA.ftsT > 0), pick = !!J.ftp;
  if (!live || J.pick !== "Omen" || !(ch || pick)) { if (!live || J.pick !== "Omen") XABA.ftsT = 0; F.on = false; F.t = 0; F.ch = 0; F.ph = ""; return null; }
  F.on = true; F.k = "x"; F.t += dt || 0;
  if (ch) { if (!F.ch) { F.ch = 1; try { XAF.qk = XAF.nk = "x"; xCaStart("cast"); } catch (e) {} } F.ph = "hold"; return { k: "x", code: "KeyX", st: "hold", t: 0, d0: 0.5, h: 0, bn: 0, alt: false }; }
  F.ph = F.t < 0.5 ? "draw" : "ready"; return { k: "x", code: "KeyX", st: F.ph, t: Math.max(0, 0.5 - F.t), d0: 0.5, h: 0, bn: 0, alt: false };
}
if (typeof xAfTick === "function") { const a0 = xAfTick; xAfTick = function (dt) { let s = null; try { s = xAbaFpSus(dt); } catch (e) { XABA.err = String(e); } if (!s || J.eq || XCA.on) return a0.apply(this, arguments); const q0 = J.eq; J.eq = s; try { return a0.apply(this, arguments); } finally { J.eq = q0; } }; }
(window.XHK = window.XHK || []).push(() => { try { xAbaUltPoll(); } catch (e) {} });
window.xAbilityAnim = { XABA, XABA_TY, XABA_ST, XABC, key: xAbaKey, env: xAbaEnv, type: xAbaType, tp: xAbaTp, pose: xAbaPose, end: xAbaEnd, text: xAbcText, ao: xAbcAo };
// ---- END ABILITY ANIM ----
