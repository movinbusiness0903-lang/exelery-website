// W2 · Die Zahlen sind fertig hochgezaehlt, wenn das Kapitel mittig steht.
//
// Kevin, 16.11.2026 (Bild 2 und 3): „wenn ich die handys und Texte mittig auf
// meinem Bildschirm sind, dann sollen die zahlen auf den aktuellen stand
// hochgescrollt sein. jetzt ist es so, dass die zahlen erst auf den letzten
// stand hochgehen, wenn ich die handy bildschirme schon fast nicht mehr im
// bild habe."
//
// Geprueft je Geraet und Engine, fuer jede Zahl:
//   1. MITTE   Kapitel (`.chapter-cols`) mittig im Fenster → Endwert.
//   2. SICHT   Zahl selbst bei 55 % der Fensterhoehe (Handy: Text steht ueber
//              den Geraeten) → Endwert.
//   3. LAUF    Kapitel kommt gerade unten herein → NOCH NICHT Endwert. Sonst
//              waere die Animation weg, und das will niemand.
// Gegenprobe: die alte Formel (fertig erst bei 25 % Fensterhoehe) → rot.
//
// Aufruf:  node pruefe-zaehler.mjs

import { fahreZu, losmachen, ueberAlle } from './pruef-werkzeug.mjs';

async function messen(seite) {
  await losmachen(seite);
  const zahlen = await seite.evaluate(() => [...document.querySelectorAll('[data-count]')].map((c, i) => {
    c.dataset.pruefNr = String(i);
    const kasten = c.closest('.chapter-cols') || c;
    const rk = kasten.getBoundingClientRect();
    const rz = c.getBoundingClientRect();
    const fmt = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return {
      nr: i,
      ende: fmt(Number(c.dataset.count)) + (c.dataset.suffix || ''),
      kastenOben: rk.top + window.scrollY,
      kastenHoehe: rk.height,
      zahlOben: rz.top + window.scrollY,
    };
  }));
  const H = await seite.evaluate(() => window.innerHeight);
  const lesen = (nr) => seite.evaluate((n) => document.querySelector(`[data-pruef-nr="${n}"]`).textContent, nr);

  const fehler = [];
  for (const z of zahlen) {
    await fahreZu(seite, Math.round(z.kastenOben + z.kastenHoehe / 2 - H / 2));
    const mitte = await lesen(z.nr);
    if (mitte !== z.ende) fehler.push(`Zahl ${z.ende}: Kapitel mittig, steht erst bei ${mitte}`);

    await fahreZu(seite, Math.max(0, Math.round(z.zahlOben - H * 0.55)));
    const sicht = await lesen(z.nr);
    if (sicht !== z.ende) fehler.push(`Zahl ${z.ende}: bei 55 % sichtbar, steht erst bei ${sicht}`);

    await fahreZu(seite, Math.max(0, Math.round(z.kastenOben - H * 0.95)));
    const lauf = await lesen(z.nr);
    if (lauf === z.ende) fehler.push(`Zahl ${z.ende}: schon fertig, wenn das Kapitel gerade hereinkommt -- die Animation fehlt`);
  }
  return { zahlen: zahlen.length, probleme: fehler };
}

function urteilen(erg) {
  const fehler = [];
  for (const e of erg) {
    if (e.fehler) fehler.push(`${e.engine} ${e.geraet}: ${e.fehler}`);
    else for (const p of e.probleme) fehler.push(`${e.engine} ${e.geraet}: ${p}`);
  }
  return fehler;
}

let rot = false;
const erg = await ueberAlle(messen);
for (const e of erg) {
  console.log(`  ${e.engine.padEnd(9)}${e.geraet.padEnd(18)} ${e.fehler ? 'FEHLER ' + e.fehler : `${e.zahlen} Zahlen, ${e.probleme.length} Probleme`}`);
}
const fehler = urteilen(erg);
if (fehler.length) { rot = true; fehler.forEach((f) => console.log('FEHLER ' + f)); }
else console.log('ok   jede Zahl ist fertig, wenn ihr Kapitel mittig steht -- und laeuft vorher noch');

console.log('\nGegenprobe:');
const ANKER = 'var p = Math.min(1, Math.max(0, pKapitel, pZahl));';
const alt = await ueberAlle(messen, {
  kaputt: (h) => {
    if (!h.includes(ANKER)) throw new Error('Anker fuer die Gegenprobe fehlt');
    return h.replace(ANKER, 'var p = Math.min(1, Math.max(0, 1 - (r.top - H * 0.25) / (H * 0.55)));');
  },
  engines: ['chromium'],
});
const altRot = urteilen(alt).length > 0;
console.log(`  ${altRot ? 'ok    ' : 'FEHLER'}  alte Formel (fertig erst bei 25 %)${altRot ? ' — wird erkannt' : ' — bleibt UNBEMERKT'}`);
if (!altRot) rot = true;

process.exit(rot ? 1 : 0);
