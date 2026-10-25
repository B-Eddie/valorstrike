// Stair riser test across cracks (shared motor: vendor/valorant-feel.js = server/src/motor.cjs).
// Map sweep (server/tools/map-sweep.mjs): on Ascent's attacker-spawn back the stone slabs sit a few cm apart over a
// lower floor; a capsule blocked by a 2-6 cm slab lip lifts and runs the riser look-ahead, which dropped its reference
// into the crack between two slabs and then saw the next slab as a 0.46 m "riser": an invisible wall on flat floor
// (17 nav edges on Ascent, Bind, Haven: `riserDip`). Now a dip never lowers the reference.
// Checks on a synthetic 1-D floor (profile along x, the same at every z): flat slabs with a 0.4 m deep crack and a
// 5 cm lip pass; a 0.6 m box is still refused with or without a crack in front of it; 0.2 m stairs pass up and down;
// a box after going down stairs is refused once the capsule reaches it.
const assert=require('assert/strict'),fs=require('fs'),path=require('path'),vm=require('vm');
const root=path.join(__dirname,'..'),vendor=fs.readFileSync(path.join(root,'vendor/valorant-feel.js'),'utf8');
assert.equal(vendor,fs.readFileSync(path.join(root,'server/src/motor.cjs'),'utf8'),'client and server motor are the same file');
const ctx={Math,Number,Infinity,Map,globalThis:null,window:null};ctx.globalThis=ctx.window=ctx;vm.createContext(ctx);vm.runInContext(vendor,ctx);const VF=ctx.ValorantFeel;
// World from a height profile h(x): solid columns up to h, open above. ground = highest top at or below the ray start
// (y + .32), blocked = any column top inside the capsule's x span above its feet.
function world(h){const top=x=>h(Math.round(x*100)/100);return {
 ground:(x,z,y)=>{const t=top(x);return t<=y+.32?t:-Infinity;},
 blocked:(x,z,r,y,height=1.8)=>{for(let s=x-r;s<=x+r+1e-9;s+=.01){const t=top(s);if(t>y+.025&&y+height>-50)return true;}return false;},
 ceiling:()=>false};}
function walk(h,x0,dir,T=1.2){const w=world(h),P={x:x0,z:0,y:w.ground(x0,0,5),vx:0,vz:0,vy:0,ch:0};for(let t=0;t<T;t+=1/30)VF.step(P,{x:dir,z:0,speed:6.75},1/30,w);return P;}
// 1. Flat slabs, a 0.2 m crack 0.4 m deep at x 1.0..1.2, the far slab 5 cm higher (the Ascent spawn floor)
const crack=x=>x>=1&&x<1.2?-.4:x>=1.2?.05:0;
let P=walk(crack,0,1);assert(P.x>3,'crossed the crack onto the 5 cm higher slab (x '+P.x.toFixed(2)+')');assert(Math.abs(P.y-.05)<.03,'standing on the far slab, y '+P.y.toFixed(3));
P=walk(crack,4,-1);assert(P.x<.5,'crossed back the other way (x '+P.x.toFixed(2)+')');
// a crack 0.6 m deep, far slab level with the near one
P=walk(x=>x>=1&&x<1.15?-.6:x>=1.15?.04:0,0,1);assert(P.x>3,'crossed a deeper crack with a 4 cm lip (x '+P.x.toFixed(2)+')');
// 2. A 0.6 m box is a wall, with or without a crack in front of it
P=walk(x=>x>=1?.6:0,0,1);assert(P.x<1&&P.y<.05,'refused the 0.6 m box (x '+P.x.toFixed(2)+', y '+P.y.toFixed(2)+')');
P=walk(x=>x>=1&&x<1.2?-.4:x>=1.2?.6:0,0,1);assert(P.x<1.2&&P.y<.05,'refused the 0.6 m box behind a crack (x '+P.x.toFixed(2)+', y '+P.y.toFixed(2)+')');
// 3. Stairs: 0.2 m risers every 0.3 m, up and down
const stairs=x=>x<1?0:x<4?.2*Math.ceil((x-1+1e-9)/.3):2;
P=walk(stairs,0,1,2.5);assert(P.x>4.5&&Math.abs(P.y-2)<.05,'walked up the stairs (x '+P.x.toFixed(2)+', y '+P.y.toFixed(2)+')');
P=walk(stairs,5,-1,2.5);assert(P.x<.5&&Math.abs(P.y)<.05,'walked down the stairs (x '+P.x.toFixed(2)+', y '+P.y.toFixed(2)+')');
// 4. Down a 0.35 m step onto a 1.5 m wide floor, then a 0.6 m box (0.25 m above the start floor): the box is refused when the capsule reaches it
P=walk(x=>x<1?0:x<2.5?-.35:.25,0,1,2);assert(P.x<2.5&&P.x>1.5&&Math.abs(P.y+.35)<.05,'stopped at the box below the step (x '+P.x.toFixed(2)+', y '+P.y.toFixed(2)+')');
console.log('PASS riser across cracks: slabs with a crack + lip crossed both ways, 0.6 m boxes refused (with/without crack, after a step down), stairs up/down');
