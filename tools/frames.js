"use strict";
// The three comparison frames from issue #5 (landing, bridge top, brake lever) at morning,
// dusk and night, on a desktop window and a narrow landscape phone window.
//   node tools/frames.js        -> tools/out/frame-*.png and docs/frames/sheet-*.jpg
// Rendered headless with SwiftShader (software WebGL): colours and framing are right,
// anti-aliasing and speed are not those of a real GPU.
const path = require("path");
const H = require("./harness");

const VIEWS = [
  { name: "landing", s: 0, l: 0, h: 0.3, settle: 40, lantern: true },
  { name: "bridge-top", s: 92, l: 0, h: 0.8, settle: 60 },
  { name: "brake-lever", s: 120.8, l: -9, h: 0.3, settle: 150 }
];
const MOMENTS = ["morning", "dusk", "night"];
const SIZES = [{ name: "desktop", width: 1280, height: 720 }, { name: "phone-landscape", width: 740, height: 360 }];

(async () => {
  let sharp = null;
  try { sharp = require("sharp"); } catch (e) { /* optional: contact sheets need it */ }
  const files = {};
  for (const size of SIZES) {
    const h = await H.open({ viewport: { width: size.width, height: size.height } });
    for (const v of VIEWS) for (const m of MOMENTS) {
      await h.page.evaluate(([v, m]) => {
        const d = window.__dbg;
        d.WindGardens.reset();
        d.place(v.s, v.l, v.h); d.step(v.settle);
        d.DayCycle.setMoment(m);
      }, [v, m]);
      if (v.lantern) {       // wait for the long flash of the lantern, then let its glow build up
        await h.page.waitForFunction(() => (clock.elapsedTime % 6) > 0.1 && (clock.elapsedTime % 6) < 0.5, null, { timeout: 15000, polling: 16 });
        await h.page.evaluate(() => window.__dbg.step(12));
      }
      await h.page.evaluate(() => { hint("", 1); });
      await h.page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
      const name = "frame-" + size.name + "-" + v.name + "-" + m;
      files[name] = await h.shot(name);
    }
    if (h.errors.length) console.log("page errors:", h.errors);
    await h.close();
  }
  console.log(Object.keys(files).length + " frames in tools/out");
  if (!sharp) { console.log("install sharp in tools/ for the contact sheets"); return; }
  for (const size of SIZES) {
    const w = size.width / 2 | 0, hgt = size.height / 2 | 0, comps = [];
    VIEWS.forEach((v, r) => MOMENTS.forEach((m, c) => comps.push({ input: files["frame-" + size.name + "-" + v.name + "-" + m], r, c })));
    const tiles = await Promise.all(comps.map(async t => ({ input: await sharp(t.input).resize(w, hgt).toBuffer(), left: t.c * w, top: t.r * hgt })));
    const out = path.join(H.ROOT, "docs", "frames", "sheet-" + size.name + ".jpg");
    await sharp({ create: { width: w * 3, height: hgt * 3, channels: 3, background: "#000" } }).composite(tiles).jpeg({ quality: 82 }).toFile(out);
    console.log("wrote", path.relative(H.ROOT, out));
  }
})();
