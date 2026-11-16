// Gemeinsames Werkzeug fuer die Geraete-Pruefer vom 16.11.2026
// (pruefe-scrollweg, pruefe-zaehler, pruefe-bildansicht).
//
// Kevin, 16.11.2026: „Was die webseite angeht IMMER auf alles möglichen
// geräten prüfen, damit es nirgendswo buggs gibt."
//
// Darum laeuft jeder dieser Pruefer ueber dieselbe Geraeteliste und ueber
// ZWEI Engines: Chromium (Chrome, Edge, Opera, Android) und WebKit (Safari,
// jeder Browser auf dem iPhone). Firefox ist auf diesem Rechner nicht
// installiert -- siehe ENGINES.

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { dirname, extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

export const WURZEL = dirname(fileURLToPath(import.meta.url));

// Dieselbe Playwright-Fassung wie pruefe-geraet-schaerfe.mjs: sie passt zu den
// installierten Browsern (chromium-1248, webkit-2336). Die Fassung im
// App-Projekt (1.64) sucht webkit-2370, das nicht installiert ist.
const PW = 'C:/Users/Kevin/Leitergolf-App/node_modules/playwright-core/index.js';
const pwModul = await import(`file:///${PW}`);
const pw = pwModul.chromium ? pwModul : pwModul.default;

/** Engines. Firefox fehlt, bis Kevin den Download freigibt (`npx playwright install firefox`). */
export const ENGINES = { chromium: pw.chromium, webkit: pw.webkit };

/**
 * Die Geraete. Groessen und Pixeldichte wie die echten Geraete;
 * Handys und Tablet mit Touch, damit Tippen und Wischen echte Touch-Ereignisse sind.
 */
export const GERAETE = [
  { name: 'iPhone SE', breit: 375, hoch: 667, dpr: 2, touch: true },
  { name: 'iPhone 15', breit: 393, hoch: 852, dpr: 3, touch: true },
  { name: 'iPhone 15 Pro Max', breit: 430, hoch: 932, dpr: 3, touch: true },
  { name: 'Pixel 7', breit: 412, hoch: 915, dpr: 2.625, touch: true },
  { name: 'iPad Air', breit: 820, hoch: 1180, dpr: 2, touch: true },
  { name: 'Desktop 1440', breit: 1440, hoch: 900, dpr: 1, touch: false },
  { name: 'Desktop 1920', breit: 1920, hoch: 1080, dpr: 1, touch: false },
];

const TYPEN = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.webp': 'image/webp', '.woff2': 'font/woff2', '.ico': 'image/x-icon',
  '.mp4': 'video/mp4', '.txt': 'text/plain; charset=utf-8',
};

/**
 * Kleiner Server. `kaputt` (optional) veraendert index.html vor der
 * Auslieferung -- so laufen die Gegenproben, ohne die Datei anzufassen.
 */
export function server(kaputt) {
  return createServer(async (req, res) => {
    let p = decodeURIComponent((req.url || '/').split('?')[0]);
    if (p.endsWith('/')) p += 'index.html';
    const datei = join(WURZEL, normalize(p).replace(/^(\.\.[/\\])+/, ''));
    try {
      let inhalt = await readFile(datei);
      if (kaputt && datei.endsWith('index.html')) inhalt = Buffer.from(kaputt(inhalt.toString('utf8')));
      res.writeHead(200, { 'Content-Type': TYPEN[extname(datei)] || 'application/octet-stream' });
      res.end(inhalt);
    } catch {
      res.writeHead(404);
      res.end('weg');
    }
  });
}

/** Startet Server und Browser, ruft `arbeit(seite, geraet, engine)` je Geraet und Engine. */
export async function ueberAlle(arbeit, { kaputt, engines = Object.keys(ENGINES), geraete = GERAETE } = {}) {
  const srv = server(kaputt);
  await new Promise((r) => srv.listen(0, r));
  const port = srv.address().port;
  const ergebnisse = [];
  try {
    for (const engineName of engines) {
      const browser = await ENGINES[engineName].launch();
      try {
        for (const g of geraete) {
          const kontext = await browser.newContext({
            viewport: { width: g.breit, height: g.hoch },
            deviceScaleFactor: g.dpr,
            hasTouch: g.touch,
            // isMobile kennt nur Chromium; WebKit bekommt die Touch-Faehigkeit.
            ...(engineName === 'chromium' ? { isMobile: g.touch && g.breit < 800 } : {}),
          });
          const seite = await kontext.newPage();
          await seite.goto(`http://localhost:${port}/`, { waitUntil: 'load' });
          await seite.evaluate(() => document.fonts.ready);
          await seite.waitForTimeout(400);
          try {
            ergebnisse.push({ engine: engineName, geraet: g.name, ...(await arbeit(seite, g, engineName)) });
          } catch (e) {
            ergebnisse.push({ engine: engineName, geraet: g.name, fehler: String(e?.message ?? e) });
          }
          await kontext.close();
        }
      } finally {
        await browser.close();
      }
    }
  } finally {
    srv.close();
  }
  return ergebnisse;
}

/**
 * Die Seite haelt beim Laden den Anfang fest, bis eine echte Geste kommt
 * (siehe pruefe-ladebild.mjs). Auf Touch-Geraeten gibt es kein Mausrad --
 * dort loest ein kurzes Scrollen per Skript die Sperre nicht, also erst ein
 * echtes Rad-Ereignis, und wo das nicht geht, ein Touch-Wisch.
 */
export async function losmachen(seite) {
  try {
    await seite.mouse.move(100, 300);
    await seite.mouse.wheel(0, 20);
  } catch { /* Touch-Kontext ohne Maus: egal, siehe fahreZu */ }
  await seite.waitForTimeout(150);
}

/** Scrollt hart auf y und wartet, bis die Seite dort steht. */
export async function fahreZu(seite, y) {
  let wo = 0;
  for (let i = 0; i < 25; i++) {
    wo = await seite.evaluate((ziel) => {
      document.documentElement.style.scrollBehavior = 'auto';
      window.scrollTo(0, ziel);
      return Math.round(window.scrollY);
    }, y);
    if (Math.abs(wo - y) < 3) break;
    await seite.waitForTimeout(80);
  }
  // Zwei Bilder Zeit, damit die rAF-Jobs der Seite gelaufen sind.
  await seite.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  return wo;
}

/** Tabelle in der Konsole: eine Zeile je Engine und Geraet. */
export function tabelle(ergebnisse, spalten) {
  for (const e of ergebnisse) {
    const teile = [e.engine.padEnd(9), e.geraet.padEnd(18)];
    if (e.fehler) teile.push(`FEHLER ${e.fehler}`);
    else for (const s of spalten) teile.push(`${s}=${e[s]}`);
    console.log('  ' + teile.join(' '));
  }
}
