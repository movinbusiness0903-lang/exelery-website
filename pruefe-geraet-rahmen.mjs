// Waechter: haelt das Geraetefoto und das CSS zusammen.
//
// ─── Warum es diesen Waechter gibt ─────────────────────────────────────────
//
// Seit dem 04.11.2026 liegt im Startbereich und in der Sticky-Szene ein
// echtes Geraetefoto mit DURCHSICHTIGEM Glas ueber den App-Aufnahmen
// (`media/web/geraet-rahmen.webp`). Wo dieses Glas sitzt, steht an zwei
// Orten: in `geraet-rahmen.json` (vom Bauskript erzeugt) und als CSS-
// Variablen in `index.html` (vom Browser benutzt).
//
// ⚠️ ZWEI STELLEN FUER EINE ZAHL SIND DER FEHLER, der Vergleich ist nur der
//    Waechter davor. Genau dieser Fehler kostete am 03.11. zwei Runden am
//    Logo des Ankuendigungs-Posts: der Riegel rechnete mit 170 Pixeln,
//    gezeichnet wurden 52, und er meldete trotzdem gruen — weil er den
//    gemerkten Wert prueft und nicht das Bild.
//
//    Hier laesst sich die Doppelung nicht aufloesen (CSS kann keine JSON-
//    Datei lesen, und die Werte muessen vor dem Laden feststehen). Also
//    wird sie wenigstens bewacht: laeuft die Vorlage auseinander, bricht
//    dieser Waechter ab, statt dass die App schief im Gehaeuse sitzt.
//
// Geprueft wird ausserdem, dass die ALTEN festen Werte verschwunden sind.
// Das Seitenverhaeltnis stand bis zum 04.11. viermal in index.html, zweimal
// als `1290/2616` und zweimal als `.4931`.
//
// Aufruf: node pruefe-geraet-rahmen.mjs
//         node pruefe-geraet-rahmen.mjs --gegenprobe

import { readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
// ⚠️ `url.pathname` liefert den Pfad PROZENTKODIERT: aus „Fitness App" wird
//    „Fitness%20App", und sharp sucht danach eine Datei, die es nicht gibt.
//    `fileURLToPath` ist der einzige richtige Weg von einer URL zum Pfad.
import { fileURLToPath } from 'node:url';

const HTML_DATEI = new URL('./index.html', import.meta.url);
const JSON_DATEI = new URL('./media/web/geraet-rahmen.json', import.meta.url);
const BILD = new URL('./media/web/geraet-rahmen.webp', import.meta.url);
const GEGENPROBE = process.argv.includes('--gegenprobe');

/** Wie weit duerfen CSS und JSON auseinanderliegen? Die CSS-Werte sind auf
 *  drei Nachkommastellen gerundet, mehr als 0,01 Prozentpunkte kann also
 *  nicht aus dem Runden kommen. */
const TOLERANZ = 0.01;

function variable(html, name) {
  const m = html.match(new RegExp(`--${name}\\s*:\\s*([0-9.]+)%?\\s*;`));
  if (!m) throw new Error(`Die CSS-Variable --${name} steht nicht in index.html.`);
  return Number(m[1]);
}

function bildmasse(pfad) {
  const aus = execFileSync(process.execPath, ['-e',
    `const s=require('sharp');s(${JSON.stringify(pfad)}).metadata().then(m=>console.log(m.width+' '+m.height+' '+m.hasAlpha))`,
  ], { encoding: 'utf8', cwd: 'C:/Users/Kevin/Fitness App/Exelery' });
  const [b, h, alpha] = aus.trim().split(' ');
  return { b: Number(b), h: Number(h), alpha: alpha === 'true' };
}

function pruefen(html) {
  const fehler = [];

  if (!existsSync(JSON_DATEI)) {
    fehler.push('media/web/geraet-rahmen.json fehlt. Erzeugt wird sie von '
      + 'planung/social/web-geraete-bauen.mjs im App-Repo.');
    return fehler;
  }
  const geo = JSON.parse(readFileSync(JSON_DATEI, 'utf8'));

  // 1. Die fuenf Zahlen muessen uebereinstimmen.
  const paare = [
    ['geraet-verh', geo.seitenverhaeltnis, 'Seitenverhaeltnis des Geraets'],
    ['glas-links', geo.glas.links, 'Glas von links'],
    ['glas-oben', geo.glas.oben, 'Glas von oben'],
    ['glas-breit', geo.glas.breite, 'Glasbreite'],
    ['glas-hoch', geo.glas.hoch, 'Glashoehe'],
  ];
  for (const [name, soll, klartext] of paare) {
    let ist;
    try { ist = variable(html, name); } catch (e) { fehler.push(e.message); continue; }
    if (Math.abs(ist - soll) > TOLERANZ) {
      fehler.push(`${klartext}: das CSS sagt ${ist}, das Bild sagt ${soll}. `
        + 'Die App saesse schief im Gehaeuse.');
    }
  }

  // 1b. Die Rundung des Glases. Sie steht als Paar da („10.41% / 5.14%"),
  //     weil das Glas hoch und schmal ist: ein einzelner Prozentwert ergaebe
  //     oben eine andere Rundung als an der Seite.
  {
    const m = html.match(/--glas-rund\s*:\s*([0-9.]+)%\s*\/\s*([0-9.]+)%\s*;/);
    if (!m) {
      fehler.push('Die CSS-Variable --glas-rund fehlt oder steht nicht als '
        + 'Paar „X% / Y%" da.');
    } else {
      const glasBreitePx = geo.bild.breite * geo.glas.breite / 100;
      const glasHochPx = geo.bild.hoch * geo.glas.hoch / 100;
      const radiusPx = geo.glas.radiusProzent / 100 * geo.bild.breite;
      const sollX = radiusPx / glasBreitePx * 100;
      const sollY = radiusPx / glasHochPx * 100;
      if (Math.abs(Number(m[1]) - sollX) > 0.1 || Math.abs(Number(m[2]) - sollY) > 0.1) {
        fehler.push(`Glasrundung: das CSS sagt ${m[1]}% / ${m[2]}%, aus dem Bild `
          + `folgen ${sollX.toFixed(2)}% / ${sollY.toFixed(2)}%.`);
      }
    }
    if (!html.includes('var(--glas-rund)')) {
      fehler.push('--glas-rund wird nirgends mit var(--glas-rund) gelesen.');
    }
  }

  // 2. Das Bild muss da sein, Alpha haben und zum Verhaeltnis passen.
  if (!existsSync(BILD)) {
    fehler.push('media/web/geraet-rahmen.webp fehlt — dann steht im '
      + 'Startbereich gar kein Geraet.');
  } else {
    const m = bildmasse(fileURLToPath(BILD));
    if (!m.alpha) {
      fehler.push('geraet-rahmen.webp hat keinen Alphakanal. Ohne ihn ist das '
        + 'Glas nicht durchsichtig und verdeckt die App-Aufnahme vollstaendig.');
    }
    const verh = m.b / m.h;
    if (Math.abs(verh - geo.seitenverhaeltnis) > 0.002) {
      fehler.push(`Das Bild misst ${m.b} x ${m.h} (Verhaeltnis ${verh.toFixed(5)}), `
        + `die JSON sagt ${geo.seitenverhaeltnis}. Eines von beiden ist alt.`);
    }
    if (m.b !== geo.bild.breite || m.h !== geo.bild.hoch) {
      fehler.push(`Das Bild misst ${m.b} x ${m.h}, die JSON nennt `
        + `${geo.bild.breite} x ${geo.bild.hoch}.`);
    }
  }

  // 3. Die alten festen Werte duerfen nicht zurueckkommen.
  //    Der Kommentarblock, der sie als Geschichte nennt, wird ausgenommen:
  //    er steht in einem /* … */ und nennt sie in einem Satz, nicht als Wert.
  const ohneKommentare = html.replace(/\/\*[\s\S]*?\*\//g, '');
  for (const alt of ['1290/2616', '.4931']) {
    if (ohneKommentare.includes(alt)) {
      fehler.push(`Der feste Wert "${alt}" steht wieder im CSS. Das `
        + 'Seitenverhaeltnis gehoert an EINE Stelle: --geraet-verh.');
    }
  }

  // 4. Die Variablen muessen auch benutzt werden. Eine Variable, die
  //    niemand liest, ist kein Gleichstand, sondern eine Attrappe.
  for (const name of ['geraet-verh', 'glas-links', 'glas-oben', 'glas-breit', 'glas-hoch']) {
    if (!html.includes(`var(--${name})`)) {
      fehler.push(`--${name} wird nirgends mit var(--${name}) gelesen.`);
    }
  }

  return fehler;
}

const html = readFileSync(HTML_DATEI, 'utf8');

if (!GEGENPROBE) {
  const fehler = pruefen(html);
  console.log('');
  if (fehler.length) {
    for (const f of fehler) console.log(`  ROT  ${f}`);
    console.log('');
    process.exit(1);
  }
  console.log('  Geraeterahmen: CSS und Bild stimmen ueberein.');
  console.log('');
  process.exit(0);
}

// ── Gegenprobe: jede Sabotage MUSS rot werden ──────────────────────────────
const sabotagen = [
  ['Glaslage um 2 Prozentpunkte verschoben',
    (h) => h.replace(/--glas-links:[0-9.]+%;/, '--glas-links:9.51%;')],
  ['Seitenverhaeltnis auf den alten Wert zurueck',
    (h) => h.replace(/--geraet-verh:[0-9.]+;/, '--geraet-verh:0.4931;')],
  ['Glasrundung halbiert (Geraet saehe aus wie ein Brett)',
    (h) => h.replace(/--glas-rund:[0-9.]+% \/ [0-9.]+%;/, '--glas-rund:5.2% / 2.6%;')],
  ['Fester Wert .4931 wieder im CSS',
    (h) => h.replace('aspect-ratio:var(--geraet-verh);', 'aspect-ratio:.4931;')],
  ['Variable da, aber nirgends gelesen',
    (h) => h.replace(/var\(--glas-hoch\)/g, '93.9%')],
];

console.log('');
let alleRot = true;
for (const [was, kaputt] of sabotagen) {
  const fehler = pruefen(kaputt(html));
  const rot = fehler.length > 0;
  if (!rot) alleRot = false;
  console.log(`  ${rot ? 'rot   ' : 'GRUEN '} ${was}`);
  if (rot) console.log(`         → ${fehler[0]}`);
}
console.log('');
if (!alleRot) {
  console.log('  Mindestens eine Sabotage blieb gruen — der Waechter misst nicht.');
  console.log('');
  process.exit(1);
}
console.log(`  Alle ${sabotagen.length} Sabotagen wurden rot.`);
console.log('');
