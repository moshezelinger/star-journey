"use strict";

/* ============================================================
   Tuning values for Wind Gardens (star 1), in one place.
   Every value here is read live by the game, except the ones marked
   "reload": those shape geometry that is built once at load.

   The debug panel (press ` or add ?tune to the URL) edits these values
   while playing and keeps them in this browser only (localStorage).
   "Reset" there returns to the defaults below. Change the defaults here
   once a value has been agreed in a play session.
   ============================================================ */
const TUNE_DEFAULTS = {
  bridge: {
    gap: 9            // reload. Width of the broken bridge gap in world units (single jump reaches ~8.15)
  },
  mill: {
    stopWindowDeg: 22, // the ladder blade counts as "down" within this many degrees
    bladeSpeed: 0.65,  // blade spin speed in rad/s (one turn takes ~9.7 s)
    brakeSlip: 3.2     // seconds a wrong blade stays stopped before the brake slips
  },
  goomba: {
    sightRange: 16,    // starts its warning when Mario is this close
    warnTime: 0.9,     // seconds of the "!" warning before it charges
    chargeTime: 1.7,   // seconds it runs in a straight line
    chargeSpeed: 9,    // units/s while charging
    recoverTime: 1.1   // seconds it stays dizzy after a charge
  },
  koopa: {
    trackTime: 1.6,    // seconds it follows Mario overhead
    telegraphTime: 0.6, // seconds the shadow stops and flashes before the dive
    diveTime: 0.28,    // seconds from hover height to the ground
    dazedTime: 1.5     // seconds it sits dazed on the ground (the moment to punch it)
  },
  wind: {
    drift: 0.65        // sideways push on Mario per unit of wind strength (half on the ground)
  },
  camera: {
    zoom: 9.15,        // default distance (horizontal 8.5, height 3.4)
    pitch: 0.38,       // default tilt in radians
    zoomMin: 4.5, zoomMax: 16,
    pitchMin: 0.1, pitchMax: 1.15,
    lookAhead: 3.5     // how far ahead the camera looks while Mario is in the air
  },
  day: {
    length: 300,       // seconds for a full day and night (5 minutes)
    startPhase: 0.0,   // fraction of a full cycle to skip at the start (0 = morning)
    morningHold: 0.35, // 0..0.9: how much the cycle lingers in daylight (0 = constant speed)
    nightDarkness: 0.78, // 0..1: how dark the night gets (1 = darkest allowed)
    minAmbient: 0.34   // lowest hemisphere light intensity, keeps the route readable at night
  }
};

const TUNE = (() => {
  const t = JSON.parse(JSON.stringify(TUNE_DEFAULTS));
  try {
    const saved = JSON.parse(localStorage.getItem("sj-tune") || "null");
    if (saved) for (const g in saved) if (t[g]) for (const k in saved[g]) if (typeof t[g][k] === "number" && typeof saved[g][k] === "number") t[g][k] = saved[g][k];
  } catch (e) { /* storage blocked: run on defaults */ }
  Object.defineProperty(t, "save", { value() { try { localStorage.setItem("sj-tune", JSON.stringify(t)); } catch (e) {} } });
  Object.defineProperty(t, "clear", { value() { try { localStorage.removeItem("sj-tune"); } catch (e) {} } });
  return t;
})();

/* Visual effects that can be switched off one by one, to measure what each costs:
   index.html?fx=-canyon,-islands   (a leading minus turns that effect off).
   Names: day, canyon, windmill, markers, islands, stones, path, shadows, sky, merge. */
const FX = (() => {
  const fx = { day: true, canyon: true, windmill: true, markers: true, islands: true, stones: true, path: true, shadows: true, sky: true, merge: true };
  try {
    const m = /[?&]fx=([^&]*)/.exec(location.search);
    if (m) decodeURIComponent(m[1]).split(",").forEach(k => { k = k.trim(); if (k[0] === "-" && k.slice(1) in fx) fx[k.slice(1)] = false; });
  } catch (e) {}
  return fx;
})();

/* Quality tiers (docs/performance-rules.md). One switch for everything that trades frame rate for looks.
   index.html?q=low|medium|high picks a tier and turns off the automatic resolution step-down.
   Without it: touch screens start at medium, everything else at high, and the game lowers its
   render resolution by itself if frames run slow (never in automated tests: navigator.webdriver). */
const QUALITY = (() => {
  const TIERS = {
    high:   { name: "high",   shadowMap: 2048, grass: 1.0,  pixelRatioCap: 2,   minPixelRatio: 0.75 },
    medium: { name: "medium", shadowMap: 1024, grass: 0.6,  pixelRatioCap: 1.5, minPixelRatio: 0.6 },
    low:    { name: "low",    shadowMap: 0,    grass: 0.35, pixelRatioCap: 1,   minPixelRatio: 0.5 }
  };
  let pick = null;
  try { const m = /[?&]q=(low|medium|high)\b/.exec(location.search); if (m) pick = m[1]; } catch (e) {}
  const touch = typeof matchMedia === "function" && matchMedia("(pointer: coarse)").matches;
  const q = Object.assign({}, TIERS[pick || (touch ? "medium" : "high")]);
  q.adaptive = !pick && !(typeof navigator !== "undefined" && navigator.webdriver);
  if (!q.shadowMap) FX.shadows = false;
  return q;
})();
