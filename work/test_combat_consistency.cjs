// Combat consistency (#10): the server's hit volumes, penetration tiers and status ownership agree with the client.
const fs=require('fs'),vm=require('vm'),path=require('path'),assert=require('node:assert/strict');
const root=path.join(__dirname,'..'),html=fs.readFileSync(path.join(root,'index.html'),'utf8'),repair=fs.readFileSync(path.join(__dirname,'repair_runtime.js'),'utf8'),net=fs.readFileSync(path.join(__dirname,'server_runtime.js'),'utf8');
const table=JSON.parse(fs.readFileSync(path.join(root,'server/src/hitboxes.json'),'utf8')),V=table.volumes;
// 1. Volume sizes equal the client's bone-following hitboxes (mkGuy base geometry scaled in xrHitboxes).
assert(html.includes('xG("Capsule", 0.4, 1, 4, 10)')&&html.includes('xG("Sphere", 0.25, 12, 10)'),'mkGuy base hitbox geometry');
assert(repair.includes('b.head.position.y+=.08;b.head.scale.setScalar(.78);')&&repair.includes('const top=Math.max(.65,h.y-.13),bottom=.06')&&repair.includes('b.body.scale.set(.72,height/1.8,.72)'),'xrHitboxes constants');
assert.equal(V.headOffsetY,.08);assert.ok(Math.abs(V.headRadius-.25*.78)<1e-9);assert.ok(Math.abs(V.bodyRadius-.4*.72)<1e-9);assert.equal(V.bodyBottom,.06);assert.equal(V.bodyTopBelowHead,.13);
assert(html.includes('hit.point.y - b.g.position.y < 0.9'),'client legs line');assert.equal(V.legsBelow,.9);
assert(html.includes('cw = X.cb * 0.62'),'client crouch weight');assert.equal(table.crouchWeight,.62);
for(const p of ['stand','crouch','walk','run','crouchWalk','air'])for(const k of ['head','pelvis','neck'])assert.equal(table.poses[p][k].length,3);
assert.ok(table.poses.stand.head[2]>.05&&table.poses.crouch.head[2]>table.poses.stand.head[2],'rendered head is forward of the root (+Z facing) and leans further when crouched');
assert.ok(Math.max(...Object.values(table.maxAgentDeviation))<.08,'one shared table fits every agent within 8 cm');
// 2. Offline wallbang tiers use the same official tiers as the server's weapons.json.
{const a=html.indexOf('const XPN = {'),b=html.indexOf('function xThin',a),c={THREE:{Raycaster:class{},Vector3:class{}}};vm.createContext(c);vm.runInContext(html.slice(a,b).replace('const XPN','globalThis.XPN=XPN;var XPN').replace(/XWR = new THREE.Raycaster\(\), XWV = new THREE.Vector3\(\), XWD = new THREE.Vector3\(\), XWA = \[\], XWH = \[\];/,'XWR=0;'),c);
 const W=JSON.parse(fs.readFileSync(path.join(root,'server/src/weapons.json'),'utf8')).weapons,tier={High:'H',Medium:'M',Low:'L'};
 for(const [n,w]of Object.entries(W))assert.equal(c.xPen(n),c.XPN[tier[w.wallPenetration.split('::')[1]]],n+' penetration tier');
 assert.deepEqual(JSON.parse(JSON.stringify(c.XPN)),{H:{t:.6,k:.75},M:{t:.35,k:.5},L:{t:.15,k:.5}});}
{const s=fs.readFileSync(path.join(root,'server/src/simulation.js'),'utf8');assert(s.includes("PENETRATION={High:{t:.6,k:.75},Medium:{t:.35,k:.5},Low:{t:.15,k:.5}}"),'server tier sizes');}
// 3. Smoke: server LOS sphere equals the rendered smoke (radius-4 SphereGeometry 1.8 m above the floor).
assert(html.includes('smokeGeo = new THREE.SphereGeometry(4, 22, 16)')&&html.includes('m.position.set(x, 1.8, z); scene.add(m); J.smokes.push'));
{const s=fs.readFileSync(path.join(root,'server/src/abilities.js'),'utf8');assert(s.includes('export const SMOKE={radius:4,lift:1.7}'),'server smoke volume');}
// 4. Online: replayed enemy casts are visual only; statuses come from the server; remote rows drive crouch.
{const a=net.indexOf('// Combat consistency (#10)'),b=net.indexOf('// Floor weapons (#4)');assert(a>0&&b>a);
 const calls=[],white=[],c={NET:{socket:{}},MP:{me:1},J:{smokes:[]},player:{hp:100},bots:[],allies:[],
  mpCliSnap(){},pNs(t){calls.push(['ns',t]);},xConStart(t){calls.push(['con',t]);},enPop(){if(c.player.hp>0)white.push(1);},
  enSmoke(x,z){c.J.smokes.push({m:{position:{x,y:1.8,z}}});},
  mpFx(u,ag,k,o,d,auth,p){if(k==='q'){c.pNs(2.5);c.xConStart(2000);}if(k==='c')c.enSmoke(p.x,p.z);}};
 vm.createContext(c);vm.runInContext(net.slice(a,b),c);
 c.mpFx({},'Reyna','q',{},{},false,null);assert.deepEqual(calls,[],'replayed casts apply no local nearsight/concussion online');
 c.pNs(1.2);c.xConStart(900);assert.deepEqual(calls,[['ns',1.2],['con',900]],'server status still applies');
 c.enPop({});assert.equal(white.length,0,'replayed flash pop does not white out locally online');assert.equal(c.player.hp,100,'hp restored');
 c.mpFx({},'Omen','c',{},{},false,{x:3,y:6.1,z:4});assert.equal(c.J.smokes[0].m.position.y,7.8,'online smoke rendered on its floor');
 const u={nid:2};c.bots.push(u);c.mpCliSnap({u:[[2,1,'b','Jett',0,0,0,0,100,0,1,'Vandal',1,0,0,25,75,1,-.2]]});assert.equal(u.cr,true);assert.equal(u.np,-.2);
 c.mpCliSnap({u:[[2,1,'b','Jett',0,0,0,0,100,0,1,'Vandal',1,0,0,25,75,0,0]]});assert.equal(u.cr,false);
 c.NET.socket=null;c.mpFx({},'Reyna','q',{},{},false,null);assert.equal(calls.length,4,'offline replay keeps its local effects');c.enPop({});assert.equal(white.length,1);}
console.log('Combat consistency: server hit volumes = client bone hitboxes, shared official penetration tiers, render-matched smoke, online statuses server-owned, remote crouch/pitch rows applied');
