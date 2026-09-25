// Prueft, dass das fliegende Handy (#handyFlug) nach JEDER Layout-Aenderung
// neu gemessen wird.
//
// Kevin, 25.09.2026: Auf Handybreite lag das Handy mal genau auf seinem Platz,
// mal bis zu 14 px zu tief - bei gleichem Code, rein zufaellig (gemessen:
// 0,00 / 7,65 / 13,64 px in drei Laeufen). Am PC fiel es kaum auf.
//
// URSACHE: Der Platz (.hero-handy-platz) blendet sich mit `fadeUp` ein, und
// fadeUp schiebt von translateY(14px) auf 0. `getBoundingClientRect()` rechnet
// diese Verschiebung MIT. Wer waehrend der Animation misst (sie laeuft ab
// 1,05 s), legt das Handy zu tief - und es bleibt dort, weil danach nichts mehr
// rechnet. Belegt: eine Neuberechnung gezielt bei 1400 ms ausgeloest ergab ohne
// Gegenmassnahme 5,44 px (Chromium) und 3,68 px (WebKit) Abweichung.
//
// Das Flug-Skript misst in jedem Bild neu, es laeuft aber nur, wenn `onScroll`
// angestossen wird. Deshalb muss es alle vier Ausloeser geben. Fehlt einer,
// ist der Zufallsfehler zurueck.
//
// Der Lagen-Beweis selbst lief mit Playwright (10 Laeufe je Breite 360, 375,
// 390, 412 und 1440, Chromium und WebKit: 100 von 100 bei 0,00 px). Dieses
// Skript haelt nur fest, dass die Ausloeser im Code bleiben.
//
// Aufruf: node pruefe-handy-lage.mjs

import { readFileSync } from 'node:fs';

const HTML = readFileSync(new URL('./index.html', import.meta.url), 'utf8');

/** Nur der Block der Handy-Uebergabe, nicht die ganze Seite. */
function flugBlock(html) {
  const m = html.match(/\/\* =+ Handy-Uebergabe[\s\S]*?\n    onScroll\(\);/);
  return m ? m[0] : null;
}

const AUSLOESER = [
  ['in jedem Bild neu messen', /var flugMass = messen\(\);/],
  ['beim Laden der Seite', /window\.addEventListener\('load', onScroll\)/],
  ['wenn die Schriften stehen', /document\.fonts\.ready\.then\(onScroll\)/],
  ['wenn sich das Hero-Raster aendert', /\.observe\(heroSticky\.querySelector\('\.hero-raster'\)\)/],
  ['wenn sich der Platz selbst aendert (svh/lvh)', /\.observe\(handyPlatz\)/],
  ['wenn die fadeUp-Animation endet', /handyPlatz\.addEventListener\('animationend', onScroll\)/],
];

function pruefe(html, leise) {
  const fehler = [];
  const block = flugBlock(html);
  if (!block) return ['Block der Handy-Uebergabe nicht gefunden'];

  for (const [was, re] of AUSLOESER) {
    if (!re.test(block)) fehler.push(`Ausloeser fehlt: ${was}`);
  }

  // Der Platz MUSS eine Animation haben - sonst ist der animationend-Ausloeser
  // wirkungslos und diese Pruefung waere ein leeres Versprechen.
  const css = html.match(/\.hero-handy-platz\{[^}]*\}/);
  if (!css) fehler.push('.hero-handy-platz nicht im CSS gefunden');
  else if (!/animation:\s*fadeUp/.test(css[0])) {
    fehler.push('.hero-handy-platz hat keine fadeUp-Animation mehr - Ausloeser pruefen');
  }

  // fadeUp muss weiterhin verschieben, sonst ist die ganze Begruendung hinfaellig.
  const keyframes = html.match(/@keyframes fadeUp\{[^}]*\}[^}]*\}/);
  if (!keyframes) fehler.push('@keyframes fadeUp nicht gefunden');
  else if (!/translateY\(\d/.test(keyframes[0])) {
    fehler.push('fadeUp verschiebt nicht mehr senkrecht - Kommentar im Code anpassen');
  }

  if (!leise) {
    if (fehler.length === 0) console.log(`ok   alle ${AUSLOESER.length} Ausloeser fuer das Nachmessen sind da`);
    else fehler.forEach((f) => console.log(`FEHLER ${f}`));
  }
  return fehler;
}

let rot = pruefe(HTML, false).length > 0;

const GEGENPROBEN = [
  ['Nachmessen nach der Animation entfernt',
    (h) => h.replace("    handyPlatz.addEventListener('animationend', onScroll);\r\n", '').replace("    handyPlatz.addEventListener('animationend', onScroll);\n", '')],
  ['Platz wird nicht mehr beobachtet',
    (h) => h.replace('beobachter.observe(handyPlatz);', '')],
  ['Ausloeser bei fertigen Schriften entfernt',
    (h) => h.replace('document.fonts.ready.then(onScroll)', 'void 0')],
  ['wieder zwischengespeichert statt in jedem Bild messen',
    (h) => h.replace('var flugMass = messen();', 'var flugMass = gemerkt;')],
];

for (const [was, aendern] of GEGENPROBEN) {
  const html = aendern(HTML);
  if (html === HTML) { console.log(`FEHLER Gegenprobe „${was}" liess sich nicht einschleusen`); rot = true; continue; }
  const erkannt = pruefe(html, true).length > 0;
  console.log(erkannt ? `ok   Gegenprobe „${was}" wird erkannt` : `FEHLER Gegenprobe „${was}" blieb unentdeckt`);
  if (!erkannt) rot = true;
}

console.log(rot ? '\nROT' : '\nGRUEN');
process.exit(rot ? 1 : 0);
