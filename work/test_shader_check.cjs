// Every WebGLRenderer creation must go through xShChk (checkShaderErrors off
// unless ?shaderdebug): three reads every program/shader info log after each
// link otherwise, forcing synchronous compiles - 79% of the first frames.
const fs = require('fs');
const s = fs.readFileSync('index.html', 'utf8');
const re = /new THREE\.WebGLRenderer/g;
let m, bad = 0, n = 0;
while ((m = re.exec(s))) {
  n++;
  const before = s.slice(Math.max(0, m.index - 12), m.index);
  if (!/xShChk\(\s*$/.test(before)) { bad++; console.error('unwrapped WebGLRenderer at offset', m.index); }
}
if (!/function xShChk\(r\)/.test(s)) { console.error('xShChk helper missing'); bad++; }
if (!/shaderdebug/.test(s)) { console.error('?shaderdebug escape hatch missing'); bad++; }
if (n < 5) { console.error('expected >=5 renderer sites, found', n); bad++; }
if (bad) { process.exitCode = 1; } else { console.log('PASS: all', n, 'WebGLRenderer creations wrapped by xShChk'); }
