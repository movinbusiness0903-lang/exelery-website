// Waechter: die Seite muss auf JEDER Breite passen.
//
// Kevin am 04.11.2026: „denke auch dran, dass das dann im handy layout auch
// passen muss und tablet, laptop etc."
//
// Anlass sind zwei Aenderungen vom selben Tag, die beide in die Breite
// gehen: die groesseren Schlagzeilen (D3) und das Geraetefoto, das ein
// anderes Seitenverhaeltnis hat als der CSS-Rahmen davor.
//
// Gemessen wird am gerenderten Bild, nicht am CSS:
//
//   1. Kein Querscrollen. `document.scrollWidth` darf `innerWidth` nicht
//      ueberschreiten — das ist der Fehler, den man auf dem Handy als
//      „die Seite laesst sich seitlich schieben" merkt.
//   2. Kein Element ragt heraus. Querscrollen kann auch ausbleiben, wenn
//      `overflow-x:hidden` es verdeckt (steht in body) — dann ist der
//      Inhalt trotzdem abgeschnitten. Also wird JEDES Element gegen den
//      Sichtbereich geprueft.
//   3. Das Geraet im Startbereich bleibt im Bild. Auf kurzen Fenstern ragte
//      es frueher 150 bis 250 px unten heraus (gemessen 16.09.2026).
//   4. Die Schlagzeilen brechen nicht aus ihrer Spalte.
//
// ⚠️ GEMESSEN WIRD NACH DEN EINBLENDUNGEN. `getBoundingClientRect` rechnet
//    ein laufendes `transform` MIT — waehrend `fadeUp` laeuft (bis 1,85 s)
//    kommt bei jeder Breite etwas anderes heraus. Das hat am 05.10. schon
//    einmal vier falsche Messungen erzeugt.
//
// Playwright kommt aus dem Leitergolf-Ordner — NICHT nachinstallieren.
//
// Aufruf: node pruefe-breiten.mjs
//         node pruefe-breiten.mjs --gegenprobe

// ⚠️ ALS file:///-URL IMPORTIEREN. Ein nackter Windows-Pfad („C:/…") gilt
//    dem ESM-Lader als Protokoll „c:" und wird abgelehnt. Dieselbe Quelle
//    wie in pruefe-feinschliff.mjs — NICHT nachinstallieren.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, normalize, extname } from 'node:path';

const WURZEL = dirname(fileURLToPath(import.meta.url));
const GEGENPROBE = process.argv.includes('--gegenprobe');
const PW = 'C:/Users/Kevin/Leitergolf-App/node_modules/playwright-core/index.js';
// ⚠️ playwright-core wird je nach Fassung als Namensraum ODER unter
//    `default` ausgeliefert. Dieselbe Zeile steht in pruefe-feinschliff.mjs.
const pwModul = await import(`file:///${PW}`);
const { chromium } = pwModul.chromium ? pwModul : pwModul.default;

const BREITEN = [
  { name: '320 (iPhone SE quer eng)', w: 320, h: 568 },
  { name: '390 (iPhone)', w: 390, h: 844 },
  { name: '430 (iPhone Pro Max)', w: 430, h: 932 },
  { name: '768 (Tablet hoch)', w: 768, h: 1024 },
  { name: '1024 (Tablet quer)', w: 1024, h: 768 },
  { name: '1280 (Laptop)', w: 1280, h: 800 },
  { name: '1440 (grosser Schirm)', w: 1440, h: 900 },
  { name: '1280 x 640 (flacher Laptop)', w: 1280, h: 640 },
];

const TYPEN = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.webp': 'image/webp', '.woff2': 'font/woff2', '.ico': 'image/x-icon',
  '.mp4': 'video/mp4', '.txt': 'text/plain; charset=utf-8',
};

/** `kaputt` erlaubt der Gegenprobe, index.html unterwegs zu veraendern. */
function server(kaputt) {
  return createServer(async (req, res) => {
    let p = decodeURIComponent((req.url || '/').split('?')[0]);
    if (p.endsWith('/')) p += 'index.html';
    const datei = join(WURZEL, normalize(p).replace(/^(\.\.[/\\])+/, ''));
    try {
      let inhalt = await readFile(datei);
      if (kaputt && datei.endsWith('index.html')) inhalt = Buffer.from(kaputt(inhalt.toString('utf8')));
      res.writeHead(200, { 'Content-Type': TYPEN[extname(datei)] || 'application/octet-stream' });
      res.end(inhalt);
    } catch { res.writeHead(404); res.end('weg'); }
  });
}

async function messen(kaputt) {
  const srv = server(kaputt);
  await new Promise((r) => srv.listen(0, r));
  const port = srv.address().port;
  const browser = await chromium.launch();
  const fehler = [];

  for (const { name, w, h } of BREITEN) {
    const seite = await browser.newPage({ viewport: { width: w, height: h } });
    await seite.goto(`http://localhost:${port}/`, { waitUntil: 'load' });
    // Nach den Einblendungen messen (die letzte startet bei 1,05 s).
    await seite.waitForTimeout(2200);

    const r = await seite.evaluate(() => {
      const quer = document.documentElement.scrollWidth - window.innerWidth;
      const raus = [];
      for (const e of document.querySelectorAll('body *')) {
        const cs = getComputedStyle(e);
        if (cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0') continue;
        if (cs.position === 'fixed') continue;          // Leiste und Flug-Handy
        if (e.closest('[aria-hidden="true"]')) continue; // Kulissen
        const b = e.getBoundingClientRect();
        if (b.width === 0 || b.height === 0) continue;
        const ueber = Math.max(0 - b.left, b.right - window.innerWidth);
        if (ueber > 1.5) {
          raus.push(`${e.tagName.toLowerCase()}.${(e.className || '').toString().split(' ')[0]} um ${Math.round(ueber)} px`);
        }
      }
      // ⚠️ TEXT, DER AUS SEINEM KASTEN LAEUFT, SIEHT MAN AM KASTEN NICHT.
      //    `getBoundingClientRect` liefert die Masse des KASTENS; eine
      //    Schlagzeile mit `white-space:nowrap` ragt darueber hinaus, ohne
      //    dass sich die Zahl aendert. Genau daran blieb die Gegenprobe
      //    „Schlagzeile ohne Umbruch" am 04.11. gruen. Dafuer gibt es
      //    `scrollWidth`: er misst den INHALT.
      const textRaus = [];
      for (const e of document.querySelectorAll('h1,h2,h3,p,li,a,button')) {
        const cs = getComputedStyle(e);
        if (cs.display === 'none' || cs.overflowX !== 'visible') continue;
        const ueber = e.scrollWidth - e.clientWidth;
        if (ueber > 1 && e.clientWidth > 0) {
          textRaus.push(`${e.tagName.toLowerCase()} um ${ueber} px`);
        }
      }

      // Das Geraet im Startbereich
      const platz = document.querySelector('.hero-handy-platz');
      const pb = platz ? platz.getBoundingClientRect() : null;
      const unten = pb ? Math.round(pb.bottom - window.innerHeight) : null;
      return { quer, raus: raus.slice(0, 4), rausZahl: raus.length, unten,
        textRaus: textRaus.slice(0, 4), textZahl: textRaus.length };
    });

    if (r.quer > 1) fehler.push(`${name}: Seite ist ${r.quer} px breiter als das Fenster (Querscrollen)`);
    if (r.rausZahl) fehler.push(`${name}: ${r.rausZahl} Element(e) ragen heraus — ${r.raus.join(', ')}`);
    if (r.textZahl) fehler.push(`${name}: ${r.textZahl} Textstelle(n) laufen aus ihrem Kasten — ${r.textRaus.join(', ')}`);
    if (r.unten !== null && r.unten > 0) {
      fehler.push(`${name}: das Geraet im Startbereich ragt ${r.unten} px unter den Bildrand`);
    }
    await seite.close();
  }

  await browser.close();
  await new Promise((r) => srv.close(r));
  return fehler;
}

if (!GEGENPROBE) {
  const fehler = await messen(null);
  console.log('');
  if (fehler.length) {
    for (const f of fehler) console.log(`  ROT  ${f}`);
    console.log('');
    process.exit(1);
  }
  console.log(`  ${BREITEN.length} Breiten von 320 bis 1440: kein Querscrollen, nichts ragt heraus.`);
  console.log('');
  process.exit(0);
}

// ── Gegenprobe ────────────────────────────────────────────────────────────
const SABOTAGEN = [
  ['Ein Kasten 60 px breiter als das Fenster',
    (h) => h.replace('</style>', '.chapter-text{width:calc(100% + 60px);}</style>')],
  ['Schlagzeile ohne Umbruch',
    (h) => h.replace('</style>', '.chapter-head h2{white-space:nowrap;font-size:6em;}</style>')],
];
console.log('');
let alleRot = true;
for (const [was, kaputt] of SABOTAGEN) {
  const fehler = await messen(kaputt);
  const rot = fehler.length > 0;
  if (!rot) alleRot = false;
  console.log(`  ${rot ? 'rot   ' : 'GRUEN '} ${was}`);
  if (rot) console.log(`         → ${fehler[0]}`);
}
console.log('');
if (!alleRot) {
  console.log('  Mindestens eine Sabotage blieb gruen — der Waechter misst nicht.');
  console.log('');
  process.exit(1);
}
console.log(`  Alle ${SABOTAGEN.length} Sabotagen wurden rot.`);
console.log('');
