// In-game performance readout (gpu lane, user 31 Oct 2026: "so laggy it's unplayable" on a GPU we cannot see): the
// Settings "Show FPS and ping" readout (off by default) also reports the frame time and the worst frame of each 0.5 s
// window (stutter, not only the average), triangles, and the render resolution against the screen's devicePixelRatio,
// so the user can send us his numbers; F9 toggles it in a match (same setting, saved like the switch).
const fs=require('fs'),vm=require('vm'),assert=require('assert/strict'),s=fs.readFileSync(__dirname+'/../index.html','utf8');
const fn=n=>{const a=s.indexOf('function '+n+'(');assert(a>=0,n+' missing');let i=s.indexOf('{',a),d=0;for(;i<s.length;i++){if(s[i]==='{')d++;else if(s[i]==='}'&&!--d)break;}return s.slice(a,i+1);};
const c={};vm.createContext(c);vm.runInContext(fn('xFpsText'),c);
const t=c.xFpsText(58.6,17.06,41.2,23,254,1234567,2880,1620,1.5,1.5);
assert.match(t,/^59 FPS/);assert.match(t,/17\.1 ms/);assert.match(t,/worst 41/);assert.match(t,/23 ms ping/);assert.match(t,/254 calls/);assert.match(t,/1\.23M tris/);assert.match(t,/2880×1620 @1\.5/);assert.match(t,/DPR 1\.5/);
// the loop feeds it: frame intervals, worst per window, renderer.info, drawing-buffer size, pixel ratio
const loop=s.slice(s.indexOf('try { if (S.fps)'),s.indexOf('\n',s.indexOf('try { if (S.fps)')));
assert.match(loop,/xFpsText\(/);assert.match(loop,/xFpsW/);assert.match(loop,/renderer\.info\.render/);assert.match(loop,/\.triangles/);assert.match(loop,/domElement/);assert.match(loop,/el\.width, el\.height/);
// default off, F9 toggles through the settings switch (saved + shown like a click on it)
assert.match(s,/data-key="fps"><button data-v="0" class="on">Off<\/button>/,'readout no longer off by default');
assert.match(s,/e\.code === "F9"/,'no F9 toggle');assert.match(s.slice(s.indexOf('e.code === "F9"'),s.indexOf('e.code === "F9"')+400),/data-key="fps"\] button\[data-v=/,'F9 does not go through the settings switch');
console.log('test_fps_readout OK:',t);
