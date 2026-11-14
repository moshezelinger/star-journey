# Basalt Mines: star 2 (issues #12 to #17)

Basalt Mines replaces the old "Crystal Planet" as the second of four stars. Story: `game-design/four-planets.md`. It is built by `js/basalt-mines.js` and plugs into `index.html` through the same hooks as Wind Gardens (see "Level table" below). The gate at the end launches to the next existing planet.

## Route (arc length `s` from the landing, `l` positive to the hero's right)

| s | What | Teaches |
|---|---|---|
| 0 | Jungle landing with Luigi. Three thuds from inside the mountain, with dust and a small shake | Someone is knocking: follow the sound |
| 10 | Power glove shrine | Hold Punch to charge, release to smash |
| 18..28 | Training yard: three cracked basalt boulders, one with a gold vein (5 coins) | A quick punch bounces off, a power punch breaks |
| 30..35 | Rock spur; a cracked wall closes the only gap | What to break |
| 37..52 | Beetle valley: one basalt beetle, armoured in front | Make it miss; hit the cracked back when it is stuck |
| 50..56, l -10..-19 | Side grotto behind a cracked wall with gold (8 coins) | Leaving the path pays |
| 57..100 | Mine track climbing 9 units. Monkeys on the beams at s 82 and 99 roll waves of three stones; four alcoves with lanterns | Move from cover to cover |
| 100..118 | Junction: the beam cart held by a basalt block, Luigi at the switch, two tunnels | Listen where the thuds come from |
| 112 | Switch: straight to DK, right to a dead end (red cross sign) | Walk up to Luigi to switch it |
| 124..136 | DK's chamber under a cracked, sagging roof; DK holds the last beam | Do not break the beam |
| 137 | Rubble that DK clears after the rescue | |
| 138..162 | Exit tunnel down to daylight | |
| 165..169 | The young villain at the launch pad, then the gate | Cliffhanger for star 3 |

Checkpoints: `landing` 0, `training` 15, `valley` 37, `mine` 57.5, `junction` 101, `chamber` 121, `exit` 140 (only after the rescue). There is no void here: losing three hearts returns the hero to the last checkpoint with full health.

## Mechanics

- **Power punch** (`index.html`, `TUNE.power.charge`): after the glove, holding the punch key or button charges the fist (an orange glow, then sparks when ready, 0.5 s by default). Letting go throws a power punch with a longer lunge. A quick press is still the normal punch, at once, so the old feel does not change. `P.hasPower` resets on a new game.
- **Punch targets** get one of three answers: cracked rock (boulders, the spur wall, the grotto wall, the cart block) bounces a quick punch with a "clang" and breaks under a power punch; the beetle's front armour pushes it back; DK's beam is never broken, the roof shakes, dust falls and a hint explains why.
- **Basalt beetle** (`TUNE.beetle`): sees the hero within 14, warns for 0.8 s, charges straight for 1.5 s. If it touches the hero it costs a heart. If it misses, or hits the valley side, it stays stuck for 2.6 s with its cracked back glowing; only a power punch then defeats it (3 coins).
- **Rolling stones** (`TUNE.rocks`): each monkey throws a wave of three stones across the whole track every 3 s while the hero is in its stretch. Only the alcoves are safe (a double jump also clears one stone). A power punch shatters a stone. A monkey runs off when the hero reaches its beam.
- **Cart and switch**: a power punch on the block lets the cart roll. Walking up to Luigi throws the switch (a yellow arrow shows the way). On the dead-end branch the cart crashes, then comes back with a new block after 2.6 s. On the straight track it reaches DK and the rescue starts once. A rolling cart knocks the hero aside.
- **Walls**: ground steeper than 1.25 cannot be walked up and is slid down, so the mine walls and the spur cannot be climbed, even slowly. A hidden belt edge at |l| = 46 keeps the hero near the route. The chamber roof is a ceiling.
- **Camera**: the same follow camera as star 1, with this level's terrain and solids as the floor and the roof, block, rubble and cart as ray colliders. At the junction it backs off so Luigi, the switch, the cart and both tunnels fit in one frame. The rescue and the villain have fixed shots.
- **Day and night**: the same cycle, aimed over the middle of this route (`dayAxis`). Cracks, gold and lamps glow brighter at night.

## Characters (GLB/glTF models)

Characters are ready-made models in the Nintendo style (CLAUDE.md). The registry is `js/models.js`. Each model was checked on its Sketchfab page: CC-BY 4.0, downloadable, under 30 thousand triangles. Until a model's files are in `assets/<id>/`, the game shows a simple stand-in built in code (and never requests the missing file).

| id | Role | Model | Author |
|---|---|---|---|
| `luigi` | Luigi (star 1 balcony, star 2 switch) | [Luigi (Super Mario Bros)](https://sketchfab.com/3d-models/luigi-super-mario-bros-a79c8ef8419448c39f61fc32b2b19e7c) | Yanez Designs |
| `dk` | DK | [Donkey Kong (Mario Kart 8 Deluxe)](https://sketchfab.com/3d-models/donkey-kong-mario-kart-8-deluxe-243c32b79df542a88ecd74a5ede752c4) | Austin Zimmermann |
| `goomba` | Goomba (star 1) | [Animated Goomba (Super Mario Bros)](https://sketchfab.com/3d-models/animated-goomba-super-mario-bros-3c91cc4ac8144d82a05309679a3dbbd5) | Yanez Designs |
| `paratroopa` | Winged koopa (star 1) | [Mario Kart 8 - Koopa Paratroopa](https://sketchfab.com/3d-models/mario-kart-8-koopa-paratroopa-2147c4e5ff5f43a89c3a07c5011c4295) | taej11503 |
| `buzzy` | Basalt beetle | [Buzzy Beetle (Super Mario Bros)](https://sketchfab.com/3d-models/buzzy-beetle-super-mario-bros-8d3d39516f7b40d5aa19e85226940899) | Yanez Designs |
| `ukiki` | Monkeys on the beams | [Ukiki](https://sketchfab.com/3d-models/ukiki-c71d5ac4570a46b69fc3bfa7b3e4a30e) | tirrellclark.75 |
| `bowserjr` | The young villain | [Bowser Jr. (Mario Kart 8 Deluxe)](https://sketchfab.com/3d-models/bowser-jr-mario-kart-8-deluxe-8fd1397374a04d499ab4bd5bf90ffeac) | Austin Zimmermann |

To install one: open its page, sign in to Sketchfab (free), Download 3D Model, choose **glTF**, then run

```
node tools/add-model.js dk ~/Downloads/donkey-kong-mario-kart-8-deluxe.zip
```

The script unpacks it into `assets/dk/`, keeps the licence file, adds the credit to `README.md` and sets `ready: true` in `js/models.js`. The game then scales it to the height in the registry, puts its feet on the ground and plays its first animation clip. If it faces the wrong way, change `yaw` in `js/models.js`. Moving parts that belong to the stand-ins (DK's raised arms, Luigi's waving arm) do not move a static model; that needs the model's own clips (issue #16).

## Level table (`index.html`)

`LEVELS = { wind: WindGardens, mines: BasaltMines }` and `levelOf(planet)` replace the old `theme === "wind"` checks. A level module answers: `configure`, `shapeGround`, `wantsSmooth`, `smoothGround`, `build`, `attach`, `reset`, `update`, `query`, `drift`, `constrain`, `punchHit`, `aim`, `scripted`, `isLocked`, `respawn`, `cameraFloor`, `cameraFocus`, `cameraShot`, `cameraHint`, `colliders`, `exitDir`, `dayAxis`, `hudText`. The shared environment passed to `attach` gained `shake(v)` and `refreshHud()`.

## Performance (docs/performance-rules.md)

Measured in headless Chromium with software rendering (draw calls and triangles; no frame rate):

| Spot | Draw calls | Triangles (high) | Triangles (medium) |
|---|---|---|---|
| Star 1 landing (unchanged) | 319 | 310 thousand | 253 thousand |
| Star 2 landing | 195 | 269 thousand | 259 thousand |
| Star 2 climb | 86 | 188 thousand | 177 thousand |
| Star 2 junction | 76 | 189 thousand | 179 thousand |
| Star 2 chamber | 50 | 189 thousand | 178 thousand |

The ground is one fine strip (0.6 units along the route, finer near it across) shaped by the same `terrainH` as the physics; trees, ferns, basalt columns and rail sleepers are instanced; every static part with a shared material is merged (`mergeStatic`). `?fx=-jungle` turns off the trees and ferns.

## Test hooks and scripts

`window.__dbg.goTo(1)` lands on star 2, `__dbg.powerPunch()` throws a charged punch, `__dbg.BasaltMines.debug` exposes the layout, terrain, breakables, beetle, stones, cart, switch, coins, rescue and villain state.

- `node tools/mines-check.js` (28 checks): glove, quick and power punch on cracked rock, gold coins, the spur wall, walls that cannot be climbed, beetle armour and the stuck back, beetle charge and sidestep, stones on the track and safety in an alcove, the monkey running off, the cart block, wrong switch and retry, Luigi's switch, the warning at DK's beam, the rescue (once), DK clearing the rubble, the exit tunnel, the villain, the gate, and the camera at 32 spot and angle combinations. `--shots` writes `tools/out/mines-rescue.png` and `mines-gate.png`.

## What was verified, and how

Headless Chromium with software rendering only. Frame rate and load time were not measured, touch was not tried on star 2, no child has played it, and none of the GLB models is installed yet (all characters are stand-ins).

## Open questions for Moshe

- Power punch by holding the punch button: right for ages 7 to 8, or a separate touch button?
- Coins: what should they open? In the story, coins buy abilities only in stars 3 and 4.
- The young villain only throws paint near the hero and flies off. Should the brush already hit the hero here (the opening of star 3)?
- Download the seven models above (Sketchfab needs a free sign-in), or allow a Sketchfab API key in the cloud environment so an agent can do it.
