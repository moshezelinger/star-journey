"use strict";
// Camera regression (issue #4): the camera must stay above the real ground, keep Mario in
// frame and never sit further from him than zoom + the airborne extra.
//   node tools/camera-check.js            -> numbers only
//   node tools/camera-check.js --shots    -> also writes tools/out/cam-*.png
const H = require("./harness");

const SPOTS = [
  // name, s, l, height to drop from
  ["net", 61.5, 0, 0.5],
  ["trench-exit", 64.5, 0, 0.5],
  ["trench-wall", 57.8, 0, 0.5],
  ["bridge", 90, 0, 0.8],
  ["canyon-rim", 77.5, 3.5, 0.5],
  ["far-planks", 106, 0, 0.8],
  ["meadow", 10, 0, 0.5]
];
const CAMS = [["pitch-min-zoom-min", 0.1, 4.5], ["pitch-min-zoom-max", 0.1, 16], ["pitch-max-zoom-max", 1.15, 16],
  ["pitch-max-zoom-min", 1.15, 4.5], ["default", 0.38, 9.15]];

(async () => {
  const shots = process.argv.includes("--shots");
  const h = await H.open();
  const c = H.checker("camera");
  for (const [name, s, l, h0] of SPOTS) {
    for (const [cname, pitch, zoom] of CAMS) {
      const r = await h.page.evaluate(([s, l, h0, pitch, zoom]) => {
        const d = window.__dbg;
        d.setCam(pitch, zoom); d.place(s, l, h0);
        let worst = 1e9, maxDist = 0;
        for (let i = 0; i < 150; i++) {
          d.step(1);
          const f = d.camFloor; worst = Math.min(worst, f.h - f.floor);
          if (i > 20) maxDist = Math.max(maxDist, d.cam.dist);
        }
        // Mario on screen? project his chest into normalized device coordinates
        const v = d.P.pos.clone().addScaledVector(d.P.up, 0.8).project(d.camera);
        return { clearance: worst, maxDist, ndc: [v.x, v.y, v.z], grounded: d.P.grounded, limit: zoom + 1.2 };
      }, [s, l, h0, pitch, zoom]);
      const inFrame = Math.abs(r.ndc[0]) < 0.95 && Math.abs(r.ndc[1]) < 0.95 && r.ndc[2] < 1;
      c.ok(name + " / " + cname + " above ground", r.clearance > 0.2, "clearance " + r.clearance.toFixed(2));
      c.ok(name + " / " + cname + " distance <= zoom + 1.2", r.maxDist <= r.limit + 1e-3, r.maxDist.toFixed(2) + " <= " + r.limit.toFixed(2));
      c.ok(name + " / " + cname + " Mario in frame", inFrame, r.ndc.map(x => x.toFixed(2)).join(","));
      if (shots && (cname === "default" || cname === "pitch-min-zoom-min" || cname === "pitch-max-zoom-max")) {
        await h.page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
        await h.shot("cam-" + name + "-" + cname);
      }
    }
  }
  // climbing out of the trench: walk forward from the net with the camera at its lowest
  const climb = await h.page.evaluate(() => {
    const d = window.__dbg;
    d.setCam(0.1, 9.15); d.place(61.5, 0, 0.5); d.step(30);
    d.keys.KeyW = true;
    let worst = 1e9, maxDist = 0, out = [];
    for (let i = 0; i < 120; i++) {
      d.step(1);
      const f = d.camFloor; worst = Math.min(worst, f.h - f.floor); maxDist = Math.max(maxDist, d.cam.dist);
    }
    d.keys.KeyW = false;
    return { worst, maxDist, s: d.WindGardens.debug.coordsOf(d.P.pos).s };
  });
  c.ok("walk out of the trench at low pitch stays above ground", climb.worst > 0.2, climb);
  c.ok("walk out of the trench keeps distance", climb.maxDist <= 9.15 + 1.2 + 1e-3, climb.maxDist.toFixed(2));
  if (h.errors.length) c.ok("no page errors", false, h.errors.join(" | "));
  const failed = c.report();
  await h.close();
  process.exit(failed ? 1 : 0);
})();
