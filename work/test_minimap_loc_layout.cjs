// The current-location callout under the minimap (4 Hz timer) must not force a synchronous layout (perf2 round 2, user
// 1 Nov 2026: "theres still some lag when im getting hit").
// Before: a setInterval(250) read #game.offsetParent and the minimap's getBoundingClientRect() at whatever moment the timer
// fired - usually between frames with layout dirty from the game's HUD writes - so every tick forced a full layout
// (Chromium trace, 3 bots firing at the player: 8 forced UpdateLayoutTree/Layout in 6 s from this timer, 1-5.5 ms each).
// After: the timer only schedules; the same reads run just after the next frame is drawn (requestAnimationFrame ->
// setTimeout 0), when layout is already clean, so they cost nothing. Same text, same left / top (+6 px) / width, still 4 Hz.
// Checks (vm sandbox, fake DOM counting layout reads): (1) the timer callback itself does no layout read (red before: 2),
// (2) after the frame the callout gets the same text / position / size as before, (3) ticks never stack while one waits for
// a frame, (4) hidden when the minimap is off.
//   node work/test_minimap_loc_layout.cjs
const fs=require('fs'),vm=require('vm'),assert=require('assert/strict'),path=require('path');
const s=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const a=s.indexOf('const xLocEl = document.createElement("div");');assert.ok(a>=0,'xLocEl block');
const e=s.indexOf('}, 250);',a);assert.ok(e>a,'4 Hz timer');const src=s.slice(a,e+8);
assert.ok(/setInterval\(/.test(src),'still a timer');
function mk(mmOn){
 const log={reads:0};const ints=[],rafs=[],tos=[];
 const mkEl=()=>({style:{},setAttribute(){},textContent:'',className:''});
 const game={hidden:false,classList:{contains:k=>k==='x-mm'&&mmOn},get offsetParent(){log.reads++;return {};}};
 const MM={getBoundingClientRect(){log.reads++;return {left:20.4,bottom:300.2,width:239.6,top:60,right:260,height:240};}};
 const c={document:{createElement:mkEl,body:{appendChild(){}}},$:id=>id==='game'?game:null,MM,player:{hp:100,x:1,z:2},xKL:{},
  xLoc:(x,z)=>'A SITE',setInterval:(f,ms)=>{ints.push([f,ms]);return 1;},requestAnimationFrame:f=>{rafs.push(f);return 1;},setTimeout:(f)=>{tos.push(f);return 1;},Math,String};
 vm.createContext(c);vm.runInContext(src+'\nthis.xLocEl=xLocEl;',c);
 const frame=()=>{const r=rafs.splice(0);r.forEach(f=>f(16));const t=tos.splice(0);t.forEach(f=>f());};
 return {c,log,ints,rafs,tos,frame};}
{ const {c,log,ints,rafs,frame}=mk(true);
  assert.equal(ints.length,1,'one timer');assert.equal(ints[0][1],250,'still 4 Hz');
  ints[0][0]();
  assert.equal(log.reads,0,'timer tick: no offsetParent / getBoundingClientRect read between frames (each one forced a layout)');
  ints[0][0]();ints[0][0]();
  assert.ok(rafs.length<=1,'ticks do not stack while one waits for the frame ('+rafs.length+' queued)');
  frame();
  assert.ok(log.reads>=1,'reads run after the frame');
  const el=c.xLocEl;
  assert.equal(el.textContent,'A SITE','callout text');assert.equal(el.style.display,'','shown');
  assert.equal(el.style.left,'20px');assert.equal(el.style.top,'306px');assert.equal(el.style.width,'240px');
  const r0=log.reads;ints[0][0]();assert.equal(log.reads,r0,'next tick: again no read inside the timer');frame();assert.ok(log.reads>r0,'next tick read after its frame');
}
{ const {c,ints,frame}=mk(false);ints[0][0]();frame();
  assert.equal(c.xLocEl.style.display,'none','minimap off: callout hidden');}
console.log('test_minimap_loc_layout: OK');
