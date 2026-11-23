"use strict";
// Close-up frames of every character, with their cost (draw calls and triangles).
//   node tools/char-frames.js [label]   -> tools/out/char-<label>-*.png, docs/frames/characters-<label>.jpg
// For each character: the hero stands a few units in front of it on its star, the follow
// camera gives the frame's draw calls and triangles (the number the budget in
// docs/performance-rules.md counts), then a fixed camera looks at the character from the front.
// The character's own cost is counted from its visible meshes.
// Add ?models=code (second argument "code") to see the characters built in code even where a
// GLB is installed.
const path = require("path");
const H = require("./harness");

const label = process.argv[2] || "now";
const query = process.argv.includes("code") ? "?models=code" : "";

// star index, level, key in debug.models(), where the hero stands, camera distance and height
const SPOTS = [
  { star: 0, lv: "WindGardens", key: "goomba", at: [28, 5, 0.3], dist: 3.6, hgt: 1.0 },
  { star: 0, lv: "WindGardens", key: "koopa", at: [44, -5, 0.3], dist: 4.2, hgt: 1.2, setup: "koopaLow" },
  { star: 0, lv: "WindGardens", key: "luigi", at: [131.5, 3, 21.6], dist: 4.2, hgt: 1.6 },
  { star: 1, lv: "BasaltMines", key: "beetle", at: [39, 0, 0.3], dist: 4.5, hgt: 1.0 },
  { star: 1, lv: "BasaltMines", key: "monkey", at: [76, 0, 9.3], dist: 3.0, hgt: 1.0 },
  { star: 1, lv: "BasaltMines", key: "luigi", at: [108, -3, 9.3], dist: 3.6, hgt: 1.3 },
  { star: 1, lv: "BasaltMines", key: "dk", at: [125, 0, 9.3], dist: 7, hgt: 2.2 },
  { star: 1, lv: "BasaltMines", key: "jr", at: [161, 2, 0.3], dist: 3.6, hgt: 1.2, force: true },
  { star: 2, lv: "InkSwamp", key: "luigiFoot", at: [12, 0, 0.3], dist: 3.6, hgt: 1.2, avatar: true },
  { star: 2, lv: "InkSwamp", key: "yoshiNpc", at: [3, -2, 0.3], dist: 4.4, hgt: 1.3 },
  { star: 2, lv: "InkSwamp", key: "yoshi", at: [30, 0, 0.3], dist: 4.6, hgt: 1.4, setup: "mount", avatar: true },
  { star: 2, lv: "InkSwamp", key: "squid", at: [47, 3, 0.3], dist: 4.4, hgt: 1.4 },
  { star: 2, lv: "InkSwamp", key: "piranha", at: [66, -2, 0.3], dist: 4.6, hgt: 1.6 },
  { star: 2, lv: "InkSwamp", key: "toad", at: [96, 0, 0.3], dist: 3.0, hgt: 0.8, force: true },
  { star: 2, lv: "InkSwamp", key: "mario", at: [-3, 2, 0.3], dist: 3.2, hgt: 1.0 }
];

(async () => {
  let sharp = null;
  try { sharp = require("sharp"); } catch (e) { /* optional */ }
  const h = await H.open({ query, viewport: { width: 640, height: 480 } });
  const rows = [], files = [];
  for (const sp of SPOTS) {
    const r = await h.page.evaluate((sp) => {
      const d = window.__dbg, L = d[sp.lv];
      d.goTo(sp.star); L.reset();
      if (sp.setup === "mount") L.debug.mount();
      if (sp.lv === "InkSwamp" && sp.key !== "mario") L.debug.skipIntro();
      d.place(sp.at[0], sp.at[1], sp.at[2]); d.step(90);
      if (sp.setup === "koopaLow") { const e = L.debug.enemies.koopa; e.state = "grounded"; e.t = 0; e.h = 0.2; d.step(2); }
      updateAvatar();
      const obj = L.debug.models()[sp.key];
      if (!obj) return { missing: true };
      const V = THREE.Vector3;
      const was = { visible: obj.visible, pos: obj.position.clone(), q: obj.quaternion.clone() };
      if (sp.force) {          // hidden until its scene: stand it on open ground in front of the hero, facing him
        obj.visible = true;
        const up0 = d.P.pos.clone().sub(d.active.center).normalize();
        const at = d.P.pos.clone().addScaledVector(d.P.face, 2.5);
        obj.position.copy(obj.parent.worldToLocal(at.clone()));
        const f = d.P.face.clone().negate(), r = new V().crossVectors(up0, f).normalize();
        const m = new THREE.Matrix4().makeBasis(r, up0, f);
        const pq = obj.parent.getWorldQuaternion(new THREE.Quaternion()).invert();
        obj.quaternion.setFromRotationMatrix(m).premultiply(pq);
        obj.updateMatrixWorld(true);
      }
      // the frame as the player sees it (follow camera): the budget counts this one
      renderer.render(scene, camera);
      const frame = { calls: renderer.info.render.calls, tris: renderer.info.render.triangles };
      // the character's own cost
      let calls = 0, tris = 0;
      const vis = (o) => { for (let p = o; p && p !== obj.parent; p = p.parent) if (!p.visible) return false; return true; };
      obj.traverse(o => {
        if (!o.isMesh || !vis(o)) return;
        calls++;
        const g = o.geometry, n = g.index ? g.index.count : g.attributes.position.count;
        tris += (o.isInstancedMesh ? o.count : 1) * n / 3;
      });
      // a fixed camera in front of the character
      const wp = obj.getWorldPosition(new V());
      const up = wp.clone().sub(d.active.center).normalize();
      const q = obj.getWorldQuaternion(new THREE.Quaternion());
      const front = new V(0, 0, 1).applyQuaternion(q); front.addScaledVector(up, -front.dot(up)).normalize();
      const side = new V().crossVectors(up, front).normalize();
      const s = obj.getWorldScale(new V()).x || 1;
      camera.up.copy(up);
      camera.position.copy(wp).addScaledVector(front, sp.dist * s).addScaledVector(up, sp.hgt * s * 1.1).addScaledVector(side, sp.dist * s * 0.35);
      camera.lookAt(wp.clone().addScaledVector(up, sp.hgt * s * 0.75));
      if (typeof hint === "function") hint("", 1);
      const heroWasVisible = player.visible;
      if (!sp.avatar) player.visible = false;
      d.__restore = () => { obj.visible = was.visible; obj.position.copy(was.pos); obj.quaternion.copy(was.q); player.visible = heroWasVisible; };
      return { frame, calls, tris: Math.round(tris) };
    }, sp);
    const name = "char-" + label + "-" + sp.star + "-" + sp.key;
    if (!r.missing) {
      await h.page.evaluate(() => new Promise(res => requestAnimationFrame(() => requestAnimationFrame(res))));
      files.push({ f: await h.shot(name), sp });
      await h.page.evaluate(() => window.__dbg.__restore && window.__dbg.__restore());
    }
    rows.push(Object.assign({ star: sp.star + 1, key: sp.key }, r));
  }
  if (h.errors.length) console.log("page errors:", h.errors);
  await h.close();
  console.log("star  character      own calls  own tris   frame calls  frame tris");
  for (const r of rows) {
    if (r.missing) { console.log(String(r.star).padEnd(6) + r.key.padEnd(15) + "missing"); continue; }
    console.log(String(r.star).padEnd(6) + r.key.padEnd(15) + String(r.calls).padStart(9) + String(r.tris).padStart(10) +
      String(r.frame.calls).padStart(14) + String(Math.round(r.frame.tris / 1000) + "k").padStart(12));
  }
  require("fs").writeFileSync(path.join(H.OUT, "char-" + label + ".json"), JSON.stringify(rows, null, 1));
  if (!sharp || !files.length) return;
  const w = 320, hh = 240, cols = 5, rowsN = Math.ceil(files.length / cols);
  const tiles = await Promise.all(files.map(async (t, i) => ({ input: await sharp(t.f).resize(w, hh).toBuffer(), left: (i % cols) * w, top: (i / cols | 0) * hh })));
  const out = path.join(H.ROOT, "docs", "frames", "characters-" + label + ".jpg");
  await sharp({ create: { width: w * cols, height: hh * rowsN, channels: 3, background: "#000" } }).composite(tiles).jpeg({ quality: 84 }).toFile(out);
  console.log("wrote", path.relative(H.ROOT, out));
})();
