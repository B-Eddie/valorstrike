// Hit-feedback cost regression: dealing or taking damage must not force synchronous layout or
// repaint expensive full-screen filters/shadows (the reported per-hit lag spike).
const fs=require('fs'),vm=require('vm'),assert=require('assert/strict'),s=fs.readFileSync(__dirname+'/../index.html','utf8');
const fn=(name)=>{const a=s.indexOf('function '+name+'(');assert(a>=0,name);let i=s.indexOf('{',a),d=0;for(;i<s.length;i++){if(s[i]==='{')d++;else if(s[i]==='}'&&!--d)break;}return s.slice(a,i+1);};
for(const n of ['vmHit','xDmgArc','flash','hurt','xTag'])assert.doesNotMatch(fn(n),/offsetWidth|getBoundingClientRect|getComputedStyle/,n+' forces layout');
const css=(sel)=>[...s.matchAll(new RegExp(sel.replace(/[.#]/g,m=>'\\'+m)+'\\{[^}]*\\}','g'))].map(m=>m[0]).join(' ');
assert.doesNotMatch(css('#dmg'),/box-shadow/,'hurt overlay uses a gradient, not a blurred inset shadow');
assert.match(css('#dmg'),/will-change:opacity/);
assert.doesNotMatch(css('.x-da'),/filter:|display:none/,'damage arcs: no drop-shadow filter or display toggling');
assert.doesNotMatch(s.match(/@keyframes xDn\{.*?\}\}/)[0],/margin/,'damage numbers animate transform, not layout');
// xRestart: restarts without reading layout, and falls back to a next-frame class toggle.
const a=s.indexOf('function xRestart(');const src=s.slice(a,s.indexOf('\n}',a)+2);const frames=[];const c={requestAnimationFrame:f=>frames.push(f)};vm.createContext(c);vm.runInContext(src,c);
const cls=new Set(),el={classList:{contains:k=>cls.has(k),add:k=>cls.add(k),remove:k=>cls.delete(k)},get offsetWidth(){throw Error('layout read');}};
c.xRestart(el,'on');assert(cls.has('on'));c.xRestart(el,'on');assert(!cls.has('on'));frames.shift()();assert(cls.has('on'));
let restarted=0;const anim={cancel(){},play(){restarted++;}};el.getAnimations=()=>[anim];c.xRestart(el,'on');assert.equal(restarted,1);
console.log('Hit feedback: no forced layout in hit/hurt paths, cheap hurt overlay and damage arcs, transform-only damage numbers, reflow-free animation restart');
