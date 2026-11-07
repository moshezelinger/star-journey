# Brief for the next session: star 1 only (Wind Gardens)

Scope: only the first star. Do not start stars 2 to 4. Characters, their names and the current models stay as they are; do not replace or rename them. Read first: `README.md`, `docs/wind-gardens.md`, `docs/shared-foundation.md`, and the open issues #1, #3, #4, #5, #6, #8. Branch: continue on `claude/stoic-johnson-3vt03y`. No merge to `main` without play-testing and approval from Moshe.

Working rules (unchanged): register in issue #1 before starting. After each finished subtask write one follow-up record on the relevant issue (done | branch and commit | what was tested and on what | what remains | first next step | exit condition). Tick a checkbox only with evidence, and keep "implemented", "integrated" and "tested on a device" separate. When the fixes below are done, continue through the open issues (#3, #4, #5, #6, #8) in that order and update each one.

## 0. Camera bugs (fix first, issue #4)
1. **In the trench, and when the camera looks up, the planet disappears and the camera drifts far away from the model.** Likely cause: `updateCameraFollow` in `index.html` pushes the wanted camera position out to `radius + 1.6` of the base sphere. In the 3 unit deep trench (and with a low pitch) the wanted position falls under that limit and the camera is thrown outward along the radius, away from Mario and out of sight of the ground. The base sphere radius is the wrong floor there.
   - Use the real ground at the camera position (`WindGardens.query` / `terrainH`) with a small margin, and when the camera would be underground pull it toward Mario along the ray instead of pushing it away from the planet.
   - Verify with screenshots: standing on the net, climbing out, at minimum and maximum pitch, at minimum and maximum zoom, on the bridge and at the canyon rim. Mario and the ground must stay in frame, and the camera distance must never exceed the zoom setting plus the airborne extra.
2. Balcony camera: currently it swings sideways and is cramped between the tower and the blades. Design better framing for the climb and the rescue (for example a fixed framing during the climb, then a smooth hand-back to player control). Keep the occlusion ray test and make sure pulling in never puts the camera inside geometry.

## 1. Look and feel (issue #5), highest priority
- **Day and night cycle, 5 minutes per full cycle.** There is one light source (the sun). The planet turns around its own axis, and the lighting follows from that. Morning light is the starting state (warm, bright, readable), then noon, dusk, night and back to morning. Decide and document how to implement the rotation:
  - Option A (simplest, visually equivalent): rotate the sun direction around the planet axis. No change to physics or to anything standing on the planet.
  - Option B (literal): rotate the planet group and carry Mario, enemies, camera and everything else in the planet frame. Only choose this if A cannot do what is wanted, because all the game logic uses fixed world coordinates today.
  - Tie sky colour, ambient and hemisphere light, sun colour, fog or haze and the stars to the cycle (stars visible at night only).
  - Gameplay must stay readable at night: the route, the platform edges, the bridge gap and the koopa shadow stay visible; keep a minimum ambient level. The lantern's long-short-short flash and its beam should be at their best at night. The 5 minute length, the speed curve and the night darkness should be constants that are easy to change.
  - Pausing the game pauses the cycle. Restart resets it to morning. Check that nothing flickers during dusk and dawn and that frame time does not rise noticeably.
- Make the canyon read as a canyon: smooth walls (finer mesh or a dedicated strip mesh), depth haze, strata colours. Physics and mesh keep using the same `terrainH` function in `js/wind-gardens.js`.
- Windmill: a recognisable silhouette across the canyon, four broad blades, and a ladder blade that is clearly different. Cloth sails and flags that move with the shared wind.
- Layered depth: low foreground vegetation, a readable path in the middle, low-contrast islands and clouds behind. Colour is reinforced by shape or motion so the route reads in greyscale. Mario's feet and the platform edge stay visible.
- Deliver the three frames from #5 (landing, bridge top, brake lever) in day, dusk and night, on desktop and in a narrow landscape view, with sizes and sources, plus before and after frame time for each added effect. Simplify background decoration first if frame rate drops.

## 2. Feel and tuning (issues #3, #4, #8)
These need a human play session, so prepare for one rather than guessing.
- Expose these values in one place and keep them documented: gap width (9), blade stop window (±22°) and speed (0.65 rad/s), goomba warning and charge times, koopa telegraph time, wind drift, camera defaults, day length.
- Add a simple on-screen debug toggle for these values so Moshe can tune them while playing.
- Prepare the child test sheet from #8: did they find the lantern, aim the jump, read the wind, understand how to stop and release the brake; first-run duration; where they asked for help.
- Target 3 + 5 + 5 + 7 minutes for the whole first run. Record a full-route video and mark where time was measured.

## 3. Quality bar
- Re-run the existing checks after every change: jump over the gap (single and double, both directions), wrong and right blade, rescue once, gate to the next planet, punch on each target, koopa dodge. The scripts use `window.__dbg.step`; recreate them in `tools/` and commit them.
- Check a real touch device, or a faithful emulation, with two fingers (move plus look, move plus jump, zoom without punching). Say plainly what was only emulated.
- Measure frame rate and load time on at least one real machine and one phone, or state that they were not measured.
- Do not touch stars 2 to 4, `game-design/four-planets.md`, or the Pages workflow unless asked.

## Open questions for Moshe
- Licence for the repository.
- Is the blade stop window easy enough for ages 7 to 8?
