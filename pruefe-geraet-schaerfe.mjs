// Waechter 18: der Bildschirm im Geraet muss SCHARF sein, und ums Geraet
// darf kein Dunst liegen.
//
// Kevin, 12.11.2026: Seit dem Umbau am 03.11. wirken die Handys am Rechner
// verwaschen, mit einem Dunst ums Geraet, besonders in Opera/Chrome.
//
// ── Was die Ursachen waren ───────────────────────────────────────────
//   1. Eine DAUERHAFTE 3D-Neigung (perspective + rotateY/rotateX) auf jedem
//      Geraet, auch wenn niemand scrollt. Chromium rastert die Ebene einmal
//      und rechnet sie danach schraeg nach — der Text wird weich.
//   2. Hinter jedem Kapitelbild lag eine 20 x 40 px kleine Ladevorschau MIT
//      Alphakanal, auf Geraetegroesse gezogen. Das Geraet ist aussen
//      durchsichtig, also schien sie als grauer Schleier ums Gehaeuse durch.
//
// ── Was gemessen wird ────────────────────────────────────────────────
// ⚠️ GEMESSEN WIRD DAS GERENDERTE BILD, nicht das CSS. Ein Riegel, der den
//    Plan prueft statt das Erzeugnis, findet keinen Fehler im Erzeugnis.
//
//   * SCHAERFE: mittlerer Helligkeitsgradient in der Textflaeche des Screens,
//     geteilt durch denselben Wert einer IDEALEN Verkleinerung (lanczos3) der
//     groessten vorhandenen Datei auf genau die gezeigte Groesse. 1,00 heisst
//     „so scharf, wie es aus dieser Datei ueberhaupt geht". Der Bezug macht
//     verschiedene Screens und Groessen vergleichbar — ein Screen mit viel
//     Text hat von sich aus mehr Kanten als einer mit einem grossen Ring.
//   * DUNST: Aufhellung in einem schmalen Band direkt ausserhalb des
//     Geraeteumrisses, verglichen mit demselben Bild ohne Geraet. Schatten
//     macht dunkler und zaehlt nicht; nur Aufhellung ist Dunst.
//   * RUHE: in Ruhe hat kein Geraet eine Drehung, und seine Verschiebung
//     liegt auf ganzen Pixeln.
//
// ⚠️ Eine Schaerfemessung aus einem VERSTECKTEN Fenster ist kein Beleg. Fuer
//    den Beleg `--sichtbar` (echtes Fenster, GPU-Rasterung wie bei Kevin).
//    Ohne den Schalter laeuft er kopflos — schnell genug als Riegel.
//
// Playwright und sharp kommen aus Nachbarordnern — NICHT nachinstallieren.
//
// Aufruf: node pruefe-geraet-schaerfe.mjs
//         node pruefe-geraet-schaerfe.mjs --gegenprobe
//         node pruefe-geraet-schaerfe.mjs --sichtbar --bericht <datei.json> --bilder <ordner>
//         node pruefe-geraet-schaerfe.mjs --wurzel <anderer Stand>   (Vergleich, ohne Schwellen)
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, normalize, extname } from 'node:path';
import { createRequire } from 'node:module';

const HIER = dirname(fileURLToPath(import.meta.url));
const arg = (name) => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : null; };
const GEGENPROBE = process.argv.includes('--gegenprobe');
const SICHTBAR = process.argv.includes('--sichtbar');
const WURZEL = arg('--wurzel') || HIER;
const VERGLEICH = WURZEL !== HIER;            // anderer Stand: nur messen, nicht urteilen
const BERICHT = arg('--bericht');
const BILDER = arg('--bilder');
const NUR = arg('--nur');                     // z. B. "1440x900@1.25"

const require = createRequire('C:/Users/Kevin/Fitness App/Exelery/package.json');
const sharp = require('sharp');
const PW = 'C:/Users/Kevin/Leitergolf-App/node_modules/playwright-core/index.js';
const pwModul = await import(`file:///${PW}`);
const { chromium } = pwModul.chromium ? pwModul : pwModul.default;

/* ── Schwellen ────────────────────────────────────────────────────────
   SCHAERFE_MIN: gemessen am 12.11.2026. Der Stand VOR dem Umbau (CSS-Rahmen,
   keine Neigung an den Kapitelbildern) lag an den Kapitelbildern bei 0,90 bis
   1,00; die geneigte Telefon-Szene bei 0,62 bis 0,80. Nach der Reparatur
   liegt jede Stelle auf jeder Groesse bei 0,88 oder mehr. 0,85 laesst Platz fuer
   Rundung und Bildinhalt, faengt aber jede Neigung von mehr als einem Grad.
   DUNST_MAX: Helligkeitsstufen (0..255). Vorher 3 bis 9, nachher 0,0 bis 0,3. */
const SCHAERFE_MIN = 0.85;
const DUNST_MAX = 1.0;

const GROESSEN = [
  { name: '1440x900@1', breit: 1440, hoch: 900, dpr: 1 },
  { name: '1440x900@1.25', breit: 1440, hoch: 900, dpr: 1.25 },
  { name: '1440x900@2', breit: 1440, hoch: 900, dpr: 2 },
  { name: '390x844@3', breit: 390, hoch: 844, dpr: 3 },
  { name: '768x1024@2', breit: 768, hoch: 1024, dpr: 2 },
].filter((g) => !NUR || NUR.split(',').includes(g.name));

const TYPEN = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.webp': 'image/webp', '.woff2': 'font/woff2', '.ico': 'image/x-icon',
  '.mp4': 'video/mp4', '.txt': 'text/plain; charset=utf-8',
};

function server(wurzel, kaputt) {
  return createServer(async (req, res) => {
    let p = decodeURIComponent((req.url || '/').split('?')[0]);
    if (p.endsWith('/')) p += 'index.html';
    const datei = join(wurzel, normalize(p).replace(/^(\.\.[/\\])+/, ''));
    try {
      let inhalt = await readFile(datei);
      if (kaputt && datei.endsWith('index.html')) inhalt = Buffer.from(kaputt(inhalt.toString('utf8')));
      res.writeHead(200, { 'Content-Type': TYPEN[extname(datei)] || 'application/octet-stream' });
      res.end(inhalt);
    } catch { res.writeHead(404); res.end('weg'); }
  });
}

/* Die Seite haelt beim Laden den Anfang fest, bis eine echte Geste kommt
   (siehe pruefe-ladebild.mjs, `losmachen`). */
async function losmachen(seite) {
  await seite.mouse.move(200, 400);
  await seite.mouse.wheel(0, 20);
  await seite.waitForTimeout(150);
}

async function fahreZu(seite, y) {
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

/** Helligkeit (Luma) eines RGB(A)-Puffers als Float-Feld. */
function luma(data, kanaele, b, h) {
  const l = new Float32Array(b * h);
  for (let i = 0; i < b * h; i++) {
    const j = i * kanaele;
    l[i] = 0.2126 * data[j] + 0.7152 * data[j + 1] + 0.0722 * data[j + 2];
  }
  return l;
}

/** Mittlerer Gradientenbetrag (zentrale Differenzen). */
function gradient(l, b, h) {
  let s = 0, n = 0;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < b - 1; x++) {
      const gx = l[y * b + x + 1] - l[y * b + x - 1];
      const gy = l[(y + 1) * b + x] - l[(y - 1) * b + x];
      s += Math.sqrt(gx * gx + gy * gy); n++;
    }
  }
  return n ? s / n : 0;
}

/** Ausschnitt eines Rohbildes (RGBA) als neues Rohbild. */
function schneide(roh, b, kn, k) {
  const out = Buffer.alloc(k.b * k.h * kn);
  for (let y = 0; y < k.h; y++) roh.copy(out, y * k.b * kn, ((k.y + y) * b + k.x) * kn, ((k.y + y) * b + k.x + k.b) * kn);
  return out;
}

/** Was gerade auf der Seite liegt: Lage des Bildes, Glasanteile, Quelle. */
async function lageVon(seite, waehler) {
  return seite.evaluate((w) => {
    const img = document.querySelector(w);
    if (!img) return null;
    const k = img.getBoundingClientRect();
    if (k.width < 20 || k.height < 20 || k.bottom < 0 || k.top > innerHeight) return { unsichtbar: true };
    const css = getComputedStyle(document.documentElement);
    const zahl = (n) => parseFloat(css.getPropertyValue(n));
    // Geraet IM Bild (Kapitel seit dem Umbau): das Glas ist ein Teil des Bildes.
    const imBild = /-geraet(-1290)?\.webp/.test(img.currentSrc);
    const glas = imBild
      ? { l: zahl('--glas-links') / 100, o: zahl('--glas-oben') / 100, b: zahl('--glas-breit') / 100, h: zahl('--glas-hoch') / 100 }
      : { l: 0, o: 0, b: 1, h: 1 };
    // Das Element, das die Bewegung traegt: .shot-frame, #phoneDevice, #handyFlug.
    const traeger = img.closest('.shot-frame, .phone-device');
    const t = traeger ? getComputedStyle(traeger).transform : 'none';
    return {
      x: k.left, y: k.top, b: k.width, h: k.height, glas, imBild,
      quelle: img.currentSrc.replace(location.origin + '/', ''),
      natuerlich: img.naturalWidth, transform: t,
      sichtbar: getComputedStyle(img.closest('.phone-device, .shot-frame') || img).visibility,
    };
  }, waehler);
}

/** Ist eine CSS-Transformation „in Ruhe": keine Drehung, ganze BILDSCHIRM-
 *  Pixel? (Bei DPR 1,25 sind ganze CSS-Pixel keine ganzen Bildschirmpixel.) */
function ruhig(t, dpr) {
  if (!t || t === 'none') return { ok: true, text: 'none' };
  const m = t.match(/^matrix(3d)?\(([^)]+)\)$/);
  if (!m) return { ok: false, text: t };
  const v = m[2].split(',').map(Number);
  if (m[1]) {
    // matrix3d: nur Verschiebung erlaubt (Einheitsmatrix plus tx, ty).
    const ident = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0];
    const dreh = ident.some((s, i) => Math.abs(v[i] - s) > 1e-6) || Math.abs(v[15] - 1) > 1e-6;
    const ganz = Math.abs(v[12] * dpr - Math.round(v[12] * dpr)) < 0.03 && Math.abs(v[13] * dpr - Math.round(v[13] * dpr)) < 0.03;
    return { ok: !dreh && ganz, text: dreh ? 'gedreht (matrix3d)' : `verschoben ${v[12].toFixed(2)}/${v[13].toFixed(2)}` };
  }
  const [a, b, c, d, e, f] = v;
  const dreh = Math.abs(a - 1) > 1e-6 || Math.abs(b) > 1e-6 || Math.abs(c) > 1e-6 || Math.abs(d - 1) > 1e-6;
  const ganz = Math.abs(e * dpr - Math.round(e * dpr)) < 0.03 && Math.abs(f * dpr - Math.round(f * dpr)) < 0.03;
  return { ok: !dreh && ganz, text: dreh ? 'gedreht/gestaucht' : `verschoben ${e.toFixed(2)}/${f.toFixed(2)}` };
}

/** Die groesste Fassung einer Bildquelle (dort steckt die volle Schaerfe). */
function groessteFassung(quelle) {
  const gross = quelle.replace(/(-1290)?\.webp$/, '-1290.webp');
  return existsSync(join(WURZEL, gross)) ? gross : quelle;
}

/** Schaerfe und Dunst an einer Stelle messen. */
async function messen(seite, groesse, name, waehler) {
  const lage = await lageVon(seite, waehler);
  if (!lage) return { name, fehlt: 'gibt es nicht' };
  if (lage.unsichtbar) return { name, fehlt: 'nicht im Bild' };
  const dpr = groesse.dpr;
  const bild = await seite.screenshot({ type: 'png' });
  const { data: roh, info } = await sharp(bild).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const B = info.width, H = info.height, KN = 4;

  // Glas im Fenster, in Geraetepixeln.
  const glas = {
    x: (lage.x + lage.b * lage.glas.l) * dpr, y: (lage.y + lage.h * lage.glas.o) * dpr,
    b: lage.b * lage.glas.b * dpr, h: lage.h * lage.glas.h * dpr,
  };
  // Die Textflaeche: innen, weg von Rundung und Rand.
  const innen = {
    x: Math.round(glas.x + glas.b * 0.1), y: Math.round(glas.y + glas.h * 0.08),
    b: Math.round(glas.b * 0.8), h: Math.round(glas.h * 0.84),
  };
  innen.x = Math.max(0, innen.x); innen.y = Math.max(0, innen.y);
  innen.b = Math.min(innen.b, B - innen.x); innen.h = Math.min(innen.h, H - innen.y);
  if (innen.b < 30 || innen.h < 30) return { name, fehlt: 'Textflaeche ausserhalb des Fensters' };

  const gerendert = schneide(roh, B, KN, innen);
  const gR = gradient(luma(gerendert, KN, innen.b, innen.h), innen.b, innen.h);

  // Der Bezug: groesste Fassung, ideal verkleinert auf genau die gezeigte Groesse.
  const quelle = groessteFassung(lage.quelle);
  const imgB = Math.round(lage.b * dpr), imgH = Math.round(lage.h * dpr);
  const bezugGanz = await sharp(join(WURZEL, quelle))
    .resize({ width: imgB, height: imgH, fit: 'fill', kernel: 'lanczos3' })
    .flatten({ background: '#05070C' }).ensureAlpha().raw().toBuffer();
  const imgX = lage.x * dpr, imgY = lage.y * dpr;
  const bezugK = {
    x: Math.max(0, Math.min(imgB - innen.b, Math.round(innen.x - imgX))),
    y: Math.max(0, Math.min(imgH - innen.h, Math.round(innen.y - imgY))),
    b: Math.min(innen.b, imgB), h: Math.min(innen.h, imgH),
  };
  const bezug = schneide(bezugGanz, imgB, KN, bezugK);
  const gB = gradient(luma(bezug, KN, bezugK.b, bezugK.h), bezugK.b, bezugK.h);

  // ⚠️ NICHT img.naturalWidth: bei srcset mit w-Angaben ist das die Breite
  //    aus `sizes` (270 statt 640) — die echte Dateibreite steht in der Datei.
  const dateiBreit = (await sharp(join(WURZEL, lage.quelle)).metadata()).width;
  const ergebnis = {
    name, quelle: lage.quelle, dateiBreit,
    gezeigtPx: Math.round(lage.b * lage.glas.b * dpr), quellePx: Math.round(dateiBreit * lage.glas.b),
    schaerfe: gB ? gR / gB : 0, ruhe: ruhig(lage.transform, dpr),
  };
  // Hochgerechnet? Mehr Geraetepixel gezeigt, als die Datei im Glas hat.
  ergebnis.hochgerechnet = ergebnis.gezeigtPx > ergebnis.quellePx * 1.02;

  // Dunst: nur wo das Geraet IM Bild steckt (Kapitel). Band 1..12 CSS-px
  // ausserhalb des Umrisses, oben und an den Seiten (unten liegt der Schatten).
  if (lage.imBild) {
    const alpha = await sharp(join(WURZEL, quelle)).resize({ width: imgB, height: imgH, fit: 'fill' })
      .ensureAlpha().extractChannel(3).raw().toBuffer();
    // ⚠️ NUR DIESES Geraet ausblenden. Im Paar liegt das Nachbargeraet 14 px
    //    daneben; wer alle ausblendet, misst dessen Kante als „Dunst".
    const nackt = await (async () => {
      await seite.evaluate((w) => document.querySelector(w).closest('.shot-frame').setAttribute('data-mess', ''), waehler);
      await seite.addStyleTag({ content: '.shot-frame[data-mess]{background-image:none!important;filter:none!important;box-shadow:none!important}.shot-frame[data-mess]::before,.shot-frame[data-mess]::after{display:none!important}.shot-frame[data-mess] img{visibility:hidden!important}' });
      await seite.waitForTimeout(150);
      const n = await seite.screenshot({ type: 'png' });
      await seite.evaluate(() => {
        const s = document.querySelectorAll('style'); s[s.length - 1].remove();
        document.querySelectorAll('[data-mess]').forEach((e) => e.removeAttribute('data-mess'));
      });
      await seite.waitForTimeout(150);
      return sharp(n).ensureAlpha().raw().toBuffer();
    })();
    // Band 2..12 CSS-px ausserhalb des Umrisses. Die ersten 2 px sind die
    // Kantenglaettung des Bildes selbst, kein Dunst. Die alte Vorschau
    // verschmierte rund 15 px weit — sie liegt voll im Band.
    const weit = Math.round(12 * dpr);
    const ab = Math.round(2 * dpr);
    // Abstand zum Geraet: einfache Dilatation in Stufen ueber die Alphamaske.
    const drin = new Uint8Array(imgB * imgH);
    for (let i = 0; i < drin.length; i++) drin[i] = alpha[i] > 200 ? 1 : 0;
    let rand = drin.slice();
    const band = new Uint8Array(imgB * imgH);
    for (let s = 0; s < weit; s++) {
      const neu = rand.slice();
      for (let y = 1; y < imgH - 1; y++) for (let x = 1; x < imgB - 1; x++) {
        const i = y * imgB + x;
        if (rand[i]) continue;
        if (rand[i - 1] || rand[i + 1] || rand[i - imgB] || rand[i + imgB]) { neu[i] = 1; if (s >= ab && alpha[i] < 10) band[i] = 1; }
      }
      rand = neu;
    }
    let summe = 0, n = 0;
    for (let y = 0; y < Math.round(imgH * 0.7); y++) for (let x = 0; x < imgB; x++) {
      if (!band[y * imgB + x]) continue;
      const fx = Math.round(imgX + x), fy = Math.round(imgY + y);
      if (fx < 0 || fy < 0 || fx >= B || fy >= H) continue;
      const j = (fy * B + fx) * KN;
      const a = 0.2126 * roh[j] + 0.7152 * roh[j + 1] + 0.0722 * roh[j + 2];
      const o = 0.2126 * nackt[j] + 0.7152 * nackt[j + 1] + 0.0722 * nackt[j + 2];
      summe += Math.max(0, a - o); n++;
    }
    ergebnis.dunst = n ? summe / n : 0;
  }

  if (BILDER && groesse.breit === 1440) {
    mkdirSync(BILDER, { recursive: true });
    const rand = 40 * dpr;
    const k = {
      left: Math.max(0, Math.round(lage.x * dpr - rand)), top: Math.max(0, Math.round(lage.y * dpr - rand)),
    };
    k.width = Math.min(B - k.left, Math.round(lage.b * dpr + 2 * rand));
    k.height = Math.min(H - k.top, Math.round(lage.h * dpr + 2 * rand));
    await sharp(bild).extract(k).png().toFile(join(BILDER, `${groesse.name}-${name}.png`));
  }
  return ergebnis;
}

async function eineGroesse(browser, port, groesse) {
  const ctx = await browser.newContext({
    viewport: { width: groesse.breit, height: groesse.hoch }, deviceScaleFactor: groesse.dpr,
    reducedMotion: 'no-preference',
  });
  const seite = await ctx.newPage();
  await seite.goto(`http://localhost:${port}/`, { waitUntil: 'load' });
  await seite.waitForTimeout(2600);        // Startbereich blendet bis 1,85 s ein
  const werte = [];

  // 1. Startbereich, ganz oben.
  werte.push(await messen(seite, groesse, 'start', '#heroHandyPlatz .phone-screen.active img'));

  await losmachen(seite);
  // 2. Telefon-Szene an zwei Stufen. Fortschritt 0..1 laeuft ueber hoehe - fenster.
  const s = await seite.evaluate(() => {
    const k = document.getElementById('app').getBoundingClientRect();
    return { oben: k.top + scrollY, fahrbar: k.height - innerHeight };
  });
  // Seit 16.11.2026 (Kevin) neigt sich das Szenen-Handy NACH SCROLLSTAND und
  // steht erst ab der letzten Stufe (Motivation) gerade. szene-1 und szene-3
  // sind darum absichtlich schraeg: dort zaehlt nur der Dunst. Scharf und
  // gerade muss es am Ende sein (szene-ende), wo es ankommt.
  for (const [name, anteil] of [['szene-1', 0.1], ['szene-3', 0.5], ['szene-ende', 0.95]]) {
    await fahreZu(seite, Math.round(s.oben + s.fahrbar * anteil));
    await seite.waitForTimeout(1100);
    await seite.waitForFunction(() => { const i = document.querySelector('#phoneDevice .phone-screen.active img'); return i && i.complete && i.naturalWidth > 0; }, null, { timeout: 15000 }).catch(() => {});
    await seite.waitForTimeout(200);
    werte.push(await messen(seite, groesse, name, '#phoneDevice .phone-screen.active img'));
  }

  // 3. Die Kapitelbilder: einmal mittig, einmal so, wie man sie beim Lesen
  //    oft stehen laesst (Mitte des Bildes auf 30 % der Fensterhoehe).
  const kapitel = await seite.evaluate(() => [...document.querySelectorAll('.shot-frame img')].map((i) => i.getAttribute('src').replace(/^media\/web\/|\.webp$/g, '')));
  for (const k of kapitel) {
    for (const [lageName, hoehe] of [['mitte', 0.5], ['oben', 0.3]]) {
      const w = `.shot-frame img[src="media/web/${k}.webp"]`;
      const ziel = await seite.evaluate(([sel, h]) => {
        const e = document.querySelector(sel); const r = e.getBoundingClientRect();
        return Math.round(r.top + scrollY + r.height / 2 - innerHeight * h);
      }, [w, hoehe]);
      await fahreZu(seite, Math.max(0, ziel));
      await seite.waitForFunction((sel) => { const i = document.querySelector(sel); return i && i.complete && i.naturalWidth > 0; }, w, { timeout: 15000 }).catch(() => {});
      await seite.waitForTimeout(1100);
      werte.push(await messen(seite, groesse, `${k}-${lageName}`, w));
    }
  }
  await ctx.close();
  return werte;
}

async function allesMessen(kaputt, groessen) {
  const srv = server(WURZEL, kaputt);
  await new Promise((r) => srv.listen(0, r));
  const port = srv.address().port;
  // ⚠️ Sichtbar laeuft das INSTALLIERTE Chrome (frisches Wegwerf-Profil, Kevins
  //    eigenes bleibt unberuehrt). Playwrights eigene Chromium-Kopie startet
  //    auf diesem Rechner nicht sichtbar („Side-by-Side-Konfiguration ungueltig",
  //    gemessen 12.11.2026); die kopflose Fassung laeuft.
  const browser = await chromium.launch(SICHTBAR ? { headless: false, channel: 'chrome' } : {});
  const bericht = {};
  for (const g of groessen) bericht[g.name] = await eineGroesse(browser, port, g);
  await browser.close();
  srv.close();
  return bericht;
}

function urteilen(bericht) {
  const fehler = [];
  for (const [groesse, werte] of Object.entries(bericht)) {
    for (const w of werte) {
      if (w.fehlt) {
        // Der Startbereich und die Szene MUESSEN da sein; ein Kapitelbild am
        // Seitenende darf ausserhalb liegen, wenn die Seite dort aufhoert.
        if (/^(start|szene)/.test(w.name)) fehler.push(`${groesse} ${w.name}: ${w.fehlt}`);
        continue;
      }
      if (/^szene-[13]$/.test(w.name)) {
        if (w.dunst !== undefined && w.dunst > DUNST_MAX) fehler.push(`${groesse} ${w.name}: Dunst ums Geraet ${w.dunst.toFixed(1)} Helligkeitsstufen`);
        continue;
      }
      if (w.schaerfe < SCHAERFE_MIN) fehler.push(`${groesse} ${w.name}: Schaerfe ${w.schaerfe.toFixed(2)} < ${SCHAERFE_MIN} (${w.ruhe.text})`);
      if (!w.ruhe.ok) fehler.push(`${groesse} ${w.name}: in Ruhe nicht gerade — ${w.ruhe.text}`);
      if (w.dunst !== undefined && w.dunst > DUNST_MAX) fehler.push(`${groesse} ${w.name}: Dunst ums Geraet ${w.dunst.toFixed(1)} Helligkeitsstufen`);
      if (w.hochgerechnet && /@(1\.25|2)$/.test(groesse)) fehler.push(`${groesse} ${w.name}: hochgerechnet (${w.gezeigtPx} px gezeigt, Datei hat ${w.quellePx})`);
    }
  }
  return fehler;
}

function ausgeben(bericht) {
  for (const [groesse, werte] of Object.entries(bericht)) {
    console.log(`\n${groesse}`);
    for (const w of werte) {
      if (w.fehlt) { console.log(`  ${w.name.padEnd(26)} — ${w.fehlt}`); continue; }
      console.log(`  ${w.name.padEnd(26)} Schaerfe ${w.schaerfe.toFixed(3)}`
        + `${w.dunst !== undefined ? `  Dunst ${w.dunst.toFixed(1).padStart(4)}` : '            '}`
        + `  ${String(w.gezeigtPx).padStart(4)} px aus ${String(w.quellePx).padStart(4)}${w.hochgerechnet ? ' HOCH' : '     '}`
        + `  ${w.ruhe.ok ? 'ruhig' : 'UNRUHIG'} (${w.ruhe.text})  ${w.quelle}`);
    }
  }
}

if (!GEGENPROBE) {
  const bericht = await allesMessen(null, GROESSEN);
  ausgeben(bericht);
  if (BERICHT) writeFileSync(BERICHT, JSON.stringify(bericht, null, 1));
  if (VERGLEICH) { console.log('\n(anderer Stand gemessen — kein Urteil)'); process.exit(0); }
  const fehler = urteilen(bericht);
  console.log('');
  for (const f of fehler) console.log('FEHLER', f);
  console.log(fehler.length ? `${fehler.length} Fehler` : 'ok   jeder Geraete-Screen scharf, gerade in Ruhe, kein Dunst');
  process.exit(fehler.length ? 1 : 0);
}

// ── Gegenproben: jede Sabotage MUSS am BILD rot werden ────────────────
// Die Sabotagen treffen den Code, der die Reparatur traegt. Laeuft eine ins
// Leere (Code umbenannt), meldet die Probe das, statt still gruen zu bleiben.
const html = readFileSync(join(WURZEL, 'index.html'), 'utf8');
const desktop = GROESSEN.filter((g) => g.name === '1440x900@1.25');
const proben = [
  ['Neigung wieder dauerhaft an (auch in Ruhe)',
    (t) => t.replace(/function schwungJetzt\(\) \{[^}]*\}/, 'function schwungJetzt() { return 1; }'),
    (f) => f.some((x) => /Schaerfe|nicht gerade/.test(x))],
  ['Szenen-Handy bei Motivation noch schraeg (Neigung endet nicht bei 0)',
    (t) => t.replace('var rest = 1 - gerade * gerade * (3 - 2 * gerade);', 'var rest = 1 - 0.8 * gerade;'),
    (f) => f.some((x) => /szene-ende: .*(Schaerfe|nicht gerade)/.test(x))],
  ['Ladevorschau wieder als ganzes Geraet mit Alpha hinter dem Bild',
    (t) => t.replace(/\.shot-frame\{background-size:[^}]*\}/, '.shot-frame{background-size:contain;background-position:center;background-repeat:no-repeat;}')
      .replace(/(\.shot-frame\[data-v="[a-z-]+"\]\{background-image:url\(')[^']*('\);\})/g,
        (_m, a, b) => `${a}data:image/svg+xml;base64,${Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="20" height="40"><rect x="0" y="0" width="20" height="40" rx="4" fill="#5a6478" fill-opacity=".8"/></svg>').toString('base64')}${b}`),
    (f) => f.some((x) => /Dunst/.test(x))],
];
let alleRot = true;
for (const [name, sabotage, erkennt] of proben) {
  const kaputt = sabotage(html);
  if (kaputt === html) { console.log(`PROBE OFFEN  ${name} — die Sabotage hat nichts getroffen`); alleRot = false; continue; }
  const fehler = urteilen(await allesMessen(sabotage, desktop));
  const rot = erkennt(fehler);
  if (!rot) alleRot = false;
  console.log(`${rot ? 'rot ' : 'GRUEN'}  ${name}${rot ? ` — ${fehler.find((x) => /Schaerfe|nicht gerade|Dunst/.test(x))}` : ' — NICHT BEMERKT'}`);
}
console.log(alleRot ? 'ok   alle Gegenproben wurden rot' : 'FEHLER mindestens eine Sabotage blieb unbemerkt');
process.exit(alleRot ? 0 : 1);
