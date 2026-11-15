# Stand Website-Geräte — 12.11.2026 (gesichert am 15.11. aus der Unterhaltung)

Die eigene Sitzung „Website: Handy-Mockups wieder scharf machen“ brach am
Ausgabenlimit ab und hat keine Stand-Datei geschrieben. Diese Datei stammt
aus ihrer Unterhaltung und dem `git diff`. **Nichts committet, nichts gepusht.**

## ⚠️ Kevins Korrektur

„es soll aber ein handyhintergrund sein … nichtmehr diesen iphone look“ →
**Der iPhone-Look bleibt.** Laut Diff wurde der Rahmen NICHT ersetzt: die
gebackenen Gerätebilder (`media/web/*-geraet*.webp`, `geraet-rahmen.json`)
sind unverändert. Vermutlich hat Kevin im sichtbaren Messfenster den
**Vergleichsstand vor dem Umbau** gesehen (Tag `stand-vor-umbau-03-11-2026`,
dort war der Rahmen noch in CSS gezeichnet). Muss in der Vorschau
nachgeprüft werden.

## Erledigt (im Arbeitsordner)

| Ursache | Änderung |
|---|---|
| Dunst ums Gerät (20-px-Ladebild mit Alpha hinter dem Gerät) | `ladebilder-bauen.mjs`: Vorschau nur noch die **Glasfläche**, deckend, genau aufs Glas gelegt (Lage aus `geraet-rahmen.json`). Gemessen: Aufhellung neben dem Rand 3–9 Stufen → 0,0–0,4 |
| `filter: drop-shadow` + `will-change` | weg; Schatten als `box-shadow` an einem `::before` in Gehäuseform (Einzug 3,4 %/1,6 %, Rundung 19 %/9,5 %, am Rahmenbild nachgemessen) |
| Dauerhafte 3D-Neigung | Faktor `schwung`: neigt sich nur beim Scrollen, klingt in 0,3 s auf **genau 0** ab; in Ruhe nur `translate` auf **ganzen Bildschirm-Pixeln** (`ganzePixel`, beachtet DPR 1,25) — Hero-Flug, `#phoneDevice`, alle `.shot-frame` |
| `sizes` zu knapp | echte Breiten je Bildart (300/260 px Desktop, vw am Handy) |

## Messungen

* Alle 17 bestehenden `pruefe-*.mjs` waren **vorher grün**.
* Neuer Riegel `pruefe-geraet-schaerfe.mjs` (+470 Zeilen) — misst Dunst und
  Kantenschärfe am gerenderten Bild. Sichtbares Fenster: erst „spawn
  UNKNOWN“, später lief die Messung in Chrome.
* DPR 1,25: die größere Datei (759w) wird **nicht** schärfer → `sizes` bleibt
  bei den echten Breiten.
* Letzte Vermutung der Sitzung: eine Viertelpixel-Lage im Layout macht das
  ruhende Bild noch minimal weich; sie wollte prüfen, ob das Heben nur in der
  Bewegung auftritt.

## Offen

1. Vorschau ansehen: iPhone-Look da? (Kevin)
2. Riegel `pruefe-geraet-schaerfe.mjs` fertig laufen lassen, Gegenprobe
   (Neigung in Ruhe wieder an → rot), alle 17 Riegel erneut grün.
3. Vorher/Nachher-Bildschirmfotos 1440 × 900 an Kevin.
4. Erst nach Kevins OK committen und pushen.

## Geänderte Dateien

`index.html` (+112/−26), `ladebilder-bauen.mjs` (+43/−5), neu
`pruefe-geraet-schaerfe.mjs`.
