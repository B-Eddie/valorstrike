// ---- ENEMY INFO ----
// What the player may know about the ENEMY team, as VALORANT (user 2026-10-26: "You shouldn't be able to ... see what guns
// the enemy has"). The Tab scoreboard shows an enemy's agent, K / D / A, ult points (live: VALORANT's scoreboard shows
// enemy ult status, Dignitas "All the Valuable Information on the VALORANT Scoreboard Tab") and the credits they STARTED
// the round with (VALORANT's enemy credits are updated only at the round start - namu.wiki VALORANT/System 1.3 - never
// their live spending); never an enemy's weapon, armor or live credits (sbLoadout '—', the spectate panels show no gun /
// HP / shield for an enemy row, the server sends a hidden enemy row without its weapon and only `ec`, round-start credits,
// in roundState). The kill feed keeps the killer's weapon (VALORANT does).
//  - offline 5v5: each bot's credits are taken just before it shops for the round (outermost fBotBuy: every economy
//    path - srOn, XBV team calls, mp5 seats - runs inside it), keyed by round + side + match;
//  - online: roundState.ec (server spike.js u.roundCr at the buy-phase start).
var XEI = { m: 0 };
function xeiKey() { try { return XEI.m + '|' + (FV.you + FV.them) + '|' + (FV.atk ? 1 : 0); } catch (e) { return ''; } }
if (typeof sbReset === 'function') { const r0 = sbReset; sbReset = function () { XEI.m++; try { FV.ec = null; } catch (e) {} return r0.apply(this, arguments); }; }
if (typeof fBotBuy === 'function') { const b0 = fBotBuy; fBotBuy = function (n) { try { if (mode === 'five' && !FV.dm && FV.bs && FV.bs[n] && !(typeof MP !== 'undefined' && MP.on)) { const k = xeiKey(); if (!FV.ec || FV.ec.k !== k) FV.ec = { k }; if (!(n in FV.ec) && Number.isFinite(FV.bs[n].cr)) FV.ec[n] = FV.bs[n].cr; } } catch (e) {} return b0.apply(this, arguments); }; }
if (typeof mpCliRS === 'function') { const r0 = mpCliRS; mpCliRS = function (m) { const r = r0.apply(this, arguments); try { if (m && m.ec && typeof m.ec === 'object') { const E = { k: 'net' }; for (const n in m.ec) if (Number.isFinite(m.ec[n])) E[mpIn(n)] = m.ec[n] | 0; FV.ec = E; } } catch (e) {} return r; }; }
function xeiEnemy(n) { try { if (n === 'You') return false; const T = sbTeams(); return T[1].indexOf(n) >= 0 && T[0].indexOf(n) < 0; } catch (e) { return false; } }
// an enemy's credits: the round-start figure, else unknown ('—'); never their live credits (5v5 economy modes)
if (typeof sbCred === 'function') { const c0 = sbCred; sbCred = function (n) { try { if (mode === 'five' && !FV.dm && xeiEnemy(n)) { const v = FV.ec && FV.ec[n]; return Number.isFinite(v) ? v : '—'; } } catch (e) {} return c0.apply(this, arguments); }; }
window.xEnemyInfo = XEI;
// ---- END ENEMY INFO ----
