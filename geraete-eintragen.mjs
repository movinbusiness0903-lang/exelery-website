// Traegt die Geraete-Fassungen der App-Aufnahmen in index.html ein.
//
// ─── Warum als Skript und nicht von Hand ───────────────────────────────────
//
// Es sind sechs `<img>`-Tags, und jedes traegt src, srcset, sizes, width und
// height. Von Hand heisst: dreissig Stellen, und eine vergessene `width`
// faellt erst auf, wenn der Sprung zu #warteliste wieder daneben geht (Kevin,
// 14.09.2026). Ein Skript macht entweder alle oder keine.
//
// ⚠️ ES WIRD GEPRUEFT, DASS JEDER TAG WIRKLICH GETROFFEN WURDE. Ein
//    Suchmuster, das still null Treffer hat, sieht aus wie „nichts zu tun".
//
// Aufruf:  node geraete-eintragen.mjs            Trockenlauf
//          node geraete-eintragen.mjs --schreiben
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const DATEI = 'index.html';
const SCHREIBEN = process.argv.includes('--schreiben');

/**
 * Die Aufnahmen, die in den KAPITELN stehen.
 *
 * ⚠️ `einkauf-sheet` gehoert NICHT dazu, obwohl es eine App-Aufnahme ist. Es
 *    steckt in der Sticky-Szene (`.phone-screen`), und die hat ihr eigenes
 *    CSS-Geraet mit 3D-Drehung — dort waere ein zweites Geraet im Bild eines
 *    zu viel. Die Vorabpruefung hat das gemeldet, statt es durchzuwinken:
 *    „KEIN TREFFER — das Muster passt nicht mehr".
 */
const BILDER = ['ernaehrung', 'gewicht', 'training', 'abzeichen', 'logbuch'];

/**
 * Die Aufnahmen im STARTBEREICH und in der Sticky-Szene.
 *
 * Dort steckt kein eingebackenes Geraet: der Rahmen liegt als Ebene
 * darueber, weil die Aufnahmen durchwechseln. Sie brauchen aber dasselbe
 * Pro-Max-Seitenverhaeltnis wie die Kapitelbilder, sonst saessen sie als
 * einzige anders im Glas — darum die `-pm`-Fassungen.
 *
 * Kevin am 04.11.2026: „es sollte schon so aussehen wie das neuste iphone
 * pro max, nicht breiter."
 */
const START_BILDER = ['ernaehrung', 'gewicht', 'training', 'abzeichen', 'einkauf-sheet'];

function masse(pfad) {
  const aus = execFileSync(process.execPath, ['-e',
    `const s=require('sharp');s('${pfad}').metadata().then(m=>console.log(m.width+' '+m.height))`,
  ], { encoding: 'utf8', cwd: 'C:/Users/Kevin/Fitness App/Exelery' });
  const [b, h] = aus.trim().split(' ').map(Number);
  if (!b || !h) throw new Error(`Keine Masse fuer ${pfad}`);
  return { b, h };
}

let text = readFileSync(DATEI, 'utf8');
const vorher = text;
const bericht = [];

for (const name of BILDER) {
  const gross = masse(`C:/Users/Kevin/Fitness App/exelery-website/media/web/${name}-geraet-1290.webp`);
  const klein = masse(`C:/Users/Kevin/Fitness App/exelery-website/media/web/${name}-geraet.webp`);

  // Nur die Tags in den Kapiteln anfassen: die Hero-Sequenz und die
  // Sticky-Szene haben ihr eigenes Geraet und bleiben unberuehrt.
  //
  // ⚠️ DAS MUSTER TRIFFT BEIDE ZUSTAENDE — den flachen Screen UND die
  //    bereits eingetragene Geraete-Fassung. Beim zweiten Lauf am
  //    04.11.2026 meldete es „5 von 5 nicht getroffen", weil es nur den
  //    Zustand VOR dem ersten Lauf kannte. Ein Wartungsskript, das genau
  //    einmal laufen kann, ist keine Wartung: die Bildmasse aendern sich
  //    jedes Mal mit, sobald die Geraetevorlage wechselt.
  const alt = new RegExp(
    `(<div class="shot-frame(?: small)?"><img )`
    + `src="media/web/${name}(?:-geraet)?\\.webp" `
    + `srcset="media/web/${name}(?:-geraet)?\\.webp \\d+w, `
    + `media/web/${name}(?:-geraet)?-1290\\.webp \\d+w" `
    + `sizes="[^"]*" (alt="[^"]*") width="\\d+" height="\\d+"( loading="lazy">)`,
    'g');

  const treffer = [...text.matchAll(alt)];
  if (!treffer.length) {
    bericht.push(`  ${name.padEnd(16)} KEIN TREFFER — das Muster passt nicht mehr`);
    continue;
  }
  text = text.replace(alt,
    `$1src="media/web/${name}-geraet.webp" `
    + `srcset="media/web/${name}-geraet.webp ${klein.b}w, `
    + `media/web/${name}-geraet-1290.webp ${gross.b}w" `
    + `sizes="(max-width: 900px) 240px, 300px" $2 `
    + `width="${klein.b}" height="${klein.h}"$3`);
  bericht.push(`  ${name.padEnd(16)} ${treffer.length}x ersetzt  `
    + `(${klein.b}x${klein.h} / ${gross.b}x${gross.h})`);
}

// ── Startbereich und Sticky-Szene: die -pm-Fassungen ──────────────────────
//
// ⚠️ NUR die Tags in `.phone-screen`. Die Kapitel haben ihre eigene Fassung
//    mit eingebackenem Geraet und duerfen hier nicht mitgenommen werden.
//    Das Muster verlangt darum `class="phone-screen` davor.
for (const name of START_BILDER) {
  const gross = masse(`C:/Users/Kevin/Fitness App/exelery-website/media/web/${name}-pm-1290.webp`);
  const klein = masse(`C:/Users/Kevin/Fitness App/exelery-website/media/web/${name}-pm.webp`);

  const alt = new RegExp(
    `(<div class="phone-screen(?: active)?"><img )`
    + `src="media/web/${name}(?:-pm)?\\.webp" `
    + `srcset="media/web/${name}(?:-pm)?\\.webp \\d+w, `
    + `media/web/${name}(?:-pm)?-1290\\.webp \\d+w" `
    + `(sizes="[^"]*" alt="[^"]*") width="\\d+" height="\\d+"( ?[^>]*>)`,
    'g');

  const treffer = [...text.matchAll(alt)];
  if (!treffer.length) {
    bericht.push(`  ${(name + ' (Start)').padEnd(16)} KEIN TREFFER — das Muster passt nicht mehr`);
    continue;
  }
  text = text.replace(alt,
    `$1src="media/web/${name}-pm.webp" `
    + `srcset="media/web/${name}-pm.webp ${klein.b}w, `
    + `media/web/${name}-pm-1290.webp ${gross.b}w" `
    + `$2 width="${klein.b}" height="${klein.h}"$3`);
  bericht.push(`  ${(name + ' (Start)').padEnd(16)} ${treffer.length}x ersetzt  `
    + `(${klein.b}x${klein.h} / ${gross.b}x${gross.h})`);
}

console.log('');
for (const z of bericht) console.log(z);

const fehlend = bericht.filter((z) => z.includes('KEIN TREFFER')).length;
if (fehlend) {
  console.log('');
  console.log(`  ${fehlend} von ${BILDER.length} nicht getroffen — es wird nichts geschrieben.`);
  process.exit(1);
}
if (text === vorher) {
  console.log('');
  console.log('  Nichts geaendert (schon eingetragen?).');
  process.exit(0);
}
console.log('');
if (SCHREIBEN) {
  writeFileSync(DATEI, text, 'utf8');
  console.log('  geschrieben.');
} else {
  console.log('  Trockenlauf. Mit --schreiben wird geschrieben.');
}
console.log('');
