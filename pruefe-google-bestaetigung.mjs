// Prueft die Bestaetigungsdateien der Google Search Console (Kevin, 01.10.2026).
//
// WARUM ES DIESEN WAECHTER GIBT
// Google Play verlangt fuer das Organisationskonto, dass exelery.de als
// „Website der Organisation" bestaetigt ist (Punkt 2.0c der Kassen-Anleitung).
// Die Bestaetigung laeuft ueber eine Datei, die Google erzeugt und die auf
// exelery.de liegen muss. Googles eigener Hinweis im Dialog:
//
//   „Entferne die Datei auch nach bestandener Pruefung nicht, damit die
//    Bestaetigung aufrechterhalten bleibt."
//
// Verschwindet sie beim naechsten Umbau, faellt die Bestaetigung still weg —
// und auffallen wuerde es erst, wenn in der Play Console wieder „Massnahme
// erforderlich" steht. Genau dafuer ist ein Waechter da.
//
// WAS AUSSERDEM SCHIEFGEHEN KANN
// GitHub Pages baut die Seite mit Jekyll. Jekyll verarbeitet .html-Dateien,
// die mit einem Front Matter („---") anfangen, und schreibt sie um. Dann
// stimmt der Inhalt nicht mehr und Google lehnt ab, obwohl die Datei da ist.
// Dateien in Ordnern mit Unterstrich oder Punkt laesst Jekyll ganz weg, wenn
// sie nicht in _config.yml unter „include" stehen.
//
// Mehrere Dateien sind normal: jede gehoert zu genau einem Google-Konto.
// Der Waechter prueft deshalb alle, die er findet, und verlangt mindestens eine.
//
// Aufruf: node pruefe-google-bestaetigung.mjs

import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const WURZEL = dirname(fileURLToPath(import.meta.url));
const MUSTER = /^google[0-9a-f]{16}\.html$/;

/**
 * Prueft eine einzelne Bestaetigungsdatei und gibt die Fehler zurueck.
 * Als eigene Funktion, damit die Gegenproben denselben Weg nehmen wie der
 * Ernstfall — ein Test, der anders prueft als der Waechter, beweist nichts.
 */
function pruefe(name, inhalt) {
  const fehler = [];

  if (inhalt.startsWith('---')) {
    fehler.push(`${name}: faengt mit einem Front Matter an, Jekyll wuerde die Datei umschreiben`);
  }

  // Der Inhalt ist immer „google-site-verification: <dateiname>". Dadurch
  // faellt auch ein Vertipper auf, bei dem Name und Inhalt auseinanderlaufen.
  const erwartet = `google-site-verification: ${name}`;
  if (inhalt.trim() !== erwartet) {
    fehler.push(`${name}: Inhalt ist nicht „${erwartet}", sondern „${inhalt.trim().slice(0, 80)}"`);
  }

  return fehler;
}

const dateien = readdirSync(WURZEL)
  .filter((n) => MUSTER.test(n))
  .map((n) => [n, readFileSync(join(WURZEL, n), 'utf8')]);

let rot = false;

console.log('Bestaetigungsdateien der Google Search Console\n');

if (dateien.length === 0) {
  console.log('FEHLER keine Bestaetigungsdatei in der Wurzel gefunden');
  console.log('       Ohne sie verliert exelery.de die Bestaetigung, und das');
  console.log('       Google-Play-Organisationskonto wird wieder rot.');
  rot = true;
}

for (const [name, inhalt] of dateien) {
  const fehler = pruefe(name, inhalt);

  // Liegt die Datei ueberhaupt in der Veroeffentlichung? Eine ignorierte Datei
  // ist lokal da und auf dem Server nicht — der unangenehmste aller Faelle.
  try {
    execFileSync('git', ['check-ignore', '-q', name], { cwd: WURZEL });
    fehler.push(`${name}: wird von .gitignore erfasst und landet nie auf dem Server`);
  } catch {
    // Beendet sich mit 1, wenn die Datei NICHT ignoriert wird. Das ist der gute Fall.
  }

  if (fehler.length === 0) {
    console.log(`ok   ${name} (${inhalt.length} Byte, Inhalt passt zum Dateinamen)`);
  } else {
    for (const f of fehler) console.log(`FEHLER ${f}`);
    rot = true;
  }
}

// ─── Gegenproben ─────────────────────────────────────────────────────────────
// Ohne sie wuesste niemand, ob der Waechter ueberhaupt etwas merkt.

const probe = dateien[0];

if (!probe) {
  console.log('\nGegenproben uebersprungen: es gibt keine Datei zum Verbiegen');
} else {
  const GEGENPROBEN = [
    ['eine Ziffer im Inhalt geaendert', (n, i) => [n, i.replace(/[0-9]/, (z) => (z === '9' ? '8' : '9'))]],
    ['Front Matter eingeschmuggelt', (n, i) => [n, `---\nlayout: default\n---\n${i}`]],
    ['Inhalt geleert', (n) => [n, '']],
    ['Datei umbenannt, Inhalt stehen geblieben', (n, i) => [n.replace(/^google./, 'google0'), i]],
  ];

  console.log('');
  for (const [was, verbiegen] of GEGENPROBEN) {
    const [name, inhalt] = verbiegen(probe[0], probe[1]);
    const erkannt = pruefe(name, inhalt).length > 0;
    console.log(erkannt ? `ok   Gegenprobe „${was}" wird erkannt` : `FEHLER Gegenprobe „${was}" blieb unentdeckt`);
    if (!erkannt) rot = true;
  }
}

console.log(rot ? '\nROT' : '\nGRUEN');
process.exit(rot ? 1 : 0);
