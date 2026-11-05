// Online Omen Dark Cover: module dome only for a fresh placement (server smoke row age + ag); old rows keep the plain smoke. netSyncSmokes extracted from index.html, world stubbed (not rendered).
const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const html=fs.readFileSync(require('path').join(__dirname,'..','index.html'),'utf8');
const a=html.indexOf('function netSyncSmokes(rows){'),b=html.indexOf('\nfunction ',a+10);assert(a>0&&b>a);
const V=()=>({x:0,y:0,z:0,set(x,y,z){this.x=x;this.y=y;this.z=z;}});
const log=[],ended=[];
const ctx=vm.createContext({Math,Number,Array,J:{smokes:[]},cyxEnd(){},jRel(){},omxEnd:(h)=>ended.push(h.id),
 netSmoke0(x,z,al,tl,y,r,cyl){ctx.J.smokes.push({m:{visible:true,scale:V()},p:Object.assign(V(),{x,y,z}),t:tl,cb:false,netId:null});},
 omxCoverDome:(p,r,t)=>{const h={id:log.length+1,fx:{age:0}};log.push([p.x,r,t,h]);return h;}});
vm.runInContext(html.slice(a,b)+';this.sync=netSyncSmokes;',ctx);
const row=(i,age,ag)=>({kind:'smoke',id:i,o:3,p:[1,2,3],r:4.1,cyl:0,tl:14.5,age,...(ag?{ag}:{})});
// fresh placement: dome starts at age 0 with the full life
ctx.sync([row(1,0.05,'Omen')]);assert.equal(log.length,1);assert.equal(log[0][2],14.55,'full life = age + tl');assert.equal(log[0][3].fx.age,0.05);
assert.equal(ctx.J.smokes[0].m.visible,true,'legacy smoke body stays as the occluder (no hiding until pixel-proven)');
ctx.sync([row(1,0.2,'Omen')]);assert.equal(log.length,1,'once per row');
// late join / reconnect: row first seen at age 9 -> reconstructed in its current state (past the grow transient, remaining life tl)
ctx.sync([row(1,0.3,'Omen'),row(2,9,'Omen')]);assert.equal(log.length,2,'late join: dome reconstructed, not skipped');assert.equal(log[1][3].fx.age,9,'starts at the row age: no placement grow replay');assert.equal(log[1][2],23.5,'ends when the server row ends (age+tl)');
// early drop: the dome ends with the row
ctx.sync([row(2,9.5,'Omen')]);assert.deepEqual(ended,[1],'row 1 dropped early: its dome is ended');
ctx.sync([]);assert.deepEqual(ended,[1,2],'all rows gone: dome 2 ended');
// reset path: a row set replaced by an empty round (J.smokes cleared by the page reset + omxReset) leaves no dome bound to a later row
ctx.J.smokes=[];ctx.sync([row(3,0.1,'Omen')]);assert.equal(log.length,3,'a new row after reset gets a fresh dome');
// other agents and rows without ag unchanged
ctx.sync([row(3,0.2,'Omen'),row(4,0.05)]);assert.equal(log.length,3);
console.log('net omen dark cover dome ok (stub)');
