"use strict";

/* ============================================================
   Day and night for Wind Gardens (issue #5).

   How the rotation is done (option A in docs/next-steps-star1.md):
   the planet does not move. The sun direction turns around the planet's
   axis instead, which looks the same from the ground and leaves physics,
   enemies, camera and every world coordinate untouched. The axis is the
   route's "right" (B), so the sun crosses the sky along the route: it rises
   behind Mario at the landing (lighting what the camera sees), stands over
   the route at noon and sets behind the windmill, which then shows as a
   silhouette at dusk.

   One light source: the directional sun. Sky colour, hemisphere (ambient)
   light, the purple rim fill, fog and stars all follow the sun's elevation
   over the middle of the route, interpolated between the key frames below.
   The length, the speed curve and the night darkness live in js/tuning.js.
   Time only advances in updatePlaying, so a paused game pauses the cycle;
   reset() returns to morning.
   ============================================================ */
const DayCycle = (() => {
  const V3 = THREE.Vector3;
  const col = (h) => new THREE.Color(h);
  // key frames by sun elevation (degrees) over the middle of the route
  const KEYS = [
    { e: -34, name: "night",   sky: col(0x0b1230), fog: col(0x0d1433), sun: col(0x000000), sunI: 0,    hs: col(0x8a9ce8), hg: col(0x1c2244), hI: 0.72, rimI: 0.46, stars: 1 },
    { e: -15, name: "dusk",    sky: col(0x30305e), fog: col(0x3c3866), sun: col(0x000000), sunI: 0,    hs: col(0xa49ad8), hg: col(0x2a2040), hI: 0.58, rimI: 0.42, stars: 0.6 },
    { e: -2,  name: "sunset",  sky: col(0xe48c6c), fog: col(0xd8907c), sun: col(0xff8650), sunI: 0.42, hs: col(0xdcb2c8), hg: col(0x3a2a3a), hI: 0.66, rimI: 0.45, stars: 0 },
    { e: 9,   name: "golden",  sky: col(0xeec49a), fog: col(0xf0d2ae), sun: col(0xffc890), sunI: 0.9,  hs: col(0xdadcf0), hg: col(0x2e2540), hI: 0.76, rimI: 0.48, stars: 0 },
    { e: 26,  name: "morning", sky: col(0x9fd0ee), fog: col(0xcde4ee), sun: col(0xffe0b4), sunI: 0.9,  hs: col(0xc0daff), hg: col(0x231b3a), hI: 0.72, rimI: 0.45, stars: 0 },
    { e: 62,  name: "noon",    sky: col(0x86c6ee), fog: col(0xc0e0f2), sun: col(0xfff6e8), sunI: 0.88, hs: col(0xbcd8ff), hg: col(0x2a2440), hI: 0.72, rimI: 0.42, stars: 0 }
  ];
  const START_ELEV = 30;           // morning: warm, bright, readable

  let refs = null, t = 0, C = new V3(0, 1, 0), F = new V3(0, 0, 1), on = false;
  const out = { sky: new THREE.Color(), fog: new THREE.Color(), sun: new THREE.Color(), hs: new THREE.Color(), hg: new THREE.Color(), sunI: 0, hI: 0, rimI: 0, stars: 0, name: "" };
  const sunDir = new V3();
  const state = { elev: START_ELEV, daylight: 1, night: 0, phase: 0, name: "morning" };

  // the speed curve: x is the sun angle from noon on a uniform clock, f(x) the shown angle.
  // f'(x) = 1 - k cos x: slow around noon, fast around midnight. k = TUNE.day.morningHold.
  const warp = (x, k) => x - k * Math.sin(x);
  function startX(k) {                       // uniform-clock angle that shows the start elevation
    const target = -(90 - START_ELEV) * Math.PI / 180;
    let x = target;
    for (let i = 0; i < 20; i++) x -= (warp(x, k) - target) / (1 - k * Math.cos(x));
    return x;
  }

  // A sky dome (issue #5): the zenith takes the key frame's sky colour and the horizon the fog
  // colour, so far terrain melts into the sky instead of stopping at a flat backdrop. A soft
  // glow sits around the sun. It follows the camera and is drawn first, without depth.
  let dome = null;
  function makeDome() {
    const mat = new THREE.ShaderMaterial({
      uniforms: { top: { value: new THREE.Color() }, horizon: { value: new THREE.Color() }, glow: { value: new THREE.Color() },
        up: { value: new V3(0, 1, 0) }, sunDir: { value: new V3(0, 1, 0) }, glowI: { value: 0 } },
      vertexShader: "varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
      fragmentShader: [
        "uniform vec3 top; uniform vec3 horizon; uniform vec3 glow; uniform vec3 up; uniform vec3 sunDir; uniform float glowI;",
        "varying vec3 vDir;",
        "void main(){",
        "  vec3 d = normalize(vDir); float h = dot(d, up);",
        "  vec3 c = mix(horizon, top, smoothstep(-0.02, 0.55, h));",
        "  float sd = max(dot(d, sunDir), 0.0);",
        "  c += glow * glowI * (0.55 * pow(sd, 6.0) + 0.45 * pow(sd, 48.0));",
        "  gl_FragColor = vec4(c, 1.0);",
        "}"].join("\n"),
      side: THREE.BackSide, depthWrite: false, depthTest: false, fog: false
    });
    dome = new THREE.Mesh(new THREE.SphereGeometry(2000, 32, 16), mat);
    dome.frustumCulled = false; dome.renderOrder = -10;
    dome.visible = false;
    refs.scene.add(dome);
  }

  // Sun shadows (issue #5): a shadow map that follows the hero, so trees, the bridge, the mill
  // and the hero himself shade the ground. Off on other planets and with ?fx=-shadows.
  const touch = typeof matchMedia === "function" && matchMedia("(pointer: coarse)").matches;
  function setupShadows() {
    const { sun, renderer } = refs;
    if (!renderer) return;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    sun.shadow.mapSize.set(touch ? 1024 : 2048, touch ? 1024 : 2048);
    const sc = sun.shadow.camera;
    sc.left = -38; sc.right = 38; sc.top = 38; sc.bottom = -38; sc.near = 1; sc.far = 320;
    sc.updateProjectionMatrix();
    sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.04;
    refs.scene.add(sun.target);
  }

  // refs: { scene, renderer, sun, hemi, rim, stars, sunDisc }
  function attach(r) { refs = r; if (FX.sky) makeDome(); if (FX.shadows) setupShadows(); }
  // up: unit direction of the middle of the route; forward: the route's +s direction there
  function configure(up, forward) { C.copy(up).normalize(); F.copy(forward).projectOnPlane(C).normalize(); }
  function reset() { t = 0; }
  function update(dt) { t += dt; }
  function setEnabled(v) { on = v && FX.day; }

  function lerpKey(e) {
    let a = KEYS[0], b = KEYS[0], k = 0;
    if (e <= KEYS[0].e) { a = b = KEYS[0]; }
    else if (e >= KEYS[KEYS.length - 1].e) { a = b = KEYS[KEYS.length - 1]; }
    else for (let i = 0; i < KEYS.length - 1; i++) if (e < KEYS[i + 1].e) { a = KEYS[i]; b = KEYS[i + 1]; k = (e - a.e) / (b.e - a.e); break; }
    k = k * k * (3 - 2 * k);
    for (const key of ["sky", "fog", "sun", "hs", "hg"]) out[key].copy(a[key]).lerp(b[key], k);
    for (const key of ["sunI", "hI", "rimI", "stars"]) out[key] = a[key] + (b[key] - a[key]) * k;
    out.name = k < 0.5 ? a.name : b.name;
    return out;
  }

  // Sun angle from noon in radians, for the current time.
  function sunAngle() {
    const k = Math.min(0.9, Math.max(0, TUNE.day.morningHold));
    const p = t / Math.max(10, TUNE.day.length) + TUNE.day.startPhase;
    let x = startX(k) + p * Math.PI * 2;
    x = Math.atan2(Math.sin(x), Math.cos(x));       // keep in (-pi, pi]
    return warp(x, k);
  }

  const _up = new V3(), _glow = new THREE.Color();
  // focus: the point the shadow map centres on (the hero); center: the planet centre
  function apply(camera, focus, center) {
    if (!refs) return;
    const { scene, sun, hemi, rim, stars, sunDisc } = refs;
    if (FX.shadows && sun.castShadow !== on) sun.castShadow = on;
    if (dome) dome.visible = on;
    if (!on) {
      sun.target.position.set(0, 0, 0);                                       // other planets and the menu: the old night sky
      scene.background.setHex(0x05060f);
      scene.fog.near = 1e6; scene.fog.far = 1e6 + 1;
      sun.color.setHex(0xfff1d0); sun.intensity = 1.05; sun.position.set(60, 90, 40);
      hemi.color.setHex(0xbcd8ff); hemi.groundColor.setHex(0x231b3a); hemi.intensity = 0.85; hemi.position.set(0, 1, 0);
      rim.intensity = 0.5;
      stars.visible = true; stars.material.opacity = 0.9;
      sunDisc.visible = false;
      state.elev = 90; state.daylight = 1; state.night = 0; state.name = "space";
      if (window.GameShared) GameShared.sky = state;
      return;
    }
    const beta = sunAngle();
    sunDir.copy(C).multiplyScalar(Math.cos(beta)).addScaledVector(F, Math.sin(beta)).normalize();
    const elev = 90 - Math.abs(beta) * 180 / Math.PI;
    const k = lerpKey(elev);
    // night darkness: 0 keeps dusk-like light, 1 the darkest allowed night
    const nd = Math.min(1, Math.max(0, TUNE.day.nightDarkness));
    const nightK = Math.min(1, Math.max(0, (-elev - 2) / 32));
    const dark = nightK * nd;
    scene.background.copy(k.sky).lerp(KEYS[1].sky, nightK * (1 - nd));
    scene.fog.color.copy(k.fog).lerp(KEYS[1].fog, nightK * (1 - nd));
    // haze: far in daylight, closer at night so the far planet side fades into the dark
    scene.fog.near = 70 - 30 * dark; scene.fog.far = 520 - 260 * dark;
    sun.color.copy(k.sun); sun.intensity = k.sunI;
    if (focus) {               // same direction as before; centred on the hero for the shadow map
      sun.target.position.copy(focus);
      sun.position.copy(focus).addScaledVector(sunDir, 150);
    } else { sun.target.position.set(0, 0, 0); sun.position.copy(sunDir).multiplyScalar(500); }
    hemi.color.copy(k.hs); hemi.groundColor.copy(k.hg);
    hemi.intensity = Math.max(TUNE.day.minAmbient, k.hI - 0.3 * dark);
    hemi.position.copy(C);
    rim.intensity = k.rimI;
    stars.material.opacity = 0.9 * k.stars;
    stars.visible = k.stars > 0.01;
    if (dome) {
      const u = dome.material.uniforms;
      dome.position.copy(camera.position);
      u.top.value.copy(scene.background);
      u.horizon.value.copy(scene.fog.color);
      if (center) _up.copy(camera.position).sub(center).normalize(); else _up.copy(C);
      u.up.value.copy(_up);
      u.sunDir.value.copy(sunDir);
      _glow.copy(k.sun).lerp(new THREE.Color(0xffffff), 0.25);
      u.glow.value.copy(_glow);
      u.glowI.value = 0.55 * Math.max(0, Math.min(1, (elev + 8) / 10)) * (1 - 0.6 * Math.max(0, Math.min(1, (elev - 15) / 40)));
    }
    // a visible sun disc, following the camera like the starfield
    sunDisc.visible = elev > -6;
    if (sunDisc.visible) {
      sunDisc.position.copy(camera.position).addScaledVector(sunDir, 2600);
      sunDisc.material.color.copy(k.sun).lerp(new THREE.Color(0xffffff), Math.max(0, Math.min(1, elev / 40)));
      const s = 1 + 0.6 * Math.max(0, 1 - Math.abs(elev) / 12);   // a touch larger near the horizon
      sunDisc.scale.setScalar(s);
    }
    state.elev = elev;
    state.daylight = Math.min(1, Math.max(0, (elev + 6) / 20));
    state.night = nightK;
    state.phase = (t / Math.max(10, TUNE.day.length) + TUNE.day.startPhase) % 1;
    state.name = k.name;
    if (window.GameShared) GameShared.sky = state;
  }

  // For QA and the debug panel: jump to a moment by its sun angle from noon (degrees).
  // morning -60, noon 0, dusk 92 (the sun on the horizon), twilight 100, midnight 180.
  const MOMENTS = { morning: -60, noon: 0, dusk: 92, twilight: 100, night: 180 };
  function setMoment(name) {
    const target = (typeof name === "number" ? name : MOMENTS[name]) * Math.PI / 180;
    const len = Math.max(10, TUNE.day.length);
    let best = 0, bestErr = 1e9;
    for (let i = 0; i < 3000; i++) {
      t = i / 3000 * len;
      const d = Math.atan2(Math.sin(sunAngle() - target), Math.cos(sunAngle() - target));
      if (Math.abs(d) < bestErr) { bestErr = Math.abs(d); best = t; }
    }
    t = best;
  }

  return {
    attach, configure, reset, update, apply, setEnabled, setMoment, state,
    get time() { return t; }, set time(v) { t = v; }, get sunDir() { return sunDir; }
  };
})();
