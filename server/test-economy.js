// Round economy and ult points (Spike mode), against VALORANT's rules: round win 3000, loss 1900 / 2400 / 2900 (streak
// capped, reset by a win and at half-time), kill 200, plant 300 to every attacker (dead ones too), 9000 cap, half-time 800
// and loss streaks / ult points reset, overtime 5000 a round. Ult points: +1 per kill, per death, for the planter and for
// the defuser (the server only counted kills; the offline page counts all four).
import assert from 'node:assert/strict';import {SpikeSimulation} from './src/spike.js';
const W={map:{attacker:[0,0,0],defender:[0,0,-10],sites:{A:[0,0,0]}},nav:{nodes:[[0,0,0],[0,0,-10]],adj:[[1],[0]]},playable:[0,1],allowed:new Set([0,1]),near:(x,z)=>z<-5?1:0,ground:()=>0,blocked:()=>false,ray:()=>Infinity};
const mk=()=>{const s=new SpikeSimulation(W,'five','ascent',()=>.5),a=s.add('a','Sova'),a2=s.add('a2','Jett'),b=s.add('b','Sage');s.start(false);a2.team=a.team;b.team=1-a.team;s.atk=a.team;s.buy=0;return {s,a,a2,b};};
const next=s=>{const r=s.round;for(let i=0;i<200&&s.round===r;i++)s.step(.05);assert(s.round>r,'next round');s.buy=0;};
// 1. loss streak 1900 / 2400 / 2900 / 2900, reset by a win; win 3000; 9000 cap
{const {s,a,b}=mk();const seq=[];for(let i=0;i<4;i++){b.credits=0;const c=b.credits;s.finishRound(a.team,'QA');seq.push(b.credits-c);next(s);}assert.deepEqual(seq,[1900,2400,2900,2900]);
 let c=b.credits;s.finishRound(b.team,'QA');assert.equal(b.credits,Math.min(9000,c+3000));next(s);b.credits=0;s.finishRound(a.team,'QA');assert.equal(b.credits,1900,'a win resets the streak');next(s);
 b.credits=8000;s.finishRound(b.team,'QA');assert.equal(b.credits,9000,'cap');}
// 2. half-time (round 13): 800 credits, loss streaks and ult points reset, guns and armor gone; ults kept between rounds before that
{const {s,a,b}=mk();a.ability.ult=3;for(let i=0;i<12;i++){s.finishRound(b.team,'QA');next(s);if(s.round<13)assert.equal(a.ability.ult>=3,true,'ult points carry over round '+s.round);}
 assert.equal(s.round,13);for(const u of s.units){assert.equal(u.credits,800);assert.equal(u.ability.ult,0,'ult reset at half');assert.equal(u.primary,null);assert.equal(u.armor,0);}assert.deepEqual(s.losses,[0,0]);
 const c=a.credits;s.finishRound(b.team,'QA');assert.equal(a.credits-c,1900,'first loss after the half is 1900');}
// 3. kill: +200 and +1 ult to the killer, +1 ult to the victim
{const {s,a,b}=mk();Object.assign(a,{x:0,y:0,z:0,look:0,pitch:0,weapon:'Vandal',ammo:25,fireAt:0,triggerHeld:false,input:{},inventory:{Vandal:25}});Object.assign(b,{x:0,y:0,z:-8,hp:1,armor:0,protectedUntil:0});a.pitch=Math.atan2(1.2-1.6,8);
 const c=a.credits,ua=a.ability.ult,ub=b.ability.ult;assert(s.fire(a));assert(!b.alive,'killed');assert.equal(a.credits-c,200);assert.equal(a.ability.ult,ua+1,'killer +1');s.step(.05);assert.equal(b.ability.ult,ub+1,'victim +1 for dying');s.step(.05);assert.equal(b.ability.ult,ub+1,'once per death');}
// 4. plant: +300 to every attacker (also a dead one), +1 ult to the planter only; defuse: +1 ult to the defuser; a
// defuse taken over by a second defender drops to the half checkpoint
{const {s,a,a2,b}=mk();a2.alive=false;a2.hp=0;const c=[a.credits,a2.credits],u0=[a.ability.ult,a2.ability.ult];Object.assign(a,{x:0,y:0,z:0,input:{interact:true}});s.spike.carrier=a.id;
 for(let i=0;i<82&&s.spike.st!=='plant';i++){a.inputAt=s.time;s.step(.05);}assert.equal(s.spike.st,'plant');assert.deepEqual([a.credits-c[0],a2.credits-c[1]],[300,300]);assert.equal(a.ability.ult,u0[0]+1,'planter +1');assert.equal(a2.ability.ult,u0[1],'only the planter');
 a.input={};Object.assign(b,{x:0,y:0,z:0,input:{interact:true}});const ub=b.ability.ult;for(let i=0;i<150&&s.roundDelay<=0;i++){b.inputAt=s.time;s.step(.05);}assert.equal(s.roundScores[b.team],1,'defused');assert.equal(b.ability.ult,ub+1,'defuser +1');}
// 5. overtime: 5000 every round from round 25, sides swap each round
{const {s,a,b}=mk();for(let i=0;i<24;i++){s.finishRound(i%2?a.team:b.team,'QA');next(s);}assert.equal(s.round,25);for(const u of s.units)assert.equal(u.credits,5000);const atk=s.atk;s.finishRound(a.team,'QA');next(s);assert.equal(s.atk,1-atk);for(const u of s.units)assert.equal(u.credits,5000);}
console.log('Economy: loss streak 1900/2400/2900 (reset by a win and at half), win 3000, cap 9000, half-time 800 + ult reset, kill 200, plant 300 to every attacker, overtime 5000; ult points for kill, death (once), plant (planter only) and defuse');
