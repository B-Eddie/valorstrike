// Touch controls regression (ledger row 7): every on-screen button reaches its action; Plant/defuse and the new Use
// button are holds (key down on press, key up on release) so Spike plant/defuse, floor-gun pick-up, doors and orb
// capture work on phones; Use has a default layout slot that does not overlap the other left-side buttons.
const assert=require('assert/strict'),fs=require('fs'),vm=require('vm'),html=fs.readFileSync('index.html','utf8');
const d0=html.indexOf('const DEF = { fire:'),d1=html.indexOf('\n',d0);const DEF=vm.runInNewContext('('+html.slice(d0+12,d1).replace(/;\s*$/,'')+')');
assert(DEF.use&&DEF.plant,'use and plant buttons defined');
for(const k in DEF)if(k!=='use'){const a=DEF.use,b=DEF[k];const dx=(a[0]-b[0])*8,dy=(a[1]-b[1])*4.5;assert(Math.hypot(dx,dy)>(a[2]+b[2])/2,'use button clear of '+k);} // ~800x450 landscape phone
const a=html.indexOf('  const kd = (code) =>',d1),b=html.indexOf('  const P = {};',a);assert(a>0&&b>a);
const ev=[];const c={dispatchEvent:e=>ev.push(e.type+':'+e.code),KeyboardEvent:function(t,o){this.type=t;this.code=o.code;},running:true,paused:false,player:{hp:100},mode:'five',J:{},rw:'pri',fireHeld:false,AM:{},
 shoot:()=>ev.push('shoot'),rsFire:()=>false,jOn:()=>false,pause:()=>ev.push('pause'),rgOpen:()=>ev.push('drills'),xScopeT:()=>ev.push('zoom'),swapW:w=>ev.push('swap:'+w),FV:{pri:'Vandal'},slots:{},setTimeout,clearTimeout,camera:{fov:70},S:{tsens:1},VM:{sx:0,sy:0},yaw:0,pitch:0,Math};
vm.createContext(c);vm.runInContext(html.slice(a,b)+';globalThis.press=press;globalThis.release=release;',c);
const hold=(k,down,up)=>{ev.length=0;c.press(k);assert.deepEqual(ev,[down],k+' press');ev.length=0;c.release(k);assert.deepEqual(ev,[up],k+' release');};
hold('use','keydown:KeyF','keyup:KeyF');hold('plant','keydown:Digit4','keyup:Digit4');hold('jump','keydown:Space','keyup:Space');hold('duck','keydown:ControlLeft','keyup:ControlLeft');
ev.length=0;c.press('reload');assert.deepEqual(ev,['keydown:KeyR','keyup:KeyR']);
ev.length=0;c.press('fire');assert.equal(c.fireHeld,true);c.release('fire');assert.equal(c.fireHeld,false);
for(const k of Object.keys(DEF)){ev.length=0;c.press(k);c.release(k);if(k!=='fire')assert(ev.length>0,'button '+k+' does something');}
c.paused=true;ev.length=0;c.press('use');assert.equal(ev.length,0,'no input while paused');
console.log('touch buttons ok: '+Object.keys(DEF).length+' buttons; use/plant are holds');
