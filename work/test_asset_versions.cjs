// Asset versions (work/asset_version_runtime.js, perf lane B): permanent caching without ever serving a stale file.
//  1. index.html's VSV table = the git blob hash (10 hex) of every tracked file under models/ audio/ vendor/ (+ lobby-bg.png,
//     favicon.ico), so a changed file always gets a new ?v= (CI also checks index.html is the regen output).
//  2. static <script src> / url() of those files carry their ?v=.
//  3. vsAssetUrl: same-origin listed files get ?v=, everything else (CDN, data:, unknown files, HTML, already versioned) is untouched.
//  4. vercel.json: immutable only for ?v= requests under the asset roots; HTML revalidates.
//  5. worker: /worlds/ answers ?v= immutable, meta.json without; build-world writes the content hashes into meta.json.
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict'),{execFileSync}=require('child_process');
const root=path.join(__dirname,'..'),html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const a=html.indexOf('<script>// ---- ASSET VERSIONS ----'),b=html.indexOf('</script>',a);assert.ok(a>0&&b>a,'asset version script inlined');
const src=html.slice(a+'<script>'.length,b);
assert.ok(a<html.indexOf('<script src='),'asset versions run before the first external script');
const ls=execFileSync('git',['-C',root,'ls-files','-s','-z','--','models','audio','vendor','lobby-bg.png','favicon.ico']).toString('utf8').split('\0').filter(Boolean);
const want={};for(const e of ls){const [m,f]=e.split('\t');want[f]=m.split(' ')[1].slice(0,10);}
const ctx={location:{origin:'https://valorstrike.vercel.app',href:'https://valorstrike.vercel.app/'},document:{baseURI:'https://valorstrike.vercel.app/'},URL,window:{}};ctx.window=ctx;vm.createContext(ctx);vm.runInContext(src,ctx);
const V=ctx.VSV;const flat={};(function walk(d,p){for(const k in d){if(typeof d[k]==='string')flat[p+k]=d[k];else walk(d[k],p+k+'/');}})(V,'');
assert.equal(Object.keys(flat).length,Object.keys(want).length,'VSV lists every tracked asset');
let bad=0;for(const f in want)if(flat[f]!==want[f])bad++;assert.equal(bad,0,'VSV hashes = git blob hashes (index.html is stale: run python3 work/install_valorant.py)');
for(const m of html.matchAll(/<script src="((?:models|vendor|audio)\/[^"?]+)(\?v=([0-9a-f]+))?"/g))assert.equal(m[3],want[m[1]],'static tag '+m[1]+' versioned');
assert.ok(html.includes('url(lobby-bg.png?v='+want['lobby-bg.png']+')'),'lobby background versioned');
const U=ctx.window.vsAssetUrl,f0='models/valorant/maps/ascent/scene.gltf';assert.ok(want[f0]);
assert.equal(U(f0),f0+'?v='+want[f0]);
assert.equal(U('https://valorstrike.vercel.app/'+f0),'https://valorstrike.vercel.app/'+f0+'?v='+want[f0]);
assert.equal(U(f0+'?x=1#h'),f0+'?x=1&v='+want[f0]+'#h');
assert.equal(U(f0+'?v=abc'),f0+'?v=abc','already versioned');
for(const u of ['index.html','/','https://unpkg.com/three@0.149.0/build/three.min.js','data:image/png;base64,AA','blob:https://valorstrike.vercel.app/x','models/nope.glb','https://other.example/'+f0])assert.equal(U(u),u,'untouched '+u);
const vc=JSON.parse(fs.readFileSync(path.join(root,'vercel.json'),'utf8')),H=vc.headers||[];
const imm=H.filter(h=>h.headers.some(x=>x.key==='Cache-Control'&&/immutable/.test(x.value)));
assert.ok(imm.length>=1&&imm.every(h=>(h.has||[]).some(c=>c.type==='query'&&c.key==='v')),'immutable only with ?v=');
assert.ok(imm.every(h=>!new RegExp('^'+h.source.replace(/\(\.\*\)/g,'.*')+'$').test('/')&&!/index/.test(h.source)),'HTML never immutable');
assert.ok(H.some(h=>h.source==='/'&&h.headers.some(x=>x.key==='Cache-Control'&&/must-revalidate/.test(x.value))),'HTML revalidates');
const wk=fs.readFileSync(path.join(root,'server/src/worker.js'),'utf8');assert.ok(/worlds\/[\s\S]{0,600}immutable/.test(wk),'worker: /worlds/?v= immutable');
assert.ok(/files\[/.test(fs.readFileSync(path.join(root,'server/build-world.cjs'),'utf8')),'build-world writes content hashes into meta.json');
console.log('Asset versions: '+Object.keys(flat).length+' files versioned by content, static tags + lobby background carry ?v=, vsAssetUrl leaves CDN / HTML / unknown untouched, vercel immutable only for ?v=, worker worlds ?v= immutable');
