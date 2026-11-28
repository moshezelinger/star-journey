"use strict";
/* Menu music: "The Lantern Signal" plays on the opening screen, which also holds the star
   picker, and fades out when a game starts. Browsers block sound before the first tap or key,
   so it starts on the first gesture. It follows the Sound switch, pauses when the tab is
   hidden, and fades at both ends of every pass so the loop never clicks.
   A plain <audio> element, not WebAudio: no decoding of a 2.5 MB file up front, and it
   works from any origin. */
const MenuMusic = (function () {
  const SRC = "assets/music/lantern-signal.mp3";
  const LEVEL = 0.5;          // loudness of the song against the effects
  const FADE_IN = 1.6;        // seconds, at the start of each pass
  const FADE_OUT = 2.6;       // seconds, at the end of each pass
  const GATE_RATE = 1.4;      // how fast the song comes in and goes out when the screen changes (per second)

  let el = null;
  let wantPlaying = false;    // the menu is showing
  let gate = 0;               // 0..1 follows wantPlaying
  let soundOn = true;
  let armed = false;
  let isMenu = () => true;
  let lastT = 0;

  function create() {
    if (el) return el;
    el = document.createElement("audio");
    el.src = SRC;
    el.preload = "none";
    el.loop = false;          // looped by hand in update(): fades on both ends
    el.volume = 0;
    el.addEventListener("ended", () => { if (wantPlaying && soundOn) restart(); });
    return el;
  }

  function restart() {
    el.currentTime = 0;
    const p = el.play();
    if (p && p.catch) p.catch(() => {});
  }

  function tryPlay() {
    if (!wantPlaying || !soundOn || document.hidden) return;
    create();
    if (!el.paused) return;
    const p = el.play();
    if (p && p.catch) p.catch(() => { armOnGesture(); });     // blocked until the player does something
  }

  function armOnGesture() {
    if (armed) return;
    armed = true;
    const go = e => {
      // a tap on Play or on a star number starts the game: no song for that
      if (e && e.target && e.target.closest && e.target.closest("#playBtn, #starPick")) return;
      armed = false;
      window.removeEventListener("pointerdown", go, true);
      window.removeEventListener("keydown", go, true);
      if (isMenu()) tryPlay();
    };
    window.addEventListener("pointerdown", go, true);
    window.addEventListener("keydown", go, true);
  }

  document.addEventListener("visibilitychange", () => {
    if (!el) return;
    if (document.hidden) el.pause(); else tryPlay();
  });

  return {
    init(opts) {
      if (opts && opts.isMenu) isMenu = opts.isMenu;
      create();
      wantPlaying = isMenu();
      tryPlay();              // works when the browser already allows sound for this page
      armOnGesture();         // otherwise on the first tap or key
    },
    // the opening screen is showing (true) or a game is on (false)
    setMenu(v) {
      wantPlaying = v;
      if (v) { gate = Math.max(gate, 0.001); tryPlay(); armOnGesture(); }
    },
    setOn(v) {
      soundOn = v;
      if (!el) return;
      if (v) tryPlay(); else el.pause();
    },
    // called every frame; fades run on the wall clock, so a slow frame rate does not stretch them
    update() {
      if (!el) return;
      const now = performance.now();
      const dt = Math.min(0.25, (now - (lastT || now)) / 1000);
      lastT = now;
      const target = wantPlaying && soundOn ? 1 : 0;
      gate += Math.sign(target - gate) * Math.min(Math.abs(target - gate), GATE_RATE * dt);
      let k = gate;
      const dur = el.duration;
      if (isFinite(dur) && dur > FADE_IN + FADE_OUT) {
        const t = el.currentTime;
        k *= Math.min(1, t / FADE_IN, (dur - t) / FADE_OUT);
      }
      el.volume = Math.max(0, Math.min(1, LEVEL * k * k));    // squared: a gentler, more natural fade
      if (gate <= 0 && target === 0 && !el.paused) el.pause();
    },
    get element() { return el; },       // for the QA script
    get playing() { return !!el && !el.paused && el.volume > 0; }
  };
})();
