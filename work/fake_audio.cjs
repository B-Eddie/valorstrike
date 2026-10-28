// A fake Web Audio API for the page harness (work/page_harness.cjs) that behaves like a browser's autoplay policy:
// a context starts 'suspended', resume() only takes effect inside a user gesture (the harness's dispatch of a
// pointerdown / touchend / mousedown / keydown / click), and it can be pushed into iOS's 'interrupted' state. It counts
// every source node started (oscillator / buffer source / constant source) and remembers which of those started while
// the context was running, so a test can tell "a sound was scheduled" from "a sound was heard". ctorOutside counts contexts
// constructed outside a gesture (Firefox: "An AudioContext was prevented from starting automatically").
'use strict';
const GESTURES=new Set(['pointerdown','pointerup','touchstart','touchend','mousedown','mouseup','keydown','keyup','click']);
function install(H,opt={}){
 const GEST=opt.gestures?new Set(opt.gestures):GESTURES;
 const rec={ctorOutside:0,refused:0,contexts:[],started:0,audible:0,resumeCalls:0,resumeInGesture:0,rejectNext:opt.rejectFirst|0};
 let gesture=0;
 const d0=H.dispatch;H.dispatch=function(t,e){const g=e&&GEST.has(e.type);if(g)gesture++;try{return d0.apply(this,arguments);}finally{if(g)gesture--;}};
 const P=v=>({value:v,defaultValue:v,setValueAtTime(){return this},linearRampToValueAtTime(){return this},exponentialRampToValueAtTime(){return this},setTargetAtTime(){return this},cancelScheduledValues(){return this},cancelAndHoldAtTime(){return this},setValueCurveAtTime(){return this}});
 class Node{constructor(ctx,kind){this.context=ctx;this.kind=kind;this.gain=P(1);this.frequency=P(440);this.detune=P(0);this.Q=P(1);this.playbackRate=P(1);this.pan=P(0);this.offset=P(1);this.delayTime=P(0);this.threshold=P(-24);this.knee=P(30);this.ratio=P(12);this.attack=P(0.003);this.release=P(0.25);this.positionX=P(0);this.positionY=P(0);this.positionZ=P(0);this.orientationX=P(1);this.orientationY=P(0);this.orientationZ=P(0);this.outs=[];}
  connect(n){this.outs.push(n);return n;}disconnect(){this.outs=[];}setPosition(){}setOrientation(){}
  start(){if(this.started)throw Error('InvalidStateError: start twice');this.started=1;rec.started++;const c=this.context;if(c.state==='running'&&this.reaches())rec.audible++;}
  stop(){this.stopped=1;if(this.onended)try{this.onended()}catch(e){}}
  reaches(seen=new Set()){if(this===this.context.destination)return true;if(seen.has(this))return false;seen.add(this);return this.outs.some(o=>o&&o.reaches&&o.reaches(seen));}}
 class Buf{constructor(ch,len,sr){this.numberOfChannels=ch;this.length=len;this.sampleRate=sr;this.duration=len/sr;this._d=[...Array(ch)].map(()=>new Float32Array(len));}getChannelData(i){return this._d[i];}copyToChannel(){}}
 class AC{constructor(){if(opt.ctorThrows>0){opt.ctorThrows--;throw Error('NotSupportedError: failed to start audio device');}this.state='suspended';this.sampleRate=48000;this.currentTime=0;this.baseLatency=0.01;this.destination=new Node(this,'dest');
   this.listener=Object.assign(new Node(this,'listener'),{forwardX:P(0),forwardY:P(0),forwardZ:P(-1),upX:P(0),upY:P(1),upZ:P(0)});this.onstatechange=null;this._l={};rec.contexts.push(this);if(!gesture)rec.ctorOutside++;}
  _set(s){if(this.state===s)return;this.state=s;if(this.onstatechange)try{this.onstatechange()}catch(e){}for(const f of this._l.statechange||[])try{f({type:'statechange'})}catch(e){}}
  addEventListener(t,f){(this._l[t]=this._l[t]||[]).push(f);}removeEventListener(t,f){this._l[t]=(this._l[t]||[]).filter(x=>x!==f);}
  resume(){rec.resumeCalls++;if(this.state==='closed')return Promise.reject(Error('InvalidStateError'));
   if(gesture){rec.resumeInGesture++;if(rec.rejectNext>0){rec.rejectNext--;return Promise.reject(Error('NotAllowedError: failed to start audio device'));}this._set('running');return Promise.resolve();}
   if(opt.webkit){rec.refused++;return Promise.reject(Error('Failed to start the audio device'));} // WebKit (iOS Safari): refused outside a gesture
   return new Promise(()=>{});} // Chrome: outside a gesture the promise stays pending and the context suspended
  suspend(){if(this.state!=='closed')this._set('suspended');return Promise.resolve();}
  close(){this._set('closed');return Promise.resolve();}
  interrupt(){this._set(opt.interruptState||'interrupted');} // test hook: iOS call / Siri / another app took the device
  createGain(){return new Node(this,'gain')}createOscillator(){return new Node(this,'osc')}createBufferSource(){const n=new Node(this,'buf');n.buffer=null;n.loop=false;return n}
  createConstantSource(){return new Node(this,'const')}createBiquadFilter(){return new Node(this,'biquad')}createPanner(){return new Node(this,'panner')}createStereoPanner(){return new Node(this,'span')}
  createDynamicsCompressor(){return new Node(this,'comp')}createConvolver(){return new Node(this,'conv')}createWaveShaper(){return new Node(this,'shaper')}createDelay(){return new Node(this,'delay')}
  createAnalyser(){const n=new Node(this,'an');n.fftSize=2048;n.frequencyBinCount=1024;n.getByteFrequencyData=n.getFloatTimeDomainData=n.getByteTimeDomainData=()=>{};return n}
  createChannelMerger(){return new Node(this,'merge')}createChannelSplitter(){return new Node(this,'split')}createPeriodicWave(){return {}}createMediaElementSource(){return new Node(this,'media')}
  createBuffer(ch,len,sr){return new Buf(ch,len,sr)}
  decodeAudioData(b,ok,err){const B=new Buf(1,4800,48000);if(ok)setTimeout(()=>ok(B),0);return Promise.resolve(B);}}
 H.win.AudioContext=AC;H.win.webkitAudioContext=AC;
 rec.tick=dt=>{for(const c of rec.contexts)if(c.state==='running')c.currentTime+=dt;};
 rec.ctx=()=>rec.contexts[rec.contexts.length-1];
 return rec;
}
module.exports={install};
