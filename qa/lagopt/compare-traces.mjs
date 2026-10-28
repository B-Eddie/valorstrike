// Final full decoded worker output must match the initial unmodified simulation on the same deterministic workload.
import fs from 'node:fs';import vm from 'node:vm';import {gunzipSync} from 'node:zlib';import assert from 'node:assert/strict';
const source=fs.readFileSync('work/server_runtime.js','utf8'),c={NET:{},performance,Date,netSend(){throw Error('unexpected resync');}};vm.createContext(c);vm.runInContext(source.slice(source.indexOf('function netClean('),source.indexOf('function netConnect(')),c);
const read=p=>JSON.parse(gunzipSync(fs.readFileSync(p)));let count=0;
for(const mode of ['dm','tdm','five']){const before=read(`qa/lagopt/before-${mode}-frames.json.gz`),after=read(`qa/lagopt/after-r3-${mode}-frames.json.gz`),bases=read(`qa/lagopt/after-r3-${mode}-bases.json.gz`);assert.equal(after.length,before.length);
 for(let i=0;i<after.length;i++){c.NET.wireBase=bases[i%5];const decoded=c.netDecode(after[i]);bases[i%5]=c.NET.wireBase;assert.deepEqual(JSON.parse(JSON.stringify(decoded)),before[i],`${mode} frame ${i}`);count++;}}
console.log(`${count} final decoded worker frames exactly match original full-state frames: unit state, fog, events, round state, clocks and scores`);
