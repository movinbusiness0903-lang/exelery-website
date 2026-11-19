// Prüft den Abschnitt „Spracheingabe von Mahlzeiten“ auf /datenschutz/
// (19.11.2026, OFFEN B2) auf allen Geräten und Engines:
//   - der Abschnitt steht da (Überschrift, Apple, Google, Art. 9),
//   - die Seite scrollt nicht seitlich,
//   - kein Element des Abschnitts ragt über das Fenster.
// Gegenprobe: ein unbrechbares Wort im Abschnitt muss rot werden.
// Aufruf: node pruefe-datenschutz-sprache.mjs [--bilder <ordner>]
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { ueberAlle } from './pruef-werkzeug.mjs';

const BILDER = process.argv.includes('--bilder') ? process.argv[process.argv.indexOf('--bilder') + 1] : null;
if (BILDER) mkdirSync(BILDER, { recursive: true });

async function messen(seite, g, engine) {
  await seite.goto(seite.url().replace(/\/$/, '') + '/datenschutz/', { waitUntil: 'load' });
  await seite.evaluate(() => document.fonts.ready);
  const m = await seite.evaluate(() => {
    const h = [...document.querySelectorAll('h3')].find((e) => e.textContent.trim() === 'Spracheingabe von Mahlzeiten');
    if (!h) return { da: false };
    const teile = [h];
    for (let e = h.nextElementSibling; e && e.tagName !== 'H3' && e.tagName !== 'H2'; e = e.nextElementSibling) teile.push(e);
    const text = teile.map((e) => e.textContent).join(' ');
    const breit = document.documentElement.clientWidth;
    const raus = [];
    for (const t of teile) for (const e of [t, ...t.querySelectorAll('*')]) {
      const r = e.getBoundingClientRect();
      if (r.right > breit + 0.5 || r.left < -0.5) raus.push(`${e.tagName} ${Math.round(r.left)}–${Math.round(r.right)}`);
    }
    h.scrollIntoView({ block: 'start' });
    return {
      da: true,
      apple: text.includes('Apple Distribution International'),
      google: text.includes('Google Ireland'),
      art9: /Art\.\s*9 Abs\.\s*2 lit\.\s*a/.test(text.replace(/ /g, ' ')),
      seitlich: document.documentElement.scrollWidth - breit,
      raus,
      empfaengerSprache: [...document.querySelectorAll('li')].filter((l) => /Spracheingabe/.test(l.textContent) && /(Apple Distribution|Google Ireland)/.test(l.textContent)).length,
    };
  });
  if (BILDER && m.da) {
    await seite.waitForTimeout(150);
    await seite.screenshot({ path: join(BILDER, `${engine}-${g.name.replace(/\s+/g, '-')}.png`) });
  }
  return m;
}

const gut = (m) => m.da && m.apple && m.google && m.art9 && m.seitlich <= 0 && m.raus.length === 0 && m.empfaengerSprache === 2;

const ergebnis = await ueberAlle(messen);
let rot = 0;
for (const e of ergebnis) {
  const ok = !e.fehler && gut(e);
  if (!ok) rot++;
  console.log(`${ok ? 'ok    ' : 'FEHLER'} ${e.engine.padEnd(8)} ${e.geraet.padEnd(18)} `
    + (e.fehler ?? `seitlich ${e.seitlich} px · ragt raus ${e.raus.length} · Empfänger ${e.empfaengerSprache}/2 · Art. 9 ${e.art9 ? 'ja' : 'NEIN'}`));
}

// Gegenprobe: ein 1500 px breites, unbrechbares Wort im Abschnitt.
const kaputt = (html) => html.replace('Sie können eine Mahlzeit auch einsprechen.',
  `Sie können eine Mahlzeit auch einsprechen. <span style="white-space:nowrap">${'Spracheingabe'.repeat(12)}</span>`);
const gegen = await ueberAlle(messen, { kaputt, geraete: [{ name: 'iPhone SE', breit: 375, hoch: 667, dpr: 2, touch: true }], engines: ['chromium'] });
const gegenRot = gegen.every((e) => e.fehler || !gut(e));
console.log(`${gegenRot ? 'ok    ' : 'FEHLER'} Gegenprobe wird rot: ein unbrechbares Wort im Abschnitt`);

console.log(`\n${ergebnis.length - rot}/${ergebnis.length} grün, Gegenprobe ${gegenRot ? 'rot (richtig)' : 'GRÜN (falsch)'}`);
process.exit(rot === 0 && gegenRot ? 0 : 1);
