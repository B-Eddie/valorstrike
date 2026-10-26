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
// 3. Smoke: server LOS sphere equals the rendered smoke (radius-4 SphereGeometry 1.8 m above the floor, scaled per ability:
// client XSMR == server SMOKE.r, wiki Cloudburst 3.35 / Dark Cover 4.1 / Cyber Cage 3.72 m).
assert(html.includes('smokeGeo = new THREE.SphereGeometry(4, 22, 16)')&&html.includes('m.position.set(x, 1.8, z); scene.add(m); J.smokes.push'));
{const s=fs.readFileSync(path.join(root,'server/src/abilities.js'),'utf8'),m=s.match(/export const SMOKE=\{radius:4,lift:1\.7,r:(\{[^}]*\})/);assert(m,'server smoke volume');
 const cm=html.match(/const XSMR = (\{[^}]*\});/);assert(cm,'client XSMR');const j=t=>JSON.stringify(Function('return '+t)());assert.equal(j(m[1]),j(cm[1]),'client XSMR == server SMOKE.r');}
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
// 5. Wallbang damage: the offline shot floors raw x k as the server's fire() (Math.floor(row * scale)); it rounded
// floor(raw) x k, 1 off on fractional rows (Odin head 77.5 x .75: server 58, client 57.75 -> 58; Sheriff head 159.5 x .75).
{assert(html.includes('xWkDmg(W, hs ? "head" : legs ? "legs" : "body", hit.distance, wk)'),'offline shot uses xWkDmg');
 const feel=fs.readFileSync(path.join(__dirname,'feel_runtime.js'),'utf8'),a=feel.indexOf('const wRaw='),b=feel.indexOf('\n',feel.indexOf('xWkDmg=function',a));assert(a>0&&b>a,'feel wallbang block');
 const W=JSON.parse(fs.readFileSync(path.join(root,'server/src/weapons.json'),'utf8')).weapons,WEAP={};for(const n of Object.keys(W))WEAP[n]={body:1};
 const c={WEAP,VF:{profiles:W},Math,Object,xPelOn:false};vm.createContext(c);vm.runInContext('var wDmg,xWkDmg;'+feel.slice(a,b),c);
 const sim=fs.readFileSync(path.join(root,'server/src/simulation.js'),'utf8');assert(sim.includes("damage=Math.floor((u.weapon==='Knife'?(knifeBack(target,u)?(heavy?KNIFE_HEAVY.crit:KNIFE_LIGHT.back):heavy?KNIFE_HEAVY.body:KNIFE_LIGHT.front):range[part==='head'?'headDamage':part==='legs'?'legDamage':'bodyDamage'])*scale"),'server floors raw x scale');
 let n=0,frac=0;for(const [name,w]of Object.entries(W)){if(w.shotgunPelletCount>1)continue;for(const r of w.damageRanges)for(const part of ['head','body','legs'])for(const k of [1,.75,.5]){const raw=r[part==='head'?'headDamage':part==='legs'?'legDamage':'bodyDamage'],d=(r.rangeStartMeters+Math.min(r.rangeEndMeters,r.rangeStartMeters+5))/2;
  assert.equal(c.xWkDmg(WEAP[name],part,d,k),Math.floor(raw*k),`${name} ${part} @${d} m x${k}`);n++;if(Math.floor(raw*k)!==Math.round(Math.floor(raw)*k))frac++;}}
 assert(frac>0,'the case set includes rows the old rounding got wrong');console.log(`Wallbang damage: ${n} weapon x band x part x k cases = server floor(raw x k) (${frac} differed under the old rounding)`);}
// 6. Shotgun damage outside the player's pellet loop (offline bots): the feel layer's wDmg returned one pellet (a bot
// Judge did 17 a shot, the base table's expected pellets ~119); the Bucky's alt fire (no profile) lost its falloff.
{const feel=fs.readFileSync(path.join(__dirname,'feel_runtime.js'),'utf8'),W=JSON.parse(fs.readFileSync(path.join(root,'server/src/weapons.json'),'utf8')).weapons;
 const cut=(s,a,b)=>{const i=s.indexOf(a),j=s.indexOf(b,i);assert(i>=0&&j>i,'slice '+a);return s.slice(i,j);};
 const base=cut(html,'const WEAP = {','let xSpS')+cut(html,'var xPelOn','const RF =');
 const prof=cut(feel,'for(const [w,p]of Object.entries(VF.profiles))','\n'),wb=feel.indexOf('const wRaw='),we=feel.indexOf('\n',feel.indexOf('xWkDmg=function',wb));
 const c={VF:{profiles:W},VRUN:{},FSA:{},XZ:{},Math,Object,JSON};vm.createContext(c);
 vm.runInContext(base.replace('const WEAP','var WEAP')+';'+prof+';var xWkDmg;'+feel.slice(wb,we)+';globalThis.T={WEAP,setPel:v=>{xPelOn=v;},wDmg0:typeof wDmg0!=="undefined"?wDmg0:null};',c);
 const T=c.T,clamp=(d,ffd)=>Math.max(.08,Math.min(.6,.75-d/(ffd*3)));let n=0;
 assert.equal(c.wDmg(T.WEAP.Judge,'body',5),119,'bot Judge body shot at 5 m = expected pellets (not one pellet)');
 for(const g of ['Shorty','Bucky','Judge']){const w=W[g],X=T.WEAP[g];assert.equal(X.pel,w.shotgunPelletCount,g+' pellets from the profile');
  for(const d of [2,6,9,11,14,20,40])for(const part of ['head','body','legs']){const r=w.damageRanges.find(r=>d>=r.rangeStartMeters&&d<r.rangeEndMeters)||w.damageRanges.at(-1),one=Math.floor(r[part==='head'?'headDamage':part==='legs'?'legDamage':'bodyDamage']);
   T.setPel(true);assert.equal(c.wDmg(X,part,d),one,`${g} ${part} @${d} one pellet`);
   T.setPel(false);assert.equal(c.wDmg(X,part,d),Math.min(150,Math.round(one*X.pel*clamp(d,X.ffd))),`${g} ${part} @${d} bot shot`);n++;}}
 T.setPel(true);for(const d of [5,20])for(const part of ['head','body','legs'])assert.equal(c.wDmg(T.WEAP.Bucky.alt,part,d),T.wDmg0(T.WEAP.Bucky.alt,part,d),'Bucky alt keeps the base falloff');
 assert.equal(c.wDmg(T.WEAP.Bucky.alt,'body',20),T.WEAP.Bucky.alt.ff[0]);
 console.log(`Shotgun damage: ${n} gun x range x part cases (one pellet in the player's loop, expected pellets for a bot's shot), Bucky alt falloff kept`);}
