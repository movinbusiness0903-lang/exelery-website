# Back & Frost — Webseite (Layout-Entwurf)

Webauftritt für **Back & Frost Leipzig GmbH & Co. KG**. Reines HTML/CSS/JS, keine
Build-Tools — einfach im Browser öffnen.

> **Wichtig:** Dieser Ordner ist ein eigenständiges Projekt und hat **nichts mit Exelery** zu tun.
> Die Exelery-Dateien (`/index.html`, `/impressum`, `/datenschutz` im Repo-Root) wurden **nicht** verändert.

## 👉 Die fertige Website: Ordner `website/`

Der Nutzer hat sich für **Konzept A (Dark & Edel)** entschieden. Daraus ist eine
**vollwertige, klickbare Mehrseiten-Website** entstanden — das ist der eigentliche
Liefergegenstand:

```
website/
├─ index.html         Startseite
├─ sortiment.html     Alle Kategorien mit Beispielprodukten
├─ ueber-uns.html     Über uns + Qualität (IFS)
├─ liefergebiete.html Liefergebiete
├─ kontakt.html       Kontaktformular (mailto) + Kontaktdaten
├─ impressum.html     Impressum (Vorlage mit Platzhaltern)
├─ datenschutz.html   Datenschutz (DSGVO-Vorlage)
└─ assets/  styles.css · app.js · logo.png · img/
```

**Öffnen:** `website/index.html` im Browser. Navigation, Mobil-Menü, interne Links und
das mailto-Kontaktformular funktionieren. Gemeinsames Design über `assets/styles.css`,
Verhalten über `assets/app.js`.

### Vor dem Go-Live ersetzen
- **Kontaktdaten:** `info@backundfrost.de`, Telefon, Adresse, Öffnungszeiten
  (Platzhalter sind im UI gelb markiert). Das mailto-Ziel steht im `<form>`-Attribut
  `data-mailto` in `kontakt.html`.
- **Impressum & Datenschutz:** Platzhalter `[…]` ausfüllen und **rechtlich prüfen lassen**.
- **Produktnamen/Texte** in `sortiment.html` und den Teasern anpassen.
- **`<meta name="robots" content="noindex">`** in jeder Seite entfernen, damit Suchmaschinen
  die Seite indexieren (aktuell als Entwurf gesperrt).
- Den orangefarbenen **„Layout-Entwurf"-Banner** (`.draft-banner`) entfernen.

---

## Die drei ursprünglichen Konzept-Entwürfe (Referenz)
Starte mit **`index.html`** (im Wurzelordner `backundfrost/`) — dort sind die drei Konzepte verlinkt. Oder direkt:

| Datei | Konzept | Stil |
|-------|---------|------|
| `konzept-1-dark-gold.html` | A | Dark & Edel — dunkel, exklusiv, Serifen, Rot/Eisblau-Akzente |
| `konzept-2-editorial-hell.html` | B | Editorial Hell — hell, ruhig, Magazin-Typografie |
| `konzept-3-warm-food.html` | C | Warm & Food — warme Bäckerei-Töne, große Food-Flächen, Frost-Kontrast |

Alle drei teilen dieselben Inhalte (Sortiment, Über uns/Qualität, Liefergebiete, Kontakt,
Footer mit Impressum/Datenschutz) — nur die Gestaltung unterscheidet sich.

## Ordnerstruktur
```
backundfrost/
├─ index.html                   Übersicht der 3 Konzepte
├─ konzept-1-dark-gold.html
├─ konzept-2-editorial-hell.html
├─ konzept-3-warm-food.html
├─ README.md
└─ assets/
   ├─ logo.png                  Logo, freigestellt (transparenter Hintergrund)
   ├─ logo-original.png         Original wie hochgeladen (Backup)
   └─ img/                      Platzhalter-Grafiken (selbst erstellt, „Beispiel“)
```

## Logo
- `assets/logo.png` ist das **freigestellte Logo** (transparenter Hintergrund) — funktioniert
  auf hellem und dunklem Untergrund. Erzeugt aus dem hochgeladenen Original per Chroma-Maske.
- Soll ein anderes Logo verwendet werden: einfach `assets/logo.png` ersetzen (gleicher Dateiname).

## Bilder & Videos austauschen
Die Flächen und Video-Bereiche nutzen aktuell **selbst erstellte Platzhalter-Grafiken** in
`assets/img/` (klar mit „Beispiel“ gekennzeichnet).

> **Warum keine echten Stockfotos?** Die Netzwerk-Policy der Build-Umgebung blockiert externe
> Bild-Hosts (Unsplash, Pexels o. Ä.). Daher wurden lizenzrechtlich unbedenkliche, selbst
> gestaltete SVG-Platzhalter verwendet. Diese lassen sich 1:1 gegen echte Fotos tauschen.

**So ersetzt du eine Fläche durch ein eigenes Foto:**
Im HTML steht z. B. `style="background-image:url('assets/img/cat-brot.svg')"`.
Lege dein Foto unter `assets/img/` ab (z. B. `brot.jpg`) und ändere den Pfad auf
`url('assets/img/brot.jpg')`.

**So bindest du später ein Higgsfield-Produktvideo ein:**
Suche im jeweiligen HTML den Block `<div class="video-frame" ...>`. Ersetze den Inhalt durch:
```html
<video controls poster="assets/img/video-poster.svg" style="width:100%;height:100%;object-fit:cover;">
  <source src="assets/video/mein-produktvideo.mp4" type="video/mp4">
</video>
```
Den kleinen Hinweis „Beispiel · wird durch eigenes Produktvideo ersetzt“ kannst du dann entfernen.

## Inhalte / Platzhalter-Texte
Folgende Angaben sind **Platzhalter** und sollten durch echte Daten ersetzt werden:
- Kontakt: `info@backundfrost.de`, Telefon `+49 (0) 000 000000`
- Footer-Links **Impressum** und **Datenschutz** (`href="#"`) → auf echte Seiten verlinken
- Texte in „Über uns/Qualität“ und „Liefergebiete“ nach Bedarf anpassen

## Markenfarben (aus dem Logo abgeleitet)
- Rot `#E11B22` (BACK)
- Eisblau / Cyan `#7FD4E0` (FROST)
