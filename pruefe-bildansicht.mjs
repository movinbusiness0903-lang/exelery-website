// W3 · Jedes Bild per klarem Tipp groß ansehen -- und nur dann.
//
// Kevin, 16.11.2026 (Bild 3): „Die Bilder überall auf der Webseite einzeln
// antippbar machen, aber nicht, dass wenn man beim scrollen drauftippt und
// swiped das dann aufgeht sondern nur beim klaren tip drauf … da bitte drauf
// achten, dass Qualität gut bleibt."
//
// Je Geraet und Engine, fuer JEDES sichtbare Inhaltsbild:
//   1. TIPP    echter Tipp (Touch am Handy/Tablet, Maus am Rechner) → offen,
//              und die grosse Quelle hat mindestens 1290 px Breite
//              (Abzeichen: seine volle Groesse). Dann schliessen.
//   2. WISCH   Zeiger runter, 60 px bewegen, hoch → bleibt zu.
//   3. ROLLEN  Zeiger runter, Seite rollt, Zeiger hoch an derselben Stelle → zu.
//   4. LANG    Zeiger 700 ms halten → zu.
// Gegenproben: Skript fehlt → Tipp oeffnet nicht (rot); Schwellen aus →
// Wisch oeffnet (rot).
//
// Aufruf:  node pruefe-bildansicht.mjs

import { readFileSync } from 'node:fs';

import { fahreZu, losmachen, ueberAlle, WURZEL } from './pruef-werkzeug.mjs';

const SKRIPT = readFileSync(`${WURZEL}/bildansicht.js`, 'utf8');
const HTML_ROH = readFileSync(`${WURZEL}/index.html`, 'utf8');
const TAG = '<script src="bildansicht.js" defer></script>';

const offen = (seite) => seite.evaluate(() => !!document.querySelector('.bildansicht.offen'));

async function zuMachen(seite) {
  await seite.keyboard.press('Escape');
  await seite.waitForTimeout(250);
}

/** Ein kuenstlicher Zeigerablauf direkt auf dem Bild (fuer Wisch/Rollen/Lang). */
function zeiger(seite, nr, art) {
  return seite.evaluate(async ({ nr, art }) => {
    const img = document.querySelectorAll('img.ba-tippbar')[nr];
    const r = img.getBoundingClientRect();
    const x = r.left + r.width / 2;
    const y = r.top + r.height / 2;
    const feuer = (typ, dx, dy) => img.dispatchEvent(new PointerEvent(typ, {
      bubbles: true, cancelable: true, composed: true, pointerId: 7, pointerType: 'touch',
      isPrimary: true, button: 0, clientX: x + dx, clientY: y + dy,
    }));
    const warte = (ms) => new Promise((ok) => setTimeout(ok, ms));
    feuer('pointerdown', 0, 0);
    if (art === 'wisch') { feuer('pointermove', 0, -30); feuer('pointermove', 0, -60); await warte(80); feuer('pointerup', 0, -60); }
    // Am Seitenende kann die Seite nicht weiter nach unten -- dann haette es
    // gar kein Rollen gegeben (gemessen: Abzeichen, Pixel 7). Also die
    // Richtung nehmen, in die es wirklich geht.
    // „rollen-sofort" (16.11.2026): Loslassen, BEVOR das Scroll-Ereignis da
    // ist. WebKit liefert es erst 84–108 ms spaeter; mit 120 ms Warten hing
    // das Ergebnis an der Rechnerlast (rot unter Last, gruen ohne).
    if (art === 'rollen' || art === 'rollen-sofort') {
      const d = window.scrollY > 60 ? -40 : 40;
      const vor = window.scrollY;
      window.scrollBy(0, d);
      if (art === 'rollen') await warte(120);
      feuer('pointerup', 0, 0);
      if (window.scrollY === vor) throw new Error('Rollen-Probe: die Seite hat sich nicht bewegt');
      window.scrollBy(0, -d);
    }
    if (art === 'lang') { await warte(700); feuer('pointerup', 0, 0); }
    await warte(250);
  }, { nr, art });
}

async function messen(seite, g) {
  await losmachen(seite);
  await seite.waitForFunction(() => document.querySelectorAll('img.ba-tippbar').length > 0, null, { timeout: 5000 });
  const anzahl = await seite.evaluate(() => document.querySelectorAll('img.ba-tippbar').length);
  const probleme = [];
  let geprueft = 0;

  for (let nr = 0; nr < anzahl; nr++) {
    // Ins Bild holen und pruefen, ob es dort wirklich zu sehen und zu treffen ist.
    const lage = await seite.evaluate((n) => {
      const img = document.querySelectorAll('img.ba-tippbar')[n];
      const r = img.getBoundingClientRect();
      return { y: Math.round(r.top + window.scrollY + r.height / 2 - window.innerHeight / 2), src: img.getAttribute('src') };
    }, nr);
    await fahreZu(seite, Math.max(0, lage.y));
    await seite.waitForTimeout(150);
    const sicht = await seite.evaluate((n) => {
      const img = document.querySelectorAll('img.ba-tippbar')[n];
      const r = img.getBoundingClientRect();
      const st = getComputedStyle(img);
      if (r.width < 24 || r.height < 24 || st.visibility === 'hidden') return { sichtbar: false };
      let el = img;
      while (el) { const s = getComputedStyle(el); if (Number(s.opacity) < 0.05 || s.visibility === 'hidden') return { sichtbar: false }; el = el.parentElement; }
      const x = r.left + r.width / 2;
      const y = Math.min(window.innerHeight - 4, Math.max(4, r.top + r.height / 2));
      if (r.bottom < 0 || r.top > window.innerHeight) return { sichtbar: false };
      // Getroffen heisst: ein Tipp an dieser Stelle landet bei DIESEM Bild --
      // ueber dieselbe Zuordnung, die die Seite benutzt (3D-Handys, siehe
      // bildFuer in bildansicht.js).
      const treffer = document.elementFromPoint(x, y);
      const zu = window.exeleryBildFuer ? window.exeleryBildFuer(treffer, x, y) : treffer;
      // Das fliegende Handy laesst Tipps absichtlich durch (pointer-events:none);
      // darunter liegt der Handyplatz mit DEMSELBEN Bild. Zaehlt also, dass
      // dasselbe Bild aufgeht, nicht dasselbe Element.
      return { sichtbar: true, x, y, getroffen: !!zu && zu.getAttribute('src') === img.getAttribute('src') };
    }, nr);
    if (!sicht.sichtbar) continue;   // Doppel im Startbereich / fliegendes Handy in Ruhe
    geprueft++;
    const name = lage.src.replace('media/web/', '');
    if (!sicht.getroffen) { probleme.push(`${name}: liegt unter etwas anderem, ein Tipp trifft es nicht`); continue; }

    // 1. echter Tipp
    if (g.touch) await seite.touchscreen.tap(sicht.x, sicht.y);
    else await seite.mouse.click(sicht.x, sicht.y);
    await seite.waitForTimeout(300);
    if (!(await offen(seite))) { probleme.push(`${name}: klarer Tipp oeffnet nicht`); continue; }
    const quelle = await seite.evaluate(async () => {
      const g = document.querySelector('.bildansicht img');
      const ziel = g.dataset.quelle;
      for (let i = 0; i < 40 && !g.src.endsWith(ziel); i++) await new Promise((r) => setTimeout(r, 100));
      await g.decode().catch(() => {});
      return { ziel, breite: g.naturalWidth };
    });
    const mindest = /dayone-abzeichen/.test(name) ? 512 : 1290;
    if (quelle.breite < mindest) probleme.push(`${name}: gross nur ${quelle.breite} px (${quelle.ziel})`);
    await zuMachen(seite);
    if (await offen(seite)) probleme.push(`${name}: Esc schliesst nicht`);

    // 2.–4. darf NICHT oeffnen
    for (const art of ['wisch', 'rollen', 'rollen-sofort', 'lang']) {
      await fahreZu(seite, Math.max(0, lage.y));
      await zeiger(seite, nr, art);
      if (await offen(seite)) { probleme.push(`${name}: oeffnet bei „${art}"`); await zuMachen(seite); }
    }
  }
  if (geprueft === 0) probleme.push('kein einziges Bild geprueft');
  return { geprueft, probleme };
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
  console.log(`  ${e.engine.padEnd(9)}${e.geraet.padEnd(18)} ${e.fehler ? 'FEHLER ' + e.fehler : `${e.geprueft} Bilder, ${e.probleme.length} Probleme`}`);
}
const fehler = urteilen(erg);
if (fehler.length) { rot = true; fehler.forEach((f) => console.log('FEHLER ' + f)); }
else console.log('ok   jedes sichtbare Bild oeffnet per Tipp in voller Aufloesung -- Wisch, Rollen und Halten nicht');

console.log('\nGegenprobe:');
const nurEins = { engines: ['chromium'], geraete: [(await import('./pruef-werkzeug.mjs')).GERAETE[1]] };
const proben = [
  ['Skript fehlt -- Tipp oeffnet nicht', (h) => h.replace(TAG, '')],
  ['Schwellen aus -- Wisch oeffnet', (h) => h.replace(TAG, `<script>${SKRIPT
    .replace('var BEWEGUNG_MAX = 10;', 'var BEWEGUNG_MAX = 100000;')
    .replace('var DAUER_MAX = 450;', 'var DAUER_MAX = 100000;')
    .replace('&& !gerollt', '')}</script>`)],
  ['nur das Scroll-Ereignis -- Loslassen vor dem Ereignis oeffnet', (h) => {
    const alt = "var gerollt = s.gerollt || Math.abs((window.scrollY || window.pageYOffset || 0) - s.sy) > 1;";
    if (!SKRIPT.includes(alt)) throw new Error('Sabotage trifft nichts');
    return h.replace(TAG, `<script>${SKRIPT.replace(alt, 'var gerollt = s.gerollt;')}</script>`);
  }],
];
// Laeuft eine Sabotage ins Leere, waere die Probe nicht rot, sondern kaputt.
for (const [name, kaputt] of proben) {
  try { if (kaputt(HTML_ROH) === HTML_ROH) throw new Error('nichts veraendert'); }
  catch (e) { console.log(`  FEHLER  ${name} — Sabotage trifft nichts (${e.message})`); rot = true; }
}
for (const [name, kaputt] of proben) {
  const e = await ueberAlle(messen, { ...nurEins, kaputt });
  const erkannt = urteilen(e).length > 0;
  console.log(`  ${erkannt ? 'ok    ' : 'FEHLER'}  ${name}${erkannt ? ' — wird erkannt' : ' — bleibt UNBEMERKT'}`);
  if (!erkannt) rot = true;
}

process.exit(rot ? 1 : 0);
