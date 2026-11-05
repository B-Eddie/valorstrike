// Real caller functions + real THREE scene/materials, noGL. Dummy body/head, scripted LOS. Not online acceptance.
const fs=require('fs'),vm=require('vm'),assert=require('assert/strict'),h=fs.readFileSync('index.html','utf8');
const c=vm.createContext({console,window:{},document:{},Math,bots:[],J:{rv:[],rvT:0},XRCN:{reveal:.75},XHFU:{rv:1},say(){},xRcnSees:()=>true,xRcnRings(){}});c.self=c;vm.runInContext(fs.readFileSync('work/two-browser/qa/three.min.js','utf8')+';this.THREE=THREE;',c);const T=c.THREE;
const line=a=>h.slice(h.indexOf(a),h.indexOf('\n',h.indexOf(a)));
vm.runInContext(line('const rvMat = ')+line('const svxRvMat = ')+line('function jUnreveal()'),c);
const fn=(a,b)=>h.slice(h.indexOf(a),h.indexOf(b,h.indexOf(a)));
vm.runInContext(fn('function jRcnPulse(p) {','\nconst XLEER')+fn('function xHfRv(list,','\nfunction jBeam()'),c);
const bot=()=>({alive:true,g:new T.Group(),body:new T.Mesh(new T.BoxGeometry(.5,1,.3)),head:new T.Mesh(new T.SphereGeometry(.2))});const b=bot();c.bots=[b];c.b=b;c.p=new T.Vector3();
vm.runInContext('jRcnPulse(p)',c);assert.equal(b.rvO.length,2);assert.equal(b.rvO[0].material.color.getHex(),0xff7a1a);assert.equal(c.J.rvT,.75);vm.runInContext('jUnreveal()',c);assert.equal(b.body.children.length,0);
vm.runInContext('xHfRv([b],1,svxRvMat)',c);assert.equal(b.rvO[0].material.color.getHex(),0xff7a1a);vm.runInContext('jUnreveal();xHfRv([b],1)',c);assert.equal(b.rvO[0].material.color.getHex(),0xff2030,'Cypher tracking helper remains red');
assert(h.includes('xHfRv(hit, undefined, svxRvMat);'));assert(h.includes('xHfRv([b], rv, svxRvMat); }, t * 1000)'));assert(h.includes('xHfRv([b], rv); setTimeout(ping'),'Spycam loop left unchanged');
console.log('Sova Recon/Fury/Owl orange source paths; shared Spycam default red; removal real THREE/noGL');
