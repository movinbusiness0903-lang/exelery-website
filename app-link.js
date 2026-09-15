// ────────────────────────────────────────────────────────────────────────────────
// Zwischenseite fuer Links, die Exelery teilt (15.09.2026):
//
//   /einladung/?code=…   →  exelery://ref?code=…        (1 Monat Pro)
//   /freund/?code=…      →  exelery://friend?code=…     (Serie teilen)
//   /liste/?code=…       →  exelery://shopping?code=…   (Einkaufsliste)
//
// Warum ueberhaupt eine Webseite: WhatsApp & Co. machen nur https-Adressen
// klickbar, `exelery://` blieb grauer Text. Auf einem iPhone mit Exelery kommt
// man hier gar nicht erst an -- iOS oeffnet die App direkt
// (.well-known/apple-app-site-association). Diese Seite sieht, wer die App
// nicht hat, am PC ist oder bei wem das Handy die Verknuepfung noch nicht kennt.
//
// Welche Seite was oeffnet, steht am <main id="seite"> (data-ziel,
// data-code-laenge). Geprueft von pruefe-app-links.mjs.
// ────────────────────────────────────────────────────────────────────────────────
(function () {
  // Nach dem Launch hier die Store-Adressen eintragen. Solange sie leer sind,
  // fuehrt „Noch keine App?" zur Warteliste.
  var STORE = { ios: '', android: '' };

  var ua = typeof navigator !== 'undefined' && navigator.userAgent ? navigator.userAgent : '';
  var store = /Android/i.test(ua) ? STORE.android : /iPhone|iPad|iPod/i.test(ua) ? STORE.ios : '';
  if (store) {
    var holen = document.getElementById('holen');
    holen.setAttribute('href', store);
    holen.textContent = 'Exelery laden';
    document.getElementById('holenText').textContent =
      'Lade Exelery, melde dich an und tippe danach noch einmal auf diesen Link.';
  }

  var seite = document.getElementById('seite');
  var ziel = seite.getAttribute('data-ziel');
  var laenge = Number(seite.getAttribute('data-code-laenge'));

  var query = window.location.search ? window.location.search.substring(1) : '';
  var roh = new URLSearchParams(query).get('code') || '';
  // Grosszuegig wie die App: Kleinschreibung, Bindestriche und Leerzeichen
  // vom Kopieren sollen den Link nicht kaputtmachen.
  var code = roh.toUpperCase().replace(/[^A-Z0-9]/g, '');

  if (code.length !== laenge) {
    document.getElementById('gut').classList.add('verborgen');
    document.getElementById('schlecht').classList.remove('verborgen');
    return;
  }

  var codeFeld = document.getElementById('code');
  if (codeFeld) codeFeld.textContent = code;

  var appAdresse = 'exelery://' + ziel + '?code=' + encodeURIComponent(code);

  // Kein automatischer Sprung, wie auf /bestaetigt/: iOS zeigt sonst einen
  // Systemdialog, bevor man gelesen hat, worum es geht.
  document.getElementById('oeffnen').addEventListener('click', function () {
    window.location.href = appAdresse;
    // Passiert nach 1,5 s nichts, ist die App nicht installiert.
    setTimeout(function () {
      document.getElementById('hinweis').textContent =
        'Nichts passiert? Dann ist Exelery auf diesem Gerät nicht installiert. '
        + 'Öffne den Link auf dem Handy, auf dem die App liegt.';
    }, 1500);
  });

  var kopieren = document.getElementById('kopieren');
  if (kopieren) {
    kopieren.addEventListener('click', function () {
      var zeigen = function (text) { kopieren.textContent = text; };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(code).then(
          function () { zeigen('Kopiert'); },
          function () { zeigen('Bitte abschreiben'); }
        );
      } else {
        zeigen('Bitte abschreiben');
      }
    });
  }
})();
