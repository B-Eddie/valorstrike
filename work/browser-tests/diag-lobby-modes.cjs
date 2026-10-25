// Lobby mode reachability: Play -> queue panel -> each offline tab card visible -> DM starts.
const {serve, launch, boot} = require('./lib.cjs');
(async () => {
  const srv = await serve();
  const {b: browser, p} = await launch({profile:'mid', viewport:{width:1280, height:800}});
  const errors = []; p.on('pageerror', e => errors.push(String(e)));
  try {
    await boot(p);
    await p.click('#mIntro [data-close]').catch(()=>{});
    await p.evaluate(() => window.__vs && window.__vs.light && window.__vs.light(true));
    await p.click('#playBtn');
    await p.waitForSelector('#xQueue:not([hidden])', {timeout: 10000});
    const tabs = await p.evaluate(() => [...document.querySelectorAll('#xQueue [role=tab]')].map(t => t.dataset.q));
    console.log('tabs:', tabs.join(','));
    const vis = {};
    for (const q of ['unrated','swift','sr','dm','tdm','esc','custom']) {
      await p.click(`#xQueue [role=tab][data-q="${q}"]`);
      await new Promise(r => setTimeout(r, 300));
      vis[q] = await p.evaluate((q) => {
        const pane = document.querySelector(`#xQueue .x-qp[data-q="${q}"]`);
        if (!pane || pane.hidden) return 'pane-hidden';
        const card = pane.querySelector('button.x-qcard, .x-qcard button, .card');
        if (!card) return 'no-card';
        const r = card.getBoundingClientRect();
        const cs = getComputedStyle(card);
        return (r.width > 10 && r.height > 10 && cs.visibility !== 'hidden' && cs.display !== 'none') ? 'visible' : 'zero-rect';
      }, q);
    }
    console.log('card visibility:', JSON.stringify(vis));
    await p.screenshot({path: '/tmp/lobby_dm_tab.png'});
    // start DM via its card
    await p.click('#xQueue [role=tab][data-q="dm"]');
    await p.click('#dmBtn');
    await p.waitForFunction(() => window.__vs && window.__vs.state && window.__vs.state().running, {timeout: 90000, polling: 1000});
    const st = await p.evaluate(() => window.__vs.state());
    console.log('DM STARTED mode=', st.mode, 'running=', st.running);
    await new Promise(r => setTimeout(r, 3000));
    await p.screenshot({path: '/tmp/lobby_dm_ingame.png'});
    console.log('LOBBY-MODES DONE'); console.log('ERRORS', JSON.stringify(errors.slice(0,5)));
  } catch (e) { console.log('PROBE-FAIL', e.message); await p.screenshot({path:'/tmp/lobby_fail.png'}).catch(()=>{}); console.log('ERRORS', JSON.stringify(errors.slice(0,5))); }
  await browser.close(); srv.close(); process.exit(0);
})();
