// Third-person locomotion (index.html xUbLoco): clip choice by speed and playback rate matched to ground speed, so the
// planted foot travels with the ground (no skating / moonwalking). The natural speed of every in-place clip is re-measured
// here from the shipped retargeted clip data (planted-foot travel per second, three agents), and the page's XUB_NAT must
// agree within 20 %. Then: idle / walk / jog / crouch-walk / fall selection, VALORANT speeds (walk 3.24, knife walk 4.05,
// rifle run 5.4, knife 6.75, crouch 2.0) give foot speed == ground speed, backpedal plays the clip in reverse.
const fs=require('fs'),path=require('path'),assert=require('assert/strict'),{T,parse}=require('./valorant_rigs');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const grab=(re)=>{const m=html.match(re);assert.ok(m,'source block '+re);return m[0];};
const src=grab(/const XUB_NAT = [^\n]*\n/)+grab(/const XUB_RATE = [^\n]*\n/)+grab(/function xUbLoco\([\s\S]*?\n}\n/);
const {XUB_NAT,XUB_RATE,xUbLoco}=new Function(src+'return {XUB_NAT,XUB_RATE,xUbLoco};')();
assert.ok(!/sp \/ 4\.5/.test(html)&&!/sp \/ 1\.6\)\)\)/.test(html),'old skating playback rates removed');
assert.ok(/xUbLoco\(sp, cw, back, air, gait\)/.test(html),'xUbAnim uses xUbLoco (clip path = fallback without the procedural gait, test_tp_gait.cjs)');
(async()=>{const nat={walk:[],run:[],crouchWalk:[]},clip={walk:'Walk_Loop',run:'Jog_Fwd_Loop',crouchWalk:'Crouch_Fwd_Loop'};
 for(const agent of ['jett','breach','sage']){const sc=(await parse(path.join(__dirname,'../models/valorant',agent+'.glb'))).scene;sc.updateMatrixWorld(true);const bx=new T.Box3().setFromObject(sc),scale=1.92/(bx.max.y-bx.min.y);
  const data=JSON.parse(fs.readFileSync(path.join(__dirname,'../models/valorant',agent+'-locomotion.json'))),mx=new T.AnimationMixer(sc),Lf=sc.getObjectByName('L_Foot'),Rf=sc.getObjectByName('R_Foot'),v=new T.Vector3(),w=new T.Vector3();
  for(const k in clip){const j=data.find(x=>x.name===clip[k]),c=T.AnimationClip.parse(j);c.uuid=T.MathUtils.generateUUID();mx.stopAllAction();mx.clipAction(c).play();const N=120,P=[];
   for(let i=0;i<=N;i++){mx.setTime(c.duration*i/N);sc.updateMatrixWorld(true);Lf.getWorldPosition(v);Rf.getWorldPosition(w);P.push([v.y,v.z,w.y,w.z]);}
   let planted=0,lo=1e9,hi=-1e9;for(let i=1;i<=N;i++){const a=P[i],b=P[i-1],f=a[0]<a[2]?1:3;planted+=Math.abs(a[f]-b[f]);lo=Math.min(lo,a[1]);hi=Math.max(hi,a[1]);}
   nat[k].push((planted*scale/c.duration+2*(hi-lo)*scale/c.duration)/2);}}
 for(const k in nat){const m=nat[k].reduce((a,b)=>a+b)/nat[k].length;assert.ok(Math.abs(XUB_NAT[k]-m)/m<.2,`${k} natural speed ${XUB_NAT[k]} vs measured ${m.toFixed(2)}`);}
 let L=xUbLoco(0,0,false,false);assert.equal(L.T.idle,1);assert.equal(L.mv,false);
 L=xUbLoco(.2,0,false,false);assert.equal(L.T.idle,1,'a near-stop is idle (VALORANT stops in ~0.1 s)');
 L=xUbLoco(4,0,false,true);assert.equal(L.T.fall,1,'airborne plays the fall pose');
 L=xUbLoco(1,0,false,false);assert.equal(L.T.walk,1,'slow movement uses the walk clip');
 for(const sp of [3.24,4.05,5.4,6.75]){L=xUbLoco(sp,0,false,false);assert.equal(L.T.run,1,sp+' m/s uses the jog clip');assert.ok(Math.abs(L.R.run*XUB_NAT.run-sp)/sp<.02,`${sp} m/s: foot ${L.R.run*XUB_NAT.run} = ground`);}
 L=xUbLoco(1,0,false,false);assert.ok(Math.abs(L.R.walk*XUB_NAT.walk-1)<.02,'walk foot speed = ground');
 L=xUbLoco(2,.62,false,false);assert.equal(L.T.crouchWalk,.62,'crouched: crouch-walk clip at the crouch blend');assert.ok(Math.abs(L.R.crouchWalk*XUB_NAT.crouchWalk-2)<.04,'crouch-walk foot speed = ground');
 L=xUbLoco(3.24,0,true,false);assert.ok(L.R.run<0,'backpedal plays the stride in reverse');
 L=xUbLoco(2,0,false,false);const sum=Object.values(L.T).reduce((a,b)=>a+b,0);assert.ok(Math.abs(sum-1)<1e-9,'walk/jog blend weights sum to 1');
 for(const k in XUB_RATE)assert.ok(XUB_RATE[k][1]*XUB_NAT[k]>=(k==='walk'?1.5:k==='run'?6.75:2.0),k+' rate cap covers its speed range');
 console.log('tp locomotion: natural speeds',Object.fromEntries(Object.entries(nat).map(([k,a])=>[k,+(a.reduce((x,y)=>x+y)/a.length).toFixed(2)])),'- clip choice and foot speed = ground speed at VALORANT speeds');
})().catch(e=>{console.error(e);process.exit(1);});
