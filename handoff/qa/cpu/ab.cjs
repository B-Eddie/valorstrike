// lane.cjs step: in-page perf A/B (NOOP GL). Configs rotate in short windows so box load drifts hit all of them alike.
// AB_CFG: 'base:000,mw:100,mw+sk:110,all:111' (flags mw sk sort), AB_REPS reps, AB_S seconds per window.
module.exports=async(X,page,R,log)=>{
 const cfgs=(process.env.AB_CFG||'base:000,mw:100,mwsk:110,all:111').split(',').map(s=>{const [n,f]=s.split(':');return {n,f};});
 const reps=+(process.env.AB_REPS||4),secs=+(process.env.AB_S||5);const acc={};
 for(let r=0;r<reps;r++)for(const c of (r%2?cfgs.slice().reverse():cfgs)){
  await X(`XSGR.mw=${c.f[0]==='1'};XSGR.sk=${c.f[1]==='1'};if('sort' in XSGR)XSGR.sort=${c.f[2]==='1'};1`);
  await page.waitForTimeout(800);
  await X(`window.__ft.length=0;for(const k in window.__tm)delete window.__tm[k];1`);await page.waitForTimeout(secs*1000);
  const m=JSON.parse(await X(`JSON.stringify((()=>{const n=window.__ft.length,T=window.__tm,o={frames:n,ft:window.__ft.reduce((a,b)=>a+b,0)/Math.max(1,n)};for(const k in T)o[k]=T[k][0]/Math.max(1,n);return o;})())`));
  const a=acc[c.n]||(acc[c.n]={n:0});a.n++;for(const k in m)a[k]=(a[k]||0)+m[k];log('ab',c.n,JSON.stringify(m));
 }
 R.ab={};for(const k in acc){const a=acc[k],o={};for(const j in a)if(j!=='n')o[j]=+(a[j]/a.n).toFixed(3);R.ab[k]=o;}log('AB',JSON.stringify(R.ab));
};
