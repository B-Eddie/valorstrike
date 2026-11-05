// Phoenix Run It Back client: marker is a row-bound state (a18NetSync 'rib'), bursts come from the explicit return / retdeath cast events (mpCastFx). Real source extracted from index.html, world stubbed (not rendered).
const fs=require('fs'),vm=require('vm'),assert=require('assert/strict'),path=require('path');
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const fa=html.indexOf('function a18NetFree('),fb=html.indexOf('\n',fa),sa=html.indexOf('function a18NetSync(rows) {'),sb=html.indexOf('\nconst a18FxSync0',sa);
const ma=html.indexOf('function mpCastFx(m) {'),mb=html.indexOf('\n  if (!MP.cl || MP.st !== "game" || m.i === MP.me',ma);assert(fa>0&&sa>0&&ma>0&&mb>ma);
const log=[],ended=[];let n=0;
const V=()=>({x:0,y:0,z:0});
const ctx=vm.createContext({Math,Number,Array,Object,Map,Set,a18Net:new Map(),MP:{me:99,cl:true,st:'game'},xE(e){throw e;},THREE:{Vector3:function(){return V();}},mpV:(a,v)=>Object.assign(v,{x:a[0],y:a[1],z:a[2]}),
 phxRibMarker:(p,ttl)=>{const h={id:++n,fx:{}};log.push(['marker',p.x,+ttl.toFixed(2)]);return h;},phxEnd:h=>ended.push(h.id),phxRibReturn:p=>log.push(['return',p.x]),phxRibDeath:p=>log.push(['death',p.x]),A18VIS:{},a18NetMesh(){throw new Error('generic mesh')}});
vm.runInContext(html.slice(fa,fb)+'\n'+html.slice(sa,sb)+'\n'+html.slice(ma,mb)+'\n}'+';this.sync=a18NetSync;this.ev=mpCastFx;',ctx);
const row=(tl,o)=>[{id:5,kind:'rib',o:o??3,p:[2,0,3],r:0,tl}];
ctx.sync(row(9.8));assert.deepEqual(log,[['marker',2,9.8]]);ctx.sync(row(9.7));assert.equal(log.length,1,'one marker per row');
ctx.sync([]);ctx.a18Net.size===0&&0;assert.deepEqual(ended,[1],'marker ends when the row drops (return / death / reset)');
log.length=0;ctx.sync(row(4.2));assert.deepEqual(log,[['marker',2,4.2]],'late join: marker rebuilt with the remaining time');ctx.sync([]);
log.length=0;ctx.sync(row(9,99));assert.equal(log.length,0,'own row: the local ult draws its own');ctx.sync([]);
log.length=0;ctx.ev({sub:'return',ag:'Phoenix',k:'x',i:3,p:[2,0,3],o:[2,0,3]});assert.deepEqual(log,[['return',2]],'time-out return: burst at the marker only');
log.length=0;ctx.ev({sub:'retdeath',ag:'Phoenix',k:'x',i:3,p:[2,0,3],o:[8,0,3]});assert.deepEqual(log,[['return',2],['death',8]],'died: return at the marker + death burst where the body was lost');
log.length=0;ctx.ev({sub:'return',ag:'Phoenix',k:'x',i:99,p:[2,0,3],o:[2,0,3]});assert.equal(log.length,0,'own return event: local draws it');
console.log('phoenix run it back client ok (real source, stub world, not rendered)');
