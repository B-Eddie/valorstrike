import {abilityDamage} from './abilities.js';
// Server-authoritative devices that used to be inert markers: recon pulses (Sova Recon Bolt / Owl Drone,
// Cypher Spycam) now reveal, Raze's Boom Bot hunts and explodes, Skye's Trailblazer concusses.
// Intent-only like the ults: position, targets and timing are server state.
export const DEV={
 recon:{pulses:[.9,2.5],radius:20,reveal:1.6},
 boombot:{life:5,speed:6,sight:10,trigger:1.2,damage:125,radius:3},
 trail:{life:3,speed:9,trigger:2,concuss:2.5,radius:4}
};
const losClear=(sim,o,p)=>{const q=p.map((n,i)=>n-o[i]),len=Math.hypot(...q);if(len<.05)return true;return sim.world.ray(o,q.map(n=>n/len),Math.max(0,len-.4))===Infinity;};
const chest=v=>[v.x,v.y+1.2-(v.ch||0)*.5,v.z];
export function startDevice(sim,u,ty,p,push){
 if(ty==='drone'&&u.agent==='Raze'){push('boombot',DEV.boombot.life,DEV.boombot.radius,{p:[u.x,u.y+.2,u.z],yaw:u.look});return true;}
 if(ty==='drone'&&u.agent==='Skye'){push('trail',DEV.trail.life,DEV.trail.radius,{p:[u.x,u.y+.2,u.z],yaw:u.look});return true;}
 if(ty==='recon'||ty==='drone'){push('recon',Math.max(...DEV.recon.pulses)+.1,DEV.recon.radius,{pulses:DEV.recon.pulses.map(t=>sim.time+t)});return true;}
 return false;
}
// Moves a ground device one step along yaw; returns false when blocked.
function crawl(sim,e,dt,speed){const x=e.p[0]-Math.sin(e.yaw)*speed*dt,z=e.p[2]-Math.cos(e.yaw)*speed*dt;if(sim.world.blocked(x,z,.25,e.p[1]-.2,.5))return false;const y=sim.world.ground(x,z,e.p[1]+.5);if(!Number.isFinite(y)||Math.abs(y+.2-e.p[1])>.6)return false;e.p=[x,y+.2,z];return true;}
export function tickDevices(sim,dt){
 for(let i=sim.effects.length-1;i>=0;i--){const e=sim.effects[i];if(!['recon','boombot','trail'].includes(e.kind))continue;const owner=sim.units.find(u=>u.id===e.owner),foes=sim.units.filter(v=>v.alive&&!v.loading&&v.team!==e.team);
  if(e.kind==='recon'){while(e.pulses&&e.pulses.length&&sim.time>=e.pulses[0]){e.pulses.shift();const o=[e.p[0],e.p[1]+.5,e.p[2]];for(const v of foes)if(Math.hypot(v.x-o[0],v.z-o[2])<e.radius&&losClear(sim,o,chest(v)))v.revealedUntil=Math.max(v.revealedUntil||0,sim.time+DEV.recon.reveal);}continue;}
  const C=e.kind==='boombot'?DEV.boombot:DEV.trail,o=[e.p[0],e.p[1]+.3,e.p[2]];
  // Boom Bot locks onto the nearest enemy it can see; Trailblazer runs straight.
  if(e.kind==='boombot'){const seen=foes.filter(v=>Math.hypot(v.x-o[0],v.z-o[2])<C.sight&&losClear(sim,o,chest(v))).sort((a,b)=>Math.hypot(a.x-o[0],a.z-o[2])-Math.hypot(b.x-o[0],b.z-o[2]))[0];if(seen)e.yaw=Math.atan2(o[0]-seen.x,o[2]-seen.z);}
  const hit=foes.find(v=>Math.hypot(v.x-o[0],v.z-o[2])<C.trigger&&Math.abs(v.y-e.p[1])<2);
  if(hit){sim.effects.splice(i,1);for(const v of foes)if(Math.hypot(v.x-o[0],v.z-o[2])<C.radius&&Math.abs(v.y-e.p[1])<2.5&&losClear(sim,o,chest(v))){if(e.kind==='boombot')abilityDamage(sim,owner,v,C.damage);else{v.concussUntil=Math.max(v.concussUntil||0,sim.time+C.concuss);v.slowUntil=Math.max(v.slowUntil||0,sim.time+C.concuss);}}continue;}
  if(!crawl(sim,e,dt,C.speed)){if(e.kind==='boombot'){const yaw=e.yaw+Math.PI/2;e.yaw=yaw;}else e.until=sim.time;}
 }
}
