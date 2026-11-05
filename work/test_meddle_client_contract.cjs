// Real offline Clove Q source, real Class 3 path + shared debt; stub world, not rendered.
const fs=require('fs'),vm=require('vm'),assert=require('assert/strict'),SovaBolt=require('../vendor/sova-bolt.cjs'),MeddleDecay=require('../vendor/meddle-decay.cjs');
const src=fs.readFileSync('work/agents18_runtime.js','utf8'),a=src.indexOf('if (k === "q") { const eye=pEye()'),b=src.indexOf('\n      else if (k === "e")',a);assert(a>0&&b>a);
let q;const player={hp:100,x:0,y:0,z:0},bot={hp:100,alive:true,g:{position:{x:0,y:0,z:0}}},ally={hp:100,alive:true,g:{position:{x:0,y:0,z:0}}};
class V{constructor(x,y,z){Object.assign(this,{x,y,z});}set(x,y,z){Object.assign(this,{x,y,z});}}
const p=new V(0,0,0),ctx=vm.createContext({Math,k:'q',C:{meddle:{r:4,decay:90,wind:.75}},p,d:{x:0,y:0,z:-1},pEye:()=>new V(0,1.6,0),SovaBolt,MeddleDecay,xBoltRay:()=>null,groundAt:()=>0,a18Orb:(p,t,fn)=>q={p,t,fn},bots:[bot],allies:[ally],player,J:{medClock:1},THREE:{Vector3:V},los:()=>true,cvxMeddleBurst(){}});
vm.runInContext(src.slice(a,b),ctx);const fl=SovaBolt.orb([0,1.6,0],[0,0,-1],()=>null,()=>0);assert.equal(q.t,fl.t+.75);assert.equal(p.z,fl.end[2]);for(const u of [player,bot.g.position,ally.g.position])Object.assign(u,{x:p.x,y:0,z:p.z});q.fn();for(const u of [player,bot,ally]){assert.ok(u.medDecay);MeddleDecay.tick(u,1.75,true,100);assert.equal(u.hp,10);MeddleDecay.tick(u,6,true,100);assert.equal(u.hp,100);}
assert.match(src,/MeddleDecay.tick\(u,J.medClock/);assert.match(src,/function a18Reset\(\).*u.medDecay=null/);
console.log('meddle offline contract ok (real sources, stub world)');
