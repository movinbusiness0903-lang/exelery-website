// Prueft die scroll-gesteuerte Telefon-Szene (#app) auf der Startseite.
//
// Kevins Video vom 16.09.2026: Das Handy war schwarz, Bild und Text der Szene
// verrutscht, bei Training und Abzeichen fehlte der Text ganz. Ursache: Das
// Szenen-Skript suchte `.phone-screen` auf der ganzen Seite und fand seit dem
// Startbereich V2 zwei fremde Bildschirme (Startbereich, fliegendes Handy),
// also 7 Stufen statt 5.
//
// Dieses Skript fuehrt den ECHTEN Szenen-Code aus index.html mit einer
// nachgebauten Seite aus (5 Szenen-Bildschirme + 2 fremde) und verlangt fuer
// jede Stufe: das richtige Bild, genau ein sichtbarer Text, die richtigen
// Punkte, und die fremden Bildschirme bleiben unberuehrt.
//
// Aufruf: node pruefe-telefon-szene.mjs

import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const HTML = readFileSync(new URL('./index.html', import.meta.url), 'utf8');

function zaehle(html) {
  const geraet = html.match(/<div class="phone-device" id="phoneDevice">([\s\S]*?)<div class="phone-progress"/);
  const punkte = html.match(/<div class="phone-progress" id="phoneProgress"[^>]*>([\s\S]*?)<\/div>/);
  return {
    stufen: (html.match(/class="phone-step"/g) || []).length,
    szenenBilder: geraet ? (geraet[1].match(/class="phone-screen/g) || []).length : 0,
    bilderSeite: (html.match(/class="phone-screen/g) || []).length,
    punkte: punkte ? (punkte[1].match(/<i[\s>]/g) || []).length : 0,
    bildNamen: geraet ? [...geraet[1].matchAll(/src="media\/web\/([^"]+)"/g)].map((m) => m[1]) : [],
  };
}

function szenenCode(html) {
  const m = html.match(/\/\* =+ Telefon-Szene =+ \*\/([\s\S]*?)\/\* =+ Handy-Uebergabe/);
  if (!m) throw new Error('Szenen-Block nicht gefunden');
  const p = html.match(/function progressOf\(el, y\) \{[\s\S]*?\n  \}/);
  if (!p) throw new Error('progressOf nicht gefunden');
  return p[0] + '\n' + m[1];
}

function element(extra = {}) {
  const klassen = new Set(extra.klassen || []);
  return {
    style: {},
    classList: {
      toggle: (k, an) => { if (an) klassen.add(k); else klassen.delete(k); },
      contains: (k) => klassen.has(k),
    },
    ...extra,
  };
}

function lauf(html) {
  const z = zaehle(html);
  const fremde = Array.from({ length: Math.max(0, z.bilderSeite - z.szenenBilder) }, () => element({ klassen: ['active'], fremd: true }));
  const szenenBilder = z.bildNamen.map((name, i) => element({ klassen: i === 0 ? ['active'] : [], name }));
  const steps = Array.from({ length: z.stufen }, () => element());
  const dots = Array.from({ length: z.punkte }, () => element());
  const device = element({ querySelectorAll: (s) => (s === '.phone-screen' ? szenenBilder : []) });
  const scene = { offsetTop: 1000, offsetHeight: 5000 };
  const alle = { '.phone-step': steps, '.phone-screen': [...fremde, ...szenenBilder], '#phoneProgress i': dots };
  const kontext = {
    jobs: [],
    reduceMotion: false,
    window: { innerHeight: 1000 },
    document: {
      getElementById: (id) => ({ app: scene, phoneDevice: device }[id] || null),
      querySelectorAll: (s) => alle[s] || [],
    },
    Array, Math, String,
  };
  vm.runInNewContext(szenenCode(html), kontext);
  const job = kontext.jobs[0];
  if (typeof job !== 'function') throw new Error('Szenen-Job wurde nicht angelegt');
  const n = z.stufen;
  const ergebnisse = [];
  for (let i = 0; i < n; i++) {
    const p = (i + 0.55) / n;
    job(scene.offsetTop + p * (scene.offsetHeight - kontext.window.innerHeight));
    ergebnisse.push({
      aktiv: szenenBilder.filter((b) => b.classList.contains('active')).map((b) => b.name),
      sichtbar: steps.map((s, k) => (parseFloat(s.style.opacity) >= 0.9 ? k : -1)).filter((k) => k >= 0),
      punkte: dots.filter((d) => d.classList.contains('on')).length,
      fremdeAus: fremde.filter((f) => !f.classList.contains('active')).length,
    });
  }
  // Ende der Szene: der letzte Text (Motivation) muss stehen bleiben.
  job(scene.offsetTop + (scene.offsetHeight - kontext.window.innerHeight));
  const ende = steps.map((s, k) => (parseFloat(s.style.opacity) >= 0.9 ? k : -1)).filter((k) => k >= 0);
  return { z, ergebnisse, ende };
}

const ERWARTET = ['ernaehrung.webp', 'gewicht.webp', 'einkauf-sheet.webp', 'training.webp', 'abzeichen.webp'];

function pruefe(html) {
  const fehler = [];
  let r;
  try { r = lauf(html); } catch (e) { return [String(e.message)]; }
  const { z, ergebnisse, ende } = r;
  if (ende.length !== 1 || ende[0] !== z.stufen - 1) fehler.push(`Szenen-Ende: sichtbarer Text ${ende.map((k) => k + 1).join("+") || "keiner"} statt ${z.stufen}`);
  if (z.stufen !== z.szenenBilder || z.stufen !== z.punkte) {
    fehler.push(`Anzahl passt nicht: ${z.stufen} Texte, ${z.szenenBilder} Bildschirme, ${z.punkte} Punkte`);
  }
  if (z.bilderSeite <= z.szenenBilder) fehler.push('Testaufbau: keine fremden Bildschirme auf der Seite gefunden');
  ergebnisse.forEach((e, i) => {
    const soll = ERWARTET[i];
    if (e.aktiv.length !== 1 || e.aktiv[0] !== soll) fehler.push(`Stufe ${i + 1}: Bild ${e.aktiv.join('+') || 'keins'} statt ${soll}`);
    if (e.sichtbar.length !== 1 || e.sichtbar[0] !== i) fehler.push(`Stufe ${i + 1}: sichtbarer Text ${e.sichtbar.map((k) => k + 1).join("+") || "keiner"} statt ${i + 1}`);
    if (e.punkte !== i + 1) fehler.push(`Stufe ${i + 1}: ${e.punkte} Punkte an statt ${i + 1}`);
    if (e.fremdeAus > 0) fehler.push(`Stufe ${i + 1}: ${e.fremdeAus} fremde Bildschirme ausgeschaltet (Handy wird schwarz)`);
  });
  return fehler;
}

let rot = false;
const echt = pruefe(HTML);
for (const f of echt) { console.log('FEHLER', f); rot = true; }
if (!echt.length) console.log(`ok   ${ERWARTET.length} Stufen: richtiges Bild, ein sichtbarer Text, Punkte, fremde Handys unberuehrt`);

const SABOTAGEN = [
  ['Selektor wieder seitenweit (Fehler vom 15.09.)', (h) => h.replace("device ? Array.prototype.slice.call(device.querySelectorAll('.phone-screen')) : []", "Array.prototype.slice.call(document.querySelectorAll('.phone-screen'))")],
  ['ein Punkt zu wenig', (h) => h.replace('<i class="on"></i><i></i><i></i><i></i><i></i>', '<i class="on"></i><i></i><i></i><i></i>')],
  ['letzter Text blendet aus', (h) => h.replace('var outO = i === STAGES - 1 ? 1 :', 'var outO =')],
];
for (const [was, aendern] of SABOTAGEN) {
  const html = aendern(HTML);
  if (html === HTML) { console.log(`FEHLER Gegenprobe „${was}" liess sich nicht einschleusen`); rot = true; continue; }
  const erkannt = pruefe(html).length > 0;
  console.log(erkannt ? `ok   Gegenprobe „${was}" wird erkannt` : `FEHLER Gegenprobe „${was}" blieb unentdeckt`);
  if (!erkannt) rot = true;
}

console.log(rot ? '\nROT' : '\nGRUEN');
process.exit(rot ? 1 : 0);
