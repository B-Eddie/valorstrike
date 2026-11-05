// Online Omen Dark Cover: module dome only for a fresh placement (server smoke row age + ag); old rows keep the plain smoke. netSyncSmokes extracted from index.html, world stubbed (not rendered).
const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const html=fs.readFileSync(require('path').join(__dirname,'..','index.html'),'utf8');
const a=html.indexOf('function netSyncSmokes(rows){'),b=html.indexOf('\nfunction ',a+10);assert(a>0&&b>a);
const V=()=>({x:0,y:0,z:0,set(x,y,z){this.x=x;this.y=y;this.z=z;}});
const log=[];let id=0;
const ctx=vm.createContext({Math,Number,Array,J:{smokes:[]},cyxEnd(){},jRel(){},
 netSmoke0(x,z,al,tl,y,r,cyl){ctx.J.smokes.push({m:{visible:true,scale:V()},p:Object.assign(V(),{x,y,z}),t:tl,cb:false,netId:null});},
 omxCoverDome:(p,r,t)=>{log.push([p.x,r,t]);return {id:1};}});
vm.runInContext(html.slice(a,b)+';this.sync=netSyncSmokes;',ctx);
const row=(i,age,ag)=>({kind:'smoke',id:i,o:3,p:[1,2,3],r:4.1,cyl:0,tl:14.5,age,...(ag?{ag}:{})});
ctx.sync([row(1,0.05,'Omen')]);assert.deepEqual(log,[[1,4.1,14.5]],'fresh Omen placement draws the dome');assert.equal(ctx.J.smokes[0].m.visible,false,'plain smoke hidden under the dome');
ctx.sync([row(1,0.2,'Omen')]);assert.equal(log.length,1,'once');
ctx.sync([row(1,0.3,'Omen'),row(2,40,'Omen')]);assert.equal(log.length,1,'old row first seen (late join): no dome replay');assert.equal(ctx.J.smokes[1].m.visible,true);
ctx.sync([row(1,0.3,'Omen'),row(2,41,'Omen'),row(3,0.05)]);assert.equal(log.length,1,'other agents unchanged');
console.log('net omen dark cover dome ok (stub)');
