// ---- CHARACTER COLLISION ----
// User: "there's supposed to be collisions between characters" - the player and the bots walked through each other.
// VALORANT: every living character, teammate or enemy, is a solid capsule: nobody walks through another, a walk into one
// stops at the contact and slides around it, nobody is shoved by someone walking into them, a unit dropping onto a head
// slides off. The rules are the shared motor's (vendor/valorant-feel.js = server/src/motor.cjs): bodies() after a unit's own
// step (C.bodyR 0.35 m each, the overlap its step made undone, older overlap eased apart at C.bodySep m/s, never into the
// world) and bodySteer() for bots (pass whoever is in the way, on the right when they are dead ahead).
//  - player (offline and online): moveP calls xcPlayer after the motor step (feel_runtime), against every other living unit
//    the page draws (bots + allies; online the server's units as drawn, fog-parked ones skipped) - the server runs the same
//    call on its step (simulation.js / spike.js), so the prediction lands where the server puts it (no rubber-band).
//  - offline bots and allies: after each sim step (tick / fiveTick / duelTick wrappers) every living bot resolves against
//    the others and the player (positions before the step = the last resolve), and their walk is steered around whoever is in
//    the way (xSmV wrapper, every bot walk goes through it). Online (trusted server) the server moves every other unit; the
//    P2P host resolves its own bots (not the remote humans: their pages own their positions).
//  - not for: dead or not-yet-spawned units, a unit on a rope, Reyna's Dismiss (intangible), the aim range.
function xcVF() { return window.ValorantFeel && window.ValorantFeel.bodies ? window.ValorantFeel : null; }
function xcOnline() { try { return typeof MP !== "undefined" && !!MP.on; } catch (e) { return false; } }
function xcHost() { try { return typeof MP !== "undefined" && !!MP.on && MP.role === "host"; } catch (e) { return false; } }
function xcLive(u) { return !!u && !!u.g && u.alive !== false && !(u.hp <= 0) && !u.nt && !u.fog && !(u.dis > 0); }
// A unit as the motor sees it: feet position, crouch height (bots crouch as a flag, online rows as a fraction in u.ch).
function xcBody(u) { const p = u.g.position, M = xcVF(), ce = M ? M.C.crouchEye : 0.45; const b = u.xcB || (u.xcB = { x: 0, y: 0, z: 0, ch: 0, vx: 0, vz: 0 }); b.x = p.x; b.y = p.y || 0; b.z = p.z; b.ch = typeof u.ch === "number" ? u.ch : u.cr ? ce : 0; return b; }
function xcPlayerBody() { if (typeof player === "undefined" || !player || !(player.hp > 0)) return null; try { if (typeof J !== "undefined" && J.dis > 0) return null; } catch (e) {} return player; }
function xcUnits() { const out = []; try { for (const u of bots) if (xcLive(u)) out.push(u); for (const u of allies) if (xcLive(u)) out.push(u); } catch (e) {} return out; }
function xcActive() { try { return typeof running !== "undefined" && running && typeof mode !== "undefined" && mode !== "aim" && mode !== "surf"; } catch (e) { return false; } }
// The player's step (moveP): solid against every other living unit the page draws.
function xcPlayer(P, dt, world, ox, oz) {
  const M = xcVF(); if (!M || !xcActive() || !P || P !== xcPlayerBody() || P.rope > 0) return false;
  const L = []; for (const u of xcUnits()) L.push(xcBody(u)); return L.length ? M.bodies(P, L, dt, world, ox, oz) : false;
}
function xcOwnBot(u) { return !(xcOnline() && (!xcHost() || u.hum)); }
function xcBotWorld() { return { ground: () => 0, blocked: (x, z, r, y) => blocked(x, z, 0.45, y) }; } // the bot loops' own wall test (0.45 m)
function xcOthers(u, list) { const L = []; for (const v of list) if (v !== u) L.push(xcBody(v)); const pl = xcPlayerBody(); if (pl) L.push(pl); return L; }
// Offline bots after a sim step: each living bot, in turn, out of the others and the player.
function xcBots(dt) {
  const M = xcVF(); if (!M || !xcActive() || !(dt > 0)) return;
  const list = xcUnits(), W = xcBotWorld();
  for (const u of list) {
    const p = u.g.position, o = u.xcO;
    if (!xcOwnBot(u) || u.rope > 0) { u.xcO = null; continue; }
    const B = xcBody(u), S = u.smMotor; B.vx = S ? S.vx : 0; B.vz = S ? S.vz : 0;
    const fresh = o && Math.hypot(p.x - o[0], p.z - o[1]) < 2; // moved more than 2 m since the last resolve (respawn, teleport): no step to undo
    if (M.bodies(B, xcOthers(u, list), dt, W, fresh ? o[0] : null, fresh ? o[1] : null)) { p.x = B.x; p.z = B.z; if (S) { S.vx = B.vx; S.vz = B.vz; } }
    (u.xcO || (u.xcO = [0, 0]))[0] = p.x; u.xcO[1] = p.z;
  }
}
{ const t0 = tick; tick = function (dt) { const r = t0.apply(this, arguments); try { xcBots(dt); } catch (e) {} return r; }; }
{ const f0 = fiveTick; fiveTick = function (dt) { const r = f0.apply(this, arguments); try { xcBots(dt); } catch (e) {} return r; }; }
{ const d0 = duelTick; duelTick = function (dt) { const r = d0.apply(this, arguments); try { xcBots(dt); } catch (e) {} return r; }; }
// Bots walk around whoever is in their way (every bot walk goes through xSmV).
if (typeof xSmV === "function") { const sm0 = xSmV; xSmV = function (u, dt, vx, vz, speed) { try { const M = xcVF(); if (M && (vx || vz) && u && u.g && xcActive() && xcOwnBot(u) && xcLive(u) && !(u.rope > 0)) { const s = M.bodySteer(xcBody(u), xcOthers(u, xcUnits()), vx, vz); vx = s[0]; vz = s[1]; } } catch (e) {} return sm0.call(this, u, dt, vx, vz, speed); }; }
window.xCollide = { xcPlayer, xcBots, xcBody, xcUnits, xcLive };
// ---- END CHARACTER COLLISION ----
