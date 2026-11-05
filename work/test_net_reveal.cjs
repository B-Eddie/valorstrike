// Full script composition + real THREE, fake DOM/noGL. Authoritative remaining-duration rows, not gameplay acceptance.
const assert=require('assert/strict'),{boot}=require('./page_harness.cjs');
const H=boot({real3:true}),x=H.xe;
x('window.__now=1000;performance.now=()=>__now;NET.socket={readyState:1,send(){}};window.__rb={nid:91,alive:true,g:new THREE.Group(),body:new THREE.Mesh(new THREE.BoxGeometry(.5,1,.3)),head:new THREE.Mesh(new THREE.SphereGeometry(.2))};__rb.g.add(__rb.body,__rb.head);bots.push(__rb);true');
const row=(ttl,orange)=>x(`netRevealSync([[91,2,0,3,${ttl},${orange}]]);true`);
row(.7,.4);assert.equal(x('__rb.body.children.length'),1);assert.equal(x('__rb.body.children[0].material===svxRvMat'),true);
row(.65,.35);assert.equal(x('__rb.body.children.length'),1,'repeat dedupe');
x('__now+=360;netRevealTick();true');assert.equal(x('__rb.body.children[0].material===rvMat'),true,'Sova expiry falls back to longer shared reveal');
x('__now+=300;netRevealTick();true');assert.equal(x('__rb.body.children.length'),0,'expires at remaining time, not full pulse duration');
row(.2,.2);x('netRevealSync([]);true');assert.equal(x('__rb.body.children.length'),0,'authoritative empty clears');
row(1,1);x('__rb.alive=false;netRevealTick();true');assert.equal(x('__rb.body.children.length'),0,'death');x('__rb.alive=true;true');
row(1,1);x('NET.socket=null;netRevealTick();true');assert.equal(x('__rb.body.children.length'),0,'disconnect');x('NET.socket={readyState:1,send(){}};true');
x('netRevealSync([[91,2,0,3]]);true');assert.equal(x('__rb.body.children.length'),0,'legacy row minimap only');assert.ok(x('__rb.netRvUntil>__now'));
row(1,1);x('netClearEffects();true');assert.equal(x('__rb.body.children.length'),0,'real effects reset');assert.equal(x('__rb.netRvUntil'),0);
// Real wrapped mpCliRS integration and protocol sanitizer, including bad duration rejection.
x('mpCliRS({rv:[[91,2,0,3,.8,.8]],b:0});true');assert.equal(x('__rb.body.children[0].material===svxRvMat'),true,'real online rs wrapper');
x('mpCliRS({rv:[],b:0});true');assert.equal(x('__rb.body.children.length'),0);
row(1,2);assert.equal(x('__rb.body.children.length'),0,'invalid remaining cannot create shell');
console.log('online reveal/full page/noGL: Sova orange, other red, overlap expiry, remaining TTL, dedupe, empty, death, disconnect, reset, legacy, real rs wrapper');
