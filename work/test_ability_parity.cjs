// Side-by-side ability values: the server (server/src/abilities.js PARITY / aoeFall) and the offline game (index.html XPAR2 /
// xAoeFall, read from the real page) carry the same wiki numbers (wiki.playvalorant.com/en-us/<Ability>, Stats; Healing Orb self
// heal 50 -> 100 in patch 13.00). Then the offline game is checked doing them: Shock Bolt falloff on enemies (75 inside 1.5 m,
// falling to 1 at the 4 m edge, nothing beyond), Aftershock 2 bursts of 80 0.6 s apart in 3 m, Healing Orb self cast 100 HP over
// 5 s, Shrouded Step 1.2 s, Rendezvous 18 m, Tailwind 11 m.
const assert=require('assert/strict'),path=require('path');const {boot}=require('./page_harness.cjs');
(async()=>{
 const S=await import(path.join(__dirname,'..','server','src','abilities.js'));const P=S.PARITY;
 // wiki truth (each value checked against the saved wiki pages, qa/qa20/wiki + Shock_Bolt / Aftershock / Healing_Orb Stats)
 assert.deepEqual(P.shock,{inner:1.5,outer:4,max:75,min:1});assert.deepEqual(P.aftershock,{damage:80,ticks:2,gap:.6,radius:3});
 assert.deepEqual(P.heal,{sage:100,life:5});assert.equal(P.dismiss,1.5);assert.deepEqual(P.step,{range:15,time:1.2});assert.equal(P.shadows,4);assert.equal(P.rendezvous,18);assert.equal(P.tail,11);
 const H=boot({real3:true,seed:3}),xe=H.xe,J=c=>JSON.parse(xe('JSON.stringify('+c+')'));
 const C=J('XPAR2');
 assert.deepEqual(C.shock,P.shock,'Shock Bolt server = offline');
 assert.deepEqual([C.ash.dmg,C.ash.n,C.ash.gap,C.ash.r],[P.aftershock.damage,P.aftershock.ticks,P.aftershock.gap,P.aftershock.radius],'Aftershock server = offline');
 assert.equal(C.heal,P.heal.sage,'Healing Orb');assert.equal(C.step,P.step.time,'Shrouded Step');assert.equal(C.shadows,P.shadows,'From the Shadows');
 assert.equal(C.rdv,P.rendezvous,'Rendezvous');assert.equal(C.tail,P.tail,'Tailwind');assert.equal(C.ld,32.5,'Lockdown 32.5 m (wiki)');const CP=J('XPS');for(const k of Object.keys(S.PAINT))assert.equal(CP[k],S.PAINT[k],'Paint Shells '+k+' server = offline');assert.equal(C.regrow,20,'Regrowth 20 HP/s (wiki)');
 // the same falloff curve on both sides
 for(let d=0;d<=5;d+=.125){const a=S.aoeFall(d,P.shock),b=xe('xAoeFall('+d+',XPAR2.shock)');assert.ok(Math.abs(a-b)<1e-9,'falloff at '+d+' m: server '+a+' offline '+b);}
 assert.equal(S.aoeFall(1.5,P.shock),75);assert.ok(Math.abs(S.aoeFall(3.999999,P.shock)-1)<1e-4);assert.equal(S.aoeFall(4,P.shock),0);assert.equal(S.aoeFall(2.75,P.shock),38);
 // server Shock Bolt blast at 1 m / 2.75 m / 5 m (the server sim, flat test world)
 {const {SpikeSimulation}=await import(path.join(__dirname,'..','server','src','spike.js'));
  const W={map:{attacker:[0,0,0],defender:[0,0,-10],sites:{A:[0,0,0]}},nav:{nodes:[[0,0,0],[0,0,-10]],adj:[[1],[0]]},playable:[0,1],allowed:new Set([0,1]),near:(x,z)=>z<-5?1:0,ground:()=>0,blocked:()=>false,ray:()=>Infinity};
  const s=new SpikeSimulation(W),o=s.add('sova','Sova'),v=[1,2.75,5].map((d,i)=>s.add('v'+i));s.start(false);s.buy=0;
  v.forEach((u,i)=>{Object.assign(u,{x:[1,2.75,5][i],y:0,z:0,hp:100,armor:0,team:o.team==='A'?'B':'A'});});o.x=50;
  s.effects.push({id:99,kind:'blast',owner:o.id,team:o.team,p:[0,1,0],until:s.time+1,radius:P.shock.outer,damage:P.shock.max,fall:P.shock,at:s.time});
  S.tickAbilities(s,0);assert.deepEqual(v.map(u=>Math.round(u.hp)),[25,62,100],'server Shock Bolt 75 / 38 / 0');
  // server Aftershock (Breach C): 2.2 s windup, then 80, 0.6 s later 80 again, inside 3 m only
  const b=new SpikeSimulation(W),br=b.add('br','Breach'),in1=b.add('in'),out=b.add('out');b.start(false);b.buy=0;Object.assign(br,{x:0,y:0,z:0,look:0,pitch:0});br.ability.c=1;
  assert.equal(b.command(br,{t:'ab',k:'c'}),true);const e=b.effects.find(e=>e.kind==='blast');assert.equal(e.radius,3);assert.equal(e.damage,80);
  Object.assign(in1,{x:e.p[0]+2.5,y:e.p[1],z:e.p[2],hp:100,armor:0,team:'X'});Object.assign(out,{x:e.p[0]+3.5,y:e.p[1],z:e.p[2],hp:100,armor:0,team:'X'});const t0=e.at;
  b.time=t0-.01;S.tickAbilities(b,0);assert.equal(in1.hp,100);b.time=t0;S.tickAbilities(b,0);assert.equal(in1.hp,20);b.time=t0+.59;S.tickAbilities(b,0);assert.equal(in1.hp,20);
  b.time=t0+.6;S.tickAbilities(b,0);assert.equal(in1.alive,false,'second burst');assert.equal(out.hp,100,'3 m radius');b.time=t0+2;S.tickAbilities(b,0);assert.equal(b.effects.filter(e=>e.kind==='blast').length,0,'two bursts only');
  // server Healing Orb self cast: 100 over 5 s; Dismiss 1.5 s
  const h=new SpikeSimulation(W),sg=h.add('sg','Sage');h.add('foe');h.start(false);h.buy=0;sg.hp=1;sg.ability.e=1;assert.equal(h.command(sg,{t:'ab',k:'e'}),true);for(let i=0;i<50;i++){h.time+=.1;S.tickAbilities(h,.1);}assert.ok(Math.abs(sg.hp-100)<1e-6,'Sage self heal 100 over 5 s: '+sg.hp);
  // server Paint Shells (Raze E): main burst 2.25 s after the throw (55 -> 1 over 2.5-5.5 m), 4 sub-munitions 0.667 s later 2.5 m out (5.25 m edge)
  {const z=new SpikeSimulation(W),rz=z.add('rz','Raze'),v1=z.add('v1');z.start(false);z.buy=0;Object.assign(rz,{x:0,y:0,z:0,look:0,pitch:0});rz.ability.e=1;assert.equal(z.command(rz,{t:'ab',k:'e'}),true);
   const bl=z.effects.filter(e=>e.kind==='blast');assert.equal(bl.length,5,'main + 4 sub-munitions');const m=bl[0],c=m.p;assert.ok(Math.abs(m.at-z.time-2.25)<1e-9);assert.equal(m.radius,5.5);assert.deepEqual(m.fall,{inner:2.5,outer:5.5,max:55,min:1});
   bl.slice(1).forEach(e=>{assert.ok(Math.abs(e.at-z.time-2.917)<1e-9);assert.equal(e.radius,5.25);assert.ok(Math.abs(Math.hypot(e.p[0]-c[0],e.p[2]-c[2])-2.5)<1e-9,'2.5 m out');});
   assert.deepEqual(S.paintSubs([0,0,0]).map(q=>q.map(n=>Math.round(n*100)/100)),[[1.77,0,1.77],[-1.77,0,1.77],[-1.77,0,-1.77],[1.77,0,-1.77]]);
   Object.assign(v1,{x:c[0]+4,y:0,z:c[2],hp:500,armor:0,team:'X'});const t0=m.at;z.time=t0-.01;S.tickAbilities(z,0);assert.equal(v1.hp,500,'nothing before the 2.25 s fuse');
   z.time=t0;S.tickAbilities(z,0);const d=Math.hypot(4,1-c[1]);assert.ok(Math.abs(500-v1.hp-S.aoeFall(d,m.fall))<1e-6,'main burst by distance');const h1=v1.hp;
   z.time=t0+.667;S.tickAbilities(z,0);const exp=bl.slice(1).reduce((n,e)=>{const q=Math.hypot(v1.x-e.p[0],1-e.p[1],v1.z-e.p[2]);return n+(q<e.radius?S.aoeFall(q,e.fall):0);},0);assert.ok(exp>0&&Math.abs(h1-v1.hp-exp)<1e-6,'sub-munitions by distance');
   assert.equal(S.PAINT.max,55);}
  const r=new SpikeSimulation(W),ry=r.add('ry','Reyna');r.add('foe');r.start(false);r.buy=0;ry.ability.q=1;r.effects.push({id:1,kind:'soul',owner:ry.id,p:[ry.x,ry.y+1.2,ry.z],until:3});assert.equal(r.command(ry,{t:'ab',k:'e'}),true);assert.ok(Math.abs(ry.invulnerableUntil-r.time-1.5)<1e-9,'Dismiss 1.5 s');}
 // offline: a live 5v5 to get the page's units
 const adv=async ms=>{for(let t=0;t<ms;t+=50){H.advance(Math.min(50,ms-t));await new Promise(r=>setImmediate(r));}};
 H.$('pm5v5').click();await adv(50);
 for(let t=0;t<30000&&!(xe('running')&&!xe('!!window.xLdOn')&&!H.shown('pre')&&!H.shown('xAg'));t+=100){
  if(H.shown('pre'))H.$('preGo').click();else if(H.shown('xAg')){const tiles=H.doc.querySelectorAll('#xAg .x-ag').filter(b=>!b.disabled);if(tiles.length)tiles[0].click();await adv(20);H.$('xAgL').click();}await adv(100);}
 assert.ok(xe('running'),'5v5 did not start');
 // offline Shock Bolt (the player's bolt landing): enemies at 1 / 2.75 / 5 m from the impact take 75 / 38 / nothing
 const hp=J(`(()=>{FV.buy=0;const P=player,b=bots.filter(b=>b.alive).slice(0,3);b.forEach((u,i)=>{u.hp=100;u.armor=0;u.g.position.set(P.x+[1,2.75,5][i],u.g.position.y,P.z);});
   J.arrows.push({m:new THREE.Object3D(),a:new THREE.Vector3(P.x,1,P.z),b:new THREE.Vector3(P.x,1,P.z),t:1,dur:.05,kind:"shock"});jFxTick(.016);return b.map(u=>Math.round(u.hp));})()`);
 assert.deepEqual(hp,[25,62,100],'offline Shock Bolt 75 inside 1.5 m, 38 at 2.75 m, none past 4 m');
 // offline Aftershock: two bursts of 80, 0.6 s apart, 3 m
 const as=J(`(()=>{const P=player,b=bots.filter(b=>b.alive).slice(0,2);b.forEach((u,i)=>{u.hp=500;u.armor=0;u.g.position.set(P.x+[2.5,3.5][i],u.g.position.y,P.z);});
   const m=new THREE.Object3D();scene.add(m);BC.as.push({p:{x:P.x,z:P.z},m,t:.01,n:XPAR2.ash.n});const r=[];bcTick(.02);r.push(b.map(u=>u.hp));bcTick(.5);r.push(b.map(u=>u.hp));bcTick(.11);r.push(b.map(u=>u.hp));bcTick(1);r.push(b.map(u=>u.hp),BC.as.length);return r;})()`);
 assert.deepEqual(as,[[420,500],[420,500],[340,500],[340,500],0],'offline Aftershock 2 x 80, 0.6 s apart, 3 m');
 // offline Paint Shells: the player's grenade bursts at its fuse with falloff (enemy at 1 m: 55, at 4 m: by distance), the 4 sub-munitions 0.667 s later
 const ps=J(`(()=>{const P=player,b=bots.filter(b=>b.alive).slice(0,2);b.forEach((u,i)=>{u.hp=500;u.armor=0;u.g.position.set(P.x+20+[1,4][i],u.g.position.y,P.z);});
   const c=new RV(P.x+20,0.15,P.z);RS.pj.push({m:rsMesh(0xffb21f,1.3,c),v:new RV(0,0,0),t:XPS.fuse-0.001,fuse:XPS.fuse,kind:"nade"});rsTick(0.002);const r=[b.map(u=>u.hp),RS.pj.filter(o=>o.kind==="sub").length];
   for(let i=0;i<14;i++)rsTick(0.05);r.push(b.map(u=>u.hp),RS.pj.length);return r;})()`);
 assert.equal(ps[1],4,'4 sub-munitions');assert.ok(Math.abs(ps[0][0]-445)<1e-6,'55 at 1 m: '+ps[0][0]);assert.ok(ps[0][1]<500-20&&ps[0][1]>500-40,'falloff at 4 m: '+ps[0][1]);
 assert.ok(ps[2][0]<ps[0][0]-100&&ps[2][1]<ps[0][1]-20,'sub-munitions hit by distance: '+ps[2]);assert.equal(ps[3],0,'all burst');
 const bq=J('(()=>{const A={};xRzShells(A,0,0);return A.pq.map(q=>[q.t,q.r,Math.round(Math.hypot(q.p.x,q.p.z)*100)/100,typeof q.f]);})()');
 assert.deepEqual(bq,[[2.25,5.5,0,'function'],[2.917,5.25,2.5,'function'],[2.917,5.25,2.5,'function'],[2.917,5.25,2.5,'function'],[2.917,5.25,2.5,'function']].map(r=>r),'bot Paint Shells: same fuse / radii / spots');
 // offline Blast Pack: stuck pack armed (1.5 s) detonates on its own at 5 s: enemy at 1 m 50, at 3.5 m 35 (50 -> 20 over 2-5 m), 6 m untouched
 const bp=J(`(()=>{const P=player,b=bots.filter(b=>b.alive).slice(0,3);const c=new RV(P.x+20,0.5,P.z);b.forEach((u,i)=>{u.hp=500;u.armor=0;u.g.position.set(c.x+[1,3.5,6][i],u.g.position.y,c.z);});
   RS.pk.push({m:rsMesh(0xffb21f,1.2,c),v:new RV(0,0,0),t:4.95,kind:"pack",stuck:true});rsTick(0.02);const r=[b.map(u=>Math.round(u.hp*10)/10),RS.pk.length];rsTick(0.05);r.push(b.map(u=>Math.round(u.hp*10)/10),RS.pk.length);return r;})()`);
 assert.deepEqual(bp[0],[500,500,500],'not before 5 s');assert.equal(bp[1],1);assert.equal(bp[3],0,'went off at 5 s');assert.equal(bp[2][0],450,'50 inside 2 m');assert.ok(Math.abs(bp[2][1]-(500-Math.round(xe('xBpDmg('+Math.hypot(3.5,.5)+')')*10)/10))<.11&&bp[2][1]<470&&bp[2][1]>460,'falloff at 3.5 m: '+bp[2][1]);assert.equal(bp[2][2],500,'6 m: out of range');
 // offline Trademark (the player's): an enemy within 10 m in sight for 0.9 s -> a 6 m, 4 s, 50 % field under it; the trap is used up
 const tm=J(`(()=>{const P=player,b=bots.filter(b=>b.alive).slice(0,2);b.forEach(u=>u.g.position.set(P.x+300,u.g.position.y,P.z));BC.sf.length=0;BC.tm.length=0;const L0=los;los=()=>true;/* open floor assumed: the scan's sight line is checked by the server test */
   const m=new THREE.Object3D();scene.add(m);BC.tm.push({m,p:new RV(P.x+40,0.5,P.z),arm:0,wu:0});b[0].g.position.set(P.x+48,b[0].g.position.y,P.z);b[1].g.position.set(P.x+51,b[1].g.position.y,P.z);
   const r=[];bcTick(0.5);r.push(BC.tm.length,BC.sf.length);bcTick(0.45);r.push(BC.tm.length,BC.sf.length);const f=BC.sf[0]||{};r.push(f.r,f.t,Math.round((f.p?f.p.x-P.x:0)*10)/10,sgSlow(b[0].g.position),sgSlow(b[1].g.position));
   b[1].g.position.set(P.x+48+6.5,b[1].g.position.y,P.z);r.push(sgSlow(b[1].g.position));bcTick(4.1);r.push(BC.sf.length,sgSlow(b[0].g.position));los=L0;return r;})()`);
 assert.deepEqual(tm,[1,0,0,1,6,3.55,48,0.5,0.5,1,0,1],'player Trademark: 10 m scan, 0.9 s windup, 6 m field under the enemy, 50 % for everyone in it, 4 s');
 // ---- qa-26 audit (work/validation/abilities-parity.md section 8) ----
 // server constants = wiki
 {const D=await import(path.join(__dirname,'..','server','src','devices.js')),U=await import(path.join(__dirname,'..','server','src','ults.js')),SM=await import(path.join(__dirname,'..','server','src','simulation.js'));
  const T=D.DEV.trapwire;assert.deepEqual([T.deploy,T.windup,T.leave,T.slow,T.zap,T.rearm],[1.5,.7,4,1.25,5,2],'Trapwire (wiki v11.08 / v13.00)');
  const A=D.DEV.alarmbot;assert.deepEqual([A.sight,A.alert,A.speed,A.trigger,A.windup,A.vulnerable],[5.5,.5,22.5,2,.5,4],'Alarmbot (wiki v13.00)');
  assert.deepEqual([U.ULT.seekers.maxTravel,U.ULT.seekers.nearsight,U.ULT.seekers.slow,U.ULT.seekers.slowK],[15,3,5,.4],'Seekers');
  const B=SM.weapons['Blade Storm'];assert.deepEqual([B.fireRate,B.damageRanges[0].headDamage,B.damageRanges[0].bodyDamage,B.damageRanges[0].legDamage],[6,150,50,42.5],'Blade Storm (wiki)');
  assert.deepEqual(J('XALB'),{sight:A.sight,alert:A.alert,speed:A.speed,trig:A.trigger,windup:A.windup,r:A.radius,vul:A.vulnerable},'page XALB = server DEV.alarmbot');
  assert.deepEqual(J('XTRAP'),{deploy:T.deploy,windup:T.windup,leave:T.leave,slow:T.slow,zap:T.zap,rearm:T.rearm},'page XTRAP = server DEV.trapwire');
  assert.deepEqual(J('XBK_RC'),{Sage:45,Sova:50,Skye:50,Omen:40},'bot signature recharge = wiki (Recon Bolt / Guiding Light 50 s since v13.00)');}
 // offline Trapwire (player's wire): deploy 1.5 s, 50 % slow at once, zap 5 + reveal after 0.7 s, held within 4 m, 1.25 s slow after, re-arms in 2 s, not used up
 const tw=J(`(()=>{const P=player,b=bots.filter(b=>b.alive)[0],o=[];bots.forEach(x=>{if(x!==b)x.g.position.set(P.x+60,x.g.position.y,P.z+60);});b.hp=100;b.armor=0;b.chs=0;
   const W=cyWire(P.x,P.z-6,1,0,null);W.ck=1e9;/* nobody shoots the anchors in this check */const mid={x:(W.a.x+W.b.x)/2,z:(W.a.z+W.b.z)/2},st=(t)=>{for(let i=0;i<Math.round(t/.05);i++)cyTick(.05);};
   b.g.position.set(mid.x,b.g.position.y,mid.z);st(1.4);o.push(W.trip===b);st(.15);o.push(W.trip===b,b.chs>0,b.hp);st(.65);o.push(b.hp,J.rv.indexOf(b)>=0);st(.75);o.push(b.hp,b.chs>0);
   b.g.position.set(mid.x,b.g.position.y,mid.z+4.5);st(.05);o.push(W.trip===null,Math.round(b.chs*100)/100,W.arm,BC.cw.indexOf(W)>=0);
   b.g.position.set(mid.x,b.g.position.y,mid.z);st(1.5);o.push(W.trip===b);st(.6);o.push(W.trip===b);cyRm(W);BC.cw.splice(BC.cw.indexOf(W),1);return o;})()`);
 assert.deepEqual(tw,[false,true,true,100,100,false,95,true,true,1.25,2,true,false,true],'offline Trapwire: '+JSON.stringify(tw));
 // offline Alarmbot: 5.5 m detection, 0.5 s alert, 22.5 m/s, 0.5 s windup within 2 m, then Vulnerable 4 s in 3 m
 const al=J(`(()=>{const P=player,b=bots.filter(b=>b.alive)[0],o=[];b.vul=0;const p0=new THREE.Vector3(P.x+30,0,P.z);J.ab={m:new THREE.Object3D(),p:new THREE.Vector3(p0.x,0,p0.z)};b.g.position.set(p0.x+5,b.g.position.y,p0.z);
   const st=(t)=>{for(let i=0;i<Math.round(t/.05);i++)okTick(.05);};st(.45);o.push(J.ab.p.distanceTo(p0)<1e-6);st(.1);o.push(Math.round(J.ab.p.distanceTo(p0)*100)/100);st(.15);o.push(J.ab&&J.ab.wu>0,!(b.vul>0));st(.5);o.push(J.ab===null,Math.round(b.vul*100)/100);
   b.vul=0;J.ab={m:new THREE.Object3D(),p:new THREE.Vector3(p0.x,0,p0.z)};b.g.position.set(p0.x+6,b.g.position.y,p0.z);st(2);o.push(!!J.ab,!(b.vul>0));J.ab=null;return o;})()`);
 assert.deepEqual(al,[true,1.13,true,true,true,4,true,true],'offline Alarmbot (5.5 m: a bot at 6 m is not seen) timing: '+JSON.stringify(al));
 // offline Seekers: 60 % slow for 5 s (bots), Blade Storm single fire 1/6 s
 const sk=J(`(()=>{const b=bots.filter(b=>b.alive)[0],p=b.g.position;b.sks=0;b.chs=0;RS.sk.push({m:new THREE.Object3D(),tg:b,t:15});RS.sk[RS.sk.length-1].m.position.set(p.x,1.2,p.z);rsTick(.016);const k=sgSlow(p),t=b.sks;
   J.bsOn=true;J.bs=5;J.cd.x=0;const fb=FV.buy;FV.buy=0;rw="knife";jThrow();const c=J.cd.x;FV.buy=fb;J.bsOn=false;J.bs=0;return [Math.round(k*100)/100,t,c];})()`);
 assert.deepEqual(sk,[0.4,5,1/6],'offline Seekers 60 % 5 s / Blade Storm 6 per second: '+JSON.stringify(sk));
 // ---- qa-27: Chamber / Sage / Cypher (work/validation/abilities-parity.md section 8) ----
 {const U=await import(path.join(__dirname,'..','server','src','ults.js')),SM=await import(path.join(__dirname,'..','server','src','simulation.js')),D=await import(path.join(__dirname,'..','server','src','devices.js'));
  const T=U.ULT.tdf,TG=SM.ABILITY_GUNS['Tour De Force'].damageRanges[0],HG=SM.ABILITY_GUNS.Headhunter,HR=HG.damageRanges[0];
  assert.deepEqual(J('XTDF'),{rounds:T.ammo,rate:T.fireRate,body:TG.bodyDamage,head:TG.headDamage,legs:Math.floor(TG.legDamage),r:T.field,life:T.slow},'page XTDF = server ULT.tdf / ABILITY_GUNS');
  assert.deepEqual(J('XHH'),{rate:HG.fireRate,equip:HG.equipTimeSeconds,body:HR.bodyDamage,head:HR.headDamage,legs:HR.legDamage},'page XHH = server Headhunter');assert.equal(D.DEV.headhunter.equip,.3);
  assert.deepEqual([C.rdvT,C.rez],[P.rdvTime,{w:P.rez.windup,r:P.rez.revive,reach:P.rez.reach}],'Rendezvous 1.3 s / Resurrection 2 + 1.3 s, 12 m: page = server');
  assert.deepEqual([D.DEV.spycam.every,J('XSPY')],[2,{every:2,reveal:1}],'Spycam every 2 s');}
 // offline Tour De Force kill field: 6 m, 4 s, 50 % for everyone in it (bots of both sides and the player)
 const tf=J(`(()=>{const P=player,b=bots.filter(b=>b.alive)[0],o=[];b.chs=0;b.sks=0;const n0=BC.sf.length;bcTdfField(P.x+40,P.z);const f=BC.sf[BC.sf.length-1];o.push(BC.sf.length-n0,f.r,f.t,f.tm);b.g.position.set(P.x+44,b.g.position.y,P.z);o.push(sgSlow(b.g.position));b.g.position.set(P.x+46.5,b.g.position.y,P.z);o.push(sgSlow(b.g.position));bcTick(4.05);o.push(BC.sf.indexOf(f)<0);return o;})()`);
 assert.deepEqual(tf,[1,6,4,1,.5,1,true],'offline Tour De Force field: '+JSON.stringify(tf));
 // offline Rendezvous: 1.3 s teleport
 const rd=J(`(()=>{const P=player,pk=J.pick,o=[];J.pick="Chamber";BC.an=null;BC.rdv=null;J.cd.e=0;const x0=P.x,z0=P.z;bcKey("KeyE");P.x=x0+5;bcKey("KeyE");o.push(!!BC.rdv,Math.round((P.x-x0)*100)/100);bcTick(1.25);o.push(Math.round((P.x-x0)*100)/100);bcTick(.1);o.push(Math.round((P.x-x0)*100)/100,BC.rdv,J.cd.e);J.pick=pk;return o;})()`);
 assert.deepEqual(rd,[true,5,5,0,null,30],'offline Rendezvous 1.3 s: '+JSON.stringify(rd));
 // offline Resurrection: the ally stands 2 + 1.3 s after the cast
 const rz=J(`(()=>{const a=allies.filter(Boolean)[0];if(!a)return ["no ally"];const al=a.alive,o=[];a.alive=false;J.rz={a,t:XPAR2.rez.w+XPAR2.rez.r,m:new THREE.Object3D()};sgTick(3.2);o.push(a.alive,!!J.rz);sgTick(.15);o.push(a.alive,J.rz,a.hp);a.alive=al;return o;})()`);
 assert.deepEqual(rz,[false,true,true,null,100],'offline Resurrection 3.3 s: '+JSON.stringify(rz));
 // offline Spycam dart: pings keep coming every 2 s (not capped at 5) while the target lives
 const sp=J(`(()=>{const b=bots.filter(b=>b.alive)[0],st=window.setTimeout,q=[];let n=0;const rv0=xHfRv;xHfRv=(l)=>{if(l[0]===b)n++;};window.setTimeout=(f,ms)=>{q.push([f,ms]);return 0;};setTimeout=window.setTimeout;
   try{xDartLoop(b,XSPY.every,XSPY.reveal);for(let i=0;i<9&&q.length;i++){const [f,ms]=q.shift();if(ms!==2000)return ["ms",ms];f();}const k=n;b.alive=false;while(q.length)q.shift()[0]();const o=[k,n,q.length];b.alive=true;return o;}finally{window.setTimeout=st;setTimeout=st;xHfRv=rv0;}})()`);
 assert.deepEqual(sp,[10,10,0],'offline Spycam dart: 10 pings in 18 s, stops with its target: '+JSON.stringify(sp));
 console.log('Ability parity: server PARITY = offline XPAR2 (Shock Bolt falloff 75->1 over 1.5-4 m, Aftershock 2x80/0.6 s/3 m, Healing Orb 100/5 s, Regrowth 20/s, Shrouded Step 1.2 s, From the Shadows 4 s, Rendezvous 18 m, Lockdown 32.5 m, Tailwind 11 m); falloff curves identical; server and offline Shock Bolt 75/38/0 at 1/2.75/5 m; server and offline Aftershock bursts; server Sage self heal 100, Dismiss 1.5 s; Paint Shells server = offline (2.25 s fuse, 55->1 over 2.5-5.5 m, 4 sub-munitions +0.667 s 2.5 m out, 5.25 m); offline Blast Pack 5 s fuse + 50->20 falloff; offline Trademark 10 m / 0.9 s / 6 m 50 % 4 s field');
 process.exit(0);
})().catch(e=>{console.error(e);process.exit(1);});
