"use strict";
/* Recorded music: the Suno songs of the game, one at a time.
   index.html says every frame which song the screen wants (want(name, scale)):
     the opening screen and the star picker   "lantern"   The Lantern Signal
     star 1, Wind Gardens                      "lantern"   the same song, carried on from the menu, softer
     star 2, Basalt Mines                      "knock"     The Three-Knock Trail
     star 3, Ink Swamp                         "mushroom"  Glowing Mushroom
     star 4, Furnace Moon, until Bowser lands  "volcanic"  The Volcanic Path
     star 4, from his landing until he falls   "fight"     The Volcano's Call
   Anything else (the flight, the victory screen, star 4 after the fight) wants none, and the
   generated arpeggio in index.html plays instead (synthQuiet tells it when to wait).

   One <audio> element for all the songs: a change of song fades the old one out, swaps the
   file and fades the new one in. One element also means one unlock: browsers block sound
   until the first tap or key, and iOS wants each element started inside a gesture, so every
   gesture (any tap, including the tap on Play or on a star number) starts the wanted song
   right there. A plain <audio> element, not WebAudio: no decoding of 3 MB files up front, and
   it works from any origin. It follows the Sound switch, pauses when the tab is hidden, rewinds
   when its screen is left (each visit starts from the top) and fades at both ends of every pass,
   so the loop never clicks. A file that fails to load gives the stage back to the arpeggio. */
const Music = (function () {
  const DIR = "assets/music/";
  // vol: loudness against the game sounds. inRate/outRate: how fast the song comes and goes when
  // the screen changes (per second). edgeIn: fade at the start of each pass (seconds).
  // next: a song to fetch ahead of time while this one plays.
  const TRACKS = {
    lantern:  { src: "lantern-signal.mp3",     vol: 0.5,  title: "The Lantern Signal" },
    knock:    { src: "three-knock-trail.mp3",  vol: 0.42, title: "The Three-Knock Trail", inRate: 3, edgeIn: 0.3 },   // the three knocks come in clearly at the landing
    mushroom: { src: "glowing-mushroom.mp3",   vol: 0.5,  title: "Glowing Mushroom" },
    volcanic: { src: "the-volcanic-path.mp3",  vol: 0.55, title: "The Volcanic Path", next: "fight" },
    fight:    { src: "volcanos-call.mp3",      vol: 0.42, title: "The Volcano's Call", outRate: 0.35 }                 // fades over 3 s when Bowser falls
  };
  const IN_RATE = 1.4, OUT_RATE = 1.2;   // per second, when the track has no rate of its own
  const EDGE_IN = 1.6, EDGE_OUT = 2.6;   // seconds, at the start and the end of each pass
  const LEVEL_RATE = 0.4;                // how fast the loudness slides when the same song changes level (menu to star 1)

  let el = null;
  let cur = null;           // the song loaded in the element
  let want = null;          // the song the screen wants
  let wantScale = 1;
  let level = 0.5;          // the loudness now (slides toward vol * scale)
  let gate = 0;             // 0..1: the screen-change fade
  let soundOn = true;
  let blocked = false;      // the browser refused to play: wait for a gesture
  let lastT = 0;
  const preloaded = {};

  function create() {
    if (el) return el;
    el = document.createElement("audio");
    el.preload = "auto";
    el.loop = false;          // looped by hand in update(): fades on both ends
    el.volume = 0;
    el.addEventListener("ended", () => { if (cur && cur === want && soundOn) { el.currentTime = 0; tryPlay(); } });
    el.addEventListener("error", () => { if (cur && TRACKS[cur]) TRACKS[cur].failed = true; });
    return el;
  }

  function usable(name) { return !!(name && TRACKS[name] && !TRACKS[name].failed); }

  function load(name) {
    create();
    cur = name;
    gate = 0;
    el.src = DIR + TRACKS[name].src;
    level = TRACKS[name].vol * wantScale;
  }

  function tryPlay() {
    if (!el || !cur || cur !== want || !soundOn || document.hidden || !el.paused) return;
    const p = el.play();
    if (p && p.catch) p.catch(e => { if (e && e.name === "NotAllowedError") blocked = true; });
  }

  // any gesture: start the wanted song inside it (the browser allows sound from here on)
  function onGesture() {
    blocked = false;
    if (usable(want)) {
      if (cur !== want && (!el || el.paused || gate <= 0)) load(want);
      tryPlay();
    }
  }
  ["pointerdown", "pointerup", "touchend", "keydown", "click"].forEach(t => window.addEventListener(t, onGesture, true));

  document.addEventListener("visibilitychange", () => {
    if (!el) return;
    if (document.hidden) el.pause(); else tryPlay();
  });

  function preload(name) {
    if (!usable(name) || preloaded[name] || name === cur) return;
    const a = document.createElement("audio");     // fills the browser cache; never played
    a.preload = "auto"; a.src = DIR + TRACKS[name].src;
    preloaded[name] = a;
  }

  return {
    TRACKS,
    // called every frame: which song the screen wants (a TRACKS name or null) and how loud against its own level
    want(name, scale) {
      want = usable(name) ? name : null;
      wantScale = scale === undefined ? 1 : scale;
      if (want && TRACKS[want].next) preload(TRACKS[want].next);
    },
    preload,
    setOn(v) {
      soundOn = v;
      if (!el) return;
      if (v) tryPlay(); else el.pause();
    },
    // called every frame; fades run on the wall clock, so a slow frame rate does not stretch them
    update() {
      const now = performance.now();
      const dt = Math.min(0.25, (now - (lastT || now)) / 1000);
      lastT = now;
      if (want && cur !== want && (!el || el.paused || gate <= 0)) load(want);    // nothing to fade out first
      if (!el || !cur) return;
      const T = TRACKS[cur];
      const goal = T.vol * wantScale;
      level += Math.sign(goal - level) * Math.min(Math.abs(goal - level), LEVEL_RATE * dt);
      const target = cur === want && soundOn ? 1 : 0;
      const rate = target > gate ? (T.inRate || IN_RATE) : (T.outRate || OUT_RATE);
      gate += Math.sign(target - gate) * Math.min(Math.abs(target - gate), rate * dt);
      if (target && el.paused && !blocked) tryPlay();
      let k = gate;
      const dur = el.duration, edgeIn = T.edgeIn || EDGE_IN;
      if (isFinite(dur) && dur > edgeIn + EDGE_OUT) {
        const t = el.currentTime;
        k *= Math.min(1, t / edgeIn, (dur - t) / EDGE_OUT);
      }
      el.volume = Math.max(0, Math.min(1, level * k * k));    // squared: a gentler, more natural fade
      if (gate <= 0 && cur !== want) {                        // faded out: rewind, and swap to the next song if there is one
        if (!el.paused) el.pause();
        if (el.currentTime > 0) { try { el.currentTime = 0; } catch (e) {} }
        if (want) { load(want); tryPlay(); }
      } else if (gate <= 0 && !soundOn && !el.paused) el.pause();
    },
    // the arpeggio waits while a song is wanted (and its file has not failed)
    get synthQuiet() { return !!want; },
    get current() { return cur; },
    get wanted() { return want; },
    get element() { return el; },       // for the QA script
    get blocked() { return blocked; },
    get playing() { return !!el && !el.paused && el.volume > 0; }
  };
})();
