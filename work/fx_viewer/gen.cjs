// Renders newly wired kit modules with REAL WebGL (headless Chrome, software GL) in a small tiled page: module look only, no game, no
// models, no networking. Usage: node gen.cjs > viewer.html ; google-chrome --headless=new ... viewer.html
const fs=require('fs'),path=require('path');
const html=fs.readFileSync(path.join(__dirname,'..','..','index.html'),'utf8');
const three=fs.readFileSync(path.join(__dirname,'..','two-browser','qa','three.min.js'),'utf8');
const blocks=['SAGE','SKYE','FADE','MIKS','DEADLOCK'];
let code='';for(const b of blocks){const i=html.indexOf('// ---- '+b+' FX ----'),j=html.indexOf('// ---- END '+b+' FX ----',i);if(i<0||j<i)throw new Error(b);code+=html.slice(i,j)+'\n';}
const ext=(a,b)=>{const i=html.indexOf(a),j=html.indexOf(b,i);if(i<0||j<i)throw new Error('extract '+a);return html.slice(i,j);};
const netCode=[ext('const netRg=new Map();','function netSyncEffects(rows)'),ext('const a18Net = new Map();','function a18NetMesh('),ext('function a18NetFree(r','\nfunction a18NetSync(rows) {'),ext('function a18NetSync(rows) {','const a18FxSync0')].join('\n');
const W=+process.env.TW||320,H=+process.env.TH||240;
const cases=[
 ['haunt orb mid-flight','fdxHauntOrb(0,1.4,0)',0.6,'orb'],
 ['haunt burst t=0.5s','fdxHauntBurst({x:0,y:0,z:0})',0.5],
 ['skye seeker','skxSeeker(0,1,0)',0.5],
 ['skye trailblazer','skxTrailblazer(0,0,0,0.6)',0.8],
 ['skye regrowth','skxRegrowth(0,0,0,6)',1.0],
 ['miks waveform','mkxWaveformSmoke({x:0,y:0,z:0},4.15,14)',2.0],
 ['sage barrier','sgxBarrierWall({x:0,y:0,z:0},0.4)',1.0],
 ['fade seize pool','fdxSeizePool({x:0,y:0,z:0},4,5)',1.5],
 ['deadlock annihilation','dlxAnnihilation({x:-4,y:1.4,z:0},{x:1,y:0,z:0},9)',0.35],
];
const sel=process.env.ONLY?process.env.ONLY.split(',').map(Number):cases.map((_,i)=>i);
process.stdout.write(`<!doctype html><meta charset=utf-8><body style="margin:0;background:#111"><canvas id=c></canvas>
<script>${three}</script>
<script>
var nowv=0,errs=[];window.performance.now=function(){return nowv};
var player={x:0,y:0,z:0},innerWidth=${W},innerHeight=${H};function xE(e){errs.push(String(e&&e.stack||e))}
var renderer=new THREE.WebGLRenderer({canvas:document.getElementById('c'),antialias:false,preserveDrawingBuffer:true});renderer.setSize(${W*3},${H*Math.ceil(sel.length/3)});renderer.setScissorTest(true);
var camera=new THREE.PerspectiveCamera(45,${W}/${H},.1,100);camera.position.set(5,3.2,6.5);camera.lookAt(0,1,0);
var scene=null;
</script>
<script>${code}</script>
<script>
var cases=${JSON.stringify(cases)},sel=${JSON.stringify(sel)},ticks=['sgxTick','skxTick','fdxTick','mkxTick','dlxTick'];
function tickAll(dt){nowv+=dt*1000;for(var i=0;i<ticks.length;i++){var f=window[ticks[i]];if(typeof f==='function'){try{f(dt)}catch(e){errs.push(ticks[i]+' '+e)}}}}
sel.forEach(function(ci,n){var c=cases[ci];scene=new THREE.Scene();scene.background=new THREE.Color(0x232a36);
 var g=new THREE.Mesh(new THREE.PlaneGeometry(30,30),new THREE.MeshBasicMaterial({color:0x3a4252}));g.rotation.x=-Math.PI/2;scene.add(g);scene.add(new THREE.GridHelper(30,30,0x556,0x445));
 var h=null;try{h=eval(c[1])}catch(e){errs.push(c[0]+' build '+e)}
 var steps=Math.round(c[2]/0.05);for(var k=0;k<steps;k++)tickAll(0.05);
 var x=(n%3)*${W},y=${H}*(Math.ceil(sel.length/3)-1-Math.floor(n/3));renderer.setViewport(x,y,${W},${H});renderer.setScissor(x,y,${W},${H});renderer.render(scene,camera);
 try{if(h&&h.end)h.end()}catch(e){}});
document.title='DONE errs='+errs.length;errs=[];document.body.setAttribute('data-errs',errs.join(' || ').slice(0,800));
</script>`);

process.stdout.write(`<script>
var MP={me:7},units=new Map([[3,{g:{position:new THREE.Vector3(-3,0,0)}}]]);function groundAt(){return 0}
var A18VIS={haunt:['ring',0x9a6ff0,.5],seeker:['orb',0x3fd0c0]};
${netCode}
var rowsOf=function(t){var o=[];return o};
var scen=[
 ['net haunt (other owner): orb flight then burst',function(t){var tl=2-t,r={id:1,kind:'haunt',o:3,p:[3,0,0],tl:tl};if(t>=0.4)r.dn=1;return t<2?[r]:[]},0.55],
 ['net skye seeker (other owner)',function(t){return t<1?[{id:2,kind:'seeker',o:3,ag:'Skye',p:[3,1,0],tl:1.05-t}]:[]},0.5],
 ['net skye trailblazer (other owner)',function(t){return t<6?[{id:3,kind:'trail',o:3,p:[-3+t*1.5,0,0],yaw:-1.57,tl:6-t}]:[]},2.5],
 ['net waveform (other owner)',function(t){return t<14?[{id:4,kind:'smoke',o:3,p:[0,0,0],r:4.15,wf:1,tl:14-t}]:[]},2.0],
 ['net deadlock cocoon (other owner, captive moves)',function(t){return t<7?[{id:6,kind:'anni',o:3,p:[t*0.3,0,0],tl:7-t}]:[]},1.5],
 ['net skye hawk then flash dn burst',function(t){if(t<0.6)return [{id:7,kind:'hawk',o:3,p:[-4+t*18*0.4,1.5,0],hd:[1,0,0],tl:2-t}];if(t<0.9)return [{id:8,kind:'flash',o:3,ag:'Skye',p:[-4+0.6*7.2,1.5,0],tl:1,fa:Math.max(0,0.9-t)}];if(t<1.2)return [{id:8,kind:'flash',o:3,ag:'Skye',p:[-4+0.6*7.2,1.5,0],tl:0.2,fa:0,dn:1}];return []},1.0],
 ['net miks harmonize (other player buffed: pillar only)',function(t){return t<8?[{id:9,kind:'harmon',o:3,tg:3,p:[0,0,0],tl:8-t}]:[]},1.5],
 ['net own haunt (must draw nothing)',function(t){var r={id:5,kind:'haunt',o:7,p:[3,0,0],tl:2-t};if(t>=0.4)r.dn=1;return [r]},0.55],
];
function netRun(sc,upto){var t=0;a18Net.clear();for(var k=0;k<=Math.round(upto/0.05);k++){t=k*0.05;try{netSyncTrail(sc[1](t));netSyncRegrowth([]);netSyncWaveform(sc[1](t));a18NetSync(sc[1](t))}catch(e){errs.push(sc[0]+' '+e)}tickAll(0.05)}}
var NR=document.createElement('canvas');document.body.appendChild(NR);var r2=new THREE.WebGLRenderer({canvas:NR,antialias:false,preserveDrawingBuffer:true});r2.setSize(${W*3},${H*3});r2.setScissorTest(true);
scen.forEach(function(sc,n){scene=new THREE.Scene();scene.background=new THREE.Color(0x232a36);var g=new THREE.Mesh(new THREE.PlaneGeometry(30,30),new THREE.MeshBasicMaterial({color:0x3a4252}));g.rotation.x=-Math.PI/2;scene.add(g);scene.add(new THREE.GridHelper(30,30,0x556,0x445));
 netRun(sc,sc[2]);var x=(n%3)*${W},y=${H}*(2-Math.floor(n/3));r2.setViewport(x,y,${W},${H});r2.setScissor(x,y,${W},${H});r2.render(scene,camera);
 try{netSyncTrail([]);netSyncWaveform([]);a18NetSync([])}catch(e){errs.push('end '+e)}
 for(var q=0;q<80;q++)tickAll(0.05);var left=scene.children.length;if(left>2)errs.push(sc[0]+' leftover scene objs '+(left-2));});
document.title='NET DONE errs='+errs.length;document.body.setAttribute('data-errs',errs.join(' || ').slice(0,900));
</script>`);
