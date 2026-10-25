// Shared harness: serve repo + drive a headless Chrome page into a DM match.
// heavy=false blocks large binary assets so logic tests boot light.
const {chromium} = require('playwright-core');
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = process.env.VS_ROOT || '/home/sandbox/valorstrike'; // VS_ROOT: serve a worktree for A/B probes
const MIME = {'.html':'text/html','.js':'application/javascript','.mjs':'application/javascript','.glb':'model/gltf-binary','.gltf':'model/gltf+json','.png':'image/png','.jpg':'image/jpeg','.css':'text/css','.json':'application/json','.txt':'text/plain','.bin':'application/octet-stream','.wasm':'application/wasm'};
function serve(port = 8876) {
  const srv = http.createServer((req,res)=>{
    let p = decodeURIComponent(req.url.split('?')[0]); if (p === '/') p = '/index.html';
    if (process.env.VS_SERVE_LOG) console.log('[serve]', new Date().toISOString().slice(17,23), p.slice(0,90));
    const f = path.join(ROOT, p);
    if (!f.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
    fs.readFile(f, (err, data) => {
      if (err) { res.writeHead(404); return res.end('nf'); }
      res.writeHead(200, {'Content-Type': MIME[path.extname(f).toLowerCase()] || 'application/octet-stream', 'Cache-Control':'no-store'});
      res.end(data);
    });
  });
  return new Promise(r => srv.listen(port, '127.0.0.1', () => r(srv)));
}
async function launch({heavy = false, profile = null, viewport = {width:960, height:600}, args = []} = {}) {
  const b = await chromium.launch({headless:true, executablePath:'/usr/bin/google-chrome',
    args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--disable-dev-shm-usage','--enable-unsafe-swiftshader','--mute-audio',...args]});
  const p = await b.newPage({viewport});
  const prof = profile || (heavy ? 'heavy' : 'light');
  if (prof === 'light') {
    // Allow map assets (needed for match start); block heavy agent/weapon GLBs and textures.
    await p.route(/\.(glb|png|jpg|jpeg|bin)(\?|$)/, r => {
      const u = r.request().url();
      if (u.includes('/maps/')) return r.continue();
      return r.abort();
    });
  } else if (prof === 'mid') {
    // Native agent/weapon rigs allowed (local, parse-cheap); loose textures and
    // map scene buffers still blocked (light map path never requests them).
    await p.route(/\.(png|jpg|jpeg|bin)(\?|$)/, r => {
      const u = r.request().url();
      if (u.includes('/maps/') || u.includes('/models/valorant/')) return r.continue();
      return r.abort();
    });
  }
  const errors = [], logs = [];
  p.on('pageerror', e => errors.push('PAGEERROR: ' + String(e && e.stack || e)));
  p.on('console', m => { const t = m.type(); if (t === 'error' || t === 'warning') logs.push(t.toUpperCase() + ' ' + m.text()); });
  return {b, p, errors, logs};
}
async function boot(page, url = 'http://127.0.0.1:8876/') {
  await page.goto(url, {waitUntil:'domcontentloaded', timeout:60000});
  await page.waitForFunction(() => window.THREE && document.getElementById('playBtn'), null, {timeout:60000});
}
async function startDM(page) {
  // Main's lobby rework (Oct 25) routes #playBtn to the online quick-match menu; the legacy
  // mode-tab strip is not shown. Probes exercise gameplay, not lobby UX, so launch via the hook.
  await page.click('#mIntro [data-close]').catch(() => {});
  await page.evaluate(() => window.__vs.startDM());
}
module.exports = {serve, launch, boot, startDM};
