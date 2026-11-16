/* W3 · Jedes Bild groß ansehen (16.11.2026).
 *
 * Kevin: „Die Bilder überall auf der Webseite einzeln antippbar machen, aber
 * nicht, dass wenn man beim scrollen drauftippt und swiped das dann aufgeht
 * sondern nur beim klaren tip drauf … da bitte drauf achten, dass Qualität
 * gut bleibt."
 *
 * KLARER TIPP: Ein Bild öffnet nur, wenn der Finger (oder die Maus)
 *   - sich weniger als 10 px bewegt hat,
 *   - kürzer als 450 ms lag,
 *   - und dazwischen KEIN Scroll-Ereignis kam und kein pointercancel
 *     (iOS/Android brechen den Zeiger ab, sobald ein Wisch zum Scrollen wird).
 * Wischen, Scrollen und langes Drücken öffnen also nichts.
 *
 * QUALITÄT: Groß geladen wird immer die schärfste Quelle mit 1290 px:
 *   X-pm.webp      -> X-pm-1290.webp   (Screens in der Telefon-Szene)
 *   X-geraet.webp  -> X-1290.webp      (Kapitelbilder: der Screen ohne Rahmen)
 * Bis sie da ist, steht das kleine Bild (kein leeres Fenster).
 *
 * Wächter: pruefe-bildansicht.mjs (Tipp öffnet, Wisch nicht, Quelle >= 1290 px).
 */
(function () {
  'use strict';

  var BEWEGUNG_MAX = 10;   // px
  var DAUER_MAX = 450;     // ms

  function grosseQuelle(src) {
    if (/-pm\.webp$/.test(src)) return src.replace(/-pm\.webp$/, '-pm-1290.webp');
    if (/-geraet\.webp$/.test(src)) return src.replace(/-geraet\.webp$/, '-1290.webp');
    return src;
  }

  function tippbar(img) {
    if (!img || img.tagName !== 'IMG') return false;
    var src = img.getAttribute('src') || '';
    return src.indexOf('media/web/') !== -1 && !img.closest('.bildansicht');
  }

  /**
   * Welches Bild meint ein Tipp auf `ziel`?
   *
   * ⚠️ Die Handys (Startbereich, Telefon-Szene) liegen in einem 3D-Raum
   * (`transform-style:preserve-3d`, `perspective`). WebKit trifft dort beim
   * Tippen NICHT das Bild, sondern den Kasten drumherum (gemessen 16.11.2026:
   * `elementFromPoint` liefert `.phone-stage` bzw. `.hero-handy-platz`).
   * Darum: liegt der Tipp innerhalb eines Handys, gilt der Screen, den dieses
   * Handy gerade zeigt.
   */
  function bildFuer(ziel, x, y) {
    if (!ziel || !ziel.closest) return null;
    if (tippbar(ziel)) return ziel;
    var buehne = ziel.closest('.phone-stage, .hero-handy-platz, .phone-device');
    if (!buehne) return null;
    var geraet = buehne.classList.contains('phone-device') ? buehne : buehne.querySelector('.phone-device');
    if (!geraet) return null;
    var r = geraet.getBoundingClientRect();
    if (x < r.left || x > r.right || y < r.top || y > r.bottom) return null;
    var img = geraet.querySelector('.phone-screen.active img') || geraet.querySelector('img');
    return tippbar(img) ? img : null;
  }
  // Fuer pruefe-bildansicht.mjs: dieselbe Zuordnung, die ein Tipp benutzt.
  window.exeleryBildFuer = bildFuer;

  // ─── Die Ansicht (einmal angelegt) ──────────────────────────────────────
  var ansicht = document.createElement('div');
  ansicht.className = 'bildansicht';
  ansicht.setAttribute('role', 'dialog');
  ansicht.setAttribute('aria-modal', 'true');
  ansicht.setAttribute('aria-label', 'Bild groß');
  ansicht.setAttribute('aria-hidden', 'true');
  var gross = document.createElement('img');
  gross.alt = '';
  gross.decoding = 'async';
  var zu = document.createElement('button');
  zu.type = 'button';
  zu.className = 'ba-zu';
  zu.setAttribute('aria-label', 'Schließen');
  zu.textContent = '×';
  ansicht.appendChild(gross);
  ansicht.appendChild(zu);

  var vorher = null;   // Fokus vor dem Öffnen
  var ladeNr = 0;

  function oeffnen(img) {
    var nr = ++ladeNr;
    var klein = img.currentSrc || img.src;
    var ziel = grosseQuelle(img.getAttribute('src'));
    gross.src = klein;
    gross.alt = img.alt || '';
    gross.className = /abzeichen\.webp$/.test(img.getAttribute('src')) && !/-geraet|-pm/.test(img.getAttribute('src')) ? 'ba-rund' : '';
    gross.dataset.quelle = ziel;
    if (ziel !== klein) {
      var vorlader = new Image();
      vorlader.decoding = 'async';
      vorlader.onload = function () { if (nr === ladeNr) gross.src = ziel; };
      vorlader.src = ziel;
    }
    vorher = document.activeElement;
    if (!ansicht.parentNode) document.body.appendChild(ansicht);
    ansicht.setAttribute('aria-hidden', 'false');
    document.documentElement.style.overflow = 'hidden';
    // Erst im nächsten Bild die Klasse setzen, damit der Übergang läuft.
    requestAnimationFrame(function () { ansicht.classList.add('offen'); zu.focus({ preventScroll: true }); });
  }

  function schliessen() {
    if (!ansicht.classList.contains('offen')) return;
    ladeNr++;
    ansicht.classList.remove('offen');
    ansicht.setAttribute('aria-hidden', 'true');
    document.documentElement.style.overflow = '';
    if (vorher && vorher.focus) vorher.focus({ preventScroll: true });
  }

  zu.addEventListener('click', schliessen);
  // Daneben tippen schließt; das Bild selbst nicht.
  ansicht.addEventListener('click', function (e) { if (e.target === ansicht) schliessen(); });
  document.addEventListener('keydown', function (e) {
    if (!ansicht.classList.contains('offen')) return;
    if (e.key === 'Escape') { e.preventDefault(); schliessen(); }
    // Fokusfalle: der einzige Knopf ist „Schließen".
    if (e.key === 'Tab') { e.preventDefault(); zu.focus(); }
  });
  // Nach unten wischen schließt.
  var wischY = null;
  ansicht.addEventListener('pointerdown', function (e) { wischY = e.clientY; });
  ansicht.addEventListener('pointerup', function (e) {
    if (wischY !== null && e.clientY - wischY > 80) schliessen();
    wischY = null;
  });
  // Die Seite dahinter rollt nicht mit (iOS ignoriert overflow:hidden teils).
  ansicht.addEventListener('touchmove', function (e) { e.preventDefault(); }, { passive: false });

  // ─── Klarer Tipp ────────────────────────────────────────────────────────
  var start = null;
  document.addEventListener('pointerdown', function (e) {
    var img = bildFuer(e.target, e.clientX, e.clientY);
    if (!img || e.button > 0) { start = null; return; }
    start = { img: img, x: e.clientX, y: e.clientY, t: performance.now(), id: e.pointerId, gerollt: false };
  }, true);
  window.addEventListener('scroll', function () { if (start) start.gerollt = true; }, { passive: true });
  document.addEventListener('pointercancel', function () { start = null; }, true);
  document.addEventListener('pointerup', function (e) {
    var s = start;
    start = null;
    if (!s || e.pointerId !== s.id || bildFuer(e.target, e.clientX, e.clientY) !== s.img) return;
    var weg = Math.hypot(e.clientX - s.x, e.clientY - s.y);
    var dauer = performance.now() - s.t;
    if (weg < BEWEGUNG_MAX && dauer < DAUER_MAX && !s.gerollt) oeffnen(s.img);
  }, true);

  // Tastatur und Screenreader: Bilder sind auch per Enter erreichbar.
  function markieren() {
    Array.prototype.forEach.call(document.querySelectorAll('img'), function (img) {
      if (!tippbar(img) || img.classList.contains('ba-tippbar')) return;
      img.classList.add('ba-tippbar');
      if (img.alt) {
        img.tabIndex = 0;
        img.setAttribute('role', 'button');
        img.setAttribute('aria-label', img.alt + ' – groß ansehen');
        img.addEventListener('keydown', function (e) {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); oeffnen(img); }
        });
      }
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', markieren);
  else markieren();
})();
