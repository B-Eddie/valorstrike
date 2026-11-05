// Omen Shrouded Step remote: vanish at origin + arrive at destination only on the server's 'stepdone' event; the relayed cast draws nothing here. Real mpCastFx source, stub world (not rendered).
const fs=require('fs'),vm=require('vm'),assert=require('assert/strict'),path=require('path');
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const ma=html.indexOf('function mpCastFx(m) {'),mb=html.indexOf('\n  if (!MP.cl || MP.st !== "game" || m.i === MP.me',ma);assert(ma>0&&mb>ma);
const log=[];
const ctx=vm.createContext({Array,MP:{me:99,cl:true,st:'game'},xE(e){throw e;},THREE:{Vector3:function(){return {x:0,y:0,z:0};}},mpV:(a,v)=>Object.assign(v,{x:a[0],y:a[1],z:a[2]}),
 omxStepVanish:p=>log.push(['vanish',p.x]),omxStepArrive:p=>log.push(['arrive',p.x]),bots:[],allies:[]});
vm.runInContext(html.slice(ma,mb)+'\n}this.ev=mpCastFx;',ctx);
ctx.ev({sub:'stepdone',ag:'Omen',k:'c',i:3,o:[1,0,1],p:[9,0,9]});assert.deepEqual(log,[['vanish',1],['arrive',9]]);
log.length=0;ctx.ev({ag:'Omen',k:'c',i:3,o:[1,1.6,1],d:[0,0,-1],p:[9,0,9]});assert.equal(log.length,0,'the cast event itself draws nothing (cancel/death stay silent)');
ctx.ev({sub:'stepdone',ag:'Omen',k:'c',i:99,o:[1,0,1],p:[9,0,9]});assert.equal(log.length,0,'own event skipped');
console.log('omen step remote ok (real source, stub world)');
