// Real module construction with the REAL three.js (no WebGL): each new kit's module entry points build, tick through their lifetime
// and end without throwing and without leaving objects in the scene. Proves construction/lifecycle only, NOT appearance, yaw or shader compile.
const fs=require('fs'),vm=require('vm'),path=require('path'),assert=require('assert/strict');
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const three=fs.readFileSync(path.join(__dirname,'two-browser','qa','three.min.js'),'utf8');
const c2d=new Proxy({},{get:(o,k)=>k==='createRadialGradient'||k==='createLinearGradient'?()=>({addColorStop(){}}):k==='measureText'?()=>({width:1}):k==='getImageData'?()=>({data:new Uint8ClampedArray(4)}):()=>{},set:()=>true});
const mkCanvas=()=>({width:64,height:64,style:{},getContext:()=>c2d,addEventListener(){},toDataURL:()=>''});
const document={createElement:t=>t==='canvas'?mkCanvas():{style:{},appendChild(){},remove(){},setAttribute(){}},getElementById:()=>null,querySelectorAll:()=>[],body:{appendChild(){}},addEventListener(){}};
const errs=[];let nowv=0;
const ctx=vm.createContext({document,window:{},navigator:{userAgent:'node'},performance:{now:()=>nowv},console,Math,Date,setTimeout,clearTimeout,requestAnimationFrame:()=>0,cancelAnimationFrame(){},xE:e=>errs.push(String(e&&e.stack||e)),player:{x:0,y:0,z:0},camera:{position:{x:0,y:2,z:0}},innerWidth:800,innerHeight:600});
ctx.self=ctx;ctx.globalThis=ctx;
vm.runInContext(three+';this.THREE=THREE;',ctx);
const T=ctx.THREE;ctx.scene=new T.Scene();

const htmlV=html.slice(html.indexOf('// ---- VETO FX ----'),html.indexOf('// ---- END VETO FX ----'));
document.head={appendChild(){}};vm.runInContext(htmlV,ctx);ctx.NET={socket:{}};ctx.J={pick:'Veto'};ctx.player={hp:100};
const a=html.indexOf('var a18EvoVeil = null;'),b=html.indexOf('const a18ClearFx0',a);vm.runInContext(html.slice(a,b),ctx);
ctx.a18EvoSync({evo:7});assert(ctx.a18EvoVeil);assert.equal(ctx.vtxLive.length,1);
ctx.a18EvoSync({evo:3});assert.equal(ctx.vtxLive.length,1);assert.equal(ctx.a18EvoVeil.fx.age,4);
ctx.a18EvoSync({evo:0});assert.equal(ctx.a18EvoVeil,null);assert.equal(ctx.vtxLive.length,0);
ctx.a18EvoSync({evo:2});ctx.vtxTick(2.1);assert.equal(ctx.vtxLive.length,0);ctx.a18EvoSync({evo:1});assert.equal(ctx.vtxLive.length,1,'rebuild expired handle');
ctx.J.pick='Sova';ctx.a18EvoSync({evo:1});assert.equal(ctx.vtxLive.length,0,'noncaster no veil');
ctx.J.pick='Veto';ctx.player.hp=0;ctx.a18EvoSync({evo:5});assert.equal(ctx.vtxLive.length,0,'dead no veil');
ctx.player.hp=100;ctx.a18EvoSync({evo:5});ctx.NET.socket=null;ctx.a18EvoSync({evo:5});assert.equal(ctx.vtxLive.length,0,'offline clear');
const h=ctx.vtxEvolution({x:0,y:0,z:0},12,{local:true});assert.equal(ctx.vtxLive.length,2);h.end();assert.equal(ctx.vtxLive.length,0,'combined handle ends veil and world shards');
assert.deepEqual(errs,[]);console.log('Veto authoritative owner veil duration/clear/death/noncaster/expiry + combined cleanup: PASS');

// Execute the actual cast handler. This branch must not need a currently visible remote body.
ctx.MP={me:1,cl:true,st:'game'};
const ci=html.indexOf('function mpCastFx(m)'),cj=html.indexOf('function mpBolt(m)',ci);vm.runInContext(html.slice(ci,cj),ctx);
ctx.mpCastFx({ag:'Veto',k:'x',i:2,o:[4,3.6,6]});assert.equal(ctx.vtxLive.length,1);
assert.equal(ctx.vtxLive[0].objs[0].position.y,2);assert.equal(ctx.vtxLive[0].objs[0].position.x,4);
ctx.vtxReset();ctx.mpCastFx({ag:'Veto',k:'x',i:1,o:[4,3.6,6]});assert.equal(ctx.vtxLive.length,0,'own cast no world replay');
ctx.mpCastFx({ag:'Veto',k:'x',i:2,o:[NaN,3,6]});assert.equal(ctx.vtxLive.length,0);
ctx.MP.st='lobby';ctx.mpCastFx({ag:'Veto',k:'x',i:2,o:[4,3,6]});assert.equal(ctx.vtxLive.length,0);
console.log('Veto actual remote cast world-only/position/owner/invalid/state: PASS');

ctx.MP.st='game';ctx.mpV=(a)=>new ctx.THREE.Vector3(...a);
ctx.mpCastFx({ag:'Veto',k:'c',i:2,sub:'stepout',p:[3,0,4]});assert.equal(ctx.vtxLive.length,1,'one origin not both');
ctx.vtxReset();ctx.mpCastFx({ag:'Veto',k:'c',i:2,sub:'stepin',p:[5,0,6]});assert.equal(ctx.vtxLive.length,1,'one destination not both');
ctx.vtxReset();ctx.mpCastFx({ag:'Veto',k:'c',i:2,sub:'stepout',fog:1});assert.equal(ctx.vtxLive.length,0,'hidden point absent');
ctx.mpCastFx({ag:'Veto',k:'c',i:1,sub:'stepin',p:[5,0,6]});assert.equal(ctx.vtxLive.length,2,'caster arrival adds own veil');
ctx.vtxReset();ctx.mpCastFx({ag:'Veto',k:'c',i:2,p:[5,0,6]});assert.equal(ctx.vtxLive.length,0,'intent silent');
console.log('Veto actual Crosscut handler single-point/hidden/owner/intent: PASS');
