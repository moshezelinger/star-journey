# פרומפטים ל-Suno: מוזיקה למשחק

המסמך מחלק את הצלילים לשניים. **מוזיקה ארוכה (4 שניות ומעלה) מייצרים ב-Suno.** **צלילים קצרים (עד שנייה וחצי) מייצרים בקוד**, כמו שכבר קורה ב-`Audio` ב-`index.html`. בסוף המסמך יש רשימה של הצלילים בקוד, מה שכבר קיים ומה שחסר.

הפרומפטים באנגלית כי Suno מבין אותם הכי טוב. ההסברים בעברית.

## איך להשתמש

1. ב-Suno בוחרים **Custom**, מפעילים **Instrumental**.
2. את בלוק ה-`Style` מדביקים בשדה **Style of Music** (עד 1000 תווים בגרסאות החדשות, כל הפרומפטים כאן קצרים מזה).
3. את בלוק ה-`Exclude` מדביקים ב-**Exclude styles**.
4. את בלוק ה-`Lyrics` מדביקים בשדה המילים. אלה רק תגיות מבנה, אין שם מילים.
5. מייצרים לפחות ארבע גרסאות לכל קטע ובוחרים בראש. ילד בן 7 עד 8 הוא קהל היעד, אז כל קטע צריך להישמע הרפתקני ולא מפחיד.

**כללים שכדאי לא לשבור**
- אין בפרומפטים שמות של אמנים, חברות או דמויות (נינטנדו, מריו וכדומה). Suno חוסם אותם, ובכל מקרה התוצאה צריכה להיות מקורית, כמו הדמויות בקוד.
- אפשר להשתמש בגרסה החינמית רק לשימוש לא מסחרי, והזכויות בה נשארות אצל Suno. כדאי לבדוק את התנאים העדכניים לפני שמפרסמים את המשחק מעבר לאתר ה-GitHub Pages הנוכחי.

**קטעים קצרים.** Suno לא טוב ביצירת קטעים של 4 שניות. מבקשים "short sting", מקבלים 30 עד 60 שניות, וחותכים את הפתיחה ב-Audacity. מעדיפים גרסאות שבהן הקטע נפתח ישר בנושא.

**לולאות.** Suno לא מבטיח סוף שמתחבר להתחלה. מה שעובד:
- מבקשים "no fade-out, steady energy" ולא מוסיפים תגית `[End]`.
- חותכים ב-Audacity למספר שלם של תיבות. אורך תיבה ב-4/4 הוא `240 / BPM` שניות (ב-104 BPM: 2.31 שניות).
- בקוד מנגנים עם `source.loop = true`, `loopStart` ו-`loopEnd`, שמחברים בלי חריץ. מייצאים ל-OGG או M4A (בערך 96 kbps), כי ל-MP3 יש ריפוד בהתחלה שיוצר חריץ.

**מפתחות.** המוזיקה הנוכחית בקוד מנגנת ארפג'יו לפי מפתח לכל כוכב (`key` בטבלת `LEVELS`): 220 (לה), 233 (סי במול), 208 (לה במול), 147 (רה). הקטעים למטה נכתבו באותם מפתחות, כך שצלילי הקוד (מטבע, חידה שנפתרה) ימשיכו להתאים להם. הם גם יכולים לקחת את `Audio.root` ולהתכוונן לבד.

**מוטיב משותף (אופציונלי).** אות הפנס של האח הוא הבזק ארוך ושניים קצרים. אם מוסיפים לפרומפט "a recurring three-note motif, one long note then two short" Suno יכניס אותו לפעמים. כשזה עובד, כדאי לבחור דווקא את הגרסה הזו: המוטיב יחבר בין הכוכבים.

---

## א. מוזיקת רקע

### 1. מסך הפתיחה ומפת הכוכבים
קובץ: `music/title.ogg` · 60 עד 90 שניות · לולאה · סול מז'ור · 96 BPM

```
Style: Wonder and anticipation, starry night adventure game title theme, G major, 96 BPM. Opens with a music box and celesta, then warm strings and a french horn carry a hopeful melody, soft harp arpeggios, gentle timpani swells. A small lantern signal motif: one long note then two short. Cozy, magical, inviting, for children. Loop-friendly, no fade-out.
Exclude: vocals, lyrics, heavy drums, electric guitar, dubstep
Lyrics: [Instrumental]
[Intro: music box and celesta]
[Theme: horn melody over harp]
[Theme: strings join, warmer]
```

### 2. כוכב 1: גני הרוח
קובץ: `music/star1-wind.ogg` · 90 עד 120 שניות · לולאה · לה מז'ור · 104 BPM

```
Style: Bright airy adventure music for floating islands and windmills, A major, 104 BPM, flowing 6/8 swing. Wooden flute and pizzicato strings carry a simple memorable melody, soft harp arpeggios, glockenspiel, warm acoustic guitar strums, shaker and light hand percussion, wind-chime textures and a gentle breeze whoosh. Sunny, playful, hopeful, curious, made for children. Loop-friendly, steady energy, no big ending, no fade-out.
Exclude: vocals, lyrics, heavy drums, distorted guitar, sad, dark
Lyrics: [Instrumental]
[Intro: harp and breeze]
[Main theme: flute melody]
[Variation: pizzicato strings answer the flute]
[Main theme returns]
```

### 3. כוכב 2: מכרות הבזלת
קובץ: `music/star2-mines.ogg` · 90 עד 120 שניות · לולאה · סי במול דורי · 96 BPM

```
Style: Mysterious but playful underground mine and jungle adventure, Bb Dorian, 96 BPM, steady stomping groove. Marimba and xylophone ostinato, hollow log drums and wood blocks that knock three times in a row, low pizzicato bass, muted brass, a clink of a mine cart on rails, a curious jungle flute on top. Echoing cave reverb, warm and curious, never scary, for children. Loop-friendly, no fade-out.
Exclude: vocals, lyrics, horror, heavy metal, dubstep, sad
Lyrics: [Instrumental]
[Intro: three knocks on log drums]
[Groove: marimba ostinato and bass]
[Theme: muted brass and flute]
[Groove returns]
```

### 4. כוכב 3: ביצת הדיו
קובץ: `music/star3-swamp.ogg` · 90 עד 120 שניות · לולאה · לה במול · 82 BPM

```
Style: Whimsical glowing swamp adventure, Ab minor drifting into Ab major, 82 BPM, slow swaying groove. Bubbling synth plucks like water drops, bass clarinet, celesta, glass harmonica, soft marimba, low upright bass, finger snaps, wet echoing reverb, glowing mushroom atmosphere. Mysterious and gentle with a touch of longing, as if someone is searching for a lost brother. Cute, not frightening. Loop-friendly, no fade-out.
Exclude: vocals, lyrics, horror, heavy drums, distorted guitar
Lyrics: [Instrumental]
[Intro: water drops and celesta]
[Groove: bass clarinet and upright bass]
[Theme: glass harmonica melody]
[Groove returns, bubbles]
```

### 5. כוכב 4: ירח הכבשן (חקירה, גשרים, לפני הקרבות)
קובץ: `music/star4-furnace.ogg` · 90 עד 120 שניות · לולאה · רה מינור · 112 BPM

```
Style: Epic but kid-friendly volcano adventure, D minor, 112 BPM, driving rhythm. Taiko and big frame drums, low brass, staccato string ostinato, deep bass pulses, wordless choir pads, metal glints, rumbling lava atmosphere, a heroic melody that rises on a trumpet. Rising tension and courage, dramatic but not scary. Loop-friendly, no fade-out.
Exclude: lyrics, rap, spoken words, pop vocals, dubstep, heavy metal guitar
Lyrics: [Instrumental]
[Intro: distant taiko and low rumble]
[Groove: strings ostinato and low brass]
[Theme: trumpet melody]
[Groove returns]
```
אם המקהלה לא מופיעה בגלל מצב Instrumental, מוותרים עליה.

### 6. טיסה בין כוכבים
קובץ: `music/flight.ogg` · 60 עד 90 שניות · לולאה · רה מז'ור · 70 BPM

```
Style: Floating through space, awe and quiet hope, ambient orchestral, 70 BPM. Shimmering synth pads, harp glissandi, soft pulsing bass, distant bells, a lonely celesta melody like a lantern in the dark. Calm, wide, wondrous, for children. Loop-friendly, no fade-out.
Exclude: vocals, lyrics, drums, dubstep, scary
Lyrics: [Instrumental]
[Pads and bells]
[Celesta melody]
[Pads return]
```

**גרסת לילה (אופציונלי).** יש מחזור יום ולילה (`js/day-cycle.js`). לכל קטע 2 עד 5 אפשר לייצר גרסה שנייה עם אותו פרומפט ובתוספת: `night version, slower by 15 BPM, softer, lullaby-like, fewer drums, more celesta and pads`. בקוד מחליפים בין הגרסאות בהצלבה לאורך כמה שניות. אם לא רוצים עוד קבצים, אפשר לעשות את אותו הדבר בקוד: מסנן low-pass וירידה בעוצמה.

---

## ב. חידות

חידות במשחק: ידית הבלם של הטחנה, הקרונית והמתג במכרה, הבקתה האמיתית שמשתקפת בבריכה, המעבורת, גשר הבזלת האמיתי מעל הלבה, ובחירת מי לשחרר קודם בקרב הסופי. לכולן אותה משפחה של צלילים.

### 7. חידה מוצגת (סטינג)
קובץ: `music/puzzle-appear.ogg` · 3 עד 5 שניות

```
Style: Short musical sting, a curious question. Celesta rising three notes ending on an unresolved suspended chord, soft string tremolo, a glint of chimes. Light mystery, playful, no drums. About 4 seconds.
Exclude: vocals, lyrics, drums, bass drop
Lyrics: [Instrumental]
[Short sting]
```

### 8. חושבים על החידה (לולאה שמתחת למוזיקת הרקע)
קובץ: `music/puzzle-think.ogg` · 45 עד 60 שניות · לולאה · דו מז'ור · 72 BPM

```
Style: Calm thinking music for a puzzle in a children's game, C major pentatonic, 72 BPM. Sparse soft pizzicato, music box and soft marimba, lots of space between notes, a gentle bass pulse, no strong melody so it never tires the ear. Patient, curious, warm. Loop-friendly, no fade-out.
Exclude: vocals, lyrics, drums, ticking clock, tension
Lyrics: [Instrumental]
[Sparse notes]
[Sparse notes, a little higher]
```
בקוד: כשהחידה מתחילה, מנמיכים את מוזיקת הכוכב לבערך 30 אחוז ומכניסים את הלולאה הזו. כשהחידה נפתרת מחזירים.

### 9. חידה נפתרה
קובץ: `music/puzzle-solved.ogg` · 4 עד 6 שניות

```
Style: Bright triumphant "aha" sting, about 5 seconds. Ascending major arpeggio on harp and glockenspiel, a string swell, a sparkle of chimes on the final chord. Joyful, warm, no drums.
Exclude: vocals, lyrics, heavy drums, bass drop
Lyrics: [Instrumental]
[Short sting]
```
זה קטע קצר, וצליל קצר מאוד של "נכון" (שנייה אחת) עדיף בקוד. ראו בסוף.

### 10. יכולת חדשה (כפפת העוצמה, אגרוף ההדף, הזינוק)
קובץ: `music/ability.ogg` · 4 עד 6 שניות

```
Style: Power-up fanfare, about 5 seconds. Rising brass and bright synth shimmer, a glittering run on harp and bells, big major chord with a cymbal swell. Heroic and exciting, for children.
Exclude: vocals, lyrics, heavy metal, dubstep
Lyrics: [Instrumental]
[Short fanfare]
```

---

## ג. קרבות

### 11. אזור סכנה (שכבה לאויבים רגילים)
קובץ: `music/danger.ogg` · 45 עד 60 שניות · לולאה · 128 BPM

מתאים לעמק החיפושיות, לקופים עם האבנים ולפטריות של כוכב 1. נכנס מעל מוזיקת הרקע ויוצא כשהאויבים נעלמים.

```
Style: Light action tension loop for a children's platformer, 128 BPM. Staccato strings, snare rim clicks, tight bass pulse, hand claps, a playful sense of danger. Sparse enough to play on top of another theme. Not scary. Loop-friendly, no fade-out.
Exclude: vocals, lyrics, heavy metal, horror, long melodies
Lyrics: [Instrumental]
[Tense groove]
[Tense groove, hi-hat added]
```

### 12. קרב ביצת הדיו: הגיבור הצבוע נגד האח
קובץ: `music/boss-swamp.ogg` · 90 שניות · לולאה · לה במול · 118 BPM

החבטה מגיעה אחרי 1.1 שניות של התכוננות, והאח צריך לקפוץ הצידה. לכן הקצב בנוי כך: תיבה של תופים שמתגברים, ואחריה אקורד חד.

```
Style: Tense emotional chase boss music, Ab minor, 118 BPM. One bar of building toms (the wind-up), then a sharp accent hit, repeating. Pizzicato strings, bass clarinet, taiko, bubbling synth ostinato, and underneath a warm cello melody that hints at a brotherly bond. Dramatic but gentle for kids, more heartfelt than scary. Loop-friendly, no fade-out.
Exclude: vocals, lyrics, heavy metal, horror, dubstep
Lyrics: [Instrumental]
[Groove: toms build, accent hit]
[Cello theme over groove]
[Groove: toms build, accent hit]
```

### 13. קרב 1 בירח הכבשן: הנבל הצעיר
קובץ: `music/boss-villain.ogg` · 90 שניות · לולאה · רה מינור · 132 BPM

```
Style: Mischievous cartoon boss battle, D minor, 132 BPM. Sneaky pizzicato strings, bassoon, xylophone, tuba bass, snare rolls, brush-stroke swish sounds, cheeky staccato woodwinds like a giggle. Fun and cheeky rather than threatening, a naughty kid with a paintbrush. Loop-friendly, no fade-out.
Exclude: vocals, lyrics, heavy metal, horror
Lyrics: [Instrumental]
[Sneaky groove]
[Chase: woodwinds giggle]
[Sneaky groove returns]
```

### 14. קרב 2: הנבל הגדול
קובץ: `music/boss-final.ogg` · 120 שניות · לולאה · רה מינור · 140 BPM

```
Style: Epic boss battle, D minor, 140 BPM. Double-time taiko, pounding low brass, staccato strings, timpani rolls, wordless choir stabs, fire crackle, a heroic trumpet counter-melody. Intense and powerful but still friendly for kids. Loop-friendly, no fade-out.
Exclude: lyrics, rap, heavy metal guitar, dubstep, horror
Lyrics: [Instrumental]
[Groove: taiko and low brass]
[Theme: trumpet melody]
[Groove returns, strings]
```

### 15. הסיבוב האחרון (כל החברים משוחררים, טבעת האש)
קובץ: `music/boss-last-round.ogg` · 90 שניות · לולאה · מי מינור · 156 BPM

אותו קרב, אבל הצעד האחרון: גבוה יותר, מהיר יותר, ועם הרגשה של תקווה, כי החברים כבר לצד הגיבור.

```
Style: Climactic final boss battle, E minor, 156 BPM, full orchestra. Pipe organ, soaring heroic horns, fast strings, taiko, timpani, wordless choir, a hopeful major-key theme fighting through the minor key. Triumphant and intense, for kids. Loop-friendly, no fade-out.
Exclude: lyrics, rap, heavy metal guitar, dubstep, horror
Lyrics: [Instrumental]
[Climax groove]
[Heroic horns theme]
[Climax groove returns]
```

### 16. ניצחון בקרב קטן
קובץ: `music/win-small.ogg` · 5 עד 6 שניות

```
Style: Short victory fanfare, about 6 seconds, major key. Trumpets and snare, bright, celebratory, ends on a strong final chord. No bass drop.
Exclude: vocals, lyrics, dubstep
Lyrics: [Instrumental]
[Short fanfare]
```

### 17. ניצחון על בוס
קובץ: `music/win-boss.ogg` · 10 עד 14 שניות

```
Style: Relief and triumph, about 12 seconds. A fanfare, then a gentle resolving string melody, soft chimes, ends on a bright major chord. Warm, emotional, for children.
Exclude: vocals, lyrics, dubstep, heavy drums
Lyrics: [Instrumental]
[Fanfare]
[Resolving strings and chimes]
```

---

## ד. רגעי סיפור (הוספתי)

### 18. הצלה והתאחדות
קובץ: `music/rescue.ogg` · 20 עד 25 שניות

האח בטחנה, הקוף הגדול במכרה, חבר הפטריות בבקתה, והרגע שבו הגיבור מזהה את אחיו. אפשר להשתמש באותו קטע לכולם.

```
Style: Warm heartfelt reunion theme, about 25 seconds, major key. Solo cello and piano first, then strings join, tender, hopeful, emotional. Ends with a gentle bell. No drums.
Exclude: vocals, lyrics, drums, dubstep
Lyrics: [Instrumental]
[Solo cello and piano]
[Strings join]
[Gentle bell ending]
```

### 19. הנבל הצעיר מופיע (סטינג)
קובץ: `music/villain-appear.ogg` · 4 עד 5 שניות

```
Style: Mischievous villain entrance sting, about 5 seconds. Sneaky pizzicato tiptoeing down a chromatic scale, a cymbal swish, a cheeky bassoon giggle at the end. Playful, not scary.
Exclude: vocals, lyrics, heavy drums, horror
Lyrics: [Instrumental]
[Short sting]
```

### 20. המארב: הצבע פוגע בגיבור (בטיסה לכוכב 3)
קובץ: `music/ambush.ogg` · 6 עד 8 שניות

```
Style: Dramatic surprise sting, about 8 seconds. A sudden orchestral hit, swirling strings, a magical paint-splash glissando on harp falling down, ends on an ominous low drone. Surprising but kid-friendly.
Exclude: vocals, lyrics, heavy metal, horror
Lyrics: [Instrumental]
[Sudden hit]
[Falling glissando]
[Low drone]
```

### 21. הסיום: הדרך הביתה
קובץ: `music/ending.ogg` · 80 עד 100 שניות · לא לולאה · סול מז'ור · 100 BPM

```
Style: Joyful finale, the rainbow road home, G major, 100 BPM. Starts with a solo music box playing the lantern motif (one long note, two short), builds into a full warm orchestra with strings, horns, harp and bells, a victorious yet nostalgic melody, gentle resolution at the end. Heartwarming, hopeful, for children.
Exclude: vocals, lyrics, dubstep, heavy drums
Lyrics: [Instrumental]
[Intro: music box]
[Theme: strings and harp]
[Build: horns and bells]
[Big theme]
[Gentle resolution]
```

---

## ה. מה עדיף בקוד

כלל אצבע: עד שנייה וחצי בקוד, מעל זה ב-Suno. הקוד חוסך משקל, עובד גם בלי טעינה, ואפשר להתאים אותו למפתח של הכוכב (`Audio.root`).

**כבר קיים ב-`Audio`:** קפיצה, נחיתה, מטבע, קפיצה על קפיץ, שיגור, לחיצה, שער, פגיעה בגיבור, שאגה, אש, פיצוץ, פגיעה בבוס, ניצחון. גם ארפג'יו הרקע הנוכחי כתוב בקוד, ולכן הוא יישאר מעין גיבוי כשאין קבצים.

**חסר, ואני מציע לכתוב בקוד:**

| קבוצה | צלילים |
|---|---|
| תנועה | קפיצה כפולה (גבוהה מעט מהראשונה), דאש (שאיפה ואז שחרור), פעימת לשון, התזת מים, יריקת דיו |
| אגרוף | הטענה של אגרוף העוצמה (סוויפ עולה), "מוכן" (נצנוץ), שחרור, סלע נסדק, סלע נשבר, הדף (פינג) |
| איסוף ומצב | לב חוזר (שני צלילים עולים), נקודת ביקורת (פעמון כפול), נפילה ללבה או לצבע, לב אובד |
| חידות | רמז (פעמון עדין אחד), בחירה שגויה (שני צלילי עץ יורדים, בלי חומרה), ידית, מתג (טקטוק), גשר או בקתה מזויפים (קילוף צבע, רעש שנעלם), פנס נדלק (נצנוץ חם), פעמון המעבורת, חידה נפתרה בצורתה הקצרה (ארפג'יו קצר של 4 צלילים) |
| אויבים | חיפושית מזהה (קיים), נתקעת (קלונק), קוף צורח, אבן מתגלגלת (רעש נמוך ברצף), דיונון מתנפח, פיראנה נושכת, אויב נעלם (פופ) |
| בוסים | התכוננות לחבטה (סוויפ עולה), גל הלם, כוכבים מסתובבים (טרילר), טבעת אש (רעש מקפצץ), כלוב נסדק, כלוב נפתח (חריקה ופעמון) |
| אווירה | רוח (רעש עם LFO איטי), טפטוף ורעם נמוך במכרה, בועות וצפרדעים בביצה, לבה מבעבעת בכבשן, צרצרים בלילה |
| ממשק | הפסקה, חזרה, בחירת כוכב |

האווירה עושה הכי הרבה הבדל בקלות. שכבה של רעש מסונן ששקט בזיכרון תתן לכל כוכב אופי, בלי קובץ אחד.

## גודל וסדר עבודה

21 הקטעים כאן הם בערך 20 דקות. ב-96 kbps זה בסביבות 15 מגה-בייט. כדי לא להכביד, אפשר להתחיל ב-12 קטעים: 1 עד 5, 7 עד 9, 12, 13, 14 ו-21. השאר נוסיף אחרי שמשה ישחק.

סדר מומלץ: קודם קטעי הכוכבים (2 עד 5), אחר כך החידות (7 עד 9), אחר כך הקרבות, ובסוף רגעי הסיפור.

אחרי שהקבצים מוכנים, הצעד הבא הוא לחבר אותם ל-`Audio`: טעינה, לולאה בלי חריץ, מעבר חלק בין קטעים (crossfade), הנמכת הרקע בחידות וחזרה לארפג'יו אם הקובץ חסר. את זה אפשר לעשות בענף נפרד ולהוסיף בדיקה ל-`tools`.
