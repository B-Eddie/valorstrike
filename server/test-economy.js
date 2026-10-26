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
// 5. Endgame / Sudden Death (wiki.playvalorant.com/en-us/Unrated): 12-12 -> round 25 on the same sides with 5000 each; its
// winner wins the match 13-12 (no win-by-two Overtime: that is Competitive, patch 1.03 "Unrated will still use ... Sudden Death")
{const {s,a,b}=mk();let atk24;for(let i=0;i<24;i++){if(i===23)atk24=s.atk;s.finishRound(i%2?a.team:b.team,'QA');next(s);}assert.equal(s.round,25);assert.deepEqual(s.roundScores,[12,12]);assert.equal(s.atk,atk24,'Endgame keeps the second-half sides');for(const u of s.units)assert.equal(u.credits,5000);assert.deepEqual(s.losses,[0,0]);
 s.finishRound(a.team,'QA');for(let i=0;i<200&&s.phase==='game';i++)s.step(.05);assert.equal(s.phase,'post','13-12 after the Endgame round ends the match');assert.equal(s.round,25,'no round 26');assert.equal(s.scores[a.team],13);}
// 6. A Phoenix killed inside Run It Back is no kill and no death in VALORANT (r/VALORANT: "When u kill clove it counts as a kill,
// she gets a death and the killer gets an ulti charge. If you kill phoenix' ulti none of that happens"); the Reyna soul orb
// still spawns (patch 1.02). Gun kill and ability kill: no kill / death count, no ult point either side; the 200 kill credits are
// kept (no source withholds them); the
// kill feed still shows it; Phoenix comes back. A Jett's Blade Storm still refreshes on it (patch 1.02).
import {abilityDamage} from './src/abilities.js';
for(const how of ['gun','ability']){const s=new SpikeSimulation(W,'five','ascent',()=>.5),r=s.add('r','Reyna'),p=s.add('p','Phoenix');s.start(false);s.buy=0;p.team=1-r.team;s.atk=r.team;s.add('x','Sage').team=r.team;s.add('y','Sage').team=p.team;
 Object.assign(r,{x:0,y:0,z:0,look:0,pitch:Math.atan2(1.2-1.6,8),weapon:'Vandal',ammo:25,fireAt:0,triggerHeld:false,input:{},inventory:{Vandal:25}});Object.assign(p,{x:0,y:0,z:-8,armor:0,protectedUntil:0});
 p.ability.ult=9;assert.equal(s.command(p,{t:'ab',k:'x'}),true,'Run It Back cast');p.hp=1;const k0=[r.kills,p.deaths,r.credits,r.ability.ult,p.ability.ult,s.scores[r.team]||0],ev=s.events.length;
 if(how==='gun')assert(s.fire(r));else abilityDamage(s,r,p,50);assert(!p.alive,how+': killed inside Run It Back');
 assert(s.events.slice(ev).some(e=>e[0]==='k'&&e[2]==='p'),how+': kill feed shows it');assert(s.effects.some(e=>e.kind==='soul'&&e.owner===r.id),how+': Reyna soul orb still spawns');
 for(let i=0;i<4;i++)s.step(.05);assert(p.alive&&p.hp===100,how+': Phoenix back at the mark');
 assert.deepEqual([r.kills,p.deaths,r.credits,r.ability.ult,p.ability.ult,s.scores[r.team]||0],[k0[0],k0[1],k0[2]+200,k0[3],k0[4],k0[5]],how+': no kill, death, ult point or score; kill credits kept');
 // the second, real death counts as usual
 p.hp=1;Object.assign(p,{x:0,y:0,z:-8,protectedUntil:0,invulnerableUntil:0});Object.assign(r,{fireAt:0,triggerHeld:false,spray:null,look:0,pitch:Math.atan2(1.2-1.6,8)});if(how==='gun')s.fire(r);else abilityDamage(s,r,p,50);assert(!p.alive);s.step(.05);
 assert.deepEqual([r.kills-k0[0],p.deaths-k0[1],(r.credits-k0[2]-200)%3000,r.ability.ult-k0[3],p.ability.ult-k0[4]],[1,1,200,1,1],how+': the real death after it counts (credits: kill 200, plus the round win)');}
{const s=new SpikeSimulation(W,'five','ascent',()=>.5),j=s.add('j','Jett'),p=s.add('p','Phoenix');s.start(false);s.buy=0;p.team=1-j.team;s.atk=j.team;s.add('x','Sage').team=j.team;s.add('y','Sage').team=p.team;
 Object.assign(j,{x:0,y:0,z:0,look:0,pitch:Math.atan2(1.2-1.6,8),fireAt:0,triggerHeld:false,input:{}});Object.assign(p,{x:0,y:0,z:-8,armor:0,protectedUntil:0,hp:1});p.ability.ult=9;s.command(p,{t:'ab',k:'x'});p.hp=1;
 Object.assign(j.ability,{blades:3,bladesActive:true});assert(s.fireBlade(j));assert(!p.alive,'blade kill inside Run It Back');assert.equal(j.ability.blades,5,'Blade Storm refreshes on a Run It Back kill');assert.equal(j.kills,0);}
// 7. The death ult point is for a death to an enemy only: a fall out of the map and a teamkill (friendly-fire utility) give none.
import {abilityDamage as abDmg} from './src/abilities.js';
{const s=new SpikeSimulation(W,'five','ascent',()=>.5),a=s.add('a','Raze'),m=s.add('m','Sage'),f=s.add('f','Sova');s.start(false);s.buy=0;m.team=a.team;f.team=1-a.team;s.add('g','Sage').team=f.team;
 {/* out of the world: the fall branch (y < -20 or a non-finite position; the motor floor keeps a test body above -20) */const t=new SpikeSimulation(W,'five','ascent',()=>.5),q=t.add('q','Sage');t.add('r','Sova');t.add('r2','Sage').team=q.team;t.start(false);t.buy=0;const u0=q.ability.ult;q.y=NaN;t.step(.05);assert(!q.alive&&q.deaths===1,'fell out of the map');t.step(.05);assert.equal(q.ability.ult,u0,'no ult point for a fall');}
 const v=s.add('v','Sage');v.team=a.team;Object.assign(v,{alive:true,hp:10,armor:0,invulnerableUntil:0});const u1=v.ability.ult;s.fxSrc={team:a.team,owner:a.id,ag:'Raze'};abDmg(s,a,v,75);s.fxSrc=null;assert(!v.alive,'teamkilled');s.step(.05);assert.equal(v.ability.ult,u1,'no ult point for a teamkill');
 Object.assign(f,{alive:true,hp:10,armor:0,invulnerableUntil:0});const u2=f.ability.ult;abDmg(s,a,f,75);assert(!f.alive);s.step(.05);assert.equal(f.ability.ult,u2+1,'killed by an enemy: +1');}
console.log('Economy: loss streak 1900/2400/2900 (reset by a win and at half), win 3000, cap 9000, half-time 800 + ult reset, kill 200, plant 300 to every attacker, Endgame round 25 5000 (same sides, 13-12 wins); ult points for kill, death to an enemy (once; not falls / teamkills), plant (planter only) and defuse; a Phoenix killed inside Run It Back is no kill / death / ult point (credits, soul orb, Blade Storm refresh and kill feed kept)');
