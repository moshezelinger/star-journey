"use strict";

/* ============================================================
   Wind Gardens - star 1 of Little Star Journey (issues #3-#6).
   Route (arc length `s` along a great circle from the landing, `l` = lateral,
   positive to Mario's right):
     s -15..20   landing meadow, Luigi's lantern beam visible on the horizon
     s  22       punch crate        s  34  goomba (alone, flat ground)
     s  40..46   double-jump pedestal
     s  50       winged koopa (alone, open meadow)
     s  57..66   training trench with a rescue net (3 units deep, walkable out)
     s  66..78   wind path with cloth flags
     s  76..123  bridge over a canyon ring; 9-unit gap (needs the double jump)
     s 124       brake lever        s 129.5 windmill blades   s 139.5 tower
   Everything is built from primitives. Mario/Luigi GLBs are owned by #6.
   Load order: Three.js, GameShared, this file, then the inline game script.
   ============================================================ */
const WindGardens = (() => {
  const V3 = THREE.Vector3;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const smooth = (a, b, x) => { const k = clamp((x - a) / (b - a), 0, 1); return k * k * (3 - 2 * k); };
  const band = (s, a, b, w) => smooth(a, a + w, s) * (1 - smooth(b - w, b, s));

  // ---- layout (all arc lengths in world units) ----
  const LAYOUT = {
    trench: { a: 57, b: 66, depth: 3, ramp: 3.2 },
    canyon: { a: 80, b: 118, depth: 26, ramp: 4 },
    // the gap is centred on s 100; its width comes from TUNE.bridge.gap (default 9)
    bridgeA: [76, 100 - TUNE.bridge.gap / 2], bridgeB: [100 + TUNE.bridge.gap / 2, 123], bridgeHalf: 2.8, plankTop: 0.35,
    pedestal: { s0: 40, s1: 46, half: 3.5, top: 3.4 },
    crate: { s: 22, l: 0 },
    goomba: { s: 34, l: 7 }, koopa: { s: 50, l: -7 },
    lever: { s: 124, l: -9 },
    mill: { hubS: 129.5, hubH: 22, bladeLen: 20, towerS: 139.5, towerR: 6, towerH: 26 },
    balcony: { s0: 131.2, s1: 135, l0: 2, l1: 10, top: 21.5 },
    cart: { s: 150, l: -12 }, gate: { s: 152, l: 0 },
    voidBelow: -5, fallRespawn: -13, windS0: 60, windS1: 125,   // wind drift strength: TUNE.wind.drift
    // named checkpoints for death and retry; position + facing come from level data
    checkpoints: [
      { name: "landing", s: 0, l: 0 },
      { name: "training", s: 54, l: 0 },
      { name: "bridge", s: 74, l: 0 },
      { name: "windmill", s: 125, l: -3 }
    ]
  };

  // ---- sphere frame, set once from the planet definition ----
  let R = 220, center = new V3(), N = new V3(0, 1, 0), T = new V3(0, 0, 1), B = new V3(1, 0, 0);
  function configure(def) {
    R = def.radius; center = def.center.clone();
    N = def.spawnDir.clone().normalize();
    T = GameShared.projectTangent(new V3(0, 0, 1), N);   // same heading the camera starts with
    B = new V3().crossVectors(T, N).normalize();         // Mario's right
  }
  function dirAt(s, l, out) {
    const a = s / R, c = l / R, ca = Math.cos(c);
    return (out || new V3()).set(0, 0, 0)
      .addScaledVector(N, Math.cos(a) * ca).addScaledVector(T, Math.sin(a) * ca).addScaledVector(B, Math.sin(c));
  }
  function coordsOf(dir) { // dir must be unit
    return { s: Math.atan2(dir.dot(T), dir.dot(N)) * R, l: Math.asin(clamp(dir.dot(B), -1, 1)) * R };
  }
  function localPos(s, l, h) { return dirAt(s, l).multiplyScalar(R + (h || 0)); }           // relative to planet center
  function worldPos(s, l, h) { return localPos(s, l, h).add(center); }
  function frameAt(dir) { // right, up, forward(s+) at a surface direction
    const f = GameShared.projectTangent(T, dir);
    const r = new V3().crossVectors(f, dir).normalize();
    return { r, u: dir, f };
  }
  function put(obj, s, l, h) { // local +X right, +Y up, +Z back toward the player
    const dir = dirAt(s, l), fr = frameAt(dir);
    obj.position.copy(dir).multiplyScalar(R + (h || 0));
    obj.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(fr.r, fr.u, fr.f.clone().negate()));
    return obj;
  }

  // ---- terrain: one function drives the mesh deformation and the physics ----
  function terrainH(s, l) {
    const tr = LAYOUT.trench, cn = LAYOUT.canyon;
    return -tr.depth * band(s, tr.a, tr.b, tr.ramp) - cn.depth * band(s, cn.a, cn.b, cn.ramp);
  }

  // solid boxes: Mario stands on a top within step height, is blocked by a body that overlaps him
  const solids = [];
  function addSolid(o) { solids.push(o); return o; }
  const bridgeHalf = LAYOUT.bridgeHalf, plankTop = LAYOUT.plankTop;
  addSolid({ s0: LAYOUT.bridgeA[0], s1: LAYOUT.bridgeA[1], l0: -bridgeHalf, l1: bridgeHalf, bottom: 0, top: plankTop });
  addSolid({ s0: LAYOUT.bridgeB[0], s1: LAYOUT.bridgeB[1], l0: -bridgeHalf, l1: bridgeHalf, bottom: 0, top: plankTop });
  const ped = LAYOUT.pedestal;
  addSolid({ s0: ped.s0, s1: ped.s1, l0: -ped.half, l1: ped.half, bottom: 0, top: ped.top });
  const mill = LAYOUT.mill, bal = LAYOUT.balcony;
  const LUIGI_SPOT = { s: bal.s1 - 1.0, l: 7.5 };   // deep in the balcony, clear of the tower (see balconyLanding)
  addSolid({ cs: mill.towerS, cl: 0, r: mill.towerR, bottom: -1, top: 60 });                        // tower
  addSolid({ s0: bal.s0, s1: bal.s1, l0: bal.l0, l1: bal.l1, bottom: bal.top - 1, top: bal.top });  // balcony floor
  const crateSolid = addSolid({ s0: LAYOUT.crate.s - 0.9, s1: LAYOUT.crate.s + 0.9, l0: -0.9, l1: 0.9, bottom: 0, top: 1.6 });
  addSolid({ s0: LAYOUT.lever.s - 0.4, s1: LAYOUT.lever.s + 0.4, l0: LAYOUT.lever.l - 0.4, l1: LAYOUT.lever.l + 0.4, bottom: 0, top: 1.0 });

  const STEP = 0.65;
  function inFoot(o, s, l) {
    if (o.r !== undefined) return Math.hypot(s - o.cs, l - o.cl) < o.r;
    return s >= o.s0 && s <= o.s1 && l >= o.l0 && l <= o.l1;
  }
  // Ground under a world position. curH is Mario's height above the base sphere before this move.
  const _u = new V3();
  function query(pos, curH) {
    _u.copy(pos).sub(center).normalize();
    const c = coordsOf(_u);
    let ground = terrainH(c.s, c.l), blocked = false;
    let isVoid = ground < LAYOUT.voidBelow;
    if (ground > curH + STEP) blocked = true;
    for (const o of solids) {
      if (o.gone || !inFoot(o, c.s, c.l)) continue;
      if (o.top <= curH + STEP) { if (isVoid || o.top > ground) { ground = o.top; isVoid = false; } }
      else if (o.bottom < curH + 1.6) blocked = true;
    }
    return { radius: isVoid ? -Infinity : R + ground, blocked, s: c.s, l: c.l, void: isVoid };
  }

  // ---- shared wind and brake (GameShared is the one source of truth) ----
  const wind = GameShared.wind, brake = GameShared.brake;
  function windAt(dir, t) {
    const psi = 1.5 * Math.sin(0.28 * t);
    const d = new V3().addScaledVector(B, Math.sin(psi)).addScaledVector(T, 0.5 * Math.cos(psi));
    wind.direction.copy(GameShared.projectTangent(d, dir));
    wind.strength = Math.max(0.15, 0.95 + 0.6 * Math.sin(0.6 * t) + 0.25 * Math.sin(1.9 * t));
  }
  function drift(pos, grounded, up) {
    const c = coordsOf(_u.copy(pos).sub(center).normalize());
    if (c.s < LAYOUT.windS0 || c.s > LAYOUT.windS1) return new V3();
    const d = GameShared.projectTangent(wind.direction, up);
    return d.multiplyScalar(wind.strength * TUNE.wind.drift * (grounded ? 0.5 : 1));
  }

  // The canyon gets its own fine mesh (the planet sphere is ~4 units per triangle, which turned
  // the 4 unit wide canyon walls into teeth). The strip covers s0..s1 and |l| < maxL; the coarse
  // sphere is pushed under it in hide0..hide1, |l| < hideL, with a margin larger than one coarse
  // triangle so no gap shows at the seam.
  const CANYON_STRIP = { s0: 68, s1: 130, maxL: 165, hide0: 72.5, hide1: 125.5, hideL: 155, ds: 0.5, rows: 131 };
  // The training trench gets the same treatment (the net was hidden under the coarse triangles).
  // It ends where the canyon strip starts, so the two never overlap.
  const TRENCH_STRIP = { s0: 51.5, s1: 68, maxL: 165, hide0: 56, hide1: 67, hideL: 155, ds: 0.5, rows: 131, trench: true };
  const inStrip = (cs, c) => c.s > cs.hide0 && c.s < cs.hide1 && Math.abs(c.l) < cs.hideL;

  // ---- terrain mesh shaping + painting ----
  function shapeGround(geo) {
    const pos = geo.attributes.position, v = new V3();
    for (let i = 0; i < pos.count; i++) {
      v.set(pos.getX(i), pos.getY(i), pos.getZ(i)).normalize();
      const c = coordsOf(v);
      // inside the detailed canyon strip the coarse sphere sinks out of sight (see buildCanyon)
      const hidden = (FX.canyon && inStrip(CANYON_STRIP, c)) || (FX.path && inStrip(TRENCH_STRIP, c));
      v.multiplyScalar(R + (hidden ? -45 : terrainH(c.s, c.l)));
      pos.setXYZ(i, v.x, v.y, v.z);
    }
    pos.needsUpdate = true;
    const col = geo.attributes.color, tmp = new THREE.Color(), cen = new V3(), rr = (() => { let sd = 5; return () => (sd = (sd * 16807) % 2147483647) / 2147483647; })();
    const dirt = new THREE.Color(0xeac67e), rock = new THREE.Color(0x76655a), deep = new THREE.Color(0x3b3550), net = new THREE.Color(FX.path ? 0x6e5236 : 0xb78b52), plaza = new THREE.Color(0x92d874);
    for (let i = 0; i < pos.count; i += 3) {
      cen.set(0, 0, 0);
      for (let k = 0; k < 3; k++) cen.x += pos.getX(i + k), cen.y += pos.getY(i + k), cen.z += pos.getZ(i + k);
      cen.normalize();
      const c = coordsOf(cen), h = terrainH(c.s, c.l);
      let set = null;
      if (h < -1.5) {
        const k = clamp(-h / LAYOUT.canyon.depth, 0, 1);
        if (-h > LAYOUT.trench.depth + 0.5) set = tmp.copy(rock).lerp(deep, k);
        else set = tmp.copy(net);
      } else if (h < -0.4) set = tmp.copy(net).lerp(rock, 0.2);
      else if (!FX.path && Math.abs(c.l) < 3.2 && c.s > -14 && c.s < 160) set = tmp.copy(dirt);
      else if (Math.abs(c.l) < 11 && c.s > 20 && c.s < 56) set = tmp.copy(plaza);
      if (set) {
        set.multiplyScalar(0.94 + rr() * 0.1);
        for (let k = 0; k < 3; k++) col.setXYZ(i + k, set.r, set.g, set.b);
      }
    }
    col.needsUpdate = true;
  }
  function exitDir() { return dirAt(LAYOUT.gate.s, LAYOUT.gate.l); }

  // ============================================================
  // build: static scenery, windmill, characters, enemies
  // ============================================================
  const S = {}; // runtime state, rebuilt by reset()
  const colliders = [];  // meshes the camera must not hide Mario behind
  let group = null, planet = null, H = null, env = null;
  let flags = [], blades = [], ladderGlow = [], lever = null, luigi = null, cart = null, beam = null, lanternGlow = null;
  let crateMesh = null, goomba = null, koopa = null, punchHint = null;

  // Shared kit (issue #5): identical parts share one geometry, and parts of one plain colour share
  // one material. A material passed in, or one with options (glow, emissive), stays its own,
  // because some of those are changed at run time (ladder rungs, the lever knob).
  const kitGeo = new Map(), kitMat = new Map();
  function kitGeometry(key, make) { let g = kitGeo.get(key); if (!g) { g = make(); kitGeo.set(key, g); } return g; }
  function kitMaterial(color, opts) {
    if (opts || typeof color !== "number") return color && color.isMaterial ? color : H.mat(color, opts);
    let m = kitMat.get(color); if (!m) { m = H.mat(color); kitMat.set(color, m); } return m;
  }
  function box(w, h, d, color, opts) {
    return new THREE.Mesh(kitGeometry("b" + w + "," + h + "," + d, () => new THREE.BoxGeometry(w, h, d)), kitMaterial(color, opts));
  }
  function cyl(rt, rb, h, seg, color, opts) {
    seg = seg || 10;
    return new THREE.Mesh(kitGeometry("c" + rt + "," + rb + "," + h + "," + seg, () => new THREE.CylinderGeometry(rt, rb, h, seg)), kitMaterial(color, opts));
  }
  function add(parent, obj, x, y, z) { obj.position.set(x || 0, y || 0, z || 0); parent.add(obj); return obj; }

  function makeFlag(s, l, h, height) {
    const g = new THREE.Group();
    add(g, cyl(0.07, 0.09, height, 6, 0x6b4b34), 0, height / 2, 0);
    const hub = new THREE.Group(); hub.position.y = height - 0.8; g.add(hub);
    const geo = new THREE.PlaneGeometry(2.0, 0.9, 8, 2);
    geo.translate(1.0, 0, 0);
    const cloth = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0xff5a4a, emissive: 0x551008, side: THREE.DoubleSide, roughness: 0.8 }));
    hub.add(cloth);
    group.add(put(g, s, l, h || 0));
    flags.push({ g, hub, cloth, base: geo.attributes.position.array.slice() });
    return g;
  }

  const sails = [];          // cloth that billows with GameShared.wind
  let windowMat = null;      // tower windows, lit at night
  function makeBlade(index, isLadder) {
    const L = mill.bladeLen;
    const g = new THREE.Group();
    const wood = 0x8a5a3b;
    add(g, box(0.55, L, 0.4, wood), 0, L / 2, 0);                       // spar
    if (isLadder) {
      const railM = 0x9b6a42;
      add(g, box(0.18, L, 0.3, railM), -0.9, L / 2, 0.05);
      add(g, box(0.18, L, 0.3, railM), 0.9, L / 2, 0.05);
      for (let y = 1.5; y < L - 0.5; y += 1.4) {
        const rung = add(g, box(1.9, 0.2, 0.3, 0xffd36a, { emissive: 0xffa020, emissiveIntensity: 0.35 }), 0, y, 0.08);
        ladderGlow.push(rung);
      }
      if (FX.windmill) {               // a red pennant at the tip: the one blade without a sail
        const geo = new THREE.PlaneGeometry(1.8, 0.8, 6, 1); geo.translate(0.9, 0, 0);
        const pen = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0xe8402e, emissive: 0x501008, side: THREE.DoubleSide, roughness: 0.8 }));
        pen.position.set(0.3, L - 0.2, 0.1);
        g.add(pen);
        sails.push({ cloth: pen, base: geo.attributes.position.array.slice(), phase: 0.3, pennant: true });
      }
    } else if (!FX.windmill) {
      const sailC = [0xf4efe2, 0xf0e4c8, 0xe9ddc0][index % 3];
      for (let k = 0; k < 3; k++) {
        const sail = add(g, box(3.6, 3.4, 0.12, sailC), 2.1, 4.2 + k * 4.8, 0);
        sail.rotation.x = 0.05;
        add(g, box(0.18, 3.5, 0.2, wood), 0.35, 4.2 + k * 4.8, 0);
      }
    } else {
      // a lattice frame with one long cloth sail: a broad, readable silhouette from across the canyon
      const y0 = 2.4, y1 = L - 0.3, len = y1 - y0, frame = 0x6b4b34;
      add(g, box(0.18, len, 0.18, frame), 4.3, (y0 + y1) / 2, 0);
      for (let y = y0; y <= y1 + 0.01; y += len / 9) add(g, box(4.4, 0.13, 0.15, frame), 2.2, y, 0);
      const sailC = [0xf6f0e2, 0xf2e6cc, 0xece0c4][index % 3];
      const geo = new THREE.PlaneGeometry(3.7, len - 0.2, 4, 12);
      const cloth = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: sailC, side: THREE.DoubleSide, roughness: 0.9 }));
      cloth.position.set(2.3, (y0 + y1) / 2, -0.14);
      g.add(cloth);
      sails.push({ cloth, base: geo.attributes.position.array.slice(), phase: index * 1.7, half: 1.85, len });
    }
    return g;
  }

  // sails bulge with the wind strength and ripple; the pennant streams like the flags
  function updateSails(t) {
    const w = wind.strength;
    for (const sl of sails) {
      const a = sl.cloth.geometry.attributes.position, base = sl.base;
      for (let i = 0; i < a.count; i++) {
        const x = base[i * 3], y = base[i * 3 + 1];
        let z;
        if (sl.pennant) z = Math.sin(t * (4 + w * 4) - x * 3 + sl.phase) * 0.18 * (x / 1.8) * (0.4 + w);
        else {
          const across = 1 - Math.pow(x / sl.half, 2), along = Math.cos(y / sl.len * Math.PI);
          z = -(0.25 + 0.35 * w) * across * along + 0.05 * w * Math.sin(t * 5 + y * 0.7 + sl.phase) * across;
        }
        a.setZ(i, z);
      }
      a.needsUpdate = true;
    }
  }

  function makeLuigi() {
    const g = new THREE.Group();
    const green = 0x2eaa4a, blue = 0x2a4fd0, skin = 0xffc79a, brown = 0x5b3a22;
    const legs = new THREE.Group(); g.add(legs);
    add(legs, box(0.34, 0.6, 0.36, blue), -0.2, 0.55, 0);
    add(legs, box(0.34, 0.6, 0.36, blue), 0.2, 0.55, 0);
    add(legs, box(0.4, 0.22, 0.55, brown), -0.2, 0.14, 0.06);
    add(legs, box(0.4, 0.22, 0.55, brown), 0.2, 0.14, 0.06);
    add(g, box(0.85, 0.75, 0.5, blue), 0, 1.3, 0);
    add(g, box(0.85, 0.5, 0.52, green), 0, 1.58, 0);
    const head = new THREE.Group(); head.position.y = 2.05; g.add(head);
    add(head, new THREE.Mesh(new THREE.SphereGeometry(0.42, 12, 10), H.mat(skin)), 0, 0, 0);
    add(head, new THREE.Mesh(new THREE.SphereGeometry(0.46, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), H.mat(green)), 0, 0.1, -0.02);
    add(head, box(0.7, 0.08, 0.35, green), 0, 0.12, 0.38);
    add(head, new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), H.mat(skin)), 0, -0.03, 0.42);
    add(head, box(0.5, 0.1, 0.16, brown), 0, -0.2, 0.36);
    const armL = new THREE.Group(); armL.position.set(-0.55, 1.65, 0); g.add(armL);
    add(armL, box(0.22, 0.7, 0.22, green), 0, -0.3, 0);
    const armR = new THREE.Group(); armR.position.set(0.55, 1.65, 0); g.add(armR);
    add(armR, box(0.22, 0.7, 0.22, green), 0, -0.3, 0);
    // lantern held on the left side
    const lantern = new THREE.Group(); lantern.position.set(-0.78, 1.1, 0.2); g.add(lantern);
    add(lantern, box(0.3, 0.38, 0.3, 0x3a3a46), 0, 0, 0);
    const bulb = add(lantern, new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8),
      new THREE.MeshBasicMaterial({ color: 0xffe9a0, transparent: true, opacity: 0.2 })), 0, 0, 0);
    lanternGlow = new THREE.Mesh(new THREE.SphereGeometry(1.6, 14, 10),
      new THREE.MeshBasicMaterial({ color: 0xfff0b0, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
    lantern.add(lanternGlow);
    g.scale.setScalar(1.15);
    return { g, head, armL, armR, bulb, lantern };
  }

  function makeCart() {
    const g = new THREE.Group();
    add(g, box(3.2, 1.4, 2.2, 0x6a3f24), 0, 1.1, 0);
    add(g, box(3.4, 0.2, 2.4, 0x3a2416), 0, 1.85, 0);
    for (const x of [-1.1, 1.1]) for (const z of [-1.05, 1.05]) {
      const w = add(g, cyl(0.45, 0.45, 0.3, 12, 0x2a2a30), x, 0.45, z); w.rotation.x = Math.PI / 2;
    }
    const cv = document.createElement("canvas"); cv.width = 256; cv.height = 128;
    const cx = cv.getContext("2d"); cx.fillStyle = "#6a3f24"; cx.fillRect(0, 0, 256, 128);
    cx.fillStyle = "#ffd23f"; cx.font = "bold 92px sans-serif"; cx.textAlign = "center"; cx.textBaseline = "middle"; cx.fillText("DK", 128, 68);
    const tex = new THREE.CanvasTexture(cv);
    const label = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.1), new THREE.MeshBasicMaterial({ map: tex }));
    label.position.set(0, 1.15, 1.12);
    g.add(label);
    return g;
  }

  function makeGoomba() {
    const g = new THREE.Group();
    const body = new THREE.Group(); g.add(body);
    add(body, new THREE.Mesh(new THREE.SphereGeometry(0.75, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), H.mat(0x8b5a2b)), 0, 0.5, 0);
    add(body, cyl(0.42, 0.5, 0.5, 10, 0xf1d9b0), 0, 0.28, 0);
    for (const x of [-0.28, 0.28]) {
      add(body, new THREE.Mesh(new THREE.SphereGeometry(0.17, 8, 6), H.mat(0xffffff)), x, 0.62, 0.55);
      add(body, new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 5), H.mat(0x111111)), x, 0.62, 0.7);
      const f = add(body, box(0.4, 0.2, 0.6, 0x3a2416), x * 1.3, 0.1, 0.05); f.name = "foot";
    }
    add(body, box(0.7, 0.08, 0.1, 0x2a1608), 0, 0.82, 0.62).rotation.z = 0.0;
    const bang = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.7, 0.2), new THREE.MeshBasicMaterial({ color: 0xff3a2a }));
    bang.position.y = 2.2; bang.visible = false; g.add(bang);
    return { g, body, bang };
  }

  function makeKoopa() {
    const g = new THREE.Group();
    const body = new THREE.Group(); g.add(body);
    add(body, new THREE.Mesh(new THREE.SphereGeometry(0.62, 12, 10), H.mat(0x35b34a)), 0, 0.9, 0);
    add(body, new THREE.Mesh(new THREE.SphereGeometry(0.35, 10, 8), H.mat(0xffd94a)), 0, 1.45, 0.4);
    add(body, new THREE.Mesh(new THREE.SphereGeometry(0.1, 6, 5), H.mat(0x111111)), -0.14, 1.52, 0.7);
    add(body, new THREE.Mesh(new THREE.SphereGeometry(0.1, 6, 5), H.mat(0x111111)), 0.14, 1.52, 0.7);
    add(body, box(0.5, 0.18, 0.3, 0xffb030), 0, 0.2, 0.2);
    const wings = [];
    for (const sx of [-1, 1]) {
      const w = new THREE.Group(); w.position.set(sx * 0.55, 1.1, -0.1); body.add(w);
      const m = add(w, box(0.1, 0.9, 1.3, 0xffffff), sx * 0.05, 0.3, 0);
      m.position.set(sx * 0.1, 0.35, -0.35);
      wings.push({ w, sx });
    }
    const shadow = new THREE.Mesh(new THREE.CircleGeometry(1.5, 20),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0, depthWrite: false }));
    shadow.scale.set(1, 0.7, 1);
    // a faint warm ring around the shadow, so the dive mark still reads on dark ground at night
    const ring = new THREE.Mesh(new THREE.RingGeometry(1.32, 1.6, 28),
      new THREE.MeshBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    ring.position.z = 0.01;
    shadow.add(ring);
    return { g, body, wings, shadow, ring };
  }

  // ---------- canyon strip: fine mesh, strata colours, darker and bluer with depth ----------
  function buildCanyon(cs) {
    cs = cs || CANYON_STRIP;
    const plaza = new THREE.Color(0x92d874), netFloor = new THREE.Color(0x6e5236);
    const cols = Math.round((cs.s1 - cs.s0) / cs.ds) + 1, rows = cs.rows;
    const pos = new Float32Array(cols * rows * 3), colA = new Float32Array(cols * rows * 3);
    const strata = [0xe0b07a, 0xc8845a, 0xe8c896, 0xb06a4e, 0xd6a072, 0x9a6050, 0xcc9468].map(h => new THREE.Color(h));
    const haze = new THREE.Color(0x4a4778), dirt = new THREE.Color(0xeac67e), c = new THREE.Color(), v = new V3();
    let n = 0;
    for (let j = 0; j < rows; j++) {
      const u = j / (rows - 1) * 2 - 1;
      const l = Math.sign(u) * Math.pow(Math.abs(u), 1.5) * cs.maxL;   // finer near the route
      for (let i = 0; i < cols; i++, n++) {
        const s = cs.s0 + i * cs.ds;
        const h = terrainH(s, l);
        localPos(s, l, h).toArray(pos, n * 3);
        const depth = -h;
        if (depth < 0.25) {
          if (!FX.path && Math.abs(l) < 3.2) c.copy(dirt);
          else if (Math.abs(l) < 11 && s > 20 && s < 56) c.copy(plaza);
          else H.tint(dirAt(s, l, v), c);
        } else if (cs.trench) {
          H.tint(dirAt(s, l, v), c).lerp(netFloor, Math.min(1, depth / 1.2));
          c.multiplyScalar(0.92 + 0.08 * Math.sin(l * 0.9 + s * 1.7));
        } else {
          const wob = depth + 0.7 * Math.sin(l * 0.11 + s * 0.35) + 0.4 * Math.sin(l * 0.37);
          const band = Math.floor(wob / 2.3);
          c.copy(strata[((band % strata.length) + strata.length) % strata.length]);
          c.multiplyScalar(0.92 + 0.08 * Math.sin(l * 0.9 + band));
          c.lerp(haze, Math.pow(Math.min(1, depth / LAYOUT.canyon.depth), 1.3) * 0.72);  // depth haze
        }
        c.toArray(colA, n * 3);
      }
    }
    const idx = [];
    for (let j = 0; j < rows - 1; j++) for (let i = 0; i < cols - 1; i++) {
      const a = j * cols + i, b = a + 1, d = a + cols, e = d + 1;
      idx.push(a, d, b, b, d, e);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(colA, 3));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    // keep the winding facing outward (normals point away from the planet centre)
    const nrm = geo.attributes.normal;
    if (nrm.getX(0) * pos[0] + nrm.getY(0) * pos[1] + nrm.getZ(0) * pos[2] < 0) {
      for (let k = 0; k < idx.length; k += 3) { const t = idx[k + 1]; idx[k + 1] = idx[k + 2]; idx[k + 2] = t; }
      geo.setIndex(idx); geo.computeVertexNormals();
    }
    const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0,
      polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }));
    m.userData.noCast = true;     // its self-shadow ended in the straight edge of the shadow map
    m.userData.noReceive = true;  // and rim plants threw speckles down the steep walls
    group.add(m);
  }

  // ---------- the dirt path: its own soft-edged ribbon (issue #5) ----------
  // The planet triangles are about 4 units wide, so painting the 6 unit path into them gave a
  // jagged yellow polygon. The ribbon follows terrainH at 0.5 unit steps, wobbles a little at
  // its edges and fades into the grass through vertex alpha. It is skipped wherever the ground
  // dips (trench, canyon), where the net and the bridge take over.
  let pathMat = null;
  function buildPath() {
    const S0 = -16, S1 = 162, DS = 0.5;
    const across = [-1, -0.88, -0.74, -0.3, 0, 0.3, 0.74, 0.88, 1];   // fraction of the half width
    const dirt = new THREE.Color(0xe6c27c), rut = new THREE.Color(0xd2aa66), plaza = new THREE.Color(0x92d874);
    const c = new THREE.Color(), g = new THREE.Color(), v = new V3();
    const pos = [], col = [], idx = [];
    let prev = -1;
    const noise = (s, l) => 0.5 + 0.25 * Math.sin(s * 0.9 + l * 2.1) + 0.25 * Math.sin(s * 2.3 - l * 1.3);
    for (let s = S0; s <= S1 + 1e-6; s += DS) {
      const half = 3.0 + 0.3 * Math.sin(s * 0.37) + 0.18 * Math.sin(s * 1.13 + 1.0);
      const shift = 0.25 * Math.sin(s * 0.21 + 0.5);
      let ok = true;
      for (const f of across) if (terrainH(s, shift + f * half) < -0.3) { ok = false; break; }
      if (!ok) { prev = -1; continue; }
      const endFade = Math.min(1, (s - S0) / 4, (S1 - s) / 4);
      const base = pos.length / 3;
      for (const f of across) {
        const l = shift + f * half;
        localPos(s, l, terrainH(s, l) + 0.03).toArray(pos, pos.length);
        if (Math.abs(l) < 11 && s > 20 && s < 56) g.copy(plaza); else H.tint(dirAt(s, l, v), g);
        const a = Math.abs(f);
        c.copy(Math.abs(a - 0.3) < 0.01 ? rut : dirt).multiplyScalar(0.94 + 0.08 * noise(s, l));
        if (a > 0.8) c.lerp(g, 0.3);
        const alpha = (a > 0.95 ? 0 : a > 0.8 ? 0.8 : 1) * endFade;
        col.push(c.r, c.g, c.b, alpha);
      }
      if (prev >= 0) for (let k = 0; k < across.length - 1; k++) {
        const a0 = prev + k, b0 = base + k;
        idx.push(a0, b0, a0 + 1, a0 + 1, b0, b0 + 1);
      }
      prev = base;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute("color", new THREE.Float32BufferAttribute(col, 4));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    const nrm = geo.attributes.normal;
    if (nrm.getX(0) * pos[0] + nrm.getY(0) * pos[1] + nrm.getZ(0) * pos[2] < 0) {
      for (let k = 0; k < idx.length; k += 3) { const t = idx[k + 1]; idx[k + 1] = idx[k + 2]; idx[k + 2] = t; }
      geo.setIndex(idx); geo.computeVertexNormals();
    }
    pathMat = new THREE.MeshStandardMaterial({ vertexColors: true, transparent: true, depthWrite: false,
      roughness: 1, metalness: 0, emissive: 0xe6c27c, emissiveIntensity: 0,
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    const m = new THREE.Mesh(geo, pathMat);
    m.renderOrder = -1;           // before the other see-through things (flags' halos, beams)
    m.receiveShadow = true;
    group.add(m);
  }

  // ---------- grass clumps that sway with the shared wind (issue #5) ----------
  // Five thin blades, darker at the root; normals point up so the clump shades like soft grass.
  function grassClump() {
    const pos = [], col = [], nrm = [], root = new THREE.Color(0x3f9a4a), tip = new THREE.Color(0xa6e47e);
    for (let i = 0; i < 5; i++) {
      const a = i / 5 * Math.PI * 2 + 0.3 * Math.sin(i * 7.1), w = 0.05, hgt = 0.38 + 0.18 * ((i * 37) % 5) / 4;
      const ca = Math.cos(a), sa = Math.sin(a), lean = 0.14;
      const A = [-sa * w + ca * 0.03, 0, ca * w + sa * 0.03], B = [sa * w + ca * 0.03, 0, -ca * w + sa * 0.03], T = [ca * lean, hgt, sa * lean];
      // both windings with the same upward normal: a double-sided material would flip the
      // normal on the back face and turn half the blades black
      pos.push(...A, ...B, ...T, ...B, ...A, ...T);
      for (let k = 0; k < 2; k++) col.push(root.r, root.g, root.b, root.r, root.g, root.b, tip.r, tip.g, tip.b);
      for (let k = 0; k < 6; k++) nrm.push(0, 1, 0);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
    g.setAttribute("normal", new THREE.Float32BufferAttribute(nrm, 3));
    return g;
  }
  const grassU = { uTime: { value: 0 }, uWind: { value: 1 } };
  let grassM = null;
  function grassMat() {
    if (grassM) return grassM;
    grassM = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0 });
    grassM.onBeforeCompile = (sh) => {
      sh.uniforms.uTime = grassU.uTime; sh.uniforms.uWind = grassU.uWind;
      sh.vertexShader = "uniform float uTime; uniform float uWind;\n" + sh.vertexShader.replace("#include <begin_vertex>",
        "#include <begin_vertex>\n" +
        "#ifdef USE_INSTANCING\n float ph = dot(instanceMatrix[3].xyz, vec3(0.31, 0.17, 0.23));\n#else\n float ph = 0.0;\n#endif\n" +
        " float sw = position.y * position.y * (0.25 + 0.35 * uWind);\n" +
        " transformed.x += sw * sin(uTime * 2.3 + ph);\n transformed.z += sw * 0.6 * sin(uTime * 1.7 + ph * 1.3);");
    };
    return grassM;
  }

  // ---------- the safety net over the training trench (issue #5) ----------
  // A light rope grid on a darker floor, so the net reads by its pattern, not only its colour
  // (also in greyscale). Same span as the old line grid; it sits 0.08 above the trench floor.
  function buildNet() {
    const t = LAYOUT.trench, cv = document.createElement("canvas");
    cv.width = cv.height = 64;
    const cx = cv.getContext("2d");
    cx.strokeStyle = "#fff1cf"; cx.lineWidth = 7;
    cx.beginPath(); cx.moveTo(0, 2); cx.lineTo(64, 2); cx.moveTo(2, 0); cx.lineTo(2, 64); cx.stroke();
    cx.fillStyle = "#f4d79a"; cx.beginPath(); cx.arc(2, 2, 6, 0, 7); cx.fill();
    const tex = new THREE.CanvasTexture(cv);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.anisotropy = 4;
    const DS = 0.5, DL = 2, CELL = 1.2, pos = [], uv = [], idx = [];
    let cols = 0, rows = 0;
    // only the lower part of the trench: on the walls the grid read as a fence from the meadow
    let s0 = t.a, s1 = t.b;
    while (terrainH(s0, 0) > -1.3 && s0 < t.b) s0 += 0.1;
    while (terrainH(s1, 0) > -1.3 && s1 > t.a) s1 -= 0.1;
    for (let s = s0; s <= s1 + 1e-6; s += (s1 - s0) / Math.ceil((s1 - s0) / DS), rows++) {
      cols = 0;
      for (let l = -100; l <= 100 + 1e-6; l += DL, cols++) {
        localPos(s, l, terrainH(s, l) + 0.08).toArray(pos, pos.length);
        uv.push(l / CELL, (s - t.a) / CELL);
      }
    }
    for (let j = 0; j < rows - 1; j++) for (let i = 0; i < cols - 1; i++) {
      const a = j * cols + i, b = a + 1, d = a + cols, e = d + 1;
      idx.push(a, d, b, b, d, e);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: tex, transparent: true, alphaTest: 0.35,
      side: THREE.DoubleSide, roughness: 0.9, emissive: 0x6a5530, emissiveIntensity: 0.25 }));
    m.userData.noCast = true;
    group.add(m);
  }

  // ---------- small lights that mark edges, brighter as night falls ----------
  const markers = [];
  let markerMat = null, markerHalo = null;
  function addMarker(s, l, h, post) {
    const g = new THREE.Group();
    if (post) add(g, cyl(0.07, 0.09, post, 6, 0x5a4030), 0, post / 2, 0);
    add(g, new THREE.Mesh(markerGeo, markerMat), 0, (post || 0) + 0.12, 0);
    add(g, new THREE.Mesh(haloGeo, markerHalo), 0, (post || 0) + 0.12, 0);
    group.add(put(g, s, l, h));
    markers.push(g);
  }
  let markerGeo = null, haloGeo = null;
  function buildMarkers() {
    markerGeo = new THREE.SphereGeometry(0.2, 10, 8);
    haloGeo = new THREE.SphereGeometry(0.8, 10, 8);
    markerMat = new THREE.MeshStandardMaterial({ color: 0xffe6a8, emissive: 0xffb848, emissiveIntensity: 0.4, roughness: 0.4 });
    markerHalo = new THREE.MeshBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
    const bh = bridgeHalf + 0.05;
    // the two edges of the gap, and both ends of the bridge
    for (const sx of [-1, 1]) {
      addMarker(LAYOUT.bridgeA[1] - 0.15, sx * bh, plankTop + 1.5, 0);
      addMarker(LAYOUT.bridgeB[0] + 0.15, sx * bh, plankTop + 1.5, 0);
      addMarker(LAYOUT.bridgeA[0], sx * (bh + 0.5), 0, 1.2);
      addMarker(LAYOUT.bridgeB[1], sx * (bh + 0.5), 0, 1.2);
    }
    // the training trench rim and the pedestal top
    for (const sx of [-1, 1]) { addMarker(LAYOUT.trench.a - 1, sx * 4.2, 0, 0.9); addMarker(LAYOUT.trench.b + 1, sx * 4.2, 0, 0.9); }
    for (const ss of [ped.s0 + 0.3, ped.s1 - 0.3]) for (const sx of [-1, 1]) addMarker(ss, sx * (ped.half - 0.3), ped.top + 0.15, 0);
    // balcony corners and the lever stand
    addMarker(bal.s0 + 0.2, bal.l1 - 0.2, bal.top + 1.2, 0);
    addMarker(bal.s0 + 0.2, bal.l0 + 0.2, bal.top + 1.2, 0);
    addMarker(LAYOUT.lever.s, LAYOUT.lever.l + 1.2, 0, 1.0);
  }

  // ---------- light-coloured stones along the path edges: the route reads in greyscale too ----------
  function buildStones(rand) {
    const geo = new THREE.DodecahedronGeometry(0.24, 0);
    const mesh = new THREE.InstancedMesh(geo, H.mat(0xf2ead8), 260);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new V3(0, 1, 0), sc = new V3();
    let n = 0;
    const ranges = [[-12, 39], [47, 56], [67, 75.5], [123.5, 158]];
    for (const [a, b] of ranges) for (let s = a; s <= b && n < 260; s += 2.1) for (const sx of [-1, 1]) {
      const l = sx * (3.55 + rand() * 0.25), dir = dirAt(s + rand() * 0.6, l);
      q.setFromUnitVectors(up, dir);
      sc.set(1 + rand() * 0.4, 0.5 + rand() * 0.2, 1 + rand() * 0.4);
      m.compose(dir.clone().multiplyScalar(R + terrainH(s, l) + 0.04), q, sc);
      mesh.setMatrixAt(n++, m);
    }
    mesh.count = n; mesh.instanceMatrix.needsUpdate = true;
    group.add(mesh);
  }

  // ---------- low-contrast floating islands far behind the route ----------
  function buildIslands(rand) {
    const rock = new THREE.MeshStandardMaterial({ color: 0x9d9aae, roughness: 1, flatShading: true });
    const top = new THREE.MeshStandardMaterial({ color: 0xa8c8a0, roughness: 1, flatShading: true });
    const leaf = new THREE.MeshStandardMaterial({ color: 0x8fb898, roughness: 1, flatShading: true });
    for (let i = 0; i < 12; i++) {
      const g = new THREE.Group();
      const r = 5 + rand() * 9;
      add(g, new THREE.Mesh(new THREE.ConeGeometry(r, r * 1.6, 7), rock), 0, -r * 0.8, 0).rotation.x = Math.PI;
      add(g, new THREE.Mesh(new THREE.CylinderGeometry(r * 1.02, r, 1.2, 7), top), 0, 0.6, 0);
      for (let k = 0; k < 3; k++) add(g, new THREE.Mesh(new THREE.IcosahedronGeometry(1.4 + rand() * 1.4, 0), leaf), (rand() - 0.5) * r, 2.2, (rand() - 0.5) * r);
      g.rotation.y = rand() * 6;
      const s = -40 + rand() * 300, l = (rand() < 0.5 ? -1 : 1) * (70 + rand() * 90);
      const holder = new THREE.Group(); holder.add(g);
      group.add(put(holder, s, l, 55 + rand() * 60));
    }
  }

  function build(p, grp, helpers) {
    planet = p; group = grp; H = helpers;
    const rand = H.rng(4242);
    const dirtM = H.mat(0xe3bd68);

    // ---------- scatter decoration near the route (rejection sampled) ----------
    const parts = {
      tree: [
        { geo: new THREE.CylinderGeometry(0.13, 0.18, 1.1, 6), mat: H.mat(0xc9a06a), y: 0.55 },
        { geo: new THREE.IcosahedronGeometry(0.62, 0), mat: H.mat(0x55bf60), y: 1.35 }],
      flower: [
        { geo: new THREE.CylinderGeometry(0.04, 0.04, 0.34, 4), mat: H.mat(0x4cae52), y: 0.17 },
        { geo: new THREE.IcosahedronGeometry(0.16, 0), mat: H.mat(0xfff0a8, { emissive: 0xffc040, emissiveIntensity: 0.25 }), y: 0.4 }],
      tuft: FX.path ? [{ geo: grassClump(), mat: grassMat(), y: 0, noCast: true }]
                    : [{ geo: new THREE.ConeGeometry(0.16, 0.5, 4), mat: H.mat(0x62cf6b), y: 0.25 }],
      rock: [{ geo: new THREE.DodecahedronGeometry(0.45, 0), mat: H.mat(0xa6a39a), y: 0 }]
    };
    const ok = (s, l) => {
      if (Math.abs(l) < 5.5 && s > -16 && s < 165) return false;
      const k = LAYOUT.canyon, t = LAYOUT.trench;
      if (s > k.a - 3 && s < k.b + 3) return false;
      if (s > t.a - 3 && s < t.b + 3) return false;
      if (Math.hypot(s - mill.towerS, l) < 14) return false;
      if (Math.abs(l) < 14 && s > 118 && s < 160) return false;
      return true;
    };
    function scatterNear(def, count, sMin, sMax, h, sc0, sc1, test, lMax) {
      test = test || ok; lMax = lMax || 90;
      const meshes = def.map(pt => { const m = new THREE.InstancedMesh(pt.geo, pt.mat, count); m.userData.noCast = !!pt.noCast; group.add(m); return m; });
      const loc = def.map(pt => new THREE.Matrix4().makeTranslation(0, pt.y || 0, 0));
      const base = new THREE.Matrix4(), out = new THREE.Matrix4(), q = new THREE.Quaternion(), spin = new THREE.Quaternion();
      const sc = new V3(), up = new V3(0, 1, 0);
      let n = 0, guard = 0;
      while (n < count && guard++ < count * 20) {
        const s = sMin + rand() * (sMax - sMin), l = (rand() * 2 - 1) * lMax;
        if (!test(s, l)) continue;
        const dir = dirAt(s, l);
        const k = sc0 + Math.pow(rand(), 2.2) * (sc1 - sc0);
        q.setFromUnitVectors(up, dir); spin.setFromAxisAngle(up, rand() * 6.28); q.multiply(spin);
        sc.set(k, k, k);
        base.compose(dir.clone().multiplyScalar(R + terrainH(s, l) + h * k), q, sc);
        meshes.forEach((m, i) => { out.multiplyMatrices(base, loc[i]); m.setMatrixAt(n, out); });
        n++;
      }
      meshes.forEach(m => { m.count = n; m.instanceMatrix.needsUpdate = true; });
    }
    scatterNear(parts.tree, 260, -60, 230, 0, 1.3, 4.2);
    scatterNear(parts.flower, 900, -40, 200, 0, 1.0, 1.6);
    scatterNear(parts.tuft, 1400, -40, 200, 0, 1.0, 2.2);
    if (FX.path) {
      // low grass along both path edges: foreground depth, clear of the path itself so the
      // hero's feet and the path edge stay visible
      const edge = (s, l) => {
        const a = Math.abs(l);
        if (a < 3.9 || a > 8.5 || s < -14 || s > 118) return false;
        const k = LAYOUT.canyon, t = LAYOUT.trench;
        if (s > k.a - 2 && s < k.b + 2) return false;
        if (s > t.a - 2 && s < t.b + 2) return false;
        if (s > 21 && s < 25 && a < 6) return false;              // around the punch crate
        return true;
      };
      scatterNear(parts.tuft, 900, -14, 118, 0, 0.55, 1.05, edge, 9);
    }
    scatterNear(parts.rock, 160, -40, 200, 0.1, 0.8, 4.5);

    // ---------- training: punch crate, pedestal, net ----------
    crateMesh = box(1.8, 1.6, 1.8, 0xb98b4e);
    add(crateMesh, box(1.9, 0.14, 1.9, 0x6a4a2a), 0, 0.8, 0);
    add(crateMesh, box(0.14, 1.7, 1.9, 0x6a4a2a), 0, 0, 0);
    group.add(put(crateMesh, LAYOUT.crate.s, LAYOUT.crate.l, 0.8));

    const pedMesh = new THREE.Group();
    const pw = (ped.s1 - ped.s0), pd = ped.half * 2;
    if (FX.path) {
      // a dry-stone block (issue #5): courses of stones of uneven length around a darker core,
      // flush with the old faces so the look matches the collision box; a grass cap on top.
      // All stones are one instanced mesh with per-stone colour, so it costs one draw call.
      add(pedMesh, box(pd - 0.24, ped.top - 0.1, pw - 0.24, 0x6f6a60), 0, (ped.top - 0.1) / 2, 0);
      const pal = [0xb2ac9c, 0xa29c8c, 0xbdb7a6, 0x958f81, 0xaaa597].map(h => new THREE.Color(h));
      const rows = 3, ch = (ped.top - 0.12) / rows, depth = 0.3, stones = [];
      const side = (len, place) => {
        for (let r = 0; r < rows; r++) {
          let x = -len / 2 + (r % 2 ? 0.5 : 0);
          if (r % 2) stones.push([place, -len / 2, x, r]);            // a short stone fills the stagger
          while (x < len / 2 - 0.05) {
            const w = Math.min(len / 2 - x, 1.1 + rand() * 1.0);
            stones.push([place, x, x + w, r]); x += w;
          }
        }
      };
      side(pw, "+l"); side(pw, "-l"); side(pd, "+s"); side(pd, "-s");
      const inst = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), H.mat(0xffffff), stones.length);
      const mtx = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new V3(), p = new V3();
      stones.forEach(([place, a, b, r], i) => {
        const len = b - a - 0.06, mid = (a + b) / 2, y = 0.06 + ch * (r + 0.5), hh = ch - 0.07;
        if (place === "+l" || place === "-l") { p.set((place === "+l" ? 1 : -1) * (pd / 2 - depth / 2), y, mid); sc.set(depth, hh, len); }
        else { p.set(mid, y, (place === "+s" ? 1 : -1) * (pw / 2 - depth / 2)); sc.set(len, hh, depth); }
        mtx.compose(p, q, sc); inst.setMatrixAt(i, mtx);
        inst.setColorAt(i, pal[Math.floor(rand() * pal.length)].clone().multiplyScalar(0.95 + rand() * 0.1));
      });
      pedMesh.add(inst);
      add(pedMesh, box(pd + 0.3, 0.32, pw + 0.3, 0x7cc463), 0, ped.top - 0.02, 0);
      add(pedMesh, box(pd + 0.1, 0.14, pw + 0.1, 0x8a6a48), 0, ped.top - 0.22, 0);
    } else {
      add(pedMesh, box(pd, ped.top, pw, 0x8d9a7a), 0, ped.top / 2, 0);
      add(pedMesh, box(pd + 0.4, 0.3, pw + 0.4, 0xc4d8a0), 0, ped.top, 0);
    }
    group.add(put(pedMesh, (ped.s0 + ped.s1) / 2, 0, 0));
    colliders.push(pedMesh);

    if (FX.path) { buildCanyon(TRENCH_STRIP); buildNet(); }
    else {
      const pts = [], t = LAYOUT.trench;
      for (let l = -100; l <= 100; l += 3) for (let s = t.a; s < t.b; s += 1) {
        pts.push(localPos(s, l, terrainH(s, l) + 0.07), localPos(s + 1, l, terrainH(s + 1, l) + 0.07));
      }
      for (let s = t.a; s <= t.b; s += 1.5) for (let l = -100; l < 100; l += 3) {
        pts.push(localPos(s, l, terrainH(s, l) + 0.07), localPos(s, l + 3, terrainH(s, l + 3) + 0.07));
      }
      const g = new THREE.BufferGeometry().setFromPoints(pts);
      group.add(new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0xfff0c8 })));
    }

    // ---------- flags: before the leap point, on the wind path, at the bridge ----------
    makeFlag(10, 4.5, 0, 3.2); makeFlag(10, -4.5, 0, 3.2);
    makeFlag(68, 5.5, 0, 4.2); makeFlag(72, -5.5, 0, 4.2);
    makeFlag(92.5, bridgeHalf + 0.6, plankTop, 4.4); makeFlag(92.5, -bridgeHalf - 0.6, plankTop, 4.4);
    makeFlag(106, bridgeHalf + 0.6, plankTop, 4.4); makeFlag(106, -bridgeHalf - 0.6, plankTop, 4.4);

    // ---------- bridge ----------
    const woodC = [0xc8935a, 0xb8854d, 0xd4a068];
    for (const [a, b] of [LAYOUT.bridgeA, LAYOUT.bridgeB]) {
      for (let s = a; s < b - 0.05; s += 1.1) {
        const plank = box(bridgeHalf * 2, 0.22, 1.0, woodC[Math.floor(rand() * 3)]);
        group.add(put(plank, s + 0.5, 0, plankTop - 0.11));
      }
      for (const side of [-1, 1]) {
        for (let s = a; s <= b + 0.01; s += 4) {
          const post = cyl(0.12, 0.14, 1.5, 6, 0x7a5233);
          group.add(put(post, Math.min(s, b), side * (bridgeHalf + 0.05), plankTop + 0.75));
        }
        const rail = box(0.08, 0.08, b - a, 0xf1e3b8);
        group.add(put(rail, (a + b) / 2, side * (bridgeHalf + 0.05), plankTop + 1.35));
      }
    }

    if (FX.canyon) buildCanyon();
    if (FX.path) buildPath();
    if (FX.markers) buildMarkers();
    if (FX.stones) buildStones(rand);
    if (FX.islands) buildIslands(rand);

    // ---------- windmill ----------
    const towerG = new THREE.Group();
    const tower = cyl(mill.towerR - 1.4, mill.towerR, mill.towerH, 14, 0xf0e2c0);
    tower.position.y = mill.towerH / 2; towerG.add(tower);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(mill.towerR + 0.8, 7, 14), H.mat(0xb94c3a));
    roof.position.y = mill.towerH + 3.2; towerG.add(roof);
    for (let k = 0; k < 4; k++) add(towerG, box(0.4, mill.towerH, 0.5, 0x8a5a3b), Math.cos(k * 1.57) * (mill.towerR - 0.9), mill.towerH / 2, Math.sin(k * 1.57) * (mill.towerR - 0.9));
    if (FX.windmill) {
      // stone foot, a door and windows facing the route; the windows glow at night
      add(towerG, cyl(mill.towerR + 0.5, mill.towerR + 0.9, 2.6, 14, 0x9a948a), 0, 1.3, 0);
      const rAt = (y) => mill.towerR - 1.4 * (y / mill.towerH);
      add(towerG, box(2.2, 3.6, 0.5, 0x5a3a22), 0, 2.6 + 1.8, rAt(4.4) + 0.05);
      windowMat = new THREE.MeshStandardMaterial({ color: 0x3a3040, emissive: 0xffc060, emissiveIntensity: 0.1, roughness: 0.6 });
      for (const [y, x] of [[10, -1.6], [15.5, 1.4], [21, -0.6]]) {
        const win = add(towerG, new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.5, 0.4), windowMat), x, y, rAt(y) - 0.05);
        win.rotation.y = Math.atan2(x, rAt(y));
      }
      add(towerG, new THREE.Mesh(new THREE.TorusGeometry(mill.towerR - 1.35, 0.25, 6, 20), H.mat(0x8a5a3b)), 0, mill.towerH - 0.2, 0).rotation.x = Math.PI / 2;
    }
    group.add(put(towerG, mill.towerS, 0, 0));
    colliders.push(tower, roof);

    // axle from the blade hub back to the tower, hub on the plane s = hubS
    const axle = box(0.7, 0.7, mill.towerS - mill.towerR - mill.hubS + 0.6, 0x6b4b34);
    group.add(put(axle, (mill.hubS + mill.towerS - mill.towerR) / 2, 0, mill.hubH));
    const bladeRoot = new THREE.Group();
    group.add(put(bladeRoot, mill.hubS, 0, mill.hubH));
    add(bladeRoot, new THREE.Mesh(new THREE.SphereGeometry(1.1, 12, 10), H.mat(0x6b4b34)), 0, 0, 0);
    for (let i = 0; i < 4; i++) {
      const g = makeBlade(i, i === 0);
      bladeRoot.add(g);
      blades.push({ g, index: i, ladder: i === 0 });
    }

    // balcony
    const balG = new THREE.Group();
    const bw = bal.l1 - bal.l0, bd = bal.s1 - bal.s0;
    add(balG, box(bw, 0.5, bd, 0xc8935a), 0, -0.25, 0);
    for (const sx of [-1, 1]) add(balG, box(0.14, 1.2, bd, 0xf1e3b8), sx * (bw / 2 - 0.07), 0.6, 0);
    add(balG, box(bw, 1.2, 0.14, 0xf1e3b8), 0, 0.6, -(bd / 2 - 0.07));
    for (const sx of [-1, 1]) add(balG, box(0.3, bal.top - 0.5, 0.3, 0x7a5233), sx * (bw / 2 - 0.3), -(bal.top - 0.5) / 2 - 0.25, 0);
    group.add(put(balG, (bal.s0 + bal.s1) / 2, (bal.l0 + bal.l1) / 2, bal.top));
    colliders.push(balG);

    // brake lever
    const lv = new THREE.Group();
    add(lv, box(0.9, 1.0, 0.9, 0x44444e), 0, 0.5, 0);
    const stick = new THREE.Group(); stick.position.y = 1.0; lv.add(stick);
    add(stick, cyl(0.08, 0.08, 1.7, 6, 0x333340), 0, 0.85, 0);
    const knob = add(stick, new THREE.Mesh(new THREE.SphereGeometry(0.28, 10, 8), H.mat(0xff4030, { emissive: 0xaa1000, emissiveIntensity: 0.5 })), 0, 1.75, 0);
    group.add(put(lv, LAYOUT.lever.s, LAYOUT.lever.l, 0));
    lever = { g: lv, stick, knob, angle: -0.5 };

    // Luigi on the balcony + lantern beam
    luigi = makeLuigi();
    group.add(put(luigi.g, LUIGI_SPOT.s, LUIGI_SPOT.l, bal.top));
    luigi.base = luigi.g.quaternion.clone();
    beam = H.makeBeam(0xfff0b0, 90);
    beam.material.opacity = 0;
    beam.scale.set(2.5, 1, 2.5);
    group.add(put(beam, LUIGI_SPOT.s, LUIGI_SPOT.l, bal.top));

    cart = makeCart();
    group.add(put(cart, LAYOUT.cart.s + 25, LAYOUT.cart.l, 0));
    cart.visible = false;

    // ---------- enemies ----------
    goomba = makeGoomba(); group.add(goomba.g);
    koopa = makeKoopa(); group.add(koopa.g); group.add(koopa.shadow);

    // a few soft clouds well away from the path
    const cloudM = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, transparent: true, opacity: 0.8, flatShading: true });
    for (let i = 0; i < 26; i++) {
      const c = new THREE.Group();
      for (let k = 0; k < 4; k++) add(c, new THREE.Mesh(new THREE.IcosahedronGeometry(2.4 + rand() * 2, 0), cloudM), (k - 1.5) * 3, rand(), rand() * 2);
      const s = -40 + rand() * 260, l = (rand() < 0.5 ? -1 : 1) * (35 + rand() * 60);
      group.add(put(c, s, l, 45 + rand() * 35));
    }
  }

  // ============================================================
  // runtime
  // ============================================================
  const tmpV = new V3();
  function angDiff(a, b) { let d = (a - b) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; return d; }

  function reset() {
    S.t = 0; S.rescueCount = 0; S.splits = [];
    S.cp = 0;
    S.blades = { angle: 0.5, w: TUNE.mill.bladeSpeed, state: "spin", heldT: 0 };
    S.rescued = false; S.rescueT = 0; S.locked = false; S.climb = null;
    S.hints = {};
    S.fade = 0;
    S.climbReady = false;
    S.puncherT = 0;
    brake.engaged = false;
    crateSolidReset();
    initEnemies();
    if (cart) { cart.visible = false; put(cart, LAYOUT.cart.s + 25, LAYOUT.cart.l, 0); }
    if (planet && planet.gate) planet.gate.holder.visible = false;
    if (luigi) { luigi.g.quaternion.copy(luigi.base); put(luigi.g, LUIGI_SPOT.s, LUIGI_SPOT.l, bal.top); luigi.g.visible = true; luigi.g.scale.setScalar(1.15); }
    ladderGlow.forEach(r => { r.material.emissiveIntensity = 0.35; });
  }
  function crateSolidReset() { crateSolid.gone = false; if (crateMesh) crateMesh.visible = true; }

  // Orient so that local +Z faces direction f (an enemy's front).
  function faceObj(obj, dir, f) {
    const r = new V3().crossVectors(dir, f).normalize();          // local +X
    obj.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(r, dir, f));
  }

  function newEnemy(kind) {
    const e = { kind, state: "idle", t: 0, dead: false, pos: new V3(), fwd: new V3(), dirLock: new V3(), anchor: new V3(), h: 0 };
    return e;
  }
  function initEnemies() {
    const gp = worldPos(LAYOUT.goomba.s, LAYOUT.goomba.l, 0).sub(center);
    S.goomba = newEnemy("goomba");
    S.goomba.pos.copy(gp).normalize().multiplyScalar(R);
    S.goomba.anchor.copy(S.goomba.pos);
    S.goomba.fwd.copy(GameShared.projectTangent(T.clone().negate(), gp.clone().normalize()));
    if (goomba) { goomba.g.visible = true; goomba.g.scale.set(1, 1, 1); goomba.bang.visible = false; }
    const kp = worldPos(LAYOUT.koopa.s, LAYOUT.koopa.l, 0).sub(center);
    S.koopa = newEnemy("koopa");
    S.koopa.pos.copy(kp).normalize().multiplyScalar(R);
    S.koopa.anchor.copy(S.koopa.pos);
    S.koopa.fwd.copy(GameShared.projectTangent(T.clone().negate(), kp.clone().normalize()));
    S.koopa.h = 6.5; S.koopa.target = new V3();
    if (koopa) { koopa.g.visible = true; koopa.shadow.material.opacity = 0; koopa.shadow.visible = true; }
  }

  function snap(v, h) { return v.normalize().multiplyScalar(R + (h || 0)); }

  function updateGoomba(dt, P, ctx) {
    const e = S.goomba; if (!e || e.dead && e.t > 0.5) { if (goomba) goomba.g.visible = false; return; }
    e.t += dt;
    const up = e.pos.clone().normalize();
    const mp = P.pos.clone().sub(center);
    const toM = GameShared.projectTangent(mp.clone().sub(e.pos), up);
    const dist = mp.distanceTo(e.pos);
    const body = goomba.body, bang = goomba.bang;
    if (e.dead) {
      goomba.g.scale.set(1.3, Math.max(0.1, 0.35 - e.t * 0.3), 1.3);
    } else if (e.state === "idle") {
      // wander in a small circle around the anchor
      const a = ctx.t * 0.6;
      const sway = GameShared.projectTangent(new V3(Math.cos(a), 0.2, Math.sin(a)), up).multiplyScalar(0.8 * dt * 2);
      e.pos.add(sway); e.fwd.copy(sway.lengthSq() ? GameShared.projectTangent(sway, up) : e.fwd);
      if (e.pos.distanceTo(e.anchor) > 3) e.pos.lerp(e.anchor, 0.05);
      snap(e.pos, 0);
      body.position.y = 0;
      if (dist < TUNE.goomba.sightRange && Math.abs(ctx.heightOf(P) - 0) < 3) { e.state = "alert"; e.t = 0; env.Audio.tone(900, 0.2, "square", 0.1); }
    } else if (e.state === "alert") {
      e.fwd.copy(toM); bang.visible = true; bang.position.y = 2.1 + Math.sin(e.t * 20) * 0.1;
      body.position.y = Math.abs(Math.sin(e.t * 10)) * 0.4;
      if (e.t > TUNE.goomba.warnTime) { e.state = "charge"; e.t = 0; e.dirLock.copy(toM); bang.visible = false; }
    } else if (e.state === "charge") {
      e.fwd.copy(e.dirLock);
      e.pos.addScaledVector(e.dirLock, TUNE.goomba.chargeSpeed * dt); snap(e.pos, 0);
      body.position.y = Math.abs(Math.sin(e.t * 22)) * 0.18;
      if (e.t > TUNE.goomba.chargeTime) { e.state = "recover"; e.t = 0; }
    } else if (e.state === "recover") {
      body.position.y = 0; body.rotation.z = Math.sin(e.t * 14) * 0.18;
      if (e.t > TUNE.goomba.recoverTime) { body.rotation.z = 0; e.state = dist < TUNE.goomba.sightRange ? "alert" : "idle"; e.t = 0; }
    }
    const upN = e.pos.clone().normalize();
    goomba.g.position.copy(e.pos); faceObj(goomba.g, upN, GameShared.projectTangent(e.fwd, upN));
    if (e.dead) return;
    // contact: stomp from above defeats it, anything else hurts
    const hm = ctx.heightOf(P);
    if (dist < 1.25 && hm < 1.4) {
      if (P.vel.dot(upN) < -1 && hm > 0.5) { defeat(e, goomba, P, upN); P.vel.addScaledVector(upN, 9 - P.vel.dot(upN)); P.airJumps = 1; }
      else if (e.state === "charge" || e.state === "alert") ctx.hurt(mp.clone().sub(e.pos));
    }
  }
  function defeat(e, mesh, P, up) {
    e.dead = true; e.t = 0; e.state = "dead";
    env.Audio.collect();
    env.Particles.spawn(e.pos.clone().add(center).addScaledVector(up, 0.8), 0xffd76a, 18, 3.5);
    if (mesh.bang) mesh.bang.visible = false;
  }

  function updateKoopa(dt, P, ctx) {
    const e = S.koopa; if (!e) return;
    if (e.dead) { if (e.t < 0.9) { e.t += dt; koopa.g.position.addScaledVector(e.pos.clone().normalize(), -dt * 2); koopa.g.scale.setScalar(Math.max(0.05, 1 - e.t)); } else koopa.g.visible = false; koopa.shadow.visible = false; return; }
    e.t += dt;
    const up = e.pos.clone().normalize();
    const mp = P.pos.clone().sub(center);
    const mUp = mp.clone().normalize();
    const flat = mp.clone().sub(e.pos); const dist = flat.length();
    const fl = GameShared.projectTangent(flat, up);
    const sh = koopa.shadow;
    let flap = 6;
    if (e.state === "idle") {            // hover in a slow circle
      const a = ctx.t * 0.7;
      const off = GameShared.projectTangent(new V3(Math.cos(a), 0.3, Math.sin(a)), up).multiplyScalar(3.5);
      const tgt = e.anchor.clone().add(off); snap(tgt, 0);
      e.pos.lerp(tgt, Math.min(1, dt * 1.5)); snap(e.pos, 0);
      e.h += (6.5 - e.h) * Math.min(1, dt * 3);
      e.fwd.copy(GameShared.projectTangent(off.clone().applyAxisAngle(up, 1.4), up));
      sh.material.opacity += (0.12 - sh.material.opacity) * Math.min(1, dt * 3);
      if (dist < 17 && ctx.heightOf(P) < 8) { e.state = "track"; e.t = 0; }
    } else if (e.state === "track") {     // follow Mario overhead; the shadow marks the ground below
      e.pos.addScaledVector(fl, Math.min(dist, 6 * dt)); snap(e.pos, 0);
      e.fwd.copy(fl);
      sh.material.opacity += (0.35 - sh.material.opacity) * Math.min(1, dt * 6);
      if (e.t > TUNE.koopa.trackTime) { e.state = "lock"; e.t = 0; }
      if (dist > 26) { e.state = "idle"; e.t = 0; }
    } else if (e.state === "lock") {      // shadow stops and flashes: the warning
      sh.material.opacity = 0.45 + 0.25 * Math.sin(e.t * 30);
      flap = 14;
      if (e.t > TUNE.koopa.telegraphTime) { e.state = "dive"; e.t = 0; }
    } else if (e.state === "dive") {
      e.h = Math.max(0.2, 6.5 * (1 - e.t / TUNE.koopa.diveTime));
      flap = 2;
      if (e.t >= TUNE.koopa.diveTime) {
        e.state = "grounded"; e.t = 0; e.h = 0.2;
        env.Particles.spawn(e.pos.clone().add(center).addScaledVector(up, 0.3), 0xffffff, 10, 2.5);
        if (dist < 1.9 && ctx.heightOf(P) < 1.6) ctx.hurt(mp.clone().sub(e.pos));
        env.Audio.land();
      }
    } else if (e.state === "grounded") {  // dazed on the ground: the safe moment to punch it
      sh.material.opacity *= 0.9; flap = 0;
      if (e.t > TUNE.koopa.dazedTime) { e.state = "rise"; e.t = 0; }
    } else if (e.state === "rise") {
      e.h = Math.min(6.5, e.h + dt * 7);
      if (e.h >= 6.5) { e.state = "idle"; e.t = 0; }
    }
    const upN = e.pos.clone().normalize();
    koopa.g.position.copy(e.pos).addScaledVector(upN, e.h);
    faceObj(koopa.g, upN, GameShared.projectTangent(e.fwd, upN));
    for (const w of koopa.wings) w.w.rotation.z = w.sx * Math.sin(ctx.t * flap) * 0.7;
    koopa.body.rotation.z = e.state === "grounded" ? Math.sin(e.t * 12) * 0.12 : 0;
    // ground shadow, lying flat on the surface
    sh.position.copy(e.pos).addScaledVector(upN, 0.12);
    faceObj(sh, upN, GameShared.projectTangent(e.fwd, upN));
    sh.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(new V3(1, 0, 0), -Math.PI / 2));
    // diving body hurts on the way down
    if (e.state === "dive") {
      const body = koopa.g.position.clone();
      if (body.distanceTo(mp) < 1.3) ctx.hurt(mp.clone().sub(e.pos));
    }
    // touch while hovering low
    if (e.state !== "dive" && e.h < 2 && e.state !== "grounded" && koopa.g.position.distanceTo(mp) < 1.2) ctx.hurt(mp.clone().sub(e.pos));
  }

  // Aim assist: if something punchable is close and roughly in front, turn the punch toward it.
  function aim(P, dir, up) {
    const mp = P.pos.clone().sub(center);
    let best = null, bestD = 4.6;
    const consider = (local, ok) => {
      if (!ok) return;
      const d = local.distanceTo(mp);
      if (d >= bestD) return;
      const to = GameShared.projectTangent(local.clone().sub(mp), up);
      if (to.dot(dir) < -0.2) return;
      best = to; bestD = d;
    };
    if (S.goomba && !S.goomba.dead && goomba) consider(S.goomba.pos, true);
    if (S.koopa && !S.koopa.dead && koopa) consider(S.koopa.pos, S.koopa.h < 2.2);
    if (lever && S.blades.state === "spin" && !S.rescued) consider(lever.g.position, true);
    if (!crateSolid.gone && crateMesh) consider(crateMesh.position, true);
    return best || dir;
  }

  // ---- punch: called once per punch at the impact moment ----
  function punchHit(P, fwd, up) {
    const origin = P.pos.clone().addScaledVector(up, 0.9).addScaledVector(fwd, 1.2);
    let hit = 0;
    const loc = origin.clone().sub(center);
    // crate
    if (!crateSolid.gone && crateMesh) {
      const cw = crateMesh.getWorldPosition(new V3());
      if (cw.distanceTo(origin) < 2.4) {
        crateSolid.gone = true; crateMesh.visible = false; hit++;
        env.Particles.spawn(cw, 0xd9a35c, 22, 4); env.Audio.bossHit();
        env.toast("Smash!", 900);
      }
    }
    // enemies
    if (S.goomba && !S.goomba.dead && goomba) {
      const gw = goomba.g.getWorldPosition(new V3());
      if (gw.distanceTo(origin) < 2.8) { defeat(S.goomba, goomba, P, gw.clone().sub(center).normalize()); hit++; env.Audio.bossHit(); }
    }
    if (S.koopa && !S.koopa.dead && koopa && S.koopa.h < 2.2) {
      const kw = koopa.g.getWorldPosition(new V3());
      if (kw.distanceTo(origin) < 2.8) {
        const e = S.koopa; e.dead = true; e.t = 0; hit++; env.Audio.bossHit();
        env.Particles.spawn(kw, 0x7fe08a, 18, 4);
      }
    }
    // brake lever
    if (lever && S.blades.state !== "held" && !S.rescued) {
      const kw = lever.knob.getWorldPosition(new V3());
      if (kw.distanceTo(origin) < 2.6 && S.blades.state === "spin") {
        S.blades.state = "braking"; brake.engaged = true; hit++;
        env.Audio.bossHit();
        env.Particles.spawn(kw, 0xff6a4a, 12, 3);
      }
    }
    return hit;
  }

  // ---- windmill ----
  function updateMill(dt, P, ctx) {
    const b = S.blades;
    if (b.state === "spin") { b.w += (TUNE.mill.bladeSpeed - b.w) * Math.min(1, dt * 1.2); }
    else if (b.state === "braking") {
      b.w *= Math.exp(-dt * 5);
      if (b.w < 0.01) {
        b.w = 0; b.state = "stopped"; b.heldT = 0;
        const d = Math.abs(angDiff(b.angle, Math.PI)) * 180 / Math.PI;       // ladder blade vs pointing straight down
        S.ladderOff = d;
        if (d <= TUNE.mill.stopWindowDeg) {
          S.climbReady = true;
          ladderGlow.forEach(r => { r.material.emissiveIntensity = 1.4; });
          ctx.hint("The ladder blade stopped. Walk up to its glowing end.", 6000);
          ctx.Audio.gate();
        } else {
          ctx.toast("Wrong blade!", 1600);
          ctx.hint("Only the blade with the glowing ladder reaches Luigi.\nThe brake will slip. Try again at the lever.", 5000);
        }
      }
    } else if (b.state === "stopped" && !S.climbReady) {
      b.heldT += dt;
      if (b.heldT > TUNE.mill.brakeSlip) { b.state = "spin"; brake.engaged = false; b.w = 0.1; ctx.Audio.tone(300, 0.3, "sawtooth", 0.08, 160); }
    }
    b.angle += b.w * dt;
    for (const bl of blades) bl.g.rotation.z = -(b.angle + bl.index * Math.PI / 2);
    // lever pose follows the shared brake state
    const target = brake.engaged ? 0.75 : -0.5;
    lever.angle += (target - lever.angle) * Math.min(1, dt * 10);
    lever.stick.rotation.z = lever.angle;

    // climb trigger: walk to the lower end of the ladder blade
    if (S.climbReady && !S.locked && !S.rescued) {
      const th = b.angle;
      const tipL = mill.bladeLen * Math.sin(th), tipH = mill.hubH + mill.bladeLen * Math.cos(th);
      const base = worldPos(mill.hubS - 0.6, tipL, 0);
      if (P.pos.distanceTo(base) < 3.4 && ctx.heightOf(P) < 3) {
        S.locked = true;
        S.climb = { t: 0, dur: 2.8, tipL, tipH };
        ctx.hint("", 1);
      }
    }
  }

  // Mario lands near the open (blade) end of the balcony, Luigi stands deeper in; seen from
  // the +l end both stay visible side by side instead of one hiding the other.
  function balconyLanding() { return { s: bal.s0 + 0.9, l: bal.l0 + 1.4 }; }
  function climbPoint(c, k) {
    // 0..0.7 up the ladder blade; 0.7..1 hop onto the balcony
    const hubL = 0, hubH = mill.hubH;
    const e = smooth(0, 1, k);
    if (k < 0.7) {
      const u = k / 0.7;
      return { s: mill.hubS - 0.6, l: c.tipL * (1 - u) + hubL * u, h: c.tipH * (1 - u) + (hubH - 0.2) * u };
    }
    const u = smooth(0, 1, (k - 0.7) / 0.3), hop = Math.sin(u * Math.PI) * 1.6;
    const land = balconyLanding(), bs = land.s, bl = land.l;
    return { s: mill.hubS - 0.6 + (bs - mill.hubS + 0.6) * u, l: hubL + (bl - hubL) * u, h: hubH - 0.2 + (bal.top - hubH + 0.2) * u + hop };
  }
  function scripted(dt, P, hooks) {
    const c = S.climb; if (!c) { S.locked = false; return; }
    c.t += dt;
    const k = clamp(c.t / c.dur, 0, 1);
    const p = climbPoint(c, k);
    const wp = worldPos(p.s, p.l, p.h);
    P.pos.copy(wp); P.vel.set(0, 0, 0);
    const up = wp.clone().sub(center).normalize();
    P.up.copy(up);
    P.face.copy(GameShared.projectTangent(T, up));
    P.grounded = true; P.airJumps = 1;
    P.climbing = k < 0.7;
    if (k >= 1) {
      S.locked = false; S.climb = null; P.climbing = false;
      startRescue(P, hooks);
    }
  }

  function startRescue(P, hooks) {
    if (S.rescued) return;
    S.rescued = true; S.rescueT = 0; S.rescueCount = (S.rescueCount || 0) + 1;
    split("rescue");
    hooks.toast("Luigi!", 2400);
    hooks.hint("You found Luigi! Something with the letters DK rolled in below.", 7000);
    env.Audio.victory();
    env.Particles.spawn(luigi.g.getWorldPosition(new V3()).add(new V3(0, 2, 0)), 0xffe08a, 40, 5);
  }

  // balcony landing also counts (double jump from the ladder top, or any route that gets there)
  function checkBalcony(P, ctx) {
    if (S.rescued || S.locked) return;
    const u = tmpV.copy(P.pos).sub(center).normalize();
    const c = coordsOf(u), h = ctx.heightOf(P);
    if (h > bal.top - 0.6 && h < bal.top + 3 && c.s > bal.s0 - 0.5 && c.s < bal.s1 + 0.5 && c.l > bal.l0 - 0.5 && c.l < bal.l1 + 0.5) startRescue(P, ctx);
  }

  function updateRescue(dt, P, ctx) {
    if (!S.rescued) return;
    S.rescueT += dt;
    const t = S.rescueT;
    // Luigi turns to face Mario, waves, then joins him at the cart
    const lw = luigi.g.getWorldPosition(new V3());
    const up = lw.clone().sub(center).normalize();
    if (t < 3.2) {
      const toM = GameShared.projectTangent(P.pos.clone().sub(lw), up);
      faceObj(luigi.g, up, toM);
      luigi.armR.rotation.z = Math.PI * 0.8 + Math.sin(t * 9) * 0.3;
      luigi.g.position.y += 0;
    } else if (t < 5.4) {
      const k = smooth(0, 1, (t - 3.2) / 2.2);
      const from = localPos(LUIGI_SPOT.s, LUIGI_SPOT.l, bal.top), to = localPos(LAYOUT.cart.s - 2, LAYOUT.cart.l + 3, 0);
      const mid = from.clone().lerp(to, k);
      const arc = Math.sin(k * Math.PI) * 6;
      luigi.g.position.copy(mid).addScaledVector(mid.clone().normalize(), arc);
      luigi.armR.rotation.z = 0.3;
    }
    if (t > 1.5 && !cart.visible) { cart.visible = true; }
    if (cart.visible) {
      const k = smooth(0, 1, (t - 1.5) / 3.0);
      put(cart, LAYOUT.cart.s + 25 * (1 - k), LAYOUT.cart.l, 0);
    }
    if (t > 5.4 && planet.gate && !planet.gate.holder.visible) {
      planet.gate.holder.visible = true;
      env.Audio.gate();
      ctx.toast("Luigi joins the journey!", 2600);
      ctx.hint("Follow the DK cart's light to the gate.", 6000);
    }
  }

  // ---- lantern: one long flash, then two short ones ----
  function updateLantern(t) {
    const ph = (t % 6);
    const on = ph < 1.0 || (ph > 1.5 && ph < 1.8) || (ph > 2.2 && ph < 2.5);
    const lit = S.rescued ? 0.25 : (on ? 1 : 0);
    const night = (GameShared.sky && GameShared.sky.night) || 0;   // the signal is at its best in the dark
    beam.material.opacity += ((on && !S.rescued ? 0.55 + 0.35 * night : (S.rescued ? 0.08 : 0)) - beam.material.opacity) * 0.35;
    lanternGlow.material.opacity += (lit * (0.7 + 0.3 * night) - lanternGlow.material.opacity) * 0.4;
    lanternGlow.scale.setScalar(1 + 0.8 * night);
    luigi.bulb.material.opacity = 0.35 + lit * 0.65;
  }

  function updateFlags(t) {
    for (const f of flags) {
      const dirW = wind.direction;
      const fr = frameAt(f.g.position.clone().normalize());
      // wind direction in the flag's local XZ plane (+X right, +Z back)
      const lx = dirW.dot(fr.r), lz = dirW.dot(fr.f.clone().negate());
      const ang = Math.atan2(-lz, lx);
      f.hub.rotation.y = ang;
      const droop = (1 - clamp(wind.strength / 1.4, 0, 1)) * 1.05;
      f.cloth.rotation.z = -droop;
      const a = f.cloth.geometry.attributes.position, base = f.base;
      for (let i = 0; i < a.count; i++) {
        const x = base[i * 3];
        a.setZ(i, Math.sin(t * (3 + wind.strength * 4) - x * 3) * 0.14 * (x / 2.0) * (0.4 + wind.strength));
      }
      a.needsUpdate = true;
    }
  }

  // ---- hints: shown once, when Mario first gets near ----
  function updateHints(P, ctx, s, l) {
    const once = (k, cond, text, ms) => { if (!S.hints[k] && cond) { S.hints[k] = true; ctx.hint(text, ms || 6500); } };
    once("punch", s > 14 && s < 30, ctx.isTouch ? "Tap Punch to smash the crate." : "Press J (or F) to punch the crate.");
    once("goomba", s > 28 && s < 40 && !S.goomba.dead, "A goomba! It charges in a straight line. Step aside, then punch it.");
    once("double", s > 36 && s < 48, "Jump, then jump again in the air to reach the stone.");
    once("koopa", s > 44 && s < 56 && !S.koopa.dead, "A koopa is watching. Its shadow shows where it will dive.");
    once("trench", s > 52 && s < 64, "Don't worry about the gap. The net will catch you.");
    once("wind", s > 62 && s < 76, "The flags show the wind. It pushes you sideways when you jump.");
    once("bridge", s > 88 && s < 100, "The bridge is broken. Jump, then jump again in the air.");
    once("lever", s > 120 && s < 130, "Punch the red lever to stop the windmill. Stop the blade with the glowing ladder.", 8000);
  }

  // ---- main update ----
  // split times per route segment (game time, so pauses do not count): landing -> training ->
  // bridge -> windmill -> rescue. Shown in the tuning panel for the child test (#8).
  function split(name) {
    if (S.splits.some(x => x.name === name)) return;
    const prev = S.splits.length ? S.splits[S.splits.length - 1].t : 0;
    S.splits.push({ name, t: S.t, seg: S.t - prev });
  }
  function checkpointUpdate(P, ctx, s, l) {
    if (!ctx.grounded || s < -50) return;
    const cps = LAYOUT.checkpoints;
    for (let i = cps.length - 1; i > S.cp; i--) {
      if (s >= cps[i].s && Math.abs(l) < 8 && ctx.heightOf(P) > -0.5 && s < cps[i].s + 30) { S.cp = i; split(cps[i].name); break; }
    }
  }
  function respawn(P, hooks, hurtRestore) {
    const cp = LAYOUT.checkpoints[S.cp];
    const pos = worldPos(cp.s, cp.l, 0.05);
    const up = pos.clone().sub(center).normalize();
    hooks.teleport(pos, GameShared.projectTangent(T, up));
    if (hurtRestore) hooks.restoreHealth();
    hooks.fade();
  }

  // night: markers, tower windows, the koopa's ring and the ladder brighten as the light goes
  function updateNight() {
    const night = (GameShared.sky && GameShared.sky.night) || 0;
    if (markerMat) { markerMat.emissiveIntensity = 0.4 + 1.6 * night; markerHalo.opacity = 0.04 + 0.4 * night; }
    if (windowMat) windowMat.emissiveIntensity = 0.1 + 1.3 * night;
    if (pathMat) pathMat.emissiveIntensity = 0.16 * night;      // the route stays a lighter band in the dark
    if (koopa && koopa.ring) koopa.ring.material.opacity = Math.min(1, koopa.shadow.material.opacity * (0.25 + 1.8 * night));
  }

  function update(dt, ctx) {
    const P = ctx.P;
    S.t += dt;
    windAt(P.up, ctx.t);
    updateFlags(ctx.t);
    updateSails(ctx.t);
    updateNight();
    grassU.uTime.value = ctx.t; grassU.uWind.value = Math.min(1.6, wind.strength);
    updateLantern(ctx.t);
    if (!S.locked) { updateGoomba(dt, P, ctx); updateKoopa(dt, P, ctx); }
    updateMill(dt, P, ctx);
    updateRescue(dt, P, ctx);
    const u = tmpV.copy(P.pos).sub(center).normalize();
    const c = coordsOf(u);
    updateHints(P, ctx, c.s, c.l);
    checkpointUpdate(P, ctx, c.s, c.l);
    checkBalcony(P, ctx);
    // fell into the canyon: back to the last checkpoint, no penalty
    if (ctx.heightOf(P) < LAYOUT.fallRespawn && !S.locked) {
      ctx.toast("Whoa! Back to the flag.", 1400);
      respawn(P, ctx, false);
    }
  }

  // rope railings: stay on the planks while walking, not while jumping
  function constrain(P, curH) {
    if (S.locked) return;
    const u = tmpV.copy(P.pos).sub(center).normalize();
    const c = coordsOf(u);
    const onA = c.s >= LAYOUT.bridgeA[0] + 0.5 && c.s <= LAYOUT.bridgeA[1];
    const onB = c.s >= LAYOUT.bridgeB[0] && c.s <= LAYOUT.bridgeB[1] - 0.5;
    if ((onA || onB) && P.grounded && curH > plankTop - 0.3 && curH < plankTop + 0.4) {
      const lim = bridgeHalf - 0.3;
      if (Math.abs(c.l) > lim) {
        const l = clamp(c.l, -lim, lim);
        P.pos.copy(worldPos(c.s, l, curH));
        const up = P.up; const out = P.vel.dot(B) * Math.sign(c.l);
        if (out > 0) P.vel.addScaledVector(B, -P.vel.dot(B));
      }
    }
    // world edge: a gentle wall far off the route
    if (Math.abs(c.l) > 100) {
      const l = clamp(c.l, -100, 100);
      P.pos.copy(worldPos(c.s, l, curH));
      P.vel.addScaledVector(B, -P.vel.dot(B));
    }
  }

  // ---- camera support ----
  // On the balcony the right-hand blade hangs between a camera in front of the mill and Mario,
  // and the tower fills the space behind him. Look along the balcony from its open (+l) end,
  // so the camera sits outside the blade plane and clear of the tower.
  function onBalcony(P) {
    const u = tmpV.copy(P.pos).sub(center);
    const h = u.length() - R; u.normalize();
    const c = coordsOf(u);
    return h > bal.top - 1.5 && c.s > bal.s0 - 1 && c.s < bal.s1 + 1 && c.l > bal.l0 - 1.5 && c.l < bal.l1 + 1;
  }
  function cameraHint(P) {
    if (!onBalcony(P)) return null;
    return GameShared.projectTangent(B.clone().negate(), tmpV.copy(P.pos).sub(center).normalize());
  }

  // Height (above the base sphere) of the first surface under a world point, for the camera.
  // Terrain comes from terrainH, the same function the mesh and the physics use. A solid counts
  // when the point is not below its underside (so the space under the balcony stays free).
  const _cu = new V3();
  function cameraFloor(pos) {
    _cu.copy(pos).sub(center);
    const h = _cu.length() - R; _cu.normalize();
    const c = coordsOf(_cu);
    let f = terrainH(c.s, c.l);
    for (const o of solids) {
      if (o.gone || h < o.bottom - 0.3 || !inFoot(o, c.s, c.l)) continue;
      if (o.top > f) f = o.top;
    }
    return { floor: f, h };
  }

  // Soft framing at the brake lever (issue #5 frame 3): lever low in the frame, the ladder blade in
  // the middle and Luigi on the balcony, together. The follow camera backs off a few units and
  // aims part of the way toward the hub; the player keeps yaw, pitch and zoom.
  function cameraFocus(P) {
    if (S.rescued || S.locked) return null;
    const u = tmpV.copy(P.pos).sub(center).normalize();
    const c = coordsOf(u);
    if (c.s < 114 || c.s > 128.5 || Math.abs(c.l) > 15) return null;
    const w = smooth(114, 118, c.s) * (1 - smooth(126, 128.5, c.s)) * (1 - smooth(11, 15, Math.abs(c.l)));
    return { point: worldPos(mill.hubS, (bal.l0 + bal.l1) / 2, mill.hubH * 0.9), weight: w };
  }

  // Fixed framings for the scripted parts of the mill. Returns { pos, look } in world space, or null.
  // Climb: from the front-left of the mill, below the hub, so neither the left blade nor the
  // tower can come between camera and Mario. Rescue: from the open end of the balcony,
  // on the tower side of the blade plane, looking back across Mario to Luigi.
  function cameraShot(P) {
    const ph = P.pos.distanceTo(center) - R;
    if (S.locked && S.climb) {
      const k = clamp(S.climb.t / S.climb.dur, 0, 1);
      if (k < 0.7) {
        const camH = clamp(ph + 2.5, 4, bal.top + 3);
        return { pos: worldPos(mill.hubS - 13, -7, camH), look: P.pos.clone().addScaledVector(P.up, 0.9), kind: "climb" };
      }
    }
    if ((S.locked && S.climb) || (S.rescued && S.rescueT < 5.6 && onBalcony(P))) {
      const land = balconyLanding();
      return { pos: worldPos(bal.s0 + 0.4, bal.l1 + 6, bal.top + 4.8),
        look: worldPos(land.s + (LUIGI_SPOT.s - land.s) * 0.4, land.l + (LUIGI_SPOT.l - land.l) * 0.4, bal.top + 1.0), kind: "rescue" };
    }
    return null;
  }

  function objective() {
    if (S.rescued) return S.rescueT > 5.4 ? "Luigi is safe! Enter the gate" : "Luigi is safe!";
    if (S.climbReady) return "Climb the ladder to Luigi";
    return "Find Luigi's lantern";
  }

  // ---- debug / test access ----
  const debug = {
    get state() { return S; }, layout: LAYOUT,
    coordsOf: (p) => coordsOf(p.clone().sub(center).normalize()),
    worldPos, query, dirAt,
    get enemies() { return { goomba: S.goomba, koopa: S.koopa }; },
    mill: () => ({ angle: S.blades.angle, w: S.blades.w, state: S.blades.state, ladderOff: S.ladderOff, climbReady: S.climbReady }),
    setBladeAngle(a) { S.blades.angle = a; },
    get crateGone() { return !!crateSolid.gone; },
    get splits() { return S.splits || []; },
    get rescueCount() { return S.rescueCount || 0; },
    get gateOpen() { return !!(planet && planet.gate && planet.gate.holder.visible); },
    get checkpoint() { return LAYOUT.checkpoints[S.cp].name; },
    leverPos() { return lever.g.position.clone().add(center); },
    bladeBase() { const th = S.blades.angle; return worldPos(mill.hubS - 0.6, mill.bladeLen * Math.sin(th), 0); },
    cameraShot: (P) => cameraShot(P)
  };

  function attach(e) { env = e; reset(); }

  return {
    configure, shapeGround, exitDir, build, attach, reset, update, query, drift, constrain,
    punchHit, aim, scripted, objective, debug, colliders, cameraHint, cameraFloor, cameraShot, cameraFocus,
    respawn: (P, hooks, restoreHealth) => respawn(P, hooks, restoreHealth),
    isLocked: () => S.locked,
    get layout() { return LAYOUT; }
  };
})();
