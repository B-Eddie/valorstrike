// Third-person gun hold (user 2026-11-02: "looking at other players, they arent holding the gun right"): other players and
// bots, online and offline, draw the same rig (xvAgent: gun in a hold group under R_Hand, posed by work/grip_runtime.js).
// The game sizes each third-person gun like this: the shared native template (xGmTpl) is scaled to the old procedural
// stand-in's length (XGB, built here from index.html) - the first-person viewmodel length, not a world length. This test
// builds each agent + weapon with the game's own rig / upper-body / grip code (server/tools/grip-view.mjs) at that game size
// and checks, for every buyable gun in idle / run / crouch at three aim pitches:
//  - the gun is drawn at its world length: native model length x (0.95 m / native Vandal), so the guns keep VALORANT's own
//    proportions to each other (Vandal 0.95 m, Classic 0.23 m, Sheriff 0.32 m, Operator 1.28 m) - within 3 %;
//  - the right palm is on the grip (4 cm), the barrel points along the aim (2 deg);
//  - long guns: the support palm is on the weapon's own Left_Hand_Target (handguard) socket (7 cm), not slid back onto the
//    magazine; sidearms: the support hand cups the right hand (8 cm);
//  - reload (one-shots that used to drop the grip): the gun stays in the right hand (5 cm), canted forward-down off the aim
//    (10-60 deg) and not flung up, the support hand goes to the gun (on the receiver / magazine, 12 cm of the gun's lower line).
//   node work/test_tp_gun_hold.cjs
const assert=require('assert/strict'),fs=require('fs'),path=require('path'),vm=require('vm');const root=path.join(__dirname,'..');
const _w=console.warn;console.warn=(...a)=>{if(!/boneTransform/.test(String(a[0])))_w(...a);};
const WEAPONS=(process.env.WEAPONS||'Vandal,Phantom,Sheriff,Classic,Operator,Bandit,Warden,Ghost,Frenzy,Shorty,Stinger,Spectre,Bucky,Judge,Bulldog,Guardian,Marshal,Outlaw,Ares,Odin').split(',');
(async()=>{
 const THREE=await import(path.join(root,'server/node_modules/three/build/three.module.js'));
 const G=await import(path.join(root,'server/tools/grip-view.mjs'));const api=G.runtime();
 // the game's third-person template length per weapon: xGmTpl scales the native model to the procedural stand-in (XGB) length
 const html=fs.readFileSync(path.join(root,'index.html'),'utf8'),a=html.indexOf('const XNR = () => {};'),b=html.indexOf('const XGC = {};',a);assert(a>0&&b>a,'XGB block markers');
 const cx={THREE,skin:{},SKINS:[0x444444],gunDark:new THREE.MeshLambertMaterial()};vm.createContext(cx);vm.runInContext(html.slice(a,b)+';globalThis.XGB=XGB;',cx);
 const PL={};for(const w of Object.keys(cx.XGB)){const g=new THREE.Group();cx.XGB[w](g,new THREE.MeshLambertMaterial(),cx.gunDark);g.updateMatrixWorld(true);const bx=new THREE.Box3().setFromObject(g);PL[w]=bx.max.z-bx.min.z;}
 const fails=[];const ok=(c,m)=>{if(!c)fails.push(m);};
 const V=()=>new THREE.Vector3();
 const at=(R,a)=>V().fromArray(a).applyMatrix4(R.M.gun.matrixWorld);
 const palm=(R,s)=>R.bone(s+'_Hand').getWorldPosition(V()).lerp(R.bone(s+'_Middle1').getWorldPosition(V()),.6);
 let natV=null;
 for(const w of ['Vandal'].concat(WEAPONS.filter(x=>x!=='Vandal'))){
  const R=await G.build(w==='Bandit'||w==='Warden'?'breach':'jett',w.toLowerCase(),api);
  // resize the template to the game's length (as xGmTpl: rot scaled to PL, front at the stand-in's muzzle) and redo its grip data
  const rot=R.inner.parent,Tg=R.Tg;rot.scale.setScalar(1);rot.position.set(0,0,0);Tg.updateMatrixWorld(true);let gb=new THREE.Box3().setFromObject(Tg);const nat=gb.max.z-gb.min.z;if(w==='Vandal')natV=nat;
  rot.scale.setScalar(PL[w]/nat);Tg.updateMatrixWorld(true);gb=new THREE.Box3().setFromObject(Tg);rot.position.set(-(gb.min.x+gb.max.x)/2,-(gb.min.y+gb.max.y)/2,-gb.min.z-PL[w]);delete Tg.userData.grip;api.xgTemplate(Tg,w);
  const want=nat*0.95/natV;
  for(const st of ['idle','run','crouch'])for(const pit of [-0.5,0,0.5]){
   R.play(st,'aim');R.X.pit=pit;R.step(30);const g=Tg.userData.grip,tag=w+'/'+st+'/'+pit;R.M.m.updateMatrixWorld(true);
   const len=PL[w]*R.M.gun.getWorldScale(V()).x;
   const dir=V().set(0,0,-1).transformDirection(R.M.gun.matrixWorld),aim=V().set(0,Math.sin(pit),Math.cos(pit)),aimDeg=dir.angleTo(aim)*180/Math.PI;
   const right=palm(R,'R').distanceTo(at(R,g.rh));
   const left=g.side||!g.lh?palm(R,'L').distanceTo(palm(R,'R')):palm(R,'L').distanceTo(at(R,g.lh));
   if(pit===0&&st==='idle')console.log(tag.padEnd(22),'len',len.toFixed(3),'want',want.toFixed(3),'right',right.toFixed(3),'left',left.toFixed(3),'slide',(R.X.grip.slide||0).toFixed(3),'aim',aimDeg.toFixed(1));
   ok(Math.abs(len/want-1)<0.03,tag+' gun drawn at its world length '+want.toFixed(3)+' m (drawn '+len.toFixed(3)+')');
   ok(right<0.04,tag+' right palm on the grip ('+right.toFixed(3)+')');
   ok(aimDeg<2,tag+' barrel along the aim ('+aimDeg.toFixed(1)+' deg)');
   ok(left<(g.side||!g.lh?0.08:0.07),tag+(g.side||!g.lh?' support hand cups the right hand':' support palm on the handguard socket')+' ('+left.toFixed(3)+')');
  }
  // reload: still held
  R.play('idle','aim');R.X.pit=0;R.step(30);R.play('idle','reload');R.X.pit=0;R.step(18);R.M.m.updateMatrixWorld(true);
  {const g=Tg.userData.grip,tag=w+'/reload';const dir=V().set(0,0,-1).transformDirection(R.M.gun.matrixWorld),deg=dir.angleTo(V().set(0,0,1))*180/Math.PI;
   const right=palm(R,'R').distanceTo(at(R,g.rh));const ln=new THREE.Line3(at(R,[0,g.rh[1],g.rh[2]]),at(R,[0,g.rh[1],g.mz!=null?g.mz:g.rh[2]-0.3])),lp=palm(R,'L'),left=ln.closestPointToPoint(lp,true,V()).distanceTo(lp);
   console.log(tag.padEnd(22),'right',right.toFixed(3),'cant',deg.toFixed(1),'dirY',dir.y.toFixed(2),'left',left.toFixed(3));
   ok(right<0.05,tag+' gun stays in the right hand ('+right.toFixed(3)+')');
   ok(deg>10&&deg<60&&dir.y<0.2,tag+' gun canted forward-down, not flung ('+deg.toFixed(1)+' deg, dir.y '+dir.y.toFixed(2)+')');
   ok(left<0.12,tag+' support hand at the gun ('+left.toFixed(3)+')');}
  R.play('idle','aim');R.step(30);ok(R.X.grip.w>0.99,w+' grip back after the reload');
 }
 if(fails.length){console.error('FAIL '+fails.length+'\n'+fails.slice(0,60).join('\n'));process.exit(1);}
 console.log('tp gun hold ok: '+WEAPONS.length+' weapons x idle/run/crouch x 3 pitches + reload');
})().catch(e=>{console.error(e);process.exit(1);});
