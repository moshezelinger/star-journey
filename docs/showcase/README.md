# תיק עבודות: איך נבנה כל שלב
# Build portfolio: how each level was made

כל שלב במשחק מקבל תיק עבודות משלו: סיפור הבנייה בצילומי מסך מהמשחק עצמו, מהגרסה הראשונה ועד הגרסה שמשחקים בה.

Each level gets its own portfolio: the story of its build in screenshots of the game itself, from the first version to the one that is played.

| שלב / Level | מצב / Status | תיק עבודות / Portfolio |
|---|---|---|
| 1. גני הרוח / Wind Gardens | שחיק, עבר סבב גרפיקה וביצועים / playable, graphics and performance pass done | [wind-gardens/](wind-gardens/README.md) |
| 2 | טרם נבנה / not built yet | |
| 3 | טרם נבנה / not built yet | |
| 4 | טרם נבנה / not built yet | |

## הכלל / The rule

**כל שלב נסגר עם תיק עבודות.** שלב לא נחשב גמור, וגם לא ממוזג ל־`main` כגמור, עד שתיק העבודות שלו מעודכן. אותו דבר נכון אחרי סבב גדול על שלב קיים, כמו גרפיקה, אויבים או ביצועים: מוסיפים פרק חדש.

**Every level closes with a portfolio.** A level is not finished, and is not merged to `main` as finished, until its portfolio is up to date. The same holds after a major pass on an existing level, such as graphics, enemies or performance: add a chapter.

### מבנה / Structure

- תיקייה לכל שלב: `docs/showcase/<level>/README.md`, התמונות ב־`img/`, והגדרת הצילומים ב־`shots.json`. בטבלה למעלה מוסיפים שורה עם קישור.
  One folder per level: `docs/showcase/<level>/README.md`, images in `img/`, shot definitions in `shots.json`. Add a row with a link to the table above.
- הפרקים מסודרים לפי סדר המשחק: נקודת מוצא, נחיתה ומטרה, כל מיומנות במקום סלחני, האתגר המרכזי, הסיום. סבבים מאוחרים יותר באים כפרקים ממוספרים בהמשך.
  Chapters follow the order of play: starting point, landing and goal, each skill somewhere forgiving, the main challenge, the ending. Later passes follow as further numbered chapters.
- כל פרק פותח במה שהילד צריך להבין או לחוות, ורק אחר כך מסביר איך זה נבנה. אחריו באה תמונה או לוח השוואה.
  Each chapter opens with what the child should understand or feel, and only then how it was built. Then an image or a comparison board.
- שתי שפות: עברית קודם ואנגלית אחריה, באותו תוכן.
  Two languages: Hebrew first, then English, with the same content.
- בסוף: "מה היה חשוב בדרך", כלומר ההחלטות שכדאי לזכור לשלב הבא, ו"מה עוד לא נעשה", בכנות.
  At the end: "What mattered along the way", the decisions worth carrying to the next level, and "Not done yet", stated plainly.

### תמונות / Images

- מצלמים עם `node tools/showcase.js <level>`, לפי `shots.json`. כך אפשר לייצר את התמונות מחדש אחרי כל שינוי. צילום מיוחד שהכלי לא יודע לעשות נשמר עם שם שמתאר אותו.
  Capture with `node tools/showcase.js <level>` from `shots.json`, so images can be regenerated after any change. A special capture the tool cannot make is saved with a name that describes it.
- שינוי חזותי מוצג כלפני ואחרי באותה זווית. תמונות "לפני" נשמרות כ־`img/before-*.jpg` לפני שמתחילים לשנות.
  A visual change is shown as before and after from the same angle. "Before" pictures are saved as `img/before-*.jpg` before the change starts.
- כשההבדל חשוב למשחק (רשת, תהום, משטח נחיתה), מוסיפים גם תמונה בגווני אפור (`"gray": true`).
  When the difference matters for play (net, abyss, landing surface), add a greyscale image as well (`"gray": true`).
- JPEG באיכות 82, עד כ־400KB לתמונה, ממוספרות לפי סדר הפרקים (`17-landing-now.jpg`).
  JPEG at quality 82, up to about 400KB each, numbered in chapter order (`17-landing-now.jpg`).
- לציין שהצילום נעשה ברינדור תוכנה, ושקצב התמונות בו לא מייצג מכשיר אמיתי.
  State that captures use software rendering and their frame rate does not represent a real device.

### קישורים / Links

- `README.md` הראשי מקשר לכאן.
  The main `README.md` links here.
- דוח הסיום בכרטיס של השלב מקשר לפרק החדש.
  The closing report on the level's issue links to the new chapter.
