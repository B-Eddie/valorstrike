// Renders newly wired kit modules with REAL WebGL (headless Chrome, software GL) in a small tiled page: module look only, no game, no
// models, no networking. Usage: node gen.cjs > viewer.html ; google-chrome --headless=new ... viewer.html
const fs=require('fs'),path=require('path');
const html=fs.readFileSync(path.join(__dirname,'..','..','index.html'),'utf8');
const three=fs.readFileSync(path.join(__dirname,'..','two-browser','qa','three.min.js'),'utf8');
const blocks=['SAGE','SKYE','FADE','MIKS','DEADLOCK'];
let code='';for(const b of blocks){const i=html.indexOf('// ---- '+b+' FX ----'),j=html.indexOf('// ---- END '+b+' FX ----',i);if(i<0||j<i)throw new Error(b);code+=html.slice(i,j)+'\n';}
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
document.title='DONE errs='+errs.length;document.body.setAttribute('data-errs',errs.join(' || ').slice(0,800));
</script>`);
