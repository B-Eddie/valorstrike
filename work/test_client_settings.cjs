// Settings, mid-match and across a reload: the real page (audit.js fake DOM) with the real three.js scene graph
// (work/page_harness.cjs, real3) in a running offline 5v5 on Ascent. Every control in the Settings modal (each
// segmented choice, checkbox, slider, crosshair colour and crosshair option) and a keybind are changed one at a time
// through their own UI events while the match runs; after each change the match keeps ticking (frames rendered, the
// clock advancing) with no page exception, and the setting's effect is checked where the page exposes one (renderer
// shadows / pixel ratio / anti-aliasing, skyline visibility, FPS readout, crosshair colour, sensitivity, hit markers,
// damage numbers, aim assist, dynamic crosshair, difficulty, auto-reload, minimap rotation, colourblind HUD). Then
// the page is booted again over the same localStorage (a reload): every control shows the value chosen before the
// reload and the page's settings state equals the pre-reload state.
//   node work/test_client_settings.cjs     (in test_all)
const {boot,lsStore}=require('./page_harness.cjs');
const VERBOSE=!!process.env.VERBOSE,SEED=+(process.env.SEED||3);
const fails=[];const fail=s=>{fails.push(s);if(VERBOSE)console.log('FAIL',s);};
const SNAP=`(()=>{const o={};const m=document.getElementById("mSet");
 m.querySelectorAll(".seg").forEach((s,i)=>{const k=s.id||s.dataset.key||("seg"+i);const b=s.querySelector("button.on");o["seg:"+k]=b?b.dataset.v:null;});
 m.querySelectorAll("input").forEach(i=>{if(i.id)o["in:"+i.id]=(i.type||i.getAttribute("type"))==="checkbox"?!!i.checked:String(+i.value);});
 const sw=document.getElementById("xhSw").querySelector("button.on");o.xh=sw?sw.title:null;o.keys=JSON.stringify(XS.keys);return o;})()`;
const STATE=`(()=>({sens:S.sens,tsens:S.tsens,vol:S.vol,mvol:S.mvol,bright:S.bright,fps:!!S.fps,diff:S.diff,xh:S.xh,hm:!!S.hm,dn:!!S.dn,xhd:S.xhd!==false,autoReload:!!S.autoReload,
 mr:!!XOB.mr,res:XS.res,scale:XS.scale,aa:!!XS.aa,aim:XS.aim,shd:XS.shd,sky:XS.sky!==false,cap:String(XS.cap),keys:JSON.stringify(XS.keys),xhc:document.documentElement.style.getPropertyValue("--xh")||""}))()`;
(async()=>{
 const store=lsStore();
 const H=boot({real3:true,seed:SEED,ls:store}),xe=H.xe;const adv=async ms=>{for(let t=0;t<ms;t+=50){H.advance(Math.min(50,ms-t));await new Promise(r=>setImmediate(r));}};
 const errs0=H.errors.length,x0=H.xErrCalls.length;
 xe('FV.pick="ascent";FV.srOn=0;window.xSwift=false;startFive();true');await adv(400);xe('FV.buy=0;true');await adv(300);
 if(!xe('running&&mode==="five"'))fail('match did not start');
 // open settings from the pause menu (Esc -> Settings tab -> Open settings), as a player would mid-match
 H.dispatch(H.win,H.mkEvent('keydown',{key:'Escape',code:'Escape'}));await adv(100);
 try{H.$('xSet').click();}catch(e){fail('Open settings: '+e.message);}await adv(100);
 const before=xe(SNAP);if(VERBOSE)console.log('defaults',JSON.stringify(before));
 const ticking=async(what)=>{const f0=xe('typeof xFrameN!=="undefined"?xFrameN:0'),c0=xe('(FV.t||0)+(FV.rt||0)');xe('paused=false;try{document.getElementById("xPause").classList.remove("on")}catch(e){}true');await adv(400);
  const e=H.errors.slice(errs0),x=H.xErrCalls.slice(x0);if(e.length||x.length){fail(what+': page exception '+JSON.stringify((e[0]||x[0])).slice(0,300));H.errors.length=errs0;H.xErrCalls.length=x0;}
  if(!xe('running'))fail(what+': the match stopped');};
 const segs=xe(`[...document.querySelectorAll("#mSet .seg")].map((s,i)=>({k:s.id||s.dataset.key||("seg"+i),vs:[...s.querySelectorAll("button")].map(b=>b.dataset.v),on:(s.querySelector("button.on")||{dataset:{}}).dataset.v}))`);
 const choice={};
 for(const s of segs){ // pick a value other than the current one (the last such button); the quality preset first so later knobs make it custom
  const v=s.vs.filter(x=>x!==s.on).pop();if(v==null)continue;choice[s.k]=v;}
 const order=Object.keys(choice).sort((a,b)=>(a==='xGQ'?-1:0)-(b==='xGQ'?-1:0));
 for(const k of order){const v=choice[k];
  xe(`(()=>{const s=[...document.querySelectorAll("#mSet .seg")].find(x=>(x.id||x.dataset.key)===${JSON.stringify(k)});[...s.querySelectorAll("button")].find(b=>b.dataset.v===${JSON.stringify(v)}).click();return true;})()`);
  await ticking('seg '+k+'='+v);
  const on=xe(SNAP)['seg:'+k];if(on!==v)fail(`seg ${k}: clicked ${v}, shows ${on}`);}
 // checkboxes and sliders
 const ins=xe(`[...document.querySelectorAll("#mSet input")].filter(i=>i.id).map(i=>({id:i.id,t:i.type||i.getAttribute("type"),min:+(i.min??i.getAttribute("min")),max:+(i.max??i.getAttribute("max")),st:+(i.step??i.getAttribute("step"))||1,v:(i.type||i.getAttribute("type"))==="checkbox"?!!i.checked:+i.value}))`);
 for(const i of ins){
  if(i.t==='checkbox'){xe(`(()=>{const el=document.getElementById(${JSON.stringify(i.id)});el.checked=${!i.v};el.dispatchEvent(new Event("change",{bubbles:true}));el.dispatchEvent(new Event("input",{bubbles:true}));return true;})()`);}
  else{let nv=i.min+(i.max-i.min)*0.37;nv=Math.round(nv/i.st)*i.st;nv=+nv.toFixed(4);if(nv===i.v)nv=+(nv+i.st).toFixed(4);i.nv=nv;
   xe(`(()=>{const el=document.getElementById(${JSON.stringify(i.id)});el.value=String(${nv});el.dispatchEvent(new Event("input",{bubbles:true}));el.dispatchEvent(new Event("change",{bubbles:true}));return true;})()`);}
  await ticking('input '+i.id);}
 // crosshair colour (a non-default swatch) and a keybind (Jump -> KeyH through the Controls list)
 const sw=xe('(()=>{const b=[...document.getElementById("xhSw").querySelectorAll("button")].filter(x=>!x.classList.contains("on")).pop();b.click();return b.title;})()');await ticking('crosshair colour '+sw);
 xe('(()=>{const b=[...document.getElementById("xKb").querySelectorAll("button")].find(x=>x.dataset.a==="jump");b.click();return true;})()');H.dispatch(H.win,H.mkEvent('keydown',{code:'KeyH',key:'h',isTrusted:true}));H.dispatch(H.win,H.mkEvent('keyup',{code:'KeyH',key:'h',isTrusted:true}));await ticking('keybind');
 if(xe('XS.keys.jump')!=='KeyH')fail('keybind: Jump not rebound to H ('+xe('XS.keys.jump')+')');
 const after=xe(SNAP),st=xe(STATE);if(VERBOSE)console.log('after',JSON.stringify(after),'\nstate',JSON.stringify(st));
 for(const i of ins){const v=after['in:'+i.id];const want=i.t==='checkbox'?!i.v:String(i.nv);if(v!==want)fail(`input ${i.id}: set ${want}, shows ${v}`);}
 // effects
 const fx=xe(`({shadow:!!renderer.shadowMap.enabled,pr:renderer.getPixelRatio(),fpsShown:document.getElementById("fps").style.display==="block"})`);
 if(st.shd!==after['seg:xShd'])fail(`shadows: control ${after['seg:xShd']}, state ${st.shd}`);if((st.shd!=='off')!==fx.shadow)fail(`shadows ${st.shd} but renderer.shadowMap.enabled ${fx.shadow}`);
 if(st.fps!==(after['seg:fps']==='1')||st.fps!==fx.fpsShown)fail(`FPS readout: control ${after['seg:fps']} state ${st.fps} shown ${fx.fpsShown}`);
 if(st.diff!==after['seg:diff'])fail('difficulty state '+st.diff+' control '+after['seg:diff']);
 if(st.hm!==(after['seg:hm']==='1'))fail('hit marker state '+st.hm);if(st.dn!==(after['seg:dn']==='1'))fail('damage numbers state '+st.dn);
 if(st.aim!==after['seg:xAim'])fail('aim assist state '+st.aim+' control '+after['seg:xAim']);
 if(st.xhd!==(after['seg:xXhM']!=='static'))fail('dynamic crosshair state '+st.xhd+' control '+after['seg:xXhM']);
 if(st.sky!==(after['seg:xSky']==='1'))fail('skyline state '+st.sky+' control '+after['seg:xSky']);
 if(st.aa!==(after['seg:xAA']==='1'))fail('anti-aliasing state '+st.aa+' control '+after['seg:xAA']);
 if(st.res!==after['seg:xRes'])fail('resolution state '+st.res+' control '+after['seg:xRes']);
 if(String(st.scale)!==after['seg:xRsc'])fail('render scale state '+st.scale+' control '+after['seg:xRsc']);
 if(st.cap!==after['seg:xFpsL'])fail('FPS limit state '+st.cap+' control '+after['seg:xFpsL']);
 if(Math.abs(st.sens-(+after['in:sSens']))>1e-9)fail('sensitivity state '+st.sens+' control '+after['in:sSens']);
 if(st.autoReload!==after['in:xAuR'])fail('auto-reload state '+st.autoReload);if(st.mr!==after['in:xMiniRot'])fail('minimap rotation state '+st.mr);
 // let deferred saves land, then reload over the same storage
 await adv(200);xe('running=false;clearTimeout(FV.to);try{toLobby()}catch(e){}true');await adv(100);
 const H2=boot({real3:true,seed:SEED+1,ls:store});const adv2=async ms=>{for(let t=0;t<ms;t+=50){H2.advance(Math.min(50,ms-t));await new Promise(r=>setImmediate(r));}};await adv2(300);
 const e20=H2.errors.length;
 const re=H2.xe(SNAP),st2=H2.xe(STATE);if(VERBOSE)console.log('reloaded',JSON.stringify(re),'\nstate',JSON.stringify(st2));
 for(const k of Object.keys(after))if(re[k]!==after[k])fail(`after reload ${k}: was ${JSON.stringify(after[k])}, shows ${JSON.stringify(re[k])}`);
 for(const k of Object.keys(st))if(JSON.stringify(st2[k])!==JSON.stringify(st[k]))fail(`after reload state ${k}: was ${JSON.stringify(st[k])}, now ${JSON.stringify(st2[k])}`);
 // and the reloaded page still plays a match with them
 H2.xe('FV.pick="ascent";FV.srOn=0;startFive();true');await adv2(600);if(!H2.xe('running'))fail('reloaded page: match did not start');
 const fx2=H2.xe(`({shadow:!!renderer.shadowMap.enabled,fpsShown:document.getElementById("fps").style.display==="block"})`);if(fx2.shadow!==fx.shadow)fail('after reload renderer shadows '+fx2.shadow+' (before '+fx.shadow+')');if(fx2.fpsShown!==fx.fpsShown)fail('after reload FPS readout shown '+fx2.fpsShown);
 if(H2.errors.length>e20)fail('reloaded page exception '+JSON.stringify(H2.errors.slice(e20,e20+2)).slice(0,300));
 if(fails.length){console.error(fails.slice(0,40).join('\n'));process.exit(1);}
 console.log(`Settings (real scene, offline 5v5): ${order.length} choices, ${ins.length} checkboxes / sliders, a crosshair colour and a keybind changed mid-match (match keeps ticking, no exceptions, effects applied); after a reload every control and setting is as chosen`);
 process.exit(0);
})().catch(e=>{console.error(e);process.exit(1);});
