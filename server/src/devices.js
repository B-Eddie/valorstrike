import {abilityDamage} from './abilities.js';
import {WINDUP,wf} from './windups.js';
// Server-authoritative devices that used to be inert markers: recon pulses (Sova Recon Bolt / Owl Drone,
// Cypher Spycam) now reveal, Raze's Boom Bot hunts and explodes, Skye's Trailblazer concusses.
// Phoenix (Blaze, Hot Hands self-heal, Curveball), Killjoy (Nanoswarm, Alarmbot, Turret arc), Cypher (Trapwire,
// Cyber Cage) and Chamber (Trademark, Headhunter) replace the shared generic smoke/slow/fire markers.
// Intent-only like the ults: position, targets and timing are server state. Values follow the project's
// lightweight kit interpretation of the original abilities (not datamined numbers).
export const DEV={
 recon:{pulses:[.9,2.5],radius:20,reveal:1.6},
 blaze:{life:8,length:12,width:.8,height:3,damage:30,heal:12.5},
 hotHands:{life:4,radius:4.5,grow:.75,damage:60,heal:12.5},/* wiki Hot_Hands: 4 s, spreads to 4.5 m over 0.75 s, then 3.25 s at full size */
 curveball:{ahead:5,side:2.5,windup:wf('curveball'),blind:1.1,radius:30},
 nanoswarm:{life:120,active:5,radius:4,damage:45},
 alarmbot:{life:120,sight:5.5,speed:5,trigger:1.5,radius:3,vulnerable:4},
 turret:{life:20,range:30,arc:Math.PI/2,damage:12,interval:.7,tag:.5},
 trapwire:{life:120,arm:WINDUP.trapwire,reach:7.5,width:.4,tether:2.5,daze:2.5},
 cage:{life:7.25},
 trademark:{life:120,sight:10,arm:.5,armDeploy:WINDUP.trademark,radius:6,field:9.5},
 headhunter:{weapon:'Sheriff',ammo:1},
 boombot:{life:5,speed:6,sight:10,trigger:1.2,damage:125,radius:3},
 trail:{life:3,speed:9,trigger:2,concuss:2.5,radius:4}
};
const losClear=(sim,o,p)=>{const q=p.map((n,i)=>n-o[i]),len=Math.hypot(...q);if(len<.05)return true;return sim.world.ray(o,q.map(n=>n/len),Math.max(0,len-.4))===Infinity;};
const chest=v=>[v.x,v.y+1.2-(v.ch||0)*.5,v.z];
const fwd=u=>[-Math.sin(u.look),0,-Math.cos(u.look)];
export function startDevice(sim,u,ty,p,push,m={}){
 if(ty==='drone'&&u.agent==='Raze'){push('boombot',DEV.boombot.life,DEV.boombot.radius,{p:[u.x,u.y+.2,u.z],yaw:u.look});return true;}
 if(ty==='drone'&&u.agent==='Skye'){push('trail',DEV.trail.life,DEV.trail.radius,{p:[u.x,u.y+.2,u.z],yaw:u.look});return true;}
 if(ty==='recon'||ty==='drone'){push('recon',Math.max(...DEV.recon.pulses)+.1,DEV.recon.radius,{pulses:DEV.recon.pulses.map(t=>sim.time+t)});return true;}
 const f=fwd(u);
 // Phoenix Blaze: a straight wall of fire along his aim from his feet; blocks sight, burns enemies, heals him.
 if(u.agent==='Phoenix'&&ty==='wall'){let len=DEV.blaze.length;const hit=sim.world.ray([u.x,u.y+.5,u.z],f,len+1);if(Number.isFinite(hit))len=Math.max(1,hit-.3);push('blaze',DEV.blaze.life,DEV.blaze.width,{p:[u.x+f[0],u.y,u.z+f[2]],q:[u.x+f[0]*len,u.y,u.z+f[2]*len]});return true;}
 if(u.agent==='Phoenix'&&ty==='fire'){const H=DEV.hotHands;push('fire',H.life,0,{full:H.radius,grow:H.grow,born:sim.time,rate:H.damage,selfHeal:H.heal});return true;}/* the zone spreads (radius grows, tickAbilities) */
 // Curveball bends right (m.l: left) and pops beside the corner, not at the crosshair.
 if(u.agent==='Phoenix'&&ty==='flash'){const C=DEV.curveball,side=m.l?-1:1,r=[-f[2]*side,0,f[0]*side],o=[u.x,u.y+1.6,u.z];let a=C.ahead;const h=sim.world.ray(o,f,a);if(Number.isFinite(h))a=Math.max(.5,h-.4);const mid=[o[0]+f[0]*a,o[1],o[2]+f[2]*a];let b=C.side;const h2=sim.world.ray(mid,r,b);if(Number.isFinite(h2))b=Math.max(0,h2-.4);push('flash',C.windup+.1,C.radius,{p:[mid[0]+r[0]*b,o[1],mid[2]+r[2]*b],at:sim.time+C.windup,blind:C.blind});return true;}
 // Killjoy Nanoswarm hides at the aim point until recast (C again); Alarmbot waits for an enemy to walk by.
 if(u.agent==='Killjoy'&&ty==='fire'){push('nanoswarm',DEV.nanoswarm.life,DEV.nanoswarm.radius,{armed:false});return true;}
 if(u.agent==='Killjoy'&&ty==='trap'){push('alarmbot',DEV.alarmbot.life,DEV.alarmbot.radius,{chase:null});return true;}
 if(u.agent==='Killjoy'&&ty==='turret'){push('turret',DEV.turret.life,DEV.turret.range,{at:sim.time+DEV.turret.interval,yaw:u.look});return true;}
 // Cypher Trapwire: stretched across at the aim point, perpendicular to his view, to the walls either side.
 if(u.agent==='Cypher'&&ty==='trap'){const r=[-f[2],0,f[0]],o=[p[0],p[1]+.3,p[2]],span=d=>{const h=sim.world.ray(o,d,DEV.trapwire.reach);return Number.isFinite(h)?Math.max(.3,h-.05):DEV.trapwire.reach;},a=span(r),b=span(r.map(n=>-n));push('trapwire',DEV.trapwire.life,DEV.trapwire.width,{armAt:sim.time+DEV.trapwire.arm,p:[p[0]-r[0]*b,p[1],p[2]-r[2]*b],q:[p[0]+r[0]*a,p[1],p[2]+r[2]*a]});return true;}
 if(u.agent==='Cypher'&&ty==='smoke'){push('smoke',DEV.cage.life,4);return true;}
 if(u.agent==='Chamber'&&ty==='trap'){push('trademark',DEV.trademark.life,DEV.trademark.radius,{spotted:0,armAt:sim.time+DEV.trademark.armDeploy});return true;}
 // Chamber Headhunter: one round of the heavy pistol per charge; the previous gun comes back when it is spent,
 // put away (Q again), swapped off or Chamber dies.
 if(u.agent==='Chamber'&&ty==='headhun'){const H=DEV.headhunter;if(!u.inventory)u.inventory={};u.headhunter={saved:u.weapon,savedAmmo:u.ammo,savedReserve:u.reserve,savedSidearm:u.inventory[H.weapon]};u.inventory[u.weapon]=u.ammo;u.weapon=H.weapon;u.ammo=H.ammo;u.reserve=0;u.reloadAt=0;p.splice(0,3,u.x,u.y,u.z);return true;}
 return false;
}
// Checks before a charge is spent. Returns true/false to answer the intent, undefined to continue the cast.
export function preCastDevice(sim,u,k){
 const A=u.ability;
 if(u.agent==='Killjoy'&&k==='c'){const dormant=sim.effects.filter(e=>e.kind==='nanoswarm'&&e.owner===u.id&&!e.armed);if(dormant.length){for(const e of dormant){e.armed=true;e.until=sim.time+DEV.nanoswarm.active;}A.cool.c=sim.time+.3;sim.castEvents.push({t:'ac',i:u.id,ag:u.agent,k,o:[u.x,u.y+1.6,u.z],d:fwd(u),p:dormant[0].p,ts:Math.round(sim.time*1000)});return true;}}
 if(u.agent==='Chamber'&&k==='q'){if(u.headhunter){if(u.weapon===DEV.headhunter.weapon&&u.ammo>0)A.q=Math.min(8,(A.q||0)+u.ammo);endHeadhunter(u);A.cool.q=sim.time+.3;return true;}if(u.ultWeapon)return false;}
 return undefined;
}
export function endHeadhunter(u){const H=u.headhunter;if(!H)return;u.headhunter=null;if(u.weapon===DEV.headhunter.weapon){u.weapon=H.saved;u.ammo=H.savedAmmo;u.reserve=H.savedReserve;u.reloadAt=0;}if(u.inventory){if(H.savedSidearm===undefined||H.saved===DEV.headhunter.weapon)delete u.inventory[DEV.headhunter.weapon];else u.inventory[DEV.headhunter.weapon]=H.savedSidearm;if(H.saved===DEV.headhunter.weapon)u.inventory[H.saved]=H.savedAmmo;}}
export function resetDevices(u){u.headhunter=null;u.vulnerableUntil=0;u.tetheredUntil=0;}
const segDist=(e,x,z)=>{const ax=e.p[0],az=e.p[2],dx=e.q[0]-ax,dz=e.q[2]-az,l2=dx*dx+dz*dz||1e-9,t=Math.max(0,Math.min(1,((x-ax)*dx+(z-az)*dz)/l2));return Math.hypot(x-ax-dx*t,z-az-dz*t);};
// Blaze blocks sight like a smoke: true when the segment o..o+d*max crosses the fire wall below its top.
export function blazeBlocks(sim,o,d,max){for(const e of sim.effects){if(e.kind!=='blaze'||e.until<sim.time)continue;const n=24;for(let i=0;i<=n;i++){const t=max*i/n,x=o[0]+d[0]*t,y=o[1]+d[1]*t,z=o[2]+d[2]*t;if(y>=e.p[1]-.1&&y<=e.p[1]+DEV.blaze.height&&segDist(e,x,z)<DEV.blaze.width)return true;}}return false;}
// Moves a ground device one step along yaw; returns false when blocked.
function crawl(sim,e,dt,speed){const x=e.p[0]-Math.sin(e.yaw)*speed*dt,z=e.p[2]-Math.cos(e.yaw)*speed*dt;if(sim.world.blocked(x,z,.25,e.p[1]-.2,.5))return false;const y=sim.world.ground(x,z,e.p[1]+.5);if(!Number.isFinite(y)||Math.abs(y+.2-e.p[1])>.6)return false;e.p=[x,y+.2,z];return true;}
const KINDS=new Set(['recon','boombot','trail','blaze','nanoswarm','alarmbot','trapwire','trademark']);
export function tickDevices(sim,dt){
 for(const u of sim.units){if(u.headhunter&&(!u.alive||u.weapon!==DEV.headhunter.weapon||u.ammo<=0))endHeadhunter(u);
  if(u.tether&&sim.time>=u.tether.at){if(u.alive){u.concussUntil=Math.max(u.concussUntil||0,sim.time+DEV.trapwire.daze);u.slowUntil=Math.max(u.slowUntil||0,sim.time+DEV.trapwire.daze);}u.tether=null;}}
 for(let i=sim.effects.length-1;i>=0;i--){const e=sim.effects[i];if(!KINDS.has(e.kind))continue;if(e.until<sim.time)continue;sim.fxSrc=e;const owner=sim.units.find(u=>u.id===e.owner),foes=sim.units.filter(v=>v.alive&&!v.loading&&v.team!==e.team);
  if(e.kind==='recon'){while(e.pulses&&e.pulses.length&&sim.time>=e.pulses[0]){e.pulses.shift();const o=[e.p[0],e.p[1]+.5,e.p[2]];for(const v of foes)if(Math.hypot(v.x-o[0],v.z-o[2])<e.radius&&losClear(sim,o,chest(v)))v.revealedUntil=Math.max(v.revealedUntil||0,sim.time+DEV.recon.reveal);}continue;}
  if(e.kind==='blaze'){const B=DEV.blaze,inWall=v=>Math.abs(v.y-e.p[1])<B.height&&segDist(e,v.x,v.z)<B.width;for(const v of foes)if(inWall(v))abilityDamage(sim,owner,v,B.damage*dt);if(owner?.alive&&inWall(owner)&&owner.hp<100)owner.hp=Math.min(100,owner.hp+B.heal*dt);continue;}
  if(e.kind==='nanoswarm'){if(!e.armed)continue;for(const v of foes)if(Math.hypot(v.x-e.p[0],v.z-e.p[2])<e.radius&&Math.abs(v.y-e.p[1])<3&&losClear(sim,[e.p[0],e.p[1]+.4,e.p[2]],chest(v)))abilityDamage(sim,owner,v,DEV.nanoswarm.damage*dt);continue;}
  if(e.kind==='trapwire'){const T=DEV.trapwire;if(sim.time<(e.armAt||0))continue;/* 0.7 s arm (wiki windup) */for(const v of foes)if(!v.tether&&Math.abs(v.y-e.p[1])<1.5&&segDist(e,v.x,v.z)<T.width){v.tether={at:sim.time+T.tether};v.tetheredUntil=sim.time+T.tether;v.revealedUntil=Math.max(v.revealedUntil||0,sim.time+T.tether);v.slowUntil=Math.max(v.slowUntil||0,sim.time+T.tether);e.until=sim.time;break;}continue;}
  if(e.kind==='trademark'){const T=DEV.trademark,o=[e.p[0],e.p[1]+.3,e.p[2]];if(e.field){for(const v of foes)if(Math.hypot(v.x-o[0],v.z-o[2])<T.radius&&Math.abs(v.y-e.p[1])<3)v.slowUntil=Math.max(v.slowUntil||0,sim.time+.2);continue;}
   if(sim.time<(e.armAt||0))continue;/* 2 s arm after placement (wiki windup) */const seen=foes.some(v=>Math.hypot(v.x-o[0],v.z-o[2])<T.sight&&Math.abs(v.y-e.p[1])<4&&losClear(sim,o,chest(v)));if(!seen){e.spotted=0;continue;}if(!e.spotted)e.spotted=sim.time;if(sim.time-e.spotted>=T.arm){e.field=true;e.until=sim.time+T.field;}continue;}
  if(e.kind==='alarmbot'){const C=DEV.alarmbot,o=[e.p[0],e.p[1]+.3,e.p[2]];let v=e.chase!=null&&foes.find(f=>f.id===e.chase);if(!v||!losClear(sim,o,chest(v))||Math.hypot(v.x-o[0],v.z-o[2])>C.sight*2){v=foes.filter(f=>Math.hypot(f.x-o[0],f.z-o[2])<C.sight&&Math.abs(f.y-e.p[1])<3&&losClear(sim,o,chest(f))).sort((a,b)=>Math.hypot(a.x-o[0],a.z-o[2])-Math.hypot(b.x-o[0],b.z-o[2]))[0];e.chase=v?v.id:null;}
   if(!v)continue;if(Math.hypot(v.x-o[0],v.z-o[2])<C.trigger){sim.effects.splice(i,1);for(const w of foes)if(Math.hypot(w.x-o[0],w.z-o[2])<C.radius&&Math.abs(w.y-e.p[1])<2.5&&losClear(sim,o,chest(w)))w.vulnerableUntil=Math.max(w.vulnerableUntil||0,sim.time+C.vulnerable);continue;}
   e.yaw=Math.atan2(o[0]-v.x,o[2]-v.z);crawl(sim,e,dt,C.speed);continue;}
  const C=e.kind==='boombot'?DEV.boombot:DEV.trail,o=[e.p[0],e.p[1]+.3,e.p[2]];
  // Boom Bot locks onto the nearest enemy it can see; Trailblazer runs straight.
  if(e.kind==='boombot'){const seen=foes.filter(v=>Math.hypot(v.x-o[0],v.z-o[2])<C.sight&&losClear(sim,o,chest(v))).sort((a,b)=>Math.hypot(a.x-o[0],a.z-o[2])-Math.hypot(b.x-o[0],b.z-o[2]))[0];if(seen)e.yaw=Math.atan2(o[0]-seen.x,o[2]-seen.z);}
  const hit=foes.find(v=>Math.hypot(v.x-o[0],v.z-o[2])<C.trigger&&Math.abs(v.y-e.p[1])<2);
  if(hit){sim.effects.splice(i,1);for(const v of foes)if(Math.hypot(v.x-o[0],v.z-o[2])<C.radius&&Math.abs(v.y-e.p[1])<2.5&&losClear(sim,o,chest(v))){if(e.kind==='boombot')abilityDamage(sim,owner,v,C.damage);else{v.concussUntil=Math.max(v.concussUntil||0,sim.time+C.concuss);v.slowUntil=Math.max(v.slowUntil||0,sim.time+C.concuss);}}continue;}
  if(!crawl(sim,e,dt,C.speed)){if(e.kind==='boombot'){const yaw=e.yaw+Math.PI/2;e.yaw=yaw;}else e.until=sim.time;}
 }
}
