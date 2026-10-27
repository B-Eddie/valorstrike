// Weapon switch draws the right gun at once (user: "weapon switch briefly shows the wrong gun"). The native first-person
// rig (work/valorant_runtime.js xvFPTick) was swapped in a promise callback, even for a rig already built and cached, so
// the frame of the switch rendered without it (the static weapon model alone, no arms) and the new draw started a frame
// late; and a load still pending for a weapon the player had already switched away from took the screen when it landed
// (switch Vandal -> Sheriff -> back to Vandal before the Sheriff rig loads: the Sheriff rig and its equip showed while the
// Vandal was held). Checks, on the real xvFPTick with stubbed scene objects:
//  - a built rig (the per agent|weapon cache, or the feel pass's prefetch cache VF_RIGS) is on screen, playing its equip,
//    on the very tick of the switch, with the static gun / primitive arms hidden that same tick;
//  - switching back while another weapon's rig is still loading: that rig never shows, the held weapon's rig stays;
//  - a rig that is not built yet still loads and equips as before (static model meanwhile, ledger row 5).
const assert=require('assert/strict'),fs=require('fs'),path=require('path'),vm=require('vm');
(async()=>{
 const src=fs.readFileSync(path.join(__dirname,'valorant_runtime.js'),'utf8'),a=src.indexOf('function xvFPPlay('),b=src.indexOf('// Replace generic imported map props');
 assert(a>0&&b>a,'viewmodel block found');
 const T=require('./rig_harness.cjs').T;const obj=()=>({visible:true,children:[]});
 let pending={},loads=[];const mkF=(ag,w)=>{const root={visible:false,parent:null,traverse(){},scale:{set(){}},position:{set(){},y:0}};return {root,ag,w,am:{update(){},stopAllAction(){}},gm:{update(){},stopAllAction(){}},entries:[],kind:null,age:0,origin:{x:0,y:0,z:0}};};
 const camera={fov:70,children:[],add(o){if(o.parent)o.parent.remove(o);this.children.push(o);o.parent=this;},remove(o){this.children=this.children.filter(x=>x!==o);o.parent=null;}};
 const c={THREE:T,console,Math,Promise,Map,Set,String,XV:{config:{},failures:{},hidden:[],fp:null,fpLoad:null,event:null},camera,running:true,player:{hp:100},gun:{visible:true,children:[obj()]},knife:{visible:false,children:[obj()]},muzzle:null,
  BC:{},J:{pick:'Jett'},XCA:{},VMA:{R:obj(),L:obj()},KARM:obj(),VM:{},mode:'tdm',reloading:0,kSwing:0,FPG:{Vandal:1,Classic:1,Sheriff:1,Ghost:1},vmFire(){},vmTick(){},cur:'Vandal'};
 vm.createContext(c);vm.runInContext('function fpaWeap(){return FPG[cur]?cur:"Vandal";}\n'+src.slice(a,b).replace(/\{const fire=vmFire[\s\S]*$/,''),c);
 c.xvFPLoad=(ag,w)=>{loads.push(ag+'|'+w);return new Promise((res,rej)=>{pending[ag+'|'+w]={res:()=>res(mkF(ag,w)),rej};});};
 c.xvFPPlay=(F,k)=>{F.kind=k;F.played=(F.played||[]).concat(k);};
 const tick=()=>{c.XV.hidden.forEach(([o,v])=>o.visible=v);c.XV.hidden=[];vm.runInContext('xvFPTick(1/60)',c);};
 const flush=()=>new Promise(r=>setImmediate(r));const settle=async()=>{for(const k in pending){pending[k].res();delete pending[k];}await flush();await flush();};
 const shown=()=>camera.children.filter(r=>r.visible);
 // warm-up: Vandal (held), Knife, Classic built
 tick();await settle();tick();assert.equal(c.XV.fp&&c.XV.fp.w,'Vandal','held rig');const vandal=c.XV.fp;
 // (1) switch to a built rig: on screen and equipping on the switch tick itself
 c.cur='Classic';tick();
 assert.equal(c.XV.fp.w,'Classic','built Classic rig swapped on the switch tick (no frame without it)');
 assert(c.XV.fp.root.visible&&c.XV.fp.root.parent===camera,'Classic rig drawn that frame');assert.deepEqual(shown().map(r=>r===c.XV.fp.root),[true],'only the Classic rig on screen');
 assert.equal(c.XV.fp.played[c.XV.fp.played.length-1],'equip','Classic draw (equip) starts at once');
 assert(!c.gun.children[0].visible&&!c.VMA.R.visible,'no static gun / primitive arms on the switch frame');
 c.cur='Vandal';tick();assert.equal(c.XV.fp,vandal,'back to the cached Vandal rig on the same tick');assert.equal(vandal.played.filter(x=>x==='equip').length,2,'Vandal draw replays');
 // (2) the feel pass's prefetch cache counts as built too
 c.VF_RIGS=new Map();const ghost=mkF('Jett','Ghost');c.VF_RIGS.set('Jett|Ghost',ghost);c.xvFPLoad=((l)=>(ag,w)=>c.VF_RIGS.has(ag+'|'+w)?Promise.resolve(c.VF_RIGS.get(ag+'|'+w)):l(ag,w))(c.xvFPLoad);
 c.cur='Ghost';tick();assert.equal(c.XV.fp,ghost,'prefetched Ghost rig swapped on the switch tick');assert(ghost.root.visible,'Ghost drawn at once');
 c.cur='Vandal';tick();assert.equal(c.XV.fp,vandal);await flush();await flush();
 // (3) Sheriff not built: static model meanwhile; switch back before it lands -> it never takes the screen
 c.cur='Sheriff';tick();assert.equal(c.XV.fp,vandal,'Sheriff still loading');assert(!vandal.root.visible,'Vandal arms hidden while the Sheriff is out');assert(c.gun.children[0].visible,'static Sheriff model meanwhile (row 5)');
 c.cur='Vandal';tick();assert.equal(c.XV.fp,vandal);assert(vandal.root.visible,'Vandal back');
 await settle();tick();assert.equal(c.XV.fp,vandal,'late Sheriff load does not replace the held Vandal');assert.equal(c.XV.fp.w,'Vandal');
 assert.deepEqual(shown(),[vandal.root],'only the Vandal rig on screen after the stale load lands');
 for(let i=0;i<3;i++){tick();await flush();}assert.equal(c.XV.fp,vandal,'still the Vandal');
 // (4) the Sheriff (now built by that load) draws at once next time; an unbuilt weapon still loads and equips
 c.cur='Sheriff';tick();assert.equal(c.XV.fp.w,'Sheriff','Sheriff now built: immediate');
 delete c.FPG.Ghost;c.FPG.Spectre=1;c.cur='Spectre';tick();assert.equal(c.XV.fp.w,'Sheriff','Spectre loading');await settle();tick();
 assert.equal(c.XV.fp.w,'Spectre','unbuilt rig still loads and shows');assert.equal(c.XV.fp.played[0],'equip','with its equip');
 console.log('weapon swap draw: built rigs (cache + prefetch) draw on the switch tick, stale loads never take the screen, unbuilt rigs still load + equip');
})().catch(e=>{console.error(e);process.exit(1);});
