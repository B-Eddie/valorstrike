// Phoenix Curveball flash (user: "the flash orb is too small", "the flash doesn't really work", bots must be affected too,
// and a curve-direction indicator). Valorant (valorant.fandom.com/wiki/Curveball, fetched 2026-10-27): max blind 1.5 s,
// windup 0.6 s, FIRE curves left / ALT FIRE right; Status Effect#Flash: a player looking at the pop is fully flashed for the
// duration, the flash then fades over 1 s; turned away = only slightly blinded for a very brief time.
// Server (devices.js DEV.curveball / abilities.js flash): within 30 m, line of sight, facing > 0.5 -> blindUntil + 1.5 s.
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict');
const root=path.join(__dirname,'..');const THREE=require(require.resolve('three',{paths:[path.join(root,'server')]}));
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const cut=(a,b,from)=>{const i=html.indexOf(a,from||0);assert(i>0,'missing '+a);const j=html.indexOf(b,i);assert(j>i,'missing end of '+a);return html.slice(i,j);};
const timers=[];let now=0;const el={style:{}};
const losCalls=[];
const ctx=vm.createContext({THREE,Math,console,ray:new THREE.Raycaster(),solids:[],scene:{add(){},remove(){}},J:{e:2,cd:{e:0},tk:0,orbs:[],fx:[]},player:{x:0,y:0,z:0,ch:0,hp:100},yaw:0,pitch:0,
 setTimeout:(f,ms)=>{timers.push({f,ms});return timers.length;},clearTimeout(){},performance:{now:()=>now},
 $:()=>el,SFX:{flash(){},ab(){}},blip(){},jRel(){},jFx:(m,t)=>({m,t}),bots:[],
 los:(a,b)=>{losCalls.push([a.clone(),b.clone()]);return a.y>ctx.floorY;},floorY:-1,
 jM:(geo,mat)=>{const m=new THREE.Mesh(geo,mat);return m;},jMat:(k,mk)=>mk(),xAdd:(k,c,o)=>new THREE.MeshBasicMaterial({color:c,transparent:true,opacity:o}),
 orbGeo:new THREE.SphereGeometry(0.25,12,8),smokeGeo:new THREE.SphereGeometry(4,8,6),PE_V:new THREE.Vector3()});
ctx.pEyeTo=(o)=>o.set(ctx.player.x,1.6+ctx.player.y,ctx.player.z);ctx.pEye=()=>ctx.pEyeTo(new THREE.Vector3());
ctx.jAim=()=>new THREE.Vector3(-Math.sin(ctx.yaw)*Math.cos(ctx.pitch),Math.sin(ctx.pitch),-Math.cos(ctx.yaw)*Math.cos(ctx.pitch));
const src=cut('const XAB_WIND =','const ABI_M =').replace(/^const /gm,'var ')+'\n'+cut('const XLEER = 1.6;','\n// Sova bolt flight on the client')+'\n'+cut('function phCurve(','\n  if (code === "KeyQ")')+'\n}\n'+cut('function enPop(','\nfunction enRecon(')
 +'\nfunction orbTick(dt){'+cut('{ const A = J.orbs, n = A.length;','\n  if (J.dr) drTick(dt);')+'}';
vm.runInContext(src.replace(/^(const|let) /gm,'var '),ctx);
const X=ctx.XCBF;assert.ok(X,'XCBF (Curveball flash table) missing');
assert.equal(X.blind,1.5,'wiki Curveball max blind 1.5 s');assert.equal(X.fade,1,'Status Effect#Flash: fades over 1 s');assert.equal(X.face,0.5,'facing threshold = server abilities.js facing > .5');assert.equal(X.r,30,'radius = server DEV.curveball.radius');
// --- bots: eye at the bot's own floor height (native maps have floors above y = 0), facing like the server
const bot=(x,y,z,ry)=>({alive:true,blind:0,g:{position:new THREE.Vector3(x,y,z),rotation:{y:ry}}});
const pop=new THREE.Vector3(0,5.6,-10);ctx.floorY=4; // an upper floor at y = 4: an eye at 1.6 m is inside / below it
const up=bot(0,4,0,Math.PI);ctx.bots=[up];ctx.player.hp=0;ctx.jPop(pop);
assert.ok(losCalls.length&&Math.abs(losCalls[0][0].y-5.6)<1e-6,'bot eye = floor + 1.6 m, not a flat 1.6 m: '+(losCalls[0]&&losCalls[0][0].y));
assert.equal(up.blind,1.5,'a bot on an upper floor looking at the pop is blinded 1.5 s');
ctx.floorY=-1;const P0=new THREE.Vector3(0,1.6,-10);
const at=(deg)=>{const b=bot(0,0,0,Math.PI+deg*Math.PI/180);ctx.bots=[b];ctx.jPop(P0);return b.blind;};
assert.equal(at(0),1.5,'looking straight at it: full 1.5 s');assert.equal(at(45),1.5,'45 deg off: still full');
assert.equal(at(70),0,'70 deg off (facing 0.34 < 0.5, the server threshold): not blinded');assert.equal(at(180),0,'back turned: not blinded');
{const b=bot(0,0,-45,0);ctx.bots=[b];ctx.jPop(P0);assert.equal(b.blind,0,'beyond 30 m: not blinded');}
// --- the player: looking at it -> fully white for 1.5 s, then a 1 s fade; turned away -> faint and brief
ctx.bots=[];ctx.player.hp=100;ctx.yaw=0;timers.length=0;el.style={};ctx.jPop(P0);
assert.equal(+el.style.opacity,1,'looking at the pop: full white');const t1=timers.find(t=>t.ms>=1000);assert.ok(t1&&t1.ms===1500,'held for the full 1.5 s: '+JSON.stringify(timers.map(t=>t.ms)));
t1.f();assert.match(el.style.transition,/opacity 1s/,'then fades over 1 s');assert.equal(+el.style.opacity,0);
ctx.yaw=Math.PI;timers.length=0;el.style={};now=10000;ctx.jPop(P0);
assert.ok(+el.style.opacity>0&&+el.style.opacity<=0.4,'back turned: only a faint flash ('+el.style.opacity+')');assert.ok(timers.every(t=>t.ms<=150),'and a very brief one');
// a faint flash never cuts a full one short
ctx.yaw=0;timers.length=0;now=20000;ctx.jPop(P0);ctx.yaw=Math.PI;now=20300;ctx.jPop(P0);assert.equal(+el.style.opacity,1,'a faint flash does not dim a running full flash');
// --- enemy Curveball (bot Phoenix): the player gets the same 1.5 s full flash
ctx.yaw=0;timers.length=0;el.style={};now=30000;ctx.enPop(P0,1.5);assert.equal(+el.style.opacity,1);assert.ok(timers.some(t=>t.ms===1500),'enemy Curveball: 1.5 s full flash');
// --- the orb: a large glowing ball, not a 0.25 m bead
ctx.J.orbs.length=0;ctx.yaw=0;ctx.phKey('KeyE');const o=ctx.J.orbs[0];assert.ok(o,'cast');
const rad=(m)=>{m.updateMatrixWorld(true);const b=new THREE.Box3().setFromObject(m);return (b.max.x-b.min.x)/2;};
const core=o.m;core.geometry.computeBoundingSphere();const cr=core.geometry.boundingSphere.radius*core.scale.x;
assert.ok(cr>=0.28,'core radius >= 0.28 m (was 0.25 m with no glow): '+cr.toFixed(2));
const kids=core.children.filter(k=>k.isMesh&&k.material&&k.material.blending===THREE.AdditiveBlending);assert.ok(kids.length>=2,'additive glow shells');
assert.ok(rad(core)>=1,'glow reaches >= 1 m: '+rad(core).toFixed(2));assert.ok(core.userData.kids&&core.userData.kids.length===kids.length,'glow released with the orb (userData.kids)');
// it pops through the shared tick and blinds a facing bot
{const b=bot(-2.5,0,-1,Math.PI);ctx.bots=[b];ctx.player.hp=0;ctx.orbTick(1);assert.equal(ctx.J.orbs.length,0);assert.equal(b.blind,1.5,'the cast Curveball blinds a bot looking at the pop');}
console.log('Curveball flash: bots (floor-height eye, facing > 0.5, 30 m) and the player 1.5 s full + 1 s fade, faint when turned away, enemy Curveball 1.5 s, big glowing orb');
// --- curve hint (ability_equip_runtime.js): while Curveball is in hand, two arcs = the cast's own path, FIRE left / ALT FIRE right
{const hs=cut('var XCBH =','\ntry { const st = document.createElement("style"); st.textContent = "#xCbH');
 const hel={classList:{s:new Set(),contains(k){return this.s.has(k);},toggle(k,v){v?this.s.add(k):this.s.delete(k);}}};
 const added=[];Object.assign(ctx,{running:true,J:Object.assign(ctx.J,{pick:'Phoenix',eq:null}),$:id=>id==='xCbH'?hel:el,scene:{add:g=>{added.push(g);g.parent=ctx.scene;},remove:g=>{g.parent=null;}}});ctx.player.hp=100;ctx.yaw=0;
 vm.runInContext(hs.replace(/^var /gm,'var '),ctx);
 const o=new THREE.Vector3(0,1.6,0),L=ctx.xCbHintPts(o,0,-1,-1,10),R=ctx.xCbHintPts(o,0,-1,1,10),c=ctx.phCurve(o,0,-1,-1);
 assert.ok(L[9].distanceTo(c.end)<1e-6,'left arc ends at the FIRE pop point');assert.ok(Math.abs(L[9].x+2.5)<1e-6&&Math.abs(R[9].x-2.5)<1e-6,'FIRE arc ends 2.5 m left, ALT FIRE arc 2.5 m right');
 assert.ok(L.slice(1).every((p,i)=>p.x<=L[i].x+1e-9),'left arc bends steadily left');
 ctx.xCbHintTick();assert.equal(!!(ctx.XCBH.g&&ctx.XCBH.g.visible),false,'hidden with no ability out');assert.equal(hel.classList.contains('on'),false);
 ctx.J.eq={k:'e',st:'ready'};ctx.xCbHintTick();assert.equal(ctx.XCBH.g.visible,true,'shown with Curveball in hand');assert.equal(hel.classList.contains('on'),true,'HUD tag on');
 assert.equal(ctx.XCBH.d[0].length,10);assert.ok(ctx.XCBH.d[0][9].position.x<-2&&ctx.XCBH.d[1][9].position.x>2,'world dots: left arc left, right arc right');
 {const g0=ctx.XCBH.g;g0.parent=null;ctx.xCbHintTick();assert.equal(ctx.XCBH.g,g0,'same hint group after a scene clear (no new geometry per match)');assert.equal(added.filter(x=>x===g0).length,2,'re-added to the scene');}
 ctx.J.eq.st='rel';ctx.xCbHintTick();assert.equal(ctx.XCBH.g.visible,false,'gone once thrown');assert.equal(ctx.XCBH.g.parent,null,'out of the scene once hidden (a round reset leaves nothing behind: test_client_abilities)');assert.equal(hel.classList.contains('on'),false);
 ctx.J.eq={k:'c',st:'ready'};ctx.xCbHintTick();assert.equal(ctx.XCBH.g.visible,false,'not for Blaze');ctx.J.pick='Skye';ctx.J.eq={k:'e',st:'ready'};ctx.xCbHintTick();assert.equal(ctx.XCBH.g.visible,false,'Phoenix only');
 assert.match(html,/id = "xCbH"; d\.innerHTML = "<span>\\u25C0 L-CLICK<\/span><span>R-CLICK \\u25B6<\/span>"/,'HUD tag text');
 assert.match(html,/try \{ xCbHintTick\(\); \}/,'ticked from jTick');}
// --- online flash screen: fully white while the server says blinded, 1 s fade after (was opacity = blind / 1.5)
{const f=cut('function netBlindCss(','\n');const c2=vm.createContext({});vm.runInContext(f,c2);const e={style:{}};
 assert.equal(c2.netBlindCss(e,0.2),true);assert.match(e.style.cssText,/opacity:1;transition:none/,'0.2 s left of a 1.5 s flash: still fully white');
 c2.netBlindCss(e,0);assert.match(e.style.cssText,/opacity:0;transition:opacity 1s/,'then a 1 s fade');assert.match(html,/netBlindCss\(el,st\.blind\);/,'status handler uses it');}
console.log('Curveball hint: FIRE-left / ALT FIRE-right arcs on the cast path while in hand, HUD tag; online flash screen full + 1 s fade');
