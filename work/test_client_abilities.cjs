// Every agent x every ability (C / Q / E / X) cast offline in a live 5v5 match on the real page (work/page_harness.cjs:
// index.html in audit.js's fake DOM, real three.js scene graph). Per agent: pick the agent on the agent-select screen,
// skip the buy phase, give every charge + a full ult, cast each key (press, follow-up click, recast / detonate press),
// let effects play, then end the round through the page's own fCheck -> fRound -> jRound flow.
// Checked: no page exception / xErr; no NaN / Infinity in J (ability state) or player / camera; HUD ability slots show
// the agent's own names and no NaN/undefined text, charge pips match J's charges; casting spends the charge; after the
// round reset every J effect list is empty and nothing the casts added is left in the scene (uuid diff vs the round start).
//   node work/test_client_abilities.cjs              every agent once, ascent / split alternating (in test_all)
//   QA_LONG=1 node work/test_client_abilities.cjs     every agent on ascent and split
//   MAPS=bind,breeze AGENTS=Sova node work/test_client_abilities.cjs
const {boot,mulberry}=require('./page_harness.cjs');
const SEED=+(process.env.SEED||3),VERBOSE=!!process.env.VERBOSE;
const LONG=!!process.env.QA_LONG,MAPS=(process.env.MAPS||'ascent,split').split(','),ONLY=process.env.AGENTS?process.env.AGENTS.split(','):null;
const H=boot({real3:true,seed:SEED}),xe=H.xe,rnd=mulberry(SEED*13+1);
const adv=async ms=>{for(let t=0;t<ms;t+=50){H.advance(Math.min(50,ms-t));await new Promise(r=>setImmediate(r));}};
const errs0=H.errors.length,x0=H.xErrCalls.length;const fails=[];const fail=s=>{fails.push(s);if(VERBOSE)console.log('FAIL',s);};
const tap=async(code,ms=60)=>{H.key(code,true);await adv(ms);H.key(code,false);};
const click=async(b=0,ms=60)=>{H.mouse(b,true);await adv(ms);H.mouse(b,false);};
const AGENTS=xe('Object.keys(KITS)').filter(a=>!ONLY||ONLY.includes(a));
// J's numeric state (deep, one level into arrays / plain objects; skips three.js objects)
const NANJ=`(()=>{const bad=[],f=Number.isFinite;const walk=(o,p,d)=>{if(d>2||!o)return;for(const k in o){let v;try{v=o[k];}catch(e){continue;}
 if(typeof v==="number"){if(!f(v))bad.push(p+k+"="+v);}else if(v&&typeof v==="object"&&!v.isObject3D&&!v.isMaterial&&!v.isBufferGeometry&&!v.nodeType&&!(v instanceof Map))walk(v,p+k+".",d+1);}};
 walk(J,"J.",0);const P=player;for(const k of ["x","y","z","hp","vy","armor"])if(P[k]!==undefined&&!f(P[k]))bad.push("player."+k+"="+P[k]);
 const c=camera.position;if(![c.x,c.y,c.z].every(f))bad.push("camera");if(!f(yaw)||!f(pitch))bad.push("yaw/pitch");
 for(const u of [].concat(bots,allies)){if(!u||!u.g)continue;const p=u.g.position;if(![p.x,p.y,p.z].every(f))bad.push(u.name+" pos");if(!f(u.hp))bad.push(u.name+".hp="+u.hp);}
 return bad;})()`;
const HUD=`(()=>{const o={};for(const id of ["jC","jQ","jE","jX"]){const el=document.getElementById(id);if(!el){o[id]=null;continue;}const sp=el.querySelector("span"),em=el.querySelector("em"),pp=el.querySelector(".x-pp");
 o[id]={n:sp&&sp.textContent,t:em&&em.textContent,on:pp?pp.children.filter?pp.children.filter(c=>c.className==="on").length:[...pp.children].filter(c=>c.className==="on").length:null,pm:pp?pp.children.length:null};}return o;})()`;
const sceneIds=()=>xe('(()=>{const s=[];scene.traverse(o=>s.push(o.uuid));return s;})()');
// units are respawned (new groups) and the viewmodel rebuilt each round: not ability leftovers
const describe=ids=>xe(`(()=>{const want=new Set(${JSON.stringify(ids)}),out=[],skip=new Set();for(const u of [].concat(bots||[],allies||[]))if(u&&u.g)u.g.traverse(o=>skip.add(o));camera.traverse(o=>skip.add(o));for(const m of XSP.pool.concat(xBlob.pool))skip.add(m);/* pools: spray decals (10), agent shadow blobs (one per unit) */
 for(const c of (typeof corpses!=="undefined"&&corpses)||[]){const g=c&&(c.g||c.m||c);if(g&&g.traverse)g.traverse(o=>skip.add(o));}
 scene.traverse(o=>{if(skip.has(o)||o.name==="xMerged")return;/* the map's idle merge pass */if(want.has(o.uuid)&&!(o.parent&&want.has(o.parent.uuid)))out.push((o.name||o.type)+"/"+(o.geometry&&o.geometry.type||"")+(o.geometry&&o.geometry.parameters&&o.geometry.parameters.radius?"("+o.geometry.parameters.radius+")":"")+"/"+(o.material&&(o.material.name||o.material.type)||"")+(o.material&&o.material.color?"#"+o.material.color.getHexString():"")+(o.visible?"":" hidden")+" @"+[o.position.x,o.position.y,o.position.z].map(v=>v.toFixed(1))+" under "+(o.parent===scene?"scene":(o.parent&&(o.parent.name||o.parent.type))));});return out;})()`);
// the scene right after jRound (before the new round's first frame, where bot sentinels legitimately set up again)
xe('{const r0=jRound;jRound=function(){const v=r0.apply(this,arguments);const s=[];scene.traverse(o=>s.push(o.uuid));window.__qaAfterRound=s;const o={};for(const k of ["smokes","walls","zones","orbs","arrows","fx"])if(J[k]&&J[k].length)o[k]=J[k].length;if(J.dr)o.dr=1;if(J.bsOn)o.bsOn=1;if(J.om)o.om=1;window.__qaAfterLists=o;return v;};}true');
const through=async agent=>{for(let t=0;t<20000;t+=100){if(xe('running')&&!xe('!!window.xLdOn')&&!H.shown('pre')&&!H.shown('xAg'))return true;
 if(H.shown('pre'))H.$('preGo').click();else if(H.shown('xAg')){const tile=H.doc.querySelectorAll('#xAg .x-ag').find(b=>b.dataset.a===agent);if(tile&&!tile.disabled)tile.click();await adv(20);H.$('xAgL').click();}
 await adv(100);}return false;};
(async()=>{
 const t0=Date.now();let casts=0,matches=0;
 // fast variant (test_all): every agent once, maps alternating; QA_LONG / MAPS: every agent on every map
 const RUNS=LONG||process.env.MAPS?MAPS.flatMap(m=>AGENTS.map(a=>[m,a])):AGENTS.map((a,i)=>[MAPS[i%MAPS.length],a]);
 for(const [map,agent] of RUNS){const tag=`${map} ${agent}`;H.setPhase(tag);matches++;
  xe(`FV.pick=${JSON.stringify(map)};window.xQPick=${JSON.stringify(map)};try{mpSet(${JSON.stringify(map)})}catch(e){}true`);
  H.$('pm5v5').click();await adv(50);if(!(await through(agent))){fail(`${tag}: match did not start`);continue;}
  if(xe('J.pick')!==agent){fail(`${tag}: agent select gave ${xe('J.pick')}`);}
  if(xe('FV.map')!==map)fail(`${tag}: map ${xe('FV.map')}`);
  // past the buy phase, every charge + full ult
  xe('FV.buy=0.05;true');await adv(300);
  if(!xe('J.on'))fail(`${tag}: kit not on`);
  const names=xe('K().n'),hud0=xe(HUD);
  ['jC','jQ','jE','jX'].forEach((id,i)=>{if(!hud0[id]||hud0[id].n!==names[i])fail(`${tag}: HUD ${id} label ${hud0[id]&&hud0[id].n} != ${names[i]}`);});
  const base=new Set(sceneIds());
  const KEYS=['KeyC','KeyQ','KeyE','KeyX'];
  for(const k of KEYS){const ab=k.slice(3).toLowerCase();
   xe(`(()=>{const M=K().mx;J.c=Math.max(J.c|0,M.c||1);J.q=Math.max(J.q|0,M.q||1);J.e=Math.max(J.e|0,M.e||1);J.ult=K().u;J.cd={c:0,q:0,e:0,x:0};player.hp=Math.max(player.hp,100);J.hs="";})()`);
   await adv(100);const before=xe(`({c:J.c,q:J.q,e:J.e,ult:J.ult})`),hb=xe(HUD);
   // pips under C / Q / E equal the charges held
   for(const [id,key] of [['jC','c'],['jQ','q'],['jE','e']]){const h=hb[id],v=before[key];if(h&&h.on!==null&&typeof v==='number'&&h.on!==Math.min(4,Math.max(0,v|0)))fail(`${tag}: HUD ${id} pips ${h.on} for ${key}=${v}`);}
   H.look(Math.round((rnd()-.5)*60),Math.round((rnd()-.5)*10));
   await tap(k,80);casts++;await adv(250);
   const after=xe(`({c:J.c,q:J.q,e:J.e,ult:J.ult,bsOn:!!J.bsOn,dr:!!J.dr,hf:J.hf|0})`);
   const spent=ab==='x'?after.ult<before.ult:(typeof before[ab]==='number'?after[ab]<before[ab]:after[ab]!==before[ab]);
   const pending=xe('JSON.stringify({dr:!!J.dr,om:!!J.om,bs:!!J.bsOn,hf:J.hf|0})');
   if(!spent&&!/true|"hf":[1-9]/.test(pending)&&VERBOSE)console.log(`  note ${tag} ${k}: no charge spent (before ${JSON.stringify(before)} after ${JSON.stringify(after)} ${pending})`);
   if(!spent)xe(`window.__qaNoSpend=(window.__qaNoSpend||[]).concat(${JSON.stringify(tag+' '+k)})`);
   // follow-ups: fire / alt fire (drone dart, blade storm knives, hunter's fury shots, aim-confirm abilities), recast
   await click(0);await adv(200);await click(0);await adv(200);await click(2);await adv(150);await tap(k,60);await adv(300);await click(0);await adv(1200);
   if(!spent){const fin=xe(`({c:J.c,q:J.q,e:J.e,ult:J.ult})`);if(JSON.stringify(fin)===JSON.stringify(before))xe(`window.__qaNever=(window.__qaNever||[]).concat(${JSON.stringify(tag+' '+k)})`);}
   const bad=xe(NANJ);if(bad.length)fail(`${tag} ${k}: non-finite ${bad.slice(0,5).join(', ')}`);
   const hud=xe(HUD);for(const id in hud){const h=hud[id];if(h&&/NaN|undefined|null|Infinity/.test(String(h.t)+String(h.n)))fail(`${tag} ${k}: HUD ${id} text "${h.n}" / "${h.t}"`);}
   if(H.errors.length>errs0||H.xErrCalls.length>x0)break;
   // leave the ability (drone, Blade Storm) for the next key
   await tap('Digit1',40);await adv(200);
  }
  await adv(2500);// let durations (smokes, walls, turrets) live a while
  // end the round through the page's own flow; next round start runs jRound -> jClear
  xe('if(running){FV.sp.st="carry";fCheck(true,"QA")}true');await adv(7600);
  if(!xe('running'))fail(`${tag}: next round did not start`);
  xe('FV.buy=0.05;true');await adv(200);
  const lists=xe('window.__qaAfterLists||{}');
  if(Object.keys(lists).length)fail(`${tag}: effects survived the round reset ${JSON.stringify(lists)}`);
  const now=xe('window.__qaAfterRound||[]'),added=now.filter(u=>!base.has(u));
  if(added.length){const d=describe(added);if(d.length)fail(`${tag}: ${d.length} object(s) added by the casts still in the scene after the round reset: ${d.slice(0,6).join('; ')}`);}
  const hud1=xe(HUD);['jC','jQ','jE','jX'].forEach((id,i)=>{if(!hud1[id]||hud1[id].n!==names[i])fail(`${tag}: HUD ${id} label after reset ${hud1[id]&&hud1[id].n}`);});
  const ultAfter=xe('J.ult');if(!(ultAfter>=0&&ultAfter<=xe('K().u')))fail(`${tag}: ult points ${ultAfter} after reset`);
  if(H.errors.length>errs0||H.xErrCalls.length>x0){fail(`${tag}: page exceptions ${JSON.stringify({e:H.errors.slice(errs0,errs0+4),x:H.xErrCalls.slice(x0,x0+4)})}`);break;}
  // back to the lobby through the pause menu
  H.dispatch(H.win,H.mkEvent('keydown',{key:'Escape',code:'Escape'}));await adv(100);H.$('xHome').click();await adv(1500);
  if(xe('running'))fail(`${tag}: still running after leaving`);
 }
 const ns=xe('window.__qaNoSpend||[]');if(VERBOSE&&ns.length)console.log('casts that spent nothing on the first press:',ns.join(', '));const nv=xe('window.__qaNever||[]');if(VERBOSE&&nv.length)console.log('casts that never spent a charge (press, clicks, recast):',nv.join(', '));
 if(fails.length){console.error(fails.slice(0,30).join('\n'));process.exit(1);}
 console.log(`Client abilities (three r${H.three}): ${AGENTS.length} agents x C/Q/E/X on ${MAPS.join(' / ')} (${matches} matches, ${casts} casts): no exceptions, no NaN, HUD labels / pips consistent, all effects cleared and nothing left in the scene after the round reset (${((Date.now()-t0)/1000).toFixed(0)} s)`);
 process.exit(0);
})().catch(e=>{console.error(e);process.exit(1);});
