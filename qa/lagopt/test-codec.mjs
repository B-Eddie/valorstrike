import fs from 'node:fs';import {gunzipSync} from 'node:zlib';import vm from 'node:vm';import assert from 'node:assert/strict';
import {encodeSnapshot} from '../../server/src/snapshot-codec.js';
const src=fs.readFileSync('work/server_runtime.js','utf8'),weapons=JSON.parse(fs.readFileSync('server/src/weapons.json')).weapons;
const c={NET:{},performance:{now:()=>10000},Date,WEAP:weapons,netSend(){c.requests++;},requests:0};vm.createContext(c);
vm.runInContext(src.slice(src.indexOf('function netClean('),src.indexOf('function netConnect(')),c);
const parse=JSON.parse,wire=x=>parse(JSON.stringify(x)),equal=(a,b,msg)=>assert.deepEqual(wire(a),wire(b),msg);
let frames=0,fullBytes=0,deltaBytes=0;
for(const mode of ['dm','tdm','five']){
 const data=JSON.parse(gunzipSync(fs.readFileSync(`qa/lagopt/before-${mode}-frames.json.gz`))),bases=new Array(5),decoders=new Array(5).fill(null);
 for(let i=0;i<data.length;i++){
  const k=i%5,m=data[i],enc=encodeSnapshot(m,bases[k]);bases[k]=enc.base;c.NET.wireBase=decoders[k];
  const out=c.netDecode(parse(enc.data));assert(out,'decode '+mode+' '+i);equal(out,m,'lossless complete frame '+mode+' '+i);decoders[k]=c.NET.wireBase;
  equal(c.netClean(out),c.netClean(wire(m)),'same validator result');frames++;fullBytes+=Buffer.byteLength(JSON.stringify(m));deltaBytes+=Buffer.byteLength(enc.data);
 }
}
const frame=(q)=>({t:'s',q,u:[[1,0,'P','Jett',0,0,0,0,100,50,1,'Vandal',1,0,1,25]],k:{P:0},d:{P:0},ev:[],tl:100,serverTime:q*50,rs:{t:'rs',tab:1,status:{blind:0},ab:{c:1,cool:{e:5}}},fx:[{kind:'smoke',p:[1,2,3]}]});
// Mutable effects are compared against frozen strings, not aliases into a live simulation.
{const a=frame(1),b=encodeSnapshot(a);a.fx[0].p[0]=99;a.rs.status.blind=1;const next=frame(2);next.fx[0].p[0]=99;next.rs.status.blind=1;const e=encodeSnapshot(next,b.base);c.NET.wireBase=null;c.netDecode(parse(b.data));equal(c.netDecode(parse(e.data)),next,'no live-state alias');}
// Top-level/round-state deletes, same-id reuse, roster join/leave/order changes, keyframes.
{let base=null;c.NET.wireBase=null;for(let i=1;i<=210;i++){const m=frame(i);if(i%3)delete m.fx;if(i%4)delete m.rs.ab;if(i%5)m.rs.status={};if(i%6)m.u.push([2,1,'New','Sage',4,0,2,1,100,50,1,'Ghost',0,0,i]);if(i%7)m.u.reverse();if(i%8)delete m.rs;const e=encodeSnapshot(m,base);base=e.base;equal(c.netDecode(parse(e.data)),m,'roster / removal / keyframe '+i);if(i%100===0)assert.equal(parse(e.data).t,'s');}}
// A broken base requests resync, does not advance state, and never applies a partial patch.
{c.NET.wireBase=null;const e=encodeSnapshot(frame(2),encodeSnapshot(frame(1)).base);assert.equal(c.netDecode(parse(e.data)),null);assert.equal(c.requests,1);c.NET.wireBase=null;c.netDecode(parse(encodeSnapshot(frame(1)).data));for(const bad of [[[-1,4,9]],[[0,0,9]],[[0,99,9]],[[0,4]],null]){c.netDecode(parse(encodeSnapshot(frame(1)).data));assert.equal(c.netDecode({t:'sd',q:2,b:1,c:{},u:bad,ev:[]}),null);assert.equal(c.NET.wireBase,null);}assert.equal(c.requests,1,'resync requests bounded');}
// Patches are atomic: a valid first edit followed by a bad field must not touch the private row.
{c.netDecode(parse(encodeSnapshot(frame(1)).data));const saved=c.NET.wireBase;assert.equal(c.netDecode({t:'sd',q:2,b:1,c:{},u:[[0,4,99],[0,99,1]],ev:[]}),null);assert.equal(saved.u[0][4],0);}
// Prototype-shaped keys remain own data, and cleaned outputs cannot mutate raw baselines.
{const a=frame(1);a.rs.cr=JSON.parse('{"__proto__":123,"P":4}');c.NET.wireBase=null;const out=c.netDecode(parse(encodeSnapshot(a).data));c.netClean(out);out.u[0][4]=999;out.rs.ab.cool.e=999;assert.equal(c.NET.wireBase.u[0][4],0);assert.equal(c.NET.wireBase.rs.ab.cool.e,5);assert.equal({}.polluted,undefined);}
console.log(JSON.stringify({frames,fullBytes,deltaBytes,savedPct:100*(1-deltaBytes/fullBytes),checks:'exact full-frame and post-validator parity; mutable state; roster/order/reset; deletes; periodic keyframes; malformed patches and bounded resync; baseline isolation/prototype keys'}));
