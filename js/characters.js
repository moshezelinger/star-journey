"use strict";

/* ============================================================
   Characters built in code (Moshe, November 2026: "improve them with what the game already
   has, without a GLB for each character").

   Every character here is an original design for this game. Each fills the role of a
   character in the story (the brother, the mushroom walker, the winged turtle, the basalt
   beetle, the mine monkeys, the young villain, the ink squid, the big ape, the dinosaur, the
   mushroom friend, the swamp snapper) and keeps the parts and sizes the level code moves,
   but none of them copies an existing character.

   How they stay cheap (docs/performance-rules.md):
   - A character is a few rigid parts (body, head, each arm, each leg). Every part is ONE mesh:
     its spheres, limbs and tubes are merged into one geometry and coloured per vertex, so a
     character costs 4 to 8 draw calls instead of 10 to 30.
   - Three materials are shared by every character (matte, gloss, lit). Parts the level code
     changes at run time (the lantern glass, the brush tip, the glowing cracks) keep their own.
   - Animation is a handful of rotations per frame: blinking (the eye part squashes flat),
     breathing, a walk cycle driven by how fast the character actually moves in the world,
     and small extras (a swaying tail, pulsing tentacles, a snapping jaw).
   Characters.update(dt) runs once per frame from index.html.
   ============================================================ */
const Characters = (() => {
  const V3 = THREE.Vector3;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const live = [];            // every character built, for update()
  let time = 0;

  // ---------- shared materials ----------
  let MAT = null;
  function mats() {
    if (MAT) return MAT;
    MAT = {
      matte: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.78, metalness: 0 }),
      gloss: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.3, metalness: 0 }),
      lit: new THREE.MeshBasicMaterial({ vertexColors: true })        // glows: lamps, spots, dazed stars
    };
    return MAT;
  }

  // ---------- transforms ----------
  const _e = new THREE.Euler(), _q = new THREE.Quaternion(), _p = new V3(), _s = new V3();
  function matrix(o) {
    o = o || {};
    const at = o.at || [0, 0, 0], rot = o.rot || [0, 0, 0], s = o.size === undefined ? 1 : o.size;
    _p.set(at[0], at[1], at[2]);
    _q.setFromEuler(_e.set(rot[0], rot[1], rot[2], o.order || "XYZ"));
    if (typeof s === "number") _s.set(s, s, s); else _s.set(s[0], s[1], s[2]);
    return new THREE.Matrix4().compose(_p, _q, _s);
  }
  const UNIT = new Map();
  function unit(key, make) { let g = UNIT.get(key); if (!g) { g = make(); UNIT.set(key, g); } return g; }

  // a tube along a smooth curve, its radius going from r0 to r1 (tails, tentacles, stems)
  function tubeGeometry(points, r0, r1, segs, rad) {
    const curve = new THREE.CatmullRomCurve3(points.map(p => new V3(p[0], p[1], p[2])));
    const fr = curve.computeFrenetFrames(segs, false);
    const pos = [], nrm = [], idx = [];
    for (let i = 0; i <= segs; i++) {
      const u = i / segs, P = curve.getPointAt(u), r = r0 + (r1 - r0) * u;
      const N = fr.normals[i], B = fr.binormals[i];
      for (let j = 0; j <= rad; j++) {
        const a = j / rad * Math.PI * 2, c = -Math.cos(a), s = Math.sin(a);
        const n = new V3().addScaledVector(N, c).addScaledVector(B, s).normalize();
        pos.push(P.x + r * n.x, P.y + r * n.y, P.z + r * n.z); nrm.push(n.x, n.y, n.z);
      }
    }
    for (let i = 0; i < segs; i++) for (let j = 0; j < rad; j++) {
      const a = i * (rad + 1) + j, b = (i + 1) * (rad + 1) + j, c = b + 1, d = a + 1;
      idx.push(a, b, d, b, c, d);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute("normal", new THREE.Float32BufferAttribute(nrm, 3));
    g.setIndex(idx);
    return { geo: g, start: curve.getPointAt(0), end: curve.getPointAt(1) };
  }

  // fewer triangles for small shapes: a nose gets 6 segments, a head 18
  function sizeOf(o) { const s = o && o.size !== undefined ? o.size : 1; return typeof s === "number" ? s : Math.max(s[0], s[1], s[2]); }
  function segs(o, hk) {
    const w = clamp(Math.round(3 + sizeOf(o) * 44), 6, 18);
    return [w, clamp(Math.round(w * hk), 3, 10)];
  }

  // ---------- a rigid part: many shapes, one mesh per material kind ----------
  // color: a hex number, or a function (p, local) -> hex, where p is the vertex in the part's
  // space and local is the vertex in the shape's own unit space (for stripes, spots, gradients).
  class Part {
    constructor() { this.items = []; this.stack = [new THREE.Matrix4()]; }
    get top() { return this.stack[this.stack.length - 1]; }
    within(o, fn) { this.stack.push(this.top.clone().multiply(matrix(o))); fn(this); this.stack.pop(); return this; }
    add(geo, color, o, m) {
      o = o || {};
      this.items.push({ geo, color, m: this.top.clone().multiply(m || matrix(o)), kind: o.mat || o.kind || "matte" });
      return this;
    }
    ball(color, o) { const sg = (o && o.seg) || segs(o, 0.62); return this.add(unit("s" + sg, () => new THREE.SphereGeometry(1, sg[0], sg[1])), color, o); }
    dome(color, o) { const sg = (o && o.seg) || segs(o, 0.35); return this.add(unit("d" + sg, () => new THREE.SphereGeometry(1, sg[0], sg[1], 0, Math.PI * 2, 0, Math.PI / 2)), color, o); }
    bowl(color, o) { const sg = (o && o.seg) || segs(o, 0.35); return this.add(unit("b" + sg, () => new THREE.SphereGeometry(1, sg[0], sg[1], 0, Math.PI * 2, Math.PI / 2, Math.PI / 2)), color, o); }
    cyl(color, o) {          // radius 1, height 1, centred; o.taper = top radius / bottom radius
      const t = (o && o.taper !== undefined) ? o.taper : 1, n = (o && o.sides) || 14;
      return this.add(unit("c" + t + "," + n, () => new THREE.CylinderGeometry(t, 1, 1, n)), color, o);
    }
    cone(color, o) { const n = (o && o.sides) || 12; return this.add(unit("k" + n, () => new THREE.ConeGeometry(1, 1, n)), color, o); }
    box(color, o) { return this.add(unit("box", () => new THREE.BoxGeometry(1, 1, 1)), color, o); }
    torus(color, o) {        // ring radius 1 in the XY plane; o.tube = tube radius, o.arc
      const tube = (o && o.tube) || 0.2, arc = (o && o.arc) || Math.PI * 2;
      const n = clamp(Math.round((8 + sizeOf(o) * 30) * arc / (Math.PI * 2)), 5, 22);
      return this.add(unit("t" + tube + "," + arc + "," + n, () => new THREE.TorusGeometry(1, tube, 6, n, arc)), color, o);
    }
    // the profile may run either way round: it is turned counter-clockwise in (r, y) so the
    // surface faces out
    lathe(profile, color, o) {
      const seg = (o && o.seg) || 24;
      let area = 0;
      for (let i = 0; i < profile.length; i++) { const [r0, y0] = profile[i], [r1, y1] = profile[(i + 1) % profile.length]; area += r0 * y1 - r1 * y0; }
      const pts = area < 0 ? profile.slice().reverse() : profile;
      return this.add(new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg), color, o);
    }
    star(color, o) {
      return this.add(unit("star", () => {
        const sh = new THREE.Shape();
        for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2 + Math.PI / 2, r = i % 2 ? 0.42 : 1; sh[i ? "lineTo" : "moveTo"](Math.cos(a) * r, Math.sin(a) * r); }
        const g = new THREE.ExtrudeGeometry(sh, { depth: 0.35, bevelEnabled: false }); g.translate(0, 0, -0.175); return g;
      }), color, o);
    }
    // a rounded limb from a to b, radius r0 at a and r1 at b
    limb(a, b, r0, r1, color, o) {
      const A = new V3(a[0], a[1], a[2]), Bv = new V3(b[0], b[1], b[2]);
      const d = Bv.clone().sub(A), len = d.length();
      const q = new THREE.Quaternion().setFromUnitVectors(new V3(0, 1, 0), d.normalize());
      const m = new THREE.Matrix4().compose(A.clone().add(Bv).multiplyScalar(0.5), q, new V3(1, len, 1));
      const sides = (o && o.sides) || clamp(Math.round(6 + Math.max(r0, r1) * 40), 6, 14);
      this.add(new THREE.CylinderGeometry(r1, r0, 1, sides, 1, true), color, o, m);
      if (!(o && o.noEnds)) {
        this.ball(color, Object.assign({}, o, { at: a, size: r0, seg: segs({ size: r0 * 0.8 }, 0.62) }));
        this.ball(color, Object.assign({}, o, { at: b, size: r1, seg: segs({ size: r1 * 0.8 }, 0.62) }));
      }
      return this;
    }
    tube(points, r0, r1, color, o) {
      const t = tubeGeometry(points, r0, r1, (o && o.segs) || 12, (o && o.sides) || 7);
      this.add(t.geo, color, Object.assign({}, o, { at: [0, 0, 0], rot: [0, 0, 0], size: 1 }));
      if (!(o && o.noEnds)) {
        this.ball(color, Object.assign({}, o, { at: [t.start.x, t.start.y, t.start.z], size: r0, seg: null }));
        this.ball(color, Object.assign({}, o, { at: [t.end.x, t.end.y, t.end.z], size: r1, seg: null }));
      }
      return this;
    }
    // merge everything into one mesh per material and add them to parent
    build(parent, opts) {
      const M = mats(), groups = new Map(), col = new THREE.Color(), lp = new V3(), pp = new V3();
      for (const it of this.items) {
        let g = it.geo.index ? it.geo.toNonIndexed() : it.geo.clone();
        const local = g.attributes.position.array.slice();
        g.applyMatrix4(it.m);
        const n = g.attributes.position.count, c = new Float32Array(n * 3), P = g.attributes.position.array;
        for (let i = 0; i < n; i++) {
          if (typeof it.color === "function") {
            pp.set(P[i * 3], P[i * 3 + 1], P[i * 3 + 2]); lp.set(local[i * 3], local[i * 3 + 1], local[i * 3 + 2]);
            col.set(it.color(pp, lp));
          } else col.set(it.color);
          c[i * 3] = col.r; c[i * 3 + 1] = col.g; c[i * 3 + 2] = col.b;
        }
        g.setAttribute("color", new THREE.BufferAttribute(c, 3));
        if (!groups.has(it.kind)) groups.set(it.kind, []);
        groups.get(it.kind).push(g);
      }
      const meshes = [];
      for (const [kind, geos] of groups) {
        let n = 0; for (const g of geos) n += g.attributes.position.count;
        const pos = new Float32Array(n * 3), nrm = new Float32Array(n * 3), clr = new Float32Array(n * 3);
        let k = 0;
        for (const g of geos) {
          pos.set(g.attributes.position.array, k * 3); nrm.set(g.attributes.normal.array, k * 3); clr.set(g.attributes.color.array, k * 3);
          k += g.attributes.position.count; g.dispose();
        }
        const bg = new THREE.BufferGeometry();
        bg.setAttribute("position", new THREE.BufferAttribute(pos, 3));
        bg.setAttribute("normal", new THREE.BufferAttribute(nrm, 3));
        bg.setAttribute("color", new THREE.BufferAttribute(clr, 3));
        bg.computeBoundingSphere();
        const material = typeof kind === "string" ? M[kind] : kind;
        const mesh = new THREE.Mesh(bg, material);
        mesh.castShadow = !(opts && opts.noShadow) && kind !== "lit";
        parent.add(mesh); meshes.push(mesh);
      }
      return meshes.length === 1 ? meshes[0] : meshes;
    }
  }
  function part() { return new Part(); }
  function group(parent, x, y, z) { const g = new THREE.Group(); g.position.set(x || 0, y || 0, z || 0); if (parent) parent.add(g); return g; }

  // ---------- colour helpers ----------
  const mix = (a, b, k) => new THREE.Color(a).lerp(new THREE.Color(b), clamp(k, 0, 1)).getHex();
  function hash(x, y, z) { const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453; return s - Math.floor(s); }

  // ---------- faces ----------
  // A pair of eyes in their own part, so a blink can squash them flat. The group sits on the
  // line through both eye centres; its scale.y goes to ~0.1 and back.
  function eyes(parent, o) {
    const g = group(parent, 0, o.y, o.z);
    const p = part(), ir = o.rx * (o.iris2 || 0.62), dy = -o.ry * 0.06;
    for (const sx of [-1, 1]) {
      p.within({ at: [sx * o.gap, 0, 0], rot: [o.tilt || 0, sx * (o.yaw === undefined ? 0.3 : o.yaw), 0] }, () => {
        p.ball(o.white || 0xfffcf4, { size: [o.rx, o.ry, o.rz], kind: "gloss", seg: [12, 9] });
        p.ball(o.iris, { at: [o.look || 0, dy, o.rz * 0.74], size: [ir, ir * 1.12, ir * 0.5], kind: "gloss", seg: [12, 8] });
        const ps = o.pupil || [0.52, 0.6];
        p.ball(0x15101c, { at: [o.look || 0, dy, o.rz * 0.86], size: [ir * ps[0], ir * ps[1], ir * 0.42], kind: "gloss", seg: [10, 6] });
        p.ball(0xffffff, { at: [(o.look || 0) + ir * 0.32, dy + ir * 0.38, o.rz * 1.0], size: ir * 0.22, kind: "gloss", seg: [6, 4] });
      });
    }
    p.build(g, { noShadow: true });
    return g;
  }
  // a little ring of spinning stars over a dazed head; hidden until the level shows it
  function dazedStars(parent, y, r) {
    const g = group(parent, 0, y, 0);
    const p = part();
    for (let i = 0; i < 3; i++) {
      const a = i / 3 * Math.PI * 2;
      p.star([0xffe25a, 0xfff3a8, 0xffc840][i], { at: [Math.cos(a) * r, 0, Math.sin(a) * r], size: 0.11, rot: [0, -a, 0], kind: "lit" });
    }
    p.build(g, { noShadow: true });
    g.visible = false;
    return g;
  }

  // ---------- registry and animation ----------
  function rig(root, probe) {
    const c = { root, probe: probe || root, blink: [], phase: Math.random() * 6, speed: 0, vUp: 0, last: null, seed: Math.random() * 10, drive: null, driveT: 0 };
    live.push(c);
    return c;
  }
  function addBlink(c, g) { c.blink.push({ g, next: 1 + Math.random() * 3, t: -1 }); }
  // fit a built body to a height: scale the inner group and stand its lowest point on y = 0
  function fit(inner, height) {
    inner.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(inner);
    const k = height / (box.max.y - box.min.y);
    inner.scale.setScalar(k);
    inner.position.y = -box.min.y * k;
    return k;
  }
  function showing(o) {
    for (let p = o; p; p = p.parent) { if (!p.visible) return false; if (p.isScene) return true; }
    return false;
  }
  const _w = new V3(), _d = new V3(), _up = new V3(), _wq = new THREE.Quaternion();
  function update(dt) {
    dt = Math.min(dt || 0, 0.1);
    if (!dt) return;
    time += dt;
    for (const c of live) {
      if (!showing(c.probe)) { c.last = null; continue; }
      // how fast it moves in the world, along the ground and up
      c.root.getWorldPosition(_w);
      let speed = 0, vUp = 0;
      if (c.last) {
        _d.subVectors(_w, c.last);
        const v = _d.length() / dt;
        if (v < 40) {              // a teleport is not a step
          c.root.getWorldQuaternion(_wq); _up.set(0, 1, 0).applyQuaternion(_wq);
          vUp = _d.dot(_up) / dt; speed = Math.sqrt(Math.max(0, v * v - vUp * vUp));
        }
      } else c.last = new V3();
      c.last.copy(_w);
      c.speed += (speed - c.speed) * Math.min(1, dt * 8);
      c.vUp += (vUp - c.vUp) * Math.min(1, dt * 8);
      if (c.driveT > 0) c.driveT -= dt; else c.drive = null;
      // blinking: a quick squash every few seconds, now and then twice
      for (const b of c.blink) {
        if (b.t < 0) { b.next -= dt; if (b.next <= 0) b.t = 0; }
        if (b.t >= 0) {
          b.t += dt;
          const k = b.t / 0.14;
          b.g.scale.y = k < 1 ? Math.max(0.08, Math.abs(1 - 2 * k)) : 1;
          if (k >= 1) { b.t = -1; b.next = Math.random() < 0.2 ? 0.18 : 1.8 + Math.random() * 3.2; }
        }
      }
      if (c.breathe) {
        const s = Math.sin(time * 2.2 + c.seed);
        c.breathe.scale.set(1 - s * c.breatheAmt * 0.5, 1 + s * c.breatheAmt, 1 - s * c.breatheAmt * 0.5);
      }
      if (c.walk) walk(c, dt);
      if (c.tick) c.tick(time, dt, c);
    }
  }
  // legs swing with the distance covered (the stride), arms against them; in the air the
  // legs tuck and the arms rise; a punch throws the right arm forward
  function walk(c, dt) {
    const W = c.walk, k = clamp(c.speed / W.full, 0, 1);
    c.phase += dt * c.speed / W.stride * Math.PI;
    const air = c.drive ? !!c.drive.air : Math.abs(c.vUp) > 3;
    const s = Math.sin(c.phase) * W.amp * k;
    const knee = (x) => Math.max(0, x) * 1.1;
    W.legs.forEach((L, i) => {
      if (!L) return;
      const sw = i ? -s : s;
      L.hip.rotation.x += ((air ? (i ? 0.5 : -0.9) : -sw) - L.hip.rotation.x) * Math.min(1, dt * 14);
      if (L.knee) L.knee.rotation.x += ((air ? (i ? 0.4 : 1.2) : knee(Math.sin(c.phase + (i ? Math.PI : 0) + 0.6)) * k) - L.knee.rotation.x) * Math.min(1, dt * 14);
    });
    const punch = c.drive && c.drive.punch || 0;
    W.arms.forEach((A, i) => {
      if (!A) return;
      let x = (i ? s : -s) * 0.9, z = 0;
      if (air) { x = -0.6; z = (i ? 1 : -1) * 0.9; }              // +z lifts the right arm outward, -z the left
      if (i === 1 && punch > 0) { x = -1.55 * punch; z = -0.12 * punch; }
      A.rotation.x += (x - A.rotation.x) * Math.min(1, dt * 16);
      A.rotation.z += (z + (A.userData.restZ || 0) - A.rotation.z) * Math.min(1, dt * 16);
    });
    if (W.bob) W.bob.position.y = (W.bobBase || 0) + Math.abs(Math.sin(c.phase)) * W.bobAmt * k;
  }
  // the game tells the player's avatar what the hero is doing (index.html)
  function drive(obj, d) {
    if (!obj) return;
    for (const c of live) {
      for (let p = c.root; p; p = p.parent) if (p === obj) { c.drive = d; c.driveT = 0.2; break; }
    }
  }

  // ============================================================
  // the brother: tall and lanky, knitted green beanie with a pompom, a brown mustache with
  // curled tips, a green jacket over a cream shirt, an orange scarf, teal trousers, laced
  // boots, a satchel and his lantern
  // ============================================================
  const SKIN = 0xf7c9a0;
  function brother(o) {
    o = Object.assign({ height: 1.85, lantern: true, lit: false, sit: false }, o || {});
    const g = new THREE.Group();
    const inner = group(g);
    const jacket = 0x3d8b4f, trousers = 0x2f5864, boot = 0x6b4423, hair = 0x6a4122;
    // legs: hip -> knee -> boot
    const legs = [];
    for (const sx of [-1, 1]) {
      const hip = group(inner, sx * 0.115, 0.84, 0);
      part().limb([0, 0, 0], [0, -0.34, 0.01], 0.088, 0.075, trousers).build(hip);
      const knee = group(hip, 0, -0.34, 0.01);
      part()
        .limb([0, 0, 0], [0, -0.3, 0], 0.075, 0.068, trousers)
        .torus(0x8a5a33, { at: [0, -0.3, 0], rot: [Math.PI / 2, 0, 0], size: 0.07, tube: 0.3 })
        .ball(boot, { at: [0, -0.38, 0.045], size: [0.095, 0.085, 0.155] })
        .ball(0x2e1d12, { at: [0, -0.445, 0.05], size: [0.1, 0.03, 0.165] })
        .box(0xd9c39a, { at: [0, -0.34, 0.13], size: [0.07, 0.012, 0.03], rot: [0.5, 0, 0] })
        .build(knee);
      legs.push({ hip, knee });
    }
    // torso, belt, scarf, satchel
    part()
      .ball(trousers, { at: [0, 0.86, 0], size: [0.19, 0.12, 0.14] })
      .ball(jacket, { at: [0, 1.1, 0], size: [0.215, 0.3, 0.16] })
      .ball(jacket, { at: [-0.18, 1.3, 0], size: 0.08 }).ball(jacket, { at: [0.18, 1.3, 0], size: 0.08 })
      .ball(0xf3ead2, { at: [0, 1.17, 0.115], size: [0.07, 0.15, 0.05] })
      .ball(0xe0b040, { at: [0, 1.06, 0.155], size: 0.016 }).ball(0xe0b040, { at: [0, 1.15, 0.16], size: 0.016 })
      .torus(0x5a3a22, { at: [0, 0.92, 0], rot: [Math.PI / 2, 0, 0], size: [0.18, 0.145, 0.18], tube: 0.16 })
      .box(0xe0b040, { at: [0, 0.92, 0.15], size: [0.06, 0.045, 0.02] })
      .box(0x7a4a2a, { at: [0.0, 1.13, 0.155], size: [0.035, 0.52, 0.02], rot: [0, 0, -0.62] })
      .ball(0x7a4a2a, { at: [0.2, 0.9, 0.08], size: [0.1, 0.085, 0.05], rot: [0, 0.6, 0] })
      .ball(0x96613a, { at: [0.21, 0.94, 0.1], size: [0.1, 0.05, 0.045], rot: [0, 0.6, 0] })
      .cyl(SKIN, { at: [0, 1.43, 0], size: [0.055, 0.1, 0.055] })
      .torus(0xe9892c, { at: [0, 1.4, 0], rot: [Math.PI / 2, 0, 0], size: 0.1, tube: 0.48 })
      .ball(0xe9892c, { at: [0.07, 1.29, 0.12], size: [0.045, 0.12, 0.025], rot: [0.2, 0, 0.25] })
      .ball(0xd07420, { at: [0.12, 1.31, 0.1], size: [0.04, 0.09, 0.022], rot: [0.2, 0, 0.45] })
      .build(inner);
    // head: long kind face, round nose, brown hair, knitted beanie
    const head = group(inner, 0, 1.45, 0);
    part()
      .ball(SKIN, { at: [0, 0.17, 0], size: [0.24, 0.255, 0.23], seg: [20, 14] })
      .ball(0xf2b48c, { at: [0, 0.115, 0.235], size: [0.06, 0.055, 0.055], seg: [12, 8] })
      // mustache: two full brown lobes under the nose, the tips curling up
      .ball(hair, { at: [-0.054, 0.07, 0.218], size: [0.07, 0.036, 0.035], rot: [0, -0.35, 0.22], seg: [12, 8] })
      .ball(hair, { at: [0.054, 0.07, 0.218], size: [0.07, 0.036, 0.035], rot: [0, 0.35, -0.22], seg: [12, 8] })
      .ball(hair, { at: [-0.116, 0.088, 0.186], size: [0.034, 0.022, 0.022], rot: [0, -0.7, -0.6] })
      .ball(hair, { at: [0.116, 0.088, 0.186], size: [0.034, 0.022, 0.022], rot: [0, 0.7, 0.6] })
      .ball(SKIN, { at: [-0.235, 0.14, -0.01], size: [0.045, 0.065, 0.035] }).ball(SKIN, { at: [0.235, 0.14, -0.01], size: [0.045, 0.065, 0.035] })
      .ball(hair, { at: [0, 0.22, -0.05], size: [0.25, 0.21, 0.225] })
      .ball(hair, { at: [-0.21, 0.1, 0.02], size: [0.04, 0.08, 0.05] }).ball(hair, { at: [0.21, 0.1, 0.02], size: [0.04, 0.08, 0.05] })
      .ball(hair, { at: [-0.08, 0.32, 0.17], size: [0.08, 0.045, 0.05], rot: [0, 0, 0.3] })
      .ball(hair, { at: [0.06, 0.33, 0.18], size: [0.07, 0.04, 0.05], rot: [0, 0, -0.2] })
      .dome((p, l) => Math.sin(Math.atan2(l.x, l.z) * 14) > 0.2 ? 0x2c6b3a : 0x347a44, { at: [0, 0.29, -0.01], size: [0.255, 0.24, 0.245], seg: [20, 6] })
      .torus((p, l) => Math.sin(Math.atan2(l.y, l.x) * 20) > 0 ? 0x8cc475 : 0x7ab866, { at: [0, 0.29, -0.01], rot: [Math.PI / 2 - 0.06, 0, 0], size: [0.25, 0.245, 0.25], tube: 0.2 })
      .ball(0xf2c94c, { at: [0, 0.55, -0.04], size: 0.075 })
      .torus(0x6a2a20, { at: [0, 0.028, 0.214], rot: [-0.25, 0, Math.PI], size: 0.042, tube: 0.25, arc: Math.PI })
      .ball(0xf29a8a, { at: [-0.13, 0.075, 0.19], size: [0.045, 0.028, 0.02], rot: [0, -0.6, 0] })
      .ball(0xf29a8a, { at: [0.13, 0.075, 0.19], size: [0.045, 0.028, 0.02], rot: [0, 0.6, 0] })
      .ball(hair, { at: [-0.09, 0.3, 0.205], size: [0.05, 0.014, 0.016], rot: [0, -0.3, 0.18] })
      .ball(hair, { at: [0.09, 0.3, 0.205], size: [0.05, 0.014, 0.016], rot: [0, 0.3, -0.18] })
      .build(head);
    const eyeG = eyes(head, { y: 0.205, z: 0.185, gap: 0.085, rx: 0.052, ry: 0.066, rz: 0.04, iris: 0x4e8a3a, yaw: 0.3 });
    // arms: shoulder pivot (the level turns it: waving, pulling the lever) -> swing (the walk)
    const arms = [];
    for (const sx of [-1, 1]) {
      const sh = group(inner, sx * 0.24, 1.31, 0);
      const sw = group(sh); sw.userData.restZ = sx * 0.1; sw.rotation.z = sw.userData.restZ;
      part()
        .limb([0, 0, 0], [sx * 0.04, -0.44, 0.02], 0.062, 0.052, jacket)
        .torus(0xf3ead2, { at: [sx * 0.04, -0.43, 0.02], rot: [Math.PI / 2, 0, 0], size: 0.05, tube: 0.35 })
        .ball(SKIN, { at: [sx * 0.045, -0.51, 0.03], size: [0.058, 0.068, 0.058] })
        .ball(SKIN, { at: [sx * 0.0, -0.49, 0.07], size: 0.025 })
        .build(sw);
      arms.push({ sh, sw });
    }
    const armL = arms[0].sh, armR = arms[1].sh;
    const k = fit(inner, o.height);
    // the lantern hangs from the left hand; it is a child of g so a level can keep it with a model
    let lantern = null, bulb = null, glass = null;
    if (o.lantern) {
      arms[0].sw.rotation.set(-0.45, 0, -0.05); arms[0].sw.userData.restZ = -0.05;
      g.updateMatrixWorld(true);
      const hand = arms[0].sw.localToWorld(new V3(-0.04, -0.56, 0.03));
      g.worldToLocal(hand);
      lantern = group(g, hand.x, hand.y, hand.z);
      const ls = k * 1.35;
      const fr = group(lantern); fr.scale.setScalar(ls);
      part()
        .torus(0xc8a040, { at: [0, 0.03, 0], size: 0.05, tube: 0.18, arc: Math.PI })
        .cone(0x34343e, { at: [0, -0.02, 0], size: [0.085, 0.07, 0.085] })
        .cyl(0x34343e, { at: [0, -0.06, 0], size: [0.085, 0.02, 0.085] })
        .cyl(0x34343e, { at: [0, -0.245, 0], size: [0.085, 0.03, 0.085] })
        .box(0x34343e, { at: [0.068, -0.15, 0], size: [0.012, 0.18, 0.012] }).box(0x34343e, { at: [-0.068, -0.15, 0], size: [0.012, 0.18, 0.012] })
        .box(0x34343e, { at: [0, -0.15, 0.068], size: [0.012, 0.18, 0.012] }).box(0x34343e, { at: [0, -0.15, -0.068], size: [0.012, 0.18, 0.012] })
        .build(fr);
      glass = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.065, 0.17, 12),
        new THREE.MeshStandardMaterial({ color: 0xffe9a0, emissive: 0xffc860, emissiveIntensity: o.lit ? 1.2 : 0.5, roughness: 0.3, transparent: true, opacity: 0.85 }));
      glass.position.y = -0.15 * ls; glass.scale.setScalar(ls); lantern.add(glass);
      bulb = new THREE.Mesh(new THREE.SphereGeometry(0.06 * ls, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffe9a0, transparent: true, opacity: 0.2 }));
      bulb.position.y = -0.15 * ls; lantern.add(bulb);
    }
    const c = rig(g, inner);
    addBlink(c, eyeG);
    c.walk = { legs, arms: [o.lantern ? null : arms[0].sw, arms[1].sw], stride: 1.3, full: 4, amp: 0.65, bob: inner, bobBase: inner.position.y, bobAmt: 0.03 * k };
    if (o.sit) {                     // riding: hips on the origin, legs astride, both hands forward
      c.walk = null;
      inner.position.y = -0.84 * k;
      legs.forEach((L, i) => { L.hip.rotation.set(-1.35, 0, (i ? -1 : 1) * 0.42); L.knee.rotation.x = 1.45; });
      arms.forEach((A, i) => { A.sw.rotation.set(-0.9, 0, (i ? 1 : -1) * 0.25); });
    }
    c.tick = (t) => { head.rotation.y = Math.sin(t * 0.5 + c.seed) * 0.12; head.rotation.x = Math.sin(t * 0.37 + c.seed) * 0.04; };
    return { g, inner, head, armL, armR, legs, lantern, bulb, glass, scale: k };
  }

  // ============================================================
  // the mushroom walker: rust cap with cream spots and a leaf sprout, a cream stem face with
  // big amber eyes and grumpy brows, stubby feet that waddle
  // ============================================================
  function mushroomWalker() {
    const g = new THREE.Group();
    const body = group(g);
    const squash = group(body);
    const capProf = [[0, 1.32], [0.3, 1.29], [0.6, 1.17], [0.82, 0.96], [0.9, 0.8], [0.84, 0.72], [0.6, 0.7], [0, 0.72]];
    const p = part()
      .lathe([[0, 0.12], [0.44, 0.14], [0.5, 0.3], [0.47, 0.5], [0.4, 0.62], [0, 0.66]], (q) => mix(0xe8d2b0, 0xfaecd4, q.y / 0.5), { seg: 24 })
      .lathe(capProf, (q) => mix(0xa8401f, 0xe36a3c, (q.y - 0.72) / 0.5), { seg: 32 })
      .lathe([[0.38, 0.62], [0.6, 0.655], [0.84, 0.72], [0.82, 0.735], [0.6, 0.69], [0.38, 0.65]], (q) => Math.sin(Math.atan2(q.x, q.z) * 30) > 0.3 ? 0xd9bf94 : 0xeedbb6, { seg: 32 });
    // cream spots sitting on the cap (height from the cap profile at that radius)
    const top = capProf.slice(0, 5);     // from the centre of the top out to the rim
    const capY = (r) => { for (let i = 0; i < top.length - 1; i++) { const [r0, y0] = top[i], [r1, y1] = top[i + 1]; if (r <= r1) return y0 + (y1 - y0) * (r - r0) / (r1 - r0); } return 0.8; };
    for (const [r, a, s] of [[0, 0, 0.15], [0.42, 0.4, 0.13], [0.45, 2.3, 0.12], [0.5, 4.1, 0.13], [0.72, 1.2, 0.1], [0.74, 3.1, 0.1], [0.7, 5.2, 0.11], [0.3, 3.6, 0.09], [0.78, 0.0, 0.08]]) {
      const x = Math.sin(a) * r, z = Math.cos(a) * r, y = capY(r);
      const n = new V3(x, (0.95 - y) * -1.2, z).normalize(); if (r < 0.01) n.set(0, 1, 0);
      const q = new THREE.Quaternion().setFromUnitVectors(new V3(0, 1, 0), n);
      const e = new THREE.Euler().setFromQuaternion(q);
      p.ball(0xfff6e4, { at: [x + n.x * 0.03, y + n.y * 0.03, z + n.z * 0.03], rot: [e.x, e.y, e.z], size: [s, s * 0.35, s], seg: [8, 4] });
    }
    p.ball(0x4a2a18, { at: [-0.17, 0.655, 0.47], size: [0.11, 0.035, 0.035], rot: [0, -0.3, -0.38] })
      .ball(0x4a2a18, { at: [0.17, 0.655, 0.47], size: [0.11, 0.035, 0.035], rot: [0, 0.3, 0.38] })
      .torus(0x5a2a1a, { at: [0, 0.28, 0.47], rot: [-0.35, 0, 0], size: 0.07, tube: 0.28, arc: Math.PI })
      .ball(0xffffff, { at: [0.035, 0.285, 0.475], size: [0.022, 0.03, 0.015] })
      .ball(0xf2a07a, { at: [-0.3, 0.33, 0.36], size: [0.07, 0.04, 0.03], rot: [0, -0.7, 0] })
      .ball(0xf2a07a, { at: [0.3, 0.33, 0.36], size: [0.07, 0.04, 0.03], rot: [0, 0.7, 0] })
      .build(squash);
    const eyeG = eyes(squash, { y: 0.45, z: 0.42, gap: 0.17, rx: 0.12, ry: 0.15, rz: 0.085, iris: 0xe89a20, yaw: 0.35, look: 0 });
    // the sprout on top: a thin stem and two leaves with a pale midrib
    const sprout = group(squash, 0, 1.3, 0);
    part()
      .limb([0, 0, 0], [0.02, 0.14, 0], 0.025, 0.02, 0x4f9a3a)
      .ball((q, l) => Math.abs(l.z) < 0.25 ? 0x9ad870 : 0x5cb84a, { at: [-0.1, 0.17, 0], size: [0.12, 0.025, 0.06], rot: [0, 0, 0.45] })
      .ball((q, l) => Math.abs(l.z) < 0.25 ? 0x9ad870 : 0x5cb84a, { at: [0.11, 0.18, 0], size: [0.11, 0.025, 0.055], rot: [0, 0.4, -0.5] })
      .build(sprout);
    // feet
    const feet = [];
    for (const sx of [-1, 1]) {
      const f = group(body, sx * 0.27, 0.13, 0.06);
      part().ball(0x5a3a22, { at: [0, -0.06, 0.05], size: [0.17, 0.11, 0.22] }).ball(0x3e2716, { at: [0, -0.13, 0.05], size: [0.16, 0.03, 0.2] }).build(f);
      feet.push(f);
    }
    // the "!" that pops up when it spots the hero
    const bang = group(g, 0, 2.2, 0);
    part().box(0xff3a2a, { at: [0, 0.12, 0], size: [0.16, 0.42, 0.16] }).ball(0xff3a2a, { at: [0, -0.22, 0], size: 0.09 }).build(bang, { noShadow: true });
    bang.mesh = bang.children[0]; bang.visible = false;
    const c = rig(g, squash);
    addBlink(c, eyeG);
    c.breathe = squash; c.breatheAmt = 0.025;
    c.tick = (t, dt) => {
      const k = clamp(c.speed / 3, 0, 1);
      c.phase += dt * (2 + c.speed * 2.2);
      feet.forEach((f, i) => {
        const s = Math.sin(c.phase + i * Math.PI);
        f.position.y = 0.13 + Math.max(0, s) * 0.09 * k;
        f.rotation.x = -s * 0.35 * k;
      });
      squash.rotation.z = Math.sin(c.phase) * 0.06 * k;
      sprout.rotation.z = Math.sin(t * 3 + c.seed) * 0.18 + Math.sin(c.phase) * 0.2 * k;
    };
    return { g, body, bang, feet };
  }

  // ============================================================
  // the winged turtle: a glossy green shell with raised plates and a cream rim, a round head
  // with a short beak and aviator goggles, four stubby legs and two feathered wings
  // ============================================================
  function wingedTurtle() {
    const g = new THREE.Group();
    const body = group(g);
    const inner = group(body);
    const skin = 0x8cc46a, amber = 0xe8b048;
    const sp = part().ball(0x3f8a4a, { at: [0, 0.95, -0.12], size: [0.64, 0.56, 0.7], seg: [20, 12] });
    // raised plates: one on top and a ring of six around it, following the shell surface
    const plates = [[0, 1]].concat([0, 1, 2, 3, 4, 5].map(i => [i / 6 * Math.PI * 2 + 0.3, 0.62]));
    for (const [a, r] of plates) {
      const ny = Math.sqrt(1 - r * r * 0.55), nx = Math.sin(a) * r * (a === 0 && r === 1 ? 0 : 1), nz = Math.cos(a) * r * (a === 0 && r === 1 ? 0 : 1);
      const n = new V3(nx, a === 0 && r === 1 ? 1 : ny, nz).normalize();
      const at = [n.x * 0.62, 0.95 + n.y * 0.55, -0.12 + n.z * 0.68];
      const q = new THREE.Quaternion().setFromUnitVectors(new V3(0, 1, 0), n), e = new THREE.Euler().setFromQuaternion(q);
      sp.ball(0x5aaa5e, { at, rot: [e.x, e.y, e.z], size: [0.2, 0.06, 0.2], seg: [6, 5] });
    }
    sp.build(inner).material = mats().gloss;
    part()
      .torus(0xf0e0b4, { at: [0, 0.8, -0.1], rot: [Math.PI / 2, 0, 0], size: [0.64, 0.72, 0.64], tube: 0.11 })
      .ball((q) => Math.sin(q.y * 42) > 0.75 ? 0xe2cc94 : 0xf3e2b0, { at: [0, 0.8, 0.16], size: [0.44, 0.37, 0.34] })
      .limb([0, 1.0, 0.3], [0, 1.25, 0.46], 0.13, 0.12, skin)
      .cone(skin, { at: [0, 0.6, -0.75], rot: [-2.0, 0, 0], size: [0.08, 0.3, 0.08] })
      .build(inner);
    const legP = part();
    for (const [x, z] of [[-0.36, 0.3], [0.36, 0.3], [-0.36, -0.36], [0.36, -0.36]]) {
      legP.limb([x, 0.5, z], [x * 1.05, 0.24, z + 0.02], 0.12, 0.11, skin)
        .ball(amber, { at: [x * 1.05, 0.16, z + 0.08], size: [0.13, 0.08, 0.17] });
    }
    legP.build(inner);
    // head: round, a short two-part beak, goggles pushed up on the forehead
    const head = group(inner, 0, 1.38, 0.52);
    part()
      .ball(skin, { size: [0.3, 0.285, 0.33], seg: [20, 14] })
      .ball(amber, { at: [0, -0.06, 0.3], size: [0.11, 0.065, 0.13], kind: "gloss" })
      .ball(0xd09a38, { at: [0, -0.11, 0.26], size: [0.08, 0.04, 0.09] })
      .ball(0xf2a8a0, { at: [-0.17, -0.05, 0.22], size: [0.05, 0.03, 0.02], rot: [0, -0.7, 0] })
      .ball(0xf2a8a0, { at: [0.17, -0.05, 0.22], size: [0.05, 0.03, 0.02], rot: [0, 0.7, 0] })
      .torus(0x6b4423, { at: [0, 0.13, -0.02], rot: [Math.PI / 2 - 0.45, 0, 0], size: [0.3, 0.33, 0.3], tube: 0.1 })
      .within({ at: [0, 0.2, 0.22], rot: [-0.55, 0, 0] }, (q) => {
        for (const sx of [-1, 1]) {
          q.torus(0xd8a640, { at: [sx * 0.1, 0, 0], size: 0.07, tube: 0.3, kind: "gloss" });
          q.ball(0xa8e0ff, { at: [sx * 0.1, 0, 0], size: [0.065, 0.065, 0.025], kind: "gloss" });
        }
        q.box(0x6b4423, { size: [0.06, 0.025, 0.03] });
      })
      .build(head);
    const eyeG = eyes(head, { y: 0.05, z: 0.265, gap: 0.115, rx: 0.085, ry: 0.105, rz: 0.06, iris: 0x4a3018, yaw: 0.4 });
    const dazed = dazedStars(body, 1.9, 0.36); dazed.position.z = 0.52;
    // wings: five fanned feathers each, white with pale blue tips
    const wings = [];
    for (const sx of [-1, 1]) {
      const w = group(body, sx * 0.55, 1.1, -0.1);
      const fan = group(w); fan.rotation.y = -sx * 0.85;       // the fan opens out to the side, so it reads from the front
      const wp = part();
      for (let k = 0; k < 5; k++) {
        const len = 0.98 - k * 0.12;
        wp.ball((q) => mix(0xfdfaf2, 0xbcd8ee, (q.length() - 0.5) / 0.6), { at: [sx * 0.06, 0.3 + len * 0.35 - k * 0.05, -0.12 - k * 0.12], rot: [-0.3 - k * 0.24, 0, 0], size: [0.035, len * 0.27, 0.16], seg: [8, 6] });
      }
      wp.build(fan);
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
    const c = rig(g, inner);
    addBlink(c, eyeG);
    c.breathe = inner; c.breatheAmt = 0.015;
    c.tick = (t, dt) => {
      head.rotation.x = Math.sin(t * 2.4 + c.seed) * 0.08;
      if (dazed.visible) { dazed.rotation.y += dt * 5; head.rotation.z = Math.sin(t * 6) * 0.12; } else head.rotation.z = 0;
    };
    return { g, body, wings, shadow, ring, dazed, head };
  }

  // ============================================================
  // the basalt beetle: a dome of dark basalt columns, a broad front shield with a short horn,
  // glowing amber eyes under it, six legs in two tripods; the glowing cracks on its back
  // (the weak spot) use the level's own material
  // ============================================================
  function hexCell(x, z, size) {           // distance to the edge of the hexagon around (x, z)
    const q = (2 / 3 * x) / size, r = (-1 / 3 * x + Math.sqrt(3) / 3 * z) / size;
    let cx = Math.round(q), cz = Math.round(r), cy = Math.round(-q - r);
    const dx = Math.abs(cx - q), dz = Math.abs(cz - r), dy = Math.abs(cy + q + r);
    if (dx > dy && dx > dz) cx = -cy - cz; else if (dy > dz) cy = -cx - cz; else cz = -cx - cy;
    const px = size * 1.5 * cx, pz = size * Math.sqrt(3) * (cz + cx / 2);
    return { d: Math.hypot(x - px, z - pz) / size, id: cx * 31 + cz * 17 };
  }
  function basaltBeetle(o) {
    o = o || {};
    const g = new THREE.Group();
    const body = group(g);
    const inner = group(body);
    const basalt = (q) => { const h = hexCell(q.x, q.z, 0.2); const v = hash(h.id, 1, 2); return h.d > 0.8 ? 0x1c1922 : mix(0x37333f, 0x4c4858, v); };
    const sp = part().dome(basalt, { at: [0, 0.32, -0.08], size: [0.92, 0.95, 1.02], seg: [28, 10] });
    for (const [x, z, hgt] of [[0, -0.1, 0.22], [0.3, 0.1, 0.16], [-0.28, -0.3, 0.18], [0.2, -0.45, 0.14], [-0.3, 0.15, 0.13], [0.42, -0.2, 0.12]]) {
      const y = 0.32 + 0.95 * Math.sqrt(Math.max(0, 1 - (x / 0.92) ** 2 - ((z + 0.08) / 1.02) ** 2));
      sp.cyl(mix(0x4a4656, 0x5d5a6c, hash(x, z, 1)), { at: [x, y + hgt * 0.2, z], size: [0.15, hgt, 0.15], sides: 6, rot: [x * 0.5, 0, -z * 0.5] });
    }
    sp.build(inner).material = mats().gloss;
    part()
      .torus(0x15131a, { at: [0, 0.33, -0.08], rot: [Math.PI / 2, 0, 0], size: [0.92, 1.02, 0.9], tube: 0.08 })
      .ball((q) => { const h = hexCell(q.x, q.y, 0.16); return h.d > 0.8 ? 0x24212c : mix(0x47435a, 0x5a5670, hash(h.id, 3, 1)); }, { at: [0, 0.68, 0.94], rot: [-0.28, 0, 0], size: [0.7, 0.36, 0.13] })
      .torus(0x7a7490, { at: [0, 0.69, 0.98], rot: [-0.28, 0, 0], size: [0.68, 0.35, 0.6], tube: 0.04 })
      .cone(0xc0b4a0, { at: [0, 1.02, 1.04], rot: [0.55, 0, 0], size: [0.1, 0.38, 0.1], kind: "gloss" })
      .ball(0x2b2733, { at: [0, 0.38, 0.98], size: [0.36, 0.24, 0.22] })
      .cone(0x8a7e6a, { at: [-0.12, 0.24, 1.18], rot: [1.5, 0.3, 0], size: [0.05, 0.18, 0.05] })
      .cone(0x8a7e6a, { at: [0.12, 0.24, 1.18], rot: [1.5, -0.3, 0], size: [0.05, 0.18, 0.05] })
      .build(inner);
    const eyeG = group(inner, 0, 0.48, 1.14);
    part().ball(0xffb030, { at: [-0.16, 0, 0], size: [0.085, 0.07, 0.05], kind: "lit" }).ball(0xffb030, { at: [0.16, 0, 0], size: [0.085, 0.07, 0.05], kind: "lit" })
      .ball(0x3a1a00, { at: [-0.16, 0, 0.04], size: [0.03, 0.045, 0.02], kind: "lit" }).ball(0x3a1a00, { at: [0.16, 0, 0.04], size: [0.03, 0.045, 0.02], kind: "lit" })
      .build(eyeG, { noShadow: true });
    const legsA = group(inner), legsB = group(inner);
    const lp = [part(), part()];
    [[-1, 0.45, 0], [1, 0.05, 1], [-1, -0.4, 0], [1, 0.45, 1], [-1, 0.05, 1], [1, -0.4, 0]].forEach(([sx, z, set]) => {
      lp[set].limb([sx * 0.72, 0.36, z], [sx * 0.98, 0.12, z + 0.06], 0.075, 0.06, 0x1c1a22)
        .ball(0x2b2733, { at: [sx * 1.0, 0.06, z + 0.1], size: [0.08, 0.06, 0.12] });
    });
    lp[0].build(legsA); lp[1].build(legsB);
    // the back: glowing zigzag cracks (scaled by the level when the beetle is stuck)
    const back = group(body, 0, 0.55, -0.6);
    if (o.crackMat) {
      const cp = part();
      [[-0.5, 0.75], [-0.15, 1], [0.2, 0.9], [0.55, 0.7]].forEach(([a, len]) => {
        let x = 0, y = 0.35, z = -0.2;
        for (let k = 0; k < 4; k++) {
          const nx = x + Math.sin(a) * 0.16 + (k % 2 ? 0.05 : -0.05), ny = y - 0.12 * len, nz = z - 0.07;
          cp.limb([x, y, z], [nx, ny, nz], 0.03, 0.025, 0xffffff, { mat: o.crackMat, sides: 5, noEnds: true });
          x = nx; y = ny; z = nz;
        }
      });
      cp.build(back, { noShadow: true });
    }
    const dazed = dazedStars(body, 1.55, 0.45);
    const c = rig(g, inner);
    addBlink(c, eyeG);
    c.breathe = inner; c.breatheAmt = 0.012;
    c.tick = (t, dt) => {
      const k = clamp(c.speed / 2, 0, 1);
      c.phase += dt * (1 + c.speed * 5);
      const s = Math.sin(c.phase);
      legsA.rotation.y = s * 0.28 * k; legsB.rotation.y = -s * 0.28 * k;
      legsA.position.y = Math.max(0, s) * 0.06 * k; legsB.position.y = Math.max(0, -s) * 0.06 * k;
      if (dazed.visible) dazed.rotation.y += dt * 5;
    };
    return { g, body, back, dazed };
  }

  // ============================================================
  // a mine monkey: round and brown with a pale face and belly, big ears, a yellow miner's helmet
  // with a lamp, a curled tail, holding a stone over its head
  // ============================================================
  function mineMonkey() {
    const g = new THREE.Group();
    const body = group(g);
    const inner = group(body);
    const fur = 0x8a5a30, tan = 0xe8c090;
    part()
      .ball(fur, { at: [0, 0.45, 0], size: [0.32, 0.35, 0.29] })
      .ball(tan, { at: [0, 0.42, 0.16], size: [0.21, 0.24, 0.15] })
      .limb([-0.15, 0.24, 0.04], [-0.2, 0.08, 0.12], 0.09, 0.08, fur).limb([0.15, 0.24, 0.04], [0.2, 0.08, 0.12], 0.09, 0.08, fur)
      .ball(tan, { at: [-0.21, 0.04, 0.16], size: [0.09, 0.05, 0.12] }).ball(tan, { at: [0.21, 0.04, 0.16], size: [0.09, 0.05, 0.12] })
      .limb([-0.25, 0.62, 0], [-0.42, 1.02, 0.08], 0.075, 0.065, fur).limb([-0.42, 1.02, 0.08], [-0.36, 1.42, 0.2], 0.065, 0.06, fur)
      .limb([0.25, 0.62, 0], [0.42, 1.02, 0.08], 0.075, 0.065, fur).limb([0.42, 1.02, 0.08], [0.36, 1.42, 0.2], 0.065, 0.06, fur)
      .ball(tan, { at: [-0.37, 1.47, 0.2], size: [0.08, 0.09, 0.08] }).ball(tan, { at: [0.37, 1.47, 0.2], size: [0.08, 0.09, 0.08] })
      .build(inner);
    const head = group(inner, 0, 0.98, 0.05);
    part()
      .ball(fur, { size: [0.33, 0.3, 0.3], seg: [18, 12] })
      .ball(tan, { at: [-0.09, 0.0, 0.2], size: [0.13, 0.14, 0.1] }).ball(tan, { at: [0.09, 0.0, 0.2], size: [0.13, 0.14, 0.1] })
      .ball(tan, { at: [0, -0.12, 0.22], size: [0.16, 0.1, 0.1] })
      .ball(0x5a3018, { at: [0, -0.07, 0.315], size: [0.035, 0.022, 0.015] })
      .torus(0x5a2a1a, { at: [0, -0.13, 0.31], rot: [-0.3, 0, Math.PI], size: 0.055, tube: 0.25, arc: Math.PI })
      .ball(fur, { at: [-0.33, 0.02, 0], size: [0.12, 0.13, 0.045], rot: [0, -0.4, 0] }).ball(fur, { at: [0.33, 0.02, 0], size: [0.12, 0.13, 0.045], rot: [0, 0.4, 0] })
      .ball(0xf0a0a0, { at: [-0.335, 0.02, 0.03], size: [0.075, 0.085, 0.02], rot: [0, -0.4, 0] }).ball(0xf0a0a0, { at: [0.335, 0.02, 0.03], size: [0.075, 0.085, 0.02], rot: [0, 0.4, 0] })
      .dome(0xf2c230, { at: [0, 0.15, -0.03], size: [0.3, 0.2, 0.29], kind: "gloss" })
      .cyl(0xe0aa20, { at: [0, 0.15, 0.0], size: [0.33, 0.025, 0.33] })
      .box(0xe0aa20, { at: [0, 0.31, -0.03], size: [0.05, 0.07, 0.38] })
      .cyl(0x55555f, { at: [0, 0.26, 0.24], rot: [Math.PI / 2 - 0.3, 0, 0], size: [0.05, 0.05, 0.05] })
      .ball(0xfff2b0, { at: [0, 0.27, 0.27], rot: [-0.3, 0, 0], size: [0.04, 0.04, 0.02], kind: "lit" })
      .build(head);
    const eyeG = eyes(head, { y: 0.02, z: 0.28, gap: 0.09, rx: 0.062, ry: 0.075, rz: 0.042, iris: 0x4a2a10, yaw: 0.3 });
    const tail = group(inner, 0, 0.32, -0.26);
    part().tube([[0, 0, 0], [0, -0.05, -0.25], [0, 0.15, -0.45], [0, 0.42, -0.42], [0, 0.48, -0.25], [0, 0.36, -0.2]], 0.05, 0.035, fur).build(tail);
    const stone = new THREE.Mesh(new THREE.DodecahedronGeometry(0.42, 0), new THREE.MeshStandardMaterial({ color: 0x5a5466, roughness: 0.95, flatShading: true }));
    stone.position.set(0, 1.62, 0.2); stone.castShadow = true; g.add(stone);
    const c = rig(g, inner);
    addBlink(c, eyeG);
    c.breathe = inner; c.breatheAmt = 0.02;
    c.tick = (t) => { tail.rotation.z = Math.sin(t * 2.6 + c.seed) * 0.35; head.rotation.z = Math.sin(t * 1.3 + c.seed) * 0.08; };
    return { g, body, stone, head };
  }

  // ============================================================
  // the young villain: a small blue-violet imp in an orange beret and a paint-splashed smock,
  // two little horns, a toothy grin, a tail dipped in paint, and the magic brush
  // ============================================================
  function youngVillain() {
    const g = new THREE.Group();
    const inner = group(g);
    const skin = 0x5d52c4, belly = 0xc9b8f0;
    const splash = (q) => {
      const h = hash(Math.floor(q.x * 11), Math.floor(q.y * 11), 1);
      return h < 0.09 ? 0xe84a5f : h < 0.17 ? 0x3fb3e0 : h < 0.24 ? 0xf2c230 : h < 0.3 ? 0xb050ff : 0xf6efe0;
    };
    part()
      .limb([-0.14, 0.36, 0], [-0.15, 0.1, 0.02], 0.1, 0.09, skin).limb([0.14, 0.36, 0], [0.15, 0.1, 0.02], 0.1, 0.09, skin)
      .ball(skin, { at: [-0.15, 0.06, 0.07], size: [0.11, 0.07, 0.16] }).ball(skin, { at: [0.15, 0.06, 0.07], size: [0.11, 0.07, 0.16] })
      .cone(0xf3e6c8, { at: [-0.2, 0.05, 0.21], rot: [1.57, 0, 0], size: [0.025, 0.06, 0.025] }).cone(0xf3e6c8, { at: [-0.12, 0.05, 0.22], rot: [1.57, 0, 0], size: [0.025, 0.06, 0.025] })
      .cone(0xf3e6c8, { at: [0.2, 0.05, 0.21], rot: [1.57, 0, 0], size: [0.025, 0.06, 0.025] }).cone(0xf3e6c8, { at: [0.12, 0.05, 0.22], rot: [1.57, 0, 0], size: [0.025, 0.06, 0.025] })
      .ball(skin, { at: [0, 0.64, 0], size: [0.34, 0.37, 0.3] })
      .ball(splash, { at: [0, 0.6, 0.15], size: [0.29, 0.31, 0.18], seg: [18, 12] })
      .box(0xf4ecd8, { at: [-0.17, 0.88, 0.1], rot: [0.3, 0, 0.35], size: [0.06, 0.22, 0.03] })
      .box(0xf4ecd8, { at: [0.17, 0.88, 0.1], rot: [0.3, 0, -0.35], size: [0.06, 0.22, 0.03] })
      .ball(0xe84a5f, { at: [0, 0.96, 0.2], size: [0.06, 0.04, 0.04] })
      .cone(0xe84a5f, { at: [-0.04, 0.9, 0.22], rot: [0.2, 0, 0.5], size: [0.03, 0.1, 0.02] })
      .cone(0xe84a5f, { at: [0.04, 0.9, 0.22], rot: [0.2, 0, -0.5], size: [0.03, 0.1, 0.02] })
      .limb([-0.3, 0.86, 0], [-0.42, 0.58, 0.08], 0.075, 0.065, skin).ball(skin, { at: [-0.44, 0.52, 0.1], size: 0.075 })
      .limb([0.3, 0.86, 0], [0.5, 0.98, 0.1], 0.075, 0.065, skin).ball(skin, { at: [0.54, 1.0, 0.1], size: 0.08 })
      .build(inner);
    const head = group(inner, 0, 1.12, 0.03);
    part()
      .ball(skin, { size: [0.31, 0.29, 0.29], seg: [20, 14] })
      .ball(belly, { at: [0, -0.1, 0.2], size: [0.17, 0.11, 0.13] })
      .torus(0x2a1a40, { at: [0, -0.1, 0.33], rot: [-0.2, 0, Math.PI], size: [0.1, 0.07, 0.1], tube: 0.18, arc: Math.PI })
      .cone(0xffffff, { at: [0.05, -0.14, 0.33], rot: [Math.PI, 0, 0], size: [0.022, 0.05, 0.022] })
      .cone(0xf3e6c8, { at: [-0.17, 0.26, -0.03], rot: [0.2, 0, 0.5], size: [0.05, 0.16, 0.05] })
      .cone(0xf3e6c8, { at: [0.17, 0.26, -0.03], rot: [0.2, 0, -0.5], size: [0.05, 0.16, 0.05] })
      .cone(skin, { at: [-0.31, 0.04, -0.02], rot: [0, 0, 1.25], size: [0.06, 0.16, 0.04] })
      .cone(skin, { at: [0.31, 0.04, -0.02], rot: [0, 0, -1.25], size: [0.06, 0.16, 0.04] })
      .ball(0xf07a2a, { at: [0.05, 0.25, -0.02], rot: [0, 0, -0.22], size: [0.33, 0.09, 0.32] })
      .cyl(0xd0601a, { at: [0.08, 0.34, -0.02], rot: [0, 0, -0.22], size: [0.025, 0.06, 0.025] })
      .ball(0x8a7ae0, { at: [-0.18, -0.03, 0.2], size: [0.045, 0.028, 0.02], rot: [0, -0.6, 0] })
      .ball(0x8a7ae0, { at: [0.18, -0.03, 0.2], size: [0.045, 0.028, 0.02], rot: [0, 0.6, 0] })
      .ball(0x2a2050, { at: [-0.11, 0.2, 0.25], size: [0.07, 0.016, 0.018], rot: [0, -0.3, -0.4] })
      .ball(0x2a2050, { at: [0.11, 0.2, 0.25], size: [0.07, 0.016, 0.018], rot: [0, 0.3, 0.4] })
      .build(head);
    const eyeG = eyes(head, { y: 0.08, z: 0.22, gap: 0.11, rx: 0.08, ry: 0.095, rz: 0.06, iris: 0xf2c230, yaw: 0.35, pupil: [0.26, 0.72] });
    const tail = group(inner, 0, 0.45, -0.26);
    part().tube([[0, 0, 0], [0, -0.1, -0.25], [0, 0.0, -0.5], [0, 0.25, -0.62]], 0.08, 0.035, skin, { noEnds: true })
      .ball(skin, { at: [0, 0, 0], size: 0.08 })
      .ball(0xb050ff, { at: [0, 0.3, -0.64], size: [0.07, 0.1, 0.07] })
      .build(tail);
    // the brush: the level raises it (rotation.x) and lights the tip (emissiveIntensity)
    const brush = group(g, 0.55, 1.0, 0.1);
    part()
      .cyl(0x8a5a30, { at: [0, 0.55, 0], size: [0.045, 1.5, 0.045] })
      .cyl(0xd8a640, { at: [0, 1.3, 0], size: [0.06, 0.14, 0.06], kind: "gloss" })
      .ball(0x5a3a20, { at: [0, -0.2, 0], size: 0.06 })
      .build(brush);
    const tipGeo = new THREE.SphereGeometry(1, 14, 10); tipGeo.scale(0.12, 0.24, 0.12);
    const tip = new THREE.Mesh(tipGeo, new THREE.MeshStandardMaterial({ color: 0xb050ff, emissive: 0x8020ff, emissiveIntensity: 0.6, roughness: 0.4 }));
    tip.position.y = 1.5; brush.add(tip);
    const drip = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), tip.material); drip.position.set(0.02, -0.25, 0.02); drip.scale.set(1, 1.5, 1); tip.add(drip);
    const c = rig(g, inner);
    addBlink(c, eyeG);
    c.breathe = inner; c.breatheAmt = 0.02;
    c.tick = (t) => { tail.rotation.y = Math.sin(t * 2.2 + c.seed) * 0.4; head.rotation.z = Math.sin(t * 1.7 + c.seed) * 0.07; };
    return { g, brush, tip, head };
  }

  // ============================================================
  // the ink squid: an indigo bullet-shaped mantle fading to lavender, two fins, glowing lilac
  // spots, big sleepy purple eyes, eight tentacles that pulse as it hovers
  // ============================================================
  function inkSquid() {
    const g = new THREE.Group();          // the level scales this one (the puff before it spits)
    const inner = group(g);
    part()
      .lathe([[0, 2.25], [0.2, 2.18], [0.36, 2.0], [0.48, 1.75], [0.52, 1.45], [0.5, 1.15], [0.42, 0.9], [0.3, 0.76], [0, 0.72]], (q) => mix(0xbfb0ec, 0x40328a, (q.y - 0.8) / 1.1), { seg: 28 })
      .ball(0x4a3a98, { at: [-0.42, 1.98, -0.02], rot: [0, 0, 0.7], size: [0.32, 0.16, 0.04] })
      .ball(0x4a3a98, { at: [0.42, 1.98, -0.02], rot: [0, 0, -0.7], size: [0.32, 0.16, 0.04] })
      .torus(0x2a1a50, { at: [0, 0.9, 0.36], rot: [-0.4, 0, 0], size: 0.045, tube: 0.35 })
      .ball(0xd890c0, { at: [-0.25, 1.02, 0.39], size: [0.06, 0.035, 0.02], rot: [0, -0.6, 0] })
      .ball(0xd890c0, { at: [0.25, 1.02, 0.39], size: [0.06, 0.035, 0.02], rot: [0, 0.6, 0] })
      .build(inner);
    const spots = part();
    for (let i = 0; i < 9; i++) {
      const a = i / 9 * Math.PI * 2 + 0.3, y = 1.45 + (i % 3) * 0.22, r = 0.52 - (i % 3) * 0.07;
      if (Math.cos(a) > 0.6) continue;         // keep the face clear
      spots.ball(0xe0b0ff, { at: [Math.sin(a) * r, y, Math.cos(a) * r], size: 0.05, kind: "lit", seg: [8, 6] });
    }
    spots.build(inner, { noShadow: true });
    const eyeG = eyes(inner, { y: 1.15, z: 0.38, gap: 0.17, rx: 0.12, ry: 0.14, rz: 0.08, iris: 0x8a50d8, yaw: 0.45, tilt: 0.1 });
    const tent = group(inner, 0, 0.8, 0);
    const tp = part();
    for (let i = 0; i < 8; i++) {
      const a = i / 8 * Math.PI * 2 + 0.2, cs = Math.cos(a), sn = Math.sin(a), curl = i % 2 ? 1 : -1;
      tp.tube([[0.24 * sn, 0, 0.24 * cs], [0.32 * sn, -0.35, 0.32 * cs], [0.36 * sn, -0.7, 0.36 * cs],
        [0.46 * sn + 0.08 * curl * cs, -0.92, 0.46 * cs - 0.08 * curl * sn], [0.58 * sn, -0.98, 0.58 * cs]], 0.075, 0.022, (q) => mix(0xc8b8f0, 0x7a64c8, -q.y), { segs: 12, sides: 7 });
    }
    tp.build(tent);
    const c = rig(g, inner);
    addBlink(c, eyeG);
    c.tick = (t) => {
      const s = Math.sin(t * 2.4 + c.seed);
      tent.scale.set(1 + 0.16 * s, 1 - 0.1 * s, 1 + 0.16 * s);
      tent.rotation.y = Math.sin(t * 0.8 + c.seed) * 0.25;
      inner.rotation.z = Math.sin(t * 1.3 + c.seed) * 0.05;
    };
    return { g, inner };
  }

  // ============================================================
  // the big ape: dark brown fur, a tan face and chest, a yellow hard hat with a lamp, a red
  // neckerchief, huge hands; arms pivot at the shoulders and point up (holding the beam)
  // ============================================================
  function bigApe() {
    const g = new THREE.Group();
    const inner = group(g);
    const fur = 0x5a3a22, face = 0xd9a873, muzzle = 0xe8c090;
    const furC = (q) => mix(fur, 0x6e4a2c, hash(Math.floor(q.x * 12), Math.floor(q.y * 12), Math.floor(q.z * 12)) * 0.8);
    part()
      .limb([-0.5, 0.75, 0], [-0.56, 0.2, 0.05], 0.32, 0.27, furC).limb([0.5, 0.75, 0], [0.56, 0.2, 0.05], 0.32, 0.27, furC)
      .ball(0x8a6a4a, { at: [-0.56, 0.1, 0.18], size: [0.3, 0.14, 0.4] }).ball(0x8a6a4a, { at: [0.56, 0.1, 0.18], size: [0.3, 0.14, 0.4] })
      .ball(furC, { at: [0, 1.45, 0], size: [0.98, 0.95, 0.78] })
      .ball(face, { at: [0, 1.5, 0.44], size: [0.62, 0.62, 0.38], seg: [20, 14] })
      .torus(0xc8946a, { at: [0, 1.78, 0.66], rot: [-0.5, 0, Math.PI], size: [0.3, 0.12, 0.3], tube: 0.12, arc: Math.PI })
      .ball(furC, { at: [-0.85, 2.0, 0], size: 0.45 }).ball(furC, { at: [0.85, 2.0, 0], size: 0.45 })
      .torus(0xd8382c, { at: [0, 2.28, 0.05], rot: [Math.PI / 2 - 0.15, 0, 0], size: [0.46, 0.42, 0.46], tube: 0.22 })
      .ball(0xd8382c, { at: [0.32, 2.2, 0.38], size: 0.12 })
      .ball((q, l) => l.y > 0.4 ? 0xf0f0e0 : 0xd8382c, { at: [0.4, 2.02, 0.42], rot: [0.2, 0, 0.5], size: [0.08, 0.2, 0.04] })
      .ball(0xd8382c, { at: [0.26, 2.03, 0.45], rot: [0.2, 0, 0.1], size: [0.07, 0.17, 0.04] })
      .build(inner);
    const head = group(inner, 0, 2.45, 0.15);
    part()
      .ball(furC, { at: [0, 0.15, 0], size: [0.58, 0.55, 0.52] })
      .ball(face, { at: [0, 0.05, 0.3], size: [0.45, 0.4, 0.28] })
      .ball(fur, { at: [0, 0.33, 0.5], size: [0.4, 0.07, 0.1] })
      .ball(muzzle, { at: [0, -0.13, 0.45], size: [0.34, 0.22, 0.2] })
      .ball(0x3a2414, { at: [-0.08, -0.06, 0.63], size: [0.05, 0.035, 0.03] }).ball(0x3a2414, { at: [0.08, -0.06, 0.63], size: [0.05, 0.035, 0.03] })
      .torus(0x5a2a1a, { at: [0, -0.2, 0.6], rot: [-0.4, 0, Math.PI], size: [0.13, 0.08, 0.13], tube: 0.18, arc: Math.PI })
      .ball(face, { at: [-0.55, 0.1, 0.05], size: [0.12, 0.15, 0.08] }).ball(face, { at: [0.55, 0.1, 0.05], size: [0.12, 0.15, 0.08] })
      .dome(0xf2c230, { at: [0, 0.4, -0.02], size: [0.6, 0.4, 0.58], kind: "gloss" })
      .cyl(0xe0aa20, { at: [0, 0.4, 0.04], size: [0.66, 0.04, 0.68], kind: "gloss" })
      .box(0xe0aa20, { at: [0, 0.73, -0.02], size: [0.08, 0.12, 0.8], kind: "gloss" })
      .cyl(0x55555f, { at: [0, 0.56, 0.56], rot: [Math.PI / 2 - 0.4, 0, 0], size: [0.1, 0.1, 0.1] })
      .ball(0xfff2b0, { at: [0, 0.58, 0.61], rot: [-0.4, 0, 0], size: [0.08, 0.08, 0.03], kind: "lit" })
      .build(head);
    const eyeG = eyes(head, { y: 0.17, z: 0.56, gap: 0.16, rx: 0.095, ry: 0.11, rz: 0.06, iris: 0x5a3010, yaw: 0.3 });
    const arms = [];
    for (const sx of [-1, 1]) {
      const a = group(g, sx * 0.95, 2.1, 0);
      part()
        .limb([0, 0, 0], [0, 1.25, 0], 0.3, 0.26, furC)
        .ball(face, { at: [0, 1.5, 0.02], size: [0.36, 0.33, 0.33] })
        .ball(0xc8946a, { at: [0, 1.75, 0.05], size: [0.3, 0.1, 0.26] })
        .build(a);
      a.rotation.z = sx * -0.35;
      arms.push(a);
    }
    const c = rig(g, inner);
    addBlink(c, eyeG);
    c.breathe = inner; c.breatheAmt = 0.012;
    c.tick = (t) => { head.rotation.y = Math.sin(t * 0.6 + c.seed) * 0.1; };
    return { g, arms, head };
  }

  // ============================================================
  // the dinosaur: teal with a cream belly, rounded orange plates along the neck and tail, a
  // round snout with freckles, big eyes, a leather saddle; legs walk with the distance covered
  // ============================================================
  function dinosaur() {
    const g = new THREE.Group();
    const inner = group(g);
    const teal = 0x36b5a0, light = 0x5cc9b0, cream = 0xf6ecd0, plate = 0xf0904a;
    part()
      .ball(teal, { at: [0, 0.68, -0.08], size: [0.44, 0.4, 0.6] })
      .ball(cream, { at: [0, 0.62, 0.12], size: [0.34, 0.32, 0.45] })
      .limb([0, 0.95, 0.22], [0, 1.32, 0.48], 0.21, 0.18, teal)
      .ball(cream, { at: [0, 1.05, 0.38], size: [0.14, 0.2, 0.1], rot: [-0.6, 0, 0] })
      .ball(0x9a4a2a, { at: [0, 1.0, -0.33], size: [0.33, 0.07, 0.3] })
      .ball(0xc06a3a, { at: [0, 1.04, -0.33], size: [0.27, 0.05, 0.24] })
      .box(0x6a3a20, { at: [-0.36, 0.82, -0.3], size: [0.03, 0.32, 0.06], rot: [0, 0, 0.35] })
      .box(0x6a3a20, { at: [0.36, 0.82, -0.3], size: [0.03, 0.32, 0.06], rot: [0, 0, -0.35] })
      .limb([-0.3, 0.9, 0.3], [-0.36, 0.72, 0.5], 0.07, 0.06, teal).limb([0.3, 0.9, 0.3], [0.36, 0.72, 0.5], 0.07, 0.06, teal)
      .ball(light, { at: [-0.37, 0.68, 0.54], size: 0.07 }).ball(light, { at: [0.37, 0.68, 0.54], size: 0.07 })
      .build(inner);
    const plates = part();
    [[1.18, 0.4, 0.6], [1.0, 0.17, 0.55], [0.86, -0.75, 0.5], [0.76, -0.98, 0.42], [0.66, -1.2, 0.34]].forEach(([y, z, s]) =>
      plates.ball(plate, { at: [0, y + 0.05, z - 0.06], rot: [0.5, 0, 0], size: [0.04, 0.16 * s / 0.6, 0.12 * s / 0.6] }));
    plates.build(inner);
    const tail = group(inner, 0, 0.7, -0.6);
    part().tube([[0, 0, 0], [0, -0.08, -0.35], [0, -0.12, -0.7], [0.06, -0.04, -0.95]], 0.24, 0.05, teal, { noEnds: true }).build(tail);
    const legs = [];
    for (const sx of [-1, 1]) {
      const hip = group(inner, sx * 0.27, 0.58, -0.12);
      part()
        .ball(teal, { at: [0, -0.02, 0], size: [0.2, 0.26, 0.26] })
        .limb([0, -0.1, 0], [0, -0.42, 0.06], 0.13, 0.11, teal)
        .ball(0xd86a30, { at: [0, -0.5, 0.12], size: [0.17, 0.11, 0.24] })
        .ball(0xf6ecd0, { at: [0, -0.56, 0.12], size: [0.17, 0.035, 0.24] })
        .build(hip);
      legs.push({ hip });
    }
    const head = group(inner, 0, 1.45, 0.55);
    part()
      .ball((q) => hash(Math.floor(q.x * 22), Math.floor(q.y * 22), 3) < 0.06 ? 0x2a8a78 : teal, { at: [0, 0.1, 0], size: [0.36, 0.34, 0.36], seg: [22, 16] })
      .ball(light, { at: [0, -0.02, 0.36], size: [0.3, 0.22, 0.3], seg: [22, 14] })
      .ball(0x1f6a5c, { at: [-0.08, 0.09, 0.62], size: [0.03, 0.02, 0.02] }).ball(0x1f6a5c, { at: [0.08, 0.09, 0.62], size: [0.03, 0.02, 0.02] })
      .torus(0x1f5a4c, { at: [0, -0.06, 0.38], rot: [Math.PI / 2 + 0.25, 0, Math.PI], size: [0.27, 0.28, 0.2], tube: 0.04, arc: Math.PI })
      .ball(0xf29a8a, { at: [-0.25, -0.02, 0.4], size: [0.05, 0.03, 0.02], rot: [0, -0.8, 0] })
      .ball(0xf29a8a, { at: [0.25, -0.02, 0.4], size: [0.05, 0.03, 0.02], rot: [0, 0.8, 0] })
      .ball(plate, { at: [0, 0.38, -0.12], rot: [0.4, 0, 0], size: [0.04, 0.12, 0.1] })
      .ball(plate, { at: [0, 0.3, -0.3], rot: [0.8, 0, 0], size: [0.035, 0.1, 0.09] })
      .build(head);
    const eyeG = eyes(head, { y: 0.27, z: 0.17, gap: 0.135, rx: 0.11, ry: 0.14, rz: 0.08, iris: 0x3a2a1a, yaw: 0.35 });
    const c = rig(g, inner);
    addBlink(c, eyeG);
    c.breathe = inner; c.breatheAmt = 0.012;
    c.walk = { legs, arms: [], stride: 1.2, full: 5, amp: 0.55, bob: inner, bobBase: 0, bobAmt: 0.04 };
    c.tick = (t) => { tail.rotation.y = Math.sin(t * 2 + c.seed) * 0.25; head.rotation.x = Math.sin(t * 1.1 + c.seed) * 0.05; };
    return { g, head, tail };
  }

  // ============================================================
  // the mushroom friend: a small person under a wide deep-blue cap with glowing cyan spots
  // (a swamp glow mushroom), a moss-green poncho, holding a little glowing mushroom
  // ============================================================
  function mushroomFriend() {
    const g = new THREE.Group();
    const inner = group(g);
    const skin = 0xffe2c4;
    part()
      .ball(0x6b4423, { at: [-0.09, 0.05, 0.03], size: [0.08, 0.055, 0.12] }).ball(0x6b4423, { at: [0.09, 0.05, 0.03], size: [0.08, 0.055, 0.12] })
      .limb([-0.08, 0.2, 0], [-0.09, 0.08, 0.01], 0.05, 0.045, 0xf4ecd8).limb([0.08, 0.2, 0], [0.09, 0.08, 0.01], 0.05, 0.045, 0xf4ecd8)
      .lathe([[0.0, 0.48], [0.15, 0.47], [0.24, 0.36], [0.26, 0.24], [0.2, 0.18], [0, 0.18]], (q) => mix(0x5a8a3a, 0x7aaa52, (q.y - 0.18) / 0.3), { seg: 20 })
      .torus(0x4a7a30, { at: [0, 0.46, 0], rot: [Math.PI / 2, 0, 0], size: 0.13, tube: 0.3 })
      .ball(0x8a5a33, { at: [-0.2, 0.26, 0.05], size: [0.07, 0.07, 0.04], rot: [0, -0.4, 0] })
      .limb([-0.18, 0.4, 0.02], [-0.26, 0.24, 0.1], 0.045, 0.04, 0x7aaa52).ball(skin, { at: [-0.27, 0.22, 0.12], size: 0.045 })
      .limb([0.18, 0.4, 0.02], [0.22, 0.32, 0.2], 0.045, 0.04, 0x7aaa52).ball(skin, { at: [0.22, 0.31, 0.23], size: 0.045 })
      .ball(skin, { at: [0, 0.62, 0.03], size: [0.23, 0.21, 0.2] })
      .torus(0x8a3a2a, { at: [0, 0.55, 0.215], rot: [-0.3, 0, Math.PI], size: 0.04, tube: 0.28, arc: Math.PI })
      .ball(0xf6a090, { at: [-0.13, 0.57, 0.17], size: [0.04, 0.025, 0.02], rot: [0, -0.6, 0] })
      .ball(0xf6a090, { at: [0.13, 0.57, 0.17], size: [0.04, 0.025, 0.02], rot: [0, 0.6, 0] })
      .lathe([[0, 1.2], [0.12, 1.19], [0.24, 1.15], [0.34, 1.09], [0.43, 1.0], [0.5, 0.9], [0.54, 0.81], [0.53, 0.76], [0.46, 0.74], [0.3, 0.76], [0, 0.78]], (q) => mix(0x1f4f8a, 0x3a86c8, (q.y - 0.74) / 0.4), { seg: 30 })
      .build(inner);
    // glowing spots on the cap and the little mushroom in his hand
    const glow = part();
    for (const [r, a, s] of [[0, 0, 0.1], [0.3, 0.5, 0.08], [0.32, 2.4, 0.08], [0.33, 4.3, 0.08], [0.45, 1.5, 0.06], [0.46, 3.4, 0.06], [0.45, 5.3, 0.06]]) {
      const y = 1.2 - (r / 0.55) ** 2 * 0.36 + 0.01, n = new V3(Math.sin(a) * r, 0.6, Math.cos(a) * r).normalize();
      const q = new THREE.Quaternion().setFromUnitVectors(new V3(0, 1, 0), n), e = new THREE.Euler().setFromQuaternion(q);
      glow.ball(0x8ff4ff, { at: [Math.sin(a) * r, y, Math.cos(a) * r], rot: [e.x, e.y, e.z], size: [s, s * 0.3, s], kind: "lit", seg: [10, 6] });
    }
    glow.dome(0x8ff4ff, { at: [0.22, 0.4, 0.24], size: [0.07, 0.05, 0.07], kind: "lit" }).limb([0.22, 0.32, 0.24], [0.22, 0.4, 0.24], 0.02, 0.018, 0xf4ffff, { kind: "lit" });
    glow.build(inner, { noShadow: true });
    const eyeG = eyes(inner, { y: 0.65, z: 0.18, gap: 0.08, rx: 0.055, ry: 0.075, rz: 0.04, iris: 0x2a3a6a, yaw: 0.3 });
    const c = rig(g, inner);
    addBlink(c, eyeG);
    c.breathe = inner; c.breatheAmt = 0.02;
    return { g };
  }

  // ============================================================
  // the swamp snapper: a flytrap pod (two jaws with cream teeth, plum outside, pink inside) on a
  // curved stem, two little eyes on stalks, broad leaves at its foot
  // ============================================================
  function swampSnapper() {
    const g = new THREE.Group();
    const leaf = (q, l) => Math.abs(l.z) < 0.12 ? 0x7ac860 : mix(0x2f7a35, 0x4a9a42, l.x * 0.5 + 0.5);
    const stem = group(g);
    // the leaves sit inside the stem group (so a model hides them too) and turn back against it,
    // so they stay flat on the ground while the stem bends
    const leaves = group(stem);
    const lp = part();
    for (let i = 0; i < 4; i++) {
      const a = i / 4 * Math.PI * 2 + 0.4;
      lp.ball(leaf, { at: [Math.cos(a) * 0.42, 0.08, -Math.sin(a) * 0.42], rot: [0, a, -0.15], order: "YXZ", size: [0.48, 0.04, 0.2] });
    }
    lp.build(leaves);
    part()
      .tube([[0, 0, 0], [0.04, 0.45, 0.02], [-0.04, 0.95, 0.06], [0, 1.4, 0.1]], 0.12, 0.09, 0x2f7a35)
      .ball(leaf, { at: [0.18, 0.62, 0.03], rot: [0, 0, 0.5], size: [0.2, 0.025, 0.09] })
      .ball(leaf, { at: [-0.17, 0.9, 0.05], rot: [0, Math.PI, 0.45], size: [0.18, 0.025, 0.08] })
      .build(stem);
    const head = group(stem, 0, 1.5, 0.1);
    const plum = (q) => hash(Math.floor(q.x * 14), Math.floor(q.y * 14), Math.floor(q.z * 14)) < 0.12 ? 0xd070c0 : 0x8a3a8a;
    const teeth = (p, sy) => { for (let i = 0; i < 9; i++) { const a = (i / 8 - 0.5) * 2.6; p.cone(0xfff6dc, { at: [Math.sin(a) * 0.44, sy * 0.02, 0.2 + Math.cos(a) * 0.48], rot: [sy > 0 ? 0 : Math.PI, 0, 0], size: [0.035, 0.1, 0.035], sides: 6 }); } };
    const lower = group(head, 0, 0, -0.2), upper = group(head, 0, 0, -0.2);
    const lo = part().bowl(plum, { at: [0, 0, 0.2], size: [0.5, 0.3, 0.55] }).ball(0xff5a6a, { at: [0, 0.01, 0.2], size: [0.43, 0.05, 0.47] });
    teeth(lo, 1); lo.build(lower);
    const up = part().dome(plum, { at: [0, 0, 0.2], size: [0.5, 0.36, 0.55] }).ball(0xe84a60, { at: [0, -0.01, 0.2], size: [0.43, 0.04, 0.47] })
      .limb([-0.13, 0.28, 0.1], [-0.15, 0.46, 0.12], 0.035, 0.03, 0x5a9a42).limb([0.13, 0.28, 0.1], [0.15, 0.46, 0.12], 0.035, 0.03, 0x5a9a42);
    teeth(up, -1); up.build(upper);
    const eyeG = eyes(upper, { y: 0.5, z: 0.13, gap: 0.15, rx: 0.07, ry: 0.08, rz: 0.065, iris: 0xd8c020, yaw: 0.25 });
    const dazed = dazedStars(stem, 2.2, 0.4);
    const c = rig(g, stem);
    addBlink(c, eyeG);
    c.tick = (t, dt) => {
      const bend = clamp(-stem.rotation.x / 0.75, 0, 1);          // the level bends the stem back before a bite
      const chomp = 0.12 + 0.1 * Math.sin(t * 2.2 + c.seed);
      const open = stem.rotation.x > 0.6 ? 0.05 : Math.max(chomp, bend * 0.8);
      upper.rotation.x += (-open - upper.rotation.x) * Math.min(1, dt * 12);
      lower.rotation.x += (open * 0.35 - lower.rotation.x) * Math.min(1, dt * 12);
      leaves.rotation.x = -stem.rotation.x;
      if (dazed.visible) { dazed.rotation.set(-stem.rotation.x, dazed.rotation.y + dt * 5, 0, "XYZ"); }
    };
    return { g, stem, head, dazed };
  }

  return {
    update, drive, part, eyes,
    brother, mushroomWalker, wingedTurtle, basaltBeetle, mineMonkey, youngVillain, inkSquid, bigApe, dinosaur, mushroomFriend, swampSnapper,
    get count() { return live.length; },
    rigs: () => live            // QA: the animation state of every character
  };
})();
