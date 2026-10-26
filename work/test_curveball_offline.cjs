// Offline Curveball curve (task: match online). The offline/local flare flew straight 6 m along the aim; the server's
// curves (5 m ahead, then 2.5 m to the side: LEFT on FIRE by default, RIGHT with ALT FIRE held). The client now uses
// the same path (phCurve) and the orb travels a quadratic curve through the ahead point, popping at the side point.
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict');
const root=path.join(__dirname,'..');const THREE=require(require.resolve('three',{paths:[path.join(root,'server')]}));
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const cut=(a,b)=>{const i=html.indexOf(a);assert(i>0,'missing '+a);const j=html.indexOf(b,i);assert(j>i,'missing end of '+a);return html.slice(i,j);};
const src=cut('function phCurve(','\n  if (code === "KeyQ")')+'\n}\n';
const tick='function orbTick(dt){'+cut('{ const A = J.orbs, n = A.length;','\n  if (J.dr) drTick(dt);')+'}';
const pops=[];const ctx=vm.createContext({THREE,Math,ray:new THREE.Raycaster(),solids:[],scene:{add(){}},J:{e:2,cd:{e:0},tk:0,orbs:[]},player:{x:0,z:0},yaw:0,
 pEye:()=>new THREE.Vector3(0,1.6,0),jAim:()=>new THREE.Vector3(0,-.3,-1).normalize(),jM:()=>({position:new THREE.Vector3()}),jMat:()=>null,orbGeo:null,blip(){},jRel(){},jPop:p=>pops.push(p.clone()),enPop(){}});
vm.runInContext(cut('const XAB_WIND =','const ABI_M =').replace(/^const /gm,'var ')+src+tick,ctx);
const near=(v,x,y,z,m)=>assert.ok(Math.abs(v.x-x)<1e-6&&Math.abs(v.y-y)<1e-6&&Math.abs(v.z-z)<1e-6,m+': '+v.toArray());
// facing -Z (yaw 0): FIRE curves left (-X), flat at eye height, 5 m ahead then 2.5 m aside
ctx.phKey('KeyE');let o=ctx.J.orbs[0];near(o.c,0,1.6,-5,'ahead point');near(o.b,-2.5,1.6,-5,'FIRE curves left');assert.equal(ctx.J.e,1);
ctx.orbTick(.25);const p=o.m.position;assert.ok(p.x<-.5&&p.z<-2&&p.z>-5,'mid-flight bends left, not on the straight line: '+p.toArray());
ctx.orbTick(.3);assert.equal(ctx.J.orbs.length,0);near(pops[0],-2.5,1.6,-5,'pops at the side point 0.4 s after the cast (0.6 s wiki windup incl. the 0.2 s release)');
// ALT FIRE held: right (+X)
ctx.mpAltHeld=true;ctx.J.cd.e=0;ctx.phKey('KeyE');o=ctx.J.orbs[0];near(o.b,2.5,1.6,-5,'ALT FIRE curves right');ctx.mpAltHeld=false;ctx.orbTick(1);
// walls shorten both legs (0.4 m short), like the server
const wall=new THREE.Mesh(new THREE.BoxGeometry(10,4,.2),new THREE.MeshBasicMaterial());wall.position.set(0,1.5,-3.1);const side=new THREE.Mesh(new THREE.BoxGeometry(.2,4,10),new THREE.MeshBasicMaterial());side.position.set(-1.1,1.5,0);
[wall,side].forEach(m=>m.updateMatrixWorld());ctx.solids.push(wall,side);const c=ctx.phCurve(new THREE.Vector3(0,1.6,0),0,-1,-1);near(c.mid,0,1.6,-2.6,'stops short of the front wall');near(c.end,-.6,1.6,-2.6,'stops short of the side wall');
// facing +X (yaw -90°): left is -Z
ctx.solids.length=0;const c2=ctx.phCurve(new THREE.Vector3(0,1.6,0),1,0,-1);near(c2.end,5,1.6,-2.5,'left of +X is -Z');
// bot flashes (no control point) still fly straight
ctx.J.orbs.push({m:{position:new THREE.Vector3()},a:new THREE.Vector3(0,0,0),b:new THREE.Vector3(4,0,0),t:0,en:true});ctx.orbTick(.25);near(ctx.J.orbs[0].m.position,2,0,0,'straight orb unchanged');
console.log('Offline Curveball: 5 m ahead then 2.5 m left (FIRE) / right (ALT FIRE), wall-clipped legs, curved flight, pop 0.4 s after the cast (0.6 s windup); bot flashes straight');
