// ---- DEBUG HOOKS ----
// Headless/manual testing hooks. Active only on localhost or with ?__vs=1.
// window.__vsLight=1 (via __vs.light(true)) switches the native map load to a
// collision+navigation-only path (no scene.gltf) and skips the agent-rig
// readiness gate, so logic-level matches can start in constrained environments
// (headless SwiftShader) without the full render burst.
try {
  const __vsOn = /^(127\.|localhost|\[::1\])/.test(location.hostname); // localhost only: no query/hash activation on any host
    if (__vsOn) {
    { const ra = xvReadyAgents; xvReadyAgents = function () { return window.__vsNoAgents ? Promise.resolve() : ra.apply(this, arguments); }; }
    window.__vs = {
      light(on) { window.__vsLight = !!on; if (on && window.__vsNoAgents === undefined) window.__vsNoAgents = true; return window.__vsLight; },
      agents(off) { window.__vsNoAgents = !!off; return !window.__vsNoAgents; },
      fire(on) { fireHeld = !!on; },
      setTimeLeft(sec) { timeLeft = +sec; },
      aimAt(x, y, z) { const e = pEye(); yaw = Math.atan2(-(x - e.x), -(z - e.z)); pitch = Math.atan2(y - e.y, Math.hypot(x - e.x, z - e.z)); },
      startDM() { xLob0 = false; return startDM(); }, startTDM() { xLob0 = false; return startTDM(); }, startFive() { xLob0 = false; return startFive(); },
      hurt(t, n, by) { return hurt(t, n, by); }, kill(b, hs, by, w) { return kill(b, hs, by, w); },
      state() {
        return { running: !!running, mode, dm: !!FV.dm, tdm: !!FV.tdm, map: FV.map,
          timeLeft: (typeof timeLeft !== 'undefined') ? timeLeft : null, paused: (typeof paused !== 'undefined') ? !!paused : null, xLdOn: !!window.xLdOn,
          ammo: (typeof ammo !== 'undefined') ? ammo : null,
          fcd: (typeof fcd !== 'undefined') ? fcd : null, fireHeld: (typeof fireHeld !== 'undefined') ? !!fireHeld : null, reloading: (typeof reloading !== 'undefined') ? reloading : null, vmsw: (typeof VM !== 'undefined') ? VM.sw : null,
          xnf: (typeof XNF !== 'undefined') ? XNF : null, cov: (typeof xCov === 'function') ? !!xCov() : null, gate: (typeof xGate === 'function') ? !!xGate() : null, lob0: (typeof xLob0 !== 'undefined') ? !!xLob0 : null, resUp: (typeof xResUp === 'function') ? !!xResUp() : null,
          bots: bots.length, alive: bots.filter((b) => b.alive).length,
          botsPos: bots.map((b) => [b.name, +b.g.position.x.toFixed(1), +b.g.position.y.toFixed(1), +b.g.position.z.toFixed(1), !!b.alive]),
          player: player && [player.x, player.y, player.z, player.hp] };
      },
      get bots() { return bots; }, get allies() { return allies; }, get player() { return player; },
      FV, DM, scene, renderer, camera };
  }
} catch (e) { try { console.warn("__vs hooks failed", e); } catch (_) {} }
// ---- END DEBUG HOOKS ----
