// DEBUG COPY (gates3, 2026-11-27): h.cjs + DL=1 draw-list dump. With DL=1, every shot whose name matches DLSHOTS (default ^(abil_a\d|vandal_a0)$)
// gets renderer.renderBufferDirect + renderer.info.update + gl.draw*/WEBGL_multi_draw wrapped around its render; dump -> OUTD/<map>-<gq>-<tag>-dl-<shot>.json.
// Lane three harness: boots index.html of ROOT in headless Chromium (SwiftShader), offline. CDN three (origin/main) is
// routed to /workspace/work/qa r149 files; the lane loads vendor/three from ROOT.
//   ROOT=<wt> MODE=map|match MAP=ascent GQ=medium W=1280 H=720 TAG=x STEPS=views,js:<file>,node:<file> node h.cjs
// MODE=map: map only (the runtime's own nmEnsure in the lobby, no match), non-map objects hidden.
// MODE=match: offline 5v5 (Jett), loop stopped after load; the scene is then whatever node:/js: steps make of it.
// Output: OUTD/<map>-<gq>-<tag>.json (+ .log), raw RGBA per shot OUTD/<map>-<gq>-<tag>-<name>.rgba (readPixels, bottom-up).
const PW = '/workspace/work/pw/node_modules/playwright';
process.env.PLAYWRIGHT_BROWSERS_PATH = process.env.PLAYWRIGHT_BROWSERS_PATH || '/workspace/work/pw/browsers'; process.env.LD_LIBRARY_PATH = '/workspace/work/pw/libs';
const { chromium } = require(PW), fs = require('fs'), path = require('path'), http = require('http');
const LK = require('/workspace/work/qa/three/lock.cjs');
// UU=1: UUID determinism patch (Jeff's exact __uu) applied to every three.min.js served (lane static vendor copy and the CDN r149 route for BASE).
const UU = process.env.UU === '1';
function __uu(text){return text.replace(/function ([A-Za-z_$][\w$]*)\(\)\{(?:const|let) [^}]*?4294967295[^}]*?\}/,(m,n)=>'function '+n+'(){const t=(globalThis.__u=(globalThis.__u||0)+1).toString(16).padStart(12,"0");return"00000000-0000-4000-8000-"+t}');}
const UURE = /function ([A-Za-z_$][\w$]*)\(\)\{(?:const|let) [^}]*?4294967295[^}]*?\}/;
function uuServe(file, txt) { const m = UURE.exec(txt); const out = __uu(txt); const ok = !!m && out !== txt; (R.uu = R.uu || []).push({ file, matched: ok, fn: m ? m[1] : null, bytesIn: txt.length, bytesOut: out.length });
  log('UU serve', file, 'matched', ok ? 'yes' : 'no', m ? 'fn=' + m[1] : '');
  if (!ok) { R.errors.push('UU patch did not match ' + file + ' - abort'); log('UU ABORT: patch did not match', file); try { save(); } catch (e) {} process.exit(3); }
  return out; }
const ROOT = process.env.ROOT || '/workspace/work/vs-lane-three', QA = '/workspace/work/qa/', MAP = process.env.MAP || 'ascent', GQ = process.env.GQ || 'medium';
const W = +(process.env.W || 1280), H = +(process.env.H || 720), PORT = +(process.env.PORT || 8961), TAG = process.env.TAG || 'x', MODE = process.env.MODE || 'map';
const STEPS = (process.env.STEPS || 'views').split(',').filter(Boolean);
const OUTD = process.env.OUTD || '/workspace/work/qa/three/shots/'; fs.mkdirSync(OUTD, { recursive: true });
const LOCAL = { 'three.min.js': QA + 'three.min.js', 'GLTFLoader.js': QA + 'GLTFLoader.js', 'SkeletonUtils.js': QA + 'SkeletonUtils.js' };
const MIME = { '.html': 'text/html', '.js': 'application/javascript', '.cjs': 'application/javascript', '.glb': 'model/gltf-binary', '.gltf': 'model/gltf+json', '.png': 'image/png', '.jpg': 'image/jpeg', '.json': 'application/json', '.bin': 'application/octet-stream', '.webp': 'image/webp', '.mp3': 'audio/mpeg', '.woff2': 'font/woff2' };
const base = OUTD + MAP + '-' + GQ + '-' + TAG; const t00 = Date.now(); fs.writeFileSync(base + '.log', '');
const log = (...a) => { const s = ((Date.now() - t00) / 1000).toFixed(0) + 's ' + a.join(' '); console.log(s); fs.appendFileSync(base + '.log', s + '\n'); };
const R = { map: MAP, gq: GQ, tag: TAG, root: ROOT, mode: MODE, size: [W, H], errors: [], console: [], shots: {} };
R.cfg = { UU: UU ? 1 : 0, ROOT, sha: (() => { try { return require('child_process').execFileSync('git', ['-C', ROOT, 'rev-parse', 'HEAD'], { stdio: 'pipe' }).toString().trim(); } catch (e) { return 'unknown'; } })(), W, H, VW: process.env.VW || null, map: MAP, gq: GQ }; const save = () => fs.writeFileSync(base + '.json', JSON.stringify(R, null, 1));
function serve() { return new Promise((r) => { const s = http.createServer((q, res) => { let p = decodeURIComponent(q.url.split('?')[0]); if (p === '/') p = '/index.html'; const f = path.join(ROOT, p); if (!f.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
  fs.readFile(f, (e, d) => { if (e) { res.writeHead(404); return res.end('nf'); } if (UU && f.endsWith('/three.min.js')) d = Buffer.from(uuServe(f, d.toString('utf8'))); res.writeHead(200, { 'Content-Type': MIME[path.extname(f).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-store' }); res.end(d); }); }); s.listen(PORT, '127.0.0.1', () => r(s)); }); }
(async () => {
  await LK.take(log); process.on('exit', LK.drop); for (const sg of ['SIGINT', 'SIGTERM']) process.on(sg, () => { LK.drop(); process.exit(1); });
  const srv = await serve(); let browser;
  try {
    browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-dev-shm-usage', '--ignore-gpu-blocklist', '--in-process-gpu', '--renderer-process-limit=1', '--disable-gpu-watchdog'] });
    const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
    await ctx.addInitScript((gq) => { try { localStorage.setItem('vs.gq', gq); localStorage.setItem('vs.gqb', gq); localStorage.setItem('vs.gov', '0'); } catch (e) {} Math.random = (() => { let s = 12345; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; })(); }, GQ);
    if (process.env.NOOP_INIT) await ctx.addInitScript(fs.readFileSync(process.env.NOOP_INIT, 'utf8'));
    await ctx.route(/^https?:\/\/(?!127\.0\.0\.1)/, (r) => { const f = r.request().url().split('/').pop().split('?')[0]; if (LOCAL[f] && UU && f === 'three.min.js') return r.fulfill({ body: uuServe(LOCAL[f] + ' (CDN route ' + r.request().url() + ')', fs.readFileSync(LOCAL[f], 'utf8')), contentType: 'application/javascript', headers: { 'access-control-allow-origin': '*' } }); if (LOCAL[f]) return r.fulfill({ path: LOCAL[f], contentType: 'application/javascript', headers: { 'access-control-allow-origin': '*' } }); return r.abort(); });
    await ctx.route(new RegExp('127\\.0\\.0\\.1:' + PORT + '/(index\\.html)?(\\?.*)?$'), (r) => r.fulfill({ body: fs.readFileSync(ROOT + '/index.html', 'utf8').replace('window.xValorantFeel={', 'window.__xe=s=>eval(s);window.xValorantFeel={'), contentType: 'text/html' }));
    const page = await ctx.newPage(); page.setDefaultTimeout(1800000);
    page.on('pageerror', (e) => R.errors.push('pageerror ' + String(e).slice(0, 400)));
    page.on('console', (m) => { const t = m.type(); if ((t === 'error' || t === 'warning') && R.console.length < 200) R.console.push(t + ': ' + m.text().slice(0, 600)); });
    const X = (s) => page.evaluate((s) => window.__xe(s), s);
    await page.goto('http://127.0.0.1:' + PORT + '/', { waitUntil: 'domcontentloaded' }); await page.waitForFunction(() => window.__xe && window.xValorantAssets, null, { timeout: 300000, polling: 1000 });
    await page.getByRole('button', { name: 'Got it', exact: true }).click({ timeout: 5000 }).catch(() => {}); await page.waitForTimeout(2000);
    R.rev = await X('THREE.REVISION'); log('boot rev', R.rev); if (UU) { if (!(R.uu || []).length) throw new Error('UU=1 but no three.min.js went through the patch'); R.uuProbe = await X('String(THREE.MathUtils.generateUUID).slice(0,200)+" | __u="+globalThis.__u'); log('UU probe (no call)', R.uuProbe); if (!/00000000-0000-4000-8000-/.test(R.uuProbe)) throw new Error('UU probe: generateUUID not patched: ' + R.uuProbe); } const tl = Date.now();
    if (process.env.PRE) { R.pre = await X(process.env.PRE); log('pre', String(R.pre).slice(0, 500)); }
    if (MODE === 'match') {
      await X(`J.pick=${JSON.stringify(process.env.AGENT || 'Jett')};FV.pick=${JSON.stringify(MAP)};FV.srOn=0;FV.repOn=0;setTimeout(()=>xGo(startFive),0);1`);
      await page.waitForFunction(() => window.__xe('!!(running&&!window.xLdOn&&NM.current&&NM.current.key&&bots.length>0&&!(NM.progress&&NM.progress.style.display==="flex"))'), null, { timeout: 1500000, polling: 2000 });
    } else {
      await X(`window.__nmDone=0;nmEnsure(${JSON.stringify(MAP)}).then(C=>{C.M.g.visible=true;window.__nmDone=1;},e=>{window.__nmDone=String(e);});1`);
      await page.waitForFunction(() => window.__xe('window.__nmDone'), null, { timeout: 1500000, polling: 2000 }); const d = await X('window.__nmDone'); if (d !== 1) throw new Error('map load ' + d);
    }
    R.loadS = Math.round((Date.now() - tl) / 1000); log('loaded', R.loadS + 's'); await page.waitForTimeout(+(process.env.SETTLE || 4) * 1000);
    // shot helper in page: render + readPixels of the default framebuffer
    await X(`(()=>{window.__rp=()=>{const gl=renderer.getContext(),w=gl.drawingBufferWidth,h=gl.drawingBufferHeight,b=new Uint8Array(w*h*4);gl.readPixels(0,0,w,h,gl.RGBA,gl.UNSIGNED_BYTE,b);const i=renderer.info.render;let s='';for(let k=0;k<b.length;k+=32768)s+=String.fromCharCode.apply(null,b.subarray(k,k+32768));return JSON.stringify({w,h,calls:i.calls,tris:i.triangles,px:btoa(s)});};return 1;})()`);
    const DL = process.env.DL === '1', DLRE = new RegExp(process.env.DLSHOTS || '^(abil_a\\d|vandal_a0)$'), DLJS = fs.readFileSync(__dirname + '/dl_inpage.js', 'utf8');
    const SHOT0 = async (name, js) => { const t = Date.now(); const r = JSON.parse(await X(js + ';window.__rp()')); fs.writeFileSync(base + '-' + name + '.rgba', Buffer.from(r.px, 'base64')); R.shots[name] = { calls: r.calls, tris: r.tris, w: r.w, h: r.h, ms: Date.now() - t }; log('shot', name, 'calls', r.calls, 'tris', r.tris, (Date.now() - t) + 'ms'); save(); return r; };
    global.SHOT = async (name, js) => { if (!(DL && DLRE.test(name))) return SHOT0(name, js); log('DL on', name, await X(DLJS)); let r; try { r = await SHOT0(name, js); } finally { const d = await X('window.__dlOff()'); fs.writeFileSync(base + '-dl-' + name + '.json', d); const j = JSON.parse(d); const ok = r && j.sum.calls === r.calls && j.sum.tris === r.tris && j.info.calls === r.calls; (R.dl = R.dl || {})[name] = { rows: j.rows.length, sumCalls: j.sum.calls, sumTris: j.sum.tris, info: j.info, glTot: j.glTot, orphan: j.orphan.length, census: j.census.length, match: ok }; log('DL', name, 'rows', j.rows.length, 'sum', j.sum.calls, j.sum.tris, 'info', r && r.calls, r && r.tris, 'gl', j.glTot, ok ? 'MATCH' : 'MISMATCH'); save(); } return r; };
    R.setup = JSON.parse(await X(`JSON.stringify({pr:renderer.getPixelRatio(),buf:[renderer.domElement.width,renderer.domElement.height],aa:(renderer.getContext().getContextAttributes()||{}).antialias,shadow:renderer.shadowMap.enabled,shType:renderer.shadowMap.type,tm:renderer.toneMapping,tme:renderer.toneMappingExposure,out:renderer.outputColorSpace||renderer.outputEncoding,pcl:renderer.physicallyCorrectLights})`)); log('setup', JSON.stringify(R.setup));
    for (const st of STEPS) {
      if (st === 'views') {
        const views = JSON.parse(fs.readFileSync('/workspace/work/qa/map/views/' + (process.env.VIEWS || MAP) + '.json', 'utf8'));
        await X(`(()=>{cancelAnimationFrame(loop.id);loop=function(){};const M=NM.current.M.g,keep=new Set();for(let o=M;o;o=o.parent)keep.add(o);const walk=o=>{for(const c of o.children){if(keep.has(c)){if(c!==M)walk(c);continue;}if(c.isLight||/sky/i.test(c.name||''))continue;if(c.visible)c.visible=false;}};walk(scene);return 1;})()`);
        for (let i = 0; i < views.length; i++) { const q = views[i]; await SHOT('v' + i, `camera.position.set(${q.p});camera.rotation.set(${q.pitch},${q.yaw},0,'YXZ');camera.updateMatrixWorld(true);NM.current.cullAt=null;renderer.render(scene,camera)`); if (process.env.VIEWSTAT) R.shots['v' + i].st = JSON.parse(await X(process.env.VIEWSTAT)); }
      } else if (st.startsWith('js:')) { const f = st.slice(3); const r = await X(fs.readFileSync(f, 'utf8')); log('js', f, String(r).slice(0, 3000)); (R.js = R.js || {})[path.basename(f)] = r; }
      else if (st.startsWith('node:')) { const f = st.slice(5); await require(f)(X, page, R, log, SHOT); }
      save();
    }
  } catch (e) { R.errors.push(String(e && e.stack || e).slice(0, 800)); log('ERR', String(e).slice(0, 500)); }
  finally { R.ms = Date.now() - t00; save(); try { await browser.close(); } catch (e) {} srv.close(); LK.drop(); log('done errors', R.errors.length, 'console', R.console.length); process.exit(0); }
})();
