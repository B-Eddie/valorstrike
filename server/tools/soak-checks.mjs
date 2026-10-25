// Spike (five) invariants and ability/ult-heavy drivers for tools/soak.mjs.
//
// instrument(sim,flag,stats) wraps the live SpikeSimulation instance (never the prototype) so every round transition,
// shot and tick is checked against the rules it is meant to follow:
//   - economy at round end: winner +3000, loser 1900/2400/2900 by consecutive losses, capped at 9000, except a loser who
//     survives the round (alive at the round end; a Phoenix inside Run It Back is not alive) where VALORANT pays 1000
//     instead (wiki.playvalorant.com/en-us/Credits): an attacker alive when time runs out without a plant, a defender
//     alive after the Spike detonates (eliminations and defuses leave no loser alive by definition); the dead lose
//     their guns and shields, survivors keep them; loss streaks reset for the winner;
//   - carry-over at round start: survivors keep primary/secondary/shields/credits/ult points and charges, the floor and
//     every effect are cleared, everyone is alive with a full magazine of the gun in hand; halftime (round 13) resets
//     credits to 800, guns to the Classic, shields, ult points and charges;
//   - detained units never fire; a pending Run It Back never outlives its window; held guns are owned (primary,
//     secondary, knife, or the Tour de Force / Headhunter weapon while that is active);
//   - every death inside a tick has a kill event or a known cause (fall out of the map, loading bench).
// driveBots / scenario helpers make bots and fuzzers spend abilities and ultimates constantly, aimed at enemies.
import kits from '../src/kits.json' with {type:'json'};
import {weapons} from '../src/simulation.js';

export const FOCUS=['Raze','Killjoy','Phoenix','Chamber','Cypher','Sova','Breach','Skye'];
const lossBonus=n=>Math.min(2900,1900+(n-1)*500);

export const fiveStats=stats=>stats.five||(stats.five={finishes:0,newRounds:0,deathsChecked:0,survivorLosses:0,abilityKills:0,ribReturns:0,detainedShots:0,orphanEffects:0,ultCasts:{},abilityCasts:{}});
export function instrument(sim,flag,stats){
 if(sim.__soak)return;sim.__soak=true;
 const S=fiveStats(stats),tag=u=>`${u.name}(${u.agent}${u.human?',human':''})`;
 // Round end.
 const finish=sim.finishRound.bind(sim);
 sim.finishRound=function(winner,text){const already=this.roundDelay>0,atk=this.atk,before=new Map(this.units.map(u=>[u.id,{credits:u.credits,primary:u.primary,secondary:u.secondary,armor:u.armor,alive:u.alive||!!u.runItBack,up:!!u.alive}])),losses=[...this.losses];
  const r=finish(winner,text);
  if(already){for(const u of this.units){const b=before.get(u.id);if(b&&b.credits!==u.credits)flag('economy: second round end paid',`${tag(u)} ${b.credits}->${u.credits}`,'econ2');}return r;}
  S.finishes++;
  if(this.losses[winner]!==0)flag('economy: winner loss streak',JSON.stringify(this.losses),'econwin');
  if(this.losses[1-winner]!==losses[1-winner]+1)flag('economy: loser streak',`${losses} -> ${this.losses}`,'econlose');
  for(const u of this.units){const b=before.get(u.id);if(!b)continue;const survived=u.team!==winner&&b.up&&(u.team===atk?text==='Time ran out':text==='Spike detonated'),want=Math.min(9000,b.credits+(u.team===winner?3000:survived?1000:lossBonus(this.losses[u.team])));if(survived)S.survivorLosses++;
   if(u.credits!==want)flag('economy: round reward',`${tag(u)} ${b.credits} -> ${u.credits}, expected ${want} (team ${u.team} winner ${winner} losses ${this.losses} ${text}${survived?', survivor':''})`,'econreward');
   if(b.alive&&(u.primary!==b.primary||u.secondary!==b.secondary||u.armor!==b.armor))flag('carry-over: survivor lost gear at round end',`${tag(u)} ${b.primary}/${b.secondary}/${b.armor} -> ${u.primary}/${u.secondary}/${u.armor}`,'survgear');
   if(!b.alive&&(u.primary!=null||u.secondary!=='Classic'||u.armor!==0))flag('carry-over: dead kept gear',`${tag(u)} ${u.primary}/${u.secondary}/${u.armor}`,'deadgear');}
  return r;};
 // Round start.
 const fresh=sim.newRound.bind(sim);
 sim.newRound=function(){const next=this.round+1,before=new Map(this.units.map(u=>[u.id,{credits:u.credits,primary:u.primary,secondary:u.secondary,armor:u.armor,ult:u.ability?.ult,c:u.ability?.c,q:u.ability?.q,e:u.ability?.e}]));
  const r=fresh();S.newRounds++;
  if((this.floor||[]).length)flag('round start: floor guns not cleared',(this.floor||[]).length,'floorkeep');
  if(this.effects.length)flag('round start: effects not cleared',this.effects.length,'fxkeep');
  for(const u of this.units){const b=before.get(u.id);if(!b||!u.human||this.round!==next)continue;const half=next===13,first=next===1,K=kits[u.agent]||kits.Jett;
   const want={primary:half?null:b.primary,secondary:half?'Classic':(b.secondary||'Classic'),armor:half||first?0:b.armor,credits:half?800:b.credits,ult:half||first?0:b.ult};
   for(const k of Object.keys(want))if(u[k]!==undefined&&k!=='ult'&&u[k]!==want[k])flag('round start: carry-over '+k,`${tag(u)} round ${next}: ${k} ${JSON.stringify(b[k])} -> ${JSON.stringify(u[k])}, expected ${JSON.stringify(want[k])}`,'carry:'+k);
   if(u.ability&&u.ability.ult!==want.ult)flag('round start: ult points',`${tag(u)} round ${next}: ${b.ult} -> ${u.ability.ult}, expected ${want.ult}`,'carry:ult');
   if(u.ability&&!half&&!first)for(const k of ['c','q'])if(u.ability[k]!==Math.min(K.mx[k]||0,b[k]||0)&&!(u.agent==='Reyna'&&k==='q'))flag('round start: charges '+k,`${tag(u)} ${b[k]} -> ${u.ability[k]}`,'carry:'+k);
   if(!u.alive)flag('round start: not alive',tag(u),'rsdead');
   if(u.weapon!==(u.primary||u.secondary)||u.ammo!==weapons[u.weapon]?.magazineSize)flag('round start: gun in hand',`${tag(u)} ${u.weapon} ${u.ammo}`,'rsgun');}
  return r;};
 // Shots while detained.
 const fire=sim.fire.bind(sim);
 sim.fire=function(u){const detained=u.detainUntil>this.time,r=fire(u);if(detained&&r){S.detainedShots++;flag('detained unit fired',`${tag(u)} ${u.weapon} detain ${(u.detainUntil-this.time).toFixed(2)} s left`,'detainfire');}return r;};
 // Run It Back returns.
 const step=sim.step.bind(sim);
 sim.step=function(dt){const rib=new Set(this.units.filter(u=>u.runItBack).map(u=>u.id));const r=step(dt);
  for(const u of this.units)if(rib.has(u.id)&&!u.runItBack&&u.alive&&this.roundDelay<=0){S.ribReturns++;if(u.hp!==100)flag('Run It Back return hp',`${tag(u)} hp ${u.hp}`,'ribhp');}
  return r;};
}
// Deaths and their kill events, per room tick: a unit alive after the previous tick and dead now (killed by a shot or
// utility in the tick, or by a command handled between ticks) must be named in a kill event of this tick's snapshot,
// unless it fell out of the map or was benched while loading. events: the 'ev' of this tick's snapshot.
export function deathCheck(sim,flag,stats,events){const S=fiveStats(stats),prev=sim.__alive||new Map(),tag=u=>`${u.name}(${u.agent}${u.human?',human':''})`;
 for(const e of events)if(e[0]==='k'&&e[4]==='Ability')S.abilityKills++;
 if(sim.roundDelay<=0||prev.size)for(const u of sim.units){if(prev.get(u.id)===true&&!u.alive){S.deathsChecked++;if(!events.some(e=>e[0]==='k'&&e[2]===u.name)&&!(u.y<-19)&&!u.loading)flag('death without kill event',`${tag(u)} at ${u.x.toFixed(1)},${u.y.toFixed(1)},${u.z.toFixed(1)} hp ${u.hp} round ${sim.round}`,'nokill');}}
 sim.__alive=new Map(sim.units.map(u=>[u.id,u.alive]));}

// Per-tick five-mode checks (after the room's tick).
export function checkFive(sim,flag,stats){if(sim.phase!=='game')return;const S=fiveStats(stats),tag=u=>`${u.name}(${u.agent}${u.human?',human':''})`;
 const ids=new Set(sim.units.map(u=>u.id));let orphans=0;for(const e of sim.effects){if(!ids.has(e.owner))orphans++;if(!Array.isArray(e.p)||!e.p.every(Number.isFinite)||!Number.isFinite(e.until))flag('bad effect',JSON.stringify({kind:e.kind,p:e.p,until:e.until}),'badfx:'+e.kind);}
 S.orphanEffects=Math.max(S.orphanEffects,orphans);
 for(const u of sim.units){
  if(u.runItBack&&sim.roundDelay<=0&&sim.time>u.runItBack.until+.2)flag('Run It Back outlived its window',`${tag(u)} until ${u.runItBack.until.toFixed(1)} now ${sim.time.toFixed(1)}`,'ribstale');
  for(const k of ['detainUntil','slowUntil','concussUntil','blindUntil','vulnerableUntil','revealedUntil','tetheredUntil','invulnerableUntil'])if(u[k]!==undefined&&!Number.isFinite(u[k]))flag('status timer',`${tag(u)} ${k}=${u[k]}`,'status:'+k);
  if(!u.alive||u.loading||sim.roundDelay>0)continue;
  const owned=u.weapon==='Knife'||u.weapon===u.primary||u.weapon===u.secondary||(u.ultWeapon&&u.weapon==='Operator')||(u.headhunter&&u.weapon==='Sheriff');
  if(!owned)flag('weapon not owned',`${tag(u)} holds ${u.weapon}; slots ${u.primary}/${u.secondary} ult ${!!u.ultWeapon} hh ${!!u.headhunter}`,'unowned:'+u.weapon);
  if(u.ultWeapon&&u.weapon!=='Operator'&&sim.buy<=0&&!u.reloadAt)flag('Tour de Force state left behind',tag(u),'tdfstale');}
}

const aimAt=(u,v)=>{const dx=v.x-u.x,dz=v.z-u.z,dy=(v.y+1.1)-(u.y+1.6);return {look:Math.atan2(-dx,-dz),pitch:Math.atan2(dy,Math.hypot(dx,dz))};};
const nearestFoe=(sim,u)=>sim.units.filter(v=>v.alive&&!v.loading&&v.team!==u.team).sort((a,b)=>Math.hypot(a.x-u.x,a.z-u.z)-Math.hypot(b.x-u.x,b.z-u.z))[0];

// Bots spend utility constantly (scenario 'abilities': c/q/e with charges refilled; 'ults': ult points refilled and
// cast, with the follow-ups each ult has: Sova recasts, Chamber fires the Operator, Killjoy arms the Nanoswarm).
export function driveBots(sim,scenario,rng,stats){if(sim.phase!=='game'||sim.buy>0||sim.roundDelay>0)return;const S=fiveStats(stats);
 for(const u of sim.units){if(u.human||!u.alive||!u.ability)continue;const v=nearestFoe(sim,u);if(!v)continue;if(rng()<.5){const a=aimAt(u,v);u.look=a.look;u.pitch=a.pitch;}
  const K=kits[u.agent]||kits.Jett,A=u.ability;let k;
  if(scenario==='ults'){A.ult=K.u;k=rng()<.7?'x':'cqe'[Math.floor(rng()*3)];}else{for(const c of ['c','q'])A[c]=K.mx[c]||A[c];A.e=Math.max(A.e,1);A.cool={};k=rng()<.15?'x':'cqe'[Math.floor(rng()*3)];if(k==='x')A.ult=K.u;}
  const m={t:'ab',k};if(u.agent==='Omen'&&k==='x')m.p=[v.x,v.z];if(u.agent==='Phoenix'&&k==='q'&&rng()<.5)m.l=1;
  if(sim.command(u,m)){const tab=k==='x'?S.ultCasts:S.abilityCasts;tab[u.agent]=(tab[u.agent]||0)+1;}
  if(u.ultWeapon||u.headhunter){const a=aimAt(u,v);u.look=a.look;u.pitch=a.pitch;sim.fire(u);}}}

// One fuzzer decision in an ability/ult scenario: refill, aim at the nearest enemy, cast or recast.
export function fuzzCast(sim,u,scenario,rng,stats){if(!u?.ability||!u.alive)return null;const K=kits[u.agent]||kits.Jett,A=u.ability,v=nearestFoe(sim,u);
 if(scenario==='ults')A.ult=K.u;else{for(const c of ['c','q'])A[c]=K.mx[c]||A[c];A.e=Math.max(A.e,1);if(rng()<.2)A.ult=K.u;}
 const k=scenario==='ults'?(rng()<.75?'x':'cqe'[Math.floor(rng()*3)]):'cqex'[Math.floor(rng()*4)];
 const m={t:'ab',k};if(u.agent==='Omen'&&k==='x')m.p=v?[v.x,v.z]:[u.x,u.z];if(u.agent==='Phoenix'&&k==='q'&&rng()<.5)m.l=1;
 const S=fiveStats(stats),tab=k==='x'?S.ultCasts:S.abilityCasts;tab[u.agent+'*']=(tab[u.agent+'*']||0)+1;
 return {m,aim:v?aimAt(u,v):null};}
