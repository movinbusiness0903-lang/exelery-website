/* =====================================================================
   Back & Frost — gemeinsames Verhalten
   Mobil-Menü · Scroll-Reveal · mailto-Formular · Footer-Jahr
   ===================================================================== */
(function () {
  'use strict';

  /* ---- Mobil-Menü ---- */
  var burger = document.querySelector('.burger');
  var drawer = document.getElementById('mobileNav');
  var closeBtn = drawer ? drawer.querySelector('.mn-close') : null;

  function openNav() {
    if (!drawer) return;
    drawer.classList.add('open');
    document.body.classList.add('no-scroll');
    burger && burger.setAttribute('aria-expanded', 'true');
  }
  function closeNav() {
    if (!drawer) return;
    drawer.classList.remove('open');
    document.body.classList.remove('no-scroll');
    burger && burger.setAttribute('aria-expanded', 'false');
  }
  burger && burger.addEventListener('click', openNav);
  closeBtn && closeBtn.addEventListener('click', closeNav);
  drawer && drawer.querySelectorAll('nav a').forEach(function (a) {
    a.addEventListener('click', closeNav);
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeNav();
  });

  /* ---- Scroll-Reveal ---- */
  var reveals = document.querySelectorAll('.reveal');
  if (reveals.length) {
    if (!('IntersectionObserver' in window)) {
      reveals.forEach(function (e) { e.classList.add('in'); });
    } else {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
        });
      }, { threshold: 0.14 });
      reveals.forEach(function (e) { io.observe(e); });
    }
  }

  /* ---- Kontaktformular → mailto ---- */
  var form = document.getElementById('contactForm');
  if (form) {
    var status = document.getElementById('formStatus');
    form.addEventListener('submit', function (e) {
      e.preventDefault();

      var get = function (n) { var el = form.elements[n]; return el ? el.value.trim() : ''; };
      var name = get('name');
      var email = get('email');
      var firma = get('firma');
      var betreff = get('betreff') || 'Anfrage über die Website';
      var nachricht = get('nachricht');
      var consent = form.elements['consent'];

      if (!name || !email || !nachricht || (consent && !consent.checked)) {
        if (status) {
          status.textContent = 'Bitte füllen Sie die Pflichtfelder aus und bestätigen Sie die Datenschutzhinweise.';
          status.style.color = '#E11B22';
        }
        return;
      }

      var to = form.getAttribute('data-mailto') || 'info@backundfrost.de';
      var subject = '[Website] ' + betreff;
      var bodyLines = [
        'Name: ' + name,
        'E-Mail: ' + email,
        'Firma: ' + (firma || '—'),
        '',
        'Nachricht:',
        nachricht,
        '',
        '— gesendet über das Kontaktformular der Back & Frost Website'
      ];
      var href = 'mailto:' + encodeURIComponent(to) +
        '?subject=' + encodeURIComponent(subject) +
        '&body=' + encodeURIComponent(bodyLines.join('\n'));

      window.location.href = href;

      if (status) {
        status.textContent = 'Ihr E-Mail-Programm wird geöffnet. Klappt das nicht, schreiben Sie uns direkt an ' + to + '.';
        status.style.color = '#7FD4E0';
      }
    });
  }

  /* ---- Footer-Jahr ---- */
  document.querySelectorAll('[data-year]').forEach(function (el) {
    el.textContent = new Date().getFullYear();
  });
})();
