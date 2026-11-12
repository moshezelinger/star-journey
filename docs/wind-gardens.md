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
- Camera: default sits behind and above the hero (horizontal 8.5, height 3.4). Vertical drag tilts (0.1 to 1.15 rad), wheel or pinch zooms (4.5 to 16), reset restores both. While airborne the look target moves 3.5 ahead so the landing stays in frame. All of these live in `TUNE.camera` (`js/tuning.js`).
  - Ground: `WindGardens.cameraFloor(pos)` gives the height of the first surface under any point, from `terrainH` and the solids (a solid counts only when the point is not below its underside, so the space under the balcony stays free). When the ground hides the hero, the camera first lifts along its arc (up to 0.72 rad more pitch), then whatever is still blocked is pulled in along the ray toward the hero. It is never pushed away from him. The old code tried to push the camera outside `radius + 1.6`, but overwrote its own position with the planet centre before reading the direction, so in the trench or at low pitch the camera dived into the planet.
  - Distance: the camera is never further from the hero than zoom + the airborne extra (1.2). The one exception is the brake-lever framing below.
  - Walls: a ray from the hero to the camera is tested against the tower, roof, balcony and pedestal, and the camera is pulled in 0.8 short of the first hit.
  - Brake lever: between s 114 and 128.5 the camera backs off up to 8 units and aims 40% of the way toward the hub, so the lever, the ladder blade and the balcony fit in one frame (issue #5, frame 3). It fades in and out over about a second.
  - Climb and rescue: `WindGardens.cameraShot` gives fixed shots. During the climb the camera sits in front of and to the left of the mill, below the hub, so neither the left blade nor the tower can come between it and the hero. During the rescue it looks from the open (+l) end of the balcony, on the tower side of the blade plane. When the shot ends, control returns over 1.3 s, and the follow camera starts from where the shot camera was. On the balcony the follow camera looks from the open end, unless the player has turned the camera in the last 2 s.
- Ground model: the base sphere plus `terrainH(s,l)` (trench and canyon, drawn into the mesh), plus solid boxes and the tower cylinder. the hero stands on a top within 0.65 above his feet and is blocked by a body that overlaps him. A void cell (canyon with no plank) has no ground.

## Day and night (#5)

`js/day-cycle.js`. One full cycle takes `TUNE.day.length` seconds (300 by default) and starts in the morning, with the sun 30° up behind the hero at the landing.

How the rotation works: the planet stays still and the sun direction turns around the planet's axis (option A in `docs/next-steps-star1.md`). From the ground this looks the same as a turning planet, and physics, enemies, camera and every world coordinate stay untouched. Option B (turning the planet group and carrying everything in its frame) was not needed. The axis is the route's right-hand direction, so the sun crosses the sky along the route: it rises behind the hero at the landing, stands over the route at noon and sets behind the windmill.

- Light: one directional sun. Sky colour, fog colour and range, the hemisphere (ambient) light, the purple rim fill and the stars all follow the sun's elevation over the middle of the route (s 70), interpolated between six key frames (night, twilight, sunset, golden, morning, noon). Stars show only once the sun is under the horizon. A sun disc follows the camera far away.
- Speed curve: `TUNE.day.morningHold` (0 to 0.9) makes the sun move slowly around noon and quickly around midnight, so most of the cycle is daylight. At 0.35 roughly 60% of the cycle has the sun up.
- Night: `TUNE.day.nightDarkness` sets how dark it gets, `TUNE.day.minAmbient` is the floor for the ambient light. At night the edge markers (gap edges, bridge ends, trench rim, pedestal top, balcony, lever), the tower windows and a warm ring around the koopa's shadow brighten, and the lantern's beam and glow grow. The hero's own textures glow faintly (emissive), without adding a light.
- Pause and restart: time advances only inside `updatePlaying`, so a paused game pauses the cycle. `resetGame` returns it to the morning. Other planets and the menu keep the old night sky.
- QA: `__dbg.DayCycle.setMoment("morning" | "noon" | "dusk" | "twilight" | "night")`.

## Look (#5)

- Canyon: its own fine mesh (`buildCanyon`, 0.5 units along the route, finer near the route across it), displaced by the same `terrainH` the physics uses, with strata colours that darken and turn blue with depth. The coarse planet sphere is pushed out of sight under the strip.
- Windmill: four broad blades. Three have a lattice frame and one long cloth sail that billows with `GameShared.wind`. The ladder blade has no sail, glowing rungs and a red pennant at the tip. The tower has a stone foot, a door and three windows.
- Depth: light stones along the path edges (the route also reads in greyscale), the path is lighter and the grass darker than before, and twelve low-contrast islands float far behind the route.
- Path: its own ribbon mesh (`buildPath`) that follows `terrainH` every 0.5 units, wobbles at the edges and fades into the grass through vertex alpha. The coarse planet triangles under it keep the grass colour. It stops where the ground dips (trench, canyon).
- Sky: a dome that follows the camera (`DayCycle`), zenith in the key frame's sky colour, horizon in the fog colour, with a soft glow around the sun. Far terrain now fades into the sky instead of a flat backdrop.
- Trench and net: the trench has its own fine strip like the canyon (`TRENCH_STRIP`), since the coarse triangles covered the trench floor. The floor is a darker brown, and a light rope grid (`buildNet`, a canvas texture) lies 0.08 above its lower part. The net, the grass and the canyon read apart in greyscale (`docs/frames/net-and-gap.jpg`).
- Night: the path glows faintly (emissive up to 0.16 at night), so the route stays a lighter band in the dark.
- Shadows: the sun casts a shadow map (2048, 1024 on touch screens) over 76×76 units centred on the hero. Trees, flowers, the bridge, the mill, enemies and the hero cast; the ground only receives. The canyon and trench strips neither cast nor receive, since their self-shadow ended in the straight edge of the shadow map. A soft round shadow also sits straight under the hero on the first surface below him and fades with height, so the landing spot reads during a jump at any time of day.
- Each effect can be switched off for measurement: `?fx=-day,-canyon,-windmill,-markers,-islands,-stones,-path,-shadows,-sky`.

## Tuning (#3, #4, #8)

All values that need a play session are in `js/tuning.js`: gap width, blade stop window and speed, how long the brake slips, goomba sight, warning, charge and dizzy times, koopa follow, shadow flash, dive and dazed times, wind drift, camera defaults and limits, and day length, speed curve and darkness. Press `` ` `` in the game (or open it with `?tune`, which also shows a ⚙ button for touch) to change them with sliders while playing. **Save** keeps them in this browser, **Defaults** clears them, **Copy values** copies them as JSON for the issue. The gap width needs a reload. The panel also shows the time of day with buttons to jump to it, and the split times of the run (landing, training, bridge, windmill, rescue) in game time. The child test sheet is `docs/child-test-sheet.md`.

## Shared state (#2 contract)

`GameShared.wind.direction` and `.strength` are written once per frame by the level and read by the flags, the windmill sails and the hero's drift (`TUNE.wind.drift` × strength, 0.65 by default, half on the ground, only between s 60 and 125). `GameShared.sky` (`elev`, `daylight`, `night`) is written by the day cycle and read by the level for its night details. `GameShared.brake.engaged` is set by the lever and read by the blade animation and the lever pose.

## Characters (#6)

the brother, the הסימן הצבוע cart, mushroom walker and winged turtle are primitives built in code. The the hero GLB is unchanged. the brother stands on the balcony with a lantern that flashes long, short, short every 6 s and shoots a light beam up so it can be seen from the landing. After the rescue he turns toward the hero, waves, and hops down to the cart. A real the brother GLB can replace `makethe brother()`.

The punch pose moves the right shoulder bone (`PUNCH_ARM` in `index.html`); the ladder climb raises both arms. The punch pose was checked in a side-view screenshot (arm extends forward); the climb pose has only been checked from behind.

## Test hooks and scripts

`window.__dbg` exposes `P`, `WindGardens.debug` (coordinates, state, enemies, `setBladeAngle`, splits), `DayCycle`, `place(s, l, h, back)`, `setCam(pitch, zoom)`, `cam`, `camFloor`, `step(n, dt)` to advance the simulation without rendering, and `pause`. They are for QA scripts and have no effect on play.

The scripts are in `tools/` (run `npm install` there once; they use the preinstalled Playwright Chromium and serve Three.js r128 from `tools/node_modules` because headless browsers often cannot reach the CDN):

- `node tools/route-check.js` - gap single and double jump in both directions, fall and respawn, punch on crate, goomba and dazed koopa, ignored goomba hurts, koopa dive hurts unless sidestepped, wrong and right blade, brake slip, climb, rescue once, gate, launch. `--shots` adds climb and rescue screenshots.
- `node tools/camera-check.js` - camera above the real ground, the hero in frame and the distance limit at seven spots (net, trench exit and wall, bridge, canyon rim, far planks, meadow) at the pitch and zoom extremes, plus walking out of the trench at low pitch. `--shots` adds screenshots.
- `node tools/frames.js` - the three #5 frames at morning, dusk and night, desktop and narrow landscape, into `tools/out` and `docs/frames/sheet-*.jpg`.
- `node tools/perf-check.js` - frame cost of each effect by switching it off. Software rendering, so only the differences between rows mean anything.

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
