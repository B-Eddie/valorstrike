// Reyna's Dismiss (wiki, v8.11: 1.5 s intangible, top speed 12 m/s): the page's movement (feel_runtime.js moveP, offline
// and the online prediction) and the server (spike.js motor input, reyna.js DISMISS) move a dismissed Reyna at 12 m/s,
// whatever gun she holds, and ignore slows / tags while intangible. Before: the page ran x1.6 the gun's speed (rifle
// 8.64 m/s) and the server had no boost at all (and kept the 65 % slow), so online every Dismiss was corrected back.
//   node work/test_dismiss_speed.cjs
const assert=require('assert/strict'),fs=require('fs'),vm=require('vm'),path=require('path');
const root=path.join(__dirname,'..'),html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const a=html.indexOf('moveP=function(dt,run,hold){\n const P=player;'),b=html.indexOf('\ngSpread=function',a);assert(a>0&&b>a,'feel moveP found');
const VFm=require(path.join(root,'vendor','valorant-feel.js'));const stats=JSON.parse(fs.readFileSync(path.join(root,'server','src','weapons.json'),'utf8')).weapons;
const xTagK=new Function('return '+html.slice(html.indexOf('function xTagK'),html.indexOf('\n',html.indexOf('function xTagK'))).replace(/\}\s*$/,'}'))();
function run(weapon,{dis=0,slow=0,tag=0}={}){const player={x:0,y:0,z:0,vx:0,vz:0,vy:0,ch:0,hp:100};if(tag){player.tagT=5;player.tagK=.275;player.tagS=0;}
 const c={player,J:{dis,dr:0},keys:{KeyW:true},yaw:0,ads:0,Math,VF:{model:VFm},vfWeapon:()=>weapon,vfProfile:w=>stats[w],sgSlow:()=>slow?.5:1,groundAt:()=>0,blocked:()=>false,xTagK,SFX:{land(){},selfStep(){}},running:true,mode:'match',kLg:0,moveP:null};
 vm.createContext(c);vm.runInContext(html.slice(a,b),c);for(let i=0;i<40;i++)c.moveP(.025);return Math.hypot(player.vx,player.vz);}
const close=(v,t,m)=>assert.ok(Math.abs(v-t)<.05,m+': '+v.toFixed(3)+' vs '+t);
close(run('Vandal'),5.4,'Vandal run');close(run('Vandal',{dis:1}),12,'dismissed with a Vandal: 12 m/s');close(run('Classic',{dis:1}),12,'dismissed with a Classic: 12 m/s');
close(run('Vandal',{slow:1}),2.7,'Slow Orb zone halves');close(run('Vandal',{dis:1,slow:1}),12,'intangible: no slow');close(run('Vandal',{dis:1,tag:1}),12,'intangible: no tag');
// the server: same 12 m/s in its motor input, slows and tags skipped, 1.5 s from reyna.js
const spike=fs.readFileSync(path.join(root,'server','src','spike.js'),'utf8'),reyna=fs.readFileSync(path.join(root,'server','src','reyna.js'),'utf8');
assert(/speed:u\.dismissUntil>this\.time\?DISMISS\.speed/.test(spike)&&/tag:u\.dismissUntil>this\.time\?1:tagMul/.test(spike),'server motor input');assert(/DISMISS=Object\.freeze\(\{dur:1\.5,speed:12\}\)/.test(reyna),'server DISMISS 1.5 s / 12 m/s');
console.log('Dismiss speed: page and server 12 m/s whatever the gun, no slow / tag while intangible (Vandal run 5.4, Slow Orb 2.7)');
