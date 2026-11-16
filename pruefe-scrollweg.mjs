// W1 · Die Startanimation braucht ein Drittel weniger Scrollweg.
//
// Kevin, 16.11.2026 (Video): „Die … Animation vom Startbild in der Webseite,
// bis sich das handy setzt und das Alles auf einen blick erscheint, die
// Animation ist mir zu lang, bzw man muss zu lange scrollen, versuche es mal
// mit 1/3 weniger scrollen, sollte besser sein."
//
// Gemessen wird der Weg in Pixeln vom Seitenanfang bis zu dem Punkt, an dem
// das fliegende Handy gelandet ist (`scene.offsetTop`, siehe JS „angekommen")
// UND der Schritt „Alles auf einen Blick" voll steht. Die Basis vor der
// Aenderung steht in BASIS (gemessen 16.11.2026 mit `--basis`).
//
// Ziel: neuer Weg = 0,67 × Basis, ±3 % -- je Geraet und Engine.
// Gegenprobe: die alte Hoehe zurueck → rot.
//
// Aufruf:  node pruefe-scrollweg.mjs          (pruefen)
//          node pruefe-scrollweg.mjs --basis  (nur messen und ausgeben)

import { fahreZu, losmachen, tabelle, ueberAlle } from './pruef-werkzeug.mjs';

/** Scrollweg in px vor der Aenderung (16.11.2026, Stand 8ce5073). */
const BASIS = {
  'iPhone SE': 1253,
  'iPhone 15': 1601,
  'iPhone 15 Pro Max': 1746,
  'Pixel 7': 1718,
  'iPad Air': 2210,
  'Desktop 1440': 2070,
  'Desktop 1920': 2488,
};
const ZIEL = 2 / 3;
const TOLERANZ = 0.03;

/** Steht „Alles auf einen Blick" voll da, und ist das Handy gelandet? */
function lageLesen(seite) {
  return seite.evaluate(() => {
    const schritt = document.querySelector('.phone-step[data-step="0"]');
    const flug = document.getElementById('handyFlug');
    return {
      schritt0: Number(getComputedStyle(schritt).opacity) > 0.95,
      gelandet: !flug || getComputedStyle(flug).visibility === 'hidden',
    };
  });
}

async function messen(seite) {
  await losmachen(seite);
  const start = await seite.evaluate(() => document.getElementById('app').offsetTop);
  const fenster = await seite.evaluate(() => window.innerHeight);
  // Ab der Landung in Schritten von 1 % der Fensterhoehe vorfahren, bis der
  // Schritt voll steht. Hoechstens eine Fensterhoehe -- dahinter ist es kaputt.
  let weg = start;
  let lage = { schritt0: false, gelandet: false };
  for (; weg <= start + fenster; weg += Math.max(1, Math.round(fenster / 100))) {
    await fahreZu(seite, weg);
    lage = await lageLesen(seite);
    if (lage.schritt0 && lage.gelandet) break;
  }
  return { weg, fenster, verhaeltnis: (weg / fenster).toFixed(2), ...lage };
}

function urteilen(ergebnisse) {
  const fehler = [];
  for (const e of ergebnisse) {
    if (e.fehler) { fehler.push(`${e.engine} ${e.geraet}: ${e.fehler}`); continue; }
    if (!e.schritt0) fehler.push(`${e.engine} ${e.geraet}: „Alles auf einen Blick" steht am Ende des Wegs nicht voll da`);
    if (!e.gelandet) fehler.push(`${e.engine} ${e.geraet}: das Handy ist am Ende des Wegs noch nicht gelandet`);
    const basis = BASIS[e.geraet];
    if (basis == null) { fehler.push(`${e.geraet}: keine Basis hinterlegt`); continue; }
    const soll = basis * ZIEL;
    const abw = (e.weg - soll) / soll;
    if (Math.abs(abw) > TOLERANZ) {
      fehler.push(`${e.engine} ${e.geraet}: Weg ${e.weg} px, Soll ${Math.round(soll)} px (${(abw * 100).toFixed(1)} %)`);
    }
  }
  return fehler;
}

const nurBasis = process.argv.includes('--basis');
const erg = await ueberAlle(messen);
console.log('Scrollweg bis „Alles auf einen Blick":');
tabelle(erg, ['weg', 'fenster', 'verhaeltnis', 'schritt0', 'gelandet']);
if (nurBasis) process.exit(0);

let rot = false;
const fehler = urteilen(erg);
if (fehler.length) { rot = true; fehler.forEach((f) => console.log('FEHLER ' + f)); }
else console.log('ok   Weg auf jedem Geraet und in beiden Engines bei 2/3 der Basis');

console.log('\nGegenprobe:');
const alt = await ueberAlle(messen, {
  kaputt: (h) => h.replace('.hero-scrub{height:154vh;', '.hero-scrub{height:210vh;').replace('.hero-scrub{height:125vh;}', '.hero-scrub{height:170vh;}'),
  engines: ['chromium'],
});
const altRot = urteilen(alt).length > 0;
console.log(`  ${altRot ? 'ok    ' : 'FEHLER'}  alte Hoehe zurueck${altRot ? ' — wird erkannt' : ' — bleibt UNBEMERKT'}`);
if (!altRot) rot = true;

process.exit(rot ? 1 : 0);
