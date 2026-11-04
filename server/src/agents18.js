// The 18 agents added 2026-11-03 (roster 12 -> 30, per valorant-api.com as of patch 13.09): Astra, Brimstone, Clove,
// Harbor, Miks, Viper, Hush, Iso, Neon, Waylay, Yoru, Fade, Gekko, KAY/O, Tejo, Deadlock, Veto, Vyse.
// Same authority pattern as abilities.js / ults.js: the client sends intent only; origin, targets, timing, damage and
// status come from server state. Kit facts (slots, costs, charges, ult points) live in kits.json, grounded per ability
// page on wiki.playvalorant.com (fetched 2026-11-03). Where the engine has no native concept (Astra stars, Viper fuel,
// Gekko globules, Iso's duel arena) the mechanic says what it models; nothing is a hidden placeholder.
import Motor from './motor.cjs';
import kits from './kits.json' with {type:'json'};
export const AG18={Astra:1,Brimstone:1,Clove:1,Harbor:1,Miks:1,Viper:1,Hush:1,Iso:1,Neon:1,Waylay:1,Yoru:1,Fade:1,Gekko:1,'KAY/O':1,Tejo:1,Deadlock:1,Veto:1,Vyse:1};
export const TYPES18={Astra:['pull','concuss','smoke'],Brimstone:['stim','fire','smoke'],Clove:['haste','decay','smoke'],Harbor:['surge','wall','cove'],Miks:['mpulse','harmonize','smoke'],Viper:['snakebite','smoke','wall'],Hush:['flow','flash','pull'],Iso:['wall','undercut','shield'],Neon:['wall','concuss','haste'],Waylay:['hinder','dash','teleport'],Yoru:['decoy','flash','teleport'],Fade:['prowler','tether','recon'],Gekko:['mosh','wingman','flash'],'KAY/O':['frag','flash','suppress'],Tejo:['drone','concuss','salvo'],Deadlock:['mesh','sensor','gravnet'],Veto:['crosscut','choke','interceptor'],Vyse:['vine','shear','arcrose']};
// Wiki stats per ability (fetched 2026-11-03), project-lightweight where noted:
export const A18={
 star:{max:4,cost:150,wellPull:2,wellVuln:2,wellR:3.5,novaDelay:1.25,novaConcuss:4,novaR:4.5,nebulaLife:14.25,nebulaR:4.1,divideLife:21},/* wiki Gravity_Well/Nova_Pulse/Nebula/Cosmic_Divide */
 stim:{life:12.5,r:4,k:1.15},/* Stim Beacon: 15 % speed + rapidfire zone 12.5 s */
 incend:{life:7,r:4.5,rate:60},/* wiki Incendiary 60/s */
 skysmoke:{life:19.25,r:4.15,max:3},/* wiki Sky_Smoke */
 orbital:{delay:2,life:4,r:5,dps:150},/* wiki Orbital_Strike: 20/tick x 7.5/s */
 pmu:{haste:4,overheal:50,window:12},/* Pick-me-up: on a kill/damaged dead enemy: 50 overheal + haste */
 meddle:{r:4.5,decay:70},/* Meddle: 70 decay */
 ruse:{life:12.75,r:4.15},
 ndy:{channel:3.3,window:12},/* Not Dead Yet: 3.3 s self-revive channel; earn kill/assist inside 12 s or die */
 surge:{r:4.5,near:2,slow:2},/* Storm Surge: nearsight + slow */
 tide:{dist:45,life:12,slow:2,w:2},/* High Tide: vision wall that travels and slows on touch */
 cove:{life:12,r:4.1,shieldHp:500},/* Cove: smoke, then destructible shield */
 reckon:{dist:30,near:3,slow:4,speed:7},/* Reckoning (v11.10 rework): a wall that pushes forward, nearsight+slow on touch */
 mpulse:{life:6,pulse:2,r:6,concuss:2.5,heal:40},/* M-pulse: concuss OR heal pulses */
 harmon:{life:8,k:1.15},/* Harmonize: stim+haste on a targeted ally and self */
 waveform:{life:14,r:4.15,max:2},/* Waveform smokes */
 bassq:{dist:25,w:14,slow:4,knock:8},/* Bassquake: deafen (not modelled: no audio bus per-status), knockback + slow */
 snake:{life:6.5,r:4,rate:20,vuln:2},/* Snake Bite: 20/s + vulnerable */
 fuel:{max:100,drain:8,regen:20},/* Viper/Neon fuel */
 pcloud:{r:4.15,max:60},tscreen:{len:30,max:60},/* Poison Cloud / Toxic Screen emitters, fuel while up */
 pit:{r:9,decay:30,max:15},/* Viper's Pit */
 flow:{delay:1.1,speed:22},/* Hush Flow: anchor, then propel */
 flashb:{blind:1.6,delay:1},/* Flashbulb */
 displ:{r:5,pull:6,delay:1},/* Displacement: pull to centre */
 susp:{speed:12,life:4,lev:3,r:4},/* Suspension ult: steerable, levitate */
 conting:{dist:30,speed:6,w:8,h:3.5,life:8},/* Contingency: moving vision wall */
 undercut:{r:5,supp:4,vuln:4},/* Undercut: suppress + vulnerable */
 dtap:{channel:1,life:20},/* Double Tap: 1 s Focus, shield blocks one hit */
 kc:{range:40,w:4,life:8},/* Kill Contract: lightweight - the caught duelist is revealed+suppressed to Iso for 8 s (no pocket arena) */
 fastlane:{dist:30,gap:3,life:6},relay:{r:4.5,concuss:3.5},/* Neon */
 gear:{drain:10,regen:20,k:1.2},od:{life:10,dps:150,range:30},/* Overdrive: lightweight beam = high-dps ray while it lasts */
 satur:{r:4.5,hinder:4},ls:{dash:9,time:.35},/* Waylay Saturate / Lightspeed */
 refract:{life:20,travel:.6},/* Refract marker + immune return */
 cpaths:{dist:20,w:10,haste:3,hinder:4},/* Convergent Paths */
 fakeout:{life:10,speed:4.5},/* Fakeout decoy walks forward */
 blindside:{blind:1.5,delay:.6},gcrash:{speed:12,life:20,range:30},/* Yoru */
 drift:{life:10},/* Dimensional Drift: invisible + intangible, Gatecrash stays up */
 prowler:{life:3,speed:9,near:2.5,r:6},seize:{r:4.5,tether:4,decay:70},haunt:{r:25,reveal:12,mark:2},/* Fade */
 nightfall:{dist:25,w:14,decay:70,mark:12},/* Nightfall wave */
 mosh:{r:5,life:3,dps:20,boom:70},wing:{life:5,speed:9,concuss:3.5,r:3},dizzy:{life:2.5,blind:1.5,r:15},thrash:{r:6,detain:6,dash:12},/* Gekko; globule reclaim: used basics return after 10 s at the drop point (lightweight: auto-return) */
 globule:{reclaim:10},
 frag:{r:5,pulses:4,gap:1,dmg:40},fdrive:{blind:2.25,delay:1.6},zero:{r:15,supp:8},nullcmd:{life:10,pulse:3,r:20,supp:8},/* KAY/O (downed state not modelled) */
 sdrone:{life:8,r:12,reveal:3,supp:6},sd:{r:4,concuss:3,dmg:40},salvo:{r:6,pulses:3,gap:.8,dmg:55},armag:{len:40,w:12,dmg:120},/* Tejo */
 mesh:{life:30,len:7.5,h:3,hp:680},/* Barrier Mesh: nodes form movement-blocking segments */
 sensor:{life:30,r:8,concuss:3},gnet:{r:6,life:8,slowK:.35},/* Deadlock */
 annih:{range:20,w:3,detain:7,dmg:70},/* Annihilation: lightweight - cocoon = detain + 70 over the pull (no free-the-cocoon HP race) */
 xcut:{range:25},choke:{life:30,r:6,decay:60,slow:2},cept:{life:30,r:10},/* Veto */
 evo:{life:12,hps:10},/* Evolution: stim + 10/s heal + debuff immunity (weapon damage still lands) */
 vine:{life:30,r:6,slowK:.4,dps:15},shear:{life:30,r:2.5,wall:8},rose:{life:30,blind:2,r:20},garden:{r:20,jam:8},/* Vyse */
};
export function init18(u,A){if(!AG18[u.agent])return;A.stars=u.agent==='Astra'?2:0;A.fuel=(u.agent==='Viper'||u.agent==='Neon')?A18.fuel.max:0;A.globules=0;/* Astra: 2 Stars a round (wiki Stars); Viper/Neon: full fuel tank */A.toxOn=false;A.cloudOn=false;A.gate=null;A.marker=null;A.decoy=null;u.isoShield=0;u.driftUntil=0;u.evoUntil=0;u.suppressUntil=0;u.jamUntil=0;u.hinderUntil=0;u.levUntil=0;u.decayUntil=0;u.decayAmt=0;u.hasteUntil=0;u.stimUntil=0;u.gravUntil=0;u.ndy=null;u.overheal=0;}
const eye=u=>[u.x,u.y+1.6-(u.ch||0),u.z];
const aim=u=>[-Math.sin(u.look)*Math.cos(u.pitch||0),Math.sin(u.pitch||0),-Math.cos(u.look)*Math.cos(u.pitch||0)];
const enemies=(sim,u)=>sim.units.filter(v=>v!==u&&v.team!==u.team&&v.alive&&!v.loading);
const inR=(v,p,r,dy=4)=>Math.hypot(v.x-p[0],v.z-p[2])<r&&Math.abs(v.y-p[1])<dy;
const los=(sim,a,b)=>{const q=[b[0]-a[0],b[1]-a[1],b[2]-a[2]],l=Math.hypot(...q);return l<.01||sim.world.ray(a,q.map(n=>n/l),Math.max(0,l-.4))===Infinity;};
function fx(sim,u,kind,p,seconds,radius,extra={}){const e={id:++sim.effectSeq,kind,owner:u.id,ag:u.agent,team:u.team,p:[...p],until:sim.time+seconds,radius,...extra};sim.effects.push(e);return e;}
function dmg(sim,u,v,n){/* lazy import cycle guard: abilities.js passes its abilityDamage through dmg18 */return dmg18.f(sim,u,v,n);}
export const dmg18={f:null};
function status(v,key,seconds,sim){v[key]=Math.max(v[key]||0,sim.time+seconds);}
function decay(sim,v,amt){if(v.evoUntil>sim.time)return;v.decayAmt=Math.min(99,(v.decayUntil>sim.time?v.decayAmt:0)+amt);status(v,'decayUntil',8,sim);v.hp=Math.max(1,v.hp-amt);}
function land(sim,u,range){/* crosshair floor point, as aimFloor's simple form */const o=eye(u),d=aim(u),hit=sim.world.ray(o,d,range),t=Number.isFinite(hit)?Math.max(0,hit-.5):range;let x=o[0]+d[0]*t,z=o[2]+d[2]*t,g=sim.world.ground(x,z,Math.min(o[1]+d[1]*t,o[1])+.1);if(!Number.isFinite(g)){g=u.y;}return [x,g+.1,z];}
// Signature restock timers (s), extending the abilities.js map; duelist 2-kill resets are in reward18.
export const RESTOCK18={Harbor:40,'KAY/O':40,Fade:40,Gekko:0,Viper:0,Neon:0,Iso:0,Waylay:0,Hush:0,Yoru:0,Deadlock:0,Veto:0,Vyse:0};
export function reward18(u,A){/* 2-kill signature resets (wiki): Iso Double Tap, Waylay Refract, Yoru Gatecrash (E slots), Neon slide */if(['Iso','Waylay','Yoru'].includes(u.agent)&&A.e<1&&++A.signatureKills>=2){A.e=1;A.signatureKills=0;}}
// castAbility0 branch. Returns true when the cast was consumed. m: client intent (k, optional p/dist/alt/pw).
export function cast18(sim,u,m,o,d,push){
 const k=m.k,A=u.ability,ag=u.agent,C=A18,K=kits[ag];
 if(u.suppressUntil>sim.time)return false;
 // charge accounting mirrors castAbility0's rules for the 18: ult points, star pool, per-key charges
 if(k==='x'){if(A.ult<K.u)return false;}
 else if(ag==='Astra'){if(A.stars<1)return false;}
 else if(!(A[k]>0))return false;
 const p=land(sim,u,14);
 const spend=()=>{if(k==='x')A.ult=0;else if(ag==='Astra')A.stars--;else A[k]--;A.cool[k]=sim.time+.3;};
 // recasts / toggles that spend nothing
 if(ag==='Viper'&&k==='q'&&A.cloud){A.cloudOn=!A.cloudOn;A.cool.q=sim.time+.3;return true;}
 if(ag==='Viper'&&k==='e'&&A.screen){A.toxOn=!A.toxOn;A.cool.e=sim.time+.3;return true;}
 if(ag==='Viper'&&k==='x'&&A.pit){A.pit=null;sim.effects=sim.effects.filter(e=>!(e.kind==='pit'&&e.owner===u.id));A.cool.x=sim.time+.3;return true;}
 if(ag==='Vyse'&&k==='e'&&A.rose){const rp=A.rose;A.rose=null;A.e=0;A.cool.e=sim.time+.3;sim.effects=sim.effects.filter(e=>!(e.kind==='rose'&&e.owner===u.id));fx(sim,u,'flash',.25,30,{at:sim.time+.05,blind:A18.rose.blind,p:[...rp]});cast(sim,u,k,o,d,[...rp]);return true;}
 if(ag==='Veto'&&k==='c'&&A.xcutReady){u.pendingTeleport={kind:'xcut',p:[...A.xcut],at:sim.time+.3};A.xcut=null;A.xcutReady=false;sim.effects=sim.effects.filter(e=>!(e.kind==='xcut'&&e.owner===u.id));cast(sim,u,k,o,d,[...u.pendingTeleport.p]);return true;}
 if(ag==='Waylay'&&k==='e'&&A.marker){/* Refract: immune travel back (wiki) */A.cool.e=sim.time+.3;u.invulnerableUntil=Math.max(u.invulnerableUntil||0,sim.time+C.refract.travel);u.pendingTeleport={kind:'refract',p:[...A.marker],at:sim.time+C.refract.travel};A.marker=null;A.e=0;cast(sim,u,k,o,d,[...u.pendingTeleport.p]);return true;}
 if(ag==='Yoru'&&k==='e'&&A.gate){/* Gatecrash recast: teleport to the anchor (INTERACT fake-out not modelled on server) */u.pendingTeleport={kind:'gatecrash',p:[...A.gate.p],at:sim.time+.3};A.gate=null;cast(sim,u,k,o,d,[...u.pendingTeleport.p]);return true;}
 if(ag==='Clove'&&k==='x'&&!u.alive){/* Not Dead Yet: cast from death within the window */if(!(A.ult>=K.u)||!u.ndyDead||sim.time>u.ndyDead+C.ndy.window)return false;A.ult=0;u.ndy={at:sim.time+C.ndy.channel};u.invulnerableUntil=sim.time+C.ndy.channel;cast(sim,u,k,[u.x,u.y+1,u.z],[0,0,-1],[u.x,u.y,u.z]);return true;}
 switch(ag){
  case 'Astra':{spend();
   if(k==='c'){fx(sim,u,'gwell',p,C.star.wellPull,C.star.wellR,{at:sim.time+.75});}
   else if(k==='q'){fx(sim,u,'nova',p,C.star.novaDelay,C.star.novaR,{at:sim.time+C.star.novaDelay});}
   else if(k==='e'){fx(sim,u,'smoke',p,C.star.nebulaLife,C.star.nebulaR);}
   else{fx(sim,u,'divide',[u.x,u.y,u.z],C.star.divideLife,60,{yaw:u.look});}/* Cosmic Divide: an indestructible sound/vision wall across the map (lightweight: a long barrier line through the aim point) */
   cast(sim,u,k,o,d,p);return true;}
  case 'Brimstone':{spend();
   if(k==='c')fx(sim,u,'stim',p,C.stim.life,C.stim.r);
   else if(k==='q')fx(sim,u,'fire',p,C.incend.life,C.incend.r,{rate:C.incend.rate});
   else if(k==='e')fx(sim,u,'smoke',p,C.skysmoke.life,C.skysmoke.r);
   else fx(sim,u,'orbital',p,C.orbital.delay+C.orbital.life,C.orbital.r,{at:sim.time+C.orbital.delay});
   cast(sim,u,k,o,d,p);return true;}
  case 'Clove':{if(k==='c'){/* Pick-me-up: a dead enemy you damaged inside 20 m (lightweight: your last kill within the window) */const t=sim.units.find(v=>v.team!==u.team&&!v.alive&&v.lastKiller===u.id&&sim.time-(u.killAt||0)<C.pmu.window);if(!t)return false;spend();u.hasteUntil=sim.time+C.pmu.haste;u.overheal=Math.min(50,(u.overheal||0)+C.pmu.overheal);u.hp=Math.min(150,u.hp+C.pmu.overheal);cast(sim,u,k,o,d,[t.x,t.y,t.z]);return true;}
   spend();if(k==='q')fx(sim,u,'blast',p,.6,C.meddle.r,{decay:C.meddle.decay,at:sim.time+.5});else if(k==='e')fx(sim,u,'smoke',p,C.ruse.life,C.ruse.r);cast(sim,u,k,o,d,p);return true;}
  case 'Harbor':{spend();
   if(k==='c')fx(sim,u,'blast',p,.6,C.surge.r,{nearsight:C.surge.near,slow:C.surge.slow,at:sim.time+.5});
   else if(k==='q')fx(sim,u,'tide',[u.x,u.y,u.z],C.tide.dist/6,C.tide.w,{d:[aim(u)[0],0,aim(u)[2]],speed:6,life:C.tide.life});
   else if(k==='e')fx(sim,u,'cove',p,C.cove.life,C.cove.r,{hp:C.cove.shieldHp});
   else fx(sim,u,'reckon',[u.x,u.y,u.z],C.reckon.dist/C.reckon.speed,C.reckon.w,{d:[aim(u)[0],0,aim(u)[2]],speed:C.reckon.speed,born:sim.time,s:0,hit:[]});
   cast(sim,u,k,o,d,p);return true;}
  case 'Miks':{spend();
   if(k==='c')fx(sim,u,'mpulse',p,C.mpulse.life,C.mpulse.r,{heal:m.alt===true,at:sim.time+.5,next:sim.time+.5});
   else if(k==='q'){const t=sim.units.filter(v=>v!==u&&v.team===u.team&&v.alive).sort((a,b)=>Math.hypot(a.x-u.x,a.z-u.z)-Math.hypot(b.x-u.x,b.z-u.z))[0];if(t){t.stimUntil=sim.time+C.harmon.life;t.hasteUntil=sim.time+C.harmon.life;}u.stimUntil=sim.time+C.harmon.life;u.hasteUntil=sim.time+C.harmon.life;}
   else if(k==='e')fx(sim,u,'smoke',p,C.waveform.life,C.waveform.r);
   else fx(sim,u,'bassq',[u.x,u.y,u.z],.8,C.bassq.dist,{at:sim.time+.6,yaw:u.look});
   cast(sim,u,k,o,d,p);return true;}
  case 'Viper':{spend();
   if(k==='c')fx(sim,u,'fire',p,C.snake.life,C.snake.r,{rate:C.snake.rate,vuln:C.snake.vuln});
   else if(k==='q'){A.cloud=p;fx(sim,u,'emitter',p,3600,0,{kind0:'pcloud'});}
   else if(k==='e'){A.screen=[u.x,u.y,u.z,u.look];fx(sim,u,'emitter',[u.x,u.y,u.z],3600,0,{kind0:'tscreen',yaw:u.look});}
   else{A.pit=[u.x,u.y,u.z];fx(sim,u,'pit',[u.x,u.y+.1,u.z],3600,C.pit.r);}
   cast(sim,u,k,o,d,p);return true;}
  case 'Hush':{spend();
   if(k==='c'){A.flowAnchor=[u.x,u.y,u.z];u.hushFlow={at:sim.time+C.flow.delay};if(u.air){u.vy=0;u.levUntil=Math.max(u.levUntil||0,sim.time+C.flow.delay);}}
   else if(k==='q')fx(sim,u,'flash',C.flashb.delay+.2,30,{at:sim.time+C.flashb.delay,blind:C.flashb.blind,p:[...p]});
   else if(k==='e')fx(sim,u,'pull',p,C.displ.delay,C.displ.r,{at:sim.time+C.displ.delay,pull:C.displ.pull});
   else fx(sim,u,'susp',eye(u),C.susp.life,1,{d:aim(u),born:sim.time});
   cast(sim,u,k,o,d,p);return true;}
  case 'Iso':{spend();
   if(k==='c')fx(sim,u,'conting',[u.x,u.y,u.z],C.conting.dist/C.conting.speed,C.conting.w,{d:[aim(u)[0],0,aim(u)[2]],speed:C.conting.speed*(m.alt===true?.5:1),born:sim.time});
   else if(k==='q')fx(sim,u,'blast',p,.6,C.undercut.r,{supp:C.undercut.supp,vuln:C.undercut.vuln,at:sim.time+.5});
   else if(k==='e'){u.isoShield=1;u.dtShieldAt=sim.time+C.dtap.life;}
   else{/* Kill Contract (lightweight): the first enemy in a 4 m column ahead is revealed + suppressed to Iso for 8 s */const t=enemies(sim,u).find(v=>{const q=[v.x-u.x,v.z-u.z],f=q[0]*d[0]+q[1]*d[2];return f>0&&f<C.kc.range&&Math.abs(q[0]*d[2]-q[1]*d[0])<C.kc.w/2;});if(t){status(t,'suppressUntil',C.kc.life,sim);status(t,'revealedUntil',C.kc.life,sim);u.isoShield=1;u.dtShieldAt=sim.time+C.kc.life;}}
   cast(sim,u,k,o,d,p);return true;}
  case 'Neon':{spend();
   if(k==='c')fx(sim,u,'fastlane',[u.x,u.y,u.z],C.fastlane.life,C.fastlane.dist,{yaw:u.look});
   else if(k==='q'){fx(sim,u,'blast',p,.5,C.relay.r,{concuss:C.relay.concuss,at:sim.time+.4});}
   else if(k==='e')u.gearOn=true;/* High Gear: haste while fuel lasts */
   else{u.overdriveUntil=sim.time+C.od.life;u.stimUntil=sim.time+C.od.life;}
   cast(sim,u,k,o,d,p);return true;}
  case 'Waylay':{spend();
   if(k==='c')fx(sim,u,'blast',p,.6,C.satur.r,{hinder:C.satur.hinder,at:sim.time+.5});
   else if(k==='q'){const n=m.alt===true?1:2;u.dash=Motor.dash(m.f||1,0,u.look,C.ls.dash*n,C.ls.time*n);}
   else if(k==='e'){A.marker=[u.x,u.y,u.z];}
   else{u.hasteUntil=sim.time+C.cpaths.haste;fx(sim,u,'paths',[u.x,u.y,u.z],C.cpaths.haste,C.cpaths.dist/2,{at:sim.time+1.2,w:C.cpaths.w,hinder:C.cpaths.hinder});}
   cast(sim,u,k,o,d,p);return true;}
  case 'Yoru':{spend();
   if(k==='c')fx(sim,u,'decoy',[u.x,u.y,u.z],C.fakeout.life,0,{d:[aim(u)[0],0,aim(u)[2]],speed:C.fakeout.speed,ag:u.agent});
   else if(k==='q')fx(sim,u,'flash',C.blindside.delay+.2,30,{at:sim.time+C.blindside.delay,blind:C.blindside.blind,p:[...p]});
   else if(k==='e')A.gate={p:[...land(sim,u,C.gcrash.range)],until:sim.time+C.gcrash.life};
   else{u.driftUntil=sim.time+C.drift.life;u.invulnerableUntil=Math.max(u.invulnerableUntil||0,sim.time+C.drift.life);}
   cast(sim,u,k,o,d,p);return true;}
  case 'Fade':{spend();
   if(k==='c'){const t=enemies(sim,u).sort((a,b)=>Math.hypot(a.x-u.x,a.z-u.z)-Math.hypot(b.x-u.x,b.z-u.z))[0];if(t)fx(sim,u,'seeker',[u.x,u.y+1,u.z],Math.min(C.prowler.life,Math.hypot(t.x-u.x,t.z-u.z)/C.prowler.speed)+.05,0,{target:t.id,at:sim.time+Math.hypot(t.x-u.x,t.z-u.z)/C.prowler.speed,prowler:1});}
   else if(k==='q')fx(sim,u,'seize',p,C.seize.tether,C.seize.r,{at:sim.time+.5});
   else if(k==='e')fx(sim,u,'haunt',p,C.haunt.mark,C.haunt.r,{at:sim.time+.4});
   else fx(sim,u,'nightfall',[u.x,u.y,u.z],.9,C.nightfall.dist,{at:sim.time+.7,yaw:u.look});
   cast(sim,u,k,o,d,p);return true;}
  case 'Gekko':{spend();
   if(k==='c'){fx(sim,u,'mosh',p,C.mosh.life+1,C.mosh.r,{boomAt:sim.time+C.mosh.life});A.globules++;}
   else if(k==='q'){const t=enemies(sim,u).sort((a,b)=>Math.hypot(a.x-u.x,a.z-u.z)-Math.hypot(b.x-u.x,b.z-u.z))[0];if(t)fx(sim,u,'seeker',[u.x,u.y+1,u.z],Math.min(C.wing.life,Math.hypot(t.x-u.x,t.z-u.z)/C.wing.speed)+.05,0,{target:t.id,at:sim.time+Math.hypot(t.x-u.x,t.z-u.z)/C.wing.speed,wing:1});A.globules++;}
   else if(k==='e'){fx(sim,u,'dizzy',p,.6,C.dizzy.r,{at:sim.time+.5});A.globules++;}
   else fx(sim,u,'blast',p,.8,C.thrash.r,{detain:C.thrash.detain,at:sim.time+.7});
   cast(sim,u,k,o,d,p);return true;}
  case 'KAY/O':{spend();
   if(k==='c')fx(sim,u,'frag',p,C.frag.pulses*C.frag.gap+1,C.frag.r,{at:sim.time+.5,next:sim.time+.5,left:C.frag.pulses});
   else if(k==='q')fx(sim,u,'flash',C.fdrive.delay+.2,30,{at:sim.time+C.fdrive.delay,blind:C.fdrive.blind,p:[...p]});
   else if(k==='e')fx(sim,u,'blast',p,.5,C.zero.r,{supp:C.zero.supp,at:sim.time+.4});
   else{u.stimUntil=sim.time+C.nullcmd.life;fx(sim,u,'nullcmd',[u.x,u.y,u.z],C.nullcmd.life,C.nullcmd.r,{next:sim.time+C.nullcmd.pulse});}
   cast(sim,u,k,o,d,p);return true;}
  case 'Tejo':{spend();
   if(k==='c')fx(sim,u,'sdrone',p,C.sdrone.life,C.sdrone.r,{at:sim.time+.5});
   else if(k==='q')fx(sim,u,'blast',p,.5,C.sd.r,{concuss:C.sd.concuss,damage:C.sd.dmg,at:sim.time+.4});
   else if(k==='e')fx(sim,u,'salvo',p,C.salvo.pulses*C.salvo.gap+1,C.salvo.r,{at:sim.time+.6,next:sim.time+.6,left:C.salvo.pulses});
   else fx(sim,u,'armag',[u.x,u.y,u.z],1,C.armag.len,{at:sim.time+.8,yaw:u.look});
   cast(sim,u,k,o,d,p);return true;}
  case 'Deadlock':{spend();
   if(k==='c')fx(sim,u,'barrier',p,C.mesh.life,C.mesh.len/2,{seg:[C.mesh.hp],hp:C.mesh.hp,yaw:u.look,mesh:1,h:C.mesh.h});
   else if(k==='q')fx(sim,u,'sensor',p,C.sensor.life,0,{armR:C.sensor.r});
   else if(k==='e')fx(sim,u,'gnet',p,C.gnet.life,C.gnet.r,{at:sim.time+.5});
   else{const t=enemies(sim,u).filter(v=>los(sim,eye(u),[v.x,v.y+1,v.z])&&Math.hypot(v.x-u.x,v.z-u.z)<C.annih.range).sort((a,b)=>Math.hypot(a.x-u.x,a.z-u.z)-Math.hypot(b.x-u.x,b.z-u.z))[0];if(t){t.anni={by:u.id,at:sim.time+C.annih.detain};status(t,'tetheredUntil',C.annih.detain,sim);}}
   cast(sim,u,k,o,d,p);return true;}
  case 'Veto':{spend();
   if(k==='c'){A.xcut=p;A.xcutReady=true;fx(sim,u,'xcut',p,3600,0);}
   else if(k==='q')fx(sim,u,'choke',p,C.choke.life,0,{armR:C.choke.r});
   else if(k==='e')fx(sim,u,'ceptor',p,C.cept.life,C.cept.r);
   else{u.evoUntil=sim.time+C.evo.life;u.stimUntil=sim.time+C.evo.life;}
   cast(sim,u,k,o,d,p);return true;}
  case 'Vyse':{spend();
   if(k==='c')fx(sim,u,'vine',p,C.vine.life,C.vine.r,{dps:C.vine.dps,slowK:C.vine.slowK});
   else if(k==='q')fx(sim,u,'shear',p,C.shear.life,0,{armR:C.shear.r});
   else if(k==='e'){A.rose=p;fx(sim,u,'rose',p,C.rose.life,0);}
   else fx(sim,u,'garden',[u.x,u.y,u.z],C.garden.jam,C.garden.r,{at:sim.time+1.2});
   cast(sim,u,k,o,d,p);return true;}
 }
 return false;
}
function cast(sim,u,k,o,d,p){sim.castEvents.push({t:'ac',i:u.id,ag:u.agent,k,o,d,p,ts:Math.round(sim.time*1000)});}
const strip=(u,v,C)=>{const q=[v.x-u.x,v.z-u.z],f=q[0]*-Math.sin(u.look)+q[1]*-Math.cos(u.look),s=q[0]*-Math.cos(u.look)+q[1]*Math.sin(u.look);return f>0&&f<C.dist&&Math.abs(s)<C.w/2;};
// Per-frame effect + status simulation for the 18. Called from simulation.tick after unitTick.
export function tick18(sim,dt){
 const T=sim.time,gone=[];
 for(const e of sim.effects){if(!e.ag||!AG18[e.ag])continue;const C=A18,own=sim.units.find(n=>n.id===e.owner);if(e.until<T){if(e.ag==='Gekko'){const k=e.kind==='mosh'?'c':e.kind==='dizzy'?'e':e.wing?'q':0;if(own&&k&&!own.ability['re_'+k])own.ability['re_'+k]=T+A18.globule.reclaim;}continue;}
  switch(e.kind){
   case 'gwell':{for(const v of enemies(sim,own||{}))if(inR(v,e.p,e.radius)){const d=[e.p[0]-v.x,e.p[2]-v.z],l=Math.hypot(...d)||1;v.x+=d[0]/l*4*dt;v.z+=d[1]/l*4*dt;status(v,'vulnerableUntil',2,sim);}break;}
   case 'nova':if(!e.done&&T>=e.at){e.done=true;for(const v of enemies(sim,own))if(inR(v,e.p,C.star.novaR))status(v,'concussUntil',C.star.novaConcuss,sim);gone.push(e);}break;
   case 'stim':for(const v of sim.units)if(v.alive&&v.team===e.team&&inR(v,e.p,e.radius))v.stimUntil=Math.max(v.stimUntil||0,T+.5);break;
   case 'orbital':if(T>=e.at)for(const v of sim.units)if(v.alive&&inR(v,e.p,e.radius))dmg18.f(sim,own,v,C.orbital.dps*dt);break;
   case 'mpulse':if(!e.done&&T>=e.at){e.done=true;for(const v of sim.units)if(v.alive&&inR(v,e.p,e.radius)){if(e.heal&&v.team===e.team)v.hp=Math.min(v.mx,v.hp+C.mpulse.heal);else if(!e.heal&&v.team!==e.team)status(v,'concussUntil',C.mpulse.concuss,sim);}}break;
   case 'bassq':if(!e.done&&T>=e.at){e.done=true;const u=own;for(const v of enemies(sim,u))if(strip({x:e.p[0],z:e.p[2],look:e.yaw},v,{dist:C.bassq.dist,w:C.bassq.w})){const d=[v.x-e.p[0],v.z-e.p[2]],l=Math.hypot(...d)||1;v.x+=d[0]/l*C.bassq.knock;v.z+=d[1]/l*C.bassq.knock;status(v,'hinderUntil',C.bassq.slow,sim);}gone.push(e);}break;
   case 'emitter':{if(!own)break;const on=e.kind0==='pcloud'?own.ability.cloudOn:own.ability.toxOn,anchor=e.kind0==='pcloud'?own.ability.cloud:own.ability.screen;
    if(on&&own.ability.fuel>0){own.ability.fuel=Math.max(0,own.ability.fuel-C.fuel.drain*dt);
     if(!e.live){e.live=true;if(e.kind0==='pcloud')fx(sim,own,'smoke',anchor,1e9,C.pcloud.r,{sub:'pcloud'});else fx(sim,own,'smoke',[anchor[0]+-Math.sin(anchor[3])*C.tscreen.len/2,anchor[1],anchor[2]+-Math.cos(anchor[3])*C.tscreen.len/2],1e9,C.tscreen.len/2,{sub:'tscreen',yaw:anchor[3],long:1});}}
    else if(e.live){e.live=false;sim.effects=sim.effects.filter(x=>!(x.sub===e.kind0&&x.owner===e.owner));}break;}
   case 'pit':{for(const v of enemies(sim,own))if(v.alive&&inR(v,e.p,e.radius,6)){decay(sim,v,C.pit.decay*dt);status(v,'nearsightUntil',.5,sim);}if(own&&own.alive&&inR(own,e.p,e.radius,6)){own.hp=Math.min(own.mx,own.hp+8*dt);}break;}
   case 'pull':if(!e.done&&T>=e.at){e.done=true;for(const v of enemies(sim,own))if(inR(v,e.p,e.radius)){const d=[e.p[0]-v.x,e.p[2]-v.z],l=Math.hypot(...d)||1;v.x+=d[0]/l*Math.min(l,C.displ.pull);v.z+=d[1]/l*Math.min(l,C.displ.pull);}gone.push(e);}break;
   case 'susp':{e.p=[e.p[0]+e.d[0]*C.susp.speed*dt,Math.max(sim.world.ground(e.p[0],e.p[2],e.p[1]+2)+.5,e.p[1]+e.d[1]*C.susp.speed*dt),e.p[2]+e.d[2]*C.susp.speed*dt];const t=enemies(sim,own).find(v=>inR(v,e.p,C.susp.r));if(t){status(t,'suppressUntil',4,sim);t.levUntil=T+C.susp.lev;gone.push(e);}break;}
   case 'conting':case 'tide':{e.p=[e.p[0]+e.d[0]*e.speed*dt,e.p[1],e.p[2]+e.d[2]*e.speed*dt];if(e.kind==='tide')for(const v of enemies(sim,own))if(inR(v,e.p,2))status(v,'hinderUntil',C.tide.slow,sim);break;}
   case 'reckon':{e.s=(e.s||0)+C.reckon.speed*dt;e.p=[e.p[0]+e.d[0]*C.reckon.speed*dt,e.p[1],e.p[2]+e.d[2]*C.reckon.speed*dt];for(const v of enemies(sim,own))if(!e.hit.includes(v.id)&&inR(v,e.p,C.reckon.near)){e.hit.push(v.id);status(v,'nearsightUntil',C.reckon.near,sim);status(v,'hinderUntil',C.reckon.slow,sim);}break;}
   case 'paths':if(!e.done&&T>=e.at){e.done=true;for(const v of enemies(sim,own))if(inR(v,e.p,e.radius))status(v,'hinderUntil',e.hinder,sim);}break;
   case 'frag':case 'salvo':{const K=e.kind==='frag'?C.frag:C.salvo;if(T>=e.next){e.next+=K.gap;e.left--;for(const v of enemies(sim,own))if(inR(v,e.p,e.radius))dmg18.f(sim,own,v,K.dmg);}break;}
   case 'sdrone':if(!e.done&&T>=e.at){e.done=true;for(const v of enemies(sim,own))if(inR(v,e.p,e.radius)){status(v,'revealedUntil',C.sdrone.reveal,sim);status(v,'concussUntil',C.sdrone.supp,sim);}}break;
   case 'armag':if(!e.done&&T>=e.at){e.done=true;for(const v of enemies(sim,own))if(strip({x:e.p[0],z:e.p[2],look:e.yaw},v,{dist:C.armag.len,w:C.armag.w}))dmg18.f(sim,own,v,C.armag.dmg);gone.push(e);}break;
   case 'gnet':if(!e.done&&T>=e.at){e.done=true;for(const v of enemies(sim,own))if(inR(v,e.p,e.radius)){const d=[e.p[0]-v.x,e.p[2]-v.z],l=Math.hypot(...d)||1;v.x+=d[0]/l*Math.min(l,3);v.z+=d[1]/l*Math.min(l,3);status(v,'tetheredUntil',e.until-T,sim);}}break;
   case 'sensor':if(!e.done&&T>e.until-C.sensor.life+1){const t=enemies(sim,own).find(v=>inR(v,e.p,e.armR));if(t){e.done=true;for(const v of enemies(sim,own))if(inR(v,e.p,e.armR))status(v,'concussUntil',C.sensor.concuss,sim);gone.push(e);}}break;
   case 'choke':{const t=enemies(sim,own).find(v=>inR(v,e.p,e.armR));if(t&&!e.done){e.done=true;for(const v of enemies(sim,own))if(inR(v,e.p,e.armR)){decay(sim,v,C.choke.decay);status(v,'hinderUntil',C.choke.slow,sim);}gone.push(e);}break;}
   case 'ceptor':for(const x of sim.effects)if(x.owner!==e.owner&&x.team!==e.team&&['flash','blast','seeker','decoy','mosh','gnet'].includes(x.kind)&&inR({x:x.p[0],y:x.p[1],z:x.p[2]},e.p,e.radius,6))gone.push(x);break;
   case 'vine':for(const v of enemies(sim,own))if(inR(v,e.p,e.radius)){dmg18.f(sim,own,v,C.vine.dps*dt);status(v,'hinderUntil',.5,sim);}break;
   case 'shear':if(!e.done){const t=enemies(sim,own).find(v=>inR(v,e.p,e.armR));if(t){e.done=true;fx(sim,own,'barrier',e.p,C.shear.wall,C.shear.r*2,{hp:1e9});gone.push(e);}}break;
   case 'garden':if(!e.done&&T>=e.at){e.done=true;for(const v of enemies(sim,own))if(inR(v,e.p,e.radius,8))status(v,'jamUntil',C.garden.jam,sim);}break;
   case 'decoy':{e.p=[e.p[0]+e.d[0]*e.speed*dt,e.p[1],e.p[2]+e.d[2]*e.speed*dt];if(e.until-T<dt){for(const v of enemies(sim,own))if(inR(v,e.p,20)&&los(sim,[v.x,v.y+1.5,v.z],e.p))status(v,'flashUntil',C.blindside.blind,sim);}break;}
   case 'seeker':{const t=sim.units.find(v=>v.id===e.target);if(!t||!t.alive){gone.push(e);break;}const d=[t.x-e.p[0],t.z-e.p[2]],l=Math.hypot(...d);if(l<.8||T>=e.at){if(e.prowler)status(t,'nearsightUntil',C.prowler.near,sim);else if(e.wing)status(t,'concussUntil',C.wing.concuss,sim);gone.push(e);}else e.p=[e.p[0]+d[0]/l*9*dt,e.p[1],e.p[2]+d[2]/l*9*dt];break;}
   case 'mosh':{for(const v of sim.units)if(v.alive&&inR(v,e.p,e.radius))dmg18.f(sim,own,v,C.mosh.dps*dt);if(!e.done&&T>=e.boomAt){e.done=true;for(const v of enemies(sim,own))if(inR(v,e.p,e.radius))dmg18.f(sim,own,v,C.mosh.boom);}break;}
   case 'dizzy':if(!e.done&&T>=e.at){e.done=true;for(const v of enemies(sim,own))if(inR(v,e.p,e.radius))status(v,'nearsightUntil',C.dizzy.blind,sim);}break;
   case 'nullcmd':if(own&&T>=e.next){e.next+=C.nullcmd.pulse;for(const v of enemies(sim,own))if(inR(v,[own.x,own.y,own.z],e.radius,8))status(v,'suppressUntil',C.nullcmd.supp,sim);}break;
   case 'nightfall':if(!e.done&&T>=e.at){e.done=true;for(const v of enemies(sim,own))if(strip({x:e.p[0],z:e.p[2],look:e.yaw},v,{dist:C.nightfall.dist,w:C.nightfall.w})){decay(sim,v,C.nightfall.decay);status(v,'revealedUntil',C.nightfall.mark,sim);}gone.push(e);}break;
   case 'haunt':case 'seize':if(!e.done&&T>=e.at){e.done=true;for(const v of enemies(sim,own))if(inR(v,e.p,e.radius)){if(e.kind==='haunt')status(v,'revealedUntil',C.haunt.reveal,sim);else{decay(sim,v,C.seize.decay);status(v,'tetheredUntil',C.seize.tether,sim);}}gone.push(e);}break;
  }}
 if(gone.length){for(const e of gone)if(e.ag==='Gekko'){const u=sim.units.find(n=>n.id===e.owner),k=e.kind==='mosh'?'c':e.kind==='dizzy'?'e':e.wing?'q':0;if(u&&k)u.ability['re_'+k]=T+A18.globule.reclaim;}sim.effects=sim.effects.filter(e=>!gone.includes(e));}
 // unit statuses
 for(const u of sim.units){const A=u.ability;if(!A||!AG18[u.agent])continue;u.stimOn=(u.stimUntil||0)>T||!!u.gearOn||(u.overdriveUntil||0)>T||(u.hasteUntil||0)>T;if(u.agent==='Clove'){if(u.alive)u.ndyDead=0;else if(!u.ndyDead&&!u.ndy)u.ndyDead=T;}
  if(u.decayUntil&&T>u.decayUntil&&u.decayAmt>0){const r=Math.min(u.decayAmt,40*dt);u.decayAmt-=r;u.hp=Math.min(u.mx,u.hp+r);}
  if(u.pendingTeleport&&T>=u.pendingTeleport.at){[u.x,u.y,u.z]=u.pendingTeleport.p;u.pendingTeleport=null;u.vy=0;}
  if(u.ndy&&T>=u.ndy.at){u.ndy=null;u.alive=true;u.hp=100;u.loading=false;}
  if(u.hushFlow&&T>=u.hushFlow.at){u.hushFlow=null;u.vy=A18.flow.speed*.5;u.levUntil=T+.6;}
  if(u.gearOn){A.fuel=Math.max(0,A.fuel-A18.gear.drain*dt);if(A.fuel<=0)u.gearOn=false;else u.hasteUntil=Math.max(u.hasteUntil||0,T+.3);}
  else if(u.agent==='Neon'&&A.fuel<A18.fuel.max)A.fuel=Math.min(A18.fuel.max,A.fuel+A18.gear.regen*dt);
  if(u.agent==='Viper'&&!A.cloudOn&&!A.toxOn&&A.fuel<A18.fuel.max)A.fuel=Math.min(A18.fuel.max,A.fuel+A18.fuel.regen*dt);
  if(u.anni){const t=sim.units.find(v=>v.id===u.anni.by);if(!t||!t.alive||!los(sim,[t.x,t.y+1,t.z],[u.x,u.y+1,u.z])||Math.hypot(u.x-t.x,u.z-t.z)>C_annih.range+5)u.anni=null;else if(T>=u.anni.at){dmg18.f(sim,t,u,999);u.anni=null;}}
  if(u.agent==='Gekko')for(const k of ['c','q','e'])if(A['re_'+k]&&T>=A['re_'+k]){A[k]=Math.min(1,A[k]+1);A['re_'+k]=0;}
  if(u.evoUntil&&T<u.evoUntil)u.hp=Math.min(u.mx,u.hp+A18.evo.hps*dt);
 }}
const C_annih=A18.annih;
// Gekko globule expiry hook: call from effects sweep when an owned basic ends.
export function globuleDrop(u,k){u.ability['re_'+k]=0;/* auto-return after reclaim window handled via effect expiry in simulation sweep */}
