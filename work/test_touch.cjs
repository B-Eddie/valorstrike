// Touch controls regression (ledger row 7): every on-screen button reaches its action; Plant/defuse and Use are holds (key
// down on press, key up on release) so Spike plant/defuse, floor-gun pick-up, doors and orb capture work on phones; the
// left FIRE is the same hold as FIRE; the menu button toggles the menu without needing a live round; menu-only actions
// (ping, drop) send their keys.
const assert=require('assert/strict'),fs=require('fs'),vm=require('vm'),html=fs.readFileSync('index.html','utf8');
const d0=html.indexOf('const DEF = { fire:'),d1=html.indexOf('\n',d0);const DEF=vm.runInNewContext('('+html.slice(d0+12,d1).replace(/;\s*$/,'')+')');
assert(DEF.use&&DEF.plant&&DEF.menu&&DEF.fire2,'use, plant, menu and left fire buttons defined');
for(const k in DEF)if(k!=='use'){const a=DEF.use,b=DEF[k];const dx=(a[0]-b[0])*8,dy=(a[1]-b[1])*4.5;assert(Math.hypot(dx,dy)>(a[2]+b[2])/2,'use button clear of '+k);} // ~800x450 fallback
const a=html.indexOf('  const kd = (code) =>',d1),b=html.indexOf('  const P = {};',a);assert(a>0&&b>a);
const ev=[];const cls=new Set();const T={classList:{toggle:(c,on)=>{if(on===undefined)on=!cls.has(c);if(on)cls.add(c);else cls.delete(c);return on;},contains:c=>cls.has(c)}};
const c={dispatchEvent:e=>ev.push(e.type+':'+e.code),KeyboardEvent:function(t,o){this.type=t;this.code=o.code;},running:true,paused:false,player:{hp:100},mode:'five',J:{},rw:'pri',fireHeld:false,AM:{},T,B:{menu:{setAttribute(){}}},mSync:()=>ev.push('msync'),
 shoot:()=>ev.push('shoot'),rsFire:()=>false,jOn:()=>false,pause:()=>ev.push('pause'),rgOpen:()=>ev.push('drills'),xScopeT:()=>ev.push('zoom'),swapW:w=>ev.push('swap:'+w),FV:{pri:'Vandal'},slots:{},setTimeout,clearTimeout,camera:{fov:70},S:{tsens:1},VM:{sx:0,sy:0},yaw:0,pitch:0,Math};
vm.createContext(c);vm.runInContext(html.slice(a,b).replace('function mSync(','function mSyncPage(')+';globalThis.press=press;globalThis.release=release;',c);
const hold=(k,down,up)=>{ev.length=0;c.press(k);assert.deepEqual(ev,[down],k+' press');ev.length=0;c.release(k);assert.deepEqual(ev,[up],k+' release');};
hold('use','keydown:KeyF','keyup:KeyF');hold('plant','keydown:Digit4','keyup:Digit4');hold('jump','keydown:Space','keyup:Space');hold('duck','keydown:ControlLeft','keyup:ControlLeft');
ev.length=0;c.press('reload');assert.deepEqual(ev,['keydown:KeyR','keyup:KeyR']);
for(const k of ['fire','fire2']){ev.length=0;c.press(k);assert.equal(c.fireHeld,true,k+' holds fire');assert.deepEqual(ev,['shoot']);c.release(k);assert.equal(c.fireHeld,false,k+' release');}
ev.length=0;c.press('ping');assert.deepEqual(ev,['keydown:KeyZ','keyup:KeyZ'],'ping taps Z');ev.length=0;c.press('drop');assert.deepEqual(ev,['keydown:KeyG','keyup:KeyG'],'drop taps G');
for(const k of Object.keys(DEF)){ev.length=0;cls.clear();c.press(k);c.release(k);if(k!=='fire'&&k!=='fire2'&&k!=='menu')assert(ev.length>0,'button '+k+' does something');}
cls.clear();c.press('menu');assert(cls.has('mo'),'menu opens');c.press('menu');assert(!cls.has('mo'),'menu closes');
c.paused=true;ev.length=0;c.press('use');assert.equal(ev.length,0,'no input while paused');c.press('menu');assert(cls.has('mo'),'menu still opens while not live');
console.log('touch buttons ok: '+Object.keys(DEF).length+' buttons; use/plant are holds; left FIRE = FIRE; menu toggles; ping / drop keys');
