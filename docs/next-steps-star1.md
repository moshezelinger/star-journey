# Brief for the next session: star 1 only (Wind Gardens)

Scope: only the first star. Do not start stars 2 to 4. Read first: `README.md`, `docs/wind-gardens.md`, `docs/shared-foundation.md`, and the open issues #1, #3, #4, #5, #6, #8. Branch: continue on `claude/stoic-johnson-3vt03y`. No merge to `main` without play-testing and approval from Moshe. Register in issue #1 before starting, and write one follow-up record per finished subtask (done | branch and commit | what was tested and on what | what remains | first next step | exit condition). Tick a checkbox only with evidence, and keep "implemented", "integrated" and "tested on a device" separate.

Everything below needs more design judgment than the first pass had.

## 1. Look and feel (issue #5), highest priority
- Current state: pastel, overexposed ground; the canyon walls look like jagged spikes because the terrain mesh is coarse near the rim; the windmill, bridge and balcony are plain boxes; the sky is a flat color.
- Goal: warm morning light, bright but readable. Keep the strongest highlight for the lantern and points of interest. Colour is reinforced by shape or motion, so the route reads in greyscale too.
- Make the canyon read as a canyon: smooth walls (finer mesh or a dedicated strip mesh), depth fog or haze, strata colours. Keep physics and mesh driven by the same `terrainH` function in `js/wind-gardens.js`.
- Windmill: a recognisable silhouette across the canyon, four broad blades, ladder blade clearly different. Cloth sails and flags that move with the shared wind.
- Layered depth: low foreground vegetation, readable path in the middle, low-contrast islands and clouds behind. Mario's feet and the platform edge must stay visible.
- Deliver the three frames from #5 (landing, bridge top, brake lever) on desktop and in a narrow landscape view, with sizes and sources, plus before and after frame-time for each added effect. Simplify background decoration first if frame rate drops.

## 2. Camera on the balcony (issue #4)
Currently the camera swings sideways and ends up cramped between the tower and the blades. Design a better balcony and climb camera (for example a fixed framing during the climb and rescue, then a smooth hand-back to player control). Keep the occlusion ray test, and check that pulling in never puts the camera inside geometry.

## 3. Characters (issue #6)
- Replace the hero, the brother and the enemies with original characters, so the project does not depend on third-party designs. Keep the same proportions (standing height 1.55, sole on the origin), hit sizes and animation hooks (idle, walk, jump, double jump, land, punch, climb).
- The code already isolates the brother (`makeLuigi`), enemies and cart as builder functions, and the hero model is loaded in `loadPlayerModel`. Rename internal identifiers and the model filename at the same time, then run the full verification below.
- Measure the hero model: scale, facing, foot contact, available clips. Record asset size and load time, and test a missing-file fallback.
- Credits: keep an accurate credits block for every asset still used. Ask Moshe about any asset whose licence is unclear.

## 4. Feel and tuning (issues #3, #4, #8)
These need a human play session, so prepare for one rather than guessing.
- Parameters to expose in one place and keep documented: gap width (9), blade stop window (±22°) and speed (0.65 rad/s), goomba warning and charge times, koopa telegraph time, wind drift, camera defaults.
- Add a simple on-screen debug toggle for these values, so Moshe can tune them during play.
- Prepare the child test sheet from #8: did they find the lantern, aim the jump, read the wind, understand how to stop and release the brake; first-run duration; where they asked for help.
- Target 3 + 5 + 5 + 7 minutes for the whole first run. Record a full-route video and mark where time was measured.

## 5. Quality bar
- Re-run the existing checks (jump over the gap single and double, wrong and right blade, rescue once, gate to the next planet, punch on each target, koopa dodge) after every change. The scripts use `window.__dbg.step` and live in the old session's scratch folder; recreate them in `tools/` and commit them.
- Check a real touch device or a faithful emulation with two fingers (move plus look, move plus jump, zoom without punching). Say plainly what was only emulated.
- Measure frame rate and load time on at least one real machine and one phone, or state that they were not measured.
- Do not touch stars 2 to 4, `game-design/four-planets.md`, or the Pages workflow unless asked.

## Open questions for Moshe
- Licence for the repository.
- Source of the final hero and brother models.
- Is the blade stop window easy enough for ages 7 to 8?
