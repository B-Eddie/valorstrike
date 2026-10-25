// VALORANT rule parity (Spike mode, server): survivor credits on a lost round, Shorty price, Spike detonation, overtime ult
// points, fall damage. Sources are cited next to each rule in src/spike.js / src/motor.cjs.
import assert from 'node:assert/strict';import {SpikeSimulation,survivorLoss} from './src/spike.js';
const W={map:{attacker:[0,0,0],defender:[0,0,-10],sites:{A:[0,0,0]}},nav:{nodes:[[0,0,0],[0,0,-10]],adj:[[1],[0]]},playable:[0,1],allowed:new Set([0,1]),near:(x,z)=>z<-5?1:0,ground:()=>0,blocked:()=>false,ray:()=>Infinity};
const mk=()=>{const s=new SpikeSimulation(W,'five','ascent',()=>.5),a=s.add('a','Sova'),a2=s.add('a2','Jett'),b=s.add('b','Sage'),b2=s.add('b2','Omen');s.start(false);a2.team=a.team;b.team=b2.team=1-a.team;s.atk=a.team;s.buy=0;return {s,a,a2,b,b2};};
// 1. economy: an attacker alive when time runs out (no plant) and a defender alive after the detonation get 1000, not the loss bonus
{const {s,a,a2}=mk();a2.alive=false;a.credits=a2.credits=0;s.finishRound(1-s.atk,'Time ran out');assert.equal(a.credits,1000,'surviving attacker, no plant');assert.equal(a2.credits,1900,'dead attacker keeps the loss bonus');}
{const {s,b,b2}=mk();b2.alive=false;b.credits=b2.credits=0;s.finishRound(s.atk,'Spike detonated');assert.equal(b.credits,1000,'defender alive after the detonation');assert.equal(b2.credits,1900);}
{const {s,b}=mk();b.credits=0;s.finishRound(s.atk,'Defenders eliminated');assert.equal(b.credits,1900);assert.equal(survivorLoss(s,{alive:true,team:1-s.atk},'Defenders eliminated'),false);}
{const {s,a}=mk();a.credits=800;assert.equal(s.command(a,{t:'buy',n:'Shorty'}),false,'buy phase over');s.buy=30;assert.equal(s.command(a,{t:'buy',n:'Shorty'}),true);assert.equal(a.credits,500,'Shorty costs 300');}
console.log('Parity rules: lost-round survivors 1000 (attacker without plant at time-out, defender after detonation), Shorty 300');
