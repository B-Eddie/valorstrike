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
const blocks=['SAGE','SKYE','DEADLOCK','GEKKO','FADE','MIKS','VETO','VYSE','HUSH'];
for(const b of blocks){const i=html.indexOf('// ---- '+b+' FX ----'),j=html.indexOf('// ---- END '+b+' FX ----',i);assert(i>0&&j>i,b);vm.runInContext(html.slice(i,j),ctx,{filename:b});}
const P={x:2,y:0,z:3};
const cases=[
 ['Sage barrier','sgxBarrierWall(P,0.3)',h=>{h.breakSeg(1);h.setHp(0,0.5);h.fortify();}],
 ['Skye regrowth','skxRegrowth(2,0,3,18)',h=>h.move(4,0,5)],
 ['Deadlock GravNet','dlxGravNet(P,6,8)'],['Deadlock Barrier Mesh','dlxBarrierMesh(P,0.4,7.5,30)'],['Deadlock Sensor','dlxSonicSensor(P,30)'],
 ['Gekko Mosh','gkxMoshPool(P,3.5,3.6)'],
 ['Fade Seize','fdxSeizePool(P,4,5)'],['Fade Nightfall','fdxNightfall(P,0.5,14,9,2.5)'],
 ['Miks M-Pulse','mkxMPulse(P,5,4)'],['Miks Bassquake','mkxBassquake({x:2,y:1.2,z:3},{x:0,y:0,z:-1},40)'],
 ['Veto Interceptor','vtxInterceptor(P,4,12)'],['Veto Crosscut','vtxCrosscut(P)'],
 ['Vyse Razorvine','vyxRazorvine(P,4,6)'],['Vyse Arc Rose','vyxArcRose(P,6)'],['Vyse Steel Garden','vyxSteelGarden(P,6,4)'],['Vyse Shear','vyxShear(P,0.5,5,5)'],
 ['Hush Displacement','hushxDisplacement({x:0,y:1.4,z:0},P,{delay:1})'],
];
ctx.P=P;
const step={SAGE:'sgxTick',SKYE:'skxTick',DEADLOCK:'dlxTick',GEKKO:'gkxTick',FADE:'fdxTick',MIKS:'mkxTick',VETO:'vtxTick',VYSE:'vyxTick',HUSH:'hushxTick'};
let ok=0;
for(const [name,expr,poke] of cases){const n0=ctx.scene.children.length;let h;
 try{h=vm.runInContext(expr,ctx);}catch(e){errs.push(name+' threw '+e);}
 assert(h,name+' returned a handle (errors: '+errs.join(' | ').slice(0,300)+')');
 if(poke)try{ctx.__h=h;poke(h);}catch(e){errs.push(name+' poke '+e);}
 assert(ctx.scene.children.length>n0,name+' added objects to the scene');
 for(const fn of Object.values(step)){if(typeof ctx[fn]==='function')for(let k=0;k<40;k++){nowv+=250;try{ctx[fn](0.25);}catch(e){errs.push(name+' tick '+e);}}}
 try{if(h.end)h.end();}catch(e){errs.push(name+' end '+e);}
 ok++;}
for(let k=0;k<400;k++){nowv+=250;for(const fn of Object.values(step))try{ctx[fn](0.25);}catch(e){errs.push('late tick '+e);}}
const left=ctx.scene.children.length;
assert.deepEqual(errs,[],'no runtime errors: '+errs.join('\n').slice(0,800));
assert.equal(left,0,'all effects removed from the scene after end/ttl (leaked objects: '+left+')');
console.log('fx modules (real three.js, no GL): '+ok+' entry points construct, tick 10 s, and end without errors; scene objects left after 100 more seconds of ticks: '+left);
