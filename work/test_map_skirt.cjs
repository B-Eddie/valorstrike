// Map holes (#5): the native map loader adds a backdrop skirt (ground disc + horizon ring) that draws first
// without writing depth, follows the camera inside the far plane and past the fog, and is not raycastable.
// Measured with the ray-cast viewer (server/tools/view-map.mjs): below-horizon void from the reported Bind
// spot and sampled playable nodes on every map is zero with the skirt (and non-zero on the raw meshes).
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict');
const root=path.join(__dirname,'..'),src=fs.readFileSync(path.join(root,'work/native_maps_runtime.js'),'utf8'),html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const T=require(require.resolve('three',{paths:[path.join(root,'server')]}));
assert(/nmConnected\(C\);root\.add\(nmSkirt\(nmSkirtSpec\(nav\.nodes,C\.playable\)\)\)/.test(src),'loader adds the skirt for the playable footprint');
assert(html.includes('function nmSkirt(spec)'),'skirt is in the generated page');
const pick=n=>{const i=src.indexOf('function '+n+'(');return src.slice(i,src.indexOf('\n',i));},ctx={THREE:T,Math};vm.createContext(ctx);
const body=src.slice(src.indexOf('function nmSkirtSpec('),src.indexOf('// Disconnected decorative islands'));vm.runInContext(body+'\n'+pick('nmConnected')+';globalThis.api={nmSkirtSpec,nmSkirtRadius,nmSkirt,nmConnected};',ctx);
const {nmSkirtSpec,nmSkirtRadius,nmSkirt,nmConnected}=ctx.api;
for(const [far,fog]of [[500,260],[200,90],[900,340]]){const R=nmSkirtRadius(far,fog);assert(R<far&&R>fog,'radius '+R+' inside far '+far+' and past fog '+fog);}
for(const key of ['ascent','bind','haven','split','lotus','breeze']){const nav=JSON.parse(fs.readFileSync(path.join(root,'models/valorant/maps',key,'navigation.json'))),C={nav};nmConnected(C);const spec=nmSkirtSpec(nav.nodes,C.playable);
 const ys=nav.nodes.filter((_,i)=>C.playable[i]).map(p=>p[1]);assert(spec.y<Math.min(...ys)-1&&spec.top>Math.max(...ys)+1.8,key+': skirt below every floor and ring above every eye line');
 const g=nmSkirt(spec),cam=new T.PerspectiveCamera(75,1,.05,500),scene=new T.Scene();scene.fog=new T.Fog(0,95,260);cam.position.set(30,9,-20);assert.equal(g.children.length,2);
 for(const m of g.children){assert(m.renderOrder<0&&m.material.depthWrite===false&&m.material.fog,key+': draws first, writes no depth, fogged');const hits=[];m.raycast(new T.Raycaster(),hits);assert.equal(hits.length,0,'not raycastable');assert.equal(m.frustumCulled,false);
  m.onBeforeRender(null,scene,cam);assert(Math.abs(m.position.x-30)<1e-9&&Math.abs(m.position.z+20)<1e-9,'centred on the camera');assert(m.scale.x>260&&m.scale.x<500,'radius inside far plane, past fog');}}
(async()=>{const V=await import(require('url').pathToFileURL(path.join(root,'server/tools/view-map.mjs')).href);
 {const b=V.loadVisual('bind'),out=path.join(require('os').tmpdir(),'skirt-bind.png');V.view(b,[53.25,7.1,18.75],0,0,out,120,80,null,null);const raw=V.view.below;V.view(b,[53.25,7.1,18.75],0,0,out,120,80,null,V.loadSkirt('bind'));
  assert(raw>.1,'raw Bind view from (53.25,7.1,18.75) shows void ('+raw.toFixed(3)+')');assert.equal(V.view.below,0,'with the skirt no void below the horizon');}
 const ray=new T.Ray();for(const key of ['haven','split','breeze']){const b=V.loadVisual(key),nav=JSON.parse(fs.readFileSync(path.join(root,'models/valorant/maps',key,'navigation.json'))),valid=nav.nodes.filter((_,i)=>nav.valid[i]),sk=[V.loadSkirt(key),V.loadSkirt(key,{far:200,fogFar:90})];let raw=0,left=0;
  for(let k=0;k<valid.length;k+=Math.ceil(valid.length/60)){const n=valid[k];for(const el of [-35,-15,-5,-2])for(let a=0;a<24;a++){const th=a/24*Math.PI*2,e=el*Math.PI/180;ray.origin.set(n[0],n[1]+1.6,n[2]);ray.direction.set(Math.sin(th)*Math.cos(e),Math.sin(e),Math.cos(th)*Math.cos(e));const h=b.raycastFirst(ray,T.DoubleSide);if(h&&h.distance<=400)continue;raw++;for(const s of sk)if(!(s.hit(ray.origin,ray.direction)<s.far))left++;}}
  assert(raw>0,key+': survey sees raw void');assert.equal(left,0,key+': no below-horizon void with the skirt');}
 console.log('Map skirt: loader adds a depth-less, first-drawn, camera-following ground+ring backdrop on all six maps; ray-cast viewer shows zero below-horizon void (Bind spot, Haven/Split/Breeze surveys)');})().catch(e=>{console.error(e);process.exit(1);});
