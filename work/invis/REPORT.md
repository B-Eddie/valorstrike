# Invisible walls lane (vs-lane-invis, branch lane-invis, on 8f4e9d8) — LOCAL, NOT pushed, NOT deployed

User: "there are also some invisible walls in the maps" / "multiple maps, it's near the grasses on the side" / "I saw it in Breeze".

## Method (work/invis, reproducible)
- `triinfo.py <map> <worldsDir>`: for every collision triangle the motor actually walks (server worlds/position+index), the
  render triangle with identical vertices -> material, and the share of its surface the PAGE draws see-through
  (replicates nmPrepareScene: terrain force-opaque, decal style alpha .02, foliage cut-out alpha .45, glTF MASK), sampled
  at 15 barycentric points against the texture alpha. `-2` = collision-only (no render triangle).
- `capsweep.cjs <map> <publicWorlds>`: from every reachable nav node (valid AND on the movement leash; nav islands on roofs /
  wall tops are skipped) a standing capsule (r .38, above the 0.4 m step) is pushed out in 16 directions; at the first
  contact, if EVERY touched triangle is see-through / plant material / collision-only it is an invisible-wall candidate.
- `leashsweep.mjs` + `beyond.mjs` + `fpcheck.py` + `mmplot.py`: leash stops on continuous floor (no collision), whether
  foliage is there, how far the real wall is, and whether the stop is inside the official minimap footprint.
- `reachvoid.mjs` (from qa/foliage): reachable void cells, before/after.

## Root causes found
1. LIVE main (6eb0cf9, no foliage exclusion): plant beds keep full collision; beach cabbage / morning glory / banana /
   agave cards are alpha-cut, so their transparent card edges stop you a hand-width from the visible leaves = the grass-side
   invisible walls. Breeze reachable: **499 suspect pushes / 82 clusters** (cabbage 225, morning glory 155, banana 57,
   agave 61): Attacker Side Spawn beds, Defender Side Spawn morning glory, A Shop / A Lobby cabbage, B Tunnel cabbage+agave,
   Defender Side Arches agave, Mid Bottom. **Fixed by 8f4e9d8** (already local, in vs-integrate-4) -> Breeze 31 pushes.
2. Residual after 8f4e9d8 (this lane, exclusion v2 in work/build_foliage_exclude.py):
   a. nav-ground safety restored WHOLE welded beds when a nav node stood on the leaf top with no kept floor within 0.35 m;
      the real ground was 0.36-1.3 m below (Breeze cabbage, Bind DesertPlantC) -> rule is now "no kept floor within 1.3 m"
      (DROP) and only the part of the bed within 0.6 m of that node is restored (LOCAL).
   b. MIXED pot/planter/palm atlases kept triangles whose texels are transparent but not green (card margins) -> a
      triangle is also dropped when the page's 0.45 alpha test cuts it.
   c. Decal cards (graffiti, murals, container stickers) drawn as alpha decals float 2-5 cm off their wall -> Decal/Floater
      materials with real alpha are excluded like foliage (nav-ground safety still applies).
   d. Split: with (a) six grass clumps that are the only floor at void edges near A Main/A Lobby stopped being restored
      (reachvoid +26 cells) -> KEEP entries; back to 36 (pre-existing).
3. Leash stops beside grass (Breeze ~2118 same-floor leash stops; 471 next to foliage): 95% lie OUTSIDE the official minimap
   footprint (Mid Top / Mid Nest / B Tunnel / Mid Wood Doors / B Window grass nooks behind the minimap wall line; mmplot
   shows the white wall line at the nav edge) = VALORANT's own boundary -> INTENDED, left alone. Inside the footprint only a
   few (Mid Pillar (-19.1, 7.97, 2.75) 9 pushes, B Back (-74, 8.09, -5.35) 4; Mid Hall y 12 is a roof over Mid Hall). A
   leash-over-foliage generator was prototyped (work/invis/map-leash-extra.mjs.txt) and NOT shipped.

## Per map, reachable invisible-wall pushes (capsweep, see-through/plant/collision-only only)
| map | live main (no excl.) | 8f4e9d8 | this lane | what remains (all intended) |
|---|---|---|---|---|
| breeze | 499 (82 clusters) | 31 | 14 | palm trunks Attacker Side Spawn (2.84,4.05,44.67), (7.9,4.01,43.25), (14.58,4.28,54.16) - opaque trunk |
| bind | n/m | 32 | 0 | - |
| ascent | n/m | 125 | 53 | Garden potted-plant / clay pots: Mid Top (19,8.07,35.9), Mid Cubby (19.6,9.07,-13.1), Mid Link (-8.5,7.07,5) |
| haven | n/m | 120 | 119 | Pot_1 clay pots (Attacker Spawn, Mid Window, Mid Doors, A Garden, C Cubby) |
| split | n/m | 88 | 51 | Pot_1 clay pots (Mid Bottom, Defender Spawn, Attacker Spawn); A Screens flower-tree card leftovers (30) fixed |
| lotus | n/m | 468 | 427 | giant root vines (A Root, A Lobby, C Waterfall; visible solid), 146 collision-only = 9245a31 void-fill wall boxes over holes outside the minimap at C Main/C Mound (-43,4.8,19), C Site (-50,6.1,-8.5) (intended clip over a hole); shrub/fern/moss 33 -> 0, cabbage 12 -> 4 |
Specific fixes this lane (test fixtures): Breeze Attacker Side Spawn cabbage (11.5,4.11,51.5); Mid Nest mural (-17.9,11.02,-37.75),
(-18.92,11.02,-37.33); A Ramp mural (-13.04,11.06,-39.79); A Pyramids container sticker (19,8.04,-36.7); Bind A Link desert plant
(-7.83,6.98,21.42); B Fountain desert plant (-53.02,6.91,20.8); graffiti at Attacker Side Cave (19.04,7.07,30.06), B Long (-56.7,8.71,-15),
B Short (-20.02,10.95,-8.05), A Lobby (19.08,6.97,13.92).

## Holes
reachvoid on all 6 maps after the change: breeze 64, bind 0, haven 0, split 36, ascent 236, lotus 271 = identical to 8f4e9d8 (0 new).
