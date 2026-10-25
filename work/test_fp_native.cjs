// First-person arms regression (ledger row 5). The player's arms are the native first-person rig: (1) for every
// weapon and the knife, the authored idle/fire poses keep both hands on the weapon (right on the grip; knife: right
// hand only), measured on the real assets through xvFPLoad/xvFPPlay; (2) the old primitive arms never show while the
// native rig loads, built rigs are cached so swaps are instant and replay equip, the knife/Classic are warmed, and only
// a failed native load falls back to the primitive arms; (3) the removed Quaternius-body arms stay removed.
const assert=require('assert/strict'),fs=require('fs'),path=require('path'),vm=require('vm');const root=path.join(__dirname,'..');
console.warn=((w)=>(...a)=>{if(!/boneTransform/.test(String(a[0])))w(...a);})(console.warn);
(async()=>{
 const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
 assert(!/function fpaBuild|function fpaTick|FPA_C\b/.test(html),'procedural stand-in FP arms removed');
 assert(/function fpaWeap\(/.test(html)&&/var FPG = \{/.test(html)&&/function vmOff\(/.test(html),'weapon geometry helpers kept');
 // (1) native assets
 const FP=await import(path.join(root,'server/tools/fp-view.mjs'));const api=FP.runtime();
 const guns=['classic','shorty','frenzy','ghost','sheriff','stinger','spectre','bucky','judge','bulldog','guardian','phantom','vandal','marshal','outlaw','operator','ares','odin'];
 for(const ag of ['jett','breach']) for(const w of (ag==='jett'?guns.concat('melee'):['sheriff','spectre','vandal','melee'])){const R=await FP.build(ag,w,api),k=FP.anims(R);
  for(const kind of ['Idle','Equip','Inspect'].concat(w==='melee'?['Attack 1','Alt Attack']:['Fire','Reload']))assert(k.includes(kind),ag+'/'+w+' has native '+kind);
  for(const kind of w==='melee'?['idle','attack 1']:['idle','fire'])for(const t of (kind==='fire'&&['marshal','outlaw','operator'].includes(w)?[0]:[0,.5,.95])){/* bolt guns work the bolt mid-fire */const m=FP.measure(R,kind,t);
   assert(m.right<0.06,ag+'/'+w+'/'+kind+'@'+t+' right hand on weapon '+m.right.toFixed(3));
   if(w!=='melee')assert(m.left<0.09,ag+'/'+w+'/'+kind+'@'+t+' left hand on weapon '+m.left.toFixed(3));}
  const m=FP.measure(R,'equip',.98);assert(m.right<0.13,ag+'/'+w+' equip ends in the hand');}
 // (2) tick behaviour with stubbed scene objects
 const src=fs.readFileSync(path.join(__dirname,'valorant_runtime.js'),'utf8'),a=src.indexOf('function xvFPPlay('),b=src.indexOf('// Replace generic imported map props');
 const T=require('./rig_harness.cjs').T;const obj=()=>({visible:true,children:[]});
 let pending={},loads=[];const mkF=(ag,w)=>{const root={visible:true,parent:null,traverse(){},scale:{set(){}},position:{set(){},y:0}};return {root,ag,w,am:{update(){},stopAllAction(){}},gm:{update(){},stopAllAction(){}},entries:[],kind:null,age:0,origin:{x:0,y:0,z:0}};};
 const camera={fov:70,children:[],add(o){this.children.push(o);o.parent=this;},remove(o){this.children=this.children.filter(x=>x!==o);o.parent=null;}};
 const c={THREE:T,console,Math,Promise,Map,Set,String,XV:{config:{},failures:{},hidden:[],fp:null,fpLoad:null,event:null},camera,running:true,player:{hp:100},gun:{visible:true,children:[obj()]},knife:{visible:false,children:[obj()]},muzzle:null,
  BC:{},J:{pick:'Jett'},XCA:{},VMA:{R:obj(),L:obj()},KARM:obj(),VM:{},mode:'tdm',reloading:0,kSwing:0,wName:()=>c.cur,FPG:{Vandal:1,Classic:1,Sheriff:1},vmFire(){},vmTick(){},cur:'Vandal'};
 vm.createContext(c);vm.runInContext('function fpaWeap(){return FPG[cur]?cur:"Vandal";}\n'+src.slice(a,b).replace(/\{const fire=vmFire[\s\S]*$/,''),c);
 c.xvFPLoad=(ag,w)=>{loads.push(ag+'|'+w);return new Promise((res,rej)=>{pending[ag+'|'+w]={res:()=>res(mkF(ag,w)),rej};});};
 c.xvFPPlay=(F,k)=>{F.kind=k;F.played=(F.played||[]).concat(k);};
 const tick=()=>{c.XV.hidden.forEach(([o,v])=>o.visible=v);c.XV.hidden=[];vm.runInContext('xvFPTick(1/60)',c);};
 const flush=()=>new Promise(r=>setImmediate(r));
 tick();assert(!c.VMA.R.visible&&!c.VMA.L.visible&&!c.KARM.visible,'primitive arms hidden while the native rig loads');assert(c.gun.children[0].visible,'native weapon model shows alone meanwhile');
 assert.deepEqual(loads.sort(),['Jett|Classic','Jett|Knife','Jett|Vandal'],'current weapon, knife and Classic warmed once');
 tick();assert.equal(loads.length,3,'no duplicate loads while pending');
 for(const k in pending)pending[k].res();await flush();await flush();tick();
 assert.equal(c.XV.fp.w,'Vandal');assert(camera.children.includes(c.XV.fp.root),'native rig on the camera');assert.deepEqual(c.XV.fp.played.slice(0,1),['equip'],'equip on first show');
 assert(!c.VMA.R.visible&&!c.gun.children[0].visible,'native rig replaces primitive arms and the static gun');
 const vandal=c.XV.fp;c.knife.visible=true;c.gun.visible=false;tick();await flush();await flush();tick();
 assert.equal(c.XV.fp.w,'Knife','knife swap served from the warm cache');assert.equal(loads.length,3,'no reload for a warmed weapon');assert(!camera.children.includes(vandal.root),'previous rig detached');
 c.knife.visible=false;c.gun.visible=true;tick();await flush();await flush();tick();assert.equal(c.XV.fp,vandal,'swapping back reuses the built rig');assert.equal(vandal.played.filter(x=>x==='equip').length,2,'equip replays on swap');
 c.cur='Sheriff';tick();assert(!c.VMA.R.visible,'still hidden while a new weapon loads');pending['Jett|Sheriff'].rej(new Error('404'));await flush();await flush();tick();tick();
 assert(c.XV.failures['Jett|Sheriff'],'failure recorded');assert(c.VMA.R.visible&&c.VMA.L.visible,'failed native load falls back to the primitive arms');
 c.player.hp=0;tick();assert.equal(vandal.root.visible,false,'dead: no viewmodel');
 console.log('native first-person arms ok');
})().catch(e=>{console.error(e);process.exit(1);});
