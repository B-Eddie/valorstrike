// Spectator third-person control: a real button that is clickable (spectating frees the pointer
// lock without pausing), toggles the follow cam and its label, and canvas clicks while dead do
// not re-lock or fire.
const fs=require('fs'),vm=require('vm'),assert=require('assert/strict'),s=fs.readFileSync(__dirname+'/../index.html','utf8');
const cut=(a,b)=>{const i=s.indexOf(a);assert(i>=0,a);const j=s.indexOf(b,i);assert(j>=0,b);return s.slice(i,j);};
class El{constructor(tag){this.tag=tag;this.children=[];this.listeners={};this.attrs={};this.style={};this.cls=new Set();this.classList={add:k=>this.cls.add(k),remove:k=>this.cls.delete(k),toggle:(k,on)=>{on=on===undefined?!this.cls.has(k):on;on?this.cls.add(k):this.cls.delete(k);},contains:k=>this.cls.has(k)};this.firstChild={textContent:''};}
 set innerHTML(h){this._h=h;this.kids={};const m=h.match(/<button[^>]*>([^<]*)/);if(m)this.kids.button=Object.assign(new El('button'),{});if(m)this.kids.button.firstChild.textContent=m[1];this.kids.span=new El('span');}
 querySelector(q){if(q==='.x-sp__tp')return this.kids.button;if(q==='span')return this.kids.span;return new El('x');}
 querySelectorAll(){return [new El('dd'),new El('dd')];}
 addEventListener(k,f){(this.listeners[k]||(this.listeners[k]=[])).push(f);}
 setAttribute(k,v){this.attrs[k]=v;}
 fire(k){for(const f of this.listeners[k]||[])f({preventDefault(){},stopPropagation(){this.stopped=true;}});}
}
let locked=true,exits=0,paused=0,said=[];const doc={createElement:t=>new El(t),body:{appendChild(){}},get pointerLockElement(){return locked?{}:null;},exitPointerLock(){exits++;locked=false;}};
const c={document:doc,allies:[{name:'Sage',alive:true}],player:{hp:0},say:(t)=>said.push(t),renderer:{domElement:{style:{}}},mode:'five',console,THREE:{Vector3:class{}},XOB:{}};vm.createContext(c);
vm.runInContext(cut('const xTP = {','addEventListener("keydown", (e) => { if (e.code === "KeyV"').replace('const xTP','var xTP')+'\n'+cut('let xHS = false; const xKL','// observer pass: first-person').replace('let xHS','var xHS').replace('const xKL =','var xKL =').replace(/^const xKLm/m,'var xKLm').replace(/addEventListener\("mousedown"[^\n]*\n/,''),c);
vm.runInContext('xKLDie("Bot","Vandal")',c);assert(c.xKL.on);
assert.equal(c.xSpec(1),null,'killed-by card first');assert.equal(locked,true);
c.xSpec(2.5);assert(c.xKL.sp,'spectating after the killed-by card');assert.equal(locked,false,'pointer lock released so the button is clickable');assert.equal(exits,1);
const tp=c.xKL.tp;assert(tp,'3rd-person button exists');assert.match(c.xKL.sl._h,/<button type="button" class="x-sp__tp"/);
tp.fire('click');assert.equal(c.xTP.on,true);assert.equal(tp.attrs['aria-pressed'],'true');assert(tp.cls.has('on'));assert.match(tp.firstChild.textContent,/1ST PERSON/);
tp.fire('click');assert.equal(c.xTP.on,false);assert.match(tp.firstChild.textContent,/3RD PERSON/);
// Clicks on the button do not reach the window-level "switch player" handler.
let stopped=false;for(const f of tp.listeners.mousedown)f({stopPropagation(){stopped=true;}});assert(stopped);
// pointerlockchange must not pause while spectating; canvas mousedown must not re-lock or shoot.
assert.match(s,/!\(player && player\.hp <= 0 && xKL\.sp\) && performance\.now\(\) - \(FV\.mt \|\| 0\) > 700\) pause\(\)/);
assert.match(cut('const xMD = (e) => {','function xBind('),/if \(player && player\.hp <= 0 && xKL\.sp\) return;[^\n]*\n  if \(!document\.pointerLockElement\)/);
// The camera path still drives the follow cam from xTP.on while spectating.
assert.match(s,/if \(xTP\.on && xKL\.sp\) \{ xTPCam\(a, dt\);/);
console.log('Spectate: real 3rd-person button, pointer released without pausing, toggle/label/aria state, clicks isolated from player switching, canvas clicks do not re-lock');
