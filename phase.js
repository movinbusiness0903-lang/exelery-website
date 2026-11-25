// EIN Schalter für die Phase der Website (Kevin 25.11.2026).
// Solange die Warteliste läuft: true. Zum Release auf false setzen, dann
// verschwindet jeder Knopf mit data-warteliste von selbst (Ratgeber usw.).
// Die Startseite liest ihn noch NICHT (OFFEN: beim Release mit umstellen).
window.EXELERY_WARTELISTE = true;
if (!window.EXELERY_WARTELISTE) document.documentElement.classList.add('ohne-warteliste');
