// Real offline Harbor-c source + real shared arc, and real private status consumer. Stub world/DOM, not visual acceptance.
const fs=require('fs'),vm=require('vm'),assert=require('assert/strict'),SovaBolt=require('../vendor/sova-bolt.cjs');
const src=fs.readFileSync('work/agents18_runtime.js','utf8'),server=fs.readFileSync('work/server_runtime.js','utf8');
const a=src.indexOf('if (k === "c") { const eye=pEye()'),b=src.indexOf('\n      else if (k === "q")',a);assert(a>0&&b>a);
let queued,ns=[];const bot={alive:true,g:{position:{x:0,y:0,z:-10}},tagT:0};
const player={x:0,y:0,z:-10,hp:100};const p={x:0,y:0,z:0,set(x,y,z){Object.assign(this,{x,y,z});}};
const C={surge:{r:6,near:2,slow:2,wind:.6}};
const ctx=vm.createContext({Math,C,p,J:{},player,bots:[bot],allies:[],P:player,k:'c',d:{x:0,y:0,z:-1},SovaBolt,pEye:()=>({x:0,y:1.6,z:0}),xBoltRay:()=>null,groundAt:()=>0,a18Orb:(point,t,fn)=>queued={p:point,t,fn},a18BotsIn:(q,r)=>Math.hypot(bot.g.position.x-q.x,bot.g.position.z-q.z)<r?[bot]:[],pNs:t=>ns.push(t),say(){},SFX:{ab(){}}});
vm.runInContext(src.slice(a,b),ctx);
const arc=SovaBolt.orb([0,1.6,0],[0,0,-1],()=>null,()=>0);assert.equal(queued.t,arc.t+.6);assert.equal(p.z,arc.end[2]);assert.equal(ns.length,0,'no status before delayed impact callback');
Object.assign(player,{x:p.x,y:p.y,z:p.z});Object.assign(bot.g.position,{x:p.x,y:p.y,z:p.z});queued.fn();assert.deepEqual(ns,[2]);assert.equal(player.tagT,2);assert.equal(player.tagK,.35);assert.equal(bot.tagT,2);assert.equal(bot.tagK,.35);
ctx.J.medGen=1;player.tagT=0;queued.fn();assert.equal(player.tagT,0,'round reset generation cancels stale offline Surge callback');
// online: run the actual wrapper with a private status payload.
const start=server.indexOf('const netRS0=mpCliRS;'),end=server.indexOf('\nconst netHud0=',start);assert(start>0&&end>start);
const near=[];const doc={getElementById:()=>({style:{}})};
const online=vm.createContext({Math,Object,Number,Array,NET:{socket:true},J:{pick:'Harbor'},MP:{},player:{tagT:0},performance:{now:()=>100},netDetainAt:0,xCU:0,mpCliRS(){},pNs:t=>near.push(t),netStatusChips(){},netBlindCss(){},document:doc,say(){},netChannel:null});
vm.runInContext(server.slice(start,end)+';this.consume=mpCliRS;',online);online.consume({status:{nearsight:2,slow:2}});assert.deepEqual(near,[2]);assert.equal(online.player.tagT,2);assert.equal(online.player.tagK,.35);
// both movement paths use xTagK(player) (server has the matching .35 slow multiplier).
const html=fs.readFileSync('index.html','utf8');assert.match(html,/tag:dis\?1:xTagK\(P\)/);assert.match(fs.readFileSync('server/src/spike.js','utf8'),/u\.slowUntil>this\.time\?\.35/);
console.log('surge client contract ok (real sources, real arc, stub world/DOM; no pixels)');
