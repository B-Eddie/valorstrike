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
 const P0=v=>({value:v,defaultValue:v,setValueAtTime(){return this},linearRampToValueAtTime(){return this},exponentialRampToValueAtTime(){return this},setTargetAtTime(){return this},cancelScheduledValues(){return this},cancelAndHoldAtTime(){return this},setValueCurveAtTime(){return this}});
 // strict: throw what Chrome / Firefox throw (non-finite AudioParam values / times, an exponential ramp to 0, negative
 // times, connect to something that is not a node / param of the same context, start twice, stop before start). Every
 // violation is also logged in rec.violations with its stack, so one swallowed by a page try / catch is still seen.
 const V=(cond,Err,msg)=>{if(cond)return;const e=new Err(msg);rec.violations.push({m:msg,s:String(e.stack).split('\n').slice(2,14).join(' | ')});throw e;};
 const fin=x=>typeof x==='number'&&Number.isFinite(x);
 class SP{constructor(v){this._v=v;this.defaultValue=v;}get value(){return this._v;}set value(x){V(fin(x),TypeError,"Failed to set the 'value' property on 'AudioParam': The provided float value is non-finite.");this._v=x;}
  // firefox: Gecko's AudioEventTimeline - no event may land inside a value curve (cancelScheduledValues(t) keeps a
  // curve that started before t, unlike Chrome), and a curve may not overlap any other event:
  // "AudioParam.setValueAtTime: Can't add events during a curve event" / "Can't add curve events that overlap other events"
  _ev(t,name,v){if(!opt.firefox)return;const ev=this._e||(this._e=[]);V(!ev.some(e=>e.d&&t>=e.t&&t<e.t+e.d),Error,'NotSupportedError: AudioParam.'+name+": Can't add events during a curve event");ev.push({t,v});}
  setValueAtTime(v,t){V(fin(v)&&fin(t),TypeError,"Failed to execute 'setValueAtTime' on 'AudioParam': The provided float value is non-finite.");V(t>=0,RangeError,"setValueAtTime: time < 0");this._ev(t,'setValueAtTime',v);return this;}
  linearRampToValueAtTime(v,t){V(fin(v)&&fin(t),TypeError,"Failed to execute 'linearRampToValueAtTime' on 'AudioParam': The provided float value is non-finite.");V(t>=0,RangeError,"linearRamp: time < 0");this._ev(t,'linearRampToValueAtTime');return this;}
  exponentialRampToValueAtTime(v,t){V(fin(v)&&fin(t),TypeError,"Failed to execute 'exponentialRampToValueAtTime' on 'AudioParam': The provided float value is non-finite.");V(v!==0,RangeError,"Failed to execute 'exponentialRampToValueAtTime' on 'AudioParam': The float target value provided (0) should not be in the range (-1.40130e-45, 1.40130e-45).");V(t>=0,RangeError,"exponentialRamp: time < 0");this._ev(t,'exponentialRampToValueAtTime');return this;}
  setTargetAtTime(v,t,c){V(fin(v)&&fin(t)&&fin(c),TypeError,"Failed to execute 'setTargetAtTime' on 'AudioParam': The provided float value is non-finite.");V(t>=0&&c>=0,RangeError,"setTargetAtTime: time / timeConstant < 0");this._ev(t,'setTargetAtTime');return this;}
  cancelScheduledValues(t){V(fin(t)&&t>=0,RangeError,'cancelScheduledValues: bad time');if(this._e)this._e=this._e.filter(e=>e.t<t);return this;}cancelAndHoldAtTime(t){V(fin(t)&&t>=0,RangeError,'cancelAndHoldAtTime: bad time');return this;}
  setValueCurveAtTime(c,t,d){V(fin(t)&&fin(d)&&t>=0&&d>0,RangeError,'setValueCurveAtTime: bad time / duration');if(opt.firefox){const ev=this._e||(this._e=[]);V(!ev.some(e=>e.d?(t<e.t+e.d&&e.t<t+d):(e.t>=t&&e.t<=t+d)),Error,"NotSupportedError: AudioParam.setValueCurveAtTime: Can't add curve events that overlap other events");ev.push({t,d});}return this;}}
 const P=opt.strict?(v=>new SP(v)):P0;rec.violations=[];
 class Node{constructor(ctx,kind){this.context=ctx;this.kind=kind;this.gain=P(1);this.frequency=P(440);this.detune=P(0);this.Q=P(1);this.playbackRate=P(1);this.pan=P(0);this.offset=P(1);this.delayTime=P(0);this.threshold=P(-24);this.knee=P(30);this.ratio=P(12);this.attack=P(0.003);this.release=P(0.25);this.positionX=P(0);this.positionY=P(0);this.positionZ=P(0);this.orientationX=P(1);this.orientationY=P(0);this.orientationZ=P(0);this.outs=[];}
  connect(n){if(opt.strict){V(n instanceof Node||n instanceof SP,TypeError,"Failed to execute 'connect' on 'AudioNode': Overload resolution failed. (AudioNode.connect: Argument 1 is not valid for any of the 2-argument overloads.)");if(n instanceof Node)V(n.context===this.context,Error,"InvalidAccessError: Failed to execute 'connect' on 'AudioNode': cannot connect to an AudioNode belonging to a different audio context.");}this.outs.push(n);return n;}disconnect(){this.outs=[];}setPosition(){}setOrientation(){}
  start(w,o,d){if(opt.strict){V(!this.started,Error,"InvalidStateError: Failed to execute 'start' on 'AudioScheduledSourceNode': cannot call start more than once.");for(const x of [w,o,d])if(x!==undefined)V(fin(x)&&x>=0,RangeError,"Failed to execute 'start' on 'AudioBufferSourceNode': The start time / offset / duration provided ("+x+") is less than the minimum bound (0) or non-finite.");}if(this.started)throw Error('InvalidStateError: start twice');this.started=1;rec.started++;const c=this.context;if(c.state==='running'&&this.reaches())rec.audible++;}
  stop(w){if(opt.strict){V(this.started,Error,"InvalidStateError: Failed to execute 'stop' on 'AudioScheduledSourceNode': cannot call stop without calling start first.");if(w!==undefined)V(fin(w)&&w>=0,RangeError,"Failed to execute 'stop' on 'AudioScheduledSourceNode': The stop time provided ("+w+") is less than the minimum bound (0) or non-finite.");}this.stopped=1;if(this.onended)try{this.onended()}catch(e){}}
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
  // opt.undecodable(bytes) true: the bytes do not decode. As in Chrome and Firefox, the error callback runs AND the
  // promise decodeAudioData returns rejects (an unhandled rejection unless the caller handles that promise too).
  decodeAudioData(b,ok,err){if(opt.undecodable&&opt.undecodable(b)){const e=new Error('EncodingError: The buffer passed to decodeAudioData contains an unknown content type.');if(err)setTimeout(()=>err(e),0);return Promise.reject(e);}const B=new Buf(1,4800,48000);if(ok)setTimeout(()=>ok(B),0);return Promise.resolve(B);}}
 H.win.AudioContext=AC;H.win.webkitAudioContext=AC;
 rec.tick=dt=>{for(const c of rec.contexts)if(c.state==='running')c.currentTime+=dt;};
 rec.ctx=()=>rec.contexts[rec.contexts.length-1];
 return rec;
}
module.exports={install};
