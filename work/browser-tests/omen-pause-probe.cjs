// Omen X must not pause the game: okKey X exits pointer lock deliberately for minimap
// targeting; the pointerlockchange pause handler must skip that. Also guards the
// normal path: an ordinary unlock (no targeting) must still pause.
const {serve, launch, boot} = require('./lib.cjs');
(async()=>{
  const srv = await serve();
  const {b, p, errors} = await launch({profile:'mid'});
  const fails = [];
  try {
    await boot(p);
    await p.evaluate(() => { window.__vs.light(true); window.__vs.agents(false); window.__vs.startFive(); });
    await p.waitForFunction(() => window.__vs && window.__vs.state().running, {timeout: 60000});
    await p.evaluate(() => { window.__vs.FV.buy = 0; const J = window.__vs.J; J.pick='Omen'; J.on=true; J.ult=99; J.cd={c:0,q:0,e:0,x:0}; });
    // wait out the 700ms post-match-start pause guard window (wall clock)
    await p.waitForTimeout(900);
    // engage pointer lock as match start would
    const lock = await p.evaluate(() => { try { const c = document.querySelector('canvas'); c.requestPointerLock(); return 'requested'; } catch(e) { return 'err:'+e; } });
    await p.waitForTimeout(300);
    const locked0 = await p.evaluate(() => !!document.pointerLockElement);
    console.log('pointer lock engaged:', locked0, '('+lock+')');
    const paused0 = await p.evaluate(() => window.__vs.state().paused);
    console.log('paused before X:', paused0);
    if (paused0 !== false) fails.push('already paused before X');
    await p.keyboard.press('KeyX');
    await p.waitForTimeout(400);
    const mid = await p.evaluate(() => ({ftp: !!window.__vs.J.ftp, paused: window.__vs.state().paused, lock: !!document.pointerLockElement}));
    console.log('after Omen X:', JSON.stringify(mid));
    if (!mid.ftp) fails.push('X did not enter targeting (ftp false)');
    if (mid.paused !== false) fails.push('REGRESSION: game paused during Omen targeting');
    if (mid.lock) fails.push('pointer lock still held during targeting');
    // normal unlock path must still pause
    await p.evaluate(() => { window.__vs.J.ftp = false; });
    await p.evaluate(() => { try { const c = document.querySelector('canvas'); c.requestPointerLock(); } catch(e) {} });
    await p.waitForTimeout(300);
    await p.evaluate(() => { try { document.exitPointerLock(); } catch(e) {} });
    await p.waitForTimeout(300);
    const end = await p.evaluate(() => window.__vs.state().paused);
    console.log('paused after ordinary unlock:', end);
    if (end !== true) fails.push('ordinary unlock no longer pauses (pause regression)');
    console.log(fails.length ? 'FAIL: '+fails.join(' | ') : 'OMEN-PAUSE-PROBE PASS');
  } finally {
    console.log('ERRORS', JSON.stringify(errors.slice(0,8)));
    await b.close(); srv.close();
  }
  process.exit(fails.length ? 1 : 0);
})().catch(e => { console.error('FATAL', String(e && e.stack || e).slice(0,400)); process.exit(1); });
