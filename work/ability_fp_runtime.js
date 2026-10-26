// ---- ABILITY FIRST PERSON ----
// First-person ability viewmodel (work/ability_fp_runtime.js, installed by work/install_valorant.py after ABILITY EQUIP).
// Abilities are drawn by the agent's OWN native first-person arms (models/valorant/<agent>-fp.glb, the rig the guns and
// the knife use, xvFPLoad) playing Valorant's authored first-person ability clips. Every FP rig shares one skeleton
// (102 common bones), so an agent without an authored clip for an ability borrows the archetype clip by bone name from
// models/valorant/animations/FP_Abilities.glb (work/build_ability_anims.py), exactly as the shared weapon clips work.
// Phases follow the equip flow (J.eq, work/ability_equip_runtime.js): draw = equip clip over the wiki equip time
// (XAB_EQT / q.d0), ready / hold = idle loop, rel = clip start -> release frame over XABT.rel, rec = release frame -> end
// over XABT.rec, then the gun's native equip replays. Instant casts (no equip in Valorant) play the cast clip over the
// XCA window. The ability item (a native prop glb or an energy orb) is held in the hand bone and leaves it at release.
// Archetype clip sets: eq / idle / cast (FIRE) / alt (ALT FIRE), the hand that holds the item, the release fraction of
// each cast clip (peak palm speed measured on the clips, work/qa/abilfx/NOTES.md) and the idle play rate.
var XAF_SET = {
  nade: { eq: "FP_Killjoy_S0_4_Grenade_Equip", idle: "FP_Killjoy_S0_4_Swarm_Idle", cast: "FP_Core_Grenade_OverhandThrow", alt: "FP_Killjoy_S0_4_Swarm_UnderhandThrow", hand: "R", rel: 0.13, arel: 0.14 },
  paint: { eq: "FP_Clay_S0_4_Equip", idle: "FP_Clay_S0_4_Idle", cast: "FP_Core_Grenade_OverhandThrow", alt: "FP_Core_Grenade_UnderhandThrow", hand: "R", rel: 0.13, arel: 0.05 },
  flick: { eq: "FP_Guide_S0_E_Hawk_Equip", idle: "FP_Guide_S0_E_Hawk_EquipIdle", cast: "FP_Guide_S0_E_Hawk_Cast", hand: "L", rel: 0.14 },
  wolf: { eq: "FP_Guide_S0_Q_Wolf_Equip", idle: "FP_Guide_S0_Q_Wolf_Idle", cast: "FP_Guide_S0_Q_Wolf_Cast", hand: "L", rel: 0.11 },
  place: { eq: "FP_Gumshoe_S0_E_Equip", idle: "FP_Gumshoe_S0_E_Loop", cast: "FP_Gumshoe_S0_E_Fire", hand: "R", rel: 0.09 },
  gaunt: { eq: "FP_Hunter_S0_E_Equip", idle: "FP_Hunter_S0_E_IdleAdd", cast: "FP_Hunter_S0_E_Deploy", hand: "L", rel: 0.05 },
  boom: { eq: "FP_Clay_S0_E_Equip", idle: "FP_Clay_S0_E_Idle", cast: "FP_Clay_S0_E_Cast", hand: "L", rel: 0.45 },
  bomb: { eq: "FP_Killjoy_S0_X_Bomb_Equip", idle: "FP_Killjoy_S0_X_Bomb_Idle", cast: "FP_Killjoy_S0_X_Bomb_Deploy", hand: "L", rel: 0.3 },
  trade: { eq: "FP_Deadeye_S0_4_WallTrap_Equip", idle: "FP_Deadeye_S0_4_WallTrap_Idle", cast: "FP_Deadeye_S0_4_WallTrap_Place", hand: "R", rel: 0.16 },
  rdv: { eq: "FP_Deadeye_S0_E_TetherTP_Equip", idle: "FP_Deadeye_S0_E_TetherTP_Idle", cast: "FP_Deadeye_S0_E_First_Place_ArmsDown", hand: "R", rel: 0.06 },
  // Sova's bow: the left arm raises the bow (Owl Drone gauntlet raise, left-side tracks) while the right hand holds the
  // bolt (grenade-ready right-side tracks); HOLD FIRE draws the string back with the charge (xAfBowDraw).
  bow: { eq: "FP_Hunter_S0_E_Equip", idle: "FP_Hunter_S0_E_IdleAdd", cast: "FP_Hunter_S0_E_Deploy", hand: "R", rel: 0.05, rEq: "FP_Killjoy_S0_4_Grenade_Equip", rIdle: "FP_Killjoy_S0_4_Swarm_Idle", rCast: "FP_Core_Grenade_UnderhandThrow" },
};
// Per agent, per key (c q e x): archetype set + held item. prop: native glb (slug) held at its bone (WeaponMaster of the
// set's hand unless the glb's own FP bone is given) scaled to sz metres; orb: an energy orb in the palm (agent VFX colour).
var XAF_K = {
  Jett: { c: { s: "flick", orb: 0xd8f4ff }, q: { s: "gaunt", orb: 0xd8f4ff }, e: { s: "gaunt", orb: 0xd8f4ff } },
  Phoenix: { c: { s: "flick", orb: 0xff7a1a }, q: { s: "nade", orb: 0xff7a1a }, e: { s: "flick", orb: 0xfff1b0 }, x: { s: "flick", orb: 0xff7a1a } },
  Sova: { c: { s: "gaunt", prop: "owl-drone", sz: 0.22, bone: "Gauntlet_Socket" }, q: { s: "bow", prop: "shock-dart", sz: 0.32, bolt: 1 }, e: { s: "bow", prop: "recon-bolt", sz: 0.32, bolt: 1 }, x: { s: "bow", orb: 0x4fc3ff } },
  Sage: { c: { s: "flick", orb: 0x5fe6c8 }, q: { s: "nade", orb: 0x5fe6c8 }, e: { s: "flick", orb: 0x8dffd8 }, x: { s: "flick", orb: 0x8dffd8 } },
  Reyna: { c: { s: "flick", orb: 0xb05cff }, q: { s: "flick", orb: 0xb05cff }, e: { s: "flick", orb: 0xb05cff }, x: { s: "flick", orb: 0xb05cff } },
  Omen: { c: { s: "flick", orb: 0x6a4cff }, q: { s: "flick", orb: 0x6a4cff }, e: { s: "nade", orb: 0x6a4cff }, x: { s: "flick", orb: 0x6a4cff } },
  Killjoy: { c: { s: "nade", prop: "nanoswarm", sz: 0.11 }, q: { s: "place", prop: "alarmbot", sz: 0.16 }, e: { s: "place", prop: "turret", sz: 0.2 }, x: { s: "bomb", prop: "lockdown", sz: 0.24 } },
  Raze: { c: { s: "boom", prop: "boom-bot", sz: 0.22 }, q: { s: "nade", prop: "blast-pack", sz: 0.12 }, e: { s: "paint", prop: "paintshell", sz: 0.13 }, x: { s: "flick", orb: 0xff8a1f } },
  Skye: { c: { s: "flick", orb: 0x8aff5a }, q: { s: "wolf", orb: 0x8aff5a }, e: { s: "flick", orb: 0xc8ff8a }, x: { s: "flick", orb: 0x8aff5a } },
  Breach: { c: { s: "gaunt", orb: 0xff8a3a }, q: { s: "gaunt", orb: 0xffd36a }, e: { s: "gaunt", orb: 0xff8a3a }, x: { s: "gaunt", orb: 0xff8a3a } },
  Cypher: { c: { s: "place", prop: "trapwire", sz: 0.12 }, q: { s: "nade", orb: 0xe8e8e8 }, e: { s: "place", prop: "spycam", sz: 0.12 }, x: { s: "flick", orb: 0xe8e8e8 } },
  Chamber: { c: { s: "trade", prop: "trademark", sz: 0.14 }, q: { s: "flick", orb: 0xd8b04a }, e: { s: "rdv", prop: "rendezvous", sz: 0.14 }, x: { s: "flick", orb: 0xd8b04a } },
};
var XAF = { rig: {}, cur: null, on: false, t: 0, mode: "", err: null, last: null };
function xAfSpec(ag, k) { const a = XAF_K[ag] || XAF_K.Jett, s = a[k] || a.c; return s; }
function xAfLoad(ag) { // the agent's native FP arms + the shared ability clips -> one cached ability rig per agent
  if (XAF.rig[ag]) return XAF.rig[ag];
  const P = Promise.all([xvLoad(ag.toLowerCase() + "-fp"), xvLoad("animations/FP_Abilities")]).then(([arms, don]) => {
    const sc = THREE.SkeletonUtils.clone(arms.scene), root = new THREE.Group(); root.name = "valorant-ability-viewmodel"; root.add(sc); root.rotation.y = Math.PI / 2;
    sc.traverse((o) => { if (o.isMesh) { o.frustumCulled = false; o.castShadow = o.receiveShadow = false; o.raycast = XNR; o.renderOrder = 10; const conv = (m) => new THREE.MeshLambertMaterial({ name: m.name, color: m.color, map: m.map, side: THREE.DoubleSide }); o.material = Array.isArray(o.material) ? o.material.map(conv) : conv(o.material); } });
    const am = new THREE.AnimationMixer(sc), clips = {};
    (don.animations || []).forEach((c) => { clips[c.name] = c; }); (arms.animations || []).forEach((c) => { clips[c.name] = c; }); // the agent's own authored clip wins
    const R = { ag, root, sc, am, clips, ac: {}, props: {}, sock: {}, cur: "", rcur: "" };
    const cam = sc.getObjectByName("Camera"); am.update(0); sc.updateMatrixWorld(true);
    const pos = cam ? cam.getWorldPosition(new THREE.Vector3()) : new THREE.Vector3(0, 1.67, 0); root.position.copy(pos).negate();
    root.visible = false; return R;
  });
  XAF.rig[ag] = P; P.then((R) => { XAF.rig[ag] = R; }, (e) => { XAF.err = String(e); XAF.rig[ag] = { failed: String(e) }; });
  return P;
}
function xAfReady(ag) { const R = XAF.rig[ag]; return R && R.sc ? R : null; }
function xAfSide(c, side) { // a clip restricted to one arm's tracks (L_ or R_ bones), for the two-handed bow pose
  const k = c.name + "|" + side; xAfSide.c = xAfSide.c || {}; if (xAfSide.c[k]) return xAfSide.c[k];
  const re = new RegExp("^" + side + "_"); return (xAfSide.c[k] = new THREE.AnimationClip(k, c.duration, c.tracks.filter((t) => re.test(t.name.split(".")[0]))));
}
function xAfAct(R, name, side) { const c0 = R.clips[name]; if (!c0) return null; const c = side ? xAfSide(c0, side) : c0, key = c.name; return R.ac[key] || (R.ac[key] = R.am.clipAction(c)); }
function xAfPose(R, name, u, rName, ru) { // sample clip `name` at fraction u (and, for the bow, the right arm from rName at ru)
  const a = xAfAct(R, name, rName ? "L" : ""), b = rName ? xAfAct(R, rName, "R") : null; if (!a) return false;
  const key = name + "|" + (rName || ""); if (R.cur !== key) { R.am.stopAllAction(); a.reset().play(); if (b) b.reset().play(); R.cur = key; }
  const set = (x, v) => { if (x) x.time = Math.min(x.getClip().duration - 0.001, Math.max(0, v) * x.getClip().duration); };
  set(a, u); if (b) set(b, ru); R.am.update(0); return true;
}
function xAfBone(R, n) { return R.sock[n] || (R.sock[n] = R.sc.getObjectByName(n)); }
function xAfPalm(R, side) { // a socket in the palm, child of the hand bone (between the wrist and the middle knuckle)
  const k = "palm" + side; if (R.sock[k]) return R.sock[k];
  const h = xAfBone(R, side + "_Hand"), m = xAfBone(R, side + "_Middle1"), s = new THREE.Object3D(); s.name = "xaf-palm-" + side;
  if (h) { h.add(s); if (m) { R.sc.updateMatrixWorld(true); const w = h.getWorldPosition(new THREE.Vector3()).lerp(m.getWorldPosition(new THREE.Vector3()), 0.55); s.position.copy(h.worldToLocal(w)); } }
  return (R.sock[k] = s);
}
function xAfProp(R, sp, set) { // the item held for this ability (cached per rig)
  const key = sp.prop || "orb" + (sp.orb || 0).toString(16); let P = R.props[key];
  if (!P) {
    P = R.props[key] = { g: new THREE.Group(), ok: false }; P.g.name = "xaf-prop-" + key; P.g.visible = false;
    if (sp.prop) xvLoad(sp.prop).then((gl) => { const o = THREE.SkeletonUtils.clone(gl.scene), b = new THREE.Box3().setFromObject(o), s = b.getSize(new THREE.Vector3()), m = Math.max(s.x, s.y, s.z) || 1, c = b.getCenter(new THREE.Vector3());
      o.traverse((x) => { if (x.isMesh) { x.frustumCulled = false; x.castShadow = x.receiveShadow = false; x.raycast = XNR; x.renderOrder = 11; } });
      const k = (sp.sz || 0.15) / m; o.scale.setScalar(k); o.position.copy(c).multiplyScalar(-k); P.g.add(o); P.ok = true; }).catch((e) => { XAF.err = String(e); });
    else { const mat = new THREE.MeshBasicMaterial({ color: sp.orb || 0xffffff, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }),
        core = new THREE.Mesh(new THREE.SphereGeometry(0.03, 16, 12), mat), halo = new THREE.Mesh(new THREE.SphereGeometry(0.055, 16, 12), mat.clone());
      halo.material.opacity = 0.35; [core, halo].forEach((x) => { x.frustumCulled = false; x.raycast = XNR; x.renderOrder = 11; }); P.g.add(core, halo); P.halo = halo; P.ok = true; }
  }
  const hand = set.hand || "R", bone = sp.prop ? (sp.bone && xAfBone(R, sp.bone)) || xAfPalm(R, hand) : xAfPalm(R, hand);
  if (P.g.parent !== bone && bone) bone.add(P.g);
  for (const k in R.props) if (R.props[k] !== P) R.props[k].g.visible = false;
  xAfBow(R, set === XAF_SET.bow);
  return P;
}
function xAfBow(R, on) { // Sova's bow in the left fist (no bow glb ships with the assets): limbs bent back toward the archer + string, upright in view
  let b = R.bow;
  if (!b && on) {
    const r = 0.35, th = 0.8, m = new THREE.MeshLambertMaterial({ color: 0x2c4a6e }), e = new THREE.MeshBasicMaterial({ color: 0x9fe3ff, fog: false });
    b = R.bow = new THREE.Group(); b.name = "xaf-prop-bow";
    const limbs = new THREE.Mesh(new THREE.TorusGeometry(r, 0.011, 6, 30, 2 * th), m); limbs.rotation.set(0, Math.PI / 2, -th); limbs.position.z = r; // arc in the view's YZ plane, apex at the grip
    const str = new THREE.Mesh(new THREE.CylinderGeometry(0.002, 0.002, 2 * r * Math.sin(th), 4), e); str.position.z = r * (1 - Math.cos(th));
    const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.017, 0.017, 0.11, 8), m);
    b.add(limbs, str, grip); b.userData.str = str; b.traverse((x) => { if (x.isMesh) { x.frustumCulled = false; x.raycast = XNR; x.renderOrder = 11; } });
    xAfPalm(R, "L").add(b);
  }
  if (!b) return; b.visible = !!on; if (!on) return;
  const cam = R.root.parent; if (!cam || !b.parent) return; // keep the bow upright in the view whatever the fist's bone axes
  cam.updateMatrixWorld(true); const qc = cam.getWorldQuaternion(new THREE.Quaternion()), qp = b.parent.getWorldQuaternion(new THREE.Quaternion());
  b.quaternion.copy(qp.invert().multiply(qc).multiply(XAF.bowQ || (XAF.bowQ = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0.75, 0.3))))); // canted and turned so the limbs read, as Valorant holds it
}
function xAfBowDraw(R, pw) { // HOLD FIRE: the right hand pulls the bolt back toward the cheek with the charge (0..1)
  const s = xAfBone(R, "R_Shoulder"), e = xAfBone(R, "R_Elbow"); if (!s || !e || !(pw > 0)) return;
  const q = new THREE.Quaternion(); q.setFromEuler(new THREE.Euler(0, 0, -0.55 * pw)); s.quaternion.multiply(q); q.setFromEuler(new THREE.Euler(0, 0, 0.9 * pw)); e.quaternion.multiply(q);
}
// Pure timing: which clip of the set plays at which fraction for an equip state (exported for tests).
function xAfPhase(set, q, rel, rec) {
  const c = (x) => Math.max(0, Math.min(1, x)), f = q.alt && set.alt ? set.arel || set.rel : set.rel, cast = q.alt && set.alt ? set.alt : set.cast;
  if (q.st === "draw") return { ph: "equip", clip: set.eq, u: c(1 - q.t / (q.d0 || XABT.draw)), item: true };
  if (q.st === "ready" || q.st === "hold") return { ph: q.st === "hold" ? "hold" : "idle", clip: set.idle, u: -1, item: true };
  if (q.st === "rel") return { ph: "cast", clip: cast, u: c(f * (1 - q.t / rel)), item: true };
  if (q.st === "rec") return { ph: "recover", clip: cast, u: c(f + (1 - f) * (1 - q.t / rec)), item: false };
  return null;
}
function xAfHideGun() { gun.visible = false; knife.visible = false; if (typeof XV !== "undefined" && XV.fp && XV.fp.root) XV.fp.root.visible = false; }
function xAfOff() {
  const R = XAF.cur; XAF.on = false; XAF.mode = ""; if (!R) return; R.root.visible = false; for (const k in R.props) R.props[k].g.visible = false;
  try { if (XV.fp) { XV.fp.kind = null; xvFPPlay(XV.fp, "equip"); } } catch (e) {} // the gun comes back with its native equip
}
function xAfShow(R) { if (XAF.cur && XAF.cur !== R) XAF.cur.root.visible = false; XAF.cur = R; if (R.root.parent !== camera) camera.add(R.root); R.root.visible = true; XAF.on = true; }
function xAfTick(dt) {
  XAF.t += dt; const q = J.eq, live = running && player && player.hp > 0 && jOn(), ag = J.pick || "Jett";
  const quick = live && !q && XCA.on, want = live && (q || quick);
  if (!want) { if (XAF.on) xAfOff(); return; }
  if (running) xAfLoad(ag);
  xAfHideGun(); // Valorant swaps straight from the gun to the ability arms: the gun is never drawn while an ability is out
  const k = q ? q.k : XAF.qk || "c", sp = xAfSpec(ag, k), set = XAF_SET[sp.s] || XAF_SET.nade;
  let P;
  if (q) P = xAfPhase(set, q, XABT.rel, XABT.rec);
  else { const T = XCA.D + XCA.G + XCA.U, u = Math.min(1, XCA.t / T); P = { ph: "quick", clip: set.cast, u, item: u < set.rel }; }
  XAF.on = true; XAF.mode = P.ph;
  const R = xAfReady(ag); if (!R) { if (XAF.cur) XAF.cur.root.visible = false; XAF.last = { ag, k, set: sp.s, ph: P.ph, clip: P.clip, u: P.u, item: false, rig: false }; return; } // still loading (or failed): no hands, never the old primitives
  xAfShow(R);
  const idleU = (name) => { const c = R.clips[name]; return c ? ((XAF.t * 2.5) % c.duration) / c.duration : 0; }; // authored idle loops play ~2.5x their glb time base
  const u = P.u < 0 ? idleU(P.clip) : P.u;
  if (sp.s === "bow") { const rc = P.ph === "equip" ? set.rEq : P.ph === "cast" || P.ph === "recover" || P.ph === "quick" ? set.rCast : set.rIdle; xAfPose(R, P.clip, u, rc, P.u < 0 ? idleU(rc) : u); if (q && P.ph === "hold") xAfBowDraw(R, xEqHoldPw(q)); }
  else if (!xAfPose(R, P.clip, u)) xAfPose(R, XAF_SET.nade[P.ph === "equip" ? "eq" : P.ph === "hold" || P.ph === "idle" ? "idle" : "cast"], u);
  const it = xAfProp(R, sp, set); it.g.visible = !!P.item && it.ok;
  if (it.halo) it.halo.scale.setScalar(1 + 0.12 * Math.sin(XAF.t * 7));
  XAF.last = { ag, k, set: sp.s, ph: P.ph, clip: P.clip, u, item: it.g.visible, rig: true };
}
{ const v2 = vmTick; vmTick = function (dt) { v2.apply(this, arguments); try { xAfTick(dt); } catch (e) { if (!XAF.err) { XAF.err = String(e); console.warn("ability viewmodel", e); } } }; }
{ const s1 = xCaStart; xCaStart = function () { try { XAF.qk = XAF.nk || "c"; } catch (e) {} return s1.apply(this, arguments); }; }
{ const k1 = jKey; jKey = function (code) { if (typeof code === "string" && /^Key[CQEX]$/.test(code)) XAF.nk = code[3].toLowerCase(); return k1.apply(this, arguments); }; }
// the agent's ability rig is warmed with the weapons once a match runs (no hitch on the first equip)
(window.XHK = window.XHK || []).push(() => { try { if (running && player && jOn()) xAfLoad(J.pick || "Jett"); } catch (e) {} });
window.xAbilityFP = { XAF, XAF_SET, XAF_K, phase: xAfPhase, load: xAfLoad };
// ---- END ABILITY FIRST PERSON ----
