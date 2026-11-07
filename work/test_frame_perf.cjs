// Per-frame perf (item 2): HUD portrait pips keyed as "1/0" strings and rebuilt only on change, #jX em cached, open
// scoreboard at 5 Hz, floor-gun prompt ticked from the main loop (no own rAF chain) with a cached element, nmHeight
// reuses one scratch ray (same heights as a fresh ray), floor gun / Spike heights cached per resting spot, and the
// native minimap reads its CSS width at most once a second instead of every draw.
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict');const root=path.join(__dirname,'..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8'),nm=fs.readFileSync(path.join(root,'work/native_maps_runtime.js'),'utf8');
assert(html.includes('let ka = me ? "1" : "0", ke = "";')&&html.includes('if (xHud.pa !== ka) { xHud.pa = ka; $("xPA").innerHTML = ph(ka); }'),'portrait pips keyed, markup only on change');
assert(!html.includes('const xe = document.querySelector("#jX em")')&&html.includes('xe = xHud.em = document.querySelector("#jX em")'),'#jX em cached');
assert(html.includes('if (!(t - (xHud.bt || 0) < 200)) { xHud.bt = t; board(); }'),'open scoreboard at 5 Hz');
assert(!/xdPromptLoop\);\s*\}\)\(\);/.test(html)&&html.includes('(window.XHK || (window.XHK = [])).push(() => { try { xdPrompt(); } catch (e) {} });'),'floor-gun prompt on the shared loop, no own rAF chain');
assert(html.includes('let el = xdPrompt.el || (xdPrompt.el = document.getElementById("xdPrompt"));'),'prompt element cached');
assert(nm.includes('d.nhC!==C||d.nhX!==d.x||d.nhZ!==d.z')&&!nm.includes('for(const d of XD.L)d.m.position.y=nmHeight('),'floor gun heights cached per spot');
assert(!/px=W\/\(MM\.getBoundingClientRect\(\)\.width/.test(nm),'minimap width not read every draw');
// nmHeight: scratch ray gives the same heights as before and allocates no Ray per call.
{const a=nm.indexOf('function nmHeight('),b=nm.indexOf('\n',a);let rays=0;
 class V{constructor(x=0,y=0,z=0){this.x=x;this.y=y;this.z=z;}set(x,y,z){this.x=x;this.y=y;this.z=z;return this;}}
 class Ray{constructor(o,d){rays++;this.origin=o;this.direction=d;}}
 const floors=[3,1.2,-0.5],bvh={raycastFirst(r){const f=floors.find(y=>y<r.origin.y);return f==null?null:{point:{y:f},face:{normal:{y:f===1.2?0.2:1}}};}};
 class S{} /* stand-ins: the NM_Q line (BVH query helpers, perf2) builds scratch objects at load; a stand-in bvh takes its raycastFirst fallback */
 const C={nav:{nodes:[[0,2,0]]},bvh},ctx={Math,Number,WeakMap,Float64Array,Int32Array,Uint32Array,Uint16Array,THREE:{Ray,Vector3:V,Box3:S,Line3:S,Matrix4:S,Triangle:S,DoubleSide:2,BackSide:1},nmNear:()=>0,Error};vm.createContext(ctx);vm.runInContext(nm.split('\n').find(l=>l.startsWith('var NM_Q=')),ctx);rays=0;vm.runInContext(nm.slice(a,b),ctx);
 assert.equal(ctx.nmHeight(C,0,0,3.5),3);assert.equal(ctx.nmHeight(C,0,0,1.5),-0.5,'steep face skipped');assert.equal(ctx.nmHeight(C,0,0,3.5),3);assert.equal(rays,1,'one scratch ray for every call');}
// Minimap: getBoundingClientRect at most once per second of draws.
{const a=nm.indexOf('function nmMapProjection('),b=nm.indexOf('\n{const map=minimap',a);let rects=0,now=0;
 class V{constructor(x=0,y=0,z=0){this.x=x;this.y=y;this.z=z;}set(x,y,z){this.x=x;this.y=y;this.z=z;return this;}}
 const ctx2=new Proxy({},{get:()=>()=>{}}),k={Math,Object,performance:{now:()=>now},running:true,player:{x:0,y:0,z:0,hp:100},mode:'five',FV:{sp:{st:'carry'}},yaw:0,XCALL:{},minimap:{},window:{},J:{rvT:0},mmVis:new Set(),mmPrev:new Set(),mmLost:new Map(),$(){return {classList:{toggle(){}}}},
  MM:{width:320,height:320,getBoundingClientRect:()=>{rects++;return {width:112};}},mmx:ctx2,allies:[],bots:[],los:()=>true,pEye:()=>new V(0,1.5,0),THREE:{Vector3:V}};
 vm.createContext(k);vm.runInContext(nm.slice(a,b)+';globalThis.draw=nmMinimap;',k);
 const m=JSON.parse(fs.readFileSync(path.join(root,'models/valorant/maps/ascent/map.json'),'utf8')),C={bounds:m.bounds,image:{complete:true,naturalWidth:1024},meta:m};
 let draws=0;for(let i=0;i<25;i++){now+=100;k.draw(C);draws++;}assert(draws===25&&rects>=1&&rects<=3,'minimap rect reads per 2.5 s of draws: '+rects);}
console.log('Frame perf: portrait key, cached #jX em, scoreboard 5 Hz, prompt on shared loop, scratch nmHeight ray, cached floor heights, minimap width cached');
