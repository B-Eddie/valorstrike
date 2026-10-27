// Main page UI (user 2026-10-27): 1) no "Still in development" popup with a "Got it" button (and nothing stored to gate it);
// 2) every game mode card has a real one-line description with the game's rules (no bare "NEW"), and the Online panel
// describes the selected mode, with the numbers the code plays (page FIVE_WIN / DM / Spike Rush, server matchSeconds /
// maxKills / ESC / SKM / VARIANT_RULES); 3) no "Opens in 00 days ..." countdown on the Retake 3v3 card: it was static text
// (never updated, gated nothing) on a mode that is playable, so it says it is open and its GO starts it.
//   node work/test_lobby_modes_ui.cjs   (in test_all)
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const audit=fs.readFileSync(path.join(__dirname,'audit.js'),'utf8'),boot=audit.slice(0,audit.indexOf('// ---------- audit ----------')).replace(/^"use strict";/,'');
const log=console.log;console.log=()=>{};
const H=new Function('require','__dirname','process','module',boot+'\nreturn {win,doc,context,errors,advance};')(require,__dirname,process,module);
console.log=log;
const xe=code=>require('vm').runInContext('__xe',H.context)(code);const doc=H.doc,fails=[],fail=s=>fails.push(s);
(async()=>{
 const sim=await import('../server/src/simulation.js'),modes=await import('../server/src/modes.js');
 // 1. intro popup gone
 if(doc.getElementById('mIntro'))fail('the intro popup (#mIntro) is still in the page');
 if(/Still in development/i.test(html))fail('"Still in development" is still in the page');
 if([...doc.querySelectorAll('button')].some(b=>/^\s*Got it\s*$/i.test(b.textContent||'')))fail('a "Got it" button is still in the page');
 if(doc.querySelector('.modal.on'))fail('a popup is open over the lobby at boot: #'+doc.querySelector('.modal.on').id);
 if(/localStorage[^;\n]{0,80}intro|intro[^;\n]{0,40}localStorage/i.test(html))fail('localStorage gating for an intro popup is still in the page');
 // 2. mode cards: description + rules, no bare NEW
 const RULE={unrated:[xe('FIVE_WIN'),'Spike'],swift:[modes.VARIANT_RULES.swift.win,'Spike'],sr:[modes.VARIANT_RULES.sr.win,'Spike'],dm:[40,'Free-for-all'],tdm:[100,'5v5'],esc:[modes.ESC_LEVELS.length,'level'],rep:[modes.VARIANT_RULES.rep.win,'agent']};
 assert.equal(xe('FIVE_WIN'),13);{const src=fs.readFileSync(path.join(__dirname,'..','server','src','simulation.js'),'utf8');assert(src.includes("maxKills=mode==='dm'?40:100"),'server DM / TDM kill targets moved: update RULE');assert(html.includes('DM.win = FV.tdm ? 100 : 40'),'page DM / TDM kill targets moved: update RULE');}
 const cards=[...doc.querySelectorAll('#xQueue .x-qp')].filter(p=>p.querySelector('.x-qcard'));if(cards.length<7)fail('expected 7 mode cards, found '+cards.length);
 for(const p of cards){const q=p.dataset.q,c=p.querySelector('.x-qcard'),d=(c.querySelector('p')||{}).textContent||'',sm=(c.querySelector('small')||{}).textContent||'',all=[...c.querySelectorAll('h3,p,small,span')].map(e=>e.textContent||'').join(' ')+' '+(c.textContent||'');
  if(/\bNEW\b/.test(all))fail(q+': card still says NEW ('+JSON.stringify(sm)+')');if(d.trim().length<20)fail(q+': no description ('+JSON.stringify(d)+')');if(sm.trim().length<10)fail(q+': no rules line ('+JSON.stringify(sm)+')');
  const R=RULE[q];if(!R){fail(q+': unexpected card');continue;}if(!new RegExp('\\b'+R[0]+'\\b').test(d))fail(q+': description does not say first to / '+R[0]+': '+JSON.stringify(d));if(!all.toLowerCase().includes(R[1].toLowerCase()))fail(q+': description lacks "'+R[1]+'": '+JSON.stringify(d));}
 // time limits on the DM / TDM / Escalation cards = the server's
 const card=q=>doc.querySelector('#xQueue .x-qp[data-q="'+q+'"] .x-qcard').textContent;const mmss=s=>Math.floor(s/60)+':'+String(s%60).padStart(2,'0');
 if(!card('dm').includes(mmss(sim.matchSeconds('dm'))))fail('dm card lacks the '+mmss(sim.matchSeconds('dm'))+' match length');if(!card('tdm').includes(mmss(sim.matchSeconds('tdm'))))fail('tdm card lacks '+mmss(sim.matchSeconds('tdm')));
 if(!card('esc').includes(mmss(modes.ESC.seconds)))fail('esc card lacks '+mmss(modes.ESC.seconds));if(!card('esc').includes(modes.ESC.need+' kills per level'))fail('esc card lacks '+modes.ESC.need+' kills per level');
 // Online panel: the selected mode is described, with the server's numbers
 const ON={dm:40,tdm:100,five:13,esc:modes.ESC_LEVELS.length,swift:modes.VARIANT_RULES.swift.win,sr:modes.VARIANT_RULES.sr.win,rep:modes.VARIANT_RULES.rep.win,skm:modes.SKM.win};
 const btns=[...doc.querySelectorAll('#xOn [data-om]')].map(b=>b.dataset.om);for(const m of Object.keys(ON))if(!btns.includes(m))fail('online mode button missing: '+m);
 for(const m of btns){xe(`MP.mode=${JSON.stringify(m)};mpUI();true`);const t=(doc.getElementById('xOnDesc')||{}).textContent||'';if(t.length<20)fail('online '+m+': no description under the mode buttons ('+JSON.stringify(t)+')');else if(ON[m]!=null&&!new RegExp('\\b'+ON[m]+'\\b').test(t))fail('online '+m+': description lacks '+ON[m]+': '+JSON.stringify(t));}
 xe("MP.mode='tdm';mpUI();true");
 // 3. no countdown: the Retake 3v3 card says it is open, and GO starts it
 if(/Opens in/i.test(html))fail('"Opens in" countdown still in the page');if(doc.querySelector('.feat .cd'))fail('countdown element .feat .cd still in the page');
 const feat=doc.querySelector('.feat');if(!feat||!/open now/i.test(feat.textContent))fail('Retake 3v3 card does not say it is open: '+JSON.stringify(feat&&feat.textContent));
 doc.getElementById('goBtn').click();H.advance(200);if(['','none'].includes(doc.getElementById('pre').style.display))fail('GO on the Retake 3v3 card did not open the Retake setup');
 const errs=H.errors.filter(e=>!/unexpected external script/.test(e.msg||''));if(errs.length)fail('page errors: '+JSON.stringify(errs.slice(0,3)));
 if(fails.length){console.log('FAIL lobby modes UI ('+fails.length+'):\n - '+fails.join('\n - '));process.exit(1);}
 console.log('Lobby UI: no intro popup / Got it / gating; '+cards.length+' mode cards with descriptions and rules (no NEW), Online panel describes all '+btns.length+' modes with the server numbers; Retake 3v3 open (no countdown), GO opens it');process.exit(0);
})().catch(e=>{console.error('ERR',e&&e.stack||e);process.exit(1);});
