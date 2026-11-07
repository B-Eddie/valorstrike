// Buy phase combat rule (user 2026-11-06, bug 4): as VALORANT, players may shoot and use abilities during the buy phase
// (held in spawn by the spawn walls), but nothing can hurt or debuff anyone before the round starts (SpikeSimulation.buySafe):
// bullets pass through, ability damage is skipped, debuffs are cleared; Omen's teleports stay locked; a used charge can be
// bought again; once the round starts the same shot hurts.
import assert from 'node:assert/strict';import {SpikeSimulation} from './src/spike.js';import {abilityDamage} from './src/abilities.js';
const W={map:{attacker:[0,0,0],defender:[0,0,-10],sites:{A:[0,0,0]}},nav:{nodes:[[0,0,0],[0,0,-10]],adj:[[1],[0]]},playable:[0,1],allowed:new Set([0,1]),near:(x,z)=>z<-5?1:0,ground:()=>0,blocked:()=>false,ray:()=>Infinity};
const mk=()=>{const s=new SpikeSimulation(W,'five','ascent',()=>.5),a=s.add('a','Jett'),b=s.add('b','Sage');s.start(false);b.team=1-a.team;s.atk=a.team;s.buy=20;
 a.weapon='Vandal';a.ammo=25;a.reserve=50;a.fireAt=0;a.equipAt=0;Object.assign(a,{x:0,y:0,z:0,look:0,pitch:0});Object.assign(b,{x:0,y:0,z:-3,look:Math.PI});return {s,a,b};};
const shoot=(s,a,n=6)=>{for(let i=0;i<n;i++){a.input={fire:true};a.inputAt=s.time;s.step(.05);}a.input={};};
{const {s,a,b}=mk();shoot(s,a);assert.ok(s.buy>0,'still the buy phase');assert.ok(a.ammo<25,'a human fires during the buy phase (ammo '+a.ammo+')');assert.equal(b.hp,100,'no bullet damage in the buy phase');assert.ok(b.alive);
 abilityDamage(s,a,b,80);assert.equal(b.hp,100,'no ability damage in the buy phase');
 b.blindUntil=s.time+2;b.slowUntil=s.time+2;b.concussUntil=s.time+2;b.detainUntil=s.time+2;s.step(.05);assert.ok(!(b.blindUntil>s.time)&&!(b.slowUntil>s.time)&&!(b.concussUntil>s.time)&&!(b.detainUntil>s.time),'debuffs cleared in the buy phase');
 // round start: the same shot hurts
 s.buy=.01;s.step(.05);assert.equal(s.buy,0);a.fireAt=0;a.ammo=25;shoot(s,a,4);assert.ok(b.hp<100,'after the buy phase the shot hurts (hp '+b.hp+')');}
{const {s,a}=mk();/* abilities in the buy phase: cast, then rebuy the used charge */a.credits=800;assert.equal(s.command(a,{t:'buy',n:'ab:c'}),true);assert.equal(a.ability.c,1);
 assert.equal(s.command(a,{t:'ab',k:'c'}),true,'Cloudburst cast in the buy phase');assert.equal(a.ability.c,0);assert.ok(s.effects.some(e=>e.kind==='smoke'||e.owner===a.id),'the smoke is out');
 a.ability.cool.c=0;assert.equal(s.command(a,{t:'buy',n:'ab:c'}),true,'a used charge is bought again');assert.equal(a.ability.c,1);assert.equal(a.credits,400);
 assert.equal(s.command(a,{t:'sell',n:'ab:c'}),true,'the rebought charge sells back');assert.equal(a.ability.c,0);assert.equal(a.credits,600);
 assert.equal(s.command(a,{t:'sell',n:'ab:c'}),false,'the charge used in the buy phase is not refunded');}
{const s=new SpikeSimulation(W,'five','ascent',()=>.5),o=s.add('o','Omen');s.add('e');s.start(false);s.buy=20;o.ability.c=1;o.ability.q=1;o.ability.ult=99;
 assert.equal(s.command(o,{t:'ab',k:'c'}),false,'Shrouded Step locked in the buy phase (no teleport past the spawn walls)');assert.equal(s.command(o,{t:'ab',k:'x',p:[0,0]}),false,'From the Shadows locked in the buy phase');
 assert.equal(s.command(o,{t:'ab',k:'q'}),true,'Paranoia usable in the buy phase');}
console.log('Buy phase combat: humans fire and cast in the buy phase, no damage / debuff before the round starts, the shot hurts after it; used charges rebuy (not refunded); Omen teleports locked');
