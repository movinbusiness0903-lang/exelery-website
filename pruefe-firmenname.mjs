// Prueft, dass ueberall der richtige Firmenname steht.
//
// Kevin am 04.10.2026: "Wir heissen jetzt Exelery GbR und nicht mehr Kevin
// Baron &... GbR, bitte in jedem rechtstext und ueberal wo es steht
// vollstaendig umaendern."
//
// Der Name im Impressum ist kein Gestaltungsdetail: § 5 DDG verlangt die
// Anbieterkennzeichnung mit dem Namen des Anbieters, und eine GbR muss ihre
// Vertretungsberechtigten nennen. Deshalb prueft dieses Skript BEIDES -- dass
// der alte Name weg ist UND dass die Gesellschafterzeile steht.
//
// Aufruf: node pruefe-firmenname.mjs
//         node pruefe-firmenname.mjs --gegenprobe

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';

const WURZEL = process.cwd();
const gegenprobe = process.argv.includes('--gegenprobe');

const ALT = /Kevin\s+Baron\s*&(amp;)?\s*Moritz\s+Euler\s+GbR/i;
const NEU = 'Exelery GbR';

// Die sechs Pflichtstellen -- je Datei, was dort stehen MUSS.
const PFLICHT = [
  { datei: 'impressum/index.html',           muss: [NEU, 'vertreten durch die Gesellschafter', '§ 5 DDG'] },
  { datei: 'datenschutz/index.html',         muss: [NEU, 'vertreten durch die Gesellschafter'] },
  { datei: 'nutzungsbedingungen/index.html', muss: [NEU, 'vertreten durch die Gesellschafter'] },
  { datei: 'index.html',                     muss: [`"legalName": "${NEU}"`, `© 2026 ${NEU}`] },
];

// Das Skript selbst bleibt aussen vor: sein Sabotage-Text enthaelt den alten
// Namen. Ohne diese Ausnahme meldete der Waechter sich selbst -- gemessen beim
// ersten Lauf am 04.10.2026.
const SELBST = 'pruefe-firmenname.mjs';

function dateien(ordner, treffer = []) {
  for (const name of readdirSync(ordner)) {
    if (['.git', 'node_modules', 'dev', '_tmp-vorschau', 'media', SELBST].includes(name)) continue;
    const pfad = join(ordner, name);
    if (statSync(pfad).isDirectory()) { dateien(pfad, treffer); continue; }
    if (['.html', '.js', '.mjs', '.xml', '.json', '.txt'].includes(extname(name))) treffer.push(pfad);
  }
  return treffer;
}

const probleme = [];

// ── 1. Der alte Name darf nirgends mehr stehen ────────────────────────────
for (const pfad of dateien(WURZEL)) {
  let inhalt = readFileSync(pfad, 'utf8');
  const rel = pfad.slice(WURZEL.length + 1).split(String.fromCharCode(92)).join('/');
  if (gegenprobe && rel === 'impressum/index.html') {
    // Sabotage: eine einzige Zeile zurueckdrehen.
    inhalt = inhalt.replace(NEU, 'Kevin Baron &amp; Moritz Euler GbR');
  }
  inhalt.split('\n').forEach((zeile, i) => {
    if (ALT.test(zeile)) probleme.push(`${rel}:${i + 1}  alter Firmenname`);
  });
}

// ── 2. Die Pflichtstellen muessen den neuen Namen tragen ──────────────────
for (const { datei, muss } of PFLICHT) {
  let inhalt;
  try { inhalt = readFileSync(join(WURZEL, datei), 'utf8'); }
  catch { probleme.push(`${datei} fehlt`); continue; }
  if (gegenprobe && datei === 'impressum/index.html') {
    inhalt = inhalt.replace(NEU, 'Kevin Baron &amp; Moritz Euler GbR');
  }
  for (const text of muss) {
    if (!inhalt.includes(text)) probleme.push(`${datei}: "${text}" fehlt`);
  }
}

// ── 3. Der § 18 MStV-Verantwortliche ist eine Person und bleibt ───────────
const imp = readFileSync(join(WURZEL, 'impressum/index.html'), 'utf8');
if (!/§ 18 Abs\. 2 MStV/.test(imp)) probleme.push('impressum: der § 18 MStV-Abschnitt fehlt');
if (!/Kevin Baron<br>/.test(imp)) {
  probleme.push('impressum: der Verantwortliche nach § 18 MStV ist keine natuerliche Person mehr');
}

console.log(`Firmenname geprueft: ${dateien(WURZEL).length} Dateien, ${PFLICHT.length} Pflichtstellen.`);

if (gegenprobe) {
  if (probleme.length === 0) {
    console.error('\nGEGENPROBE GESCHEITERT: der zurueckgedrehte Name blieb gruen.');
    process.exit(1);
  }
  console.log(`\nGegenprobe in Ordnung: ${probleme.length} Problem(e):`);
  probleme.forEach((p) => console.log('  - ' + p));
  process.exit(0);
}
if (probleme.length === 0) { console.log(`\nOK — ueberall "${NEU}", Gesellschafter genannt, § 18 MStV unberuehrt.`); process.exit(0); }
console.log(`\n${probleme.length} Problem(e):`);
probleme.forEach((p) => console.log('  - ' + p));
process.exit(1);
