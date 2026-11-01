// Being-shot overlay cost (user, 31 Oct 2026: "it still lags when I'm getting shot at"). Every hit on the player shows the
// directional damage arc (.x-da, a pool of 4) and the red hurt vignette (#dmg). Stub-GL Chromium bench (3 bots spraying the
// player, qa/gpu/hitbench.cjs) at 1080: 22.5 fps calm -> 6.5 fps while shot, main thread 67% idle; the compositor threads
// carried the frame: each arc was a 62 x 62 vmin composited layer (670 x 670 px at 1080) whose CSS mask made a render surface
// plus a mask pass every frame it was visible, ~1.8 Mpx of extra compositing (x2-3 with the mask) on top of the full-screen vignette.
// Fix: the arc's layer is only the box the visible crescent occupies (the mask keeps 22-78% of the width, the 7 px border-top
// crescent is at most 0.1715 r + 6 px tall there); the original circle + mask is an un-composited child painted into that
// layer once (same paint code, so the same pixels), rotated about the same centre (the circle centre).
// Checks (CSS model at 1920 x 1080): the composited arc layer is <= ARC_MAX px; no composited element carries a CSS mask;
// the arc keeps its geometry (same circle, border, mask, rotation centre); xDmgArc still rotates the pooled arc and restarts its fade.
const fs=require('fs'),assert=require('assert/strict'),s=fs.readFileSync(__dirname+'/../index.html','utf8');
const W=1920,H=1080,VMIN=Math.min(W,H)/100,ARC_MAX=40000;
const rules=sel=>[...s.matchAll(new RegExp('(^|[}\\n])'+sel.replace(/[.#]/g,m=>'\\'+m)+'\\{([^}]*)\\}','g'))].map(m=>m[2]).join(';');
const decl=(body,k)=>{const m=[...body.matchAll(new RegExp('(?:^|;)\\s*'+k.replace('-','\\-')+':([^;]+)','g'))];return m.length?m[m.length-1][1].trim():null;};
const len=v=>{if(v==null)return null;v=v.replace(/^calc\((.*)\)$/,'$1');let t=0;for(const m of v.matchAll(/([+-]?\s*[\d.]+)(vmin|px)/g)){const n=parseFloat(m[1].replace(/\s/g,''));t+=m[2]==='vmin'?n*VMIN:n;}return t;};
const da=rules('.x-da'),inner=rules('.x-dai');
const comp=b=>/will-change:[^;]*(opacity|transform)/.test(b);
assert(comp(da),'.x-da (the animated arc) is not on its own layer (will-change)');
const w=len(decl(da,'width')),h=len(decl(da,'height'));
console.log('arc layer',Math.round(w)+' x '+Math.round(h),'=',Math.round(w*h),'px (max',ARC_MAX+'; 62 vmin circle = '+Math.round((62*VMIN)**2)+')');
assert(w*h<=ARC_MAX,'damage arc layer '+Math.round(w)+'x'+Math.round(h)+' px > '+ARC_MAX+' px: the whole 62 vmin circle is composited (and masked) on every hit');
assert(!/(^|;)\s*(-webkit-)?mask:/.test(da)||!comp(da),'the composited arc layer carries a CSS mask (render surface + mask pass per frame)');
assert(inner&&!comp(inner),'.x-dai (circle + mask) must exist and be painted into the arc layer, not composited');
// geometry preserved: the inner circle is the old one (62 vmin, 7 px border-top, round, 22-78% mask), placed so the arc layer
// spans exactly 22-78% of its width from its top, and the layer rotates about the circle centre
assert.equal(decl(inner,'width'),'62vmin');assert.equal(decl(inner,'height'),'62vmin');assert.equal(decl(inner,'border-radius'),'50%');
assert.match(decl(inner,'border-top')||'',/^7px solid/);assert.match(decl(inner,'mask')||'',/transparent 22%,#000 40%,#000 60%,transparent 78%/);
assert(Math.abs(w-0.56*62*VMIN)<0.5,'arc layer width is not 56% of the circle (the mask window)');
assert(Math.abs(len(decl(inner,'left'))+0.22*62*VMIN)<0.5,'inner circle not offset by 22% of its width');
const r=31*VMIN;assert(h>=0.1715*r+6.5,'arc layer shorter than the crescent at the mask edge');
const o=(decl(da,'transform-origin')||'').split(/\s+/).map(len);assert(Math.abs(o[0]-w/2)<0.5&&Math.abs(o[1]-r)<0.5,'arc does not rotate about the circle centre');
assert.equal(len(decl(da,'margin-top')||decl(da,'margin').split(/\s+/)[0]),-r,'arc layer top is not the circle top');
// pooled DOM, built once: 4 arcs, each with its circle child
const b=s.slice(s.indexOf('const XKI = {'),s.indexOf('function xKiReset'));assert.match(b,/x-dai/,'arcs are built without the inner circle');
const f=s.slice(s.indexOf('function xDmgArc('),s.indexOf('\n}',s.indexOf('function xDmgArc('))+2);assert.match(f,/rotate\(/);assert.match(f,/xDaPlay\(d\)/); /* perf2: restart through the arc's persistent Web Animation (work/test_hit_arc_flush.cjs), xRestart fallback */
console.log('test_hit_overlay_cost OK');
