// Native minimap view cone and FOV-gated team spotting (Valorant-style):
//  1. the local player's view cone is drawn as a wedge from the player dot, centred on the current yaw, spanning the
//     current horizontal FOV (hip 103 deg at 16:9, narrower when scoped), and only while the player is alive;
//  2. an enemy shows as a red marker only while the player or a living teammate actually sees it: clear line of sight
//     AND inside that viewer's view cone (player: current camera FOV around yaw; teammate: the 103 deg bot view cone
//     around g.rotation.y). No omniscience: an enemy in the open behind everyone is not drawn;
//  3. when it drops out of every ally's sight, a red last-seen "?" stays where it was last seen and fades out over 3 s.
const fs=require('fs'),vm=require('vm'),assert=require('assert/strict'),s=fs.readFileSync('work/native_maps_runtime.js','utf8'),a=s.indexOf('function nmMapProjection('),b=s.indexOf('\n{const map=minimap',a);
assert.ok(a>0&&b>a,'minimap block found');
let t=1000,arcs=[],texts=[],paths=[],color,blocked=()=>false;
const ctx={setTransform(){},transform(){},translate(){},rotate(){},scale(){},strokeText(){},clearRect(){arcs=[];texts=[];paths=[]},fillRect(){},beginPath(){paths.push({arcs:[],lines:[]})},closePath(){},
 arc(x,z,r,a0,a1){const q={x,z,r,a0,a1};arcs.push(q);paths.at(-1)&&paths.at(-1).arcs.push(q)},fill(){const p=paths.at(-1);if(p)p.fill=color;if(arcs.length&&!arcs.at(-1).color)arcs.at(-1).color=color},
 fillText(tx,x,z){texts.push({tx,x,z,color,alpha:ctx.globalAlpha})},moveTo(x,z){paths.at(-1)&&paths.at(-1).lines.push([x,z])},lineTo(x,z){paths.at(-1)&&paths.at(-1).lines.push([x,z])},stroke(){},save(){},restore(){},drawImage(){},
 globalAlpha:1,set fillStyle(v){color=v},get fillStyle(){return color},strokeStyle:'',lineWidth:1,font:'',textAlign:''};
const V=class{constructor(x,y,z){Object.assign(this,{x,y,z})}set(x,y,z){this.x=x;this.y=y;this.z=z;return this;}};/* set: nmSpot reuses its eye / target points (combat lane) */
const c={Math,performance:{now:()=>t+=200},running:true,player:{x:0,y:0,z:0,hp:100},mode:'five',FV:{atk:false,sp:{st:'carry'}},yaw:0,XCALL:{},minimap:{},window:{devicePixelRatio:320/112}/* backing store 320 px for the 112 px box (nmMmSize) */,J:{rvT:0,rv:[]},mmVis:new Set(),mmPrev:new Set(),mmLost:new Map(),
 camera:{fov:70.53,aspect:16/9},$(){return {classList:{toggle(){}}}},MM:{width:320,height:320,getBoundingClientRect:()=>({width:112})},mmx:ctx,allies:[],bots:[],los:(e,p)=>!blocked(e,p),pEye:()=>new V(c.player.x,1.5,c.player.z),THREE:{Vector3:V}};
vm.createContext(c);vm.runInContext(s.slice(a,b)+';globalThis.draw=nmMinimap;globalThis.spot=nmSpot;globalThis.half=typeof nmViewHalf==="function"?nmViewHalf:null;',c);
const C={bounds:{x1:-60,x2:60,z1:-60,z2:60},image:{complete:false},meta:{sites:{}}};
const unit=(x,z,ry,alive=true)=>({alive,g:{position:{x,y:0,z},rotation:{y:ry}}});
const reds=()=>paths.filter(p=>p.fill==='#ff4655').length;/* unit markers are filled arrow paths */
const deg=r=>r*180/Math.PI,wrap=r=>Math.atan2(Math.sin(r),Math.cos(r));
// --- 1. view cone wedge ---
assert.equal(typeof c.half,'function','nmViewHalf exported by the minimap block');
assert.ok(Math.abs(deg(2*c.half())-103)<0.2,'hip 16:9 horizontal FOV = 103 deg ('+deg(2*c.half()).toFixed(2)+')');
c.camera.fov=2*Math.atan(Math.tan(70.53*Math.PI/360)/2.5)*180/Math.PI;const scoped=deg(2*c.half());c.camera.fov=70.53;
assert.ok(scoped<56&&scoped>50,'scoped (2.5x) wedge narrows to ~53 deg ('+scoped.toFixed(1)+')');
const wedge=()=>paths.find(p=>p.fill&&/^rgba\(255, ?255, ?255/.test(p.fill)&&p.arcs.length===1&&p.arcs[0].a1-p.arcs[0].a0<Math.PI*1.5);
for(const y of [0,Math.PI/2,-Math.PI/2,2.4,-3]){c.yaw=y;c.draw(C);const w=wedge();assert.ok(w,'view cone wedge drawn at yaw '+y);const q=w.arcs[0];
 assert.ok(Math.abs(q.x-160)<1e-6&&Math.abs(q.z-160)<1e-6,'wedge apex on the player dot');
 assert.ok(Math.abs((q.a1-q.a0)-2*c.half())<1e-6,'wedge spans the current horizontal FOV');
 const mid=(q.a0+q.a1)/2,fx=-Math.sin(y),fz=-Math.cos(y);assert.ok(Math.abs(wrap(mid-Math.atan2(fz,fx)))<1e-6,'wedge centred on the look direction at yaw '+y);
 assert.ok(q.r>20&&q.r<80,'wedge radius readable on a 320 px map ('+q.r.toFixed(1)+' px)');}
c.player.hp=0;c.draw(C);assert.ok(!wedge(),'no view cone while dead');c.player.hp=100;
// --- 2. FOV-gated spotting ---
c.yaw=-Math.PI/2; // player looks toward +x
const front=unit(20,0,0),behind=unit(-20,0,0),side=unit(0,20,0),edge=unit(20,20*Math.tan(50*Math.PI/180),0),past=unit(20,20*Math.tan(56*Math.PI/180),0);
c.bots=[front,behind,side,edge,past];c.allies=[];
let v=c.spot(t+=1000);
assert.ok(v.has(front),'enemy in front, clear LOS: seen');assert.ok(!v.has(behind),'enemy behind the player in the open: NOT seen (no omniscience)');
assert.ok(!v.has(side),'enemy 90 deg to the side: not seen');assert.ok(v.has(edge),'enemy at 50 deg (inside 51.5 deg half FOV) seen');assert.ok(!v.has(past),'enemy at 56 deg: not seen');
// scoping narrows what the player sees
c.camera.fov=2*Math.atan(Math.tan(70.53*Math.PI/360)/2.5)*180/Math.PI;v=c.spot(t+=1000);assert.ok(v.has(front)&&!v.has(edge),'scoped: 50 deg off-axis enemy leaves the view');c.camera.fov=70.53;
// a teammate behind the player looking back spots the enemy behind; one looking away does not
const mateBack=unit(-5,0,-Math.PI/2),mateAway=unit(-5,0,Math.PI/2);
c.bots=[behind];c.allies=[mateAway];v=c.spot(t+=1000);assert.ok(!v.has(behind),'teammate looking away does not spot');
c.allies=[mateBack];v=c.spot(t+=1000);assert.ok(v.has(behind),'teammate facing the enemy spots it');
mateBack.alive=false;v=c.spot(t+=1000);assert.ok(!v.has(behind),'dead teammate spots nothing');mateBack.alive=true;
// in a teammate's cone but behind a wall: not spotted
blocked=(e,p)=>p.x===-20;v=c.spot(t+=1000);assert.ok(!v.has(behind),'teammate cone but no LOS: not spotted');blocked=()=>false;
// --- 3. markers + fading last-seen ---
c.bots=[front];c.allies=[];c.mmPrev=new Set();c.mmLost.clear();c.draw(C);assert.equal(reds(),1,'seen enemy drawn as a red marker');
c.yaw=Math.PI/2; // turn away: line of sight kept, but out of the view cone
c.draw(C);assert.equal(reds(),0,'turned away: marker gone');let q=texts.find(x=>x.tx==='?');assert.ok(q,'last-seen "?" left');assert.equal(q.color,'#ff4655');
assert.ok(Math.abs(q.x-(8+(20+60)*304/120))<1e-6,'last-seen marker at the spot it was last seen');
t+=1200;c.draw(C);q=texts.find(x=>x.tx==='?');assert.ok(q&&q.alpha<1&&q.alpha>0.2,'last-seen still fading after ~1.4 s (alpha '+(q&&q.alpha)+')');
t+=1800;c.draw(C);assert.ok(!texts.some(x=>x.tx==='?'),'last-seen marker gone after 3 s');
console.log('Minimap view cone: wedge = current yaw and horizontal FOV (103 deg hip, narrower scoped, hidden when dead); enemies only when an ally has LOS AND has them in view (player camera FOV, teammates 103 deg cone), none behind / beside / walled / for dead mates; red marker, last-seen "?" fades over 3 s');
