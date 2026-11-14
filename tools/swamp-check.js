"use strict";
// Route regression for the Ink Swamp, star 3 (issue #20). Drives the game through window.__dbg.step.
//   node tools/swamp-check.js            -> checks only
//   node tools/swamp-check.js --shots    -> also writes tools/out/swamp-*.png
const H = require("./harness");

(async () => {
  const shots = process.argv.includes("--shots");
  const h = await H.open();
  const { page } = h;
  const c = H.checker("swamp");
  const ev = (fn, arg) => page.evaluate(fn, arg);
  const shot = async (name) => { if (!shots) return; await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))); await h.shot("swamp-" + name); };

  // every checkpoint of every star is clear of solids (a respawn must never land inside a trunk)
  let r = await ev(() => {
    const d = window.__dbg, out = [];
    for (const [name, L] of [["wind", d.WindGardens], ["mines", d.BasaltMines], ["swamp", d.InkSwamp]]) {
      const dbg = L.debug;
      for (const cp of dbg.layout.checkpoints) {
        const h = (dbg.terrainH ? dbg.terrainH(cp.s, cp.l) : 0) + 0.05;
        const q = dbg.query(dbg.worldPos(cp.s, cp.l, h), h);
        if (q.blocked || q.void) out.push(name + ":" + cp.name);
      }
    }
    return out;
  });
  c.ok("no checkpoint in any star is inside a solid", r.length === 0, r);

  // a hero who ends up inside a solid can walk out of it
  r = await ev(() => {
    const d = window.__dbg, sw = d.InkSwamp.debug, L = sw.layout;
    d.goTo(2); d.step(5);
    d.place(L.hutS + 1.2, 0.6, 0.2); d.step(5);
    d.keys.KeyS = true; d.step(90); d.keys.KeyS = false;
    const c = sw.coordsOf(d.P.pos);
    return { s: c.s, out: Math.hypot(c.s - (L.hutS + 1.2), c.l) > 2.6 };
  });
  c.ok("walking out of a trunk the hero ended up in", r.out, r);

  // the quick jump between the stars (menu row, tuning panel, Shift+1..4)
  r = await ev(() => { const out = []; for (const i of [3, 0, 1, 2]) { window.goToStar(i); out.push({ i, planet: window.__dbg.active.name, state: window.__dbg.state, painted: window.__dbg.painted, power: window.__dbg.P.hasPower }); } return out; });
  c.ok("goToStar lands on each star in the right state", r.every((x, k) => x.state === "PLAYING") && r[0].planet.startsWith("Bowser") && r[2].planet === "Basalt Mines" && r[3].planet === "Ink Swamp" && r[3].painted && r[3].power, r);

  r = await ev(() => {
    const d = window.__dbg; d.goTo(2); d.step(30);
    const sw = d.InkSwamp.debug;
    return { planet: d.active.name, mounted: sw.mounted, heroHidden: !d.P || true };
  });
  c.ok("lands on the Ink Swamp as Luigi on foot", r.planet === "Ink Swamp" && r.mounted === false, r);

  r = await ev(() => {
    const d = window.__dbg, sw = d.InkSwamp.debug;
    sw.skipIntro(); d.place(5.5, -3, 0.2); d.keys.KeyW = true; d.step(40); d.keys.KeyW = false;
    return sw.mounted;
  });
  c.ok("walking up to Yoshi mounts him", r === true);

  // the tongue reaches a coin behind a hollow root
  r = await ev(() => {
    const d = window.__dbg, sw = d.InkSwamp.debug, L = sw.layout;
    const root = L.roots[1];                     // l +6, the coin sits at l 9.1
    const before = sw.coins;
    d.place(root.s, 3.2, 0.2); d.step(10);
    // face +l: turn the hero toward the coin, then stick out the tongue
    const a = sw.worldPos(root.s, 3.2, 0.2), b = sw.worldPos(root.s, 9.1, 0.2);
    d.P.face.copy(b.sub(a)).normalize(); d.camDir.copy(d.P.face);
    d.punch(); d.step(30);
    return { got: sw.coins - before };
  });
  c.ok("the tongue grabs a coin behind a root", r.got === 1, r);

  // the first paint pool: a single jump falls in, the flutter crosses
  async function poolRun(flutter) {
    return ev((flutter) => {
      const d = window.__dbg, sw = d.InkSwamp.debug, L = sw.layout;
      const p = L.pools[0];
      d.place(p.s0 - 4, 0, 0.2); d.step(20);
      d.keys.KeyW = true;
      let jumped = false, t = 0, fell = false, landed = null;
      for (let i = 0; i < 60 * 6; i++) {
        const cc = sw.coordsOf(d.P.pos);
        if (!jumped && cc.s > p.s0 - 0.6) { d.jump(); jumped = true; }
        if (jumped) t += 1 / 60;
        if (flutter && jumped && Math.abs(t - 0.45) < 0.01) { d.jump(); }
        d.setJumpHeld(flutter && jumped && t > 0.44);
        d.step(1);
        const hh = d.P.pos.distanceTo(d.active.center) - d.active.radius;
        if (hh < -2) fell = true;
        if (jumped && t > 0.3 && d.P.grounded && !landed) { landed = sw.coordsOf(d.P.pos).s; break; }
      }
      d.keys.KeyW = false; d.setJumpHeld(false);
      return { fell, landed };
    }, flutter);
  }
  r = await poolRun(false);
  c.ok("a single jump falls into the first paint pool", r.fell || (r.landed !== null && r.landed < 30), r);
  r = await poolRun(true);
  c.ok("jump and flutter cross the first paint pool", !r.fell && r.landed > 39, r);

  // the ink squid covers the stone ahead; the tongue catches it
  r = await ev(() => {
    const d = window.__dbg, sw = d.InkSwamp.debug, L = sw.layout;
    d.place(L.stones[0].s, L.stones[0].l, 0.4); d.step(1);
    let inked = false;
    for (let i = 0; i < 60 * 6; i++) { d.step(1); if (sw.inked.some(x => x > 0)) { inked = true; break; } }
    d.place(L.stones[0].s, L.stones[0].l, 0.4);
    for (let i = 0; i < 60 * 6 && sw.inked[1] > 0; i++) d.step(1);       // wait until the inked stone is back up
    d.place(L.stones[1].s, L.stones[1].l, 0.4); d.step(2);
    const a = sw.worldPos(L.stones[1].s, L.stones[1].l, 0.4), b = sw.worldPos(L.squid.s, L.squid.l, 0.4);
    d.P.face.copy(b.sub(a)).normalize();
    d.punch(); d.step(30);
    return { inked, squidDead: sw.squid.dead };
  });
  c.ok("the squid inks a stone ahead of the dinosaur", r.inked, r);
  c.ok("the tongue catches the squid", r.squidDead, r);

  // piranha plant: bend, bite; standing there hurts; once it missed, the tongue defeats it
  r = await ev(() => {
    const d = window.__dbg, sw = d.InkSwamp.debug, L = sw.layout, pp = L.piranhas[0];
    d.health = 3; d.setInvuln(0);
    d.place(pp.s - 2, pp.l, 0.2); d.step(1);
    for (let i = 0; i < 90; i++) d.step(1);
    const stay = d.health;
    d.health = 3; d.setInvuln(0);
    d.place(pp.s - 3.6, pp.l, 0.2);
    for (let i = 0; i < 200 && sw.piranha[0].state !== "bend"; i++) d.step(1);
    d.place(pp.s - 6.2, pp.l, 0.2);                       // step away while it bends
    for (let i = 0; i < 60 && sw.piranha[0].state !== "stuck"; i++) d.step(1);
    const dodged = d.health;
    const a = sw.worldPos(pp.s - 6.2, pp.l, 0.2), b = sw.worldPos(pp.s, pp.l, 0.2);
    d.P.face.copy(b.sub(a)).normalize(); d.punch(); d.step(20);
    return { stay, dodged, dead: sw.piranha[0].dead };
  });
  c.ok("standing by the piranha plant gets bitten", r.stay < 3, r);
  c.ok("stepping away during the bend avoids the bite", r.dodged === 3, r);
  c.ok("the tongue defeats the piranha plant while its head is stuck", r.dead, r);

  r = await ev(() => { const d = window.__dbg, sw = d.InkSwamp.debug; d.place(67, 0, 0.2); d.step(60 * 3); return sw.bridgeBroken; });
  c.ok("across the river the painted hero smashes the bridge", r === true);
  await shot("bridge");

  // the reflection puzzle
  r = await ev(() => {
    const d = window.__dbg, sw = d.InkSwamp.debug, L = sw.layout;
    const tongueAt = (l) => { d.place(92.6, l, 0.2); d.step(5); const a = sw.worldPos(92.6, l, 0.2), b = sw.worldPos(L.leverS, l, 0.2); d.P.face.copy(b.sub(a)).normalize(); d.punch(); d.step(30); };
    tongueAt(L.huts[0].l);
    const wrong = sw.huts[0], freeAfterWrong = sw.toadFree;
    tongueAt(L.huts[L.realHut].l);
    d.step(60 * 4);
    return { wrong, freeAfterWrong, real: sw.huts[L.realHut], toad: sw.toadFree };
  });
  c.ok("a wrong lever shows a painted fake", r.wrong === "fake" && !r.freeAfterWrong, r);
  c.ok("the reflected hut's lever frees the mushroom friend", r.real === "open" && r.toad, r);
  await shot("toad");

  // the ferry: it needs 10 coins from the swamp
  r = await ev(() => {
    const d = window.__dbg, sw = d.InkSwamp.debug, L = sw.layout, f = L.ferry;
    d.place(f.s0, 0, 0.45); d.step(60);
    const without = sw.ferry.state;
    sw.state.coins = Math.max(sw.state.coins, 10); d.P.coins = Math.max(d.P.coins, 10);
    d.place(f.s0 + 0.5, 0, 0.45); d.step(2);
    let maxS = 0;
    for (let i = 0; i < 60 * 9; i++) { d.step(1); maxS = Math.max(maxS, sw.coordsOf(d.P.pos).s); if (sw.ferry.state === "arrived") break; }
    return { without, state: sw.ferry.state, rider: maxS };
  });
  c.ok("without 10 coins the ferry stays", r.without === "dock", r);
  c.ok("with 10 coins the ferry carries Yoshi across", r.state === "arrived" && r.rider > 145, r);

  // the fight: dodge in front of a trunk, feed a mushroom while his fist is stuck; three times
  r = await ev(() => {
    const d = window.__dbg, sw = d.InkSwamp.debug, L = sw.layout;
    d.health = 3; d.setInvuln(0);
    d.place(150.5, 0, 0.2); d.step(30);
    const log = [];
    for (let round = 0; round < 3; round++) {
      // a glowing mushroom from the bed
      for (let k = 0; k < 40 && !sw.holding; k++) {
        d.place(150.2, 0, 0.2); d.step(2);
        const b = sw.state.bedShrooms.find(x => !x.taken);
        if (!b) { d.step(60); continue; }
        const a = sw.worldPos(150.2, 0, 0.2), t = sw.worldPos(b.s, b.l, 0.2);
        d.P.face.copy(t.sub(a)).normalize(); d.punch(); d.step(25);
      }
      // stand in front of a trunk; jump aside when he dashes
      const tr = L.trunks[round % 3];
      const f0 = sw.fight;
      const towardS = (L.arena.s - tr.s), towardL = (L.arena.l - tr.l), n = Math.hypot(towardS, towardL);
      const ps = tr.s + towardS / n * 2.3, pl = tr.l + towardL / n * 2.3;
      d.setInvuln(0);
      let stuck = false;
      for (let i = 0; i < 60 * 12 && !stuck; i++) {
        if (sw.fight.state !== "dash") { d.place(ps, pl, 0.2); }
        else { d.place(ps - towardL / n * 4, pl + towardS / n * 4, 0.2); }
        d.step(1);
        if (sw.fight.state === "stuck") stuck = true;
      }
      const fs = sw.fight;
      d.place(fs.s - 1.6, fs.l, 0.2); d.step(10);
      log.push({ round, stuck, holding: sw.holding, cured: sw.fight.cured });
      if (sw.rescued) break;
      d.step(80);
    }
    return { log, rescued: sw.rescued, painted: d.painted, gate: sw.gateOpen, count: sw.rescueCount, health: d.health };
  });
  c.ok("Mario's fist gets stuck in a trunk after a dodge (3 times)", r.log.length === 3 && r.log.every(x => x.stuck), r.log);
  c.ok("three mushrooms clean the paint: Mario recognises Luigi", r.rescued && r.count === 1 && r.painted === false, r);
  c.ok("the gate opens after the rescue", r.gate === true, r);
  await shot("rescue");

  // camera above the ground at a few spots
  const camFails = [];
  for (const [s, l] of [[10, 0], [24, 0], [46, 0], [75, 0], [91, 0], [113, 0], [160, 0]]) for (const [pitch, zoom] of [[0.1, 16], [1.15, 16], [0.38, 9.15]]) {
    const q = await ev(([s, l, pitch, zoom]) => { const d = window.__dbg, sw = d.InkSwamp.debug; d.place(s, l, Math.max(0.2, sw.terrainH(s, l) + 0.2)); d.setCam(pitch, zoom); d.step(60); const f = d.camFloor; return { above: f.h - f.floor, dist: d.cam.dist }; }, [s, l, pitch, zoom]);
    if (!(q.above > 0.15 && q.dist <= zoom + 1.35)) camFails.push({ s, l, pitch, zoom, q });
  }
  await ev(() => window.__dbg.setCam(0.38, 9.15));
  c.ok("camera stays above the ground and within zoom (21 spots)", camFails.length === 0, camFails);

  r = await ev(() => {
    const d = window.__dbg, L = d.InkSwamp.debug.layout;
    d.place(L.gate.s - 3, 0, 0.2); d.keys.KeyW = true;
    for (let i = 0; i < 300 && d.state === "PLAYING"; i++) d.step(1);
    d.keys.KeyW = false;
    return d.state;
  });
  c.ok("the gate launches to the last planet", r === "PLANET_TRANSITION", r);

  c.ok("no page errors", h.errors.length === 0, h.errors);
  const failed = c.report();
  await h.close();
  process.exit(failed ? 1 : 0);
})();
