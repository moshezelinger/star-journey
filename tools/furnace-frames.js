"use strict";
// Frames of the Furnace Moon (star 4) at its main moments, for a look check:
//   node tools/furnace-frames.js   -> tools/out/furnace-frame-*.png
// The hero blinks in some frames because the script keeps him invulnerable.
const H = require("./harness");
(async () => {
  const h = await H.open(); const { page } = h;
  const ev = (fn, a) => page.evaluate(fn, a);
  const fr = async (name) => { await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))); await h.shot("furnace-frame-" + name.replace(/^v-/, "")); };
  await ev(() => { const d = window.__dbg, f = d.FurnaceMoon.debug; window.goToStar(3); d.step(300); d.place(9, 0, f.terrainH(9, 0) + 0.1); d.setInvuln(99);
    for (let i = 0; i < 400; i++) { d.step(1); const b = f.balls[0]; if (b && b.l > -6) break; } });
  await fr("v-slope");
  await ev(() => { const d = window.__dbg, f = d.FurnaceMoon.debug; d.place(18.5, 0, 0.5); d.step(200); f.giveDeflect(); d.place(61, 0, f.terrainH(61, 0) + 0.05); d.step(30);
    for (let i = 0; i < 600; i++) { d.setInvuln(9); d.step(1); const b = f.balls[0]; if (b && b.s < 68) break; } });
  await fr("v-fight1-ball");
  await ev(() => { const d = window.__dbg, f = d.FurnaceMoon.debug; f.state.jr.state = "blind"; f.state.jr.t = 0; f.state.jr.s = 77; d.step(50); d.place(68, 2, f.terrainH(68, 2) + 0.05); d.step(20); });
  await fr("v-fight1-blind");
  await ev(() => { const d = window.__dbg, f = d.FurnaceMoon.debug; f.skipToBowser(); d.place(86, 0, 0.2); for (let i = 0; i < 700 && f.cages.some(x => x === "none"); i++) d.step(1); d.step(120);
    // free everyone directly, let the friends do their jobs
    f.state.cages = f.state.cages.map(() => "cracked");
    for (const i of [0, 1, 2, 3]) { const cg = f.layout.cages[i]; d.place(cg.s - 2.2, cg.l, 0.3); d.P.face.copy(f.worldPos(cg.s, cg.l, 0).sub(f.worldPos(cg.s - 2.2, cg.l, 0))).normalize(); d.powerPunch(); d.setInvuln(9); d.step(25); }
    d.place(105, -10, 0.3); d.setInvuln(99);
    for (let i = 0; i < 60 * 3; i++) { d.setInvuln(99); d.step(1); } });
  await ev(() => { const d = window.__dbg, f = d.FurnaceMoon.debug; d.place(112, -6, 0.3); const a = f.worldPos(112, -6, 0), b = f.worldPos(117, -17, 0); d.camDir.copy(b.sub(a)).normalize(); d.P.face.copy(d.camDir); d.setCam(0.5, 11); d.step(30); });
  await fr("v-crater");
  await ev(() => { const d = window.__dbg, f = d.FurnaceMoon.debug; for (let i = 0; i < 60 * 10 && !f.delivered; i++) { d.setInvuln(99); d.step(1); } const b = f.layout.bank; d.place(b.s, b.l, 0.3); d.step(10); d.place(92, 0, 0.3); d.setCam(0.38, 9.15); for (let i = 0; i < 60 * 4; i++) { d.setInvuln(99); d.step(1); if (f.bowser.state === "recover" && f.wave && f.wave.r > 4) break; } });
  await fr("v-final");
  await ev(() => { const d = window.__dbg, f = d.FurnaceMoon.debug, E = f.layout.edge; f.state.bowser.state = "recover"; d.place(103 - 2, 0, 0.3); d.P.dashT = 0.3; d.step(2); for (let i = 0; i < 400 && !f.hanging; i++) d.step(1); d.place(E.s - 2, 0, f.terrainH(E.s - 2, 0) + 0.05); d.step(30); });
  await fr("v-hanging");
  await ev(() => { const d = window.__dbg, f = d.FurnaceMoon.debug, E = f.layout.edge; d.P.face.copy(f.worldPos(E.s, 0, 0).sub(f.worldPos(E.s - 2, 0, 0))).normalize(); d.punch(); d.step(60 * 4.3); });
  await fr("v-road");
  console.log("errors", h.errors); await h.close();
})();
