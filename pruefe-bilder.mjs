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

function pruefen(html, lesen, leise) {
  const fehler = [];
  const stellen = [...html.matchAll(/<img src="media\/web\/([a-z-]+)\.webp"([^>]*)>/g)].filter((m) => m[1] !== 'dayone-abzeichen');
  if (stellen.length !== 12) fehler.push(`12 Bild-Stellen erwartet, gefunden ${stellen.length}`);
  const gesehen = new Set();
  for (const [, name, rest] of stellen) {
    const srcset = (rest.match(/srcset="([^"]*)"/) || [])[1] || '';
    if (srcset !== `media/web/${name}.webp 640w, media/web/${name}-1290.webp 1290w`) fehler.push(`${name}: srcset fehlt oder falsch („${srcset}")`);
    if (!/sizes="[^"]+"/.test(rest)) fehler.push(`${name}: sizes fehlt`);
    const w = Number((rest.match(/width="(\d+)"/) || [])[1]);
    const h = Number((rest.match(/height="(\d+)"/) || [])[1]);
    if (!w || !h || Math.abs(w / h - GROSS[0] / GROSS[1]) > 0.002) fehler.push(`${name}: width/height ${w}x${h} passt nicht zum Bild`);
    gesehen.add(name);
  }
  for (const name of gesehen) {
    for (const [datei, soll] of [[`media/web/${name}.webp`, KLEIN], [`media/web/${name}-1290.webp`, GROSS]]) {
      const buf = lesen(datei);
      if (!buf) { fehler.push(`${datei} fehlt`); continue; }
      const m = webpMasse(buf);
      if (!m || m[0] !== soll[0] || m[1] !== soll[1]) fehler.push(`${datei}: ${m ? m.join('x') : 'kein WebP'} statt ${soll.join('x')}`);
    }
  }
  if (!leise) {
    console.log(`${stellen.length} Bild-Stellen, ${gesehen.size} Bilder je 640 + 1290 px`);
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

const GEGENPROBEN = [
  ['eine Stelle ohne srcset', HTML.replace(/ srcset="media\/web\/training\.webp 640w, media\/web\/training-1290\.webp 1290w"/, ''), echtLesen],
  ['grosse Fassung fehlt', HTML, (d) => (d === 'media/web/abzeichen-1290.webp' ? null : echtLesen(d))],
  ['grosse Fassung nur 640 px', HTML, (d) => (d === 'media/web/gewicht-1290.webp' ? echtLesen('media/web/gewicht.webp') : echtLesen(d))],
  ['falsches Seitenverhaeltnis im HTML', HTML.replace('width="640" height="1298"', 'width="640" height="1400"'), echtLesen],
];
for (const [was, html, lesen] of GEGENPROBEN) {
  if (html === HTML && lesen === echtLesen) { console.log(`FEHLER Gegenprobe „${was}" liess sich nicht einschleusen`); rot = true; continue; }
  const erkannt = !pruefen(html, lesen, true);
  if (!erkannt) rot = true;
  console.log(erkannt ? `ok   Gegenprobe „${was}" wird erkannt` : `FEHLER Gegenprobe „${was}" blieb unentdeckt`);
}

console.log(rot ? '\nROT' : '\nGRUEN');
process.exit(rot ? 1 : 0);
