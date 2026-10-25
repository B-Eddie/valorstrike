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
// Cascade: no later unconditional rule with the same selector may override a property the short rule sets.
for(const r of short){for(const sel of r.sel.split(',').map(s=>s.trim())){if(!/^#(pre|xAg)/.test(sel))continue;
 const props=r.body.split(';').map(d=>d.split(':')[0].trim()).filter(Boolean);
 for(const later of R.filter(x=>x.pos>r.pos&&!x.media&&x.sel.split(',').map(s=>s.trim()).includes(sel)))for(const p of props)assert(decl(later,p)==null,`${sel}{${p}} short-screen rule is overridden by a later base rule`);}}
// (c) DM/TDM leaderboard at 640x360 (browser-found): base top:180px + 173 px tall covered the credits/weapon/ammo block whose top is
// 96 px above the bottom; the short rule sits it above that block (bottom >= 100px, top auto) and compacts it so 5 rows fit.
{const lb=R.find(r=>r.media&&/max-height:\s*480px/.test(r.media)&&r.sel.trim()==='.x-dmlb');assert(lb,'.x-dmlb short-screen rule missing');
 assert.equal(decl(lb,'top'),'auto');assert(parseInt(decl(lb,'bottom'))>=100,'leaderboard must clear the bottom-right weapon block');
 for(const later of R.filter(x=>x.pos>lb.pos&&!x.media&&x.sel.split(',').map(s=>s.trim()).includes('.x-dmlb')))assert(decl(later,'top')==null&&decl(later,'bottom')==null,'.x-dmlb short rule overridden by a later base rule');}
console.log('short layout ok:',short.length,'max-height:560px rules');
