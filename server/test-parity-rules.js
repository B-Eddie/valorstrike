// VALORANT rule parity (Spike mode, server): survivor credits on a lost round, Shorty price, Spike detonation, overtime ult
// points, fall damage. Sources are cited next to each rule in src/spike.js / src/motor.cjs.
import assert from 'node:assert/strict';import {SpikeSimulation,survivorLoss} from './src/spike.js';import Motor from './src/motor.cjs';
const W={map:{attacker:[0,0,0],defender:[0,0,-10],sites:{A:[0,0,0]}},nav:{nodes:[[0,0,0],[0,0,-10]],adj:[[1],[0]]},playable:[0,1],allowed:new Set([0,1]),near:(x,z)=>z<-5?1:0,ground:()=>0,blocked:()=>false,ray:()=>Infinity};
const mk=()=>{const s=new SpikeSimulation(W,'five','ascent',()=>.5),a=s.add('a','Sova'),a2=s.add('a2','Jett'),b=s.add('b','Sage'),b2=s.add('b2','Omen');s.start(false);a2.team=a.team;b.team=b2.team=1-a.team;s.atk=a.team;s.buy=0;return {s,a,a2,b,b2};};
// 1. economy: an attacker alive when time runs out (no plant) and a defender alive after the detonation get 1000, not the loss bonus
{const {s,a,a2}=mk();a2.alive=false;a.credits=a2.credits=0;s.finishRound(1-s.atk,'Time ran out');assert.equal(a.credits,1000,'surviving attacker, no plant');assert.equal(a2.credits,1900,'dead attacker keeps the loss bonus');}
{const {s,b,b2}=mk();b2.alive=false;b.credits=b2.credits=0;s.finishRound(s.atk,'Spike detonated');assert.equal(b.credits,1000,'defender alive after the detonation');assert.equal(b2.credits,1900);}
{const {s,b}=mk();b.credits=0;s.finishRound(s.atk,'Defenders eliminated');assert.equal(b.credits,1900);assert.equal(survivorLoss(s,{alive:true,team:1-s.atk},'Defenders eliminated'),false);}
{const {s,a}=mk();a.credits=800;assert.equal(s.command(a,{t:'buy',n:'Shorty'}),false,'buy phase over');s.buy=30;assert.equal(s.command(a,{t:'buy',n:'Shorty'}),true);assert.equal(a.credits,500,'Shorty costs 300');}
// 2. fall damage (wiki.playvalorant.com/en-us/Unrated#Fall_damage): ~8 m deals 15, ~17 m the fatal 100; health only
assert.equal(Motor.fallDamage(7.9),0);assert.equal(Motor.fallDamage(8),15);assert.equal(Motor.fallDamage(17),100);assert.equal(Motor.fallDamage(30),100);
{const flat={ground:()=>0,blocked:()=>false};const drop=h=>{const P={x:0,y:h,z:0,vx:0,vz:0,vy:0,air:true};let r,n=0;do{r=Motor.step(P,{x:0,z:0,speed:6.75},1/64,flat);}while(!r.landed&&++n<2000);return P.fallDrop;};
 assert(Math.abs(drop(3)-3)<.05,'3 m drop measured');assert.equal(Motor.fallDamage(drop(3)),0,'3 m: no damage');assert.equal(Motor.fallDamage(drop(12)),Motor.fallDamage(12),'12 m');
 const P={x:0,y:0,z:0,vx:0,vz:0,vy:0};for(let i=0;i<200;i++){const r=Motor.step(P,{x:0,z:0,jump:i===0,speed:6.75},1/64,flat);if(i>0&&r.landed)break;}assert(P.fallDrop>1.1&&P.fallDrop<1.25,'a jump on flat ground lands from its ~1.17 m apex ('+P.fallDrop+')');assert.equal(Motor.fallDamage(P.fallDrop||0),0);
 const T={x:0,y:20,z:0,vx:0,vz:0,vy:0,air:true};Motor.step(T,{x:0,z:0,speed:6.75},1/64,flat);T.y=1;T.vy=0;let r;do{r=Motor.step(T,{x:0,z:0,speed:6.75},1/64,flat);}while(!r.landed);assert(T.fallDrop<1.1,'a teleport mid-air restarts the fall height');}
{const {s,b}=mk();b.armor=50;b.hp=100;b.fallDrop=12;s.fall(b);assert.equal(b.hp,100-Motor.fallDamage(12));assert.equal(b.armor,50,'shields ignored');b.fallDrop=20;s.fall(b);assert.equal(b.alive,false,'fatal fall');assert(s.events.some(e=>e[0]==='k'&&e[1]===''&&e[2]===b.name&&e[4]==='Fall'),'kill feed: Fall, no killer');}
console.log('Parity rules: lost-round survivors 1000 (attacker without plant at time-out, defender after detonation), Shorty 300; fall damage 15 at 8 m to 100 at 17 m (health only)');
