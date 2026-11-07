// Native minimap dynamic layer: who is drawn and where. Legacy-parity markers restored on native maps:
// enemies spotted by any living teammate (not only the player), Sova Recon / Cypher / Fade reveals (J.rv),
// enemy-ping reveals, a fading last-seen "?" when an enemy drops out of sight, call-out rings, pings,
// orbs and the Spike on an allied carrier.
const fs=require('fs'),vm=require('vm'),assert=require('assert/strict'),s=fs.readFileSync('work/native_maps_runtime.js','utf8'),a=s.indexOf('function nmMapProjection('),b=s.indexOf('\n{const map=minimap',a);
let t=1000,arcs=[],texts=[],strokes=0,color,blocked=()=>false,path=[];/* arcs: every filled shape (unit arrows, Spike, orbs) at its first path point, with its fill colour */
const ctx={setTransform(){},transform(){},translate(){},rotate(){},scale(){},clearRect(){arcs=[];texts=[];strokes=0},fillRect(){},beginPath(){path=[]},closePath(){},arc(x,z,r){path.push({x,z,r})},moveTo(x,z){path.push({x,z})},lineTo(){},fill(){if(path.length)arcs.push({x:path[0].x,z:path[0].z,r:path[0].r,color})},fillText(tx,x,z){texts.push({tx,x,z,color,alpha:ctx.globalAlpha})},strokeText(){},stroke(){strokes++},save(){},restore(){},drawImage(){},globalAlpha:1,set fillStyle(v){color=v},get fillStyle(){return color},strokeStyle:'',lineWidth:1,font:'',textAlign:''};
const V=class{constructor(x,y,z){Object.assign(this,{x,y,z})}set(x,y,z){this.x=x;this.y=y;this.z=z;return this;}};/* set: nmSpot reuses its eye / target points (combat lane) */
const c={Math,performance:{now:()=>t+=200},running:true,player:{x:0,y:0,z:0,hp:100},mode:'five',FV:{atk:false,sp:{st:'drop',x:4,z:4,seen:false}},yaw:-Math.PI/2,/* looking toward +x, where the enemies stand (spotting needs them in view: test_minimap_cone) */XCALL:{},minimap:{},window:{devicePixelRatio:320/112}/* backing store 320 px for the 112 px box (nmMmSize) */,J:{rvT:0,rv:[]},mmVis:new Set(),mmPrev:new Set(),mmLost:new Map(),
 $(){return {classList:{toggle(){}}}},MM:{width:320,height:320,getBoundingClientRect:()=>({width:112})},mmx:ctx,allies:[],bots:[],los:(e,p)=>!blocked(e,p),pEye:()=>new V(c.player.x,1.5,c.player.z),THREE:{Vector3:V}};
vm.createContext(c);vm.runInContext(s.slice(a,b)+';globalThis.draw=nmMinimap;',c);
const C={bounds:{x1:-60,x2:60,z1:-60,z2:60},image:{complete:false},meta:{sites:{A:[59,0,0]}}};
const unit=(x,alive=true,z=0)=>({alive,g:{position:{x,y:0,z},rotation:{y:Math.PI/2}}});/* everyone faces +x */
const count=col=>arcs.filter(q=>q.color===col).length;
const ally=unit(5),deadAlly=unit(6,false);c.allies=[ally,deadAlly];
const near=unit(10),walled=unit(20),far=unit(110),dead=unit(11,false);c.bots=[near,walled,far,dead];
blocked=(e,p)=>p.x===20;
c.draw(C);
assert.equal(count('#5fe4df'),1,'living ally only');assert.equal(count('#ff4655'),1,'only the enemy in sight; walled, distant and dead hidden');assert.equal(count('#f5d742'),1,'you');assert.equal(count('#ece8e1'),0,'no hidden defender dropped-Spike leak');
{const A=texts.find(q=>q.tx==='A');assert.ok(A&&A.x<=320-8*320/112+1e-9,'site label kept inside the minimap edge');}
// Spotted by a teammate: the enemy behind the player's wall is in the ally's sight.
blocked=(e,p)=>p.x===20&&e.x===0;c.draw(C);assert.equal(count('#ff4655'),2,'enemy spotted by a teammate shows');
// It slips out of everyone's sight: a red last-seen "?" stays where it was seen, then fades out by 3 s.
blocked=(e,p)=>p.x===20;walled.g.position.x=21;blocked=(e,p)=>p.x===21;c.draw(C);
assert.equal(count('#ff4655'),1);let q=texts.find(x=>x.tx==='?');assert.ok(q,'last-seen marker');assert.equal(q.color,'#ff4655');assert.ok(Math.abs(q.x-(8+(20+60)*304/120))<1e-6,'marker at the last seen spot');
t+=3200;c.draw(C);assert.ok(!texts.some(x=>x.tx==='?'),'last-seen marker expires (3 s)');
// Dead enemies never leave last-seen markers.
blocked=()=>false;c.draw(C);dead.alive=false;walled.alive=false;c.draw(C);assert.ok(!texts.some(x=>x.tx==='?'),'killed enemy leaves no marker');walled.alive=true;walled.g.position.x=20;
// Recon Bolt / Cypher / Fade reveal through walls and beyond range while J.rvT runs.
blocked=(e,p)=>p.x===20;c.J.rvT=2;c.J.rv=[walled,far];c.draw(C);assert.equal(count('#ff4655'),3,'recon reveals through walls and range');
c.J.rvT=0;c.draw(C);assert.equal(count('#ff4655'),1);
// Enemy ping reveals its target for the ping window and draws a ping diamond.
c.window.xPG={s:[{on:true,x:30,z:30,a:1,en:true,b:far,rv:t+5000}]};const s0=strokes;c.draw(C);assert.equal(count('#ff4655'),2,'pinged enemy revealed');assert.ok(strokes>s0,'ping marker drawn');
c.window.xPG.s[0].rv=0;c.window.xPG.s[0].on=false;
// Online: enemies the server reports revealed by an ult (roundState rv -> netRvUntil) show while fresh.
far.netRvUntil=t+1000;c.draw(C);assert.equal(count('#ff4655'),2,'server ult reveal shown');t+=1200;c.draw(C);assert.equal(count('#ff4655'),1,'server reveal expires');
// Call-out rings fade over 4 s.
c.window.xCMk=[{on:true,x:0,z:10,t:t+200,en:false}];c.draw(C);assert.equal(c.window.xCMk[0].on,true);t+=4200;c.draw(C);assert.equal(c.window.xCMk[0].on,false,'call-out ring expires');
// Spike: attackers see the drop, seen/planted spikes show, an allied carrier carries a small marker, enemy carrier stays hidden.
c.FV.atk=true;c.draw(C);assert.equal(count('#ece8e1'),1);c.FV.atk=false;c.FV.sp.seen=true;c.draw(C);assert.equal(count('#ece8e1'),1);c.FV.sp.seen=false;c.FV.sp.st='plant';c.draw(C);assert.equal(count('#ece8e1'),1);
c.FV.sp.st='carry';c.FV.sp.c=near;c.draw(C);assert.equal(count('#ece8e1'),0,'enemy carrier hidden');c.FV.sp.c=ally;c.draw(C);assert.equal(count('#ece8e1'),1,'allied carrier shown');
// Spotting uses native floor height for the enemy chest (not a flat y=1.4).
const ys={};blocked=(e,p)=>{ys[p.x]=p.y;return false};near.g.position.y=6;c.J.rv=[];c.draw(C);assert.ok(Math.abs(ys[10]-7.4)<1e-9,'chest height follows the floor: '+ys[10]);
console.log('Native minimap dynamic tests: living allies, team-spotted enemies (teammate LOS, native heights), Recon/Cypher/Fade, ping and online server-ult reveals, fading last-seen markers (none for the dead), call-out ring expiry, ping icons, Spike drop/seen/plant/allied-carrier visibility without enemy leaks, safe label inset and mobile CSS sizing');
