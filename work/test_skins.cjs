// Weapon skins (free, original lines): catalogue embedded from server/src/skins.json; ownership + equip persist in
// localStorage (tampered entries ignored); the online wire carries only valid non-standard ids ('hi' sk, 'sk' on change)
// and incoming 'sks' / 'sk' are re-validated; the shader patch is applied to FP (native + fallback), TP guns (each
// owner's skin), floor guns and swapped back to the original for Standard; Collection and Store render headlessly with
// every category / weapon, a 3D preview canvas, chroma swatches, FREE-only items and working Get / Equip.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.join(__dirname,'..'),cat=JSON.parse(fs.readFileSync(path.join(root,'server/src/skins.json'),'utf8'));
const src=fs.readFileSync(path.join(__dirname,'skins_runtime.js'),'utf8').replace('/*SKINS_JSON*/null',JSON.stringify(cat));
const html=fs.readFileSync(path.join(root,'index.html'),'utf8'),sr=fs.readFileSync(path.join(__dirname,'server_runtime.js'),'utf8');
const deq=(a,b,m)=>assert.deepEqual(JSON.parse(JSON.stringify(a===undefined?null:a)),JSON.parse(JSON.stringify(b===undefined?null:b)),m);
class Color{constructor(v){this.v=v;}}
let nid=0;class Mat{constructor(o={}){Object.assign(this,{color:new Color('#fff'),userData:{},id:++nid},o);}clone(){const m=new Mat({...this,userData:{},id:++nid});delete m.onBeforeCompile;delete m.customProgramCacheKey;m.cloneOf=this;return m;}}
class Obj{constructor(mat,kids=[]){this.isMesh=!!mat;this.material=mat;this.children=kids;this.userData={};this.geometry={boundingSphere:{radius:.5}};}traverse(f){f(this);this.children.forEach(c=>c.traverse(f));}}
function ctx(store,extra={}){const timers=[];const c={THREE:{Color},localStorage:{getItem:k=>store[k]??null,setItem:(k,v)=>{store[k]=String(v);}},window:{},document:{getElementById:()=>null,body:null},performance:{now:()=>c.now},now:1e6,
 setTimeout:(f)=>{timers.push(f);return timers.length;},clearTimeout:()=>{},addEventListener(){},Math,JSON,Object,String,Number,Set,Map,Array,Date,console,bots:[],allies:[],SKU:{value:1},timers,...extra};c.window=c;vm.createContext(c);vm.runInContext(src,c);return c;}
const store={};let C=ctx(store);const X=C.XSK;
// catalogue: 18 guns + the knife in Valorant's categories; Valorant collection names, per-weapon availability, variants
assert.equal(X.weapons.length,19);deq(X.cats.map(c=>c[0]),['Sidearms','SMGs','Shotguns','Rifles','Sniper Rifles','Heavy','Melee']);
const lines=cat.collections.filter(c=>c.id!=='standard');for(const n of ['Prime','Reaver','Glitchpop','Oni','Elderflame','Ion','Sovereign','RGX 11z Pro','Singularity','Spectrum','Champions 2021','Forsaken','Sentinels of Light','Recon','Ruination'])assert(lines.some(c=>c.name===n),n);
for(const c of lines){assert.equal(c.skins.Knife.n,c.name+' Knife','knife model is the tactical knife: <Collection> Knife');for(const k of ['pal','k','tier','desc'])assert(k in c,c.id+' '+k);}
assert(!/\.png|\.jpg|displayIcon|https?:/.test(JSON.stringify(cat.collections)),'names only: no Riot art references');
assert(C.xskValidFor('Vandal','reaver.3')&&!C.xskValidFor('Vandal','reaver.4')&&!C.xskValidFor('Phantom','prime')&&!C.xskValidFor('Vandal','Reaver')&&!C.xskValidFor('Vandal','constructor')&&C.xskValidFor('Odin','standard'));
assert.equal(C.xskName('Vandal','oni.2'),'Oni Vandal · Hana');assert.equal(C.xskName('Operator','reaver'),'Reaver Operator');assert.equal(C.xskName('Knife','standard'),'Standard');
assert.notEqual(C.xskDef('Ghost','sovereign.2').col.a,C.xskDef('Phantom','sovereign.2').col.a,'variant colours follow that weapon\'s variant (Silver vs Teal)');
// ownership gate, equip, persistence
assert.equal(C.xskGet('Vandal'),'standard');assert.equal(C.xskEquip('Vandal','reaver.1'),false,'unowned skin cannot be equipped');
assert.equal(C.xskGive('Vandal','reaver'),true);assert.equal(C.xskGive('Vandal','reaver'),false,'already owned');assert.equal(C.xskGive('Phantom','prime'),false,'Prime has no Phantom');assert.equal(C.xskEquip('Vandal','reaver.1'),true);
assert.equal(C.xskGive('Knife','rgx'),true);C.xskEquip('Knife','rgx');
const saved=JSON.parse(store['vs.skins']);deq(saved.eq,{Vandal:'reaver.1',Knife:'rgx'});assert(saved.owned.includes('reaver:Vandal'));
C=ctx(store);assert.equal(C.xskGet('Vandal'),'reaver.1','persisted across reload');assert.equal(C.xskGet('Knife'),'rgx');deq(C.xskWire(),{Vandal:'reaver.1',Knife:'rgx'});
{const bad={'vs.skins':JSON.stringify({v:2,eq:{Vandal:'glitchpop',Phantom:'bogus',Laser:'reaver',Knife:'rgx'},owned:['reaver:Vandal','rgx:Knife','x:Vandal','reaver:Laser','prime:Phantom']})},B=ctx(bad);
 assert.equal(B.xskGet('Vandal'),'standard','equipped-but-unowned entry ignored');assert.equal(B.xskGet('Phantom'),'standard');assert.equal(B.xskGet('Knife'),'rgx');deq([...B.XSK.owned].sort(),['reaver:Vandal','rgx:Knife']);}
{const B=ctx({'vs.skins':'{not json'});assert.equal(B.xskGet('Vandal'),'standard','corrupt storage');}
// online wire: change sends one 'sk' with the valid map; incoming frames are re-validated per weapon
{const sent=[];const N=ctx(store,{NET:{socket:{}},netSend:m=>sent.push(m)});N.xskGive('Phantom','glitchpop');N.xskEquip('Phantom','glitchpop.2');N.timers.forEach(f=>f());
 deq(sent.at(-1),{t:'sk',s:{Phantom:'glitchpop.2',Vandal:'reaver.1',Knife:'rgx'}});
 N.xskNet({t:'sks',m:{7:{Vandal:'prime',Phantom:'prime',Laser:'reaver'},8:'junk'}});assert.equal(N.xskNetGet(7,'Vandal'),'prime');assert.equal(N.xskNetGet(7,'Phantom'),'standard');assert.equal(N.xskNetGet(8,'Vandal'),'standard');
 N.xskNet({t:'sk',id:7,s:{Vandal:'elderflame.3'}});assert.equal(N.xskNetGet(7,'Vandal'),'elderflame.3');N.xskNet({t:'skr'});assert.equal(N.XSK.rejected,1);}
// material patch + application
{const A=ctx({});const base=new Mat(),glass=new Mat({transparent:true}),flat=new Mat({isMeshBasicMaterial:true}),g=new Obj(null,[new Obj(base),new Obj(glass),new Obj(flat)]);
 A.xskApply(g,'Vandal','elderflame.1');const m=g.children[0].material;assert.notEqual(m,base);assert.equal(m.cloneOf,base);assert.equal(g.children[1].material,glass,'transparent kept');assert.equal(g.children[2].material,flat,'basic kept');
 assert.equal(m.customProgramCacheKey(),'xsk','one shared program for every skin');const sh={uniforms:{},vertexShader:'void main(){\n#include <begin_vertex>\n}',fragmentShader:'void main(){\n#include <map_fragment>\n#include <emissivemap_fragment>\n}'};m.onBeforeCompile(sh);
 assert(sh.vertexShader.includes('vXskP = position')&&sh.fragmentShader.includes('float xskLn')&&sh.fragmentShader.includes('totalEmissiveRadiance+=xskE')&&sh.uniforms.xskK.value===5&&sh.uniforms.xskPu===A.SKU);
 const g2=new Obj(null,[new Obj(base)]);A.xskApply(g2,'Vandal','elderflame.1');assert.equal(g2.children[0].material,m,'clone cached per material, weapon and skin');
 A.xskApply(g,'Vandal','standard');assert.equal(g.children[0].material,base,'Standard restores the original');A.xskApply(g,'Phantom','prime');assert.equal(g.children[0].material,base,'skin the weapon lacks: Standard');
 const ws=new Obj(null,[new Obj(new Mat())]);A.XV={fp:{w:'Vandal',ws}};A.xskGive('Vandal','prime');A.xskEquip('Vandal','prime.2');A.xskFP();assert.equal(ws.userData.xskId,'prime.2');
 const kw=new Obj(null,[new Obj(new Mat())]);A.XV.fp={w:'Knife',ws:kw};A.xskGive('Knife','oni');A.xskEquip('Knife','oni.1');A.xskFP();assert.equal(kw.userData.xskId,'oni.1','native FP knife takes the knife skin');
 const gun=new Obj(null,[new Obj(new Mat())]),ally=new Obj(null,[new Obj(new Mat())]);A.NET={socket:{}};A.MP={st:'game'};A.bots=[{nid:7,w:'Phantom',xm:{gun}}];A.allies=[{nid:9,w:'Vandal',xm:{gun:ally}}];A.xskNet({t:'sks',m:{7:{Phantom:'reaver.2'}}});
 const fl=new Obj(null,[new Obj(new Mat())]);A.netFloor=new Map([[3,{w:'Vandal',sk:'oni.3',m:{userData:{xdg:fl}}}]]);
 A.xskTP();assert.equal(gun.userData.xskId,'reaver.2','enemy shows their own skin');assert.equal(ally.userData.xskId,'standard','owner without skins: standard (never your skin)');assert.equal(fl.userData.xskId,'oni.3','floor gun shows the dropper skin');}
// Collection / Store render headlessly; actions
{const body={innerHTML:''},tabs=[{dataset:{tab:'col'},classList:{toggle(){}},setAttribute(){}},{dataset:{tab:'store'},classList:{toggle(){}},setAttribute(){}}];
 const U=ctx({},{document:{getElementById:id=>id==='xSk'?{querySelector:()=>body,querySelectorAll:()=>tabs}:null,body:null}});
 U.xskAct('tab',null,'col');let h=body.innerHTML;for(const [c,l] of cat.categories){assert(h.includes('<h3>'+c+'</h3>'),c);for(const w of l)assert(h.includes('data-w="'+w+'"'),w);}assert.equal((h.match(/class="xsk-wc"/g)||[]).length,19);
 U.xskAct('weapon','Vandal');h=body.innerHTML;assert(h.includes('id="xskCv"'),'3D preview canvas');for(const c of lines.filter(c=>c.skins.Vandal))assert(h.includes('>'+c.skins.Vandal.n+'<'),c.skins.Vandal.n);assert(!h.includes('Prime//2.0 Vandal'));
 U.xskAct('pick',null,'oni.2');h=body.innerHTML;assert.equal((h.match(/role="radio"/g)||[]).length,4,'Base + three variant swatches');for(const n of ['Kumo','Hana','Tsubame'])assert(h.includes('aria-label="'+n+'"'),n);assert(h.includes('Get · FREE'),'unowned: Get FREE');
 assert(U.xskAct('get',null,'oni.2'));assert.equal(U.xskGet('Vandal'),'oni.2','Get from the weapon page adds and equips the picked variant');assert(body.innerHTML.includes('>Equipped<'));
 U.xskAct('pick',null,'oni');assert(body.innerHTML.includes('data-a="equip" data-id="oni"'));U.xskAct('equip',null,'oni');assert.equal(U.xskGet('Vandal'),'oni');
 assert.equal(U.xskAct('pick',null,'prime2'),false,'Prime//2.0 has no Vandal');U.xskAct('back');assert(body.innerHTML.includes('xsk-col'));assert(body.innerHTML.includes('Oni Vandal'));
 U.xskAct('tab',null,'store');h=body.innerHTML;assert(h.includes('Featured bundle'));assert.equal((h.match(/class="xsk-of"/g)||[]).length,4+lines.length,'four daily offers + every collection');
 assert(!/\$|€|£|\bVP\b|valorant points|radianite|price|buy now|checkout/i.test(h.replace(/xsk-[a-z]+/g,'')),'no currency or payment anywhere');assert((h.match(/FREE/g)||[]).length>=5+lines.length);
 const fid=U.xskFeatured(),fc=lines.find(c=>c.id===fid);assert(U.xskAct('bundle',null,fid));assert.equal(Object.keys(fc.skins).filter(w=>U.xskOwns(w,fid)).length,Object.keys(fc.skins).length,'bundle adds every skin of the line');
 const o=U.xskOffers()[0];assert(cat.collections.find(c=>c.id===o.c).skins[o.w],'offers only real weapon skins');if(!U.xskOwns(o.w,o.c)){assert(U.xskAct('get',o.w,o.c));assert(U.xskOwns(o.w,o.c));}
 deq(U.xskOffers(Date.UTC(2026,9,25,12)),U.xskOffers(Date.UTC(2026,9,25,13)),'offers stable within a day');}
// layout: touch targets and short / portrait rules exist
assert(/@media\(max-width:600px\)/.test(src)&&/@media\(max-height:480px\)/.test(src),'390x844 and 640x360 rules');
for(const sel of ['.xsk-tabs button{','.xsk-wc{','.xsk-sk{','.xsk-ch button{','.xsk-get,#xSk .xsk-eq{','.xsk-spr,#xSk .xsk-x{'])assert(new RegExp(sel.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'[^}]*(min-height|height):(4[4-9]|5[0-9])px').test(src),'44px touch target '+sel);
// wiring in the built page and the online client
assert.equal(html.split('// ---- WEAPON SKINS ----').length,2,'skins block installed once');assert(html.includes('var XSK_CAT = '+JSON.stringify(cat)+';'),'catalogue embedded from server/src/skins.json');
assert(sr.includes("sk:typeof xskWire==='function'?xskWire():undefined"),'hi carries skins');assert(sr.includes("if((m.t==='sk'||m.t==='sks'||m.t==='skr')&&typeof xskNet==='function')return xskNet(m);"),'skin frames routed');
assert(sr.includes("if(typeof r[5]==='string')d.sk=r[5];"),'floor rows keep the skin');
console.log('skins: catalogue, persistence, wire, patch/apply (FP/TP/floor), Collection/Store render + actions ok');
