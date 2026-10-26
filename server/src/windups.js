// Per-ability windups from wiki.playvalorant.com (agent pages, fetched 2026-10-25), shared by abilities.js / devices.js /
// ults.js and mirrored by the client's XAB_WIND (index.html). Three kinds:
//  - FIRE -> effect (aftershock, flashpoint, faultLine, rollingThunder, curveball, leer): the equip flow's hand release
//    (XAB_REL, client XABT.rel) happens before the cast reaches the server, so the server fuse is the windup minus it (wf).
//  - arm time from placement (trapwire, trademark, blastPack damage, lockdown): counted from the cast.
//  - ult gun equip time (showstopper, tourDeForce): the gun cannot fire until it is up.
export const WINDUP={aftershock:2.2,flashpoint:.5,faultLine:1.1,rollingThunder:1.2,curveball:.6,leer:.4,lockdown:13,trapwire:.7,trademark:2,blastPack:1.5,showstopper:1.4,tourDeForce:2.3};
export const XAB_REL=.2;
export const wf=k=>Math.max(0,Math.round((WINDUP[k]-XAB_REL)*1e6)/1e6);
