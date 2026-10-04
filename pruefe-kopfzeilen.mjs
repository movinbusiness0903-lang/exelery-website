// Prueft die Sicherheits-Kopfzeilen jeder Seite (Kevin, 26.09.2026).
//
// Aus dem Sicherheits-Checkup, Punkt 18 („Security-Header"). Vorher hatte
// exelery.de gar keine.
//
// WAS GEHT UND WAS NICHT
// GitHub Pages laesst uns keine eigenen HTTP-Kopfzeilen setzen. Ueber <meta>
// wirken aber genau zwei:
//   • Content-Security-Policy  — wirkt (ausser frame-ancestors und report-uri)
//   • Referrer-Policy          — wirkt
// Diese drei wirken als <meta> NICHT, die Browser ignorieren sie schlicht:
//   • X-Frame-Options / frame-ancestors  (Schutz vor Einbetten in fremde Seiten)
//   • Strict-Transport-Security (HSTS)
//   • Permissions-Policy
// Sie stehen deshalb bewusst NICHT in den Seiten — eine Zeile, die nichts tut,
// waere ein falsches Versprechen. Wer sie braucht, muss die Seite hinter einen
// Dienst haengen, der Kopfzeilen kann (Cloudflare, Netlify).
//
// Aufruf: node pruefe-kopfzeilen.mjs

import { readFileSync, readdirSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const WURZEL = dirname(fileURLToPath(import.meta.url));

/** Die Regeln, die in jeder CSP stehen muessen. */
const PFLICHT = [
  ["default-src 'self'", 'alles standardmaessig nur von uns selbst'],
  ["object-src 'none'", 'keine Flash-/Objekt-Einbettungen'],
  ["base-uri 'self'", 'niemand kann die Basis-Adresse umbiegen'],
  ["form-action 'self'", 'Formulare senden nur an uns'],
  ["script-src 'self'", 'keine fremden Skript-Quellen'],
  ['connect-src', 'Verbindungen nur zu uns und Supabase'],
];

function seiten(d, out = []) {
  for (const e of readdirSync(d, { withFileTypes: true })) {
    // /dev/ ist ein Expo-Export und wird erzeugt, nicht von Hand gepflegt.
    if (['.git', 'node_modules', 'dev', '_expo', 'media'].includes(e.name)) continue;
    // Die Bestaetigungsdatei der Google Search Console enthaelt NUR die eine
    // Zeichenkette, die Google erwartet ("google-site-verification: ...").
    // Google verlangt ausdruecklich, den Inhalt nicht zu veraendern -- ein
    // Kopfzeilen-Block darin wuerde die Bestaetigung gefaehrden. Gemessen am
    // 04.10.2026: dieser Waechter meldete sie als Fehler, seit sie am
    // 02.10.2026 dazukam.
    if (/^google[0-9a-f]+\.html$/.test(e.name)) continue;
    const f = join(d, e.name);
    if (e.isDirectory()) seiten(f, out);
    else if (e.name.endsWith('.html')) out.push(f);
  }
  return out;
}

function pruefe(name, html, leise) {
  const fehler = [];

  const csp = html.match(/<meta http-equiv="Content-Security-Policy" content="([^"]*)"/i);
  if (!csp) {
    fehler.push(`${name}: keine Content-Security-Policy`);
  } else {
    for (const [regel, wofuer] of PFLICHT) {
      if (!csp[1].includes(regel)) fehler.push(`${name}: CSP ohne „${regel}" (${wofuer})`);
    }
    // Eine CSP, die alles erlaubt, ist keine.
    if (/script-src[^;]*\*/.test(csp[1])) fehler.push(`${name}: script-src erlaubt beliebige Quellen`);
    // Zeilen, die als <meta> nichts tun, gehoeren nicht hinein.
    if (csp[1].includes('frame-ancestors')) {
      fehler.push(`${name}: frame-ancestors wirkt als <meta> nicht — bitte entfernen`);
    }
  }

  if (!/<meta name="referrer" content="(strict-origin-when-cross-origin|no-referrer|same-origin)"/i.test(html)) {
    fehler.push(`${name}: keine (oder eine zu lasche) Referrer-Policy`);
  }

  if (!leise) fehler.forEach((f) => console.log(`FEHLER ${f}`));
  return fehler;
}

// ─── Lauf ────────────────────────────────────────────────────────────────────

const dateien = seiten(WURZEL).map((f) => [relative(WURZEL, f).replace(/\\/g, '/'), readFileSync(f, 'utf8')]);
let rot = false;
let fehlerGesamt = 0;

for (const [name, html] of dateien) {
  const f = pruefe(name, html, false);
  fehlerGesamt += f.length;
}
if (fehlerGesamt === 0) {
  console.log(`ok   alle ${dateien.length} Seiten haben CSP und Referrer-Policy`);
} else {
  rot = true;
}

// ─── Gegenproben ─────────────────────────────────────────────────────────────

const probe = dateien.find(([n]) => n === 'index.html');
const GEGENPROBEN = [
  ['CSP ganz entfernt', (h) => h.replace(/<meta http-equiv="Content-Security-Policy"[^>]*>/i, '')],
  ['CSP erlaubt fremde Skripte', (h) => h.replace(/script-src 'self' 'unsafe-inline'/, "script-src * 'unsafe-inline'")],
  ['Referrer-Policy entfernt', (h) => h.replace(/<meta name="referrer"[^>]*>/i, '')],
  ['frame-ancestors eingeschmuggelt (wirkt als meta nicht)',
    (h) => h.replace("default-src 'self'", "default-src 'self'; frame-ancestors 'none'")],
];

for (const [was, aendern] of GEGENPROBEN) {
  const kaputt = aendern(probe[1]);
  if (kaputt === probe[1]) {
    console.log(`FEHLER Gegenprobe „${was}" liess sich nicht einschleusen`);
    rot = true;
    continue;
  }
  const erkannt = pruefe('index.html', kaputt, true).length > 0;
  console.log(erkannt ? `ok   Gegenprobe „${was}" wird erkannt` : `FEHLER Gegenprobe „${was}" blieb unentdeckt`);
  if (!erkannt) rot = true;
}

console.log(rot ? '\nROT' : '\nGRUEN');
process.exit(rot ? 1 : 0);
