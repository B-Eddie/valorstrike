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
      slowRender(ms) { if (!window.__vsOrigLoop) { window.__vsOrigLoop = loop; window.__vsLastRun = 0; window.__vsSlowMs = +ms || 400; loop = function () { const now = performance.now(); if (now - window.__vsLastRun >= window.__vsSlowMs) { window.__vsLastRun = now; window.__vsOrigLoop(); } else { loop.id = requestAnimationFrame(loop); } }; } else { window.__vsSlowMs = +ms || 400; } return window.__vsSlowMs; },
      pauseRender(v) { if (v) { if (!window.__vsOrigLoop) { window.__vsOrigLoop = loop; loop = function () { loop.id = requestAnimationFrame(loop); }; } return true; } if (window.__vsOrigLoop) { loop = window.__vsOrigLoop; window.__vsOrigLoop = null; if (typeof XRT !== 'undefined') XRT.skip = 1; } return false; },
      fire(on) { fireHeld = !!on; },
      setTimeLeft(sec) { timeLeft = +sec; },
      rangeDrill(name) { if(mode!=='aim'||!running||!['free','spray','strafe','spike'].includes(name))return false;rgSet(name);return true; },
      setPos(x, y, z) { player.x = +x; player.y = +y; player.z = +z; player.vy = 0; player.vx = 0; player.vz = 0; },
      aimAt(x, y, z) { const e = pEye(); yaw = Math.atan2(-(x - e.x), -(z - e.z)); pitch = Math.atan2(y - e.y, Math.hypot(x - e.x, z - e.z)); },
      startDM() { xLob0 = false; return startDM(); }, startTDM() { xLob0 = false; return startTDM(); }, startFive() { xLob0 = false; return startFive(); },
      startRetake() { xLob0 = false; return start(); }, startDuel() { xLob0 = false; return startDuel(); }, startSurf() { xLob0 = false; return startSurf(); }, startAim() { xLob0 = false; return startAim(); }, startRifle() { xLob0 = false; return startRifle(); },
      hurt(t, n, by) { return hurt(t, n, by); }, kill(b, hs, by, w) { return kill(b, hs, by, w); },
      die(by) { try { return pDie(by || "TestBot"); } catch (e) { return String(e); } },
      siteGoals() { try { const C = nmActive(); return C && C.siteGoals ? JSON.parse(JSON.stringify(C.siteGoals)) : null; } catch (e) { return null; } },
      resetFirstBlood() { try { xFirstBlood.r = null; return true; } catch (e) { return false; } },
      net() { try { return { st: (typeof MP !== 'undefined') ? MP.st : null, on: (typeof MP !== 'undefined') ? !!MP.on : null,
          role: (typeof MP !== 'undefined') ? MP.role || null : null, host: (typeof NET !== 'undefined') ? !!NET.host : null,
          ws: (typeof NET !== 'undefined' && NET.socket) ? NET.socket.readyState : -1,
          drops: (typeof NET !== 'undefined' && NET.drops) ? NET.drops.slice() : [],
          code: (typeof MP !== 'undefined') ? MP.code || null : null, mode: (typeof MP !== 'undefined') ? MP.mode : null,
          name: (typeof MP !== 'undefined') ? MP.name || null : null,
          xReady: (typeof xReady !== 'undefined') ? !!xReady : null,
          nmPending: (typeof NM !== 'undefined') ? !!(NM.pending) : null, nmLoaded: (typeof NM !== 'undefined') ? NM.loaded : null,
          nmTicket: (typeof NM !== 'undefined') ? NM.ticket : null,
          loadAt: (typeof NET !== 'undefined') ? (NET.loadAt || 0) : null,
          netReady: (typeof NET !== 'undefined') ? !!NET.ready : null }; } catch (e) { return { err: String(e) }; } },
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
      get bots() { return bots; }, get allies() { return allies; }, get player() { return player; }, get duelBot() { return duelBot; },
      xrw() { try { return { don: Object.fromEntries(Object.entries(XRWB.don).map(([k, v]) => [k, v ? { rl: !!v.reload, eq: !!v.equip, fi: !!v.fire } : (v === null ? 'null' : 'pending')])), gripErr: (typeof XGRIP !== 'undefined' && XGRIP.err) || 0, failures: (typeof XV !== 'undefined' && XV.failures) ? Object.assign({}, XV.failures) : {} }; } catch (e) { return { err: String(e) }; } },
      xrwState(M) { try { const S = XRWB.state.get(M); return S ? { mode: S.mode, hid: S.hid, rig: !!S.rig, rigW: S.rigW, clip: !!S.clip, t: +(S.t || 0).toFixed(2) } : null; } catch (e) { return String(e); } },
      vmState() { try { return { gunParent: !!gun.parent, gunVisible: gun.visible, knifeVisible: knife.visible, fpRoot: !!(typeof XV !== 'undefined' && XV.fp && XV.fp.root && XV.fp.root.visible) }; } catch (e) { return String(e); } },
      vmHide(v) { try { if (v) { if (gun.parent) { window.__vsGunParent = gun.parent; gun.parent.remove(gun); } knife.visible = false; if (typeof XV !== 'undefined' && XV.fp && XV.fp.root) XV.fp.root.visible = false; } else if (window.__vsGunParent) { window.__vsGunParent.add(gun); window.__vsGunParent = null; } return true; } catch (e) { return String(e); } },
      gunPrep(w) { try { const k = XGM.F[w]; if (!k) return Promise.resolve('no-map'); return Promise.resolve(xvLoad(k.split('/').pop())).then((g) => { XV.guns[k] = g; XGM.src[k] = xvStatic(g, XV.config[k.split('/').pop()]); const T = xGmTpl(w); if (T) XGM.T[w] = T; for (const [gg, kk] of XGM.live) { if (kk === w) try { xGmSwap(gg, kk); } catch (e) {} } return { ok: !!T, grip: !!(T && T.userData.grip) }; }).catch((e) => String(e)); } catch (e) { return String(e); } },
      xrwWhy(M) { try { const X = M && M.sx; if (!X) return { noSx: 1 }; const kids = []; M.gun.traverse((o) => { if (o.userData && (o.userData.grip || o.userData.sock)) kids.push((o.name || o.type) + (o.userData.grip ? ':grip' : ':sock')); });
        return { want: (function () { try { return xgTarget(M); } catch (e) { return 'e:' + e; } })(), gripFound: (function () { try { return !!xgGrip(M); } catch (e) { return 'e:' + e; } })(), w: M.w, dd: !!X.dd, dead: !!M.dead, uo: X.uo, plantW: X.w && X.w.plant, gunRootGrip: !!M.gun.userData.grip, kids: kids.slice(0, 6), tplGrip: !!(typeof XGM !== 'undefined' && XGM.T[M.w] && XGM.T[M.w].userData.grip), tplKeys: typeof XGM !== 'undefined' ? Object.keys(XGM.T).length : -1, xvWait: !!M.xvWait }; } catch (e) { return String(e); } },
      xrwGrip(M) { try { const G = M && M.sx && M.sx.grip; return G ? { ok: G.ok, rl: G.rl || 0, rp: G.rp != null ? +(+G.rp).toFixed(2) : null, w: +(+G.w).toFixed(3) } : null; } catch (e) { return String(e); } },
      FV, DM, J, scene, renderer, camera };
  }
} catch (e) { try { console.warn("__vs hooks failed", e); } catch (_) {} }
// ---- END DEBUG HOOKS ----
