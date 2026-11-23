// Scene graph perf (lane cpu, user 22 Nov 2026 "Do all fixes", no visual downgrade): the render-time matrix update
// (index.html SCENE GRAPH PERF, XSGR) no longer forces every object every frame - the scene root never forces, hidden
// nodes of the scene / camera / map are not walked while hidden, the native map's own static nodes are frozen - and the
// renderer's Skeleton.update is deferred to the first draw that uses the skeleton (skipped for agents three culls).
// Checked on the real page (offline 5v5, real three r149 scene graph, the repo's .glb agents and native maps through
// page_harness) with a model of three r149's WebGLRenderer.render in the page (scene.updateMatrixWorld, camera, scene
// .onBeforeRender, projectObject with Skeleton.update before the frustum test, onBeforeRender, renderBufferDirect):
//  1. at EVERY draw the object's matrixWorld is bit-identical to a full recompute from the local transforms (what three's
//     forced update produced), and a skinned mesh's bone matrices are the ones an immediate Skeleton.update gives;
//  2. the same holds with the optimisation off (XSGR.mw / XSGR.sk false: three's own update), so the check is sound;
//  3. it skips work: hidden nodes skipped, skeletons deferred and never computed for culled agents, the map frozen;
//  4. nothing frozen in the map moves during play (no watchdog unfreeze), the spike is never frozen;
//  5. anything that moves later still updates: a hidden pool object moved while hidden, a frozen map node moved (watchdog),
//     a node under a hidden parent whose parent moved - each is drawn with the right matrix.
//   node work/test_scene_matrix_equivalence.cjs        (MAPS=ascent,bind  SECS=game seconds per map)
const assert = require('assert/strict'), fs = require('fs'), path = require('path');
const { boot, lsStore } = require('./page_harness.cjs');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
assert(html.includes('// ---- SCENE GRAPH PERF ----') && html.includes('scene.updateMatrixWorld = function (force) {'), 'SCENE GRAPH PERF block in index.html');
const EMU = `(function(){const R=renderer,T=THREE,fr=new T.Frustum(),m4=new T.Matrix4(),E=window.__EQ={frame:0,draws:0,skDraws:0,bad:[],skBad:[],shells:0,check:true};
 const ref=new Map();
 // full recompute from local transforms, top-down (exactly three's forced update: compose, then parent.matrixWorld x matrix)
 function refW(o){let w=ref.get(o);if(w)return w;const L=o.matrixAutoUpdate?new T.Matrix4().compose(o.position,o.quaternion,o.scale):o.matrix;w=o.parent===null?L.clone():new T.Matrix4().multiplyMatrices(refW(o.parent),L);ref.set(o,w);return w;}
 const self=o=>/^reveal-/.test(o.name||'')||o.userData.skirt; // set their own matrixWorld in onBeforeRender
 function check(o){if(!E.check)return;E.draws++;if(self(o)){E.shells++;return;}const a=o.matrixWorld.elements,b=refW(o).elements;for(let i=0;i<16;i++)if(a[i]!==b[i]&&!(Number.isNaN(a[i])&&Number.isNaN(b[i]))){if(E.bad.length<20)E.bad.push([E.frame,o.name||o.type,(o.parent&&o.parent.name)||'',i,a[i],b[i]]);break;}
  if(o.isSkinnedMesh&&o.skeleton){E.skDraws++;const s=o.skeleton,bm=s.boneMatrices,M=new T.Matrix4();for(let j=0;j<s.bones.length;j++){M.multiplyMatrices(s.bones[j]?s.bones[j].matrixWorld:new T.Matrix4(),s.boneInverses[j]);const e=M.elements;for(let k=0;k<16;k++)if(bm[j*16+k]!==Math.fround(e[k])&&bm[j*16+k]!==e[k]){if(E.skBad.length<20)E.skBad.push([E.frame,o.name,j,k,bm[j*16+k],e[k]]);j=1e9;break;}}}}
 const sm={enabled:true,autoUpdate:false,needsUpdate:false,type:2};
 function emuRender(sc,cam){ref.clear();
  if(sc.matrixWorldAutoUpdate===true)sc.updateMatrixWorld();if(cam.parent===null&&cam.matrixWorldAutoUpdate===true)cam.updateMatrixWorld();
  if(sc.isScene===true)sc.onBeforeRender(R,sc,cam,null);
  m4.multiplyMatrices(cam.projectionMatrix,cam.matrixWorldInverse);fr.setFromProjectionMatrix(m4);const items=[];
  (function project(o){if(o.visible===false)return;if(o.layers.test(cam.layers)){if(o.isMesh||o.isLine||o.isPoints){if(o.isSkinnedMesh&&o.skeleton.frame!==E.frame){o.skeleton.update();o.skeleton.frame=E.frame;}if(!o.frustumCulled||fr.intersectsObject(o))items.push(o);}else if(o.isSprite){if(!o.frustumCulled||fr.intersectsSprite(o))items.push(o);}}for(const c of o.children)project(c);})(sc);
  if(sm.enabled&&(sm.autoUpdate||sm.needsUpdate)){sc.traverseVisible(o=>{if((o.isMesh||o.isPoints||o.isLine)&&o.castShadow&&o.geometry)R.renderBufferDirect(null,null,o.geometry,o.material,o,null);});sm.needsUpdate=false;}
  for(const o of items){o.onBeforeRender(R,sc,cam,o.geometry,o.material,null);R.renderBufferDirect(cam,sc,o.geometry,o.material,o,null);o.onAfterRender(R,sc,cam,o.geometry,o.material,null);}
  if(sc===scene)E.frame++;}
 R.shadowMap=sm;R.render=emuRender;R.renderBufferDirect=function(c,s,g,m,o){if(s===scene&&c)check(o);};R.info={render:{frame:0,calls:0,triangles:0},memory:{},reset(){},autoReset:true};
 R.xsgrBound=false;xsgrBind(R);try{R.userData={};vfBindRenderer(R);}catch(e){}})();true`;
const tick = () => new Promise((r) => setImmediate(r)), sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const out = [];
  for (const MAP of (process.env.MAPS || 'ascent,bind').split(',')) {
    const H = boot({ real3: true, seed: 5, native: true, fastGlobal: true, glb: true, ls: lsStore([['vs.gq', 'medium']]) }), xe = H.xe;
    const adv = async (ms) => { for (let t = 0; t < ms; t += 17) { H.advance(17); await tick(); } };
    xe(`xvaParse=function(buf){return new Promise((res,rej)=>{const L=new THREE.GLTFLoader();L.register(p=>({name:'EXT_texture_webp',loadTexture:()=>Promise.resolve(new THREE.Texture())}));L.parse(buf,XVA.dir,res,rej);});};true`);
    xe(EMU);
    xe(`FV.pick=${JSON.stringify(MAP)};true`); H.$('pm5v5').click(); await adv(50);
    let ok = false; for (let t = 0; t < 120000; t += 50) { if (xe('running') && !xe('!!window.xLdOn') && !H.shown('pre') && !H.shown('xAg') && xe('!!(NM.current&&NM.current.key)')) { ok = true; break; }
      if (H.shown('pre')) { xe(`FV.pick=${JSON.stringify(MAP)};true`); H.$('preGo').click(); } else if (H.shown('xAg')) { const tiles = H.doc.querySelectorAll('#xAg .x-ag'); const tile = tiles.find((b) => b.dataset.a === 'Jett' && !b.disabled) || tiles.find((b) => !b.disabled); if (tile) tile.click(); await adv(20); H.$('xAgL').click(); }
      await adv(50); await sleep(1); }
    assert(ok, MAP + ': 5v5 match running');
    assert(xe('bots.length>0&&allies.length>0'), MAP + ': agents spawned');
    // play: keep the player alive and turning (agents go on and off screen), bots fight; the round runs
    xe(`(window.XHK||(window.XHK=[])).push(()=>{try{if(player&&player.hp<60)player.hp=100;yaw+=0.02;}catch(e){}});FV.buy=0;__EQ.bad.length=0;__EQ.skBad.length=0;__EQ.draws=0;XSGR.skipped=XSGR.deferred=XSGR.flushed=0;true`);
    const SECS = +(process.env.SECS || 20);
    await adv(SECS * 1000);
    const on = JSON.parse(xe(`JSON.stringify({key:NM.current.key,frame:__EQ.frame,draws:__EQ.draws,skDraws:__EQ.skDraws,shells:__EQ.shells,bad:__EQ.bad,skBad:__EQ.skBad,skipped:XSGR.skipped,deferred:XSGR.deferred,flushed:XSGR.flushed,fz:XSGR.fz.length,mapG:XSGR.mapG===NM.current.M.g,rootFz:NM.current.M.g.matrixAutoUpdate===false,autoLeft:(()=>{const L=[];NM.current.M.g.traverse(o=>{if(o.matrixAutoUpdate&&L.length<12)L.push((o.name||o.type)+'<'+((o.parent&&o.parent.name)||'')+(o.onBeforeRender!==THREE.Object3D.prototype.onBeforeRender?' obr':'')+(o.userData.skirt?' skirt':''));});return L;})(),spikeFz:!!spike.userData.xsgrFz,sceneAuto:scene.matrixAutoUpdate,alive:bots.filter(b=>b.hp>0).length+allies.filter(b=>b.hp>0).length})`));
    out.push([MAP, 'on', on]);
    assert.equal(on.key, MAP, 'native map ' + MAP + ' loaded');
    assert(on.frame > 100, MAP + ': frames rendered ' + on.frame);
    assert.deepEqual(on.bad, [], MAP + ': drawn objects carry the fully recomputed matrixWorld');
    assert.deepEqual(on.skBad, [], MAP + ': drawn skinned meshes carry current bone matrices');
    assert(on.skipped > on.frame * 50, MAP + ': hidden nodes skipped (' + on.skipped + ' over ' + on.frame + ' frames)');
    assert(on.deferred > on.flushed, MAP + ': culled agents skip Skeleton.update (deferred ' + on.deferred + ', computed ' + on.flushed + ')');
    assert(on.fz > 0 && on.mapG && on.rootFz, MAP + ': map static nodes frozen (' + on.fz + ', root ' + on.rootFz + ')');
    assert.equal(on.spikeFz, false, MAP + ': the spike is never frozen');
    assert.equal(on.sceneAuto, false, MAP + ': scene root no longer forces');
    const fz0 = xe('XSGR.fz.length');
    // 5. movers: (a) a hidden top-level pool object moved while hidden, then shown; (b) a frozen map node moved; (c) a child of a hidden parent whose parent moved
    xe(`(()=>{const g=new THREE.Group(),m=new THREE.Mesh(new THREE.BoxGeometry(1,1,1),new THREE.MeshBasicMaterial());m.matrixAutoUpdate=false;m.position.set(0,1,0);m.updateMatrix();m.frustumCulled=false;g.add(m);scene.add(g);window.__T={g,m};return 1;})()`);
    await adv(100); xe(`__T.g.visible=false;true`); await adv(100);
    xe(`__T.g.position.set(3,0,-2);__T.g.rotation.y=1;true`); await adv(100); xe(`__T.g.visible=true;__EQ.bad.length=0;true`); await adv(100);
    assert.deepEqual(JSON.parse(xe('JSON.stringify(__EQ.bad)')), [], MAP + ': a hidden pool object moved while hidden is drawn at its new place');
    const e = JSON.parse(xe(`JSON.stringify(__T.m.matrixWorld.elements.slice(12,15).map(v=>+v.toFixed(4)))`)); assert.deepEqual(e, [3, 1, -2], MAP + ' moved object world position');
    xe(`(()=>{const [o]=XSGR.fz.find(([n])=>n.isMesh&&n.visible)||XSGR.fz[0];window.__F=o;o.position.x+=0.5;return 1;})()`); await adv(1200);
    assert(xe('__F.matrixAutoUpdate===true&&!XSGR.fz.some(([n])=>n===__F)'), MAP + ': a frozen map node that moves goes back to auto updates (watchdog)');
    assert(xe(`Math.abs(__F.matrixWorld.elements[12]-(__F.parent.matrixWorld.elements[12]+__F.position.x*__F.parent.matrixWorld.elements[0]+__F.position.y*__F.parent.matrixWorld.elements[4]+__F.position.z*__F.parent.matrixWorld.elements[8]))<1e-6`), MAP + ': its matrixWorld follows');
    xe(`__F.position.x-=0.5;true`);
    assert.equal(xe('XSGR.fz.length'), fz0 - 1, MAP + ': only that node was unfrozen during play');
    // 2. the same check with three's own update (optimisation off) - the reference is sound
    xe(`XSGR.mw=false;XSGR.sk=false;__EQ.bad.length=0;__EQ.skBad.length=0;__EQ.draws=0;true`); await adv(3000);
    const off = JSON.parse(xe(`JSON.stringify({draws:__EQ.draws,bad:__EQ.bad,skBad:__EQ.skBad,sceneAuto:scene.matrixAutoUpdate})`));
    out.push([MAP, 'off', off]);
    assert.deepEqual(off.bad, [], MAP + ' (off): reference check clean'); assert.deepEqual(off.skBad, [], MAP + ' (off): bones clean'); assert.equal(off.sceneAuto, true);
    xe(`XSGR.mw=true;XSGR.sk=true;__EQ.bad.length=0;true`); await adv(1000);
    assert.deepEqual(JSON.parse(xe('JSON.stringify(__EQ.bad)')), [], MAP + ': back on, still clean');
  }
  console.log(JSON.stringify(out));
  console.log('scene matrix equivalence: OK (every draw bit-identical matrixWorld / bone matrices with the render-time update optimised; hidden skipped, culled skeletons deferred, map frozen, movers update)');
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
