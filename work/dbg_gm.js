{
const pe = process.exit; process.on("uncaughtException", (e) => { if (e !== "__gmstop") console.log("uncaught", e); }); process.exit = () => { process.exit = pe; throw "__gmstop"; };
const fsx = require("fs"), files = fsx.readdirSync("models").filter((f) => f.endsWith(".glb"));
win.__bufs = {}; files.forEach((f) => { const b = fsx.readFileSync("models/" + f); const ab = vm.runInContext("new ArrayBuffer(" + b.length + ")", context); new Uint8Array(ab).set(b); win.__bufs[f.replace(".glb", "")] = ab; });
console.log(xe(`(() => { let n = 0; const ks = Object.keys(__bufs); window.__gmn = 0; ks.forEach((k) => new THREE.GLTFLoader().parse(__bufs[k], "", (g) => { XGM.src[k] = g.scene; window.__gmn++; }, (e) => { window.__gmerr = String(e); })); return ks.length; })()`));
setTimeout(() => {
  console.log(xe(`(() => { if (__gmn < 16) return "parsed " + __gmn + " " + window.__gmerr; xGmReady(); const out = [];
    for (const w in XGM.F) { const T = XGM.T[w], P = XGC[w]; if (!T) { out.push(w + " NO TEMPLATE"); continue; } T.updateMatrixWorld(true); P.updateMatrixWorld(true); const a = new THREE.Box3().setFromObject(T), b = new THREE.Box3().setFromObject(P);
      const f = (v) => [v.x, v.y, v.z].map((x) => x.toFixed(3)).join(","); out.push(w.padEnd(9) + " glb[" + f(a.min) + " | " + f(a.max) + "] proc[" + f(b.min) + " | " + f(b.max) + "] mz " + T.userData.mz.toFixed(3) + " my " + T.userData.my.toFixed(3) + " sk " + !!XGM.sk[w]); }
    out.push("VMS swapped: " + Object.keys(VMS).filter((k) => VMS[k].userData.xGm).length + "/" + Object.keys(VMS).length + " knife " + knife.children.some((c) => c.userData && c.userData.xGm));
    const g = xGun("Vandal"); out.push("new Vandal clone glb: " + !!g.getObjectByName("xglb") + " shares geo: " + (() => { let a = null, b = null; g.getObjectByName("xglb").traverse((o) => { if (o.isMesh && !a) a = o; }); XGM.T.Vandal.traverse((o) => { if (o.isMesh && !b) b = o; }); return a.geometry === b.geometry && a.material === b.material; })());
    return out.join("\\n"); })()`));
  const J = xe(`(() => { const out = {}; const v = new THREE.Vector3();
    const dump = (root) => { root.updateMatrixWorld(true); const T = []; root.traverse((o) => { if (!o.isMesh || !o.visible) return; let p = o.parent, vis = true; while (p && p !== root.parent) { if (!p.visible) vis = false; p = p.parent; } if (!vis) return; const g = o.geometry, P = g.attributes.position, I = g.index; const c = (Array.isArray(o.material) ? o.material[0] : o.material).color; const col = c ? [c.r, c.g, c.b] : [0.5, 0.5, 0.5]; const n = I ? I.count : P.count;
      for (let i = 0; i < n; i += 3) { const t = []; for (let j = 0; j < 3; j++) { v.fromBufferAttribute(P, I ? I.getX(i + j) : i + j).applyMatrix4(o.matrixWorld); t.push([v.x, v.y, v.z]); } T.push([t, col]); } }); return T; };
    for (const w in XGM.T) { const P = XGC[w]; out[w] = { glb: dump(XGM.T[w]), proc: dump(P) }; }
    return JSON.stringify(out); })()`);
  require("fs").writeFileSync("/tmp/gm_tris.json", J);
  console.log("drop", xe(`(() => { try { const m = new THREE.Mesh(new THREE.BoxGeometry(1,1,1), new THREE.MeshBasicMaterial()); xdModel(m, "Phantom"); const a = !!m.userData.xdg.getObjectByName("xglb"); xdModel(m, "Sheriff"); return a + " " + !!m.userData.xdg.getObjectByName("xglb") + " kids " + m.children.length; } catch (e) { return "threw " + e; } })()`));
  console.log("fire", xe(`(() => { try { vmFire(); return muzzle.position.y + " vs my " + (VMS[wName()] || VMS.Vandal).userData.my + " w " + wName(); } catch (e) { return "threw " + e; } })()`));
  console.log("agent", xe(`(() => { try { const R = xAgent("Jett", 0xff0000, "Odin"); return !!R.gun.getObjectByName("xglb"); } catch (e) { return "threw " + e; } })()`));
  console.log("VMS2", xe(`Object.keys(VMS).filter((k) => VMS[k].userData.xGm).length + " knife " + knife.children.some((c) => c.userData && c.userData.xGm)`));
  console.log("errors:", JSON.stringify(errors.slice(0, 5)));
  pe(0);
}, 1500);
}
