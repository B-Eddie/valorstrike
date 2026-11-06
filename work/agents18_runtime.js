// ---- AGENTS 18 ----
// Offline client behavior for the 18 agents added 2026-11-03 (Astra, Brimstone, Clove, Harbor, Miks, Viper, Hush,
// Iso, Neon, Waylay, Yoru, Fade, Gekko, KAY/O, Tejo, Deadlock, Veto, Vyse). Mirrors server/src/agents18.js (same
// wiki.playvalorant.com constants, fetched 2026-11-03); known deviations are listed in work/agents18-notes.md.
const A18SET = new Set(["Astra", "Brimstone", "Clove", "Harbor", "Miks", "Viper", "Hush", "Iso", "Neon", "Waylay", "Yoru", "Fade", "Gekko", "KAY/O", "Tejo", "Deadlock", "Veto", "Vyse"]);
const A18C = { star: { wellPull: 2, wellVuln: 2, wellR: 3.5, novaDelay: 1.25, novaConcuss: 4, novaR: 4.5, nebulaLife: 14.25, nebulaR: 4.1, divideLife: 21, placeR: 2.5, selectR: 6, dissipateDelay: 1.25, fakeNebula: 0.75 },
 stim: { life: 12.5, r: 4 }, incend: { life: 7, r: 4.5, rate: 60 }, skysmoke: { life: 19.25, r: 4.15 }, orbital: { delay: 2, life: 4, r: 5, dps: 150 },
 pmu: { haste: 4, overheal: 50, window: 12 }, meddle: { r: 4, decay: 90, wind: 0.75 }, ruse: { life: 12.75, r: 4.15 }, ndy: { channel: 3.3, window: 12 },
 surge: { r: 6, near: 2, slow: 2, wind: 0.6 }, tide: { dist: 45, life: 12, slow: 2, w: 2, speed: 6 }, cove: { life: 12, r: 4.1 }, reckon: { dist: 30, near: 3, slow: 4, speed: 7 },
 mpulse: { life: 6, r: 6, concuss: 2.5, heal: 40 }, harmon: { life: 8 }, waveform: { life: 14, r: 4.15 }, bassq: { dist: 40, w: 46, slow: 8, knock: 5, deafen: 8 }, /* wiki: 40 m 60 deg cone, 5 m knock, 8 s deafen + slow */
 snake: { life: 6.5, r: 4, rate: 20 }, fuel: { max: 100, drain: 8, regen: 20 }, pcloud: { r: 4.15 }, tscreen: { len: 30 }, pit: { r: 9, decay: 30 },
 flow: { delay: 1.1, speed: 22 }, flashb: { blind: 1.6, delay: 1 }, displ: { r: 5, pull: 6, delay: 1 }, susp: { speed: 12, life: 4, lev: 3, r: 4 },
 conting: { dist: 30, speed: 6, w: 8, life: 8 }, undercut: { r: 5, supp: 4, vuln: 4 }, dtap: { life: 20 }, kc: { range: 40, w: 4, duel: 13, supp: 4 },
 fastlane: { dist: 30, life: 6 }, relay: { r: 4.5, concuss: 3.5 }, gear: { drain: 10, regen: 20 }, od: { life: 10, dps: 150 },
 satur: { r: 4.5, hinder: 4 }, ls: { dash: 9, time: 0.35 }, refract: { life: 20, travel: 0.6 }, cpaths: { len: 36, w: 13.5, ahead: 3, wind: 1, haste: 7, hinder: 6 },
 fakeout: { life: 10, speed: 4.5 }, blindside: { blind: 1.5, delay: 0.6 }, gcrash: { life: 20, range: 30 }, drift: { life: 10 },
 prowler: { life: 3, speed: 9, near: 2.5 }, seize: { r: 4.5, tether: 4, decay: 70 }, haunt: { r: 25, reveal: 12 }, nightfall: { dist: 25, w: 14, decay: 70 },
 mosh: { r: 5, life: 3, dps: 20, boom: 70 }, wing: { life: 5, speed: 9, concuss: 3.5 }, dizzy: { life: 2.5, blind: 1.5, r: 15 }, thrash: { r: 6, detain: 6 }, globule: { reclaim: 10 },
 frag: { r: 4, inner: 1, pulses: 4, gap: 1, dmg: 60, dmgOut: 25, wind: 0.5 }, fdrive: { blind: 2.25, delay: 1.6 }, zero: { r: 15, supp: 8 }, nullcmd: { life: 10, pulse: 3, r: 20 },
 sdrone: { life: 8, r: 12, reveal: 3, supp: 6 }, sd: { r: 4, concuss: 3, dmg: 40 }, salvo: { r: 4.5, inner: 2.5, pulses: 3, gap: 0.8, dmg: 65, dmgOut: 50, wind: 1.25, fly: 30 }, armag: { len: 32, w: 12, dmg: 60, segs: 16, seg: 2, ticks: 4, tick: 0.25, gap: 0.25, wind: 3.08 },
 mesh: { life: 30, len: 7.5 }, sensor: { life: 30, r: 8, concuss: 3 }, gnet: { r: 6, life: 8 }, annih: { range: 20, detain: 7 },
 xcut: { range: 25 }, choke: { life: 30, r: 6, decay: 60, slow: 2 }, cept: { life: 30, r: 10 }, evo: { life: 12, hps: 10 },
 vine: { life: 30, r: 6, dps: 15 }, shear: { life: 30, r: 2.5, wall: 8 }, rose: { life: 30, blind: 2, r: 20 }, garden: { r: 20, jam: 8 } };
J.a18 = null; // per-agent state (stars, fuel, anchors, slides), reset by a18Reset on the pick / round reset hooks
function a18Reset() { J.medClock=0;for(const u of [player].concat(bots,typeof allies!=="undefined"?allies:[]))if(u)u.medDecay=null; const a = J.pick; J.a18 = { starList: [], starBack: 0, stars: a === "Astra" ? 2 : 0, fuel: a === "Viper" || a === "Neon" ? A18C.fuel.max : 0, slides: 1, slideK: 0, /* wiki v9.11: one slide charge */ cloud: 0, screen: 0, pit: 0, gate: 0, gateTp: 0, mark: 0, rose: 0, xcut: 0, gear: 0, drift: 0, od: 0, evo: 0, shield: 0, duel: 0, ndyT: 0, haste: 0, stim: 0, decay: 0, decayAmt: 0, jam: 0, supp: 0 }; }
function a18Aim(dist) { const o = pEye(), d = jAim(); ray.set(o, d); ray.far = dist || 14; const h = ray.intersectObjects(solids)[0]; const t = h ? Math.max(0, h.distance - 0.5) : (dist || 14); const p = o.clone().addScaledVector(d, t); p.y = Math.max(0.05, p.y); return p; }
function a18Smoke(p, dur, r, c1, c2) { const m = jM(smokeGeo, xSmokeM("a18" + (a18Smoke.n = (a18Smoke.n || 0) + 1), c1, c2)); m.position.set(p.x, p.y + 1.7, p.z); scene.add(m); J.smokes.push({ m, p: m.position, t: dur, r: xSmk(m, r) }); SFX.smoke(); return m; }
function a18Zone(p, life, r, rate, name, col) { const m = jM(zoneGeo, fireMat(col || 0xff5a1a, 0.55)); m.rotation.x = -Math.PI / 2; m.position.set(p.x, 0.05, p.z); m.scale.setScalar(r / 2.5); scene.add(m); J.zones.push({ m, p: p.clone(), t: life, R: 0, r0: r, rate, name }); return m; }
function a18Fx(o) { (J.a18fx = J.a18fx || []).push(o); return o; }
function a18Deafen(sec) { try { if (typeof ac === "undefined" || !ac || typeof master === "undefined" || !master) return; const t = ac.currentTime; master.gain.cancelScheduledValues(t); master.gain.setValueAtTime(0.0001, t); master.gain.setValueAtTime(S.muted ? 0 : S.vol / 100, t + sec); } catch (e) {} }/* Bassquake deafen: the mix ducks for the duration (wiki: deafened) */
function a18Orb(p, delay, fn, hide) { const m = jM(orbGeo, xAdd("a18orb" + (a18Fx.n = (a18Fx.n || 0) + 1), 0xfff6e8, 1)); m.position.copy(p); scene.add(m); if (hide) m.visible = false; a18Fx({ m, t: delay, pop: fn }); }
function a18BotsIn(p, r, dy) { const out = []; for (const b of bots) if (b.alive && Math.hypot(b.g.position.x - p.x, b.g.position.z - p.z) < r && Math.abs(b.g.position.y - p.y) < (dy || 4)) out.push(b); return out; }
function a18StripBots(p, d, dist, w) { const out = []; for (const b of bots) if (b.alive) { const q = [b.g.position.x - p.x, b.g.position.z - p.z], f = q[0] * d.x + q[1] * d.z, s = q[0] * -d.z + q[1] * d.x; if (f > 0 && f < dist && Math.abs(s) < w / 2) out.push(b); } return out; }
function a18Blind(p, bl) { xFlashBots(p, bl); const e = pEyeTo(PE_V), v = p.clone().sub(e), l = v.length() || 0.01; if (player.hp > 0 && l < 30 && v.dot(jAim()) / l > 0.5 && los(e, p)) xFlashPlayer(p, bl); }
function a18Ring(p, r, col, op) { const m = new THREE.Mesh(ringGeo, fireMat(col || 0xff9a3a, op == null ? 0.9 : op)); m.rotation.x = -Math.PI / 2; m.position.set(p.x, 0.06, p.z); m.scale.setScalar(r); scene.add(m); return m; }
// Tactical-map targeting for Astra (Astral Form) and Tejo (Guided Salvo / Armageddon). The real kits place
// stars, salvos and the Armageddon origin from an overhead tactical view (wiki.playvalorant.com Astra "placed
// through the Astral Form map", Tejo "select target locations on a tactical map", fetched 2026-11-03), so these
// casts open the shared xTac overlay (work/ability_target_runtime.js) instead of throwing from the hand.
// Online the picked points ride the cast message as m.p (server human-only branches); offline they cast locally.
const A18TAC = { mode: null, arm: "e", wall: null, pts: null };
function a18TacSend(k, p) { if (NET.socket && MP.st === "game" && (MP.m5 || NET.tab)) { const m = { t: "ab", k }; if (p) m.p = p; netSend(m); } else a18TacLocal(k, p); }
function a18TacLocal(k, p) { // offline mirror of the server's m.p casts
  const A = J.a18, C = A18C;
  if (J.pick === "Astra") {
    if (k === "x") { const x1 = p[0], z1 = p[1], x2 = p[2], z2 = p[3], cx = (x1 + x2) / 2, cz = (z1 + z2) / 2, half = Math.max(4, Math.hypot(x2 - x1, z2 - z1) / 2); J.ult = 0; const m = a18Ring(new THREE.Vector3(cx, 0, cz), Math.min(half, 60), 0x9a6ff0, 0.5); a18Fx({ kind: "div", m, t: C.star.divideLife }); SFX.ab("updraft"); say("Cosmic Divide", 900); return; }
    if (k === "s") { // place a persistent Star, or dissipate one that is clicked (wiki Stars / Nebula-Dissipate)
      const s0 = a18StarNear(p[0], p[1], C.star.placeR);
      if (s0) { a18StarDrop(s0); a18Smoke(new THREE.Vector3(s0.x, 0, s0.z), C.star.fakeNebula, C.star.nebulaR, 0x7a4fd0, 0xc9a8f2); A.starBack = performance.now() / 1000 + C.star.dissipateDelay; SFX.ab("updraft"); say("Dissipate", 700); return; }
      if (A.stars < 1) { blip(120, 0.08, "square", 0.1); return; }
      A.stars--; const gy = (() => { try { const g = groundAt(p[0], p[1], 0.3, typeof player !== "undefined" ? player.y : 3); return Number.isFinite(g) ? g : 0; } catch (e) { return 0; } })(); /* the marker and its activations sit on the real ground, not y=0 */
      const m = new THREE.Mesh(new THREE.OctahedronGeometry(0.35), new THREE.MeshLambertMaterial({ color: 0xb9a7ff, emissive: 0xb9a7ff, emissiveIntensity: 0.5 })); m.position.set(p[0], gy + 1.4, p[1]); scene.add(m);
      const fx0 = { kind: "star", m, t: 400 }; a18Fx(fx0); A.starList.push({ x: p[0], y: gy, z: p[1], fx: fx0 }); SFX.ab("updraft"); say("Star placed", 700); return; }
    const s0 = a18StarNear(p[0], p[1], C.star.selectR); // c/q/e activate the placed star nearest the click
    if (!s0) { blip(120, 0.08, "square", 0.1); say("No Star there", 700); return; }
    a18StarDrop(s0); const q = new THREE.Vector3(s0.x, s0.y || 0, s0.z);
    if (k === "c") { const rm = a18Ring(q, C.star.wellR, 0x8a6af0, 0.6); try { jxBind(rm, asxGravityWell({ x: q.x, y: q.y, z: q.z }, C.star.wellR, { delay: 0.75, life: C.star.wellPull }), 1); } catch (e) {} a18Fx({ kind: "gwell", p: q, t: 0.75, life: C.star.wellPull, m: rm }); }
    else if (k === "q") { const rm = a18Ring(q, C.star.novaR, 0xb08af0, 0.6); try { jxBind(rm, asxNovaPulse({ x: q.x, y: q.y, z: q.z }, C.star.novaR, { delay: C.star.novaDelay }), 1); } catch (e) {} a18Fx({ kind: "nova", p: q, t: C.star.novaDelay, m: rm }); }
    else { a18Smoke(q, C.star.nebulaLife, C.star.nebulaR, 0x7a4fd0, 0xc9a8f2); try { asxNebula({ x: q.x, y: q.y, z: q.z }, C.star.nebulaR, C.star.nebulaLife); } catch (e) {} }
    SFX.ab("updraft"); return; }
  if (k === "e") { J.e--; for (let i = 0; i + 1 < p.length && i < 4; i += 2) a18Salvo(new THREE.Vector3(p[i], 0, p[i + 1])); SFX.ab("cbPop", player); return; }
  const q = new THREE.Vector3(p[0], 0, p[1]), dd = new THREE.Vector3(p[0] - player.x, 0, p[1] - player.z); J.ult = 0; if (dd.lengthSq() < 1e-6) dd.set(-Math.sin(yaw || 0), 0, -Math.cos(yaw || 0)); a18Fx({ kind: "armag", p: q, d: dd.normalize(), t: C.armag.wind });
}
function a18StarNear(x, z, r) { let best = null, bd = r; const L = J.a18 && J.a18.starList || []; for (const s of L) { const d = Math.hypot(s.x - x, s.z - z); if (d < bd) { bd = d; best = s; } } return best; }
function a18StarDrop(s0) { const L = J.a18.starList; const i = L.indexOf(s0); if (i >= 0) L.splice(i, 1); if (s0.fx) s0.fx.gone = true; }
function a18StarPts() { const out = []; for (const [, r] of a18Net) if (r.kind === "star" && r.m) out.push([r.m.position.x, r.m.position.z]); if (J.a18 && J.a18.starList) for (const s of J.a18.starList) out.push([s.x, s.z]); return out; }
function a18Tac(k) { // true = key consumed; "no" = resources short; false = not applicable (legacy maps fall through)
  const C = A18C, on = typeof XTAC !== "undefined" && XTAC.on;
  if (J.pick === "Astra") {
    if (on && A18TAC.mode === "astra") {
      if (k === "c" || k === "q" || k === "e") { A18TAC.arm = A18TAC.arm === k ? null : k; A18TAC.wall = null; say(A18TAC.arm ? { c: "Gravity Well", q: "Nova Pulse", e: "Nebula" }[A18TAC.arm] + " armed · click a placed Star" : "Click places a Star · click a Star to dissipate", 900); return true; }
      if (k === "x") { A18TAC.wall = []; A18TAC.arm = null; say("Cosmic Divide · click both ends", 900); return true; }
      return true; } // swallow other keys while the map is up
    if (k !== "x") return false;
    if (J.ult < K().u) return "no";
    A18TAC.mode = "astra"; A18TAC.wall = null; A18TAC.arm = null;
    if (!xTacOpen({ name: "Astral Form", color: "#b9a7ff", range: 0, key: "X", valid: (x, z) => ({ x, y: 0, z }), marks: () => a18StarPts(),
      confirm: (x, z) => { if (A18TAC.wall) { A18TAC.wall.push(x, z); if (A18TAC.wall.length < 4) { say("Click the wall's other end", 900); return false; } const pts = A18TAC.wall.slice(); A18TAC.mode = null; A18TAC.wall = null; a18TacSend("x", pts); return true; }
        if (A18TAC.arm) { const pts = a18StarPts(); let near = false; for (const q of pts) if (Math.hypot(q[0] - x, q[1] - z) < A18C.star.selectR) { near = true; break; }
          if (!near) { say("No Star there · click a placed Star", 900); return false; }
          const arm = A18TAC.arm; A18TAC.arm = null; a18TacSend(arm, [x, z]); say({ c: "Gravity Well", q: "Nova Pulse", e: "Nebula" }[arm], 700); return false; }
        a18TacSend("s", [x, z]); return false; },
      cancel: () => { if (A18TAC.mode) { A18TAC.mode = null; A18TAC.wall = null; A18TAC.arm = null; if (NET.socket && MP.st === "game" && (MP.m5 || NET.tab)) netSend({ t: "ab", k: "x" }); } } })) { A18TAC.mode = null; return false; }
    if (NET.socket && MP.st === "game" && (MP.m5 || NET.tab)) netSend({ t: "ab", k: "x" }); // the server gates map-placed stars on its own Astral Form state
    return true; }
  if (J.pick === "Tejo") {
    if (on && A18TAC.mode === "salvo") { if (k === "e" && A18TAC.pts && A18TAC.pts.length) { const pts = A18TAC.pts.slice(); xTacCancel(false); a18TacSend("e", pts); } return true; }
    if (on && A18TAC.mode === "armag") return true;
    if (k === "e") { if (!(J.e > 0)) return "no";
      A18TAC.mode = "salvo"; A18TAC.pts = [];
      if (!xTacOpen({ name: "Guided Salvo", color: "#ff8a5a", range: 0, key: "E", valid: (x, z) => ({ x, y: 0, z }),
        confirm: (x, z) => { A18TAC.pts.push(x, z); if (A18TAC.pts.length < 4) { say("Click a second target · press E to launch one", 900); return false; } const pts = A18TAC.pts.slice(); A18TAC.mode = null; A18TAC.pts = null; a18TacSend("e", pts); return true; },
        cancel: () => { A18TAC.mode = null; A18TAC.pts = null; } })) { A18TAC.mode = null; return false; }
      return true; }
    if (k === "x") { if (J.ult < K().u) return "no";
      A18TAC.mode = "armag";
      if (!xTacOpen({ name: "Armageddon", color: "#ff5a2a", range: 0, key: "X", valid: (x, z) => ({ x, y: 0, z }),
        confirm: (x, z) => { A18TAC.mode = null; a18TacSend("x", [x, z]); return true; },
        cancel: () => { A18TAC.mode = null; } })) { A18TAC.mode = null; return false; }
      return true; }
    return false; }
  return false; }
function a18Key(code) {
  const k = code === "KeyC" ? "c" : code === "KeyQ" ? "q" : code === "KeyE" ? "e" : "x", A = J.a18, C = A18C, a = J.pick, P = player;
  const no = () => (blip(120, 0.08, "square", 0.1), true);
  if (k === "x" && a === "Clove" && P.hp <= 0 && A.ndyT > 0) { // Not Dead Yet (wiki): self-revive channel from death
    if (J.ult < K().u) return no(); J.ult = 0; A.ndyT = 0; A.ndy = C.ndy.channel; say("Not Dead Yet", 900); SFX.ab("rewind"); return true; }
  if (P.hp <= 0) return true;
  if (A.supp > 0) return no();
  if (a === "Astra" || a === "Tejo") { const r = a18Tac(k); if (r === true) return true; if (r === "no") return no(); }
  const chargeOk = k === "x" ? J.ult >= K().u : (a === "Astra" ? true : J[k] > 0); // Astra: the placed-star check inside the case is the gate, not the pool
  if (a === "Viper" && (k === "q" && A.cloud || k === "e" && A.screen || k === "x" && A.pit)) { J.cd[k] = 0.6; if (k === "q") A.cloudOn = !A.cloudOn; else if (k === "e") A.toxOn = !A.toxOn; else { A.pit = 0; if (A.pitM) { jRel(A.pitM); A.pitM = 0; } } return true; }
  if (a === "Vyse" && k === "e" && A.rose) { const p = A.rose; A.rose = 0; try { vyxArcRoseFlash({ x: p.x, y: p.y || 0, z: p.z }); if (A.roseH) A.roseH.end(); A.roseH = null; } catch (er) {} a18Blind(p, C.rose.blind); SFX.flash(); return true; }
  if (a === "Veto" && k === "c" && A.xcut) { try { vtxCrosscutTP({ x: P.x, y: P.y || 0, z: P.z }, { x: A.xcut.x, y: A.xcut.y || 0, z: A.xcut.z }, { caster: true }); if (A.xcutH) A.xcutH.end(); A.xcutH = null; } catch (er) {} P.x = A.xcut.x; P.z = A.xcut.z; P.y = A.xcut.y; A.xcut = 0; SFX.ab("dash"); return true; }
  if (a === "Waylay" && k === "e" && A.mark) { P.x = A.mark.x; P.y = A.mark.y; P.z = A.mark.z; A.mark = 0; J.e = 0; SFX.ab("dash"); return true; }
  if (a === "Yoru" && k === "e" && A.gate && !(A.gateTp > 0)) { A.gateTp = 1.2; say("Gatecrash", 700); return true; } /* wiki: 1.2 s total (0.5 s windup + 0.7 s arrival); the move lands in a18Tick */
  if (a === "Neon" && k === "e" && A.gear > 0) { if (A.slides > 0) { A.slides--; A.gear = 0; J.dash = jDash(); SFX.ab("dash"); /* the slide ends High Gear (wiki); firing during it is allowed (v8.11) */ } return true; }
  if (!chargeOk || J.cd[k] > 0) return no();
  const p = a18Aim(14), d = jAim();
  const spend = () => { if (k === "x") J.ult = 0; else if (a === "Astra") A.stars--; else J[k]--; J.cd[k] = 0.6; };
  switch (a) {
    case "Astra": {
      if (k === "x") { spend(); const m = a18Ring(new THREE.Vector3(P.x, 0, P.z), 30, 0x9a6ff0, 0.5); try { jxBind(m, asxCosmicDivide({ x: P.x, y: P.y || 0, z: P.z }, Math.atan2(-d.x, -d.z), 30, C.star.divideLife), 1); } catch (e) {} a18Fx({ kind: "div", m, t: C.star.divideLife }); SFX.ab("updraft"); return true; }
      const s0 = a18StarNear(p.x, p.z, 1e9); // c/q/e activate the placed Star nearest the crosshair (wiki Stars)
      if (!s0) return no();
      a18StarDrop(s0); const q = new THREE.Vector3(s0.x, s0.y || 0, s0.z);
      if (k === "c") { const rm = a18Ring(q, C.star.wellR, 0x8a6af0, 0.6); try { jxBind(rm, asxGravityWell({ x: q.x, y: q.y, z: q.z }, C.star.wellR, { delay: 0.75, life: C.star.wellPull }), 1); } catch (e) {} a18Fx({ kind: "gwell", p: q, t: 0.75, life: C.star.wellPull, m: rm }); }
      else if (k === "q") { const rm = a18Ring(q, C.star.novaR, 0xb08af0, 0.6); try { jxBind(rm, asxNovaPulse({ x: q.x, y: q.y, z: q.z }, C.star.novaR, { delay: C.star.novaDelay }), 1); } catch (e) {} a18Fx({ kind: "nova", p: q, t: C.star.novaDelay, m: rm }); }
      else { a18Smoke(q, C.star.nebulaLife, C.star.nebulaR, 0x7a4fd0, 0xc9a8f2); try { asxNebula({ x: q.x, y: q.y, z: q.z }, C.star.nebulaR, C.star.nebulaLife); } catch (e) {} }
      SFX.ab("updraft"); return true; }
    case "Brimstone": { spend();
      if (k === "c") { const m = a18Ring(p, C.stim.r, 0xffc04a, 0.5); try { jxBind(m, brxStimBeacon({ x: p.x, y: p.y || 0, z: p.z }, C.stim.r, C.stim.life), 1); } catch (e) {} a18Fx({ kind: "stimz", m, p, t: C.stim.life }); }
      else if (k === "q") { const zm = a18Zone(p, C.incend.life, C.incend.r, C.incend.rate, "Incendiary"); try { jxBind(zm, brxIncendiary({ x: p.x, y: p.y || 0, z: p.z }, C.incend.r, C.incend.life), 1); } catch (e) {} }
      else if (k === "e") { a18Smoke(p, C.skysmoke.life, C.skysmoke.r, 0x8a929a, 0xd0c8b8); try { brxSkySmoke({ x: p.x, y: (p.y || 0) + 1.7, z: p.z }, C.skysmoke.r, C.skysmoke.life); } catch (e) {} }
      else { const m = a18Ring(p, C.orbital.r, 0xff7a2a, 0.8); try { jxBind(m, brxOrbitalStrike({ x: p.x, y: p.y || 0, z: p.z }, C.orbital.r, { delay: C.orbital.delay, life: C.orbital.life }), 1); } catch (e) {} a18Fx({ kind: "orbital", m, p, t: C.orbital.delay, life: C.orbital.life }); }
      return true; }
    case "Clove": { if (k === "c") { if (!(J.lastKillT != null && performance.now() / 1000 - J.lastKillT < C.pmu.window)) return no(); spend(); A.haste = C.pmu.haste; P.hp = Math.min(150, P.hp + C.pmu.overheal); say("Pick-me-up", 700); return true; }
      spend(); if (k === "q") { const eye=pEye(), fl=SovaBolt.orb([eye.x,eye.y,eye.z],[d.x,d.y,d.z],xBoltRay,(x,z,y)=>groundAt(x,z,0.05,y));p.set(...fl.end);const gen=J.medGen||0;a18Orb(p,fl.t+C.meddle.wind,()=>{ if((J.medGen||0)!==gen)return; const targets=bots.concat(typeof allies!=="undefined"?allies:[]).filter(b=>b&&b.alive&&b.g).map(b=>({u:b,p:b.g.position})); if(player.hp>0)targets.push({u:player,p:player});for(const t of targets)if(Math.hypot(t.p.x-p.x,t.p.z-p.z)<C.meddle.r&&Math.abs(t.p.y-p.y)<4&&los(new THREE.Vector3(p.x,p.y+.4,p.z),new THREE.Vector3(t.p.x,t.p.y+1,t.p.z)))MeddleDecay.begin(t.u,J.medClock||0);try{cvxMeddleBurst(p,C.meddle.r);}catch(e){} }); }
      else if (k === "e") { a18Smoke(p, C.ruse.life, C.ruse.r, 0xd8b8e8, 0x8a6fd0); try { cvxRuse({ x: p.x, y: (p.y || 0) + 1.7, z: p.z }, C.ruse.r, C.ruse.life); } catch (e) {} } return true; }
    case "Harbor": { spend();
      if (k === "c") { const eye=pEye(), fl=SovaBolt.orb([eye.x,eye.y,eye.z],[d.x,d.y,d.z],xBoltRay,(x,z,y)=>groundAt(x,z,0.05,y)); p.set(...fl.end); const gen=J.medGen||0; a18Orb(p, fl.t + C.surge.wind, () => { if((J.medGen||0)!==gen)return; for (const b of bots.concat(typeof allies !== "undefined" ? allies : []).filter(b => b && b.alive && b.g && Math.hypot(b.g.position.x-p.x,b.g.position.z-p.z)<C.surge.r && Math.abs(b.g.position.y-p.y)<4)) { b.blind = Math.max(b.blind || 0, C.surge.near); b.tagT = Math.max(b.tagT || 0,C.surge.slow); b.tagK = 0.35; b.tagS = 0; } /* Storm Surge: all players, no LOS. Offline uses the same Class 3 arc and grounded windup/radius; arc physics remain project approximations. */ if (player.hp > 0 && Math.hypot(player.x - p.x, player.z - p.z) < C.surge.r && Math.abs((player.y || 0) - (p.y || 0)) < 4) { try { pNs(C.surge.near); player.tagT=Math.max(player.tagT||0,C.surge.slow); player.tagK=0.35; player.tagS=0; say("Nearsighted by Storm Surge", 900); } catch (e) {} } SFX.ab("cbPop", p); }); }
      else if (k === "q") { const m = a18Ring(new THREE.Vector3(P.x, 0, P.z), 2, 0x3fd0c0, 0.5); let jx = null; try { jx = hbxHighTide({ x: P.x, y: P.y || 0, z: P.z }, Math.atan2(-d.x, -d.z), { life: C.tide.dist / C.tide.speed + 1 }); if (jx) m.visible = false; } catch (e) {} a18Fx({ kind: "tide", m, jx, ph: P.y || 0, p: new THREE.Vector3(P.x, 0, P.z), d: new THREE.Vector3(d.x, 0, d.z).normalize(), t: C.tide.dist / C.tide.speed }); }
      else if (k === "e") { a18Smoke(p, C.cove.life, C.cove.r, 0x2a8ac2, 0x9adcf2); try { hbxCove({ x: p.x, y: (p.y || 0) + 1.7, z: p.z }, C.cove.r, C.cove.life); } catch (e) {} }
      else { const m = a18Ring(new THREE.Vector3(P.x, 0, P.z), 2.5, 0x3fd0c0, 0.7); try { jxBind(m, hbxReckoning({ x: P.x, y: P.y || 0, z: P.z }, Math.atan2(-d.x, -d.z), C.reckon.dist), 1); } catch (e) {} a18Fx({ kind: "reckon", m, p: new THREE.Vector3(P.x, 0, P.z), d: new THREE.Vector3(d.x, 0, d.z).normalize(), t: C.reckon.dist / C.reckon.speed, hit: [] }); }
      return true; }
    case "Miks": { spend();
      if (k === "c") a18Orb(p, 0.5, () => { try { mkxMPulse({ x: p.x, y: p.y || 0, z: p.z }, C.mpulse.r, C.mpulse.life); } catch (er) {} for (const b of a18BotsIn(p, C.mpulse.r)) b.blind = Math.max(b.blind || 0, C.mpulse.concuss); P.hp = Math.min(100, P.hp + C.mpulse.heal); SFX.ab("cbPop", p); });
      else if (k === "q") { A.stim = C.harmon.life; A.haste = C.harmon.life; say("Harmonize", 700); try { const o = pEye(), h = mkxHarmonize({ x: o.x, y: o.y - 1.4, z: o.z }, null, C.harmon.life, { local: true }); if (h) J._mkH = { h, t: C.harmon.life }; } catch (er) {} }
      else if (k === "e") { a18Smoke(p, C.waveform.life, C.waveform.r, 0x6a8ad0, 0xb8c8f2); try { mkxWaveformSmoke({ x: p.x, y: p.y || 0, z: p.z }, C.waveform.r, C.waveform.life); } catch (er) {} /* legacy body kept visible: human occluder */ }
      else { try { mkxBassquake({ x: P.x, y: (P.y || 0) + 1.2, z: P.z }, { x: d.x, y: 0, z: d.z }, C.bassq.dist); } catch (er) {} a18Fx({ kind: "bassq", p: new THREE.Vector3(P.x, 0, P.z), d: new THREE.Vector3(d.x, 0, d.z).normalize(), t: 0.6 }); }
      return true; }
    case "Viper": { spend();
      if (k === "c") { const z = a18Zone(p, C.snake.life, C.snake.r, C.snake.rate, "Snake Bite", 0x4ad01a); z.visible = false; let gy = p.y || 0; try { const g = groundAt(p.x, p.z, 0.3, (p.y || 0) + 1); if (Number.isFinite(g)) gy = g; } catch (err) {} a18AcidPool(p.x, gy, p.z, C.snake.r, C.snake.life); }
      else if (k === "q") { A.cloud = p; A.cloudOn = true; A.cloudM = a18Smoke(p, 3600, C.pcloud.r, 0x3a6a2a, 0x7ac24a); }
      else if (k === "e") { A.screen = 1; A.toxOn = true; const sp = new THREE.Vector3(P.x - Math.sin(yaw) * C.tscreen.len / 2, 0, P.z - Math.cos(yaw) * C.tscreen.len / 2); A.screenM = a18Smoke(sp, 3600, C.tscreen.len / 2, 0x3a6a2a, 0x7ac24a); }
      else { A.pit = 1; A.pitM = a18Smoke(new THREE.Vector3(P.x, 0, P.z), 3600, C.pit.r, 0x2a5a1a, 0x6ab23a); }
      return true; }
    case "Hush": { spend();
      if (k === "c") { try { hushxFlow({ x: P.x, y: P.y || 0, z: P.z }, { delay: C.flow.delay }); } catch (e) {} P.vy = Math.sqrt(2 * 18 * 6); P.y = Math.max(P.y, 0.01); SFX.ab("updraft"); }
      else if (k === "q") { let ok = false; try { ok = !!hushxFlashbulb({ x: P.x, y: (P.y || 0) + 1.4, z: P.z }, { x: p.x, y: p.y, z: p.z }, { flyT: Math.min(0.45, C.flashb.delay) }); } catch (e) {} a18Orb(p, C.flashb.delay, () => a18Blind(p, C.flashb.blind), ok); }
      else if (k === "e") { try { hushxDisplacement({ x: P.x, y: (P.y || 0) + 1.4, z: P.z }, { x: p.x, y: p.y, z: p.z }, { delay: C.displ.delay }); } catch (e) {} a18Fx({ kind: "pull", p, t: C.displ.delay }); }
      else { try { hushxSuspension(pEye(), jAim(), { speed: C.susp.speed, travelT: C.susp.life }); } catch (e) {} a18Fx({ kind: "susp", p: pEye(), d: jAim(), t: C.susp.life }); }
      return true; }
    case "Iso": { spend();
      if (k === "c") { const m = a18Ring(new THREE.Vector3(P.x, 0, P.z), C.conting.w / 2, 0x6a9af0, 0.4); try { jxBind(m, isoxContingency({ x: P.x, y: P.y || 0, z: P.z }, { x: d.x, y: 0, z: d.z }, { width: C.conting.w, speed: C.conting.speed, life: C.conting.dist / C.conting.speed }), 1); } catch (e) {} a18Fx({ kind: "conting", m, p: new THREE.Vector3(P.x, 0, P.z), d: new THREE.Vector3(d.x, 0, d.z).normalize(), t: C.conting.dist / C.conting.speed }); }
      else if (k === "q") { let ok = false; try { ok = !!isoxUndercut({ x: P.x, y: (P.y || 0) + 1.4, z: P.z }, { x: p.x, y: p.y, z: p.z }, { flyT: 0.5, radius: C.undercut.r }); } catch (e) {} a18Orb(p, 0.5, () => { for (const b of a18BotsIn(p, C.undercut.r)) { b.vuln = C.undercut.vuln; b.supp = C.undercut.supp; } SFX.ab("cbPop", p); }, ok); }
      else if (k === "e") { A.shield = 1; A.shieldT = C.dtap.life; say("Double Tap", 700); }
      else { const t = a18StripBots(new THREE.Vector3(P.x, 0, P.z), new THREE.Vector3(d.x, 0, d.z).normalize(), C.kc.range, C.kc.w)[0]; if (!t) return no(); a18Duel(t); }
      return true; }
    case "Neon": { spend();
      if (k === "c") { const m = a18Ring(new THREE.Vector3(P.x, 0, P.z), C.fastlane.dist / 2, 0x3a8af0, 0.4); try { jxBind(m, neoxFastLane({ x: P.x, y: P.y || 0, z: P.z }, Math.atan2(-d.x, -d.z), C.fastlane.life), 1); } catch (e) {} a18Fx({ kind: "wallg", m, t: C.fastlane.life }); }
      else if (k === "q") { let ok = false; try { ok = !!neoxRelayBolt({ x: P.x, y: (P.y || 0) + 1.4, z: P.z }, { x: p.x, y: p.y, z: p.z }, { flyT: 0.4, radius: C.relay.r }); } catch (e) {} a18Orb(p, 0.4, () => { for (const b of a18BotsIn(p, C.relay.r)) b.blind = Math.max(b.blind || 0, C.relay.concuss); SFX.ab("cbPop", p); }, ok); }
      else if (k === "e") { A.gear = 1; say("High Gear", 700); }
      else { A.od = C.od.life; A.stim = C.od.life; say("Overdrive", 900); }
      return true; }
    case "Waylay": { spend();
      if (k === "c") { let ok = false; try { ok = !!wayxSaturate({ x: P.x, y: (P.y || 0) + 1.4, z: P.z }, { x: p.x, y: p.y, z: p.z }, { flyT: 0.5, radius: C.satur.r }); } catch (e) {} a18Orb(p, 0.5, () => { for (const b of a18BotsIn(p, C.satur.r)) b.hind = C.satur.hinder; SFX.ab("cbPop", p); }, ok); }
      else if (k === "q") { J.dash = jDash(); J.dash = jDash(); SFX.ab("dash"); }
      else if (k === "e") A.mark = new THREE.Vector3(P.x, P.y, P.z);
      else { A.haste = C.cpaths.haste; const dd = new THREE.Vector3(d.x, 0, d.z).normalize(), p0 = new THREE.Vector3(P.x + dd.x * C.cpaths.ahead, 0, P.z + dd.z * C.cpaths.ahead), m = new THREE.Mesh(new THREE.PlaneGeometry(C.cpaths.w, C.cpaths.len), new THREE.MeshBasicMaterial({ color: 0xf0c04a, transparent: true, opacity: 0.35, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending })); m.rotation.x = -Math.PI / 2; m.rotation.z = Math.atan2(-dd.x, -dd.z); m.rotation.order = "YXZ"; m.rotation.set(-Math.PI / 2, 0, 0); m.rotation.order = "ZXY"; m.rotation.y = 0; m.position.set(p0.x + dd.x * C.cpaths.len / 2, (typeof player !== "undefined" ? player.y : 0) + 0.1, p0.z + dd.z * C.cpaths.len / 2); m.rotateOnWorldAxis(new THREE.Vector3(0, 1, 0), Math.atan2(-dd.x, -dd.z)); scene.add(m); try { jxBind(m, wayxConvergentPaths({ x: P.x, y: P.y || 0, z: P.z }, Math.atan2(-dd.x, -dd.z), { len: C.cpaths.len, w: C.cpaths.w, wind: C.cpaths.wind, life: 2.4 }), 1); } catch (e) {} a18Fx({ kind: "paths", m, p: p0, d: dd, t: C.cpaths.wind }); }
      return true; }
    case "Yoru": { spend();
      if (k === "c") { let jx = null; try { yoxFakeoutSpawn(P); jx = yoxFakeoutFigure(); } catch (e) { try { xE(e); } catch (e2) {} } a18Fx({ kind: "decoy", p: new THREE.Vector3(P.x, 1, P.z), d: new THREE.Vector3(d.x, 0, d.z).normalize(), t: C.fakeout.life, jx, m: jx ? null : jM(smokeGeo, xSmokeM("a18decoy", 0x8a92ff, 0xc9d2ff)) }); }
      else if (k === "q") { let jo = null; try { jo = yoxBlindsideOrb(); if (jo && jo.fx && jo.fx.objs && jo.fx.objs[0]) jo.fx.objs[0].position.copy(p); } catch (e) {} a18Orb(p, C.blindside.delay, () => { try { if (jo) yoxEnd(jo); yoxBlindsidePop(p); } catch (e) {} a18Blind(p, C.blindside.blind); }, !!jo); }
      else if (k === "e") { A.gate = a18Aim(C.gcrash.range); try { A.gateH = yoxGatecrashAnchor(A.gate, 30); } catch (e) {} }
      else { A.drift = C.drift.life; try { yoxDriftEnter({ x: P.x, y: P.y, z: P.z }); A.driftV = yoxDriftVeil(C.drift.life); } catch (e) {} say("Dimensional Drift", 900); }
      return true; }
    case "Fade": { spend();
      if (k === "c") { const t = a18BotsIn(new THREE.Vector3(P.x, 0, P.z), 30)[0]; if (t) { let jx = null; try { jx = fdxProwler(P.x, P.y || 0, P.z, Math.atan2(t.g.position.x - P.x, t.g.position.z - P.z)); } catch (e) {} a18Fx({ kind: "seeker", p: new THREE.Vector3(P.x, 1, P.z), jx, tg: t, t: C.prowler.life, sp: C.prowler.speed, near: C.prowler.near }); } }
      else if (k === "q") { let jo = null; try { jo = fdxSeizeOrb(P.x, (P.y || 0) + 1.4, P.z); } catch (e) {} a18Orb(p, 0.5, () => { try { if (jo) jo.end(); fdxSeizePool({ x: p.x, y: p.y, z: p.z }, C.seize.r, C.seize.tether + 1); } catch (e) {} for (const b of a18BotsIn(p, C.seize.r)) { b.hp -= 0; b.teth = C.seize.tether; a18DecayB(b, C.seize.decay); } SFX.ab("cbPop", p); }, !!jo); }
      else if (k === "e") { let jo = null; try { jo = fdxHauntOrb(P.x, (P.y || 0) + 1.4, P.z); } catch (e) {} a18Orb(p, 0.4, () => { try { if (jo) jo.end(); fdxHauntBurst({ x: p.x, y: p.y, z: p.z }); } catch (e) {} for (const b of a18BotsIn(p, C.haunt.r)) b.mark = C.haunt.reveal; SFX.ab("cbPop", p); }, !!jo); }
      else { try { fdxNightfall({ x: P.x, y: P.y || 0, z: P.z }, Math.atan2(d.x, d.z), 14, 9, 2.5); } catch (e) {} a18Fx({ kind: "nightfall", p: new THREE.Vector3(P.x, 0, P.z), d: new THREE.Vector3(d.x, 0, d.z).normalize(), t: 0.7 }); }
      return true; }
    case "Gekko": { spend();
      if (k === "c") { { const zm = a18Zone(p, C.mosh.life, C.mosh.r, C.mosh.dps, "Mosh Pit", 0x4ad01a); try { jxBind(zm, gkxMoshPool({ x: p.x, y: p.y || 0, z: p.z }, C.mosh.r, C.mosh.life), 1); } catch (er) {} } a18Fx({ kind: "boom", p, t: C.mosh.life, r: C.mosh.r, dmg: C.mosh.boom, name: "Mosh Pit" }); a18Glob("c"); }
      else if (k === "q") { const t = a18BotsIn(new THREE.Vector3(P.x, 0, P.z), 30)[0]; if (t) { let jx = null; try { jx = gkxWingman(P.x, P.y || 0, P.z, Math.atan2(t.g.position.x - P.x, t.g.position.z - P.z)); } catch (er) {} a18Fx({ kind: "seeker", p: new THREE.Vector3(P.x, 1, P.z), jx, jy: P.y || 0, jxEnd: (fe) => { try { gkxWingmanBoom({ x: fe.p.x, y: fe.jy || 0, z: fe.p.z }); } catch (er) {} }, tg: t, t: C.wing.life, sp: C.wing.speed, conc: C.wing.concuss }); } a18Glob("q"); }
      else if (k === "e") { let jo = null; try { jo = gkxDizzy(p.x, (p.y || 0) + 1.2, p.z, Math.atan2(p.x - P.x, p.z - P.z)); } catch (er) {} a18Orb(p, 0.5, () => { try { if (jo) jo.end(); } catch (er) {} for (const b of a18BotsIn(p, C.dizzy.r)) b.blind = Math.max(b.blind || 0, C.dizzy.blind); SFX.ab("cbPop", p); }, !!jo); a18Glob("e"); }
      else { let jo = null; try { jo = gkxThrash(p.x, p.y || 0, p.z, Math.atan2(p.x - P.x, p.z - P.z)); } catch (er) {} a18Orb(p, 0.7, () => { try { if (jo) jo.end(); gkxThrashBoom({ x: p.x, y: p.y || 0, z: p.z }, C.thrash.r); } catch (er) {} for (const b of a18BotsIn(p, C.thrash.r)) b.teth = C.thrash.detain; SFX.ab("cbPop", p); }, !!jo); }
      return true; }
    case "KAY/O": { spend();
      if (k === "c") a18Frag(p);
      else if (k === "q") a18Orb(p, C.fdrive.delay, () => a18Blind(p, C.fdrive.blind));
      else if (k === "e") a18Orb(p, 0.4, () => { for (const b of a18BotsIn(p, C.zero.r)) b.supp = C.zero.supp; SFX.ab("cbPop", p); });
      else { A.stim = C.nullcmd.life; A.ncmd = C.nullcmd.life; const m = a18Ring(new THREE.Vector3(P.x, 0, P.z), C.nullcmd.r, 0x8a2af0, 0.4); a18Fx({ kind: "ncmd", m, t: C.nullcmd.life, next: C.nullcmd.pulse }); }
      return true; }
    case "Tejo": { spend();
      if (k === "c") a18Orb(p, 0.5, () => { for (const b of a18BotsIn(p, C.sdrone.r)) { b.mark = C.sdrone.reveal; b.blind = Math.max(b.blind || 0, 1); } SFX.ab("cbPop", p); });
      else if (k === "q") a18Orb(p, 0.4, () => { for (const b of a18BotsIn(p, C.sd.r)) { jHit(b, C.sd.dmg, "Special Delivery"); b.blind = Math.max(b.blind || 0, C.sd.concuss); } SFX.ab("cbPop", p); });
      else if (k === "e") a18Salvo(p);
      else a18Fx({ kind: "armag", p: new THREE.Vector3(P.x, 0, P.z), d: new THREE.Vector3(d.x, 0, d.z).normalize(), t: C.armag.wind });
      return true; }
    case "Deadlock": { spend();
      if (k === "c") { const w = a18Ring(p, C.mesh.len / 2, 0x4a9af0, 0.6); try { jxBind(w, dlxBarrierMesh({ x: p.x, y: p.y || 0, z: p.z }, Math.atan2(-d.x, -d.z), C.mesh.len, C.mesh.life), 1); } catch (er) {} a18Fx({ kind: "meshw", m: w, t: C.mesh.life }); }
      else if (k === "q") { let jx = null; try { jx = dlxSonicSensor({ x: p.x, y: p.y || 0, z: p.z }, C.sensor.life); } catch (er) {} a18Fx({ kind: "sensor", p, jx, jxEnd: (fe) => { try { if (fe.t > 0) dlxSensorBlast({ x: fe.p.x, y: fe.p.y || 0, z: fe.p.z }); } catch (er) {} }, t: C.sensor.life, arm: 1 }); }
      else if (k === "e") a18Orb(p, 0.5, () => { try { dlxGravNet({ x: p.x, y: p.y || 0, z: p.z }, C.gnet.r, C.gnet.life); } catch (er) {} for (const b of a18BotsIn(p, C.gnet.r)) b.teth = C.gnet.life; SFX.ab("cbPop", p); });
      else { const t = a18BotsIn(new THREE.Vector3(P.x, 0, P.z), C.annih.range)[0]; if (t) { t.teth = C.annih.detain; let jx = null; try { dlxAnnihilation({ x: P.x, y: (P.y || 0) + 1.4, z: P.z }, { x: t.g.position.x - P.x, y: 0, z: t.g.position.z - P.z }, C.annih.range); jx = dlxAnniCocoon({ x: t.g.position.x, y: t.g.position.y || 0, z: t.g.position.z }, C.annih.detain); } catch (er) {} a18Fx({ kind: "anni", tg: t, jx, jxEnd: () => {}, t: C.annih.detain }); } }
      return true; }
    case "Veto": { spend();
      if (k === "c") { A.xcut = p; const rm = a18Ring(p, 1, 0xd04a8a, 0.6); try { A.xcutH = jxBind(rm, vtxCrosscut({ x: p.x, y: p.y || 0, z: p.z }), 1); } catch (er) {} }
      else if (k === "q") { let jx = null; try { jx = vtxChokehold({ x: p.x, y: p.y || 0, z: p.z }, C.choke.life); } catch (er) {} a18Fx({ kind: "choke", p, jx, jxEnd: (fe) => { try { if (fe.done) vtxChokeSnare({ x: fe.p.x, y: fe.p.y || 0, z: fe.p.z }, 2.5); } catch (er) {} }, t: C.choke.life, arm: 1 }); }
      else if (k === "e") { const m = a18Ring(p, C.cept.r, 0xd04a8a, 0.3); try { jxBind(m, vtxInterceptor({ x: p.x, y: p.y || 0, z: p.z }, C.cept.r, C.cept.life), 1); } catch (er) {} a18Fx({ kind: "ceptor", m, p, t: C.cept.life }); }
      else { A.evo = C.evo.life; A.stim = C.evo.life; say("Evolution", 900); try { vtxEvolution({ x: P.x, y: P.y || 0, z: P.z }, C.evo.life, { local: true }); } catch (er) {} }
      return true; }
    case "Vyse": { spend();
      if (k === "c") { const zm = a18Zone(p, C.vine.life, C.vine.r, C.vine.dps, "Razorvine", 0x8a2af0); try { jxBind(zm, vyxRazorvine({ x: p.x, y: p.y || 0, z: p.z }, C.vine.r, C.vine.life), 1); } catch (er) {} }
      else if (k === "q") a18Fx({ kind: "shear", p, jyw: Math.atan2(-d.x, -d.z), t: C.shear.life, arm: 1 });
      else if (k === "e") { A.rose = p; const rm = a18Ring(p, 1, 0xd04a8a, 0.6); try { A.roseH = jxBind(rm, vyxArcRose({ x: p.x, y: p.y || 0, z: p.z }, C.rose.life), 1); } catch (er) {} }
      else { const m = a18Ring(new THREE.Vector3(P.x, 0, P.z), C.garden.r, 0xd04a8a, 0.5); try { jxBind(m, vyxSteelGarden({ x: P.x, y: P.y || 0, z: P.z }, C.garden.r, 4), 1); } catch (er) {} a18Fx({ kind: "garden", m, p: new THREE.Vector3(P.x, 0, P.z), t: 1.2 }); }
      return true; }
  }
  return true;
}
function a18Glob(k) { (J.a18gl = J.a18gl || {})[k] = A18C.globule.reclaim; }
function a18DecayB(b, amt) { b.hp = Math.max(1, b.hp - amt * 0.5); } // offline bot decay: half lands now (bots have no decay regen model)
// Iso Kill Contract pocket arena - the client mirror of server/src/arena.js (same numbers): the duel cell is a
// flat 30 x 30 platform with 4 m energy walls and two cover blocks, far outside every map (first cell at x = 10000,
// simultaneous duels stack every 100). The page's movement / prediction / sight all funnel through the blocked /
// groundAt / los globals, so wrapping those three covers the offline sim AND online reconciliation in the arena.
const A18_ARENA_X = 10000, A18_ARENA_STRIDE = 100, A18_ARENA_REACH = 5000, A18_ARENA_HALF = 15, A18_ARENA_WALL_H = 4, A18_ARENA_COVER = [[-6, -5, 3, 2, 1.4], [6, 5, 3, 2, 1.4]];
const a18ArenaIn = (x, z) => Math.abs(x) > A18_ARENA_REACH || Math.abs(z) > A18_ARENA_REACH;
const a18ArenaCell = (x) => A18_ARENA_X + Math.round((x - A18_ARENA_X) / A18_ARENA_STRIDE) * A18_ARENA_STRIDE;
function a18ArenaGround(x, z, y) { return Math.abs(x) <= A18_ARENA_HALF && Math.abs(z) <= A18_ARENA_HALF ? 0 : (y || 0) - 10; }
function a18ArenaBlocked(x, z, r, y, h) { h = h || 1.8; if (x - r < -A18_ARENA_HALF || x + r > A18_ARENA_HALF || z - r < -A18_ARENA_HALF || z + r > A18_ARENA_HALF) return true;
  for (const [cx, cz, w, d, hh] of A18_ARENA_COVER) if (y < hh && y + h > 0 && x + r > cx - w / 2 && x - r < cx + w / 2 && z + r > cz - d / 2 && z - r < cz + d / 2) return true; return false; }
function a18ArenaCast(o, d, max) { let best = Infinity; // slab tests: floor, 4 walls, cover blocks (mirror of arena.js castA)
  if (Math.abs(d[1]) > 1e-9) { const t = -o[1] / d[1]; if (t > 1e-6 && t < max) { const px = o[0] + d[0] * t, pz = o[2] + d[2] * t; if (Math.abs(px) <= A18_ARENA_HALF && Math.abs(pz) <= A18_ARENA_HALF) best = t; } }
  for (const a of [0, 2]) for (const sg of [1, -1]) { const dd = d[a]; if (Math.abs(dd) < 1e-9) continue; const t = (sg * A18_ARENA_HALF - o[a]) / dd; if (t <= 1e-6 || t >= max) continue; const py = o[1] + d[1] * t, pq = o[2 - a] + d[2 - a] * t; if (py >= 0 && py <= A18_ARENA_WALL_H && Math.abs(pq) <= A18_ARENA_HALF && t < best) best = t; }
  for (const [cx, cz, w, d2, hh] of A18_ARENA_COVER) { const mn = [cx - w / 2, 0, cz - d2 / 2], mx = [cx + w / 2, hh, cz + d2 / 2]; let t0 = 0, t1 = max, ok = true;
    for (let a = 0; a < 3; a++) { if (Math.abs(d[a]) < 1e-9) { if (o[a] < mn[a] || o[a] > mx[a]) { ok = false; break; } continue; } let ta = (mn[a] - o[a]) / d[a], tb = (mx[a] - o[a]) / d[a]; if (ta > tb) { const q = ta; ta = tb; tb = q; } if (ta > t0) t0 = ta; if (tb < t1) t1 = tb; if (t0 > t1) { ok = false; break; } }
    if (ok && t0 > 1e-6 && t0 < max && t0 < best) best = t0; }
  return best; }
function a18ArenaShell(ox) { // the visible cell, styled toward the real Kill Contract arena (dark platform, glowing Iso-blue energy walls with a bright grid + top rail, two cover blocks); still an approximation, not Riot's hex-field shader
  const g = new THREE.Group(); g.userData.jp = 1; /* not a pooled mesh: freed as a group */
  const floor = new THREE.Mesh(new THREE.BoxGeometry(A18_ARENA_HALF * 2, 0.2, A18_ARENA_HALF * 2), new THREE.MeshLambertMaterial({ color: 0x232a36 })); floor.position.set(0, -0.1, 0); g.add(floor);
  const edgeM = new THREE.MeshBasicMaterial({ color: 0x6a8cf0 });
  for (const [ex, ez, ew, ed] of [[0, -A18_ARENA_HALF + .1, A18_ARENA_HALF * 2, .18], [0, A18_ARENA_HALF - .1, A18_ARENA_HALF * 2, .18], [-A18_ARENA_HALF + .1, 0, .18, A18_ARENA_HALF * 2], [A18_ARENA_HALF - .1, 0, .18, A18_ARENA_HALF * 2]]) { const e = new THREE.Mesh(new THREE.BoxGeometry(ew, .06, ed), edgeM); e.position.set(ex, .03, ez); g.add(e); } // glowing floor rim
  const wallM = () => new THREE.MeshBasicMaterial({ color: 0x4a6cf0, transparent: true, opacity: 0.3, side: THREE.DoubleSide, depthWrite: false });
  const lineM = () => new THREE.LineBasicMaterial({ color: 0x8ab0ff, transparent: true, opacity: .55 });
  for (const [rx, rz, ry] of [[0, -A18_ARENA_HALF, 0], [0, A18_ARENA_HALF, 0], [-A18_ARENA_HALF, 0, Math.PI / 2], [A18_ARENA_HALF, 0, Math.PI / 2]]) {
    const geo = new THREE.PlaneGeometry(A18_ARENA_HALF * 2, A18_ARENA_WALL_H, 8, 3);
    const w = new THREE.Mesh(geo, wallM()); w.position.set(rx, A18_ARENA_WALL_H / 2, rz); w.rotation.y = ry; g.add(w);
    const grid = new THREE.LineSegments(new THREE.WireframeGeometry(geo), lineM()); grid.position.copy(w.position); grid.rotation.y = ry; g.add(grid); // the energy-field shimmer
    const rail = new THREE.Mesh(new THREE.BoxGeometry(A18_ARENA_HALF * 2, .12, .12), edgeM); rail.position.set(rx, A18_ARENA_WALL_H, rz); rail.rotation.y = ry; g.add(rail); }
  for (const [cx, cz, w, d, hh] of A18_ARENA_COVER) { const b = new THREE.Mesh(new THREE.BoxGeometry(w, hh, d), new THREE.MeshLambertMaterial({ color: 0x39445c, emissive: 0x2a4aaa, emissiveIntensity: 0.55 })); b.position.set(cx, hh / 2, cz); g.add(b);
    const be = new THREE.LineSegments(new THREE.EdgesGeometry(b.geometry), lineM()); be.position.copy(b.position); g.add(be); }
  g.position.set(ox, 0, 0); scene.add(g); return g; }
function a18ArenaFree(g) { if (!g) return; for (const c of [...g.children]) { g.remove(c); if (c.geometry && c.geometry.dispose) c.geometry.dispose(); const t = c.material; if (t && t.dispose) t.dispose(); } scene.remove(g); }
const a18Blk0 = blocked; blocked = function (x, z, r, y) { return a18ArenaIn(x, z) ? a18ArenaBlocked(x - a18ArenaCell(x), z, r, y || 0, 1.8) : a18Blk0(x, z, r, y); };
const a18Gnd0 = groundAt; groundAt = function (x, z, r, y) { return a18ArenaIn(x, z) ? a18ArenaGround(x - a18ArenaCell(x), z, y) : a18Gnd0(x, z, r, y); };
const a18Los0 = los; los = function (a, b) { const ia = a18ArenaIn(a[0], a[2]), ib = a18ArenaIn(b[0], b[2]); if (ia !== ib) return false; if (!ia) return a18Los0(a, b);
  const q = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], len = Math.hypot(q[0], q[1], q[2]); if (len < 0.01) return true;
  const d = [q[0] / len, q[1] / len, q[2] / len]; return a18ArenaCast([a[0] - a18ArenaCell(a[0]), a[1], a[2]], d, Math.max(0, len - 0.4)) === Infinity; };
function a18Duel(t) { const A = J.a18, C = A18C; A.duel = C.kc.duel; A.duelT = t; t.duel = C.kc.duel; t.supp = C.kc.supp; const p = new THREE.Vector3(player.x, player.y, player.z); A.duelHome = p; t.duelHome = t.g.position.clone(); A.duelM = a18ArenaShell(A18_ARENA_X); player.x = A18_ARENA_X - 4; player.y = 0.1; player.z = 0; player.vy = 0; t.g.position.set(A18_ARENA_X + 4, 0.1, 0); say("Kill Contract", 1000); SFX.ab("rewind"); }
function a18Tick(dt) {
  J.medClock=(J.medClock||0)+dt;for(const u of [player].concat(bots,typeof allies!=="undefined"?allies:[]))if(u)MeddleDecay.tick(u,J.medClock,u===player?u.hp>0:u.alive,u.mx||100);

  { const A = J.a18; if (A && A.starBack && performance.now() / 1000 >= A.starBack) { A.starBack = 0; A.stars = Math.min(4, A.stars + 1); say("Star reformed", 700); } } // Dissipate: the star returns after 1.25 s (wiki Nebula)

  if (!J.a18) return; const A = J.a18, C = A18C, P = player, T = dt;
  A.haste = Math.max(0, A.haste - dt); A.stim = Math.max(0, A.stim - dt); A.jam = Math.max(0, A.jam - dt); A.supp = Math.max(0, A.supp - dt);
  if (A.gateTp > 0) { A.gateTp -= dt; if (A.gateTp <= 0 && A.gate) { try { yoxGatecrashTP({ x: P.x, y: P.y, z: P.z }); if (A.gateH) yoxEnd(A.gateH); A.gateH = null; } catch (e) {} P.x = A.gate.x; P.y = A.gate.y; P.z = A.gate.z; A.gate = 0; SFX.ab("dash"); } }
  if (A.drift > 0) { A.drift -= dt; if (A.drift <= 0 && A.driftV !== undefined) { try { yoxDriftExit({ x: P.x, y: P.y, z: P.z }); } catch (e) {} A.driftV = undefined; } } if (A.od > 0) A.od -= dt; if (A.evo > 0) { A.evo -= dt; if (P.hp > 0) P.hp = Math.min(100, P.hp + C.evo.hps * dt); }
  if (A.ncmd > 0) A.ncmd -= dt;
  if (A.shieldT > 0 && (A.shieldT -= dt) <= 0) A.shield = 0;
  if (A.ndy > 0) { A.ndy -= dt; if (A.ndy <= 0 && P.hp <= 0) { P.hp = 100; say("Back.", 800); } }
  if (P.hp <= 0 && J.pick === "Clove" && A.ndyT <= 0 && J.ult >= K().u) A.ndyT = C.ndy.window; else if (P.hp > 0) A.ndyT = 0;
  if (A.ndyT > 0) A.ndyT -= dt;
  if (A.gear > 0) { A.fuel = Math.max(0, A.fuel - C.gear.drain * dt); if (A.fuel <= 0) A.gear = 0; else A.haste = Math.max(A.haste, 0.3); }
  else if (J.pick === "Neon" && A.fuel < C.fuel.max) A.fuel = Math.min(C.fuel.max, A.fuel + C.gear.regen * dt);
  if (J.pick === "Viper" && !A.cloudOn && !A.toxOn && A.fuel < C.fuel.max) A.fuel = Math.min(C.fuel.max, A.fuel + C.fuel.regen * dt);
  if ((A.cloudOn || A.toxOn) && A.fuel > 0) A.fuel = Math.max(0, A.fuel - C.fuel.drain * dt);
  if (A.fuel <= 0 && (A.cloudOn || A.toxOn)) { A.cloudOn = A.toxOn = 0; if (A.cloudM) { jRel(A.cloudM); A.cloudM = 0; } if (A.screenM) { jRel(A.screenM); A.screenM = 0; } }
  if (A.pit) { for (const b of a18BotsIn(new THREE.Vector3(P.x, 0, P.z), C.pit.r, 6)) { a18DecayB(b, C.pit.decay * dt); b.blind = Math.max(b.blind || 0, 0.5); } if (P.hp > 0) P.hp = Math.min(100, P.hp + 8 * dt); }
  if (J.a18gl) for (const k in J.a18gl) { J.a18gl[k] -= dt; if (J.a18gl[k] <= 0) { J[k] = Math.min(1, J[k] + 1); delete J.a18gl[k]; } }
  if (A.duel > 0) { A.duel -= dt; const t = A.duelT; if (A.duel <= 0 || !t || !t.alive) { P.x = A.duelHome.x; P.y = A.duelHome.y; P.z = A.duelHome.z; P.vy = 0; if (t && t.alive) { t.g.position.copy(t.duelHome); t.duel = 0; } if (A.duelM) { a18ArenaFree(A.duelM); A.duelM = 0; } A.duel = 0; } }
  const F = J.a18fx; if (!F) return; let w = 0;
  for (let i = 0; i < F.length; i++) { const e = F[i]; e.t -= dt; let keep = true;
    switch (e.kind) {
      case "gwell": { for (const b of a18BotsIn(e.p, C.star.wellR)) { const d = [e.p.x - b.g.position.x, e.p.z - b.g.position.z], l = Math.hypot(d[0], d[1]) || 1; b.g.position.x += d[0] / l * 4 * dt; b.g.position.z += d[1] / l * 4 * dt; b.vuln = C.star.wellVuln; } if (e.t <= 0) { if (e.m) jRel(e.m); keep = false; } break; }
      case "nova": if (e.t <= 0) { for (const b of a18BotsIn(e.p, C.star.novaR)) b.blind = Math.max(b.blind || 0, C.star.novaConcuss); SFX.ab("cbPop", e.p); if (e.m) jRel(e.m); keep = false; } break;
      case "stimz": if (Math.hypot(P.x - e.p.x, P.z - e.p.z) < C.stim.r && P.hp > 0) A.stim = Math.max(A.stim, 0.5); if (e.t <= 0) { jRel(e.m); keep = false; } break;
      case "orbital": if (e.t <= 0) { e.life -= dt; for (const b of a18BotsIn(e.p, C.orbital.r)) jHit(b, C.orbital.dps * dt, "Orbital Strike"); if (Math.hypot(P.x - e.p.x, P.z - e.p.z) < C.orbital.r && P.hp > 0) hurt(P, C.orbital.dps * dt, "Orbital Strike"); if (e.life <= 0) { jRel(e.m); keep = false; } } break;
      case "decay": if (e.t <= 0) { for (const b of a18BotsIn(e.p, e.r)) a18DecayB(b, e.amt); SFX.ab("cbPop", e.p); keep = false; } break;
      case "tide": case "conting": case "reckon": { e.p.addScaledVector(e.d, (e.kind === "tide" ? C.tide.speed : e.kind === "conting" ? C.conting.speed : C.reckon.speed) * dt); e.m.position.set(e.p.x, 0.06, e.p.z); try { if (e.jx && e.jx.setPos) e.jx.setPos({ x: e.p.x, y: e.ph || 0, z: e.p.z }); } catch (er) {} if (e.kind === "tide") for (const b of a18BotsIn(e.p, 2)) b.hind = C.tide.slow; if (e.kind === "reckon") for (const b of a18BotsIn(e.p, C.reckon.near)) if (!e.hit.includes(b)) { e.hit.push(b); b.blind = Math.max(b.blind || 0, C.reckon.near); b.hind = C.reckon.slow; } if (e.t <= 0) { try { if (e.jx && e.jx.end) e.jx.end(); } catch (er) {} jRel(e.m); keep = false; } break; }
      case "bassq": if (e.t <= 0) { for (const b of a18StripBots(e.p, e.d, C.bassq.dist, C.bassq.w)) { const d = [b.g.position.x - e.p.x, b.g.position.z - e.p.z], l = Math.hypot(d[0], d[1]) || 1; b.g.position.x += d[0] / l * C.bassq.knock; b.g.position.z += d[1] / l * C.bassq.knock; b.hind = C.bassq.slow; } const px = P.x - e.p.x, pz = P.z - e.p.z, pl = Math.hypot(px, pz) || 1; if (pl < C.bassq.dist && (px * e.d.x + pz * e.d.z) / pl > 0.5) { player.tagT = Math.max(player.tagT || 0, C.bassq.slow); player.tagK = .5; a18Deafen(C.bassq.deafen); say("Deafened \u00b7 Bassquake", 1200); } SFX.ab("cbPop", e.p); keep = false; } break;
      case "pull": if (e.t <= 0) { for (const b of a18BotsIn(e.p, C.displ.r)) { const d = [e.p.x - b.g.position.x, e.p.z - b.g.position.z], l = Math.hypot(d[0], d[1]) || 1; b.g.position.x += d[0] / l * Math.min(l, C.displ.pull); b.g.position.z += d[1] / l * Math.min(l, C.displ.pull); } keep = false; } break;
      case "susp": { e.p.addScaledVector(e.d, C.susp.speed * dt); const t = a18BotsIn(e.p, C.susp.r)[0]; if (t) { t.supp = 4; t.g.position.y += 2; keep = false; } else if (e.t <= 0) keep = false; break; }
      case "div": case "wallg": case "meshw": case "paths": case "garden": if (e.kind === "paths" && !e.done && e.t <= 0) { e.done = true; for (const b of a18StripBots(e.p, e.d, C.cpaths.len, C.cpaths.w)) b.hind = C.cpaths.hinder; } if (e.kind === "garden" && !e.done && e.t <= 0) { e.done = true; for (const b of a18BotsIn(e.p, C.garden.r)) b.jamB = C.garden.jam; } if (e.t <= 0) { if (e.m) jRel(e.m); keep = false; } break;
      case "pulses": if (e.t <= 0) { const fall = d => e.inner == null ? e.dmg : d <= e.inner ? e.dmg : e.dmg - (e.dmg - e.dmgOut) * (d - e.inner) / (e.r - e.inner); for (const b of a18BotsIn(e.p, e.r)) jHit(b, fall(Math.hypot(b.g.position.x - e.p.x, b.g.position.z - e.p.z)), e.name); if (e.inner != null) { for (const al of allies) if (al && al.alive) { const dd = Math.hypot(al.g.position.x - e.p.x, al.g.position.z - e.p.z); if (dd <= e.r) jHit(al, fall(dd) / 3, e.name); } const dp = Math.hypot(P.x - e.p.x, P.z - e.p.z); if (P.hp > 0 && dp <= e.r) hurt(P, fall(dp), e.name); try { const gy0 = groundAt(e.p.x, e.p.z, 0.3, typeof player !== "undefined" ? player.y : 3); a18ArmagBoom(e.p.x, Number.isFinite(gy0) ? gy0 : 0, e.p.z, 1.3); } catch (err) {} } SFX.ab("cbPop", e.p); const bm = a18Ring(e.p, e.r, e.name === "Guided Salvo" ? 0xff6a3a : 0xffa03a, 0.75); try { const gy = groundAt(e.p.x, e.p.z, 0.3, typeof player !== "undefined" ? player.y : 3); if (Number.isFinite(gy)) bm.position.y = gy + 0.06; } catch (err) {} a18Fx({ kind: "burst", m: bm, t: 0.45 }); if (--e.left > 0) e.t = e.gap; else keep = false; } break;
      case "burst": if (e.t <= 0) { jRel(e.m); keep = false; } break; /* short-lived impact ring (Guided Salvo / FRAG/ment detonations had no mesh at all) */
      case "boom": if (e.t <= 0) { for (const b of a18BotsIn(e.p, e.r)) jHit(b, e.dmg, e.name); keep = false; } break;
      case "armag": if (e.t <= 0) { SFX.flash(); a18Fx({ kind: "armagchain", p: e.p.clone(), d: e.d.clone(), age: 0, fired: [], grp: a18ArmagGroup(e.p.x, e.p.z, e.d.x, e.d.z, false) }); keep = false; } break;
      /* wiki Armageddon: 16 segments x 2 m, 12 m wide; segment i starts 0.25 s after i-1 and detonates 4x at 0.25 s for 60 each (offline mirror of server agents18.js) */
      case "quakefx": { e.age += dt; const A = e.age; for (const it of e.items) { const m = it.m;
        if (it.t === "spike") { const u = Math.max(0, A - it.d), up = Math.min(1, u / 0.12), dn = Math.max(0, (u - 0.7) / 0.6); m.scale.y = Math.max(0.01, it.h * up * (1 - dn)); }
        else if (it.t === "rock") { it.v[1] -= 22 * dt; m.position.x += it.v[0] * dt; m.position.y = Math.max(m.position.y + it.v[1] * dt, 0.05); m.position.z += it.v[2] * dt; m.rotation.x += it.r[0] * dt; m.rotation.y += it.r[1] * dt; }
        else if (it.t === "smoke") { const u = Math.max(0, A - it.d); m.position.y += it.v * dt * Math.max(0.2, 1 - u / 1.5); m.scale.setScalar(it.s0 * (1 + u * 1.6)); m.visible = A >= it.d; } }
        e.mats.spike.opacity = e.mats.spike2.opacity = Math.max(0, Math.min(1, (1.3 - A) / 0.5)); e.mats.rock.opacity = Math.min(1, Math.max(0, (1.4 - A) / 0.5)); e.mats.smoke.opacity = 0.4 * Math.max(0, 1 - A / 1.7); e.mats.crack.opacity = Math.max(0, Math.min(1, (e.life - A) / 1.2));
        if (A >= e.life) { for (const it of e.items) { scene.remove(it.m); if (it.t === "crack") it.m.geometry.dispose(); } for (const k in e.mats) e.mats[k].dispose(); keep = false; } break; }
      case "acidfx": { e.age += dt; const A = e.age; for (const it of e.items) { const m = it.m; if (it.t === "pool") { const g = Math.min(1, Math.max(0, (A - 0.18) / 0.45)); m.scale.setScalar(Math.max(0.05, e.r * (1 - Math.pow(1 - g, 3)) * (1 + Math.sin(A * 3) * 0.015))); m.material.uniforms.uT.value = A; } else if (it.t === "drop") { const u = A - it.d; if (u < 0 || u > it.tt) { m.visible = false; } else { m.visible = true; m.position.set(it.x0 + it.vx * u, it.y0 + it.vy * u - 4.9 * u * u, it.z0 + it.vz * u); } } else { const u = Math.max(0, A - it.d), up = Math.min(1, u / 0.1), dn = Math.min(1, Math.max(0, (u - 0.3) / 0.35)); m.scale.y = Math.max(0.01, it.h * up * (1 - dn)); m.visible = dn < 1; } }
        e.mats.pool.uniforms.uFade.value = e.online ? 1 : Math.max(0, Math.min(1, (e.life - A) / 0.8)); if (!e.online && A >= e.life) { a18AcidFree(e); keep = false; } if (e.dead) keep = false; break; }
      case "flare": { e.age += dt; const u = Math.min(1, e.age / e.life); e.sp.scale.setScalar(e.size * (0.4 + u * 1.1)); e.sp.material.opacity = 1 - u; if (u >= 1) { scene.remove(e.sp); e.sp.material.dispose(); keep = false; } break; }
      case "armagboom": { e.age += dt; const u = Math.min(1, e.age / e.life), sc = 0.6 + u * 2.6; e.core.scale.setScalar(sc * (e.size || 1)); e.core.material.opacity = 0.6 * Math.pow(1 - u, 1.4); e.core.material.color.setHex(u < 0.35 ? 0xffc040 : u < 0.7 ? 0xff7020 : 0xb02a10); e.ring.scale.setScalar((1 + u * 4.2) * (e.size || 1)); e.ring.material.opacity = 0.8 * (1 - u); if (u >= 1) { scene.remove(e.core); scene.remove(e.ring); e.core.material.dispose(); e.ring.material.dispose(); keep = false; } break; }
      case "armagchain": { e.age += dt; const AG = C.armag; let done = true; for (let i = 0; i < AG.segs; i++) for (let j = 0; j < AG.ticks; j++) { const id = i * AG.ticks + j; if (e.fired[id]) continue; done = false; if (e.age < i * AG.gap + j * AG.tick) continue; e.fired[id] = 1; const o = new THREE.Vector3(e.p.x + e.d.x * AG.seg * i, 0, e.p.z + e.d.z * AG.seg * i); for (const b of a18StripBots(o, e.d, AG.seg, AG.w)) jHit(b, AG.dmg, "Armageddon"); /* wiki: affects allies and self (allies take a third, the server abilityDamage rule) */ { const inS = (x, z) => { const f = (x - o.x) * e.d.x + (z - o.z) * e.d.z, sd = (x - o.x) * -e.d.z + (z - o.z) * e.d.x; return f > 0 && f < AG.seg && Math.abs(sd) < AG.w / 2; }; for (const al of allies) if (al && al.alive && inS(al.g.position.x, al.g.position.z)) jHit(al, AG.dmg / 3, "Armageddon"); if (P.hp > 0 && inS(P.x, P.z)) hurt(P, AG.dmg, "Armageddon"); } for (let b = 0; b < 2; b++) { const f = (i + Math.random()) * AG.seg, sd = (Math.random() - 0.5) * (AG.w - 2), x = e.p.x + e.d.x * f - e.d.z * sd, z = e.p.z + e.d.z * f + e.d.x * sd; let gy = 0; try { const g = groundAt(x, z, 0.3, typeof player !== "undefined" ? player.y : 3); if (Number.isFinite(g)) gy = g; } catch (err) {} a18ArmagBoom(x, gy, z); } } if (done && e.age > AG.segs * AG.gap + AG.ticks * AG.tick) { a18ArmagFree(e.grp); keep = false; } break; }
      case "nightfall": if (e.t <= 0) { for (const b of a18StripBots(e.p, e.d, C.nightfall.dist, C.nightfall.w)) { a18DecayB(b, C.nightfall.decay); b.mark = C.nightfall.decay ? 12 : 0; } SFX.ab("cbPop", e.p); keep = false; } break;
      case "decoy": { e.p.addScaledVector(e.d, C.fakeout.speed * dt); if (e.m) { e.m.position.set(e.p.x, 1, e.p.z); scene.add(e.m); } try { if (e.jx && e.jx.fx && e.jx.fx.objs && e.jx.fx.objs[0]) { const o = e.jx.fx.objs[0]; o.position.set(e.p.x, groundAt(e.p.x, e.p.z, 0.3, e.p.y + 1) || 0, e.p.z); o.rotation.y = Math.atan2(e.d.x, e.d.z); } } catch (er) {} if (e.t <= 0) { if (e.m) jRel(e.m); try { if (e.jx) { yoxEnd(e.jx); yoxFakeoutPop(e.p); } } catch (er) {} a18Blind(e.p, C.blindside.blind); keep = false; } break; }
      case "seeker": { const t = e.tg; if (!t || !t.alive) { keep = false; break; } const d = [t.g.position.x - e.p.x, t.g.position.z - e.p.z], l = Math.hypot(d[0], d[1]); if (l < 0.8 || e.t <= 0) { if (e.near) t.blind = Math.max(t.blind || 0, e.near); if (e.conc) t.blind = Math.max(t.blind || 0, e.conc); keep = false; } else { e.p.x += d[0] / l * e.sp * dt; e.p.z += d[1] / l * e.sp * dt; } break; }
      case "sensor": if (e.arm > 0) e.arm -= dt; else { const t = a18BotsIn(e.p, C.sensor.r)[0]; if (t) { for (const b of a18BotsIn(e.p, C.sensor.r)) b.blind = Math.max(b.blind || 0, C.sensor.concuss); SFX.ab("cbPop", e.p); keep = false; } } if (e.t <= 0) keep = false; break;
      case "choke": { const t = a18BotsIn(e.p, C.choke.r)[0]; if (t && !e.done) { e.done = true; for (const b of a18BotsIn(e.p, C.choke.r)) { a18DecayB(b, C.choke.decay); b.hind = C.choke.slow; } SFX.ab("cbPop", e.p); keep = false; } if (e.t <= 0) keep = false; break; }
      case "shear": { const t = a18BotsIn(e.p, C.shear.r)[0]; if (t && !e.done) { e.done = true; const m = a18Ring(e.p, C.shear.r, 0xd04a8a, 0.6); try { jxBind(m, vyxShear({ x: e.p.x, y: e.p.y || 0, z: e.p.z }, e.jyw || 0, 5, C.shear.wall), 1); } catch (er) {} a18Fx({ kind: "meshw", m, t: C.shear.wall }); } if (e.t <= 0) keep = false; break; }
      case "ceptor": if (e.t <= 0) { jRel(e.m); keep = false; } break;
      case "ncmd": { e.next -= dt; if (e.next <= 0) { e.next = C.nullcmd.pulse; for (const b of a18BotsIn(new THREE.Vector3(P.x, 0, P.z), C.nullcmd.r)) b.supp = C.zero.supp; } if (e.t <= 0) { jRel(e.m); keep = false; } break; }
      case "anni": { const t = e.tg; if (!t || !t.alive || e.t <= 0) { if (t && t.alive && e.t <= 0) jHit(t, 999, "Annihilate"); keep = false; break; } const d = [P.x - t.g.position.x, P.z - t.g.position.z], l = Math.hypot(d[0], d[1]) || 1; if (l > 1.2) { t.g.position.x += d[0] / l * 2.5 * dt; t.g.position.z += d[1] / l * 2.5 * dt; } break; }
      case "star": if (e.t <= 0 || e.gone) { if (e.m) jRel(e.m); keep = false; } break;
      default: if (e.pop) { if (e.m) e.m.position && null; if (e.t <= 0) { e.pop(); if (e.m) jRel(e.m); keep = false; } } else if (e.t <= 0) keep = false;
    if (e.jx) { try { const o0 = e.jx.fx && e.jx.fx.objs && e.jx.fx.objs[0]; if (keep) { if (e.kind === "seeker") { if (e.jx.move) { const q = e.jxl || e.p; const yw = (Math.abs(e.p.x - q.x) + Math.abs(e.p.z - q.z) > 1e-4) ? Math.atan2(e.p.x - q.x, e.p.z - q.z) : (e.jyw || 0); e.jyw = yw; e.jxl = { x: e.p.x, z: e.p.z }; e.jx.move(e.p.x, (e.jy || 0), e.p.z, yw); } else if (o0) o0.position.set(e.p.x, o0.position.y, e.p.z); } } else { if (e.jxEnd) e.jxEnd(e); else if (e.kind === "seeker") fdxProwlerBurst({ x: e.p.x, y: 0.5, z: e.p.z }); e.jx.end(); e.jx = null; } } catch (er) {} }
    }
    if (keep) F[w++] = e; else if (e.m && !e.popped && e.kind === undefined) jRel(e.m);
  }
  F.length = w;
}
// Iso Double Tap shield + Yoru Dimensional Drift: the player ignores one hit / all hits (offline, player-side)
const a18Hurt0 = hurt;
hurt = function (t, n, by) { if (t === player && J.a18) { if (J.a18.shield) { J.a18.shield = 0; blip(880, 0.1, "sine", 0.1); return; } if (J.a18.drift > 0 || J.a18.evo > 0 && n < 0) return; } return a18Hurt0(t, n, by); };
// round start: fresh stars / fuel / anchors (jRound resets J.c/q/e from KITS already)
const a18Round0 = jRound; jRound = function (match) { a18Round0(match); J.medGen=(J.medGen||0)+1; for(const u of [player].concat(bots,typeof allies!=="undefined"?allies:[]))if(u)u.medDecay=null; J.medClock=0; if (A18SET.has(J.pick)) a18Reset(); };
// kill credit: signature 2-kill resets (Iso Double Tap, Waylay Refract, Yoru Gatecrash), Neon slide charges, Clove Pick-me-up window
const a18Kill0 = jKill; jKill = function () { a18Kill0(); if (!A18SET.has(J.pick) || !J.a18) return; const A = J.a18; J.lastKillT = performance.now() / 1000; if (["Iso", "Waylay", "Yoru"].includes(J.pick) && J.e < 1 && ++J.tk >= 2) { J.e = 1; J.tk = 0; say(K().n[2] + " ready", 700); } if (J.pick === "Neon" && A.slides < 1 && ++A.slideK >= 2) { A.slides = 1; A.slideK = 0; } };
// hook the key dispatch and the frame tick (same wrapper pattern as the other runtime blocks)
const a18KeyJ = jKey; jKey = function (code) { if (A18SET.has(J.pick)) { if (NET.socket && MP.st === "game" && (MP.m5 || NET.tab)) { if (["KeyC", "KeyQ", "KeyE", "KeyX"].includes(code)) { const k0 = code[3].toLowerCase(); if ((J.pick === "Astra" || J.pick === "Tejo") && a18Tac(k0)) return; if (running && player.hp > 0 && FV.buy <= 0) netSend({ t: "ab", k: k0 }); } return; } if (!J.a18) a18Reset(); return a18Key(code), true; } return a18KeyJ(code); };
// USE fakes Gatecrash (wiki: the same audio cue, no teleport, a 30 s decal); online the server decides whether an anchor is up
const a18Use0 = xdUse; xdUse = function () { if (J.pick === "Yoru") { if (NET.socket && MP.st === "game" && (MP.m5 || NET.tab)) { if (running && player.hp > 0 && FV.buy <= 0) netSend({ t: "ab", k: "e", fk: 1 }); return true; } if (J.a18 && J.a18.gate && !(J.a18.gateTp > 0)) { const g = J.a18.gate; SFX.ab("dash"); a18Fx({ kind: "gfk", m: a18Ring(new THREE.Vector3(g.x, 0, g.z), 1.2, 0x8a92ff, 0.6), t: 30 }); say("Fake teleport", 900); return true; } } return a18Use0.apply(this, arguments); };
const a18TickJ = jTick; jTick = function (dt) { a18TickJ(dt); try { a18Tick(dt); } catch (e) { xE(e); } };

// ---- AGENTS 18 ONLINE ----
// Server-authoritative online rendering for the 18 agents: fx rows (server/src/agents18.js fx kinds) synced from
// netSyncEffects, and the rs status block (supp/jam/hind/haste/stim/decay, spike.js roundState) on the HUD.
// Shapes follow the offline a18 visuals: clouds for fields/smokes, flat rings for zones/pulses, walls for
// barriers, small meshes for devices/movers. Colors match the offline casts above.
const A18VIS = { star: ["star", 0xb9a7ff, .9], divide: ["wall", 0x9a6ff0, .5], conting: ["wall", 0x6a9af0, .45], fastlane: ["wall", 0x3a8af0, .45], shear: ["wall", 0xd04a8a, .5], tscreen: ["wall", 0x7ac24a, .4],
 tide: ["wave", 0x3fd0c0, .5], reckon: ["wave", 0x3fd0c0, .6], bassq: ["wave", 0x3fd0c0, .5], nightfall: ["wave", 0x241a40, .7], armag: ["armag", 0xff5a2a, .55], surge: ["wave", 0x3fd0c0, .5], paths: ["ring", 0xf0c04a, .5],
 pit: ["cloud", 0x6ab23a, .4], cove: ["cloud", 0x3fd0c0, .4], garden: ["cloud", 0xd04a8a, .35], choke: ["cloud", 0x8a6af0, .4], vine: ["cloud", 0xd04a8a, .4], gnet: ["cloud", 0x6a4af0, .5], seize: ["cloud", 0x4a2a8a, .5], mosh: ["cloud", 0xff7a1a, .5], fire: ["cloud", 0xff5a1a, .5], orbital: ["cloud", 0xff8a3a, .45], frag: ["cloud", 0xffa03a, .45], salvo: ["cloud", 0xff6a3a, .5], snake: ["cloud", 0x6ab23a, .45], susp: ["cloud", 0xc04af0, .35],
 gwell: ["ring", 0x8a6af0, .6], nova: ["ring", 0xb08af0, .6], pull: ["ring", 0x8a6af0, .5], displ: ["ring", 0x9a6ff0, .5], stim: ["ring", 0xf0e0b0, .5], mpulse: ["ring", 0x3fd0c0, .55], nullcmd: ["ring", 0x8a2af0, .45], haunt: ["ring", 0xd04a8a, .45], blast: ["ring", 0xff8a5a, .6], sd: ["ring", 0x3fd0c0, .55], sensor: ["ring", 0xf0c04a, .4], undercut: ["ring", 0x6a9af0, .55], satur: ["ring", 0xf0c04a, .5], zero: ["ring", 0x8a2af0, .5],
 emitter: ["dev", 0x8a6af0], ceptor: ["dev", 0x3fd0c0], rose: ["dev", 0xd04a8a], sdrone: ["dev", 0x3fd0c0], xcut: ["dev", 0x3fd0c0], mesh: ["dev", 0xc0c8d0], sensor2: ["dev", 0xf0c04a],
 gatefake: ["ring", 0x8a92ff, .5], seeker: ["orb", 0x3fd0c0], decoy: ["orb", 0x8a92ff], dizzy: ["orb", 0x3fd0c0], anni: ["orb", 0xff4a6a], wing: ["orb", 0x3fd0c0] };

// Armageddon strike path: a thin ground outline (12 m x 32 m, 15 seam ticks) while it runs; the damage is shown as per-detonation
// explosions (a18ArmagBoom: expanding fireball + shock ring + lit core), not slabs. Used offline and by the online fx row.
let a18BoomGeo = null, a18BoomRing = null;
function a18ArmagGroup(px, pz, dx, dz, online) {
  const AG = A18C.armag, grp = new THREE.Group(), pts = [], rx = -dz, rz = dx, hw = AG.w / 2;
  const gy = (x, z) => { try { const g = groundAt(x, z, 0.3, typeof player !== "undefined" ? player.y : 3); return Number.isFinite(g) ? g + 0.08 : 0.08; } catch (err) { return 0.08; } };
  const P = (f, sd) => { const x = px + dx * f + rx * sd, z = pz + dz * f + rz * sd; return [x, gy(x, z), z]; };
  const seg = (a, b) => { pts.push(...a, ...b); };
  const N = AG.segs, L = AG.seg;
  for (let k = 0; k < N; k++) { seg(P(k * L, -hw), P((k + 1) * L, -hw)); seg(P(k * L, hw), P((k + 1) * L, hw)); }
  for (let k = 0; k <= N; k++) seg(P(k * L, -hw), P(k * L, hw));
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
  grp.add(new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0xff7a30, transparent: true, opacity: 0.55, depthWrite: false })));
  scene.add(grp); return { grp, segs: [], flash: [], fired: [] };
}
function a18ArmagFree(g) { if (!g) return; scene.remove(g.grp); g.grp.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); }); }

// Breach Rolling Thunder blast, built from the wiki showcase clip (Rolling_Thunder_Showcase.mp4): the ground fractures into dark cracks glowing orange,
// jagged orange-yellow spikes burst up out of it, rock debris flies, dark grey smoke puffs rise. One call = one blast slice (w x seg m).
let a18QkTex = null, a18QkCone = null, a18QkBox = null, a18QkSph = null;
let a18AcidTex = null, a18AcidSpike = null, a18AcidDrop = null;
/* Viper Snake Bite (wiki Snake_Bite showcase clip, frames viewed): the canister bursts into jagged translucent green fronds that
   settle into a flat, bright lime acid pool with darker bubble rings, pale blobs and a ragged edge. Not a plain disc. */
function a18AcidPool(cx, gy, cz, r, life, online) {
  if (!a18AcidTex) {
    const c = document.createElement("canvas"); c.width = c.height = 256; const g = c.getContext("2d"); g.clearRect(0, 0, 256, 256);
    const N = 48, edge = []; for (let i = 0; i < N; i++) edge.push(0.8 + Math.random() * 0.2);
    g.beginPath(); for (let i = 0; i <= N; i++) { const a = (i % N) / N * Math.PI * 2, k = edge[i % N] * (i % 2 ? 0.96 : 1); const x = 128 + Math.cos(a) * 124 * k, y = 128 + Math.sin(a) * 124 * k; i ? g.lineTo(x, y) : g.moveTo(x, y); } g.closePath(); g.save(); g.clip();
    const gr = g.createRadialGradient(128, 128, 10, 128, 128, 128); gr.addColorStop(0, "#7dff3a"); gr.addColorStop(0.75, "#58e022"); gr.addColorStop(1, "#3cb818"); g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 26; i++) { const x = 20 + Math.random() * 216, y = 20 + Math.random() * 216, rr = 6 + Math.random() * 16; g.strokeStyle = "rgba(20,110,10,0.55)"; g.lineWidth = 2; g.beginPath(); g.arc(x, y, rr, 0, 6.3); g.stroke(); g.fillStyle = "rgba(190,255,120,0.28)"; g.beginPath(); g.arc(x - rr * 0.25, y - rr * 0.25, rr * 0.45, 0, 6.3); g.fill(); }
    g.restore(); g.strokeStyle = "rgba(190,255,130,0.9)"; g.lineWidth = 4; g.stroke();
    a18AcidTex = new THREE.CanvasTexture(c);
    a18AcidSpike = new THREE.ConeGeometry(0.35, 1, 3); a18AcidSpike.translate(0, 0.5, 0);
  const poolMat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, fog: false, polygonOffset: true, polygonOffsetFactor: -2, uniforms: { uT: { value: 0 }, uFade: { value: 1 }, uSeed: { value: Math.random() * 50 } },
    vertexShader: "varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
    fragmentShader: "varying vec2 vP; uniform float uT, uSeed, uFade; float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);} float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1.,0.)),f.x),mix(h(i+vec2(0.,1.)),h(i+vec2(1.,1.)),f.x),f.y);} void main(){ vec2 p=vP; float r=length(p), an=atan(p.y,p.x); float edge=0.68+0.17*n(vec2(an*2.5+uSeed,uSeed))+0.09*n(vec2(an*6.+uSeed,uSeed+3.))+0.045*n(vec2(an*15.+uSeed,uT*0.7)); float a=smoothstep(edge,edge-0.04,r); if(a<0.01) discard; float w=n(p*6.+vec2(uT*0.8,-uT*0.5))*0.65+n(p*13.-uT*0.9)*0.35; vec3 col=mix(vec3(0.12,0.80,0.08),vec3(0.42,1.0,0.22),w); vec2 pw=p+vec2(n(p*4.+uSeed),n(p*4.-uSeed))*0.18; vec2 g=pw*6.; vec2 gi=floor(g), gf=fract(g)-0.5; float rad=0.10+0.16*h(gi+11.); float d=length(gf+(vec2(h(gi),h(gi+7.))-0.5)*0.55); float b=smoothstep(rad,rad-0.04,d)*step(0.55,h(gi+3.)); col=mix(col,vec3(0.78,1.0,0.5),b*0.55); float ring=smoothstep(0.05,0.0,abs(d-rad))*step(0.55,h(gi+3.)); col*=1.0-ring*0.25; float sp=smoothstep(0.90,1.0,n(p*16.+uT*0.8)); col+=sp*0.45; col*=mix(0.72,1.0,smoothstep(edge,edge-0.14,r)); float lip=smoothstep(edge-0.10,edge-0.03,r)*a; col=mix(col,vec3(0.62,1.0,0.36),lip*0.4); gl_FragColor=vec4(col,0.95*a*uFade); }" });
  const mats = { pool: poolMat, spike: new THREE.MeshBasicMaterial({ color: 0x5cff30, transparent: true, opacity: 0.6, depthWrite: false, fog: false, toneMapped: false, side: THREE.DoubleSide }), drop: new THREE.MeshBasicMaterial({ color: 0x6dff3a, transparent: true, opacity: 0.85, depthWrite: false, fog: false, toneMapped: false }) };
  }
  const mats = { pool: new THREE.MeshBasicMaterial({ map: a18AcidTex, transparent: true, opacity: 0.92, depthWrite: false, fog: false, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -2 }), spike: new THREE.MeshBasicMaterial({ color: 0x4cff2a, transparent: true, opacity: 0.55, depthWrite: false, fog: false, toneMapped: false, side: THREE.DoubleSide }) };
  const E = { kind: "acidfx", age: 0, life, r, items: [], mats, online: !!online };
  const pm = new THREE.Mesh(new THREE.CircleGeometry(1, 40), mats.pool); pm.rotation.x = -Math.PI / 2; pm.rotation.z = Math.random() * 6.28; pm.position.set(cx, gy + 0.07, cz); pm.scale.setScalar(0.1); scene.add(pm); E.items.push({ m: pm, t: "pool" });
  for (let k = 0; k < 0; k++) { const a = Math.random() * 6.28, d = Math.sqrt(Math.random()) * r * 0.85, m = new THREE.Mesh(a18AcidSpike, mats.spike); m.position.set(cx + Math.cos(a) * d, gy, cz + Math.sin(a) * d); const lean = 0.25 + Math.random() * 0.5; m.rotation.set(Math.sin(a) * lean, 0, -Math.cos(a) * lean); m.scale.set(0.35 + Math.random() * 0.5, 0.01, 0.35 + Math.random() * 0.5); scene.add(m); E.items.push({ m, t: "spike", h: 0.5 + Math.random() * 1.1 * (1 - d / r * 0.5), d: Math.random() * 0.12 }); }
  if (!a18AcidDrop) a18AcidDrop = new THREE.SphereGeometry(1, 6, 5);
  for (let k = 0; k < 64; k++) { const a = Math.random() * 6.28, d = Math.sqrt(Math.random()) * r * 1.05, vy = 2.2 + Math.random() * 3.6, tt = 2 * vy / 9.8, m = new THREE.Mesh(a18AcidDrop, mats.drop), sc = 0.04 + Math.random() * 0.1; m.scale.setScalar(sc); m.visible = false; scene.add(m); E.items.push({ m, t: "drop", x0: cx, z0: cz, y0: gy + 0.1, vx: Math.cos(a) * d / tt, vz: Math.sin(a) * d / tt, vy, tt, d: Math.random() * 0.25, sc }); }
  for (let k = 0; k < 22; k++) { const a = Math.random() * 6.28, d = Math.sqrt(Math.random()) * r * 0.92, m = new THREE.Mesh(a18AcidSpike, mats.spike); m.position.set(cx + Math.cos(a) * d, gy, cz + Math.sin(a) * d); m.rotation.set((Math.random() - 0.5) * 0.7, Math.random() * 6.28, (Math.random() - 0.5) * 0.7); m.scale.set(0.5 + Math.random() * 1.4, 0.01, 0.5 + Math.random() * 1.4); scene.add(m); E.items.push({ m, t: "spike", h: 0.7 + Math.random() * 1.9 * (1 - d / r * 0.5), d: Math.random() * 0.18 }); }
  a18Fx(E); return E;
}
function a18AcidFree(E) { for (const it of E.items) { scene.remove(it.m); if (it.t === "pool") it.m.geometry.dispose(); } for (const k in E.mats) E.mats[k].dispose(); E.dead = true; }
let a18DustT = null;
function a18DustTex() { if (a18DustT) return a18DustT; const c = document.createElement("canvas"); c.width = c.height = 128; const g = c.getContext("2d"); for (let i = 0; i < 26; i++) { const x = 64 + (Math.random() - 0.5) * 60, y = 64 + (Math.random() - 0.5) * 60, r = 16 + Math.random() * 22, gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, "rgba(255,255,255,0.28)"); gr.addColorStop(1, "rgba(255,255,255,0)"); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); } a18DustT = new THREE.CanvasTexture(c); return a18DustT; }
function a18QuakeBlast(cx, gy, cz, yaw, w, seg, fault) {
  if (!a18QkTex) {
    const c = document.createElement("canvas"); c.width = c.height = 256; const g = c.getContext("2d"); g.clearRect(0, 0, 256, 256); g.lineCap = "round";
    const crack = (x, y, a, len, wd, d) => { if (d > 3 || len < 8) return; const x2 = x + Math.cos(a) * len, y2 = y + Math.sin(a) * len;
      g.strokeStyle = "rgba(255,150,30,0.9)"; g.lineWidth = wd + 4; g.beginPath(); g.moveTo(x, y); g.lineTo(x2, y2); g.stroke();
      g.strokeStyle = "rgba(25,15,10,0.95)"; g.lineWidth = wd; g.beginPath(); g.moveTo(x, y); g.lineTo(x2, y2); g.stroke();
      g.strokeStyle = "rgba(255,230,120,0.9)"; g.lineWidth = Math.max(1, wd * 0.35); g.beginPath(); g.moveTo(x, y); g.lineTo(x2, y2); g.stroke();
      crack(x2, y2, a + (Math.random() - 0.5) * 0.9, len * 0.75, wd * 0.8, d + 1); if (Math.random() < 0.7) crack(x2, y2, a + (Math.random() < 0.5 ? 1 : -1) * (0.5 + Math.random() * 0.7), len * 0.6, wd * 0.7, d + 1); };
    for (let i = 0; i < 9; i++) crack(128, 128, (i / 9) * Math.PI * 2 + Math.random() * 0.5, 40 + Math.random() * 50, 5, 0);
    a18QkTex = new THREE.CanvasTexture(c);
    a18QkCone = new THREE.ConeGeometry(0.45, 1, 4); a18QkCone.translate(0, 0.5, 0); a18QkBox = new THREE.BoxGeometry(1, 1, 1); a18QkSph = new THREE.SphereGeometry(1, 8, 6);
  }
  const mk = (c, o, add) => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: o, depthWrite: false, side: THREE.DoubleSide, blending: add ? THREE.AdditiveBlending : THREE.NormalBlending });
  const E = { kind: "quakefx", age: 0, life: 2.2, items: [], mats: { crack: new THREE.MeshBasicMaterial({ map: a18QkTex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }), spike: mk(0xff7a10, 1), spike2: mk(0xffc030, 1), rock: mk(0x3a2a20, 1), smoke: new THREE.SpriteMaterial({ map: a18DustTex(), color: 0xb89a78, transparent: true, depthWrite: false, opacity: 0.4 }) } };
  const fx = -Math.sin(yaw), fz = -Math.cos(yaw), add = (m, o) => { scene.add(m); E.items.push(Object.assign({ m }, o)); return m; };
  const R = (a, b) => a + Math.random() * (b - a), P = (u, v) => [cx + fx * v - fz * u, cz + fz * v + fx * u]; /* u: across (w), v: along (seg) */
  for (let k = 0; k < 3; k++) { const [x, z] = P(R(-w / 3, w / 3), R(-seg / 2, seg / 2)), m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), E.mats.crack); m.rotation.x = -Math.PI / 2; m.rotation.z = Math.random() * 6.28; m.position.set(x, gy + 0.06 + k * 0.004, z); m.scale.setScalar(fault ? 5 : R(7, 10)); add(m, { t: "crack" }); }
  for (let k = 0, nk = fault ? 4 : 14; k < nk; k++) { const [x, z] = P(R(-w / 2, w / 2), R(-seg * 0.75, seg * 0.75)), m = new THREE.Mesh(a18QkCone, k % 3 ? E.mats.spike : E.mats.spike2), h = R(1.6, 4.2); m.position.set(x, gy, z); m.rotation.set(R(-0.35, 0.35), R(0, 6.28), R(-0.35, 0.35)); m.scale.set(R(0.8, 1.8), 0.01, R(0.8, 1.8)); add(m, { t: "spike", h, d: R(0, 0.12) }); }
  for (let k = 0, nk = fault ? 5 : 16; k < nk; k++) { const [x, z] = P(R(-w / 2, w / 2), R(-seg * 0.6, seg * 0.6)), m = new THREE.Mesh(a18QkBox, E.mats.rock); m.position.set(x, gy + 0.3, z); const s2 = R(0.12, 0.4); m.scale.set(s2, s2 * R(0.5, 1.2), s2 * R(0.7, 1.5)); add(m, { t: "rock", v: [R(-4, 4), R(5, 11), R(-4, 4)], r: [R(-9, 9), R(-9, 9), R(-9, 9)] }); }
  for (let k = 0, nk = fault ? 0 : 5; k < nk; k++) { const [x, z] = P(R(-w / 2.5, w / 2.5), R(-seg / 2, seg / 2)), m = new THREE.Sprite(E.mats.smoke); m.position.set(x, gy + 0.8, z); add(m, { t: "smoke", s0: R(2.2, 3.8), v: R(1.4, 2.6), d: R(0, 0.25) }); }
  a18Fx(E); return E;
}

// Breach Fault Line (wiki Fault_Line_Showcase.mp4): a yellow line, then the ground cracks open along it glowing orange with a few spikes, no smoke.
function a18FaultVis(px, pz, fx, fz, nr, L, w) {
  const yaw = Math.atan2(-fx, -fz), seg = 5, n = Math.max(1, Math.ceil(L / seg));
  for (let i = 0; i < n; i++) { const v = nr + Math.min(L, i * seg + seg / 2), cx = px + fx * v, cz = pz + fz * v; let gy = typeof player !== "undefined" ? player.y : 0; try { const g = groundAt(cx, cz, 0.3, gy + 1); if (Number.isFinite(g)) gy = g; } catch (err) {} a18QuakeBlast(cx, gy, cz, yaw, w * 2, seg, true); }
}
// Breach Aftershock (wiki Aftershock_Showcase.mp4): a bright fireball with concentric expanding rings at the wall.
function a18AfterBoom(x, y, z) { a18ArmagBoom(x, y - 1, z, 0.8); for (const r of [1.5, 3]) { const m = a18Ring({ x, z }, r, 0xffb040, 0.55); m.position.y = y - 0.9; a18Fx({ kind: "burst", m, t: 0.45 }); } }

// Breach Flashpoint (wiki Flashpoint clip): a small orange orb with a thin blue ring that bursts into a white-orange flare with long radiating light rays.
let a18FlareTex = null;
function a18Flare(p, size) {
  if (!a18FlareTex) { const c = document.createElement("canvas"); c.width = c.height = 256; const g = c.getContext("2d"), gr = g.createRadialGradient(128, 128, 0, 128, 128, 128); gr.addColorStop(0, "rgba(255,255,230,1)"); gr.addColorStop(0.12, "rgba(255,200,110,0.9)"); gr.addColorStop(0.5, "rgba(255,120,60,0.15)"); gr.addColorStop(1, "rgba(255,120,60,0)"); g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 18; i++) { const a = (i / 18) * Math.PI * 2 + Math.random() * 0.2, l = 70 + Math.random() * 58, w = 0.035 + Math.random() * 0.05; g.fillStyle = "rgba(255,225,170," + (0.35 + Math.random() * 0.4) + ")"; g.beginPath(); g.moveTo(128, 128); g.lineTo(128 + Math.cos(a - w) * l, 128 + Math.sin(a - w) * l); g.lineTo(128 + Math.cos(a) * (l + 12), 128 + Math.sin(a) * (l + 12)); g.lineTo(128 + Math.cos(a + w) * l, 128 + Math.sin(a + w) * l); g.closePath(); g.fill(); }
    a18FlareTex = new THREE.CanvasTexture(c); }
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: a18FlareTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 1 })); sp.position.set(p.x, p.y, p.z); sp.scale.setScalar(size || 6); scene.add(sp);
  const ring = a18Ring({ x: p.x, z: p.z }, 0.6, 0x60b0ff, 0.9); ring.rotation.set(0, 0, 0); ring.position.set(p.x, p.y, p.z); a18Fx({ kind: "burst", m: ring, t: 0.35 });
  a18Fx({ kind: "flare", sp, age: 0, life: 0.45, size: size || 6 });
}
function a18ArmagBoom(x, gy, z, size) {
  size = size || 1;
  if (!a18BoomGeo) { a18BoomGeo = new THREE.SphereGeometry(1, 14, 10); a18BoomRing = new THREE.RingGeometry(0.85, 1, 28); a18BoomRing.rotateX(-Math.PI / 2); }
  const core = new THREE.Mesh(a18BoomGeo, new THREE.MeshBasicMaterial({ color: 0xffc040, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false }));
  core.position.set(x, gy + 1.0, z); scene.add(core);
  const ring = new THREE.Mesh(a18BoomRing, new THREE.MeshBasicMaterial({ color: 0xffe0a0, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  ring.position.set(x, gy + 0.1, z); scene.add(ring);
  a18Fx({ kind: "armagboom", core, ring, size, age: 0, life: 0.55, t: 99 });
}
// Guided Salvo (wiki Guided_Salvo): missile flight (speed unsourced, 30 m/s placeholder) + 1.25 s windup, then 3 pulses 0.8 s apart; inner 2.5 m 65, outer 4.5 m 65->50;
// affects allies (1/3) and self. A flat inner + outer marker shows the target through the windup.
function a18Salvo(p) {
  const S = A18C.salvo, d = Math.hypot(p.x - player.x, p.z - player.z), delay = d / S.fly + S.wind;
  const o = a18Fx({ kind: "pulses", p, t: delay, gap: S.gap, left: S.pulses, r: S.r, inner: S.inner, dmg: S.dmg, dmgOut: S.dmgOut, name: "Guided Salvo" });
  for (const [r, op] of [[S.r, 0.35], [S.inner, 0.55]]) { const m = a18Ring(p, r, 0xff6a3a, op); try { const gy = groundAt(p.x, p.z, 0.3, typeof player !== "undefined" ? player.y : 3); if (Number.isFinite(gy)) m.position.y = gy + 0.05; } catch (err) {} a18Fx({ kind: "burst", m, t: delay }); }
  return o;
}
// KAY/O FRAG/ment (wiki): 0.5 s windup after landing, 4 pulses 1 s apart, inner 1 m 60 falling to 25 at 4 m; allies (1/3) and self too.
function a18Frag(p) {
  const F = A18C.frag;
  const o = a18Fx({ kind: "pulses", p, t: F.wind, gap: F.gap, left: F.pulses, r: F.r, inner: F.inner, dmg: F.dmg, dmgOut: F.dmgOut, name: "FRAG/ment" });
  for (const [r, op] of [[F.r, 0.3], [F.inner, 0.5]]) { const m = a18Ring(p, r, 0xffa03a, op); try { const gy = groundAt(p.x, p.z, 0.3, typeof player !== "undefined" ? player.y : 3); if (Number.isFinite(gy)) m.position.y = gy + 0.05; } catch (err) {} a18Fx({ kind: "burst", m, t: F.wind }); }
  return o;
}
const a18Net = new Map(); // server effect id -> {m, kind}
function a18NetMesh(kind, e) {
  const v = A18VIS[kind] || ["orb", 0xc0c8d0]; const [shape, col, op] = v; let m;
  if (shape === "wall") { m = new THREE.Mesh(new THREE.BoxGeometry((e.r || 8) * 2, 3, .6), new THREE.MeshLambertMaterial({ color: col, transparent: true, opacity: op })); m.position.set(e.p[0], 1.5, e.p[2]); if (Number.isFinite(e.yaw)) m.rotation.y = -e.yaw; }
  else if (shape === "wave") { m = new THREE.Mesh(new THREE.BoxGeometry(e.r && e.r > 2 ? e.r * 2 : 8, 2.2, 1.2), new THREE.MeshLambertMaterial({ color: col, transparent: true, opacity: op })); m.position.set(e.p[0], 1.1, e.p[2]); }
  else if (shape === "ring") { m = jM(ringGeo, fireMat(col, op)); m.rotation.x = -Math.PI / 2; m.position.set(e.p[0], .06, e.p[2]); m.scale.setScalar(e.r || 4); }
  else if (shape === "dev") { m = new THREE.Mesh(new THREE.BoxGeometry(.5, .5, .5), new THREE.MeshLambertMaterial({ color: col, emissive: col, emissiveIntensity: .4 })); m.position.set(e.p[0], (e.p[1] || 0) + .3, e.p[2]); }
  else if (shape === "star") { m = new THREE.Mesh(new THREE.OctahedronGeometry(0.35), new THREE.MeshLambertMaterial({ color: col, emissive: col, emissiveIntensity: 0.5 })); m.position.set(e.p[0], (e.p[1] || 0) + 1.4, e.p[2]); }
  else if (shape === "orb") { m = new THREE.Mesh(orbGeo, new THREE.MeshLambertMaterial({ color: col, emissive: col, emissiveIntensity: .5 })); m.position.set(e.p[0], (e.p[1] || 0) + 1, e.p[2]); }
  else { m = jM(smokeGeo, xSmokeM("a18net" + (a18NetMesh.n = (a18NetMesh.n || 0) + 1), col, col)); m.material.opacity = op; m.position.set(e.p[0], (e.p[1] || 0) + 1.5, e.p[2]); m.scale.setScalar((e.r || 4) / 4); }
  try { const q = { x: e.p[0], y: e.p[1] || 0, z: e.p[2] }, yw = Number.isFinite(e.yaw) ? e.yaw : 0, dd = Array.isArray(e.d) ? { x: e.d[0], y: 0, z: e.d[2] } : { x: -Math.sin(yw), y: 0, z: -Math.cos(yw) }; let h = null;
    if (kind === "conting") h = isoxContingency(q, dd, { width: (e.r || 4) * 2, speed: A18C.conting.speed, life: Math.max(1, e.tl || 5) });
    else if (kind === "fastlane") h = neoxFastLane(q, yw, Math.max(1, e.tl || 6));
    else if (kind === "undercut") h = isoxUndercut(q, q, { flyT: 0.05, radius: e.r || 5 });
    else if (kind === "satur") h = wayxSaturate(q, q, { flyT: 0.05, radius: e.r || 4.5 });
    else if (kind === "gwell") h = asxGravityWell(q, e.r || 3.5, { delay: 0.05, life: Math.max(1, e.tl || 2) });
    else if (kind === "nova") h = asxNovaPulse(q, e.r || 4.5, { delay: Math.max(0.05, e.tl || 1) });
    else if (kind === "stim") h = brxStimBeacon(q, e.r || 4, Math.max(1, e.tl || 12));
    else if (kind === "orbital") h = brxOrbitalStrike(q, e.r || 5, { delay: 0.05, life: Math.max(1, e.tl || 4) });
    else if (kind === "nightfall" && Number.isFinite(e.yaw)) { jxBind(m, fdxNightfall({ x: q.x, y: q.y, z: q.z }, Math.atan2(dd.x, dd.z), 14, 9, 2.5), 1); }
    else if (kind === "bassq" && Number.isFinite(e.yaw)) { jxBind(m, mkxBassquake({ x: q.x, y: q.y + 1.2, z: q.z }, { x: dd.x, y: 0, z: dd.z }, A18C.bassq.dist), 1); }
    else if (kind === "sensor2") { jxBind(m, dlxSonicSensor({ x: q.x, y: q.y, z: q.z }, Math.max(1, e.tl || 30)), 1); }
    else if (kind === "pull") { const ou = typeof units !== "undefined" && e.o != null ? units.get(e.o) : null, og = ou && ou.g && ou.g.position; if (og) jxBind(m, hushxDisplacement({ x: og.x, y: og.y + 1.4, z: og.z }, { x: q.x, y: q.y, z: q.z }, { delay: Math.max(0.1, e.tl || 1) }), 1); }
    else if (kind === "seize") { jxBind(m, fdxSeizePool({ x: q.x, y: q.y, z: q.z }, e.r || 4, Math.max(1, e.tl || 5)), 1); }
    else if (kind === "mpulse") { jxBind(m, mkxMPulse({ x: q.x, y: q.y, z: q.z }, e.r || 5, Math.max(1, e.tl || 4)), 1); }
    else if (kind === "ceptor") { jxBind(m, vtxInterceptor({ x: q.x, y: q.y, z: q.z }, e.r || 4, Math.max(1, e.tl || 12)), 1); }
    else if (kind === "xcut") { jxBind(m, vtxCrosscut({ x: q.x, y: q.y, z: q.z }), 1); }
    else if (kind === "vine") { jxBind(m, vyxRazorvine({ x: q.x, y: q.y, z: q.z }, e.r || 4, Math.max(1, e.tl || 6)), 1); }
    else if (kind === "rose") { jxBind(m, vyxArcRose({ x: q.x, y: q.y, z: q.z }, Math.max(1, e.tl || 6)), 1); }
    else if (kind === "garden") { jxBind(m, vyxSteelGarden({ x: q.x, y: q.y, z: q.z }, e.r || 6, Math.max(1, e.tl || 4)), 1); }
    else if (kind === "shear") { jxBind(m, vyxShear({ x: q.x, y: q.y, z: q.z }, yw, 5, Math.max(1, e.tl || 5)), 1); }
    else if (kind === "mesh") { jxBind(m, dlxBarrierMesh({ x: q.x, y: q.y, z: q.z }, yw, (e.r || 3.75) * 2, Math.max(1, e.tl || 30)), 1); }
    else if (kind === "mosh") { jxBind(m, gkxMoshPool({ x: q.x, y: q.y, z: q.z }, e.r || 3.5, Math.max(1, e.tl || 3.6)), 1); }
    else if (kind === "gnet") { jxBind(m, dlxGravNet({ x: q.x, y: q.y, z: q.z }, e.r || 6, Math.max(1.2, e.tl || 8)), 1); }
    else if (kind === "cove") { jxBind(m, hbxCove({ x: q.x, y: q.y + 1.7, z: q.z }, e.r || 4.5, Math.max(1, e.tl || 10)), 0); }
    if (h) jxBind(m, h, 1); } catch (er) {}
  scene.add(m); return m;
}
function a18NetFree(r, cleared) { if (r.kind === "agentseeker") { try { (r.ag === "Fade" ? fdxEnd : gkxEnd)(r.h); } catch (e) {} return; } if (r.kind === "skseekLocal") return; if (r.kind === "harmon0") return; if (r.kind === "harmon") { try { mkxEnd(r.h); } catch (e) {} return; } if (r.kind === "skpop") return; /* burst only on the server dn:1 signal, never on a drop */ if (r.kind === "skhawk") { try { if (r.jx) skxEnd(r.jx); } catch (e) {} return; } if (r.kind === "haunt0") return; if (r.kind === "anni0") return; if (r.kind === "anni") { try { dlxEnd(r.h); } catch (e) {} return; } if (r.kind === "fdhaunt") { try { if (r.h) fdxEnd(r.h); } catch (e) {} return; } /* the pop is driven only by the server dn flag, never by the drop */ if (r.kind === "skseek") { try { skxEnd(r.h); } catch (e) {} return; } if (r.kind === "yoxd" || r.kind === "yoxf") { try { yoxEnd(r.h); (r.kind === "yoxd" ? yoxFakeoutPop : yoxBlindsidePop)(r.p); } catch (e) {} return; } if (r.kind === "blazeNet") { if (r.w) r.w.t = 0; return; } if (r.kind === "acid") { a18AcidFree(r.ac); return; } if (r.kind === "phxhh") { try { if (r.h) phxEnd(r.h); } catch (e) {} return; } if (r.kind === "phxrib") { try { if (r.h) phxEnd(r.h); } catch (e) {} return; } if (r.kind === "salvo") { for (const m of r.ms) jRel(m); return; } if (r.kind === "armag") { a18ArmagFree(r.ag); return; } if (!r.m) return; if (r.kind === "duel") a18ArenaFree(r.m); else jRel(r.m); }
function a18NetSync(rows) {
  const seen = new Set();
  for (const e of rows) { if (!e || e.kind !== "seeker" || (e.ag !== "Fade" && e.ag !== "Gekko") || !Number.isFinite(e.id) || !Array.isArray(e.p) || e.p.length !== 3 || !e.p.every(Number.isFinite) || !Number.isFinite(e.tl)) continue; seen.add(e.id); let r = a18Net.get(e.id);
    /* Explicit server agent identity, authoritative moving position; no impact on disappearance (expiry/death/reset are indistinguishable). A18 online casts are intent-only, so owner also draws the row. */
    if (!r) { let h = null; try { h = (e.ag === "Fade" ? fdxProwler : gkxWingman)(e.p[0], e.p[1] - 1, e.p[2], Number.isFinite(e.yaw) ? e.yaw : 0); } catch (er) {} if (!h) continue; r = { kind: "agentseeker", ag: e.ag, h, p: e.p.slice(), yaw: Number.isFinite(e.yaw) ? e.yaw : 0 }; a18Net.set(e.id, r); }
    const dx = e.p[0] - r.p[0], dz = e.p[2] - r.p[2]; if (Math.hypot(dx, dz) > 1e-5) r.yaw = Math.atan2(-dx, -dz); r.p = e.p.slice(); if (r.h && r.h.move) r.h.move(e.p[0], e.p[1] - 1, e.p[2], r.yaw); }
  for (const e of rows) { if (!e || e.kind !== "seeker" || e.ag !== "Skye" || !Number.isFinite(e.id) || !Array.isArray(e.p) || e.p.length !== 3 || !e.p.every(Number.isFinite) || !Number.isFinite(e.tl)) continue; seen.add(e.id); let r = a18Net.get(e.id);
    if (!r && typeof MP !== "undefined" && MP && e.o === MP.me && typeof RS !== "undefined" && RS.sk && RS.sk.some(s=>s && s.jx)) { a18Net.set(e.id, { kind: "skseekLocal" }); continue; } if(r && r.kind === "skseekLocal") { if(typeof RS !== "undefined" && RS.sk && RS.sk.some(s=>s && s.jx)) continue; a18Net.delete(e.id); r=null; } /* legacy local handle disappeared: reconstruct from the still-live authoritative row */
    if (!r) { const ou = typeof units !== "undefined" && e.o != null ? units.get(e.o) : null, og = ou && ou.g && ou.g.position, s0 = og ? [og.x, og.y + 1, og.z] : e.p.slice(); let h = null; try { h = skxSeeker(s0[0], s0[1], s0[2]); } catch (er) {} if (!h) continue; r = { kind: "skseek", h, s0, tl0: Math.max(0.05, e.tl) }; a18Net.set(e.id, r); }
    const k = Math.min(1, Math.max(0, 1 - e.tl / r.tl0)); if (r.h.move) r.h.move(r.s0[0] + (e.p[0] - r.s0[0]) * k, r.s0[1] + (e.p[1] - r.s0[1]) * k, r.s0[2] + (e.p[2] - r.s0[2]) * k); }
  for (const e of rows) { if (!e || e.kind !== "anni" || !Number.isFinite(e.id) || !Array.isArray(e.p) || e.p.length !== 3 || !e.p.every(Number.isFinite) || !Number.isFinite(e.tl)) continue; seen.add(e.id); let r = a18Net.get(e.id); /* Deadlock Annihilation cocoon: server row 'anni' follows the captive (p) and lives until detain end, a snap (death / lost line / out of range) or a kill; the module follows p and ends when the row drops. Own row: skipped only while the local cast's own cocoon is live (J.a18fx kind anni with jx); online the local cast finds no bots, so the caster sees it from the row. */
    if (r && r.kind === "anni0") continue;
    if (!r) { /* A18 online is intent-only, including after stale offline cocoon */ let h = null; try { h = dlxAnniCocoon({ x: e.p[0], y: e.p[1], z: e.p[2] }, Math.max(0.8, e.tl)); } catch (er) {} if (!h) continue; r = { kind: "anni", h }; a18Net.set(e.id, r); }
    if (r.h && r.h.setPos) r.h.setPos({ x: e.p[0], y: e.p[1], z: e.p[2] }); }
  for (const e of rows) { if (!e || e.kind !== "haunt" || !Number.isFinite(e.id) || !Array.isArray(e.p) || e.p.length !== 3 || !e.p.every(Number.isFinite) || !Number.isFinite(e.tl)) continue; seen.add(e.id); let r = a18Net.get(e.id);
    /* Fade Haunt: the server keeps the row until the mark time ends and sets dn:1 once the 0.4 s windup has fired (the pop). Orb flies owner -> p before dn; the burst plays on the first row with dn (explicit signal, once). A row that drops without dn (reset, cancel, death) ends silently. Own rows are authoritative too (A18 online input is intent-only). */
    /* Fade is A18: its online input sends intent without running the offline cast, so the owner needs the same authoritative row visual. */
    if (!r) { if (e.dn) { a18Net.set(e.id, { kind: "fdhaunt", h: null, s0: null, t0: e.tl, p: e.p.slice(), popped: true }); try { fdxHauntBurst({ x: e.p[0], y: e.p[1], z: e.p[2] }); } catch (er) {} continue; } /* first seen after the pop: burst now, no orb */
      const ou = typeof units !== "undefined" && e.o != null ? units.get(e.o) : null, og = ou && ou.g && ou.g.position, s0 = og ? [og.x, og.y + 1.4, og.z] : [e.p[0], e.p[1] + 1.4, e.p[2]]; let h = null; try { h = fdxHauntOrb(s0[0], s0[1], s0[2]); } catch (er) {} if (!h) continue; r = { kind: "fdhaunt", h, s0, t0: e.tl, p: e.p.slice(), popped: false }; a18Net.set(e.id, r); }
    if (e.dn && !r.popped) { r.popped = true; try { if (r.h) fdxEnd(r.h); r.h = null; fdxHauntBurst({ x: e.p[0], y: e.p[1], z: e.p[2] }); } catch (er) {} }
    else if (!r.popped && r.h && r.h.move) { const k = Math.min(1, Math.max(0, (r.t0 - e.tl) / 0.4)); r.h.move(r.s0[0] + (e.p[0] - r.s0[0]) * k, r.s0[1] + (e.p[1] + 1.4 - r.s0[1]) * k, r.s0[2] + (e.p[2] - r.s0[2]) * k); } }
  for (const e of rows) { if (!e || e.kind !== "blast" || (e.ag !== "Clove" && e.ag !== "Harbor") || !Number.isFinite(e.id) || !Array.isArray(e.p) || e.p.length !== 3 || !e.p.every(Number.isFinite)) continue; seen.add(e.id); let r = a18Net.get(e.id);
    /* Clove Meddle / Harbor Storm Surge: the server blast row carries ag + the explicit impact flag dn:1 (it lingers 0.25 s). The module splash plays once on dn, never on a drop (cancel/reset/death stay silent). The owner uses the authoritative row too; the legacy ring is not built for these rows. */
    if (!r) { r = { kind: "cvmed", done: false }; a18Net.set(e.id, r); } /* authoritative online casts do not run the offline kit branch: owner also needs the row splash */
    if (e.dn && !r.done) { r.done = true; try { (e.ag === "Harbor" ? hbxSurge : cvxMeddleBurst)({ x: e.p[0], y: e.p[1], z: e.p[2] }, e.r || 4.5); } catch (er) {} } }
  for (const e of rows) { if (e && e.kind === "duel" && Number.isFinite(e.id) && Array.isArray(e.p) && e.p.length === 3) { seen.add(e.id); if (!a18Net.has(e.id)) a18Net.set(e.id, { m: a18ArenaShell(e.p[0]), kind: "duel" }); continue; }
    if (e && e.kind === "armag" && Number.isFinite(e.id) && Array.isArray(e.p) && e.p.length === 3 && Number.isFinite(e.yaw) && Number.isFinite(e.tl)) { seen.add(e.id); let r = a18Net.get(e.id); if (!r) { r = { kind: "armag", ag: a18ArmagGroup(e.p[0], e.p[2], -Math.sin(e.yaw), -Math.cos(e.yaw), true) }; a18Net.set(e.id, r); } const AG = A18C.armag, el = AG.wind + (AG.segs - 1) * AG.gap + AG.ticks * AG.tick + 0.2 - e.tl; let spawned = 0; for (let i = 0; i < AG.segs; i++) for (let j = 0; j < AG.ticks; j++) { const id = i * AG.ticks + j, dt0 = el - (AG.wind + i * AG.gap + j * AG.tick); if (dt0 < 0 || r.ag.fired[id]) continue; r.ag.fired[id] = 1; if (dt0 > 0.6 || spawned > 6) continue; spawned++; const fw = [-Math.sin(e.yaw), -Math.cos(e.yaw)]; for (let b = 0; b < 2; b++) { const f = (i + Math.random()) * AG.seg, sd = (Math.random() - 0.5) * (AG.w - 2), x = e.p[0] + fw[0] * f - fw[1] * sd, z = e.p[2] + fw[1] * f + fw[0] * sd; let gy = 0; try { const g = groundAt(x, z, 0.3, typeof player !== "undefined" ? player.y : 3); if (Number.isFinite(g)) gy = g; } catch (err) {} a18ArmagBoom(x, gy, z); } } continue; }
    if (e && (e.kind === "salvo" || e.kind === "frag") && Number.isFinite(e.id) && Array.isArray(e.p) && e.p.length === 3 && Number.isFinite(e.tl)) { seen.add(e.id); const S = e.kind === "frag" ? A18C.frag : A18C.salvo; let r = a18Net.get(e.id); if (!r) { const ms = []; for (const [rad, op] of [[S.r, 0.35], [S.inner, 0.55]]) { const m = a18Ring({ x: e.p[0], z: e.p[2] }, rad, e.kind === "frag" ? 0xffa03a : 0xff6a3a, op); try { const gy = groundAt(e.p[0], e.p[2], 0.3, e.p[1] + 1); if (Number.isFinite(gy)) m.position.y = gy + 0.05; } catch (err) {} ms.push(m); } r = { kind: "salvo", ms, n: 0 }; a18Net.set(e.id, r); }
      const el = e.w > 0 ? -e.w : S.pulses * S.gap + 1 - e.tl; /* both rows last pulses*gap+1 s after landing */ while (r.n < S.pulses && el >= r.n * S.gap) { r.n++; let gy = e.p[1]; try { const g = groundAt(e.p[0], e.p[2], 0.3, e.p[1] + 1); if (Number.isFinite(g)) gy = g; } catch (err) {} a18ArmagBoom(e.p[0], gy, e.p[2], e.kind === "frag" ? 0.8 : 1.3); } continue; }
    if (e && e.kind === "paths" && Number.isFinite(e.id) && Array.isArray(e.p) && e.p.length === 3 && Number.isFinite(e.yaw)) { seen.add(e.id); let r = a18Net.get(e.id); if (!r) { const L = e.len || A18C.cpaths.len, W = e.w || A18C.cpaths.w, m = new THREE.Mesh(new THREE.PlaneGeometry(W, L), new THREE.MeshBasicMaterial({ color: 0xf0c04a, transparent: true, opacity: 0.35, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending })); m.rotation.set(-Math.PI / 2, 0, 0); m.rotateOnWorldAxis(new THREE.Vector3(0, 1, 0), e.yaw); m.position.set(e.p[0] - Math.sin(e.yaw) * L / 2, (e.p[1] || 0) + 0.1, e.p[2] - Math.cos(e.yaw) * L / 2); scene.add(m); r = { m, kind: "paths", t0: performance.now() }; a18Net.set(e.id, r); } const age = (performance.now() - r.t0) / 1000; r.m.visible = age < 2; r.m.material.opacity = 0.35 * Math.max(0, 1 - age / 2); continue; }
    if (e && e.kind === "fire" && e.ag === "Phoenix" && Number.isFinite(e.id) && Array.isArray(e.p) && e.p.length === 3 && e.p.every(Number.isFinite) && Number.isFinite(e.tl)) { seen.add(e.id); /* Phoenix Hot Hands (server row: fu full radius, gr spread time, age since cast, tl left): persistent row-bound module pool rebuilt at the row's current age (late join / reconnect: no placement replay), ended when the row drops (cancel / reset / expiry). The caster's own cast already drew its local pool. */ if (!a18Net.has(e.id)) { const own = typeof MP !== "undefined" && MP && e.o != null && e.o === MP.me; let h = null; if (!own && typeof phxHotHands === "function") { try { const ag0 = Number.isFinite(e.age) && e.age > 0 ? Math.min(e.age, 30) : 0, gy = groundAt(e.p[0], e.p[2], 0.3, e.p[1] + 1); h = phxHotHands({ x: e.p[0], y: Number.isFinite(gy) ? gy : e.p[1], z: e.p[2] }, e.fu || 4.5, ag0 + e.tl, e.gr || 0.75); if (h && h.fx) h.fx.age = ag0; } catch (er) {} } a18Net.set(e.id, { kind: "phxhh", h }); } continue; }
    if (e && e.kind === "rib" && Number.isFinite(e.id) && Array.isArray(e.p) && e.p.length === 3 && e.p.every(Number.isFinite) && Number.isFinite(e.tl)) { seen.add(e.id); /* Phoenix Run It Back marker (server state row: p = the cast point, lives until the return / death / reset): row-bound, rebuilt for a late join, ended with the row. The return / death bursts are the server's 'return' / 'retdeath' cast events (mpCastFx). Own: the local ult draws its own. */ if (!a18Net.has(e.id)) { const own = typeof MP !== "undefined" && MP && e.o != null && e.o === MP.me; let h = null; if (typeof phxRibMarker === "function") { try { h = phxRibMarker({ x: e.p[0], y: e.p[1], z: e.p[2] }, Math.max(0.5, e.tl)); } catch (er) {} } a18Net.set(e.id, { kind: "phxrib", h }); } continue; }
    if (e && e.kind === "snake" && Number.isFinite(e.id) && Array.isArray(e.p) && e.p.length === 3) { seen.add(e.id); if (!a18Net.has(e.id)) { let gy = e.p[1]; try { const g = groundAt(e.p[0], e.p[2], 0.3, e.p[1] + 1); if (Number.isFinite(g)) gy = g; } catch (err) {} a18Net.set(e.id, { kind: "acid", ac: a18AcidPool(e.p[0], gy, e.p[2], e.r || 4, 99, true) }); } continue; }
    if (e && e.kind === "blaze" && typeof MP !== "undefined" && MP && e.o != null && e.o === MP.me) { seen.add(e.id); if (!a18Net.has(e.id)) a18Net.set(e.id, { kind: "blazeNet", w: null }); continue; } /* own Blaze: the local cast already drew this wall (ci16: two walls on the caster) */
    if (e && e.kind === "blaze" && Number.isFinite(e.id) && Array.isArray(e.p) && e.p.length === 3 && Array.isArray(e.q) && e.q.length === 3 && Number.isFinite(e.tl)) { seen.add(e.id); if (!a18Net.has(e.id)) { /* Phoenix Blaze (server row, visual only: nd = no local damage / heal): p is 1 m ahead of his feet, q the far end */ const dx = e.q[0] - e.p[0], dz = e.q[2] - e.p[2], l = Math.hypot(dx, dz) || 1, fx = dx / l, fz = dz / l; let w = null; try { w = blazeWall(e.p[0] - fx, e.p[1], e.p[2] - fz, fx, fz, { own: player, en: false, nd: true, net: 1, len: l + 1 }); if (w) w.t = Math.max(0.1, e.tl); } catch (err) { xE(err); } a18Net.set(e.id, { kind: "blazeNet", w }); } continue; }
    if (e && e.kind === "quake" && Number.isFinite(e.id) && Array.isArray(e.p) && e.p.length === 3 && Number.isFinite(e.yaw) && Number.isFinite(e.tl)) { seen.add(e.id); let r = a18Net.get(e.id); if (!r) { r = { kind: "quake", n: 0 }; a18Net.set(e.id, r); }
      const Q = { ticks: 8, gap: 0.255, near: 8, len: 32, w: 18 }, seg = Q.len / Q.ticks, el = e.w > 0 ? -e.w : Q.ticks * Q.gap + 0.3 - e.tl, fx = -Math.sin(e.yaw), fz = -Math.cos(e.yaw); /* Rolling Thunder: one blast per 4 m slice, 0.255 s apart (wiki), as the offline bcSlice */
      while (r.n < Q.ticks && el >= r.n * Q.gap) { const i = r.n++; if (el - i * Q.gap > 0.6) continue; const lo = Q.near + seg * i, cx = e.p[0] + fx * (lo + seg / 2), cz = e.p[2] + fz * (lo + seg / 2); let gy = e.p[1]; try { const g = groundAt(cx, cz, 0.3, e.p[1] + 1); if (Number.isFinite(g)) gy = g; } catch (err) {}
        try { a18QuakeBlast(cx, gy, cz, e.yaw, Q.w, seg); blip(60, 0.5, "sawtooth", 0.15); } catch (err) {} }
      continue; }
    if (e && e.kind === "harmon" && Number.isFinite(e.id) && Array.isArray(e.p) && e.p.length === 3 && e.p.every(Number.isFinite) && Number.isFinite(e.tl)) { seen.add(e.id); /* Miks Harmonize: one server row per buffed unit (tg), p follows the unit; ends with the buff, death or reset. The buffed player gets the screen tint + pillar, everyone else a pillar. The caster's own local cast already draws its own pillar+veil. */ let r = a18Net.get(e.id); if (!r) { const me = typeof MP !== "undefined" && MP ? MP.me : null, mine = e.tg != null && e.tg === me, loc = false; /* A18 intent-only online route does not create local Harmonize */ if (loc) { r = { kind: "harmon0" }; } else { let h = null; try { h = mkxHarmonize({ x: e.p[0], y: e.p[1], z: e.p[2] }, null, Math.max(1, e.tl), { local: mine }); } catch (er) {} r = { kind: "harmon", h }; } a18Net.set(e.id, r); } if (r.h && r.h.setTargets) r.h.setTargets({ x: e.p[0], y: e.p[1], z: e.p[2] }, null); continue; }
    if (e && e.kind === "hawk" && Number.isFinite(e.id) && Array.isArray(e.p) && e.p.length === 3 && e.p.every(Number.isFinite)) { seen.add(e.id); /* Guiding Light hawk: server-simulated straight flight (abilities.js tickHawks); row drops when popped (re-use / end of life / owner death). Own hawk is the local RS.hk, skipped. */ let r = a18Net.get(e.id); if (!r) { const own = typeof MP !== "undefined" && MP && e.o != null && e.o === MP.me; let jx = null; if (!own) { const hd = Array.isArray(e.hd) ? e.hd : [0, 0, -1]; try { jx = skxHawk(e.p[0], e.p[1], e.p[2], Math.atan2(-hd[0], -hd[2])); } catch (er) {} } r = { kind: "skhawk", jx, hd: Array.isArray(e.hd) ? e.hd : [0, 0, -1] }; a18Net.set(e.id, r); } if (r.jx && r.jx.move) r.jx.move(e.p[0], e.p[1], e.p[2], Math.atan2(-r.hd[0], -r.hd[2])); continue; }
    if (e && e.kind === "flash" && e.ag === "Skye" && Number.isFinite(e.id) && Array.isArray(e.p) && e.p.length === 3 && e.p.every(Number.isFinite)) { seen.add(e.id); /* Guiding Light flash windup (server fa = seconds to detonation): the burst fires when the row drops at detonation (a round reset or clear does not burst); own caster's local hawk already bursts */ let r = a18Net.get(e.id); if (!r) { r = { kind: "skpop", p: e.p.slice(), own: typeof MP !== "undefined" && MP && e.o != null && e.o === MP.me, burst: 0 }; a18Net.set(e.id, r); } if (e.dn === 1 && !r.burst) { r.burst = 1; if (!r.own) { try { skxHawkFlash({ x: e.p[0], y: e.p[1], z: e.p[2] }); } catch (er) {} } } continue; }
    if (e && ((e.kind === "decoy" && e.ag === "Yoru") || (e.kind === "flash" && e.ag === "Yoru")) && Number.isFinite(e.id) && Array.isArray(e.p) && e.p.length === 3) { seen.add(e.id); const dec = e.kind === "decoy"; let r = a18Net.get(e.id); if (!r) { let h = null; try { if (dec) yoxFakeoutSpawn(e.p); h = dec ? yoxFakeoutFigure() : yoxBlindsideOrb(); } catch (er) {} r = { kind: dec ? "yoxd" : "yoxf", h, p: e.p.slice() }; a18Net.set(e.id, r); }
      r.p = e.p.slice(); try { const o = r.h && r.h.fx && r.h.fx.objs && r.h.fx.objs[0]; if (o) { if (r.kind === "yoxd") { o.position.set(e.p[0], groundAt(e.p[0], e.p[2], 0.3, e.p[1] + 1) || 0, e.p[2]); if (e.d) o.rotation.y = Math.atan2(e.d[0], e.d[2]); } else o.position.set(e.p[0], (e.p[1] || 0) + 1, e.p[2]); } } catch (er) {} continue; }
    if (e && e.kind === "seeker" && (e.ag === "Skye" || e.ag === "Fade" || e.ag === "Gekko") && a18Net.has(e.id)) continue; if (e && e.kind === "haunt" && a18Net.has(e.id)) continue; if (e && e.kind === "blast" && (e.ag === "Clove" || e.ag === "Harbor")) continue; if (e && e.kind === "anni" && a18Net.has(e.id)) continue; if (!e || !A18VIS[e.kind] || !Number.isFinite(e.id) || !Array.isArray(e.p) || e.p.length !== 3) continue; seen.add(e.id);
    if (!e || !A18VIS[e.kind] || !Number.isFinite(e.id) || !Array.isArray(e.p) || e.p.length !== 3) continue; seen.add(e.id);
    let r = a18Net.get(e.id); if (!r) { r = { m: a18NetMesh(e.kind, e), kind: e.kind }; a18Net.set(e.id, r); }
    else if (r.m) { const k = A18VIS[e.kind][0]; if (k === "orb" || k === "wave" || k === "dev" || k === "star") r.m.position.set(e.p[0], k === "orb" ? (e.p[1] || 0) + 1 : k === "star" ? (e.p[1] || 0) + 1.4 : r.m.position.y === 1.1 ? 1.1 : (e.p[1] || 0) + .3, e.p[2]); else r.m.position.x = e.p[0], r.m.position.z = e.p[2]; if (Number.isFinite(e.yaw) && k === "wall") r.m.rotation.y = -e.yaw; } }
  for (const [id, r] of a18Net) if (!seen.has(id)) { a18NetFree(r); a18Net.delete(id); }
}
const a18FxSync0 = netSyncEffects; netSyncEffects = function (rows) { a18FxSync0(rows); try { a18NetSync(rows); } catch (e) { xE(e); } };
var a18EvoVeil = null;
function a18EvoSync(st) { const t = st && Number.isFinite(st.evo) ? Math.max(0, Math.min(60, st.evo)) : 0;
  if (!(NET.socket && J.pick === "Veto" && player.hp > 0 && t > 0)) { if (a18EvoVeil) { a18EvoVeil.end(); a18EvoVeil = null; } return; }
  if (a18EvoVeil && vtxLive.indexOf(a18EvoVeil.fx) < 0) a18EvoVeil = null;
  if (!a18EvoVeil) a18EvoVeil = vtxVeil("Evo", t);
  if (a18EvoVeil && a18EvoVeil.fx) { a18EvoVeil.fx.age = Math.max(0, a18EvoVeil.fx.ttl - t); }
}
const a18ClearFx0 = netClearEffects; netClearEffects = function () { a18ClearFx0(); if (a18EvoVeil) { a18EvoVeil.end(); a18EvoVeil = null; } for (const [, r] of netTb) { try { skxEnd(r.h); } catch (e) {} } netTb.clear(); for (const [, h] of netWf) { try { mkxEnd(h); } catch (e) {} } netWf.clear(); for (const [, r] of a18Net) a18NetFree(r, true); a18Net.clear(); };
// rs status: suppress (abilities locked), jam (devices jammed), hinder (slow), haste, stim, decaying HP
const a18Chips0 = netStatusChips; netStatusChips = function (st) {
  a18EvoSync(st); const on = a18Chips0(st); let el = document.getElementById("netSt");
  if (st.supp > 0) on.push("SUPPRESSED " + st.supp.toFixed(1) + "s");
  if (st.jam > 0) on.push("JAMMED " + st.jam.toFixed(1) + "s");
  if (st.hind > 0) { on.push("HINDERED " + st.hind.toFixed(1) + "s"); player.tagT = Math.max(player.tagT || 0, st.hind); if (!(player.tagK > 0 && player.tagK <= .5)) { player.tagK = .5; player.tagS = 0; } }
  if (st.haste > 0) on.push("HASTE " + st.haste.toFixed(1) + "s");
  if (st.stim > 0) on.push("STIM");
  if (st.decay > 0) on.push("DECAYING " + Math.round(st.decay) + " HP");
  if (st.deaf > 0) { on.push("DEAFENED " + st.deaf.toFixed(1) + "s"); if (typeof a18Deafen === "function") a18Deafen(st.deaf); }
  if (!el && on.length) { el = document.body.appendChild(document.createElement("div")); el.id = "netSt"; el.className = "x-nst"; }/* the base returns early when only an agents18 status is up */
  if (el) { el.textContent = on.join(" \u00b7 "); el.style.display = on.length ? "block" : "none"; }
  return on;
};
// Only triangle rays, no nav/ground fallback, matching the server terrain API.
function a18MeshWorld(){return {ray:(o,d,max)=>{const h=xBoltRay(o,d,max);return h?h.distance:Infinity;},rayN:(o,d,max)=>xBoltRay(o,d,max)};}
function a18MeshPlan(o,d){return BarrierMesh.flight(o,d,a18MeshWorld(),SovaBolt);}
// Offline shared-mesh consumer. Creation stays explicit until throw/cast migration is complete.
var a18Meshes=[];
function a18MeshDrop(e){if(!e)return;try{e.h.end();}catch(er){}for(const m of e.hitboxes){scene.remove(m);const i=XLDH.indexOf(m);if(i>=0)XLDH.splice(i,1);m.geometry.dispose();m.material.dispose();}const i=a18Meshes.indexOf(e);if(i>=0)a18Meshes.splice(i,1);}
function a18MeshSync(e){e.h.update(e.state);e.hitboxes.forEach((m,i)=>{const n=e.state.nodes[i];m.visible=!!n&&n.hp>0&&!e.state.dead;});}
function a18MeshCreate(p,yaw,world,en=false){const state=BarrierMesh.create(p,yaw,BarrierMesh.terrainResolver(world)),h=dlxBarrierState(state);if(!h)throw Error('Barrier Mesh renderer failed');const e={state,h,hitboxes:[],en};
 try{for(let i=0;i<5;i++){const n=state.nodes[i],m=new THREE.Mesh(new THREE.SphereGeometry(n?n.r:.2,12,8),new THREE.MeshBasicMaterial({transparent:true,opacity:0,depthWrite:false}));
   if(n)m.position.set(n.p[0],n.p[1]+BarrierMesh.C.nodeLift,n.p[2]);
   const ld={};Object.defineProperty(ld,'hp',{get:()=>state.nodes[i]?.hp||0,set:value=>{const n=state.nodes[i];if(n&&Number.isFinite(value)&&value<n.hp){BarrierMesh.damage(state,i,n.hp-value);a18MeshSync(e);}}});m.userData.ld=ld;m.userData.meshNode=i;const cast=m.raycast;m.raycast=function(rc,out){if(!state.dead&&state.nodes[i]?.hp>0)return cast.call(this,rc,out);};e.hitboxes.push(m);scene.add(m);XLDH.push(m);m.updateMatrixWorld(true);}
  a18Meshes.push(e);a18MeshSync(e);return e;
 }catch(er){a18MeshDrop(e);throw er;}}
{const reset=a18Reset;a18Reset=function(){while(a18Meshes.length)a18MeshDrop(a18Meshes[a18Meshes.length-1]);return reset.apply(this,arguments);};
 const tick=a18Tick;a18Tick=function(dt){for(const e of [...a18Meshes]){BarrierMesh.advance(e.state,e.state.age+dt);if(e.state.dead)a18MeshDrop(e);else a18MeshSync(e);}return tick.apply(this,arguments);};
 const block=sgBlk;sgBlk=function(x,z,r,y){if(!(typeof NET!=='undefined'&&NET.socket))for(const e of a18Meshes)if(BarrierMesh.blocked(e.state,x,z,r,y||0,1.8))return true;return block.apply(this,arguments);};}
// Include opposing offline meshes in the existing bot utility choice, never as opaque LOS solids.
{const candidates=xUtilCands;xUtilCands=function(en){const L=candidates.apply(this,arguments);for(const e of a18Meshes){if(e.en===undefined||e.en===en||e.state.dead)continue;const n=e.state.nodes[0];L.push({kind:'barrier',o:e,bm:e.state,x:n.p[0],y:n.p[1],z:n.p[2],d:0,los:false,blocking:false,hit:(amount,index)=>{BarrierMesh.damage(e.state,index,amount);a18MeshSync(e);}});}return L;};}
// ---- END AGENTS 18 ----
