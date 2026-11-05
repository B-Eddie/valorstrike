// Remote Phoenix Hot Hands: the mpFx 'fire' branch attaches the module pool (phxHotHands) for non-auth Phoenix casts only. Source extracted from index.html, world stubbed (not rendered).
const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const html=fs.readFileSync(require('path').join(__dirname,'..','index.html'),'utf8');
const a=html.indexOf('  else if (ty === "fire") { const rz = false'),b=html.indexOf('\n  else if (ty === "wall")',a);assert(a>0&&b>a);
const src=html.slice(a,b).replace(/^  else if/,'if');
const V=()=>({x:0,y:0,z:0,copy(){return this;},set(x,y,z){this.x=x;this.y=y;this.z=z;return this;},clone(){return V();},y0:0});
const run=(over)=>{const log=[],m={visible:true,rotation:{},position:{copy(){}},scale:{setScalar(){}}};
 const ctx=vm.createContext(Object.assign({ty:'fire',ag:'Phoenix',nd:true,en:true,u:{},p:{x:1,y:0,z:2},tg:()=>({x:1,z:2}),mpTgt:()=>({x:1,z:2}),up:{x:0,y:0,z:0},d:{x:0,z:1},o:{},MPC:{d:{set(){return {normalize(){return {};}};}}},THREE:{Vector3:function(x,y,z){return Object.assign(V(),{x,y,z});}},zoneGeo:{},hhMat:()=>({}),fireMat:()=>({}),jM:()=>m,scene:{add(){}},J:{zones:[]},XHOT:{life:4,r:4.5,grow:.75},phxHotHands:(c,R,l,g)=>{log.push([R,l,g]);return {fx:1};}},over));
 vm.runInContext(src,ctx);return {log,m,zones:ctx.J.zones.length};};
let r=run({});assert.deepEqual(r.log,[[4.5,4,.75]]);assert.equal(r.m.visible,false,'plain zone mesh hidden under the module pool (as the player\'s own)');assert.equal(r.zones,1,'the zone logic is untouched');
r=run({nd:false});assert.equal(r.log.length,0,'authoritative host path: legacy zone only');
r=run({ag:'Brimstone'});assert.equal(r.log.length,0,'other agents unchanged');
r=run({phxHotHands:()=>null});assert.equal(r.m.visible,true,'module failure keeps the legacy zone');
console.log('phoenix remote hot hands module pool ok (stub)');
