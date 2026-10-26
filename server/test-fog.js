// Fog of war (src/fog.js, anti-wallhack): an enemy's position, and an enemy device / barrier row, reach a client only while
// its team can see it (world rays with look-ahead), hear it (running footsteps, gunshots), has it revealed, or within the
// grace after; allies, the player's own row and the killer of a fresh victim stay. Also through the real worker tick
// (GameRoom.view) and on the real Ascent world.
import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';
import {SpikeSimulation} from './src/spike.js';import {Simulation} from './src/simulation.js';import {fogView,fogPass,FOG,fogRow,fogCast} from './src/fog.js';import {loadWorld} from './src/world.js';
// a 10 m wide, 4 m tall wall on x = 0 between z -5 and 5
const wallRay=(o,d,max=Infinity)=>{if(Math.abs(d[0])<1e-9)return Infinity;const t=-o[0]/d[0];if(!(t>0&&t<max))return Infinity;const z=o[2]+d[2]*t,y=o[1]+d[1]*t;return Math.abs(z)<5&&y<4?t:Infinity;};
const W={map:{attacker:[-10,0,0],defender:[10,0,0],sites:{A:[10,0,0]}},nav:{nodes:[[-10,0,0],[10,0,0]],adj:[[1],[0]]},playable:[0,1],allowed:new Set([0,1]),near:(x)=>x<0?0:1,ground:()=>0,blocked:()=>false,ray:wallRay};
const setup=(mode='five')=>{const s=mode==='five'?new SpikeSimulation(W,'five','ascent',()=>.5):new Simulation(W,mode,'ascent',()=>.5);const a=s.add('A','Jett'),b=s.add('B','Jett');s.start(false);s.units=[a,b];b.team=1-a.team;
 for(const [u,x,z]of [[a,-10,0],[b,10,0]])Object.assign(u,{x,y:0,z,vx:0,vz:0,alive:true,loading:false,input:{},revealedUntil:0,ch:0});s.phase='game';return {s,a,b};};
// two passes 50 ms apart (a hidden pair is re-tested every other pass); events go to the first
const frame=(s,ev)=>({t:'s',u:s.rows(),ev,fx:s.snapshot?.().fx});
const view=(s,u,ev=[])=>{s.time+=.05;fogView(s,frame(s,ev),u);s.time+=.05;return fogView(s,frame(s,[]),u);};
const row=(v,u)=>v.u.find(r=>r[0]===u.id);
const adv=(s,t)=>{s.time+=t;};
// 1. behind the wall: hidden row (identity / team / alive / weapon stay; position, aim, HP, armour, ammo gone; [22] = 1)
{const {s,a,b}=setup();const r=row(view(s,a),b);assert.equal(r[22],1,'enemy behind the wall is hidden');assert.deepEqual([r[0],r[1],r[2],r[3],r[10],r[11]],[b.id,b.team,'B','Jett',1,b.weapon]);
 assert.deepEqual([r[4],r[5],r[6],r[7],r[9],r[15],r[16]],[0,0,0,0,0,0,0],'no position, aim, armour, ammo');
 const me=row(view(s,a),a);assert.equal(me[22],0,'own row untouched');assert.equal(me[4],-10);
 // the client's row validator (server_runtime.js netClean) still accepts a hidden row: >= 15 fields, numbers where it wants them
 assert.ok(r.length>=15&&[0,4,5,6,7,8,9,14].every(i=>Number.isFinite(r[i]))&&typeof r[2]==='string'&&typeof r[3]==='string'&&typeof r[11]==='string');}
// 2. in sight past the wall's end: full row
{const {s,a,b}=setup();b.z=20;adv(s,.05);const r=row(view(s,a),b);assert.notEqual(r[22],1,'in sight');assert.equal(r[6],20);}
// 3. grace: after breaking sight the row stays FOG.grace s, then goes
{const {s,a,b}=setup();b.z=20;adv(s,.05);view(s,a);b.z=0;adv(s,.5);assert.notEqual(row(view(s,a),b)[22],1,'within the grace');adv(s,FOG.grace+.1);view(s,a);adv(s,.05);assert.equal(row(view(s,a),b)[22],1,'hidden after the grace');}
// 4. look-ahead: an enemy 1 m behind the wall's end running out (6 m/s) is sent before it clears the edge; standing still it is not
{const {s,a,b}=setup();b.z=4.2;b.x=3;adv(s,.05);view(s,a);adv(s,.05);assert.equal(row(view(s,a),b)[22],1,'still, behind the edge: hidden');
 b.vz=6;b.input={walk:1};b.inputAt=s.time+.2;/* no footsteps: the look-ahead alone */adv(s,.05);view(s,a);adv(s,.05);assert.notEqual(row(view(s,a),b)[22],1,'running out: sent ahead of the peek');}
// 5. a teammate's sight is the team's; the enemy team's own rows never fogged among themselves
{const {s,a,b}=setup();const c=s.add('C','Sova');c.team=a.team;Object.assign(c,{x:-10,y:0,z:20,alive:true,loading:false,vx:0,vz:0,input:{},ch:0});s.units.push(c);b.z=6;adv(s,.05);
 assert.notEqual(row(view(s,a),b)[22],1,'C sees B: A gets B');assert.notEqual(row(view(s,b),c)[22],1,'and B gets C (sight is mutual)');assert.equal(row(view(s,a),c)[22],0,'ally row untouched');}
// 6. revealed (Recon Bolt, Owl dart, Alarmbot ...): sent while revealed
{const {s,a,b}=setup();b.revealedUntil=s.time+2;adv(s,.05);assert.notEqual(row(view(s,a),b)[22],1,'revealed');adv(s,2.5);view(s,a);adv(s,.05);assert.equal(row(view(s,a),b)[22],1,'reveal over');}
// 7. hearing: running footsteps within 30 m; walking (shift) is silent; beyond 30 m nothing
{const {s,a,b}=setup();b.vx=5.4;adv(s,.05);assert.notEqual(row(view(s,a),b)[22],1,'running footsteps 20 m away');
 const t=setup();t.b.vx=5.4;t.b.input={walk:1};t.b.inputAt=t.s.time+.1;adv(t.s,.05);assert.equal(row(view(t.s,t.a),t.b)[22],1,'shift-walking is silent');const d=setup();d.b.vx=5.4;d.b.input={duck:1};d.b.inputAt=d.s.time+.1;adv(d.s,.05);assert.equal(row(view(d.s,d.a),d.b)[22],1,'crouch-walking is silent');
 const f=setup();f.b.vx=5.4;f.b.x=40;f.b.z=2;adv(f.s,.05);assert.equal(row(view(f.s,f.a),f.b)[22],1,'footsteps past 30 m');}
// 8. a gunshot within 50 m: sent for 1 s
{const {s,a,b}=setup();adv(s,.05);assert.notEqual(row(view(s,a,[['s',b.id,'Vandal']]),b)[22],1,'gunshot');adv(s,.5);assert.notEqual(row(view(s,a),b)[22],1,'still within 1 s');adv(s,1.7);view(s,a);adv(s,.05);assert.equal(row(view(s,a),b)[22],1,'shot heard 2 s ago: hidden');}
// 9. your killer stays yours (not your team's) for FOG.killer s; a dead enemy row is not fogged
{const {s,a,b}=setup();const c=s.add('C','Sova');c.team=a.team;Object.assign(c,{x:-30,y:0,z:0,alive:true,loading:false,vx:0,vz:0,input:{},ch:0});s.units.push(c);a.alive=false;adv(s,.05);
 const v=view(s,a,[['k','B','A',0,'Vandal']]);assert.notEqual(row(v,b)[22],1,'victim sees the killer');assert.equal(row(view(s,c),b)[22],1,'the victim\'s teammate does not');adv(s,FOG.killer+.1);view(s,a);adv(s,.05);assert.equal(row(view(s,a),b)[22],1,'killer hidden again after the window');
 b.alive=false;adv(s,.05);assert.equal(row(view(s,c),b)[22],1,'B died out of C\'s sight: its dead row stays hidden (no death spot)');}
// 10. devices: an enemy Turret behind the wall is not in the fx rows; own team always; once seen it stays (static)
{const {s,a,b}=setup();b.agent='Killjoy';s.effects.push({id:901,kind:'turret',owner:b.id,team:b.team,p:[8,0,0],until:s.time+30,hp:100,yaw:0});adv(s,.05);
 const devs=u=>view(s,u).fx.filter(r=>r.kind==='dev').map(r=>r.id);assert.deepEqual(devs(a),[],'enemy turret behind the wall: no row');assert.deepEqual(devs(b),[901],'owner team: row');
 a.z=20;adv(s,.05);assert.deepEqual(devs(a),[901],'seen');a.z=0;adv(s,3);assert.deepEqual(devs(a),[901],'a static device stays once seen');
 // moving device (Owl Drone): grace only
 s.effects.push({id:902,kind:'owl',owner:b.id,team:b.team,p:[8,2,0],until:s.time+7,hp:100});adv(s,.05);assert.ok(!devs(a).includes(902),'owl behind the wall: hidden');
 s.effects.find(e=>e.id===902).p=[8,2,15];adv(s,.05);assert.ok(devs(a).includes(902),'owl in sight');s.effects.find(e=>e.id===902).p=[8,2,0];adv(s,FOG.grace+.2);view(s,a);adv(s,.05);assert.ok(!devs(a).includes(902),'owl back behind the wall: gone after the grace');
 // barrier rows
 s.effects.push({id:903,kind:'barrier',owner:b.id,team:b.team,p:[6,0,0],yaw:0,until:s.time+30,hp:1600,seg:[400,400,400,400]});adv(s,.05);const bars=u=>view(s,u).fx.filter(r=>r.kind==='barrier').map(r=>r.id);
 assert.deepEqual(bars(a),[],'enemy barrier behind the wall: hidden');assert.deepEqual(bars(b),[903]);a.z=20;adv(s,.05);assert.deepEqual(bars(a),[903],'barrier seen');}
// 11. within 3 m: always (a thin wall between two players at a corner)
{const {s,a,b}=setup();a.x=-1;b.x=1;adv(s,.05);assert.notEqual(row(view(s,a),b)[22],1);}
// 12. Deathmatch: per player (no team vision)
{const {s,a,b}=setup('dm');const c=s.add('C','Sova');s.units.push(c);Object.assign(c,{x:-10,y:0,z:20,alive:true,loading:false,vx:0,vz:0,input:{},ch:0,team:a.team});b.z=6;adv(s,.05);
 assert.notEqual(row(view(s,c),b)[22],1,'C sees B');assert.equal(row(view(s,a),b)[22],1,'A does not get C\'s sight in DM');}
// 13. out of the match phase nothing is fogged; fogRow keeps the row length (24)
{const {s,a,b}=setup();s.phase='post';assert.equal(row(view(s,a),b)[22],0);assert.equal(fogRow(s.rows()[0]).length,24);}
// 14. the real worker tick sends each session its own view (GameRoom.view -> fogView)
{const source=fs.readFileSync('src/worker.js','utf8'),code=source.slice(source.indexOf('export class GameRoom')).replace('export class','class')+';globalThis.GameRoom=GameRoom;';
 const context={DurableObject:class{constructor(ctx,env){this.ctx=ctx;this.env=env;}},crypto:globalThis.crypto,Date,URL,performance,setInterval,clearInterval,Map,Set,JSON,Number,Object,Math,Array,fogView,fogCast};vm.createContext(context);vm.runInContext(code,context);
 const room=new context.GameRoom({waitUntil(){}},{DIRECTORY:{idFromName:()=>'',get:()=>({fetch:async()=>new Response('{}')})}});room.advertise=()=>{};const {s,a,b}=setup();room.sim=s;room.last=Date.now();
 const got=new Map(),mk=n=>({send(m){const o=JSON.parse(m);if(o.t==='s')got.set(n,o);},close(){}});const wa=mk('a'),wb=mk('b');room.sessions.set(wa,{id:'a',u:a,ready:true,last:Date.now()});room.sessions.set(wb,{id:'b',u:b,ready:true,last:Date.now()});a.human=b.human=true;
 room.tick();assert.ok(got.get('a')&&got.get('b'),'both got a snapshot');const ra=got.get('a').u.find(r=>r[0]===b.id),rb=got.get('b').u.find(r=>r[0]===a.id);
 if(b.alive&&a.alive&&Math.abs(b.z)<5&&Math.abs(a.z)<5&&a.x<0&&b.x>0){assert.equal(ra[22],1,'worker: A gets B hidden');assert.equal(rb[22],1,'worker: B gets A hidden');}
 assert.equal(got.get('a').u.find(r=>r[0]===a.id)[22],0,'worker: own row full');clearInterval(room.timer);}
// 15. real Ascent: attacker and defender spawns never see each other at round start; the fog pass costs little
{const assets={async fetch(r){try{return new Response(fs.readFileSync(new URL('./public'+new URL(r.url).pathname,import.meta.url)));}catch(e){return new Response('',{status:404});}}};
 const RW=await loadWorld(assets,'ascent');let seed=5;const s=new SpikeSimulation(RW,'five','ascent',()=>(seed=(seed*16807)%2147483647)/2147483647);s.add('H','Jett');s.start(true);s.units.forEach(u=>u.human=false);
 const snap0=s.snapshot(),h=s.units[0],v0=fogView(s,snap0,h);const enemies=v0.u.filter(r=>r[1]!==h.team);assert.equal(enemies.length,5);assert.ok(enemies.every(r=>r[22]===1),'spawn to spawn: every enemy hidden');
 let ms=0,n=0,shown=0,rows=0;for(let k=0;k<20*40;k++){s.step(.05);const snap=s.snapshot(),t=performance.now();for(const u of s.units){const v=fogView(s,snap,u);for(const r of v.u)if(r[1]!==u.team&&r[10]){rows++;if(r[22]!==1)shown++;}}ms+=performance.now()-t;n++;}
 // every enemy in clear head-to-head sight of a live player's eye on one tick is sent to that player on that tick or the next
 let prev=null,checked=0;for(let k=0;k<20*80;k++){s.step(.05);const snap=s.snapshot(),sent=new Set(),clear=[];for(const u of s.units){const v=fogView(s,snap,u);for(const r of v.u)if(r[1]!==u.team&&r[22]!==1)sent.add(u.id+'>'+r[0]);if(!u.alive||u.loading)continue;
  for(const e of s.units.filter(e=>e.alive&&!e.loading&&e.team!==u.team)){const o=[u.x,u.y+1.6-(u.ch||0),u.z],p=[e.x,e.y+1.6-(e.ch||0),e.z],q=p.map((x,i)=>x-o[i]),l=Math.hypot(...q);if(RW.ray(o,q.map(x=>x/l),l-.05)===Infinity)clear.push(u.id+'>'+e.id);}}
  if(prev)for(const c of prev.clear){checked++;assert.ok(prev.sent.has(c)||sent.has(c),'clear head-to-head sight is never fogged: '+c+' t '+s.time.toFixed(2));}prev={clear,sent};}
 console.log('fog: clear-sight pairs checked',checked);assert.ok(checked>0,'the soak met an enemy in sight');
 console.log('fog: ascent 40 s, 10 views/tick',(ms/n).toFixed(2),'ms/tick,',Math.round(100*shown/Math.max(1,rows))+'% of live enemy rows sent');assert.ok(ms/n<15,'fog pass under 15 ms/tick');}
// 16. row [23]: running footsteps (moving > 1.5 m/s on live input without walk / duck); a hidden row never carries it
{const {s,a,b}=setup();const R=()=>s.rows().find(r=>r[0]===b.id);b.vx=5.4;b.input={};b.inputAt=s.time;assert.equal(R()[23],1,'running: loud');b.input={walk:1};assert.equal(R()[23],0,'shift-walk: silent');b.input={duck:1};assert.equal(R()[23],0,'crouch: silent');
 b.input={};b.vx=.5;assert.equal(R()[23],0,'standing: silent');b.vx=5.4;b.alive=false;assert.equal(R()[23],0,'dead: silent');b.alive=true;assert.equal(fogRow(R())[23],0,'hidden row: no footsteps flag');}
// 17. cast events ('ac'): a hidden caster's eye / aim never reach the enemy; the effect point only when it is in sight;
// heard within FOG.cast m (the caster becomes relevant: whole event); own team always whole
{const ac=(s,u,p)=>({t:'ac',i:u.id,ag:u.agent,k:'q',o:[u.x,u.y+1.6,u.z],d:[-1,0,0],p,ts:Math.round(s.time*1000)});
 const far=()=>{const t=setup();t.b.x=40;return t;};
 {const {s,a,b}=far();const e=ac(s,b,[38,0,2]);s.castEvents.push(e);view(s,a);const v=fogCast(s,e,a);s.castEvents.length=0;
  assert.deepEqual(v,{t:'ac',i:b.id,ag:'Jett',k:'q',ts:e.ts,fog:1},'far, behind the wall, effect out of sight: no position at all');
  assert.equal(fogCast(s,e,b),e,'the caster gets its own cast');}
 {const {s,a,b}=far();const e=ac(s,b,[-5,0,0]);s.castEvents.push(e);view(s,a);const v=fogCast(s,e,a);s.castEvents.length=0;
  assert.deepEqual(v.p,[-5,0,0],'effect point in sight: p kept');assert.equal(v.o,undefined,'no eye');assert.equal(v.d,undefined,'no aim');assert.equal(v.fog,1);}
 {const {s,a,b}=setup();const e=ac(s,b,[8,0,2]);view(s,a);assert.equal(row(view(s,a),b)[22],1,'B (20 m, behind the wall, still) hidden before the cast');
  s.castEvents.push(e);const r=row(view(s,a),b);const v=fogCast(s,e,a);s.castEvents.length=0;assert.notEqual(r[22],1,'a cast 20 m away is heard: row sent');assert.equal(v,e,'heard: the whole event');
  adv(s,FOG.shotFor+FOG.grace+.2);view(s,a);assert.equal(row(view(s,a),b)[22],1,'cast heard 2 s ago: hidden again');}
 {const {s,a,b}=far();const c=s.add('C','Sova');c.team=b.team;Object.assign(c,{x:-12,y:0,z:0,alive:true,loading:false,vx:0,vz:0,input:{},ch:0});s.units.push(c);const e=ac(s,b,[38,0,2]);s.castEvents.push(e);view(s,c);
  assert.equal(fogCast(s,e,c),e,'teammate: whole');s.castEvents.length=0;}
 {const {s,a,b}=far();s.phase='post';const e=ac(s,b,[38,0,2]);assert.equal(fogCast(s,e,a),e,'out of the match phase: whole');}}
// 18. the real worker tick sends each session its own cast view (GameRoom tick -> fogCast)
{const source=fs.readFileSync('src/worker.js','utf8'),code=source.slice(source.indexOf('export class GameRoom')).replace('export class','class')+';globalThis.GameRoom=GameRoom;';
 const context={DurableObject:class{constructor(ctx,env){this.ctx=ctx;this.env=env;}},crypto:globalThis.crypto,Date,URL,performance,setInterval,clearInterval,Map,Set,JSON,Number,Object,Math,Array,fogView,fogCast};vm.createContext(context);vm.runInContext(code,context);
 const room=new context.GameRoom({waitUntil(){}},{DIRECTORY:{idFromName:()=>'',get:()=>({fetch:async()=>new Response('{}')})}});room.advertise=()=>{};const {s,a,b}=setup();b.x=40;room.sim=s;room.last=Date.now();
 const got=new Map(),mk=n=>({send(m){const o=JSON.parse(m);if(o.t==='ac')got.set(n,o);},close(){}});const wa=mk('a'),wb=mk('b');room.sessions.set(wa,{id:'a',u:a,ready:true,last:Date.now()});room.sessions.set(wb,{id:'b',u:b,ready:true,last:Date.now()});a.human=b.human=true;
 s.castEvents.push({t:'ac',i:b.id,ag:'Jett',k:'q',o:[b.x,b.y+1.6,b.z],d:[-1,0,0],p:[b.x-2,b.y,b.z],ts:1});
 room.tick();clearInterval(room.timer);const ga=got.get('a'),gb=got.get('b');assert.ok(ga&&gb,'both got the cast');assert.ok(Array.isArray(gb.o),'caster: whole');
 assert.ok(a.alive&&b.alive&&Math.abs(b.z)<5&&b.x>30,'still apart behind the wall');assert.equal(ga.o,undefined,'worker: enemy gets no eye');assert.equal(ga.p,undefined,'worker: nor the out-of-sight effect point');assert.equal(ga.fog,1);}
// 19. hit events ('h'): a hit on an enemy hidden from us by someone outside our group is dropped (its damage would give
// away the HP the row hides); our own hit on a hidden enemy (a wallbang) and hits on visible units stay; the target keeps it
{const {s,a,b}=setup('dm');const c=s.add('C','Sova');s.units.push(c);Object.assign(c,{x:12,y:0,z:0,alive:true,loading:false,vx:0,vz:0,input:{},ch:0,revealedUntil:0});
 const hv=(u,ev)=>{s.time+=.05;fogView(s,frame(s,[]),u);s.time+=.05;return fogView(s,frame(s,ev),u);};const H=(x,y)=>['h',x.id,y.id,0,0,30,0,1,0,0,0];
 let v=hv(a,[H(c,b),H(a,b),['k','C','B',0,'Vandal']]);assert.equal(row(v,b)[22],1,'B hidden from A');
 assert.deepEqual(v.ev.filter(e=>e[0]==='h').map(e=>e[1]),[a.id],'C on hidden B dropped for A; A\'s own wallbang kept');assert.ok(v.ev.some(e=>e[0]==='k'),'kill feed kept');
 v=hv(b,[H(c,b)]);assert.equal(v.ev.length,1,'the target keeps the hit');v=hv(c,[H(c,b)]);assert.equal(v.ev.length,1,'the shooter keeps the hit');
 b.x=-6;b.z=8;v=hv(a,[H(c,b)]);assert.notEqual(row(v,b)[22],1,'B in sight');assert.equal(v.ev.length,1,'a hit on a visible unit stays');}
// 20. Jett's Cloudburst in flight (fx 'cb' s 0) leaves the caster's eye: hidden from an enemy until the projectile is in
// sight; its smoke (s 1) always sent; own team always
{const {s,a,b}=setup();const e={id:950,kind:'cloudburst',owner:b.id,ag:'Jett',team:b.team,p:[10,1.6,0],until:s.time+5,radius:0};s.effects.push(e);
 const cbs=(u,st)=>view(s,u).fx.filter(r=>r.kind==='cb'&&r.s===st).map(r=>r.id);
 assert.deepEqual(cbs(a,0),[],'projectile at the hidden caster: no row');assert.deepEqual(cbs(b,0),[950],'own team: row');
 e.p=[-4,3,0];assert.deepEqual(cbs(a,0),[950],'projectile out in sight: row');
 Object.assign(e,{kind:'smoke',cb:true,c:[12,1,0],p:[12,0,0]});assert.deepEqual(cbs(a,1),[950],'the smoke: always');}
// 21. dead enemy rows: sent whole only to a group the enemy was relevant to when it died (seen / heard within the grace);
// one that died unseen keeps no position (its death spot); the kill feed ('k': names, headshot, weapon, wallbang - no
// position) reaches everyone
{const {s,a,b}=setup('tdm');b.z=20;adv(s,.05);view(s,a);b.alive=false;b.hp=0;const v=view(s,a,[['k','A','B',1,'Vandal',0]]);assert.notEqual(row(v,b)[22],1,'B died in sight: dead row whole');assert.equal(row(v,b)[6],20);
 adv(s,FOG.grace+1);assert.notEqual(row(view(s,a),b)[22],1,'and stays whole while dead');
 const t=setup('tdm');t.b.alive=false;t.b.hp=0;const w=view(t.s,t.a,[['k','C','B',0,'Phantom',1]]);const r=row(w,t.b);assert.equal(r[22],1,'B died unseen: hidden');assert.deepEqual([r[4],r[5],r[6]],[0,0,0],'no death spot');assert.equal(r[10],0,'still known dead');
 t.b.alive=true;t.b.hp=100;adv(t.s,.05);view(t.s,t.a);t.b.z=20;adv(t.s,.05);assert.notEqual(row(view(t.s,t.a),t.b)[22],1,'respawned and seen: whole again');
 const k=['k','A','B',1,'Vandal',1];assert.ok(k.slice(1).every(x=>typeof x==='string'||x===0||x===1),'kill-feed row: names and flags only');
 const u=setup('tdm');u.b.alive=false;const kv=view(u.s,u.a,[k]);assert.deepEqual(kv.ev,[],'(events go to the first pass)');u.s.time+=.05;const kv2=fogView(u.s,frame(u.s,[k]),u.a);assert.deepEqual(kv2.ev,[k],'kill feed kept for a hidden victim');}
// 22. gunshots ('s'): within FOG.shot m the shooter turns relevant on that pass and the cue is kept; beyond it (or a shot
// the viewer cannot hear) the event is dropped - no cue, no shooter id; own team / own shots always kept
{const {s,a,b}=setup();const S=u=>['s',u.id,'Vandal'];const ev=(u,e)=>{s.time+=.05;fogView(s,frame(s,[]),u);s.time+=.05;return fogView(s,frame(s,e),u);};
 let v=ev(a,[S(b)]);assert.deepEqual(v.ev,[S(b)],'20 m away: heard');assert.notEqual(row(v,b)[22],1,'and the shooter is sent');
 b.x=80;adv(s,3);v=ev(a,[S(b)]);assert.equal(row(v,b)[22],1,'80 m behind the wall: hidden');assert.deepEqual(v.ev,[],'and its shot dropped');
 v=ev(b,[S(b)]);assert.deepEqual(v.ev,[S(b)],'own shot');const c=s.add('C','Sova');c.team=b.team;Object.assign(c,{x:-40,y:0,z:0,alive:true,loading:false,vx:0,vz:0,input:{},ch:0,revealedUntil:0});s.units.push(c);v=ev(c,[S(b)]);assert.deepEqual(v.ev,[S(b)],'teammate hears it');
 b.x=10;b.z=20;adv(s,.05);v=ev(a,[S(b)]);assert.notEqual(row(v,b)[22],1);assert.deepEqual(v.ev,[S(b)],'shooter in sight: kept');}
// 23. finishers ('fin' serial, killer, victim, weapon, id, victim x y z, round): the victim's death spot reaches only a
// viewer the victim row is sent to (or the killer)
{const {s,a,b}=setup('tdm');const c=s.add('C','Sova');c.team=a.team;Object.assign(c,{x:-40,y:0,z:0,alive:true,loading:false,vx:0,vz:0,input:{},ch:0,revealedUntil:0});s.units.push(c);
 b.alive=false;const F=['fin',1,c.id,b.id,'Vandal','x',10,0,0,1];s.time+=.05;fogView(s,frame(s,[]),a);s.time+=.05;
 const va=fogView(s,frame(s,[F]),a);assert.equal(row(va,b)[22],1);assert.deepEqual(va.ev,[],'A: unseen victim, finisher dropped');
 assert.deepEqual(fogView(s,frame(s,[F]),c).ev,[F],'the killer keeps it');assert.deepEqual(fogView(s,frame(s,[F]),b).ev,[F],'the victim keeps it');}
// 24. Spike mode: a team with everyone dead (no Phoenix inside Run It Back) gets the whole frame and whole casts, so its
// spectator camera can follow the enemies; one live member (or a pending Run It Back) keeps the fog; never in TDM / DM
{const {s,a,b}=setup();b.x=40;a.alive=false;adv(s,.05);let v=view(s,a);assert.notEqual(row(v,b)[22],1,'team eliminated: enemies whole');assert.equal(row(v,b)[4],40);
 const e={t:'ac',i:b.id,ag:'Jett',k:'q',o:[40,1.6,0],d:[-1,0,0],p:[38,0,0],ts:1};assert.equal(fogCast(s,e,a),e,'and whole casts');
 a.runItBack={p:[-10,0,0],until:s.time+5};assert.equal(row(view(s,a),b)[22],1,'Run It Back pending: still fogged');a.runItBack=null;
 const c=s.add('C','Sova');c.team=a.team;Object.assign(c,{x:-30,y:0,z:0,alive:true,loading:false,vx:0,vz:0,input:{},ch:0,revealedUntil:0});s.units.push(c);adv(s,.05);assert.equal(row(view(s,a),b)[22],1,'a live teammate: fogged');
 const t=setup('tdm');t.b.x=40;t.a.alive=false;adv(t.s,.05);assert.equal(row(view(t.s,t.a),t.b)[22],1,'TDM: the dead respawn, fog stays');}
// 25. round state ('rs') per player: Reyna's soul orbs only to that Reyna (not her team, not the enemy); the Spike's spot
// only to the attackers until planted; credits of the own team only; revealed enemies only while revealed
{const {s,a,b}=setup();a.agent='Reyna';const c=s.add('C','Sova');c.team=a.team;Object.assign(c,{x:-30,y:0,z:0,alive:true,loading:false,input:{},ch:0});s.units.push(c);
 s.effects.push({id:960,kind:'soul',owner:a.id,team:a.team,p:[-5,1.2,0],until:s.time+3,radius:0});
 const rs=u=>JSON.parse(JSON.stringify(s.roundState(u)));assert.deepEqual(rs(a).reyna.souls.map(x=>x.id),[960],'Reyna: her soul');
 for(const u of [b,c]){const r=rs(u);assert.equal(r.reyna,null,'no soul rows for '+u.name);assert.ok(!JSON.stringify(r).includes('-5,1.2'),'no soul spot anywhere in '+u.name+'\'s round state');}
 assert.deepEqual(Object.keys(rs(b).cr).sort(),['B'],'enemy credits never sent');assert.deepEqual(rs(b).rv,[],'nothing revealed');
 const def=s.atk===a.team?b:a,sp=rs(def).sp;if(s.spike.st!=='plant')assert.deepEqual([sp[1],sp[2],sp[3],sp[7]],[-1,0,0,''],'defenders: no Spike spot before the plant');}
// 26. every snapshot event type (simulation / spike / abilities / finishers push ['k' 'h' 's' 'n' 'sp' 'fin']) is known
// to the fog audit: a new type must be classified here (and in fog.js fogView) before it ships
{const src=['simulation.js','spike.js','abilities.js','finishers.js','ults.js','devices.js','reyna.js','windups.js','bots.js','floor.js'].map(f=>fs.readFileSync('src/'+f,'utf8')).join('\n');
 const types=new Set([...src.matchAll(/events\.push\(\[\s*'([a-z]+)'/g)].map(m=>m[1]));if(/const e=\['fin'/.test(src))types.add('fin');
 const audited={k:'names only',h:'dropped for a hidden target (19)',s:'dropped for a hidden shooter (22)',n:'out-of-bounds warning: a name only',sp:'Spike planted: site public',fin:'dropped for a hidden victim (23)'};
 for(const t of types)assert.ok(audited[t],'unaudited snapshot event type: '+t);}
// 27. floor guns (fw rows): an enemy's drop (G, death, swap) reaches a group only once one of its live members has seen the
// spot (then it stays); the dropper's team always; an ownerless gun always
{const {s,a,b}=setup();s.floor=[{id:70,w:'Vandal',x:9,y:0,z:0,ammo:25,reserve:50,dropper:b.id,graceUntil:0},{id:71,w:'Ghost',x:9,y:0,z:1,ammo:15,reserve:30,dropper:null,graceUntil:0}];
 const fw=u=>{adv(s,.05);return fogView(s,{...frame(s,[]),fw:s.floor.map(d=>[d.id,d.w,d.x,d.y,d.z])},u).fw.map(r=>r[0]);};
 assert.deepEqual(fw(a),[71],'enemy drop behind the wall: no row (ownerless one kept)');assert.deepEqual(fw(b),[70,71],'dropper\'s team: row');
 a.z=20;assert.deepEqual(fw(a),[70,71],'spot seen');a.z=0;adv(s,3);assert.deepEqual(fw(a),[70,71],'stays once seen');
 s.floor.push({id:72,w:'Phantom',x:9.5,y:0,z:0,ammo:25,reserve:50,dropper:a.id,graceUntil:0});assert.ok(fw(a).includes(72),'own drop');assert.ok(fw(b).includes(72),'an enemy drop B stands 1 m from (in sight): row');
 s.floor.push({id:73,w:'Spectre',x:-12,y:0,z:-2,ammo:25,reserve:50,dropper:a.id,graceUntil:0});assert.ok(!fw(b).includes(73),'A\'s drop behind the wall: not B\'s');}
console.log('test-fog: ok');
