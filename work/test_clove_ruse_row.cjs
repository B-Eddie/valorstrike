// Clove Ruse online: smoke row with ag 'Clove' -> module dome at the row's age; ended with the row; local own smoke untouched. Real netSyncSmokes source, stub world (not rendered).
const fs=require('fs'),vm=require('vm'),assert=require('assert/strict'),path=require('path');
const src=fs.readFileSync(path.join(__dirname,'server_runtime.js'),'utf8');
const a=src.indexOf('function netSyncSmokes(rows){'),b=src.indexOf('\n',src.indexOf('jRel(s.m);return false;});}',a));assert(a>0&&b>a);
const log=[];const J={smokes:[]};
const ctx=vm.createContext({J,Array,Math,Number,Set,jRel:()=>{},netSmoke0:(x,z,c,tl,y,r)=>{J.smokes.push({p:{x,y,z,set(...v){[this.x,this.y,this.z]=v;}},m:{visible:true,scale:{set(){}}},t:tl,netId:null});},
 cvxRuse:(p,r,l)=>{const h={fx:{}};log.push(['ruse',p.y,r,l]);h.id=log.length;return h;},cvxEnd:h=>log.push(['end',h.id]),omxEnd:()=>log.push(['omxEnd'])});
vm.runInContext(src.slice(a,b)+'\nthis.sync=netSyncSmokes;',ctx);
const row=(o={})=>({kind:'smoke',id:7,p:[5,1.7,5],r:4.15,tl:10,ag:'Clove',age:2.75,...o});
ctx.sync([row()]);assert.equal(log.length,1);assert.equal(log[0][1],0,'centre y minus the 1.7 lift');assert.equal(log[0][3],12.75,'age + tl = full life: reconstructed, not replayed');assert.equal(J.smokes[0].domeFx.fx.age,2.75);assert.equal(J.smokes[0].m.visible,false,'engine mesh hidden, record kept (as offline Ruse)');assert.equal(J.smokes.length,1);
ctx.sync([row({tl:9})]);assert.equal(log.length,1,'one dome per row');
ctx.sync([]);assert.deepEqual(log[1],['end',1],'row gone -> dome ended');
log.length=0;J.smokes.length=0;J.smokes.push({p:{x:5,y:1.7,z:5,set(){}},m:{scale:{set(){}}},t:5,netId:null});ctx.sync([row()]);assert.equal(log.length,0,'smoke already drawn by the local own cast: no second dome');
log.length=0;J.smokes.length=0;ctx.sync([row({ag:undefined})]);assert.equal(log.length,0,'no agent tag: generic smoke only');
console.log('clove ruse row ok (real source, stub world)');
