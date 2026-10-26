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
// Borrowed sets follow how each ability is cast in Valorant: Phoenix Curveball (Q) is a quick side flick (hawk-cast, as Skye's
// thrown flash) and Hot Hands (E) a lobbed throw with an underhand ALT (grenade set); Sage Resurrection (X) pushes the hand
// straight out (Trailblazer cast); Sage Barrier Orb (C) is set down in front (Cypher place). Sova's bow is his own
// model (agents/sova.glb Bow_Static mesh, xAfBowMesh). Nothing in models/valorant matches the rest of Breach / Reyna / Omen / Jett better.
// Per agent, per key (c q e x): archetype set + held item. prop: native glb (slug) held at its bone (WeaponMaster of the
// set's hand unless the glb's own FP bone is given) scaled to sz metres; orb: an energy orb in the palm (agent VFX colour).
var XAF_K = {
  Jett: { c: { s: "flick", orb: 0xd8f4ff }, q: { s: "gaunt", orb: 0xd8f4ff }, e: { s: "gaunt", orb: 0xd8f4ff } },
  Phoenix: { c: { s: "flick", orb: 0xff7a1a }, q: { s: "flick", orb: 0xfff1b0 }, e: { s: "nade", orb: 0xff7a1a }, x: { s: "flick", orb: 0xff7a1a } },
  Sova: { c: { s: "gaunt", prop: "owl-drone", sz: 0.22, bone: "Gauntlet_Socket" }, q: { s: "bow", prop: "shock-dart", sz: 0.32, bolt: 1 }, e: { s: "bow", prop: "recon-bolt", sz: 0.32, bolt: 1 }, x: { s: "bow", orb: 0x4fc3ff } },
  Sage: { c: { s: "place", orb: 0x5fe6c8 }, q: { s: "nade", orb: 0x5fe6c8 }, e: { s: "flick", orb: 0x8dffd8 }, x: { s: "wolf", orb: 0x8dffd8 } },
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
function xAfBowMesh(gl) { // Sova's own bow: the Hunter_Bow primitives of his agent model (agents/sova.glb, skinned to the Bow_Static bone; no FP bow glb ships), baked static in that bone's space and centred on the grip
  const g = new THREE.Group(), box = new THREE.Box3();
  gl.scene.traverse((o) => { if (!o.isSkinnedMesh) return; const mats = [].concat(o.material); if (!mats.some((m) => /^Hunter_Bow/.test(m.name))) return;
    const bi = o.skeleton.bones.findIndex((b) => b.name === "Bow_Static"); if (bi < 0) return;
    const geo = o.geometry.clone(); geo.deleteAttribute("skinIndex"); geo.deleteAttribute("skinWeight"); geo.applyMatrix4(new THREE.Matrix4().multiplyMatrices(o.skeleton.boneInverses[bi], o.bindMatrix));
    const conv = (m) => new THREE.MeshLambertMaterial({ name: m.name, color: m.color, map: m.map, emissive: /Emissive/.test(m.name) ? 0x3fb8ff : 0x000000, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(geo, Array.isArray(o.material) ? o.material.map(conv) : conv(o.material)); geo.computeBoundingBox(); box.union(geo.boundingBox); g.add(mesh); });
  const c = box.isEmpty() ? new THREE.Vector3() : box.getCenter(new THREE.Vector3()); g.children.forEach((m) => m.position.sub(c)); g.userData.size = box.isEmpty() ? 0 : box.getSize(new THREE.Vector3()).y;
  return g;
}
function xAfBow(R, on) { // the bow in Sova's left fist, upright in view (limbs along the view's up axis, curve toward the aim)
  let b = R.bow;
  if (!b && on) {
    b = R.bow = new THREE.Group(); b.name = "xaf-prop-bow"; const inner = new THREE.Group(); inner.rotation.y = Math.PI / 2; b.add(inner); // bow-bone x (limb curve) -> view forward, y (limbs) -> view up
    xvLoad("agents/sova").then((gl) => { const m = xAfBowMesh(gl); if (!m.children.length) return; m.scale.setScalar(XAF.bowH / (m.userData.size || XAF.bowH)); m.traverse((x) => { if (x.isMesh) { x.frustumCulled = false; x.raycast = XNR; x.renderOrder = 11; } }); inner.add(m); b.userData.ok = true; }).catch((e) => { XAF.err = String(e); });
    xAfPalm(R, "L").add(b);
  }
  if (!b) return; b.visible = !!on; if (!on) return;
  const cam = R.root.parent; if (!cam || !b.parent) return; // keep the bow upright in the view whatever the fist's bone axes
  cam.updateMatrixWorld(true); const qc = cam.getWorldQuaternion(new THREE.Quaternion()), qp = b.parent.getWorldQuaternion(new THREE.Quaternion());
  b.quaternion.copy(qp.invert().multiply(qc).multiply(XAF.bowQ || (XAF.bowQ = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0.75, 0.3))))); // canted and turned so the limbs read, as Valorant holds it
}
XAF.bowH = 0.78; // held bow height in view (m): the stowed model is 0.57 m on his back
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
// ---- ult / ability guns on the same native arms ----
// Raze Showstopper, Chamber Headhunter / Tour De Force and Jett Blade Storm are held weapons in Valorant, each with its own
// authored first-person set on the agent's FP rig (raze-fp / chamber-fp / jett-fp .glb; durations are the SequenceLength
// of <agent>-fp.json). Showstopper ships its own skinned glb + AB_ clips (showstopper.json); Headhunter and Tour De Force
// ship no model, so the closest native weapon stands in, in the same R_WeaponMaster slot the guns use (xvFPLoad): the
// Sheriff (Valorant's heavy revolver) for Headhunter, the Operator (bolt sniper) for Tour De Force. Blade Storm floats
// its daggers around the open hands (the kunai are original 3D geometry built here, xKunai - hk-41) and throws them with the Wushu Attack01-05
// set, alternating the throwing hand as authored. Equip = the authored equip clip over the gameplay windup where one
// exists (XAB_WIND showstopper 1.4 s / tourDeForce 2.3 s), otherwise over its authored length; a fire plays the fire clip
// at authored speed (interrupted by the next fire); idle loops at its authored length.
var XAF_GUN = {
  rk: { ag: "Raze", model: "showstopper", eq: "FP_Clay_S0_X_RocketLauncher_Equip", idle: "FP_Clay_S0_X_RocketLauncher_Idle", fire: ["FP_Clay_S0_X_RocketLauncher_Fire"],
    gun: { FP_Clay_S0_X_RocketLauncher_Equip: "AB_Clay_S0_X_RocketLauncher_Equip", FP_Clay_S0_X_RocketLauncher_Idle: "AB_Clay_S0_X_RocketLauncher_Idle", FP_Clay_S0_X_RocketLauncher_Fire: "AB_Clay_S0_X_RocketLauncher_Fire" },
    L: { eq: 1.9167, idle: 3.1667, fire: [0.8333] }, wind: "showstopper" },
  hp: { ag: "Chamber", model: "sheriff", standIn: "Headhunter", eq: "FP_Deadeye_S0_Q_DestabilizePistol_Equip", idle: "FP_Deadeye_S0_Q_DestabilizePistol_Idle", fire: ["FP_Deadeye_S0_Q_DestabilizePistol_Fire"], L: { eq: 1, idle: 3, fire: [0.8333] } },
  // Blade Storm: daggers floating around the open hands (xAfKnifeRing); Attack01-05 flick right, left, right, left, right
  // (peak hand speed on the clips: R 0.05, L 0.05, R 0.1, L 0.1, R 0.05 of the clip); RightClickAttack is the two-handed flurry.
  bs: { ag: "Jett", knives: 1, eq: "FP_Wushu_S0_X_Equip", idle: "FP_Wushu_S0_X_Idle", fire: ["FP_Wushu_S0_X_Attack01", "FP_Wushu_S0_X_Attack02", "FP_Wushu_S0_X_Attack03", "FP_Wushu_S0_X_Attack04", "FP_Wushu_S0_X_Attack05"],
    hand: ["R", "L", "R", "L", "R"], rel: [0.06, 0.06, 0.1, 0.1, 0.06], alt: "FP_Wushu_S0_X_RightClickAttack", arel: 0.08,
    L: { eq: 1.6667, idle: 3.9833, fire: [0.9667, 1.15, 0.9833, 1.0667, 0.8667], alt: 1.3 } },
  sn: { ag: "Chamber", model: "operator", standIn: "Tour De Force", eq: "FP_Deadeye_S0_X_Ultimate_Equip", idle: "FP_Deadeye_S0_X_Ultimate_Idle", fire: ["FP_Deadeye_S0_X_Ultimate_Fire"], L: { eq: 3, idle: 3, fire: [2.6167] }, wind: "tourDeForce" },
};
XAF.gs = null;
function xAfGunEqT(G) { return G.wind && typeof XAB_WIND !== "undefined" && XAB_WIND[G.wind] ? XAB_WIND[G.wind] : G.L.eq; }
// Pure timing (exported for tests): s = { t: s since the equip, f: s since the last fire (-1 none), n: fires so far, alt, fired }
function xAfGunPhase(G, s, eqT) {
  const i = Math.max(0, (s.n | 0) - 1) % G.fire.length, alt = !!(s.alt && G.alt), fc = alt ? G.alt : G.fire[i], fl = alt ? G.L.alt : G.L.fire[i], eq = eqT == null ? xAfGunEqT(G) : eqT;
  if (s.f >= 0 && s.f < fl) return { ph: "fire", clip: fc, u: s.f / fl, i, alt };
  if (!s.fired && s.t < eq) return { ph: "equip", clip: G.eq, u: Math.max(0, s.t) / eq };
  const it = s.fired ? s.f - fl : s.t - eq; return { ph: "idle", clip: G.idle, u: (Math.max(0, it) % G.L.idle) / G.L.idle };
}
function xAfGunModel(R, k) { // the gun of key k in the agent rig's weapon slot (cached per rig)
  R.guns = R.guns || {}; let M = R.guns[k]; if (M) return M; const G = XAF_GUN[k];
  M = R.guns[k] = { g: new THREE.Group(), ok: false, gm: null, ga: {} }; M.g.name = "xaf-prop-gun-" + k; M.g.visible = false;
  const slot = xAfBone(R, G.bone || "R_WeaponMaster"); if (slot) slot.add(M.g); const r = G.rot || [0, 90, 0]; M.g.rotation.set(r[0] * Math.PI / 180, r[1] * Math.PI / 180, r[2] * Math.PI / 180);
  if (G.knives) { M.g.rotation.set(0, 0, 0); if (M.g.parent) M.g.parent.remove(M.g); M.k = []; // floating ring in camera space (xAfKnifeRing), not in the hands
    try { for (let i = 0; i < XAF_KR.length; i++) { const w = xAfKnife(null, i); M.k.push(w); M.g.add(w); } M.ok = true; } catch (e) { XAF.err = String(e); } } // the kunai are built here (xKunai), no model to load
  else if (G.model) xvLoad(G.model).then((gl) => { const o = THREE.SkeletonUtils.clone(gl.scene);
    o.traverse((x) => { if (x.isMesh) { x.frustumCulled = false; x.castShadow = x.receiveShadow = false; x.raycast = XNR; x.renderOrder = 11; x.material = Array.isArray(x.material) ? x.material.map((m) => m.clone()) : x.material.clone(); } });
    M.g.add(o); if (G.gun && gl.animations && gl.animations.length) { M.gm = new THREE.AnimationMixer(o); gl.animations.forEach((c) => { M.ga[c.name] = M.gm.clipAction(c); }); } M.ok = true; }).catch((e) => { XAF.err = String(e); });
  return M;
}
// Blade Storm daggers FLOAT around the view in Valorant (hands open, palms down, the kunai hovering beside them: two at the
// left edge pointing in, one under the crosshair pointing up, two at the right edge), they are never gripped. hk-37 replaced
// the old 'tactical knife in each palm' (a 26 cm combat knife poking out of an open authored hand). Slots are screen
// fractions measured off Valorant's own Blade Storm view (16:9) at ~0.7 m, knife ~0.24 m (hk-41: the kunai is built by xKunai;
// the melee.glb tactical knife stood in before); one slot per dagger left, in throw order. Pure layout (exported for tests).
var XAF_KR = [[0.11, 0.58, 1, 0.05], [0.13, 0.73, 1, -0.1], [0.53, 0.86, 0, 1], [0.88, 0.69, -1, -0.05], [0.87, 0.52, -1, 0.1]]; // [sx, sy, dir x, dir y]
function xAfKnifeRing(n, aspect, fov, t) { // n daggers left -> camera-space [{p:[x,y,z], d:[x,y,z]}] for the first n slots
  const tv = Math.tan(fov * Math.PI / 360), th = tv * Math.min(aspect, 16 / 9), D = 0.7 * Math.tan(70.53 * Math.PI / 360) / tv, out = []; // across: the 16:9 frame the rig is framed in (wider phones keep the daggers by the hands);
  // D: 0.7 m at the 70.53 deg 16:9 lens, pushed out as the hip lens narrows (wider than 16:9 caps the horizontal at 103 deg, db9313f) so each dagger keeps its share of the screen (844x390: the centre one was cut 3 px at the bottom)
  for (let i = 0; i < Math.min(n | 0, XAF_KR.length); i++) { const [sx, sy, dx, dy] = XAF_KR[i], b = Math.sin((t || 0) * 2.1 + i * 1.7) * 0.012; // a slow hover
    const x = (sx * 2 - 1) * th * D, y = -(sy * 2 - 1) * tv * D + b, L = Math.hypot(dx * 0.85, dy * 0.85, 0.5);
    out.push({ p: [x, y, -D], d: [dx * 0.85 / L, dy * 0.85 / L, -0.5 / L] }); }
  return out;
}
// hk-41 (user 13:17 "jett's ultimate looks weird (it looks like 2d png's of knives)"): the stand-in was the black tactical melee
// knife turned flat to the eye, which read as a cut-out. Blade Storm daggers are now a KUNAI built here as real 3D geometry
// (original model, no game asset): a leaf-shaped blade with a diamond cross-section (flat-shaded facets, centre ridge both
// faces), a collar, a wrapped grip and a ring pommel, pale steel with an ice-blue emissive glow and a soft additive edge shell;
// rolled 0.5 rad about its length so the facets catch the light instead of showing a flat silhouette. Same contract as before:
// ~0.24 m long, blade end along local +z, flat-face normal along local +x (gl is unused; the callers still pass the melee set).
var XKUN = { len: 0.25, roll: 0.5, mat: null };
function xKunMats() {
  if (XKUN.mat) return XKUN.mat;
  const S = (o) => new THREE.MeshStandardMaterial(o);
  XKUN.mat = {
    blade: S({ color: 0xdcecf8, metalness: 0.5, roughness: 0.28, emissive: 0x3aaee8, emissiveIntensity: 0.26, flatShading: true }),
    edge: new THREE.MeshBasicMaterial({ color: 0x8fe4ff, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.BackSide }),
    grip: S({ color: 0x1f2b3a, metalness: 0.2, roughness: 0.75, emissive: 0x061018, emissiveIntensity: 1 }),
    metal: S({ color: 0xcfe6f7, metalness: 0.6, roughness: 0.3, emissive: 0x3aa6dc, emissiveIntensity: 0.45 }),
    trail: new THREE.MeshBasicMaterial({ color: 0x9fe8ff, transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
  };
  return XKUN.mat;
}
function xKunBladeGeo(sc) { // diamond cross-section leaf blade from z = 0 (collar) to the tip; width along y, thickness along x
  const N = 14, L = 0.155, P = [];
  const ring = (t) => { const w = (t < 0.28 ? 0.62 + 0.38 * t / 0.28 : Math.pow((1 - t) / 0.72, 0.85)) * 0.023 * sc, th = 0.0006 + w * 0.32; return [[0, w], [th, 0], [0, -w], [-th, 0]]; };
  for (let k = 0; k < N; k++) { const t0 = k / N, t1 = (k + 1) / N, A = ring(t0), B = ring(t1), z0 = t0 * L, z1 = t1 * L;
    for (let j = 0; j < 4; j++) { const a0 = A[j], a1 = A[(j + 1) % 4], b0 = B[j], b1 = B[(j + 1) % 4];
      P.push(a0[0], a0[1], z0, a1[0], a1[1], z0, b1[0], b1[1], z1, a0[0], a0[1], z0, b1[0], b1[1], z1, b0[0], b0[1], z1); } }
  const R = ring(0); for (let j = 0; j < 4; j++) { const a = R[j], b = R[(j + 1) % 4]; P.push(0, 0, 0, b[0], b[1], 0, a[0], a[1], 0); } // the base cap
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(P, 3)); g.computeVertexNormals(); return g;
}
function xKunRingGeo() { // the pommel ring: a small circle swept around the z axis (lathe), turned into the y-z plane later
  const pts = []; for (let k = 0; k <= 8; k++) { const a = (k / 8) * Math.PI * 2; pts.push(new THREE.Vector2(0.0115 + Math.cos(a) * 0.0024, Math.sin(a) * 0.0024)); }
  return new THREE.LatheGeometry(pts, 18);
}
function xKunai() { // one kunai group (local frame: tip +z, flat-face normal +x), centred on its length
  const m = xKunMats(), G = XKUN.geo || (XKUN.geo = { blade: xKunBladeGeo(1), edge: xKunBladeGeo(1.22), grip: new THREE.CylinderGeometry(0.0056, 0.006, 0.062, 10), band: new THREE.CylinderGeometry(0.0068, 0.0068, 0.004, 10), collar: new THREE.CylinderGeometry(0.0075, 0.0062, 0.012, 10), ring: xKunRingGeo() });
  const k = new THREE.Group(), add = (geo, mat, z, rx, ry) => { const o = new THREE.Mesh(geo, mat); o.position.z = z; if (rx) o.rotation.x = rx; if (ry) o.rotation.y = ry; k.add(o); return o; };
  add(G.blade, m.blade, 0); const e = add(G.edge, m.edge, -0.004); e.scale.set(1.6, 1, 1.05);
  add(G.collar, m.metal, -0.006, Math.PI / 2); add(G.grip, m.grip, -0.043, Math.PI / 2);
  for (const z of [-0.02, -0.043, -0.066]) add(G.band, m.metal, z, Math.PI / 2);
  add(G.ring, m.metal, -0.087).rotation.z = Math.PI / 2; // lathe axis (y) -> x: the ring lies in the y-z plane, in line with the blade
  k.position.z = -0.027; return k; // blade tip 0.155 .. ring end -0.101
}
function xAfKnife(gl, i) { // one dagger: the kunai, ~0.25 m, blade end along local +z, flat face along local +x
  const w = new THREE.Group(), q = new THREE.Group(), k = xKunai(); q.rotation.z = XKUN.roll; q.add(k); w.add(q); w.name = "xaf-knife-" + i;
  k.traverse((x) => { if (x.isMesh) { x.frustumCulled = false; x.castShadow = x.receiveShadow = false; x.raycast = XNR; x.renderOrder = 11; } });
  w.visible = false;
  return w;
}
function xKunTrail() { // a soft additive streak behind a thrown kunai (open cone, apex trailing)
  const g = XKUN.tg || (XKUN.tg = new THREE.ConeGeometry(0.014, 0.7, 8, 1, true)), o = new THREE.Mesh(g, xKunMats().trail.clone());
  o.rotation.x = -Math.PI / 2; o.position.z = -0.42; o.name = "xbtp-trail"; o.frustumCulled = false; o.raycast = XNR; return o;
}
function xAfDrawnBox(o) { // box of the model as DRAWN: skinned vertices through their bones (the bind-pose box of the skinned knife is turned 90 deg)
  const B = new THREE.Box3(), v = new THREE.Vector3(), inv = new THREE.Matrix4().copy(o.matrixWorld).invert(), m = new THREE.Matrix4();
  o.traverse((x) => { if (!x.isMesh || !x.geometry || !x.geometry.attributes.position) return; const P = x.geometry.attributes.position, bt = x.isSkinnedMesh ? (x.applyBoneTransform || x.boneTransform) : null;
    if (x.isSkinnedMesh && x.skeleton) x.skeleton.update(); m.multiplyMatrices(inv, x.matrixWorld);
    for (let k = 0; k < P.count; k++) { v.fromBufferAttribute(P, k); if (bt) bt.call(x, k, v); v.applyMatrix4(m); B.expandByPoint(v); } });
  return B.isEmpty() ? new THREE.Box3().setFromObject(o) : B;
}
function xAfKnifePose(R, M, n) { // place the floating daggers (camera space: a sibling of the rig root under the camera)
  const cam = R.root.parent; if (!cam || !M.k) return 0; if (M.g.parent !== cam) cam.add(M.g);
  const fov = cam.fov || 70, asp = cam.aspect || 16 / 9, ring = xAfKnifeRing(n, asp, fov, XAF.t), d = new THREE.Vector3(), nx = new THREE.Vector3(), ny = new THREE.Vector3(), B = new THREE.Matrix4();
  for (let i = 0; i < M.k.length; i++) { const w = M.k[i], r = ring[i]; w.visible = !!r; if (!r) continue; w.position.set(r.p[0], r.p[1], r.p[2]); d.set(r.d[0], r.d[1], r.d[2]);
    nx.set(-r.p[0], -r.p[1], -r.p[2]).normalize(); nx.addScaledVector(d, -nx.dot(d)).normalize(); ny.crossVectors(d, nx); B.makeBasis(nx, ny, d); w.quaternion.setFromRotationMatrix(B); } // point along d, flat face turned to the eye
  return ring.length;
}
function xAfGunPose(R, k, P) { // arms clip + the gun's own clip at the same fraction
  const G = XAF_GUN[k]; xAfPose(R, P.clip, P.u); const M = xAfGunModel(R, k);
  if (M.gm && G.gun) { const gn = G.gun[P.clip], a = gn && M.ga[gn]; if (a) { if (M.cur !== gn) { M.gm.stopAllAction(); a.reset().play(); M.cur = gn; } a.time = Math.min(a.getClip().duration - 0.001, P.u * a.getClip().duration); M.gm.update(0); } }
  for (const x in R.guns) { const g = R.guns[x]; g.g.visible = x === k && g.ok; }
  if (G.knives && M.ok) M.g.visible = xAfKnifePose(R, M, typeof J !== "undefined" && J.bsOn ? J.bs | 0 : 0) > 0;
  for (const x in R.props) R.props[x].g.visible = false; xAfBow(R, false);
  return M;
}
// hk-37 (user: "the arms for Jett's ultimate look weird"): the FP rigs are authored for a 43.383 deg viewmodel camera
// (<agent>-fp.json Settings.FOV, every agent), but the ability rig was drawn through the 70.5 deg world camera unscaled: the
// hands sat small and close to the middle, long bare forearms crossed the view and the upper arms / shoulders poked in at
// the bottom corners (Blade Storm worst: both arms out). Scaling the rig 's' across and up in CAMERA space (depth kept) is
// exactly the authored narrower-FOV picture on the world camera (x / z and y / z grow by s = tan(fov / 2) / tan(43.383 / 2));
// the rig's eye point stays on the camera. Root local axes: x = view depth, y = up, z = across (root.rotation.y = 90 deg).
XAF.vfov = 43.383;
function xAfFov(R, fov) { if (!R || !R.root || !(fov > 0)) return 1; const s = Math.tan(fov * Math.PI / 360) / Math.tan(XAF.vfov * Math.PI / 360);
  if (!R.eye0) { R.eye0 = R.root.position.clone(); } if (R.fs === s) return s; R.fs = s;
  R.root.scale.set(1, s, s); R.root.position.set(R.eye0.x, R.eye0.y * s, R.eye0.z); return s; }
function xAfGunKey() { // the held ult / ability gun right now ("" none): Showstopper / Headhunter / Tour De Force, then a fire's tail
  if (typeof BC !== "undefined" && BC.vm && XAF_GUN[BC.vm]) return BC.vm;
  if (J.pick === "Jett" && J.bsOn && J.bs > 0 && typeof rw !== "undefined" && rw === "knife") return "bs"; // Blade Storm: the knives replace the knife viewmodel
  const s = XAF.gs; return s && s.tail > 0 ? s.k : "";
}
function xAfGunFire(k, tail, alt) { let s = XAF.gs; if (!s || s.k !== k) s = XAF.gs = { k, t: 99, f: -1, n: 0, fired: 0, tail: 0 };
  s.f = 0; s.n++; s.fired = 1; const G = XAF_GUN[k]; s.alt = !!(alt && G.alt); if (tail) s.tail = Math.min(0.6, s.alt ? G.L.alt : G.L.fire[(s.n - 1) % G.fire.length]); }
function xAfGunTick(dt, k, ag) {
  let s = XAF.gs; if (!s || s.k !== k) s = XAF.gs = { k, t: 0, f: -1, n: 0, fired: 0, tail: 0 };
  s.t += dt; if (s.f >= 0) s.f += dt; if (s.tail > 0) s.tail -= dt;
  const G = XAF_GUN[k], P = xAfGunPhase(G, s); XAF.on = true; XAF.mode = "gun-" + P.ph;
  const R = xAfReady(ag); if (!R) { if (XAF.cur) XAF.cur.root.visible = false; XAF.last = { ag, k, gun: k, ph: P.ph, clip: P.clip, u: P.u, rig: false }; return; }
  xAfShow(R); const M = xAfGunPose(R, k, P);
  XAF.last = { ag, k, gun: k, ph: P.ph, clip: P.clip, u: P.u, item: M.g.visible, rig: true };
}
function xAfHideGun() { gun.visible = false; knife.visible = false; if (typeof XV !== "undefined" && XV.fp && XV.fp.root) XV.fp.root.visible = false; }
function xAfOff() {
  const R = XAF.cur; XAF.on = false; XAF.mode = ""; xAfShowGun(); if (!R) return; R.root.visible = false; for (const k in R.props) R.props[k].g.visible = false; for (const k in R.guns || {}) R.guns[k].g.visible = false; XAF.gs = null;
  try { if (XV.fp) { XV.fp.kind = null; xvFPPlay(XV.fp, "equip"); } } catch (e) {} // the gun comes back with its native equip
}
// xAfHideGun cleared gun / knife visibility every tick while the ability was out (even while the rig was still loading or failed);
// nothing else restores it until a weapon switch or ADS, so the gun stayed invisible after every cast (browser newmain1 / diag_kj1).
function xAfShowGun() { // the held weapon's own visibility, as the weapon-switch / ADS paths set it (5v5 / DM / TDM; duel and aim have no abilities)
  try { if (typeof mode !== "undefined" && (mode === "duel" || mode === "aim")) return; const dead = !player || player.hp <= 0, w = typeof rw !== "undefined" ? rw : "";
    knife.visible = w === "knife" && !dead; gun.visible = w !== "knife" && !dead && !(typeof ads !== "undefined" && ads === 2); } catch (e) {}
}
function xAfShow(R) { if (XAF.cur && XAF.cur !== R) { XAF.cur.root.visible = false; for (const x in XAF.cur.guns || {}) XAF.cur.guns[x].g.visible = false; } XAF.cur = R; if (R.root.parent !== camera) camera.add(R.root); R.root.visible = true; XAF.on = true; xAfFov(R, camera.fov); }
function xAfTick(dt) {
  XAF.t += dt; const q = J.eq, live = running && player && player.hp > 0 && jOn(), ag = J.pick || "Jett";
  const gk = live && !q ? xAfGunKey() : "", quick = live && !q && !gk && XCA.on, want = live && (q || quick || gk);
  if (!want) { if (XAF.on) xAfOff(); return; }
  if (running) xAfLoad(ag);
  xAfHideGun(); // Valorant swaps straight from the gun to the ability arms: the gun is never drawn while an ability is out
  if (gk) return xAfGunTick(dt, gk, ag);
  if (XAF.cur && XAF.cur.guns) for (const x in XAF.cur.guns) { XAF.cur.guns[x].g.visible = false; if (XAF.cur.guns[x].l) XAF.cur.guns[x].l.visible = false; }
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
// fire hooks: rsFire is the click path of Showstopper and (wrapped by bcFire) Headhunter / Tour De Force
{ const r0 = rsFire; rsFire = function () { const ss = typeof RS !== "undefined" && RS.ss, k = typeof BC !== "undefined" ? BC.vm : "", n = (J.q | 0) + (BC.td | 0); const r = r0.apply(this, arguments);
  try { if (ss && !RS.ss && J.pick === "Raze") xAfGunFire("rk", true); else if ((k === "hp" || k === "sn") && (J.q | 0) + (BC.td | 0) < n) xAfGunFire(k, !BC.eq); } catch (e) {} return r; }; }
// Blade Storm throw (offline jThrow, or the online wrapper sending 'blade'): each throw starts J.cd.x
{ const t0 = jThrow; jThrow = function () { const c = J.cd.x, n0 = J.bsOn ? J.bs | 0 : 0, sl = !(c > 0) && n0 > 0 ? xBtpFpSlots() : null; const r = t0.apply(this, arguments); try { if (J.pick === "Jett" && !(c > 0) && J.cd.x > 0) { xAfGunFire("bs", !(J.bsOn && J.bs > 0)); xBtpFlyFP(sl, n0, false); } } catch (e) {} return r; }; }
// Blade Storm ALT FIRE (jBurst offline / 'blade' alt:1 online): the two-handed RightClickAttack clip, the rig stays for its tail while the gun comes back
{ const b0 = jBurst; jBurst = function () { const c = J.cd.x, n0 = J.bsOn ? J.bs | 0 : 0, sl = !(c > 0) && n0 > 0 ? xBtpFpSlots() : null; const r = b0.apply(this, arguments); try { if (J.pick === "Jett" && !(c > 0) && J.cd.x > 0) { xAfGunFire("bs", true, true); xBtpFlyFP(sl, n0, true); } } catch (e) {} return r; }; }
{ const v2 = vmTick; vmTick = function (dt) { v2.apply(this, arguments); try { xAfTick(dt); } catch (e) { if (!XAF.err) { XAF.err = String(e); console.warn("ability viewmodel", e); } } }; }
{ const s1 = xCaStart; xCaStart = function () { try { XAF.qk = XAF.nk || "c"; } catch (e) {} return s1.apply(this, arguments); }; }
{ const k1 = jKey; jKey = function (code) { if (typeof code === "string" && /^Key[CQEX]$/.test(code)) XAF.nk = code[3].toLowerCase(); return k1.apply(this, arguments); }; }
// the agent's ability rig is warmed with the weapons once a match runs (no hitch on the first equip)
(window.XHK = window.XHK || []).push(() => { try { if (running && player && jOn()) xAfLoad(J.pick || "Jett"); } catch (e) {} });
window.xAbilityFP = { XAF, XAF_SET, XAF_K, XAF_GUN, phase: xAfPhase, gunPhase: xAfGunPhase, load: xAfLoad };
// ---- Blade Storm THIRD PERSON (hk-39, user 10:31 "third-person Blade Storm looks weird") ----
// The server keeps u.weapon = the gun while Jett's knives are out (fireBlade swaps it only for the throw), so every remote
// player / bot drew Blade Storm as a rifle. Now: online rows carry [24] = knives left (server simulation.js rows; 0 = none,
// fog-hidden rows 0); offline a bot Jett's Blade Storm (FEEL bot ult, XU.b) is 5 knives as the player's: one knife per
// shot, refilled to 5 by a kill (the kill with the last knife too), over at 0 knives. While knives are out the TP rig drops
// the gun for the knife-hands upper body (the native Sword_Idle hands pose, M.w 'Knife' as the melee pose), the daggers
// float in an arc in front of the hands (one per knife left, in the FP slot order: two left, one centre pointing up, two
// right; slow hover; the arc pitches with the aim), and every throw plays Jett's OverhandThrow on the upper body with the
// thrown dagger flying off along the aim; a right-click burst (several knives in one server step) plays one faster,
// two-armed-weight throw and launches every dagger together in the 2.5 deg fan. Kept to Blade Storm: locomotion untouched.
var XBTP = { len: 0.3, single: 0.42, burst: 0.62, tail: 0.5, fly: 0.22, spd: 45, gl: null, ld: 0, live: [], free: [] };
// arc slots in the agent frame (+x = the agent's left, +y up, +z forward), metres; [x, y, z, dir x, dir y]
var XBTP_SLOT = [[0.36, 1.36, 0.36, 0.3, 0.05], [0.27, 1.17, 0.44, 0.15, -0.05], [0, 1.08, 0.5, 0, 0.55], [-0.27, 1.17, 0.44, -0.15, -0.05], [-0.36, 1.36, 0.36, -0.3, 0.05]];
function xBtpRing(n, t) { // pure layout (tests): n knives left -> [{p:[x,y,z], d:[x,y,z] unit}] for the first n slots, hovering
  const out = []; for (let i = 0; i < Math.min(n | 0, XBTP_SLOT.length); i++) { const [x, y, z, dx, dy] = XBTP_SLOT[i], b = Math.sin((t || 0) * 2.1 + i * 1.7) * 0.015, L = Math.hypot(dx, dy, 1);
    out.push({ p: [x, y + b, z], d: [dx / L, dy / L, 1 / L] }); }
  return out;
}
function xBtpOn() { return typeof NET !== "undefined" && NET && NET.socket; }
function xBtpK(b) { // knives out on a remote player / bot: 0 none, else knives left
  if (!b || b.alive === false || !(b.hp > 0)) return 0;
  if (b.nt || xBtpOn()) return Math.max(0, Math.min(5, b.bsK | 0)); // online: server row [24]
  const UB = window.xBotUB; if (!UB || !UB[b.name]) { if (b.bsK) b.bsK = 0; return 0; } // offline: the FEEL bot ult (death / round reset clear it)
  return Math.max(0, Math.min(5, b.bsK | 0));
}
// offline knife count: one knife per shot sound (xUbShot runs before the shot's damage), a kill refills to 5
function xBtpShots() {
  if (xBtpOn()) return; const UB = window.xBotUB; if (!UB) return;
  for (const L of [bots, allies]) for (const b of L) { if (!b || !UB[b.name]) continue;
    if (b.bsEnd) { b.bsEnd = 0; b.bsK = 0; delete UB[b.name]; continue; } // no kill with the last knife: Blade Storm is over
    if (!(b.bsK > 0)) continue; const s = b.xsh || 0; if (b.bsSn == null) b.bsSn = s;
    if (s > b.bsSn) { b.bsK = Math.max(0, b.bsK - (s - b.bsSn)); b.bsSn = s; if (!b.bsK) b.bsEnd = 1; } }
}
function xBtpRefill(by) { // the kill with the last knife refills too (its shot sound came first: bsEnd is still pending)
  if (xBtpOn() || !by) return; const UB = window.xBotUB; if (!UB || !UB[by]) return;
  for (const L of [bots, allies]) for (const b of L) if (b && b.name === by && (b.bsK > 0 || b.bsEnd)) { b.bsK = 5; b.bsEnd = 0; b.bsSn = b.xsh || 0; }
}
function xBtpKnife(i) { // a TP dagger: the FP kunai builder at TP size, normal depth order (the additive edge shell casts no shadow)
  const w = xAfKnife(null, i); w.scale.setScalar(XBTP.len / (typeof XKUN !== "undefined" ? XKUN.len : 0.25)); w.name = "xbtp-knife-" + i;
  w.traverse((o) => { if (o.isMesh) { o.renderOrder = 0; o.castShadow = !o.material.transparent; } }); return w;
}
function xBtpRig(M) { // the floating daggers group on the agent root (built once per model)
  if (M.btp) return M.btp;
  const g = new THREE.Group(); g.name = "xbtp"; g.position.set(0, 1.4, 0); const k = []; for (let i = 0; i < XBTP_SLOT.length; i++) { const w = xBtpKnife(i); k.push(w); g.add(w); }
  M.m.add(g); M.btp = { g, k, on: false, tail: 0, sn: null, th: 0, burst: 0, n: 0, w0: null }; return M.btp;
}
function xBtpLaunch(from, v, life, fp) { // one flying kunai with its trail (pooled), world space
  let f = XBTP.free.pop(); if (!f) { f = { w: xBtpKnife(0), v: new THREE.Vector3(), t: 0, life: XBTP.fly }; f.tr = typeof xKunTrail === "function" ? xKunTrail() : null; if (f.tr) (f.w.children[0] || f.w).add(f.tr); }
  f.w.visible = true; f.t = 0; f.life = life || XBTP.fly; f.w.position.copy(from); f.v.copy(v); if (f.tr) f.tr.material.opacity = 0.45;
  f.w.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), f.v.clone().normalize());
  f.w.traverse((o) => { if (o.isMesh) o.renderOrder = fp ? 11 : 0; }); scene.add(f.w); XBTP.live.push(f); return f;
}
function xBtpFly(M, from, d, n) { // the thrown dagger(s) leave along the aim (burst = the 2.5 deg fan)
  if (typeof scene === "undefined") return; const up = new THREE.Vector3(0, 1, 0), fan = n > 1 && typeof jBurstDirs === "function" ? jBurstDirs(n) : [0];
  for (const a of fan) xBtpLaunch(from, d.clone().applyAxisAngle(up, a).multiplyScalar(XBTP.spd), XBTP.fly);
}
// FIRST PERSON (hk-41): the player's own throw sends the kunai that leaves the fan flying from its slot toward the crosshair (every
// knife of a right-click burst, fanned as its hits), so a throw reads as a thrown blade instead of a dagger blinking out of view.
function xBtpFpSlots() { try { const R = xAfReady("Jett"), M = R && R.guns && R.guns.bs; if (!M || !M.ok || !M.g.visible) return null; return M.k.map((w) => (w.visible ? w.getWorldPosition(new THREE.Vector3()) : null)); } catch (e) { return null; } }
function xBtpFlyFP(slots, n0, burst) {
  if (!slots || typeof scene === "undefined" || typeof camera === "undefined") return 0; const o = camera.getWorldPosition(new THREE.Vector3()), f = camera.getWorldDirection(new THREE.Vector3()), up = new THREE.Vector3(0, 1, 0);
  const idx = burst ? Array.from({ length: n0 }, (_, i) => i) : [n0 - 1], fan = burst && typeof jBurstDirs === "function" ? jBurstDirs(n0) : null; let c = 0;
  idx.forEach((i, j) => { const p = slots[i]; if (!p) return; const aim = fan ? f.clone().applyAxisAngle(up, fan[j]) : f, v = o.clone().addScaledVector(aim, 30).sub(p).normalize().multiplyScalar(XBTP.spd); xBtpLaunch(p, v, 0.5, true); c++; });
  XBTP.fp = (XBTP.fp || 0) + c; return c;
}
function xBtpTick(dt) { for (let i = XBTP.live.length - 1; i >= 0; i--) { const f = XBTP.live[i]; f.t += dt; f.w.position.addScaledVector(f.v, dt); if (f.tr) f.tr.material.opacity = 0.45 * Math.max(0, 1 - f.t / f.life); if (f.t >= f.life) { scene.remove(f.w); f.w.visible = false; XBTP.live.splice(i, 1); XBTP.free.push(f); } } }
function xBtpPre(b, M) { // before the stock layer pass: knife hands instead of the gun, throws instead of fire recoil
  const k = xBtpK(b), X = M.sx; if (!X || (!M.btp && !(k > 0))) return; const R = xBtpRig(M); if (!R) return; /* the dagger rig is built on a unit's first Blade Storm only */ const sn = b.xsh || 0, ds = R.sn == null ? 0 : sn - R.sn; R.sn = sn;
  if (!(k > 0 || R.on)) return;
  if (!R.on) { R.on = true; R.w0 = M.w; R.n = k; R.tail = 0; }
  if (ds > 0 && (k > 0 || R.n > 0)) { const burst = ds > 1 || (R.n > 1 && k === 0); // a right-click burst lands as several knives in one server step
    xUbOnce(X, "throw", "U", burst ? XBTP.burst : XBTP.single); R.th++; if (burst) R.burst++; R.tail = XBTP.tail;
    try { const P = M.m.getWorldPosition(new THREE.Vector3()), ry = b.g.rotation.y, p = M.xap || 0, d = new THREE.Vector3(Math.sin(ry) * Math.cos(p), Math.sin(p), Math.cos(ry) * Math.cos(p)); P.y += 1.4; P.addScaledVector(d, 0.5); xBtpFly(M, P, d, burst ? Math.max(2, R.n) : 1); } catch (e) {} }
  R.n = k; M.w = "Knife"; X.sn = sn; X.shots = 0; // knife hands (Sword_Idle) + grip off (xgTarget); no Pistol_Shoot recoil, no visual reload
}
function xBtpEnd(b, M) { const R = M.btp; if (!R) return; if (R.on) { R.on = false; R.tail = 0; M.w = R.w0 || M.w; R.w0 = null; if (M.gun && !M.xvWait) M.gun.visible = true; if (M.sx) { M.sx.sn = b.xsh || 0; M.sx.shots = 0; } } R.g.visible = false; }
function xBtpPost(b, M, dt) {
  const R = M.btp; if (!R) return; if (!R.on) { R.g.visible = false; return; }
  const k = xBtpK(b); if (k === 0) R.tail -= dt; if (!(k > 0 || R.tail > 0)) return xBtpEnd(b, M);
  if (M.gun) M.gun.visible = false; R.g.visible = true; R.g.rotation.x = -(M.xap || 0) * 0.8;
  const ring = xBtpRing(k, (typeof performance !== "undefined" ? performance.now() : 0) / 1000 + (b.nid || 0)), d = new THREE.Vector3(), z = new THREE.Vector3(0, 0, 1);
  for (let i = 0; i < R.k.length; i++) { const w = R.k[i], r = ring[i]; w.visible = !!r; if (!r) continue; w.position.set(r.p[0], r.p[1] - 1.4, r.p[2]); d.set(r.d[0], r.d[1], r.d[2]); w.quaternion.setFromUnitVectors(z, d); }
}
if (typeof xUbAnim === "function") { const a0 = xUbAnim; xUbAnim = function (b, M, sp, dt) { try { if (dt) xBtpPre(b, M); } catch (e) { XBTP.err = String(e); } const r = a0.apply(this, arguments); try { if (dt) xBtpPost(b, M, dt); } catch (e) { XBTP.err = String(e); } return r; }; }
// A Blade Storm knife from a remote player / bot (online server 's' event with weapon 'Blade Storm', or an offline bot Jett's
// knife, index.html xBsBot): the throw counts on the unit (xUbShot -> TP OverhandThrow + the flying dagger, xBtpPre) and plays
// the knife-throw sound at it (SFX.ab bsThrow, 3D) - never the gun chain (Vandal fallback sound, bfxBot tracer); the P2P host
// still relays it. One throw sound per unit per frame (a burst lands as several knives in one server step).
if (typeof SFX !== "undefined" && typeof SFX.at === "function") { const at0 = SFX.at; SFX.at = function (p, w) {
  if (w !== "Blade Storm") return at0.apply(this, arguments); if (!p) return;
  try { xUbShot(p); } catch (e) {}
  try { if (typeof MP !== "undefined" && MP.role === "host" && MP.st === "game") { const u = [].concat(bots, allies).find((x) => x && x.g && x.g.position === p); if (u) MP.ev.push(["s", u.nid, "Blade Storm"]); } } catch (e) {}
  try { const f = typeof renderer !== "undefined" && renderer.info ? renderer.info.render.frame : 0; if (p.xbsF !== f) { p.xbsF = f; SFX.ab("bsThrow", p); XBTP.snd = (XBTP.snd || 0) + 1; } } catch (e) {}
}; }
if (typeof xUbShot === "function") { const s0 = xUbShot; xUbShot = function () { const r = s0.apply(this, arguments); try { xBtpShots(); } catch (e) {} return r; }; }
if (typeof kill === "function") { const k0 = kill; kill = function (b, hs, by) { const was = b && b.alive, r = k0.apply(this, arguments); try { if (was && b && !b.alive) xBtpRefill(by); } catch (e) {} return r; }; }
if (typeof allyDie === "function") { const d0 = allyDie; allyDie = function (a, by) { const was = a && a.alive, r = d0.apply(this, arguments); try { if (was && a && !a.alive) xBtpRefill(by); } catch (e) {} return r; }; }
if (typeof pDie === "function") { const p0 = pDie; pDie = function (by) { const was = player && player.hp > 0, r = p0.apply(this, arguments); try { if (was && player.hp <= 0) xBtpRefill(by); } catch (e) {} return r; }; }
if (typeof mpCliSnap === "function") { const c0 = mpCliSnap; mpCliSnap = function (m) { try { if (xBtpOn() && m && Array.isArray(m.u)) { const all = bots.concat(allies); for (const e of m.u) { if (!Array.isArray(e) || e[0] === MP.me) continue; const u = all.find((x) => x.nid === e[0]); if (u) u.bsK = e[22] === 1 ? 0 : Math.max(0, Math.min(5, e[24] | 0)); } } } catch (e) {} return c0.apply(this, arguments); }; }
if (typeof xDie === "function") { const x0 = xDie; xDie = function (b) { try { if (b && b.xm && !b.xd) xBtpEnd(b, b.xm); } catch (e) {} return x0.apply(this, arguments); }; } // the gun drops (not the daggers)
(window.XHK = window.XHK || []).push(() => { try { const n = performance.now(), d = XBTP.t0 ? Math.min(0.1, (n - XBTP.t0) / 1000) : 0; XBTP.t0 = n; if (XBTP.live.length) xBtpTick(d); } catch (e) {} });
window.xBladeTP = { XBTP, XBTP_SLOT, ring: xBtpRing, k: xBtpK };
// ---- END ABILITY FIRST PERSON ----
