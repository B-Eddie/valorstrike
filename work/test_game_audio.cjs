// Downloaded-audio graph, quality and polyphony regression.
// The strict fake rejects null, non-AudioNode and cross-AudioContext connections. The context swap is the
// reproduction for the browser crash: the old implementation reused GA.slots after ac/master were replaced,
// so source.connect(oldSlot.gain) threw "AudioNode.connect: Argument 1 is not valid...".
const fs=require('fs'),vm=require('vm'),assert=require('assert/strict'),crypto=require('crypto');
const m=JSON.parse(fs.readFileSync('audio/manifest.json'));
for(const[k,f]of Object.entries(m.files)){const b=fs.readFileSync(f.url);assert.equal(b.length,f.bytes,k);assert.equal(crypto.createHash('sha256').update(b).digest('hex'),f.sha256,k);assert(f.duration>0&&f.duration<30,k);assert(f.source.startsWith('https://'),k);}
assert.equal(Object.keys(m.weapons).length,19);for(const c of ['prime','blastx'])for(const i of [1,2,3,4,5])assert(m.files[c+'/kill'+i]);for(const k of Object.values(m.abilities))assert(m.files[k],k);
let created=0,starts=0,stops=0;
class N{constructor(context,kind='node'){this.context=context;this.kind=kind;this.gain={value:1};this.playbackRate={value:1};this.positionX={value:0};this.positionY={value:0};this.positionZ={value:0};this.outs=[];}
 connect(n){if(!(n instanceof N)||n.context!==this.context)throw TypeError('AudioNode.connect: Argument 1 is not valid for any of the 2-argument overloads.');this.outs.push(n);this.to=n;return n;}
 disconnect(){this.outs=[];this.to=null;}start(){starts++;this.started=true;}stop(){stops++;if(this.onended)this.onended();}
}
function makeAC(){const a={currentTime:0,state:'running',destination:null};a.destination=new N(a,'destination');a.createGain=()=>new N(a,'gain');a.createPanner=()=>{created++;return new N(a,'panner')};a.createBufferSource=()=>new N(a,'source');a.decodeAudioData=(b,ok)=>ok({duration:.5,length:22050,numberOfChannels:1});return a;}
let ac=makeAC(),master=new N(ac,'master');
const c={window:{},document:{hidden:false,addEventListener(){}},S:{muted:false},ac,master,audio(){},sPos(n,p){n.positionX.value=p.x;n.positionY.value=p.y;n.positionZ.value=p.z},sOk:()=>true,sNz(){},sTn(){},blip(){},annc(){},SFX:{},xDmgFlash(){},ambTick(){},AMB:{},xHitSfx(){},xHitKillSfx(){},xKiAdd(){},kill(){},xskChanged(){},addEventListener(){},setTimeout(){},requestIdleCallback(){},fetch:async()=>({ok:false,status:404}),console,performance:{now:()=>0},Map,Set,Promise,Number,Math,Array,Object,Error,Response,GA_MANIFEST:m};c.window=c;c.requestIdleCallback=()=>{};vm.createContext(c);vm.runInContext(fs.readFileSync('work/audio_runtime.js','utf8').replace('/*GAME_AUDIO_JSON*/null',JSON.stringify(m)),c);
const xe=code=>vm.runInContext(code,c);const keys=['standard/Vandal/fire','ability/dash','feedback/body','voice/AnnouncerFight1','event/boom'];for(const k of keys)xe(`GA.buffers.set(${JSON.stringify(k)},{duration:.3,length:14400,numberOfChannels:1})`);
const a=xe('gaPlay("standard/Vandal/fire","gun",{position:{x:2,y:1,z:4}})');assert(a&&a.source);assert.equal(a.pan.positionX.value,2);assert.equal(a.gain.to,a.pan);assert.equal(a.pan.to,c.master);assert.equal(created,24,'panners allocated once before combat');
for(let i=0;i<5;i++)assert(xe('gaPlay("standard/Vandal/fire","gun")'),'rapid gun play should be accepted while under the cap');
for(const [k,g] of [['ability/dash','ability'],['feedback/body','feedback'],['voice/AnnouncerFight1','voice'],['event/boom','ability']])assert(xe(`gaPlay(${JSON.stringify(k)},${JSON.stringify(g)})`),g+' should coexist with gunfire');
assert.equal(starts,10,'gunfire, ability, hit feedback and announcer overlap');assert.equal(xe('GA.slots.filter(s=>s.source).length'),10,'overlap retains independent live voices');
for(let i=0;i<100;i++)xe('gaPlay("standard/Vandal/fire","gun")');assert.equal(xe('GA.counts["standard/Vandal/fire"]'),6,'gun voice limit is enforced without throwing');assert.equal(created,24,'rapid plays do not allocate panners');
xe('for(const s of GA.slots)if(s.source&&s.source.onended)s.source.onended()');for(let i=0;i<6;i++)assert(xe('gaPlay("standard/Vandal/fire","gun")'));assert.equal(xe('GA.slots.filter(s=>s.source).length'),6);
// Failing reproduction: replace the context/master after the old pool exists. Strict connect would throw here;
// the fixed pool detects the ownership change, discards old nodes, and rebuilds before connecting.
const old=xe('GA.slots');ac=makeAC();master=new N(ac,'master');c.ac=ac;c.master=master;const after=xe('gaPlay("standard/Vandal/fire","gun")');assert(after&&after.source,'playback survives an AudioContext replacement');assert.notEqual(xe('GA.slots'),old);assert(xe('GA.slots').every(s=>s.context===ac&&s.gain.context===ac&&s.pan.context===ac));assert.deepEqual(xe('Object.keys(GA.errors)'),[],'no audio graph exceptions');assert.equal(created,48,'replacement rebuilds one fresh 24-slot pool');
xe('gaStop()');assert(xe('GA.slots.every(s=>s.source===null)'));assert(stops>0,'stopping releases sources');
console.log('Audio: '+Object.keys(m.files).length+' verified MP3s; strict cross-context crash reproduction fixed; 24-slot polyphony; gun cap; overlap, rapid reuse, stop/rebuild and no graph exceptions');
