// Floor weapon pick-up client (#4): look-at targeting (crosshair cone in 3D, feet radius, ledge height),
// the "[F] Pick up <weapon>" prompt, elevated drops, and the online path (server fw rows rendered, F sends
// the targeted id, G sends dropw only for a held primary, round-state ld re-syncs both slots).
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict');const root=path.join(__dirname,'..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8'),net=fs.readFileSync(path.join(root,'work/server_runtime.js'),'utf8');
const cut=(s,a,b)=>{const i=s.indexOf(a),j=s.indexOf(b,i);assert(i>=0&&j>i,'missing '+a);return s.slice(i,j);};
assert(html.includes('const xdOn = () => mode === "five" && !FV.dm && !(typeof NET !== "undefined" && NET.socket);'),'offline floor guns are off in online rooms');
assert(/xdDrop\(FV\.pri \|\| FV\.sec, player\.x, player\.z, [^;]*, player\.y\)/.test(html),'death drop lies at the player floor height');
// DOM stub
const els={};function El(tag){this.tag=tag;this.style={};this.children=[];this.attrs={};}El.prototype={append(c){this.children.push(c);},setAttribute(k,v){this.attrs[k]=v;},set innerHTML(h){this._h=h;this.children=[new El('b'),new El('span')];this.children[0].textContent='F';this.children[1].textContent='';},get lastChild(){return this.children[this.children.length-1];},get firstChild(){return this.children[0];}};
const body=new El('body');const document={getElementById:id=>els[id]||null,createElement:t=>new El(t),body:{append(e){els[e.id]=e;body.append(e);}},addEventListener(){} };
const scene={added:new Set(),add(m){this.added.add(m);},remove(m){this.added.delete(m);}};
const sent=[],keyHandlers=[];
const ctx={Math,Number,Infinity,Array,Set,Map,Object,document,scene,XD:{L:[],P:[],n:0},THREE:null,running:true,paused:false,FV:{menu:false,pri:'Vandal',sec:'Classic',sp:null},player:{x:0,y:5,z:0,hp:100,ch:0},yaw:0,pitch:0,mode:'five',WEAP:{Vandal:{},Phantom:{},Classic:{},Sheriff:{},Operator:{}},
 requestAnimationFrame(){},xKbSkip:()=>false,rw:'pri',slots:{pri:{},pis:{}},sent};
vm.createContext(ctx);
vm.runInContext('var xdOnFlag=true;function xdOn(){return xdOnFlag;}function xdMesh(){return {position:{set(x,y,z){this.x=x;this.y=y;this.z=z;}},rotation:{set(){}}};}function xdModel(m,w){m.w=w;}\n'+cut(html,'function xdLook(list)','(function xdPromptLoop'),ctx);
const L=ctx.XD.L;const gun=(w,x,y,z)=>{const d={w,x,y,z};L.push(d);return d;};
// Standing at y 5 looking along -z: a gun 1.5 m ahead on the floor needs the crosshair on it.
const v=gun('Vandal',0,5,-1.5);ctx.pitch=0;assert.equal(ctx.xdLook(),null,'looking at the horizon does not target a gun at your feet 1.5 m away');
ctx.pitch=-Math.atan2(1.5,1.5);assert.equal(ctx.xdLook(),v,'crosshair on the gun targets it');
ctx.yaw=Math.PI;assert.equal(ctx.xdLook(),null,'turned away: no target');ctx.yaw=0;
const feet=gun('Sheriff',.3,5,.2);ctx.pitch=0;assert.equal(ctx.xdLook(),feet,'a gun under your feet is always targetable');L.pop();
gun('Operator',0,8,-1.5);ctx.pitch=Math.atan2(1.4,1.5);assert.equal(ctx.xdLook(),null,'a gun on a ledge 3 m up is out of reach');L.pop();
gun('Phantom',0,5,-3);ctx.pitch=-Math.atan2(1.5,3);assert.equal(ctx.xdLook()&&ctx.xdLook().w,'Vandal','beyond 2 m is ignored; nearer gun is the one in view');L.pop();
// Prompt shows the weapon name with the F key and hides when nothing is targeted.
ctx.pitch=-Math.atan2(1.5,1.5);assert.equal(ctx.xdPrompt(),v);const el=els.xdPrompt;assert(el,'prompt element created');assert.equal(el.style.display,'flex');assert.equal(el.lastChild.textContent,'Pick up Vandal');assert.equal(el.firstChild.textContent,'F');
ctx.pitch=0;ctx.xdPrompt();assert.equal(el.style.display,'none','hidden without a target');ctx.player.hp=0;ctx.pitch=-Math.atan2(1.5,1.5);ctx.xdPrompt();assert.equal(el.style.display,'none','hidden while dead');ctx.player.hp=100;
// Online: fw rows from the server become floor guns; F sends the targeted id; G only drops a held primary; ld syncs slots.
L.length=0;ctx.xdOnFlag=false;let loads=[];
vm.runInContext('var NET={socket:{}};var MP={st:"game",m5:true};var netSend=m=>sent.push(m);function mpCliSnap(m){return 1;}function mpCliRS(m){}function mpReset(){}function mpCliLoad(ld){loads.push(ld);}var loads=[];function swapW(){}\n'+cut(net,'const netFloor=new Map();','// Online soul resources').replace("document.addEventListener('keydown',","keyHandlers.push(").replace(/,true\);\s*$/,');')+';globalThis.netFloor=netFloor;globalThis.getLoads=()=>loads;',Object.assign(ctx,{keyHandlers}));
ctx.mpCliSnap({t:'s',fw:[[7,'Vandal',0,5,-1.5],[8,'Bogus',0,5,0],[9,'Phantom',10,5,10]]});assert.equal(JSON.stringify([...ctx.netFloor.keys()]),'[7,9]','valid rows rendered, unknown weapons ignored');
assert.equal(ctx.netFloor.get(7).m.position.y,5.08,'rendered on its floor height');assert.equal(ctx.xdFloorList().length,2,'prompt reads the server floor online');
const ev=code=>({code,repeat:false,stopImmediatePropagation(){this.stopped=true;}});ctx.pitch=-Math.atan2(1.5,1.5);const f=ev('KeyF');ctx.keyHandlers[0](f);assert.equal(JSON.stringify(ctx.sent.pop()),'{"t":"pick","id":7}');assert(f.stopped,'F consumed');
ctx.rw='pis';ctx.keyHandlers[0](ev('KeyG'));assert.equal(ctx.sent.length,0,'G with a sidearm in hand sends nothing');ctx.rw='pri';ctx.keyHandlers[0](ev('KeyG'));assert.equal(JSON.stringify(ctx.sent.pop()),'{"t":"dropw"}');
ctx.mpCliSnap({t:'s',fw:[[9,'Phantom',10,5,10]]});assert.equal(JSON.stringify([...ctx.netFloor.keys()]),'[9]','picked gun removed');assert.equal(ctx.XD.P.length,1,'mesh returned to the pool');
ctx.mpCliRS({ld:['Phantom','Classic']});assert.equal(JSON.stringify(ctx.getLoads().pop()),'["Phantom","Classic"]','round-state loadout change re-syncs slots');ctx.FV.pri='Phantom';ctx.mpCliRS({ld:['Phantom','Classic']});assert.equal(ctx.getLoads().length,0,'unchanged loadout is not re-applied');
console.log('Floor pick-up client: 3D look-at targeting, feet radius, ledge/range limits, [F] Pick up prompt, elevated drops; online fw rows, F pick id, G primary-only dropw, ld slot sync');
