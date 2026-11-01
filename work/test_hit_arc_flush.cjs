// Being shot: the directional damage arc must restart its fade without a synchronous style flush (perf2 round 2, user
// 1 Nov 2026: "theres still some lag when im getting hit").
// Before: xDmgArc -> xRestart(arc, "on"); the 4 pooled arcs keep their "on" class after the first 4 hits of a match, so every
// later hit took the getAnimations() branch, and Element.getAnimations() flushes style (Chromium and Firefox both bring
// style up to date before answering). Trace of 3 bots firing at the player (qa/perf2 hitbench2 TRACE): 18 forced
// UpdateLayoutTree inside JS in 6 s, 3.3 ms each on the test box, on top of the frame's own style pass.
// After: each arc owns one persistent Web Animation with the same keyframes / timing as `.x-da.on` (@keyframes x-dafade
// 0% opacity 1 -> 100% opacity 0, .6 s ease-out, forwards); a hit rewinds it (currentTime = 0) and plays it. No
// getAnimations, no class toggle, no style read. Without Element.animate the old class restart is kept.
//   node work/test_hit_arc_flush.cjs
const fs=require('fs'),vm=require('vm'),assert=require('assert/strict'),path=require('path');
const s=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const fn=(name)=>{const a=s.indexOf('\nfunction '+name+'(');assert(a>=0,name+' missing');let i=s.indexOf('{',a),d=0;for(;i<s.length;i++){if(s[i]==='{')d++;else if(s[i]==='}'&&!--d)break;}return s.slice(a+1,i+1);};
// 1. the CSS look the animation copies is unchanged
assert.match(s,/\.x-da\.on\{animation:x-dafade \.6s ease-out forwards\}/,'.x-da.on fade: .6s ease-out forwards');
assert.match(s,/@keyframes x-dafade\{0%\{opacity:1\}100%\{opacity:0\}\}/,'x-dafade keyframes: opacity 1 -> 0');
// 2. xDmgArc in a sandbox with fake arcs
const extra=['xDaPlay'].filter(n=>s.includes('\nfunction '+n+'(')).map(fn).join('\n');
const consts=(s.match(/\nconst XDA_K = [^\n]*/)||[''])[0];
const src=[consts,fn('xRestart'),extra,fn('xDmgArc')].join('\n');
const mk=(withAnimate)=>{const log={flush:0,animate:[],plays:0,rewinds:0,styleReads:0,cls:0};
 const arc=()=>{const cls=new Set();const st={};let tf='';const el={classList:{contains:k=>cls.has(k),add:k=>{log.cls++;cls.add(k);},remove:k=>{log.cls++;cls.delete(k);}},
  style:new Proxy(st,{get:(o,k)=>{if(k==='transform')return tf;return o[k];},set:(o,k,v)=>{if(k==='transform')tf=v;else o[k]=v;return true;}}),
  getAnimations(){log.flush++;return [];},get offsetWidth(){log.styleReads++;return 0;},getBoundingClientRect(){log.styleReads++;return {};},get tf(){return tf;}};
  if(withAnimate)el.animate=(k,t)=>{const a={_t:0,get currentTime(){return this._t;},set currentTime(v){log.rewinds++;this._t=v;},play(){log.plays++;},cancel(){}};log.animate.push({k:JSON.parse(JSON.stringify(k)),t:JSON.parse(JSON.stringify(t))});return a;};
  return el;};
 const c={XKI:{da:[arc(),arc(),arc(),arc()],di:0},camera:{position:{x:0,z:0}},yaw:0,Math,requestAnimationFrame:f=>setImmediate(f),getComputedStyle(){log.styleReads++;return {};}};
 vm.createContext(c);vm.runInContext(src,c);return {c,log};};
{ const {c,log}=mk(true);
  for(let i=0;i<12;i++)c.xDmgArc(Math.sin(i)*5,Math.cos(i)*5); // 12 hits: every arc is reused twice while / after its fade
  assert.equal(log.flush,0,'no getAnimations() (style flush) on any of 12 hits (was: every hit after the 4th)');
  assert.equal(log.styleReads,0,'no layout / style reads');
  assert.equal(log.animate.length,4,'one persistent animation per arc (4), created on first use, never per hit');
  for(const a of log.animate){assert.deepEqual(a.k,[{opacity:1,easing:'ease-out'},{opacity:0}],'keyframes = x-dafade with the .x-da.on ease-out');assert.deepEqual(a.t,{duration:600,fill:'forwards'},'.6 s, forwards');}
  assert.equal(log.plays,12,'every hit plays its arc');assert.equal(log.rewinds,12,'every hit rewinds its arc to the start (currentTime 0)');
  assert.equal(log.cls,0,'no class toggles (no style invalidation of the arc)');
  assert.match(c.XKI.da[1].tf,/^rotate\(-?\d+\.\d{3}rad\)$/,'arc still rotated toward the attacker'); }
{ const {c,log}=mk(false); // no Element.animate: the class restart is kept
  for(let i=0;i<6;i++)c.xDmgArc(1,1);
  assert.ok(log.cls>=4,'fallback still uses the .on class');assert.equal(log.animate.length,0); }
console.log('damage arcs: 12 hits, 0 style flushes, 4 persistent animations (x-dafade .6s ease-out forwards), fallback kept');
