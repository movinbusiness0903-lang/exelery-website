// Waechter: das Handy neigt sich NACH SCROLLSTAND (Kevin, 16.11.2026).
//
// Kevin (Video 16.11.2026): „Ich will einfach, dass das Handy schräg
// animiert reingeflogen kommt, mit jedem Scroll sich ein bisschen weiter
// gerade neigt, und wenn man dann ganz unten ist mit dem Scrollen … Dann ist
// das Handy gerade. … Ganz oben, wenn man die Webseite startet, ist es
// gerade. Dann, wenn man scrollt, wird es leicht schräg, und desto weiter man
// runterscrollt in den einzelnen Abteilen (also Ernährung, Training,
// Motivation), desto gerader wird es."
//
// Vom 12.11. bis 16.11. neigte es sich nur WAEHREND des Scrollens und stand
// nach jedem Anhalten in 0,3 s wieder gerade — bei jedem kleinen Ruck.
//
// Geprueft je Geraet und Engine (Winkel = rotateY am Element):
//   1. Seitenanfang: das Handy im Startbereich ist gerade.
//   2. Im Flug: schraeg, und die Neigung waechst mit dem Weg.
//   3. Landung: Flug-Handy und Szenen-Handy haben dieselbe Neigung (±0,5°).
//   4. Szene: |Winkel| faellt monoton von Stufe zu Stufe.
//   5. Ab der letzten Stufe (Motivation, alle fuenf Punkte): GENAU 0°,
//      ohne Drehung in der berechneten Matrix.
//   6. Ruhe: nach 1,2 s Stillstand mitten in der Szene derselbe Winkel —
//      kein Zurueckspringen.
//
// Gegenproben (muessen rot werden):
//   * der alte Schwung zurueck (Neigung nur waehrend des Scrollens)
//   * die Formel bis 12.11. (endet bei +6° statt 0°)
//
// Aufruf: node pruefe-handy-neigung.mjs

import { fahreZu, losmachen, tabelle, ueberAlle } from './pruef-werkzeug.mjs';

const ALT_SCHWUNG = [
  ['var rest = 1 - gerade * gerade * (3 - 2 * gerade);',
    'var rest = (1 - gerade * gerade * (3 - 2 * gerade)) * schwungJetzt();'],
];
const ALT_FORMEL = [
  ["'rotateY(' + (-26 * rest) + 'deg)", "'rotateY(' + (-26 + p * 32) + 'deg)"],
  ['var rest = 1 - gerade * gerade * (3 - 2 * gerade);', 'var rest = 1;'],
];

function sabotage(paare) {
  return (t) => {
    let n = t;
    for (const [alt, neu] of paare) {
      if (!n.includes(alt)) throw new Error(`Sabotage trifft nichts: ${alt}`);
      n = n.replace(alt, neu);
    }
    return n;
  };
}

/** rotateY aus dem gesetzten Stil (0, wenn keine Drehung gesetzt ist). */
function winkelLesen(seite) {
  return seite.evaluate(() => {
    const w = (el) => {
      const m = /rotateY\((-?[\d.e-]+)deg\)/.exec(el.style.transform || '');
      return m ? Number(m[1]) : 0;
    };
    const geraet = document.getElementById('phoneDevice');
    const flug = document.getElementById('handyFlug');
    const t = getComputedStyle(geraet).transform;
    // Gerade heisst: keine Drehung in der berechneten Matrix (2D oder Einheits-3D).
    let matrixGerade = t === 'none' || /^matrix\(1, 0, 0, 1,/.test(t);
    if (/^matrix3d/.test(t)) {
      const v = t.slice(9, -1).split(',').map(Number);
      matrixGerade = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0].every((s, i) => Math.abs(v[i] - s) < 1e-6);
    }
    const punkte = document.querySelectorAll('#phoneProgress i.on').length;
    return {
      geraet: w(geraet), flug: w(flug), matrixGerade, punkte,
      flugSichtbar: getComputedStyle(flug).visibility === 'visible',
      geraetSichtbar: getComputedStyle(geraet).visibility === 'visible',
    };
  });
}

async function pruefen(seite) {
  const fehler = [];
  // 1. Seitenanfang
  const oben = await winkelLesen(seite);
  if (oben.flugSichtbar && Math.abs(oben.flug) > 0.01) fehler.push(`oben schraeg (${oben.flug.toFixed(1)}°)`);

  await losmachen(seite);
  const m = await seite.evaluate(() => {
    const hero = document.getElementById('hero');
    const hk = hero.querySelector('.hero-sticky');
    const s = document.getElementById('app');
    const sk = s.querySelector('.phone-sticky');
    const heroEnde = hero.offsetTop + hero.offsetHeight - hk.offsetHeight;
    return {
      von: hero.offsetTop + (heroEnde - hero.offsetTop) * 0.6,
      bis: s.offsetTop,
      oben: s.offsetTop,
      fahrbar: s.offsetHeight - sk.offsetHeight,
      stufen: document.querySelectorAll('#phoneDevice .phone-screen').length,
    };
  });

  // 2. Flug: Neigung waechst
  const flugWinkel = [];
  for (const a of [0.25, 0.5, 0.75]) {
    await fahreZu(seite, Math.round(m.von + (m.bis - m.von) * a));
    flugWinkel.push((await winkelLesen(seite)).flug);
  }
  if (!(Math.abs(flugWinkel[0]) > 0.5)) fehler.push(`im Flug nicht schraeg (${flugWinkel[0].toFixed(1)}°)`);
  for (let i = 1; i < flugWinkel.length; i++) {
    if (Math.abs(flugWinkel[i]) + 0.01 < Math.abs(flugWinkel[i - 1])) fehler.push(`Flug: Neigung faellt (${flugWinkel.map((w) => w.toFixed(1)).join(' → ')})`);
  }

  // 3. Landung: kurz davor (Flug) gegen kurz danach (Szene)
  await fahreZu(seite, Math.round(m.bis - 2));
  const vorher = await winkelLesen(seite);
  await fahreZu(seite, Math.round(m.bis + 1));
  const nachher = await winkelLesen(seite);
  if (Math.abs(vorher.flug - nachher.geraet) > 0.5) fehler.push(`Landung springt ${vorher.flug.toFixed(1)}° → ${nachher.geraet.toFixed(1)}°`);

  // 4. + 5. Szene von Stufe zu Stufe
  const szene = [];
  const anteile = [0.02, 0.15, 0.3, 0.45, 0.6, 0.7, 0.78, 0.82, 0.9, 1];
  for (const a of anteile) {
    await fahreZu(seite, Math.round(m.oben + m.fahrbar * a));
    szene.push({ a, ...(await winkelLesen(seite)) });
  }
  for (let i = 1; i < szene.length; i++) {
    if (Math.abs(szene[i].geraet) > Math.abs(szene[i - 1].geraet) + 0.01) {
      fehler.push(`Szene wird wieder schraeger bei ${szene[i].a} (${szene[i - 1].geraet.toFixed(1)}° → ${szene[i].geraet.toFixed(1)}°)`);
    }
  }
  if (Math.abs(szene[0].geraet) < 10) fehler.push(`Szene-Anfang kaum schraeg (${szene[0].geraet.toFixed(1)}°)`);
  for (const s of szene.filter((x) => x.punkte === m.stufen)) {
    if (s.geraet !== 0 || !s.matrixGerade) fehler.push(`bei Motivation (${s.a}) nicht gerade: ${s.geraet.toFixed(2)}°`);
  }
  if (!szene.some((x) => x.punkte === m.stufen)) fehler.push('letzte Stufe nie erreicht');

  // 6. Ruhe: mitten in der Szene 1,2 s warten
  await fahreZu(seite, Math.round(m.oben + m.fahrbar * 0.3));
  const r1 = await winkelLesen(seite);
  await seite.waitForTimeout(1200);
  const r2 = await winkelLesen(seite);
  if (Math.abs(r1.geraet - r2.geraet) > 0.01) fehler.push(`in Ruhe zurueckgesprungen ${r1.geraet.toFixed(1)}° → ${r2.geraet.toFixed(1)}°`);

  return {
    ok: fehler.length === 0,
    flug: flugWinkel.map((w) => w.toFixed(1)).join('/'),
    szene: szene.map((s) => s.geraet.toFixed(1)).join(' '),
    ruhe: `${r1.geraet.toFixed(1)}→${r2.geraet.toFixed(1)}`,
    fehler: fehler.length ? fehler.join('; ') : undefined,
  };
}

console.log('Handy-Neigung nach Scrollstand — alle Geraete, Chromium + WebKit');
const erg = await ueberAlle(pruefen);
tabelle(erg, ['ok', 'flug', 'szene', 'ruhe']);
const rot = erg.filter((e) => !e.ok);
for (const e of rot) console.log(`  FEHLER ${e.engine} ${e.geraet}: ${e.fehler}`);

// Gegenproben nur auf zwei Geraeten (schnell), beide Engines.
const kurz = (await import('./pruef-werkzeug.mjs')).GERAETE.filter((g) => ['iPhone 15', 'Desktop 1440'].includes(g.name));
let gegenOk = true;
const { readFileSync } = await import('node:fs');
const html = readFileSync(new URL('./index.html', import.meta.url), 'utf8');
for (const [name, paare] of [['alter Schwung (nur waehrend des Scrollens)', ALT_SCHWUNG], ['Formel bis 12.11. (endet bei +6°)', ALT_FORMEL]]) {
  // Laeuft die Sabotage ins Leere, ist die Probe OFFEN, nicht rot.
  try { sabotage(paare)(html); } catch (e) { console.log(`PROBE OFFEN  ${name} — ${e.message}`); gegenOk = false; continue; }
  const g = await ueberAlle(pruefen, { kaputt: sabotage(paare), geraete: kurz });
  const erkannt = g.every((e) => !e.ok);
  if (!erkannt) gegenOk = false;
  console.log(`${erkannt ? 'rot ' : 'GRUEN'}  Gegenprobe ${name}${erkannt ? ` — ${g[0].fehler}` : ' — NICHT BEMERKT'}`);
}

const gruen = rot.length === 0 && gegenOk;
console.log(gruen ? '\nGRUEN' : '\nROT');
process.exit(gruen ? 0 : 1);
