// VALORANT rule parity (Spike mode, server): survivor credits on a lost round, Shorty price, Spike detonation, Endgame round
// points, fall damage. Sources are cited next to each rule in src/spike.js / src/motor.cjs.
import assert from 'node:assert/strict';import {SpikeSimulation,survivorLoss} from './src/spike.js';import Motor from './src/motor.cjs';import kits from './src/kits.json' with {type:'json'};
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
{const {s,b}=mk();b.armor=50;b.hp=100;b.fallDrop=12;s.fall(b);assert.equal(b.hp,100-Motor.fallDamage(12));assert.equal(b.armor,50,'shields ignored');b.fallDrop=20;s.fall(b);assert.equal(b.alive,false,'fatal fall');assert(s.events.some(e=>e[0]==='k'&&e[1]===''&&e[2]===b.name&&e[4]==='Fall'),'kill feed: Fall, no killer');const u0=b.ability.ult;s.step(.05);assert.equal(b.ability.ult,u0,'fall damage death: no ult point (not killed by an enemy agent)');}
// 3. detonation (wiki.playvalorant.com/en-us/Spike; outer radius 3250 uu, valorant.gs/rules): kills everyone within 32.5 m, either team, no credit
{const {s,a,a2,b,b2}=mk();for(const u of [a,a2,b,b2]){u.y=0;u.credits=0;u.kills=0;}Object.assign(s.spike,{st:'plant',site:'A',x:0,y:0,z:0,t:.01,dt:0,carrier:null});
 [a.x,a.z]=[10,0];[a2.x,a2.z]=[40,0];[b.x,b.z]=[0,32];[b2.x,b2.z]=[0,33];s.deathUlts();const ua=a.ability.ult,ub=b.ability.ult;const k0=s.events.length;s.step(.05);
 assert.equal(a.alive,false,'attacker 10 m away dies too');assert.equal(b.alive,false,'defender at 32 m dies');assert.equal(a2.alive,true,'40 m: outside');assert.equal(b2.alive,true,'33 m: outside');
 const ks=s.events.slice(k0).filter(e=>e[0]==='k');assert.deepEqual(ks.map(e=>[e[1],e[2],e[4]]).sort(),[['',a.name,'Spike'],['',b.name,'Spike']].sort(),'kill feed: Spike, no killer');
 assert(s.units.every(u=>!u.kills),'no kill credit');assert.equal(a.deaths,0,'Spike death: no KDA death (wiki Spike, patch 1.11)');assert.equal(b.deaths,0,'Spike death: no KDA death');assert.equal(s.roundScores[s.atk],1,'attackers win');
 assert.equal(b.credits,1900,'dead defender: loss bonus');assert.equal(b2.credits,1000,'defender who outran the blast: 1000');assert.equal(a.credits,3000,'winners +3000, dead or alive');
 assert.equal(a.ability.ult,ua,'Spike death: no ult point (wiki Unrated: "killed by an enemy agent"; vlr.gg/645360)');assert.equal(b.ability.ult,ub,'Spike death: no ult point');}
// 4. Endgame round 25 (wiki.playvalorant.com/en-us/Unrated: 12-12 -> one Sudden Death round, 5000 credits each, same sides):
// ult points carry over - the Competitive Overtime rule ("set to being 3 short") does not apply to this Unrated mode
{const {s,a,b}=mk();a.ability.ult=2;b.ability.ult=99;s.round=23;s.roundDelay=0;s.newRound();assert.equal(a.ability.ult,2,'round 24: untouched');const atk=s.atk;
 s.newRound();assert.equal(s.round,25);assert.equal(a.ability.ult,2,'Endgame: ult points carried over');assert.equal(b.ability.ult,99,'Endgame: a full ult stays full');assert.equal(a.credits,5000);assert.equal(b.credits,5000);assert.equal(s.atk,atk,'Endgame: same sides');}
console.log('Parity rules: lost-round survivors 1000 (attacker without plant at time-out, defender after detonation), Shorty 300; fall damage 15 at 8 m to 100 at 17 m (health only); detonation kills within 32.5 m, no credit, no death ult point (nor for fall damage); Endgame round 25: 5000, same sides, ults carried over');
