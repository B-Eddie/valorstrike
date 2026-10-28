const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const html=fs.readFileSync('index.html','utf8'),old=fs.readFileSync('qa/lagopt/fixtures/client-before.js','utf8');
function cut(s){return s.slice(s.indexOf('function mpCliSnap('),s.indexOf('function mpCliSelf(')>0?s.indexOf('function mpCliSelf('):s.indexOf('function mpInterp('));}
const group=()=>({position:{x:0,y:0,z:0,set(x,y,z){Object.assign(this,{x,y,z});}},rotation:{y:0}});
function context(s){const c={performance:{now:()=>c.now},now:1000,running:true,MP:{st:'game',me:1,DELAY:100,team:0},bots:[],allies:[],FV:{tdm:true},XAG:{Jett:1,Sage:1},SB:{},XBA:{},scene:{remove(){}},dmLive(){},mpClean:x=>x,mpRename:(u,n)=>{u.name=n;},mpDropModel(){},mpCliSelf(){},mpCliKD(){},showStats(){},shots:[],SFX:{at:(p,w)=>c.shots.push([p.x,w])},WEAP:{Vandal:{}},mpMkUnit(e){return {nid:e[0],agent:e[3],name:e[2],g:group(),nb:[],alive:!!e[10]};}};vm.createContext(c);vm.runInContext(cut(s),c);return c;}
const a=context(old),b=context(html),row=(i,n='P'+i)=>[i,i%2,n,'Jett',i,0,-i,0,100,50,1,'Vandal',0,0,1,25,50,0,0];
const shapes=[[2,3,4],[2,3,4],[3,4],[3,4,5],[5,3],[8,9],[],[2,3,4]];
for(let n=0;n<300;n++){const u=shapes[n%shapes.length].map(i=>row(i,n%5?'P'+i:'Renamed'+i));const m={u,serverTime:n*50,ev:u.map(r=>['s',r[0],'Vandal'])};a.now=b.now=n*50+1000;a.mpCliSnap(JSON.parse(JSON.stringify(m)));b.mpCliSnap(JSON.parse(JSON.stringify(m)));
 const snap=c=>JSON.stringify({bots:c.bots.map(u=>({id:u.nid,name:u.name,agent:u.agent,nb:u.nb,alive:u.alive})),allies:c.allies.map(u=>({id:u.nid,name:u.name,agent:u.agent,nb:u.nb,alive:u.alive})),shots:c.shots});assert.equal(snap(a),snap(b),'roster/cache parity at '+n);
 // Replace a unit object under the same id between snapshots (e.g. rebuilding the scene).
 if(n%7===0)for(const c of [a,b])if(c.bots.length)c.bots[0]={...c.bots[0],g:group(),nb:[]};
}
console.log('Client cached lookups: 300 snapshot/event sequences match original across joins, leaves, rename, empty/rebuilt rosters and reused ids');
