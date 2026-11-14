"use strict";

/* ============================================================
   Ink Swamp - star 3 (issue #20). Story: game-design/four-planets.md.
   The young villain's paint hit the hero on the way here. He runs off, and the
   player plays his brother, who rides the dinosaur: a second jump in the air is
   a flutter (hold to hover), and the punch button is the tongue.
   Route (arc length `s` from the landing, `l` positive to the right):
     s   0        landing: the painted hero runs off; purple footprints
     s   8        the dinosaur sniffs the trail; walking up to him mounts him
     s  14..24    hollow roots with coins only the tongue reaches
     s  27..39    first paint pool, 12 wide: jump, then flutter
     s  43..63    paint lake with stepping stones; an ink squid covers the stone ahead
     s  66..84    mushroom grove with two piranha plants; across the river (l 22..30)
                  the hero smashes a bridge with his power punch
     s  93..99    the pond; three huts painted on trunks beyond it, only the real one
                  is reflected in the water; the tongue pulls its lever; the mushroom friend
     s 104..122   roots with coins for the ferry (10 coins)
     s 124..148   the ferry over the ink lake
     s 150..176   the mushroom bed and the trunks: the hero charges, gets his fist stuck
                  in a trunk, and the dinosaur gives him a glowing mushroom (three times)
     s 180        the gate
   Characters are GLB/glTF models (js/models.js) with stand-ins.
   ============================================================ */
const InkSwamp = (() => {
  const V3 = THREE.Vector3;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const smooth = (a, b, x) => { const k = clamp((x - a) / (b - a), 0, 1); return k * k * (3 - 2 * k); };
  const band = (s, a, b, w) => smooth(a, a + w, s) * (1 - smooth(b - w, b, s));

  const LAYOUT = {
    yoshi: { s: 8, l: -3 },
    roots: [{ s: 15, l: -6 }, { s: 18, l: 6 }, { s: 21, l: -6.5 }, { s: 23.5, l: 6.5 }],
    pools: [
      { s0: 27, s1: 39, color: 0x9a40ff },           // the first pool: flutter across
      { s0: 43, s1: 63, color: 0x2a2a6a },           // the ink lake with stepping stones
      { s0: 93, s1: 99, color: 0x3a8ad0, water: true },  // the pond (reflects)
      { s0: 124, s1: 148, color: 0x3a2050 }          // the ferry lake
    ],
    stones: [{ s: 46, l: 0 }, { s: 50.5, l: 1.2 }, { s: 55, l: -0.6 }, { s: 59.5, l: 0.6 }],
    squid: { s: 53, l: 6.5 },
    piranhas: [{ s: 72, l: -2.8 }, { s: 79, l: 2.8 }],
    river: { s0: 60, s1: 88, l0: 21, l1: 30 }, bridge: { s: 72, l0: 20, l1: 31 }, heroBank: { s: 72, l: 34 },
    huts: [{ l: -8 }, { l: 0 }, { l: 8 }], hutS: 102.5, leverS: 100.4, realHut: 2,
    rootCoins: [[106, -4, 3.2], [108, 3.5, 0.6], [110, -1, 3.6], [112, 5, 0.6], [114, -5, 0.6], [116, 2, 3.4], [118, -3, 0.6], [120, 4.5, 3.0]],
    ferry: { s0: 124.2, s1: 147.6, l: 0, half: 2.4, fare: 10 },
    bed: { s: 152, l: 0 },
    trunks: [{ s: 158, l: -6 }, { s: 163, l: 6 }, { s: 169, l: -1 }],
    arena: { s: 163, l: 0 },
    gate: { s: 181, l: 0 },
    edgeL: 40, voidBelow: -2.5, fallRespawn: -4,
    checkpoints: [
      { name: "landing", s: 0, l: 0 }, { name: "roots", s: 12, l: 0 }, { name: "lake", s: 41, l: 0 },
      { name: "grove", s: 65, l: 0 }, { name: "pond", s: 87, l: 0 }, { name: "coins", s: 108, l: 0 },     // clear of the hut trunks (s 103.7, radius 2.6)
      { name: "bed", s: 150, l: 0 }
    ]
  };

  // ---- sphere frame (same as the other levels) ----
  let R = 140, center = new V3(), N = new V3(0, 1, 0), T = new V3(0, 0, 1), B = new V3(1, 0, 0);
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
    const to = GameShared.projectTangent(localPos(faceS, faceL, h).sub(p), up);
    faceObj(obj, up, to);
  }

  // ---- terrain ----
  function poolDepth(s, l) {
    let d = 0;
    for (const p of LAYOUT.pools) d = Math.max(d, 6 * band(s, p.s0, p.s1, 1.4));
    const rv = LAYOUT.river;
    if (s > rv.s0 - 2 && s < rv.s1 + 2) d = Math.max(d, 6 * band(s, rv.s0, rv.s1, 2) * band(l, rv.l0, rv.l1, 1.2));
    return d;
  }
  function terrainH(s, l) {
    const flat = 1 - band(s, 175, 188, 3) * (1 - smooth(6, 9, Math.abs(l)));      // level ground at the gate
    const bumps = flat * (0.35 * Math.sin(s * 0.23 + l * 0.17) + 0.25 * Math.sin(l * 0.41 - s * 0.11));
    const d = poolDepth(s, l);
    return bumps * (1 - Math.min(1, d)) - d;
  }
  function poolAt(s) { return LAYOUT.pools.find(p => s > p.s0 && s < p.s1) || null; }

  // ---- solids ----
  const solids = [];
  function addSolid(o) { solids.push(o); return o; }
  const stoneSolids = LAYOUT.stones.map(st => addSolid({ cs: st.s, cl: st.l, r: 1.7, bottom: -7, top: 0.3 }));
  const rootSolids = LAYOUT.roots.map(r => addSolid({ s0: r.s - 1.2, s1: r.s + 1.2, l0: r.l - 1.6, l1: r.l + 1.6, bottom: -1, top: 2.6 }));
  for (const c of LAYOUT.rootCoins) if (c[2] > 2) addSolid({ cs: c[0], cl: c[1], r: 1.1, bottom: -1, top: c[2] - 0.6 });   // root stumps under the high coins
  const trunkSolids = LAYOUT.trunks.map(t => addSolid({ cs: t.s, cl: t.l, r: 1.5, bottom: -1, top: 30 }));
  const hutSolids = LAYOUT.huts.map(h => addSolid({ cs: LAYOUT.hutS + 1.2, cl: h.l, r: 2.6, bottom: -1, top: 30 }));
  const bridgeSolid = addSolid({ s0: LAYOUT.bridge.s - 1.2, s1: LAYOUT.bridge.s + 1.2, l0: LAYOUT.bridge.l0, l1: LAYOUT.bridge.l1, bottom: -1, top: 0.35 });
  const fe = LAYOUT.ferry;
  const raftSolid = addSolid({ s0: fe.s0 - 1.6, s1: fe.s0 + 1.6, l0: -fe.half, l1: fe.half, bottom: -3, top: 0.35 });

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
    return { radius: isVoid ? -Infinity : R + ground, blocked, s: c.s, l: c.l, void: isVoid };
  }
  function drift() { return new V3(); }

  // ---- ground mesh ----
  const STRIP = { s0: -24, s1: 190, maxL: 50, hideS0: -20, hideS1: 186, hideL: 46, ds: 0.6, rows: 111 };
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
    for (let i = 0; i < pos.count; i++) { v.set(pos.getX(i), pos.getY(i), pos.getZ(i)).normalize(); v.toArray(nrm, i * 3); tint(v, c); col.setXYZ(i, c.r, c.g, c.b); }
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
  let glowMat = null, coinMat = null, footMat = null;

  function buildStrip() {
    const cols = Math.round((STRIP.s1 - STRIP.s0) / STRIP.ds) + 1, rows = STRIP.rows;
    const pos = new Float32Array(cols * rows * 3), colA = new Float32Array(cols * rows * 3);
    const mud = new THREE.Color(0x4a3a2e), bankC = new THREE.Color(0x5a6a3a), c = new THREE.Color(), v = new V3();
    let n = 0;
    for (let j = 0; j < rows; j++) {
      const u = j / (rows - 1) * 2 - 1, l = Math.sign(u) * Math.pow(Math.abs(u), 1.4) * STRIP.maxL;
      for (let i = 0; i < cols; i++, n++) {
        const s = STRIP.s0 + i * STRIP.ds, h = terrainH(s, l);
        localPos(s, l, h).toArray(pos, n * 3);
        H.tint(dirAt(s, l, v), c);
        if (h < -0.6) c.copy(mud).lerp(new THREE.Color(0x1a1420), Math.min(1, -h / 6));
        else if (poolDepth(s, l) > 0.02) c.lerp(bankC, 0.6);
        if (Math.abs(l) < 2.6 && h > -0.4) c.lerp(new THREE.Color(0x7a6a4a), 0.45 * (1 - Math.abs(l) / 2.6));   // a trodden trail
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

  // the paint (and water) surfaces: one curved sheet per pool, slightly below the banks
  const surfaces = [];
  function sheet(s0, s1, l0, l1, h, color, opts) {
    const ds = 1, dl = 2, cols = Math.max(2, Math.ceil((s1 - s0) / ds) + 1), rows = Math.max(2, Math.ceil((l1 - l0) / dl) + 1);
    const pos = [], idx = [];
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) localPos(s0 + (s1 - s0) * i / (cols - 1), l0 + (l1 - l0) * j / (rows - 1), h).toArray(pos, pos.length);
    for (let j = 0; j < rows - 1; j++) for (let i = 0; i < cols - 1; i++) { const a = j * cols + i; idx.push(a, a + cols, a + 1, a + 1, a + cols, a + cols + 1); }
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
    const nrm = g.attributes.normal;
    if (nrm.getX(0) * pos[0] + nrm.getY(0) * pos[1] + nrm.getZ(0) * pos[2] < 0) { for (let k = 0; k < idx.length; k += 3) { const t = idx[k + 1]; idx[k + 1] = idx[k + 2]; idx[k + 2] = t; } g.setIndex(idx); g.computeVertexNormals(); }
    const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial(Object.assign({ color, roughness: 0.25, metalness: 0.1, emissive: color, emissiveIntensity: 0.25 }, opts || {})));
    m.userData.noCast = true;
    group.add(m);
    return m;
  }
  function buildSurfaces() {
    for (const p of LAYOUT.pools) surfaces.push(sheet(p.s0 + 0.6, p.s1 - 0.6, -STRIP.maxL, STRIP.maxL, -0.7, p.color, p.water ? { transparent: true, opacity: 0.85, emissiveIntensity: 0.12 } : null));
    const rv = LAYOUT.river;
    surfaces.push(sheet(rv.s0 + 1, rv.s1 - 1, rv.l0 + 0.6, rv.l1 - 0.6, -0.7, 0xd04090));
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
      if (p.color && im.setColorAt) im.setColorAt(i, p.color);
    });
    im.instanceMatrix.needsUpdate = true;
    if (im.instanceColor) im.instanceColor.needsUpdate = true;
    group.add(im);
    return im;
  }
  function buildSwamp(rand) {
    const trees = [], shrooms = [], reeds = [];
    const free = (s, l, pad) => Math.abs(l) > 7 + (pad || 0) || s < -18 || s > 186;
    for (let i = 0; i < 900 && trees.length < Math.round(150 + 90 * QUALITY.grass); i++) {
      const s = -22 + rand() * 210, l = (rand() * 2 - 1) * 48;
      if (!free(s, l, 2) || poolDepth(s, l) > 0.1 || terrainH(s, l) < -0.3) continue;
      if (s > 100 && s < 106 && Math.abs(l) < 14) continue;
      if (s > 150 && s < 176 && Math.abs(l) < 16) continue;
      trees.push({ s, l, h: terrainH(s, l) - 0.2, k: 1 + rand() * 1.1, ky: 0.9 + rand() * 0.6, rot: rand() * 6.28 });
    }
    for (let i = 0; i < 1600 && shrooms.length < Math.round(520 * QUALITY.grass + 80); i++) {
      const s = -20 + rand() * 205, l = (rand() * 2 - 1) * 44;
      if (Math.abs(l) < 3 || poolDepth(s, l) > 0.05) continue;
      const hue = rand() < 0.5 ? 0.52 : 0.85;
      shrooms.push({ s, l, h: terrainH(s, l) - 0.05, k: 0.35 + Math.pow(rand(), 2) * 1.1, rot: rand() * 6.28, color: new THREE.Color().setHSL(hue + rand() * 0.06, 0.7, 0.55) });
    }
    for (const p of LAYOUT.pools) for (let i = 0; i < 70 * QUALITY.grass; i++) {
      const s = (rand() < 0.5 ? p.s0 - 1 : p.s1 + 1) + (rand() - 0.5) * 1.6, l = (rand() * 2 - 1) * 44;
      if (Math.abs(l) < 3.5) continue;
      reeds.push({ s, l, h: terrainH(s, l) - 0.1, k: 0.7 + rand() * 0.6, ky: 1 + rand(), rot: rand() * 6.28 });
    }
    const trunkG = new THREE.CylinderGeometry(0.35, 0.7, 5, 7); trunkG.translate(0, 2.5, 0);
    const crownG = new THREE.IcosahedronGeometry(2.2, 0); crownG.scale(1.3, 0.55, 1.3); crownG.translate(0, 5.4, 0);
    const mossG = new THREE.ConeGeometry(1.6, 2.2, 6, 1, true); mossG.rotateX(Math.PI); mossG.translate(0, 4.2, 0);
    const stemG = new THREE.CylinderGeometry(0.1, 0.14, 0.6, 6); stemG.translate(0, 0.3, 0);
    const capG = new THREE.SphereGeometry(0.42, 8, 3, 0, Math.PI * 2, 0, Math.PI / 2); capG.scale(1, 0.6, 1); capG.translate(0, 0.55, 0);
    const reedG = new THREE.CylinderGeometry(0.04, 0.06, 1.6, 4); reedG.translate(0, 0.8, 0);
    placeInstanced(trunkG, H.mat(0x3a2e26), trees);
    placeInstanced(crownG, H.mat(0x2f5a3a), trees);
    const mm = H.mat(0x5a7a4a, { side: THREE.DoubleSide }); const mi = placeInstanced(mossG, mm, trees); mi.userData.noCast = true;
    const si = placeInstanced(stemG, H.mat(0xe8e0d0), shrooms); si.userData.noCast = true;
    const ci = placeInstanced(capG, glowMat, shrooms); ci.userData.noCast = true;
    const ri = placeInstanced(reedG, H.mat(0x6a7a3a), reeds); ri.userData.noCast = true;
  }

  // ---- props ----
  function buildProps() {
    // hollow roots: arches of dark wood with coins tucked behind them
    for (const r of LAYOUT.roots) {
      const g = new THREE.Group();
      add(g, box(2.4, 2.6, 3.2, 0x4a3828), 0, 1.3, 0);
      add(g, box(1.6, 1.4, 3.3, 0x1a120c), 0, 0.7, 0);
      group.add(put(g, r.s, r.l, terrainH(r.s, r.l) - 0.1));
    }
    // stepping stones
    S.stoneMeshes = LAYOUT.stones.map(st => {
      const g = new THREE.Group();
      const top = add(g, new THREE.Mesh(kitGeometry("stone", () => new THREE.CylinderGeometry(1.7, 1.9, 1.4, 9)), kitMaterial(0x6a6470)), 0, -0.4, 0);
      const ink = add(g, new THREE.Mesh(new THREE.CircleGeometry(1.8, 16), new THREE.MeshBasicMaterial({ color: 0x0a0814, transparent: true, opacity: 0 })), 0, 0.32, 0);
      ink.rotation.x = -Math.PI / 2;
      group.add(put(g, st.s, st.l, 0));
      return { g, top, ink };
    });
    // the bridge across the river (the hero smashes it)
    const br = new THREE.Group();
    const bd = LAYOUT.bridge, len = bd.l1 - bd.l0;
    for (let k = 0; k < 8; k++) add(br, box(2.4, 0.25, len / 8 - 0.1, 0x8a6a40), 0, 0.2, -len / 2 + (k + 0.5) * len / 8);
    br.rotation.y = 0;
    const brh = new THREE.Group(); brh.add(br); br.rotation.y = Math.PI / 2;
    group.add(put(brh, bd.s, (bd.l0 + bd.l1) / 2, 0));
    S.bridgeMesh = brh;
    // the huts painted on trunks, their levers on the far bank, and the reflection of the real one
    S.huts = LAYOUT.huts.map((h, i) => {
      const g = new THREE.Group();
      add(g, cyl(2.5, 2.9, 14, 10, 0x4a3828), 0, 7, 0);
      const face = new THREE.Group(); face.position.set(0, 0, 2.55); g.add(face);
      add(face, box(3.2, 2.6, 0.1, 0xc89a5a), 0, 2.3, 0);
      add(face, box(1.0, 1.6, 0.12, 0x5a3a22), 0, 1.6, 0.02);
      const roof = add(face, new THREE.Mesh(new THREE.ConeGeometry(2.4, 1.4, 4), H.mat(0xa04030)), 0, 4.2, -0.6); roof.rotation.y = Math.PI / 4;
      const win = add(face, box(0.7, 0.6, 0.12, i === LAYOUT.realHut ? 0xffd070 : 0x6a5a40, i === LAYOUT.realHut ? { emissive: 0xffa030, emissiveIntensity: 1.4 } : null), 1.0, 2.6, 0.03);
      group.add(put(g, LAYOUT.hutS + 1.2, h.l, terrainH(LAYOUT.hutS + 1.2, h.l) - 0.2));
      const lv = new THREE.Group();
      add(lv, box(0.6, 0.6, 0.6, 0x44444e), 0, 0.3, 0);
      const stick = new THREE.Group(); stick.position.y = 0.6; lv.add(stick);
      add(stick, cyl(0.07, 0.07, 1.3, 6, 0x333340), 0, 0.65, 0);
      add(stick, ball(0.22, 0xff4030, { emissive: 0xaa1000, emissiveIntensity: 0.5 }), 0, 1.3, 0);
      group.add(put(lv, LAYOUT.leverS, h.l, terrainH(LAYOUT.leverS, h.l)));
      colliders.push(g);
      return { g, lever: lv, stick, win, real: i === LAYOUT.realHut };
    });
    // the reflection: a warm glowing streak on the pond, in front of the real hut only
    const rh = LAYOUT.huts[LAYOUT.realHut];
    const refl = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 4.5), new THREE.MeshBasicMaterial({ color: 0xffc860, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false }));
    refl.rotation.x = -Math.PI / 2;
    const rhG = new THREE.Group(); rhG.add(refl);
    group.add(put(rhG, 97.5, rh.l, -0.62));
    S.reflection = refl;
    // the ferry: a raft with a coin box and a post
    const raft = new THREE.Group();
    for (let k = 0; k < 6; k++) add(raft, box(0.55, 0.35, 2 * fe.half, 0x8a6a40), -1.4 + k * 0.56, 0.15, 0).rotation.y = Math.PI / 2;
    add(raft, box(0.6, 1.0, 0.6, 0x6a4a2a), 1.2, 0.85, 1.6);
    add(raft, cyl(0.08, 0.08, 3, 6, 0x5a3a22), -1.2, 1.5, -1.8);
    add(raft, box(1.2, 0.8, 0.05, 0xfff0d0), -1.2, 2.6, -1.8);
    group.add(raft);
    S.raft = raft;
    // docks at both ends
    for (const s of [fe.s0 - 2.4, fe.s1 + 2.2]) { const d = new THREE.Group(); add(d, box(2.4, 0.3, 4.6, 0x7a5a36), 0, 0.15, 0); group.add(put(d, s, 0, 0)); }
    // the mushroom bed: big glowing mushrooms grow back after being picked
    S.bedShrooms = [];
    for (let k = 0; k < 5; k++) {
      const a = k / 5 * Math.PI * 2, s = LAYOUT.bed.s + Math.cos(a) * 2.6, l = LAYOUT.bed.l + Math.sin(a) * 3.4;
      const g = new THREE.Group();
      add(g, cyl(0.16, 0.2, 0.7, 8, 0xf0e8d8), 0, 0.35, 0);
      add(g, new THREE.Mesh(new THREE.SphereGeometry(0.5, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), H.mat(0x60ffd0, { emissive: 0x20d0a0, emissiveIntensity: 1.2, flatShading: false })), 0, 0.65, 0);
      group.add(put(g, s, l, terrainH(s, l)));
      S.bedShrooms.push({ g, s, l, t: 0, taken: false });
    }
    // the trunks in the arena
    S.trunkMeshes = LAYOUT.trunks.map(t => { const g = new THREE.Group(); add(g, cyl(1.4, 1.8, 12, 10, 0x4a3828), 0, 6, 0); group.add(put(g, t.s, t.l, terrainH(t.s, t.l) - 0.2)); colliders.push(g); return g; });
  }

  // ---- coins ----
  const coins = [];
  function makeCoin(s, l, h) {
    const c = new THREE.Mesh(kitGeometry("coin", () => { const g = new THREE.CylinderGeometry(0.42, 0.42, 0.1, 16); g.rotateX(Math.PI / 2); return g; }), coinMat);
    const holder = new THREE.Group(); holder.add(c); c.position.y = 1.0;
    group.add(put(holder, s, l, h));
    coins.push({ s, l, h, holder, spin: c, taken: false });
  }
  function buildCoins() {
    for (const r of LAYOUT.roots) makeCoin(r.s, r.l + Math.sign(r.l) * 3.1, terrainH(r.s, r.l));   // behind each hollow root
    makeCoin(LAYOUT.stones[1].s, LAYOUT.stones[1].l, 0.3); makeCoin(LAYOUT.stones[3].s, LAYOUT.stones[3].l, 0.3);
    for (const c of LAYOUT.rootCoins) makeCoin(c[0], c[1], c[2] > 2 ? c[2] - 0.6 : terrainH(c[0], c[1]));
    // the high ones sit on root stumps
    for (const c of LAYOUT.rootCoins) if (c[2] > 2) { const g = new THREE.Group(); add(g, cyl(1.0, 1.2, c[2] - 0.6, 8, 0x4a3828), 0, (c[2] - 0.6) / 2, 0); group.add(put(g, c[0], c[1], terrainH(c[0], c[1]) - 0.05)); }
  }

  // ---- characters ----
  function withModel(id, parent, keep, opts) {
    const stand = new THREE.Group(); stand.name = "stand-in";
    for (const c of parent.children.slice()) if (!keep.includes(c)) stand.add(c);
    parent.add(stand);
    return Models.load(id, parent, stand, opts);
  }
  function eyes(parent, y, z, r, gap) {
    for (const x of [-gap, gap]) { const e = add(parent, ball(r, 0xfffaf0, { flatShading: false }, 10, 8), x, y, z); add(e, ball(r * 0.5, 0x1a1420, { flatShading: false }, 8, 6), 0, 0, r * 0.7); }
  }
  function makeLuigiStand() {
    const g = new THREE.Group();
    add(g, box(0.55, 0.7, 0.4, 0x2a4fd0), 0, 0.45, 0);
    add(g, box(0.62, 0.55, 0.42, 0x2eaa4a), 0, 1.05, 0);
    add(g, ball(0.27, 0xffc79a, { flatShading: false }), 0, 1.5, 0);
    add(g, cyl(0.29, 0.29, 0.16, 12, 0x2eaa4a), 0, 1.72, 0);
    add(g, box(0.42, 0.06, 0.24, 0x2eaa4a), 0, 1.66, 0.22);
    return g;
  }
  function makeYoshiStand() {
    const g = new THREE.Group();
    add(g, ball(0.6, 0x4ac040, { flatShading: false }), 0, 0.9, 0).scale.set(0.9, 1, 1.2);
    add(g, ball(0.5, 0xffffff, { flatShading: false }), 0, 0.8, 0.25).scale.set(0.8, 0.9, 0.8);
    add(g, ball(0.42, 0x4ac040, { flatShading: false }), 0, 1.6, 0.55);
    add(g, ball(0.32, 0x4ac040, { flatShading: false }), 0, 1.5, 0.95).scale.set(1.1, 0.8, 1);
    eyes(g, 1.85, 0.6, 0.12, 0.14);
    add(g, ball(0.25, 0xd03030, { flatShading: false }), 0, 1.25, -0.5).scale.set(1.4, 0.7, 1);   // saddle
    for (const x of [-0.3, 0.3]) add(g, box(0.25, 0.5, 0.45, 0xe06030), x, 0.25, 0.1);
    return g;
  }
  let luigiFoot = null, rider = null, tongue = null, yoshiNpc = null, toad = null, mario = null, squid = null, piranhas = [];
  function buildCharacters() {
    // Luigi on foot (the player before the dinosaur comes)
    luigiFoot = new THREE.Group(); luigiFoot.add(makeLuigiStand());
    luigiFoot.model = withModel("luigi", luigiFoot, []);
    // the rider: the dinosaur with Luigi on his back; the tongue comes out of the snout
    rider = new THREE.Group();
    const y = new THREE.Group(); y.add(makeYoshiStand()); y.model = withModel("yoshi", y, []); rider.add(y);
    const seat = new THREE.Group(); seat.position.set(0, 0.95, -0.35); seat.scale.setScalar(0.82); seat.add(makeLuigiStand()); rider.add(seat);
    seat.model = withModel("luigi", seat, []);
    tongue = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 1, 8), new THREE.MeshStandardMaterial({ color: 0xff5a8a, roughness: 0.4 }));
    tongue.geometry.translate(0, 0.5, 0); tongue.geometry.rotateX(Math.PI / 2);
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), tongue.material); tip.position.z = 1; tongue.add(tip);
    tongue.position.set(0, 1.45, 1.0); tongue.visible = false; rider.add(tongue);
    S.held = new THREE.Group(); S.held.position.set(0, 1.5, 1.25); S.held.visible = false;
    add(S.held, new THREE.Mesh(new THREE.SphereGeometry(0.35, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2), H.mat(0x60ffd0, { emissive: 0x20d0a0, emissiveIntensity: 1.2 })), 0, 0, 0);
    rider.add(S.held);
    // the dinosaur waiting by the trail
    yoshiNpc = new THREE.Group(); yoshiNpc.add(makeYoshiStand()); yoshiNpc.model = withModel("yoshi", yoshiNpc, []); group.add(yoshiNpc);
    // the mushroom friend
    toad = new THREE.Group();
    const tg = new THREE.Group(); add(tg, ball(0.6, 0xffffff, { flatShading: false }), 0, 1.1, 0).scale.set(1, 0.75, 1);
    add(tg, ball(0.28, 0xffd9b0, { flatShading: false }), 0, 0.65, 0.05); add(tg, box(0.45, 0.4, 0.3, 0x2a4fd0), 0, 0.25, 0); eyes(tg, 0.7, 0.26, 0.06, 0.1);
    toad.add(tg); toad.model = withModel("toad", toad, []); group.add(toad);
    // the painted hero (same model as the player, tinted)
    mario = new THREE.Group();
    const mg = new THREE.Group(); add(mg, box(0.5, 0.7, 0.35, 0x2a2aa0), 0, 0.45, 0); add(mg, box(0.55, 0.5, 0.38, 0xd02020), 0, 1.0, 0); add(mg, ball(0.25, 0xffc79a), 0, 1.42, 0); add(mg, cyl(0.27, 0.27, 0.14, 12, 0xd02020), 0, 1.62, 0);
    mario.add(mg); mario.model = withModel("mario", mario, []); group.add(mario);
    S.marioFist = new THREE.Mesh(new THREE.SphereGeometry(0.34, 12, 10), new THREE.MeshBasicMaterial({ color: 0xffa040, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
    S.marioFist.position.set(0.4, 1.0, 0.5); mario.add(S.marioFist);
    // the ink squid
    squid = new THREE.Group();
    const sq = new THREE.Group(); add(sq, ball(0.7, 0xf4f4f8, { flatShading: false }), 0, 1.2, 0).scale.set(0.8, 1.3, 0.8);
    eyes(sq, 1.25, 0.5, 0.12, 0.2);
    for (let k = 0; k < 6; k++) { const t = add(sq, cyl(0.07, 0.04, 0.9, 5, 0xf4f4f8), Math.cos(k) * 0.35, 0.3, Math.sin(k) * 0.35); t.rotation.z = Math.cos(k) * 0.3; }
    squid.add(sq); squid.body = sq; squid.model = withModel("blooper", squid, []); group.add(squid);
    S.inkBlob = new THREE.Mesh(new THREE.SphereGeometry(0.45, 10, 8), new THREE.MeshBasicMaterial({ color: 0x0a0814 })); S.inkBlob.visible = false; group.add(S.inkBlob);
    // piranha plants
    piranhas = LAYOUT.piranhas.map(p => {
      const g = new THREE.Group();
      const stem = new THREE.Group(); g.add(stem);
      add(stem, cyl(0.12, 0.16, 1.4, 8, 0x3a9a3a), 0, 0.7, 0);
      const head = new THREE.Group(); head.position.y = 1.5; stem.add(head);
      add(head, ball(0.55, 0xd02a2a, { flatShading: false }), 0, 0.2, 0).scale.set(1, 1, 1.1);
      add(head, box(0.9, 0.08, 0.5, 0xffffff), 0, 0.05, 0.35);
      for (const x of [-0.6, 0.6]) add(g, box(0.9, 0.06, 0.4, 0x3a9a3a), x, 0.1, 0).rotation.z = x * 0.6;
      const mod = withModel("piranha", stem, [head]);
      group.add(g);
      return { g, stem, head, mod };
    });
  }

  function makeMaterials() {
    glowMat = H.mat(0xffffff, { emissive: 0xffffff, emissiveIntensity: 0.45, flatShading: false });
    coinMat = H.mat(0xffd84a, { emissive: 0xffa020, emissiveIntensity: 0.6, roughness: 0.3, metalness: 0.5, flatShading: false });
    footMat = new THREE.MeshBasicMaterial({ color: 0xb050ff, transparent: true, opacity: 0.7, depthWrite: false });
  }
  function buildFootprints() {
    const g = new THREE.CircleGeometry(0.22, 8); g.rotateX(-Math.PI / 2); g.scale(1, 1, 1.6);
    const list = [];
    for (let s = 2; s < 26; s += 1.2) list.push({ s, l: 0.6 * Math.sin(s * 0.5) + ((Math.round(s / 1.2) % 2) ? 0.3 : -0.3), h: terrainH(s, 0) + 0.04, k: 1, rot: 0 });
    const im = placeInstanced(g, footMat, list); im.userData.noCast = true;
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
    buildSurfaces();
    if (FX.jungle) buildSwamp(H.rng(5151));
    buildProps();
    buildCoins();
    buildFootprints();
    buildCharacters();
    const keep = [S.bridgeMesh, S.raft, S.held, yoshiNpc, toad, mario, squid, S.inkBlob]
      .concat(S.stoneMeshes.map(m => m.g), S.huts.map(h => h.g), S.huts.map(h => h.lever), S.bedShrooms.map(b => b.g), S.trunkMeshes, coins.map(c => c.holder), piranhas.map(p => p.g));
    if (FX.merge) mergeStatic(keep);
  }

  // ============================================================
  // runtime
  // ============================================================
  function reset() {
    S.t = 0; S.splits = []; S.cp = 0; S.hints = {}; S.coins = 0;
    S.mounted = false; S.holding = false; S.marioScene = "intro"; S.sceneT = 0;
    S.squid = { state: "idle", t: 0, target: -1, dead: false, h: 1.0 };
    S.inked = LAYOUT.stones.map(() => 0);
    S.piranha = LAYOUT.piranhas.map(() => ({ state: "idle", t: 0, dead: false, bs: 0, bl: 0 }));
    S.bridgeBroken = false; S.hutState = LAYOUT.huts.map(() => "closed"); S.toadFree = false; S.toadT = 0;
    S.ferry = { state: "dock", s: fe.s0, paid: false };
    S.fight = { state: "off", t: 0, cured: 0, ts: 0, tl: 0, s: LAYOUT.arena.s + 6, l: 0, ds: 0, dl: 0 };
    S.rescued = false; S.rescueT = 0; S.rescueCount = 0; S.wrongHuts = 0;
    for (const s of stoneSolids) s.gone = false;
    bridgeSolid.gone = false;
    raftSolid.s0 = fe.s0 - 1.6; raftSolid.s1 = fe.s0 + 1.6;
    for (const c of coins) { c.taken = false; c.holder.visible = true; }
    if (group) {
      S.bridgeMesh.visible = true;
      S.huts.forEach(h => { h.g.visible = true; h.stick.rotation.z = 0; });
      S.reflection.visible = true;
      S.bedShrooms.forEach(b => { b.taken = false; b.g.visible = true; });
      S.held.visible = false;
      placeAt(yoshiNpc, LAYOUT.yoshi.s, LAYOUT.yoshi.l, terrainH(LAYOUT.yoshi.s, LAYOUT.yoshi.l), LAYOUT.yoshi.s + 3, 0); yoshiNpc.visible = true;
      placeAt(toad, LAYOUT.hutS - 0.6, LAYOUT.huts[LAYOUT.realHut].l, 0, LAYOUT.hutS - 5, 0); toad.visible = false;
      placeAt(squid, LAYOUT.squid.s, LAYOUT.squid.l, 1, LAYOUT.squid.s, 0); squid.visible = true; squid.scale.setScalar(1);
      piranhas.forEach((p, i) => { placeAt(p.g, LAYOUT.piranhas[i].s, LAYOUT.piranhas[i].l, terrainH(LAYOUT.piranhas[i].s, LAYOUT.piranhas[i].l), LAYOUT.piranhas[i].s - 3, 0); p.g.visible = true; p.stem.rotation.x = 0; });
      placeAt(mario, 3, 2.5, terrainH(3, 2.5), 0, 0); mario.visible = true;
      for (const st of S.stoneMeshes) st.ink.material.opacity = 0;
      S.inkBlob.visible = false;
      placeRaft();
    }
  }

  // ---- the painted hero: how much paint is left (3 = all over him, 0 = clean) ----
  let marioMats = null;
  function tintMario(level) {
    const h = mario.model;
    if (h && h.ready && !marioMats) {
      marioMats = [];
      h.model.traverse(o => { if (o.isMesh) { o.material = o.material.clone(); marioMats.push(o.material); } });
    }
    const k = level / 3;
    if (marioMats) for (const m of marioMats) {
      if (m.emissiveMap) { m.emissiveMap = null; m.needsUpdate = true; }
      if (m.emissive) { m.emissive.setHex(0x9a3cff); m.emissiveIntensity = 0.6 * k; }
      m.color.setRGB(1 - 0.45 * k, 1 - 0.65 * k, 1);
    }
  }
  function updateMarioScenes(dt, P, ctx, hs, hl) {
    S.sceneT += dt;
    const t = S.sceneT;
    if (S.marioScene === "intro") {
      if (t < 1.8) placeAt(mario, 3, 2.5, terrainH(3, 2.5), hs, hl);
      else if (t < 4.2) {                      // he dashes off along the trail and out of sight
        const k = smooth(1.8, 4.2, t), s = 3 + 32 * k, l = 2.5 + 16 * k * k;
        placeAt(mario, s, l, terrainH(s, l) + Math.abs(Math.sin(t * 12)) * 0.2, s + 2, l + 1);
      } else { mario.visible = false; S.marioScene = "away"; }
    } else if (S.marioScene === "away") {
      if (hs > 66 && !S.bridgeBroken) { S.marioScene = "bridge"; S.sceneT = 0; mario.visible = true; }
    } else if (S.marioScene === "bridge") {           // across the river he smashes the bridge
      const bk = LAYOUT.heroBank;
      placeAt(mario, bk.s, bk.l - Math.min(2, t), 0, LAYOUT.bridge.s, LAYOUT.bridge.l1);
      S.marioFist.material.opacity = t > 0.6 && t < 1.6 ? 0.8 : 0;
      if (t > 1.6 && !S.bridgeBroken) {
        S.bridgeBroken = true; bridgeSolid.gone = true; S.bridgeMesh.visible = false;
        ctx.Audio.boom(); ctx.shake(0.25);
        ctx.Particles.spawn(worldPos(LAYOUT.bridge.s, 26, 0.5), 0x8a6a40, 30, 5);
        ctx.toast("Mario smashed the bridge!", 2200);
        ctx.hint("That's his power punch... He doesn't know you.\nKeep following, Luigi.", 6000);
      }
      if (t > 3.6) { mario.visible = false; S.marioScene = "waiting"; }
    } else if (S.marioScene === "waiting") {
      if (S.ferry.state === "arrived" && hs > 149) { S.marioScene = "fight"; S.fight.state = "prowl"; S.fight.t = 0; mario.visible = true; split("fight"); ctx.toast("Mario!", 1800);
        ctx.hint("Stand in front of a tree trunk. When Mario charges, jump aside!\nThen give him a glowing mushroom (tongue the mushroom bed first).", 9000); }
    }
    tintMario(S.rescued ? 0 : 3 - S.fight.cured);
  }

  // ---- the fight: dodge in front of a trunk, feed him mushrooms while his fist is stuck ----
  function updateFight(dt, P, ctx, hs, hl, hh) {
    const f = S.fight;
    if (S.marioScene !== "fight") return;
    f.t += dt;
    const A = LAYOUT.arena;
    if (f.state === "prowl") {
      const a = S.t * 0.6, ts = A.s + Math.cos(a) * 5, tl = A.l + Math.sin(a) * 6;
      f.s += (ts - f.s) * Math.min(1, dt * 1.5); f.l += (tl - f.l) * Math.min(1, dt * 1.5);
      placeAt(mario, f.s, f.l, terrainH(f.s, f.l), hs, hl);
      if (f.t > 2.2) { f.state = "windup"; f.t = 0; ctx.Audio.tone(140, 0.6, "sawtooth", 0.12, 260); }
    } else if (f.state === "windup") {                 // his fist glows; he locks onto where Luigi stands
      placeAt(mario, f.s, f.l, terrainH(f.s, f.l), hs, hl);
      S.marioFist.material.opacity = 0.3 + 0.6 * (f.t / 1.1);
      f.ts = hs; f.tl = hl;
      if (f.t > 1.1) { f.state = "dash"; f.t = 0; const d = Math.hypot(f.ts - f.s, f.tl - f.l) || 1; f.ds = (f.ts - f.s) / d; f.dl = (f.tl - f.l) / d; f.left = d + 0.8; }
    } else if (f.state === "dash") {
      const step = Math.min(f.left, 15 * dt); f.left -= step;
      f.s += f.ds * step; f.l += f.dl * step;
      placeAt(mario, f.s, f.l, terrainH(f.s, f.l), f.s + f.ds, f.l + f.dl);
      if (Math.hypot(hs - f.s, hl - f.l) < 1.5 && hh - terrainH(f.s, f.l) < 1.8) {
        ctx.hurt(GameShared.projectTangent(localPos(hs, hl, 0).sub(localPos(f.s, f.l, 0)), dirAt(hs, hl)));
        f.state = "stumble"; f.t = 0; S.marioFist.material.opacity = 0;
      } else if (f.left <= 0) {
        const trunk = LAYOUT.trunks.find(t => Math.hypot(t.s - f.s, t.l - f.l) < 2.9);
        S.marioFist.material.opacity = 0;
        if (trunk) {                                   // the fist goes into the trunk and stays there
          f.state = "stuck"; f.t = 0; f.trunk = trunk;
          ctx.Audio.boom(); ctx.shake(0.3);
          ctx.Particles.spawn(worldPos(trunk.s, trunk.l, 1.2), 0x8a6a40, 24, 4);
          once("stuck", ctx, S.holding ? "His fist is stuck! Bring him the mushroom, quick!" : "His fist is stuck! Get a glowing mushroom from the bed with the tongue.");
        } else { f.state = "stumble"; f.t = 0; once("noTrunk", ctx, "He missed, but nothing stopped him.\nStand right in front of a trunk, then jump aside."); }
      }
    } else if (f.state === "stuck") {
      placeAt(mario, f.s, f.l, terrainH(f.s, f.l), f.trunk.s, f.trunk.l);
      mario.position.addScaledVector(mario.position.clone().normalize(), Math.sin(f.t * 30) * 0.03);
      if (S.holding && Math.hypot(hs - f.s, hl - f.l) < 2.6) feedMario(ctx);
      else if (f.t > 4.5) { f.state = "prowl"; f.t = 0; }
    } else if (f.state === "stumble") {
      if (f.t > 1.0) { f.state = "prowl"; f.t = 0; }
    } else if (f.state === "cured") {
      placeAt(mario, f.s, f.l, terrainH(f.s, f.l), hs, hl);
      if (f.t > 1.2) { f.state = "prowl"; f.t = 0; }
    }
  }
  function feedMario(ctx) {
    const f = S.fight;
    S.holding = false; S.held.visible = false;
    f.cured++; f.t = 0;
    ctx.Audio.collect(); ctx.Particles.spawn(worldPos(f.s, f.l, 1.4), 0x60ffd0, 30, 4);
    if (f.cured >= 3) { startRescue(ctx); return; }
    f.state = "cured";
    ctx.toast(f.cured === 1 ? "The paint is coming off!" : "Almost! His red cap shows again!", 2000);
  }
  function startRescue(ctx) {
    S.rescued = true; S.rescueT = 0; S.rescueCount++; S.fight.state = "done"; S.marioScene = "rescued";
    env.P.painted = false;
    split("rescue");
    ctx.Audio.victory();
    ctx.toast("Mario: \"Luigi?! It's you!\"", 3000);
    ctx.hint("Mario remembers his brother and takes his hand.\nThe gate is open!", 7000);
    if (planet && planet.gate) planet.gate.holder.visible = true;
  }

  // ---- the ink squid: it puffs up, then spits ink on the stone ahead of the dinosaur ----
  function updateSquid(dt, P, ctx, hs, hl, hh) {
    const q = S.squid;
    for (let i = 0; i < S.inked.length; i++) {
      if (S.inked[i] > 0) { S.inked[i] -= dt; if (S.inked[i] <= 0) { stoneSolids[i].gone = false; } }
      S.stoneMeshes[i].ink.material.opacity = S.inked[i] > 0 ? 0.92 : 0;
      S.stoneMeshes[i].top.position.y = -0.4 - (S.inked[i] > 0 ? 0.5 : 0);
    }
    if (q.dead) { q.t += dt; squid.scale.setScalar(Math.max(0.01, 1 - q.t * 2)); if (q.t > 0.5) squid.visible = false; return; }
    q.t += dt;
    const bob = 1.0 + Math.sin(S.t * 2) * 0.3;
    placeAt(squid, LAYOUT.squid.s, LAYOUT.squid.l, bob, hs, hl);
    const near = hs > 40 && hs < 64;
    if (q.state === "idle") {
      squid.body.scale.setScalar(1);
      if (near && q.t > 2.2) {
        // the next stone ahead of the dinosaur
        const i = LAYOUT.stones.findIndex(st => st.s > hs + 1.5);
        if (i >= 0 && S.inked[i] <= 0) { q.state = "puff"; q.t = 0; q.target = i; }
      }
    } else if (q.state === "puff") {                     // the warning: it swells and the stone darkens
      squid.body.scale.setScalar(1 + 0.35 * Math.sin(q.t / 0.8 * Math.PI / 2));
      S.stoneMeshes[q.target].ink.material.opacity = 0.25 * Math.abs(Math.sin(q.t * 12));
      if (q.t > 0.8) { q.state = "spit"; q.t = 0; S.inkBlob.visible = true; ctx.Audio.tone(240, 0.2, "sine", 0.12, 120); }
    } else if (q.state === "spit") {
      const st = LAYOUT.stones[q.target], k = Math.min(1, q.t / 0.5);
      S.inkBlob.position.copy(localPos(LAYOUT.squid.s, LAYOUT.squid.l, bob + 1.2)).lerp(localPos(st.s, st.l, 0.4), k).addScaledVector(localPos(st.s, st.l, 0).normalize(), Math.sin(k * Math.PI) * 2.5);
      if (k >= 1) {
        S.inkBlob.visible = false; q.state = "idle"; q.t = 0;
        S.inked[q.target] = 3.5; stoneSolids[q.target].gone = true;
        ctx.Particles.spawn(worldPos(st.s, st.l, 0.4), 0x2a2040, 16, 3);
        once("ink", ctx, "The squid inked the stone and it sank!\nWait until it comes back up, or catch the squid with the tongue.");
      }
    }
  }

  // ---- piranha plants: the stem bends back before the bite ----
  function updatePiranhas(dt, P, ctx, hs, hl, hh) {
    LAYOUT.piranhas.forEach((pp, i) => {
      const st = S.piranha[i], pl = piranhas[i];
      if (st.dead) { st.t += dt; pl.g.scale.setScalar(Math.max(0.01, 1 - st.t * 2)); if (st.t > 0.5) pl.g.visible = false; return; }
      st.t += dt;
      const d = Math.hypot(hs - pp.s, hl - pp.l);
      const base = terrainH(pp.s, pp.l);
      placeAt(pl.g, pp.s, pp.l, base, hs, hl);
      if (st.state === "idle") {
        pl.stem.rotation.x = Math.sin(S.t * 2 + i) * 0.12;
        if (d < 4.6 && hh - base < 2.5) { st.state = "bend"; st.t = 0; once("piranha", ctx, "Its stem bends back... it's about to bite! Step away."); }
      } else if (st.state === "bend") {                    // the telegraph
        pl.stem.rotation.x = -0.75 * smooth(0, 0.7, st.t);
        if (st.t > 0.7) { st.state = "bite"; st.t = 0; st.bs = hs; st.bl = hl; ctx.Audio.tone(500, 0.12, "square", 0.12); }
      } else if (st.state === "bite") {
        pl.stem.rotation.x = -0.75 + 2.1 * smooth(0, 0.18, st.t);
        if (st.t > 0.18 && !st.hit) {
          st.hit = true;
          if (d < 2.6 && hh - base < 2) ctx.hurt(GameShared.projectTangent(localPos(hs, hl, 0).sub(localPos(pp.s, pp.l, 0)), dirAt(hs, hl)));
          else once("piranhaMiss", ctx, "It missed and its head is stuck in the ground! Tongue it now.");
        }
        if (st.t > 0.3) { st.state = "stuck"; st.t = 0; st.hit = false; }
      } else if (st.state === "stuck") {
        pl.stem.rotation.x = 1.35;
        if (st.t > 1.6) { st.state = "idle"; st.t = 0; }
      }
    });
  }

  // ---- the tongue (the punch button while riding) ----
  const TONGUE = 8.5;   // long enough to reach the levers across the pond from its bank
  function mouth(P) { const up = P.up; return P.pos.clone().addScaledVector(up, 1.45).sub(center); }
  function aim(P, dir, up) {
    if (!S.mounted) return dir;
    const m = mouth(P);
    let best = null, bestD = TONGUE + 0.5;
    const consider = (local, ok) => {
      if (!ok) return;
      const d = local.distanceTo(m); if (d >= bestD) return;
      const to = GameShared.projectTangent(local.clone().sub(m), up);
      if (to.dot(dir) < 0.3) return;
      best = to; bestD = d;
    };
    for (const c of coins) if (!c.taken) consider(localPos(c.s, c.l, c.h + 1), true);
    S.huts.forEach((h, i) => consider(localPos(LAYOUT.leverS, LAYOUT.huts[i].l, 1.4), S.hutState[i] === "closed"));
    S.bedShrooms.forEach(b => consider(localPos(b.s, b.l, terrainH(b.s, b.l) + 0.6), !b.taken && !S.holding));
    consider(localPos(LAYOUT.squid.s, LAYOUT.squid.l, 1.4), !S.squid.dead);
    LAYOUT.piranhas.forEach((pp, i) => consider(localPos(pp.s, pp.l, 0.6), !S.piranha[i].dead));
    return best || dir;
  }
  function punchHit(P, fwd, up) {
    if (!S.mounted) return 0;
    const ctx = env, m = mouth(P);
    // everything within reach along the tongue: the closest thing it touches is what it grabs
    const reach = (local, r) => {
      const v = local.clone().sub(m), along = v.dot(fwd);
      if (along < 0 || along > TONGUE) return Infinity;
      const off = v.clone().addScaledVector(fwd, -along).length();
      return off < (r || 1.4) ? along : Infinity;
    };
    const cands = [];
    for (const c of coins) if (!c.taken) cands.push({ d: reach(localPos(c.s, c.l, c.h + 1), 2.6), go: () => takeCoin(c, ctx) });
    S.huts.forEach((h, i) => { if (S.hutState[i] === "closed") cands.push({ d: reach(localPos(LAYOUT.leverS, LAYOUT.huts[i].l, 1.4), 1.6), go: () => pullLever(i, ctx) }); });
    S.bedShrooms.forEach(b => { if (!b.taken && !S.holding) cands.push({ d: reach(localPos(b.s, b.l, terrainH(b.s, b.l) + 0.6), 1.6), go: () => pickShroom(b, ctx) }); });
    if (!S.squid.dead) cands.push({ d: reach(localPos(LAYOUT.squid.s, LAYOUT.squid.l, 1.4), 1.8), go: () => { S.squid.dead = true; S.squid.t = 0; ctx.Audio.collect(); ctx.toast("Gulp! The squid is gone.", 1500); } });
    LAYOUT.piranhas.forEach((pp, i) => {
      const st = S.piranha[i]; if (st.dead) return;
      cands.push({ d: reach(localPos(pp.s, pp.l, 0.6), 1.8), go: () => {
        if (st.state === "stuck") { st.dead = true; st.t = 0; ctx.Audio.collect(); ctx.Particles.spawn(worldPos(pp.s, pp.l, 0.6), 0x3a9a3a, 16, 3); }
        else { ctx.Audio.tone(900, 0.08, "square", 0.1); once("piranhaTongue", ctx, "Not now! Wait until it bites and misses."); }
      } });
    });
    const f = S.fight;
    if (S.holding && f.state === "stuck") cands.push({ d: reach(localPos(f.s, f.l, 1.2), 1.8), go: () => feedMario(ctx) });
    cands.sort((a, b) => a.d - b.d);
    if (cands.length && isFinite(cands[0].d)) { cands[0].go(); return 1; }
    return 0;
  }
  function takeCoin(c, ctx) {
    c.taken = true; c.holder.visible = false; S.coins++;
    env.P.coins = (env.P.coins || 0) + 1;
    ctx.Audio.collect();
    ctx.Particles.spawn(worldPos(c.s, c.l, c.h + 1), 0xffd84a, 8, 2.5);
    if (env.P.coins % 10 === 0 && env.P.health < 3) { env.P.health++; ctx.toast("10 coins: a heart back!", 1600); }
    env.refreshHud && env.refreshHud();
  }
  function pullLever(i, ctx) {
    const h = S.huts[i];
    h.stick.rotation.z = 0.9;
    if (h.real) {
      S.hutState[i] = "open"; S.toadFree = true; S.toadT = 0;
      ctx.Audio.gate(); ctx.toast("The door opens!", 1800);
      split("toad");
    } else {                                    // a painted fake: the paint runs off and the trunk is bare
      S.hutState[i] = "fake"; S.wrongHuts++;
      ctx.Audio.tone(300, 0.3, "sawtooth", 0.1, 120);
      ctx.Particles.spawn(worldPos(LAYOUT.hutS + 1.2, LAYOUT.huts[i].l, 2.5), 0x9a40ff, 26, 4);
      h.g.children.forEach(c => { if (c.position.z > 2) c.visible = false; });
      ctx.toast("Only paint! A fake hut.", 1800);
      ctx.hint("Look at the water: only the real hut's light is reflected in the pond.", 6500);
    }
  }
  function pickShroom(b, ctx) {
    b.taken = true; b.t = 0; b.g.visible = false; S.holding = true; S.held.visible = true;
    ctx.Audio.collect();
    once("held", ctx, "Yoshi holds a glowing mushroom. Wait for Mario's fist to get stuck, then bring it to him.");
  }

  // ---- mounting, Toad, the ferry ----
  function updateMount(P, ctx, hs, hl) {
    if (S.mounted) return;
    placeAt(yoshiNpc, LAYOUT.yoshi.s, LAYOUT.yoshi.l, terrainH(LAYOUT.yoshi.s, LAYOUT.yoshi.l), hs, hl);
    yoshiNpc.position.addScaledVector(yoshiNpc.position.clone().normalize(), Math.abs(Math.sin(S.t * 3)) * 0.12);
    if (Math.hypot(hs - LAYOUT.yoshi.s, hl - LAYOUT.yoshi.l) < 2.2) {
      S.mounted = true; yoshiNpc.visible = false;
      ctx.Audio.victory(); split("yoshi");
      ctx.toast("Yoshi lets Luigi ride!", 2400);
      ctx.hint(ctx.isTouch ? "Jump, then tap Jump again and hold it to flutter.\nThe Punch button is Yoshi's tongue: it grabs coins, levers and more."
        : "Space to jump, press it again in the air and hold to flutter.\nJ or F: Yoshi's tongue. It grabs coins, levers and more.", 9000);
    }
  }
  function updateToad(dt, ctx, hs, hl) {
    if (!S.toadFree) return;
    S.toadT += dt;
    const rh = LAYOUT.huts[LAYOUT.realHut];
    if (S.toadT < 2.5) { toad.visible = true; const k = smooth(0, 2.5, S.toadT); const s = LAYOUT.hutS - 0.6 - 2.4 * k; placeAt(toad, s, rh.l, terrainH(s, rh.l), hs, hl); }
    else if (!S.toadSpoke) {
      S.toadSpoke = true;
      ctx.toast("Toad: \"You found me!\"", 2400);
      ctx.hint("Toad: \"I kept one glowing mushroom safe from the ink.\nIt cleans paint! Mario needs it, but he is too fast.\nThe old ferry crosses to the mushroom bed. It takes 10 coins.\"", 10000);
    } else if (S.toadT > 3) { placeAt(toad, fe.s0 - 3, 3, 0.3, hs, hl); }   // he waits for you at the ferry dock
  }
  function placeRaft() {
    const s = S.ferry.s;
    put(S.raft, s, 0, -0.1);
    raftSolid.s0 = s - 1.6; raftSolid.s1 = s + 1.6;
  }
  function updateFerry(dt, P, ctx, hs, hl, hh) {
    const F = S.ferry;
    const onRaft = Math.abs(hs - F.s) < 1.7 && Math.abs(hl) < fe.half && Math.abs(hh - raftSolid.top) < 0.4;
    if (F.state === "dock" && onRaft) {
      if (S.coins >= fe.fare && S.toadFree) {
        F.state = "crossing"; env.P.coins -= fe.fare; ctx.toast("Clink! The ferry sets off.", 1800); ctx.Audio.gate(); env.refreshHud && env.refreshHud();
        if (S.toadSpoke) { toad.visible = true; }
      } else if (!F.warned || F.warned < S.t - 4) {
        F.warned = S.t;
        ctx.hint(S.toadFree ? "The ferry needs 10 coins from the swamp. You have " + S.coins + "." : "The ferry won't move. Maybe someone in the huts knows how it works.", 4000);
      }
    }
    if (F.state === "crossing") {
      const prev = F.s;
      F.s = Math.min(fe.s1, F.s + 3.6 * dt);
      placeRaft();
      if (onRaft || Math.abs(hs - prev) < 1.8 && Math.abs(hl) < fe.half + 0.5 && hh > -0.6) {   // carry the rider
        P.pos.copy(worldPos(hs + (F.s - prev), hl, Math.max(hh, raftSolid.top)));
      }
      if (S.toadSpoke) placeAt(toad, F.s - 1.0, 1.2, 0.35, F.s + 3, 0);
      if (F.s >= fe.s1) { F.state = "arrived"; ctx.toast("The mushroom bed!", 1600); }
    }
  }
  function updateBed(dt, ctx) {
    for (const b of S.bedShrooms) if (b.taken) { b.t += dt; if (b.t > 6) { b.taken = false; b.g.visible = true; } }
  }

  // ---- tongue drawing, the rider, hints, checkpoints ----
  function updateTongue(P) {
    if (!S.mounted || P.punchT <= 0) { tongue.visible = false; return; }
    const k = 1 - P.punchT / 0.38;
    tongue.visible = true;
    tongue.scale.set(1, 1, Math.max(0.05, TONGUE * Math.sin(k * Math.PI)));
  }
  function once(key, ctx, text, ms) { if (!S.hints[key]) { S.hints[key] = true; ctx.hint(text, ms || 6000); } }
  function updateHints(P, ctx, s, l) {
    const h = (k, cond, text, ms) => { if (cond) once(k, ctx, text, ms); };
    h("land", S.t > 0.5 && s < 6, "Mario is covered in the young villain's paint... he ran off!\nYou are Luigi now. Follow the purple footprints.", 8000);
    h("yoshi", s > 4 && !S.mounted, "Someone is sniffing Mario's trail... Walk up to Yoshi!");
    h("roots", S.mounted && s > 12 && s < 25, "Coins behind the hollow roots! Stick out Yoshi's tongue to grab them.");
    h("pool", S.mounted && s > 22 && s < 28, "A wide paint pool. Jump, press jump again and hold it to flutter across!", 7000);
    h("pond", s > 86 && s < 93, "Three huts beyond the pond... but which one is real?\nLook at the reflections in the water.", 8000);
    h("roots2", S.toadFree && s > 103 && s < 110, "Tongue the coins between the roots: the ferry needs 10.");
  }
  function split(name) { if (S.splits.some(x => x.name === name)) return; const prev = S.splits.length ? S.splits[S.splits.length - 1].t : 0; S.splits.push({ name, t: S.t, seg: S.t - prev }); }
  function checkpointUpdate(P, ctx, s, l, hh) {
    if (!ctx.grounded) return;
    const cps = LAYOUT.checkpoints;
    for (let i = cps.length - 1; i > S.cp; i--) if (s >= cps[i].s && s < cps[i].s + 20 && Math.abs(l) < 10 && hh > -0.5) {
      if (cps[i].name === "bed" && S.ferry.state !== "arrived") continue;
      S.cp = i; split(cps[i].name); break;
    }
  }
  function respawn(P, hooks, hurtRestore) {
    const cp = LAYOUT.checkpoints[S.cp];
    const pos = worldPos(cp.s, cp.l, terrainH(cp.s, cp.l) + 0.05);
    hooks.teleport(pos, GameShared.projectTangent(T, pos.clone().sub(center).normalize()));
    if (hurtRestore) hooks.restoreHealth();
    hooks.fade();
  }
  function updateNight() {
    const night = (GameShared.sky && GameShared.sky.night) || 0;
    if (glowMat) glowMat.emissiveIntensity = 0.45 + 1.1 * night;
    if (S.reflection) S.reflection.material.opacity = 0.4 + 0.25 * Math.sin(S.t * 2) + 0.2 * night;
  }

  function update(dt, ctx) {
    const P = ctx.P;
    S.t += dt;
    const c = coordsAt(P.pos), hh = heightAt(P.pos);
    updateNight();
    updateMount(P, ctx, c.s, c.l);
    updateMarioScenes(dt, P, ctx, c.s, c.l);
    updateSquid(dt, P, ctx, c.s, c.l, hh);
    updatePiranhas(dt, P, ctx, c.s, c.l, hh);
    updateToad(dt, ctx, c.s, c.l);
    updateFerry(dt, P, ctx, c.s, c.l, hh);
    updateBed(dt, ctx);
    updateFight(dt, P, ctx, c.s, c.l, hh);
    updateTongue(P);
    for (const co of coins) if (!co.taken) co.spin.rotation.y += dt * 3;
    // walking over a coin takes it too
    for (const co of coins) if (!co.taken && Math.hypot(c.s - co.s, c.l - co.l) < 1.2 && Math.abs(hh - co.h - 0.6) < 1.6) takeCoin(co, ctx);
    S.held.visible = S.holding;
    if (S.rescued) { S.rescueT += dt; if (S.rescueT < 6) placeAt(mario, S.fight.s, S.fight.l, terrainH(S.fight.s, S.fight.l), c.s, c.l); }
    updateHints(P, ctx, c.s, c.l);
    checkpointUpdate(P, ctx, c.s, c.l, hh);
    if (hh < LAYOUT.fallRespawn) { ctx.toast("Splash! Back to the last flag.", 1400); respawn(P, ctx, false); }
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
    let f = Math.max(terrainH(c.s, c.l), -0.7);           // the paint surface counts as the floor for the camera
    for (const o of solids) { if (o.gone || o.top > 20 || h < o.bottom - 0.3 || !inFoot(o, c.s, c.l)) continue; if (o.top > f) f = o.top; }
    return { floor: f, h };
  }
  function cameraHint() { return null; }
  function cameraFocus(P) {
    if (S.toadFree) return null;
    const c = coordsAt(P.pos);
    if (c.s < 86 || c.s > 99 || Math.abs(c.l) > 14) return null;      // the pond: huts and reflections together
    return { point: worldPos(98, 0, 1), weight: 0.6 * smooth(86, 89, c.s) };
  }
  function cameraShot(P) {
    if (S.marioScene === "bridge" && S.sceneT < 3) {
      const c = coordsAt(P.pos);
      return { pos: worldPos(c.s - 4, c.l - 3, heightAt(P.pos) + 3.5), look: worldPos(LAYOUT.bridge.s, 27, 1), kind: "bridge" };
    }
    if (S.rescued && S.rescueT < 4 && Math.hypot(coordsAt(P.pos).s - S.fight.s, coordsAt(P.pos).l - S.fight.l) < 15) {
      const f = S.fight;
      return { pos: worldPos(f.s - 5, f.l - 3, terrainH(f.s, f.l) + 2.6), look: worldPos(f.s, f.l, terrainH(f.s, f.l) + 1.2), kind: "rescue" };
    }
    return null;
  }
  function dayAxis() { const a = dirAt(90, 0), b = dirAt(91, 0); return { up: a, forward: b.sub(a) }; }

  // the player's look while on this star: Luigi on foot, then Luigi on the dinosaur
  function avatar() { return group ? (S.mounted ? rider : luigiFoot) : null; }
  function abilities() { return S.mounted ? { flutter: true, tongue: true } : { flutter: false, tongue: false }; }

  function objective() {
    if (S.rescued) return "Enter the gate";
    if (S.marioScene === "fight") return "Give Mario the mushrooms (" + S.fight.cured + "/3)";
    if (S.ferry.state !== "dock") return "Cross to the mushroom bed";
    if (S.toadFree) return "Coins for the ferry (" + S.coins + "/10)";
    if (!S.mounted) return "Follow Mario's trail";
    return "Follow the purple footprints";
  }
  function hudText() { const n = (env && env.P && env.P.coins) || 0; return "🦖 " + objective() + (n ? "   🪙 " + n : ""); }

  const debug = {
    get state() { return S; }, layout: LAYOUT,
    coordsOf: (p) => coordsAt(p), worldPos, dirAt, query, terrainH,
    get mounted() { return S.mounted; }, mount() { S.mounted = true; yoshiNpc.visible = false; },
    get coins() { return S.coins; }, get rescued() { return S.rescued; }, get rescueCount() { return S.rescueCount; },
    get gateOpen() { return !!(planet && planet.gate && planet.gate.holder.visible); },
    get checkpoint() { return LAYOUT.checkpoints[S.cp].name; }, get splits() { return S.splits; },
    get fight() { return Object.assign({}, S.fight); }, get ferry() { return Object.assign({}, S.ferry); },
    get squid() { return Object.assign({}, S.squid); }, get inked() { return S.inked.slice(); }, get piranha() { return S.piranha.map(p => Object.assign({}, p)); },
    get huts() { return S.hutState.slice(); }, get toadFree() { return S.toadFree; }, get holding() { return S.holding; },
    get bridgeBroken() { return S.bridgeBroken; },
    skipIntro() { S.marioScene = "away"; mario.visible = false; },
    models: () => ({ yoshi: rider, toad, mario, squid, piranha: piranhas[0] && piranhas[0].g, yoshiNpc })
  };

  function attach(e) { env = e; reset(); }

  return {
    configure, shapeGround, smoothGround, wantsSmooth, exitDir, build, attach, reset, update, query, drift, constrain,
    punchHit, aim, scripted() {}, objective, hudText, debug, colliders, cameraHint, cameraFloor, cameraShot, cameraFocus, dayAxis,
    avatar, abilities,
    respawn: (P, hooks, restoreHealth) => respawn(P, hooks, restoreHealth),
    isLocked: () => false,
    get layout() { return LAYOUT; }
  };
})();
