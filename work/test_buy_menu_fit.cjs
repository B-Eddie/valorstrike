// Buy menu fits the screen with no scrolling (user, 2026-10-26: "Make it so you don't need to scroll in the buy menu").
// 1. CSS: no scroll container in the buy menu outside the portrait / <360 px tall fallback, and nothing else in the page
//    gives #xBuy, its cards or its side panel a scroll, a sticky or a fixed min-height.
// 2. Layout probe (no browser here; hark's browser_buy_menu.cjs screenshots it): the rules between BUY MENU FIT START / END
//    are parsed, the media queries matched and every custom property evaluated (clamp / calc / min / max / vh / dvh / vw /
//    env) for each listed viewport, then the grid is laid out by the same arithmetic the CSS grid does: header + main +
//    key-hint rows, six weapon columns of five equal tracks above the shields / abilities row, stats + team on the right.
//    Asserted per viewport: every card track holds its content (and is >= 40 px on touch), names fit their column in
//    Arial metrics (+8 % for bold), ability names fit in two lines, the header fits its row and the width, the stats
//    panel + team loadout fit the height. The structural declarations the arithmetic relies on are asserted to be there.
// 3. Real page (page_harness): the menu renders 6 weapon columns (Heavies last) + Armor + abilities, the header close
//    button closes it, the 1-7 category keys and click-to-buy / right-click sell still work.
//    node work/test_buy_menu_fit.cjs   (VERBOSE=1 prints the per-viewport numbers)
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const A='/* BUY MENU FIT START',B='/* BUY MENU FIT END */';const i0=html.indexOf(A),i1=html.indexOf(B);assert.ok(i0>0&&i1>i0,'BUY MENU FIT block');
const block=html.slice(html.indexOf('*/',i0)+2,i1);const VERBOSE=!!process.env.VERBOSE;const fails=[];const fail=s=>fails.push(s);
// ---------- CSS parse: [{sel, decl:{prop:value}, media:string|null}] with one level of @media / @supports nesting ----------
function parse(css){css=css.replace(/\/\*[\s\S]*?\*\//g,'');const out=[];let i=0;
 const rule=(sel,body,media)=>{const decl={};body.split(';').forEach(d=>{const k=d.indexOf(':');if(k<0)return;const p=d.slice(0,k).trim(),v=d.slice(k+1).trim();if(!p)return;(decl[p]=decl[p]||[]).push(v);});out.push({sel:sel.trim(),decl,media});};
 const block=(s,media)=>{let j=0;while(j<s.length){const o=s.indexOf('{',j);if(o<0)break;const head=s.slice(j,o).trim();
  if(head.startsWith('@')){let d=1,k=o+1;while(d&&k<s.length){if(s[k]==='{')d++;else if(s[k]==='}')d--;k++;}block(s.slice(o+1,k-1),head);j=k;}
  else{const c=s.indexOf('}',o);rule(head,s.slice(o+1,c),media);j=c+1;}}};
 block(css,null);return out;}
const R=parse(block);
// ---------- 1. no scroll containers ----------
const FALLBACK=/orientation:portrait\) and \(max-width:820px\),\(max-height:359px\)/;
R.forEach(r=>{for(const p of ['overflow','overflow-y'])(r.decl[p]||[]).forEach(v=>{if(/auto|scroll/.test(v)&&!(r.media&&FALLBACK.test(r.media)))fail('scroll container in the buy menu: '+r.sel+'{'+p+':'+v+'} '+(r.media||''));});
 (r.decl.position||[]).forEach(v=>{if(/sticky/.test(v))fail('sticky in the buy menu: '+r.sel);});});
if(!R.some(r=>r.media&&FALLBACK.test(r.media)&&r.sel==='#xBuy.on'&&/auto/.test((r.decl['overflow-y']||[]).join())))fail('portrait fallback lost its scroll');
{const css=[...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map(m=>m[1]).join('\n'),out=css.replace(block,'');
 for(const m of out.matchAll(/([^{}]*#(?:xBuy|xBG|xBSd|xBTm)[^{}]*)\{([^}]*)\}/g)){const sel=m[1].trim().replace(/^.*\}/,''),b=m[2];
  if(/overflow(-y)?:(auto|scroll)/.test(b))fail('scroll outside the fit block: '+sel);if(/position:sticky/.test(b))fail('sticky outside the fit block: '+sel);
  if(/\.xb-card|\.x-bc|#xBG|\.xb-side|\.x-ws|\.xb-team/.test(sel)&&/(^|;)\s*(min-height|height|max-height|padding|font-size|gap|letter-spacing|grid-[\w-]+|display)\s*:/.test(b))fail('buy menu sizing outside the fit block: '+sel+'{'+b.slice(0,80)+'}');}
 if(/#xBuy \.x-bf\{font-size:12px/.test(out))fail('old .x-bf rule still overrides the footer');}
// ---------- 2. layout probe ----------
const need=(sel,prop,re)=>{const r=R.find(x=>!x.media&&x.sel===sel&&(x.decl[prop]||[]).some(v=>re.test(v)));if(!r)fail('structure: '+sel+'{'+prop+'} ~ '+re);};
need('#xBuy.on','grid-template-rows',/^var\(--xb-hh\) minmax\(0,1fr\) var\(--xb-fh\)$/);need('#xBuy.on','gap',/^var\(--xb-u\)$/);
need('#xBuy .xb-main','grid-template-columns',/^minmax\(0,1fr\) var\(--xb-sb\)$/);need('#xBuy .xb-main','gap',/^var\(--xb-u\)$/);
need('#xBG.x-bg','grid-template-columns',/^repeat\(6,minmax\(0,1fr\)\)$/);need('#xBG.x-bg','grid-template-rows',/^minmax\(0,1fr\) calc\(var\(--xb-h4\) \+ var\(--xb-g2\) \+ var\(--xb-ar\)\)$/);need('#xBG.x-bg','gap',/^var\(--xb-u\)$/);
need('#xBuy .x-bc','grid-template-rows',/^var\(--xb-h4\) repeat\(5,minmax\(0,1fr\)\)$/);need('#xBuy .x-bc','gap',/^var\(--xb-g2\)$/);
need('#xBuy .x-bh','height',/^var\(--xb-hh\)$/);need('#xBuy .x-bf','height',/^var\(--xb-fh\)$/);need('#xBuy .x-bc h4','height',/^var\(--xb-h4\)$/);
need('#xBuy .xb-card>button[data-n]','padding',/^var\(--xb-cp\) var\(--xb-cp\) var\(--xb-cp\) calc\(var\(--xb-cp\)\*1\.5\)$/);
need('#xBuy .xb-card>button[data-n]','grid-template-rows',/^auto minmax\(0,1fr\) auto$/);need('#xBuy .xb-card>button[data-n]','min-height',/^0$/);
need('#xBuy .xb-side','min-height',/^0$/);
// media matching (width / height / orientation / pointer, ',' = or, 'and')
function mediaOk(m,V){if(!m)return true;if(m.startsWith('@supports'))return true;const q=m.replace(/^@media\s*/,'');
 return q.split(/,(?![^(]*\))/).some(part=>[...part.matchAll(/\(([^)]+)\)/g)].every(([,c])=>{const [k,v]=c.split(':').map(s=>s.trim());const n=parseFloat(v);
  if(k==='max-width')return V.w<=n;if(k==='min-width')return V.w>=n;if(k==='max-height')return V.h<=n;if(k==='min-height')return V.h>=n;
  if(k==='orientation')return v==='portrait'?V.h>V.w:V.w>=V.h;if(k==='pointer')return v===(V.coarse?'coarse':'fine');if(k==='height')return true;return false;}));}
const appliesTo=(r,sel)=>r.sel.split(/,(?![^(]*\))/).map(s=>s.trim()).includes(sel);
function cascade(V,sel,prop){let v=null;for(const r of R)if(mediaOk(r.media,V)&&appliesTo(r,sel)&&r.decl[prop])v=r.decl[prop][r.decl[prop].length-1];return v;}
function vars(V){const o={};for(const r of R)if(mediaOk(r.media,V)&&(appliesTo(r,'#xBuy')||appliesTo(r,'#game #xBuy')))for(const [k,vs] of Object.entries(r.decl))if(k.startsWith('--'))o[k]=vs[vs.length-1];return o;}
function evalCss(expr,V,VA,depth=0){if(depth>20)throw Error('var loop '+expr);
 let s=expr.replace(/var\((--[\w-]+)\)/g,(m,k)=>{if(!(k in VA))throw Error('undefined '+k);return '('+evalCss(VA[k],V,VA,depth+1)+')';});
 s=s.replace(/env\(safe-area-inset-(\w+)\)/g,(m,k)=>String(V.inset[k]||0));
 s=s.replace(/(-?[\d.]+)(px|dvh|dvw|vh|vw)\b/g,(m,n,u)=>String(+n*(u==='px'?1:/h$/.test(u)?V.h/100:V.w/100)));
 s=s.replace(/\bclamp\(/g,'__c(').replace(/\bcalc\(/g,'(').replace(/\bmin\(/g,'Math.min(').replace(/\bmax\(/g,'Math.max(');
 if(/[a-z_]{2,}/i.test(s.replace(/Math\.(min|max)|__c/g,'')))throw Error('cannot evaluate '+expr+' -> '+s);
 return Function('__c','return ('+s+')')((a,b,c)=>Math.min(Math.max(a,b),c));}
// Arial advance widths (em), regular; bold text gets +8 %
const AW={A:.667,B:.667,C:.722,D:.722,E:.667,F:.611,G:.778,H:.722,I:.278,J:.5,K:.667,L:.556,M:.833,N:.722,O:.778,P:.667,Q:.778,R:.722,S:.667,T:.611,U:.722,V:.667,W:.944,X:.667,Y:.667,Z:.611,' ':.278,'·':.333,'/':.278,'-':.333,"'":.191,'.':.278,'0':.556};
const LW={a:.556,b:.556,c:.5,d:.556,e:.556,f:.278,g:.556,h:.556,i:.222,j:.222,k:.5,l:.222,m:.833,n:.556,o:.556,p:.556,q:.556,r:.333,s:.5,t:.278,u:.556,v:.5,w:.722,x:.5,y:.5,z:.5};
const tw=(t,fs,ls=0,upper=true,bold=false)=>{let e=0;for(const ch of (upper?t.toUpperCase():t))e+=(/\d/.test(ch)?.556:AW[ch]??LW[ch]??.6)+ls;return e*fs*(bold?1.08:1);};
const lines=(t,fs,ls,avail,bold)=>{let n=1,cur=0;for(const w of t.split(' ')){const ww=tw(w,fs,ls,true,bold);if(ww>avail)return 99;const add=(cur?tw(' ',fs,ls):0)+ww;if(cur&&cur+add>avail){n++;cur=ww;}else cur+=add;}return n;};
// data the menu shows
const WEAPS='Classic Shorty Frenzy Ghost Sheriff Stinger Spectre Bucky Judge Bulldog Guardian Phantom Vandal Marshal Outlaw Operator Ares Odin'.split(' ');
const KITS=[...html.matchAll(/buy: \[(\[[^\]]*\](?:, \[[^\]]*\])*)\]/g)].map(m=>JSON.parse('['+m[1]+']')).filter(k=>k.every(x=>/^[cqe]$/.test(x[0])));
assert.ok(KITS.length>=10,'agent kits parsed: '+KITS.length);
const VIEWS=[[1280,720],[1366,768],[1440,900],[1920,1080],[1920,969],[1280,657],[1536,864],[1600,900],[2560,1440],[1024,768],[844,390,1],[932,430,1],[844,390,1,{left:47,right:47,bottom:21}],[932,430,1,{left:59,right:59,bottom:21}],[667,375,1],[640,360,0],[640,360,1],[1280,600]];
const report=[];
for(const [w,h,coarse=0,inset={}] of VIEWS){const V={w,h,coarse:!!coarse,inset},VA=vars(V),g=k=>evalCss('var('+k+')',V,VA),tag=`${w}x${h}${coarse?' touch':''}${inset.left?' notch':''}`;
 const u=g('--xb-u'),p=g('--xb-p'),px=g('--xb-px'),f1=g('--xb-f1'),f2=g('--xb-f2'),fc=g('--xb-fc'),cp=g('--xb-cp'),sb=g('--xb-sb'),g2=g('--xb-g2'),hh=g('--xb-hh'),fh=g('--xb-fh'),h4=g('--xb-h4'),ar=g('--xb-ar'),sil=g('--xb-sil');
 const rows=cascade(V,'#xBuy.on','grid-template-rows'),foot=/var\(--xb-fh\)/.test(rows),disp=cascade(V,'#xBuy.on','display');
 if(disp!=='grid'){fail(tag+': not the fit layout ('+disp+')');continue;}
 const narrow=cascade(V,'#xBuy .xb-card>button.xb-w','grid-template-areas')==='"nm nm" "sil sil" "pr ft"';
 const silOn=cascade(V,'#xBuy .xb-w>svg','display')!=='none',dlOn=cascade(V,'#xBuy .x-ws dl','display')!=='none',wsSvg=cascade(V,'#xBuy .x-ws svg','display')!=='none';
 const kbdAb=cascade(V,'#xBuy .xb-a .xb-top kbd','display')!=='none',ldSmall=cascade(V,'#xBuy .xb-ld small','display')!=='none';
 const shc=cascade(V,'#xBuy .x-bc.xb-shc','grid-column'),abSpan=shc==='1/3'?4:3,shSpan=shc==='1/3'?2:3;if(cascade(V,'#xBuy .xb-shc .xb-card>button.xb-w','grid-template-areas')!=='"nm nm" "sil sil" "pr ft"')fail(tag+': shield cards not stacked');
 const pt=Math.max(p,inset.top||0),pb=Math.max(p,inset.bottom||0),pl=Math.max(px,inset.left||0),pr=Math.max(px,inset.right||0);
 const main=h-pt-pb-hh-u-(foot?u+fh:0),innerW=w-pl-pr,gridW=innerW-sb-u,col=(gridW-5*u)/6,arRow=h4+g2+ar,weapH=main-u-arRow,track=(weapH-h4-5*g2)/5;
 const cls=parseFloat(cascade(V,'#xBuy .xb-card>button[data-n]','letter-spacing'));/* card names: weight 500 (native-look override) = Arial regular */
 const cardIn=c=>c-cp*2.5-2;// left border 2 px
 const pf=narrow?f1:f1*.9,priceW=f1*.75+(u*.5+1)+tw('4700',pf,.04,true,true);
 // weapon card content height
 const ft=f2*1.4,nmL=f1*1.2;
 const need=narrow?cp*2+nmL+u*.5+(silOn?8:0)+u*.5+Math.max(nmL,ft):cp*2+Math.max(nmL,f1*1.2)+u*.5+(silOn?8:0)+u*.5+ft;
 if(track+1e-6<need)fail(`${tag}: weapon card track ${track.toFixed(1)} px < content ${need.toFixed(1)} px`);
 if(coarse&&track<40)fail(`${tag}: touch card ${track.toFixed(1)} px < 40 px`);
 // weapon names (one word, no wrap) in the narrowest column
 const ci=cardIn(col);for(const n of WEAPS){const nw=tw(n,f1,cls,true,false);const room=narrow?ci:ci-u-priceW;if(nw>room+0.5)fail(`${tag}: ${n} ${nw.toFixed(1)} px > ${room.toFixed(1)} px`);}
 if(narrow&&priceW>ci)fail(`${tag}: price ${priceW.toFixed(1)} > card ${ci.toFixed(1)}`);
 // shields + abilities row
 const shW=(shSpan*col+(shSpan-1)*u-2*g2)/3,shIn=cardIn(shW);
 for(const n of ['Light Armor','Regen Shield','Heavy Armor']){const L=lines(n,f1,cls,shIn,false);/* shields always stack: name (<= 2 lines) / silhouette / price + status */
  const nh=cp*2+L*nmL+u*.5+u*.5+Math.max(nmL,ft);if(priceW>shIn)fail(`${tag}: shield price ${priceW.toFixed(1)} > ${shIn.toFixed(1)}`);
  if(L>2)fail(`${tag}: ${n} does not fit its shield card (${shIn.toFixed(1)} px)`);if(nh>ar+1e-6)fail(`${tag}: ${n} card ${nh.toFixed(1)} > row ${ar.toFixed(1)}`);}
 for(const kit of KITS){const n=kit.length,abW=(abSpan*col+(abSpan-1)*u-(n-1)*g2)/n,ic=f1*1.4,kb=kbdAb?Math.max(f2*1.3,tw('E',f2-1,0,true,true)+6):0;
  const avail=cardIn(abW)-ic-u-(kbdAb?kb+u:0);
  for(const [,nm,pc] of kit){const L=lines(nm,f1,cls,avail,false);if(L>2){fail(`${tag}: ability "${nm}" needs ${L>9?'a wider card':L+' lines'} (${avail.toFixed(1)} px)`);continue;}
   const hgt=cp*2+Math.max(ic,L*nmL)+u*.5+Math.max(f1*1.2,ft);if(hgt>ar+1e-6)fail(`${tag}: ability card "${nm}" ${hgt.toFixed(1)} > ${ar.toFixed(1)}`);
   const ftW=priceW+u+tw('Full',f2-1,.1,true)+u+4;if(ftW>cardIn(abW)+0.5)fail(`${tag}: ability footer ${ftW.toFixed(1)} > ${cardIn(abW).toFixed(1)}`);}
  if(coarse&&ar<40)fail(`${tag}: touch ability card ${ar.toFixed(1)} < 40`);}
 // column headers: one line, label fits
 const h4ls=parseFloat(cascade(V,'#xBuy .x-bc h4','letter-spacing'));for(const lab of ['Sidearms','SMGs','Shotguns','Rifles','Snipers','Heavies']){const w4=f2*1.3+u*.75+tw(lab,f2,h4ls,true,false);/* h4 weight 400 (native-look override) */if(w4>col+0.5)fail(`${tag}: column header ${lab} ${w4.toFixed(1)} > ${col.toFixed(1)}`);}
 if(h4<f2*1.3+u*.5)fail(tag+': h4 row');
 // header: contents fit the row height and the width
 if(f2*1.2+2+fc>hh-u-1+1e-6)fail(tag+': header contents taller than --xb-hh');
 const hls=cascade(V,'#xBuy .x-bh p','letter-spacing'),hl=parseFloat(hls)||.14,hg=evalCss((cascade(V,'#xBuy .x-bh','gap')||'0').split(' ').pop(),V,VA);
 const items=[Math.max(tw('Credits',f2,hl),fc*.45+fc*.25+tw('9000',fc,.02,true,true)),Math.max(tw('Next round minimum',f2,hl),tw('9000',fc*.75,.02,true,true)+fc*.7),tw('Round 25 · Buy phase',f2+1,hl),Math.max(tw('Buy Time Remaining',f2,hl),tw('00:30',fc*.75,.02,true,true)),hh-u-1];
 const hw=items.reduce((a,b)=>a+b,0)+hg*(items.length-1);if(hw>innerW)fail(`${tag}: header ${hw.toFixed(0)} px wider than ${innerW.toFixed(0)}`);
 // side panel: stats (when a weapon is hovered / tapped) + team loadout (you + 4) fit the main row
 const dl1=cascade(V,'#xBuy .x-ws dl','grid-template-columns')==='minmax(0,1fr)';const rqb=coarse?32:evalCss('clamp(24px,calc(var(--xb-vh)*4),32px)',V,VA);
 const li=f2*1.3+u*.5+1,team=cp*2+f2*1.3+u*.5+5*li+(f2-1)*1.3+u*.5+rqb;
 const tRow=f2*1.3+(f2-1)*1.3,stats=cp*2+(wsSvg?16+u*.5:0)+f1*1.5*1.1+u*.5+f2*1.4+u*.5+Math.max(f1*1.1,f2*1.4)+u*.5+(Math.max((f2-1)*1.2,f2*1.2)+u*.5+1)*4+(dlOn?u*.5+(dl1?6:3)*(f2*1.2+u*.5+1):0);
 const side=team+u+stats;if(side>main+1e-6)fail(`${tag}: stats + team ${side.toFixed(1)} px > ${main.toFixed(1)} px`);
 const sideIn=sb-cp*3-2,teamRow=tw('You',f2,.06,false,true)+u+f2*3+u+(f2*.75+u*.5+1+tw('9000',f2,.04,true,true));if(teamRow>sideIn)fail(`${tag}: team row ${teamRow.toFixed(1)} > ${sideIn.toFixed(1)}`);
 const dlRow=(tw('Run speed',f2-1,.04)+4+tw('5.40 m/s',f2,0,false))*(dl1?1:2)+(dl1?0:u);if(dlOn&&dlRow>sideIn)fail(`${tag}: stats rows ${dlRow.toFixed(1)} > ${sideIn.toFixed(1)}`);
 const r={tag,u:+u.toFixed(1),f1:+f1.toFixed(1),f2:+f2.toFixed(1),col:+col.toFixed(1),track:+track.toFixed(1),need:+need.toFixed(1),ar:+ar.toFixed(1),side:+side.toFixed(1),main:+main.toFixed(1),narrow,foot,silOn};report.push(r);if(VERBOSE)console.log(JSON.stringify(r));}
// portrait / very short keep the scrolling stacked layout
for(const [w,h] of [[390,844],[568,320]]){const V={w,h,coarse:true,inset:{}};if(cascade(V,'#xBuy.on','display')!=='flex'||cascade(V,'#xBuy.on','overflow-y')!=='auto')fail(`${w}x${h}: expected the stacked scroll fallback`);}
// ---------- 3. real page ----------
(async()=>{
 const {boot}=require('./page_harness.cjs');const H=boot({seed:5}),xe=H.xe;
 const adv=async ms=>{for(let t=0;t<ms;t+=50){H.advance(Math.min(50,ms-t));await new Promise(r=>setImmediate(r));}};
 const through=async()=>{for(let t=0;t<30000;t+=100){if(xe('running')&&!xe('!!window.xLdOn')&&!H.shown('pre')&&!H.shown('xAg'))return true;
  if(H.shown('pre'))H.$('preGo').click();else if(H.shown('xAg')){const tiles=H.doc.querySelectorAll('#xAg .x-ag').filter(b=>!b.disabled);if(tiles.length)tiles[0].click();await adv(20);H.$('xAgL').click();}
  await adv(100);}return false;};
 H.$('pm5v5').click();await adv(50);assert.ok(await through(),'5v5 did not start');
 xe('FV.cr=9000;FV.buy=20;FV.pri=null;FV.sec="Classic";FV.bt=[];player.armor=0;true');H.key('KeyB',true);H.key('KeyB',false);await adv(50);
 if(!xe('FV.menu'))xe('buyMenu(true);true');assert.ok(xe('FV.menu')&&H.$('xBuy').classList.contains('on'),'B opens the buy menu');
 const cols=H.doc.querySelectorAll('#xBG .x-bc').map(c=>String(c.querySelector('h4').textContent).replace(/^\d/,'').trim());
 assert.deepEqual(cols.slice(0,7),['Sidearms','SMGs','Shotguns','Rifles','Snipers','Heavies','Armor'],'columns '+cols.join(','));
 assert.ok(/Abilities/.test(cols[7]||''),'abilities column '+cols[7]);
 assert.equal(H.doc.querySelectorAll('#xBG .x-bc')[5].querySelectorAll('button[data-n]').length,2,'Heavies: Ares + Odin');
 assert.ok(!H.$('xBuy').querySelector('[style*="overflow"]'),'no inline overflow');
 H.key('Digit6',true);H.key('Digit6',false);assert.equal(xe('FV.cat'),6,'6 -> heavies');H.key('Digit7',true);H.key('Digit7',false);assert.equal(xe('FV.cat'),4,'7 -> armor');
 const btn=n=>H.doc.querySelectorAll('#xBG button[data-n]').find(b=>b.dataset.n===n);btn('Odin').click();await adv(20);
 assert.equal(xe('FV.pri'),'Odin','click buys');assert.equal(xe('FV.cr'),5800);
 H.dispatch(btn('Odin'),H.mkEvent('contextmenu',{}));assert.equal(xe('FV.pri'),null,'right-click sells');assert.equal(xe('FV.cr'),9000);
 const x=H.$('xBX');assert.ok(x&&x.getAttribute('aria-label')==='Close buy menu','close button');x.click();await adv(20);
 assert.ok(!xe('FV.menu')&&!H.$('xBuy').classList.contains('on'),'close button closes the menu');
 xe('buyMenu(true);true');H.key('Escape',true);await adv(20);
 const esc=H.dispatch(H.win,H.mkEvent('keydown',{key:'Escape',code:'Escape'}));await adv(20);assert.ok(!xe('FV.menu'),'Escape still closes');
 if(fails.length){console.error(fails.slice(0,40).join('\n'));console.error(fails.length+' failure(s)');process.exit(1);}
 console.log('test_buy_menu_fit: OK ('+report.length+' viewports fit with no scroll; min card track '+Math.min(...report.map(r=>r.track)).toFixed(1)+' px, min touch track '+Math.min(...report.filter(r=>/touch/.test(r.tag)).map(r=>r.track)).toFixed(1)+' px)');
 process.exit(0);
})().catch(e=>{console.error(fails.join('\n'));console.error(e);process.exit(1);});
