// Spawn walls hold on the page (user: "In Breeze and Haven, the wall in buy phase isn't fully blocking the path, so I can sneak
// through it"). The generated page's own collision (nmHeight / nmBlocked / nmLeash from index.html, the native map BVH from
// server/public/worlds) and the shared motor (vendor/valorant-feel.js step, as the page's feel moveP) in a vm, FV.buy > 0 in a
// 5v5 (the walls solid through nmBlocked). For every wall piece of both spawns, from the spawn side (own Valorant buy zone,
// server/tools/spawn-zones.json) at points along the piece (every 1.5 m) and just past / 1 m past both of its ends, the player
// tries to get out for up to 4 s (a run held in place for 1.5 s ends early) at 30 fps: a run-up from 4 m and from 1.2 m
// straight in, 45 deg either way, crouch-jump, all with jump spam; at the ends also at 10 fps (a long frame must not tunnel);
// and hugging the wall towards each end from 1.5 m / 3 m short of it (20 deg into the wall) for 2.5 s, then straight out for
// 2.5 s, jump spam. Out = it crossed a wall of its own spawn, or stands more than 1.5 m beyond the nearest wall's line outside its own
// zone (nearest navigation node within 4 m: neutral / enemy, or none). Also static: each wall's top is above the feet of a
// player jumping from the highest floor they can reach beside it (a jump-up flood of 1.3 m rises within 3.5 m of the wall;
// jump apex 1.165 m + 0.6 m margin), and its foot is at most 0.3 m over the doorway floor (a crouched body still meets it).
// Same runs as the server's tools/spawn-barrier-probe.mjs (server/test-spawn-barrier-leaks.js).
// Default run (CI, ~1 min): only the panels that leaked before the sealing pass (SAMPLE below: Breeze / Haven attacker doors, Bind
// attacker doors 1 / 4, Breeze defender door, Lotus attacker doors), static checks + the runs at and past their ends (30 fps straight /
// 45 deg / crouch-jump, 10 fps straight, wall hugs). The full sweep (every panel of all six maps, every point along each piece,
// every run above; ~15-30 min) with SBL_FULL=1; SBL_MAPS=breeze,haven narrows either.
//   node work/test_spawn_barrier_leaks_client.cjs        SBL_FULL=1 node work/test_spawn_barrier_leaks_client.cjs
const fs=require('fs'),path=require('path'),vm=require('vm');const root=path.join(__dirname,'..');
const srv=path.join(root,'server'),req=require('module').createRequire(path.join(srv,'package.json')),T=req('three'),{MeshBVH}=req('three-mesh-bvh');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8'),fails=[],out=[];
const line=s=>{const i=html.indexOf(s);if(i<0)throw Error('page function missing: '+s);return html.slice(i,html.indexOf('\n',i));};
const fnBlock=s=>{const i=html.indexOf(s);if(i<0)throw Error('page function missing: '+s);return html.slice(i,html.indexOf('\n}',i)+2);};
const sbSrc=fs.readFileSync(path.join(root,'vendor/spawn-barriers.cjs'),'utf8').trimEnd();if(!html.includes(sbSrc))throw Error('index.html does not carry vendor/spawn-barriers.cjs verbatim (run python3 work/install_valorant.py)');
const page=[line('const NM_NONE=[];'),line('function nmCellNum(C){'),line('function nmNear(C,x,z,y,yBand){'),line('function nmHeight(C,x,z,y){'),line('var NM_Q='),fnBlock('function nmBlocked(C,x,z,r,y,height=1.8){'),line('function nmLeash(C,x,z,y,x0,z0){'),line('function nmConnected(C){')].join('\n');
const tree=k=>{const b=f=>fs.readFileSync(path.join(srv,'public/worlds',k,f)),p=b('position.bin'),ix=b('index.bin'),g=new T.BufferGeometry();g.setAttribute('position',new T.BufferAttribute(new Float32Array(p.buffer.slice(p.byteOffset,p.byteOffset+p.byteLength)),3));g.setIndex(new T.BufferAttribute(new Uint32Array(ix.buffer.slice(ix.byteOffset,ix.byteOffset+ix.byteLength)),1));const meta=JSON.parse(b('meta.json')),roots=[];for(let n=0;n<meta.roots;n++){const r=b('bvh'+n+'.bin');roots.push(r.buffer.slice(r.byteOffset,r.byteOffset+r.byteLength));}return MeshBVH.deserialize({index:g.index.array,roots},g,{setIndex:false});};
// barrier-3: Bind attackers' east door (panel 1) KNOWN gap closed - its foot goes down to the trench floor - 0.4 (5.69);
// runs start only where a player can stand (on the leash, beside a playable navigation node of that level), as the server probe.
const KNOWN={},known=[];
const FULL=!!process.env.SBL_FULL,SAMPLE={breeze:{atk:[3],def:[4]},haven:{atk:[3]},bind:{atk:[1,4]},lotus:{atk:[0,2]}};
const MAPS=(process.env.SBL_MAPS||(FULL?'ascent,bind,breeze,haven,lotus,split':Object.keys(SAMPLE).join(','))).split(',');
if(!fs.existsSync(path.join(srv,'public/worlds',MAPS[0],'bvh0.bin'))){console.log('test_spawn_barrier_leaks_client: SKIP (no server/public/worlds collision: npm run build:worlds)');process.exit(0);}
const ZONES=JSON.parse(fs.readFileSync(path.join(srv,'tools/spawn-zones.json'),'utf8'));
const RUNS=[['fj',1.2,30],['fj',4,30],['l45j',1.2,30],['r45j',1.2,30],['fcj',1.2,30],['fj',4,10],['l45j',1.2,10],['r45j',1.2,10]],JUMP=1.165,MARGIN=.6,RISE=1.3,BAND=3.5;
for(const map of MAPS){
 const dir=path.join(root,'models/valorant/maps',map),meta=JSON.parse(fs.readFileSync(path.join(dir,'map.json'),'utf8')),nav=JSON.parse(fs.readFileSync(path.join(dir,'navigation.json'),'utf8'));
 const N=nav.nodes,C={key:map,meta,nav,bvh:tree(map),cells:new Map(),cellSize:2},Zs=ZONES[map];if(!Zs||Zs.nodes!==N.length)throw Error(map+': spawn zones do not match the navigation');const Z=Zs.zone;
 const ctx={THREE:T,Math,Object,Number,Infinity,NaN,Set,Map,WeakMap,Array,JSON,String,Float32Array,Float64Array,Int32Array,Uint8Array,Uint32Array,Error,isFinite,console,performance:{now:()=>0},
  mode:'five',running:true,paused:false,MP:{cl:false},FV:{map,atk:true,dm:false,buy:30},nmActive:()=>C};
 ctx.globalThis=ctx.window=ctx;vm.createContext(ctx);vm.runInContext(fs.readFileSync(path.join(root,'vendor/valorant-feel.js'),'utf8'),ctx);vm.runInContext(sbSrc,ctx);vm.runInContext(page,ctx);
 vm.runInContext('nmConnected(nmActive());',ctx);N.forEach((p,i)=>{if(!C.playable[i])return;const k=Math.floor(p[0]/2)+','+Math.floor(p[2]/2);if(!C.cells.has(k))C.cells.set(k,[]);C.cells.get(k).push(i);});
 const SB=ctx.SpawnBarriers,VF=ctx.ValorantFeel,nmHeight=(x,z,y)=>ctx.nmHeight(C,x,z,y),nmBlocked=(x,z,r,y,h)=>ctx.nmBlocked(C,x,z,r,y,h),nmLeash=(x,z,y,x0,z0)=>ctx.nmLeash(C,x,z,y,x0,z0),nmNear=(x,z,y)=>ctx.nmNear(C,x,z,y);
 // the page's feel moveP world (native map)
 const world={ground:(x,z,y)=>nmHeight(x,z,y),blocked:(x,z,r,y,h)=>nmBlocked(x,z,r,y,h),leash:(x,z,y,x0,z0)=>nmLeash(x,z,y,x0,z0),ceiling:(x,z,low,high)=>{const ray=new T.Ray(new T.Vector3(x,low+.01,z),new T.Vector3(0,1,0)),hit=C.bvh.raycastFirst(ray,T.DoubleSide);return !!hit&&hit.distance<high-low;},ropes:null};
 const mapBlocked=(x,z,r,y,h)=>{ctx.FV.buy=0;try{return nmBlocked(x,z,r,y,h);}finally{ctx.FV.buy=30;}};
 // panels as polylines (signed distance: + spawn side)
 const polys=[];for(const side of ['atk','def'])for(const P of SB.DATA[map][side]){const segs=[];for(let i=1;i<P.p.length;i++){const [ax,az]=P.p[i-1],[bx,bz]=P.p[i],len=Math.hypot(bx-ax,bz-az);if(len<1e-6)continue;const tx=(bx-ax)/len,tz=(bz-az)/len;segs.push({ax,az,len,tx,tz,nx:-tz*P.in,nz:tx*P.in});}polys.push({side,P,segs});}
 const sdist=(poly,x,z)=>{let best=null;for(const s of poly.segs){const t=Math.max(0,Math.min(s.len,(x-s.ax)*s.tx+(z-s.az)*s.tz)),px=s.ax+s.tx*t,pz=s.az+s.tz*t,d=Math.hypot(x-px,z-pz);if(!best||d<best.d-1e-9)best={d,sg:(x-px)*s.nx+(z-pz)*s.nz>=0?1:-1};}return best.d*best.sg;};
 const onPlayable=(x,z,y)=>{let b=Infinity,dy=0;for(let dx=-1;dx<=1;dx++)for(let dz=-1;dz<=1;dz++)for(const i of C.cells.get((Math.floor(x/2)+dx)+','+(Math.floor(z/2)+dz))||[]){const n=N[i];if(Math.abs(n[1]-y)>1.6)continue;const d=Math.hypot(n[0]-x,n[2]-z);if(d<b){b=d;dy=Math.abs(n[1]-y);}}return b<=1.2&&dy<=.6;};/* server escapes(): nearest playable node of the level within 1.2 m, 0.6 m up / down */
 const zoneAt=(x,z,y,r=1.5)=>{const i=nmNear(x,z,y);return i>=0&&Math.hypot(N[i][0]-x,N[i][2]-z)<r?Z[i]:'';};
 let runs=0,static_=0;const leaks=[];const T0=Date.now();
 const pick=(side,k)=>FULL||!!(SAMPLE[map]&&SAMPLE[map][side]&&SAMPLE[map][side].includes(k));
 for(const side of ['atk','def']){const own=side==='atk'?'A':'D',mine=polys.filter(o=>o.side===side);
  // static: height over the reachable floor beside each panel, foot under the doorway floor
  for(const [k,o] of mine.entries()){if(!pick(side,k))continue;const P=o.P;let top=-1e9,low=1e9;const seen=new Set(),Q=[];const S=.25,key=(x,z)=>Math.round(x/S)+','+Math.round(z/S);
   for(const s of o.segs)for(let t=0;t<=s.len+1e-9;t+=S)for(const off of [-.6,.6]){const x=s.ax+s.tx*t+s.nx*off,z=s.az+s.tz*t+s.nz*off,g=nmHeight(x,z,P.y[0]+1);if(!Number.isFinite(g)||g<P.y[0]-1.5||g>P.y[0]+1.5)continue;low=Math.min(low,g);if(mapBlocked(x,z,.3,g,1.2))continue;const kk=key(x,z);if(!seen.has(kk)){seen.add(kk);Q.push([x,z,g]);}}
   for(let q=0;q<Q.length&&q<60000;q++){const [x,z,y]=Q[q];top=Math.max(top,y);for(const [dx,dz] of [[S,0],[-S,0],[0,S],[0,-S]]){const nx=x+dx,nz=z+dz,kk=key(nx,nz);if(seen.has(kk))continue;if(Math.abs(sdist(o,nx,nz))>BAND)continue;const g=nmHeight(nx,nz,y+RISE);if(!(g<=y+RISE+.01&&g>y-3))continue;if(mapBlocked(nx,nz,.3,g,1.2))continue;seen.add(kk);Q.push([nx,nz,g]);}}
   const need=top+JUMP+MARGIN;static_++;if(P.y[1]<need)leaks.push({side,panel:k,how:'top '+P.y[1]+' < reachable floor '+top.toFixed(2)+' + jump '+(JUMP+MARGIN).toFixed(2)});if(Number.isFinite(low)&&P.y[0]>low+.3)leaks.push({side,panel:k,how:'foot '+P.y[0]+' over the doorway floor '+low.toFixed(2)});}
  // motor: try to get out
  const L=SB.pieces(map).filter(p=>p.side===side),owner=[];mine.forEach((o,k)=>o.segs.forEach(()=>owner.push(k)));
  for(const [pi,p] of L.entries()){if(!pick(side,owner[pi]))continue;if(process.env.SBL_V)console.error(map,side,pi,runs,leaks.length,((Date.now()-T0)/1000).toFixed(0)+'s');const ends=[-1,-.3,p.len+.3,p.len+1],ts=ends.slice();if(FULL)for(let t=.75;t<p.len;t+=1.5)ts.push(t);const runs_=[];for(const t of ts)for(const R of RUNS){if(R[2]===10&&!ends.includes(t))continue;if(!FULL&&R[2]===10&&R[0]!=='fj')continue;runs_.push([t,...R]);}
   /* hugging the wall towards an end (20 deg into it, jump spam): rounds an end that stops short of the room's wall */for(const [t,dir] of [[p.len-3,1],[p.len-1.5,1],[3,-1],[1.5,-1]])if(t>0&&t<p.len)runs_.push([t,'hug'+(dir>0?'+':'-')+'j',.7,30]);
   for(const [t,pat,din,fps] of runs_)for(const qy of [1.4,3.4]){/* as the server probe: from the floor over the foot and one 3.4 m up (a foot lowered to a trench: Bind attackers' east door) */
   const sx=p.ax+p.tx*t+p.nx*din,sz=p.az+p.tz*t+p.nz*din,gy=nmHeight(sx,sz,p.y0+qy);if(!Number.isFinite(gy)||gy<p.y0-2.5||gy>p.y0+4)continue;if(qy>2&&Math.abs(gy-nmHeight(sx,sz,p.y0+1.4))<.5)continue;if(nmBlocked(sx,sz,.42,gy,1.8))continue;if(!own.includes(zoneAt(sx,sz,gy)))continue;if(!nmLeash(sx,sz,gy))continue;if(!onPlayable(sx,sz,gy))continue;
   let dx=-p.nx,dz=-p.nz;if(pat.startsWith('l45')){dx=-p.nx*.707-p.tx*.707;dz=-p.nz*.707-p.tz*.707;}if(pat.startsWith('r45')){dx=-p.nx*.707+p.tx*.707;dz=-p.nz*.707+p.tz*.707;}if(pat.startsWith('hug')){const g=pat[3]==='+'?1:-1;dx=p.tx*g*.94-p.nx*.34;dz=p.tz*g*.94-p.nz*.34;}
   const P={x:sx,y:gy,z:sz,vx:0,vz:0,vy:0},dt=1/fps,j=pat.includes('j'),c=pat.includes('c');let px=sx,pz=sz,esc=null,hx=sx,hz=sz,ht=0;runs++;
   const Tmax=pat.startsWith('hug')?5:4;for(let k=0;k*dt<Tmax;k++){if(k*dt-ht>=1.5){if(Math.hypot(P.x-hx,P.z-hz)<.1)break;/* held: no progress for 1.5 s */hx=P.x;hz=P.z;ht=k*dt;}const tt=k*dt;if(pat.startsWith('hug')&&tt>=2.5){dx=-p.nx;dz=-p.nz;}/* along the wall to its end, then out */VF.step(P,{x:dx,z:dz,jump:j&&(tt%.4<.2),duck:c,walk:false,speed:6.75,tag:1,hold:false,use:false,f:1,pitch:0},dt,world);
    const cr=SB.crossing(map,px,pz,P.x,P.z,P.y+.5);if(cr&&cr.side===side){esc='crossed';break;}px=P.x;pz=P.z;
    if(k%3===0){let sd=Infinity;for(const o of mine){const v=sdist(o,P.x,P.z);if(Math.abs(v)<6&&Math.abs(v)<Math.abs(sd))sd=v;}if(sd<-1.5){const zz=zoneAt(P.x,P.z,P.y,4);if(!(own+own.toLowerCase()).includes(zz||'?')){esc='out '+(zz||'off-nav')+' '+sd.toFixed(2)+' m past the wall';break;}}}}
   if(esc&&KNOWN[map]&&KNOWN[map][side]&&KNOWN[map][side].includes(owner[pi])&&gy<p.y0-1.5){known.push(map+' '+side+' panel '+owner[pi]+' from '+[sx,gy,sz].map(v=>v.toFixed(2))+' ('+pat+', '+esc+')');continue;}
   if(esc)leaks.push({side,piece:pi,t:+t.toFixed(2),din,pat,fps,how:esc,from:[sx,gy,sz].map(v=>+v.toFixed(2)),at:[P.x,P.y,P.z].map(v=>+v.toFixed(2))});}}}
 console.error(map,'ms/run',((Date.now()-T0)/Math.max(1,runs)).toFixed(1));const row=map+': '+runs+' escape runs, '+static_+' panels checked, '+leaks.length+' leaks';out.push(row);console.log(row);
 if(leaks.length){const by={};for(const l of leaks){const k=l.side+' '+(l.piece!=null?'piece '+l.piece:'panel '+l.panel);(by[k]=by[k]||[]).push(l);}for(const k in by)fails.push(map+' '+k+': '+by[k].length+' x, e.g. '+JSON.stringify(by[k][0]));}
 if(runs<(FULL?100:10))fails.push(map+': too few runs ('+runs+')');}
if(fails.length){console.log('FAIL spawn walls leak on the page ('+fails.length+'):\n - '+fails.join('\n - '));process.exit(1);}
if(known.length)console.log('KNOWN OPEN ('+known.length+' runs, not failed): '+known.slice(0,3).join('; '));
console.log('test_spawn_barrier_leaks_client: PASS\n  '+out.join('\n  '));
