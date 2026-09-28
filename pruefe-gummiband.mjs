// Prueft, dass das Handy am Seitenanfang NICHT ueber dem Text liegen kann.
//
// ─── Anlass ─────────────────────────────────────────────────────────────────
//
// Kevin, 26.09.2026, Video vom iPhone: am Seitenanfang nach unten gezogen --
// die Ueberschrift „Dein Ziel. Deine Reise." wandert mit, das Handy bleibt
// stehen und liegt danach auf dem Satz „Die Fitness-App, die mitdenkt".
//
// ─── Warum das passiert ─────────────────────────────────────────────────────
//
// `#handyFlug` ist `position:fixed`, seine Lage wird aus `window.scrollY`
// gerechnet. Beim iOS-Gummiband verschiebt Safari den sichtbaren Inhalt, laesst
// `scrollY` aber auf 0 stehen: der Scroll-Job feuert nicht, die Rechnung laeuft
// nicht, das Handy bleibt liegen -- waehrend der Text darunter wegwandert.
// Der Flug ist also NICHT kaputt, ihm fehlt nur der Anlass.
//
// ─── Warum nicht overscroll-behavior ────────────────────────────────────────
//
// Das waere die naheliegende Antwort und steht zusaetzlich im CSS, hilft auf
// dem iPhone aber nicht: gemessen am 27.09.2026 meldet WebKit
// `CSS.supports('overscroll-behavior-y','none')` als `false`. Ein Fix, der
// ausgerechnet auf dem betroffenen Geraet nichts tut, ist kein Fix.
//
// Die Loesung ist deshalb eine andere: solange der Flug nicht begonnen hat,
// zeigt das Handy IM DOKUMENT. Das macht jede Verschiebung von selbst mit,
// weil es Teil der Seite ist -- ohne Ereignis, ohne Rechnung.
//
// ─── Was hier gemessen wird ─────────────────────────────────────────────────
//
//   1. am Seitenanfang traegt das Handy im Dokument, nicht das fliegende
//   2. waehrend des Flugs traegt das fliegende
//   3. am Ziel traegt das Handy der Szene
//   4. es ist IMMER genau eines sichtbar (nie zwei, nie keines)
//   5. die Uebergabe bleibt auf unter 1,3 px genau
//   6. Gegenprobe: mit der alten Fassung liegt das Handy auf dem Text
//
// Aufruf: node pruefe-gummiband.mjs

import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const WURZEL = fileURLToPath(new URL('.', import.meta.url));
const PW = 'C:/Users/Kevin/Leitergolf-App/node_modules/playwright-core/index.js';
const PORT = 5187; // eigener Port, damit ein laufendes serve.mjs nicht stoert

let fehler = 0;
let gesamt = 0;
const pruefe = (bedingung, text) => {
  gesamt++;
  if (bedingung) console.log(`ok   ${text}`);
  else {
    console.log(`FEHLER ${text}`);
    fehler++;
  }
};

const TYPEN = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.ico': 'image/x-icon',
  '.xml': 'application/xml',
  '.txt': 'text/plain',
};

function starteServer(ersetzen) {
  const server = createServer((req, res) => {
    let pfad = decodeURIComponent((req.url ?? '/').split('?')[0]);
    if (pfad.endsWith('/')) pfad += 'index.html';
    try {
      const datei = join(WURZEL, pfad);
      let inhalt = readFileSync(datei);
      // Fuer die Gegenprobe: die Seite mit der ALTEN Fassung ausliefern.
      if (ersetzen && pfad === '/index.html') {
        inhalt = Buffer.from(ersetzen(inhalt.toString('utf8')), 'utf8');
      }
      res.writeHead(200, { 'Content-Type': TYPEN[extname(datei)] ?? 'application/octet-stream' });
      res.end(inhalt);
    } catch {
      res.writeHead(404).end('nicht da');
    }
  });
  return new Promise((ok) => server.listen(PORT, () => ok(server)));
}

/** Liest, welches der drei Handys gerade sichtbar ist und wo es liegt. */
const LAGE = () => {
  const flug = document.getElementById('handyFlug');
  const platz = document.getElementById('heroHandyPlatz');
  const heroHandy = platz ? platz.querySelector('.phone-device') : null;
  const szene = document.getElementById('phoneDevice');
  const sicht = (el) => (el ? getComputedStyle(el).visibility === 'visible' : false);
  const kasten = (el) => {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { top: r.top, left: r.left, breite: r.width };
  };
  return {
    flugSichtbar: sicht(flug),
    heroSichtbar: sicht(heroHandy),
    szeneSichtbar: sicht(szene),
    flug: kasten(flug),
    platz: kasten(platz),
    scrollY: window.scrollY,
  };
};

async function seiteOeffnen(browserTyp) {
  const browser = await browserTyp.launch();
  const seite = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await seite.goto(`http://localhost:${PORT}/`, { waitUntil: 'load' });
  // Die Einblend-Animationen starten bei 1,05 s. Erst danach messen, sonst
  // misst man mitten in einer laufenden Bewegung (der 14-px-Fehler vom 25.09.).
  await seite.waitForTimeout(4500);
  return { browser, seite };
}

async function messen(browserTyp, name) {
  const { browser, seite } = await seiteOeffnen(browserTyp);

  // ─── 1. Am Seitenanfang ───────────────────────────────────────────────
  const oben = await seite.evaluate(LAGE);
  pruefe(oben.scrollY === 0, `${name}: Messung startet ganz oben (scrollY ${oben.scrollY})`);
  pruefe(
    oben.heroSichtbar && !oben.flugSichtbar,
    `${name}: oben traegt das Handy IM DOKUMENT (Dokument ${oben.heroSichtbar}, fliegend ${oben.flugSichtbar})`,
  );

  // ─── 2. Mitten im Flug ────────────────────────────────────────────────
  const hoehe = await seite.evaluate(() => {
    const hero = document.querySelector('.hero-sticky')?.closest('section');
    const szene = document.getElementById('app');
    const heroStart = hero.offsetTop;
    const heroEnde = heroStart + hero.offsetHeight - window.innerHeight;
    return { von: heroStart + (heroEnde - heroStart) * 0.6, bis: szene.offsetTop };
  });
  const mitte = Math.round(hoehe.von + (hoehe.bis - hoehe.von) * 0.5);
  await seite.evaluate((p) => window.scrollTo(0, p), mitte);
  await seite.waitForTimeout(400);
  const imFlug = await seite.evaluate(LAGE);
  pruefe(
    imFlug.flugSichtbar && !imFlug.heroSichtbar,
    `${name}: mitten im Flug traegt das FLIEGENDE (fliegend ${imFlug.flugSichtbar}, Dokument ${imFlug.heroSichtbar})`,
  );

  // ─── 3. Am Ziel ───────────────────────────────────────────────────────
  await seite.evaluate((p) => window.scrollTo(0, p + 40), hoehe.bis);
  await seite.waitForTimeout(400);
  const amZiel = await seite.evaluate(LAGE);
  pruefe(
    amZiel.szeneSichtbar && !amZiel.flugSichtbar,
    `${name}: am Ziel traegt das Handy der SZENE (Szene ${amZiel.szeneSichtbar}, fliegend ${amZiel.flugSichtbar})`,
  );

  // ─── 4. Nie zwei, nie keines ──────────────────────────────────────────
  for (const [wo, l] of [['oben', oben], ['im Flug', imFlug], ['am Ziel', amZiel]]) {
    const anzahl = [l.flugSichtbar, l.heroSichtbar, l.szeneSichtbar].filter(Boolean).length;
    pruefe(anzahl === 1, `${name}: ${wo} ist genau EIN Handy sichtbar (waren ${anzahl})`);
  }

  // ─── 5. Die Uebergabe bleibt genau ────────────────────────────────────
  // Zurueck nach oben, dann einen Hauch ueber die Abflugschwelle: dort muessen
  // fliegendes Handy und Platzhalter noch deckungsgleich liegen.
  await seite.evaluate(() => window.scrollTo(0, 0));
  await seite.waitForTimeout(400);
  await seite.evaluate((p) => window.scrollTo(0, p + 1), Math.round(hoehe.von));
  await seite.waitForTimeout(400);
  const start = await seite.evaluate(LAGE);
  if (start.flug && start.platz && start.flugSichtbar) {
    const dTop = Math.abs(start.flug.top - start.platz.top);
    const dLeft = Math.abs(start.flug.left - start.platz.left);
    pruefe(dTop <= 1.3, `${name}: Uebergabe senkrecht ${dTop.toFixed(2)} px (Grenze 1,3)`);
    pruefe(dLeft <= 1.3, `${name}: Uebergabe waagerecht ${dLeft.toFixed(2)} px (Grenze 1,3)`);
  } else {
    pruefe(false, `${name}: an der Abflugschwelle war das fliegende Handy nicht sichtbar`);
  }

  await browser.close();
}

async function gegenprobe(browserTyp, name) {
  // Die ALTE Fassung ausliefern: ohne `vorFlug` haengt die Sichtbarkeit nur am
  // Ziel. Dann traegt oben das fliegende Handy -- und genau das kann beim
  // Gummiband auf dem Text liegen bleiben.
  const server = await starteServer((html) =>
    html
      .replace(
        'flug.style.visibility = angekommen || vorFlug ? \'hidden\' : \'visible\';',
        "flug.style.visibility = angekommen ? 'hidden' : 'visible';",
      )
      .replace(
        'if (heroHandy) heroHandy.style.visibility = vorFlug ? \'visible\' : \'hidden\';',
        '',
      ),
  );
  try {
    const { browser, seite } = await seiteOeffnen(browserTyp);
    const oben = await seite.evaluate(LAGE);
    pruefe(
      oben.flugSichtbar && !oben.heroSichtbar,
      `Gegenprobe (${name}): mit der alten Fassung traegt oben wieder das FLIEGENDE — der Fehler ist reproduziert`,
    );
    await browser.close();
  } finally {
    server.close();
  }
}

async function hauptprogramm() {
  // playwright-core ist CommonJS; ueber import() landen die Namen je nach
  // Node-Fassung unter `default`.
  const modul = await import(`file:///${PW}`);
  const { chromium, webkit } = modul.chromium ? modul : modul.default;

  const server = await starteServer(null);
  try {
    await messen(chromium, 'Chromium');
    await messen(webkit, 'WebKit');
  } finally {
    server.close();
  }

  // WebKit ist die Maschine hinter Safari -- die Gegenprobe gehoert dorthin,
  // wo der Fehler auftrat.
  await gegenprobe(webkit, 'WebKit');

  console.log(
    fehler === 0
      ? `\nGRUEN: ${gesamt}/${gesamt} — am Seitenanfang traegt das Handy im Dokument, die Uebergabe bleibt unter 1,3 px`
      : `\nROT: ${fehler} von ${gesamt}`,
  );
  process.exit(fehler === 0 ? 0 : 1);
}

hauptprogramm().catch((e) => {
  console.error(`FEHLER ${e.message}`);
  process.exit(1);
});
