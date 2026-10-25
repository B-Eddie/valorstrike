// Weapon skins online: the server stores each player's equipped skin ids (free, cosmetic), validates them against
// src/skins.json and relays them; invalid ids, unknown weapons and malformed payloads are rejected whole. Floor guns
// carry the dropper's skin in their snapshot row.
import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';
import {cleanSkins,validSkin,SKIN_WEAPONS,SKIN_IDS} from './src/skins.js';
import {floorDrop,floorRows} from './src/floor.js';
const cat=JSON.parse(fs.readFileSync(new URL('./src/skins.json',import.meta.url),'utf8'));
// Catalogue: 18 guns + knife; Valorant collection names, per-weapon availability and variants; ids collection or collection.N
assert.equal(SKIN_WEAPONS.length,19);for(const w of ['Classic','Shorty','Frenzy','Ghost','Sheriff','Stinger','Spectre','Bucky','Judge','Bulldog','Guardian','Phantom','Vandal','Marshal','Outlaw','Operator','Ares','Odin','Knife'])assert(SKIN_WEAPONS.includes(w),w);
assert(cat.collections.length>=12);for(const c of cat.collections)for(const [w,s] of Object.entries(c.skins)){assert(SKIN_WEAPONS.includes(w),w);if(c.id!=='standard'&&w!=='Knife')assert(s.n.startsWith(c.name+' ')&&s.n.endsWith(' '+w),s.n);}
assert.equal(cat.collections.find(c=>c.id==='prime').skins.Vandal.n,'Prime Vandal');assert.equal(cat.collections.find(c=>c.id==='prism').skins.Operator.n,'Prism Operator');assert.equal(cat.collections.find(c=>c.id==='prime').skins.Knife.n,'Prime Axe');assert.deepEqual(cat.collections.find(c=>c.id==='prime').skins.Vandal.ch,['Base','Orange','Blue','Yellow']);
assert(validSkin('Vandal','standard')&&validSkin('Vandal','prime')&&validSkin('Vandal','prime.3')&&!validSkin('Vandal','prime.4')&&!validSkin('Phantom','prime')&&!validSkin('Vandal','Reaver')&&!validSkin('Vandal','toString')&&!validSkin('toString','prime')&&!validSkin('Vandal','__proto__')&&!validSkin('Vandal',1)&&!validSkin('Vandal',null));
assert.equal([...SKIN_IDS.values()].reduce((n,s)=>n+s.size,0),cat.collections.reduce((n,c)=>n+Object.values(c.skins).reduce((k,s)=>k+s.ch.length,0),0));
assert.deepEqual(cleanSkins({Vandal:'prime.1',Knife:'blastx',Classic:'standard'}),{Vandal:'prime.1',Knife:'blastx'});
for(const bad of [null,'x',[],{Vandal:'Prime Vandal'},{Vandal:'prime.9'},{Vandal:'prime2'},{Vandal:'champions21.1'},{Laser:'prime'},{__proto__:null,toString:'prime'},{Vandal:{}},Object.fromEntries(Array.from({length:30},(_,i)=>['W'+i,'prime']))])assert.equal(cleanSkins(bad),null,JSON.stringify(bad));
assert.deepEqual(cleanSkins(JSON.parse('{"__proto__":"prime"}')),null,'__proto__ key rejected');
// Room protocol (GameRoom class run in a sandbox, as test-protocol.cjs does)
const src=fs.readFileSync(new URL('./src/worker.js',import.meta.url),'utf8');const code=src.slice(src.indexOf('export class GameRoom')).replace('export class','class')+';globalThis.GameRoom=GameRoom;';
const context={DurableObject:class{constructor(ctx,env){this.ctx=ctx;this.env=env}},crypto:globalThis.crypto,Date,URL,performance,setInterval,clearInterval,Map,JSON,Number,Object,kits:JSON.parse(fs.readFileSync(new URL('./src/kits.json',import.meta.url),'utf8')),cleanSkins};vm.createContext(context);vm.runInContext(code,context);
const r=new context.GameRoom({},{DIRECTORY:{idFromName:()=>'',get:()=>({fetch:async()=>new Response('{}',{status:401})})}});r.advertise=()=>{};
let nextId=5;r.sim={phase:'room',units:[],mode:'tdm',map:'ascent',add(n,ag){const u={id:nextId++,name:n,agent:ag,human:true,team:0};this.units.push(u);return u;},rows(){return [];},remaining:0,maxKills:40};
const mk=()=>{const out=[];const ws={close(){},send(m){out.push(JSON.parse(m))}};r.sessions.set(ws,{id:String(nextId),count:0,window:Date.now(),last:0});return {ws,out};};
const A=mk();await r.message(A.ws,JSON.stringify({t:'hi',n:'alpha',ag:'Jett',sk:{Vandal:'prime.1',Knife:'blastx'}}));
const ua=r.sessions.get(A.ws).u;assert.deepEqual({...ua.skins},{Vandal:'prime.1',Knife:'blastx'});
assert.deepEqual(A.out.map(m=>m.t).slice(0,3),['welcome','sks','sk']);assert.deepEqual(A.out[2].s,{Vandal:'prime.1',Knife:'blastx'});
const B=mk();await r.message(B.ws,JSON.stringify({t:'hi',n:'bravo',ag:'Sage',sk:{Vandal:'Prime Vandal'}}));
const ub=r.sessions.get(B.ws).u;assert.deepEqual({...ub.skins},{},'invalid hi skins dropped, player still joins');
const sks=B.out.find(m=>m.t==='sks');assert.deepEqual(sks.m[ua.id],{Vandal:'prime.1',Knife:'blastx'},'joiner gets the room skins');
// valid change is relayed to everyone
A.out.length=B.out.length=0;await r.message(B.ws,JSON.stringify({t:'sk',s:{Phantom:'blastx.2',Operator:'prism'}}));
assert.deepEqual({...ub.skins},{Phantom:'blastx.2',Operator:'prism'});for(const o of [A.out,B.out])assert.deepEqual(o.find(m=>m.t==='sk'),{t:'sk',id:ub.id,s:{Phantom:'blastx.2',Operator:'prism'}});
// invalid ids are rejected: nothing stored, nothing relayed, the sender told
for(const bad of [{Phantom:'blastx.7'},{Phantom:'blastx',Laser:'blastx'},'blastx',[1],{Phantom:'<img>'},{Phantom:'prime'}]){A.out.length=B.out.length=0;await r.message(B.ws,JSON.stringify({t:'sk',s:bad}));
 assert.deepEqual({...ub.skins},{Phantom:'blastx.2',Operator:'prism'},'unchanged after '+JSON.stringify(bad));assert(!A.out.some(m=>m.t==='sk'),'not relayed');assert(B.out.some(m=>m.t==='skr'),'sender told');}
// match start: every client is sent the room skins before 'start'
A.out.length=0;r.begin(A.ws);assert.deepEqual(A.out.map(m=>m.t),['sks','start']);assert.deepEqual(A.out[0].m[ub.id],{Phantom:'blastx.2',Operator:'prism'});
// floor rows: the dropper's skin rides with the gun; others stay 5 wide
const sim={time:0,units:[{id:1,skins:{Vandal:'prime.1'}},{id:2,skins:{}}],floor:[],world:{ground:()=>0}};
floorDrop(sim,'Vandal',0,0,0,25,50,1);floorDrop(sim,'Phantom',1,0,1,25,50,2);floorDrop(sim,'Vandal',2,0,2,25,50,null);
const rows=floorRows(sim);assert.equal(rows[0][5],'prime.1');assert.equal(rows[1].length,5);assert.equal(rows[2].length,5);
console.log('Skins: catalogue ids validated; hi/sk store and relay valid skins, invalid ids rejected whole (skr) and never relayed; room skins sent before start; floor rows carry the dropper skin');
