// Chromium lock for lane three: /workspace/work/qa/LOCK-chromium.txt holds "three <pid> <iso>" while held.
// take(): waits while another lane holds it (a holder line with a pid is cleared only when that pid is dead), or while a
// suite runs / a headless_shell is alive. drop(): clears it only if we hold it.
const fs = require('fs'), cp = require('child_process');
const L = '/workspace/work/qa/LOCK-chromium.txt', S = '/workspace/work/qa/LOCK-suite.txt';
const alive = (pid) => { try { process.kill(pid, 0); return true; } catch (e) { return e.code === 'EPERM'; } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function held() {
  let s = ''; try { s = fs.readFileSync(L, 'utf8').trim(); } catch (e) {}
  if (s) { const m = /^(\S+)\s+(\d+)(?:\s|$)/.exec(s); if (m && m[1] !== 'three' && !alive(+m[2])) { fs.writeFileSync(L, ''); s = ''; } else if (m && m[1] === 'three' && +m[2] !== process.pid && !alive(+m[2])) { fs.writeFileSync(L, ''); s = ''; } }
  if (s) return s;
  try { if (/RUNNING/.test(fs.readFileSync(S, 'utf8'))) return 'suite'; } catch (e) {}
  try { cp.execFileSync('pgrep', ['-x', 'headless_shell'], { stdio: 'pipe' }); return 'headless_shell alive'; } catch (e) {}
  return '';
}
async function take(log) {
  for (;;) { const h = held(); if (!h) { fs.writeFileSync(L, 'three ' + process.pid + ' ' + new Date().toISOString()); await sleep(300); if (fs.readFileSync(L, 'utf8').startsWith('three ' + process.pid + ' ')) return; }
    else if (h.startsWith('three ' + process.pid + ' ')) return; (log || console.log)('lock held: ' + h); await sleep(30000); }
}
function drop() { try { if (fs.readFileSync(L, 'utf8').startsWith('three ' + process.pid + ' ')) fs.writeFileSync(L, ''); } catch (e) {} }
module.exports = { take, drop };
