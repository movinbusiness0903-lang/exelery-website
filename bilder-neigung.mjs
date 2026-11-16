// Standbilder fuer Kevin (16.11.2026): vorher (ab1b803) und nachher, auf dem
// iPhone 15 (WebKit), an drei Scrollstaenden der Szene, jeweils 1,5 s NACH dem
// Anhalten. Vorher stand das Handy dann immer gerade; jetzt haelt es die
// Neigung des Scrollstands und ist erst bei Motivation gerade.
//
// Aufruf: node bilder-neigung.mjs <ausgabeordner>

import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { ENGINES, server, WURZEL, losmachen, fahreZu } from './pruef-werkzeug.mjs';

const AUS = process.argv[2];
mkdirSync(AUS, { recursive: true });
const alt = execFileSync('git', ['show', 'ab1b803:index.html'], { cwd: WURZEL, encoding: 'utf8' });
const STELLEN = [['1-gelandet', 0.02], ['2-fortschritt', 0.3], ['3-motivation', 0.9]];

for (const [name, kaputt] of [['vorher', () => alt], ['nachher', null]]) {
  const srv = server(kaputt);
  await new Promise((r) => srv.listen(0, r));
  const browser = await ENGINES.webkit.launch();
  const ctx = await browser.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 2, hasTouch: true });
  const seite = await ctx.newPage();
  await seite.goto(`http://localhost:${srv.address().port}/`, { waitUntil: 'load' });
  await seite.waitForTimeout(2600);
  await losmachen(seite);
  const m = await seite.evaluate(() => {
    const s = document.getElementById('app');
    return { oben: s.offsetTop, fahrbar: s.offsetHeight - s.querySelector('.phone-sticky').offsetHeight };
  });
  for (const [stelle, a] of STELLEN) {
    await fahreZu(seite, Math.round(m.oben + m.fahrbar * a));
    await seite.waitForTimeout(1500);
    await seite.screenshot({ path: join(AUS, `${stelle}-${name}.png`) });
  }
  await browser.close();
  srv.close();
}
console.log('ok');
