// ADS downsight overlay check in real Chromium: offline 5v5 on Ascent, arm each gun, right-click, settle the eased zoom, then read
// the ADS screen layer (#xAdsT: class + opacity + display), the sniper lens (#scope: reticle class + display), the crosshair and the
// gun, and screenshot each state. Expected (VALORANT): rifles / SMGs / heavies keep the crosshair + gun optic and add an edge falloff
// (s 1.15x, r 1.25x, g Guardian 1.5x); snipers swap to the black lens with their own reticle (o Operator, m Marshal, l Outlaw) and hide
// the gun; pistols / shotguns / Bucky never zoom. Hip after every unscope: no layer, no lens, crosshair back.
//   PW=<path to playwright> node work/browser_ads_overlay.cjs [outDir]   (serves the repo on 127.0.0.1:8877)
const PW = process.env.PW || 'playwright';
const { chromium } = require(PW), fs = require('fs'), path = require('path'), http = require('http');
const ROOT = path.join(__dirname, '..'), OUT = process.argv[2] || path.join(ROOT, 'work', 'validation', 'ads');
fs.mkdirSync(OUT, { recursive: true });
const MIME = { '.html': 'text/html', '.js': 'application/javascript', '.json': 'application/json', '.glb': 'model/gltf-binary', '.png': 'image/png', '.jpg': 'image/jpeg', '.mp3': 'audio/mpeg', '.woff2': 'font/woff2', '.ktx2': 'image/ktx2', '.bin': 'application/octet-stream' };
const srv = http.createServer((q, r) => { let p = decodeURIComponent(q.url.split('?')[0]); if (p === '/') p = '/index.html'; const f = path.join(ROOT, p);
  if (!f.startsWith(ROOT)) { r.writeHead(403); return r.end(); }
  fs.readFile(f, (e, b) => { if (e) { r.writeHead(404); return r.end(); } if (p === '/index.html') b = Buffer.from(String(b).replace('window.xValorantFeel={', 'window.__xe=s=>eval(s);window.xValorantFeel={'));
    r.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' }); r.end(b); }); }).listen(8877, '127.0.0.1');
const checks = []; const check = (n, ok, d) => { checks.push([n, ok ? 'pass' : 'FAIL', d]); console.log((ok ? 'pass ' : 'FAIL ') + n + (ok ? '' : ' ' + JSON.stringify(d))); };
(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--ignore-gpu-blocklist', '--enable-gpu'] });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  await ctx.addInitScript(() => { try { localStorage.setItem('vs.portrait', '1'); } catch (e) {} });
  const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 300)));
  page.setDefaultTimeout(300000); const X = s => page.evaluate(s => window.__xe(s), s);
  await page.goto('http://127.0.0.1:8877/', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__xe && window.xValorantAssets, null, { timeout: 180000, polling: 1000 });
  await page.getByRole('button', { name: 'Got it', exact: true }).click({ timeout: 5000 }).catch(() => {});
  await X(`FV.pick='ascent';if(!J.pick)J.pick='Jett';window.xSwift=false;setTimeout(()=>xGo(startFive),0);1`);
  await page.waitForFunction(() => window.__xe('running&&!window.xLdOn&&bots.length>0'), null, { timeout: 600000, polling: 2000 });
  await X(`[...document.querySelectorAll('button')].filter(b=>/^got it$/i.test(b.textContent.trim())&&b.offsetParent).forEach(b=>b.click());{const h=hurt;hurt=function(t){if(t===player)return;return h.apply(this,arguments);};}clearTimeout(FV.to);FV.buy=0;FV.menu=false;1`);
  const arm = w => X(`xdArm(${JSON.stringify(w)});player.hp=100;reloading=0;fcd=0;VM.sw=0;xCU=0;running=true;paused=false;1`);
  await X(`window.__adsSt=()=>JSON.stringify((()=>{const a=document.getElementById('xAdsT'),s=document.getElementById('scope'),c=document.getElementById('cross');return{w:xSCw(),ads,fov:+camera.fov.toFixed(1),ov:{c:a.className,o:a.style.opacity,d:getComputedStyle(a).display},sc:{c:s.className,d:getComputedStyle(s).display,o:s.style.opacity},cross:getComputedStyle(c).display,gun:!!gun.visible};})());1`);
  const st = (pre = '') => X(pre + `__adsSt()`).then(JSON.parse); // pre runs in the same task as the read: no game frame in between
  const settle = () => page.waitForFunction(() => window.__xe('xSC.t>=1&&(xAD.at||0)>=1'), null, { timeout: 30000, polling: 50 }).then(() => page.waitForTimeout(120));
  // one gun per class (rifle, SMG, scoped rifle, each sniper reticle, a pistol, the Bucky alt fire)
  const EXP = { Vandal: 'r', Spectre: 's', Guardian: 'g', Operator: 'o', Marshal: 'm', Outlaw: 'l', Sheriff: '', Bucky: '' };
  const SN = { Operator: 1, Marshal: 1, Outlaw: 1 };
  for (const w of Object.keys(EXP)) {
    await arm(w); await settle(); const h = await st();
    check(`${w} hip: no ADS layer, no lens, crosshair shown`, h.ov.d === 'none' && h.sc.d === 'none' && h.cross !== 'none', h);
    // mid-transition sample, stepped in-page (30 ms of the 0.12 s ease) so slow headless frames cannot skip it
    const m = await st(`xScopeT();xADu(0.03);`); await settle(); const a = await st();
    const e = EXP[w];
    if (SN[w]) check(`${w} scoped: lens .${e}, gun hidden, crosshair hidden, no rifle layer`, a.ads === 2 && a.sc.d === 'block' && new RegExp('\\b' + e + '\\b').test(a.sc.c) && a.sc.o === '1' && !a.gun && a.cross === 'none' && a.ov.d === 'none', a);
    else if (e) { check(`${w} ADS: edge layer .${e} at full, crosshair + gun kept, no lens`, a.ads === 1 && a.ov.d === 'block' && a.ov.o === '1' && new RegExp('\\b' + e + '\\b').test(a.ov.c) && a.sc.d === 'none' && a.cross !== 'none' && a.gun, a);
      check(`${w} ADS eases in (mid-transition opacity < 1)`, +m.ov.o < 1, m); }
    else if (w === 'Classic') check(`Classic right-click = burst, no zoom / layer`, a.ads === 0 && a.ov.d === 'none' && a.sc.d === 'none', a);
    else check(`${w}: no zoom, no layer, no lens`, Math.abs(a.fov - h.fov) < 0.2 && a.ov.d === 'none' && a.sc.d === 'none', a); // Bucky right-click = slug alt fire (ads 1, no zoom)
    await page.screenshot({ path: path.join(OUT, `ads-${w}.jpg`), type: 'jpeg', quality: 85 });
    if (w === 'Operator') { await X(`xScopeT();1`); await settle(); const z = await st(); check('Operator 5x keeps lens .o', z.ads === 2 && z.sc.d === 'block' && /\bo\b/.test(z.sc.c), z); await page.screenshot({ path: path.join(OUT, 'ads-Operator-5x.jpg'), type: 'jpeg', quality: 85 }); }
    if (a.ads && e) { const mo = await st(`xScopeT();xADu(0.03);`); await settle(); const o = await st();
      if (!SN[w]) check(`${w} ADS eases out (layer still fading 30 ms after release)`, mo.ov.d === 'block' && +mo.ov.o > 0 && +mo.ov.o < 1, mo);
      check(`${w} unscoped: layer gone, lens gone, crosshair back, gun back`, o.ads === 0 && o.ov.d === 'none' && o.sc.d === 'none' && o.cross !== 'none' && o.gun, o); }
  }
  // forced unscope (reload) snaps the layer off
  await arm('Vandal'); await X(`xScopeT();1`); await settle(); await X(`reloading=2;for(const f of window.XHK)try{f();}catch(e){}1`); await page.waitForTimeout(60);
  { const r = await st(); check('Vandal reload: ADS dropped, layer off at once', r.ads === 0 && r.ov.d === 'none', r); }
  check('no page errors', !errs.length, errs);
  fs.writeFileSync(path.join(OUT, 'result.json'), JSON.stringify({ checks, errs }, null, 1));
  await browser.close(); srv.close(); const bad = checks.filter(c => c[1] !== 'pass').length; console.log(`${checks.length - bad}/${checks.length} pass`); process.exit(bad ? 1 : 0);
})().catch(e => { console.error(e); srv.close(); process.exit(2); });
