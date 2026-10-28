// Team Deathmatch with agent abilities and ultimates (VALORANT TDM: wiki.playvalorant.com/en-us/Team_Deathmatch "Abilities",
// fetched 2026-10-28). The match is the plain respawn TDM of simulation.js (stages, stage guns, loadout armour, 1.5 s respawns,
// Recovery Orbs, 100 kills / 570 s); the abilities are the 5v5 ones (abilities.js / devices.js / ults.js through SpikeSimulation's
// cast, fire, barrier / device / Shade hit and status-speed hooks), with no buy phase, rounds or Spike. Charges recharge on the
// TDM cooldowns and ult points come from kills (3) and TDM Ultimate Orbs (10) - server/src/tdmabil.js.
import {Simulation,weapons} from './simulation.js';
import {SpikeSimulation} from './spike.js';
import {initAbilities,castAbility,tickAbilities} from './abilities.js';
import {tdmAbInit,tdmAbTick,tdmCost} from './tdmabil.js';
import {recTick} from './tdmorbs.js';
export class TdmSimulation extends SpikeSimulation{
 constructor(world,mode='tdm',map='ascent',random=Math.random){super(world,'tdm',map,random);this.mode='tdm';this.gm='tdm';this.objectiveRoutes=false;this.tdmAbil=true;this.loadoutArmor=true;this.tdmOrbs=true;this.matchLen=570;this.remaining=570;this.maxKills=100;this.spike={st:'',carrier:null,x:0,y:0,z:0,t:45,pt:0,dt:0,site:''};}
 spawnWalls(){return false;}
 add(...args){const u=Simulation.prototype.add.apply(this,args);for(const e of this.effects||[])if(e.team===u.team&&!this.units.some(v=>v.id===e.owner))e.owner=u.id;u.purchases=[];initAbilities(u,true);tdmAbInit(u);return u;}
 start(fill=true){Simulation.prototype.start.call(this,fill);this.effects=[];for(const u of this.units){initAbilities(u,true);tdmAbInit(u);}}
 // the base respawn spawn (team anchors cached on the map alone)
 teamSpawnPoint(u){const W=this.world;this.world=this.baseWorld;try{return super.teamSpawnPoint(u);}finally{this.world=W;}}
 spawn(u){Simulation.prototype.spawn.call(this,u);}
 bot(u){return Simulation.prototype.bot.call(this,u);}
 release(){}
 command(u,m){if(m?.t==='ab'){if(this.phase!=='game')return false;const A=u.ability,r=castAbility(this,u,m);if(r&&m.k==='x'&&A&&!(A.ult>0)){A.tp=0;A.tdUlt=0;}return r;}
  if(m?.t==='blade')return this.fireBlade(u,m.alt===1||m.alt===true);
  if(['buy','sell','pick','dropw','drop'].includes(m?.t))return false;
  const r=Simulation.prototype.command.call(this,u,m);if(r&&m.t==='in'){u.input.interact=m.h4===1;u.input.cb=m.cb===1;}return r;}
 step(dt){if(this.phase!=='game')return;dt=Math.min(.05,Math.max(0,dt));this.tickDt=dt;this.time+=dt;this.remaining-=dt;this.tdmStageTick();
  const shooters=[];for(const u of this.units){if(u.loading)continue;if(!u.alive){if(this.time>=u.respawnAt)this.spawn(u);continue;}this.unitTick(u,dt,shooters);if(!u.alive&&!(u.respawnAt>this.time))u.respawnAt=this.time+1.5;/* a fall / out of bounds inside unitTick */}
  this.fireTick(shooters);recTick(this,dt);tickAbilities(this,dt);tdmAbTick(this,dt);
  if(this.remaining<=0||this.scores.some(n=>n>=this.maxKills))this.phase='post';}
 snapshot(){const s=super.snapshot();delete s.fw;return s;}
 // The round-state message carries what the page needs for its abilities (no buy phase, scores, Spike or credits in TDM):
 // the kit charges / ult pips (ab), the ult points and the TDM cost (tp / uc), statuses, channels; tab 1 marks it (the page's validator takes it without a Spike row).
 roundState(u){const r=super.roundState(u);for(const k of ['b','bl','ld','sc','atk','me','cr','rv','orb','uo','uoc','sp','gm'])delete r[k];r.tab=1;r.tl=this.remaining;r.tp=u.ability?.tp||0;r.uc=tdmCost(u);return r;}
}
