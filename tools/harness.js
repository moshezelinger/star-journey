"use strict";
// Shared helpers for the headless QA scripts.
//
// - Serves the repository with a tiny static server (no Python needed).
// - Answers the two CDN script URLs from tools/node_modules/three, because the
//   headless browser in CI and cloud sessions often has no route to the CDNs.
//   The game itself still loads them from the CDN.
// - Opens the page in Chromium (Playwright), clicks Play and waits for the hero GLB.
//
// Everything runs on software rendering, so frame times measured here say
// nothing about a real GPU. Use them only to compare before and after.

const http = require("http");
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const ROOT = path.resolve(__dirname, "..");
const OUT = path.join(__dirname, "out");
const THREE_MIN = require.resolve("three/build/three.min.js", { paths: [__dirname] });
const GLTF = require.resolve("three/examples/js/loaders/GLTFLoader.js", { paths: [__dirname] });

const TYPES = { ".html": "text/html", ".js": "text/javascript", ".json": "application/json", ".glb": "model/gltf-binary",
  ".gltf": "model/gltf+json", ".bin": "application/octet-stream", ".png": "image/png", ".jpg": "image/jpeg", ".css": "text/css" };

function serve() {
  return new Promise(resolve => {
    const srv = http.createServer((req, res) => {
      const u = decodeURIComponent(req.url.split("?")[0]);
      let f = path.join(ROOT, u === "/" ? "index.html" : u);
      if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { "Content-Type": TYPES[path.extname(f)] || "application/octet-stream" });
      fs.createReadStream(f).pipe(res);
    });
    srv.listen(0, "127.0.0.1", () => resolve(srv));
  });
}

async function open(opts) {
  opts = opts || {};
  fs.mkdirSync(OUT, { recursive: true });
  const srv = await serve();
  const port = srv.address().port;
  const browser = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
  const ctxOpts = Object.assign({ viewport: opts.viewport || { width: 1280, height: 720 }, deviceScaleFactor: 1 }, opts.context || {});
  const context = await browser.newContext(ctxOpts);
  await context.route(/three(\.min)?\.js$|three@0\.128\.0\/build\/three/, r => r.fulfill({ path: THREE_MIN, contentType: "text/javascript" }));
  await context.route(/GLTFLoader\.js$/, r => r.fulfill({ path: GLTF, contentType: "text/javascript" }));
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", e => errors.push(e.message));
  page.on("console", m => { if (m.type() === "error") errors.push(m.text()); });
  const t0 = Date.now();
  await page.goto("http://127.0.0.1:" + port + "/" + (opts.query || ""), { waitUntil: "load" });
  const loadMs = Date.now() - t0;
  if (opts.play !== false) {
    await page.click("#playBtn");
    await page.waitForFunction(() => window.__dbg && window.__dbg.state === "PLAYING", null, { timeout: 15000 });
    try { await page.waitForFunction(() => window.__dbg.ready, null, { timeout: 20000 }); } catch (e) { errors.push("hero GLB did not report ready"); }
    await page.evaluate(() => { window.__dbg.pause = true; });   // scripts drive time with step()
  }
  return {
    browser, context, page, errors, loadMs,
    async shot(name) { const f = path.join(OUT, name + ".png"); await page.screenshot({ path: f }); return f; },
    async close() { await browser.close(); srv.close(); }
  };
}

// small assertion log shared by the scripts
function checker(title) {
  const rows = [];
  return {
    ok(name, cond, detail) { rows.push({ name, pass: !!cond, detail: detail === undefined ? "" : detail }); },
    report() {
      console.log("\n== " + title + " ==");
      for (const r of rows) console.log((r.pass ? "PASS " : "FAIL ") + r.name + (r.detail !== "" ? "  (" + (typeof r.detail === "string" ? r.detail : JSON.stringify(r.detail)) + ")" : ""));
      const failed = rows.filter(r => !r.pass).length;
      console.log(failed ? failed + " failed" : "all passed");
      return failed;
    }
  };
}

module.exports = { open, checker, OUT, ROOT };
