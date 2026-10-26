// Server side of the Valorant ability flow (work/ability_equip_runtime.js): kit charges / costs / ult points / signature
// recharge match the wiki table (work/validation/abilities-wiki.json), and an equip-then-fire cast keeps the gun down
// for the ability's unequip + the weapon's re-equip time on the server too (recoverTime: fire() refuses until u.fireAt),
// while a quick-cast (Jett Cloudburst) does not.
import assert from 'node:assert/strict';import fs from 'node:fs';import {SpikeSimulation} from './src/spike.js';import {ABILITY_EQUIP,abilityRecover} from './src/abilities.js';import {UNEQUIP,REEQUIP,REEQ_INSTANT,recoverTime} from './src/windups.js';import {DEV} from './src/devices.js';import {WINDUP,XAB_REL,wf} from './src/windups.js';import {ULT} from './src/ults.js';
const kits=JSON.parse(fs.readFileSync(new URL('./src/kits.json',import.meta.url),'utf8')),wiki=JSON.parse(fs.readFileSync(new URL('../work/validation/abilities-wiki.json',import.meta.url),'utf8'));
for(const [a,w] of Object.entries(wiki)){if(a[0]==='_')continue;const k=kits[a];assert(k,a+' kit');assert.equal(k.u,w.u,a+' ult points');
 for(const s of ['c','q']){assert.equal(k.mx[s],w[s][0],a+' '+s+' charges');assert.equal(k.buy.find(r=>r[0]===s)[2],w[s][1],a+' '+s+' cost');}
 if(w.e&&w.e[1]){assert.equal(k.mx.e,w.e[0],a+' e charges');assert.equal(k.buy.find(r=>r[0]==='e')[2],w.e[1],a+' e cost');}}
const src=fs.readFileSync(new URL('./src/abilities.js',import.meta.url),'utf8'),sec=Object.fromEntries([...src.match(/const seconds=\{([^}]*)\}/)[1].matchAll(/(\w+):(\d+)/g)].map(m=>[m[1],+m[2]]));
for(const [a,w] of Object.entries(wiki))if(typeof w.eRecharge==='number'&&a!=='Omen')assert.equal(sec[a],w.eRecharge,a+' signature recharge');
const W={map:{attacker:[0,0,0],defender:[0,0,-10],sites:{A:[0,0,0]}},nav:{nodes:[[0,0,0],[0,0,-10]],adj:[[1],[0]]},playable:[0,1],allowed:new Set([0,1]),near:(x,z)=>z<-5?1:0,ground:()=>0,blocked:()=>false,ray:()=>Infinity};
const s=new SpikeSimulation(W),ph=s.add('p','Phoenix'),j=s.add('j','Jett');s.start(false);s.buy=0;s.time=3;
ph.ability.c=1;ph.fireAt=0;assert.equal(s.command(ph,{t:'ab',k:'c'}),true,'Blaze cast');assert.equal(ph.ability.c,0);assert(ABILITY_EQUIP.Phoenix.includes('c'));
const XAB_REC=recoverTime('Phoenix','c',ph.weapon);assert.equal(XAB_REC,ph.weapon==='Classic'?.95:XAB_REC,'Blaze: 0.5 s unequip + Classic fast 0.45 s');
assert(Math.abs(ph.fireAt-(s.time+XAB_REC))<1e-9,'equip cast holds the gun down on the server for unequip + re-equip');assert.equal(s.fire(ph),false,'no gun fire mid-cast');
s.time+=XAB_REC-.02;ph.triggerHeld=false;assert.equal(s.fire(ph),false,'still re-equipping 20 ms before');s.time+=.03;ph.triggerHeld=false;assert.notEqual(s.fire(ph),false,'gun back after the recovery');
// qa-34: per-ability unequip (wiki) + per-weapon fast / instant re-equip (wiki weapon pages), Empress +10 % equip speed
for(const [a,ks] of Object.entries(ABILITY_EQUIP))for(const k of ks)assert(Number.isFinite(UNEQUIP[a]&&UNEQUIP[a][k]),a+' '+k+' has a wiki unequip time');
assert.equal(recoverTime('Phoenix','q','Vandal'),1.3,'Hot Hands + Vandal: 0.7 + 0.6');assert.equal(recoverTime('Phoenix','e','Vandal'),.68,'Curveball instant re-equip: 0.48 + 0.2');assert.equal(recoverTime('Raze','c','Operator'),.9,'Boom Bot 0 s + Operator fast 0.9');
assert.equal(recoverTime('Killjoy','x','Knife'),.45,'Lockdown 0.15 + knife fast 0.3');assert.equal(recoverTime('Reyna','c','Phantom'),.7,'Leer instant: 0.5 + 0.2');assert.equal(recoverTime('Sage','q','Vandal',1.1),Math.round((.4+.6/1.1)*1e6)/1e6,'stim');
{const u={agent:'Breach',weapon:'Odin',empress:false};assert.equal(abilityRecover(u)('x'),1.15,'Rolling Thunder + Odin 0.4 + 0.75');}
for(const w of Object.keys(REEQUIP))if(w!=='Knife')assert(REEQUIP[w][1]<REEQUIP[w][0],w+' instant < fast');
j.ability.c=1;j.fireAt=0;assert.equal(s.command(j,{t:'ab',k:'c'}),true,'Cloudburst cast');assert(!(j.fireAt>s.time),'quick-cast keeps the gun up');
// effect values checked against the wiki (work/validation/abilities-wiki.txt): Cloudburst 2.5 s, Hot Hands 60 dps, Nanoswarm 5 s
{const {tickAbilities}=await import('./src/abilities.js'),cb=s.effects.filter(e=>e.kind==='cloudburst').pop();assert(cb,'Cloudburst projectile');let n=0;while(cb.kind==='cloudburst'&&n++<200){s.time+=.05;tickAbilities(s,.05);}
 const e=cb;assert.equal(e.kind,'smoke','Cloudburst landed as a smoke');assert(e.cb);assert(Math.abs(e.until-s.time-2.5)<1e-6,'Cloudburst lasts 2.5 s (got '+(e.until-s.time)+')');assert.equal(e.radius,3.35,'Cloudburst radius 3.35 m (wiki)');}
{/* Cloudburst flight (vendor/cloudburst.cjs; wiki: thrown INSTANTLY, HOLD steers it with the crosshair, release = gravity, smoke on contact or after 2 s in the air) */
 const CBm=(await import('../vendor/cloudburst.cjs')).default,{tickAbilities}=await import('./src/abilities.js');assert.deepEqual([CBm.CB.maxT,CBm.CB.life],[2,2.5]);
 const fly=(world,setup,each)=>{const t=new SpikeSimulation({...W,...world}),u=t.add('jt','Jett');t.add('foe');t.start(false);t.buy=0;Object.assign(u,{x:0,y:0,z:0,look:0,pitch:0});u.ability.c=2;setup&&setup(t,u);assert.equal(t.command(u,{t:'ab',k:'c'}),true);const e=t.effects.find(x=>x.kind==='cloudburst');assert(e,'projectile');assert.equal(t.castEvents.filter(c=>c.k==='c').length,0,'no cast event at the throw');
  const rows=[];let k=0;while(e.kind==='cloudburst'&&k++<200){each&&each(t,u,k);t.time+=.05;tickAbilities(t,.05);rows.push(t.snapshot().fx.filter(f=>f.kind==='cb'));}return {e,t,u,rows,k};};
 // tap (no cb input): a thrown arc that falls to the floor ~10 m ahead, then a 2.5 s smoke there
 const a=fly({});assert.equal(a.e.kind,'smoke');assert(a.e.c[2]<-6&&a.e.c[2]>-14,'tap lands ~10 m ahead: '+a.e.c);assert(Math.abs(a.e.c[1]-1.5)<1e-9,'smoke centre floor + 1.5');assert(a.rows[0][0].s===0&&a.rows.at(-1)[0].s===1&&a.rows.at(-1)[0].tl>2.4,'snapshot fx: projectile then smoke '+JSON.stringify(a.rows.at(-1)));
 // C held: steered by the aim (turned 90 degrees left, level) for the whole 2 s -> pops in the air off to the side, never falls
 const b=fly({},(t,u)=>{t.command(u,{t:'in',seq:1,r:0,p:0,cb:1});},(t,u,k)=>{t.command(u,{t:'in',seq:k+1,r:k>4?Math.PI/2:0,p:0,cb:1});});assert(b.k>=39&&b.k<=41,'held: 2 s in the air ('+b.k+' steps)');assert(b.e.c[0]<-15,'steered left: '+b.e.c);assert(b.e.c[1]>1.4,'did not fall');
 // held then released: steering ends for good (re-pressing does nothing), it falls
 const c=fly({},(t,u)=>{t.command(u,{t:'in',seq:1,r:0,p:0,cb:1});},(t,u,k)=>{t.command(u,{t:'in',seq:k+1,r:k>6?Math.PI/2:0,p:0,cb:k<4||k>8?1:0});});assert(Math.abs(c.e.c[0])<1,'released before the turn: no steering after ('+c.e.c+')');assert(c.k<20,'falls after release');
 // a wall 5 m ahead: smoke at the wall
 const d=fly({ray:(o,dd,max)=>{const t=(o[2]+5)/-dd[2];return dd[2]<0&&t>=0&&t<=max?t:Infinity;}});assert(d.e.c[2]>-5&&d.e.c[2]<-4.5,'smoke at the wall: '+d.e.c);
 // the steering input is only C (cb 1); stale input does not steer
 {const t=new SpikeSimulation(W),u=t.add('jt','Jett');t.add('f');t.start(false);t.buy=0;t.command(u,{t:'in',seq:1,r:0,p:0,cb:'1'});assert.equal(u.input.cb,false);t.command(u,{t:'in',seq:2,r:0,p:0,cb:1});assert.equal(u.input.cb,true);}}
assert.equal(DEV.hotHands.damage,60,'Hot Hands 60/s');assert.equal(DEV.nanoswarm.active,5,'Nanoswarm active 5 s');
{const ph2=s.add('p2','Phoenix');ph2.alive=true;ph2.ability.q=1;ph2.fireAt=0;s.time+=1;assert.equal(s.command(ph2,{t:'ab',k:'q'}),true,'Hot Hands cast');const f=s.effects.filter(e=>e.kind==='fire').pop();assert(f&&f.rate===60,'Hot Hands zone burns 60/s');}
{/* Hot Hands spreads (wiki Hot_Hands: 0.75 s to 4.5 m, 4 s total): radius 0 at detonation, 2.25 m at 0.375 s, 4.5 m from 0.75 s; a foe 4 m out burns only once the fire reaches him */
 assert.deepEqual([DEV.hotHands.radius,DEV.hotHands.grow,DEV.hotHands.life],[4.5,.75,4]);const {tickAbilities}=await import('./src/abilities.js');
 const t=new SpikeSimulation(W),ph=t.add('ph','Phoenix'),foe=t.add('foe');t.start(false);t.buy=0;Object.assign(ph,{x:0,y:0,z:0,look:0,pitch:-1.2});ph.ability.q=1;assert.equal(t.command(ph,{t:'ab',k:'q'}),true);const f=t.effects.find(e=>e.kind==='fire');assert(f,'zone');
 Object.assign(foe,{x:f.p[0]+4,y:f.p[1],z:f.p[2],hp:100,armor:0});tickAbilities(t,0);assert.equal(f.radius,0,'nothing at detonation');t.time+=.375;tickAbilities(t,0);assert(Math.abs(f.radius-2.25)<1e-9,'half spread '+f.radius);assert.equal(foe.hp,100,'4 m out: not reached yet');
 t.time+=.375;tickAbilities(t,.1);assert.equal(f.radius,4.5,'full size');assert(foe.hp<100,'4 m out burns once reached');const h=foe.hp;t.time=f.until+.01;tickAbilities(t,.1);assert.equal(foe.hp,h,'gone after 4 s');}
// per-ability windups (wiki): FIRE -> effect = the client's 0.2 s hand release + the server fuse; arm / equip times from the cast
assert.deepEqual(WINDUP,{aftershock:2.2,flashpoint:.5,faultLine:1.1,rollingThunder:1.2,curveball:.6,leer:.4,lockdown:13,trapwire:.7,trademark:2,blastPack:1.5,showstopper:1.4,tourDeForce:2.3});assert.equal(XAB_REL,.2);
{const br=s.add('br','Breach');br.alive=true;Object.assign(br.ability,{c:1,q:1,e:1});br.cool={};s.time+=1;
 assert.equal(s.command(br,{t:'ab',k:'c'}),true,'Aftershock');const a=s.effects.filter(e=>e.kind==='blast').pop();assert(Math.abs(a.at-s.time-wf('aftershock'))<1e-9&&a.until>a.at,'Aftershock fuse 2.2 - 0.2 s');
 s.time+=1;assert.equal(s.command(br,{t:'ab',k:'q'}),true,'Flashpoint');const f=s.effects.filter(e=>e.kind==='flash').pop();assert(Math.abs(f.at-s.time-.3)<1e-9&&f.until>f.at,'Flashpoint fuse 0.5 - 0.2 s');
 s.time+=1;assert.equal(s.command(br,{t:'ab',k:'e'}),true,'Fault Line');assert(Math.abs(br.fault.at-s.time-.9)<1e-9,'Fault Line 1.1 - 0.2 s');}
assert(Math.abs(DEV.curveball.windup-.4)<1e-9&&Math.abs(ULT.quake.delay-1)<1e-9&&ULT.lockdown.windup===13&&DEV.trapwire.windup===.7&&DEV.trapwire.deploy===1.5&&DEV.trademark.armDeploy===2,'Curveball / Rolling Thunder / Lockdown / Trapwire / Trademark windups');
{const ry=s.add('ry','Reyna');ry.alive=true;ry.ability.c=1;s.time+=1;assert.equal(s.command(ry,{t:'ab',k:'c'}),true,'Leer');const l=s.effects.filter(e=>e.kind==='leer').pop();assert(Math.abs(l.at-s.time-.2)<1e-9,'Leer 0.4 - 0.2 s');}
{const ch=s.add('ch','Chamber');ch.alive=true;ch.ability.ult=8;ch.fireAt=0;s.time+=1;assert.equal(s.command(ch,{t:'ab',k:'x'}),true,'Tour De Force');assert.equal(ch.weapon,'Operator');assert(Math.abs(ch.fireAt-s.time-2.3)<1e-9,'Tour De Force 2.3 s equip');assert.equal(s.fire(ch),false,'no shot during the equip');s.time+=2.31;ch.triggerHeld=false;assert.notEqual(s.fire(ch),false,'fires once up');}
// Sova bolts (vendor/sova-bolt.cjs): HOLD FIRE charge m.pw 0..1 sets the speed, ALT FIRE bounces m.b 0..2 reflect off the map
{const SB=(await import('../vendor/sova-bolt.cjs')).default;let wallZ=-10;
 const W2={...W,rayN:(o,d,max)=>{if(!(d[2]<0))return null;const t=(o[2]-wallZ)/-d[2];return t>=0&&t<=max?{distance:t,normal:[0,0,1]}:null;},ray:(o,d,max=Infinity)=>{if(!(d[2]<0))return Infinity;const t=(o[2]-wallZ)/-d[2];return t>=0&&t<=max?t:Infinity;}};
 const s2=new SpikeSimulation(W2),sv=s2.add('sv','Sova');s2.start(false);s2.buy=0;s2.time=3;Object.assign(sv,{x:0,y:0,z:0,look:0,pitch:0});
 const shot=(k,m)=>{sv.ability.q=2;sv.ability.e=1;sv.ability.cool={};sv.ability.rechargeAt=0;s2.time+=1;s2.castEvents.length=0;assert.equal(s2.command(sv,{t:'ab',k,...m}),true,'bolt cast');return s2.castEvents.pop();};
 wallZ=-1e9;const tap=shot('q',{pw:0}),full=shot('q',{pw:1});assert(Math.hypot(tap.p[0],tap.p[2])<Math.hypot(full.p[0],full.p[2])-5,'a held bolt flies further than a tap ('+tap.p+' vs '+full.p+')');
 assert.equal(tap.pw,0);assert.equal(full.b,0);const bl=s2.effects.filter(e=>e.kind==='blast').pop();assert(bl.at>s2.time&&Math.abs(bl.p[2]-full.p[2])<1e-9,'Shock Bolt detonates where and when the bolt lands');
 wallZ=-10;const b0=shot('q',{pw:1,b:0}),b1=shot('q',{pw:1,b:1});assert(Math.abs(b0.p[2]+9.97)<.05,'no bounce: stops on the wall');assert(b1.p[2]>-9.9&&b1.b===1,'one bounce: comes back off the wall ('+b1.p+')');
 const r=shot('e',{pw:1,b:2});assert.equal(r.b,2);const rc=s2.effects.filter(e=>e.kind==='recon').pop();assert(Math.abs(rc.p[2]-r.p[2])<1e-9&&rc.pulses[0]>s2.time+.9,'Recon Bolt pulses after its flight');
 const cl=shot('q',{pw:7,b:9});assert(cl.pw===1&&cl.b===2,'charge / bounces clamped');const bad=shot('q',{pw:'x',b:'2; drop'});assert(bad.pw===1&&bad.b===0,'junk -> full charge, no bounce');
 const leg=shot('q',{});assert(leg.pw===1&&leg.b===0,'an older client: full-charge, no-bounce bolt');
 const P=SB.path([0,1.6,0],[0,0,-1],1,2,W2.rayN,()=>0);assert.equal(P.pts.length,4,'two bounces recorded');}
console.log('Ability equip (server): kit table matches the wiki, equip casts hold fire for the ability unequip + weapon re-equip (Blaze + Classic '+recoverTime('Phoenix','c','Classic')+' s), quick-casts do not; Cloudburst projectile (tap arc / steered while C held / smoke on contact or after 2 s, 2.5 s), Hot Hands 60/s spreading to 4.5 m over 0.75 s, Nanoswarm 5 s; wiki windups (Aftershock / Flashpoint / Fault Line / Leer / Curveball / Rolling Thunder / Trapwire / Trademark / Tour De Force); Sova bolt charge + 0-2 bounces');
