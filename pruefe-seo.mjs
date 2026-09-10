// Prueft, ob die Seite auffindbar und teilbar ist.
//
// Anlass: Am 09.09.2026 hat Kevin auf einem fremden Rechner „exelery" in Edge
// eingegeben und die Seite kam nicht. Die Pruefung ergab, dass exelery.de zu
// gar keinem Suchbegriff bei Google auffindbar war — nicht einmal, wenn man
// die Domain selbst eingibt. Auf allen vier Seiten fehlten damals:
// Open Graph, Canonical, strukturierte Daten und die Meta-Description.
//
// Dieses Skript sorgt dafuer, dass das nicht unbemerkt zurueckkommt.
//
// Aufruf:  node pruefe-seo.mjs
// Beendet sich mit 1, wenn etwas fehlt.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

// ⚠️ fileURLToPath, nicht `.pathname`: der Ordner heisst „Fitness App" mit
// Leerzeichen, und in einer URL steht dort %20. Ein roher `.pathname` sucht
// dann nach „Fitness%20App" und findet nichts.
const HIER = fileURLToPath(new URL('.', import.meta.url));
const BASIS = 'https://exelery.de';

let fehler = 0;
const meckern = (s) => {
  console.log('  FEHLER  ' + s);
  fehler++;
};

// ─── Welche Seiten gibt es? ──────────────────────────────────────────────────
function seitenSuchen(ordner, praefix = '') {
  const raus = [];
  for (const name of readdirSync(ordner)) {
    if (name.startsWith('.') || name === 'media' || name === '_tmp-vorschau') continue;
    const voll = join(ordner, name);
    if (statSync(voll).isDirectory()) {
      raus.push(...seitenSuchen(voll, `${praefix}${name}/`));
    } else if (name === 'index.html') {
      raus.push({ datei: voll, pfad: `/${praefix}` });
    }
  }
  return raus;
}

const seiten = seitenSuchen(HIER);
console.log(`${seiten.length} Seiten gefunden.\n`);

// ─── Je Seite: der Kopf ──────────────────────────────────────────────────────
const PFLICHT = [
  ['<title>', 'Titel'],
  ['name="description"', 'Meta-Description'],
  ['rel="canonical"', 'Canonical'],
  ['property="og:title"', 'og:title'],
  ['property="og:description"', 'og:description'],
  ['property="og:image"', 'og:image'],
  ['property="og:url"', 'og:url'],
  ['name="twitter:card"', 'Twitter Card'],
];

for (const s of seiten) {
  const html = readFileSync(s.datei, 'utf8');
  console.log(s.pfad);

  // Seiten, die BEWUSST nicht in den Index sollen, brauchen keine
  // Index-Metadaten. /bestaetigt/ ist eine Zwischenstation im Anmeldeweg
  // und traegt Anmeldedaten im Adressfragment -- ein og:image waere dort
  // sinnlos und ein Sitemap-Eintrag falsch.
  //
  // Die Ausnahme wird NICHT verschenkt: Wer noindex setzt, muss es auch
  // meinen. Unten wird geprueft, dass eine solche Seite wirklich NICHT in
  // der Sitemap steht.
  s.noindex = /<meta[^>]+name=["']robots["'][^>]*content=["'][^"']*noindex/i.test(html);
  if (s.noindex) {
    console.log('  noindex — Pflichtangaben entfallen');
    continue;
  }

  for (const [muster, name] of PFLICHT) {
    if (!html.includes(muster)) meckern(`${s.pfad}: ${name} fehlt`);
  }

  // Canonical muss auf die eigene Adresse zeigen — ein kopierter Canonical
  // aus einer anderen Seite sagt der Suchmaschine, sie solle diese hier
  // ignorieren. Das ist schlimmer als gar keiner.
  const kanon = html.match(/rel="canonical" href="([^"]+)"/);
  if (kanon && kanon[1] !== BASIS + s.pfad) {
    meckern(`${s.pfad}: Canonical zeigt auf ${kanon[1]}`);
  }

  const ogUrl = html.match(/property="og:url" content="([^"]+)"/);
  if (ogUrl && ogUrl[1] !== BASIS + s.pfad) {
    meckern(`${s.pfad}: og:url zeigt auf ${ogUrl[1]}`);
  }

  // Strukturierte Daten muessen gueltiges JSON sein. Ein Komma zu viel und
  // der ganze Block wird stillschweigend ignoriert — ohne Fehlermeldung
  // irgendwo, das ist die Tuecke daran.
  const bloecke = [...html.matchAll(
    /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g,
  )];
  for (const [, roh] of bloecke) {
    try {
      JSON.parse(roh);
    } catch (e) {
      meckern(`${s.pfad}: ld+json ist kaputt — ${e.message}`);
    }
  }
  if (bloecke.length) console.log(`  ${bloecke.length} Datenblock/-bloecke, gueltig`);
}

// ─── Sitemap ─────────────────────────────────────────────────────────────────
console.log('\nsitemap.xml');
const sitemap = readFileSync(join(HIER, 'sitemap.xml'), 'utf8');
const gelistet = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
for (const s of seiten) {
  const drin = gelistet.includes(BASIS + s.pfad);
  if (s.noindex) {
    // Andersherum falsch: Eine Seite auf noindex zu setzen und sie
    // trotzdem einzureichen, ist ein Widerspruch, den Google meldet.
    if (drin) meckern(`${s.pfad} ist noindex, steht aber in der Sitemap`);
    continue;
  }
  if (!drin) meckern(`${s.pfad} fehlt in der Sitemap`);
}
for (const l of gelistet) {
  if (!seiten.some((s) => BASIS + s.pfad === l)) meckern(`${l} steht in der Sitemap, aber die Seite gibt es nicht`);
}
if (!sitemap.includes('<lastmod>')) meckern('Sitemap ohne <lastmod>');
console.log(`  ${gelistet.length} Adressen`);

// ─── Vorschaubild ────────────────────────────────────────────────────────────
console.log('\nmedia/og/start.png');
try {
  const png = readFileSync(join(HIER, 'media/og/start.png'));
  // Bei einem PNG stehen Breite und Hoehe im IHDR-Block, ab Byte 16, je vier
  // Bytes gross und big-endian. Dafuer braucht es keine Bibliothek.
  const breit = png.readUInt32BE(16);
  const hoch = png.readUInt32BE(20);
  console.log(`  ${breit}x${hoch}, ${(png.length / 1024).toFixed(0)} KB`);
  if (breit !== 1200 || hoch !== 630) meckern('Vorschaubild ist nicht 1200x630');
  // Facebook lehnt ueber 8 MB ab, WhatsApp laedt ueber ~300 KB oft gar nicht
  // erst nach. Unter 1 MB ist die sichere Seite.
  if (png.length > 1024 * 1024) meckern('Vorschaubild ueber 1 MB — wird nicht ueberall geladen');
} catch {
  meckern('media/og/start.png fehlt');
}

// ─── robots.txt ──────────────────────────────────────────────────────────────
console.log('\nrobots.txt');
const robots = readFileSync(join(HIER, 'robots.txt'), 'utf8');
if (!robots.includes('Sitemap:')) meckern('robots.txt nennt die Sitemap nicht');
if (/Disallow:\s*\/\s*$/m.test(robots)) meckern('robots.txt sperrt die ganze Seite aus');
console.log('  in Ordnung');

console.log(fehler === 0 ? '\nAlles gruen.' : `\n${fehler} Fehler.`);
process.exit(fehler === 0 ? 0 : 1);
