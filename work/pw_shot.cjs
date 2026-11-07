// Screenshot helper for the headless Chromium scripts (SwiftShader). page.screenshot needs a fresh compositor frame; with
// the game loop saturating the main thread on a loaded box it timed out after 300 s (abil_dm1, perf_cull2, hud_b4).
// The loop is held for the capture: requestAnimationFrame callbacks are parked while window.__shotHold is set and run
// again right after, so the page is idle, the last drawn frame is composited and the game state is unchanged.
//   require('./pw_shot.cjs')(ctx,page)   (after ctx.newPage(), before page.goto)
module.exports=async(ctx,page)=>{
 await ctx.addInitScript(()=>{if(window.__shotInstalled)return;window.__shotInstalled=1;const raf=window.requestAnimationFrame.bind(window);let q=[];window.__shotHold=0;
  window.requestAnimationFrame=f=>raf(t=>{if(window.__shotHold){q.push(f);return;}f(t);});
  window.__shotRelease=()=>{window.__shotHold=0;const L=q;q=[];for(const f of L)raf(f);};});
 const shot=page.screenshot.bind(page);
 page.screenshot=async(o={})=>{await page.evaluate(()=>{window.__shotHold=1;}).catch(()=>{});await page.waitForTimeout(250);
  try{return await shot(o);}finally{await page.evaluate(()=>window.__shotRelease&&window.__shotRelease()).catch(()=>{});}};
};
