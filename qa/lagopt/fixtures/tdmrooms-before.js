// TDM maps are adapted to the existing map anchors. These are gameplay zones, not new map geometry.
// Spawn-room protection lasts while inside; staying beyond 15 s causes escalating health damage.
export const TDM_ROOM=Object.freeze({radius:5,height:3,grace:15,heal:100,damage:10});
export const roomAnchor=(sim,team)=>team===0?sim.baseWorld.map.attacker:sim.baseWorld.map.defender;
export function inRoom(sim,u,team=u.team){const p=roomAnchor(sim,team);return Math.hypot(u.x-p[0],u.z-p[2])<TDM_ROOM.radius&&Math.abs(u.y-p[1])<TDM_ROOM.height;}
export function roomSpawn(sim,u){u.roomEntered=sim.time;u.roomLeft=false;u.roomSafe=false;}
export function roomTick(sim,u,dt){if(!sim.spawnRooms||!u.alive||u.loading)return;const home=inRoom(sim,u);u.roomSafe=home&&!u.roomLeft;
 if(!home){if(!u.roomLeft)u.protectedUntil=0;u.roomLeft=true;}
 if(u.roomSafe){u.invulnerableUntil=sim.time+.1;if(sim.time-u.roomEntered<=TDM_ROOM.grace){u.hp=Math.min(100,u.hp+TDM_ROOM.heal*dt);const cap=sim.roomArmor(u);u.armor=Math.min(cap,u.armor+TDM_ROOM.heal*dt);}else{u.hp=Math.max(0,u.hp-TDM_ROOM.damage*dt);if(!u.hp){u.alive=false;u.deaths++;u.respawnAt=sim.time+1.5;sim.events.push(['k','Spawn room',u.name,0,'Ability']);}}}else if(u.invulnerableUntil<=sim.time+.101)u.invulnerableUntil=0;
}
export function roomBlocked(sim,u,x,z,r,y){if(!sim.spawnRooms)return false;for(const team of [0,1]){if(team===u.team&&!u.roomLeft)continue;const p=roomAnchor(sim,team);if(Math.abs(y-p[1])<TDM_ROOM.height&&Math.hypot(x-p[0],z-p[2])<TDM_ROOM.radius+r)return true;}return false;}
