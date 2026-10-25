const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const T=require('./valorant_rigs').T,Impact=require('../vendor/hit-impact.js')(T);
const scene=new T.Scene(),camera=new T.PerspectiveCamera(50,1,.1,50);camera.position.set(0,1,5);camera.lookAt(0,1,0);camera.updateMatrixWorld(true);
const bone=new T.Object3D();bone.position.set(0,1,0);scene.add(bone);scene.updateMatrixWorld(true);
const fx=new Impact(scene,3),point=new T.Vector3(0,1,.12),matrix=new T.Matrix4(),pos=new T.Vector3();
assert(fx.emit(point,bone));fx.tick(0,camera);fx.cores.getMatrixAt(0,matrix);pos.setFromMatrixPosition(matrix);assert(pos.distanceTo(point)<.03);
bone.position.set(1,.55,0);fx.tick(.01,camera);fx.cores.getMatrixAt(0,matrix);pos.setFromMatrixPosition(matrix);assert(Math.abs(pos.x-1)<.03);assert(Math.abs(pos.y-.55)<.03,'impact follows moving/crouching body part');
assert(fx.cores.material.depthTest);assert(!fx.cores.material.depthWrite,'occlusion without blocking later transparency');
const children=scene.children.length,geometry=fx.shards.geometry;
for(let i=0;i<1000;i++){fx.emit(point,bone,i%2===0);fx.tick(.001,camera);}
assert.equal(fx.items.length,3);assert.equal(scene.children.length,children);assert.equal(fx.shards.geometry,geometry,'no per-hit geometry/material creation');
assert(!fx.emit(new T.Vector3(NaN,0,0),bone));fx.clear();assert(!fx.cores.visible);assert(fx.items.every(e=>e.anchor===null));
fx.emit(point,null,true);for(let i=0;i<4;i++)fx.tick(.1,camera);assert(!fx.shards.visible);fx.dispose();assert.equal(scene.children.length,1);
// Exercise the real gameplay adapter: predicted online contacts cannot claim damage/headshots;
// confirmed events attach once, play UI/audio only for our shot, and reject malformed frames.
const emitted=[],ui=[],c={window:{},THREE:T,BFX:{low:false},scene,camera,XHV:new T.Vector3(),running:true,
 NET:{socket:{}},MP:{st:'game',me:1,nc:false},bots:[{nid:2,g:bone}],allies:[],
 vmHit(...a){ui.push(a)},bfxInit(){},bfxTick(){},xKiReset(){},mpCliSnap(){},vmKill(){},xKiAdd(){},mpIn:n=>n,
 setTimeout(){},performance:{now:()=>0}};
c.window.HitImpact=class{emit(...a){emitted.push(a)}tick(){}clear(){}};vm.createContext(c);vm.runInContext(fs.readFileSync('work/hit_feedback_runtime.js','utf8'),c);
c.vmHit(point,150,true,true,c.bots[0]);assert.equal(ui.length,0);assert.equal(emitted[0][2],false);assert.equal(emitted[0][3],true);
c.netHitFeedback(['h',1,2,1,1,150,0,1.6,.1,1]);assert.equal(ui.length,1);assert.equal(emitted.length,2,'one confirmed burst, no duplicate');assert.equal(emitted[1][2],true);assert.equal(emitted[1][3],false);assert.equal(c.MP.nc,false);
c.netHitFeedback(['h',3,2,0,0,40,0,1,.1,0]);assert.equal(emitted.length,3);assert.equal(ui.length,1,'other shooters do not show my hit confirmation');
for(const e of [['h',1,2,1,0,150,0,NaN,0,1],['h',1,2,1,0,150,0,99,0,1],['h',1,2,1,0,-1,0,1,0,1],['h']])c.netHitFeedback(e);
assert.equal(emitted.length,3);c.NET.socket=null;c.vmHit(point,40,false,false,c.bots[0]);assert.equal(ui.length,2);
console.log('Hit impacts: fixed pool, body-part follow under movement/crouch, occlusion, finite input, expiration/cleanup; prediction vs authoritative confirmation, no duplicate effects or other-shooter UI');
