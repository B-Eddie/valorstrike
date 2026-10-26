Valorant visual update

Inspected the existing HUD / buy / action screenshots at 1280×720, current scoreboard markup and styles, HUD runtime, observer panels, native map renderer and existing client regression tests before editing. Reference: https://interfaceingame.com/screenshots/valorant-scoreboard/ and https://interfaceingame.com/screenshots/valorant-combat-report/ .

Updated the HUD team portraits, score and timer, buy-phase announcement, health / shields, abilities, ammo, credits, minimap surface, weapon silhouettes in the kill feed, round banners, buy menu, scoreboard and observer panels. Actual local agent portrait artwork replaces letter placeholders. The scoreboard retains K/D/A order and uses Loadout / Creds / Ping columns; enemy equipment stays concealed. Live buy-phase observer sidebars have been removed. Existing native maps, weapon and character models supply the game scene.

Completed: 18/18 targeted client regression files passed. Full output: valorant-visual-targeted-tests.log. Includes the new test_hud_native.cjs plus existing HUD, compact layout, combat report, render quality, minimap, visibility, crosshair, loadout, timer, touch, Skye / Reyna, spectating, online Spike, online buying and online / offline results checks. All seven inline scripts compile, and the browser check script passes node --check. The new regression also verifies that holding the knife does not replace the purchased primary in the scoreboard.

The broader client suite was stopped during its long-running offline ability simulation; no full-suite pass is claimed. Test dependencies were restored offline from the existing npm cache and all six collision worlds were built using the existing build-all.cjs. Dependencies and generated worlds are in the server's existing ignored directories.

Browser limitation: Chromium could not launch in this sandbox (Crashpad socket / setsockopt Operation not permitted, SIGTRAP). The existing visual screenshots were inspected; new screenshots and pixel-level parity could not be verified here. The existing browser HUD check now expects the deliberately selected system sans HUD face, while still checking bundled title fonts.

All work remains in this tree. No git push, remote or credential changes were attempted.
