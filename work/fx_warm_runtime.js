// ---- FX WARM ----
// Lag lane 2026-11-09 (owner: "Reyna blind causes lag", "fix all the lag"). The per-agent effect modules (work/*_fx_runtime.js)
// build their materials lazily on the first cast, so the first Leer of a match (the player's, an enemy Reyna's via the bot /
// remote cast path, or a replicated one) linked 7 shader programs on that frame - a 20-200 ms stall each on a real GPU driver -
// and every other agent's first casts did the same (work/test_ability_first_cast_warm.cjs, work/bench_combat.cjs PSITES=1).
// xWarmLazy (the loading gate's precompile + staged upload) now also dry-runs the wired casts of every agent in the match
// (the player, bots, allies, online units) at a point far below the map, so their programs are linked and their textures
// uploaded behind the overlay. A microtask after the caller's compile ends the warm effects. Their materials keep a no-op
// dispose: in three a material dispose releases its program when the use count drops to 0, which would undo the warm-up.
// XFW() holds each module's real entry points (called from the page) with their parameter names - direct references
// behind typeof guards (a module may be absent) -, and xfwArg turns a parameter name into a stand-in value. "@" marks a
// no-argument thunk for the page's own lazy builders (Killjoy's nanoswarm material, Raze's Boom Bot body, Viper's acid pool, Breach's quake blast) and for parts a cast
// builds only later in its life (Miks' Bassquake waves, after its 0.6 s wind-up). Unknown agents / missing modules are skipped; every call is guarded.
const XFW = () => ({
  Reyna: [[typeof reySoul === "function" && reySoul, "p,ttl"], [typeof reyLeerCast === "function" && reyLeerCast, "a,b,travel,windup,active"], [typeof reyEmpressCast === "function" && reyEmpressCast, "p"]],
  Phoenix: [[typeof phxBlaze === "function" && phxBlaze, "o,dir,len,o2"], [typeof phxHotHands === "function" && phxHotHands, "c,R,life,grow"], [typeof phxCurveFlight === "function" && phxCurveFlight, "m"], [typeof phxCurvePop === "function" && phxCurvePop, "p"], [typeof phxRibMarker === "function" && phxRibMarker, "p,ttl"], [typeof phxRibReturn === "function" && phxRibReturn, "p"], [typeof phxRibDeath === "function" && phxRibDeath, "p"]],
  Jett: [[typeof jfxCbProj === "function" && jfxCbProj, ""], [typeof jfxCbPop === "function" && jfxCbPop, "p"], [typeof jfxCbCloud === "function" && jfxCbCloud, "p,r,seconds"]],
  Sova: [[typeof svxShockBurst === "function" && svxShockBurst, "p"], [typeof svxReconPulse === "function" && svxReconPulse, "p,en"], [typeof svxFuryBeam === "function" && svxFuryBeam, "o,d,hitPoint"], [typeof svxOwlLaunch === "function" && svxOwlLaunch, "p,d"], [typeof svxBoltFlight === "function" && svxBoltFlight, "m,kind"], [typeof svxBoltFlight === "function" && svxBoltFlight, "m,kindR"], [typeof svxBoltFlight === "function" && svxBoltFlight, "m,kindD"]],
  Sage: [[typeof sgxBarrierWall === "function" && sgxBarrierWall, "p,yaw,opts"], [typeof sgxSlowOrb === "function" && sgxSlowOrb, "x,y,z"], [typeof sgxSlowField === "function" && sgxSlowField, "p,r,seconds"], [typeof sgxHeal === "function" && sgxHeal, "x,y,z"], [typeof sgxResurrection === "function" && sgxResurrection, "p"]],
  Raze: [[typeof rzxBoomBot === "function" && rzxBoomBot, ""], [typeof rzxBbDeploy === "function" && rzxBbDeploy, "p"], [typeof rzxBbLock === "function" && rzxBbLock, "p"], [typeof rzxBoomBotBlast === "function" && rzxBoomBotBlast, "p,r"], [typeof rzxBlastPack === "function" && rzxBlastPack, "p"], [typeof rzxPackBlast === "function" && rzxPackBlast, "p,r"], [typeof rzxPaintBlast === "function" && rzxPaintBlast, "p,sub"], [typeof rzxShowBlast === "function" && rzxShowBlast, "p,r"], [typeof rsBotMesh === "function" && rsBotMesh, "p"]],
  Killjoy: [[typeof kjxNanoActivate === "function" && kjxNanoActivate, "p,r,secs"], [typeof kjxAlarmbotPlace === "function" && kjxAlarmbotPlace, "p,yaw"], [typeof kjxAlarmbotAlert === "function" && kjxAlarmbotAlert, "p"], [typeof kjxAlarmbotBoom === "function" && kjxAlarmbotBoom, "p"], [typeof kjxTurretDeploy === "function" && kjxTurretDeploy, "p,yaw"], [typeof kjxTurretFire === "function" && kjxTurretFire, "o,d,len"], [typeof nanoMat === "function" && typeof zoneGeo !== "undefined" && (() => new THREE.Mesh(zoneGeo, nanoMat())), "@"]],
  Omen: [[typeof omxParanoiaBolt === "function" && omxParanoiaBolt, "o,d,t"], [typeof omxCoverDome === "function" && omxCoverDome, "p,r,seconds"], [typeof omxStepMark === "function" && omxStepMark, "p"], [typeof omxStepVanish === "function" && omxStepVanish, "p"], [typeof omxStepArrive === "function" && omxStepArrive, "p"], [typeof omxShadowsTP === "function" && omxShadowsTP, "p,opts"]],
  Skye: [[typeof skxTrailblazer === "function" && skxTrailblazer, "x,y,z,yaw"], [typeof skxTrailLeap === "function" && skxTrailLeap, "p"], [typeof skxHawk === "function" && skxHawk, "x,y,z,yaw"], [typeof skxHawkFlash === "function" && skxHawkFlash, "p"], [typeof skxRegrowth === "function" && skxRegrowth, "x,y,z,radius"], [typeof skxSeeker === "function" && skxSeeker, "x,y,z"], [typeof skxSeekerBurst === "function" && skxSeekerBurst, "p"]],
  Chamber: [[typeof chxTrademarkPlace === "function" && chxTrademarkPlace, "p"], [typeof chxSlowField === "function" && chxSlowField, "p,r,secs"], [typeof chxAnchorPlace === "function" && chxAnchorPlace, "p"], [typeof chxRendezvous === "function" && chxRendezvous, "p,opts"]],
  Cypher: [[typeof cyxTrapwire === "function" && cyxTrapwire, "a,b"], [typeof cyxWireTrigger === "function" && cyxWireTrigger, "p,target"], [typeof cyxCage === "function" && cyxCage, "p,r,halfH,secs"]],
  Astra: [[typeof asxGravityWell === "function" && asxGravityWell, "p,r,opts"], [typeof asxNovaPulse === "function" && asxNovaPulse, "p,r,opts"], [typeof asxNebula === "function" && asxNebula, "p,r,life,opts"], [typeof asxCosmicDivide === "function" && asxCosmicDivide, "p,yaw,halfLen,life"]],
  Brimstone: [[typeof brxStimBeacon === "function" && brxStimBeacon, "p,r,life"], [typeof brxIncendiary === "function" && brxIncendiary, "p,r,life"], [typeof brxSkySmoke === "function" && brxSkySmoke, "p,r,life"], [typeof brxOrbitalStrike === "function" && brxOrbitalStrike, "p,r,opts"]],
  Clove: [[typeof cvxMeddleBurst === "function" && cvxMeddleBurst, "p,r"], [typeof cvxRuse === "function" && cvxRuse, "p,r,life"]],
  Deadlock: [[typeof dlxBarrierMesh === "function" && dlxBarrierMesh, "p,yaw,len,seconds"], [typeof dlxMeshDisc === "function" && dlxMeshDisc, "p"], [typeof dlxSonicSensor === "function" && dlxSonicSensor, "p,seconds"], [typeof dlxSensorBlast === "function" && dlxSensorBlast, "p"], [typeof dlxGravNet === "function" && dlxGravNet, "p,r,seconds"], [typeof dlxAnnihilation === "function" && dlxAnnihilation, "o,d,dist"], [typeof dlxAnniCocoon === "function" && dlxAnniCocoon, "p,seconds"]],
  Fade: [[typeof fdxProwler === "function" && fdxProwler, "x,y,z,yaw"], [typeof fdxProwlerBurst === "function" && fdxProwlerBurst, "p"], [typeof fdxSeizeOrb === "function" && fdxSeizeOrb, "x,y,z"], [typeof fdxSeizePool === "function" && fdxSeizePool, "p,r,seconds"], [typeof fdxHauntOrb === "function" && fdxHauntOrb, "x,y,z"], [typeof fdxHauntBurst === "function" && fdxHauntBurst, "p"], [typeof fdxNightfall === "function" && fdxNightfall, "p,yaw,dist,w,seconds"]],
  Gekko: [[typeof gkxMoshPool === "function" && gkxMoshPool, "p,r,seconds"], [typeof gkxWingman === "function" && gkxWingman, "x,y,z,yaw"], [typeof gkxWingmanBoom === "function" && gkxWingmanBoom, "p"], [typeof gkxDizzy === "function" && gkxDizzy, "x,y,z,yaw"], [typeof gkxThrash === "function" && gkxThrash, "x,y,z,yaw"], [typeof gkxThrashBoom === "function" && gkxThrashBoom, "p,r"]],
  Harbor: [[typeof hbxHighTide === "function" && hbxHighTide, "p0,yaw0,opts"], [typeof hbxCove === "function" && hbxCove, "p,r,life"], [typeof hbxReckoning === "function" && hbxReckoning, "p,yaw,dist,opts"]],
  Hush: [[typeof hushxFlow === "function" && hushxFlow, "p,opts"], [typeof hushxFlashbulb === "function" && hushxFlashbulb, "o,p,opts"], [typeof hushxDisplacement === "function" && hushxDisplacement, "o,p,opts"], [typeof hushxSuspension === "function" && hushxSuspension, "o,d,opts"]],
  Iso: [[typeof isoxContingency === "function" && isoxContingency, "o,d,opts"], [typeof isoxUndercut === "function" && isoxUndercut, "o,p,opts"]],
  Miks: [[typeof mkxMPulse === "function" && mkxMPulse, "p,r,seconds,opts"], [typeof mkxHarmonize === "function" && mkxHarmonize, "selfP,allyP,seconds,opts"], [typeof mkxWaveformSmoke === "function" && mkxWaveformSmoke, "p,r,seconds"], [typeof mkxBassquake === "function" && mkxBassquake, "o,d,dist"], [typeof mkxMat === "function" && typeof mkxWAVE !== "undefined" && (() => new THREE.Mesh(mkxGeos().torus, mkxMat("wave", mkxWAVE, 0))), "@"]],
  Neon: [[typeof neoxFastLane === "function" && neoxFastLane, "o,yaw,seconds"], [typeof neoxRelayBolt === "function" && neoxRelayBolt, "o,p,opts"]],
  Veto: [[typeof vtxCrosscut === "function" && vtxCrosscut, "p"], [typeof vtxCrosscutTP === "function" && vtxCrosscutTP, "a,b,opts"], [typeof vtxChokehold === "function" && vtxChokehold, "p,seconds"], [typeof vtxChokeSnare === "function" && vtxChokeSnare, "p,seconds"], [typeof vtxInterceptor === "function" && vtxInterceptor, "p,r,seconds"], [typeof vtxEvolution === "function" && vtxEvolution, "p,seconds,opts"]],
  Vyse: [[typeof vyxRazorvine === "function" && vyxRazorvine, "p,r,seconds"], [typeof vyxShear === "function" && vyxShear, "p,yaw,len,seconds"], [typeof vyxArcRose === "function" && vyxArcRose, "p,seconds"], [typeof vyxArcRoseFlash === "function" && vyxArcRoseFlash, "p"], [typeof vyxSteelGarden === "function" && vyxSteelGarden, "p,r,seconds"]],
  Waylay: [[typeof wayxSaturate === "function" && wayxSaturate, "o,p,opts"], [typeof wayxConvergentPaths === "function" && wayxConvergentPaths, "o,yaw,opts"]],
  Viper: [[typeof a18AcidPool === "function" && (() => xfwA18(a18AcidPool(XFW_AT.x, XFW_AT.y, XFW_AT.z, 3, 1, false))), "@"]],
  Breach: [[typeof a18QuakeBlast === "function" && (() => xfwA18(a18QuakeBlast(XFW_AT.x, XFW_AT.y, XFW_AT.z, 0, 3, 4))), "@"]],
  Yoru: [[typeof yoxFakeoutSpawn === "function" && yoxFakeoutSpawn, "p"], [typeof yoxFakeoutFigure === "function" && yoxFakeoutFigure, ""], [typeof yoxFakeoutPop === "function" && yoxFakeoutPop, "p"], [typeof yoxBlindsideOrb === "function" && yoxBlindsideOrb, ""], [typeof yoxBlindsidePop === "function" && yoxBlindsidePop, "p"], [typeof yoxGatecrashAnchor === "function" && yoxGatecrashAnchor, "p,seconds"], [typeof yoxDriftEnter === "function" && yoxDriftEnter, "p"], [typeof yoxDriftExit === "function" && yoxDriftExit, "p"], [typeof yoxGatecrashTP === "function" && yoxGatecrashTP, "p"]],
});
const XFW_AT = { x: 0, y: -400, z: 0 }; // far below every map: the warm casts are never in view
// each warmed module is reset after the compile: a warm cast without a handle end() (Cypher's wire trigger, ...) would
// otherwise keep ticking into the match and draw the match's seeded Math.random (bot decisions changed). The warm step runs
// at map load / the loading gate / the first frame of a match, before any cast of that match; round resets call the same.
// Sova has no reset: the entries the warm casts added to svxC.anim are dropped.
const XFWR = () => ({ Reyna: typeof reyReset === "function" && reyReset, Phoenix: typeof phxReset === "function" && phxReset, Jett: typeof jfxReset === "function" && jfxReset, Sage: typeof sgxReset === "function" && sgxReset, Raze: typeof rzxReset === "function" && rzxReset, Killjoy: typeof kjxReset === "function" && kjxReset, Omen: typeof omxReset === "function" && omxReset, Skye: typeof skxReset === "function" && skxReset, Chamber: typeof chxReset === "function" && chxReset, Cypher: typeof cyxReset === "function" && cyxReset, Astra: typeof asxReset === "function" && asxReset, Brimstone: typeof brxReset === "function" && brxReset, Clove: typeof cvxReset === "function" && cvxReset, Deadlock: typeof dlxReset === "function" && dlxReset, Fade: typeof fdxReset === "function" && fdxReset, Gekko: typeof gkxReset === "function" && gkxReset, Harbor: typeof hbxReset === "function" && hbxReset, Hush: typeof hushxReset === "function" && hushxReset, Iso: typeof isoxReset === "function" && isoxReset, Miks: typeof mkxReset === "function" && mkxReset, Neon: typeof neoxReset === "function" && neoxReset, Veto: typeof vtxReset === "function" && vtxReset, Vyse: typeof vyxReset === "function" && vyxReset, Waylay: typeof wayxReset === "function" && wayxReset, Yoru: typeof yoxReset === "function" && yoxReset });
function xfwArg(n, extra) {
  const V = (dx, dz) => new THREE.Vector3(XFW_AT.x + (dx || 0), XFW_AT.y, XFW_AT.z + (dz || 0));
  switch (n) {
    case "p": case "p0": case "a": case "c": case "o": case "selfP": return V();
    case "b": case "allyP": case "hitPoint": return V(0, 4);
    case "d": case "dir": return new THREE.Vector3(1, 0, 0);
    case "x": return XFW_AT.x; case "y": return XFW_AT.y; case "z": return XFW_AT.z;
    case "yaw": case "yaw0": case "sub": case "en": return 0;
    case "kind": return "shock"; case "kindR": return "recon"; case "kindD": return "dart";
    case "opts": case "o2": return {};
    case "m": case "target": { const g = new THREE.Mesh(new THREE.SphereGeometry(0.1, 4, 3), new THREE.MeshBasicMaterial()); g.position.copy(V()); g.frustumCulled = false; scene.add(g); extra.push(g); return g; }
    case "r": case "R": case "radius": case "halfLen": case "halfH": case "len": case "dist": case "w": return 3;
    default: return 1; // seconds / secs / life / ttl / dur / travel / windup / active / t / grow
  }
}
// an agents-18 lane entry (J.a18fx) made by a warm cast: its end() takes it out of the lane at once (never ticked) and
// removes its meshes; the acid pool through its own free
function xfwA18(E) { return { end() { try { const F = J.a18fx, i = F ? F.indexOf(E) : -1; if (i >= 0) F.splice(i, 1);
  if (E.kind === "acidfx" && typeof a18AcidFree === "function") { if (!E.dead) a18AcidFree(E); } else for (const it of E.items || []) scene.remove(it.m); } catch (e) {} } }; }
function xfwAgents() { const s = new Set(); try { if (J && J.pick) s.add(J.pick); } catch (e) {}
  try { for (const L of [bots, allies]) for (let i = 0; i < L.length; i++) { const a = L[i] && (L[i].agent || (typeof xAg === "function" && xAg(L[i]))); if (a) s.add(a); } } catch (e) {}
  try { if (typeof duelBot !== "undefined" && duelBot && duelBot.agent) s.add(duelBot.agent); } catch (e) {} return s; }
// reveal outlines (Sova Recon / Fade / Cypher / KAY/O ...: xRevealUnit) on native rigs are SkinnedMesh overlays sharing each
// skin's geometry and skeleton - a skinned program variant the box prewarm in xWarmLazy does not link (the first reveal of
// an enemy linked it mid-match). The same overlays, for both reveal materials, on every visible native skin of the
// match's units, removed again after the compile.
function xfwReveal() { const out = []; if (typeof xRevealSources !== "function") return out; const mats = [];
  if (typeof rvMat !== "undefined" && rvMat) mats.push(rvMat); if (typeof svxRvMat !== "undefined" && svxRvMat) mats.push(svxRvMat);
  try { for (const L of [bots, allies]) for (const b of L) { if (!b) continue; for (const o of xRevealSources(b)) for (const mat of mats) {
    const m = new THREE.SkinnedMesh(o.geometry, mat); m.name = "reveal-native"; m.bindMode = "detached"; m.bind(o.skeleton, o.bindMatrix); m.frustumCulled = false; m.raycast = () => {}; o.parent.add(m); out.push(m); } } } catch (e) {}
  return out; }
function xfwMats(set) { const s = set || new Set(); scene.traverse((o) => { if (o.material) for (const m of [].concat(o.material)) if (m) s.add(m); }); return s; }
// warm: xWarmLazy's list (the caller adds / compiles / removes it); returns the number of casts made. Runs inside xNoRng (the
// effects' own Math.random draws must not move the match's seeded stream: bot decisions stay identical).
function xFxWarm(warm) { let n = 0; const before = new Set(scene.children), mats0 = xfwMats(), hs = [], extra = [], ags = xfwAgents();
  const sv0 = typeof svxC !== "undefined" && svxC.anim ? svxC.anim.length : -1;
  const T = XFW(); for (const ag of ags) for (const [fn, sig] of T[ag] || []) { if (!fn) continue;
    try { const args = sig === "@" ? [] : sig.split(",").filter(Boolean).map((a) => xfwArg(a, extra)); const h = fn.apply(null, args); n++;
      if (h && h.isObject3D) { if (!h.parent) { h.position.copy(xfwArg("p")); scene.add(h); } } else if (h && typeof h === "object") hs.push(h); } catch (e) {} }
  for (const c of scene.children) if (!before.has(c)) { c.visible = true; warm.push(c); }
  const rv = xfwReveal(); if (!n && !rv.length) return 0;
  const keep = () => {}; for (const m of xfwMats()) if (!mats0.has(m)) m.dispose = keep; // the warm effects' programs stay linked after their end()
  (typeof queueMicrotask === "function" ? queueMicrotask : (f) => Promise.resolve().then(f))(() => xNoRng(() => { // an end() may build a fade-out (new uuids draw Math.random)
    for (const h of hs) { try { if (typeof h.end === "function") h.end(); } catch (e) {} }
    const R = XFWR(); for (const ag of ags) { try { if (R[ag]) R[ag](); } catch (e) {} }
    if (sv0 >= 0 && svxC.anim.length > sv0) { for (const e of svxC.anim.splice(sv0)) { try { svxDrop(e.m); } catch (er) {} } }
    for (const g of extra) { try { scene.remove(g); g.geometry.dispose(); } catch (e) {} }
    for (const m of rv) { try { if (m.parent) m.parent.remove(m); } catch (e) {} } }));
  return n; }
{ const w0 = xWarmLazy; xWarmLazy = function () { const warm = w0.apply(this, arguments); try { xNoRng(() => xFxWarm(warm)); } catch (e) {} return warm; }; }
// ---- END FX WARM ----
