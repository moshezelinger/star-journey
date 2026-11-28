"use strict";
// Route regression for the Furnace Moon, star 4 (issue #21). Drives the game through window.__dbg.step.
//   node tools/furnace-check.js            -> checks only
//   node tools/furnace-check.js --shots    -> also writes tools/out/furnace-*.png
const H = require("./harness");

(async () => {
  const shots = process.argv.includes("--shots");
  const h = await H.open();
  const { page } = h;
  const c = H.checker("furnace");
  const ev = (fn, arg) => page.evaluate(fn, arg);
  const shot = async (name) => { if (!shots) return; await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))); await h.shot("furnace-" + name); };

  // every checkpoint of every star is clear of solids
  let r = await ev(() => {
    const d = window.__dbg, out = [];
    for (const [name, L] of [["wind", d.WindGardens], ["mines", d.BasaltMines], ["swamp", d.InkSwamp], ["furnace", d.FurnaceMoon]]) {
      const dbg = L.debug;
      for (const cp of dbg.layout.checkpoints) {
        const hh = (dbg.terrainH ? dbg.terrainH(cp.s, cp.l) : 0) + 0.05;
        const q = dbg.query(dbg.worldPos(cp.s, cp.l, hh), hh);
        if (q.blocked || q.void) out.push(name + ":" + cp.name);
      }
    }
    return out;
  });
  c.ok("no checkpoint in any star is inside a solid", r.length === 0, r);

  r = await ev(() => { const d = window.__dbg; window.goToStar(3); d.step(30); const f = d.FurnaceMoon.debug; return { planet: d.active.name, power: d.P.hasPower, painted: d.painted, cp: f.checkpoint, hud: document.getElementById("shards").textContent }; });
  c.ok("goToStar(3) lands on the Furnace Moon with the power punch, not painted", r.planet === "Furnace Moon" && r.power && !r.painted && r.cp === "landing", r);
  await shot("landing");
  r = await ev(() => { const d = window.__dbg; return { want: d.Audio.want, el: !!d.Audio.tracks.volcanic.el, src: d.Audio.tracks.volcanic.src }; });
  c.ok("the volcanic song is asked for from the landing", r.want === "volcanic" && r.el && /the-volcanic-path\.mp3$/.test(r.src), r);

  // the side slope: he rolls a paint ball across the path, and it hurts
  r = await ev(() => {
    const d = window.__dbg, f = d.FurnaceMoon.debug;
    d.health = 3; d.setInvuln(0);
    d.place(9, 0, f.terrainH(9, 0) + 0.1); d.step(5);
    let ball = null, hp0 = d.health;
    for (let i = 0; i < 60 * 8; i++) {
      const b = f.balls[0];
      if (b && !ball) ball = { s: b.s, l: b.l };
      if (b) d.place(b.s, 0, f.terrainH(b.s, 0) + 0.05);   // stand on its lane
      d.step(1);
      if (d.health < hp0) break;
    }
    return { ball, hurt: d.health < hp0 };
  });
  c.ok("the young villain rolls paint balls down the side slope, and they hurt", !!r.ball && r.ball.l < -10 && r.hurt, r);

  // a fake bridge melts; the real one holds
  r = await ev(() => {
    const d = window.__dbg, f = d.FurnaceMoon.debug, L = f.layout;
    d.health = 3; d.setInvuln(0);
    d.place(18.5, 0, 0.5); d.step(4);                               // the hero passes the slope: he flies to his pillar
    const fakeI = L.bridges.findIndex((b, i) => i !== L.realBridge);
    const fb = L.bridges[fakeI];
    d.place(23, fb.l, 0.6); d.step(30);
    const fell = { gone: f.fake[fakeI].gone, cp: f.checkpoint, s: f.coordsOf(d.P.pos).s };
    const rb = L.bridges[L.realBridge];
    d.place(17, rb.l, 0.5); d.keys.KeyW = true;
    let maxS = 0;
    for (let i = 0; i < 60 * 5; i++) { d.step(1); const c = f.coordsOf(d.P.pos); maxS = Math.max(maxS, c.s); if (c.s > 45) break; }
    d.keys.KeyW = false;
    return { fell, maxS, jr: f.jr.phase, cp: f.checkpoint, wrong: f.state.wrongBridges };
  });
  c.ok("a painted bridge melts under the hero and he lands back on the shore", r.fell.gone && r.fell.s < 18, r);
  c.ok("the real bridge carries him over the lava", r.maxS > 44 && r.cp === "shore", r);
  await shot("bridges");

  // coins on the shore, then the shrine sells the deflect punch
  r = await ev(() => {
    const d = window.__dbg, f = d.FurnaceMoon.debug, L = f.layout;
    d.place(L.shrine.s, L.shrine.l - 2.5, 0.3); d.step(20);
    const before = f.hasDeflect;
    for (const cc of L.shoreCoins) { d.place(cc[0], cc[1], f.terrainH(cc[0], cc[1]) + 0.1); d.step(6); }
    d.place(L.shrine.s, L.shrine.l - 1.6, 0.3); d.step(20);
    return { before, coins: f.coins, deflect: f.hasDeflect };
  });
  c.ok("the shrine wants 8 coins, and sells the deflect punch for them", !r.before && r.coins === 8 && r.deflect, r);

  // fight 1: a ball that is not sent back hurts; a punch sends it back and blinds him; three hits
  r = await ev(() => {
    const d = window.__dbg, f = d.FurnaceMoon.debug, L = f.layout;
    d.health = 3; d.setInvuln(0);
    const spot = [63, 0];
    const stand = () => { d.place(spot[0], spot[1], f.terrainH(spot[0], spot[1]) + 0.05); };
    stand(); d.step(30);
    // let one ball through
    let hp0 = d.health, hurt = false;
    for (let i = 0; i < 60 * 8 && !hurt; i++) { const b = f.balls[0]; if (b) { d.place(spot[0], b.l, f.terrainH(spot[0], b.l) + 0.05); } d.step(1); hurt = d.health < hp0; }
    const log = [];
    for (let round = 0; round < 3; round++) {
      d.health = 3; d.setInvuln(2); stand(); d.step(60);
      let deflected = false, blind = false;
      for (let i = 0; i < 60 * 10 && !blind; i++) {
        const b = f.balls.find(x => !x.back);
        if (b && !deflected) {
          d.place(spot[0], b.l, f.terrainH(spot[0], b.l) + 0.05);
          const cpos = f.worldPos(spot[0], b.l, 0), bpos = f.worldPos(b.s, b.l, 0);
          if (b.s - spot[0] < 2.4) { d.P.face.copy(bpos.sub(cpos)).normalize(); d.camDir.copy(d.P.face); d.punch(); deflected = true; }
        }
        d.step(1);
        blind = f.jr.state === "blind";
      }
      d.step(40);
      const j = f.jr;
      d.place(j.s - 1.6, j.l, f.terrainH(j.s - 1.6, j.l) + 0.05); d.step(3);
      const a = f.worldPos(j.s - 1.6, j.l, 0), t = f.worldPos(j.s, j.l, 0);
      d.P.face.copy(t.sub(a)).normalize(); d.camDir.copy(d.P.face); d.punch(); d.step(20);
      log.push({ deflected, blind, hp: f.jr.hp, want: d.Audio.want });
      d.step(90);
    }
    d.step(200);
    return { hurt, log, phase: f.jr.phase, wall: f.wallGone };
  });
  c.ok("a paint ball he is not sent back hurts the hero", r.hurt, r);
  c.ok("punching the ball back blinds him, then a punch hits (3 times)", r.log.length === 3 && r.log.every(x => x.deflected && x.blind) && r.log[2].hp === 0, r.log);
  c.ok("the song keeps playing through all of fight 1", r.log.every(x => x.want === "volcanic"), r.log);
  c.ok("he flees and the paint wall is gone", (r.phase === "flee" || r.phase === "gone") && r.wall, r);

  // the villain arrives and locks the friends in cages
  r = await ev(() => {
    const d = window.__dbg, f = d.FurnaceMoon.debug;
    d.place(86, 0, 0.2);
    for (let i = 0; i < 60 * 10 && f.cages.some(x => x === "none"); i++) d.step(1);
    d.step(120);
    return { cages: f.cages, bowser: f.bowser.state };
  });
  c.ok("the villain lands and the four friends are caged", r.cages.every(x => x === "locked"), r);
  r = await ev(() => ({ want: window.__dbg.Audio.want }));
  c.ok("the song is gone once Bowser is in the crater", r.want === null, r);
  r = await ev(() => { const d = window.__dbg; d.Audio.setTrack(null); return 1; });
  await shot("cages");

  // a cage: a normal punch does nothing, his charge cracks it when the hero dodges, a power punch frees the friend
  async function freeCage(i) {
    return ev((i) => {
      const d = window.__dbg, f = d.FurnaceMoon.debug, L = f.layout, cg = L.cages[i];
      d.health = 3;
      const bw0 = f.bowser, toS = bw0.s - cg.s, toL = bw0.l - cg.l, n = Math.hypot(toS, toL) || 1;
      const ps = cg.s + toS / n * 2.6, pl = cg.l + toL / n * 2.6;
      // wait for an idle moment, then make the next attack a charge
      for (let k = 0; k < 600 && f.bowser.state !== "idle"; k++) { d.setInvuln(2); d.step(1); }
      f.setBowser("snort");
      let cracked = false;
      for (let k = 0; k < 60 * 6 && !cracked; k++) {
        d.setInvuln(2);
        if (f.bowser.state === "snort") d.place(ps, pl, f.terrainH(ps, pl) + 0.05);
        else if (f.bowser.state === "charge") d.place(ps - toL / n * 4, pl + toS / n * 4, 0.3);
        d.step(1);
        cracked = f.cages[i] === "cracked";
      }
      const ns = cg.s + toS / n * 2.2, nl = cg.l + toL / n * 2.2;
      d.place(ns, nl, f.terrainH(ns, nl) + 0.05); d.step(2);
      const a = f.worldPos(ns, nl, 0), t = f.worldPos(cg.s, cg.l, 0);
      d.P.face.copy(t.sub(a)).normalize(); d.camDir.copy(d.P.face);
      d.punch(); d.step(25);
      const afterNormal = f.cages[i];
      d.P.face.copy(f.worldPos(cg.s, cg.l, 0).sub(f.worldPos(ns, nl, 0))).normalize();
      d.powerPunch(); d.step(25);
      return { cracked, afterNormal, after: f.cages[i], who: cg.who, rage: f.bowser.rage };
    }, i);
  }
  const frees = [];
  for (const i of [0, 2, 3, 1]) frees.push(await freeCage(i));      // the brother, the mushroom friend, the dinosaur, then the big ape
  c.ok("his charge cracks the cage the hero stood in front of (4 cages)", frees.every(x => x.cracked), frees);
  c.ok("a normal punch does not open a cracked cage, a power punch does", frees.every(x => x.afterNormal === "cracked" && x.after === "open"), frees);
  c.ok("he gets angrier after each friend", frees.map(x => x.rage).join(",") === "1,2,3,4", frees.map(x => x.rage));

  // what the friends do: light, find, pull the fire mushroom; lift the slabs
  r = await ev(() => {
    const d = window.__dbg, f = d.FurnaceMoon.debug;
    d.place(88, -20, 0.2);
    for (let i = 0; i < 60 * 15 && !(f.delivered && f.slabsUp === 3); i++) { d.setInvuln(2); d.step(1); }
    return { lit: f.lit, marked: f.marked, delivered: f.delivered, slabs: f.slabsUp, final: f.final };
  });
  c.ok("the brother lights the crater, the mushroom friend marks the fire mushroom, the dinosaur pulls it over the lava", r.lit && r.marked && r.delivered, r);
  c.ok("the big ape lifts the three slabs", r.slabs === 3, r);
  c.ok("the last round starts once all four are free", r.final, r);
  await shot("friends");

  // nine coins under the slabs unlock the dash
  r = await ev(() => {
    const d = window.__dbg, f = d.FurnaceMoon.debug, L = f.layout;
    const before = f.hasDash;
    for (const sl of L.slabs) for (const ds of [-0.9, 0, 0.9]) for (const dl of [-0.4, 0.6]) { d.setInvuln(2); d.place(sl.s + ds, sl.l + dl, 0.3); d.step(4); }
    return { before, dash: f.hasDash, slabCoins: f.state.slabCoins };
  });
  c.ok("nine coins from under the slabs unlock the dash", !r.before && r.dash && r.slabCoins === 9, r);

  // the dash: a third press of jump in the air carries the hero much farther
  async function jumpRun(presses) {
    return ev((presses) => {
      const d = window.__dbg, f = d.FurnaceMoon.debug;
      d.place(60, 0, f.terrainH(60, 0) + 0.05); d.step(20);
      const a = f.coordsOf(d.P.pos).s;
      d.keys.KeyW = true;
      d.jump(); d.step(14);
      if (presses > 1) { d.jump(); d.step(14); }
      if (presses > 2) { d.jump(); d.step(2); }
      for (let i = 0; i < 120 && !d.P.grounded; i++) d.step(1);
      d.keys.KeyW = false;
      return f.coordsOf(d.P.pos).s - a;
    }, presses);
  }
  const plain = await jumpRun(2), dashed = await jumpRun(3);
  c.ok("the dash carries the hero farther than a double jump", dashed > plain + 3, { plain, dashed });

  // the ring of fire hurts without the mushroom; the mushroom guards from it
  r = await ev(() => {
    const d = window.__dbg, f = d.FurnaceMoon.debug, L = f.layout, A = L.arena;
    d.health = 3; d.setInvuln(0);
    const rs = A.s - L.fireRing;
    d.place(rs, 0, 0.2); d.step(6);
    const hurtRing = d.health < 3;
    d.health = 3; d.setInvuln(0);
    d.place(L.bank.s, L.bank.l, f.terrainH(L.bank.s, L.bank.l) + 0.1); d.step(10);
    const shield = f.shield;
    d.place(rs, 0, 0.2); d.step(30);
    return { hurtRing, shield, hurtWithShield: d.health < 3 };
  });
  c.ok("the ring of fire hurts without the fire mushroom", r.hurtRing, r);
  c.ok("the fire mushroom guards the hero from the ring", r.shield > 10 && !r.hurtWithShield, r);

  // the shockwave: it hurts on the ground and a jump clears it
  r = await ev(() => {
    const d = window.__dbg, f = d.FurnaceMoon.debug, A = f.layout.arena;
    const waveRun = (jump) => {
      d.health = 3; d.setInvuln(0);
      for (let i = 0; i < 600 && !(f.bowser.state === "idle"); i++) { d.setInvuln(1); d.step(1); }
      f.setBowser("crouch");
      const ps = A.s - 10;
      let jumped = false;
      for (let i = 0; i < 60 * 4; i++) {
        f.state.shieldT = 0;
        if (!jumped) d.place(ps, 0, f.terrainH(ps, 0) + 0.05);
        const w = f.wave;
        if (jump && w && !jumped && 10 - w.r < 2.6) { d.jump(); jumped = true; }
        d.step(1);
        if (d.health < 3) break;
        if (f.bowser.state === "recover" && !f.wave) break;
      }
      return { hurt: d.health < 3, bs: +f.bowser.s.toFixed(1), bl: +f.bowser.l.toFixed(1), st: f.bowser.state, inv: +d.P.invuln.toFixed(2) };
    };
    f.state.shieldT = 0;
    const hurtGround = waveRun(false);
    const hurtJump = waveRun(true);
    return { hurtGround, hurtJump };
  });
  c.ok("the shockwave hurts on the ground, a jump clears it", r.hurtGround.hurt && !r.hurtJump.hurt, r);

  // the last blow: walking into him does nothing, a dash while he pants after the slam beats him
  r = await ev(() => {
    const d = window.__dbg, f = d.FurnaceMoon.debug, A = f.layout.arena;
    const tryHit = (dash) => {
      for (let i = 0; i < 600 && f.bowser.state !== "recover" && !f.beaten; i++) { d.setInvuln(2); f.state.shieldT = 15; d.place(A.s - 9, 0, 0.3); d.step(1); }
      d.setInvuln(2); f.state.shieldT = 15;
      d.place(A.s - 5, 0, 0.1); d.P.face.copy(f.worldPos(A.s, 0, 0).sub(f.worldPos(A.s - 5, 0, 0))).normalize(); d.camDir.copy(d.P.face); d.step(1);
      d.keys.KeyW = true;
      if (dash) { d.jump(); d.step(10); d.jump(); d.step(8); d.jump(); }
      for (let i = 0; i < 50 && !f.beaten; i++) d.step(1);
      d.keys.KeyW = false;
      return f.beaten;
    };
    const walk = tryHit(false);
    d.step(30);
    const dash = tryHit(true);
    return { walk, dash };
  });
  c.ok("walking into him does not beat him", r.walk === false, r);
  c.ok("a dash while he pants after the slam beats him", r.dash === true, r);
  await shot("beaten");

  // the ending: his son hangs on the edge, the hero reaches out, the road home, the victory screen
  r = await ev(() => {
    const d = window.__dbg, f = d.FurnaceMoon.debug, E = f.layout.edge;
    for (let i = 0; i < 60 * 5 && !f.hanging; i++) d.step(1);
    const hanging = f.hanging;
    d.place(E.s - 2, 0, f.terrainH(E.s - 2, 0) + 0.05); d.step(3);
    d.P.face.copy(f.worldPos(E.s, 0, 0).sub(f.worldPos(E.s - 2, 0, 0))).normalize(); d.camDir.copy(d.P.face);
    d.punch(); d.step(25);
    const saved = f.saved;
    for (let i = 0; i < 60 * 8 && d.state === "PLAYING"; i++) d.step(1);
    return { hanging, saved, won: f.won, state: d.state, splits: f.splits.map(x => x.name) };
  });
  c.ok("Bowser Jr. hangs on the edge after the fight", r.hanging, r);
  c.ok("the hero reaches out to him", r.saved, r);
  c.ok("the road home ends the journey (victory)", r.won && r.state === "VICTORY", r);
  await page.waitForTimeout(1800);
  await shot("victory");
  r = await ev(() => !document.getElementById("victory").classList.contains("hidden"));
  c.ok("the victory screen shows", r === true);

  // camera above the ground and within zoom at a few spots
  await ev(() => { window.goToStar(3); window.__dbg.step(300); });
  const camFails = [];
  for (const [s, l] of [[8, 0], [20, -9], [30, -9], [50, 0], [66, 0], [76, -3], [95, -6], [116, -10], [124, 0]]) for (const [pitch, zoom] of [[0.1, 16], [1.15, 16], [0.38, 9.15]]) {
    const q = await ev(([s, l, pitch, zoom]) => { const d = window.__dbg, f = d.FurnaceMoon.debug; d.place(s, l, Math.max(0.5, f.floorAt(s, l, 2) + 0.2)); d.setCam(pitch, zoom); d.step(60); const fl = d.camFloor; return { above: fl.h - fl.floor, dist: d.cam.dist }; }, [s, l, pitch, zoom]);
    if (!(q.above > 0.15 && q.dist <= zoom + 1.35)) camFails.push({ s, l, pitch, zoom, q });
  }
  await ev(() => window.__dbg.setCam(0.38, 9.15));
  c.ok("camera stays above the ground and within zoom (27 spots)", camFails.length === 0, camFails);

  // a decorative rock near the walkable belt blocks the hero (issue #20: walking through trees)
  r = await ev(([idx, name, getter]) => {
    const d = window.__dbg, dbg = d[name].debug;
    d.goTo(idx); d.step(5);
    const list = dbg[getter]().filter(t => Math.abs(t.cl ) < dbg.layout.edgeL - 2 && t.r > 0.5 && t.top - dbg.terrainH(t.cs, t.cl) > 1.2).sort((a, b) => b.r - a.r);
    const t = list[0];
    if (!t) return { none: true };
    const ts = t.cs , tl = t.cl ;
    const start = ts - t.r - 2.5;
    d.place(start, tl, Math.max(0.3, dbg.terrainH(start, tl) + 0.3)); d.step(20);
    d.keys.KeyW = true; d.step(90); d.keys.KeyW = false;
    const c = dbg.coordsOf(d.P.pos);
    return { count: list.length, r: +t.r.toFixed(2), gap: +(Math.hypot(c.s - ts, c.l - tl) - t.r).toFixed(2), passed: c.s > ts + t.r };
  }, [3, "FurnaceMoon", "rockColliders"]);
  c.ok("a big rock blocks the way", !r.none && r.gap > -0.15 && !r.passed, r);
  c.ok("no page errors", h.errors.length === 0, h.errors);
  const failed = c.report();
  await h.close();
  process.exit(failed ? 1 : 0);
})();
