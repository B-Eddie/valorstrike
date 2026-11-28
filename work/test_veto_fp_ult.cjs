// Veto ult FP arms binding (veto-fp-ult): unit-level transition tests on the real xvFP tick code + the real
// agents18 hook block, in a vm context with a controllable stubbed xvFPLoad (pattern from test_fp_native.cjs).
// Covers: key/override wiring, activation purge + rebuild with ult arms, expiry purge + rebuild with normal
// arms, the in-flight async load race (override flips while a rig loads must never cache the wrong-arms rig),
// and the online path (a18EvoSync) driving the same refresh.
const assert=require('assert/strict'),fs=require('fs'),path=require('path'),vm=require('vm');
const vsrc=fs.readFileSync(path.join(__dirname,'valorant_runtime.js'),'utf8');
const a=vsrc.indexOf('function xvFPPlay('),b=vsrc.indexOf('// Replace generic imported map props');
const asrc=fs.readFileSync(path.join(__dirname,'agents18_runtime.js'),'utf8');
const h0=asrc.indexOf('window.xvFPArmsOverride='),h1=asrc.indexOf('function a18EvoSync');
assert(h0>0&&h1>h0,'agents18 hook block found');
const hook=asrc.slice(h0,h1);
const sync0=asrc.indexOf('function a18EvoSync');
let d=0,sync1=-1;for(let i=asrc.indexOf('{',sync0);i<asrc.length;i++){if(asrc[i]==='{')d++;else if(asrc[i]==='}'&&!--d){sync1=i+1;break;}}
const syncSrc=asrc.slice(sync0,sync1);
const tw={window:{},self:{},document:{createElementNS:()=>({getContext:()=>null}),createElement:()=>({getContext:()=>null,style:{}})},navigator:{userAgent:'node'}};tw.window=tw;tw.self=tw;
vm.createContext(tw);vm.runInContext(fs.readFileSync(path.join(__dirname,'..','vendor','three','three.min.js'),'utf8'),tw);
const T=tw.THREE;const obj=()=>({visible:true,children:[]});
let pending={},loads=[];
const mkF=(ag,w)=>{const root={visible:true,parent:null,traverse(){},scale:{set(){}},position:{set(){},y:0}};return {root,ag,w,am:{update(){},stopAllAction(){}},gm:{update(){},stopAllAction(){}},entries:[],kind:null,age:0,origin:{x:0,y:0,z:0}};};
const camera={fov:70,children:[],add(o){this.children.push(o);o.parent=this;},remove(o){this.children=this.children.filter(x=>x!==o);o.parent=null;}};
const c={THREE:T,console,Math,Promise,Map,Set,String,XV:{config:{},failures:{},hidden:[],fp:null,fpLoad:null,event:null},camera,running:true,player:{hp:100},gun:{visible:true,children:[obj()]},knife:{visible:false,children:[obj()]},muzzle:null,
 BC:{},J:{pick:'Veto'},XCA:{},VMA:{R:obj(),L:obj()},KARM:obj(),VM:{},mode:'tdm',reloading:0,kSwing:0,wName:()=>c.cur,FPG:{Vandal:1,Classic:1,Sheriff:1},vmFire(){},vmTick(){},cur:'Vandal',xAD:{k:0},
 NET:{socket:1},vtxLive:[],a18EvoVeil:null,vtxVeil:(n,t)=>({end(){},fx:{age:0,ttl:t}})};
c.window=c;
vm.createContext(c);
vm.runInContext('function fpaWeap(){return FPG[cur]?cur:"Vandal";}\n'+vsrc.slice(a,b).replace(/\{const fire=vmFire[\s\S]*$/,''),c);
vm.runInContext(hook+'\n'+syncSrc,c);
c.xvFPLoad=(ag,w)=>{loads.push(ag+'|'+w+'|'+String(xv=>0)||'');return new Promise((res,rej)=>{pending[ag+'|'+w]={res:()=>res(mkF(ag,w)),rej};});};
c.xvFPPlay=(F,k)=>{F.kind=k;};
const run=s=>vm.runInContext(s,c);
const tick=()=>{c.XV.hidden.forEach(([o,v])=>o.visible=v);c.XV.hidden=[];run('xvFPTick(1/60)');};
const flush=()=>new Promise(r=>setImmediate(r));
const resolveAll=async()=>{for(const k in pending)pending[k].res();pending={};await flush();await flush();};
(async()=>{
 // key wiring: no override pre-ult
 assert.equal(run('xvFPKey("Veto","Vandal")'),'Veto|Vandal','no ult segment pre-ult');
 assert.equal(run('window.xvFPArmsOverride("Veto")'),null,'override null pre-ult');
 assert.equal(run('window.xvFPArmsOverride("Jett")'),null,'override never applies to other agents');
 tick();assert.equal(run('XV.fpUlt||null'),null,'fpUlt unset pre-ult');
 await resolveAll();tick();
 assert.equal(c.XV.fp.w,'Vandal','normal rig built pre-ult');
 assert(run('[...XVFP.c.keys()].some(k=>k==="Veto|Vandal")'),'cached under normal key');
 // activation: purge + rebuild with ult arms
 run('a18EvoFPRefresh(true)');
 assert.equal(run('XV.fpUlt'),true,'fpUlt set on activation');
 assert.equal(c.XV.fp,null,'active rig dropped on activation');
 assert(!run('[...XVFP.c.keys()].some(k=>k.startsWith("Veto|")&&!k.endsWith("#"))'),'Veto cache purged on activation');
 assert.equal(run('xvFPKey("Veto","Vandal")'),'Veto|Vandal|veto-fp-ult','ult segment in key while active');
 assert.equal(run('xvFPKey("Veto","Knife")'),'Veto|Knife|veto-fp-ult','knife also gets ult arms');
 tick();
 assert(run('[...XVFP.c.keys()].some(k=>k==="Veto|Vandal|veto-fp-ult#")'),'ult rig loading under ult key');
 await resolveAll();tick();
 assert.equal(c.XV.fp.w,'Vandal','ult rig swapped in');
 assert(run('[...XVFP.c.keys()].some(k=>k==="Veto|Vandal|veto-fp-ult")'),'cached under ult key');
 // expiry: purge + rebuild with normal arms
 run('a18EvoFPRefresh(false)');
 assert.equal(run('XV.fpUlt'),false,'fpUlt cleared on expiry');
 assert(!run('[...XVFP.c.keys()].some(k=>k.startsWith("Veto|")&&!k.endsWith("#"))'),'Veto cache purged on expiry');
 tick();await resolveAll();tick();
 assert(run('[...XVFP.c.keys()].some(k=>k==="Veto|Vandal")'),'rebuilt under normal key after expiry');
 // race: override flips while a Classic load is in flight -> the wrong-arms rig must not be cached
 run('XVFP.c.delete("Veto|Classic");true');
 const p=run('xvFPGet("Veto","Classic")');
 run('XV.fpUlt=true;true'); // flip directly (no refresh) so the pending load is untouched
 await resolveAll();await p;
 assert(!run('[...XVFP.c.keys()].some(k=>k==="Veto|Classic")'),'stale pre-flip rig not cached');
 assert(!run('[...XVFP.c.keys()].some(k=>k==="Veto|Classic#")'),'no dangling pending marker');
 // reverse race: load starts during ult, ult ends mid-flight
 const p2=run('xvFPGet("Veto","Classic")'); // key Veto|Classic|veto-fp-ult
 run('XV.fpUlt=false;true');
 await resolveAll();await p2;
 assert(!run('[...XVFP.c.keys()].some(k=>k==="Veto|Classic|veto-fp-ult")'),'stale ult rig not cached after expiry mid-flight');
 // online path: a18EvoSync drives the same refresh
 run('XV.fpUlt=false;true');
 run('a18EvoSync({evo:5})');
 assert.equal(run('XV.fpUlt'),true,'online sync activates fpUlt');
 run('a18EvoSync({evo:0})');
 assert.equal(run('XV.fpUlt'),false,'online sync deactivates fpUlt at 0');
 run('NET.socket=null;true');run('a18EvoSync({evo:5})');
 assert.equal(run('XV.fpUlt'),false,'offline sync (no socket) keeps fpUlt off');
 console.log('PASS test_veto_fp_ult');
})().catch(e=>{console.error('FAIL',e.message);process.exit(1);});
