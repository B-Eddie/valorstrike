// hk-34: offline kit devices, marks and their sight probes used literal heights over the old maps' y 0 floor (okPlace
// h / 2, okMark 0.06, Alarmbot eye 0.5 / target 1, Turret 0.8 / 1.2, Boom Bot 0.4, Tour De Force / Trademark field 0.06,
// bot area damage xAoe eye 0.5 ...). On a native map (Ascent floor 7.05) they sat and looked 6+ m under the floor: Killjoy's
// Alarmbot / Turret / Lockdown and the slow fields were drawn under the map, and every bot area hit (molly, Boom Bot, TDF)
// asked los from under the floor to the player's eye -> never hurt the player. xFy(x, z, y) = the floor there (native:
// nmHeight; old maps: 0) and the same offsets ride on it.
// Checks (generated page, vm with a stub native map at 7.05; los stub: false when either end is under the floor):
// xFy native / legacy; okPlace (Alarmbot / Turret) at floor + h / 2 (legacy unchanged); xAoe hurts the player on the raised
// floor (and not through a wall); bcTdfField / okMark over the floor; the Alarmbot / Turret / Boom Bot / Trademark sight
// lines carry no literal under-floor heights any more.
const assert=require('assert/strict'),fs=require('fs'),path=require('path'),vm=require('vm');
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const cut=(a,b)=>{const i=html.indexOf(a);assert(i>=0,'missing '+a);const j=html.indexOf(b,i+a.length);assert(j>i,'missing end of '+a);return html.slice(i,j);};
const T=require(require.resolve('three',{paths:[path.join(__dirname,'..','server')]}));
const FLOOR=7.05;
const src=cut('function xFy(','\nfunction okGround(')+'\n'+cut('function okMark(','\nfunction okRm(')+'\n'+cut('function okPlace(','\nfunction okMMClick(')+'\n'+cut('function xAoe(','\n// spectator follow cam')+'\n'+cut('function bcTdfField(','\nfunction bcTmField(');
function mk(native){const objs=[],hurts=[];
 const ctx={jxBind:(m,h)=>h/* binds a native fx handle to its mesh (df60c6c); returns the handle */,chxSlowField:()=>null/* Brimstone Sky Smoke / TDF field look (df60c6c) */,Math,Number,Infinity,THREE:T,RV:T.Vector3,player:{x:0,y:native?FLOOR:0,z:0,hp:100},yaw:0,scene:{add:o=>objs.push(o)},allies:[],bots:[],XFF:new Set(),running:true,
  okMat:()=>new T.MeshBasicMaterial(),fireMat:()=>new T.MeshBasicMaterial(),ringGeo:new T.RingGeometry(.5,.6,8),slowGeo:new T.CircleGeometry(3.5,8),BC:{sf:[]},XTDF:{r:6,life:4},SFX:{ab(){}},
  blocked:()=>false,nmActive:()=>native?{key:'stub'}:null,nmHeight:()=>FLOOR,pEye:()=>new T.Vector3(0,(native?FLOOR:0)+1.6,0),hurt:(t,n,by)=>hurts.push([t,n,by]),
  wall:false,los:(a,b)=>{if(ctx.wall)return false;const f=native?FLOOR:0;return a.y>=f-.01&&b.y>=f-.01;}};
 vm.createContext(ctx);vm.runInContext(src+'\nglobalThis.xFy=xFy;globalThis.okPlace=okPlace;globalThis.okMark=okMark;globalThis.xAoe=xAoe;globalThis.bcTdfField=bcTdfField;',ctx);return {ctx,objs,hurts};}
{const {ctx}=mk(true),{ctx:L}=mk(false);
 assert.equal(ctx.xFy(1,2,FLOOR),FLOOR,'native: the nav floor');assert.equal(L.xFy(1,2,0),0,'old maps: y 0');
 const box=new T.BoxGeometry(.45,.45,.45),tur=new T.BoxGeometry(.5,.9,.5);
 const a=ctx.okPlace(box,0,1.5),t=ctx.okPlace(tur,0,1.5);assert.ok(Math.abs(a.position.y-(FLOOR+.225))<1e-9,'Alarmbot on the native floor: '+a.position.y);assert.ok(Math.abs(t.position.y-(FLOOR+.45))<1e-9,'Turret on the native floor: '+t.position.y);
 assert.ok(Math.abs(L.okPlace(box,0,1.5).position.y-.225)<1e-9,'old maps unchanged (h / 2)');
 assert.ok(Math.abs(ctx.okMark(3,4,0).position.y-(FLOOR+.06))<1e-9,'okMark ring over the native floor');assert.ok(Math.abs(L.okMark(3,4,0).position.y-.06)<1e-9,'okMark old maps unchanged');
 ctx.bcTdfField(2,-3,FLOOR);const f=ctx.BC.sf[0];assert.ok(f&&Math.abs(f.m.position.y-(FLOOR+.06))<1e-9,'Tour De Force field drawn over the native floor: '+(f&&f.m.position.y));}
{// bot area damage (xAoe): a bot molly / Boom Bot / Tour De Force splash at the player's feet on the raised floor
 const {ctx,hurts}=mk(true),bot={name:'Raze',g:{position:new T.Vector3(10,FLOOR,0)}};
 ctx.xAoe(bot,new T.Vector3(.5,FLOOR,0),3,50,'Paint Shells');assert.equal(hurts.length,1,'native: the player inside the radius is hurt (was never: eye under the floor)');
 ctx.xAoe(bot,{x:.5,y:1.4,z:0},3,50,'Tour De Force');assert.equal(hurts.length,2,'a legacy-height point (bot TDF 1.4) still reads the floor from the caster');
 ctx.wall=true;ctx.xAoe(bot,new T.Vector3(.5,FLOOR,0),3,50,'Paint Shells');assert.equal(hurts.length,2,'not through a wall');
 const {ctx:L,hurts:h2}=mk(false);L.xAoe({name:'b',g:{position:new T.Vector3(10,0,0)}},new T.Vector3(.5,0,0),3,50,'x');assert.equal(h2.length,1,'old maps unchanged');}
{// sight lines: no literal under-floor heights left in the offline device code
 const ok=cut('function okTick(','\nfunction okClear')+cut('function bcTmScan(','\n}');
 for(const bad of ['new V(A.p.x, 0.5, A.p.z)','new V(b.g.position.x, 1, b.g.position.z)','new V(T.p.x, 0.8, T.p.z)','new V(q.x, 1.2, q.z)','new RV(T.p.x, 0.5, T.p.z)'])assert.ok(!ok.includes(bad),'literal height left: '+bad);
 assert.ok(!html.includes('los(new RV(p.x, 0.5, p.z), new RV(q.x, 1, q.z))'),'Boom Bot sight from y 0.5');}
console.log('native kit y: xFy floor, okPlace / okMark / TDF field over a 7.05 floor (old maps unchanged), bot area damage reaches the player on a raised floor, no literal under-floor sight heights');
