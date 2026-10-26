// Bot/remote gun aim must survive the complete snapshot -> interpolation -> visual -> mixer/grip path.
// Native rigs and weapons are loaded locally; world-space barrel direction is compared to the server's aim,
// including elevated floors, an unrelated local player, wrapped yaw and the full +/-1.5 rad pitch range.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.join(__dirname,'..'),html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const cut=(a,b)=>{const i=html.indexOf(a),j=html.indexOf(b,i);assert(i>=0&&j>i,a);return html.slice(i,j);};
const warn=console.warn;console.warn=(...a)=>{if(!/boneTransform/.test(String(a[0])))warn(...a);};
(async()=>{
 const T=await import(path.join(root,'server/node_modules/three/build/three.module.js'));
 const G=await import(path.join(root,'server/tools/grip-view.mjs')),api=G.runtime(),c=api.ctx;
 Object.assign(c,{mode:'five',xFvOK:false,FV:{},WEAP:{},bots:[],allies:[],player:{x:100,y:80,z:100,ch:0,hp:100},groundAt:()=>5});
 vm.runInContext(html.match(/const XUB_LO = [^\n]+/)[0]+'\n'+cut('const XUB_NAT =','// after the mixer:')+'\n'+cut('function xBotAim(','const clock = new THREE.Clock()'),c);
 let samples=0,worst=0,fixture;
 for(const [agent,weapon]of [['jett','vandal'],['breach','operator'],['sage','sheriff']]){
  const R=await G.build(agent,weapon,api),M=R.M,X=R.X,g=new T.Group();g.position.set(4,5,-3);g.add(M.m);
  if(!fixture)fixture=R;
  Object.assign(M,{ub:1,bd:new T.Group(),hd:new T.Group(),lL:new T.Group(),lR:new T.Group(),aL:new T.Group(),aR:new T.Group()});
  Object.assign(X,{cb:0,shots:0,sn:0,ut:0,lt:0,hp:100,spS:0});
  const b={g,xm:M,xp:{x:4,z:-3},xwk:0,xph:0,hp:100,alive:true,nt:1,np:0};c.bots=[b];
  R.step(60); // grip fully blended before checking instantaneous aim updates
  for(const yaw of [-2.8,-.7,0,1.4,Math.PI])for(const pitch of [-1.5,-.6,0,.6,1.5]){
   g.rotation.y=yaw;b.np=pitch;
   c.xVisB(b,1/60,0,false);
   assert.equal(X.pit,pitch,'animation samples the current authoritative pitch before the mixer');
   R.step(1);
   const gun=new T.Vector3(0,0,-1).transformDirection(M.gun.matrixWorld),aim=new T.Vector3(Math.sin(yaw)*Math.cos(pitch),Math.sin(pitch),Math.cos(yaw)*Math.cos(pitch));
   const err=gun.angleTo(aim);worst=Math.max(worst,err);samples++;
   assert(err<1e-4,`${agent}/${weapon} yaw ${yaw}, pitch ${pitch}: world gun/aim error ${err}`);
  }
  // Offline navigation np must never be treated as pitch; use the AI's actual target and both floors.
  b.nt=0;b.np=[10,20];b.xTt={g:new T.Group(),hp:100,alive:true};b.xTt.g.position.set(4,5,7);
  c.xVisB(b,1/60,0,false);assert(Math.abs(X.pit-Math.atan2(-.2,10))<1e-12,'offline target on same raised floor stays nearly horizontal');
  b.xTt.g.position.y=8;c.xVisB(b,1/60,0,false);assert(Math.abs(X.pit-Math.atan2(2.8,10))<1e-12,'offline target floor is included');
  b.xTt=c.player;c.player.x=4;c.player.y=5;c.player.z=7;c.player.ch=0;
  c.xVisB(b,1/60,0,false);assert(Math.abs(X.pit-Math.atan2(-.1,10))<1e-12,'viewer and bot on 5 m floor do not produce the former 27 degree upward aim');
  // Allied bots keep their selected target even when another enemy is nearer.
  const near={g:new T.Group(),hp:100,alive:true};near.g.position.set(4,20,-2);c.bots=[near];b.xTt={g:new T.Group(),hp:100,alive:true};b.xTt.g.position.set(4,7,7);
  c.xVisB(b,1/60,0,true);assert(Math.abs(X.pit-Math.atan2(1.9,10))<1e-12,'ally pitch follows its actual target');
 }
 // Execute the real enemy firing point selection before bSpread, then compare the native gun to that selected aim.
 // This catches eye-only reconstruction: at 2 m a body shot sits over 12 degrees below the head shot.
 const shot=cut('      const pt = XTK.pt, aim = XTK.aim, mv = XTK.mv, hp =','xBotAim(b, aim);')+'xBotAim(b, aim);}'; // merged gate: fallback aim lives inside if (hp === undefined) { ... }, so close that block
 vm.runInContext('function selectShot(b,eye,from){'+shot+'return aim.clone();}',c);
 const M=fixture.M,g=new T.Group();g.position.set(4,5,-3);g.add(M.m);
 const b={g,xm:M,xp:{x:4,z:-3},xwk:0,xph:0,hp:100,alive:true,nt:0,w:'Vandal'},from=new T.Vector3(4,6.7,-3);
 c.XTK={pt:new T.Vector3(),aim:new T.Vector3(),mv:new T.Vector3(),q:new T.Vector3()};
 const checkAim=(direction,label)=>{c.xVisB(b,1/60,0,false);fixture.step(1);const barrel=new T.Vector3(0,0,-1).transformDirection(M.gun.matrixWorld);assert(barrel.angleTo(direction)<1e-4,label);};
 for(const head of [false,true])for(const floor of [5,8]){
  b.hd=head;b.xTt={x:5,y:floor,z:-1,hp:100};g.rotation.y=.3;
  const eye=new T.Vector3(5,floor+1.6,-1),selected=c.selectShot(b,eye,from),expected=new T.Vector3(1,floor+1.6-(head?0:.45)-6.7,2).normalize();
  assert(selected.angleTo(expected)<1e-7,'real firing path selects '+(head?'head':'body')+' height');
  c.XTK.aim.set(.7,.7,0).normalize(); // spread must not steer the held gun away from the selected pre-spread aim
  checkAim(selected,'native gun matches actual '+(head?'head':'body')+' firing aim on floor '+floor);
 }
 for(const y of [-1,1]){const vertical=new T.Vector3(0,y,0);c.xBotAim(b,vertical);checkAim(vertical,'directly vertical offline aim keeps a valid gun frame');}
 // Allied damage selection has its own head/body branch; preserve that selected height too.
 const allyShot=cut('        const hs = Math.random() < 0.2, AW = WEAP[a.w || "Vandal"];',' hurt(tg,');
 vm.runInContext('function selectAllyShot(a,tg,from){'+allyShot+'}',c);c.WEAP.Vandal={head:160,body:40};
 const allyTarget={g:new T.Group()};allyTarget.g.position.set(5,5,-1);c.Math=Object.create(Math);
 for(const head of [false,true]){c.Math.random=()=>head?.1:.9;c.selectAllyShot(b,allyTarget,from);assert.equal(b.hd,head);checkAim(new T.Vector3(1,5+(head?1.5:1.05)-6.7,2).normalize(),'allied native gun matches selected '+(head?'head':'body')+' shot');}
 c.Math=Math;
 // Execute the real utility fire path. A low turret must override an unrelated agent target, including between shots.
 let device={kind:'turret',x:2,y:5.45,z:-6,o:{},hit(){}};let tracer;
 Object.assign(c,{running:true,botCanShoot:()=>true,BotBrain:{shootUtility:C=>C[0]},xUtilCands:()=>[device],los:()=>true,SFX:{at(){}},bFx:(o,d)=>{tracer=d.clone();},wDmg:()=>40});c.WEAP.Vandal={rate:10};
 vm.runInContext(cut('const XUS_V = new THREE.Vector3()','// Jett Tailwind / Updraft'),c);
 b.cd=0;assert.equal(c.xUtilShoot(b,.05,from,true),true);checkAim(tracer,'native gun matches actual utility tracer rather than xTt');
 const firstPitch=M.xap;device={...device,y:8};assert.equal(c.xUtilShoot(b,.001,from,true),true);
 checkAim(new T.Vector3(device.x-from.x,device.y-from.y,device.z-from.z).normalize(),'utility aim updates during weapon cooldown');assert(M.xap>firstPitch,'utility pitch tracks changed target height');
 c.xUtilCands=()=>[];assert.equal(c.xUtilShoot(b,.05,from,true),false);assert.equal(b.xaimOn,false,'cleared utility selection cannot leave stale device aim');
 c.xVisB(b,1/60,0,false);assert.equal(M.xap,0,'off-fight gun stays level instead of pointing at the distant local player or stale target');
 // Feed real rows through the snapshot handler and netPose wrapper, then interpolate both aim axes together.
 const u={g:new T.Group(),nb:[],alive:true,hp:100,name:'Bot',agent:'Jett',nt:1,nid:2,xyw:-1},n={running:true,MP:{st:'game',me:1,DELAY:100},NET:{socket:{}},bots:[u],allies:[],XAG:{Jett:1},FV:{},performance:{now:()=>n.now},now:1000,mpClean:s=>s,mpCliKD(){},showStats(){},xAng:x=>Math.atan2(Math.sin(x),Math.cos(x))};
 vm.createContext(n);vm.runInContext(cut('function mpCliSnap(','function mpCliSelf(')+'\n'+cut('function mpInterp(','const MPT =')+'\n'+cut('const netPose0=mpCliSnap;','let netFxReplay='),n);
 const row=(yaw,pitch)=>[2,1,'Bot','Jett',4,5,-3,yaw,100,50,1,'Vandal',0,0,0,25,75,0,pitch];
 n.mpCliSnap({u:[row(3.1,-.4)]});n.now=1100;n.mpCliSnap({u:[row(-3.1,.8)]});
 assert.equal(u.np,.8,'snapshot pitch is retained before interpolation');
 n.mpInterp(u,1150);assert(Math.abs(u.np-.2)<1e-12,'pitch uses the same midpoint as yaw');assert(Math.abs(u.g.rotation.y-Math.PI)<1e-12,'yaw interpolates across the wrap');
 Object.assign(u,{xm:fixture.M,xp:{x:4,z:-3},xwk:0,xph:0});u.g.add(fixture.M.m);c.xVisB(u,1/60,0,false);fixture.step(1);
 const barrel=new T.Vector3(0,0,-1).transformDirection(fixture.M.gun.matrixWorld),expected=new T.Vector3(0,Math.sin(.2),-Math.cos(.2));
 assert(barrel.angleTo(expected)<1e-4,'snapshot -> interpolation -> visual -> animation -> world barrel follows authoritative aim');
 // The AI's turn-rate limit must leave an already interpolated remote yaw alone (both implementations).
 vm.runInContext(cut('function xBotYaw(dt)','function xFace('),n);n.xBotYaw(1/60);assert(Math.abs(u.g.rotation.y-Math.PI)<1e-12,'base AI yaw smoothing skips remote units');
 Object.assign(n,{window:{},xbBrain(){return null;}});vm.runInContext(cut("if(typeof xBotYaw==='function'){xBotYaw=",'function xbTurned('),n);n.xBotYaw(1/60);assert(Math.abs(u.g.rotation.y-Math.PI)<1e-12,'personality AI yaw smoothing skips remote units');
 console.log(`bot aim: ${samples} native world gun/aim checks; max error ${(worst*180/Math.PI).toFixed(6)} degrees; real body/head/utility firing aims, raised floors, snapshot interpolation and frame ordering passed`);
})().catch(e=>{console.error(e);process.exit(1);});
