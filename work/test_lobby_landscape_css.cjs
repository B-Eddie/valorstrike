// Mobile landscape lobby (bug lane 2026-11-03: Firefox on a phone held sideways, 844x390): the nav labels ran together and
// the content sat under the header, because the small-screen lobby rules only matched max-width 820 px. They now also
// match max-height 500 px. This test evaluates index.html's @media rules (max/min width / height, orientation, pointer,
// hover) for a viewport and checks which lobby rules are live:
//  - 844x390 / 932x430 / 740x360 coarse (phones in landscape): the nav labels hidden (icon nav), the lobby stacked in one
//    column (nav, stage, news, missions, footer) with the scrollable lobby, the sticky bar, the queue panel under the bar;
//  - 375x812 portrait: unchanged (already the small-screen lobby);
//  - 1366x768 / 1280x720 / 1920x1080 / 1024x600-wide desktop (fine pointer): none of it (labels shown, three columns).
//   node work/test_lobby_landscape_css.cjs
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
// all <style> text, then the @media blocks (balanced braces) with their condition
const css=[...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map(m=>m[1]).join('\n');
function blocks(s){const out=[];let i=0;for(;;){const k=s.indexOf('@media',i);if(k<0)break;const o=s.indexOf('{',k);if(o<0)break;let d=1,j=o+1;for(;j<s.length&&d;j++){if(s[j]==='{')d++;else if(s[j]==='}')d--;}out.push({q:s.slice(k+6,o).trim(),body:s.slice(o+1,j-1)});i=j;}return out;}
function feature(f,V){const m=/^\(?\s*([a-z-]+)\s*:\s*([^)]+?)\s*\)?$/.exec(f.trim());if(!m)return null;const [,k,v]=m,px=parseFloat(v);
 switch(k){case 'max-width':return V.w<=px;case 'min-width':return V.w>=px;case 'max-height':return V.h<=px;case 'min-height':return V.h>=px;
  case 'orientation':return v==='portrait'?V.h>=V.w:V.w>V.h;case 'pointer':return v===V.pointer;case 'hover':return v===(V.pointer==='fine'?'hover':'none');case 'any-pointer':return v===V.pointer;default:return null;}}
function matches(q,V){return q.split(',').some(part=>{part=part.trim().replace(/^only\s+screen\s+and\s+|^screen\s+and\s+/,'');if(part==='screen'||part==='all')return true;
  const fs=part.match(/\([^)]*\)/g)||[];if(!fs.length)return false;let not=/^not\s/.test(part);const r=fs.every(f=>{const x=feature(f,V);return x===null?false:x;});return not?!r:r;});}
const B=blocks(css);
const live=(V,re)=>B.some(b=>matches(b.q,V)&&re.test(b.body));
const NL=/#lobby \.x-lnav button:not\(\.x-np\) \.x-nl\{display:none\}/,STACK=/#lobby \.x-lb\{grid-template-columns:minmax\(0,1fr\);[^}]*grid-template-areas:"nav" "stage"/,BAR=/#lobby \.x-bar\{position:sticky;top:0/,SCROLL=/#lobby\{overflow:auto\}/,Q=/#lobby \.x-q:not\(\[hidden\]\)\{top:64px/;
const phones=[{w:844,h:390,pointer:'coarse',n:'844x390 Firefox landscape'},{w:932,h:430,pointer:'coarse',n:'932x430 landscape'},{w:740,h:360,pointer:'coarse',n:'740x360 landscape'},{w:375,h:812,pointer:'coarse',n:'375x812 portrait'}];
const desk=[{w:1366,h:768,pointer:'fine'},{w:1280,h:720,pointer:'fine'},{w:1920,h:1080,pointer:'fine'},{w:1024,h:600,pointer:'fine'}];
const fails=[];
for(const V of phones)for(const [re,what] of [[NL,'nav labels hidden'],[STACK,'one-column lobby'],[BAR,'sticky bar'],[SCROLL,'scrollable lobby'],[Q,'queue panel under the bar']])if(!live(V,re))fails.push(V.n+': '+what+' rule not live');
for(const V of desk)for(const [re,what] of [[NL,'nav labels hidden'],[STACK,'one-column lobby']])if(live(V,re))fails.push(`${V.w}x${V.h} desktop: ${what} rule live`);
assert(B.length>50,'parsed @media blocks ('+B.length+')');
if(fails.length){console.error('FAIL test_lobby_landscape_css\n - '+fails.join('\n - '));process.exit(1);}
console.log(`test_lobby_landscape_css ok: ${B.length} @media blocks; phones in landscape (844x390, 932x430, 740x360) and portrait get the small-screen lobby (icon nav, one column, sticky bar); desktops 1024-1920 wide do not`);
