// Waechter: exelery.de gegen die 20 Punkte aus dem Vault
// ("04 Ressourcen/Projekt-Checkups/Website-Feinschliff 20 Punkte.md").
//
// Entstanden am 05.10.2026 als Messung -- und die Messung lag FUENFMAL falsch,
// bevor sie der Seite gerecht wurde. Alle fuenf Fallen stehen an Ort und
// Stelle im Code, weil sie bei jeder aehnlichen Messung wieder zuschlagen:
//
//   1. Verlaufsflaechen haben `backgroundColor: transparent`
//   2. Verlaufsschrift hat `color: rgba(0,0,0,0)` -- und ihr eigener Verlauf
//      ist die SCHRIFT, nicht der Untergrund
//   3. WCAG 1.4.3 nimmt INAKTIVE Bedienelemente aus
//   4. WCAG 2.5.8 nimmt Links IM FLIESSTEXT aus
//   5. Waehrend einer Einblendung gemessen kommt bei vier Breiten viermal
//      etwas anderes heraus
//
// Erster Durchlauf: 10 Kontrastfehler und 80 zu kleine Tippflaechen.
// Nach den fuenf Korrekturen: 0 und 2 -- und die 2 waren echt.
//
// Playwright kommt aus dem Leitergolf-Ordner -- NICHT nachinstallieren.
//
// Aufruf: node pruefe-feinschliff.mjs
//         node pruefe-feinschliff.mjs --gegenprobe

import { createServer } from 'node:http';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, extname, relative } from 'node:path';

const WURZEL = process.cwd();
const PORT = 5187;
const gegenprobe = process.argv.includes('--gegenprobe');
const PW = 'C:/Users/Kevin/Leitergolf-App/node_modules/playwright-core/index.js';

const TYPEN = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.json': 'application/json',
  '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.ico': 'image/x-icon',
  '.avif': 'image/avif', '.webmanifest': 'application/manifest+json',
};

function starteServer() {
  const server = createServer((req, res) => {
    let pfad = decodeURIComponent((req.url ?? '/').split('?')[0]);
    if (pfad.endsWith('/')) pfad += 'index.html';
    try {
      const datei = join(WURZEL, pfad);
      let inhalt = readFileSync(datei);
      if (gegenprobe && pfad === '/index.html') {
        // Sabotage: die Polsterung der Kopfzeilen-Links wieder herausnehmen.
        // Dann sind sie 23 px hoch -- ein Pixel unter WCAG 2.5.8.
        inhalt = Buffer.from(
          inhalt.toString('utf8').replace(
            '.nav-links a{display:inline-block;padding:4px 2px;transition:color .2s;}',
            '.nav-links a{transition:color .2s;}'),
          'utf8');
      }
      res.writeHead(200, { 'Content-Type': TYPEN[extname(datei)] ?? 'application/octet-stream' });
      res.end(inhalt);
    } catch {
      res.writeHead(404).end('nicht da');
    }
  });
  return new Promise((ok) => server.listen(PORT, () => ok(server)));
}

/** Alle ausgelieferten Seiten finden. */
function seiten(dir = WURZEL, raus = []) {
  for (const e of readdirSync(dir)) {
    if (e === 'node_modules' || e === '.git' || e.startsWith('.')) continue;
    const p = join(dir, e);
    if (statSync(p).isDirectory()) seiten(p, raus);
    else if (e.endsWith('.html')) raus.push('/' + relative(WURZEL, p).replace(/\\/g, '/'));
  }
  return raus;
}

// ── Im Browser gemessen ───────────────────────────────────────────────────
const ERHEBUNG = () => {
  const raus = { ueberlauf: null, klein: [], kontrast: [], totelinks: [], bilderOhneMass: [], titel: '', beschreibung: '' };

  raus.titel = document.title ?? '';
  raus.beschreibung = document.querySelector('meta[name="description"]')?.getAttribute('content') ?? '';

  // 1 — seitliches Scrollen
  const breiter = document.documentElement.scrollWidth - document.documentElement.clientWidth;
  if (breiter > 1) {
    const taeter = [];
    for (const el of document.querySelectorAll('*')) {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.right > document.documentElement.clientWidth + 1) {
        taeter.push((el.tagName.toLowerCase()) + (el.id ? '#' + el.id : '') +
          (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/)[0] : '') +
          ` [${Math.round(r.right)}px]`);
        if (taeter.length >= 4) break;
      }
    }
    raus.ueberlauf = { px: Math.round(breiter), taeter };
  }

  // 16 — Tippflaechen
  //
  // GEMESSENE FALLE: die erste Fassung meldete 80 Treffer, fast alle
  // Fliesstext-Links in der Fusszeile und im Datenschutz. WCAG 2.5.8 nimmt
  // Links IM FLIESSTEXT ausdruecklich aus ("inline"), sonst muesste jeder
  // verlinkte Satz 24 px hoch sein. Geprueft werden deshalb nur Elemente, die
  // als eigener Block stehen -- Knoepfe und abgesetzte Links.
  for (const el of document.querySelectorAll('a[href], button, [role="button"], input, summary')) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    const anz = getComputedStyle(el).display;
    if (anz === 'inline') continue;              // Fliesstext-Link, ausgenommen
    // Die Honigtopf-Falle gegen Spam ist `aria-hidden` und `tabindex="-1"`.
    // Sie DARF nicht antippbar sein -- sie zu melden waere falsch herum.
    if (el.closest('[aria-hidden="true"]') || el.tabIndex < 0) continue;
    if (el.closest('p, li, td')) continue;        // steht in einem Satz
    if (r.height < 24 || r.width < 24) {          // WCAG 2.5.8 (AA)
      raus.klein.push({
        was: el.tagName.toLowerCase() + ' ' + (el.textContent ?? '').trim().slice(0, 24),
        b: Math.round(r.width), h: Math.round(r.height),
      });
    }
  }

  // 11 — tote Knoepfe
  for (const a of document.querySelectorAll('a[href="#"], a[href=""]')) {
    raus.totelinks.push((a.textContent ?? '').trim().slice(0, 30) || '(ohne Text)');
  }

  // 10 — Bilder ohne Masse (Layout springt beim Laden)
  for (const img of document.querySelectorAll('img')) {
    if (!img.getAttribute('width') || !img.getAttribute('height')) {
      raus.bilderOhneMass.push((img.getAttribute('src') ?? '?').split('/').pop());
    }
  }

  // Kontrast aller sichtbaren Textknoten
  const zahl = (s) => (s.match(/[\d.]+/g) ?? []).map(Number);
  const lum = (rgb) => {
    const v = rgb.slice(0, 3).map((c) => c / 255)
      .map((c) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)));
    return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
  };
  // GEMESSENE FALLE, 05.10.2026:
  // Die erste Fassung las nur `backgroundColor` und `color`. Beide sind bei
  // Verlaeufen DURCHSICHTIG -- ein Mint-Knopf mit `linear-gradient` hat
  // `backgroundColor: transparent`, und Verlaufsschrift (`background-clip:
  // text`) hat `color: rgba(0,0,0,0)`. Das Skript rechnete deshalb "dunkle
  // Schrift auf dunklem Elternteil" und meldete 1:1 fuer zehn Stellen, die in
  // Wirklichkeit tadellos sind. Jetzt werden die Farbstopps des Verlaufs
  // gelesen und der UNGUENSTIGSTE davon genommen.
  const stopps = (bild) => {
    const treffer = [...bild.matchAll(/rgba?\(([^)]+)\)/g)]
      .map((m) => m[1].split(',').map((x) => parseFloat(x)));
    return treffer.filter((v) => v.length >= 3 && (v[3] === undefined || v[3] > 0.5));
  };

  const hinterGrund = (el) => {
    let n = el;
    while (n && n !== document.documentElement) {
      const st = getComputedStyle(n);
      // ZWEITE FALLE derselben Art: bei Verlaufsschrift IST der Verlauf die
      // Schrift, nicht der Untergrund. Nimmt man ihn als beides, kommt immer
      // 1:1 heraus. Solche Elemente werden uebersprungen.
      if ((st.webkitBackgroundClip || st.backgroundClip) === 'text') { n = n.parentElement; continue; }
      // Ein Verlauf als Flaeche zaehlt als Flaeche.
      if (st.backgroundImage && st.backgroundImage !== 'none') {
        const st2 = stopps(st.backgroundImage);
        if (st2.length) return { farben: st2, verlauf: true };
      }
      const bg = zahl(st.backgroundColor);
      if (bg.length >= 3 && (bg[3] === undefined || bg[3] > 0.5)) return { farben: [bg], verlauf: false };
      n = n.parentElement;
    }
    return { farben: [[11, 15, 23]], verlauf: false };
  };

  /** Die sichtbare Schriftfarbe -- bei Verlaufsschrift die Stopps des Verlaufs. */
  const vorderGrund = (el, st) => {
    const fuell = st.webkitTextFillColor || st.color;
    const klip = st.webkitBackgroundClip || st.backgroundClip;
    const durchsichtig = zahl(fuell)[3] === 0;
    if (durchsichtig && klip === 'text' && st.backgroundImage !== 'none') {
      const st2 = stopps(st.backgroundImage);
      if (st2.length) return st2;
    }
    if (durchsichtig) return null;   // unsichtbar oder noch nicht eingeblendet
    const v = zahl(fuell);
    return v.length >= 3 ? [v] : null;
  };
  const gesehen = new Set();
  for (const el of document.querySelectorAll('p, h1, h2, h3, h4, li, span, a, button, small, td, th, label')) {
    const txt = (el.textContent ?? '').trim();
    if (!txt || txt.length < 4) continue;
    if (el.querySelector('p,h1,h2,h3,h4,li,span,a,button,small')) continue; // nur Blaetter
    const st = getComputedStyle(el);
    if (st.visibility === 'hidden' || st.display === 'none' || Number(st.opacity) < 0.3) continue;
    // DRITTE Falle derselben Art: WCAG 1.4.3 nimmt INAKTIVE Bedienelemente
    // ausdruecklich aus. Der Anmelde-Knopf im Dev-Board ist bei leerem
    // Formular deaktiviert (Elternteil auf Deckkraft 0,45) und wurde deshalb
    // mit 1,3:1 gemeldet -- eingeschaltet ist er Mint auf Dunkel.
    const schalter = el.closest('button, [role="button"], [aria-disabled]');
    if (schalter && (schalter.disabled || schalter.getAttribute('aria-disabled') === 'true')) continue;
    // Deckkraft gehoert IN die Farbe gerechnet. Die erste Fassung hat sie nur
    // als Ausschlussgrund benutzt -- damit galt eine Fusszeile mit
    // `opacity: .7` als volle Farbe, obwohl sie blasser auf dem Untergrund
    // liegt. Jetzt wird sie ueber alle Vorfahren multipliziert und die Schrift
    // damit auf den Untergrund gerechnet.
    let deckung = 1;
    for (let ahn = el; ahn && ahn !== document.documentElement; ahn = ahn.parentElement) {
      const o = Number(getComputedStyle(ahn).opacity);
      if (!Number.isNaN(o)) deckung *= o;
    }
    if (deckung < 0.15) continue;   // praktisch unsichtbar, keine Aussage
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    const vgs = vorderGrund(el, st);
    if (!vgs) continue;
    const hg = hinterGrund(el);
    // Bei Verlaeufen zaehlt der unguenstigste Punkt, nicht der Durchschnitt.
    let k = Infinity;
    for (const vg of vgs) {
      for (const h of hg.farben) {
        // Schrift mit Deckkraft auf den Untergrund rechnen (alpha over).
        const alpha = deckung * (vg[3] === undefined ? 1 : vg[3]);
        const echt = [0, 1, 2].map((i) => vg[i] * alpha + h[i] * (1 - alpha));
        const a = lum(echt), b = lum(h);
        const kk = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
        if (kk < k) k = kk;
      }
    }
    const px = parseFloat(st.fontSize);
    const fett = Number(st.fontWeight) >= 700;
    const gross = px >= 24 || (px >= 18.66 && fett);
    const noetig = gross ? 3.0 : 4.5;
    if (k < noetig) {
      const schl = txt.slice(0, 30) + '|' + Math.round(px);
      if (gesehen.has(schl)) continue;
      gesehen.add(schl);
      raus.kontrast.push({ text: txt.slice(0, 34), px: Math.round(px), k: Math.round(k * 100) / 100, noetig });
    }
  }
  return raus;
};

const BREITEN = [
  { name: '320 (iPhone SE)', w: 320, h: 568 },
  { name: '375 (iPhone)', w: 375, h: 812 },
  { name: '768 (Tablet)', w: 768, h: 1024 },
  { name: '1280 (Laptop)', w: 1280, h: 800 },
];

async function hauptprogramm() {
  const modul = await import(`file:///${PW}`);
  const { chromium } = modul.chromium ? modul : modul.default;

  const alleSeiten = seiten();
  const server = await starteServer();
  const browser = await chromium.launch();
  const befund = [];

  try {
    for (const seite of alleSeiten) {
      if (/google[0-9a-f]+\.html$/.test(seite)) continue; // Googles Bestaetigungsdatei
      for (const b of BREITEN) {
        const ctx = await browser.newContext({ viewport: { width: b.w, height: b.h } });
        const page = await ctx.newPage();
        try {
          await page.goto(`http://localhost:${PORT}${seite}`, { waitUntil: 'load', timeout: 20000 });
          // Die Startseite baut ihre Szenen beim ersten Bild auf.
          await page.waitForTimeout(900);

          // ⚠️ FALLE AUS DEM VAULT ("Messen waehrend einer Animation"):
          // Die erste Fassung mass mitten in der Einblendung. Fuer DENSELBEN
          // Text kamen bei vier Breiten vier verschiedene Kontraste heraus
          // (1,59 / 2,79 / 3,37 / 4,02) -- das war die halb eingeblendete
          // Deckkraft, nicht die Farbe. Jetzt wird erst die ganze Seite
          // durchgescrollt, damit jede `.reveal` ihren Endzustand erreicht,
          // und danach gemessen.
          await page.evaluate(async () => {
            const hoehe = document.documentElement.scrollHeight;
            for (let y = 0; y < hoehe; y += Math.round(innerHeight * 0.8)) {
              window.scrollTo(0, y);
              await new Promise((r) => setTimeout(r, 120));
            }
            window.scrollTo(0, 0);
          });
          // Die Einblendung dauert laut CSS 0,7 s. Danach steht sie.
          await page.waitForTimeout(1100);
          const e = await page.evaluate(ERHEBUNG);
          befund.push({ seite, breite: b.name, ...e });
        } catch (err) {
          befund.push({ seite, breite: b.name, fehler: err.message.slice(0, 90) });
        }
        await ctx.close();
      }
    }
  } finally {
    await browser.close();
    server.close();
  }

  // ── Bericht ─────────────────────────────────────────────────────────────
  console.log(`Gemessen: ${alleSeiten.length} Seiten x ${BREITEN.length} Breiten\n`);

  const ueberlauf = befund.filter((b) => b.ueberlauf);
  console.log(`1 · Seitliches Scrollen: ${ueberlauf.length} Fall/Faelle`);
  for (const u of ueberlauf) {
    console.log(`   ${u.seite} @ ${u.breite}: ${u.ueberlauf.px} px — ${u.ueberlauf.taeter.join(' | ')}`);
  }

  const kleinAlle = new Map();
  for (const b of befund) for (const k of b.klein ?? []) {
    const s = `${b.seite}  ${k.was} (${k.b}x${k.h})`;
    if (!kleinAlle.has(s)) kleinAlle.set(s, new Set());
    kleinAlle.get(s).add(b.breite.split(' ')[0]);
  }
  console.log(`\n16 · Tippflaechen unter 24 px (WCAG 2.5.8, ohne Fliesstext-Links): ${kleinAlle.size} verschiedene`);
  for (const [s, breiten] of [...kleinAlle].slice(0, 12)) console.log(`   ${s} @ ${[...breiten].join(',')}`);

  const kontrastAlle = new Map();
  for (const b of befund) for (const k of b.kontrast ?? []) {
    const s = `"${k.text}" ${k.px}px → ${k.k}:1 (noetig ${k.noetig})`;
    if (!kontrastAlle.has(s)) kontrastAlle.set(s, b.seite);
  }
  console.log(`\nWCAG-Kontrast unter der Schwelle: ${kontrastAlle.size} verschiedene`);
  for (const [s, seite] of [...kontrastAlle].slice(0, 14)) console.log(`   ${seite}  ${s}`);

  const tote = new Set();
  for (const b of befund) for (const t of b.totelinks ?? []) tote.add(`${b.seite}: "${t}"`);
  console.log(`\n11 · Tote Knoepfe (href="#"): ${tote.size}`);
  for (const t of tote) console.log('   ' + t);

  const ohneMass = new Set();
  for (const b of befund) for (const i of b.bilderOhneMass ?? []) ohneMass.add(`${b.seite}: ${i}`);
  console.log(`\n10 · Bilder ohne width/height: ${ohneMass.size}`);
  for (const i of [...ohneMass].slice(0, 10)) console.log('   ' + i);

  console.log('\n5/6 · Titel und Beschreibung je Seite');
  const proSeite = new Map();
  for (const b of befund) if (!proSeite.has(b.seite)) proSeite.set(b.seite, b);
  for (const [s, b] of proSeite) {
    const t = (b.titel ?? '').length;
    const d = (b.beschreibung ?? '').length;
    const warn = [];
    if (t === 0) warn.push('KEIN TITEL');
    else if (t > 60) warn.push(`Titel ${t} Zeichen (>60)`);
    if (d === 0) warn.push('KEINE BESCHREIBUNG');
    else if (d < 70 || d > 165) warn.push(`Beschreibung ${d} Zeichen`);
    if (warn.length) console.log(`   ${s}: ${warn.join(', ')}`);
  }

  const nichtGeladen = befund.filter((b) => b.fehler);
  if (nichtGeladen.length) {
    console.log(`\nSeiten, die nicht luden: ${nichtGeladen.length}`);
    for (const f of nichtGeladen) console.log(`   ${f.seite} @ ${f.breite}: ${f.fehler}`);
  }

  // ── Urteil ──────────────────────────────────────────────────────────────
  // Die Beschreibungen zaehlen NICHT mit: die Seiten ohne stehen alle auf
  // `noindex, nofollow`. Dort ist eine fehlende Beschreibung richtig.
  const probleme = [];
  for (const u of ueberlauf) probleme.push(`Seitliches Scrollen: ${u.seite} @ ${u.breite} (${u.ueberlauf.px} px)`);
  for (const [t] of kleinAlle) probleme.push(`Tippflaeche unter 24 px: ${t}`);
  for (const [t, seite] of kontrastAlle) probleme.push(`Kontrast: ${seite} ${t}`);
  for (const t of tote) probleme.push(`Toter Knopf: ${t}`);
  for (const i of ohneMass) probleme.push(`Bild ohne Masse: ${i}`);
  for (const f of nichtGeladen) probleme.push(`Seite laedt nicht: ${f.seite}`);

  if (gegenprobe) {
    // Eine Gegenprobe, die nur Probleme ZAEHLT, ist auch ohne Sabotage gruen,
    // sobald irgendwo sonst etwas rot ist. Sie muss den sabotierten Fall
    // NAMENTLICH treffen und darf sonst nichts faerben.
    const ERWARTET = /^Tippflaeche unter 24 px/;
    const fremd = probleme.filter((p) => !ERWARTET.test(p));
    if (fremd.length) {
      console.error('\nGEGENPROBE UNBRAUCHBAR: etwas anderes ist rot als die Sabotage:');
      fremd.forEach((p) => console.error('  - ' + p));
      process.exit(1);
    }
    if (probleme.length === 0) {
      console.error('\nGEGENPROBE GESCHEITERT: ohne die Polsterung blieb alles gruen.');
      process.exit(1);
    }
    console.log(`\nGegenprobe in Ordnung: ohne die Polsterung fallen ${probleme.length} Tippflaechen auf, sonst nichts.`);
    process.exit(0);
  }

  if (probleme.length === 0) {
    console.log('\nGRUEN — kein seitliches Scrollen, keine zu kleine Tippflaeche, kein Kontrast unter der Schwelle, kein toter Knopf, kein Bild ohne Masse.');
    process.exit(0);
  }
  console.log(`\nROT: ${probleme.length} Problem(e)`);
  probleme.forEach((p) => console.log('  - ' + p));
  process.exit(1);
}

hauptprogramm().catch((e) => { console.error('FEHLER', e.message); process.exit(1); });
