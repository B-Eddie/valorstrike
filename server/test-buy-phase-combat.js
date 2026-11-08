// Buy phase rules (the owner, 2026-11-07: the actual VALORANT buy phase; supersedes the 2026-11-06 universal ability allowance):
// players shoot inside the spawn walls on their real ammo, but nothing hurts or debuffs anyone before the round starts
// (SpikeSimulation.buySafe). Only the VALORANT buy-phase setup abilities cast (abilities.js BUY_PHASE; placement-only ones never
// activate); credits are spent at purchase; a used charge cannot be bought back past the round's maximum (and buy / sell never
// makes a charge: Riot 13.01's buy-resell duplication); cooldowns start when the round starts; once the round starts the shot hurts.
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

const {BUY_PHASE}=await import('./src/abilities.js');import kits from './src/kits.json' with {type:'json'};
const mkA=(ag)=>{const s=new SpikeSimulation(W,'five','ascent',()=>.5),u=s.add('u',ag),e=s.add('e','Sage');s.start(false);e.team=1-u.team;s.atk=u.team;s.buy=20;Object.assign(u,{x:0,y:0,z:0,look:0,pitch:0,credits:4000});Object.assign(e,{x:0,y:0,z:-30});return {s,u};};
const full=u=>{const K=kits[u.agent];u.ability.c=K.mx.c||1;u.ability.q=K.mx.q||1;u.ability.e=Math.max(1,K.mx.e||1);u.ability.ult=99;u.ability.cool={};u.ability.used={c:0,q:0,e:0};};
// 1. every agent: a key not in BUY_PHASE is refused with its charge kept (all ultimates but Chamber's; Hush / Miks unchanged)
{let refused=0;for(const ag of Object.keys(kits)){for(const k of ['c','q','e','x']){const {s,u}=mkA(ag);full(u);const a0={...u.ability,used:undefined,cool:undefined};
  const ok=(BUY_PHASE[ag]||'').includes(k),r=s.command(u,{t:'ab',k,p:[0,-5]});
  if(!ok){assert.equal(r,false,ag+' '+k+' must not cast in the buy phase');for(const c of ['c','q','e','ult'])assert.equal(u.ability[c],a0[c],ag+' '+k+' refused: '+c+' kept');assert.ok(!u.pendingTeleport,ag+' '+k+' no teleport');refused++;}}}
 assert.equal(refused,88,'refused '+refused);}
assert.deepEqual(Object.keys(BUY_PHASE).sort(),['Astra','Chamber','Cypher','Deadlock','Hush','Jett','Killjoy','Miks','Neon','Omen','Raze','Sage','Viper','Vyse','Yoru']);
// 2. the allowed ones cast: Jett Updraft, Omen Shrouded Step, Sage Healing Orb, Raze Blast Pack, Deadlock Sonic Sensor, Chamber's kit, Killjoy / Cypher setups
for(const [ag,k,pre] of [['Jett','q'],['Omen','c',u=>{u.z=5;}],['Sage','e',u=>{u.hp=60;}],['Raze','q'],['Deadlock','q'],['Chamber','c'],['Chamber','q'],['Chamber','e'],['Killjoy','q'],['Killjoy','e'],['Killjoy','c'],['Cypher','c'],['Cypher','q'],['Cypher','e'],['Vyse','q'],['Vyse','c'],['Vyse','e'],['Viper','q'],['Viper','e'],['Yoru','c'],['Yoru','e'],['Neon','e']]){const {s,u}=mkA(ag);full(u);if(pre)pre(u);assert.equal(s.command(u,{t:'ab',k}),true,ag+' '+k+' casts in the buy phase');}
// 3. Jett: credits at purchase, Updraft cast, no rebuy past the round's 1, nothing to sell back
{const {s,u}=mkA('Jett');u.credits=800;u.ability.q=0;assert.equal(s.command(u,{t:'buy',n:'ab:q'}),true);assert.equal(u.credits,650,'credits spent at purchase');
 assert.equal(s.command(u,{t:'ab',k:'q'}),true,'Updraft in the buy phase');assert.equal(u.credits,650,'nothing charged at cast');assert.equal(u.ability.q,0);
 u.ability.cool.q=0;assert.equal(s.command(u,{t:'buy',n:'ab:q'}),false,'used Updraft cannot be bought back (round max 1)');assert.equal(u.credits,650);
 assert.equal(s.command(u,{t:'sell',n:'ab:q'}),false,'the charge used in the buy phase is not refunded');
 assert.equal(s.command(u,{t:'ab',k:'c'}),false,'Cloudburst is not a buy-phase ability');}
// 4. buy / resell never makes a charge (Riot 13.01): Cypher Trapwire max 2
{const {s,u}=mkA('Cypher');u.credits=1000;u.ability.c=0;const buy=()=>s.command(u,{t:'buy',n:'ab:c'}),sell=()=>s.command(u,{t:'sell',n:'ab:c'}),cast=()=>{u.ability.cool.c=0;return s.command(u,{t:'ab',k:'c'});};
 assert.ok(buy()&&buy());assert.equal(buy(),false,'max 2');assert.equal(u.credits,600);assert.equal(cast(),true);assert.equal(u.ability.c,1);
 assert.equal(sell(),true);assert.equal(u.ability.c,0);assert.equal(u.credits,800,'one refund');assert.equal(sell(),false,'the used one is not refunded');
 assert.equal(buy(),true,'one more (1 used + 1 held = 2)');assert.equal(buy(),false,'the round max counts the used charge');
 for(let i=0;i<6;i++){sell();buy();}assert.equal(u.ability.c,1);assert.equal(u.credits,600,'buy / sell cycles end where they started');
 assert.equal(cast(),true);assert.equal(buy(),false);assert.equal(sell(),false);assert.equal(u.ability.c,0);assert.equal(u.ability.used.c,2);}
// 5. placement only: Cypher's cage tosses but never activates; Killjoy's Nanoswarm places a second, never arms; Viper never toggles;
//    Vyse's Arc Rose never flashes; Yoru's tether stays at his feet, never teleports; Fakeout stands still
{const {s,u}=mkA('Cypher');full(u);assert.equal(s.command(u,{t:'ab',k:'q'}),true);const cg=s.effects.find(e=>e.kind==='cage');cg.landed=true;cg.v=[0,0,0];cg.p=[0,0,-3];u.ability.cool.q=0;
 assert.equal(s.command(u,{t:'ab',k:'q'}),true,'second cage tossed');assert.equal(u.ability.q,0);u.ability.cool.q=0;assert.equal(s.command(u,{t:'ab',k:'q'}),false,'no activation in the buy phase');assert.ok(!s.effects.some(e=>e.kind==='cage'&&e.activeUntil),'no cage active');}
{const {s,u}=mkA('Killjoy');full(u);assert.equal(s.command(u,{t:'ab',k:'c'}),true);u.ability.cool.c=0;assert.equal(s.command(u,{t:'ab',k:'c'}),true,'second Nanoswarm placed, not arming the first');
 assert.ok(s.effects.filter(e=>e.kind==='nanoswarm').every(e=>!e.armed),'none armed');u.ability.cool.c=0;assert.equal(s.command(u,{t:'ab',k:'c'}),false,'no activation');}
{const {s,u}=mkA('Viper');full(u);assert.equal(s.command(u,{t:'ab',k:'q'}),true);assert.ok(u.ability.cloud&&!u.ability.cloudOn,'emitter placed, off');u.ability.cool.q=0;assert.equal(s.command(u,{t:'ab',k:'q'}),false,'no toggle on');assert.ok(!u.ability.cloudOn);
 assert.equal(s.command(u,{t:'ab',k:'e'}),true);u.ability.cool.e=0;assert.equal(s.command(u,{t:'ab',k:'e'}),false);assert.ok(!u.ability.toxOn);
 s.buy=0;u.ability.cool.q=0;assert.equal(s.command(u,{t:'ab',k:'q'}),true,'round started: the toggle works');assert.ok(u.ability.cloudOn);}
{const {s,u}=mkA('Vyse');full(u);assert.equal(s.command(u,{t:'ab',k:'e'}),true);u.ability.cool.e=0;assert.equal(s.command(u,{t:'ab',k:'e'}),false,'Arc Rose: no flash in the buy phase');assert.ok(u.ability.rose);}
{const {s,u}=mkA('Yoru');full(u);u.look=0;assert.equal(s.command(u,{t:'ab',k:'e'}),true);assert.deepEqual(u.ability.gate.p,[0,0,0],'tether at his feet');u.ability.cool.e=0;
 assert.equal(s.command(u,{t:'ab',k:'e'}),false,'no Gatecrash teleport');assert.equal(s.command(u,{t:'ab',k:'e',fk:1}),false,'no fake either');assert.ok(!u.pendingTeleport);
 assert.equal(s.command(u,{t:'ab',k:'c'}),true);assert.equal(s.effects.find(e=>e.kind==='decoy').speed,0,'Fakeout stands still');}
// Neon: High Gear spends no charge, no energy, the slide no charge
{const {s,u}=mkA('Neon');full(u);const e0=u.ability.e,f0=u.ability.fuel,s0=u.ability.slides;assert.equal(s.command(u,{t:'ab',k:'e'}),true);assert.ok(u.gearOn);assert.equal(u.ability.e,e0,'no charge');
 for(let i=0;i<40;i++)s.step(.05);assert.equal(u.ability.fuel,f0,'no energy');u.ability.cool.e=0;assert.equal(s.command(u,{t:'ab',k:'e',alt:true,f:1}),true,'slide');assert.equal(u.ability.slides,s0,'no slide charge');}
// Astra: Astral Form places Stars; no Dissipate, no Cosmic Divide, no activation
{const {s,u}=mkA('Astra');full(u);u.human=true;const K=kits.Astra;u.ability.ult=K.u;assert.equal(s.command(u,{t:'ab',k:'x'}),true,'Astral Form');assert.equal(s.command(u,{t:'ab',k:'s',p:[5,5]}),true,'Star placed');
 const n=s.effects.filter(e=>e.kind==='star').length;assert.equal(s.command(u,{t:'ab',k:'s',p:[5,5]}),false,'no Dissipate');assert.equal(s.effects.filter(e=>e.kind==='star').length,n);
 for(const k of ['c','q','e'])assert.equal(s.command(u,{t:'ab',k,p:[5,5]}),false,'no '+k+' activation');assert.equal(s.command(u,{t:'ab',k:'x',p:[0,0,10,10]}),false,'no Cosmic Divide');}
// 6. cooldowns start at round start: Sage's Healing Orb used 15 s before the round restocks 45 s after it
{const {s,u}=mkA('Sage');u.hp=50;s.buy=15;assert.equal(s.command(u,{t:'ab',k:'e'}),true);assert.equal(u.ability.e,0);const ra=u.ability.rechargeAt;
 for(let i=0;i<300;i++)s.step(.05);assert.equal(s.buy,0,'round started');const start=s.time-(300*.05-15);assert.ok(Math.abs(u.ability.rechargeAt-(start+45))<.06,'restock 45 s after the round start ('+(u.ability.rechargeAt-start).toFixed(2)+')');assert.ok(u.ability.rechargeAt>ra);assert.equal(u.ability.e,0);}
// Omen: Shrouded Step allowed, From the Shadows not
{const s=new SpikeSimulation(W,'five','ascent',()=>.5),o=s.add('o','Omen');s.add('e');s.start(false);s.buy=20;o.ability.c=1;o.ability.q=1;o.ability.ult=99;
 assert.equal(s.command(o,{t:'ab',k:'x',p:[0,0]}),false,'From the Shadows locked in the buy phase');assert.equal(s.command(o,{t:'ab',k:'q'}),false,'Paranoia is not a buy-phase ability');}
// buy phase guns (the owner, 2026-11-07: actual-VALORANT buy phase): the magazine fired in the buy phase stays fired - buying and
// selling a gun or armour never refills the gun in hand, and the round start (barrier drop) refills nothing.
{const {s,a}=mk();a.weapon=a.primary=a.secondary='Classic';a.primary=null;a.ammo=12;a.reserve=36;a.inventory={Classic:12};a.reserves={Classic:36};a.credits=2000;a.purchases=[];
 a.weapon='Classic';a.fireAt=0;shoot(s,a,1);const m0=a.ammo;assert.ok(m0<12,'the Classic fired in the buy phase ('+m0+')');
 assert.equal(s.command(a,{t:'buy',n:'Light Armor'}),true);assert.equal(s.command(a,{t:'sell',n:'Light Armor'}),true);assert.equal(a.ammo,m0,'selling armour does not refill the Classic');
 assert.equal(s.command(a,{t:'buy',n:'Ghost'}),true);assert.equal(a.weapon,'Ghost');assert.equal(s.command(a,{t:'sell',n:'Ghost'}),true);assert.equal(a.weapon,'Classic');assert.equal(a.ammo,m0,'buying then selling a sidearm brings the Classic back as fired, not refilled');
 const r0=a.reserve;s.buy=.01;s.step(.05);assert.equal(s.buy,0,'the round started');assert.equal(a.ammo,m0,'no refill at the barrier drop (magazine)');assert.equal(a.reserve,r0,'no refill at the barrier drop (reserve)');}
console.log('Buy phase: guns on real ammo, no damage / debuff before the round, no refill; only the VALORANT setup abilities cast (placement only where listed), credits at purchase, no rebuy past the round max, no buy/resell charge, cooldowns from the round start');
