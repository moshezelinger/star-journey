# Ink Swamp: star 3 (issue #20)

Ink Swamp replaces the old "Tiny Moon" as the third star. Story: `game-design/four-planets.md`. The young villain's paint hit the hero on the flight from star 2 (`updateAmbush` in `index.html`), so here the player plays his brother: first on foot, then riding the dinosaur. Module: `js/ink-swamp.js`, plugged in through the `LEVELS` table like stars 1 and 2.

## Route (arc length `s` from the landing)

| s | What | Teaches |
|---|---|---|
| 0 | Landing. The painted hero stands there for a moment, then runs off; purple footprints lead on | Who you are now, what to follow |
| 8 | The dinosaur sniffs the trail; walking up to him mounts him | |
| 14..24 | Hollow roots with a coin behind each | The tongue |
| 27..39 | First paint pool, 12 wide (a single jump falls in) | Jump, then flutter |
| 43..63 | Ink lake with four stepping stones; an ink squid puffs up, then spits on the stone ahead, which sinks for 3.5 s | Wait, or tongue the squid |
| 66..84 | Mushroom grove with two piranha plants. Across the river the hero smashes a bridge with his power punch | The stem bends back before the bite |
| 93..99 | The pond. Three huts painted on trunks beyond it; only the real one's light is reflected in the water. The tongue pulls a lever from the bank. A fake loses its paint; the real one opens and the mushroom friend comes out | Look at the reflection |
| 104..122 | Coins between and on top of roots | The ferry needs 10 |
| 124..148 | The ferry over the ink lake (10 coins collected in this star) | |
| 150..176 | The mushroom bed and three trunks. The hero winds up (his fist glows), locks onto the brother and dashes. If the brother jumps aside in front of a trunk, the fist gets stuck; bring him a glowing mushroom then. Three mushrooms clean the paint, he recognises his brother | Stand before a trunk, dodge at the right moment |
| 181 | The gate to the last planet | |

Checkpoints: `landing` 0, `roots` 12, `lake` 41, `grove` 65, `pond` 87, `coins` 103, `bed` 150 (after the ferry). Falling into paint returns to the last one.

## Controls on this star

- **Avatar:** a level can return the player's look (`avatar()`); `index.html` hides the hero's model and shows it instead. Here: the brother on foot, then the brother on the dinosaur.
- **Flutter** (`TUNE.flutter`): while riding, the second press of jump in the air gives a small hop, and holding the button cancels most of the gravity for up to 1 s. Keyboard Space now also tracks being held.
- **Tongue:** the punch button while riding. No lunge. It grabs the closest thing along its line within 8.5 units (enough to reach the levers from the pond's bank): coins, levers, mushrooms, the squid, a piranha plant whose head is stuck, or feeds the hero when holding a mushroom.
- The power punch is only for the hero himself; it is off while the brother plays.

## Characters

Installed (CC-BY 4.0, source and licence checked on Sketchfab, files from public copies on GitHub with the original `license.txt`): Yoshi ("DS DSi - Super Mario 64 DS - Yoshi" by DokigerElRojito, 687 triangles), Toad ("TOAD" by ijosephpinta, 14,458), Piranha Plant (by Marcus Vinicius, 794). The painted hero uses the player's own model, tinted purple by how much paint is left. Still stand-ins: Luigi and the ink squid (Blooper); see issue #19.

## Coins

Coins collected here count toward the ferry (10 needed) and are also added to `P.coins`, which carries across the stars; the fare is taken from it. Every 10 coins still gives a heart back.

## Performance

Headless Chromium, software rendering: landing 160 draw calls and 305 thousand triangles, lake 152 / 304 thousand, pond 80 / 183 thousand, arena 35 / 178 thousand. Mushroom caps were reduced from 10x6 to 8x3 segments to get there (they were 346 thousand). `?fx=-jungle` turns the trees and mushrooms off.

## Tests

`node tools/swamp-check.js` (22 checks): landing on foot, mounting, a coin by tongue, a single jump falls in the first pool and the flutter crosses it, the squid inks a stone and the tongue catches it, the piranha plant bites when you stay and misses when you step away, the tongue defeats it while stuck, the bridge scene, a wrong and the right hut, the ferry with and without coins, three rounds of the fight with the fist stuck in a trunk, the rescue, the gate, and the camera at 21 spot and angle combinations. `--shots` writes `tools/out/swamp-*.png`. `__dbg.goTo(2)` lands on star 3.

Not tested: real devices, touch, frame rate, a child.

## Open questions for Moshe

- Should the brother be able to play on foot longer, or is mounting the dinosaur right at the start fine?
- In the story the fight has the brother stand before a trunk; here the hero aims at where the brother stands when he winds up. Is the timing (1.1 s wind-up) right for ages 7 to 8?
