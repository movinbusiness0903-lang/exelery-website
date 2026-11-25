// Baut die Ratgeberseiten unter /ratgeber/ aus den Nährwerten der App.
//
// Quelle ist allein `src/data/basicFoods.ts` im App-Repo (Werte je 100 g bzw.
// 100 ml). Keine zweite Liste: Die Website zeigt dieselben Zahlen wie die App.
// Keine Gesundheitsaussagen ohne Quelle (Kevin: nur mit Beleg). Die Seiten
// ordnen nur unsere eigenen Zahlen.
//
// Gestaltung (25.11.2026, Kevin: „sieht sehr nach AI aus“) nach
// „Claude Webdesign-Paket / 02 Design-Regeln gegen KI-Slop“ im Vault:
// Manrope für Überschriften + Inter für Text (lokal), harte Größenkontraste,
// Flächen statt Ränder, Tabellenziffern, EIN Blickfang (Küchen-Kulisse der
// Startseite, media/backdrops/kueche.webp), echtes Chevron-Logo.
//
// Aufruf: node ratgeber-bauen.mjs   (schreibt ratgeber/**/index.html)
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HIER = dirname(fileURLToPath(import.meta.url));
const QUELLE = join(HIER, '..', 'Exelery', 'src', 'data', 'basicFoods.ts');
const STAND = '25. November 2026';

// ── 1 · Einlesen, mit Abteilung aus den Zwischenüberschriften ─────────────
const ABTEILUNG = {
  'Obst': 'Obst', 'Gemuese': 'Gemüse', 'Fleisch & Fisch': 'Fleisch & Fisch',
  'Eier & Milchprodukte': 'Eier & Milchprodukte', 'Getreide & Beilagen': 'Getreide & Beilagen',
  'Huelsenfruechte, Nuesse, Samen': 'Hülsenfrüchte, Nüsse & Samen', 'Fette & Oele': 'Fette & Öle',
  'Getraenke': 'Getränke', 'Suesses & Snacks': 'Süßes & Snacks', 'Sonstiges': 'Saucen & Sonstiges',
};
const text = readFileSync(QUELLE, 'utf8');
const lebensmittel = [];
let abt = null;
for (const zeile of text.split(/\r?\n/)) {
  const k = zeile.match(/^\s*\/\/ ── ([^─(]+?)\s*(\([^)]*\))?\s*─/);
  if (k) {
    abt = ABTEILUNG[k[1].trim()];
    if (!abt) throw new Error(`Unbekannte Abteilung „${k[1]}“`);
    continue;
  }
  const m = zeile.match(/^\s*\['([^']+)',\s*'([^']*)',\s*'[^']*',\s*([^\]]+)\]/);
  if (!m) continue;
  const z = m[3].split(',').map((t) => t.trim());
  const n = (i) => (z[i] === undefined || z[i] === 'null' || z[i] === '' ? null : Number(z[i]));
  if (!abt) throw new Error(`${m[1]} steht vor der ersten Abteilung`);
  lebensmittel.push({
    name: m[1], abt, kcal: n(0), eiweiss: n(1), kh: n(2), fett: n(3), ballast: n(4),
    stueck: n(6), fluessig: z[7] === 'true',
  });
}
// Selbstprüfung mit einem ANDEREN, groben Muster: jede Tupel-Zeile muss ankommen.
const tupel = (text.match(/^\s*\['[^']+',\s*'[^']*',\s*'[^']*',/gm) || []).length;
if (tupel < 250 || lebensmittel.length !== tupel) {
  throw new Error(`${tupel} Tupel-Zeilen, aber ${lebensmittel.length} gelesen`);
}
for (const l of lebensmittel) {
  for (const f of ['kcal', 'eiweiss', 'kh', 'fett']) {
    if (typeof l[f] !== 'number' || Number.isNaN(l[f])) throw new Error(`${l.name}: ${f} fehlt`);
  }
}

// ── 2 · Bausteine ─────────────────────────────────────────────────────────
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const zahl = (v, st = 1) => (v === null || v === undefined ? '–'
  : Number(v).toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: st }));

const SCHRIFTEN = [['Inter', 400, 'inter'], ['Inter', 600, 'inter'], ['Manrope', 700, 'manrope'], ['Manrope', 800, 'manrope']]
  .flatMap(([fam, w, datei]) => [
    `@font-face{font-family:'${fam}';font-style:normal;font-weight:${w};font-display:swap;src:url(/media/fonts/${datei}-latin.woff2) format('woff2');unicode-range:U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD;}`,
    `@font-face{font-family:'${fam}';font-style:normal;font-weight:${w};font-display:swap;src:url(/media/fonts/${datei}-latin-ext.woff2) format('woff2');unicode-range:U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+1E00-1E9F,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF;}`,
  ]).join('\n  ');

// Das echte Zeichen: ZWEI Chevrons (nie ein Punkt), wie auf der Startseite.
const LOGO = `<svg class="mark" viewBox="0 0 100 100" fill="none" aria-hidden="true">
      <defs><linearGradient id="mintgrad" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#6FFFD0"/><stop offset="1" stop-color="#0DF2A3"/></linearGradient></defs>
      <path d="M30 24 L58 50 L30 76" stroke="url(#mintgrad)" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M52 24 L80 50 L52 76" stroke="#F8FAFC" stroke-width="9" stroke-linecap="round" stroke-linejoin="round" opacity=".9"/>
    </svg>`;

function seite({ pfad, titel, beschreibung, h1, lead, inhalt, krumen, bild }) {
  if (!bild) throw new Error(`${pfad}: kein Bild`);
  const url = `https://exelery.de/${pfad}`;
  const ld = {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'WebPage', '@id': `${url}#seite`, url, name: titel, description: beschreibung,
        inLanguage: 'de-DE', isPartOf: { '@id': 'https://exelery.de/#website' }, dateModified: '2026-11-25' },
      { '@type': 'BreadcrumbList', itemListElement: krumen.map(([n, u], i) => (
        { '@type': 'ListItem', position: i + 1, name: n, item: `https://exelery.de/${u}` })) },
    ],
  };
  return `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'self'; base-uri 'self'; object-src 'none'; form-action 'self'; img-src 'self' data:; font-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; connect-src 'self'">
  <meta name="referrer" content="strict-origin-when-cross-origin">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(titel)}</title>
<meta name="robots" content="index, follow">
<meta name="theme-color" content="#0B0F17">
<link rel="icon" href="/favicon.ico" sizes="48x48">
<link rel="icon" type="image/png" sizes="192x192" href="/favicon-192.png">
<link rel="icon" type="image/svg+xml" href="/favicon.svg">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="canonical" href="${url}">
<link rel="preload" as="image" href="/media/ratgeber/${bild}" type="image/webp">
<script src="/phase.js"></script>
<meta name="description" content="${esc(beschreibung)}">
<meta property="og:type" content="article">
<meta property="og:site_name" content="Exelery">
<meta property="og:locale" content="de_DE">
<meta property="og:url" content="${url}">
<meta property="og:title" content="${esc(titel)}">
<meta property="og:description" content="${esc(beschreibung)}">
<meta property="og:image" content="https://exelery.de/media/og/start.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="Das Exelery-Zeichen mit dem Schriftzug EXELERY vor einem dunklen Trainingsraum">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:site" content="@Exelery_App">
<meta name="twitter:title" content="${esc(titel)}">
<meta name="twitter:description" content="${esc(beschreibung)}">
<meta name="twitter:image" content="https://exelery.de/media/og/start.png">
<style>
  ${SCHRIFTEN}
  :root{
    --bg:#0B0F17;--flaeche:#121927;--flaeche-2:#18202F;
    --text:#F8FAFC;--muted:#94A3B8;--leise:#64748B;--accent:#0DF2A3;
    --linie:rgba(255,255,255,.06);
    --rand:clamp(16px,5vw,48px);--breit:1080px;
    --kopf:'Manrope',system-ui,sans-serif;--fliess:'Inter',system-ui,sans-serif;
  }
  *{box-sizing:border-box;}
  html{background:var(--bg);-webkit-text-size-adjust:100%;}
  body{margin:0;background:var(--bg);color:var(--text);font-family:var(--fliess);font-size:16px;line-height:1.65;}
  a{color:var(--accent);text-underline-offset:3px;}
  a:hover{text-decoration:none;}
  :focus-visible{outline:2px solid var(--accent);outline-offset:3px;border-radius:4px;}
  .innen{max-width:var(--breit);margin:0 auto;padding:0 var(--rand);}

  /* Kopf: Zeichen links, ein leiser Weg zur Warteliste rechts */
  .leiste{position:absolute;inset:0 0 auto;z-index:3;}
  .leiste .innen{display:flex;align-items:center;justify-content:space-between;height:72px;}
  .brand{display:flex;align-items:center;gap:10px;color:var(--text);text-decoration:none;font-family:var(--kopf);font-weight:700;letter-spacing:.18em;font-size:.9rem;}
  .brand .mark{width:26px;height:26px;}
  .leiste .weg{color:var(--text);font-size:.92rem;font-weight:600;text-decoration:none;opacity:.85;}
  .leiste .weg:hover{opacity:1;color:var(--accent);}

  /* Der eine Blickfang: Kulisse, nach unten in den Grund auslaufend */
  .buehne{position:relative;overflow:hidden;padding:150px 0 56px;isolation:isolate;}
  .buehne::before{content:"";position:absolute;inset:0;z-index:-2;background:var(--kulisse) center 45%/cover no-repeat;opacity:.5;transform:scale(1.04);}
  .buehne::after{content:"";position:absolute;inset:0;z-index:-1;background:linear-gradient(180deg,rgba(11,15,23,.55) 0%,rgba(11,15,23,.35) 35%,var(--bg) 100%),linear-gradient(90deg,rgba(11,15,23,.85) 0%,rgba(11,15,23,.2) 70%);}
  nav.krumen{font-size:.84rem;color:var(--muted);margin-bottom:22px;}
  nav.krumen a{color:var(--muted);text-decoration:none;}
  nav.krumen a:hover{color:var(--text);}
  h1{font-family:var(--kopf);font-weight:800;font-size:clamp(2.4rem,6.4vw,4.6rem);line-height:1.04;letter-spacing:-.035em;margin:0 0 20px;max-width:15ch;text-wrap:balance;}
  .lead{font-size:clamp(1.02rem,1.6vw,1.2rem);color:#CBD5E1;max-width:58ch;margin:0;text-wrap:pretty;}
  .stand{font-size:.8rem;color:var(--leise);margin-top:18px;}

  main{padding-bottom:40px;}
  h2{font-family:var(--kopf);font-weight:700;font-size:clamp(1.5rem,3vw,2rem);letter-spacing:-.02em;line-height:1.15;margin:88px 0 10px;text-wrap:balance;}
  h2 + p{margin-top:0;}
  p{max-width:68ch;}
  .klein{color:var(--muted);font-size:.86rem;}

  /* Eine große Kennzahl statt eines Textkastens */
  .kennzahl{display:grid;grid-template-columns:1.4fr 1fr;gap:16px;margin-top:8px;}
  .kz{background:var(--flaeche);border-radius:18px;padding:26px 28px;}
  .kz .wert{font-family:var(--kopf);font-weight:800;font-size:clamp(3rem,8vw,5.2rem);line-height:.95;letter-spacing:-.04em;color:var(--accent);font-variant-numeric:tabular-nums;}
  .kz .wert small{font-size:.38em;letter-spacing:0;margin-left:6px;color:var(--text);font-weight:700;}
  .kz .was{margin-top:14px;font-family:var(--kopf);font-weight:700;font-size:1.3rem;letter-spacing:-.01em;}
  .kz .wozu{color:var(--muted);font-size:.9rem;margin-top:4px;}
  .kz-liste{display:grid;gap:16px;}
  .kz-liste .kz{padding:20px 24px;display:flex;align-items:baseline;justify-content:space-between;gap:12px;}
  .kz-liste .wert{font-size:2.3rem;color:var(--text);}
  .kz-liste .wert small{font-size:.5em;margin-left:3px;color:var(--muted);}
  .kz-liste .was{margin:0;font-family:var(--fliess);font-size:1rem;color:var(--muted);font-weight:600;letter-spacing:0;text-align:right;}

  /* Tabellen: Fläche statt Rand, ruhige Zeilen, Ziffern untereinander */
  .tabelle{overflow-x:auto;-webkit-overflow-scrolling:touch;margin:22px 0 10px;border-radius:16px;background:var(--flaeche);}
  table{border-collapse:collapse;width:100%;font-size:.95rem;font-variant-numeric:tabular-nums;}
  th,td{padding:13px 18px;text-align:right;white-space:nowrap;}
  th:first-child,td:first-child{text-align:left;white-space:normal;min-width:10em;}
  thead th{position:sticky;top:0;background:var(--flaeche-2);color:var(--muted);font-weight:600;font-size:.8rem;letter-spacing:.02em;}
  tbody tr + tr td{border-top:1px solid var(--linie);}
  tbody tr:hover td{background:rgba(255,255,255,.025);}
  td.hl{color:var(--accent);font-weight:600;}
  td .zusatz{color:var(--leise);font-size:.82rem;}

  .suche{width:100%;max-width:520px;padding:15px 18px;border-radius:14px;border:1px solid transparent;background:var(--flaeche);color:var(--text);font:inherit;font-size:16px;}
  .suche::placeholder{color:var(--leise);}
  .suche:focus{outline:none;border-color:rgba(13,242,163,.5);}
  .sprung{display:flex;flex-wrap:wrap;gap:8px;margin:18px 0 0;padding:0;list-style:none;}
  .sprung a{display:inline-block;padding:7px 13px;border-radius:999px;background:var(--flaeche);color:var(--text);text-decoration:none;font-size:.86rem;}
  .sprung a:hover{background:var(--flaeche-2);color:var(--accent);}

  /* Übersicht: ein großes Element, ein kleines */
  .karten{display:grid;grid-template-columns:1.35fr 1fr;grid-template-areas:"a b" "a c";gap:16px;margin-top:8px;}
  .karten .karte:nth-child(1){grid-area:a;min-height:536px;}
  .karten .karte:nth-child(2){grid-area:b;}
  .karten .karte:nth-child(3){grid-area:c;}
  .karte{position:relative;display:flex;flex-direction:column;justify-content:flex-end;min-height:260px;border-radius:20px;padding:28px;background:var(--flaeche);color:var(--text);text-decoration:none;overflow:hidden;isolation:isolate;transition:transform .25s ease,background .25s ease;}
  .karte.bild::before{content:"";position:absolute;inset:0;z-index:-2;background:var(--kulisse) var(--pos,center)/var(--groesse,cover) no-repeat;opacity:.6;transition:opacity .3s ease,transform .6s ease;}
  .karte.bild::after{content:"";position:absolute;inset:0;z-index:-1;background:linear-gradient(0deg,rgba(18,25,39,.96) 12%,rgba(18,25,39,.55) 45%,rgba(18,25,39,0) 100%);}
  .karte:hover{transform:translateY(-2px);background:var(--flaeche-2);}
  .karte.bild:hover::before{opacity:.75;transform:scale(1.03);}
  .karte strong{font-family:var(--kopf);font-weight:800;font-size:clamp(1.4rem,2.6vw,1.9rem);letter-spacing:-.02em;line-height:1.15;}
  .karte span{color:var(--muted);margin-top:8px;max-width:40ch;}
  .karte .pfeil{position:absolute;top:24px;right:26px;color:var(--accent);font-size:1.3rem;transition:transform .25s ease;}
  .karte:hover .pfeil{transform:translateX(4px);}

  .rechner{margin-top:18px;}
  .rechner .suche{max-width:200px;margin-top:6px;font-family:var(--kopf);font-weight:700;font-size:1.3rem;}
  .rechner-ergebnis{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:18px;}
  .rechner-ergebnis .wert{font-size:clamp(2.6rem,6vw,3.8rem);}
  .rechner-ergebnis .kz:last-child .wert{color:var(--text);}
  .quellen{padding-left:1.2em;max-width:76ch;color:#CBD5E1;font-size:.92rem;}
  .quellen li{margin:.55em 0;}
  .app{margin-top:96px;background:var(--flaeche);border-radius:20px;padding:30px 32px;display:flex;align-items:center;justify-content:space-between;gap:24px;flex-wrap:wrap;}
  .app p{margin:0;max-width:52ch;color:#CBD5E1;}
  .app strong{display:block;font-family:var(--kopf);font-size:1.25rem;color:var(--text);margin-bottom:4px;}
  .knopf{display:inline-block;background:var(--accent);color:#04140E;font-weight:700;text-decoration:none;padding:13px 22px;border-radius:999px;transition:transform .15s ease;}
  .knopf:active{transform:scale(.97);}

  footer{margin-top:72px;border-top:1px solid var(--linie);padding:28px 0 48px;color:var(--leise);font-size:.84rem;}
  footer .innen{display:flex;justify-content:space-between;gap:16px;flex-wrap:wrap;}
  footer a{color:var(--muted);text-decoration:none;margin-right:16px;}
  footer a:hover{color:var(--text);}

  @media (max-width:720px){
    .buehne{padding:118px 0 40px;}
    .kennzahl,.karten,.rechner-ergebnis{grid-template-columns:1fr;}
    .karten{grid-template-areas:"a" "b" "c";}
    .karten .karte:nth-child(1){min-height:300px;}
    .karte{min-height:200px;}
    h2{margin-top:64px;}
    th,td{padding:11px 12px;}
    .app{padding:24px;}
  }
  .ohne-warteliste [data-warteliste]{display:none!important;}
  @media (prefers-reduced-motion:reduce){*{transition:none!important;}}
</style>
</head>
<body>

<header class="leiste">
  <div class="innen">
    <a class="brand" href="/">${LOGO}
    <span>EXELERY</span></a>
    <a class="weg" href="/#warteliste" data-warteliste>Warteliste</a>
  </div>
</header>

<section class="buehne" style="--kulisse:url(/media/ratgeber/${bild})">
  <div class="innen">
    <nav class="krumen" aria-label="Brotkrumen">${krumen.map(([n, u], i) => (i === krumen.length - 1 ? esc(n) : `<a href="/${u}">${esc(n)}</a>`)).join(' / ')}</nav>
    <h1>${esc(h1)}</h1>
    <p class="lead">${lead}</p>
    <p class="stand">Stand ${STAND} · Zahlen aus der Lebensmittel-Datenbank der Exelery-App</p>
  </div>
</section>

<main class="innen">
${inhalt}

<div class="app">
  <p><strong>Mit diesen Werten rechnet die App.</strong>In Exelery trägst du ein Lebensmittel per Suche, Foto oder Barcode ein. Kalorien und Makros kommen aus genau diesen Zahlen.</p>
  <a class="knopf" href="/#warteliste" data-warteliste>Auf die Warteliste</a>
</div>

<p class="klein" style="margin-top:28px">Alle Werte je 100&nbsp;g, Getränke je 100&nbsp;ml. Fleisch und Fisch roh, so wie auf der Packung; gegarte Fassungen stehen als eigene Zeile. Bei Markenware gilt die Nährwerttabelle auf der Packung.</p>
</main>

<footer>
  <div class="innen">
    <div><a href="/ratgeber/">Ratgeber</a><a href="/faq/">Häufige Fragen</a><a href="/impressum/">Impressum</a><a href="/datenschutz/">Datenschutz</a></div>
    <div>© 2026 Exelery GbR</div>
  </div>
</footer>

<script type="application/ld+json">
${JSON.stringify(ld, null, 2)}
</script>

</body>
</html>
`;
}

function tabelle(kopf, zeilen, { hl } = {}) {
  return `<div class="tabelle"><table>
<thead><tr>${kopf.map((k) => `<th scope="col">${k}</th>`).join('')}</tr></thead>
<tbody>
${zeilen.map((z) => `<tr>${z.map((c, i) => (i === 0 ? `<td>${c}</td>` : `<td${hl === i ? ' class="hl"' : ''}>${c}</td>`)).join('')}</tr>`).join('\n')}
</tbody></table></div>`;
}

function schreiben(pfad, html) {
  const ordner = join(HIER, pfad);
  mkdirSync(ordner, { recursive: true });
  writeFileSync(join(ordner, 'index.html'), html);
}

// ── 3 · Eiweißreiche Lebensmittel ─────────────────────────────────────────
// Nur Lebensmittel, keine Fertigprodukte wie Proteinpulver und -riegel.
// Gegarte Zeilen („…, gebraten“, „…, gekocht“) bleiben aus den Ranglisten
// heraus: sonst stünde dasselbe Lebensmittel zweimal da, einmal mit Wasser-
// verlust aufgebläht. Sie stehen in der Kalorientabelle.
const NATUR = new Set(['Obst', 'Gemüse', 'Fleisch & Fisch', 'Eier & Milchprodukte',
  'Getreide & Beilagen', 'Hülsenfrüchte, Nüsse & Samen']);
const PFLANZE = new Set(['Obst', 'Gemüse', 'Getreide & Beilagen', 'Hülsenfrüchte, Nüsse & Samen']);
const gegart = (l) => /, (gebraten|gekocht)$/.test(l.name);
const natur = lebensmittel.filter((l) => NATUR.has(l.abt) && !gegart(l));
const nachEiweiss = [...natur].sort((a, b) => b.eiweiss - a.eiweiss || a.name.localeCompare(b.name, 'de'));
const top = nachEiweiss.slice(0, 25);
const proKcal = (l) => (l.kcal > 0 ? (l.eiweiss / l.kcal) * 100 : 0);
const nachDichte = natur.filter((l) => l.eiweiss >= 5)
  .sort((a, b) => proKcal(b) - proKcal(a) || a.name.localeCompare(b.name, 'de')).slice(0, 20);
const pflanzlich = nachEiweiss.filter((l) => PFLANZE.has(l.abt)).slice(0, 15);
const kzKlein = (l) => `<div class="kz"><div class="wert">${zahl(l.eiweiss)}<small>g</small></div><div class="was">${esc(l.name)}</div></div>`;

schreiben('ratgeber/eiweissreiche-lebensmittel', seite({
  pfad: 'ratgeber/eiweissreiche-lebensmittel/',
  bild: 'eiweiss.webp',
  titel: 'Eiweißreiche Lebensmittel: Tabelle je 100 g – Exelery',
  beschreibung: `Die eiweißreichsten Lebensmittel je 100 g und je 100 kcal, dazu die besten pflanzlichen Quellen. ${natur.length} Grundnahrungsmittel aus der Exelery-Datenbank.`,
  h1: 'Eiweißreiche Lebensmittel',
  lead: `Welche Lebensmittel haben am meisten Eiweiß? ${natur.length} Grundnahrungsmittel, sortiert nach Eiweiß je 100&nbsp;g und je 100&nbsp;kcal.`,
  krumen: [['Exelery', ''], ['Ratgeber', 'ratgeber/'], ['Eiweißreiche Lebensmittel', 'ratgeber/eiweissreiche-lebensmittel/']],
  inhalt: `<h2 id="kurz">Kurz gesagt</h2>
<div class="kennzahl">
  <div class="kz"><div class="wert">${zahl(top[0].eiweiss)}<small>g Eiweiß</small></div><div class="was">${esc(top[0].name)}</div><div class="wozu">je 100&nbsp;g, Platz 1 in unserer Datenbank</div></div>
  <div class="kz-liste">${top.slice(1, 3).map(kzKlein).join('')}</div>
</div>
<p class="klein" style="margin-top:14px">Wer auf Kalorien achtet, schaut besser auf die zweite Tabelle: Eiweiß je 100&nbsp;kcal.</p>

<h2 id="je-100-g">Die 25 eiweißreichsten je 100&nbsp;g</h2>
${tabelle(['Lebensmittel', 'Eiweiß', 'kcal', 'Kohlenhydrate', 'Fett'],
    top.map((l) => [esc(l.name), `${zahl(l.eiweiss)} g`, zahl(l.kcal, 0), `${zahl(l.kh)} g`, `${zahl(l.fett)} g`]), { hl: 1 })}
<p class="klein">Proteinpulver und Proteinriegel sind bewusst nicht dabei. Die Tabelle zeigt nur Lebensmittel.</p>

<h2 id="je-100-kcal">Am meisten Eiweiß je 100&nbsp;kcal</h2>
<p>Wie viel Eiweiß du für 100 Kalorien bekommst. Berücksichtigt sind Lebensmittel mit mindestens 5&nbsp;g Eiweiß je 100&nbsp;g.</p>
${tabelle(['Lebensmittel', 'Eiweiß je 100 kcal', 'Eiweiß je 100 g', 'kcal je 100 g'],
    nachDichte.map((l) => [esc(l.name), `${zahl(proKcal(l))} g`, `${zahl(l.eiweiss)} g`, zahl(l.kcal, 0)]), { hl: 1 })}

<h2 id="pflanzlich">Pflanzliche Eiweißquellen</h2>
${tabelle(['Lebensmittel', 'Eiweiß', 'kcal', 'Ballaststoffe'],
    pflanzlich.map((l) => [esc(l.name), `${zahl(l.eiweiss)} g`, zahl(l.kcal, 0), `${zahl(l.ballast)} g`]), { hl: 1 })}
<p class="klein">Trockenware wie Linsen oder Haferflocken steht im ungekochten Zustand, so wie auf der Packung.</p>

<p style="margin-top:32px">Alle Lebensmittel mit Kalorien und Makros stehen in der <a href="/ratgeber/kalorientabelle/">Kalorientabelle</a>.</p>`,
}));

// ── 4 · Kalorientabelle ───────────────────────────────────────────────────
const abteilungen = [...new Set(lebensmittel.map((l) => l.abt))];
const reihenfolge = Object.values(ABTEILUNG).filter((a) => abteilungen.includes(a));
const kat = reihenfolge.map((a) => {
  const liste = lebensmittel.filter((l) => l.abt === a).sort((x, y) => x.name.localeCompare(y.name, 'de'));
  const anker = a.toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return { a, anker, liste };
});
schreiben('ratgeber/kalorientabelle', seite({
  pfad: 'ratgeber/kalorientabelle/',
  bild: 'kalorien.webp',
  titel: `Kalorientabelle: ${lebensmittel.length} Lebensmittel mit Makros – Exelery`,
  beschreibung: `Kalorien, Eiweiß, Kohlenhydrate, Fett und Ballaststoffe je 100 g für ${lebensmittel.length} Grundnahrungsmittel, nach Abteilung sortiert und durchsuchbar.`,
  h1: 'Kalorientabelle mit Makros',
  lead: `Kalorien, Eiweiß, Kohlenhydrate, Fett und Ballaststoffe für ${lebensmittel.length} Grundnahrungsmittel, je 100&nbsp;g. Derselbe Bestand, mit dem die Exelery-App rechnet.`,
  krumen: [['Exelery', ''], ['Ratgeber', 'ratgeber/'], ['Kalorientabelle', 'ratgeber/kalorientabelle/']],
  inhalt: `<label class="klein" for="suche" style="display:block;margin:40px 0 8px">Lebensmittel suchen</label>
<input class="suche" id="suche" type="search" placeholder="z. B. Haferflocken" autocomplete="off">
<p class="klein" id="treffer" aria-live="polite" style="min-height:1.6em;margin:8px 0 0"></p>
<ul class="sprung" aria-label="Abteilungen">${kat.map((k) => `<li><a href="#${k.anker}">${esc(k.a)}</a></li>`).join('')}</ul>
${kat.map((k) => `<section class="abt" id="${k.anker}">
<h2>${esc(k.a)}</h2>
${tabelle(['Lebensmittel', 'kcal', 'Eiweiß', 'Kohlenhydrate', 'Fett', 'Ballaststoffe'],
    k.liste.map((l) => [`${esc(l.name)}${l.fluessig ? ' <span class="zusatz">je 100 ml</span>' : ''}${l.stueck ? ` <span class="zusatz">· 1 Stück ≈ ${zahl(l.stueck, 0)} g</span>` : ''}`,
      zahl(l.kcal, 0), `${zahl(l.eiweiss)} g`, `${zahl(l.kh)} g`, `${zahl(l.fett)} g`, l.ballast === null ? '–' : `${zahl(l.ballast)} g`]), { hl: 1 })}
</section>`).join('\n')}
<script>
(function(){
  var feld=document.getElementById('suche'), info=document.getElementById('treffer');
  var norm=function(s){return s.toLowerCase().normalize('NFD').replace(/[\\u0300-\\u036f]/g,'').replace(/ß/g,'ss');};
  feld.addEventListener('input',function(){
    var q=norm(feld.value.trim()), n=0;
    document.querySelectorAll('section.abt').forEach(function(sec){
      var sichtbar=0;
      sec.querySelectorAll('tbody tr').forEach(function(tr){
        var ok=!q||norm(tr.cells[0].textContent).indexOf(q)>=0;
        tr.hidden=!ok; if(ok) sichtbar++;
      });
      sec.hidden=sichtbar===0; n+=sichtbar;
    });
    info.textContent=q?(n===0?'Kein Treffer':n+' Treffer'):'';
  });
})();
</script>
<p style="margin-top:32px">Die eiweißreichsten davon stehen sortiert unter <a href="/ratgeber/eiweissreiche-lebensmittel/">Eiweißreiche Lebensmittel</a>.</p>`,
}));

// ── 5 · Wie viel Eiweiß brauche ich? ──────────────────────────────────────
// ⚠️ Gesundheitsaussagen NUR mit Quelle (Kevin). Belegt am 25.11.2026:
//   DGE-Referenzwert Protein (Stand 2017), dge.de/wissenschaft/referenzwerte/protein/:
//     Erwachsene 19 bis unter 65: 0,8 g/kg; ab 65: 1,0 g/kg (Schätzwert);
//     Breitensport (4–5 × 30 min mittlere Intensität) braucht nicht mehr.
//   Nunes et al. 2022, J Cachexia Sarcopenia Muscle 13(2):795–810,
//     doi:10.1002/jcsm.12922 (74 RCT, Scholar Gateway): mit Krafttraining
//     kleiner Zusatzgewinn an Muskelmasse unter 65 ab ≥ 1,6 g/kg/Tag,
//     ab 65 bei 1,2–1,59 g/kg/Tag.
//   Tarnopolsky 2008, Eur J Sport Sci 8(2):67–76, doi:10.1080/17461390801919128:
//     Leistungssport höchstens etwa 1,7 g/kg/Tag, mit ausreichender
//     Energiezufuhr leicht zu erreichen.
//   Khazrai et al. 2014, Diabetes Metab Res Rev 30(S1):24–33,
//     doi:10.1002/dmrr.2515: bei chronischer Nierenerkrankung empfiehlt die
//     ADA weniger Eiweiß (0,8–1,0 g/kg).
const nach = (n) => lebensmittel.find((l) => l.name === n);
const BEISPIELE = ['Hähnchenbrust', 'Magerquark', 'Linsen, roh', 'Ei', 'Tofu', 'Haferflocken']
  .map(nach).filter(Boolean);
if (BEISPIELE.length < 5) throw new Error('Beispiel-Lebensmittel fehlen im Bestand');
schreiben('ratgeber/eiweissbedarf', seite({
  pfad: 'ratgeber/eiweissbedarf/',
  bild: 'bedarf.webp',
  titel: 'Wie viel Eiweiß brauche ich am Tag? Rechner mit Quellen – Exelery',
  beschreibung: 'Eiweißbedarf pro Kilogramm Körpergewicht: DGE-Referenzwert für Erwachsene, was Studien für Krafttraining zeigen, mit Rechner und Beispielen aus der Exelery-Datenbank.',
  h1: 'Wie viel Eiweiß brauche ich?',
  lead: 'Für Erwachsene empfiehlt die Deutsche Gesellschaft für Ernährung 0,8&nbsp;g Eiweiß je Kilogramm Körpergewicht am Tag. Wer gezielt Kraft trainiert, kann laut Studien von mehr profitieren.',
  krumen: [['Exelery', ''], ['Ratgeber', 'ratgeber/'], ['Eiweißbedarf', 'ratgeber/eiweissbedarf/']],
  inhalt: `<h2 id="kurz">Kurz gesagt</h2>
<div class="kennzahl">
  <div class="kz"><div class="wert">0,8<small>g je kg</small></div><div class="was">Erwachsene bis 64 Jahre</div><div class="wozu">Referenzwert der DGE, am Tag. Ab 65 Jahren: 1,0&nbsp;g je kg.</div></div>
  <div class="kz-liste">
    <div class="kz"><div class="wert">1,6<small>g</small></div><div class="was">mit Krafttraining, unter 65</div></div>
    <div class="kz"><div class="wert">1,7<small>g</small></div><div class="was">obere Grenze im Leistungssport</div></div>
  </div>
</div>

<h2 id="rechner">Dein Bedarf in Gramm</h2>
<p>Trag dein Körpergewicht ein. Bei Übergewicht rechnet die DGE mit dem Normalgewicht.</p>
<div class="rechner">
  <label class="klein" for="gewicht">Körpergewicht in kg</label>
  <input class="suche" id="gewicht" type="number" inputmode="decimal" min="30" max="250" step="1" value="75">
  <div class="rechner-ergebnis" aria-live="polite">
    <div class="kz"><div class="wert" data-faktor="0.8">60<small>g</small></div><div class="was">Grundbedarf (0,8&nbsp;g je kg)</div></div>
    <div class="kz"><div class="wert" data-faktor="1.6">120<small>g</small></div><div class="was">mit Krafttraining (1,6&nbsp;g je kg)</div></div>
  </div>
</div>

<h2 id="beispiele">Was das auf dem Teller heißt</h2>
<p>So viel von einem Lebensmittel liefert <strong data-ziel>60</strong>&nbsp;g Eiweiß. Gerechnet mit den Werten der App, je 100&nbsp;g roh.</p>
${tabelle(['Lebensmittel', 'Eiweiß je 100 g', 'Menge für dein Ziel'],
    BEISPIELE.map((l) => [esc(l.name), `${zahl(l.eiweiss)} g`, `<span data-eiweiss="${l.eiweiss}">–</span>`]), { hl: 2 })}
<p class="klein">Niemand isst das an einem Tag von nur einem Lebensmittel. Die Tabelle zeigt nur, wie groß die Unterschiede sind. Mehr Lebensmittel stehen unter <a href="/ratgeber/eiweissreiche-lebensmittel/">Eiweißreiche Lebensmittel</a>.</p>

<h2 id="studien">Was die Studien sagen</h2>
<p><strong>Ohne Krafttraining:</strong> Die DGE hält 0,8&nbsp;g je kg für Erwachsene bis 64 Jahre für ausreichend. Auch Breitensport, also vier- bis fünfmal pro Woche 30 Minuten bei mittlerer Intensität, erhöht den Bedarf laut DGE nicht.</p>
<p><strong>Mit Krafttraining:</strong> Eine Auswertung von 74 Studien fand einen kleinen zusätzlichen Gewinn an Muskelmasse, wenn Menschen unter 65 Jahren mindestens 1,6&nbsp;g je kg am Tag aßen. Bei Menschen ab 65 zeigte er sich schon bei 1,2 bis 1,59&nbsp;g. Der Effekt war klein, und auf die Griffkraft wirkte mehr Eiweiß kaum.</p>
<p><strong>Leistungssport:</strong> Eine Übersichtsarbeit nennt etwa 1,7&nbsp;g je kg als Obergrenze des Bedarfs. Wer genug Energie zu sich nimmt, erreicht das meist schon über das normale Essen.</p>
<p><strong>Bei Nierenerkrankungen</strong> gelten andere Werte. Die Amerikanische Diabetes-Gesellschaft empfiehlt dann weniger Eiweiß. Sprich in dem Fall vorher mit deiner Ärztin oder deinem Arzt.</p>

<h2 id="quellen">Quellen</h2>
<ul class="quellen">
  <li>Deutsche Gesellschaft für Ernährung: <a href="https://www.dge.de/wissenschaft/referenzwerte/protein/" rel="noopener">Referenzwert Protein</a> (Stand der Ableitung 2017).</li>
  <li>Nunes E. A. et al. (2022): Systematic review and meta-analysis of protein intake to support muscle mass and function in healthy adults. Journal of Cachexia, Sarcopenia and Muscle 13(2), 795–810. <a href="https://doi.org/10.1002/jcsm.12922" rel="noopener">doi:10.1002/jcsm.12922</a></li>
  <li>Tarnopolsky M. A. (2008): Building muscle: nutrition to maximize bulk and strength adaptations to resistance exercise training. European Journal of Sport Science 8(2), 67–76. <a href="https://doi.org/10.1080/17461390801919128" rel="noopener">doi:10.1080/17461390801919128</a></li>
  <li>Khazrai Y. M., Defeudis G., Pozzilli P. (2014): Effect of diet on type 2 diabetes mellitus: a review. Diabetes/Metabolism Research and Reviews 30(S1), 24–33. <a href="https://doi.org/10.1002/dmrr.2515" rel="noopener">doi:10.1002/dmrr.2515</a></li>
</ul>
<p class="klein">Diese Seite ersetzt keine ärztliche oder ernährungsfachliche Beratung.</p>
<script>
(function(){
  var feld=document.getElementById('gewicht');
  function rechne(){
    var kg=parseFloat(String(feld.value).replace(',','.'));
    if(!(kg>=30&&kg<=250)) return;
    document.querySelectorAll('[data-faktor]').forEach(function(el){
      el.firstChild.nodeValue=String(Math.round(kg*parseFloat(el.getAttribute('data-faktor'))));
    });
    var ziel=Math.round(kg*0.8);
    document.querySelector('[data-ziel]').textContent=ziel;
    document.querySelectorAll('[data-eiweiss]').forEach(function(el){
      var g=Math.round(ziel/parseFloat(el.getAttribute('data-eiweiss'))*100/10)*10;
      el.textContent=g.toLocaleString('de-DE')+' g';
    });
  }
  feld.addEventListener('input',rechne); rechne();
})();
</script>`,
}));

// ── 6 · Übersicht ─────────────────────────────────────────────────────────
// Jede Karte hat ein eigenes Bild und KEINES davon wiederholt sich auf der
// Seite dahinter (Kevin 25.11.2026).
schreiben('ratgeber', seite({
  pfad: 'ratgeber/',
  bild: 'uebersicht.webp',
  titel: 'Ratgeber Ernährung: Tabellen mit echten Zahlen – Exelery',
  beschreibung: 'Kalorientabelle, eiweißreiche Lebensmittel und Eiweißbedarf mit Werten je 100 g, aus derselben Datenbank, mit der die Exelery-App rechnet.',
  h1: 'Nährwerte zum Nachschlagen',
  lead: 'Jede Zahl stammt aus der Lebensmittel-Datenbank der Exelery-App. Dieselben Werte, mit denen die App deine Mahlzeiten rechnet.',
  krumen: [['Exelery', ''], ['Ratgeber', 'ratgeber/']],
  inhalt: `<div class="karten" style="margin-top:40px">
<a class="karte bild" style="--kulisse:url(/media/ratgeber/karte-kalorien.webp);--pos:center 72%" href="/ratgeber/kalorientabelle/"><span class="pfeil" aria-hidden="true">→</span><strong>Kalorientabelle mit Makros</strong><span>${lebensmittel.length} Lebensmittel mit Kalorien, Eiweiß, Kohlenhydraten, Fett und Ballaststoffen. Durchsuchbar.</span></a>
<a class="karte bild" style="--kulisse:url(/media/ratgeber/karte-eiweiss.webp);--pos:right -60px center;--groesse:auto 170%" href="/ratgeber/eiweissreiche-lebensmittel/"><span class="pfeil" aria-hidden="true">→</span><strong>Eiweißreiche Lebensmittel</strong><span>Die Top 25 je 100&nbsp;g, die besten je 100&nbsp;kcal und pflanzliche Quellen.</span></a>
<a class="karte bild" style="--kulisse:url(/media/ratgeber/karte-bedarf.webp);--pos:right -40px center;--groesse:auto 160%" href="/ratgeber/eiweissbedarf/"><span class="pfeil" aria-hidden="true">→</span><strong>Wie viel Eiweiß brauche ich?</strong><span>Referenzwert, was Studien zum Krafttraining zeigen, und ein Rechner.</span></a>
</div>`,
}));

console.log(`ok: ${lebensmittel.length} Lebensmittel in ${kat.length} Abteilungen · Eiweiß-Top: ${top.slice(0, 3).map((l) => l.name).join(', ')} · pflanzlich: ${pflanzlich.slice(0, 3).map((l) => l.name).join(', ')} · je 100 kcal: ${nachDichte.slice(0, 3).map((l) => l.name).join(', ')}`);
