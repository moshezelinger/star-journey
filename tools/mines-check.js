"use strict";
// Route regression for Basalt Mines, star 2 (issues #13, #14, #17). Drives the game through
// window.__dbg.step, so it checks game logic, not feel.
//   node tools/mines-check.js            -> checks only
//   node tools/mines-check.js --shots    -> also writes tools/out/mines-*.png
const H = require("./harness");

(async () => {
  const shots = process.argv.includes("--shots");
  const h = await H.open();
  const { page } = h;
  const c = H.checker("mines");
  const ev = (fn, arg) => page.evaluate(fn, arg);
  const frame = () => page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
  const shot = async (name) => { if (shots) { await frame(); await h.shot("mines-" + name); } };

  // start on star 2
  let r = await ev(() => {
    const d = window.__dbg; d.goTo(1); d.step(20);
    return { planet: d.active.name, hasPower: d.P.hasPower, h: d.P.pos.distanceTo(d.active.center) - d.active.radius };
  });
  c.ok("lands on Basalt Mines without the power punch", r.planet === "Basalt Mines" && r.hasPower === false && Math.abs(r.h) < 0.1, r);

  // ---------- power glove and cracked rock ----------
  r = await ev(() => {
    const d = window.__dbg, bm = d.BasaltMines.debug;
    d.BasaltMines.reset(); d.place(16.6, -3.6, 0.05); d.step(20);
    d.punch(); d.step(40);
    const quick = bm.breakables.find(b => b.kind === "boulder" && b.l < -3).gone;
    d.powerPunch(); d.step(40);                       // no glove yet: a long press is just a punch
    const noGlove = bm.breakables.find(b => b.kind === "boulder" && b.l < -3).gone;
    return { quick, noGlove };
  });
  c.ok("quick punch and no glove: cracked boulder stays", !r.quick && !r.noGlove, r);

  r = await ev(() => {
    const d = window.__dbg;
    d.place(8, 0, 0.05); d.keys.KeyW = true; d.step(40); d.keys.KeyW = false;
    return d.P.hasPower;
  });
  c.ok("walking over the shrine gives the power punch", r === true);

  r = await ev(() => {
    const d = window.__dbg, bm = d.BasaltMines.debug;
    d.place(16.6, -3.6, 0.05); d.step(20); d.powerPunch(); d.step(40);
    const a = bm.breakables.find(b => b.kind === "boulder" && b.l < -3).gone;
    const before = bm.coins;
    d.place(20.6, 3.8, 0.05); d.step(20); d.powerPunch(); d.step(40);
    const gold = bm.breakables.find(b => b.kind === "boulder" && b.l > 3).gone;
    d.place(23, 3.8, 0.05); d.step(5);
    for (let k = 0; k < 5; k++) { const a2 = k * 1.26; d.place(23 + Math.cos(a2) * 1.6, 3.8 + Math.sin(a2) * 1.6, 0.05); d.step(4); }
    return { a, gold, coins: bm.coins - before };
  });
  c.ok("power punch breaks a cracked boulder", r.a, r);
  c.ok("the gold-vein boulder drops 5 coins", r.gold && r.coins === 5, r);

  // the spur wall blocks the way until a power punch
  r = await ev(() => {
    const d = window.__dbg, bm = d.BasaltMines.debug;
    d.place(29.6, 0, 0.05); d.keys.KeyW = true; d.step(90); d.keys.KeyW = false;
    const blocked = bm.coordsOf(d.P.pos).s;
    d.place(30.6, 0, 0.05); d.step(10); d.powerPunch(); d.step(40);
    d.place(29.6, 0, 0.05); d.keys.KeyW = true; d.step(90); d.keys.KeyW = false;
    return { blocked, after: bm.coordsOf(d.P.pos).s };
  });
  c.ok("cracked wall in the spur blocks the way", r.blocked < 32, r);
  c.ok("power punch opens the spur", r.after > 34, r);

  // steep flanks cannot be walked up
  r = await ev(() => {
    const d = window.__dbg, bm = d.BasaltMines.debug;
    d.place(37, 0, 0.05); d.keys.KeyD = true; d.step(240); d.keys.KeyD = false;
    const spurSide = { s: bm.coordsOf(d.P.pos).s, l: bm.coordsOf(d.P.pos).l, h: d.P.pos.distanceTo(d.active.center) - d.active.radius };
    d.place(70, 0, bm.floorH(70) + 0.05); d.keys.KeyD = true; d.step(180); d.keys.KeyD = false; d.step(60);
    const cc = bm.coordsOf(d.P.pos);
    return { spurSide, mineL: cc.l, mineH: d.P.pos.distanceTo(d.active.center) - d.active.radius - bm.floorH(cc.s) };
  });
  c.ok("the mine walls cannot be climbed", r.mineL < 5.3 && r.mineH < 1, r);

  // ---------- basalt beetle ----------
  r = await ev(() => {
    const d = window.__dbg, bm = d.BasaltMines.debug;
    d.BasaltMines.reset(); d.P.hasPower = true; d.health = 3; d.setInvuln(0);
    const e = bm.beetle; e.s = 43.6; e.l = 0; e.state = "recover"; e.t = -99;
    d.place(41.4, 0, 0.05); d.step(5);
    d.punch(); d.step(30);
    const quick = e.dead;
    e.s = 43.6; e.state = "recover"; e.t = -99; d.place(41.4, 0, 0.05); d.step(5);
    d.powerPunch(); d.step(30);
    const powerFront = e.dead;
    e.s = 43.6; e.l = 0; e.state = "stuck"; e.t = 0; d.place(41.4, 0, 0.05); d.step(5);
    d.powerPunch(); d.step(30);
    return { quick, powerFront, stuck: e.dead };
  });
  c.ok("punches on the beetle's armour do not defeat it", !r.quick && !r.powerFront, r);
  c.ok("power punch defeats the stuck beetle", r.stuck, r);

  r = await ev(() => {
    const d = window.__dbg, bm = d.BasaltMines.debug;
    d.BasaltMines.reset(); d.health = 3; d.setInvuln(0);
    d.place(38.5, 0, 0.05); let seen = false;
    for (let i = 0; i < 300; i++) { d.step(1); if (bm.beetle.state === "charge") { seen = true; break; } }
    d.step(120);
    const still = { health: d.health };
    d.BasaltMines.reset(); d.health = 3; d.setInvuln(0);
    d.place(38.5, 0, 0.05);
    for (let i = 0; i < 300 && bm.beetle.state !== "charge"; i++) d.step(1);
    d.keys.KeyD = true; d.step(45); d.keys.KeyD = false;
    let stuck = false; for (let i = 0; i < 120; i++) { d.step(1); if (bm.beetle.state === "stuck") stuck = true; }
    return { seen, stillHealth: still.health, dodgeHealth: d.health, stuck };
  });
  c.ok("standing in the beetle's path costs a heart", r.seen && r.stillHealth === 2, r);
  c.ok("sidestepping makes it miss and get stuck", r.dodgeHealth === 3 && r.stuck, r);

  // ---------- monkeys and rolling stones ----------
  r = await ev(() => {
    const d = window.__dbg, bm = d.BasaltMines.debug;
    d.BasaltMines.reset(); d.health = 3; d.setInvuln(0);
    d.place(70, 0, bm.floorH(70) + 0.05); d.step(1);
    let maxStones = 0; for (let i = 0; i < 60 * 5; i++) { d.step(1); maxStones = Math.max(maxStones, bm.stones.length); if (d.health < 3) break; }
    const track = d.health;
    d.BasaltMines.reset(); d.health = 3; d.setInvuln(0);
    d.place(75, -6.8, bm.floorH(75) + 0.05); d.step(1);
    let passed = 0;
    for (let i = 0; i < 60 * 7; i++) { d.step(1); passed = Math.max(passed, bm.stones.filter(s => s.s < 74).length); }
    return { maxStones, track, alcove: d.health, passed };
  });
  c.ok("stones on the track hurt", r.maxStones > 0 && r.track < 3, r);
  c.ok("an alcove keeps the hero safe while stones pass", r.alcove === 3 && r.passed > 0, r);

  r = await ev(() => {
    const d = window.__dbg, bm = d.BasaltMines.debug;
    d.BasaltMines.reset(); d.place(80, 0, bm.floorH(80) + 0.05); d.step(30);
    return bm.state.monkeys[0].fled;
  });
  c.ok("the monkey runs off when the hero reaches its beam", r === true);

  // ---------- the junction: block, switch, cart ----------
  r = await ev(() => {
    const d = window.__dbg, bm = d.BasaltMines.debug;
    d.BasaltMines.reset(); d.P.hasPower = true; d.health = 3; d.setInvuln(0);
    bm.luigiReady(); bm.setSwitch(false);
    d.place(109.9, 0, 9.05, true); d.step(10); d.powerPunch(); d.step(24);
    const blockGone = bm.breakables.find(b => b.kind === "block").gone;
    d.place(104, 7, 9.05); d.step(1);
    const states = new Set();
    for (let i = 0; i < 60 * 9; i++) { d.step(1); states.add(bm.cart.state); }
    return { blockGone, states: [...states], final: bm.cart.state, blockBack: !bm.breakables.find(b => b.kind === "block").gone, rescued: bm.rescued };
  });
  c.ok("power punch on the block frees the cart", r.blockGone, r);
  c.ok("wrong switch: the cart crashes in the dead end and comes back", r.states.includes("crashed") && r.final === "parked" && r.blockBack && !r.rescued, r);

  r = await ev(() => {
    const d = window.__dbg, bm = d.BasaltMines.debug, L = bm.layout;
    d.place(110, -1, 9.05); d.step(20);
    d.place(L.luigi.s - 0.8, L.luigi.l + 0.6, 9.05); d.step(20);
    const first = bm.switchStraight;
    d.place(110, 2, 9.05); d.step(20);
    return { first };
  });
  c.ok("walking up to Luigi throws the switch", r.first === true, r);

  // DK's beam: a punch warns, it never breaks
  r = await ev(() => {
    const d = window.__dbg, bm = d.BasaltMines.debug;
    d.health = 3; d.setInvuln(0);
    d.place(128.6, 0, bm.floorH(128.6) + 0.05); d.step(10); d.powerPunch(); d.step(30);
    return { warns: bm.beamWarns, rescued: bm.rescued, health: d.health };
  });
  c.ok("punching DK's beam shakes the roof and warns, nothing breaks", r.warns >= 1 && !r.rescued && r.health === 3, r);

  r = await ev(() => {
    const d = window.__dbg, bm = d.BasaltMines.debug;
    d.health = 3; d.setInvuln(0);
    d.place(109.9, 0, 9.05, true); d.step(10); d.powerPunch(); d.step(24);
    d.place(104, 7, 9.05); d.step(1);
    let arrived = false;
    for (let i = 0; i < 60 * 12; i++) { d.step(1); if (bm.rescued) { arrived = true; break; } }
    const shot = d.BasaltMines.cameraShot(d.P);
    d.step(100);
    return { arrived, count: bm.rescueCount, shot: shot && shot.kind };
  });
  await shot("rescue");
  r = Object.assign(r, await ev(() => {
    const d = window.__dbg, bm = d.BasaltMines.debug;
    for (let i = 0; i < 60 * 7; i++) d.step(1);
    return { rubbleGone: bm.state.rubbleMesh.visible === false, dk: bm.state.dk.state };
  }));
  c.ok("right switch: the cart reaches DK and the rescue starts", r.arrived && r.count === 1, r);
  c.ok("rescue uses the chamber framing", r.shot === "rescue", r);
  c.ok("DK clears the rubble and walks out", r.rubbleGone && (r.dk === "walk" || r.dk === "waiting"), r);

  r = await ev(() => {
    const d = window.__dbg, bm = d.BasaltMines.debug;
    d.place(140, 0, bm.floorH(140) + 0.05); d.keys.KeyW = true; d.step(60 * 3); d.keys.KeyW = false;
    const passed = bm.coordsOf(d.P.pos).s;
    d.place(154, 0, bm.terrainH(154, 0) + 0.05);
    const seen = new Set();
    for (let i = 0; i < 60 * 6; i++) { d.step(1); seen.add(bm.jr); }
    return { passed, jr: [...seen], gate: bm.gateOpen, count: bm.rescueCount };
  });
  c.ok("the exit tunnel is open after the rescue", r.passed > 145, r);
  c.ok("the young villain appears, throws paint and flies off", r.jr.includes("aim") && r.jr.includes("throw") && r.jr.includes("leave"), r);
  c.ok("the gate opens after the villain leaves", r.gate === true && r.count === 1, r);
  await shot("gate");

  // ---------- camera in the mine ----------
  const spots = [[66, 0], [75, -6.5], [90, 0], [104, 0], [112, -4], [129, 0], [53, -14], [45, 0]];
  const camFails = [];
  for (const [s, l] of spots) for (const [pitch, zoom] of [[0.1, 16], [0.1, 4.5], [1.15, 16], [0.38, 9.15]]) {
    const q = await ev(([s, l, pitch, zoom]) => {
      const d = window.__dbg, bm = d.BasaltMines.debug;
      d.place(s, l, bm.terrainH(s, l) + 0.05); d.setCam(pitch, zoom);
      d.step(90);
      const cam = d.cam, f = d.camFloor;
      return { cam, f, above: f.h - f.floor, ok: f.h - f.floor > 0.15 && cam.dist <= zoom + 1.3 + 0.05 };
    }, [s, l, pitch, zoom]);
    if (!q.ok) camFails.push({ s, l, pitch, zoom, above: +q.above.toFixed(2), dist: +q.cam.dist.toFixed(2) });
  }
  await ev(() => window.__dbg.setCam(0.38, 9.15));
  c.ok("camera stays above the ground and within zoom in the mine (32 spots)", camFails.length === 0, camFails);

  r = await ev(() => {
    const d = window.__dbg, bm = d.BasaltMines.debug, L = bm.layout;
    d.place(L.gate.s - 3, 0, 0.05); d.keys.KeyW = true;
    for (let i = 0; i < 300 && d.state === "PLAYING"; i++) d.step(1);
    d.keys.KeyW = false;
    return d.state;
  });
  c.ok("the gate launches to the next planet", r === "PLANET_TRANSITION", r);

  c.ok("no page errors", h.errors.length === 0, h.errors);
  const failed = c.report();
  await h.close();
  process.exit(failed ? 1 : 0);
})();
