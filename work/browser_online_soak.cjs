// hk-41: ONLINE play after the user's 8f1721e (reconnect/resume, heartbeat, 20 Hz catch-up, smoothing) through the local bridge
// (tools/browser-bridge 8787, real-time room - no lockstep). The page plays Jett in a 5v5 with server bots for SOAK seconds of server
// time (default 150) while it watches: connection drops ("Lost connection" / disconnect overlay text, MP.st leaving 'game',
// NET.reconnecting, NET.drops, socket closes), snapshot cadence, and remote-unit smoothness (every rendered frame: each visible
// remote unit's drawn position; a 'snap' = a drawn step > 0.5 m at > 20 m/s (no walk / run is that fast;
// a Tailwind dash is); jerk = |p(t) - 2 p(t-1) + p(t-2)| per frame). Shots work/validation/online-soak-<n>.jpg.
//   (cd <repo>/server && node tools/browser-bridge.mjs 8787 &) ; node work/browser_online_soak.cjs out.json
const PW='/workspace/work/pw/node_modules/playwright';process.env.PLAYWRIGHT_BROWSERS_PATH=process.env.PLAYWRIGHT_BROWSERS_PATH||'/workspace/work/pw/browsers';
process.env.LD_LIBRARY_PATH=(process.env.LD_LIBRARY_PATH||'')+':/workspace/work/pw/libs';
const {chromium}=require(PW),fs=require('fs'),path=require('path');const ROOT=process.env.ROOT||path.join(__dirname,'..'),QA='/workspace/work/qa/',OUT=process.argv[2]||'/tmp/online-bs.json',SHOT=process.env.SHOT||ROOT+'/work/validation/';
const LOCAL={'three.min.js':QA+'three.min.js','GLTFLoader.js':QA+'GLTFLoader.js','SkeletonUtils.js':QA+'SkeletonUtils.js'};const R={steps:[],checks:[],errors:[],console:[]};const t00=Date.now();
const log=(k,v)=>{R.steps.push([((Date.now()-t00)/1000).toFixed(1),k,v]);fs.writeFileSync(OUT,JSON.stringify(R,null,1));};
const check=(n,ok,v)=>{R.checks.push([n,ok?'pass':'FAIL',typeof v==='string'?v:JSON.stringify(v)]);log('check '+n,ok?'pass':'FAIL');};
const qa=async js=>{const r=await fetch('http://127.0.0.1:8787/__qa',{method:'POST',body:js});const t=await r.text();if(!r.ok)throw Error('qa: '+t.slice(0,300));return JSON.parse(t);};
const ONLY=(process.env.ONLY||'AB').split('');
const HEAL=c=>`{const s=sim('${c}');if(s.remaining!=null)s.remaining=Math.max(s.remaining,600);const me=s.units.find(u=>u.human);if(me){me.hp=100;}}`;
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage','--ignore-gpu-blocklist','--in-process-gpu','--renderer-process-limit=1']});
 const ctx=await browser.newContext({viewport:{width:1280,height:720},deviceScaleFactor:1});
 await ctx.addInitScript(()=>{try{localStorage.setItem('vs.gq','low');localStorage.setItem('vs.aa','0');}catch(e){}});
 await ctx.route(/^https?:\/\/(unpkg\.com|cdn\.jsdelivr\.net)\//,r=>{const f=r.request().url().split('/').pop().split('?')[0];if(LOCAL[f])return r.fulfill({path:LOCAL[f],contentType:'application/javascript',headers:{'access-control-allow-origin':'*'}});return r.continue();});
 await ctx.route(/127\.0\.0\.1:8876\/(index\.html)?(\?.*)?$/,r=>{const h=fs.readFileSync(ROOT+'/index.html','utf8').replace('window.xValorantFeel={','window.__xe=s=>eval(s);window.xValorantFeel={');r.fulfill({body:h,contentType:'text/html'});});
 const page=await ctx.newPage();await require('./pw_shot.cjs')(ctx,page);page.setDefaultTimeout(900000);page.on('pageerror',e=>R.errors.push('pageerror '+String(e).slice(0,300)));
 page.on('console',m=>{const t=m.text();if(m.type()==='error'&&!/ERR_CONNECTION_REFUSED/.test(t))R.console.push(t.slice(0,240));});
 const X=s=>page.evaluate(s=>window.__xe(s),s);const XJ=async s=>JSON.parse(await X(`JSON.stringify(${s})`));
 const W8=(cond,ms,why)=>page.waitForFunction(c=>window.__xe(c),cond,{timeout:ms||600000,polling:1000}).then(()=>true).catch(e=>{log('wait '+(why||cond).slice(0,60)+' timeout',String(e).slice(0,100));return false;});
 await page.goto('http://127.0.0.1:8876/',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__xe&&window.xValorantAssets,null,{timeout:180000});log('assets',1);
 await page.getByRole('button',{name:'Got it',exact:true}).click({timeout:5000}).catch(()=>{});
 await page.mouse.move(640,360);
 const SOAK=+(process.env.SOAK||150);
 page.on('console',m=>{const t=m.text();if(/lost connection|disconnect|reconnect/i.test(t))R.console.push('['+m.type()+'] '+t.slice(0,200));});
 await X(`J.pick='Jett';MP.name='SoakQA';window.xQMap='ascent';MP.map='ascent';mpCreate(false,'five');1`);
 await page.waitForFunction(()=>window.__xe('MP.st==="room"'),null,{timeout:1200000});const code=await X('MP.code');log('room',code);
 await X('mpStart();1');
 await W8('MP.st==="game"&&NET.ready&&running&&!window.xLdOn&&renderer.info.render.frame>5',1500000,'match start');
 await qa(`{const s=sim('${code}');if(s.remaining!=null)s.remaining=Math.max(s.remaining,900);}return 1;`).catch(()=>{});
 // per-frame sampler of remote units' drawn positions (render hook), + drop watch
 await X(`window.__sk={f:0,snap:0,steps:0,jerk:[],maxStep:0,lost:[],st:new Set(),rc:0,dr0:NET.drops||0,cls:0,snapsAt:[],lastLatest:null};
  {const r0=renderer.render;renderer.render=function(sc,c){try{if(sc===scene){const K=window.__sk;K.f++;const U=bots.concat(allies);for(const u of U){if(!u||!u.alive||!u.g||u.fog||!u.g.visible)continue;const p=u.g.position,h=u.__h||(u.__h=[]);h.push([p.x,p.z,performance.now()]);if(h.length>3)h.shift();if(h.length>=2){const a=h[h.length-2],b=h[h.length-1],d=Math.hypot(b[0]-a[0],b[1]-a[1]),dt=(b[2]-a[2])/1000;K.steps++;if(d>K.maxStep)K.maxStep=d;if(d>0.5&&dt>0&&d/dt>20)K.snap++;}if(h.length===3){const j=Math.hypot(h[2][0]-2*h[1][0]+h[0][0],h[2][1]-2*h[1][1]+h[0][1]);K.jerk.push(j);if(K.jerk.length>20000)K.jerk.shift();}}
   if(NET.latest!==K.lastLatest){K.lastLatest=NET.latest;K.snapsAt.push(performance.now());if(K.snapsAt.length>4000)K.snapsAt.shift();}
   K.st.add(MP.st);if(NET.reconnecting)K.rc++;const t=document.body.innerText||'';if(/lost connection/i.test(t))K.lost.push(t.match(/[^\\n]*lost connection[^\\n]*/i)[0].slice(0,120));}}catch(e){}return r0.apply(this,arguments);};}1`);
 const t0=await qa(`return sim('${code}').time;`);let n=0,last=t0;
 while(true){await page.waitForTimeout(5000);let t;try{t=await qa(`const s=sim('${code}');if(s.remaining!=null)s.remaining=Math.max(s.remaining,600);const me=s.units.find(u=>u.human);if(me)me.hp=100;return s.time;`);}catch(e){log('qa',String(e).slice(0,100));break;}
  const k=await XJ(`(()=>{const K=window.__sk,j=K.jerk.slice().sort((a,b)=>a-b),q=x=>j.length?+j[Math.min(j.length-1,Math.floor(j.length*x))].toFixed(4):0,sa=K.snapsAt,gaps=[];for(let i=1;i<sa.length;i++)gaps.push(sa[i]-sa[i-1]);gaps.sort((a,b)=>a-b);return {f:K.f,steps:K.steps,snap:K.snap,maxStep:+K.maxStep.toFixed(3),j50:q(.5),j99:q(.99),j999:q(.999),lost:K.lost.slice(0,3),st:[...K.st],rc:K.rc,drops:(NET.drops||0)-K.dr0,ready:!!NET.ready,sock:NET.socket?NET.socket.readyState:-1,mp:MP.st,snapGapMed:gaps.length?+gaps[Math.floor(gaps.length/2)].toFixed(1):null,snapGap99:gaps.length?+gaps[Math.floor(gaps.length*.99)].toFixed(1):null,phase:FV.buy>0?'buy':'live'};})()`);
  log('t+'+(t-t0).toFixed(0),k);if(n%6===0)await page.screenshot({path:SHOT+`online-soak-${n/6|0}.jpg`,quality:70,type:'jpeg',timeout:200000}).catch(()=>{});n++;
  if(t-t0>=SOAK||k.mp!=='game')break;}
 const fin=R.steps.filter(s=>/^t\+/.test(s[1])).pop();const k=fin?fin[2]:{};
 check('online soak: stayed connected the whole time (no "Lost connection", MP.st stayed game, socket open, no reconnect needed)',k.mp==='game'&&!k.lost.length&&k.sock===1&&k.st.every(x=>x==='game'),k);
 check('remotes smooth: no snaps (a drawn step > 0.5 m faster than 20 m/s; Tailwind dashes would count, report them)',k.snap<=2,{snap:k.snap,maxStep:k.maxStep,j50:k.j50,j99:k.j99,j999:k.j999,steps:k.steps});
 check('no page errors',!R.errors.some(e=>/pageerror/.test(e)),R.errors.filter(e=>/pageerror/.test(e)).slice(0,5));
 log('done',1);await browser.close();process.exit(0);
})().catch(e=>{R.errors.push('fatal '+String(e));fs.writeFileSync(OUT,JSON.stringify(R,null,1));console.error(e);process.exit(1);});
