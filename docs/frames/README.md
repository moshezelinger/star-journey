# Wind Gardens: the three #5 frames

`sheet-desktop.jpg` and `sheet-phone-landscape.jpg`: rows are the landing, the bridge top and the brake lever; columns are morning, dusk (the sun on the horizon) and night.

- Source: `node tools/frames.js` on branch `claude/sharp-knuth-9kzmek` (path ribbon, sky dome, sun shadows; the first sheets were on `8746963`), headless Chromium with SwiftShader (software WebGL), device pixel ratio 1. Each tile is a game screenshot scaled to half size. The full frames land in `tools/out/` (not committed).
- Sizes: desktop 1280×720, narrow landscape phone 740×360 (emulated window size only, not a real phone).
- Views: landing at s 0, bridge top at s 92 on the near planks, brake lever at s 120.8, l -9, default camera (zoom 9.15, pitch 0.38). The landing frame waits for the lantern's long flash.

## Frame cost per effect

`node tools/perf-check.js`: median of 40 frames per view, each effect switched off in turn with `?fx=-name`.

| fx | landing | bridge top | brake lever | triangles (landing) |
|---|---|---|---|---|
| all on | 2.7 ms | 1.3 ms | 1.2 ms | 250k |
| -day | 1.9 | 1.4 | 1.1 | 250k |
| -canyon | 2.1 | 2.4 | 1.6 | 218k |
| -windmill | 1.6 | 1.1 | 1.0 | 249k |
| -markers | 2.4 | 1.7 | 1.6 | 245k |
| -islands | 2.3 | 2.0 | 1.1 | 249k |
| -stones | 2.2 | 1.4 | 0.9 | 246k |
| all off | 2.4 | 1.6 | 1.9 | 207k |

What this does and does not show: the differences are within ±1 ms and go both ways, so in this setup no effect has a measurable frame cost. The numbers come from software rendering in a container, which says nothing about a real GPU or a phone. The reliable figure is the geometry: the effects add about 43k triangles, 32k of them the canyon strip. Load time (page load event, local server) was 1.9 to 2.3 s in every configuration. **Frame rate and load time on a real computer and a real phone have not been measured.**

## Path, sky and shadows (second pass)

`perf-check.js` measures CPU time per frame in software rendering, so the shadow map does not show up there (all rows within ±1 ms again). The shadow map adds one extra pass over the casting objects near the hero each frame; on a real GPU this is the effect most likely to cost frame rate on a phone. It drops to a 1024 map on touch screens and can be switched off with `?fx=-shadows`. **Not measured on a real device.**

## Net, landing and abyss (greyscale check)

`net-and-gap.jpg`: top left the safety net in the training trench (morning), top right the same in greyscale, bottom left the bridge gap in greyscale, bottom right the net at night. Grass is the lightest surface, the trench floor is a darker band with a light rope grid on it, and the canyon falls off into a dark haze, so the three read apart without colour. 1280×720 desktop window, headless SwiftShader.
