"use strict";

/* ============================================================
   Basalt Mines - star 2 (issues #12 to #17). Story: game-design/four-planets.md.
   Route (arc length `s` along a great circle from the landing, `l` lateral,
   positive to the hero's right), same frame as js/wind-gardens.js:
     s   0        jungle landing with Luigi; three thuds sound from the mountain
     s  10        power glove shrine (hold Punch to charge a Power Punch)
     s  18..28    training yard: cracked basalt boulders, one with a gold vein
     s  30..35    rock spur; a cracked wall closes the only gap (power punch)
     s  37..50    beetle valley: a basalt beetle, armoured in front
     s  50..56    side grotto behind a cracked wall (l -10..-19), coins
     s  57..100   mine track climbing 9 units, monkeys roll stones down, alcoves for cover
     s 100..118   junction: the beam cart held by a basalt block, Luigi at the switch
     s 112        switch: straight to DK, right to a dead end (l 17 at s 124)
     s 124..136   DK's chamber under a sagging roof; DK holds the last beam
     s 137        rubble DK clears after the rescue; exit tunnel down to daylight
     s 166, 168   the young villain at the launch pad, then the gate
   Characters are GLB/glTF models (js/models.js); the parts built here are
   stand-ins that show until a model is installed.
   Load order: Three.js, GameShared, tuning, models, this file, the game script.
   ============================================================ */
const BasaltMines = (() => {
  const V3 = THREE.Vector3;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const smooth = (a, b, x) => { const k = clamp((x - a) / (b - a), 0, 1); return k * k * (3 - 2 * k); };
  const band = (s, a, b, w) => smooth(a, a + w, s) * (1 - smooth(b - w, b, s));

  // ---- layout ----
  const LAYOUT = {
    shrine: { s: 10, l: 0 },
    boulders: [{ s: 20, l: -3.6, gold: 0 }, { s: 23, l: 3.8, gold: 5 }, { s: 26.5, l: -0.8, gold: 0 }],
    spur: { s0: 30, s1: 35, open: 4.2, top: 8, wallS: 32.6 },
    beetle: { s: 45, l: 0, s0: 37.5, s1: 52, l0: -9, l1: 9 },
    grotto: { s0: 50, s1: 56, l0: -19, l1: -10, wallL: -10, coins: 8 },
    mineS: 57, climbTop: 100, floorTop: 9,
    alcoves: [{ s: 66, side: 1 }, { s: 75, side: -1 }, { s: 84, side: 1 }, { s: 93, side: -1 }],
    monkeys: [{ s: 82, from: 57, to: 80 }, { s: 99, from: 79, to: 97.5 }],
    cart: { s: 103.5 }, block: { s0: 106.2, s1: 108 },
    switchS: 112, luigi: { s: 113.6, l: -5.2 }, lever: { s: 112, l: -3.6 },
    branchEnd: { s: 124, l: 17 },
    chamber: { s0: 124, s1: 136, half: 7 }, dk: { s: 131, l: 0 }, cartStop: 127.2,
    slab: { s0: 124.6, s1: 136.6, half: 7.6, bottom: 12.9, top: 15 },
    rubble: { s0: 136.6, s1: 138.2 },
    pad: { s: 165.5, l: 0 }, jr: { s: 167.5, l: 3.5 }, gate: { s: 169, l: 0 },
    edgeL: 46,
    checkpoints: [
      { name: "landing", s: 0, l: 0 },
      { name: "training", s: 15, l: 0 },
      { name: "valley", s: 37, l: 0 },
      { name: "mine", s: 57.5, l: 0 },
      { name: "junction", s: 101, l: 0 },
      { name: "chamber", s: 121, l: 0 },
      { name: "exit", s: 140, l: 0 }
    ]
  };

  // ---- sphere frame ----
  let R = 150, center = new V3(), N = new V3(0, 1, 0), T = new V3(0, 0, 1), B = new V3(1, 0, 0);
  function configure(def) {
    R = def.radius; center = def.center.clone();
    N = def.spawnDir.clone().normalize();
    T = GameShared.projectTangent(new V3(0, 0, 1), N);
    B = new V3().crossVectors(T, N).normalize();
  }
  function dirAt(s, l, out) {
    const a = s / R, c = l / R, ca = Math.cos(c);
    return (out || new V3()).set(0, 0, 0)
      .addScaledVector(N, Math.cos(a) * ca).addScaledVector(T, Math.sin(a) * ca).addScaledVector(B, Math.sin(c));
  }
  function coordsOf(dir) { return { s: Math.atan2(dir.dot(T), dir.dot(N)) * R, l: Math.asin(clamp(dir.dot(B), -1, 1)) * R }; }
  function localPos(s, l, h) { return dirAt(s, l).multiplyScalar(R + (h || 0)); }
  function worldPos(s, l, h) { return localPos(s, l, h).add(center); }
  function frameAt(dir) { const f = GameShared.projectTangent(T, dir); const r = new V3().crossVectors(f, dir).normalize(); return { r, u: dir, f }; }
  function put(obj, s, l, h) {          // local +X right, +Y up, +Z back toward the landing (-s)
    const dir = dirAt(s, l), fr = frameAt(dir);
    obj.position.copy(dir).multiplyScalar(R + (h || 0));
    obj.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(fr.r, fr.u, fr.f.clone().negate()));
    return obj;
  }
  const _c = new V3();
  function coordsAt(pos) { return coordsOf(_c.copy(pos).sub(center).normalize()); }
  function heightAt(pos) { return pos.distanceTo(center) - R; }

  // ---- terrain: one function for the mesh, the physics and the camera ----
  function floorH(s) {
    if (s < 58) return 0;
    if (s < 100) return LAYOUT.floorTop * smooth(58, 100, s);
    if (s < 118) return LAYOUT.floorTop;
    if (s < 137) return LAYOUT.floorTop - 2 * smooth(118, 134, s);
    return (LAYOUT.floorTop - 2) * (1 - smooth(139, 161, s));
  }
  function mountain(s, l) {
    const m = 26 * band(s, 43, 154, 3.5) * (1 - smooth(37, 42, Math.abs(l)));
    if (m <= 0) return 0;
    return m + (1.6 * Math.sin(s * 0.21 + l * 0.13) + 1.1 * Math.sin(l * 0.31 - s * 0.17)) * Math.min(1, m / 6);
  }
  function spur(s, l) {
    const sp = LAYOUT.spur;
    return sp.top * band(s, sp.s0, sp.s1, 1.4) * smooth(sp.open, sp.open + 0.9, Math.abs(l));
  }
  // half width of the open floor at s, on one side (side = sign of l)
  function halfWidth(s, side) {
    if (s < 43) return 99;
    if (s < 56) return 10;
    if (s < 58.5) return 10 - 5.5 * smooth(56, 58.5, s);
    if (s < 100) {
      let w = 4.5;
      for (const a of LAYOUT.alcoves) if (a.side === side) w = Math.max(w, 4.5 + 4 * band(s, a.s - 2.6, a.s + 2.6, 0.8));
      return w;
    }
    if (s < 117) return 4.5 + 5.5 * smooth(99, 102, s);
    if (s < 124) return 5;
    if (s < 136.6) return LAYOUT.chamber.half;
    return 4.5;
  }
  // the dead-end branch: a curve from the switch to the bumper
  function branchPoint(u) {
    const be = LAYOUT.branchEnd, s0 = LAYOUT.switchS;
    return { s: s0 + (be.s - s0) * u, l: be.l * smooth(0, 1, u) };
  }
  function branchDist(s, l) {
    if (s < 110 || s > 127 || l < -4 || l > 21) return 99;
    let best = 99;
    for (let i = 0; i <= 24; i++) { const p = branchPoint(i / 24); best = Math.min(best, Math.hypot(s - p.s, l - p.l)); }
    return best;
  }
  function openness(s, l) {
    const side = l < 0 ? -1 : 1;
    let o = 1 - smooth(halfWidth(s, side) - 0.4, halfWidth(s, side) + 0.8, Math.abs(l));
    const bd = branchDist(s, l);
    if (bd < 5) o = Math.max(o, 1 - smooth(2.8, 4, bd));
    const g = LAYOUT.grotto;
    if (s > g.s0 - 1 && s < g.s1 + 1 && l > g.l0 - 1 && l < g.l1 + 1)
      o = Math.max(o, band(s, g.s0, g.s1, 1) * band(l, g.l0, g.l1 + 0.6, 1));
    return o;
  }
  function terrainH(s, l) {
    const base = mountain(s, l) + spur(s, l);
    const f = floorH(s);
    if (s < 43) return base;                // jungle and the spur: no carving
    const o = openness(s, l);
    return base + (f - base) * o;
  }
  // steep ground (mountain and spur flanks) cannot be walked up and is slid down
  function slopeAt(s, l) {
    const e = 0.35;
    const gs = (terrainH(s + e, l) - terrainH(s - e, l)) / (2 * e), gl = (terrainH(s, l + e) - terrainH(s, l - e)) / (2 * e);
    return { mag: Math.hypot(gs, gl), gs, gl };
  }

  // ---- solids: boxes (s0..s1, l0..l1) or columns (cs, cl, r), heights above the base sphere ----
  const solids = [];
  function addSolid(o) { solids.push(o); return o; }
  const breakables = [];      // cracked rock: gone after a power punch
  for (const b of LAYOUT.boulders) breakables.push({ kind: "boulder", gold: b.gold, s: b.s, l: b.l, h: 1.1,
    solid: addSolid({ cs: b.s, cl: b.l, r: 1.25, bottom: 0, top: 2.2 }) });
  const sp = LAYOUT.spur;
  breakables.push({ kind: "wall", gold: 0, s: sp.wallS, l: 0, h: 2.2,
    solid: addSolid({ s0: sp.wallS - 0.6, s1: sp.wallS + 0.6, l0: -sp.open - 0.4, l1: sp.open + 0.4, bottom: 0, top: 5 }) });
  const gr = LAYOUT.grotto;
  breakables.push({ kind: "grotto", gold: 0, s: (gr.s0 + gr.s1) / 2, l: gr.wallL, h: 2.2,
    solid: addSolid({ s0: gr.s0 - 0.5, s1: gr.s1 + 0.5, l0: gr.wallL - 0.5, l1: gr.wallL + 0.5, bottom: 0, top: 6 }) });
  const blockSolid = addSolid({ s0: LAYOUT.block.s0, s1: LAYOUT.block.s1, l0: -1.2, l1: 1.2, bottom: LAYOUT.floorTop - 1, top: LAYOUT.floorTop + 2 });
  breakables.push({ kind: "block", gold: 0, s: (LAYOUT.block.s0 + LAYOUT.block.s1) / 2, l: 0, h: LAYOUT.floorTop + 1, solid: blockSolid });
  const shrineSolid = addSolid({ cs: LAYOUT.shrine.s, cl: LAYOUT.shrine.l, r: 0.9, bottom: 0, top: 0.5 });
  const cartSolid = addSolid({ cs: LAYOUT.cart.s, cl: 0, r: 1.45, bottom: LAYOUT.floorTop - 1, top: LAYOUT.floorTop + 2.1 });
  const dkSolid = addSolid({ cs: LAYOUT.dk.s, cl: LAYOUT.dk.l, r: 1.5, bottom: 5, top: floorH(LAYOUT.dk.s) + 3.2 });
  const sl = LAYOUT.slab;
  const slabSolid = addSolid({ s0: sl.s0, s1: sl.s1, l0: -sl.half, l1: sl.half, bottom: sl.bottom, top: sl.top });
  const rubbleSolid = addSolid({ s0: LAYOUT.rubble.s0, s1: LAYOUT.rubble.s1, l0: -5, l1: 5, bottom: 0, top: 13 });
  addSolid({ cs: LAYOUT.lever.s, cl: LAYOUT.lever.l, r: 0.45, bottom: 0, top: LAYOUT.floorTop + 1.0 });

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
    if (ground > curH + STEP) blocked = true;
    else if (ground > curH + 0.2 && slopeAt(c.s, c.l).mag > 1.25) blocked = true;    // too steep to walk up
    for (const o of solids) {
      if (o.gone || !inFoot(o, c.s, c.l)) continue;
      if (o.top <= curH + STEP) { if (o.top > ground) ground = o.top; }
      else if (o.bottom < curH + 1.6) blocked = true;
    }
    return { radius: R + ground, blocked, s: c.s, l: c.l, void: false };
  }
  function drift() { return new V3(); }

  // ---- terrain mesh ----
  const STRIP = { s0: -22, s1: 178, maxL: 64, hideS0: -18, hideS1: 174, hideL: 59, ds: 0.6, rows: 141 };
  const inHide = (c) => c.s > STRIP.hideS0 && c.s < STRIP.hideS1 && Math.abs(c.l) < STRIP.hideL;
  function shapeGround(geo) {
    const pos = geo.attributes.position, v = new V3();
    for (let i = 0; i < pos.count; i++) {
      v.set(pos.getX(i), pos.getY(i), pos.getZ(i)).normalize();
      const c = coordsOf(v);
      v.multiplyScalar(R + (inHide(c) ? -45 : terrainH(c.s, c.l)));
      pos.setXYZ(i, v.x, v.y, v.z);
    }
    pos.needsUpdate = true;
  }
  function smoothGround(geo, tint) {
    const pos = geo.attributes.position, col = geo.attributes.color, v = new V3(), c = new THREE.Color();
    const nrm = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      v.set(pos.getX(i), pos.getY(i), pos.getZ(i)).normalize();
      v.toArray(nrm, i * 3);
      tint(v, c); col.setXYZ(i, c.r, c.g, c.b);
    }
    geo.setAttribute("normal", new THREE.BufferAttribute(nrm, 3));
    col.needsUpdate = true;
  }
  function wantsSmooth() { return true; }
  function exitDir() { return dirAt(LAYOUT.gate.s, LAYOUT.gate.l); }

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
  // a box from a to b (both in the group frame, relative to the planet centre), w wide and t thick,
  // its "up" kept close to the planet's radial direction
  function beamBetween(a, b, w, t, color) {
    const d = new V3().subVectors(b, a), len = d.length();
    const m = box(w, t, +len.toFixed(2), color);
    m.position.copy(a).add(b).multiplyScalar(0.5);
    const z = d.clone().normalize(), upv = m.position.clone().normalize();
    const x = new V3().crossVectors(upv, z).normalize(), y = new V3().crossVectors(z, x);
    m.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
    group.add(m);
    return m;
  }

  // materials that change at night (glow) or show cracks
  let crackMat = null, lampMat = null, goldMat = null, coinMat = null;

  // ---- the ground strip: jungle, basalt flanks, mine floor ----
  function buildStrip() {
    const cols = Math.round((STRIP.s1 - STRIP.s0) / STRIP.ds) + 1, rows = STRIP.rows;
    const pos = new Float32Array(cols * rows * 3), colA = new Float32Array(cols * rows * 3);
    const basalt = [0x4a4655, 0x55505f, 0x3f3b49, 0x5d5866, 0x47424f].map(h => new THREE.Color(h));
    const floorC = new THREE.Color(0x7a6650), gravel = new THREE.Color(0x8a7a66), moss = new THREE.Color(0x3d7436), c = new THREE.Color(), g = new THREE.Color(), v = new V3();
    let n = 0;
    for (let j = 0; j < rows; j++) {
      const u = j / (rows - 1) * 2 - 1;
      const l = Math.sign(u) * Math.pow(Math.abs(u), 1.5) * STRIP.maxL;
      for (let i = 0; i < cols; i++, n++) {
        const s = STRIP.s0 + i * STRIP.ds;
        const h = terrainH(s, l);
        localPos(s, l, h).toArray(pos, n * 3);
        const f = floorH(s), rise = h - f;
        const o = s >= 43 ? openness(s, l) : 0;
        H.tint(dirAt(s, l, v), g);
        if (o > 0.6 && s >= 55) {                      // mine floor: packed earth, gravel along the track
          c.copy(floorC).lerp(gravel, Math.abs(l) < 1.6 ? 0.6 : 0.1).multiplyScalar(0.92 + 0.08 * Math.sin(s * 2.1 + l * 1.3));
        } else if (h > 1.2) {                          // basalt: bands by height, moss on the top
          const band = Math.floor((h + 0.8 * Math.sin(l * 0.4 + s * 0.3)) / 2.2);
          c.copy(basalt[((band % basalt.length) + basalt.length) % basalt.length]);
          c.multiplyScalar(0.93 + 0.07 * Math.sin(s * 0.9 + band));
          const top = mountain(s, l) > 20 || (spur(s, l) > 7.5 && s < 43);
          if (top && rise > 9) c.lerp(moss, 0.75);
        } else c.copy(g);
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
    const nrm = geo.attributes.normal;
    if (nrm.getX(0) * pos[0] + nrm.getY(0) * pos[1] + nrm.getZ(0) * pos[2] < 0) {
      for (let k = 0; k < idx.length; k += 3) { const t = idx[k + 1]; idx[k + 1] = idx[k + 2]; idx[k + 2] = t; }
      geo.setIndex(idx); geo.computeVertexNormals();
    }
    const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0,
      polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }));
    m.userData.noCast = true;
    group.add(m);
  }

  // ---- jungle: trees, ferns, basalt columns (instanced) ----
  function placeInstanced(geo, mat, list) {
    const im = new THREE.InstancedMesh(geo, mat, list.length);
    const mtx = new THREE.Matrix4(), q = new THREE.Quaternion(), spin = new THREE.Quaternion(), sc = new V3(), up = new V3(0, 1, 0);
    list.forEach((p, i) => {
      const dir = dirAt(p.s, p.l);
      q.setFromUnitVectors(up, dir); spin.setFromAxisAngle(up, p.rot || 0); q.multiply(spin);
      sc.set(p.k, p.k * (p.ky || 1), p.k);
      mtx.compose(dir.clone().multiplyScalar(R + p.h), q, sc);
      im.setMatrixAt(i, mtx);
      if (p.color && im.setColorAt) im.setColorAt(i, p.color);
    });
    im.instanceMatrix.needsUpdate = true;
    if (im.instanceColor) im.instanceColor.needsUpdate = true;
    group.add(im);
    return im;
  }
  function onRoute(s, l) {
    if (Math.abs(l) < 7.5 && s > -16 && s < 58) return true;
    if (Math.hypot(s, l) < 9) return true;
    return false;
  }
  function buildJungle(rand) {
    const trees = [], ferns = [], cols = [];
    const n = Math.round(260 * QUALITY.grass + 60);
    for (let i = 0; i < n * 3 && trees.length < n; i++) {
      const s = -20 + rand() * 200, l = (rand() * 2 - 1) * 62;
      const h = terrainH(s, l);
      if (onRoute(s, l) || h > 1.5 || (s > 42 && Math.abs(l) < 44) || Math.abs(l) > 60 && s > -16 && s < 174) continue;
      trees.push({ s, l, h: h - 0.1, k: 0.9 + rand() * 1.3, ky: 0.9 + rand() * 0.6, rot: rand() * 6.28 });
    }
    // a ring of jungle just outside the strip too, so the edge of the walkable belt reads as forest
    for (let i = 0; i < 160; i++) {
      const s = -20 + rand() * 200, l = (rand() < 0.5 ? -1 : 1) * (47 + rand() * 13);
      if (terrainH(s, l) > 1.5) continue;
      trees.push({ s, l, h: terrainH(s, l) - 0.1, k: 1.3 + rand() * 1.2, ky: 1 + rand() * 0.5, rot: rand() * 6.28 });
    }
    const nf = Math.round(900 * QUALITY.grass);
    for (let i = 0; i < nf * 3 && ferns.length < nf; i++) {
      const s = -20 + rand() * 200, l = (rand() * 2 - 1) * 58;
      const h = terrainH(s, l);
      if (h > 0.8 || Math.abs(l) < 3.2 && s < 58 || (s > 43 && openness(s, l) > 0.15)) continue;
      if (Math.hypot(s - LAYOUT.shrine.s, l) < 2.5) continue;
      const g = new THREE.Color().setHSL(0.27 + rand() * 0.07, 0.55, 0.28 + rand() * 0.12);
      ferns.push({ s, l, h: h - 0.05, k: 0.45 + rand() * 0.55, rot: rand() * 6.28, color: g });
    }
    for (let i = 0; i < 260; i++) {                    // basalt columns on the flanks and in the valley
      const s = 30 + rand() * 135, l = (rand() * 2 - 1) * 44;
      const h = terrainH(s, l);
      if (s > 56 && openness(s, l) > 0.2) continue;
      if (s < 56 && Math.abs(l) < 6) continue;
      if (Math.abs(s - LAYOUT.spur.wallS) < 3 && Math.abs(l) < 8) continue;
      const g = LAYOUT.grotto;
      if (s > g.s0 - 2 && s < g.s1 + 2 && l > g.l0 - 2 && l < g.l1 + 3) continue;
      if (h < 0.5 && !(s > 36 && s < 56)) continue;
      cols.push({ s, l, h: h - 0.4, k: 0.7 + rand() * 0.8, ky: 1 + rand() * 2.2, rot: rand() * 6.28,
        color: new THREE.Color(0x4a4655).multiplyScalar(0.85 + rand() * 0.3) });
    }
    const trunkG = new THREE.CylinderGeometry(0.22, 0.34, 4.2, 6); trunkG.translate(0, 2.1, 0);
    const crownG = new THREE.IcosahedronGeometry(1.7, 0); crownG.scale(1.25, 0.7, 1.25); crownG.translate(0, 4.6, 0);
    const crown2 = new THREE.IcosahedronGeometry(1.2, 0); crown2.scale(1.1, 0.8, 1.1); crown2.translate(0.6, 5.5, -0.3);
    const fernG = new THREE.ConeGeometry(0.55, 0.9, 5, 1, true); fernG.translate(0, 0.45, 0);
    const colG = new THREE.CylinderGeometry(0.8, 0.85, 2, 6); colG.translate(0, 1, 0);
    placeInstanced(trunkG, H.mat(0x6b4a2e), trees);
    placeInstanced(crownG, H.mat(0x2f7a35), trees);
    placeInstanced(crown2, H.mat(0x3c9440), trees);
    const fm = H.mat(0xffffff, { side: THREE.DoubleSide }); fm.userData = { noCastAll: true };
    const fi = placeInstanced(fernG, fm, ferns); fi.userData.noCast = true;
    placeInstanced(colG, H.mat(0xffffff, { roughness: 0.8 }), cols);
  }

  // ---- cracked basalt: a dark rock with glowing orange cracks; gold veins for the rich ones ----
  function crackLines(parent, w, h, d, n, seed) {
    let sd = seed;
    const r = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < n; i++) {
      const c = box(0.08, 0.6 + r() * h * 0.5, 0.08, crackMat);
      c.position.set((r() - 0.5) * w * 0.8, h * (0.2 + r() * 0.6), d / 2 + 0.01);
      c.rotation.z = (r() - 0.5) * 1.6;
      parent.add(c);
      const c2 = c.clone(); c2.position.z = -d / 2 - 0.01; c2.rotation.z = -c.rotation.z; parent.add(c2);
    }
  }
  function buildBreakables() {
    for (const b of breakables) {
      const g = new THREE.Group();
      if (b.kind === "boulder") {
        const rock = add(g, new THREE.Mesh(kitGeometry("boulder", () => new THREE.DodecahedronGeometry(1.25, 0)), kitMaterial(0x4f4a5a)), 0, 1.05, 0);
        rock.scale.set(1, 0.9, 1);
        for (let k = 0; k < 4; k++) {
          const c = add(g, box(0.09, 0.9, 0.09, crackMat), Math.sin(k * 1.7) * 0.6, 1.1 + Math.cos(k * 2.3) * 0.3, 0);
          c.rotation.set(k * 0.8, k * 1.57, 0.5 * Math.sin(k));
          c.translateZ(1.05);
        }
        if (b.gold) for (let k = 0; k < 5; k++) {
          const v = add(g, box(0.22, 0.12, 0.5, goldMat), Math.sin(k * 2.1) * 0.5, 0.7 + k * 0.2, 0);
          v.rotation.y = k * 1.25; v.translateZ(1.05);
        }
        group.add(put(g, b.s, b.l, terrainH(b.s, b.l)));
      } else if (b.kind === "wall" || b.kind === "grotto") {
        const across = b.kind === "wall" ? 2 * (LAYOUT.spur.open + 0.4) : LAYOUT.grotto.s1 - LAYOUT.grotto.s0 + 1;
        const wall = add(g, box(across, 5, 1.2, 0x48434f), 0, 2.5, 0);
        if (b.kind === "grotto") wall.rotation.y = Math.PI / 2;
        const holder = new THREE.Group(); holder.rotation.y = wall.rotation.y; g.add(holder);
        crackLines(holder, across, 5, 1.2, 9, b.kind === "wall" ? 7 : 11);
        if (b.kind === "grotto") for (let k = 0; k < 6; k++) {
          const v = add(holder, box(0.3, 0.14, 0.14, goldMat), (k - 2.5) * 0.9, 1 + (k % 3) * 1.1, 0.62);
          v.rotation.z = k * 0.7;
        }
        group.add(put(g, b.s, b.l, terrainH(b.s, b.l) - 0.05));
      } else if (b.kind === "block") {
        add(g, box(2.4, 2.1, 1.8, 0x3f3b49), 0, 1.05, 0);
        crackLines(g, 2.4, 2.1, 1.8, 5, 3);
        group.add(put(g, b.s, b.l, LAYOUT.floorTop));
        colliders.push(g);
      }
      b.mesh = g;
    }
  }

  // ---- mine: portal, timber frames with lamps, rails, alcove props ----
  function railLine(points, step) {
    // two rails and sleepers along a list of {s, l} points (heights from floorH)
    const sleepers = [];
    for (let i = 0; i < points.length - 1; i++) {
      const a = points[i], b = points[i + 1];
      const ds = b.s - a.s, dl = b.l - a.l, len = Math.hypot(ds, dl), ns = -dl / len, nl = ds / len;
      for (const side of [-0.62, 0.62]) {
        const pa = localPos(a.s + ns * side, a.l + nl * side, floorH(a.s) + 0.22);
        const pb = localPos(b.s + ns * side, b.l + nl * side, floorH(b.s) + 0.22);
        beamBetween(pa, pb, 0.1, 0.12, 0x6d6a72);
      }
    }
    let acc = 0;
    for (let i = 0; i < points.length - 1; i++) {
      const a = points[i], b = points[i + 1], len = Math.hypot(b.s - a.s, b.l - a.l);
      for (; acc < len; acc += step) {
        const k = acc / len, s = a.s + (b.s - a.s) * k, l = a.l + (b.l - a.l) * k;
        sleepers.push({ s, l, h: floorH(s) + 0.06, k: 1, rot: Math.atan2(b.l - a.l, b.s - a.s) });
      }
      acc -= len;
    }
    return sleepers;
  }
  function buildMine() {
    const wood = 0x9a7046, darkWood = 0x6e4c2c;
    // portal at the mine entrance
    const portal = new THREE.Group();
    add(portal, box(0.7, 6.2, 0.7, darkWood), -5, 3.1, 0);
    add(portal, box(0.7, 6.2, 0.7, darkWood), 5, 3.1, 0);
    add(portal, box(11.6, 0.8, 0.9, wood), 0, 6.3, 0);
    add(portal, box(3.6, 1.2, 0.2, 0x3a2a1c), 0, 7.3, 0.2);
    group.add(put(portal, 57.2, 0, floorH(57.2)));
    // timber frames along the climb, the junction and the exit; a lamp on every second one
    const frameAt = [];
    for (let s = 61; s < 99; s += 6) frameAt.push(s);
    frameAt.push(LAYOUT.monkeys[0].s, LAYOUT.monkeys[1].s, 120, 140, 146, 152);
    let lamp = 0;
    for (const s of frameAt) {
      const hw = Math.min(halfWidth(s, 1), halfWidth(s, -1)) + 0.2, f = floorH(s);
      const fr = new THREE.Group();
      add(fr, box(0.5, 7.4, 0.5, darkWood), -hw, 3.7, 0);
      add(fr, box(0.5, 7.4, 0.5, darkWood), hw, 3.7, 0);
      add(fr, box(2 * hw + 0.8, 0.55, 0.6, wood), 0, 7.3, 0);
      if (lamp++ % 2 === 0) { add(fr, box(0.08, 0.5, 0.08, 0x2a2a30), hw - 0.6, 6.8, 0.35); add(fr, ball(0.22, lampMat, null, 8, 6), hw - 0.6, 6.45, 0.35); }
      group.add(put(fr, s, 0, f));
    }
    // rails: the main line from the entrance to DK's chamber, and the dead-end branch
    const main = [];
    for (let s = LAYOUT.mineS + 0.5; s <= 128.6; s += 1.5) main.push({ s, l: 0 });
    const branch = [];
    for (let i = 0; i <= 14; i++) branch.push(branchPoint(i / 14));
    const sleepers = railLine(main, 0.9).concat(railLine(branch, 0.9));
    placeInstanced(new THREE.BoxGeometry(0.34, 0.12, 2.0), kitMaterial(0x5a3e26), sleepers.map(p => Object.assign(p, { rot: p.rot + Math.PI / 2 })));
    // bumpers at both track ends
    for (const p of [{ s: 128.8, l: 0, rot: 0 }, { s: LAYOUT.branchEnd.s + 0.5, l: LAYOUT.branchEnd.l, rot: 0 }]) {
      const b = new THREE.Group();
      add(b, box(2.2, 1.1, 0.5, 0x8a2a20), 0, 0.8, 0);
      add(b, box(0.3, 1.2, 0.3, darkWood), -0.9, 0.6, -0.4); add(b, box(0.3, 1.2, 0.3, darkWood), 0.9, 0.6, -0.4);
      group.add(put(b, p.s, p.l, floorH(p.s)));
    }
    // the alcoves: a crate and a lantern post in each, so they read as places to stand
    for (const a of LAYOUT.alcoves) {
      const g = new THREE.Group();
      add(g, box(1.1, 1.0, 1.1, 0x8a6a40), 1.3 * a.side, 0.5, 1.2);
      add(g, box(0.15, 2.4, 0.15, darkWood), 1.6 * a.side, 1.2, -1.4);
      add(g, ball(0.2, lampMat, null, 8, 6), 1.6 * a.side, 2.5, -1.4);
      group.add(put(g, a.s, a.side * 6.7, floorH(a.s)));
    }
    // dead-end sign: a red cross by the branch tunnel mouth
    const sign = new THREE.Group();
    add(sign, box(0.15, 2.2, 0.15, darkWood), 0, 1.1, 0);
    const x1 = add(sign, box(1.2, 0.22, 0.1, 0xc8302a), 0, 2.2, 0); x1.rotation.z = 0.7;
    const x2 = add(sign, box(1.2, 0.22, 0.1, 0xc8302a), 0, 2.2, 0); x2.rotation.z = -0.7;
    group.add(put(sign, 119.5, 11.5, floorH(119.5)));
    // DK's chamber: the sagging roof slab with a crack line
    const slab = new THREE.Group();
    const sl = LAYOUT.slab;
    const sm = add(slab, box(sl.s1 - sl.s0, sl.top - sl.bottom, 2 * sl.half, 0x433e4c), 0, (sl.top - sl.bottom) / 2, 0);
    sm.rotation.y = Math.PI / 2;
    for (let k = 0; k < 4; k++) add(slab, box(0.1, 0.12, 2.4, crackMat), -1.5 + k, 0.02, (k - 1.5) * 0.8).rotation.y = 0.4 * k;
    group.add(put(slab, (sl.s0 + sl.s1) / 2, 0, sl.bottom));
    colliders.push(slab);
    S.slabMesh = slab;
    // rubble that closes the exit until DK clears it
    const rub = new THREE.Group();
    for (let k = 0; k < 9; k++) {
      const r = add(rub, new THREE.Mesh(kitGeometry("boulder", () => new THREE.DodecahedronGeometry(1.25, 0)), kitMaterial(0x4f4a5a)), (k % 3 - 1) * 3, 1.0 + Math.floor(k / 3) * 1.9, (k % 2) * 0.3);
      r.scale.setScalar(1.1 + 0.3 * Math.sin(k * 3.1));
    }
    group.add(put(rub, (LAYOUT.rubble.s0 + LAYOUT.rubble.s1) / 2, 0, floorH(LAYOUT.rubble.s0)));
    colliders.push(rub);
    S.rubbleMesh = rub;
    // launch pad on the far side
    const pad = new THREE.Group();
    add(pad, cyl(3.2, 3.6, 0.5, 20, 0x5a5f78), 0, 0.25, 0);
    add(pad, cyl(2.4, 2.4, 0.08, 20, 0x8fd8ff, { emissive: 0x38c6ff, emissiveIntensity: 0.6 }), 0, 0.54, 0);
    group.add(put(pad, LAYOUT.pad.s, LAYOUT.pad.l, 0));
  }

  // ---- the power glove shrine ----
  function buildShrine() {
    const g = new THREE.Group();
    add(g, cyl(0.9, 1.05, 0.5, 8, 0x5a5566), 0, 0.25, 0);
    const glove = new THREE.Group(); glove.position.y = 1.5; g.add(glove);
    add(glove, ball(0.36, 0xffb030, { emissive: 0xff7a10, emissiveIntensity: 0.8, flatShading: false }, 14, 10), 0, 0, 0).scale.set(1, 0.85, 1.15);
    add(glove, cyl(0.26, 0.3, 0.32, 10, 0xffffff, { emissive: 0xffd080, emissiveIntensity: 0.4 }), 0, -0.05, -0.42).rotation.x = Math.PI / 2;
    const halo = new THREE.Mesh(new THREE.SphereGeometry(0.9, 14, 10), new THREE.MeshBasicMaterial({ color: 0xffa040, transparent: true, opacity: 0.25, blending: THREE.AdditiveBlending, depthWrite: false }));
    glove.add(halo);
    g.add(H.makeBeam(0xffa040, 40));
    group.add(put(g, LAYOUT.shrine.s, LAYOUT.shrine.l, 0));
    S.glove = glove; S.shrine = g;
  }

  // ---- coins ----
  const coins = [];
  function makeCoin(s, l, h, hidden) {
    const c = new THREE.Mesh(kitGeometry("coin", () => { const g = new THREE.CylinderGeometry(0.42, 0.42, 0.1, 16); g.rotateX(Math.PI / 2); return g; }), coinMat);
    const holder = new THREE.Group(); holder.add(c); c.position.y = 1.0;
    group.add(put(holder, s, l, h));
    const e = { s, l, h, holder, spin: c, taken: false, hidden: !!hidden, base: { s, l, h } };
    holder.visible = !hidden;
    coins.push(e);
    return e;
  }
  function buildCoins() {
    const g = LAYOUT.grotto;
    for (let k = 0; k < g.coins; k++) makeCoin(g.s0 + 1 + (k % 4) * 1.3, g.l0 + 2.5 + Math.floor(k / 4) * 2.6, 0, false);
    // the gold-vein boulder and the beetle drop theirs when they break
    S.veinCoins = [];
    for (let k = 0; k < 5; k++) S.veinCoins.push(makeCoin(23 + Math.cos(k * 1.26) * 1.6, 3.8 + Math.sin(k * 1.26) * 1.6, 0, true));
    S.beetleCoins = [];
    for (let k = 0; k < 3; k++) S.beetleCoins.push(makeCoin(0, 0, 0, true));
  }

  // ---- characters: stand-ins under GLB slots (js/models.js) ----
  function withModel(id, parent, keep, opts) {
    const stand = new THREE.Group(); stand.name = "stand-in";
    for (const c of parent.children.slice()) if (!keep.includes(c)) stand.add(c);
    parent.add(stand);
    return Models.load(id, parent, stand, opts);
  }
  function eyes(parent, y, z, r, gap) {
    for (const x of [-gap, gap]) {
      const e = add(parent, ball(r, 0xfffaf0, { flatShading: false }, 10, 8), x, y, z);
      add(e, ball(r * 0.5, 0x1a1420, { flatShading: false }, 8, 6), 0, 0, r * 0.7);
    }
  }
  function makeLuigi() {
    const g = new THREE.Group();
    add(g, box(0.55, 0.7, 0.4, 0x2a4fd0), 0, 0.45, 0);
    add(g, box(0.62, 0.55, 0.42, 0x2eaa4a), 0, 1.05, 0);
    add(g, ball(0.27, 0xffc79a, { flatShading: false }), 0, 1.5, 0);
    add(g, cyl(0.29, 0.29, 0.16, 12, 0x2eaa4a), 0, 1.72, 0);
    add(g, box(0.42, 0.06, 0.24, 0x2eaa4a), 0, 1.66, 0.22);
    const armR = new THREE.Group(); armR.position.set(0.38, 1.25, 0); g.add(armR);
    add(armR, box(0.16, 0.55, 0.16, 0x2eaa4a), 0, -0.25, 0);
    const lantern = new THREE.Group(); lantern.position.set(-0.5, 0.85, 0.15); g.add(lantern);
    add(lantern, box(0.24, 0.3, 0.24, 0x3a3a46), 0, 0, 0);
    add(lantern, ball(0.16, lampMat, null, 8, 6), 0, 0, 0);
    return { g, armR, lantern };
  }
  function makeDK() {
    const g = new THREE.Group();
    const brown = 0x6a3f22, tan = 0xd9a873;
    add(g, ball(1.05, brown, { flatShading: false }, 16, 12), 0, 1.35, 0).scale.set(1.05, 1.0, 0.85);
    add(g, ball(0.6, tan, { flatShading: false }), 0, 1.25, 0.55).scale.set(1, 1.1, 0.5);
    add(g, ball(0.55, brown, { flatShading: false }), 0, 2.45, 0.15);
    add(g, ball(0.38, tan, { flatShading: false }), 0, 2.38, 0.5).scale.set(1.1, 0.8, 0.7);
    eyes(g, 2.6, 0.58, 0.1, 0.17);
    add(g, box(0.5, 0.75, 0.12, 0xd02a20), 0, 1.75, 0.82).rotation.x = -0.2;   // tie
    const arms = [];
    for (const sx of [-1, 1]) {
      const a = new THREE.Group(); a.position.set(sx * 0.95, 2.1, 0); g.add(a);
      add(a, cyl(0.28, 0.32, 1.5, 10, brown, { flatShading: false }), 0, 0.75, 0);
      add(a, ball(0.36, tan, { flatShading: false }), 0, 1.55, 0);
      a.rotation.z = sx * -0.35;
      arms.push(a);
    }
    for (const sx of [-1, 1]) add(g, cyl(0.3, 0.36, 0.7, 10, brown), sx * 0.5, 0.35, 0);
    return { g, arms };
  }
  function makeBeetle() {
    const g = new THREE.Group();
    const body = new THREE.Group(); g.add(body);
    const shell = add(body, new THREE.Mesh(new THREE.SphereGeometry(0.95, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), H.mat(0x34303e, { flatShading: false, roughness: 0.4 })), 0, 0.35, -0.05);
    shell.scale.set(0.95, 1.0, 1.1);
    add(body, box(1.5, 0.75, 0.25, 0x23202b), 0, 0.75, 0.95).rotation.x = -0.25;   // the armoured front plate
    add(body, ball(0.35, 0x2b2733, { flatShading: false }), 0, 0.45, 0.9);
    eyes(body, 0.55, 1.15, 0.09, 0.15);
    const back = new THREE.Group(); back.position.set(0, 0.55, -0.6); body.add(back);
    for (let k = 0; k < 5; k++) { const c = add(back, box(0.08, 0.7, 0.08, crackMat), (k - 2) * 0.22, 0.25, -0.35); c.rotation.z = (k - 2) * 0.35; c.rotation.x = 0.6; }
    for (const [x, z] of [[-0.6, 0.4], [0.6, 0.4], [-0.65, -0.3], [0.65, -0.3]]) add(body, cyl(0.12, 0.14, 0.4, 6, 0x1c1a22), x, 0.18, z);
    return { g, body, back };
  }
  function makeMonkey() {
    const g = new THREE.Group();
    const body = new THREE.Group(); g.add(body);
    add(body, ball(0.35, 0x8a5a30, { flatShading: false }), 0, 0.45, 0);
    add(body, ball(0.28, 0x8a5a30, { flatShading: false }), 0, 0.95, 0.05);
    add(body, ball(0.18, 0xe8c090, { flatShading: false }), 0, 0.9, 0.24).scale.set(1.2, 0.9, 0.6);
    eyes(body, 1.02, 0.28, 0.06, 0.09);
    const tail = add(body, cyl(0.05, 0.05, 0.9, 5, 0x8a5a30), 0, 0.5, -0.45); tail.rotation.x = 1.0;
    const stone = add(g, ball(0.42, 0x4f4a5a, null, 8, 6), 0, 1.6, 0.2);
    return { g, body, stone };
  }
  function makeJr() {
    const g = new THREE.Group();
    add(g, ball(0.5, 0xe0c040, { flatShading: false }), 0, 0.6, 0).scale.set(1, 1.05, 0.95);
    add(g, ball(0.42, 0x3f8a3a, { flatShading: false }), 0, 0.65, -0.3);                 // shell
    add(g, ball(0.42, 0xe8d060, { flatShading: false }), 0, 1.35, 0.05);
    add(g, box(0.5, 0.35, 0.12, 0xffffff), 0, 0.85, 0.45);                              // bib
    add(g, cyl(0.06, 0.22, 0.3, 6, 0xff7a20), 0, 1.78, -0.05);                          // hair tuft
    eyes(g, 1.45, 0.36, 0.08, 0.14);
    const brush = new THREE.Group(); brush.position.set(0.55, 1.0, 0.1); g.add(brush);
    add(brush, cyl(0.06, 0.06, 1.6, 6, 0x8a5a30), 0, 0.6, 0);
    const tip = add(brush, ball(0.2, 0xb050ff, { emissive: 0x8020ff, emissiveIntensity: 0.6 }, 10, 8), 0, 1.45, 0);
    tip.scale.set(1, 1.5, 1);
    return { g, brush, tip };
  }

  // ---- night / glow materials ----
  function makeMaterials() {
    crackMat = H.mat(0xff8a30, { emissive: 0xff6010, emissiveIntensity: 0.9 }); mergeMats.add(crackMat);
    lampMat = H.mat(0xffe9a0, { emissive: 0xffc860, emissiveIntensity: 1.2 }); mergeMats.add(lampMat);
    goldMat = H.mat(0xffd040, { emissive: 0xc08010, emissiveIntensity: 0.7, roughness: 0.35, metalness: 0.4 }); mergeMats.add(goldMat);
    coinMat = H.mat(0xffd84a, { emissive: 0xffa020, emissiveIntensity: 0.6, roughness: 0.3, metalness: 0.5, flatShading: false });
  }

  // merge static meshes whose material is shared, one mesh per material (docs/performance-rules.md)
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
      const bg = new THREE.BufferGeometry();
      bg.setAttribute("position", new THREE.BufferAttribute(pos, 3));
      bg.setAttribute("normal", new THREE.BufferAttribute(nrm, 3));
      bg.computeBoundingSphere();
      group.add(new THREE.Mesh(bg, mat));
    }
    return { meshes: victims.length, into: byMat.size };
  }

  let luigi = null, dk = null, beetle = null, monkeys = [], jr = null, cart = null, lever = null, arrow = null, spareBeam = null, dkBeam = null;
  function build(p, grp, helpers) {
    planet = p; group = grp; H = helpers;
    makeMaterials();
    buildStrip();
    if (FX.jungle) buildJungle(H.rng(4242));
    buildMine();
    buildBreakables();
    buildShrine();
    buildCoins();

    // the switch lever and its arrow sign (straight = to DK, right = the dead end)
    const lv = new THREE.Group();
    add(lv, box(0.8, 0.8, 0.8, 0x44444e), 0, 0.4, 0);
    const stick = new THREE.Group(); stick.position.y = 0.8; lv.add(stick);
    add(stick, cyl(0.07, 0.07, 1.3, 6, 0x333340), 0, 0.65, 0);
    add(stick, ball(0.22, 0x2eaa4a, { emissive: 0x108020, emissiveIntensity: 0.4 }), 0, 1.3, 0);
    group.add(put(lv, LAYOUT.lever.s, LAYOUT.lever.l, LAYOUT.floorTop));
    const sign = new THREE.Group();
    add(sign, box(0.15, 3.2, 0.15, 0x6e4c2c), 0, 1.6, 0);
    const ar = new THREE.Group(); ar.position.y = 3.4; sign.add(ar);
    add(ar, box(0.22, 0.18, 1.3, 0xffe060, { emissive: 0xffb020, emissiveIntensity: 0.7 }), 0, 0, 0.1);
    const head = add(ar, new THREE.Mesh(new THREE.ConeGeometry(0.4, 0.6, 4), H.mat(0xffe060, { emissive: 0xffb020, emissiveIntensity: 0.7 })), 0, 0, -0.75);
    head.rotation.x = -Math.PI / 2;
    group.add(put(sign, LAYOUT.switchS - 1.0, -2.2, LAYOUT.floorTop));
    lever = { g: lv, stick }; arrow = ar;

    // the beam cart: a mine cart loaded with three beams
    cart = new THREE.Group();
    add(cart, box(2.0, 1.1, 3.0, 0x6a3f24), 0, 0.95, 0);
    add(cart, box(2.2, 0.15, 3.2, 0x3a2416), 0, 1.55, 0);
    for (const x of [-0.75, 0.75]) for (const z of [-1.0, 1.0]) { const w = add(cart, cyl(0.38, 0.38, 0.25, 12, 0x2a2a30), x, 0.4, z); w.rotation.z = Math.PI / 2; }
    for (let k = 0; k < 3; k++) add(cart, box(0.35, 0.35, 3.6, 0xc8955a), (k - 1) * 0.45, 1.85 + (k === 1 ? 0.3 : 0), 0);
    group.add(cart);
    colliders.push(cart);
    spareBeam = box(0.4, 3.0, 0.4, 0xc8955a); spareBeam.visible = false; group.add(spareBeam);

    luigi = makeLuigi(); luigi.model = withModel("luigi", luigi.g, [luigi.lantern]); group.add(luigi.g);
    dk = makeDK(); dk.model = withModel("dk", dk.g, []); group.add(dk.g);
    dkBeam = box(0.45, 2.6, 0.45, 0xc8955a);
    group.add(put(dkBeam, LAYOUT.dk.s, LAYOUT.dk.l, LAYOUT.slab.bottom - 1.3));
    dkBeam.translateY(0);
    beetle = makeBeetle(); beetle.model = withModel("buzzy", beetle.body, [beetle.back]); group.add(beetle.g);
    monkeys = LAYOUT.monkeys.map(m => { const k = makeMonkey(); k.model = withModel("ukiki", k.body, []); group.add(k.g); return Object.assign(k, { def: m }); });
    jr = makeJr(); jr.model = withModel("bowserjr", jr.g, [jr.brush]); group.add(jr.g);

    S.stones = [];
    S.stoneMeshes = [];
    for (let i = 0; i < 12; i++) {
      const m = new THREE.Mesh(kitGeometry("stone", () => new THREE.DodecahedronGeometry(1.5, 1)), H.mat(0x57525f, { flatShading: true }));
      m.visible = false; group.add(m); S.stoneMeshes.push(m);
    }
    // the paint blob the young villain throws
    S.paint = new THREE.Mesh(new THREE.SphereGeometry(0.4, 10, 8), new THREE.MeshBasicMaterial({ color: 0xb050ff }));
    S.paint.visible = false; group.add(S.paint);
    S.splat = new THREE.Mesh(new THREE.CircleGeometry(1.6, 20), new THREE.MeshBasicMaterial({ color: 0x9a40ff, transparent: true, opacity: 0.85, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3 }));
    S.splat.visible = false; group.add(S.splat);

    const keep = [S.shrine, cart, lever.g, arrow, luigi.g, dk.g, dkBeam, spareBeam, beetle.g, jr.g, S.paint, S.splat, S.rubbleMesh]
      .concat(monkeys.map(m => m.g), breakables.map(b => b.mesh), coins.map(c => c.holder), S.stoneMeshes);
    if (FX.merge) S.mergeInfo = mergeStatic(keep);
    // characters cast shadows; the big strip does not
  }

  // ============================================================
  // runtime
  // ============================================================
  function faceObj(obj, up, f) {
    const r = new V3().crossVectors(up, f).normalize();
    obj.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(r, up, f));
  }
  function placeAt(obj, s, l, h, faceS, faceL) {   // put obj at (s, l, h), its +Z facing toward (faceS, faceL)
    const p = localPos(s, l, h), up = p.clone().normalize();
    obj.position.copy(p);
    const to = GameShared.projectTangent(localPos(faceS, faceL, h).sub(p), up);
    faceObj(obj, up, to);
  }

  function reset() {
    S.t = 0; S.splits = []; S.cp = 0; S.hints = {}; S.coins = 0;
    S.hasPower = false; S.thudT = 2.5; S.thudN = 0;
    S.switchStraight = false; S.luigiLatch = false; S.switchCount = 0;
    S.cart = { state: "parked", s: LAYOUT.cart.s, l: 0, u: 0, v: 0, t: 0 };
    S.rescued = false; S.rescueT = 0; S.rescueCount = 0; S.beamWarnT = 0; S.beamWarns = 0;
    S.jr = { state: "off", t: 0 }; S.gateOpen = false;
    S.luigi = { state: "landing", t: 0 };
    S.dk = { state: "holding", s: LAYOUT.dk.s, l: LAYOUT.dk.l };
    S.stones = []; S.monkeys = LAYOUT.monkeys.map(() => ({ t: 1.0, fled: false, fleeT: 0 }));
    for (const b of breakables) { b.solid.gone = false; if (b.mesh) b.mesh.visible = true; }
    rubbleSolid.gone = false; if (S.rubbleMesh) S.rubbleMesh.visible = true;
    cartSolid.cs = LAYOUT.cart.s; cartSolid.cl = 0;
    dkSolid.cs = LAYOUT.dk.s; dkSolid.cl = 0;
    for (const c of coins) { c.taken = false; c.holder.visible = !c.hidden; if (c.hidden) c.revealed = false; }
    if (S.glove) { S.shrine.visible = true; }
    if (group) {
      placeAt(luigi.g, 1.5, 2.6, 0, 6, 2.6); luigi.g.visible = true;
      placeAt(dk.g, LAYOUT.dk.s, LAYOUT.dk.l, floorH(LAYOUT.dk.s), LAYOUT.dk.s - 5, 0);
      dk.arms.forEach((a, i) => { a.rotation.z = (i ? -1 : 1) * 0.35; });
      dkBeam.visible = true; spareBeam.visible = false;
      jr.g.visible = false; S.paint.visible = false; S.splat.visible = false;
      for (const m of S.stoneMeshes) m.visible = false;
      monkeys.forEach(m => { m.g.visible = true; });
      if (planet && planet.gate) planet.gate.holder.visible = false;
    }
    initBeetle();
    if (env && env.P) env.P.hasPower = false;
  }

  // ---- beetle ----
  function initBeetle() {
    const L = LAYOUT.beetle;
    S.beetle = { state: "idle", t: 0, s: L.s, l: L.l, fs: -1, fl: 0, dead: false, knock: 0 };
  }
  function updateBeetle(dt, P, ctx, hs, hl, hh) {
    const e = S.beetle, L = LAYOUT.beetle;
    if (e.dead) {
      e.t += dt;
      beetle.g.scale.setScalar(Math.max(0.01, 1 - e.t * 1.2));
      if (e.t > 0.9) beetle.g.visible = false;
      return;
    }
    e.t += dt;
    const ds = hs - e.s, dl = hl - e.l, dist = Math.hypot(ds, dl);
    const sees = dist < TUNE.beetle.sightRange && hh < 3 && hs > L.s0 - 4 && hs < L.s1 + 4;
    let speed = 0;
    if (e.state === "idle") {
      const a = S.t * 0.5;
      e.fs = Math.cos(a); e.fl = Math.sin(a); speed = 1.2;
      if (Math.hypot(e.s - L.s, e.l - L.l) > 3) { e.fs = L.s - e.s; e.fl = L.l - e.l; const n = Math.hypot(e.fs, e.fl); e.fs /= n; e.fl /= n; }
      if (sees) { e.state = "alert"; e.t = 0; ctx.Audio.tone(220, 0.25, "square", 0.1, 160); }
    } else if (e.state === "alert") {
      e.fs = ds / (dist || 1); e.fl = dl / (dist || 1);
      if (e.t > TUNE.beetle.warnTime) { e.state = "charge"; e.t = 0; e.lockS = e.fs; e.lockL = e.fl; }
    } else if (e.state === "charge") {
      e.fs = e.lockS; e.fl = e.lockL; speed = TUNE.beetle.chargeSpeed;
      const ns = e.s + e.fs * speed * dt, nl = e.l + e.fl * speed * dt;
      const wall = ns < L.s0 || ns > L.s1 || nl < L.l0 || nl > L.l1;
      if (dist < 1.4 && hh < 1.5) { ctx.hurt(GameShared.projectTangent(localPos(hs, hl, 0).sub(localPos(e.s, e.l, 0)), dirAt(hs, hl))); e.state = "recover"; e.t = 0; speed = 0; }
      else if (wall || e.t > TUNE.beetle.chargeTime) {        // missed: horns stuck in the rock, cracked back exposed
        e.state = "stuck"; e.t = 0; speed = 0;
        ctx.Audio.boom(); ctx.shake(0.12);
        ctx.Particles.spawn(worldPos(e.s + e.fs * 1.2, e.l + e.fl * 1.2, 0.4), 0x8a8070, 14, 3);
        once("beetleStuck", ctx, P.hasPower ? "It's stuck! Hit its glowing back with a Power Punch." : "It's stuck! Its back is cracked.");
      }
    } else if (e.state === "stuck") {
      if (e.t > TUNE.beetle.stuckTime) { e.state = "recover"; e.t = 0; }
    } else if (e.state === "recover") {
      if (e.t > 0.9) { e.state = dist < TUNE.beetle.sightRange ? "alert" : "idle"; e.t = 0; }
    }
    if (e.knock > 0) {                         // pushed back by a punch on its armour
      const k = Math.min(e.knock, 9 * dt); e.knock -= k;
      e.s -= e.fs * k; e.l -= e.fl * k;
    }
    e.s = clamp(e.s + e.fs * speed * dt, L.s0, L.s1); e.l = clamp(e.l + e.fl * speed * dt, L.l0, L.l1);
    placeAt(beetle.g, e.s, e.l, terrainH(e.s, e.l), e.s + e.fs, e.l + e.fl);
    const stuck = e.state === "stuck";
    beetle.body.rotation.x = stuck ? 0.45 : 0;
    beetle.body.position.y = stuck ? -0.15 : (speed > 2 ? Math.abs(Math.sin(S.t * 22)) * 0.12 : 0);
    beetle.body.position.z = stuck ? 0.25 : 0;
    beetle.back.scale.setScalar(stuck ? 1.25 + 0.15 * Math.sin(S.t * 10) : 1);
  }

  // ---- monkeys and rolling stones ----
  function updateMonkeys(dt, P, ctx, hs, hl, hh) {
    LAYOUT.monkeys.forEach((m, i) => {
      const st = S.monkeys[i], mk = monkeys[i], f = floorH(m.s);
      if (st.fled) {
        st.fleeT += dt;
        if (st.fleeT < 1.2) placeAt(mk.g, m.s, 2 + st.fleeT * 3, f + 7.6 + st.fleeT * 6, m.s - 4, 0);
        else mk.g.visible = false;
        return;
      }
      placeAt(mk.g, m.s, 2.0, f + 7.6, m.s - 4, hl);
      mk.body.position.y = Math.abs(Math.sin(S.t * 3 + i)) * 0.12;
      if (hs > m.s - 3.5 && hs < m.s + 6 && hh > f - 1) {              // the hero reached the beam: it runs off
        st.fled = true; st.fleeT = 0; ctx.Audio.tone(1200, 0.2, "square", 0.08, 1800);
        return;
      }
      const active = hs > m.from && hs < m.to;
      mk.stone.visible = active;
      if (!active) return;
      st.t -= dt;
      if (st.t <= 0) {
        st.t = TUNE.rocks.interval;
        for (const lane of [-2.6, 0, 2.6]) S.stones.push({ s: m.s - 1.5, l: lane, r: 1.5, rot: 0 });   // a full wave: only the alcoves are safe
        ctx.Audio.tone(160, 0.3, "triangle", 0.1, 90);
      }
    });
    // stones roll down the track (toward -s)
    const keep = [];
    for (const st of S.stones) {
      st.s -= TUNE.rocks.speed * dt; st.rot += TUNE.rocks.speed * dt / st.r;
      if (st.s < LAYOUT.mineS + 0.5 || st.gone) { if (!st.gone) ctx.Particles.spawn(worldPos(st.s, st.l, floorH(st.s) + 1), 0x8a8070, 8, 2.5); continue; }
      const f = floorH(st.s);
      if (Math.hypot(hs - st.s, hl - st.l) < st.r + 0.55 && hh - f < 2 * st.r + 0.1 && P.invuln <= 0) {
        ctx.hurt(GameShared.projectTangent(localPos(hs - 3, hl, 0).sub(localPos(hs, hl, 0)), dirAt(hs, hl)));
        once("stoneHit", ctx, "Duck into the alcoves with the lanterns when the stones come!");
      }
      keep.push(st);
    }
    S.stones = keep.slice(0, S.stoneMeshes.length);
    S.stoneMeshes.forEach((m, i) => {
      const st = S.stones[i];
      m.visible = !!st;
      if (!st) return;
      placeAt(m, st.s, st.l, floorH(st.s) + st.r * 0.9, st.s - 1, st.l);
      m.rotateX(-st.rot);
    });
  }

  // ---- the cart, the switch and Luigi ----
  function cartPos(c) {
    if (c.u > 0) { const p = branchPoint(Math.min(1, c.u)); return { s: p.s, l: p.l }; }
    return { s: c.s, l: 0 };
  }
  function updateCart(dt, P, ctx, hs, hl, hh) {
    const c = S.cart;
    c.t += dt;
    if (c.state === "rolling") {
      c.v = Math.min(6.5, c.v + 3.2 * dt);
      if (c.u > 0 || (!S.switchStraight && c.s >= LAYOUT.switchS)) {
        if (c.u === 0) c.u = 0.0001;
        c.u += c.v * dt / 20;                             // the branch is about 20 units long
        if (c.u >= 1) {                                   // the dead end: crash, then try again
          c.u = 1; c.state = "crashed"; c.t = 0;
          const p = cartPos(c);
          ctx.Audio.boom(); ctx.shake(0.25);
          ctx.Particles.spawn(worldPos(p.s, p.l, floorH(p.s) + 1.5), 0xc8955a, 26, 5);
          ctx.toast("Crash! Wrong tunnel.", 1800);
          ctx.hint("The thuds come from the straight tunnel.\nWalk up to Luigi to switch the track, then free the cart again.", 7000);
        }
      } else {
        c.s += c.v * dt;
        if (c.s >= LAYOUT.cartStop) { c.s = LAYOUT.cartStop; c.state = "arrived"; c.t = 0; startRescue(ctx); }
      }
      // a rolling cart knocks the hero aside
      const p = cartPos(c);
      if (Math.hypot(hs - p.s, hl - p.l) < 1.9 && hh - floorH(p.s) < 2.4) ctx.hurt(GameShared.projectTangent(localPos(hs, hl, 0).sub(localPos(p.s, p.l, 0)), dirAt(hs, hl)));
    } else if (c.state === "crashed" && c.t > 2.6) {
      ctx.fade();
      c.state = "parked"; c.s = LAYOUT.cart.s; c.u = 0; c.v = 0;
      const b = breakables.find(x => x.kind === "block"); b.solid.gone = false; b.mesh.visible = true;
    }
    const p = cartPos(c);
    const f = floorH(p.s);
    let aheadS = p.s + 1, aheadL = p.l;
    if (c.u > 0) { const q = branchPoint(Math.min(1, c.u + 0.05)); aheadS = q.s; aheadL = q.l; }
    placeAt(cart, p.s, p.l, f + 0.05, aheadS, aheadL);
    cart.rotateY(Math.PI);
    cart.visible = c.state !== "crashed" || c.t < 0.15;
    cartSolid.cs = p.s; cartSolid.cl = p.l; cartSolid.top = f + 2.1; cartSolid.bottom = f - 1;
    cartSolid.gone = c.state === "crashed";
  }
  function updateSwitch(dt, P, ctx, hs, hl, hh) {
    // Luigi throws the switch when the hero walks up to him
    const L = LAYOUT.luigi;
    if (S.luigi.state !== "switch") return;
    const d = Math.hypot(hs - L.s, hl - L.l);
    if (d < 2.3 && Math.abs(hh - LAYOUT.floorTop) < 2 && !S.luigiLatch && S.cart.state !== "rolling") {
      S.luigiLatch = true; S.switchStraight = !S.switchStraight; S.switchCount++; S.pullT = 0;
      ctx.Audio.tone(520, 0.12, "square", 0.1); setTimeout(() => ctx.Audio.tone(380, 0.18, "square", 0.1), 120);
      ctx.toast(S.switchStraight ? "Luigi: Straight ahead, to the thuds!" : "Luigi: Track to the right.", 1800);
    }
    if (d > 3.6) S.luigiLatch = false;
    S.pullT = (S.pullT || 0) + dt;
    const target = S.switchStraight ? 0.6 : -0.6;
    lever.stick.rotation.x += (target - lever.stick.rotation.x) * Math.min(1, dt * 8);
    arrow.rotation.y += ((S.switchStraight ? 0 : -Math.PI / 2) - arrow.rotation.y) * Math.min(1, dt * 8);
    luigi.armR.rotation.x = S.pullT < 0.6 ? -1.2 * Math.sin(S.pullT / 0.6 * Math.PI) : 0;
  }
  function updateLuigi(dt, P, ctx, hs, hl) {
    const st = S.luigi; st.t += dt;
    if (st.state === "landing") {
      placeAt(luigi.g, 1.5, 2.6, 0, hs, hl);
      if (st.t > 4.5) { st.state = "run"; st.t = 0; st.s = 1.5; }
    } else if (st.state === "run") {                  // he runs ahead along the route and on into the mine
      st.s += 7 * dt;
      placeAt(luigi.g, st.s, 2.6, terrainH(st.s, 2.6), st.s + 2, 2.6);
      if (st.s > 28) { st.state = "switch"; st.t = 0; }
    } else if (st.state === "switch") {
      const L = LAYOUT.luigi;
      placeAt(luigi.g, L.s, L.l, LAYOUT.floorTop, hs, hl);
      luigi.g.visible = true;
    } else if (st.state === "exit") {
      placeAt(luigi.g, LAYOUT.pad.s - 2, -3.5, 0, hs, hl);
    }
    luigi.lantern.children[1].material.emissiveIntensity = 1.2;
  }

  // ---- DK: thuds, the beam, the rescue ----
  function thud(ctx, hs, hl) {
    const d = Math.hypot(hs - LAYOUT.dk.s, hl - LAYOUT.dk.l);
    const k = clamp(1 - d / 170, 0.15, 1);
    ctx.Audio.tone(62, 0.32, "sine", 0.32 * k, 38); ctx.Audio.noise(0.12, 0.12 * k);
    ctx.shake(0.06 + 0.16 * k);
    ctx.Particles.spawn(worldPos(119.5, 0, floorH(119.5) + 6.5), 0xa89a88, 10, 2.2);       // dust from DK's tunnel mouth
    if (d > 60) ctx.Particles.spawn(worldPos(110, 0, 30), 0xb8ac9a, 14, 5);                  // and from the mountain top, seen from afar
    if (dk && S.dk.state === "holding") dk.arms.forEach((a, i) => { a.rotation.x = -0.25; });
  }
  function updateThuds(dt, ctx, hs, hl) {
    if (S.rescued) return;
    S.thudT -= dt;
    if (S.thudT <= 0) {
      thud(ctx, hs, hl);
      S.thudN++;
      if (S.thudN < 3) S.thudT = 0.5;
      else {
        S.thudN = 0;
        const d = Math.hypot(hs - LAYOUT.dk.s, hl);
        S.thudT = 3.5 + 5 * clamp(d / 140, 0, 1);       // he answers faster as the hero comes closer
      }
    }
    if (dk && S.dk.state === "holding") dk.arms.forEach(a => { a.rotation.x *= 0.9; });
  }
  function startRescue(ctx) {
    if (S.rescued) return;
    S.rescued = true; S.rescueT = 0; S.rescueCount++;
    split("rescue");
    ctx.toast("The beams reached DK!", 2400);
    ctx.Audio.gate();
  }
  function updateRescue(dt, P, ctx, hs, hl) {
    if (!S.rescued) return;
    S.rescueT += dt;
    const t = S.rescueT, f = floorH(LAYOUT.dk.s);
    if (t < 2.4) {                                   // DK takes a spare beam from the cart and props the roof
      const k = smooth(0.4, 2.4, t);
      spareBeam.visible = t > 0.4;
      const a = localPos(LAYOUT.cartStop, 0, f + 2.2), b = localPos(LAYOUT.dk.s - 0.2, 1.7, LAYOUT.slab.bottom - 1.5);
      spareBeam.position.copy(a).lerp(b, k);
      spareBeam.quaternion.copy(dkBeam.quaternion);
    } else if (t < 3.4) {
      dk.arms.forEach((a, i) => { a.rotation.z = (i ? -1 : 1) * (0.35 + 2.45 * smooth(2.4, 3.4, t)); });
    } else if (t < 5.0) {                            // he steps to the rubble and smashes it
      S.dk.s = LAYOUT.dk.s + 3.2 * smooth(3.4, 4.6, t);
      placeAt(dk.g, S.dk.s, 0, floorH(S.dk.s), S.dk.s + 5, 0);
      dkSolid.cs = S.dk.s;
      if (t > 4.6 && !rubbleSolid.gone) {
        rubbleSolid.gone = true; S.rubbleMesh.visible = false;
        ctx.Audio.boom(); ctx.shake(0.4);
        ctx.Particles.spawn(worldPos(137.4, 0, floorH(137.4) + 2), 0x8a8070, 40, 6);
      }
    } else if (S.dk.state === "holding") {
      S.dk.state = "walk";
      ctx.toast("DK joins the journey!", 2600);
      ctx.hint("Follow DK out of the mine, back to the daylight.", 6000);
    }
    if (S.dk.state === "walk") {                     // DK walks out ahead and waits by the launch pad
      S.dk.s = Math.min(LAYOUT.pad.s - 2.5, S.dk.s + 5 * dt);
      placeAt(dk.g, S.dk.s, S.dk.s > 160 ? 3.5 : 0, terrainH(S.dk.s, S.dk.s > 160 ? 3.5 : 0), S.dk.s + 3, 3.5);
      dkSolid.gone = true;
      if (S.dk.s >= LAYOUT.pad.s - 2.5) { S.dk.state = "waiting"; S.luigi.state = "exit"; }
    }
  }

  // ---- the young villain at the launch pad ----
  function updateJr(dt, P, ctx, hs, hl) {
    const j = S.jr, J = LAYOUT.jr;
    if (j.state === "off") {
      if (S.rescued && S.dk.state !== "holding" && hs > 152) {
        j.state = "aim"; j.t = 0; jr.g.visible = true;
        ctx.toast("The young villain!", 2400);
        ctx.Audio.roar();
        split("villain");
      }
      return;
    }
    j.t += dt;
    if (j.state === "aim") {
      placeAt(jr.g, J.s, J.l, 0, hs, hl);
      jr.g.position.addScaledVector(jr.g.position.clone().normalize(), Math.max(0, 1.6 - j.t * 3));
      jr.brush.rotation.x = -1.2 * smooth(0, 1, j.t);
      jr.tip.material.emissiveIntensity = 0.6 + 1.4 * smooth(0.5, 1.8, j.t);
      if (j.t > 2.0) {
        j.state = "throw"; j.t = 0;
        j.from = jr.tip.getWorldPosition(new V3()).sub(center);
        j.to = localPos(hs - 2.5, hl, terrainH(hs - 2.5, hl) + 0.05);
        S.paint.visible = true;
        ctx.Audio.fire();
        ctx.hint("He is aiming his brush at you!", 4000);
      }
    } else if (j.state === "throw") {
      const k = Math.min(1, j.t / 0.7);
      S.paint.position.copy(j.from).lerp(j.to, k).addScaledVector(j.to.clone().normalize(), Math.sin(k * Math.PI) * 3);
      if (k >= 1) {
        j.state = "leave"; j.t = 0; S.paint.visible = false;
        const up = j.to.clone().normalize();
        S.splat.position.copy(j.to); S.splat.quaternion.setFromUnitVectors(new V3(0, 0, 1), up); S.splat.visible = true;
        ctx.Particles.spawn(j.to.clone().add(center), 0xb050ff, 30, 4);
        ctx.Audio.boom(); ctx.shake(0.2);
      }
    } else if (j.state === "leave") {
      placeAt(jr.g, J.s, J.l, 1.5 * j.t * j.t * 4, hs, hl);
      jr.g.rotateY(j.t * 9);
      if (j.t > 1.6) { jr.g.visible = false; j.state = "gone"; }
      if (j.t > 0.8 && !S.gateOpen) {
        S.gateOpen = true;
        if (planet && planet.gate) planet.gate.holder.visible = true;
        ctx.Audio.gate();
        ctx.toast("He flew off! The gate is open.", 2600);
        ctx.hint("Step into the gate with Luigi and DK.", 6000);
      }
    }
  }

  // ---- punch ----
  function aim(P, dir, up) {
    const hp = P.pos.clone().sub(center);
    let best = null, bestD = 4.6;
    const consider = (local, ok) => {
      if (!ok) return;
      const d = local.distanceTo(hp);
      if (d >= bestD) return;
      const to = GameShared.projectTangent(local.clone().sub(hp), up);
      if (to.dot(dir) < -0.2) return;
      best = to; bestD = d;
    };
    for (const b of breakables) if (!b.solid.gone) consider(localPos(b.s, b.l, b.h), true);
    if (S.beetle && !S.beetle.dead) consider(localPos(S.beetle.s, S.beetle.l, 0.6), true);
    return best || dir;
  }
  function once(key, ctx, text, ms) { if (!S.hints[key]) { S.hints[key] = true; ctx.hint(text, ms || 6000); } }
  function punchHit(P, fwd, up) {
    const ctx = env;
    const origin = P.pos.clone().addScaledVector(up, 0.9).addScaledVector(fwd, 1.2).sub(center);
    const power = !!P.punchPower;
    let hit = 0;
    for (const b of breakables) {
      if (b.solid.gone) continue;
      const near = b.kind === "wall" || b.kind === "grotto" ? distToWall(b, origin) : localPos(b.s, b.l, b.h).distanceTo(origin);
      if (near > 2.5) continue;
      hit++;
      const wp = localPos(b.s, b.l, b.h).add(center);
      if (power) {
        b.solid.gone = true; b.mesh.visible = false;
        ctx.Audio.boom(); ctx.shake(0.25);
        ctx.Particles.spawn(wp, 0x5a5566, 30, 5); ctx.Particles.spawn(wp, 0xff8a30, 14, 4);
        if (b.gold) { for (const c of S.veinCoins) { c.holder.visible = true; c.revealed = true; } ctx.toast("A gold vein! Coins!", 1600); ctx.Audio.collect(); }
        if (b.kind === "grotto") ctx.toast("A hidden grotto!", 1600);
        if (b.kind === "block") { S.cart.state = "rolling"; S.cart.v = 0.5; S.cart.t = 0; ctx.toast("The cart is rolling!", 1400); }
      } else {
        ctx.Audio.tone(900, 0.08, "square", 0.12); ctx.Audio.tone(300, 0.2, "triangle", 0.1);
        ctx.Particles.spawn(wp, 0xffd8a0, 6, 2);
        P.vel.addScaledVector(fwd, -6);
        once("tooHard", ctx, P.hasPower ? "Too hard for a quick punch.\nHold Punch until your fist glows, then let go!" : "Clang! This rock is too hard. Maybe the glowing glove can help.", 6500);
      }
    }
    // the beetle: armour in front, a cracked back when it is stuck
    const e = S.beetle;
    if (e && !e.dead) {
      const bp = localPos(e.s, e.l, 0.6);
      if (bp.distanceTo(origin) < 2.6) {
        hit++;
        if (e.state === "stuck" && power) {
          e.dead = true; e.t = 0;
          ctx.Audio.bossHit(); ctx.shake(0.2);
          ctx.Particles.spawn(bp.clone().add(center), 0xff8a30, 22, 4.5);
          S.beetleCoins.forEach((c, k) => { c.s = e.s + Math.cos(k * 2.1) * 1.4; c.l = e.l + Math.sin(k * 2.1) * 1.4; put(c.holder, c.s, c.l, terrainH(c.s, c.l)); c.holder.visible = true; c.revealed = true; });
        } else {
          ctx.Audio.tone(1000, 0.08, "square", 0.12);
          ctx.Particles.spawn(bp.clone().add(center), 0xffffff, 6, 2);
          if (e.state !== "stuck") { e.knock = power ? 3 : 1.5; }
          once("beetleArmour", ctx, e.state === "stuck" ? "Hold Punch to charge, then hit its cracked back!" : "Its front is armoured. Step aside so it misses and gets stuck.", 6500);
        }
      }
    }
    // rolling stones shatter under a power punch
    if (power) for (const st of S.stones) {
      if (localPos(st.s, st.l, floorH(st.s) + st.r).distanceTo(origin) < st.r + 1.4) { st.gone = true; hit++; ctx.Particles.spawn(localPos(st.s, st.l, floorH(st.s) + 1).add(center), 0x6a6470, 16, 4); ctx.Audio.boom(); }
    }
    // DK's beam: never break it
    if (!S.rescued) {
      const dp = localPos(LAYOUT.dk.s, LAYOUT.dk.l, floorH(LAYOUT.dk.s) + 1.6);
      if (dp.distanceTo(origin) < 3.0) {
        hit++; S.beamWarns++; S.beamWarnT = 1.2;
        ctx.Audio.boom(); ctx.shake(0.45);
        ctx.Particles.spawn(localPos(LAYOUT.dk.s, 0, LAYOUT.slab.bottom - 0.2).add(center), 0x9a9080, 26, 3);
        ctx.toast("Careful! The roof is shaking.", 1800);
        ctx.hint("Don't break DK's beam, it holds up the roof!\nFind another beam for him.", 7000);
      }
    }
    return hit;
  }
  function distToWall(b, p) {
    // distance from a local point to the middle line of a cracked wall
    const c = coordsOf(p.clone().normalize()), h = p.length() - R;
    if (b.kind === "wall") return Math.hypot(c.s - b.s, Math.max(0, Math.abs(c.l) - LAYOUT.spur.open), Math.max(0, h - 4));
    const g = LAYOUT.grotto;
    return Math.hypot(c.l - b.l, Math.max(0, g.s0 - c.s, c.s - g.s1), Math.max(0, h - 4));
  }

  // ---- pickups ----
  function updatePickups(dt, P, ctx, hs, hl, hh) {
    if (!P.hasPower && S.shrine.visible) {
      S.glove.rotation.y += dt * 1.6; S.glove.position.y = 1.5 + Math.sin(S.t * 2) * 0.12;
      if (Math.hypot(hs - LAYOUT.shrine.s, hl - LAYOUT.shrine.l) < 1.7 && hh < 2.5) {
        P.hasPower = true; S.shrine.visible = false;
        shrineSolid.gone = true;
        ctx.Audio.victory(); ctx.Particles.spawn(worldPos(LAYOUT.shrine.s, 0, 1.5), 0xffa040, 40, 5);
        ctx.toast("Power Punch!", 2400);
        ctx.hint(ctx.isTouch ? "Hold the Punch button until your fist glows, then let go.\nA Power Punch breaks cracked rock." : "Hold J (or F) until your fist glows, then let go.\nA Power Punch breaks cracked rock.", 9000);
        split("glove");
      }
    }
    for (const c of coins) {
      if (c.taken || !c.holder.visible) continue;
      c.spin.rotation.y += dt * 3;
      if (Math.hypot(hs - c.s, hl - c.l) < 1.3 && Math.abs(hh - terrainH(c.s, c.l) - 0.6) < 1.6) {
        c.taken = true; c.holder.visible = false; S.coins++;
        ctx.Audio.collect();
        ctx.Particles.spawn(worldPos(c.s, c.l, terrainH(c.s, c.l) + 1), 0xffd84a, 8, 2.5);
        env.refreshHud && env.refreshHud();
      }
    }
  }

  // ---- hints, checkpoints, splits ----
  function updateHints(P, ctx, s, l) {
    const h = (k, cond, text, ms) => { if (cond) once(k, ctx, text, ms); };
    h("land", s < 6 && S.t > 1, "Boom, boom, boom... three thuds from inside the mountain!\nLuigi: \"Someone is knocking. I'll find a way in!\"", 7000);
    h("glove", s > 5 && s < 12 && !P.hasPower, "A glowing glove on the shrine. Grab it!");
    h("valley", s > 35 && s < 40, "A basalt beetle. Its front is armoured.\nStep aside when it charges, so it misses.", 7000);
    h("grotto", s > 47 && s < 56 && l < -4, "Gold glints in the cracked wall on the left...");
    h("mine", s > 57 && s < 62, "Monkeys up on the beams roll stones down the track.\nWait in the alcoves with lanterns, then run to the next one.", 8000);
    h("junction", s > 101 && s < 106, "The cart is full of beams, held by a basalt block.\nListen: which tunnel do the thuds come from?", 8000);
    h("luigi", s > 106 && s < 116 && !S.switchCount, "Walk up to Luigi to switch the track.", 6000);
    h("dk", s > 124 && !S.rescued, "DK holds the last beam under the cracked roof.\nDon't break it. Bring him the beams from the cart!", 8000);
  }
  function split(name) {
    if (S.splits.some(x => x.name === name)) return;
    const prev = S.splits.length ? S.splits[S.splits.length - 1].t : 0;
    S.splits.push({ name, t: S.t, seg: S.t - prev });
  }
  function checkpointUpdate(P, ctx, s, l, hh) {
    if (!ctx.grounded) return;
    const cps = LAYOUT.checkpoints;
    for (let i = cps.length - 1; i > S.cp; i--) {
      if (s >= cps[i].s && s < cps[i].s + 25 && Math.abs(l) < 10 && Math.abs(hh - floorH(s)) < 1.2) {
        if (cps[i].name === "exit" && !S.rescued) continue;
        S.cp = i; split(cps[i].name); break;
      }
    }
  }
  function respawn(P, hooks, hurtRestore) {
    const cp = LAYOUT.checkpoints[S.cp];
    const pos = worldPos(cp.s, cp.l, terrainH(cp.s, cp.l) + 0.05);
    const up = pos.clone().sub(center).normalize();
    hooks.teleport(pos, GameShared.projectTangent(T, up));
    if (hurtRestore) hooks.restoreHealth();
    hooks.fade();
    S.stones = [];
  }

  function updateNight() {
    const night = (GameShared.sky && GameShared.sky.night) || 0;
    if (crackMat) crackMat.emissiveIntensity = 0.9 + 1.2 * night;
    if (lampMat) lampMat.emissiveIntensity = 1.2 + 1.0 * night;
    if (goldMat) goldMat.emissiveIntensity = 0.7 + 0.8 * night;
  }

  function update(dt, ctx) {
    const P = ctx.P;
    S.t += dt;
    const c = coordsAt(P.pos), hh = heightAt(P.pos);
    updateNight();
    updateThuds(dt, ctx, c.s, c.l);
    updateLuigi(dt, P, ctx, c.s, c.l);
    updatePickups(dt, P, ctx, c.s, c.l, hh);
    updateBeetle(dt, P, ctx, c.s, c.l, hh);
    updateMonkeys(dt, P, ctx, c.s, c.l, hh);
    updateSwitch(dt, P, ctx, c.s, c.l, hh);
    updateCart(dt, P, ctx, c.s, c.l, hh);
    updateRescue(dt, P, ctx, c.s, c.l);
    updateJr(dt, P, ctx, c.s, c.l);
    if (S.beamWarnT > 0) {                       // the roof trembles after a punch at DK's beam
      S.beamWarnT -= dt;
      if (S.slabMesh) S.slabMesh.position.copy(localPos((LAYOUT.slab.s0 + LAYOUT.slab.s1) / 2, 0, LAYOUT.slab.bottom - Math.max(0, S.beamWarnT) * 0.25 * Math.abs(Math.sin(S.t * 40))));
    }
    updateHints(P, ctx, c.s, c.l);
    checkpointUpdate(P, ctx, c.s, c.l, hh);
  }

  // slide down steep flanks, keep inside the walkable belt, and under the chamber roof
  function constrain(P, curH) {
    const c = coordsAt(P.pos);
    if (P.grounded) {
      const sl = slopeAt(c.s, c.l);
      const onSolid = solids.some(o => !o.gone && inFoot(o, c.s, c.l) && Math.abs(o.top - curH) < 0.3);
      if (sl.mag > 1.25 && !onSolid && curH > floorH(c.s) + 0.8) {
        const k = 7 * (1 / 60) / sl.mag;
        const s2 = c.s - sl.gs * k, l2 = c.l - sl.gl * k;
        P.pos.copy(worldPos(s2, l2, Math.max(curH - 0.12, terrainH(s2, l2))));
        P.grounded = false;
      }
    }
    if (Math.abs(c.l) > LAYOUT.edgeL) {
      const l = clamp(c.l, -LAYOUT.edgeL, LAYOUT.edgeL);
      P.pos.copy(worldPos(c.s, l, curH));
      P.vel.addScaledVector(B, -P.vel.dot(B));
    }
    const sb = LAYOUT.slab;
    if (c.s > sb.s0 && c.s < sb.s1 && Math.abs(c.l) < sb.half && curH < sb.bottom && curH > sb.bottom - 1.75) {
      P.pos.copy(worldPos(c.s, c.l, sb.bottom - 1.75));
      const up = P.pos.clone().sub(center).normalize(), vu = P.vel.dot(up);
      if (vu > 0) P.vel.addScaledVector(up, -vu);
    }
  }

  // ---- camera support ----
  function cameraFloor(pos) {
    const u = _c.copy(pos).sub(center);
    const h = u.length() - R; u.normalize();
    const c = coordsOf(u);
    let f = terrainH(c.s, c.l);
    for (const o of solids) {
      if (o.gone || o === cartSolid || o === dkSolid || h < o.bottom - 0.3 || !inFoot(o, c.s, c.l)) continue;
      if (o.top > f) f = o.top;
    }
    return { floor: f, h };
  }
  function cameraHint() { return null; }
  // the junction: back off so Luigi, the switch, the cart and both tunnel mouths fit together
  function cameraFocus(P) {
    if (S.rescued) return null;
    const c = coordsAt(P.pos);
    if (c.s < 101 || c.s > 117 || Math.abs(c.l) > 10) return null;
    const w = smooth(101, 104, c.s) * (1 - smooth(114, 117, c.s));
    return { point: worldPos(117, 3, LAYOUT.floorTop + 2), weight: w * 0.7 };
  }
  function cameraShot(P) {
    if (S.rescued && S.rescueT < 5.2) {
      const f = floorH(LAYOUT.dk.s);
      return { pos: worldPos(LAYOUT.cartStop - 4.5, -5.2, f + 3.6), look: worldPos(LAYOUT.dk.s + 1, 0, f + 2.2), kind: "rescue" };
    }
    if (S.jr.state === "aim" || S.jr.state === "throw") {
      const c = coordsAt(P.pos);
      return { pos: worldPos(c.s - 6, c.l - 3, heightAt(P.pos) + 3.4), look: worldPos(LAYOUT.jr.s, LAYOUT.jr.l, 1.4), kind: "villain" };
    }
    return null;
  }
  function dayAxis() { const a = dirAt(90, 0), b = dirAt(91, 0); return { up: a, forward: b.sub(a) }; }

  function objective() {
    if (S.gateOpen) return "Enter the gate";
    if (S.rescued) return S.dk.state === "holding" ? "DK is safe!" : "Out to the daylight";
    if (!env || !env.P || !env.P.hasPower) return "Follow the thuds";
    if (S.cart && S.cart.state !== "parked") return "Free DK";
    return "Find who is knocking";
  }
  function hudText() { return "🍌 " + objective() + (S.coins ? "   🪙 " + S.coins : ""); }

  const debug = {
    get state() { return S; }, layout: LAYOUT,
    coordsOf: (p) => coordsAt(p), worldPos, dirAt, query, terrainH, floorH,
    get beetle() { return S.beetle; },
    get breakables() { return breakables.map(b => ({ kind: b.kind, gone: !!b.solid.gone, s: b.s, l: b.l })); },
    get cart() { return Object.assign({}, S.cart); },
    get coins() { return S.coins; },
    get rescueCount() { return S.rescueCount; },
    get rescued() { return S.rescued; },
    get gateOpen() { return !!(planet && planet.gate && planet.gate.holder.visible); },
    get checkpoint() { return LAYOUT.checkpoints[S.cp].name; },
    get splits() { return S.splits || []; },
    get stones() { return S.stones.map(s => ({ s: s.s, l: s.l })); },
    get switchStraight() { return S.switchStraight; },
    get jr() { return S.jr.state; },
    get beamWarns() { return S.beamWarns; },
    setSwitch(v) { S.switchStraight = !!v; },
    luigiReady() { S.luigi.state = "switch"; },
    models: () => ({ luigi: luigi && luigi.g, dk: dk && dk.g, beetle: beetle && beetle.g, jr: jr && jr.g })
  };

  function attach(e) { env = e; reset(); }

  return {
    configure, shapeGround, smoothGround, wantsSmooth, exitDir, build, attach, reset, update, query, drift, constrain,
    punchHit, aim, scripted() {}, objective, hudText, debug, colliders, cameraHint, cameraFloor, cameraShot, cameraFocus, dayAxis,
    respawn: (P, hooks, restoreHealth) => respawn(P, hooks, restoreHealth),
    isLocked: () => false,
    get layout() { return LAYOUT; }
  };
})();
