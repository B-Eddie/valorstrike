// Blade Storm kunai flight speed (user: "kunai projectiles are too slow - set speed to Valorant's (very fast, near-hitscan feel)").
// Valorant (valorant.fandom.com/wiki/Blade_Storm, fetched 2026-10-27): deployment Hitscan - the knife's damage lands on the
// click (jThrow / jBurst / server fireBlade already ray-cast), so the drawn kunai must arrive at once, like a tracer: they flew
// 45 m/s (a 20 m throw drawn for 0.44 s after the hit) and through walls for their fixed life. Now XBTP.spd m/s, stopping at
// the first solid along the aim (where the hitscan knife lands), with a streak that stretches with the speed.
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict');
const root=path.join(__dirname,'..');const THREE=require(require.resolve('three',{paths:[path.join(root,'server')]}));
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const cut=(a,b)=>{const i=html.indexOf(a);assert(i>0,'missing '+a);const j=html.indexOf(b,i);assert(j>i,'missing end of '+a);return html.slice(i,j);};
const cam=new THREE.PerspectiveCamera(70,16/9,0.1,500);cam.position.set(0,1.6,0);cam.updateMatrixWorld(true); // looks down -Z
const added=[];const solids=[];
const ctx=vm.createContext({THREE,Math,solids,camera:cam,scene:{add:o=>added.push(o),remove(){}},
 jBurstDirs:n=>{const o=[];for(let i=0;i<n;i++)o.push((i-(n-1)/2)*2.5*Math.PI/180);return o;},
 xBtpKnife:()=>{const w=new THREE.Group(),k=new THREE.Group();w.add(k);return w;},
 xKunTrail:()=>{const o=new THREE.Mesh(new THREE.ConeGeometry(0.014,0.7,8,1,true),new THREE.MeshBasicMaterial({transparent:true,opacity:.45}));o.rotation.x=-Math.PI/2;o.position.z=-0.42;return o;}});
vm.runInContext(cut('var XBTP = {','\n').replace(/^var /,'var ')+'\n'+cut('function xBtpRange(','\nfunction xBtpPre(').replace(/^function xBtpFpSlots[^\n]*\n/m,''),ctx);
const X=ctx.XBTP;assert.ok(X.spd>=250,'kunai fly >= 250 m/s (hitscan; was 45): '+X.spd);
const wall=(z)=>{const m=new THREE.Mesh(new THREE.BoxGeometry(20,10,0.2),new THREE.MeshBasicMaterial());m.position.set(0,1.5,z);m.updateMatrixWorld(true);solids.length=0;solids.push(m);};
const run=(f)=>{let t=0;while(X.live.includes(f)&&t<2){ctx.xBtpTick(1/120);t+=1/120;}return t;};
// first person: from the fan slot to the crosshair's hit point on a wall 12 m out
wall(-12);const slot=new THREE.Vector3(0.3,1.35,-0.6);ctx.xBtpFlyFP([slot],1,false);let f=X.live[X.live.length-1];assert.ok(f,'FP kunai launched');
const hit=new THREE.Vector3(0,1.6,-11.9);const lifeExp=hit.distanceTo(slot)/X.spd;
assert.ok(Math.abs(f.life-lifeExp)<0.01,'FP life = slot -> crosshair hit / speed: '+f.life.toFixed(3)+' vs '+lifeExp.toFixed(3));
assert.ok(f.life<=0.06,'a 12 m throw is drawn in <= 60 ms (tracer-like): '+f.life.toFixed(3));
const end=new THREE.Vector3();{let t=0;while(t<f.life-1e-9){ctx.xBtpTick(Math.min(1/240,f.life-t));t+=1/240;}end.copy(f.w.position);}
assert.ok(end.z>=-12.05,'stops at the wall, never through it: z '+end.z.toFixed(2));assert.ok(end.distanceTo(hit)<0.6,'lands at the crosshair hit point: '+end.toArray().map(v=>v.toFixed(2)));
run(f);assert.ok(!X.live.includes(f),'gone after landing');
// trail stretches with the speed (a streak, not a 0.7 m cone a frame apart)
wall(-60);ctx.xBtpFlyFP([slot],1,false);f=X.live[X.live.length-1];ctx.xBtpTick(1/60);assert.ok(f.tr.scale.y>=2,'streak stretched at speed: '+f.tr.scale.y.toFixed(2));
assert.ok(Math.abs(f.tr.position.z-(-0.07-0.35*f.tr.scale.y))<1e-6,'streak still starts at the kunai tail');run(f);
// nothing in the way: flies out and is gone within a few tenths of a second
solids.length=0;ctx.xBtpFlyFP([slot],1,false);f=X.live[X.live.length-1];assert.ok(f.life<=0.4,'open air: short life '+f.life.toFixed(2));run(f);
// right-click burst: every kunai, each to its own fanned hit point, all fast
wall(-20);const s5=[0,1,2,3,4].map(i=>new THREE.Vector3(-0.4+i*0.2,1.3,-0.6));const n0=X.live.length;assert.equal(ctx.xBtpFlyFP(s5,5,true),5);
X.live.slice(n0).forEach(k=>{assert.ok(k.life<=0.09,'burst kunai at speed '+k.life.toFixed(3));});X.live.slice(n0).forEach(run);
// third person (remote / bot throws): along the aim, stopped at the first solid
wall(-10);ctx.xBtpFly(null,new THREE.Vector3(0,1.4,0),new THREE.Vector3(0,0,-1),1);f=X.live[X.live.length-1];
assert.ok(Math.abs(f.v.length()-X.spd)<1e-6,'TP kunai at XBTP.spd');assert.ok(f.life<=9.9/X.spd+0.005,'TP kunai stops at the wall 10 m out: life '+f.life.toFixed(3));
console.log('Blade Storm kunai: '+X.spd+' m/s (hitscan), FP to the crosshair hit point, TP to the first solid, streak stretches; burst fanned');
