// Vorher/Nachher-Video fuer Kevin (16.11.2026): dieselbe Scrollfahrt auf
// einem iPhone 15 (WebKit), einmal mit dem alten Stand (git HEAD), einmal
// mit dem neuen. Gescrollt wird in kleinen Rucken mit Pausen — genau da
// richtete sich das Handy frueher jedes Mal gerade.
//
// Aufruf: node video-neigung.mjs <ausgabeordner>
// Ergebnis: <ausgabeordner>/vorher.webm, nachher.webm (danach mit ffmpeg nebeneinander)

import { execFileSync } from 'node:child_process';
import { mkdirSync, renameSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { ENGINES, server, WURZEL } from './pruef-werkzeug.mjs';

const AUS = process.argv[2];
if (!AUS) { console.error('Ausgabeordner fehlt'); process.exit(1); }
mkdirSync(AUS, { recursive: true });

// Der Stand, den Kevin im Video gezeigt hat (zuletzt gepusht, 16.11.2026).
const alt = execFileSync('git', ['show', 'ab1b803:index.html'], { cwd: WURZEL, encoding: 'utf8' });

async function fahrt(name, kaputt) {
  const srv = server(kaputt);
  await new Promise((r) => srv.listen(0, r));
  const browser = await ENGINES.webkit.launch();
  const tmp = join(AUS, `_${name}`);
  rmSync(tmp, { recursive: true, force: true });
  const ctx = await browser.newContext({
    viewport: { width: 393, height: 852 }, deviceScaleFactor: 2, hasTouch: true,
    recordVideo: { dir: tmp, size: { width: 393, height: 852 } },
  });
  const seite = await ctx.newPage();
  await seite.goto(`http://localhost:${srv.address().port}/`, { waitUntil: 'load' });
  await seite.waitForTimeout(2600);
  const ende = await seite.evaluate(() => {
    const s = document.getElementById('app');
    return s.offsetTop + s.offsetHeight - s.querySelector('.phone-sticky').offsetHeight;
  });
  // Kleine Rucke mit Pausen: 70 px, dann 450 ms Ruhe — bis zur Motivation.
  await seite.mouse.move(200, 400);
  for (let y = 0; y < ende; y += 70) {
    await seite.mouse.wheel(0, 70);
    await seite.waitForTimeout(450);
  }
  await seite.waitForTimeout(1200);
  await ctx.close();
  await browser.close();
  srv.close();
  const datei = readdirSync(tmp).find((f) => f.endsWith('.webm'));
  renameSync(join(tmp, datei), join(AUS, `${name}.webm`));
  rmSync(tmp, { recursive: true, force: true });
}

await fahrt('vorher', () => alt);
await fahrt('nachher', null);
console.log('ok', AUS);
