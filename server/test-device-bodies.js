// Online device bodies (qa-22): the persistent devices go out in the snapshot (devices.js deviceRows -> spike.js snapshot fx
// rows {kind:'dev', d, o, tm, p, q, yaw, hp}) so the online client draws their real models (work/server_runtime.js
// netSyncDevices); Spycam (1 HP) and Owl Drone (100 HP, wiki) now have bodies a human's bullets shoot down, and a body shot
// down before its dart tagged anyone ends the dart.
import assert from 'node:assert/strict';import {SpikeSimulation} from './src/spike.js';import {tickAbilities} from './src/abilities.js';import {SHOOT,DEV,deviceRows,DEV_ROWS} from './src/devices.js';
const W={map:{attacker:[0,0,0],defender:[0,0,-30],sites:{A:[0,0,-30]}},nav:{nodes:[[0,0,0],[0,0,-30]],adj:[[1],[0]]},playable:[0,1],allowed:new Set([0,1]),near:()=>0,ground:()=>0,blocked:()=>false,ray:()=>Infinity};
const setup=agent=>{const s=new SpikeSimulation(W,'five','ascent',()=>.5),u=s.add(agent,agent),h=s.add('human','Jett');s.start(false);s.buy=0;s.roundDelay=0;h.team=1-u.team;
 Object.assign(u,{x:0,y:0,z:0,look:0,pitch:0,alive:true});Object.assign(h,{x:0,y:0,z:-20,look:Math.PI,pitch:0,alive:true,hp:100,human:true,weapon:'Vandal',ammo:25,reserve:50,fireAt:0});return {s,u,h};};
const tick=(s,sec,step=.05)=>{for(let t=0;t<sec-1e-9;t+=step){s.time+=step;tickAbilities(s,step);}};
const ab=(s,u,k)=>{s.time+=.5;return s.command(u,{t:'ab',k});};
// aim the human's eye at a point and fire n single shots (first-shot accuracy: the sim rng is fixed at .5)
const shoot=(s,h,pt,n)=>{for(let i=0;i<n;i++){const e=[h.x,h.y+1.6,h.z],q=pt.map((v,k)=>v-e[k]),l=Math.hypot(...q);h.look=Math.atan2(-q[0],-q[2]);h.pitch=Math.asin(q[1]/l);s.time+=.5;h.fireAt=0;h.recoil=0;s.fire(h);}};
const rows=s=>s.snapshot().fx.filter(r=>r.kind==='dev');
// 1. values
assert.deepEqual([SHOOT.spycam.hp,SHOOT.owl.hp,DEV.owl.life,DEV.spycam.life],[1,100,7,120],'Spycam 1 HP, Owl Drone 100 HP / 7 s (wiki)');
assert.deepEqual([...DEV_ROWS].sort(),['alarmbot','blastpack','hunter','owl','spycam','trademark','trapwire','turret']);
// 2. each device kind is a snapshot row with its owner, team, position (cm) and HP
for(const [agent,k,kind] of [['Killjoy','e','turret'],['Killjoy','q','alarmbot'],['Cypher','c','trapwire'],['Chamber','c','trademark'],['Raze','q','blastpack'],['Cypher','e','spycam'],['Sova','c','owl']]){
 const {s,u}=setup(agent);u.ability[k]=1;assert.equal(ab(s,u,k),true,agent+' '+k);const e=s.effects.find(x=>x.kind===kind);assert.ok(e,kind+' effect');
 const r=rows(s).find(x=>x.d===kind);assert.ok(r,kind+' row');assert.deepEqual([r.id,r.o,r.tm,r.hp],[e.id,u.id,u.team,SHOOT[kind].hp],kind+' row fields');assert.ok(r.p.every(Number.isFinite)&&r.p.every(n=>Math.round(n*100)/100===n),kind+' p in cm');
 if(kind==='trapwire')assert.ok(Array.isArray(r.q),'trapwire: the other anchor');if(kind==='turret')assert.ok(Number.isFinite(r.yaw),'turret yaw');
 e.until=s.time-1;assert.ok(!rows(s).some(x=>x.id===e.id),kind+': gone from the snapshot once it ends');}
// 3. Spycam: a 1 HP body; one bullet from a human before the 1.15 s deploy ends the dart (no reveal)
{const {s,u,h}=setup('Cypher');u.ability.e=1;ab(s,u,'e');const c=s.effects.find(e=>e.kind==='spycam'),d=s.effects.find(e=>e.kind==='dart');assert.equal(d.body,c.id);
 Object.assign(h,{x:c.p[0],z:c.p[2]-6});shoot(s,h,[c.p[0],c.p[1]+SHOOT.spycam.y,c.p[2]],1);assert.ok(!s.effects.includes(c),'Spycam shot down by one bullet');assert.equal(s.destroyed,1);
 h.x+=3;tick(s,2);assert.ok(!s.effects.includes(d),'its dart ends');assert.ok(!(h.revealedUntil>s.time),'nobody revealed');}
// 4. Spycam left alone: the dart works as before and the camera stays after its pings
{const {s,u,h}=setup('Cypher');u.ability.e=1;ab(s,u,'e');const c=s.effects.find(e=>e.kind==='spycam');Object.assign(h,{x:c.p[0]+1,z:c.p[2]-8});tick(s,1.3);assert.ok(h.revealedUntil>s.time,'darted on deploy');tick(s,10);assert.ok(s.effects.includes(c)&&rows(s).some(r=>r.d==='spycam'),'the camera stays');}
// 5. Owl Drone: a 100 HP body over the aim point; Vandal body shots (40) take it down in 3, not 2
{const {s,u,h}=setup('Sova');Object.assign(h,{x:40,z:40});u.ability.c=1;ab(s,u,'c');const o=s.effects.find(e=>e.kind==='owl');assert.ok(o.p[1]>=DEV.owl.lift-1e-9,'hovers over the aim point');
 Object.assign(h,{x:o.p[0]+.01,z:o.p[2]+8});shoot(s,h,o.p,2);assert.ok(s.effects.includes(o)&&o.hp===20,'2 Vandal bullets: 20 HP left ('+o.hp+')');shoot(s,h,o.p,1);assert.ok(!s.effects.includes(o),'3rd bullet: down');
 tick(s,.2);assert.ok(rows(s).every(r=>r.d!=='owl'),'no row after');}
// 6. own team's bullets pass through own devices
{const {s,u,h}=setup('Cypher');h.team=u.team;u.ability.e=1;ab(s,u,'e');const c=s.effects.find(e=>e.kind==='spycam');Object.assign(h,{x:c.p[0],z:c.p[2]-6});shoot(s,h,[c.p[0],c.p[1],c.p[2]],1);assert.ok(s.effects.includes(c),'an ally does not break it');}
// 7. Owl Drone stand-in darts every 5 s while the drone is up (wiki Owl_Drone dart cooldown 5 s, 7 s flight; qa-32): the 2nd dart
// prefers an enemy the 1st did not tag; a drone shot down before 5 s fires no 2nd dart.
{const {s,u,h}=setup('Sova'),h2=s.add('h2','Jett');Object.assign(h2,{team:h.team,alive:true,hp:100,human:true});u.ability.c=1;Object.assign(h,{x:40,z:40});Object.assign(h2,{x:40,z:-40});ab(s,u,'c');const o=s.effects.find(e=>e.kind==='owl');
 assert.equal(s.effects.filter(e=>e.kind==='dart').length,2,'two darts queued for a 7 s flight (0 s, 5 s)');
 Object.assign(h,{x:o.p[0]+3,z:o.p[2]});Object.assign(h2,{x:o.p[0]+9,z:o.p[2]});tick(s,.2);const d1=s.effects.find(e=>e.kind==='dart'&&e.tgt!=null);assert.ok(d1&&d1.tgt===h.id,'1st dart: the nearest enemy');
 tick(s,5);const d2=s.effects.find(e=>e.kind==='dart'&&e.tgt!=null&&e!==d1);assert.ok(d2&&d2.tgt===h2.id,'2nd dart 5 s in: the enemy the 1st did not tag');tick(s,2);assert.ok(h2.revealedUntil>0,'2nd dart pings');}
{const {s,u,h}=setup('Sova');u.ability.c=1;Object.assign(h,{x:40,z:40});ab(s,u,'c');const o=s.effects.find(e=>e.kind==='owl');Object.assign(h,{x:o.p[0]+.01,z:o.p[2]+8});tick(s,.2);shoot(s,h,o.p,3);assert.ok(!s.effects.includes(o),'drone down');
 tick(s,5.5);assert.ok(!s.effects.some(e=>e.kind==='dart'&&e.tgt==null),'no 2nd dart after the drone is down');}
console.log('Device bodies: Turret / Alarmbot / Trapwire / Trademark / Blast Pack / Spycam / Owl Drone snapshot rows (owner, team, cm, HP, Trapwire anchors, yaw; gone when ended); Spycam 1 HP shot down by a human ends its dart; Owl Drone 100 HP takes 3 Vandal bullets, darts every 5 s while up (2nd prefers an untagged enemy); allies do not hit them');
