// 640x360 landscape: the combat report (hit feedback, .x-cbt, CSS injected by xCrUi) sat over the centred death card
// (.x-kb short-screen rule: bottom 60px, translateX(-50%)), browser-found after the hark-hitfx merge. On short landscape
// screens the report is bottom-right (clear of the kill feed at the top) and, while it shows (body.x-cbt-on), the death
// card centres in the space left of it. Checks the rules and the resulting boxes at 640x360 and 844x390.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert');
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const m=html.match(/st\.textContent='(\.x-cbt\{[^']*)'/);assert(m,'combat report CSS not found');const css=m[1];
const short=css.match(/@media \(max-height:560px\) and \(orientation:landscape\)\{([\s\S]*)\}$/);assert(short,'short landscape combat report rule missing');
const rule=(src,sel)=>{const r=new RegExp('(?:^|\\})'+sel.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'\\{([^}]*)\\}');const x=src.match(r);return x&&x[1];};
const decl=(body,prop)=>{const x=body&&body.match(new RegExp('(?:^|;)'+prop+':([^;]+)'));return x&&x[1].trim();};
const cbt=rule(short[1],'.x-cbt'),card=rule(short[1],'body.x-cbt-on .x-kb.on');assert(cbt&&card,'rules missing');
assert.equal(decl(cbt,'top'),'auto');assert.equal(decl(cbt,'bottom'),'60px');
const W=parseFloat(decl(cbt,'width')),Rt=parseFloat(decl(cbt,'right'));
// the base short death card rule this has to beat
const kbm=html.match(/@media \(max-height:560px\)\{\s*\.x-kb\{left:50%;bottom:60px;transform:translateX\(-50%\);width:auto;max-width:min\(92vw,380px\)/);assert(kbm,'short .x-kb rule changed; re-check this layout');
for(const [vw,vh] of [[640,360],[844,390]]){
 const calc=e=>Function('vw','return '+e.replace(/calc\(|\)$/g,'').replace(/100vw/g,'vw').replace(/(\d+)px/g,'$1'))(vw);
 const left=calc(decl(card,'left')),maxw=Math.min(calc(decl(card,'max-width')),380);
 const cardR=left+maxw/2,repL=vw-Rt-W;assert(cardR<=repL,`${vw}x${vh}: death card right edge ${cardR} overlaps report left ${repL}`);
 assert(left-maxw/2>=0,`${vw}x${vh}: death card off the left edge`);
 const maxH=vh-parseFloat(decl(cbt,'max-height').replace(/calc\(100vh - |px\)/g,''));assert(vh-60-maxH>=66+48,`${vw}x${vh}: report top ${vh-60-maxH} reaches the kill feed`);
}
// the body class follows the report
const rt=fs.readFileSync(path.join(__dirname,'hit_feedback_runtime.js'),'utf8');
assert(/C\.el\.classList\.toggle\('on',shown>0&&xKL\.on\);document\.body\.classList\.toggle\('x-cbt-on',shown>0&&xKL\.on\)/.test(rt),'x-cbt-on not toggled with the report');
assert(/classList\.remove\('on'\);document\.body\.classList\.remove\('x-cbt-on'\)/.test(rt),'x-cbt-on not cleared on reset');
// Deathmatch: the FFA leaderboard (.x-dmlb, short screens bottom 100px right 16px) sat under the bottom-right report at 640x360
// (browser-found, hitfx pass 2). While the report shows on a short landscape screen the leaderboard hides; it returns on respawn.
assert.equal(decl(rule(short[1],'body.x-cbt-on .x-dmlb'),'visibility'),'hidden','DM leaderboard not hidden under the combat report');
assert(/@media \(max-height:480px\)\{\.x-dmlb\{top:auto;bottom:100px;width:150px/.test(html),'short .x-dmlb rule changed; re-check this layout');
console.log('combat report layout ok (DM leaderboard hidden under it): bottom-right report and shifted death card do not overlap at 640x360 / 844x390');
