// Small-prop draw distance (LOW / MEDIUM) and the map triangle / draw-call budget per frame.
// Browser finding (hk_out diag_perf1, LOW 1280x720, Ascent attacker spawn): 3.62 M triangles / 504 draw calls, of which
// the native map was 3.31 M / 429 (agents 0.27 M / 29, TP guns 26 k / 32, first-person 22 k / 5, no shadow pass on LOW).
// Most map materials are one mesh holding every copy of a prop across the whole map, so frustum culling keeps them.
// server/tools/map-detail.mjs lists each material's SMALL props (detail.json, welded components: half-diagonal < 0.4 m,
// or < 1 m with no collision of its own); on LOW / MEDIUM the runtime moves them into their own groups, cut into
// <= NM_SMALL.piece triangle pieces, drawn only within NM_SMALL[quality] m. HIGH is not split at all.
// Checks:
//  A. runtime on a synthetic scene (three.js, the runtime's own functions): LOW split keeps every triangle exactly once,
//     small pieces flagged and <= the piece size, materials shared; HIGH output = the output with no table; nmCull hides
//     small pieces beyond the LOW distance and shows near ones, shows all on HIGH (quality change re-tests at once);
//     a table that does not match a mesh (triangle count) leaves it alone.
//  B. shipped tables: every map has detail.json matching scene.gltf (triangle count per material after the z-fight
//     drops, runs sorted / in range); loader fetches it next to scene.gltf (runtime and generated page).
//  C. BUDGET, offline frame model (server/tools/map-perf.mjs views: 48 seeded playable points x 8 headings, 103 deg
//     horizontal FOV, three's sphere-frustum test; the runtime's own nmChunkPlan): per map, LOW and MEDIUM average and
//     worst-view map triangles under the budget table below, LOW worst-view draw calls under the budget, and the LOW /
//     HIGH reduction at least the floor. HIGH = the plan with no table (unchanged rendering).
//  MAPS=ascent,... limits part C (default all six).
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'..'),src=fs.readFileSync(path.join(__dirname,'native_maps_runtime.js'),'utf8'),html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const THREE=require(require.resolve('three',{paths:[path.join(root,'server')]}));
const pick=n=>{const i=src.indexOf('function '+n+'(');assert(i>=0,n+' missing');return src.slice(i,src.indexOf('\n',i));};
const block=n=>{let i=src.indexOf('function '+n+'(');let j=src.indexOf('\nfunction ',i+1);return src.slice(i,j);};
const NM_SMALL=eval('('+src.match(/var NM_SMALL=(\{[^}]*\})/)[1]+')'),NM_OPT=eval('('+src.match(/var NM_OPT=(\{[^}]*\})/)[1]+')');
let GQ='low';const nmQuality=()=>GQ;
const NM_STRIP=eval('('+src.match(/var NM_STRIP=(\{[^}]*\})/)[1]+')');
const api=new Function('THREE','NM_OPT','NM_SMALL','nmQuality','NM_STRIP',['nmDetailDistance','nmChunkPlan','nmSpanOver','nmMatKey','nmCull','nmSphere','nmCentroids','nmGather','nmOffset','nmCopy3','nmCopy2','nmCopyN','nmSmallDist','nmDetailSplit','nmStripChunk','nmRunRange','nmRunReset'].map(pick).join('\n')+'\n'+block('nmOptimizeScene')+'\n'+block('nmStrips')+'\n'+block('nmStripBuild')+'\nreturn {nmChunkPlan,nmOptimizeScene,nmCull,nmSmallDist,nmDetailSplit,nmDetailDistance};');
const MAPS=['ascent','bind','haven','split','lotus','breeze'];
// ---- A. synthetic scene
{const PIECE=250,A=api(THREE,{ratio:2,minPiece:2000,smallPiece:PIECE},Object.assign({},NM_SMALL,{min:0}),nmQuality,NM_STRIP);/* min 0: the synthetic groups are small *//* small pieces of 250 so a 200 m synthetic scene has far and near ones (the runtime default is NM_SMALL.piece) */let seed=11;const R=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
 const mk=(name,n,spread)=>{const P=[],N=[],U=[],I=[];for(let t=0;t<n;t++){const cx=(R()-.5)*spread,cz=(R()-.5)*spread,b=P.length/3;for(let k=0;k<3;k++){P.push(cx+R()*.3,R()*2,cz+R()*.3);N.push(0,1,0);U.push(R(),R());}I.push(b,b+1,b+2);}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(P,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(N,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(U,2));g.setIndex(I);
  const m=new THREE.MeshLambertMaterial({name,side:THREE.DoubleSide,color:{Barrel_MI:0x884422,Wall_MI:0xcccccc,Lamp_MI:0xffee88}[name]});const o=new THREE.Mesh(g,m);o.name=name;return o;};
 const tri=(g,t)=>{const p=g.attributes.position.array,I=g.index.array,v=[];for(let k=0;k<3;k++){const a=I[t*3+k]*3;v.push(p[a].toFixed(4)+','+p[a+1].toFixed(4)+','+p[a+2].toFixed(4));}return v.join('|');};
 const scene=()=>{seed=11;const s=new THREE.Scene();s.add(mk('Barrel_MI',9000,200),mk('Wall_MI',6000,200),mk('Lamp_MI',1200,200));return s;};
 const table={v:1,m:{Barrel_MI:{n:9000,s:[0,3000,4000,2500]},Lamp_MI:{n:1200,s:[0,1200]},Wall_MI:{n:5999,s:[0,10]}}};
 const before=new Map();{const s=scene();s.traverse(o=>{if(o.isMesh)for(let t=0;t<o.geometry.index.count/3;t++){const k=tri(o.geometry,t);before.set(k,(before.get(k)||0)+1);}});}
 const run=q=>{GQ=q;const s=scene();s.userData.nmDetail=table;const r=A.nmOptimizeScene(s);return {s,r,L:s.userData.nmChunks};};
 const low=run('low');const seen=new Map();let smallTris=0;for(const o of low.L){for(let t=0;t<o.geometry.index.count/3;t++){const k=tri(o.geometry,t);seen.set(k,(seen.get(k)||0)+1);}if(o.userData.nmChunk.small){smallTris+=o.geometry.index.count/3;assert(o.geometry.index.count/3<=PIECE*1.15,'small piece over '+PIECE+' (+ the median split tolerance)');}}
 assert.equal(seen.size,before.size,'LOW split lost / added triangles');for(const [k,n] of before)assert.equal(seen.get(k),n,'triangle count changed');
 assert.equal(smallTris,5500+1200,'small triangles = the table (Wall_MI table count 5999 != 6000: left alone)');assert.equal(low.r.small,6700);
 assert(low.L.filter(o=>o.userData.nmChunk.small).length>=Math.ceil(5500/PIECE)+Math.ceil(1200/PIECE),'small groups cut into pieces');
 const mats=new Set(low.L.map(o=>o.material));assert.equal(mats.size,3,'one shared material per source material (small pieces share it)');
 // nmCull: LOW hides small pieces whose sphere is beyond NM_SMALL.low, HIGH shows them, at once on a quality change
 const C={scene:low.s,cullAt:null},cam={position:new THREE.Vector3(0,1.6,0)};A.nmCull(C,cam);
 for(const o of low.L){const u=o.userData.nmChunk,d=Math.hypot(u.c.x,u.c.y-1.6,u.c.z)-u.r;if(u.small)assert.equal(o.visible,d<=NM_SMALL.low,'LOW small piece at '+d.toFixed(1)+' m');else if(!u.maxDist)assert(o.visible);}
 assert(low.L.some(o=>o.userData.nmChunk.small&&!o.visible),'some small piece is beyond the LOW distance');assert(low.L.some(o=>o.userData.nmChunk.small&&o.visible),'some small piece is near');
 GQ='high';A.nmCull(C,cam);assert(low.L.every(o=>o.visible||o.userData.nmChunk.maxDist),'HIGH shows every small piece without a 2 m move');
 GQ='medium';A.nmCull(C,cam);for(const o of low.L){const u=o.userData.nmChunk,d=Math.hypot(u.c.x,u.c.y-1.6,u.c.z)-u.r;if(u.small)assert.equal(o.visible,d<=NM_SMALL.medium);}
 // HIGH: no split = exactly the plan without a table
 const hi=run('high');GQ='high';const s2=scene();const r2=A.nmOptimizeScene(s2);const sig=L=>L.map(o=>o.name+':'+o.geometry.index.count).sort().join();
 assert.equal(sig(hi.L),sig(s2.userData.nmChunks),'HIGH ignores the table');assert.equal(hi.r.small,0);assert(!hi.L.some(o=>o.userData.nmChunk.small));
 assert.equal(A.nmSmallDist('low'),NM_SMALL.low);assert.equal(A.nmSmallDist('medium'),NM_SMALL.medium);assert.equal(A.nmSmallDist('high'),0);assert.equal(A.nmSmallDist('custom'),0);
 assert(NM_SMALL.low>0&&NM_SMALL.medium>NM_SMALL.low,'LOW draws small props nearer than MEDIUM');
 console.log('A. synthetic: LOW split exact ('+low.L.length+' chunks, '+smallTris+' small tris), cull LOW/MEDIUM/HIGH, HIGH unchanged');}
// ---- B. shipped tables + loader wiring
const ZL=src.split('\n').find(l=>l.startsWith('var NM_ZFIX=')),NM_ZFIX=JSON.parse(ZL.slice(12,ZL.lastIndexOf(';')));
const gltfTris=key=>{const g=JSON.parse(fs.readFileSync(path.join(root,'models/valorant/maps',key,'scene.gltf'),'utf8')),out={};for(const node of g.nodes){if(node.mesh==null)continue;for(const pr of g.meshes[node.mesh].primitives){const name=(g.materials[pr.material]||{}).name||'',n=pr.indices!=null?g.accessors[pr.indices].count/3:g.accessors[pr.attributes.POSITION].count/3;out[name]=(out[name]||0)+n;}}return out;};
for(const key of MAPS){const f=path.join(root,'models/valorant/maps',key,'detail.json');assert(fs.existsSync(f),key+' detail.json missing');const d=JSON.parse(fs.readFileSync(f,'utf8')),T=gltfTris(key),drop=(NM_ZFIX[key]||{}).d||{};assert.equal(d.v,1);
 let small=0;for(const [name,e] of Object.entries(d.m)){assert(T[name]!=null,key+' '+name+' not in scene.gltf');assert.equal(e.n,T[name]-(drop[name]||[]).length,key+' '+name+' triangle count');let last=-1;for(let k=0;k<e.s.length;k+=2){assert(e.s[k]>last&&e.s[k+1]>0&&e.s[k]+e.s[k+1]<=e.n,key+' '+name+' run');last=e.s[k]+e.s[k+1];small+=e.s[k+1];}}
 assert.equal(small,d.small,key+' small count');assert(d.small<d.total*.4,key+': small props are a minority');}
for(const s of [src,html]){assert(/\.loadAsync\(base\+'scene\.gltf'\)\.then\(gl=>\{nmTexMissingMark\(gl\);(?:nmTexUriMark\(gl\);)?(?:nmParserRelease\(gl\);)?(?:\/\*[^*]*\*\/)+return (?:nmDetailFetch\(base\)\.then\(d=>\{|Promise\.all\(\[nmDetailFetch\(base\),ts\]\)\.then\(\(\[d,t\]\)=>\{)gl\.scene\.userData\.nmDetail=d;(?:if\(t\)gl\.scene\.userData\.nmTexTable=t;)?return gl;\}\);\}\);/.test(s),'loader does not attach detail.json');
 assert(/function nmDetailFetch\(base\)\{if\(typeof fetch!=='function'\|\|!nmSmallDist\(\)\)return Promise\.resolve\(null\);return fetch\(base\+'detail\.json'\)/.test(s),'detail.json fetch (skipped on HIGH)');}
console.log('B. detail.json for '+MAPS.length+' maps matches scene.gltf; loader wired');
// ---- C. budget (offline frame model)
// Budget table (map triangles / draw calls per frame, 48 x 8 views). HIGH = unchanged rendering (no split), measured
// 26 Oct 2026 for reference; LOW / MEDIUM ceilings sit ~2% above the measured values.
const BUDGET={
 ascent:{low:{avg:2251000,worst:2908000,calls:453},medium:{avg:2293000,worst:2969000}},// HIGH avg 2512892 worst 3289559 / 409 calls
 bind:{low:{avg:1749000,worst:2367000,calls:347},medium:{avg:1769000,worst:2413000}},// HIGH avg 1834193 worst 2518607 / 323 calls
 haven:{low:{avg:2588000,worst:3686000,calls:331},medium:{avg:2645000,worst:3811000}},// HIGH avg 2894787 worst 4070706 / 279 calls
 split:{low:{avg:1973000,worst:2749000,calls:466},medium:{avg:2017000,worst:2843000}},// HIGH avg 2119713 worst 3145660 / 432 calls
 lotus:{low:{avg:1622000,worst:2218000,calls:241},medium:{avg:1659000,worst:2277000}},// HIGH avg 1787676 worst 2424668 / 210 calls
 breeze:{low:{avg:1602000,worst:2261000,calls:416},medium:{avg:1633000,worst:2307000}},// HIGH avg 1748922 worst 2466121 / 392 calls
};
const FLOOR={avg:.95,worst:.95,calls:1.2};// LOW triangles (average and worst view) <= 95% of HIGH; LOW worst-view draw calls <= 120% of HIGH (the near small-prop pieces are extra draws: Haven 324 vs 279)
(async()=>{const {loadRender}=await import(path.join(root,'server/tools/map-render.mjs')),{views,count}=await import(path.join(root,'server/tools/map-perf.mjs'));
 const want=(process.env.MAPS||MAPS.join(',')).split(','),report={};
 for(const key of want){const t0=Date.now(),R=loadRender(key,{bvh:false}),V=views(key),D=JSON.parse(fs.readFileSync(path.join(root,'models/valorant/maps',key,'detail.json'),'utf8')),drop=(NM_ZFIX[key]||{}).d||{};
  // per-primitive index after the z-fight drops (the runtime's order), split by the table on LOW / MEDIUM
  const prim=R.prims.map(p=>{const cut=new Set(drop[p.name]||[]),I=new Uint32Array((p.tris-[...cut].filter(t=>t<p.tris).length)*3);let k=0;for(let t=0;t<p.tris;t++){if(cut.has(t))continue;const o=(p.tri0+t)*3;I[k++]=R.index[o];I[k++]=R.index[o+1];I[k++]=R.index[o+2];}return I;});
  const nmDD=new Function(pick('nmDetailDistance')+';return nmDetailDistance;')(),keyOf=p=>{const dd=nmDD(p.name);return [p.tex,p.alpha,dd||0,/Floor|Ground/i.test(p.name)?1:0].join('|');};// map-perf's offline material identity (same texture + alpha mode + the runtime's name classes)
  const plan=(split,piece,minS,ratio)=>{const OPT=Object.assign({},NM_OPT,piece?{smallPiece:piece}:{},ratio?{ratio}:{}),A=api(THREE,OPT,NM_SMALL,nmQuality,NM_STRIP),items=[];R.prims.forEach((p,i)=>{const I=prim[i],n=I.length/3,base={key:keyOf(p),name:p.name,pos:R.pos,index:I,tri0:0,tris:n};const e=split&&D.m[p.name];
    if(e){const g={index:{array:I.slice(),needsUpdate:false}},ns=A.nmDetailSplit(g,e,minS);if(ns){const J=g.index.array;if(n-ns)items.push(Object.assign({},base,{index:J.subarray(0,(n-ns)*3),tris:n-ns}));items.push(Object.assign({},base,{key:base.key+'|small',index:J.subarray((n-ns)*3),tris:ns,small:true}));return;}}items.push(base);});
   return A.nmChunkPlan(items,OPT).map(c=>{let x0=Infinity,y0=Infinity,z0=Infinity,x1=-Infinity,y1=-Infinity,z1=-Infinity,n=0;const P=R.pos;const each=f=>{for(const q of c.parts){const I=items[q.item].index;if(q.tris)for(const t of q.tris)f(I,t);else for(let t=0;t<I.length/3;t++)f(I,t);}};
    each((I,t)=>{n++;for(let j=0;j<3;j++){const v=I[t*3+j]*3;if(P[v]<x0)x0=P[v];if(P[v]>x1)x1=P[v];if(P[v+1]<y0)y0=P[v+1];if(P[v+1]>y1)y1=P[v+1];if(P[v+2]<z0)z0=P[v+2];if(P[v+2]>z1)z1=P[v+2];}});
    const cc=[(x0+x1)/2,(y0+y1)/2,(z0+z1)/2];let r2=0;each((I,t)=>{for(let j=0;j<3;j++){const v=I[t*3+j]*3,d=(P[v]-cc[0])**2+(P[v+1]-cc[1])**2+(P[v+2]-cc[2])**2;if(d>r2)r2=d;}});return {c:cc,r:Math.sqrt(r2),tris:n,maxDist:c.maxDist||0,small:!!c.small};});};
  const hiObjs=plan(false),loObjs=plan(true),at=d=>loObjs.map(o=>o.small?Object.assign({},o,{maxDist:o.maxDist?Math.min(o.maxDist,d):d}):o);
  const total=o=>o.reduce((a,x)=>a+x.tris,0);assert.equal(total(loObjs),total(hiObjs),key+': LOW plan keeps every triangle');
  if(process.env.PIECES)for(const pv of process.env.PIECES.split(',')){const [pc,mn,ra]=pv.split(':').map(Number),o=plan(true,pc,mn,ra),a=d=>o.map(x=>x.small?Object.assign({},x,{maxDist:x.maxDist?Math.min(x.maxDist,d):d}):x);console.log('piece',pc,'min',mn,'ratio',ra,'low',JSON.stringify(count(a(NM_SMALL.low),V)),'medium',JSON.stringify(count(a(NM_SMALL.medium),V)));}
  const high=count(hiObjs,V),low=count(at(NM_SMALL.low),V),medium=count(at(NM_SMALL.medium),V);report[key]={high,low,medium,s:((Date.now()-t0)/1000).toFixed(0)};console.log('C.',key,JSON.stringify(report[key]));
  assert(low.tris<=high.tris*FLOOR.avg,key+': LOW average triangles '+low.tris+' > '+FLOOR.avg+' x HIGH '+high.tris);assert(low.worstTris<=high.worstTris*FLOOR.worst,key+': LOW worst view '+low.worstTris+' > '+FLOOR.worst+' x HIGH '+high.worstTris);
  assert(low.worstCalls<=high.worstCalls*FLOOR.calls,key+': LOW worst-view draw calls '+low.worstCalls+' vs HIGH '+high.worstCalls);
  const B=BUDGET[key];if(B&&B.low.avg){assert(low.tris<=B.low.avg,key+' LOW avg tris '+low.tris+' > budget '+B.low.avg);assert(low.worstTris<=B.low.worst,key+' LOW worst tris '+low.worstTris+' > budget '+B.low.worst);assert(low.worstCalls<=B.low.calls,key+' LOW worst calls '+low.worstCalls+' > budget '+B.low.calls);
   assert(medium.tris<=B.medium.avg,key+' MEDIUM avg tris > budget');assert(medium.worstTris<=B.medium.worst,key+' MEDIUM worst tris > budget');}}
 if(process.env.REPORT)fs.writeFileSync(process.env.REPORT,JSON.stringify(report,null,1));
 console.log('map detail / budget: OK');})().catch(e=>{console.error(e);process.exit(1);});
