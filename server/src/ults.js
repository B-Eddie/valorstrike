import {abilityDamage} from './abilities.js';
import {endHeadhunter} from './devices.js';
import {WINDUP,wf} from './windups.js';
// Server-authoritative ultimates for the agents that used to share one generic 100-damage blast.
// Same authority pattern as Blade Storm / Empress (reyna.js): the client sends only the intent
// ({t:'ab',k:'x'}); origin, aim, targets, timing, damage and status all come from server state.
// Values follow the project's lightweight kit interpretation, scaled to the original agents' ults.
export const ULT={
 fury:{blasts:3,cycle:2.125,window:6,range:66,width:1.76,damage:80,reveal:1},/* wiki Hunter's_Fury: 3 charges, 1 every 2.125 s, 6 s, 66 m x 1.76 m radius, 80, reveal 1 s; blasts only on FIRE (recast); client XHF */
 rocket:{speed:30,life:3,inner:4,outer:7,damage:150,min:30,arm:.05,equip:WINDUP.showstopper,window:10},/* wiki Showstopper: X equips the launcher (1.4 s), FIRE shoots the one rocket, 10 s max including the equip */
 lockdown:{windup:WINDUP.lockdown,radius:32.5,detain:8},
 quake:{delay:wf('rollingThunder'),near:8,length:32,width:18,concuss:4,ticks:8,gap:.255,push:7,force:.5,up:7},/* wiki Rolling_Thunder: a 32 m x 18 m strip starting 8 m in front of Breach, concuss 4 s; client XRT2 */
 seekers:{count:3,speed:12,maxTravel:15,nearsight:3,slow:5,slowK:.4},/* wiki Seekers: 3 seekers, 15 s max lifespan, 3 s Nearsight, 5 s 60 % Slow; speed 12 m/s: project value */
 theft:{reach:18,reveals:[2,6],reveal:1.6},/* wiki Neural_Theft: max cast distance 18 m (v5.10); 1st reveal 2 s windup, 2nd reveal windup 4 s counted from the 1st (v5.10 '4 s delay between reveals'), so 6 s after the cast; client CYNT matches */
 tdf:{weapon:'Operator',ammo:5,fireRate:.9,field:6,slow:4},/* wiki Tour_De_Force: 5 rounds, 0.9 shots/s (v8.03), 150 body x1.7 head x0.85 legs; a kill leaves a 6 m slow field under the victim for 4 s (50 %, everyone in it: friendly fire Yes (slow)); client XTDF */
 rib:{window:10,protect:.5}
};
const eye=u=>[u.x,u.y+1.6-(u.ch||0),u.z];
const aim=u=>[-Math.sin(u.look)*Math.cos(u.pitch||0),Math.sin(u.pitch||0),-Math.cos(u.look)*Math.cos(u.pitch||0)];
const enemies=(sim,u)=>sim.units.filter(v=>v!==u&&v.team!==u.team&&v.alive&&!v.loading);
const effect=(sim,u,kind,p,seconds,radius,extra={})=>{const e={id:++sim.effectSeq,kind,owner:u.id,ag:u.agent,team:u.team,p:[...p],until:sim.time+seconds,radius,...extra};sim.effects.push(e);return e;};
// Showstopper splash (wiki Showstopper: radii 4 m inner / 7 m outer, damage 30 - 150): full 150 inside 4 m, linear to 30 at 7 m, 0 beyond; client xSsDmg.
export function ssDamage(r){const C=ULT.rocket;return r<=C.inner?C.damage:r<C.outer?C.damage-(C.damage-C.min)*(r-C.inner)/(C.outer-C.inner):0;}
export function resetUlts(u){u.detainUntil=0;u.revealedUntil=0;u.sovaRevealUntil=0;u.runItBack=null;u.showstopper=null;if(u.ultWeapon){u.ultWeapon=null;}if(u.ability)u.ability.fury=null;}

// Pre-cast checks that may reject the intent before the ult points are spent. Returns false to reject,
// or a context object handed to startUlt.
export function ultTarget(sim,u){
 if(u.agent==='Cypher'){const d=aim(u),o=eye(u);const corpse=sim.units.filter(v=>v.team!==u.team&&!v.alive&&!v.loading).find(v=>{const q=[v.x-u.x,v.y+.3-o[1],v.z-u.z],len=Math.hypot(...q);return len<ULT.theft.reach&&(len<.3||q.reduce((s,n,i)=>s+n*d[i],0)/len>.7)&&sim.world.ray(o,q.map(n=>n/Math.max(.01,len)),Math.max(0,len-.4))===Infinity;});return corpse?{corpse}:false;}
 if(u.agent==='Phoenix'&&u.runItBack)return false;
 if(u.agent==='Raze'&&u.showstopper)return false;
 if(u.agent==='Chamber'&&u.ultWeapon)return false;
 if(u.agent==='Sova'&&u.ability?.fury)return false;
 return {};
}
export const ULT_AGENTS=new Set(['Sova','Raze','Killjoy','Breach','Skye','Cypher','Chamber','Phoenix']);

// Applies the ult. p is the cast-event point (mutated for the client marker).
export function startUlt(sim,u,ctx,p){
 const A=u.ability;
 switch(u.agent){
  case 'Sova':{A.fury={left:ULT.fury.blasts,until:sim.time+ULT.fury.window,recastAt:sim.time+ULT.fury.cycle};furyBlast(sim,u);break;}
  case 'Raze':{u.showstopper={ready:sim.time+ULT.rocket.equip,until:sim.time+ULT.rocket.window};p.splice(0,3,u.x,u.y,u.z);break;}/* the rocket leaves on FIRE (showstopperFire) */
  case 'Killjoy':{const d=aim(u),o=eye(u),hit=sim.world.ray(o,d,4),r=Number.isFinite(hit)?Math.max(0,hit-.5):4,x=o[0]+d[0]*r,z=o[2]+d[2]*r,y=sim.world.ground(x,z,u.y+.5);const pt=[x,Number.isFinite(y)?y:u.y,z];p.splice(0,3,...pt);effect(sim,u,'lockdown',pt,ULT.lockdown.windup+.05,ULT.lockdown.radius,{at:sim.time+ULT.lockdown.windup});break;}
  case 'Breach':{p.splice(0,3,u.x,u.y,u.z);effect(sim,u,'quake',[u.x,u.y,u.z],ULT.quake.delay+ULT.quake.ticks*ULT.quake.gap+.3,ULT.quake.length,{at:sim.time+ULT.quake.delay,next:sim.time+ULT.quake.delay,i:0,yaw:u.look});break;}
  case 'Skye':{const list=enemies(sim,u).sort((a,b)=>Math.hypot(a.x-u.x,a.z-u.z)-Math.hypot(b.x-u.x,b.z-u.z)).slice(0,ULT.seekers.count);for(const v of list){const t=Math.min(ULT.seekers.maxTravel,Math.hypot(v.x-u.x,v.y-u.y,v.z-u.z)/ULT.seekers.speed);effect(sim,u,'seeker',[u.x,u.y+1,u.z],t+.05,0,{target:v.id,at:sim.time+t});}break;}
  case 'Cypher':{const c=ctx.corpse;p.splice(0,3,c.x,c.y,c.z);for(const dt of ULT.theft.reveals)effect(sim,u,'theft',[c.x,c.y,c.z],dt+.05,0,{at:sim.time+dt});break;}
  case 'Chamber':{endHeadhunter(u);u.ultWeapon={saved:u.weapon,savedAmmo:u.ammo,savedReserve:u.reserve};u.inventory[u.weapon]=u.ammo;u.weapon=ULT.tdf.weapon;u.ammo=ULT.tdf.ammo;u.reserve=0;u.reloadAt=0;u.fireAt=Math.max(u.fireAt||0,sim.time+WINDUP.tourDeForce);/* 2.3 s equip (wiki windup) */break;}
  case 'Phoenix':{u.runItBack={p:[u.x,u.y,u.z],until:sim.time+ULT.rib.window,hp:u.hp,armor:u.armor};effect(sim,u,'rib',[u.x,u.y,u.z],ULT.rib.window+.5,0,{});/* state row: the marker lives until the return (below) */p.splice(0,3,u.x,u.y,u.z);break;}
 }
}

// Showstopper FIRE (spike.js fire): while the launcher is out the trigger never fires the gun; before the 1.4 s equip it
// does nothing, after it the one rocket leaves along the server's own eye / aim. undefined = no launcher (normal gun fire).
export function showstopperFire(sim,u){const S=u.showstopper;if(!S)return undefined;if(sim.time<S.ready)return false;u.showstopper=null;u.triggerHeld=true;
 effect(sim,u,'rocket',eye(u),ULT.rocket.life,ULT.rocket.outer,{d:aim(u),born:sim.time});return true;}

// Recast of an active ult (Hunter's Fury fires its next blast early). Returns true when consumed.
export function recastUlt(sim,u){const F=u.ability?.fury;if(u.agent==='Sova'&&F){if(sim.time<F.recastAt||F.left<1)return true;furyBlast(sim,u);return true;}return false;}

// One wall-piercing Hunter's Fury blast along the current server-side aim.
function furyBlast(sim,u){const F=u.ability.fury,o=eye(u),d=aim(u),C=ULT.fury;F.left--;F.recastAt=sim.time+C.cycle;
 for(const v of sim.units.filter(v=>v!==u&&v.alive&&!v.loading)){/* Hunter's Fury: allies take 1/3 and are not revealed */let best=Infinity;for(const h of [1.62,.95,.35]){const q=[v.x-o[0],v.y+h-(v.ch||0)-o[1],v.z-o[2]],t=q.reduce((s,n,i)=>s+n*d[i],0);if(t<0||t>C.range)continue;const off=Math.sqrt(Math.max(0,q.reduce((s,n)=>s+n*n,0)-t*t));best=Math.min(best,off);}if(best<C.width){if(v.team!==u.team){v.revealedUntil=Math.max(v.revealedUntil||0,sim.time+C.reveal);v.sovaRevealUntil=Math.max(v.sovaRevealUntil||0,sim.time+C.reveal);}abilityDamage(sim,u,v,C.damage);}}
 sim.castEvents.push({t:'ac',i:u.id,ag:u.agent,k:'x',sub:'blast',o,d,p:o.map((n,i)=>n+d[i]*C.range),ts:Math.round(sim.time*1000)});
 if(F.left<1)u.ability.fury=null;}

// Per-tick ult state: channels, projectiles, delayed area effects, weapon swaps and the Phoenix return.
export function tickUlts(sim,dt){
 for(const u of sim.units){
  const F=u.ability?.fury;if(F&&(!u.alive||sim.time>=F.until))u.ability.fury=null;/* unfired charges are lost after 6 s (no auto blasts) */
  if(u.ultWeapon&&(!u.alive||u.weapon!==ULT.tdf.weapon||u.ammo<=0)){const W=u.ultWeapon;u.ultWeapon=null;if(u.weapon===ULT.tdf.weapon){u.weapon=W.saved;u.ammo=W.savedAmmo;u.reserve=W.savedReserve;}if(u.inventory)delete u.inventory[ULT.tdf.weapon];}
  if(u.showstopper&&(!u.alive||sim.time>=u.showstopper.until))u.showstopper=null;/* unfired launcher put away after 10 s */
  const R=u.runItBack;if(R&&!u.loading&&(!u.alive||sim.time>=R.until)){const died=!u.alive,bodyAt=[u.x,u.y,u.z];u.runItBack=null;for(let i=sim.effects.length-1;i>=0;i--)if(sim.effects[i].kind==='rib'&&sim.effects[i].owner===u.id)sim.effects.splice(i,1);[u.x,u.y,u.z]=R.p;u.vx=u.vz=u.vy=0;u.hp=100;u.alive=true;u.respawnAt=0;u.input={};u.triggerHeld=false;u.seq++;u.invulnerableUntil=Math.max(u.invulnerableUntil||0,sim.time+ULT.rib.protect);sim.castEvents.push({t:'ac',i:u.id,ag:u.agent,k:'x',sub:died?'retdeath':'return',o:died?bodyAt:[...R.p],d:[0,0,-1],p:[...R.p],ts:Math.round(sim.time*1000)});}
 }
 for(let i=sim.effects.length-1;i>=0;i--){const e=sim.effects[i],owner=(sim.fxSrc=e,sim.units.find(u=>u.id===e.owner));
  if(e.kind==='rocket'){const C=ULT.rocket,step=C.speed*dt,d=e.d,hit=sim.world.ray(e.p,d,step);let at=Number.isFinite(hit)?hit:null;
   if(sim.time-e.born>C.arm)for(const v of sim.units){if(!v.alive||v.loading||v.id===e.owner)continue;const q=[v.x-e.p[0],v.y+1-e.p[1],v.z-e.p[2]],t=Math.max(0,Math.min(step,q.reduce((s,n,k)=>s+n*d[k],0)));if(q.reduce((s,n,k)=>s+(n-d[k]*t)**2,0)<.8*.8&&(at==null||t<at))at=t;}
   if(at==null&&sim.time+dt<e.until){for(let k=0;k<3;k++)e.p[k]+=d[k]*step;continue;}
   const t=at==null?step:at;for(let k=0;k<3;k++)e.p[k]+=d[k]*Math.max(0,t-.05);sim.effects.splice(i,1);
   for(const v of sim.units){if(!v.alive||v.loading||v.id===e.owner)continue;/* Showstopper: allies take 1/3 (abilityDamage) */const r=Math.hypot(v.x-e.p[0],v.y+1-e.p[1],v.z-e.p[2]);if(r>=C.outer)continue;const o=[e.p[0],e.p[1],e.p[2]],q=[v.x-o[0],v.y+1-o[1],v.z-o[2]],len=Math.hypot(...q);if(len>.5&&sim.world.ray(o,q.map(n=>n/len),len-.4)!==Infinity)continue;const n=ssDamage(r);abilityDamage(sim,owner,v,n);}
   sim.castEvents.push({t:'ac',i:e.owner,ag:'Raze',k:'x',sub:'boom',o:[...e.p],d:[...d],p:[...e.p],ts:Math.round(sim.time*1000)});continue;}
  if(e.kind==='lockdown'&&sim.time>=e.at){sim.effects.splice(i,1);for(const v of sim.units)if(v.alive&&!v.loading&&v.team!==e.team&&Math.hypot(v.x-e.p[0],v.z-e.p[2])<e.radius&&Math.abs(v.y-e.p[1])<8){v.detainUntil=Math.max(v.detainUntil||0,sim.time+ULT.lockdown.detain);v.slowUntil=Math.max(v.slowUntil||0,sim.time+ULT.lockdown.detain);}continue;}
  if(e.kind==='quake'){/* wiki Rolling_Thunder: after the windup a cascading quake - 8 blasts 0.255 s apart, each in its own 4 m slice of the 32 m x 18 m strip as it travels forward; every blast concusses 4 s and knocks players back (7 m, stopped by walls) */
   if(sim.time>=e.next&&e.i<ULT.quake.ticks){const C=ULT.quake,seg=C.length/C.ticks,lo=C.near+seg*e.i,fx=-Math.sin(e.yaw),fz=-Math.cos(e.yaw);e.next+=C.gap;e.i++;
    for(const v of sim.units){if(!v.alive||v.loading||v.team===e.team||Math.abs(v.y-e.p[1])>4)continue;const dx=v.x-e.p[0],dz=v.z-e.p[2],f=dx*fx+dz*fz,sd=Math.abs(dx*fz-dz*fx);if(f>=lo&&f<lo+seg&&sd<C.width/2){v.concussUntil=Math.max(v.concussUntil||0,sim.time+C.concuss);v.slowUntil=Math.max(v.slowUntil||0,sim.time+C.concuss);v.vx=fx*C.push/C.force;v.vz=fz*C.push/C.force;v.vy=C.up;v.air=true;v.seq=(v.seq||0)+1;/* wiki: 7 m displacement, knocks UP; game files: Force Duration 0.5 s -> a launch (7 m / 0.5 s), walls stop it through the motor. Re-hit stacking and the launch height are unsourced */}}}
   continue;}
  if(e.kind==='seeker'&&!e.prowler&&!e.wing){const v=sim.units.find(x=>x.id===e.target);if(!v||!v.alive){sim.effects.splice(i,1);continue;}if(sim.time>=e.at){v.nearsightUntil=Math.max(v.nearsightUntil||0,sim.time+ULT.seekers.nearsight);v.seekSlowUntil=Math.max(v.seekSlowUntil||0,sim.time+ULT.seekers.slow);sim.effects.splice(i,1);}else e.p=[v.x,v.y+1,v.z];continue;}
  if(e.kind==='theft'&&sim.time>=e.at){sim.effects.splice(i,1);for(const v of sim.units)if(v.alive&&!v.loading&&v.team!==e.team)v.revealedUntil=Math.max(v.revealedUntil||0,sim.time+ULT.theft.reveal);continue;}
 }
}

// Active reveals: first four fields remain legacy-compatible; remaining seconds + Sova-only remaining
// let late joins rebuild current shells without replaying pulses or recolouring shared Cypher/Fade reveals.
export function revealedFor(sim,u){return sim.units.filter(v=>v.team!==u.team&&v.alive&&(v.revealedUntil||0)>sim.time).map(v=>[v.id,+v.x.toFixed(2),+v.y.toFixed(2),+v.z.toFixed(2),+(v.revealedUntil-sim.time).toFixed(3),+Math.max(0,Math.min(v.revealedUntil,v.sovaRevealUntil||0)-sim.time).toFixed(3)]);}
// Tour De Force kill: a 6 m, 4 s, 50 % slow field under the victim. Same effect as a spent Trademark's field (devices.js tickDevices
// trademark field branch: orbSlowUntil for everyone inside; deviceRows sends it to the page as the Trademark field, fp = the spot).
export function tdfKill(sim,u,v){if(!(u&&u.agent==='Chamber'&&u.ultWeapon&&u.weapon===ULT.tdf.weapon&&v))return null;const fp=[v.x,v.y,v.z];return effect(sim,u,'trademark',fp,ULT.tdf.slow,ULT.tdf.field,{field:true,fp:[...fp],hp:0,spotted:0,tdf:1});}
