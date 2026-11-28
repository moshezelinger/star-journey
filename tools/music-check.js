"use strict";
// Menu music checks: "The Lantern Signal" plays on the opening screen and the star picker,
// waits for the first tap, follows the Sound switch and fades out when a game starts.
//   node tools/music-check.js
const H = require("./harness");

(async () => {
  const h = await H.open({ play: false });
  const c = H.checker("menu music");
  const page = h.page;
  const wait = ms => page.waitForTimeout(ms);

  const probe = () => page.evaluate(() => ({ playing: MenuMusic.playing }));

  await page.waitForFunction(() => window.__dbg && window.__dbg.state === "MENU");
  c.ok("no sound before the first tap (browser policy)", !(await probe()).playing);

  // first tap on empty space starts the song and it fades in
  await page.mouse.click(640, 100);
  await wait(2500);
  let p = await probe();
  c.ok("the first tap starts the song", p.playing, p);
  c.ok("the in-game arpeggio is quiet on the menu", await page.evaluate(() => { Audio.init(); return Audio.menuQuiet === true; }));

  // Sound switch
  await page.click("#soundBtn");
  await wait(300);
  c.ok("Sound: Off pauses the song", !(await probe()).playing);
  await page.click("#soundBtn");
  await wait(2000);
  c.ok("Sound: On brings it back", (await probe()).playing);

  // the loop: near the end of the file the song restarts by itself from the top
  await page.evaluate(() => { const a = MenuMusic.element; a.currentTime = a.duration - 0.6; });
  await wait(2500);
  const lp = await page.evaluate(() => { const a = MenuMusic.element; return { playing: MenuMusic.playing, t: a.currentTime, dur: a.duration }; });
  c.ok("the song loops back to the start", lp.playing && lp.t < 10, lp);
  c.ok("the track is the Lantern Signal (2:34)", Math.abs(lp.dur - 154.8) < 1, lp.dur);

  // starting a game fades it out
  await page.click("#playBtn");
  await page.waitForFunction(() => window.__dbg.state === "PLAYING");
  await wait(1800);
  p = await probe();
  c.ok("Play fades the song out", !p.playing, p);
  c.ok("the arpeggio returns in game", await page.evaluate(() => Audio.menuQuiet === false));

  // back to the menu: the song returns
  await page.evaluate(() => { document.getElementById("menuBtn").click(); });
  await wait(2200);
  c.ok("Main Menu brings the song back", (await probe()).playing || (await page.evaluate(() => MenuMusic.playing)));

  // a star jump from the menu leaves it quiet
  await page.evaluate(() => { document.querySelector('#starPick button[data-star="1"]').click(); });
  await wait(1800);
  c.ok("jumping to a star fades it out too", !(await probe()).playing);

  c.ok("no page errors", h.errors.length === 0, h.errors);
  const failed = c.report();
  await h.close();
  process.exit(failed ? 1 : 0);
})();
