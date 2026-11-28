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
| 165..169 | The young villain at the launch pad aims his brush, laughs and flies off; the gate opens | |
| (flight) | On the way to the next star he flies in beside the hero and his paint hits: the hero glows purple from then on | The opening of star 3 |

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

## Coins (decision)

Coins carry across the stars in `P.coins` (shown in the HUD). In the story they buy abilities in stars 3 and 4. Until then, every 10 coins gives a heart back (or a cheer when the hearts are full). Star 2 has 16: 5 in the gold vein, 8 in the grotto, 3 from the beetle. A new game resets them.

## The villain's ambush (decision by Moshe)

The young villain does not hit the hero at the pad; he hits him during the flight to the next star (`updateAmbush` in `index.html`). He appears beside the hero at a quarter of the flight, throws a paint blob at 42%, and leaves. `P.painted` stays on until a new game, and the hero glows purple (an emissive tint, no extra light). Star 3 (the Ink Swamp) starts from this state.

## Characters

Built in code in `js/characters.js` (`docs/characters.md`), as original designs: the brother with a lit lantern, the big ape in a hard hat holding the beam with both arms up, the basalt beetle (a dome of basalt columns, a front shield with a horn, glowing eyes, six legs; the glowing cracks on its back use the level's `crackMat`, and stars circle it while it is stuck), the mine monkeys in miner's helmets holding a stone overhead, and the young villain (a small imp in a beret and a paint-splashed apron, with the brush).

The big ape still shows the installed `dk` model by default ("Donkey Kong 64" by chicosantossaraiva, CC-BY 4.0); `?models=code` shows the code version. The other slots in `js/models.js` (`luigi`, `goomba`, `paratroopa`, `buzzy`, `ukiki`, `bowserjr`) are not installed, so the code characters show.

## Music (decision by Moshe, 28.11.2026)

"The Three-Knock Trail" (`assets/music/three-knock-trail.mp3`, 2:28, 128 kbps, 2.3MB; Moshe's own Suno track: three knocks on log drums, a marimba groove, a muted brass and flute theme) plays on star 2 only. It replaces the generated arpeggio while the hero is on the star, and only then.

- **Where it is wired:** `Audio.TRACKS` and `Audio.setTrack()` in `index.html`. The render loop asks for `"mines"` while the state is PLAYING on the mines star; any other state or star asks for none. The file streams through an `<audio>` element (no decoding to memory) and loads during the flight to the star (`preloadTrack`).
- **Behaviour:** fades in over 0.35 s from the start (so the three knocks come in clearly, right at the landing) or 1.2 s mid-song, fades out over 0.8 s, then stops and rewinds, so every visit starts with the knocks. It loops. Volume 0.42 so DK's thuds underneath (the clue to follow) still come through. The Sound button mutes it without losing its place, a hidden tab pauses it, and a browser that wants a tap first starts it on the first tap (`Audio.resume`).
- **Adding a track for another star:** one line in `Audio.TRACKS`, one in the `setTrack` call in `animate`.
- **Open:** the thuds the game plays (the story cue) and the song's own knocks now overlap at the landing; to be judged by ear. The song restarts from the beginning when it loops, three knocks included.

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

The ground is one fine strip (0.6 units along the route, finer near it across) shaped by the same `terrainH` as the physics; trees, ferns, basalt columns and rail sleepers are instanced; every static part with a shared material is merged (`mergeStatic`). `?fx=-jungle` turns off the trees and ferns. Trees within reach of the walkable belt have a round trunk collider (in buckets along `s`); trees right next to a coin get none.

## Test hooks and scripts

`window.__dbg.goTo(1)` lands on star 2, `__dbg.powerPunch()` throws a charged punch, `__dbg.BasaltMines.debug` exposes the layout, terrain, breakables, beetle, stones, cart, switch, coins, rescue and villain state.

- `node tools/mines-check.js` (30 checks): glove, quick and power punch on cracked rock, gold coins, the spur wall, walls that cannot be climbed, beetle armour and the stuck back, beetle charge and sidestep, stones on the track and safety in an alcove, the monkey running off, the cart block, wrong switch and retry, Luigi's switch, the warning at DK's beam, the rescue (once), DK clearing the rubble, the exit tunnel, the villain at the pad, the gate, the paint hit during the flight, and the camera at 32 spot and angle combinations. `--shots` writes `tools/out/mines-rescue.png` and `mines-gate.png`.

## What was verified, and how

Headless Chromium with software rendering only. Frame rate and load time were not measured, touch was not tried on star 2, and no child has played it. DK is the only character model installed; the rest are built in code.

## Open questions for Moshe

- Download the six models that are not installed (Sketchfab needs a free sign-in), or allow a Sketchfab API key in the cloud environment `star-journey` so an agent can do it.
