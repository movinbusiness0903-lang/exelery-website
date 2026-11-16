// Waechter: die Startanimation darf nicht springen, wenn Safari die
// Adressleiste ein- oder ausblendet.
//
// Kevin, 16.11.2026 (Video vom iPhone): „Beim Handy (iOS) ruckelt die
// Startanimation beim runter- und hochscrollen."
//
// Ursache: progressOf und das Klebe-Ende des Startbereichs rechneten mit
// `window.innerHeight`. Safari aendert innerHeight beim Ein- und Ausblenden
// der Leiste um rund 90 px — ohne dass sich der Scrollstand bewegt. Im
// Startbereich bleiben auf dem Handy nur 200–280 px Strecke; der Fortschritt
// sprang also um bis zu die Haelfte (Bildfolge, Textblende, Flug).
//
// Playwright kann die iOS-Leiste nicht nachstellen: aendert man dort die
// Fenstergroesse, aendern sich svh/lvh mit — der Fehler zeigt sich nicht.
// Darum wird hier genau das nachgestellt, was Safari tut: innerHeight wird
// groesser bzw. kleiner, die CSS-Hoehen (svh/lvh) bleiben, und es kommt ein
// `resize`. Danach muss alles, was die Animation zeigt, unveraendert sein.
//
// Gegenprobe: progressOf wieder mit innerHeight → rot.
//
// Aufruf: node pruefe-ios-leiste.mjs

import { readFileSync } from 'node:fs';
import { fahreZu, losmachen, tabelle, ueberAlle, GERAETE } from './pruef-werkzeug.mjs';

const LEISTE = 90; // px, so viel aendert Safari innerHeight (iPhone 15: 659 ↔ 750)

function zustand(seite) {
  return seite.evaluate(() => {
    const ht = document.getElementById('heroText');
    const flug = document.getElementById('handyFlug');
    const geraet = document.getElementById('phoneDevice');
    const aktiv = [...document.querySelectorAll('.phone-step')].map((s) => Number(s.style.opacity || 0).toFixed(2)).join(',');
    return JSON.stringify({
      text: [ht.style.opacity, ht.style.transform],
      flug: [flug.style.transform, flug.style.visibility, flug.style.width],
      geraet: [geraet.style.transform, geraet.style.visibility],
      stufen: aktiv,
    });
  });
}

/** innerHeight so veraendern, wie Safari es beim Ein-/Ausblenden der Leiste tut. */
async function leiste(seite, delta) {
  await seite.evaluate((d) => {
    const echt = window.__echteHoehe ?? (window.__echteHoehe = window.innerHeight);
    Object.defineProperty(window, 'innerHeight', { configurable: true, get: () => echt + d });
    window.dispatchEvent(new Event('resize'));
  }, delta);
  await seite.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(r)))));
}

async function pruefen(seite) {
  // Der Startbereich blendet bis 1,85 s ein (fadeUp verschiebt den Platz des
  // Handys); vorher gemessen waere jede Aenderung die Einblendung, nicht die Leiste.
  await seite.waitForTimeout(2200);
  await losmachen(seite);
  const m = await seite.evaluate(() => {
    const hero = document.getElementById('hero');
    const hk = hero.querySelector('.hero-sticky');
    const s = document.getElementById('app');
    const sk = s.querySelector('.phone-sticky');
    const heroEnde = hero.offsetTop + hero.offsetHeight - hk.offsetHeight;
    const von = hero.offsetTop + (heroEnde - hero.offsetTop) * 0.6;
    return {
      orte: [
        ['Startbild', Math.round(hero.offsetTop + (heroEnde - hero.offsetTop) * 0.3)],
        ['Flug', Math.round(von + (s.offsetTop - von) * 0.5)],
        ['Szene', Math.round(s.offsetTop + (s.offsetHeight - sk.offsetHeight) * 0.3)],
      ],
    };
  });
  const fehler = [];
  for (const [name, y] of m.orte) {
    await leiste(seite, 0);
    await fahreZu(seite, y);
    await seite.waitForTimeout(600);
    const vorher = await zustand(seite);
    for (const d of [LEISTE, -LEISTE]) {
      await leiste(seite, d);
      const nachher = await zustand(seite);
      if (nachher !== vorher) fehler.push(`${name}: springt bei Leiste ${d > 0 ? 'aus' : 'ein'}`);
    }
  }
  await leiste(seite, 0);
  return { ok: fehler.length === 0, orte: m.orte.length, fehler: fehler.length ? fehler.join('; ') : undefined };
}

console.log('iOS-Adressleiste: Startanimation bleibt stehen — alle Geraete, Chromium + WebKit');
const erg = await ueberAlle(pruefen);
tabelle(erg, ['ok', 'orte']);
const rot = erg.filter((e) => !e.ok);
for (const e of rot) console.log(`  FEHLER ${e.engine} ${e.geraet}: ${e.fehler}`);

// Gegenproben: jede der beiden Stellen einzeln zurueck auf innerHeight.
const html = readFileSync(new URL('./index.html', import.meta.url), 'utf8');
const PROBEN = [
  ['progressOf wieder mit innerHeight', 'var h = el.offsetHeight - kasten.offsetHeight;',
    'var h = el.offsetHeight - window.innerHeight;', /Startbild|Szene/],
  ['Klebe-Ende im Flug wieder mit innerHeight', 'heroSection.offsetHeight - heroSticky.offsetHeight;',
    'heroSection.offsetHeight - window.innerHeight;', /Flug/],
];
let gegenOk = true;
const kurz = GERAETE.filter((g) => ['iPhone 15', 'iPhone SE'].includes(g.name));
for (const [name, alt, neu, muster] of PROBEN) {
  if (!html.includes(alt)) { console.log(`PROBE OFFEN  ${name} — die Sabotage trifft nichts`); gegenOk = false; continue; }
  const g = await ueberAlle(pruefen, { kaputt: (t) => t.replace(alt, neu), geraete: kurz });
  const erkannt = g.every((e) => !e.ok && muster.test(e.fehler || ''));
  if (!erkannt) gegenOk = false;
  console.log(`${erkannt ? 'rot ' : 'GRUEN'}  Gegenprobe ${name}${erkannt ? ` — ${g[0].fehler}` : ' — NICHT BEMERKT'}`);
}

const gruen = rot.length === 0 && gegenOk;
console.log(gruen ? '\nGRUEN' : '\nROT');
process.exit(gruen ? 0 : 1);
