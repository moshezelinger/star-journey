"use strict";
// Day and night checks (issue #5):
//   node tools/day-check.js          (add --shots for a tuning-panel screenshot)
const H = require("./harness");

(async () => {
  const h = await H.open();
  const c = H.checker("day and night");
  const ev = (fn, a) => h.page.evaluate(fn, a);

  let r = await ev(() => { window.__dbg.DayCycle.apply(camera); return Object.assign({}, window.__dbg.DayCycle.state, { stars: starfield.visible, t: window.__dbg.DayCycle.time }); });
  c.ok("a new game starts in the morning", r.name === "morning" && Math.abs(r.elev - 30) < 1 && r.t < 1, r);
  c.ok("no stars in daylight", !r.stars, r.stars);

  // a full cycle in 0.1 s game steps (a few frames): watch for jumps in sky colour and light (flicker)
  r = await ev(() => {
    const D = window.__dbg.DayCycle, len = TUNE.day.length;
    D.time = 0; D.apply(camera);
    let prev = null, maxSky = 0, maxHemi = 0, maxSun = 0, minHemi = 9, starsNight = true, starsDay = false, names = new Set(), daySecs = 0;
    for (let t = 0; t <= len; t += 0.1) {
      D.time = t; D.apply(camera);
      const cur = { sky: scene.background.clone(), hemi: hemi.intensity, sun: sun.intensity };
      if (prev) {
        maxSky = Math.max(maxSky, Math.abs(cur.sky.r - prev.sky.r) + Math.abs(cur.sky.g - prev.sky.g) + Math.abs(cur.sky.b - prev.sky.b));
        maxHemi = Math.max(maxHemi, Math.abs(cur.hemi - prev.hemi)); maxSun = Math.max(maxSun, Math.abs(cur.sun - prev.sun));
      }
      minHemi = Math.min(minHemi, hemi.intensity);
      if (D.state.elev < -15 && !starfield.visible) starsNight = false;
      if (D.state.elev > 5 && starfield.visible) starsDay = true;
      if (D.state.elev > 0) daySecs += 0.1;
      names.add(D.state.name);
      prev = cur;
    }
    return { maxSky, maxHemi, maxSun, minHemi, starsNight, starsDay, names: [...names], dayShare: daySecs / len, minAmbient: TUNE.day.minAmbient };
  });
  c.ok("passes through morning, noon, sunset, night", ["morning", "noon", "sunset", "night"].every(n => r.names.includes(n)), r.names);
  c.ok("stars at night only", r.starsNight && !r.starsDay, r);
  c.ok("ambient light never below the minimum", r.minHemi >= r.minAmbient - 1e-6, r.minHemi.toFixed(3));
  c.ok("no jump in sky colour within 0.1 s (flicker)", r.maxSky < 0.02, r.maxSky.toFixed(4));
  c.ok("no jump in light within 0.1 s (flicker)", r.maxHemi < 0.01 && r.maxSun < 0.015, [r.maxHemi.toFixed(4), r.maxSun.toFixed(4)]);
  c.ok("most of the cycle is daylight", r.dayShare > 0.5, r.dayShare.toFixed(2));

  // pause: the animation loop keeps rendering, the day must not advance
  r = await ev(async () => {
    const D = window.__dbg.DayCycle; D.time = 40;
    window.__dbg.pause = true;
    await new Promise(res => setTimeout(res, 700));
    const a = D.time;
    window.__dbg.step(60);
    return { paused: a, afterStep: D.time };
  });
  c.ok("paused game does not advance the day", r.paused === 40, r);
  c.ok("playing advances the day", Math.abs(r.afterStep - 41) < 0.01, r);

  // restart returns to the morning
  r = await ev(() => { const D = window.__dbg.DayCycle; D.setMoment("night"); resetGame(); D.apply(camera); return { t: D.time, name: D.state.name }; });
  c.ok("restart resets to the morning", r.t === 0 && r.name === "morning", r);

  // brake lever framing keeps Mario in frame
  r = await ev(() => {
    const d = window.__dbg; d.setCam(0.38, 9.15); d.place(120.8, -9, 0.3); d.step(180);
    const v = d.P.pos.clone().addScaledVector(d.P.up, 0.8).project(d.camera);
    const hub = d.WindGardens.debug.worldPos(129.5, 0, 22).project(d.camera);
    return { mario: [v.x, v.y], hub: [hub.x, hub.y], dist: d.cam.dist };
  });
  c.ok("brake lever: Mario in frame", Math.abs(r.mario[0]) < 0.95 && Math.abs(r.mario[1]) < 0.95, r.mario.map(x => x.toFixed(2)));
  c.ok("brake lever: windmill hub in frame", Math.abs(r.hub[0]) < 0.95 && Math.abs(r.hub[1]) < 0.95, r.hub.map(x => x.toFixed(2)));
  c.ok("brake lever: distance at most zoom + 8.3", r.dist <= 9.15 + 8.33, r.dist.toFixed(2));

  if (process.argv.includes("--shots")) {
    await h.page.keyboard.press("Backquote");
    await ev(() => { window.__dbg.DayCycle.setMoment("dusk"); window.__dbg.place(92, 0, 0.8); window.__dbg.step(60); });
    await h.page.waitForTimeout(400);
    await h.shot("tune-panel");
  }
  if (h.errors.length) c.ok("no page errors", false, h.errors.join(" | "));
  const failed = c.report();
  await h.close();
  process.exit(failed ? 1 : 0);
})();
