// Hit sparks must be readable on screen like Valorant's (user 19:51 2026-10-26: "the hit / damage feedback with sparks
// isn't showing"). The pooled hit VFX (vendor/hit-impact.js) fired on every hit but was drawn 2-6 cm wide: a body puff at
// 15 m covered ~2 px of a 1080p screen for 0.2 s, i.e. nothing, while a bullet into a wall got a 12-30 cm spark.
// Valorant (patch 1.07, Riot "hit impact VFX update"): a clearly visible burst on the struck body part, a predicted
// spark at the contact point, the head variant scaled down but still visible.
// Checked with the game's camera (75 deg vertical FOV) on a 1920x1080 screen, after one 16 ms tick:
//  * body confirm: core >= 15 px at 5 m, >= 8 px at 15 m and at 30 m; the burst (core + streaks) >= 20 px at 15 m; lives >= 0.2 s
//  * head confirm: smaller than body, core >= 5 px at 15 m
//  * predicted spark: >= 3 px at 15 m
//  * drawn >= 0.25 m in front of the hit point toward the eye, so the agent model it is attached to never buries it
//  * on-screen position stays on the hit point (pulled along the eye ray only)
const path=require('path'),assert=require('assert/strict');
const T=require(require.resolve('three',{paths:[path.join(__dirname,'..','server')]}));
const Impact=require('../vendor/hit-impact.js')(T),H=1080,FOV=75;
const cam=new T.PerspectiveCamera(FOV,16/9,.05,200);cam.position.set(0,1.6,0);cam.lookAt(0,1.4,-10);cam.updateMatrixWorld(true);
const pxPerM=d=>H/(2*d*Math.tan(FOV/2*Math.PI/180));
function shot(dist,head,predicted){const scene=new T.Scene(),fx=new Impact(scene,4),p=new T.Vector3(0,1.3,-dist);
 fx.emit(p,predicted?null:new T.Object3D(),head,predicted);fx.tick(.016,cam);
 const m=new T.Matrix4(),pos=new T.Vector3(),q=new T.Quaternion(),s=new T.Vector3();fx.cores.getMatrixAt(0,m);m.decompose(pos,q,s);
 let reach=s.x/2;for(let j=0;j<8;j++){const sm=new T.Matrix4(),sp=new T.Vector3(),ss=new T.Vector3();fx.shards.getMatrixAt(j,sm);sm.decompose(sp,q,ss);if(ss.x>0)reach=Math.max(reach,sp.distanceTo(pos)+ss.x/2);}
 const d=pos.distanceTo(cam.position),toEye=p.distanceTo(cam.position)-d;
 const a=p.clone().project(cam),b=pos.clone().project(cam);
 return {core:s.x*pxPerM(d),burst:2*reach*pxPerM(d),toEye,drift:Math.hypot((a.x-b.x)*960,(a.y-b.y)*540),life:fx.items[0].life};}
const r={b5:shot(5,false,false),b15:shot(15,false,false),b30:shot(30,false,false),h15:shot(15,true,false),s15:shot(15,false,true)};
const f=n=>n.toFixed(1);
console.log('hit VFX on a 1080p screen: body core 5/15/30 m',f(r.b5.core),f(r.b15.core),f(r.b30.core),'px, burst 15 m',f(r.b15.burst),'px; head core 15 m',f(r.h15.core),'px; spark',f(r.s15.core),'px; pulled toward eye',r.b15.toEye.toFixed(2),'m');
assert.ok(r.b5.core>=15,`body puff at 5 m is ${f(r.b5.core)} px (want >= 15)`);
assert.ok(r.b15.core>=8,`body puff at 15 m is ${f(r.b15.core)} px (want >= 8)`);
assert.ok(r.b30.core>=8,`body puff at 30 m is ${f(r.b30.core)} px (want >= 8)`);
assert.ok(r.b15.burst>=20,`body burst at 15 m spans ${f(r.b15.burst)} px (want >= 20)`);
assert.ok(r.b15.life>=.2,`body puff lives ${r.b15.life} s (want >= 0.2)`);
assert.ok(r.h15.core>=5&&r.h15.core<r.b15.core,`head puff ${f(r.h15.core)} px: visible and smaller than body ${f(r.b15.core)}`);
assert.ok(r.s15.core>=3,`predicted spark ${f(r.s15.core)} px (want >= 3)`);
for(const k of ['b5','b15','b30','h15'])assert.ok(r[k].toEye>=.25,`${k}: drawn ${r[k].toEye.toFixed(3)} m in front of the hit point (want >= 0.25 m)`);
for(const k in r)assert.ok(r[k].drift<1,`${k}: on-screen drift ${f(r[k].drift)} px off the hit point`);
console.log('Hit VFX visible like Valorant: body burst readable at 5-30 m, smaller head variant, predicted spark, drawn in front of the struck model');
