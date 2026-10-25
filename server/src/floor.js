// Floor weapons (5v5): deaths drop the best gun, G drops the held gun, F picks up the gun the player is
// looking at and swaps it with the gun in that slot (the old one lands where the new one lay). Walking over a
// gun with that slot empty picks it up. The server owns every floor gun, its ammo and every swap.
import {weapons,reserveOf} from './simulation.js';
export const SIDEARMS=new Set(['Classic','Shorty','Frenzy','Ghost','Sheriff']);
const RANK={Classic:0,Shorty:1,Frenzy:2,Ghost:3,Sheriff:4,Stinger:5,Bucky:6,Spectre:7,Judge:8,Bulldog:9,Marshal:10,Ares:11,Guardian:12,Odin:13,Outlaw:13,Phantom:14,Vandal:14,Operator:15};
export const FLOOR_LIMIT=24,PICK_RANGE=2.5,AUTO_RANGE=1,DROPPER_GRACE=1.5;
const droppable=w=>typeof w==='string'&&w!=='Knife'&&Object.hasOwn(weapons,w)&&!weapons[w].abilityOnly;
const slotOf=w=>SIDEARMS.has(w)?'secondary':'primary';
// New round: floor clears; a survivor who gave away every gun is handed the free Classic again.
export function floorReset(sim){sim.floor=[];sim.floorId=sim.floorId||1;for(const u of sim.units){u.floorDropped=false;if(!u.secondary)u.secondary='Classic';}}
function settle(sim,x,y,z){const W=sim.world;try{const g=W.ground(x,z,y+.5);if(Number.isFinite(g)&&g>y-6&&g>-40)return g;}catch(e){}return y;}
export function floorDrop(sim,w,x,y,z,ammo,reserve,dropper=null){if(!droppable(w))return null;sim.floor||=[];const mag=weapons[w].magazineSize;
 const d={id:sim.floorId=(sim.floorId||1)+1,w,x,y:settle(sim,x,y,z),z,ammo:Math.max(0,Math.min(mag,Number.isFinite(ammo)?ammo:mag)),reserve:Math.max(0,Number.isFinite(reserve)?reserve:reserveOf(w)),dropper,graceUntil:sim.time+DROPPER_GRACE};const own=dropper!=null&&(sim.units||[]).find(x=>x.id===dropper),sk=own&&own.skins&&Object.hasOwn(own.skins,w)?own.skins[w]:null;if(typeof sk==='string')d.sk=sk;// cosmetic: the dropper's skin rides with the gun
 sim.floor.push(d);while(sim.floor.length>FLOOR_LIMIT)sim.floor.shift();return d;}
// Live ammo of a carried gun, whether it is in hand or holstered.
function ammoOf(u,w){return u.weapon===w?[u.ammo,u.reserve]:[u.inventory?.[w],u.reserves?.[w]];}
// Removing a gun from a slot ends its buy-phase refund: a gun on the floor or picked up from it is never sold back.
function lockSlot(u,slot){if(Array.isArray(u.purchases))u.purchases=u.purchases.filter(p=>p.key!==slot);}
function holster(u){if(u.weapon&&u.weapon!=='Knife'){u.inventory[u.weapon]=u.ammo;u.reserves[u.weapon]=u.reserve;}}
function wield(sim,u,w){u.weapon=w;u.ammo=u.inventory[w]??(w==='Knife'?1:weapons[w].magazineSize);u.reserve=u.reserves[w]??0;u.reloadAt=0;u.triggerHeld=false;u.fireAt=sim.time+weapons[w].equipTimeSeconds;u.equipAt=u.fireAt;}
function able(sim,u){return u.alive&&!u.loading&&!u.pendingTeleport&&!(u.dismissUntil>sim.time)&&sim.roundDelay<=0;}
function take(sim,u,d){const slot=slotOf(d.w),old=u[slot];sim.floor.splice(sim.floor.indexOf(d),1);
 if(old){const [a,r]=ammoOf(u,old);if(u.weapon===old)u.weapon=null;floorDrop(sim,old,d.x,d.y,d.z,a,r,u.id);delete u.inventory[old];delete u.reserves[old];}
 holster(u);lockSlot(u,slot);u[slot]=d.w;u.inventory[d.w]=d.ammo;u.reserves[d.w]=d.reserve;wield(sim,u,d.w);return true;}
// F: the client names the gun it is looking at; the server re-checks reach, height and line of sight.
export function floorPick(sim,u,id){if(!able(sim,u))return false;const d=(sim.floor||[]).find(d=>d.id===id);if(!d)return false;
 const dx=d.x-u.x,dz=d.z-u.z,dy=d.y-u.y;if(Math.hypot(dx,dz)>PICK_RANGE||dy>1.2||dy<-1.6)return false;
 const o=[u.x,u.y+1.6-(u.ch||0),u.z],t=[d.x-o[0],d.y+.1-o[1],d.z-o[2]],len=Math.hypot(...t);if(len>.3&&sim.world.ray(o,t.map(v=>v/len),len-.25)!==Infinity)return false;
 return take(sim,u,d);}
// G: drop the primary in hand 1.2 m ahead (shortened at walls). Sidearms and the knife stay, so a living
// player always holds a sidearm (sidearms still change hands through F swaps and death drops).
export function floorDropHeld(sim,u){if(!u.alive||u.loading||sim.roundDelay>0||!droppable(u.weapon))return false;/* mid-reload too: the gun drops with the magazine it has, wield() ends the reload */const w=u.weapon,slot=slotOf(w);if(slot!=='primary'||u[slot]!==w)return false;
 const f=[-Math.sin(u.look),0,-Math.cos(u.look)],hit=sim.world.ray([u.x,u.y+1,u.z],f,1.2),reach=Math.max(0,Math.min(1.2,hit-.3));
 floorDrop(sim,w,u.x+f[0]*reach,u.y,u.z+f[2]*reach,u.ammo,u.reserve,u.id);delete u.inventory[w];delete u.reserves[w];lockSlot(u,slot);u[slot]=null;
 wield(sim,u,u.primary||u.secondary||'Knife');return true;}
export function floorTick(sim){if(!sim.floor)floorReset(sim);
 // A Phoenix killed inside Run It Back comes back with his loadout: nothing drops (it used to drop his gun for the enemy).
 for(const u of sim.units){if(u.alive||u.floorDropped||u.loading||u.runItBack)continue;u.floorDropped=true;if(!(u.y>-20))continue;const w=u.primary||u.secondary;if(!w)continue;const [a,r]=ammoOf(u,w);floorDrop(sim,w,u.x,u.y,u.z,a,r,u.id);u[slotOf(w)]=null;}
 if(!sim.floor.length)return; // buy phase included: teammates hand guns to each other
 for(const u of sim.units){if(!able(sim,u))continue;
  for(const d of sim.floor){if(Math.abs(d.y-u.y)>1.2)continue;const r=Math.hypot(d.x-u.x,d.z-u.z),slot=slotOf(d.w),mine=d.dropper===u.id&&sim.time<d.graceUntil;
   // Empty slot: walk over to pick up (Valorant). Bots also trade up to a better primary they walk past.
   if(!mine&&r<AUTO_RANGE&&!u[slot]){take(sim,u,d);break;}
   if(!u.human&&!mine&&slot==='primary'&&r<1.5&&(RANK[d.w]??5)>(RANK[u.primary]??-1)){take(sim,u,d);break;}}}}
export function floorRows(sim){return (sim.floor||[]).map(d=>d.sk?[d.id,d.w,+d.x.toFixed(2),+d.y.toFixed(2),+d.z.toFixed(2),d.sk]:[d.id,d.w,+d.x.toFixed(2),+d.y.toFixed(2),+d.z.toFixed(2)]);}
