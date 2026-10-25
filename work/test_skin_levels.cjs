// Skin levels (Valorant-style, all free, client-only): every owned skin starts at Level 1; "Upgrade · FREE" unlocks
// 2 firing VFX, 3 kill banner, 4 finisher in order; each unlocked level 2-4 toggles on / off; levels persist per weapon
// skin and tampered / unowned entries are dropped. Effects: VFX tints the muzzle flash + light to the skin accent and
// drives the first-person gun's emissive surge (xskFl), restored for Standard / VFX off; the kill banner takes the skin
// name + accent; the finisher spawns only on a round-ending kill with Level 4 on, at the victim. Levels never go online.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.join(__dirname,'..'),cat=JSON.parse(fs.readFileSync(path.join(root,'server/src/skins.json'),'utf8'));
const src=fs.readFileSync(path.join(__dirname,'skins_runtime.js'),'utf8').replace('/*SKINS_JSON*/null',JSON.stringify(cat));
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
class Color{constructor(v){this.v=v;}set(v){this.v=v;return this;}copy(c){this.v=c.v;return this;}clone(){return new Color(this.v);}}
let nid=0;class Mat{constructor(o={}){Object.assign(this,{color:new Color('#fff'),userData:{},id:++nid},o);}clone(){const m=new Mat({...this,color:new Color(this.color.v),userData:{},id:++nid});delete m.onBeforeCompile;delete m.customProgramCacheKey;return m;}}
class Obj{constructor(mat,kids=[]){this.isMesh=!!mat;this.material=mat;this.children=kids;this.userData={};this.visible=true;this.geometry={boundingSphere:{radius:.5}};this.position={x:0,y:0,z:0,set(x,y,z){this.x=x;this.y=y;this.z=z;}};this.rotation={};this.scale={setScalar(){},set(){}};}traverse(f){f(this);this.children.forEach(c=>c.traverse(f));}add(...k){this.children.push(...k);}}
function el(id){const cls=new Set(),kids=[];return {id,textContent:'',style:{setProperty(k,v){this[k]=v;}},classList:{add:c=>cls.add(c),remove:c=>cls.delete(c),contains:c=>cls.has(c),toggle(c,on){on?cls.add(c):cls.delete(c);}},appendChild(k){kids.push(k);D[k.id]=k;},kids};}
let D={};
function ctx(store,extra={}){D={xKbn:el('xKbn')};const c={THREE:{Color,Mesh:function(g,m){return Object.assign(new Obj(m),{geometry:g});},Group:function(){return new Obj(null);},RingGeometry:function(){},CylinderGeometry:function(){},MeshBasicMaterial:function(){return new Mat();},AdditiveBlending:2,DoubleSide:2},
 localStorage:{getItem:k=>store[k]??null,setItem:(k,v)=>{store[k]=String(v);}},document:{getElementById:id=>D[id]||null,createElement:t=>el(''),head:{appendChild(k){D[k.id||'css']=k;}},body:null},
 performance:{now:()=>c.now},now:1e6,setTimeout:()=>1,clearTimeout(){},addEventListener(){},Math,JSON,Object,String,Number,Set,Map,Array,Date,console,bots:[],allies:[],SKU:{value:1},
 muzzle:{material:{color:new Color('#ffe0a0')}},mLight:{color:new Color('#ffb060')},scene:new Obj(null),fired:0,killed:[],rw:'pri',cur:'Vandal',mode:'five',player:{x:0,y:0,z:0},yaw:0,...extra};
 c.wName=()=>c.cur;c.vmFire=()=>{c.fired++;};c.vmKill=(n,hs)=>{c.killed.push(n);};c.window=c;vm.createContext(c);vm.runInContext(src,c);return c;}
const store={};let C=ctx(store);
// new collections from the catalogue (names from valorant-api.com, own visuals)
for(const n of ['Kuronami','Araxys','Prelude to Chaos',"Gaia's Vengeance",'BlastX','Protocol 781-A','Magepunk','Neo Frontier'])assert(cat.collections.some(c=>c.name===n),n);
assert(cat.collections.length>=25);for(const c of cat.collections)assert(/^[a-z0-9]+$/.test(c.id)&&c.id.length<=20,c.id);
for(const c of cat.collections)for(const s of Object.values(c.skins))for(const n of s.ch.slice(1))assert(c.cc[n]&&c.cc[n].a,'variant colours for '+c.id+' '+n);
// levels: start, upgrade order, cap, ownership
assert.equal(C.xskLv('Vandal','kuronami'),0,'unowned: no level');assert.equal(C.xskUpgrade('Vandal','kuronami'),false);assert.equal(C.xskLv('Vandal','standard'),0);
C.xskGive('Vandal','kuronami');C.xskEquip('Vandal','kuronami.1');assert.equal(C.xskLv('Vandal','kuronami'),1,'owned skin starts at Level 1');
assert.equal(C.xskLvOn('Vandal','kuronami',2),false);assert.equal(C.xskLvToggle('Vandal','kuronami',2),false,'locked level cannot toggle');
for(const l of [2,3,4]){assert(C.xskUpgrade('Vandal','kuronami'));assert.equal(C.xskLv('Vandal','kuronami'),l);assert(C.xskLvOn('Vandal','kuronami',l),'new level on');}
assert.equal(C.xskUpgrade('Vandal','kuronami'),false,'Level 4 is the cap');
assert(C.xskLvToggle('Vandal','kuronami',3));assert.equal(C.xskLvOn('Vandal','kuronami',3),false);assert(C.xskLvOn('Vandal','kuronami',2)&&C.xskLvOn('Vandal','kuronami',4),'toggles independent');
assert.equal(C.xskLvToggle('Vandal','kuronami',1),false,'Level 1 is the finish itself');assert.equal(C.xskLvToggle('Vandal','kuronami',5),false);
// persistence + tamper
assert.deepEqual(JSON.parse(store['vs.skins']).lv,{'kuronami:Vandal':[4,8]});C=ctx(store);assert.equal(C.xskLv('Vandal','kuronami'),4);assert.equal(C.xskLvOn('Vandal','kuronami',3),false,'toggle persisted');
{const B=ctx({'vs.skins':JSON.stringify({v:2,eq:{},owned:['reaver:Vandal'],lv:{'reaver:Vandal':[9,0],'prime:Vandal':[4,0],'x:y':[2,0],'reaver:Phantom':[3,0]}})});assert.equal(B.xskLv('Vandal','reaver'),1,'out-of-range level dropped');assert.equal(B.xskLv('Vandal','prime'),0,'unowned level dropped');
 const B2=ctx({'vs.skins':JSON.stringify({v:2,eq:{},owned:['reaver:Vandal'],lv:{'reaver:Vandal':[3,'x']}})});assert.equal(B2.xskLv('Vandal','reaver'),1);
 const B3=ctx({'vs.skins':JSON.stringify({v:2,eq:{},owned:['reaver:Vandal'],lv:[1]})});assert.equal(B3.xskLv('Vandal','reaver'),1);}
// firing VFX: muzzle + light tint, emissive surge on the FP weapon only, restored when off / Standard
{const ws=new Obj(null,[new Obj(new Mat())]);C.XV={fp:{w:'Vandal',ws}};C.xskFP();const u=ws.children[0].material.userData.xsk.U;assert(u.xskFl&&u.xskFl.value===0);
 const acc=C.xskDef('Vandal','kuronami.1').col.e;C.vmFire();assert.equal(C.fired,1,'original vmFire still runs');assert.equal(C.muzzle.material.color.v,acc);assert.equal(C.mLight.color.v,acc);
 C.now+=16;C.xskTick();assert(u.xskFl.value>0.5,'surge on the shot');for(let i=0;i<20;i++){C.now+=16;C.xskTick();}assert.equal(u.xskFl.value,0,'surge decays');
 C.xskLvToggle('Vandal','kuronami',2);C.vmFire();assert.equal(C.muzzle.material.color.v,'#ffe0a0','VFX off: default flash');assert.equal(C.mLight.color.v,'#ffb060');C.xskLvToggle('Vandal','kuronami',2);
 C.cur='Phantom';C.vmFire();assert.equal(C.muzzle.material.color.v,'#ffe0a0','Standard gun: default flash');C.cur='Vandal';
 const sh={uniforms:{},vertexShader:'#include <begin_vertex>',fragmentShader:'#include <map_fragment>\n#include <emissivemap_fragment>'};ws.children[0].material.onBeforeCompile(sh);assert(sh.uniforms.xskFl===u.xskFl&&sh.fragmentShader.includes('xskFl*('),'surge in the shared program');}
// kill banner (L3) and finisher (L4)
{C.vmKill('Bot A',false);assert.deepEqual([...C.killed],['Bot A'],'original vmKill still runs');assert(!D.xKbn.classList.contains('xsk'),'banner off (L3 toggled off)');
 C.xskLvToggle('Vandal','kuronami',3);C.vmKill('Bot A',false);assert(D.xKbn.classList.contains('xsk'));assert.equal(D.xKbSk.textContent,'Kuronami Vandal');assert.equal(D.xKbn.style['--xskc'],C.xskDef('Vandal','kuronami.1').col.e);
 C.bots=[{name:'Bot A',alive:false,g:{position:{x:4,y:0,z:-2}}},{name:'Bot B',alive:true}];C.vmKill('Bot A');assert.equal(C.XSK_FIN.n,0,'finisher only on the round-ending kill');
 C.bots[1].alive=false;C.vmKill('Bot B');assert.equal(C.XSK_FIN.n,1,'round-ending kill');assert.equal(C.XSK_FIN.L[0].g.position.z,-3,'victim without a position: in front of the player');for(let i=0;i<120;i++){C.now+=16;C.xskTick();}
 C.bots[1].g={position:{x:1,y:0,z:1}};C.XSK_FIN.n=0;C.vmKill('Bot B');assert.equal(C.XSK_FIN.n,1);}
{const f=C.XSK_FIN.L[0];assert(f.g.visible&&f.g.position.x===1&&f.g.position.z===1,'at the victim');for(let i=0;i<120;i++){C.now+=16;C.xskTick();}assert.equal(f.g.visible,false,'finisher ends');
 C.mode='tdm';C.vmKill('Bot B');assert.equal(C.XSK_FIN.n,1,'no finisher outside round modes');C.mode='five';C.xskLvToggle('Vandal','kuronami',4);C.vmKill('Bot B');assert.equal(C.XSK_FIN.n,1,'L4 off');assert.equal(C.XSK_FIN.L.length,1,'pooled');}
{C.cur='Phantom';C.vmKill('Bot B');assert(!D.xKbn.classList.contains('xsk'),'Standard gun: plain banner');}
// levels never go on the wire
{const sent=[];const N=ctx(store,{NET:{socket:{}},netSend:m=>sent.push(m)});N.xskUpgrade('Vandal','kuronami');assert.equal(sent.length,0);assert(!JSON.stringify(N.xskWire()).includes('lv'));}
// Collection page: levels panel, upgrade + toggle actions, FREE only
{const body={innerHTML:''};const U=ctx({},{document:{getElementById:id=>id==='xSk'?{querySelector:()=>body,querySelectorAll:()=>[]}:null,body:null,createElement:()=>el('')}});
 U.xskAct('weapon','Phantom');U.xskAct('pick',null,'magepunk');let h=body.innerHTML;assert(h.includes('aria-label="Skin levels"'));assert(h.includes('Get the skin to unlock its levels'));assert(!h.includes('data-a="up"'));
 U.xskAct('get',null,'magepunk');h=body.innerHTML;for(const n of ['Base finish','Firing VFX','Kill banner','Finisher'])assert(h.includes(n),n);assert(h.includes('Upgrade to Level 2 · FREE'));
 assert(U.xskAct('up',null,'magepunk'));h=body.innerHTML;assert(h.includes('data-a="fx" data-id="magepunk" data-n="2" aria-pressed="true"'));assert(h.includes('Upgrade to Level 3 · FREE'));
 assert(U.xskAct('fx',null,'magepunk','2'));assert(body.innerHTML.includes('data-n="2" aria-pressed="false"'));assert.equal(U.xskAct('fx',null,'magepunk','3'),false,'locked');
 U.xskAct('up',null,'magepunk');U.xskAct('up',null,'magepunk');assert(body.innerHTML.includes('All levels unlocked'));assert.equal(U.xskAct('up',null,'magepunk'),false);
 U.xskAct('pick',null,'standard');assert(!body.innerHTML.includes('Skin levels'),'Standard has no levels');
 assert(!/\$|€|£|\bVP\b|radianite|price|checkout/i.test(h.replace(/xsk-[a-z]+/g,'')));}
assert(/#xSk \.xsk-tg\{min-height:44px/.test(src)&&/#xSk \.xsk-up\{min-height:44px/.test(src),'44px touch targets');
assert(html.includes('function xskUpgrade(')&&html.includes('XSK_LVN'),'levels installed in index.html');
console.log('skin levels: catalogue additions, upgrade/toggle/persist, VFX tint + surge, kill banner, finisher, page ok');
