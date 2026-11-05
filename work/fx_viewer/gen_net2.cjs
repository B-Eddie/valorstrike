// Real-WebGL batch 2: the REAL online sync code for the newly wired paths (a18NetSync Phoenix Hot Hands, netSyncSmokes Omen Dark Cover,
// netSyncDevices Killjoy alarmbot/turret + Cypher Trapwire) extracted from index.html, driven by scripted row streams (shapes as emitted by the
// server tests), rendered with the real module code. Module look only: no game, no models, no occlusion test, no two-client run.
// Usage: node gen_net2.cjs > v2.html ; headless chrome (see HANDOFF.md) with a 960x720 window.
const fs=require('fs'),path=require('path');
const html=fs.readFileSync(path.join(__dirname,'..','..','index.html'),'utf8');
const three=fs.readFileSync(path.join(__dirname,'..','two-browser','qa','three.min.js'),'utf8');
const seg=(a,b)=>{const i=html.indexOf(a),j=html.indexOf(b,i);if(i<0||j<i)throw new Error('extract '+a);return html.slice(i,j);};
const mods=seg('// ---- PHOENIX FX ----','// ---- END PHOENIX FX ----')+'\n'+seg('// ---- OMEN FX ----','// ---- END OMEN FX ----')+'\n'+seg('// ---- RAZE FX ----','// ---- END RAZE FX ----');
const net=[seg('const a18Net = new Map();','function a18NetMesh('),seg('function a18NetFree(r','\nfunction a18NetSync(rows) {'),seg('function a18NetSync(rows) {','const a18FxSync0'),
 seg('function netSyncSmokes(rows){','\nfunction ',),seg('const netAbDn=new Set();','\nconst netRg'),seg('function netDevDrop(id){','\n')].join('\n');
const W=320,H=240;
const scen=`[
 ['phoenix hot hands: fresh cast, t=1.0 s',function(t){return t<4?[{id:1,o:3,kind:'fire',p:[0,0.1,0],r:Math.min(4.5,0.6+t*5.2),tl:4-t,ag:'Phoenix',fu:4.5,gr:0.75,age:t+0.1}]:[]},1.0,function(){}],
 ['phoenix hot hands: late join at age 2.5 (no spread replay)',function(t){return t<1.5?[{id:1,o:3,kind:'fire',p:[0,0.1,0],r:4.5,tl:1.5-t,ag:'Phoenix',fu:4.5,gr:0.75,age:2.5+t}]:[]},0.5],
 ['omen dark cover: fresh, t=1.0 s (legacy smoke body kept)',function(t){return [{id:2,kind:'smoke',o:3,p:[0,2,0],r:4.1,cyl:0,tl:15-t,age:t+0.05,ag:'Omen'}]},1.0],
 ['omen dark cover: late join at age 8 (no grow replay)',function(t){return [{id:2,kind:'smoke',o:3,p:[0,2,0],r:4.1,cyl:0,tl:7-t,age:8+t,ag:'Omen'}]},0.5],
 ['omen dark cover: row dropped early at 0.6 s (dome must end)',function(t){return t<0.6?[{id:2,kind:'smoke',o:3,p:[0,2,0],r:4.1,cyl:0,tl:15-t,age:t+0.05,ag:'Omen'}]:[]},1.0],
 ['killjoy alarmbot: place (age<0.6) -> alert -> boom (dn)',function(t){if(t<1.4)return [{id:3,kind:'dev',d:'alarmbot',o:3,tm:1,p:[0,0,0],yaw:0,hp:20,age:t+0.05,ph:t<0.5?0:1}];return t<1.65?[{id:3,kind:'dev',d:'alarmbot',o:3,tm:1,p:[0,0,0],hp:0,ph:4,dn:1}]:[]},1.45],
 ['killjoy turret: place then shots (sn counter) at t=3.0',function(t){var sn=t<2.8?0:(t<3.0?1:2);return [Object.assign({id:4,kind:'dev',d:'turret',o:3,tm:1,p:[-3,0,0],yaw:0,hp:100,age:t+0.05},sn?{sn:sn,ft:[2,1.2,0]}:{})]},3.0],
 ['cypher trapwire: module wire, trip counter flash at 0.9 s',function(t){return [Object.assign({id:5,kind:'dev',d:'trapwire',o:3,tm:1,p:[-3,0,0],q:[3,0,0],hp:20},t>=0.8?{tn:1,tp:[0,0,0]}:{})]},1.1],
 ['phoenix run it back: marker row at t=2.0 (row-bound, ends with the row)',function(t){return t<3.0?[{id:6,kind:'rib',o:3,p:[0,0,0],r:0,tl:9.5-t}]:[]},2.0],
 ['raze boom bot: place (fresh), lock-on pulse at 1.2 s, running at 1.6 s',function(t){return [{id:7,kind:'dev',d:'boombot',o:3,tm:1,p:[-2+Math.min(t,2.2)*1.4,0,0],yaw:-1.5708,hp:60,age:t+0.05,ph:t<1.0?0:1}]},1.6],
 ['raze boom bot: dn row -> boom at 1.0 s (explicit detonation)',function(t){if(t<0.8)return [{id:8,kind:'dev',d:'boombot',o:3,tm:1,p:[0,0,0],yaw:0,hp:60,age:3+t,ph:t<0.5?1:2}];return t<1.05?[{id:8,kind:'dev',d:'boombot',o:3,tm:1,p:[0,0,0],hp:0,ph:4,dn:1}]:[]},1.5],
 ['raze blast pack: module body at the row point (blast = server boom event, not in this viewer)',function(t){return t<1.5?[{id:9,kind:'dev',d:'blastpack',o:3,tm:1,p:[0,0,0],hp:20,age:1+t}]:[]},1.0]
]`;
process.stdout.write(`<!doctype html><meta charset=utf-8><body style="margin:0;background:#111">
<script>${three}</script>
<script>
var nowv=0,errs=[];window.performance.now=function(){return nowv};
var player={x:0,y:0,z:0},innerWidth=${W},innerHeight=${H};function xE(e){errs.push(String(e&&e.stack||e))}
var MP={me:7},allies=[],units=new Map(),J={smokes:[]};function groundAt(){return 0.05}function jRel(m){try{scene.remove(m)}catch(e){}}function netDevFree(m){try{scene.remove(m)}catch(e){}}function netOwnGone(){}function okMat(c){return new THREE.MeshBasicMaterial({color:c})}
var camera=new THREE.PerspectiveCamera(45,${W}/${H},.1,100);camera.position.set(6,4.2,8.5);camera.lookAt(0,1,0);var scene=null;
var A18VIS={fire:['cloud',0xff5a1a,.5]};var NET_DEV={alarmbot:1,turret:1,trapwire:1,boombot:null,blastpack:null},netDevs=new Map(),netOwnDevs=new Map();
function netDevPart(kind,al){var m=new THREE.Mesh(new THREE.BoxGeometry(.4,.4,.4),new THREE.MeshBasicMaterial({color:al?0x3fb4ff:0xff4655}));m.userData.ownGeo=true;scene.add(m);return m}
function netSmoke0(x,z,al,tl,y,r,cyl){var m=new THREE.Mesh(new THREE.SphereGeometry(r||4,16,12),new THREE.MeshBasicMaterial({color:0x8a8f99,transparent:true,opacity:.35}));m.position.set(x,y||2,z);scene.add(m);J.smokes.push({m:m,p:m.position,t:tl,cb:false,netId:null})}
</script>
<script>${mods}</script>
<script>${net}
var scen=${scen};var _rle=rzxLogErr;rzxLogErr=function(e){errs.push('rzx '+(e&&e.stack||e));};
function tickAll(dt){nowv+=dt*1000;['phxTick','omxTick','kjxTick','cyxTick','rzxTick'].forEach(function(f){if(typeof window[f]==='function'){try{window[f](dt)}catch(e){errs.push(f+' '+e)}}})}
function sync(rows){a18NetSync(rows);netSyncSmokes(rows);netSyncDevices(rows)}
var NR=document.createElement('canvas');document.body.appendChild(NR);var r2=new THREE.WebGLRenderer({canvas:NR,antialias:false,preserveDrawingBuffer:true});r2.setSize(${W*3},${H*4});r2.setScissorTest(true);
scen.forEach(function(sc,n){scene=new THREE.Scene();scene.background=new THREE.Color(0x232a36);var g=new THREE.Mesh(new THREE.PlaneGeometry(30,30),new THREE.MeshBasicMaterial({color:0x3a4252}));g.rotation.x=-Math.PI/2;scene.add(g);scene.add(new THREE.GridHelper(30,30,0x556,0x445));
 a18Net.clear();J.smokes=[];nowv=0;
 for(var k=0;k<=Math.round(sc[2]/0.05);k++){var t=k*0.05;try{sync(sc[1](t))}catch(e){errs.push(sc[0]+' '+e)}tickAll(0.05)}
 var x=(n%3)*${W},y=${H}*(3-Math.floor(n/3));r2.setViewport(x,y,${W},${H});r2.setScissor(x,y,${W},${H});r2.render(scene,camera);
 try{sync([])}catch(e){errs.push('end '+e)}for(var q=0;q<260;q++)tickAll(0.05);var left=scene.children.length;if(left>2)errs.push(sc[0]+' leftover scene objs '+(left-2));
});
document.title='NET2 DONE errs='+errs.length;document.body.setAttribute('data-errs',Array.from(new Set(errs)).join(' || ').slice(0,900));
</script>`);
