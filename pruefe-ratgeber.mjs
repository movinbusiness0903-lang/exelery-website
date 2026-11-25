// Prüft die Ratgeberseiten in Chromium und WebKit (Safari) bei sechs Breiten:
// kein Querscrollen, Manrope/Inter geladen (lokal), Kulisse geladen, die
// Kalorientabelle sucht. Gegenprobe: ein absichtlich zu breites Element muss
// als Überlauf erkannt werden, sonst misst die Prüfung nichts.
// Aufruf: node pruefe-ratgeber.mjs (startet einen eigenen Server)
import { ENGINES, server } from './pruef-werkzeug.mjs';

const SEITEN = ['/ratgeber/', '/ratgeber/kalorientabelle/', '/ratgeber/eiweissreiche-lebensmittel/', '/ratgeber/eiweissbedarf/'];
const BREITEN = [320, 375, 430, 768, 1024, 1440];
const srv = server();
await new Promise((ok) => srv.listen(0, '127.0.0.1', ok));
const url = `http://127.0.0.1:${srv.address().port}`;
const stop = () => new Promise((ok) => srv.close(ok));
let fehler = 0, messungen = 0;
for (const [name, typ] of Object.entries(ENGINES)) {
  const browser = await typ.launch();
  for (const b of BREITEN) {
    const page = await browser.newPage({ viewport: { width: b, height: 900 } });
    for (const s of SEITEN) {
      await page.goto(url + s, { waitUntil: 'load' });
      await page.evaluate(() => document.fonts.ready);
      const r = await page.evaluate(() => ({
        ueber: document.documentElement.scrollWidth - innerWidth,
        schrift: [...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family.replace(/"/g, '')),
        kulisse: getComputedStyle(document.querySelector('.buehne'), '::before').backgroundImage.includes('/media/ratgeber/'),
      }));
      messungen++;
      const ok = r.ueber <= 0 && r.schrift.includes('Manrope') && r.schrift.includes('Inter') && r.kulisse;
      if (!ok) { fehler++; console.log(`FEHLER ${name} ${b}px ${s}`, JSON.stringify(r)); }
    }
    if (b === 375) {
      await page.goto(url + '/ratgeber/kalorientabelle/');
      await page.fill('#suche', 'hähnchen');
      const t = await page.textContent('#treffer');
      if (!/^[1-9]\d* Treffer$/.test(t)) { fehler++; console.log(`FEHLER ${name} Suche: „${t}“`); }
      // Rechner: 80 kg → 64 g und 128 g
      await page.goto(url + '/ratgeber/eiweissbedarf/');
      await page.fill('#gewicht', '80');
      const w = await page.$$eval('[data-faktor]', (els) => els.map((e) => e.firstChild.nodeValue));
      if (w.join() !== '64,128') { fehler++; console.log(`FEHLER ${name} Rechner: ${w}`); }
      // Warteliste-Schalter: an → Knöpfe sichtbar; aus → weg (und das muss die Prüfung sehen)
      const sichtbar = () => page.$$eval('[data-warteliste]', (els) => els.filter((e) => e.offsetParent !== null).length);
      const an = await sichtbar();
      await page.evaluate(() => document.documentElement.classList.add('ohne-warteliste'));
      const aus = await sichtbar();
      if (!(an >= 2 && aus === 0)) { fehler++; console.log(`FEHLER ${name} Warteliste-Schalter: an ${an}, aus ${aus}`); }
      // Gegenprobe
      const g = await page.evaluate(() => { const d = document.createElement('div'); d.style.width = '2000px'; d.style.height = '1px'; document.body.append(d); return document.documentElement.scrollWidth - innerWidth; });
      if (!(g > 0)) { fehler++; console.log(`FEHLER ${name}: Gegenprobe blieb grün`); }
    }
    await page.close();
  }
  await browser.close();
}
await stop();
console.log(fehler ? `${fehler} FEHLER` : `GRUEN: ${messungen} Messungen (Chromium + WebKit, ${BREITEN.join('/')} px), Suche ok, Gegenprobe rot`);
process.exit(fehler ? 1 : 0);
