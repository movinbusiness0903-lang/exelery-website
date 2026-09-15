// Prueft den Gruender-Hinweis auf der Startseite (Skript „gruender-zaehler").
//
// Kevins Frage am 15.09.2026: Geht der Hinweis „Noch X von 30 Gruenderplaetzen"
// oben automatisch weg, wenn die Plaetze vergeben sind? Dieses Skript fuehrt
// den ECHTEN Code aus index.html mit gefaelschten Server-Antworten aus.
// Sichtbar darf der Hinweis nur bei „Aktion an und noch frei" sein.
//
// Aufruf: node pruefe-gruender-hinweis.mjs

import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const HTML = readFileSync(new URL('./index.html', import.meta.url), 'utf8');

function skriptAus(html) {
  const m = html.match(/<script id="gruender-zaehler">([\s\S]*?)<\/script>/);
  if (!m) throw new Error('Skript gruender-zaehler nicht gefunden');
  return m[1];
}

function element() {
  const span = { innerHTML: '' };
  return { innerHTML: 'SICHER', hidden: true, span, querySelector: () => span };
}

async function lauf(code, antwort) {
  const sub = element();
  const zeile = element();
  const hinweis = element();
  const felder = { '[data-wl-sub]': sub, '[data-wl-plaetze]': zeile, '[data-hero-plaetze]': hinweis };
  const fetch = () => {
    if (antwort === 'netz') return Promise.reject(new Error('offline'));
    if (antwort === 'kaputt') return Promise.resolve({ ok: true, json: () => Promise.reject(new Error('kein JSON')) });
    if (typeof antwort === 'number') return Promise.resolve({ ok: false, status: antwort, json: () => Promise.resolve({}) });
    return Promise.resolve({ ok: true, json: () => Promise.resolve(antwort) });
  };
  const kontext = { fetch, document: { querySelector: (s) => felder[s] ?? null } };
  kontext.window = kontext;
  vm.runInNewContext(code, kontext);
  await new Promise((r) => setTimeout(r, 20));
  return { sub, zeile, hinweis };
}

const FAELLE = [
  ['frei 29 von 30', { gruenderAktiv: true, frei: 29, plaetze: 30, monate: 2 }, true],
  ['frei 1 von 30', { gruenderAktiv: true, frei: 1, plaetze: 30, monate: 2 }, true],
  ['alle vergeben (frei 0)', { gruenderAktiv: true, frei: 0, plaetze: 30, monate: 2 }, false],
  ['Aktion aus', { gruenderAktiv: false, frei: 29, plaetze: 30, monate: 2 }, false],
  ['HTTP 500', 500, false],
  ['kein Netz', 'netz', false],
  ['Antwort kein JSON', 'kaputt', false],
  ['frei groesser als Plaetze', { gruenderAktiv: true, frei: 31, plaetze: 30, monate: 2 }, false],
  ['Zahl kaputt', { gruenderAktiv: true, frei: 'abc', plaetze: 30, monate: 2 }, false],
];

async function pruefe(html) {
  const fehler = [];
  if (!/<p class="hero-abz"[^>]*data-hero-plaetze[^>]*\bhidden\b/.test(html)) {
    fehler.push('Hinweis im HTML nicht von Anfang an versteckt (hidden fehlt)');
  }
  const code = skriptAus(html);
  for (const [name, antwort, sichtbar] of FAELLE) {
    const { sub, zeile, hinweis } = await lauf(code, antwort);
    if (hinweis.hidden === sichtbar) fehler.push(`${name}: Hinweis ${sichtbar ? 'fehlt' : 'sichtbar'}`);
    if (zeile.hidden === sichtbar) fehler.push(`${name}: Warteliste-Zeile ${sichtbar ? 'fehlt' : 'sichtbar'}`);
    if (!sichtbar && sub.innerHTML !== 'SICHER') fehler.push(`${name}: sichere Fassung ueberschrieben`);
    if (sichtbar) {
      const frei = antwort.frei;
      if (!hinweis.span.innerHTML.includes(`Noch <b>${frei}</b> von 30`)) fehler.push(`${name}: falscher Text „${hinweis.span.innerHTML}"`);
    }
  }
  return fehler;
}

let rot = false;
const echt = await pruefe(HTML);
for (const f of echt) { console.log('FEHLER', f); rot = true; }
if (!echt.length) console.log(`ok   ${FAELLE.length} Faelle: sichtbar nur bei „aktiv und frei"`);

const SABOTAGEN = [
  ['ohne Pruefung „Aktion an"', (h) => h.replace("if (!d || d.gruenderAktiv !== true) return;", 'if (!d) return;')],
  ['ohne Pruefung „frei > 0"', (h) => h.replace('if (!(frei > 0) || !(plaetze > 0) || frei > plaetze) return;', 'if (!(plaetze > 0) || frei > plaetze) return;')],
  ['Hinweis ohne hidden im HTML', (h) => h.replace(/(<p class="hero-abz"[^>]*) hidden>/, '$1>')],
];
for (const [was, aendern] of SABOTAGEN) {
  const html = aendern(HTML);
  if (html === HTML) { console.log(`FEHLER Gegenprobe „${was}" liess sich nicht einschleusen`); rot = true; continue; }
  const erkannt = (await pruefe(html)).length > 0;
  console.log(erkannt ? `ok   Gegenprobe „${was}" wird erkannt` : `FEHLER Gegenprobe „${was}" blieb unentdeckt`);
  if (!erkannt) rot = true;
}

console.log(rot ? '\nROT' : '\nGRUEN');
process.exit(rot ? 1 : 0);
