/**
 * Baut die Ladevorschauen („LQIP") fuer alle Geraete-Bilder und traegt sie
 * in index.html ein. Idempotent: ein zweiter Lauf aendert nichts.
 *
 * ── Warum es das gibt ────────────────────────────────────────────────
 * Kevin am 04.11.2026, mit zwei Aufnahmen: „die bilder laden nicht direkt,
 * teilweise handy mit blackscreen abgebildet oder es fehlt komplett. Erst
 * nach paar Sekunden laden kommt es dann. Es muss wie vorher direkt sein.
 * Oben bei der scrollanimation ganz am anfang hat das handy oft blackscreen
 * am anfang beim neuladen. Wie bei Moritz auf android auch."
 *
 * GEMESSEN, bevor etwas geaendert wurde (390 px, schnelles 3G):
 *
 *      500 ms   Screen FEHLT   Rahmen FEHLT
 *     1500 ms   Screen FEHLT   Rahmen DA      <- schwarzes Glas, Kevins Bild
 *     3000 ms   Screen FEHLT   Rahmen DA
 *     5000 ms   Screen DA      Rahmen DA
 *
 * Das Glas ist `#05070C` (`.phone-device::before`), damit man beim Wechsel
 * der Aufnahmen nicht die Seite durchscheinen sieht. Solange kein Bild da
 * ist, IST dieses Glas die Abbildung — ein schwarzer Klotz im Gehaeuse.
 *
 * ⚠️ Priorisieren allein reicht nicht. Selbst mit `fetchpriority="high"`
 *    braucht ein 107-KB-Bild auf echtem Mobilfunk ueber eine Sekunde. In
 *    dieser Sekunde muss etwas anderes dort stehen als Schwarz.
 *
 * ── Was eine Ladevorschau ist ────────────────────────────────────────
 * Dasselbe Bild auf 20 px Breite heruntergerechnet, rund 400 Byte gross,
 * als `data:`-Adresse direkt im CSS. Es braucht keine eigene Anfrage und
 * steht deshalb mit dem ersten Bildaufbau da — unscharf, aber in den
 * richtigen Farben. Das scharfe Bild legt sich darueber, sobald es kommt.
 *
 * Die Sicherheits-Kopfzeile erlaubt das ausdruecklich: `img-src 'self' data:`.
 *
 * Aufruf: node ladebilder-bauen.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';

// sharp liegt im App-Repo, nicht hier. `createRequire` loest ab DIESEM
// Pfad auf, nicht ab dem Arbeitsverzeichnis — anders als ein ESM-Import.
const require = createRequire('C:/Users/Kevin/Fitness App/Exelery/package.json');
const sharp = require('sharp');

const WURZEL = 'C:/Users/Kevin/Fitness App/exelery-website';
const DATEI = `${WURZEL}/index.html`;

/* Die Aufnahmen in der Telefon-Szene und im Startbereich: dort liegt das
   Geraet als Ebene DARUEBER, die Vorschau deckt also nur das Glas. */
const SCREENS = ['ernaehrung-pm', 'gewicht-pm', 'einkauf-sheet-pm', 'training-pm', 'abzeichen-pm'];
/* Die Kapitelbilder: dort ist das Geraet im Bild, die Vorschau zeigt es mit. */
const RAHMEN = ['ernaehrung-geraet', 'gewicht-geraet', 'logbuch-geraet', 'training-geraet', 'abzeichen-geraet'];

const VORSCHAU_BREIT = 20;

/* ── Kapitelbilder: die Vorschau gehoert INS GLAS, nicht hinters Geraet ──
   Kevin, 12.11.2026: die Handys wirken am Rechner verwaschen, „mit einem
   Dunst ums Geraet".

   Bis heute war die Vorschau eines Kapitelbildes das GANZE Bild auf 20 px,
   MIT Alphakanal, per `background-size:contain` auf Geraetegroesse gezogen.
   Das scharfe Bild deckt sie nur dort zu, wo es selbst deckt — das Geraet ist
   aussen aber durchsichtig. Beim Hochziehen verschmiert die Alphakante der
   Vorschau um gut eine Vorschau-Zeile (rund 15 px), und genau diese
   Verschmierung lag als grauer Schleier ums Gehaeuse: gemessen 3 bis 9
   Helligkeitsstufen Aufhellung direkt neben dem Rand (pruefe-geraet-schaerfe).

   Jetzt: nur die GLASFLAECHE, deckend auf Glasschwarz, und per
   background-size/-position genau auf das Glas gelegt. Ihre Ecken liegen
   unter der deckenden Einfassung; ausserhalb des Geraets steht nichts mehr.
   Die Lage des Glases kommt aus derselben Datei wie im CSS
   (geraet-rahmen.json), nicht aus einer zweiten Abschrift. */
const GEO = JSON.parse(readFileSync(`${WURZEL}/media/web/geraet-rahmen.json`, 'utf8'));
const G = GEO.glas;
const runde = (z) => Number(z.toFixed(3));
/* background-position in Prozent heisst: (Kasten - Bild) * p. Damit die
   Vorschau bei G.links beginnt: p = links / (100 - breite). */
const LAGE_X = runde((G.links / (100 - G.breite)) * 100);
const LAGE_Y = runde((G.oben / (100 - G.hoch)) * 100);

/** Ein Bild auf 20 px herunterrechnen und als data:-Adresse zurueckgeben.
 *  `nurGlas`: nur die Glasflaeche, deckend (Kapitelbilder, siehe oben). */
async function vorschau(name, nurGlas = false) {
  const quelle = `${WURZEL}/media/web/${name}.webp`;
  let bild = sharp(quelle);
  if (nurGlas) {
    const { width: b, height: h } = await sharp(quelle).metadata();
    bild = sharp(quelle)
      .extract({
        left: Math.round((b * G.links) / 100), top: Math.round((h * G.oben) / 100),
        width: Math.round((b * G.breite) / 100), height: Math.round((h * G.hoch) / 100),
      })
      .flatten({ background: '#05070C' });
  }
  const puffer = await bild
    .resize({ width: VORSCHAU_BREIT })
    // Geringe Qualitaet ist hier richtig: das Bild wird ohnehin auf das
    // Zwanzigfache gezogen, jedes Detail waere verschwendete Groesse.
    .webp({ quality: 40, alphaQuality: 60, effort: 6 })
    .toBuffer();
  return { daten: `data:image/webp;base64,${puffer.toString('base64')}`, bytes: puffer.length };
}

const ANFANG = '  /* LADEVORSCHAU-ANFANG — erzeugt von ladebilder-bauen.mjs, nicht von Hand aendern */';
const ENDE = '  /* LADEVORSCHAU-ENDE */';

let text = readFileSync(DATEI, 'utf8');
const vorher = text;
const zeilen = [];
let summe = 0;

for (const name of SCREENS) {
  const { daten, bytes } = await vorschau(name);
  summe += bytes;
  zeilen.push(`  .phone-screen[data-v="${name}"]{background-image:url('${daten}');}`);
}
for (const name of RAHMEN) {
  const { daten, bytes } = await vorschau(name, true);
  summe += bytes;
  zeilen.push(`  .shot-frame[data-v="${name}"]{background-image:url('${daten}');}`);
}

const block = [
  ANFANG,
  '  /* Die Vorschau liegt HINTER dem Bild, nicht darin: sobald das scharfe',
  '     Bild da ist, deckt es sie vollstaendig zu. Kein Umschalten noetig,',
  '     also auch kein Flackern und keine Zeile JavaScript. */',
  '  .phone-screen{background-size:cover;background-position:center;border-radius:var(--glas-rund);}',
  '  /* Kapitelbilder: nur das Glas, deckend, genau aufs Glas gelegt — nichts',
  '     davon reicht ueber das Gehaeuse hinaus (ladebilder-bauen.mjs, 12.11.). */',
  `  .shot-frame{background-size:${G.breite}% ${G.hoch}%;background-position:${LAGE_X}% ${LAGE_Y}%;background-repeat:no-repeat;}`,
  ...zeilen,
  ENDE,
].join('\n');

// 1. Den Block setzen oder ersetzen.
if (text.includes(ANFANG)) {
  const a = text.indexOf(ANFANG);
  const e = text.indexOf(ENDE) + ENDE.length;
  text = text.slice(0, a) + block + text.slice(e);
} else {
  // Direkt vor den Fortschrittspunkten der Telefon-Szene einhaengen.
  const anker = '  .phone-progress{';
  if (!text.includes(anker)) throw new Error('Anker .phone-progress nicht gefunden');
  text = text.replace(anker, `${block}\n${anker}`);
}

// 2. Jedem Container sein `data-v` geben. Das Muster trifft beide Zustaende,
//    damit ein zweiter Lauf nichts verdoppelt.
let getroffen = 0;
for (const name of [...SCREENS, ...RAHMEN]) {
  const klasse = SCREENS.includes(name) ? 'phone-screen' : 'shot-frame';
  const muster = new RegExp(
    `<div class="(${klasse}[^"]*)"(?: data-v="[^"]*")?><img src="media/web/${name}\\.webp"`,
    'g',
  );
  const neu = text.replace(muster, (_m, k) => `<div class="${k}" data-v="${name}"><img src="media/web/${name}.webp"`);
  if (neu !== text) getroffen++;
  text = neu;
}

if (text !== vorher) writeFileSync(DATEI, text, 'utf8');

console.log(`Ladevorschauen: ${SCREENS.length + RAHMEN.length} Bilder, ${(summe / 1024).toFixed(1)} KB im HTML`);
console.log(`Container mit data-v versehen: ${getroffen} von ${SCREENS.length + RAHMEN.length} Namen`);
console.log(text === vorher ? 'index.html unveraendert (schon aktuell)' : 'index.html geschrieben');
