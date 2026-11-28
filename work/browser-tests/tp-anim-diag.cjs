// Diag: what does a duel bot look like in __vs state over time? (rig attach hunt)
const {serve, launch, boot} = require('./lib.cjs');
(async()=>{
  const srv = await serve();
  const {b, p, errors, logs} = await launch({profile:'mid', viewport:{width:640, height:360}, args:['--js-flags=--max-old-space-size=1024','--disable-features=site-per-process','--no-zygote']});
  try {
    await boot(p);
    await p.evaluate(() => { window.__vs.FV.pick = 'ascent'; window.__vs.light(true); window.__vs.agents(false); });
    await p.click('#mIntro [data-close]').catch(() => {});
    await p.evaluate(() => window.__vs.startDuel());
    await p.waitForFunction(() => window.__vs && window.__vs.state().running, undefined, {timeout: 420000, polling: 2000});
    console.log('RUNNING');
    for (let i = 0; i < 20; i++) {
      const s = await p.evaluate(() => {
        const v = window.__vs, st = v.state();
        const db = v.duelBot; const dbInfo = db ? {alive: !!db.alive, xm: !!db.xm, val: !!(db.xm && db.xm.valorant), name: db.name} : null; const bots = (v.bots || []).map(t => ({alive: !!t.alive, xm: !!t.xm, val: !!(t.xm && t.xm.valorant), w: t.weapon || (t.xm && t.xm.w) || null}));
        return {mode: st.mode || null, duelBot: dbInfo, nBots: (v.bots || []).length, bots, player: !!v.player};
      });
      console.log('sample', i, JSON.stringify(s));
      if (s.bots.some(x => x.val) || (s.duelBot && s.duelBot.val)) { console.log('RIG ATTACHED'); break; }
      await new Promise(r => setTimeout(r, 10000));
    }
  } catch (e) { console.log('DIAG-FAIL', String(e).slice(0, 200)); }
  finally {
    console.log('ERRORS', JSON.stringify(errors.slice(0,4)));
    console.log('LOGS', JSON.stringify(logs.filter(l=>!/Failed to load resource/.test(l)).slice(0,10)));
    await b.close(); srv.close();
  }
})().catch(e => { console.error('FATAL', String(e && e.stack || e).slice(0,300)); process.exit(1); });
