import {abilityDamage,SMOKE,castYaw} from './abilities.js';
import {WINDUP,wf} from './windups.js';
// Server-authoritative devices that used to be inert markers: recon pulses (Sova Recon Bolt / Owl Drone,
// Cypher Spycam) now reveal, Raze's Boom Bot hunts and explodes, Skye's Trailblazer concusses.
// Phoenix (Blaze, Hot Hands self-heal, Curveball), Killjoy (Nanoswarm, Alarmbot, Turret arc), Cypher (Trapwire,
// Cyber Cage) and Chamber (Trademark, Headhunter) replace the shared generic smoke/slow/fire markers.
// Intent-only like the ults: position, targets and timing are server state. Values follow the project's
// lightweight kit interpretation of the original abilities (not datamined numbers).
// Turret damage per shot by distance (wiki Turret: 0-20 m 8, 20-35 m 6, 35+ m 4).
export function turretDamage(d){const T=DEV.turret;return d<T.near?T.dmg[0]:d<T.mid?T.dmg[1]:T.dmg[2];}
export const DEV={
 recon:{pulses:[.9,2.5],radius:20,reveal:1.6},
 owl:{pings:[1.6,3.4],reveal:.6,radius:20,life:7,lift:1.2,cd:5},/* cd: wiki Owl_Drone dart cooldown 5 s - the stand-in fires a 2nd dart 5 s in while the drone is still up (qa-32) *//* life: wiki Owl_Drone 7 s; lift: the body hovers 1.2 m over the aim point *//* wiki Owl_Drone: the dart's 2 pings, 1st 1.6 s after impact, 2nd 1.2 s after the 1st (0.6 s) ends; stand-in: the dart tags the nearest visible enemy within 20 m of the aim point at once; client XOWL */
 spycam:{deploy:1.15,every:2,reveal:1,radius:20,life:120,remove:1.85},/* life: the camera and its dart last the round; remove: wiki Spycam 'Dart removal channel time 1.85 seconds' - the target holds interact (h4), standing, not firing, not on the spike, and the dart is gone (any break restarts the channel) *//* wiki Spycam: 1.15 s deploy, the dart reveals 1 every 2 s, indefinitely until removed; stand-in: the cam darts the nearest visible enemy within 20 m once deployed, then pings every 2 s (1 s reveal: project value) until the victim dies or the round ends (no 1.85 s removal channel); client XSPY */
 reconBolt:{pulses:[.9,2.5],radius:30,reveal:.75},/* wiki Recon_Bolt: radius 30 m, 2 sonar pulses 1 every 1.6 s, 0.75 s reveal each (needs line of sight from the bolt); client XRCN matches */
 blaze:{life:8,length:12,width:.8,height:3,damage:30,heal:12.5},
 hotHands:{life:4,radius:4.5,grow:.75,damage:60,heal:12.5},/* wiki Hot_Hands: 4 s, spreads to 4.5 m over 0.75 s, then 3.25 s at full size */
 curveball:{ahead:5,side:2.5,windup:wf('curveball'),blind:1.5,radius:30},/* wiki Curveball: max blind 1.5 s (client jPop 1.5) */
 nanoswarm:{life:120,active:5,delay:1,radius:4.5,damage:45},/* wiki Nanoswarm: radius 4.5 m, 5 s, 1 s activation windup (0.5 s windup + 0.5 s damage delay) then 45/s (180 total); client XNANO */
 alarmbot:{life:120,deploy:1.85,active:40,sight:5.5,speed:22.5,trigger:2,alert:.5,windup:.5,radius:3,vulnerable:4},/* deploy: wiki Alarmbot 'Deploy time 1.85 s' (nothing detected before); active: 'Proximity radius to remain active 40 m' (v1.11) - inactive (no detection / chase / windup) while Killjoy is dead or farther than 40 m, as the Turret *//* wiki Alarmbot: detects within 5.5 m, 0.5 s alert phase, runs at 22.5 m/s (v13.00), explodes 0.5 s after closing within 2 m (windup phase), 4 s Vulnerable; radius 3 m: project value; client XALB */
 turret:{life:20,range:30,arc:50*Math.PI/180,interval:.7,deploy:2.7,active:40,windup:.75,shots:3,gap:.083,cycle:1.25,near:20,mid:35,dmg:[8,6,4],tag:.75},/* tag = the standard hit tag span (Motor C.tagTime, game files 0.75 s; was .5) *//* wiki Turret: 100 degree detection cone (arc = half-angle), 2.7 s deploy, active only while Killjoy is alive within 40 m, 0.75 s lock windup, bursts of 3 shots 0.083 s apart every 1.25 s, 8 / 6 / 4 per shot to 20 / 35 / beyond m; client XTUR */
 trapwire:{life:120,deploy:1.5,windup:WINDUP.trapwire,reach:7.5,width:.4,leave:4,slow:1.25,zap:5,rearm:2},/* wiki Trapwire (v11.08 / v13.00): 1.5 s deploy, 15 m max wire; a crossing enemy is Slowed (50 %) at once, 0.7 s windup, then if the wire still stands it zaps 5 and Reveals them while they stay within 4 m of where they crossed; the 1.25 s triggered slow lingers after they break free; re-arms 2 s later (no Tether / Concuss since v11.08); client XTRAP */
 cage:{life:7.25,h:5},/* wiki Cyber_Cage: 7.25 s, hollow open-ended cylinder r 3.72 m centred on the cage; h: half-height (not on the wiki; client CYCAGE.h) */
 trademark:{life:120,sight:10,arm:.9,armDeploy:WINDUP.trademark,radius:6,field:4},/* wiki Trademark: 2 s deploy, 10 m search radius, 0.9 s windup on a visible enemy, then a 6 m slow field under that enemy for 4 s, 50 % (Chamber page: '4 s 50% Slow'), everyone in it (allies / self too); the trap is used up; client XTMK */
 headhunter:{weapon:'Sheriff',ammo:1,equip:.3},/* wiki Headhunter: 0.3 s equip; one charge = one round (8 max), the next is chambered after each shot while charges last (4 per second, simulation.js ABILITY_GUNS) */
 boombot:{life:5,speed:6,sight:15,trigger:2.5,windup:.6,hp:60,damage:80,min:30,inner:2,radius:6},/* wiki Boom_Bot: 5 s, 15 m detection, explodes 0.6 s after closing within 2.5 m (it stops), 60 HP (enemy fire destroys it), 80 inside 2 m falling to 30 at 6 m; client XBB */
 blastPack:{life:5,arm:WINDUP.blastPack,inner:2,outer:5,max:50,min:20,speed:16,up:2,g:16,vy:11,push:14},/* wiki Blast_Pack: thrown, sticks to the first thing it hits, recast (Q) or 5 s detonates; knocks everyone in 5 m back (Raze too); 1.5 s to arm, then 50 inside 2 m -> 20 at 5 m to enemies only; 20 HP; client XBP */
 trail:{life:6,speed:9,trigger:2,concuss:4,minConcuss:2.5,radius:3.5,bite:30}/* wiki Trailblazer: 6 s, 3.5 m explosion, concuss 4 s at the centre falling to 2.5 s at the edge; client XTB */
};
// Boom Bot damage at d m from the blast: 80 inside the 2 m inner radius, linear to 30 at the 6 m outer radius (wiki Boom_Bot).
// Boom Bot hitbox for gunfire (spike.js traceShot / shotImpact): a 0.4 m sphere on the crawling bot, enemies of its team only.
// Destroyable utility (wiki <Ability> 'Health'): enemy gunfire hits a sphere on the device (y: centre above e.p, r: radius)
// for the weapon's body damage per bullet and removes it at 0 HP (spike.js traceShot / shotImpact). Boom Bot 60, Turret 100,
// Alarmbot 20, Trademark 20, Nanoswarm 20, Trapwire 20 (either anchor: e.p and e.q). The Sage Barrier is abilities.js
// (barrierRay, segments). Owl Drone / Spycam: a body effect ('owl' 100 HP over the aim point, 'spycam' 1 HP where it was placed)
// beside their 'dart'; a body shot down before the dart has tagged anyone ends the dart. Bots shoot these down
// (spike.js shootUtility, vendor/bot-brain.cjs shootUtility); the offline game uses the same HP (index.html XSHOOT).
export const SHOOT={hunter:{hp:150,y:.4,r:.45},boombot:{hp:60,y:.2,r:.4},turret:{hp:100,y:.45,r:.45},alarmbot:{hp:20,y:.3,r:.35},trademark:{hp:20,y:.2,r:.3},nanoswarm:{hp:20,y:.1,r:.3},trapwire:{hp:20,y:.3,r:.2,ends:true},blastpack:{hp:20,y:0,r:.25},spycam:{hp:1,y:0,r:.25},owl:{hp:100,y:0,r:.45}};/* Spycam 1 HP, Owl Drone 100 HP (wiki Spycam / Owl_Drone, v9.0) */
// Snapshot rows for the persistent devices the online client draws as their real models (server_runtime.js netSyncDevices):
// {id, kind:'dev', d: device kind, o: owner id, tm: team, p (cm), q: Trapwire's other anchor, yaw, hp}.
export const DEV_ROWS=new Set(['hunter','turret','alarmbot','trapwire','trademark','blastpack','spycam','owl']);
const cm=v=>v.map(n=>Math.round(n*100)/100);
export function deviceRows(sim){const out=[];for(const e of sim.effects){if(!DEV_ROWS.has(e.kind)||!(e.until>=sim.time)||!(deviceHp(e)>0||e.field||e.dn)||!Array.isArray(e.p))continue;/* a spent Trademark still sends its slow field (hp 0, fp) */const r={id:e.id,kind:'dev',d:e.kind,o:e.owner,tm:e.team,p:cm(e.p),hp:Math.round(deviceHp(e))};if(e.q)r.q=cm(e.q);if(e.kind==='turret'&&e.sn){r.sn=e.sn;r.ft=cm(e.ft);}/* shots fired + last target point */if(e.kind==='alarmbot'){r.ph=e.dn?4:e.blastAt?3:(e.alertAt&&e.chase!=null)?(sim.time<e.alertAt?1:2):0;/* 0 idle/deploying, 1 alert, 2 running, 3 windup, 4 detonated (dn, one linger of ALARM_DN s) */if(e.dn)r.dn=1;}if(Number.isFinite(e.born))r.age=Math.round(Math.max(0,sim.time-e.born)*100)/100;/* s since placed: the client plays a deploy look only for a fresh placement (age < DEPLOY_FRESH), never for a first sight of an old row (late join / reconnect / fog reveal) */if(Number.isFinite(e.yaw))r.yaw=Math.round(e.yaw*1000)/1000;if(e.kind==='trademark'&&e.field&&Array.isArray(e.fp))r.fp=cm(e.fp);/* the 6 m slow field under the spotted enemy */out.push(r);}return out;}
export function deviceHp(e){const S=SHOOT[e.kind];return S?(e.hp??S.hp):0;}
// The points a shot or a bot aims at: the device, or both Trapwire anchors.
export function devicePoints(e){const S=SHOOT[e.kind];if(!S)return [];const a=[e.p[0],e.p[1]+S.y,e.p[2]];return S.ends&&e.q?[a,[e.q[0],e.q[1]+S.y,e.q[2]]]:[a];}
// Nearest live enemy device the ray o + d t (unit d, t < max) hits; by: the shooter (its own team's devices are not hit).
export function nearestDevice(sim,o,d,max,by){let out=null,dist=max;for(const e of sim.effects){const S=SHOOT[e.kind];if(!S||!(deviceHp(e)>0)||e.until<sim.time||(by&&by.team===e.team))continue;const r2=S.r*S.r;for(const c0 of devicePoints(e)){const c=[c0[0]-o[0],c0[1]-o[1],c0[2]-o[2]],t=c[0]*d[0]+c[1]*d[1]+c[2]*d[2],q=c[0]*c[0]+c[1]*c[1]+c[2]*c[2]-t*t;if(t<0||q>r2)continue;const h=t-Math.sqrt(r2-q);if(h>=0&&h<dist){out=e;dist=h;}}}return out?{effect:out,distance:dist}:null;}
// A bullet's body damage on a device; destroyed (removed from sim.effects) at 0 HP. Returns true when destroyed.
export function damageDevice(sim,e,n){e.hp=deviceHp(e)-n;if(e.hp>0)return false;const j=sim.effects.indexOf(e);if(j>=0)sim.effects.splice(j,1);sim.destroyed=(sim.destroyed||0)+1;return true;}
export function nearestBoomBot(sim,o,d,max,by){const h=nearestDevice(sim,o,d,max,by);return h&&h.effect.kind==='boombot'?h:null;}
export const bbDamage=d=>{const B=DEV.boombot;return d<=B.inner?B.damage:d>=B.radius?0:B.damage-(d-B.inner)/(B.radius-B.inner)*(B.damage-B.min);};
// Trailblazer concuss at d m from the blast: 4 s at the centre, linear to 2.5 s at the 3.5 m edge (wiki Trailblazer).
export const tbConcuss=d=>{const T=DEV.trail;return T.concuss-Math.min(1,Math.max(0,d/T.radius))*(T.concuss-T.minConcuss);};
const losClear=(sim,o,p)=>{const q=p.map((n,i)=>n-o[i]),len=Math.hypot(...q);if(len<.05)return true;return sim.world.ray(o,q.map(n=>n/len),Math.max(0,len-.4))===Infinity;};
const chest=v=>[v.x,v.y+1.2-(v.ch||0)*.5,v.z];
const fwd=u=>[-Math.sin(u.look),0,-Math.cos(u.look)];
const f3=u=>{const c=Math.cos(u.pitch||0);return [-Math.sin(u.look)*c,Math.sin(u.pitch||0),-Math.cos(u.look)*c];};
export function startDevice(sim,u,ty,p,push,m={}){
 if(ty==='drone'&&u.agent==='Raze'){push('boombot',DEV.boombot.life,DEV.boombot.radius,{p:[u.x,u.y+.2,u.z],yaw:u.look,hp:DEV.boombot.hp});return true;}
 if(ty==='drone'&&u.agent==='Skye'){push('trail',DEV.trail.life,DEV.trail.radius,{p:[u.x,u.y+.2,u.z],yaw:u.look});return true;}
 if(ty==='drone'&&u.agent==='Sova'){const O=DEV.owl;push('owl',O.life,SHOOT.owl.r,{p:[p[0],p[1]+O.lift,p[2]],yaw:u.look,hp:SHOOT.owl.hp});const body=sim.effects[sim.effects.length-1].id;push('dart',Math.max(...O.pings)+.1,O.radius,{pickAt:sim.time,pings:O.pings.map(t=>sim.time+t),reveal:O.reveal,body});for(let t=O.cd;t<O.life;t+=O.cd)push('dart',t+Math.max(...O.pings)+.1,O.radius,{pickAt:sim.time+t,pings:O.pings.map(q=>sim.time+t+q),reveal:O.reveal,body,prev:1});return true;}/* the drone itself: a 100 HP body hovering over the aim point (shootable); its dart as before */
 if(ty==='recon'&&u.agent==='Cypher'){const S=DEV.spycam;push('spycam',S.life,SHOOT.spycam.r,{yaw:u.look,hp:SHOOT.spycam.hp});const body=sim.effects[sim.effects.length-1].id;/* the camera: a 1 HP body where it was placed (shootable) */push('dart',S.life,S.radius,{pickAt:sim.time+S.deploy,pings:[sim.time+S.deploy],every:S.every,reveal:S.reveal,body});return true;}
 if(ty==='recon'||ty==='drone'){push('recon',Math.max(...DEV.recon.pulses)+.1,DEV.recon.radius,{pulses:DEV.recon.pulses.map(t=>sim.time+t)});return true;}
 const f=fwd(u);
 // Phoenix Blaze: a straight wall of fire along his aim from his feet; blocks sight, burns enemies, heals him.
 if(u.agent==='Phoenix'&&ty==='wall'){let len=DEV.blaze.length;const hit=sim.world.ray([u.x,u.y+.5,u.z],f,len+1);if(Number.isFinite(hit))len=Math.max(1,hit-.3);push('blaze',DEV.blaze.life,DEV.blaze.width,{p:[u.x+f[0],u.y,u.z+f[2]],q:[u.x+f[0]*len,u.y,u.z+f[2]*len]});return true;}
 if(u.agent==='Phoenix'&&ty==='fire'){const H=DEV.hotHands;push('fire',H.life,0,{full:H.radius,grow:H.grow,born:sim.time,rate:H.damage,selfHeal:H.heal});return true;}/* the zone spreads (radius grows, tickAbilities) */
 // Curveball bends right (m.l: left) and pops beside the corner, not at the crosshair.
 if(u.agent==='Phoenix'&&ty==='flash'){const C=DEV.curveball,side=m.l?-1:1,r=[-f[2]*side,0,f[0]*side],o=[u.x,u.y+1.6,u.z];let a=C.ahead;const h=sim.world.ray(o,f,a);if(Number.isFinite(h))a=Math.max(.5,h-.4);const mid=[o[0]+f[0]*a,o[1],o[2]+f[2]*a];let b=C.side;const h2=sim.world.ray(mid,r,b);if(Number.isFinite(h2))b=Math.max(0,h2-.4);push('flash',C.windup+.1,C.radius,{p:[mid[0]+r[0]*b,o[1],mid[2]+r[2]*b],at:sim.time+C.windup,blind:C.blind});return true;}
 // Killjoy Nanoswarm hides at the aim point until recast (C again); Alarmbot waits for an enemy to walk by.
 if(u.agent==='Killjoy'&&ty==='fire'){push('nanoswarm',DEV.nanoswarm.life,DEV.nanoswarm.radius,{armed:false,hp:SHOOT.nanoswarm.hp});return true;}
 if(u.agent==='Killjoy'&&ty==='trap'){push('alarmbot',DEV.alarmbot.life,DEV.alarmbot.radius,{chase:null,hp:SHOOT.alarmbot.hp,armAt:sim.time+DEV.alarmbot.deploy});return true;}
 if(u.agent==='Killjoy'&&ty==='turret'){push('turret',DEV.turret.life,DEV.turret.range,{at:sim.time+DEV.turret.deploy,yaw:castYaw(m,u.look,'fy'),/* the page's chosen facing (E swap / ALT FIRE rotate), else her look */hp:SHOOT.turret.hp});return true;}
 // Cypher Trapwire: stretched across at the aim point, perpendicular to his view, to the walls either side.
 if(u.agent==='Cypher'&&ty==='trap'){const r=[-f[2],0,f[0]],o=[p[0],p[1]+.3,p[2]],span=d=>{const h=sim.world.ray(o,d,DEV.trapwire.reach);return Number.isFinite(h)?Math.max(.3,h-.05):DEV.trapwire.reach;},a=span(r),b=span(r.map(n=>-n));push('trapwire',DEV.trapwire.life,DEV.trapwire.width,{armAt:sim.time+DEV.trapwire.deploy,hp:SHOOT.trapwire.hp,p:[p[0]-r[0]*b,p[1],p[2]-r[2]*b],q:[p[0]+r[0]*a,p[1],p[2]+r[2]*a]});return true;}
 if(u.agent==='Cypher'&&ty==='smoke'){push('smoke',DEV.cage.life,SMOKE.r.Cypher,{cyl:DEV.cage.h});return true;}
 if(u.agent==='Raze'&&ty==='satchel'){const B=DEV.blastPack,s=packStick(sim,[u.x,u.y+1.6,u.z],f3(u));p.splice(0,3,...s);push('blastpack',B.life+.1,B.outer,{p:s,boomAt:sim.time+B.life,armAt:sim.time+B.arm,hp:SHOOT.blastpack.hp});return true;}/* Blast Pack: thrown, sticks where it lands (packStick), recast or 5 s */
 if(u.agent==='Chamber'&&ty==='trap'){push('trademark',DEV.trademark.life,DEV.trademark.radius,{spotted:0,armAt:sim.time+DEV.trademark.armDeploy,hp:SHOOT.trademark.hp});return true;}
 // Chamber Headhunter: one round of the heavy pistol per charge; the previous gun comes back when it is spent,
 // put away (Q again), swapped off or Chamber dies.
 if(u.agent==='Chamber'&&ty==='headhun'){const H=DEV.headhunter;if(!u.inventory)u.inventory={};u.headhunter={saved:u.weapon,savedAmmo:u.ammo,savedReserve:u.reserve,savedSidearm:u.inventory[H.weapon]};u.inventory[u.weapon]=u.ammo;u.weapon=H.weapon;u.ammo=H.ammo;u.reserve=0;u.reloadAt=0;u.fireAt=Math.max(u.fireAt||0,sim.time+H.equip);p.splice(0,3,u.x,u.y,u.z);return true;}
 return false;
}
// Checks before a charge is spent. Returns true/false to answer the intent, undefined to continue the cast.
export function preCastDevice(sim,u,k){
 const A=u.ability;
 if(u.agent==='Killjoy'&&k==='c'){const dormant=sim.effects.filter(e=>e.kind==='nanoswarm'&&e.owner===u.id&&!e.armed);if(dormant.length){for(const e of dormant){e.armed=true;e.until=sim.time+DEV.nanoswarm.active;e.dmgAt=sim.time+DEV.nanoswarm.delay;e.radius=DEV.nanoswarm.radius;}A.cool.c=sim.time+.3;sim.castEvents.push({t:'ac',i:u.id,ag:u.agent,k,o:[u.x,u.y+1.6,u.z],d:fwd(u),p:dormant[0].p,ts:Math.round(sim.time*1000)});return true;}}
 if(u.agent==='Raze'&&k==='q'){const own=sim.effects.filter(e=>e.kind==='blastpack'&&e.owner===u.id&&e.until>sim.time);if(own.length){for(const e of own)packBoom(sim,e);A.cool.q=sim.time+.3;sim.castEvents.push({t:'ac',i:u.id,ag:u.agent,k,o:[u.x,u.y+1.6,u.z],d:fwd(u),p:own[0].p,bp:1,ts:Math.round(sim.time*1000)});return true;}}/* Blast Pack recast: detonate (no charge) */
 if(u.agent==='Chamber'&&k==='q'){if(u.headhunter){if(u.weapon===DEV.headhunter.weapon&&u.ammo>0)A.q=Math.min(8,(A.q||0)+u.ammo);endHeadhunter(u);A.cool.q=sim.time+.3;return true;}if(u.ultWeapon)return false;}
 return undefined;
}
export function endHeadhunter(u){const H=u.headhunter;if(!H)return;u.headhunter=null;if(u.weapon===DEV.headhunter.weapon){u.weapon=H.saved;u.ammo=H.savedAmmo;u.reserve=H.savedReserve;u.reloadAt=0;}if(u.inventory){if(H.savedSidearm===undefined||H.saved===DEV.headhunter.weapon)delete u.inventory[DEV.headhunter.weapon];else u.inventory[DEV.headhunter.weapon]=H.savedSidearm;if(H.saved===DEV.headhunter.weapon)u.inventory[H.saved]=H.savedAmmo;}}
export function resetDevices(u){u.headhunter=null;u.vulnerableUntil=0;u.tetheredUntil=0;u.dartedUntil=0;u.dartRm=0;}
const segDist=(e,x,z)=>{const ax=e.p[0],az=e.p[2],dx=e.q[0]-ax,dz=e.q[2]-az,l2=dx*dx+dz*dz||1e-9,t=Math.max(0,Math.min(1,((x-ax)*dx+(z-az)*dz)/l2));return Math.hypot(x-ax-dx*t,z-az-dz*t);};
// Blaze blocks sight like a smoke: true when the segment o..o+d*max crosses the fire wall below its top.
export function blazeBlocks(sim,o,d,max){for(const e of sim.effects){if(e.kind!=='blaze'||e.until<sim.time)continue;const n=24;for(let i=0;i<=n;i++){const t=max*i/n,x=o[0]+d[0]*t,y=o[1]+d[1]*t,z=o[2]+d[2]*t;if(y>=e.p[1]-.1&&y<=e.p[1]+DEV.blaze.height&&segDist(e,x,z)<DEV.blaze.width)return true;}}return false;}
// Moves a ground device one step along yaw; returns false when blocked.
function crawl(sim,e,dt,speed){const x=e.p[0]-Math.sin(e.yaw)*speed*dt,z=e.p[2]-Math.cos(e.yaw)*speed*dt;if(sim.world.blocked(x,z,.25,e.p[1]-.2,.5))return false;const y=sim.world.ground(x,z,e.p[1]+.5);if(!Number.isFinite(y)||Math.abs(y+.2-e.p[1])>.6)return false;e.p=[x,y+.2,z];return true;}
const KINDS=new Set(['blastpack','recon','dart','boombot','trail','blaze','nanoswarm','alarmbot','trapwire','trademark']);
// Blast Pack flight: from the eye along the aim at 16 m/s (+2 up), gravity 16; sticks to the first wall / floor it meets (as the offline rsFly pack).
export function packStick(sim,o,d){const B=DEV.blastPack;let p=o.map((n,i)=>n+d[i]*.6);const v=[d[0]*B.speed,d[1]*B.speed+B.up,d[2]*B.speed],dt=.02;
 for(let t=0;t<3;t+=dt){v[1]-=B.g*dt;const st=v.map(n=>n*dt),l=Math.hypot(...st),h=l>1e-6?sim.world.ray(p,st.map(n=>n/l),l):Infinity;if(Number.isFinite(h))return p.map((n,i)=>n+st[i]*Math.max(0,h-.05)/l);
  p=p.map((n,i)=>n+st[i]);const g=sim.world.ground(p[0],p[2],p[1]+.5);if(Number.isFinite(g)&&p[1]<=g+.1){p[1]=g+.1;return p;}}return p;}
// Blast Pack damage by distance once armed: 50 inside 2 m, linear to 20 at the 5 m edge (wiki).
export function packDamage(d){const B=DEV.blastPack;return d<=B.inner?B.max:d>=B.outer?0:B.max-(d-B.inner)/(B.outer-B.inner)*(B.max-B.min);}
// Detonation: everyone within 5 m (Raze and allies too) is launched away from the pack (vy 11, 14 m/s out, as the offline rsPack);
// enemies take packDamage once it has armed (1.5 s), never allies or Raze.
export function packBoom(sim,e){const B=DEV.blastPack,owner=sim.units.find(u=>u.id===e.owner),armed=sim.time>=e.armAt;e.until=sim.time-1e-9;sim.fxSrc=e;sim.castEvents.push({t:'ac',i:e.owner,ag:'Raze',k:'q',sub:'boom',o:[...e.p],d:[0,0,1],p:[...e.p],ts:Math.round(sim.time*1000)});/* detonation event: the client plays the blast only on this, not when the row leaves view */
 for(const v of sim.units){if(!v.alive||v.loading)continue;const dx=v.x-e.p[0],dz=v.z-e.p[2],dy=v.y+1-e.p[1],d=Math.hypot(dx,dy,dz);if(d>=B.outer||Math.abs(v.y-e.p[1])>3)continue;
  const h=Math.hypot(dx,dz);let nx=dx/h,nz=dz/h;if(!(h>.3)){const f=fwd(v);nx=f[0];nz=f[2];}v.vx=nx*B.push;v.vz=nz*B.push;v.vy=B.vy;v.air=true;v.seq=(v.seq||0)+1;
  if(armed&&owner&&v.team!==e.team&&losClear(sim,[e.p[0],e.p[1]+.3,e.p[2]],chest(v)))abilityDamage(sim,owner,v,packDamage(d));}}
// Spycam dart removal (wiki Spycam, 1.85 s channel): the darted unit holds interact, grounded and still, not firing, and its
// interact is not going to the Spike (planting on a site with it / defusing). Bots: SpikeSimulation.bot holds interact while
// no enemy is in sight (offline bots: xDartLoop, same rule).
export function dartChannel(sim,v){const i=v.input||{};return !!(v.alive&&i.interact&&!i.fire&&sim.time-(v.inputAt||0)<.3&&!v.air&&!v.pendingTeleport&&!(v.dismissUntil>sim.time)&&Math.hypot(v.vx||0,v.vz||0)<.1&&!(sim.spikeInteract&&sim.spikeInteract(v)));}
export const dartOn=(sim,u)=>sim.effects.some(e=>e.kind==='dart'&&e.every&&e.tgt===u.id&&e.until>=sim.time);
export function tickDevices(sim,dt){
 for(const u of sim.units){if(u.headhunter&&u.alive&&u.weapon===DEV.headhunter.weapon&&u.ammo<=0&&u.ability?.q>0){u.ability.q--;u.ammo=1;continue;}/* the next charge is the next round (cadence: fire() 1 / 4 s) */
  if(u.headhunter&&(!u.alive||u.weapon!==DEV.headhunter.weapon||u.ammo<=0))endHeadhunter(u);}
 for(let i=sim.effects.length-1;i>=0;i--){const e=sim.effects[i];if(!KINDS.has(e.kind))continue;if(e.until<sim.time)continue;sim.fxSrc=e;const owner=sim.units.find(u=>u.id===e.owner),foes=sim.units.filter(v=>v.alive&&!v.loading&&v.team!==e.team);
  if(e.kind==='blastpack'){if(sim.time>=e.boomAt||!owner?.alive)packBoom(sim,e);continue;}/* 5 s fuse; Raze dead: it goes off */
  if(e.kind==='dart'){/* Owl Drone / Spycam stand-in: tag one enemy, then reveal it on each ping (a tag: no line of sight needed) */if(e.tgt==null&&e.body!=null&&!sim.effects.some(b=>b.id===e.body&&b.until>=sim.time)){e.until=sim.time-1;continue;}/* its drone / camera was shot down first */if(e.tgt==null){if(sim.time<e.pickAt)continue;const o=[e.p[0],e.p[1]+.5,e.p[2]],B=e.body!=null?sim.effects.find(d=>d.id===e.body):null,pt=e.prev?B?.dartTg:null,v=foes.filter(v=>Math.hypot(v.x-o[0],v.z-o[2])<e.radius&&losClear(sim,o,chest(v))).sort((a,b)=>(a.id===pt)-(b.id===pt)||Math.hypot(a.x-o[0],a.z-o[2])-Math.hypot(b.x-o[0],b.z-o[2]))[0];/* a later Owl dart (prev) prefers an enemy the first one did not tag (B.dartTg: the drone remembers its last tag) */if(!v){e.until=sim.time-1;continue;}e.tgt=v.id;if(B)B.dartTg=v.id;}
   const v=sim.units.find(x=>x.id===e.tgt);if(!v||!v.alive){e.until=sim.time-1;continue;}if(e.every){/* Spycam dart: the 1.85 s removal channel */if(dartChannel(sim,v)){e.rm=(e.rm||0)+dt;if(e.rm>=DEV.spycam.remove-1e-9){e.until=sim.time-1;v.dartRm=0;v.dartedUntil=0;continue;}}else e.rm=0;v.dartRm=e.rm;v.dartedUntil=sim.time+.2;}while(e.pings.length&&sim.time>=e.pings[0]){const t=e.pings.shift();v.revealedUntil=Math.max(v.revealedUntil||0,sim.time+e.reveal);if(e.every)e.pings.push(t+e.every);/* Spycam: every 2 s until removed */}if(!e.pings.length)e.until=sim.time-1;continue;}
  if(e.kind==='recon'){while(e.pulses&&e.pulses.length&&sim.time>=e.pulses[0]){e.pulses.shift();const o=[e.p[0],e.p[1]+.5,e.p[2]];for(const v of foes)if(Math.hypot(v.x-o[0],v.z-o[2])<e.radius&&losClear(sim,o,chest(v)))v.revealedUntil=Math.max(v.revealedUntil||0,sim.time+(e.reveal||DEV.recon.reveal));}continue;}
  if(e.kind==='blaze'){const B=DEV.blaze,inWall=v=>Math.abs(v.y-e.p[1])<B.height&&segDist(e,v.x,v.z)<B.width;for(const v of sim.units)if(v.alive&&!v.loading&&v.id!==e.owner&&inWall(v))abilityDamage(sim,owner,v,B.damage*dt);/* allies 1/3 (abilityDamage) */if(owner?.alive&&inWall(owner)&&owner.hp<100)owner.hp=Math.min(100,owner.hp+B.heal*dt);continue;}
  if(e.kind==='nanoswarm'){if(!e.armed||sim.time<(e.dmgAt||0))continue;/* 1 s activation windup */for(const v of sim.units)if(v.alive&&!v.loading&&v.id!==e.owner&&Math.hypot(v.x-e.p[0],v.z-e.p[2])<e.radius&&Math.abs(v.y-e.p[1])<3&&losClear(sim,[e.p[0],e.p[1]+.4,e.p[2]],chest(v)))abilityDamage(sim,owner,v,DEV.nanoswarm.damage*dt);continue;}
  if(e.kind==='trapwire'){const T=DEV.trapwire;if(e.trip!=null){const v=sim.units.find(x=>x.id===e.trip),c=e.tripP;
    if(!v||!v.alive||Math.hypot(v.x-c[0],v.z-c[2])>T.leave){if(v&&v.alive)v.orbSlowUntil=Math.max(v.orbSlowUntil||0,sim.time+T.slow);e.trip=null;e.armAt=sim.time+T.rearm;continue;}/* broke free (4 m) or died: the slow lingers 1.25 s, the wire re-arms in 2 s */
    v.orbSlowUntil=Math.max(v.orbSlowUntil||0,sim.time+.2);v.tetheredUntil=sim.time+.2;if(sim.time>=e.fireAt){if(!e.zapped){e.zapped=true;if(owner)abilityDamage(sim,owner,v,T.zap);}v.revealedUntil=Math.max(v.revealedUntil||0,sim.time+.2);}continue;}
   if(sim.time<(e.armAt||0))continue;/* 1.5 s deploy, 2 s re-arm */for(const v of foes)if(Math.abs(v.y-e.p[1])<1.5&&segDist(e,v.x,v.z)<T.width){e.trip=v.id;e.tripP=[v.x,v.y,v.z];e.fireAt=sim.time+T.windup;e.zapped=false;v.orbSlowUntil=Math.max(v.orbSlowUntil||0,sim.time+.2);v.tetheredUntil=sim.time+.2;break;}continue;}

  if(e.kind==='trademark'){const T=DEV.trademark,o=[e.p[0],e.p[1]+.3,e.p[2]];if(e.field){const f=e.fp;for(const v of sim.units)if(v.alive&&!v.loading&&Math.hypot(v.x-f[0],v.z-f[2])<T.radius&&Math.abs(v.y-f[1])<3)v.orbSlowUntil=Math.max(v.orbSlowUntil||0,sim.time+.2);/* 50 % (the Slow Orb's half speed: status oslow) */continue;}
   if(sim.time<(e.armAt||0))continue;/* 2 s arm after placement (wiki windup) */const seen=foes.some(v=>Math.hypot(v.x-o[0],v.z-o[2])<T.sight&&Math.abs(v.y-e.p[1])<4&&losClear(sim,o,chest(v)));if(!seen){e.spotted=0;continue;}if(!e.spotted)e.spotted=sim.time;if(sim.time-e.spotted>=T.arm){const v=foes.filter(v=>Math.hypot(v.x-o[0],v.z-o[2])<T.sight&&Math.abs(v.y-e.p[1])<4&&losClear(sim,o,chest(v))).sort((a,b)=>Math.hypot(a.x-o[0],a.z-o[2])-Math.hypot(b.x-o[0],b.z-o[2]))[0];e.field=true;e.fp=[v.x,v.y,v.z];e.hp=0;/* the trap is spent: nothing left to shoot */e.until=sim.time+T.field;}continue;}
  if(e.kind==='alarmbot'){const C=DEV.alarmbot,o=[e.p[0],e.p[1]+.3,e.p[2]];if(e.dn)continue;/* detonated: only the dn row lingers (.25 s), then it expires */if(sim.time<(e.armAt||0))continue;/* 1.85 s deploy */if(!owner?.alive||Math.hypot(owner.x-e.p[0],owner.z-e.p[2])>C.active){e.chase=null;e.alertAt=0;e.blastAt=0;continue;}/* Killjoy dead / past 40 m: inactive (a running bot stops where it is) */let v=e.chase!=null&&foes.find(f=>f.id===e.chase);if(!v||!losClear(sim,o,chest(v))||Math.hypot(v.x-o[0],v.z-o[2])>C.sight*2){v=foes.filter(f=>Math.hypot(f.x-o[0],f.z-o[2])<C.sight&&Math.abs(f.y-e.p[1])<3&&losClear(sim,o,chest(f))).sort((a,b)=>Math.hypot(a.x-o[0],a.z-o[2])-Math.hypot(b.x-o[0],b.z-o[2]))[0];e.chase=v?v.id:null;}
   if(e.blastAt){if(sim.time>=e.blastAt){e.dn=1;e.hp=0;e.until=sim.time+.25;for(const w of foes)if(Math.hypot(w.x-o[0],w.z-o[2])<C.radius&&Math.abs(w.y-e.p[1])<2.5&&losClear(sim,o,chest(w)))w.vulnerableUntil=Math.max(w.vulnerableUntil||0,sim.time+C.vulnerable);}continue;}/* 0.5 s windup phase: stopped, still shootable */
   if(!v){e.alertAt=0;continue;}if(!e.alertAt)e.alertAt=sim.time+C.alert;if(sim.time<e.alertAt)continue;/* 0.5 s alert phase before it runs */
   if(Math.hypot(v.x-o[0],v.z-o[2])<C.trigger){e.blastAt=sim.time+C.windup;continue;}
   e.yaw=Math.atan2(o[0]-v.x,o[2]-v.z);crawl(sim,e,dt,C.speed);continue;}
  const C=e.kind==='boombot'?DEV.boombot:DEV.trail,o=[e.p[0],e.p[1]+.3,e.p[2]];
  const blast=()=>{sim.effects.splice(i,1);for(const v of foes)if(Math.hypot(v.x-o[0],v.z-o[2])<C.radius&&Math.abs(v.y-e.p[1])<2.5&&losClear(sim,o,chest(v)))abilityDamage(sim,owner,v,bbDamage(Math.hypot(v.x-o[0],v.z-o[2])));};
  if(e.kind==='boombot'&&e.blastAt){if(sim.time>=e.blastAt)blast();continue;}/* 0.6 s windup: stopped, still shootable */
  // Boom Bot locks onto the nearest enemy it can see; Trailblazer runs straight.
  if(e.kind==='boombot'){const seen=foes.filter(v=>Math.hypot(v.x-o[0],v.z-o[2])<C.sight&&losClear(sim,o,chest(v))).sort((a,b)=>Math.hypot(a.x-o[0],a.z-o[2])-Math.hypot(b.x-o[0],b.z-o[2]))[0];if(seen)e.yaw=Math.atan2(o[0]-seen.x,o[2]-seen.z);}
  const hit=foes.find(v=>Math.hypot(v.x-o[0],v.z-o[2])<C.trigger&&Math.abs(v.y-e.p[1])<2);
  if(hit&&e.kind==='boombot'){e.blastAt=sim.time+C.windup;e.until=Math.max(e.until,e.blastAt+.1);continue;}
  if(hit){sim.effects.splice(i,1);abilityDamage(sim,owner,hit,C.bite);/* wiki Trailblazer: the leap bites the enemy it reaches for 30 */for(const v of foes)if(Math.hypot(v.x-o[0],v.z-o[2])<C.radius&&Math.abs(v.y-e.p[1])<2.5&&losClear(sim,o,chest(v))){{const c=tbConcuss(Math.hypot(v.x-o[0],v.z-o[2]));v.concussUntil=Math.max(v.concussUntil||0,sim.time+c);v.slowUntil=Math.max(v.slowUntil||0,sim.time+c);}}continue;}
  if(!crawl(sim,e,dt,C.speed)){if(e.kind==='boombot'){const yaw=e.yaw+Math.PI/2;e.yaw=yaw;}else e.until=sim.time;}
 }
}
