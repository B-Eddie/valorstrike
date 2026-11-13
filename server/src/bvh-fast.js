// perf3 (user: "keep iterating lag in online games"): allocation-free collision BVH queries for the game server.
// three-mesh-bvh 0.7.8's MeshBVH.raycastFirst builds a hit object ({distance, point.clone(), face:{normal}}) for every
// triangle the ray crosses at any range and re-wraps each root in three new typed arrays per call; MeshBVH.shapecast
// re-wraps the roots too and every caller builds fresh closures. The server ran ~3-5 MB of garbage per 50 ms tick (fog of
// war sight rays, unit collision, ground probes), most of it here. These are ports of the library's own traversal over
// the same buffers - same node order, same tie-breaks, same NaN handling (intersectRay: tmin <= far && tmax >= near),
// three r160's Ray.intersectTriangle / Vector3.distanceTo / Triangle.getNormal arithmetic written out operation for
// operation - so every answer is the library's, bit for bit (server/test-bvh-fast.js checks it on the real worlds).
// rayFirst returns ONE shared hit object: read it before the next cast.
import * as T from 'three';
import {ExtendedTriangle} from 'three-mesh-bvh';
const views=new WeakMap();
function viewsOf(bvh){let v=views.get(bvh);if(!v||v.r!==bvh._roots){const g=bvh.geometry,P=g&&g.attributes.position,I=g&&g.index;
  v={r:bvh._roots,f:[],u16:[],u32:[],fast:!!(bvh._roots&&!bvh._indirectBuffer&&!bvh.indirect&&I&&P&&!P.isInterleavedBufferAttribute&&!P.normalized&&P.itemSize===3&&I.itemSize===1&&P.array&&I.array&&!g.groups.length)};
  if(v.fast)for(const r of bvh._roots){v.f.push(new Float32Array(r));v.u16.push(new Uint16Array(r));v.u32.push(new Uint32Array(r));}views.set(bvh,v);}return v;}
export function fastBVH(bvh){
 const V=viewsOf(bvh),geo=bvh.geometry,ia=V.fast?geo.index.array:null,pa=V.fast?geo.attributes.position.array:null;
 // candidate results of the recursion live in slots: distance, triangle, point
 // (the ray lives in an object's double fields: a double stored into a closure variable is boxed on every store)
 let D=new Float64Array(64),Tt=new Int32Array(64),X=new Float64Array(192);
 const S={ox:.5,oy:.5,oz:.5,dx:.5,dy:.5,dz:.5,near:.5,far:.5,max:.5/* a caller's own limit (world.rayClear), not the library's far */,side:0,n:0};
 const slot=()=>{const k=S.n++;if(k>=D.length){const m=D.length*2,D2=new Float64Array(m),T2=new Int32Array(m),X2=new Float64Array(m*3);D2.set(D);T2.set(Tt);X2.set(X);D=D2;Tt=T2;X=X2;}return k;};
 // intersectClosestTri: intersectTri -> checkIntersection (Ray.intersectTriangle, origin.distanceTo, near / far)
 const leaf=(off,cnt)=>{const ox=S.ox,oy=S.oy,oz=S.oz,dx=S.dx,dy=S.dy,dz=S.dz,side=S.side,near=S.near,far=S.far,cull=side!==T.DoubleSide,back=side===T.BackSide;let best=-1,dist=Infinity;
  for(let i=off,e=off+cnt;i<e;i++){const t3=i*3,A=(back?ia[t3+2]:ia[t3])*3,B=ia[t3+1]*3,C=(back?ia[t3]:ia[t3+2])*3,ax=pa[A],ay=pa[A+1],az=pa[A+2];
   const e1x=pa[B]-ax,e1y=pa[B+1]-ay,e1z=pa[B+2]-az,e2x=pa[C]-ax,e2y=pa[C+1]-ay,e2z=pa[C+2]-az,nx=e1y*e2z-e1z*e2y,ny=e1z*e2x-e1x*e2z,nz=e1x*e2y-e1y*e2x;
   let DdN=dx*nx+dy*ny+dz*nz,sg;if(DdN>0){if(cull||back)continue;sg=1;}else if(DdN<0){sg=-1;DdN=-DdN;}else continue;
   const qx=ox-ax,qy=oy-ay,qz=oz-az,o1=sg*(dx*(qy*e2z-qz*e2y)+dy*(qz*e2x-qx*e2z)+dz*(qx*e2y-qy*e2x));if(o1<0)continue;
   const l1=sg*(dx*(e1y*qz-e1z*qy)+dy*(e1z*qx-e1x*qz)+dz*(e1x*qy-e1y*qx));if(l1<0)continue;if(o1+l1>DdN)continue;
   const QdN=-sg*(qx*nx+qy*ny+qz*nz);if(QdN<0)continue;const t=QdN/DdN,px=ox+dx*t,py=oy+dy*t,pz=oz+dz*t;
   const ex=ox-px,ey=oy-py,ez=oz-pz,d=Math.sqrt(ex*ex+ey*ey+ez*ez);if(d<near||d>far)continue;
   if(d<dist){if(best<0)best=slot();dist=d;D[best]=d;Tt[best]=i;const b3=best*3;X[b3]=px;X[b3+1]=py;X[b3+2]=pz;}}return best;};
 // intersectRay(nodeIndex32, float32Array, ray, near, far)
 const box=(n32,f)=>{const ox=S.ox,oy=S.oy,oz=S.oz,l=1/S.dx,c=1/S.dy,h=1/S.dz,near=S.near,far=S.far;let i,m,r,s,a,o;
  if(l>=0){i=(f[n32]-ox)*l;m=(f[n32+3]-ox)*l;}else{i=(f[n32+3]-ox)*l;m=(f[n32]-ox)*l;}
  if(c>=0){r=(f[n32+1]-oy)*c;s=(f[n32+4]-oy)*c;}else{r=(f[n32+4]-oy)*c;s=(f[n32+1]-oy)*c;}
  if(i>s||r>m)return false;if(r>i||isNaN(i))i=r;if(s<m||isNaN(m))m=s;
  if(h>=0){a=(f[n32+2]-oz)*h;o=(f[n32+5]-oz)*h;}else{a=(f[n32+5]-oz)*h;o=(f[n32+2]-oz)*h;}
  if(i>o||a>m)return false;if(a>i||i!==i)i=a;if(o<m||m!==m)m=o;return i<=far&&m>=near;};
 const rf=(n32,f,u16,u32)=>{const n16=n32*2;if(u16[n16+15]===0xFFFF)return leaf(u32[n32+6],u16[n16+14]);
  const ax=u32[n32+7],l2r=(ax===0?S.dx:ax===1?S.dy:S.dz)>=0,c1=l2r?n32+8:u32[n32+6],c2=l2r?u32[n32+6]:n32+8;
  const r1=box(c1,f)?rf(c1,f,u16,u32):-1;if(r1>=0){const v=X[r1*3+ax];if(l2r?v<=f[c2+ax]:v>=f[c2+ax+3])return r1;}
  const r2=box(c2,f)?rf(c2,f,u16,u32):-1;if(r1>=0&&r2>=0)return D[r1]<=D[r2]?r1:r2;return r1>=0?r1:r2;};
 const hit={distance:0,point:new T.Vector3(),face:{a:0,b:0,c:0,normal:new T.Vector3(),materialIndex:0},faceIndex:0};
 const slowRay=new T.Ray();
 // MeshBVH.raycastFirst(ray(o, d), side, near, far); null or the shared hit
 function rayFirst(x,y,z,ux,uy,uz,sd=T.FrontSide,nr=0,fr=Infinity){S.ox=x;S.oy=y;S.oz=z;S.dx=ux;S.dy=uy;S.dz=uz;S.side=sd;S.near=nr;S.far=fr;return cast();}
 // cast(): the ray already written into S (ox..dz, side, near, far) by the caller: no double crosses a call boundary
 // (a double argument to a call that is not inlined is boxed on the way in)
 function cast(){
  if(!V.fast){slowRay.origin.set(S.ox,S.oy,S.oz);slowRay.direction.set(S.dx,S.dy,S.dz);return bvh.raycastFirst(slowRay,S.side,S.near,S.far);}
  S.n=0;let bi=-1;
  for(let r=0;r<V.f.length;r++){const s=rf(0,V.f[r],V.u16[r],V.u32[r]);if(s>=0&&(bi<0||D[s]<D[bi]))bi=s;}
  if(bi<0)return null;const t=Tt[bi],F=hit.face,P=hit.point,N=F.normal;hit.distance=D[bi];P.x=X[bi*3];P.y=X[bi*3+1];P.z=X[bi*3+2];hit.faceIndex=t;
  F.a=ia[t*3];F.b=ia[t*3+1];F.c=ia[t*3+2];
  // Triangle.getNormal(a, b, c): (c - b) x (a - b), normalised (length 0 -> 0, 0, 0)
  const a3=F.a*3,b3=F.b*3,c3=F.c*3,vx=pa[c3]-pa[b3],vy=pa[c3+1]-pa[b3+1],vz=pa[c3+2]-pa[b3+2],wx=pa[a3]-pa[b3],wy=pa[a3+1]-pa[b3+1],wz=pa[a3+2]-pa[b3+2];
  let nx=vy*wz-vz*wy,ny=vz*wx-vx*wz,nz=vx*wy-vy*wx;const l=nx*nx+ny*ny+nz*nz;if(l>0){const k=1/Math.sqrt(l);nx*=k;ny*=k;nz*=k;}else nx=ny=nz=0;N.x=nx;N.y=ny;N.z=nz;return hit;}
 // any-hit shapecast: intersectsBounds = node box intersects `qb` (Box3.intersectsBox, child boxes only: the library never
 // tests the root), triangles fed as one reused ExtendedTriangle to tf(tri, index) in the library's order; true on the first tf true
 const tri=new ExtendedTriangle();
 const sc=(n32,f,u16,u32,qb,tf)=>{const n16=n32*2;if(u16[n16+15]===0xFFFF){const off=u32[n32+6],e=off+u16[n16+14],A=tri.a,B=tri.b,C=tri.c;
   for(let i=off;i<e;i++){const i3=i*3,a=ia[i3]*3,b=ia[i3+1]*3,c=ia[i3+2]*3;A.x=pa[a];A.y=pa[a+1];A.z=pa[a+2];B.x=pa[b];B.y=pa[b+1];B.z=pa[b+2];C.x=pa[c];C.y=pa[c+1];C.z=pa[c+2];tri.needsUpdate=true;if(tf(tri,i))return true;}return false;}
  const mn=qb.min,mx=qb.max,l=n32+8,r=u32[n32+6];
  if(!(mx.x<f[l]||mn.x>f[l+3]||mx.y<f[l+1]||mn.y>f[l+4]||mx.z<f[l+2]||mn.z>f[l+5])&&sc(l,f,u16,u32,qb,tf))return true;
  return !(mx.x<f[r]||mn.x>f[r+3]||mx.y<f[r+1]||mn.y>f[r+4]||mx.z<f[r+2]||mn.z>f[r+5])&&sc(r,f,u16,u32,qb,tf);};
 function shapeAny(qb,tf){if(!V.fast)return !!bvh.shapecast({intersectsBounds:b=>b.intersectsBox(qb),intersectsTriangle:tf});
  for(let r=0;r<V.f.length;r++)if(sc(0,V.f[r],V.u16[r],V.u32[r],qb,tf))return true;return false;}
 // Capsule-vs-map any-hit (world.blocked's shapecast): C holds the query box (x0 y0 z0 / x1 y1 z1 = Box3 min / max), the
 // capsule axis segment (sx sy sz -> ex ey ez = Line3 start / end), yb (a triangle wholly at or below it is skipped) and lim
 // (blocked when the triangle is closer than lim to the segment). Per triangle the same tests as world.js's intersectsTriangle:
 // the y / bounds rejects, then ExtendedTriangle.closestPointToSegment(segment) < lim with its arithmetic written out on a
 // Float64Array of point slots (no Vector3 temporaries, no double crossing a call: nothing is boxed).
 const C={x0:.5,y0:.5,z0:.5,x1:.5,y1:.5,z1:.5,sx:.5,sy:.5,sz:.5,ex:.5,ey:.5,ez:.5,yb:.5,lim:.5};
 // P slots (x, y, z): 0 a, 3 b, 6 c (triangle), 9 start, 12 end (segment), 15 t1, 18 t2, 21 m1, 24 m2, 27 edge start, 30 edge end;
 // P[33] / P[34] = d / d2 parameters, P[35] = squared distance out, P[36] = t parameter in
 const P=new Float64Array(40);
 // Line3(s, e).at(P[36], out): (e - s) * t + s
 function lineAt(s,e,o){const t=P[36];P[o]=(P[e]-P[s])*t+P[s];P[o+1]=(P[e+1]-P[s+1])*t+P[s+1];P[o+2]=(P[e+2]-P[s+2])*t+P[s+2];}
 // Line3(s, e).closestPointToPoint(point p, clampToLine true, out)
 function lineClosest(s,e,p,o){const spx=P[p]-P[s],spy=P[p+1]-P[s+1],spz=P[p+2]-P[s+2],sex=P[e]-P[s],sey=P[e+1]-P[s+1],sez=P[e+2]-P[s+2];
  const se2=sex*sex+sey*sey+sez*sez,sesp=sex*spx+sey*spy+sez*spz;let t=sesp/se2;t=Math.max(0,Math.min(1,t));P[36]=t;lineAt(s,e,o);}
 // a.distanceToSquared(b) -> P[35]
 function dsq(a,b){const x=P[a]-P[b],y=P[a+1]-P[b+1],z=P[a+2]-P[b+2];P[35]=x*x+y*y+z*z;}
 // closestPointsSegmentToSegment(l1 = (27, 30), l2 = (9, 12), target1 15, target2 18), closestPointLineToLine inline
 function segSeg(){const v02x=P[27]-P[9],v02y=P[28]-P[10],v02z=P[29]-P[11],d1x=P[30]-P[27],d1y=P[31]-P[28],d1z=P[32]-P[29],d2x=P[12]-P[9],d2y=P[13]-P[10],d2z=P[14]-P[11];
  const d0232=v02x*d2x+v02y*d2y+v02z*d2z,d3210=d2x*d1x+d2y*d1y+d2z*d1z,d3232=d2x*d2x+d2y*d2y+d2z*d2z,d0210=v02x*d1x+v02y*d1y+v02z*d1z,d1010=d1x*d1x+d1y*d1y+d1z*d1z;
  const denom=d1010*d3232-d3210*d3210;let d;if(denom!==0)d=(d0232*d3210-d0210*d3232)/denom;else d=0;const d2=(d0232+d*d3210)/d3232;
  if(d>=0&&d<=1&&d2>=0&&d2<=1){P[36]=d;lineAt(27,30,15);P[36]=d2;lineAt(9,12,18);return;}
  else if(d>=0&&d<=1){P[36]=d2<0?0:1;lineAt(9,12,18);lineClosest(27,30,18,15);return;}
  else if(d2>=0&&d2<=1){P[36]=d<0?0:1;lineAt(27,30,15);lineClosest(9,12,15,18);return;}
  const p=d<0?27:30,p2=d2<0?9:12;lineClosest(27,30,p2,21);lineClosest(9,12,p,24);dsq(21,p2);const q1=P[35];dsq(24,p);
  if(q1<=P[35]){P[15]=P[21];P[16]=P[22];P[17]=P[23];P[18]=P[p2];P[19]=P[p2+1];P[20]=P[p2+2];}else{P[15]=P[p];P[16]=P[p+1];P[17]=P[p+2];P[18]=P[24];P[19]=P[25];P[20]=P[26];}}
 // Triangle(a 0, b 3, c 6).closestPointToPoint(point p, out 15) (three r160, Ericson 5.1.5)
 function triClosest(p){const abx=P[3]-P[0],aby=P[4]-P[1],abz=P[5]-P[2],acx=P[6]-P[0],acy=P[7]-P[1],acz=P[8]-P[2],apx=P[p]-P[0],apy=P[p+1]-P[1],apz=P[p+2]-P[2];
  const d1=abx*apx+aby*apy+abz*apz,d2=acx*apx+acy*apy+acz*apz;if(d1<=0&&d2<=0){P[15]=P[0];P[16]=P[1];P[17]=P[2];return;}
  const bpx=P[p]-P[3],bpy=P[p+1]-P[4],bpz=P[p+2]-P[5],d3=abx*bpx+aby*bpy+abz*bpz,d4=acx*bpx+acy*bpy+acz*bpz;if(d3>=0&&d4<=d3){P[15]=P[3];P[16]=P[4];P[17]=P[5];return;}
  const vc=d1*d4-d3*d2;if(vc<=0&&d1>=0&&d3<=0){const v=d1/(d1-d3);P[15]=P[0]+abx*v;P[16]=P[1]+aby*v;P[17]=P[2]+abz*v;return;}
  const cpx=P[p]-P[6],cpy=P[p+1]-P[7],cpz=P[p+2]-P[8],d5=abx*cpx+aby*cpy+abz*cpz,d6=acx*cpx+acy*cpy+acz*cpz;if(d6>=0&&d5<=d6){P[15]=P[6];P[16]=P[7];P[17]=P[8];return;}
  const vb=d5*d2-d1*d6;if(vb<=0&&d2>=0&&d6<=0){const w=d2/(d2-d6);P[15]=P[0]+acx*w;P[16]=P[1]+acy*w;P[17]=P[2]+acz*w;return;}
  const va=d3*d6-d5*d4;if(va<=0&&(d4-d3)>=0&&(d5-d6)>=0){const bcx=P[6]-P[3],bcy=P[7]-P[4],bcz=P[8]-P[5],w=(d4-d3)/((d4-d3)+(d5-d6));P[15]=P[3]+bcx*w;P[16]=P[4]+bcy*w;P[17]=P[5]+bcz*w;return;}
  const den=1/(va+vb+vc),v=vb*den,w=vc*den;P[15]=P[0]+abx*v+acx*w;P[16]=P[1]+aby*v+acy*w;P[17]=P[2]+abz*v+acz*w;}
 // ExtendedTriangle.closestPointToSegment(segment) squared (Math.sqrt of it is the library's return) -> P[35]
 function triSegSq(){let best=Infinity;for(let i=0;i<3;i++){const a=i*3,b=((i+1)%3)*3;P[27]=P[a];P[28]=P[a+1];P[29]=P[a+2];P[30]=P[b];P[31]=P[b+1];P[32]=P[b+2];segSeg();dsq(15,18);if(P[35]<best)best=P[35];}
  triClosest(9);dsq(9,15);if(P[35]<best)best=P[35];triClosest(12);dsq(12,15);if(P[35]<best)best=P[35];P[35]=best;}
 const cap=(n32,f,u16,u32)=>{const n16=n32*2;if(u16[n16+15]===0xFFFF){const off=u32[n32+6],e=off+u16[n16+14],yb=C.yb,x0=C.x0,x1=C.x1,z0=C.z0,z1=C.z1,y1=C.y1;
   for(let i=off;i<e;i++){const i3=i*3,a=ia[i3]*3,b=ia[i3+1]*3,c=ia[i3+2]*3,ay=pa[a+1],by=pa[b+1],cy=pa[c+1];if(Math.max(ay,by,cy)<=yb)continue;
    const ax=pa[a],bx=pa[b],cx=pa[c],az=pa[a+2],bz=pa[b+2],cz=pa[c+2];if(Math.min(ax,bx,cx)>x1||Math.max(ax,bx,cx)<x0||Math.min(az,bz,cz)>z1||Math.max(az,bz,cz)<z0||Math.min(ay,by,cy)>y1)continue;
    /* plane reject (net lane, 13 Nov 2026): both ends of the capsule's segment on one side of the triangle's plane and farther from it than
       the limit (+ 1e-9) -> every point of the triangle is farther than the limit from the segment, so the exact test below cannot pass.
       In dense spots (a corner of Ascent B main) most triangles whose box overlaps the capsule's are such far planes: 60 us a query. */
    {const ux=bx-ax,uy=by-ay,uz=bz-az,vx=cx-ax,vy=cy-ay,vz=cz-az,nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx,d0=nx*(C.sx-ax)+ny*(C.sy-ay)+nz*(C.sz-az),d1=nx*(C.ex-ax)+ny*(C.ey-ay)+nz*(C.ez-az);
     if(d0*d1>0){const m=(C.lim+1e-9)*(C.lim+1e-9)*(nx*nx+ny*ny+nz*nz);if(d0*d0>m&&d1*d1>m)continue;}}
    /* plan reject: the segment is vertical (blocked's capsule axis), so the distance to the triangle is at least the distance, seen from above,
       from the axis to the triangle's outline. Outside the outline and farther than the limit (+ 1e-9) from all three edges -> cannot pass. */
    if(C.sx===C.ex&&C.sz===C.ez){const px=C.sx,pz=C.sz,L=(C.lim+1e-9)*(C.lim+1e-9);
     const e1x=bx-ax,e1z=bz-az,e2x=cx-bx,e2z=cz-bz,e3x=ax-cx,e3z=az-cz,q1x=px-ax,q1z=pz-az,q2x=px-bx,q2z=pz-bz,q3x=px-cx,q3z=pz-cz;
     const s1=e1x*q1z-e1z*q1x,s2=e2x*q2z-e2z*q2x,s3=e3x*q3z-e3z*q3x;
     if(!(s1>=0&&s2>=0&&s3>=0||s1<=0&&s2<=0&&s3<=0)){
      let l=e1x*e1x+e1z*e1z,t=l>0?(q1x*e1x+q1z*e1z)/l:0;t=t<0?0:t>1?1:t;let dx=q1x-e1x*t,dz=q1z-e1z*t;
      if(dx*dx+dz*dz>L){l=e2x*e2x+e2z*e2z;t=l>0?(q2x*e2x+q2z*e2z)/l:0;t=t<0?0:t>1?1:t;dx=q2x-e2x*t;dz=q2z-e2z*t;
       if(dx*dx+dz*dz>L){l=e3x*e3x+e3z*e3z;t=l>0?(q3x*e3x+q3z*e3z)/l:0;t=t<0?0:t>1?1:t;dx=q3x-e3x*t;dz=q3z-e3z*t;if(dx*dx+dz*dz>L)continue;}}}}
    P[0]=ax;P[1]=ay;P[2]=az;P[3]=bx;P[4]=by;P[5]=bz;P[6]=cx;P[7]=cy;P[8]=cz;triSegSq();if(Math.sqrt(P[35])<C.lim)return true;}return false;}
  const l=n32+8,r=u32[n32+6];
  if(!(C.x1<f[l]||C.x0>f[l+3]||C.y1<f[l+1]||C.y0>f[l+4]||C.z1<f[l+2]||C.z0>f[l+5])&&cap(l,f,u16,u32))return true;
  return !(C.x1<f[r]||C.x0>f[r+3]||C.y1<f[r+1]||C.y0>f[r+4]||C.z1<f[r+2]||C.z0>f[r+5])&&cap(r,f,u16,u32);};
 function capsuleAny(){if(!V.fast)return null;P[9]=C.sx;P[10]=C.sy;P[11]=C.sz;P[12]=C.ex;P[13]=C.ey;P[14]=C.ez;for(let r=0;r<V.f.length;r++)if(cap(0,V.f[r],V.u16[r],V.u32[r]))return true;return false;}
 return {rayFirst,cast,S,shapeAny,capsuleAny,C,fast:V.fast};
}
