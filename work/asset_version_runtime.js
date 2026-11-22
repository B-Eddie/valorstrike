// ---- ASSET VERSIONS ----
// Permanent caching (perf lane B, 2026-11-22). Every visit used to revalidate every static file (Vercel's default
// "max-age=0, must-revalidate": ~580 conditional requests per boot + match). vercel.json now answers a request for a file
// under models/ audio/ vendor/ (and lobby-bg.png / favicon.ico) that carries ?v=<hash> with
// "public, max-age=31536000, immutable"; without ?v= the same file still revalidates as before, so a URL this script misses
// is only slower, never stale. VSV is { path: { segment: ... file: "<git blob sha, 10 hex>" } } of every tracked file under
// those roots, written into index.html by work/install_valorant.py from `git ls-files -s` (CI checks index.html is the regen
// output, so a changed asset always ships a new hash, and any new deploy that changes a file changes its URL).
// vsAssetUrl(url) appends ?v=<hash> to a same-origin URL of a listed file. It is applied where the page asks for files:
// fetch (three's FileLoader / ImageBitmapLoader and every direct fetch), XMLHttpRequest, <img>.src (ImageLoader),
// <audio>/<video>/<source>/<script>.src and new Audio(src). The HTML itself (index.html, /) is not listed and revalidates.
var VSV=/*ASSET_VERSIONS*/null;
(function(){
 if(!VSV||typeof location==='undefined')return;
 var base=null;
 function baseDir(){if(base!==null)return base;try{var p=new URL(document.baseURI||location.href).pathname;base=p.slice(0,p.lastIndexOf('/')+1);}catch(e){base='/';}return base;}
 function look(path){var parts=path.split('/'),d=VSV;for(var i=0;i<parts.length;i++){if(!d||typeof d!=='object')return null;d=d[parts[i]];}return typeof d==='string'?d:null;}
 function vsAssetUrl(u){
  try{
   if(typeof u!=='string'){if(u&&typeof URL!=='undefined'&&u instanceof URL)u=u.href;else return u;}
   if(!u||/^(data:|blob:|about:|javascript:)/i.test(u))return u;
   var x=new URL(u,document.baseURI||location.href);if(x.origin!==location.origin)return u;
   if(/(^|&)v=/.test(x.search.slice(1)))return u;
   var b=baseDir(),p=x.pathname;if(p.indexOf(b)!==0)return u;
   var key;try{key=decodeURIComponent(p.slice(b.length));}catch(e){return u;}
   var h=look(key);if(!h)return u;
   var hi=u.indexOf('#'),head=hi<0?u:u.slice(0,hi),tail=hi<0?'':u.slice(hi);
   return head+(head.indexOf('?')<0?'?':'&')+'v='+h+tail;
  }catch(e){return u;}
 }
 window.vsAssetUrl=vsAssetUrl;
 try{if(typeof window.fetch==='function'){var F=window.fetch;window.fetch=function(input,init){try{if(typeof input==='string'||(typeof URL!=='undefined'&&input instanceof URL))input=vsAssetUrl(input);else if(input&&typeof Request!=='undefined'&&input instanceof Request&&input.method==='GET'){var n=vsAssetUrl(input.url);if(n!==input.url)input=new Request(n,input);}}catch(e){}return F.call(this,input,init);};}}catch(e){}
 try{var XO=XMLHttpRequest.prototype.open;XMLHttpRequest.prototype.open=function(m,u){if(typeof u==='string')arguments[1]=vsAssetUrl(u);return XO.apply(this,arguments);};}catch(e){}
 function hook(C){try{var P=C&&C.prototype,d=P&&Object.getOwnPropertyDescriptor(P,'src');if(!d||!d.set||!d.configurable)return;Object.defineProperty(P,'src',{configurable:true,enumerable:d.enumerable,get:d.get,set:function(v){d.set.call(this,typeof v==='string'?vsAssetUrl(v):v);}});}catch(e){}}
 if(typeof HTMLImageElement!=='undefined')hook(HTMLImageElement);
 if(typeof HTMLMediaElement!=='undefined')hook(HTMLMediaElement);
 if(typeof HTMLSourceElement!=='undefined')hook(HTMLSourceElement);
 if(typeof HTMLScriptElement!=='undefined')hook(HTMLScriptElement);
 try{if(typeof window.Audio==='function'){var A=window.Audio,W=function Audio(src){return arguments.length?new A(typeof src==='string'?vsAssetUrl(src):src):new A();};W.prototype=A.prototype;window.Audio=W;}}catch(e){}
})();
// ---- END ASSET VERSIONS ----
