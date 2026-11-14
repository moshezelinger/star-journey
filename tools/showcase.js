"use strict";
// Screenshots for a level's build portfolio (docs/showcase/<level>/README.md).
//   node tools/showcase.js wind-gardens          -> every shot and grid in docs/showcase/wind-gardens/shots.json
//   node tools/showcase.js wind-gardens 20-grass -> only the shots and grids whose name starts with that
//
// shots.json:
// {
//   "viewport": [1280, 720],
//   "shots": [
//     { "name": "17-landing", "place": [s, l, h], "cam": [pitch, zoom], "moment": "morning", "settle": 40 },
//     { "name": "20-mill-side", "place": [s, l, h], "free": { "from": [s, l, h], "to": [s, l, h] }, "moment": "dusk" },
//     { "name": "21-panel", "query": "?tune", "panel": true, "place": [s, l, h] },
//     { "name": "22-net", "place": [s, l, h], "cam": [pitch, zoom], "gray": true }   (also saves 22-net-gray.jpg)
//   ],
//   "grids": [ { "name": "19-before-after", "cols": 2, "width": 1280, "tiles": ["before-landing.jpg", "17-landing"] } ]
// }
// "place" puts the hero at arc length s, side l, height h; "cam" sets the follow camera; "free"
// points the camera from one spot to another (both in level coordinates). Tiles are shot names or
// files already in the img folder (for example "before" pictures taken from an older commit).
// Shots are saved as JPEG (quality 82) to keep the repository small. Rendering is headless and
// software-only: colours and framing are right, frame rate and anti-aliasing are not a real GPU's.
const fs = require("fs");
const path = require("path");
const H = require("./harness");
const sharp = require("sharp");

(async () => {
  const level = process.argv[2], only = process.argv[3] || "";
  if (!level) { console.log("usage: node tools/showcase.js <level> [name-prefix]"); process.exit(1); }
  const dir = path.join(__dirname, "..", "docs", "showcase", level);
  const spec = JSON.parse(fs.readFileSync(path.join(dir, "shots.json"), "utf8"));
  const img = path.join(dir, "img");
  fs.mkdirSync(img, { recursive: true });
  const [W, Hh] = spec.viewport || [1280, 720];
  const shots = (spec.shots || []).filter(s => s.name.startsWith(only));
  const byQuery = {};
  for (const s of shots) (byQuery[s.query || ""] = byQuery[s.query || ""] || []).push(s);

  for (const [query, list] of Object.entries(byQuery)) {
    const h = await H.open({ viewport: { width: W, height: Hh }, query });
    for (const s of list) {
      await h.page.evaluate((s) => {
        const d = window.__dbg, wg = d.WindGardens.debug;
        d.WindGardens.reset();
        if (s.cam) d.setCam(s.cam[0], s.cam[1]);
        const p = s.place || [0, 0, 0.3];
        d.place(p[0], p[1], p[2]); d.step(s.settle || 40);
        d.DayCycle.setMoment(s.moment || "morning");
        if (s.blade !== undefined) wg.setBladeAngle(s.blade);
        hint("", 1);
        window.__freeCam = null;
        if (s.free) {
          const cp = wg.worldPos(...s.free.from), lp = wg.worldPos(...s.free.to);
          window.__freeCam = { cp, lp, up: cp.clone().sub(d.active.center).normalize() };
        }
        if (s.panel) TunePanel.toggle(true);
      }, s);
      if (s.panel) { await h.page.evaluate(() => { window.__dbg.pause = false; }); await h.page.waitForTimeout(2500); await h.page.evaluate(() => { window.__dbg.pause = true; }); }
      for (let i = 0; i < 2; i++) {
        await h.page.evaluate(() => new Promise(r => requestAnimationFrame(() => {
          const f = window.__freeCam;
          if (f) { camera.position.copy(f.cp); camera.up.copy(f.up); camera.lookAt(f.lp); }
          r();
        })));
      }
      await h.page.evaluate(() => { const f = window.__freeCam; if (f) { camera.position.copy(f.cp); camera.up.copy(f.up); camera.lookAt(f.lp); } });
      await h.page.evaluate(() => new Promise(r => requestAnimationFrame(r)));
      const png = await h.page.screenshot();
      await sharp(png).jpeg({ quality: 82 }).toFile(path.join(img, s.name + ".jpg"));
      if (s.gray) await sharp(png).grayscale().jpeg({ quality: 82 }).toFile(path.join(img, s.name + "-gray.jpg"));
      console.log("shot", s.name);
    }
    if (h.errors.length) console.log("page errors:", h.errors);
    await h.close();
  }

  for (const g of (spec.grids || []).filter(g => g.name.startsWith(only))) {
    const cols = g.cols || 2, width = g.width || 1280, tw = Math.round(width / cols), th = Math.round(tw * 9 / 16);
    const files = g.tiles.map(t => { const f = path.join(img, /\.(jpg|png)$/.test(t) ? t : t + ".jpg"); if (!fs.existsSync(f)) throw new Error("missing tile " + f); return f; });
    const tiles = await Promise.all(files.map(f => sharp(f).resize(tw, th, { fit: "cover" }).toBuffer()));
    const rows = Math.ceil(tiles.length / cols);
    await sharp({ create: { width: tw * cols, height: th * rows, channels: 3, background: "#000" } })
      .composite(tiles.map((b, i) => ({ input: b, left: (i % cols) * tw, top: Math.floor(i / cols) * th })))
      .jpeg({ quality: 82 }).toFile(path.join(img, g.name + ".jpg"));
    console.log("grid", g.name);
  }
})().catch(e => { console.error(e); process.exit(1); });
