// Clove Meddle client: the splash plays once on the server's explicit dn:1 impact flag, never on a drop; own casts and other kits' blast rows are untouched. Real a18NetSync source, stub world (not rendered).
const fs=require('fs'),vm=require('vm'),assert=require('assert/strict'),path=require('path');
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const fa=html.indexOf('function a18NetFree('),fb=html.indexOf('\n',fa),sa=html.indexOf('function a18NetSync(rows) {'),sb=html.indexOf('\nconst a18FxSync0',sa);assert(fa>0&&sa>0&&sb>sa);
const log=[],generic=[];
const ctx=vm.createContext({Math,Number,Array,Object,Map,Set,a18Net:new Map(),MP:{me:99},xE(e){throw e;},A18VIS:{blast:['ring',0,1]},a18NetMesh:(k)=>{generic.push(k);return {};},scene:{add(){}},jRel(){},
 cvxMeddleBurst:(p,r)=>log.push(['burst',p.x,r]),hbxSurge:(p,r)=>log.push(['surge',p.x,r])});
vm.runInContext(html.slice(fa,fb)+'\n'+html.slice(sa,sb)+';this.sync=a18NetSync;',ctx);
const row=(o={})=>({id:4,kind:'blast',ag:'Clove',o:3,p:[2,0,3],r:4.5,tl:.4,...o});
ctx.sync([row()]);assert.equal(log.length,0,'in flight: nothing');assert.equal(generic.length,0,'no legacy ring for Clove blast rows');
ctx.sync([row({dn:1,tl:.2})]);assert.deepEqual(log,[['burst',2,4.5]],'splash on dn');ctx.sync([row({dn:1,tl:.1})]);assert.equal(log.length,1,'once');ctx.sync([]);
log.length=0;ctx.sync([row({id:5})]);ctx.sync([]);assert.equal(log.length,0,'a drop without dn (cancel/reset/death) is silent');
ctx.sync([row({id:6,o:99,dn:1})]);assert.deepEqual(log,[['burst',2,4.5]],'owner also draws the authoritative row (offline branch is not run online)');ctx.sync([]);log.length=0;
ctx.sync([row({id:7,ag:'Harbor',dn:1})]);assert.deepEqual(log,[['surge',2,4.5]],'Harbor Storm Surge uses its own module, not Meddle');ctx.sync([]);log.length=0;ctx.sync([row({id:8,ag:'Astra',dn:1})]);assert.equal(log.length,0,'other kits untouched');
console.log('clove meddle client ok (real source, stub world)');
