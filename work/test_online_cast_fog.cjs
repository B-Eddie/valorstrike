// Fog of war for cast events (qa-24): the server (fog.js fogCast) sends a hidden enemy caster's 'ac' without its eye / aim,
// flagged fog:1, with the effect point p only when that point is in sight. work/server_runtime.js wraps mpCastFx: a fog:1
// cast with p is replayed at p (the caster's model stands there for that call only, then goes back to its parked spot);
// without p nothing is drawn (the stale parked spot is never used); an ordinary cast (or offline) goes through unchanged.
// End to end from the real server's fogCast output.
const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict'),path=require('path');
const root=path.join(__dirname,'..'),rt=fs.readFileSync(path.join(root,'work/server_runtime.js'),'utf8'),page=fs.readFileSync(path.join(root,'index.html'),'utf8');
const src=rt.slice(rt.indexOf('// Fog of war, casts'),rt.indexOf('// Online soul resources'));assert.ok(src.includes('netCastFx0')&&page.includes(src.trim().slice(0,400)),'slice found; index.html regenerated');
const calls=[];const V=(x,y,z)=>({x,y,z,set(a,b,c){this.x=a;this.y=b;this.z=c;return this;}});
const enemy={nid:7,g:{position:V(1,0,1)}};
const c={NET:{socket:{}},bots:[enemy],allies:[],Array,Number,Object,
 mpCastFx(m){calls.push({m,at:[enemy.g.position.x,enemy.g.position.y,enemy.g.position.z]});}};
vm.createContext(c);vm.runInContext(src+';globalThis.cast=m=>mpCastFx(m);',c);
// 1. whole cast: unchanged
c.cast({t:'ac',i:7,ag:'Brimstone',k:'q',o:[5,1.6,5],d:[0,0,-1],p:[5,0,-9],ts:1});assert.equal(calls.length,1);assert.deepEqual(calls[0].m.o,[5,1.6,5],'whole cast passes through');
// 2. fog:1 with p: replayed at p, model back where it was parked
calls.length=0;c.cast({t:'ac',i:7,ag:'Brimstone',k:'q',p:[20,0,-3],ts:2,fog:1});assert.equal(calls.length,1,'drawn');assert.deepEqual(calls[0].at,[20,0,-3],'caster spot = effect point during the replay');assert.deepEqual([...calls[0].m.o],[20,1.6,-3],'eye at the effect point, never the parked spot');
assert.deepEqual([enemy.g.position.x,enemy.g.position.y,enemy.g.position.z],[1,0,1],'model back at its parked spot');
// 3. fog:1 without p (or a bad p): nothing drawn
calls.length=0;c.cast({t:'ac',i:7,ag:'Brimstone',k:'q',ts:3,fog:1});c.cast({t:'ac',i:7,ag:'Brimstone',k:'q',p:[NaN,0,0],ts:4,fog:1});c.cast({t:'ac',i:99,ag:'Brimstone',k:'q',p:[0,0,0],ts:5,fog:1});assert.equal(calls.length,0,'no position: nothing to draw');
// 4. offline: the page's own path
c.NET.socket=null;c.cast({t:'ac',i:7,ag:'Jett',k:'q',ts:6,fog:1});assert.equal(calls.length,1,'offline: unchanged');c.NET.socket={};
// 5. end to end with the real server: hidden far caster -> no eye anywhere in what the page gets
(async()=>{const {SpikeSimulation}=await import(path.join(root,'server/src/spike.js')),{fogView,fogCast}=await import(path.join(root,'server/src/fog.js'));
 const wallRay=(o,d,max=Infinity)=>{if(Math.abs(d[0])<1e-9)return Infinity;const t=-o[0]/d[0];if(!(t>0&&t<max))return Infinity;const z=o[2]+d[2]*t,y=o[1]+d[1]*t;return Math.abs(z)<5&&y<4?t:Infinity;};
 const W={map:{attacker:[-10,0,0],defender:[10,0,0],sites:{A:[10,0,0]}},nav:{nodes:[[-10,0,0],[10,0,0]],adj:[[1],[0]]},playable:[0,1],allowed:new Set([0,1]),near:x=>x<0?0:1,ground:()=>0,blocked:()=>false,ray:wallRay};
 const s=new SpikeSimulation(W,'five','ascent',()=>.5),a=s.add('A','Jett'),b=s.add('B','Brimstone');s.start(false);s.units=[a,b];b.team=1-a.team;
 for(const [u,x]of [[a,-10],[b,40]])Object.assign(u,{x,y:0,z:0,vx:0,vz:0,alive:true,loading:false,input:{},revealedUntil:0,ch:0});s.phase='game';
 const tick=()=>{s.time+=.05;fogView(s,{t:'s',u:s.rows(),ev:[]},a);};
 const send=p=>{const e={t:'ac',i:b.id,ag:'Brimstone',k:'q',o:[40,1.6,0],d:[-1,0,0],p,ts:9};s.castEvents.push(e);tick();tick();const v=JSON.parse(JSON.stringify(fogCast(s,e,a)));s.castEvents.length=0;return v;};
 calls.length=0;enemy.nid=b.id;
 const hidden=send([38,0,2]);assert.equal(hidden.o,undefined);assert.equal(hidden.p,undefined);c.cast(hidden);assert.equal(calls.length,0,'out of sight: nothing drawn, no position');
 const seen=send([-4,0,0]);assert.equal(seen.o,undefined);assert.deepEqual(seen.p,[-4,0,0]);c.cast(seen);assert.equal(calls.length,1);assert.deepEqual(calls[0].at,[-4,0,0],'in-sight effect drawn at its point');
 assert.ok(!JSON.stringify(hidden).includes('40')&&!JSON.stringify(seen).includes('40'),'the caster x (40) is in neither message');
 console.log('online cast fog: hidden caster eye / aim never sent; effect drawn at p when in sight, nothing without p; whole casts and offline unchanged; real server fogCast');})().catch(e=>{console.error(e);process.exit(1);});
