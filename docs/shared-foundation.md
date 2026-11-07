# Issue 2 — shared foundation for Wind Gardens

## Run and baseline check

From the repository root run `python -m http.server 8765 --bind 127.0.0.1`, then open `http://127.0.0.1:8765/` in a browser with WebGL. Use an HTTP server so the relative GLB path resolves. The page currently depends on Three.js r128 and GLTFLoader from CDNs, so an online browser session is required.

On the menu, click **Play**. Check that Mario appears standing on Meadow Planet. On a keyboard hold W/A/S/D or arrows to travel around the sphere, press Space to jump, and drag horizontally on the canvas to rotate the camera. On touch, drag from the left side for the stick, drag the right side to look, and tap Jump. Check that movement follows the camera's tangent direction as the local up vector turns. Collect five yellow shards, enter the illuminated ring, and verify the next planet loads with Mario on its surface. The existing game has one jump and four existing planets. The new story and double jump belong to later tickets.

Before extraction, the local HTTP server served the menu and Chrome headless loaded the page title and Play control. After extraction, a Chrome DevTools smoke run clicked Play, held W for about 0.5 s, changed camera yaw, checked GLB readiness, and triggered a stage transition. Mario reported `ready: true`; position changed from approximately `(0, 88.25, 17.65)` to `(0, 87.32, 21.80)`; camera tangent direction changed; transition ended with `activeIndex: 1` and `state: PLAYING`. These are runtime state checks in headless Chrome. Visual appearance, natural collection of five shards, and touch controls still require manual playthrough on a device.

## Current entry points

`index.html` remains the page entry. It loads Three.js, GLTFLoader and `js/shared.js` in that order before its inline game script. In the inline script, `PLANET_DEFS` defines the existing worlds. `loadPlayerModel` loads `mario_movie_super_mario_movie.glb` and puts it in `playerRig`. The `P` object holds position, velocity, local up, speed, jump impulse and health. Keyboard, touch stick and look handlers live in the input section. `updatePlaying` turns those inputs into tangent motion and spherical gravity. `updateCameraFollow` handles third-person follow. `landOnPlanet`, `startTransition` and `updateTransition` handle travel, while `animate` dispatches the update loop.

## Shared contracts for agents

All dimensions below are Three.js world units. The existing first planet is a sphere of radius 90 centered at `(0,0,0)`. Its spawn direction is `(0,1,0.2)` normalized. The player's origin is on the sphere surface. The GLB is scaled from its rendered surface to a target standing height of **1.55** and its soles are aligned to the player origin. The camera follows at distance **8.5** and height **3.4**. Mario's tangent running speed is **8.5 units/s**, jump impulse is **11.5 units/s**, and gravity on the first planet is **24 units/s²**. On level ground without air steering, the ideal jump time is about **0.96 s**, height about **2.76 units**, and horizontal reach about **8.15 units**. These are starting measurements for the Wind Gardens test layout, not measured clearance guarantees. Validate bridge gaps in play.

The action names for agents are `moveX`, `moveY`, `lookYaw`, `jump`, `punch`, and `brakeInteract`. The first four map to existing inputs. Punch and brake interaction are reserved for the upcoming mechanics. `moveX` and `moveY` are normalized in `[-1,1]` with diagonal magnitude capped at one. `lookYaw` rotates about the player's local surface up. The jump action is queued on key press or button press. A second jump requires a later mechanics change.

The first planet and spawn are the initial test scene. Use the landing point as a reset point. Later stage builders should define named checkpoints at the bridge entrance, far side of the bridge, and windmill foot. Reset should restore position, local up, velocity, camera heading and puzzle state together. Keep checkpoints in level data so death and retry can use the same locations.

`GameShared.surfaceUp(pos, planet)` returns the outward normal. `GameShared.projectTangent(vector, up)` returns a normalized tangent direction and handles a parallel input vector. `GameShared.nearestPlanet(pos, planets)` selects by distance from surface. The physics and camera agents should use these functions rather than deriving their own world-up assumptions.

`GameShared.wind.direction` is a Three.js vector tangent to the local surface and `GameShared.wind.strength` is a nonnegative magnitude. The level owner sets both. The physics agent reads them to apply wind, and the environment agent reads the same values to animate flags. When consuming wind at a new surface point, project its direction through `projectTangent` first. `GameShared.brake.engaged` is the single shared boolean for the windmill puzzle and its animation. The puzzle owner changes it and the environment agent renders from it. Both start inert on the current planets.

## File ownership and integration order

Issue #2 owns `js/shared.js`, this document, and the minimal script wiring in `index.html`. The integration owner is the only person to edit shared `index.html` during parallel work. Issue #3 owns level layout and puzzle definitions, #4 movement, combat and camera logic, #5 environment assets and visuals, and #6 character loading and animation. Each contributor should isolate new code in its own `js/` file or `assets/` path and specify its entry hook in the PR. The integration owner wires the scripts into `index.html` after each dependency passes a playthrough. Issue #8 checks the integrated branch on desktop and touch.

Integrate #2 before #4 and #6. Agree on route geometry with #3 and #4 before fixing bridge dimensions. Integrate mechanics and route before final #5 art, then #6 character work and #8 QA. Record the exact tested commit and device in each issue.
