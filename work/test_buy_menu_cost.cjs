// Buy menu cost (user, 1 Nov 2026: "Opening the buy menu also causes lag"). The open menu (#xBuy) covers the whole screen with
// an 88 % panel (rgba(12,25,28,.88)) over a 3 px backdrop blur. A backdrop blur is recomputed by the compositor every frame
// anything under it changes, and the world canvas under it changed every frame: stub-GL Chromium at 1920 x 1080
// (qa/gpu/buybench.cjs, NOPL): 8.3 fps menu closed -> 1.4-1.8 fps open (p50 118 -> 711-803 ms; the GPU thread's display draw
// 93 -> 390 ms a frame); with the blur removed 4 fps / p50 145, with the menu hidden 8.5 fps: the cost is the blur being
// recomputed, not the menu's layers (one extra layer, nothing left composited after close).
// Fix (same look: the panel, the blur and the menu are unchanged): in the offline buy phase everyone is frozen in spawn (the
// bots do not tick, the player does not move while the menu is up and the cursor is free), so while the menu is open the world
// behind it redraws at most 10 fps, as behind the pause menu (perf pass 15); the compositor re-blurs at most 10 x a second.
// The sim, the round / buy timer and the menu itself still run every frame; the first frame after opening and every frame
// after closing draw the world.
// Checks:
// 1. CSS: the look is kept - #xBuy still has the 88 % panel and is display:none when closed. (The 3 px backdrop blur was
//    removed later, perf2, user-approved 1 Nov 2026, so online is smooth too: work/test_buy_menu_no_backdrop.cjs.)
// 2. Real page (page_harness, offline 5v5 buy phase), 60 frames of 1/60 s each: menu closed - the world draws every frame;
//    menu open - it draws on the opening frame and then at most 10 per second (red before: 60), the sim (round / buy timer)
//    still runs every frame; closed again - every frame. Online (MP.cl) and the deathmatch menu are untouched.
//    node work/test_buy_menu_cost.cjs
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
// ---------- 1. look kept ----------
assert.match(html,/#xBuy\{font-family:Arial,sans-serif!important;[^}]*background:rgba\(12,25,28,\.88\)!important;[^}]*\}/,'#xBuy keeps its 88 % panel');
assert.match(html,/#xBuy\{position:fixed;inset:0;z-index:25;display:none;/,'#xBuy is display:none when closed (no layer left behind)');
assert.match(html,/#xBuy\.on\{display:grid;/,'#xBuy.on shows the menu');
// ---------- 2. real page ----------
(async()=>{
 const {boot}=require('./page_harness.cjs');const H=boot({seed:5}),xe=H.xe;
 const tick=()=>new Promise(r=>setImmediate(r));
 const adv=async ms=>{for(let t=0;t<ms;t+=50){H.advance(Math.min(50,ms-t));await tick();}};
 const through=async()=>{for(let t=0;t<30000;t+=100){if(xe('running')&&!xe('!!window.xLdOn')&&!H.shown('pre')&&!H.shown('xAg'))return true;
  if(H.shown('pre'))H.$('preGo').click();else if(H.shown('xAg')){const tiles=H.doc.querySelectorAll('#xAg .x-ag').filter(b=>!b.disabled);if(tiles.length)tiles[0].click();await adv(20);H.$('xAgL').click();}
  await adv(100);}return false;};
 H.$('pm5v5').click();await adv(50);assert.ok(await through(),'5v5 did not start');
 xe('window.__rn=0;window.__qaR0=renderer.render;renderer.render=function(){window.__rn++;return window.__qaR0.apply(this,arguments);};window.__sr=0;window.__qaS0=xSimRun;xSimRun=function(){window.__sr++;return window.__qaS0.apply(this,arguments);};true');
 // n frames of 1/60 s: world draws (renderer.render) and sim runs (xSimRun: the round / buy timer, bots, input) counted
 const frames=async n=>{const r0=xe('__rn'),s0=xe('__sr'),f0=xe('XNF');for(let i=0;i<n;i++){H.advance(1000/60);await tick();}return {draws:xe('__rn')-r0,sim:xe('__sr')-s0,loops:xe('XNF')-f0};};
 xe('FV.cr=4000;FV.buy=50;player.hp=100;true');await frames(5);
 const closed=await frames(60);
 xe('buyMenu(true);true');assert.ok(xe('FV.menu')&&H.$('xBuy').classList.contains('on'),'buy menu opened');
 const open=await frames(60);
 assert.ok(xe('FV.menu'),'menu still open after 1 s');
 xe('buyMenu(false);true');assert.ok(!xe('FV.menu'),'menu closed');
 const after=await frames(60);
 // opening frame: the world is drawn on the first frame after the menu opens
 xe('buyMenu(true);true');const first=await frames(1);xe('buyMenu(false);true');
 console.log('world draws per 60 frames: closed',closed.draws,'| open',open.draws,'| closed again',after.draws,'| first frame after open',first.draws,'| sim runs while open',open.sim+'/'+open.loops);
 assert.ok(closed.draws>=58,'menu closed: the world draws every frame ('+closed.draws+'/60)');
 assert.ok(open.draws<=11,'menu open: the world behind the blurred menu draws '+open.draws+' x a second (max 11): each draw makes the compositor re-blur the whole screen');
 assert.ok(open.draws>=8,'menu open: the world still redraws ~10 fps ('+open.draws+')');
 assert.ok(open.loops>=58&&open.sim>=open.loops-1,'menu open: the game loop and the sim (round / buy timer) still run every frame ('+open.sim+' sim / '+open.loops+' frames)');
 assert.equal(first.draws,1,'the first frame after opening draws the world');
 assert.ok(after.draws>=58,'menu closed again: the world draws every frame ('+after.draws+'/60)');
 // deathmatch menu / online client: not throttled (others move behind it)
 const src=html.slice(html.indexOf('function xBmHold'),html.indexOf('function xBmHold')+600);
 assert.ok(/FV\.dm/.test(src)&&/MP\.cl/.test(src),'xBmHold leaves the deathmatch menu and online play alone');
 console.log('test_buy_menu_cost: OK');process.exit(0);
})().catch(e=>{console.error(e);process.exit(1);});
