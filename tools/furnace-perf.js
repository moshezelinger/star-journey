"use strict";
// Draw calls and triangles on the last star at a few views (docs/performance-rules.md budget: 350 calls, 350k triangles).
//   node tools/furnace-perf.js
// Headless SwiftShader: compare the counts, not the frame times.
const H = require("./harness");
const VIEWS = [["landing", 0, 0], ["bridges", 16, -9], ["fight1", 62, 0], ["fight2", 92, 0], ["edge", 126, 0]];
(async () => {
  const h = await H.open();
  const out = await h.page.evaluate((views) => {
    const d = window.__dbg, res = {};
    window.goToStar(3); d.step(260);
    const L = d.FurnaceMoon, f = L && L.debug;
    for (const [name, s, l] of views) {
      if (f) d.place(s, l, f.floorAt(s, l, 2) + 0.2); else d.step(1);
      d.step(60);
      updatePlanetDetail(); renderer.render(scene, camera);
      res[name] = { calls: renderer.info.render.calls, tris: renderer.info.render.triangles };
    }
    window.goToStar(0); d.step(120); updatePlanetDetail(); renderer.render(scene, camera);
    res.star1 = { calls: renderer.info.render.calls, tris: renderer.info.render.triangles };
    return res;
  }, VIEWS);
  for (const k in out) console.log(k.padEnd(10), String(out[k].calls).padStart(5), "calls", (out[k].tris / 1000).toFixed(0).padStart(5) + "k tris");
  await h.close();
})();
