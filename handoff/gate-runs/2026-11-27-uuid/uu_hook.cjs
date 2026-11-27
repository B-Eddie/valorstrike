// UU=1 preload hook for the offline page harness (work/page_harness.cjs + work/audit.js), used as
//   UU=1 NODE_OPTIONS="--require <this file>" node work/test_bot_feel_offline.cjs
// It wraps fs.readFileSync so every read of a file named three.min.js (audit.js line ~279 loads REAL3_DIR/three.min.js into
// the page context with fs.readFileSync) gets Jeff's exact __uu patch (minified generateUUID with 4294967295). For the
// unminified r160 three.cjs wrapper (written by page_harness threeDir() when the tree has no vendor/three) an EXTRA variant
// regex for `function generateUUID() {\n\tconst d0 = Math.random() * 0xffffffff | 0; ...}` is applied, reported as variant=ffffffff.
// No product file is modified. Every patched read is logged to stderr and to $UU_LOG (if set); a three.min.js read the patch
// does not match aborts the process (exit 3).
if (process.env.UU === '1') {
  const fs = require('fs');
  function __uu(text){return text.replace(/function ([A-Za-z_$][\w$]*)\(\)\{(?:const|let) [^}]*?4294967295[^}]*?\}/,(m,n)=>'function '+n+'(){const t=(globalThis.__u=(globalThis.__u||0)+1).toString(16).padStart(12,"0");return"00000000-0000-4000-8000-"+t}');}
  const RE_MIN = /function ([A-Za-z_$][\w$]*)\(\)\{(?:const|let) [^}]*?4294967295[^}]*?\}/;
  const RE_FF = /function ([A-Za-z_$][\w$]*)\(\)\s*\{\s*(?:const|let) [^}]*?0xffffffff[^}]*?\}/; // extra: unminified r160
  const uuFF = (text) => text.replace(RE_FF, (m, n) => 'function ' + n + '(){const t=(globalThis.__u=(globalThis.__u||0)+1).toString(16).padStart(12,"0");return"00000000-0000-4000-8000-"+t}');
  const orig = fs.readFileSync;
  const say = (s) => { process.stderr.write('[uu_hook] ' + s + '\n'); if (process.env.UU_LOG) fs.appendFileSync(process.env.UU_LOG, s + '\n'); };
  fs.readFileSync = function (p, ...a) {
    const r = orig.call(this, p, ...a);
    if (typeof p === 'string' && /(^|[\/\\])three\.min\.js$/.test(p)) {
      const txt = typeof r === 'string' ? r : r.toString('utf8');
      let out = txt, variant = null, fn = null, m;
      if ((m = RE_MIN.exec(txt))) { out = __uu(txt); variant = '4294967295 (Jeff exact)'; fn = m[1]; }
      else if ((m = RE_FF.exec(txt))) { out = uuFF(txt); variant = '0xffffffff (extra r160 variant)'; fn = m[1]; }
      const ok = out !== txt;
      const rev = (/REVISION\s*=\s*"(\d+)"|REVISION="(\d+)"|="(\d+)"/.exec(txt) || []).slice(1).find(Boolean) || '?';
      say('read ' + p + ' rev=' + rev + ' matched=' + (ok ? 'yes' : 'no') + ' variant=' + variant + ' fn=' + fn + ' bytes ' + txt.length + '->' + out.length);
      if (!ok) { say('ABORT: UU patch did not match ' + p); process.exit(3); }
      return typeof r === 'string' ? out : Buffer.from(out, 'utf8');
    }
    return r;
  };
  say('hook active pid ' + process.pid);
}
