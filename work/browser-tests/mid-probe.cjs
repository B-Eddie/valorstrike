// Mid-asset probe: native agent rigs loaded (agent gate ACTIVE, user-facing guarantee intact),
// light map path (no scene.gltf). Verifies native rigs spawn, kill -> ragdoll stays finite/local.
const {serve, launch, boot} = require('./lib.cjs');
(async()=>{
  const t0 = Date.now(), el = () => ((Date.now()-t0)/1000).toFixed(0)+'s';
  const srv = await serve();
  const {b, p, errors, logs} = await launch({profile:'mid'});
  try {
    await boot(p); console.log(el(), 'booted');
    await p.evaluate(() => { window.__vs.light(true); window.__vs.agents(false); window.__vs.startDM(); });
    await p.waitForFunction(() => window.__vs && window.__vs.state().running, {timeout: 60000});
    console.log(el(), 'running');
    // wait for bot rigs to upgrade to native skinned meshes (async XSOL queue)
    let rigged = 0;
    for (let i = 0; i < 15; i++) {
      rigged = await p.evaluate(() => window.__vs.bots.filter(b => { let sk = false; b.g.traverse(o => { if (o.isSkinnedMesh) sk = true; }); return sk; }).length);
      if (rigged >= 4) break;
      await p.waitForTimeout(2000);
    }
    const rig = await p.evaluate(() => window.xValorantAssets.probe());
    console.log(el(), 'RIGS', JSON.stringify(rig), 'skinnedBots', rigged);
    // kill a bot past spawn protection, then sample its rig bones for finiteness/locality
    const k = await p.evaluate(() => {
      const b0 = window.__vs.bots.find(x=>{ if (!x.alive) return false; let sk = false; x.g.traverse(o => { if (o.isSkinnedMesh) sk = true; }); return sk; }) || window.__vs.bots.find(x=>x.alive);
      b0.pp = 0;
      const death = b0.g.position.toArray();
      window.__vs.kill(b0, false, 'You', 'Vandal');
      let skinned = null; b0.g.traverse(o => { if (o.isSkinnedMesh && !skinned) skinned = o; });
      window.__rag = { b: b0, sk: skinned, death };
      return {killed: b0.name, alive: b0.alive, hasSkinned: !!skinned, death: death.map(v=>+v.toFixed(1))};
    });
    console.log(el(), 'KILL', JSON.stringify(k));
    await p.waitForFunction(() => window.__rag.b.xd === 1, {timeout: 8000}).catch(() => console.log(el(), 'corpse not started within 8s'));
    console.log(el(), 'corpse started, alive=', await p.evaluate(() => window.__rag.b.alive));
    for (let i = 0; i < 6; i++) {
      await p.waitForTimeout(700);
      const r = await p.evaluate(() => {
        const {b, sk, death} = window.__rag; if (!sk || !sk.skeleton) return {note:'no skinned rig'};
        const v = new THREE.Vector3(); let bad = 0, far = 0;
        for (const bone of sk.skeleton.bones) {
          bone.getWorldPosition(v);
          if (!Number.isFinite(v.x + v.y + v.z)) bad++;
          else if (v.distanceTo(new THREE.Vector3(...death)) > 12) far++;
        }
        return {bones: sk.skeleton.bones.length, nonFinite: bad, farAway: far, alive: b.alive};
      });
      console.log(el(), 'RAGDOLL', JSON.stringify(r));
    }
  } finally {
    console.log('ERRORS', JSON.stringify(errors.slice(0,8)));
    console.log('LOGS', JSON.stringify(logs.filter(l=>!/Failed to load resource|agent unavailable/.test(l)).slice(0,8)));
    await b.close(); srv.close();
  }
})().catch(e => { console.error('FATAL', String(e && e.stack || e).slice(0,500)); process.exit(1); });
