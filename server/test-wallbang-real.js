// Wallbangs on real map geometry (item 1d, user 19:53 2026-10-26): the shipped Ascent collision world (public/worlds,
// built by build-all.cjs, the same BVH the room runs), a player shooting a bot through measured walls:
//  * 0.130 m wall (Ascent, 28.75 9.07 30.5 facing +z): Low (Spectre, 0.15 m) and Medium (Vandal, 0.35 m) pass at 50 %
//  * 0.202 m wall (-27.5 6.07 -40, +z): Spectre is stopped, Vandal passes at 50 %, Odin (High, 0.6 m) at 75 %
//  * 0.296 m wall (-28.25 6.07 10.25, -z): Vandal passes at 50 %
//  * 1.009 m wall (-62 4.07 -19.75, +x): everything is stopped (Odin too)
//  * a wallbang kill carries the kill event's 6th field (kill-feed wallbang mark); the hit event carries the reduced damage
// Thicknesses are measured along each shot's own ray (eye 1.6 m over a nav node to the body centre of a bot 2.2 m past
// the wall) and asserted, so a map rebuild that moves a wall fails here instead of silently testing open air.
import assert from 'node:assert/strict';import fs from 'node:fs';import {Simulation} from './src/simulation.js';import {hitVolumes} from './src/hitboxes.js';
const {loadWorld}=await import('./src/world.js'),here=new URL('.',import.meta.url).pathname;
if(!fs.existsSync(here+'public/worlds/ascent/meta.json')){const {spawnSync}=await import('node:child_process');spawnSync(process.execPath,['build-all.cjs'],{cwd:here,stdio:'inherit'});}
const assets={fetch:async r=>new Response(await fs.promises.readFile(here+'public'+new URL(r.url).pathname))},world=await loadWorld(assets,'ascent');
const SLAB={L:{p:[28.75,9.0653,30.5],a:Math.PI/2,th:.130},M:{p:[-27.5,6.0692,-40],a:Math.PI/2,th:.202},M2:{p:[-28.25,6.0658,10.25],a:3*Math.PI/2,th:.296},X:{p:[-62,4.0686,-19.75],a:0,th:1.009}};
const faces=(e,q,L)=>{let t=0;const f=[];for(let i=0;i<10;i++){const h=world.ray(e.map((n,k)=>n+q[k]*(t+.0005)),q,L-t);if(!(h<Infinity))break;t+=h+.0005;f.push(t);}return f;};
function setup(k,weapon){const S=SLAB[k],d=[Math.cos(S.a),0,Math.sin(S.a)],o=[S.p[0],S.p[1]+1.5,S.p[2]];
 const d1=world.ray(o,d,10),th=world.ray(o.map((n,i)=>n+d[i]*(d1+.002)),d,3)+.002,R=d1+th+2.2,tx=S.p[0]+d[0]*R,tz=S.p[2]+d[2]*R,ty=world.ground(tx,tz,S.p[1]+1);
 const s=new Simulation(world,'tdm','ascent',()=>.5),a=s.add('a'),b=s.add('b');s.start(false);
 Object.assign(a,{team:0,x:S.p[0],y:S.p[1],z:S.p[2],ch:0,weapon,ammo:30,fireAt:0,protectedUntil:0,input:{},vx:0,vz:0,vy:0});
 Object.assign(b,{team:1,x:tx,y:ty,z:tz,look:S.a+Math.PI/2,armor:0,hp:100,protectedUntil:0,vx:0,vz:0,vy:0,ch:0,alive:true});
 const B=hitVolumes(b).body,aim=[0,1,2].map(i=>B.a[i]+(B.b[i]-B.a[i])*.8)/* upper chest: the capsule's lower half scores as legs */,e=[a.x,a.y+1.6,a.z];let q=aim.map((n,i)=>n-e[i]);const L=Math.hypot(...q);q=q.map(n=>n/L);
 const f=faces(e,q,L-.35);assert.equal(f.length,2,`${k}: one wall between shooter and target (${f.length} faces)`);assert.ok(Math.abs(f[1]-f[0]-S.th)<.01,`${k}: wall ${(f[1]-f[0]).toFixed(3)} m thick along the shot, want ${S.th}`);
 return {s,a,b,aim};}
function shoot(k,weapon,hp){const {s,a,b,aim}=setup(k,weapon);if(hp)b.hp=hp;const e=[a.x,a.y+1.6-(a.ch||0),a.z],q=[tx(aim,0)-e[0],tx(aim,1)-e[1],tx(aim,2)-e[2]];
 Object.assign(a,{look:Math.atan2(-q[0],-q[2]),pitch:Math.atan2(q[1],Math.hypot(q[0],q[2])),fireAt:0,triggerHeld:false});const e0=s.events.length;s.fire(a);const ev=s.events.slice(e0);
 return {hp:b.hp,alive:b.alive,h:ev.find(x=>x[0]==='h'),k:ev.find(x=>x[0]==='k')};}
const tx=(v,i)=>Array.isArray(v)?v[i]:[v.x,v.y,v.z][i];
const r={};for(const [k,w] of [['L','Spectre'],['L','Vandal'],['M','Spectre'],['M','Vandal'],['M','Odin'],['M2','Vandal'],['X','Odin'],['X','Vandal']])r[k+' '+w]=shoot(k,w);
console.log('real-map wallbangs (hp after one body shot):',Object.entries(r).map(([k,v])=>k+' '+v.hp).join(', '));
const SP=26,VA=40,OD=38; // body damage inside the first falloff band (weapons.json)
assert.equal(r['L Spectre'].hp,100-Math.floor(SP*.5),'0.130 m wall: Spectre (Low) passes at 50 %');
assert.equal(r['L Vandal'].hp,100-Math.floor(VA*.5),'0.130 m wall: Vandal (Medium) passes at 50 %');
assert.equal(r['M Spectre'].hp,100,'0.202 m wall: Spectre (Low, 0.15 m) stopped');
assert.equal(r['M Vandal'].hp,100-Math.floor(VA*.5),'0.202 m wall: Vandal passes at 50 %');
assert.equal(r['M Odin'].hp,100-Math.floor(OD*.75),'0.202 m wall: Odin (High) passes at 75 %');
assert.equal(r['M2 Vandal'].hp,100-Math.floor(VA*.5),'0.296 m wall: Vandal passes at 50 %');
assert.equal(r['X Odin'].hp,100,'1 m wall stops the Odin');assert.equal(r['X Vandal'].hp,100,'1 m wall stops the Vandal');
assert.ok(r['M Vandal'].h&&r['M Vandal'].h[5]===Math.floor(VA*.5),'hit event carries the wallbang damage');
{const k=shoot('M','Vandal',1);assert.equal(k.alive,false);assert.ok(k.k&&k.k[5]===1,'wallbang kill flagged in the kill event (6th field)');}
console.log('Wallbang real map: Ascent 0.130 / 0.202 / 0.296 / 1.009 m walls, tiers L/M/H pass or stop as Valorant, kill event wallbang flag');
