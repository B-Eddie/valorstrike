// TDM Recovery Orbs = VALORANT (wiki.playvalorant.com/en-us/Team_Deathmatch "Orbs", fetched 2026-10-28; raw copy
// /workspace/work/qa/parity/src/Team_Deathmatch.txt): "Recovery Orbs: Grants a 6-second buff that restores Health and Armor or
// Shield (not including the regeneration pool from Regen Shield) depending on the player's loadout. Each Recovery Orb respawns
// every 30 seconds"; players "run over" an orb, which also generates "a zone that allies can enter to also receive its effects".
// Real TDM rooms only (createSim('tdm')); spots are map callouts (TDM_REC_SPOTS; Riot's TDM maps are not in the game).
import assert from 'node:assert/strict';import fs from 'node:fs';
import {createSim} from './src/modes.js';import {Simulation,tdmArmor} from './src/simulation.js';
import {TDM_REC,TDM_REC_SPOTS} from './src/tdmorbs.js';
const root=new URL('..',import.meta.url).pathname;
// every spot is a callout of the real map
for(const [m,names] of Object.entries(TDM_REC_SPOTS)){const calls=JSON.parse(fs.readFileSync(root+'server/public/worlds/'+m+'/map.json','utf8')).callouts.map(c=>c.name);
 assert(names.length>=3,m+': several recovery orbs');for(const n of names)assert(calls.includes(n),m+': callout '+n);}
assert.deepEqual([TDM_REC.buff,TDM_REC.respawn],[6,30],'6 s buff, 30 s respawn');
// fixture: Ascent's spot names on a flat line
const names=TDM_REC_SPOTS.ascent,calls=names.map((name,i)=>({name,position:[20+i*10,0,0]}));
const nodes=[[0,0,0],[0,0,-10],...calls.map(c=>c.position)];
const W={map:{attacker:[0,0,0],defender:[0,0,-10],sites:{A:[0,0,0]},callouts:calls},nav:{nodes,adj:nodes.map((_,i)=>i?[0]:nodes.map((_,j)=>j).filter(j=>j))},playable:nodes.map((_,i)=>i),allowed:new Set(nodes.map((_,i)=>i)),
 near:(x,z)=>{let b=0,d=1e9;nodes.forEach((p,i)=>{const e=Math.hypot(p[0]-x,p[2]-z);if(e<d){d=e;b=i;}});return b;},ground:()=>0,blocked:()=>false,ray:()=>Infinity};
const room=()=>{const s=createSim(W,'tdm','ascent',()=>.5);const p=s.add('p','Jett',true,0),a=s.add('a','Sage',true,0),e=s.add('e','Omen',true,1);s.start(false);s.step(.05);return {s,p,a,e};};
const park=(s,u,x,z)=>Object.assign(u,{x,z,y:0,vx:0,vz:0,vy:0,input:{},inputAt:s.time});
{const {s,p,a,e}=room();
 assert.equal(s.recOrbs.length,names.length,'one orb per spot');
 let snap=s.snapshot();assert(Array.isArray(snap.tro)&&snap.tro.length===names.length,'snapshot tro rows');assert.deepEqual(snap.tro[0].slice(0,4),[0,20,0,0]);
 // a full-health player walks over it: nothing taken (it stays for a hurt one)
 park(s,p,20,0);park(s,a,0,0);park(s,e,0,-10);s.step(.05);assert.equal(s.recOrbs[0].readyAt<=s.time,true,'not taken at full health');
 // hurt: taken, 6 s buff restores health and the loadout's armour (Stage 1 Classic: Regen Shield 25, pool untouched)
 const cap=tdmArmor(0,p.weapon).a;p.hp=30;p.armor=0;const pool=p.rgn;park(s,p,20,0);s.step(.05);
 assert(s.recOrbs[0].readyAt>s.time+29,'taken: respawns in 30 s');assert(p.recUntil>s.time+5.8,'6 s buff');
 for(let t=0;t<3;t+=.05){park(s,p,0,1);s.step(.05);}assert(p.hp>55&&p.hp<90,'half the buff: about half the missing health back ('+p.hp+')');
 for(let t=0;t<3.2;t+=.05){park(s,p,0,1);s.step(.05);}assert.equal(p.hp,100,'restored to 100');assert.equal(p.armor,cap,'armour restored to the loadout cap');assert(p.rgn<=pool,'Regen Shield pool not refilled by the orb');
 const h=p.hp;p.hp=40;for(let t=0;t<1;t+=.05){park(s,p,0,1);s.step(.05);}assert.equal(p.hp,40,'buff over after 6 s');
 // the zone: an ally standing in it is restored too, an enemy is not
 a.hp=20;e.hp=20;park(s,a,30,0);park(s,e,30.5,0);p.hp=50;park(s,p,30,0);s.step(.05);assert(s.recOrbs[1].readyAt>s.time,'second orb taken');
 for(let t=0;t<2;t+=.05){park(s,p,0,1);park(s,a,30,1);park(s,e,30.5,0);s.step(.05);}assert(a.hp>20,'ally in the zone restored');assert.equal(e.hp,20,'enemy in the zone not');
 snap=s.snapshot();assert(Array.isArray(snap.trz)&&snap.trz.length===1&&snap.trz[0][4]===0,'snapshot zone row (team 0)');
 // 30 s later the orb is back
 for(let t=0;t<30;t+=.05){park(s,p,0,1);park(s,a,1,0);park(s,e,0,-10);s.step(.05);}assert(s.recOrbs[0].readyAt<=s.time,'respawned after 30 s');}
// Deathmatch and bare TDM fixtures: none
{const s=createSim(W,'dm','ascent',()=>.5);s.add('p','Jett',true);s.start(false);s.step(.05);assert(!s.recOrbs?.length&&!('tro' in s.snapshot()),'DM: no recovery orbs');}
{const s=new Simulation(W,'tdm','ascent',()=>.5);s.add('p','Jett',true);s.start(false);s.step(.05);assert(!s.recOrbs?.length,'bare TDM fixture: none');}
console.log('TDM Recovery Orbs: one per callout spot, run over when hurt, 6 s buff to 100 HP + loadout armour (no Regen pool), zone for allies only, back after 30 s, snapshot tro / trz; DM none');
