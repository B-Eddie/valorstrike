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
 assert.equal(C.rdv,P.rendezvous,'Rendezvous');assert.equal(C.tail,P.tail,'Tailwind');assert.equal(C.ld,32.5,'Lockdown 32.5 m (wiki)');assert.equal(C.regrow,20,'Regrowth 20 HP/s (wiki)');
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
 console.log('Ability parity: server PARITY = offline XPAR2 (Shock Bolt falloff 75->1 over 1.5-4 m, Aftershock 2x80/0.6 s/3 m, Healing Orb 100/5 s, Regrowth 20/s, Shrouded Step 1.2 s, From the Shadows 4 s, Rendezvous 18 m, Lockdown 32.5 m, Tailwind 11 m); falloff curves identical; server and offline Shock Bolt 75/38/0 at 1/2.75/5 m; server and offline Aftershock bursts; server Sage self heal 100, Dismiss 1.5 s');
 process.exit(0);
})().catch(e=>{console.error(e);process.exit(1);});
