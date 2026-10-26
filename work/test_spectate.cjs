// Spectating after death is first person only, as VALORANT (user 2026-10-26: "There isn't supposed to be a 3rd person when
// spectating when dead"): no 3rd-person button, V does nothing, no third-person / orbit camera branch in the render path; the
// card -> spectate flow still frees the pointer without pausing and canvas clicks while dead do not re-lock or fire.
const fs=require('fs'),vm=require('vm'),assert=require('assert/strict'),s=fs.readFileSync(__dirname+'/../index.html','utf8');
const cut=(a,b)=>{const i=s.indexOf(a);assert(i>=0,a);const j=s.indexOf(b,i);assert(j>=0,b);return s.slice(i,j);};
class El{constructor(tag){this.tag=tag;this.children=[];this.listeners={};this.attrs={};this.style={};this.cls=new Set();this.classList={add:k=>this.cls.add(k),remove:k=>this.cls.delete(k),toggle:(k,on)=>{on=on===undefined?!this.cls.has(k):on;on?this.cls.add(k):this.cls.delete(k);},contains:k=>this.cls.has(k)};this.firstChild={textContent:''};}
 set innerHTML(h){this._h=h;this.kids={span:new El('span')};}
 querySelector(q){if(q==='span')return this.kids.span;return null;}
 querySelectorAll(){return [new El('dd'),new El('dd')];}
 addEventListener(k,f){(this.listeners[k]||(this.listeners[k]=[])).push(f);}
 setAttribute(k,v){this.attrs[k]=v;}
}
let locked=true,exits=0,said=[];const doc={createElement:t=>new El(t),body:{appendChild(){}},get pointerLockElement(){return locked?{}:null;},exitPointerLock(){exits++;locked=false;}};
const win={};const c={document:doc,allies:[{name:'Sage',alive:true}],bots:[{name:'Bot',alive:true,g:{}}],player:{hp:0},say:(t)=>said.push(t),renderer:{domElement:{style:{}}},mode:'five',FV:{dm:false},MP:{m5:false},console,THREE:{Vector3:class{}},XOB:{},xAg:()=>'',addEventListener:(k,f)=>{(win[k]||(win[k]=[])).push(f);}};vm.createContext(c);
vm.runInContext(cut('const xTP = {','\n').replace('const xTP','var xTP')+'\n'+cut('let xHS = false; const xKL','// observer pass: first-person').replace('let xHS','var xHS').replace('const xKL =','var xKL =').replace(/^const xKLm/m,'var xKLm')+'\n'+cut('// observer pass: first-person','function xObsEye(').replace('const XOB =','var XOB2 ='),c);
vm.runInContext('xKLDie("Bot","Vandal")',c);assert(c.xKL.on);
assert.equal(c.xSpec(1),null,'killed-by card first');assert.equal(locked,true);
assert.equal(c.xSpec(2.5).name,'Sage','a living teammate after the card');assert(c.xKL.sp);assert.equal(locked,false,'pointer lock released (click / Space cycle)');assert.equal(exits,1);
assert.equal(c.xKL.tp,null,'no 3rd-person button');assert.doesNotMatch(c.xKL.sl._h,/3RD PERSON|x-sp__tp|<button/i,'spectate bar has no 3rd-person control');
assert.match(c.xKL.sl._h,/next teammate/);assert.equal(c.xKL.sn.textContent,'SPECTATING SAGE');
// V while dead: no handler toggles anything (no KeyV listener in the spectate code; xTP stays off)
assert.ok(!(win.keydown||[]).some(f=>/KeyV/.test(String(f))),'no V toggle');assert.equal(c.xTP.on,false);
assert.ok(!/function xTPToggle|function xTPCam|xTP\.on = !xTP\.on/.test(s),'third-person spectate code removed');
// the render path: teammate's eye (first person) or the held last view - never a 3rd-person / orbit camera
const rp=cut('if (mode !== "duel" && player.hp <= 0) { const a = xSpec(rt);','// spectate floor guard');
assert.match(rp,/if \(a\) \{ const e = xObsEye\(a, dt\); XOB\.fp = a;/);assert.doesNotMatch(rp,/xTPCam|xObsOrbit/);assert.ok(!/function xObsOrbit/.test(s),'spike orbit removed');
// pointerlockchange must not pause while spectating; canvas mousedown must not re-lock or shoot.
assert.match(s,/!\(player && player\.hp <= 0 && xKL\.sp\) && performance\.now\(\) - \(FV\.mt \|\| 0\) > 700\) pause\(\)/);
assert.match(cut('const xMD = (e) => {','function xBind('),/if \(player && player\.hp <= 0 && xKL\.sp\) return;[^\n]*\n  if \(!document\.pointerLockElement\)/);
// the followed teammate's own view pitch: online the server's (u.np), offline the bot's aim, else level
vm.runInContext(cut('function xObsPitch(a)','\n'),c);assert.equal(c.xObsPitch({np:0.3}),0.3);assert.ok(Math.abs(c.xObsPitch({xaimOn:true,xaim:{x:0,y:Math.sin(-0.2),z:1}})+0.2)<1e-9);assert.equal(c.xObsPitch({}),-0.04);
console.log('Spectate: first person only (no 3rd-person button / V toggle / orbit), pointer released without pausing, canvas clicks do not re-lock, teammate pitch followed');
