# Schriften lokal

Manrope und Inter liegen hier als Datei, statt sie bei jedem Seitenaufruf von
Google zu laden. Grund: Beim Laden von `fonts.googleapis.com` geht die
IP-Adresse jedes Besuchers an Google, bevor er irgendetwas angeklickt hat.
Dafuer braucht es entweder eine Einwilligung oder eben lokale Dateien.

## Was hier liegt

| Datei | Inhalt |
|---|---|
| `manrope-latin.woff2` | Manrope, Alphabet latin (enthaelt auch ae oe ue und ss) |
| `manrope-latin-ext.woff2` | Manrope, osteuropaeische Zeichen |
| `inter-latin.woff2` | Inter, Alphabet latin |
| `inter-latin-ext.woff2` | Inter, osteuropaeische Zeichen |

Beide Schriften sind **variabel**: eine Datei deckt alle Staerken ab. Deshalb
gibt es nur vier Dateien, aber 14 `@font-face`-Regeln in `index.html` - eine je
Staerke und Alphabet, genau wie Google sie ausgeliefert hat. Der Browser laedt
davon nur, was die Seite wirklich zeichnet (heute: Manrope 700 und 800,
Inter 400 und 700, jeweils latin).

## Lizenz

Beide stehen unter der **SIL Open Font License 1.1**. Selbst-Hosten ist
ausdruecklich erlaubt. Die Lizenztexte liegen daneben als `OFL-Manrope.txt`
und `OFL-Inter.txt` und muessen mitgeliefert bleiben.

## Erneuern

Die Dateien stammen aus Googles CSS-Endpunkt (Stand 25.09.2026). Sie muessen
nicht regelmaessig erneuert werden. Wenn doch einmal ein neuer Schriftschnitt
gebraucht wird, `pruefe-schriften.mjs` danach laufen lassen.
