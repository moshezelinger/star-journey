"use strict";
// Route regression for Wind Gardens (issues #3, #4). Drives the game through window.__dbg.step,
// so it checks game logic, not feel. Re-run after every change:
//   node tools/route-check.js            -> checks only
//   node tools/route-check.js --shots    -> also writes tools/out/route-*.png (climb and rescue framing)
const H = require("./harness");

const STEP = 1 / 60;

(async () => {
  const shots = process.argv.includes("--shots");
  const h = await H.open();
  const { page } = h;
  const c = H.checker("route");
  const ev = (fn, arg) => page.evaluate(fn, arg);
  const frame = () => page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));

  // ---------- the gap: single and double jump, both directions ----------
  // Runs toward the gap and jumps from the last plank. Returns where Mario ended up.
  async function gapRun(back, double) {
    return ev(([back, double]) => {
      const d = window.__dbg, wg = d.WindGardens.debug, L = wg.layout;
      const edge = back ? L.bridgeB[0] : L.bridgeA[1];
      d.WindGardens.reset();
      // checkpoint near the bridge so a fall comes back somewhere known
      d.place(back ? edge + 7 : edge - 7, 0, 0.8, back); d.step(40);
      d.keys.KeyW = true;
      let jumped = false, second = false, tJump = 0, fell = false, minH = 99, landed = null;
      for (let i = 0; i < 60 * 5; i++) {
        const c = wg.coordsOf(d.P.pos);
        const past = back ? c.s <= edge + 0.25 : c.s >= edge - 0.25;
        if (!jumped && past) { d.jump(); jumped = true; tJump = 0; }
        if (jumped) tJump += 1 / 60;
        if (jumped && double && !second && tJump > 0.42) { d.jump(); second = true; }
        d.step(1);
        const h = d.P.pos.distanceTo(d.active.center) - d.active.radius;
        minH = Math.min(minH, h);
        if (h < -5) fell = true;
        if (jumped && tJump > 0.2 && d.P.grounded && !landed) { const cc = wg.coordsOf(d.P.pos); landed = { s: cc.s, l: cc.l, h }; }
        if (landed) break;
      }
      d.keys.KeyW = false;
      return { fell, landed, minH };
    }, [back, double]);
  }
  const L = await ev(() => window.__dbg.WindGardens.debug.layout);
  const farA = (r) => r.landed && !r.fell && r.landed.s >= L.bridgeB[0] && Math.abs(r.landed.h - L.plankTop) < 0.2;
  const farB = (r) => r.landed && !r.fell && r.landed.s <= L.bridgeA[1] && Math.abs(r.landed.h - L.plankTop) < 0.2;
  let r = await gapRun(false, false);
  c.ok("single jump forward falls into the canyon", r.fell || !farA(r), r);
  r = await gapRun(false, true);
  c.ok("double jump forward lands on the far planks", farA(r), r);
  r = await gapRun(true, false);
  c.ok("single jump backward falls into the canyon", r.fell || !farB(r), r);
  r = await gapRun(true, true);
  c.ok("double jump backward lands on the near planks", farB(r), r);

  // falling sends Mario back to the bridge checkpoint without health loss
  r = await ev(() => {
    const d = window.__dbg, wg = d.WindGardens.debug;
    d.WindGardens.reset(); d.health = 3;
    d.place(76, 0, 0.8); d.step(30);          // reach the bridge checkpoint
    d.place(100, 0, 0.8); d.step(200);        // drop into the gap
    const c = wg.coordsOf(d.P.pos);
    return { s: c.s, cp: wg.checkpoint, health: d.health };
  });
  c.ok("fall respawns at the bridge checkpoint with full health", r.cp === "bridge" && Math.abs(r.s - 74) < 2 && r.health === 3, r);

  // ---------- punch targets ----------
  r = await ev(() => {
    const d = window.__dbg, wg = d.WindGardens.debug;
    d.WindGardens.reset(); d.place(19.2, 0, 0.3); d.step(30); d.punch(); d.step(40);
    return wg.crateGone;
  });
  c.ok("punch breaks the crate", r === true);

  r = await ev(() => {
    const d = window.__dbg, wg = d.WindGardens.debug;
    d.WindGardens.reset(); d.health = 3; d.setInvuln(0);
    const g = wg.enemies.goomba;
    const gp = g.pos.clone().add(d.active.center);
    // stand 4 units in front of it, facing it
    const c = wg.coordsOf(gp);
    d.place(c.s - 4, c.l, 0.3); d.step(20);
    d.punch(); d.step(40);
    return { dead: wg.enemies.goomba.dead, health: d.health };
  });
  c.ok("punch defeats the goomba", r.dead, r);

  r = await ev(() => {
    const d = window.__dbg, wg = d.WindGardens.debug;
    d.WindGardens.reset(); d.health = 3; d.setInvuln(0);
    const c0 = wg.coordsOf(wg.enemies.goomba.pos.clone().add(d.active.center));
    d.place(c0.s - 9, c0.l, 0.3); d.step(60 * 4);     // ignore it
    return { health: d.health };
  });
  c.ok("ignored goomba charges and hurts", r.health < 3, r);

  // koopa: standing still under the shadow costs a heart, sidestepping during the flash does not
  async function koopaRun(dodge) {
    return ev((dodge) => {
      const d = window.__dbg, wg = d.WindGardens.debug;
      d.WindGardens.reset(); d.health = 3; d.setInvuln(0);
      const c0 = wg.coordsOf(wg.enemies.koopa.anchor.clone().add(d.active.center));
      d.place(c0.s, c0.l + 3, 0.3); d.step(20);
      let dodged = false, state = "";
      for (let i = 0; i < 60 * 6; i++) {
        state = wg.enemies.koopa.state;
        if (dodge && state === "lock" && !dodged) { dodged = true; d.keys.KeyD = true; }
        if (dodged && state === "grounded") d.keys.KeyD = false;
        d.step(1);
        if (state === "grounded") break;
      }
      d.keys.KeyD = false;
      return { health: d.health, state };
    }, dodge);
  }
  r = await koopaRun(false);
  c.ok("koopa dive hurts when standing still", r.health < 3, r);
  r = await koopaRun(true);
  c.ok("sidestep during the shadow flash avoids the dive", r.health === 3, r);

  r = await ev(() => {
    const d = window.__dbg, wg = d.WindGardens.debug;
    const k = wg.enemies.koopa;   // grounded from the previous run
    const c0 = wg.coordsOf(k.pos.clone().add(d.active.center));
    const m = wg.coordsOf(d.P.pos);
    d.setInvuln(5);
    d.place(c0.s - 2.5, c0.l, 0.3); d.step(5);
    d.punch(); d.step(40);
    return { state: k.state, dead: k.dead };
  });
  c.ok("punch defeats the dazed koopa", r.dead, r);

  // ---------- windmill: wrong blade, right blade, climb, rescue once, gate ----------
  async function brakeAt(angle) {
    return ev((angle) => {
      const d = window.__dbg, wg = d.WindGardens.debug;
      const lp = wg.coordsOf(wg.leverPos());
      d.place(lp.s - 1.9, lp.l, 0.3); d.step(30);
      d.setInvuln(99);
      wg.setBladeAngle(angle);
      d.punch(); d.step(60 * 2);
      return wg.mill();
    }, angle);
  }
  await ev(() => { const d = window.__dbg; d.WindGardens.reset(); d.health = 3; });
  r = await brakeAt(Math.PI / 2 - 0.13);
  c.ok("wrong blade stops without the ladder", r.state === "stopped" && !r.climbReady, r);
  r = await ev(() => { window.__dbg.step(60 * 3); return window.__dbg.WindGardens.debug.mill(); });
  c.ok("brake slips after a wrong blade and the mill spins again", r.state === "spin", r);
  r = await brakeAt(Math.PI - 0.13);
  c.ok("right blade stops with the ladder down", r.state === "stopped" && r.climbReady, r);

  r = await ev(() => {
    const d = window.__dbg, wg = d.WindGardens.debug;
    const b = wg.coordsOf(wg.bladeBase());
    d.place(b.s - 1.5, b.l, 0.3); d.step(60);
    return { locked: d.WindGardens.isLocked(), shot: (wg.cameraShot(d.P) || {}).kind };
  });
  c.ok("walking to the ladder starts the climb", r.locked, r);
  c.ok("climb uses the fixed climb framing", r.shot === "climb", r);
  if (shots) { await ev(() => window.__dbg.step(5)); await frame(); await h.shot("route-climb-low"); await ev(() => window.__dbg.step(45)); await frame(); await h.shot("route-climb-mid"); }
  r = await ev(() => {
    const d = window.__dbg, wg = d.WindGardens.debug;
    let peak = 0; for (let i = 0; i < 60 * 3; i++) { d.step(1); }
    return { rescued: wg.state.rescued, count: wg.rescueCount, shot: (wg.cameraShot(d.P) || {}).kind, cam: d.cam, floor: d.camFloor };
  });
  c.ok("climb ends in the rescue", r.rescued && r.count === 1, r);
  c.ok("rescue uses the balcony framing", r.shot === "rescue", r.shot);
  if (shots) { await ev(() => window.__dbg.step(30)); await frame(); await h.shot("route-rescue"); }
  r = await ev(() => {
    const d = window.__dbg, wg = d.WindGardens.debug;
    // jump around on the balcony: the rescue must not fire again
    for (let k = 0; k < 4; k++) { d.jump(); d.step(70); }
    d.step(60 * 4);
    return { count: wg.rescueCount, gate: wg.gateOpen, shot: (wg.cameraShot(d.P) || {}).kind };
  });
  c.ok("rescue happens once", r.count === 1, r);
  c.ok("gate opens after the rescue", r.gate, r);
  c.ok("camera handed back to the player after the rescue", !r.shot, r);
  if (shots) { await ev(() => window.__dbg.step(90)); await frame(); await h.shot("route-after-rescue"); }
  r = await ev(() => {
    const d = window.__dbg, wg = d.WindGardens.debug;
    const L = wg.layout;
    d.place(L.gate.s, L.gate.l, 0.2); d.step(20);
    return d.state;
  });
  c.ok("gate launches to the next planet", r === "PLANET_TRANSITION", r);
  // the launch plays in real time; afterwards the follow camera must start next to Mario
  await page.evaluate(() => { window.__dbg.pause = false; });
  await page.waitForFunction(() => window.__dbg.state === "PLAYING", null, { timeout: 15000 });
  r = await ev(() => { const d = window.__dbg; d.pause = true; d.step(30); return { planet: d.active.name, dist: d.cam.dist, floor: d.camFloor }; });
  c.ok("camera follows Mario on the next planet", r.dist < 11 && r.floor.h > r.floor.floor, r);

  if (h.errors.length) c.ok("no page errors", false, h.errors.join(" | "));
  const failed = c.report();
  await h.close();
  process.exit(failed ? 1 : 0);
})();
