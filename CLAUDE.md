# Star Journey: notes for agents

- Browser game, Three.js r128, no build step. Star 1 (Wind Gardens) lives in `js/wind-gardens.js`, star 2 (Basalt Mines) in `js/basalt-mines.js` (`docs/basalt-mines.md`); `index.html` reaches each through the `LEVELS` table; character models in `js/models.js`; shared state in `js/shared.js`; tuning, `FX` switches and `QUALITY` tiers in `js/tuning.js`; day and night in `js/day-cycle.js`.
- **Performance rules: `docs/performance-rules.md` (draft, awaiting Moshe's approval).** Follow its budgets and techniques for every visual change: instancing for repeats, the shared kit (`box()`, `cyl()`), `mergeStatic` for static parts, shader animation for many objects, one shadow-casting light, an `FX` switch for each costly effect.
- Before each commit run `node tools/route-check.js`, `mines-check.js`, `day-check.js`, `touch-check.js`, `camera-check.js` (run `npm install` in `tools/` once). For visual changes also `node tools/frames.js`, and record draw calls and triangles before and after.
- Work on a branch, never merge to `main` without Moshe playing it. Report progress on the GitHub issues using the follow-up record format in issue #1, in Hebrew.
- **Characters and enemies are ready-made GLB/glTF models in the Nintendo style** (Luigi, Donkey Kong, Goomba, Koopa and so on), like the Mario and Bowser models already in the game. Do not build characters from primitives. Rules for each model:
  - Use only a model whose licence allows reuse with credit (CC-BY 4.0 or more open) and whose source page you have actually read. Never guess a source or a licence.
  - Put it in `assets/<name>/` as `.glb` or `scene.gltf` + `scene.bin` + `textures/`, with a `license.txt` copied from the source (title, source URL, author, licence), and add the credit to the Credits section of `README.md`.
  - Register it in `js/models.js` (path, standing height, facing, clips) and load it through `Models.load`, which gives a simple stand-in while loading and if the file is missing.
  - Budget per model: up to 3MB and 30 thousand triangles (`docs/performance-rules.md`).
  - The repository is a non-commercial fan project; keep the notice in `README.md`.
