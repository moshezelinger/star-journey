# מסע בין כוכבים
# Star Journey: Following the Lantern's Light

A browser platformer on small round planets, built with Three.js and no build step. Star 1, **Wind Gardens**, is playable end to end: spot the brother's lantern, learn to punch and double jump, cross a broken bridge in changing wind, and stop a windmill to rescue him. Star 2, **Basalt Mines**, is playable end to end too: find the power glove, learn what to break, climb a mine track under rolling stones, and send a cart of beams to the friend knocking inside the mountain.

- **Play online:** [moshezelinger.github.io/star-journey](https://moshezelinger.github.io/star-journey/)
- **Play locally:** `python3 -m http.server 8765`, then open `http://localhost:8765/`. Keys: WASD, Space (again in the air), J or F to punch, R to reset the camera.
- **Build diary with screenshots:** [docs/showcase](docs/showcase/README.md)
- **Technical notes:** [docs/wind-gardens.md](docs/wind-gardens.md), [docs/basalt-mines.md](docs/basalt-mines.md)
- **Story and the four stars:** [game-design/four-planets.md](game-design/four-planets.md) (Hebrew)

Status: prototype. Characters other than the hero and Bowser are simple stand-ins until their models are installed (`js/models.js`), and the level has not yet been tested on a real touch device or with a child.

---

## הסיפור

הבזק אחד ארוך, ואז שניים קצרים. ראיתם? בין הכנפיים של טחנת הרוח מישהו מאותת בפנס. הגיבור מכיר את הסימן הזה מאז שהיה קטן. זה האח! יש רק בעיה אחת. הגשר שמוביל אל אחיו התפרק, וממש עכשיו משהו עם כנפיים מטיל צל על הקרש שהגיבור עומד עליו.

הכול התחיל כשהנבל הצעיר התגנב אל מפת הכוכבים עם מכחול ביד. כמה משיכות צבע, והחברים שהיו אמורים לחזור הביתה יחד התפזרו ברחבי הגלקסיה. צאו עם הגיבור לארבעה כוכבים כדי לאסוף את החבורה. קפצו פעם אחת מעל הגשר, ועוד פעם בעודכם באוויר. כשתגיעו למכרות הבזלת, עצרו לרגע והקשיבו. מי דופק שלוש פעמים עמוק בתוך ההר? ועל איזו קרונית ראיתם את הסימן הצבוע?

בביצת הדיו מגיע תורכם לרכוב עם האח על הגב של הדינוזאור. הביטו במים, חפשו את חבר הפטריות בין הפטריות הזוהרות ונסו לגלות מה עשה המכחול לכובע האדום של הגיבור. כדאי לזכור מי מהחברים רואה היטב בחושך ולמי יש לשון ארוכה במיוחד. על ירח הכבשן, כשהנבל ירקע ברגלו והלבה תתחיל לעלות, תצטרכו לבחור למי להושיט יד קודם.

## תיעוד תהליך הבנייה

צילומי מסך והסברים קצרים על בניית שלב גני הרוח: [docs/showcase](docs/showcase/README.md).

## איך לשחק / How to play

לשחק בדפדפן / Play in the browser: [moshezelinger.github.io/star-journey](https://moshezelinger.github.io/star-journey/)

```
python3 -m http.server 8765
# http://localhost:8765/
```

מקשים / Controls: WASD, Space (פעמיים באוויר / twice in the air), J או F לאגרוף / punch, R לאיפוס מצלמה / reset camera. במגע: מקל שמאלי, כפתורי Jump ו־Punch.

## Credits and notice / קרדיטים והבהרה

- Mario model: "Mario Movie (Super Mario Movie)" by Guilherme Navarro, CC-BY-4.0, [source](https://sketchfab.com/3d-models/mario-movie-super-mario-movie-13d05e3c76a148568decf1e8f25888f8).
- Bowser model: "Bowser Super Mario Bros.1" by Vandacvi, CC-BY-4.0 (see `assets/bowser/license.txt`).
- Donkey Kong model: "Donkey Kong 64" by chicosantossaraiva, CC-BY-4.0, [source](https://sketchfab.com/3d-models/donkey-kong-64-131973a2107e45e8a61822c556f252f2) (see `assets/dk/license.txt`).
- Inspired by the Super Mario games. Unofficial, non-commercial fan project. Mario, Luigi, Bowser and related characters are trademarks of Nintendo. The code is not affiliated with or endorsed by Nintendo.
