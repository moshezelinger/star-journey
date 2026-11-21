# Furnace Moon: star 4 (issue #21)

Furnace Moon replaces the old "Bowser's Star Garden" as the fourth and last star, and the old boss fight in `index.html` is gone: this star runs the villain itself. Story: `game-design/four-planets.md`. Module: `js/furnace-moon.js`, plugged in through the `LEVELS` table like stars 1 to 3. The planet is the smallest of the four (radius 100). The whole route sits inside one crater, so from the landing rim the lava lake, the volcanoes and the citadel are all in view.

## Route (arc length `s` from the landing)

| s | What | Teaches |
|---|---|---|
| 0 | Landing on the crater rim with the four friends. An opening shot shows the whole crater | Where everything is |
| 4..17 | Down the rim. The young villain stands on a ledge to the left and rolls paint balls across the path | Watch, then cross |
| 18..42 | The lava lake and three basalt bridges he painted. Only the real one (left, `l -9`) is reflected in the lava as a dark band; a fake melts under the hero and grows back after 5 s | Look at the reflection |
| 44..56 | The far shore: 8 coins, and the shrine that sells the deflect punch for 8 | Coins buy abilities |
| 58..80 | Fight 1. He stands on a pillar, swings his brush (the warning) and rolls a ball down the slope. A punch just before it arrives sends it back; the paint covers his eyes, he stumbles down, and a punch hits him. Three hits | Wait for the swing, then deflect |
| 81 | A paint wall, gone once he flees to his father | |
| 86..124 | Fight 2. The villain lands, breaks the rim and locks the four friends in basalt cages around the arena. See below | |
| 130 | The crater edge. The young villain hangs there after his father falls; the hero reaches out (Punch next to him). He gets his brush back and paints a rainbow road home. Victory screen | |

Checkpoints: `landing` 0, `shore` 44, `arena` 59, `crater` 86. Falling into lava returns to the last one, without losing a heart. Hearts at zero also return there, and everything already done in the fight stays done.

## Fight 2

- **His attacks, in turn:** a charge (he paws the ground for 1 s, locks onto where the hero stands, then runs straight), fire breath (his mouth glows for 1 s, then a sweep of fire along the ground; jump over it or stay away), and a ground slam (he crouches, jumps, and a shockwave runs out along the ground; jump over it).
- **Opening a cage:** stand in front of a cage and jump aside when he charges. He runs into it and cracks it himself (orange glow). A power punch next to a cracked cage opens it. A normal punch does nothing. After each friend he gets faster (`rage` 1 to 4), but the friend now helps.
- **What each friend does (any order):**
  - The brother walks to the bank of the lava channel and lights the shaded crater with his lantern. The three mushrooms there become visible.
  - The mushroom friend marks the orange mushroom that guards from fire (once the crater is lit).
  - The dinosaur pulls the marked mushroom over the lava with his tongue (once it is marked) and leaves it on the near bank. It grows back 4 s after being eaten.
  - The big ape lifts three stone slabs. 9 coins under them unlock the **dash**.
- **The last round** (all four free): a ring of fire surrounds him. It hurts without the fire mushroom (20 s of protection). He only slams now, and pants for 1.9 s after each slam (dizzy stars). Only a dash into him during that pause beats him; walking into him does not.

## Abilities added on this star

- **Deflect punch:** a punch within reach of a paint ball rolling at the hero sends it back to the young villain. The level handles it inside `punchHit`.
- **Dash** (`TUNE.dash`, in `index.html`): once unlocked, a third press of jump in the air (after the double jump) throws the hero forward at 20 units/s for 0.45 s, once per jump. A level turns it on by returning `{ dash: true }` from `abilities()`. While a dash runs, `P.dashT > 0`.
- **The end of the journey:** the level calls `env.win()`, which opens the victory screen (`finishJourney` in `index.html`). The old grand star is gone.

## Characters

Installed: the villain (Bowser, the same file the old boss used, now loaded through `Models` with a `strip` option that drops a stray helper mesh), the big ape, the dinosaur and the mushroom friend. Still stand-ins: the brother and the young villain (Bowser Jr.); see issue #19. The villain's model has no animation clips, so he moves as a whole (lean, crouch, jump).

## Performance

Headless Chromium, software rendering, `node tools/furnace-perf.js`: landing 134 draw calls and 250 thousand triangles (the whole crater in view), bridges 105 / 192 thousand, fight 1 26 / 115 thousand, fight 2 22 / 113 thousand, edge 16 / 113 thousand. The old garden planet at the same spots: 13 to 39 calls, 141 to 181 thousand. Star 1 is unchanged (321 calls and 314 thousand before, 319 and 310 thousand after). The lava is one unlit shader for all lava surfaces, with no per-frame CPU work. `?fx=-jungle` turns the rocks off, `?fx=-islands` the volcanoes and the citadel.

## Tests

`node tools/furnace-check.js` (32 checks): landing state, the paint balls on the slope, a fake bridge and the real one, the shrine and its price, a ball that is not sent back, three deflect rounds, the paint wall, the cages, four cages cracked by his charge and opened by a power punch (and not by a normal one), his rage, each friend's job, the dash coins and the dash itself, the ring of fire with and without the mushroom, the shockwave on the ground and in a jump, the last blow (walking in fails, a dash works), the ending and the victory screen, the camera at 27 spot and angle combinations, and no page errors. `--shots` writes `tools/out/furnace-*.png`. `node tools/furnace-frames.js` writes frames of the main moments. `__dbg.goTo(3)` or Shift+4 lands on star 4.

Not tested: real devices, touch, frame rate, a child.

## Open questions for Moshe

- Is the deflect timing (punch within about 3 units of the ball) easy enough for ages 7 to 8?
- Should the last round need the dash, as now, or should any punch during his pause count as well?
- The fire mushroom guards for 20 s. Too long, too short?
