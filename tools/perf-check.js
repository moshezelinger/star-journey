"use strict";
// Frame cost of each visual effect, measured by switching it off (index.html?fx=-name).
//   node tools/perf-check.js
// Headless SwiftShader renders on the CPU, so the absolute numbers say nothing about a real
// GPU or a phone. Only the differences between rows are meaningful, and only roughly.
const H = require("./harness");

const CONFIGS = ["", "-day", "-canyon", "-windmill", "-markers", "-islands", "-stones", "-day,-canyon,-windmill,-markers,-islands,-stones"];
const VIEWS = [["landing", 0, 0, 0.3], ["bridge-top", 92, 0, 0.8], ["brake-lever", 120.8, -9, 0.3]];
const FRAMES = 40;

(async () => {
  const rows = [];
  for (const fx of CONFIGS) {
    const h = await H.open({ query: fx ? "?fx=" + fx : "" });
    const row = { fx: fx || "(all on)", load: h.loadMs };
    for (const [name, s, l, ht] of VIEWS) {
      row[name] = await h.page.evaluate(([s, l, ht, n]) => {
        const d = window.__dbg; d.place(s, l, ht); d.step(60);
        const gl = renderer.getContext();
        for (let i = 0; i < 5; i++) renderer.render(scene, camera);
        gl.finish();
        const times = [];
        for (let i = 0; i < n; i++) {
          const t0 = performance.now();
          d.step(1); DayCycle.apply(camera); renderer.render(scene, camera); gl.finish();
          times.push(performance.now() - t0);
        }
        times.sort((a, b) => a - b);
        return { median: times[n >> 1], calls: renderer.info.render.calls, tris: renderer.info.render.triangles };
      }, [s, l, ht, FRAMES]);
    }
    rows.push(row);
    await h.close();
  }
  const base = rows[0];
  console.log("fx".padEnd(52) + VIEWS.map(v => v[0].padStart(24)).join(""));
  for (const r of rows) {
    console.log(r.fx.padEnd(52) + VIEWS.map(v => {
      const x = r[v[0]], d = x.median - base[v[0]].median;
      return (x.median.toFixed(1) + "ms " + (r === base ? "" : (d >= 0 ? "+" : "") + d.toFixed(1)) + " " + (x.tris / 1000).toFixed(0) + "k").padStart(24);
    }).join(""));
  }
  console.log("\nload (page load event, local server):", rows.map(r => r.fx + " " + r.load + "ms").join(", "));
})();
