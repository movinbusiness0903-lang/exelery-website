// Waechter: der QR-Code des Flyers zaehlt (Kevin, 16.11.2026).
//
// Kevin: „kannst du exelery.de/flyer einrichten, soll aber genauso hochwertig
// aussehen und halt dann evtl auf die mainpage weiterleiten."
//
// Geprueft je Geraet und Engine:
//   1. /flyer/ landet auf der Startseite mit ?utm_source=flyer.
//   2. Wer sich dort in die Warteliste eintraegt, schickt source "flyer".
//      (Die Anfrage an Supabase wird abgefangen — es geht NICHTS raus.)
//   3. Ohne Parameter bleibt es "website" (die Startseite selbst unveraendert).
//
// Gegenprobe: `flyer` fehlt in KANAELE → source "website" → rot.
//
// Aufruf: node pruefe-flyer.mjs

import { readFileSync } from 'node:fs';
import { tabelle, ueberAlle, GERAETE } from './pruef-werkzeug.mjs';

async function eintragen(seite) {
  let gesendet = null;
  await seite.route('**/functions/v1/warteliste', async (route) => {
    const body = JSON.parse(route.request().postData() || '{}');
    if (body.aktion === 'eintragen') gesendet = body.source;
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'mail_gesendet' }) });
  });
  await seite.evaluate(() => {
    const f = document.querySelector('input[type="email"][name="email"]').form;
    f.querySelector('input[type="email"]').value = 'test@example.com';
    f.requestSubmit();
  });
  for (let i = 0; i < 30 && gesendet === null; i++) await seite.waitForTimeout(100);
  await seite.unroute('**/functions/v1/warteliste');
  return gesendet;
}

async function pruefen(seite) {
  const fehler = [];
  const basis = new URL(seite.url()).origin;
  // 3. Startseite direkt
  const direkt = await eintragen(seite);
  if (direkt !== 'website') fehler.push(`Startseite direkt sendet ${direkt}`);
  // 1. /flyer/
  await seite.goto(`${basis}/flyer/`, { waitUntil: 'load' });
  await seite.waitForURL((u) => u.pathname === '/', { timeout: 5000 }).catch(() => {});
  const ziel = new URL(seite.url());
  if (ziel.pathname !== '/' || ziel.searchParams.get('utm_source') !== 'flyer') fehler.push(`/flyer/ endet auf ${ziel.pathname}${ziel.search}`);
  await seite.waitForTimeout(300);
  // 2. Eintragung
  const ueberFlyer = await eintragen(seite);
  if (ueberFlyer !== 'flyer') fehler.push(`ueber den Flyer sendet die Warteliste source=${ueberFlyer}`);
  return { ok: fehler.length === 0, ziel: ziel.pathname + ziel.search, source: ueberFlyer, fehler: fehler.join('; ') || undefined };
}

console.log('Flyer-QR: /flyer/ → Startseite → Warteliste mit source "flyer"');
const erg = await ueberAlle(pruefen);
tabelle(erg, ['ok', 'ziel', 'source']);
const rot = erg.filter((e) => !e.ok);
for (const e of rot) console.log(`  FEHLER ${e.engine} ${e.geraet}: ${e.fehler}`);

const ALT = "'reddit', 'flyer'];";
const html = readFileSync(new URL('./index.html', import.meta.url), 'utf8');
let gegenOk = false;
if (!html.includes(ALT)) console.log('PROBE OFFEN  flyer fehlt in KANAELE — die Sabotage trifft nichts');
else {
  const g = await ueberAlle(pruefen, { kaputt: (t) => t.replace(ALT, "'reddit'];"), geraete: GERAETE.filter((x) => x.name === 'iPhone 15') });
  gegenOk = g.every((e) => !e.ok && /source=website/.test(e.fehler || ''));
  console.log(`${gegenOk ? 'rot ' : 'GRUEN'}  Gegenprobe flyer fehlt in KANAELE${gegenOk ? ` — ${g[0].fehler}` : ' — NICHT BEMERKT'}`);
}
const gruen = rot.length === 0 && gegenOk;
console.log(gruen ? '\nGRUEN' : '\nROT');
process.exit(gruen ? 0 : 1);
