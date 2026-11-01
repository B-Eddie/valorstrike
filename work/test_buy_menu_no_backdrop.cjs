// The open buy menu must not have a backdrop blur (perf2, user 1 Nov 2026, approved: "REMOVE the buy menu's
// backdrop-filter blur(3px), so online is smooth too").
// #xBuy covers the whole screen; with a backdrop-filter the compositor re-blurs everything under it whenever the world
// behind changes, i.e. every frame (qa/gpu buybench, stub-GL Chromium 1080p: open 1.4-1.8 fps vs 4 fps with the blur
// really removed). Offline the world behind the open menu is held to 10 fps (xBmHold, test_buy_menu_cost); online it keeps
// drawing, so only removing the blur makes the menu smooth there. Several rules set it: the base look
// (#game #xBuy,#xBuy{... blur(4px)}), the later look pass (#xBuy{... background:rgba(12,25,28,.88)!important;
// backdrop-filter:blur(3px)!important}, which wins), and the shared frosted-frame class the element carries
// (.x-fr{backdrop-filter:blur(14px)}), so dropping the #xBuy declarations alone would bring the 14 px blur back.
// Check: the cascade over every stylesheet rule that matches <div id="xBuy" class="x-fr"> open (.on) as a child of body
// (!important, specificity, source order) computes backdrop-filter and -webkit-backdrop-filter to none (red before:
// blur(3px)), and the look is otherwise kept: the 88 % dark panel rgba(12,25,28,.88) still wins the background.
//   node work/test_buy_menu_no_backdrop.cjs
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const tag=(html.match(/<div id="xBuy"[^>]*>/)||[''])[0];assert.ok(tag,'#xBuy element');
const cls=new Set(((tag.match(/class="([^"]*)"/)||['',''])[1]).split(/\s+/).filter(Boolean).concat('on')); // open menu
const css=[...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map(m=>m[1]).join('\n').replace(/\/\*[\s\S]*?\*\//g,'');
const ANC=new Set(['html','body',':root']);
function compound(c){const t=c.match(/#[\w-]+|\.[\w-]+|::?[\w-]+(\([^)]*\))?|\[[^\]]*\]|^\*|^[a-z][\w-]*/gi)||[];return t;}
function spec(parts){let a=0,b=0,c=0;for(const p of parts)for(const t of compound(p)){if(t[0]==='#')a++;else if(t[0]==='.'||t[0]==='['||(t[0]===':'&&t[1]!==':'))b++;else if(t!=='*')c++;}return a*1e4+b*100+c;}
function matches(sel){const parts=sel.trim().split(/\s*[>+~]\s*|\s+/).filter(Boolean);if(!parts.length)return false;
 const subj=compound(parts[parts.length-1]);if(!subj.length)return false;let hasSelf=false;
 for(const t of subj){if(t==='#xBuy'){hasSelf=true;continue;}if(t[0]==='#')return false;if(t[0]==='.'){if(!cls.has(t.slice(1)))return false;hasSelf=true;continue;}if(t==='div'||t==='*')continue;return false;} // pseudo / attr: not the plain open menu
 if(!hasSelf)return false;
 for(const p of parts.slice(0,-1)){const ts=compound(p);if(!ts.length||!ts.every(t=>ANC.has(t)))return false;}
 return true;}
const decl={};let order=0;
for(const m of css.matchAll(/([^{}@;]+)\{([^{}]*)\}/g)){const sels=m[1].split(',');for(const s of sels){if(!matches(s))continue;const sp=spec(s.trim().split(/\s*[>+~]\s*|\s+/).filter(Boolean));
 for(const d of m[2].split(';')){const i=d.indexOf(':');if(i<0)continue;const k=d.slice(0,i).trim().toLowerCase();let v=d.slice(i+1).trim();const imp=/!important$/.test(v);v=v.replace(/\s*!important$/,'');
  const w=[imp?1:0,sp,order++];(decl[k]=decl[k]||[]).push({w,v,sel:s.trim()});}}}
const win=k=>{const L=decl[k]||[];L.sort((x,y)=>x.w[0]-y.w[0]||x.w[1]-y.w[1]||x.w[2]-y.w[2]);return L.length?L[L.length-1]:null;};
const bf=win('backdrop-filter'),wbf=win('-webkit-backdrop-filter'),bg=win('background');
console.log('backdrop-filter',bf&&bf.v,'('+(bf&&bf.sel)+') | -webkit-',wbf&&wbf.v,'| background',bg&&bg.v);
assert.ok(!bf||bf.v==='none','#xBuy computes backdrop-filter '+(bf&&bf.v)+' from "'+(bf&&bf.sel)+'" (must be none: the blur is redone over the live world every frame)');
assert.ok(!wbf||wbf.v==='none','#xBuy computes -webkit-backdrop-filter '+(wbf&&wbf.v)+' from "'+(wbf&&wbf.sel)+'"');
assert.equal(bg&&bg.v,'rgba(12,25,28,.88)','the 88 % dark panel is kept');
for(const L of Object.values({a:decl['backdrop-filter']||[],b:decl['-webkit-backdrop-filter']||[]}))for(const d of L)if(/^#xBuy$|#xBuy$/.test(d.sel))assert.equal(d.v,'none','no #xBuy rule sets a blur ('+d.sel+': '+d.v+')');
console.log('test_buy_menu_no_backdrop: OK');
