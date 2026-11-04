// nmNear (native nav nearest node; nmHeight / nmSegDrop / nmNext / bot repaths call it many times a frame) - combat lane 2026-11-04,
// user: "it lags in certain times, like when i do multiple abilities while using ult while shooting at enemy while getting shot at".
// The dense-grid nmNear (work/native_maps_runtime.js nmCellGrid) must return the very same node index as the old Map-per-cell
// ring scan (kept verbatim below as REF) for every query - ties, y bands, off-map points (the full-scan fallback), cell edges,
// NaN y - on all 6 maps, so every bot decision is unchanged; and it must be faster on the common case (a point on the nav).
//   node work/test_nm_near_grid.cjs   (NQ=<queries per map>, default 40000)
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const root=path.join(__dirname,'..'),src=fs.readFileSync(path.join(root,'work/native_maps_runtime.js'),'utf8'),html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const seg=(s,a,b)=>{const i=s.indexOf(a);assert(i>=0,'missing '+a);const j=s.indexOf(b,i);assert(j>i,'missing end of '+a);return s.slice(i,j);};
const line=(s,k)=>{const i=s.indexOf(k);assert(i>=0,'missing '+k);return s.slice(i,s.indexOf('\n',i));};
const NEW=new Function(seg(src,'const NM_NONE=[];','\nfunction nmHeight(')+'\n'+line(src,'function nmConnected(C)')+'\nreturn {nmNear,nmConnected};')();
// REF = nmNear as it was (9738429), with its own Map of numeric cell keys
const REF=new Function('const NM_NONE=[];function nmCellNum(C){const m=new Map();for(const [k,v] of C.cells){const c=k.indexOf(",");m.set((+k.slice(0,c)+8192)*16384+(+k.slice(c+1))+8192,v);}return C.cn=m;}\n'+String.raw`function nmNear(C,x,z,y,yBand){let best=-1,bd=Infinity;const gx=Math.floor(x/2),gz=Math.floor(z/2);for(let ring=0;ring<=8;ring++){for(let dx=-ring;dx<=ring;dx++)for(let dz=-ring;dz<=ring;dz++){if(ring&&Math.abs(dx)!==ring&&Math.abs(dz)!==ring)continue;const L=(C.cn||nmCellNum(C)).get((gx+dx+8192)*16384+gz+dz+8192)||NM_NONE;for(let j=0;j<L.length;j++){const i=L[j],p=C.nav.nodes[i];/* perf2: indexed loop (no array iterator per probed cell) */if(Number.isFinite(yBand)&&Number.isFinite(y)&&Math.abs(p[1]-y)>yBand)continue;const d=(p[0]-x)**2+(p[2]-z)**2+(Number.isFinite(y)?(p[1]-y)**2*2:0);if(d<bd){bd=d;best=i;}}}if(best>=0&&ring>1&&bd<(ring*2-2)**2)return best;}if(best<0)for(let i=0;i<C.nav.nodes.length;i++){if(C.playable?!C.playable[i]:(C.nav.valid&&!C.nav.valid[i]))continue;const p=C.nav.nodes[i];if(Number.isFinite(yBand)&&Number.isFinite(y)&&Math.abs(p[1]-y)>yBand)continue;const d=(p[0]-x)**2+(p[2]-z)**2+(Number.isFinite(y)?(p[1]-y)**2*2:0);if(d<bd){best=i;bd=d;}}return best;}`+'\nreturn {nmNear};')();
assert.ok(html.includes(seg(src,'function nmCellGrid(C)','\n')),'index.html carries the grid nmNear (run work/install_valorant.py)');
let seed=+(process.env.SEED||4242);const rnd=()=>((seed=(seed*1103515245+12345)>>>0)/4294967296);const NQ=+(process.env.NQ||40000);
const time=(f,C,Q)=>{const t=process.hrtime.bigint();for(const q of Q)f(C,q[0],q[1],q[2],q[3]);return Number(process.hrtime.bigint()-t)/Q.length;};
let total=0;const ratios=[];
for(const m of ['ascent','bind','breeze','haven','lotus','split']){
 const nav=JSON.parse(fs.readFileSync(path.join(root,'models/valorant/maps',m,'navigation.json'),'utf8'));
 const mk=()=>{const C={nav,cells:new Map()};NEW.nmConnected(C);nav.nodes.forEach((p,i)=>{if(!C.playable[i])return;const k=Math.floor(p[0]/2)+','+Math.floor(p[2]/2);if(!C.cells.has(k))C.cells.set(k,[]);C.cells.get(k).push(i);});return C;}; // as nmLoad builds C.cells
 const A=mk(),B=mk();let x0=Infinity,x1=-Infinity,z0=Infinity,z1=-Infinity,y0=Infinity,y1=-Infinity;for(const p of nav.nodes){x0=Math.min(x0,p[0]);x1=Math.max(x1,p[0]);z0=Math.min(z0,p[2]);z1=Math.max(z1,p[2]);y0=Math.min(y0,p[1]);y1=Math.max(y1,p[1]);}
 const pick=()=>nav.nodes[(rnd()*nav.nodes.length)|0],Q=[];
 for(let i=0;i<NQ;i++){const k=rnd();let x,z;if(k<0.6){const p=pick(),s=k<0.3?1:8;x=p[0]+(rnd()-.5)*s;z=p[2]+(rnd()-.5)*s;}else if(k<0.93){x=x0-30+rnd()*(x1-x0+60);z=z0-30+rnd()*(z1-z0+60);}else{const p=pick();x=Math.floor(p[0]/2)*2+(rnd()<.5?0:2);z=Math.floor(p[2]/2)*2;} // last: cell corners
  const t=rnd(),y=t<0.3?undefined:t<0.34?NaN:y0-3+rnd()*(y1-y0+6),yb=rnd()<0.5?undefined:[.35,.5,1,2][(rnd()*4)|0];Q.push([x,z,y,yb]);}
 const ON=[];for(const p of nav.nodes){ON.push([p[0],p[2],p[1]],[p[0],p[2]],[p[0]+.1,p[2]-.1,p[1]],[p[0],p[2],p[1]+.2,.35]);} // exact node points (duplicate positions tie)
 let diff=0;for(const q of Q.concat(ON)){const a=REF.nmNear(A,q[0],q[1],q[2],q[3]),b=NEW.nmNear(B,q[0],q[1],q[2],q[3]);if(a!==b&&diff++<3)console.log('DIFF',m,JSON.stringify(q),a,b);}
 assert.equal(diff,0,m+': grid nmNear differs from the old ring scan on '+diff+' queries');total+=Q.length+ON.length;
 const on=ON.filter((q,i)=>i%4===2);let best=0;for(let r=0;r<3;r++){const ta=time(REF.nmNear,A,on),tb=time(NEW.nmNear,B,on);best=Math.max(best,ta/tb);}ratios.push(best);
 console.log(m,'nodes',nav.nodes.length,'queries',Q.length+ON.length,'identical; on-nav speedup x'+best.toFixed(1));}
assert.ok(Math.min(...ratios)>=2,'grid nmNear at least 2x faster than the ring scan for points on the nav (bot / unit positions): '+ratios.map(r=>r.toFixed(1)));
console.log('nmNear grid: identical node index on',total,'queries over 6 maps (ties, y bands, off-map fallback, cell edges, NaN y); on-nav x'+Math.min(...ratios).toFixed(1)+'+ faster');
