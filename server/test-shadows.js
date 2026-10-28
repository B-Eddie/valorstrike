// Omen From the Shadows (wiki.playvalorant.com/en-us/From_the_Shadows): "Total duration 4 s: 1.5-second windup, 2.5-second arrival at
// target location". After the windup Omen arrives as a Shade, "rooted in place, though he will still be able to rotate"; "enemy agents can
// shoot a bullet at him to cancel the teleport, returning Omen to his original position"; "Omen can cancel the teleport himself by re-casting
// the ability while he is a Shade" (ult points are lost either way, v1.0). Was: Omen walked freely for 4 s at the origin, then teleported.
import assert from 'node:assert/strict';import {SpikeSimulation} from './src/spike.js';import {tickAbilities,PARITY} from './src/abilities.js';
assert.equal(PARITY.shadows,4);assert.equal(PARITY.shadeAt,1.5,'1.5 s windup, then 2.5 s as a Shade');
const W={map:{attacker:[0,0,0],defender:[0,0,-30],sites:{A:[0,0,-30]}},nav:{nodes:[[0,0,0],[0,0,-30]],adj:[[1],[0]]},playable:[0,1],allowed:new Set([0,1]),near:(x,z)=>z<-15?1:0,ground:()=>0,blocked:()=>false,ray:()=>Infinity};
const setup=()=>{const s=new SpikeSimulation(W,'five','ascent',()=>.5),u=s.add('omen','Omen'),f=s.add('foe');s.start(false);s.buy=0;s.roundDelay=0;f.team=1-u.team;
 Object.assign(u,{x:0,y:0,z:0,look:0,pitch:0,alive:true});Object.assign(f,{x:0,y:0,z:-45,look:0,pitch:0,alive:true,hp:100,armor:0,protectedUntil:0,weapon:'Vandal',ammo:25,reserve:50,fireAt:0});u.ability.ult=7;return {s,u,f};};
const tick=(s,sec,step=.05)=>{for(let t=0;t<sec-1e-9;t+=step){s.time+=step;tickAbilities(s,step);}};
const walk=(s,u)=>{u.input={forward:1};u.inputAt=s.time;};
// 1. windup at the origin (rooted), Shade at the target (rooted) from 1.5 s, real at 4 s
{const {s,u}=setup();assert.equal(s.command(u,{t:'ab',k:'x',p:[0,-30]}),true);assert.equal(u.ability.ult,0);
 for(let i=0;i<25;i++){walk(s,u);u.x+=.1;tick(s,.05);}assert.deepEqual([u.x,u.z],[0,0],'windup: rooted at the origin');assert.equal(s.roundState(u).channel.kind,'shadows');assert.equal(s.roundState(u).channel.shade,false);
 const seq=u.seq;tick(s,.3);assert.deepEqual([u.x,u.z],[0,-30],'1.5 s: arrives as a Shade');assert.equal(u.seq,seq+1,'a teleport (seq) the client snaps to');assert.equal(s.roundState(u).channel.shade,true);
 assert.ok(Math.abs(s.roundState(u).channel.remaining-2.5)<.06,'2.5 s as a Shade');u.look=1.2;for(let i=0;i<20;i++){walk(s,u);u.x+=.1;tick(s,.05);}assert.deepEqual([u.x,u.z],[0,-30],'Shade: rooted');assert.equal(u.look,1.2,'Shade: can still turn');
 u.weapon='Classic';u.ammo=12;u.fireAt=0;assert.equal(s.fire(u),false,'no shots as a Shade');
 tick(s,1.6);assert.equal(u.pendingTeleport,null,'real at 4 s');assert.deepEqual([u.x,u.z],[0,-30]);walk(s,u);const x0=u.x;u.x+=.5;tick(s,.05);assert.ok(u.x!==x0,'free again');}
// 2. a bullet on the Shade cancels it: back to the origin, no damage, ult still spent
{const {s,u,f}=setup();assert.equal(s.command(u,{t:'ab',k:'x',p:[0,-30]}),true);tick(s,1.6);assert.deepEqual([u.x,u.z],[0,-30]);
 const e=[f.x,f.y+1.6,f.z],q=[u.x-e[0],u.y+1.2-e[1],u.z-e[2]],l=Math.hypot(...q);f.look=Math.atan2(-q[0],-q[2]);f.pitch=Math.asin(q[1]/l);const hp=u.hp,seq=u.seq;
 assert.equal(s.fire(f),true);assert.equal(u.hp,hp,'the Shade takes no damage');assert.deepEqual([u.x,u.y,u.z],[0,0,0],'shot: back where he cast it');assert.equal(u.pendingTeleport,null);assert.equal(u.seq,seq+1);assert.equal(u.ability.ult,0);assert.equal(s.roundState(u).channel,null,'channel over');}
// 3. recast X as a Shade: cancel, back to the origin; X during the windup does nothing
{const {s,u}=setup();assert.equal(s.command(u,{t:'ab',k:'x',p:[0,-30]}),true);tick(s,.5);assert.equal(s.command(u,{t:'ab',k:'x'}),false,'windup: no recast');
 tick(s,1.1);assert.equal(s.command(u,{t:'ab',k:'x'}),true,'Shade: X cancels');assert.deepEqual([u.x,u.z],[0,0]);assert.equal(u.pendingTeleport,null);assert.equal(u.ability.ult,0,'ult points lost (wiki v1.0)');}
// 4. killed in the windup: no teleport
{const {s,u}=setup();assert.equal(s.command(u,{t:'ab',k:'x',p:[0,-30]}),true);tick(s,.5);u.alive=false;tick(s,1.5);assert.equal(u.pendingTeleport,null);assert.deepEqual([u.x,u.z],[0,0]);}
console.log('From the Shadows: 1.5 s rooted windup, 2.5 s rooted Shade at the target (can turn, no shots), a bullet or an X recast sends him back with no damage, real at 4 s');
