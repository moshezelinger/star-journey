"use strict";
// Install a character model downloaded from Sketchfab (glTF archive).
//   node tools/add-model.js <id> <downloaded.zip>
// <id> is a key of the registry in js/models.js (luigi, dk, goomba, paratroopa, buzzy, ukiki, bowserjr).
// Unpacks into assets/<id>/, keeps (or writes) license.txt, adds the credit to README.md and sets
// `ready: true` for that id in js/models.js. Then run the checks and look at the model in game:
// if it faces the wrong way, change its `yaw` in js/models.js.
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..");
const [id, zip] = process.argv.slice(2);
if (!id || !zip) { console.log("usage: node tools/add-model.js <id> <downloaded.zip>"); process.exit(1); }

const modelsJs = path.join(ROOT, "js", "models.js");
let src = fs.readFileSync(modelsJs, "utf8");
// read the registry entry without running the browser code
const block = new RegExp("\\n    " + id + ": \\{([\\s\\S]*?)\\n    \\}").exec(src);
if (!block) { console.error("unknown id " + id + ". Known: " + (src.match(/\n    (\w+): \{/g) || []).map(s => s.trim().slice(0, -3)).join(", ")); process.exit(1); }
const field = (k) => { const m = new RegExp(k + ': "([^"]*)"').exec(block[1]); return m ? m[1] : ""; };
const spec = { title: field("title"), author: field("author"), authorUrl: field("authorUrl"), url: field("url"), license: field("license") };

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "model-"));
let r = spawnSync("unzip", ["-q", "-o", path.resolve(zip), "-d", tmp], { stdio: "inherit" });
if (r.error || r.status !== 0) r = spawnSync("tar", ["-xf", path.resolve(zip), "-C", tmp], { stdio: "inherit" });   // Windows 10+ tar reads zip
if (r.error || r.status !== 0) { console.error("could not unpack " + zip); process.exit(1); }

// find the folder that holds scene.gltf (or a .glb)
function find(dir) {
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    if (fs.statSync(p).isDirectory()) { const x = find(p); if (x) return x; }
    else if (f === "scene.gltf" || f.endsWith(".glb")) return { dir, file: f };
  }
  return null;
}
const hit = find(tmp);
if (!hit) { console.error("no scene.gltf or .glb in the archive. Download the glTF format from the model page."); process.exit(1); }

const dest = path.join(ROOT, "assets", id);
fs.rmSync(dest, { recursive: true, force: true });
fs.cpSync(hit.dir, dest, { recursive: true });
if (hit.file !== "scene.gltf") src = src.replace(block[0], block[0].replace(/ready: (true|false)/, 'file: "' + hit.file + '", ready: $1'));
if (!fs.existsSync(path.join(dest, "license.txt"))) {
  fs.writeFileSync(path.join(dest, "license.txt"),
    "Model Information:\n* title:\t" + spec.title + "\n* source:\t" + spec.url + "\n* author:\t" + spec.author + " (" + spec.authorUrl + ")\n\n" +
    "Model License:\n* license type:\tCC-BY-4.0 (http://creativecommons.org/licenses/by/4.0/)\n* requirements:\tAuthor must be credited. Commercial use is allowed.\n");
}

// size check against docs/performance-rules.md (3MB per character)
let bytes = 0;
(function walk(d) { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); const s = fs.statSync(p); if (s.isDirectory()) walk(p); else bytes += s.size; } })(dest);
console.log(id + ": " + (bytes / 1048576).toFixed(2) + " MB" + (bytes > 3 * 1048576 ? "  OVER the 3MB budget: shrink the textures" : ""));

// ready: true
const entry = new RegExp("(\\n    " + id + ": \\{[\\s\\S]*?)ready: false");
src = src.replace(entry, "$1ready: true");
fs.writeFileSync(modelsJs, src);

// credit in README.md
const readme = path.join(ROOT, "README.md");
let rd = fs.readFileSync(readme, "utf8");
const credit = "- " + spec.title.replace(/\(.*\)/, "").trim() + " model: \"" + spec.title + "\" by " + spec.author + ", CC-BY-4.0, [source](" + spec.url + ").";
if (!rd.includes(spec.url)) {
  rd = rd.replace(/(- Bowser model:[^\n]*\n)/, "$1" + credit + "\n");
  fs.writeFileSync(readme, rd);
}
fs.rmSync(tmp, { recursive: true, force: true });
console.log("installed into assets/" + id + "/, credited in README.md, enabled in js/models.js");
