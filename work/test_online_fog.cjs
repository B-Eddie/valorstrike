// Online fog of war, client side (qa-23): a server row flagged hidden ([22] = 1, server/src/fog.js fogRow) keeps the enemy
// known but takes its model out of the scene, empties its interpolation buffer and sets u.fog, without moving it toward the
// row's zeroed position; the first relevant row brings it back at its real position. Runs the page's real mpCliSnap
// (index.html) under work/server_runtime.js netFogPre / netFogPost / the mpMkUnit wrapper. Also: shots, the minimap and
// name tags skip a fogged enemy (index.html).
const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict'),path=require('path');
const root=path.join(__dirname,'..'),page=fs.readFileSync(path.join(root,'index.html'),'utf8'),rt=fs.readFileSync(path.join(root,'work/server_runtime.js'),'utf8');
const base=page.slice(page.indexOf('function mpCliSnap(m) {'),page.indexOf('function mpCliSelf(e) {'));
const fog=rt.slice(rt.indexOf('function netFogPre('),rt.indexOf('// Online soul resources'));
assert.ok(base.length>500&&fog.includes('netFogPost'),'slices found');
const live=new Set();const V=()=>({x:0,y:0,z:0,set(x,y,z){this.x=x;this.y=y;this.z=z;return this;}});
const scene={add(g){live.add(g);g.parent=scene;},remove(g){live.delete(g);if(g.parent===scene)g.parent=null;}};
const c={running:true,MP:{st:'game',me:1,team:0,m5:1},NET:{socket:{}},FV:{tdm:0},performance:{now:()=>c.now},now:0,timeLeft:0,bots:[],allies:[],SB:{},XAG:{Jett:1,Sova:1},XBA:{},scene,
 mpClean:n=>n,mpRename(){},mpDropModel(){},mpCliKD(){},showStats(){},kfeed(){},feed(){},say(){},mpIn:n=>n,mpCliSelf(){},SFX:{at(){c.shots++;}},shots:0,WEAP:{Vandal:{}},
 dmLive(u){if(u.g.parent!==scene)scene.add(u.g);},
 mpMkUnit(e,ally){const g={position:V(),rotation:{y:0},parent:null};scene.add(g);g.position.set(e[4],e[5]||0,e[6]);const u={g,nid:e[0],name:e[2],agent:e[3],alive:!!e[10],hp:e[8],nb:[],tm:e[1]};if(!u.alive)scene.remove(g);return u;},
 Array,Math,Object,Set,Map,Number,JSON};
vm.createContext(c);vm.runInContext(base+';'+fog+';globalThis.snap=m=>mpCliSnap(m);',c);
const R=(id,team,x,z,hidden,alive=1)=>{const r=[id,team,'P'+id,'Jett',hidden?0:x,0,hidden?0:z,hidden?0:1.2,hidden?100:80,0,alive,'Vandal',0,0,1,25,50,0,0,0,0,-1];if(hidden)r[22]=1;return r;};
const unit=id=>c.bots.concat(c.allies).find(u=>u.nid===id);
// 1. first sight of a hidden enemy (created from a hidden row): known (scoreboard) but not in the scene
c.now=1000;c.snap({u:[R(1,0,0,0),R(2,0,-5,0),R(7,1,0,0,true)],ev:[]});const e=unit(7);assert.ok(e&&c.bots.includes(e),'enemy known');assert.equal(e.fog,1);assert.ok(!live.has(e.g),'not drawn');assert.equal(e.nb.length,0);assert.ok(live.has(unit(2).g),'ally drawn');
// 2. it becomes relevant: drawn at its real position, interpolation restarts there
c.now=1050;c.snap({u:[R(1,0,0,0),R(2,0,-5,0),R(7,1,12,-3)],ev:[]});assert.equal(e.fog,0);assert.ok(live.has(e.g),'drawn again');assert.deepEqual([e.g.position.x,e.g.position.z],[12,-3]);assert.equal(e.nb.length,1);assert.equal(e.nb[0].x,12);
c.now=1100;c.snap({u:[R(1,0,0,0),R(2,0,-5,0),R(7,1,13,-3)],ev:[]});assert.equal(e.nb.length,2);
// 3. hidden again: no jump toward 0,0,0 (no zero sample in the buffer), out of the scene, still alive and listed
c.now=1150;c.snap({u:[R(1,0,0,0),R(2,0,-5,0),R(7,1,0,0,true)],ev:[['s',7,'Vandal']]});assert.equal(e.fog,1);assert.ok(!live.has(e.g));assert.equal(e.nb.length,0,'no samples while hidden');assert.equal(e.alive,true,'still alive (alive pips)');assert.ok(c.bots.includes(e),'still listed');
assert.notEqual(e.g.position.x,0,'drawn position not pulled to the zeroed row');assert.equal(c.shots,0,'no shot sound at a stale position');
// 4. dies while hidden, respawns while hidden (DM / next round): stays out of the scene until relevant
c.now=1200;c.snap({u:[R(1,0,0,0),R(7,1,0,0,true,0)],ev:[]});assert.equal(e.alive,false);c.now=1250;c.snap({u:[R(1,0,0,0),R(7,1,0,0,true,1)],ev:[]});assert.equal(e.alive,true);assert.ok(!live.has(e.g),'respawned hidden: not drawn');
c.now=1300;c.snap({u:[R(1,0,0,0),R(7,1,4,4)],ev:[]});assert.ok(live.has(e.g));assert.deepEqual([e.g.position.x,e.g.position.z],[4,4]);
// 5. offline (no server socket): rows are never treated as fog
c.NET.socket=null;c.now=1350;c.snap({u:[R(1,0,0,0),R(7,1,5,5)],ev:[]});assert.ok(live.has(e.g));c.NET.socket={};
// 6. the page skips fogged enemies for shots, the minimap and name tags; the server row validator accepts hidden rows
assert.ok(page.includes('if (b.alive && !b.fog) { targets.push(b.body); targets.push(b.head); }'),'shot targets skip fogged');
assert.ok(page.includes('bots.forEach((b) => { if (!b.alive || b.fog) return;'),'minimap skips fogged');
assert.ok(page.includes('if (!u.hum || !u.alive || !u.g || u.fog) continue;'),'name tags skip fogged');
assert.ok(page.includes(fog.trim().slice(0,200)),'index.html regenerated with netFog');
console.log('test_online_fog: ok');
