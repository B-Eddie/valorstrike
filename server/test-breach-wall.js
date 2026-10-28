// Breach Aftershock (C) / Flashpoint (Q) through the wall under the crosshair (server abilities.js breachWall = page bcWall).
// Valorant: wiki.playvalorant.com/en-us/Aftershock, Flashpoint: "an indicator to place a fusion / blinding charge on terrain ... will turn red if it
// is placed on a position where the charge cannot pass through to the other side. On cast, Breach will fire the charge forward from his location to
// the targeted position, passing through until it reaches the other side." Max deploy distance 35 m, max wall penetration depth 10 m.
// Rule: the first wall hit along the aim within 35 m; the charge passes through it at Breach's floor height up to 10 m and lands on the far side.
// A human aiming at no wall / a wall too far / too thick: refused, the charge stays in hand. Bots keep the old rule (the aim point short of the wall).
// Was: the charge went off on Breach's side of the wall (0.5 m short of the hit), 50 m / 14 m reach, and fired at open air.
import assert from 'node:assert/strict';import {SpikeSimulation} from './src/spike.js';import {breachWall,BREACH_WALL,leerSpot,LEER_SPOT} from './src/abilities.js';
// fixture: open floor y=0, one wall slab between z=-a and z=-b (a<b) across the whole map, 6 m tall
let A=Infinity,B=Infinity;
const ray=(o,d,max=Infinity)=>{let t=Infinity;if(d[2]<0&&Number.isFinite(A)){const tw=(o[2]+A)/-d[2];if(tw>=0&&o[1]+d[1]*tw<6)t=tw;}if(d[1]<0){const tf=o[1]/-d[1];if(tf<t)t=tf;}return t<=max?t:Infinity;};
const blocked=(x,z,r=0,y=0,h=1.8)=>Number.isFinite(A)&&z<=-A+r&&z>=-B-r&&y<6;
const W={map:{attacker:[0,0,0],defender:[0,0,-60],sites:{A:[0,0,-60]}},nav:{nodes:[[0,0,0],[0,0,-60]],adj:[[1],[0]]},playable:[0,1],allowed:new Set([0,1]),near:(x,z)=>z<-30?1:0,ground:()=>0,blocked,ray};
const setup=(human=true)=>{const s=new SpikeSimulation(W,'five','ascent',()=>.5),u=s.add('breach','Breach',human!==false?true:false);s.add('foe');s.start(false);s.buy=0;s.roundDelay=0;Object.assign(u,{x:0,y:0,z:0,look:0,pitch:0});u.ability.c=2;u.ability.q=2;return {s,u};};
const kind={c:'blast',q:'flash'};
assert.deepEqual(BREACH_WALL,{reach:35,depth:10},'wiki 35 m deploy, 10 m penetration');
for(const k of ['c','q']){
 // 1. a 2 m wall 5 m ahead: the charge lands on the far side, on the floor (Flashpoint 1.7 m up)
 A=5;B=7;{const {s,u}=setup();const bw=breachWall(s,u);assert.ok(bw&&bw[2]<-7&&bw[2]>-10,'far side point '+JSON.stringify(bw));assert.equal(s.command(u,{t:'ab',k}),true,k+' cast');const e=s.effects.find(e=>e.kind===kind[k]&&e.owner===u.id);
  assert.ok(e&&e.p[2]<-7&&e.p[2]>-10,k+': beyond the wall '+JSON.stringify(e&&e.p));assert.ok(Math.abs(e.p[1]-(k==='q'?1.7:.1))<.05,k+' height '+e.p[1]);assert.equal(u.ability[k],1,'one charge spent');}
 // 2. aimed up at the wall (crosshair high on it): still through it at Breach's floor height
 {const {s,u}=setup();u.pitch=.4;assert.equal(s.command(u,{t:'ab',k}),true,k+' aimed high');const e=s.effects.find(e=>e.kind===kind[k]&&e.owner===u.id);assert.ok(e.p[2]<-7,'through');}
 // 3. a wall 30 m away (inside 35 m): through it
 A=30;B=31;{const {s,u}=setup();assert.equal(s.command(u,{t:'ab',k}),true,k+' 30 m wall');const e=s.effects.find(e=>e.kind===kind[k]&&e.owner===u.id);assert.ok(e.p[2]<-31,'far side of the 30 m wall');}
 // 4. too far (40 m), too thick (12 m), or no wall at all: refused, charge kept, nothing placed
 for(const [a,b,why] of [[40,41,'wall beyond 35 m'],[5,17,'wall thicker than 10 m'],[Infinity,Infinity,'no wall (open air)']]){A=a;B=b;const {s,u}=setup();assert.equal(breachWall(s,u),null,why+': no far-side point');
  assert.equal(s.command(u,{t:'ab',k}),false,k+' '+why+': refused');assert.equal(u.ability[k],2,'charge kept');assert.ok(!s.effects.some(e=>e.kind===kind[k]&&e.owner===u.id),'nothing placed');}
 // 5. aimed at the floor in front (no wall under the crosshair): refused
 A=5;B=7;{const {s,u}=setup();u.pitch=-.6;assert.equal(s.command(u,{t:'ab',k}),false,k+' aimed at the floor: refused');}
 // 6. bots keep the old rule: open air still casts (the aim point)
 A=Infinity;B=Infinity;{const {s,u}=setup(false);assert.equal(u.human,false);assert.equal(s.command(u,{t:'ab',k}),true,k+' bot: old rule');}
}
console.log('Breach Aftershock / Flashpoint: through the wall under the crosshair (35 m reach, 10 m at his floor), far side; humans refused at open air / too far / too thick (charge kept); bots unchanged');
// Reyna Leer, the same surface rules (page ryLeerSpot): 10 m along the aim through terrain, pulled back out of it. Was: 0.5 m short of the first wall.
assert.deepEqual(LEER_SPOT,{d:10,min:.6});
for(const [a,b,want,why] of [[Infinity,Infinity,10,'open: 10 m'],[3,4,10,'a thin wall at 3 m: the eye goes through it, 10 m'],[8,12,7.75,'a wall from 8 to 12 m: pulled back out of it']]){A=a;B=b;
 const s=new SpikeSimulation(W,'five','ascent',()=>.5),u=s.add('rey','Reyna');s.add('foe');s.start(false);s.buy=0;s.roundDelay=0;Object.assign(u,{x:0,y:0,z:0,look:0,pitch:0});u.ability.c=1;
 const p=leerSpot(s,[0,1.6,0],[0,0,-1]);assert.ok(Math.abs(-p[2]-want)<.01,why+': '+p[2]);assert.equal(s.command(u,{t:'ab',k:'c'}),true);const e=s.effects.find(e=>e.kind==='leer');assert.ok(Math.abs(-e.p[2]-want)<.01&&Math.abs(e.p[1]-1.6)<1e-6,why+' (cast) '+e.p);}
console.log('Reyna Leer: 10 m through terrain, pulled back out of it');
