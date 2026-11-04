// Minimap agent icons (Valorant-style; user: "change the minimap so it's not white dots, make it images of the agent"):
//  1. every visible unit on the native minimap (you, living teammates, enemies only while spotted) is a small circular
//     portrait of its agent (the bundled HUD portraits, hudPortrait(): models/valorant/agents/portraits/<agent>.png)
//     on a team-coloured ring: you white, teammates teal (or the ally colour setting), enemies red (enemy colour setting);
//  2. a small pointer on the ring shows where the unit faces (your yaw; a bot / puppet's g.rotation.y, which faces +z);
//  3. no omniscience: an enemy out of everyone's view, or hidden by the server's fog of war (u.fog), is not drawn;
//  4. a missing portrait (unknown agent, image not loaded or failed) falls back to the team-coloured dot;
//  5. dead teammates (and you, when dead) leave an X where they died; no portrait;
//  6. portraits are cut once into a cached circular canvas per agent: drawing frame after frame creates no Images or
//     canvases (test_frame_perf rule: no per-frame allocation);
//  7. the blockout minimap (Retake / maps while the native scene is not active) draws the same icons.
const fs=require('fs'),vm=require('vm'),assert=require('assert/strict'),s=fs.readFileSync('work/native_maps_runtime.js','utf8'),html=fs.readFileSync('index.html','utf8');
const a=s.indexOf('function nmMapProjection('),b=s.indexOf('\n{const map=minimap',a);assert.ok(a>0&&b>a,'minimap block found');
let t=1000,paths=[],draws=[],color,blocked=()=>false,images=0,canvases=0;
const lastArc=()=>{for(let i=paths.length-1;i>=0;i--)if(paths[i].arcs.length)return paths[i];return null;};
const ctx={setTransform(){},clearRect(){paths=[];draws=[]},fillRect(){},beginPath(){paths.push({arcs:[],lines:[],alpha:ctx.globalAlpha})},closePath(){},
 arc(x,z,r,a0,a1){paths.at(-1)&&paths.at(-1).arcs.push({x,z,r,a0,a1})},fill(){const p=paths.at(-1);if(p&&!p.fill)p.fill=color},stroke(){const p=paths.at(-1);if(p)p.stroke=ctx.strokeStyle},
 moveTo(x,z){paths.at(-1)&&paths.at(-1).lines.push([x,z])},lineTo(x,z){paths.at(-1)&&paths.at(-1).lines.push([x,z])},fillText(){},save(){},restore(){},clip(){},
 drawImage(img,x,z,w,h){draws.push({art:img&&img.art,x:x+(w||0)/2,z:z+(h||0)/2,w,ring:(lastArc()||{}).fill,alpha:ctx.globalAlpha})},
 globalAlpha:1,set fillStyle(v){color=v},get fillStyle(){return color},strokeStyle:'',lineWidth:1,font:'',textAlign:''};
const V=class{constructor(x,y,z){Object.assign(this,{x,y,z})}set(x,y,z){this.x=x;this.y=y;this.z=z;return this;}};/* set: nmSpot reuses its eye / target points (combat lane) */
class Img{constructor(){images++;this.complete=false;this.naturalWidth=0;this._src='';}set src(v){this._src=v;if(c.loadOK(v)){this.complete=true;this.naturalWidth=256;}else if(c.loadFail(v)){this.complete=true;this.naturalWidth=0;}}get src(){return this._src;}}
const off=()=>{const cv={width:0,height:0,art:null};const x={save(){},restore(){},beginPath(){},arc(){},clip(){},fillRect(){},clearRect(){},fill(){},stroke(){},drawImage(img){cv.art=img.src;},set fillStyle(v){},globalAlpha:1};cv.getContext=()=>x;return cv;};
const AG=/^(jett|phoenix|sova|sage|reyna|raze|killjoy|omen|skye|chamber|breach|cypher)$/;
const c={Math,String,Number,performance:{now:()=>t+=200},running:true,player:{x:0,y:0,z:0,hp:100},mode:'five',FV:{atk:false,sp:{st:'carry'}},yaw:-Math.PI/2,XCALL:{},window:{},J:{rvT:0,rv:[],pick:'Phoenix'},
 mmVis:new Set(),mmPrev:new Set(),mmLost:new Map(),camera:{fov:70.53,aspect:16/9},$(){return {classList:{toggle(){}}}},MM:{width:320,height:320,getBoundingClientRect:()=>({width:160})},mmx:ctx,allies:[],bots:[],
 los:(e,p)=>!blocked(e,p),pEye:()=>new V(c.player.x,1.5,c.player.z),THREE:{Vector3:V},Image:Img,document:{createElement(tag){assert.equal(tag,'canvas');canvases++;return off();}},
 hudPortrait(ag){const k=String(ag||'').toLowerCase();return AG.test(k)?'models/valorant/agents/portraits/'+k+'.png':'';},xAg:u=>u.agent,loadOK:v=>!/sage/.test(v),loadFail:v=>/sage/.test(v)};
vm.createContext(c);vm.runInContext(s.slice(a,b)+';globalThis.draw=nmMinimap;',c);
const C={bounds:{x1:-60,x2:60,z1:-60,z2:60},image:{complete:false},meta:{sites:{}}};
const unit=(agent,x,z,ry,alive=true)=>({agent,alive,g:{position:{x,y:0,z},rotation:{y:ry}}});
const P=(x)=>8+(x+60)*304/120; // world -> map px on the 320 px canvas
const icon=ag=>draws.filter(d=>d.art==='models/valorant/agents/portraits/'+ag+'.png');
const near=(p,x,z)=>Math.abs(p.x-P(x))<1e-6&&Math.abs(p.z-P(z))<1e-6;
const frame=()=>{t+=1000;c.draw(C);};
// --- 1. portraits with team rings: you, a teammate, a spotted enemy ---
const mate=unit('Sova',-10,0,Math.PI/2),front=unit('Jett',20,0,-Math.PI/2),behind=unit('Reyna',-30,0,0);
c.allies=[mate];c.bots=[front,behind];frame();frame();
assert.equal(icon('phoenix').length,1,'you: your agent portrait (J.pick)');assert.ok(near(icon('phoenix')[0],0,0),'your portrait on your position');
assert.equal(icon('phoenix')[0].ring,'#ffffff','you: white highlight ring');
assert.equal(icon('sova').length,1,'teammate portrait');assert.ok(near(icon('sova')[0],-10,0),'teammate portrait on its position');assert.equal(icon('sova')[0].ring,'#5fe4df','teammate: teal ring');
assert.equal(icon('jett').length,1,'spotted enemy portrait');assert.ok(near(icon('jett')[0],20,0),'enemy portrait on its position');assert.equal(icon('jett')[0].ring,'#ff4655','enemy: red ring');
const sz=icon('sova')[0].w;assert.ok(sz>=12&&sz<=40,'portrait readable on a 320 px canvas ('+sz+' px)');assert.ok(icon('phoenix')[0].w>=sz,'your icon at least as large as the others');
// --- 3. no omniscience ---
assert.equal(icon('reyna').length,0,'enemy behind everyone in the open: not drawn');
front.fog=true;frame();assert.equal(icon('jett').length,0,'enemy hidden by the server fog of war: not drawn');front.fog=false;
// ring colour settings: ally / enemy colour options
c.XAC={on:true,hex:'#3d8bff'};c.XEC={hex:'#f5e14a'};frame();assert.equal(icon('sova')[0].ring,'#3d8bff','ally colour setting');assert.equal(icon('jett')[0].ring,'#f5e14a','enemy colour setting');delete c.XAC;delete c.XEC;frame();
// --- 2. facing pointer: a filled wedge in the ring colour, outside the ring, along the facing ---
const pointer=(x,z,col)=>paths.find(p=>p.fill===col&&!p.arcs.length&&p.lines.length===3&&p.lines.every(([px,pz])=>Math.hypot(px-P(x),pz-P(z))<40)&&Math.hypot(p.lines[0][0]-P(x),p.lines[0][1]-P(z))>sz/2);
const dirOf=(p,x,z)=>Math.atan2(p.lines[0][1]-P(z),p.lines[0][0]-P(x));
let pm=pointer(-10,0,'#5fe4df');assert.ok(pm,'teammate facing pointer');assert.ok(Math.abs(dirOf(pm,-10,0))<1e-6,'teammate rotation.y = pi/2 faces +x on the map');
let pe=pointer(20,0,'#ff4655');assert.ok(pe,'enemy facing pointer');assert.ok(Math.abs(Math.abs(dirOf(pe,20,0))-Math.PI)<1e-6,'enemy rotation.y = -pi/2 faces -x');
let pp=pointer(0,0,'#ffffff');assert.ok(pp,'your facing pointer');assert.ok(Math.abs(dirOf(pp,0,0))<1e-6,'yaw -pi/2 looks toward +x');
c.yaw=Math.PI;frame();pp=pointer(0,0,'#ffffff');assert.ok(Math.abs(dirOf(pp,0,0)-Math.PI/2)<1e-6,'yaw pi looks toward +z (down the map)');c.yaw=-Math.PI/2;frame();
// --- 4. fallbacks: no portrait art / failed image -> team-coloured dot, no image ---
const odd=unit('Mystery',-12,5,0),sage=unit('Sage',-14,-5,0);c.allies=[mate,odd,sage];frame();
const disc=(x,z,col)=>paths.find(p=>p.fill===col&&p.arcs.length===1&&Math.abs(p.arcs[0].x-P(x))<1e-6&&Math.abs(p.arcs[0].z-P(z))<1e-6);
assert.ok(disc(-12,5,'#5fe4df'),'unknown agent: teal dot');assert.ok(!draws.some(d=>near(d,-12,5)),'unknown agent: no image');
assert.ok(disc(-14,-5,'#5fe4df'),'portrait failed to load: teal dot');assert.equal(icon('sage').length,0,'failed portrait never drawn');
// --- 6. cache: no Images / canvases per frame ---
const i0=images,c0=canvases;for(let i=0;i<40;i++)frame();assert.equal(images,i0,'no new Image per frame');assert.equal(canvases,c0,'no new canvas per frame');
assert.ok(images<=5&&canvases<=4,'one Image per agent ('+images+'), one cut canvas per loaded agent ('+canvases+')');
// --- 5. dead: X where they died, no portrait ---
const xAt=(x,z)=>paths.filter(p=>p.stroke&&!p.arcs.length&&p.lines.length===2&&p.lines.every(([px,pz])=>Math.hypot(px-P(x),pz-P(z))<20));
mate.alive=false;frame();assert.equal(icon('sova').length,0,'dead teammate: no portrait');assert.ok(xAt(-10,0).length>=2,'dead teammate: X at the death spot');mate.alive=true;
c.player.hp=0;frame();assert.equal(icon('phoenix').length,0,'dead: no own portrait');assert.ok(xAt(0,0).length>=2,'dead: X where you died');c.player.hp=100;
front.alive=false;frame();assert.equal(icon('jett').length,0,'dead enemy not drawn');front.alive=true;
// --- 7. blockout minimap (mmDyn in index.html): same icons ---
{const la=html.indexOf('function mmDyn('),lb=html.indexOf('\nfunction mmSmk(',la);assert.ok(la>0&&lb>la,'legacy mmDyn found');
 paths=[];draws=[];const k={Math,String,performance:{now:()=>t},mode:'retake',spike:{visible:false,position:{}},FV:{sp:{}},mmx:ctx,allies:[unit('Omen',5,5,0)],bots:[unit('Raze',10,0,0),unit('Skye',-20,0,0)],mmVis:null,mmLost:new Map(),
  XEC:{hex:'#ff4655'},XAC:{on:false,hex:'#3fe8ff'},xAg:u=>u.agent,mmAgC:()=>'#888',mmSmk(){},player:{x:0,z:0,hp:100},yaw:0,J:{pick:'Killjoy'},window:{},
  nmIcon:(...q)=>c.nmIcon(...q)};k.mmVis=new Set([k.bots[0]]);c.mmx=ctx;
 vm.createContext(k);vm.runInContext(html.slice(la,lb)+';globalThis.dyn=mmDyn;',k);const X=x=>x*2+160;k.dyn(X,X,2);
 const at=(ag)=>draws.filter(d=>d.art==='models/valorant/agents/portraits/'+ag+'.png');
 assert.equal(at('omen').length,1,'blockout: teammate portrait');assert.equal(at('omen')[0].ring,'#5fe4df','blockout: teal teammate ring');
 assert.equal(at('raze').length,1,'blockout: spotted enemy portrait');assert.equal(at('raze')[0].ring,'#ff4655');assert.equal(at('skye').length,0,'blockout: unspotted enemy hidden');
 assert.equal(at('killjoy').length,1,'blockout: your portrait');assert.equal(at('killjoy')[0].ring,'#ffffff');}
console.log('Minimap icons: agent portraits on team rings (you white, teammates teal / ally colour, spotted enemies red / enemy colour) with facing pointers; unspotted and fogged enemies hidden; dot fallback for missing / failed art; X for the dead; portraits cut once per agent (no per-frame Image / canvas); blockout minimap the same');
