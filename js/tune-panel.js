"use strict";

/* ============================================================
   Debug panel for tuning Wind Gardens while playing (issues #3, #4, #8).
   Open it with the ` key (left of 1), or add ?tune to the URL, which also
   shows a ⚙ button for touch screens.

   Sliders write straight into TUNE (js/tuning.js), so most changes take effect
   at once. "Save" keeps the values in this browser; "Defaults" clears them.
   The gap width needs a reload, because the bridge is built once at load.
   The panel also shows the time of day with buttons to jump to it, and the
   split times of the current run per route segment (for the child test, #8).
   ============================================================ */
const TunePanel = (() => {
  const META = {
    bridge: { _title: "Bridge", gap: [7, 11, 0.25, "gap width (reload)"] },
    mill: { _title: "Windmill", stopWindowDeg: [8, 45, 1, "stop window ±deg"], bladeSpeed: [0.2, 1.5, 0.05, "blade speed rad/s"], brakeSlip: [1, 6, 0.1, "wrong-blade slip s"] },
    goomba: { _title: "Goomba", sightRange: [6, 24, 1, "sight range"], warnTime: [0.3, 2.5, 0.05, "warning s"], chargeTime: [0.5, 3, 0.1, "charge s"], chargeSpeed: [3, 14, 0.5, "charge speed"], recoverTime: [0.3, 3, 0.1, "dizzy s"] },
    koopa: { _title: "Winged koopa", trackTime: [0.5, 3, 0.1, "follows s"], telegraphTime: [0.2, 1.6, 0.05, "shadow flash s"], diveTime: [0.15, 0.8, 0.01, "dive s"], dazedTime: [0.5, 4, 0.1, "dazed s"] },
    wind: { _title: "Wind", drift: [0, 1.5, 0.05, "drift"] },
    camera: { _title: "Camera", zoom: [4.5, 16, 0.05, "default zoom"], pitch: [0.1, 1.15, 0.01, "default pitch"], lookAhead: [0, 6, 0.1, "air look-ahead"],
      zoomMin: [2, 8, 0.1, "zoom min"], zoomMax: [10, 24, 0.5, "zoom max"], pitchMin: [0.02, 0.4, 0.01, "pitch min"], pitchMax: [0.8, 1.4, 0.01, "pitch max"] },
    day: { _title: "Day and night", length: [30, 900, 10, "full cycle s"], startPhase: [0, 1, 0.01, "start offset (restart)"], morningHold: [0, 0.9, 0.05, "linger in daylight"],
      nightDarkness: [0, 1, 0.05, "night darkness"], minAmbient: [0.1, 0.8, 0.02, "min ambient"] }
  };
  let el = null, gear = null, info = null, splitsEl = null, open = false, gapAtLoad = TUNE.bridge.gap;
  const inputs = [];

  function fmt(v, step) { const d = step >= 1 ? 0 : step >= 0.1 ? 1 : 2; return Number(v).toFixed(d); }

  function build() {
    const css = document.createElement("style");
    css.textContent = `
      #tunePanel { position:fixed; top:8px; right:8px; bottom:8px; width:min(330px, calc(100vw - 16px)); z-index:40;
        background:rgba(12,14,30,.92); color:#e9eeff; font:12px/1.3 system-ui, sans-serif; border-radius:12px;
        padding:10px 12px; overflow-y:auto; display:none; user-select:auto; -webkit-user-select:auto; touch-action:pan-y; }
      #tunePanel.on { display:block; }
      #tunePanel h3 { font-size:13px; margin:10px 0 4px; color:#ffd36a; }
      #tunePanel .row { display:grid; grid-template-columns: 1fr 96px 40px; gap:6px; align-items:center; margin:3px 0; }
      #tunePanel input[type=range] { width:100%; }
      #tunePanel .val { text-align:right; font-variant-numeric:tabular-nums; }
      #tunePanel .changed { color:#8fe3ff; }
      #tunePanel button { background:#2b3160; color:#fff; border:0; border-radius:6px; padding:5px 8px; margin:2px 2px 2px 0; font:inherit; cursor:pointer; }
      #tunePanel .bar { display:flex; flex-wrap:wrap; gap:2px; }
      #tunePanel .note { color:#aab3d6; margin-top:4px; }
      #tuneGear { position:fixed; left:50%; top:max(8px, env(safe-area-inset-top)); transform:translateX(-50%); z-index:39; width:36px; height:36px;
        border-radius:50%; border:0; background:rgba(12,14,30,.7); color:#fff; font-size:18px; display:none; }
    `;
    document.head.appendChild(css);
    el = document.createElement("div"); el.id = "tunePanel";
    const head = document.createElement("div");
    head.innerHTML = `<b>Tuning</b> <span class="note">(\` to close)</span><div class="bar" style="margin-top:6px">
      <button data-a="save">Save</button><button data-a="defaults">Defaults</button><button data-a="copy">Copy values</button><button data-a="close">Close</button></div>`;
    el.appendChild(head);
    const day = document.createElement("div");
    day.innerHTML = `<h3>Time of day</h3><div id="tuneDay" class="note"></div><div class="bar">
      <button data-m="morning">Morning</button><button data-m="noon">Noon</button><button data-m="dusk">Dusk</button><button data-m="night">Night</button></div>`;
    el.appendChild(day);
    for (const g in META) {
      const h = document.createElement("h3"); h.textContent = META[g]._title; el.appendChild(h);
      for (const k in META[g]) {
        if (k === "_title") continue;
        const [min, max, step, label] = META[g][k];
        const row = document.createElement("div"); row.className = "row";
        row.innerHTML = `<span>${label}</span><input type="range" min="${min}" max="${max}" step="${step}"><span class="val"></span>`;
        const inp = row.querySelector("input"), val = row.querySelector(".val"), name = row.querySelector("span");
        const sync = () => { inp.value = TUNE[g][k]; val.textContent = fmt(TUNE[g][k], step); name.classList.toggle("changed", TUNE[g][k] !== TUNE_DEFAULTS[g][k]); };
        inp.addEventListener("input", () => { TUNE[g][k] = parseFloat(inp.value); sync(); });
        inputs.push(sync); sync();
        el.appendChild(row);
      }
    }
    const sp = document.createElement("div");
    sp.innerHTML = `<h3>This run (game time)</h3><div id="tuneSplits" class="note"></div>
      <div class="note">Targets for a first run: 3 + 5 + 5 + 7 minutes (landing to training, training to bridge, bridge to windmill, windmill to rescue).</div>`;
    el.appendChild(sp);
    document.body.appendChild(el);
    info = el.querySelector("#tuneDay"); splitsEl = el.querySelector("#tuneSplits");
    el.addEventListener("click", e => {
      const b = e.target.closest("button"); if (!b) return;
      if (b.dataset.m && window.DayCycle) DayCycle.setMoment(b.dataset.m);
      if (b.dataset.a === "save") { TUNE.save(); if (TUNE.bridge.gap !== gapAtLoad && confirm("The gap width needs a reload. Reload now?")) location.reload(); }
      if (b.dataset.a === "defaults") { TUNE.clear(); for (const g in TUNE_DEFAULTS) Object.assign(TUNE[g], TUNE_DEFAULTS[g]); inputs.forEach(f => f()); }
      if (b.dataset.a === "copy") { const txt = JSON.stringify(TUNE, null, 2); try { navigator.clipboard.writeText(txt); b.textContent = "Copied"; } catch (err) { prompt("Values", txt); } }
      if (b.dataset.a === "close") toggle(false);
    });
    gear = document.createElement("button"); gear.id = "tuneGear"; gear.textContent = "⚙";
    gear.addEventListener("click", e => { e.stopPropagation(); toggle(); });
    gear.addEventListener("touchstart", e => { e.stopPropagation(); }, { passive: true });
    document.body.appendChild(gear);
    if (/[?&]tune\b/.test(location.search)) { gear.style.display = "block"; toggle(true); }
  }

  function toggle(v) {
    open = v === undefined ? !open : v;
    el.classList.toggle("on", open);
    if (open) inputs.forEach(f => f());
  }

  function mmss(t) { const m = Math.floor(t / 60), s = Math.floor(t % 60); return m + ":" + String(s).padStart(2, "0"); }
  let last = 0;
  function update() {
    if (!open || !el) return;
    const now = performance.now(); if (now - last < 250) return; last = now;
    if (window.DayCycle) {
      const st = DayCycle.state;
      info.textContent = `${st.name}, sun ${st.elev.toFixed(0)}°, ${(st.phase * 100).toFixed(0)}% through the day (${mmss(DayCycle.time % TUNE.day.length)} of ${mmss(TUNE.day.length)})`;
    }
    if (window.WindGardens) {
      const sp = WindGardens.debug.splits;
      splitsEl.innerHTML = sp.length ? sp.map(x => `${x.name}: ${mmss(x.t)} (segment ${mmss(x.seg)})`).join("<br>") : "no checkpoint passed yet";
    }
  }

  window.addEventListener("keydown", e => { if (e.code === "Backquote") { if (!el) build(); toggle(); } }, true);
  window.addEventListener("load", () => { if (!el) build(); });
  return { update, toggle, get open() { return open; }, owns: (t) => !!(t && t.closest && (t.closest("#tunePanel") || t.closest("#tuneGear"))) };
})();
