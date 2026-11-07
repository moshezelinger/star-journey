# Mario Galaxy: Following Luigi's Light

A browser platformer on small round planets, built with Three.js and no build step. Star 1, **Wind Gardens**, is playable end to end: spot Luigi's lantern, learn to punch and double jump, cross a broken bridge in changing wind, and stop a windmill to rescue him.

- **Play locally:** `python3 -m http.server 8765`, then open `http://localhost:8765/`. Keys: WASD, Space (again in the air), J or F to punch, R to reset the camera.
- **Build diary with screenshots:** [docs/showcase](docs/showcase/README.md)
- **Technical notes:** [docs/wind-gardens.md](docs/wind-gardens.md)
- **Story and the four stars:** [game-design/four-planets.md](game-design/four-planets.md) (Hebrew)

Status: prototype. Graphics are placeholder primitives, and the level has not yet been tested on a real touch device or with a child.

---

# מריו גלקסי — בעקבות האור של לואיג׳י

הבזק אחד ארוך, ואז שניים קצרים. ראיתם? בין הכנפיים של טחנת הרוח מישהו מאותת בפנס. מריו מכיר את הסימן הזה מאז שהיה קטן. זה לואיג׳י! יש רק בעיה אחת. הגשר שמוביל אל אחיו התפרק, וממש עכשיו משהו עם כנפיים מטיל צל על הקרש שמריו עומד עליו.

הכול התחיל כשבאוזר ג׳וניור התגנב אל מפת הכוכבים עם מכחול ביד. כמה משיכות צבע, והחברים שהיו אמורים לחזור הביתה יחד התפזרו ברחבי הגלקסיה. צאו עם מריו לארבעה כוכבים כדי לאסוף את החבורה. קפצו פעם אחת מעל הגשר, ועוד פעם בעודכם באוויר. כשתגיעו למכרות הבזלת, עצרו לרגע והקשיבו. מי דופק שלוש פעמים עמוק בתוך ההר? ועל איזו קרונית ראיתם את האותיות DK?

בביצת הדיו מגיע תורכם לרכוב עם לואיג׳י על הגב של יושי. הביטו במים, חפשו את טואד בין הפטריות הזוהרות ונסו לגלות מה עשה המכחול לכובע האדום של מריו. כדאי לזכור מי מהחברים רואה היטב בחושך ולמי יש לשון ארוכה במיוחד. על ירח הכבשן, כשבאוזר ירקע ברגלו והלבה תתחיל לעלות, תצטרכו לבחור למי להושיט יד קודם.

## תיעוד תהליך הבנייה

צילומי מסך והסברים קצרים על בניית שלב גני הרוח: [docs/showcase](docs/showcase/README.md).

## איך לשחק / How to play

```
python3 -m http.server 8765
# http://localhost:8765/
```

מקשים / Controls: WASD, Space (פעמיים באוויר / twice in the air), J או F לאגרוף / punch, R לאיפוס מצלמה / reset camera. במגע: מקל שמאלי, כפתורי Jump ו־Punch.

## Credits and notice / קרדיטים והבהרה

- Mario model: "Mario Movie (Super Mario Movie)" by Guilherme Navarro, CC-BY-4.0, [source](https://sketchfab.com/3d-models/mario-movie-super-mario-movie-13d05e3c76a148568decf1e8f25888f8).
- Bowser model: "Bowser Super Mario Bros.1" by Vandacvi, CC-BY-4.0 (see `assets/bowser/license.txt`).
- Unofficial, non-commercial fan project. Mario, Luigi, Bowser and related characters are trademarks of Nintendo. The code is not affiliated with or endorsed by Nintendo.
