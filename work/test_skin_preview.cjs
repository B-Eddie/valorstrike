// Collection / skin-select 3D preview uses the authentic model (user 2026-10-26: "When choosing skins in the collection,
// the 3D model isn't right - it's the blocky version"). Real page (work/page_harness.cjs, real three.js scene graph) in
// the lobby, where xGmLoad has never run (no mode launched) - the state the user saw. xvLoad / xskModelData are
// replaced by recorders that hand back a small GLTF-shaped scene tagged with the requested model, so the test sees
// exactly which glb + config the preview asks for. For EVERY weapon and EVERY skin variant in server/src/skins.json:
//  - the preview requests the skin's own asset model (assets[i].model + its descriptor), or for Standard the native
//    weapon glb XGM.F names (vandal, melee, ...) with its manifest config - the same pairs the game draws;
//  - while that load is pending the preview holds nothing (loading status, no mesh), and it then shows only that model;
//  - the procedural placeholder is never built (xGun and the XGB builders are not called), before or after the load;
//  - a late download for an older pick never replaces a newer pick; a failed load shows the error status, no blocky gun.
// Source checks: the preview code no longer calls xGun / xskApply, and the regenerated page carries the new code.
const assert=require('assert/strict'),fs=require('fs'),path=require('path');
const {boot}=require('./page_harness.cjs');
const cat=JSON.parse(fs.readFileSync(path.join(__dirname,'../server/src/skins.json'),'utf8'));
const src=fs.readFileSync(path.join(__dirname,'skins_runtime.js'),'utf8'),pv=src.slice(src.indexOf('function xskPreview()'),src.indexOf('function xskPvStatus('));
assert.ok(pv.length>200,'xskPreview source found');assert.ok(!/xGun\s*\(/.test(pv),'preview never builds xGun');assert.ok(!/xskApply\s*\(/.test(pv),'preview does not wait on XGM / xskApply');
assert.ok(fs.readFileSync(path.join(__dirname,'../index.html'),'utf8').includes('function xskPvTpl(w, id)'),'index.html regenerated with the preview loader');
const H=boot({real3:true,seed:3}),xe=H.xe,errs0=H.errors.length;
const tick=async(n=3)=>{for(let i=0;i<n;i++){H.advance(20);await new Promise(r=>setImmediate(r));}};
(async()=>{
 assert.equal(xe('XGM.rdy'),false,'lobby: native gun set not loaded (no mode launched)');
 // recorders: xvLoad(name) / xskModelData(asset) resolve when the test releases them
 xe(`window.__pv={loads:[],cfgs:[],held:[],hold:false,fail:null,gun:0,xgb:0};
  window.__mk=function(name){const sc=new THREE.Group();const m=new THREE.Mesh(new THREE.BoxGeometry(0.8,0.2,0.05),new THREE.MeshStandardMaterial());m.name='authentic:'+name;sc.add(m);return {scene:sc,animations:[]};};
  xvLoad=function(name){__pv.loads.push(name);if(__pv.fail===name)return Promise.reject(new Error('404 '+name));if(!__pv.hold)return Promise.resolve(__mk(name));return new Promise(r=>__pv.held.push([name,()=>r(__mk(name))]));};
  xskModelData=function(a){__pv.cfgs.push(a.config);return Promise.resolve({descriptor:{Constraints:[],FPExclusiveObjects:[],__cfg:a.config},fp:null});};
  {const g0=xGun;xGun=function(){__pv.gun++;return g0.apply(this,arguments);};for(const k in XGB){const b=XGB[k];XGB[k]=function(){__pv.xgb++;return b.apply(this,arguments);};}}
  true`);
 const S=()=>xe('JSON.stringify({key:XSK.pv&&XSK.pv.key,state:XSK.pv&&XSK.pv.state,status:XSK.pv?xskPvStatus(XSK.pv):null,meshes:(()=>{const o=[];if(XSK.pv)XSK.pv.piv.traverse(m=>{if(m.isMesh)o.push(m.name);});return o;})(),gun:__pv.gun,xgb:__pv.xgb})');
 const get=()=>JSON.parse(S());
 xe('xskOpen("col");true');await tick();
 let n=0;
 for(const [,list] of cat.categories)for(const w of list){
  xe('XSK_PV.clear();__pv.loads.length=0;__pv.hold=true;true');xe(`xskAct("weapon",${JSON.stringify(w)});true`);await tick();
  assert.deepEqual(get().meshes,[],'weapon page opens with nothing drawn until its model is in '+w);xe('__pv.held.splice(0).forEach(([,f])=>f());true');await tick();assert.equal(get().state,'ready',w+' equipped model ready');
  for(const col of cat.collections){const sk=col.skins[w];if(!sk)continue;
   for(let i=0;i<sk.ch.length;i++){const id=i?col.id+'.'+i:col.id,a=sk.assets&&sk.assets[i];
    const model=a?a.model:(w==='Knife'?'melee':w.toLowerCase());
    const cached=xe(`XSK_PV.has(${JSON.stringify(w+'|'+id)})`);xe('__pv.loads.length=0;__pv.cfgs.length=0;__pv.hold=true;true');
    xe(`xskAct("pick",null,${JSON.stringify(id)});true`);await tick();
    let s=get();assert.equal(s.key,w+'|'+id,'preview key '+w+' '+id);
    // cached from an earlier visit -> may already be ready; otherwise it must be loading with nothing drawn
    assert.equal(s.state,cached?'ready':'loading',w+' '+id+' state');
    if(s.state==='loading'){assert.deepEqual(s.meshes,[],'nothing drawn while loading '+w+' '+id);assert.match(s.status,/Loading original (skin|model)/);
     const loads=xe('JSON.stringify(__pv.loads)');assert.deepEqual(JSON.parse(loads),[model],'requested model '+w+' '+id);
     if(a)assert.deepEqual(JSON.parse(xe('JSON.stringify(__pv.cfgs)')),[a.config],'skin descriptor '+w+' '+id);
     xe('__pv.held.splice(0).forEach(([,f])=>f());true');await tick();s=get();}
    assert.equal(s.state,'ready',w+' '+id+' ready');assert.deepEqual(s.meshes,['authentic:'+model],'shows only the authentic model '+w+' '+id);assert.equal(s.status,'');
    assert.equal(xe('XSK.pv.obj.userData?1:1'),1);
    if(!a)assert.equal(xe(`(XV.config[${JSON.stringify(model)}]!==undefined)||!!XGM.F[${JSON.stringify(w)}]`),true,'standard config known '+w);
    n++;}}
  xe('xskAct("back");true');await tick();}
 const total=cat.collections.reduce((t,c)=>t+Object.values(c.skins).reduce((u,s)=>u+s.ch.length,0),0);assert.equal(n,total,'every weapon x skin variant previewed');
 let s=get();assert.equal(s.gun,0,'xGun never called by the preview');assert.equal(s.xgb,0,'no procedural builder ran');
 // late download for an older pick never wins
 xe('XSK_PV.clear();__pv.hold=true;__pv.held.length=0;true');xe('xskAct("weapon","Vandal");true');await tick();
 const pick1='prime',pick2='prime.1';xe(`xskAct("pick",null,"${pick1}");true`);await tick();xe(`xskAct("pick",null,"${pick2}");true`);await tick();
 const held=JSON.parse(xe('JSON.stringify(__pv.held.map(h=>h[0]))'));const va=cat.collections.find(c=>c.id==='prime').skins.Vandal.assets;assert.ok(held.includes(va[0].model)&&held.includes(va[1].model),'both picks pending '+held);
 const rel=m=>xe(`__pv.held.filter(h=>h[0]===${JSON.stringify(m)}).forEach(h=>h[1]());true`);
 rel(va[1].model);await tick();s=get();assert.equal(s.key,'Vandal|prime.1');assert.equal(s.state,'ready');const m2=s.meshes.slice();assert.deepEqual(m2,['authentic:'+va[1].model]);
 rel(va[0].model);rel('vandal');await tick();s=get();assert.deepEqual(s.meshes,m2,'older pick did not replace the newer one');
 // failed load: error status, nothing drawn, no blocky fallback; selecting again retries
 xe('XSK_PV.clear();__pv.hold=false;__pv.held.length=0;true');const pa=cat.collections.find(c=>c.id==='prime').skins.Phantom;
 if(pa){xe(`__pv.fail=${JSON.stringify(pa.assets[0].model)};xskAct("weapon","Phantom");xskAct("pick",null,"prime");true`);await tick();s=get();
  assert.equal(s.state,'error');assert.deepEqual(s.meshes,[]);assert.match(s.status,/failed/i);
  xe('__pv.fail=null;xskAct("pick",null,"prime");true');await tick();s=get();assert.equal(s.state,'ready','retry after a failure');}
 s=get();assert.equal(s.gun,0,'xGun never called');assert.equal(s.xgb,0,'no procedural builder ran');
 xe('xskClose();true');assert.equal(xe('XSK.pv'),null,'preview released');assert.equal(xe('XSK_PV.size'),0,'templates released with the page');
 const errs=H.errors.slice(errs0);assert.equal(errs.length,0,'page errors: '+errs.map(e=>String(e&&e.message||e)).slice(0,3).join(' | '));
 console.log('test_skin_preview: '+n+' weapon x skin variants previewed with the authentic model; no procedural mesh; ok');
 process.exit(0);
})().catch(e=>{console.error(e);process.exit(1);});
