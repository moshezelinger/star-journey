# Wind Gardens: star 1 (issues #3 to #6)

Wind Gardens replaces the old "Meadow Planet" as the first of four stars. It is built by `js/wind-gardens.js` and wired into `index.html` by a handful of hooks. The gate at the end still launches to the next existing planet.

## Run it

```
python3 -m http.server 8765
# open http://localhost:8765/   (Three.js r128 and GLTFLoader load from CDNs)
```

Desktop controls: `WASD` or arrows move, `Space` jumps (press again in the air), `J`, `F` or `K` punch, drag to turn and tilt the camera, mouse wheel zooms, `R` or the ⟳ button resets the camera. Touch: left stick moves, **Jump** button (tap again in the air), **Punch** button, one finger on the right side turns and tilts, two fingers pinch to zoom.

## Route (arc length `s` from the landing, `l` positive to the hero's right)

| s | What | Teaches |
|---|---|---|
| -15..20 | Landing meadow, flags, the brother's lantern beam on the horizon | Find the goal |
| 22 | Punch crate | Punch |
| 34 | Mushroom walker, alone on flat ground | Step aside, punch it |
| 40..46 | Stone pedestal, 3.4 high | Double jump (single jump tops out at 2.76) |
| 50 | Winged winged turtle, alone in an open meadow | Shadow telegraphs the dive; punch it while dazed |
| 57..66 | Training trench, 3 deep, net floor | Safe place to miss; walk or jump out |
| 66..78 | Wind path with cloth flags | Read the wind |
| 76..123 | Bridge over a canyon ring with a 9 unit gap | Double jump mid-air to land on the far planks |
| 124 | Red brake lever | Punch to stop the mill |
| 129.5 | Four blades; only blade 0 has a ladder | Stop it pointing down (within 22°) |
| 131..135, l 2..10 | Balcony with the brother | Landing here triggers the rescue once |
| 150, 152 | הסימן הצבוע cart rolls in, gate opens | Leads on to the next star |

The canyon is a full ring around the planet, so the bridge is the only way across. Falling in sends the hero back to the last checkpoint with no health loss. Checkpoints: `landing` s 0, `training` s 54, `bridge` s 74, `windmill` s 125. They are defined in `LAYOUT.checkpoints` and restore position, heading and velocity. the hero's health returns to full only when enemies knock it to zero.

## Mechanics (#4)

- Double jump: one extra jump in the air, restored on landing, with a 0.1 s coyote window after walking off an edge.
- Punch: 0.38 s swing, lunge of 3.5 units/s, hit resolves at 70% of the swing in a sphere of radius 2.4 centered 1.1 units ahead and 0.9 above the hero. It breaks the crate, defeats a mushroom walker, defeats a grounded winged turtle and pulls the brake lever. Stomping a mushroom walker also works.
- Damage: contact with a charging mushroom walker or the winged turtle's dive costs one of three hearts, knocks the hero back and gives 1.6 s of invulnerability. At zero hearts the hero returns to the checkpoint with full health.
- Camera: default sits behind and above the hero (horizontal 8.5, height 3.4). Vertical drag tilts (0.1 to 1.15 rad), wheel or pinch zooms (4.5 to 16), reset restores both. While airborne the look target moves 3.5 ahead so the landing stays in frame. A ray from the hero to the camera is tested against the tower, roof, balcony and pedestal, and the camera is pulled in when they block it. On the balcony the camera swings to look along the balcony, because the blades would otherwise hang between camera and the hero.
- Ground model: the base sphere plus `terrainH(s,l)` (trench and canyon, drawn into the mesh), plus solid boxes and the tower cylinder. the hero stands on a top within 0.65 above his feet and is blocked by a body that overlaps him. A void cell (canyon with no plank) has no ground.

## Shared state (#2 contract)

`GameShared.wind.direction` and `.strength` are written once per frame by the level and read by both the flag animation and the hero's drift (0.65 × strength, half on the ground, only between s 60 and 125). `GameShared.brake.engaged` is set by the lever and read by the blade animation and the lever pose.

## Characters (#6)

the brother, the הסימן הצבוע cart, mushroom walker and winged turtle are primitives built in code. The the hero GLB is unchanged. the brother stands on the balcony with a lantern that flashes long, short, short every 6 s and shoots a light beam up so it can be seen from the landing. After the rescue he turns toward the hero, waves, and hops down to the cart. A real the brother GLB can replace `makethe brother()`.

The punch pose moves the right shoulder bone (`PUNCH_ARM` in `index.html`); the ladder climb raises both arms. The punch pose was checked in a side-view screenshot (arm extends forward); the climb pose has only been checked from behind.

## Test hooks

`window.__dbg` exposes `P`, `WindGardens.debug` (coordinates, state, enemies, `setBladeAngle`), `step(n, dt)` to advance the simulation without rendering, and `pause`. They are for QA scripts and have no effect on play.

## What was verified, and how

All runs: headless Chromium with software rendering, driven through `__dbg.step`. Frame rate and load time were **not** measured (software rendering says nothing about a real GPU). Touch was only emulated (button positions and taps), never on a real device, and no child has played it.

- Single jump falls into the canyon and respawns at the bridge checkpoint; double jump lands on the far planks.
- Wrong blade releases the brake after 3.2 s and allows a retry; correct blade starts the climb, rescue happens once, cart and gate appear, gate launches to the next planet.
- Mushroom walker hurts when ignored and is defeated by a punch at 4.7 units; crate breaks; grounded winged turtle is defeated by a punch; standing still under the winged turtle's shadow costs a heart, sidestepping does not.
- Pedestal cannot be climbed with a single jump and can with two.

## Open questions for Moshe

- Blade stop window is ±22° around straight down at 0.65 rad/s. Is it easy enough for ages 7 to 8, or should the window widen?
- Gap width of 9 units is tuned by calculation and automated runs, not by a child. It needs a play session.
- Real art (#5 touches) and a the brother GLB are still open.
