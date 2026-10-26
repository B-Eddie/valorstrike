// Offline buy-phase bots (work/bot_variety_runtime.js xbbTick, inlined in index.html with the shared vendor/bot-brain.cjs
// buy*): the generated page's BOT VARIETY block runs in a vm over each native map's real navigation and the page's own
// collision functions (nmNear / nmHeight / nmBlocked / nmLeash taken from index.html, the shared motor as ValorantFeel) on
// the map's collision BVH (server/public/worlds/<map>, byte-identical to build-world's output from the map's
// collision.bin + patch: test-collision-parity.js). Five enemy bots and four ally bots (plus the player standing at
// spawn) buy-phase for 30 s on both sides of all six maps through the page's fiveTick (the wrapper this block installs).
// Asserted per bot: it walked (path > 4 m, ends > 2 m from its spawn spot), it never came within 0.4 m of a wall of its
// spawn (vendor/spawn-barriers.cjs, solid through the page's nmBlocked while FV.buy > 0: never inside / through one), it
// ends 0.42-2.45 m inside its route's wall (front row or up to 2 rows behind in a narrow doorway), standing clear of collision; no two
// teammates overlap when it drops (> 0.8 m), nearly all are lined up; after the drop the block's state is cleared.
//   node work/test_bot_buy_phase_offline.cjs        (BB_MAPS=ascent,bind to narrow; BB_MEASURE=1 prints only)
const fs=require('fs'),path=require('path'),vm=require('vm');const root=path.join(__dirname,'..');
const srv=path.join(root,'server'),req=require('module').createRequire(path.join(srv,'package.json')),T=req('three'),{MeshBVH}=req('three-mesh-bvh');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8'),fails=[],out=[];const ok=(c,m)=>{if(!c)fails.push(m);};
const A='// ---- BOT VARIETY ----',B='// ---- END BOT VARIETY ----',bi=html.indexOf(A),bj=html.indexOf(B,bi);if(!(bi>=0&&bj>bi))throw Error('bot variety block not in index.html');
const block=html.slice(bi,bj+B.length);if(!/function xbbTick\(/.test(block)||!/buyTick/.test(block))throw Error('buy-phase bots missing from the generated block (run python3 work/install_valorant.py)');
const line=s=>{const i=html.indexOf(s);if(i<0)throw Error('page function missing: '+s);return html.slice(i,html.indexOf('\n',i));};
const fnBlock=s=>{const i=html.indexOf(s);if(i<0)throw Error('page function missing: '+s);return html.slice(i,html.indexOf('\n}',i)+2);};
const page=[line('const NM_NONE=[];'),line('function nmCellNum(C){'),line('function nmNear(C,x,z,y,yBand){'),line('function nmHeight(C,x,z,y){'),line('var NM_Q='),fnBlock('function nmBlocked(C,x,z,r,y,height=1.8){'),line('function nmLeash(C,x,z,y,x0,z0){'),line('function nmConnected(C){')].join('\n');
const tree=k=>{const b=f=>fs.readFileSync(path.join(srv,'public/worlds',k,f)),p=b('position.bin'),ix=b('index.bin'),g=new T.BufferGeometry();g.setAttribute('position',new T.BufferAttribute(new Float32Array(p.buffer.slice(p.byteOffset,p.byteOffset+p.byteLength)),3));g.setIndex(new T.BufferAttribute(new Uint32Array(ix.buffer.slice(ix.byteOffset,ix.byteOffset+ix.byteLength)),1));const meta=JSON.parse(b('meta.json')),roots=[];for(let n=0;n<meta.roots;n++){const r=b('bvh'+n+'.bin');roots.push(r.buffer.slice(r.byteOffset,r.byteOffset+r.byteLength));}return MeshBVH.deserialize({index:g.index.array,roots},g,{setIndex:false});};
const MAPS=(process.env.BB_MAPS||'ascent,bind,breeze,haven,lotus,split').split(',');
if(!fs.existsSync(path.join(srv,'public/worlds',MAPS[0],'bvh0.bin'))){console.log('test_bot_buy_phase_offline: SKIP (no server/public/worlds collision: npm run build:worlds)');process.exit(0);}
for(const map of MAPS){
 const dir=path.join(root,'models/valorant/maps',map),meta=JSON.parse(fs.readFileSync(path.join(dir,'map.json'),'utf8')),nav=JSON.parse(fs.readFileSync(path.join(dir,'navigation.json'),'utf8'));
 const N=nav.nodes,C={key:map,meta,nav,bvh:tree(map),cells:new Map(),cellSize:2};
 const astar=(C,s,e)=>{const g=new Float64Array(N.length).fill(Infinity),pv=new Int32Array(N.length).fill(-1),cl=new Uint8Array(N.length),h=k=>Math.hypot(N[k][0]-N[e][0],N[k][2]-N[e][2]),H=[];const push=(i,v)=>{H.push([i,v]);let k=H.length-1;while(k){const p=(k-1)>>1;if(H[p][1]<=H[k][1])break;[H[p],H[k]]=[H[k],H[p]];k=p;}},pop=()=>{const r=H[0],l=H.pop();if(H.length){H[0]=l;let k=0;for(;;){let c=k*2+1;if(c>=H.length)break;if(c+1<H.length&&H[c+1][1]<H[c][1])c++;if(H[c][1]>=H[k][1])break;[H[c],H[k]]=[H[k],H[c]];k=c;}}return r[0];};
  g[s]=0;push(s,h(s));while(H.length){const a=pop();if(cl[a])continue;if(a===e){const p=[];for(let k=e;k>=0;k=pv[k])p.push(k);return p.reverse();}cl[a]=1;for(const b of nav.adj[a]){if(cl[b]||!C.playable[b])continue;const c=g[a]+Math.hypot(N[a][0]-N[b][0],N[a][2]-N[b][2])+Math.abs(N[a][1]-N[b][1])*.2;if(c<g[b]){g[b]=c;pv[b]=a;push(b,c+h(b));}}}return [];};
 for(const atkSide of [true,false]){
  const ctx={THREE:T,Math,Object,Number,Infinity,NaN,Set,Map,WeakMap,Array,JSON,String,Float32Array,Float64Array,Int32Array,Uint8Array,Uint32Array,Error,isFinite,console,performance:{now:()=>0},
   mode:'five',running:true,paused:false,XNF:0,timeLeft:100,S:{diff:'normal'},DIFF:{normal:{speed:1}},SFX:{step(){}},MP:{cl:false},
   FV:{you:atkSide?0:12,them:0,map,atk:atkSide,dm:false,buy:30,sp:null},x2:(o,x,z)=>{if(!o)return [x,z];o[0]=x;o[1]=z;return o;},
   xAng:a=>Math.atan2(Math.sin(a),Math.cos(a)),botRun:(u,walk)=>5.4*(walk?.6:1),xSmV:(u,dt,vx,vz)=>[vx,vz],nmPath:(C,s,e)=>astar(C,s,e),nmActive:()=>C,
   xGoal:()=>null};
  ctx.globalThis=ctx.window=ctx;vm.createContext(ctx);vm.runInContext(fs.readFileSync(path.join(root,'vendor/valorant-feel.js'),'utf8'),ctx);vm.runInContext(page,ctx);
  // the page's native-map blocked(): leash, collision, then the step-up check (native_maps_runtime.js wrapper, no Sage walls here)
  vm.runInContext('var blocked=function(x,z,r,y){const C=nmActive();if(Number.isFinite(y)&&!nmLeash(C,x,z,y))return true;if(!nmBlocked(C,x,z,r,y))return false;const floor=nmHeight(C,x,z,y+.32);return !(floor<=y+.32&&!nmBlocked(C,x,z,r,y+.32));};',ctx);
  vm.runInContext('nmConnected(nmActive());',ctx);N.forEach((p,i)=>{if(!C.playable[i])return;const k=Math.floor(p[0]/2)+','+Math.floor(p[2]/2);if(!C.cells.has(k))C.cells.set(k,[]);C.cells.get(k).push(i);});
  // the page's fiveTick buy branch: count down (native map: no plane clamp, the spawn walls hold everyone); the block wraps it
  ctx.fiveTick=function(dt){if(ctx.FV.buy>0){ctx.FV.buy-=dt;if(ctx.FV.buy<=0)ctx.FV.buy=0;return;}};
  // spawn spots as the page places them (native_maps_runtime.js nmPlace: near the anchor's floor, on the floor (0.15 m), clear of
  // collision, 0.9 m apart, with one exit edge a capsule can walk along; nmSegment approximated by 0.18 m capsule samples)
  const seg=(a,b)=>{const L=Math.hypot(b[0]-a[0],b[2]-a[2]);for(let t=.18;t<L;t+=.18){const x=a[0]+(b[0]-a[0])*t/L,z=a[2]+(b[2]-a[2])*t/L;let y;try{y=ctx.nmHeight(C,x,z,a[1]+.3);}catch(e){return false;}if(ctx.nmBlocked(C,x,z,.4,y))return false;}return true;};
  const placed=[],mk=(name,anchor,k)=>{const want=[anchor[0]+((k%3)-1)*1.2,anchor[2]+Math.floor(k/3)*1.1];const cand=[];for(let i=0;i<N.length;i++){if(!C.playable[i]||Math.abs(N[i][1]-anchor[1])>=1)continue;const v=(N[i][0]-want[0])**2+(N[i][2]-want[1])**2+4*(N[i][1]-anchor[1])**2;if(v<225)cand.push([v,i]);}cand.sort((a,b)=>a[0]-b[0]);let b=-1;
   for(const [,i] of cand){const n=N[i];if(placed.some(q=>Math.hypot(q[0]-n[0],q[2]-n[2])<.9))continue;const y=ctx.nmHeight(C,n[0],n[2],n[1]);if(Math.abs(y-n[1])>.15||ctx.nmBlocked(C,n[0],n[2],.43,y,1.92))continue;if(!nav.adj[i].some(j=>seg([n[0],y,n[2]],N[j])))continue;b=i;break;}
   placed.push(N[b]);
   const n=N[b];return {name,alive:true,hp:100,see:0,per:{ag:.5,fl:.5,sd:.5},g:{position:{x:n[0],y:n[1],z:n[2]},rotation:{y:0}}};};
  const enemyAnchor=atkSide?meta.defender:meta.attacker,mateAnchor=atkSide?meta.attacker:meta.defender;
  ctx.bots=['Jett','Omen','Raze','Sova','Sage'].map((n,k)=>mk('Bot '+n,enemyAnchor,k));ctx.allies=['Phoenix','Brimstone','Killjoy','Cypher'].map((n,k)=>mk('Ally '+n,mateAnchor,k+1));
  const pp=mk('You',mateAnchor,0).g.position;ctx.player={x:pp.x,y:pp.y,z:pp.z,hp:100};
  ctx.FV.sp={st:'carry',site:Object.keys(meta.sites)[0],c:atkSide?ctx.allies[0]:ctx.bots[0],x:0,z:0};
  vm.runInContext(block+'\n;globalThis.BotRoutes=BotRoutes;globalThis.BotBrain=BotBrain;',ctx);if(!ctx.SpawnBarriers)throw Error('SpawnBarriers missing from the block');ctx.window.BotRoutes=ctx.BotRoutes;ctx.window.BotBrain=ctx.BotBrain;ctx.xBotSeed=5;
  const SB=ctx.SpawnBarriers,units=ctx.bots.concat(ctx.allies),walls=u=>SB.pieces(map).filter(q=>q.side===((ctx.bots.includes(u)?!atkSide:atkSide)?'atk':'def'));
  // signed metres to the nearest wall of the bot's spawn (negative: past it)
  const sd=u=>{const p=u.g.position,n=ctx.BotBrain.buyNear(walls(u),p.x,p.z);return n.inside||n.d>=1.5?n.d:-n.d;};/* the far side of a wall line only counts next to the wall (deep in spawn a bot can sit past the extension of a doorway line) */
  const p0=new Map(units.map(u=>[u,[u.g.position.x,u.g.position.z]])),walked=new Map(units.map(u=>[u,0])),prev=new Map(units.map(u=>[u,[u.g.position.x,u.g.position.z]])),modes=new Map(),holds=new Map();let closest=Infinity,steps=0;
  while(ctx.FV.buy>0&&steps<2000){ctx.fiveTick(1/30);steps++;for(const u of units){const p=u.g.position;closest=Math.min(closest,sd(u));const q=prev.get(u);walked.set(u,walked.get(u)+Math.hypot(p.x-q[0],p.z-q[1]));prev.set(u,[p.x,p.z]);if(u.xbb){modes.set(u,u.xbb.st.mode);if(u.xbb.hold)holds.set(u,u.xbb.spot);}}}
  const tag=map+(atkSide?' (allies attack)':' (allies defend)');let pair=Infinity;for(const team of [ctx.bots,ctx.allies])for(const a of team)for(const b of team)if(a!==b)pair=Math.min(pair,Math.hypot(a.g.position.x-b.g.position.x,a.g.position.z-b.g.position.z));
  const ds=units.map(sd),lined=units.filter(u=>/^(wait|peek|hold)$/.test(modes.get(u))).length;
  out.push(`${tag}: walked ${Math.min(...walked.values()).toFixed(1)}-${Math.max(...walked.values()).toFixed(1)} m, end ${Math.min(...ds).toFixed(2)}-${Math.max(...ds).toFixed(2)} m inside, closest ${closest.toFixed(2)} m, lined up ${lined}/${units.length} (${holds.size} holding in-zone spots), teammate gap ${pair.toFixed(2)} m`);
  for(const u of units){const p=u.g.position,d=sd(u),id=tag+' '+u.name;ok(walked.get(u)>4,id+' walked '+walked.get(u).toFixed(2)+' m');ok(Math.hypot(p.x-p0.get(u)[0],p.z-p0.get(u)[1])>2,id+' ended near its spawn spot');
   const hs=holds.get(u);/* a goal inside its own zone (a defender's own site): it holds there, 1 m or less from its spot */
   if(hs)ok(Math.hypot(p.x-hs[0],p.z-hs[2])<=1,id+' holds '+Math.hypot(p.x-hs[0],p.z-hs[2]).toFixed(2)+' m from its in-zone spot '+hs.map(v=>v.toFixed(2))+' at '+[p.x,p.y,p.z].map(v=>v.toFixed(2)));
   else ok(d>=.42-1e-9&&d<=2.45,id+' ends '+d.toFixed(2)+' m inside the barrier (want 0.42-2.45) at '+[p.x,p.y,p.z].map(v=>v.toFixed(2)));ok(!ctx.nmBlocked(C,p.x,p.z,.38,p.y),id+' stands in collision at '+[p.x,p.y,p.z].map(v=>v.toFixed(2)));}
  ok(closest>=.4-1e-9,tag+': a bot came '+closest.toFixed(3)+' m from the barrier');ok(pair>.8,tag+': teammates overlap at the drop ('+pair.toFixed(2)+' m)');ok(lined>=units.length-1,tag+': lined up '+lined+'/'+units.length);
  ok(units.every(u=>u.xbb===null),tag+': buy-phase state cleared when the barrier drops');
 }
}
// the block is in the generated page (83b0d90's index.html had dropped it) and walks through the shared motor like the round's bots
ok(html.includes('function xbbStep(')&&html.includes('if(typeof fiveTick===\'function\'){const ft0=fiveTick;'),'index.html carries the buy-phase block (regenerate with work/install_valorant.py)');
ok(/VFm\.groundMove\(Pm,vx\*run,vz\*run,run\/VFm\.C\.accelTime,h\)/.test(html),'buy-phase walking accelerates / stops through the shared motor (groundMove), as xSmV');
console.log('Buy-phase bots (offline): '+out.join('; '));
if(!process.env.BB_MEASURE){if(fails.length){console.error(fails.join('\n'));process.exit(1);}console.log('test_bot_buy_phase_offline: OK');}
