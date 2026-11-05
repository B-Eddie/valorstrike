// Phoenix Hot Hands online, combined lifecycle: REAL server snapshot rows (server/emit-phoenix-rows.mjs) -> REAL a18NetSync/a18NetFree/MP_ROWFX source (extracted from index.html, world stubbed; not rendered).
// Covers: cast-event copy skipped (no duplicate), fresh row, late join / reconnect at age, early drop, reset, own cast, row after expiry, and that no generic cloud mesh is built for the row.
const fs=require('fs'),vm=require('vm'),cp=require('child_process'),assert=require('assert/strict'),path=require('path');
const rows=JSON.parse(cp.execFileSync('node',[path.join(__dirname,'..','server','emit-phoenix-rows.mjs')],{encoding:'utf8',cwd:path.join(__dirname,'..','server')}).trim().split('\n').pop());
assert.equal(rows.a[0].ag,'Phoenix');assert.ok(rows.a[0].r<rows.b[0].r,'the real row radius grows (this is what the generic cloud would have drawn)');assert.deepEqual(rows.c,[],'row gone after expiry');
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const fa=html.indexOf('function a18NetFree('),fb=html.indexOf('\n',fa),sa=html.indexOf('function a18NetSync(rows) {'),sb=html.indexOf('\nconst a18FxSync0',sa);assert(fa>0&&sa>0&&sb>sa);
const mi=html.indexOf('const MP_ROWFX = '),mj=html.indexOf('\n',mi);
const log=[],ended=[];let n=0,meshes=0;
const ctx=vm.createContext({Math,Number,Array,Object,Map,Set,a18Net:new Map(),MP:{me:99},groundAt:()=>0.1,xE(e){throw e;},jRel(){},
 phxHotHands:(c,R,life,g)=>{const h={id:++n,fx:{age:0}};log.push({id:h.id,R,life,g,h});return h;},phxEnd:(h)=>ended.push(h.id),
 a18NetMesh:()=>{meshes++;return null;},A18VIS:{fire:['cloud',0xff5a1a,.5]}});
vm.runInContext(html.slice(mi,mj)+'\n'+html.slice(fa,fb)+'\n'+html.slice(sa,sb)+';this.sync=a18NetSync;this.rowfx=MP_ROWFX;',ctx);
assert.ok(ctx.rowfx.Phoenix.includes('q')&&ctx.rowfx.Phoenix.includes('c'),'remote Phoenix Hot Hands (q) and Blaze (c) relayed copies are skipped: the rows draw them');
// fresh
ctx.sync(rows.a);assert.equal(log.length,1);assert.equal(log[0].R,4.5);assert.equal(log[0].g,0.75);assert.equal(log[0].h.fx.age,0.1);assert.equal(+log[0].life.toFixed(2),4,'full life = age + tl');assert.equal(meshes,0,'no generic fire cloud built for the Phoenix row');
ctx.sync(rows.b);assert.equal(log.length,1,'one pool per row');
// expiry: row gone -> pool ended
ctx.sync(rows.c);assert.deepEqual(ended,[1],'the pool ends with the row');
// late join / reconnect at age 2.5: reconstructed in its current state, no placement replay
ctx.sync(rows.b);assert.equal(log.length,2);assert.equal(log[1].h.fx.age,2.5,'starts at the row age (past the 0.75 s spread)');assert.equal(+log[1].life.toFixed(2),4);assert.equal(meshes,0);
// early server cancellation (row removed before its life ends)
ctx.sync([]);assert.deepEqual(ended,[1,2],'early drop ends the pool');
// reset: the page clear path frees every record, a later row starts fresh
ctx.sync(rows.a);assert.equal(log.length,3);for(const [,r] of ctx.a18Net)vm.runInContext('a18NetFree',ctx)(r,true);ctx.a18Net.clear();assert.deepEqual(ended,[1,2,3],'reset ends the pool');
ctx.sync(rows.a);assert.equal(log.length,4,'fresh pool after reset');
// own cast: local cast draws it, the row builds nothing
ctx.sync([]);ctx.sync(rows.a.map(r=>({...r,o:99,id:50})));assert.equal(log.length,4,'own row: no second pool');
// other agents' fire rows (Brimstone, no ag) keep the generic path
ctx.sync([{id:77,kind:'fire',o:3,p:[0,0,0],r:3,tl:5}]);assert.equal(log.length,4,'non-Phoenix fire rows untouched by this branch');
console.log('phoenix hot hands rows: real server rows + real client sync/free source ok (stub world, not rendered)');
