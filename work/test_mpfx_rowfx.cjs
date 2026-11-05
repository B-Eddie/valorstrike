// Relayed generic copy of a cast is skipped for abilities whose module look is a server row (non-auth remote); others still run the legacy path.
const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const html=fs.readFileSync(require('path').join(__dirname,'..','index.html'),'utf8');
const i=html.indexOf('const MP_ROWFX = '),j=html.indexOf('\n',i),a=html.indexOf('function mpFx(u, ag'),b=html.indexOf('  const ty = ABI_M[ag][i]',a);assert(i>0&&a>0&&b>a);
const body=html.slice(a,b)+'  LEGACY=true;\n}';
const fed=[];const ctx=vm.createContext({LEGACY:false,KITS:{Skye:{n:['Regrowth','Trailblazer','Guiding Light','Seekers']},Jett:{n:['a','b','c','d']},Fade:{n:['Seize','Prowler','Haunt','Nightfall']},Miks:{n:['M','H','W','B']}},feed:s=>fed.push(s)});
vm.runInContext(html.slice(i,j)+'\n'+body+';this.fx=mpFx;',ctx);
const u={g:{}};const run=(ag,k,auth)=>{ctx.LEGACY=false;ctx.fx(u,ag,k,null,null,auth,null,false);return ctx.LEGACY;};
assert.equal(run('Skye','e',false),false,'Skye hawk: relayed flash orb skipped (row draws the hawk)');assert.equal(run('Skye','q',false),false);assert.equal(run('Skye','c',false),true,'Skye heal not covered');
assert.equal(run('Fade','e',false),false);assert.equal(run('Miks','e',false),true,'Waveform keeps generic occluder smoke');assert.equal(run('Miks','c',false),false);assert.equal(run('Jett','e',false),true,'untouched agents still legacy');
assert.equal(run('Skye','e',true),true,'authoritative host path unchanged');
assert.ok(fed.length===4,'kill feed line still shown');
console.log('mpFx row-covered casts skip the relayed generic copy (real source prelude, stubbed world)');
