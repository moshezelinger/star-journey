"use strict";
// A picture of every character built in code (js/characters.js), side by side.
//   node tools/lineup.js                 -> docs/frames/characters-lineup.jpg
//   node tools/lineup.js brother side    -> one character, from the side (tools/out/lineup-brother-side.png)
//   node tools/lineup.js brother face    -> one character's face up close
const path = require("path");
const H = require("./harness");

(async () => {
  const [only, view] = process.argv.slice(2);
  const query = "tools/lineup.html?" + (only ? "only=" + only : "") + (view ? "&" + view : "");
  const h = await H.open({ query, play: false, viewport: only ? { width: 700, height: 700 } : { width: 1600, height: 900 }, context: { deviceScaleFactor: 2 } });
  await h.page.waitForFunction(() => window.__ready, null, { timeout: 15000 });
  await h.page.waitForTimeout(1200);
  const out = only ? path.join(H.OUT, "lineup-" + only + (view ? "-" + view : "") + ".png") : path.join(H.ROOT, "docs", "frames", "characters-lineup.jpg");
  await h.page.screenshot(only ? { path: out } : { path: out, type: "jpeg", quality: 88 });
  if (h.errors.length) console.log("page errors:", h.errors);
  console.log("wrote", path.relative(H.ROOT, out));
  await h.close();
})();
