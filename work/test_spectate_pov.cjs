// Spectate POV (work/spectate_runtime.js, as installed in index.html): after death the page draws the followed TEAMMATE's own
// first-person view, as VALORANT (user 2026-10-26: no 3rd person when spectating; only a living teammate's POV - their
// gun with their skin, their ADS / scope, their flashes). The installed block runs in a sandbox with the page functions it
// wraps stubbed, and checks:
//  - only a living teammate followed while dead (xKL.sp, XOB.fp) gets a rig; an enemy / the player alive / the killed-by
//    card get none; the rig is the teammate's agent + weapon with THEIR skin (XSK.net[nid]); the player's own xskGet is
//    untouched outside the load;
//  - equip on a new target, fire on a shot at the teammate's spot (bfxBot), none for a shot elsewhere, reload from the
//    server's pov clock (online) and from the mag running dry (offline), idle after;
//  - ADS: a rifle zooms the camera to its ADS zoom, a sniper shows the scope and hides the viewmodel; hip / leaving restore;
//  - blind: a white overlay for the teammate's flash (server pov / offline b.blind), cleared after;
//  - the player's own rig warm-up can not dispose the rig on screen (xvFPClear guard), and it is disposed once dropped.
const fs=require('fs'),vm=require('vm'),assert=require('assert/strict'),s=fs.readFileSync(__dirname+'/../index.html','utf8');
const a0=s.indexOf('// ---- SPECTATE POV ----'),b0=s.indexOf('// ---- END SPECTATE POV ----');assert(a0>0&&b0>a0,'spectate POV block installed');
const plays=[],loads=[],cleared=[];let now=0;
class El{constructor(){this.style={cssText:'',opacity:''};}}
const els={scope:new El(),cross:new El()};const appended=[];
const mkF=(ag,w,sk)=>({ag,w,sk,root:{visible:false,parent:null,scale:{set(x,y,z){this.v=[x,y,z];}},position:{set(){},y:0}},origin:{x:.1,y:-.1,z:0},am:{update(){}},gm:{update(){}},kind:null,age:0,action:{getClip:()=>({duration:.3})}});
const c={console,Math,JSON,Promise,Number,String,Array,Object,isFinite,
 performance:{now:()=>now},document:{createElement:()=>new El(),body:{appendChild:e=>appended.push(e)}},window:{},
 THREE:{MathUtils:{degToRad:d=>d*Math.PI/180}},
 running:true,player:{hp:0},xKL:{sp:true},XOB:{fp:null},allies:[],bots:[],MP:{on:false,me:0},
 WEAP:{Vandal:{rld:2.5,mag:25},Operator:{rld:3.7,mag:5},Classic:{rld:1.75,mag:12},Phantom:{rld:2.5,mag:30}},XSZ:{Operator:[2.5,5]},XZ:{Vandal:1.25},xSC:{z:1},xSCf:z=>2*Math.atan(Math.tan(37.5*Math.PI/180)/z)*180/Math.PI,
 hudS:(el,k,v)=>{el.style[k]=v;},$:id=>els[id]||new El(),setT(){},
 camera:{fov:75,add(o){o.parent=c.camera;},updateProjectionMatrix(){}},
 XV:{fp:null,failures:{}},XSK:{net:{}},XS_EQ:{Vandal:'own-skin'},
 xAg:u=>u.agent,xWeapOf:u=>u.w,
 xskValidFor:(w,id)=>typeof id==='string'&&id!=='bad',
 xvFPKey(ag,w){const k=c.xskGet(w);return ag+'|'+w+(k==='standard'?'':'|'+k);},
 xvFPGet(ag,w){const F=mkF(ag,w,c.xskGet(w));loads.push(ag+'|'+w+'|'+F.sk);return {then(f){f(F);return {catch(){}};}};},
 xvFPPlay(F,k,t){if(F.kind!==k){F.kind=k;F.age=0;}plays.push(k+(t!=null?'@'+t.toFixed(2):''));},
 xvFPClear(F){cleared.push(F.ag+'|'+F.w);},
 bfxBot(){},mpCliRS(){},mpCliSnap(){},vmTick(){},xHud(){}};
c.xskGet=w=>c.XS_EQ[w]||'standard';c.window=c;vm.createContext(c);
vm.runInContext(s.slice(a0,b0+29),c);
const tick=(dt=.05)=>{now+=dt*1000;c.vmTick(dt);};
const mate={name:'Sage',agent:'Sage',alive:true,w:'Vandal',nid:7,g:{position:{x:5,y:0,z:5}}},foe={name:'Raze',agent:'Raze',alive:true,w:'Operator',nid:9,g:{position:{x:-5,y:0,z:-5}}};
c.allies.push(mate);c.bots.push(foe);
// nothing while alive, during the card, or on an enemy
c.player.hp=100;c.XOB.fp=mate;tick();assert.equal(loads.length,0,'alive: no rig');c.player.hp=0;
c.xKL.sp=false;tick();assert.equal(loads.length,0,'killed-by card: no rig');c.xKL.sp=true;
c.XOB.fp=foe;tick();assert.equal(loads.length,0,'an enemy is never drawn from the inside');
// the teammate: their agent, weapon and skin
c.XSK.net[7]={Vandal:'mate-skin'};c.XOB.fp=mate;tick();
assert.deepEqual(loads,['Sage|Vandal|mate-skin'],'teammate rig with their own skin');assert.equal(c.xskGet('Vandal'),'own-skin','own skin lookup untouched');
const F=c.xSpectatePov.F;assert.ok(F&&F.root.visible&&F.root.parent===c.camera,'rig on the camera, shown');assert.equal(plays[0],'equip');
for(let i=0;i<10;i++)tick();assert.equal(F.kind,'idle','idle after the equip');
// fire: a shot at the teammate's spot, not one elsewhere
c.bfxBot({x:-5,z:-5});tick();assert.equal(F.kind,'idle','enemy shot: nothing');c.bfxBot({x:5.2,z:5});tick();assert.equal(plays[plays.length-1],'fire','teammate shot: fire');
// offline reload: the mag running dry
mate.xAm={w:'Vandal',mag:1,res:50,rl:0,rd:0};tick();mate.xAm.mag=0;tick();assert.match(plays[plays.length-1],/^reload@/,'mag dry: reload');
for(let i=0;i<60;i++)tick();assert.equal(F.kind,'idle','reload ends');
// offline reload on BOT AMMO's own clock (b.xAm: its magazine state object): the clip follows the reload's progress, ends with it
mate.xAm={w:'Vandal',mag:10,res:50,rl:2.5,rd:2.5};tick();assert.match(plays[plays.length-1],/^reload@0\.0/,'BOT AMMO reload: reload clip from its start '+plays[plays.length-1]);mate.xAm.rl=1.25;tick();assert.match(plays[plays.length-1],/^reload@0\.5/,'half way '+plays[plays.length-1]);mate.xAm.rl=0;mate.xAm.mag=25;for(let i=0;i<3;i++)tick();assert.equal(F.kind,'idle','BOT AMMO reload done: idle');
// offline flash: b.blind -> white overlay
mate.blind=1.5;tick();const bl=c.xSpectatePov.bl;assert.ok(bl&&+bl.style.opacity>0.9,'blinded teammate: white screen');mate.blind=0;tick();assert.equal(bl.style.opacity,'0');
// online: server pov (ADS / blind / reload), ammo from rows
c.MP.on=true;c.mpCliRS({pov:{7:[1,0,0]}});tick();assert.ok(Math.abs(c.camera.fov-c.xSCf(1.25))<1e-6,'rifle ADS: the Vandal zoom ('+c.camera.fov+')');assert.notEqual(els.scope.style.display,'block');
c.mpCliRS({pov:{7:[0,0,1.2]}});tick();assert.match(plays[plays.length-1],/^reload@/,'server reload clock');assert.ok(Math.abs(c.camera.fov-c.xSCf(1))<1e-6,'hip again');
c.mpCliRS({pov:{7:[0,0.75,0]}});tick();assert.ok(Math.abs(+bl.style.opacity-0.5)<0.05,'server blind '+bl.style.opacity);c.mpCliRS({pov:{7:[0,0,0]}});tick();assert.equal(bl.style.opacity,'0');
// a weapon swap: new rig + equip; a sniper's scope hides the viewmodel
mate.w='Operator';c.XSK.net[7]={};tick();assert.equal(loads[loads.length-1],'Sage|Operator|standard');const G=c.xSpectatePov.F;assert.notEqual(G,F);assert.equal(F.root.visible,false,'old rig hidden');
c.mpCliRS({pov:{7:[1,0,0]}});tick();assert.equal(els.scope.style.display,'block','sniper ADS: scope');assert.equal(els.cross.style.display,'none');assert.equal(G.root.visible,false,'viewmodel hidden behind the scope');
assert.ok(Math.abs(c.camera.fov-c.xSCf(2.5))<1e-6,'Operator first zoom');
// the player's own warm-up evicting the shown rig: not disposed while shown, disposed once dropped
c.xvFPClear(G);assert.deepEqual(cleared,[],'shown rig never disposed');
// respawn: everything restored
c.player.hp=100;tick();assert.equal(c.xSpectatePov.F,null);assert.equal(G.root.visible,false);assert.deepEqual(cleared,['Sage|Operator'],'evicted rig disposed after the drop');
assert.equal(els.scope.style.display,'none','scope off');assert.equal(els.cross.style.display,'');assert.ok(Math.abs(c.camera.fov-c.xSCf(1))<1e-6,'own lens back');
console.log('Spectate POV: teammate-only first-person rig with their skin, equip / fire / reload (offline mag + server clock) / idle, rifle ADS zoom, sniper scope hides the viewmodel, flash overlay, eviction guard, restored on respawn');
