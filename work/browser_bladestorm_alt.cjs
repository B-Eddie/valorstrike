// hk-38: Blade Storm ALT FIRE in the browser (offline 5v5 Ascent, real X key + real right mouse button): every remaining knife leaves
// at once in a 2.5 deg horizontal fan (5 bots stood in the fan slots 8 m out each take one 50 body knife; one at 50 HP dies and the
// knives are NOT refilled), the arms play the two-handed RightClickAttack clip, the gun comes back after the 0.45 s burst unequip.
//   node work/browser_bladestorm_alt.cjs <out.json>   (shot work/validation/bladestorm-alt-<WxH>.jpg)
const PW='/workspace/work/pw/node_modules/playwright';process.env.PLAYWRIGHT_BROWSERS_PATH=process.env.PLAYWRIGHT_BROWSERS_PATH||'/workspace/work/pw/browsers';
process.env.LD_LIBRARY_PATH=(process.env.LD_LIBRARY_PATH||'')+':/workspace/work/pw/libs';
const {chromium}=require(PW),fs=require('fs'),path=require('path');const ROOT=process.env.ROOT||path.join(__dirname,'..'),QA='/workspace/work/qa/',OUT=process.argv[2]||'/tmp/bladestorm.json',SHOT=ROOT+'/work/validation/',TAG=process.env.TAG||'now';
const LOCAL={'three.min.js':QA+'three.min.js','GLTFLoader.js':QA+'GLTFLoader.js','SkeletonUtils.js':QA+'SkeletonUtils.js'};const R={steps:[],checks:[],errors:[]};const t00=Date.now();
const log=(k,v)=>{R.steps.push([((Date.now()-t00)/1000).toFixed(1),k,v]);fs.writeFileSync(OUT,JSON.stringify(R,null,1));};
const check=(n,ok,d)=>{R.checks.push([n,ok?'pass':'FAIL',typeof d==='string'?d:JSON.stringify(d)]);log('check '+n,ok?'pass':'FAIL');};
const VIEWS=(process.env.VIEWS||'1280x720,844x390').split(',');
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage','--ignore-gpu-blocklist','--in-process-gpu','--renderer-process-limit=1']});
 const vw0=VIEWS[0].split('x').map(Number),mob=VIEWS.length>1;
 const ctx=await browser.newContext({viewport:{width:vw0[0],height:vw0[1]},deviceScaleFactor:1});
 await ctx.addInitScript(()=>{const pn=performance.now.bind(performance);let r0=pn(),v0=r0,sc=1;Object.defineProperty(window,'__ts',{get:()=>sc,set:v=>{const r=pn();v0+=(r-r0)*sc;r0=r;sc=v;}});performance.now=()=>v0+(pn()-r0)*sc;});
 await ctx.addInitScript(()=>{try{localStorage.setItem('vs.gq','low');localStorage.setItem('vs.aa','0');localStorage.setItem('vs.portrait','1');}catch(e){}});
 await ctx.route(/^https?:\/\/(unpkg\.com|cdn\.jsdelivr\.net)\//,r=>{const f=r.request().url().split('/').pop().split('?')[0];if(LOCAL[f])return r.fulfill({path:LOCAL[f],contentType:'application/javascript',headers:{'access-control-allow-origin':'*'}});return r.continue();});
 await ctx.route(/127\.0\.0\.1:8876\/(index\.html)?(\?.*)?$/,r=>{const h=fs.readFileSync(ROOT+'/index.html','utf8').replace('window.xValorantFeel={','window.__xe=s=>eval(s);window.xValorantFeel={');r.fulfill({body:h,contentType:'text/html'});});
 const page=await ctx.newPage();await require('./pw_shot.cjs')(ctx,page);page.setDefaultTimeout(600000);page.on('pageerror',e=>R.errors.push('pageerror '+String(e).slice(0,300)));
 const X=s=>page.evaluate(s=>window.__xe(s),s);const XJ=async s=>JSON.parse(await X(`JSON.stringify(${s})`));
 const frames=async n=>{await X(`window.__allow=${n};1`);await page.waitForFunction(()=>window.__xe('window.__allow<=0'),null,{timeout:900000,polling:500}).catch(()=>{});};
 const untilF=async(expr,ms)=>{const t=Date.now();while(Date.now()-t<ms){if(await X(expr))return true;await X('window.__allow=2;1');await page.waitForTimeout(400);}return false;};
 await page.goto('http://127.0.0.1:8876/',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__xe&&window.xValorantAssets,null,{timeout:180000,polling:1000});log('assets',1);
 await page.getByRole('button',{name:'Got it',exact:true}).click({timeout:5000}).catch(()=>{});
 await page.mouse.move(vw0[0]/2,vw0[1]/2);
 await X(`FV.pick='ascent';J.pick='Jett';window.xSwift=false;setTimeout(()=>xGo(startFive),0);1`);
 await page.waitForFunction(()=>window.__xe('running&&!window.xLdOn&&bots.length>0'),null,{timeout:1500000,polling:2000});
 await X(`[...document.querySelectorAll('button')].filter(b=>/^got it$/i.test(b.textContent.trim())&&b.offsetParent).forEach(b=>b.click());if(!window.__gd){window.__gd=1;const h=hurt;hurt=function(t){if(t===player&&window.__god)return;return h.apply(this,arguments);};}window.__god=1;bots.concat(allies).forEach(u=>{u.nt=true;u.g.position.set(player.x+200,player.y-50,player.z+200);});FV.buy=0;if(typeof timeLeft!=='undefined')timeLeft=900;1`);
 await X(`if(!window.__rp){window.__rp=1;window.__allow=3;const r0=renderer.render;renderer.render=function(sc,c){if(sc===scene){if(window.__allow<=0)return;window.__allow--;}return r0.call(this,sc,c);};}1`);
 await frames(2);
 await X(`for(let k=0;k<16;k++){let ok=true;for(let r=.5;r<=10;r+=.5)for(const a of [-.12,0,.12])if(blocked(player.x-Math.sin(yaw+a)*r,player.z-Math.cos(yaw+a)*r,.3,player.y))ok=false;if(ok)break;yaw+=Math.PI/8;}pitch=0;1`);
 await X('J.ult=K().u;J.cd.x=0;1');await page.keyboard.press('KeyX');
 const ok=await untilF('XAF.on&&XAF.last&&XAF.last.gun==="bs"&&XAF.last.rig===true&&J.bsOn&&J.bs===5&&rw==="knife"',240000);
 check('Blade Storm out with 5 knives',ok,await XJ('{last:XAF.last,bs:J.bs,on:J.bsOn,rw}'));
 // 5 enemy bots in the fan slots, 8 m out, standing on the player's floor, body at the crosshair height; the middle one has 50 HP
 const setup=await XJ(`(()=>{const f=camera.getWorldDirection(new THREE.Vector3()),o=camera.getWorldPosition(new THREE.Vector3()),B=bots.slice(0,5),up=new THREE.Vector3(0,1,0),out=[];
   pitch=0;B.forEach((b,i)=>{const d=f.clone().setY(0).normalize().applyAxisAngle(up,jBurstDirs(5)[i]);b.alive=true;b.nt=true;b.hp=i===2?50:200;b.armor=0;b.g.position.set(o.x+d.x*8,player.y,o.z+d.z*8);b.g.updateMatrixWorld(true);
     const bb=new THREE.Box3().setFromObject(b.body);out.push({i,y0:+player.y.toFixed(2),body:[+bb.min.y.toFixed(2),+bb.max.y.toFixed(2)],eye:+o.y.toFixed(2)});});
   const bb=new THREE.Box3().setFromObject(B[0].body);pitch=Math.atan2((bb.min.y+bb.max.y)/2-o.y,8);return out;})()`);
 log('fan bots',setup);await frames(2);
 const hp0=await XJ('bots.slice(0,5).map(b=>b.hp)');
 await X(`window.__ts=0;try{XRT.debt=0;clock.getDelta();}catch(e){}1`);// game time frozen around the click: the reads below see the burst's own frame
 const vw=VIEWS[0];await page.mouse.move(vw0[0]/2,vw0[1]/2);await page.mouse.down({button:'right'});await page.mouse.up({button:'right'});
 const s1=await XJ('{bs:J.bs,on:J.bsOn,cd:J.cd.x,u:J.bsU,hp:bots.slice(0,5).map(b=>b.hp),alive:bots.slice(0,5).map(b=>b.alive),gs:XAF.gs&&{alt:XAF.gs.alt,n:XAF.gs.n,tail:XAF.gs.tail},rw}');
 log('after right-click',s1);
 check('ALT FIRE: all 5 knives at once (knives 0, Blade Storm over, 0.45 s burst unequip)',s1.bs===0&&s1.on===false&&Math.abs(s1.cd-0.45)<0.05&&s1.u>0.3,s1);
 const dmg=s1.hp.map((h,i)=>hp0[i]-h);
 check('ALT FIRE fan: each of the 5 bots in the 2.5 deg fan slots 8 m out took one knife (50 body / 150 head / 42 legs)',dmg.every(d=>[50,150,42].includes(d)||(d>0&&!s1.alive[2])),{hp0,hp:s1.hp,dmg});
 check('ALT FIRE kill does not refill the knives',s1.alive[2]===false&&s1.bs===0&&s1.on===false,s1);
 check('arms play the two-handed RightClickAttack clip',!!(s1.gs&&s1.gs.alt),s1.gs);
 await frames(3);const cl=await XJ('{last:XAF.last,on:XAF.on}');log('clip',cl);
 check('RightClickAttack drawn',cl.last&&/RightClickAttack/.test(cl.last.clip||''),cl);
 await page.screenshot({path:SHOT+'bladestorm-alt-'+vw+'.jpg',quality:70,type:'jpeg'}).catch(e=>log('shot',String(e)));
 await X(`window.__ts=1;try{XRT.debt=0;clock.getDelta();}catch(e){}1`);
 // left click during the unequip: no knife swing
 const back=await untilF('rw!=="knife"&&!J.bsU',120000);
 const s2=await XJ('{rw,u:J.bsU,xaf:XAF.on,gun:gun.visible,ult:J.ult,bs:J.bs}');log('after unequip',s2);
 check('the gun comes back after the burst unequip, ability rig gone',back&&s2.rw!=='knife'&&s2.bs===0,s2);
 check('no page errors',!R.errors.some(e=>/pageerror/.test(e)),R.errors.filter(e=>/pageerror/.test(e)).slice(0,5));
 log('done',1);await browser.close();process.exit(0);
})().catch(e=>{R.errors.push('fatal '+String(e&&e.stack||e).slice(0,500));fs.writeFileSync(OUT,JSON.stringify(R,null,1));process.exit(1);});
