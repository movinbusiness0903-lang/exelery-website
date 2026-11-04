// Prueft die App-Bilder der Startseite (media/web/NAME.webp).
//
// Kevin, 17.09.2026: „die neuen Bilder wirken ein bisschen unscharf". Sie waren
// nur 640 px breit; ein iPhone (3x) braucht fuer das Handy rund 700 px, ein
// Retina-Rechner bis 800. Seitdem hat jedes Bild zwei Fassungen:
//   NAME.webp       640 x 1298   normale Bildschirme
//   NAME-1290.webp  1290 x 2616  hochaufloesende Bildschirme (volle Aufloesung)
// und im HTML srcset + sizes. Geprueft wird: jede Bild-Stelle hat beide Fassungen,
// beide Dateien gibt es, Groesse und Seitenverhaeltnis stimmen, width/height im
// HTML passen zum Seitenverhaeltnis (sonst springt beim Laden das Layout).
//
// Aufruf: node pruefe-bilder.mjs

import { readFileSync, existsSync } from 'node:fs';

const HTML = readFileSync(new URL('./index.html', import.meta.url), 'utf8');
const KLEIN = [640, 1298];
const GROSS = [1290, 2616];

/** Breite und Hoehe aus dem WebP-Kopf (VP8, VP8L, VP8X). */
function webpMasse(buf) {
  if (buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WEBP') return null;
  const art = buf.toString('ascii', 12, 16);
  if (art === 'VP8 ') return [buf.readUInt16LE(26) & 0x3fff, buf.readUInt16LE(28) & 0x3fff];
  if (art === 'VP8L') {
    const b = buf.readUInt32LE(21);
    return [(b & 0x3fff) + 1, ((b >> 14) & 0x3fff) + 1];
  }
  if (art === 'VP8X') return [buf.readUIntLE(24, 3) + 1, buf.readUIntLE(27, 3) + 1];
  return null;
}

/**
 * ⚠️ 03.11.2026 — DIESER PRUEFER ERWARTETE FESTE ZAHLEN, UND DAS WAR EIN
 *    FEHLER IN IHM, NICHT IM HTML.
 *
 *    Er verlangte woertlich „… 640w, …-1290.webp 1290w" und die Masse
 *    KLEIN/GROSS. Das hielt, solange jede Aufnahme ein nackter Screenshot im
 *    immer gleichen Format war. Seit die Kapitel-Aufnahmen in einem
 *    freigestellten Geraet stecken (740 x 1871 statt 1290 x 2616), meldete er
 *    fuenf Treffer — obwohl an den Bildern nichts falsch war.
 *
 *    Was er WIRKLICH sichern soll, ist nicht „die Zahl ist 1290", sondern:
 *      * jede Stelle hat beide Fassungen, und beide Dateien gibt es,
 *      * die Breitenangaben im srcset stimmen mit den ECHTEN Dateien,
 *      * width/height im HTML passen zum Seitenverhaeltnis der Datei,
 *      * die grosse Fassung ist wirklich breiter als die kleine.
 *
 *    So gemessen faengt er MEHR als vorher: eine falsche Breitenangabe bei
 *    den alten Bildern waere ihm bisher entgangen, weil er 1290 nur mit 1290
 *    verglichen hat und nie mit der Datei.
 */
function pruefen(html, lesen, leise) {
  const fehler = [];
  const stellen = [...html.matchAll(/<img src="media\/web\/([a-z-]+)\.webp"([^>]*)>/g)].filter((m) => m[1] !== 'dayone-abzeichen');
  if (stellen.length !== 12) fehler.push(`12 Bild-Stellen erwartet, gefunden ${stellen.length}`);
  const gesehen = new Set();

  const masseVon = (datei) => {
    const buf = lesen(datei);
    return buf ? webpMasse(buf) : null;
  };

  for (const [, name, rest] of stellen) {
    gesehen.add(name);
    const kleinDatei = `media/web/${name}.webp`;
    const grossDatei = `media/web/${name}-1290.webp`;
    const mK = masseVon(kleinDatei);
    const mG = masseVon(grossDatei);
    if (!mK) { fehler.push(`${kleinDatei} fehlt oder ist kein WebP`); continue; }
    if (!mG) { fehler.push(`${grossDatei} fehlt oder ist kein WebP`); continue; }

    const srcset = (rest.match(/srcset="([^"]*)"/) || [])[1] || '';
    const soll = `${kleinDatei} ${mK[0]}w, ${grossDatei} ${mG[0]}w`;
    if (srcset !== soll) {
      fehler.push(`${name}: srcset nennt nicht die echten Breiten. `
        + `steht „${srcset}", soll „${soll}"`);
    }
    if (!/sizes="[^"]+"/.test(rest)) fehler.push(`${name}: sizes fehlt`);

    const w = Number((rest.match(/width="(\d+)"/) || [])[1]);
    const h = Number((rest.match(/height="(\d+)"/) || [])[1]);
    if (!w || !h || Math.abs(w / h - mK[0] / mK[1]) > 0.004) {
      fehler.push(`${name}: width/height ${w}x${h} passt nicht zur Datei (${mK.join('x')})`);
    }
    if (mG[0] <= mK[0]) {
      fehler.push(`${name}: die grosse Fassung (${mG[0]} px) ist nicht breiter `
        + `als die kleine (${mK[0]} px)`);
    }
  }
  if (!leise) {
    console.log(`${stellen.length} Bild-Stellen, ${gesehen.size} Bilder je in zwei Fassungen`);
    for (const f of fehler) console.log('FEHLER', f);
    if (!fehler.length) console.log('ok   alle Stellen mit beiden Fassungen, Dateien und Masse stimmen');
  }
  return fehler.length === 0;
}

const echtLesen = (datei) => {
  const url = new URL('./' + datei, import.meta.url);
  return existsSync(url) ? readFileSync(url) : null;
};

let rot = !pruefen(HTML, echtLesen, false);

// ⚠️ DIE SABOTAGEN LESEN IHRE ZIELE AUS DEM HTML, sie nennen keine
//    Dateinamen mehr. Am 04.11.2026 standen hier „training.webp",
//    „abzeichen-1290.webp" und „width=640 height=1298" fest eingetragen —
//    und als die Bilder auf `-pm` und `-geraet` umgestellt wurden, traf
//    keine einzige Sabotage mehr. Der Waechter hat das gemeldet („liess
//    sich nicht einschleusen") statt still gruen zu bleiben, und genau
//    dafuer steht die Zeile 113. Aber eine Gegenprobe, die bei jeder
//    Umbenennung nachgezogen werden muss, wird irgendwann nicht nachgezogen.
const ersteStelle = HTML.match(/<img src="media\/web\/([a-z-]+)\.webp"[^>]*srcset="([^"]*)"[^>]*width="(\d+)" height="(\d+)"/);
if (!ersteStelle) throw new Error('Keine Bild-Stelle mit srcset und Massen gefunden.');
const [, einName, einSrcset, einW, einH] = ersteStelle;
const einGross = `media/web/${einName}-1290.webp`;

const GEGENPROBEN = [
  ['eine Stelle ohne srcset', HTML.replace(` srcset="${einSrcset}"`, ''), echtLesen],
  ['grosse Fassung fehlt', HTML, (d) => (d === einGross ? null : echtLesen(d))],
  ['grosse Fassung so klein wie die kleine', HTML,
    (d) => (d === einGross ? echtLesen(`media/web/${einName}.webp`) : echtLesen(d))],
  ['falsches Seitenverhaeltnis im HTML',
    HTML.replace(`width="${einW}" height="${einH}"`, `width="${einW}" height="${Number(einH) + 110}"`),
    echtLesen],
];
for (const [was, html, lesen] of GEGENPROBEN) {
  if (html === HTML && lesen === echtLesen) { console.log(`FEHLER Gegenprobe „${was}" liess sich nicht einschleusen`); rot = true; continue; }
  const erkannt = !pruefen(html, lesen, true);
  if (!erkannt) rot = true;
  console.log(erkannt ? `ok   Gegenprobe „${was}" wird erkannt` : `FEHLER Gegenprobe „${was}" blieb unentdeckt`);
}

console.log(rot ? '\nROT' : '\nGRUEN');
process.exit(rot ? 1 : 0);
