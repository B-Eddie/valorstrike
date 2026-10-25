// Playable leash (map boundary), client side. One rule in the shared motor (vendor/valorant-feel.js = server
// src/motor.cjs leashGrid/leashOk); the server world exposes it as world.leash, the client as nmLeash (generated page).
// Checks: the rule itself on a synthetic floor (core, rim, void, wall top, updraft height, already-outside units); the
// motor refuses a horizontal step off the footprint but lets an outside unit move; the page wires nmLeash into the
// player motor world (feel moveP), into the knife-lunge impulse and into the global blocked() its direct moves use; the
// server world and the server's Jett dash / Raze satchel loops consult it.
const assert=require('assert/strict'),fs=require('fs'),path=require('path'),vm=require('vm');
const root=path.join(__dirname,'..'),html=fs.readFileSync(path.join(root,'index.html'),'utf8'),vendor=fs.readFileSync(path.join(root,'vendor/valorant-feel.js'),'utf8');
assert.equal(vendor,fs.readFileSync(path.join(root,'server/src/motor.cjs'),'utf8'),'client and server motor are the same file');
const ctx={Math,Number,Infinity,Map,globalThis:null,window:null};ctx.globalThis=ctx.window=ctx;vm.createContext(ctx);vm.runInContext(vendor,ctx);const VF=ctx.ValorantFeel;
assert(VF.leashGrid&&VF.leashOk,'motor exports the leash');
// floor: nav grid x 0..10, z 0..10 at y 0 (step .75); a 3 m wall top at x 11..12 (no nodes); void past x 12; box top with nodes
const nodes=[],valid=[];for(let x=0;x<=10.01;x+=.75)for(let z=0;z<=10.01;z+=.75){nodes.push([x,0,z]);valid.push(1);}nodes.push([5,1.5,12.5]);valid.push(1);nodes.push([20,0,20]);valid.push(0);
const ground=(x,z,y)=>x>12?-50:x>=10.5&&x<11?0:x>=11?3:(z>12&&z<13&&x>4&&x<6?1.5:0);
const L=VF.leashGrid(nodes,valid),ok=(x,z,y)=>VF.leashOk(L,x,z,y,ground);
assert(ok(5,5,0),'on the nav');assert(ok(10.5,5,0),'just past the nav edge on the same floor (rim)');assert(ok(10.9,5,0),'rim 0.9 m out');
assert(!ok(12.5,5,0),'over the void');assert(!ok(11.5,5,3),'standing on a 3 m wall top with no nodes');assert(ok(5,5,4.9),'updraft height over the nav');assert(!ok(12.5,5,9),'9 m up over the void');
assert(ok(5,12.5,1.5),'box top the nav sampled');assert(!ok(20,20,0),'invalid nodes do not count');assert(ok(10.6,5,1),'jumping just past the edge, same floor below');
// components: a roof the nav sampled 8 m above the playable floor is off the footprint, a 1.5 m box top is on it
{const n2=[],v2=[],adj=[];const add=(x,y,z)=>{n2.push([x,y,z]);v2.push(1);adj.push([]);return n2.length-1;};const link=(a,b)=>{adj[a].push(b);adj[b].push(a);};let prev=null;for(let x=0;x<=6;x+=.75){const i=add(x,0,0);if(prev!=null)link(prev,i);prev=i;}const r1=add(2,8,.75),r2=add(2.75,8,.75);link(r1,r2);const b1=add(4,1.5,.75);const L2=VF.leashGrid(n2,v2,adj),g2=(x,z,y)=>x>1.5&&x<3.2&&z>.4?8:x>3.6&&x<4.4&&z>.4?1.5:0;
 assert(!VF.leashOk(L2,2.4,.75,8,g2),'roof component excluded');assert(VF.leashOk(L2,4,.75,1.5,g2),'box component kept');assert(VF.leashOk(L2,3,0,0,g2),'playable kept');}
// motor: a unit walking at the edge cannot step off; one already outside may move
const mv=(x,z,y,x0,z0)=>VF.leashOk(L,x,z,y,ground,x0,z0),world={ground:(x,z,y)=>Math.min(y,ground(x,z,y)),blocked:()=>false,leash:mv};
const P={x:10.4,z:5,y:0,vx:0,vz:0,vy:0};for(let i=0;i<120;i++)VF.step(P,{x:1,z:0,speed:6.75},1/60,world);assert(P.x<=12&&ok(P.x,P.z,P.y),'walk stops on the footprint (x '+P.x.toFixed(2)+')');assert(P.y>-1,'did not fall');
const Q={x:15,z:5,y:-50,vx:0,vz:0,vy:0};const q0=Q.x;for(let i=0;i<30;i++)VF.step(Q,{x:-1,z:0,speed:6.75},1/60,{ground:()=>-50,blocked:()=>false,leash:mv});assert(Q.x<q0,'a unit already off the footprint is never trapped');
// outside unit at floor height (dropped past a ledge): back toward the nav yes, further out no (Bind/Split sweep escapes)
{const g3=(x,z,y)=>0;assert(!VF.leashOk(L,12.2,5,0,g3),'2 m past the nav is off the footprint');assert(VF.leashOk(L,11.9,5,0,g3,12.2,5),'may move back toward the nav');assert(!VF.leashOk(L,12.5,5,0,g3,12.2,5),'may not move further out');
 assert(!VF.leashOk(L,12.2,5,0,g3,10.4,5),'stepping off from the footprint still refused');assert(VF.leashOk(L,17,5,0,g3,17.3,5),'far from every node (> 6 m): free');
 const R={x:12.2,z:5,y:0,vx:0,vz:0,vy:0};for(let i=0;i<60;i++)VF.step(R,{x:1,z:0,speed:6.75},1/60,{ground:()=>0,blocked:()=>false,leash:(x,z,y,x0,z0)=>VF.leashOk(L,x,z,y,g3,x0,z0)});assert(R.x<=12.21,'motor: outside unit cannot walk further out (x '+R.x.toFixed(2)+')');
 const S={x:12.2,z:5,y:0,vx:0,vz:0,vy:0};for(let i=0;i<60;i++)VF.step(S,{x:-1,z:0,speed:6.75},1/60,{ground:()=>0,blocked:()=>false,leash:(x,z,y,x0,z0)=>VF.leashOk(L,x,z,y,g3,x0,z0)});assert(S.x<11,'motor: outside unit walks back onto the footprint');}
// generated page wiring
assert(html.includes('C.leash=VM_.leashGrid(C.nav.nodes,C.nav.valid,C.nav.adj)'),'page leash uses the nav components');
assert(/function nmLeash\(C,x,z,y,x0,z0\)\{const VM_=window\.ValorantFeel;[^\n]*VM_\.leashOk\(C\.leash,x,z,y,\(a,b,c\)=>nmHeight\(C,a,b,c\),x0,z0\);\}/.test(html),'nmLeash uses the shared rule with the motor\'s ground');
assert(html.includes('if(Number.isFinite(y)&&!nmLeash(C,x,z,y))return true;'),'global blocked() reports off-footprint points as blocked');
assert(html.includes('leash:native?(x,z,y,x0,z0)=>nmLeash(native,x,z,y,x0,z0):null,ceiling:'),'player motor world has the leash');
assert(html.includes('if(!world.blocked(nx,nz,.4,P.y,1.8-P.ch)&&!(world.leash&&!world.leash(nx,nz,P.y,P.x,P.z))){P.x=nx;P.z=nz;}'),'knife lunge respects the leash');
// server side
const wsrc=fs.readFileSync(path.join(root,'server/src/world.js'),'utf8'),asrc=fs.readFileSync(path.join(root,'server/src/abilities.js'),'utf8');
assert(wsrc.includes('leash=(x,z,y,x0,z0)=>Motor.leashOk(leashCells,x,z,y,ground,x0,z0)')&&/return \{plantAt,ground,blocked,leash,/.test(wsrc),'server world exposes the leash');
assert(asrc.includes("if(sim.world.blocked(x,z,.4,u.y,1.8-(u.ch||0))||(sim.world.leash&&!sim.world.leash(x,z,u.y,u.x,u.z)))break;"),'server Jett dash respects the leash');
assert(asrc.includes("if(sim.world.blocked(u.x+dx*.5,u.z+dz*.5,.4,u.y,1.8)||(sim.world.leash&&!sim.world.leash(u.x+dx*.5,u.z+dz*.5,u.y,u.x,u.z)))break;"),'server satchel respects the leash');
console.log('map leash: shared rule (core/rim/void/wall top/updraft), motor containment, client + server wiring');
