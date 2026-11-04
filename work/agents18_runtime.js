// ---- AGENTS 18 ----
// Offline client behavior for the 18 agents added 2026-11-03 (Astra, Brimstone, Clove, Harbor, Miks, Viper, Hush,
// Iso, Neon, Waylay, Yoru, Fade, Gekko, KAY/O, Tejo, Deadlock, Veto, Vyse). Mirrors server/src/agents18.js (same
// wiki.playvalorant.com constants, fetched 2026-11-03); known deviations are listed in work/agents18-notes.md.
const A18SET = new Set(["Astra", "Brimstone", "Clove", "Harbor", "Miks", "Viper", "Hush", "Iso", "Neon", "Waylay", "Yoru", "Fade", "Gekko", "KAY/O", "Tejo", "Deadlock", "Veto", "Vyse"]);
const A18C = { star: { wellPull: 2, wellVuln: 2, wellR: 3.5, novaDelay: 1.25, novaConcuss: 4, novaR: 4.5, nebulaLife: 14.25, nebulaR: 4.1, divideLife: 21 },
 stim: { life: 12.5, r: 4 }, incend: { life: 7, r: 4.5, rate: 60 }, skysmoke: { life: 19.25, r: 4.15 }, orbital: { delay: 2, life: 4, r: 5, dps: 150 },
 pmu: { haste: 4, overheal: 50, window: 12 }, meddle: { r: 4.5, decay: 70 }, ruse: { life: 12.75, r: 4.15 }, ndy: { channel: 3.3, window: 12 },
 surge: { r: 4.5, near: 2, slow: 2 }, tide: { dist: 45, life: 12, slow: 2, w: 2, speed: 6 }, cove: { life: 12, r: 4.1 }, reckon: { dist: 30, near: 3, slow: 4, speed: 7 },
 mpulse: { life: 6, r: 6, concuss: 2.5, heal: 40 }, harmon: { life: 8 }, waveform: { life: 14, r: 4.15 }, bassq: { dist: 25, w: 14, slow: 4, knock: 8 },
 snake: { life: 6.5, r: 4, rate: 20 }, fuel: { max: 100, drain: 8, regen: 20 }, pcloud: { r: 4.15 }, tscreen: { len: 30 }, pit: { r: 9, decay: 30 },
 flow: { delay: 1.1, speed: 22 }, flashb: { blind: 1.6, delay: 1 }, displ: { r: 5, pull: 6, delay: 1 }, susp: { speed: 12, life: 4, lev: 3, r: 4 },
 conting: { dist: 30, speed: 6, w: 8, life: 8 }, undercut: { r: 5, supp: 4, vuln: 4 }, dtap: { life: 20 }, kc: { range: 40, w: 4, duel: 13, supp: 4 },
 fastlane: { dist: 30, life: 6 }, relay: { r: 4.5, concuss: 3.5 }, gear: { drain: 10, regen: 20 }, od: { life: 10, dps: 150 },
 satur: { r: 4.5, hinder: 4 }, ls: { dash: 9, time: 0.35 }, refract: { life: 20, travel: 0.6 }, cpaths: { dist: 20, w: 10, haste: 3, hinder: 4 },
 fakeout: { life: 10, speed: 4.5 }, blindside: { blind: 1.5, delay: 0.6 }, gcrash: { life: 20, range: 30 }, drift: { life: 10 },
 prowler: { life: 3, speed: 9, near: 2.5 }, seize: { r: 4.5, tether: 4, decay: 70 }, haunt: { r: 25, reveal: 12 }, nightfall: { dist: 25, w: 14, decay: 70 },
 mosh: { r: 5, life: 3, dps: 20, boom: 70 }, wing: { life: 5, speed: 9, concuss: 3.5 }, dizzy: { life: 2.5, blind: 1.5, r: 15 }, thrash: { r: 6, detain: 6 }, globule: { reclaim: 10 },
 frag: { r: 5, pulses: 4, gap: 1, dmg: 40 }, fdrive: { blind: 2.25, delay: 1.6 }, zero: { r: 15, supp: 8 }, nullcmd: { life: 10, pulse: 3, r: 20 },
 sdrone: { life: 8, r: 12, reveal: 3, supp: 6 }, sd: { r: 4, concuss: 3, dmg: 40 }, salvo: { r: 6, pulses: 3, gap: 0.8, dmg: 55 }, armag: { len: 40, w: 12, dmg: 120 },
 mesh: { life: 30, len: 7.5 }, sensor: { life: 30, r: 8, concuss: 3 }, gnet: { r: 6, life: 8 }, annih: { range: 20, detain: 7 },
 xcut: { range: 25 }, choke: { life: 30, r: 6, decay: 60, slow: 2 }, cept: { life: 30, r: 10 }, evo: { life: 12, hps: 10 },
 vine: { life: 30, r: 6, dps: 15 }, shear: { life: 30, r: 2.5, wall: 8 }, rose: { life: 30, blind: 2, r: 20 }, garden: { r: 20, jam: 8 } };
J.a18 = null; // per-agent state (stars, fuel, anchors, slides), reset by a18Reset on the pick / round reset hooks
function a18Reset() { const a = J.pick; J.a18 = { stars: a === "Astra" ? 2 : 0, fuel: a === "Viper" || a === "Neon" ? A18C.fuel.max : 0, slides: 2, slideK: 0, cloud: 0, screen: 0, pit: 0, gate: 0, mark: 0, rose: 0, xcut: 0, gear: 0, drift: 0, od: 0, evo: 0, shield: 0, duel: 0, ndyT: 0, haste: 0, stim: 0, decay: 0, decayAmt: 0, jam: 0, supp: 0 }; }
function a18Aim(dist) { const o = pEye(), d = jAim(); ray.set(o, d); ray.far = dist || 14; const h = ray.intersectObjects(solids)[0]; const t = h ? Math.max(0, h.distance - 0.5) : (dist || 14); const p = o.clone().addScaledVector(d, t); p.y = Math.max(0.05, p.y); return p; }
function a18Smoke(p, dur, r, c1, c2) { const m = jM(smokeGeo, xSmokeM("a18" + (a18Smoke.n = (a18Smoke.n || 0) + 1), c1, c2)); m.position.set(p.x, p.y + 1.7, p.z); scene.add(m); J.smokes.push({ m, p: m.position, t: dur, r: xSmk(m, r) }); SFX.smoke(); return m; }
function a18Zone(p, life, r, rate, name, col) { const m = jM(zoneGeo, fireMat(col || 0xff5a1a, 0.55)); m.rotation.x = -Math.PI / 2; m.position.set(p.x, 0.05, p.z); m.scale.setScalar(r / 2.5); scene.add(m); J.zones.push({ m, p: p.clone(), t: life, R: 0, r0: r, rate, name }); return m; }
function a18Fx(o) { (J.a18fx = J.a18fx || []).push(o); return o; }
function a18Orb(p, delay, fn) { const m = jM(orbGeo, xAdd("a18orb" + (a18Fx.n = (a18Fx.n || 0) + 1), 0xfff6e8, 1)); m.position.copy(p); scene.add(m); a18Fx({ m, t: delay, pop: fn }); }
function a18BotsIn(p, r, dy) { const out = []; for (const b of bots) if (b.alive && Math.hypot(b.g.position.x - p.x, b.g.position.z - p.z) < r && Math.abs(b.g.position.y - p.y) < (dy || 4)) out.push(b); return out; }
function a18StripBots(p, d, dist, w) { const out = []; for (const b of bots) if (b.alive) { const q = [b.g.position.x - p.x, b.g.position.z - p.z], f = q[0] * d.x + q[1] * d.z, s = q[0] * -d.z + q[1] * d.x; if (f > 0 && f < dist && Math.abs(s) < w / 2) out.push(b); } return out; }
function a18Blind(p, bl) { xFlashBots(p, bl); const e = pEyeTo(PE_V), v = p.clone().sub(e), l = v.length() || 0.01; if (player.hp > 0 && l < 30 && v.dot(jAim()) / l > 0.5 && los(e, p)) xFlashPlayer(p, bl); }
function a18Ring(p, r, col, op) { const m = new THREE.Mesh(ringGeo, fireMat(col || 0xff9a3a, op == null ? 0.9 : op)); m.rotation.x = -Math.PI / 2; m.position.set(p.x, 0.06, p.z); m.scale.setScalar(r); scene.add(m); return m; }
function a18Key(code) {
  const k = code === "KeyC" ? "c" : code === "KeyQ" ? "q" : code === "KeyE" ? "e" : "x", A = J.a18, C = A18C, a = J.pick, P = player;
  const no = () => (blip(120, 0.08, "square", 0.1), true);
  if (k === "x" && a === "Clove" && P.hp <= 0 && A.ndyT > 0) { // Not Dead Yet (wiki): self-revive channel from death
    if (J.ult < K().u) return no(); J.ult = 0; A.ndyT = 0; A.ndy = C.ndy.channel; say("Not Dead Yet", 900); SFX.ab("rewind"); return true; }
  if (P.hp <= 0) return true;
  if (A.supp > 0) return no();
  const chargeOk = k === "x" ? J.ult >= K().u : (a === "Astra" ? A.stars > 0 : J[k] > 0);
  if (a === "Viper" && (k === "q" && A.cloud || k === "e" && A.screen || k === "x" && A.pit)) { J.cd[k] = 0.6; if (k === "q") A.cloudOn = !A.cloudOn; else if (k === "e") A.toxOn = !A.toxOn; else { A.pit = 0; if (A.pitM) { jRel(A.pitM); A.pitM = 0; } } return true; }
  if (a === "Vyse" && k === "e" && A.rose) { const p = A.rose; A.rose = 0; a18Blind(p, C.rose.blind); SFX.flash(); return true; }
  if (a === "Veto" && k === "c" && A.xcut) { P.x = A.xcut.x; P.z = A.xcut.z; P.y = A.xcut.y; A.xcut = 0; SFX.ab("dash"); return true; }
  if (a === "Waylay" && k === "e" && A.mark) { P.x = A.mark.x; P.y = A.mark.y; P.z = A.mark.z; A.mark = 0; J.e = 0; SFX.ab("dash"); return true; }
  if (a === "Yoru" && k === "e" && A.gate) { P.x = A.gate.x; P.y = A.gate.y; P.z = A.gate.z; A.gate = 0; SFX.ab("dash"); return true; }
  if (a === "Neon" && k === "e" && A.gear > 0) { if (A.slides > 0) { A.slides--; J.dash = jDash(); SFX.ab("dash"); } return true; }
  if (!chargeOk || J.cd[k] > 0) return no();
  const p = a18Aim(14), d = jAim();
  const spend = () => { if (k === "x") J.ult = 0; else if (a === "Astra") A.stars--; else J[k]--; J.cd[k] = 0.6; };
  switch (a) {
    case "Astra": { spend();
      if (k === "c") a18Fx({ kind: "gwell", p, t: 0.75, life: C.star.wellPull });
      else if (k === "q") a18Fx({ kind: "nova", p, t: C.star.novaDelay });
      else if (k === "e") a18Smoke(p, C.star.nebulaLife, C.star.nebulaR, 0x7a4fd0, 0xc9a8f2);
      else { const m = a18Ring(new THREE.Vector3(P.x, 0, P.z), 30, 0x9a6ff0, 0.5); a18Fx({ kind: "div", m, t: C.star.divideLife }); }
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
      if (k === "c") a18Fx({ kind: "pulses", p, t: 0.5, gap: C.frag.gap, left: C.frag.pulses, r: C.frag.r, dmg: C.frag.dmg, name: "FRAG/ment" });
      else if (k === "q") a18Orb(p, C.fdrive.delay, () => a18Blind(p, C.fdrive.blind));
      else if (k === "e") a18Orb(p, 0.4, () => { for (const b of a18BotsIn(p, C.zero.r)) b.supp = C.zero.supp; SFX.ab("cbPop", p); });
      else { A.stim = C.nullcmd.life; A.ncmd = C.nullcmd.life; const m = a18Ring(new THREE.Vector3(P.x, 0, P.z), C.nullcmd.r, 0x8a2af0, 0.4); a18Fx({ kind: "ncmd", m, t: C.nullcmd.life, next: C.nullcmd.pulse }); }
      return true; }
    case "Tejo": { spend();
      if (k === "c") a18Orb(p, 0.5, () => { for (const b of a18BotsIn(p, C.sdrone.r)) { b.mark = C.sdrone.reveal; b.blind = Math.max(b.blind || 0, 1); } SFX.ab("cbPop", p); });
      else if (k === "q") a18Orb(p, 0.4, () => { for (const b of a18BotsIn(p, C.sd.r)) { jHit(b, C.sd.dmg, "Special Delivery"); b.blind = Math.max(b.blind || 0, C.sd.concuss); } SFX.ab("cbPop", p); });
      else if (k === "e") a18Fx({ kind: "pulses", p, t: 0.6, gap: C.salvo.gap, left: C.salvo.pulses, r: C.salvo.r, dmg: C.salvo.dmg, name: "Guided Salvo" });
      else a18Fx({ kind: "armag", p: new THREE.Vector3(P.x, 0, P.z), d: new THREE.Vector3(d.x, 0, d.z).normalize(), t: 0.8 });
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
function a18Duel(t) { const A = J.a18, C = A18C; A.duel = C.kc.duel; A.duelT = t; t.duel = C.kc.duel; t.supp = C.kc.supp; const p = new THREE.Vector3(player.x, 0, player.z); A.duelHome = p; t.duelHome = t.g.position.clone(); const m = a18Ring(p, 5, 0x6a9af0, 0.5); A.duelM = m; player.x += 2; t.g.position.x = p.x - 2; t.g.position.z = p.z; say("Kill Contract", 1000); SFX.ab("rewind"); }
function a18Tick(dt) {
  if (!J.a18) return; const A = J.a18, C = A18C, P = player, T = dt;
  A.haste = Math.max(0, A.haste - dt); A.stim = Math.max(0, A.stim - dt); A.jam = Math.max(0, A.jam - dt); A.supp = Math.max(0, A.supp - dt);
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
  if (A.duel > 0) { A.duel -= dt; const t = A.duelT; if (A.duel <= 0 || !t || !t.alive) { P.x = A.duelHome.x; P.z = A.duelHome.z; if (t && t.alive) { t.g.position.copy(t.duelHome); t.duel = 0; } if (A.duelM) { jRel(A.duelM); A.duelM = 0; } A.duel = 0; } }
  const F = J.a18fx; if (!F) return; let w = 0;
  for (let i = 0; i < F.length; i++) { const e = F[i]; e.t -= dt; let keep = true;
    switch (e.kind) {
      case "gwell": { for (const b of a18BotsIn(e.p, C.star.wellR)) { const d = [e.p.x - b.g.position.x, e.p.z - b.g.position.z], l = Math.hypot(d[0], d[1]) || 1; b.g.position.x += d[0] / l * 4 * dt; b.g.position.z += d[1] / l * 4 * dt; b.vuln = C.star.wellVuln; } if (e.t <= 0) keep = false; break; }
      case "nova": if (e.t <= 0) { for (const b of a18BotsIn(e.p, C.star.novaR)) b.blind = Math.max(b.blind || 0, C.star.novaConcuss); SFX.ab("cbPop", e.p); keep = false; } break;
      case "stimz": if (Math.hypot(P.x - e.p.x, P.z - e.p.z) < C.stim.r && P.hp > 0) A.stim = Math.max(A.stim, 0.5); if (e.t <= 0) { jRel(e.m); keep = false; } break;
      case "orbital": if (e.t <= 0) { e.life -= dt; for (const b of a18BotsIn(e.p, C.orbital.r)) jHit(b, C.orbital.dps * dt, "Orbital Strike"); if (Math.hypot(P.x - e.p.x, P.z - e.p.z) < C.orbital.r && P.hp > 0) hurt(P, C.orbital.dps * dt, "Orbital Strike"); if (e.life <= 0) { jRel(e.m); keep = false; } } break;
      case "decay": if (e.t <= 0) { for (const b of a18BotsIn(e.p, e.r)) a18DecayB(b, e.amt); SFX.ab("cbPop", e.p); keep = false; } break;
      case "tide": case "conting": case "reckon": { e.p.addScaledVector(e.d, (e.kind === "tide" ? C.tide.speed : e.kind === "conting" ? C.conting.speed : C.reckon.speed) * dt); e.m.position.set(e.p.x, 0.06, e.p.z); if (e.kind === "tide") for (const b of a18BotsIn(e.p, 2)) b.hind = C.tide.slow; if (e.kind === "reckon") for (const b of a18BotsIn(e.p, C.reckon.near)) if (!e.hit.includes(b)) { e.hit.push(b); b.blind = Math.max(b.blind || 0, C.reckon.near); b.hind = C.reckon.slow; } if (e.t <= 0) { jRel(e.m); keep = false; } break; }
      case "bassq": if (e.t <= 0) { for (const b of a18StripBots(e.p, e.d, C.bassq.dist, C.bassq.w)) { const d = [b.g.position.x - e.p.x, b.g.position.z - e.p.z], l = Math.hypot(d[0], d[1]) || 1; b.g.position.x += d[0] / l * C.bassq.knock; b.g.position.z += d[1] / l * C.bassq.knock; b.hind = C.bassq.slow; } SFX.ab("cbPop", e.p); keep = false; } break;
      case "pull": if (e.t <= 0) { for (const b of a18BotsIn(e.p, C.displ.r)) { const d = [e.p.x - b.g.position.x, e.p.z - b.g.position.z], l = Math.hypot(d[0], d[1]) || 1; b.g.position.x += d[0] / l * Math.min(l, C.displ.pull); b.g.position.z += d[1] / l * Math.min(l, C.displ.pull); } keep = false; } break;
      case "susp": { e.p.addScaledVector(e.d, C.susp.speed * dt); const t = a18BotsIn(e.p, C.susp.r)[0]; if (t) { t.supp = 4; t.g.position.y += 2; keep = false; } else if (e.t <= 0) keep = false; break; }
      case "div": case "wallg": case "meshw": case "paths": case "garden": if (e.kind === "paths" && !e.done && e.t <= 0) { e.done = true; for (const b of a18BotsIn(e.p, C.cpaths.dist / 2)) b.hind = C.cpaths.hinder; } if (e.kind === "garden" && !e.done && e.t <= 0) { e.done = true; for (const b of a18BotsIn(e.p, C.garden.r)) b.jamB = C.garden.jam; } if (e.t <= 0) { if (e.m) jRel(e.m); keep = false; } break;
      case "pulses": if (e.t <= 0) { for (const b of a18BotsIn(e.p, e.r)) jHit(b, e.dmg, e.name); SFX.ab("cbPop", e.p); if (--e.left > 0) e.t = e.gap; else keep = false; } break;
      case "boom": if (e.t <= 0) { for (const b of a18BotsIn(e.p, e.r)) jHit(b, e.dmg, e.name); keep = false; } break;
      case "armag": if (e.t <= 0) { for (const b of a18StripBots(e.p, e.d, C.armag.len, C.armag.w)) jHit(b, C.armag.dmg, "Armageddon"); SFX.flash(); keep = false; } break;
      case "nightfall": if (e.t <= 0) { for (const b of a18StripBots(e.p, e.d, C.nightfall.dist, C.nightfall.w)) { a18DecayB(b, C.nightfall.decay); b.mark = C.nightfall.decay ? 12 : 0; } SFX.ab("cbPop", e.p); keep = false; } break;
      case "decoy": { e.p.addScaledVector(e.d, C.fakeout.speed * dt); if (e.m) { e.m.position.set(e.p.x, 1, e.p.z); scene.add(e.m); } if (e.t <= 0) { if (e.m) jRel(e.m); a18Blind(e.p, C.blindside.blind); keep = false; } break; }
      case "seeker": { const t = e.tg; if (!t || !t.alive) { keep = false; break; } const d = [t.g.position.x - e.p.x, t.g.position.z - e.p.z], l = Math.hypot(d[0], d[1]); if (l < 0.8 || e.t <= 0) { if (e.near) t.blind = Math.max(t.blind || 0, e.near); if (e.conc) t.blind = Math.max(t.blind || 0, e.conc); keep = false; } else { e.p.x += d[0] / l * e.sp * dt; e.p.z += d[1] / l * e.sp * dt; } break; }
      case "sensor": if (e.arm > 0) e.arm -= dt; else { const t = a18BotsIn(e.p, C.sensor.r)[0]; if (t) { for (const b of a18BotsIn(e.p, C.sensor.r)) b.blind = Math.max(b.blind || 0, C.sensor.concuss); SFX.ab("cbPop", e.p); keep = false; } } if (e.t <= 0) keep = false; break;
      case "choke": { const t = a18BotsIn(e.p, C.choke.r)[0]; if (t && !e.done) { e.done = true; for (const b of a18BotsIn(e.p, C.choke.r)) { a18DecayB(b, C.choke.decay); b.hind = C.choke.slow; } SFX.ab("cbPop", e.p); keep = false; } if (e.t <= 0) keep = false; break; }
      case "shear": { const t = a18BotsIn(e.p, C.shear.r)[0]; if (t && !e.done) { e.done = true; const m = a18Ring(e.p, C.shear.r, 0xd04a8a, 0.6); a18Fx({ kind: "meshw", m, t: C.shear.wall }); } if (e.t <= 0) keep = false; break; }
      case "ceptor": if (e.t <= 0) { jRel(e.m); keep = false; } break;
      case "ncmd": { e.next -= dt; if (e.next <= 0) { e.next = C.nullcmd.pulse; for (const b of a18BotsIn(new THREE.Vector3(P.x, 0, P.z), C.nullcmd.r)) b.supp = C.zero.supp; } if (e.t <= 0) { jRel(e.m); keep = false; } break; }
      case "anni": { const t = e.tg; if (!t || !t.alive || e.t <= 0) { if (t && t.alive && e.t <= 0) jHit(t, 999, "Annihilate"); keep = false; break; } const d = [P.x - t.g.position.x, P.z - t.g.position.z], l = Math.hypot(d[0], d[1]) || 1; if (l > 1.2) { t.g.position.x += d[0] / l * 2.5 * dt; t.g.position.z += d[1] / l * 2.5 * dt; } break; }
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
const a18Kill0 = jKill; jKill = function () { a18Kill0(); if (!A18SET.has(J.pick) || !J.a18) return; const A = J.a18; J.lastKillT = performance.now() / 1000; if (["Iso", "Waylay", "Yoru"].includes(J.pick) && J.e < 1 && ++J.tk >= 2) { J.e = 1; J.tk = 0; say(K().n[2] + " ready", 700); } if (J.pick === "Neon" && A.slides < 2 && ++A.slideK >= 2) { A.slides = 2; A.slideK = 0; } };
// hook the key dispatch and the frame tick (same wrapper pattern as the other runtime blocks)
const a18KeyJ = jKey; jKey = function (code) { if (A18SET.has(J.pick)) { if (!J.a18) a18Reset(); return a18Key(code), true; } return a18KeyJ(code); };
const a18TickJ = jTick; jTick = function (dt) { a18TickJ(dt); try { a18Tick(dt); } catch (e) { xE(e); } };
// ---- END AGENTS 18 ----
