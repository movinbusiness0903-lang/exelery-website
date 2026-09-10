// Prueft die Zwischenseite /bestaetigt/ — die Seite, auf der ein neuer Nutzer
// nach dem Klick auf "E-Mail bestaetigen" landet.
//
// Anlass: Am 10.09.2026 hat Kevin gemeldet, dass er sich nach der Bestaetigung
// trotzdem von Hand anmelden musste. Ursache, gemessen in der Datenbank:
//
//   auth.users        email_confirmed_at gesetzt, last_sign_in_at NULL
//   auth.flow_state   authentication_method 'email/signup',
//                     auth_code_issued_at exakt zum Bestaetigungszeitpunkt
//
// Die Bestaetigung lief also durch, aber es entstand nie eine Sitzung. Grund:
// Der Supabase-Client laeuft mit flowType 'pkce' und bekommt darum ein
// `?code=` im QUERY — diese Seite las aber nur das FRAGMENT hinter dem `#`.
// Der Code wurde verworfen.
//
// Dieses Skript fuehrt den echten Skriptblock aus der echten Datei aus, mit
// einem minimalen Browser-Ersatz drumherum. Es prueft nicht eine Kopie der
// Logik, sondern die Logik, die ausgeliefert wird.
//
// Aufruf:  node pruefe-bestaetigt.mjs
// Beendet sich mit 1, wenn ein Fall falsch laeuft.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';

// ⚠️ fileURLToPath, nicht `.pathname` — der Ordner heisst „Fitness App" mit
// Leerzeichen, das steht in einer URL als %20 drin.
const HIER = fileURLToPath(new URL('.', import.meta.url));
const DATEI = HIER + 'bestaetigt/index.html';

let fehler = 0;
const meckern = (s) => {
  console.log('  FEHLER  ' + s);
  fehler++;
};

// ─── Den Skriptblock aus der echten Seite holen ──────────────────────────────
function skriptHolen(html) {
  const a = html.indexOf('<script>');
  const b = html.indexOf('</script>', a);
  if (a < 0 || b < 0) throw new Error('Kein <script>-Block in bestaetigt/index.html');
  return html.slice(a + '<script>'.length, b);
}

// ─── Minimaler Browser-Ersatz ────────────────────────────────────────────────
// Nur so viel, wie die Seite anfasst. Was sie sonst noch braeuchte, faellt
// hier sofort als Ausnahme auf — und das ist gewollt.
function seiteLaufenLassen(skript, adresse) {
  const url = new URL(adresse);

  const elemente = {};
  const macheElement = (id) => ({
    id,
    klassen: new Set(id === 'schlecht' ? ['verborgen'] : []),
    textContent: '',
    handler: [],
    classList: {
      add(k) { elemente[id].klassen.add(k); },
      remove(k) { elemente[id].klassen.delete(k); },
    },
    addEventListener(_typ, fn) { elemente[id].handler.push(fn); },
  });
  for (const id of ['gut', 'schlecht', 'zurueck', 'zurueck2', 'hinweis']) {
    elemente[id] = macheElement(id);
  }

  const fenster = {
    location: { search: url.search, hash: url.hash, href: adresse },
  };

  runInNewContext(skript, {
    window: fenster,
    document: { getElementById: (id) => elemente[id] ?? null },
    URLSearchParams,
    // Der Hinweis nach 1,5 s interessiert hier nicht — er ist reine Anzeige.
    setTimeout: () => 0,
  });

  // Den Knopf druecken, der gerade sichtbar ist.
  const sichtbarerKnopf = elemente.gut.klassen.has('verborgen') ? 'zurueck2' : 'zurueck';
  for (const fn of elemente[sichtbarerKnopf].handler) fn();

  return {
    zeigtErfolg: !elemente.gut.klassen.has('verborgen'),
    ziel: fenster.location.href,
  };
}

// ─── Die Faelle ──────────────────────────────────────────────────────────────
// Jeder Fall sagt: welche Adresse Supabase liefert, ob der Erfolgsbildschirm
// kommen soll, und was im Deep-Link an die App stehen muss.
const FAELLE = [
  {
    name: 'PKCE — Code im Query (unser echter Fall)',
    adresse: 'https://exelery.de/bestaetigt/?code=pkce123',
    erfolg: true,
    zielEnthaelt: ['exelery://auth/callback', 'code=pkce123'],
  },
  {
    name: 'Implicit — Tokens im Fragment',
    adresse: 'https://exelery.de/bestaetigt/#access_token=aaa&refresh_token=bbb&type=signup',
    erfolg: true,
    zielEnthaelt: ['exelery://auth/callback', '#access_token=aaa', 'refresh_token=bbb'],
  },
  {
    name: 'Abgelaufener Link — Fehler im Query',
    adresse: 'https://exelery.de/bestaetigt/?error=access_denied&error_description=Email+link+is+invalid+or+has+expired',
    erfolg: false,
  },
  {
    name: 'Abgelaufener Link — Fehler im Fragment',
    adresse: 'https://exelery.de/bestaetigt/#error=access_denied&error_code=otp_expired',
    erfolg: false,
  },
  {
    name: 'Seite ohne alles (jemand tippt die Adresse von Hand)',
    adresse: 'https://exelery.de/bestaetigt/',
    erfolg: false,
  },
  {
    name: 'Halbe Tokens — access_token ohne refresh_token',
    adresse: 'https://exelery.de/bestaetigt/#access_token=aaa',
    erfolg: false,
  },
  {
    // Supabase haengt bei manchen Vorlagen beides an. Dann muss auch beides
    // ankommen — die App sucht sich das Passende heraus.
    name: 'Beides gleichzeitig',
    adresse: 'https://exelery.de/bestaetigt/?code=pkce123#access_token=aaa&refresh_token=bbb',
    erfolg: true,
    zielEnthaelt: ['code=pkce123', '#access_token=aaa'],
  },
];

function alleFaellePruefen(skript, still = false) {
  let schlecht = 0;
  for (const fall of FAELLE) {
    let ergebnis;
    try {
      ergebnis = seiteLaufenLassen(skript, fall.adresse);
    } catch (e) {
      if (!still) meckern(`${fall.name}: Ausnahme — ${e.message}`);
      schlecht++;
      continue;
    }

    if (ergebnis.zeigtErfolg !== fall.erfolg) {
      if (!still) {
        meckern(
          `${fall.name}: zeigt ${ergebnis.zeigtErfolg ? 'Erfolg' : 'Fehler'}, ` +
            `erwartet war ${fall.erfolg ? 'Erfolg' : 'Fehler'}`,
        );
      }
      schlecht++;
      continue;
    }

    for (const teil of fall.zielEnthaelt ?? []) {
      if (!ergebnis.ziel.includes(teil)) {
        if (!still) meckern(`${fall.name}: „${teil}" fehlt im Deep-Link (${ergebnis.ziel})`);
        schlecht++;
      }
    }

    if (!still && schlecht === 0) console.log(`  ok  ${fall.name}`);
  }
  return schlecht;
}

// ─── Durchlauf ───────────────────────────────────────────────────────────────
const html = readFileSync(DATEI, 'utf8');
const skript = skriptHolen(html);

console.log('bestaetigt/index.html');
fehler += alleFaellePruefen(skript);

// ─── Gegenprobe ──────────────────────────────────────────────────────────────
// ⚠️ Eine Pruefung kann gruen sein, ohne zu pruefen. Deshalb bauen wir den
// Fehler von 10.09.2026 absichtlich wieder ein — die Seite liest dann nur
// noch das Fragment — und verlangen, dass es auffaellt. Wird die Sabotage
// NICHT bemerkt, ist dieses Skript wertlos und sagt das auch.
console.log('\nGegenprobe (Query-Auswertung absichtlich zurueckgebaut)');
const sabotiert = skript.replace(
  'window.location.search ? window.location.search.substring(1) : \'\'',
  "''",
);
if (sabotiert === skript) {
  meckern('Sabotage griff nicht — die erwartete Zeile steht nicht mehr so in der Datei');
} else if (alleFaellePruefen(sabotiert, true) === 0) {
  meckern('Sabotage blieb unbemerkt — diese Pruefung prueft nichts');
} else {
  console.log('  ok  wird erkannt');
}

console.log(fehler === 0 ? '\nAlles gruen.' : `\n${fehler} Fehler.`);
process.exit(fehler === 0 ? 0 : 1);
