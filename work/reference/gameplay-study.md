# Local gameplay reference study

Reviewed the supplied 10-second frame contact sheets for all seven video IDs, then sampled video sequences at six frames per second with ffmpeg. No remote lookup was needed. The samples are qualitative visual references, not calibrated measurements of Valorant's world units.

| Reference | Inspected sequence | Relevant visual behavior |
| --- | --- | --- |
| `fu-ODOB1VHA` | 00:08–00:12; 00:21–00:25 | Range demonstrations: strafes move the environment laterally with a level horizon; the gun has a small relative drift and restrained roll, with no running camera bounce. Reversal changes weapon drift promptly. |
| `B9SbsCro5xM` | 00:12–00:16 | TenZ strafing and pistol taps: movement and a short settled firing moment alternate; single shots are roughly half a second apart in this example. Gun kick is quick and does not carry an extended sway after each tap. |
| `KnBDlmSSebA` | 05:15–05:19; 06:26–06:30; contact sheet throughout | Ascent cover: deliberate holds and brief exposures/returns rather than constant sinusoidal wandering. The gun remains mostly planted during the hold. A quick exposure can complete in about 0.3 seconds. |
| `htbLDNSFQ6c` | 01:55–01:59; contact sheet throughout | Cover demonstration: shoot at the edge, retreat/recover behind cover, re-expose at a different lateral position. Width and commitment vary; no movement-camera roll. |
| `eLI0Csg58wE` | 04:21–04:25; contact sheet throughout | Pro deathmatch: switch/equip animation has a distinct rise and settle, then short firing holds between rapid angle changes and repositioning. Camera remains level while traversing flat floors. |
| `hNFpSJO18lo` | 01:24–01:28; contact sheet throughout | Ranked example: controlled firing hold, quick reposition to the nearby cover, weapon redraw, ready hold. The non-reload movement drift is much smaller than the authored equip animation. |
| `jbHPFigy_ns` | 01:13–01:17; contact sheet throughout | Survival/corner example: stable pre-aimed hold, with a nearly still gun and level horizon; other sampled stills show deliberate cover changes and retreat, rather than perpetual close-range zigzagging. |

## Implementation guidance

- Preserve the existing world-camera behavior: level while running, with a brief landing dip only.
- Keep native equip/reload/fire clips and their gameplay duration synchronization. Add restrained velocity-relative weapon lag for lateral starts/stops; mouse-only sway cannot convey a pure A/D strafe.
- Reasonable *tuning bounds inferred from the reference*, not measured source constants: lateral weapon translation about 0.012–0.020 metres, forward lag about 0.006 metres, roll below 0.012 radians, settling damping 15–20 per second, and ADS reducing these offsets to 20–30%. Viewport motion is small (roughly 1–2% width in the Range samples).
- The shared player motor already expresses a documented 0.288-second run acceleration, an approximately 84-millisecond rifle release stop, and a 27.5% speed accuracy threshold. No evidence from these uncalibrated clips justifies arbitrarily changing those established physical constants.
- Offline bots instead use `xSmV`'s frame-dependent exponential interpolation on *normalized* direction (`min(1, dt*14)`). Their 0.05 normalized zero clamp takes roughly 0.2 seconds from full speed at 60 fps. Tight-peek fire also checks `!b.mv`, so its rest gate can outlast the physical accuracy window. Match their acceleration/braking to the shared motor, account for weapon/walk/tag scaling, and gate fire on actual speed.
- Existing jiggle phases (0.15 seconds out, 0.15 back, 0.20 hold) fit the observed brief exposure/return rhythm. Avoid changing a physically plausible preset solely to imitate one edited tutorial example; fix braking and distinguish a committed wide swing from a jiggle/hold.

Derived contact sheets were kept under `/tmp/vs-reference/` and `/tmp/<video-id>-contact.jpg` to avoid adding reference-media copies to the repository.
