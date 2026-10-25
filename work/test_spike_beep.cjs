// Spike beep cadence (VALORANT game data, valorant.gs/rules): every 1 s, 0.5 s under 20 s left, 0.25 s under 10 s, 0.15 s under
// 5 s, 0.1 s in the last second; the wiki (wiki.playvalorant.com/en-us/Spike) describes the same steps as double beeping at 20 s
// and triple beeping at 10 s. The old curve ramped 1 -> 2 beeps/s over the first 35 s and jumped to 4/s and 8/s at 10 s / 7 s.
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict');
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const m=/const xSpHz = \(f\) => [^\n]*;/.exec(html);assert(m,'xSpHz');const c=vm.createContext({});vm.runInContext(m[0].replace('const ','this.')+'',c);
const gap=f=>+(1/c.xSpHz(f)).toFixed(3);
assert.equal(gap(45),1);assert.equal(gap(20.5),1);assert.equal(gap(19.5),.5);assert.equal(gap(10.5),.5);assert.equal(gap(9.5),.25);assert.equal(gap(5.5),.25);assert.equal(gap(4.5),.15);assert.equal(gap(1.5),.15);assert.equal(gap(.5),.1);
assert.ok(/const hz = xSpHz\(fuse \|\| 0\)/.test(html),'beep loop driven by xSpHz(fuse)');
console.log('Spike beep cadence: 1 s, 0.5 s <20 s, 0.25 s <10 s, 0.15 s <5 s, 0.1 s <1 s');
