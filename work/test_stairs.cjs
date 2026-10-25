// Stair climbing regression for the shared motor (client vendor/valorant-feel.js and server
// motor.cjs are the same file) against native-style capsule/BVH collision: walking climbs stairs
// without jumping, tall boxes still block, jumping/landing and wall contact still behave.
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const T=require(require.resolve('three',{paths:[path.join(__dirname,'../server')]})),B=require(require.resolve('three-mesh-bvh',{paths:[path.join(__dirname,'../server')]})),VF=require('../vendor/valorant-feel.js');
assert.equal(fs.readFileSync(path.join(__dirname,'../vendor/valorant-feel.js'),'utf8'),fs.readFileSync(path.join(__dirname,'../server/src/motor.cjs'),'utf8'),'client and server motors identical');
function mesh(boxes){const geos=[];for(const [x0,x1,y0,y1,z0,z1]of boxes){const g=new T.BoxGeometry(x1-x0,y1-y0,z1-z0);g.translate((x0+x1)/2,(y0+y1)/2,(z0+z1)/2);geos.push(g.toNonIndexed());}let n=0;for(const g of geos)n+=g.attributes.position.array.length;const a=new Float32Array(n);let o=0;for(const g of geos){a.set(g.attributes.position.array,o);o+=g.attributes.position.array.length;}const geo=new T.BufferGeometry();geo.setAttribute('position',new T.BufferAttribute(a,3));return new B.MeshBVH(geo);}
// Same contract as nmHeight / nmBlocked in work/native_maps_runtime.js.
function world(bvh){const Q={box:new T.Box3(),line:new T.Line3(),p:new T.Vector3(),q:new T.Vector3()};
 const ground=(x,z,y)=>{const ray=new T.Ray(new T.Vector3(x,y+.32,z),new T.Vector3(0,-1,0));for(let k=0;k<24;k++){const hit=bvh.raycastFirst(ray,T.DoubleSide);if(!hit)break;if(hit.face.normal.y>.45)return hit.point.y;ray.origin.y=hit.point.y-.005;}return -50;};
 const blocked=(x,z,r,y,h=1.8)=>{const e=.025;Q.line.start.set(x,y+r+e,z);Q.line.end.set(x,y+Math.max(r+e,h-r),z);Q.box.min.set(x-r,y+e,z-r);Q.box.max.set(x+r,y+h,z+r);let b=false;bvh.shapecast({intersectsBounds:bb=>bb.intersectsBox(Q.box),intersectsTriangle:t=>{if(Math.max(t.a.y,t.b.y,t.c.y)<=y+e)return false;if(t.closestPointToSegment(Q.line,Q.p,Q.q)<r-.012){b=true;return true;}return false;}});return b;};
 return {ground,blocked,ceiling:null};}
const floor=[-6,6,-1,0,-12,40];
const run=(w,P,input,seconds,each)=>{for(let t=0;t<seconds;t+=1/60){VF.step(P,input,1/60,w);if(each)each(P,t);}return P;};
for(const rise of [.12,.18,.22,.26,.3,.35]){const n=8,tread=.3,boxes=[floor];for(let i=0;i<n;i++)boxes.push([-2,2,0,rise*(i+1),2+i*tread,2+(i+1)*tread]);boxes.push([-2,2,0,rise*n,2+n*tread,30]);const w=world(mesh(boxes));
 let stall=0,first=null;const P=run(w,{x:0,z:0,y:0,vx:0,vz:0,vy:0},{x:0,z:1,speed:5.4},4,(P,t)=>{if(t>.4&&P.z<2+n*tread&&Math.hypot(P.vx,P.vz)<3)stall++;if(first==null&&P.z>2+n*tread+.5)first=t;});
 assert(Math.abs(P.y-rise*n)<.03,'rise '+rise+': reached the landing ('+P.y.toFixed(2)+')');assert.equal(stall,0,'rise '+rise+': no stalls on the flight');assert(first<2.2,'rise '+rise+': climbs at walking pace ('+first+')');assert(!P.air,'grounded on the landing');
 // and back down, ending grounded at the bottom
 const D=run(w,P,{x:0,z:-1,speed:5.4},4);assert(Math.abs(D.y)<.03&&!D.air,'rise '+rise+': walks back down');}
{const w=world(mesh([floor,[-2,2,0,.6,3,6]]));const P=run(w,{x:0,z:0,y:0,vx:0,vz:0,vy:0},{x:0,z:1,speed:5.4},2);assert(P.y<.01&&P.z<3,'a 0.6 m box still blocks walking');
 const Q=run(w,{x:0,z:-2,y:0,vx:0,vz:0,vy:0},{x:0,z:1,speed:5.4},.75);const J=run(w,Q,{x:0,z:1,speed:5.4,jump:true},.7);assert(Math.abs(J.y-.6)<.03&&J.z>3,'jumping onto the box still works');}
{const w=world(mesh([floor,[1,1.2,0,6,-5,5]]));const P={x:.55,z:0,y:3,vx:0,vz:0,vy:0};let airborne=0;run(w,P,{x:1,z:0,speed:5.4},1,(P)=>{if(P.y>.05&&P.air)airborne++;});assert(airborne>20,'sliding down a wall is airborne, not grounded');assert(P.y<.01&&!P.air,'lands on the floor');}
console.log('Stairs: walking climbs/descends 0.12-0.35 m risers at pace without stalls, 0.6 m boxes block, jumps land, wall contact stays airborne; client/server motors identical');
