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
 // (5) Jett Blade Storm: the knife viewmodel gives way to Jett's own Wushu X set (equip / idle / Attack01-05 throws alternating
 // R L R L R, RightClickAttack flurry). hk-37 (user: "the arms for Jett's ultimate look weird"): as in Valorant the hands are
 // open and the daggers FLOAT around them (two at the left edge, one under the crosshair, two at the right edge, one slot per
 // dagger left), never gripped in the palms; and the rig is framed for its authored 43.383 deg viewmodel camera (scaled across
 // and up in camera space), not drawn raw through the 70.5 deg world camera.
 assert(/J\.bsOn && J\.bs > 0 && typeof rw !== "undefined" && rw === "knife"\) return "bs"/.test(html),'Blade Storm drawn by the ability FP layer');
 assert(/jThrow = function \(\) \{ const c = J\.cd\.x;/.test(html),'Blade Storm throws drive the throw clips');
 assert(html.includes('camera.add(R.root); R.root.visible = true; XAF.on = true; xAfFov(R, camera.fov); }'),'every shown ability rig is FOV-matched');
 {const G=api.XAF_GUN.bs;const J_=x=>JSON.parse(JSON.stringify(x));assert.deepEqual(J_(G.hand),['R','L','R','L','R']);
  const f=n=>api.xAfGunPhase(G,{t:5,f:.01,n,fired:1});assert.deepEqual([1,2,3,4,5,6].map(n=>f(n).clip),J_([...G.fire,G.fire[0]]),'throws cycle Attack01-05');
  // ring layout (pure): one slot per dagger left, all on screen at 16:9 and 844x390, left ones point right, right ones left, bottom one up
  for(const asp of [16/9,844/390]){const r=api.xAfKnifeRing(5,asp,70.53,0),tv=Math.tan(70.53*Math.PI/360);assert.equal(r.length,5);
   for(const k of r){const sx=k.p[0]/(-k.p[2])/(tv*asp),sy=k.p[1]/(-k.p[2])/tv;assert.ok(Math.abs(sx)<0.9&&Math.abs(sy)<0.9,'dagger on screen '+sx.toFixed(2)+','+sy.toFixed(2));assert.ok(Math.abs(Math.hypot(...k.d)-1)<1e-9);}
   assert.ok(r[0].d[0]>0.5&&r[1].d[0]>0.5&&r[3].d[0]<-0.5&&r[4].d[0]<-0.5&&r[2].d[1]>0.5,'daggers point in / up');}
  assert.deepEqual([5,4,3,1,0].map(n=>api.xAfKnifeRing(n,16/9,70.53,0).length),[5,4,3,1,0],'one dagger per knife left');
  {// a narrower hip lens (wider than 16:9: horizontal capped at 103 deg, db9313f; 844x390 -> 60.4 deg vertical) keeps each dagger's screen spot and screen size (depth pushed out)
   const v2=2*Math.atan(Math.tan(103*Math.PI/360)/(844/390))*180/Math.PI,a=api.xAfKnifeRing(5,844/390,70.53,0),b=api.xAfKnifeRing(5,844/390,v2,0),t1=Math.tan(70.53*Math.PI/360),t2=Math.tan(v2*Math.PI/360);
   for(let i=0;i<5;i++){const ya=a[i].p[1]/(-a[i].p[2])/t1,yb=b[i].p[1]/(-b[i].p[2])/t2,za=1/(-a[i].p[2]*t1),zb=1/(-b[i].p[2]*t2);assert.ok(Math.abs(ya-yb)<1e-9&&Math.abs(za-zb)<1e-9,'dagger '+i+' screen spot / size kept at '+v2.toFixed(1)+' deg');}}
  if(!process.env.AGENTS||/Jett/.test(process.env.AGENTS)){const B=await FP.build('Jett',api),T=await import('file://'+path.join(root,'server/node_modules/three/build/three.module.js'));
   for(const c of [G.eq,G.idle,G.alt,...G.fire])assert.ok(B.R.clips[c],'Jett authored clip '+c);
   // FOV match: x / z and y / z of every bone grow by s = tan(70.53/2) / tan(43.383/2) (= the authored view), depth unchanged
   api.xAfGunPose(B.R,'bs',{clip:G.idle,u:.3});B.cam.updateMatrixWorld(true);const bone=n=>B.R.sc.getObjectByName(n).getWorldPosition(new T.Vector3());const h0=bone('R_Hand');
   const s=api.xAfFov(B.R,70.53);assert.ok(Math.abs(s-Math.tan(70.53*Math.PI/360)/Math.tan(43.383*Math.PI/360))<1e-9&&s>1.7);B.cam.updateMatrixWorld(true);const h1=bone('R_Hand');
   assert.ok(Math.abs(h1.z-h0.z)<1e-6&&Math.abs(h1.x-h0.x*s)<1e-6&&Math.abs(h1.y-h0.y*s)<1e-6,'hand moved as the authored 43 deg view: '+h0.toArray()+' -> '+h1.toArray());
   assert.equal(api.xAfFov(B.R,70.53),s,'idempotent');
   B.cam.fov=70.53;B.cam.aspect=16/9;const M=api.xAfGunModel(B.R,'bs');for(let i=0;i<200&&!M.ok;i++)await new Promise(r=>setTimeout(r,20));assert.ok(M.ok,'daggers loaded');
   assert.equal(M.l,undefined,'no left-palm knife holder');
   for(const [clip,u,n] of [[G.eq,.95,5],[G.idle,.3,5],[G.fire[0],.03,4],[G.fire[1],.03,3],[G.alt,.04,5],[G.idle,.5,1]]){api.xAfGunPose(B.R,'bs',{clip,u});const shown=api.xAfKnifePose(B.R,M,n);B.cam.updateMatrixWorld(true);
    assert.equal(shown,n,clip+' daggers shown');assert.equal(M.g.parent,B.cam,'daggers float in camera space (not parented to a hand)');
    const vis=M.k.filter(w=>w.visible);assert.equal(vis.length,n);
    for(const w of vis){const bb=new T.Box3().setFromObject(w),sz=bb.getSize(new T.Vector3()).length(),c=bb.getCenter(new T.Vector3());assert.ok(sz>.18&&sz<.35,'dagger size '+sz);
     for(const sd of ['R','L'])assert.ok(c.distanceTo(bone(sd+'_Hand'))>0.1,`${clip}: dagger not in the ${sd} hand`);}}}}
 // (6) Sova's bow is his own model (agents/sova.glb Hunter_Bow mesh on Bow_Static), not a primitive torus; borrowed sets per cast
 assert(!/TorusGeometry/.test(html.slice(html.indexOf('// ---- ABILITY FIRST PERSON ----'),html.indexOf('// ---- END ABILITY FIRST PERSON ----'))),'no primitive bow');
 {const K=api.XAF_K;assert.equal(K.Phoenix.q.s,'flick');assert.equal(K.Phoenix.e.s,'nade');assert.equal(K.Sage.c.s,'place');assert.equal(K.Sage.x.s,'wolf');}
 if(!process.env.AGENTS||/Sova/.test(process.env.AGENTS)){const B=await FP.build('Sova',api),T=await import('file://'+path.join(root,'server/node_modules/three/build/three.module.js'));await FP.pose(B,'q','idle',.3);
  for(let i=0;i<200&&!(B.R.bow&&B.R.bow.userData.ok);i++)await new Promise(r=>setTimeout(r,20));await FP.pose(B,'q','idle',.3);const bow=B.R.bow;assert.ok(bow&&bow.userData.ok&&bow.visible,'Sova bow loaded');
  const mats=[];bow.traverse(o=>{if(o.isMesh)[].concat(o.material).forEach(m=>mats.push(m.name));});assert.ok(mats.length&&mats.every(n=>/^Hunter_Bow/.test(n)),'bow = Hunter_Bow mesh '+mats);
  B.cam.updateMatrixWorld(true);const bb=new T.Box3().setFromObject(bow),sz=bb.getSize(new T.Vector3()),l=B.R.sc.getObjectByName('L_Hand').getWorldPosition(new T.Vector3());
  assert.ok(Math.abs(sz.y-api.XAF.bowH)<0.05,'bow upright in view, '+sz.y.toFixed(2)+' m tall');assert.ok(bb.distanceToPoint(l)<0.06,'bow in the left fist');}
 console.log('ability FP: legacy box hand removed; '+only.length+' agents x C/Q/E/X on their own native FP arms ('+n+' poses: clips resolve, item in the palm, hand in view); equip / release / recovery timings; ult guns rk/hp/sn on the native arms (box guns gone); Blade Storm on the Jett Wushu set with floating daggers, FOV-matched rig; Sova holds his own bow model');process.exit(0);
})().catch(e=>{console.error(e);process.exit(1);});
