// "There is still some flickering on walls" (user, after 978f4e3): wall / floor pixels whose visible surface changes
// from frame to frame while the player stands or moves a tiny bit. Headless GPU depth model over the six original maps
// (render meshes, scene.gltf, three-mesh-bvh), no browser; the companion of work/test_map_vanish.cjs (which checks the
// ORDER of layers; this one checks that the order is STABLE).
//  - Material depth state as the runtime sets it: nmZFixApply z-fight levels (polygonOffset units -level x NM_ZBIAS),
//    nmDecalApply (decals: blended, no depth write, own offset); the native camera's near / far (NM_NEAR / 500).
//  - Seeded playable navigation nodes, eye 1.6 m, random yaw / pitch (-40..+12 deg), vertical fov 75, 1080 rows,
//    random pixels (those whose surface is < 20 m kept 1 in 4: flicker grows with distance, so the far bands get the
//    samples); every render surface on the sight ray up to RANGE (100 m; fog starts at 95 m).
//  - Each pixel is re-rendered J times with the eye moved < 1 mm and the sample moved inside the pixel (standing still
//    / sub-mm camera motion / bob). Per frame each surface's depth is written like the GPU does: 24-bit window depth
//    of the ray-plane distance + polygonOffset (factor x the triangle's own depth slope + units x 2^-24), rounded to
//    the depth grid with a per-triangle, per-frame phase in [0,1) step (the interpolation / rounding error of a
//    rasteriser: two surfaces less than ~1 step apart swap at random, >= 1 step apart never do). The pixel shows the
//    opaque surface with the smallest depth, plus each decal that passes LEQUAL against it.
//  - FLICKER: the shown material (or the set of decals on it) differs between the J frames. Reported by cause: the
//    two materials that swap, their gap (m) at the pixel, distance band, and whether they sit on the same z-fight
//    level. Shadow acne: native map meshes never receive shadows (asserted below on the runtime's own code), so the
//    only wall flicker source is depth.
// Seeded and deterministic. 14f53c6 (z-fight levels by graph colouring; decals fixed at level 2): 25 flickering pixels
// in 181,660 (12 between z-fight layers, 12 decals blinking on level >= 2 walls; Bind 0.023 %). With the levels
// ordered by geometry (server/tools/map-zorder.mjs) and decals above the top level: 11 (8 layers, 3 decals; Bind / Lotus
// 0.013 %; what is left is mostly terrain blend meshes and conflicting layer chains). Asserts (defaults, six
// maps): <= MAXTOTAL (15) flickering pixels in all, <= MAXDECAL (5) of them decals, no map above MAXRATE (0.02 %).
// Seams (two non-parallel surfaces meeting at a crease, swapping along a 1 px intersection line) are counted only.
// Usage: node work/test_map_flicker.cjs [maps...]  (env PER, VIEWS, PIX, J; NEAR / ZBIAS override the runtime for
// experiments; JSON=path writes the report; NOASSERT=1 to only measure)
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'..'),src=fs.readFileSync(process.env.RUNTIME||path.join(__dirname,'native_maps_runtime.js'),'utf8');
const THREE=require(require.resolve('three',{paths:[path.join(root,'server')]}));
const MAPS=process.argv.slice(2).length?process.argv.slice(2):['ascent','bind','haven','split','lotus','breeze'];
const line=re=>{const m=src.match(re);assert(m,'missing '+re);return m[0];};
const pick=n=>{const i=src.indexOf('\nfunction '+n+'(')+1;assert(i>0,n+' missing');let j=src.indexOf('\nfunction ',i+1),k=src.indexOf('\nasync function ',i+1);if(j<0)j=src.length;if(k>0&&k<j)j=k;return src.slice(i,j);};
const NM_NEAR=+(process.env.NEAR||line(/^var NM_NEAR=[^;]*;/m).match(/=([\d.]+)/)[1]);
const PER=+process.env.PER||150,VIEWS=+process.env.VIEWS||12,PIX=+process.env.PIX||60,J=+process.env.J||8,RANGE=100,FAR=500,FOV=75,H=1080,ASPECT=16/9,MAXRATE=+(process.env.MAXRATE||.0002),MAXTOTAL=+(process.env.MAXTOTAL||15),MAXDECAL=+(process.env.MAXDECAL||5),NEARKEEP=+(process.env.NEARKEEP||.25);
const NM_ZFIX=process.env.ZFIX?JSON.parse(fs.readFileSync(process.env.ZFIX,'utf8')):JSON.parse(line(/^var NM_ZFIX=(.*);$/m).slice('var NM_ZFIX='.length,-1));
const zb=(process.env.ZBIAS?'var NM_ZBIAS='+process.env.ZBIAS+';':(src.match(/^var NM_ZBIAS=.*;$/m)||[''])[0])+'\n'+(src.match(/^var NM_ZLEVELS=.*;$/m)||[''])[0];
const api=new Function('THREE','NM_ZFIX',zb+'\n'+['nmZFixApply','nmDecalApply'].map(pick).join('\n')+'\nreturn {nmZFixApply,nmDecalApply};')(THREE,NM_ZFIX);
const DECAL=/Decal|Floater/i,TERRAIN=/Floor|Ground|(?:Stone|Brick|Dirt|Gravel|Tile|Grass|Jam|Stairs).*Grass|Grass.*Stone|Blendable.*Gravel/i;
const SEE=/Glass|Window|Water|Puddle|Foliage|Leaves|Leaf|Plant(?!er)|Bush|Vine|Ivy|Fern|Shrub|Creeper|Moss|Flower|Tree|Palm|Grass_M0_Cards|Cards|Wires?|Cable|Vista|Sky|Cloud|LightCone|Godray|Volumetric|Fog|Smoke|Dust|Particle|Fence|Chain|Net|Grate|Mesh/i;
function materials(key,prims){const byName=new Map(),scene=new THREE.Group();for(const p of prims){if(byName.has(p.name))continue;const m=new THREE.MeshLambertMaterial({name:p.name,side:THREE.DoubleSide});if(DECAL.test(p.name))api.nmDecalApply(m,'decal');byName.set(p.name,m);scene.add(new THREE.Mesh(new THREE.BufferGeometry(),m));}
 api.nmZFixApply(scene,key);const out=new Map();let id=0;
 for(const [n,m] of byName){const p=prims.find(q=>q.name===n);const terrain=TERRAIN.test(n)&&!/Cards|Decal|Floater/i.test(n);const occ=!m.userData.decal&&(terrain||(p.alpha==='OPAQUE'&&!SEE.test(n)));out.set(n,{id:id++,name:n,decal:!!m.userData.decal,occ,lvl:m.userData.zLayer||0,po:m.polygonOffset?[m.polygonOffsetFactor,m.polygonOffsetUnits]:null});}return out;}
const R24=1/16777216,sub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]],cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2],nrm=a=>{const l=Math.hypot(a[0],a[1],a[2])||1;return [a[0]/l,a[1]/l,a[2]/l];};
function rayPlane(o,d,a,n){const den=dot(n,d);if(Math.abs(den)<1e-9)return Infinity;return dot(n,sub(a,o))/den;}
function tri(R,t){const I=R.index,P=R.pos,v=k=>{const i=I[t*3+k]*3;return [P[i],P[i+1],P[i+2]];};return [v(0),v(1),v(2)];}
// per-triangle, per-frame rounding phase (deterministic hash)
const phase=(t,j)=>{let h=(t*2654435761^(j+1)*40503)>>>0;h^=h>>>15;h=Math.imul(h,2246822519)>>>0;h^=h>>>13;return (h>>>0)/4294967296;};
function sweep(key,R,mats,nav,near){const zw=z=>FAR/(FAR-near)*(1-near/z);const {bvh,prims,triMat}=R;let seed=7;const rnd=()=>(seed=(seed*16807)%2147483647)/2147483647;const valid=nav.nodes.map((n,i)=>i).filter(i=>nav.valid[i]);
 const ray=new THREE.Ray(),tanV=Math.tan(FOV*Math.PI/360),step=2*tanV/H;let rays=0,seen=0,seams=0;const flick=[],band=[0,0,0,0],bandSeen=[0,0,0,0],bandOf=d=>d<20?0:d<40?1:d<70?2:3;
 for(let k=0;k<PER;k++){const nd=nav.nodes[valid[Math.floor(rnd()*valid.length)]],o=[nd[0],nd[1]+1.6,nd[2]];
  for(let v=0;v<VIEWS;v++){const yaw=rnd()*Math.PI*2,pitch=(-40+52*rnd())*Math.PI/180,F=[Math.cos(pitch)*Math.sin(yaw),Math.sin(pitch),Math.cos(pitch)*Math.cos(yaw)],Rt=nrm(cross(F,[0,1,0])),U=cross(Rt,F);
   for(let q=0;q<PIX;q++){const sx=(rnd()*2-1)*tanV*ASPECT,sy=(rnd()*2-1)*tanV,d=nrm([F[0]+Rt[0]*sx+U[0]*sy,F[1]+Rt[1]*sx+U[1]*sy,F[2]+Rt[2]*sx+U[2]*sy]);
    ray.origin.set(o[0],o[1],o[2]);ray.direction.set(d[0],d[1],d[2]);rays++;const hits=bvh.raycast(ray,THREE.DoubleSide).filter(h=>h.distance<=RANGE&&h.distance>near).sort((a,b)=>a.distance-b.distance);
    const first=hits.findIndex(h=>mats.get(prims[triMat[h.faceIndex]].name).occ);if(first<0)continue;const S=hits[first],b=bandOf(S.distance);if(b===0&&rnd()>NEARKEEP)continue;seen++;bandSeen[b]++;
    // candidates: decals in front of / around the surface, occluders from the surface to 1 m + 30 steps behind it
    const lim=S.distance+1+30*S.distance*S.distance/near*R24,C=[];
    for(let i=0;i<hits.length;i++){const h=hits[i];if(h.distance>lim)break;const M=mats.get(prims[triMat[h.faceIndex]].name);if(i<first&&!M.decal)continue;if(!M.occ&&!M.decal)continue;const T=tri(R,h.faceIndex);C.push({t:h.faceIndex,M,a:T[0],n:nrm(cross(sub(T[1],T[0]),sub(T[2],T[0]))),dist:h.distance});}
    let ids=new Set(),wins=new Map();const decSets=[];
    for(let j=0;j<J;j++){const jr=nrm([rnd()-.5,rnd()-.5,rnd()-.5]),r=.001*rnd(),oj=[o[0]+jr[0]*r,o[1]+jr[1]*r,o[2]+jr[2]*r],ox=(rnd()-.5)*step,oy=(rnd()-.5)*step,dj=nrm([d[0]+Rt[0]*ox+U[0]*oy,d[1]+Rt[1]*ox+U[1]*oy,d[2]+Rt[2]*ox+U[2]*oy]);
     let best=null,bq=Infinity;const qs=[];
     for(const c of C){const t=rayPlane(oj,dj,c.a,c.n);if(!(t>near)){qs.push(Infinity);continue;}let e=zw(t*dot(dj,F));
      if(c.M.po){let dz=0;if(c.M.po[0]){for(const s of [[Rt,1],[U,1]]){const d2=nrm([dj[0]+s[0][0]*step,dj[1]+s[0][1]*step,dj[2]+s[0][2]*step]),t2=rayPlane(oj,d2,c.a,c.n);if(isFinite(t2)&&t2>0)dz=Math.max(dz,Math.abs(zw(t2*dot(d2,F))-e));}}e+=c.M.po[0]*dz+c.M.po[1]*R24;}
      const qq=Math.floor(e/R24+phase(c.t,j+k*977+v*31+q*7));qs.push(qq);if(c.M.occ&&(qq<bq||(qq===bq&&best&&c.M.id>best.M.id))){bq=qq;best=c;}}
     if(!best)continue;const dec=[];C.forEach((c,i)=>{if(c.M.decal&&qs[i]<=bq)dec.push(c.M.id);});const id=best.M.name+'|'+dec.sort().join(',');ids.add(id);if(!wins.has(id))wins.set(id,best);decSets.push(new Set(dec));}
    if(ids.size>1){const W=[...wins.values()],A=W[0],B=W.find(w=>w.M.name!==A.M.name)||W[1];const decalOnly=W.every(w=>w.M.name===A.M.name);
     // two non-parallel surfaces meeting at a crease (wall into floor, step edges) swap along their intersection line: edge
     // aliasing of a 1 px seam, not z-fighting (counted, not asserted)
     if(!decalOnly&&W.some(w=>Math.abs(dot(w.n,A.n))<.995)){seams++;continue;}
     if(decalOnly){const all=new Set(decSets.flatMap(x=>[...x])),tog=[...all].filter(i=>!decSets.every(x=>x.has(i)));if(tog.every(i=>C.filter(c=>c.M.id===i).every(c=>Math.abs(dot(c.n,A.n))<.995))){seams++;continue;}}band[b]++;
     const pair=decalOnly?A.M.name+'@'+A.M.lvl+' + decal':[A.M.name+'@'+A.M.lvl,B.M.name+'@'+B.M.lvl].sort().join(' <-> ');
     flick.push({pair,dist:+S.distance.toFixed(1),gap:decalOnly?+Math.max(...C.filter(c=>c.M.decal&&Math.abs(c.dist-A.dist)<.05).map(c=>c.dist-A.dist),-1).toFixed(4):(()=>{const [hi,lo]=A.M.lvl>=B.M.lvl?[A,B]:[B,A];return +(hi.dist-lo.dist).toFixed(4);})(),sameLevel:!decalOnly&&A.M.lvl===B.M.lvl,decalOnly,cands:process.env.CANDS?C.map(c=>c.M.name.slice(0,40)+(c.M.decal?'[D]':'@'+c.M.lvl)+' '+(c.dist-S.distance).toFixed(4)):undefined,cos:+Math.abs(dot(d,A.n)).toFixed(3),at:[0,1,2].map(i=>+(o[i]+d[i]*S.distance).toFixed(1)),eye:o.map(x=>+x.toFixed(2))});}}}}
 return {rays,seen,flick,band,bandSeen,seams};}
// Shadow acne cannot reach native map surfaces: the loader / chunker never let them receive shadows (casting on HIGH
// only darkens agents and props), whatever the quality preset.
{const P=pick('nmPrepareScene');assert(/o\.castShadow=false;o\.receiveShadow=false;/.test(P),'nmPrepareScene: native map meshes must not receive shadows');
 const O=pick('nmOptimizeScene');assert((O.match(/castShadow=[a-z.]*receiveShadow=false/g)||[]).length>=2,'nmOptimizeScene: chunks must not receive shadows');
 assert(!/receiveShadow\s*=\s*(true|!0)/.test(src),'native maps runtime turns receiveShadow on somewhere');}
(async()=>{const {loadRender}=await import(path.join(root,'server/tools/map-render.mjs'));const report={near:NM_NEAR,zbias:zb};const fail=[];let tot=0,totSeen=0,totDecal=0;
 for(const key of MAPS){const t0=Date.now();const R=loadRender(key,{bvh:true}),nav=JSON.parse(fs.readFileSync(path.join(root,'models/valorant/maps',key,'navigation.json'),'utf8'));const mats=materials(key,R.prims);
  const s=sweep(key,R,mats,nav,NM_NEAR);const rate=s.flick.length/Math.max(1,s.seen);tot+=s.flick.length;totSeen+=s.seen;
  const byPair=new Map();for(const f of s.flick){const g=byPair.get(f.pair)||{n:0,gaps:[],dists:[]};g.n++;g.gaps.push(f.gap);g.dists.push(f.dist);byPair.set(f.pair,g);}
  const cls={sameLevel:s.flick.filter(f=>f.sameLevel).length,crossLevel:s.flick.filter(f=>!f.sameLevel&&!f.decalOnly).length,decal:s.flick.filter(f=>f.decalOnly).length,gapOver1cm:s.flick.filter(f=>Math.abs(f.gap)>.01).length,behind:s.flick.filter(f=>f.gap>0).length};
  report[key]={rays:s.rays,surfaces:s.seen,seams:s.seams,flicker:s.flick.length,rate:+(rate*100).toFixed(3)+'%',bands:{'0-20':s.band[0]+'/'+s.bandSeen[0],'20-40':s.band[1]+'/'+s.bandSeen[1],'40-70':s.band[2]+'/'+s.bandSeen[2],'70-100':s.band[3]+'/'+s.bandSeen[3]},cls,
   topPairs:[...byPair].sort((a,b)=>b[1].n-a[1].n).slice(0,10).map(([k,g])=>[g.n,k,'gap '+g.gaps.join(','),'dist '+Math.min(...g.dists)+'-'+Math.max(...g.dists)]),examples:s.flick.slice(0,5),ms:Date.now()-t0};
  const r=report[key];console.log(key,JSON.stringify({surfaces:r.surfaces,seams:r.seams,flicker:r.flicker,rate:r.rate,bands:r.bands,cls:r.cls,ms:r.ms}));for(const p of r.topPairs)console.log('   ',p.join('  '));
  if(rate>MAXRATE)fail.push(key+': '+s.flick.length+' flickering pixels ('+r.rate+' > '+(MAXRATE*100)+'%)');totDecal+=r.cls.decal;
  R.bvh=null;R.geo=null;}
 report.total={flicker:tot,decal:totDecal,surfaces:totSeen,rate:+(tot/Math.max(1,totSeen)*100).toFixed(3)+'%'};if(MAPS.length===6){if(tot>MAXTOTAL)fail.push(tot+' flickering pixels in all (> '+MAXTOTAL+')');if(totDecal>MAXDECAL)fail.push(totDecal+' flickering decal pixels (> '+MAXDECAL+')');}console.log('total',JSON.stringify(report.total),'near',NM_NEAR,zb);
 if(process.env.JSON)fs.writeFileSync(process.env.JSON,JSON.stringify(report,null,1));
 if(!process.env.NOASSERT)assert.deepEqual(fail,[],'wall flicker:\n'+fail.join('\n'));console.log('test_map_flicker: '+(process.env.NOASSERT?'measured':'OK'),MAPS.join(' '));})().catch(e=>{console.error(e.message||e);process.exit(1);});
