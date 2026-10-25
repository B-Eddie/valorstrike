import {abilityDamage} from './abilities.js';
// Server-authoritative ultimates for the agents that used to share one generic 100-damage blast.
// Same authority pattern as Blade Storm / Empress (reyna.js): the client sends only the intent
// ({t:'ab',k:'x'}); origin, aim, targets, timing, damage and status all come from server state.
// Values follow the project's lightweight kit interpretation, scaled to the original agents' ults.
export const ULT={
 fury:{blasts:3,interval:2,window:6.5,range:66,width:.9,damage:80,reveal:2,recast:.9},
 rocket:{speed:30,life:3,inner:3,outer:7,damage:150,arm:.05},
 lockdown:{windup:13,radius:32.5,detain:8},
 quake:{delay:.9,length:18,halfAngle:Math.PI/6,concuss:6},
 seekers:{count:3,speed:12,maxTravel:4,nearsight:3},
 theft:{reach:5,reveals:[1,3],reveal:1.6},
 tdf:{weapon:'Operator',ammo:5},
 rib:{window:10,protect:.5}
};
const eye=u=>[u.x,u.y+1.6-(u.ch||0),u.z];
const aim=u=>[-Math.sin(u.look)*Math.cos(u.pitch||0),Math.sin(u.pitch||0),-Math.cos(u.look)*Math.cos(u.pitch||0)];
const enemies=(sim,u)=>sim.units.filter(v=>v!==u&&v.team!==u.team&&v.alive&&!v.loading);
const effect=(sim,u,kind,p,seconds,radius,extra={})=>{const e={id:++sim.effectSeq,kind,owner:u.id,team:u.team,p:[...p],until:sim.time+seconds,radius,...extra};sim.effects.push(e);return e;};
export function resetUlts(u){u.detainUntil=0;u.revealedUntil=0;u.runItBack=null;if(u.ultWeapon){u.ultWeapon=null;}if(u.ability)u.ability.fury=null;}

// Pre-cast checks that may reject the intent before the ult points are spent. Returns false to reject,
// or a context object handed to startUlt.
export function ultTarget(sim,u){
 if(u.agent==='Cypher'){const d=aim(u),o=eye(u);const corpse=sim.units.filter(v=>v.team!==u.team&&!v.alive&&!v.loading).find(v=>{const q=[v.x-u.x,v.y+.3-o[1],v.z-u.z],len=Math.hypot(...q);return len<ULT.theft.reach&&(len<.3||q.reduce((s,n,i)=>s+n*d[i],0)/len>.7)&&sim.world.ray(o,q.map(n=>n/Math.max(.01,len)),Math.max(0,len-.4))===Infinity;});return corpse?{corpse}:false;}
 if(u.agent==='Phoenix'&&u.runItBack)return false;
 if(u.agent==='Chamber'&&u.ultWeapon)return false;
 if(u.agent==='Sova'&&u.ability?.fury)return false;
 return {};
}
export const ULT_AGENTS=new Set(['Sova','Raze','Killjoy','Breach','Skye','Cypher','Chamber','Phoenix']);

// Applies the ult. p is the cast-event point (mutated for the client marker).
export function startUlt(sim,u,ctx,p){
 const A=u.ability;
 switch(u.agent){
  case 'Sova':{A.fury={left:ULT.fury.blasts,next:sim.time+ULT.fury.interval,until:sim.time+ULT.fury.window,recastAt:sim.time+ULT.fury.recast};furyBlast(sim,u);break;}
  case 'Raze':{const o=eye(u),d=aim(u);effect(sim,u,'rocket',o,ULT.rocket.life,ULT.rocket.outer,{d,born:sim.time});break;}
  case 'Killjoy':{const d=aim(u),o=eye(u),hit=sim.world.ray(o,d,4),r=Number.isFinite(hit)?Math.max(0,hit-.5):4,x=o[0]+d[0]*r,z=o[2]+d[2]*r,y=sim.world.ground(x,z,u.y+.5);const pt=[x,Number.isFinite(y)?y:u.y,z];p.splice(0,3,...pt);effect(sim,u,'lockdown',pt,ULT.lockdown.windup+.05,ULT.lockdown.radius,{at:sim.time+ULT.lockdown.windup});break;}
  case 'Breach':{p.splice(0,3,u.x,u.y,u.z);effect(sim,u,'quake',[u.x,u.y,u.z],ULT.quake.delay+.05,ULT.quake.length,{at:sim.time+ULT.quake.delay,yaw:u.look});break;}
  case 'Skye':{const list=enemies(sim,u).sort((a,b)=>Math.hypot(a.x-u.x,a.z-u.z)-Math.hypot(b.x-u.x,b.z-u.z)).slice(0,ULT.seekers.count);for(const v of list){const t=Math.min(ULT.seekers.maxTravel,Math.hypot(v.x-u.x,v.y-u.y,v.z-u.z)/ULT.seekers.speed);effect(sim,u,'seeker',[u.x,u.y+1,u.z],t+.05,0,{target:v.id,at:sim.time+t});}break;}
  case 'Cypher':{const c=ctx.corpse;p.splice(0,3,c.x,c.y,c.z);for(const dt of ULT.theft.reveals)effect(sim,u,'theft',[c.x,c.y,c.z],dt+.05,0,{at:sim.time+dt});break;}
  case 'Chamber':{u.ultWeapon={saved:u.weapon,savedAmmo:u.ammo,savedReserve:u.reserve};u.inventory[u.weapon]=u.ammo;u.weapon=ULT.tdf.weapon;u.ammo=ULT.tdf.ammo;u.reserve=0;u.reloadAt=0;break;}
  case 'Phoenix':{u.runItBack={p:[u.x,u.y,u.z],until:sim.time+ULT.rib.window,hp:u.hp,armor:u.armor};p.splice(0,3,u.x,u.y,u.z);break;}
 }
}

// Recast of an active ult (Hunter's Fury fires its next blast early). Returns true when consumed.
export function recastUlt(sim,u){const F=u.ability?.fury;if(u.agent==='Sova'&&F){if(sim.time<F.recastAt||F.left<1)return true;furyBlast(sim,u);return true;}return false;}

// One wall-piercing Hunter's Fury blast along the current server-side aim.
function furyBlast(sim,u){const F=u.ability.fury,o=eye(u),d=aim(u),C=ULT.fury;F.left--;F.next=sim.time+C.interval;F.recastAt=sim.time+C.recast;
 for(const v of enemies(sim,u)){let best=Infinity;for(const h of [1.62,.95,.35]){const q=[v.x-o[0],v.y+h-(v.ch||0)-o[1],v.z-o[2]],t=q.reduce((s,n,i)=>s+n*d[i],0);if(t<0||t>C.range)continue;const off=Math.sqrt(Math.max(0,q.reduce((s,n)=>s+n*n,0)-t*t));best=Math.min(best,off);}if(best<C.width){v.revealedUntil=Math.max(v.revealedUntil||0,sim.time+C.reveal);abilityDamage(sim,u,v,C.damage);}}
 sim.castEvents.push({t:'ac',i:u.id,ag:u.agent,k:'x',sub:'blast',o,d,p:o.map((n,i)=>n+d[i]*C.range),ts:Math.round(sim.time*1000)});
 if(F.left<1)u.ability.fury=null;}

// Per-tick ult state: channels, projectiles, delayed area effects, weapon swaps and the Phoenix return.
export function tickUlts(sim,dt){
 for(const u of sim.units){
  const F=u.ability?.fury;if(F){if(!u.alive||sim.time>=F.until)u.ability.fury=null;else if(sim.time>=F.next&&F.left>0)furyBlast(sim,u);}
  if(u.ultWeapon&&(!u.alive||u.weapon!==ULT.tdf.weapon||u.ammo<=0)){const W=u.ultWeapon;u.ultWeapon=null;if(u.weapon===ULT.tdf.weapon){u.weapon=W.saved;u.ammo=W.savedAmmo;u.reserve=W.savedReserve;}if(u.inventory)delete u.inventory[ULT.tdf.weapon];}
  const R=u.runItBack;if(R&&!u.loading&&(!u.alive||sim.time>=R.until)){u.runItBack=null;[u.x,u.y,u.z]=R.p;u.vx=u.vz=u.vy=0;u.hp=100;u.alive=true;u.respawnAt=0;u.input={};u.triggerHeld=false;u.seq++;u.invulnerableUntil=Math.max(u.invulnerableUntil||0,sim.time+ULT.rib.protect);sim.castEvents.push({t:'ac',i:u.id,ag:u.agent,k:'x',sub:'return',o:[...R.p],d:[0,0,-1],p:[...R.p],ts:Math.round(sim.time*1000)});}
 }
 for(let i=sim.effects.length-1;i>=0;i--){const e=sim.effects[i],owner=sim.units.find(u=>u.id===e.owner);
  if(e.kind==='rocket'){const C=ULT.rocket,step=C.speed*dt,d=e.d,hit=sim.world.ray(e.p,d,step);let at=Number.isFinite(hit)?hit:null;
   if(sim.time-e.born>C.arm)for(const v of sim.units){if(!v.alive||v.loading||v.id===e.owner)continue;const q=[v.x-e.p[0],v.y+1-e.p[1],v.z-e.p[2]],t=Math.max(0,Math.min(step,q.reduce((s,n,k)=>s+n*d[k],0)));if(q.reduce((s,n,k)=>s+(n-d[k]*t)**2,0)<.8*.8&&(at==null||t<at))at=t;}
   if(at==null&&sim.time+dt<e.until){for(let k=0;k<3;k++)e.p[k]+=d[k]*step;continue;}
   const t=at==null?step:at;for(let k=0;k<3;k++)e.p[k]+=d[k]*Math.max(0,t-.05);sim.effects.splice(i,1);
   for(const v of sim.units){if(!v.alive||v.loading||v.team===e.team)continue;const r=Math.hypot(v.x-e.p[0],v.y+1-e.p[1],v.z-e.p[2]);if(r>=C.outer)continue;const o=[e.p[0],e.p[1],e.p[2]],q=[v.x-o[0],v.y+1-o[1],v.z-o[2]],len=Math.hypot(...q);if(len>.5&&sim.world.ray(o,q.map(n=>n/len),len-.4)!==Infinity)continue;const n=r<=C.inner?C.damage:C.damage*(C.outer-r)/(C.outer-C.inner);abilityDamage(sim,owner,v,n);}
   sim.castEvents.push({t:'ac',i:e.owner,ag:'Raze',k:'x',sub:'boom',o:[...e.p],d:[...d],p:[...e.p],ts:Math.round(sim.time*1000)});continue;}
  if(e.kind==='lockdown'&&sim.time>=e.at){sim.effects.splice(i,1);for(const v of sim.units)if(v.alive&&!v.loading&&v.team!==e.team&&Math.hypot(v.x-e.p[0],v.z-e.p[2])<e.radius&&Math.abs(v.y-e.p[1])<8){v.detainUntil=Math.max(v.detainUntil||0,sim.time+ULT.lockdown.detain);v.slowUntil=Math.max(v.slowUntil||0,sim.time+ULT.lockdown.detain);}continue;}
  if(e.kind==='quake'&&sim.time>=e.at){sim.effects.splice(i,1);const fx=-Math.sin(e.yaw),fz=-Math.cos(e.yaw),C=ULT.quake;for(const v of sim.units){if(!v.alive||v.loading||v.team===e.team||Math.abs(v.y-e.p[1])>4)continue;const dx=v.x-e.p[0],dz=v.z-e.p[2],f=dx*fx+dz*fz,sd=Math.abs(dx*fz-dz*fx);if(f>0&&f<C.length&&Math.atan2(sd,f)<C.halfAngle+.12){v.concussUntil=Math.max(v.concussUntil||0,sim.time+C.concuss);v.slowUntil=Math.max(v.slowUntil||0,sim.time+C.concuss);}}continue;}
  if(e.kind==='seeker'){const v=sim.units.find(x=>x.id===e.target);if(!v||!v.alive){sim.effects.splice(i,1);continue;}if(sim.time>=e.at){v.nearsightUntil=Math.max(v.nearsightUntil||0,sim.time+ULT.seekers.nearsight);sim.effects.splice(i,1);}else e.p=[v.x,v.y+1,v.z];continue;}
  if(e.kind==='theft'&&sim.time>=e.at){sim.effects.splice(i,1);for(const v of sim.units)if(v.alive&&!v.loading&&v.team!==e.team)v.revealedUntil=Math.max(v.revealedUntil||0,sim.time+ULT.theft.reveal);continue;}
 }
}

// Enemies the viewer's team currently has revealed by an ult (Hunter's Fury hit, Neural Theft).
export function revealedFor(sim,u){return sim.units.filter(v=>v.team!==u.team&&v.alive&&(v.revealedUntil||0)>sim.time).map(v=>[v.id,+v.x.toFixed(2),+v.y.toFixed(2),+v.z.toFixed(2)]);}
