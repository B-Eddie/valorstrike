// Spawn walls cannot be got over on the page (user: "Make barriers higher in buy phase, I can jump past one in Haven").
// Valorant's buy-phase barriers stand to the ceiling / sky: no jump, crouch-jump, jump off a box / ledge / step beside them,
// no ability. With the generated page's own collision (nmHeight / nmBlocked / nmLeash / nmNear from index.html, the native
// map BVH from server/public/worlds) and the shared motor (vendor/valorant-feel.js step / dash / dashStep), FV.buy > 0 in a 5v5:
//  1. static: every wall piece of all six maps reaches SKY_MIN = the map's highest valid navigation node + 8 m (above any
//     floor a player reaches + an Updraft's 5.3 m apex + a jump);
//  2. ability casts are refused in the buy phase (page jKey: every agent, C / Q / E / X; the server's castAbility0 refuses
//     them too: server/test-spawn-barrier-leaks.js) - so Updraft / Tailwind / Satchel / teleports never start there;
//  3. reach flood (server/tools/spawn-barrier-probe.mjs reach(), run on the page's collision): from the playable nodes of
//     each team's own zone, walking, stepping / jumping up 1.45 m, dropping off any ledge, crouched, on the leash - no cell
//     ends up in the neutral area / the other team's zone past a wall;
//  4. ledge / ability runs (ledgeStarts(): the highest reachable places 0.6 - 4 m in from each wall, boxes / ledges / stairs /
//     roofs beside it) at 30 fps: run at the wall with jump spam, crouch-jump spam, an Updraft launch (vy = sqrt(2 * 18 * 6))
//     then forward + jumps, a Tailwind dash (11 m / 0.45 s) straight at it - none gets out.
// Red on 1588582 (tops 3.4 - 6.4 m over the doorway: Haven attacker east door jumped from its ledge, roofs beside walls;
// Haven defenders' west corridor had no wall at all). Default: 8 starts per panel (~1-2 min); SBL_FULL=1: 16; SBL_MAPS=haven.
const fs=require('fs'),path=require('path'),vm=require('vm'),{pathToFileURL}=require('url');const root=path.join(__dirname,'..');
const srv=path.join(root,'server'),req=require('module').createRequire(path.join(srv,'package.json')),T=req('three'),{MeshBVH}=req('three-mesh-bvh');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8'),fails=[],out=[];
const line=s=>{const i=html.indexOf(s);if(i<0)throw Error('page function missing: '+s);return html.slice(i,html.indexOf('\n',i));};
const fnBlock=s=>{const i=html.indexOf(s);if(i<0)throw Error('page function missing: '+s);return html.slice(i,html.indexOf('\n}',i)+2);};
const sbSrc=fs.readFileSync(path.join(root,'vendor/spawn-barriers.cjs'),'utf8').trimEnd();if(!html.includes(sbSrc))throw Error('index.html does not carry vendor/spawn-barriers.cjs verbatim (run python3 work/install_valorant.py)');
const page=[line('const NM_NONE=[];'),line('function nmCellNum(C){'),line('function nmNear(C,x,z,y,yBand){'),line('function nmHeight(C,x,z,y){'),line('var NM_Q='),fnBlock('function nmBlocked(C,x,z,r,y,height=1.8){'),line('function nmLeash(C,x,z,y,x0,z0){'),line('function nmConnected(C){')].join('\n');
const tree=k=>{const b=f=>fs.readFileSync(path.join(srv,'public/worlds',k,f)),p=b('position.bin'),ix=b('index.bin'),g=new T.BufferGeometry();g.setAttribute('position',new T.BufferAttribute(new Float32Array(p.buffer.slice(p.byteOffset,p.byteOffset+p.byteLength)),3));g.setIndex(new T.BufferAttribute(new Uint32Array(ix.buffer.slice(ix.byteOffset,ix.byteOffset+ix.byteLength)),1));const meta=JSON.parse(b('meta.json')),roots=[];for(let n=0;n<meta.roots;n++){const r=b('bvh'+n+'.bin');roots.push(r.buffer.slice(r.byteOffset,r.byteOffset+r.byteLength));}return MeshBVH.deserialize({index:g.index.array,roots},g,{setIndex:false});};
const FULL=!!process.env.SBL_FULL,PER=FULL?16:10,MAPS=(process.env.SBL_MAPS||'ascent,bind,breeze,haven,lotus,split').split(','),SKY_ABOVE=8;
if(!fs.existsSync(path.join(srv,'public/worlds',MAPS[0],'bvh0.bin'))){console.log('test_spawn_barrier_tall_client: SKIP (no server/public/worlds collision: npm run build:worlds)');process.exit(0);}
// 2. buy phase (the owner, 2026-11-07: the actual VALORANT buy phase): with the buy menu open every ability key is swallowed; with it
//    closed only the XBPA setup abilities reach the agent's handler (Omen's Shrouded Step and Chamber's Rendezvous included: their
//    targets stay on the spawn side, xBpSide); every other key is refused as the server's castAbility0 (BUY_PHASE)
{const src=['const XBPA =','function xBpOn()','function xBpOk(','function xBpNo('].map(line).join('\n')+'\n'+fnBlock('function jKey(code) {');const picks=['Phoenix','Sova','Sage','Reyna','Omen','Killjoy','Raze','Skye','Breach','Chamber','Cypher'];let said=0,casts=0;const cast=[];
 const ctx={Math,mode:'five',running:true,FV:{buy:30,menu:true,dm:false},player:{hp:100,vy:0,y:7,x:0,z:0},J:{pick:'Jett',q:2,c:2,e:2,x:7,cd:{q:0,c:0,e:0,x:0}},jOn:()=>true,say:()=>{said++;},sgNo:()=>{},blip:()=>{},SFX:{ab:()=>{casts++;}}};
 for(const k of picks)ctx[{Phoenix:'phKey',Sova:'svKey',Sage:'sgKey',Reyna:'ryKey',Omen:'okKey',Killjoy:'okKey',Raze:'rsKey',Skye:'rsKey',Breach:'bcKey',Chamber:'bcKey',Cypher:'cyKey'}[k]]=c=>{casts++;cast.push(ctx.J.pick+' '+c);};
 vm.createContext(ctx);vm.runInContext(src,ctx);const XBPA=vm.runInContext('XBPA',ctx);
 for(const p of picks.concat('Jett'))for(const code of ['KeyC','KeyQ','KeyE','KeyX']){ctx.J.pick=p;const r=vm.runInContext('jKey('+JSON.stringify(code)+')',ctx);if(r!==true)fails.push('jKey '+p+' '+code+' with the buy menu open did not take the key');}
 if(casts||said||ctx.player.vy!==0)fails.push('an ability cast with the buy menu open ('+casts+' casts, '+said+' notes, vy '+ctx.player.vy+')');
 ctx.FV.menu=false;for(const p of picks)for(const code of ['KeyC','KeyQ','KeyE','KeyX']){ctx.J.pick=p;vm.runInContext('jKey('+JSON.stringify(code)+')',ctx);}
 const want=[];for(const p of picks)for(const code of ['KeyC','KeyQ','KeyE','KeyX'])if((XBPA[p]||'').includes(code[3].toLowerCase()))want.push(p+' '+code);
 if(JSON.stringify(cast)!==JSON.stringify(want))fails.push('buy-phase keys reaching their handler: '+JSON.stringify(cast)+', want '+JSON.stringify(want));if(said!==picks.length*4-want.length)fails.push('buy-phase refused keys: '+said+' notes, want '+(picks.length*4-want.length));
 out.push('buy phase: menu open swallows 48 ability keys; menu closed casts the '+cast.length+' XBPA keys, refuses the rest');}
(async()=>{const PR=await import(pathToFileURL(path.join(srv,'tools/spawn-barrier-probe.mjs')).href);
for(const map of MAPS){const T0=Date.now();
 const dir=path.join(root,'models/valorant/maps',map),meta=JSON.parse(fs.readFileSync(path.join(dir,'map.json'),'utf8')),nav=JSON.parse(fs.readFileSync(path.join(dir,'navigation.json'),'utf8'));
 const N=nav.nodes,C={key:map,meta,nav,bvh:tree(map),cells:new Map(),cellSize:2};
 const ctx={THREE:T,Math,Object,Number,Infinity,NaN,Set,Map,WeakMap,Array,JSON,String,Float32Array,Float64Array,Int32Array,Uint8Array,Uint32Array,Error,isFinite,console,performance:{now:()=>0},
  mode:'five',running:true,paused:false,MP:{cl:false},FV:{map,atk:true,dm:false,buy:30},nmActive:()=>C};
 ctx.globalThis=ctx.window=ctx;vm.createContext(ctx);vm.runInContext(fs.readFileSync(path.join(root,'vendor/valorant-feel.js'),'utf8'),ctx);vm.runInContext(sbSrc,ctx);vm.runInContext(page,ctx);
 vm.runInContext('nmConnected(nmActive());',ctx);N.forEach((p,i)=>{if(!C.playable[i])return;const k=Math.floor(p[0]/2)+','+Math.floor(p[2]/2);if(!C.cells.has(k))C.cells.set(k,[]);C.cells.get(k).push(i);});
 const SB=ctx.SpawnBarriers,VF=ctx.ValorantFeel,nmHeight=(x,z,y)=>ctx.nmHeight(C,x,z,y),nmBlocked=(x,z,r,y,h)=>ctx.nmBlocked(C,x,z,r,y,h),nmLeash=(x,z,y,x0,z0)=>ctx.nmLeash(C,x,z,y,x0,z0);
 const ground=(x,z,y)=>{try{return nmHeight(x,z,y);}catch(e){return NaN;}};
 const world={ground,blocked:nmBlocked,leash:nmLeash,ceiling:(x,z,low,high)=>{const ray=new T.Ray(new T.Vector3(x,low+.01,z),new T.Vector3(0,1,0)),hit=C.bvh.raycastFirst(ray,T.DoubleSide);return !!hit&&hit.distance<high-low;},ropes:null};
 // 1. static: tops to the sky
 let navTop=-Infinity;N.forEach((p,i)=>{if(!nav.valid||nav.valid[i])navTop=Math.max(navTop,p[1]);});const need=navTop+SKY_ABOVE;
 for(const p of SB.pieces(map))if(p.y1<need)fails.push(map+' '+p.side+' wall ('+p.ax+','+p.az+')-('+p.bx+','+p.bz+'): top '+p.y1+' < '+need.toFixed(2)+' (highest floor '+navTop.toFixed(2)+' + '+SKY_ABOVE+' m)');
 // 3. reach flood on the page's collision
 const W={nav};const keep={};const R=PR.reach(W,map,SB,{keep,blocked:nmBlocked,ground,leash:(x,z,y)=>nmLeash(x,z,y),seedOk:i=>!!C.playable[i]});
 if(R.leaks.length){const by={};for(const l of R.leaks){const k=l.side+' '+l.zone+' near ('+Math.round(l.at[0])+','+Math.round(l.at[2])+')';(by[k]=by[k]||[]).push(l);}for(const k in by)fails.push(map+' reach: '+k+': '+by[k].length+' cells out, e.g. '+JSON.stringify(by[k][0]));}
 // 4. ledge / ability runs, page motor at 30 fps
 const Z=PR.zoneOf?null:null;const ZONES=JSON.parse(fs.readFileSync(path.join(srv,'tools/spawn-zones.json'),'utf8'))[map].zone,nl=PR.nearLevel(N,nav.valid);
 const zoneAt=(x,z,y,r)=>{const i=nl(x,z,y);return i>=0&&Math.hypot(N[i][0]-x,N[i][2]-z)<r?ZONES[i]:'';};
 const polys=PR.polylines(SB,map);let runs=0,leaks=0;const yaw=(dx,dz)=>Math.atan2(-dx,-dz),dt=1/30;
 for(const side of ['atk','def']){const own=side==='atk'?'A':'D',mine=polys.filter(q=>q.side===side);
  for(const st of PR.ledgeStarts(map,SB,keep,side,{per:PER})){const [sx,sy,sz]=st.at;let bp=null;for(const g of st.q.segs){const t=Math.max(0,Math.min(g.len,(sx-g.ax)*g.tx+(sz-g.az)*g.tz)),px=g.ax+g.tx*t,pz=g.az+g.tz*t,d=Math.hypot(px-sx,pz-sz);if(!bp||d<bp.d)bp={d,px,pz};}
   const dl=Math.hypot(bp.px-sx,bp.pz-sz)||1,bx=(bp.px-sx)/dl,bz=(bp.pz-sz)/dl;
   // buy-phase Updraft steered round a wall's end (= the server's ledgeRuns: END_NEAR / ANGLES, with and without jump spam)
   const S0=st.q.segs[0],S1=st.q.segs[st.q.segs.length-1],nearEnd=Math.min(Math.hypot(bp.px-S0.ax,bp.pz-S0.az),Math.hypot(bp.px-(S1.ax+S1.tx*S1.len),bp.pz-(S1.az+S1.tz*S1.len)))<PR.END_NEAR;
   const PATS=[['fj',0],['fcj',0],['up',0],['dash',0]];if(nearEnd)for(const a of PR.ANGLES)PATS.push(['up',a],['upn',a]);
   for(const [pat,ang] of PATS){const ar=ang*Math.PI/180,dx=bx*Math.cos(ar)-bz*Math.sin(ar),dz=bx*Math.sin(ar)+bz*Math.cos(ar);const P={x:sx,y:sy,z:sz,vx:0,vz:0,vy:0};let D=null;if(pat==='up'||pat==='upn')P.vy=PR.UPDRAFT;if(pat==='dash')D=VF.dash(1,0,yaw(dx,dz),11,.45);runs++;let px=sx,pz=sz,esc=null;
    for(let k=0;k*dt<3;k++){const tt=k*dt;if(D){VF.dashStep(P,D,dt,world);if(D.left<=0)D=null;}else VF.step(P,{x:dx,z:dz,jump:pat!=='dash'&&pat!=='upn'&&(tt%.4<.2),duck:pat==='fcj',walk:false,speed:6.75,tag:1,hold:false,use:false,f:1,pitch:0},dt,world);
     const cr=SB.crossing(map,px,pz,P.x,P.z,P.y+.5);if(cr&&cr.side===side){esc='crossed';break;}px=P.x;pz=P.z;
     if(k%3===0){const sd=PR.nearestSd(mine,P.x,P.z);if(sd<-1.5){const g=nmHeight(P.x,P.z,P.y+.05),zz=zoneAt(P.x,P.z,Number.isFinite(g)&&g<P.y?g:P.y,4);/* in the air: the zone of the floor under the body (a jump over the spawn's own floor is no way out), as the server's ledgeRuns */if(!(own+own.toLowerCase()).includes(zz||'?')){esc='out '+(zz||'off-nav')+' '+sd.toFixed(2)+' m past';break;}}}}
    if(esc){leaks++;if(leaks<=6)fails.push(map+' '+side+' panel '+st.panel+' '+pat+(ang?' '+ang+' deg':'')+' from '+[sx,sy,sz].map(v=>v.toFixed(2))+': '+esc+' at '+[P.x,P.y,P.z].map(v=>v.toFixed(2)));}}}}
 if(leaks>6)fails.push(map+': '+(leaks-6)+' more ledge / ability runs out');if(runs<40)fails.push(map+': too few ledge runs ('+runs+')');
 const row=map+': '+SB.pieces(map).length+' pieces (tops >= '+need.toFixed(1)+'), reach '+R.cells+' cells / '+R.leaks.length+' out, '+runs+' ledge / ability runs / '+leaks+' out ('+((Date.now()-T0)/1000).toFixed(0)+' s)';out.push(row);console.log(row);}
if(fails.length){console.log('FAIL spawn walls can be got over on the page ('+fails.length+'):\n - '+fails.join('\n - '));process.exit(1);}
console.log('test_spawn_barrier_tall_client: PASS\n  '+out.join('\n  '));})().catch(e=>{console.error(e);process.exit(1);});
