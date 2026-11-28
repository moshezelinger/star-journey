"use strict";
// Music checks (js/music.js): the Suno songs of the game.
//   menu and star 1: The Lantern Signal; star 2: The Three-Knock Trail; star 3: Glowing Mushroom;
//   star 4: The Volcanic Path until Bowser lands, The Volcano's Call until he falls.
// Starts on the first gesture (including a tap straight on Play), follows the Sound switch,
// loops, rewinds when its screen is left, and the arpeggio waits while a song plays.
//   node tools/music-check.js
const fs = require("fs");
const path = require("path");
const H = require("./harness");

(async () => {
  const c = H.checker("music");

  // every file in the table exists and is a real MP3, not a placeholder
  const src = fs.readFileSync(path.join(__dirname, "..", "js", "music.js"), "utf8");
  const files = [...src.matchAll(/src: "([^"]+\.mp3)"/g)].map(m => m[1]);
  const sizes = files.map(f => { const p = path.join(__dirname, "..", "assets", "music", f); return fs.existsSync(p) ? fs.statSync(p).size : 0; });
  c.ok("five songs in the table, every file present (over 1 MB)", files.length === 5 && sizes.every(s => s > 1e6), files.map((f, i) => f + " " + (sizes[i] / 1e6).toFixed(1) + "MB"));

  const state = page => page.evaluate(() => ({ cur: Music.current, want: Music.wanted, playing: Music.playing, t: Music.element ? +Music.element.currentTime.toFixed(2) : -1,
    vol: Music.element ? +Music.element.volume.toFixed(3) : 0, quiet: Audio.synthQuiet, gen: Audio.musicGain ? +Audio.musicGain.gain.value.toFixed(3) : null }));

  // ---- 1. the bug: the very first tap is on Play (no tap on the menu before it) ----
  {
    const h = await H.open({ play: false });
    const page = h.page;
    await page.waitForFunction(() => window.__dbg && window.__dbg.state === "MENU");
    await page.waitForTimeout(800);
    c.ok("no sound before the first tap (browser policy)", !(await state(page)).playing);
    await page.click("#playBtn");
    await page.waitForFunction(() => window.__dbg.state === "PLAYING");
    await page.waitForTimeout(2500);
    const s = await state(page);
    c.ok("Play as the very first tap: the song starts on star 1", s.playing && s.cur === "lantern", s);
    c.ok("the arpeggio waits while it plays", s.quiet === true && s.gen < 0.05, s);
    c.ok("no page errors (first run)", h.errors.length === 0, h.errors);
    await h.close();
  }

  // ---- 1b. the first tap is on a star number (star 3) ----
  {
    const h = await H.open({ play: false });
    const page = h.page;
    await page.waitForFunction(() => window.__dbg && window.__dbg.state === "MENU");
    await page.click('#starPick button[data-star="2"]');
    await page.waitForTimeout(3500);
    const s = await state(page);
    c.ok("a star number as the first tap: that star's song starts (star 3, Glowing Mushroom)", s.playing && s.cur === "mushroom", s);
    await h.close();
  }

  // ---- 1c. a phone: the first touch is on Play ----
  {
    const h = await H.open({ play: false, context: { hasTouch: true, isMobile: true, viewport: { width: 844, height: 390 } } });
    const page = h.page;
    await page.waitForFunction(() => window.__dbg && window.__dbg.state === "MENU");
    await page.tap("#playBtn");
    await page.waitForFunction(() => window.__dbg.state === "PLAYING");
    await page.waitForTimeout(2500);
    const s = await state(page);
    c.ok("touch: a tap on Play starts the song", s.playing && s.cur === "lantern", s);
    await h.close();
  }

  // ---- 2. the full tour ----
  const h = await H.open({ play: false });
  const page = h.page;
  const wait = ms => page.waitForTimeout(ms);
  await page.waitForFunction(() => window.__dbg && window.__dbg.state === "MENU");
  await page.mouse.click(640, 100);
  await wait(2500);
  let s = await state(page);
  c.ok("a tap on the menu starts The Lantern Signal", s.playing && s.cur === "lantern", s);

  await page.click("#soundBtn");
  await wait(300);
  c.ok("Sound: Off pauses the song", !(await state(page)).playing);
  await page.click("#soundBtn");
  await wait(2000);
  c.ok("Sound: On brings it back", (await state(page)).playing);

  await page.evaluate(() => { const a = Music.element; a.currentTime = a.duration - 0.6; });
  await wait(2500);
  const lp = await page.evaluate(() => { const a = Music.element; return { playing: Music.playing, t: a.currentTime, dur: a.duration }; });
  c.ok("the song loops back to the start", lp.playing && lp.t < 10, lp);
  c.ok("the track is the Lantern Signal (2:34)", Math.abs(lp.dur - 154.8) < 1, lp.dur);

  const menuVol = (await state(page)).vol;
  await page.click("#playBtn");
  await page.waitForFunction(() => window.__dbg.state === "PLAYING");
  await wait(3000);
  s = await state(page);
  c.ok("the song carries on into Wind Gardens", s.playing && s.cur === "lantern", s);
  c.ok("softer in the game than on the menu", s.vol < menuVol, { menu: menuVol, game: s.vol });

  // each star and its song (duration of the file checks the right one is loaded)
  const stars = [[1, "knock", 148.8], [2, "mushroom", 200.0], [3, "volcanic", 179.6]];
  for (const [i, name, dur] of stars) {
    await page.evaluate(i => goToStar(i), i);
    await wait(3500);
    s = await state(page);
    const d = await page.evaluate(() => Music.element.duration);
    c.ok("star " + (i + 1) + " plays " + name + " (" + dur + " s)", s.playing && s.cur === name && Math.abs(d - dur) < 1, Object.assign({ dur: d }, s));
    c.ok("star " + (i + 1) + ": the arpeggio waits", s.quiet === true && s.gen < 0.05, s);
  }
  await page.evaluate(() => goToStar(1));
  await wait(3500);
  s = await state(page);
  c.ok("Basalt Mines starts from the three knocks, at once", s.playing && s.t < 4 && s.vol > 0.3, s);

  // star 4: the volcanic path, then the fight from Bowser's landing, then the arpeggio once he falls
  await page.evaluate(() => goToStar(3));
  await wait(3000);
  await page.evaluate(() => { const f = window.__dbg.FurnaceMoon; f.debug.skipToBowser(); });
  await page.waitForFunction(() => window.__dbg.FurnaceMoon.debug.bowser.state !== "off", null, { timeout: 15000 });
  s = await state(page);
  c.ok("Bowser leaps down: The Volcano's Call is wanted", s.want === "fight", s);
  await wait(4500);
  s = await state(page);
  const fd = await page.evaluate(() => Music.element.duration);
  c.ok("the fight song plays (2:49)", s.playing && s.cur === "fight" && Math.abs(fd - 169) < 1, Object.assign({ dur: fd }, s));
  await page.evaluate(() => { window.__dbg.FurnaceMoon.debug.state.beaten = true; });
  await wait(4000);
  s = await state(page);
  c.ok("Bowser falls: the fight song fades and the arpeggio returns", !s.playing && s.want === null && s.quiet === false, s);
  await page.evaluate(() => { window.__dbg.FurnaceMoon.reset(); });
  await wait(3500);
  s = await state(page);
  c.ok("a restart of star 4 brings back The Volcanic Path", s.playing && s.cur === "volcanic", s);

  // back to star 1, the flight, the menu
  await page.evaluate(() => goToStar(0));
  await wait(3500);
  s = await state(page);
  c.ok("it returns on star 1", s.playing && s.cur === "lantern", s);
  await page.evaluate(() => { const p = window.__dbg.planets[1]; window.__dbg.P.pos.copy(p.center).addScaledVector(new THREE.Vector3(0, 1, 0), p.radius + 30); });
  await wait(3500);
  s = await state(page);
  c.ok("the hero on another planet: star 1's song is gone", s.cur !== "lantern" || !s.playing, s);
  await page.evaluate(() => { document.getElementById("menuBtn").click(); });
  await wait(3500);
  s = await state(page);
  c.ok("Main Menu brings The Lantern Signal back", s.playing && s.cur === "lantern", s);

  // a file that cannot load: the arpeggio takes over instead of silence
  await page.evaluate(() => { Music.TRACKS.knock.failed = true; goToStar(1); });
  await wait(2500);
  s = await state(page);
  c.ok("a song that fails to load gives the stage back to the arpeggio", s.quiet === false && s.want === null, s);

  c.ok("no page errors", h.errors.length === 0, h.errors);
  const failed = c.report();
  await h.close();
  process.exit(failed ? 1 : 0);
})();
