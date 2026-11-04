// ---- AGENTS 18 ----
// Offline client behavior for the 18 agents added 2026-11-03 (Astra, Brimstone, Clove, Harbor, Miks, Viper, Hush,
// Iso, Neon, Waylay, Yoru, Fade, Gekko, KAY/O, Tejo, Deadlock, Veto, Vyse). Mirrors server/src/agents18.js (same
// wiki.playvalorant.com constants, fetched 2026-11-03); known deviations are listed in work/agents18-notes.md.
const A18SET = new Set(["Astra", "Brimstone", "Clove", "Harbor", "Miks", "Viper", "Hush", "Iso", "Neon", "Waylay", "Yoru", "Fade", "Gekko", "KAY/O", "Tejo", "Deadlock", "Veto", "Vyse"]);
const A18C = { star: { wellPull: 2, wellVuln: 2, wellR: 3.5, novaDelay: 1.25, novaConcuss: 4, novaR: 4.5, nebulaLife: 14.25, nebulaR: 4.1, divideLife: 21, placeR: 2.5, selectR: 6, dissipateDelay: 1.25, fakeNebula: 0.75 },
 stim: { life: 12.5, r: 4 }, incend: { life: 7, r: 4.5, rate: 60 }, skysmoke: { life: 19.25, r: 4.15 }, orbital: { delay: 2, life: 4, r: 5, dps: 150 },
 pmu: { haste: 4, overheal: 50, window: 12 }, meddle: { r: 4.5, decay: 70 }, ruse: { life: 12.75, r: 4.15 }, ndy: { channel: 3.3, window: 12 },
 surge: { r: 4.5, near: 2, slow: 2 }, tide: { dist: 45, life: 12, slow: 2, w: 2, speed: 6 }, cove: { life: 12, r: 4.1 }, reckon: { dist: 30, near: 3, slow: 4, speed: 7 },
 mpulse: { life: 6, r: 6, concuss: 2.5, heal: 40 }, harmon: { life: 8 }, waveform: { life: 14, r: 4.15 }, bassq: { dist: 40, w: 46, slow: 8, knock: 5, deafen: 8 }, /* wiki: 40 m 60 deg cone, 5 m knock, 8 s deafen + slow */
 snake: { life: 6.5, r: 4, rate: 20 }, fuel: { max: 100, drain: 8, regen: 20 }, pcloud: { r: 4.15 }, tscreen: { len: 30 }, pit: { r: 9, decay: 30 },
 flow: { delay: 1.1, speed: 22 }, flashb: { blind: 1.6, delay: 1 }, displ: { r: 5, pull: 6, delay: 1 }, susp: { speed: 12, life: 4, lev: 3, r: 4 },
 conting: { dist: 30, speed: 6, w: 8, life: 8 }, undercut: { r: 5, supp: 4, vuln: 4 }, dtap: { life: 20 }, kc: { range: 40, w: 4, duel: 13, supp: 4 },
 fastlane: { dist: 30, life: 6 }, relay: { r: 4.5, concuss: 3.5 }, gear: { drain: 10, regen: 20 }, od: { life: 10, dps: 150 },
 satur: { r: 4.5, hinder: 4 }, ls: { dash: 9, time: 0.35 }, refract: { life: 20, travel: 0.6 }, cpaths: { dist: 20, w: 10, haste: 3, hinder: 4 },
 fakeout: { life: 10, speed: 4.5 }, blindside: { blind: 1.5, delay: 0.6 }, gcrash: { life: 20, range: 30 }, drift: { life: 10 },
 prowler: { life: 3, speed: 9, near: 2.5 }, seize: { r: 4.5, tether: 4, decay: 70 }, haunt: { r: 25, reveal: 12 }, nightfall: { dist: 25, w: 14, decay: 70 },
 mosh: { r: 5, life: 3, dps: 20, boom: 70 }, wing: { life: 5, speed: 9, concuss: 3.5 }, dizzy: { life: 2.5, blind: 1.5, r: 15 }, thrash: { r: 6, detain: 6 }, globule: { reclaim: 10 },
 frag: { r: 4, inner: 1, pulses: 4, gap: 1, dmg: 60, dmgOut: 25, wind: 0.5 }, fdrive: { blind: 2.25, delay: 1.6 }, zero: { r: 15, supp: 8 }, nullcmd: { life: 10, pulse: 3, r: 20 },
 sdrone: { life: 8, r: 12, reveal: 3, supp: 6 }, sd: { r: 4, concuss: 3, dmg: 40 }, salvo: { r: 4.5, inner: 2.5, pulses: 3, gap: 0.8, dmg: 65, dmgOut: 50, wind: 1.25, fly: 30 }, armag: { len: 32, w: 12, dmg: 60, segs: 16, seg: 2, ticks: 4, tick: 0.25, gap: 0.25, wind: 3.08 },
 mesh: { life: 30, len: 7.5 }, sensor: { life: 30, r: 8, concuss: 3 }, gnet: { r: 6, life: 8 }, annih: { range: 20, detain: 7 },
 xcut: { range: 25 }, choke: { life: 30, r: 6, decay: 60, slow: 2 }, cept: { life: 30, r: 10 }, evo: { life: 12, hps: 10 },
 vine: { life: 30, r: 6, dps: 15 }, shear: { life: 30, r: 2.5, wall: 8 }, rose: { life: 30, blind: 2, r: 20 }, garden: { r: 20, jam: 8 } };
J.a18 = null; // per-agent state (stars, fuel, anchors, slides), reset by a18Reset on the pick / round reset hooks
function a18Reset() { const a = J.pick; J.a18 = { starList: [], starBack: 0, stars: a === "Astra" ? 2 : 0, fuel: a === "Viper" || a === "Neon" ? A18C.fuel.max : 0, slides: 1, slideK: 0, /* wiki v9.11: one slide charge */ cloud: 0, screen: 0, pit: 0, gate: 0, gateTp: 0, mark: 0, rose: 0, xcut: 0, gear: 0, drift: 0, od: 0, evo: 0, shield: 0, duel: 0, ndyT: 0, haste: 0, stim: 0, decay: 0, decayAmt: 0, jam: 0, supp: 0 }; }
function a18Aim(dist) { const o = pEye(), d = jAim(); ray.set(o, d); ray.far = dist || 14; const h = ray.intersectObjects(solids)[0]; const t = h ? Math.max(0, h.distance - 0.5) : (dist || 14); const p = o.clone().addScaledVector(d, t); p.y = Math.max(0.05, p.y); return p; }
function a18Smoke(p, dur, r, c1, c2) { const m = jM(smokeGeo, xSmokeM("a18" + (a18Smoke.n = (a18Smoke.n || 0) + 1), c1, c2)); m.position.set(p.x, p.y + 1.7, p.z); scene.add(m); J.smokes.push({ m, p: m.position, t: dur, r: xSmk(m, r) }); SFX.smoke(); return m; }
function a18Zone(p, life, r, rate, name, col) { const m = jM(zoneGeo, fireMat(col || 0xff5a1a, 0.55)); m.rotation.x = -Math.PI / 2; m.position.set(p.x, 0.05, p.z); m.scale.setScalar(r / 2.5); scene.add(m); J.zones.push({ m, p: p.clone(), t: life, R: 0, r0: r, rate, name }); return m; }
function a18Fx(o) { (J.a18fx = J.a18fx || []).push(o); return o; }
function a18Deafen(sec) { try { if (typeof ac === "undefined" || !ac || typeof master === "undefined" || !master) return; const t = ac.currentTime; master.gain.cancelScheduledValues(t); master.gain.setValueAtTime(0.0001, t); master.gain.setValueAtTime(S.muted ? 0 : S.vol / 100, t + sec); } catch (e) {} }/* Bassquake deafen: the mix ducks for the duration (wiki: deafened) */
function a18Orb(p, delay, fn) { const m = jM(orbGeo, xAdd("a18orb" + (a18Fx.n = (a18Fx.n || 0) + 1), 0xfff6e8, 1)); m.position.copy(p); scene.add(m); a18Fx({ m, t: delay, pop: fn }); }
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
    if (k === "c") a18Fx({ kind: "gwell", p: q, t: 0.75, life: C.star.wellPull, m: a18Ring(q, C.star.wellR, 0x8a6af0, 0.6) });
    else if (k === "q") a18Fx({ kind: "nova", p: q, t: C.star.novaDelay, m: a18Ring(q, C.star.novaR, 0xb08af0, 0.6) });
    else a18Smoke(q, C.star.nebulaLife, C.star.nebulaR, 0x7a4fd0, 0xc9a8f2);
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
  if (a === "Vyse" && k === "e" && A.rose) { const p = A.rose; A.rose = 0; a18Blind(p, C.rose.blind); SFX.flash(); return true; }
  if (a === "Veto" && k === "c" && A.xcut) { P.x = A.xcut.x; P.z = A.xcut.z; P.y = A.xcut.y; A.xcut = 0; SFX.ab("dash"); return true; }
  if (a === "Waylay" && k === "e" && A.mark) { P.x = A.mark.x; P.y = A.mark.y; P.z = A.mark.z; A.mark = 0; J.e = 0; SFX.ab("dash"); return true; }
  if (a === "Yoru" && k === "e" && A.gate && !(A.gateTp > 0)) { A.gateTp = 1.2; say("Gatecrash", 700); return true; } /* wiki: 1.2 s total (0.5 s windup + 0.7 s arrival); the move lands in a18Tick */
  if (a === "Neon" && k === "e" && A.gear > 0) { if (A.slides > 0) { A.slides--; A.gear = 0; J.dash = jDash(); SFX.ab("dash"); /* the slide ends High Gear (wiki); firing during it is allowed (v8.11) */ } return true; }
  if (!chargeOk || J.cd[k] > 0) return no();
  const p = a18Aim(14), d = jAim();
  const spend = () => { if (k === "x") J.ult = 0; else if (a === "Astra") A.stars--; else J[k]--; J.cd[k] = 0.6; };
  switch (a) {
    case "Astra": {
      if (k === "x") { spend(); const m = a18Ring(new THREE.Vector3(P.x, 0, P.z), 30, 0x9a6ff0, 0.5); a18Fx({ kind: "div", m, t: C.star.divideLife }); SFX.ab("updraft"); return true; }
      const s0 = a18StarNear(p.x, p.z, 1e9); // c/q/e activate the placed Star nearest the crosshair (wiki Stars)
      if (!s0) return no();
      a18StarDrop(s0); const q = new THREE.Vector3(s0.x, s0.y || 0, s0.z);
      if (k === "c") a18Fx({ kind: "gwell", p: q, t: 0.75, life: C.star.wellPull, m: a18Ring(q, C.star.wellR, 0x8a6af0, 0.6) });
      else if (k === "q") a18Fx({ kind: "nova", p: q, t: C.star.novaDelay, m: a18Ring(q, C.star.novaR, 0xb08af0, 0.6) });
      else a18Smoke(q, C.star.nebulaLife, C.star.nebulaR, 0x7a4fd0, 0xc9a8f2);
      SFX.ab("updraft"); return true; }
    case "Brimstone": { spend();
      if (k === "c") { const m = a18Ring(p, C.stim.r, 0xffc04a, 0.5); a18Fx({ kind: "stimz", m, p, t: C.stim.life }); }
      else if (k === "q") a18Zone(p, C.incend.life, C.incend.r, C.incend.rate, "Incendiary");
      else if (k === "e") a18Smoke(p, C.skysmoke.life, C.skysmoke.r, 0x8a929a, 0xd0c8b8);
      else { const m = a18Ring(p, C.orbital.r, 0xff7a2a, 0.8); a18Fx({ kind: "orbital", m, p, t: C.orbital.delay, life: C.orbital.life }); }
      return true; }
    case "Clove": { if (k === "c") { if (!(J.lastKillT != null && performance.now() / 1000 - J.lastKillT < C.pmu.window)) return no(); spend(); A.haste = C.pmu.haste; P.hp = Math.min(150, P.hp + C.pmu.overheal); say("Pick-me-up", 700); return true; }
      spend(); if (k === "q") a18Fx({ kind: "decay", p, t: 0.5, amt: C.meddle.decay, r: C.meddle.r });
      else if (k === "e") a18Smoke(p, C.ruse.life, C.ruse.r, 0xd8b8e8, 0x8a6fd0); return true; }
    case "Harbor": { spend();
      if (k === "c") a18Orb(p, 0.5, () => { for (const b of a18BotsIn(p, C.surge.r)) { b.blind = Math.max(b.blind || 0, C.surge.near); } SFX.ab("cbPop", p); });
      else if (k === "q") { const m = a18Ring(new THREE.Vector3(P.x, 0, P.z), 2, 0x3fd0c0, 0.5); a18Fx({ kind: "tide", m, p: new THREE.Vector3(P.x, 0, P.z), d: new THREE.Vector3(d.x, 0, d.z).normalize(), t: C.tide.dist / C.tide.speed }); }
      else if (k === "e") a18Smoke(p, C.cove.life, C.cove.r, 0x2a8ac2, 0x9adcf2);
      else { const m = a18Ring(new THREE.Vector3(P.x, 0, P.z), 2.5, 0x3fd0c0, 0.7); a18Fx({ kind: "reckon", m, p: new THREE.Vector3(P.x, 0, P.z), d: new THREE.Vector3(d.x, 0, d.z).normalize(), t: C.reckon.dist / C.reckon.speed, hit: [] }); }
      return true; }
    case "Miks": { spend();
      if (k === "c") a18Orb(p, 0.5, () => { for (const b of a18BotsIn(p, C.mpulse.r)) b.blind = Math.max(b.blind || 0, C.mpulse.concuss); P.hp = Math.min(100, P.hp + C.mpulse.heal); SFX.ab("cbPop", p); });
      else if (k === "q") { A.stim = C.harmon.life; A.haste = C.harmon.life; say("Harmonize", 700); }
      else if (k === "e") a18Smoke(p, C.waveform.life, C.waveform.r, 0x6a8ad0, 0xb8c8f2);
      else a18Fx({ kind: "bassq", p: new THREE.Vector3(P.x, 0, P.z), d: new THREE.Vector3(d.x, 0, d.z).normalize(), t: 0.6 });
      return true; }
    case "Viper": { spend();
      if (k === "c") a18Zone(p, C.snake.life, C.snake.r, C.snake.rate, "Snake Bite", 0x4ad01a);
      else if (k === "q") { A.cloud = p; A.cloudOn = true; A.cloudM = a18Smoke(p, 3600, C.pcloud.r, 0x3a6a2a, 0x7ac24a); }
      else if (k === "e") { A.screen = 1; A.toxOn = true; const sp = new THREE.Vector3(P.x - Math.sin(yaw) * C.tscreen.len / 2, 0, P.z - Math.cos(yaw) * C.tscreen.len / 2); A.screenM = a18Smoke(sp, 3600, C.tscreen.len / 2, 0x3a6a2a, 0x7ac24a); }
      else { A.pit = 1; A.pitM = a18Smoke(new THREE.Vector3(P.x, 0, P.z), 3600, C.pit.r, 0x2a5a1a, 0x6ab23a); }
      return true; }
    case "Hush": { spend();
      if (k === "c") { P.vy = Math.sqrt(2 * 18 * 6); P.y = Math.max(P.y, 0.01); SFX.ab("updraft"); }
      else if (k === "q") a18Orb(p, C.flashb.delay, () => a18Blind(p, C.flashb.blind));
      else if (k === "e") a18Fx({ kind: "pull", p, t: C.displ.delay });
      else a18Fx({ kind: "susp", p: pEye(), d: jAim(), t: C.susp.life });
      return true; }
    case "Iso": { spend();
      if (k === "c") { const m = a18Ring(new THREE.Vector3(P.x, 0, P.z), C.conting.w / 2, 0x6a9af0, 0.4); a18Fx({ kind: "conting", m, p: new THREE.Vector3(P.x, 0, P.z), d: new THREE.Vector3(d.x, 0, d.z).normalize(), t: C.conting.dist / C.conting.speed }); }
      else if (k === "q") a18Orb(p, 0.5, () => { for (const b of a18BotsIn(p, C.undercut.r)) { b.vuln = C.undercut.vuln; b.supp = C.undercut.supp; } SFX.ab("cbPop", p); });
      else if (k === "e") { A.shield = 1; A.shieldT = C.dtap.life; say("Double Tap", 700); }
      else { const t = a18StripBots(new THREE.Vector3(P.x, 0, P.z), new THREE.Vector3(d.x, 0, d.z).normalize(), C.kc.range, C.kc.w)[0]; if (!t) return no(); a18Duel(t); }
      return true; }
    case "Neon": { spend();
      if (k === "c") { const m = a18Ring(new THREE.Vector3(P.x, 0, P.z), C.fastlane.dist / 2, 0x3a8af0, 0.4); a18Fx({ kind: "wallg", m, t: C.fastlane.life }); }
      else if (k === "q") a18Orb(p, 0.4, () => { for (const b of a18BotsIn(p, C.relay.r)) b.blind = Math.max(b.blind || 0, C.relay.concuss); SFX.ab("cbPop", p); });
      else if (k === "e") { A.gear = 1; say("High Gear", 700); }
      else { A.od = C.od.life; A.stim = C.od.life; say("Overdrive", 900); }
      return true; }
    case "Waylay": { spend();
      if (k === "c") a18Orb(p, 0.5, () => { for (const b of a18BotsIn(p, C.satur.r)) b.hind = C.satur.hinder; SFX.ab("cbPop", p); });
      else if (k === "q") { J.dash = jDash(); J.dash = jDash(); SFX.ab("dash"); }
      else if (k === "e") A.mark = new THREE.Vector3(P.x, P.y, P.z);
      else { A.haste = C.cpaths.haste; const m = a18Ring(new THREE.Vector3(P.x, 0, P.z), C.cpaths.dist / 2, 0xf0c04a, 0.5); a18Fx({ kind: "paths", m, p: new THREE.Vector3(P.x, 0, P.z), t: 1.2 }); }
      return true; }
    case "Yoru": { spend();
      if (k === "c") a18Fx({ kind: "decoy", p: new THREE.Vector3(P.x, 1, P.z), d: new THREE.Vector3(d.x, 0, d.z).normalize(), t: C.fakeout.life, m: jM(smokeGeo, xSmokeM("a18decoy", 0x8a92ff, 0xc9d2ff)) });
      else if (k === "q") a18Orb(p, C.blindside.delay, () => a18Blind(p, C.blindside.blind));
      else if (k === "e") A.gate = a18Aim(C.gcrash.range);
      else { A.drift = C.drift.life; say("Dimensional Drift", 900); }
      return true; }
    case "Fade": { spend();
      if (k === "c") { const t = a18BotsIn(new THREE.Vector3(P.x, 0, P.z), 30)[0]; if (t) a18Fx({ kind: "seeker", p: new THREE.Vector3(P.x, 1, P.z), tg: t, t: C.prowler.life, sp: C.prowler.speed, near: C.prowler.near }); }
      else if (k === "q") a18Orb(p, 0.5, () => { for (const b of a18BotsIn(p, C.seize.r)) { b.hp -= 0; b.teth = C.seize.tether; a18DecayB(b, C.seize.decay); } SFX.ab("cbPop", p); });
      else if (k === "e") a18Orb(p, 0.4, () => { for (const b of a18BotsIn(p, C.haunt.r)) b.mark = C.haunt.reveal; SFX.ab("cbPop", p); });
      else a18Fx({ kind: "nightfall", p: new THREE.Vector3(P.x, 0, P.z), d: new THREE.Vector3(d.x, 0, d.z).normalize(), t: 0.7 });
      return true; }
    case "Gekko": { spend();
      if (k === "c") { a18Zone(p, C.mosh.life, C.mosh.r, C.mosh.dps, "Mosh Pit", 0x4ad01a); a18Fx({ kind: "boom", p, t: C.mosh.life, r: C.mosh.r, dmg: C.mosh.boom, name: "Mosh Pit" }); a18Glob("c"); }
      else if (k === "q") { const t = a18BotsIn(new THREE.Vector3(P.x, 0, P.z), 30)[0]; if (t) a18Fx({ kind: "seeker", p: new THREE.Vector3(P.x, 1, P.z), tg: t, t: C.wing.life, sp: C.wing.speed, conc: C.wing.concuss }); a18Glob("q"); }
      else if (k === "e") { a18Orb(p, 0.5, () => { for (const b of a18BotsIn(p, C.dizzy.r)) b.blind = Math.max(b.blind || 0, C.dizzy.blind); SFX.ab("cbPop", p); }); a18Glob("e"); }
      else a18Orb(p, 0.7, () => { for (const b of a18BotsIn(p, C.thrash.r)) b.teth = C.thrash.detain; SFX.ab("cbPop", p); });
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
      if (k === "c") { const w = a18Ring(p, C.mesh.len / 2, 0x4a9af0, 0.6); a18Fx({ kind: "meshw", m: w, t: C.mesh.life }); }
      else if (k === "q") a18Fx({ kind: "sensor", p, t: C.sensor.life, arm: 1 });
      else if (k === "e") a18Orb(p, 0.5, () => { for (const b of a18BotsIn(p, C.gnet.r)) b.teth = C.gnet.life; SFX.ab("cbPop", p); });
      else { const t = a18BotsIn(new THREE.Vector3(P.x, 0, P.z), C.annih.range)[0]; if (t) { t.teth = C.annih.detain; a18Fx({ kind: "anni", tg: t, t: C.annih.detain }); } }
      return true; }
    case "Veto": { spend();
      if (k === "c") { A.xcut = p; a18Ring(p, 1, 0xd04a8a, 0.6); }
      else if (k === "q") a18Fx({ kind: "choke", p, t: C.choke.life, arm: 1 });
      else if (k === "e") { const m = a18Ring(p, C.cept.r, 0xd04a8a, 0.3); a18Fx({ kind: "ceptor", m, p, t: C.cept.life }); }
      else { A.evo = C.evo.life; A.stim = C.evo.life; say("Evolution", 900); }
      return true; }
    case "Vyse": { spend();
      if (k === "c") a18Zone(p, C.vine.life, C.vine.r, C.vine.dps, "Razorvine", 0x8a2af0);
      else if (k === "q") a18Fx({ kind: "shear", p, t: C.shear.life, arm: 1 });
      else if (k === "e") { A.rose = p; a18Ring(p, 1, 0xd04a8a, 0.6); }
      else { const m = a18Ring(new THREE.Vector3(P.x, 0, P.z), C.garden.r, 0xd04a8a, 0.5); a18Fx({ kind: "garden", m, p: new THREE.Vector3(P.x, 0, P.z), t: 1.2 }); }
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
  { const A = J.a18; if (A && A.starBack && performance.now() / 1000 >= A.starBack) { A.starBack = 0; A.stars = Math.min(4, A.stars + 1); say("Star reformed", 700); } } // Dissipate: the star returns after 1.25 s (wiki Nebula)

  if (!J.a18) return; const A = J.a18, C = A18C, P = player, T = dt;
  A.haste = Math.max(0, A.haste - dt); A.stim = Math.max(0, A.stim - dt); A.jam = Math.max(0, A.jam - dt); A.supp = Math.max(0, A.supp - dt);
  if (A.gateTp > 0) { A.gateTp -= dt; if (A.gateTp <= 0 && A.gate) { P.x = A.gate.x; P.y = A.gate.y; P.z = A.gate.z; A.gate = 0; SFX.ab("dash"); } }
  if (A.drift > 0) A.drift -= dt; if (A.od > 0) A.od -= dt; if (A.evo > 0) { A.evo -= dt; if (P.hp > 0) P.hp = Math.min(100, P.hp + C.evo.hps * dt); }
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
      case "tide": case "conting": case "reckon": { e.p.addScaledVector(e.d, (e.kind === "tide" ? C.tide.speed : e.kind === "conting" ? C.conting.speed : C.reckon.speed) * dt); e.m.position.set(e.p.x, 0.06, e.p.z); if (e.kind === "tide") for (const b of a18BotsIn(e.p, 2)) b.hind = C.tide.slow; if (e.kind === "reckon") for (const b of a18BotsIn(e.p, C.reckon.near)) if (!e.hit.includes(b)) { e.hit.push(b); b.blind = Math.max(b.blind || 0, C.reckon.near); b.hind = C.reckon.slow; } if (e.t <= 0) { jRel(e.m); keep = false; } break; }
      case "bassq": if (e.t <= 0) { for (const b of a18StripBots(e.p, e.d, C.bassq.dist, C.bassq.w)) { const d = [b.g.position.x - e.p.x, b.g.position.z - e.p.z], l = Math.hypot(d[0], d[1]) || 1; b.g.position.x += d[0] / l * C.bassq.knock; b.g.position.z += d[1] / l * C.bassq.knock; b.hind = C.bassq.slow; } const px = P.x - e.p.x, pz = P.z - e.p.z, pl = Math.hypot(px, pz) || 1; if (pl < C.bassq.dist && (px * e.d.x + pz * e.d.z) / pl > 0.5) { player.tagT = Math.max(player.tagT || 0, C.bassq.slow); player.tagK = .5; a18Deafen(C.bassq.deafen); say("Deafened \u00b7 Bassquake", 1200); } SFX.ab("cbPop", e.p); keep = false; } break;
      case "pull": if (e.t <= 0) { for (const b of a18BotsIn(e.p, C.displ.r)) { const d = [e.p.x - b.g.position.x, e.p.z - b.g.position.z], l = Math.hypot(d[0], d[1]) || 1; b.g.position.x += d[0] / l * Math.min(l, C.displ.pull); b.g.position.z += d[1] / l * Math.min(l, C.displ.pull); } keep = false; } break;
      case "susp": { e.p.addScaledVector(e.d, C.susp.speed * dt); const t = a18BotsIn(e.p, C.susp.r)[0]; if (t) { t.supp = 4; t.g.position.y += 2; keep = false; } else if (e.t <= 0) keep = false; break; }
      case "div": case "wallg": case "meshw": case "paths": case "garden": if (e.kind === "paths" && !e.done && e.t <= 0) { e.done = true; for (const b of a18BotsIn(e.p, C.cpaths.dist / 2)) b.hind = C.cpaths.hinder; } if (e.kind === "garden" && !e.done && e.t <= 0) { e.done = true; for (const b of a18BotsIn(e.p, C.garden.r)) b.jamB = C.garden.jam; } if (e.t <= 0) { if (e.m) jRel(e.m); keep = false; } break;
      case "pulses": if (e.t <= 0) { const fall = d => e.inner == null ? e.dmg : d <= e.inner ? e.dmg : e.dmg - (e.dmg - e.dmgOut) * (d - e.inner) / (e.r - e.inner); for (const b of a18BotsIn(e.p, e.r)) jHit(b, fall(Math.hypot(b.g.position.x - e.p.x, b.g.position.z - e.p.z)), e.name); if (e.inner != null) { for (const al of allies) if (al && al.alive) { const dd = Math.hypot(al.g.position.x - e.p.x, al.g.position.z - e.p.z); if (dd <= e.r) jHit(al, fall(dd) / 3, e.name); } const dp = Math.hypot(P.x - e.p.x, P.z - e.p.z); if (P.hp > 0 && dp <= e.r) hurt(P, fall(dp), e.name); try { const gy0 = groundAt(e.p.x, e.p.z, 0.3, typeof player !== "undefined" ? player.y : 3); a18ArmagBoom(e.p.x, Number.isFinite(gy0) ? gy0 : 0, e.p.z, 1.3); } catch (err) {} } SFX.ab("cbPop", e.p); const bm = a18Ring(e.p, e.r, e.name === "Guided Salvo" ? 0xff6a3a : 0xffa03a, 0.75); try { const gy = groundAt(e.p.x, e.p.z, 0.3, typeof player !== "undefined" ? player.y : 3); if (Number.isFinite(gy)) bm.position.y = gy + 0.06; } catch (err) {} a18Fx({ kind: "burst", m: bm, t: 0.45 }); if (--e.left > 0) e.t = e.gap; else keep = false; } break;
      case "burst": if (e.t <= 0) { jRel(e.m); keep = false; } break; /* short-lived impact ring (Guided Salvo / FRAG/ment detonations had no mesh at all) */
      case "boom": if (e.t <= 0) { for (const b of a18BotsIn(e.p, e.r)) jHit(b, e.dmg, e.name); keep = false; } break;
      case "armag": if (e.t <= 0) { SFX.flash(); a18Fx({ kind: "armagchain", p: e.p.clone(), d: e.d.clone(), age: 0, fired: [], grp: a18ArmagGroup(e.p.x, e.p.z, e.d.x, e.d.z, false) }); keep = false; } break;
      /* wiki Armageddon: 16 segments x 2 m, 12 m wide; segment i starts 0.25 s after i-1 and detonates 4x at 0.25 s for 60 each (offline mirror of server agents18.js) */
      case "armagboom": { e.age += dt; const u = Math.min(1, e.age / e.life), sc = 0.6 + u * 2.6; e.core.scale.setScalar(sc * (e.size || 1)); e.core.material.opacity = 0.6 * Math.pow(1 - u, 1.4); e.core.material.color.setHex(u < 0.35 ? 0xffc040 : u < 0.7 ? 0xff7020 : 0xb02a10); e.ring.scale.setScalar((1 + u * 4.2) * (e.size || 1)); e.ring.material.opacity = 0.8 * (1 - u); if (u >= 1) { scene.remove(e.core); scene.remove(e.ring); e.core.material.dispose(); e.ring.material.dispose(); keep = false; } break; }
      case "armagchain": { e.age += dt; const AG = C.armag; let done = true; for (let i = 0; i < AG.segs; i++) for (let j = 0; j < AG.ticks; j++) { const id = i * AG.ticks + j; if (e.fired[id]) continue; done = false; if (e.age < i * AG.gap + j * AG.tick) continue; e.fired[id] = 1; const o = new THREE.Vector3(e.p.x + e.d.x * AG.seg * i, 0, e.p.z + e.d.z * AG.seg * i); for (const b of a18StripBots(o, e.d, AG.seg, AG.w)) jHit(b, AG.dmg, "Armageddon"); /* wiki: affects allies and self (allies take a third, the server abilityDamage rule) */ { const inS = (x, z) => { const f = (x - o.x) * e.d.x + (z - o.z) * e.d.z, sd = (x - o.x) * -e.d.z + (z - o.z) * e.d.x; return f > 0 && f < AG.seg && Math.abs(sd) < AG.w / 2; }; for (const al of allies) if (al && al.alive && inS(al.g.position.x, al.g.position.z)) jHit(al, AG.dmg / 3, "Armageddon"); if (P.hp > 0 && inS(P.x, P.z)) hurt(P, AG.dmg, "Armageddon"); } for (let b = 0; b < 2; b++) { const f = (i + Math.random()) * AG.seg, sd = (Math.random() - 0.5) * (AG.w - 2), x = e.p.x + e.d.x * f - e.d.z * sd, z = e.p.z + e.d.z * f + e.d.x * sd; let gy = 0; try { const g = groundAt(x, z, 0.3, typeof player !== "undefined" ? player.y : 3); if (Number.isFinite(g)) gy = g; } catch (err) {} a18ArmagBoom(x, gy, z); } } if (done && e.age > AG.segs * AG.gap + AG.ticks * AG.tick) { a18ArmagFree(e.grp); keep = false; } break; }
      case "nightfall": if (e.t <= 0) { for (const b of a18StripBots(e.p, e.d, C.nightfall.dist, C.nightfall.w)) { a18DecayB(b, C.nightfall.decay); b.mark = C.nightfall.decay ? 12 : 0; } SFX.ab("cbPop", e.p); keep = false; } break;
      case "decoy": { e.p.addScaledVector(e.d, C.fakeout.speed * dt); if (e.m) { e.m.position.set(e.p.x, 1, e.p.z); scene.add(e.m); } if (e.t <= 0) { if (e.m) jRel(e.m); a18Blind(e.p, C.blindside.blind); keep = false; } break; }
      case "seeker": { const t = e.tg; if (!t || !t.alive) { keep = false; break; } const d = [t.g.position.x - e.p.x, t.g.position.z - e.p.z], l = Math.hypot(d[0], d[1]); if (l < 0.8 || e.t <= 0) { if (e.near) t.blind = Math.max(t.blind || 0, e.near); if (e.conc) t.blind = Math.max(t.blind || 0, e.conc); keep = false; } else { e.p.x += d[0] / l * e.sp * dt; e.p.z += d[1] / l * e.sp * dt; } break; }
      case "sensor": if (e.arm > 0) e.arm -= dt; else { const t = a18BotsIn(e.p, C.sensor.r)[0]; if (t) { for (const b of a18BotsIn(e.p, C.sensor.r)) b.blind = Math.max(b.blind || 0, C.sensor.concuss); SFX.ab("cbPop", e.p); keep = false; } } if (e.t <= 0) keep = false; break;
      case "choke": { const t = a18BotsIn(e.p, C.choke.r)[0]; if (t && !e.done) { e.done = true; for (const b of a18BotsIn(e.p, C.choke.r)) { a18DecayB(b, C.choke.decay); b.hind = C.choke.slow; } SFX.ab("cbPop", e.p); keep = false; } if (e.t <= 0) keep = false; break; }
      case "shear": { const t = a18BotsIn(e.p, C.shear.r)[0]; if (t && !e.done) { e.done = true; const m = a18Ring(e.p, C.shear.r, 0xd04a8a, 0.6); a18Fx({ kind: "meshw", m, t: C.shear.wall }); } if (e.t <= 0) keep = false; break; }
      case "ceptor": if (e.t <= 0) { jRel(e.m); keep = false; } break;
      case "ncmd": { e.next -= dt; if (e.next <= 0) { e.next = C.nullcmd.pulse; for (const b of a18BotsIn(new THREE.Vector3(P.x, 0, P.z), C.nullcmd.r)) b.supp = C.zero.supp; } if (e.t <= 0) { jRel(e.m); keep = false; } break; }
      case "anni": { const t = e.tg; if (!t || !t.alive || e.t <= 0) { if (t && t.alive && e.t <= 0) jHit(t, 999, "Annihilate"); keep = false; break; } const d = [P.x - t.g.position.x, P.z - t.g.position.z], l = Math.hypot(d[0], d[1]) || 1; if (l > 1.2) { t.g.position.x += d[0] / l * 2.5 * dt; t.g.position.z += d[1] / l * 2.5 * dt; } break; }
      case "star": if (e.t <= 0 || e.gone) { if (e.m) jRel(e.m); keep = false; } break;
      default: if (e.pop) { if (e.m) e.m.position && null; if (e.t <= 0) { e.pop(); if (e.m) jRel(e.m); keep = false; } } else if (e.t <= 0) keep = false;
    }
    if (keep) F[w++] = e; else if (e.m && !e.popped && e.kind === undefined) jRel(e.m);
  }
  F.length = w;
}
// Iso Double Tap shield + Yoru Dimensional Drift: the player ignores one hit / all hits (offline, player-side)
const a18Hurt0 = hurt;
hurt = function (t, n, by) { if (t === player && J.a18) { if (J.a18.shield) { J.a18.shield = 0; blip(880, 0.1, "sine", 0.1); return; } if (J.a18.drift > 0 || J.a18.evo > 0 && n < 0) return; } return a18Hurt0(t, n, by); };
// round start: fresh stars / fuel / anchors (jRound resets J.c/q/e from KITS already)
const a18Round0 = jRound; jRound = function (match) { a18Round0(match); if (A18SET.has(J.pick)) a18Reset(); };
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
  scene.add(m); return m;
}
function a18NetFree(r) { if (r.kind === "salvo") { for (const m of r.ms) jRel(m); return; } if (r.kind === "armag") { a18ArmagFree(r.ag); return; } if (!r.m) return; if (r.kind === "duel") a18ArenaFree(r.m); else jRel(r.m); }
function a18NetSync(rows) {
  const seen = new Set();
  for (const e of rows) { if (e && e.kind === "duel" && Number.isFinite(e.id) && Array.isArray(e.p) && e.p.length === 3) { seen.add(e.id); if (!a18Net.has(e.id)) a18Net.set(e.id, { m: a18ArenaShell(e.p[0]), kind: "duel" }); continue; }
    if (e && e.kind === "armag" && Number.isFinite(e.id) && Array.isArray(e.p) && e.p.length === 3 && Number.isFinite(e.yaw) && Number.isFinite(e.tl)) { seen.add(e.id); let r = a18Net.get(e.id); if (!r) { r = { kind: "armag", ag: a18ArmagGroup(e.p[0], e.p[2], -Math.sin(e.yaw), -Math.cos(e.yaw), true) }; a18Net.set(e.id, r); } const AG = A18C.armag, el = AG.wind + (AG.segs - 1) * AG.gap + AG.ticks * AG.tick + 0.2 - e.tl; let spawned = 0; for (let i = 0; i < AG.segs; i++) for (let j = 0; j < AG.ticks; j++) { const id = i * AG.ticks + j, dt0 = el - (AG.wind + i * AG.gap + j * AG.tick); if (dt0 < 0 || r.ag.fired[id]) continue; r.ag.fired[id] = 1; if (dt0 > 0.6 || spawned > 6) continue; spawned++; const fw = [-Math.sin(e.yaw), -Math.cos(e.yaw)]; for (let b = 0; b < 2; b++) { const f = (i + Math.random()) * AG.seg, sd = (Math.random() - 0.5) * (AG.w - 2), x = e.p[0] + fw[0] * f - fw[1] * sd, z = e.p[2] + fw[1] * f + fw[0] * sd; let gy = 0; try { const g = groundAt(x, z, 0.3, typeof player !== "undefined" ? player.y : 3); if (Number.isFinite(g)) gy = g; } catch (err) {} a18ArmagBoom(x, gy, z); } } continue; }
    if (e && (e.kind === "salvo" || e.kind === "frag") && Number.isFinite(e.id) && Array.isArray(e.p) && e.p.length === 3 && Number.isFinite(e.tl)) { seen.add(e.id); const S = e.kind === "frag" ? A18C.frag : A18C.salvo; let r = a18Net.get(e.id); if (!r) { const ms = []; for (const [rad, op] of [[S.r, 0.35], [S.inner, 0.55]]) { const m = a18Ring({ x: e.p[0], z: e.p[2] }, rad, e.kind === "frag" ? 0xffa03a : 0xff6a3a, op); try { const gy = groundAt(e.p[0], e.p[2], 0.3, e.p[1] + 1); if (Number.isFinite(gy)) m.position.y = gy + 0.05; } catch (err) {} ms.push(m); } r = { kind: "salvo", ms, n: 0 }; a18Net.set(e.id, r); }
      const el = e.w > 0 ? -e.w : S.pulses * S.gap + 1 - e.tl; /* both rows last pulses*gap+1 s after landing */ while (r.n < S.pulses && el >= r.n * S.gap) { r.n++; let gy = e.p[1]; try { const g = groundAt(e.p[0], e.p[2], 0.3, e.p[1] + 1); if (Number.isFinite(g)) gy = g; } catch (err) {} a18ArmagBoom(e.p[0], gy, e.p[2], e.kind === "frag" ? 0.8 : 1.3); } continue; }
    if (!e || !A18VIS[e.kind] || !Number.isFinite(e.id) || !Array.isArray(e.p) || e.p.length !== 3) continue; seen.add(e.id);
    let r = a18Net.get(e.id); if (!r) { r = { m: a18NetMesh(e.kind, e), kind: e.kind }; a18Net.set(e.id, r); }
    else if (r.m) { const k = A18VIS[e.kind][0]; if (k === "orb" || k === "wave" || k === "dev" || k === "star") r.m.position.set(e.p[0], k === "orb" ? (e.p[1] || 0) + 1 : k === "star" ? (e.p[1] || 0) + 1.4 : r.m.position.y === 1.1 ? 1.1 : (e.p[1] || 0) + .3, e.p[2]); else r.m.position.x = e.p[0], r.m.position.z = e.p[2]; if (Number.isFinite(e.yaw) && k === "wall") r.m.rotation.y = -e.yaw; } }
  for (const [id, r] of a18Net) if (!seen.has(id)) { a18NetFree(r); a18Net.delete(id); }
}
const a18FxSync0 = netSyncEffects; netSyncEffects = function (rows) { a18FxSync0(rows); try { a18NetSync(rows); } catch (e) { xE(e); } };
const a18ClearFx0 = netClearEffects; netClearEffects = function () { a18ClearFx0(); for (const [, r] of a18Net) a18NetFree(r); a18Net.clear(); };
// rs status: suppress (abilities locked), jam (devices jammed), hinder (slow), haste, stim, decaying HP
const a18Chips0 = netStatusChips; netStatusChips = function (st) {
  const on = a18Chips0(st); let el = document.getElementById("netSt");
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
// ---- END AGENTS 18 ----
