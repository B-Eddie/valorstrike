// Spectator follow: living TEAMMATES only, first person (VALORANT; user 2026-10-26 "You shouldn't be able to spectate enemy",
// "There isn't supposed to be a 3rd person when spectating when dead").
// 1. Follow logic (index.html xKLDie / xSpec / xSpecPick cut as test_spectate.cjs does): the cam stays on the followed
//    teammate when another teammate dies, Space / click step from them, the followed one's death moves the cam to the next
//    living teammate after them; whole team dead = nobody (null, "NO TEAMMATES ALIVE"; never the killer or another enemy);
//    respawn modes (deathmatch / TDM: FV.dm without MP.m5) never spectate; online 5v5 (FV.dm with MP.m5) follows teammates
//    only; a new death starts from the first living teammate.
// 2. Real page (work/page_harness.cjs, real three.js scene) on a raised native floor (y 6.4), offline 5v5 after a plant and
//    the online 5v5 path (MP.m5 + FV.dm, the death from xKLDie as the server's kill message): after the 2 s killed-by card
//    the camera is the last living teammate's eye (y = floor + 1.6), the floor guard lifts it for a target sunk under its
//    floor, and when that teammate dies too the camera HOLDS that last view (no enemy cam, no orbit, no 3rd person).
const fs=require('fs'),vm=require('vm'),assert=require('assert/strict'),s=fs.readFileSync(__dirname+'/../index.html','utf8');
const cut=(a,b)=>{const i=s.indexOf(a);assert(i>=0,a);const j=s.indexOf(b,i);assert(j>=0,b);return s.slice(i,j);};
class El{constructor(){this.style={};this.cls=new Set();this.classList={add:k=>this.cls.add(k),remove:k=>this.cls.delete(k),toggle(){},contains:k=>this.cls.has(k)};this.textContent='';}set innerHTML(h){}querySelector(){return new El();}querySelectorAll(){return [new El(),new El()];}addEventListener(){}setAttribute(){}}
const A=['Sage','Jett','Omen','Sova'].map(name=>({name,alive:true,g:{}})),B=['Reyna','Raze','Killjoy'].map(name=>({name,alive:true,g:{}}));
const c={document:{createElement:()=>new El(),body:{appendChild(){}},pointerLockElement:null,exitPointerLock(){}},allies:A,player:{hp:0},bots:B,FV:{dm:false},MP:{m5:false},say(){},renderer:{domElement:{style:{}}},mode:'five',console,xAg:()=>'',xTPToggle(){}};vm.createContext(c);
vm.runInContext(cut('let xHS = false; const xKL','// observer pass: first-person').replace('let xHS','var xHS').replace('const xKL =','var xKL =').replace(/^const xKLm/m,'var xKLm').replace(/addEventListener\("mousedown"[^\n]*\n/,''),c);
const spec=()=>{const a=c.xSpec(.1);return a&&a.name;};
vm.runInContext('xKLDie("Raze","Vandal")',c);assert.equal(c.xSpec(2.5)?.name,'Sage','first living teammate after the killed-by card');
c.xKL.si++;assert.equal(spec(),'Jett','Space: next teammate');
A[0].alive=false;assert.equal(spec(),'Jett','a teammate earlier in the list dies: still on Jett (was Omen)');
c.xKL.si++;assert.equal(spec(),'Omen','Space steps from Jett');c.xKL.si--;assert.equal(spec(),'Jett','right click steps back');
A[1].alive=false;assert.equal(spec(),'Omen','Jett dies: next living after him');
c.xKL.si++;assert.equal(spec(),'Sova');c.xKL.si++;assert.equal(spec(),'Omen','cycling wraps');
A[3].alive=false;assert.equal(spec(),'Omen','Sova (not followed) dies: stays');
A[2].alive=false;assert.equal(spec(),null,'whole team dead: nobody (never the killer)');assert.match(c.xKL.sn.textContent,/^NO TEAMMATES ALIVE$/);
c.xKL.si++;assert.equal(spec(),null,'Space never reaches an enemy');c.xKL.si--;assert.equal(spec(),null);
assert.doesNotMatch(c.xKL.sn.textContent,/ENEMY|SPIKE CAM/);
const reset=()=>{A.forEach(a=>a.alive=true);B.forEach(b=>b.alive=true);c.xKLReset();};
reset();vm.runInContext('xKLDie("Raze","Vandal")',c);assert.equal(c.xSpec(2.5)?.name,'Sage','a new death starts from the first living teammate');
reset();c.FV.dm=true;vm.runInContext('xKLDie("Raze","Vandal")',c);assert.equal(c.xSpec(2.5),null,'respawn modes (FV.dm): no spectating, teammates alive or not');
c.MP.m5=true;assert.equal(spec(),'Sage','online 5v5 (FV.dm + MP.m5): a teammate');A.forEach(a=>a.alive=false);assert.equal(spec(),null,'online 5v5, team wiped: never an enemy');c.FV.dm=false;c.MP.m5=false;
for(let i=0;i<20;i++){reset();A.forEach((a,j)=>a.alive=j===i%4);vm.runInContext('xKLDie("Raze","Vandal")',c);const x=c.xSpec(2.5);assert.ok(x&&A.includes(x),'only teammates ('+i+')');c.xKL.si+=i;assert.ok(A.includes(c.xSpec(.1)));}
console.log('Spectate follow: stays on the followed teammate, steps from them, next after their death; team wiped: nobody (no enemy cam); respawn modes never spectate');

// ---- 2. real page on a raised native floor ----
// The audit fixture strips the native-maps block, so the page gets a raised native map of its own: one floor slab at y 6.4
// (as Lotus's sites) in the page's solids, a 2 m nav grid on it, and the real nmNear / nmHeight cut from index.html over a
// ray-cast stand-in for the map's BVH (the slab's top face). Before the fix the team-wipe orbit centred at y 1 under the
// slab, its pull-in ray hit the slab's underside and left the camera at ~y 2.3: 4 m under the map.
if(process.env.SPEC_UNIT_ONLY)process.exit(0);
const {boot}=require('./page_harness.cjs');
const H=boot({real3:true,seed:11}),xe=H.xe,errs0=H.errors.length,x0=H.xErrCalls.length;
const adv=async ms=>{for(let t=0;t<ms;t+=50){H.advance(Math.min(50,ms-t));await new Promise(r=>setImmediate(r));}};
const through=async()=>{for(let t=0;t<30000;t+=100){if(xe('running')&&!xe('!!window.xLdOn')&&!H.shown('pre')&&!H.shown('xAg'))return true;
 if(H.shown('pre'))H.$('preGo').click();else if(H.shown('xAg')){const tiles=H.doc.querySelectorAll('#xAg .x-ag').filter(b=>!b.disabled);if(tiles.length)tiles[0].click();await adv(20);H.$('xAgL').click();}
 await adv(100);}return false;};
const nmSrc=cut('const NM_NONE=[];function nmCellNum(C){','\n')/* hark-perf 762e33c: nmNear reads the numeric cell index (nmCellNum, NM_NONE) */+'\n'+cut('function nmNear(C,x,z,y','\n')/* (C,x,z,y) or (C,x,z,y,yBand) */+'\n'+cut('function nmHeight(C,x,z,y){','\n')+'\n'+cut('var NM_Q=','\n')/* perf2: nmHeight casts through nmRayFirst (on the NM_Q line; this stand-in bvh has no _roots, so it falls back to its raycastFirst) */;
const FY=6.4,out=[];
const camCheck=(tag,ry)=>JSON.parse(xe(`(()=>{const a=xKL.cur,C=nmActive(),cy=camera.position.y;if(a){const q=a.g.position,f=nmHeight(C,q.x,q.z,${ry==null?'q.y':ry}+.5);return JSON.stringify({tag:${JSON.stringify(tag)},who:a.name,enemy:bots.includes(a),alive:!!a.alive,cy,f,qy:q.y,ok:a.alive&&cy>=f+1.2-1e-6});}
 const o=XOB.orb;if(!o)return JSON.stringify({tag:${JSON.stringify(tag)},none:true,cy,hp:player.hp,on:xKL.on,sp:xKL.sp,st:xKL.st,mode,dm:FV.dm,m5:MP.m5,bots:bots.filter(b=>b.alive).length,running,al:allies.filter(b=>b.alive).length});const f=nmHeight(C,o.cx,o.cz,(o.cy||0)+.5);return JSON.stringify({tag:${JSON.stringify(tag)},orbit:true,cy,f,ok:cy>=f+1.2})})()`));
(async()=>{
 H.$('pm5v5').click();await adv(50);assert.ok(await through(),'5v5 did not start');
 xe(`(()=>{${nmSrc};window.nmNear=nmNear;window.nmHeight=nmHeight;window.nmCellNum=nmCellNum;window.nmRayFirst=nmRayFirst;/* perf2: the spectator floor guard casts through the runtime nmRayFirst */const FY=${FY},nodes=[],cells=new Map();
  for(let x=-60;x<=60;x+=2)for(let z=-60;z<=60;z+=2){const i=nodes.length;nodes.push([x,FY,z]);const k=Math.floor(x/2)+','+Math.floor(z/2);if(!cells.has(k))cells.set(k,[]);cells.get(k).push(i);}
  const slab=new THREE.Mesh(new THREE.BoxGeometry(400,.4,400),new THREE.MeshBasicMaterial());slab.position.set(0,FY-.2,0);slab.updateMatrixWorld(true);scene.add(slab);solids.push(slab);
  const top={y:FY},bvh={raycastFirst(r){const dy=r.direction.y,oy=r.origin.y;if(dy<0&&oy>FY)return {point:{x:r.origin.x,y:FY,z:r.origin.z},face:{normal:{x:0,y:1,z:0}}};if(dy>0&&oy<FY)return {point:{x:r.origin.x,y:FY,z:r.origin.z},face:{normal:{x:0,y:1,z:0}}};return null;}};
  const C={nav:{nodes},cells,bvh,playable:null};window.__specC=C;window.nmActive=()=>C;return 1})()`);
 const setup=(online)=>`(()=>{for(const u of bots.concat(allies))u.nt=true;FV.buy=0;buyMenu(false);timeLeft=999;FV.atk=true;const k=Object.keys(SITES)[0],x0=SITES[k][0],z0=SITES[k][1];
  FV.sp.st="plant";FV.sp.site=k;FV.sp.x=x0;FV.sp.z=z0;FV.sp.c=null;FV.sp.t=40;spike.position.set(x0,${FY}+.4,z0);
  bots.forEach((b,i)=>{b.alive=true;b.hp=100;b.g.position.set(x0+2+i,${FY},z0+1);b.sunkY=null;Object.defineProperty(b.g.position,'y',{configurable:true,get(){return b.sunkY==null?${FY}:b.sunkY},set(){}});if(!b.g.parent)scene.add(b.g);});/* units stand on the slab (the box-map grounding would put them back at y 0; a native map grounds them with nmHeight) */
  allies.forEach((a,i)=>{a.g.position.set(x0-2-i,${FY},z0-3);a.nt=true;a.sunkY=null;Object.defineProperty(a.g.position,'y',{configurable:true,get(){return a.sunkY==null?${FY}:a.sunkY},set(){}});});/* teammates stand on the slab too */
  player.x=x0-2;player.z=z0-2;player.y=${FY};player.vy=0;player.hp=100;${online?'clearTimeout(FV.to);running=true;try{$("xBan").style.display="none";$("result").style.display="none"}catch(e){}MP.m5=true;FV.dm=true;window.__sp0=[dmSpawnP,dmSpawnB];dmSpawnP=dmSpawnB=function(){};/* online: respawns come from the server, not the offline deathmatch tick */':''}return k;})()`;
 for(const online of [false,true]){
  const tag=online?'online':'offline';out.push(tag+' site '+xe(setup(online)));
  const last=xe('allies[0].name');
  if(online)xe(`(()=>{allies.forEach((a,i)=>{if(i){a.alive=false;a.hp=0;scene.remove(a.g)}});player.hp=0;xKLDie(bots[1].name,"Vandal");return 1})()`);
  else xe(`(()=>{allies.forEach((a,i)=>{if(i){a.hp=0;allyDie(a,bots[1].name,"Vandal")}});hurt(player,500,bots[1].name);pDie(bots[1].name,"Vandal");return 1})()`);
  const pin=()=>xe(`player.y=${FY};player.vy=0;1`);
  await adv(300);pin();if(!online)assert.ok(xe('running'),tag+': round goes on (spike planted, a teammate alive)');
  for(let t=0;t<2500;t+=250){await adv(250);pin();}
  let r=camCheck(tag+' teammate');out.push(JSON.stringify(r));
  assert.ok(r.who===last&&!r.enemy&&r.ok&&Math.abs(r.cy-(FY+1.6))<.05,tag+': the living teammate at eye height '+JSON.stringify(r));
  xe('xKL.si++');await adv(200);pin();await adv(50);r=camCheck(tag+' cycle');out.push(JSON.stringify(r));assert.ok(r.who===last&&!r.enemy,tag+': Space with one teammate stays on them (never an enemy) '+JSON.stringify(r));
  assert.equal(xe('typeof xTPToggle'),'undefined',tag+': no 3rd-person toggle');
  // a target below its floor (bad snapshot height): the floor face just above it lifts the camera to the floor + 1.2
  xe(`allies[0].sunkY=${FY-1.5}`);await adv(400);r=camCheck(tag+' sunk target',FY);out.push(JSON.stringify(r));assert.ok(r.cy>=FY+1.2-1e-6,tag+': guard keeps the camera over the floor '+JSON.stringify(r));
  xe('allies[0].sunkY=null');await adv(300);pin();await adv(100);
  const eye=JSON.parse(xe('JSON.stringify([camera.position.x,camera.position.y,camera.position.z,camera.rotation.y])'));
  // the last teammate dies: the camera holds that last view - no enemy, no orbit, no 3rd person
  if(online)xe('(()=>{const a=allies[0];a.alive=false;a.hp=0;scene.remove(a.g);return 1})()');else xe('(()=>{allyDie(allies[0],bots[1].name,"Vandal");return 1})()');
  for(let t=0;t<1200;t+=200){await adv(200);pin();}
  r=JSON.parse(xe(`JSON.stringify({cur:xKL.cur&&xKL.cur.name,sn:xKL.sn.textContent,hold:!!XOB.orb&&XOB.orb===XOB.hold,fp:!!XOB.fp,cam:[camera.position.x,camera.position.y,camera.position.z,camera.rotation.y],running})`));out.push(tag+' hold '+JSON.stringify(r));
  assert.ok(r.cur===null&&!r.fp&&r.sn==='NO TEAMMATES ALIVE',tag+': nobody followed '+JSON.stringify(r));
  if(r.running){assert.ok(r.hold,tag+': last view held '+JSON.stringify(r));assert.ok(Math.hypot(r.cam[0]-eye[0],r.cam[1]-eye[1],r.cam[2]-eye[2])<.3&&Math.abs(r.cam[3]-eye[3])<.3,tag+': camera stays where the teammate last looked from '+JSON.stringify([eye,r.cam]));}
  if(online){xe('MP.m5=false;FV.dm=false;dmSpawnP=__sp0[0];dmSpawnB=__sp0[1];1');break;}
  xe('allies.forEach(a=>{a.alive=true;a.hp=100;scene.add(a.g)});bots.forEach(b=>{b.alive=true;b.hp=100;scene.add(b.g)});player.hp=100;xKLReset();1');await adv(200);
 }
 const errs=H.errors.slice(errs0),xr=H.xErrCalls.slice(x0);if(process.env.VERBOSE)console.log(out.join('\n'));
 assert.equal(errs.length+xr.length,0,'page errors: '+JSON.stringify(errs.concat(xr).slice(0,3)));
 console.log('Spectate on a raised native floor (offline 5v5 after a plant + online 5v5 path): the last living teammate at eye height, never an enemy, floor guard for a sunk target, team wiped -> the last teammate view held');
 process.exit(0);
})().catch(e=>{console.log(out.join("\n"));try{console.log("page errors",JSON.stringify(H.errors.concat(H.xErrCalls).slice(0,4)).slice(0,1500));}catch(_){}console.error(e);process.exit(1);});
