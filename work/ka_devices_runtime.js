// ---- KINGDOM ARCHIVES DEVICE MODELS ----
// Replaces the procedural placeholder creatures/devices of the newer agents with the real
// Kingdom Archives models imported under models/valorant/ (wingman, dizzy, thrash, sonic-sensor,
// gravnet, razorvine). The procedural build stays as the instant placeholder and the fallback
// while/if the glb loads; gameplay mechanics never change - this swaps visuals only.
// Two attach modes: "creature" rides the fx handle's moving group (objs[0]) and drives Run/Idle
// clips from group speed with the fx game-dt tick; "static" hides the whole placeholder object
// set and drops the model into the scene at the effect position until the effect ends.
// Appended after the fx modules by work/install_valorant.py. Models (c) Riot Games via Kingdom
// Archives, see models/valorant/SOURCES.md.
(function () {
"use strict";
var G_ = (0, eval)("this");
var KAD = (G_.KAD = { v: 2, live: [] });
function kadHideAll(objs, except) {
  objs.forEach(function (o) {
    if (o === except) return;
    o.traverse ? o.traverse(function (m) { m.visible = false; }) : (o.visible = false);
  });
}
function kadScaled(gltf, height) {
  var obj = THREE.SkeletonUtils.clone(gltf.scene);
  obj.traverse(function (m) { if (m.isMesh) { m.castShadow = true; if (m.material && m.material.clone) m.material = m.material.clone(); } });
  var b = new THREE.Box3().setFromObject(obj), s = b.getSize(new THREE.Vector3());
  var k = height / Math.max(0.001, s.y), root = new THREE.Group();
  obj.position.set(-(b.min.x + b.max.x) / 2, -b.min.y, -(b.min.z + b.max.z) / 2);
  root.add(obj); root.scale.setScalar(k);
  return root;
}
function kadMixer(obj, animations) {
  if (!animations || !animations.length) return null;
  var mixer = new THREE.AnimationMixer(obj);
  var idle = animations.find(function (c) { return /idle/i.test(c.name); }) || animations[0];
  var run = animations.find(function (c) { return /run/i.test(c.name); }) || idle;
  var cur = mixer.clipAction(idle); cur.play();
  return { mixer: mixer, idle: idle, run: run, cur: cur, curClip: idle };
}
function kadSetAnim(mm, clip) {
  if (!mm || mm.curClip === clip) return;
  var a = mm.mixer.clipAction(clip);
  a.reset().fadeIn(0.15).play();
  if (mm.cur && mm.cur !== a) mm.cur.fadeOut(0.15);
  mm.cur = a; mm.curClip = clip;
}
function kadDetach(rec) {
  try {
    var i = KAD.live.indexOf(rec);
    if (i >= 0) KAD.live.splice(i, 1);
    if (rec.mix) rec.mix.mixer.stopAllAction();
    if (rec.sceneAdd && rec.root.parent) rec.root.parent.remove(rec.root);
  } catch (e) {}
}
// creature: model rides the fx group's motion
function kadCreature(h, slug, opts) {
  if (!h || !h.fx || !h.fx.objs || !h.fx.objs[0] || !h.fx.objs[0].isGroup) return;
  var g = h.fx.objs[0];
  if (g.userData.kad) return;
  g.userData.kad = true;
  xvLoad(slug)
    .then(function (gl) {
      if (!g.parent) return;
      var root = kadScaled(gl, opts.height);
      root.rotation.y = opts.yaw || 0;
      g.children.forEach(function (o) { o.visible = false; });
      g.add(root);
      var rec = { root: root, mix: kadMixer(root.children[0], gl.animations), lx: g.position.x, lz: g.position.z, sceneAdd: false };
      KAD.live.push(rec);
      if (rec.mix) {
        var t0 = h.fx.tick;
        h.fx.tick = function (dt) {
          try {
            var sp = Math.hypot(g.position.x - rec.lx, g.position.z - rec.lz) / Math.max(1e-5, dt);
            rec.lx = g.position.x; rec.lz = g.position.z;
            kadSetAnim(rec.mix, sp > 0.5 ? rec.mix.run : rec.mix.idle);
            rec.mix.mixer.update(dt);
          } catch (e) {}
          return t0.apply(this, arguments);
        };
      }
      var d0 = h.fx.done;
      h.fx.done = function () { kadDetach(rec); return d0.apply(this, arguments); };
    })
    .catch(function () { delete g.userData.kad; });
}
// static: model replaces the whole placeholder set at the effect position
function kadStatic(h, slug, opts) {
  if (!h || !h.fx || !h.fx.objs || !h.fx.objs[0]) return;
  var objs = h.fx.objs;
  if (objs[0].userData.kad) return;
  objs[0].userData.kad = true;
  xvLoad(slug)
    .then(function (gl) {
      var p = objs[0].position;
      var root = kadScaled(gl, opts.height);
      if (opts.diameter) {
        var b = new THREE.Box3().setFromObject(root), s = b.getSize(new THREE.Vector3());
        var xz = opts.diameter / Math.max(0.001, Math.max(s.x, s.z));
        root.scale.set(root.scale.x * xz, root.scale.y, root.scale.z * xz);
      }
      root.position.set(p.x, p.y - 0.1, p.z);
      if (opts.hide !== false) kadHideAll(objs, root);
      scene.add(root);
      var rec = { root: root, mix: kadMixer(root.children[0], gl.animations), sceneAdd: true };
      KAD.live.push(rec);
      if (rec.mix) {
        var t0 = h.fx.tick;
        h.fx.tick = function (dt) {
          try { rec.mix.mixer.update(dt); } catch (e) {}
          return t0.apply(this, arguments);
        };
      }
      var d0 = h.fx.done;
      h.fx.done = function () { kadDetach(rec); return d0.apply(this, arguments); };
    })
    .catch(function () { delete objs[0].userData.kad; });
}
function kadWrapFn(f0, fn) {
  return function () {
    var h = f0.apply(this, arguments);
    try { fn(h, arguments); } catch (e) {}
    return h;
  };
}
// The wraps below use direct lexical references on purpose: every runtime block is concatenated into
// one classic script, so the bindings are visible here; global-object/eval lookup is NOT reliable in
// every environment (the vm test harness keeps function declarations off the global object).
try { if (typeof gkxWingman === "function") gkxWingman = kadWrapFn(gkxWingman, function (h) { kadCreature(h, "wingman", { height: 0.8, yaw: Math.PI }); }); } catch (e) {}
try { if (typeof gkxDizzy === "function") gkxDizzy = kadWrapFn(gkxDizzy, function (h) { kadCreature(h, "dizzy", { height: 0.7, yaw: Math.PI }); }); } catch (e) {}
try { if (typeof gkxThrash === "function") gkxThrash = kadWrapFn(gkxThrash, function (h) { kadCreature(h, "thrash", { height: 1.4, yaw: Math.PI }); }); } catch (e) {}
try { if (typeof dlxSonicSensor === "function") dlxSonicSensor = kadWrapFn(dlxSonicSensor, function (h) { kadStatic(h, "sonic-sensor", { height: 0.4 }); }); } catch (e) {}
// GravNet: keep the procedural dome/net/ring (they show the slow zone) and just sit the real
// grenade model in the middle of the field.
try { if (typeof dlxGravNet === "function") dlxGravNet = kadWrapFn(dlxGravNet, function (h) { kadStatic(h, "gravnet", { height: 0.35, hide: false }); }); } catch (e) {}
try { if (typeof vyxRazorvine === "function") vyxRazorvine = kadWrapFn(vyxRazorvine, function (h, args) { kadStatic(h, "razorvine", { height: 0.9, diameter: (args[1] || 6) * 2 }); }); } catch (e) {}
// Mosh pit: the thrown glob rides its arc as the real mosh-pit model; the landed pool keeps its
// procedural goo (it shows the damage zone) with the creature model sitting in the middle.
try { if (typeof gkxMoshThrow === "function") gkxMoshThrow = kadWrapFn(gkxMoshThrow, function (h) { kadCreature(h, "mosh-pit", { height: 0.5 }); }); } catch (e) {}
try { if (typeof gkxMoshPool === "function") gkxMoshPool = kadWrapFn(gkxMoshPool, function (h) { kadStatic(h, "mosh-pit", { height: 0.4, hide: false }); }); } catch (e) {}
// Gekko reclaim globules: when a creature's fx ends, its globule (baby model) stays at the end
// position until the reclaim timer returns the charge. Driven by game dt through vtxPush, so it
// follows pause/fake timers like every other fx. a18Glob(k, fxHandle) carries the creature handle.
var KAD_GLOB = { q: ["baby-wingman", 0.45], e: ["baby-dizzy", 0.4], c: ["mosh-pit", 0.35] };
function kadGlobule(k, h) {
  var cfg = KAD_GLOB[k];
  if (!cfg) return;
  var spawn = function () {
    var p = h && h.fx && h.fx.objs && h.fx.objs[0] && h.fx.objs[0].position;
    if (!p) return;
    var gx = p.x, gy = p.y, gz = p.z;
    xvLoad(cfg[0])
      .then(function (gl) {
        var root = kadScaled(gl, cfg[1]);
        root.position.set(gx, gy, gz);
        scene.add(root);
        var rec = { root: root, mix: kadMixer(root.children[0], gl.animations), sceneAdd: true, globule: k };
        KAD.live.push(rec);
        var ttl = (typeof J !== "undefined" && J.a18gl && J.a18gl[k]) || (typeof A18C !== "undefined" && A18C.globule.reclaim) || 10;
        if (typeof vtxPush === "function") {
          vtxPush({
            age: 0,
            ttl: Math.max(0.5, ttl),
            tick: function (dt) { try { if (rec.mix) rec.mix.mixer.update(dt); } catch (e) {} },
            done: function () { kadDetach(rec); if (root.parent) root.parent.remove(root); },
          });
        }
      })
      .catch(function () {});
  };
  if (h && h.fx && typeof h.fx.done === "function") {
    var d0 = h.fx.done;
    h.fx.done = function () { var r = d0.apply(this, arguments); try { spawn(); } catch (e) {} return r; };
  } else spawn();
}
try { if (typeof a18Glob === "function") a18Glob = kadWrapFn(a18Glob, function (h, args) { kadGlobule(args[0], args[1]); }); } catch (e) {}
})();
// ---- END KINGDOM ARCHIVES DEVICE MODELS ----
