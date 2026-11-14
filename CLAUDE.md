# Star Journey: notes for agents

- Browser game, Three.js r128, no build step. Star 1 (Wind Gardens) lives in `js/wind-gardens.js`; shared state in `js/shared.js`; tuning, `FX` switches and `QUALITY` tiers in `js/tuning.js`; day and night in `js/day-cycle.js`.
- **Performance rules: `docs/performance-rules.md` (draft, awaiting Moshe's approval).** Follow its budgets and techniques for every visual change: instancing for repeats, the shared kit (`box()`, `cyl()`), `mergeStatic` for static parts, shader animation for many objects, one shadow-casting light, an `FX` switch for each costly effect.
- Before each commit run `node tools/route-check.js`, `day-check.js`, `touch-check.js`, `camera-check.js` (run `npm install` in `tools/` once). For visual changes also `node tools/frames.js`, and record draw calls and triangles before and after.
- Work on a branch, never merge to `main` without Moshe playing it. Report progress on the GitHub issues using the follow-up record format in issue #1, in Hebrew.
- New characters and enemies are original designs for this game.
- **Build portfolio rule: `docs/showcase/README.md`.** A level is not finished, and not merged to `main` as finished, until `docs/showcase/<level>/README.md` tells its build in screenshots (Hebrew then English, chapters in order of play, before and after for visual changes). After a major pass on an existing level, add a chapter. Capture with `node tools/showcase.js <level>` from that level's `shots.json`; save "before" pictures as `img/before-*.jpg` before changing anything.
