"use strict";
// Two-finger touch checks (issue #4), EMULATED: Chromium with touch enabled and a 740x360
// landscape phone viewport, touches sent through the DevTools protocol. This is not a real
// device: no real finger sizes, palm contact, latency or browser gestures.
//   node tools/touch-check.js
const H = require("./harness");

(async () => {
  const h = await H.open({ viewport: { width: 740, height: 360 }, context: { hasTouch: true, isMobile: true } });
  const { page } = h;
  const c = H.checker("touch (emulated)");
  const cdp = await h.context.newCDPSession(page);
  const touch = (type, pts) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: pts.map(p => ({ x: p[0], y: p[1], id: p[2] })) });
  const wait = (ms) => page.waitForTimeout(ms);
  const btn = async (id) => page.evaluate((id) => { const r = document.getElementById(id).getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; }, id);
  const state = () => page.evaluate(() => { const d = window.__dbg; return { pos: d.P.pos.clone(), dir: d.camDir.clone(), grounded: d.P.grounded, punchT: d.P.punchT, zoom: d.cam.zoom, h: d.P.pos.distanceTo(d.active.center) - d.active.radius }; });
  const fresh = async () => page.evaluate(() => { const d = window.__dbg; d.WindGardens.reset(); d.place(2, 0, 0.1); d.pause = true; d.step(30); d.pause = false; });

  // 1. move + look: left thumb on the stick pushing forward, right finger dragging sideways
  await fresh();
  let a = await state();
  await touch("touchStart", [[120, 260, 1]]);
  await touch("touchMove", [[120, 200, 1]]);
  await touch("touchStart", [[120, 200, 1], [560, 180, 2]]);
  for (let i = 1; i <= 10; i++) { await touch("touchMove", [[120, 200, 1], [560 + i * 12, 180, 2]]); await wait(40); }
  await wait(300);
  let b = await state();
  await touch("touchEnd", []);
  const moved = Math.hypot(b.pos.x - a.pos.x, b.pos.y - a.pos.y, b.pos.z - a.pos.z);
  const turned = Math.acos(Math.max(-1, Math.min(1, a.dir.x * b.dir.x + a.dir.y * b.dir.y + a.dir.z * b.dir.z)));
  c.ok("move + look: Mario moves while the camera turns", moved > 1 && turned > 0.3, { moved: moved.toFixed(2), turned: turned.toFixed(2) });
  c.ok("move + look: no punch", b.punchT <= 0, b.punchT);

  // 2. move + jump: stick held, second finger taps Jump
  await fresh();
  const jb = await btn("jumpBtn");
  await touch("touchStart", [[120, 260, 1]]);
  await touch("touchMove", [[120, 200, 1]]);
  await wait(200);
  await touch("touchStart", [[120, 200, 1], [jb[0], jb[1], 3]]);
  await wait(120);
  b = await state();
  await touch("touchEnd", [[120, 200, 1]]);
  await wait(250);
  const b2 = await state();
  await touch("touchEnd", []);
  c.ok("move + jump: jump fires while the stick is held", b.h > 0.3 || !b.grounded, { h: b.h.toFixed(2), grounded: b.grounded });
  c.ok("move + jump: still moving after the jump", Math.hypot(b2.pos.x - b.pos.x, b2.pos.y - b.pos.y, b2.pos.z - b.pos.z) > 0.5);

  // 3. pinch zoom with two fingers on the right half: zoom changes, no punch
  await fresh();
  a = await state();
  await touch("touchStart", [[480, 180, 4]]);
  await touch("touchStart", [[480, 180, 4], [600, 180, 5]]);
  for (let i = 1; i <= 8; i++) { await touch("touchMove", [[480 + i * 6, 180, 4], [600 - i * 6, 180, 5]]); await wait(40); }
  await wait(200);
  b = await state();
  await touch("touchEnd", []);
  c.ok("pinch zooms", Math.abs(b.zoom - a.zoom) > 0.5, { before: a.zoom.toFixed(2), after: b.zoom.toFixed(2) });
  c.ok("pinch does not punch", b.punchT <= 0, b.punchT);

  // 4. move + pinch: stick held while two other fingers pinch
  await fresh();
  a = await state();
  await touch("touchStart", [[120, 260, 1]]);
  await touch("touchMove", [[120, 200, 1]]);
  await touch("touchStart", [[120, 200, 1], [480, 150, 6]]);
  await touch("touchStart", [[120, 200, 1], [480, 150, 6], [620, 150, 7]]);
  for (let i = 1; i <= 8; i++) { await touch("touchMove", [[120, 200, 1], [480 - i * 5, 150, 6], [620 + i * 5, 150, 7]]); await wait(40); }
  await wait(200);
  b = await state();
  await touch("touchEnd", []);
  c.ok("move + pinch: zoom changes and Mario keeps moving", Math.abs(b.zoom - a.zoom) > 0.5 && Math.hypot(b.pos.x - a.pos.x, b.pos.y - a.pos.y, b.pos.z - a.pos.z) > 1, { zoom: b.zoom.toFixed(2) });
  c.ok("move + pinch: no punch", b.punchT <= 0, b.punchT);

  if (h.errors.length) c.ok("no page errors", false, h.errors.join(" | "));
  const failed = c.report();
  await h.close();
  process.exit(failed ? 1 : 0);
})();
