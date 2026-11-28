"use strict";

/* ============================================================
   Furnace Moon - star 4, the last one (issue #21). Story: game-design/four-planets.md.
   The smallest star. From the rim of the landing crater the whole of it shows:
   a lava lake, three low volcanoes and the villain's citadel. Both fights happen
   on two sides of the same crater.
   Route (arc length `s` from the landing, `l` positive to the right):
     s   0        landing on the crater rim; the friends land with the hero
     s   4..17    down the rim; the young villain rolls paint balls down the side slope
     s  18..42    the lava lake and three basalt bridges he painted; only the real one
                  is reflected in the lava
     s  44..56    the far shore: coins, and the shrine that sells the deflect punch (8 coins)
     s  58..80    fight 1: he swings his brush and rolls a paint ball down the slope;
                  a punch sends it back, the paint covers his eyes, punch him (3 times)
     s  81        a paint wall, gone once he flees
     s  86..124   fight 2: the villain breaks the rim and locks the friends in basalt cages.
                  Stand by a cage and dodge his charge so he cracks it; a power punch frees
                  the friend. Each friend helps: the brother lights the shaded crater, the
                  mushroom friend finds the fire mushroom, the dinosaur pulls it over the lava,
                  the big ape lifts slabs with coins (9 coins: the dash). Last round: eat the
                  fire mushroom, cross the ring of fire, jump the shockwave and dash into him
     s 130        the crater edge: the young villain hangs there; reach out to him
   Characters are GLB/glTF models (js/models.js) with stand-ins.
   ============================================================ */
const FurnaceMoon = (() => {
  const V3 = THREE.Vector3;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const smooth = (a, b, x) => { const k = clamp((x - a) / (b - a), 0, 1); return k * k * (3 - 2 * k); };
  const band = (s, a, b, w) => smooth(a, a + w, s) * (1 - smooth(b - w, b, s));

  const LAYOUT = {
    lake: { s0: 18, s1: 42 },
    bridges: [{ l: -9 }, { l: 0 }, { l: 9 }], realBridge: 0, bridgeHalf: 1.5,
    slope: { s0: 4, s1: 17, jr: { s: 11, l: -17 }, from: -14, to: 15 },
    shoreCoins: [[45, -4], [46.5, 3], [48, -1], [49.5, 5], [51, -5], [52, 1.5], [53.5, -2.5], [54.5, 4]],
    shrine: { s: 56, l: 7, cost: 8 },
    pillar: { s: 77, l: 0, r: 1.8, top: 9 },
    jrLand: { s: 72.5, l: 0 },
    wall: { s: 81 },
    arena: { s: 103, l: 0 },
    cages: [{ s: 95, l: -9, who: "luigi" }, { s: 95, l: 9, who: "dk" }, { s: 111, l: -9, who: "toad" }, { s: 111, l: 9, who: "yoshi" }],
    channel: { s0: 108, s1: 124, l0: -15.5, l1: -12.5 },
    shade: { s: 116, l: -19.5, r: 4.5 },
    shrooms: [{ s: 113.5, l: -19 }, { s: 116, l: -20.5 }, { s: 118.5, l: -19 }], fireShroom: 1,
    bank: { s: 116, l: -10.5 },
    slabs: [{ s: 90, l: 15 }, { s: 103, l: 17 }, { s: 116, l: 15 }], dashCost: 9,
    fireRing: 6.5,
    edge: { s: 130.3, l: 0 }, chasm: { s0: 131, s1: 139 },
    citadel: { s: 147, l: 0 },
    edgeL: 28, voidBelow: -2.5, fallRespawn: -1.4,
    checkpoints: [
      { name: "landing", s: 0, l: 0 }, { name: "shore", s: 44, l: 0 }, { name: "arena", s: 59, l: 0 },
      { name: "crater", s: 86, l: 0 }
    ]
  };

  // ---- sphere frame (same as the other levels) ----
  let R = 100, center = new V3(), N = new V3(0, 1, 0), T = new V3(0, 0, 1), B = new V3(1, 0, 0);
  function configure(def) {
    R = def.radius; center = def.center.clone();
    N = def.spawnDir.clone().normalize();
    T = GameShared.projectTangent(new V3(0, 0, 1), N);
    B = new V3().crossVectors(T, N).normalize();
  }
  function dirAt(s, l, out) {
    const a = s / R, c = l / R, ca = Math.cos(c);
    return (out || new V3()).set(0, 0, 0).addScaledVector(N, Math.cos(a) * ca).addScaledVector(T, Math.sin(a) * ca).addScaledVector(B, Math.sin(c));
  }
  function coordsOf(dir) { return { s: Math.atan2(dir.dot(T), dir.dot(N)) * R, l: Math.asin(clamp(dir.dot(B), -1, 1)) * R }; }
  function localPos(s, l, h) { return dirAt(s, l).multiplyScalar(R + (h || 0)); }
  function worldPos(s, l, h) { return localPos(s, l, h).add(center); }
  function frameAt(dir) { const f = GameShared.projectTangent(T, dir); const r = new V3().crossVectors(f, dir).normalize(); return { r, u: dir, f }; }
  function put(obj, s, l, h) {
    const dir = dirAt(s, l), fr = frameAt(dir);
    obj.position.copy(dir).multiplyScalar(R + (h || 0));
    obj.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(fr.r, fr.u, fr.f.clone().negate()));
    return obj;
  }
  const _c = new V3();
  function coordsAt(pos) { return coordsOf(_c.copy(pos).sub(center).normalize()); }
  function heightAt(pos) { return pos.distanceTo(center) - R; }
  function faceObj(obj, up, f) { const r = new V3().crossVectors(up, f).normalize(); obj.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(r, up, f)); }
  function placeAt(obj, s, l, h, faceS, faceL) {
    const p = localPos(s, l, h), up = p.clone().normalize();
    obj.position.copy(p);
    let to = GameShared.projectTangent(localPos(faceS, faceL, h).sub(p), up);
    if (to.lengthSq() < 1e-6) to = GameShared.projectTangent(T, up);
    faceObj(obj, up, to.normalize());
  }
  const dist = (s0, l0, s1, l1) => Math.hypot(s1 - s0, l1 - l0);
  const away = (s, l, fs, fl) => GameShared.projectTangent(localPos(s, l, 0).sub(localPos(fs, fl, 0)), dirAt(s, l));

  // ---- terrain ----
  function lavaDepth(s, l) {
    const L = LAYOUT;
    let d = 6 * band(s, L.lake.s0, L.lake.s1, 1.2);
    const ch = L.channel;
    if (s > ch.s0 - 2 && s < ch.s1 + 2) d = Math.max(d, 6 * band(s, ch.s0, ch.s1, 1.5) * band(l, ch.l0, ch.l1, 0.8));
    d = Math.max(d, 14 * band(s, L.chasm.s0, L.chasm.s1, 0.8));
    return d;
  }
  function terrainH(s, l) {
    const al = Math.abs(l);
    const flat = 1 - band(s, 54, 128, 2) * (1 - smooth(20, 26, al));                  // the arenas are level
    let h = flat * (0.25 * Math.sin(s * 0.21 + l * 0.13) + 0.2 * Math.sin(l * 0.37 - s * 0.09));
    h += 3 * (1 - smooth(4, 15, s));                                                    // the landing rim
    h += 5 * smooth(6, 17, -l) * band(s, 2, 18, 3);                                     // the side slope the paint balls roll down
    h += 3 * smooth(62, 74, s) * (1 - smooth(78, 86, s));                               // fight 1: the slope below the pillar
    h += 8 * smooth(24, 34, al);                                                        // the crater walls
    h -= 1.2 * (1 - smooth(2, 4.5, dist(s, l, LAYOUT.shade.s, LAYOUT.shade.l)));        // the shaded crater
    h += 2 * smooth(138, 141, s);                                                       // the citadel's plateau
    return h - lavaDepth(s, l);
  }

  // ---- solids ----
  const solids = [];
  function addSolid(o) { solids.push(o); return o; }
  const L0 = LAYOUT;
  const bridgeSolids = L0.bridges.map(b => addSolid({ s0: L0.lake.s0 - 1, s1: L0.lake.s1 + 1, l0: b.l - L0.bridgeHalf, l1: b.l + L0.bridgeHalf, bottom: -7, top: 0.35 }));
  const pillarSolid = addSolid({ cs: L0.pillar.s, cl: L0.pillar.l, r: L0.pillar.r, bottom: -1, top: L0.pillar.top });
  const wallSolid = addSolid({ s0: L0.wall.s - 0.5, s1: L0.wall.s + 0.5, l0: -30, l1: 30, bottom: -1, top: 14 });
  const cageSolids = L0.cages.map(c => addSolid({ cs: c.s, cl: c.l, r: 1.5, bottom: -1, top: 3.4 }));
  const slabSolids = L0.slabs.map(sl => addSolid({ s0: sl.s - 1.5, s1: sl.s + 1.5, l0: sl.l - 1.5, l1: sl.l + 1.5, bottom: -1, top: 0.55 }));
  const shrineSolid = addSolid({ cs: L0.shrine.s, cl: L0.shrine.l, r: 0.9, bottom: -1, top: 1.2 });

  // the scattered basalt rocks near the walkable belt: low solids in buckets along s (filled in buildRocks)
  const rockGrid = new Map(), ROCK_CELL = 4;
  function addRock(s, l, r, top) {
    const key = Math.floor(s / ROCK_CELL);
    if (!rockGrid.has(key)) rockGrid.set(key, []);
    rockGrid.get(key).push({ cs: s, cl: l, r, top, bottom: -1 });
  }
  function rocksNear(s, fn) {
    const key = Math.floor(s / ROCK_CELL);
    for (let d = -1; d <= 1; d++) { const b = rockGrid.get(key + d); if (b) for (const o of b) fn(o); }
  }

  const STEP = 0.65;
  function inFoot(o, s, l) {
    if (o.r !== undefined) return Math.hypot(s - o.cs, l - o.cl) < o.r;
    return s >= o.s0 && s <= o.s1 && l >= o.l0 && l <= o.l1;
  }
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
    rocksNear(c.s, (o) => {
      if (!inFoot(o, c.s, c.l)) return;
      if (o.top <= curH + STEP) { if (o.top > ground) ground = o.top; }
      else blocked = true;
    });
    return { radius: isVoid ? -Infinity : R + ground, blocked, s: c.s, l: c.l, void: isVoid };
  }
  // the surface under a spot, solids included (for "is he on the ground" checks of waves and balls)
  function floorAt(s, l, h) {
    let f = terrainH(s, l);
    for (const o of solids) if (!o.gone && o.top <= h + 0.3 && o.top > f && inFoot(o, s, l)) f = o.top;
    rocksNear(s, (o) => { if (o.top <= h + 0.3 && o.top > f && inFoot(o, s, l)) f = o.top; });
    return f;
  }
  function drift() { return new V3(); }

  // ---- ground mesh ----
  const STRIP = { s0: -24, s1: 165, maxL: 46, hideS0: -20, hideS1: 161, hideL: 42, ds: 0.6, rows: 105 };
  const inHide = (c) => c.s > STRIP.hideS0 && c.s < STRIP.hideS1 && Math.abs(c.l) < STRIP.hideL;
  function shapeGround(geo) {
    const pos = geo.attributes.position, v = new V3();
    for (let i = 0; i < pos.count; i++) {
      v.set(pos.getX(i), pos.getY(i), pos.getZ(i)).normalize();
      const c = coordsOf(v);
      v.multiplyScalar(R + (inHide(c) ? -30 : terrainH(c.s, c.l)));
      pos.setXYZ(i, v.x, v.y, v.z);
    }
    pos.needsUpdate = true;
  }
  function smoothGround(geo, tint) {
    const pos = geo.attributes.position, col = geo.attributes.color, v = new V3(), c = new THREE.Color();
    const nrm = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) { v.set(pos.getX(i), pos.getY(i), pos.getZ(i)).normalize(); v.toArray(nrm, i * 3); tint(v, c); col.setXYZ(i, c.r, c.g, c.b); }
    geo.setAttribute("normal", new THREE.BufferAttribute(nrm, 3));
    col.needsUpdate = true;
  }
  function wantsSmooth() { return true; }
  function exitDir() { return dirAt(LAYOUT.edge.s - 4, 0); }   // not used: the last star has no gate

  // ============================================================
  // build
  // ============================================================
  const S = {};
  const colliders = [];
  let group = null, planet = null, H = null, env = null;
  const kitGeo = new Map(), kitMat = new Map(), mergeMats = new Set();
  function kitGeometry(key, make) { let g = kitGeo.get(key); if (!g) { g = make(); kitGeo.set(key, g); } return g; }
  function kitMaterial(color, opts) {
    if (color && color.isMaterial) return color;
    const key = color + (opts ? JSON.stringify(opts) : "");
    let m = kitMat.get(key); if (!m) { m = H.mat(color, opts); kitMat.set(key, m); mergeMats.add(m); } return m;
  }
  function box(w, h, d, color, opts) { return new THREE.Mesh(kitGeometry("b" + w + "," + h + "," + d, () => new THREE.BoxGeometry(w, h, d)), kitMaterial(color, opts)); }
  function cyl(rt, rb, h, seg, color, opts) { seg = seg || 10; return new THREE.Mesh(kitGeometry("c" + rt + "," + rb + "," + h + "," + seg, () => new THREE.CylinderGeometry(rt, rb, h, seg)), kitMaterial(color, opts)); }
  function ball(r, color, opts, w, hh) { return new THREE.Mesh(kitGeometry("s" + r + "," + (w || 12), () => new THREE.SphereGeometry(r, w || 12, hh || 9)), kitMaterial(color, opts)); }
  function add(parent, obj, x, y, z) { obj.position.set(x || 0, y || 0, z || 0); parent.add(obj); return obj; }
  function glowMesh(geo, color, opacity) {
    return new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: opacity === undefined ? 0.6 : opacity, blending: THREE.AdditiveBlending, depthWrite: false }));
  }
  let coinMat = null, lavaMat = null;

  function buildStrip() {
    const cols = Math.round((STRIP.s1 - STRIP.s0) / STRIP.ds) + 1, rows = STRIP.rows;
    const pos = new Float32Array(cols * rows * 3), colA = new Float32Array(cols * rows * 3);
    const basalt = new THREE.Color(0x3a3436), ash = new THREE.Color(0x6a5e58), crust = new THREE.Color(0x1e1414), c = new THREE.Color(), v = new V3();
    let n = 0;
    for (let j = 0; j < rows; j++) {
      const u = j / (rows - 1) * 2 - 1, l = Math.sign(u) * Math.pow(Math.abs(u), 1.4) * STRIP.maxL;
      for (let i = 0; i < cols; i++, n++) {
        const s = STRIP.s0 + i * STRIP.ds, h = terrainH(s, l);
        localPos(s, l, h).toArray(pos, n * 3);
        H.tint(dirAt(s, l, v), c);
        c.lerp(h > 3 ? ash : basalt, 0.35 + 0.1 * Math.sin(s * 0.7 + l * 0.3));
        if (h < -0.5) c.copy(crust);
        else if (lavaDepth(s, l) > 0.02) c.lerp(new THREE.Color(0x8a3a1a), 0.55);         // scorched banks
        if (dist(s, l, LAYOUT.shade.s, LAYOUT.shade.l) < LAYOUT.shade.r + 1) c.multiplyScalar(0.45);
        if (Math.abs(l) < 2.6 && h > -0.4 && (s < LAYOUT.lake.s0 || s > LAYOUT.lake.s1)) c.lerp(new THREE.Color(0x8a7a6a), 0.35 * (1 - Math.abs(l) / 2.6));   // a trodden trail
        c.toArray(colA, n * 3);
      }
    }
    const idx = [];
    for (let j = 0; j < rows - 1; j++) for (let i = 0; i < cols - 1; i++) { const a = j * cols + i, b = a + 1, d = a + cols, e = d + 1; idx.push(a, d, b, b, d, e); }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(colA, 3));
    geo.setIndex(idx); geo.computeVertexNormals();
    const nrm = geo.attributes.normal;
    if (nrm.getX(0) * pos[0] + nrm.getY(0) * pos[1] + nrm.getZ(0) * pos[2] < 0) {
      for (let k = 0; k < idx.length; k += 3) { const t = idx[k + 1]; idx[k + 1] = idx[k + 2]; idx[k + 2] = t; }
      geo.setIndex(idx); geo.computeVertexNormals();
    }
    const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }));
    m.userData.noCast = true;
    group.add(m);
  }

  // a curved sheet following the sphere (lava surfaces, reflections)
  function sheetGeo(s0, s1, l0, l1, h, ds, dl) {
    ds = ds || 1; dl = dl || 2;
    const cols = Math.max(2, Math.ceil((s1 - s0) / ds) + 1), rows = Math.max(2, Math.ceil((l1 - l0) / dl) + 1);
    const pos = [], uv = [], idx = [];
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
      const s = s0 + (s1 - s0) * i / (cols - 1), l = l0 + (l1 - l0) * j / (rows - 1);
      localPos(s, l, h).toArray(pos, pos.length); uv.push(s, l);
    }
    for (let j = 0; j < rows - 1; j++) for (let i = 0; i < cols - 1; i++) { const a = j * cols + i; idx.push(a, a + cols, a + 1, a + 1, a + cols, a + cols + 1); }
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
    const nrm = g.attributes.normal;
    if (nrm.getX(0) * pos[0] + nrm.getY(0) * pos[1] + nrm.getZ(0) * pos[2] < 0) { for (let k = 0; k < idx.length; k += 3) { const t = idx[k + 1]; idx[k + 1] = idx[k + 2]; idx[k + 2] = t; } g.setIndex(idx); g.computeVertexNormals(); }
    return g;
  }
  // Lava: one unlit shader for every lava surface, the crust drifts in the shader (no per-frame CPU work)
  function makeLavaMat() {
    return new THREE.ShaderMaterial({
      uniforms: { time: { value: 0 } },
      vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
      fragmentShader: [
        "uniform float time; varying vec2 vUv;",
        "void main(){",
        "  vec2 p = vUv * 0.35;",
        "  float n = sin(p.x * 3.1 + time * 0.6) * sin(p.y * 2.3 - time * 0.4) + 0.5 * sin((p.x + p.y) * 5.7 + time * 0.9);",
        "  float crust = smoothstep(0.35, 0.9, n);",
        "  vec3 hot = mix(vec3(1.0, 0.45, 0.08), vec3(1.0, 0.82, 0.3), 0.5 + 0.5 * sin(p.x * 1.7 - time));",
        "  gl_FragColor = vec4(mix(hot, vec3(0.28, 0.08, 0.04), crust * 0.85), 1.0);",
        "}"].join("\n")
    });
  }
  function buildLava() {
    lavaMat = makeLavaMat();
    const L = LAYOUT, list = [];
    list.push(sheetGeo(L.lake.s0 + 0.5, L.lake.s1 - 0.5, -STRIP.maxL, STRIP.maxL, -0.7));
    list.push(sheetGeo(L.channel.s0 + 0.6, L.channel.s1 - 0.6, L.channel.l0 + 0.3, L.channel.l1 - 0.3, -0.7, 1, 1));
    list.push(sheetGeo(L.chasm.s0 + 0.4, L.chasm.s1 - 0.4, -STRIP.maxL, STRIP.maxL, -3));
    for (const g of list) { const m = new THREE.Mesh(g, lavaMat); m.userData.noCast = true; group.add(m); }
  }

  function placeInstanced(geo, mat, list) {
    const im = new THREE.InstancedMesh(geo, mat, list.length);
    const mtx = new THREE.Matrix4(), q = new THREE.Quaternion(), spin = new THREE.Quaternion(), sc = new V3(), up = new V3(0, 1, 0);
    list.forEach((p, i) => {
      const dir = dirAt(p.s, p.l);
      q.setFromUnitVectors(up, dir); spin.setFromAxisAngle(up, p.rot || 0); q.multiply(spin);
      sc.set(p.k, p.k * (p.ky || 1), p.k);
      mtx.compose(dir.clone().multiplyScalar(R + p.h), q, sc);
      im.setMatrixAt(i, mtx);
    });
    im.instanceMatrix.needsUpdate = true;
    group.add(im);
    return im;
  }
  // scattered basalt rocks and glowing vents, away from the route
  function buildRocks(rand) {
    const rocks = [], vents = [];
    for (let i = 0; i < 1200 && rocks.length < Math.round(160 + 140 * QUALITY.grass); i++) {
      const s = -22 + rand() * 185, l = (rand() * 2 - 1) * 44;
      if (Math.abs(l) < 6 || lavaDepth(s, l) > 0.05) continue;
      if (s > 84 && s < 126 && Math.abs(l) < 26) continue;          // keep fight 2 and the shaded crater clear
      if (s > 58 && s < 82 && Math.abs(l) < 10) continue;
      const L = LAYOUT;                                            // keep the bridge ends, the coins and the shrine free
      if (s > L.lake.s0 - 5 && s < L.lake.s1 + 5 && L.bridges.some(b => Math.abs(l - b.l) < 3.5)) continue;
      if (L.shoreCoins.some(c => Math.hypot(c[0] - s, c[1] - l) < 3.5) || Math.hypot(L.shrine.s - s, L.shrine.l - l) < 4) continue;
      const rk = { s, l, h: terrainH(s, l) - 0.15, k: 0.4 + Math.pow(rand(), 2.5) * 2.2, ky: 0.6 + rand() * 0.8, rot: rand() * 6.28 };
      rocks.push(rk);
      if (Math.abs(l) < LAYOUT.edgeL + 2 && rk.k > 0.6) addRock(s, l, 0.7 * rk.k, rk.h + 1.2 * rk.k * rk.ky);   // pebbles stay walkable
    }
    for (let i = 0; i < 400 && vents.length < 40; i++) {
      const s = -10 + rand() * 150, l = (rand() * 2 - 1) * 40;
      if (Math.abs(l) < 8 || lavaDepth(s, l) > 0.05 || (s > 86 && s < 124 && Math.abs(l) < 20)) continue;
      vents.push({ s, l, h: terrainH(s, l) + 0.02, k: 0.6 + rand() * 0.8, rot: rand() * 6.28 });
    }
    const rockG = new THREE.DodecahedronGeometry(0.8, 0); rockG.translate(0, 0.4, 0);
    placeInstanced(rockG, H.mat(0x2e2a2e), rocks);
    const ventG = new THREE.CircleGeometry(0.5, 7); ventG.rotateX(-Math.PI / 2);
    const vi = placeInstanced(ventG, new THREE.MeshBasicMaterial({ color: 0xff6a20 }), vents); vi.userData.noCast = true;
  }
  // three low volcanoes behind the crater walls, and the citadel beyond the chasm
  function buildScenery() {
    const cone = (s, l, r, hgt) => {
      const g = new THREE.Group();
      add(g, new THREE.Mesh(kitGeometry("volc" + r + "," + hgt, () => new THREE.CylinderGeometry(r * 0.22, r, hgt, 12, 1, true)), kitMaterial(0x3a2a2a, { side: THREE.DoubleSide })), 0, hgt / 2, 0);
      const mouth = add(g, new THREE.Mesh(new THREE.CircleGeometry(r * 0.22, 12), lavaMat), 0, hgt - 0.3, 0); mouth.rotation.x = -Math.PI / 2;
      group.add(put(g, s, l, terrainH(s, l) - 1));
    };
    cone(60, 37, 9, 9); cone(100, -38, 11, 11); cone(150, 34, 8, 8);
    const C = LAYOUT.citadel, g = new THREE.Group();
    add(g, box(18, 6, 10, 0x2a2228), 0, 3, 0);
    for (const x of [-9, 9]) { add(g, cyl(2, 2.4, 12, 8, 0x2a2228), x, 6, 0); add(g, new THREE.Mesh(kitGeometry("roof", () => new THREE.ConeGeometry(2.6, 3, 8)), kitMaterial(0x8a1a14)), x, 13.5, 0); }
    add(g, cyl(3, 3.6, 16, 8, 0x241e22), 0, 8, -2);
    add(g, new THREE.Mesh(kitGeometry("roofBig", () => new THREE.ConeGeometry(4, 4, 8)), kitMaterial(0x8a1a14)), 0, 18, -2);
    for (const x of [-5, -2, 2, 5]) add(g, box(1, 1.6, 0.2, 0xffa040, { emissive: 0xff6010, emissiveIntensity: 1.4 }), x, 3.5, 5.05);
    group.add(put(g, C.s, C.l, terrainH(C.s, C.l) - 0.2));
  }

  // ---- props ----
  const coins = [];
  function makeCoin(s, l, h, tag) {
    const c = new THREE.Mesh(kitGeometry("coin", () => { const g = new THREE.CylinderGeometry(0.42, 0.42, 0.1, 16); g.rotateX(Math.PI / 2); return g; }), coinMat);
    const holder = new THREE.Group(); holder.add(c); c.position.y = 1.0;
    group.add(put(holder, s, l, h));
    const co = { s, l, h, holder, spin: c, taken: false, tag: tag || "shore", hidden: false };
    coins.push(co);
    return co;
  }
  function buildProps() {
    const L = LAYOUT;
    // the three bridges: dark basalt planks on posts; the fakes are paint and melt under the hero
    S.bridgeMeshes = L.bridges.map((b, i) => {
      const g = new THREE.Group();
      const len = L.lake.s1 - L.lake.s0 + 2, n = 12;
      for (let k = 0; k < n; k++) {
        const slab = add(g, box(3, 0.35, len / n - 0.15, 0x3a3236), 0, 0.17, -len / 2 + (k + 0.5) * len / n);
        slab.rotation.y = (k % 3 - 1) * 0.03;
      }
      for (let k = 0; k <= 4; k++) for (const x of [-1.4, 1.4]) add(g, cyl(0.16, 0.2, 1.1, 6, 0x2a2428), x, 0.55, -len / 2 + k * len / 4);
      const holder = new THREE.Group(); holder.add(g); g.rotation.y = Math.PI;    // planks run along +s
      group.add(put(holder, (L.lake.s0 + L.lake.s1) / 2, b.l, 0));
      return holder;
    });
    // the reflection of the real bridge: a dark band wavering on the lava, wider than the bridge
    const rb = L.bridges[L.realBridge];
    S.reflection = new THREE.Mesh(sheetGeo(L.lake.s0 + 0.8, L.lake.s1 - 0.8, rb.l - 2.6, rb.l + 2.6, -0.66, 1, 1.3),
      new THREE.MeshBasicMaterial({ color: 0x120608, transparent: true, opacity: 0.6, depthWrite: false }));
    S.reflection.userData.noCast = true;
    group.add(S.reflection);
    // the shrine that sells the deflect punch: a stone with a glowing glove over it
    const sh = new THREE.Group();
    add(sh, cyl(0.8, 1.0, 1.2, 8, 0x4a4248), 0, 0.6, 0);
    S.glove = add(sh, new THREE.Group(), 0, 2.1, 0);
    add(S.glove, ball(0.38, 0xffffff, { emissive: 0x80c0ff, emissiveIntensity: 0.8, flatShading: false }), 0, 0, 0);
    for (let k = 0; k < 4; k++) add(S.glove, ball(0.14, 0xffffff, { emissive: 0x80c0ff, emissiveIntensity: 0.8 }, 8, 6), -0.24 + k * 0.16, 0.32, 0.12);
    S.gloveHalo = add(sh, glowMesh(new THREE.SphereGeometry(0.9, 12, 10), 0x80c0ff, 0.25), 0, 2.1, 0);
    group.add(put(sh, L.shrine.s, L.shrine.l, terrainH(L.shrine.s, L.shrine.l)));
    S.shrine = sh;
    // the pillar the young villain fights from
    const pl = new THREE.Group(), ground = terrainH(L.pillar.s, L.pillar.l);
    add(pl, cyl(1.6, 2.1, L.pillar.top - ground + 1, 8, 0x2e282c), 0, (L.pillar.top - ground + 1) / 2 - 1, 0);
    group.add(put(pl, L.pillar.s, L.pillar.l, ground));
    colliders.push(pl);
    // the paint wall that closes the way to the villain's side until his son flees
    S.wall = new THREE.Mesh(sheetGeo(L.wall.s - 0.01, L.wall.s + 0.01, -28, 28, 0, 0.02, 2), new THREE.MeshBasicMaterial({ color: 0xb050ff, transparent: true, opacity: 0.3, side: THREE.DoubleSide, depthWrite: false }));
    // (a vertical wall: one sheet raised by a second row of points)
    {
      const pos = [], idx = [], rows = 29;
      for (let j = 0; j < rows; j++) { const l = -28 + 56 * j / (rows - 1); localPos(L.wall.s, l, terrainH(L.wall.s, l) - 0.5).toArray(pos, pos.length); localPos(L.wall.s, l, 7).toArray(pos, pos.length); }
      for (let j = 0; j < rows - 1; j++) { const a = j * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
      S.wall.geometry.dispose();
      S.wall.geometry = new THREE.BufferGeometry(); S.wall.geometry.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); S.wall.geometry.setIndex(idx);
    }
    S.wall.userData.noCast = true;
    group.add(S.wall);
    // the basalt cages (raised when the villain arrives)
    S.cageMeshes = L.cages.map(c => {
      const g = new THREE.Group();
      add(g, cyl(1.6, 1.7, 0.4, 10, 0x2a2428), 0, 0.2, 0);
      add(g, cyl(1.6, 1.4, 0.4, 10, 0x2a2428), 0, 3.2, 0);
      for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2; add(g, cyl(0.14, 0.18, 3, 5, 0x3a3236), Math.cos(a) * 1.45, 1.7, Math.sin(a) * 1.45); }
      const cracks = add(g, glowMesh(new THREE.CylinderGeometry(1.55, 1.6, 2.6, 10, 1, true), 0xff7a20, 0), 0, 1.7, 0);
      group.add(put(g, c.s, c.l, terrainH(c.s, c.l)));
      colliders.push(g);
      return { g, cracks };
    });
    // the stone slabs the big ape lifts, with coins under each
    S.slabMeshes = L.slabs.map(sl => {
      const g = new THREE.Group();
      add(g, box(3, 0.6, 3, 0x4a4246), 0, 0.3, 0);
      group.add(put(g, sl.s, sl.l, terrainH(sl.s, sl.l)));
      return g;
    });
    for (const sl of L.slabs) for (let k = 0; k < 3; k++) { const co = makeCoin(sl.s - 0.9 + k * 0.9, sl.l + (k === 1 ? 0.6 : -0.4), terrainH(sl.s, sl.l), "slab"); co.hidden = true; }
    // the shaded crater: dark until the brother lights it; three mushrooms, one of them guards from fire
    S.shade = new THREE.Mesh(new THREE.CircleGeometry(LAYOUT.shade.r + 0.8, 24), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.72, depthWrite: false }));
    S.shade.rotation.x = -Math.PI / 2;
    const shg = new THREE.Group(); shg.add(S.shade); group.add(put(shg, L.shade.s, L.shade.l, terrainH(L.shade.s, L.shade.l) + 0.25));
    S.lightCone = glowMesh(new THREE.ConeGeometry(4.5, 7, 16, 1, true), 0xfff0a0, 0);
    S.lightCone.geometry.translate(0, -3.5, 0);
    group.add(S.lightCone);
    S.shroomMeshes = L.shrooms.map((m, i) => {
      const g = new THREE.Group();
      add(g, cyl(0.15, 0.2, 0.7, 8, 0xf0e8d8), 0, 0.35, 0);
      const cap = add(g, new THREE.Mesh(new THREE.SphereGeometry(0.5, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), H.mat(i === L.fireShroom ? 0xff6a20 : 0xd04040, { emissive: i === L.fireShroom ? 0xff4010 : 0x401010, emissiveIntensity: 0.6, flatShading: false })), 0, 0.65, 0);
      add(cap, ball(0.1, 0xffffff, null, 6, 4), 0.25, 0.3, 0.1); add(cap, ball(0.08, 0xffffff, null, 6, 4), -0.2, 0.35, -0.15);
      group.add(put(g, m.s, m.l, terrainH(m.s, m.l)));
      return g;
    });
    S.mark = glowMesh(new THREE.TorusGeometry(0.8, 0.08, 6, 20), 0xffe060, 0.9); S.mark.rotation.x = Math.PI / 2;
    const mk = new THREE.Group(); mk.add(S.mark); S.markG = mk; group.add(mk);
    // the fire mushroom once the dinosaur has pulled it over the lava (and when it grows back)
    S.fireShroom = new THREE.Group();
    add(S.fireShroom, cyl(0.15, 0.2, 0.7, 8, 0xf0e8d8), 0, 0.35, 0);
    add(S.fireShroom, new THREE.Mesh(new THREE.SphereGeometry(0.5, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), H.mat(0xff6a20, { emissive: 0xff4010, emissiveIntensity: 0.9, flatShading: false })), 0, 0.65, 0);
    add(S.fireShroom, glowMesh(new THREE.SphereGeometry(0.9, 10, 8), 0xff8030, 0.25), 0, 0.7, 0);
    group.add(S.fireShroom);
    // the ring of fire around the villain in the last round, and the hero's fire shield
    // the flames fade upward: vertex colours from yellow at the ground to deep red at the top
    const rg = ringGeo(L.arena.s, L.arena.l, L.fireRing, 0, 3.2, 64), rc = [];
    for (let i = 0; i < rg.attributes.position.count; i++) rc.push(...(i % 2 ? [0.85, 0.12, 0.02] : [1, 0.8, 0.2]));
    rg.setAttribute("color", new THREE.Float32BufferAttribute(rc, 3));
    S.fireRing = new THREE.Mesh(rg, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.8, depthWrite: false, side: THREE.DoubleSide }));
    S.fireRing.userData.noCast = true; group.add(S.fireRing);
    S.shield = glowMesh(new THREE.SphereGeometry(1.15, 16, 12), 0xffa040, 0.3); group.add(S.shield);
    // the shockwave ring (rebuilt each frame while it runs) and the fire breath
    S.waveMesh = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial({ color: 0xffd080, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    S.waveMesh.frustumCulled = false; S.waveMesh.userData.noCast = true; group.add(S.waveMesh);
    S.flames = [];
    for (let k = 0; k < 10; k++) { const f = glowMesh(kitGeometry("flame", () => new THREE.SphereGeometry(0.6, 10, 8)), k % 2 ? 0xff5010 : 0xffb030, 0.85); group.add(f); S.flames.push(f); }
    // paint balls
    S.ballMeshes = [];
    for (let k = 0; k < 4; k++) {
      const g = new THREE.Group();
      add(g, new THREE.Mesh(kitGeometry("pball", () => new THREE.SphereGeometry(0.7, 14, 10)), H.mat(0xb040ff, { emissive: 0x6010c0, emissiveIntensity: 0.5, flatShading: false })), 0, 0.7, 0);
      group.add(g); S.ballMeshes.push(g);
    }
    // the rainbow road home the young villain paints at the end
    S.road = [0xff4040, 0xffd040, 0x40c0ff].map((col, k) => {
      const pts = [];
      for (let i = 0; i <= 24; i++) { const t = i / 24; pts.push(localPos(L.edge.s - 2 + t * 22, -1 + k * 1 + t * 48, 1.5 + Math.sin(t * Math.PI * 0.9) * 22 + t * 26)); }   // off to the side, away from the citadel
      const m = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 120, 0.45, 6, false), new THREE.MeshBasicMaterial({ color: col }));
      m.userData.noCast = true; group.add(m); return m;
    });
  }
  // a vertical ribbon around a centre (shockwave, fire ring), following the ground
  function ringGeo(cs, cl, r, h0, h1, n) {
    const pos = [], idx = [];
    for (let i = 0; i <= n; i++) {
      const a = i / n * Math.PI * 2, s = cs + Math.cos(a) * r, l = cl + Math.sin(a) * r, g = terrainH(s, l);
      localPos(s, l, g + h0).toArray(pos, pos.length); localPos(s, l, g + h1).toArray(pos, pos.length);
    }
    for (let i = 0; i < n; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx);
    return g;
  }

  // ---- characters ----
  function withModel(id, parent, keep, opts) {
    const stand = new THREE.Group(); stand.name = "stand-in";
    for (const c of parent.children.slice()) if (!keep.includes(c)) stand.add(c);
    parent.add(stand);
    return Models.load(id, parent, stand, opts);
  }
  // the young villain built in code (js/characters.js), with a splash of paint that covers his eyes when a ball comes back
  function makeJr() {
    const v = Characters.youngVillain();
    const paint = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 8), new THREE.MeshBasicMaterial({ color: 0xb040ff }));
    paint.position.set(0, 0.08, 0.2); paint.scale.set(1.35, 0.6, 0.55); paint.visible = false;
    v.head.add(paint);
    return { g: v.g, brush: v.brush, tip: v.tip, paint };
  }
  function makeBowserStand() {
    const g = new THREE.Group();
    add(g, ball(1.35, 0x2f9a3a), 0, 1.9, -0.35).scale.set(1, 1.05, 0.9);
    add(g, ball(1.1, 0xe8c26a), 0, 1.7, 0.35);
    add(g, ball(0.8, 0xe8c26a), 0, 3.25, 0.55);
    for (const x of [-0.45, 0.45]) { add(g, cyl(0.35, 0.4, 0.9, 8, 0xe8c26a), x * 1.6, 0.45, 0); add(g, new THREE.Mesh(kitGeometry("horn", () => new THREE.ConeGeometry(0.14, 0.6, 6)), kitMaterial(0xf7f1dc)), x, 3.95, 0.4).rotation.z = -x * 0.8; }
    add(g, new THREE.Mesh(kitGeometry("hair", () => new THREE.ConeGeometry(0.5, 0.9, 6)), kitMaterial(0xe0442c)), 0, 3.9, 0.05).rotation.x = -0.6;
    return g;
  }
  let jr = null, bowser = null;
  const friends = {};
  function buildCharacters() {
    jr = makeJr(); jr.model = withModel("bowserjr", jr.g, [jr.brush]); group.add(jr.g);
    bowser = new THREE.Group(); const bi = new THREE.Group(); bowser.add(bi); bi.add(makeBowserStand());
    bowser.inner = bi; bowser.model = withModel("bowser", bi, []);
    S.mouthGlow = add(bowser, glowMesh(new THREE.SphereGeometry(0.6, 10, 8), 0xff6020, 0), 0, 3.1, 1.2);
    S.dizzy = add(bowser, new THREE.Group(), 0, 4.6, 0);
    for (let k = 0; k < 3; k++) add(S.dizzy, glowMesh(new THREE.OctahedronGeometry(0.25, 0), 0xffe060, 0.9), Math.cos(k * 2.1) * 0.9, 0, Math.sin(k * 2.1) * 0.9);
    group.add(bowser);
    // the friends are built in code (js/characters.js); an installed model shows instead where there is one
    const mk = (id, stand) => { const g = new THREE.Group(); g.add(stand); g.model = withModel(id, g, []); group.add(g); return g; };
    const bro = Characters.brother({ height: 1.8, lantern: true, lit: true });
    friends.luigi = mk("luigi", bro.g);
    friends.yoshi = mk("yoshi", Characters.dinosaur().g);
    friends.toad = mk("toad", Characters.mushroomFriend().g);
    friends.dk = mk("dk", Characters.bigApe().g);
    S.tongue = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 1, 8), new THREE.MeshStandardMaterial({ color: 0xff5a8a, roughness: 0.4 }));
    S.tongue.geometry.translate(0, 0.5, 0); S.tongue.geometry.rotateX(Math.PI / 2);
    S.tongue.position.set(0, 1.5, 0.8); S.tongue.visible = false; friends.yoshi.add(S.tongue);
  }

  function makeMaterials() {
    coinMat = H.mat(0xffd84a, { emissive: 0xffa020, emissiveIntensity: 0.6, roughness: 0.3, metalness: 0.5, flatShading: false });
  }

  function mergeStatic(keepRoots) {
    const keep = new Set(keepRoots), byMat = new Map(), victims = [];
    group.updateMatrixWorld(true);
    const inv = new THREE.Matrix4().copy(group.matrixWorld).invert();
    const walk = (o) => {
      if (keep.has(o)) return;
      if (o.isMesh && !o.isInstancedMesh && mergeMats.has(o.material)) {
        const m = new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld);
        const g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
        g.applyMatrix4(m);
        if (!byMat.has(o.material)) byMat.set(o.material, []);
        byMat.get(o.material).push(g); victims.push(o);
      }
      for (const c of o.children.slice()) walk(c);
    };
    for (const c of group.children.slice()) walk(c);
    for (const v of victims) v.parent.remove(v);
    for (const [mat, geos] of byMat) {
      let n = 0; for (const g of geos) n += g.attributes.position.count;
      const pos = new Float32Array(n * 3), nrm = new Float32Array(n * 3);
      let k = 0;
      for (const g of geos) { pos.set(g.attributes.position.array, k * 3); if (g.attributes.normal) nrm.set(g.attributes.normal.array, k * 3); k += g.attributes.position.count; g.dispose(); }
      const bg = new THREE.BufferGeometry(); bg.setAttribute("position", new THREE.BufferAttribute(pos, 3)); bg.setAttribute("normal", new THREE.BufferAttribute(nrm, 3)); bg.computeBoundingSphere();
      group.add(new THREE.Mesh(bg, mat));
    }
  }

  function build(p, grp, helpers) {
    planet = p; group = grp; H = helpers;
    makeMaterials();
    buildStrip();
    buildLava();
    if (FX.jungle) buildRocks(H.rng(4242));
    if (FX.islands) buildScenery();
    buildProps();
    for (const c of LAYOUT.shoreCoins) makeCoin(c[0], c[1], terrainH(c[0], c[1]));
    buildCharacters();
    const keep = [S.shrine, jr.g, bowser, S.markG, S.fireShroom, S.shield, S.waveMesh, S.fireRing, S.reflection, S.wall, S.lightCone]
      .concat(S.bridgeMeshes, S.cageMeshes.map(c => c.g), S.slabMeshes, S.shroomMeshes, S.flames, S.ballMeshes, S.road, coins.map(c => c.holder), Object.values(friends));
    if (FX.merge) mergeStatic(keep);
  }

  // ============================================================
  // runtime
  // ============================================================
  function reset() {
    S.t = 0; S.splits = []; S.cp = 0; S.hints = {}; S.coins = 0; S.slabCoins = 0;
    S.hasDeflect = false; S.hasDash = false;
    S.fake = LAYOUT.bridges.map(() => ({ gone: false, t: 0, steps: 0 }));
    S.wrongBridges = 0;
    S.jr = { phase: "slope", state: "idle", t: 0, hp: 3, s: LAYOUT.slope.jr.s, l: LAYOUT.slope.jr.l, h: 0, blind: 0 };
    S.balls = [];
    S.bowser = { state: "off", t: 0, s: LAYOUT.arena.s, l: LAYOUT.arena.l, ts: 0, tl: 0, ds: 0, dl: 0, left: 0, rage: 0, attack: 0, fireA: 0, fireFrom: 0, fireTo: 0 };
    S.wave = null;
    S.caged = false; S.cages = LAYOUT.cages.map(() => "none");   // none | locked | cracked | open
    S.freed = {}; S.friendT = {}; S.friendAt = {};
    S.lit = false; S.marked = false; S.delivered = false; S.shroomBack = 0; S.shroomTaken = false;
    S.slabsUp = 0; S.dkT = 0;
    S.shieldT = 0; S.final = false; S.beaten = false; S.beatenT = 0;
    S.hanging = false; S.saved = false; S.savedT = 0; S.won = false;
    S.introT = -1;
    for (const b of bridgeSolids) b.gone = false;
    wallSolid.gone = false;
    for (const c of cageSolids) c.gone = true;
    for (const c of slabSolids) c.gone = false;
    for (const c of coins) { c.taken = false; c.hidden = c.tag === "slab"; c.holder.visible = !c.hidden; }
    if (group) {
      S.bridgeMeshes.forEach(m => { m.visible = true; m.scale.setScalar(1); });
      S.reflection.visible = true;
      S.wall.visible = true;
      S.cageMeshes.forEach(c => { c.g.visible = false; c.cracks.material.opacity = 0; });
      S.slabMeshes.forEach((m, i) => { m.visible = true; put(m, LAYOUT.slabs[i].s, LAYOUT.slabs[i].l, terrainH(LAYOUT.slabs[i].s, LAYOUT.slabs[i].l)); });
      S.shroomMeshes.forEach(m => { m.visible = false; });
      S.shade.material.opacity = 0.72; S.lightCone.material.opacity = 0;
      S.markG.visible = false; S.fireShroom.visible = false; S.fireRing.visible = false; S.shield.visible = false;
      S.waveMesh.visible = false; S.flames.forEach(f => { f.visible = false; }); S.ballMeshes.forEach(b => { b.visible = false; });
      S.road.forEach(r => { r.visible = false; r.geometry.setDrawRange(0, 0); });
      S.mouthGlow.material.opacity = 0; S.dizzy.visible = false;
      S.glove.visible = true; S.gloveHalo.visible = true;
      jr.paint.visible = false; jr.g.visible = true; jr.g.scale.setScalar(1);
      placeAt(jr.g, S.jr.s, S.jr.l, terrainH(S.jr.s, S.jr.l), S.jr.s, 0);
      bowser.visible = false; bowser.scale.setScalar(1); bowser.inner.rotation.set(0, 0, 0);
      // the friends stand together at the landing, looking into the crater
      const spots = { luigi: [2, -3], yoshi: [1, 3.2], toad: [3.5, 1.4], dk: [-1, -5.5] };
      for (const k in friends) { friends[k].visible = true; S.friendAt[k] = { s: spots[k][0], l: spots[k][1] }; placeFriend(k, 20, 0); }
      S.tongue.visible = false;
    }
  }
  function placeFriend(k, fs, fl) { const a = S.friendAt[k]; placeAt(friends[k], a.s, a.l, floorAt(a.s, a.l, 2), fs, fl); }
  function walkFriend(k, ts, tl, dt, speed, fs, fl) {
    const a = S.friendAt[k], d = dist(a.s, a.l, ts, tl), step = Math.min(d, (speed || 5) * dt);
    if (d > 1e-3) { a.s += (ts - a.s) / d * step; a.l += (tl - a.l) / d * step; }
    const hop = d > 0.05 ? Math.abs(Math.sin(S.t * 10)) * 0.15 : 0;
    placeAt(friends[k], a.s, a.l, floorAt(a.s, a.l, 2) + hop, d > 0.05 ? ts : fs, d > 0.05 ? tl : fl);
    return d - step < 0.05;
  }

  // ---- coins ----
  function takeCoin(c, ctx) {
    c.taken = true; c.holder.visible = false; S.coins++;
    if (c.tag === "slab") S.slabCoins++;
    env.P.coins = (env.P.coins || 0) + 1;
    ctx.Audio.collect();
    ctx.Particles.spawn(worldPos(c.s, c.l, c.h + 1), 0xffd84a, 8, 2.5);
    if (env.P.coins % 10 === 0 && env.P.health < 3) { env.P.health++; ctx.toast("10 coins: a heart back!", 1600); }
    if (c.tag === "slab" && S.slabCoins >= LAYOUT.dashCost && !S.hasDash) {
      S.hasDash = true; env.P.coins = Math.max(0, env.P.coins - LAYOUT.dashCost);
      ctx.Audio.gate(); split("dash");
      ctx.toast("9 coins: the dash is yours!", 2400);
      ctx.hint(ctx.isTouch ? "Jump, tap Jump again in the air, then a third time: Mario dashes forward!" : "Space, Space again in the air, then a third time: Mario dashes forward!", 8000);
    }
    env.refreshHud && env.refreshHud();
  }

  // ---- the shrine: 8 coins from the far shore buy the deflect punch ----
  function updateShrine(ctx, hs, hl) {
    if (S.hasDeflect) { S.glove.rotation.y += 0.02; return; }
    S.glove.rotation.y = S.t * 1.5; S.glove.position.y = 2.1 + Math.sin(S.t * 2) * 0.12;
    if (dist(hs, hl, LAYOUT.shrine.s, LAYOUT.shrine.l) > 2.2) return;
    if (S.coins >= LAYOUT.shrine.cost) {
      S.hasDeflect = true; env.P.coins = Math.max(0, env.P.coins - LAYOUT.shrine.cost);
      S.glove.visible = false; S.gloveHalo.visible = false;
      ctx.Audio.gate(); ctx.Particles.spawn(worldPos(LAYOUT.shrine.s, LAYOUT.shrine.l, 2.2), 0x80c0ff, 30, 4);
      split("deflect");
      ctx.toast("The deflect punch!", 2200);
      ctx.hint("Punch a paint ball just before it reaches you,\nand it flies back the way it came.", 8000);
      env.refreshHud && env.refreshHud();
    } else if (!S.shrineWarned || S.shrineWarned < S.t - 4) {
      S.shrineWarned = S.t;
      ctx.hint("The deflect punch costs " + LAYOUT.shrine.cost + " coins from this shore. You have " + S.coins + ".", 4000);
    }
  }

  // ---- the bridges: a fake one melts into paint under the hero, the young villain paints it again ----
  function updateBridges(dt, ctx, hs, hl, hh) {
    const L = LAYOUT;
    L.bridges.forEach((b, i) => {
      const f = S.fake[i], m = S.bridgeMeshes[i];
      if (i === L.realBridge) return;
      if (f.gone) {
        f.t += dt;
        m.scale.y = Math.max(0.01, 1 - f.t * 3);
        if (f.t > 5) { f.gone = false; f.t = 0; bridgeSolids[i].gone = false; m.visible = true; m.scale.y = 1; }
        return;
      }
      const on = hs > L.lake.s0 + 1.5 && hs < L.lake.s1 && Math.abs(hl - b.l) < L.bridgeHalf + 0.2 && Math.abs(hh - 0.35) < 0.3;
      if (on) {
        f.gone = true; f.t = 0; bridgeSolids[i].gone = true; S.wrongBridges++;
        ctx.Audio.tone(300, 0.3, "sawtooth", 0.1, 120);
        ctx.Particles.spawn(worldPos(hs, b.l, 0.4), 0xb050ff, 30, 4);
        ctx.toast("It was only paint!", 1600);
        ctx.hint("Look at the lava: only the real bridge is reflected in it.", 6500);
      }
    });
  }

  // ---- paint balls ----
  function spawnBall(s, l, ds, dl, speed, kind) {
    if (S.balls.length >= S.ballMeshes.length) return;
    S.balls.push({ s, l, ds, dl, speed, kind, back: false, t: 0 });
  }
  function updateBalls(dt, ctx, hs, hl, hh) {
    for (let i = S.balls.length - 1; i >= 0; i--) {
      const b = S.balls[i];
      b.t += dt;
      let gone = false;
      if (b.back) {                                       // flying back to the young villain in an arc
        const k = Math.min(1, b.t / 0.7), J = S.jr;
        b.ps = b.fs + (J.s - b.fs) * k; b.pl = b.fl + (J.l - b.fl) * k;
        b.ph = b.fh + (J.h + 1.4 - b.fh) * k + Math.sin(k * Math.PI) * 3;
        if (k >= 1) { gone = true; blindJr(ctx); }
      } else {
        b.s += b.ds * b.speed * dt; b.l += b.dl * b.speed * dt;
        b.ps = b.s; b.pl = b.l; b.ph = terrainH(b.s, b.l);
        if (dist(b.s, b.l, hs, hl) < 1.1 && hh - floorAt(hs, hl, hh) < 1.2) {
          ctx.hurt(away(hs, hl, b.s, b.l)); gone = true;
          ctx.Particles.spawn(worldPos(b.s, b.l, b.ph + 0.7), 0xb040ff, 18, 3);
        }
        if (b.t > 6 || Math.abs(b.l) > 26 || lavaDepth(b.s, b.l) > 0.5) gone = true;
      }
      if (gone) S.balls.splice(i, 1);
    }
    S.ballMeshes.forEach((m, k) => {
      const b = S.balls[k];
      m.visible = !!b;
      if (b) { put(m, b.ps, b.pl, b.ph); m.children[0].rotation.x += dt * (b.back ? -6 : 8); }
    });
  }
  function deflect(b, ctx) {
    b.back = true; b.t = 0; b.fs = b.ps; b.fl = b.pl; b.fh = b.ph;
    ctx.Audio.tone(900, 0.15, "square", 0.12, 1500); ctx.shake(0.15);
    ctx.Particles.spawn(worldPos(b.ps, b.pl, b.ph + 0.7), 0xffffff, 14, 3);
  }

  // ---- the young villain ----
  function blindJr(ctx) {
    const J = S.jr;
    J.state = "blind"; J.t = 0; jr.paint.visible = true;
    ctx.Audio.tone(260, 0.5, "sawtooth", 0.12, 100);
    ctx.Particles.spawn(worldPos(J.s, J.l, J.h + 1.4), 0xb040ff, 24, 3);
    once("blind", ctx, "The paint covers his eyes! He stumbles down.\nNow punch him!", 5000);
  }
  function updateJr(dt, ctx, hs, hl, hh) {
    const J = S.jr, L = LAYOUT;
    J.t += dt;
    if (J.phase === "slope") {
      // he stands on the ledge above the side slope and rolls paint balls across the path
      J.h = terrainH(J.s, J.l);
      placeAt(jr.g, J.s, J.l, J.h, hs, hl);
      const near = hs > 0 && hs < L.slope.s1;
      if (J.state === "idle" && near && J.t > 2.2) { J.state = "swing"; J.t = 0; J.lane = clamp(hs + 1.5, L.slope.s0 + 2, L.slope.s1 - 1); }
      if (J.state === "swing") {
        jr.brush.rotation.x = -1.6 * Math.sin(Math.min(1, J.t / 0.7) * Math.PI);
        if (J.t > 0.7) { J.state = "idle"; J.t = 0; spawnBall(J.lane, L.slope.from, 0, 1, 6.5, "slope"); ctx.Audio.fire(); }
      } else jr.brush.rotation.x = 0;
      if (hs > L.slope.s1 + 0.5) {
        J.phase = "fly"; J.state = "fly"; J.t = 0; J.fs = J.s; J.fl = J.l; J.fh = J.h;
        ctx.toast("The young villain: \"Catch me if you can!\"", 2400);
        once("bridges", ctx, "He painted three bridges over the lava...\nbut which one is real? Look at the lava.", 8000);
      }
      return;
    }
    if (J.phase === "fly") {                              // over the lava to his pillar
      const k = smooth(0, 3, J.t), P0 = L.pillar;
      J.s = J.fs + (P0.s - J.fs) * k; J.l = J.fl + (P0.l - J.fl) * k; J.h = J.fh + (P0.top - J.fh) * k + Math.sin(k * Math.PI) * 10;
      placeAt(jr.g, J.s, J.l, J.h, P0.s - 10, 0);
      if (k >= 1) { J.phase = "pillar"; J.state = "wait"; J.t = 0; }
      return;
    }
    if (J.phase === "pillar") {
      const P0 = L.pillar;
      if (J.state === "wait") {
        J.s = P0.s; J.l = P0.l; J.h = P0.top;
        placeAt(jr.g, J.s, J.l, J.h, hs, hl);
        jr.g.position.addScaledVector(jr.g.position.clone().normalize(), Math.abs(Math.sin(S.t * 4)) * 0.15);
        if (hs > 58 && S.hasDeflect) { J.state = "idle"; J.t = 0; split("fight1"); ctx.toast("The young villain!", 1600);
          ctx.hint("Wait until he swings his brush.\nPunch the paint ball back just before it reaches you!", 9000); }
        else if (hs > 58 && !S.hasDeflect) once("needDeflect", ctx, "The young villain: \"Ha! You can't touch me up here!\"\nThe shrine by the shore sells something useful.", 6000);
        return;
      }
      if (J.state === "idle") {
        placeAt(jr.g, J.s, J.l, J.h, hs, hl);
        jr.brush.rotation.x = 0;
        if (J.t > 1.6 - 0.25 * (3 - J.hp) && S.balls.length === 0 && hs > 55) { J.state = "swing"; J.t = 0; J.aimL = clamp(hl, -6, 6); }
      } else if (J.state === "swing") {                  // the telegraph: the brush goes up and glows
        placeAt(jr.g, J.s, J.l, J.h, hs, hl);
        jr.brush.rotation.x = -2.2 * smooth(0, 0.8, J.t);
        if (J.t > 0.8) {
          J.state = "idle"; J.t = 0; jr.brush.rotation.x = 0;
          const s0 = P0.s - 2.6, ds = -1, dl = (J.aimL - P0.l) / 18;
          const n = Math.hypot(ds, dl);
          spawnBall(s0, P0.l, ds / n, dl / n, 6 + 0.6 * (3 - J.hp), "arena");
          ctx.Audio.fire();
        }
      } else if (J.state === "blind") {                   // off the pillar, dizzy on the ground
        const k = smooth(0, 0.6, J.t), Ld = L.jrLand;
        J.s = P0.s + (Ld.s - P0.s) * k; J.l = P0.l + (Ld.l - P0.l) * k; J.h = P0.top + (terrainH(Ld.s, Ld.l) - P0.top) * k + Math.sin(k * Math.PI) * 1.5;
        placeAt(jr.g, J.s, J.l, J.h, J.s + Math.cos(S.t * 6), J.l + Math.sin(S.t * 6));
        if (J.t > 4.2) { J.state = "climb"; J.t = 0; jr.paint.visible = false; }
      } else if (J.state === "hit") {
        placeAt(jr.g, J.s, J.l, J.h, hs, hl);
        if (J.t > 0.9) { J.state = "climb"; J.t = 0; jr.paint.visible = false; }
      } else if (J.state === "climb") {
        const k = smooth(0, 0.8, J.t), Ld = L.jrLand;
        J.s = Ld.s + (P0.s - Ld.s) * k; J.l = Ld.l + (P0.l - Ld.l) * k; J.h = terrainH(Ld.s, Ld.l) + (P0.top - terrainH(Ld.s, Ld.l)) * k + Math.sin(k * Math.PI) * 2;
        placeAt(jr.g, J.s, J.l, J.h, hs, hl);
        if (k >= 1) { J.state = "idle"; J.t = 0; }
      }
      return;
    }
    if (J.phase === "flee") {                             // off to the citadel, calling for his father
      const k = smooth(0, 3, J.t), C = L.citadel;
      placeAt(jr.g, J.fs + (C.s - J.fs) * k, J.fl * (1 - k), J.fh + 18 * Math.sin(k * Math.PI * 0.5) + k * 6, C.s, 0);
      if (k >= 1) { J.phase = "gone"; jr.g.visible = false; }
      return;
    }
    if (J.phase === "hang") updateEnding(dt, ctx, hs, hl, hh);
  }
  function hitJr(ctx) {
    const J = S.jr;
    J.hp--; J.state = "hit"; J.t = 0;
    ctx.Audio.bossHit ? ctx.Audio.bossHit() : ctx.Audio.boom();
    ctx.shake(0.2);
    ctx.Particles.spawn(worldPos(J.s, J.l, J.h + 1), 0xffe060, 20, 4);
    if (J.hp <= 0) {
      J.phase = "flee"; J.t = 0; J.fs = J.s; J.fl = J.l; J.fh = J.h; jr.paint.visible = false;
      S.balls.length = 0;
      wallSolid.gone = true; S.wall.visible = false;
      split("jr");
      ctx.toast("The young villain: \"Papa! Papaaa!\"", 2600);
      ctx.hint("The paint wall is gone. Something big is coming...", 5000);
      S.introT = 0;   // his father arrives at the other side of the crater
    } else ctx.toast(J.hp === 2 ? "Got him! Two more." : "One more!", 1400);
    env.refreshHud && env.refreshHud();
  }

  // ---- the villain arrives: he breaks the rim and locks the friends in basalt cages ----
  function updateIntro(dt, ctx, hs, hl) {
    if (S.introT < 0 || S.caged) return;
    S.introT += dt;
    const t = S.introT, Bw = S.bowser, A = LAYOUT.arena;
    // the friends follow the hero across the real bridge to the crater
    const rl = LAYOUT.bridges[LAYOUT.realBridge].l;
    for (const k in friends) {
      const a = S.friendAt[k];
      if (!a.path) a.path = [[16, rl], [44, rl], [84, 0], [88, (k === "dk" || k === "yoshi") ? 3 : -3]];
      let tgt = a.path[0];
      while (tgt && dist(a.s, a.l, tgt[0], tgt[1]) < 0.2 && a.path.length > 1) { a.path.shift(); tgt = a.path[0]; }
      walkFriend(k, tgt[0], tgt[1], dt, 22, A.s, 0);
    }
    if (t > 2.4 && Bw.state === "off") {
      Bw.state = "land"; Bw.t = 0; bowser.visible = true;
      ctx.Audio.roar();
    }
    if (Bw.state === "land") {
      Bw.t += dt;
      const k = smooth(0, 1.2, Bw.t), C = LAYOUT.citadel;
      Bw.s = C.s + (A.s - C.s) * k; Bw.l = 0;
      placeAt(bowser, Bw.s, Bw.l, terrainH(Bw.s, 0) + Math.sin(k * Math.PI) * 22, hs, hl);
      if (k >= 1) {
        Bw.state = "roar"; Bw.t = 0;
        ctx.Audio.boom(); ctx.shake(0.8);
        ctx.Particles.spawn(worldPos(A.s, A.l, 1), 0xff7a30, 50, 8);
        ctx.toast("Bowser breaks the crater rim!", 2600);
        // the cages burst out of the ground around the friends' new places
        S.caged = true; split("bowser");
        LAYOUT.cages.forEach((c, i) => { S.cages[i] = "locked"; cageSolids[i].gone = false; S.cageMeshes[i].g.visible = true; S.friendAt[c.who] = { s: c.s, l: c.l }; });
        ctx.hint("He locked your friends in basalt cages!\nStand in front of a cage, and jump aside when he charges.\nThen a power punch breaks it open.", 11000);
        env.refreshHud && env.refreshHud();
      }
    }
  }

  // ---- the fight with the villain ----
  const ATTACKS = ["charge", "fire", "charge", "slam"];
  function updateBowser(dt, ctx, hs, hl, hh) {
    const Bw = S.bowser, A = LAYOUT.arena;
    if (!S.caged || S.beaten) return;
    Bw.t += dt;
    const rage = Bw.rage, gnd = terrainH(Bw.s, Bw.l);
    const face = (s, l) => placeAt(bowser, Bw.s, Bw.l, gnd, s, l);
    S.mouthGlow.material.opacity = 0; S.dizzy.visible = false; bowser.inner.position.y = 0; bowser.inner.rotation.x = 0;
    if (Bw.state === "roar") { face(hs, hl); bowser.inner.rotation.x = -0.2 * Math.sin(Bw.t * 12); if (Bw.t > 1.6) { Bw.state = "idle"; Bw.t = 0; } return; }
    if (Bw.state === "idle") {
      // walk back toward the middle between attacks
      const d = dist(Bw.s, Bw.l, A.s, A.l), st = Math.min(d, 3 * dt);
      if (d > 0.5) { Bw.s += (A.s - Bw.s) / d * st; Bw.l += (A.l - Bw.l) / d * st; }
      face(hs, hl);
      if (Bw.t > (S.final ? 0.9 : 1.3 - 0.2 * rage)) {
        Bw.t = 0;
        if (S.final) { Bw.state = "crouch"; }
        else { const a = ATTACKS[Bw.attack % ATTACKS.length]; Bw.attack++; Bw.state = a === "charge" ? "snort" : a === "fire" ? "inhale" : "crouch"; }
      }
      return;
    }
    // --- charge: he paws the ground, locks onto where the hero stands, and runs straight ---
    if (Bw.state === "snort") {
      face(hs, hl);
      bowser.inner.rotation.x = 0.15 * Math.sin(Bw.t * 20);
      Bw.ts = hs; Bw.tl = hl;
      if (Bw.t > 1.0 - 0.1 * rage) {
        Bw.state = "charge"; Bw.t = 0;
        const d = dist(Bw.s, Bw.l, Bw.ts, Bw.tl) || 1;
        Bw.ds = (Bw.ts - Bw.s) / d; Bw.dl = (Bw.tl - Bw.l) / d; Bw.left = d + 2.5;
        ctx.Audio.roar();
      }
      return;
    }
    if (Bw.state === "charge") {
      const step = Math.min(Bw.left, (12 + 2.5 * rage) * dt);
      Bw.left -= step; Bw.s += Bw.ds * step; Bw.l += Bw.dl * step;
      placeAt(bowser, Bw.s, Bw.l, terrainH(Bw.s, Bw.l), Bw.s + Bw.ds, Bw.l + Bw.dl);
      bowser.inner.rotation.x = 0.25;
      if (dist(hs, hl, Bw.s, Bw.l) < 1.9 && hh - floorAt(hs, hl, hh) < 2) ctx.hurt(away(hs, hl, Bw.s, Bw.l));
      const ci = LAYOUT.cages.findIndex((c, i) => S.cages[i] !== "open" && S.cages[i] !== "none" && dist(c.s, c.l, Bw.s, Bw.l) < 2.7);
      if (ci >= 0) {
        Bw.state = "dazed"; Bw.t = 0;
        ctx.Audio.boom(); ctx.shake(0.45);
        ctx.Particles.spawn(worldPos(LAYOUT.cages[ci].s, LAYOUT.cages[ci].l, 1.5), 0xff7a20, 30, 5);
        if (S.cages[ci] === "locked") {
          S.cages[ci] = "cracked"; S.cageMeshes[ci].cracks.material.opacity = 0.7;
          once("cracked", ctx, "He cracked the cage himself!\nHold Punch to charge a power punch, and let go next to the cage.", 7000);
        }
      } else if (Bw.left <= 0 || Math.abs(Bw.l) > 21) {
        Bw.state = "dazed"; Bw.t = 0.9;
        once("missCage", ctx, "He missed! Stand right in front of a cage,\nso that he runs into it when you jump aside.", 6000);
      }
      return;
    }
    if (Bw.state === "dazed") {
      face(Bw.s + Bw.ds, Bw.l + Bw.dl);
      S.dizzy.visible = true; S.dizzy.rotation.y = S.t * 4;
      if (Bw.t > 2.2) { Bw.state = "idle"; Bw.t = 0; }
      return;
    }
    // --- fire breath: his mouth glows, then a sweep of fire along the ground ---
    if (Bw.state === "inhale") {
      face(hs, hl);
      S.mouthGlow.material.opacity = 0.9 * smooth(0, 1, Bw.t);
      if (Bw.t > 1.0) {
        Bw.state = "breath"; Bw.t = 0;
        const a = Math.atan2(hl - Bw.l, hs - Bw.s), span = 1.0 + 0.1 * rage, side = Math.random() < 0.5 ? 1 : -1;
        Bw.fireFrom = a - side * span; Bw.fireTo = a + side * span;
        ctx.Audio.fire();
      }
      return;
    }
    if (Bw.state === "breath") {
      const dur = 1.5 - 0.15 * rage, k = Math.min(1, Bw.t / dur), a = Bw.fireFrom + (Bw.fireTo - Bw.fireFrom) * k;
      Bw.fireA = a;
      placeAt(bowser, Bw.s, Bw.l, gnd, Bw.s + Math.cos(a), Bw.l + Math.sin(a));
      S.mouthGlow.material.opacity = 0.9;
      S.flames.forEach((f, i) => {
        const r = 1.6 + i * 0.95, s = Bw.s + Math.cos(a) * r, l = Bw.l + Math.sin(a) * r;
        f.visible = true; put(f, s, l, terrainH(s, l) + 0.6 + 0.2 * Math.sin(S.t * 30 + i));
        f.scale.setScalar(0.7 + i * 0.08 + 0.2 * Math.random());
      });
      const ha = Math.atan2(hl - Bw.l, hs - Bw.s), dh = Math.abs(Math.atan2(Math.sin(ha - a), Math.cos(ha - a))), d = dist(hs, hl, Bw.s, Bw.l);
      if (dh < 0.22 && d < 11 && hh - floorAt(hs, hl, hh) < 1.5 && S.shieldT <= 0) ctx.hurt(away(hs, hl, Bw.s, Bw.l));
      if (k >= 1) { Bw.state = "idle"; Bw.t = 0; S.flames.forEach(f => { f.visible = false; }); }
      return;
    }
    // --- ground slam: he crouches, jumps and slams; a shockwave runs out along the ground ---
    if (Bw.state === "crouch") {
      if (S.final) { const d = dist(Bw.s, Bw.l, A.s, A.l); if (d > 0.3) { const st = Math.min(d, 6 * dt); Bw.s += (A.s - Bw.s) / d * st; Bw.l += (A.l - Bw.l) / d * st; } }
      face(hs, hl);
      bowser.inner.scale.y = 1 - 0.18 * smooth(0, 0.9, Bw.t);
      if (Bw.t > 1.0) { Bw.state = "jump"; Bw.t = 0; bowser.inner.scale.y = 1; }
      return;
    }
    if (Bw.state === "jump") {
      face(hs, hl);
      bowser.inner.position.y = Math.sin(Math.min(1, Bw.t / 0.6) * Math.PI) * 3;
      if (Bw.t > 0.6) {
        Bw.state = "recover"; Bw.t = 0;
        S.wave = { cs: Bw.s, cl: Bw.l, r: 1.5, speed: 10 + 1.5 * rage, max: 24 };
        ctx.Audio.boom(); ctx.shake(0.5);
        ctx.Particles.spawn(worldPos(Bw.s, Bw.l, 0.5), 0xffc080, 30, 6);
        once("wave", ctx, "A shockwave! Jump over it.", 4000);
      }
      return;
    }
    if (Bw.state === "recover") {                        // after the slam he pants for a moment: the opening in the last round
      face(hs, hl);
      S.dizzy.visible = S.final; S.dizzy.rotation.y = S.t * 4;
      bowser.inner.rotation.x = 0.2;
      if (Bw.t > (S.final ? 2.4 : 1.0)) { Bw.state = "idle"; Bw.t = 0; }
    }
  }
  function updateWave(dt, ctx, hs, hl, hh) {
    const w = S.wave;
    if (!w) { S.waveMesh.visible = false; return; }
    w.r += w.speed * dt;
    const geo = ringGeo(w.cs, w.cl, w.r, 0.05, 0.85, 72);
    S.waveMesh.geometry.dispose(); S.waveMesh.geometry = geo; S.waveMesh.visible = true;
    S.waveMesh.material.opacity = 0.9 * (1 - w.r / w.max);
    const d = dist(hs, hl, w.cs, w.cl);
    if (Math.abs(d - w.r) < 0.75 && hh - floorAt(hs, hl, hh) < 0.6) ctx.hurt(away(hs, hl, w.cs, w.cl));
    if (w.r > w.max) { S.wave = null; S.waveMesh.visible = false; }
  }

  // ---- the cages, the friends and what each of them does once free ----
  function freeCage(i, ctx) {
    const c = LAYOUT.cages[i];
    S.cages[i] = "open"; cageSolids[i].gone = true; S.cageMeshes[i].g.visible = false;
    S.freed[c.who] = true; S.friendT[c.who] = 0;
    S.bowser.rage++;
    ctx.Audio.victory(); ctx.shake(0.3);
    ctx.Particles.spawn(worldPos(c.s, c.l, 1.5), 0x9a8a8a, 40, 6);
    split("free-" + c.who);
    const lines = {
      luigi: "Luigi: \"Thanks, bro! It's so dark over there... let me light it up.\"",
      toad: "Toad: \"Free! I know my mushrooms. Let me find the one that guards from fire.\"",
      yoshi: "Yoshi: \"Yoshi!\" (his tongue reaches far, even over the lava)",
      dk: "DK: \"Ooh ooh!\" He looks at the heavy stone slabs..."
    };
    ctx.hint(lines[c.who] + (Object.keys(S.freed).length < 4 ? "\nBowser is angrier now. Free the next friend!" : ""), 7000);
    if (Object.keys(S.freed).length === 4) startFinal(ctx);
    env.refreshHud && env.refreshHud();
  }
  function startFinal(ctx) {
    S.final = true; S.bowser.state = "idle"; S.bowser.t = 0; S.bowser.rage = 4;
    S.fireRing.visible = true;
    split("final");
    ctx.Audio.roar(); ctx.shake(0.5);
    ctx.toast("Bowser surrounds himself with fire!", 2600);
  }
  function updateFriends(dt, ctx, hs, hl) {
    if (!S.caged) return;
    const L = LAYOUT, b = L.bank;
    if (S.hanging) {                                    // everyone gathers at the edge for the end
      const spots = { luigi: [-3.5, -2.5], yoshi: [-4, 2.5], toad: [-5.5, 0.8], dk: [-6.5, -4.5] };
      for (const k in friends) walkFriend(k, L.edge.s + spots[k][0], spots[k][1], dt, 7, L.edge.s, 0);
      S.tongue.visible = false;
      return;
    }
    for (const k in friends) {
      if (!S.freed[k]) { const c = L.cages.find(x => x.who === k); S.friendAt[k] = { s: c.s, l: c.l }; placeAt(friends[k], c.s, c.l, terrainH(c.s, c.l) + 0.25, L.arena.s, L.arena.l); continue; }
      S.friendT[k] += dt;
      if (k === "luigi") {
        if (walkFriend(k, b.s, b.l + 0.5, dt, 5, L.shade.s, L.shade.l) && !S.lit) {
          S.lit = true; ctx.Audio.gate(); split("lit");
          ctx.toast("Luigi lights up the shaded crater!", 2400);
          if (!S.freed.toad) ctx.hint("Three mushrooms over the lava... which one guards from fire? Toad would know.", 6000);
        }
      } else if (k === "toad") {
        if (walkFriend(k, b.s - 2.2, b.l + 0.5, dt, 5, L.shade.s, L.shade.l) && !S.marked) {
          if (S.lit) {
            S.marked = true; ctx.Audio.collect(); split("marked");
            ctx.toast("Toad: \"That one! The orange one guards from fire.\"", 2800);
            if (!S.freed.yoshi) ctx.hint("But it grows over the lava. Who can reach that far?", 6000);
          } else once("toadDark", ctx, "Toad: \"It's too dark over there, I can't see the mushrooms.\"", 5000);
        }
      } else if (k === "yoshi") {
        if (walkFriend(k, b.s + 2.2, b.l + 0.5, dt, 5, L.shade.s, L.shade.l) && !S.delivered) {
          if (S.marked) {
            if (!S.pullT) { S.pullT = 0.001; ctx.Audio.tone(700, 0.12, "sine", 0.12, 1200); }
          } else once("yoshiWait", ctx, S.lit ? "Yoshi waits: which mushroom should he grab? Toad would know." : "Yoshi can't see a thing over there.", 5000);
        }
        if (S.pullT) {                                  // the tongue reaches over the lava and pulls it back
          S.pullT += dt;
          const m = L.shrooms[L.fireShroom], a = S.friendAt.yoshi, k2 = S.pullT < 0.4 ? S.pullT / 0.4 : Math.max(0, 1 - (S.pullT - 0.4) / 0.5);
          const d = dist(a.s, a.l, m.s, m.l);
          S.tongue.visible = true; S.tongue.scale.set(1, 1, Math.max(0.05, d * k2));
          placeAt(friends.yoshi, a.s, a.l, terrainH(a.s, a.l), m.s, m.l);
          if (S.pullT > 0.4) { const kk = (S.pullT - 0.4) / 0.5; S.shroomMeshes[L.fireShroom].visible = false; S.fireShroom.visible = true; put(S.fireShroom, m.s + (b.s - m.s) * kk, m.l + (b.l - m.l) * kk, terrainH(b.s, b.l) + Math.sin(kk * Math.PI) * 1.5); }
          if (S.pullT > 0.9) { S.pullT = 0; S.tongue.visible = false; S.delivered = true; put(S.fireShroom, b.s, b.l, terrainH(b.s, b.l)); ctx.Audio.collect(); split("delivered");
            ctx.toast("Yoshi pulled the fire mushroom over the lava!", 2600); ctx.hint("Eat the fire mushroom when you need it: fire can't hurt you for a while.", 6000); }
        }
      } else if (k === "dk") {
        const sl = L.slabs[Math.min(S.slabsUp, L.slabs.length - 1)];
        if (S.slabsUp < L.slabs.length) {
          if (walkFriend(k, sl.s - 2, sl.l, dt, 6, sl.s, sl.l)) {
            S.dkT += dt;
            const m = S.slabMeshes[S.slabsUp];
            put(m, sl.s, sl.l, terrainH(sl.s, sl.l) + 2.5 * smooth(0, 0.8, S.dkT));
            if (S.dkT > 0.9) {
              m.visible = false; slabSolids[S.slabsUp].gone = true;
              for (const co of coins) if (co.tag === "slab" && Math.abs(co.s - sl.s) < 1.6 && Math.abs(co.l - sl.l) < 1.6) { co.hidden = false; co.holder.visible = true; }
              ctx.Audio.boom(); S.slabsUp++; S.dkT = 0;
              if (S.slabsUp === 1) { split("slabs"); ctx.hint("Coins under the slabs! 9 of them unlock a dash.", 6000); }
            }
          }
        } else walkFriend(k, 92, 12, dt, 5, L.arena.s, L.arena.l);
      }
    }
    // the shaded crater and its mushrooms
    S.shade.material.opacity = S.lit ? Math.max(0, S.shade.material.opacity - dt) : 0.72;
    S.lightCone.material.opacity = S.lit ? 0.18 + 0.05 * Math.sin(S.t * 3) : 0;
    if (S.lit) { const a = S.friendAt.luigi; S.lightCone.position.copy(localPos(L.shade.s, L.shade.l, terrainH(L.shade.s, L.shade.l) + 7)); S.lightCone.quaternion.setFromUnitVectors(new V3(0, 1, 0), S.lightCone.position.clone().normalize()); }
    S.shroomMeshes.forEach((m, i) => { if (!(i === L.fireShroom && S.delivered)) m.visible = S.lit && !(i === L.fireShroom && S.pullT > 0.4); });
    S.markG.visible = S.marked && !S.delivered && !(S.pullT > 0.4);
    if (S.markG.visible) { const m = L.shrooms[L.fireShroom]; put(S.markG, m.s, m.l, terrainH(m.s, m.l) + 1.6 + 0.1 * Math.sin(S.t * 4)); S.mark.rotation.z = S.t * 2; }
  }
  function updateShield(dt, P, ctx, hs, hl, hh) {
    const L = LAYOUT, b = L.bank;
    if (S.delivered) {
      if (S.shroomTaken) { S.shroomBack -= dt; if (S.shroomBack <= 0) { S.shroomTaken = false; S.fireShroom.visible = true; } }
      else if (!S.pullT && dist(hs, hl, b.s, b.l) < 1.3 && hh - terrainH(b.s, b.l) < 1.5) {
        S.shroomTaken = true; S.shroomBack = 4; S.fireShroom.visible = false; S.shieldT = 20;
        ctx.Audio.victory(); split("shield");
        ctx.toast("Fire can't hurt Mario now!", 2200);
        if (S.final) ctx.hint("Through the fire! Jump over his shockwave,\nthen dash into him while he pants.", 7000);
      }
    }
    if (S.shieldT > 0) S.shieldT -= dt;
    S.shield.visible = S.shieldT > 0 && (S.shieldT > 3 || Math.floor(S.shieldT * 6) % 2 === 0);
    if (S.shield.visible) S.shield.position.copy(P.pos).sub(center).addScaledVector(P.up, 0.85);
    // the ring of fire in the last round
    if (S.final && !S.beaten) {
      S.fireRing.scale.setScalar(1); S.fireRing.material.opacity = 0.55 + 0.25 * Math.sin(S.t * 13);
      const d = dist(hs, hl, L.arena.s, L.arena.l);
      if (Math.abs(d - L.fireRing) < 0.9 && S.shieldT <= 0) {
        ctx.hurt(away(hs, hl, L.arena.s, L.arena.l));
        once("ring", ctx, "The ring of fire is too hot! Eat the fire mushroom first.", 6000);
      }
    }
  }

  // ---- the last blow, and the ending ----
  function updateFinalHit(P, ctx, hs, hl, hh) {
    const Bw = S.bowser;
    if (!S.final || S.beaten) return;
    // a dash counts until the hero lands, so one that just ran out of speed on the way in still hits
    const d = dist(hs, hl, Bw.s, Bw.l), dashing = P.dashT > 0 || (P.dashed && !P.grounded);
    if (d < 3.2 && hh - terrainH(Bw.s, Bw.l) < 4.5) {
      if (dashing && Bw.state === "recover") { beatBowser(ctx); return; }
      if (Bw.state === "recover") once("tooSlow", ctx, "You need more speed: jump, jump again, and a third time to dash into him!", 6000);
      else ctx.hurt(away(hs, hl, Bw.s, Bw.l));
    }
  }
  function beatBowser(ctx) {
    S.beaten = true; S.beatenT = 0; S.wave = null; S.waveMesh.visible = false; S.fireRing.visible = false;
    S.flames.forEach(f => { f.visible = false; });
    split("beaten");
    ctx.Audio.boom(); ctx.Audio.roar(); ctx.shake(0.9);
    ctx.Particles.spawn(worldPos(S.bowser.s, S.bowser.l, 2), 0xffe060, 60, 8);
    ctx.toast("Bowser is beaten!", 2600);
    env.refreshHud && env.refreshHud();
  }
  function updateBeaten(dt, ctx, hs, hl) {
    if (!S.beaten || S.hanging) return;
    S.beatenT += dt;
    const Bw = S.bowser, k = smooth(0, 2.5, S.beatenT), E = LAYOUT.edge;
    // he stumbles back to the edge and tumbles into the chasm; the rim crumbles under his son
    const s = Bw.s + (E.s + 4 - Bw.s) * k;
    placeAt(bowser, s, Bw.l * (1 - k), terrainH(Bw.s, Bw.l) * (1 - k) - 14 * smooth(0.7, 1, k), hs, hl);
    bowser.inner.rotation.x = -0.6 * k;
    if (S.beatenT > 2.8) {
      bowser.visible = false; S.hanging = true; S.jr.phase = "hang"; S.jr.t = 0;
      jr.g.visible = true; jr.paint.visible = false;
      ctx.Audio.boom(); ctx.shake(0.4);
      ctx.toast("The young villain is slipping off the edge!", 2600);
      ctx.hint("His brush fell into the chasm... Reach out to him:\nwalk to the edge and press Punch.", 9000);
    }
  }
  function updateEnding(dt, ctx, hs, hl, hh) {
    const J = S.jr, E = LAYOUT.edge;
    if (!S.saved) {
      J.s = E.s; J.l = E.l; J.h = terrainH(E.s - 0.5, 0) - 0.85 + 0.08 * Math.sin(S.t * 9);
      placeAt(jr.g, J.s, J.l, J.h, E.s - 3, 0);
      jr.brush.visible = false;
      return;
    }
    S.savedT += dt;
    const k = smooth(0, 1, S.savedT);
    J.s = E.s - 1.5 * k; J.h = terrainH(E.s - 0.5, 0) - 0.85 + 0.85 * k;
    placeAt(jr.g, J.s, 0, J.h, S.savedT < 2 ? hs : E.s + 10, S.savedT < 2 ? hl : 6);
    jr.brush.visible = S.savedT > 1.6;
    if (S.savedT > 2) {                                  // he paints the road home
      const kk = Math.min(1, (S.savedT - 2) / 2.5);
      jr.brush.rotation.x = -1.2 + 0.8 * Math.sin(S.t * 8);
      S.road.forEach(r => { r.visible = true; r.geometry.setDrawRange(0, Math.floor(r.geometry.index.count * kk / 3) * 3); });
    }
    if (S.savedT > 5.2 && !S.won) {
      S.won = true; split("home");
      if (env.win) env.win();
    }
  }
  function reachOut(ctx) {
    S.saved = true; S.savedT = 0;
    ctx.Audio.victory();
    ctx.toast("Mario takes the young villain's hand.", 2600);
    ctx.hint("The young villain: \"You... saved me? Even after all that?\"\nHe gets his brush back, and paints one road home for everyone.", 9000);
  }

  // ---- punch: deflect, the young villain, cages, reaching out at the end ----
  function aim(P, dir, up) {
    const m = P.pos.clone().sub(center);
    let best = null, bestD = 4.5;
    const consider = (local, ok) => {
      if (!ok) return;
      const d = local.distanceTo(m); if (d >= bestD) return;
      const to = GameShared.projectTangent(local.clone().sub(m), up);
      if (to.lengthSq() < 1e-6 || to.normalize().dot(dir) < 0.2) return;
      best = to; bestD = d;
    };
    for (const b of S.balls) if (!b.back) consider(localPos(b.ps, b.pl, b.ph + 0.7), S.hasDeflect);
    const J = S.jr;
    consider(localPos(J.s, J.l, J.h + 0.8), J.state === "blind" || (J.phase === "hang" && !S.saved));
    LAYOUT.cages.forEach((c, i) => consider(localPos(c.s, c.l, 1.2), S.cages[i] === "cracked"));
    return best || dir;
  }
  function punchHit(P, fwd, up) {
    const ctx = env, c = coordsAt(P.pos), hh = heightAt(P.pos);
    const m = P.pos.clone().sub(center);
    const reach = (local, r) => {
      const v = local.clone().sub(m), along = v.dot(fwd);
      if (along < -0.6 || along > (r || 2.6)) return false;
      return v.clone().addScaledVector(fwd, -along).length() < 1.8;
    };
    // a paint ball rolling at the hero goes back where it came from
    if (S.hasDeflect) for (const b of S.balls) if (!b.back && reach(localPos(b.ps, b.pl, b.ph + 0.7), 3.4)) { deflect(b, ctx); return 1; }
    const J = S.jr;
    if (J.phase === "pillar" && J.state === "blind" && reach(localPos(J.s, J.l, J.h + 0.8), 2.8)) { hitJr(ctx); return 1; }
    if (J.phase === "hang" && !S.saved && dist(c.s, c.l, J.s, J.l) < 2.8) { reachOut(ctx); return 1; }
    for (let i = 0; i < LAYOUT.cages.length; i++) {
      const cg = LAYOUT.cages[i];
      if (S.cages[i] === "none" || S.cages[i] === "open" || dist(c.s, c.l, cg.s, cg.l) > 3.2) continue;
      if (S.cages[i] === "cracked" && P.punchPower) { freeCage(i, ctx); return 1; }
      ctx.Audio.tone(200, 0.1, "square", 0.1);
      once(S.cages[i] === "cracked" ? "needPower" : "cageHard", ctx, S.cages[i] === "cracked"
        ? "Almost! Hold Punch until your fist glows, then let go."
        : "Too hard to break... Make Bowser crash into it: stand in front of it and jump aside when he charges.", 6000);
      return 1;
    }
    const Bw = S.bowser;
    if (S.caged && !S.beaten && dist(c.s, c.l, Bw.s, Bw.l) < 3) { ctx.Audio.tone(160, 0.12, "square", 0.1); once("bowserHard", ctx, S.final ? "Dash into him while he pants after the slam!" : "Bowser is too strong for that. Free your friends first!", 5000); return 1; }
    return 0;
  }

  // ---- hints, checkpoints ----
  function once(key, ctx, text, ms) { if (!S.hints[key]) { S.hints[key] = true; ctx.hint(text, ms || 6000); } }
  function updateHints(ctx, s, l) {
    const h = (k, cond, text, ms) => { if (cond) once(k, ctx, text, ms); };
    h("land", S.t > 0.5 && s < 4, "The Furnace Moon! The lava lake, the volcanoes, Bowser's citadel...\nand the young villain with his brush, right below.", 8000);
    h("slope", s > 4 && s < 12, "He rolls paint balls down the slope. Dodge them!");
    h("shore", s > 44 && s < 50 && !S.hasDeflect, "Coins! Collect 8 of them for the shrine by the shore.");
  }
  function split(name) { if (S.splits.some(x => x.name === name)) return; const prev = S.splits.length ? S.splits[S.splits.length - 1].t : 0; S.splits.push({ name, t: S.t, seg: S.t - prev }); }
  function checkpointUpdate(ctx, s, l, hh) {
    if (!ctx.grounded) return;
    const cps = LAYOUT.checkpoints;
    for (let i = cps.length - 1; i > S.cp; i--) if (s >= cps[i].s && s < cps[i].s + 20 && Math.abs(l) < 12 && hh > -0.5) { S.cp = i; split(cps[i].name); break; }
  }
  function respawn(P, hooks, hurtRestore) {
    const cp = LAYOUT.checkpoints[S.cp];
    const pos = worldPos(cp.s, cp.l, terrainH(cp.s, cp.l) + 0.05);
    hooks.teleport(pos, GameShared.projectTangent(T, pos.clone().sub(center).normalize()));
    if (hurtRestore) hooks.restoreHealth();
    hooks.fade();
    S.balls.length = 0;
  }

  function update(dt, ctx) {
    const P = ctx.P;
    S.t += dt;
    if (lavaMat) lavaMat.uniforms.time.value = S.t;
    const c = coordsAt(P.pos), hh = heightAt(P.pos);
    updateShrine(ctx, c.s, c.l);
    updateBridges(dt, ctx, c.s, c.l, hh);
    updateJr(dt, ctx, c.s, c.l, hh);
    updateBalls(dt, ctx, c.s, c.l, hh);
    updateIntro(dt, ctx, c.s, c.l);
    updateBowser(dt, ctx, c.s, c.l, hh);
    updateWave(dt, ctx, c.s, c.l, hh);
    updateFriends(dt, ctx, c.s, c.l);
    updateShield(dt, P, ctx, c.s, c.l, hh);
    updateFinalHit(P, ctx, c.s, c.l, hh);
    updateBeaten(dt, ctx, c.s, c.l);
    for (const co of coins) if (!co.taken && !co.hidden) {
      co.spin.rotation.y += dt * 3;
      if (Math.hypot(c.s - co.s, c.l - co.l) < 1.2 && Math.abs(hh - co.h - 0.6) < 1.6) takeCoin(co, ctx);
    }
    updateHints(ctx, c.s, c.l);
    checkpointUpdate(ctx, c.s, c.l, hh);
    if (hh < LAYOUT.fallRespawn && !S.won) { ctx.toast("Too hot! Back to the last flag.", 1400); respawn(P, ctx, false); }
  }

  function constrain(P, curH) {
    const c = coordsAt(P.pos);
    if (Math.abs(c.l) > LAYOUT.edgeL) {
      P.pos.copy(worldPos(c.s, clamp(c.l, -LAYOUT.edgeL, LAYOUT.edgeL), curH));
      P.vel.addScaledVector(B, -P.vel.dot(B));
    }
  }

  // ---- camera ----
  function cameraFloor(pos) {
    const u = _c.copy(pos).sub(center);
    const h = u.length() - R; u.normalize();
    const c = coordsOf(u);
    let f = Math.max(terrainH(c.s, c.l), -0.7);           // the lava surface counts as the floor for the camera
    for (const o of solids) { if (o.gone || o.top > 20 || h < o.bottom - 0.3 || !inFoot(o, c.s, c.l)) continue; if (o.top > f) f = o.top; }
    rocksNear(c.s, (o) => { if (h >= o.bottom - 0.3 && inFoot(o, c.s, c.l) && o.top > f) f = o.top; });
    return { floor: f, h };
  }
  function cameraHint() { return null; }
  function cameraFocus(P) {
    const c = coordsAt(P.pos);
    if (S.jr.phase === "pillar" && S.jr.state !== "wait" && c.s > 56 && c.s < 80) return { point: worldPos(S.jr.s, S.jr.l, S.jr.h), weight: 0.2 };
    if (S.caged && !S.beaten && dist(c.s, c.l, S.bowser.s, S.bowser.l) > 5) return { point: worldPos(S.bowser.s, S.bowser.l, 2), weight: 0.2 };
    return null;
  }
  function cameraShot(P) {
    const c = coordsAt(P.pos);
    if (S.t < 4 && c.s < 3) {                               // landing: the whole crater from the rim
      const k = smooth(0, 4, S.t);
      return { pos: worldPos(-7 + 4 * k, 0, 12 - 4 * k), look: worldPos(45 - 25 * k, 0, 3), kind: "crater" };
    }
    if (S.bowser.state === "land" || (S.bowser.state === "roar" && S.bowser.t < 1.2)) {
      return { pos: worldPos(c.s - 5, c.l - 3, heightAt(P.pos) + 4), look: worldPos(LAYOUT.arena.s, 0, 3), kind: "bowser" };
    }
    if (S.saved && S.savedT < 5) {
      const E = LAYOUT.edge;
      return S.savedT < 2 ? { pos: worldPos(E.s - 6, 4, terrainH(E.s - 6, 4) + 2.5), look: worldPos(E.s - 1, 0, 1.4), kind: "rescue" }
        : { pos: worldPos(E.s - 10, -12, terrainH(E.s - 10, -12) + 4), look: worldPos(E.s + 8, 18, 16), kind: "road" };
    }
    return null;
  }
  function dayAxis() { const a = dirAt(70, 0), b = dirAt(71, 0); return { up: a, forward: b.sub(a) }; }
  function avatar() { return null; }
  function abilities() { return { dash: !!S.hasDash }; }

  function objective() {
    if (S.won || S.saved) return "Home together!";
    if (S.hanging) return "Reach out to the young villain";
    if (S.final) return S.shieldT > 0 ? "Dash into Bowser after his slam" : (S.delivered ? "Eat the fire mushroom" : "Get past the ring of fire");
    if (S.caged) return "Free your friends (" + Object.keys(S.freed).length + "/4)";
    if (S.introT >= 0) return "Something is coming...";
    if (S.jr.phase === "pillar" && S.hasDeflect) return "Send the paint back (" + (3 - S.jr.hp) + "/3)";
    if (S.jr.phase === "pillar" || S.coins >= LAYOUT.shrine.cost) return S.hasDeflect ? "Go up to the young villain" : "Buy the deflect punch at the shrine";
    if (S.jr.phase !== "slope") return S.coins > 0 ? "Coins for the shrine (" + S.coins + "/" + LAYOUT.shrine.cost + ")" : "Find the real bridge";
    return "Down into the crater";
  }
  // the recorded song plays from the landing, over the slope, the bridges and the first fight, until Bowser arrives
  function music() { return (S.bowser.state === "off" && !S.caged && !S.beaten && !S.hanging && !S.won) ? "volcanic" : null; }
  function hudText() { const n = (env && env.P && env.P.coins) || 0; return "🌋 " + objective() + (n ? "   🪙 " + n : ""); }

  const debug = {
    get state() { return S; }, layout: LAYOUT,
    rockColliders() { const out = []; for (const b of rockGrid.values()) out.push(...b); return out; },
    coordsOf: (p) => coordsAt(p), worldPos, dirAt, query, terrainH, floorAt,
    get coins() { return S.coins; }, get hasDeflect() { return S.hasDeflect; }, get hasDash() { return S.hasDash; },
    get jr() { return Object.assign({}, S.jr); }, get balls() { return S.balls.map(b => Object.assign({}, b)); },
    get bowser() { return Object.assign({}, S.bowser); }, get cages() { return S.cages.slice(); }, get freed() { return Object.assign({}, S.freed); },
    get lit() { return S.lit; }, get marked() { return S.marked; }, get delivered() { return S.delivered; }, get slabsUp() { return S.slabsUp; },
    get shield() { return S.shieldT; }, get final() { return S.final; }, get beaten() { return S.beaten; }, get hanging() { return S.hanging; },
    get saved() { return S.saved; }, get won() { return S.won; }, get wave() { return S.wave && Object.assign({}, S.wave); },
    get fake() { return S.fake.map(f => Object.assign({}, f)); }, get wallGone() { return wallSolid.gone; },
    get checkpoint() { return LAYOUT.checkpoints[S.cp].name; }, get splits() { return S.splits; },
    // QA shortcuts to a stage of the story
    giveDeflect() { S.hasDeflect = true; S.glove.visible = false; S.gloveHalo.visible = false; },
    skipToJrFight() { S.jr.phase = "pillar"; S.jr.state = "wait"; S.jr.t = 0; S.jr.s = LAYOUT.pillar.s; S.jr.l = LAYOUT.pillar.l; S.jr.h = LAYOUT.pillar.top; },
    skipToBowser() {
      debug.giveDeflect(); S.jr.hp = 0; S.jr.phase = "gone"; jr.g.visible = false; wallSolid.gone = true; S.wall.visible = false; S.introT = 0;
      for (const k in friends) S.friendAt[k] = { s: 86, l: 0, path: [[88, 0]] };
    },
    setBowser(state) { S.bowser.state = state; S.bowser.t = 0; },
    models: () => ({ jr: jr.g, bowser, luigi: friends.luigi, yoshi: friends.yoshi, toad: friends.toad, dk: friends.dk })
  };

  function attach(e) { env = e; reset(); }

  return {
    configure, shapeGround, smoothGround, wantsSmooth, exitDir, build, attach, reset, update, query, drift, constrain,
    punchHit, aim, scripted() {}, objective, hudText, debug, colliders, cameraHint, cameraFloor, cameraShot, cameraFocus, dayAxis,
    avatar, abilities, music,
    respawn: (P, hooks, restoreHealth) => respawn(P, hooks, restoreHealth),
    isLocked: () => false,
    get layout() { return LAYOUT; }
  };
})();
