// #xOnStart hit-target/occlusion check at 960x600 (and 640x360 reference).
// Real room against a fresh local wrangler; also stress the player list with fake rows.
const {spawn} = require('child_process');
const http = require('http');
const {serve, launch, boot} = require('./lib.cjs');
const SERVER_DIR = __dirname + '/../../server';
const T0 = Date.now(); const el = () => ((Date.now()-T0)/1000).toFixed(0)+'s';
function waitHttp(url, ms) { const end = Date.now()+ms; return new Promise((res, rej) => { const t = () => http.get(url, r => { r.resume(); res(); }).on('error', () => { if (Date.now() > end) rej(new Error('server never came up')); else setTimeout(t, 500); }); t(); }); }
(async () => {
  const V = process.env.VIEW || '960x600';
  const [w, h] = V.split('x').map(Number);
  const wr = process.env.NO_WRANGLER ? {kill(){}} : spawn('node_modules/.bin/wrangler', ['dev','--local','--ip','127.0.0.1','--var','ALLOW_LOCAL_ORIGIN:true','--var','ENABLE_SPIKE:true'], {cwd: SERVER_DIR, stdio: ['ignore',require('fs').openSync('/tmp/wrangler_out.log','w'),require('fs').openSync('/tmp/wrangler_err.log','w')]});
  process.on('exit', () => { try { wr.kill(); } catch(e){} });
  await waitHttp('http://127.0.0.1:8787/profile?qa=1', 30000); console.log(el(), 'server up');
  require('child_process').exec('pkill -f esbuild || true');
  const srv = await serve();
  const {b, p} = await launch({profile:'light', viewport:{width:w, height:h}});
  await boot(p);
  await p.click('#mIntro [data-close]').catch(()=>{});
  await p.evaluate(() => { window.__vs.light(true); window.__vs.agents(false); });
  await p.click('#playBtn');
  await p.waitForSelector('#xQueue:not([hidden])', {timeout: 15000});
  await p.fill('#xOnName', 'HitQA');
  await p.evaluate(() => { document.querySelector('#xOn [data-om="dm"]').click(); document.getElementById('xOnCreate').click(); });
  let code = null;
  for (let i = 0; i < 15 && !code; i++) { await new Promise(r=>setTimeout(r,2000)); const t = await p.evaluate(() => (document.getElementById('xOnCodeT')||{}).textContent||''); if (/^[A-Z2-9]{6}$/.test(t)) code = t; }
  console.log(el(), 'room', code);
  const probe = (label) => p.evaluate((label) => {
    const b = document.getElementById('xOnStart');
    const r = b.getBoundingClientRect();
    const cx = r.left + r.width/2, cy = r.top + r.height/2;
    const hit = document.elementFromPoint(cx, cy);
    const q = document.getElementById('xQueue').getBoundingClientRect();
    const list = document.getElementById('xOnList').getBoundingClientRect();
    return { label, hidden: b.hidden, disabled: b.disabled, rect: {x:Math.round(r.x),y:Math.round(r.y),w:Math.round(r.width),h:Math.round(r.height)},
      center: [Math.round(cx), Math.round(cy)], hit: hit ? (hit.id || hit.className || hit.tagName) : null,
      hitIsStart: hit === b || b.contains(hit), inViewport: cx>=0 && cy>=0 && cx<innerWidth && cy<innerHeight,
      queue: {y:Math.round(q.y),h:Math.round(q.height)}, list: {y:Math.round(list.y),h:Math.round(list.height)},
      scrollY: Math.round(document.getElementById('xQueue').scrollTop||0), vh: innerHeight };
  }, label);
  console.log(el(), JSON.stringify(await probe('real-room-1p')));
  // stress: 9 fake player rows (full DM room) then re-test
  await p.evaluate(() => { const ol = document.getElementById('xOnList'); for (let i = 0; i < 9; i++) { const li = document.createElement('li'); li.textContent = 'Bot Filler ' + i; ol.appendChild(li); } });
  console.log(el(), JSON.stringify(await probe('stressed-10p')));
  await p.screenshot({path: '/tmp/hittest_' + V + '.png'});
  console.log(el(), 'screenshot /tmp/hittest_' + V + '.png');
  await b.close(); srv.close(); wr.kill(); process.exit(0);
})().catch(e => { console.log('HITTEST FAIL', e.message); process.exit(1); });
