// Prueft die Zwischenseiten /einladung/, /freund/ und /liste/ samt /app-link.js
// und der Datei, mit der iOS diese Links direkt in der App oeffnet.
//
// Anlass 15.09.2026: In WhatsApp kam `exelery://ref?code=…` als grauer Text an.
// Die App teilt jetzt https://exelery.de/einladung/?code=… — und wer die App
// nicht hat, landet hier. Ein Fehler auf diesen Seiten faellt niemandem auf,
// der die App besitzt, denn der sieht die Seite nie.
//
// Wie pruefe-bestaetigt.mjs: der ECHTE Skriptblock laeuft mit den ECHTEN
// Attributen der ECHTEN Seiten in einem minimalen Browser-Ersatz.
//
// Aufruf:  node pruefe-app-links.mjs
// Beendet sich mit 1, wenn ein Fall falsch laeuft.

import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';

// ⚠️ fileURLToPath, nicht `.pathname` — „Fitness App" hat ein Leerzeichen.
const HIER = fileURLToPath(new URL('.', import.meta.url));
const SKRIPT = readFileSync(HIER + 'app-link.js', 'utf8');

let fehler = 0;
const meckern = (s) => {
  console.log('  FEHLER  ' + s);
  fehler++;
};

// ─── Die echten Seiten lesen ─────────────────────────────────────────────────
const SEITEN = [
  { ordner: 'einladung', ziel: 'ref', laenge: 8, beispiel: 'PRVHB7X4' },
  { ordner: 'freund', ziel: 'friend', laenge: 8, beispiel: 'ZZ99YY88' },
  { ordner: 'liste', ziel: 'shopping', laenge: 6, beispiel: 'AB12CD' },
];

function seiteLesen(ordner) {
  const html = readFileSync(`${HIER}${ordner}/index.html`, 'utf8');
  const main = (html.match(/<main[^>]*\bid="seite"[^>]*>/) || [''])[0];
  const attr = (name) => (main.match(new RegExp(`${name}="([^"]*)"`)) || [])[1];
  return {
    html,
    ids: [...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]),
    verborgen: new Set([...html.matchAll(/\sid="([^"]+)"\s+class="[^"]*\bverborgen\b/g)].map((m) => m[1])),
    attrs: { 'data-ziel': attr('data-ziel'), 'data-code-laenge': attr('data-code-laenge') },
  };
}

// ─── Minimaler Browser-Ersatz ────────────────────────────────────────────────
function laufen(skript, seite, adresse, userAgent = '') {
  const url = new URL(adresse);
  const el = {};
  for (const id of seite.ids) {
    const e = {
      klassen: new Set(seite.verborgen.has(id) ? ['verborgen'] : []),
      attrs: id === 'seite' ? { ...seite.attrs } : {},
      textContent: '',
      handler: [],
    };
    e.classList = { add: (k) => e.klassen.add(k), remove: (k) => e.klassen.delete(k) };
    e.getAttribute = (n) => e.attrs[n] ?? null;
    e.setAttribute = (n, v) => { e.attrs[n] = String(v); };
    e.addEventListener = (_typ, fn) => e.handler.push(fn);
    el[id] = e;
  }
  const fenster = { location: { search: url.search, hash: url.hash, href: adresse } };

  runInNewContext(skript, {
    window: fenster,
    document: { getElementById: (id) => el[id] ?? null },
    navigator: { userAgent },
    URLSearchParams,
    setTimeout: () => 0,
  });

  const zeigtGut = !el.gut.klassen.has('verborgen') && el.schlecht.klassen.has('verborgen');
  if (zeigtGut) for (const fn of el.oeffnen?.handler ?? []) fn();

  return {
    zeigtGut,
    ziel: fenster.location.href,
    code: el.code ? el.code.textContent : null,
    holen: el.holen?.attrs.href ?? null,
  };
}

// ─── Die Faelle ──────────────────────────────────────────────────────────────
function faelle(skript, still = false) {
  let schlecht = 0;
  const pruefen = (name, ok, info) => {
    if (ok) {
      if (!still) console.log(`  ok  ${name}`);
    } else {
      if (!still) meckern(`${name}${info ? ` (${info})` : ''}`);
      schlecht++;
    }
  };

  for (const s of SEITEN) {
    const seite = seiteLesen(s.ordner);
    const basis = `https://exelery.de/${s.ordner}/`;
    const lauf = (query, ua) => {
      try {
        return laufen(skript, seite, basis + query, ua);
      } catch (e) {
        return { ausnahme: e.message };
      }
    };
    if (!still) console.log(`/${s.ordner}/`);

    const gut = lauf(`?code=${s.beispiel}`);
    pruefen('gueltiger Code oeffnet die richtige App-Adresse',
      gut.zeigtGut && gut.ziel === `exelery://${s.ziel}?code=${s.beispiel}`, JSON.stringify(gut));

    const kopiert = s.beispiel.toLowerCase().replace(/^(..)/, '$1-');
    const unordentlich = lauf(`?code=${encodeURIComponent(' ' + kopiert + ' ')}`);
    pruefen('kleingeschrieben mit Bindestrich wird repariert',
      unordentlich.zeigtGut && unordentlich.ziel === `exelery://${s.ziel}?code=${s.beispiel}`, JSON.stringify(unordentlich));

    // Bei einem kaputten Link darf die Seite nirgendwohin springen: die
    // Adresse bleibt die, mit der sie aufgerufen wurde.
    const bleibt = (query) => {
      const r = lauf(query);
      return { r, ok: !r.zeigtGut && r.ziel === basis + query };
    };

    const ohne = bleibt('');
    pruefen('ohne Code: Hinweis statt Knopf', ohne.ok, JSON.stringify(ohne.r));

    const kurz = bleibt(`?code=${s.beispiel.slice(0, 3)}`);
    pruefen('abgeschnittener Code: Hinweis statt Knopf', kurz.ok, JSON.stringify(kurz.r));

    const boese = bleibt(`?code=${encodeURIComponent('"><img src=x onerror=alert(1)>')}`);
    pruefen('eingeschleuster Text wird nicht zur App-Adresse', boese.ok, JSON.stringify(boese.r));

    if (seite.ids.includes('code')) {
      pruefen('Code wird angezeigt', gut.code === s.beispiel, JSON.stringify(gut.code));
    }

    pruefen('vor dem Launch fuehrt „Noch keine App?" zur Warteliste',
      !seite.ids.includes('holen') ? false : lauf(`?code=${s.beispiel}`, 'iPhone').holen === null,
      'Link wurde umgeschrieben, obwohl keine Store-Adresse eingetragen ist');
  }

  // Nach dem Launch: Store-Adresse je Geraet
  const mitStore = skript.replace("var STORE = { ios: '', android: '' };",
    "var STORE = { ios: 'https://apps.apple.com/app/id1', android: 'https://play.google.com/store/apps/details?id=com.exelery.app' };");
  if (mitStore === skript) {
    pruefen('Store-Konstante gefunden', false, 'die Zeile steht nicht mehr so in app-link.js');
  } else {
    const seite = seiteLesen('einladung');
    const iphone = laufen(mitStore, seite, 'https://exelery.de/einladung/?code=PRVHB7X4', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)');
    const android = laufen(mitStore, seite, 'https://exelery.de/einladung/?code=PRVHB7X4', 'Mozilla/5.0 (Linux; Android 15)');
    const pc = laufen(mitStore, seite, 'https://exelery.de/einladung/?code=PRVHB7X4', 'Mozilla/5.0 (Windows NT 10.0)');
    if (!still) console.log('nach dem Launch');
    pruefen('iPhone bekommt den App Store', iphone.holen === 'https://apps.apple.com/app/id1', iphone.holen);
    pruefen('Android bekommt Google Play', android.holen?.startsWith('https://play.google.com/'), android.holen);
    pruefen('PC bleibt bei der Warteliste', pc.holen === null, pc.holen);
  }
  return schlecht;
}

fehler += faelle(SKRIPT);

// ─── Rahmen: Seitenkopf, iOS-Datei, Jekyll ───────────────────────────────────
console.log('\nRahmen');
for (const s of SEITEN) {
  const { html } = seiteLesen(s.ordner);
  if (!/name="robots" content="noindex/.test(html)) meckern(`/${s.ordner}/: noindex fehlt`);
  if (!html.includes('property="og:title"')) meckern(`/${s.ordner}/: og:title fehlt (keine Vorschaukarte in WhatsApp)`);
  if (!html.includes('<script src="/app-link.js"></script>')) meckern(`/${s.ordner}/: /app-link.js wird nicht geladen`);
  if (!html.includes('href="/app-link.css"')) meckern(`/${s.ordner}/: /app-link.css wird nicht geladen`);
}
const aasaDatei = HIER + '.well-known/apple-app-site-association';
if (!existsSync(aasaDatei)) {
  meckern('.well-known/apple-app-site-association fehlt');
} else {
  try {
    const aasa = JSON.parse(readFileSync(aasaDatei, 'utf8'));
    const detail = aasa.applinks?.details?.[0];
    if (!detail?.appIDs?.includes('B2TS7Z7677.com.exelery.app')) meckern('apple-app-site-association: App-ID fehlt');
    for (const s of SEITEN) {
      if (!detail?.components?.some((c) => c['/'] === `/${s.ordner}/*`)) {
        meckern(`apple-app-site-association: /${s.ordner}/* fehlt`);
      }
    }
    if (detail?.components?.some((c) => String(c['/']).startsWith('/bestaetigt'))) {
      meckern('apple-app-site-association enthaelt /bestaetigt/ — der Anmeldeweg soll ueber die Seite laufen');
    }
  } catch (e) {
    meckern(`apple-app-site-association ist kein gueltiges JSON: ${e.message}`);
  }
}
if (!/include:[\s\S]*\.well-known/.test(existsSync(HIER + '_config.yml') ? readFileSync(HIER + '_config.yml', 'utf8') : '')) {
  meckern('_config.yml nimmt .well-known nicht auf — GitHub Pages liefert die iOS-Datei sonst nicht aus');
}
console.log(fehler === 0 ? '  in Ordnung' : '');

// ─── Gegenprobe ──────────────────────────────────────────────────────────────
console.log('\nGegenprobe');
const SABOTAGEN = [
  { name: 'Code wird nicht mehr bereinigt', von: ".toUpperCase().replace(/[^A-Z0-9]/g, '')", zu: '' },
  { name: 'Laenge wird nicht mehr geprueft', von: 'code.length !== laenge', zu: 'code.length === 0' },
  { name: 'falsches App-Ziel', von: "'exelery://' + ziel", zu: "'exelery://ref'" },
];
for (const s of SABOTAGEN) {
  if (!SKRIPT.includes(s.von)) {
    meckern(`Sabotage „${s.name}" griff nicht — die Zeile steht nicht mehr so in app-link.js`);
    continue;
  }
  if (faelle(SKRIPT.replace(s.von, s.zu), true) === 0) {
    meckern(`Sabotage „${s.name}" blieb unbemerkt — kein Fall deckt das ab`);
  } else {
    console.log(`  ok  „${s.name}" wird erkannt`);
  }
}

console.log(fehler === 0 ? '\nAlles gruen.' : `\n${fehler} Fehler.`);
process.exit(fehler === 0 ? 0 : 1);
