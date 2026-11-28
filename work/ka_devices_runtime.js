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
function kadWrap(fname, fn) {
  try {
    var f0 = G_[fname];
    if (typeof f0 !== "function") return;
    G_[fname] = function () {
      var h = f0.apply(this, arguments);
      try { fn(h, arguments); } catch (e) {}
      return h;
    };
  } catch (e) {}
}
kadWrap("gkxWingman", function (h) { kadCreature(h, "wingman", { height: 0.8, yaw: Math.PI }); });
kadWrap("gkxDizzy", function (h) { kadCreature(h, "dizzy", { height: 0.7, yaw: Math.PI }); });
kadWrap("gkxThrash", function (h) { kadCreature(h, "thrash", { height: 1.4, yaw: Math.PI }); });
kadWrap("dlxSonicSensor", function (h) { kadStatic(h, "sonic-sensor", { height: 0.4 }); });
// GravNet: keep the procedural dome/net/ring (they show the slow zone) and just sit the real
// grenade model in the middle of the field.
kadWrap("dlxGravNet", function (h) { kadStatic(h, "gravnet", { height: 0.35, hide: false }); });
kadWrap("vyxRazorvine", function (h, args) {
  kadStatic(h, "razorvine", { height: 0.9, diameter: (args[1] || 6) * 2 });
});
})();
// ---- END KINGDOM ARCHIVES DEVICE MODELS ----
