// TDM Ultimate Orbs = VALORANT (wiki.playvalorant.com/en-us/Team_Deathmatch "Orbs" and /en-us/Orbs, fetched 2026-10-28): "Ultimate
// Orbs: Grants 10 points towards the player's ultimate charge"; "All Ultimate Orbs spawn onto the map together periodically"; "a map
// spawns several ultimate orbs at fixed timing and placements that players can come in contact with to gain 10 points to their
// ultimate charge for themselves and by generating a zone that allies can enter to also receive the same amount of ultimate charge";
// no channelling (contact). Inferred (unpublished, noted in the audit): the wave timing (first at 30 s, then every 60 s), the spots
// (the Unrated orb callouts, ultorbs.js ORB_SPOTS: two per map), zone 3 m / 6 s like the Recovery Orb's, each ally once per zone.
import assert from 'node:assert/strict';
import {createSim} from './src/modes.js';import {Simulation} from './src/simulation.js';
import {TDM_UO} from './src/tdmorbs.js';import {ORB_SPOTS} from './src/ultorbs.js';
assert.deepEqual([TDM_UO.pts,TDM_UO.first,TDM_UO.every],[10,30,60],'10 points; waves at 30 s then every 60 s (inferred timing)');
const names=ORB_SPOTS.ascent,calls=names.map((name,i)=>({name,position:[20+i*10,0,0]}));
const nodes=[[0,0,0],[0,0,-40],...calls.map(c=>c.position)];
const W={map:{attacker:[0,0,0],defender:[0,0,-40],sites:{A:[0,0,0]},callouts:calls},nav:{nodes,adj:nodes.map((_,i)=>i?[0]:nodes.map((_,j)=>j).filter(j=>j))},playable:nodes.map((_,i)=>i),allowed:new Set(nodes.map((_,i)=>i)),
 near:(x,z)=>{let b=0,d=1e9;nodes.forEach((p,i)=>{const e=Math.hypot(p[0]-x,p[2]-z);if(e<d){d=e;b=i;}});return b;},ground:()=>0,blocked:()=>false,ray:()=>Infinity};
const s=createSim(W,'tdm','ascent',()=>.5);const p=s.add('p','Jett',true,0),a=s.add('a','Sage',true,0),e=s.add('e','Omen',true,1);s.start(false);
const park=(u,x,z)=>Object.assign(u,{x,z,y:0,vx:0,vz:0,vy:0,input:{},inputAt:s.time});
const hold=()=>{park(p,0,1);park(a,0,2);park(e,0,-40);};
const run=sec=>{for(let t=0;t<sec-1e-9;t+=.05){hold();s.step(.05);}};
run(29);assert.equal((s.snapshot().tuo||[]).filter(r=>r[4]===1).length,0,'no ult orbs before the first wave');
run(1.2);let rows=s.snapshot().tuo;assert.equal(rows.filter(r=>r[4]===1).length,names.length,'the first wave: every orb up together (snapshot tuo)');
assert.deepEqual(rows[0].slice(0,4),[0,20,0,0],'orb on the callout');
// contact: +10 for the player (no channel, no Use key), an ally zone; the enemy gets nothing from it
park(p,20,0);park(a,0,2);park(e,0,-40);s.step(.05);assert.equal(p.ability.tp,10,'+10 points on contact');assert.equal(s.snapshot().tuo[0][4],0,'taken');
const z=s.snapshot().tuz;assert(Array.isArray(z)&&z.length===1&&z[0][4]===0,'ally zone row (team 0)');
park(p,0,1);park(a,20.5,0);park(e,21,0);s.step(.05);assert.equal(a.ability.tp,10,'an ally entering the zone: +10');assert.equal(e.ability.tp,0,'enemy: nothing');
park(a,20.5,0);s.step(.05);assert.equal(a.ability.tp,10,'once per zone');
// the second orb waits for its taker; the next wave brings the taken one back
run(60);rows=s.snapshot().tuo;assert.equal(rows.filter(r=>r[4]===1).length,names.length,'next wave 60 s later: all up again');
// kills + orbs together reach the TDM cost (Jett 60)
p.kills+=10;s.step(.05);assert.equal(p.ability.tp,40);park(p,20,0);s.step(.05);park(p,30,0);s.step(.05);assert.equal(p.ability.tp,60,'kills 30 + orbs 30 = 60');assert.equal(p.ability.ult,8,'Blade Storm ready');
// DM / bare fixtures: none
{const d=createSim(W,'dm','ascent',()=>.5);d.add('p','Jett',true);d.start(false);for(let i=0;i<700;i++)d.step(.05);assert(!('tuo' in d.snapshot()),'DM: no TDM ult orbs');}
{const b=new Simulation(W,'tdm','ascent',()=>.5);b.add('p','Jett',true);b.start(false);for(let i=0;i<700;i++)b.step(.05);assert(!('tuo' in b.snapshot()),'bare fixture: none');}
console.log('TDM Ultimate Orbs: waves at 30 s then every 60 s (all together, inferred timing) on the Unrated orb callouts, contact = +10 points, ally zone +10 once each, enemies nothing; snapshot tuo / tuz; DM none');
