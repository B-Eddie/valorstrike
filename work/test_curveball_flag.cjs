// Online Curveball direction: the server curves the flare right unless the cast carries l (devices.js), but the
// client never sent it, so every online Curveball went right. Valorant: FIRE curves left, ALT FIRE curves right.
// The cast now carries l:1 by default and l:0 while the right (alt-fire) mouse button is held; other casts carry no l.
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict');
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const a=html.indexOf('let mpAltHeld = false;'),b=html.indexOf('\n{ const k0 = jKey;',a);assert(a>0&&b>a,'mpCastSelf with the alt-fire tracker missing');
const L={},sent=[];const ctx=vm.createContext({RS:{}/* mpCastSelf hl: Skye Guiding Light hold (df60c6c) */,addEventListener:(t,f)=>{(L[t]=L[t]||[]).push(f);},MP:{role:'client',hc:{}},J:{pick:'Phoenix'},mpR3:v=>v,pEye:()=>[0,1.6,0],jAim:()=>[0,0,-1],performance:{now:()=>1},mpSend:(c,m)=>sent.push(m),mpCastOut(){},Math});
vm.runInContext(html.slice(a,b),ctx);
ctx.mpCastSelf('e');assert.equal(sent.pop().l,1,'plain cast curves left (FIRE)');
L.mousedown.forEach(f=>f({button:2}));ctx.mpCastSelf('e');assert.equal(sent.pop().l,0,'alt fire held: curves right');
L.mouseup.forEach(f=>f({button:2}));ctx.mpCastSelf('e');assert.equal(sent.pop().l,1,'released: left again');
L.mousedown.forEach(f=>f({button:2}));L.blur.forEach(f=>f());ctx.mpCastSelf('e');assert.equal(sent.pop().l,1,'focus loss clears a stuck alt button');
ctx.mpCastSelf('q');assert.equal('l' in sent.pop(),false,'only Curveball carries the flag');ctx.J.pick='Skye';ctx.mpCastSelf('e');assert.equal('l' in sent.pop(),false,'other agents carry no flag');
const dev=fs.readFileSync(path.join(__dirname,'..','server','src','devices.js'),'utf8');assert(/ty==='flash'\)\{const C=DEV\.curveball,side=m\.l\?-1:1/.test(dev),'server reads m.l for the curve side');
console.log('Online Curveball: sends l (FIRE left by default, ALT FIRE held right), server honours it');
