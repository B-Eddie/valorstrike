// Ally target acquisition must not be range-capped below the enemy bot path. Enemy bots pick
// any LOS target at any range; allies used to hard-cap acquisition at 30u (index.html), so on
// long sightlines defenders killed attackers that never targeted back (observed live: 4 ally
// attackers died for 1 enemy in one natural round on bind). Pin: a sighted enemy at 45u is
// acquired; an unsighted one is not targeted (but stays the nearest fallback).
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict');
const src=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const A='const p = a.g.position, from = a.xFr || (a.xFr = new V()); from.set(p.x, (p.y || 0) + 1.6, p.z);';
const B='a.xTh += 0.1; if (a.xTh <= 0) a.xTh = 0.1;\n    }';
assert(src.includes(A),'ally acquisition block anchor found');
const body=src.slice(src.indexOf(A),src.indexOf(B)+B.length);
class V{constructor(x=0,y=0,z=0){this.x=x;this.y=y;this.z=z;}set(x,y,z){this.x=x;this.y=y;this.z=z;return this;}distanceTo(o){return Math.hypot(o.x-this.x,(o.y||0)-(this.y||0),o.z-this.z);}}
function mk(losResult,enemyDist){
 const a={alive:true,xTh:0,g:{position:new V(0,0,0)}};
 const enemy={alive:true,hp:100,g:{position:new V(enemyDist,0,0)}};
 const ctx={a,bots:[enemy],V,XTK:{q:new V()},los:()=>losResult,running:true,dt:0.016,Math};
 vm.createContext(ctx);
 vm.runInContext(body+';globalThis.out={tg:a.xTg||null,nb:a.xNb||null};',ctx);
 return {a,enemy,out:ctx.out};
}
{const r=mk(true,45);assert.equal(r.out.tg,r.enemy,'sighted enemy at 45u must be acquired (pre-fix 30u cap dropped it)');}
{const r=mk(true,80);assert.equal(r.out.tg,r.enemy,'sighted enemy at 80u must be acquired (symmetric with enemy bots)');}
{const r=mk(false,45);assert.equal(r.out.tg,null,'unsighted enemy not targeted');assert.equal(r.out.nb,r.enemy,'unsighted enemy still the nearest fallback');}
console.log('Ally acquisition: sighted enemies acquired at any range (45u/80u), unsighted not targeted - range parity with enemy bots');
