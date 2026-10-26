// Fog of war (src/fog.js, anti-wallhack): an enemy's position, and an enemy device / barrier row, reach a client only while
// its team can see it (world rays with look-ahead), hear it (running footsteps, gunshots), has it revealed, or within the
// grace after; allies, the player's own row and the killer of a fresh victim stay. Also through the real worker tick
// (GameRoom.view) and on the real Ascent world.
import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';
import {SpikeSimulation} from './src/spike.js';import {Simulation} from './src/simulation.js';import {fogView,fogPass,FOG,fogRow} from './src/fog.js';import {loadWorld} from './src/world.js';
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
 b.alive=false;adv(s,.05);assert.equal(row(view(s,c),b)[22],0,'dead row: not fogged');}
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
 const context={DurableObject:class{constructor(ctx,env){this.ctx=ctx;this.env=env;}},crypto:globalThis.crypto,Date,URL,performance,setInterval,clearInterval,Map,Set,JSON,Number,Object,Math,Array,fogView};vm.createContext(context);vm.runInContext(code,context);
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
console.log('test-fog: ok');
