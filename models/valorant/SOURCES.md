# VALORANT asset sources

Retrieved 2026-10-24. Original VALORANT models, textures and animations are owned by Riot Games. These assets are **not CC0**. This is an unofficial fan project, not endorsed by Riot Games.

## Characters, weapons and native animations

Source: [Kingdom Archives model gallery](https://kingdomarchives.com/models).
Each `<name>.json` records the source model path, material texture paths, animation names, constraints and first-person settings from `https://kingdomarchives.com/modelviewer/<name>`. `animations/<weapon>.json` records the matching first-person and weapon clip sets from `https://kingdomarchives.com/modelviewer/jett-fp?held=<weapon>`.

- All 12 playable agents have individual textured third-person models and individual first-person arm rigs.
- All 19 arsenal slots (including the knife) use their corresponding VALORANT weapon model. The native first-person equip, idle, fire, reload and inspect clips are included where supplied by the source. Magazines and weapon attachments follow the source's bone constraints.
- Physical ability devices include the Spike, Killjoy Turret / Alarmbot / Lockdown, Raze Boom Bot / Blast Pack / Paint Shells / Showstopper, Sova arrows, Chamber Trademark / Rendezvous, Skye Guiding Light / Trailblazer, and Cypher Spycam / Trapwire anchors.
- Original character-select and ability animation clips remain in the downloaded agent/device GLBs.

Processing: diffuse textures embedded in each GLB, downsampled to at most 1024 px; opaque material defaults adapted for the game's lighting. Assets are served locally, not hotlinked at runtime. Third-person held weapons and map props are baked to static meshes for stable cloning. First-person models retain their native skeletons.

Third-person gameplay movement uses the existing **Quaternius Universal Animation Library** retargeted to each native agent's skeleton, with 19 clips per agent. These movement clips are not claimed to be original VALORANT locomotion. See [the existing fallback credits](../LICENSES.txt) for the CC0 library's authorship and source.

## Original map scenes

The six named maps now use the complete source geometry from [Cracker646's public Blender map ports](https://www.reddit.com/r/VALORANT/comments/1uueh6s/most_of_the_maps_ported_for_use_in_blender/), shared at [the source Drive folder](https://drive.google.com/drive/u/0/folders/1henHDT5PX5HW3PRAJ018UBMTgL0F3-2a). Files are the November 2024 Blender 4.2 ports of Ascent, Bind, Haven, Split, Lotus and Breeze. These preserve that source version's original geometry and layout; they are not claimed to include later Riot map revisions.

`maps/<map>/source.json` records the source coordinates and rigid transform. No lane positions, room proportions or geometry are invented or stretched. One world unit remains one metre. The entire scene is rotated and translated so the attacker and defender spawns align with the game's coordinate system. The source heights and all architectural placements are preserved.

- `scene.gltf`, `geometry-*.bin`, `textures/`: complete original scenes batched by material for browser rendering. Diffuse textures are reduced to 512 px; the original game lighting/shaders are approximated with the game's Lambert lighting. Individual geometry buffers stay below 20 MiB.
- `collision.bin`: original structural triangles, accelerated at runtime with three-mesh-bvh. Foliage, decals, VFX and vista decoration are excluded from physical collision.
- `navigation.json`: walkable mesh samples and connectivity derived from the actual triangles, with a 0.455 m capsule-clearance pass. Routes must connect both spawns and every plant site. API callouts that float above roofs or cover are snapped to reachable floor inside the actual plant zone.
- `minimap.png`, `plants.json`: Riot minimap imagery and its site shading from [Valorant API](https://valorant-api.com/v1/maps), projected with the supplied map calibration. Site areas, spawns and callouts use those coordinates.

Map loading is required before a match starts; a failed download displays a recoverable load error and never starts a legacy custom layout. Only one complete native scene is retained at a time. Retake uses the original Ascent B area. Aim range, surf and the duel practice arena remain practice environments, not VALORANT named-map reproductions. Source dynamic doors remain static in these ports; Bind teleporters use the original entrance/exit callout positions.

The small `environment/*.glb` and `surfaces/*.jpg` prop/surface set is retained for those practice environments. It came from [Shreshth1x/ValorantBrowser](https://github.com/Shreshth1x/ValorantBrowser/tree/main/public/model), which credits the same community Ascent port. Legacy palm/cactus prop IDs use the closest available Ascent foliage.

The BVH library in `vendor/` is three-mesh-bvh 0.5.23 by Garrett Johnson, MIT; its licence is included there.

## Rebuild and validation

Run from the repository root:

```sh
python work/import_valorant.py
python work/import_valorant.py jett-fp phoenix-fp sova-fp sage-fp reyna-fp raze-fp killjoy-fp omen-fp skye-fp chamber-fp breach-fp cypher-fp spike turret boom-bot owl-drone spycam alarmbot trapwire trademark recon-bolt blast-pack lockdown paintshell guiding-light trailblazer showstopper shock-dart rendezvous nanoswarm
python work/import_valorant_animations.py
python work/import_valorant_environment.py
python work/import_valorant_surfaces.py
node work/retarget_valorant.js
python work/build_valorant_manifest.py
python work/download_valorant_maps.py
python work/prepare_native_maps.py
# For each map: ascent bind haven split lotus breeze
blender -b -t 2 --python work/export_native_map.py -- ascent
node work/refine_native_collision.js
python work/refine_native_maps.py
python work/install_valorant.py
node work/verify_native_maps.js
node work/audit.js
node work/verify_valorant.js
```

Importers require Python Pillow, NumPy, SciPy, gdown, curl, Blender 4.3+, and network access. The native scene pack is roughly 1.5 GiB and loads only the selected map. Node rig tooling uses the Three.js support files in `/workspace/work/qa`. The browser check requires Playwright and Chromium and defaults to the game served at `http://localhost:8000/valorstrike/` (`GAME_URL` and `CHROMIUM_PATH` override these).

`SHA256SUMS` records the installed binary and texture file hashes. Download caches are excluded from version control.

The existing `audit.js` uses its deterministic legacy map fixture for economy/input/ability regressions; it does not certify native map geometry. `verify_native_maps.js` uses real Chromium, the exported scenes and BVHs to check native routes, floor heights, capsule collision and full match initialization on all six maps.

## Weapon calibration and game feel

The weapon-stat snapshot comes from [Valorant API](https://valorant-api.com/v1/weapons), retrieved 2026-10-24. Movement/accuracy references, approximated controller and recoil parameters, native animation timing, and verification are documented in [GAME_FEEL.md](../../GAME_FEEL.md).

## Map loading artwork

Map-specific Riot splash images downloaded through the public Valorant API map records; per-map source URLs are recorded in maps/*/loading-source.json. Converted to1600x900 JPEG for loading screens and map tiles. Riot Games copyright; fan-project attribution above applies.

## Installed weapon finishes (25 October 2026)

`skins/` contains 86 original VALORANT weapon/knife skins with 138 selectable variants from 18 collections. Geometry, diffuse/normal/emissive/packed ORM textures, material assignments, attachment constraints and corresponding native first-person/weapon animation exports come from the public [Kingdom Archives model gallery](https://kingdomarchives.com/models). Models and textures remain © Riot Games. This fan project is not affiliated with or endorsed by Riot Games.

Each entry in `server/src/skins.json` records its exact model-viewer source URL, local hashed GLB, SHA-256, byte size, variant and local configuration. Icons and official item names come from the public [VALORANT API weapons endpoint](https://valorant-api.com/v1/weapons); each icon retains its original media URL in the catalogue. Materials are packaged as standard glTF PBR, images capped at 1024 pixels, and transparencies preserved. These are downloaded original finishes, rather than the previous invented palette/pattern shaders. Unsupported Ego shader exports are excluded. No custom finisher, paid entitlement, or original game's skin-specific sound system is claimed.

Reproduce with a Pillow-enabled Python: `python work/import_valorant_skins.py` (or `work/build_skins_catalog.py`). Source responses are cached in ignored `work/valorant-source/`. Only selected models load at runtime; this collection is not part of the startup agent preload. New animation files live alongside the existing standard clips in `animations/`.
