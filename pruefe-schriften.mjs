// Prueft, dass die Schriften lokal liegen und keine Seite sie bei Google holt.
//
// Kevin, 25.09.2026: Die Startseite lud Manrope und Inter von
// fonts.googleapis.com. Damit ging die IP jedes Besuchers an Google, bevor er
// etwas angeklickt hatte. Seitdem liegen beide Schriften in media/fonts/ und
// werden per @font-face eingebunden.
//
// Geprueft wird:
//   1. Keine HTML-Datei (ausser unter /dev/, das ist ein Expo-Export) nennt
//      Googles Schriften-Dienst.
//   2. Jede @font-face-Regel zeigt auf eine Datei, die es wirklich gibt.
//   3. Jede Regel hat font-display:swap und eine unicode-range.
//   4. Die vorgeladenen Schriften werden auch von einer Regel benutzt.
//   5. Die Lizenztexte liegen bei den Schriften (die SIL OFL verlangt das).
//
// Aufruf: node pruefe-schriften.mjs

import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const WURZEL = dirname(fileURLToPath(import.meta.url));
const GOOGLE = /fonts\.googleapis\.com|fonts\.gstatic\.com/;

/** Alle HTML-Dateien ausser denen unter /dev/. */
function htmlDateien(ordner = WURZEL, gesammelt = []) {
  for (const eintrag of readdirSync(ordner)) {
    if (eintrag.startsWith('.') || eintrag === 'node_modules' || eintrag === 'dev') continue;
    const pfad = join(ordner, eintrag);
    if (statSync(pfad).isDirectory()) htmlDateien(pfad, gesammelt);
    else if (eintrag.endsWith('.html')) gesammelt.push(pfad);
  }
  return gesammelt;
}

function pruefen(seiten, gibtEs, leise) {
  const fehler = [];

  // 1 · Niemand holt Schriften bei Google
  for (const [pfad, html] of seiten) {
    for (const [nr, zeile] of html.split('\n').entries()) {
      if (GOOGLE.test(zeile)) fehler.push(`${relative(WURZEL, pfad)}:${nr + 1} holt Schriften bei Google`);
    }
  }

  // 2-4 · Die Regeln der Startseite
  const start = seiten.find(([p]) => p === join(WURZEL, 'index.html'));
  if (!start) fehler.push('index.html nicht gefunden');
  else {
    const html = start[1];
    const regeln = [...html.matchAll(/@font-face\{([^}]*)\}/g)].map((m) => m[1]);
    if (regeln.length === 0) fehler.push('index.html hat keine @font-face-Regel');
    const benutzt = new Set();
    for (const regel of regeln) {
      const familie = (regel.match(/font-family:\s*'([^']+)'/) || [])[1] || '?';
      const gewicht = (regel.match(/font-weight:\s*(\d+)/) || [])[1] || '?';
      const quelle = (regel.match(/src:\s*url\(([^)]+)\)/) || [])[1];
      const wer = `${familie} ${gewicht}`;
      if (!quelle) { fehler.push(`${wer}: keine Quelle`); continue; }
      benutzt.add(quelle);
      if (!gibtEs(quelle)) fehler.push(`${wer}: Datei fehlt (${quelle})`);
      if (!/font-display:\s*swap/.test(regel)) fehler.push(`${wer}: font-display:swap fehlt`);
      if (!/unicode-range:/.test(regel)) fehler.push(`${wer}: unicode-range fehlt`);
    }
    // 4 · Vorgeladenes muss auch benutzt werden, sonst laedt der Browser umsonst
    for (const m of html.matchAll(/rel="preload" as="font"[^>]*href="([^"]+)"/g)) {
      if (!benutzt.has(m[1])) fehler.push(`vorgeladen, aber von keiner Regel benutzt: ${m[1]}`);
      if (!gibtEs(m[1])) fehler.push(`vorgeladen, aber Datei fehlt: ${m[1]}`);
    }
  }

  // 5 · Lizenzen
  for (const lizenz of ['media/fonts/OFL-Manrope.txt', 'media/fonts/OFL-Inter.txt']) {
    if (!gibtEs(lizenz)) fehler.push(`Lizenztext fehlt: ${lizenz}`);
  }

  if (!leise) {
    if (fehler.length === 0) {
      const anzahl = seiten.length;
      console.log(`ok   ${anzahl} Seiten ohne Google-Schriften, alle @font-face-Regeln zeigen auf vorhandene Dateien`);
    } else fehler.forEach((f) => console.log(`FEHLER ${f}`));
  }
  return fehler.length === 0;
}

const echtGibtEs = (p) => existsSync(join(WURZEL, p));
const seiten = htmlDateien().map((p) => [p, readFileSync(p, 'utf8')]);

let rot = !pruefen(seiten, echtGibtEs, false);

const GEGENPROBEN = [
  ['eine Seite holt wieder bei Google',
    seiten.map(([p, h]) => (p.endsWith('index.html') ? [p, h.replace('<style>', '<link href="https://fonts.googleapis.com/css2?family=Manrope" rel="stylesheet">\n<style>')] : [p, h])),
    echtGibtEs],
  ['eine Schriftdatei fehlt',
    seiten,
    (p) => (p === 'media/fonts/manrope-latin.woff2' ? false : echtGibtEs(p))],
  ['font-display:swap entfernt',
    seiten.map(([p, h]) => [p, p.endsWith('index.html') ? h.replace('font-display:swap;', '') : h]),
    echtGibtEs],
  ['Lizenztext geloescht',
    seiten,
    (p) => (p === 'media/fonts/OFL-Inter.txt' ? false : echtGibtEs(p))],
];

for (const [was, s, gibtEs] of GEGENPROBEN) {
  const veraendert = s !== seiten || gibtEs !== echtGibtEs;
  if (!veraendert) { console.log(`FEHLER Gegenprobe „${was}" liess sich nicht einschleusen`); rot = true; continue; }
  const erkannt = !pruefen(s, gibtEs, true);
  if (!erkannt) rot = true;
  console.log(erkannt ? `ok   Gegenprobe „${was}" wird erkannt` : `FEHLER Gegenprobe „${was}" blieb unentdeckt`);
}

console.log(rot ? '\nROT' : '\nGRUEN');
process.exit(rot ? 1 : 0);
