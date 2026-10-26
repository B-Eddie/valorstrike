// Client side of the game rules fixed against current sources (fog-spec-3; server twin: server/test-game-rules.js; table:
// work/validation/values-game.md):
//  - Deathmatch health packs (wiki.playvalorant.com/en-us/Deathmatch: a kill drops health kits on the victim's body;
//    valorant.gs/rules DeathmatchGameMode Health Pack: Lifespan 8, Health 50, Armor 25, Sphere Radius 50 uu) - offline drop /
//    pickup / expiry in work/game_rules_runtime.js (installed as the GAME RULES block), online drawing of the server's hpk rows;
//    the killer is no longer healed to 100 / 50 in Deathmatch (TDM keeps it).
//  - Defuse cancel window 0.2 s (valorant.gs/rules Spike) in the offline 5v5, Retake and the range Spike drill.
//  - Operator second zoom: the online input carries az, the spectate POV zooms to the Operator's 5x on pov ADS 2.
const J=(x)=>JSON.parse(JSON.stringify(x));const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.join(__dirname,'..'),h=fs.readFileSync(path.join(root,'index.html'),'utf8'),rt=fs.readFileSync(path.join(__dirname,'game_rules_runtime.js'),'utf8');
// installed verbatim
{const a=h.indexOf('// ---- GAME RULES ----'),b=h.indexOf('// ---- END GAME RULES ----');assert(a>0&&b>a,'GAME RULES block installed');assert.equal(h.slice(a,b+'// ---- END GAME RULES ----'.length),rt.trimEnd(),'block = work/game_rules_runtime.js');
 assert(a<h.indexOf('xReady = true; // every mode is initialised'),'installed before xReady');assert(a>h.indexOf('function dmScore(')&&a>h.indexOf('function mpCliSnap('),'wraps the base functions');}
// ---- offline Deathmatch packs
function page(over){const added=[],removed=[];class O{constructor(){this.position={x:0,y:0,z:0,set(x,y,z){this.x=x;this.y=y;this.z=z;}};this.rotation={y:0};this.children=[];this.parent=null;}add(c){c.parent=this;this.children.push(c);}remove(c){c.parent=null;}}
 const scene=new O();scene.add=function(c){c.parent=scene;added.push(c);};scene.remove=function(c){c.parent=null;removed.push(c);};
 const C={THREE:{Group:O,Mesh:class extends O{},BoxGeometry:class{},MeshBasicMaterial:class{}},scene,FV:{dm:true,tdm:false},player:{x:0,y:0,z:0,hp:100,armor:50},bots:[],running:true,window:{},performance:{now:()=>C.t},t:0,updHud(){},blip(){},Math,Number,Set,Array,
  scored:[],ticks:0,dmScore(by,v){C.scored.push([by,v]);},dmTick(dt){C.ticks++;},dmGo(){return 'go';},mpCliSnap(m){return 'snap';},...over};
 vm.createContext(C);vm.runInContext(rt,C);C.added=added;return C;}
{const P=page();const b1={name:'Bot Sage',alive:true,hp:100,armor:50,g:{position:{x:10,y:0,z:5}}},b2={name:'Bot Omen',alive:true,hp:40,armor:0,g:{position:{x:-10,y:0,z:0}}};P.bots.push(b1,b2);
 const D=P.window.xDmPacks;assert.deepEqual(J([D.life,D.hp,D.armor,D.cap,D.armorCap]),[8,50,25,100,50]);assert.equal(D.r,0.85,'0.5 m sphere + 0.35 m capsule');
 b1.alive=false;P.dmScore('You','Bot Sage');assert.deepEqual(P.scored,[['You','Bot Sage']],'base dmScore still runs');assert.equal(D.L.length,1,'a kill drops one pack');assert.deepEqual([D.L[0].x,D.L[0].z],[10,5],'on the victim');assert.equal(P.added.length,1,'pack mesh in the scene');
 P.player.hp=100;P.player.armor=50;P.player.x=10;P.player.z=5;P.dmTick(0.05);assert.equal(D.L.length,1,'a full-health player leaves it');
 P.player.hp=20;P.player.armor=0;P.player.x=10.6;P.dmTick(0.05);assert.equal(D.L.length,0,'picked up within 0.85 m');assert.deepEqual([P.player.hp,P.player.armor],[70,25]);assert.equal(P.added[0].parent,null,'mesh removed');
 P.player.x=0;P.player.z=0;P.player.hp=0;P.dmScore('Bot Omen','You');assert.equal(D.L.length,1,'the player dropping one on death');assert.deepEqual([D.L[0].x,D.L[0].z],[0,0]);
 b2.g.position.x=0.3;P.dmTick(0.05);assert.equal(D.L.length,0,'a hurt bot picks it up');assert.deepEqual([b2.hp,b2.armor],[90,25]);
 P.dmScore('You','Bot Omen');b2.g.position.x=-50;P.player.x=50;for(let i=0;i<158;i++)P.dmTick(0.05);assert.equal(D.L.length,1,'there before 8 s');for(let i=0;i<4;i++)P.dmTick(0.05);assert.equal(D.L.length,0,'gone after 8 s');
 P.dmScore('You','Bot Omen');P.dmGo();assert.equal(D.L.length,0,'a new match clears the packs');
 P.FV.tdm=true;P.dmScore('You','Bot Omen');assert.equal(D.L.length,0,'no packs in Team Deathmatch');}
// ---- offline Escalation packs (wiki Escalation: 10 s, full health / shields / ammo; = server ESC_PACK): allies drop / pick up too
{const sl={pri:{ammo:3,rsv:10},pis:{ammo:12,rsv:36}};const P=page({FV:{dm:true,tdm:true,esc:true,pri:'Vandal',sec:'Classic'},allies:[],slots:sl,rw:'pri',ammo:3,rsv:10,reloading:1,WEAP:{Vandal:{mag:25},Classic:{mag:12}},xRsv:(w)=>({Vandal:75,Classic:36})[w]});
 const E=P.window.xEscPacks,D=P.window.xDmPacks;assert.deepEqual(J([E.life,E.hp,E.armor,E.ammo]),[10,100,50,true]);
 const en={name:'Bot Sage',alive:true,hp:100,armor:50,g:{position:{x:10,y:0,z:5}}},al={name:'Ally Sova',alive:true,hp:100,armor:50,g:{position:{x:-20,y:0,z:0}}};P.bots.push(en);P.allies.push(al);
 en.alive=false;P.dmScore('You','Bot Sage');assert.equal(D.L.length,1,'Escalation: a kill drops a pack');assert.equal(D.L[0].t,10,'lasts 10 s');
 P.player.x=10;P.player.z=5;P.player.hp=100;P.player.armor=50;P.dmTick(0.05);assert.equal(D.L.length,0,'full health but a gun not full: taken');
 assert.deepEqual(J([P.slots.pri,P.slots.pis,P.ammo,P.rsv,P.reloading]),[{ammo:25,rsv:75},{ammo:12,rsv:36},25,75,0],'magazine + reserve refilled (both guns), reload cancelled');
 P.dmScore('Bot Omen','You');assert.equal(D.L.length,1);P.dmTick(0.05);assert.equal(D.L.length,1,'full health, full ammo: the pack stays');
 P.player.hp=5;P.player.armor=0;P.dmTick(0.05);assert.equal(D.L.length,0);assert.deepEqual([P.player.hp,P.player.armor],[100,50],'full restore: 100 HP / 50 armour');
 al.hp=0;al.alive=false;P.dmScore('Bot Sage','Ally Sova');assert.equal(D.L.length,1,'an ally death drops one');assert.deepEqual([D.L[0].x,D.L[0].z],[-20,0]);al.alive=true;al.hp=30;al.armor=0;P.player.x=50;P.dmTick(0.05);assert.equal(D.L.length,0,'an ally picks it up');assert.deepEqual([al.hp,al.armor],[100,50]);
 P.dmScore('You','Bot Sage');for(let i=0;i<198;i++)P.dmTick(0.05);assert.equal(D.L.length,1,'there before 10 s');for(let i=0;i<4;i++)P.dmTick(0.05);assert.equal(D.L.length,0,'gone after 10 s');}
// online: the server's rows are drawn, no local drops or pickups
{const P=page({MP:{on:true}});const D=P.window.xDmPacks;P.dmScore('You','Bot Sage');assert.equal(D.L.length,0,'online: the server drops packs');
 P.mpCliSnap({u:[],hpk:[[7,3,1,4,0.1,-2,6.5],[8,4,1,9,0,9,2]]});assert.deepEqual(J(D.L.map(k=>[k.id,k.x,k.z,k.t])),[[7,4,-2,6.5],[8,9,9,2]]);
 P.player.hp=10;P.player.x=4;P.player.z=-2;P.dmTick(0.05);assert.equal(P.player.hp,10,'online: no local pickup (server authoritative)');
 P.mpCliSnap({u:[],hpk:[[8,4,1,9,0,9,1.9]]});assert.deepEqual(J(D.L.map(k=>k.id)),[8],'a pack the server dropped is removed');P.mpCliSnap({u:[]});assert.equal(D.L.length,0,'no hpk in a Deathmatch snapshot: none left');}
// base: Deathmatch no longer heals the killer; TDM still does
{const i=h.indexOf('function dmScore(by, victim) {'),j=h.indexOf('\nfunction dmRank',i),f=h.slice(i,j);assert(/if \(FV\.tdm && !FV\.esc\) \{ \/\/ TDM: the killer is topped up[\s\S]*player\.hp = 100; player\.armor = 50;/.test(f),'TDM kill top-up kept, Deathmatch / Escalation use packs');}
// ---- defuse cancel window offline
assert(h.includes('const DEF_CANCEL = 0.2; let defG = 0;'),'shared 0.2 s window');
assert(h.includes('const DEF_CANCEL = 0.2; let defG = 0;\nfunction xDefRel(inRange) {'),'release test shared by all three offline paths');
assert(h.includes('if (near && defusing) { defG = 0; const d0 = defuseT; defuseT += dt; if (d0 < 3.5 && defuseT >= 3.5) SFX.defHalf(); } else if (!xDefRel(near) || (defG += dt) >= DEF_CANCEL) { defG = DEF_CANCEL; defuseT = defuseT >= 3.5 ? 3.5 : 0; }'),'Retake defuse window (key release only)');
{const fr=h.slice(h.indexOf('function xDefRel(inRange) {'),h.indexOf('\n',h.indexOf('function xDefRel(inRange) {')));
 const a=h.indexOf('if (u) { s.dg = 0; const d0 = s.dt; s.dt += dt;');assert(a>0,'5v5 defuse window');const line=h.slice(h.lastIndexOf('\n',a)+1,h.indexOf('\n',a));
 // seq rows: [holding, dt, state] - state: 'rel' key let go standing in range, 'move' walking off (W held), 'fire', 'off' out of range
 const run=(seq)=>{const c={s:{dt:0,dg:0,du:null},SFX:{whir(){},defHalf(){}},player:{hp:100,vx:0,vz:0},keys:{},fireHeld:false,DEF_CANCEL:0.2};vm.createContext(c);vm.runInContext(fr,c);const step=line.trim();
  for(const [held,dt,st] of seq){c.u=held?c.player:null;if(held&&!c.s.du)c.s.du=c.player;c.keys={KeyW:st==='move'};c.player.vx=st==='move'?3:0;c.fireHeld=st==='fire';c.pn=st!=='off';c.near=c.pn?[c.player]:[];c.dt=dt;vm.runInContext(step,c);}return c.s.dt;};
 assert(Math.abs(run([[1,1],[0,0.15,'rel'],[1,0.5]])-1.5)<1e-9,'0.15 s key let-go: defuse continues');assert.equal(run([[1,1],[0,0.25,'rel']]),0,'0.25 s let-go before the half: reset');assert.equal(run([[1,4],[0,0.3,'rel']]),3.5,'after the half: checkpoint');
 assert.equal(run([[1,1],[0,0.05,'move']]),0,'moving off: reset at once');assert.equal(run([[1,4],[0,0.05,'fire']]),3.5,'firing: checkpoint at once');assert.equal(run([[1,1],[0,0.05,'off']]),0,'out of range: reset at once');}
assert(h.includes('} else if (!xDefRel(Math.hypot(player.x - SPX, player.z - SPZ) < 1.8) || (S.dg = (S.dg || 0) + dt) >= DEF_CANCEL) { S.dg = DEF_CANCEL; S.dp = S.half ? 3.5 : 0; }'),'range Spike drill window (release vs step-off)');
// ---- Operator second zoom: input + spectate
{const sr=fs.readFileSync(path.join(__dirname,'server_runtime.js'),'utf8');assert(sr.includes("az:ads===2&&w==='Operator'&&typeof xSC!=='undefined'&&xSC.lv===2?1:0"),'input az = Operator second zoom');assert(h.includes("az:ads===2&&w==='Operator'"),'installed');
 const sp=fs.readFileSync(path.join(__dirname,'spectate_runtime.js'),'utf8');const f=sp.slice(sp.indexOf('function xspvPov('),sp.indexOf('\n',sp.indexOf('function xspvPov('))),z=sp.slice(sp.indexOf('function xspvZoom('),sp.indexOf('\nfunction xspvOff'));
 const c={XSPV:{pov:{5:[2,0,0],6:[1,0,0]},povAt:0,zoom:0,scope:false},performance:{now:()=>0},XSZ:{Operator:[2.5,5],Marshal:[3.5]},XZ:{Vandal:1.25},xSC:{z:1},camera:{fov:103,updateProjectionMatrix(){}},xSCf:(z)=>100/z,hudS(){},$:()=>({})};vm.createContext(c);vm.runInContext(f+'\n'+z,c);
 assert.equal(c.xspvPov({nid:5}).ads,2);assert.equal(c.xspvPov({nid:6}).ads,1);c.xspvZoom('Operator',2);assert.equal(c.XSPV.zoom,5,'5x on the second zoom');c.xspvZoom('Operator',1);assert.equal(c.XSPV.zoom,2.5,'2.5x on the first');c.xspvZoom('Marshal',2);assert.equal(c.XSPV.zoom,3.5,'one-zoom scopes stay on their only zoom');}
console.log('Client game rules: DM health packs offline (drop on the victim, +50 / +25, 0.85 m reach, 8 s, not in TDM), Escalation packs offline (10 s, full health / armour / ammo, allies too) and online (server hpk rows drawn, no local pickup), DM kill no longer heals; defuse cancel window 0.2 s in 5v5 / Retake / drill; Operator second zoom sent (az) and shown in the spectate POV');
