// Full script composition + real THREE, fake DOM/noGL. Authoritative remaining-duration rows, not gameplay acceptance.
const assert=require('assert/strict'),{boot}=require('./page_harness.cjs');
const H=boot({real3:true}),x=H.xe;
x('window.__now=1000;performance.now=()=>__now;NET.socket={readyState:1,send(){}};window.__rb=Object.assign(mkGuy(2,3,botMat,headMat),{nid:91,alive:true});bots.push(__rb);true');
assert.equal(x('__rb.body.visible'),false,'real mkGuy hidden source');
const row=(ttl,orange)=>x(`netRevealSync([[91,2,0,3,${ttl},${orange}]]);true`);
row(.7,.4);assert.equal(x('__rb.g.children.filter(m=>m.name===`reveal-shell`).length'),2);assert.equal(x('__rb.g.children.find(m=>m.name===`reveal-shell`).material===svxRvMat'),true);
x('window.__shell=__rb.g.children.find(m=>m.name===`reveal-shell`);__rb.body.position.set(.3,1,.7);__rb.body.scale.set(.7,.8,.9);__shell.onBeforeRender(null,null,camera);true');
assert.equal(x('__shell.parent===__rb.g'),true,'visible sibling, not hidden hitbox child');assert.equal(x('__shell.matrixWorld.elements[12]'),2.3,'source world x copied');assert.ok(Math.abs(x('__shell.matrixWorld.elements[0]')-.805)<1e-9,'source scale plus reveal expansion');assert.equal(x('__rb.body.visible'),false,'never unhide hitbox');
row(.65,.35);assert.equal(x('__rb.g.children.filter(m=>m.name===`reveal-shell`).length'),2,'repeat dedupe');
x('__now+=360;netRevealTick();true');assert.equal(x('__rb.g.children.find(m=>m.name===`reveal-shell`).material===rvMat'),true,'Sova expiry falls back to longer shared reveal');
x('__now+=300;netRevealTick();true');assert.equal(x('__rb.g.children.filter(m=>m.name===`reveal-shell`).length'),0,'expires at remaining time, not full pulse duration');
row(.2,.2);x('netRevealSync([]);true');assert.equal(x('__rb.g.children.filter(m=>m.name===`reveal-shell`).length'),0,'authoritative empty clears');
row(1,1);x('__rb.alive=false;netRevealTick();true');assert.equal(x('__rb.g.children.filter(m=>m.name===`reveal-shell`).length'),0,'death');x('__rb.alive=true;true');
row(1,1);x('NET.socket=null;netRevealTick();true');assert.equal(x('__rb.g.children.filter(m=>m.name===`reveal-shell`).length'),0,'disconnect');x('NET.socket={readyState:1,send(){}};true');
x('netRevealSync([[91,2,0,3]]);true');assert.equal(x('__rb.g.children.filter(m=>m.name===`reveal-shell`).length'),0,'legacy row minimap only');assert.ok(x('__rb.netRvUntil>__now'));
row(1,1);x('netClearEffects();true');assert.equal(x('__rb.g.children.filter(m=>m.name===`reveal-shell`).length'),0,'real effects reset');assert.equal(x('__rb.netRvUntil'),0);
// Real wrapped mpCliRS integration and protocol sanitizer, including bad duration rejection.
x('mpCliRS({rv:[[91,2,0,3,.8,.8]],b:0});true');assert.equal(x('__rb.g.children.find(m=>m.name===`reveal-shell`).material===svxRvMat'),true,'real online rs wrapper');
x('mpCliRS({rv:[],b:0});true');assert.equal(x('__rb.g.children.filter(m=>m.name===`reveal-shell`).length'),0);
row(1,2);assert.equal(x('__rb.g.children.filter(m=>m.name===`reveal-shell`).length'),0,'invalid remaining cannot create shell');
// Native skin path: share skeleton/geometry, preserve source bind and visibility; remove only overlays.
x('window.__sc=new THREE.Group();__rb.g.add(__sc);window.__geo=new THREE.BoxGeometry(.5,1,.3);const n=__geo.attributes.position.count;__geo.setAttribute(`skinIndex`,new THREE.Uint16BufferAttribute(new Uint16Array(n*4),4));const sw=new Float32Array(n*4);for(let i=0;i<n;i++)sw[i*4]=1;__geo.setAttribute(`skinWeight`,new THREE.Float32BufferAttribute(sw,4));window.__bone=new THREE.Bone();window.__skin=new THREE.SkinnedMesh(__geo,new THREE.MeshBasicMaterial());__skin.add(__bone);__skin.bind(new THREE.Skeleton([__bone]));__sc.add(__skin);__rb.xm={valorant:1,sx:{sc:__sc}};true');
row(1,1);assert.equal(x('__sc.children.filter(m=>m.name===`reveal-native`).length'),1);assert.equal(x('__rb.g.children.filter(m=>m.name===`reveal-shell`).length'),0,'no capsule for loaded native');
x('window.__over=__sc.children.find(m=>m.name===`reveal-native`);__skin.position.set(.4,0,.2);__bone.position.y=.2;__over.onBeforeRender(null,null,camera);true');
assert.equal(x('__over.skeleton===__skin.skeleton&&__over.geometry===__skin.geometry'),true,'shared live pose resources');assert.equal(x('__over.bindMatrixInverse.equals(__skin.bindMatrixInverse)'),true);assert.equal(x('__over.matrixWorld.equals(__skin.matrixWorld)'),true,'exact model transform, no scaled detached skeleton');
row(.9,.9);assert.equal(x('__sc.children.filter(m=>m.name===`reveal-native`).length'),1,'repeat no recursive overlay');x('netRevealClear();true');assert.equal(x('__sc.children.length'),1,'original native skin retained');assert.equal(x('__skin.visible'),true);assert.equal(x('__skin.skeleton.bones[0]===__bone'),true);
console.log('online reveal/full page/noGL: Sova orange, other red, overlap expiry, remaining TTL, dedupe, empty, death, disconnect, reset, legacy, real rs wrapper');

row(1,1);x('window.__oldsc=__sc;window.__newsc=__sc.clone(true);__newsc.children.filter(m=>m.name===`reveal-native`).forEach(m=>__newsc.remove(m));__rb.g.add(__newsc);__rb.xm.sx.sc=__newsc;netRevealTick();true');
assert.equal(x('__oldsc.children.filter(m=>m.name===`reveal-native`).length'),0,'old rig overlay removed');assert.equal(x('__newsc.children.filter(m=>m.name===`reveal-native`).length'),1,'replacement rig rebuilt');
x('__rb.xm=null;netRevealTick();true');assert.equal(x('__newsc.children.filter(m=>m.name===`reveal-native`).length'),0);assert.equal(x('__rb.g.children.filter(m=>m.name===`reveal-shell`).length'),2,'fallback if native removed');
x('__rb.xm={valorant:1,sx:{sc:__oldsc}};netRevealTick();true');assert.equal(x('__rb.g.children.filter(m=>m.name===`reveal-shell`).length'),0);assert.equal(x('__oldsc.children.filter(m=>m.name===`reveal-native`).length'),1,'native upgrade during same reveal');
x('netRevealClear();true');assert.equal(x('__oldsc.children.length'),1);console.log('online reveal live native-load/rig-swap/fallback upgrade: PASS');
