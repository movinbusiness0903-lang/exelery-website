// Waechter 17: im Geraet darf NIE ein schwarzer Klotz stehen.
//
// Kevin am 04.11.2026, mit zwei Aufnahmen (iPhone und Moritz' Android):
// „die bilder laden nicht direkt, teilweise handy mit blackscreen
// abgebildet oder es fehlt komplett. Erst nach paar Sekunden laden kommt es
// dann. Es muss wie vorher direkt sein."
//
// ── Warum es diesen Waechter braucht ─────────────────────────────────
// `.phone-device::before` ist mit Absicht schwarz (#05070C): ohne diese
// Unterlage saehe man beim Wechsel zweier halb durchsichtiger Aufnahmen die
// Seite durchscheinen. Solange aber noch KEINE Aufnahme geladen ist, ist
// dieses Glas die ganze Abbildung — ein schwarzes Rechteck im Gehaeuse.
//
// ⚠️ GEMESSEN WIRD, WAS DER LESER SIEHT, nicht was das HTML verspricht.
//    `img.complete` sagt nur, ob die Datei da ist; es sagt nichts darueber,
//    ob an dieser Stelle etwas zu sehen war. Ein Riegel, der den Plan
//    prueft statt das Erzeugnis, findet keinen Fehler im Erzeugnis — das
//    ist derselbe Fehler, der am 04.11. das Logo bei 52 px stehen liess.
//    Also: Bildausschnitt der Glasflaeche, Helligkeit und Farbanteil.
//
// ⚠️ GEDROSSELT auf schnelles 3G. Ungedrosselt sind alle Bilder in 40 ms da
//    und der Waechter kann den Fehler gar nicht sehen. Vor dem Eingriff
//    lagen hier 3,7 Sekunden schwarzes Glas.
//
// Geprueft wird:
//   1. Jede Geraete-Stelle traegt ein `data-v`, zu dem eine Ladevorschau
//      im CSS steht (erzeugt von ladebilder-bauen.mjs).
//   2. Die beiden Kopfzeilen-Vorladungen stehen da und zeigen auf Dateien,
//      die es gibt.
//   3. Gedrosselt und in Bewegung: die Glasflaeche des Startbereich-Geraets
//      und die der Telefon-Szene sind zu keinem Zeitpunkt schwarz.
//
// Playwright und sharp kommen aus Nachbarordnern — NICHT nachinstallieren.
//
// Aufruf: node pruefe-ladebild.mjs
//         node pruefe-ladebild.mjs --gegenprobe
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, normalize, extname } from 'node:path';
import { createRequire } from 'node:module';

const WURZEL = dirname(fileURLToPath(import.meta.url));
const GEGENPROBE = process.argv.includes('--gegenprobe');

const require = createRequire('C:/Users/Kevin/Fitness App/Exelery/package.json');
const sharp = require('sharp');
const PW = 'C:/Users/Kevin/Leitergolf-App/node_modules/playwright-core/index.js';
const pwModul = await import(`file:///${PW}`);
const { chromium } = pwModul.chromium ? pwModul : pwModul.default;

const TYPEN = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.webp': 'image/webp', '.woff2': 'font/woff2', '.ico': 'image/x-icon',
  '.mp4': 'video/mp4', '.txt': 'text/plain; charset=utf-8',
};

function server(kaputt, ohneAufnahmen) {
  return createServer(async (req, res) => {
    let p = decodeURIComponent((req.url || '/').split('?')[0]);
    if (p.endsWith('/')) p += 'index.html';
    // `ohneAufnahmen`: die App-Aufnahmen bleiben aus. Das ist der harte
    // Fall — wenn dann immer noch kein schwarzer Klotz dasteht, haelt die
    // Ladevorschau auch jede langsame Verbindung aus.
    if (ohneAufnahmen && /-(pm|geraet)(-1290)?\.webp$/.test(p)) {
      res.writeHead(404); res.end('absichtlich nicht geliefert'); return;
    }
    const datei = join(WURZEL, normalize(p).replace(/^(\.\.[/\\])+/, ''));
    try {
      let inhalt = await readFile(datei);
      if (kaputt && datei.endsWith('index.html')) inhalt = Buffer.from(kaputt(inhalt.toString('utf8')));
      res.writeHead(200, { 'Content-Type': TYPEN[extname(datei)] || 'application/octet-stream' });
      res.end(inhalt);
    } catch { res.writeHead(404); res.end('weg'); }
  });
}

/** Die Seite haelt beim Neuladen mit Absicht den Anfang fest (`obenHalten`
 *  im Seitenskript) und laesst erst los, wenn der Mensch selbst etwas tut —
 *  Rad, Finger, Taste oder Maustaste. Ohne das rollt Safari wegen
 *  `scroll-behavior:smooth` sichtbar die ganze Seite hoch.
 *
 *  ⚠️ Ein programmatisches `scrollTo` loest dort nur `scroll` aus, und das
 *     wird GENAU ZURUECKGEDREHT. Der Waechter kam deshalb nie von der
 *     Stelle (fuenfmal „Kasten bei y=1510, Fenster 844") und nannte den
 *     Seitenanfang schwarzes Glas. Also wird hier erst die Geste
 *     nachgestellt, die ein Leser ohnehin macht.
 */
async function losmachen(seite) {
  await seite.mouse.move(200, 400);
  await seite.mouse.wheel(0, 20);
  await seite.waitForTimeout(120);
}

/** Den Bereich eines Elements fotografieren, auch wenn es halb durchsichtig
    ist. `element.screenshot()` wartet in dem Fall bis zur Zeitgrenze. */
async function ausschnitt(seite, waehler) {
  const el = await seite.$(waehler);
  if (!el) return null;
  const k = await el.boundingBox();
  if (!k || k.width < 4 || k.height < 4) return null;
  const sicht = seite.viewportSize();
  const clip = {
    x: Math.max(0, k.x), y: Math.max(0, k.y),
    width: Math.min(k.width, sicht.width - Math.max(0, k.x)),
    height: Math.min(k.height, sicht.height - Math.max(0, k.y)),
  };
  if (clip.width < 4 || clip.height < 4) return null;
  return seite.screenshot({ type: 'png', clip });
}

/** An eine Stelle fahren und WARTEN, BIS DIE SEITE WIRKLICH STEHT.
 *
 * ⚠️ Die Seite setzt `html{scroll-behavior:smooth}`. Ein `scrollTo` faehrt
 *    dann ueber Sekunden, und `behavior:'instant'` hilft hier nicht: gemessen
 *    stand der Zaehler nach 450 ms bei 116 statt bei 1739. Der Waechter
 *    meldete daraufhin fuenf schwarze Glasflaechen, die keine waren — er
 *    fotografierte eine laufende Fahrt.
 *
 *    Also: das sanfte Fahren fuer die Dauer der Pruefung abschalten UND
 *    danach abwarten, bis sich der Zaehler zweimal hintereinander nicht
 *    mehr bewegt. Das zweite ist der eigentliche Riegel — es haelt auch,
 *    wenn die Seite ihr Scrollen einmal anders loest.
 */
async function fahreZu(seite, y) {
  // ⚠️ Solange das Dokument noch laedt, stellt Chrome die Scrollposition
  //    wieder her: ein einzelnes `scrollTo` verpufft, der Zaehler stand
  //    fuenfmal hintereinander auf 0 — und der Waechter meldete fuenf
  //    schwarze Glasflaechen, die er nie gesehen hatte. Also setzen,
  //    nachsehen, bei Bedarf erneut setzen.
  let wo = 0;
  for (let i = 0; i < 25; i++) {
    wo = await seite.evaluate((ziel) => {
      document.documentElement.style.scrollBehavior = 'auto';
      window.scrollTo(0, ziel);
      return Math.round(window.scrollY);
    }, y);
    if (Math.abs(wo - y) < 3) return wo;
    await seite.waitForTimeout(80);
  }
  return wo;
}

/** Ist die Mitte dieses Ausschnitts ein schwarzer Klotz? */
async function schwarz(bild) {
  const { data, info } = await sharp(bild).raw().toBuffer({ resolveWithObject: true });
  const kn = info.channels;
  let summe = 0, n = 0, bunt = 0;
  for (let y = Math.round(info.height * 0.25); y < info.height * 0.75; y += 3) {
    for (let x = Math.round(info.width * 0.25); x < info.width * 0.75; x += 3) {
      const i = (y * info.width + x) * kn;
      const r = data[i], g = data[i + 1], b = data[i + 2];
      summe += (r + g + b) / 3; n++;
      if (Math.max(r, g, b) - Math.min(r, g, b) > 10) bunt++;
    }
  }
  if (!n) return { ist: false, hell: 0, anteil: 0 };
  const hell = summe / n, anteil = bunt / n;
  // Schwarzes Glas ist #05070C: Helligkeit rund 7 und praktisch farblos.
  return { ist: hell < 16 && anteil < 0.05, hell, anteil };
}

/** Teil 1 und 2: am HTML, ohne Browser. */
function amText(html) {
  const fehler = [];

  // Jede Stelle, an der eine Aufnahme in einem Geraet steckt.
  const stellen = [...html.matchAll(/<div class="(phone-screen|shot-frame)[^"]*"([^>]*)><img[^>]*src="media\/web\/([a-z-]+)\.webp"/g)];
  if (stellen.length < 10) fehler.push(`zu wenige Geraete-Stellen gefunden: ${stellen.length}`);
  for (const [, klasse, rest, name] of stellen) {
    const v = (rest.match(/data-v="([^"]+)"/) || [])[1];
    if (!v) { fehler.push(`${name}: kein data-v — ohne das greift keine Ladevorschau`); continue; }
    if (v !== name) fehler.push(`${name}: data-v nennt „${v}" statt „${name}"`);
    const regel = new RegExp(`\\.${klasse}\\[data-v="${v}"\\]\\{background-image:url\\('data:image/webp;base64,[A-Za-z0-9+/=]{80,}'\\);\\}`);
    if (!regel.test(html)) fehler.push(`${name}: keine Ladevorschau im CSS (ladebilder-bauen.mjs laufen lassen)`);
  }

  // Die Vorladungen im Kopf.
  for (const muster of [/rel="preload" as="image" href="media\/web\/geraet-rahmen\.webp" fetchpriority="high"/,
    /rel="preload" as="image" fetchpriority="high"[\s\S]{0,260}?ernaehrung-pm\.webp/]) {
    if (!muster.test(html)) fehler.push(`Vorladung im Kopf fehlt (${muster.source.slice(0, 48)}…)`);
  }
  for (const d of ['media/web/geraet-rahmen.webp', 'media/web/ernaehrung-pm.webp']) {
    if (!existsSync(join(WURZEL, d))) fehler.push(`vorgeladen, aber nicht vorhanden: ${d}`);
  }

  // Die erste Aufnahme muss Vorrang haben, die spaeteren duerfen ihn nicht nehmen.
  if (!/src="media\/web\/ernaehrung-pm\.webp" fetchpriority="high"/.test(html)) {
    fehler.push('die erste Aufnahme hat kein fetchpriority="high"');
  }
  const niedrig = (html.match(/src="media\/web\/[a-z0-9-]+\.webp" fetchpriority="low"/g) || []).length;
  if (niedrig < 4) fehler.push(`nur ${niedrig} der nachgelagerten Aufnahmen stehen auf fetchpriority="low"`);

  return fehler;
}

/** Teil 3: am laufenden Bild, gedrosselt. */
async function amBild(kaputt) {
  const srv = server(kaputt);
  await new Promise((r) => srv.listen(0, r));
  const port = srv.address().port;
  const browser = await chromium.launch();
  const fehler = [];

  // ⚠️ `reducedMotion` ausdruecklich setzen. Ohne das meldet der Browser
  //    „Bewegung reduzieren", und dann ist die Telefon-Szene mit Absicht
  //    statisch (nur die erste Aufnahme, `display:none` fuer den Rest) —
  //    der Waechter haette dort nach etwas gesucht, das es gar nicht gibt
  //    und fuenf Fehler gemeldet, die keine waren.
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 3,
    reducedMotion: 'no-preference',
  });
  const seite = await ctx.newPage();
  const cdp = await ctx.newCDPSession(seite);
  await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions', {
    offline: false, latency: 150,
    downloadThroughput: (1.6 * 1024 * 1024) / 8,
    uploadThroughput: (750 * 1024) / 8,
  });

  const start = Date.now();
  await seite.goto(`http://localhost:${port}/`, { waitUntil: 'commit' });

  // a) Der Startbereich, waehrend die Seite noch laedt.
  for (const ms of [1900, 2400, 3000]) {
    const wartet = ms - (Date.now() - start);
    if (wartet > 0) await seite.waitForTimeout(wartet);
    const bild = await ausschnitt(seite, '#heroHandyPlatz .phone-screen');
    if (!bild) { fehler.push(`${ms} ms: das Geraet im Startbereich gibt es nicht`); continue; }
    const r = await schwarz(bild);
    if (r.ist) fehler.push(`Startbereich bei ${ms} ms: schwarzes Glas (Helligkeit ${r.hell.toFixed(1)}, ${(r.anteil * 100).toFixed(0)} % farbig)`);
  }

  await browser.close();
  srv.close();
  return fehler;
}

/** Teil 3b: die Telefon-Szene durchfahren, waehrend die Aufnahmen FEHLEN.
 *
 * Das ist Kevins zweite Aufnahme vom 04.11.2026: ein leeres Gehaeuse, in dem
 * nur der Alternativtext „Trainings-Screen mit Wochenplan" stand.
 *
 * ⚠️ Geprueft wird mit 404 statt mit einer langsamen Leitung. Der erste
 *    Versuch drosselte und scrollte waehrend des Ladens — dabei stellt
 *    Chrome die Scrollposition immer wieder auf 0 zurueck, und der Waechter
 *    fotografierte fuenfmal den Seitenanfang und nannte ihn schwarzes Glas.
 *    Ein Riegel, dessen Ergebnis vom Zufall der Ladezeit abhaengt, ist kein
 *    Riegel. Ohne die Dateien ist der Fall eindeutig: steht dort Farbe,
 *    traegt die Ladevorschau — steht dort Schwarz, traegt sie nicht.
 */
async function ohneAufnahmenDurchfahren(kaputt) {
  const srv = server(kaputt, true);
  await new Promise((r) => srv.listen(0, r));
  const port = srv.address().port;
  const browser = await chromium.launch();
  const fehler = [];
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 }, reducedMotion: 'no-preference',
  });
  const seite = await ctx.newPage();
  await seite.goto(`http://localhost:${port}/`, { waitUntil: 'load' });
  await seite.waitForTimeout(600);
  await losmachen(seite);

  // Die Szene haelt ihr Geraet mit `position:sticky` fest. Ihr Fortschritt
  // laeuft von „Oberkante erreicht" bis „Unterkante erreicht" — das sind
  // `hoehe - fensterhoehe` Pixel, NICHT `hoehe`.
  const strecke = await seite.evaluate(() => {
    const k = document.getElementById('app').getBoundingClientRect();
    return { oben: k.top + window.scrollY, hoch: k.height, fenster: window.innerHeight };
  });
  const fahrbar = Math.max(0, strecke.hoch - strecke.fenster);

  for (const anteil of [0.05, 0.3, 0.5, 0.7, 0.95]) {
    const ziel = strecke.oben + fahrbar * anteil;
    const wo = await fahreZu(seite, ziel);
    if (Math.abs(wo - ziel) > 3) { fehler.push(`Szene bei ${Math.round(anteil * 100)} %: kam nicht an die Stelle (${wo} statt ${Math.round(ziel)})`); continue; }
    await seite.waitForTimeout(400);
    const bild = await ausschnitt(seite, '#phoneDevice .phone-screen.active');
    if (!bild) {
      const lage = await seite.evaluate(() => {
        const a = document.querySelector('#phoneDevice .phone-screen.active');
        if (!a) return 'keine Aufnahme traegt .active';
        const k = a.getBoundingClientRect();
        return `Kasten ${Math.round(k.width)}x${Math.round(k.height)} bei y=${Math.round(k.y)}, Fenster ${innerHeight}`;
      });
      fehler.push(`Szene bei ${Math.round(anteil * 100)} %: nichts zu fotografieren — ${lage}`);
      continue;
    }
    const r = await schwarz(bild);
    if (r.ist) {
      const aktiv = await seite.$('#phoneDevice .phone-screen.active');
      const name = aktiv ? await aktiv.getAttribute('data-v') : '?';
      fehler.push(`Telefon-Szene bei ${Math.round(anteil * 100)} % (${name}): schwarzes Glas, obwohl eine Ladevorschau dastehen muesste (Helligkeit ${r.hell.toFixed(1)})`);
    }
  }

  // Dasselbe fuer die Kapitelbilder: dort steckt das Geraet IM Bild, ein
  // fehlendes Bild hinterlaesst also eine leere Flaeche.
  for (const waehler of ['.shot-frame[data-v="ernaehrung-geraet"]', '.shot-frame[data-v="abzeichen-geraet"]']) {
    await seite.evaluate((w) => {
      document.documentElement.style.scrollBehavior = 'auto';
      const e = document.querySelector(w);
      if (e) e.scrollIntoView({ block: 'center', behavior: 'instant' });
    }, waehler);
    await seite.waitForTimeout(400);
    const bild = await ausschnitt(seite, waehler);
    if (!bild) { fehler.push(`${waehler}: nicht ins Bild zu bekommen`); continue; }
    const r = await schwarz(bild);
    if (r.ist) fehler.push(`Kapitelbild ${waehler}: leere schwarze Flaeche statt Ladevorschau (Helligkeit ${r.hell.toFixed(1)})`);
  }

  await browser.close();
  srv.close();
  return fehler;
}

const html = readFileSync(join(WURZEL, 'index.html'), 'utf8');

if (!GEGENPROBE) {
  const fehler = [...amText(html), ...(await amBild(null)), ...(await ohneAufnahmenDurchfahren(null))];
  for (const f of fehler) console.log('FEHLER', f);
  console.log(fehler.length ? `${fehler.length} Fehler` : 'ok   kein schwarzes Glas, Vorschauen und Vorladungen sitzen');
  process.exit(fehler.length ? 1 : 0);
}

// ── Gegenproben: jede Sabotage MUSS rot werden ───────────────────────
const proben = [
  ['data-v am Startbereich entfernt',
    (t) => t.replace('<div class="phone-screen active" data-v="ernaehrung-pm">',
      '<div class="phone-screen active">'), true],
  ['alle Ladevorschauen aus dem CSS geworfen',
    (t) => t.replace(/\.(phone-screen|shot-frame)\[data-v="[a-z-]+"\]\{background-image:url\('data:image\/webp;base64,[^']*'\);\}/g, ''), false],
  ['Vorladung des Gehaeuses entfernt',
    (t) => t.replace(/<link rel="preload" as="image" href="media\/web\/geraet-rahmen\.webp" fetchpriority="high">/, ''), true],
  // ⚠️ Die Reihenfolge der Attribute ist Absicht: `fetchpriority` steht HINTER
  //    `src`, weil `pruefe-bilder.mjs` nach `<img src="media/web/…` sucht und
  //    ein Attribut davor sein Muster zerreisst — dort fehlten sieben von
  //    zwoelf Bild-Stellen, ohne dass das HTML falsch gewesen waere.
  ['Vorrang der ersten Aufnahme weggenommen',
    (t) => t.replace(/src="media\/web\/ernaehrung-pm\.webp" fetchpriority="high"/g, 'src="media/web/ernaehrung-pm.webp"'), true],
  ['die nachgelagerten Aufnahmen draengeln wieder',
    (t) => t.replace(/(src="media\/web\/[a-z0-9-]+\.webp") fetchpriority="low"/g, '$1'), true],
];

let alleRot = true;
for (const [name, sabotage, nurText] of proben) {
  const kaputt = sabotage(html);
  if (kaputt === html) { console.log(`PROBE OFFEN  ${name} — die Sabotage hat nichts getroffen`); alleRot = false; continue; }
  const fehler = [...amText(kaputt), ...(nurText ? [] : await ohneAufnahmenDurchfahren(sabotage))];
  const rot = fehler.length > 0;
  if (!rot) alleRot = false;
  console.log(`${rot ? 'rot ' : 'GRUEN'}  ${name}${rot ? ` — ${fehler[0]}` : ' — NICHT BEMERKT'}`);
}
console.log(alleRot ? 'ok   alle Gegenproben wurden rot' : 'FEHLER mindestens eine Sabotage blieb unbemerkt');
process.exit(alleRot ? 0 : 1);
