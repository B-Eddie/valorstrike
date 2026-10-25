// Player clips (task 3): the Ascent A ramp pit (a hole beside the A ramp with no floor below, open on every side) is
// closed by an invisible movement-only wall defined once in the shared motor (vendor/valorant-feel.js = server
// src/motor.cjs, CLIPS) and asked by both the client's nmBlocked and the server world's blocked().
// Checks: the client's nmBlocked (from the generated page) blocks a capsule reaching over the hole from every side and
// leaves the floors around it free, with the native collision itself reporting nothing (stub BVH); the server world
// consults the same function; clips are not in any ray / floor path (shots and sight pass).
const assert=require('assert/strict'),fs=require('fs'),path=require('path'),vm=require('vm');
const root=path.join(__dirname,'..'),html=fs.readFileSync(path.join(root,'index.html'),'utf8'),vendor=fs.readFileSync(path.join(root,'vendor/valorant-feel.js'),'utf8');
assert.equal(vendor,fs.readFileSync(path.join(root,'server/src/motor.cjs'),'utf8'),'client and server motor are the same file');
const T=require(require.resolve('three',{paths:[path.join(root,'server')]}));
const ctx={THREE:T,Math,Number,Infinity,globalThis:null,window:null};ctx.globalThis=ctx.window=ctx;vm.createContext(ctx);
vm.runInContext(vendor,ctx);assert(ctx.ValorantFeel&&ctx.ValorantFeel.clipBlocked,'motor exports clipBlocked');
const i=html.indexOf('var NM_Q='),j=html.indexOf('function nmBlocked('),k=html.indexOf('\n{const b=blocked,g=groundAt;',j);assert(i>0&&j>0);
vm.runInContext(html.slice(i,html.indexOf('\n',i))+'\n'+html.slice(j,k)+'\nglobalThis.nmBlocked=nmBlocked;',ctx);
const C={key:'ascent',bvh:{shapecast(){return false;}},geometry:{boundsTree:{shapecast(){return false;}}}};
const nb=(x,z,y,r=.38)=>ctx.nmBlocked(C,x,z,r,y,1.8);
// over the hole / reaching over its rim from each side
for(const [x,z,y,what] of [[40,-23.6,9.05,'centre'],[40,-22.4,9.05,'south rim'],[40.5,-24.9,10.3,'north rim'],[43.1,-24,9.6,'east (ramp) rim'],[36.75,-23.2,9.05,'west rim'],[37.6,-22.05,9.05,'south-west corner']])assert.equal(nb(x,z,y),true,'blocked: '+what);
// floors around it stay free (>= 0.45 m from the rim)
for(const [x,z,y,what] of [[40,-21.6,9.05,'south floor'],[40.5,-25.6,10.3,'north floor'],[43.8,-24,9.6,'ramp'],[36.2,-23.1,9.05,'west ledge'],[45,-32,10.05,'A site']])assert.equal(nb(x,z,y),false,'free: '+what);
// no other map has the clip
assert.equal(ctx.ValorantFeel.clipBlocked('bind',40,-23.6,.38,9.05),false);
// above the clip top (15 m) nothing is blocked
assert.equal(nb(40,-23.6,15.5),false,'clip has a top');
// server side asks the same function; ray paths do not
const world=fs.readFileSync(path.join(root,'server/src/world.js'),'utf8');
assert(/import Motor from '\.\/motor\.cjs'/.test(world)&&/const blocked=\(x,z,r,y,height=1\.8\)=>\{if\(Motor\.clipBlocked\(key,x,z,r,y,height\)\)return true;/.test(world),'server world blocked() asks the clips');
assert(!/clipBlocked/.test(world.slice(world.indexOf('const ray='),world.indexOf('const ray=')+200)),'server rays ignore clips');
console.log('player clips: Ascent A ramp pit closed for movement on client (nmBlocked) and server (world.blocked) from one shared definition; floors around it free; rays unaffected');
