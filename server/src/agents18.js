import BarrierMesh from '../../vendor/barrier-mesh.cjs';
// The 18 agents added 2026-11-03 (roster 12 -> 30, per valorant-api.com as of patch 13.09): Astra, Brimstone, Clove,
// Harbor, Miks, Viper, Hush, Iso, Neon, Waylay, Yoru, Fade, Gekko, KAY/O, Tejo, Deadlock, Veto, Vyse.
// Same authority pattern as abilities.js / ults.js: the client sends intent only; origin, targets, timing, damage and
// status come from server state. Kit facts (slots, costs, charges, ult points) live in kits.json, grounded per ability
// page on wiki.playvalorant.com (fetched 2026-11-03). Where the engine has no native concept (Astra stars, Viper fuel,
// Gekko globules, Iso's duel arena) the mechanic says what it models; nothing is a hidden placeholder.
import Motor from './motor.cjs';
import SovaBolt from '../../vendor/sova-bolt.cjs';
import MeddleDecay from '../../vendor/meddle-decay.cjs';
import {ARENA_X,ARENA_STRIDE,ARENA_HALF} from './arena.js';
import kits from './kits.json' with {type:'json'};
export const AG18={Astra:1,Brimstone:1,Clove:1,Harbor:1,Miks:1,Viper:1,Hush:1,Iso:1,Neon:1,Waylay:1,Yoru:1,Fade:1,Gekko:1,'KAY/O':1,Tejo:1,Deadlock:1,Veto:1,Vyse:1};
export const A18_NET_KINDS=new Set(['meshflight','rib','star','gwell','nova','stim','fire','orbital','conting','undercut','fastlane','blast','tide','reckon','cove','mpulse','bassq','snake','pit','susp','pull','decoy','seeker','hawk','harmon','seize','haunt','nightfall','regrowth','trail','mosh','dizzy','frag','nullcmd','sdrone','sd','salvo','armag','mesh','sensor','gnet','xcut','choke','ceptor','vine','shear','rose','garden','paths','anni','gatefake','duel','quake','blaze','flash']);/* effect kinds the online client renders (work/agents18_runtime.js A18VIS) */
export const TYPES18={Astra:['pull','concuss','smoke'],Brimstone:['stim','fire','smoke'],Clove:['haste','decay','smoke'],Harbor:['surge','wall','cove'],Miks:['mpulse','harmonize','smoke'],Viper:['snakebite','smoke','wall'],Hush:['flow','flash','pull'],Iso:['wall','undercut','shield'],Neon:['wall','concuss','haste'],Waylay:['hinder','dash','teleport'],Yoru:['decoy','flash','teleport'],Fade:['prowler','tether','recon'],Gekko:['mosh','wingman','flash'],'KAY/O':['frag','flash','suppress'],Tejo:['drone','concuss','salvo'],Deadlock:['mesh','sensor','gravnet'],Veto:['crosscut','choke','interceptor'],Vyse:['vine','shear','arcrose']};
// Wiki stats per ability (fetched 2026-11-03), project-lightweight where noted:
export const A18={
 star:{max:4,cost:150,wellPull:2,wellVuln:2,wellR:3.5,novaDelay:1.25,novaConcuss:4,novaR:4.5,nebulaLife:14.25,nebulaR:4.1,divideLife:21,placeR:2.5,selectR:6,dissipateDelay:1.25,fakeNebula:.75},/* wiki Gravity_Well/Nova_Pulse/Nebula/Cosmic_Divide/Stars: stars place from Astral Form and persist; C/Q/E activate a placed star (consumed); Dissipate (click a placed star) returns it after 1.25 s past a brief fake Nebula */
 stim:{life:12.5,r:4,k:1.15},/* Stim Beacon: 15 % speed + rapidfire zone 12.5 s */
 incend:{life:7,r:4.5,rate:60},/* wiki Incendiary 60/s */
 skysmoke:{life:19.25,r:4.15,max:3},/* wiki Sky_Smoke */
 orbital:{delay:2,life:4,r:5,dps:150},/* wiki Orbital_Strike: 20/tick x 7.5/s */
 pmu:{haste:4,overheal:50,window:12},/* Pick-me-up: on a kill/damaged dead enemy: 50 overheal + haste */
 meddle:{r:4,decay:90,wind:.75},/* wiki /Meddle; temporal ramp/restore rates are wiki estimates (shared MeddleDecay), not exact measured facts */
 ruse:{life:12.75,r:4.15},
 ndy:{channel:3.3,window:12},/* Not Dead Yet: 3.3 s self-revive channel; earn kill/assist inside 12 s or die */
 surge:{r:6,near:2,slow:2,wind:.6},/* Storm Surge (wiki /Storm_Surge, current): radius 6 m, 0.6 s windup after landing, nearsight 2 s + slow 2 s, no line of sight needed (v12), affects allies/self. Flight uses the shared Class 3 orb model (SovaBolt.orb); its speed/gravity are project approximations, not wiki stats. */
 tide:{dist:45,life:12,slow:2,w:2},/* High Tide: vision wall that travels and slows on touch */
 cove:{life:12,r:4.1,shieldHp:500},/* Cove: smoke, then destructible shield */
 reckon:{dist:30,near:3,slow:4,speed:7},/* Reckoning (v11.10 rework): a wall that pushes forward, nearsight+slow on touch */
 mpulse:{life:6,pulse:2,r:6,concuss:2.5,heal:40},/* M-pulse: concuss OR heal pulses */
 harmon:{life:8,k:1.15},/* Harmonize: stim+haste on a targeted ally and self */
 waveform:{life:14,r:4.15,max:2},/* Waveform smokes */
 bassq:{dist:40,w:46,slow:8,knock:5,deafen:8},/* Bassquake (wiki): 40 m 60 deg cone, 5 m knockback, 8 s deafen + slow */
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
 kc:{range:40,w:4,life:8,duel:13,supp:4},/* Kill Contract (wiki): the caught duelist is revealed to Iso and suppressed on entry; the duel runs 13 s in the pocket arena (arena.js) */
 fastlane:{dist:30,gap:3,life:6},relay:{r:4.5,concuss:3.5},/* Neon */
 gear:{drain:10,regen:20,k:1.2},od:{life:10,dps:150,range:30},/* Overdrive: lightweight beam = high-dps ray while it lasts */
 satur:{r:4.5,hinder:4},ls:{dash:9,time:.35},/* Waylay Saturate / Lightspeed */
 refract:{life:20,travel:.6},/* Refract marker + immune return */
 cpaths:{len:36,w:13.5,ahead:3,wind:1,haste:7,hinder:6},/* Convergent Paths (wiki: 36 x 13.5 m, 3 m ahead, 1 s windup, buff 7 s, debuff 6 s; whether 3 m is the near edge or centre is not stated, near edge used) */
 fakeout:{life:10,speed:4.5},/* Fakeout decoy walks forward */
 blindside:{blind:1.5,delay:.6},gcrash:{speed:12,life:20,range:30},/* Yoru */
 drift:{life:10},/* Dimensional Drift: invisible + intangible, Gatecrash stays up */
 prowler:{life:3,speed:9,near:2.5,r:6},seize:{r:4.5,tether:4,decay:70},haunt:{r:25,reveal:12,mark:2},/* Fade */
 nightfall:{dist:25,w:14,decay:70,mark:12},/* Nightfall wave */
 mosh:{r:5,life:3,dps:20,boom:70},wing:{life:5,speed:9,concuss:3.5,r:3},dizzy:{life:2.5,blind:1.5,r:15},thrash:{r:6,detain:6,dash:12},/* Gekko; globule reclaim: used basics return after 10 s at the drop point (lightweight: auto-return) */
 globule:{reclaim:10},
 frag:{r:4,inner:1,pulses:4,gap:1,dmg:60,dmgOut:25,wind:.5},fdrive:{blind:2.25,delay:1.6},zero:{r:15,supp:8},nullcmd:{life:10,pulse:3,r:20,supp:8},/* KAY/O (downed state not modelled) */
 sdrone:{life:8,r:12,reveal:3,supp:6},sd:{r:4,concuss:3,dmg:40},salvo:{r:4.5,inner:2.5,pulses:3,gap:.8,dmg:65,dmgOut:50,wind:1.25,fly:30},armag:{len:32,w:12,dmg:60,segs:16,seg:2,ticks:4,tick:.25,gap:.25,wind:3.08},/* Tejo */
 mesh:{life:30,len:7.5,h:3,hp:680},/* Barrier Mesh: nodes form movement-blocking segments */
 sensor:{life:30,r:8,concuss:3},gnet:{r:6,life:8,slowK:.35},/* Deadlock */
 annih:{range:20,w:3,detain:7,dmg:70},/* Annihilation (wiki): 600 HP cocoon - teammates shoot it to free the captive; the wire snaps on death / lost link, kills at the wire end */
 xcut:{range:25},choke:{life:30,r:6,decay:60,slow:2},cept:{life:30,r:10},/* Veto */
 evo:{life:12,hps:10},/* Evolution: stim + 10/s heal + debuff immunity (weapon damage still lands) */
 vine:{life:30,r:6,slowK:.4,dps:15},shear:{life:30,r:2.5,wall:8},rose:{life:30,blind:2,r:20},garden:{r:20,jam:8},/* Vyse */
};
export function init18(u,A){if(!AG18[u.agent])return;A.slides=u.agent==='Neon'?1:0;/* wiki High Gear v9.11: 2 >>> 1 slide charge */A.slideKills=0;A.stars=u.agent==='Astra'?2:0;A.fuel=(u.agent==='Viper'||u.agent==='Neon')?A18.fuel.max:0;A.globules=0;A.astral=false;u.astralForm=false;u.starBackAt=0;/* Astra: 2 Stars a round (wiki Stars); Viper/Neon: full fuel tank */A.toxOn=false;A.cloudOn=false;A.gate=null;A.marker=null;A.decoy=null;u.isoShield=0;u.driftUntil=0;u.evoUntil=0;u.suppressUntil=0;u.jamUntil=0;u.hinderUntil=0;u.deafenUntil=0;u.levUntil=0;u.decayUntil=0;u.decayAmt=0;u.hasteUntil=0;u.stimUntil=0;u.gravUntil=0;u.ndy=null;u.overheal=0;}
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
function ownStarNear(sim,u,p,r){let best=null,bd=r;for(const e of sim.effects){if(e.kind!=='star'||e.owner!==u.id)continue;const d=Math.hypot(e.p[0]-p[0],e.p[2]-p[2]);if(d<bd){bd=d;best=e;}}return best;}/* a placed Astral Star is an fx row 'star' owned by the caster */
function land(sim,u,range){/* crosshair floor point, as aimFloor's simple form */const o=eye(u),d=aim(u),hit=sim.world.ray(o,d,range),t=Number.isFinite(hit)?Math.max(0,hit-.5):range;let x=o[0]+d[0]*t,z=o[2]+d[2]*t,g=sim.world.ground(x,z,Math.min(o[1]+d[1]*t,o[1])+.1);if(!Number.isFinite(g)){g=u.y;}return [x,g+.1,z];}
// Signature restock timers (s), extending the abilities.js map; duelist 2-kill resets are in reward18.
export const RESTOCK18={Harbor:40,'KAY/O':40,Fade:40,Gekko:0,Viper:0,Neon:0,Iso:0,Waylay:0,Hush:0,Yoru:0,Deadlock:0,Veto:0,Vyse:0};
export function reward18(u,A){/* 2-kill signature resets (wiki): Iso Double Tap, Waylay Refract, Yoru Gatecrash (E slots), Neon slide charges */if(['Iso','Waylay','Yoru'].includes(u.agent)&&A.e<1&&++A.signatureKills>=2){A.e=1;A.signatureKills=0;}if(u.agent==='Neon'&&(A.slides||0)<1&&++A.slideKills>=2){A.slides=1;A.slideKills=0;}}
// castAbility0 branch. Returns true when the cast was consumed. m: client intent (k, optional p/dist/alt/pw).
export function cast18(sim,u,m,o,d,push){
 const k=m.k,A=u.ability,ag=u.agent,C=A18,K=kits[ag];
 if(u.suppressUntil>sim.time)return false;
 if(ag==='Neon'&&k==='e'&&u.gearOn&&m.alt===true){if((A.slides||0)<1)return false;A.slides--;u.gearOn=false;u.dash=Motor.dash(m.f||1,0,u.look,6,.3);A.cool.e=sim.time+.3;cast(sim,u,k,o,d,[u.x,u.y,u.z]);return true;}/* High Gear ALT FIRE: slide (wiki High_Gear: 1 charge v9.11, 2-kill reset, deactivates High Gear; Neon can fire during the slide, v8.11) */
 // recasts / toggles that spend nothing
 if(ag==='Viper'&&k==='q'&&A.cloud){A.cloudOn=!A.cloudOn;A.cool.q=sim.time+.3;return true;}
 if(ag==='Viper'&&k==='e'&&A.screen){A.toxOn=!A.toxOn;A.cool.e=sim.time+.3;return true;}
 if(ag==='Viper'&&k==='x'&&A.pit){A.pit=null;sim.effects=sim.effects.filter(e=>!(e.kind==='pit'&&e.owner===u.id));A.cool.x=sim.time+.3;return true;}
 if(ag==='Vyse'&&k==='e'&&A.rose){const rp=A.rose;A.rose=null;A.e=0;A.cool.e=sim.time+.3;sim.effects=sim.effects.filter(e=>!(e.kind==='rose'&&e.owner===u.id));fx(sim,u,'flash',[...rp],.25,30,{at:sim.time+.05,blind:A18.rose.blind});cast(sim,u,k,o,d,[...rp]);return true;}
 if(ag==='Veto'&&k==='c'&&A.xcutReady){u.pendingTeleport={kind:'xcut',p:[...A.xcut],at:sim.time+.3};A.xcut=null;A.xcutReady=false;sim.effects=sim.effects.filter(e=>!(e.kind==='xcut'&&e.owner===u.id));cast(sim,u,k,o,d,[...u.pendingTeleport.p]);return true;}
 if(ag==='Waylay'&&k==='e'&&A.marker){/* Refract: immune travel back (wiki) */A.cool.e=sim.time+.3;u.invulnerableUntil=Math.max(u.invulnerableUntil||0,sim.time+C.refract.travel);u.pendingTeleport={kind:'refract',p:[...A.marker],at:sim.time+C.refract.travel};A.marker=null;A.e=0;cast(sim,u,k,o,d,[...u.pendingTeleport.p]);return true;}
 if(ag==='Yoru'&&k==='e'&&A.gate){/* Gatecrash (wiki): recast teleports in 1.2 s total (0.5 s windup + 0.7 s arrival); USE (m.fk) fakes it - the same audio cue, no teleport, the anchor survives, and a 30 s decal marks the fake (v4.04) */
  if(m.fk===1){fx(sim,u,'gatefake',[...A.gate.p],30,1.2,{at:sim.time});cast(sim,u,k,o,d,[...A.gate.p]);return true;}
  u.pendingTeleport={kind:'gatecrash',p:[...A.gate.p],at:sim.time+1.2};A.gate=null;cast(sim,u,k,o,d,[...u.pendingTeleport.p]);return true;}
 if(ag==='Astra'&&u.human){/* Astral Form (wiki Astral_Form/Stars/Cosmic_Divide): X opens the map view; a map click (k 's') places a persistent Star, or dissipates one clicked; c/q/e on the map activate the placed star nearest the click; X across two points places Cosmic Divide and exits, X alone exits */
  const mp=Array.isArray(m.p)&&m.p.length>=2&&m.p.slice(0,2).every(Number.isFinite)?[Math.max(-200,Math.min(200,m.p[0])),0,Math.max(-200,Math.min(200,m.p[1]))]:null;
  if(mp){const gy=sim.world.ground(mp[0],mp[2],3);mp[1]=Number.isFinite(gy)?gy:0;}/* stars and their activations sit on the map's real ground, not y=0 */
  if(k==='x'){
   if(!A.astral){if(A.ult<K.u)return false;A.astral=true;u.astralForm=true;return true;}
   if(Array.isArray(m.p)&&m.p.length>=4&&m.p.slice(0,4).every(Number.isFinite)){const x1=Math.max(-200,Math.min(200,m.p[0])),z1=Math.max(-200,Math.min(200,m.p[1])),x2=Math.max(-200,Math.min(200,m.p[2])),z2=Math.max(-200,Math.min(200,m.p[3]));
    A.astral=false;u.astralForm=false;A.ult=0;const cx=(x1+x2)/2,cz=(z1+z2)/2,yaw=Math.atan2(-(x2-x1),-(z2-z1)),half=Math.max(4,Math.hypot(x2-x1,z2-z1)/2);
    fx(sim,u,'divide',[cx,0,cz],C.star.divideLife,half,{yaw});cast(sim,u,k,o,d,[cx,0,cz]);return true;}
   A.astral=false;u.astralForm=false;return true;}
  if(k==='s'){if(!A.astral||!mp)return false;/* Stars place only from the Astral Form map (wiki Stars) */
   const s0=ownStarNear(sim,u,mp,C.star.placeR);
   if(s0){/* Dissipate (wiki Nebula): click a placed star - brief fake Nebula, the star returns after 1.25 s */
    sim.effects=sim.effects.filter(e=>e!==s0);fx(sim,u,'smoke',s0.p,C.star.fakeNebula,C.star.nebulaR);u.starBackAt=sim.time+C.star.dissipateDelay;cast(sim,u,k,o,d,s0.p);return true;}
   if(A.stars<1)return false;A.stars--;A.cool[k]=sim.time+.3;
   fx(sim,u,'star',mp,400,1,{born:sim.time});cast(sim,u,k,o,d,mp);return true;}
  if(A.astral&&mp&&(k==='c'||k==='q'||k==='e')){/* activate the placed star nearest the clicked point (wiki: C/Q/E target a Star, any range) */
   const s0=ownStarNear(sim,u,mp,C.star.selectR);if(!s0)return false;
   sim.effects=sim.effects.filter(e=>e!==s0);A.cool[k]=sim.time+.3;const q=s0.p;
   if(k==='c')fx(sim,u,'gwell',q,C.star.wellPull,C.star.wellR,{at:sim.time+.75});
   else if(k==='q')fx(sim,u,'nova',q,C.star.novaDelay,C.star.novaR,{at:sim.time+C.star.novaDelay});
   else fx(sim,u,'smoke',q,C.star.nebulaLife,C.star.nebulaR);
   cast(sim,u,k,o,d,q);return true;}
  if(A.astral)return false;}
 if(ag==='Tejo'&&u.human&&Array.isArray(m.p)&&m.p.length>=2&&m.p.every(Number.isFinite)){/* Guided Salvo (wiki): up to two map-picked strikes; Armageddon: map-picked origin, wave from Tejo through it */
  if(k==='e'){if(!(A.e>0))return false;const pts=[];for(let i=0;i+1<m.p.length&&pts.length<2;i+=2)pts.push([Math.max(-200,Math.min(200,m.p[i])),0,Math.max(-200,Math.min(200,m.p[i+1]))]);
   A.e--;A.cool.e=sim.time+.3;for(const q of pts){const dl=Math.hypot(q[0]-u.x,q[2]-u.z)/C.salvo.fly+C.salvo.wind;fx(sim,u,'salvo',q,dl+C.salvo.pulses*C.salvo.gap+1,C.salvo.r,{at:sim.time+dl,next:sim.time+dl,left:C.salvo.pulses});}
   cast(sim,u,k,o,d,pts[0]);return true;}
  if(k==='x'){if(A.ult<K.u)return false;A.ult=0;const q=[Math.max(-200,Math.min(200,m.p[0])),0,Math.max(-200,Math.min(200,m.p[1]))],yaw=Math.atan2(-(q[0]-u.x),-(q[2]-u.z));
   fx(sim,u,'armag',q,C.armag.wind+(C.armag.segs-1)*C.armag.gap+C.armag.ticks*C.armag.tick+.2,C.armag.len,{at:sim.time+C.armag.wind,yaw,fired:[]});cast(sim,u,k,o,d,q);return true;}}
 if(ag==='Clove'&&k==='x'&&!u.alive){/* Not Dead Yet: cast from death within the window */if(!(A.ult>=K.u)||!u.ndyDead||sim.time>u.ndyDead+C.ndy.window)return false;A.ult=0;u.ndy={at:sim.time+C.ndy.channel};u.invulnerableUntil=sim.time+C.ndy.channel;cast(sim,u,k,[u.x,u.y+1,u.z],[0,0,-1],[u.x,u.y,u.z]);return true;}
 // charge accounting mirrors castAbility0's rules for the 18: ult points, star pool, per-key charges
 if(k==='x'){if(A.ult<K.u)return false;}
 else if(ag==='Astra'){/* placed-star activation gates inside the case; the pool only buys new stars */}
 else if(!(A[k]>0))return false;
 const p=land(sim,u,14);
 const spend=()=>{if(k==='x')A.ult=0;else if(ag==='Astra')A.stars--;else A[k]--;A.cool[k]=sim.time+.3;};
 switch(ag){
  case 'Astra':{
   if(k==='x'){spend();fx(sim,u,'divide',[u.x,u.y,u.z],C.star.divideLife,60,{yaw:u.look});/* Cosmic Divide: an indestructible sound/vision wall across the map (lightweight: a long barrier line through the aim point) */
    cast(sim,u,k,o,d,p);return true;}
   if(k==='s')return false;
   const s0=ownStarNear(sim,u,p,1e9);/* activation targets the star nearest the crosshair point, unlimited range (wiki Stars) */
   if(!s0){if(u.human||A.stars<1)return false;/* a bot without a placed star places one at its aim point first */
    A.stars--;A.cool[k]=sim.time+.3;fx(sim,u,'star',p,400,1,{born:sim.time});cast(sim,u,k,o,d,p);return true;}
   sim.effects=sim.effects.filter(e=>e!==s0);A.cool[k]=sim.time+.3;const q=s0.p;
   if(k==='c'){fx(sim,u,'gwell',q,C.star.wellPull,C.star.wellR,{at:sim.time+.75});}
   else if(k==='q'){fx(sim,u,'nova',q,C.star.novaDelay,C.star.novaR,{at:sim.time+C.star.novaDelay});}
   else{fx(sim,u,'smoke',q,C.star.nebulaLife,C.star.nebulaR);}
   cast(sim,u,k,o,d,q);return true;}
  case 'Brimstone':{spend();
   if(k==='c')fx(sim,u,'stim',p,C.stim.life,C.stim.r);
   else if(k==='q')fx(sim,u,'fire',p,C.incend.life,C.incend.r,{rate:C.incend.rate});
   else if(k==='e')fx(sim,u,'smoke',p,C.skysmoke.life,C.skysmoke.r);
   else fx(sim,u,'orbital',p,C.orbital.delay+C.orbital.life,C.orbital.r,{at:sim.time+C.orbital.delay});
   cast(sim,u,k,o,d,p);return true;}
  case 'Clove':{if(k==='c'){/* Pick-me-up: a dead enemy you damaged inside 20 m (lightweight: your last kill within the window) */const t=sim.units.find(v=>v.team!==u.team&&!v.alive&&v.lastKiller===u.id&&sim.time-(u.killAt||0)<C.pmu.window);if(!t)return false;spend();u.hasteUntil=sim.time+C.pmu.haste;u.overheal=Math.min(50,(u.overheal||0)+C.pmu.overheal);u.hp=Math.min(150,u.hp+C.pmu.overheal);cast(sim,u,k,o,d,[t.x,t.y,t.z]);return true;}
   spend();if(k==='q'){const W=sim.world,rayN=W.rayN?(a,b,c)=>W.rayN(a,b,c):(a,b,c)=>{const t=W.ray(a,b,c);return Number.isFinite(t)&&t<=c?{distance:t,normal:null}:null;},fl=SovaBolt.orb(o,d,rayN,(x,z,y)=>W.ground(x,z,y));p.splice(0,3,...fl.end);fx(sim,u,'blast',p,fl.t+C.meddle.wind+.1,C.meddle.r,{meddle:1,landAt:sim.time+fl.t,at:sim.time+fl.t+C.meddle.wind,dnLinger:1});}else if(k==='e')fx(sim,u,'smoke',p,C.ruse.life,C.ruse.r,{born:sim.time});cast(sim,u,k,o,d,p);return true;}
  case 'Harbor':{spend();
   if(k==='c'){const W=sim.world,rayN=W.rayN?(a,b,c)=>W.rayN(a,b,c):(a,b,c)=>{const t=W.ray(a,b,c);return Number.isFinite(t)&&t<=c?{distance:t,normal:null}:null;},flight=SovaBolt.orb(o,d,rayN,(x,z,y)=>W.ground(x,z,y)),fl=flight.t;p.splice(0,3,...flight.end);fx(sim,u,'blast',p,fl+C.surge.wind+.1,C.surge.r,{surge:1,landAt:sim.time+fl,nearsight:C.surge.near,slow:C.surge.slow,at:sim.time+fl+C.surge.wind,dnLinger:1});}
   else if(k==='q')fx(sim,u,'tide',[u.x,u.y,u.z],C.tide.dist/6,C.tide.w,{d:[aim(u)[0],0,aim(u)[2]],speed:6,life:C.tide.life});
   else if(k==='e')fx(sim,u,'cove',p,C.cove.life,C.cove.r,{hp:C.cove.shieldHp});
   else fx(sim,u,'reckon',[u.x,u.y,u.z],C.reckon.dist/C.reckon.speed,C.reckon.w,{d:[aim(u)[0],0,aim(u)[2]],speed:C.reckon.speed,born:sim.time,s:0,hit:[]});
   cast(sim,u,k,o,d,p);return true;}
  case 'Miks':{spend();
   if(k==='c')fx(sim,u,'mpulse',p,C.mpulse.life,C.mpulse.r,{heal:m.alt===true,at:sim.time+.5,next:sim.time+.5});
   else if(k==='q'){const t=sim.units.filter(v=>v!==u&&v.team===u.team&&v.alive).sort((a,b)=>Math.hypot(a.x-u.x,a.z-u.z)-Math.hypot(b.x-u.x,b.z-u.z))[0];if(t){t.stimUntil=sim.time+C.harmon.life;t.hasteUntil=sim.time+C.harmon.life;}u.stimUntil=sim.time+C.harmon.life;u.hasteUntil=sim.time+C.harmon.life;for(const w of t?[u,t]:[u])fx(sim,u,'harmon',[w.x,w.y,w.z],C.harmon.life,0,{tg:w.id});/* one row per buffed unit: p follows the unit (tick18), row ends with the buff, death or reset */}
   else if(k==='e')fx(sim,u,'smoke',p,C.waveform.life,C.waveform.r,{wf:1});
   else fx(sim,u,'bassq',[u.x,u.y,u.z],.8,C.bassq.dist,{at:sim.time+.6,yaw:u.look});
   cast(sim,u,k,o,d,p);return true;}
  case 'Viper':{spend();
   if(k==='c')fx(sim,u,'fire',p,C.snake.life,C.snake.r,{rate:C.snake.rate,vuln:C.snake.vuln,sub:'snake'});
   else if(k==='q'){A.cloud=p;fx(sim,u,'emitter',p,3600,0,{kind0:'pcloud'});}
   else if(k==='e'){A.screen=[u.x,u.y,u.z,u.look];fx(sim,u,'emitter',[u.x,u.y,u.z],3600,0,{kind0:'tscreen',yaw:u.look});}
   else{A.pit=[u.x,u.y,u.z];fx(sim,u,'pit',[u.x,u.y+.1,u.z],3600,C.pit.r);}
   cast(sim,u,k,o,d,p);return true;}
  case 'Hush':{spend();
   if(k==='c'){A.flowAnchor=[u.x,u.y,u.z];u.hushFlow={at:sim.time+C.flow.delay};if(u.air){u.vy=0;u.levUntil=Math.max(u.levUntil||0,sim.time+C.flow.delay);}}
   else if(k==='q')fx(sim,u,'flash',[...p],C.flashb.delay+.2,30,{at:sim.time+C.flashb.delay,blind:C.flashb.blind});
   else if(k==='e')fx(sim,u,'pull',p,C.displ.delay,C.displ.r,{at:sim.time+C.displ.delay,pull:C.displ.pull});
   else fx(sim,u,'susp',eye(u),C.susp.life,1,{d:aim(u),born:sim.time});
   cast(sim,u,k,o,d,p);return true;}
  case 'Iso':{spend();
   if(k==='c')fx(sim,u,'conting',[u.x,u.y,u.z],C.conting.dist/C.conting.speed,C.conting.w,{d:[aim(u)[0],0,aim(u)[2]],speed:C.conting.speed*(m.alt===true?.5:1),born:sim.time});
   else if(k==='q')fx(sim,u,'blast',p,.6,C.undercut.r,{supp:C.undercut.supp,vuln:C.undercut.vuln,at:sim.time+.5});
   else if(k==='e'){u.isoShield=1;u.dtShieldAt=sim.time+C.dtap.life;}
   else{/* Kill Contract (wiki): the first enemy in the column is pulled into a walled 1v1 cell with Iso; suppress on entry, 13 s or a kill ends it */const t=enemies(sim,u).find(v=>{const q=[v.x-u.x,v.z-u.z],f=q[0]*d[0]+q[1]*d[2];return f>0&&f<C.kc.range&&Math.abs(q[0]*d[2]-q[1]*d[0])<C.kc.w/2;});if(!t)return false;duel18(sim,u,t,C);}
   cast(sim,u,k,o,d,p);return true;}
  case 'Neon':{spend();
   if(k==='c')fx(sim,u,'fastlane',[u.x,u.y,u.z],C.fastlane.life,C.fastlane.dist/2,{yaw:u.look});
   else if(k==='q'){fx(sim,u,'blast',p,.5,C.relay.r,{concuss:C.relay.concuss,at:sim.time+.4});}
   else if(k==='e'){if(u.gearOn&&m.alt===true&&(A.slides||0)>0){A.slides--;u.gearOn=false;u.dash=Motor.dash(m.f||1,0,u.look,6,.3);/* slide: ends High Gear (wiki) */}else u.gearOn=true;/* High Gear: haste while fuel lasts; ALT slides (1 charge v9.11, 2 kills reset) */}
   else{u.overdriveUntil=sim.time+C.od.life;u.stimUntil=sim.time+C.od.life;}
   cast(sim,u,k,o,d,p);return true;}
  case 'Waylay':{spend();
   if(k==='c')fx(sim,u,'blast',p,.6,C.satur.r,{hinder:C.satur.hinder,at:sim.time+.5});
   else if(k==='q'){const n=m.alt===true?1:2;u.dash=Motor.dash(m.f||1,0,u.look,C.ls.dash*n,C.ls.time*n);}
   else if(k==='e'){A.marker=[u.x,u.y,u.z];}
   else{const P=C.cpaths;u.hasteUntil=sim.time+P.haste;fx(sim,u,'paths',[u.x-Math.sin(u.look)*P.ahead,u.y,u.z-Math.cos(u.look)*P.ahead],P.haste,P.len,{at:sim.time+P.wind,w:P.w,len:P.len,yaw:u.look,hinder:P.hinder});}
   cast(sim,u,k,o,d,p);return true;}
  case 'Yoru':{spend();
   if(k==='c')fx(sim,u,'decoy',[u.x,u.y,u.z],C.fakeout.life,0,{d:[aim(u)[0],0,aim(u)[2]],speed:C.fakeout.speed,ag:u.agent});
   else if(k==='q')fx(sim,u,'flash',[...p],C.blindside.delay+.2,30,{at:sim.time+C.blindside.delay,blind:C.blindside.blind});
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
   if(k==='c')fx(sim,u,'frag',p,C.frag.wind+C.frag.pulses*C.frag.gap+1,C.frag.r,{at:sim.time+C.frag.wind,next:sim.time+C.frag.wind,left:C.frag.pulses});
   else if(k==='q')fx(sim,u,'flash',[...p],C.fdrive.delay+.2,30,{at:sim.time+C.fdrive.delay,blind:C.fdrive.blind});
   else if(k==='e')fx(sim,u,'blast',p,.5,C.zero.r,{supp:C.zero.supp,at:sim.time+.4});
   else{u.stimUntil=sim.time+C.nullcmd.life;u.nullCmdUntil=sim.time+C.nullcmd.life+15;/* downed can outlive the pulse field (wiki NULL/cmd: downed 15 s, 850 HP, ally revive 5 s) */fx(sim,u,'nullcmd',[u.x,u.y,u.z],C.nullcmd.life,C.nullcmd.r,{next:sim.time+C.nullcmd.pulse});}
   cast(sim,u,k,o,d,p);return true;}
  case 'Tejo':{spend();
   if(k==='c')fx(sim,u,'sdrone',p,C.sdrone.life,C.sdrone.r,{at:sim.time+.5});
   else if(k==='q')fx(sim,u,'blast',p,.5,C.sd.r,{concuss:C.sd.concuss,damage:C.sd.dmg,at:sim.time+.4});
   else if(k==='e'){const dl=Math.hypot(p[0]-u.x,p[2]-u.z)/C.salvo.fly+C.salvo.wind;fx(sim,u,'salvo',p,dl+C.salvo.pulses*C.salvo.gap+1,C.salvo.r,{at:sim.time+dl,next:sim.time+dl,left:C.salvo.pulses});}
   else fx(sim,u,'armag',[u.x,u.y,u.z],C.armag.wind+(C.armag.segs-1)*C.armag.gap+C.armag.ticks*C.armag.tick+.2,C.armag.len,{at:sim.time+C.armag.wind,yaw:u.look,fired:[]});
   cast(sim,u,k,o,d,p);return true;}
  case 'Deadlock':{if(k==='c'){const W=sim.baseWorld||sim.world;if(typeof W.rayN!=='function')return false;const plan=BarrierMesh.flight(o,d,W,SovaBolt);if(!plan)return false;spend();fx(sim,u,'meshflight',o,plan.t+BarrierMesh.C.life,0,{plan,born:sim.time,landAt:sim.time+plan.t,yaw:u.look});cast(sim,u,k,o,d,plan.end);return true;}spend();
   if(k==='q')fx(sim,u,'sensor',p,C.sensor.life,0,{armR:C.sensor.r});
   else if(k==='e')fx(sim,u,'gnet',p,C.gnet.life,C.gnet.r,{at:sim.time+.5});
   else{const t=enemies(sim,u).filter(v=>los(sim,eye(u),[v.x,v.y+1,v.z])&&Math.hypot(v.x-u.x,v.z-u.z)<C.annih.range).sort((a,b)=>Math.hypot(a.x-u.x,a.z-u.z)-Math.hypot(b.x-u.x,b.z-u.z))[0];if(t){t.anni={by:u.id,at:sim.time+C.annih.detain,hp:600};/* wiki Annihilate: 600 HP cocoon - teammates shoot it to free them */status(t,'tetheredUntil',C.annih.detain,sim);fx(sim,u,'anni',[t.x,t.y,t.z],C.annih.detain,1.5);/* the cocoon, rendered online */}}
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
 const T=sim.time,gone=[];for(const e of sim.effects.slice()){if(e.kind!=='harmon')continue;const w=sim.units.find(n=>n.id===e.tg);if(!w||!w.alive){sim.effects.splice(sim.effects.indexOf(e),1);continue;}e.p=[w.x,w.y,w.z];}
 for(const u of sim.units){const A=u.ability;if(A&&u.agent==='Astra'&&u.starBackAt&&T>=u.starBackAt){u.starBackAt=0;A.stars=Math.min(A18.star.max,A.stars+1);}}/* a dissipated Star reforms in the pool (wiki Nebula/Dissipate) */
 for(const e of sim.effects){if(!e.ag||!AG18[e.ag])continue;const C=A18,own=sim.units.find(n=>n.id===e.owner);if(e.until<T){if(e.ag==='Gekko'){const k=e.kind==='mosh'?'c':e.kind==='dizzy'?'e':e.wing?'q':0;if(own&&k&&!own.ability['re_'+k])own.ability['re_'+k]=T+A18.globule.reclaim;}continue;}
  switch(e.kind){
   case 'meshflight':{const age=Math.max(0,T-e.born);SovaBolt.at(e.plan.tr,age,e.p);if(T>=e.landAt){const W=sim.baseWorld||sim.world,bm=BarrierMesh.create(e.plan.end,e.yaw,BarrierMesh.terrainResolver(W));e.kind='barrier';e.p=e.plan.end.slice();e.bm=bm;e.born=e.landAt;e.until=e.born+BarrierMesh.C.life;e.mesh=1;e.h=BarrierMesh.C.height;e.radius=BarrierMesh.C.arm;BarrierMesh.advance(bm,Math.min(BarrierMesh.C.life,Math.max(0,T-e.born)));e.hp=bm.nodes.reduce((sum,n)=>sum+(n?.hp||0),0);}break;}

   case 'gwell':{for(const v of enemies(sim,own||{}))if(inR(v,e.p,e.radius)){const d=[e.p[0]-v.x,e.p[2]-v.z],l=Math.hypot(...d)||1;v.x+=d[0]/l*4*dt;v.z+=d[1]/l*4*dt;status(v,'vulnerableUntil',2,sim);}break;}
   case 'nova':if(!e.done&&T>=e.at){e.done=true;for(const v of enemies(sim,own))if(inR(v,e.p,C.star.novaR))status(v,'concussUntil',C.star.novaConcuss,sim);gone.push(e);}break;
   case 'stim':for(const v of sim.units)if(v.alive&&v.team===e.team&&inR(v,e.p,e.radius))v.stimUntil=Math.max(v.stimUntil||0,T+.5);break;
   case 'orbital':if(T>=e.at)for(const v of sim.units)if(v.alive&&inR(v,e.p,e.radius))dmg18.f(sim,own,v,C.orbital.dps*dt);break;
   case 'mpulse':if(!e.done&&T>=e.at){e.done=true;for(const v of sim.units)if(v.alive&&inR(v,e.p,e.radius)){if(e.heal&&v.team===e.team)v.hp=Math.min(v.mx,v.hp+C.mpulse.heal);else if(!e.heal&&v.team!==e.team)status(v,'concussUntil',C.mpulse.concuss,sim);}}break;
   case 'bassq':if(!e.done&&T>=e.at){e.done=true;const u=own;for(const v of enemies(sim,u))if(strip({x:e.p[0],z:e.p[2],look:e.yaw},v,{dist:C.bassq.dist,w:C.bassq.w})){const d=[v.x-e.p[0],v.z-e.p[2]],l=Math.hypot(...d)||1;v.x+=d[0]/l*C.bassq.knock;v.z+=d[1]/l*C.bassq.knock;status(v,'hinderUntil',C.bassq.slow,sim);status(v,'deafenUntil',C.bassq.deafen,sim);}gone.push(e);}break;
   case 'emitter':{if(!own)break;const on=e.kind0==='pcloud'?own.ability.cloudOn:own.ability.toxOn,anchor=e.kind0==='pcloud'?own.ability.cloud:own.ability.screen;
    if(on&&own.ability.fuel>0){own.ability.fuel=Math.max(0,own.ability.fuel-C.fuel.drain*dt);
     if(!e.live){e.live=true;if(e.kind0==='pcloud')fx(sim,own,'smoke',anchor,1e9,C.pcloud.r,{sub:'pcloud'});else fx(sim,own,'smoke',[anchor[0]+-Math.sin(anchor[3])*C.tscreen.len/2,anchor[1],anchor[2]+-Math.cos(anchor[3])*C.tscreen.len/2],1e9,C.tscreen.len/2,{sub:'tscreen',yaw:anchor[3],long:1});}}
    else if(e.live){e.live=false;sim.effects=sim.effects.filter(x=>!(x.sub===e.kind0&&x.owner===e.owner));}break;}
   case 'pit':{for(const v of enemies(sim,own))if(v.alive&&inR(v,e.p,e.radius,6)){decay(sim,v,C.pit.decay*dt);status(v,'nearsightUntil',.5,sim);}if(own&&own.alive&&inR(own,e.p,e.radius,6)){own.hp=Math.min(own.mx,own.hp+8*dt);}break;}
   case 'pull':if(!e.done&&T>=e.at){e.done=true;for(const v of enemies(sim,own))if(inR(v,e.p,e.radius)){const d=[e.p[0]-v.x,e.p[2]-v.z],l=Math.hypot(...d)||1;v.x+=d[0]/l*Math.min(l,C.displ.pull);v.z+=d[1]/l*Math.min(l,C.displ.pull);}gone.push(e);}break;
   case 'susp':{e.p=[e.p[0]+e.d[0]*C.susp.speed*dt,Math.max(sim.world.ground(e.p[0],e.p[2],e.p[1]+2)+.5,e.p[1]+e.d[1]*C.susp.speed*dt),e.p[2]+e.d[2]*C.susp.speed*dt];const t=enemies(sim,own).find(v=>inR(v,e.p,C.susp.r));if(t){status(t,'suppressUntil',4,sim);t.levUntil=T+C.susp.lev;gone.push(e);}break;}
   case 'conting':case 'tide':{e.p=[e.p[0]+e.d[0]*e.speed*dt,e.p[1],e.p[2]+e.d[2]*e.speed*dt];if(e.kind==='tide')for(const v of enemies(sim,own))if(inR(v,e.p,2))status(v,'hinderUntil',C.tide.slow,sim);break;}
   case 'reckon':{e.s=(e.s||0)+C.reckon.speed*dt;e.p=[e.p[0]+e.d[0]*C.reckon.speed*dt,e.p[1],e.p[2]+e.d[2]*C.reckon.speed*dt];for(const v of enemies(sim,own))if(!e.hit.includes(v.id)&&inR(v,e.p,C.reckon.near)){e.hit.push(v.id);status(v,'nearsightUntil',C.reckon.near,sim);status(v,'hinderUntil',C.reckon.slow,sim);}break;}
   case 'paths':if(!e.done&&T>=e.at){e.done=true;for(const v of enemies(sim,own))if(strip({x:e.p[0],z:e.p[2],look:e.yaw},v,{dist:e.len,w:e.w})&&Math.abs(v.y-e.p[1])<4)status(v,'hinderUntil',e.hinder,sim);}break;
   case 'salvo':{/* wiki Guided Salvo: missile flies, 1.25 s windup, 3 pulses 0.8 s apart; inner 2.5 m full 65, outer 4.5 m falls 65 -> 50 at the edge; affects allies/self */
    if(T>=e.next&&e.left>0){e.next+=C.salvo.gap;e.left--;for(const v of sim.units.filter(x=>x.alive&&!x.loading)){const d=Math.hypot(v.x-e.p[0],v.z-e.p[2]);if(d>C.salvo.r)continue;const n=d<=C.salvo.inner?C.salvo.dmg:C.salvo.dmg-(C.salvo.dmg-C.salvo.dmgOut)*(d-C.salvo.inner)/(C.salvo.r-C.salvo.inner);dmg18.f(sim,own,v,n);}}break;}
   case 'frag':{const K=C.frag;if(T>=e.next&&e.left>0){e.next+=K.gap;e.left--;for(const v of sim.units.filter(x=>x.alive&&!x.loading)){const d=Math.hypot(v.x-e.p[0],v.z-e.p[2]);if(d>K.r)continue;const n=d<=K.inner?K.dmg:K.dmg-(K.dmg-K.dmgOut)*(d-K.inner)/(K.r-K.inner);dmg18.f(sim,own,v,n);}}break;}/* wiki FRAG/ment: 0.5 s windup, 4 ticks 1 s apart, inner 1 m 60, outer 4 m 25 at the edge, allies/self too (reduced) */
   case 'sdrone':if(!e.done&&T>=e.at){e.done=true;for(const v of enemies(sim,own))if(inR(v,e.p,e.radius)){status(v,'revealedUntil',C.sdrone.reveal,sim);status(v,'concussUntil',C.sdrone.supp,sim);}}break;
   case 'armag':{/* wiki Armageddon: 16 segments x 2 m (32 m), 12 m wide; segment i starts 0.25 s after segment i-1, each detonates 4x at 0.25 s for 60 */
    const AG=C.armag,fw=[-Math.sin(e.yaw),-Math.cos(e.yaw)];for(let i=0;i<AG.segs;i++)for(let j=0;j<AG.ticks;j++){const id=i*AG.ticks+j;if(e.fired[id]||T<e.at+i*AG.gap+j*AG.tick)continue;e.fired[id]=1;
     for(const v of sim.units.filter(x=>x.alive&&!x.loading)){/* wiki: affects allies and self (ally damage uses the shared ability rule in abilityDamage) */const q0=v.x-e.p[0],q1=v.z-e.p[2],f=q0*fw[0]+q1*fw[1];
      const sx=q0*-Math.cos(e.yaw)+q1*Math.sin(e.yaw);if(f>=i*AG.seg&&f<(i+1)*AG.seg&&Math.abs(sx)<AG.w/2)dmg18.f(sim,own,v,AG.dmg);}}break;}
   case 'gnet':if(!e.done&&T>=e.at){e.done=true;for(const v of enemies(sim,own))if(inR(v,e.p,e.radius)){const d=[e.p[0]-v.x,e.p[2]-v.z],l=Math.hypot(...d)||1;v.x+=d[0]/l*Math.min(l,3);v.z+=d[1]/l*Math.min(l,3);status(v,'tetheredUntil',e.until-T,sim);}}break;
   case 'sensor':if(!e.done&&T>e.until-C.sensor.life+1){const t=enemies(sim,own).find(v=>inR(v,e.p,e.armR));if(t){e.done=true;for(const v of enemies(sim,own))if(inR(v,e.p,e.armR))status(v,'concussUntil',C.sensor.concuss,sim);gone.push(e);}}break;
   case 'choke':{const t=enemies(sim,own).find(v=>inR(v,e.p,e.armR));if(t&&!e.done){e.done=true;for(const v of enemies(sim,own))if(inR(v,e.p,e.armR)){decay(sim,v,C.choke.decay);status(v,'hinderUntil',C.choke.slow,sim);}gone.push(e);}break;}
   case 'ceptor':for(const x of sim.effects)if(x.owner!==e.owner&&x.team!==e.team&&['flash','blast','seeker','decoy','mosh','gnet'].includes(x.kind)&&inR({x:x.p[0],y:x.p[1],z:x.p[2]},e.p,e.radius,6))gone.push(x);break;
   case 'vine':for(const v of enemies(sim,own))if(inR(v,e.p,e.radius)){dmg18.f(sim,own,v,C.vine.dps*dt);status(v,'hinderUntil',.5,sim);}break;
   case 'shear':if(!e.done){const t=enemies(sim,own).find(v=>inR(v,e.p,e.armR));if(t){e.done=true;fx(sim,own,'barrier',e.p,C.shear.wall,C.shear.r*2,{hp:1e9});gone.push(e);}}break;
   case 'garden':if(!e.done&&T>=e.at){e.done=true;for(const v of enemies(sim,own))if(inR(v,e.p,e.radius,8))status(v,'jamUntil',C.garden.jam,sim);}break;
   case 'decoy':{e.p=[e.p[0]+e.d[0]*e.speed*dt,e.p[1],e.p[2]+e.d[2]*e.speed*dt];if(e.until-T<dt){for(const v of enemies(sim,own))if(inR(v,e.p,20)&&los(sim,[v.x,v.y+1.5,v.z],e.p))status(v,'flashUntil',C.blindside.blind,sim);}break;}
   case 'seeker':{const t=sim.units.find(v=>v.id===e.target);if(!t||!t.alive){gone.push(e);break;}const d=[t.x-e.p[0],t.z-e.p[2]],l=Math.hypot(...d);if(l<.8||T>=e.at){if(e.prowler)status(t,'nearsightUntil',C.prowler.near,sim);else if(e.wing)status(t,'concussUntil',C.wing.concuss,sim);gone.push(e);}else e.p=[e.p[0]+d[0]/l*9*dt,e.p[1],e.p[2]+d[1]/l*9*dt];break;}/* d is [dx,dz]: the z delta is d[1] (was d[2]: undefined -> NaN z on the first move tick) */
   case 'mosh':{for(const v of sim.units)if(v.alive&&inR(v,e.p,e.radius))dmg18.f(sim,own,v,C.mosh.dps*dt);if(!e.done&&T>=e.boomAt){e.done=true;for(const v of enemies(sim,own))if(inR(v,e.p,e.radius))dmg18.f(sim,own,v,C.mosh.boom);}break;}
   case 'dizzy':if(!e.done&&T>=e.at){e.done=true;for(const v of enemies(sim,own))if(inR(v,e.p,e.radius))status(v,'nearsightUntil',C.dizzy.blind,sim);}break;
   case 'nullcmd':if(own){e.p=[own.x,own.y,own.z];}if(own&&T>=e.next){e.next+=C.nullcmd.pulse;for(const v of enemies(sim,own))if(inR(v,[own.x,own.y,own.z],e.radius,8))status(v,'suppressUntil',C.nullcmd.supp,sim);}break;
   case 'nightfall':if(!e.done&&T>=e.at){e.done=true;for(const v of enemies(sim,own))if(strip({x:e.p[0],z:e.p[2],look:e.yaw},v,{dist:C.nightfall.dist,w:C.nightfall.w})){decay(sim,v,C.nightfall.decay);status(v,'revealedUntil',C.nightfall.mark,sim);}gone.push(e);}break;
   case 'haunt':case 'seize':if(!e.done&&T>=e.at){e.done=true;for(const v of enemies(sim,own))if(inR(v,e.p,e.radius)){if(e.kind==='haunt')status(v,'revealedUntil',C.haunt.reveal,sim);else{decay(sim,v,C.seize.decay);status(v,'tetheredUntil',C.seize.tether,sim);}}if(e.kind!=='haunt')gone.push(e);/* Haunt stays in the snapshot (dn:1) until its mark time ends so clients get an explicit pop signal; reveal is a unit status, nothing else reads this effect */}break;
  }}
 if(gone.length){for(const e of gone)if(e.ag==='Gekko'){const u=sim.units.find(n=>n.id===e.owner),k=e.kind==='mosh'?'c':e.kind==='dizzy'?'e':e.wing?'q':0;if(u&&k)u.ability['re_'+k]=T+A18.globule.reclaim;}sim.effects=sim.effects.filter(e=>!gone.includes(e));}
 // unit statuses
 for(const u of sim.units){MeddleDecay.tick(u,T,u.alive&&!u.loading,u.mx||100);const A=u.ability;if(!A)continue;if(u.isoDuel){const f=sim.units.find(n=>n.id===u.isoDuel.foe);if(T>=u.isoDuel.until||!f||!f.alive||!f.isoDuel){const slot=u.isoDuel.slot;if(u.alive&&u.isoDuel.ret){[u.x,u.y,u.z]=u.isoDuel.ret;u.vy=0;}u.isoDuel=null;sim.effects=sim.effects.filter(e=>e.duelSlot!==slot);}}if(u.kayoDown){if(T>=u.kayoDown.until){u.kayoDown=null;u.deaths++;u.noUltDeaths=(u.noUltDeaths||0)+1;u.respawnAt=T+1.5;sim.events.push(['k','',u.name,0,'Ability']);}else{const r=sim.units.find(n=>n!==u&&n.team===u.team&&n.alive&&Math.hypot(n.x-u.x,n.z-u.z)<2&&(n.input||{}).use);if(r){u.kayoDown.prog+=dt;u.kayoDown.until+=dt;/* stabilizing pauses the countdown (wiki) */if(u.kayoDown.prog>=3.05){/* 1.5 s stabilize + 1.55 s reboot (wiki v10.06) */u.kayoDown=null;u.alive=true;u.hp=100;u.loading=false;}}else u.kayoDown.prog=0;}}if(u.anni){const dl=sim.units.find(n=>n.id===u.anni.by);const ae=sim.effects.find(e=>e.kind==='anni'&&e.owner===u.anni.by);if(ae)ae.p=[u.x,u.y,u.z];if(!dl||!dl.alive||!los(sim,[dl.x,dl.y+1,dl.z],[u.x,u.y+1,u.z])||Math.hypot(u.x-dl.x,u.z-dl.z)>C_annih.range+5){u.anni=null;if(ae)sim.effects=sim.effects.filter(e=>e!==ae);}/* the wire snaps */else{if(T>=u.anni.at){dmg18.f(sim,dl,u,999);u.anni=null;sim.effects=sim.effects.filter(e=>e!==ae);}else{const d=[dl.x-u.x,dl.z-u.z],l=Math.hypot(...d);if(l>1.2){u.x+=d[0]/l*2.5*dt;u.z+=d[1]/l*2.5*dt;}}}}if(!AG18[u.agent])continue;u.stimOn=(u.stimUntil||0)>T||!!u.gearOn||(u.overdriveUntil||0)>T||(u.hasteUntil||0)>T;if(u.agent==='Clove'){if(u.alive)u.ndyDead=0;else if(!u.ndyDead&&!u.ndy)u.ndyDead=T;}
  if(u.decayUntil&&T>u.decayUntil&&u.decayAmt>0){const r=Math.min(u.decayAmt,40*dt);u.decayAmt-=r;u.hp=Math.min(u.mx,u.hp+r);}
  if(u.pendingTeleport&&u.pendingTeleport.kind!=='xcut'&&T>=u.pendingTeleport.at){[u.x,u.y,u.z]=u.pendingTeleport.p;u.pendingTeleport=null;u.vy=0;}
  if(u.ndy&&T>=u.ndy.at){u.ndy=null;u.alive=true;u.hp=100;u.loading=false;}
  if(u.hushFlow&&T>=u.hushFlow.at){u.hushFlow=null;u.vy=A18.flow.speed*.5;u.levUntil=T+.6;}
  if(u.gearOn){A.fuel=Math.max(0,A.fuel-A18.gear.drain*dt);if(A.fuel<=0)u.gearOn=false;else u.hasteUntil=Math.max(u.hasteUntil||0,T+.3);}
  else if(u.agent==='Neon'&&A.fuel<A18.fuel.max)A.fuel=Math.min(A18.fuel.max,A.fuel+A18.gear.regen*dt);
  if(u.agent==='Viper'&&!A.cloudOn&&!A.toxOn&&A.fuel<A18.fuel.max)A.fuel=Math.min(A18.fuel.max,A.fuel+A18.fuel.regen*dt);
  
  if(u.agent==='Gekko')for(const k of ['c','q','e'])if(A['re_'+k]&&T>=A['re_'+k]){A[k]=Math.min(1,A[k]+1);A['re_'+k]=0;}
  if(u.evoUntil&&T<u.evoUntil)u.hp=Math.min(u.mx,u.hp+A18.evo.hps*dt);
 }}
// Iso Kill Contract pocket duel (wiki Kill_Contract): both combatants are pulled into the analytic pocket arena
// (arena.js - a flat walled cell far outside the match map), returned when it ends; while it runs only they can
// damage each other (applyHit / abilityDamage). Simultaneous duels stack a cell every ARENA_STRIDE on x.
export function duel18(sim,iso,t,C){
 const ret=[iso.x,iso.y,iso.z],retT=[t.x,t.y,t.z];
 const used=new Set();for(const u of sim.units)if(u.isoDuel)used.add(u.isoDuel.slot);
 let slot=0;while(used.has(slot))slot++;
 const ox=ARENA_X+slot*ARENA_STRIDE;
 iso.isoDuel={foe:t.id,until:sim.time+C.kc.duel,ret,slot};t.isoDuel={foe:iso.id,until:sim.time+C.kc.duel,ret:retT,slot};
 status(t,'suppressUntil',C.kc.supp,sim);status(t,'revealedUntil',C.kc.duel,sim);
 [t.x,t.y,t.z]=[ox+4,.1,0];[iso.x,iso.y,iso.z]=[ox-4,.1,0];t.vx=t.vz=t.vy=iso.vx=iso.vz=iso.vy=0;
 fx(sim,iso,'duel',[ox,0,0],C.kc.duel,ARENA_HALF,{duelSlot:slot});/* clients render the arena shell at the cell origin */
 sim.castEvents.push({t:'ac',i:iso.id,ag:'Iso',k:'x',o:[iso.x,iso.y+1,iso.z],d:[1,0,0],p:[ox,0,0],ts:Math.round(sim.time*1000)});}
// KAY/O NULL/cmd: lethal damage downs instead (850 pool bleeds over 15 s; an ally's USE channel revives at 100).
export function downed18(sim,v){if(v.agent!=='KAY/O'||!(v.nullCmdUntil>sim.time)||v.kayoDown)return false;v.kayoDown={until:sim.time+15,prog:0,hp:850};/* wiki NULL/cmd: 15 s bleedout, 850 HP core enemies can destroy */v.alive=false;v.hp=0;return true;}
const C_annih=A18.annih;
// Gekko globule expiry hook: call from effects sweep when an owned basic ends.
export function globuleDrop(u,k){u.ability['re_'+k]=0;/* auto-return after reclaim window handled via effect expiry in simulation sweep */}
