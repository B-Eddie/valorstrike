// Rope ascenders on the page (work/rope_runtime.js, the ROPE ASCENDERS block of the generated index.html), with the real Split
// collision / navigation (the server's prebuilt world) and the shared motor (vendor/valorant-feel.js):
//  1. wiring: the block is the generated copy of rope_runtime.js and the last block; nmEnsure calls nmRopes before nmConnected;
//     moveP passes world.ropes / use / f / pitch and rope spread; the online input carries u.
//  2. nmRopes: C.ropes = the motor's 7 Split ropes, the same nav links as the server world (keys equal), the Vent room floor joins
//     the playable set (page nmConnected), A* (page nmPath) routes over ropes, nmClimbOk passes rope links; meshes: 7 cables from
//     the lower floor to 2.3 m above the upper floor (or under the ceiling), 0.3 m toward the ledge, housings + wall brackets.
//  3. offline bots: a bot driven by the page's nmNext / xStep (wrapped) walks to every rope link (14: 7 ropes up and down), grabs,
//     climbs with the motor and ends on the far floor; the stall breakers never ban a rope link; a stale hanging bot is let go.
//     A bot with an enemy in sight fights from the rope (xStep hands the frame to the fire block, xSmV no walk, bSpread rope
//     state) as a server bot; the P2P host keeps a native map's heights (mpHostY: nav span, legacy 0-8 m).
//  4. online: row [25] -> u.rope (fog row -> 0; [24] = Blade Storm knives); P2P host rows carry [25] (neutral fill); P2P client 'in' carries rp, the host
//     reads it; a tapped F rides one input message; an eased reconcile keeps the player on the rope.
//  5. climb pose: last xUbPost wrapper puts the support hand on the cable and bends the knees, xUbPre undoes it exactly; the TP
//     gait functions are not touched by the block.
//  6. prompt "F Grab rope" / "F Let go", F at a rope cancels the inspect; ropes on the minimap.
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict');
const root=path.join(__dirname,'..'),html=fs.readFileSync(path.join(root,'index.html'),'utf8'),src=fs.readFileSync(path.join(__dirname,'rope_runtime.js'),'utf8');
const A='// ---- ROPE ASCENDERS ----',Z='// ---- END ROPE ASCENDERS ----',i0=html.indexOf(A),i1=html.indexOf(Z,i0);assert(i0>0&&i1>i0,'rope block in index.html');
const block=html.slice(i0,i1+Z.length);assert.equal(block,src.trimEnd(),'generated block == work/rope_runtime.js');
assert(html.indexOf('// ---- END ENEMY INFO ----')<i0&&html.indexOf('xReady = true; // every mode')>i1,'rope block is the last block');
assert.equal(html.split(A).length,2,'one rope block');
assert(/if\(typeof nmRopes==='function'\)nmRopes\(C,root\);[^\n]*nmConnected\(C\)/.test(html),'nmEnsure: nmRopes before nmConnected');
assert(html.includes('ropes:native&&native.ropes||null}')&&html.includes('use:!!kk.KeyF,f:(kk.KeyW?1:0)-(kk.KeyS?1:0),pitch:'),'moveP: world.ropes + use / f / pitch');
assert(html.includes('rope:B?B.rope||0:P.rope||0'),'gSpread: rope state');assert(html.includes(",u:kk.KeyF?1:0"),'online input carries u');
for(const g of ['xUbAnim','xUbLoco','xUbW','xVisB'])assert(!new RegExp('\\b'+g+'\\s*=').test(block),'block does not touch '+g);
const vendor=fs.readFileSync(path.join(root,'vendor/valorant-feel.js'),'utf8');assert.equal(vendor,fs.readFileSync(path.join(root,'server/src/motor.cjs'),'utf8'),'motor pair identical');
const nmSrc=fs.readFileSync(path.join(__dirname,'native_maps_runtime.js'),'utf8'),grip=fs.readFileSync(path.join(__dirname,'grip_runtime.js'),'utf8');
const fn=(text,name)=>{const a=text.indexOf('function '+name+'(');assert(a>=0,name);const lines=text.slice(a).split('\n'),out=[];let d=0;for(const l of lines){out.push(l);for(const ch of l){if(ch==='{')d++;else if(ch==='}')d--;}if(d<=0)break;}return out.join('\n');};
(async()=>{
const {loadWorld}=await import(path.join(root,'server/src/world.js'));
const assets={fetch:async r=>new Response(fs.readFileSync(path.join(root,'server/public',new URL(r.url).pathname)))};
const W=await loadWorld(assets,'split');
const THREE=require(path.join(root,'server/node_modules/three/build/three.cjs'));
const listeners=[],els=[];let T=0;
const doc={createElement:()=>{const kids=[{textContent:''},{textContent:''}];const e={style:{display:''},setAttribute(){},set innerHTML(v){},get lastChild(){return kids[1];},id:''};els.push(e);return e;},body:{append(){}}};
const ctx={Math,Number,Infinity,NaN,Map,Set,Array,Object,JSON,Uint8Array,Int32Array,Float32Array,Float64Array,Error,console,THREE,document:doc,performance:{now:()=>T},
 addEventListener:(t,f)=>listeners.push([t,f]),running:true,paused:false,bots:[],allies:[],player:{x:0,y:0,z:0,hp:100},MP:{me:1,role:null},VM:{ins:0},FV:{menu:false},NM:{routeCache:new Map()},XHK:[],
 groundAt:(x,z,r,y)=>W.ground(x,z,y),nmBlocked:(C,x,z,r,y,h)=>W.blocked(x,z,r,y,h)};
ctx.window=ctx.globalThis=ctx;vm.createContext(ctx);vm.runInContext(vendor,ctx);assert(ctx.ValorantFeel&&ctx.ValorantFeel.ROPES,'motor in the page context');
const pre=`
function nmClimbOk(C,a,b){const N=C.nav.nodes;return N[b][1]-N[a][1]<=.6;}
${nmSrc.split('\n').find(l=>l.startsWith('var NM_Q='))}
${fn(nmSrc,'nmConnected')}
${fn(nmSrc,'nmPath')}
function nmNear3(x,z,y){return __near(x,z,y);}
function nmNext(C,u,gx,gz){const p=u.g.position,N=C.nav.nodes;const s=nmNear3(p.x,p.z,p.y),e=nmNear3(gx,gz,u.gy);const path=nmPath(C,s,e,u.xb);if(path.length<2)return [gx,gz];for(const i of path){const n=N[i];if(Math.hypot(n[0]-p.x,n[2]-p.z)>0.6&&Math.abs(n[1]-p.y)<1.5)return [n[0],n[2]];}return [gx,gz];}
function xStep(u,dt){return false;}
function xSmV(u,dt,vx,vz,speed){return [vx,vz];}
var __bs=[];function bSpread(b,w,W,dir,d,D){__bs.push({sf:b.sf,mv:b.mv,rope:b.rope});}
function botRun(u,walk){return 5.4*(walk?.6:1);}
var __C=null;function nmActive(){return __C;}
var __rows=[];function mpCliSnap(m){}
function mpEnts(){return __rows.map(r=>r.slice());}
var __sent=[];function mpSend(conn,m){__sent.push(m);}
var __host=[];function mpHostMsg(c,m){__host.push(m);}
function netInputMsg(kk){return {t:'in',u:kk&&kk.KeyF?1:0};}
var __corr=null;function netCorrect(dt){if(__corr){player.y+=__corr;__corr=null;}}
function xUbPre(M){}function xUbPost(M){}
var mmx=null,MM={width:200,height:200};function nmMapProjection(C,W,H){return {X:x=>x,Z:z=>z};}function nmMinimap(C){nmMinimap.last=performance.now()+1;nmMinimap.cw=200;}
var XGRIP={};
${fn(grip,'xgWorldQ')}
${fn(grip,'xgSetWorldQ')}
${fn(grip,'xgIK')}
`;
ctx.__near=(x,z,y)=>W.near(x,z,y);
vm.runInContext(pre,ctx);vm.runInContext(block,ctx);
// 2. nmRopes
const nav=JSON.parse(fs.readFileSync(path.join(root,'models/valorant/maps/split/navigation.json'),'utf8'));
const C={key:'split',nav,bvh:{raycastFirst:(ray)=>{const d=W.ray([ray.origin.x,ray.origin.y,ray.origin.z],[ray.direction.x,ray.direction.y,ray.direction.z]);return d<Infinity?{distance:d}:null;}}};
const group=new THREE.Group();ctx.nmRopes(C,group);ctx.nmConnected(C);ctx.__C=C;
{const r=C.ropes[0],d=ctx.xroRay(C,[r.x,r.y0+1,r.z],[0,-1,0],50);assert(typeof d==='number'&&d>0&&d<50,'xroRay returns the distance to the floor under a rope top ('+d+')');assert.equal(ctx.xroRay(C,[r.x,r.y0+1,r.z],[0,-1,0],0.01),Infinity,'xroRay: beyond max -> Infinity');}
assert.equal(C.ropes.length,7,'7 Split ropes');assert.equal(C.ropes,ctx.ValorantFeel.ROPES.split,'C.ropes = the motor ROPES');
assert.deepEqual([...C.ropeLinks.keys()].sort(),[...W.ropeLinks.keys()].sort(),'page rope links == server world rope links');
for(const [k,l] of C.ropeLinks)assert(nav.adj[l.a].includes(l.b),'nav link '+k);
{const C2={key:'ascent',nav:{nodes:[[0,0,0]],adj:[[]]}};ctx.nmRopes(C2,null);assert.equal(C2.ropes,null,'no ropes on Ascent');assert.equal(C2.ropeLinks.size,0);}
const N=nav.nodes,vent=W.near(13.5,-12,6.5);assert(C.playable[vent],'Vent room floor playable on the page (reached by rope)');
for(let i=0;i<N.length;i++)if(W.allowed.has(i))assert(C.playable[i],'server playable node '+i+' playable on the page');
{const p=ctx.nmPath(C,vent,W.near(10,-10,10.5));assert(p.length&&p.some((a,i)=>C.ropeLinks.has(a+'>'+p[i+1])),'page A*: Vent room -> Mid Vent over a rope');
 const q=ctx.nmPath(C,W.near(39,14,3.05),W.near(44,13.5,7));assert(q.some((a,i)=>C.ropeLinks.has(a+'>'+q[i+1])),'page A*: Sewer -> A Lobby over a rope');
 const [k0,l0]=[...C.ropeLinks][0];assert(ctx.nmClimbOk(C,l0.a,l0.b),'nmClimbOk passes a rope link');}
const g=group.children.find(o=>o.name==='native-ropes');assert(g,'rope group on the map root');
const cables=g.children.filter(o=>o.name==='rope-cable'),housings=g.children.filter(o=>o.name==='rope-housing'),brackets=g.children.filter(o=>o.name==='rope-bracket');
assert.equal(cables.length,7);assert.equal(housings.length,7);
C.ropes.forEach((r,k)=>{const s=C.ropeSpec[k],c=cables[k];c.geometry.computeBoundingBox();const h=c.geometry.boundingBox.max.y-c.geometry.boundingBox.min.y,bot=c.position.y-h/2,top=c.position.y+h/2;
 assert(Math.abs(bot-r.y0)<1e-6,r.name+' cable from the lower floor');assert(top<=r.y1+2.3+1e-6&&top>r.y1+1.2,r.name+' cable top '+top.toFixed(2)+' (upper floor '+r.y1+')');
 assert(Math.abs(Math.hypot(s.cx-r.x,s.cz-r.z)-.3)<1e-9,r.name+' cable 0.3 m toward the ledge');
 assert(W.ray([s.cx,r.y1+.5,s.cz],[0,1,0])>top-(r.y1+.5)+.1-1e-6,r.name+' cable top under the ceiling');
 for(let y=r.y0+.1;y<top;y+=.25)assert(!W.blocked(s.cx,s.cz,.02,y,.2),r.name+' cable clear of collision at y '+y.toFixed(2));});
console.log('ropes offline: nmRopes 7 ropes, '+C.ropeLinks.size+' links = server, playable = server, meshes ('+brackets.length+' wall brackets)');
// 3. offline bots on every rope link
const R=C.ropes;let climbed=0;const WW={ground:W.ground,blocked:W.blocked,leash:W.leash,ceiling:W.ceiling};
for(const L of C.ropeLinks.values()){const r=R[L.k],a=N[L.a],b=N[L.b];let st=-1,bd=Infinity;
 for(let i=0;i<N.length;i++){if(!C.playable[i]||Math.abs(N[i][1]-a[1])>.3)continue;const d=Math.hypot(N[i][0]-a[0],N[i][2]-a[2]);if(d>2.5&&d<4&&d<bd&&ctx.nmPath(C,i,L.a).length){bd=d;st=i;}}assert(st>=0,'start node for '+r.name);
 const u={name:'Bot',alive:true,g:{position:{x:N[st][0],y:N[st][1],z:N[st][2]},rotation:{y:0}},gy:b[1]};ctx.bots=[u];ctx.NM.routeCache.clear();
 // the goal: 3 m past the far node on its floor, so the route ends past the rope
 let gi=L.b,gd=0;for(let i=0;i<N.length;i++){if(!C.playable[i]||Math.abs(N[i][1]-b[1])>.3)continue;const d=Math.hypot(N[i][0]-b[0],N[i][2]-b[2]);if(d>gd&&d<3.5&&ctx.nmPath(C,L.b,i).length>1){gd=d;gi=i;}}const G=N[gi];
 let used=false,ok=false,banned=0;const dt=1/60;for(let t=0;t<14;t+=dt){T+=dt*1000;
  if(!ctx.xStep(u,dt)){const p=u.g.position,[tx,tz]=ctx.nmNext(C,u,G[0],G[2]);const ex=tx-p.x,ez=tz-p.z,ed=Math.hypot(ex,ez);/* walking: the shared motor (wall slide, steps), as server bots; offline bots walk the same speeds */if(!u.P||Math.abs(u.P.x-p.x)+Math.abs(u.P.y-p.y)+Math.abs(u.P.z-p.z)>1e-6)u.P={x:p.x,y:p.y,z:p.z,vx:0,vy:0,vz:0,air:false,ch:0};const P=u.P;ctx.ValorantFeel.step(P,{x:ed>.3?ex/ed:0,z:ed>.3?ez/ed:0,speed:5.4},dt,WW);p.x=P.x;p.y=P.y;p.z=P.z;}
  if(u.rope)used=true;if(u.xb)for(const k of u.xb.keys())if(C.ropeLinks.has(k))banned++;
  const p=u.g.position;if(used&&!u.rope&&u.xk==null&&Math.abs(p.y-b[1])<.3&&Math.hypot(p.x-b[0],p.z-b[2])<2.5){ok=true;break;}}
 assert(used,'bot grabbed '+r.name+(L.up?' (up)':' (down)'));assert(ok,'bot on the '+(L.up?'upper':'lower')+' floor of '+r.name+' at '+[u.g.position.x,u.g.position.y,u.g.position.z].map(v=>v.toFixed(2)));assert.equal(banned,0,'no rope link banned');
 assert(!u.rope&&u.xk==null&&!u.xrm,'rope state cleared');climbed++;}
// stall breakers: a rope ban / streak on a link is scrubbed
{const [k,l]=[...C.ropeLinks][0],u={alive:true,g:{position:{x:N[l.a][0],y:N[l.a][1],z:N[l.a][2]},rotation:{y:0}},gy:N[l.b][1],xb:new Map([[k,T+30000]]),xfE:k,xf:2};ctx.nmNext(C,u,N[l.b][0],N[l.b][2]);assert(!u.xb.has(k)&&!u.xfE,'rope link ban and streak scrubbed');}
// stale: a hanging bot whose rope frames stopped is let go
{const u={alive:true,xk:-1,xrm:{rope:1,x:0,y:0,z:0},rope:1,xrmT:5,g:{position:{x:0,y:0,z:0},rotation:{y:0}}};ctx.bots=[u];const hook=ctx.XHK.find(f=>f.name==='xroStale');for(let n=0;n<22;n++)hook();assert(u.xk==null&&!u.xrm&&!u.rope,'stale hanging bot let go');ctx.bots=[];}
console.log('ropes offline: bots climbed '+climbed+' rope links (up and down) through nmNext / xStep');
// fighting from the rope (= server: ropeBot keeps the fire, simulation.js fires at |horizontal v| <= 1.6 with the rope spread)
{const k=3,r=R[k],u={name:'Bot',alive:true,w:'Vandal',g:{position:{x:r.x,y:r.y0,z:r.z},rotation:{y:0}},xrq:{k,up:1,b:0,at:T}},dt=1/60;ctx.bots=[u];
 assert.equal(ctx.xStep(u,dt),true,'grab: the rope moves the bot');assert.equal(u.rope,k+1);assert(!u.xroF);
 u.xSe=true;const y0=u.g.position.y;let fr=0;for(let n=0;n<6;n++){T+=dt*1000;if(ctx.xStep(u,dt)===false)fr++;}
 assert.equal(fr,6,'an enemy in sight: xStep hands the frame to the aim / fire block');assert(u.xroF&&u.rope===k+1,'still on the rope');assert(u.g.position.y>y0+.1,'still climbing while it fights ('+(u.g.position.y-y0).toFixed(2)+' m)');
 u.smMotor={vx:3,vz:1};const v=ctx.xSmV(u,dt,1,0,5.4);assert.deepEqual([v[0],v[1],u.smMotor.vx,u.smMotor.vz],[0,0,0,0],'no walking on the rope (horizontal speed 0: botStopped passes, as the server)');
 u.sf=0;u.mv=false;ctx.__bs.length=0;ctx.bSpread(u,'Vandal',{},null,10,{});const b=ctx.__bs[0];assert(b.rope===k+1&&b.mv&&b.sf>.5,'rope spread: climbing speed (sf '+b.sf.toFixed(2)+') with u.rope');assert(u.sf===0&&u.mv===false,'sf / mv restored');
 assert(Math.abs(u.xrm.sf-Math.abs(u.xrm.vy)/5.4)<1e-9,'rope sf = climb speed / the bot run speed (server input.speed)');
 u.xSe=false;T+=dt*1000;assert.equal(ctx.xStep(u,dt),true,'nothing in sight: the rope frame again');assert(!u.xroF);assert.deepEqual([...ctx.xSmV(u,dt,1,0,5.4)],[1,0],'xSmV untouched off the fight frame');
 const w={alive:true,xSe:true,g:{position:{x:0,y:0,z:0},rotation:{y:0}}};assert.equal(ctx.xStep(w,dt),false);assert(!w.xroF,'off a rope: no fight frame');ctx.bots=[];}
// P2P host height: the native map's nav span, not 0-8 m (the Vent / B Tower climbs)
{vm.runInContext(fn(html,'mpHostY'),ctx);let lo=Infinity,hi=-Infinity;for(const p of N){lo=Math.min(lo,p[1]);hi=Math.max(hi,p[1]);}
 assert.equal(ctx.mpHostY(10.5),10.5,'Vent ledge height kept');assert.equal(ctx.mpHostY(12.7),12.7,'B Tower height kept');assert.equal(ctx.mpHostY(500),hi+4);assert.equal(ctx.mpHostY(-500),lo-.5);
 const c0=ctx.__C;ctx.__C=null;assert.equal(ctx.mpHostY(10.5),8,'legacy maps: 0-8 m');assert.equal(ctx.mpHostY(-1),0);ctx.__C=c0;}
console.log('ropes offline: bots fight from the rope (fire frame, no walk, rope spread); P2P host height = nav span');
// 4. online
{const a={nid:5,alive:true},b={nid:6,alive:true};ctx.bots=[a];ctx.allies=[b];const row=(id,k,fog)=>{const e=new Array(26).fill(0);e[0]=id;e[22]=fog?1:0;e[24]=5;e[25]=k;return e;};
 ctx.mpCliSnap({u:[row(5,3),row(6,7,1),row(1,2)]});assert.equal(a.rope,3,'row [25] -> u.rope');assert.equal(b.rope,0,'fog row: no rope');assert(!ctx.player.rope,'own row ignored (predicted)');
 ctx.mpCliSnap({u:[row(5,0)]});assert.equal(a.rope,0,'off the rope');
 ctx.__rows=[[0,0,'host','Jett',1,2,3,0,100,50,1,'Vandal',1,0,0],[5,1,'b','Sage',1,2,3,0,100,50,1,'Vandal',0,0,0],[6,0,'c','Sova',1,2,3,0,100,50,1,'Vandal',0,0,0]];ctx.player.rope=4;b.rope=2;
 const E=ctx.mpEnts();assert.equal(E[0].length,26);assert.equal(E[0][25],4,'host player row [25]');assert.equal(E[0][24],0,'neutral knives [24]');assert.equal(E[0][21],-1,'neutral regen');assert.equal(E[0][15],null,'neutral ammo');assert.equal(E[0][22],0);
 assert.equal(E[1].length,15,'off-rope rows stay 15 long');assert.equal(E[2][25],2,'host bot / client row [25]');
 ctx.MP.role='client';ctx.mpSend(null,{t:'in',x:1,y:2,z:3});assert.equal(ctx.__sent.pop().rp,4,'P2P client in carries rp');ctx.player.rope=0;ctx.mpSend(null,{t:'in',x:1,y:2,z:3});assert.equal(ctx.__sent.pop().rp,undefined);ctx.MP.role=null;
 const cu={};ctx.mpHostMsg({u:cu},{t:'in',rp:6});assert.equal(cu.rope,6,'host reads rp');ctx.mpHostMsg({u:cu},{t:'in',rp:99});assert.equal(cu.rope,0,'bad rp rejected');ctx.mpHostMsg({u:cu},{t:'in'});assert.equal(cu.rope,0);
 for(const [t,f] of listeners)if(t==='keydown')f({code:'KeyF',repeat:false});assert.equal(ctx.netInputMsg({}).u,1,'tapped F rides the next input');assert.equal(ctx.netInputMsg({}).u,0,'once');
 ctx.player.x=1;ctx.player.y=5;ctx.player.z=2;ctx.player.rope=1;ctx.player.ropeAt=[1,5,2];vm.runInContext('__corr=.04',ctx);ctx.netCorrect(.016);assert.deepEqual([...ctx.player.ropeAt],[1,5.04,2],'eased correction re-anchors the rope');ctx.player.rope=0;ctx.player.ropeAt=null;ctx.bots=[];ctx.allies=[];}
console.log('ropes offline: row [25], P2P rows / rp, F latch, reconcile anchor OK');
// 5. climb pose on a synthetic rig
{const k=1,r=R[k],s=C.ropeSpec[k],m=new THREE.Group();m.position.set(r.x,r.y0+1,r.z);m.rotation.y=Math.atan2(r.ex-r.x,r.ez-r.z);
 const sc=new THREE.Group();m.add(sc);const bone=(name,parent,x,y,z)=>{const b=new THREE.Bone();b.name=name;b.position.set(x,y,z);parent.add(b);return b;};
 const pel=bone('Pelvis',sc,0,1,0),sp=bone('Spine4',pel,0,.5,0),ls=bone('L_Shoulder',sp,.2,0,0),le=bone('L_Elbow',ls,.28,0,0),lh=bone('L_Hand',le,.26,0,0);
 for(const [n,x] of [['L',.1],['R',-.1]]){const h=bone(n+'_Hip',pel,x,0,0),kn=bone(n+'_Knee',h,0,-.45,0);bone(n+'_Foot',kn,0,-.43,0);}
 const M={valorant:1,m,sx:{sc,b:{}},unit:{rope:k+1}};m.updateMatrixWorld(true);const before=[];sc.traverse(o=>{if(o.isBone)before.push([o,o.quaternion.clone()]);});
 ctx.xUbPost(M);m.updateMatrixWorld(true);const hp=lh.getWorldPosition(new THREE.Vector3()),sh=ls.getWorldPosition(new THREE.Vector3());
 assert(Math.hypot(hp.x-s.cx,hp.z-s.cz)<.06&&Math.abs(hp.y-(sh.y+.32))<.06,'support hand on the cable '+hp.toArray().map(v=>v.toFixed(2)));
 for(const n of ['L','R']){const h=sc.getObjectByName(n+'_Hip').getWorldPosition(new THREE.Vector3()),f=sc.getObjectByName(n+'_Foot').getWorldPosition(new THREE.Vector3());assert(h.distanceTo(f)<.8,n+' knee bent (hip-foot '+h.distanceTo(f).toFixed(2)+' < 0.88 leg)');}
 ctx.xUbPre(M);for(const [o,q] of before)assert(o.quaternion.angleTo(q)<1e-6,o.name+' restored by xUbPre');
 M.unit.rope=0;ctx.xUbPost(M);for(const [o,q] of before)assert(o.quaternion.angleTo(q)<1e-6,'no pose off the rope');}
console.log('ropes offline: climb pose (hand on rope, knees bent) and exact restore OK');
// 6. prompt / inspect / minimap
{const r=R[1],P=ctx.player;Object.assign(P,{x:r.x-.5,y:r.y0,z:r.z,hp:100,rope:0,ropeCd:0});const hook=ctx.XHK.find(f=>f.name==='xroPrompt');hook();const el=ctx.xRopes.el;assert(el&&el.style.display==='flex'&&el.lastChild.textContent==='Grab rope','F Grab rope in reach');
 ctx.VM.ins=2;for(const [t,f] of listeners)if(t==='keydown')f({code:'KeyF',repeat:false});assert.equal(ctx.VM.ins,0,'F at a rope does not inspect');
 P.rope=2;hook();assert.equal(el.lastChild.textContent,'Let go');P.rope=0;P.x=0;P.z=0;P.y=0;hook();assert.equal(el.style.display,'none','no prompt away from ropes');
 let arcs=0;ctx.mmx={save(){},restore(){},beginPath(){},arc(){arcs++;},fill(){},stroke(){}};ctx.nmMinimap(C);assert.equal(arcs,7,'7 ropes on the minimap');}
console.log('ropes offline: prompt, inspect guard, minimap markers OK');
console.log('ropes offline: all checks passed');
})().catch(e=>{console.error(e);process.exit(1);});
