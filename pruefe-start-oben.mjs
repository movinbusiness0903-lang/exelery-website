// Prueft, dass die Startseite beim Oeffnen oben beginnt.
//
// Kevin, 17.09.2026: Wer exelery.de aus der Google-Suche oeffnet, landet
// sofort unten bei „Sei Day One", auch nach dem Neuladen. Ursache: Google
// haengt an Treffer einen Textsprung an (exelery.de/#:~:text=…), Chrome und
// Safari scrollen dann selbst zu diesem Text. Chrome springt beim Neuladen
// ausserdem an die letzte Stelle. Nach unten fuehren sollen nur die Knoepfe
// „Frueher Zugang" / „Die App ansehen" und Links mit /#warteliste bzw. /#app
// von unseren anderen Seiten.
//
// Dieses Skript fuehrt den ECHTEN Sprung-Block aus index.html mit einem
// nachgebauten Fenster aus. Das Scrollen des Browsers wird nachgestellt
// (Scroll-Ereignis mit neuer Lage), die Zeit laeuft ueber falsche Uhren.
//
// Aufruf: node pruefe-start-oben.mjs

import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const HTML = readFileSync(new URL('./index.html', import.meta.url), 'utf8');
const WARTELISTE_Y = 9950;
const APP_Y = 2400;

function sprungCode(html) {
  const m = html.match(/\/\* =+ Sprung zu Warteliste und App-Szene =+ \*\/([\s\S]*?)\/\* =+ Scroll-Maschine/);
  if (!m) throw new Error('Sprung-Block nicht gefunden');
  return m[1];
}

function welt(html, { art = 'navigate', hash = '', prerender = false } = {}) {
  const hoerer = {};
  const dokHoerer = {};
  let jetzt = 0;
  let uhren = [];
  const win = {
    scrollY: 0,
    innerHeight: 844,
    location: { hash },
    history: { pushState: (_a, _b, h) => { win.location.hash = h; } },
    performance: { getEntriesByType: (t) => (t === 'navigation' ? [{ type: art }] : []) },
    addEventListener: (typ, fn) => { (hoerer[typ] = hoerer[typ] || []).push(fn); },
    removeEventListener: (typ, fn) => { hoerer[typ] = (hoerer[typ] || []).filter((f) => f !== fn); },
    // Merkt, ob beim Zuruecksetzen weiches Scrollen an war (dann rollt Safari sichtbar hoch)
    scrollTo: (_x, y) => { win.scrollY = y; win.weich.push(document.documentElement.style.scrollBehavior !== 'auto'); },
    weich: [],
  };
  function ziel(y) {
    return {
      scrollIntoView: () => { win.scrollY = y; senden('scroll'); },
      getBoundingClientRect: () => ({ top: y - win.scrollY }),
    };
  }
  const ziele = { warteliste: ziel(WARTELISTE_Y), app: ziel(APP_Y) };
  const links = { warteliste: [], app: [] };
  const document = {
    prerendering: prerender,
    documentElement: { scrollHeight: 12000, style: { scrollBehavior: '' } },
    getElementById: (id) => ziele[id] || null,
    querySelectorAll: (sel) => {
      const id = (sel.match(/#(\w+)/) || [])[1];
      const a = { klicks: [], addEventListener: (typ, fn) => { if (typ === 'click') a.klicks.push(fn); } };
      if (id && links[id]) { links[id].push(a); return [a]; }
      return [];
    },
    addEventListener: (typ, fn) => { (dokHoerer[typ] = dokHoerer[typ] || []).push(fn); },
  };
  function senden(typ) { (hoerer[typ] || []).slice().forEach((fn) => fn({ type: typ, preventDefault() {} })); }
  function zeit(ms) {
    const ende = jetzt + ms;
    for (;;) {
      uhren.sort((a, b) => a.bei - b.bei);
      const u = uhren[0];
      if (!u || u.bei > ende) break;
      uhren.shift();
      jetzt = u.bei;
      u.fn();
    }
    jetzt = ende;
  }
  const kontext = {
    window: win,
    document,
    performance: win.performance,
    history: win.history,
    reduceMotion: true,
    setTimeout: (fn, ms) => { uhren.push({ bei: jetzt + (ms || 0), fn }); return uhren.length; },
    Date: { now: () => jetzt },
    Math,
  };
  vm.createContext(kontext);
  vm.runInContext(sprungCode(html), kontext);
  return {
    win,
    senden,
    zeit,
    /** Der Browser scrollt von selbst (Textsprung, Wiederherstellen). */
    browserScrollt: (y) => { win.scrollY = y; senden('scroll'); },
    klick: (id) => { senden('pointerdown'); links[id][0].klicks.forEach((fn) => fn({ preventDefault() {} })); },
    erscheint: () => { document.prerendering = false; (dokHoerer.prerenderingchange || []).forEach((fn) => fn()); },
  };
}

const FAELLE = [
  ['Google-Textsprung beim Oeffnen: bleibt oben', (html) => {
    const w = welt(html);
    w.browserScrollt(9765);
    const vorLoad = w.win.scrollY;
    w.senden('load');
    w.zeit(1200);
    w.browserScrollt(9800); // Chrome zieht nach, wenn Bilder nachladen
    return vorLoad === 0 && w.win.scrollY === 0 && w.win.weich.length > 0 && !w.win.weich.includes(true);
  }],
  ['Neuladen mit Textsprung oder alter Lage: bleibt oben', (html) => {
    const w = welt(html, { art: 'reload' });
    w.browserScrollt(1500);
    w.senden('load');
    w.browserScrollt(1500);
    return w.win.scrollY === 0;
  }],
  ['Neuladen nach Klick auf Frueher Zugang (#warteliste in der Adresse): bleibt oben', (html) => {
    const w = welt(html, { art: 'reload', hash: '#warteliste' });
    w.browserScrollt(WARTELISTE_Y);
    w.senden('load');
    w.zeit(2000);
    w.browserScrollt(WARTELISTE_Y);
    return w.win.scrollY === 0;
  }],
  ['Link /#warteliste von einer anderen Seite: landet bei der Warteliste', (html) => {
    const w = welt(html, { hash: '#warteliste' });
    w.browserScrollt(WARTELISTE_Y);
    w.senden('load');
    w.zeit(3000);
    return w.win.scrollY === WARTELISTE_Y;
  }],
  ['Link /#app von einer anderen Seite: landet in der App-Szene', (html) => {
    const w = welt(html, { hash: '#app' });
    w.senden('load');
    w.zeit(3000);
    return w.win.scrollY === APP_Y;
  }],
  ['Klick auf Frueher Zugang gleich nach dem Laden: springt trotzdem', (html) => {
    const w = welt(html);
    w.senden('load');
    w.zeit(500);
    w.klick('warteliste');
    w.zeit(3000);
    w.browserScrollt(WARTELISTE_Y);
    return w.win.scrollY === WARTELISTE_Y && w.win.location.hash === '#warteliste';
  }],
  ['Besucher scrollt selbst (Mausrad): wird nicht zurueckgezogen', (html) => {
    const w = welt(html);
    w.senden('load');
    w.senden('wheel');
    w.browserScrollt(600);
    return w.win.scrollY === 600;
  }],
  ['Besucher tippt auf dem Handy: wird nicht zurueckgezogen', (html) => {
    const w = welt(html);
    w.senden('touchstart');
    w.browserScrollt(800);
    return w.win.scrollY === 800;
  }],
  ['4 s nach dem Laden ist Schluss mit Festhalten', (html) => {
    const w = welt(html);
    w.senden('load');
    w.zeit(4100);
    w.browserScrollt(300);
    return w.win.scrollY === 300;
  }],
  ['Zurueck im Browser: Lage bleibt, wie der Browser sie setzt', (html) => {
    const w = welt(html, { art: 'back_forward' });
    w.browserScrollt(2000);
    w.senden('load');
    return w.win.scrollY === 2000;
  }],
  ['Vorab geladen (prerender): Frist beginnt erst beim Erscheinen', (html) => {
    const w = welt(html, { prerender: true });
    w.senden('load');
    w.zeit(10000); // Nutzer liest noch Google
    w.erscheint();
    w.browserScrollt(9765);
    const direkt = w.win.scrollY;
    w.zeit(4100);
    w.browserScrollt(400);
    return direkt === 0 && w.win.scrollY === 400;
  }],
];

function pruefen(html, leise) {
  let alleOk = true;
  for (const [name, fall] of FAELLE) {
    let ok;
    try { ok = fall(html); } catch (e) { ok = false; if (!leise) console.log('   Fehler:', e.message); }
    if (!ok) alleOk = false;
    if (!leise) console.log(`${ok ? 'ok  ' : 'FEHLER'} ${name}`);
  }
  return alleOk;
}

let rot = !pruefen(HTML, false);

const GEGENPROBEN = [
  ['kein Festhalten (alter Stand)', (h) => h.replace("if (!sprungBeimLaden && ankunft !== 'back_forward') obenHalten();", '')],
  ['Sprung auch beim Neuladen', (h) => h.replace("window.location.hash === '#' + id && ankunft === 'navigate'", "window.location.hash === '#' + id")],
  ['Mausrad loest das Festhalten nicht', (h) => h.replace("'wheel', 'touchstart', 'keydown', 'mousedown', 'pointerdown'", "'touchstart', 'keydown', 'mousedown', 'pointerdown'")],
  ['Frist laeuft schon waehrend prerender', (h) => h.replace('if (document.prerendering) {', 'if (false) {')],
  ['Zuruecksetzen mit weichem Scrollen (Safari rollt sichtbar hoch)', (h) => h.replace("wurzel.scrollBehavior = 'auto';", '')],
];
for (const [was, sabotage] of GEGENPROBEN) {
  const html = sabotage(HTML);
  if (html === HTML) { console.log(`FEHLER Gegenprobe „${was}" liess sich nicht einschleusen`); rot = true; continue; }
  const erkannt = !pruefen(html, true);
  if (!erkannt) rot = true;
  console.log(erkannt ? `ok   Gegenprobe „${was}" wird erkannt` : `FEHLER Gegenprobe „${was}" blieb unentdeckt`);
}

console.log(rot ? '\nROT' : '\nGRUEN');
process.exit(rot ? 1 : 0);
