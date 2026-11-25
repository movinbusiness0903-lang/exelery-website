// Baut die Ratgeberseiten unter /ratgeber/ aus den Nährwerten der App.
//
// Quelle ist allein `src/data/basicFoods.ts` im App-Repo (Werte je 100 g bzw.
// 100 ml, Durchschnittswerte auf Niveau des Bundeslebensmittelschlüssels).
// Keine zweite Liste: Die Website zeigt dieselben Zahlen wie die App.
// Keine Gesundheitsaussagen ohne Quelle (Kevin: nur mit Beleg). Die Seiten
// ordnen nur unsere eigenen Zahlen.
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
const je = (l) => (l.fluessig ? '100 ml' : '100 g');

function seite({ pfad, titel, beschreibung, h1, lead, inhalt, krumen }) {
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
  :root{--bg:#0B0F17;--text:#F8FAFC;--muted:#94A3B8;--accent:#0DF2A3;--rule:rgba(255,255,255,.10);--box:#141B2A;}
  *{box-sizing:border-box;}
  html{background:var(--bg);}
  body{font-family:Arial,Helvetica,sans-serif;background:var(--bg);max-width:880px;margin:0 auto;padding:40px 24px 80px;color:var(--text);line-height:1.7;font-size:16px;min-height:100vh;}
  nav.krumen{font-size:.88em;color:var(--muted);margin-bottom:18px;}
  nav.krumen a{color:var(--muted);}
  header.doc{border-bottom:3px solid var(--accent);padding-bottom:18px;margin-bottom:8px;}
  h1{font-size:2.1em;margin:0 0 .15em;letter-spacing:-.01em;line-height:1.25;}
  .stand{color:var(--muted);font-size:.92em;margin:0;}
  h2{font-size:1.32em;margin-top:2.4em;border-bottom:2px solid var(--rule);padding-bottom:6px;}
  p{margin:.75em 0;}
  a{color:var(--accent);}
  a:hover{text-decoration:none;}
  .lead{font-size:1.05em;}
  .antwort{background:var(--box);border-left:3px solid var(--accent);border-radius:8px;padding:14px 20px;margin:1.4em 0;}
  .tabelle{overflow-x:auto;-webkit-overflow-scrolling:touch;margin:1em 0;border-radius:10px;background:var(--box);}
  table{border-collapse:collapse;width:100%;font-size:.94em;}
  th,td{padding:8px 12px;text-align:right;white-space:nowrap;border-bottom:1px solid var(--rule);}
  th:first-child,td:first-child{text-align:left;white-space:normal;min-width:9em;}
  thead th{position:sticky;top:0;background:#1B2335;color:var(--muted);font-weight:normal;font-size:.9em;}
  tbody tr:last-child td{border-bottom:none;}
  td.hl{color:var(--accent);font-weight:bold;}
  .klein{color:var(--muted);font-size:.86em;}
  .suche{width:100%;padding:12px 14px;border-radius:10px;border:1px solid var(--rule);background:var(--box);color:var(--text);font-size:16px;margin:1em 0 .2em;}
  .karten{display:grid;gap:14px;margin:1.6em 0;}
  .karte{display:block;background:var(--box);border-radius:12px;padding:18px 20px;text-decoration:none;color:var(--text);border:1px solid var(--rule);}
  .karte:hover{border-color:var(--accent);}
  .karte strong{color:var(--accent);font-size:1.12em;}
  .karte span{display:block;color:var(--muted);margin-top:4px;}
  .app{background:var(--box);border-radius:12px;padding:16px 20px;margin-top:2.4em;}
  .back{display:inline-block;margin-top:2.4em;font-weight:bold;text-decoration:none;color:var(--accent);}
  .source{color:var(--muted);font-size:.9em;margin-top:2.5em;border-top:1px solid var(--rule);padding-top:14px;}
  @media (max-width:560px){body{padding:28px 16px 64px;}h1{font-size:1.65em;}th,td{padding:7px 9px;}}
</style>
</head>
<body>

<nav class="krumen" aria-label="Brotkrumen">${krumen.map(([n, u], i) => (i === krumen.length - 1 ? esc(n) : `<a href="/${u}">${esc(n)}</a>`)).join(' › ')}</nav>

<header class="doc">
  <h1>${esc(h1)}</h1>
  <p class="stand">Stand: ${STAND} &nbsp;·&nbsp; Zahlen aus der Lebensmittel-Datenbank der Exelery-App</p>
</header>

<p class="lead">${lead}</p>

${inhalt}

<div class="app"><strong>Mit diesen Werten rechnet auch die App.</strong> In Exelery trägst du ein Lebensmittel per Suche, Foto oder Barcode ein, und Kalorien und Makros werden aus genau diesen Zahlen berechnet. <a href="/#warteliste">Zur Warteliste</a></div>

<a class="back" href="/ratgeber/">→ Alle Ratgeber</a>

<p class="source">Alle Werte je 100&nbsp;g (Getränke je 100&nbsp;ml), Durchschnittswerte auf Niveau des Bundeslebensmittelschlüssels. Bei Markenware weichen die Werte ab; dort gilt die Nährwerttabelle auf der Packung. Rechtliches: <a href="/impressum/">Impressum</a> · <a href="/datenschutz/">Datenschutz</a></p>

<script type="application/ld+json">
${JSON.stringify(ld, null, 2)}
</script>

</body>
</html>
`;
}

function tabelle(kopf, zeilen, { id, hl } = {}) {
  return `<div class="tabelle"><table${id ? ` id="${id}"` : ''}>
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
const NATUR = new Set(['Obst', 'Gemüse', 'Fleisch & Fisch', 'Eier & Milchprodukte',
  'Getreide & Beilagen', 'Hülsenfrüchte, Nüsse & Samen']);
const PFLANZE = new Set(['Obst', 'Gemüse', 'Getreide & Beilagen', 'Hülsenfrüchte, Nüsse & Samen']);
const natur = lebensmittel.filter((l) => NATUR.has(l.abt));
const nachEiweiss = [...natur].sort((a, b) => b.eiweiss - a.eiweiss || a.name.localeCompare(b.name, 'de'));
const top = nachEiweiss.slice(0, 25);
const proKcal = (l) => (l.kcal > 0 ? (l.eiweiss / l.kcal) * 100 : 0);
const nachDichte = natur.filter((l) => l.eiweiss >= 5)
  .sort((a, b) => proKcal(b) - proKcal(a) || a.name.localeCompare(b.name, 'de')).slice(0, 20);
const pflanzlich = nachEiweiss.filter((l) => PFLANZE.has(l.abt)).slice(0, 15);
const drei = top.slice(0, 3).map((l) => `${esc(l.name)} (${zahl(l.eiweiss)}&nbsp;g)`);

schreiben('ratgeber/eiweissreiche-lebensmittel', seite({
  pfad: 'ratgeber/eiweissreiche-lebensmittel/',
  titel: 'Eiweißreiche Lebensmittel: Tabelle je 100 g – Exelery',
  beschreibung: `Die eiweißreichsten Lebensmittel je 100 g und je 100 kcal, dazu die besten pflanzlichen Quellen. ${natur.length} Grundnahrungsmittel aus der Exelery-Datenbank.`,
  h1: 'Eiweißreiche Lebensmittel: die Tabelle',
  lead: `Welche Lebensmittel haben am meisten Eiweiß? Hier stehen ${natur.length} Grundnahrungsmittel aus der Exelery-Datenbank, sortiert nach Eiweiß je 100&nbsp;g und nach Eiweiß je 100&nbsp;kcal.`,
  krumen: [['Exelery', ''], ['Ratgeber', 'ratgeber/'], ['Eiweißreiche Lebensmittel', 'ratgeber/eiweissreiche-lebensmittel/']],
  inhalt: `<div class="antwort"><strong>Kurz gesagt:</strong> Am meisten Eiweiß je 100&nbsp;g haben in unserer Datenbank ${drei.join(', ')}. Wer auf Kalorien achtet, schaut besser auf die zweite Tabelle: Eiweiß je 100&nbsp;kcal.</div>

<h2 id="je-100-g">Die 25 eiweißreichsten Lebensmittel je 100&nbsp;g</h2>
${tabelle(['Lebensmittel', 'Eiweiß', 'kcal', 'Kohlenhydrate', 'Fett'],
    top.map((l) => [esc(l.name), `${zahl(l.eiweiss)} g`, zahl(l.kcal, 0), `${zahl(l.kh)} g`, `${zahl(l.fett)} g`]), { hl: 1 })}
<p class="klein">Werte je ${'100&nbsp;g'}. Proteinpulver und Proteinriegel sind bewusst nicht dabei, die Tabelle zeigt nur Lebensmittel.</p>

<h2 id="je-100-kcal">Am meisten Eiweiß je 100&nbsp;kcal</h2>
<p>Diese Tabelle zeigt, wie viel Eiweiß du für 100 Kalorien bekommst. Berücksichtigt sind Lebensmittel mit mindestens 5&nbsp;g Eiweiß je 100&nbsp;g.</p>
${tabelle(['Lebensmittel', 'Eiweiß je 100 kcal', 'Eiweiß je 100 g', 'kcal je 100 g'],
    nachDichte.map((l) => [esc(l.name), `${zahl(proKcal(l))} g`, `${zahl(l.eiweiss)} g`, zahl(l.kcal, 0)]), { hl: 1 })}

<h2 id="pflanzlich">Pflanzliche Eiweißquellen</h2>
${tabelle(['Lebensmittel', 'Eiweiß', 'kcal', 'Ballaststoffe'],
    pflanzlich.map((l) => [esc(l.name), `${zahl(l.eiweiss)} g`, zahl(l.kcal, 0), `${zahl(l.ballast)} g`]), { hl: 1 })}
<p class="klein">Trockenware wie Linsen oder Haferflocken steht hier im ungekochten Zustand, so wie sie auf der Packung angegeben ist.</p>

<p>Alle Lebensmittel mit Kalorien und Makros findest du in der <a href="/ratgeber/kalorientabelle/">Kalorientabelle</a>.</p>`,
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
  titel: `Kalorientabelle: ${lebensmittel.length} Lebensmittel mit Makros – Exelery`,
  beschreibung: `Kalorien, Eiweiß, Kohlenhydrate, Fett und Ballaststoffe je 100 g für ${lebensmittel.length} Grundnahrungsmittel, nach Abteilung sortiert und durchsuchbar.`,
  h1: 'Kalorientabelle mit Makros',
  lead: `Kalorien, Eiweiß, Kohlenhydrate, Fett und Ballaststoffe für ${lebensmittel.length} Grundnahrungsmittel, je 100&nbsp;g. Das ist derselbe Bestand, mit dem die Exelery-App rechnet.`,
  krumen: [['Exelery', ''], ['Ratgeber', 'ratgeber/'], ['Kalorientabelle', 'ratgeber/kalorientabelle/']],
  inhalt: `<label class="klein" for="suche">Lebensmittel suchen</label>
<input class="suche" id="suche" type="search" placeholder="z. B. Haferflocken" autocomplete="off">
<p class="klein" id="treffer" aria-live="polite"></p>
<p class="klein">Abteilungen: ${kat.map((k) => `<a href="#${k.anker}">${esc(k.a)}</a>`).join(' · ')}</p>
${kat.map((k) => `<section class="abt" id="${k.anker}">
<h2>${esc(k.a)}</h2>
${tabelle(['Lebensmittel', 'kcal', 'Eiweiß', 'Kohlenhydrate', 'Fett', 'Ballaststoffe'],
    k.liste.map((l) => [`${esc(l.name)}${l.fluessig ? ' <span class="klein">(100 ml)</span>' : ''}${l.stueck ? ` <span class="klein">· 1 Stück ≈ ${zahl(l.stueck, 0)} g</span>` : ''}`,
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
    info.textContent=q?(n+(n===1?' Treffer':' Treffer')):'';
  });
})();
</script>
<p>Die eiweißreichsten davon stehen sortiert unter <a href="/ratgeber/eiweissreiche-lebensmittel/">Eiweißreiche Lebensmittel</a>.</p>`,
}));

// ── 5 · Übersicht ─────────────────────────────────────────────────────────
schreiben('ratgeber', seite({
  pfad: 'ratgeber/',
  titel: 'Ratgeber Ernährung: Tabellen mit echten Zahlen – Exelery',
  beschreibung: 'Kalorientabelle und eiweißreiche Lebensmittel mit Werten je 100 g, aus derselben Datenbank, mit der die Exelery-App rechnet.',
  h1: 'Ratgeber',
  lead: 'Nährwerte zum Nachschlagen. Jede Zahl stammt aus der Lebensmittel-Datenbank der Exelery-App.',
  krumen: [['Exelery', ''], ['Ratgeber', 'ratgeber/']],
  inhalt: `<div class="karten">
<a class="karte" href="/ratgeber/kalorientabelle/"><strong>Kalorientabelle mit Makros</strong><span>${lebensmittel.length} Lebensmittel mit Kalorien, Eiweiß, Kohlenhydraten, Fett und Ballaststoffen, durchsuchbar.</span></a>
<a class="karte" href="/ratgeber/eiweissreiche-lebensmittel/"><strong>Eiweißreiche Lebensmittel</strong><span>Die Top 25 je 100 g, die besten je 100 kcal und pflanzliche Quellen.</span></a>
</div>`,
}));

console.log(`ok: ${lebensmittel.length} Lebensmittel in ${kat.length} Abteilungen · Eiweiß-Top: ${top.slice(0, 3).map((l) => l.name).join(', ')} · pflanzlich: ${pflanzlich.slice(0, 3).map((l) => l.name).join(', ')} · je 100 kcal: ${nachDichte.slice(0, 3).map((l) => l.name).join(', ')}`);
