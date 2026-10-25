// Offline (page) spread = server spread, from the shipped feel layer: gSpread / gFire extracted from feel_runtime.js and run
// against the shared motor (vendor/valorant-feel.js). A jumping scoped Operator's shots spread over VALORANT's 15 deg
// airborne cone (wiki.playvalorant.com/en-us/Operator, "Spread values"), standing still they go dead centre, and for every
// gun and movement state the page's cone equals the server's (Motor.spread, the same function online).
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('node:assert/strict');
const root=path.join(__dirname,'..'),M=require(path.join(root,'vendor/valorant-feel.js')),weapons=require(path.join(root,'server/src/weapons.json')).weapons;
assert.equal(fs.readFileSync(path.join(root,'vendor/valorant-feel.js'),'utf8'),fs.readFileSync(path.join(root,'server/src/motor.cjs'),'utf8'),'client motor = server motor');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8'),feel=fs.readFileSync(path.join(__dirname,'feel_runtime.js'),'utf8');
const i=feel.indexOf('gSpread=function'),j=feel.indexOf('// Aim range',i);assert(i>=0&&j>i,'gSpread / gFire in the feel layer');const src=feel.slice(i,j);assert(html.includes(src),'shipped in index.html');
const THREE=require(path.join(root,'server/node_modules/three/build/three.cjs'));
const ctx={THREE,Math,performance:{now:()=>0},VF:{model:M,time:10,shot:-10,bloom:0,sequence:0},vfProfile:w=>weapons[w],player:{},ads:0,xCU:0,xAD:{},spray:0,sprW:'',rcl:0,rclH:0,gSpread:null,gFire:null};vm.createContext(ctx);vm.runInContext(src,ctx);
const deg=x=>Math.atan(x)*180/Math.PI;
// 1. Every gun / state / ADS: page cone = server cone.
for(const w of Object.keys(M.SPREAD))for(const st of [{sf:0},{sf:0,cr:true},{sf:.5,cr:true},{sf:.5,wk:true},{sf:1},{sf:1,air:true},{sf:0,lp:.1}])for(const ads of [0,1,2]){ctx.player=Object.assign({mv:st.sf>0},st);ctx.ads=ads;ctx.VF.bloom=0;
 const page=ctx.gSpread(w,{rec:1}),server=M.spread(Object.assign({},st,{ads,mv:st.sf>0}),w,weapons[w]);assert(Math.abs(page-server)<1e-12,`${w} ${JSON.stringify(st)} ads ${ads}: page ${page} server ${server}`);}
// 2. Jumping scoped Operator (ads 2 = scoped): every shot inside the 15 deg cone, most well off centre; still = dead centre.
const fire=(air)=>{ctx.player={air,mv:false,sf:0};ctx.ads=2;Object.assign(ctx.VF,{time:ctx.VF.time+2,shot:-10,bloom:0,sequence:0,recoilX:0,recoilY:0});ctx.rcl=ctx.rclH=0;const d=new THREE.Vector3(0,0,-1);ctx.gFire(d,'Operator',{rec:1.5});return deg(Math.hypot(d.x,d.y)/-d.z);};
assert(fire(false)<1e-9,'scoped Operator still: dead centre');assert(Math.abs(deg(ctx.gSpread('Operator',{rec:1.5}))-0)<1e-9);
ctx.player={air:true};assert(Math.abs(deg(ctx.gSpread('Operator',{rec:1.5}))-15)<1e-9,'scoped airborne cone 15 deg');
const air=Array.from({length:300},()=>fire(true));assert(Math.max(...air)<=15+1e-6&&Math.max(...air)>12,'airborne shots fill the 15 deg cone ('+Math.max(...air)+')');assert(air.filter(x=>x>5).length>200,'most airborne scoped shots are off a 5 deg window');
// 3. The hip-fire crosshair gap follows the cone (index.html: gt = gSpread * 450, capped 40 px): airborne opens it fully.
assert(html.includes('const xe = S.xhd !== false && CW && running ? xhErr(cw, CW) : null')&&html.includes('m: Math.min(40, Math.max(0, moving - still) * 450)'),'crosshair gap formula (xhErr: movement error = moving cone over the still one, x450, cap 40)');ctx.ads=0;ctx.player={sf:0};const still=Math.min(40,ctx.gSpread('Vandal',{rec:1})*450);ctx.player={air:true};const jump=Math.min(40,ctx.gSpread('Vandal',{rec:1})*450);assert(still<3&&jump===40,`crosshair gap still ${still} airborne ${jump}`);
console.log('Page spread = server spread for 18 guns x 7 states x hip/ADS/scoped; jumping scoped Operator fills the 15 deg cone offline; crosshair gap tracks the cone');
