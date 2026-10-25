// Short landscape screens (640x360): the map pre-screen GO button stays reachable and the agent-select
// details no longer overlap the agent cards / LOCK IN. Guards the max-height:560px rules and their cascade order
// (a later same-specificity base rule would silently cancel them, as happened with #xAg justify-content).
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert');
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const css=[...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map(m=>m[1]).join('\n');
// Tokenise top-level rules, tagging those inside @media blocks.
function rules(src){const out=[];let i=0,depth=0,media=null,start=0;while(i<src.length){const c=src[i];if(c==='/'&&src[i+1]==='*'){i=src.indexOf('*/',i+2)+2;start=i;continue;}
 if(c==='{'){const sel=src.slice(start,i).trim();if(depth===0&&sel.startsWith('@media')){media=sel;depth=1;start=i+1;i++;continue;}const end=src.indexOf('}',i);out.push({media,sel,body:src.slice(i+1,end),pos:out.length});i=end+1;start=i;continue;}
 if(c==='}'&&depth===1){depth=0;media=null;start=i+1;}i++;}return out;}
const R=rules(css);
const short=R.filter(r=>r.media&&/max-height:\s*560px/.test(r.media));
const find=(sel)=>short.find(r=>r.sel.split(',').map(s=>s.trim()).includes(sel));
const decl=(r,prop)=>{const m=r&&r.body.match(new RegExp('(?:^|;)\\s*'+prop+'\\s*:\\s*([^;]+)'));return m&&m[1].trim();};
// (a) map pre-screen
const pre=find('#pre'),preRow=find('#pre>.row');
assert(pre,'#pre short-screen rule missing');assert.equal(decl(pre,'justify-content'),'flex-start');assert.equal(decl(pre,'overflow-y'),'auto');
assert(preRow,'#pre>.row sticky rule missing');assert.equal(decl(preRow,'position'),'sticky');assert.equal(decl(preRow,'bottom'),'0');
assert(/<div id="pre">[\s\S]*?<div class="row"><button class="play" id="preGo">GO<\/button>/.test(html),'GO is no longer a direct child .row of #pre');
// (b) agent select
const ag=find('#xAg'),agm=find('#xAg>.x-agm'),agc=find('#xAg>.x-agc'),lk=find('#xAg>#xAgL');
assert(ag&&agm&&agc&&lk,'#xAg short-screen rules missing');
assert.equal(decl(ag,'overflow-y'),'auto');assert(+decl(agc,'order')<+decl(agm,'order')&&+decl(agm,'order')<+decl(lk,'order'),'cards must come before details on short screens');assert.equal(decl(ag,'justify-content'),'flex-start');assert.equal(decl(agm,'flex'),'none');assert.equal(decl(lk,'position'),'sticky');
assert(/<div id="xAg"[\s\S]*?id="xAgL"/.test(html),'LOCK IN button #xAgL missing from #xAg');
// (c) spectate bar leaves the centre of a 360 px screen
const sp=find('.x-sp');assert(sp&&decl(sp,'bottom')==='6px','spectate bar not moved down on short screens');assert(find('.x-sp small')&&decl(find('.x-sp small'),'display')==='none');
assert(R.findIndex(r=>r===sp)>R.findIndex(r=>!r.media&&r.sel==='.x-sp'),'short .x-sp rule must follow the base rule');
// (g) Tab scoreboard on a 360 px tall screen: both teams fit (was: 44 px rows, own team only, enemies clipped by overflow:hidden).
{const B=sel=>short.find(r=>r.sel===sel);const px=(sel,prop)=>parseFloat(decl(B(sel),prop));
 for(const s of ['#xBoard','#xBoard .x-sbt td','#xBoard .x-sbt th','#xBoard .x-sbt','#xBoard .x-sbsc b','#xBoard .x-sbtop','#xBoard .x-ag'])assert(B(s),'short #xBoard rule missing: '+s);
 const pad=decl(B('#xBoard'),'padding').split(/\s+/).map(parseFloat),top=decl(B('#xBoard .x-sbtop'),'padding').split(/\s+/).map(parseFloat);
 const header=px('#xBoard .x-sbsc b','font-size')+top[2]+parseFloat(decl(B('#xBoard .x-sbtop'),'margin-bottom'))+1;
 const table=px('#xBoard .x-sbt th','height')+5*px('#xBoard .x-sbt td','height')+parseFloat(decl(B('#xBoard .x-sbt'),'margin').split(/\s+/)[2]);
 const need=pad[0]+pad[2]+header+2*table;assert(need<=360-24,'scoreboard needs '+need+' px on a 360 px screen');
 assert(px('#xBoard .x-ag','height')<=px('#xBoard .x-sbt td','height'),'avatar taller than the compact row');
 const last=R.filter(r=>!r.media&&r.sel.split(',').map(x=>x.trim()).includes('#xBoard .x-sbt td')).pop();assert(R.indexOf(B('#xBoard .x-sbt td'))>R.indexOf(last),'short #xBoard rows must follow the base rule');}
// Cascade: no later unconditional rule with the same selector may override a property the short rule sets.
for(const r of short){for(const sel of r.sel.split(',').map(s=>s.trim())){if(!/^#(pre|xAg)/.test(sel))continue;
 const props=r.body.split(';').map(d=>d.split(':')[0].trim()).filter(Boolean);
 for(const later of R.filter(x=>x.pos>r.pos&&!x.media&&x.sel.split(',').map(s=>s.trim()).includes(sel)))for(const p of props)assert(decl(later,p)==null,`${sel}{${p}} short-screen rule is overridden by a later base rule`);}}
// (c) DM/TDM leaderboard at 640x360 (browser-found): base top:180px + 173 px tall covered the credits/weapon/ammo block whose top is
// 96 px above the bottom; the short rule sits it above that block (bottom >= 100px, top auto) and compacts it so 5 rows fit.
{const lb=R.find(r=>r.media&&/max-height:\s*480px/.test(r.media)&&r.sel.trim()==='.x-dmlb');assert(lb,'.x-dmlb short-screen rule missing');
 assert.equal(decl(lb,'top'),'auto');assert(parseInt(decl(lb,'bottom'))>=100,'leaderboard must clear the bottom-right weapon block');
 for(const later of R.filter(x=>x.pos>lb.pos&&!x.media&&x.sel.split(',').map(s=>s.trim()).includes('.x-dmlb')))assert(decl(later,'top')==null&&decl(later,'bottom')==null,'.x-dmlb short rule overridden by a later base rule');}
// (d) In-match subtitle (#xSub: "5V5 · ASCENT · ROUND 1 · ATTACK · 1100 CR · SPIKE PLANTED A") at 640x360 (browser-found):
// centred and unbounded it ran under the minimap. Landscape ≤820/≤700 px rules bound it (nowrap + ellipsis) so its left edge
// clears the minimap's right edge + 8 px at every width in each band; portrait keeps its own full-width rule.
{const sub=(q)=>R.filter(r=>r.media&&r.media.replace(/\s/g,'')===q&&r.sel.trim()==='#game #xSub');
 const s820=sub('@media(max-width:820px)and(orientation:landscape)')[0],s700=sub('@media(max-width:700px)and(orientation:landscape)')[0];
 assert(s820&&s700,'#xSub short-landscape rules missing');
 assert.equal(decl(s820,'white-space'),'nowrap');assert.equal(decl(s820,'overflow'),'hidden');assert.equal(decl(s820,'text-overflow'),'ellipsis');
 const px=(r,sel,p)=>parseFloat(decl(R.filter(x=>x.sel.trim()===sel&&(r===null?!x.media:x.media&&x.media.replace(/\s/g,'')===r)).pop(),p));
 const mm={base:px(null,'#xMap','left')+px(null,'#xMap','width')+2,narrow:px('@media(max-width:700px)','#xMap','left')+px('@media(max-width:700px)','#xMap','width')+2};
 const off=r=>{const m=decl(r,'max-width').match(/^calc\(100vw - (\d+)px\)$/);assert(m,'max-width must be calc(100vw - Npx)');return +m[1]/2;};
 assert(off(s820)>=mm.base+8,`701-820 px: subtitle left edge ${off(s820)} px must clear the ${mm.base} px minimap + 8`);
 assert(off(s700)>=mm.narrow+8,`<=700 px: subtitle left edge ${off(s700)} px must clear the ${mm.narrow} px minimap + 8`);
 assert(R.indexOf(s820)>R.findIndex(r=>r.media&&/max-width:820px\)$/.test(r.media)&&r.sel.trim()==='#game #xSub')&&R.indexOf(s700)>R.indexOf(s820),'subtitle bounds must follow the 820 px rule and the 700 px band must follow the 820 px band');
 const coarse=R.filter(r=>r.media&&/pointer:\s*coarse/.test(r.media)&&r.sel.trim()==='#xMap').pop();if(coarse)assert(off(s700)>=parseFloat(decl(coarse,'left'))+parseFloat(decl(coarse,'width'))+2+8,'touch minimap');
 for(const later of R.filter(x=>x.pos>s700.pos&&x.sel.trim()==='#game #xSub'&&!(x.media&&/max-width:480px/.test(x.media))))assert(decl(later,'max-width')==null&&decl(later,'white-space')==null,'later #xSub rule overrides the subtitle bounds');}
// (e) Kill feed vs subtitle at 640x360-class landscape (fine pointer): the feed column (right:8px) and #xSub both started at
// top:48px, so a stacked feed row wider than the subtitle's side margin ran across it. In each landscape band the feed's top
// must sit below the subtitle's line box (top + line-height) + 4 px, the touch / portrait placements must not land on it,
// and no later unconditional or landscape rule may pull the feed back up.
{const land=R.filter(r=>r.media&&r.media.replace(/\s/g,'')==='@media(max-width:820px)and(orientation:landscape)');
 const fw=land.filter(r=>r.sel.trim()==='#game .hud.x-fw').pop(),sub=land.filter(r=>r.sel.trim()==='#game #xSub').pop();assert(fw&&sub,'short-landscape feed / subtitle rules missing');
 const subTop=parseFloat(decl(R.filter(r=>r.media&&/max-width:820px\)$/.test(r.media)&&r.sel.trim()==='#game #xSub').pop(),'top')),lh=parseFloat(decl(sub,'line-height'));
 assert(subTop>0&&lh>0,'subtitle top / explicit line-height');const below=subTop+lh+4;
 assert(parseFloat(decl(fw,'top'))>=below,`feed top ${decl(fw,'top')} must clear the subtitle (${subTop}+${lh}+4)`);
 const narrowFw=R.filter(r=>r.media&&/max-width:820px\)$/.test(r.media)&&r.sel.trim()==='#game .hud.x-fw').pop();assert(narrowFw&&R.indexOf(fw)>R.indexOf(narrowFw),'feed rule must follow the 820 px rule');
 const coarse=R.filter(r=>r.media&&/pointer:\s*coarse/.test(r.media)&&r.sel.trim()==='#game .hud.x-fw').pop();if(coarse)assert(parseFloat(decl(coarse,'top'))>=below,'touch feed top must clear the subtitle');
 for(const later of R.filter(x=>x.pos>fw.pos&&x.sel.split(',').map(s=>s.trim()).includes('#game .hud.x-fw')&&!(x.media&&/pointer:\s*coarse|max-width:480px/.test(x.media))))assert(decl(later,'top')==null,'a later rule moves the feed back onto the subtitle row: '+(later.media||'(base)'));
 const sizeFeed=R.filter(r=>r.media&&/max-width:820px\)$/.test(r.media)&&/#game #feed \.kf/.test(r.sel)).pop();assert(sizeFeed&&parseFloat(decl(sizeFeed,'height'))<=24,'compact feed rows');}
console.log('short layout ok:',short.length,'max-height:560px rules; in-match subtitle clears the minimap and the kill feed starts below it at 640x360-class landscape');
