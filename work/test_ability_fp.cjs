// First-person ABILITY viewmodel (work/ability_fp_runtime.js): abilities are drawn by the agent's own native FP arms
// (models/valorant/<agent>-fp.glb, the rig the guns and the knife use) playing Valorant's authored ability clips, never
// the old procedural box hand. (1) the legacy primitive hand / item path is gone from the page; (2) on the real assets,
// for all 12 agents x C/Q/E/X, the ability rig is that agent's own FP skeletal mesh, every clip of the ability's set
// resolves, the held item sits in the holding palm and the palm is in view while held; (3) the phases follow the equip
// flow timings: equip clip over the wiki equip time (XAB_EQT), release frame exactly at XABT.rel, end of the clip at
// XABT.rel + XABT.rec, item gone after the release.   node work/test_ability_fp.cjs   (in test_all)
const assert=require('assert/strict'),fs=require('fs'),path=require('path');const root=path.join(__dirname,'..');
console.warn=((w)=>(...a)=>{if(!/boneTransform/.test(String(a[0])))w(...a);})(console.warn);
(async()=>{
 const html=fs.readFileSync(path.join(root,'index.html'),'utf8'),eqSrc=fs.readFileSync(path.join(__dirname,'ability_equip_runtime.js'),'utf8'),vr=fs.readFileSync(path.join(__dirname,'valorant_runtime.js'),'utf8');
 // (1) legacy path unreachable: removed outright
 for(const re of [/function xCaHand\(/,/\bXEQV\b/,/function xEqItem\(/,/function xEqView\(/,/XCA\.h\b/,/XCA\.gl\b/])assert(!re.test(html),'legacy ability hand still in index.html: '+re);
 assert(!/xCaHand|XEQV/.test(eqSrc),'legacy ability viewmodel still in ability_equip_runtime.js');
 assert(html.includes('// ---- ABILITY FIRST PERSON ----')&&html.includes("xvLoad(ag.toLowerCase() + \"-fp\")"),'ability FP layer installed and built from the agent FP rig');
 assert(vr.includes("!(typeof XAF!=='undefined'&&XAF.on)"),'weapon rig yields to the ability rig');
 // (3) phase timing (pure)
 const FP=await import(path.join(root,'server/tools/ability-fp-view.mjs')),api=FP.runtime(),set=api.XAF_SET.nade,REL=.2,REC=.45;
 const ph=(st,t,o={})=>api.xAfPhase(set,{st,t,d0:.8,...o},REL,REC);
 assert.equal(ph('draw',.8).u,0);assert.equal(ph('draw',.4).u,.5);assert.equal(ph('draw',0).u,1);assert.equal(ph('draw',.4).clip,set.eq,'equip clip during the draw');
 assert.equal(ph('ready',0).clip,set.idle);assert.equal(ph('hold',0).ph,'hold');
 assert.equal(ph('rel',REL).u,0);assert.ok(Math.abs(ph('rel',0).u-set.rel)<1e-9,'release frame reached exactly at XABT.rel');assert.equal(ph('rel',0).item,true);
 assert.ok(Math.abs(ph('rec',REC).u-set.rel)<1e-9);assert.equal(ph('rec',0).u,1,'cast clip ends with the recovery');assert.equal(ph('rec',.2).item,false,'item left the hand');
 assert.equal(ph('rel',0,{alt:true}).clip,set.alt,'ALT FIRE plays the underhand');assert.ok(Math.abs(ph('rel',0,{alt:true}).u-set.arel)<1e-9);
 // (2) real assets, every agent / key
 const CODE={Jett:'Wushu',Phoenix:'Phoenix',Sova:'Hunter',Sage:'Thorne',Reyna:'Vampire',Omen:'Wraith',Killjoy:'Killjoy',Raze:'Clay',Skye:'Guide',Breach:'Breach',Cypher:'Gumshoe',Chamber:'Deadeye'};
 const only=process.env.AGENTS?process.env.AGENTS.split(','):Object.keys(CODE);let n=0;
 for(const ag of only){const B=await FP.build(ag,api);
  for(const k of 'cqex'){const sp=api.xAfSpec(ag,k),s=api.XAF_SET[sp.s];
   for(const c of [s.eq,s.idle,s.cast].concat(s.alt?[s.alt]:[],s.rEq?[s.rEq,s.rIdle,s.rCast]:[]))assert.ok(B.R.clips[c],ag+' '+k+': clip '+c+' resolves on the agent rig');
   for(const [p,u] of [['equip',.95],['idle',.3],['cast',.05]]){const m=await FP.pose(B,k,p,u);n++;
    assert.ok(m.ok,ag+' '+k+' '+p+' posed');assert.ok(new RegExp('^FP_'+CODE[ag]).test(m.mesh),ag+' uses its own FP arms, got '+m.mesh);
    assert.ok(m.itemToPalm<(sp.bone?0.25:sp.prop?0.06:0.03),`${ag} ${k} ${p}: item in the ${m.hand} hand (${m.itemToPalm.toFixed(3)} m)`);
    if(p==='idle')assert.ok(m.inView,`${ag} ${k}: holding hand in view while ready ${JSON.stringify(m.palm)}`);}}}
 // (4) ult / ability guns (Showstopper, Headhunter, Tour De Force): no primitive box gun left; the agent's own FP arms play
 // the authored set with the gun (native glb or the closest native stand-in) gripped in the right hand
 assert(!/\bXVM\b/.test(html)&&!/primitive viewmodels/.test(html),'box ult-gun viewmodels (XVM) removed');
 assert(/XAF_GUN\[BC\.vm\]/.test(html),'BC.vm guns drawn by the ability FP layer');
 const GP=(G,s,eq)=>api.xAfGunPhase(G,{t:0,f:-1,n:0,fired:0,...s},eq);
 for(const [k,mdl,eqT] of [['rk','showstopper',1.4],['hp','sheriff',1],['sn','operator',2.3]]){const G=api.XAF_GUN[k];assert.equal(G.model,mdl,k+' model');
  assert.equal(GP(G,{t:0},eqT).ph,'equip');assert.ok(Math.abs(GP(G,{t:eqT/2},eqT).u-.5)<1e-9,k+' equip over the windup');assert.equal(GP(G,{t:eqT+.01},eqT).ph,'idle');
  const f=GP(G,{t:.1,f:.1,n:1,fired:1},eqT);assert.equal(f.ph,'fire',k+' fire interrupts the equip');assert.ok(Math.abs(f.u-.1/G.L.fire[0])<1e-9,k+' fire at authored speed');
  assert.equal(GP(G,{t:9,f:G.L.fire[0]+.01,n:1,fired:1},eqT).ph,'idle',k+' back to idle after the fire');}
 if(!process.env.AGENTS||/Raze|Chamber/.test(process.env.AGENTS))for(const [ag,k] of [['Raze','rk'],['Chamber','hp'],['Chamber','sn']]){const B=await FP.build(ag,api),G=api.XAF_GUN[k];
  for(const c of [G.eq,G.idle,...G.fire])assert.ok(B.R.clips[c],ag+' '+k+': authored clip '+c+' on its own rig');
  const M=api.xAfGunModel(B.R,k);for(let i=0;i<200&&!M.ok;i++)await new Promise(r=>setTimeout(r,20));assert.ok(M.ok,k+' gun model loaded');
  for(const [clip,u] of [[G.eq,.95],[G.idle,.3],[G.fire[0],.1]]){api.xAfGunPose(B.R,k,{clip,u});B.cam.updateMatrixWorld(true);
   const T=await import('file://'+path.join(root,'server/node_modules/three/build/three.module.js'));const bb=new T.Box3().setFromObject(M.g),h=B.R.sc.getObjectByName('R_Hand').getWorldPosition(new T.Vector3());
   assert.ok(M.g.visible&&!bb.isEmpty(),k+' gun drawn');assert.ok(bb.distanceToPoint(h)<0.08,`${ag} ${k} ${clip}: gun in the right hand (${bb.distanceToPoint(h).toFixed(3)} m)`);
   assert.ok(bb.min.z<-0.5,k+' gun reaches forward of the camera');let mesh='';B.R.sc.traverse(o=>{if(o.isSkinnedMesh&&!mesh)mesh=o.name;});assert.ok(new RegExp('^FP_'+CODE[ag]).test(mesh),k+' on '+ag+"'s own arms");}
  if(G.gun){assert.ok(M.gm&&M.ga[G.gun[G.fire[0]]],'Showstopper plays its own AB_ clips');}}
 console.log('ability FP: legacy box hand removed; '+only.length+' agents x C/Q/E/X on their own native FP arms ('+n+' poses: clips resolve, item in the palm, hand in view); equip / release / recovery timings; ult guns rk/hp/sn on the native arms (box guns gone)');process.exit(0);
})().catch(e=>{console.error(e);process.exit(1);});
