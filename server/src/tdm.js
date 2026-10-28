import {hyp2} from './hyp.js';
// Team Deathmatch with agent abilities and ultimates (VALORANT TDM: wiki.playvalorant.com/en-us/Team_Deathmatch "Abilities",
// fetched 2026-10-28). The match is the plain respawn TDM of simulation.js (stages, stage guns, loadout armour, 1.5 s respawns,
// Recovery Orbs, 100 kills / 570 s); the abilities are the 5v5 ones (abilities.js / devices.js / ults.js through SpikeSimulation's
// cast, fire, barrier / device / Shade hit and status-speed hooks), with no buy phase, rounds or Spike. Charges recharge on the
// TDM cooldowns and ult points come from kills (3) and TDM Ultimate Orbs (10) - server/src/tdmabil.js.
import {TDM_ROOM,roomAnchor,inRoom,roomSpawn,roomTick,roomBlocked} from './tdmrooms.js';
import {Simulation,weapons,tdmArmor,tdmStage} from './simulation.js';
import {SpikeSimulation} from './spike.js';
import {initAbilities,castAbility,tickAbilities} from './abilities.js';
import {tdmAbInit,tdmAbTick,tdmCost} from './tdmabil.js';
import {recTick,tdmUltTick,tdmUltRows,tdmUltZoneRows} from './tdmorbs.js';
export class TdmSimulation extends SpikeSimulation{
 constructor(world,mode='tdm',map='ascent',random=Math.random){super(world,'tdm',map,random);this.mode='tdm';this.gm='tdm';this.objectiveRoutes=false;this.tdmAbil=true;this.loadoutArmor=true;this.spawnRooms=true;this.tdmOrbs=true;this.matchLen=570;this.remaining=570;this.maxKills=100;this.spike={st:'',carrier:null,x:0,y:0,z:0,t:45,pt:0,dt:0,site:''};}
 spawnWalls(){return false;}
 add(...args){const u=Simulation.prototype.add.apply(this,args);for(const e of this.effects||[])if(e.team===u.team&&!this.units.some(v=>v.id===e.owner))e.owner=u.id;u.purchases=[];initAbilities(u,true);tdmAbInit(u);return u;}
 start(fill=true){Simulation.prototype.start.call(this,fill);this.effects=[];for(const u of this.units){initAbilities(u,true);tdmAbInit(u);}}
 // the base respawn spawn (team anchors cached on the map alone)
 // Geometry candidates stay fixed for the base map; occupancy and RNG are evaluated on every spawn.
 // Dynamic worlds deliberately rescan (same contract as Simulation.teamSpawnPoint).
 teamSpawnPoint(u){const W=this.world;this.world=this.baseWorld;try{if(this.spawnRooms){const B=this.baseWorld,a=roomAnchor(this,u.team);this.roomSpawnCache??=new Map();let C=this.roomSpawnCache.get(a);
   if(!C||C.world!==B||C.playable!==B.playable||C.nodes!==B.nav.nodes||C.blocked!==B.blocked||C.x!==a[0]||C.y!==a[1]||C.z!==a[2]||B.dynamic){const points=[];for(const i of B.playable){const p=B.nav.nodes[i];if(hyp2(p[0]-a[0],p[2]-a[2])<TDM_ROOM.radius-.5&&Math.abs(p[1]-a[1])<1&&!B.blocked(p[0],p[2],.43,p[1],1.92))points.push(p);}C={world:B,playable:B.playable,nodes:B.nav.nodes,blocked:B.blocked,x:a[0],y:a[1],z:a[2],points};if(!B.dynamic)this.roomSpawnCache.set(a,C);else this.roomSpawnCache.delete(a);}
   const L=[];for(const p of C.points){let occupied=false;for(const v of this.units)if(v!==u&&v.alive&&hyp2(v.x-p[0],v.z-p[2])<1){occupied=true;break;}if(!occupied)L.push(p);}return (L.length?L:C.points)[Math.floor(this.random()*(L.length||C.points.length))]||a;}return super.teamSpawnPoint(u);}finally{this.world=W;}}
 spawn(u){Simulation.prototype.spawn.call(this,u);roomSpawn(this,u);}
 roomArmor(u){return tdmArmor(tdmStage((this.matchLen||570)-this.remaining),u.weapon).a;}
 // Reuse the per-unit collision view. The closure still reads current room state and base blockers.
 motor(u,input,dt){const W=this.world;if(!this.spawnRooms)return super.motor(u,input,dt);this.roomMotorViews??=new WeakMap();let view=this.roomMotorViews.get(u);if(!view||Object.getPrototypeOf(view)!==W){view=Object.create(W);view.blocked=(x,z,r,y,h)=>roomBlocked(this,u,x,z,r,y)||W.blocked(x,z,r,y,h);this.roomMotorViews.set(u,view);}this.world=view;try{return super.motor(u,input,dt);}finally{this.world=W;}}
 fire(u){if(this.spawnRooms&&inRoom(this,u))return false;return super.fire(u);}
 bot(u){return Simulation.prototype.bot.call(this,u);}
 release(){}
 command(u,m){if(m?.t==='ab'){if(this.phase!=='game'||this.spawnRooms&&inRoom(this,u))return false;const A=u.ability,r=castAbility(this,u,m);if(r&&m.k==='x'&&A&&!(A.ult>0)){A.tp=0;A.tdUlt=0;}return r;}
  if(m?.t==='blade')return this.fireBlade(u,m.alt===1||m.alt===true);
  if(['buy','sell','pick','dropw','drop'].includes(m?.t))return false;
  const r=Simulation.prototype.command.call(this,u,m);if(r&&m.t==='in'){u.input.interact=m.h4===1;u.input.cb=m.cb===1;}return r;}
 step(dt){if(this.phase!=='game')return;dt=Math.min(.05,Math.max(0,dt));this.tickDt=dt;this.time+=dt;this.remaining-=dt;this.tdmStageTick();
  const shooters=[];for(const u of this.units){if(u.loading)continue;if(!u.alive){if(this.time>=u.respawnAt)this.spawn(u);continue;}roomTick(this,u,dt);if(!u.alive)continue;this.unitTick(u,dt,shooters);roomTick(this,u,0);if(!u.alive&&!(u.respawnAt>this.time))u.respawnAt=this.time+1.5;/* a fall / out of bounds inside unitTick */}
  this.fireTick(shooters);recTick(this,dt);tickAbilities(this,dt);tdmAbTick(this,dt);tdmUltTick(this);/* TDM Ultimate Orbs (after the kill points, so a wave's +10 adds on top) */
  if(this.remaining<=0||this.scores.some(n=>n>=this.maxKills))this.phase='post';}
 snapshot(){const s=super.snapshot();delete s.fw;s.tuo=tdmUltRows(this);s.tuz=tdmUltZoneRows(this);s.trm=this.spawnRooms?[0,1].map(t=>[...roomAnchor(this,t),TDM_ROOM.radius,t]):[];return s;}
 // The round-state message carries what the page needs for its abilities (no buy phase, scores, Spike or credits in TDM):
 // the kit charges / ult pips (ab), the ult points and the TDM cost (tp / uc), statuses, channels; tab 1 marks it (the page's validator takes it without a Spike row).
 roundState(u){const r=super.roundState(u);for(const k of ['b','bl','ld','sc','atk','me','cr','rv','orb','uo','uoc','sp','gm'])delete r[k];r.tab=1;r.room=this.spawnRooms&&u.roomSafe?Math.max(0,TDM_ROOM.grace-(this.time-u.roomEntered)):null;r.tl=this.remaining;r.tp=u.ability?.tp||0;r.uc=tdmCost(u);return r;}
}
