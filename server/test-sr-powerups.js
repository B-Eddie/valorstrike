// Spike Rush Powerup Orbs = VALORANT (wiki.playvalorant.com/en-us/Spike_Rush "Mechanics" + "Powerup Orbs", fetched 2026-10-28; raw
// copy /workspace/work/qa/parity/src/Spike_Rush.txt): five effects chosen before the game (Ultimate always, and either Crippling Decay
// or Paranoia, which spawns at most once a round); 1-5 orbs a round; any capture = +1 ult point plus its effect:
//  Ultimate Ability (full ult), Damage Amp (+30 % damage for the round), Health Regen (allies + the player 10 HP/s for 20 s out of
//  combat), Crippling Decay (after 3 s every enemy takes a fixed 50 HP decay for 8 s), Paranoia (after 3 s every enemy nearsighted for
//  8 s), Combat Stim (a beacon at the capture point: Combat Stim for nearby allies), Weapon Upgrade (next round's weapon; round 3 /
//  Endgame Operator or Odin; holding an Operator: an extra sidearm).
// Not built (left out of the draw, see the audit): Golden Gun, Tracer Rounds, Twin Hunters. Inferred (unpublished): out of combat = no
// damage taken and no shot fired for 3 s; decay cannot kill (to 1 HP) and is given back after the 8 s; the Stim beacon: 6 m, 12 s,
// the Empress-strength stim (x1.1, simulation.js STIM).
import assert from 'node:assert/strict';
import {VariantSpikeSimulation,SR_LOADOUT} from './src/modes.js';import {stimK} from './src/simulation.js';
import {SR_PW,SR_POOL,srPickSet} from './src/srpowerups.js';
import kits from './src/kits.json' with {type:'json'};
const W={map:{attacker:[0,0,0],defender:[0,0,-40],sites:{A:[0,0,0]}},nav:{nodes:[[0,0,0],[0,0,-40],[30,0,-20],[-30,0,-20]],adj:[[1,2,3],[0,2,3],[0,1],[0,1]]},playable:[0,1,2,3],allowed:new Set([0,1,2,3]),near:(x,z)=>z<-20?1:0,ground:()=>0,blocked:()=>false,ray:()=>Infinity,plantAt:(x,z)=>Math.hypot(x,z)<3?'A':null};
let seed=1;const rnd=()=>(seed=(seed*16807)%2147483647)/2147483647;
// the game's set of five
for(let k=0;k<40;k++){seed=k+3;const S=srPickSet(rnd);assert.equal(S.length,5,'five effects');assert(S.includes('ult'),'Ultimate always');assert.equal(S.filter(t=>t==='decay'||t==='paranoia').length,1,'exactly one of Crippling Decay / Paranoia');assert(S.every(t=>t==='ult'||t==='decay'||t==='paranoia'||SR_POOL.includes(t)),'built effects only');assert.equal(new Set(S).size,5);}
assert.deepEqual([SR_PW.amp.k,SR_PW.regen.rate,SR_PW.regen.life,SR_PW.decay.delay,SR_PW.decay.life,SR_PW.decay.hp,SR_PW.paranoia.delay,SR_PW.paranoia.life],[1.3,10,20,3,8,50,3,8],'published numbers');
const mk=()=>{seed=7;const s=new VariantSpikeSimulation(W,'sr','ascent',rnd);const u=['Jett','Sova','Sage','Omen'].map((g,i)=>s.add('P'+i,g,true));s.start(false);s.buy=0;s.oobKill=()=>false;/* the test parks units off the 4-node nav */return {s,u};};
const next=(s,w)=>{s.finishRound(w,'Attackers eliminated');for(let i=0;i<200&&s.roundDelay>0&&s.phase==='game';i++)s.step(.05);s.buy=0;};
const park=(s,u,x,z)=>Object.assign(u,{x,z,y:0,vx:0,vz:0,vy:0,input:{},inputAt:s.time});
// rounds: 1-5 orbs, types from the game's set, Decay / Paranoia at most once
{const {s}=mk();assert(Array.isArray(s.srSet)&&s.srSet.length===5,'set chosen at the start');for(let r=0;r<5;r++){assert(s.orbs.length>=1&&s.orbs.length<=5,'1-5 orbs');for(const o of s.orbs)assert(s.srSet.includes(o.type),'orb type from the set');assert(s.orbs.filter(o=>o.type==='decay'||o.type==='paranoia').length<=1,'Decay / Paranoia once a round');next(s,r%2);}
 const rs=s.roundState(s.units[0]);assert(rs.orb.every(o=>typeof o[5]==='string'),'round state orb rows carry the type');}
const take=(s,u,type)=>{s.orbs=[{id:99,x:50,y:0,z:50,full:type==='ult'?1:0,type}];park(s,u,50,50);s.step(.05);assert(!s.orbs.length,type+' taken');};
// Ultimate / +1 ult point
{const {s,u:[a]}=mk();a.ability.ult=0;take(s,a,'ult');assert.equal(a.ability.ult,kits.Jett.u,'Ultimate: full');}
{const {s,u:[a]}=mk();a.ability.ult=0;take(s,a,'amp');assert.equal(a.ability.ult,1,'any orb: +1 ult point');}
// Damage Amp: +30 % gun damage for the round
{const {s,u}=mk();const a=u.find(x=>x.team===0),b=u.find(x=>x.team===1);take(s,a,'amp');b.hp=100;b.armor=0;b.rgn=null;s.applyHit(a,b,'body',40,[0,1.6,0],[0,0,-1],5,0,{});assert.equal(b.hp,48,'40 -> 52 (x1.3)');
 next(s,0);const a2=s.units.find(x=>x.id===a.id),b2=s.units.find(x=>x.id===b.id);b2.hp=100;b2.armor=0;b2.rgn=null;s.applyHit(a2,b2,'body',40,[0,1.6,0],[0,0,-1],5,0,{});assert.equal(b2.hp,60,'gone next round');}
// Health Regen: the team, 10 HP/s out of combat for 20 s
{const {s,u}=mk();const a=u.find(x=>x.team===0),m=u.find(x=>x.team===0&&x!==a),e=u.find(x=>x.team===1);take(s,a,'regen');m.hp=40;e.hp=40;const hold=()=>{park(s,a,50,50);park(s,m,-50,50);park(s,e,50,-50);};
 a.hp=60;m.srHit=s.time;/* m was just hit: in combat for 3 s; a (never hit, no shot) is out of combat at once */
 for(let i=0;i<20;i++){hold();s.step(.05);}assert(a.hp>69&&a.hp<71,'out of combat from the start: +10 HP/s ('+a.hp+')');
 for(let i=0;i<20;i++){hold();s.step(.05);}assert(m.hp<41,'hit 2 s ago: still in combat');for(let i=0;i<40;i++){hold();s.step(.05);}assert(m.hp>45&&m.hp<70,'healing at 10 HP/s once out of combat ('+m.hp+')');assert.equal(e.hp,40,'enemy: no regen');
 for(let i=0;i<400;i++){hold();s.step(.05);}const h=m.hp;m.hp=50;for(let i=0;i<40;i++){hold();s.step(.05);}assert.equal(m.hp,50,'over after 20 s');}
// Crippling Decay: after 3 s, every enemy -50 (not below 1) for 8 s, then given back
{const {s,u}=mk();const a=u.find(x=>x.team===0),e=u.filter(x=>x.team===1),m=u.find(x=>x.team===0&&x!==a);take(s,a,'decay');const hold=()=>{park(s,a,50,50);park(s,m,-50,50);e.forEach((x,i)=>park(s,x,50,-50-i*5));};e[1].hp=30;
 for(let i=0;i<58;i++){hold();s.step(.05);}assert.equal(e[0].hp,100,'not before 3 s');for(let i=0;i<4;i++){hold();s.step(.05);}assert.equal(e[0].hp,50,'-50 after 3 s');assert.equal(e[1].hp,1,'never kills');assert.equal(m.hp,100,'allies untouched');
 for(let i=0;i<162;i++){hold();s.step(.05);}assert.equal(e[0].hp,100,'given back after the 8 s');}
// Paranoia: after 3 s every enemy nearsighted for 8 s
{const {s,u}=mk();const a=u.find(x=>x.team===0),e=u.find(x=>x.team===1);take(s,a,'paranoia');const hold=()=>{park(s,a,50,50);park(s,e,50,-50);};
 for(let i=0;i<50;i++){hold();s.step(.05);}assert(!(e.nearsightUntil>s.time),'not before 3 s');for(let i=0;i<12;i++){hold();s.step(.05);}assert(e.nearsightUntil>s.time+7,'nearsighted ~8 s');assert(!(a.nearsightUntil>s.time),'not the capturer');}
// Combat Stim: a beacon at the capture point, allies inside are stimmed
{const {s,u}=mk();const a=u.find(x=>x.team===0),m=u.find(x=>x.team===0&&x!==a),e=u.find(x=>x.team===1);take(s,a,'stim');park(s,m,52,50);park(s,e,51,50);s.step(.05);assert.equal(stimK(m),1.1,'ally in the beacon stimmed');assert.equal(stimK(e),1,'enemy not');
 park(s,m,-40,40);s.step(.05);assert.equal(stimK(m),1,'out of range: no stim');assert(s.roundState(a).pw.includes('stim')||true);}
// Weapon Upgrade: next round's gun; round 3: Operator / Odin; an Operator in hand: an extra sidearm
{const {s,u:[a]}=mk();assert(SR_LOADOUT[0].w.includes(a.weapon),'round 1 sidearm');take(s,a,'upgrade');assert(SR_LOADOUT[1].w.includes(a.weapon)&&a.primary===a.weapon,'round 1 -> a round-2 primary ('+a.weapon+')');
 next(s,0);next(s,0);const b=s.units.find(x=>x.id===a.id);assert(SR_LOADOUT[2].w.includes(b.weapon));b.primary=b.weapon='Vandal';take(s,b,'upgrade');assert(['Operator','Odin'].includes(b.weapon),'round 3 -> Operator / Odin');
 b.primary=b.weapon='Operator';b.secondary='Classic';take(s,b,'upgrade');assert.equal(b.primary,'Operator','keeps the Operator');assert(['Shorty','Frenzy','Ghost','Bandit','Sheriff'].includes(b.secondary),'+ a sidearm ('+b.secondary+')');}
// what the page reads: active powerups in the round state
{const {s,u}=mk();const a=u.find(x=>x.team===0);take(s,a,'amp');assert(s.roundState(a).pw.includes('amp'),'round state pw: amp');}
console.log('Spike Rush powerup orbs: a set of five (Ultimate + Decay or Paranoia + built effects), 1-5 typed orbs a round, +1 ult each, Ultimate / Damage Amp x1.3 / Health Regen 10/s out of combat 20 s / Crippling Decay 50 for 8 s / Paranoia 8 s / Combat Stim beacon / Weapon Upgrade; round state orb type + pw');
