const {serve, launch, boot} = require('./lib.cjs');
(async()=>{
  const srv = await serve();
  const {b, p, errors} = await launch();
  try {
    await boot(p);
    const d = await p.evaluate(() => {
      const t = (n) => { try { return eval('typeof ' + n); } catch(e){ return 'ERR:'+String(e).slice(0,60);} };
      return {startDM: t('startDM'), dmGo: t('dmGo'), hurt: t('hurt'), running: t('running'), bots: t('bots'), FV: t('FV'), scene: t('scene'), THREE: t('THREE'), SkeletonUtils: t('SkeletonUtils'), GLTFLoader: t('THREE.GLTFLoader')};
    });
    console.log('GLOBALS', JSON.stringify(d, null, 1));
    // try clicking dmBtn and capture any throw
    const c = await p.evaluate(() => {
      try { const btn = document.querySelector('#dmBtn'); if (!btn) return {err:'no #dmBtn'};
        btn.click(); return {ok:true, running: (typeof running!=='undefined')?!!running:'undef'}; }
      catch(e){ return {err:String(e&&e.stack||e).slice(0,500)}; }
    });
    console.log('CLICK', JSON.stringify(c));
  } finally { console.log('ERRORS', JSON.stringify(errors.slice(0,10))); await b.close(); srv.close(); }
})().catch(e=>{console.error('FATAL',String(e&&e.stack||e).slice(0,500));process.exit(1);});
